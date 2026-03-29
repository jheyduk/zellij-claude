const patterns = [
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replace: '[PRIVATE KEY REDACTED]' },
  { re: /\b(AKIA[0-9A-Z]{12,})/g, replace: 'AKIA***' },
  { re: /\b(ghp_)[A-Za-z0-9]{20,}/g, replace: 'ghp_***' },
  { re: /\b(gho_)[A-Za-z0-9]{20,}/g, replace: 'gho_***' },
  { re: /\b(ghu_)[A-Za-z0-9]{20,}/g, replace: 'ghu_***' },
  { re: /\b(ghs_)[A-Za-z0-9]{20,}/g, replace: 'ghs_***' },
  { re: /\b(github_pat_)[A-Za-z0-9_]{20,}/g, replace: 'github_pat_***' },
  { re: /\b(glpat-)[A-Za-z0-9_-]{20,}/g, replace: 'glpat-***' },
  { re: /\b(sk-(?:ant-)?)[A-Za-z0-9_-]{20,}/g, replace: '$1***' },
  { re: /(Bearer\s+)[A-Za-z0-9._-]{20,}/gi, replace: '$1***' },
  { re: /(:\/{2}[^:\/\s]+:)[^@\s]+(@)/g, replace: '$1***$2' },
  { re: /(^|[\s;])(export\s+)?([A-Z_]{2,}(?:KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|API_KEY|AUTH)\s*=\s*)\S{8,}/gm, replace: '$1$2$3***' },
];

export function sanitize(text) {
  let result = text;
  for (const { re, replace } of patterns) {
    re.lastIndex = 0;
    result = result.replace(re, replace);
  }
  return result;
}
