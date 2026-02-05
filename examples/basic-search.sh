#!/bin/bash
# Basic search examples

echo "=== Search across all agents ==="
agent-search --query "authentication" --all

echo "=== Search specific agent ==="
agent-search --query "error handling" --agent claude

echo "=== Search with context ==="
agent-search --query "refactor" --all --context 2

echo "=== JSON output ==="
agent-search --query "deploy" --all --json
