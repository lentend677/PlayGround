import * as THREE from '../vendor/three.module.js';
import { buildAtlas, makeBlockIcon, BLOCK, BLOCK_INFO, HOTBAR, TILE, TILE_SIZE, GRID } from './atlas.js';
import { World, SX, SY, SZ } from './world.js';
import { Sky } from './sky.js';
import { Controls, clamp, damp } from './controls.js';
import { Soundscape } from './audio.js';

/* ─────────────────────────────────────────────────────────────────────
   SKYSHARD — a small voxel world above the clouds.
   ───────────────────────────────────────────────────────────────────── */

const $ = (selector) => document.querySelector(selector);
const dom = {
  canvas: $('#scene'),
  loading: $('#loading'),
  loadBar: $('#loadBar'),
  loadStatus: $('#loadStatus'),
  start: $('#start'),
  playBtn: $('#playBtn'),
  tiltStartBtn: $('#tiltStartBtn'),
  soundStartBtn: $('#soundStartBtn'),
  hud: $('#hud'),
  menuBtn: $('#menuBtn'),
  menu: $('#menu'),
  closeMenuBtn: $('#closeMenuBtn'),
  resumeBtn: $('#resumeBtn'),
  tiltMenuBtn: $('#tiltMenuBtn'),
  soundMenuBtn: $('#soundMenuBtn'),
  newIslandBtn: $('#newIslandBtn'),
  clockTime: $('#clockTime'),
  clockIcon: $('#clockIcon'),
  cycleBtn: $('#cycleBtn'),
  tiltBadge: $('#tiltBadge'),
  recenterBtn: $('#recenterBtn'),
  crosshair: $('#crosshair'),
  targetName: $('#targetName'),
  joystick: $('#joystick'),
  joystickKnob: $('#joystickKnob'),
  hotbar: $('#hotbar'),
  mineBtn: $('#mineBtn'),
  placeBtn: $('#placeBtn'),
  jumpBtn: $('#jumpBtn'),
  toast: $('#toast'),
  fallOverlay: $('#fallOverlay'),
  returnBtn: $('#returnBtn'),
  rotateHint: $('#rotateHint'),
};

const state = {
  seed: 20261030,
  time: 0.35,
  dayLength: 240,
  speed: 1,
  started: false,
  paused: false,
  falling: false,
  mode: 'intro',
  selected: 0,
  sound: true,
  tilt: false,
  quality: 'high',
  introTime: 0,
  mining: false,
  mineTimer: 0,
};

const isCoarse = matchMedia('(pointer: coarse)').matches;
const BASE_FOV = () => (window.innerWidth < 760 && window.innerHeight > window.innerWidth ? 72 : 62);

let renderer;
let scene;
let camera;
let sunLight;
let hemi;
let world;
let sky;
let materials;
let controls;
let audio;
let particles;
let highlight;
let highlightMat;
let atlas;
let waterTexture;
let waterUniforms;
let plantUniforms;
let lanternLights = [];
let currentTarget = null;
let fly = null;
let fallTimer = 0;
let toastTimer = 0;
let timeUiTimer = 0;
let lastFrame = performance.now();
let elapsed = 0;
let started = false;
let uiReady = false;

const player = {
  pos: new THREE.Vector3(32, 30, 48),
  vel: new THREE.Vector3(),
  radius: 0.31,
  height: 1.78,
  eye: 1.58,
  onGround: false,
  coyote: 0,
  jumpBuffer: 0,
  bobPhase: 0,
  stepTimer: 0,
};

const dummy = new THREE.Object3D();
const tempVec = new THREE.Vector3();
const tempVec2 = new THREE.Vector3();
const tempColor = new THREE.Color();

/* ── tiny loading helpers ────────────────────────────────────────────── */
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setLoad(progress, text) {
  if (dom.loadBar) dom.loadBar.style.width = `${Math.max(4, Math.min(100, progress))}%`;
  if (text && dom.loadStatus) dom.loadStatus.textContent = text;
}

function showLoading(text = 'Shaping the island…') {
  dom.loading.style.display = '';
  dom.loading.classList.remove('is-gone');
  setLoad(6, text);
}

function hideLoading() {
  dom.loading.classList.add('is-gone');
  setTimeout(() => {
    if (dom.loading.classList.contains('is-gone')) dom.loading.style.display = 'none';
  }, 850);
}

function showToast(message, duration = 2400) {
  dom.toast.textContent = message;
  dom.toast.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('is-shown'), duration);
}

/* ── renderer / materials ────────────────────────────────────────────── */
function createRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas: dom.canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarse ? 1.7 : 2));
  renderer.setClearColor(0x0a1526, 1);
  renderer.autoClear = true;
}

