import * as THREE from '../vendor/three.module.js';

/* ─────────────────────────────────────────────────────────────────────
   Sky, weather, stars, distant islets and the day/night palette.
   ───────────────────────────────────────────────────────────────────── */

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function radialTexture(size, stops, soft = true) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  if (soft) {
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function starTexture() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.28, 'rgba(255,252,238,0.95)');
  g.addColorStop(0.55, 'rgba(216,236,255,0.28)');
  g.addColorStop(1, 'rgba(200,230,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function moonTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  // halo
  const halo = ctx.createRadialGradient(64, 64, 18, 64, 64, 64);
  halo.addColorStop(0, 'rgba(220,238,255,0.34)');
  halo.addColorStop(0.5, 'rgba(190,220,255,0.12)');
  halo.addColorStop(1, 'rgba(160,200,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);
  // disc
  ctx.beginPath();
  ctx.arc(64, 64, 27, 0, Math.PI * 2);
  ctx.fillStyle = '#eef4f8';
  ctx.fill();
  const craters = [
    [52, 54, 6, '#d3dfe8'], [74, 58, 4.5, '#d8e2ea'], [63, 77, 5, '#d5e0e9'],
    [82, 74, 3, '#d1dde7'], [45, 70, 3.5, '#d6e1ea'], [68, 45, 2.5, '#dbe5ed'],
  ];
  for (const [x, y, r, col] of craters) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(58, 49, 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function sunTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const halo = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
  halo.addColorStop(0, 'rgba(255,244,214,0.8)');
  halo.addColorStop(0.34, 'rgba(255,220,150,0.34)');
  halo.addColorStop(0.68, 'rgba(255,190,110,0.1)');
  halo.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);
  const disc = ctx.createRadialGradient(58, 56, 2, 64, 64, 31);
  disc.addColorStop(0, 'rgba(255,255,250,1)');
  disc.addColorStop(0.55, 'rgba(255,246,207,1)');
  disc.addColorStop(1, 'rgba(255,215,145,0.94)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(64, 64, 30, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

/* ── palettes ────────────────────────────────────────────────────────── */
function P(hex, i = 1) {
  return new THREE.Color(hex).multiplyScalar(i);
}

const STOPS = [
  {
    t: 0.0,
    top: P('#040a18'), mid: P('#0a1630'), bottom: P('#12203a'),
    sun: P('#8fa6e8'), hemiSky: P('#38567f'), hemiGround: P('#121b2c'),
    fog: P('#0a1526'), cloud: P('#39496a'),
    sunI: 0.46, hemiI: 0.86, exposure: 1.22, glow: 0, star: 1, firefly: 1,
  },
  {
    t: 0.18,
    top: P('#050b1b'), mid: P('#0d1832'), bottom: P('#172740'),
    sun: P('#8fa6e8'), hemiSky: P('#3a5a86'), hemiGround: P('#141e30'),
    fog: P('#0c192b'), cloud: P('#3c4d6e'),
    sunI: 0.46, hemiI: 0.88, exposure: 1.2, glow: 0, star: 0.95, firefly: 1,
  },
  {
    t: 0.23,
    top: P('#1e2f58'), mid: P('#665d8e'), bottom: P('#eba17c'),
    sun: P('#ffb07a'), hemiSky: P('#7d7ca8'), hemiGround: P('#3d3648'),
    fog: P('#7c6677'), cloud: P('#efbda4'),
    sunI: 0.5, hemiI: 0.8, exposure: 1.1, glow: 0.85, star: 0.52, firefly: 0.65,
  },
  {
    t: 0.29,
    top: P('#315c9e'), mid: P('#82afd7'), bottom: P('#ffd0a8'),
    sun: P('#ffcf9b'), hemiSky: P('#b4c8e2'), hemiGround: P('#6b6552'),
    fog: P('#c9b9b8'), cloud: P('#ffe2c8'),
    sunI: 1.3, hemiI: 1.05, exposure: 1.05, glow: 0.9, star: 0.12, firefly: 0.2,
  },
  {
    t: 0.36,
    top: P('#2e76c9'), mid: P('#67b5e7'), bottom: P('#bde9f5'),
    sun: P('#fff1d6'), hemiSky: P('#cfe8ff'), hemiGround: P('#78866a'),
    fog: P('#addced'), cloud: P('#fffdf8'),
    sunI: 2.35, hemiI: 1.25, exposure: 1.0, glow: 0.38, star: 0, firefly: 0,
  },
  {
    t: 0.5,
    top: P('#1d6fcd'), mid: P('#54b0e9'), bottom: P('#bde6f6'),
    sun: P('#fffaf0'), hemiSky: P('#d9f0ff'), hemiGround: P('#849172'),
    fog: P('#a9d8ea'), cloud: P('#ffffff'),
    sunI: 2.75, hemiI: 1.35, exposure: 1.0, glow: 0.2, star: 0, firefly: 0,
  },
  {
    t: 0.64,
    top: P('#2b6fc3'), mid: P('#62b0e1'), bottom: P('#c3e7f3'),
    sun: P('#fff0d2'), hemiSky: P('#d5e8fb'), hemiGround: P('#827c65'),
    fog: P('#b1d9e9'), cloud: P('#fffaf3'),
    sunI: 2.3, hemiI: 1.25, exposure: 1.0, glow: 0.35, star: 0, firefly: 0,
  },
  {
    t: 0.72,
    top: P('#4c79b8'), mid: P('#a8a7c0'), bottom: P('#ffc18b'),
    sun: P('#ffd09b'), hemiSky: P('#d8c6c1'), hemiGround: P('#7c6b58'),
    fog: P('#d9b49e'), cloud: P('#ffe7ca'),
    sunI: 1.75, hemiI: 1.05, exposure: 1.04, glow: 0.85, star: 0, firefly: 0.15,
  },
  {
    t: 0.78,
    top: P('#2b2a60'), mid: P('#76507f'), bottom: P('#ff8c68'),
    sun: P('#ff9c6a'), hemiSky: P('#9c7a9b'), hemiGround: P('#443543'),
    fog: P('#a4635f'), cloud: P('#ffc0a8'),
    sunI: 0.72, hemiI: 0.8, exposure: 1.1, glow: 1, star: 0.3, firefly: 0.4,
  },
  {
    t: 0.84,
    top: P('#0b1730'), mid: P('#142242'), bottom: P('#1c2e4b'),
    sun: P('#8fa6e8'), hemiSky: P('#3d5f8d'), hemiGround: P('#162033'),
    fog: P('#0e1b2f'), cloud: P('#3d4c6b'),
    sunI: 0.48, hemiI: 0.9, exposure: 1.22, glow: 0.08, star: 0.85, firefly: 0.9,
  },
  {
    t: 1.0,
    top: P('#040a18'), mid: P('#0a1630'), bottom: P('#12203a'),
    sun: P('#8fa6e8'), hemiSky: P('#38567f'), hemiGround: P('#121b2c'),
    fog: P('#0a1526'), cloud: P('#39496a'),
    sunI: 0.46, hemiI: 0.86, exposure: 1.22, glow: 0, star: 1, firefly: 1,
  },
];

const COLOR_KEYS = ['top', 'mid', 'bottom', 'sun', 'hemiSky', 'hemiGround', 'fog', 'cloud'];
const NUM_KEYS = ['sunI', 'hemiI', 'exposure', 'glow', 'star', 'firefly'];

class DayCycle {
  constructor() {
    this.sunDir = new THREE.Vector3(0.4, 0.5, 0.28).normalize();
    this.moonDir = new THREE.Vector3();
    this.out = {};
    for (const key of COLOR_KEYS) this.out[key] = new THREE.Color();
    for (const key of NUM_KEYS) this.out[key] = 0;
    this.out.sunDir = this.sunDir;
    this.out.moonDir = this.moonDir;
    this.out.day = 0;
    this.out.night = 0;
  }

  sample(t) {
    t = ((t % 1) + 1) % 1;
    let a = STOPS[0];
    let b = STOPS[STOPS.length - 1];
    for (let i = 0; i < STOPS.length - 1; i++) {
      if (t >= STOPS[i].t && t <= STOPS[i + 1].t) {
        a = STOPS[i];
        b = STOPS[i + 1];
        break;
      }
    }
    let f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    f = f * f * (3 - 2 * f);
    for (const key of COLOR_KEYS) this.out[key].lerpColors(a[key], b[key], f);
    for (const key of NUM_KEYS) this.out[key] = a[key] + (b[key] - a[key]) * f;

    const angle = (t - 0.25) * Math.PI * 2;
    this.sunDir.set(Math.cos(angle), Math.sin(angle), 0.26).normalize();
    this.moonDir.copy(this.sunDir).multiplyScalar(-1);
    const sy = this.sunDir.y;
    this.out.day = smoothstep(-0.16, 0.22, sy);
    this.out.night = 1 - smoothstep(-0.2, 0.12, sy);
    return this.out;
  }
}

/* ── distant islets ──────────────────────────────────────────────────── */
function buildIslets(scene, rand) {
  const blocks = [];
  const colors = [];
  const grass = new THREE.Color('#6caf58');
  const dirt = new THREE.Color('#7b5b3f');
  const stone = new THREE.Color('#707981');
  const leaf = new THREE.Color('#427c40');

  const count = 6;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rand() * 0.6;
    const radius = 78 + rand() * 74;
    const cx = 32 + Math.cos(angle) * radius;
    const cz = 32 + Math.sin(angle) * radius;
    const cy = 8 + rand() * 20;
    const r = 4 + rand() * 4.5;
    const topBase = 2 + Math.floor(rand() * 4);

    for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
      for (let z = -Math.ceil(r); z <= Math.ceil(r); z++) {
        const d = Math.hypot(x, z) / r + (rand() - 0.5) * 0.16;
        if (d > 1) continue;
        const edge = 1 - d;
        const top = topBase + Math.floor(edge * 3 + rand() * 2);
        const bottom = -Math.floor(2 + edge * 7 + rand() * 3);
        for (let y = bottom; y <= top; y++) {
          const col = y === top ? grass : y > top - 2 ? dirt : stone;
          blocks.push([cx + x, cy + y, cz + z]);
          colors.push(col);
        }
      }
    }
    // a tiny tree
    if (rand() < 0.8) {
      const tx = Math.round(cx);
      const tz = Math.round(cz);
      const ty = cy + topBase + 3;
      for (let i2 = 0; i2 < 3; i2++) {
        blocks.push([tx, ty + i2, tz]);
        colors.push(dirt);
      }
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.hypot(dx, dz) > 2.2) continue;
          blocks.push([tx + dx, ty + 2 + ((rand() * 2) | 0), tz + dz]);
          colors.push(leaf);
        }
      }
    }
  }

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, blocks.length);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (let i = 0; i < blocks.length; i++) {
    dummy.position.set(blocks[i][0], blocks[i][1], blocks[i][2]);
    const scale = 0.98 + rand() * 0.04;
    dummy.scale.set(scale, 0.98, scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    const v = 0.92 + rand() * 0.16;
    col.copy(colors[i]).multiplyScalar(v);
    mesh.setColorAt(i, col);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

/* ── clouds ──────────────────────────────────────────────────────────── */
function buildClouds(scene, rand) {
  const puffs = [];
  const addCluster = (cx, cy, cz, spread, count, size) => {
    for (let i = 0; i < count; i++) {
      const sx = size * (2.2 + rand() * 4.5);
      const sy = size * (0.55 + rand() * 0.7);
      const sz = size * (1.6 + rand() * 3.4);
      puffs.push({
        x: cx + (rand() - 0.5) * spread,
        y: cy + (rand() - 0.5) * spread * 0.12,
        z: cz + (rand() - 0.5) * spread,
        sx, sy, sz,
        phase: rand() * Math.PI * 2,
      });
    }
  };

  // The sea of clouds far below the island.
  for (let i = 0; i < 24; i++) {
    const a = rand() * Math.PI * 2;
    const rr = 20 + rand() * 185;
    addCluster(32 + Math.cos(a) * rr, -14 - rand() * 10, 32 + Math.sin(a) * rr, 18, 2 + ((rand() * 4) | 0), 2.8 + rand() * 2.6);
  }
  // A soft ring of cloud just under the island's rim, to give it scale.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rand() * 0.35;
    const rr = 38 + rand() * 42;
    addCluster(32 + Math.cos(a) * rr, -2 + rand() * 8, 32 + Math.sin(a) * rr, 14, 2 + ((rand() * 3) | 0), 3.0 + rand() * 2.8);
  }
  // Drifting clouds at island height.
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const rr = 52 + rand() * 120;
    addCluster(32 + Math.cos(a) * rr, 10 + rand() * 22, 32 + Math.sin(a) * rr, 22, 3 + ((rand() * 4) | 0), 2.2 + rand() * 2.2);
  }

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0x8a9aa5,
    emissiveIntensity: 0.18,
    transparent: true,
    opacity: 0.94,
    fog: true,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, puffs.length);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, puffs, mat, dummy: new THREE.Object3D() };
}

