import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitize } from '../src/sanitize.js';

test('sanitize - AWS Keys', () => {
  const input = 'My AWS key is AKIAIOSFODNN7EXAMPLE';
  const output = sanitize(input);
  assert.equal(output, 'My AWS key is AKIA***');
});

test('sanitize - GitHub ghp token', () => {
  const input = 'Token: ghp_1234567890123456789012345678901234567890';
  const output = sanitize(input);
  assert.equal(output, 'Token: ghp_***');
});

test('sanitize - GitHub gho token', () => {
  const input = 'OAuth token: gho_1234567890123456789012345678901234567890';
  const output = sanitize(input);
  assert.equal(output, 'OAuth token: gho_***');
});

test('sanitize - GitHub ghu token', () => {
  const input = 'User token: ghu_1234567890123456789012345678901234567890';
  const output = sanitize(input);
  assert.equal(output, 'User token: ghu_***');
});

test('sanitize - GitHub ghs token', () => {
  const input = 'Server token: ghs_1234567890123456789012345678901234567890';
  const output = sanitize(input);
  assert.equal(output, 'Server token: ghs_***');
});

test('sanitize - GitHub github_pat token', () => {
  const input = 'PAT: github_pat_1234567890_1234567890_1234567890';
  const output = sanitize(input);
  assert.equal(output, 'PAT: github_pat_***');
});

test('sanitize - GitLab glpat token', () => {
  const input = 'GitLab token: glpat-1234567890_1234567890';
  const output = sanitize(input);
  assert.equal(output, 'GitLab token: glpat-***');
});

test('sanitize - OpenAI sk token', () => {
  const input = 'OpenAI key: sk-1234567890_1234567890_1234567890';
  const output = sanitize(input);
  assert.equal(output, 'OpenAI key: sk-***');
});

test('sanitize - Anthropic sk-ant token', () => {
  const input = 'Anthropic key: sk-ant-1234567890_1234567890_1234567890';
  const output = sanitize(input);
  assert.equal(output, 'Anthropic key: sk-ant-***');
});

test('sanitize - Bearer token', () => {
  const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  const output = sanitize(input);
  assert.equal(output, 'Authorization: Bearer ***');
});

test('sanitize - Bearer token case insensitive', () => {
  const input = 'auth: bearer abcdefghijklmnopqrst12345678901234567890';
  const output = sanitize(input);
  assert.equal(output, 'auth: bearer ***');
});

test('sanitize - Connection string with basic auth', () => {
  const input = 'postgresql://user:password123456@localhost/db';
  const output = sanitize(input);
  assert.equal(output, 'postgresql://user:***@localhost/db');
});

test('sanitize - Private key block', () => {
  const input = '-----BEGIN PRIVATE KEY-----\nMIIEpAIBAAKCAQEA1234567890\n-----END PRIVATE KEY-----';
  const output = sanitize(input);
  assert.equal(output, '[PRIVATE KEY REDACTED]');
});

test('sanitize - RSA Private Key', () => {
  const input = '-----BEGIN RSA PRIVATE KEY-----\ndata\n-----END RSA PRIVATE KEY-----';
  const output = sanitize(input);
  assert.equal(output, '[PRIVATE KEY REDACTED]');
});

test('sanitize - EC Private Key', () => {
  const input = '-----BEGIN EC PRIVATE KEY-----\ndata\n-----END EC PRIVATE KEY-----';
  const output = sanitize(input);
  assert.equal(output, '[PRIVATE KEY REDACTED]');
});

test('sanitize - Environment variable with export', () => {
  const input = 'export API_KEY=verysecretkey12345678';
  const output = sanitize(input);
  assert.equal(output, 'export API_KEY=***');
});

test('sanitize - Environment variable without export', () => {
  const input = 'MY_SECRET=topsecretvalue12345678';
  const output = sanitize(input);
  assert.equal(output, 'MY_SECRET=***');
});

test('sanitize - Multiple environment variables', () => {
  const input = 'export DB_PASSWORD=pass123456789; MY_TOKEN=token123456789';
  const output = sanitize(input);
  assert.equal(output, 'export DB_PASSWORD=*** MY_TOKEN=***');
});

test('sanitize - Environment variable with TOKEN suffix', () => {
  const input = 'AUTH_TOKEN=secrettoken12345678';
  const output = sanitize(input);
  assert.equal(output, 'AUTH_TOKEN=***');
});

test('sanitize - Environment variable with PASSWORD suffix', () => {
  const input = 'DB_PASSWORD=dbpass123456789012';
  const output = sanitize(input);
  assert.equal(output, 'DB_PASSWORD=***');
});

test('sanitize - Multiple secrets in one text', () => {
  const input = 'AWS: AKIAIOSFODNN7EXAMPLE GitHub: ghp_1234567890123456789012345678901234567890 Token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  const output = sanitize(input);
  assert.equal(output, 'AWS: AKIA*** GitHub: ghp_*** Token: Bearer ***');
});

// Negative cases

test('sanitize - Normal text unchanged', () => {
  const input = 'This is just normal text with no secrets.';
  const output = sanitize(input);
  assert.equal(output, input);
});

test('sanitize - Git SHA not masked', () => {
  const input = 'commit a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0';
  const output = sanitize(input);
  assert.equal(output, input);
});

test('sanitize - File paths not masked', () => {
  const input = '/home/user/documents/file.txt ~/projects/repo/.git/config';
  const output = sanitize(input);
  assert.equal(output, input);
});

test('sanitize - Short environment variable value not masked', () => {
  const input = 'MY_VAR=short';
  const output = sanitize(input);
  assert.equal(output, input);
});

test('sanitize - Non-sensitive env vars not masked', () => {
  const input = 'APP_NAME=myapp APP_VERSION=1.0.0 DEBUG=true';
  const output = sanitize(input);
  assert.equal(output, input);
});

test('sanitize - Empty input', () => {
  const input = '';
  const output = sanitize(input);
  assert.equal(output, '');
});

test('sanitize - Whitespace only', () => {
  const input = '   \n\t  ';
  const output = sanitize(input);
  assert.equal(output, input);
});

test('sanitize - PASS suffix environment variable', () => {
  const input = 'export ADMIN_PASS=secretpassword12345678';
  const output = sanitize(input);
  assert.equal(output, 'export ADMIN_PASS=***');
});

test('sanitize - CREDENTIAL suffix environment variable', () => {
  const input = 'AWS_CREDENTIAL=verylongsecretcredential123456789';
  const output = sanitize(input);
  assert.equal(output, 'AWS_CREDENTIAL=***');
});

test('sanitize - Multiple private keys in text', () => {
  const input = `First key:
-----BEGIN PRIVATE KEY-----
secret1
-----END PRIVATE KEY-----

Second key:
-----BEGIN RSA PRIVATE KEY-----
secret2
-----END RSA PRIVATE KEY-----`;
  const output = sanitize(input);
  assert.equal(output, `First key:
[PRIVATE KEY REDACTED]

Second key:
[PRIVATE KEY REDACTED]`);
});

test('sanitize - Mixed secrets in structured text', () => {
  const input = `Config:
export DATABASE_PASSWORD=supersecretdbpass123456789
GitLab Token: glpat-1234567890_abc_def_ghi_jkl
Bearer Auth: Authorization: Bearer abcdefghijklmnopqrst12345`;
  const output = sanitize(input);
  assert.match(output, /DATABASE_PASSWORD=\*\*\*/);
  assert.match(output, /glpat-\*\*\*/);
  assert.match(output, /Bearer \*\*\*/);
  assert.doesNotMatch(output, /supersecretdbpass123456789/);
});
