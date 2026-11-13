import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeSeed } from '../app/js/data.js';
import { generatePreview, confirmAllocation } from '../app/js/allocation.js';
import { buildPlan, planText, barPercent, orderNotes } from '../app/js/production.js';
import { menu, session, order } from './helpers.mjs';

const A = menu('a', { name: 'Menu A Rice', short: 'Menu A' }), B = menu('b', { name: 'Menu B Rice', short: 'Menu B' });
const done = (id, finalMenu, over = {}) => order(id, { status: 'confirmed', finalMenu, ...over });

describe('karakterisasi terhadap perilaku aplikasi sebelum ekstraksi', () => {
  // Acuan diambil dari berkas unduhan aplikasi asli (seed demo setelah alokasi dikonfirmasi); tanggal sesi dikunci.
  const seed = makeSeed();
  const s = seed.sessions[0];
  s.date = '2026-01-15';
  const orders = confirmAllocation(s, seed.orders, seed.menus, generatePreview(s, seed.orders, seed.menus));
  const plan = buildPlan(s, orders, seed.menus);

  it('angka seed: 45 terkonfirmasi dari kapasitas 50, per menu 20/15/10', () => {
    assert.equal(plan.total, 45); assert.equal(plan.totalCapacity, 50); assert.equal(plan.remaining, 5);
    assert.deepEqual(plan.lines.map(l => [l.name, l.used, l.capacity]), [['Chicken Teriyaki Rice', 20, 20], ['Beef Black Pepper Rice', 15, 15], ['Chicken Katsu Rice', 10, 15]]);
    assert.deepEqual(plan.notes.map(n => n.shortId), ['007', '012', '024']);
    assert.deepEqual(plan.pickup, { confirmed: 45, ready: 0, completed: 0 });
  });

  it('teks unduhan sama persis dengan berkas acuan', () => {
    assert.equal(planText(plan), readFileSync(new URL('./fixtures/production-summary.golden.txt', import.meta.url), 'utf8'));
  });
});

describe('buildPlan', () => {
  it('kosong: tanpa pesanan terkonfirmasi', () => {
    const p = buildPlan(session({ a: 3, b: 2 }), [order('1')], [A, B]);
    assert.equal(p.total, 0); assert.equal(p.totalCapacity, 5); assert.equal(p.remaining, 5);
    assert.deepEqual(p.lines.map(l => l.used), [0, 0]); assert.deepEqual(p.notes, []);
  });

  it('sesi tanpa menu dan tanpa pesanan', () => {
    const p = buildPlan(session({}), [], []);
    assert.deepEqual([p.total, p.totalCapacity, p.remaining, p.lines.length], [0, 0, 0, 0]);
  });

  it('mengabaikan pesanan batal, sesi lain, dan yang belum punya menu final', () => {
    const orders = [done('1', 'a'), done('2', 'a', { status: 'cancelled' }), done('3', 'a', { sessionId: 'lain' }), order('4', { status: 'unresolved' }), order('5')];
    const p = buildPlan(session({ a: 5 }), orders, [A]);
    assert.equal(p.total, 1); assert.equal(p.lines[0].used, 1);
  });

  it('menghitung status pengambilan', () => {
    const orders = [done('1', 'a'), done('2', 'a', { status: 'ready' }), done('3', 'b', { status: 'ready' }), done('4', 'b', { status: 'completed' })];
    assert.deepEqual(buildPlan(session({ a: 5, b: 5 }), orders, [A, B]).pickup, { confirmed: 1, ready: 2, completed: 1 });
  });

  it('pesanan ganda untuk menu yang sama dijumlahkan, id ganda tidak dibuang', () => {
    const orders = [done('1', 'a'), done('1', 'a')];
    assert.equal(buildPlan(session({ a: 5 }), orders, [A]).total, 2);
  });

  it('catatan hanya untuk pesanan dengan diet/alergi/alergi lain/catatan, label dari kamus', () => {
    const orders = [
      done('SS-2026-001', 'a'),
      done('SS-2026-002', 'a', { diet: ['no-beef'], allergies: ['egg'], otherAllergy: 'udang', notes: 'tanpa sambal', customerName: 'Rina' }),
      done('SS-2026-003', 'b', { notes: 'cepat' }),
    ];
    const p = buildPlan(session({ a: 5, b: 5 }), orders, [A, B]);
    assert.equal(p.notes.length, 2);
    assert.deepEqual(p.notes[0], { id: 'SS-2026-002', shortId: '002', customerName: 'Rina', menu: 'Menu A', diet: ['Tanpa daging sapi'], allergies: ['Telur'], other: 'udang', note: 'tanpa sambal' });
    assert.equal(p.notes[1].menu, 'Menu B');
  });

  it('pesanan lama tanpa kolom diet/alergi tidak membuat error', () => {
    const legacy = { id: 'SS-2026-009', sessionId: 's1', status: 'confirmed', finalMenu: 'a', customerName: 'Lama' };
    const p = buildPlan(session({ a: 5 }), [legacy], [A]);
    assert.equal(p.total, 1); assert.deepEqual(p.notes, []);
    assert.deepEqual(orderNotes(legacy), { diet: [], allergies: [], other: '', note: '' });
  });

  it('kunci diet/alergen yang tidak dikenal ditampilkan apa adanya, bukan dibuang', () => {
    assert.deepEqual(orderNotes({ diet: ['halal'], allergies: ['kiwi'] }), { diet: ['halal'], allergies: ['kiwi'], other: '', note: '' });
  });

  it('menu final yang sudah dihapus dari katalog diberi label "(dihapus)"', () => {
    const p = buildPlan(session({ a: 5 }), [done('SS-2026-001', 'a', { notes: 'x' })], []);
    assert.equal(p.notes[0].menu, '(dihapus)'); assert.equal(p.lines[0].name, '');
  });

  it('karakterisasi (temuan L4): total ikut menghitung pesanan yang menu finalnya bukan lagi menu sesi', () => {
    const orders = [done('1', 'a'), done('2', 'hilang')];
    const p = buildPlan(session({ a: 5 }), orders, [A]);
    assert.equal(p.total, 2); assert.equal(p.lines.reduce((x, l) => x + l.used, 0), 1);
  });

  it('karakterisasi (temuan L5): terkonfirmasi melebihi kapasitas menghasilkan sisa negatif dan bilah 100%', () => {
    const p = buildPlan(session({ a: 1 }), [done('1', 'a'), done('2', 'a')], [A]);
    assert.equal(p.remaining, -1); assert.equal(p.lines[0].percent, 100);
  });

  it('tidak mengubah masukan', () => {
    const orders = [done('1', 'a', { diet: ['vegetarian'] })], s = session({ a: 2 });
    const snap = JSON.stringify([orders, s]);
    planText(buildPlan(s, orders, [A]));
    assert.equal(JSON.stringify([orders, s]), snap);
  });
});