function makeWaterTexture() {
  const c = document.createElement('canvas');
  c.width = TILE_SIZE;
  c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    atlas.canvas,
    (TILE.WATER % GRID) * TILE_SIZE,
    Math.floor(TILE.WATER / GRID) * TILE_SIZE,
    TILE_SIZE, TILE_SIZE,
    0, 0, TILE_SIZE, TILE_SIZE
  );
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function createMaterials() {
  const terrain = new THREE.MeshLambertMaterial({
    map: atlas.texture,
    vertexColors: true,
    dithering: true,
  });

  plantUniforms = { uTime: { value: 0 } };
  const plants = new THREE.MeshLambertMaterial({
    map: atlas.texture,
    vertexColors: true,
    side: THREE.DoubleSide,
    alphaTest: 0.42,
    transparent: false,
  });
  plants.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = plantUniforms.uTime;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float swayPhase = position.x * 0.55 + position.z * 1.05;
       float swayAmt = uv.y * uv.y;
       transformed.x += sin(uTime * 1.65 + swayPhase) * 0.055 * swayAmt;
       transformed.z += cos(uTime * 1.25 + swayPhase * 1.4) * 0.038 * swayAmt;`
    );
  };

  waterTexture = makeWaterTexture();
  waterUniforms = { uTime: { value: 0 } };
  const water = new THREE.MeshPhongMaterial({
    map: waterTexture,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    shininess: 130,
    specular: 0xbde9ff,
    side: THREE.DoubleSide,
  });
  water.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       transformed.y += sin(uTime * 1.35 + position.x * 0.9 + position.z * 1.15) * 0.014;`
    );
  };

  const glow = new THREE.MeshBasicMaterial({
    map: atlas.texture,
    vertexColors: true,
    toneMapped: false,
    fog: true,
  });

  return { terrain, plants, water, glow };
}

/* ── lighting ────────────────────────────────────────────────────────── */
function createLights() {
  hemi = new THREE.HemisphereLight(0xd9f0ff, 0x849172, 1.25);
  scene.add(hemi);

  sunLight = new THREE.DirectionalLight(0xfff4dc, 2.6);
  sunLight.position.set(80, 110, 50);
  sunLight.target.position.set(32, 20, 32);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(isCoarse ? 1536 : 2048, isCoarse ? 1536 : 2048);
  sunLight.shadow.camera.left = -40;
  sunLight.shadow.camera.right = 40;
  sunLight.shadow.camera.top = 40;
  sunLight.shadow.camera.bottom = -40;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 220;
  sunLight.shadow.bias = -0.0008;
  sunLight.shadow.normalBias = 0.025;
  scene.add(sunLight);
  scene.add(sunLight.target);
}

/* ── particles ───────────────────────────────────────────────────────── */
const BLOCK_COLORS = {
  [BLOCK.GRASS]: 0x77bd58,
  [BLOCK.DIRT]: 0x8a5d3e,
  [BLOCK.STONE]: 0x8b959d,
  [BLOCK.SAND]: 0xe4d29b,
  [BLOCK.LOG]: 0x7e5838,
  [BLOCK.LEAVES]: 0x447f3f,
  [BLOCK.PLANKS]: 0xb78a55,
  [BLOCK.WATER]: 0x4fa8c9,
  [BLOCK.LANTERN]: 0xffd47d,
  [BLOCK.COBBLE]: 0x8d979d,
  [BLOCK.CRYSTAL]: 0x79e7f2,
  [BLOCK.FLOWER_RED]: 0xc9473f,
  [BLOCK.FLOWER_YELLOW]: 0xf0ce4b,
  [BLOCK.TALL_GRASS]: 0x5c9e47,
  [BLOCK.LILY]: 0x4b9150,
};

