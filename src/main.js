import { Game } from './game.js';
import { Sound } from './audio.js';
import { SKINS, SKIN_ORDER } from './character.js';

const $ = (sel) => document.querySelector(sel);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

const canvas = $('#game');
const menuEl = $('#menu');
const hudEl = $('#hud');
const pauseEl = $('#pause');
const overEl = $('#gameover');
const toastEl = $('#toast');
const goEl = $('#go-flash');
const hintEl = $('#hint');
const comboEl = $('#combo');
const skinRow = $('#skin-row');
const scoreEl = $('#hud-score');
const bananasEl = $('#hud-bananas');
const powerStrip = $('#power-strip');
const btnPause = $('#btn-pause');
const btnTilt = $('#btn-tilt');
const btnSound = $('#btn-sound');
const menuBest = $('#menu-best');
const controlsHint = $('#controls-hint');
const coarse = window.matchMedia('(pointer: coarse)').matches;

const store = {
  get(k, fallback) {
    try {
      const v = localStorage.getItem('mr.' + k);
      return v === null ? fallback : v;
    } catch { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem('mr.' + k, String(v)); } catch { /* ignore */ }
  },
};

const sound = new Sound();
let best = Number(store.get('best', 0)) || 0;
let activeSkin = SKINS[store.get('skin', 'kevin')] ? store.get('skin', 'kevin') : 'kevin';
let tiltWanted = store.get('tilt', '0') === '1';

/* ------------------------------------------------------------------ */
/* Skin cards                                                          */
/* ------------------------------------------------------------------ */
function skinSVG(key) {
  const s = SKINS[key];
  const body = hex(s.body);
  const overall = hex(s.overalls);
  const iris = s.evil ? '#c23b3b' : '#6a4a24';
  let eyes = '';
  if (s.eyeCount === 1) {
    eyes = `
      <circle cx="50" cy="47" r="19" fill="#ffffff" stroke="#cfd8e5" stroke-width="5"/>
      <circle cx="50" cy="47" r="18.5" fill="none" stroke="#16224d" stroke-width="2"/>
      <circle cx="50" cy="49" r="7.4" fill="${iris}"/>
      <circle cx="50" cy="49" r="4" fill="#101018"/>
      <circle cx="47.5" cy="46" r="2" fill="#fff"/>`;
  } else {
    eyes = `
      <circle cx="36" cy="47" r="13" fill="#ffffff" stroke="#cfd8e5" stroke-width="4.5"/>
      <circle cx="64" cy="47" r="13" fill="#ffffff" stroke="#cfd8e5" stroke-width="4.5"/>
      <circle cx="36" cy="47" r="12.6" fill="none" stroke="#16224d" stroke-width="1.6"/>
      <circle cx="64" cy="47" r="12.6" fill="none" stroke="#16224d" stroke-width="1.6"/>
      <circle cx="36" cy="48.4" r="5.1" fill="${iris}"/>
      <circle cx="64" cy="48.4" r="5.1" fill="${iris}"/>
      <circle cx="36" cy="48.4" r="2.8" fill="#101018"/>
      <circle cx="64" cy="48.4" r="2.8" fill="#101018"/>
      <circle cx="34.2" cy="46" r="1.5" fill="#fff"/>
      <circle cx="62.2" cy="46" r="1.5" fill="#fff"/>`;
  }

  let hair = '';
  if (s.hair === 'spikes') {
    hair = `<path d="M35 13 q3 -9 6 0 M45 9 q3 -10 6 0 M56 11 q3 -9 6 1 M64 15 q3 -7 5 1" stroke="#17161f" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  } else if (s.hair === 'side') {
    hair = `<path d="M30 22 q10 -18 24 -14 q10 3 14 12" stroke="#17161f" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  } else if (s.hair === 'tuft') {
    hair = `<path d="M48 14 q2 -11 6 -1 q4 -8 5 2" stroke="#17161f" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  } else {
    hair = `<path d="M30 18 q0 -12 8 -6 q2 -11 8 -2 q5 -10 9 1 q6 -8 9 3 q5 -6 7 6" stroke="#17161f" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  }

  return `
  <svg viewBox="0 0 100 108" aria-hidden="true">
    <ellipse cx="50" cy="58" rx="37" ry="45" fill="${body}" stroke="#16224d" stroke-width="4"/>
    ${hair}
    <rect x="13" y="85" width="74" height="20" rx="9" fill="${overall}" stroke="#16224d" stroke-width="3.5"/>
    <rect x="38" y="74" width="24" height="17" rx="3" fill="${overall}" stroke="#16224d" stroke-width="3"/>
    <path d="M29 88 v-15 M71 88 v-15" stroke="${overall}" stroke-width="7"/>
    <circle cx="42" cy="83" r="2" fill="#fff8e7"/>
    <circle cx="58" cy="83" r="2" fill="#fff8e7"/>
    <rect x="10" y="38" width="80" height="15" rx="7" fill="#1c1c26"/>
    ${eyes}
    <path d="M37 70 q13 12 26 0" stroke="#3a2415" stroke-width="3.6" fill="none" stroke-linecap="round"/>
    <circle cx="32" cy="62" r="1.3" fill="#c9a400"/>
    <circle cx="68" cy="62" r="1.3" fill="#c9a400"/>
  </svg>`;
}

