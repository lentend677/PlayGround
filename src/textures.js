import * as THREE from './three.module.min.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function tex(canvas, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

function speckle(ctx, w, h, count, colors, size = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
    ctx.globalAlpha = 0.25 + Math.random() * 0.45;
    const s = size * (0.4 + Math.random());
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* Track ballast, sleepers and rails                                    */
/* ------------------------------------------------------------------ */
export function makeTrackTexture() {
  const w = 768, h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4c4b52';
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 5200, ['#63626b', '#3c3b43', '#77747c', '#2f2e36', '#8a8790'], 3);

  const lanes = [w / 6, w / 2, (5 * w) / 6];
  const laneW = w / 3;

  // sleeper rows
  for (let row = 0; row < 8; row++) {
    const y = row * (h / 8) + 4;
    for (const cx of lanes) {
      const grad = ctx.createLinearGradient(0, y, 0, y + 22);
      grad.addColorStop(0, '#805a3e');
      grad.addColorStop(0.45, '#6a4630');
      grad.addColorStop(1, '#4f3324');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - laneW * 0.37, y, laneW * 0.74, 24);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(cx - laneW * 0.37, y + 2, laneW * 0.74, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.fillRect(cx - laneW * 0.37, y + 21, laneW * 0.74, 4);
      // bolts
      ctx.fillStyle = '#3b3a41';
      for (let b = 0; b < 4; b++) {
        ctx.beginPath();
        ctx.arc(cx - laneW * 0.3 + b * laneW * 0.2, y + 12, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // gravel ridge between tracks
  for (let i = 0; i < 2; i++) {
    const x = w / 3 + i * (w / 3);
    ctx.fillStyle = 'rgba(30,29,35,0.35)';
    ctx.fillRect(x - 8, 0, 16, h);
  }

  return tex(c, 1, 36);
}

export function makeConcreteTexture() {
  const w = 256, h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9a9aa5';
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 2200, ['#b1b1bb', '#83838f', '#c2c2cb', '#72727e'], 2);
  ctx.strokeStyle = 'rgba(60,60,72,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * (h / 4));
    ctx.lineTo(w, i * (h / 4));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * (h / 4) + 3);
    ctx.lineTo(w, i * (h / 4) + 3);
    ctx.stroke();
  }
  return tex(c, 2, 26);
}

/* ------------------------------------------------------------------ */
/* City facades                                                        */
/* ------------------------------------------------------------------ */
const FACADES = [
  { base: '#2b3d74', trim: '#3d5699', win: '#ffd98a', winDim: '#7b8ac4' },
  { base: '#5b3f77', trim: '#775796', win: '#ffc4e1', winDim: '#9c82b8' },
  { base: '#315f68', trim: '#43808b', win: '#b9f0ff', winDim: '#6a9da6' },
  { base: '#743d43', trim: '#965158', win: '#ffe1a3', winDim: '#a87c82' },
  { base: '#3f4c5f', trim: '#596a82', win: '#d8f0ff', winDim: '#7f8fa5' },
  { base: '#6b5a37', trim: '#8a7549', win: '#fff0b0', winDim: '#a39372' },
];

export function makeFacadeTexture(variant) {
  const f = FACADES[variant % FACADES.length];
  const w = 256, h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = f.base;
  ctx.fillRect(0, 0, w, h);

  // subtle vertical banding
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 12, h);

  const cols = 4;
  const rows = 9;
  const mx = 18, my = 16;
  const ww = (w - mx * 2) / cols;
  const wh = (h - my * 2) / rows;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = mx + col * ww + 6;
      const y = my + r * wh + 8;
      const lit = Math.random() > 0.45;
      ctx.fillStyle = lit ? f.win : f.winDim;
      ctx.globalAlpha = lit ? 0.92 : 0.32;
      ctx.fillRect(x, y, ww - 12, wh - 17);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(18,24,44,0.65)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, ww - 12, wh - 17);
      // window crossbars
      ctx.strokeStyle = 'rgba(18,24,44,0.32)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + (ww - 12) / 2, y);
      ctx.lineTo(x + (ww - 12) / 2, y + wh - 17);
      ctx.stroke();
      if (lit) {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(x, y, ww - 12, 4);
      }
    }
  }

  // top cornice + bottom shadow
  ctx.fillStyle = f.trim;
  ctx.fillRect(0, 0, w, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(0, h - 14, w, 14);
  speckle(ctx, w, h, 500, ['#ffffff', '#000000'], 1.5);

  return tex(c, 1, 1);
}

