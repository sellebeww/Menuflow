import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generatePreview, summarize, confirmAllocation, validateOverride, applyOverride, approvedIds, conflicts, capacityMap } from '../app/js/allocation.js';
import { rp } from '../app/js/ui.js';
import { menu, session, order, byId } from './helpers.mjs';

const A = menu('a'), B = menu('b'), C = menu('c');
const menus = [A, B, C];

describe('conflicts (batas keras)', () => {
  it('menu tidak ada atau nonaktif ditolak', () => {
    assert.deepEqual(conflicts(undefined, order('x')), ['Menu tidak lagi tersedia']);
    assert.deepEqual(conflicts(menu('z', { active: false }), order('x')), ['Menu dinonaktifkan']);
  });
  it('alergi pada menu yang mengandungnya ditolak, tanpa alergi lolos', () => {
    const egg = menu('e', { allergens: ['egg', 'soy'] });
    assert.deepEqual(conflicts(egg, order('x', { allergies: ['egg'] })), ['Mengandung Telur']);
    assert.deepEqual(conflicts(egg, order('x', { allergies: ['peanuts'] })), []);
    assert.deepEqual(conflicts(egg, order('x')), []);
  });
  it('info alergen tidak lengkap tidak pernah dianggap aman bila ada kebutuhan', () => {
    const unknown = menu('u', { allergensKnown: false });
    assert.equal(conflicts(unknown, order('x', { diet: ['vegetarian'] })).includes('Informasi bahan/alergen belum lengkap'), true);
    assert.equal(conflicts(unknown, order('x', { allergies: ['milk'] })).length > 0, true);
    assert.equal(conflicts(unknown, order('x', { otherAllergy: 'udang' })).length > 0, true);
    assert.deepEqual(conflicts(unknown, order('x')), []); // tanpa kebutuhan, tidak ada yang dilanggar
  });
  it('alergi lain dicocokkan pada bahan, tanpa peduli huruf besar dan spasi', () => {
    const m = menu('m', { ingredients: ['Udang', 'Nasi'] });
    assert.deepEqual(conflicts(m, order('x', { otherAllergy: '  UDANG ' })), ['Mengandung UDANG']);
    assert.deepEqual(conflicts(m, order('x', { otherAllergy: 'ikan' })), []);
  });
  it('alergi lain: teks dua huruf atau kurang pada bahan diabaikan', () => {
    const m = menu('m', { ingredients: ['Ab'] });
    assert.deepEqual(conflicts(m, order('x', { otherAllergy: 'ab' })), []);
  });
  it('diet: vegetarian, tanpa sapi, tanpa seafood, tidak pedas', () => {
    const beef = menu('b', { tags: ['beef', 'spicy'] }), veg = menu('v', { tags: ['vegetarian'] }), sea = menu('s', { tags: ['seafood'] });
    assert.deepEqual(conflicts(beef, order('x', { diet: ['vegetarian'] })), ['Bukan menu vegetarian']);
    assert.deepEqual(conflicts(veg, order('x', { diet: ['vegetarian'] })), []);
    assert.deepEqual(conflicts(beef, order('x', { diet: ['no-beef'] })), ['Bertentangan dengan Tanpa daging sapi']);
    assert.deepEqual(conflicts(beef, order('x', { diet: ['no-spicy'] })), ['Bertentangan dengan Tidak pedas']);
    assert.deepEqual(conflicts(sea, order('x', { diet: ['no-seafood'] })), ['Bertentangan dengan Tanpa seafood']);
  });
  it('pesanan tanpa kolom diet/alergi tidak membuat error', () => {
    assert.deepEqual(conflicts(A, { id: 'legacy' }), []);
  });
});

describe('approvedIds', () => {
  it('utama dulu, alternatif sesuai urutan pelanggan, utama tidak diulang', () => {
    assert.deepEqual(approvedIds(order('x', { primary: 'a', alts: ['b', 'a', 'c'] })), ['a', 'b', 'c']);
  });
});

describe('capacityMap', () => {
  const s = session({ a: 2, b: 1 });
  it('menghitung terpakai dari pesanan sesi ini yang punya menu final dan tidak dibatalkan', () => {
    const orders = [
      order('1', { status: 'confirmed', finalMenu: 'a' }),
      order('2', { status: 'ready', finalMenu: 'a' }),
      order('3', { status: 'cancelled', finalMenu: 'a' }),
      order('4', { status: 'confirmed', finalMenu: 'b', sessionId: 'lain' }),
      order('5', { status: 'pending' }),
    ];
    assert.deepEqual(capacityMap(s, orders), { a: { capacity: 2, used: 2, left: 0 }, b: { capacity: 1, used: 0, left: 1 } });
  });
  it('sesi tanpa menu menghasilkan peta kosong', () => {
    assert.deepEqual(capacityMap(session({}), []), {});
  });
});

