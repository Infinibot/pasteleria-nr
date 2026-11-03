document.documentElement.classList.add('js');

const header = document.getElementById('header');
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
const hero = document.getElementById('inicio');
const scene = document.getElementById('scene');
const canvas = document.getElementById('choco');
const endBox = document.getElementById('end');
const hint = document.getElementById('hint');
const meltMap = document.getElementById('melt-map');
const products = document.getElementById('productos');
const ctx = canvas.getContext('2d');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- utilidades ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
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

/* ---------- chocolate de la portada ---------- */
let W = 0, H = 0, dpr = 1, drips = [];
const STEP = 3;

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

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildDrips();
}

function drawChoco(pc) {
  ctx.clearRect(0, 0, W, H);
  if (pc <= 0.001) return;

  const base = -90 + pc * (H + 130);
  const n = Math.ceil(W / STEP) + 1;
  let ys = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * STEP;
    ys[i] = base + 7 * Math.sin(x * 0.012 + 1.3) + 4 * Math.sin(x * 0.031);
  }

  const tips = [];
  for (const d of drips) {
    const len = d.len * smooth(d.delay, d.delay + 0.55, pc);
    if (len < 2) continue;
    const from = Math.max(0, Math.floor((d.cx - d.w) / STEP));
    const to = Math.min(n - 1, Math.ceil((d.cx + d.w) / STEP));
    for (let i = from; i <= to; i++) {
      const t = (i * STEP - d.cx) / d.w;
      const h = len * Math.pow(Math.max(0, 1 - t * t), 0.62);
      if (base + h > ys[i]) ys[i] = base + h;
    }
    tips.push({ x: d.cx, y: base + len, w: d.w, len });
  }
  ys = blur(ys, 3, 2);

  const edge = new Path2D();
  edge.moveTo(0, ys[0]);
  for (let i = 1; i < n; i++) edge.lineTo(i * STEP, ys[i]);

  const body = new Path2D();
  body.moveTo(0, -4);
  body.lineTo(0, ys[0]);
  for (let i = 1; i < n; i++) body.lineTo(i * STEP, ys[i]);
  body.lineTo(W, -4);
  body.closePath();

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#4d2a19');
  g.addColorStop(1, '#2e170d');
  ctx.fillStyle = g;
  ctx.fill(body);

  /* brillo de chocolate líquido siguiendo el borde */
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

  /* destello en la punta de cada goteo */
  ctx.fillStyle = 'rgba(255, 240, 225, .28)';
  for (const t of tips) {
    if (t.len < 24) continue;
    ctx.beginPath();
    ctx.ellipse(t.x - t.w * 0.28, t.y - t.w * 0.7, t.w * 0.13, t.w * 0.3, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------- flecos estáticos hacia la sección de productos ---------- */
function buildFringe() {
  const path = document.getElementById('fringe-path');
  if (!path) return;
  const FW = 1440, FH = 170, step = 4;
  const rand = rng(29);
  const n = Math.ceil(FW / step) + 1;
  let ys = new Float32Array(n);
  for (let i = 0; i < n; i++) ys[i] = 34 + 5 * Math.sin(i * step * 0.014) + 3 * Math.sin(i * step * 0.037 + 2);
  const count = 17;
  for (let k = 0; k < count; k++) {
    const cx = (k + 0.5 + (rand() - 0.5) * 0.7) * (FW / count);
    const w = 18 + rand() * 30;
    const len = 36 + rand() * 94;
    for (let i = 0; i < n; i++) {
      const t = (i * step - cx) / w;
      if (Math.abs(t) >= 1) continue;
      const y = 34 + len * Math.pow(1 - t * t, 0.62);
      if (y > ys[i]) ys[i] = y;
    }
  }
  ys = blur(ys, 3, 2);
  let d = `M0,0 L0,${ys[0].toFixed(1)}`;
  for (let i = 1; i < n; i++) d += ` L${i * step},${ys[i].toFixed(1)}`;
  d += ` L${FW},0 Z`;
  path.setAttribute('d', d);
}

/* ---------- scroll ---------- */
let ticking = false;

function render() {
  ticking = false;
  const total = hero.offsetHeight - window.innerHeight;
  const p = reduceMotion || total <= 0 ? 1 : clamp(-hero.getBoundingClientRect().top / total);

  const melt = reduceMotion ? 0 : smooth(0.05, 0.66, p);
  const pour = smooth(0.1, 0.72, p);
  const text = smooth(0.74, 0.9, p);

  /* la escena se estira y se deforma como chocolate fundido */
  if (melt > 0.01) {
    scene.style.filter = 'url(#melt-filter)';
    meltMap.setAttribute('scale', String(Math.round(melt * Math.min(220, W * 0.32))));
    scene.style.transform = `translateY(${(melt * 10).toFixed(2)}svh) scaleY(${(1 + melt * 0.4).toFixed(3)})`;
  } else {
    scene.style.filter = '';
    scene.style.transform = '';
  }
  scene.style.visibility = pour >= 0.995 ? 'hidden' : 'visible';

  drawChoco(reduceMotion ? 1 : pour);

  endBox.style.opacity = String(text);
  endBox.style.transform = `translateY(${((1 - text) * 36).toFixed(1)}px)`;
  endBox.classList.toggle('is-on', text > 0.6);
  hint.style.opacity = String(1 - smooth(0.02, 0.1, p));

  /* cabecera: clara sobre la crema, transparente sobre el chocolate */
  const overChoco = (p > 0.27 || reduceMotion) && products.getBoundingClientRect().top > -30;
  header.classList.toggle('on-dark', overChoco);
  header.classList.toggle('is-scrolled', window.scrollY > 8);
}

const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(render); } };

window.addEventListener('scroll', request, { passive: true });
window.addEventListener('resize', () => { resizeCanvas(); request(); });

if (reduceMotion) hero.classList.add('is-static');
resizeCanvas();
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
