---
name: agent-chat-search
description: Search through chat sessions across multiple AI coding agents (Claude Code, Kimi, Codex). Find past conversations, code snippets, and discussions.
---

# Agent Chat Search

Search across your AI coding agent chat histories (Claude Code, Kimi, Codex) to find past conversations, code snippets, and discussions.

## Setup (one-time)

```bash
cd {baseDir} && npm install && npm run build
```

## Search Commands

**Search across all agents:**

```bash
node {baseDir}/dist/search.js --query "your search term" --all
```

**Literal text search (no regex):**

```bash
node {baseDir}/dist/search.js --query "exact phrase" --all --literal
```

**Search with date filters:**

```bash
node {baseDir}/dist/search.js --query "deploy" --all --since yesterday
node {baseDir}/dist/search.js --query "auth" --all --since "3 days ago"
node {baseDir}/dist/search.js --query "bug" --all --since "2025-01-01" --before "2025-02-01"
```

**Search a specific agent:**

```bash
node {baseDir}/dist/search.js --query "refactor" --agent claude
node {baseDir}/dist/search.js --query "bug fix" --agent kimi
node {baseDir}/dist/search.js --query "session cache" --agent codex
```

**List recent sessions:**

```bash
node {baseDir}/dist/search.js --list-sessions --all
node {baseDir}/dist/search.js --list-sessions --all --limit 20
```

**JSON output (for programmatic use):**

```bash
node {baseDir}/dist/search.js --query "auth" --all --json
node {baseDir}/dist/search.js --list-sessions --all --json
```

## CLI Reference

| Flag                           | Description                                               | Default   |
| ------------------------------ | --------------------------------------------------------- | --------- |
| `-q, --query <query>`          | Search query string (required unless `--list-sessions`)   | —         |
| `--all`                        | Search across all agents                                  | —         |
| `-a, --agent <agents>`         | Comma-separated agent names (`claude`,`kimi`,`codex`)     | `kimi`    |
| `--literal`                    | Treat query as literal text (disable regex)               | `false`   |
| `--since <date>`               | Only sessions after date (ISO, "yesterday", "3 days ago") | —         |
| `--before <date>`              | Only sessions before date                                 | —         |
| `-r, --role <role>`            | Filter by message role (`user\|assistant\|tool`)          | —         |
| `-c, --context <lines>`        | Context lines before/after match                          | `0`       |
| `-w, --work-dir <path>`        | Filter by work directory (substring match)                | —         |
| `-l, --limit <count>`          | Limit number of results                                   | `50`      |
| `-j, --json`                   | Output as JSON                                            | —         |
| `--output-mode <mode>`         | `snippet\|full\|summary`                                  | `snippet` |
| `--snippet-size <chars>`       | Characters around match in snippet mode                   | `200`     |
| `--max-content-length <chars>` | Max chars per message (0 = unlimited)                     | `500`     |
| `--max-tokens <tokens>`        | Approximate total token limit                             | —         |
| `--list-sessions`              | List sessions instead of searching                        | —         |

## Tips

- Use `--all` to search Claude Code, Kimi, and Codex sessions at once
- Use `--literal` when searching for code with special regex characters (e.g. brackets, dots)
- Use `--since "yesterday"` or `--since "3 days ago"` to narrow results to recent sessions
- Use `--json` when you need to parse results programmatically
- Use `--limit` to control how many results are returned
