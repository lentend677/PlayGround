import * as THREE from './three.module.min.js';
import { World } from './world.js';
import { Minion, SKINS, SKIN_ORDER } from './character.js';
import {
  makeStripeTexture,
  makeGlowTexture,
  makeShadowTexture,
  makePowerTexture,
  makeTrainSideTexture,
  makeTrainFrontTexture,
} from './textures.js';

const LANES = [-2.5, 0, 2.5];
const SPAWN_Z = -112;
const GRAVITY = 29;
const JUMP_V = 9.8;
const ROLL_TIME = 0.62;
const MAX_SPEED = 30;
const START_SPEED = 16.5;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (n) => (Math.random() * n) | 0;

export class Game {
  constructor(canvas, { sound, onHud, onGameOver, onState } = {}) {
    this.canvas = canvas;
    this.sound = sound;
    this.onHud = onHud || (() => {});
    this.onGameOver = onGameOver || (() => {});
    this.onState = onState || (() => {});

    this.state = 'menu';
    this.skin = 'kevin';
    this.lane = 1;
    this.targetLane = 1;
    this.roll = 0;
    this.vy = 0;
    this.grounded = true;
    this.magnet = 0;
    this.shield = false;
    this.invuln = 0;
    this.crashProgress = 0;
    this.shake = 0;
    this.time = 0;
    this.hudT = 0;
    this.combo = 0;
    this.comboT = 0;
    this.coinStreak = 0;

    this.initRenderer();
    this.initScene();
    this.initPlayer();
    this.initPools();
    this.initCamera();

    this.clock = new THREE.Clock();
    this.raf = requestAnimationFrame(this.loop);
  }

