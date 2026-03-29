const { execSync } = require('child_process');
const { readFileSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');

const ENV_FILE = join(homedir(), '.claude', 'channels', 'telegram', '.env');
const CONFIG_FILE = join(homedir(), '.config', 'zellij-claude', 'telegram.json');

function loadConfig() {
  const chatId = process.env.ZELLIJ_CLAUDE_CHAT_ID;
  if (chatId) return { chatId };
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch { return {}; }
}

function loadToken() {
  try {
    for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const m = line.match(/^TELEGRAM_BOT_TOKEN=(.+)$/);
      if (m) return m[1];
    }
  } catch {}
  return null;
}

function getKürzel(sessionId) {
  if (sessionId) {
    try {
      return readFileSync(`/tmp/zellij-claude-tab-${sessionId}`, 'utf8').trim();
    } catch {}
  }
  const cwd = process.cwd();
  const segments = cwd.replace(/\/+$/, '').split('/');
  return segments[segments.length - 1] || null;
}

function apiCall(method, params) {
  const token = loadToken();
  if (!token) return null;
  try {
    const json = JSON.stringify(params);
    const result = execSync(
      `curl -s -X POST "https://api.telegram.org/bot${token}/${method}" -H "Content-Type: application/json" --data-binary @-`,
      { input: json, timeout: 5000, encoding: 'utf8' }
    );
    return JSON.parse(result);
  } catch { return null; }
}

function getChatId() {
  return loadConfig().chatId;
}

function send(text) {
  const chatId = getChatId();
  if (!chatId) return null;
  return apiCall('sendMessage', { chat_id: chatId, text });
}

function sendWithButtons(text, buttons) {
  const chatId = getChatId();
  if (!chatId) return null;
  return apiCall('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: { inline_keyboard: [buttons] },
  });
}

module.exports = { send, sendWithButtons, apiCall, getKürzel, loadToken, getChatId };