class Particles {
  constructor(scene, count = 72) {
    this.count = count;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      count
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = 6;
    this.items = Array.from({ length: count }, () => ({
      life: 0, maxLife: 1, size: 0.1,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: 0,
    }));
    this.cursor = 0;
    for (let i = 0; i < count; i++) {
      this.mesh.setColorAt(i, new THREE.Color(0xffffff));
      dummy.position.set(0, -100, 0);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
  }

  spawn(position, color, amount = 10, power = 2.2, size = 0.13) {
    for (let i = 0; i < amount; i++) {
      const item = this.items[this.cursor];
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      item.life = 0.42 + Math.random() * 0.55;
      item.maxLife = item.life;
      item.size = size * (0.55 + Math.random() * 0.9);
      item.pos.set(
        position.x + (Math.random() - 0.5) * 0.7,
        position.y + (Math.random() - 0.5) * 0.7,
        position.z + (Math.random() - 0.5) * 0.7
      );
      item.vel.set(
        (Math.random() - 0.5) * power,
        Math.random() * power * 0.85 + 0.5,
        (Math.random() - 0.5) * power
      );
      item.spin = (Math.random() - 0.5) * 9;
      this.mesh.setColorAt(idx, tempColor.set(color).multiplyScalar(0.85 + Math.random() * 0.3));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    let dirty = false;
    for (let i = 0; i < this.count; i++) {
      const item = this.items[i];
      if (item.life <= 0) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0);
        dummy.rotation.set(0, 0, 0);
      } else {
        item.life -= dt;
        item.vel.y -= 17 * dt;
        item.pos.addScaledVector(item.vel, dt);
        item.vel.x *= 0.985;
        item.vel.z *= 0.985;
        const t = Math.max(0, item.life / item.maxLife);
        const scale = item.size * (0.4 + t * 0.8);
        dummy.position.copy(item.pos);
        dummy.scale.setScalar(scale);
        dummy.rotation.set(item.spin * (1 - t), item.spin * 0.7 * (1 - t), item.spin * (1 - t));
      }
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      dirty = true;
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (const item of this.items) item.life = 0;
    this.update(0);
  }
}

/* ── selection highlight ─────────────────────────────────────────────── */
function createHighlight() {
  const group = new THREE.Group();
  const box = new THREE.BoxGeometry(1.006, 1.006, 1.006);
  const edges = new THREE.EdgesGeometry(box);
  highlightMat = new THREE.LineBasicMaterial({
    color: 0x0a1a20,
    transparent: true,
    opacity: 0.58,
    depthTest: true,
  });
  const lines = new THREE.LineSegments(edges, highlightMat);
  lines.renderOrder = 5;
  group.add(lines);
  const overlay = new THREE.Mesh(
    box,
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  overlay.renderOrder = 4;
  group.add(overlay);
  group.visible = false;
  group.frustumCulled = false;
  return group;
}

/* ── player ──────────────────────────────────────────────────────────── */
function setPlayerToSpawn() {
  const s = world.spawn;
  const pitch = s.pitch ?? -0.055;
  player.pos.set(s.x, s.y, s.z);
  player.vel.set(0, 0, 0);
  player.onGround = true;
  player.coyote = 0.12;
  player.jumpBuffer = 0;
  player.bobPhase = 0;
  player.stepTimer = 0.2;
  controls.setYaw(s.yaw, pitch);
  camera.position.set(s.x, s.y + player.eye, s.z);
  camera.rotation.set(pitch, s.yaw, 0, 'YXZ');
}

function updatePlayer(dt) {
  if (state.mode !== 'play' || state.paused || state.falling) return;

  const input = controls.move;
  const speed = controls.sprint ? 6.25 : 4.45;
  const sin = Math.sin(controls.yaw);
  const cos = Math.cos(controls.yaw);
  const tx = (-sin * input.y + cos * input.x) * speed;
  const tz = (-cos * input.y - sin * input.x) * speed;
  const accel = player.onGround ? 15 : 4.2;
  player.vel.x = damp(player.vel.x, tx, accel, dt);
  player.vel.z = damp(player.vel.z, tz, accel, dt);

  if (controls.consumeJump()) player.jumpBuffer = 0.16;
  player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

  if (player.jumpBuffer > 0 && (player.onGround || player.coyote > 0)) {
    player.vel.y = 8.55;
    player.onGround = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    audio.jump();
  }

  player.vel.y = Math.max(-34, player.vel.y - 26 * dt);

  const fallSpeed = player.vel.y;
  player.onGround = false;
  sweepAxis('x', player.vel.x * dt);
  sweepAxis('z', player.vel.z * dt);
  sweepAxis('y', player.vel.y * dt);

  if (player.onGround) {
    if (player.coyote <= 0 && fallSpeed < -4.5) audio.land();
    player.coyote = 0.12;
  } else {
    player.coyote = Math.max(0, player.coyote - dt);
  }

  if (player.pos.y < -28) {
    startFall();
    return;
  }

  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  if (player.onGround && hSpeed > 0.6) {
    player.bobPhase += dt * (7.4 + hSpeed * 0.7);
    player.stepTimer -= dt;
    if (player.stepTimer <= 0) {
      player.stepTimer = 0.4 - Math.min(0.12, hSpeed * 0.012);
      const surface = world.surfaceType(Math.floor(player.pos.x), Math.floor(player.pos.z));
      const info = BLOCK_INFO[surface];
      audio.step(info?.sound || (surface === BLOCK.SAND ? 'sand' : 'grass'));
    }
  } else {
    player.stepTimer = Math.min(player.stepTimer, 0.15);
  }

  const bob = player.onGround && hSpeed > 0.4
    ? Math.sin(player.bobPhase) * 0.036 * clamp(hSpeed / 4.5, 0, 1)
    : 0;
  const sway = player.onGround && hSpeed > 0.4
    ? Math.sin(player.bobPhase * 0.5) * 0.0055 * clamp(hSpeed / 4.5, 0, 1)
    : 0;
  camera.position.set(player.pos.x, player.pos.y + player.eye + bob, player.pos.z);
  camera.rotation.set(controls.pitch, controls.yaw, sway, 'YXZ');
}

function sweepAxis(axis, delta) {
  if (delta === 0) return;
  player.pos[axis] += delta;
  const r = player.radius;
  const h = player.height;
  const minX = Math.floor(player.pos.x - r + 0.0001);
  const maxX = Math.floor(player.pos.x + r - 0.0001);
  const minY = Math.floor(player.pos.y + 0.0001);
  const maxY = Math.floor(player.pos.y + h - 0.0001);
  const minZ = Math.floor(player.pos.z - r + 0.0001);
  const maxZ = Math.floor(player.pos.z + r - 0.0001);
  let snap = null;

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (!world.isSolid(x, y, z)) continue;
        let boundary;
        if (axis === 'x') boundary = delta > 0 ? x - r - 0.0005 : x + 1 + r + 0.0005;
        else if (axis === 'z') boundary = delta > 0 ? z - r - 0.0005 : z + 1 + r + 0.0005;
        else boundary = delta > 0 ? y - h - 0.0005 : y + 1;
        if (snap === null) snap = boundary;
        else snap = delta > 0 ? Math.min(snap, boundary) : Math.max(snap, boundary);
      }
    }
  }
  if (snap !== null) {
    player.pos[axis] = snap;
    if (axis === 'y') {
      if (delta < 0) player.onGround = true;
      player.vel.y = 0;
    } else {
      player.vel[axis] = 0;
    }
  }
}

