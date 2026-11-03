document.documentElement.classList.add('js');

const root = document.documentElement;
const header = document.getElementById('header');
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
const hero = document.getElementById('inicio');
const stage = hero.querySelector('.melt__stage');
const scene = document.getElementById('scene');
const copyEl = scene.querySelector('.melt__copy');
const pieceEl = scene.querySelector('.melt__piece');
const canvas = document.getElementById('choco');
const pourEl = document.getElementById('pour');
const endBox = document.getElementById('end');
const hint = document.getElementById('hint');
const meltMap = document.getElementById('melt-map');
const products = document.getElementById('productos');
const ctx = canvas.getContext('2d');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Móvil y pantallas táctiles: sin lienzo ni filtro SVG. El chocolate es un dibujo fijo que se desplaza. */
const lite = window.matchMedia('(max-width: 860px), (pointer: coarse)');
/* Si el navegador sabe animar con el scroll por sí solo (hilo del compositor), JavaScript no toca nada por fotograma */
const scrollDriven = window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()') && !location.search.includes('nosd');
if (scrollDriven) root.classList.add('sd');

/* ---------- utilidades ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* Suaviza una curva de alturas para que los goteos se fundan como líquido */
function blur(ys, radius, passes) {
  let a = ys, b = new Float32Array(ys.length);
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < a.length; i++) {
      let sum = 0, n = 0;
      for (let k = -radius; k <= radius; k++) {
        const j = i + k;
        if (j >= 0 && j < a.length) { sum += a[j]; n++; }
      }
      b[i] = sum / n;
    }
    [a, b] = [b, a];
  }
  return a;
}

/* ---------- medidas ---------- */
let W = 0, H = 0, mode = '', dpr = 1, drips = [], step = 3;
let heroH = 0, productsTop = 0, lastPour = -1;

function measure() {
  heroH = hero.offsetHeight;
  productsTop = products.offsetTop;
}

function buildDrips() {
  const rand = rng(11);
  const count = Math.max(6, Math.round(W / 64));
  drips = Array.from({ length: count }, (_, i) => ({
    cx: (i + 0.5 + (rand() - 0.5) * 0.7) * (W / count),
    w: 15 + rand() * 30,
    len: H * (0.1 + rand() * 0.34),
    delay: rand() * 0.38,
  }));
}

