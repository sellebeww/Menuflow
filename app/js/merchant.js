import { getState, mutate, quiet, resetDemo, menuOf, sessionOf, orderOf, effStatus, cutoffTs, simNow, notify } from './store.js';
import { esc, rp, hm, clock, dateShort, ago, icon, dish, badge, statusBadge, STATUS, openModal, closeModal, toast, confirmDialog } from './ui.js';
import { conflicts, ALLERGENS, DIET, approvedIds, capacityMap, generatePreview, summarize, validateOverride, applyOverride, confirmAllocation } from './allocation.js';
import { buildPlan, planText as buildPlanText } from './production.js';
import { actions, go } from './actions.js';

const S = () => getState();
const curSession = () => sessionOf(S().ui.selectedSession) || S().sessions[0];
const live = sid => S().orders.filter(o => o.sessionId === sid && o.status !== 'cancelled');
const short = id => menuOf(id)?.short || menuOf(id)?.name || '(dihapus)';
const orderClock = ts => clock(new Date(simNow().getTime() - (Date.now() - ts)));
const SESS_LABEL = { draft: ['Draf', 'neutral'], open: ['Dibuka', 'ok'], closing: ['Dibuka', 'ok'], closed: ['Ditutup', 'neutral'], allocating: ['Sedang dialokasikan', 'info'], completed: ['Selesai', 'ok'] };
const sessBadge = s => { const [t, k] = SESS_LABEL[s.status === 'open' && effStatus(s) === 'closed' ? 'closed' : s.status]; return badge(t, k); };
const emptyBox = (t, d = '') => `<div class="empty">${icon('package', 28)}<strong>${t}</strong><span>${d}</span></div>`;
const head = (t, sub, right = '') => `<div class="page-head"><div><h1>${t}</h1><p class="muted">${sub}</p></div><div class="row gap wrap">${right}</div></div>`;
const sessionPicker = () => `<label class="picker"><span class="sr">Sesi</span><select data-act="selectSession" aria-label="Pilih sesi">${S().sessions.filter(s => s.status !== 'draft').map(s => `<option value="${s.id}" ${s.id === curSession().id ? 'selected' : ''}>${esc(s.name)} · ${dateShort(s.date)}</option>`).join('')}</select></label>`;

/** Per-menu numbers for the selected session. */
function demand(sid) {
  const s = sessionOf(sid), L = live(sid), cap = capacityMap(s, S().orders);
  return s.menus.map(m => ({ id: m.menuId, name: short(m.menuId), first: L.filter(o => o.primary === m.menuId).length, accepted: L.filter(o => approvedIds(o).includes(m.menuId)).length, capacity: m.capacity, allocated: cap[m.menuId].used }));
}
function wasteEstimate(sid) {
  const s = sessionOf(sid), pv = S().preview?.sessionId === sid ? S().preview.rows : null, pend = live(sid).filter(o => ['pending', 'unresolved'].includes(o.status));
  const cap = capacityMap(s, S().orders);
  return s.menus.reduce((sum, m) => { const c = cap[m.menuId], dm = pv ? pv.filter(r => r.menuId === m.menuId).length : pend.filter(o => o.primary === m.menuId).length; return sum + Math.max(0, c.capacity - c.used - dm); }, 0);
}
function baselineWaste(sid) { // if nobody had alternatives: only first choices are served
  const s = sessionOf(sid), pend = live(sid).filter(o => ['pending', 'unresolved'].includes(o.status)), cap = capacityMap(s, S().orders);
  return s.menus.reduce((sum, m) => sum + Math.max(0, cap[m.menuId].left - pend.filter(o => o.primary === m.menuId).length), 0);
}

/* ---------- reusable chart ---------- */
function demandChart(rows) {
  const max = Math.max(1, ...rows.flatMap(r => [r.first, r.accepted, r.capacity, r.allocated]));
  const bar = (v, cls, label) => `<div class="bar-line"><span class="bl">${label}</span><div class="track"><i class="${cls}" style="width:${(v / max) * 100}%"></i></div><b>${v}</b></div>`;
  return `<div class="chart" role="img" aria-label="Grafik permintaan dibanding kapasitas">${rows.map(r => `<div class="bar-group"><div class="bg-title">${esc(r.name)}</div>${bar(r.first, 'c-first', 'Pilihan utama')}${bar(r.accepted, 'c-acc', 'Diterima')}${bar(r.capacity, 'c-cap', 'Kapasitas')}${bar(r.allocated, 'c-alloc', 'Dialokasikan')}</div>`).join('')}
  <div class="legend"><span><i class="c-first"></i>Pilihan utama</span><span><i class="c-acc"></i>Diterima (termasuk alternatif)</span><span><i class="c-cap"></i>Kapasitas</span><span><i class="c-alloc"></i>Dialokasikan (dikonfirmasi)</span></div></div>`;
}

/* ---------- overview ---------- */
export function overview() {
  const s = curSession(), L = live(s.id), rows = demand(s.id);
  const conf = L.filter(o => ['confirmed', 'ready', 'completed'].includes(o.status)).length, pend = L.filter(o => o.status === 'pending').length;
  const waste = wasteEstimate(s.id), base = baselineWaste(s.id);
  const top = [...rows].sort((a, b) => b.first - a.first)[0];
  const topMulti = L.filter(o => o.primary === top?.id && o.alts.length > 0).length;
  const pv = S().preview?.sessionId === s.id ? summarize(S().preview.rows, s, S().orders) : null;
  const kpi = (t, v, sub, ic) => `<article class="kpi"><div class="row between"><span class="muted">${t}</span>${icon(ic, 18)}</div><strong>${v}</strong><small>${sub}</small></article>`;
  return `${head('Ringkasan Dapur', 'Pantau permintaan hari ini dan kesiapan produksi.', sessionPicker())}
  <div class="kpis">${kpi('Total Pesanan', L.length, 'pesanan aktif sesi ini', 'orders')}${kpi('Pesanan Fleksibel', L.filter(o => o.alts.length).length, 'menyetujui lebih dari satu menu', 'merge')}${kpi('Menu Terkonfirmasi', conf, 'menu final terkonfirmasi', 'check')}${kpi('Menunggu Alokasi', pend, 'menunggu alokasi', 'clock')}${kpi('Estimasi Sisa Makanan', `${waste} <em>porsi</em>`, 'estimasi simulasi, bukan hasil timbang', 'leaf')}</div>
  <div class="grid-2"><article class="card"><div class="row between"><h2>Ringkasan Produksi Hari Ini</h2><button class="link" data-act="nav" data-to="#/m/allocation">Buka Pusat Alokasi ${icon('arrow', 14)}</button></div>${demandChart(rows)}</article>
  <div class="stack"><article class="card insight"><div class="eyebrow">${icon('info', 14)} Wawasan Operasional</div>
  <p>${top ? `<b>${esc(top.name)}</b> menjadi pilihan utama terbanyak (${top.first} pesanan), dan ${topMulti} di antaranya juga menyetujui alternatif lain.` : 'Belum ada data pesanan.'}</p>
  <p>${pv ? `Pada draft alokasi, ${pv.alternative} pesanan terlayani lewat alternatif yang disetujui pelanggan. Estimasi porsi tak terserap: ${waste} (hanya menu utama: ${base}). Simulasi dari data saat ini.` : `Jika hanya menu utama yang dilayani, estimasi ${base} porsi tak terserap dan sebagian pesanan tidak mendapat menu. Buat Pratinjau Alokasi untuk melihat dampak pilihan alternatif.`}</p></article>
  <article class="card"><div class="row between"><h2>Sesi Makan Mendatang</h2></div>${S().sessions.filter(x => ['open', 'draft'].includes(x.status) || x.id === s.id).slice(0, 3).map(x => `<div class="mini-sess"><div><b>${esc(x.name)}</b><div class="muted sm">Batas pesan ${hm(x.cutoff)} · ${live(x.id).length} reservasi</div></div><div class="row gap">${sessBadge(x)}<button class="btn btn-sm" data-act="manageSession" data-sid="${x.id}">Kelola Sesi</button></div></div>`).join('')}</article></div></div>`;
}

