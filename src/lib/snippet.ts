/**
 * Snippet extraction utilities for intelligent content truncation
 * Prevents context window exhaustion by extracting contextual excerpts around matches
 */

import type { SnippetConfig, TruncationMetadata, MatchPosition } from '../types.js';

/**
 * Default configuration for snippet extraction
 */
export const DEFAULT_SNIPPET_CONFIG: SnippetConfig = {
  mode: 'snippet',
  snippetSize: 200,
  maxContentLength: 500,
  contextWindow: 4096
};

/**
 * Characters per token approximation (1 token ≈ 4 characters for English text)
 */
const CHARS_PER_TOKEN = 4;

/**
 * Maximum distance to search for word boundaries (prevents infinite loops)
 */
const MAX_WORD_BOUNDARY_SEARCH = 20;

/**
 * Estimate token count from text length
 * @param text - Text to estimate
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Find the nearest word boundary before a position
 * @param content - Full content string
 * @param position - Starting position
 * @param direction - 'backward' or 'forward'
 * @returns Position of word boundary
 */
export function findWordBoundary(
  content: string,
  position: number,
  direction: 'backward' | 'forward' = 'backward'
): number {
  if (position <= 0) return 0;
  if (position >= content.length) return content.length;

  const searchDistance = Math.min(MAX_WORD_BOUNDARY_SEARCH, 
    direction === 'backward' ? position : content.length - position);

  if (direction === 'backward') {
    // Search backward for a word boundary (whitespace or punctuation)
    for (let i = 0; i < searchDistance; i++) {
      const char = content[position - i];
      if (isWordBoundary(char)) {
        return position - i;
      }
    }
    return position;
  } else {
    // Search forward for a word boundary
    for (let i = 0; i < searchDistance; i++) {
      const char = content[position + i];
      if (isWordBoundary(char)) {
        return position + i;
      }
    }
    return position;
  }
}

/**
 * Check if a character is a word boundary
 */
