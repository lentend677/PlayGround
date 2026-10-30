import * as THREE from '../vendor/three.module.min.js';
import { createAtlasTexture } from './atlas.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Controls } from './controls.js';
import { Soundscape } from './audio.js';

const canvas = document.getElementById('scene');
const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loaderBar');
const loaderCopy = document.getElementById('loaderCopy');
const hint = document.getElementById('hint');
const fade = document.getElementById('fade');
const shardCount = document.getElementById('shardCount');
const shardMeter = document.querySelector('.shard-meter');
const clock = document.getElementById('clock');
const phase = document.getElementById('phase');
const timeIcon = document.getElementById('timeIcon');
const speedLabel = document.getElementById('speedLabel');
const soundBtn = document.getElementById('soundBtn');
const timeBtn = document.getElementById('timeBtn');
const speedBtn = document.getElementById('speedBtn');
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const closeHelp = document.getElementById('closeHelp');
const resumeBtn = document.getElementById('resumeBtn');
const toastStack = document.getElementById('toastStack');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});

// Headless / software GL (llvmpipe, SwiftShader) can spend seconds compiling
// and reading back a shadowed frame. Keep the scene intact but drop the
// expensive shadow pass there so the first frames stay responsive.
function detectSoftwareGL(gl) {
  try {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (!info) return false;
    const name = gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '';
    return /swiftshader|llvmpipe|software rasterizer|basic render/i.test(name);
  } catch {
    return false;
  }
}
const softwareGL = detectSoftwareGL(renderer.getContext());
const maxPixelRatio = softwareGL ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(maxPixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = !softwareGL;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xbddbd8, 0.0046);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.08, 1400);
camera.position.set(1.5, 12, 20);
scene.userData.cameraPosition = camera.position;

const atlas = createAtlasTexture();
const world = new World(scene, renderer, atlas);
const player = new Player(scene, world);
const audio = new Soundscape();
const controls = new Controls({
  canvas,
  joystick: document.getElementById('joystick'),
  knob: document.getElementById('joystickKnob'),
  jumpBtn: document.getElementById('jumpBtn'),
  runBtn: document.getElementById('runBtn'),
  tiltBtn: document.getElementById('tiltBtn'),
  tiltState: document.getElementById('tiltState'),
  onTiltChange: (enabled) => {
    document.body.classList.toggle('tilt-on', enabled);
  },
  onToast: (message, tone) => toast(message, tone),
  onInteract: () => { audio.init(); },
});
controls.onHelp = () => openHelp();
player.onFootstep = (running) => audio.footstep(running);
player.onJump = () => audio.jump();
player.onLand = () => audio.land();
player.onRespawn = () => {
  flash();
  toast('The isle caught you. Back to the trail.', '');
};

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------
let timeOfDay = 0.33; // 07:55, a soft morning
const DAY_LENGTH = 180;
const speeds = [1, 4, 12];
let speedIndex = 0;
let yaw = 0.13;
let pitch = 0.43;
let cameraDistance = 13.6;
let cameraTarget = new THREE.Vector3(player.position.x, player.position.y + 1.35, player.position.z);
let cameraPosition = new THREE.Vector3();
let shake = 0;
let shardsFound = 0;
let modalOpen = false;
let lastHud = 0;
let introDone = false;
let freeCamera = null;
const intro = { active: true, elapsed: 0, blend: 0, skipped: false };

const dayInfo = {
  night: 0,
  day: 1,
  sunset: 0,
  horizonColor: new THREE.Color('#bfe1df'),
};
const sunDir = new THREE.Vector3();
const moonDir = new THREE.Vector3();
const nightHorizon = new THREE.Color('#101c38');
const dayHorizon = new THREE.Color('#c4e4df');
const sunsetColor = new THREE.Color('#ff9860');
const hemiSkyDay = new THREE.Color('#d5f1e8');
const hemiSkyNight = new THREE.Color('#24365b');
const hemiGroundDay = new THREE.Color('#40503a');
const hemiGroundNight = new THREE.Color('#0b1418');
const sunWarm = new THREE.Color('#ffc27f');
const sunHigh = new THREE.Color('#fff4d9');
const moonColor = new THREE.Color('#7d9bd1');

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function toast(message, tone = '') {
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.textContent = message;
  toastStack.appendChild(el);
  while (toastStack.children.length > 3) toastStack.firstElementChild.remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 380);
  }, 2800);
}

function flash() {
  fade.classList.add('on');
  setTimeout(() => fade.classList.remove('on'), 260);
}

function setShardCount(n) {
  shardCount.textContent = String(n);
  shardMeter.classList.remove('bump');
  void shardMeter.offsetWidth;
  shardMeter.classList.add('bump');
}

