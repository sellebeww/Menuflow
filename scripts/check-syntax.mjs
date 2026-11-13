// Lint ringan tanpa dependency: setiap berkas JS harus lolos `node --check`.
import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dirs = ['app/js', 'site/js', 'tests', 'scripts'];
const files = ['dev.mjs'];
for (const d of dirs) for (const f of readdirSync(join(root, d)).sort()) {
  const p = join(d, f);
  if (statSync(join(root, p)).isFile() && ['.js', '.mjs'].includes(extname(f))) files.push(p);
}
let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', join(root, f)], { encoding: 'utf8' });
  if (r.status !== 0) { bad++; console.error(`GAGAL ${f}\n${r.stderr}`); }
}
console.log(`${files.length - bad}/${files.length} berkas lolos pemeriksaan sintaks`);
process.exit(bad ? 1 : 0);
