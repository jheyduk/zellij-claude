#!/bin/bash
# Ensure only one Telegram MCP polling process runs at a time.
# Usage: source this from a SessionStart hook or run standalone.
#
# Uses a PID lockfile. If another instance is already polling,
# this script kills it before the new one starts (last-writer-wins).

LOCKFILE="/tmp/zellij-claude-telegram.pid"

cleanup_stale_telegram() {
  if [ ! -f "$LOCKFILE" ]; then
    return 0
  fi

  local old_pid
  old_pid=$(cat "$LOCKFILE" 2>/dev/null)

  if [ -z "$old_pid" ]; then
    rm -f "$LOCKFILE"
    return 0
  fi

  # Check if the process is still running
  if kill -0 "$old_pid" 2>/dev/null; then
    # Verify it's actually a bun/telegram process
    local cmd
    cmd=$(ps -p "$old_pid" -o command= 2>/dev/null)
    if echo "$cmd" | grep -q "bun.*server"; then
      echo "Killing stale Telegram MCP process (PID $old_pid)"
      kill "$old_pid" 2>/dev/null
      sleep 1
      # Force kill if still alive
      kill -0 "$old_pid" 2>/dev/null && kill -9 "$old_pid" 2>/dev/null
    fi
  fi

  rm -f "$LOCKFILE"
}

register_telegram_pid() {
  # Find the bun server.ts process spawned by this Claude session
  # Give it a moment to start
  sleep 2
  local pid
  pid=$(pgrep -f "bun.*server.ts" | head -1)
  if [ -n "$pid" ]; then
    echo "$pid" > "$LOCKFILE"
  fi
}

# When run standalone: clean up and optionally register
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  case "${1:-cleanup}" in
    cleanup)
      cleanup_stale_telegram
      ;;
    register)
      register_telegram_pid
      ;;
    *)
      echo "Usage: $0 [cleanup|register]"
      exit 1
      ;;
  esac
fi