function intersectsPlayer(x, y, z) {
  const r = player.radius + 0.02;
  return (
    player.pos.x + r > x && player.pos.x - r < x + 1 &&
    player.pos.z + r > z && player.pos.z - r < z + 1 &&
    player.pos.y + player.height > y && player.pos.y < y + 1
  );
}

function startFall() {
  if (state.falling) return;
  state.falling = true;
  controls.setEnabled(false);
  dom.fallOverlay.hidden = false;
  clearTimeout(fallTimer);
  fallTimer = setTimeout(respawn, 2600);
}

function respawn() {
  if (!state.falling) return;
  clearTimeout(fallTimer);
  state.falling = false;
  dom.fallOverlay.hidden = true;
  setPlayerToSpawn();
  controls.setEnabled(true);
  audio.ui();
  showToast('Back on solid grass', 1700);
}

/* ── world editing ───────────────────────────────────────────────────── */
function rebuildWorld() {
  world.build(materials);
  syncLanternLights();
}

function syncLanternLights() {
  for (const light of lanternLights) scene.remove(light);
  lanternLights = [];
  if (!world) return;
  const spots = world.lanternPositions();
  const max = 6;
  for (let i = 0; i < Math.min(spots.length, max); i++) {
    const light = new THREE.PointLight(0xffc266, 0, 11, 2);
    light.position.copy(spots[i]);
    scene.add(light);
    lanternLights.push(light);
  }
}

function breakBlock() {
  if (!currentTarget || state.mode !== 'play' || state.paused || state.falling) return false;
  const { x, y, z, type } = currentTarget;
  const info = BLOCK_INFO[type];
  if (!info) return false;
  world.setBlock(x, y, z, BLOCK.AIR, true);
  const above = world.getBlock(x, y + 1, z);
  if (BLOCK_INFO[above]?.plant) world.setBlock(x, y + 1, z, BLOCK.AIR, true);

  const color = BLOCK_COLORS[type] || 0xaaaaaa;
  particles.spawn(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), color, 12, 2.8, 0.14);
  audio.mine(info.sound || 'dirt');
  rebuildWorld();
  currentTarget = null;
  dom.crosshair.classList.remove('is-target');
  dom.targetName.classList.remove('is-visible');
  highlight.visible = false;
  return true;
}

function placeBlock() {
  if (!currentTarget || state.mode !== 'play' || state.paused || state.falling) return false;
  const { x, y, z, nx, ny, nz } = currentTarget;
  const tx = x + nx;
  const ty = y + ny;
  const tz = z + nz;
  if (!world.inside(tx, ty, tz)) return false;
  const existing = world.getBlock(tx, ty, tz);
  const exInfo = BLOCK_INFO[existing];
  const canReplace = existing === BLOCK.AIR || exInfo?.plant || exInfo?.water;
  if (!canReplace) return false;
  if (intersectsPlayer(tx, ty, tz)) {
    showToast('No room to build there', 1300);
    return false;
  }
  const type = HOTBAR[state.selected];
  world.setBlock(tx, ty, tz, type, true);
  const color = BLOCK_COLORS[type] || 0xaaaaaa;
  particles.spawn(new THREE.Vector3(tx + 0.5, ty + 0.5, tz + 0.5), color, 7, 1.8, 0.11);
  audio.place(BLOCK_INFO[type]?.sound || 'dirt');
  rebuildWorld();
  currentTarget = null;
  return true;
}