/* ---------- sessions ---------- */
export function sessions() {
  return `${head('Sesi Makan', 'Buat, atur, dan buka pemesanan sesi makan.', '<button class="btn btn-primary" data-act="newSession">+ Buat Sesi Baru</button>')}
  <article class="card flush"><div class="table-wrap"><table><thead><tr><th>Sesi</th><th>Tanggal</th><th>Pengambilan</th><th>Batas pesan</th><th>Kapasitas</th><th>Reservasi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
  ${S().sessions.map(s => `<tr><td><b>${esc(s.name)}</b><div class="muted sm">${s.menus.length} menu</div></td><td>${dateShort(s.date)}</td><td>${hm(s.pickupStart)}–${hm(s.pickupEnd)}</td><td>${hm(s.cutoff)}</td><td>${s.menus.reduce((a, m) => a + m.capacity, 0)}</td><td>${live(s.id).length}</td><td>${sessBadge(s)}</td>
  <td><div class="row gap wrap"><button class="btn btn-sm" data-act="editSession" data-sid="${s.id}">${icon('edit', 14)} Ubah</button>
  ${s.status === 'open' ? `<button class="btn btn-sm" data-act="setSessionStatus" data-sid="${s.id}" data-to="closed">Tutup Pemesanan</button>` : ['closed', 'draft'].includes(s.status) ? `<button class="btn btn-sm btn-primary" data-act="setSessionStatus" data-sid="${s.id}" data-to="open">${s.status === 'draft' ? 'Publikasikan' : 'Buka Pemesanan'}</button>` : ''}
  ${['open', 'closed'].includes(s.status) ? `<button class="btn btn-sm" data-act="setSessionStatus" data-sid="${s.id}" data-to="draft">Nonaktifkan</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div></article>`;
}
const timeMin = t => +t.slice(0, 2) * 60 + +t.slice(3);
function sessionForm(s) {
  const e = s || { name: '', meal: 'Lunch', date: S().sessions[0].date, pickupLocation: 'Counter A, Gedung Kantin Kampus', pickupStart: '12:00', pickupEnd: '13:30', cutoff: '10:30', status: 'draft', menus: [] };
  const f = (l, n, v, t = 'text') => `<label class="field"><span>${l}</span><input name="${n}" type="${t}" value="${esc(v)}" required></label>`;
  return `<h2>${s ? 'Ubah Sesi' : 'Buat Sesi Baru'}</h2><form data-form="session" data-sid="${s ? s.id : ''}" novalidate><div id="form-err" class="alert err-box" hidden role="alert"></div>
  <h3 class="sub">Informasi Dasar</h3><div class="form-grid">${f('Nama Sesi', 'name', e.name)}${f('Tanggal', 'date', e.date, 'date')}
  <label class="field"><span>Jenis Makan</span><select name="meal">${[['Breakfast','Sarapan'], ['Lunch','Makan Siang'], ['Dinner','Makan Malam']].map(([x,t]) => `<option value="${x}" ${e.meal === x ? 'selected' : ''}>${t}</option>`).join('')}</select></label>${f('Lokasi Pengambilan', 'pickupLocation', e.pickupLocation)}${f('Mulai Pengambilan', 'pickupStart', e.pickupStart, 'time')}${f('Selesai Pengambilan', 'pickupEnd', e.pickupEnd, 'time')}${f('Batas Pemesanan', 'cutoff', e.cutoff, 'time')}
  <label class="field"><span>Status</span><select name="status">${[['draft', 'Draf'], ['open', 'Dibuka']].map(([k, t]) => `<option value="${k}" ${e.status === k ? 'selected' : ''}>${t}</option>`).join('')}${s && !['draft', 'open'].includes(e.status) ? `<option value="${e.status}" selected>${SESS_LABEL[e.status][0]} (diatur lewat alur)</option>` : ''}</select></label></div>
  <h3 class="sub">Pengaturan Produksi</h3><p class="muted sm">Pilih menu yang tersedia dan kapasitas produksinya. Harga mengikuti Kelola Menu. Menu tanpa info bahan/alergen tidak bisa dipublikasikan.</p>
  <div class="menu-pick">${S().menus.map(m => { const ok = m.active && m.allergensKnown && m.ingredients.length, cm = e.menus.find(x => x.menuId === m.id); return `<label class="mp ${ok ? '' : 'dis'}"><input type="checkbox" name="menu" value="${m.id}" ${cm ? 'checked' : ''} ${ok ? '' : 'disabled'}><span class="grow"><b>${esc(m.name)}</b> <span class="muted">${rp(m.price)}</span>${ok ? '' : `<small class="err">${!m.active ? 'Nonaktif' : 'Info bahan/alergen belum lengkap'}</small>`}</span><span class="cap-in">Kapasitas <input type="number" min="1" step="1" name="cap-${m.id}" value="${cm ? cm.capacity : m.capacity}" aria-label="Kapasitas ${esc(m.name)}"></span></label>`; }).join('')}</div>
  <div class="row end gap mt"><button type="button" class="btn" data-act="closeModal">Batal</button><button class="btn btn-primary">${s ? 'Simpan Perubahan' : 'Simpan Sesi'}</button></div></form>`;
}
function saveSession(fd, sid) {
  const err = [], v = n => (fd.get(n) || '').toString().trim();
  const ids = fd.getAll('menu'), caps = ids.map(id => +fd.get('cap-' + id));
  if (!v('name')) err.push('Nama sesi wajib diisi.');
  if (!v('date') || !v('pickupStart') || !v('pickupEnd') || !v('cutoff')) err.push('Tanggal dan semua waktu wajib diisi.');
  else {
    if (timeMin(v('pickupEnd')) <= timeMin(v('pickupStart'))) err.push('Waktu pengambilan selesai harus setelah waktu mulai.');
    if (timeMin(v('cutoff')) > timeMin(v('pickupStart')) - 60) err.push('Batas pemesanan tidak boleh melewati waktu produksi: harus minimal 60 menit sebelum pengambilan dimulai.');
  }
  if (caps.some(c => !Number.isInteger(c) || c <= 0)) err.push('Kapasitas harus berupa angka bulat positif.');
  if (!ids.length && v('status') === 'open') err.push('Sesi tidak dapat dipublikasikan tanpa menu.');
  const bad = ids.map(menuOf).filter(m => !m || !m.allergensKnown || !m.ingredients.length || !m.active);
  if (bad.length) err.push(`Menu belum lengkap infonya: ${bad.map(m => m.name).join(', ')}.`);
  if (err.length) return err;
  const data = { name: v('name'), meal: v('meal'), date: v('date'), pickupLocation: v('pickupLocation'), pickupStart: v('pickupStart'), pickupEnd: v('pickupEnd'), cutoff: v('cutoff'), menus: ids.map((id, i) => ({ menuId: id, capacity: caps[i] })) };
  mutate(s => {
    if (sid) { const x = s.sessions.find(q => q.id === sid); Object.assign(x, data); if (['draft', 'open'].includes(x.status)) x.status = v('status'); x.capacityConfirmed = true; }
    else s.sessions.push({ id: 's' + (Date.now() % 1e6), ...data, status: v('status'), capacityConfirmed: true });
  });
  return [];
}

/* ---------- menus ---------- */
export function menus() {
  const tag = m => ['beef', 'seafood', 'spicy', 'vegetarian'].filter(t => m.tags.includes(t)).map(t => `<span class="chip">${t}</span>`).join('');
  return `${head('Kelola Menu', 'Kelola menu, harga, bahan, alergen, dan kapasitas produksi.', '<button class="btn btn-primary" data-act="newMenu">+ Tambah Menu</button>')}
  <div class="menu-grid">${S().menus.map(m => `<article class="card menu-card ${m.active ? '' : 'off'}">${dish(m.art, 'cover')}<div class="mc-body"><div class="row between"><h3>${esc(m.name)}</h3>${badge(m.active ? 'Aktif' : 'Nonaktif', m.active ? 'ok' : 'neutral', m.active ? 'check' : 'ban')}</div>
  <p class="muted sm">${esc(m.desc)}</p><div class="row between"><b class="big">${rp(m.price)}</b><span class="muted">Kapasitas: ${m.capacity} porsi</span></div>
  <div class="kvs"><div><span>Bahan</span>${esc(m.ingredients.join(', ') || '-')}</div><div><span>Alergen</span>${m.allergensKnown ? (m.allergens.map(a => ALLERGENS[a] || a).join(', ') || 'Tidak ada alergen utama') : `<span class="err">${icon('alert', 12)} Belum lengkap, tidak dianggap aman</span>`}</div><div class="chips">${tag(m)}</div></div>
  <div class="row gap wrap"><button class="btn btn-sm" data-act="editMenu" data-id="${m.id}">${icon('edit', 14)} Ubah Menu</button><button class="btn btn-sm" data-act="toggleMenu" data-id="${m.id}">${m.active ? 'Nonaktifkan' : 'Aktifkan'}</button><button class="btn btn-sm danger-o" data-act="askDeleteMenu" data-id="${m.id}">${icon('trash', 14)} Hapus</button></div></div></article>`).join('')}</div>`;
}
function menuForm(m) {
  const e = m || { name: '', desc: '', price: 25000, capacity: 15, ingredients: [], allergens: [], allergensKnown: false, tags: [], active: true };
  return `<h2>${m ? 'Ubah Menu' : 'Tambah Menu'}</h2><form data-form="menu" data-id="${m ? m.id : ''}" novalidate><div id="form-err" class="alert err-box" hidden role="alert"></div><div class="form-grid">
  <label class="field"><span>Nama menu</span><input name="name" value="${esc(e.name)}" required></label><label class="field"><span>Harga (Rp)</span><input name="price" type="number" min="1000" step="500" value="${e.price}"></label>
  <label class="field full"><span>Deskripsi</span><input name="desc" value="${esc(e.desc)}"></label><label class="field"><span>Kapasitas produksi (porsi)</span><input name="capacity" type="number" min="1" step="1" value="${e.capacity}"></label>
  <label class="field"><span>Bahan (pisahkan dengan koma)</span><input name="ingredients" value="${esc(e.ingredients.join(', '))}"></label></div>
  <fieldset class="fs"><legend>Alergen yang terkandung</legend><div class="row wrap gap">${Object.entries(ALLERGENS).map(([k, v]) => `<label class="check"><input type="checkbox" name="allergens" value="${k}" ${e.allergens.includes(k) ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></fieldset>
  <fieldset class="fs"><legend>Sifat menu (dipakai untuk pantangan pelanggan)</legend><div class="row wrap gap">${[['beef', 'Mengandung daging sapi'], ['seafood', 'Mengandung seafood'], ['spicy', 'Pedas'], ['vegetarian', 'Vegetarian']].map(([k, v]) => `<label class="check"><input type="checkbox" name="tags" value="${k}" ${e.tags.includes(k) ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></fieldset>
  <label class="check"><input type="checkbox" name="known" ${e.allergensKnown ? 'checked' : ''}><span>Informasi bahan dan alergen sudah lengkap dan benar. Jika tidak dicentang, menu tidak dianggap aman bagi pelanggan dengan alergi/pantangan dan tidak dapat dipublikasikan.</span></label>
  <div class="row end gap mt"><button type="button" class="btn" data-act="closeModal">Batal</button><button class="btn btn-primary">${m ? 'Simpan' : 'Tambah Menu'}</button></div></form>`;
}
function saveMenu(fd, id) {
  const v = n => (fd.get(n) || '').toString().trim(), err = [];
  if (!v('name')) err.push('Nama menu wajib diisi.');
  if (!(+v('price') > 0)) err.push('Harga harus lebih dari 0.');
  if (!Number.isInteger(+v('capacity')) || +v('capacity') <= 0) err.push('Kapasitas harus berupa angka bulat positif.');
  const ing = v('ingredients').split(',').map(x => x.trim()).filter(Boolean);
  if (fd.get('known') && !ing.length) err.push('Isi daftar bahan sebelum menyatakan informasi lengkap.');
  if (err.length) return err;
  mutate(s => {
    const d = { name: v('name'), short: v('name').replace(/ Rice$/i, ''), desc: v('desc'), price: +v('price'), capacity: +v('capacity'), ingredients: ing, allergens: fd.getAll('allergens'), tags: fd.getAll('tags'), allergensKnown: !!fd.get('known') };
    if (id) {
      const m = s.menus.find(x => x.id === id); Object.assign(m, d);
      s.sessions.forEach(x => { if (['draft', 'open', 'closed'].includes(x.status)) x.menus.forEach(q => { if (q.menuId === id) q.capacity = d.capacity; }); });
    } else s.menus.push({ id: 'm' + Date.now() % 1e7, art: 'generic', active: true, ...d });
  });
  return [];
}

/* ---------- orders ---------- */
const FILTERS = [['all', 'Semua'], ['pending', 'Menunggu'], ['unresolved', 'Belum ada menu'], ['allocated', 'Dialokasikan'], ['confirmed', 'Dikonfirmasi'], ['completed', 'Selesai'], ['cancelled', 'Dibatalkan']];
const FILTER_FN = { all: () => true, pending: o => o.status === 'pending', unresolved: o => o.status === 'unresolved', allocated: o => o.finalMenu && ['confirmed', 'ready', 'completed'].includes(o.status), confirmed: o => o.status === 'confirmed', completed: o => o.status === 'completed', cancelled: o => o.status === 'cancelled' };
const allocBadge = o => o.status === 'pending' ? badge('Menunggu', 'info', 'clock') : o.status === 'cancelled' ? '<span class="muted">-</span>' : o.status === 'unresolved' || o.allocationType === 'unresolved' ? badge('Belum ada menu', 'warn', 'alert') : o.allocationType === 'alternative' ? badge('Lewat alternatif', 'info', 'refresh') : badge('Sesuai pilihan', 'ok', 'check');
export function ordersTable() {
  const f = S().ui.ofilter || 'all', q = (S().ui.osearch || '').toLowerCase(), sid = curSession().id;
  const list = S().orders.filter(o => o.sessionId === sid && FILTER_FN[f](o) && (!q || o.id.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q))).sort((a, b) => a.id.localeCompare(b.id));
  if (!list.length) return emptyBox('Tidak ada pesanan', 'Ubah filter atau kata kunci pencarian.');
  return `<table><thead><tr><th>No. Pesanan</th><th>Pelanggan</th><th>Pilihan utama</th><th>Alternatif diterima</th><th>Pantangan</th><th>Waktu pesan</th><th>Status alokasi</th><th>Menu final</th><th>Aksi</th></tr></thead><tbody>
  ${list.map(o => `<tr><td><b>${o.id}</b>${o.needsReview ? `<div>${badge('Perlu ditinjau', 'warn', 'alert')}</div>` : ''}</td><td>${esc(o.customerName)}<div class="muted sm">${o.customerId}</div></td><td>${esc(short(o.primary))}</td><td>${o.alts.map(a => esc(short(a))).join(', ')}</td>
  <td>${[...o.diet.map(d => DIET[d]), ...o.allergies.map(a => 'Alergi ' + ALLERGENS[a]), o.otherAllergy].filter(Boolean).map(x => `<span class="chip">${esc(x)}</span>`).join('') || '<span class="muted">-</span>'}</td><td>${orderClock(o.createdAt)}</td><td>${allocBadge(o)}</td><td>${o.finalMenu ? esc(short(o.finalMenu)) : '<span class="muted">-</span>'}</td>
  <td><button class="btn btn-sm" data-act="openOrder" data-id="${o.id}">Detail</button></td></tr>`).join('')}</tbody></table>`;
}
export function orders() {
  const f = S().ui.ofilter || 'all', sid = curSession().id;
  const cnt = k => S().orders.filter(o => o.sessionId === sid && FILTER_FN[k](o)).length;
  return `${head('Pesanan Pelanggan', 'Tinjau permintaan yang masuk. Setiap pesanan menampilkan semua menu yang disetujui pelanggan.', sessionPicker())}
  <div class="toolbar"><label class="search">${icon('search', 16)}<input type="search" data-search placeholder="Cari no. pesanan atau nama pelanggan" value="${esc(S().ui.osearch || '')}" aria-label="Cari pesanan"></label>
  <div class="seg wrap" role="tablist">${FILTERS.map(([k, t]) => `<button role="tab" aria-selected="${f === k}" class="${f === k ? 'on' : ''}" data-act="setOFilter" data-f="${k}">${t} <small>${cnt(k)}</small></button>`).join('')}</div></div>
  <p class="muted sm">Dialokasikan = sudah punya menu final · Dikonfirmasi = menu final sudah dipublikasikan ke pelanggan, menunggu siap diambil.</p>
  <article class="card flush"><div class="table-wrap tall" id="orders-list">${ordersTable()}</div></article>`;
}
function orderDetail(o) {
  const s = sessionOf(o.sessionId), cap = s ? capacityMap(s, S().orders) : {};
  const req = { diet: o.diet, allergies: o.allergies, otherAllergy: o.otherAllergy };
  const assignable = ['pending', 'unresolved'].includes(o.status) ? '' : '';
  const menusHtml = approvedIds(o).map((id, i) => { const m = menuOf(id), c = conflicts(m, req), cp = cap[id]; return `<tr><td>${i === 0 ? 'Utama' : 'Alternatif'}</td><td><b>${esc(m?.name || '(dihapus)')}</b></td><td>${m ? rp(m.price) : '-'}</td><td>${c.length ? badge(c.join(', '), 'err', 'ban') : badge('Aman untuk pelanggan ini', 'ok', 'check')}</td><td>${cp ? `${Math.max(0, cp.left)} / ${cp.capacity} tersisa` : '-'}</td></tr>`; }).join('');
  const options = approvedIds(o).filter(id => menuOf(id) && conflicts(menuOf(id), req).length === 0 && capacityMap(s, S().orders)[id]?.left > 0);
  return `<div class="row between"><div><div class="eyebrow">Detail pesanan</div><h2>${o.id}</h2></div>${statusBadge(o.status)}</div>
  <div class="kvs two"><div><span>Pelanggan</span>${esc(o.customerName)} (${o.customerId})</div><div><span>Waktu pesan</span>${orderClock(o.createdAt)}</div><div><span>Sesi</span>${esc(o.sessionName)}</div><div><span>Menu final</span>${o.finalMenu ? esc(short(o.finalMenu)) : '-'}</div></div>
  <h3 class="sub">Menu yang disetujui pelanggan</h3><div class="table-wrap"><table><thead><tr><th>Tipe</th><th>Menu</th><th>Harga</th><th>Kesesuaian</th><th>Kapasitas</th></tr></thead><tbody>${menusHtml}</tbody></table></div>
  ${o.notes ? `<p><b>Catatan:</b> ${esc(o.notes)}</p>` : ''}${o.needsReview ? `<div class="alert warn-box">${icon('alert', 18)}<div>Pesanan ini terdampak perubahan menu dan perlu ditinjau ulang.</div></div>` : ''}
  <div class="row end gap wrap mt"><button class="btn" data-act="closeModal">Tutup</button>
  ${o.status === 'unresolved' && options.length ? `<span class="row gap"><select id="assign-sel" aria-label="Pilih menu">${options.map(id => `<option value="${id}">${esc(short(id))}</option>`).join('')}</select><button class="btn btn-primary" data-act="assignManual" data-id="${o.id}">Tetapkan menu</button></span>` : ''}
  ${o.status === 'confirmed' ? `<button class="btn btn-primary" data-act="setOrderStatus" data-id="${o.id}" data-to="ready">Tandai siap diambil</button>` : ''}${o.status === 'ready' ? `<button class="btn btn-primary" data-act="setOrderStatus" data-id="${o.id}" data-to="completed">Tandai sudah diambil</button>` : ''}
  ${['pending', 'unresolved'].includes(o.status) ? `<button class="btn danger-o" data-act="setOrderStatus" data-id="${o.id}" data-to="cancelled">Batalkan pesanan</button>` : ''}</div>`;
}

/* ---------- allocation center ---------- */
export function allocation() {
  const s = curSession(), st = S(), step = st.ui.allocStep || 'work';
  const pv = st.preview?.sessionId === s.id ? st.preview : null;
  if (step === 'review' && pv) return allocReview(s, pv);
  const rows = demand(s.id), pending = live(s.id).filter(o => ['pending', 'unresolved'].includes(o.status)).sort((a, b) => a.createdAt - b.createdAt);
  const done = live(s.id).filter(o => o.finalMenu).length, accTotal = rows.reduce((a, r) => a + r.accepted, 0);
  const sm = pv ? summarize(pv.rows, s, st.orders) : null, cap = capacityMap(s, st.orders);
  const stale = pv && pv.rows.length !== pending.length;
  return `${head('Pusat Alokasi', 'Selaraskan pilihan pelanggan dengan kapasitas dapur yang tersedia.', sessionPicker())}
  <section class="card"><h2>Ringkasan Permintaan</h2><div class="table-wrap"><table><thead><tr><th>Menu</th><th>Pilihan utama</th><th>Diterima</th><th>Kapasitas produksi</th><th>Dialokasikan</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${esc(r.name)}</b></td><td>${r.first}</td><td>${r.accepted}</td><td>${r.capacity}</td><td>${r.allocated}</td></tr>`).join('')}</tbody></table></div>
  <div class="alert info-box">${icon('info', 18)}<div><b>Angka "Diterima" bukan jumlah pesanan final.</b> Satu pelanggan dapat menyetujui lebih dari satu menu, jadi total "Diterima" (${accTotal}) lebih besar dari jumlah pesanan (${live(s.id).length}). Menu final hanya satu per pesanan.</div></div>${demandChart(rows)}</section>
  <section class="card"><div class="row between wrap"><h2>Ruang Alokasi</h2><div class="row gap wrap">
  ${pv ? `<button class="btn" data-act="recalc">${icon('refresh', 16)} Hitung Ulang</button><button class="btn danger-o" data-act="cancelDraft">Batalkan Draf</button>` : ''}
  <button class="btn btn-primary" id="gen-btn" data-act="generatePreview" ${pending.length && s.menus.length ? '' : 'disabled'}>${icon('merge', 16)} Buat Pratinjau Alokasi</button></div></div>
  ${s.status === 'open' && effStatus(s) !== 'closed' ? `<div class="alert warn-box">${icon('clock', 18)}<div>Pemesanan masih terbuka. Membuat pratinjau akan menutup pemesanan agar daftar pesanan tidak berubah.</div></div>` : ''}
  ${stale ? `<div class="alert warn-box">${icon('alert', 18)}<div>Daftar pesanan berubah sejak pratinjau dibuat. Hitung ulang sebelum melanjutkan.</div></div>` : ''}
  <div class="ws"><div><h3 class="sub">Menunggu alokasi (${pending.length}), urut waktu pesan</h3>${pending.length ? `<div class="table-wrap tall short"><table class="compact"><thead><tr><th>#</th><th>Pesanan</th><th>Utama</th><th>Alternatif</th><th>Pantangan</th><th>Waktu</th></tr></thead><tbody>${pending.map((o, i) => `<tr><td>${i + 1}</td><td><b>${o.id.slice(8)}</b> ${esc(o.customerName)}${o.status === 'unresolved' ? ' ' + badge('Belum ada menu', 'warn') : ''}</td><td>${esc(short(o.primary))}</td><td>${o.alts.map(a => esc(short(a))).join(', ')}</td><td>${[...o.diet.map(d => DIET[d]), ...o.allergies.map(a => ALLERGENS[a])].filter(Boolean).map(x => `<span class="chip">${esc(x)}</span>`).join('') || '-'}</td><td>${orderClock(o.createdAt)}</td></tr>`).join('')}</tbody></table></div>` : emptyBox('Semua pesanan sudah dialokasikan', done ? 'Lihat hasilnya di Rencana Produksi.' : 'Belum ada pesanan masuk.')}</div>
  <div><h3 class="sub">Kapasitas menu</h3>${s.menus.map(m => { const c = cap[m.menuId], p = sm ? sm.perMenu[m.menuId].planned : 0, after = c.left - p; return `<div class="capcard ${after < 0 ? 'over' : ''}"><div class="row between"><b>${esc(short(m.menuId))}</b><span class="muted">${c.capacity} porsi</span></div><div class="stack-bar" role="img" aria-label="Terisi ${c.used}, draft ${p}, sisa ${Math.max(0, after)}"><i class="u" style="width:${c.used / c.capacity * 100}%"></i><i class="p" style="width:${Math.min(100 - c.used / c.capacity * 100, p / c.capacity * 100)}%"></i></div><div class="row between sm"><span>Dialokasikan ${c.used}${sm ? ` + draft ${p}` : ''}</span><b>${after < 0 ? icon('alert', 12) + ' Melebihi kapasitas' : 'Sisa ' + after}</b></div></div>`; }).join('')}</div></div></section>
  ${pv ? previewTable(s, pv, sm) : ''}${rulesCard()}`;
}
function previewTable(s, pv, sm) {
  const st = S();
  return `<section class="card" id="preview"><div class="row between wrap"><div><h2>Pratinjau Alokasi</h2><p class="muted sm">Draft hasil simulasi. Belum mengubah pesanan mana pun sampai kamu mengonfirmasi.</p></div><button class="btn btn-primary" data-act="toReview" ${sm.warnings.length ? 'disabled' : ''}>Tinjau Hasil Alokasi ${icon('arrow', 16)}</button></div>
  <div class="sumrow"><span>${badge('Sesuai ' + sm.matched, 'ok', 'check')}</span><span>${badge('Alternatif ' + sm.alternative, 'info', 'refresh')}</span><span>${badge('Belum ada menu ' + sm.unresolved, sm.unresolved ? 'warn' : 'neutral', 'alert')}</span></div>
  ${sm.warnings.length ? `<div class="alert err-box" role="alert">${icon('alert', 18)}<div>Kapasitas terlampaui. Ubah alokasi sebelum melanjutkan.</div></div>` : ''}
  ${sm.unresolved ? `<div class="alert warn-box">${icon('alert', 18)}<div><b>${sm.unresolved} pelanggan tidak memperoleh menu.</b> Metode distribusi: antrean waktu pesan (FIFO). Pesanan ini tetap membutuhkan penyelesaian oleh merchant dan tidak akan dialihkan ke menu yang tidak disetujui.</div></div>` : ''}
  <div class="table-wrap tall"><table><thead><tr><th>#</th><th>No. Pesanan</th><th>Pilihan utama</th><th>Saran menu final</th><th>Status</th><th>Alasan</th></tr></thead><tbody>${pv.rows.map(r => { const o = orderOf(r.orderId); const opts = approvedIds(o).map(id => { const v = validateOverride(pv.rows, st.orders, s, st.menus, o.id, id); return `<option value="${id}" ${r.menuId === id ? 'selected' : ''} ${v.ok || r.menuId === id ? '' : 'disabled'}>${esc(short(id))}${v.ok || r.menuId === id ? '' : ' (tidak tersedia)'}</option>`; }).join('');
    return `<tr class="${r.status}"><td>${r.queue}</td><td><b>${o.id}</b><div class="muted sm">${esc(o.customerName)}</div></td><td>${esc(short(r.primary))}</td><td><select data-act="override" data-oid="${o.id}" aria-label="Menu final untuk ${o.id}"><option value="" ${r.menuId ? '' : 'selected'}>Tidak ada yang cocok</option>${opts}</select></td><td>${r.status === 'matched' ? badge('Sesuai pilihan', 'ok', 'check') : r.status === 'alternative' ? badge('Lewat alternatif', 'info', 'refresh') : badge('Belum ada menu', 'warn', 'alert')}${r.manual ? '<div class="muted sm">manual</div>' : ''}</td><td class="reason">${esc(r.reason)}</td></tr>`; }).join('')}</tbody></table></div></section>`;
}
function allocReview(s, pv) {
  const sm = summarize(pv.rows, s, S().orders), n = (l, v, k = '') => `<div class="big-num ${k}"><strong>${v}</strong><span>${l}</span></div>`;
  return `${head('Tinjau Hasil Alokasi', 'Periksa ringkasan sebelum dipublikasikan ke pelanggan.', '<button class="btn" data-act="backToWork">' + icon('left', 16) + ' Kembali ke Pratinjau</button>')}
  <section class="card"><div class="big-nums">${n('Total Pesanan', sm.total)}${n('Berhasil Dialokasikan', sm.matched, 'ok')}${n('Lewat Alternatif', sm.alternative, 'info')}${n('Belum Ada Menu', sm.unresolved, sm.unresolved ? 'warn' : '')}</div></section>
  <section class="card"><h2>Total produksi per menu</h2><div class="table-wrap"><table><thead><tr><th>Menu</th><th>Sudah dikonfirmasi</th><th>Tambahan dari draft</th><th>Total produksi</th><th>Sisa kapasitas</th></tr></thead><tbody>${s.menus.map(m => { const p = sm.perMenu[m.menuId]; return `<tr><td><b>${esc(short(m.menuId))}</b></td><td>${p.used}</td><td>${p.planned}</td><td>${p.used + p.planned}</td><td>${p.after} / ${p.capacity}</td></tr>`; }).join('')}</tbody></table></div></section>
  ${sm.unresolved ? `<section class="card"><div class="alert warn-box">${icon('alert', 18)}<div><b>${sm.unresolved} pesanan belum mendapat menu:</b> ${pv.rows.filter(r => r.status === 'unresolved').map(r => r.orderId.slice(8)).join(', ')}. Mereka tidak dialokasikan dan harus diselesaikan manual (tetapkan menu yang mereka setujui jika tersedia, atau batalkan).</div></div></section>` : ''}
  <div class="row end gap"><button class="btn" data-act="backToWork">Edit alokasi</button><button class="btn btn-primary" id="pub-btn" data-act="askPublish">Konfirmasi &amp; Publikasikan Alokasi</button></div>`;
}
const rulesCard = () => `<section class="card"><h2>Aturan Alokasi &amp; Keadilan</h2><ol class="rules">${['Pilihan pelanggan merupakan batas persetujuan.', 'Menu utama menjadi prioritas jika kapasitas memungkinkan.', 'Alternatif hanya boleh digunakan jika pelanggan telah menyetujuinya.', 'Alergi dan pantangan mutlak tidak boleh dilanggar. Info alergen yang tidak lengkap tidak dianggap aman.', 'Kapasitas menu tidak boleh terlampaui.', 'Pesanan yang tidak mendapatkan menu yang disetujui ditandai belum ada menu.', 'Perubahan merchant dapat ditinjau sebelum konfirmasi final.'].map(r => `<li>${r}</li>`).join('')}</ol>
  <p class="muted sm"><b>Metode distribusi saat permintaan melebihi kapasitas:</b> antrean berdasarkan waktu pesan (siapa cepat dia dapat). Semua pilihan utama dilayani lebih dulu menurut antrean, lalu sisa pesanan dilayani lewat alternatif yang mereka setujui. Aturan sederhana dan transparan, tanpa AI atau acak.</p></section>`;

/* ---------- production plan ---------- */
export function production() {
  const s = curSession(), plan = buildPlan(s, S().orders, S().menus), { total, totalCapacity: totCap } = plan;
  if (!total) return `${head('Rencana Produksi', 'Rencana produksi siap setelah alokasi dikonfirmasi.', sessionPicker())}<article class="card">${emptyBox('Belum ada alokasi terkonfirmasi', 'Jalankan dan publikasikan alokasi di Pusat Alokasi terlebih dahulu.')}<div class="center"><button class="btn btn-primary" data-act="nav" data-to="#/m/allocation">Buka Pusat Alokasi</button></div></article>`;
  const { notes, pickup } = plan;
  return `${head('Rencana Produksi', 'Rencana produksimu sudah siap.', sessionPicker() + '<button class="btn" data-act="printPlan">' + icon('print', 16) + ' Cetak</button><button class="btn btn-primary" data-act="downloadPlan">' + icon('download', 16) + ' Unduh Ringkasan Produksi</button>')}
  <div class="kpis four"><article class="kpi"><span class="muted">Total menu terkonfirmasi</span><strong>${total}</strong></article><article class="kpi"><span class="muted">Total kapasitas produksi</span><strong>${totCap}</strong></article><article class="kpi"><span class="muted">Sisa kapasitas</span><strong>${plan.remaining}</strong></article><article class="kpi"><span class="muted">Jadwal pengambilan</span><strong class="sm-n">${hm(s.pickupStart)}–${hm(s.pickupEnd)}</strong><small>${esc(s.pickupLocation)}</small></article></div>
  <article class="card"><h2>Produksi Terkonfirmasi Hari Ini</h2>${plan.lines.map(l => `<div class="prod"><div class="row between"><b>${esc(l.name)}</b><span><strong class="big">${l.used}</strong> porsi <span class="muted">dari ${l.capacity}</span></span></div><div class="track big"><i class="c-first" style="width:${l.percent}%"></i></div></div>`).join('')}
  <div class="row between total"><b>Total</b><b>${total} porsi</b></div></article>
  <div class="grid-2"><article class="card"><h2>Catatan diet khusus</h2>${notes.length ? `<ul class="plain">${notes.map(n => `<li><b>${esc(n.shortId)}</b> ${esc(n.customerName)} → ${esc(n.menu)}<div class="muted sm">${esc([...n.diet, ...n.allergies.map(a => 'Alergi ' + a), n.other, n.note].filter(Boolean).join(', '))}</div></li>`).join('')}</ul>` : '<p class="muted">Tidak ada catatan khusus.</p>'}<p class="muted sm">Konfirmasi lagi kepada pelanggan dengan alergi serius. Menuflow tidak menjamin bebas kontaminasi silang.</p></article>
  <article class="card"><h2>Status pengambilan</h2><div class="kv"><span>Terkonfirmasi</span><b>${pickup.confirmed}</b></div><div class="kv"><span>Siap diambil</span><b>${pickup.ready}</b></div><div class="kv"><span>Sudah diambil</span><b>${pickup.completed}</b></div>
  <div class="row gap wrap mt"><button class="btn btn-primary" data-act="markAllReady" ${pickup.confirmed ? '' : 'disabled'}>Tandai semua siap diambil</button><button class="btn" data-act="markAllDone" ${pickup.ready ? '' : 'disabled'}>Simulasikan pengambilan (semua)</button></div></article></div>`;
}
const planText = () => buildPlanText(buildPlan(curSession(), S().orders, S().menus));

/* ---------- performance (sample data clearly labelled) ---------- */
const BASE = { prepared: [52, 50, 55, 48, 54, 50, 53], picked: [41, 42, 43, 40, 44, 41, 43] };
const FLOW = { prepared: [47, 46, 48, 45, 47, 46, 47], picked: [44, 43, 45, 42, 44, 43, 45] };
const sum = a => a.reduce((x, y) => x + y, 0);
const rate = d => (sum(d.prepared) - sum(d.picked)) / sum(d.prepared) * 100;
function pairChart(d, title) {
  const max = 60;
  return `<div class="pair"><h3 class="sub">${title}</h3><div class="pc" role="img" aria-label="${title}: porsi disiapkan dan diambil, 7 sesi">${d.prepared.map((p, i) => `<div class="pcol"><div class="pbars"><i class="c-acc" style="height:${p / max * 100}%" title="Disiapkan ${p}"></i><i class="c-first" style="height:${d.picked[i] / max * 100}%" title="Diambil ${d.picked[i]}"></i></div><small>S${i + 1}</small></div>`).join('')}</div></div>`;
}
export function performance() {
  const s = curSession(), L = live(s.id), fin = L.filter(o => o.finalMenu), done = L.filter(o => ['ready', 'completed'].includes(o.status) || o.status === 'completed');
  const processed = L.filter(o => o.status !== 'pending'), ok = processed.filter(o => o.finalMenu).length;
  const allocRate = processed.length ? Math.round(ok / processed.length * 1000) / 10 : null;
  const revenue = fin.reduce((a, o) => a + (o.finalPrice || 0), 0), aov = fin.length ? revenue / fin.length : 0;
  const accAvg = L.length ? sum(L.map(o => approvedIds(o).length)) / L.length : 0, menusN = Math.max(1, s.menus.length);
  const unres = processed.length ? Math.round(processed.filter(o => !o.finalMenu).length / processed.length * 1000) / 10 : 0;
  const prep = sum(FLOW.prepared), pick = sum(FLOW.picked), rem = prep - pick;
  const k = (t, v, sub, ic) => `<article class="kpi"><div class="row between"><span class="muted">${t}</span>${icon(ic, 18)}</div><strong>${v}</strong><small>${sub}</small></article>`;
  const top = [...demand(s.id)].sort((a, b) => b.first - a.first)[0];
  return `${head('Sisa Makanan &amp; Kinerja', 'Ukur apakah koordinasi pilihan pelanggan benar-benar memberi hasil.', sessionPicker() + badge('Data Contoh', 'info', 'info'))}
  <div class="alert info-box">${icon('info', 18)}<div><b>Data simulasi.</b> Angka 7 sesi di bawah adalah data contoh untuk demonstrasi, bukan hasil pengujian nyata. Menuflow tidak mengklaim persentase pengurangan food waste tanpa data uji lapangan.</div></div>
  <div class="kpis six">${k('Porsi Disiapkan', prep, '7 sesi (contoh)', 'package')}${k('Porsi Diambil', pick, '7 sesi (contoh)', 'check')}${k('Porsi Tersisa', rem, 'Disiapkan − Diambil', 'utensils')}${k('Estimasi Tingkat Sisa', rate(FLOW).toFixed(1) + '%', `Baseline ${rate(BASE).toFixed(1)}% (contoh)`, 'leaf')}${k('Kepuasan Pelanggan', '4.6 / 5', 'contoh', 'star')}${k('Tingkat Keberhasilan Alokasi', allocRate == null ? '94.0%' : allocRate + '%', allocRate == null ? 'contoh (belum ada alokasi hari ini)' : `langsung: ${ok} dari ${processed.length} pesanan hari ini`, 'merge')}</div>
  <article class="card"><h2>Formula</h2><p class="formula">Porsi Tersisa = Porsi Disiapkan − Porsi Diambil<br>Tingkat Sisa = Porsi Tersisa ÷ Porsi Disiapkan × 100%</p><p class="muted sm">Makanan tersisa belum tentu seluruhnya menjadi sampah makanan (bisa disumbangkan atau dipakai ulang secara aman). Pengukuran limbah aktual perlu dilakukan terpisah dengan penimbangan.</p></article>
  <article class="card"><div class="row between wrap"><h2>Produksi vs Permintaan Aktual</h2>${badge('Data Simulasi', 'info')}</div><div class="grid-2">${pairChart(BASE, `Baseline: perencanaan biasa (waste ${rate(BASE).toFixed(1)}%)`)}${pairChart(FLOW, `Menuflow: pilihan fleksibel (waste ${rate(FLOW).toFixed(1)}%)`)}</div><div class="legend"><span><i class="c-acc"></i>Disiapkan</span><span><i class="c-first"></i>Diambil</span></div></article>
  <h2 class="sec">Kinerja Bisnis <small class="muted">(sesi terpilih, data live dari prototype)</small></h2>
  <div class="kpis six">${k('Pendapatan', rp(revenue), 'dari pesanan dengan menu final', 'chart')}${k('Rata-rata Nilai Pesanan', rp(Math.round(aov)), fin.length ? `${fin.length} pesanan` : 'belum ada menu final', 'orders')}${k('Tingkat Alokasi', allocRate == null ? '-' : allocRate + '%', 'pesanan mendapat menu disetujui', 'merge')}${k('Tingkat Penerimaan Menu', Math.round(accAvg / menusN * 100) + '%', `rata-rata ${accAvg.toFixed(1)} dari ${menusN} menu disetujui`, 'check')}${k('Tingkat Pesanan Tanpa Menu', unres + '%', 'dari pesanan terproses', 'alert')}${k('Kepuasan Pelanggan', '4.6 / 5', 'contoh', 'star')}</div>
  <article class="card insight"><div class="eyebrow">${icon('info', 14)} Wawasan</div><p>${top ? `${esc(top.name)} memiliki permintaan menu utama tertinggi pada sesi ini (${top.first} pesanan) dibanding kapasitas ${top.capacity}. ${top.first > top.capacity ? 'Permintaannya melebihi kapasitas, pertimbangkan meninjau kapasitas pada sesi berikutnya.' : 'Kapasitasnya masih mencukupi.'}` : 'Belum ada data.'}</p></article>`;
}

/* ---------- settings ---------- */
export function settings() {
  const plan = (n, who, feats, hl) => `<article class="card plan ${hl ? 'hl' : ''}"><h3>${n}</h3><p class="muted sm">${who}</p><ul>${feats.map(f => `<li>${icon('check', 14)} ${f}</li>`).join('')}</ul><button class="btn ${hl ? 'btn-primary' : ''} btn-block" data-act="demoRequest" data-plan="${n}">${n === 'Enterprise' ? 'Hubungi Kami' : 'Minta Demo'}</button></article>`;
  return `${head('Pengaturan', 'Pengaturan kantin, kebijakan alokasi, dan paket langganan.')}
  <div class="grid-2"><article class="card"><h2>Profil kantin</h2><div class="kv"><span>Nama</span><b>Menuflow Campus Canteen</b></div><div class="kv"><span>Lokasi pengambilan default</span><b>Counter A</b></div></article>
  <article class="card"><h2>Kebijakan alokasi</h2><div class="kv"><span>Metode antrean</span><b>FIFO (waktu pesan)</b></div><div class="kv"><span>Prioritas</span><b>Menu utama dulu, lalu alternatif</b></div><div class="kv"><span>Pesanan tanpa menu</span><b>Tinjau manual / hubungi pelanggan</b></div><p class="muted sm">Tanpa AI atau pembelajaran mesin. Setiap hasil dapat ditinjau sebelum dipublikasikan.</p></article></div>
  <h2 class="sec">Model langganan B2B SaaS</h2><p class="muted">Harga ditentukan setelah konsultasi. Tidak ada transaksi langganan pada prototype ini.</p>
  <div class="plans">${plan('Starter', 'Untuk kantin kecil dan usaha makanan yang baru mencoba sistem.', ['Pengelolaan sesi makanan', 'Pengelolaan menu', 'Pemesanan fleksibel', 'Alokasi dasar', 'Laporan dasar'])}${plan('Growth', 'Untuk kantin dengan pelanggan berulang yang lebih besar.', ['Semua fitur Starter', 'Laporan lanjutan', 'Pengelolaan multi-sesi', 'Wawasan pelanggan', 'Ekspor laporan'], true)}${plan('Enterprise', 'Untuk perusahaan katering, kampus, dan jaringan kantin.', ['Pengelolaan multi-lokasi', 'Dasbor terpusat', 'Pengaturan operasional khusus', 'Laporan kinerja lanjutan', 'Dukungan khusus'])}</div>
  <article class="card"><h2>Data demo</h2><p class="muted">Kembalikan semua data (pesanan, sesi, menu, alokasi) ke kondisi awal demo.</p><button class="btn danger-o" data-act="askReset">${icon('refresh', 16)} Reset data demo</button></article>`;
}

/* ---------- actions ---------- */
Object.assign(actions, {
  doReset: () => { closeModal(); resetDemo(); toast('Data demo dikembalikan ke awal.'); go('#/m/overview'); },
  selectSession: (d, ev) => mutate(s => { s.ui.selectedSession = ev.target.value; s.ui.allocStep = 'work'; }),
  manageSession: ({ sid }) => { mutate(s => { s.ui.selectedSession = sid; }); go('#/m/sessions'); },
  newSession: () => openModal(sessionForm(null), { wide: true }),
  editSession: ({ sid }) => openModal(sessionForm(sessionOf(sid)), { wide: true }),
  setSessionStatus: ({ sid, to }) => {
    const s = sessionOf(sid);
    if (to === 'open' && (!s.menus.length || s.menus.some(m => { const x = menuOf(m.menuId); return !x || !x.allergensKnown || !x.active; }))) return toast('Sesi belum dapat dibuka: pastikan ada menu aktif dengan info bahan/alergen lengkap.', 'err');
    mutate(x => { sessionOf2(x, sid).status = to; if (to === 'open') x.notifications.unshift({ id: 'n' + Date.now(), to: 'customer', text: `Sesi ${s.name} dibuka untuk pemesanan.`, at: Date.now(), read: false }); });
    toast(to === 'open' ? 'Pemesanan dibuka.' : to === 'closed' ? 'Pemesanan ditutup.' : 'Sesi dinonaktifkan (Draft).');
  },
  newMenu: () => openModal(menuForm(null), { wide: true }),
  editMenu: ({ id }) => openModal(menuForm(menuOf(id)), { wide: true }),
  toggleMenu: ({ id }) => { mutate(s => { const m = s.menus.find(x => x.id === id); m.active = !m.active; }); toast('Status menu diperbarui. Menu nonaktif tidak akan dialokasikan.'); },
  askDeleteMenu: ({ id }) => {
    const m = menuOf(id), hit = S().orders.filter(o => o.status !== 'cancelled' && o.status !== 'completed' && (approvedIds(o).includes(id) || o.finalMenu === id));
    confirmDialog({ title: `Hapus ${m.name}?`, body: hit.length ? `<div class="alert warn-box">${icon('alert', 18)}<div><b>${hit.length} pesanan aktif terdampak.</b> Pesanan tersebut akan ditandai <i>Perlu ditinjau</i>. Menu yang sudah dikonfirmasi akan dikembalikan ke status menunggu alokasi. Pilihan pelanggan tidak diganti diam-diam.</div></div>` : 'Menu ini tidak dipilih oleh pesanan aktif mana pun.', ok: 'Hapus menu', danger: true, act: 'doDeleteMenu', data: `data-id="${id}"` });
  },
  doDeleteMenu: ({ id }) => {
    closeModal();
    mutate(s => {
      s.orders.forEach(o => { if (['cancelled', 'completed'].includes(o.status)) return; if (approvedIds(o).includes(id) || o.finalMenu === id) { o.needsReview = true; if (o.finalMenu === id) { o.finalMenu = null; o.finalPrice = null; o.allocationType = null; o.status = 'pending'; } if (o.customerId === 'c-mori') notify('customer', `Kantin meninjau pesananmu ${o.id} karena ada perubahan menu.`); } });
      s.menus = s.menus.filter(m => m.id !== id); s.sessions.forEach(x => { x.menus = x.menus.filter(m => m.menuId !== id); }); s.preview = null;
    });
    toast('Menu dihapus. Pesanan terdampak ditandai untuk ditinjau.');
  },
  setOFilter: ({ f }) => mutate(s => { s.ui.ofilter = f; }),
  openOrder: ({ id }) => openModal(orderDetail(orderOf(id)), { wide: true }),
  setOrderStatus: ({ id, to }) => {
    mutate(s => { const o = s.orders.find(x => x.id === id); o.status = to; if (to === 'ready' && o.customerId === 'c-mori') notify('customer', 'Pesananmu siap diambil.'); if (to === 'cancelled') s.preview = null; });
    closeModal(); toast('Status pesanan diperbarui.');
  },
  assignManual: ({ id }) => {
    const o = orderOf(id), mid = document.getElementById('assign-sel').value, s = sessionOf(o.sessionId);
    const v = validateOverride([], S().orders, s, S().menus, id, mid); if (!v.ok) return toast(v.error, 'err');
    mutate(x => { const q = x.orders.find(z => z.id === id); Object.assign(q, { finalMenu: mid, finalPrice: menuOf(mid).price, status: 'confirmed', allocationType: mid === q.primary ? 'matched' : 'alternative' }); if (q.customerId === 'c-mori') notify('customer', 'Menu final kamu sudah dikonfirmasi.'); });
    closeModal(); toast('Menu final ditetapkan (dari menu yang disetujui pelanggan).');
  },
  generatePreview: () => {
    const s = curSession();
    if (s.status === 'open' && effStatus(s) !== 'closed') return confirmDialog({ title: 'Tutup pemesanan & mulai alokasi?', body: 'Pesanan baru tidak akan diterima setelah ini agar daftar pesanan tetap konsisten.', ok: 'Tutup & buat pratinjau', act: 'runPreview' });
    actions.runPreview();
  },
  runPreview: async () => {
    closeModal();
    const b = document.getElementById('gen-btn'); if (b) { b.disabled = true; b.classList.add('loading'); b.textContent = 'Memeriksa pilihan & kapasitas…'; }
    await new Promise(r => setTimeout(r, 700));
    const s = curSession();
    mutate(x => { const ss = sessionOf2(x, s.id); if (['open', 'closed'].includes(ss.status)) ss.status = 'allocating'; x.preview = { sessionId: s.id, rows: generatePreview(ss, x.orders, x.menus), at: Date.now() }; x.ui.allocStep = 'work'; });
    toast('Pratinjau alokasi siap ditinjau. Belum ada pesanan yang diubah.');
    setTimeout(() => document.getElementById('preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  },
  recalc: () => { const s = curSession(); mutate(x => { x.preview = { sessionId: s.id, rows: generatePreview(sessionOf2(x, s.id), x.orders, x.menus), at: Date.now() }; }); toast('Alokasi dihitung ulang. Perubahan manual direset.'); },
  cancelDraft: () => { mutate(x => { x.preview = null; x.ui.allocStep = 'work'; const s = sessionOf2(x, curSession().id); if (s.status === 'allocating') s.status = 'closed'; }); toast('Draft dibatalkan. Tidak ada pesanan yang berubah.'); },
  override: ({ oid }, ev) => {
    const val = ev.target.value || null, st = S(), pv = st.preview, s = curSession();
    const v = validateOverride(pv.rows, st.orders, s, st.menus, oid, val);
    if (!v.ok) { toast(v.error, 'err'); return mutate(() => {}); }
    mutate(x => { x.preview.rows = applyOverride(x.preview.rows, oid, val, x.orders); }); toast('Alokasi diubah. Tinjau ringkasan sebelum konfirmasi.');
  },
  toReview: () => mutate(s => { s.ui.allocStep = 'review'; }),
  backToWork: () => mutate(s => { s.ui.allocStep = 'work'; }),
  askPublish: () => confirmDialog({ title: 'Publikasikan alokasi?', body: 'Menu final akan tampil di aplikasi pelanggan dan notifikasi dikirim. Pesanan unresolved tetap menunggu penyelesaian. Tindakan ini tidak dapat dibatalkan otomatis.', ok: 'Confirm & Publish', act: 'doPublish' }),
  doPublish: async () => {
    closeModal();
    const b = document.getElementById('pub-btn'); if (b) { b.disabled = true; b.classList.add('loading'); b.textContent = 'Mempublikasikan…'; }
    await new Promise(r => setTimeout(r, 800));
    const st = S(), s = curSession();
    try {
      const next = confirmAllocation(s, st.orders, st.menus, st.preview.rows);
      mutate(x => {
        x.orders = next; x.preview = null; x.ui.allocStep = 'work'; sessionOf2(x, s.id).status = 'completed';
        const mo = next.find(o => o.customerId === 'c-mori' && o.sessionId === s.id && ['confirmed', 'unresolved'].includes(o.status));
        if (mo) notify('customer', mo.status === 'confirmed' ? `Menu final kamu sudah dikonfirmasi: ${menuOf(mo.finalMenu).name}.` : 'Belum ada menu yang sesuai dengan pilihanmu. Pesananmu tidak dialihkan tanpa persetujuanmu.');
        notify('merchant', 'Alokasi berhasil dikonfirmasi.');
      });
      toast('Alokasi dipublikasikan ke pelanggan.'); go('#/m/production');
    } catch (e) { toast('Gagal mempublikasikan: ' + e.message, 'err'); mutate(() => {}); }
  },
  markAllReady: () => { mutate(x => { x.orders.forEach(o => { if (o.sessionId === curSession().id && o.status === 'confirmed') { o.status = 'ready'; } }); notify('customer', 'Pesananmu siap diambil.'); notify('merchant', 'Semua pesanan ditandai siap diambil.'); }); toast('Semua pesanan siap diambil.'); },
  markAllDone: () => { mutate(x => x.orders.forEach(o => { if (o.sessionId === curSession().id && o.status === 'ready') o.status = 'completed'; })); toast('Simulasi pengambilan selesai.'); },
  printPlan: () => window.print(),
  downloadPlan: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([planText()], { type: 'text/plain' })); a.download = 'menuflow-production-summary.txt'; a.click(); URL.revokeObjectURL(a.href); toast('Production summary diunduh.'); },
  demoRequest: ({ plan }) => openModal(`<h2>${plan === 'Enterprise' ? 'Hubungi Kami' : 'Minta Demo'}</h2><p class="muted">Simulasi: pada produk nyata formulir ini mengirim permintaan ke tim Menuflow. Tidak ada pembayaran pada prototype.</p><button class="btn btn-primary btn-block" data-act="closeModal">Mengerti</button>`),
  askReset: () => confirmDialog({ title: 'Reset semua data demo?', body: 'Semua pesanan, sesi, dan alokasi kembali ke kondisi awal.', ok: 'Reset', danger: true, act: 'doReset' }),
  openMNotifs: () => {
    const list = S().notifications.filter(n => n.to === 'merchant');
    openModal(`<div class="row between"><h2>Notifikasi</h2><button class="icon-btn" data-act="closeModal" aria-label="Tutup">${icon('x')}</button></div>${list.map(n => `<div class="notif ${n.read ? '' : 'unread'}"><span>${esc(n.text)}</span><small>${ago(n.at)}</small></div>`).join('') || emptyBox('Belum ada notifikasi')}`, { sheet: true });
    mutate(s => s.notifications.forEach(n => { if (n.to === 'merchant') n.read = true; }));
  },
});
const sessionOf2 = (state, id) => state.sessions.find(s => s.id === id);

export function onMerchantForm(name, fd, form) {
  const err = name === 'session' ? saveSession(fd, form.dataset.sid) : saveMenu(fd, form.dataset.id);
  const box = form.querySelector('#form-err');
  if (err.length) { box.hidden = false; box.innerHTML = `${icon('alert', 18)}<div><b>Periksa kembali:</b><ul>${err.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`; box.scrollIntoView({ block: 'nearest' }); return; }
  closeModal(); toast(name === 'session' ? 'Sesi disimpan.' : 'Menu disimpan.');
}
export function onSearch(v) { quiet(s => { s.ui.osearch = v; }); const el = document.getElementById('orders-list'); if (el) el.innerHTML = ordersTable(); }