/* ------------------------------------------------------------------ */
/* Buildings props                                                     */
/* ------------------------------------------------------------------ */
export function makeBillboardTexture(kind) {
  const w = 1024, h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  if (kind === 'banana') {
    ctx.fillStyle = '#14224e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd93d';
    ctx.fillRect(18, 18, w - 36, h - 36);
    ctx.fillStyle = '#14224e';
    ctx.font = '900 168px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BANANA!', w / 2, h / 2 + 8);
    ctx.font = '700 46px "Arial Black", sans-serif';
    ctx.fillText('SO YUMMY', w / 2, h - 86);
    // banana icon
    ctx.save();
    ctx.translate(110, 92);
    ctx.rotate(-0.5);
    ctx.strokeStyle = '#ffbe0b';
    ctx.lineWidth = 46;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0.2, Math.PI * 0.95);
    ctx.stroke();
    ctx.restore();
  } else if (kind === 'rush') {
    ctx.fillStyle = '#1a2a5b';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffd93d';
    ctx.lineWidth = 22;
    ctx.strokeRect(16, 16, w - 32, h - 32);
    ctx.fillStyle = '#ffd93d';
    ctx.font = '900 190px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MINION', w / 2, h / 2 - 62);
    ctx.fillStyle = '#8de4ff';
    ctx.fillText('RUSH', w / 2, h / 2 + 120);
  } else {
    ctx.fillStyle = '#ff5d8f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff8e7';
    ctx.fillRect(24, 24, w - 48, h - 48);
    ctx.fillStyle = '#1a2a5b';
    ctx.font = '900 160px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YAY!', w / 2, h / 2 - 40);
    ctx.font = '800 58px "Arial Black", sans-serif';
    ctx.fillStyle = '#ff5d8f';
    ctx.fillText('BANANA POWER', w / 2, h / 2 + 108);
  }

  return tex(c, 1, 1);
}

/* ------------------------------------------------------------------ */
/* Trains                                                              */
/* ------------------------------------------------------------------ */
export function makeTrainSideTexture(color) {
  const w = 1024, h = 320;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);

  // roof / floor shading
  let g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.16, 'rgba(255,255,255,0)');
  g.addColorStop(0.82, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // stripe
  ctx.fillStyle = '#ffd93d';
  ctx.fillRect(0, h * 0.62, w, 20);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, h * 0.62 + 20, w, 5);

  // windows and doors
  const winY = h * 0.16;
  const winH = h * 0.34;
  for (let i = 0; i < 7; i++) {
    const x = 36 + i * 140;
    if (i === 3) {
      // door
      ctx.fillStyle = 'rgba(20,30,54,0.42)';
      ctx.fillRect(x - 8, 18, 92, h - 40);
      ctx.fillStyle = '#cfe8ff';
      ctx.fillRect(x + 2, winY, 72, winH);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, winY, 72, winH);
      ctx.beginPath();
      ctx.moveTo(x + 38, winY);
      ctx.lineTo(x + 38, winY + winH);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#cfe8ff';
      ctx.fillRect(x, winY, 104, winH);
      ctx.strokeStyle = 'rgba(17,28,52,0.62)';
      ctx.lineWidth = 6;
      ctx.strokeRect(x, winY, 104, winH);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x + 6, winY + 6, 26, winH - 12);
      ctx.fillStyle = 'rgba(17,28,52,0.18)';
      ctx.fillRect(x, winY + winH * 0.55, 104, 5);
    }
  }

  // rivets
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let x = 12; x < w; x += 26) {
    ctx.beginPath();
    ctx.arc(x, h - 18, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  return tex(c, 1, 1);
}

export function makeTrainFrontTexture(color) {
  const w = 256, h = 340;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  let g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0.3)');
  g.addColorStop(0.4, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#182849';
  ctx.beginPath();
  roundedRect(ctx, 26, 42, w - 52, 118, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = 'rgba(160,220,255,0.5)';
  ctx.fillRect(38, 52, 70, 32);
  ctx.fillRect(148, 52, 70, 32);

  ctx.fillStyle = '#ffd93d';
  ctx.fillRect(0, 196, w, 18);
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(52, 258, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w - 52, 258, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a5a17';
  ctx.fillRect(w / 2 - 34, 286, 68, 12);
  return tex(c, 1, 1);
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */
export function makeStripeTexture() {
  const w = 256, h = 64;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ff7a1a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff8e7';
  for (let x = -h; x < w + h; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 32, 0);
    ctx.lineTo(x + 32 + h, h);
    ctx.lineTo(x + h, h);
    ctx.closePath();
    ctx.fill();
  }
  return tex(c, 2, 1);
}

export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const s = 128;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, inner.replace(/[\d.]+\)$/, '0.65)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeCloudTexture() {
  const w = 256, h = 128;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const puffs = [
    [70, 82, 42], [112, 64, 52], [158, 74, 44], [196, 88, 30], [42, 94, 26],
  ];
  for (const [x, y, r] of puffs) {
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.98)');
    g.addColorStop(0.7, 'rgba(245,250,255,0.8)');
    g.addColorStop(1, 'rgba(235,245,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeShadowTexture() {
  const s = 128;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

export function makePowerTexture(kind) {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  if (kind === 'magnet') {
    ctx.save();
    ctx.translate(128, 122);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ff4d3d';
    ctx.lineWidth = 40;
    ctx.beginPath();
    ctx.arc(0, 0, 54, Math.PI * 0.02, Math.PI * 0.98, true);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-54, -6);
    ctx.lineTo(-54, 58);
    ctx.moveTo(54, -6);
    ctx.lineTo(54, 58);
    ctx.stroke();
    ctx.strokeStyle = '#c9d6ea';
    ctx.beginPath();
    ctx.arc(0, 0, 54, Math.PI * 0.02, Math.PI * 0.98);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(128, 128);
    ctx.strokeStyle = '#6ee7ff';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(0, 0, 74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(110,231,255,0.28)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -38);
    ctx.lineTo(-6, 24);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(18, -24);
    ctx.lineTo(18, 40);
    ctx.lineTo(-30, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
