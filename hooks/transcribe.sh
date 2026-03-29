#!/bin/bash
# Transcribe a Telegram voice message (OGA/Opus) using whisper-cpp.
# Usage: transcribe.sh <input.oga>
# Env: ZELLIJ_CLAUDE_WHISPER_LANG (default: auto)

set -euo pipefail

INPUT="$1"
LANG="${ZELLIJ_CLAUDE_WHISPER_LANG:-auto}"
TMPWAV="/tmp/zellij-claude-voice-$$.wav"
MODEL="$(brew --prefix whisper-cpp)/share/whisper-cpp/ggml-base.bin"

trap 'rm -f "$TMPWAV"' EXIT

ffmpeg -y -i "$INPUT" -ar 16000 -ac 1 "$TMPWAV" 2>/dev/null
whisper-cli -m "$MODEL" -l "$LANG" -f "$TMPWAV" --no-timestamps 2>/dev/null | sed '/^$/d'
