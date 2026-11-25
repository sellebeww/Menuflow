// End-to-end tests with zero dependencies: Node 22+ (global WebSocket) drives a local Chrome/Chromium
// over the DevTools protocol. Set CHROME=/path/to/chrome if it is not found automatically.
// shortcut: no screenshots/traces/retries; move to @playwright/test if the suite grows.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const APP_PORT = 5199, CDP_PORT = 9333;
const base = `http://localhost:${APP_PORT}/app/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CANDIDATES = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const chromePath = CANDIDATES.find(p => p && existsSync(p));
if (!chromePath) { console.error('Chrome/Chromium tidak ditemukan. Atur CHROME=/path/ke/chrome.'); process.exit(2); }

const procs = [];
const profile = mkdtempSync(join(tmpdir(), 'menuflow-e2e-'));
let cleaned = false;
const cleanup = () => { if (cleaned) return; cleaned = true; procs.forEach(p => p.kill()); try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* temp dir: the OS cleans it */ } };
process.on('exit', cleanup);

procs.push(spawn(process.execPath, [join(root, 'dev.mjs')], { env: { ...process.env, PORT: APP_PORT }, stdio: 'ignore' }));
procs.push(spawn(chromePath, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--no-sandbox', 'about:blank'], { stdio: 'ignore' }));

async function until(fn, what, ms = 10000) {
  const end = Date.now() + ms; let last;
  while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch (e) { last = e; } await sleep(100); }
  throw new Error(`Timeout menunggu ${what}${last ? `: ${last.message}` : ''}`);
}

const target = await until(async () => {
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
  return list.find(t => t.type === 'page');
}, 'Chrome');
await until(() => fetch(base).then(r => r.ok), 'server dev');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = ({ data }) => { const m = JSON.parse(data); const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });

/** Evaluate an expression in the page and return its value. */
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
const q = sel => JSON.stringify(sel);
const exists = sel => ev(`!!document.querySelector(${q(sel)})`);
const text = sel => ev(`document.querySelector(${q(sel)})?.textContent ?? ''`);
const waitFor = (sel, ms) => until(() => exists(sel), sel, ms);
const click = async sel => { await waitFor(sel); await ev(`document.querySelector(${q(sel)}).click()`); };
const act = (name, extra = '') => click(`[data-act="${name}"]${extra}`);
const hash = () => ev('location.hash');
const overflow = () => ev('document.documentElement.scrollWidth - document.documentElement.clientWidth');
async function open(path = '') { await send('Page.navigate', { url: base + path }); await until(() => ev('document.readyState === "complete"'), 'load'); }
async function fresh() { await open(); await ev('localStorage.clear()'); await open(); }
async function viewport(width, height = 800) { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 }); }

await send('Page.enable'); await send('Runtime.enable');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push([name, null]); console.log(`  ok   ${name}`); }
  catch (e) { results.push([name, e]); console.log(`  FAIL ${name}\n       ${e.message}`); }
}

/** Merchant flow shared by several tests: allocate and publish the demo session. */
async function publishAllocation() {
  await act('enter', '[data-role="m"]');
  await until(async () => (await hash()) === '#/m/overview', 'ringkasan merchant');
  await ev(`location.hash = '#/m/allocation'`);
  await act('generatePreview');
  if (await until(() => exists('[data-act="runPreview"]'), 'dialog konfirmasi', 1500).catch(() => false)) await act('runPreview');
  await act('toReview');
  await act('askPublish');
  await act('doPublish');
  await until(async () => (await hash()) === '#/m/production', 'Rencana Produksi', 15000);
}

console.log('Menuflow e2e');
await viewport(1280);

await test('layar peran menawarkan sisi pelanggan dan merchant', async () => {
  await fresh();
  assert.equal(await text('h1'), 'Pilih sisi yang ingin kamu coba');
  assert.ok(await exists('[data-role="c"]') && await exists('[data-role="m"]'));
});

await test('masuk sebagai pelanggan membuka alur pelanggan', async () => {
  await fresh();
  await act('enter', '[data-role="c"]');
  await until(async () => (await hash()).startsWith('#/c/'), 'rute pelanggan');
});

await test('alokasi: pratinjau, tinjau, publikasi, lalu Rencana Produksi berisi data', async () => {
  await fresh();
  await publishAllocation();
  assert.equal(await text('h1'), 'Rencana Produksi');
  assert.match(await text('.m-content'), /Chicken Teriyaki/);
  assert.ok(await exists('[data-act="printPlan"]') && await exists('[data-act="downloadPlan"]'));
});

await test('Rencana Produksi tidak meluap horizontal pada 360px dan 768px', async () => {
  for (const w of [360, 768]) { await viewport(w); await sleep(150); assert.ok((await overflow()) <= 0, `meluap ${await overflow()}px pada ${w}px`); }
  await viewport(1280);
});

await test('tampilan cetak menyembunyikan sidebar dan tombol', async () => {
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  const hidden = await ev(`['.m-side', '[data-act="printPlan"]'].every(s => { const el = document.querySelector(s); return !el || getComputedStyle(el).display === 'none'; })`);
  await send('Emulation.setEmulatedMedia', { media: '' });
  assert.ok(hidden, 'sidebar atau tombol masih terlihat saat cetak');
});

await test('kapasitas menu tidak bisa diturunkan di bawah porsi terkonfirmasi (L5)', async () => {
  await fresh();
  // Arrange: with the seeded confirmed order, two Katsu portions are confirmed in the open session.
  await open('#/m/menus');
  await ev(`import('./js/store.js').then(m => m.mutate(s => s.orders.slice(0, 1).forEach(o => Object.assign(o, { status: 'confirmed', finalMenu: 'm-katsu', finalPrice: 25000 }))))`);
  await until(() => exists('[data-act="editMenu"][data-id="m-katsu"]'), 'daftar menu');
  await ev(`(() => { const b = document.querySelector('[data-act="editMenu"][data-id="m-katsu"]'); b.focus(); b.click(); })()`);
  await waitFor('form[data-form="menu"]');
  const submit = cap => ev(`(() => { const f = document.querySelector('form[data-form="menu"]'); f.querySelector('[name="capacity"]').value = '${cap}'; f.requestSubmit(); })()`);
  await submit(1);
  await until(async () => /di bawah 2/.test(await text('#form-err')), 'pesan galat kapasitas');
  assert.ok(await exists('.modal'), 'dialog harus tetap terbuka');
  await submit(2); // exactly the confirmed count is allowed
  await until(async () => !(await exists('.modal')), 'dialog tertutup setelah simpan');
});

await test('Escape menutup dialog dan fokus kembali ke pemicunya', async () => {
  await ev(`(() => { const b = document.querySelector('[data-act="editMenu"][data-id="m-katsu"]'); b.focus(); b.click(); })()`);
  await waitFor('.modal');
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await until(async () => !(await exists('.modal')), 'dialog tertutup');
  assert.ok(await ev(`document.activeElement?.dataset?.act === 'editMenu'`), 'fokus tidak kembali');
});

ws.close(); cleanup();
const failed = results.filter(([, e]) => e);
console.log(`\n${results.length - failed.length}/${results.length} tes e2e lulus`);
process.exit(failed.length ? 1 : 0);
