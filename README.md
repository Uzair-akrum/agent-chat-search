# Agent Chat Search 🔍

> Search through chat sessions across multiple AI coding agents (Claude Code, Kimi, Codex, OpenCode)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A unified search capability across multiple CLI coding agent chat histories. Stop switching between different tools to find that code snippet you discussed last week!

## ✨ Features

- **🔍 Universal Search** - Search across Claude Code, Kimi, Codex, and OpenCode sessions in one command
- **📋 Session Browser** - List all sessions with topic previews
- **✂️ Smart Snippets** - Extracts relevant context around matches (no context window overflow)
- **💰 Token Budget** - Limit output size to prevent context exhaustion
- **📊 Session Metadata** - See message count, timestamps, and first message preview
- **🔀 Cross-Agent** - Search Claude, Kimi, Codex, and OpenCode simultaneously

## 🚀 Quick Start

### Installation

#### Option 1: One-line Install (Recommended)

Works with **Claude Code**, **Kimi**, and any AI agent:

```bash
curl -fsSL https://raw.githubusercontent.com/Uzair-akrum/agent-chat-search/main/install.sh | bash
```

This automatically installs to:

- `~/.claude/skills/agent-chat-search/` (for Claude Code)
- `~/.kimi/skills/agent-chat-search/` (for Kimi)
- `~/.codex/skills/agent-chat-search/` (for Codex)
- `~/.local/share/opencode/skills/agent-chat-search/` (for OpenCode)

Then tell your agent: **"Search my chat history for [topic]"**

#### Option 2: Via OpenSkills

```bash
npx openskills install Uzair-akrum/agent-chat-search --global
```

Note: OpenSkills currently only installs to `~/.claude/skills/`. Kimi and Codex users should use Option 1.

#### Option 3: Manual Installation

```bash
# Clone (pre-built files included, no build needed)
git clone https://github.com/Uzair-akrum/agent-chat-search.git

# Copy to your agent's skills directory
# For Claude Code:
mkdir -p ~/.claude/skills
cp -r agent-chat-search ~/.claude/skills/

# For Kimi:
mkdir -p ~/.kimi/skills
cp -r agent-chat-search ~/.kimi/skills/

# For Codex:
mkdir -p ~/.codex/skills
cp -r agent-chat-search ~/.codex/skills/
```

### Basic Usage

```bash
# Search across all agents
npm start -- --query "authentication" --all

# Or use tsx directly (no build needed)
npx tsx src/search.ts --query "authentication" --all

# List recent sessions
npm start -- --list-sessions --all --limit 20
```

### Using with AI Agents (OpenSkills)

Once installed via OpenSkills, AI agents can automatically use this skill. Simply ask:

> "Search my chat history for the authentication code we discussed last week"

The agent will:

1. Detect the `agent-chat-search` skill is available
2. Run: `npx openskills read agent-chat-search`
3. Execute the search across your Claude Code, Kimi, Codex, and OpenCode sessions
4. Present the results

**Example agent interactions:**

- "Find my recent chat about API error handling"
- "List my Kimi sessions from yesterday"
- "Search for that React component we built in Claude"
- "What did I discuss about database migration?"

## 📖 Usage Examples

### Search Mode

```bash
# Search all agents for "error handling"
npm start -- --query "error handling" --all

# Search only Claude Code sessions
npm start -- --query "refactor" --agent claude

# Search only Kimi sessions
npm start -- --query "bug fix" --agent kimi

# Search only Codex sessions
npm start -- --query "cleanup" --agent codex

# Search only OpenCode sessions
npm start -- --query "deploy" --agent opencode

# Show 3 context lines before/after matches
npm start -- --query "deploy" --all --context 3

# Filter by work directory
npm start -- --query "api" --all --work-dir myproject

# Output as JSON
npm start -- --query "auth" --all --json
```

### Browse Sessions (No Search)

```bash
# List all recent sessions
npm start -- --list-sessions --all --limit 20

# List only Kimi sessions
npm start -- --list-sessions --agent kimi --limit 10

# List sessions from specific project
npm start -- --list-sessions --all --work-dir myproject
```

### Context Window Management

```bash
# Default: Extract snippets around matches (~200 chars)
npm start -- --query "function" --all

# Full content mode (complete messages)
npm start -- --query "function" --all --output-mode full

# Custom snippet size
npm start -- --query "error" --all --snippet-size 100

# Limit total tokens
npm start -- --query "implement" --all --max-tokens 2000
```

## 📋 CLI Reference