  /* ------------------------------------------------------------------ */
  /* Setup                                                               */
  /* ------------------------------------------------------------------ */
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x9fd6ff, 1);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xc9e9ff, 55, 185);
    this.world = new World(this.scene);

    const hemi = new THREE.HemisphereLight(0xd8efff, 0x6b5a42, 1.55);
    this.scene.add(hemi);

    const fill = new THREE.AmbientLight(0x9fb8ff, 0.38);
    this.scene.add(fill);

    const sun = new THREE.DirectionalLight(0xfff1cf, 2.5);
    sun.position.set(14, 26, 18);
    sun.target.position.set(0, 0, -18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 26;
    sun.shadow.camera.bottom = -26;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  initPlayer() {
    this.anchor = new THREE.Group();
    this.scene.add(this.anchor);

    this.minions = {};
    for (const key of SKIN_ORDER) {
      const m = new Minion(key);
      m.group.visible = key === this.skin;
      this.anchor.add(m.group);
      this.minions[key] = m;
    }
    this.player = this.minions[this.skin];

    // soft contact shadow
    const shadowMap = makeShadowTexture();
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowMap,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      color: 0x000000,
    });
    this.contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.9), shadowMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.set(0, 0.015, 0.1);
    this.contactShadow.renderOrder = 2;
    this.scene.add(this.contactShadow);

    // shield bubble
    this.bubble = new THREE.Group();
    const b1 = new THREE.Mesh(
      new THREE.SphereGeometry(1.02, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x6ee7ff, transparent: true, opacity: 0.14, depthWrite: false })
    );
    const b2 = new THREE.Mesh(
      new THREE.SphereGeometry(1.03, 18, 12),
      new THREE.MeshBasicMaterial({ color: 0xbdf4ff, wireframe: true, transparent: true, opacity: 0.12, depthWrite: false })
    );
    this.bubble.add(b1, b2);
    this.bubble.position.y = 0.95;
    this.bubble.visible = false;
    this.anchor.add(this.bubble);
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(66, 1, 0.1, 340);
    this.camPos = new THREE.Vector3(2.4, 2.3, 5.4);
    this.camLook = new THREE.Vector3(0, 0.55, -0.4);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.portrait = h > w;
    this.compactLandscape = !this.portrait && h < 620;
    this.tinyPortrait = this.portrait && h < 540;
    this.baseFov = this.portrait ? 68 : 57;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  initPools() {
    this.glowTex = makeGlowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.stripeTex = makeStripeTexture();
    this.obstacles = [];
    this.coins = [];
    this.powers = [];
    this.particles = [];
    this.pools = { barrier: [], bar: [], coin: [], magnet: [], shield: [] };
    this.trainPools = [[], [], [], []];
    this.trainMats = [];

    const colors = ['#e54545', '#3f7be0', '#f0b51e', '#41b57d'];
    for (let i = 0; i < colors.length; i++) {
      const side = makeTrainSideTexture(colors[i]);
      const front = makeTrainFrontTexture(colors[i]);
      const sideMat = new THREE.MeshStandardMaterial({ map: side, roughness: 0.44, metalness: 0.12 });
      const frontMat = new THREE.MeshStandardMaterial({ map: front, roughness: 0.44, metalness: 0.12 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x8f98a8, roughness: 0.68, metalness: 0.2 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x232735, roughness: 0.8 });
      this.trainMats.push([sideMat, sideMat, roofMat, darkMat, frontMat, frontMat]);
    }

    // shared obstacle bits
    this.barrierMat = new THREE.MeshStandardMaterial({
      map: this.stripeTex,
      roughness: 0.62,
      emissive: 0x3a1b00,
      emissiveIntensity: 0.25,
    });
    this.orangeMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7 });
    this.darkMetal = new THREE.MeshStandardMaterial({ color: 0x33384a, roughness: 0.55, metalness: 0.35 });
    this.amberMat = new THREE.MeshStandardMaterial({
      color: 0xffc93c,
      emissive: 0xffa000,
      emissiveIntensity: 1.8,
      roughness: 0.4,
    });
    this.bananaMat = new THREE.MeshStandardMaterial({
      color: 0xffd93d,
      emissive: 0x7a4a00,
      emissiveIntensity: 0.45,
      roughness: 0.42,
    });
    this.bananaTipMat = new THREE.MeshStandardMaterial({ color: 0x6b4a12, roughness: 0.7 });
  }

  /* ------------------------------------------------------------------ */
  /* Pools                                                               */
  /* ------------------------------------------------------------------ */
  makeBarrier() {
    const g = new THREE.Group();
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.5, 0.22), this.barrierMat);
    plank.position.y = 0.76;
    plank.castShadow = true;
    g.add(plank);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.09, 0.3), this.orangeMat);
    top.position.y = 1.05;
    g.add(top);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.78, 0.5), this.orangeMat);
      leg.position.set(side * 0.82, 0.39, 0);
      leg.castShadow = true;
      g.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.72), this.darkMetal);
      foot.position.set(side * 0.82, 0.045, 0);
      g.add(foot);
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), this.amberMat);
    lamp.position.set(0, 1.15, 0);
    g.add(lamp);
    g.userData = { type: 'barrier', depth: 0.55 };
    return g;
  }

  makeBar() {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.44, 0.34), this.barrierMat);
    bar.position.y = 1.68;
    bar.castShadow = true;
    g.add(bar);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.12, 0.5), this.orangeMat);
    plate.position.y = 1.96;
    g.add(plate);
    for (const side of [-1, 1]) {
      const cable = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.05), this.darkMetal);
      cable.position.set(side * 0.88, 2.55, 0);
      g.add(cable);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), this.amberMat);
      lamp.position.set(side * 0.8, 1.68, 0.2);
      g.add(lamp);
    }
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.36),
      new THREE.MeshBasicMaterial({
        map: this.makeDuckTexture(),
        transparent: true,
        side: THREE.DoubleSide,
      })
    );
    sign.position.set(0, 1.62, 0.2);
    g.add(sign);
    g.userData = { type: 'bar', depth: 0.45 };
    return g;
  }

  makeDuckTexture() {
    if (this.duckTex) return this.duckTex;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffd93d';
    const r = 16;
    ctx.beginPath();
    ctx.moveTo(2 + r, 2);
    ctx.arcTo(254, 2, 254, 94, r);
    ctx.arcTo(254, 94, 2, 94, r);
    ctx.arcTo(2, 94, 2, 2, r);
    ctx.arcTo(2, 2, 254, 2, r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#16224d';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.fillStyle = '#16224d';
    ctx.font = '900 46px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DUCK!', 128, 52);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this.duckTex = t;
    return t;
  }

  makeTrain(idx) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.05, 2.9, 13), this.trainMats[idx]);
    body.position.y = 1.62;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.18, 10.5), new THREE.MeshStandardMaterial({
      color: 0x9aa3b2,
      roughness: 0.6,
      metalness: 0.3,
    }));
    roof.position.y = 3.11;
    g.add(roof);
    for (const z of [-4.2, 0, 4.2]) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 1.5), this.darkMetal);
      vent.position.set(0, 3.23, z);
      g.add(vent);
    }
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.5, 12.6), this.darkMetal);
    skirt.position.y = 0.28;
    g.add(skirt);
    for (const side of [-1, 1]) {
      for (const z of [-4.4, 4.4]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.16, 12), this.darkMetal);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 0.95, 0.3, z);
        g.add(wheel);
      }
    }
    g.userData = { type: 'train', depth: 13 };
    return g;
  }

  makeCoin() {
    const g = new THREE.Group();
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.072, 8, 18, Math.PI * 1.18),
      this.bananaMat
    );
    arc.castShadow = true;
    g.add(arc);
    for (const [x, y] of [[0.2, 0], [-0.155, -0.115]]) {
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.043, 8, 6), this.bananaTipMat);
      tip.position.set(x, y, 0);
      g.add(tip);
    }
    g.userData = { baseY: 1.05, phase: Math.random() * 6.28 };
    return g;
  }

  makePower(kind) {
    const g = new THREE.Group();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex,
      color: kind === 'magnet' ? 0xff7a3d : 0x62e8ff,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(1.8, 1.8, 1);
    g.add(glow);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makePowerTexture(kind),
      transparent: true,
      depthWrite: false,
    }));
    sprite.scale.set(1.0, 1.0, 1);
    g.add(sprite);
    g.userData.kind = kind;
    return g;
  }

  obtain(kind, idx = 0) {
    if (kind === 'train') {
      const g = this.trainPools[idx].pop() || this.makeTrain(idx);
      this.scene.add(g);
      return g;
    }
    const g = this.pools[kind].pop() || (
      kind === 'barrier' ? this.makeBarrier() :
      kind === 'bar' ? this.makeBar() :
      kind === 'coin' ? this.makeCoin() :
      this.makePower(kind)
    );
    this.scene.add(g);
    return g;
  }

  release(kind, g, idx = 0) {
    this.scene.remove(g);
    if (kind === 'train') this.trainPools[idx].push(g);
    else this.pools[kind].push(g);
  }

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                           */
  /* ------------------------------------------------------------------ */
  start() {
    this.clearRun();
    this.state = 'playing';
    this.distance = 0;
    this.speed = START_SPEED;
    this.bananas = 0;
    this.score = 0;
    this.lane = 1;
    this.targetLane = 1;
    this.anchor.position.set(0, 0, 0);
    this.vy = 0;
    this.grounded = true;
    this.roll = 0;
    this.magnet = 0;
    this.shield = false;
    this.invuln = 0;
    this.shake = 0;
    this.combo = 0;
    this.coinStreak = 0;
    this.crashProgress = 0;
    this.spawnAcc = 0;
    this.spawnGap = 30;
    this.bubble.visible = false;
    this.anchor.rotation.set(0, Math.PI, 0);
    this.camPos.set(0, 3.8, 7.2);
    this.camLook.set(0, 1.35, -12);
    this.camera.fov = this.baseFov + 4;
    this.camera.updateProjectionMatrix();

    // a friendly runway: side-lane obstacles plus a centre banana trail
    this.spawnStarter();
    this.onState('playing');
    this.pushHud(true);
    this.sound.startMusic();
  }

  pause() {
    if (this.state !== 'playing') return false;
    this.state = 'paused';
    this.sound.stopMusic();
    this.onState('paused');
    return true;
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.sound.startMusic();
    this.onState('playing');
  }

  toMenu() {
    this.clearRun();
    this.state = 'menu';
    this.speed = 0;
    this.anchor.position.set(0, 0, 0);
    this.anchor.rotation.set(0, 0, 0);
    this.bubble.visible = false;
    this.player = this.minions[this.skin];
    this.onState('menu');
    this.sound.stopMusic();
  }

  clearRun() {
    for (const o of this.obstacles) {
      this.release(this.obKey(o), o, o.userData.trainIdx || 0);
    }
    for (const c of this.coins) this.release('coin', c);
    for (const p of this.powers) this.release(p.userData.kind, p);
    this.obstacles = [];
    this.coins = [];
    this.powers = [];
    for (const p of this.particles) this.scene.remove(p.sprite);
    this.particles = [];
    this.bubble.visible = false;
  }

  obKey(o) {
    return o.userData.type === 'train' ? 'train' : o.userData.type;
  }

  selectSkin(key) {
    if (!this.minions[key]) return;
    this.skin = key;
    for (const k of SKIN_ORDER) this.minions[k].group.visible = k === key;
    this.player = this.minions[key];
    if (this.state === 'menu') {
      this.player.triggerWave();
      this.anchor.position.set(0, 0, 0);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Input                                                               */
  /* ------------------------------------------------------------------ */
  moveLane(dir) {
    if (this.state !== 'playing' || this.crashProgress > 0) return;
    const next = clamp(this.lane + dir, 0, 2);
    if (next === this.lane) {
      this.shake = Math.max(this.shake, 0.06);
      return;
    }
    this.lane = next;
    this.sound.play('lane');
    this.hideHint();
  }

  jump() {
    if (this.state !== 'playing' || this.crashProgress > 0) return;
    if (!this.grounded || this.roll > ROLL_TIME * 0.45) return;
    this.vy = JUMP_V;
    this.grounded = false;
    this.roll = 0;
    this.sound.play('jump');
    this.hideHint();
  }

  rollAction() {
    if (this.state !== 'playing' || this.crashProgress > 0) return;
    if (!this.grounded) {
      // fast-fall slam
      this.vy = Math.min(this.vy, -26);
      this.roll = ROLL_TIME;
    } else {
      this.roll = ROLL_TIME;
      this.sound.play('roll');
    }
    this.hideHint();
  }

  hideHint() {
    if (this.hintTimer) {
      clearTimeout(this.hintTimer);
      this.hintTimer = null;
    }
    this.onState('hint-hide');
  }

  /* ------------------------------------------------------------------ */
  /* Spawning                                                            */
  /* ------------------------------------------------------------------ */
  spawnStarter() {
    this.spawnObstacle('barrier', 0, -62);
    this.spawnObstacle('bar', 2, -86);
    for (let i = 0; i < 9; i++) this.spawnCoin(1, -70 + i * 2.15);
    this.spawnPower('magnet', 1, -40);
  }

  spawnPattern(z) {
    const safe = randInt(3);
    const others = [0, 1, 2].filter((l) => l !== safe);
    if (Math.random() < 0.5) others.reverse();
    const difficulty = clamp((this.distance || 0) / 900, 0, 1);
    const r = Math.random();
    const made = [];

    if (r < 0.30) {
      const count = Math.random() < 0.28 + difficulty * 0.34 ? 2 : 1;
      for (let i = 0; i < count; i++) made.push(this.spawnObstacle('barrier', others[i], z));
    } else if (r < 0.52) {
      const count = Math.random() < 0.22 + difficulty * 0.34 ? 2 : 1;
      for (let i = 0; i < count; i++) made.push(this.spawnObstacle('bar', others[i], z));
    } else if (r < 0.72) {
      made.push(this.spawnObstacle('train', others[0], z));
    } else if (r < 0.88) {
      made.push(this.spawnObstacle('train', others[0], z));
      if (Math.random() < 0.6) made.push(this.spawnObstacle(Math.random() < 0.5 ? 'barrier' : 'bar', others[1], z + rand(-2, 2)));
    } else {
      made.push(this.spawnObstacle('barrier', others[0], z));
      made.push(this.spawnObstacle('bar', others[1], z + rand(-1, 1)));
    }

    // reward trail in the safe lane
    const count = 5 + randInt(3);
    const startZ = z - 5.5;
    const gap = 2.35;
    const powerChance = Math.random() < 0.14;
    for (let i = 0; i < count; i++) {
      if (powerChance && i === Math.floor(count / 2)) {
        this.spawnPower(Math.random() < 0.55 ? 'magnet' : 'shield', safe, startZ + i * gap);
      } else {
        this.spawnCoin(safe, startZ + i * gap);
      }
    }
    return made;
  }

  spawnObstacle(type, lane, z) {
    let g;
    if (type === 'train') {
      const idx = randInt(4);
      g = this.obtain('train', idx);
      g.userData = { type: 'train', depth: 13, trainIdx: idx };
    } else {
      g = this.obtain(type);
    }
    g.position.set(LANES[lane], 0, z);
    g.userData.lane = lane;
    this.obstacles.push(g);
    return g;
  }

  spawnCoin(lane, z) {
    const g = this.obtain('coin');
    const x = LANES[lane] + rand(-0.22, 0.22);
    g.position.set(x, 1.05, z);
    g.rotation.set(0, Math.random() * 6.28, rand(-0.25, 0.25));
    g.userData.baseY = 1.05;
    g.userData.phase = Math.random() * 6.28;
    this.coins.push(g);
  }

  spawnPower(kind, lane, z) {
    const g = this.obtain(kind);
    g.position.set(LANES[lane], 1.32, z);
    g.userData.kind = kind;
    this.powers.push(g);
  }

  /* ------------------------------------------------------------------ */
  /* Update                                                              */
  /* ------------------------------------------------------------------ */
  update(dt) {
    this.time += dt;
    if (this.state === 'menu') {
      this.speed = 6.5;
      this.world.update(dt, this.speed);
      this.updateParticles(dt);
      this.player.update(dt, { mode: 'idle', speed: 0 });
      this.updateCamera(dt);
      this.contactShadow.position.set(0, 0.015, 0.1);
      this.contactShadow.material.opacity = 0.5;
      return;
    }

    if (this.state === 'paused') {
      return;
    }

    if (this.state === 'over') {
      this.world.update(dt, 0);
      this.updateParticles(dt);
      this.player.update(dt, { mode: 'crash', crashProgress: 1, speed: 0, back: true });
      this.updateCamera(dt);
      return;
    }

    if (this.state === 'crashed') {
      this.crashTimer += dt;
      this.speed = Math.max(0, this.speed - dt * 34);
      this.distance += this.speed * dt;
      this.world.update(dt, this.speed);
      this.moveWorld(dt);
      this.updateParticles(dt);
      this.crashProgress = clamp(this.crashTimer / 1.05, 0, 1);
      this.player.update(dt, { mode: 'crash', crashProgress: this.crashProgress, speed: 0, back: true });
      this.anchor.position.y = Math.max(0, this.anchor.position.y + this.vy * dt);
      this.vy -= GRAVITY * dt;
      this.shake = Math.max(0, this.shake - dt * 2.2);
      this.updateBubble(dt);
      this.updateCamera(dt);
      this.pushHud();
      if (this.crashTimer > 1.1) {
        this.state = 'over';
        this.onGameOver(this.getStats());
      }
      return;
    }

    // playing
    this.distance += this.speed * dt;
    this.speed = Math.min(MAX_SPEED, START_SPEED + this.distance * 0.0115);
    this.score = Math.floor(this.distance * 1.3) + this.bananas * 12;
    this.invuln = Math.max(0, this.invuln - dt);
    this.roll = Math.max(0, this.roll - dt);
    this.magnet = Math.max(0, this.magnet - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.coinStreak = 0;
    this.shake = Math.max(0, this.shake - dt * 1.8);

    // lane movement
    const tx = LANES[this.lane];
    const dx = tx - this.anchor.position.x;
    this.anchor.position.x += dx * Math.min(1, dt * 13.5);
    const lean = clamp(dx * 0.42, -0.55, 0.55);

    // vertical
    if (!this.grounded) {
      this.anchor.position.y += this.vy * dt;
      this.vy -= GRAVITY * dt;
      if (this.anchor.position.y <= 0) {
        this.anchor.position.y = 0;
        this.vy = 0;
        this.grounded = true;
        this.sound.play('land');
        this.spawnDust(3);
      }
    }

    // world & entities
    this.world.update(dt, this.speed);
    this.moveWorld(dt);
    this.checkCollisions();
    if (this.state !== 'playing') return;
    this.updateCoins(dt);
    this.updatePowers(dt);
    this.updateParticles(dt);

    // spawn ahead
    this.spawnAcc += this.speed * dt;
    if (this.spawnAcc >= this.spawnGap) {
      this.spawnAcc = 0;
      this.spawnGap = rand(26, 34) - clamp(this.distance / 1200, 0, 1) * 6;
      this.spawnPattern(SPAWN_Z);
    }

    // character
    let mode = 'run';
    if (this.roll > 0) mode = 'roll';
    if (!this.grounded) mode = 'jump';
    if (this.roll > 0 && !this.grounded) mode = 'roll';
    this.player.update(dt, {
      mode,
      speed: this.speed,
      lean,
      rollProgress: 1 - this.roll / ROLL_TIME,
      jumpVy: this.vy,
      back: true,
    });

    // contact shadow
    const h = this.anchor.position.y;
    this.contactShadow.position.set(this.anchor.position.x, 0.015, 0.15);
    const s = clamp(1 - h * 0.16, 0.5, 1);
    this.contactShadow.scale.set(s, s, 1);
    this.contactShadow.material.opacity = 0.48 * clamp(1 - h * 0.22, 0.2, 1);

    this.updateBubble(dt);
    this.updateCamera(dt);
    this.updateDust(dt);
    this.updateScoreFx(dt);
    this.pushHud();

    if (this.anchor.position.y < -2) this.anchor.position.y = 0;
  }

  moveWorld(dt) {
    const dz = this.speed * dt;
    for (const o of this.obstacles) o.position.z += dz;
    for (const c of this.coins) c.position.z += dz;
    for (const p of this.powers) p.position.z += dz;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (o.position.z > 22) {
        this.release(this.obKey(o), o, o.userData.trainIdx || 0);
        this.obstacles.splice(i, 1);
      }
    }
    for (let i = this.coins.length - 1; i >= 0; i--) {
      if (this.coins[i].position.z > 12) {
        this.release('coin', this.coins[i]);
        this.coins.splice(i, 1);
      }
    }
    for (let i = this.powers.length - 1; i >= 0; i--) {
      const p = this.powers[i];
      if (p.position.z > 12) {
        this.release(p.userData.kind, p);
        this.powers.splice(i, 1);
      }
    }
  }

  checkCollisions() {
    const px = this.anchor.position.x;
    const py = this.anchor.position.y;
    for (const o of this.obstacles) {
      if (o.userData.lane !== this.lane) continue;
      const half = (o.userData.depth || 0.5) / 2 + 0.5;
      if (Math.abs(o.position.z) > half) continue;
      if (this.invuln > 0) continue;
      let hit = false;
      if (o.userData.type === 'barrier') hit = py < 0.9;
      else if (o.userData.type === 'bar') hit = this.roll <= 0 || py > 0.55;
      else hit = true;

      if (hit) {
        if (this.shield) {
          this.shield = false;
          this.bubble.visible = false;
          this.invuln = 1.25;
          this.shake = 0.55;
          this.sound.play('shield');
          this.burst(new THREE.Vector3(px, py + 0.9, o.position.z), 0x6ee7ff, 16, 4.2);
          this.removeObstacle(o);
          this.pushHud(true);
          continue;
        }
        this.crash(o);
        return;
      }
    }
  }

  removeObstacle(o) {
    const i = this.obstacles.indexOf(o);
    if (i >= 0) this.obstacles.splice(i, 1);
    this.release(this.obKey(o), o, o.userData.trainIdx || 0);
  }

  updateCoins(dt) {
    const px = this.anchor.position.x;
    const py = this.anchor.position.y;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.rotation.y += dt * 4.6;
      c.position.y = c.userData.baseY + Math.sin(this.time * 3.2 + c.userData.phase) * 0.07;

      if (this.magnet > 0 && c.position.z > -17 && c.position.z < 4 && Math.abs(c.position.x - px) < 6) {
        c.position.x += (px - c.position.x) * Math.min(1, dt * 5.5);
        c.position.z += (0.4 - c.position.z) * Math.min(1, dt * 1.2);
        c.position.y += (py + 0.95 - c.position.y) * Math.min(1, dt * 3);
      }

      const inLane = Math.abs(c.position.x - px) < 1.05;
      const inZ = Math.abs(c.position.z) < 1.15;
      const inY = Math.abs(c.position.y - (py + 0.95)) < 1.25;
      if (inLane && inZ && inY) {
        this.collectCoin(c);
        this.coins.splice(i, 1);
        this.release('coin', c);
      }
    }
  }

  collectCoin(c) {
    this.bananas++;
    this.coinStreak++;
    this.comboT = 1.5;
    this.combo = this.coinStreak;
    this.sound.play('coin', { combo: this.coinStreak });
    this.score = Math.floor(this.distance * 1.3) + this.bananas * 12;
    this.burst(c.position.clone(), 0xffd93d, 7, 2.4);
    if (this.coinStreak > 0 && this.coinStreak % 10 === 0) {
      this.showCombo(`BANANA x${this.coinStreak}!`);
    }
    this.pushHud(true);
  }

  showCombo(text) {
    this.onState('combo', text);
  }

  updatePowers(dt) {
    const px = this.anchor.position.x;
    const py = this.anchor.position.y;
    for (let i = this.powers.length - 1; i >= 0; i--) {
      const p = this.powers[i];
      p.position.y = 1.32 + Math.sin(this.time * 2.6 + i) * 0.12;
      p.rotation.y += dt * 1.8;
      const inLane = Math.abs(p.position.x - px) < 1.1;
      if (inLane && Math.abs(p.position.z) < 1.2 && Math.abs(p.position.y - (py + 1.0)) < 1.5) {
        const kind = p.userData.kind;
        if (kind === 'magnet') {
          this.magnet = 8;
          this.sound.play('power');
          this.showCombo('BANANA MAGNET!');
        } else {
          this.shield = true;
          this.bubble.visible = true;
          this.sound.play('power');
          this.showCombo('SHIELD UP!');
        }
        this.burst(p.position.clone(), kind === 'magnet' ? 0xff8a4a : 0x6ee7ff, 14, 3.5);
        this.release(kind, p);
        this.powers.splice(i, 1);
        this.pushHud(true);
      }
    }
  }

  updateBubble(dt) {
    this.bubble.visible = this.shield;
    if (this.shield) {
      const s = 1 + Math.sin(this.time * 4) * 0.03;
      this.bubble.scale.setScalar(s);
      this.bubble.rotation.y += dt * 0.5;
    }
  }

  crash(o) {
    this.state = 'crashed';
    this.crashTimer = 0;
    this.crashProgress = 0;
    this.vy = 3.4;
    this.shake = 1;
    this.sound.play('crash');
    this.sound.stopMusic();
    this.burst(new THREE.Vector3(this.anchor.position.x, this.anchor.position.y + 0.9, 0), 0xfff0b0, 12, 4.5);
    this.pushHud(true);
  }

  getStats() {
    return {
      score: this.score,
      bananas: this.bananas,
      distance: Math.floor(this.distance),
      skin: this.skin,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Particles                                                           */
  /* ------------------------------------------------------------------ */
  getParticle(color, opacity = 1) {
    const mat = new THREE.SpriteMaterial({
      map: this.glowTex,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    this.scene.add(sprite);
    return { sprite, mat };
  }

  burst(pos, color, count = 8, spread = 3) {
    for (let i = 0; i < count; i++) {
      const { sprite, mat } = this.getParticle(color, 1);
      const size = rand(0.12, 0.34);
      sprite.position.copy(pos);
      sprite.scale.set(size, size, 1);
      this.particles.push({
        sprite,
        mat,
        vx: rand(-spread, spread),
        vy: rand(0.5, spread),
        vz: rand(-spread * 0.5, spread * 1.4),
        life: rand(0.35, 0.7),
        max: 0.7,
        size,
      });
    }
  }

  spawnDust(n = 1) {
    for (let i = 0; i < n; i++) {
      const { sprite, mat } = this.getParticle(0xd8e8ff, 0.5);
      const size = rand(0.1, 0.24);
      sprite.position.set(this.anchor.position.x + rand(-0.3, 0.3), 0.1, rand(0.1, 0.5));
      sprite.scale.set(size, size, 1);
      this.particles.push({
        sprite,
        mat,
        vx: rand(-0.7, 0.7),
        vy: rand(0.4, 1.2),
        vz: rand(1, 3),
        life: rand(0.22, 0.42),
        max: 0.42,
        size,
      });
    }
  }

  updateDust(dt) {
    if (!this.dustAcc) this.dustAcc = 0;
    this.dustAcc += dt;
    const interval = clamp(0.16 - this.speed * 0.002, 0.07, 0.16);
    if (this.dustAcc > interval && this.grounded) {
      this.dustAcc = 0;
      this.spawnDust(1);
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.sprite);
        p.mat.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      p.vy -= 4.5 * dt;
      p.vx *= 1 - dt * 1.8;
      p.vz *= 1 - dt * 0.6;
      const k = p.life / p.max;
      p.mat.opacity = clamp(k, 0, 1);
      const s = p.size * (1.6 - k * 0.6);
      p.sprite.scale.set(s, s, 1);
    }
  }

  updateScoreFx(dt) {
    // reserved for future effects
  }

  /* ------------------------------------------------------------------ */
  /* Camera & HUD                                                        */
  /* ------------------------------------------------------------------ */
  updateCamera(dt) {
    const portrait = this.portrait;
    let px, py, pz, lx, ly, lz, k;

    if (this.state === 'menu') {
      const t = this.time;
      if (this.compactLandscape) {
        px = 1.65 + Math.sin(t * 0.35) * 0.08;
        py = 2.1 + Math.sin(t * 0.5) * 0.04;
        pz = 5.2;
        lx = 2.95;
        ly = 0.5;
        lz = -0.2;
      } else {
        px = 2.35 + Math.sin(t * 0.35) * 0.12;
        py = 2.25 + Math.sin(t * 0.5) * 0.05;
        pz = 5.45;
        lx = 0;
        ly = 0.62;
        lz = -0.2;
      }
      k = 3.2;
    } else if (this.state === 'over') {
      px = 2.7;
      py = 2.0;
      pz = 7.4;
      lx = 0;
      ly = 0.55;
      lz = 0;
      k = 2.6;
    } else if (this.state === 'crashed') {
      px = this.anchor.position.x * 0.4 + 1.2;
      py = 3.0;
      pz = 8.4;
      lx = this.anchor.position.x * 0.5;
      ly = 0.8;
      lz = 0;
      k = 3.2;
    } else {
      px = this.anchor.position.x * 0.18;
      py = 3.8 + this.anchor.position.y * 0.2;
      pz = 7.2;
      lx = this.anchor.position.x * 0.32;
      ly = 1.35 + this.anchor.position.y * 0.42;
      lz = -12;
      k = 5.4;
    }

    if (portrait) {
      py += 0.15;
      pz += 0.15;
    }

    // Very short portrait phones: pull the menu camera back so the minion
    // fits between the logo and the skin picker.
    if (this.tinyPortrait && this.state === 'menu') {
      px = 2.77;
      py = 2.72;
      pz = 6.64;
    }

    const ease = 1 - Math.exp(-dt * k);
    this.camPos.x += (px - this.camPos.x) * ease;
    this.camPos.y += (py - this.camPos.y) * ease;
    this.camPos.z += (pz - this.camPos.z) * ease;
    this.camLook.x += (lx - this.camLook.x) * ease;
    this.camLook.y += (ly - this.camLook.y) * ease;
    this.camLook.z += (lz - this.camLook.z) * ease;

    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      const s = this.shake * 0.35;
      this.camera.position.x += rand(-s, s);
      this.camera.position.y += rand(-s, s);
      this.camera.position.z += rand(-s, s) * 0.4;
    }
    this.camera.lookAt(this.camLook);

    // speed-based fov breathing
    const targetFov = this.state === 'playing'
      ? this.baseFov + clamp((this.speed - START_SPEED) / (MAX_SPEED - START_SPEED), 0, 1) * 7
      : this.baseFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 2.2);
      this.camera.updateProjectionMatrix();
    }
  }

  pushHud(force = false) {
    this.hudT += 1 / 60;
    if (!force && this.hudT < 0.08) return;
    this.hudT = 0;
    this.onHud({
      score: this.score || 0,
      bananas: this.bananas || 0,
      distance: Math.floor(this.distance || 0),
      speed: this.speed,
      magnet: this.magnet || 0,
      shield: this.shield,
      state: this.state,
    });
  }

  /* ------------------------------------------------------------------ */
  /* Loop                                                                */
  /* ------------------------------------------------------------------ */
  loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.045, this.clock.getDelta());
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };
}
