import * as THREE from '../vendor/three.module.js';

/* ─────────────────────────────────────────────────────────────────────
   A tiny procedural pixel-art atlas. No external images, no requests.
   Tiles are 16 × 16 and laid out in an 8 × 8 grid (128 px square).
   ───────────────────────────────────────────────────────────────────── */

export const TILE_SIZE = 16;
export const GRID = 8;
export const ATLAS_SIZE = TILE_SIZE * GRID;

export const TILE = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG_SIDE: 5,
  LOG_TOP: 6,
  LEAVES: 7,
  PLANKS: 8,
  WATER: 9,
  LANTERN: 10,
  FLOWER_RED: 11,
  FLOWER_YELLOW: 12,
  TALL_GRASS: 13,
  COBBLE: 14,
  LILY: 15,
  CRYSTAL: 16,
};

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG: 5,
  LEAVES: 6,
  PLANKS: 7,
  WATER: 8,
  LANTERN: 9,
  COBBLE: 10,
  FLOWER_RED: 11,
  FLOWER_YELLOW: 12,
  TALL_GRASS: 13,
  LILY: 14,
  CRYSTAL: 15,
};

export const BLOCK_INFO = {
  [BLOCK.GRASS]: { name: 'Grass', tiles: [1, 1, 0, 2, 1, 1], solid: true, sound: 'grass', icon: [0, 1] },
  [BLOCK.DIRT]: { name: 'Dirt', tiles: [2, 2, 2, 2, 2, 2], solid: true, sound: 'dirt', icon: [2, 2] },
  [BLOCK.STONE]: { name: 'Stone', tiles: [3, 3, 3, 3, 3, 3], solid: true, sound: 'stone', icon: [3, 3] },
  [BLOCK.SAND]: { name: 'Sand', tiles: [4, 4, 4, 4, 4, 4], solid: true, sound: 'sand', icon: [4, 4] },
  [BLOCK.LOG]: { name: 'Oak log', tiles: [5, 5, 6, 6, 5, 5], solid: true, sound: 'wood', icon: [6, 5] },
  [BLOCK.LEAVES]: { name: 'Leaves', tiles: [7, 7, 7, 7, 7, 7], solid: true, sound: 'leaves', icon: [7, 7] },
  [BLOCK.PLANKS]: { name: 'Planks', tiles: [8, 8, 8, 8, 8, 8], solid: true, sound: 'wood', icon: [8, 8] },
  [BLOCK.WATER]: { name: 'Water', tiles: [9, 9, 9, 9, 9, 9], solid: false, water: true },
  [BLOCK.LANTERN]: { name: 'Lantern', tiles: [10, 10, 10, 10, 10, 10], solid: true, sound: 'glass', icon: [10, 10], glow: true },
  [BLOCK.COBBLE]: { name: 'Cobble', tiles: [14, 14, 14, 14, 14, 14], solid: true, sound: 'stone', icon: [14, 14] },
  [BLOCK.FLOWER_RED]: { name: 'Poppy', plant: true, tile: TILE.FLOWER_RED, height: 0.72 },
  [BLOCK.FLOWER_YELLOW]: { name: 'Dandelion', plant: true, tile: TILE.FLOWER_YELLOW, height: 0.68 },
  [BLOCK.TALL_GRASS]: { name: 'Grass tuft', plant: true, tile: TILE.TALL_GRASS, height: 0.86 },
  [BLOCK.LILY]: { name: 'Lily pad', plant: true, flat: true, tile: TILE.LILY, height: 0.06 },
  [BLOCK.CRYSTAL]: { name: 'Sky crystal', tiles: [16, 16, 16, 16, 16, 16], solid: true, sound: 'glass', icon: [16, 16], glow: true },
};

export const HOTBAR = [
  BLOCK.GRASS,
  BLOCK.DIRT,
  BLOCK.STONE,
  BLOCK.SAND,
  BLOCK.LOG,
  BLOCK.LEAVES,
  BLOCK.LANTERN,
];

/* ── deterministic random ────────────────────────────────────────────── */
function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function speckle(ctx, rand, palette, amount = 0.4) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rand() < amount) {
        px(ctx, x, y, 1, 1, palette[(rand() * palette.length) | 0]);
      }
    }
  }
}