describe('generatePreview', () => {
  it('tanpa pesanan: tidak ada baris dan ringkasan nol', () => {
    const s = session({ a: 3 });
    const rows = generatePreview(s, [], menus);
    assert.deepEqual(rows, []);
    assert.deepEqual(summarize(rows, s, []), { total: 0, matched: 0, alternative: 0, unresolved: 0, perMenu: { a: { capacity: 3, used: 0, left: 3, planned: 0, after: 3 } }, warnings: [] });
  });

  it('sesi tanpa menu: semua pesanan unresolved', () => {
    const rows = generatePreview(session({}), [order('1'), order('2')], menus);
    assert.deepEqual(rows.map(r => r.status), ['unresolved', 'unresolved']);
  });

  it('FIFO: yang lebih dulu memesan mendapat menu utama saat kapasitas terbatas', () => {
    const s = session({ a: 1, b: 5 });
    const orders = [order('late', { createdAt: 20, alts: ['b'] }), order('early', { createdAt: 10, alts: ['b'] })];
    const r = byId(generatePreview(s, orders, menus));
    assert.equal(r.early.menuId, 'a'); assert.equal(r.early.status, 'matched'); assert.equal(r.early.queue, 1);
    assert.equal(r.late.menuId, 'b'); assert.equal(r.late.status, 'alternative'); assert.equal(r.late.queue, 2);
  });

  it('imbang waktu diurutkan menurut id (deterministik)', () => {
    const s = session({ a: 1 });
    const orders = [order('SS-2', { createdAt: 5 }), order('SS-1', { createdAt: 5 })];
    const r = byId(generatePreview(s, orders, menus));
    assert.equal(r['SS-1'].menuId, 'a'); assert.equal(r['SS-2'].menuId, null);
  });

  it('pilihan utama semua orang dilayani sebelum alternatif siapa pun', () => {
    // B antre lebih dulu dari C. Alternatif B adalah menu utama C: C harus tetap mendapat menu utamanya.
    const s = session({ a: 1, b: 1 });
    const orders = [
      order('A1', { createdAt: 1, primary: 'a' }),
      order('B1', { createdAt: 2, primary: 'a', alts: ['b'] }),
      order('C1', { createdAt: 3, primary: 'b', alts: ['a'] }),
    ];
    const r = byId(generatePreview(s, orders, menus));
    assert.equal(r.A1.menuId, 'a'); assert.equal(r.C1.menuId, 'b');
    assert.equal(r.B1.menuId, null); assert.equal(r.B1.status, 'unresolved');
  });

  it('stok tidak cukup: tidak pernah melebihi kapasitas, sisanya unresolved dengan alasan', () => {
    const s = session({ a: 2 });
    const orders = ['1', '2', '3', '4'].map((i, n) => order(i, { createdAt: n }));
    const rows = generatePreview(s, orders, menus);
    assert.equal(rows.filter(r => r.menuId === 'a').length, 2);
    const un = rows.filter(r => r.status === 'unresolved');
    assert.equal(un.length, 2);
    assert.match(un[0].reason, /kapasitas penuh/);
    const sum = summarize(rows, s, orders);
    assert.equal(sum.perMenu.a.after, 0);
    assert.deepEqual(sum.warnings, []);
  });

  it('kapasitas 0 tidak pernah dialokasikan', () => {
    const rows = generatePreview(session({ a: 0 }), [order('1')], menus);
    assert.equal(rows[0].menuId, null);
  });

  it('pesanan terkonfirmasi memakai kapasitas, pesanan batal tidak', () => {
    const s = session({ a: 2 });
    const orders = [
      order('c1', { status: 'confirmed', finalMenu: 'a', createdAt: 1 }),
      order('x1', { status: 'cancelled', finalMenu: 'a', createdAt: 2 }),
      order('p1', { createdAt: 3 }), order('p2', { createdAt: 4 }),
    ];
    const r = byId(generatePreview(s, orders, menus));
    assert.equal(r.p1.menuId, 'a'); assert.equal(r.p2.menuId, null);
    assert.equal(r.c1, undefined); assert.equal(r.x1, undefined);
  });

  it('hanya pesanan pending/unresolved dari sesi ini yang masuk antrean', () => {
    const s = session({ a: 9 });
    const orders = [
      order('ok', { status: 'unresolved' }), order('done', { status: 'completed', finalMenu: 'a' }),
      order('other', { sessionId: 'lain' }), order('ready', { status: 'ready', finalMenu: 'a' }),
    ];
    assert.deepEqual(generatePreview(s, orders, menus).map(r => r.orderId), ['ok']);
  });

  it('menu yang tidak ada di sesi tidak dialokasikan; alternatif dalam sesi dipakai', () => {
    const s = session({ b: 1 });
    const r = byId(generatePreview(s, [order('1', { primary: 'a', alts: ['b'] }), order('2', { primary: 'a' })], menus));
    assert.equal(r['1'].menuId, 'b');
    assert.match(r['2'].reason, /tidak ada di sesi ini/);
  });

  it('alergi mengalahkan antrean dan kapasitas: menu aman berikutnya dipilih atau unresolved', () => {
    const egg = menu('a', { allergens: ['egg'] });
    const s = session({ a: 5, b: 5 });
    const orders = [order('1', { allergies: ['egg'], alts: ['b'] }), order('2', { allergies: ['egg'] })];
    const r = byId(generatePreview(s, orders, [egg, B]));
    assert.equal(r['1'].menuId, 'b');
    assert.equal(r['2'].menuId, null);
    assert.match(r['2'].reason, /Mengandung Telur/);
  });

  it('alternatif ganda atau berisi menu utama tidak menggandakan alokasi', () => {
    const s = session({ a: 1, b: 1 });
    const o = order('1', { primary: 'a', alts: ['a', 'b', 'b'] });
    const rows = generatePreview(s, [o], menus);
    assert.equal(rows.length, 1); assert.equal(rows[0].menuId, 'a');
    const rows2 = generatePreview(s, [order('1', { primary: 'a' }), order('2', { primary: 'a', alts: ['a', 'b', 'b'] })], menus);
    assert.equal(rows2.filter(r => r.menuId === 'b').length, 1);
  });

  it('alternatif dicoba menurut urutan pelanggan', () => {
    const s = session({ b: 1, c: 1 });
    const rows = generatePreview(s, [order('1', { primary: 'a', alts: ['c', 'b'] })], menus);
    assert.equal(rows[0].menuId, 'c');
  });

  it('tidak mengubah masukan dan hasilnya sama untuk urutan masukan berbeda', () => {
    const s = session({ a: 2, b: 2, c: 1 });
    const orders = [
      order('1', { createdAt: 4, primary: 'a', alts: ['b'] }), order('2', { createdAt: 1, primary: 'a', alts: ['c'] }),
      order('3', { createdAt: 3, primary: 'b', alts: ['a'] }), order('4', { createdAt: 2, primary: 'a', alts: ['b', 'c'] }),
      order('5', { createdAt: 5, primary: 'c', alts: ['a'] }),
    ];
    const snapshot = JSON.stringify(orders);
    const first = generatePreview(s, orders, menus);
    assert.equal(JSON.stringify(orders), snapshot);
    const second = generatePreview(s, [...orders].reverse(), menus);
    assert.deepEqual(byId(second), byId(first));
    assert.deepEqual(generatePreview(s, orders, menus), first);
  });
});

