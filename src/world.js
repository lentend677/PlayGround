import * as THREE from '../vendor/three.module.min.js';
import { blockGeometry, blockMaterial, crossGeometry } from './atlas.js';

const R = 27;
const WATER_Y = 5.82;
const POND = { x: 13, z: -3, r: 4.4 };

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, z, seed = 0) {
  const s = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

function smooth(t) { return t * t * (3 - 2 * t); }

function noise2(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const u = smooth(fx), v = smooth(fz);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x, z, seed = 0) {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    value += noise2(x * freq, z * freq, seed + i * 9.7) * amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return value;
}

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function radialTexture(inner, outer, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.28, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function moonTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#eef4e8';
  ctx.fillRect(0, 0, 128, 128);
  const rand = mulberry32(991);
  const tones = ['#c9d4ca', '#d8e1d5', '#bac7bd', '#e4eadf'];
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rand() * 128), y = Math.floor(rand() * 128);
    const r = 3 + Math.floor(rand() * 12);
    ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(150,165,158,.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(20 + rand() * 88, 20 + rand() * 88, 2 + rand() * 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

function flameTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 38, 1, 32, 34, 30);
  g.addColorStop(0, 'rgba(255,255,220,1)');
  g.addColorStop(0.25, 'rgba(255,215,105,.95)');
  g.addColorStop(0.55, 'rgba(255,135,40,.55)');
  g.addColorStop(1, 'rgba(255,80,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const glowTex = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,.25)');
const haloTex = radialTexture('rgba(255,242,190,.95)', 'rgba(255,190,90,.18)');
const coolHaloTex = radialTexture('rgba(190,255,245,.95)', 'rgba(80,220,215,.18)');
const fireTex = flameTexture();

function glow(color, size, opacity = 1, texture = glowTex) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }));
  sprite.scale.setScalar(size);
  return sprite;
}

export class World {
  constructor(scene, renderer, atlas) {
    this.scene = scene;
    this.renderer = renderer;
    this.atlas = atlas;
    this.group = new THREE.Group();
    this.group.name = 'Island';
    scene.add(this.group);

    this.material = blockMaterial(atlas);
    this.blocks = new Map();
    this.columns = new Map();
    this.topMap = new Map();
    this.obstacles = [];
    this.shards = [];
    this.bursts = [];
    this.clouds = [];
    this.rand = mulberry32(424242);
    this.time = 0;

    this.buildTerrain();
    this.buildProps();
    this.buildCampfire();
    this.buildSceneryLights();
    this.buildWater();
    this.buildWaterfall();
    this.buildFoliage();
    this.buildShards();
    this.buildClouds();
    this.buildFireflies();
    this.buildBirds();
    this.buildStars();
    this.buildCelestial();
    this.buildSky();

    this.instantiateBlocks();
    this.setupLights();
  }

  key(x, y, z) { return `${x},${y},${z}`; }

  addBlock(x, y, z, type, tint = 1) {
    const k = this.key(x, y, z);
    if (this.blocks.has(k)) return false;
    this.blocks.set(k, { x, y, z, type, tint });
    return true;
  }

  setBlock(x, y, z, type, tint = 1) {
    this.blocks.set(this.key(x, y, z), { x, y, z, type, tint });
  }

