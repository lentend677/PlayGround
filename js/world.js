import * as THREE from '../vendor/three.module.js';
import { BLOCK, BLOCK_INFO, GRID, TILE_SIZE } from './atlas.js';

export const SX = 64;
export const SY = 48;
export const SZ = 64;
export const ISLAND_CENTER = new THREE.Vector3(32, 24, 32);

const FACE_UV_INSET = 0.6 / (GRID * TILE_SIZE);

/* ─────────────────────────────────────────────────────────────────────
   Faces: positions, UVs and the two tangent axes used for vertex AO.
   ───────────────────────────────────────────────────────────────────── */
const FACES = [
  {
    dir: [1, 0, 0], shade: 0.84,
    verts: [
      { p: [1, 0, 1], u: 0, v: 0, s: [-1, 1] },
      { p: [1, 0, 0], u: 1, v: 0, s: [-1, -1] },
      { p: [1, 1, 0], u: 1, v: 1, s: [1, -1] },
      { p: [1, 1, 1], u: 0, v: 1, s: [1, 1] },
    ],
    au: [0, 1, 0], av: [0, 0, 1],
  },
  {
    dir: [-1, 0, 0], shade: 0.84,
    verts: [
      { p: [0, 0, 0], u: 0, v: 0, s: [-1, -1] },
      { p: [0, 0, 1], u: 1, v: 0, s: [-1, 1] },
      { p: [0, 1, 1], u: 1, v: 1, s: [1, 1] },
      { p: [0, 1, 0], u: 0, v: 1, s: [1, -1] },
    ],
    au: [0, 1, 0], av: [0, 0, 1],
  },
  {
    dir: [0, 1, 0], shade: 1.0,
    verts: [
      { p: [0, 1, 0], u: 0, v: 0, s: [-1, -1] },
      { p: [0, 1, 1], u: 0, v: 1, s: [-1, 1] },
      { p: [1, 1, 1], u: 1, v: 1, s: [1, 1] },
      { p: [1, 1, 0], u: 1, v: 0, s: [1, -1] },
    ],
    au: [1, 0, 0], av: [0, 0, 1],
  },
  {
    dir: [0, -1, 0], shade: 0.55,
    verts: [
      { p: [0, 0, 1], u: 0, v: 1, s: [-1, 1] },
      { p: [0, 0, 0], u: 0, v: 0, s: [-1, -1] },
      { p: [1, 0, 0], u: 1, v: 0, s: [1, -1] },
      { p: [1, 0, 1], u: 1, v: 1, s: [1, 1] },
    ],
    au: [1, 0, 0], av: [0, 0, 1],
  },
  {
    dir: [0, 0, 1], shade: 0.72,
    verts: [
      { p: [0, 0, 1], u: 0, v: 0, s: [-1, -1] },
      { p: [1, 0, 1], u: 1, v: 0, s: [1, -1] },
      { p: [1, 1, 1], u: 1, v: 1, s: [1, 1] },
      { p: [0, 1, 1], u: 0, v: 1, s: [-1, 1] },
    ],
    au: [1, 0, 0], av: [0, 1, 0],
  },
  {
    dir: [0, 0, -1], shade: 0.72,
    verts: [
      { p: [1, 0, 0], u: 0, v: 0, s: [1, -1] },
      { p: [0, 0, 0], u: 1, v: 0, s: [-1, -1] },
      { p: [0, 1, 0], u: 1, v: 1, s: [-1, 1] },
      { p: [1, 1, 0], u: 0, v: 1, s: [1, 1] },
    ],
    au: [1, 0, 0], av: [0, 1, 0],
  },
];

const AO_LEVELS = [0.52, 0.68, 0.84, 1.0];

/* ── noise helpers ───────────────────────────────────────────────────── */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}