describe('validateOverride', () => {
  const s = session({ a: 1, b: 1 });
  const orders = [order('1', { primary: 'a', alts: ['b'] }), order('2', { primary: 'a' })];
  const rows = generatePreview(s, orders, menus); // 1 -> a, 2 -> unresolved

  it('null (biarkan unresolved) selalu boleh', () => assert.deepEqual(validateOverride(rows, orders, s, menus, '1', null), { ok: true }));
  it('pesanan tak dikenal', () => assert.equal(validateOverride(rows, orders, s, menus, 'zz', 'a').ok, false));
  it('menu yang tidak disetujui pelanggan ditolak', () => assert.match(validateOverride(rows, orders, s, menus, '2', 'b').error, /tidak disetujui/));
  it('menu yang melanggar alergi ditolak', () => {
    const egg = menu('a', { allergens: ['egg'] });
    const o = [order('1', { allergies: ['egg'] })];
    assert.match(validateOverride([], o, s, [egg, B], '1', 'a').error, /Melanggar kebutuhan makanan/);
  });
  it('kapasitas dihitung termasuk baris rencana lain', () => assert.match(validateOverride(rows, orders, s, menus, '2', 'a').error, /Kapasitas menu terlampaui/));
  it('baris miliknya sendiri tidak dihitung ganda', () => assert.equal(validateOverride(rows, orders, s, menus, '1', 'a').ok, true));
  it('pindah ke alternatif yang masih lega diterima', () => assert.equal(validateOverride(rows, orders, s, menus, '1', 'b').ok, true));
  it('menu di luar sesi ditolak', () => {
    const o = [order('1', { primary: 'a', alts: ['c'] })];
    assert.match(validateOverride([], o, s, menus, '1', 'c').error, /tidak ada di sesi/);
  });
});