function openHelp() {
  modalOpen = true;
  helpModal.classList.add('open');
  helpModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  audio.click();
}

function closeHelpModal() {
  modalOpen = false;
  helpModal.classList.remove('open');
  helpModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

// ---------------------------------------------------------------------------
// UI bindings
// ---------------------------------------------------------------------------
helpBtn.addEventListener('click', () => { audio.init(); openHelp(); });
closeHelp.addEventListener('click', () => { audio.click(); closeHelpModal(); });
resumeBtn.addEventListener('click', () => { audio.click(); closeHelpModal(); });
helpModal.addEventListener('click', (e) => {
  if (e.target === helpModal) closeHelpModal();
});

timeBtn.addEventListener('click', () => {
  audio.init();
  audio.click();
  timeOfDay = (timeOfDay + 1.5 / 24) % 1;
  toast('Time slips forward.', '');
  updateClock(true);
});

speedBtn.addEventListener('click', () => {
  audio.init();
  audio.click();
  speedIndex = (speedIndex + 1) % speeds.length;
  speedLabel.textContent = `${speeds[speedIndex]}×`;
  toast(speeds[speedIndex] === 1 ? 'Time flows naturally.' : `Time now flows ${speeds[speedIndex]}× faster.`, '');
});

soundBtn.addEventListener('click', async () => {
  await audio.init();
  const enabled = audio.toggle();
  soundBtn.classList.toggle('muted', !enabled);
  soundBtn.setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound');
  if (!enabled) toast('Sound muted.', '');
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && modalOpen) closeHelpModal();
  if ((e.code === 'KeyM') && !e.repeat) {
    soundBtn.click();
  }
});

window.addEventListener('pointerdown', () => { audio.init(); }, { once: true });
window.addEventListener('keydown', () => { audio.init(); }, { once: true });
window.addEventListener('pointerdown', skipIntro, { capture: true });
window.addEventListener('keydown', skipIntro);

// ---------------------------------------------------------------------------
// lighting & sky
// ---------------------------------------------------------------------------
const tmpColor = new THREE.Color();
const tmpColor2 = new THREE.Color();

function updateDayNight(dt) {
  timeOfDay = (timeOfDay + (dt * speeds[speedIndex]) / DAY_LENGTH) % 1;
  const solar = (timeOfDay - 0.25) * Math.PI * 2;
  sunDir.set(Math.cos(solar) * 0.94, Math.sin(solar), -0.32).normalize();
  moonDir.copy(sunDir).multiplyScalar(-1);

  const elevation = sunDir.y;
  const day = smoothstep(-0.14, 0.22, elevation);
  const night = 1 - day;
  const sunset = Math.max(0, 1 - Math.abs(elevation) / 0.36) * smoothstep(-0.22, -0.02, Math.abs(elevation) > 0.001 ? elevation : -0.1);
  const warm = day * (1 - smoothstep(0.0, 0.6, elevation));

  // sky and horizon palette
  tmpColor.copy(nightHorizon).lerp(dayHorizon, day);
  tmpColor.lerp(sunsetColor, sunset * 0.42);
  dayInfo.horizonColor.copy(tmpColor);
  dayInfo.night = night;
  dayInfo.day = day;
  dayInfo.sunset = sunset;

  if (scene.fog) {
    scene.fog.color.copy(dayInfo.horizonColor);
    scene.fog.density = 0.0042 + night * 0.0018;
  }

  // the sun key light
  world.sunDir.copy(sunDir);
  world.moonDir.copy(moonDir);
  world.sunLight.position.copy(sunDir).multiplyScalar(70);
  world.sunLight.target.position.set(0, 4, 0);
  tmpColor.copy(sunWarm).lerp(sunHigh, 1 - warm);
  world.sunLight.color.copy(tmpColor);
  world.sunLight.intensity = Math.max(0, elevation) * 2.25 + day * 0.12 + warm * 1.15;
  world.sunLight.castShadow = elevation > 0.015;
  world.moonLight.position.copy(moonDir).multiplyScalar(55);
  world.moonLight.target.position.set(0, 4, 0);
  world.moonLight.intensity = Math.max(0, -elevation) * 0.7 + 0.04;
  world.moonLight.color.copy(moonColor);

  world.hemi.color.copy(hemiSkyNight).lerp(hemiSkyDay, day).lerp(sunsetColor, sunset * 0.14);
  world.hemi.groundColor.copy(hemiGroundNight).lerp(hemiGroundDay, day);
  world.hemi.intensity = 0.42 + day * 0.86;

  renderer.toneMappingExposure = 0.94 + day * 0.18;
  audio.setNight(night);
  return { day, night, elevation };
}

