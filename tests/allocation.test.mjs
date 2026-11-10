import assert from 'node:assert/strict';
import { makeSeed } from '../app/js/data.js';
import { generatePreview, summarize, confirmAllocation, validateOverride, approvedIds, conflicts, capacityMap } from '../app/js/allocation.js';

const s = makeSeed();
const session = s.sessions[0];
const rows = generatePreview(session, s.orders, s.menus);
const sum = summarize(rows, session, s.orders);
console.log(sum.total, 'orders ->', sum.matched, 'matched,', sum.alternative, 'alt,', sum.unresolved, 'unresolved');

// never allocate an unapproved menu, never an unsafe one, never over capacity
for (const r of rows) {
  const o = s.orders.find(x => x.id === r.orderId);
  if (!r.menuId) continue;
  assert(approvedIds(o).includes(r.menuId), 'unapproved menu allocated ' + o.id);
  assert.equal(conflicts(s.menus.find(m => m.id === r.menuId), o).length, 0);
}
for (const id in sum.perMenu) assert(sum.perMenu[id].after >= 0, 'over capacity ' + id);

// preview must not mutate orders
assert.equal(s.orders.filter(o => o.status === 'pending' && o.sessionId === 's1').length, 47);

// allergy is a hard stop: egg allergy cannot get katsu even if approved and free
const egg = { ...s.orders[0], id: 'X', allergies: ['egg'], primary: 'm-katsu', alts: ['m-teriyaki'] };
assert(conflicts(s.menus[2], egg).length > 0);
// incomplete allergen info is never assumed safe
assert(conflicts({ ...s.menus[0], allergensKnown: false }, egg).length > 0);

// every approved menu of an unresolved order must be rejected by override validation
const full = rows.find(r => r.status === 'unresolved');
const o = s.orders.find(x => x.id === full.orderId);
assert(approvedIds(o).every(id => !validateOverride(rows, s.orders, session, s.menus, o.id, id).ok));
// a menu the customer never approved is always rejected
const notApproved = s.menus.map(m => m.id).find(id => !approvedIds(o).includes(id));
if (notApproved) assert(!validateOverride(rows, s.orders, session, s.menus, o.id, notApproved).ok);

// confirm applies and respects capacity; tampered rows throw
const after = confirmAllocation(session, s.orders, s.menus, rows);
const cap = capacityMap(session, after);
for (const id in cap) assert(cap[id].left >= 0);
assert.throws(() => confirmAllocation(session, s.orders, s.menus, rows.map(r => ({ ...r, menuId: 'm-beef' }))));
console.log('ok');
