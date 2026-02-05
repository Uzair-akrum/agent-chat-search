/**
 * Kimi chat history reader
 * Reads from ~/.kimi/sessions/
 */

import { BaseAgentReader } from './base.js';
import type { AgentType, Session, Message } from '../types.js';
import { readJSONL } from '../lib/jsonl.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

interface KimiWorkDir {
  path: string;
  kaos: string;
  last_session_id: string | null;
}

interface KimiMetadata {
  work_dirs: KimiWorkDir[];
}

export class KimiReader extends BaseAgentReader {
  agentType: AgentType = 'kimi';
  private metadata: KimiMetadata | null = null;
  private pathToHashMap: Map<string, string> = new Map();

  getSessionsDir(): string {
    const kimiShareDir = process.env.KIMI_SHARE_DIR;
    if (kimiShareDir) {
      return join(kimiShareDir, 'sessions');
    }
    return join(homedir(), '.kimi', 'sessions');
  }

  /**
   * Get the metadata file path
   */
  private getMetadataPath(): string {
    const kimiShareDir = process.env.KIMI_SHARE_DIR;
    if (kimiShareDir) {
      return join(kimiShareDir, 'kimi.json');
    }
    return join(homedir(), '.kimi', 'kimi.json');
  }

  /**
   * Load Kimi metadata file
   */
  private async loadMetadata(): Promise<void> {
    if (this.metadata) return;

    try {
      const metadataPath = this.getMetadataPath();
      const content = await fs.readFile(metadataPath, 'utf-8');
      this.metadata = JSON.parse(content);

      // Build path to hash mapping
      if (this.metadata) {
        for (const workDir of this.metadata.work_dirs) {
          const hash = this.hashWorkDir(workDir.path, workDir.kaos);
          this.pathToHashMap.set(workDir.path, hash);
        }
      }
    } catch (error) {
      // Metadata file doesn't exist or can't be read
      this.metadata = { work_dirs: [] };
    }
  }

  /**
   * Hash work directory path using MD5
   * This matches Kimi's hashing algorithm
   */
  private hashWorkDir(path: string, kaos: string = 'local'): string {
    // Kimi uses kaos prefix for remote instances
    const key = kaos === 'local' ? path : `${kaos}:${path}`;
    return createHash('md5').update(key).digest('hex');
  }

  /**
   * Resolve work directory from hash
   */
  private async resolveWorkDir(hash: string): Promise<string> {
    await this.loadMetadata();

    if (!this.metadata) return hash;

    // Find matching work directory
    for (const workDir of this.metadata.work_dirs) {
      const computedHash = this.hashWorkDir(workDir.path, workDir.kaos);
      if (computedHash === hash) {
        return workDir.path;
      }
    }

    // Return hash if no match found
    return hash;
  }

  /**
   * Find all Kimi sessions
   */
  async findSessions(workDirFilter?: string): Promise<Session[]> {
    await this.loadMetadata();

    const sessionsDir = this.getSessionsDir();
    const sessions: Session[] = [];

    try {
      // Check if directory exists
      try {
        await fs.access(sessionsDir);
      } catch {
        // Directory doesn't exist, return empty array
        return sessions;
      }

      // Read all work directory hashes
      const workDirHashes = await fs.readdir(sessionsDir, {
        withFileTypes: true,
      });

      for (const hashDir of workDirHashes) {
        if (!hashDir.isDirectory()) continue;

        const workDirHash = hashDir.name;
        const workDir = await this.resolveWorkDir(workDirHash);

        // Apply work directory filter if specified
        if (workDirFilter && !workDir.includes(workDirFilter)) {
          continue;
        }

        const workDirPath = join(sessionsDir, workDirHash);

        try {
          // Read all session IDs in this work directory
          const sessionIds = await fs.readdir(workDirPath, {
            withFileTypes: true,
          });

          for (const sessionDir of sessionIds) {
            if (!sessionDir.isDirectory()) continue;

            const sessionId = sessionDir.name;
            const session = await this.readSession(sessionId, {
              workDirHash,
              workDir,
            });

            if (session && session.messages.length > 0) {
              sessions.push(session);
            }
          }
        } catch (error) {
          // Skip directories that can't be read
          continue;
        }
      }
    } catch (error) {
      console.error('Error reading Kimi sessions:', error);
    }

    return sessions;
  }