function isWordBoundary(char: string): boolean {
  return /[\s\n\r\t.,;:!?()[\]{}'"\/\-]/.test(char);
}

/**
 * Extract a snippet around a single match position
 * @param content - Full content string
 * @param matchStart - Start position of match
 * @param matchEnd - End position of match
 * @param snippetSize - Characters to include before and after match
 * @returns Extracted snippet and metadata
 */
export function extractSnippet(
  content: string,
  matchStart: number,
  matchEnd: number,
  snippetSize: number = 200
): { snippet: string; metadata: TruncationMetadata } {
  // Handle edge cases
  if (!content || content.length === 0) {
    return {
      snippet: '',
      metadata: {
        content_truncated: false,
        original_length: 0,
        snippet_start: 0,
        snippet_end: 0,
        truncation_type: 'none'
      }
    };
  }

  const originalLength = content.length;
  
  // If content is smaller than snippet size, return full content
  if (originalLength <= snippetSize * 2 + (matchEnd - matchStart)) {
    return {
      snippet: content,
      metadata: {
        content_truncated: false,
        original_length: originalLength,
        snippet_start: 0,
        snippet_end: originalLength,
        truncation_type: 'none'
      }
    };
  }

  // Calculate initial snippet boundaries
  let snippetStart = Math.max(0, matchStart - snippetSize);
  let snippetEnd = Math.min(originalLength, matchEnd + snippetSize);

  // Expand to word boundaries
  snippetStart = findWordBoundary(content, snippetStart, 'backward');
  snippetEnd = findWordBoundary(content, snippetEnd, 'forward');

  // Extract the snippet
  const snippet = content.substring(snippetStart, snippetEnd);

  // Build metadata
  const metadata: TruncationMetadata = {
    content_truncated: true,
    original_length: originalLength,
    snippet_start: snippetStart,
    snippet_end: snippetEnd,
    truncation_type: 'snippet'
  };

  return { snippet, metadata };
}

/**
 * Sort ranges by start position
 */
function sortRanges(ranges: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
  return [...ranges].sort((a, b) => a.start - b.start);
}

/**
 * Merge overlapping ranges into consolidated ranges
 * @param ranges - Array of start/end ranges
 * @returns Consolidated non-overlapping ranges
 */
export function mergeOverlappingRanges(
  ranges: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> {
  if (ranges.length <= 1) return ranges;

  const sorted = sortRanges(ranges);
  const merged: Array<{ start: number; end: number }> = [];
  
  let current = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    
    // Check if ranges overlap or are adjacent (within 10 chars)
    if (next.start <= current.end + 10) {
      // Merge ranges
      current.end = Math.max(current.end, next.end);
    } else {
      merged.push(current);
      current = next;
    }
  }
  
  merged.push(current);
  return merged;
}

/**
 * Extract snippets for multiple matches in the same content
 * Merges overlapping snippets and separates distant ones with [...]
 * @param content - Full content string
 * @param matches - Array of match positions
 * @param snippetSize - Characters to include around each match
 * @returns Combined snippet and metadata
 */
export function extractMultiMatchSnippet(
  content: string,
  matches: Array<{ start: number; end: number }>,
  snippetSize: number = 200
): { snippet: string; metadata: TruncationMetadata; matchPositions: Array<{ start: number; end: number }> } {
  // Handle edge cases
  if (!content || content.length === 0 || matches.length === 0) {
    return {
      snippet: content || '',
      metadata: {
        content_truncated: false,
        original_length: content?.length || 0,
        snippet_start: 0,
        snippet_end: content?.length || 0,
        truncation_type: 'none'
      },
      matchPositions: []
    };
  }

  const originalLength = content.length;

  // If content is small enough, return it all
  if (originalLength <= snippetSize * 3) {
    return {
      snippet: content,
      metadata: {
        content_truncated: false,
        original_length: originalLength,
        snippet_start: 0,
        snippet_end: originalLength,
        truncation_type: 'none'
      },
      matchPositions: matches
    };
  }

  // Calculate snippet ranges for each match
  const snippetRanges = matches.map(match => ({
    start: Math.max(0, match.start - snippetSize),
    end: Math.min(originalLength, match.end + snippetSize)
  }));

  // Merge overlapping ranges
  const mergedRanges = mergeOverlappingRanges(snippetRanges);

  // Build combined snippet
  const parts: string[] = [];
  let totalSnippetStart = -1;
  let totalSnippetEnd = 0;

  for (let i = 0; i < mergedRanges.length; i++) {
    const range = mergedRanges[i];
    
    // Track total coverage
    if (totalSnippetStart === -1) totalSnippetStart = range.start;
    totalSnippetEnd = range.end;

    // Add separator between non-adjacent ranges
    if (i > 0 && range.start > mergedRanges[i - 1].end + 10) {
      parts.push(' [...] ');
    }

    // Expand to word boundaries
    const snippetStart = findWordBoundary(content, range.start, 'backward');
    const snippetEnd = findWordBoundary(content, range.end, 'forward');

    // Add ellipsis prefix if not at start
    const prefix = snippetStart > 0 && i === 0 ? '...' : '';
    const suffix = snippetEnd < originalLength && i === mergedRanges.length - 1 ? '...' : '';

    const snippetPart = content.substring(snippetStart, snippetEnd);
    parts.push(prefix + snippetPart + suffix);
  }

  const combinedSnippet = parts.join('');

  // Calculate adjusted match positions in the combined snippet
  const adjustedMatchPositions: Array<{ start: number; end: number }> = [];
  let currentOffset = 0;

  for (const match of matches) {
    // Find which merged range contains this match
    for (const range of mergedRanges) {
      if (match.start >= range.start && match.end <= range.end) {
        // Calculate position in the combined snippet
        const rangeStart = findWordBoundary(content, range.start, 'backward');
        const prefix = rangeStart > 0 && mergedRanges.indexOf(range) === 0 ? 3 : 0; // Length of "..."
        const adjustedStart = currentOffset + (match.start - rangeStart) + prefix;
        const adjustedEnd = adjustedStart + (match.end - match.start);
        adjustedMatchPositions.push({ start: adjustedStart, end: adjustedEnd });
        break;
      }
    }
    // Add offset for next range (simplified - assumes merged ranges are in order)
    if (mergedRanges.length > 1) {
      currentOffset += combinedSnippet.length / mergedRanges.length + 7; // 7 for " [...] "
    }
  }

  const metadata: TruncationMetadata = {
    content_truncated: true,
    original_length: originalLength,
    snippet_start: totalSnippetStart,
    snippet_end: totalSnippetEnd,
    truncation_type: mergedRanges.length > 1 ? 'snippet' : 'snippet'
  };

  return {
    snippet: combinedSnippet,
    metadata,
    matchPositions: adjustedMatchPositions.length > 0 ? adjustedMatchPositions : matches
  };
}

/**
 * Apply a maximum content length limit (CASS --max-content-length pattern)
 * @param content - Content to limit
 * @param maxLength - Maximum character length
 * @returns Limited content and metadata
 */
export function applyContentLimit(
  content: string,
  maxLength: number
): { content: string; metadata: TruncationMetadata } {
  if (!content || content.length <= maxLength) {
    return {
      content,
      metadata: {
        content_truncated: false,
        original_length: content?.length || 0,
        snippet_start: 0,
        snippet_end: content?.length || 0,
        truncation_type: 'none'
      }
    };
  }

  // Find word boundary for clean cut
  const cutPoint = findWordBoundary(content, maxLength, 'backward');
  const limitedContent = content.substring(0, cutPoint) + '...';

  return {
    content: limitedContent,
    metadata: {
      content_truncated: true,
      original_length: content.length,
      snippet_start: 0,
      snippet_end: cutPoint,
      truncation_type: 'length'
    }
  };
}

/**
 * Generate a session context summary
 * @param totalMessages - Total number of messages in session
 * @param messageIndex - Index of current message (0-based)
 * @param role - Message role
 * @returns Session summary string
 */
export function generateSessionSummary(
  totalMessages: number,
  messageIndex: number,
  role: string
): string {
  const percentage = Math.round((messageIndex / totalMessages) * 100);
  return `${role} message ${messageIndex + 1}/${totalMessages} (${percentage}% through session)`;
}

/**
 * Calculate percentage of content shown in snippet
 * @param metadata - Truncation metadata
 * @returns Percentage as integer (0-100)
 */
export function calculateShownPercentage(metadata: TruncationMetadata): number {
  if (!metadata.content_truncated || metadata.original_length === 0) {
    return 100;
  }
  
  const shownLength = metadata.snippet_end - metadata.snippet_start;
  return Math.round((shownLength / metadata.original_length) * 100);
}

/**
 * Format truncation info for display
 * @param metadata - Truncation metadata
 * @returns Human-readable truncation description
 */
export function formatTruncationInfo(metadata: TruncationMetadata): string {
  if (!metadata.content_truncated) {
    return '';
  }

  const percentage = calculateShownPercentage(metadata);
  const typeLabel = metadata.truncation_type === 'snippet' ? 'snippet' : 
                    metadata.truncation_type === 'length' ? 'max length' : 'token limit';
  
  return `[Truncated: showing ${percentage}% of ${metadata.original_length} chars, type: ${typeLabel}]`;
}

/**
 * Enforce token budget across multiple matches
 * Stops adding matches when budget would be exceeded
 * @param matches - Array of matches with content
 * @param maxTokens - Maximum token budget
 * @returns Filtered matches and budget status
 */
export function enforceTokenBudget<T extends { message: { content: string } }>(
  matches: T[],
  maxTokens: number
): { matches: T[]; budgetExceeded: boolean; estimatedTokens: number } {
  let currentTokens = 0;
  const result: T[] = [];
  let budgetExceeded = false;

  for (const match of matches) {
    const matchTokens = estimateTokens(match.message.content);
    
    // Add overhead for metadata (approximate)
    const overheadTokens = 10;
    
    if (currentTokens + matchTokens + overheadTokens > maxTokens) {
      budgetExceeded = true;
      break;
    }
    
    currentTokens += matchTokens + overheadTokens;
    result.push(match);
  }

  return {
    matches: result,
    budgetExceeded,
    estimatedTokens: currentTokens
  };
}
