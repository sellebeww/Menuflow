// Menuflow allocation engine. Pure functions, no DOM, no storage.
// Rule set (shown to merchants in the UI): customer approval is a hard boundary,
// allergies/diet are hard constraints, capacity is never exceeded, FIFO queue,
// first choices are served before alternatives. No randomness, no AI.

export const ALLERGENS = { peanuts: 'Kacang', seafood: 'Seafood', egg: 'Telur', milk: 'Susu', soy: 'Kedelai', sesame: 'Wijen', wheat: 'Gandum' };
export const DIET = { vegetarian: 'Vegetarian', 'no-beef': 'Tanpa daging sapi', 'no-seafood': 'Tanpa seafood', 'no-spicy': 'Tidak pedas' };
const DIET_TAG = { 'no-beef': 'beef', 'no-seafood': 'seafood', 'no-spicy': 'spicy' };

/** Reasons why `menu` violates the order's hard constraints. Empty array = safe. */
export function conflicts(menu, r) {
  if (!menu) return ['Menu tidak lagi tersedia'];
  const out = [];
  const diet = r.diet || [], allergies = r.allergies || [];
  const other = (r.otherAllergy || '').trim().toLowerCase();
  if (!menu.active) out.push('Menu dinonaktifkan');
  if (!menu.allergensKnown && (diet.length || allergies.length || other)) out.push('Informasi bahan/alergen belum lengkap');
  for (const a of allergies) if ((menu.allergens || []).includes(a)) out.push(`Mengandung ${ALLERGENS[a] || a}`);
  if (other && menu.allergensKnown) {
    const hay = [...(menu.allergens || []), ...(menu.ingredients || [])].map(s => s.toLowerCase());
    if (hay.some(x => x.length > 2 && (x.includes(other) || other.includes(x)))) out.push(`Mengandung ${r.otherAllergy.trim()}`);
  }
  for (const d of diet) {
    if (d === 'vegetarian' && !(menu.tags || []).includes('vegetarian')) out.push('Bukan menu vegetarian');
    else if (DIET_TAG[d] && (menu.tags || []).includes(DIET_TAG[d])) out.push(`Bertentangan dengan ${DIET[d]}`);
  }
  return out;
}

/** The only menus an order may ever receive: primary first, then alternatives, in the customer's order. */
export const approvedIds = o => [o.primary, ...o.alts.filter(a => a !== o.primary)];

export function capacityMap(session, orders) {
  const used = {};
  for (const o of orders) if (o.sessionId === session.id && o.finalMenu && o.status !== 'cancelled') used[o.finalMenu] = (used[o.finalMenu] || 0) + 1;
  const map = {};
  for (const m of session.menus) map[m.menuId] = { capacity: m.capacity, used: used[m.menuId] || 0, left: m.capacity - (used[m.menuId] || 0) };
  return map;
}

const byQueue = (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id);

/**
 * Draft allocation. Does NOT mutate orders.
 * Phase 1 serves everybody's first choice in FIFO order while capacity lasts.
 * Phase 2 serves the leftovers with the alternatives they explicitly approved, FIFO, in their own order.
 */
export function generatePreview(session, orders, menus) {
  const menuById = Object.fromEntries(menus.map(m => [m.id, m]));
  const cap = capacityMap(session, orders);
  const left = Object.fromEntries(Object.entries(cap).map(([k, v]) => [k, v.left]));
  const pool = orders.filter(o => o.sessionId === session.id && ['pending', 'unresolved'].includes(o.status)).sort(byQueue);
  const rows = pool.map((o, i) => ({ orderId: o.id, queue: i + 1, primary: o.primary, menuId: null, status: 'unresolved', reason: '' }));
  const row = Object.fromEntries(rows.map(r => [r.orderId, r]));
  const okFor = (o, id) => id in left && left[id] > 0 && conflicts(menuById[id], o).length === 0;

  for (const o of pool) if (okFor(o, o.primary)) {
    left[o.primary]--; Object.assign(row[o.id], { menuId: o.primary, status: 'matched', reason: `Menu utama tersedia (antrean #${row[o.id].queue}).` });
  }
  for (const o of pool) {
    const r = row[o.id]; if (r.menuId) continue;
    const pick = o.alts.find(a => a !== o.primary && okFor(o, a));
    if (pick) {
      left[pick]--;
      Object.assign(r, { menuId: pick, status: 'alternative', reason: `${why(o.primary, o, menuById, left, cap)} Dialokasikan ke alternatif yang disetujui pelanggan: ${menuById[pick].name}.` });
    } else {
      r.reason = `Tidak ada menu yang disetujui pelanggan yang tersedia. ${[o.primary, ...o.alts].map(id => why(id, o, menuById, left, cap, true)).join(' ')}`.trim();
    }
  }
  return rows;
}

