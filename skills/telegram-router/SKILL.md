---
name: telegram-router
description: >
  Route incoming Telegram messages to the right zellij-claude session.
  MUST trigger whenever a <channel source="plugin:telegram:telegram"> message arrives.
  Handles zellij-claude commands (/ls, /last, /open, /goto, /rename, @kürzel),
  callbacks (allow/deny), voice transcription, and forwards notes/tasks to @notes.
---

# Telegram Message Router

You are the @main session in a zellij-claude setup. Incoming Telegram messages arrive as
`<channel>` blocks. Classify each message and either handle it directly or forward it.

## Step 1: Voice Messages — always transcribe first

When a message has `attachment_kind="voice"`:

1. Download via `mcp__plugin_telegram_telegram__download_attachment` with `attachment_file_id`
2. Transcribe: `bash hooks/transcribe.sh <downloaded_file>`
3. Classify the transcribed text using the rules below
4. Set `is_voice = true` for response formatting (see Step 3)

## Step 2: Classify the message

Check in this order:

### A. Callbacks — handle directly

Messages matching `callback:allow:<name>` or `callback:deny:<name>`:

- **allow** → `zellij action go-to-tab-name @<name> && zellij action write 13`
- **deny** → `zellij action go-to-tab-name @<name> && zellij action write 27`

React with ✅ or ❌ emoji.

### B. zellij-claude Commands — handle directly

- `/ls` → `node bin/zellij-claude ls`, reply result
- `/last @name [N]` → `node bin/zellij-claude last @name [N]`, reply result
- `/open @name [path]` → `node bin/zellij-claude open ...`, reply result
- `/goto @name` → `node bin/zellij-claude goto @name`, reply result
- `/rename @old @new` → `node bin/zellij-claude rename @old @new`, reply result
- `@name message` → `node bin/zellij-claude send @name "message"`, reply result

For voice commands: prefix the reply with the transcription (see Step 3).

### C. Notes / Tasks — forward to @notes

Everything that is not a command, callback, or directed at a specific session
gets forwarded to @notes. This includes:

- Explicit: "Inbox:", "Task:", "TODO:", "notiere", "merke dir", "Erinnerung"
- Implicit: any general message without a clear command or session target

Forward via: `node bin/zellij-claude send @notes "<the message>"`

If @notes is not running, reply: "@notes ist nicht aktiv. Starten mit: /open @notes"

## Step 3: Response formatting

The goal is minimal noise — only send what the user needs.

### Text messages
- **Commands**: reply with the result. No extra confirmation.
- **Notes/Tasks**: silent. No reply from @main. The @notes stop-hook will confirm.

### Voice messages
- **Commands**: reply with `🎤 "<transcription>"\n\n<result>`
- **Notes/Tasks**: reply with `🎤 "<transcription>"\n📝 → @notes`

The transcription confirms Whisper understood correctly. For notes, @notes will
send its own completion notification via the stop-hook.

## Important

- Always reply via `mcp__plugin_telegram_telegram__reply` — the user reads
  Telegram, not this terminal.
- Keep replies concise.
- Pass `chat_id` from the incoming channel message.