function updateTarget() {
  if (state.mode !== 'play' || state.paused || state.falling) {
    currentTarget = null;
    highlight.visible = false;
    dom.crosshair.classList.remove('is-target');
    dom.targetName.classList.remove('is-visible');
    return;
  }
  camera.updateMatrixWorld();
  camera.getWorldDirection(tempVec);
  const hit = world.raycast(camera.position, tempVec, 5.8);
  currentTarget = hit;
  if (hit) {
    highlight.visible = true;
    highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    const info = BLOCK_INFO[hit.type];
    if (info) {
      dom.targetName.textContent = info.name;
      dom.targetName.classList.add('is-visible');
    }
    dom.crosshair.classList.add('is-target');
  } else {
    highlight.visible = false;
    dom.crosshair.classList.remove('is-target');
    dom.targetName.classList.remove('is-visible');
  }
}

/* ── hotbar ──────────────────────────────────────────────────────────── */
function setupHotbar() {
  dom.hotbar.innerHTML = '';
  HOTBAR.forEach((type, index) => {
    const info = BLOCK_INFO[type];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slot';
    button.dataset.index = String(index);
    button.title = info.name;
    button.setAttribute('aria-label', info.name);
    const icon = makeBlockIcon(atlas.canvas, info.icon, 72);
    const img = document.createElement('img');
    img.src = icon;
    img.alt = '';
    const key = document.createElement('span');
    key.className = 'key';
    key.textContent = String(index + 1);
    button.append(img, key);
    button.addEventListener('pointerdown', (e) => e.stopPropagation());
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      selectSlot(index, true);
    });
    dom.hotbar.append(button);
  });
  updateHotbarSelection();
}

function selectSlot(index, announce = false) {
  if (index === -2) {
    cycleSpeed();
    return;
  }
  const n = HOTBAR.length;
  state.selected = ((index % n) + n) % n;
  updateHotbarSelection();
  if (announce) {
    showToast(`${BLOCK_INFO[HOTBAR[state.selected]].name} selected`, 1100);
  }
  audio.ui();
}

function updateHotbarSelection() {
  [...dom.hotbar.children].forEach((slot, index) => {
    slot.classList.toggle('is-active', index === state.selected);
    slot.setAttribute('aria-pressed', index === state.selected ? 'true' : 'false');
  });
}

/* ── time / speed ────────────────────────────────────────────────────── */
function cycleSpeed() {
  state.speed = state.speed === 1 ? 4 : state.speed === 4 ? 0 : 1;
  updateTimeUi(true);
  audio.ui();
  showToast(state.speed === 0 ? 'Time paused' : `Time speed ${state.speed}×`, 1300);
}

function updateTimeUi(force = false) {
  const hours = state.time * 24;
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  const text = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (force || dom.clockTime.textContent !== text) dom.clockTime.textContent = text;
  const day = sky ? sky.cycle.sunDir.y > -0.04 : true;
  if (force) {
    dom.clockIcon.textContent = day ? '☀' : '☾';
    dom.clockIcon.style.color = day ? 'var(--accent)' : '#a9c6ff';
    dom.clockIcon.style.textShadow = day
      ? '0 0 12px rgba(255,208,113,.6)'
      : '0 0 12px rgba(169,198,255,.6)';
  }
  const label = state.speed === 0 ? '⏸' : `${state.speed}×`;
  if (dom.cycleBtn.textContent !== label) dom.cycleBtn.textContent = label;
  document.querySelectorAll('[data-speed]').forEach((btn) => {
    btn.classList.toggle('is-active', Number(btn.dataset.speed) === state.speed);
  });
}

/* ── tilt UI ─────────────────────────────────────────────────────────── */
function updateTiltUi(status) {
  const on = !!controls?.tilt.enabled;
  state.tilt = on;
  dom.tiltStartBtn.classList.toggle('is-on', on);
  dom.tiltStartBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  const chip = dom.tiltStartBtn.querySelector('.chip-state');
  if (chip) chip.textContent = on ? 'on' : 'off';
  dom.tiltMenuBtn.classList.toggle('is-on', on);
  dom.tiltMenuBtn.setAttribute('aria-checked', on ? 'true' : 'false');
  dom.tiltBadge.hidden = !(on && state.started);
  if (status === 'denied') {
    showToast('Motion access was blocked. Allow Motion & Orientation in Settings.', 3600);
  } else if (status === 'unsupported') {
    showToast('Tilt is not available on this device.', 2600);
  } else if (status === 'recentered') {
    showToast('Tilt centered', 1200);
  } else if (status === 'on') {
    showToast('Tilt look on · hold naturally, tap ◎ to recenter', 3000);
  }
}

