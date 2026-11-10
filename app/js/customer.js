import { getState, mutate, quiet, menuOf, sessionOf, orderOf, effStatus, cutoffTs, simNow, notify, nextOrderId } from './store.js';
import { esc, rp, hm, clock, dateLong, dateShort, ago, icon, dish, badge, statusBadge, STATUS, openModal, closeModal, toast, confirmDialog } from './ui.js';
import { conflicts, ALLERGENS, DIET, approvedIds } from './allocation.js';
import { actions, go } from './actions.js';

const CUSTOMER_ID = 'c-mori';
const mine = () => getState().orders.filter(o => o.customerId === CUSTOMER_ID).sort((a, b) => b.createdAt - a.createdAt);
const SESSION_LABEL = { open: ['Dibuka', 'ok'], closing: ['Segera ditutup', 'warn'], closed: ['Ditutup', 'neutral'], allocating: ['Sedang dialokasikan', 'info'], completed: ['Ditutup', 'neutral'] };
const sessBadge = s => { const [t, k] = SESSION_LABEL[effStatus(s)] || ['Ditutup', 'neutral']; return badge(t, k, k === 'ok' ? 'check' : k === 'warn' ? 'clock' : k === 'info' ? 'refresh' : 'ban'); };
const publicSessions = () => getState().sessions.filter(s => s.status !== 'draft');
const canOrder = s => ['open', 'closing'].includes(effStatus(s));
const activeOrderFor = sid => mine().find(o => o.sessionId === sid && o.status !== 'cancelled');
const priceRange = s => { const p = s.menus.map(m => menuOf(m.menuId)?.price).filter(Boolean); const a = Math.min(...p), b = Math.max(...p); return a === b ? rp(a) : `${rp(a)} – ${rp(b)}`; };
const countdown = s => `<span class="countdown" data-countdown="${cutoffTs(s)}">--:--:--</span>`;

export function profileReq(draft) { return { diet: draft.diet, allergies: draft.allergies, otherAllergy: draft.otherAllergy }; }
const chips = m => (m.allergensKnown ? (m.allergens.length ? m.allergens.map(a => `<span class="chip">${esc(ALLERGENS[a] || a)}</span>`).join('') : '<span class="chip">Tanpa alergen utama</span>') : `<span class="chip warn">${icon('alert', 12)} Info alergen belum lengkap</span>`);

/* ---------- shell pieces ---------- */
export function topbar(title, back) {
  return `<header class="c-top">${back ? `<button class="icon-btn" data-act="nav" data-to="${back}" aria-label="Kembali">${icon('left')}</button>` : '<span></span>'}<h1 class="c-title">${esc(title)}</h1><span class="w40"></span></header>`;
}
const unread = () => getState().notifications.filter(n => n.to === 'customer' && !n.read).length;
const bell = () => `<button class="icon-btn bell" data-act="openNotifs" aria-label="Notifikasi, ${unread()} belum dibaca">${icon('bell')}${unread() ? `<span class="dot">${unread()}</span>` : ''}</button>`;

/* ---------- onboarding ---------- */
const OB = [
  ['Lebih Banyak Pilihan, Lebih Sedikit Sisa.', 'Pilih beberapa menu yang kamu sukai agar dapur dapat mempersiapkan makanan dengan lebih tepat.', 'utensils'],
  ['Seleramu Tetap Diutamakan.', 'Alternatif yang kamu pilih tetap harus sesuai dengan selera, alergi, dan kebutuhan makananmu.', 'shield'],
  ['Menu Final Dikonfirmasi untukmu.', 'Kamu akan menerima menu final setelah proses alokasi selesai.', 'check'],
];
export function onboarding(step) {
  const i = Math.min(2, Math.max(0, +step - 1 || 0)), [t, d, ic] = OB[i];
  return `<section class="ob"><button class="link skip" data-act="skipOnboarding">Lewati</button>
  <div class="ob-art" data-ob="${i}">${i === 0 ? dish('teriyaki') : i === 1 ? `<div class="ob-shield">${icon('shield', 64)}</div>` : `<div class="ob-shield ok">${icon('check', 64)}</div>`}</div>
  <h1>${t}</h1><p class="muted">${d}</p>
  <div class="dots" aria-label="Halaman ${i + 1} dari 3">${[0, 1, 2].map(k => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
  <button class="btn btn-primary btn-block" data-act="${i === 2 ? 'skipOnboarding' : 'nav'}" data-to="#/c/onboarding/${i + 2}">${i === 2 ? 'Mulai Sekarang' : 'Lanjut'}</button></section>`;
}