/* ---------- escritorio: chocolate dibujado en un lienzo que crece con el scroll ---------- */
function drawChoco(pc) {
  if (pc === lastPour) return;
  lastPour = pc;
  ctx.clearRect(0, 0, W, H);
  if (pc <= 0.001) return;

  const base = -90 + pc * (H + 130);
  const n = Math.ceil(W / step) + 1;
  let ys = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * step;
    ys[i] = base + 7 * Math.sin(x * 0.012 + 1.3) + 4 * Math.sin(x * 0.031);
  }

  const tips = [];
  for (const d of drips) {
    const len = d.len * smooth(d.delay, d.delay + 0.55, pc);
    if (len < 2) continue;
    const from = Math.max(0, Math.floor((d.cx - d.w) / step));
    const to = Math.min(n - 1, Math.ceil((d.cx + d.w) / step));
    for (let i = from; i <= to; i++) {
      const t = (i * step - d.cx) / d.w;
      const h = len * Math.pow(Math.max(0, 1 - t * t), 0.62);
      if (base + h > ys[i]) ys[i] = base + h;
    }
    tips.push({ x: d.cx, y: base + len, w: d.w, len });
  }
  ys = blur(ys, 3, 2);

  const body = new Path2D();
  body.moveTo(0, -4);
  body.lineTo(0, ys[0]);
  for (let i = 1; i < n; i++) body.lineTo(i * step, ys[i]);
  body.lineTo(W, -4);
  body.closePath();

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#4d2a19');
  g.addColorStop(1, '#2e170d');
  ctx.fillStyle = g;
  ctx.fill(body);

  if (pc >= 0.995) return;

  const edge = new Path2D();
  edge.moveTo(0, ys[0]);
  for (let i = 1; i < n; i++) edge.lineTo(i * step, ys[i]);
  ctx.save();
  ctx.clip(body);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.translate(0, -9);
  ctx.strokeStyle = 'rgba(255, 214, 180, .22)';
  ctx.lineWidth = 4;
  ctx.stroke(edge);
  ctx.translate(5, -5);
  ctx.strokeStyle = 'rgba(255, 255, 255, .08)';
  ctx.lineWidth = 9;
  ctx.stroke(edge);
  ctx.restore();

  ctx.fillStyle = 'rgba(255, 240, 225, .28)';
  for (const t of tips) {
    if (t.len < 24) continue;
    ctx.beginPath();
    ctx.ellipse(t.x - t.w * 0.28, t.y - t.w * 0.7, t.w * 0.13, t.w * 0.3, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------- móvil: el mismo chocolate como dibujo fijo (se pinta una sola vez) ---------- */
function buildPour() {
  const S = H * 1.6;                       /* alto total de la lámina */
  const base = H * 1.1;                    /* línea del chocolate; de ahí cuelgan los goteos */
  const stepP = 4;
  const n = Math.ceil(W / stepP) + 1;
  let ys = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * stepP;
    ys[i] = base + 7 * Math.sin(x * 0.012 + 1.3) + 4 * Math.sin(x * 0.031);
  }
  const rand = rng(11);
  const count = Math.max(6, Math.round(W / 64));
  const tips = [];
  for (let k = 0; k < count; k++) {
    const cx = (k + 0.5 + (rand() - 0.5) * 0.7) * (W / count);
    const w = 15 + rand() * 30;
    const len = H * (0.1 + rand() * 0.34);
    rand();
    for (let i = 0; i < n; i++) {
      const t = (i * stepP - cx) / w;
      if (Math.abs(t) >= 1) continue;
      const y = base + len * Math.pow(1 - t * t, 0.62);
      if (y > ys[i]) ys[i] = y;
    }
    if (len > 24) tips.push({ x: cx, y: base + len, w });
  }
  ys = blur(ys, 2, 2);

  let edge = `M0,${ys[0].toFixed(1)}`;
  for (let i = 1; i < n; i++) edge += ` L${i * stepP},${ys[i].toFixed(1)}`;
  const body = `M0,-10 L0,${ys[0].toFixed(1)}${edge.slice(edge.indexOf(' L'))} L${W},-10 Z`;
  const dots = tips.map((t) =>
    `<ellipse cx="${(t.x - t.w * 0.28).toFixed(1)}" cy="${(t.y - t.w * 0.7).toFixed(1)}" rx="${(t.w * 0.13).toFixed(1)}" ry="${(t.w * 0.3).toFixed(1)}" fill="rgba(255,240,225,.28)" transform="rotate(8 ${t.x.toFixed(1)} ${t.y.toFixed(1)})"/>`
  ).join('');

  pourEl.setAttribute('viewBox', `0 0 ${W} ${S}`);
  pourEl.innerHTML =
    `<defs>
      <linearGradient id="pg" gradientUnits="userSpaceOnUse" x1="0" y1="${(H * 0.1).toFixed(0)}" x2="0" y2="${(H * 1.1).toFixed(0)}">
        <stop offset="0" stop-color="#4d2a19"/><stop offset="1" stop-color="#2e170d"/>
      </linearGradient>
      <clipPath id="pc"><path d="${body}"/></clipPath>
    </defs>
    <path d="${body}" fill="url(#pg)"/>
    <g clip-path="url(#pc)"><path d="${edge}" fill="none" stroke="rgba(255,214,180,.22)" stroke-width="4" stroke-linecap="round" transform="translate(0,-9)"/></g>
    ${dots}`;
}

function layout() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const m = lite.matches ? 'l' : 'd';
  /* en móvil el resize salta al ocultarse la barra del navegador: si nada cambió, no se toca */
  if (w === W && h === H && m === mode) return false;
  W = w; H = h; mode = m;
  if (m === 'l') {
    buildPour();
  } else {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    step = 3;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildDrips();
  }
  lastPour = -1;
  return true;
}

/* ---------- flecos estáticos hacia la sección de productos ---------- */
function buildFringe() {
  const path = document.getElementById('fringe-path');
  if (!path) return;
  const FW = 1440, fstep = 4;
  const rand = rng(29);
  const n = Math.ceil(FW / fstep) + 1;
  let ys = new Float32Array(n);
  for (let i = 0; i < n; i++) ys[i] = 34 + 5 * Math.sin(i * fstep * 0.014) + 3 * Math.sin(i * fstep * 0.037 + 2);
  const count = 17;
  for (let k = 0; k < count; k++) {
    const cx = (k + 0.5 + (rand() - 0.5) * 0.7) * (FW / count);
    const w = 18 + rand() * 30;
    const len = 36 + rand() * 94;
    for (let i = 0; i < n; i++) {
      const t = (i * fstep - cx) / w;
      if (Math.abs(t) >= 1) continue;
      const y = 34 + len * Math.pow(1 - t * t, 0.62);
      if (y > ys[i]) ys[i] = y;
    }
  }
  ys = blur(ys, 3, 2);
  let d = `M0,0 L0,${ys[0].toFixed(1)}`;
  for (let i = 1; i < n; i++) d += ` L${i * fstep},${ys[i].toFixed(1)}`;
  d += ` L${FW},0 Z`;
  path.setAttribute('d', d);
}