describe('applyOverride', () => {
  const orders = [order('1', { primary: 'a', alts: ['b'] })];
  const rows = [{ orderId: '1', queue: 1, primary: 'a', menuId: 'a', status: 'matched', reason: '' }];
  it('ke alternatif menandai alternative dan manual, tanpa mengubah masukan', () => {
    const out = applyOverride(rows, '1', 'b', orders);
    assert.equal(out[0].status, 'alternative'); assert.equal(out[0].manual, true); assert.equal(rows[0].menuId, 'a');
  });
  it('ke menu utama menandai matched', () => assert.equal(applyOverride(rows, '1', 'a', orders)[0].status, 'matched'));
  it('null mengembalikan ke unresolved', () => {
    const out = applyOverride(rows, '1', null, orders)[0];
    assert.equal(out.menuId, null); assert.equal(out.status, 'unresolved');
  });
});

describe('summarize', () => {
  it('menghitung per status dan memberi peringatan bila rencana melebihi kapasitas', () => {
    const s = session({ a: 1 });
    const rows = [
      { orderId: '1', menuId: 'a', status: 'matched' }, { orderId: '2', menuId: 'a', status: 'alternative' }, { orderId: '3', menuId: null, status: 'unresolved' },
    ];
    const sum = summarize(rows, s, []);
    assert.equal(sum.total, 3); assert.equal(sum.matched, 1); assert.equal(sum.alternative, 1); assert.equal(sum.unresolved, 1);
    assert.equal(sum.perMenu.a.after, -1);
    assert.deepEqual(sum.warnings, [{ menuId: 'a', text: 'Kapasitas terlampaui.' }]);
  });
});

describe('confirmAllocation', () => {
  const s = session({ a: 1, b: 1 });
  const orders = [order('1', { primary: 'a', alts: ['b'] }), order('2', { primary: 'a', alts: ['b'] }), order('3', { primary: 'a' })];
  const A25 = menu('a', { price: 25000 }), B27 = menu('b', { price: 27000 });
  const ms = [A25, B27, C];

  it('menerapkan hasil, menyimpan harga final, dan tidak mengubah masukan', () => {
    const rows = generatePreview(s, orders, ms);
    const snapshot = JSON.stringify(orders);
    const out = confirmAllocation(s, orders, ms, rows);
    assert.equal(JSON.stringify(orders), snapshot);
    const o = byId(out.map(x => ({ ...x, orderId: x.id })));
    assert.deepEqual([o['1'].status, o['1'].finalMenu, o['1'].finalPrice, o['1'].allocationType], ['confirmed', 'a', 25000, 'matched']);
    assert.deepEqual([o['2'].status, o['2'].finalMenu, o['2'].finalPrice, o['2'].allocationType], ['confirmed', 'b', 27000, 'alternative']);
    assert.deepEqual([o['3'].status, o['3'].finalMenu, o['3'].allocationType], ['unresolved', null, 'unresolved']);
    for (const m of ['a', 'b']) assert.ok(capacityMap(s, out)[m].left >= 0);
  });

  it('menolak baris yang dimanipulasi: menu tidak disetujui, melanggar alergi, melebihi kapasitas', () => {
    const rows = generatePreview(s, orders, ms);
    assert.throws(() => confirmAllocation(s, orders, ms, rows.map(r => r.orderId === '3' ? { ...r, menuId: 'b' } : r)), /tidak disetujui/);
    const egg = [menu('a', { allergens: ['egg'] }), B27];
    const eggOrders = [order('1', { primary: 'a', allergies: ['egg'] })];
    assert.throws(() => confirmAllocation(s, eggOrders, egg, [{ orderId: '1', menuId: 'a', status: 'matched' }]), /Telur/);
    assert.throws(() => confirmAllocation(s, orders, ms, [{ orderId: '1', menuId: 'a' }, { orderId: '2', menuId: 'a' }]), /Kapasitas terlampaui/);
  });

  it('karakterisasi: orderId ganda dihitung dua kali terhadap kapasitas (melempar)', () => {
    assert.throws(() => confirmAllocation(s, orders, ms, [{ orderId: '1', menuId: 'a' }, { orderId: '1', menuId: 'a' }]), /Kapasitas terlampaui/);
  });

  it('karakterisasi: orderId tak dikenal melempar TypeError, bukan mengalokasikan', () => {
    assert.throws(() => confirmAllocation(s, orders, ms, [{ orderId: 'hantu', menuId: 'a' }]), TypeError);
  });

  it('baris tanpa pesanan terkait tidak mengubah pesanan lain', () => {
    const out = confirmAllocation(s, orders, ms, []);
    assert.deepEqual(out, orders);
  });
});

describe('format uang (locale eksplisit)', () => {
  it('rp memakai id-ID apa pun locale proses', () => {
    assert.equal(rp(25000), 'Rp25.000');
    assert.equal(rp(0), 'Rp0');
    assert.equal(rp(1234567), 'Rp1.234.567');
    assert.equal(rp('27000'), 'Rp27.000');
  });
});
