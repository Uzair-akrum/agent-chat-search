/**
 * Claude Code chat history reader
 * Reads from ~/.claude/projects/
 */

import { BaseAgentReader } from './base.js';
import type { AgentType, Session, Message } from '../types.js';
import { readJSONL } from '../lib/jsonl.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export class ClaudeReader extends BaseAgentReader {
  agentType: AgentType = 'claude';

  getSessionsDir(): string {
    return join(homedir(), '.claude', 'projects');
  }

  /**
   * Decode Claude Code project path encoding
   * Example: "-home-user-project" -> "/home/user/project"
   */
  private decodeProjectPath(encoded: string): string {
    if (!encoded.startsWith('-')) {
      return encoded;
    }
    return '/' + encoded.slice(1).replace(/-/g, '/');
  }

  /**
   * Find all Claude Code sessions
   */
  async findSessions(workDirFilter?: string): Promise<Session[]> {
    const projectsDir = this.getSessionsDir();
    const sessions: Session[] = [];

    try {
      // Check if directory exists
      try {
        await fs.access(projectsDir);
      } catch {
        // Directory doesn't exist, return empty array
        return sessions;
      }

      const dirs = await fs.readdir(projectsDir, { withFileTypes: true });

      for (const dir of dirs) {
        if (!dir.isDirectory()) continue;

        const workDir = this.decodeProjectPath(dir.name);

        // Apply work directory filter if specified
        if (workDirFilter && !workDir.includes(workDirFilter)) {
          continue;
        }

        const projectPath = join(projectsDir, dir.name);

        try {
          const files = await fs.readdir(projectPath);

          for (const file of files) {
            if (file.endsWith('.jsonl')) {
              const sessionId = file.replace('.jsonl', '');
              const session = await this.readSession(sessionId, { projectDir: dir.name, workDir });

              if (session && session.messages.length > 0) {
                sessions.push(session);
              }
            }
          }
        } catch (error) {
          // Skip directories that can't be read
          continue;
        }
      }
    } catch (error) {
      console.error('Error reading Claude Code sessions:', error);
    }

    return sessions;
  }

  /**
   * Read a specific Claude Code session
   */
  async readSession(sessionId: string, additionalContext?: { projectDir: string; workDir: string }): Promise<Session | null> {
    try {
      const projectsDir = this.getSessionsDir();

      // If no additional context provided, we need to find the session
      if (!additionalContext) {
        const dirs = await fs.readdir(projectsDir, { withFileTypes: true });

        for (const dir of dirs) {
          if (!dir.isDirectory()) continue;

          const sessionPath = join(projectsDir, dir.name, `${sessionId}.jsonl`);

          try {
            await fs.access(sessionPath);
            additionalContext = {
              projectDir: dir.name,
              workDir: this.decodeProjectPath(dir.name)
            };
            break;
          } catch {
            continue;
          }
        }

        if (!additionalContext) {
          return null;
        }
      }

      const sessionPath = join(projectsDir, additionalContext.projectDir, `${sessionId}.jsonl`);
      const lines = await readJSONL(sessionPath);

      if (lines.length === 0) {
        return null;
      }

      // Get session timestamp from first message
      let sessionTimestamp = new Date();
      if (lines[0].timestamp) {
        sessionTimestamp = new Date(lines[0].timestamp);
      }

      // Parse messages
      const messages: Message[] = [];

      for (const line of lines) {
        // Skip non-message entries (system messages, snapshots, etc.)
        if (!line.message || !line.message.role || !line.message.content) {
          continue;
        }

        const role = line.message.role;

        // Only include user and assistant messages
        if (role !== 'user' && role !== 'assistant') {
          continue;
        }

        const content = this.extractTextContent(line.message.content);
        const timestamp = line.timestamp ? new Date(line.timestamp) : sessionTimestamp;

        messages.push({
          role,
          content,
          timestamp,
          agentType: this.agentType,
          sessionId,
          workDir: additionalContext.workDir
        });
      }

      return {
        sessionId,
        agentType: this.agentType,
        workDir: additionalContext.workDir,
        timestamp: sessionTimestamp,
        messages
      };
    } catch (error) {
      // Session not found or can't be read
      return null;
    }
  }
}