/* ---------- scroll ---------- */
let ticking = false;
let wasFilter = false;
let headerState = '';
let sceneHidden = null;
let endOn = null;
let cleaned = false;

function render() {
  ticking = false;
  const y = window.scrollY;
  const total = heroH - H;
  const p = reduceMotion || total <= 0 ? 1 : clamp(y / total);

  const melt = reduceMotion ? 0 : smooth(0.05, 0.66, p);
  const pour = reduceMotion ? 1 : smooth(0.1, 0.72, p);
  const text = reduceMotion ? 1 : smooth(0.74, 0.9, p);
  const isLite = lite.matches;
  const css = isLite && scrollDriven && !reduceMotion;   /* el navegador anima solo, JS solo marca estados */

  if (isLite) {
    if (wasFilter) { scene.style.filter = ''; scene.style.transform = ''; wasFilter = false; }
    if (!css) {
      /* sin animación por scroll en CSS: solo transformaciones sobre capas ya pintadas */
      pourEl.style.transform = `translate3d(0, ${lerp(-1.6 * H, 30 - 0.1 * H, pour).toFixed(1)}px, 0)`;
      copyEl.style.transform = `translate3d(0, ${(melt * 0.07 * H).toFixed(1)}px, 0)`;
      copyEl.style.opacity = String(1 - melt * 0.85);
      pieceEl.style.transform = `translate3d(0, ${(melt * 0.13 * H).toFixed(1)}px, 0) scaleY(${(1 + melt * 0.5).toFixed(3)})`;
      endBox.style.opacity = String(text);
      endBox.style.transform = `translate3d(0, ${((1 - text) * 36).toFixed(1)}px, 0)`;
      hint.style.opacity = String(1 - smooth(0.02, 0.1, p));
      cleaned = false;
    } else if (!cleaned) {
      for (const el of [pourEl, copyEl, pieceEl, endBox, hint]) { el.style.transform = ''; el.style.opacity = ''; }
      cleaned = true;
    }
  } else {
    copyEl.style.transform = ''; copyEl.style.opacity = ''; pieceEl.style.transform = '';
    pourEl.style.transform = '';
    if (melt > 0.01) {
      scene.style.filter = 'url(#melt-filter)';
      meltMap.setAttribute('scale', String(Math.round(melt * Math.min(220, W * 0.32))));
      scene.style.transform = `translateY(${(melt * 10).toFixed(2)}svh) scaleY(${(1 + melt * 0.4).toFixed(3)})`;
      wasFilter = true;
    } else if (wasFilter) {
      scene.style.filter = '';
      scene.style.transform = '';
      wasFilter = false;
    }
    drawChoco(pour);
    endBox.style.opacity = String(text);
    endBox.style.transform = `translate3d(0, ${((1 - text) * 36).toFixed(1)}px, 0)`;
    hint.style.opacity = String(1 - smooth(0.02, 0.1, p));
    cleaned = false;
  }

  const hide = pour >= 0.995;
  if (hide !== sceneHidden) { sceneHidden = hide; scene.style.visibility = hide ? 'hidden' : 'visible'; }
  const on = text > 0.6;
  if (on !== endOn) { endOn = on; endBox.classList.toggle('is-on', on); }

  /* cabecera: clara sobre la crema, transparente sobre el chocolate */
  const overChoco = (p > 0.27 || reduceMotion) && productsTop - y > -30;
  const state = (overChoco ? 'd' : '') + (y > 8 ? 's' : '');
  if (state !== headerState) {
    headerState = state;
    header.classList.toggle('on-dark', overChoco);
    header.classList.toggle('is-scrolled', y > 8);
  }
}

const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(render); } };

window.addEventListener('scroll', request, { passive: true });
window.addEventListener('resize', () => { measure(); layout(); request(); });
window.addEventListener('load', () => { measure(); request(); });
lite.addEventListener?.('change', () => { measure(); layout(); request(); });

if (reduceMotion) hero.classList.add('is-static');
measure();
layout();
buildFringe();
render();

/* ---------- menú ---------- */
const setMenu = (open) => {
  nav.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
};
burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

/* ---------- aparición de secciones ---------- */
const items = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach((el) => io.observe(el));
} else {
  items.forEach((el) => el.classList.add('is-visible'));
}

document.getElementById('year').textContent = new Date().getFullYear();