/* ---------- home ---------- */
const greeting = () => { const h = simNow().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; };
export function home() {
  const st = getState(), s = st.sessions.find(x => x.id === 's1');
  const mo = activeOrderFor(s.id), recent = mine().slice(0, 2);
  return `<section class="pad">
  <div class="row between"><div><h1 class="hello">${greeting()}, ${esc(st.customer.name)}!</h1><p class="muted">Siap memilih menu hari ini?</p></div>${bell()}</div>
  <div class="meta-row"><span>${icon('pin', 14)} Menuflow Campus Canteen</span><span>${icon('calendar', 14)} ${dateShort(simNow())}</span><span>${icon('clock', 14)} ${clock(simNow())} <em class="demo">demo</em></span></div>
  <h2 class="sec">Sesi Makan Hari Ini</h2>
  <article class="card session-hero">
    <div class="row between"><div><div class="eyebrow">Menuflow Campus Canteen</div><h3>${esc(s.name)}</h3></div>${sessBadge(s)}</div>
    <dl class="facts"><div><dt>Pengambilan</dt><dd>${hm(s.pickupStart)}–${hm(s.pickupEnd)}</dd></div><div><dt>Batas pilih</dt><dd>${hm(s.cutoff)}</dd></div><div><dt>Sisa waktu</dt><dd>${canOrder(s) ? countdown(s) : 'Ditutup'}</dd></div></dl>
    ${mo ? `<button class="btn btn-block" data-act="nav" data-to="#/c/status/${mo.id}">Lihat Pesanan ${mo.id}</button>` : canOrder(s) ? `<button class="btn btn-primary btn-block" data-act="startOrder" data-sid="${s.id}">Pilih Menu ${icon('arrow', 18)}</button>` : `<button class="btn btn-block" disabled>Pemesanan ditutup</button>`}
  </article>
  <h2 class="sec">Cara Kerja Pesan Fleksibel</h2>
  <ol class="steps">${[['Pilih satu menu utama', 'Pilih menu yang paling kamu inginkan.'], ['Tambahkan alternatif', 'Pilih menu lain yang tetap kamu terima.'], ['Terima menu final', 'Menu finalmu salah satu dari yang kamu setujui.']].map((x, i) => `<li><b>${i + 1}</b><div><strong>${x[0]}</strong><span>${x[1]}</span></div></li>`).join('')}</ol>
  <div class="row between"><h2 class="sec">Pesanan Terbaru</h2><button class="link" data-act="nav" data-to="#/c/history">Lihat semua</button></div>
  ${recent.map(orderRow).join('') || empty('Belum ada pesanan', 'Pesanan pertamamu akan muncul di sini.')}
  </section>`;
}
const empty = (t, d) => `<div class="empty">${icon('utensils', 28)}<strong>${t}</strong><span>${d}</span></div>`;
function orderRow(o) {
  const final = o.finalMenu ? menuOf(o.finalMenu)?.name : null;
  return `<button class="order-row" data-act="nav" data-to="#/c/status/${o.id}"><div class="grow"><div class="row between"><b>${o.id}</b>${statusBadge(o.status)}</div>
  <div class="muted sm">${dateShort(o.date)} · ${esc(o.canteen)}</div><div class="sm">${final ? esc(final) : `Pilihan utama: ${esc(menuOf(o.primary)?.name || '-')}`}${o.finalPrice ? ` · ${rp(o.finalPrice)}` : ''}</div></div>${icon('right', 18)}</button>`;
}

/* ---------- sessions ---------- */
export function sessions() {
  const list = publicSessions();
  return `${topbar('Sesi Makan Tersedia')}<section class="pad"><p class="muted">Pilih sesi, lalu tentukan menu yang bersedia kamu terima.</p>
  ${list.map(s => {
    const first = menuOf(s.menus[0]?.menuId), n = s.menus.filter(m => menuOf(m.menuId)?.active).length;
    return `<article class="card sess">${dish(first?.art || 'generic', 'cover')}<div class="sess-body">
    <div class="row between"><div><div class="eyebrow">Menuflow Campus Canteen</div><h3>${esc(s.name)}</h3></div>${sessBadge(s)}</div>
    <ul class="meta-list"><li>${icon('clock', 14)} Pengambilan ${hm(s.pickupStart)}–${hm(s.pickupEnd)}</li><li>${icon('calendar', 14)} Pemesanan tutup ${hm(s.cutoff)}</li><li>${icon('utensils', 14)} ${n} pilihan menu · ${priceRange(s)}</li></ul>
    ${s.capacityConfirmed ? '' : `<p class="note">${icon('info', 14)} Ketersediaan menu masih menunggu konfirmasi kantin.</p>`}
    <button class="btn ${canOrder(s) ? 'btn-primary' : ''} btn-block" data-act="viewSession" data-sid="${s.id}">Lihat Menu</button></div></article>`;
  }).join('')}</section>`;
}