function buildSkinCards() {
  skinRow.innerHTML = '';
  for (const key of SKIN_ORDER) {
    const s = SKINS[key];
    const btn = document.createElement('button');
    btn.className = 'skin-card' + (key === activeSkin ? ' active' : '');
    btn.dataset.skin = key;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', key === activeSkin ? 'true' : 'false');
    btn.setAttribute('aria-label', `${s.name} — ${s.unlock}`);
    btn.innerHTML = `${skinSVG(key)}<span class="skin-name">${s.name}</span>`;
    btn.addEventListener('click', () => {
      activeSkin = key;
      store.set('skin', key);
      clearTimeout(btn._hint);
      for (const el of skinRow.children) {
        el.classList.toggle('active', el.dataset.skin === key);
        el.setAttribute('aria-checked', el.dataset.skin === key ? 'true' : 'false');
      }
      game.selectSkin(key);
      sound.play('click');
    });
    skinRow.appendChild(btn);
  }
}

/* ------------------------------------------------------------------ */
/* Game                                                                */
/* ------------------------------------------------------------------ */
const game = new Game(canvas, {
  sound,
  onHud: updateHud,
  onGameOver: handleGameOver,
  onState: handleState,
});

game.selectSkin(activeSkin);
buildSkinCards();
menuBest.textContent = best.toLocaleString('en-US');

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */
let lastPowerKey = '';
let comboTimeout = null;

function updateHud(h) {
  if (scoreEl.textContent !== String(h.score)) scoreEl.textContent = h.score.toLocaleString('en-US');
  if (bananasEl.textContent !== String(h.bananas)) bananasEl.textContent = String(h.bananas);

  const key = `${h.magnet > 0 ? 1 : 0}|${h.shield ? 1 : 0}`;
  if (key !== lastPowerKey) {
    lastPowerKey = key;
    let html = '';
    if (h.magnet > 0) {
      html += `<div class="power-chip magnet"><span class="pc-ico">🧲</span><span>MAGNET</span><span class="pc-bar"><i style="width:${(h.magnet / 8) * 100}%"></i></span></div>`;
    }
    if (h.shield) {
      html += `<div class="power-chip shield"><span class="pc-ico">🛡️</span><span>SHIELD</span></div>`;
    }
    powerStrip.innerHTML = html;
  } else if (h.magnet > 0) {
    const bar = powerStrip.querySelector('.magnet .pc-bar i');
    if (bar) bar.style.width = `${(h.magnet / 8) * 100}%`;
  }
}

function resetHud() {
  scoreEl.textContent = '0';
  bananasEl.textContent = '0';
  powerStrip.innerHTML = '';
  lastPowerKey = '';
}

/* ------------------------------------------------------------------ */
/* State transitions                                                   */
/* ------------------------------------------------------------------ */
function handleState(type, data) {
  if (type === 'playing') {
    menuEl.classList.add('hidden');
    overEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
    hudEl.classList.remove('hidden');
    goEl.classList.remove('show');
    void goEl.offsetWidth;
    goEl.classList.add('show');
    hintEl.classList.remove('hidden');
    clearTimeout(hintEl._timer);
    hintEl._timer = setTimeout(() => hintEl.classList.add('hidden'), 7000);
  } else if (type === 'paused') {
    pauseEl.classList.remove('hidden');
  } else if (type === 'menu') {
    hudEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
    overEl.classList.add('hidden');
    menuEl.classList.remove('hidden');
    hintEl.classList.add('hidden');
    menuBest.textContent = best.toLocaleString('en-US');
    resetHud();
  } else if (type === 'combo') {
    comboEl.textContent = data;
    comboEl.classList.remove('hidden');
    void comboEl.offsetWidth;
    clearTimeout(comboTimeout);
    comboTimeout = setTimeout(() => comboEl.classList.add('hidden'), 900);
  } else if (type === 'hint-hide') {
    hintEl.classList.add('hidden');
  }
}

