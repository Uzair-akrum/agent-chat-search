/**
 * Core type definitions for agent chat search
 */

export type AgentType = 'claude' | 'kimi' | 'codex' | 'opencode';

export type MessageRole = 'user' | 'assistant' | 'tool';

export type OutputMode = 'snippet' | 'full' | 'summary';

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: Date;
  agentType: AgentType;
  sessionId: string;
  workDir: string;
}

export interface Session {
  sessionId: string;
  agentType: AgentType;
  workDir: string;
  timestamp: Date;
  messages: Message[];
}

/**
 * Configuration for snippet extraction
 */
export interface SnippetConfig {
  mode: OutputMode;
  snippetSize: number;
  maxContentLength: number;
  contextWindow: number;
}

/**
 * Truncation metadata for transparency (CASS pattern)
 */
export interface TruncationMetadata {
  content_truncated: boolean;
  original_length: number;
  snippet_start: number;
  snippet_end: number;
  truncation_type: 'none' | 'snippet' | 'length' | 'token';
}

/**
 * Match position within content
 */
export interface MatchPosition {
  start: number;
  end: number;
}

/**
 * Session context information for a match
 */
export interface SessionSnippet {
  totalMessages: number;
  messageIndex: number;
  sessionSummary?: string;
}

export interface SearchMatch {
  message: Message;
  matchedText: string;
  contextBefore: Message[];
  contextAfter: Message[];
  lineNumber?: number;
  matchPositions?: MatchPosition[];
  truncation?: TruncationMetadata;
  sessionSnippet?: SessionSnippet;
}

export interface SearchOptions {
  query: string;
  agents: AgentType[];
  role?: MessageRole;
  contextLines?: number;
  workDirFilter?: string;
  limit?: number;
  caseInsensitive?: boolean;
  literal?: boolean;
  outputMode?: OutputMode;
  snippetSize?: number;
  maxContentLength?: number;
  maxTokens?: number;
  since?: Date;
  before?: Date;
}

export interface SearchResult {
  matches: SearchMatch[];
  totalMatches: number;
  searchedSessions: number;
  agents: AgentType[];
  estimatedTokens?: number;
  tokenBudgetExceeded?: boolean;
  truncatedCount?: number;
}