/* ---------- menu selection ---------- */
const steps = n => `<ol class="stepper" aria-label="Langkah pemesanan">${['Menu', 'Kebutuhan', 'Ringkasan'].map((t, i) => `<li class="${i + 1 === n ? 'cur' : i + 1 < n ? 'done' : ''}"><i>${i + 1 < n ? icon('check', 12) : i + 1}</i>${t}</li>`).join('')}</ol>`;
export function selection(sid) {
  const st = getState(), s = sessionOf(sid), d = st.draft;
  if (!s) return empty('Sesi tidak ditemukan', '');
  if (!d || d.sessionId !== sid) return `${topbar('Menu', '#/c/sessions')}<section class="pad">${empty('Memuat…', '')}</section>`;
  const items = s.menus.map(m => menuOf(m.menuId)).filter(m => m && m.active);
  const primary = menuOf(d.primary), req = profileReq(d);
  const block = m => conflicts(m, req);
  const diff = m => primary && m.price !== primary.price ? (m.price > primary.price ? `<span class="chip warn">${icon('alert', 12)} ${rp(m.price - primary.price)} lebih mahal dari menu utama</span>` : `<span class="chip">${rp(primary.price - m.price)} lebih murah</span>`) : '';
  const ok = d.primary && d.alts.length >= 1;
  return `${topbar('Pilih Menumu', '#/c/sessions')}<section class="pad">${steps(1)}
  <p class="muted">Pilih satu menu utama, lalu tambahkan alternatif yang tetap bersedia kamu terima.</p>
  <h2 class="sec">Pilihan Utama</h2>
  ${items.map(m => { const b = block(m), sel = d.primary === m.id; return `<article class="card menu ${sel ? 'sel' : ''} ${b.length ? 'dis' : ''}">${dish(m.art, 'thumb')}<div class="grow"><div class="row between"><h3>${esc(m.name)}</h3><b>${rp(m.price)}</b></div><p class="muted sm">${esc(m.desc)}</p><div class="chips">${chips(m)}</div>
    ${b.length ? `<p class="err sm">${icon('ban', 14)} Tidak sesuai kebutuhanmu: ${esc(b.join(', '))}</p>` : ''}
    <button class="btn ${sel ? 'btn-primary' : ''} btn-sm" data-act="pickPrimary" data-id="${m.id}" aria-pressed="${sel}" ${b.length ? 'disabled' : ''}>${sel ? icon('check', 16) + ' Pilihan utama' : 'Pilih'}</button></div></article>`; }).join('')}
  ${primary ? `<h2 class="sec">Alternatif yang Kamu Terima</h2>
  <p class="helper">${icon('info', 16)} Pilihan alternatif hanya digunakan apabila menu utama tidak dapat dialokasikan. Kamu hanya akan mendapatkan menu yang sudah kamu setujui.</p>
  ${items.filter(m => m.id !== d.primary).map(m => { const b = block(m), on = d.alts.includes(m.id); return `<label class="card alt ${on ? 'sel' : ''} ${b.length ? 'dis' : ''}"><div class="grow"><b>${esc(m.name)}</b> <span class="muted">· ${rp(m.price)}</span><div class="chips">${diff(m)}</div>
    ${b.length ? `<p class="err sm">${icon('ban', 14)} ${esc(b.join(', '))}</p>` : ''}</div>
    <span class="switch"><input type="checkbox" data-act="toggleAlt" data-id="${m.id}" ${on ? 'checked' : ''} ${b.length ? 'disabled' : ''} aria-label="Saya terima menu ${esc(m.name)}"><i></i></span><span class="sw-label">Saya terima</span></label>`; }).join('')}` : ''}
  <div class="sticky-cta">${!ok ? `<p class="sm muted center">${!d.primary ? 'Pilih satu menu utama untuk melanjutkan.' : 'Tambahkan minimal satu alternatif yang kamu setujui.'}</p>` : ''}
  <button class="btn btn-primary btn-block" data-act="nav" data-to="#/c/food" ${ok ? '' : 'disabled'}>Lanjut ke Ringkasan</button></div></section>`;
}

