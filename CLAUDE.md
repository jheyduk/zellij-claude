# CLAUDE.md

## Project Overview

zellij-claude manages multiple Claude Code sessions in Zellij tabs. It provides a CLI, MCP server, and Telegram integration for session management.

## Telegram Channel Setup

The `@main` session needs the Telegram plugin to receive incoming messages. Two things are required:

1. Enable the plugin in the project's `.claude/settings.json`:
   ```json
   { "enabledPlugins": { "telegram@claude-plugins-official": true } }
   ```
2. Start the session with: `claude --channels plugin:telegram@claude-plugins-official`

## Architecture

- `src/dispatch.js` — command parsing and routing (the core logic)
- `src/registry.js` — tab discovery, kürzel derivation, collision resolution
- `src/zellij.js` — thin wrapper around `zellij` CLI actions
- `src/workspace.js` — workspace directory lookup for `/open @kürzel` without path
- `src/screen-parse.js` — extracts Claude's last response from TUI screen dumps
- `src/sanitize.js` — masks secrets before forwarding output
- `mcp/server.js` — MCP server exposing all commands as tools
- `hooks/` — Telegram notification hooks (permission, completion, transcription)
- `bin/zellij-claude` — CLI entry point

## Development

```bash
node --test test/**/*.test.js    # run all tests
node --test test/dispatch.test.js  # run specific test file
```

- Node.js >= 18, ESM (`"type": "module"`)
- Zero runtime dependencies except `@modelcontextprotocol/sdk`
- Tests use `node:test` and `node:assert/strict` — no test framework needed
- Mock zellij interactions by passing a fake `zellij` object to `execute()`

## Session Status Detection

`/ls` derives session status from Zellij pane info (`list-panes --json`):
- **working** — spinner character in pane title (Claude is processing)
- **ready** — Claude session with no spinner (idle, waiting for input)
- **shell (proc)** — not a Claude session; shows the process name
- **waiting** — permission prompt detected in title

## Workspace Lookup

`/open @kürzel` without a path searches configured directories for a matching folder.
Config: `~/.config/zellij-claude/workspaces.json` with `{ "searchPaths": [...] }`.
Defaults: `~/prj`, `~/projects`, `~/src`, `~/work`.

## Telegram Message Routing

When a `<channel source="plugin:telegram:telegram">` message arrives, follow the
routing rules in `skills/telegram-router/SKILL.md`. Read that file on first
Telegram message in each session to load the full routing logic.