async function toggleTilt() {
  if (controls.tilt.enabled) {
    controls.setTilt(false);
    showToast('Tilt look off', 1200);
    return;
  }
  const ok = await controls.setTilt(true);
  if (!ok && controls.tilt.status === 'denied') {
    showToast('Motion access blocked — enable it in your browser settings.', 3400);
  } else if (!ok && controls.tilt.status === 'unsupported') {
    showToast('Tilt is not available on this device.', 2600);
  }
}

function updateSoundUi() {
  dom.soundStartBtn.classList.toggle('is-on', state.sound);
  dom.soundStartBtn.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
  const chip = dom.soundStartBtn.querySelector('.chip-state');
  if (chip) chip.textContent = state.sound ? 'on' : 'off';
  dom.soundMenuBtn.classList.toggle('is-on', state.sound);
  dom.soundMenuBtn.setAttribute('aria-checked', state.sound ? 'true' : 'false');
}

function toggleSound() {
  state.sound = !state.sound;
  audio.setEnabled(state.sound);
  updateSoundUi();
  if (state.sound) {
    audio.start();
    audio.ui();
  }
}

/* ── menu ────────────────────────────────────────────────────────────── */
function openMenu() {
  if (!state.started || state.falling) return;
  state.paused = true;
  dom.menu.hidden = false;
  controls.setEnabled(false);
  dom.menuBtn.setAttribute('aria-expanded', 'true');
  audio.ui();
}

function closeMenu() {
  dom.menu.hidden = true;
  state.paused = false;
  controls.setEnabled(state.mode === 'play');
  dom.menuBtn.setAttribute('aria-expanded', 'false');
}

async function newIsland() {
  closeMenu();
  state.paused = true;
  controls.setEnabled(false);
  showLoading('Finding a new shard…');
  setLoad(14, 'Finding a new shard…');
  await delay(280);
  state.seed = (Date.now() ^ (Math.random() * 0xffffff)) >>> 0;
  setLoad(32, 'Carving cliffs and coves…');
  await frame();
  world.generate(state.seed);
  setLoad(62, 'Planting trees and lanterns…');
  await frame();
  rebuildWorld();
  particles.clear();
  state.time = 0.35;
  setPlayerToSpawn();
  state.mode = 'play';
  state.falling = false;
  dom.fallOverlay.hidden = true;
  setLoad(86, 'Painting a fresh sky…');
  await frame();
  renderer.render(scene, camera);
  setLoad(100, 'Ready');
  await delay(320);
  hideLoading();
  state.paused = false;
  controls.setEnabled(true);
  showToast('A fresh shard drifts in', 2200);
}

function setQuality(quality) {
  state.quality = quality;
  const high = quality === 'high';
  sunLight.castShadow = high;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? (isCoarse ? 1.7 : 2) : 1.15));
  resize();
  document.querySelectorAll('[data-quality]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.quality === quality);
  });
  try { localStorage.setItem('skyshard-quality', quality); } catch {}
  showToast(high ? 'High graphics · soft shadows on' : 'Low graphics · shadows off', 1600);
}

/* ── start / intro ───────────────────────────────────────────────────── */
function setIntroCamera(t = 0) {
  const angle = 0.66 + t * 0.085;
  const r = 52;
  camera.position.set(
    32 + Math.cos(angle) * r,
    31.5 + Math.sin(t * 0.55) * 2.0,
    32 + Math.sin(angle) * r
  );
  camera.lookAt(32, 23.4, 32);
  camera.fov = 55;
  camera.updateProjectionMatrix();
}

function startPlaying() {
  if (state.started) return;
  state.started = true;
  state.mode = 'fly';
  audio.start();
  state.paused = false;

  dom.start.classList.add('is-gone');
  setTimeout(() => { dom.start.hidden = true; }, 850);
  dom.hud.hidden = false;
  dom.hud.classList.add('is-hidden');
  requestAnimationFrame(() => dom.hud.classList.remove('is-hidden'));
  updateTiltUi('start');
  updateSoundUi();

  const endYaw = controls.yaw;
  const endPitch = controls.pitch;
  const endPos = new THREE.Vector3(world.spawn.x, world.spawn.y + player.eye, world.spawn.z);
  const endQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(endPitch, endYaw, 0, 'YXZ'));
  fly = {
    t: 0,
    duration: 2.15,
    fromPos: camera.position.clone(),
    fromQuat: camera.quaternion.clone(),
    toPos: endPos,
    toQuat: endQuat,
    fromFov: camera.fov,
    toFov: BASE_FOV(),
  };
  controls.setEnabled(false);
  audio.ui();
  if (isCoarse && window.innerHeight > window.innerWidth) {
    setTimeout(() => {
      if (state.mode === 'play' && window.innerHeight > window.innerWidth) {
        dom.rotateHint.hidden = false;
        setTimeout(() => { dom.rotateHint.hidden = true; }, 6500);
      }
    }, 1500);
  }
}

