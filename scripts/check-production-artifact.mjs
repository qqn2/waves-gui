import { access, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const requiredPackages = [
  'wavedrom',
  '@codemirror/view',
  'lucide-react',
  'file-saver',
  'immer',
  'nanoid',
  'react',
  'react-dom',
  'use-debounce',
  'zustand',
];

async function walk(dir, prefix = '') {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...(await walk(join(dir, entry.name), relative)));
    else result.push(relative);
  }
  return result;
}

await access(join(dist, 'index.html'));
await access(join(dist, '_headers'));
await access(join(dist, 'licenses', 'THIRD_PARTY_NOTICES.txt'));
const files = await walk(dist);
const indexHtml = await readFile(join(dist, 'index.html'), 'utf8');
const expectedTitle = 'Waves GUI — WaveDrom and Undulate Timing Editor';
if (!indexHtml.includes(`<title>${expectedTitle}</title>`)) {
  throw new Error('Production title is missing or stale');
}
const forbidden = files.filter((file) =>
  /\.(map|key|pem|p12|pfx)$/i.test(file)
  || /(^|\/)(golden|fixtures?)(\/|$)/i.test(file)
  || /(^|\/)\.env($|\.)/i.test(file)
  || /(^|\/)\.(agents|codex|wrangler)(\/|$)/i.test(file)
  || /(^|\/)(agent\.md|agents\.md|agent-qc\.md|agent_tasks\.md)$/i.test(file),
);
if (forbidden.length) throw new Error(`Forbidden production files: ${forbidden.join(', ')}`);

const sensitiveArtifactPatterns = [
  /\b(?:samy|rekioua|netint|melexis)\b/i,
  /[A-Za-z]:\\Users\\[^\\\r\n]+\\/,
  /\/(?:home|Users)\/[^/\s]+\//,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  /\b(?:gh[pousr]_[0-9A-Za-z]{20,}|github_pat_[0-9A-Za-z_]{20,})\b/,
];
for (const file of files.filter((name) => !name.startsWith('licenses/'))) {
  const buffer = await readFile(join(dist, file));
  if (buffer.includes(0)) continue;
  const content = buffer.toString('utf8');
  if (sensitiveArtifactPatterns.some((pattern) => pattern.test(content))) {
    throw new Error(`Sensitive marker in production file: ${file}`);
  }
}

const textArtifacts = await Promise.all(
  files
    .filter((name) => /\.(?:html|js|css)$/i.test(name))
    .map((name) => readFile(join(dist, name), 'utf8')),
);
if (!textArtifacts.some((content) => content.includes(`Version ${version} · `))) {
  throw new Error('Production version/build marker is missing');
}

const headers = await readFile(join(dist, '_headers'), 'utf8');
for (const header of ['Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) {
  if (!headers.includes(header)) throw new Error(`Missing security header: ${header}`);
}

const notices = await readFile(join(dist, 'licenses', 'THIRD_PARTY_NOTICES.txt'), 'utf8');
for (const name of requiredPackages) {
  if (!notices.includes(name)) throw new Error(`Missing runtime notice for ${name}`);
}

console.log(`Production artifact verified (${files.length} files).`);
