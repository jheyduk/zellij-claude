#!/usr/bin/env node
// PreToolUse(AskUserQuestion) hook: sends Telegram notification with question,
// option buttons for quick answers, and accepts free text replies.

const { send, sendWithButtons, getKürzel } = require('./telegram-helper.cjs');

function formatQuestion(kürzel, q) {
  const header = q.header ? `[${q.header}] ` : '';
  const multi = q.multiSelect ? ' (Mehrfachauswahl: z.B. 1,3)' : '';
  let text = `🤖 @${kürzel}\n\n${header}${q.question}${multi}`;

  if (q.options && q.options.length > 0) {
    text += '\n';
    q.options.forEach((opt, i) => {
      text += `\n${i + 1}. ${opt.label}`;
      if (opt.description) text += ` — ${opt.description}`;
    });
    text += '\n\nAntwort als Nummer, Text, oder Button:';
  }

  return text;
}

let input = '';
const timeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(timeout);
  try {
    const data = JSON.parse(input || '{}');
    const kürzel = getKürzel(data.session_id);
    if (!kürzel) { process.exit(0); } // Not a zellij-claude session

    const questions = data.tool_input?.questions;
    if (questions && questions.length > 0) {
      for (const q of questions) {
        const text = formatQuestion(kürzel, q);

        if (q.options && q.options.length > 0) {
          // Build inline keyboard — max 3 buttons per row
          const buttons = q.options.map((opt, i) => ({
            text: `${i + 1}. ${opt.label}`,
            callback_data: `ask:${kürzel}:${i + 1}`,
          }));
          const rows = [];
          for (let i = 0; i < buttons.length; i += 3) {
            rows.push(buttons.slice(i, i + 3));
          }
          sendWithButtons(text, rows);
        } else {
          send(text);
        }
      }
    } else {
      // Fallback: simple question
      const question = data.tool_input?.question || 'Needs your input!';
      send(`🤖 @${kürzel}: ${question}`);
    }
  } catch { /* silent */ }
  process.exit(0);
});
