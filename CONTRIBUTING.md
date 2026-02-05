# Contributing to Agent Chat Search

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

```bash
# Fork and clone
git clone https://github.com/Uzair-akrum/agent-chat-search.git
cd agent-chat-search

# Install dependencies
npm install

# Run in development mode
npm run dev -- --query "test" --all
```

## Project Structure

```
src/
├── search.ts          # CLI entry point
├── types.ts           # Type definitions
├── readers/           # Agent-specific readers
│   ├── base.ts       # Abstract base class
│   ├── claude.ts     # Claude Code reader
│   └── kimi.ts       # Kimi reader
└── lib/              # Shared utilities
    ├── search.ts     # Search orchestration
    ├── format.ts     # Output formatting
    ├── snippet.ts    # Snippet extraction
    └── session-list.ts # Session listing
```

## Adding a New Agent

To add support for a new AI coding agent (e.g., Codex CLI):

1. **Create reader file** `src/readers/codex.ts`:

```typescript
import { join } from 'path';
import { homedir } from 'os';
import { BaseAgentReader } from './base.js';
import type { Session, Message, AgentType } from '../types.js';

export class CodexReader extends BaseAgentReader {
  agentType: AgentType = 'codex';

  getSessionsDir(): string {
    return join(homedir(), '.codex', 'sessions');
  }

  async findSessions(workDirFilter?: string): Promise<Session[]> {
    // Implement session discovery
    // Return array of Session objects
  }

  async readSession(sessionId: string): Promise<Session | null> {
    // Implement session reading
    // Return Session object or null if not found
  }
}
```

2. **Update types** in `src/types.ts`:

```typescript
export type AgentType = 'claude' | 'kimi' | 'codex';
```

3. **Register reader** in `src/search.ts`:

```typescript
import { CodexReader } from './readers/codex.js';

// In main function:
if (options.agents.includes('codex')) {
  readers.push(new CodexReader());
}
```

4. **Update CLI help** to include 'codex' as valid agent

5. **Add tests** and update documentation

## Code Style

- **TypeScript**: Strict mode enabled
- **Imports**: Use `.js` extensions for ES modules
- **Formatting**: Follow existing patterns
- **Comments**: Document complex logic

Example:
```typescript
import type { Message } from './types.js';  // ✅ Note .js extension

/**
 * Extract text content from various formats
 * @param content - Raw content (string, array, or object)
 * @returns Extracted text
 */
export function extractTextContent(content: any): string {
  // Implementation
}
```

## Testing

Before submitting PR:

```bash
# Build the project
npm run build

# Test basic functionality
npm start -- --query "test" --all --limit 3

# Test session listing
npm start -- --list-sessions --all --limit 5

# Test JSON output
npm start -- --query "test" --all --json

# Test with different agents
npm start -- --query "test" --agent claude --limit 3
npm start -- --query "test" --agent kimi --limit 3
```

## Submitting Changes

1. **Fork** the repository
2. **Create a branch** for your feature: `git checkout -b feature/new-agent`
3. **Make your changes** with clear commit messages
4. **Test thoroughly**
5. **Update documentation** (README, INSTALL, etc.)
6. **Submit a Pull Request** with clear description

## Commit Message Format

```
type: Brief description

Detailed explanation if needed.

- Bullet points for changes
- More changes
```

Types:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Maintenance

## Questions?

Open an issue for:
- Feature requests
- Bug reports
- Questions about implementation

## Code of Conduct

- Be respectful and constructive
- Focus on what's best for the community
- Welcome newcomers