function updateFly(dt) {
  fly.t += dt;
  const t = clamp(fly.t / fly.duration, 0, 1);
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  camera.position.lerpVectors(fly.fromPos, fly.toPos, e);
  camera.quaternion.slerpQuaternions(fly.fromQuat, fly.toQuat, e);
  camera.fov = fly.fromFov + (fly.toFov - fly.fromFov) * e;
  camera.updateProjectionMatrix();
  if (t >= 1) {
    state.mode = 'play';
    controls.setEnabled(true);
    camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
    camera.rotation.set(controls.pitch, controls.yaw, 0, 'YXZ');
    camera.fov = BASE_FOV();
    camera.updateProjectionMatrix();
    fly = null;
    showToast('Tap blocks to mine · pick a block from the hotbar to build', 3000);
  }
}

/* ── input buttons ───────────────────────────────────────────────────── */
function bindUi() {
  dom.playBtn.addEventListener('click', startPlaying);

  dom.tiltStartBtn.addEventListener('click', toggleTilt);
  dom.tiltMenuBtn.addEventListener('click', toggleTilt);
  dom.recenterBtn.addEventListener('click', () => controls.tilt.recenter());
  dom.soundStartBtn.addEventListener('click', toggleSound);
  dom.soundMenuBtn.addEventListener('click', toggleSound);

  dom.menuBtn.addEventListener('click', openMenu);
  dom.closeMenuBtn.addEventListener('click', closeMenu);
  dom.resumeBtn.addEventListener('click', closeMenu);
  dom.newIslandBtn.addEventListener('click', newIsland);
  dom.cycleBtn.addEventListener('click', cycleSpeed);
  dom.returnBtn.addEventListener('click', respawn);

  dom.menu.addEventListener('pointerdown', (event) => {
    if (event.target === dom.menu) closeMenu();
  });

  document.querySelectorAll('[data-speed]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.speed = Number(btn.dataset.speed);
      updateTimeUi(true);
      audio.ui();
    });
  });
  document.querySelectorAll('[data-quality]').forEach((btn) => {
    btn.addEventListener('click', () => setQuality(btn.dataset.quality));
  });

  const jump = (event) => {
    if (event) event.preventDefault();
    if (state.mode !== 'play' || state.paused || state.falling) return;
    controls.jumpQueued = true;
    dom.jumpBtn.classList.add('is-down');
    setTimeout(() => dom.jumpBtn.classList.remove('is-down'), 140);
  };
  dom.jumpBtn.addEventListener('pointerdown', jump);
  dom.jumpBtn.addEventListener('click', (e) => e.preventDefault());

  const mineStart = (event) => {
    event.preventDefault();
    if (state.mode !== 'play' || state.paused || state.falling) return;
    state.mining = true;
    state.mineTimer = 0.19;
    breakBlock();
    dom.mineBtn.classList.add('is-down');
    dom.mineBtn.setPointerCapture?.(event.pointerId);
  };
  const mineEnd = () => {
    state.mining = false;
    dom.mineBtn.classList.remove('is-down');
  };
  dom.mineBtn.addEventListener('pointerdown', mineStart);
  dom.mineBtn.addEventListener('pointerup', mineEnd);
  dom.mineBtn.addEventListener('pointercancel', mineEnd);
  dom.mineBtn.addEventListener('pointerleave', () => {
    if (state.mining) mineEnd();
  });
  dom.mineBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  const doPlace = (event) => {
    event.preventDefault();
    placeBlock();
    dom.placeBtn.classList.add('is-down');
    setTimeout(() => dom.placeBtn.classList.remove('is-down'), 140);
  };
  dom.placeBtn.addEventListener('pointerdown', doPlace);
  dom.placeBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 220));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.started && !state.paused && !state.falling) openMenu();
  });
}

/* ── camera / resize ─────────────────────────────────────────────────── */
function resize() {
  if (!renderer || !camera) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (state.mode === 'play') camera.fov = BASE_FOV();
  camera.updateProjectionMatrix();
  if (window.innerWidth > window.innerHeight) dom.rotateHint.hidden = true;
}

