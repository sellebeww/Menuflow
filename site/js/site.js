(() => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, ms));

/* nav */
const nav = $('#nav'), burger = $('#burger'), links = $('#links');
const onScroll = () => nav.classList.toggle('scrolled', scrollY > 12);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
burger.addEventListener('click', () => { const o = links.classList.toggle('open'); burger.setAttribute('aria-expanded', o); });
links.addEventListener('click', e => { if (e.target.closest('a')) { links.classList.remove('open'); burger.setAttribute('aria-expanded', false); } });

/* reveal + count-up */
const countUp = el => {
  const to = +el.dataset.count; if (reduce) return (el.textContent = to);
  const t0 = performance.now(), dur = 1200;
  const f = t => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); p < 1 && requestAnimationFrame(f); };
  requestAnimationFrame(f);
};
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in'); $$('[data-count]', e.target).forEach(countUp); io.unobserve(e.target);
}), { threshold: .18 });
$$('.reveal').forEach(el => io.observe(el));

/* footer placeholders */
$$('[data-soon]').forEach(a => a.addEventListener('click', e => e.preventDefault()));
$('#demo-btn').addEventListener('click', e => { e.preventDefault(); $('#demo-msg').hidden = false; });

/* ========== hero: live allocation simulation (same two-pass rule as the app) ========== */
const MENUS = { T: { name: 'Teriyaki', cap: 4 }, B: { name: 'Beef Pepper', cap: 3 }, K: { name: 'Katsu', cap: 4 } };
const PEOPLE = [['Andi', 'T', 'K'], ['Sarah', 'B', 'T'], ['Dani', 'K', 'T'], ['Rina', 'T', 'B'], ['Bayu', 'T', 'K'], ['Putri', 'B', 'K'], ['Fajar', 'T', 'K'], ['Lestari', 'K', 'B'], ['Dimas', 'T', 'KB'], ['Nadia', 'B', 'T'], ['Reza', 'T', 'K'], ['Maya', 'B', 'T']];
const stage = $('#stage'), tEl = $('#tickets'), mEl = $('#menus'), phase = $('#stage-phase');
let run = 0;

