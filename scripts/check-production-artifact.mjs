import { access, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
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
const forbidden = files.filter((file) =>
  file.endsWith('.map') || /(^|\/)golden(\/|$)/i.test(file) || /agent(-qc|_tasks)?\.md$/i.test(file),
);
if (forbidden.length) throw new Error(`Forbidden production files: ${forbidden.join(', ')}`);

const headers = await readFile(join(dist, '_headers'), 'utf8');
for (const header of ['Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) {
  if (!headers.includes(header)) throw new Error(`Missing security header: ${header}`);
}

const notices = await readFile(join(dist, 'licenses', 'THIRD_PARTY_NOTICES.txt'), 'utf8');
for (const name of requiredPackages) {
  if (!notices.includes(name)) throw new Error(`Missing runtime notice for ${name}`);
}

console.log(`Production artifact verified (${files.length} files).`);
