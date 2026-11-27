// Copies the sql.js WebAssembly build into public/vendor/sql.js so the browser can
// load it from /vendor/sql.js/ (see src/storage/sqljs.mjs). Runs after npm install
// and before dev/build. public/vendor is generated, so it is not committed.
import {copyFile, mkdir, stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['sql-wasm.js', 'sql-wasm.wasm'];

function findDist() {
  let entry;
  try { entry = createRequire(import.meta.url).resolve('sql.js'); } catch { return null; }
  // The package entry is dist/sql-wasm.js; walk up in case that ever changes.
  for (let dir = dirname(entry); dir !== dirname(dir); dir = dirname(dir)) {
    for (const candidate of [dir, join(dir, 'dist')]) {
      if (files.every(file => existsSync(join(candidate, file)))) return candidate;
    }
    if (existsSync(join(dir, 'package.json')) && dir.endsWith('sql.js')) break;
  }
  return null;
}

const dist = findDist();
if (!dist) {
  console.warn('sql.js is not installed yet; run `npm install` to enable the local game database.');
  process.exit(0);
}
const target = join(root, 'public', 'vendor', 'sql.js');
await mkdir(target, {recursive: true});
for (const file of files) {
  const from = join(dist, file), to = join(target, file);
  const [source, copy] = await Promise.all([stat(from), stat(to).catch(() => null)]);
  if (!copy || copy.size !== source.size || copy.mtimeMs < source.mtimeMs) await copyFile(from, to);
}
console.log('sql.js: copied to public/vendor/sql.js');
