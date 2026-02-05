/**
 * Base abstract class for agent readers
 */

import type { AgentType, Session, Message, SearchMatch, MessageRole, SnippetConfig, TruncationMetadata } from '../types.js';
import { extractTextContent } from '../lib/content.js';
import { 
  extractMultiMatchSnippet, 
  applyContentLimit, 
  generateSessionSummary,
  DEFAULT_SNIPPET_CONFIG 
} from '../lib/snippet.js';

export abstract class BaseAgentReader {
  abstract agentType: AgentType;

  /**
   * Return the base directory where sessions are stored
   */
  abstract getSessionsDir(): string;

  /**
   * Discover all available sessions
   * @param workDirFilter Optional filter to only include sessions from specific work directory
   */
  abstract findSessions(workDirFilter?: string): Promise<Session[]>;

  /**
   * Read a specific session by ID
   */
  abstract readSession(sessionId: string, additionalContext?: any): Promise<Session | null>;

  /**
   * Search through all messages matching the query
   * @param query Search query (regex pattern)
   * @param role Optional filter by message role
   * @param workDirFilter Optional filter by work directory
   * @param contextLines Number of context lines before/after match
   * @param snippetConfig Configuration for snippet extraction
   */
  async searchMessages(
    query: string,
    role?: MessageRole,
    workDirFilter?: string,
    contextLines: number = 0,
    snippetConfig?: SnippetConfig
  ): Promise<SearchMatch[]> {
    const sessions = await this.findSessions(workDirFilter);
    const matches: SearchMatch[] = [];

    // Merge with default config
    const config = { ...DEFAULT_SNIPPET_CONFIG, ...snippetConfig };

    // Create regex from query - use global flag to find all matches
    const flags = 'gi'; // Global, case insensitive
    const regex = new RegExp(query, flags);

    for (const session of sessions) {
      const messages = session.messages;

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];

        // Apply role filter if specified
        if (role && message.role !== role) {
          continue;
        }

        // Find all matches in the message content
        const content = message.content;
        const matchPositions: Array<{ start: number; end: number }> = [];
        let regexMatch: RegExpExecArray | null;

        // Reset regex lastIndex for each message
        regex.lastIndex = 0;

        // Find all match positions
        while ((regexMatch = regex.exec(content)) !== null) {
          matchPositions.push({
            start: regexMatch.index,
            end: regexMatch.index + regexMatch[0].length
          });
          
          // Prevent infinite loop on zero-length matches
          if (regexMatch[0].length === 0) {
            regex.lastIndex++;
          }
        }

        // If we found matches, process them
        if (matchPositions.length > 0) {
          // Extract context before and after
          const contextBefore: Message[] = [];
          const contextAfter: Message[] = [];

          if (contextLines > 0) {
            // Get context before
            for (let j = Math.max(0, i - contextLines); j < i; j++) {
              contextBefore.push(messages[j]);
            }

            // Get context after
            for (let j = i + 1; j < Math.min(messages.length, i + 1 + contextLines); j++) {
              contextAfter.push(messages[j]);
            }
          }

          // Process content based on output mode
          let processedMessage = message;
          let truncation: TruncationMetadata | undefined;
          let finalMatchPositions = matchPositions;

          if (config.mode === 'snippet' && content.length > config.snippetSize * 2) {
            // Extract snippet around matches
            const { snippet, metadata, matchPositions: adjustedPositions } = extractMultiMatchSnippet(
              content,
              matchPositions,
              config.snippetSize
            );

            // Create modified message with snippet content
            processedMessage = {
              ...message,
              content: snippet
            };
            truncation = metadata;
            finalMatchPositions = adjustedPositions;
          } else if (config.mode === 'full' && config.maxContentLength > 0 && content.length > config.maxContentLength) {
            // Apply max content length limit even in full mode
            const { content: limitedContent, metadata } = applyContentLimit(
              content,
              config.maxContentLength
            );

            processedMessage = {
              ...message,
              content: limitedContent
            };
            truncation = metadata;
          }

          // Generate session snippet info
          const sessionSnippet = {
            totalMessages: messages.length,
            messageIndex: i,
            sessionSummary: generateSessionSummary(messages.length, i, message.role)
          };

          // Get the first matched text for backward compatibility
          const firstMatch = matchPositions[0];
          const matchedText = content.substring(firstMatch.start, firstMatch.end);

          matches.push({
            message: processedMessage,
            matchedText,
            contextBefore,
            contextAfter,
            matchPositions: finalMatchPositions,
            truncation,
            sessionSnippet
          });
        }
      }
    }

    return matches;
  }

  /**
   * Extract text content from various content formats
   * This is a helper method that delegates to the content utility
   */
  protected extractTextContent(content: any): string {
    return extractTextContent(content);
  }
}
