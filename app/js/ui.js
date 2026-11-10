// Shared helpers: escaping, formatting, icons, food illustrations, logo, modal and toast.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const rp = n => 'Rp' + Number(n).toLocaleString('id-ID');
export const hm = t => t.replace(':', '.');
export const clock = d => `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
export const dateLong = d => new Date(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const dateShort = d => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
export const ago = ms => { const m = Math.max(0, Math.round((Date.now() - ms) / 6e4)); return m < 1 ? 'baru saja' : m < 60 ? `${m} menit lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : `${Math.round(m / 1440)} hari lalu`; };

const I = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  orders: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  right: '<path d="m9 18 6-6-6-6"/>', left: '<path d="m15 18-6-6 6-6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  dash: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  merge: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>',
  chef: '<path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" x2="18" y1="17" y2="17"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  settings: '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/><circle cx="9" cy="6" r="2.2"/><circle cx="15" cy="12" r="2.2"/><circle cx="8" cy="18" r="2.2"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>', search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20"/><path d="M9 22v-6h6v6"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  print: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
};
export const icon = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

/** Menuflow mark: serving cloche + two-tone infinity ribbon + sparks. Matches the supplied logo. */
export const logoMark = (h = 32) => `<span class="mk" style="--h:${h}px" role="img" aria-label="Menuflow"></span>`;
export const logo = (h = 30) => `<span class="logo">${logoMark(h)}<span class="wordmark">Menuflow</span></span>`;

/** Food illustrations (no photos needed; every dish gets its own palette). */
export function dish(art, cls = '') {
  const bg = { teriyaki: '#f4e9d9', beef: '#e8efe9', katsu: '#f6eccb', generic: '#e7f3f0' }[art] || '#e7f3f0';
  const top = {
    teriyaki: '<g fill="#b4632f"><rect x="62" y="64" width="34" height="18" rx="8" transform="rotate(-12 79 73)"/><rect x="98" y="62" width="34" height="18" rx="8" transform="rotate(10 115 71)"/></g><g fill="#3e8f5f"><circle cx="76" cy="90" r="8"/><circle cx="90" cy="94" r="7"/><circle cx="132" cy="90" r="7"/></g><circle cx="108" cy="96" r="5" fill="#e8923a"/>',
    beef: '<g fill="#4a2f26"><rect x="60" y="64" width="38" height="16" rx="7" transform="rotate(-8 79 72)"/><rect x="100" y="66" width="36" height="16" rx="7" transform="rotate(8 118 74)"/></g><g fill="#d65f5f"><rect x="82" y="86" width="16" height="8" rx="4"/></g><g fill="#e8bd69"><rect x="106" y="90" width="18" height="7" rx="3.5"/></g><g fill="#202b2a"><circle cx="70" cy="70" r="1.6"/><circle cx="125" cy="72" r="1.6"/><circle cx="96" cy="76" r="1.6"/></g>',
    katsu: '<g fill="#d99a39"><rect x="58" y="62" width="30" height="24" rx="6"/><rect x="92" y="60" width="30" height="24" rx="6"/><rect x="126" y="64" width="26" height="22" rx="6"/></g><g fill="#f4d58a"><rect x="62" y="66" width="22" height="6" rx="3"/><rect x="96" y="64" width="22" height="6" rx="3"/></g><path d="M64 96q40 10 80 0" stroke="#7b3f1d" stroke-width="5" stroke-linecap="round" fill="none"/><g fill="#a8d5a2"><circle cx="152" cy="94" r="6"/><circle cx="162" cy="90" r="5"/></g>',
    generic: '<g fill="#176b65"><circle cx="86" cy="76" r="14"/><circle cx="118" cy="80" r="12"/></g><circle cx="102" cy="94" r="8" fill="#e8bd69"/>',
  }[art] || '';
  return `<svg class="dish ${cls}" viewBox="0 0 220 150" role="img" aria-label="Ilustrasi ${art}" preserveAspectRatio="xMidYMid slice"><rect width="220" height="150" fill="${bg}"/>
<ellipse cx="110" cy="128" rx="76" ry="9" fill="#202b2a" opacity=".08"/><ellipse cx="110" cy="92" rx="76" ry="38" fill="#fff"/><ellipse cx="110" cy="88" rx="62" ry="29" fill="#f7f8f6" stroke="#e5eaE7"/>
<path d="M56 86q54-40 108 0q-54 20-108 0Z" fill="#fff" stroke="#e5eaE7"/><g>${top}</g></svg>`;
}

/* modal + toast */
export function openModal(html, { wide = false, sheet = false } = {}) {
  const root = document.getElementById('modal-root');
  const el = document.createElement('div');
  el.className = 'modal-back' + (sheet ? ' sheet' : '');
  el.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`;
  root.appendChild(el);
  const prev = document.activeElement;
  el._prev = prev;
  const first = el.querySelector('[autofocus],input,select,textarea,button.btn-primary') || el.querySelector('.modal');
  first && first.focus();
  return el;
}
export function closeModal() {
  const root = document.getElementById('modal-root'), el = root.lastElementChild;
  if (!el) return;
  const prev = el._prev; el.remove(); prev && prev.isConnected && prev.focus();
}
export function toast(msg, kind = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.setAttribute('role', 'status');
  t.innerHTML = `${icon(kind === 'err' ? 'alert' : 'check', 18)}<span>${esc(msg)}</span>`;
  document.getElementById('toast-root').appendChild(t);
  setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3600);
}
export function confirmDialog({ title, body, ok = 'Ya, lanjutkan', danger = false, act, data = '' }) {
  return openModal(`<h2>${esc(title)}</h2><div class="muted mb">${body}</div><div class="row end gap"><button class="btn" data-act="closeModal">Batal</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="${act}" ${data}>${esc(ok)}</button></div>`);
}

export const badge = (text, kind = 'neutral', ic = '') => `<span class="badge b-${kind}">${ic ? icon(ic, 12) : ''}${esc(text)}</span>`;
export const STATUS = {
  pending: ['Menunggu alokasi', 'info', 'clock'], confirmed: ['Menu dikonfirmasi', 'ok', 'check'], ready: ['Siap diambil', 'ok', 'package'],
  completed: ['Selesai', 'neutral', 'check'], cancelled: ['Dibatalkan', 'err', 'x'], unresolved: ['Belum ada menu sesuai', 'warn', 'alert'],
};
export const statusBadge = s => badge(STATUS[s][0], STATUS[s][1], STATUS[s][2]);