function handleGameOver(stats) {
  const newBest = stats.score > best;
  if (newBest) {
    best = stats.score;
    store.set('best', best);
  }
  $('#over-score').textContent = stats.score.toLocaleString('en-US');
  $('#over-bananas').textContent = stats.bananas;
  $('#over-distance').textContent = stats.distance + 'm';
  $('#over-best').textContent = best.toLocaleString('en-US');
  $('#new-best').classList.toggle('hidden', !newBest);
  const subs = ['Bananas everywhere…', 'That train came out of nowhere!', 'So close to a banana record!', 'Goggles: still on straight.'];
  $('#over-sub').textContent = newBest ? 'A brand new banana record!' : subs[(Math.random() * subs.length) | 0];
  overEl.classList.remove('hidden');
  sound.play('gameover');
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */
function startGame() {
  sound.ensure();
  sound.play('click');
  game.start();
}

$('#btn-play').addEventListener('click', startGame);
$('#btn-again').addEventListener('click', startGame);
$('#btn-menu').addEventListener('click', () => {
  sound.play('click');
  game.toMenu();
});
$('#btn-pause').addEventListener('click', () => {
  if (game.pause()) {
    sound.play('click');
    const stats = game.getStats();
    $('#pause-score').textContent = stats.score.toLocaleString('en-US');
    $('#pause-bananas').textContent = stats.bananas;
  }
});
$('#btn-resume').addEventListener('click', () => {
  sound.play('click');
  game.resume();
});
$('#btn-quit').addEventListener('click', () => {
  sound.play('click');
  game.toMenu();
});

btnSound.addEventListener('click', () => {
  sound.ensure();
  sound.setMuted(!sound.muted);
  btnSound.classList.toggle('muted', sound.muted);
  btnSound.setAttribute('aria-label', sound.muted ? 'Unmute sound' : 'Mute sound');
  if (!sound.muted) sound.play('click');
});
btnSound.classList.toggle('muted', sound.muted);

/* ------------------------------------------------------------------ */
/* Tilt steering                                                       */
/* ------------------------------------------------------------------ */
const tilt = { enabled: false, baseline: null, lastDir: 0 };

function motionSupported() {
  return typeof window.DeviceOrientationEvent !== 'undefined';
}

function updateTiltButton() {
  btnTilt.setAttribute('aria-pressed', tilt.enabled ? 'true' : 'false');
  btnTilt.querySelector('.tilt-text').textContent = tilt.enabled ? 'Tilt ON' : 'Tilt steering';
  store.set('tilt', tilt.enabled ? '1' : '0');
  refreshHints();
}

function onTilt(e) {
  if (!tilt.enabled) return;
  const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  let v = e.gamma || 0;
  if (Math.abs(angle) === 90) v = (angle === 90 ? -1 : 1) * (e.beta || 0);
  if (tilt.baseline === null) {
    tilt.baseline = v;
    return;
  }
  const d = v - tilt.baseline;
  if (d < -11 && tilt.lastDir !== -1) {
    tilt.lastDir = -1;
    game.moveLane(-1);
  } else if (d > 11 && tilt.lastDir !== 1) {
    tilt.lastDir = 1;
    game.moveLane(1);
  } else if (Math.abs(d) < 4) {
    tilt.lastDir = 0;
  }
}

function enableTiltListeners() {
  tilt.enabled = true;
  tilt.baseline = null;
  tilt.lastDir = 0;
  window.addEventListener('deviceorientation', onTilt);
  updateTiltButton();
}

function disableTilt() {
  tilt.enabled = false;
  window.removeEventListener('deviceorientation', onTilt);
  updateTiltButton();
}

async function toggleTilt() {
  sound.ensure();
  sound.play('click');
  if (tilt.enabled) {
    disableTilt();
    toast('Tilt steering off');
    return;
  }
  if (!motionSupported()) {
    toast('Motion sensors aren’t available here');
    return;
  }
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    try {
      const res = await DOE.requestPermission();
      if (res !== 'granted') {
        toast('Motion access was blocked — check Settings');
        return;
      }
    } catch {
      toast('Motion access needs a secure (https) page');
      return;
    }
  }
  enableTiltListeners();
  toast('Tilt steering on — lean left or right');
}