/* ── individual tiles ────────────────────────────────────────────────── */
function drawGrassTop(ctx, rand) {
  px(ctx, 0, 0, 16, 16, '#6fba55');
  speckle(ctx, rand, ['#67b04d', '#7cc75f', '#83cd68', '#5fa348', '#74bf55'], 0.6);
  for (let i = 0; i < 7; i++) {
    const x = (rand() * 16) | 0;
    const y = (rand() * 16) | 0;
    px(ctx, x, y, 2, 1, rand() > 0.5 ? '#93d973' : '#599b43');
  }
  for (let i = 0; i < 5; i++) {
    const x = (rand() * 16) | 0;
    const y = (rand() * 16) | 0;
    px(ctx, x, y, 1, 1, '#a7e486');
  }
}

function drawGrassSide(ctx, rand) {
  drawDirt(ctx, rand);
  const dips = [4, 3, 3, 2, 3, 4, 3, 2, 3, 4, 3, 3, 2, 3, 4, 3];
  for (let x = 0; x < 16; x++) {
    px(ctx, x, 0, 1, dips[x], '#69af50');
    px(ctx, x, dips[x] - 1, 1, 1, '#5a9844');
  }
  for (let i = 0; i < 10; i++) {
    const x = (rand() * 16) | 0;
    const y = dips[x] + ((rand() * 3) | 0);
    px(ctx, x, y, 1, 1, '#4d8a3c');
  }
  px(ctx, 0, 0, 16, 1, '#82c764');
}

function drawDirt(ctx, rand) {
  px(ctx, 0, 0, 16, 16, '#8a5d3e');
  speckle(ctx, rand, ['#7d5336', '#966746', '#724b31', '#9e6e4b', '#825638'], 0.55);
  for (let i = 0; i < 6; i++) {
    const x = (rand() * 14) | 0;
    const y = (rand() * 14) | 0;
    px(ctx, x, y, 2, 1, rand() > 0.5 ? '#6a472e' : '#a27452');
  }
}

function drawStone(ctx, rand) {
  px(ctx, 0, 0, 16, 16, '#8b959d');
  speckle(ctx, rand, ['#828c95', '#98a2aa', '#79848d', '#a2abb2', '#89939b'], 0.62);
  for (let i = 0; i < 4; i++) {
    let x = (rand() * 13) | 0;
    let y = (rand() * 13) | 0;
    for (let j = 0; j < 3 + ((rand() * 3) | 0); j++) {
      px(ctx, x, y, 1, 1, '#6b757e');
      x += rand() > 0.5 ? 1 : 0;
      y += rand() > 0.45 ? 1 : 0;
    }
  }
  for (let i = 0; i < 4; i++) px(ctx, (rand() * 16) | 0, (rand() * 16) | 0, 2, 1, '#a9b2b8');
}

function drawSand(ctx, rand) {
  px(ctx, 0, 0, 16, 16, '#e7d59f');
  speckle(ctx, rand, ['#e2cd93', '#efdfae', '#d8c187', '#f2e4b9', '#ddc98e'], 0.58);
  for (let i = 0; i < 6; i++) px(ctx, (rand() * 15) | 0, (rand() * 15) | 0, 2, 1, '#d3ba7f');
}

function drawLogSide(ctx, rand) {
  px(ctx, 0, 0, 16, 16, '#7e5838');
  for (let x = 0; x < 16; x++) {
    const base = rand() > 0.55 ? '#735030' : '#865f3d';
    px(ctx, x, 0, 1, 16, base);
  }
  for (let i = 0; i < 10; i++) {
    const x = (rand() * 16) | 0;
    const y = (rand() * 13) | 0;
    px(ctx, x, y, 1, 2 + ((rand() * 4) | 0), rand() > 0.5 ? '#634328' : '#966b45');
  }
  px(ctx, 2, 0, 1, 16, '#6b492b');
  px(ctx, 11, 0, 1, 16, '#6b492b');
}

function drawLogTop(ctx, rand) {
  px(ctx, 0, 0, 16, 16, '#c19a63');
  const rings = [
    [7.5, 2, '#a87e4d'],
    [7.5, 4, '#d2ad76'],
    [7.5, 6, '#b28755'],
    [7.5, 8, '#8e6a3f'],
  ];
  for (const [c, r, col] of rings) {
    ctx.fillStyle = col;
    ctx.fillRect(c - r, c - r, r * 2, 1);
    ctx.fillRect(c - r, c + r - 1, r * 2, 1);
    ctx.fillRect(c - r, c - r, 1, r * 2);
    ctx.fillRect(c + r - 1, c - r, 1, r * 2);
  }
  for (let i = 0; i < 8; i++) px(ctx, (rand() * 16) | 0, (rand() * 16) | 0, 1, 1, '#d9b781');
  px(ctx, 0, 0, 16, 1, '#a0784a');
  px(ctx, 0, 15, 16, 1, '#a0784a');
  px(ctx, 0, 0, 1, 16, '#a0784a');
  px(ctx, 15, 0, 1, 16, '#a0784a');
}