  buildTerrain() {
    const tops = new Map();
    let streamEnd = 0;
    for (let x = -R; x < R; x++) {
      for (let z = -R; z < R; z++) {
        const cx = x + 0.5, cz = z + 0.5;
        const d = Math.hypot(cx, cz);
        const ang = Math.atan2(cz, cx);
        const coast = 20.6 + noise2(Math.cos(ang) * 2.1 + 11, Math.sin(ang) * 2.1 - 3) * 5.2 + Math.sin(ang * 3.2 + 0.7) * 1.35 + Math.sin(ang * 6.3 - 1.1) * 0.7;
        const inside = coast - d;
        if (inside < 0.2) continue;

        const t = Math.min(1, inside / coast);
        let top = 2.9 + Math.pow(t, 0.6) * 4.7;
        top += (fbm(x * 0.16, z * 0.16, 3) - 0.46) * 3.1 * Math.pow(t, 0.45);

        const hill = Math.max(0, 1 - Math.hypot(cx + 7, cz + 8) / 14);
        top += Math.pow(hill, 1.55) * 6.2;
        const mound = Math.max(0, 1 - Math.hypot(cx - 10, cz + 15) / 8);
        top += Math.pow(mound, 2) * 2.0;

        const pd = Math.hypot(cx - POND.x, cz - POND.z);
        if (pd < POND.r + 0.7) {
          const k = Math.max(0, 1 - pd / (POND.r + 0.7));
          top -= k * k * 4.9;
        }

        // carve a short outflow from the pond to the eastern edge
        const stream = cx > POND.x + POND.r - 1.15 && cx < coast + 0.6 && Math.abs(cz - POND.z) < 1.25;
        if (stream) {
          top = Math.min(top, 4);
          streamEnd = Math.max(streamEnd, cx);
        }

        // a soft clearing around the spawn point
        const clear = Math.max(0, 1 - Math.hypot(cx - 0.5, cz - 8.2) / 6.8);
        top = top * (1 - clear) + 6.05 * clear;

        top = Math.floor(top);
        if (top < 2) continue;
        const thickness = 2.8 + Math.pow(t, 0.62) * 23.5 + (fbm(x * 0.3, z * 0.3, 7) - 0.48) * 3.4;
        const bottom = Math.floor(top - thickness);
        tops.set(`${x},${z}`, { x, z, cx, cz, d, coast, inside, top, bottom, t, pd, stream });
      }
    }
    this.streamEnd = streamEnd || POND.x + POND.r + 1;

    // Classify surfaces once heights are known.
    const get = (x, z) => tops.get(`${x},${z}`);
    for (const c of tops.values()) {
      const neighbors = [get(c.x + 1, c.z), get(c.x - 1, c.z), get(c.x, c.z + 1), get(c.x, c.z - 1)];
      let drop = 0;
      for (const n of neighbors) if (n) drop = Math.max(drop, c.top - n.top);

      let type = 'grass';
      if (c.stream) type = 'gravel';
      else if (c.pd < POND.r + 0.2) type = c.top < WATER_Y ? 'gravel' : 'sand';
      else if (c.inside < 1.3 + noise2(c.cx * 0.7, c.cz * 0.7) * 0.8) type = 'sand';
      else if (drop >= 2 || (c.t < 0.3 && noise2(c.cx * 0.4, c.cz * 0.4, 4) > 0.58)) {
        type = noise2(c.cx * 0.3, c.cz * 0.3, 9) > 0.42 ? 'stone' : 'moss';
      } else if (c.t > 0.65 && noise2(c.cx * 0.3, c.cz * 0.3, 2) > 0.78) {
        type = 'moss';
      }

      // A warm walking trail from the south shore to the pond.
      const trail = Math.min(
        distToSegment(c.cx, c.cz, 0.5, 9, 2.0, 5.0),
        distToSegment(c.cx, c.cz, 2.0, 5.0, 9.2, 0.4)
      );
      if (type === 'grass' && trail < 1.15) type = 'path';

      c.type = type;
      this.columns.set(`${c.x},${c.z}`, c);
      this.topMap.set(`${c.x},${c.z}`, c.top);
    }

    const sideType = (c, y) => {
      const depth = c.top - 1 - y;
      if (depth < 1) return ['sand', 'gravel'].includes(c.type) ? c.type : c.type === 'path' ? 'dirt' : 'grass';
      if (depth < 3) return c.type === 'sand' ? 'sand' : c.type === 'gravel' ? 'gravel' : 'dirt';
      if (c.pd < POND.r + 1 || c.stream) return depth < 5 ? 'gravel' : 'stone';
      const n = noise2(c.cx * 0.42, y * 0.42 + c.cz * 0.3, 12);
      if (n > 0.86) return 'moss';
      if (n < 0.28) return 'dark';
      return 'stone';
    };

    for (const c of tops.values()) {
      const { x, z, top, bottom, type } = c;
      this.addBlock(x, top - 1, z, type);
      this.addBlock(x, bottom, z, bottom < -2 ? 'dark' : 'stone');
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dz] of dirs) {
        const nb = tops.get(`${x + dx},${z + dz}`);
        const nt = nb ? nb.top : bottom;
        for (let y = nt; y <= top - 2; y++) {
          this.addBlock(x, y, z, sideType(c, y));
        }
        const nbBottom = nb ? nb.bottom : bottom;
        if (nbBottom > bottom) {
          for (let y = bottom; y < Math.min(nbBottom, top); y++) {
            this.addBlock(x, y, z, y < bottom + 2 ? 'stone' : 'dark');
          }
        }
      }
      // Hanging roots and stone spikes give the underside its silhouette.
      if (hash2(x, z, 44) > 0.955) {
        const hang = 1 + Math.floor(hash2(x, z, 45) * 3);
        for (let i = 1; i <= hang; i++) {
          this.addBlock(x, bottom - i, z, i === hang ? 'leaves' : 'dirt');
        }
      }
    }

    // a handful of larger rock fingers beneath the island
    const fingers = [[-17, 3, 5], [16, -7, 7], [-5, -17, 6], [13, 10, 4], [1, 18, 5], [-13, -14, 8]];
    for (const [fx, fz, len] of fingers) {
      const c = get(fx, fz);
      if (!c) continue;
      for (let dy = 1; dy <= len; dy++) {
        const taper = Math.max(0, Math.ceil((1 - dy / (len + 1)) * 1.8));
        for (let ox = -taper; ox <= taper; ox++) {
          for (let oz = -taper; oz <= taper; oz++) {
            if (Math.abs(ox) + Math.abs(oz) > taper + 1) continue;
            this.addBlock(c.x + ox, c.bottom - dy, c.z + oz, dy > len - 2 ? 'dark' : (dy % 3 === 0 ? 'moss' : 'stone'));
          }
        }
      }
    }

    this.buildMiniIslands();
  }

  buildMiniIslands() {
    const islets = [
      { x: -66, y: 12, z: -18, r: 5.0, seed: 2 },
      { x: 58, y: 2, z: 40, r: 4.2, seed: 8 },
      { x: -38, y: 30, z: 62, r: 3.2, seed: 15 },
      { x: 78, y: 26, z: -58, r: 5.6, seed: 21 },
      { x: 24, y: -16, z: -72, r: 3.6, seed: 33 },
    ];
    for (const isle of islets) {
      const rand = mulberry32(100 + isle.seed);
      for (let lx = -Math.ceil(isle.r); lx <= Math.ceil(isle.r); lx++) {
        for (let lz = -Math.ceil(isle.r); lz <= Math.ceil(isle.r); lz++) {
          const d = Math.hypot(lx, lz);
          if (d > isle.r + rand() * 1.1) continue;
          const t = 1 - d / isle.r;
          const top = isle.y + Math.floor(t * 3 + fbm(lx * 0.5, lz * 0.5, isle.seed) * 1.8);
          const bottom = top - 2 - Math.floor(t * 4 + rand() * 2);
          for (let y = bottom; y < top; y++) {
            const type = y === top - 1 ? (rand() > 0.35 ? 'grass' : 'moss') : y > top - 3 ? 'dirt' : 'stone';
            this.addBlock(isle.x + lx, y, isle.z + lz, type);
          }
        }
      }
      // a small lantern tree on two of the islets
      if (isle.seed % 2 === 0) {
        const h = 3 + Math.floor(rand() * 2);
        for (let y = 0; y < h; y++) this.addBlock(isle.x, isle.y + 3 + y, isle.z, 'log');
        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            for (let dy = 0; dy < 3; dy++) {
              if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
              if (dx === 0 && dz === 0 && dy < 2) continue;
              this.addBlock(isle.x + dx, isle.y + 4 + h + dy, isle.z + dz, 'leaves');
            }
          }
        }
      }
    }
  }

  surfaceAt(x, z) {
    return this.topMap.get(`${Math.floor(x)},${Math.floor(z)}`) ?? null;
  }

  columnAt(x, z) {
    return this.columns.get(`${Math.floor(x)},${Math.floor(z)}`) ?? null;
  }

  addTree(x, z, height = 5, seed = 1) {
    const col = this.columnAt(x, z);
    if (!col) return;
    const rand = mulberry32(seed * 997);
    const top = col.top;
    for (let y = 0; y < height; y++) this.addBlock(x, top + y, z, 'log');
    const crown = top + height - 1;
    for (let dy = -2; dy <= 2; dy++) {
      const radius = dy <= 0 ? 2 : 1;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && rand() > 0.24) continue;
          if (dx === 0 && dz === 0 && dy <= 1) continue;
          if (Math.abs(dx) === 1 && Math.abs(dz) === 1 && rand() > 0.66) continue;
          this.addBlock(x + dx, crown + dy, z + dz, 'leaves', 0.88 + rand() * 0.24);
        }
      }
    }
    // a couple of leaf clusters make the canopy less symmetrical
    for (let i = 0; i < 4; i++) {
      const dx = Math.round((rand() - 0.5) * 6);
      const dz = Math.round((rand() - 0.5) * 6);
      const dy = Math.round(rand() * 2);
      this.addBlock(x + dx, crown + dy, z + dz, 'leaves', 0.85 + rand() * 0.25);
    }
    this.obstacles.push({ x: x + 0.5, z: z + 0.5, r: 0.58, top: top + height });
  }

  buildProps() {
    const treeSpots = [
      [-10, 2, 5, 4], [14, 13, 6, 9], [-12, -10, 6, 14], [17, -12, 6, 21],
      [-15, 10, 5, 26], [-6, 16, 6, 34], [-2, -15, 7, 41], [22, 12, 5, 48],
    ];
    for (const [x, z, h, s] of treeSpots) this.addTree(x, z, h, s);

    // rocks and boulders
    const rockSpots = [[-4, -14, 3, 3], [-16, 2, 3, 12], [16, 15, 2, 17], [19, 6, 2, 20], [-10, -4, 2, 27]];
    for (const [x, z, r, seed] of rockSpots) {
      const col = this.columnAt(x, z);
      if (!col) continue;
      const rand = mulberry32(seed * 71);
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.hypot(dx, dz) > r + 0.2) continue;
          const h = Math.max(1, Math.round((1 - Math.hypot(dx, dz) / (r + 0.4)) * 3));
          for (let y = 0; y < h; y++) {
            this.addBlock(x + dx, col.top + y, z + dz, rand() > 0.4 ? 'stone' : 'moss');
          }
        }
      }
      this.obstacles.push({ x: x + 0.5, z: z + 0.5, r: r * 0.8, top: col.top + 3 });
    }
  }

  buildFoliage() {
    const rand = mulberry32(7001);
    const clusters = [
      { tile: 'flower_red', count: 24, material: new THREE.MeshLambertMaterial({ map: this.atlas, alphaTest: 0.35, side: THREE.DoubleSide }) },
      { tile: 'flower_gold', count: 18, material: new THREE.MeshLambertMaterial({ map: this.atlas, alphaTest: 0.35, side: THREE.DoubleSide }) },
      { tile: 'tuft', count: 85, material: new THREE.MeshLambertMaterial({ map: this.atlas, alphaTest: 0.35, side: THREE.DoubleSide }) },
    ];
    for (const cluster of clusters) {
      const geo = crossGeometry(cluster.tile, 0.76, 0.82);
      const mesh = new THREE.InstancedMesh(geo, cluster.material, cluster.count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `foliage-${cluster.tile}`;
      const dummy = new THREE.Object3D();
      let placed = 0;
      let guard = 0;
      while (placed < cluster.count && guard++ < 800) {
        const x = Math.floor((rand() - 0.5) * 38);
        const z = Math.floor((rand() - 0.5) * 38);
        const col = this.columnAt(x, z);
        if (!col || !['grass', 'moss'].includes(col.type)) continue;
        if (col.pd < POND.r + 1.4) continue;
        if (Math.hypot(col.cx, col.cz - 10) < 3.4) continue;
        dummy.position.set(x + 0.5 + (rand() - 0.5) * 0.55, col.top, z + 0.5 + (rand() - 0.5) * 0.55);
        dummy.rotation.y = rand() * Math.PI;
        const s = 0.7 + rand() * 0.7;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        mesh.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
      mesh.count = placed;
      this.group.add(mesh);
    }
  }

  buildShards() {
    const spots = [[-15, 1], [13, 12], [15, -9], [-6, -16], [4, 17]];
    const colors = [0xffcc66, 0x74f4dd, 0xff9c6b, 0x9ed7ff, 0xd3ff92];
    const geo = new THREE.OctahedronGeometry(0.3, 0);
    for (let i = 0; i < spots.length; i++) {
      const [x, z] = spots[i];
      const col = this.columnAt(x, z);
      if (!col) continue;
      const g = new THREE.Group();
      g.position.set(x + 0.5, col.top + 1.15, z + 0.5);
      const mat = new THREE.MeshStandardMaterial({
        color: colors[i],
        emissive: colors[i],
        emissiveIntensity: 2.2,
        roughness: 0.2,
        metalness: 0.1,
        flatShading: true,
      });
      const crystal = new THREE.Mesh(geo, mat);
      crystal.scale.set(0.9, 1.5, 0.9);
      crystal.castShadow = true;
      g.add(crystal);
      const halo = glow(colors[i], 2.0, 0.75, i % 2 ? coolHaloTex : haloTex);
      g.add(halo);
      g.userData = { crystal, halo, baseY: g.position.y, phase: i * 1.7, collected: false, index: i, color: colors[i] };
      this.group.add(g);
      this.shards.push(g);
    }
  }

  buildWater() {
    const geo = new THREE.CircleGeometry(POND.r - 0.35, 56);
    geo.rotateX(-Math.PI / 2);
    this.waterUniforms = {
      uTime: { value: 0 },
      uSky: { value: new THREE.Color('#6fb8d8') },
      uDeep: { value: new THREE.Color('#0c5268') },
      uShallow: { value: new THREE.Color('#44b6ae') },
      uOpacity: { value: 0.94 },
    };
    this.waterDay = {
      sky: new THREE.Color('#6fb8d8'),
      deep: new THREE.Color('#0c5268'),
      shallow: new THREE.Color('#44b6ae'),
    };
    this.waterNight = {
      sky: new THREE.Color('#1a3550'),
      deep: new THREE.Color('#061826'),
      shallow: new THREE.Color('#0d3b46'),
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSky;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform float uOpacity;
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float wave = sin(vUv.x * 42.0 + uTime * 1.15) * sin(vUv.y * 37.0 - uTime * 0.82);
          float wave2 = sin((vUv.x + vUv.y) * 21.0 - uTime * 1.6) * 0.5 + 0.5;
          float glint = smoothstep(0.72, 1.0, wave * 0.5 + wave2 * 0.5);
          vec3 col = mix(uDeep, uShallow, 0.42 + wave * 0.18);
          float rim = smoothstep(0.84, 1.0, r);
          col = mix(col, uSky, 0.24 + rim * 0.38);
          col += glint * vec3(0.55, 0.72, 0.68) * 0.34;
          float alpha = uOpacity * (1.0 - smoothstep(0.86, 1.0, r) * 0.45);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const water = new THREE.Mesh(geo, mat);
    water.position.set(POND.x, WATER_Y, POND.z);
    water.renderOrder = 2;
    this.group.add(water);

    // the outflow runs from the pond to the eastern rim
    const start = POND.x + POND.r - 1.4;
    const end = this.streamEnd + 0.55;
    const streamMat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform float uTime; uniform vec3 uSky; uniform vec3 uDeep; uniform vec3 uShallow; uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float wave = sin(vUv.x * 54.0 - uTime * 2.2) * sin(vUv.y * 18.0 + uTime * 1.1);
          float glint = smoothstep(0.45, 1.0, wave * 0.5 + 0.5);
          vec3 col = mix(uDeep, uShallow, 0.5 + wave * 0.15);
          col = mix(col, uSky, 0.22 + glint * 0.22);
          float alpha = uOpacity * 0.96;
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const streamGeo = new THREE.PlaneGeometry(Math.max(0.1, end - start), 2.3, 1, 1);
    streamGeo.rotateX(-Math.PI / 2);
    const stream = new THREE.Mesh(streamGeo, streamMat);
    stream.position.set((start + end) / 2, WATER_Y + 0.005, POND.z);
    stream.renderOrder = 2;
    this.group.add(stream);

    // a ring of wet stones and reeds around the pond
    const rand = mulberry32(500);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rand() * 0.2;
      const x = Math.round(POND.x + Math.cos(a) * (POND.r + 0.25));
      const z = Math.round(POND.z + Math.sin(a) * (POND.r + 0.25));
      const col = this.columnAt(x, z);
      if (col && col.top > WATER_Y) this.addBlock(x, col.top, z, rand() > 0.5 ? 'cobble' : 'moss');
    }

    // a few lily pads drifting on the pond
    const padGeo = blockGeometry('leaves');
    const pads = [
      [POND.x + 2.1, POND.z + 1.5, 0.5],
      [POND.x - 2.3, POND.z - 1.2, 0.9],
      [POND.x + 0.3, POND.z + 2.5, 1.7],
      [POND.x - 1.2, POND.z + 2.8, 2.4],
    ];
    for (const [x, z, rot] of pads) {
      const pad = new THREE.Mesh(padGeo, this.material);
      pad.position.set(x, WATER_Y + 0.045, z);
      pad.scale.set(0.92, 0.07, 0.92);
      pad.rotation.y = rot;
      this.group.add(pad);
    }
  }

  buildWaterfall() {
    const px = this.streamEnd + 0.52;
    const pz = POND.z;
    const top = WATER_Y + 0.03;
    const height = 30;
    this.waterfallUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0.9 },
      uLight: { value: new THREE.Color('#d7fbff') },
      uDeep: { value: new THREE.Color('#3398ae') },
    };
    const geo = new THREE.PlaneGeometry(3.3, height, 1, 28);
    geo.translate(0, -height / 2, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.waterfallUniforms,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uTime; uniform float uOpacity; uniform vec3 uLight; uniform vec3 uDeep;
        varying vec2 vUv;
        void main() {
          float flow = fract(vUv.y * 2.6 + uTime * 0.7);
          float column = sin(vUv.x * 42.0 + sin(vUv.y * 13.0 + uTime * 1.2) * 0.7) * 0.5 + 0.5;
          float bands = smoothstep(0.15, 0.95, flow) * smoothstep(0.2, 1.0, column);
          float edge = smoothstep(0.0, 0.11, vUv.x) * smoothstep(0.0, 0.11, 1.0 - vUv.x);
          vec3 col = mix(uDeep, uLight, 0.3 + bands * 0.6);
          float alpha = uOpacity * edge * (0.5 + bands * 0.45);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const fall = new THREE.Mesh(geo, mat);
    fall.position.set(px, top, pz);
    fall.rotation.y = Math.PI / 2;
    fall.renderOrder = 3;
    this.group.add(fall);

    // A second, perpendicular veil keeps the cascade readable from the south.
    const fallCross = new THREE.Mesh(geo, mat);
    fallCross.position.set(px + 0.15, top, pz);
    fallCross.rotation.y = 0;
    fallCross.scale.x = 0.8;
    fallCross.renderOrder = 3;
    this.group.add(fallCross);
    this.waterfallPos = new THREE.Vector3(px + 0.6, top - height + 4, pz);

    // bright foam at the lip
    const foam = glow(0xc8fbff, 3.4, 0.7, glowTex);
    foam.position.set(px - 0.1, top + 0.15, pz);
    this.group.add(foam);
    this.waterfallFoam = foam;

    // mossy stones frame the outflow
    for (const dz of [-2, 2]) {
      const c = this.columnAt(Math.floor(this.streamEnd), Math.floor(pz + dz));
      if (c) this.addBlock(c.x, c.top, c.z, 'moss');
    }

    // mist at the base
    this.mist = this.makeParticleSystem(52, 0.8, 'rgb(210,250,255)');
    this.mist.points.position.copy(this.waterfallPos);
    this.group.add(this.mist.points);
  }

  makeParticleSystem(count, size, color) {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 1] = Math.random() * 7;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size,
      map: glowTex,
      color,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    return { points, seeds, positions };
  }

  buildClouds() {
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xf4f5ee,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
      fog: true,
    });
    this.cloudMaterial = cloudMat;
    const rand = mulberry32(8512);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const anchors = [
      [58, 25, 52], [-68, 18, 38], [20, 12, -74], [-52, 39, -46],
      [82, 34, -8], [14, -26, 62], [-86, 26, 16], [42, 48, -32],
    ];
    for (let i = 0; i < 14; i++) {
      const count = 4 + Math.floor(rand() * 6);
      const mesh = new THREE.InstancedMesh(box, cloudMat, count);
      mesh.frustumCulled = false;
      const dummy = new THREE.Object3D();
      for (let j = 0; j < count; j++) {
        const sx = 1.8 + rand() * 4.2;
        const sy = 1.0 + rand() * 1.3;
        const sz = 1.5 + rand() * 3.2;
        dummy.position.set((rand() - 0.5) * 14, (rand() - 0.5) * 2.2, (rand() - 0.5) * 8);
        dummy.scale.set(sx, sy, sz);
        dummy.rotation.y = (rand() - 0.5) * 0.3;
        dummy.rotation.x = (rand() - 0.5) * 0.16;
        dummy.rotation.z = (rand() - 0.5) * 0.16;
        dummy.updateMatrix();
        mesh.setMatrixAt(j, dummy.matrix);
      }
      if (i < anchors.length) {
        mesh.position.set(...anchors[i]);
      } else {
        const angle = rand() * Math.PI * 2;
        const radius = 48 + rand() * 115;
        const y = rand() < 0.2 ? -14 - rand() * 18 : 20 + rand() * 34;
        mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      }
      mesh.userData.speed = 0.55 + rand() * 0.9;
      this.group.add(mesh);
      this.clouds.push(mesh);
    }
  }

  buildFireflies() {
    const count = 120;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const rand = mulberry32(999);
    let i = 0;
    while (i < count) {
      const x = (rand() - 0.5) * 44;
      const z = (rand() - 0.5) * 44;
      const col = this.columnAt(x, z);
      if (!col) continue;
      positions[i * 3] = x;
      positions[i * 3 + 1] = col.top + 0.8 + rand() * 4.4;
      positions[i * 3 + 2] = z;
      seeds[i] = rand() * Math.PI * 2;
      i++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.fireflySeeds = seeds;
    this.fireflyBase = positions.slice();
    const mat = new THREE.PointsMaterial({
      size: 0.2,
      map: glowTex,
      color: 0xd7ffb0,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.fireflies = new THREE.Points(geo, mat);
    this.fireflies.renderOrder = 4;
    this.group.add(this.fireflies);
  }

  buildBirds() {
    this.birds = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x263b42, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.5, 0, 0, 0, 0.1, 0, 0, 0, 0.42,
      0, 0.1, 0, 0.5, 0, 0, 0, 0, 0.42,
    ], 3));
    geo.computeVertexNormals();
    this.birdMaterial = mat;
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(geo, mat);
      b.userData.phase = i * 1.3;
      b.userData.radius = 23 + i * 3.5;
      b.userData.speed = 0.055 + i * 0.006;
      b.userData.height = 17 + i * 1.2;
      b.scale.setScalar(0.9 + i * 0.08);
      this.birds.add(b);
    }
    this.group.add(this.birds);
  }

  buildStars() {
    const count = 1300;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    const rand = mulberry32(30303);
    for (let i = 0; i < count; i++) {
      const y = rand() * 0.92 + 0.02;
      const theta = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      // thin the stars near the horizon so the island silhouette stays clean
      const radius = 430;
      positions[i * 3] = Math.cos(theta) * r * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = Math.sin(theta) * r * radius;
      phases[i] = rand() * Math.PI * 2;
      sizes[i] = 1.1 + rand() * 2.1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aPhase; attribute float aSize;
        uniform float uTime; uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float twinkle = 0.55 + 0.45 * sin(uTime * 1.7 + aPhase);
          vAlpha = twinkle;
          gl_PointSize = aSize * uPixelRatio * (0.65 + twinkle * 0.6);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          float core = smoothstep(0.5, 0.05, d);
          float alpha = core * vAlpha * uOpacity;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(vec3(0.83, 0.91, 1.0), alpha);
        }
      `,
    });
    this.stars = new THREE.Points(geo, mat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -5;
    this.scene.add(this.stars);
  }

  buildCelestial() {
    this.sun = new THREE.Group();
    const sunPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 34),
      new THREE.MeshBasicMaterial({ color: 0xfff2bd, fog: false, toneMapped: false })
    );
    const sunGlow = glow(0xffd68a, 155, 0.85, haloTex);
    this.sun.add(sunPlane, sunGlow);
    this.sun.renderOrder = 1;
    this.scene.add(this.sun);

    this.moon = new THREE.Group();
    const moonPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshBasicMaterial({ map: moonTexture(), fog: false, toneMapped: false })
    );
    const moonGlow = glow(0x9fb9d6, 110, 0.5, coolHaloTex);
    this.moon.add(moonPlane, moonGlow);
    this.moon.renderOrder = 1;
    this.scene.add(this.moon);

    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.moonDir = new THREE.Vector3(0, -1, 0);
  }

  buildSky() {
    this.skyUniforms = {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uDay: { value: 0.5 },
      uTopDay: { value: new THREE.Color('#2b79d6') },
      uTopNight: { value: new THREE.Color('#030a1c') },
      uHorizonDay: { value: new THREE.Color('#b3d9e6') },
      uHorizonNight: { value: new THREE.Color('#0e1a38') },
      uSunset: { value: new THREE.Color('#ff9860') },
      uSunsetAmt: { value: 0 },
      uSunColor: { value: new THREE.Color('#fff0bd') },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir; uniform vec3 uMoonDir;
        uniform float uDay; uniform float uSunsetAmt;
        uniform vec3 uTopDay; uniform vec3 uTopNight;
        uniform vec3 uHorizonDay; uniform vec3 uHorizonNight;
        uniform vec3 uSunset; uniform vec3 uSunColor;
        varying vec3 vDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y, -0.15, 1.0);
          float dayMix = smoothstep(-0.22, 0.28, uDay);

          vec3 dayCol = mix(uHorizonDay, uTopDay, pow(clamp(h, 0.0, 1.0), 0.55));
          vec3 nightCol = mix(uHorizonNight, uTopNight, pow(clamp(h, 0.0, 1.0), 0.72));
          vec3 col = mix(nightCol, dayCol, dayMix);

          // the horizon warms as the sun sits low
          float horizonBand = exp(-abs(h) * 7.0);
          float lowSun = smoothstep(0.55, 0.0, abs(uSunDir.y));
          float towardSun = pow(max(dot(dir, uSunDir), 0.0), 2.5);
          col += uSunset * (horizonBand * lowSun * towardSun * 0.55 + horizonBand * uSunsetAmt * 0.28);

          // ambient glow around the sun and moon
          float sunDot = max(dot(dir, uSunDir), 0.0);
          col += uSunColor * pow(sunDot, 48.0) * 0.24 * dayMix;
          float moonDot = max(dot(dir, uMoonDir), 0.0);
          col += vec3(0.52, 0.66, 0.88) * pow(moonDot, 42.0) * (1.0 - dayMix) * 0.12;

          // a whisper of high cloud haze
          float haze = smoothstep(0.08, 0.55, h) * (1.0 - smoothstep(0.55, 0.95, h));
          col += vec3(0.14, 0.2, 0.18) * haze * dayMix * 0.1;

          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 18), mat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  setupLights() {
    this.hemi = new THREE.HemisphereLight(0xcfe7df, 0x23342a, 1.5);
    this.scene.add(this.hemi);

    this.sunLight = new THREE.DirectionalLight(0xffe3b0, 2.1);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 120;
    this.sunLight.shadow.camera.left = -34;
    this.sunLight.shadow.camera.right = 34;
    this.sunLight.shadow.camera.top = 34;
    this.sunLight.shadow.camera.bottom = -34;
    this.sunLight.shadow.bias = -0.0007;
    this.sunLight.shadow.normalBias = 0.035;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.moonLight = new THREE.DirectionalLight(0x8aa6d6, 0.45);
    this.scene.add(this.moonLight);
    this.scene.add(this.moonLight.target);

    this.campfireLight = new THREE.PointLight(0xff9f4a, 8, 18, 1.7);
    const camp = this.campfire || { x: 3.5, z: 5.5, y: 8 };
    this.campfireLight.position.set(camp.x, camp.y + 0.85, camp.z);
    this.scene.add(this.campfireLight);
  }

  instantiateBlocks() {
    const grouped = new Map();
    for (const b of this.blocks.values()) {
      if (!grouped.has(b.type)) grouped.set(b.type, []);
      grouped.get(b.type).push(b);
    }
    this.blockMeshes = [];
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (const [type, list] of grouped) {
      const mesh = new THREE.InstancedMesh(blockGeometry(type), this.material, list.length);
      mesh.name = `blocks-${type}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        dummy.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        // Bake a soft vertical gradient into the instance colour so cliffs and
        // the underside keep some depth even when shadows are unavailable.
        const depth = Math.min(1, Math.max(0, (b.y + 22) / 40));
        const shade = 0.62 + depth * 0.38;
        const v = b.tint * shade * (0.94 + hash2(b.x, b.y + b.z, 17) * 0.12);
        color.setRGB(v, v, v);
        mesh.setColorAt(i, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.group.add(mesh);
      this.blockMeshes.push(mesh);
    }
  }

  // A bonfire close to the spawn point, built after terrain so it sits on the height map.
  buildCampfire() {
    const x = -3, z = 4;
    const col = this.columnAt(x, z);
    if (!col) return;
    const y = col.top;
    this.campfire = { x: x + 0.5, y, z: z + 0.5 };
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > 2.4 || d < 1.25) continue;
        const c = this.columnAt(x + dx, z + dz);
        if (c) this.setBlock(x + dx, c.top - 1, z + dz, (dx + dz) % 2 ? 'cobble' : 'stone');
      }
    }
    this.setBlock(x, y - 1, z, 'ember');

    // crossed logs
    const logMat = new THREE.MeshLambertMaterial({ color: 0x6c4528 });
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.19, 0.2), logMat);
      log.position.set(x + 0.5, y + 0.12 + i * 0.035, z + 0.5);
      log.rotation.y = i * 1.05 + 0.2;
      log.castShadow = true;
      this.group.add(log);
    }

    const fire = new THREE.Group();
    fire.position.set(x + 0.5, y + 0.22, z + 0.5);
    for (let i = 0; i < 4; i++) {
      const sprite = glow(0xffa34d, 1.35 + i * 0.35, 0.62, fireTex);
      sprite.position.set((Math.random() - 0.5) * 0.22, 0.2 + i * 0.17, (Math.random() - 0.5) * 0.22);
      sprite.userData.phase = Math.random() * Math.PI * 2;
      fire.add(sprite);
    }
    this.group.add(fire);
    this.fireGroup = fire;

    const sparks = this.makeParticleSystem(30, 0.5, 'rgb(255,170,80)');
    sparks.points.position.set(x + 0.5, y + 0.12, z + 0.5);
    sparks.points.material.opacity = 0.8;
    this.group.add(sparks.points);
    this.sparks = sparks;

    // two low log benches facing the fire
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x8a5a34 });
    const benches = [[x + 3.3, z - 0.6, 0.25], [x - 0.9, z + 3.2, 1.15]];
    for (const [bx, bz, rot] of benches) {
      const c = this.columnAt(Math.floor(bx), Math.floor(bz));
      if (!c) continue;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.48), benchMat);
      seat.position.set(bx, c.top + 0.12, bz);
      seat.rotation.y = rot;
      seat.castShadow = true;
      seat.receiveShadow = true;
      this.group.add(seat);
      for (const s of [-0.65, 0.65]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.4), logMat);
        leg.position.set(bx + Math.cos(rot) * s, c.top - 0.08, bz - Math.sin(rot) * s);
        leg.castShadow = true;
        this.group.add(leg);
      }
    }
  }

  buildSceneryLights() {
    const spots = [[-1, 7], [9, -1]];
    this.torchLights = [];
    for (const [x, z] of spots) {
      const col = this.columnAt(x, z);
      if (!col) continue;
      const y = col.top;
      // a slim torch pole
      const pole = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 2.6, 0.13),
        new THREE.MeshLambertMaterial({ color: 0x6b4528 })
      );
      pole.position.set(x + 0.5, y + 1.3, z + 0.5);
      pole.castShadow = true;
      this.group.add(pole);
      const flame = glow(0xffb45c, 1.4, 0.85, fireTex);
      flame.position.set(x + 0.5, y + 2.72, z + 0.5);
      this.group.add(flame);
      const light = new THREE.PointLight(0xffb45c, 2.4, 9, 2);
      light.position.set(x + 0.5, y + 2.6, z + 0.5);
      this.scene.add(light);
      this.torchLights.push({ light, flame });
    }
  }

  update(dt, elapsed, info) {
    this.time = elapsed;
    const { night } = info;

    if (this.waterUniforms) {
      this.waterUniforms.uTime.value = elapsed;
      this.waterUniforms.uOpacity.value = 0.88 + night * 0.06;
      this.waterUniforms.uSky.value.copy(this.waterDay.sky).lerp(this.waterNight.sky, night);
      this.waterUniforms.uDeep.value.copy(this.waterDay.deep).lerp(this.waterNight.deep, night);
      this.waterUniforms.uShallow.value.copy(this.waterDay.shallow).lerp(this.waterNight.shallow, night);
    }
    if (this.waterfallUniforms) this.waterfallUniforms.uTime.value = elapsed;

    if (this.stars) {
      this.stars.material.uniforms.uTime.value = elapsed;
      this.stars.material.uniforms.uOpacity.value = Math.pow(night, 1.2) * 0.95;
    }
    if (this.sky) {
      this.skyUniforms.uSunDir.value.copy(this.sunDir);
      this.skyUniforms.uMoonDir.value.copy(this.moonDir);
      this.skyUniforms.uDay.value = this.sunDir.y;
      this.skyUniforms.uSunsetAmt.value = info.sunset;
    }

    if (this.sun) {
      this.sun.position.copy(this.sunDir).multiplyScalar(420).add(new THREE.Vector3(0, 0, 0));
      this.sun.lookAt(this.scene.userData.cameraPosition || new THREE.Vector3(0, 8, 20));
      const sunGlow = this.sun.children[1];
      if (sunGlow) sunGlow.material.opacity = 0.55 * Math.max(0, this.sunDir.y + 0.15);
    }
    if (this.moon) {
      this.moon.position.copy(this.moonDir).multiplyScalar(420);
      this.moon.lookAt(this.scene.userData.cameraPosition || new THREE.Vector3(0, 8, 20));
      const moonGlow = this.moon.children[1];
      if (moonGlow) moonGlow.material.opacity = 0.35 + night * 0.25;
    }

    // clouds drift, then wrap around the island
    for (const cloud of this.clouds) {
      cloud.position.x += dt * cloud.userData.speed;
      if (cloud.position.x > 180) cloud.position.x = -180;
    }
    if (this.cloudMaterial) {
      const dayTint = 0.79 + 0.21 * (1 - night);
      this.cloudMaterial.color.setRGB(dayTint, dayTint, dayTint);
    }

    // fireflies wake up at dusk
    if (this.fireflies) {
      this.fireflies.material.opacity = night * 0.9;
      const pos = this.fireflies.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const s = this.fireflySeeds[i];
        const b = this.fireflyBase;
        pos.setXYZ(
          i,
          b[i * 3] + Math.sin(elapsed * 0.45 + s) * 1.1,
          b[i * 3 + 1] + Math.sin(elapsed * 0.7 + s * 1.8) * 0.55,
          b[i * 3 + 2] + Math.cos(elapsed * 0.38 + s * 1.4) * 1.1
        );
      }
      pos.needsUpdate = true;
    }

    // shard hearts
    for (const shard of this.shards) {
      const u = shard.userData;
      if (u.collected) continue;
      shard.rotation.y += dt * 0.9;
      u.crystal.rotation.x = Math.sin(elapsed * 1.2 + u.phase) * 0.2;
      u.crystal.rotation.z = Math.cos(elapsed * 0.9 + u.phase) * 0.2;
      shard.position.y = u.baseY + Math.sin(elapsed * 1.8 + u.phase) * 0.16;
      u.halo.material.opacity = 0.6 + Math.sin(elapsed * 2.2 + u.phase) * 0.2;
      u.halo.scale.setScalar(1.9 + Math.sin(elapsed * 1.7 + u.phase) * 0.2);
    }

    // campfire flicker
    if (this.campfireLight) {
      const flicker = 0.84 + Math.sin(elapsed * 13.1) * 0.07 + Math.sin(elapsed * 7.7) * 0.09;
      this.campfireLight.intensity = (6 + night * 8) * flicker;
    }
    if (this.fireGroup) {
      for (const sprite of this.fireGroup.children) {
        const p = sprite.userData.phase;
        sprite.scale.setScalar(1.35 + Math.sin(elapsed * 6.1 + p) * 0.22);
        sprite.material.opacity = 0.55 + Math.sin(elapsed * 9.3 + p) * 0.16;
      }
    }
    if (this.sparks) {
      const pos = this.sparks.points.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const s = this.sparks.seeds[i];
        const t = (elapsed * (0.45 + s * 0.35) + s * 3) % 1;
        pos.setXYZ(i, (s - 0.5) * 1.1 + Math.sin(t * 8 + s * 20) * 0.2, t * 5.2, (s - 0.5) * 1.1 + Math.cos(t * 5 + s * 13) * 0.2);
      }
      pos.needsUpdate = true;
      this.sparks.points.material.opacity = 0.25 + night * 0.5;
    }
    if (this.torchLights) {
      for (const t of this.torchLights) {
        const f = 0.82 + Math.sin(elapsed * 10 + t.light.position.x) * 0.1;
        t.light.intensity = (1.4 + night * 3.0) * f;
        t.flame.material.opacity = 0.6 + Math.sin(elapsed * 8 + t.light.position.z) * 0.15;
      }
    }

    if (this.waterfallUniforms) this.waterfallUniforms.uOpacity.value = 0.8 + night * 0.1;
    if (this.waterfallFoam) this.waterfallFoam.material.opacity = 0.42 + Math.sin(elapsed * 3.1) * 0.1 + night * 0.12;
    if (this.mist) {
      const pos = this.mist.points.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const s = this.mist.seeds[i];
        const t = (elapsed * (0.18 + s * 0.14) + s) % 1;
        pos.setXYZ(i, (s - 0.5) * 5, t * 8 - 2, (s - 0.5) * 3.5 + Math.sin(t * 5 + s * 8) * 0.7);
      }
      pos.needsUpdate = true;
      this.mist.points.material.opacity = 0.18 + night * 0.14;
    }

    for (const b of this.birds.children) {
      const u = b.userData;
      const a = elapsed * u.speed + u.phase;
      b.position.set(Math.cos(a) * u.radius, u.height + Math.sin(elapsed * 0.6 + u.phase) * 1.8, Math.sin(a) * u.radius);
      b.rotation.y = -a + Math.PI / 2;
      b.rotation.z = Math.sin(elapsed * 3 + u.phase) * 0.18;
    }
    if (this.birdMaterial) this.birdMaterial.opacity = 0.16 + (1 - night) * 0.5;

    if (this.sky) this.sky.position.copy(this.scene.userData.cameraPosition || new THREE.Vector3());
    if (this.stars) this.stars.position.copy(this.scene.userData.cameraPosition || new THREE.Vector3());

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      burst.life -= dt;
      if (burst.life <= 0) {
        this.group.remove(burst.points);
        burst.points.geometry.dispose();
        burst.points.material.dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      const pos = burst.points.geometry.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        burst.vel[j * 3 + 1] -= dt * 1.4;
        pos.setXYZ(
          j,
          pos.getX(j) + burst.vel[j * 3] * dt,
          pos.getY(j) + burst.vel[j * 3 + 1] * dt,
          pos.getZ(j) + burst.vel[j * 3 + 2] * dt
        );
      }
      pos.needsUpdate = true;
      burst.points.material.opacity = Math.min(1, burst.life * 0.8);
    }
  }

  tryCollect(position) {
    for (const shard of this.shards) {
      const u = shard.userData;
      if (u.collected) continue;
      const dx = shard.position.x - position.x;
      const dz = shard.position.z - position.z;
      const dy = shard.position.y - position.y;
      if (dx * dx + dz * dz < 1.35 && Math.abs(dy) < 2.2) {
        u.collected = true;
        shard.visible = false;
        this.spawnBurst(shard.position, u.color);
        return u.index;
      }
    }
    return -1;
  }

  spawnBurst(position, color) {
    const count = 60;
    const positions = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      const a = Math.random() * Math.PI * 2;
      const p = Math.random() * Math.PI - Math.PI / 2;
      const speed = 1.4 + Math.random() * 3.8;
      vel[i * 3] = Math.cos(a) * Math.cos(p) * speed;
      vel[i * 3 + 1] = Math.sin(p) * speed + 1.6;
      vel[i * 3 + 2] = Math.sin(a) * Math.cos(p) * speed;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.32,
      map: glowTex,
      color,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.renderOrder = 6;
    this.group.add(points);
    this.bursts.push({ points, vel, life: 1.6 });
  }

  get collectedCount() {
    return this.shards.filter((s) => s.userData.collected).length;
  }

  setNight(night) {
    this.night = night;
  }
}