/* ---------- requirements ---------- */
export function requirements() {
  const d = getState().draft;
  if (!d) return `${topbar('Kebutuhan Makananmu', '#/c/sessions')}<section class="pad">${empty('Mulai dari memilih sesi', '')}</section>`;
  const s = sessionOf(d.sessionId), req = profileReq(d);
  const bad = [d.primary, ...d.alts].map(id => [menuOf(id), conflicts(menuOf(id), req)]).filter(x => x[1].length);
  const grp = (title, map, key) => `<fieldset class="fs"><legend>${title}</legend>${Object.entries(map).map(([k, v]) => `<label class="check"><input type="checkbox" data-act="toggleReq" data-key="${key}" data-k="${k}" ${d[key].includes(k) ? 'checked' : ''}><span>${v}</span></label>`).join('')}</fieldset>`;
  const A = { peanuts: ALLERGENS.peanuts, seafood: ALLERGENS.seafood, egg: ALLERGENS.egg, milk: ALLERGENS.milk };
  return `${topbar('Kebutuhan Makananmu', `#/c/session/${d.sessionId}`)}<section class="pad">${steps(2)}
  ${grp('Preferensi diet', DIET, 'diet')}${grp('Alergi', A, 'allergies')}
  <label class="field"><span>Preferensi atau alergen lain</span><input type="text" data-bind="otherAllergy" value="${esc(d.otherAllergy)}" placeholder="Contoh: udang, kacang mete"></label>
  <label class="field"><span>Catatan tambahan</span><textarea rows="3" data-bind="notes" placeholder="Catatan untuk kantin (opsional)">${esc(d.notes)}</textarea></label>
  <p class="helper ok-h">${icon('shield', 16)} Alergi dan pantangan adalah <b>batas mutlak</b>: sistem tidak akan pernah mengalokasikan menu yang bertentangan.</p>
  <p class="muted sm">Informasi bahan dan alergen disediakan oleh mitra kantin. Silakan konfirmasi langsung kepada penyedia makanan apabila memiliki alergi serius. Kami tidak menjanjikan bebas kontaminasi silang.</p>
  <label class="check"><input type="checkbox" data-act="toggleSave" ${d.saveProfile ? 'checked' : ''}><span>Simpan ke profilku</span></label>
  ${bad.length ? `<div class="alert err-box" role="alert">${icon('alert', 18)}<div><b>Ada menu yang bertentangan dengan kebutuhanmu</b><ul>${bad.map(([m, c]) => `<li>${esc(m?.name || '?')}: ${esc(c.join(', '))}</li>`).join('')}</ul><button class="btn btn-sm" data-act="dropConflicts">Hapus menu tersebut dari pilihanku</button></div></div>` : ''}
  <div class="sticky-cta"><button class="btn btn-primary btn-block" data-act="nav" data-to="#/c/review" ${bad.length || !d.primary || !d.alts.length ? 'disabled' : ''}>Tinjau Pesanan</button>${s ? '' : ''}</div></section>`;
}

/* ---------- review ---------- */
export function review() {
  const st = getState(), d = st.draft;
  if (!d || !d.primary) return `${topbar('Tinjau Pesananmu', '#/c/sessions')}<section class="pad">${empty('Belum ada pilihan', 'Mulai dari memilih sesi dan menu.')}</section>`;
  const s = sessionOf(d.sessionId), p = menuOf(d.primary), alts = d.alts.map(menuOf).filter(Boolean);
  const diffs = alts.filter(a => a.price !== p.price);
  const need = !d.agree || (diffs.length && !d.priceAgree);
  const row = (a, b) => `<div class="kv"><span>${a}</span><b>${b}</b></div>`;
  return `${topbar('Tinjau Pesananmu', '#/c/food')}<section class="pad">${steps(3)}
  <article class="card"><div class="eyebrow">Pilihan utama</div><div class="row gap">${dish(p.art, 'mini')}<div><b>${esc(p.name)}</b><div class="muted sm">${rp(p.price)}</div></div></div>
  <div class="eyebrow mt">Alternatif yang diterima</div>${alts.map(a => `<div class="row gap mb-s">${dish(a.art, 'mini')}<div><b>${esc(a.name)}</b><div class="muted sm">${rp(a.price)}${a.price !== p.price ? ` · ${a.price > p.price ? '+' : '−'}${rp(Math.abs(a.price - p.price))}` : ''}</div></div></div>`).join('')}
  <button class="link" data-act="nav" data-to="#/c/session/${d.sessionId}">Ubah pilihan</button></article>
  <article class="card"><div class="eyebrow">Detail pesanan</div>${row('Nama', esc(st.customer.name))}${row('Tanggal', dateShort(s.date))}${row('Sesi makan', esc(s.name))}${row('Waktu pengambilan', `${hm(s.pickupStart)}–${hm(s.pickupEnd)}`)}${row('Lokasi', esc(s.pickupLocation))}
  ${d.diet.length || d.allergies.length || d.otherAllergy ? row('Kebutuhan makanan', esc([...d.diet.map(x => DIET[x]), ...d.allergies.map(x => 'Alergi ' + ALLERGENS[x]), d.otherAllergy].filter(Boolean).join(', '))) : ''}${d.notes ? row('Catatan', esc(d.notes)) : ''}</article>
  <article class="card price"><div class="row between"><span>Harga</span><b class="big">${rp(p.price)}</b></div><p class="muted sm">Harga mengikuti menu yang akhirnya dikonfirmasi. Apabila pilihan alternatif memiliki harga berbeda, perbedaan harga akan ditampilkan dan harus disetujui sebelum pesanan dibuat.</p>
  ${diffs.length ? `<p class="warn-t">${icon('alert', 14)} ${diffs.map(a => `${esc(a.short || a.name)}: ${rp(a.price)}`).join(', ')}</p>` : ''}
  <p class="muted sm">Pembayaran di tempat saat pengambilan (simulasi, tidak ada transaksi nyata).</p></article>
  ${diffs.length ? `<label class="check"><input type="checkbox" data-act="toggleAgree" data-key="priceAgree" ${d.priceAgree ? 'checked' : ''}><span>Saya menyetujui perbedaan harga bila menu alternatif yang dikonfirmasi.</span></label>` : ''}
  <label class="check"><input type="checkbox" data-act="toggleAgree" data-key="agree" ${d.agree ? 'checked' : ''}><span>Saya paham bahwa menu finalku adalah salah satu dari menu yang saya pilih.</span></label>
  <div class="sticky-cta"><button class="btn btn-primary btn-block" data-act="confirmOrder" ${need ? 'disabled' : ''}>Konfirmasi Pesanan</button><button class="btn btn-block" data-act="nav" data-to="#/c/session/${d.sessionId}">Ubah Pilihan</button></div></section>`;
}

/* ---------- status ---------- */
const TRACK = [['Pesanan diterima', 'Pilihan menumu sudah kami terima.'], ['Menunggu alokasi', 'Dapur sedang menyesuaikan pesanan dengan kapasitas setiap menu.'], ['Menu dikonfirmasi', 'Menu finalmu sudah dikonfirmasi.'], ['Siap diambil', 'Makananmu siap diambil.']];
export function status(id, flash) {
  const o = orderOf(id);
  if (!o) return `${topbar('Status Pesanan', '#/c/orders')}<section class="pad">${empty('Pesanan tidak ditemukan', '')}</section>`;
  const cur = { pending: 1, unresolved: 1, confirmed: 2, ready: 3, completed: 3, cancelled: -1 }[o.status];
  const fin = o.finalMenu ? menuOf(o.finalMenu) : null, s = sessionOf(o.sessionId);
  const kv = (a, b) => `<div class="kv"><span>${a}</span><b>${b}</b></div>`;
  return `${topbar('Status Pesanan', '#/c/orders')}<section class="pad">
  ${flash ? `<div class="alert ok-box" role="status">${icon('check', 18)}<div><b>Pesananmu berhasil diterima.</b><br><span class="sm">Menu final akan dikonfirmasi setelah alokasi.</span></div></div>` : ''}
  <div class="row between"><div><div class="eyebrow">Nomor pesanan</div><h2 class="ref">${o.id}</h2></div>${statusBadge(o.status)}</div>
  ${o.status === 'cancelled' ? `<div class="alert"><div>${icon('ban', 18)}</div><div>Pesanan ini dibatalkan.</div></div>` : `<ol class="track">${TRACK.map(([t, d], i) => { const state = i < cur || (o.status === 'completed') ? 'done' : i === cur ? 'cur' : ''; return `<li class="${state} ${o.status === 'unresolved' && i === 1 ? 'warn' : ''}"><i>${state === 'done' ? icon('check', 14) : i + 1}</i><div><b>${t}</b><span>${d}</span></div></li>`; }).join('')}</ol>`}
  ${o.status === 'pending' ? `<div class="alert info-box">${icon('clock', 18)}<div>Menu final kamu akan dikonfirmasi setelah proses alokasi selesai.</div></div>` : ''}
  ${o.status === 'unresolved' ? `<div class="alert warn-box" role="alert">${icon('alert', 18)}<div><b>Maaf, belum ada menu yang sesuai dengan pilihan yang kamu setujui.</b><br>Pesananmu tidak akan dialihkan ke menu lain tanpa persetujuanmu.<div class="row gap mt"><button class="btn btn-sm" data-act="nav" data-to="#/c/sessions">Pilih sesi lain</button><button class="btn btn-sm" data-act="contactCanteen">Hubungi kantin</button></div></div></div>` : ''}
  ${o.needsReview ? `<div class="alert warn-box">${icon('info', 18)}<div>Kantin sedang meninjau pesananmu karena ada perubahan menu.</div></div>` : ''}
  <article class="card"><div class="eyebrow">Menu</div>
  ${fin ? `<div class="row gap">${dish(fin.art, 'mini')}<div><b>${esc(fin.name)}</b><div class="muted sm">Menu final${o.allocationType === 'alternative' ? ' · alternatif yang kamu setujui' : ' · pilihan utama'}</div></div></div>` : `<div class="muted sm">Menu yang kamu setujui:</div>${approvedIds(o).map((m, i) => `<div class="row gap mb-s">${dish(menuOf(m)?.art, 'mini')}<div><b>${esc(menuOf(m)?.name || '(dihapus)')}</b><div class="muted sm">${i === 0 ? 'Pilihan utama' : 'Alternatif'} · ${rp(menuOf(m)?.price || 0)}</div></div></div>`).join('')}`}
  </article>
  <article class="card"><div class="eyebrow">Detail</div>${kv('Total harga', fin ? rp(o.finalPrice || fin.price) : `${rp(menuOf(o.primary)?.price || 0)}<small> (menu utama)</small>`)}${kv('Lokasi', esc(s?.pickupLocation || '-'))}${kv('Jadwal pengambilan', s ? `${hm(s.pickupStart)}–${hm(s.pickupEnd)}` : '-')}${kv('Kantin', esc(o.canteen))}${kv('Tanggal', dateShort(o.date))}${kv('Status', STATUS[o.status][0])}</article>
  ${o.status === 'pending' && s && canOrder(s) ? `<button class="btn btn-block danger-o" data-act="askCancel" data-id="${o.id}">Batalkan Pesanan</button>` : ''}
  </section>`;
}

/* ---------- orders / history / profile ---------- */
export function ordersTab() {
  const act = mine().filter(o => ['pending', 'confirmed', 'ready', 'unresolved'].includes(o.status));
  return `${topbar('Pesanan Aktif')}<section class="pad">${act.map(orderRow).join('') || empty('Belum ada pesanan aktif', 'Pilih sesi makan dan buat pesanan fleksibelmu.') + `<button class="btn btn-primary btn-block" data-act="nav" data-to="#/c/sessions">Lihat sesi tersedia</button>`}</section>`;
}
export function history() {
  const f = getState().ui.hist || 'all', list = mine().filter(o => f === 'all' || o.status === f);
  return `${topbar('Riwayat Pesanan')}<section class="pad"><div class="seg" role="tablist">${[['all', 'Semua'], ['completed', 'Selesai'], ['cancelled', 'Dibatalkan']].map(([k, t]) => `<button role="tab" aria-selected="${f === k}" class="${f === k ? 'on' : ''}" data-act="setHist" data-f="${k}">${t}</button>`).join('')}</div>
  ${list.map(orderRow).join('') || empty('Tidak ada pesanan', 'Belum ada pesanan pada filter ini.')}</section>`;
}
export function profile() {
  const c = getState().customer, r = [...c.diet.map(x => DIET[x]), ...c.allergies.map(x => 'Alergi ' + ALLERGENS[x]), c.otherAllergy].filter(Boolean);
  const row = (ic, a, b) => `<div class="kv ic">${icon(ic, 18)}<span>${a}</span><b>${b}</b></div>`;
  return `${topbar('Profil')}<section class="pad"><div class="profile-head"><div class="avatar">${esc(c.name[0])}</div><div><h2>${esc(c.name)}</h2><span class="muted">Customer demo</span></div></div>
  <article class="card"><div class="eyebrow">Akun</div>${row('user', 'Nama', esc(c.name))}${row('mail', 'Email', esc(c.email))}${row('phone', 'Telepon', esc(c.phone))}</article>
  <article class="card"><div class="row between"><div class="eyebrow">Preferensi makanan & alergi</div><button class="link" data-act="editReq">Ubah</button></div><p>${r.length ? esc(r.join(', ')) : 'Belum ada pembatasan.'}</p><p class="muted sm">Dipakai otomatis sebagai batas mutlak pada setiap pesanan.</p></article>
  <article class="card"><div class="eyebrow">Notifikasi</div>${[['status', 'Status pesanan'], ['reminder', 'Pengingat batas pemilihan'], ['promo', 'Info sesi baru']].map(([k, t]) => `<label class="row between tog"><span>${t}</span><span class="switch"><input type="checkbox" data-act="toggleNotify" data-k="${k}" ${c.notify[k] ? 'checked' : ''} aria-label="${t}"><i></i></span></label>`).join('')}</article>
  <article class="card"><button class="list-btn" data-act="nav" data-to="#/c/history">${icon('history', 18)} Riwayat pemesanan ${icon('right', 16)}</button><button class="list-btn" data-act="help">${icon('help', 18)} Bantuan ${icon('right', 16)}</button></article>
  <button class="btn btn-block" data-act="nav" data-to="#/">${icon('logout', 18)} Logout</button></section>`;
}

export function ensureDraft(sid) { if (getState().draft?.sessionId !== sid) { mutate(st => { st.draft = newDraft(sid); }); return true; } return false; }
/* ---------- actions ---------- */
const newDraft = sid => ({ sessionId: sid, primary: null, alts: [], diet: [...getState().customer.diet], allergies: [...getState().customer.allergies], otherAllergy: getState().customer.otherAllergy, notes: '', agree: false, priceAgree: false, saveProfile: true });
Object.assign(actions, {
  nav: ({ to }) => go(to),
  skipOnboarding: () => { mutate(s => { s.onboarded = true; }); go('#/c/home'); },
  viewSession: ({ sid }) => { const s = sessionOf(sid); if (!canOrder(s)) { toast('Sesi ini sudah ditutup untuk pemesanan.', 'err'); return; } actions.startOrder({ sid }); },
  startOrder: ({ sid }) => { const s = sessionOf(sid); if (!canOrder(s)) return toast('Sesi ini sudah ditutup untuk pemesanan.', 'err'); if (getState().draft?.sessionId !== sid) mutate(st => { st.draft = newDraft(sid); }); go(`#/c/session/${sid}`); },
  pickPrimary: ({ id }) => mutate(s => { s.draft.primary = id; s.draft.alts = s.draft.alts.filter(a => a !== id); }),
  toggleAlt: ({ id }) => mutate(s => { const a = s.draft.alts, i = a.indexOf(id); i >= 0 ? a.splice(i, 1) : a.push(id); }),
  toggleReq: ({ key, k }) => mutate(s => { const a = s.draft[key], i = a.indexOf(k); i >= 0 ? a.splice(i, 1) : a.push(k); }),
  toggleSave: () => mutate(s => { s.draft.saveProfile = !s.draft.saveProfile; }),
  toggleAgree: ({ key }) => mutate(s => { s.draft[key] = !s.draft[key]; }),
  dropConflicts: () => mutate(s => { const d = s.draft, req = profileReq(d), bad = id => conflicts(s.menus.find(m => m.id === id), req).length > 0; if (bad(d.primary)) d.primary = null; d.alts = d.alts.filter(a => !bad(a)); toast('Menu yang bertentangan sudah dihapus. Periksa kembali pilihanmu.'); if (!d.primary || !d.alts.length) setTimeout(() => go(`#/c/session/${d.sessionId}`), 0); }),
  confirmOrder: async el => {
    const btn = document.querySelector('[data-act="confirmOrder"]'); if (!btn || btn.disabled) return;
    btn.disabled = true; btn.classList.add('loading'); btn.textContent = 'Memproses…';
    await new Promise(r => setTimeout(r, 800));
    const st = getState(), d = st.draft, s = sessionOf(d.sessionId);
    const bad = [d.primary, ...d.alts].some(id => conflicts(menuOf(id), profileReq(d)).length);
    if (!canOrder(s) || bad || !d.agree || !d.alts.length) { toast('Pesanan tidak dapat dibuat. Periksa pilihan atau status sesi.', 'err'); btn.classList.remove('loading'); btn.textContent = 'Konfirmasi Pesanan'; btn.disabled = false; return; }
    const id = nextOrderId();
    mutate(x => {
      x.orders.push({ id, customerId: CUSTOMER_ID, customerName: x.customer.name, sessionId: s.id, sessionName: s.name, canteen: 'Menuflow Campus Canteen', date: s.date, primary: d.primary, alts: [...d.alts], diet: [...d.diet], allergies: [...d.allergies], otherAllergy: d.otherAllergy.trim(), notes: d.notes.trim(), createdAt: Date.now(), status: 'pending', allocationType: null, finalMenu: null, finalPrice: null, needsReview: false });
      if (d.saveProfile) Object.assign(x.customer, { diet: [...d.diet], allergies: [...d.allergies], otherAllergy: d.otherAllergy.trim() });
      notify('customer', `Pesananmu berhasil diterima. (${id})`); notify('merchant', `Ada 1 pesanan baru: ${id} (${x.customer.name}).`);
      x.draft = null; x.ui.flash = id;
    });
    go(`#/c/status/${id}`);
  },
  askCancel: ({ id }) => confirmDialog({ title: 'Batalkan pesanan?', body: 'Pesananmu akan dihapus dari antrean alokasi.', ok: 'Ya, batalkan', danger: true, act: 'doCancel', data: `data-id="${id}"` }),
  doCancel: ({ id }) => { closeModal(); mutate(s => { const o = s.orders.find(x => x.id === id); if (o && o.status === 'pending') { o.status = 'cancelled'; notify('merchant', `Pesanan ${id} dibatalkan oleh pelanggan.`); } }); toast('Pesanan dibatalkan.'); },
  contactCanteen: () => openModal(`<h2>Hubungi kantin</h2><p class="muted">Simulasi: pada produk nyata, tombol ini membuka chat atau telepon ke kantin.</p><p><b>Menuflow Campus Canteen</b><br>${icon('phone', 14)} 021-555-0123 (demo)</p><button class="btn btn-primary btn-block" data-act="closeModal">Tutup</button>`),
  help: () => openModal(`<h2>Bantuan</h2><p class="muted">Menuflow hanya akan memberi menu yang kamu setujui. Jika ada kendala, hubungi kantin dari halaman status pesanan.</p><button class="btn btn-primary btn-block" data-act="closeModal">Mengerti</button>`),
  setHist: ({ f }) => mutate(s => { s.ui.hist = f; }),
  toggleNotify: ({ k }) => mutate(s => { s.customer.notify[k] = !s.customer.notify[k]; }),
  editReq: () => {
    const c = getState().customer;
    openModal(`<h2>Kebutuhan makanan</h2><form data-form="profileReq"><fieldset class="fs"><legend>Preferensi diet</legend>${Object.entries(DIET).map(([k, v]) => `<label class="check"><input type="checkbox" name="diet" value="${k}" ${c.diet.includes(k) ? 'checked' : ''}><span>${v}</span></label>`).join('')}</fieldset>
    <fieldset class="fs"><legend>Alergi</legend>${['peanuts', 'seafood', 'egg', 'milk'].map(k => `<label class="check"><input type="checkbox" name="allergies" value="${k}" ${c.allergies.includes(k) ? 'checked' : ''}><span>${ALLERGENS[k]}</span></label>`).join('')}</fieldset>
    <label class="field"><span>Alergen lain</span><input name="other" value="${esc(c.otherAllergy)}"></label><div class="row end gap"><button type="button" class="btn" data-act="closeModal">Batal</button><button class="btn btn-primary">Simpan</button></div></form>`, { sheet: true });
  },
  openNotifs: () => {
    const list = getState().notifications.filter(n => n.to === 'customer');
    openModal(`<div class="row between"><h2>Notifikasi</h2><button class="icon-btn" data-act="closeModal" aria-label="Tutup">${icon('x')}</button></div>${list.map(n => `<div class="notif ${n.read ? '' : 'unread'}"><span>${esc(n.text)}</span><small>${ago(n.at)}</small></div>`).join('') || empty('Belum ada notifikasi', '')}`, { sheet: true });
    mutate(s => s.notifications.forEach(n => { if (n.to === 'customer') n.read = true; }));
  },
});
export function onForm(name, fd) {
  if (name === 'profileReq') { mutate(s => { s.customer.diet = fd.getAll('diet'); s.customer.allergies = fd.getAll('allergies'); s.customer.otherAllergy = (fd.get('other') || '').trim(); }); closeModal(); toast('Preferensi disimpan.'); }
}
export function onBind(key, value) { quiet(s => { if (s.draft) s.draft[key] = value; }); }