function drawLeaves(ctx, rand) {
  px(ctx, 0, 0, 16, 16, '#407a3e');
  speckle(ctx, rand, ['#3a7038', '#4d8c45', '#589b4c', '#356632', '#61a653'], 0.65);
  for (let i = 0; i < 14; i++) {
    const x = (rand() * 14) | 0;
    const y = (rand() * 14) | 0;
    if (rand() > 0.35) px(ctx, x, y, 2, 2, rand() > 0.5 ? '#4a8441' : '#2f5f2e');
  }
  for (let i = 0; i < 8; i++) px(ctx, (rand() * 16) | 0, (rand() * 16) | 0, 1, 1, '#79b966');
}

function drawPlanks(ctx, rand) {
  px(ctx, 0, 0, 16, 16, '#b78a55');
  const rows = [0, 5, 10, 15];
  for (const y of rows) px(ctx, 0, y, 16, 1, '#8d673c');
  for (let i = 0; i < 18; i++) {
    px(ctx, (rand() * 16) | 0, (rand() * 16) | 0, 2 + ((rand() * 4) | 0), 1, rand() > 0.5 ? '#a97c49' : '#c49964');
  }
  px(ctx, 3, 4, 1, 1, '#7b5834');
  px(ctx, 12, 9, 1, 1, '#7b5834');
  px(ctx, 7, 14, 1, 1, '#7b5834');
}

function drawWater(ctx, rand) {
  px(ctx, 0, 0, 16, 16, '#3f9fc4');
  for (let i = 0; i < 24; i++) {
    const x = (rand() * 15) | 0;
    const y = (rand() * 16) | 0;
    px(ctx, x, y, 2 + ((rand() * 3) | 0), 1, rand() > 0.55 ? '#4fb1d2' : '#348cae');
  }
  for (let i = 0; i < 8; i++) px(ctx, (rand() * 15) | 0, (rand() * 16) | 0, 1, 1, '#8ad8ea');
  for (let y = 0; y < 16; y += 4) px(ctx, 0, y, 16, 1, '#3795b8');
}

function drawLantern(ctx, rand) {
  px(ctx, 0, 0, 16, 16, '#59452f');
  px(ctx, 1, 1, 14, 14, '#ffd47d');
  px(ctx, 2, 2, 12, 12, '#ffe3a4');
  for (let i = 0; i < 18; i++) {
    px(ctx, 2 + ((rand() * 12) | 0), 2 + ((rand() * 12) | 0), 1, 1, rand() > 0.5 ? '#ffc65d' : '#fff1c4');
  }
  px(ctx, 6, 2, 1, 12, '#8e6a3f');
  px(ctx, 9, 2, 1, 12, '#8e6a3f');
  px(ctx, 2, 6, 12, 1, '#8e6a3f');
  px(ctx, 2, 9, 12, 1, '#8e6a3f');
  px(ctx, 0, 0, 16, 2, '#3f3122');
  px(ctx, 0, 14, 16, 2, '#3f3122');
  px(ctx, 0, 0, 2, 16, '#3f3122');
  px(ctx, 14, 0, 2, 16, '#3f3122');
  px(ctx, 7, 0, 2, 1, '#c7a267');
}

function drawFlowerRed(ctx, rand) {
  px(ctx, 7, 8, 1, 7, '#4d8f3e');
  px(ctx, 5, 11, 2, 1, '#5fa34c');
  px(ctx, 9, 13, 2, 1, '#5fa34c');
  px(ctx, 6, 3, 4, 3, '#c9473f');
  px(ctx, 7, 2, 3, 5, '#d85348');
  px(ctx, 5, 4, 2, 2, '#b83d3a');
  px(ctx, 10, 4, 2, 2, '#b83d3a');
  px(ctx, 7, 4, 2, 1, '#f2d772');
  px(ctx, 8, 5, 1, 1, '#7a2c2b');
}

