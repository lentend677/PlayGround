import * as THREE from '../vendor/three.module.min.js';

const TILE = 16;
const COLS = 8;
const ROWS = 8;
const PX = TILE * COLS;

export const TILES = {
  grass_top: [0, 0],
  grass_side: [1, 0],
  dirt: [2, 0],
  stone: [3, 0],
  sand: [4, 0],
  log_side: [5, 0],
  log_top: [6, 0],
  leaves: [7, 0],

  planks: [0, 1],
  cobble: [1, 1],
  moss_top: [2, 1],
  moss_side: [3, 1],
  flower_red: [4, 1],
  flower_gold: [5, 1],
  tuft: [6, 1],
  stone_bricks: [7, 1],

  ember: [0, 2],
  wool_cream: [1, 2],
  wool_teal: [2, 2],
  path: [3, 2],
  gravel: [4, 2],
  crystal: [5, 2],
  snow: [6, 2],
  dark_stone: [7, 2],
};

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

function shade(hex, amount) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

function pixels(ctx, tile, draw) {
  const [col, row] = TILES[tile];
  const x0 = col * TILE;
  const y0 = row * TILE;
  const rand = mulberry32(9001 + col * 131 + row * 977);
  const put = (x, y, color, alpha = 1) => {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x0 + x, y0 + y, 1, 1);
    ctx.globalAlpha = 1;
  };
  draw(put, rand);
}

