#!/bin/bash
# Agent Chat Search - One-line installer
# Usage: curl -fsSL https://raw.githubusercontent.com/Uzair-akrum/agent-chat-search/main/install.sh | bash

set -e

REPO="Uzair-akrum/agent-chat-search"
INSTALL_DIR_CLaude="$HOME/.claude/skills/agent-chat-search"
INSTALL_DIR_KIMI="$HOME/.kimi/skills/agent-chat-search"
TMP_DIR=$(mktemp -d)

echo "🔍 Installing Agent Chat Search..."

# Detect which agent directories exist
TARGETS=""
[ -d "$HOME/.claude" ] && TARGETS="$TARGETS claude"
[ -d "$HOME/.kimi" ] && TARGETS="$TARGETS kimi"

if [ -z "$TARGETS" ]; then
    echo "⚠️  Neither ~/.claude nor ~/.kimi found."
    echo "Installing to ~/.claude/skills/ (for Claude Code)"
    mkdir -p "$HOME/.claude/skills"
    TARGETS="claude"
fi

# Download latest release
echo "📥 Downloading from GitHub..."
curl -fsSL "https://github.com/$REPO/archive/refs/heads/main.tar.gz" | tar -xz -C "$TMP_DIR" --strip-components=1

# Build the project
echo "🔨 Building..."
cd "$TMP_DIR"
npm install --silent
npm run build --silent

# Install to detected locations
for target in $TARGETS; do
    case $target in
        claude)
            INSTALL_DIR="$INSTALL_DIR_CLaude"
            ;;
        kimi)
            INSTALL_DIR="$INSTALL_DIR_KIMI"
            ;;
    esac
    
    echo "📦 Installing to $target: $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
    
    # Copy built files
    cp -r "$TMP_DIR/dist" "$INSTALL_DIR/"
    cp -r "$TMP_DIR/src" "$INSTALL_DIR/"
    cp -r "$TMP_DIR/node_modules" "$INSTALL_DIR/"
    cp "$TMP_DIR/package.json" "$INSTALL_DIR/"
    cp "$TMP_DIR/SKILL.md" "$INSTALL_DIR/"
    cp "$TMP_DIR/README.md" "$INSTALL_DIR/"
    
    # Create scripts symlink for backward compatibility
    ln -sf "$INSTALL_DIR/dist" "$INSTALL_DIR/scripts" 2>/dev/null || true
    
    echo "✅ Installed to $target"
done

# Cleanup
rm -rf "$TMP_DIR"

echo ""
echo "🎉 Installation complete!"
echo ""
echo "Usage examples:"
echo "  cd ~/.claude/skills/agent-chat-search && node dist/search.js --query 'auth' --all"
echo "  cd ~/.kimi/skills/agent-chat-search && node dist/search.js --list-sessions --all"
echo ""
echo "Or tell your AI agent: 'Search my chat history for authentication'"
