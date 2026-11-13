// Deterministic fixtures. No Date.now(), no randomness: every timestamp is explicit.
export const menu = (id, over = {}) => ({
  id, name: `Menu ${id}`, short: id, price: 20000, active: true, allergensKnown: true,
  ingredients: ['Nasi'], allergens: [], tags: [], ...over,
});

export const session = (menus, over = {}) => ({
  id: 's1', name: 'Makan Siang', date: '2026-01-15', pickupStart: '12:00', pickupEnd: '13:30', pickupLocation: 'Counter A',
  menus: Object.entries(menus).map(([menuId, capacity]) => ({ menuId, capacity })), ...over,
});

let seq = 0;
/** createdAt defaults to an increasing counter, so queue order = creation order unless set explicitly. */
export const order = (id, over = {}) => ({
  id, sessionId: 's1', customerName: `Cust ${id}`, primary: 'a', alts: [], diet: [], allergies: [], otherAllergy: '', notes: '',
  createdAt: ++seq, status: 'pending', allocationType: null, finalMenu: null, finalPrice: null, ...over,
});

export const byId = rows => Object.fromEntries(rows.map(r => [r.orderId, r]));