/* ── sky ─────────────────────────────────────────────────────────────── */
export class Sky {
  constructor(scene, { sunLight, hemi, renderer } = {}) {
    this.scene = scene;
    this.sunLight = sunLight;
    this.hemi = hemi;
    this.renderer = renderer;
    this.cycle = new DayCycle();
    this.palette = this.cycle.sample(0.34);
    this.rand = mulberry(918273);
    this.elapsed = 0;

    const skyGeo = new THREE.SphereGeometry(520, 32, 20);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color('#3f8cd7') },
        uMid: { value: new THREE.Color('#7cc1ea') },
        uBottom: { value: new THREE.Color('#cdebf4') },
        uSunColor: { value: new THREE.Color('#fff4d6') },
        uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.28) },
        uGlow: { value: 0.3 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uBottom;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uGlow;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uBottom, uMid, smoothstep(-0.04, 0.2, h));
          col = mix(col, uTop, smoothstep(0.1, 0.72, h));
          float sd = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSunColor * (pow(sd, 7.0) * 0.11 + pow(sd, 64.0) * 0.16) * uGlow;
          float haze = smoothstep(0.18, -0.12, h);
          col = mix(col, uBottom * 1.02, haze * 0.2);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    scene.add(this.sky);

    // stars
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(1300 * 3);
    const starColors = new Float32Array(1300 * 3);
    for (let i = 0; i < 1300; i++) {
      const u = Math.random();
      const v = Math.random() * 0.92 + 0.04;
      const theta = u * Math.PI * 2;
      const y = Math.pow(v, 0.7);
      const r = Math.sqrt(1 - y * y);
      starPositions[i * 3] = Math.cos(theta) * r * 430;
      starPositions[i * 3 + 1] = y * 430;
      starPositions[i * 3 + 2] = Math.sin(theta) * r * 430;
      const warm = Math.random();
      starColors[i * 3] = 0.75 + warm * 0.25;
      starColors[i * 3 + 1] = 0.82 + Math.random() * 0.16;
      starColors[i * 3 + 2] = 1.0;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    this.starMat = new THREE.PointsMaterial({
      size: 2.1,
      map: starTexture(),
      transparent: true,
      opacity: 0,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false,
      toneMapped: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -900;
    scene.add(this.stars);

    // sun and moon
    this.sunMat = new THREE.SpriteMaterial({
      map: sunTexture(),
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
    this.sun = new THREE.Sprite(this.sunMat);
    this.sun.scale.setScalar(64);
    this.sun.renderOrder = -800;
    scene.add(this.sun);

    this.moonMat = new THREE.SpriteMaterial({
      map: moonTexture(),
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: true,
      fog: false,
      toneMapped: false,
    });
    this.moon = new THREE.Sprite(this.moonMat);
    this.moon.scale.setScalar(42);
    this.moon.renderOrder = -800;
    scene.add(this.moon);

    this.islets = buildIslets(scene, this.rand);
    this.clouds = buildClouds(scene, this.rand);
    this.buildFireflies(scene);

    // apply initial palette
    this.applyPalette(this.palette, new THREE.Vector3(32, 30, 70));
  }

  buildFireflies(scene) {
    const N = 64;
    const pos = new Float32Array(N * 3);
    const base = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 21;
      const bx = 32 + Math.cos(a) * r;
      const bz = 32 + Math.sin(a) * r;
      const by = 24 + Math.random() * 8;
      base.push({ x: bx, y: by, z: bz, phase: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 0.9 });
      pos[i * 3] = bx; pos[i * 3 + 1] = by; pos[i * 3 + 2] = bz;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.fireflyBase = base;
    this.fireflyMat = new THREE.PointsMaterial({
      size: 0.46,
      map: radialTexture(64, [
        [0, 'rgba(255,255,210,1)'],
        [0.18, 'rgba(255,240,150,.95)'],
        [0.5, 'rgba(210,255,150,.28)'],
        [1, 'rgba(170,255,120,0)'],
      ]),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
    });
    this.fireflies = new THREE.Points(geo, this.fireflyMat);
    this.fireflies.frustumCulled = false;
    this.fireflies.renderOrder = 4;
    scene.add(this.fireflies);
  }

  update(timeOfDay, camera, dt = 0.016) {
    this.elapsed += dt;
    const p = this.cycle.sample(timeOfDay);
    this.palette = p;
    this.applyPalette(p, camera.position);

    const t = this.elapsed;
    // sky follows the viewer so the horizon never ends
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    this.stars.rotation.y = t * 0.004;

    const sunPos = this.cycle.sunDir.clone().multiplyScalar(400).add(camera.position);
    const moonPos = this.cycle.moonDir.clone().multiplyScalar(400).add(camera.position);
    this.sun.position.copy(sunPos);
    this.moon.position.copy(moonPos);

    const sunUp = smoothstep(-0.14, 0.03, this.cycle.sunDir.y);
    const moonUp = smoothstep(-0.1, 0.04, -this.cycle.sunDir.y);
    this.sunMat.opacity = sunUp;
    this.moonMat.opacity = moonUp * 0.94;
    this.sunMat.color.copy(p.sun);
    this.moonMat.color.setRGB(0.82, 0.9, 1.0);

    const sf = p.star;
    this.starMat.opacity = sf * 0.9;
    this.stars.visible = sf > 0.01;

    // fireflies drift on the night air
    const fire = p.firefly;
    this.fireflyMat.opacity = fire;
    this.fireflies.visible = fire > 0.01;
    if (fire > 0.01) {
      const arr = this.fireflies.geometry.attributes.position.array;
      for (let i = 0; i < this.fireflyBase.length; i++) {
        const b = this.fireflyBase[i];
        arr[i * 3] = b.x + Math.sin(t * b.speed * 0.6 + b.phase) * 1.8;
        arr[i * 3 + 1] = b.y + Math.sin(t * b.speed + b.phase * 1.7) * 0.9;
        arr[i * 3 + 2] = b.z + Math.cos(t * b.speed * 0.5 + b.phase) * 1.8;
      }
      this.fireflies.geometry.attributes.position.needsUpdate = true;
    }

    // clouds drift and gently breathe
    const cloud = this.clouds;
    const drift = t * 1.1;
    for (let i = 0; i < cloud.puffs.length; i++) {
      const c = cloud.puffs[i];
      const x = 32 + ((((c.x - 32 + drift + 240) % 480) + 480) % 480) - 240;
      const y = c.y + Math.sin(t * 0.12 + c.phase) * 0.7;
      cloud.dummy.position.set(x, y, c.z);
      cloud.dummy.scale.set(c.sx, c.sy, c.sz);
      cloud.dummy.updateMatrix();
      cloud.mesh.setMatrixAt(i, cloud.dummy.matrix);
    }
    cloud.mesh.instanceMatrix.needsUpdate = true;
    cloud.mat.color.copy(p.cloud);
    cloud.mat.emissive.copy(p.cloud).multiplyScalar(0.08);

    // light rig
    if (this.sunLight) {
      const useMoon = this.cycle.sunDir.y < -0.05;
      const dir = useMoon ? this.cycle.moonDir : this.cycle.sunDir;
      this.sunLight.position.set(32 + dir.x * 90, 24 + Math.max(0.05, dir.y) * 90, 32 + dir.z * 90);
      this.sunLight.color.copy(p.sun);
      this.sunLight.intensity = p.sunI;
    }
    if (this.hemi) {
      this.hemi.color.copy(p.hemiSky);
      this.hemi.groundColor.copy(p.hemiGround);
      this.hemi.intensity = p.hemiI;
    }
    if (this.renderer) this.renderer.toneMappingExposure = p.exposure;
    if (this.scene.fog) this.scene.fog.color.copy(p.fog);
    return p;
  }

  applyPalette(p, cameraPos) {
    const u = this.skyMat.uniforms;
    u.uTop.value.copy(p.top);
    u.uMid.value.copy(p.mid);
    u.uBottom.value.copy(p.bottom);
    u.uSunColor.value.copy(p.sun);
    u.uSunDir.value.copy(this.cycle.sunDir);
    u.uGlow.value = p.glow;
    this.clouds.mat.color.copy(p.cloud);
    this.clouds.mat.emissive.copy(p.cloud).multiplyScalar(0.08);
  }
}

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
