#!/bin/bash
# Session listing examples

echo "=== List recent sessions ==="
agent-search --list-sessions --all --limit 10

echo "=== List only Kimi sessions ==="
agent-search --list-sessions --agent kimi --limit 5

echo "=== List sessions from specific project ==="
agent-search --list-sessions --all --work-dir myproject
