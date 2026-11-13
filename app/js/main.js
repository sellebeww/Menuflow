import { getState, subscribe, quiet, simNow, effStatus, resetDemo } from './store.js';
import * as C from './customer.js';
import * as M from './merchant.js';
import { actions, go } from './actions.js';
import { logo, icon, closeModal, dateShort, clock, focusKey, refocus, trapTab } from './ui.js';

const app = document.getElementById('app');
actions.closeModal = closeModal;
actions.skipMain = () => document.getElementById('scroll')?.focus();

/* ---------- role screen ---------- */
function roleScreen() {
  return `<main class="role"><div class="role-in"><a class="back-site" href="../index.html">${icon('left', 16)} Kembali ke halaman utama</a>${logo(40)}
  <h1>Pilih sisi yang ingin kamu coba</h1><p class="muted">Prototype interaktif Menuflow. Data tersimpan di browser dan tersinkron antar tab: buka dua tab, satu sebagai customer dan satu sebagai merchant.</p>
  <div class="role-cards">
  <button class="role-card" data-act="enter" data-role="c"><span class="rc-ic">${icon('user', 26)}</span><b>Masuk sebagai Pelanggan</b><span class="muted">Akun demo: Mori. Pilih menu utama dan alternatif yang bersedia kamu terima.</span><span class="rc-go">Mulai ${icon('arrow', 16)}</span></button>
  <button class="role-card" data-act="enter" data-role="m"><span class="rc-ic dark">${icon('chef', 26)}</span><b>Masuk sebagai Merchant</b><span class="muted">Akun demo: Operator Dapur, Menuflow Campus Canteen. Lihat permintaan, alokasi, dan rencana produksi.</span><span class="rc-go">Mulai ${icon('arrow', 16)}</span></button></div>
  <p class="sm muted center">Login adalah simulasi. Tidak ada autentikasi, pembayaran, atau data nyata.</p></div></main>`;
}

/* ---------- customer shell ---------- */
const CNAV = [['home', 'Beranda', 'home'], ['orders', 'Pesanan', 'orders'], ['history', 'Riwayat', 'history'], ['profile', 'Profil', 'user']];
function customerView(p) {
  const [, page, arg] = p;
  const st = getState();
  if (!st.onboarded && page !== 'onboarding') { go('#/c/onboarding/1'); return null; }
  if (['session', 'food', 'review'].includes(page)) {
    const sid = page === 'session' ? arg : st.draft?.sessionId;
    if (page === 'session' && C.ensureDraft(sid)) return null; // nested render already ran
  }
  let html, nav = true;
  switch (page) {
    case 'onboarding': html = C.onboarding(arg); nav = false; break;
    case 'sessions': html = C.sessions(); break;
    case 'session': html = C.selection(arg); nav = false; break;
    case 'food': html = C.requirements(); nav = false; break;
    case 'review': html = C.review(); nav = false; break;
    case 'status': { const flash = st.ui.flash === arg; html = C.status(arg, flash); if (flash) quiet(s => { delete s.ui.flash; }); break; }
    case 'orders': html = C.ordersTab(); break;
    case 'history': html = C.history(); break;
    case 'profile': html = C.profile(); break;
    default: html = C.home();
  }
  const cur = { sessions: 'home', status: 'orders' }[page] || page;
  return `<div class="c-shell"><aside class="c-side">${logo(34)}<p class="muted">Customer app, prototype mobile-first.</p><button class="btn btn-sm" data-act="nav" data-to="#/">${icon('left', 14)} Ganti peran</button><a class="btn btn-sm" data-act="nav" data-to="#/m/overview">Buka sisi Merchant</a><small class="muted">Jam demo berjalan mulai 09.30 agar batas pemilihan 10.30 terasa nyata.</small></aside>
  <main class="phone"><div class="sbar" aria-hidden="true"><span>${clock(simNow())}</span><span>${icon('phone', 13)}<b>5G</b><svg width="22" height="12" viewBox="0 0 22 12" fill="none" stroke="currentColor"><rect x=".5" y=".5" width="18" height="11" rx="3"/><rect x="2.5" y="2.5" width="12" height="7" rx="1.5" fill="currentColor" stroke="none"/><path d="M20.5 4v4" stroke-linecap="round"/></svg></span></div><div class="c-scroll" id="scroll">${html}</div>${nav ? `<nav class="c-nav" aria-label="Navigasi utama">${CNAV.map(([k, t, ic]) => `<a href="#/c/${k}" class="${cur === k ? 'on' : ''}" ${cur === k ? 'aria-current="page"' : ''}>${icon(ic, 22)}<span>${t}</span></a>`).join('')}</nav>` : ''}</main></div>`;
}