function updateClock(force = false) {
  const now = performance.now();
  if (!force && now - lastHud < 180) return;
  lastHud = now;
  const totalMinutes = timeOfDay * 24 * 60;
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = Math.floor(totalMinutes % 60);
  clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  let label = 'Night';
  if (h >= 5 && h < 7) label = 'Dawn';
  else if (h >= 7 && h < 11) label = 'Morning';
  else if (h >= 11 && h < 14) label = 'Midday';
  else if (h >= 14 && h < 17) label = 'Afternoon';
  else if (h >= 17 && h < 19) label = 'Dusk';
  else if (h >= 19 && h < 22) label = 'Evening';
  phase.textContent = label;
  timeIcon.textContent = h >= 6 && h < 18 ? '☀' : '☾';
  timeIcon.style.color = h >= 6 && h < 18 ? '#f7c96e' : '#a8c4e8';
  timeIcon.style.textShadow = h >= 6 && h < 18
    ? '0 0 12px rgba(247,201,110,.85)'
    : '0 0 12px rgba(150,190,240,.8)';
}

// ---------------------------------------------------------------------------
// camera
// ---------------------------------------------------------------------------
function skipIntro() {
  if (!intro.active) return;
  intro.skipped = true;
}

function updateCamera(dt, first = false, introBlend = 1) {
  if (freeCamera) {
    camera.position.fromArray(freeCamera.position);
    camera.lookAt(new THREE.Vector3().fromArray(freeCamera.target));
    scene.userData.cameraPosition.copy(camera.position);
    return yaw;
  }
  const look = controls.consumeLook();
  yaw -= look.x * 0.0052;
  pitch += look.y * 0.0038;
  pitch = clamp(pitch, -0.03, 1.08);

  const zoom = controls.consumeZoom();
  if (zoom) {
    cameraDistance = clamp(cameraDistance + zoom * 1.7, 5.4, 15.5);
  }

  const tilt = controls.tiltEnabled ? controls.tiltSmooth : null;
  const appliedYaw = yaw + (tilt ? tilt.yaw : 0);
  const appliedPitch = clamp(pitch + (tilt ? tilt.pitch : 0), -0.08, 1.16);

  const goal = new THREE.Vector3(player.position.x, player.position.y + 1.32, player.position.z);
  if (first) cameraTarget.copy(goal);
  else cameraTarget.lerp(goal, 1 - Math.exp(-dt * 11));

  const cosPitch = Math.cos(appliedPitch);
  const aspectFit = camera.aspect < 1 ? clamp(1.32 - camera.aspect * 0.1, 1, 1.32) : 1;
  const frameDistance = Math.min(17, cameraDistance * aspectFit);
  const desired = new THREE.Vector3(
    cameraTarget.x + Math.sin(appliedYaw) * cosPitch * frameDistance,
    cameraTarget.y + Math.sin(appliedPitch) * frameDistance,
    cameraTarget.z + Math.cos(appliedYaw) * cosPitch * frameDistance
  );

  // keep the camera from burrowing into the island
  const ground = world.surfaceAt(desired.x, desired.z);
  if (ground !== null && desired.y < ground + 0.75) desired.y = ground + 0.75;

  if (first) cameraPosition.copy(desired);
  else cameraPosition.lerp(desired, 1 - Math.exp(-dt * 13));

  if (shake > 0.001) {
    cameraPosition.x += (Math.random() - 0.5) * shake;
    cameraPosition.y += (Math.random() - 0.5) * shake;
    cameraPosition.z += (Math.random() - 0.5) * shake;
    shake *= Math.pow(0.02, dt);
  }

  let renderPosition = cameraPosition;
  let renderTarget = cameraTarget;
  if (introBlend < 1 && !first) {
    const t = intro.elapsed;
    const angle = 0.8 - t * 0.042;
    const fit = clamp(1 / Math.max(0.42, camera.aspect), 1, 1.45);
    const radius = (49 - t * 0.7) * fit;
    const cinePos = new THREE.Vector3(
      Math.sin(angle) * radius,
      (17.4 + Math.sin(t * 0.45) * 0.55) * (fit > 1 ? 1.06 : 1),
      Math.cos(angle) * radius
    );
    const cineTarget = new THREE.Vector3(0, 2.6, 0);
    renderPosition = new THREE.Vector3().lerpVectors(cinePos, cameraPosition, introBlend);
    renderTarget = new THREE.Vector3().lerpVectors(cineTarget, cameraTarget, introBlend);
  }

  camera.position.copy(renderPosition);
  camera.lookAt(renderTarget);
  scene.userData.cameraPosition.copy(camera.position);
  return appliedYaw;
}

