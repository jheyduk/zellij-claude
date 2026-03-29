# zellij-claude

Manage multiple Claude Code sessions in Zellij — from your terminal or your phone.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- **Named sessions** — run multiple Claude Code sessions as named Zellij tabs (`@main`, `@hub`, `@infra`)
- **Full CLI** — switch, inspect, and send messages to any session from the command line
- **MCP Server** — lets Claude manage sibling sessions: open, send, inspect, navigate
- **Telegram integration** — monitor sessions, handle permission requests, and send voice messages from your phone
- **Secret sanitization** — API keys, tokens, and credentials are masked before any output leaves the terminal
- **Smart output parsing** — extracts Claude's last response from the TUI, filters spinners and noise
- **Zero runtime dependencies** — built on Node.js built-ins; only the MCP SDK is required for the server

---

## Prerequisites

- **Node.js** >= 18
- **[Zellij](https://zellij.dev/)** terminal multiplexer
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** CLI

---

## Quick Start

```bash
npm install -g zellij-claude    # or: npx zellij-claude <command>

zellij-claude ls                         # list active sessions
zellij-claude last @hub                  # last response from @hub
zellij-claude send @hub "run tests"      # send a message to @hub
zellij-claude open ~/prj/myapp           # open a new session for myapp
```

---

## CLI Reference

| Command | Arguments | Description |
|---|---|---|
| `ls` | — | List active Claude Code sessions |
| `last` | `@<name> [count]` | Show the last response(s) from a session |
| `send` | `@<name> <message>` | Send a message to a session |
| `open` | `[--name @<name>] <path> [-- flags]` | Open a new session in a new tab |
| `goto` | `@<name>` | Switch focus to a session tab |
| `rename` | `@<old> @<new>` | Rename a session |
| `mcp` | — | Start the MCP server (stdio transport) |
| `install-hooks` | — | Install Telegram hooks into Claude Code settings |

---

## MCP Server Setup

Add the following to your Claude Code `settings.json` (usually `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "zellij-claude": {
      "command": "npx",
      "args": ["zellij-claude", "mcp"]
    }
  }
}
```

This exposes six tools to any Claude session running inside Zellij:

| Tool | Description |
|---|---|
| `zellij_ls` | List active Claude Code sessions |
| `zellij_last` | Show last response(s) from a session |
| `zellij_send` | Send a message to a session |
| `zellij_open` | Open a new Claude Code session in a new tab |
| `zellij_goto` | Switch to a session tab |
| `zellij_rename` | Rename a session |

---

## Session Naming

Tabs managed by zellij-claude are prefixed with `@` — e.g., `@main`, `@hub`, `@infra`. The `@` prefix marks a tab as a session and makes it addressable by all CLI commands and MCP tools.

When you open a new session with `zellij-claude open <path>`, the session name is auto-derived from the directory name. If a tab with that name already exists, a numeric suffix is appended (`@myapp-2`, `@myapp-3`, etc.).

You can override the auto-derived name with the `--name` flag:

```bash
zellij-claude open --name @backend ~/prj/myapp/api
```

---

## Telegram Integration

### Setup

1. Requires the [Claude Code Telegram plugin](https://github.com/anthropics/claude-code-plugins) — install and pair it first.
2. Configure your chat ID:
   - **Environment variable**: `export ZELLIJ_CLAUDE_CHAT_ID=<your-chat-id>`
   - **Config file**: create `~/.config/zellij-claude/telegram.json` with:
     ```json
     { "chatId": "<your-chat-id>" }
     ```
3. Install the hooks:
   ```bash
   npx zellij-claude install-hooks
   ```

### What you get

- **Completion notifications** — when a session finishes a task, you receive the last response via Telegram
- **Permission buttons** — non-`@main` sessions send Allow/Deny buttons to Telegram for tool permission requests
- **Voice message transcription** — send a voice note to Claude; it's transcribed and processed as a normal message

### Telegram Plugin Patch (for permission buttons)

The Claude Code Telegram plugin silently drops unknown callback queries. A small patch forwards them as channel messages so `@main` can process Allow/Deny button presses from other sessions.

**The patch — 3 lines added to the `if (!m)` branch in the `callback_query:data` handler:**

```typescript
// File: ~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/telegram/server.ts
// Find the callback_query handler's `if (!m)` branch and replace:

// Before:
if (!m) {
  await ctx.answerCallbackQuery().catch(() => {})
  return
}

// After:
if (!m) {
  void mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content: `callback:${data}`,
      meta: { chat_id: String(ctx.from.id), user: ctx.from.username ?? String(ctx.from.id) },
    },
  }).catch(() => {})
  await ctx.answerCallbackQuery().catch(() => {})
  return
}
```

**Or just ask Claude Code to apply it:**

> "Apply the zellij-claude callback forwarding patch to the Telegram plugin. Add 4 lines to the `if (!m)` branch in the `callback_query:data` handler in `~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/telegram/server.ts`. Forward unknown callbacks as channel messages via `mcp.notification` instead of silently dropping them."

> **Note:** This patch may need to be reapplied after Telegram plugin updates.

### Handling callbacks in @main

When a user presses Allow/Deny, the callback arrives in `@main` as a channel message like `callback:allow:hub`. Add the following memory entry so `@main` processes these automatically:

```
When a Telegram message matches "callback:allow:<name>" or "callback:deny:<name>":
- allow → send Enter keystroke: zellij action go-to-tab-name @<name> && zellij action write 13
- deny  → send ESC keystroke:   zellij action go-to-tab-name @<name> && zellij action write 27
```

---

## Voice Messages

### Prerequisites

```bash
brew install whisper-cpp ffmpeg
```

The `ggml-base` model (~140 MB) ships with the Homebrew formula. Language auto-detection is enabled by default.

### Configuration

```bash
export ZELLIJ_CLAUDE_WHISPER_LANG=auto  # default — or set: en, de, fr, etc.
```

### Usage

Add the following memory entry to `@main` so Claude automatically handles incoming voice messages:

```
When a Telegram message has attachment_kind="voice":
1. Download via download_attachment with the attachment_file_id
2. Transcribe: bash <path-to-zellij-claude>/hooks/transcribe.sh <file>
3. Reply with transcription prefixed by 🎤
4. Process transcribed text as a normal message
```

---

## How It Works

```
CLI / MCP Server
      ↓
dispatch.js  (command routing)
      ↓
┌─────────────────┬──────────────────┬────────────────┐
│  registry.js    │  screen-parse.js │  sanitize.js   │
│  (tab naming,   │  (TUI output     │  (mask API     │
│   collision     │   parser,        │   keys and     │
│   resolution)   │   noise filter)  │   credentials) │
└─────────────────┴──────────────────┴────────────────┘
      ↓
zellij.js  (Zellij CLI wrapper — uses $ZELLIJ_SESSION_NAME)
```

- **`dispatch.js`** — parses commands and routes them to the right handler
- **`registry.js`** — discovers `@`-prefixed tabs, derives session names, resolves collisions
- **`screen-parse.js`** — captures the current pane content and extracts the last Claude response
- **`sanitize.js`** — masks secrets (API keys, tokens, passwords) before any output is forwarded
- **`zellij.js`** — thin wrapper around the `zellij` CLI; reads `$ZELLIJ_SESSION_NAME` for the current session

---

## License

MIT — see [LICENSE](LICENSE).