describe('barPercent (pembulatan dan tepi)', () => {
  it('nilai biasa tidak dibulatkan oleh fungsi ini', () => {
    assert.equal(barPercent(0, 20), 0); assert.equal(barPercent(10, 20), 50); assert.equal(barPercent(20, 20), 100);
    assert.ok(Math.abs(barPercent(1, 3) - 33.3333333) < 1e-6);
  });
  it('kapasitas 0, negatif, atau bukan angka tidak menghasilkan NaN/Infinity', () => {
    assert.equal(barPercent(0, 0), 0); assert.equal(barPercent(3, 0), 100); assert.equal(barPercent(3, -1), 100);
    assert.equal(barPercent(3, NaN), 100); assert.equal(barPercent(0, undefined), 0);
  });
  it('dibatasi 0..100', () => { assert.equal(barPercent(30, 20), 100); assert.equal(barPercent(-5, 20), 0); });
});

describe('planText', () => {
  it('tanpa catatan: bagian catatan tetap ada tetapi kosong', () => {
    const t = planText(buildPlan(session({ a: 3 }), [done('1', 'a')], [A]));
    assert.match(t, /Menu A Rice: 1 \/ 3 portions\nTOTAL: 1 portions\n\nSpecial dietary notes:\n\nAllergen info/);
  });
  it('catatan memakai awalan Allergy dan menggabung dengan koma', () => {
    const o = done('SS-2026-001', 'a', { customerName: 'Rina', diet: ['no-spicy'], allergies: ['milk'], notes: 'x' });
    assert.match(planText(buildPlan(session({ a: 3 }), [o], [A])), /- SS-2026-001 Rina \(Menu A\): Tidak pedas, Allergy Susu, x/);
  });
  it('tidak bergantung zona waktu atau locale: tanggal sesi dicetak apa adanya', () => {
    assert.match(planText(buildPlan(session({ a: 1 }, { date: '2026-12-31' }), [], [A])), /Makan Siang - 2026-12-31\nPickup: 12:00-13:30 @ Counter A/);
  });
});
