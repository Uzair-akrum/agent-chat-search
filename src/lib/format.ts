/**
 * Output formatting utilities
 */

import type { SearchResult, SearchMatch, Message, TruncationMetadata } from '../types.js';
import { calculateShownPercentage, formatTruncationInfo } from './snippet.js';

/**
 * Format search results for human-readable output
 */
export function formatResults(result: SearchResult): string {
  const lines: string[] = [];

  // Header with token count
  let header = `Found ${result.totalMatches} matches across ${result.agents.length} agent(s) ` +
    `(searched ${result.searchedSessions} sessions)`;
  
  if (result.estimatedTokens !== undefined) {
    header += `\nEstimated tokens: ~${result.estimatedTokens}`;
  }
  
  lines.push(header + '\n');

  // Show warnings
  if (result.tokenBudgetExceeded) {
    lines.push('⚠ Token budget exceeded - showing partial results\n');
  }
  
  if (result.truncatedCount && result.truncatedCount > 0) {
    lines.push(`⚠ ${result.truncatedCount} additional matches not shown (hit result limit)\n`);
  }

  // Format each match
  result.matches.forEach((match, index) => {
    lines.push(`--- Match ${index + 1} [${match.message.agentType}] ---`);
    lines.push(`Session: ${match.message.sessionId}`);
    lines.push(`Work Dir: ${match.message.workDir}`);
    lines.push(`Agent: ${capitalizeAgentType(match.message.agentType)}`);
    lines.push(`Time: ${match.message.timestamp.toISOString()}`);
    
    // Show session position if available
    if (match.sessionSnippet) {
      const percentage = Math.round((match.sessionSnippet.messageIndex / match.sessionSnippet.totalMessages) * 100);
      lines.push(`Position: ${match.message.role} message ${match.sessionSnippet.messageIndex + 1}/${match.sessionSnippet.totalMessages} (${percentage}% through session)`);
    }
    
    lines.push('');

    // Context before
    if (match.contextBefore.length > 0) {
      lines.push('Context:');
      match.contextBefore.forEach(msg => {
        lines.push(formatContextMessage(msg));
      });
    }

    // Main match (highlighted)
    lines.push(formatMatchMessage(match));

    // Context after
    if (match.contextAfter.length > 0) {
      match.contextAfter.forEach(msg => {
        lines.push(formatContextMessage(msg));
      });
    }

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format a context message
 */
function formatContextMessage(message: Message): string {
  const truncatedContent = truncateContent(message.content, 150);
  return `    [${message.role}] ${truncatedContent}`;
}

/**
 * Format a matched message (with highlight marker and truncation info)
 */
function formatMatchMessage(match: SearchMatch): string {
  const message = match.message;
  let content = message.content;
  
  // Clean up whitespace but preserve snippet structure
  content = content.replace(/\s+/g, ' ').trim();
  
  let result = `>>> [${message.role}] ${content}`;
  
  // Add truncation info if present
  if (match.truncation?.content_truncated) {
    const truncationInfo = formatTruncationInfo(match.truncation);
    if (truncationInfo) {
      result += `\n    ${truncationInfo}`;
    }
  }
  
  return result;
}

/**
 * Truncate content to maximum length
 */
function truncateContent(content: string, maxLength: number): string {
  // Remove extra whitespace and newlines
  const cleaned = content.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.substring(0, maxLength) + '...';
}

/**
 * Capitalize agent type for display
 */
function capitalizeAgentType(agentType: string): string {
  switch (agentType) {
    case 'claude':
      return 'Claude Code';
    case 'kimi':
      return 'Kimi';
    default:
      return agentType.charAt(0).toUpperCase() + agentType.slice(1);
  }
}

/**
 * Format truncation metadata for JSON output (CASS pattern)
 */
function formatTruncationForJSON(truncation?: TruncationMetadata): Record<string, any> | undefined {
  if (!truncation) return undefined;

  return {
    _truncated: truncation.content_truncated,
    _original_length: truncation.original_length,
    _truncation_type: truncation.truncation_type,
    snippet_start: truncation.snippet_start,
    snippet_end: truncation.snippet_end,
    shown_percentage: calculateShownPercentage(truncation)
  };
}

/**
 * Format search results as JSON
 */
export function formatResultsJSON(result: SearchResult): string {
  // Convert dates to ISO strings for JSON serialization
  const serializable = {
    ...result,
    matches: result.matches.map(match => {
      const baseMatch: Record<string, any> = {
        message: {
          ...match.message,
          timestamp: match.message.timestamp.toISOString()
        },
        matchedText: match.matchedText,
        contextBefore: match.contextBefore.map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toISOString()
        })),
        contextAfter: match.contextAfter.map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toISOString()
        }))
      };

      // Add optional fields if present
      if (match.matchPositions) {
        baseMatch.matchPositions = match.matchPositions;
      }

      if (match.truncation) {
        baseMatch.truncation = match.truncation;
        // Also add CASS-style fields for convenience
        Object.assign(baseMatch, formatTruncationForJSON(match.truncation));
      }

      if (match.sessionSnippet) {
        baseMatch.sessionSnippet = match.sessionSnippet;
      }

      if (match.lineNumber) {
        baseMatch.lineNumber = match.lineNumber;
      }

      return baseMatch;
    })
  };

  return JSON.stringify(serializable, null, 2);
}
