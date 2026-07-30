import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { cwd: root, encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);

const forbiddenPaths = [
  /(^|\/)\.env($|\.)/i,
  /(^|\/)\.dev\.vars$/i,
  /(^|\/)\.(agents|codex)(\/|$)/i,
  /(^|\/)(agent\.md|agents\.md|agent-qc\.md|agent_tasks\.md)$/i,
  /\.(key|pem|p12|pfx)$/i,
];

// Exclude generated legal text and this scanner's own signature definitions.
const contentExclusions = [
  /^THIRD_PARTY_NOTICES\.md$/,
  /^public\/licenses\//,
  /^scripts\/check-(?:confidentiality|production-artifact)\.mjs$/,
];

const signatures = [
  ['personal identity', /\b(?:samy|rekioua)\b/i],
  ['employer or customer name', /\b(?:netint|melexis)\b/i],
  ['Windows user path', /[A-Za-z]:\\Users\\[^\\\r\n]+\\/],
  ['Unix home path', /\/(?:home|Users)\/[^/\s]+\//],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[0-9A-Za-z]{20,}|github_pat_[0-9A-Za-z_]{20,})\b/],
  ['Slack token', /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/],
  ['credentialed URL', /https?:\/\/[^/@\s]+:[^/@\s]+@/],
  [
    'assigned credential',
    /(?:api[_-]?key|client[_-]?secret|password|passwd)\s*[:=]\s*["'][^"']{8,}["']/i,
  ],
];

const findings = [];
for (const file of files) {
  const normalized = file.replaceAll('\\', '/');
  if (forbiddenPaths.some((pattern) => pattern.test(normalized))) {
    findings.push(`${normalized}: forbidden public-tree path`);
  }
  if (contentExclusions.some((pattern) => pattern.test(normalized))) continue;

  let buffer;
  try {
    buffer = await readFile(resolve(root, file));
  } catch (error) {
    if (error?.code === 'ENOENT') continue;
    throw error;
  }
  if (buffer.includes(0)) continue;
  const content = buffer.toString('utf8');
  for (const [label, pattern] of signatures) {
    if (pattern.test(content)) findings.push(`${normalized}: ${label}`);
  }
}

if (findings.length) {
  throw new Error(`Confidentiality check failed:\n${findings.join('\n')}`);
}

console.log(`Confidentiality check passed (${files.length} public-tree files inspected).`);