  /**
   * Read a specific Kimi session
   */
  async readSession(
    sessionId: string,
    additionalContext?: { workDirHash: string; workDir: string },
  ): Promise<Session | null> {
    await this.loadMetadata();

    try {
      const sessionsDir = this.getSessionsDir();

      // If no additional context provided, we need to find the session
      if (!additionalContext) {
        const workDirHashes = await fs.readdir(sessionsDir, {
          withFileTypes: true,
        });

        for (const hashDir of workDirHashes) {
          if (!hashDir.isDirectory()) continue;

          const workDirHash = hashDir.name;
          const sessionPath = join(
            sessionsDir,
            workDirHash,
            sessionId,
            'context.jsonl',
          );

          try {
            await fs.access(sessionPath);
            const workDir = await this.resolveWorkDir(workDirHash);
            additionalContext = { workDirHash, workDir };
            break;
          } catch {
            continue;
          }
        }

        if (!additionalContext) {
          return null;
        }
      }

      const contextPath = join(
        sessionsDir,
        additionalContext.workDirHash,
        sessionId,
        'context.jsonl',
      );
      const lines = await readJSONL(contextPath);

      if (lines.length === 0) {
        return null;
      }

      // Get session time range from file stats for interpolation
      let sessionStart = new Date();
      let sessionEnd = new Date();
      try {
        const stats = await fs.stat(contextPath);
        sessionStart =
          stats.birthtime.getTime() > 0 ? stats.birthtime : stats.mtime;
        sessionEnd = stats.mtime;
      } catch {
        // Use current time if stat fails
      }

      // First pass: collect relevant lines and check for timestamp fields
      const relevantLines: Array<{
        role: string;
        content: any;
        timestamp?: Date;
      }> = [];

      for (const line of lines) {
        if (line.role === '_checkpoint') continue;
        if (!line.content) continue;
        const role = line.role;
        if (role !== 'user' && role !== 'assistant') continue;

        // Check for per-message timestamp fields (various possible field names)
        let msgTimestamp: Date | undefined;
        if (line.timestamp) {
          msgTimestamp = new Date(line.timestamp);
        } else if (line.created_at) {
          msgTimestamp = new Date(line.created_at);
        } else if (line.ts) {
          msgTimestamp = new Date(
            typeof line.ts === 'number' ? line.ts * 1000 : line.ts,
          );
        }

        relevantLines.push({
          role,
          content: line.content,
          timestamp: msgTimestamp,
        });
      }

      // Build messages with best-available timestamps
      const hasPerMessageTimestamps = relevantLines.some((l) => l.timestamp);
      const messages: Message[] = [];
      const totalLines = relevantLines.length;

      for (let idx = 0; idx < totalLines; idx++) {
        const line = relevantLines[idx];
        const content = this.extractTextContent(line.content);

        let timestamp: Date;
        if (line.timestamp && !isNaN(line.timestamp.getTime())) {
          // Use actual per-message timestamp if available
          timestamp = line.timestamp;
        } else if (!hasPerMessageTimestamps && totalLines > 1) {
          // Interpolate between file creation and modification time
          const fraction = idx / (totalLines - 1);
          timestamp = new Date(
            sessionStart.getTime() +
              fraction * (sessionEnd.getTime() - sessionStart.getTime()),
          );
        } else {
          timestamp = sessionEnd;
        }

        messages.push({
          role: line.role as 'user' | 'assistant',
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
        timestamp: sessionStart,
        messages,
      };
    } catch (error) {
      // Session not found or can't be read
      return null;
    }
  }
}
