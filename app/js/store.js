import { makeSeed, isoDate } from './data.js';

const KEY = 'menuflow.v1';
let state = load();
const subs = new Set();

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.version === 2) return s; } catch { /* private mode or corrupt */ }
  return makeSeed();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable: keep in memory */ } }
const emit = () => subs.forEach(f => f());

export const getState = () => state;
export const subscribe = f => (subs.add(f), () => subs.delete(f));
export function mutate(fn) { fn(state); save(); emit(); }
/** Save without re-rendering: for text inputs, so typing never loses focus. */
export function quiet(fn) { fn(state); save(); }
export function resetDemo() { state = makeSeed(); save(); emit(); }
// Keep two tabs (customer in one, merchant in the other) in sync.
window.addEventListener('storage', e => { if (e.key === KEY && e.newValue) { try { state = JSON.parse(e.newValue); emit(); } catch { /* ignore */ } } });

/** Demo clock: starts at 09.30 and runs in real time, so cutoffs and countdowns are meaningful. */
export function simNow() {
  const c = state.clock, d = new Date(); d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() + c.simStartMin * 6e4 + (Date.now() - c.realStart));
}
export const cutoffTs = s => new Date(`${s.date}T${s.cutoff}:00`).getTime();
/** Status as customers see it. */
export function effStatus(s) {
  if (s.status !== 'open') return s.status;
  const left = cutoffTs(s) - simNow().getTime();
  return left <= 0 ? 'closed' : left <= 30 * 6e4 ? 'closing' : 'open';
}

export const menuOf = id => state.menus.find(m => m.id === id);
export const sessionOf = id => state.sessions.find(s => s.id === id);
export const orderOf = id => state.orders.find(o => o.id === id);

export function notify(to, text) {
  state.notifications.unshift({ id: 'n' + Date.now() + Math.random().toString(36).slice(2, 5), to, text, at: Date.now(), read: false });
}
export function nextOrderId() {
  const n = Math.max(0, ...state.orders.filter(o => o.id.startsWith('SS-2026-')).map(o => +o.id.slice(8))) + 1;
  return `SS-2026-${String(n).padStart(3, '0')}`;
}
export const todayIso = () => isoDate();
