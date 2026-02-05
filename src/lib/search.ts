/**
 * Search logic utilities
 */

import type { SearchMatch, SearchResult, SearchOptions, SnippetConfig } from '../types.js';
import { ClaudeReader, KimiReader } from '../readers/index.js';
import { enforceTokenBudget, estimateTokens, DEFAULT_SNIPPET_CONFIG } from './snippet.js';

/**
 * Build SnippetConfig from SearchOptions
 */
function buildSnippetConfig(options: SearchOptions): SnippetConfig {
  return {
    mode: options.outputMode || DEFAULT_SNIPPET_CONFIG.mode,
    snippetSize: options.snippetSize || DEFAULT_SNIPPET_CONFIG.snippetSize,
    // Use 0 to mean unlimited, otherwise use provided value or default
    maxContentLength: options.maxContentLength === 0 ? 0 : (options.maxContentLength ?? DEFAULT_SNIPPET_CONFIG.maxContentLength),
    contextWindow: options.maxTokens ? options.maxTokens * 4 : DEFAULT_SNIPPET_CONFIG.contextWindow
  };
}

/**
 * Orchestrate search across multiple agents
 */
export async function searchAgents(options: SearchOptions): Promise<SearchResult> {
  const readers = [];

  // Instantiate requested readers
  if (options.agents.includes('claude')) {
    readers.push(new ClaudeReader());
  }

  if (options.agents.includes('kimi')) {
    readers.push(new KimiReader());
  }

  // Build snippet configuration
  const snippetConfig = buildSnippetConfig(options);

  // Execute searches in parallel with snippet config
  const searchPromises = readers.map(reader =>
    reader.searchMessages(
      options.query,
      options.role,
      options.workDirFilter,
      options.contextLines || 0,
      snippetConfig
    )
  );

  const results = await Promise.all(searchPromises);

  // Flatten and merge results
  let allMatches: SearchMatch[] = [];
  for (const matches of results) {
    allMatches = allMatches.concat(matches);
  }

  // Sort by timestamp (most recent first)
  allMatches.sort((a, b) => b.message.timestamp.getTime() - a.message.timestamp.getTime());

  // Apply token budget if specified
  let tokenBudgetExceeded = false;
  let estimatedTokens = 0;
  let truncatedCount = 0;

  if (options.maxTokens && options.maxTokens > 0) {
    const budgetResult = enforceTokenBudget(allMatches, options.maxTokens);
    allMatches = budgetResult.matches;
    tokenBudgetExceeded = budgetResult.budgetExceeded;
    estimatedTokens = budgetResult.estimatedTokens;
    truncatedCount = results.reduce((sum, r) => sum + r.length, 0) - allMatches.length;
  } else {
    // Calculate estimated tokens even without budget enforcement
    estimatedTokens = allMatches.reduce((sum, match) => {
      return sum + estimateTokens(match.message.content) + 10; // 10 token overhead per match
    }, 0);
  }

  // Store original count before applying result limit
  const totalBeforeLimit = allMatches.length;

  // Apply limit if specified
  if (options.limit && options.limit > 0) {
    allMatches = allMatches.slice(0, options.limit);
    if (allMatches.length < totalBeforeLimit) {
      truncatedCount = totalBeforeLimit - allMatches.length;
    }
  }

  // Count total sessions searched
  let totalSessions = 0;
  for (const reader of readers) {
    const sessions = await reader.findSessions(options.workDirFilter);
    totalSessions += sessions.length;
  }

  return {
    matches: allMatches,
    totalMatches: allMatches.length,
    searchedSessions: totalSessions,
    agents: options.agents,
    estimatedTokens,
    tokenBudgetExceeded,
    truncatedCount: truncatedCount > 0 ? truncatedCount : undefined
  };
}
