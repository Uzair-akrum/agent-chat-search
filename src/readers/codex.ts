/**
 * Codex CLI chat history reader
 * Reads from ~/.codex/sessions/ (or $CODEX_HOME/sessions/)
 */

import { BaseAgentReader } from './base.js';
import type { AgentType, Session, Message } from '../types.js';
import { readJSONL } from '../lib/jsonl.js';
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { homedir } from 'os';

interface CodexSessionMetaPayload {
  id?: string;
  timestamp?: string;
  cwd?: string;
}

interface CodexMessagePayload {
  type?: string;
  role?: string;
  content?: unknown;
}

interface CodexContentBlock {
  type?: string;
  text?: string;
}

export class CodexReader extends BaseAgentReader {
  agentType: AgentType = 'codex';

  private getCodexHome(): string {
    return process.env.CODEX_HOME || join(homedir(), '.codex');
  }

  getSessionsDir(): string {
    return join(this.getCodexHome(), 'sessions');
  }

  /**
   * Recursively discover Codex session JSONL files.
   */
  private async listSessionFiles(dir: string = this.getSessionsDir()) {
    const files: string[] = [];

    const walk = async (currentDir: string): Promise<void> => {
      let entries;
      try {
        entries = await fs.readdir(currentDir, {
          withFileTypes: true,
          encoding: 'utf-8',
        });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath);
          continue;
        }

        if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          files.push(fullPath);
        }
      }
    };

    await walk(dir);
    files.sort();
    return files;
  }

  /**
   * Extract searchable text from Codex content blocks.
   */
  private extractCodexMessageText(content: unknown): string {
    if (typeof content === 'string') {
      return content.trim();
    }

    if (Array.isArray(content)) {
      const parts = content
        .map((block) => {
          if (typeof block === 'string') {
            return block;
          }

          if (typeof block === 'object' && block !== null) {
            const typedBlock = block as CodexContentBlock;
            if (
              (typedBlock.type === 'input_text' ||
                typedBlock.type === 'output_text' ||
                typedBlock.type === 'text') &&
              typeof typedBlock.text === 'string'
            ) {
              return typedBlock.text;
            }

            if (typeof typedBlock.text === 'string') {
              return typedBlock.text;
            }
          }

          return '';
        })
        .filter((part) => part.length > 0);

      return parts.join('\n').trim();
    }

    if (
      typeof content === 'object' &&
      content !== null &&
      typeof (content as { text?: unknown }).text === 'string'
    ) {
      return ((content as { text: string }).text || '').trim();
    }

    return '';
  }

  /**
   * Parse a timestamp value into a valid Date if possible.
   */
  private parseTimestamp(value: unknown): Date | undefined {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return undefined;
    }

    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
      return undefined;
    }

    return parsed;
  }

  /**
   * Extract session ID from Codex rollout filename.
   */
  private extractSessionIdFromFilename(filePath: string): string {
    const fileName = basename(filePath);
    const uuidMatch = fileName.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i,
    );

    if (uuidMatch) {
      return uuidMatch[1];
    }

    return fileName.replace(/\.jsonl$/i, '');
  }

  /**
   * Parse a Codex session file into our session model.
   */
  private async readSessionFromFile(
    filePath: string,
    requestedSessionId?: string,
  ): Promise<Session | null> {
    const lines = await readJSONL(filePath);
    if (lines.length === 0) {
      return null;
    }

    const sessionMetaLine = lines.find(
      (line) =>
        line &&
        line.type === 'session_meta' &&
        line.payload &&
        typeof line.payload === 'object',
    );
    const sessionMeta = sessionMetaLine?.payload as
      | CodexSessionMetaPayload
      | undefined;

    const sessionId =
      (typeof sessionMeta?.id === 'string' && sessionMeta.id.trim()) ||
      this.extractSessionIdFromFilename(filePath);

    if (
      requestedSessionId &&
      !basename(filePath).includes(requestedSessionId) &&
      sessionId !== requestedSessionId
    ) {
      return null;
    }

    let sessionTimestamp =
      this.parseTimestamp(sessionMeta?.timestamp) ||
      this.parseTimestamp(sessionMetaLine?.timestamp) ||
      this.parseTimestamp(lines[0]?.timestamp);

    if (!sessionTimestamp) {
      try {
        const stats = await fs.stat(filePath);
        sessionTimestamp =
          stats.birthtime.getTime() > 0 ? stats.birthtime : stats.mtime;
      } catch {
        sessionTimestamp = new Date();
      }
    }

    const workDir =
      (typeof sessionMeta?.cwd === 'string' && sessionMeta.cwd.trim()) ||
      'unknown';

    const messages: Message[] = [];

    for (const line of lines) {
      if (!line || line.type !== 'response_item' || !line.payload) {
        continue;
      }

      const payload = line.payload as CodexMessagePayload;
      if (payload.type !== 'message') {
        continue;
      }

      if (payload.role !== 'user' && payload.role !== 'assistant') {
        continue;
      }

      const content = this.extractCodexMessageText(payload.content);
      if (!content) {
        continue;
      }

      const messageTimestamp =
        this.parseTimestamp(line.timestamp) || sessionTimestamp;

      messages.push({
        role: payload.role,
        content,
        timestamp: messageTimestamp,
        agentType: this.agentType,
        sessionId,
        workDir,
      });
    }

    return {
      sessionId,
      agentType: this.agentType,
      workDir,
      timestamp: sessionTimestamp,
      messages,
    };
  }

  /**
   * Find all Codex sessions.
   */
  async findSessions(workDirFilter?: string): Promise<Session[]> {
    const sessions: Session[] = [];

    try {
      const files = await this.listSessionFiles();

      for (const filePath of files) {
        const session = await this.readSessionFromFile(filePath);
        if (!session || session.messages.length === 0) {
          continue;
        }

        if (workDirFilter && !session.workDir.includes(workDirFilter)) {
          continue;
        }

        sessions.push(session);
      }
    } catch (error) {
      console.error('Error reading Codex sessions:', error);
    }

    return sessions;
  }

  /**
   * Read a specific Codex session by ID.
   */
  async readSession(
    sessionId: string,
    additionalContext?: { filePath: string },
  ): Promise<Session | null> {
    try {
      if (additionalContext?.filePath) {
        return await this.readSessionFromFile(
          additionalContext.filePath,
          sessionId,
        );
      }

      const files = await this.listSessionFiles();
      const matchingByName = files.find((file) =>
        basename(file).includes(sessionId),
      );

      if (matchingByName) {
        return await this.readSessionFromFile(matchingByName, sessionId);
      }

      // Fallback: check session_meta ID when filename does not contain session ID
      for (const filePath of files) {
        const session = await this.readSessionFromFile(filePath, sessionId);
        if (session) {
          return session;
        }
      }
    } catch {
      // Session not found or can't be read
      return null;
    }

    return null;
  }
}