/* ── loop ────────────────────────────────────────────────────────────── */
function loop(now) {
  requestAnimationFrame(loop);
  const raw = (now - lastFrame) / 1000;
  lastFrame = now;
  const dt = Math.min(0.05, Math.max(0.0001, raw));
  elapsed += dt;

  if (uiReady && !state.paused && !state.falling && state.speed > 0) {
    state.time = (state.time + (dt * state.speed) / state.dayLength) % 1;
  }

  controls.update(dt);

  if (state.mode === 'intro') {
    state.introTime += dt;
    setIntroCamera(state.introTime);
  } else if (state.mode === 'fly' && fly) {
    updateFly(dt);
  } else if (state.mode === 'play') {
    if (!state.paused && !state.falling) {
      updatePlayer(dt);
      if (state.mining) {
        state.mineTimer -= dt;
        if (state.mineTimer <= 0) {
          state.mineTimer = 0.2;
          breakBlock();
        }
      }
    } else if (!state.paused) {
      camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
      camera.rotation.set(controls.pitch, controls.yaw, 0, 'YXZ');
    }
  }

  const palette = sky.update(state.time, camera, dt);

  waterUniforms.uTime.value = elapsed;
  plantUniforms.uTime.value = elapsed;
  waterTexture.offset.x = elapsed * 0.008;
  waterTexture.offset.y = elapsed * 0.004;

  const night = palette.night;
  lanternLights.forEach((light, index) => {
    const flicker = 1 + Math.sin(elapsed * 5.6 + index * 2.1) * 0.05 + Math.sin(elapsed * 11 + index) * 0.025;
    light.intensity = (0.55 + night * 10.5) * flicker;
  });
  if (highlightMat) {
    highlightMat.color.setRGB(0.04 + night * 0.82, 0.07 + night * 0.86, 0.08 + night * 0.78);
    highlightMat.opacity = 0.5 + night * 0.2;
  }

  updateTarget();
  particles.update(dt);
  audio.update(dt, palette.day);

  timeUiTimer -= dt;
  if (timeUiTimer <= 0) {
    timeUiTimer = 0.2;
    updateTimeUi();
  }

  if (state.mode === 'play' && state.started) {
    dom.tiltBadge.hidden = !controls.tilt.enabled;
  }

  renderer.render(scene, camera);
}

/* ── init ────────────────────────────────────────────────────────────── */
async function init() {
  try {
    createRenderer();
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xc1e4ee, 64, 260);
    camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 1200);
    camera.rotation.order = 'YXZ';
    createLights();
    atlas = buildAtlas();

    setLoad(16, 'Shaping the island…');
    await frame();
    materials = createMaterials();

    setLoad(32, 'Carving cliffs and coves…');
    await frame();
    world = new World(state.seed);
    world.generate();
    scene.add(world.group);

    setLoad(54, 'Raising the trees…');
    await frame();
    rebuildWorld();

    setLoad(72, 'Painting the sky…');
    await frame();
    sky = new Sky(scene, { sunLight, hemi, renderer });
    particles = new Particles(scene);
    highlight = createHighlight();
    scene.add(highlight);

    setLoad(84, 'Lighting the lanterns…');
    await frame();
    setupHotbar();
    controls = new Controls({
      canvas: dom.canvas,
      joystickEl: dom.joystick,
      joystickKnob: dom.joystickKnob,
      onTap: (_e, kind) => {
        if (state.mode !== 'play' || state.paused || state.falling) return;
        if (kind === 'mine') breakBlock();
        else if (kind === 'place') placeBlock();
      },
      onMenu: () => {
        if (state.paused) closeMenu();
        else openMenu();
      },
      onSelectSlot: (index) => selectSlot(index),
      onWheelSlot: (delta) => selectSlot(state.selected + delta),
    });
    controls.setTiltStatusHandler(updateTiltUi);
    audio = new Soundscape();
    audio.enabled = state.sound;
    setPlayerToSpawn();
    setIntroCamera(0);
    bindUi();
    updateTimeUi(true);
    updateSoundUi();
    updateTiltUi('init');
    resize();

    document.querySelector('.loading-inner')?.classList.add('is-ready');
    setLoad(94, 'Waking the fireflies…');
    await frame();
    renderer.render(scene, camera);
    setLoad(100, 'Ready');
    await delay(320);
    uiReady = true;
    hideLoading();

    try {
      const saved = localStorage.getItem('skyshard-quality');
      if (saved === 'low') setQuality('low');
    } catch {}

    window.__skyshard = {
      state,
      world,
      player,
      camera,
      controls,
      renderer,
      scene,
      start: startPlaying,
      setTime: (t) => { state.time = ((t % 1) + 1) % 1; updateTimeUi(true); },
      setSpeed: (s) => { state.speed = s; updateTimeUi(true); },
      place: placeBlock,
      break: breakBlock,
      teleport: (x, y, z) => { player.pos.set(x, y, z); player.vel.set(0, 0, 0); },
      getTarget: () => currentTarget,
      ready: true,
    };

    if (!state.started) requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    if (dom.loadStatus) {
      dom.loadStatus.textContent = 'The island failed to load. Check the console for details.';
      dom.loadStatus.style.color = '#ffb4a2';
    }
    if (dom.loadBar) dom.loadBar.style.background = '#ff8f7a';
  }
}

init();
