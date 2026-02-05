# Installation Guide

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**

## Option 1: Install from npm (Recommended for Users)

```bash
npm install -g agent-chat-search

# Now you can use it anywhere
agent-search --query "authentication" --all
```

## Option 2: Clone and Build (Recommended for Developers)

```bash
# Clone the repository
git clone https://github.com/Uzair-akrum/agent-chat-search.git
cd agent-chat-search

# Install dependencies
npm install

# Build the project
npm run build

# Run directly
npm start -- --query "test" --all

# Or install globally from local
cd agent-chat-search
npm link

# Now use globally
agent-search --query "test" --all
```

## Option 3: Use with npx (No Installation)

```bash
npx agent-chat-search --query "authentication" --all
```

## Verification

Test your installation:

```bash
# Should show version
agent-search --version

# Should list sessions
agent-search --list-sessions --all --limit 5

# Should search
agent-search --query "test" --agent kimi --limit 3
```

## Post-Installation Setup

### For Claude Code Users

Sessions are automatically read from:

```
~/.claude/projects/
```

### For Kimi Users

Sessions are automatically read from:

```
~/.kimi/sessions/
```

Or from the directory specified by `KIMI_SHARE_DIR` environment variable.

## Troubleshooting

### "command not found: agent-search"

Make sure the global npm bin directory is in your PATH:

```bash
# Check npm global bin location
npm bin -g

# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export PATH="$PATH:$(npm bin -g)"
```

### "Cannot find module"

Make sure you ran `npm install` and `npm run build`:

```bash
cd agent-chat-search
npm install
npm run build
```

### Permission errors on session files

```bash
# Fix permissions for Claude Code
chmod -R u+r ~/.claude/projects/

# Fix permissions for Kimi
chmod -R u+r ~/.kimi/sessions/
```

## Uninstallation

```bash
# If installed globally
npm uninstall -g agent-chat-search

# If linked locally
cd agent-chat-search
npm unlink
```
