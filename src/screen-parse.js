const SEPARATOR = /^\s*[─]{10,}\s*$/;
const STATUSBAR = /^\s*(Opus|Sonnet|Haiku|Claude)\s/;
const UI_CHROME = /^\s*(⏵|shift\+tab|ctrl\+o|Enter to continue|Esc to exit|Rewind|Restore the code)/;
const SPINNER = /^\s*[·⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s/;
const HOOK_STATUS = /running\s+(stop|start)\s+hooks/i;
const THINKING = /^\s*thinking\s*$/i;
const EMPTY_PROMPT = /^❯\s*$/;
const RESPONSE_START = /^[⏺✻]/;
const WORKED_FOR = /^✻\s+Worked for/;
const PROMPT_START = /^❯\s+\S/;

function isNoise(line) {
  return SEPARATOR.test(line)
    || STATUSBAR.test(line)
    || UI_CHROME.test(line)
    || SPINNER.test(line)
    || HOOK_STATUS.test(line)
    || THINKING.test(line)
    || WORKED_FOR.test(line);
}

function cleanBlock(lines) {
  return lines
    .map(l => l.replace(/^[⏺✻]\s*/, '').replace(/^\s{2}⎿\s{1,2}/, '  ').trimStart())
    .join('\n')
    .trim();
}

function findResponseBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    if (!RESPONSE_START.test(lines[i])) { i++; continue; }
    const start = i;
    const block = [];
    for (; i < lines.length; i++) {
      const line = lines[i];
      if (i > start && (RESPONSE_START.test(line) || PROMPT_START.test(line) || EMPTY_PROMPT.test(line))) break;
      if (isNoise(line)) continue;
      block.push(line);
    }
    const text = cleanBlock(block);
    if (text) blocks.push({ start, end: i, text });
  }
  return blocks;
}

function extractTrailingText(lines) {
  // Fallback: extract text before the last ❯ prompt, skipping noise
  let end = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (EMPTY_PROMPT.test(lines[i]) || PROMPT_START.test(lines[i])) { end = i; break; }
  }
  const content = [];
  for (let i = end - 1; i >= 0; i--) {
    const line = lines[i];
    if (isNoise(line) || !line.trim()) {
      if (content.length > 0) break;
      continue;
    }
    content.unshift(line);
  }
  const text = content.map(l => l.trimStart()).join('\n').trim();
  return text || null;
}

export function extractResponses(screenText, count = 1) {
  if (!screenText) return null;
  const lines = screenText.split('\n');
  const blocks = findResponseBlocks(lines);
  if (blocks.length === 0) {
    const trailing = extractTrailingText(lines);
    return trailing;
  }
  const selected = blocks.slice(-count);
  return selected.map(b => b.text).join('\n\n---\n\n');
}

export function extractLastResponse(screenText) {
  return extractResponses(screenText, 1);
}