btnTilt.addEventListener('click', toggleTilt);
window.addEventListener('orientationchange', () => { tilt.baseline = null; });

if (tiltWanted && coarse && motionSupported() && !(window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function')) {
  enableTiltListeners();
  tiltWanted = false;
}

/* ------------------------------------------------------------------ */
/* Touch + keyboard                                                    */
/* ------------------------------------------------------------------ */
let touch = null;

canvas.addEventListener('pointerdown', (e) => {
  if (game.state !== 'playing') return;
  touch = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() };
  if (canvas.setPointerCapture) {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (!touch || e.pointerId !== touch.id) return;
  const dx = e.clientX - touch.x;
  const dy = e.clientY - touch.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  touch = null;
  const threshold = Math.max(18, Math.min(window.innerWidth, window.innerHeight) * 0.035);
  if (Math.max(adx, ady) < threshold) return;
  if (adx > ady) {
    game.moveLane(dx > 0 ? 1 : -1);
  } else if (dy < 0) {
    game.jump();
  } else {
    game.rollAction();
  }
});

canvas.addEventListener('pointercancel', () => { touch = null; });

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k) || ['a', 'd', 'w', 's'].includes(k)) {
    if (game.state === 'playing') e.preventDefault();
  }
  if (k === 'arrowleft' || k === 'a') game.moveLane(-1);
  else if (k === 'arrowright' || k === 'd') game.moveLane(1);
  else if (k === 'arrowup' || k === 'w' || k === ' ') game.jump();
  else if (k === 'arrowdown' || k === 's') game.rollAction();
  else if (k === 'p' || k === 'escape') {
    if (game.state === 'playing') btnPause.click();
    else if (game.state === 'paused') $('#btn-resume').click();
  } else if (k === 'r' && game.state === 'over') {
    startGame();
  } else if (k === 'enter' && (game.state === 'menu' || game.state === 'over')) {
    startGame();
  }
});

window.addEventListener('blur', () => {
  if (game.state === 'playing') {
    game.pause();
    const stats = game.getStats();
    $('#pause-score').textContent = stats.score.toLocaleString('en-US');
    $('#pause-bananas').textContent = stats.bananas;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') {
    game.pause();
    const stats = game.getStats();
    $('#pause-score').textContent = stats.score.toLocaleString('en-US');
    $('#pause-bananas').textContent = stats.bananas;
  }
});

document.addEventListener('contextmenu', (e) => {
  if (e.target === canvas) e.preventDefault();
});

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */
let toastTimer = null;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

/* ------------------------------------------------------------------ */
/* Size class                                                          */
/* ------------------------------------------------------------------ */
function refreshHints() {
  if (tilt.enabled) {
    controlsHint.innerHTML = 'Tilt <b>← →</b> to steer · <b>↑</b> jump · <b>↓</b> roll';
    hintEl.innerHTML = '<span class="swipe-row">Tilt <b>← →</b> to dodge</span><span><b>↑</b> jump &nbsp;·&nbsp; <b>↓</b> roll</span>';
  } else if (coarse) {
    controlsHint.innerHTML = 'Swipe <b>← →</b> to dodge · <b>↑</b> jump · <b>↓</b> roll';
    hintEl.innerHTML = '<span class="swipe-row"><b>←</b> swipe <b>→</b></span><span><b>↑</b> jump &nbsp;·&nbsp; <b>↓</b> roll</span>';
  } else {
    controlsHint.innerHTML = 'Arrow keys / WASD · <b>P</b> pause · <b>R</b> restart';
    hintEl.innerHTML = '<span><b>← →</b> lanes</span><span><b>↑</b> jump &nbsp;·&nbsp; <b>↓</b> roll &nbsp;·&nbsp; <b>P</b> pause</span>';
  }
}

refreshHints();