function fbm(x, z, seed = 7, octaves = 4) {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    value += valueNoise(x * freq, z * freq, seed + i * 31) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return value / total;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ─────────────────────────────────────────────────────────────────────
   World
   ───────────────────────────────────────────────────────────────────── */
export class World {
  constructor(seed = 20261030) {
    this.seed = seed;
    this.data = new Uint8Array(SX * SY * SZ);
    this.group = new THREE.Group();
    this.group.name = 'island';
    this.meshes = {};
    this.pond = null;
    this.spawn = { x: 32.5, y: 30, z: 48.5, yaw: 0 };
    this.treeSpots = [];
  }

  idx(x, y, z) {
    return (y * SZ + z) * SX + x;
  }

  inside(x, y, z) {
    return x >= 0 && x < SX && y >= 0 && y < SY && z >= 0 && z < SZ;
  }

  getBlock(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (!this.inside(x, y, z)) return BLOCK.AIR;
    return this.data[this.idx(x, y, z)];
  }

  setBlock(x, y, z, type, force = false) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (!this.inside(x, y, z)) return false;
    if (!force) {
      const existing = this.data[this.idx(x, y, z)];
      if (BLOCK_INFO[existing]?.water && type !== BLOCK.AIR) return false;
    }
    this.data[this.idx(x, y, z)] = type;
    return true;
  }

  isOpaque(x, y, z) {
    const info = BLOCK_INFO[this.getBlock(x, y, z)];
    return !!info && !!info.solid && !info.water;
  }

  isSolid(x, y, z) {
    const info = BLOCK_INFO[this.getBlock(x, y, z)];
    return !!info && !!info.solid;
  }

  isWater(x, y, z) {
    return this.getBlock(x, y, z) === BLOCK.WATER;
  }

  surfaceY(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    for (let y = SY - 1; y >= 0; y--) {
      const info = BLOCK_INFO[this.getBlock(x, y, z)];
      if (info?.solid && !info.water) return y;
    }
    return -1;
  }

  surfaceType(x, z) {
    const y = this.surfaceY(x, z);
    if (y < 0) return BLOCK.AIR;
    return this.getBlock(x, y, z);
  }

  /* ── generation ─────────────────────────────────────────────────────── */
  generate(seed = this.seed) {
    this.seed = seed >>> 0;
    this.data.fill(BLOCK.AIR);
    this.treeSpots = [];
    this.pond = null;
    const rand = mulberry32(this.seed);
    const seedA = this.seed % 9973;
    const seedB = (this.seed * 3 + 101) % 9973;

    const R = 25.4;
    for (let x = 0; x < SX; x++) {
      for (let z = 0; z < SZ; z++) {
        const dx = x + 0.5 - 32;
        const dz = z + 0.5 - 32;
        const dist = Math.hypot(dx, dz);
        const warp = (fbm(x * 0.12, z * 0.12, seedA, 3) - 0.5) * 0.31;
        const d = dist / R + warp;
        if (d > 1.0) continue;
        const edge = clamp(1 - d, 0, 1);
        const hills = fbm(x * 0.09 + 11.3, z * 0.09 - 4.7, seedB, 4);
        let top = Math.floor(18.4 + Math.pow(edge, 0.68) * 8.9 + hills * 3.5 + fbm(x * 0.29, z * 0.29, seedA + 5, 2) * 1.2);
        top = clamp(top, 18, 32);
        const beach = edge < 0.155 || top <= 19;
        const bottom = Math.max(
          2,
          Math.floor(top - (3.2 + Math.pow(edge, 0.88) * 11.4 + fbm(x * 0.17 + 3, z * 0.17, seedB + 2, 3) * 3.1))
        );
        const dirtDepth = 2 + ((rand() * 3) | 0);
        for (let y = bottom; y <= top; y++) {
          let type;
          if (y === top) type = beach ? BLOCK.SAND : BLOCK.GRASS;
          else if (y >= top - dirtDepth) type = beach ? BLOCK.SAND : BLOCK.DIRT;
          else type = BLOCK.STONE;
          this.data[this.idx(x, y, z)] = type;
        }
        // Exposed stone gets occasional cobble flecks.
        if (edge < 0.42 && rand() < 0.05) {
          const y = bottom + 1 + ((rand() * 3) | 0);
          if (y < top - 1) this.data[this.idx(x, y, z)] = BLOCK.COBBLE;
        }
      }
    }

    // Hanging rock roots along the underside.
    for (let i = 0; i < 9; i++) {
      const angle = rand() * Math.PI * 2;
      const rr = 2 + rand() * 15;
      const x = Math.floor(32 + Math.cos(angle) * rr);
      const z = Math.floor(32 + Math.sin(angle) * rr);
      let y = 1;
      while (y < SY && !this.isOpaque(x, y, z)) y++;
      const len = 2 + ((rand() * 4) | 0);
      for (let k = 0; k < len; k++) {
        this.setBlock(x, y + k, z, k === len - 1 && rand() < 0.35 ? BLOCK.CRYSTAL : BLOCK.STONE, true);
      }
    }

    this.placePond(rand);
    this.placeSpawn(rand);
    this.placePath(rand);
    this.placeTrees(rand);
    this.placeBushesAndRocks(rand);
    this.placeCrystalOutcrop(rand);
    this.placePlants(rand);
    this.placeLanternPosts(rand);
    return this;
  }

  /* A calm, scenic landing spot: a grassy shelf just off the pond's
     south-west shore, looking across the water toward the island. */
  placeSpawn(rand) {
    const pond = this.pond;
    let best = null;
    if (pond) {
      const preferred = Math.atan2(3.8, -7.2);
      const bands = [1.25, 2.05, 2.9, 3.8];
      for (let i = 0; i < 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        for (const band of bands) {
          const radius = pond.r + band;
          const x = Math.round(pond.x + Math.cos(angle) * radius);
          const z = Math.round(pond.z + Math.sin(angle) * radius);
          if (x < 3 || z < 3 || x > SX - 4 || z > SZ - 4) continue;
          const topType = this.surfaceType(x, z);
          if (topType !== BLOCK.GRASS && topType !== BLOCK.SAND) continue;
          const sy = this.surfaceY(x, z);
          if (sy < 18) continue;
          const edge = Math.hypot(x - 32, z - 32);
          if (edge > 22.2) continue;

          let minY = sy;
          let maxY = sy;
          let wet = false;
          let blocked = false;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              const type = this.surfaceType(x + dx, z + dz);
              if (type === BLOCK.WATER || type === BLOCK.AIR) { wet = true; break; }
              const h = this.surfaceY(x + dx, z + dz);
              if (h < 18) { blocked = true; break; }
              minY = Math.min(minY, h);
              maxY = Math.max(maxY, h);
            }
            if (wet || blocked) break;
          }
          if (wet || blocked || maxY - minY > 1) continue;

          // Prefer a spot with a clear view across the water.
          const eyeX = x + 0.5;
          const eyeY = sy + 2.6;
          const eyeZ = z + 0.5;
          const vx = pond.x - eyeX;
          const vy = pond.level + 0.55 - eyeY;
          const vz = pond.z - eyeZ;
          const vlen = Math.hypot(vx, vy, vz);
          const sight = this.raycast(
            { x: eyeX, y: eyeY, z: eyeZ },
            { x: vx / vlen, y: vy / vlen, z: vz / vlen },
            Math.max(0.5, vlen - 1.2)
          );
          const blockedView = sight ? 1 : 0;

          let diff = Math.abs(((angle - preferred + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          const score = diff * 2.8 + (maxY - minY) * 1.15 +
            Math.abs(sy - 23.5) * 0.09 + Math.max(0, edge - 18.5) * 0.4 +
            blockedView * 7 + (topType === BLOCK.SAND ? 0.5 : 0) + rand() * 0.3;
          if (!best || score < best.score) best = { x, z, sy, score };
        }
      }
    }

    if (!best) {
      // Fallback: scan for any flat grass shelf near the south side.
      for (let r = 0; r < 16 && !best; r++) {
        for (let a = 0; a < 20; a++) {
          const ang = (a / 20) * Math.PI * 2;
          const x = Math.round(32 + Math.cos(ang) * (8 + r));
          const z = Math.round(32 + Math.sin(ang) * (8 + r));
          if (this.surfaceType(x, z) === BLOCK.GRASS && this.surfaceY(x, z) >= 18) {
            best = { x, z, sy: this.surfaceY(x, z) };
            break;
          }
        }
      }
    }
    if (!best) best = { x: 32, z: 48, sy: Math.max(18, this.surfaceY(32, 48)) };

    const { x, z } = best;
    const sy = this.surfaceY(x, z);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const tx = x + dx;
        const tz = z + dz;
        const top = this.surfaceY(tx, tz);
        if (top < 18) continue;
        let water = false;
        for (let y = top + 1; y <= top + 3; y++) {
          if (this.getBlock(tx, y, tz) === BLOCK.WATER) { water = true; break; }
        }
        if (water) continue;
        for (let y = top + 1; y <= top + 3; y++) {
          if (this.getBlock(tx, y, tz) !== BLOCK.AIR) this.setBlock(tx, y, tz, BLOCK.AIR, true);
        }
      }
    }

    let yaw = 0;
    let pitch = -0.06;
    if (pond) {
      const dx = pond.x - (x + 0.5);
      const dz = pond.z - (z + 0.5);
      yaw = Math.atan2(-dx, -dz);
      const flatDist = Math.max(1, Math.hypot(dx, dz));
      pitch = clamp(Math.atan2((pond.level + 0.6) - (sy + 2.6), flatDist) * 0.58, -0.33, -0.07);
    }
    this.spawn = { x: x + 0.5, y: sy + 1.02, z: z + 0.5, yaw, pitch };
  }

  placePond(rand) {
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < 42; i++) {
      const angle = (i / 42) * Math.PI * 2 + rand() * 0.12;
      const radius = 9 + rand() * 7;
      const x = Math.round(32 + Math.cos(angle) * radius);
      const z = Math.round(32 + Math.sin(angle) * radius);
      if (Math.hypot(x - 32, z - 48) < 6) continue;
      if (this.surfaceType(x, z) !== BLOCK.GRASS) continue;
      let min = 99;
      let max = -99;
      let ok = true;
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          const h = this.surfaceY(x + dx, z + dz);
          if (h < 18) { ok = false; break; }
          min = Math.min(min, h);
          max = Math.max(max, h);
        }
        if (!ok) break;
      }
      if (!ok) continue;
      const slope = max - min;
      const score = slope + Math.abs(max - 23) * 0.5 + rand() * 1.6;
      if (score < bestScore) {
        bestScore = score;
        best = { x, z, min, max };
      }
    }
    if (!best) best = { x: 24, z: 24, min: 22, max: 24 };

    const r = 5.0;
    const level = best.min - 1;
    this.pond = { x: best.x, z: best.z, r, level };
    for (let dx = -6; dx <= 6; dx++) {
      for (let dz = -6; dz <= 6; dz++) {
        const x = best.x + dx;
        const z = best.z + dz;
        const dist = Math.hypot(dx, dz) + (fbm(x * 0.5, z * 0.5, 71, 2) - 0.5) * 0.7;
        if (dist > r + 1.5) continue;
        const top = this.surfaceY(x, z);
        if (top < level) continue;
        if (dist <= r) {
          for (let y = level; y <= top; y++) this.setBlock(x, y, z, BLOCK.AIR, true);
          this.setBlock(x, level - 1, z, BLOCK.SAND, true);
          this.setBlock(x, level - 2, z, BLOCK.SAND, true);
          this.setBlock(x, level, z, BLOCK.WATER, true);
          this.setBlock(x, level, z, BLOCK.WATER, true);
        } else if (dist <= r + 1.35) {
          this.setBlock(x, top, z, BLOCK.SAND, true);
        }
      }
    }
    // A few lily pads.
    const pads = 4 + ((rand() * 3) | 0);
    for (let i = 0; i < pads; i++) {
      const a = rand() * Math.PI * 2;
      const rr = rand() * (r - 1.4);
      const x = Math.round(best.x + Math.cos(a) * rr);
      const z = Math.round(best.z + Math.sin(a) * rr);
      if (this.getBlock(x, level, z) === BLOCK.WATER) this.setBlock(x, level + 1, z, BLOCK.LILY, true);
    }
    // A small sandy shore step.
    this.setBlock(best.x + 5, level + 1, best.z, BLOCK.COBBLE, true);
  }

  placePath(rand) {
    const start = this.spawn || { x: 32.5, z: 48.5 };
    const points = [];
    const steps = 11;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const bend = Math.sin(t * Math.PI);
      let px = start.x + (30.5 - start.x) * t + bend * 3.0 * Math.sin(t * 5.1);
      let pz = start.z + (30.5 - start.z) * t + bend * 2.4 * Math.cos(t * 3.4);
      // Keep the trail from wading through the pond.
      if (this.pond) {
        const dx = px - this.pond.x;
        const dz = pz - this.pond.z;
        const dist = Math.hypot(dx, dz);
        const clear = this.pond.r + 2.1;
        if (dist < clear) {
          const a = dist < 0.01 ? start.z - this.pond.z : Math.atan2(dz, dx);
          px = this.pond.x + Math.cos(a) * clear;
          pz = this.pond.z + Math.sin(a) * clear;
        }
      }
      points.push([Math.round(px), Math.round(pz)]);
    }

    for (const [px, pz] of points) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (rand() > 0.48) continue;
          const x = px + dx;
          const z = pz + dz;
          const y = this.surfaceY(x, z);
          if (y < 18) continue;
          if (this.pond && Math.hypot(x - this.pond.x, z - this.pond.z) < this.pond.r + 1.4) continue;
          const surf = this.getBlock(x, y, z);
          if (surf === BLOCK.GRASS || surf === BLOCK.SAND) {
            this.setBlock(x, y, z, BLOCK.COBBLE, true);
            this.setBlock(x, y + 1, z, BLOCK.AIR, true);
          }
        }
      }
    }
  }

  placeTrees(rand) {
    let placed = 0;
    for (let attempt = 0; attempt < 180 && placed < 7; attempt++) {
      const angle = rand() * Math.PI * 2;
      const radius = 4 + rand() * 18.5;
      const x = Math.round(32 + Math.cos(angle) * radius);
      const z = Math.round(32 + Math.sin(angle) * radius);
      if (this.spawn && Math.hypot(x - this.spawn.x, z - this.spawn.z) < 5) continue;
      if (this.pond && Math.hypot(x - this.pond.x, z - this.pond.z) < this.pond.r + 3) continue;
      if (this.surfaceType(x, z) !== BLOCK.GRASS) continue;
      const y = this.surfaceY(x, z);
      if (y < 20) continue;
      let slopeOk = true;
      for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        if (Math.abs(this.surfaceY(x + dx, z + dz) - y) > 2) slopeOk = false;
      }
      if (!slopeOk) continue;
      let tooClose = false;
      for (const t of this.treeSpots) {
        if (Math.hypot(t.x - x, t.z - z) < 5.2) { tooClose = true; break; }
      }
      if (tooClose) continue;

      const h = 4 + ((rand() * 3) | 0);
      const base = y + 1;
      this.setBlock(x, y, z, BLOCK.GRASS, true);
      for (let i = 0; i < h; i++) this.setBlock(x, base + i, z, BLOCK.LOG, true);
      const topY = base + h - 1;
      const layers = [
        { dy: -1, r: 2.7 },
        { dy: 0, r: 2.45 },
        { dy: 1, r: 1.9 },
        { dy: 2, r: 1.0 },
      ];
      for (const layer of layers) {
        const ly = topY + layer.dy;
        const rr = Math.ceil(layer.r);
        for (let dx = -rr; dx <= rr; dx++) {
          for (let dz = -rr; dz <= rr; dz++) {
            const dist = Math.hypot(dx, dz);
            if (dist > layer.r + 0.35) continue;
            if (dx === 0 && dz === 0 && ly <= topY) continue;
            if (dist > layer.r - 0.35 && rand() < 0.22) continue;
            if (this.getBlock(x + dx, ly, z + dz) === BLOCK.AIR) {
              this.setBlock(x + dx, ly, z + dz, BLOCK.LEAVES, true);
            }
          }
        }
      }
      this.setBlock(x, topY + 3, z, BLOCK.LEAVES, true);
      this.treeSpots.push({ x, z, y, h });
      placed++;
    }
  }

  placeBushesAndRocks(rand) {
    for (let i = 0; i < 4; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 6 + rand() * 15;
      const x = Math.round(32 + Math.cos(angle) * radius);
      const z = Math.round(32 + Math.sin(angle) * radius);
      if (this.spawn && Math.hypot(x - this.spawn.x, z - this.spawn.z) < 4) continue;
      if (this.surfaceType(x, z) !== BLOCK.GRASS) continue;
      const y = this.surfaceY(x, z);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > 1 && rand() < 0.3) continue;
          if (this.getBlock(x + dx, y + 1, z + dz) === BLOCK.AIR) {
            this.setBlock(x + dx, y + 1, z + dz, BLOCK.LEAVES, true);
          }
        }
      }
      if (this.getBlock(x, y + 2, z) === BLOCK.AIR && rand() < 0.7) this.setBlock(x, y + 2, z, BLOCK.LEAVES, true);
    }

    for (let i = 0; i < 3; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 8 + rand() * 14;
      const x = Math.round(32 + Math.cos(angle) * radius);
      const z = Math.round(32 + Math.sin(angle) * radius);
      if (this.spawn && Math.hypot(x - this.spawn.x, z - this.spawn.z) < 4) continue;
      if (this.surfaceType(x, z) !== BLOCK.GRASS) continue;
      const y = this.surfaceY(x, z);
      const n = 2 + ((rand() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const dx = Math.round((rand() - 0.5) * 2.3);
        const dz = Math.round((rand() - 0.5) * 2.3);
        if (this.getBlock(x + dx, y + 1, z + dz) === BLOCK.AIR) {
          this.setBlock(x + dx, y + 1, z + dz, rand() < 0.35 ? BLOCK.COBBLE : BLOCK.STONE, true);
          if (rand() < 0.45) this.setBlock(x + dx, y + 2, z + dz, BLOCK.STONE, true);
        }
      }
    }
  }

  placeCrystalOutcrop(rand) {
    const x = this.pond ? this.pond.x + 6 : 27;
    const z = this.pond ? this.pond.z + 5 : 25;
    let y = this.surfaceY(x, z);
    if (y < 18) return;
    this.setBlock(x, y, z, BLOCK.STONE, true);
    this.setBlock(x, y + 1, z, BLOCK.CRYSTAL, true);
    this.setBlock(x, y + 2, z, BLOCK.CRYSTAL, true);
    if (this.getBlock(x + 1, y + 1, z) === BLOCK.AIR && rand() < 0.7) this.setBlock(x + 1, y + 1, z, BLOCK.CRYSTAL, true);
    if (this.getBlock(x, y + 1, z + 1) === BLOCK.AIR && rand() < 0.55) this.setBlock(x, y + 1, z + 1, BLOCK.CRYSTAL, true);
    if (this.getBlock(x - 1, y + 1, z) === BLOCK.AIR && rand() < 0.4) {
      this.setBlock(x - 1, y, z, BLOCK.STONE, true);
      this.setBlock(x - 1, y + 1, z, BLOCK.CRYSTAL, true);
    }
  }

  placePlants(rand) {
    let placed = 0;
    for (let attempt = 0; attempt < 420 && placed < 110; attempt++) {
      const angle = rand() * Math.PI * 2;
      const radius = Math.sqrt(rand()) * 23.5;
      const x = Math.round(32 + Math.cos(angle) * radius);
      const z = Math.round(32 + Math.sin(angle) * radius);
      if (this.spawn && Math.hypot(x - this.spawn.x, z - this.spawn.z) < 2.5) continue;
      if (this.pond && Math.hypot(x - this.pond.x, z - this.pond.z) < this.pond.r + 1) continue;
      if (this.surfaceType(x, z) !== BLOCK.GRASS) continue;
      const y = this.surfaceY(x, z);
      if (this.getBlock(x, y + 1, z) !== BLOCK.AIR) continue;
      if (this.getBlock(x, y, z) === BLOCK.COBBLE) continue;
      const roll = rand();
      let type;
      if (roll < 0.62) type = BLOCK.TALL_GRASS;
      else if (roll < 0.82) type = BLOCK.FLOWER_YELLOW;
      else if (roll < 0.97) type = BLOCK.FLOWER_RED;
      else type = BLOCK.LEAVES;
      if (type === BLOCK.LEAVES && placed % 3 !== 0) type = BLOCK.TALL_GRASS;
      this.setBlock(x, y + 1, z, type, true);
      placed++;
    }
  }

  placeLanternPosts(rand) {
    const spots = [];
    const pond = this.pond;
    if (pond) spots.push([pond.x + 7, pond.z - 2]);
    spots.push([33, 42]);
    spots.push([24, 26]);
    spots.push([39, 35]);
    for (const [x, z] of spots) {
      if (!this.inside(x, 0, z)) continue;
      const y = this.surfaceY(x, z);
      if (y < 18) continue;
      if (this.getBlock(x, y, z) === BLOCK.WATER) continue;
      this.setBlock(x, y, z, BLOCK.COBBLE, true);
      this.setBlock(x, y + 1, z, BLOCK.LOG, true);
      this.setBlock(x, y + 2, z, BLOCK.LOG, true);
      this.setBlock(x, y + 3, z, BLOCK.LANTERN, true);
      if (this.getBlock(x, y + 1, z) === BLOCK.LOG) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (this.getBlock(x + dx, y + 2, z + dz) === BLOCK.LEAVES) this.setBlock(x + dx, y + 2, z + dz, BLOCK.AIR, true);
        }
      }
    }
  }

  /* ── mesh building ──────────────────────────────────────────────────── */
  build(materials) {
    this.disposeMeshes();
    const opaque = { pos: [], norm: [], uv: [], col: [], idx: [] };
    const water = { pos: [], norm: [], uv: [], col: [], idx: [] };
    const plants = { pos: [], norm: [], uv: [], col: [], idx: [] };
    const glow = { pos: [], norm: [], uv: [], col: [], idx: [] };

    for (let y = 0; y < SY; y++) {
      for (let z = 0; z < SZ; z++) {
        for (let x = 0; x < SX; x++) {
          const type = this.data[this.idx(x, y, z)];
          if (type === BLOCK.AIR) continue;
          const info = BLOCK_INFO[type];
          if (!info) continue;
          if (info.plant) { this.addPlant(plants, x, y, z, type, info); continue; }
          if (type === BLOCK.WATER) { this.addWater(water, x, y, z); continue; }
          const target = info.glow ? glow : opaque;
          this.addBlockFaces(target, x, y, z, type, info);
        }
      }
    }

    this.meshes.opaque = this.meshFrom(opaque, materials.terrain, 'terrain', true);
    this.meshes.water = this.meshFrom(water, materials.water, 'water', true);
    this.meshes.plants = this.meshFrom(plants, materials.plants, 'plants', false);
    this.meshes.glow = this.meshFrom(glow, materials.glow, 'glow', true);
    this.meshes.water.castShadow = false;
    this.meshes.water.receiveShadow = false;
    this.meshes.plants.castShadow = false;
    this.meshes.plants.receiveShadow = true;
    this.meshes.glow.castShadow = false;
    this.meshes.glow.receiveShadow = false;
    this.meshes.water.renderOrder = 3;
    this.meshes.plants.renderOrder = 2;

    for (const key of ['opaque', 'water', 'plants', 'glow']) {
      const mesh = this.meshes[key];
      if (!mesh) continue;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    return this.group;
  }

  meshFrom(bucket, material, name, shadows) {
    const geo = new THREE.BufferGeometry();
    if (!bucket.pos.length) {
      geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
      geo.setIndex([]);
    } else {
      geo.setAttribute('position', new THREE.Float32BufferAttribute(bucket.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(bucket.col, 3));
      geo.setIndex(bucket.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(bucket.idx, 1) : new THREE.Uint16BufferAttribute(bucket.idx, 1));
    }
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name;
    if (shadows) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    return mesh;
  }

  tileUV(tile, u, v) {
    const tx = tile % GRID;
    const ty = Math.floor(tile / GRID);
    const u0 = (tx * TILE_SIZE + FACE_UV_INSET) / (GRID * TILE_SIZE);
    const u1 = ((tx + 1) * TILE_SIZE - FACE_UV_INSET) / (GRID * TILE_SIZE);
    const v0 = 1 - ((ty + 1) * TILE_SIZE - FACE_UV_INSET) / (GRID * TILE_SIZE);
    const v1 = 1 - (ty * TILE_SIZE + FACE_UV_INSET) / (GRID * TILE_SIZE);
    return [u0 + (u1 - u0) * u, v0 + (v1 - v0) * v];
  }

  addBlockFaces(bucket, x, y, z, type, info) {
    const tint = 0.965 + hash2(x, z, this.seed + y * 7) * 0.07;
    for (let f = 0; f < 6; f++) {
      const face = FACES[f];
      const nx = x + face.dir[0];
      const ny = y + face.dir[1];
      const nz = z + face.dir[2];
      if (this.isOpaque(nx, ny, nz)) continue;
      const tile = info.tiles[f];
      const base = bucket.pos.length / 3;
      for (const vert of face.verts) {
        const px = x + vert.p[0];
        const py = y + vert.p[1];
        const pz = z + vert.p[2];
        bucket.pos.push(px, py, pz);
        bucket.norm.push(face.dir[0], face.dir[1], face.dir[2]);
        const [u, v] = this.tileUV(tile, vert.u, vert.v);
        bucket.uv.push(u, v);

        let ao = 3;
        if (!info.glow) {
          const s1 = this.isOpaque(nx + face.au[0] * vert.s[0], ny + face.au[1] * vert.s[0], nz + face.au[2] * vert.s[0]) ? 1 : 0;
          const s2 = this.isOpaque(nx + face.av[0] * vert.s[1], ny + face.av[1] * vert.s[1], nz + face.av[2] * vert.s[1]) ? 1 : 0;
          const sc = this.isOpaque(
            nx + face.au[0] * vert.s[0] + face.av[0] * vert.s[1],
            ny + face.au[1] * vert.s[0] + face.av[1] * vert.s[1],
            nz + face.au[2] * vert.s[0] + face.av[2] * vert.s[1]
          ) ? 1 : 0;
          ao = s1 && s2 ? 0 : 3 - (s1 + s2 + sc);
        }
        const shade = (info.glow ? 0.94 : AO_LEVELS[ao]) * face.shade * tint;
        bucket.col.push(shade, shade, shade);
      }
      bucket.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  addWater(bucket, x, y, z) {
    const topOffset = 0.88;
    for (let f = 0; f < 6; f++) {
      const face = FACES[f];
      const nx = x + face.dir[0];
      const ny = y + face.dir[1];
      const nz = z + face.dir[2];
      if (this.getBlock(nx, ny, nz) === BLOCK.WATER) continue;
      if (this.isOpaque(nx, ny, nz)) continue;
      if (f === 3) continue; // never render the bottom of water
      const base = bucket.pos.length / 3;
      for (const vert of face.verts) {
        let py = y + vert.p[1];
        if (f !== 3 && vert.p[1] === 1) py = y + topOffset;
        if (f === 2) py = y + topOffset;
        bucket.pos.push(x + vert.p[0], py, z + vert.p[2]);
        bucket.norm.push(face.dir[0], face.dir[1], face.dir[2]);
        let uu;
        let vv;
        if (f === 2) {
          uu = (x + vert.p[0]) * 0.75;
          vv = (z + vert.p[2]) * 0.75;
        } else {
          uu = ((x + vert.p[0]) * 0.6 + (z + vert.p[2]) * 0.6);
          vv = (y + vert.p[1]) * 0.8;
        }
        bucket.uv.push(uu, vv);
        bucket.col.push(1, 1, 1);
      }
      bucket.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  addPlant(bucket, x, y, z, type, info) {
    if (info.flat) {
      // Lily pad: a flat, slightly offset quad.
      const w = 0.92;
      const base = bucket.pos.length / 3;
      const cx = x + 0.5;
      const cz = z + 0.5;
      const yy = y + 0.03;
      const verts = [
        [cx - w / 2, yy, cz - w / 2, 0, 0],
        [cx + w / 2, yy, cz - w / 2, 1, 0],
        [cx + w / 2, yy, cz + w / 2, 1, 1],
        [cx - w / 2, yy, cz + w / 2, 0, 1],
      ];
      for (const [px, py, pz, u, v] of verts) {
        bucket.pos.push(px, py, pz);
        bucket.norm.push(0, 1, 0);
        const [tu, tv] = this.tileUV(info.tile, u, v);
        bucket.uv.push(tu, tv);
        bucket.col.push(0.95, 1, 0.95);
      }
      bucket.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      return;
    }

    const h = info.height;
    const w = type === BLOCK.TALL_GRASS ? 0.78 : 0.58;
    const cx = x + 0.5;
    const cz = z + 0.5;
    const tint = 0.9 + hash2(x, z, this.seed + 13) * 0.16;
    const planes = [
      [[-1, -1], [1, 1]],
      [[-1, 1], [1, -1]],
    ];
    for (const [[ax, az], [bx, bz]] of planes) {
      const base = bucket.pos.length / 3;
      const verts = [
        [cx + ax * w * 0.5, y + 0.02, cz + az * w * 0.5, 0, 0],
        [cx + bx * w * 0.5, y + 0.02, cz + bz * w * 0.5, 1, 0],
        [cx + bx * w * 0.5, y + h, cz + bz * w * 0.5, 1, 1],
        [cx + ax * w * 0.5, y + h, cz + az * w * 0.5, 0, 1],
      ];
      for (const [px, py, pz, u, v] of verts) {
        bucket.pos.push(px, py, pz);
        bucket.norm.push(0, 1, 0);
        const [tu, tv] = this.tileUV(info.tile, u, v);
        bucket.uv.push(tu, tv);
        bucket.col.push(tint, tint, tint);
      }
      bucket.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  disposeMeshes() {
    for (const key of Object.keys(this.meshes)) {
      const mesh = this.meshes[key];
      if (!mesh) continue;
      this.group.remove(mesh);
      mesh.geometry?.dispose();
    }
    this.meshes = {};
  }

  dispose() {
    this.disposeMeshes();
    this.group.removeFromParent();
  }

  /* ── raycasting ─────────────────────────────────────────────────────── */
  raycast(origin, direction, maxDist = 6) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const dx = direction.x, dy = direction.y, dz = direction.z;
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    const stepZ = Math.sign(dz);
    const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / dx);
    const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / dy);
    const tDeltaZ = stepZ === 0 ? Infinity : Math.abs(1 / dz);
    let tMaxX = stepX === 0 ? Infinity : (stepX > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX;
    let tMaxY = stepY === 0 ? Infinity : (stepY > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY;
    let tMaxZ = stepZ === 0 ? Infinity : (stepZ > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ;
    let nx = 0, ny = 0, nz = 0;
    let dist = 0;
    let guard = 0;

    while (dist <= maxDist && guard++ < 128) {
      const type = this.getBlock(x, y, z);
      const info = BLOCK_INFO[type];
      if (info && info.solid) {
        return { x, y, z, nx, ny, nz, type, dist };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        dist = tMaxX;
        tMaxX += tDeltaX;
        nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        dist = tMaxY;
        tMaxY += tDeltaY;
        nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ;
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0; ny = 0; nz = -stepZ;
      }
    }
    return null;
  }

  lanternPositions() {
    const out = [];
    for (let y = 0; y < SY; y++) {
      for (let z = 0; z < SZ; z++) {
        for (let x = 0; x < SX; x++) {
          if (this.data[this.idx(x, y, z)] === BLOCK.LANTERN) out.push(new THREE.Vector3(x + 0.5, y + 0.6, z + 0.5));
        }
      }
    }
    return out;
  }

  crystalPositions() {
    const out = [];
    for (let y = 0; y < SY; y++) {
      for (let z = 0; z < SZ; z++) {
        for (let x = 0; x < SX; x++) {
          if (this.data[this.idx(x, y, z)] === BLOCK.CRYSTAL) out.push(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
        }
      }
    }
    return out;
  }
}