```
Options:
  -q, --query <query>           Search query string (required unless --list-sessions)
  -a, --agent <agents>          Comma-separated agent names (claude,kimi,codex,opencode) [default: kimi]
  --all                         Search across all agents
  --list-sessions               List all sessions instead of searching
  -r, --role <role>             Filter by message role (user|assistant|tool)
  -c, --context <lines>         Number of context lines before/after match [default: 0]
  -w, --work-dir <path>         Filter by work directory (substring match)
  -l, --limit <count>           Limit number of results [default: 50]
  -j, --json                    Output results as JSON
  --output-mode <mode>          Output mode: snippet|full|summary [default: snippet]
  --snippet-size <chars>        Characters around match in snippet mode [default: 200]
  --max-content-length <chars>  Max chars per message (0 for unlimited) [default: 500]
  --max-tokens <tokens>         Maximum total tokens (approximate)
  -h, --help                    Display help
  -V, --version                 Display version
```

## 🏗️ Architecture

```
src/
├── search.ts              # CLI entry point
├── types.ts               # Type definitions
├── readers/
│   ├── base.ts           # Abstract reader (snippet extraction)
│   ├── claude.ts         # Claude Code adapter
│   ├── kimi.ts           # Kimi adapter
│   ├── codex.ts          # Codex adapter
│   ├── opencode.ts       # OpenCode adapter
│   └── index.ts          # Exports
└── lib/
    ├── jsonl.ts          # JSONL parsing
    ├── content.ts        # Content extraction
    ├── search.ts         # Search orchestration
    ├── format.ts         # Output formatting
    ├── snippet.ts        # Snippet extraction logic
    └── session-list.ts   # Session listing logic
```

### How It Works

1. **Session Discovery** - Each reader scans its agent's session directory
2. **Content Extraction** - JSONL files are parsed into message objects
3. **Pattern Matching** - Regex search across all message content
4. **Snippet Extraction** - Relevant context extracted around matches
5. **Output Formatting** - Human-readable or JSON output

## 🤝 Supported Agents

| Agent       | Session Location                   | Status       |
| ----------- | ---------------------------------- | ------------ |
| Claude Code | `~/.claude/projects/`              | ✅ Supported |
| Kimi        | `~/.kimi/sessions/`                | ✅ Supported |
| Codex CLI   | `~/.codex/sessions/`               | ✅ Supported |
| OpenCode    | `~/.local/share/opencode/storage/` | ✅ Supported |
| Cursor      | -                                  | 🚧 Planned   |

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run in development mode (no build needed)
npm run dev -- --query "test" --all

# Build for production
npm run build

# Run compiled version
node dist/search.js --query "test" --all
```

### Adding a New Agent Reader

1. Create `src/readers/newagent.ts`:

```typescript
import { BaseAgentReader } from './base.js';

export class NewAgentReader extends BaseAgentReader {
  agentType = 'newagent';

  getSessionsDir(): string {
    return join(homedir(), '.newagent', 'sessions');
  }

  async findSessions(workDirFilter?: string): Promise<Session[]> {
    // Implement session discovery
  }

  async readSession(sessionId: string): Promise<Session | null> {
    // Implement session reading
  }
}
```

2. Update `src/search.ts` to include the new reader
3. Update type definitions in `src/types.ts`

## 📝 Output Format

### Human-Readable (Default)

```
Found 3 matches across 2 agent(s) (searched 127 sessions):

--- Match 1 [claude] ---
Session: a3b4c5d6-e7f8-9012-3456-789abcdef012
Work Dir: /home/user/myproject
Agent: Claude Code
Time: 2026-02-04T15:30:22
Position: assistant message 15/42 (36% through session)

>>> [assistant] ...implement try-catch blocks around the auth...
    [Truncated: showing 45% of 1200 chars, type: snippet]
```

### JSON

```json
{
  "matches": [...],
  "totalMatches": 3,
  "searchedSessions": 127,
  "agents": ["claude", "kimi"],
  "estimatedTokens": 850
}
```

## ⚠️ Known Limitations

- **Regex-based search** - No fuzzy matching or typo tolerance
- **No indexing** - Searches are linear (acceptable for <500 sessions)
- **Local only** - No cloud sync or remote session access

## 🗺️ Roadmap

- [x] Snippet extraction
- [x] Token budget management
- [x] Session listing mode
- [x] Support for Codex CLI
- [x] Support for OpenCode
- [ ] Semantic search (embeddings)
- [ ] Session indexing for faster search
- [ ] Interactive TUI mode

## 📄 License

MIT © [Uzair Akram](https://github.com/Uzair-akrum)

## 🙏 Acknowledgments

- Inspired by [CASS](https://github.com/Dicklesworthstone/coding_agent_session_search) (Coding Agent Session Search)
- Claude Code's session storage format
- Kimi's session storage format
