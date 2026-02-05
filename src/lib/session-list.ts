/**
 * Session listing utilities
 * List all sessions with their first message (topic preview)
 */

import type { Session, AgentType } from '../types.js';
import { ClaudeReader, KimiReader, CodexReader } from '../readers/index.js';

export interface SessionInfo {
  sessionId: string;
  agentType: AgentType;
  workDir: string;
  timestamp: Date;
  firstMessage?: string;
  messageCount: number;
}

export interface SessionListResult {
  sessions: SessionInfo[];
  totalSessions: number;
  agents: AgentType[];
}

/**
 * Get a preview of the first user message (session topic)
 */
function getSessionTopic(session: Session): string | undefined {
  // Find first user message (usually contains the topic/request)
  const firstUserMessage = session.messages.find((m) => m.role === 'user');
  if (firstUserMessage) {
    // Truncate to first 100 chars for preview
    const content = firstUserMessage.content.replace(/\s+/g, ' ').trim();
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }

  // Fallback to first message of any role
  if (session.messages.length > 0) {
    const content = session.messages[0].content.replace(/\s+/g, ' ').trim();
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }

  return undefined;
}

/**
 * List all sessions across specified agents
 */
export async function listSessions(
  agents: AgentType[],
  workDirFilter?: string,
  limit?: number,
): Promise<SessionListResult> {
  const readers = [];

  // Instantiate requested readers
  if (agents.includes('claude')) {
    readers.push(new ClaudeReader());
  }

  if (agents.includes('kimi')) {
    readers.push(new KimiReader());
  }

  if (agents.includes('codex')) {
    readers.push(new CodexReader());
  }

  // Collect all sessions
  let allSessions: SessionInfo[] = [];

  for (const reader of readers) {
    const sessions = await reader.findSessions(workDirFilter);

    for (const session of sessions) {
      allSessions.push({
        sessionId: session.sessionId,
        agentType: session.agentType,
        workDir: session.workDir,
        timestamp: session.timestamp,
        firstMessage: getSessionTopic(session),
        messageCount: session.messages.length,
      });
    }
  }

  // Sort by timestamp (most recent first)
  allSessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Apply limit
  const totalBeforeLimit = allSessions.length;
  if (limit && limit > 0) {
    allSessions = allSessions.slice(0, limit);
  }

  return {
    sessions: allSessions,
    totalSessions: totalBeforeLimit,
    agents,
  };
}

/**
 * Format session list for human-readable output
 */
export function formatSessionList(result: SessionListResult): string {
  const lines: string[] = [];

  lines.push(
    `Found ${result.totalSessions} sessions across ${result.agents.length} agent(s):\n`,
  );

  if (result.sessions.length === 0) {
    lines.push('No sessions found.');
    return lines.join('\n');
  }

  result.sessions.forEach((session, index) => {
    lines.push(`--- Session ${index + 1} [${session.agentType}] ---`);
    lines.push(`ID: ${session.sessionId}`);
    lines.push(`Work Dir: ${session.workDir}`);
    lines.push(`Agent: ${capitalizeAgentType(session.agentType)}`);
    lines.push(`Time: ${session.timestamp.toISOString()}`);
    lines.push(`Messages: ${session.messageCount}`);

    if (session.firstMessage) {
      lines.push(`Topic: ${session.firstMessage}`);
    }

    lines.push('');
  });

  if (result.sessions.length < result.totalSessions) {
    lines.push(
      `... and ${result.totalSessions - result.sessions.length} more sessions`,
    );
  }

  return lines.join('\n');
}

/**
 * Format session list as JSON
 */
export function formatSessionListJSON(result: SessionListResult): string {
  const serializable = {
    ...result,
    sessions: result.sessions.map((s) => ({
      ...s,
      timestamp: s.timestamp.toISOString(),
    })),
  };

  return JSON.stringify(serializable, null, 2);
}

function capitalizeAgentType(agentType: string): string {
  switch (agentType) {
    case 'claude':
      return 'Claude Code';
    case 'kimi':
      return 'Kimi';
    case 'codex':
      return 'Codex';
    default:
      return agentType.charAt(0).toUpperCase() + agentType.slice(1);
  }
}
