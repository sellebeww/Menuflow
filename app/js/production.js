// Menuflow production plan. Pure functions, no DOM, no storage.
// Aggregates the confirmed orders of one session into the numbers the kitchen needs.

import { ALLERGENS, DIET, capacityMap } from './allocation.js';

/** Bar width in percent. Safe for capacity 0 and for used > capacity; never leaves 0..100. */
export function barPercent(used, capacity) {
  if (!(capacity > 0)) return used > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, used / capacity * 100));
}

/** Special-needs labels of one order, tolerant of legacy orders without those fields. */
export function orderNotes(o) {
  return {
    diet: (o.diet || []).map(d => DIET[d] || d),
    allergies: (o.allergies || []).map(a => ALLERGENS[a] || a),
    other: o.otherAllergy || '',
    note: o.notes || '',
  };
}
const hasNotes = o => { const n = orderNotes(o); return n.diet.length || n.allergies.length || n.other || n.note; };

/**
 * Plan for one session. `orders` may hold any sessions; cancelled orders and orders
 * without a final menu are ignored. Menus are looked up by id in `menus`.
 */
export function buildPlan(session, orders, menus) {
  const menuById = Object.fromEntries(menus.map(m => [m.id, m]));
  const confirmed = orders.filter(o => o.sessionId === session.id && o.status !== 'cancelled' && o.finalMenu);
  const cap = capacityMap(session, orders);
  const label = id => menuById[id]?.short || menuById[id]?.name || '(dihapus)';
  const lines = session.menus.map(m => {
    const c = cap[m.menuId];
    return { menuId: m.menuId, name: menuById[m.menuId]?.name || '', short: label(m.menuId), used: c.used, capacity: c.capacity, percent: barPercent(c.used, c.capacity) };
  });
  const total = confirmed.length;
  const totalCapacity = session.menus.reduce((a, m) => a + m.capacity, 0);
  return {
    session: { id: session.id, name: session.name, date: session.date, pickupStart: session.pickupStart, pickupEnd: session.pickupEnd, pickupLocation: session.pickupLocation },
    lines,
    total,
    totalCapacity,
    remaining: totalCapacity - total,
    notes: confirmed.filter(hasNotes).map(o => ({ id: o.id, shortId: o.id.slice(8), customerName: o.customerName, menu: label(o.finalMenu), ...orderNotes(o) })),
    pickup: {
      confirmed: confirmed.filter(o => o.status === 'confirmed').length,
      ready: confirmed.filter(o => o.status === 'ready').length,
      completed: confirmed.filter(o => o.status === 'completed').length,
    },
  };
}

/** Plain-text summary for the kitchen chat. Fixed English wording (it is a file format, not UI). */
export function planText(plan) {
  const s = plan.session;
  return [
    'MENUFLOW PRODUCTION SUMMARY',
    `${s.name} - ${s.date}`,
    `Pickup: ${s.pickupStart}-${s.pickupEnd} @ ${s.pickupLocation}`,
    '',
    ...plan.lines.map(l => `${l.name}: ${l.used} / ${l.capacity} portions`),
    `TOTAL: ${plan.total} portions`,
    '',
    'Special dietary notes:',
    ...plan.notes.map(n => `- ${n.id} ${n.customerName} (${n.menu}): ${[...n.diet, ...n.allergies.map(a => 'Allergy ' + a), n.other, n.note].filter(Boolean).join(', ')}`),
    '',
    'Allergen info is provided by the canteen; cross-contamination is not guaranteed free.',
  ].join('\n');
}