function build() {
  tEl.innerHTML = PEOPLE.map(([n, p, a], i) => `<li class="tk-i" data-i="${i}"><b>${n}</b><span class="p">${MENUS[p].name.split(' ')[0]}</span>${[...a].map(x => `<span class="a">${MENUS[x].name.split(' ')[0]}</span>`).join('')}<em></em></li>`).join('');
  mEl.innerHTML = Object.entries(MENUS).map(([k, m]) => `<div class="mn" data-m="${k}"><div class="mn-h">${m.name}<span class="cnt">0/${m.cap}</span></div><div class="slots">${'<i class="slot"></i>'.repeat(m.cap)}</div></div>`).join('');
  ['s-main', 's-alt', 's-un'].forEach(id => ($('#' + id).textContent = 0));
}
const tk = i => $(`.tk-i[data-i="${i}"]`), mn = k => $(`.mn[data-m="${k}"]`);
async function fly(i, k, alt) {
  if (reduce) return;
  const a = tk(i).getBoundingClientRect(), b = mn(k).getBoundingClientRect(), body = $('.stage-body', stage), s = body.getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'fly' + (alt ? ' alt' : ''); el.textContent = PEOPLE[i][0];
  el.style.left = a.right - s.left - 60 + 'px'; el.style.top = a.top - s.top + 'px'; body.appendChild(el);
  const dx = b.left - a.right + 90, dy = b.top - a.top + 16;
  await el.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx * .5}px,${dy * .2 - 24}px) scale(1.1)`, opacity: 1, offset: .5 }, { transform: `translate(${dx}px,${dy}px) scale(.8)`, opacity: .2 }], { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)' }).finished;
  el.remove();
}
function place(i, k, alt) {
  const m = mn(k), free = $$('.slot', m).find(s => !s.classList.contains('f') && !s.classList.contains('a'));
  free.classList.add(alt ? 'a' : 'f'); m.classList.add('pulse'); setTimeout(() => m.classList.remove('pulse'), 400);
  const used = $$('.slot.f,.slot.a', m).length; $('.cnt', m).textContent = `${used}/${MENUS[k].cap}`; m.classList.toggle('full', used === MENUS[k].cap);
  const t = tk(i); t.classList.remove('wait'); t.classList.add(alt ? 'alt' : 'placed'); $('em', t).textContent = alt ? '→ ' + MENUS[k].name.split(' ')[0] : '✓';
  const c = $(alt ? '#s-alt' : '#s-main'); c.textContent = +c.textContent + 1;
}
const left = k => MENUS[k].cap - $$('.slot.f,.slot.a', mn(k)).length;

async function simulate() {
  const my = ++run; build();
  const live = () => my === run;
  phase.textContent = 'Pesanan masuk';
  for (let i = 0; i < PEOPLE.length; i++) { tk(i).classList.add('show'); await wait(reduce ? 0 : 110); if (!live()) return; }
  await wait(500); if (!live()) return;
  phase.textContent = 'Pass 1 · pilihan utama (urut waktu pesan)';
  const waiting = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    const k = PEOPLE[i][1];
    if (left(k) > 0) { await fly(i, k, false); if (!live()) return; place(i, k, false); await wait(reduce ? 0 : 70); }
    else { tk(i).classList.add('wait'); $('em', tk(i)).textContent = 'penuh'; waiting.push(i); }
  }
  await wait(900); if (!live()) return;
  phase.textContent = 'Pass 2 · hanya alternatif yang disetujui';
  for (const i of waiting) {
    const pick = [...PEOPLE[i][2]].find(k => left(k) > 0);
    if (pick) { await fly(i, pick, true); if (!live()) return; place(i, pick, true); }
    else { tk(i).classList.remove('wait'); tk(i).classList.add('un'); $('em', tk(i)).textContent = 'ditinjau'; const u = $('#s-un'); u.textContent = +u.textContent + 1; }
    await wait(reduce ? 0 : 350); if (!live()) return;
  }
  phase.textContent = 'Selesai · tidak ada menu yang dipaksakan';
  await wait(5200); if (live()) simulate();
}
$('#stage-replay').addEventListener('click', simulate);
new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { simulate(); o.disconnect(); } }, { threshold: .3 }).observe(stage);

/* ========== compare: one choice vs Menuflow ========== */
const CMP = [{ n: 'Chicken Teriyaki', want: 23, cap: 20, alt: 0 }, { n: 'Beef Black Pepper', want: 17, cap: 15, alt: 0 }, { n: 'Chicken Katsu', want: 12, cap: 15, alt: 3 }];
const compare = $('.compare'), bars = $('#cmp-bars');
const max = 26, pc = v => (v / max) * 100 + '%';
bars.innerHTML = CMP.map((m, i) => `<div><div class="cb-t">${m.n}<span>permintaan ${m.want} · kapasitas ${m.cap}</span></div><div class="cb-track"><div class="cb-fill" data-i="${i}"></div><div class="cb-alt" data-i="${i}"></div><div class="cb-cap" style="left:${pc(m.cap)}"></div></div><div class="cb-note" data-n="${i}"></div></div>`).join('');
function setMode(mode) {
  const nw = mode === 'new'; compare.classList.toggle('is-new', nw);
  $$('.seg button', compare).forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  CMP.forEach((m, i) => {
    const served = Math.min(m.want, m.cap), extra = nw ? m.alt : 0;
    $(`.cb-fill[data-i="${i}"]`).style.width = pc(served);
    const alt = $(`.cb-alt[data-i="${i}"]`); alt.style.left = pc(served); alt.style.width = pc(extra);
    const over = m.want - m.cap, note = $(`[data-n="${i}"]`);
    note.innerHTML = over > 0 ? `<b>${over} pelanggan tidak kebagian</b> karena menu penuh.` : (nw ? `<span class="g">+${extra} pelanggan dari menu lain terlayani lewat alternatif yang disetujui.</span>` : `<b>${m.cap - m.want} porsi tidak terambil.</b>`);
  });
  const r = nw ? { served: 50, un: 2, left: 0 } : { served: 47, un: 5, left: 3 };
  $$('[data-k]', compare).forEach(el => (el.textContent = r[el.dataset.k]));
}
$$('.seg button', compare).forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
setMode('old');
// replay the contrast once on first view so the story is visible without clicking
new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { setTimeout(() => setMode('new'), 2600); o.disconnect(); } }, { threshold: .6 }).observe(compare);

/* ========== product tour ========== */
const chart = $('#dash-chart');
chart.innerHTML = [['Chicken Teriyaki', 20, 20], ['Beef Black Pepper', 15, 15], ['Chicken Katsu', 14, 15]].map(([n, a, c]) => `<div class="dc"><b>${n} <span style="font-weight:500;color:#5f6b67">· ${a}/${c} porsi</span></b><div class="tr a"><i data-w="${a / 20 * 100}"></i></div><div class="tr c"><i data-w="${c / 20 * 100}"></i></div></div>`).join('');
const fillDash = () => $$('.dc i', chart).forEach(i => { i.style.width = '0'; requestAnimationFrame(() => requestAnimationFrame(() => (i.style.width = i.dataset.w + '%'))); });
$$('.tabs button').forEach(b => b.addEventListener('click', () => {
  $$('.tabs button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
  $$('.tv').forEach(v => v.classList.toggle('on', v.id === 'tv-' + b.dataset.tab)); if (b.dataset.tab === 'm') fillDash();
}));

/* ribbon parallax */
const rib = $('.hero-ribbon');
if (!reduce) addEventListener('scroll', () => { rib.style.transform = `translateY(${Math.min(scrollY, 700) * .12}px)`; }, { passive: true });
})();