function why(id, o, menuById, left, cap, short) {
  const m = menuById[id], name = m ? m.name : id;
  const c = conflicts(m, o);
  if (c.length) return `${name}: ${c.join(', ')}.`;
  if (!(id in cap)) return `${name}: tidak ada di sesi ini.`;
  if ((left[id] ?? 0) <= 0) return short ? `${name}: kapasitas penuh.` : `Menu utama (${name}) sudah penuh.`;
  return '';
}

/** Check a manual change made by the merchant. menuId null = leave unresolved. */
export function validateOverride(rows, orders, session, menus, orderId, menuId) {
  if (menuId == null) return { ok: true };
  const o = orders.find(x => x.id === orderId);
  if (!o) return { ok: false, error: 'Pesanan tidak ditemukan.' };
  if (!approvedIds(o).includes(menuId)) return { ok: false, error: 'Menu ini tidak disetujui pelanggan.' };
  const c = conflicts(menus.find(m => m.id === menuId), o);
  if (c.length) return { ok: false, error: `Melanggar kebutuhan makanan: ${c.join(', ')}.` };
  const cap = capacityMap(session, orders)[menuId];
  if (!cap) return { ok: false, error: 'Menu tidak ada di sesi ini.' };
  const planned = rows.filter(r => r.menuId === menuId && r.orderId !== orderId).length;
  if (cap.used + planned + 1 > cap.capacity) return { ok: false, error: 'Kapasitas menu terlampaui.' };
  return { ok: true };
}

export function applyOverride(rows, orderId, menuId, orders) {
  return rows.map(r => {
    if (r.orderId !== orderId) return r;
    const o = orders.find(x => x.id === orderId);
    if (menuId == null) return { ...r, menuId: null, status: 'unresolved', reason: 'Diatur manual oleh merchant: belum dialokasikan.', manual: true };
    const status = menuId === o.primary ? 'matched' : 'alternative';
    return { ...r, menuId, status, reason: `Diubah manual oleh merchant ke ${menuId === o.primary ? 'menu utama' : 'alternatif yang disetujui pelanggan'}.`, manual: true };
  });
}

export function summarize(rows, session, orders) {
  const cap = capacityMap(session, orders);
  const perMenu = {};
  for (const id in cap) perMenu[id] = { ...cap[id], planned: rows.filter(r => r.menuId === id).length };
  for (const id in perMenu) perMenu[id].after = perMenu[id].capacity - perMenu[id].used - perMenu[id].planned;
  const count = s => rows.filter(r => r.status === s).length;
  const warnings = [];
  for (const id in perMenu) if (perMenu[id].after < 0) warnings.push({ menuId: id, text: 'Kapasitas terlampaui.' });
  return { total: rows.length, matched: count('matched'), alternative: count('alternative'), unresolved: count('unresolved'), perMenu, warnings };
}

/** Re-validates every row, then returns new orders. Throws rather than ever breaking a rule. */
export function confirmAllocation(session, orders, menus, rows) {
  const rowOf = Object.fromEntries(rows.map(r => [r.orderId, r]));
  const planned = {};
  for (const r of rows) {
    if (!r.menuId) continue;
    const o = orders.find(x => x.id === r.orderId);
    if (!approvedIds(o).includes(r.menuId)) throw new Error(`${o.id}: menu tidak disetujui pelanggan`);
    const c = conflicts(menus.find(m => m.id === r.menuId), o);
    if (c.length) throw new Error(`${o.id}: ${c.join(', ')}`);
    planned[r.menuId] = (planned[r.menuId] || 0) + 1;
  }
  const cap = capacityMap(session, orders);
  for (const id in planned) if (!cap[id] || cap[id].used + planned[id] > cap[id].capacity) throw new Error('Kapasitas terlampaui');
  const price = Object.fromEntries(menus.map(m => [m.id, m.price]));
  return orders.map(o => {
    const r = rowOf[o.id];
    if (!r) return o;
    if (r.menuId) return { ...o, status: 'confirmed', allocationType: r.status, finalMenu: r.menuId, finalPrice: price[r.menuId], needsReview: false };
    return { ...o, status: 'unresolved', allocationType: 'unresolved', finalMenu: null };
  });
}