function drawFlowerYellow(ctx, rand) {
  px(ctx, 7, 8, 1, 7, '#4d8f3e');
  px(ctx, 6, 11, 2, 1, '#5fa34c');
  px(ctx, 9, 12, 2, 1, '#5fa34c');
  px(ctx, 6, 3, 4, 4, '#f0ce4b');
  px(ctx, 5, 4, 6, 2, '#f7dc63');
  px(ctx, 7, 2, 2, 1, '#f7dc63');
  px(ctx, 7, 4, 2, 2, '#d6a62e');
  px(ctx, 8, 7, 1, 1, '#b68625');
}

function drawTallGrass(ctx, rand) {
  const blades = [
    [3, 6, 14], [5, 2, 12], [7, 4, 10], [9, 1, 13], [11, 5, 9], [13, 7, 11], [6, 9, 7], [12, 8, 8],
  ];
  for (const [x, top, bottom] of blades) {
    const col = rand() > 0.5 ? '#5c9e47' : '#6faf53';
    for (let y = top; y < bottom; y++) {
      const dx = Math.round(Math.sin(y * 0.55 + x) * 0.7);
      px(ctx, x + dx, y, 1, 1, y < top + 3 ? '#87c56a' : col);
    }
  }
  px(ctx, 2, 13, 12, 1, '#4f8d3e');
}

function drawCobble(ctx, rand) {
  px(ctx, 0, 0, 16, 16, '#6f797f');
  const stones = [
    [1, 1, 6, 4], [8, 1, 6, 3], [1, 6, 4, 4], [6, 5, 5, 5], [12, 5, 3, 4],
    [1, 11, 5, 4], [7, 11, 4, 4], [12, 10, 3, 5],
  ];
  for (const [x, y, w, h] of stones) {
    px(ctx, x, y, w, h, rand() > 0.5 ? '#8d979d' : '#97a1a6');
    px(ctx, x, y, w, 1, '#a5aeb2');
    px(ctx, x, y + h - 1, w, 1, '#626c72');
  }
  for (let i = 0; i < 12; i++) px(ctx, (rand() * 16) | 0, (rand() * 16) | 0, 1, 1, '#7d878c');
  px(ctx, 7, 1, 1, 4, '#5d676d');
  px(ctx, 5, 8, 2, 1, '#5d676d');
}