/* ---------- merchant shell ---------- */
const MNAV = [['overview', 'Ringkasan', 'dash'], ['sessions', 'Sesi Makan', 'calendar'], ['orders', 'Pesanan', 'orders'], ['allocation', 'Pusat Alokasi', 'merge'], ['production', 'Rencana Produksi', 'chef'], ['menus', 'Kelola Menu', 'utensils'], ['performance', 'Sisa Makanan & Kinerja', 'chart'], ['settings', 'Pengaturan', 'settings']];
function merchantView(p) {
  const page = p[1] || 'overview', st = getState();
  const views = { overview: M.overview, sessions: M.sessions, orders: M.orders, allocation: M.allocation, production: M.production, menus: M.menus, performance: M.performance, settings: M.settings };
  const fn = views[page] || M.overview;
  const pend = st.orders.filter(o => o.sessionId === st.ui.selectedSession && ['pending', 'unresolved'].includes(o.status)).length;
  const un = st.notifications.filter(n => n.to === 'merchant' && !n.read).length;
  return `<div class="m-shell"><button type="button" class="skip-link" data-act="skipMain">Lewati ke konten utama</button><aside class="m-side"><div class="m-brand">${logo(30)}</div><nav aria-label="Menu merchant">${MNAV.map(([k, t, ic]) => `<a href="#/m/${k}" class="${page === k ? 'on' : ''}" ${page === k ? 'aria-current="page"' : ''}>${icon(ic, 18)}<span>${t.replace('&', '&amp;')}</span>${k === 'allocation' && pend ? `<em>${pend}</em>` : ''}</a>`).join('')}</nav>
  <div class="m-foot"><a href="#/">${icon('left', 14)} Ganti peran</a></div></aside>
  <div class="m-main"><header class="m-top"><div><b>Menuflow Campus Canteen</b><span class="muted"> · ${dateShort(simNow())} · <span data-clock>${clock(simNow())}</span> <em class="demo">jam demo</em></span></div>
  <div class="row gap"><button class="icon-btn bell" data-act="openMNotifs" aria-label="Notifikasi, ${un} belum dibaca">${icon('bell')}${un ? `<span class="dot">${un}</span>` : ''}</button><span class="role-chip">${icon('chef', 14)} Merchant</span><span class="avatar sm" aria-label="Profil">K</span></div></header>
  <main class="m-content" id="scroll" tabindex="-1">${fn()}</main></div></div>`;
}

/* ---------- router ---------- */
let lastKey = '', rendered = false;
function render() {
  const p = (location.hash.replace(/^#\/?/, '') || '').split('/');
  const key = location.hash;
  const sc = document.getElementById('scroll'), top = sc ? sc.scrollTop : 0, wtop = window.scrollY;
  let html;
  if (p[0] === 'c') html = customerView(p); else if (p[0] === 'm') html = merchantView(p); else html = roleScreen();
  if (html == null) return;
  const fk = focusKey(document.activeElement);
  app.innerHTML = html;
  const n = document.getElementById('scroll');
  if (n && key === lastKey) { n.scrollTop = top; window.scrollTo(0, wtop); } else { window.scrollTo(0, 0); }
  // Keyboard users keep their place after an action; on navigation, focus moves to the new page heading.
  const modalOpen = document.getElementById('modal-root').children.length > 0; // never pull focus out of an open dialog
  if (rendered && !modalOpen && !(key === lastKey && refocus(fk))) { const h = app.querySelector('h1'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
  lastKey = key; rendered = true; tick();
}
const pad = n => String(n).padStart(2, '0');
function tick() {
  const now = simNow().getTime(); let expired = false;
  document.querySelectorAll('[data-countdown]').forEach(el => {
    const d = +el.dataset.countdown - now;
    if (d <= 0) { expired = true; el.textContent = 'Ditutup'; return; }
    const s = Math.floor(d / 1000); el.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  });
  const c = document.querySelector('[data-clock]'); if (c) c.textContent = clock(simNow());
  if (expired && !tick.fired) { tick.fired = true; render(); } else if (!expired) tick.fired = false;
}
setInterval(tick, 1000);

/* ---------- events ---------- */
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-back')) return closeModal();
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'SELECT' || e.target.closest('select')) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el.dataset, e);
});
document.addEventListener('change', e => { const el = e.target; if (el.tagName === 'SELECT' && el.dataset.act) actions[el.dataset.act]?.(el.dataset, e); });
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault(); const fd = new FormData(f), name = f.dataset.form;
  name === 'profileReq' ? C.onForm(name, fd) : M.onMerchantForm(name, fd, f);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.bind) C.onBind(el.dataset.bind, el.value);
  if ('search' in el.dataset) M.onSearch(el.value);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); else if (e.key === 'Tab') trapTab(e); });

actions.enter = ({ role }, e) => {
  const b = e.target.closest('button'); b.classList.add('loading'); b.disabled = true;
  setTimeout(() => go(role === 'c' ? '#/c/home' : '#/m/overview'), 600);
};

window.addEventListener('hashchange', render);
subscribe(render);
render();
