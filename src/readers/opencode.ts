/**
 * OpenCode chat history reader
 * Reads from ~/.local/share/opencode/storage/ (or $XDG_DATA_HOME/opencode/storage/)
 * Supports OPENCODE_DATA_DIR env var override for testing.
 */

import { BaseAgentReader } from './base.js';
import type { AgentType, Session, Message } from '../types.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface OpenCodeProject {
  id: string;
  worktree?: string;
  time?: { created?: number; updated?: number };
}

interface OpenCodeSession {
  id: string;
  projectID?: string;
  directory?: string;
  title?: string;
  time?: { created?: number; updated?: number };
}

interface OpenCodeMessage {
  id: string;
  sessionID?: string;
  role?: string;
  time?: { created?: number; completed?: number };
}

interface OpenCodePart {
  id: string;
  messageID?: string;
  type?: string;
  text?: string;
  tool?: unknown;
  state?: unknown;
}

export class OpenCodeReader extends BaseAgentReader {
  agentType: AgentType = 'opencode';

  private getStorageDir(): string {
    if (process.env.OPENCODE_DATA_DIR) {
      return process.env.OPENCODE_DATA_DIR;
    }
    const dataHome =
      process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
    return join(dataHome, 'opencode', 'storage');
  }

  getSessionsDir(): string {
    return this.getStorageDir();
  }

  /**
   * Safely read and parse a JSON file. Returns null on failure.
   */
  private async readJSON<T>(filePath: string): Promise<T | null> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  /**
   * List all JSON files in a directory (non-recursive). Returns empty array on failure.
   */
  private async listJSONFiles(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile() && e.name.endsWith('.json'))
        .map((e) => join(dir, e.name));
    } catch {
      return [];
    }
  }

  /**
   * List subdirectories in a directory. Returns empty array on failure.
   */
  private async listSubdirs(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => join(dir, e.name));
    } catch {
      return [];
    }
  }

  /**
   * Build a map of projectId -> worktree from project JSON files.
   */
  private async buildProjectMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const projectDir = join(this.getStorageDir(), 'project');
    const files = await this.listJSONFiles(projectDir);

    for (const file of files) {
      const project = await this.readJSON<OpenCodeProject>(file);
      if (project?.id) {
        map.set(project.id, project.worktree || 'unknown');
      }
    }

    return map;
  }

  /**
   * Read all parts for a message and combine text content.
   */
  private async readMessageParts(messageId: string): Promise<string> {
    const partsDir = join(this.getStorageDir(), 'part', messageId);
    const files = await this.listJSONFiles(partsDir);
    const parts: OpenCodePart[] = [];

    for (const file of files) {
      const part = await this.readJSON<OpenCodePart>(file);
      if (part) {
        parts.push(part);
      }
    }

    // Extract text from text and reasoning part types
    const textParts = parts
      .filter((p) => (p.type === 'text' || p.type === 'reasoning') && p.text)
      .map((p) => p.text!);

    return textParts.join('\n').trim();
  }

  /**
   * Parse an OpenCode session into our session model.
   */
  private async parseSession(
    sessionData: OpenCodeSession,
    workDir: string,
  ): Promise<Session | null> {
    const messagesDir = join(this.getStorageDir(), 'message', sessionData.id);
    const messageFiles = await this.listJSONFiles(messagesDir);

    if (messageFiles.length === 0) {
      return null;
    }

    // Read all message JSON files
    const rawMessages: OpenCodeMessage[] = [];
    for (const file of messageFiles) {
      const msg = await this.readJSON<OpenCodeMessage>(file);
      if (msg) {
        rawMessages.push(msg);
      }
    }

    // Filter to user/assistant roles and sort by creation time
    const filtered = rawMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .sort((a, b) => (a.time?.created || 0) - (b.time?.created || 0));

    // Build Message objects by reading parts for each message
    const messages: Message[] = [];
    for (const msg of filtered) {
      const content = await this.readMessageParts(msg.id);
      if (!content) {
        continue;
      }

      const timestamp = msg.time?.created
        ? new Date(msg.time.created)
        : new Date();

      messages.push({
        role: msg.role as 'user' | 'assistant',
        content,
        timestamp,
        agentType: this.agentType,
        sessionId: sessionData.id,
        workDir,
      });
    }

    if (messages.length === 0) {
      return null;
    }

    const sessionTimestamp = sessionData.time?.created
      ? new Date(sessionData.time.created)
      : messages[0].timestamp;

    return {
      sessionId: sessionData.id,
      agentType: this.agentType,
      workDir,
      timestamp: sessionTimestamp,
      messages,
    };
  }

  /**
   * Find all OpenCode sessions.
   */
  async findSessions(workDirFilter?: string): Promise<Session[]> {
    const sessions: Session[] = [];

    try {
      const projectMap = await this.buildProjectMap();
      const sessionBaseDir = join(this.getStorageDir(), 'session');
      const projectDirs = await this.listSubdirs(sessionBaseDir);

      for (const projectDir of projectDirs) {
        const projectHash = projectDir.split('/').pop() || '';
        const worktree = projectMap.get(projectHash) || 'unknown';

        if (workDirFilter && !worktree.includes(workDirFilter)) {
          continue;
        }

        const sessionFiles = await this.listJSONFiles(projectDir);

        for (const file of sessionFiles) {
          const sessionData = await this.readJSON<OpenCodeSession>(file);
          if (!sessionData?.id) {
            continue;
          }

          const session = await this.parseSession(sessionData, worktree);
          if (session && session.messages.length > 0) {
            sessions.push(session);
          }
        }
      }
    } catch (error) {
      console.error('Error reading OpenCode sessions:', error);
    }

    return sessions;
  }

  /**
   * Read a specific OpenCode session by ID.
   */
  async readSession(sessionId: string): Promise<Session | null> {
    try {
      const projectMap = await this.buildProjectMap();
      const sessionBaseDir = join(this.getStorageDir(), 'session');
      const projectDirs = await this.listSubdirs(sessionBaseDir);

      for (const projectDir of projectDirs) {
        const projectHash = projectDir.split('/').pop() || '';
        const worktree = projectMap.get(projectHash) || 'unknown';

        const sessionFiles = await this.listJSONFiles(projectDir);

        for (const file of sessionFiles) {
          const sessionData = await this.readJSON<OpenCodeSession>(file);
          if (sessionData?.id === sessionId) {
            return await this.parseSession(sessionData, worktree);
          }
        }
      }
    } catch {
      return null;
    }

    return null;
  }
}
