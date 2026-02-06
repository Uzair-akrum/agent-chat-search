#!/bin/bash
# Agent Chat Search - One-line uninstaller
# Usage: curl -fsSL https://raw.githubusercontent.com/Uzair-akrum/agent-chat-search/main/uninstall.sh | bash

set -e

ASSUME_YES=false
TARGET_DIRS=(
  "$HOME/.claude/skills/agent-chat-search"
  "$HOME/.kimi/skills/agent-chat-search"
  "$HOME/.codex/skills/agent-chat-search"
  "$HOME/.local/share/opencode/skills/agent-chat-search"
)

usage() {
  cat <<'EOF'
Usage: uninstall.sh [options]

Options:
  -y, --yes   Skip confirmation prompt
  -h, --help  Show this help message
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes)
      ASSUME_YES=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

EXISTING_TARGETS=()
for dir in "${TARGET_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    EXISTING_TARGETS+=("$dir")
  fi
done

if [ ${#EXISTING_TARGETS[@]} -eq 0 ]; then
  echo "No existing agent-chat-search installations found."
  exit 0
fi

if [ "$ASSUME_YES" != true ]; then
  if [ ! -t 0 ]; then
    echo "Refusing to uninstall without confirmation in a non-interactive shell."
    echo "Re-run with --yes to proceed:"
    echo "  curl -fsSL https://raw.githubusercontent.com/Uzair-akrum/agent-chat-search/main/uninstall.sh | bash -s -- --yes"
    exit 1
  fi

  echo "This will remove agent-chat-search from:"
  for dir in "${EXISTING_TARGETS[@]}"; do
    echo "  - $dir"
  done
  echo ""
  read -r -p "Continue? [y/N] " CONFIRM
  case "$CONFIRM" in
    y|Y|yes|YES)
      ;;
    *)
      echo "Uninstall cancelled."
      exit 0
      ;;
  esac
fi

REMOVED=0
for dir in "${TARGET_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "Removing: $dir"
    rm -rf "$dir"
    REMOVED=$((REMOVED + 1))
  else
    echo "Not found: $dir"
  fi
done

echo ""
echo "Uninstall complete. Removed $REMOVED installation(s)."