function drawLily(ctx, rand) {
  ctx.fillStyle = '#4b9150';
  ctx.beginPath();
  ctx.ellipse(8, 8, 7.2, 6.2, 0, 0.42, Math.PI * 2 - 0.42);
  ctx.lineTo(9.2, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5ea85d';
  ctx.beginPath();
  ctx.ellipse(7.4, 7.2, 4.6, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 5; i++) px(ctx, 6 + ((rand() * 6) | 0), 6 + ((rand() * 5) | 0), 1, 1, '#7bc074');
  // tiny flower
  px(ctx, 10, 5, 2, 2, '#f1d6a8');
  px(ctx, 10, 5, 1, 1, '#ffe9c9');
}

function drawCrystal(ctx, rand) {
  px(ctx, 0, 0, 16, 16, '#1e6f80');
  speckle(ctx, rand, ['#1a5f71', '#228295', '#2b95a7', '#176070'], 0.6);
  const shards = [
    [2, 10, 3, 5], [5, 5, 3, 9], [8, 2, 3, 12], [11, 7, 2, 7], [13, 11, 2, 3],
  ];
  for (const [x, y, w, h] of shards) {
    px(ctx, x, y, w, h, '#79e7f2');
    px(ctx, x, y, 1, h, '#b8fbff');
    px(ctx, x + w - 1, y, 1, h, '#35aabd');
  }
  px(ctx, 8, 2, 1, 2, '#efffff');
  px(ctx, 5, 5, 1, 2, '#dbffff');
}

/* ── atlas builder ───────────────────────────────────────────────────── */
export function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  const painters = {
    [TILE.GRASS_TOP]: drawGrassTop,
    [TILE.GRASS_SIDE]: drawGrassSide,
    [TILE.DIRT]: drawDirt,
    [TILE.STONE]: drawStone,
    [TILE.SAND]: drawSand,
    [TILE.LOG_SIDE]: drawLogSide,
    [TILE.LOG_TOP]: drawLogTop,
    [TILE.LEAVES]: drawLeaves,
    [TILE.PLANKS]: drawPlanks,
    [TILE.WATER]: drawWater,
    [TILE.LANTERN]: drawLantern,
    [TILE.FLOWER_RED]: drawFlowerRed,
    [TILE.FLOWER_YELLOW]: drawFlowerYellow,
    [TILE.TALL_GRASS]: drawTallGrass,
    [TILE.COBBLE]: drawCobble,
    [TILE.LILY]: drawLily,
    [TILE.CRYSTAL]: drawCrystal,
  };

  let seed = 0x5eed1234;
  for (const [index, painter] of Object.entries(painters)) {
    const tx = (Number(index) % GRID) * TILE_SIZE;
    const ty = Math.floor(Number(index) / GRID) * TILE_SIZE;
    const rand = rng(seed++);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.beginPath();
    ctx.rect(0, 0, TILE_SIZE, TILE_SIZE);
    ctx.clip();
    painter(ctx, rand);
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return { canvas, texture, tiles: TILE };
}

/* ── hotbar icons: draw a tiny isometric cube from the atlas ─────────── */
export function makeBlockIcon(atlasCanvas, [topTile, sideTile], size = 72) {
  const icon = document.createElement('canvas');
  icon.width = size;
  icon.height = size;
  const ctx = icon.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const s = size / 72;
  const topSrc = tileRect(topTile);
  const sideSrc = tileRect(sideTile);

  // top face diamond
  drawFace(ctx, atlasCanvas, topSrc, [
    [5 * s, 21 * s], [36 * s, 4 * s], [67 * s, 21 * s], [36 * s, 39 * s],
  ]);
  // left face
  drawFace(ctx, atlasCanvas, sideSrc, [
    [5 * s, 21 * s], [36 * s, 39 * s], [36 * s, 67 * s], [5 * s, 49 * s],
  ], 'rgba(0,0,0,0.05)');
  // right face
  drawFace(ctx, atlasCanvas, sideSrc, [
    [36 * s, 39 * s], [67 * s, 21 * s], [67 * s, 49 * s], [36 * s, 67 * s],
  ], 'rgba(0,0,0,0.17)');
  // soft dark outline to separate the cube from its slot
  ctx.strokeStyle = 'rgba(8,14,12,0.5)';
  ctx.lineWidth = Math.max(1, 1.35 * s);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(5 * s, 21 * s);
  ctx.lineTo(36 * s, 4 * s);
  ctx.lineTo(67 * s, 21 * s);
  ctx.lineTo(67 * s, 49 * s);
  ctx.lineTo(36 * s, 67 * s);
  ctx.lineTo(5 * s, 49 * s);
  ctx.closePath();
  ctx.stroke();
  // inner seams
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = Math.max(1, 0.8 * s);
  ctx.beginPath();
  ctx.moveTo(5 * s, 21 * s);
  ctx.lineTo(36 * s, 39 * s);
  ctx.lineTo(67 * s, 21 * s);
  ctx.moveTo(36 * s, 39 * s);
  ctx.lineTo(36 * s, 67 * s);
  ctx.stroke();
  // top highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = Math.max(1, s);
  ctx.beginPath();
  ctx.moveTo(5 * s, 21 * s);
  ctx.lineTo(36 * s, 4 * s);
  ctx.lineTo(67 * s, 21 * s);
  ctx.stroke();
  return icon.toDataURL('image/png');
}

function tileRect(index) {
  return {
    x: (index % GRID) * TILE_SIZE,
    y: Math.floor(index / GRID) * TILE_SIZE,
    w: TILE_SIZE,
    h: TILE_SIZE,
  };
}

function drawFace(ctx, atlas, src, quad, shade) {
  // Affine map from the 16×16 source tile onto the quad [p0,p1,p2,p3].
  const [p0, p1, p3] = quad;
  const ux = (p1[0] - p0[0]) / src.w;
  const uy = (p1[1] - p0[1]) / src.w;
  const vx = (p3[0] - p0[0]) / src.h;
  const vy = (p3[1] - p0[1]) / src.h;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(quad[0][0], quad[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(quad[i][0], quad[i][1]);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(ux, uy, vx, vy, p0[0], p0[1]);
  ctx.drawImage(atlas, src.x, src.y, src.w, src.h, 0, 0, src.w, src.h);
  ctx.restore();
  if (shade) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(quad[0][0], quad[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(quad[i][0], quad[i][1]);
    ctx.closePath();
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.restore();
  }
}
