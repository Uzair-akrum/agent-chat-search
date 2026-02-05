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

  /** Cache for decoded paths to avoid repeated filesystem lookups */
  private pathCache = new Map<string, string>();

  /**
   * Decode Claude Code project path encoding with filesystem validation.
   * Handles directories with hyphens (e.g. "-home-user-my-project" -> "/home/user/my-project")
   * by checking which decoded path actually exists on disk.
   */
  private async decodeProjectPath(encoded: string): Promise<string> {
    if (!encoded.startsWith('-')) {
      return encoded;
    }

    if (this.pathCache.has(encoded)) {
      return this.pathCache.get(encoded)!;
    }

    const segments = encoded.slice(1).split('-');

    // Fast path: naive decode (all hyphens -> slashes) — works when no dir has hyphens
    const naive = '/' + segments.join('/');
    try {
      await fs.access(naive);
      this.pathCache.set(encoded, naive);
      return naive;
    } catch {
      // Not a real path, try smart resolution
    }

    // Smart resolution: greedy shortest-first with backtracking
    const resolved = await this.resolveSegments(segments, 0, '');
    const result = resolved || naive;
    this.pathCache.set(encoded, result);
    return result;
  }

  /**
   * Recursively resolve path segments by checking the filesystem.
   * Tries shortest component first (single segment), backtracks if the
   * full resulting path doesn't exist.
   */
  private async resolveSegments(
    segments: string[],
    start: number,
    basePath: string,
  ): Promise<string | null> {
    if (start >= segments.length) return basePath;

    for (let end = start + 1; end <= segments.length; end++) {
      const component = segments.slice(start, end).join('-');
      const candidate = basePath + '/' + component;

      if (end === segments.length) {
        // All remaining segments consumed — check if final path exists
        try {
          await fs.access(candidate);
          return candidate;
        } catch {
          return candidate; // best-effort for this branch
        }
      }

      try {
        const stat = await fs.stat(candidate);
        if (stat.isDirectory()) {
          const result = await this.resolveSegments(segments, end, candidate);
          if (result) {
            try {
              await fs.access(result);
              return result; // full path validated
            } catch {
              continue; // backtrack: this branch didn't lead to a valid full path
            }
          }
        }
      } catch {
        continue; // component doesn't exist, try longer grouping
      }
    }

    return null;
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

        const workDir = await this.decodeProjectPath(dir.name);

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
              const session = await this.readSession(sessionId, {
                projectDir: dir.name,
                workDir,
              });

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
  async readSession(
    sessionId: string,
    additionalContext?: { projectDir: string; workDir: string },
  ): Promise<Session | null> {
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
              workDir: await this.decodeProjectPath(dir.name),
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

      const sessionPath = join(
        projectsDir,
        additionalContext.projectDir,
        `${sessionId}.jsonl`,
      );
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
        const timestamp = line.timestamp
          ? new Date(line.timestamp)
          : sessionTimestamp;

        messages.push({
          role,
          content,
          timestamp,
          agentType: this.agentType,
          sessionId,
          workDir: additionalContext.workDir,
        });
      }

      return {
        sessionId,
        agentType: this.agentType,
        workDir: additionalContext.workDir,
        timestamp: sessionTimestamp,
        messages,
      };
    } catch (error) {
      // Session not found or can't be read
      return null;
    }
  }
}