// ---------------------------------------------------------------------------
// loop
// ---------------------------------------------------------------------------
const clockObj = new THREE.Clock();
let accumulated = 0;
let qualityLevel = softwareGL ? 2 : 0;
let perfStart = 0;
let perfFrames = 0;
let softwareFrameAt = 0;

function applyQuality(level) {
  qualityLevel = level;
  if (level <= 1) {
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(level === 0 ? maxPixelRatio : Math.max(1, maxPixelRatio * 0.7));
  } else {
    renderer.shadowMap.enabled = false;
    renderer.setPixelRatio(1);
  }
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

function trackPerformance() {
  if (softwareGL || intro.active || qualityLevel >= 2) return;
  const now = performance.now();
  if (!perfStart) {
    perfStart = now;
    perfFrames = 0;
    return;
  }
  perfFrames++;
  if (now - perfStart < 3000) return;
  const fps = (perfFrames * 1000) / (now - perfStart);
  perfStart = now;
  perfFrames = 0;
  if (fps >= 34) return;
  applyQuality(qualityLevel + 1);
  toast(qualityLevel >= 2 ? 'Shadows eased for a smoother journey.' : 'Quality adjusted for a smoother journey.', '');
}

function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  if (softwareGL) {
    if (now - softwareFrameAt < 42) return;
    softwareFrameAt = now;
  }
  const dt = Math.min(clockObj.getDelta(), 0.05);
  accumulated += dt;
  trackPerformance();

  updateDayNight(dt);
  updateClock();
  if (intro.active) {
    intro.elapsed += dt;
    if (intro.skipped) intro.blend = Math.min(1, intro.blend + dt / 0.7);
    else intro.blend = smoothstep(3.15, 4.5, intro.elapsed);
    if (intro.blend >= 1) intro.active = false;
  }
  const introBlend = intro.active ? intro.blend : 1;
  const appliedYaw = updateCamera(dt, false, introBlend);
  const input = controls.update(dt);

  if (!modalOpen) {
    player.update(dt, input, appliedYaw, dayInfo.night);
    const found = world.tryCollect(player.position);
    if (found >= 0) {
      shardsFound++;
      setShardCount(shardsFound);
      audio.chime(found);
      shake = 0.08;
      if (shardsFound >= 5) {
        toast('All five lumen shards found. The isle is aglow.', 'gold');
        flash();
        setTimeout(() => toast('A perfect little world, and you found every light in it.', 'gold'), 900);
      } else {
        toast(`Lumen shard found · ${shardsFound} of 5`, 'gold');
      }
    }
  }

  world.update(dt, accumulated, dayInfo);
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

updateDayNight(0.0001);
updateClock(true);
updateCamera(0.016, true, 0);
player.update(0.016, { x: 0, y: 0, run: false, jump: false }, yaw, 0);
const initialFit = clamp(1 / Math.max(0.42, camera.aspect), 1, 1.45);
camera.position.set(
  Math.sin(0.8) * 49 * initialFit,
  17.4 * (initialFit > 1 ? 1.06 : 1),
  Math.cos(0.8) * 49 * initialFit
);
camera.lookAt(0, 2.6, 0);

// Warm every material while the loader is still on screen. Without this the
// first frame compiles shaders after the load event, which can stall the
// opening cinematic and screenshot tools.
try {
  renderer.compile(scene, camera);
} catch {
  // A failed pre-compile is non-fatal; three will compile on first render.
}

loaderBar.style.width = '72%';
loaderCopy.textContent = 'Lighting the campfire…';

requestAnimationFrame(() => {
  loaderBar.style.width = '100%';
  loaderCopy.textContent = 'The isle is awake.';
  setTimeout(() => {
    loader.classList.add('done');
    document.body.dataset.ready = 'true';
    introDone = true;
    setTimeout(() => hint.classList.add('gone'), 8500);
    setTimeout(() => {
      if (introDone) toast('Five lumen shards are hidden across the isle.', '');
    }, 1800);
  }, 420);
  animate();
});

window.__voxelIsle = {
  ready: true,
  scene,
  renderer,
  camera,
  world,
  player,
  controls,
  audio,
  get state() {
    return {
      timeOfDay,
      day: dayInfo.day,
      night: dayInfo.night,
      shards: shardsFound,
      player: player.position.toArray(),
      camera: camera.position.toArray(),
      tilt: controls.tiltEnabled,
      speed: speeds[speedIndex],
      ready: document.body.dataset.ready === 'true',
    };
  },
  setTime(t) { timeOfDay = ((t % 1) + 1) % 1; updateClock(true); },
  setSpeedIndex(i) { speedIndex = i % speeds.length; speedLabel.textContent = `${speeds[speedIndex]}×`; },
  setFreeCamera(position, target) {
    freeCamera = position ? { position, target } : null;
  },
};