export function createAtlasTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = PX;
  canvas.height = PX;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, PX, PX);

  const fill = (put, colors, rand, density = 0.5) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        let c = colors[Math.floor(rand() * colors.length)];
        if (rand() > 1 - density) c = shade(c, (rand() - 0.5) * 0.09);
        put(x, y, c);
      }
    }
  };

  pixels(ctx, 'grass_top', (put, rand) => {
    fill(put, ['#6fae4f', '#78b856', '#83c45f', '#699f4a', '#8bcd67'], rand, 0.65);
    for (let i = 0; i < 18; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#4f833b');
    for (let i = 0; i < 9; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#a1db78');
  });

  pixels(ctx, 'grass_side', (put, rand) => {
    fill(put, ['#7e5131', '#8a5a37', '#744a2d', '#93613c'], rand, 0.6);
    for (let x = 0; x < TILE; x++) {
      const depth = 3 + (rand() > 0.58 ? 2 : 0) + (rand() > 0.9 ? 1 : 0);
      for (let y = 0; y < depth; y++) {
        const c = y === 0 ? ['#82c15d', '#75b253', '#91cc69'][Math.floor(rand() * 3)] : ['#6aa64d', '#7cb85a', '#5e9445'][Math.floor(rand() * 3)];
        put(x, y, c);
      }
    }
    for (let i = 0; i < 8; i++) put(Math.floor(rand() * 16), 6 + Math.floor(rand() * 9), '#664025');
  });

  pixels(ctx, 'dirt', (put, rand) => {
    fill(put, ['#7c4f30', '#875834', '#71452a', '#8e5e39', '#6b4228'], rand, 0.7);
    for (let i = 0; i < 14; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#5c3822');
    for (let i = 0; i < 8; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#9b6a43');
  });

  pixels(ctx, 'stone', (put, rand) => {
    fill(put, ['#8d9294', '#969a9c', '#828789', '#9ea2a3', '#787d80'], rand, 0.7);
    for (let i = 0; i < 4; i++) {
      let x = Math.floor(rand() * 16);
      let y = Math.floor(rand() * 16);
      for (let j = 0; j < 3 + Math.floor(rand() * 5); j++) {
        put(x, y, '#6c7275');
        x += rand() > 0.5 ? 1 : 0;
        y += rand() > 0.5 ? 1 : 0;
      }
    }
  });

  pixels(ctx, 'sand', (put, rand) => {
    fill(put, ['#e8d49b', '#efdda9', '#ddc88c', '#f4e3b3', '#d8c084'], rand, 0.7);
    for (let i = 0; i < 20; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#c9ad70');
    for (let i = 0; i < 10; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#fff0c8');
  });

  pixels(ctx, 'log_side', (put, rand) => {
    fill(put, ['#6d4728', '#7a5230', '#5f3c22', '#835a36'], rand, 0.5);
    for (let x = 0; x < TILE; x++) {
      if (x % 4 === 0 || (x % 7 === 3 && rand() > 0.5)) {
        for (let y = 0; y < TILE; y++) {
          if (rand() > 0.12) put(x, y, rand() > 0.5 ? '#59381f' : '#8e6139');
        }
      }
    }
    for (let i = 0; i < 10; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#4b2e19');
  });

  pixels(ctx, 'log_top', (put, rand) => {
    fill(put, ['#b28650', '#a97e49', '#bd9059'], rand, 0.25);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        if (d > 5.5 && d < 6.5) put(x, y, '#6d4728');
        if (d > 2.5 && d < 3.5) put(x, y, '#8c6138');
        if (d < 0.9) put(x, y, '#5c3b21');
      }
    }
  });

  pixels(ctx, 'leaves', (put, rand) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = rand();
        if (n < 0.1) continue;
        const c = n < 0.32 ? '#3f7431' : n < 0.58 ? '#4f8a3a' : n < 0.82 ? '#5e9a43' : '#72ab51';
        put(x, y, c);
      }
    }
    for (let i = 0; i < 10; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#2e5a27');
  });

  pixels(ctx, 'planks', (put, rand) => {
    fill(put, ['#b28149', '#a97842', '#bc8b51', '#a2703b'], rand, 0.45);
    for (let y = 0; y < TILE; y += 4) {
      for (let x = 0; x < TILE; x++) put(x, y, '#7f562d');
      for (let x = 0; x < TILE; x++) if (rand() > 0.55) put(x, y + 1, '#c29055');
    }
    for (let i = 0; i < 8; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#8e6335');
  });

  pixels(ctx, 'cobble', (put, rand) => {
    fill(put, ['#777d7d', '#858b8a', '#6d7373', '#929796'], rand, 0.4);
    for (let i = 0; i < 13; i++) {
      const x = Math.floor(rand() * 13), y = Math.floor(rand() * 13);
      const w = 1 + Math.floor(rand() * 4), h = 1 + Math.floor(rand() * 4);
      const c = ['#5f6565', '#9ca1a0', '#707676', '#575d5d'][Math.floor(rand() * 4)];
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) put(x + xx, y + yy, c);
    }
  });

  pixels(ctx, 'moss_top', (put, rand) => {
    fill(put, ['#527d42', '#5c8a49', '#486f3a', '#689751'], rand, 0.7);
    for (let i = 0; i < 20; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#3c5d30');
    for (let i = 0; i < 12; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#7fac61');
  });

  pixels(ctx, 'moss_side', (put, rand) => {
    fill(put, ['#7c5132', '#70472d', '#885b37'], rand, 0.5);
    for (let x = 0; x < TILE; x++) {
      const d = 2 + Math.floor(rand() * 4);
      for (let y = 0; y < d; y++) put(x, y, rand() > 0.5 ? '#4f7a41' : '#5f8e49');
    }
  });

  pixels(ctx, 'stone_bricks', (put, rand) => {
    fill(put, ['#8e9392', '#858a89', '#979c9b'], rand, 0.35);
    for (let y = 0; y < TILE; y += 8) {
      for (let x = 0; x < TILE; x++) put(x, y, '#646a69');
      const off = (y / 8) % 2 ? 4 : 0;
      for (let y2 = y; y2 < y + 8; y2++) put((off + 7) % 16, y2, '#6d7473');
    }
    for (let i = 0; i < 8; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#a2a7a6');
  });

  pixels(ctx, 'path', (put, rand) => {
    fill(put, ['#8c7b5f', '#97866a', '#817054', '#a08f71'], rand, 0.6);
    for (let i = 0; i < 22; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#6a5c45');
    for (let i = 0; i < 10; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#b4a481');
  });

  pixels(ctx, 'gravel', (put, rand) => {
    fill(put, ['#8b8378', '#978f83', '#7d766c', '#a39a8d'], rand, 0.8);
    for (let i = 0; i < 22; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#68625a');
  });

  pixels(ctx, 'snow', (put, rand) => {
    fill(put, ['#e9f0ec', '#f1f6f3', '#dfe9e4', '#f8fbf9'], rand, 0.6);
  });

  pixels(ctx, 'dark_stone', (put, rand) => {
    fill(put, ['#4d5258', '#565c62', '#444a50', '#60666b'], rand, 0.6);
    for (let i = 0; i < 12; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#343a40');
  });

  pixels(ctx, 'ember', (put, rand) => {
    fill(put, ['#f4a340', '#ffc65c', '#e8852b', '#ffd97c'], rand, 0.8);
    for (let i = 0; i < 14; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#b6541f');
  });

  pixels(ctx, 'wool_cream', (put, rand) => {
    fill(put, ['#e6dfc8', '#dcd4bb', '#eee7d3'], rand, 0.5);
    for (let i = 0; i < 14; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#c8bfa3');
  });

  pixels(ctx, 'wool_teal', (put, rand) => {
    fill(put, ['#3f7a74', '#478680', '#366b66'], rand, 0.5);
    for (let i = 0; i < 14; i++) put(Math.floor(rand() * 16), Math.floor(rand() * 16), '#2b5955');
  });

  pixels(ctx, 'crystal', (put, rand) => {
    fill(put, ['#8cf5e4', '#6fe9df', '#a9fff2', '#5bd4d4'], rand, 0.8);
  });

  pixels(ctx, 'flower_red', (put, rand) => {
    // transparent cutout flower
    for (let i = 0; i < 16; i++) {
      put(7, i, '#4d843b');
      put(8, i, '#5f9b47');
    }
    put(6, 11, '#4d843b'); put(9, 9, '#4d843b'); put(6, 8, '#4d843b');
    const petals = ['#e8564c', '#f06b5d', '#d8463f'];
    for (const [x, y] of [[6, 3], [7, 2], [8, 2], [9, 3], [6, 5], [7, 4], [8, 4], [9, 5], [7, 3], [8, 3]]) put(x, y, petals[Math.floor(rand() * petals.length)]);
    put(7, 4, '#ffd76e'); put(8, 4, '#ffd76e');
  });

  pixels(ctx, 'flower_gold', (put, rand) => {
    for (let i = 0; i < 16; i++) put(7, i, '#4d843b');
    for (let i = 0; i < 16; i++) put(8, i, '#5f9b47');
    const petals = ['#f7c96e', '#ffdf8c', '#e7ad46'];
    for (const [x, y] of [[6, 3], [7, 2], [8, 2], [9, 3], [6, 5], [7, 4], [8, 4], [9, 5], [7, 3], [8, 3]]) put(x, y, petals[Math.floor(rand() * petals.length)]);
    put(7, 4, '#b46f2e'); put(8, 4, '#b46f2e');
    put(9, 8, '#4d843b'); put(6, 10, '#4d843b');
  });

  pixels(ctx, 'tuft', (put, rand) => {
    for (let i = 0; i < 7; i++) {
      const x = 2 + i * 2;
      const h = 4 + Math.floor(rand() * 6);
      for (let y = 0; y < h; y++) put(x, 15 - y, y < h - 2 ? '#5f9b47' : '#7cb65b');
      if (rand() > 0.5) put(x + 1, 14, '#4d843b');
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function setBoxFaceUV(geometry, tileName) {
  const [col, row] = TILES[tileName];
  const uv = geometry.attributes.uv;
  const pad = 0.35 / PX;
  for (let face = 0; face < 6; face++) {
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      const u0 = uv.getX(i);
      const v0 = uv.getY(i);
      uv.setXY(
        i,
        col / COLS + pad + (u0 / COLS) * (1 - pad * 2),
        1 - (row + 1) / ROWS + pad + (v0 / ROWS) * (1 - pad * 2)
      );
    }
  }
  uv.needsUpdate = true;
}

const BLOCK_FACES = {
  grass: { side: 'grass_side', top: 'grass_top', bottom: 'dirt' },
  dirt: { side: 'dirt', top: 'dirt', bottom: 'dirt' },
  stone: { side: 'stone', top: 'stone', bottom: 'stone' },
  sand: { side: 'sand', top: 'sand', bottom: 'sand' },
  log: { side: 'log_side', top: 'log_top', bottom: 'log_top' },
  leaves: { side: 'leaves', top: 'leaves', bottom: 'leaves' },
  planks: { side: 'planks', top: 'planks', bottom: 'planks' },
  cobble: { side: 'cobble', top: 'cobble', bottom: 'cobble' },
  moss: { side: 'moss_side', top: 'moss_top', bottom: 'dirt' },
  bricks: { side: 'stone_bricks', top: 'stone_bricks', bottom: 'stone_bricks' },
  path: { side: 'dirt', top: 'path', bottom: 'dirt' },
  gravel: { side: 'gravel', top: 'gravel', bottom: 'gravel' },
  snow: { side: 'snow', top: 'snow', bottom: 'snow' },
  dark: { side: 'dark_stone', top: 'dark_stone', bottom: 'dark_stone' },
  ember: { side: 'ember', top: 'ember', bottom: 'ember' },
  woolCream: { side: 'wool_cream', top: 'wool_cream', bottom: 'wool_cream' },
  woolTeal: { side: 'wool_teal', top: 'wool_teal', bottom: 'wool_teal' },
  crystal: { side: 'crystal', top: 'crystal', bottom: 'crystal' },
};

const geometryCache = new Map();
const materialCache = new Map();

export function blockGeometry(type) {
  if (geometryCache.has(type)) return geometryCache.get(type);
  const faces = BLOCK_FACES[type] || BLOCK_FACES.stone;
  const g = new THREE.BoxGeometry(1, 1, 1);
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  const tileByFace = [faces.side, faces.side, faces.top, faces.bottom, faces.side, faces.side];
  for (let face = 0; face < 6; face++) {
    const sub = new THREE.BoxGeometry(1, 1, 1);
    const src = sub.attributes.uv.array.slice(face * 8, face * 8 + 8);
    const dst = g.attributes.uv;
    const [col, row] = TILES[tileByFace[face]];
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      const u0 = src[v * 2];
      const v0 = src[v * 2 + 1];
      const u = (col * TILE + 0.5 + u0 * (TILE - 1)) / PX;
      const vv = 1 - (row * TILE + 0.5 + (1 - v0) * (TILE - 1)) / PX;
      dst.setXY(i, u, vv);
    }
    sub.dispose();
  }
  g.attributes.uv.needsUpdate = true;
  geometryCache.set(type, g);
  return g;
}

export function blockMaterial(atlasTexture, alphaTest = 0.35) {
  const key = `m${alphaTest}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const mat = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    alphaTest,
    transparent: false,
    side: THREE.FrontSide,
  });
  mat.name = 'voxelAtlas';
  materialCache.set(key, mat);
  return mat;
}

export function crossGeometry(tileName, width = 0.7, height = 0.75, yOffset = 0) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const [col, row] = TILES[tileName];
  const inset = 0.01;
  const u0 = col / COLS + inset;
  const u1 = (col + 1) / COLS - inset;
  const v0 = 1 - (row + 1) / ROWS + inset;
  const v1 = 1 - row / ROWS - inset;
  const hw = width / 2;
  const y0 = yOffset;
  const y1 = yOffset + height;
  const quads = [
    [[-hw, y0, 0], [hw, y0, 0], [hw, y1, 0], [-hw, y1, 0]],
    [[0, y0, -hw], [0, y0, hw], [0, y1, hw], [0, y1, -hw]],
  ];
  for (const q of quads) {
    const base = positions.length / 3;
    for (const p of q) positions.push(...p);
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
