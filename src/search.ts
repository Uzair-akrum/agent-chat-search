#!/usr/bin/env node

/**
 * Agent Chat Search CLI
 * Search across multiple AI coding agent chat histories
 */

import { Command } from 'commander';
import { searchAgents } from './lib/search.js';

import { formatResults, formatResultsJSON } from './lib/format.js';
import { listSessions, formatSessionList, formatSessionListJSON } from './lib/session-list.js';
import type { AgentType, MessageRole, SearchOptions, OutputMode } from './types.js';

const program = new Command();

program
  .name('agent-search')
  .description('Search across multiple CLI coding agent chat histories')
  .version('1.0.0');

program
  .option('-q, --query <query>', 'Search query string')
  .option('-a, --agent <agents>', 'Comma-separated agent names (claude,kimi)', 'kimi')
  .option('--all', 'Search across all agents')
  .option('-r, --role <role>', 'Filter by message role (user|assistant|tool)')
  .option('-c, --context <lines>', 'Number of context lines before/after match', '0')
  .option('-w, --work-dir <path>', 'Filter by work directory (substring match)')
  .option('-l, --limit <count>', 'Limit number of results', '50')
  .option('-j, --json', 'Output results as JSON')
  .option('--output-mode <mode>', 'Output mode: snippet|full|summary', 'snippet')
  .option('--snippet-size <chars>', 'Characters around match in snippet mode', '200')
  .option('--max-content-length <chars>', 'Max chars per message (0 for unlimited)', '500')
  .option('--max-tokens <tokens>', 'Maximum total tokens (approximate)')
  .option('--list-sessions', 'List all sessions instead of searching (no query needed)')
  .parse();

async function main() {
  const options = program.opts();

  // Validate that we have either a query or --list-sessions
  if (!options.query && !options.listSessions) {
    console.error('Error: --query is required (or use --list-sessions to browse sessions)');
    console.error('');
    console.error('Usage:');
    console.error('  agent-search --query "search term" [options]     # Search content');
    console.error('  agent-search --list-sessions --all             # List all sessions');
    console.error('');
    console.error('Examples:');
    console.error('  agent-search --query "authentication" --all');
    console.error('  agent-search --list-sessions --all --limit 20');
    console.error('');
    console.error('Run "agent-search --help" for more information');
    process.exit(1);
  }

  // Parse agents
  let agents: AgentType[];
  if (options.all) {
    agents = ['claude', 'kimi'];
  } else {
    const agentList = options.agent.split(',').map((a: string) => a.trim());
    agents = agentList.filter((a: string) => a === 'claude' || a === 'kimi') as AgentType[];

    if (agents.length === 0) {
      console.error('Error: No valid agents specified. Valid agents: claude, kimi');
      process.exit(1);
    }
  }

  // Parse limit (used by both search and list-sessions)
  const limit = parseInt(options.limit, 10);
  if (isNaN(limit) || limit < 0) {
    console.error('Error: Limit must be a non-negative number');
    process.exit(1);
  }

  try {
    // Handle list-sessions mode
    if (options.listSessions) {
      const result = await listSessions(
        agents,
        options.workDir,
        limit > 0 ? limit : undefined
      );

      if (options.json) {
        console.log(formatSessionListJSON(result));
      } else {
        console.log(formatSessionList(result));
      }
      return;
    }

    // Handle search mode (original behavior)
    // Parse role filter
    let role: MessageRole | undefined;
    if (options.role) {
      if (options.role !== 'user' && options.role !== 'assistant' && options.role !== 'tool') {
        console.error('Error: Invalid role. Valid roles: user, assistant, tool');
        process.exit(1);
      }
      role = options.role as MessageRole;
    }

    // Parse numeric options
    const contextLines = parseInt(options.context, 10);

    if (isNaN(contextLines) || contextLines < 0) {
      console.error('Error: Context lines must be a non-negative number');
      process.exit(1);
    }

    // Parse output mode
    let outputMode: OutputMode = 'snippet';
    if (options.outputMode) {
      const validModes: OutputMode[] = ['snippet', 'full', 'summary'];
      if (!validModes.includes(options.outputMode as OutputMode)) {
        console.error('Error: Invalid output mode. Valid modes: snippet, full, summary');
        process.exit(1);
      }
      outputMode = options.outputMode as OutputMode;
    }

    // Parse snippet size
    const snippetSize = parseInt(options.snippetSize, 10);
    if (isNaN(snippetSize) || snippetSize < 0) {
      console.error('Error: Snippet size must be a non-negative number');
      process.exit(1);
    }

    // Parse max content length
    const maxContentLength = parseInt(options.maxContentLength, 10);
    if (isNaN(maxContentLength) || maxContentLength < 0) {
      console.error('Error: Max content length must be a non-negative number');
      process.exit(1);
    }

    // Parse max tokens
    let maxTokens: number | undefined;
    if (options.maxTokens) {
      maxTokens = parseInt(options.maxTokens, 10);
      if (isNaN(maxTokens) || maxTokens < 0) {
        console.error('Error: Max tokens must be a non-negative number');
        process.exit(1);
      }
    }

    // Build search options
    const searchOptions: SearchOptions = {
      query: options.query,
      agents,
      role,
      contextLines,
      workDirFilter: options.workDir,
      limit: limit > 0 ? limit : undefined,
      caseInsensitive: true,
      outputMode,
      snippetSize,
      maxContentLength: maxContentLength,
      maxTokens
    };

    // Execute search
    const result = await searchAgents(searchOptions);

    // Format and output results
    if (options.json) {
      console.log(formatResultsJSON(result));
    } else {
      if (result.totalMatches === 0) {
        console.log(`No matches found for query: "${options.query}"`);
        console.log(`Searched ${result.searchedSessions} sessions across ${result.agents.length} agent(s)`);
      } else {
        console.log(formatResults(result));
      }
    }
  } catch (error) {
    console.error('Error executing search:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
