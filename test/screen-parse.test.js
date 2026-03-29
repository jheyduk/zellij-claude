import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLastResponse, extractResponses } from '../src/screen-parse.js';

// extractLastResponse tests

test('extractLastResponse - last block before prompt', () => {
  const screen = `⏺ Some response text
  line 2
❯ `;
  const result = extractLastResponse(screen);
  assert.equal(result, 'Some response text\nline 2');
});

test('extractLastResponse - strips tool output markers', () => {
  const screen = `⏺ Response with marker
  ⎿  tool output
  continuation`;
  const result = extractLastResponse(screen);
  assert.equal(result, 'Response with marker\ntool output\ncontinuation');
});

test('extractLastResponse - filters separators', () => {
  const screen = `⏺ First line
──────────────────
  middle line`;
  const result = extractLastResponse(screen);
  assert.equal(result, 'First line\nmiddle line');
});

test('extractLastResponse - filters statusbar', () => {
  const screen = `⏺ Response text
  Opus 4 - Some status
  more text`;
  const result = extractLastResponse(screen);
  assert.equal(result, 'Response text\nmore text');
});

test('extractLastResponse - filters Rewind dialog', () => {
  const screen = `⏺ Some response
  Rewind
  more content`;
  const result = extractLastResponse(screen);
  assert.equal(result, 'Some response\nmore content');
});

test('extractLastResponse - filters spinners', () => {
  const screen = `⏺ Response
  · loading
  ⠋ another spinner
  content`;
  const result = extractLastResponse(screen);
  assert.equal(result, 'Response\ncontent');
});

test('extractLastResponse - filters hook status', () => {
  const screen = `⏺ Response text
  running stop hooks
  more content`;
  const result = extractLastResponse(screen);
  assert.equal(result, 'Response text\nmore content');
});

test('extractLastResponse - filters hook status running start', () => {
  const screen = `⏺ Response text
  running start hooks
  more content`;
  const result = extractLastResponse(screen);
  assert.equal(result, 'Response text\nmore content');
});

test('extractLastResponse - filters thinking', () => {
  const screen = `⏺ Response text
  thinking
  more content`;
  const result = extractLastResponse(screen);
  assert.equal(result, 'Response text\nmore content');
});

test('extractLastResponse - falls back to trailing text when no response marker', () => {
  const screen = `Some terminal output
❯ user input`;
  const result = extractLastResponse(screen);
  assert.equal(result, 'Some terminal output');
});

test('extractLastResponse - returns null for empty input', () => {
  const result = extractLastResponse('');
  assert.equal(result, null);
});

test('extractLastResponse - returns null for null input', () => {
  const result = extractLastResponse(null);
  assert.equal(result, null);
});

test('extractLastResponse - stops at user prompt', () => {
  const screen = `⏺ First response
  content
❯ user typed something`;
  const result = extractLastResponse(screen);
  assert.equal(result, 'First response\ncontent');
});

test('extractLastResponse - handles tool calls then text response', () => {
  const screen = `⏺ Calling tool
  ⎿  tool_output
⏺ Final response
  more text
❯ `;
  const result = extractLastResponse(screen);
  assert.equal(result, 'Final response\nmore text');
});

test('extractLastResponse - multiple spinner types', () => {
  const screen = `⏺ Text
  ⠙ spinner
  ⠹ more spinner
  ⠸ and more
  content`;
  const result = extractLastResponse(screen);
  assert.equal(result, 'Text\ncontent');
});

test('extractLastResponse - mixed noise types', () => {
  const screen = `⏺ Response
  Sonnet 3.5 status line
  ──────────────
  · spinning
  Restore the code
  thinking
  running start hooks
  actual content`;
  const result = extractLastResponse(screen);
  assert.equal(result, 'Response\nactual content');
});

// extractResponses tests

test('extractResponses - last 1 (default)', () => {
  const screen = `⏺ First
❯ `;
  const result = extractResponses(screen);
  assert.equal(result, 'First');
});

test('extractResponses - last 1 with explicit count', () => {
  const screen = `⏺ Only one
❯ `;
  const result = extractResponses(screen, 1);
  assert.equal(result, 'Only one');
});

test('extractResponses - last N blocks', () => {
  const screen = `⏺ First response
❯
⏺ Second response
❯ `;
  const result = extractResponses(screen, 2);
  assert.equal(result, 'First response\n\n---\n\nSecond response');
});

test('extractResponses - count exceeds available', () => {
  const screen = `⏺ Only response
❯ `;
  const result = extractResponses(screen, 5);
  assert.equal(result, 'Only response');
});

test('extractResponses - falls back to trailing text for non-Claude output', () => {
  const screen = `terminal output
prompt $`;
  const result = extractResponses(screen);
  assert.equal(result, 'terminal output\nprompt $');
});

test('extractResponses - null for empty input', () => {
  const result = extractResponses('');
  assert.equal(result, null);
});

test('extractResponses - null for null input', () => {
  const result = extractResponses(null);
  assert.equal(result, null);
});

test('extractResponses - multiple blocks separated by prompts', () => {
  const screen = `⏺ First response
  content 1
❯
⏺ Second response
  content 2
❯
⏺ Third response
  content 3`;
  const result = extractResponses(screen, 2);
  assert.equal(result, 'Second response\ncontent 2\n\n---\n\nThird response\ncontent 3');
});

test('extractResponses - all available blocks', () => {
  const screen = `⏺ Response 1
❯
⏺ Response 2
❯ `;
  const result = extractResponses(screen, 2);
  assert.equal(result, 'Response 1\n\n---\n\nResponse 2');
});

test('extractResponses - three blocks, get last two', () => {
  const screen = `⏺ Block A
❯
⏺ Block B
❯
⏺ Block C
  final content`;
  const result = extractResponses(screen, 2);
  assert.equal(result, 'Block B\n\n---\n\nBlock C\nfinal content');
});

test('extractResponses - filters noise in multiple blocks', () => {
  const screen = `⏺ First
  · spinner
❯
⏺ Second
  thinking
  actual text`;
  const result = extractResponses(screen, 2);
  assert.equal(result, 'First\n\n---\n\nSecond\nactual text');
});
