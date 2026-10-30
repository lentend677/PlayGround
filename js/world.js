import * as THREE from 'three';
import { clamp, fbm2, mulberry32, rand, randInt, smoothstep } from './util.js';

const TEXTURE_SIZE = 16;
const textureCache = new Map();
const materialCache = new Map();

function seeded(seed) {
  return mulberry32(seed);
}

function makeCanvasTexture(key, draw) {
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

function speckle(ctx, random, colors, count, size = 1) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(random() * colors.length)];
    const s = size + (random() > 0.86 ? 1 : 0);
    ctx.fillRect(Math.floor(random() * 16), Math.floor(random() * 16), s, s);
  }
}

function grassTopTexture() {
  return makeCanvasTexture('grass-top', (ctx) => {
    const r = seeded(11);
    ctx.fillStyle = '#69b94b';
    ctx.fillRect(0, 0, 16, 16);
    speckle(ctx, r, ['#7acb58', '#5aa83f', '#86d464', '#4f9a36', '#94dd72'], 92);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = '#3f8c2d';
      ctx.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 2);
    }
  });
}

function grassSideTexture() {
  return makeCanvasTexture('grass-side', (ctx) => {
    const r = seeded(12);
    ctx.fillStyle = '#8d5b37';
    ctx.fillRect(0, 0, 16, 16);
    speckle(ctx, r, ['#9d6841', '#7a4b2c', '#a8744a', '#704226'], 62);
    ctx.fillStyle = '#6cbb4c';
    ctx.fillRect(0, 0, 16, 4);
    for (let x = 0; x < 16; x++) {
      const h = 1 + Math.floor(r() * 3);
      ctx.fillStyle = ['#5aa83f', '#7acb58', '#4f9a36'][Math.floor(r() * 3)];
      ctx.fillRect(x, 3, 1, h);
    }
  });
}

function dirtTexture() {
  return makeCanvasTexture('dirt', (ctx) => {
    const r = seeded(13);
    ctx.fillStyle = '#8b5a36';
    ctx.fillRect(0, 0, 16, 16);
    speckle(ctx, r, ['#9f6a40', '#75482b', '#a8744b', '#6b3f24', '#b07b50'], 80);
  });
}

function stoneTexture() {
  return makeCanvasTexture('stone', (ctx) => {
    const r = seeded(14);
    ctx.fillStyle = '#8f999b';
    ctx.fillRect(0, 0, 16, 16);
    speckle(ctx, r, ['#a2abad', '#7a8487', '#b4bdbe', '#6c7679', '#9aa4a6'], 74);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = '#6d777a';
      const x = Math.floor(r() * 14);
      const y = Math.floor(r() * 15);
      ctx.fillRect(x, y, 2 + Math.floor(r() * 3), 1);
    }
  });
}

function mossTexture() {
  return makeCanvasTexture('moss', (ctx) => {
    const r = seeded(15);
    ctx.fillStyle = '#768c62';
    ctx.fillRect(0, 0, 16, 16);
    speckle(ctx, r, ['#8aa26d', '#61794f', '#9bb37d', '#526b46'], 72);
  });
}

function sandTexture() {
  return makeCanvasTexture('sand', (ctx) => {
    const r = seeded(16);
    ctx.fillStyle = '#e5cf96';
    ctx.fillRect(0, 0, 16, 16);
    speckle(ctx, r, ['#f2e0ad', '#d5bd81', '#f8e8be', '#c8af75'], 90);
  });
}

function woodSideTexture() {
  return makeCanvasTexture('wood-side', (ctx) => {
    const r = seeded(17);
    ctx.fillStyle = '#7d522e';
    ctx.fillRect(0, 0, 16, 16);
    for (let x = 0; x < 16; x += 2) {
      ctx.fillStyle = x % 4 === 0 ? '#8f5e35' : '#704629';
      ctx.fillRect(x, 0, 1, 16);
    }
    speckle(ctx, r, ['#6b4225', '#9b693c', '#5f3a20'], 24);
  });
}

function woodTopTexture() {
  return makeCanvasTexture('wood-top', (ctx) => {
    const r = seeded(18);
    ctx.fillStyle = '#a77a49';
    ctx.fillRect(0, 0, 16, 16);
    ctx.strokeStyle = '#7c5532';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(8, 8, i * 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    speckle(ctx, r, ['#b78a56', '#8a6039'], 14);
  });
}

function leavesTexture() {
  return makeCanvasTexture('leaves', (ctx) => {
    const r = seeded(19);
    ctx.fillStyle = '#428c3b';
    ctx.fillRect(0, 0, 16, 16);
    speckle(ctx, r, ['#54a64a', '#34752f', '#68b85a', '#2b6528', '#7ac96a'], 105);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = '#1f5420';
      ctx.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1);
    }
  });
}

function planksTexture() {
  return makeCanvasTexture('planks', (ctx) => {
    const r = seeded(20);
    ctx.fillStyle = '#b47b47';
    ctx.fillRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y += 5) {
      ctx.fillStyle = '#8d5a31';
      ctx.fillRect(0, y, 16, 1);
      ctx.fillStyle = '#c68d55';
      ctx.fillRect(0, y + 1, 16, 1);
    }
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = '#9c6739';
      ctx.fillRect(Math.floor(r() * 14), Math.floor(r() * 16), 3, 1);
    }
  });
}

function roofTexture() {
  return makeCanvasTexture('roof', (ctx) => {
    const r = seeded(21);
    ctx.fillStyle = '#b85040';
    ctx.fillRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y += 4) {
      ctx.fillStyle = '#8f3b32';
      ctx.fillRect(0, y, 16, 1);
      for (let x = (y / 4) % 2 === 0 ? 0 : 3; x < 16; x += 6) {
        ctx.fillStyle = '#c7654e';
        ctx.fillRect(x, y + 1, 1, 3);
      }
    }
    speckle(ctx, r, ['#cf6d55', '#9e4136', '#d97c5f'], 20);
  });
}

function pathTexture() {
  return makeCanvasTexture('path', (ctx) => {
    const r = seeded(22);
    ctx.fillStyle = '#b49a68';
    ctx.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = ['#c9b07c', '#9f8659', '#d4bc87', '#8f774d'][Math.floor(r() * 4)];
      const x = Math.floor(r() * 12);
      const y = Math.floor(r() * 12);
      ctx.fillRect(x, y, 2 + Math.floor(r() * 3), 2 + Math.floor(r() * 2));
    }
  });
}

function snowTexture() {
  return makeCanvasTexture('snow', (ctx) => {
    const r = seeded(23);
    ctx.fillStyle = '#eef7f4';
    ctx.fillRect(0, 0, 16, 16);
    speckle(ctx, r, ['#ffffff', '#d9e8e7', '#c9dddf', '#f9ffff'], 42);
  });
}

function waterTexture() {
  return makeCanvasTexture('water', (ctx) => {
    const r = seeded(24);
    ctx.fillStyle = '#4fb7d4';
    ctx.fillRect(0, 0, 16, 16);
    speckle(ctx, r, ['#61c8df', '#3da4c5', '#7dd9ea', '#3196b8'], 58);
    ctx.fillStyle = '#9ce8f2';
    for (let i = 0; i < 5; i++) {
      const y = Math.floor(r() * 16);
      ctx.fillRect(Math.floor(r() * 9), y, 4 + Math.floor(r() * 4), 1);
    }
  });
}

function glowTexture() {
  return makeCanvasTexture('glow', (ctx) => {
    const r = seeded(25);
    ctx.fillStyle = '#ffd15c';
    ctx.fillRect(0, 0, 16, 16);
    speckle(ctx, r, ['#fff1a8', '#ffbe45', '#ffe07d', '#f7a92f'], 45);
  });
}

function lanternTexture() {
  return makeCanvasTexture('lantern', (ctx) => {
    const r = seeded(26);
    ctx.fillStyle = '#2c2119';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#ffb648';
    ctx.fillRect(2, 2, 12, 12);
    ctx.fillStyle = '#ffdc8a';
    ctx.fillRect(3, 3, 10, 10);
    speckle(ctx, r, ['#fff0b0', '#ffc766', '#ffb44a', '#ffe6a0'], 34);
    // Iron frame.
    ctx.fillStyle = '#241a13';
    ctx.fillRect(0, 0, 16, 2);
    ctx.fillRect(0, 14, 16, 2);
    ctx.fillRect(0, 0, 2, 16);
    ctx.fillRect(14, 0, 2, 16);
    ctx.fillRect(7, 0, 2, 16);
    ctx.fillRect(0, 7, 16, 2);
    // Warm top and bottom caps.
    ctx.fillStyle = '#6a4a2c';
    ctx.fillRect(2, 0, 12, 1);
    ctx.fillRect(2, 15, 12, 1);
  });
}

function grassTuftTexture() {
  return makeCanvasTexture('tuft', (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    const colors = ['#5aa83f', '#73c74e', '#4a9234', '#86d45e'];
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = colors[i % colors.length];
      const x = 2 + i * 1.5;
      const h = 5 + (i % 3) * 3;
      ctx.fillRect(Math.floor(x), 15 - h, 1, h);
    }
  });
}

function flowerTexture(key, petal, center) {
  return makeCanvasTexture(`flower-${key}`, (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#3e8b35';
    ctx.fillRect(7, 8, 2, 8);
    ctx.fillStyle = '#5aa843';
    ctx.fillRect(4, 11, 3, 1);
    ctx.fillRect(9, 10, 3, 1);
    ctx.fillStyle = petal;
    ctx.fillRect(5, 3, 3, 3);
    ctx.fillRect(9, 3, 3, 3);
    ctx.fillRect(7, 1, 3, 3);
    ctx.fillRect(7, 6, 3, 3);
    ctx.fillStyle = center;
    ctx.fillRect(7, 4, 3, 2);
  });
}

function makeBlockMaterials() {
  if (materialCache.has('all')) return materialCache.get('all');
  const grassTop = grassTopTexture();
  const grassSide = grassSideTexture();
  const dirt = dirtTexture();
  const stone = stoneTexture();
  const moss = mossTexture();
  const sand = sandTexture();
  const woodSide = woodSideTexture();
  const woodTop = woodTopTexture();
  const leaves = leavesTexture();
  const planks = planksTexture();
  const roof = roofTexture();
  const path = pathTexture();
  const snow = snowTexture();
  const water = waterTexture();
  const glow = glowTexture();
  const lantern = lanternTexture();

  const lambert = (map, extra = {}) => new THREE.MeshLambertMaterial({ map, ...extra });
  const six = (side, top, bottom = side) => [side, side, top, bottom, side, side];

  const mats = {
    grass: six(lambert(grassSide), lambert(grassTop), lambert(dirt)),
    dirt: lambert(dirt),
    stone: lambert(stone),
    moss: lambert(moss),
    sand: lambert(sand),
    wood: six(lambert(woodSide), lambert(woodTop), lambert(woodTop)),
    leaves: lambert(leaves),
    planks: lambert(planks),
    roof: lambert(roof),
    path: lambert(path),
    snow: lambert(snow),
    water: new THREE.MeshPhongMaterial({
      map: water,
      color: '#b9f4ff',
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      shininess: 95,
      specular: '#b8f2ff',
    }),
    glow: new THREE.MeshLambertMaterial({
      map: glow,
      emissive: '#ffb23d',
      emissiveIntensity: 0.45,
      color: '#ffe6a3',
    }),
    lantern: new THREE.MeshLambertMaterial({
      map: lantern,
      emissiveMap: lantern,
      emissive: '#ffbf68',
      emissiveIntensity: 0.85,
      color: '#fff1cf',
    }),
  };
  materialCache.set('all', mats);
  return mats;
}

const BLOCK_DEFS = {
  grass: { cap: 800, label: 'Grass', solid: true, pickable: true },
  dirt: { cap: 1100, label: 'Dirt', solid: true, pickable: true },
  stone: { cap: 5200, label: 'Stone', solid: true, pickable: true },
  moss: { cap: 260, label: 'Mossy stone', solid: true, pickable: true },
  sand: { cap: 500, label: 'Sand', solid: true, pickable: true },
  wood: { cap: 220, label: 'Oak log', solid: true, pickable: true },
  leaves: { cap: 650, label: 'Leaves', solid: false, pickable: true },
  planks: { cap: 260, label: 'Oak planks', solid: true, pickable: true },
  roof: { cap: 220, label: 'Clay roof', solid: true, pickable: true },
  path: { cap: 240, label: 'Cobble path', solid: true, pickable: true },
  snow: { cap: 120, label: 'Snow', solid: true, pickable: true },
  water: { cap: 360, label: 'Water', solid: true, pickable: false },
  glow: { cap: 90, label: 'Sunstone', solid: true, pickable: true },
  lantern: { cap: 50, label: 'Lantern', solid: true, pickable: true },
};

const BLOCK_DEBRIS_COLORS = {
  grass: ['#6cbc4b', '#8b5a36', '#5aa83f'],
  dirt: ['#8b5a36', '#9f6a40', '#704426'],
  stone: ['#98a2a4', '#737d80', '#b1babc'],
  moss: ['#7e9468', '#5d744b', '#94aa78'],
  sand: ['#e5cf96', '#f2e0ad', '#c8af75'],
  wood: ['#7d522e', '#a77a49', '#6b4225'],
  leaves: ['#428c3b', '#5aa843', '#2e702b'],
  planks: ['#b47b47', '#8d5a31', '#c68d55'],
  roof: ['#b85040', '#8f3b32', '#c7654e'],
  path: ['#b49a68', '#c9b07c', '#9f8659'],
  snow: ['#eef7f4', '#d9e8e7', '#ffffff'],
  water: ['#4fb7d4', '#7dd9ea', '#3da4c5'],
  glow: ['#ffd15c', '#fff1a8', '#f7a92f'],
  lantern: ['#ffd15c', '#ffe6a3', '#f7a92f'],
};

function makeCrossGeometry(width = 0.6, height = 0.6) {
  const g = new THREE.BufferGeometry();
  const hw = width / 2;
  const positions = new Float32Array([
    -hw, 0, 0, hw, 0, 0, hw, height, 0, -hw, height, 0,
    0, 0, -hw, 0, 0, hw, 0, height, hw, 0, height, -hw,
  ]);
  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
  ]);
  const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function makeSoftTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class VoxelWorld {
  constructor(scene, { mobile = false } = {}) {
    this.scene = scene;
    this.mobile = mobile;
    this.group = new THREE.Group();
    this.group.name = 'voxel-island';
    scene.add(this.group);

    this.materials = makeBlockMaterials();
    this.meshes = {};
    this.pickMeshes = [];
    this.blockMap = new Map();
    this.topMap = new Map();
    this.dummy = new THREE.Object3D();
    this.debris = [];
    this.lanterns = [];
    this.pointLights = [];
    this.smokeOrigins = [];
    this.waterMeshes = [];
    this.emissiveMaterials = [];
    this.haloSprites = [];
    this.tmpColor = new THREE.Color();
    this._rand = mulberry32(73);

    this.buildMeshes();
    this.generateIsland();
    this.decorate();
    this.buildFoliage();
    this.buildParticles();
    this.buildFireflies();
    this.buildDebris();
    this.update(0, 0, 0);
  }

  buildMeshes() {
    for (const [type, def] of Object.entries(BLOCK_DEFS)) {
      const material = this.materials[type];
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, def.cap);
      mesh.count = 0;
      mesh.userData.type = type;
      mesh.userData.keys = new Array(def.cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = type !== 'water' && type !== 'glow' && type !== 'lantern';
      mesh.receiveShadow = type !== 'water' && type !== 'glow';
      if (type === 'water') {
        mesh.renderOrder = 3;
        this.waterMeshes.push(mesh);
      }
      if (type === 'glow' || type === 'lantern') {
        this.emissiveMaterials.push(material);
      }
      this.meshes[type] = mesh;
      this.group.add(mesh);
      if (def.pickable) this.pickMeshes.push(mesh);
    }
  }

  generateIsland() {
    const R = 13.1;
    this.islandRadius = R;
    this.heightCache = new Map();

    const coastAt = (angle) => R + Math.sin(angle * 3.1 + 1.7) * 0.95 + Math.sin(angle * 7.3 - 0.5) * 0.42;
    const distanceTo = (x, z, cx, cz) => Math.hypot(x - cx, z - cz);

    const rawHeight = (x, z) => {
      const r = Math.hypot(x, z);
      const angle = Math.atan2(z, x);
      const coast = coastAt(angle);
      if (r > coast) return null;
      const n1 = fbm2(x * 0.18 + 3.2, z * 0.18 - 1.4, 8, 3);
      const n2 = fbm2(x * 0.43 - 2.2, z * 0.43 + 5.1, 22, 2);
      let h = 1.05 + n1 * 4.3 + n2 * 1.2;
      h += 3.15 * Math.exp(-((x + 5.1) ** 2 + (z + 4.4) ** 2) / 26);
      h = THREE.MathUtils.lerp(h, 3.0, smoothstep(5.2, 1.5, distanceTo(x, z, -4, -4)));
      h = THREE.MathUtils.lerp(h, 2.35, smoothstep(5.8, 1.9, distanceTo(x, z, 1.2, 7.2)));
      const pondDist = distanceTo(x, z, 5.6, 3.5);
      if (pondDist < 3.05) h = Math.min(h, 1.15);
      if (z === 4 && x >= 7 && x <= 12) h = Math.min(h, 1.15);
      h -= smoothstep(coast - 3.6, coast, r) * 2.7;
      return Math.max(0, Math.round(h));
    };

    for (let x = -15; x <= 15; x++) {
      for (let z = -15; z <= 15; z++) {
        const top = rawHeight(x, z);
        if (top === null) continue;
        this.heightCache.set(`${x},${z}`, top);
        const r = Math.hypot(x, z);
        const inPond = distanceTo(x, z, 5.6, 3.5) < 2.85;
        const inStream = z === 4 && x >= 7 && x <= 12;
        const baseType = top <= 1 ? 'sand' : 'grass';

        for (let y = top; y >= -11; y--) {
          if (y < 0) {
            const taper = R * (1 + y * 0.071);
            const wobble = (fbm2(x * 0.3 + 4, z * 0.3 - 2, 31, 2) - 0.5) * 2.2;
            if (r > taper + wobble) continue;
          }
          let type;
          if (y === top) type = baseType;
          else if (y >= top - 3) type = baseType === 'sand' ? 'sand' : 'dirt';
          else type = 'stone';
          if (type === 'stone' && y < -3) {
            const mossy = fbm2(x * 0.45 + 8, z * 0.45 + 3, 44, 2);
            if (mossy > 0.76) type = 'moss';
          }
          this.addBlock(type, x, y, z, {
            tint: this.tintFor(type),
          });
        }

        if (inPond || inStream) {
          this.addBlock('water', x, 2, z, { tint: '#ffffff' });
        }
      }
    }

    // The stream tumbles over the eastern rim.
    for (let y = 1; y >= -9; y--) {
      this.addBlock('water', 13, y, 4, { tint: '#ffffff' });
      if (y < 0) this.addBlock('water', 14, y + 1, 4, { tint: '#ffffff' });
    }

    // Path from the dock, up the meadow, to the cabin door.
    const pathPoints = [
      [1.2, 9.2], [0.6, 7.8], [0.1, 6.4], [-0.3, 5.0], [-0.8, 3.7],
      [-1.3, 2.3], [-1.8, 0.9], [-2.3, -0.4], [-2.7, -1.8], [-3.2, -2.6],
    ];
    for (let i = 0; i < pathPoints.length; i++) {
      const [px, pz] = pathPoints[i];
      const x = Math.round(px);
      const z = Math.round(pz);
      const top = this.getTopY(x, z);
      if (top !== null) this.setBlock('path', x, top, z, { tint: this.tintFor('path') });
      if (i % 2 === 0) {
        const side = i % 4 === 0 ? 1 : -1;
        const sx = x + side;
        const stop = this.getTopY(sx, z);
        if (stop !== null && stop === top) this.setBlock('path', sx, stop, z, { tint: this.tintFor('path') });
      }
    }

    // A little sandy clearing around the pond.
    for (let x = 1; x <= 10; x++) {
      for (let z = -1; z <= 8; z++) {
        if (Math.hypot(x - 5.6, z - 3.5) < 3.75) {
          const top = this.getTopY(x, z);
          if (top !== null && top > 1) this.setBlock('sand', x, top, z, { tint: this.tintFor('sand') });
        }
      }
    }

    // Hanging vines and glowing underside details.
    const random = mulberry32(919);
    for (let i = 0; i < 34; i++) {
      const angle = random() * Math.PI * 2;
      const r = 9 + random() * 4;
      const x = Math.round(Math.cos(angle) * r);
      const z = Math.round(Math.sin(angle) * r);
      const top = this.getTopY(x, z);
      if (top === null) continue;
      let y = top;
      while (y > -9 && this.getBlock(x, y, z)) y--;
      const length = 1 + Math.floor(random() * 3);
      for (let k = 1; k <= length; k++) {
        if (!this.getBlock(x, y - k, z)) this.addBlock('leaves', x, y - k, z, { tint: '#8ecc7c' });
      }
    }
    for (let i = 0; i < 7; i++) {
      const angle = random() * Math.PI * 2;
      const r = 1.5 + random() * 3.5;
      this.addBlock('glow', Math.round(Math.cos(angle) * r), -6 - Math.floor(random() * 3), Math.round(Math.sin(angle) * r), { tint: '#ffffff' });
    }
  }

  tintFor(type) {
    const r = this._rand;
    if (type === 'leaves') {
      const v = 0.82 + r() * 0.28;
      return new THREE.Color(v * 0.9, v, v * 0.82);
    }
    if (type === 'grass') {
      const v = 0.9 + r() * 0.14;
      return new THREE.Color(v, v * (0.96 + r() * 0.06), v * 0.9);
    }
    if (type === 'stone' || type === 'moss') {
      const v = 0.87 + r() * 0.19;
      return new THREE.Color(v, v, v);
    }
    if (type === 'water') return new THREE.Color(1, 1, 1);
    const v = 0.93 + r() * 0.12;
    return new THREE.Color(v, v, v);
  }

  addBlock(type, x, y, z, { tint = null, scale = 1 } = {}) {
    const def = BLOCK_DEFS[type];
    if (!def) return false;
    const key = `${x},${y},${z}`;
    if (this.blockMap.has(key)) return false;
    const mesh = this.meshes[type];
    if (!mesh || mesh.count >= def.cap) return false;
    const index = mesh.count++;
    const i3 = index * 3;
    this.dummy.position.set(x, y - (1 - scale) * 0.5, z);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(index, this.dummy.matrix);
    if (!mesh.instanceColor) {
      const colors = new Float32Array(def.cap * 3);
      colors.fill(1);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    }
    const c = tint ? this.tmpColor.set(tint) : this.tmpColor.setRGB(1, 1, 1);
    mesh.setColorAt(index, c);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.userData.keys[index] = key;
    this.blockMap.set(key, { type, mesh, index });
    if (def.solid) {
      const topKey = `${x},${z}`;
      const old = this.topMap.get(topKey);
      if (old === undefined || y > old) this.topMap.set(topKey, y);
    }
    return true;
  }

  setBlock(type, x, y, z, opts) {
    const key = `${x},${y},${z}`;
    const existing = this.blockMap.get(key);
    if (existing) {
      if (existing.type === type) return true;
      this.removeBlock(key);
    }
    return this.addBlock(type, x, y, z, opts);
  }

  removeBlock(key) {
    const entry = this.blockMap.get(key);
    if (!entry) return null;
    const { type, mesh, index } = entry;
    const last = mesh.count - 1;
    const lastKey = mesh.userData.keys[last];
    if (index !== last) {
      this.dummy.position.set(0, 0, 0);
      mesh.getMatrixAt(last, this.dummy.matrix);
      mesh.setMatrixAt(index, this.dummy.matrix);
      const color = new THREE.Color();
      mesh.getColorAt(last, color);
      mesh.setColorAt(index, color);
      mesh.userData.keys[index] = lastKey;
      const moved = this.blockMap.get(lastKey);
      if (moved) moved.index = index;
    }
    mesh.userData.keys[last] = undefined;
    mesh.count = last;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.blockMap.delete(key);
    const [x, y, z] = key.split(',').map(Number);
    this.recomputeTop(x, z);
    return type;
  }

  recomputeTop(x, z) {
    const topKey = `${x},${z}`;
    for (let y = 18; y >= -12; y--) {
      const entry = this.blockMap.get(`${x},${y},${z}`);
      if (entry && BLOCK_DEFS[entry.type]?.solid) {
        this.topMap.set(topKey, y);
        return;
      }
    }
    this.topMap.delete(topKey);
  }

  getBlock(x, y, z) {
    return this.blockMap.get(`${x},${y},${z}`) || null;
  }

  getLabel(type) {
    return BLOCK_DEFS[type]?.label || type;
  }

  getTopY(x, z) {
    const value = this.topMap.get(`${x},${z}`);
    return value === undefined ? null : value;
  }

  getWalkHeight(x, z) {
    const x0 = Math.round(x);
    const z0 = Math.round(z);
    let best = null;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const top = this.topMap.get(`${x0 + dx},${z0 + dz}`);
        if (top !== undefined) {
          const h = top + 1;
          if (best === null || h > best) best = h;
        }
      }
    }
    return best;
  }

  isInside(x, z, pad = 0) {
    return Math.hypot(x, z) <= this.islandRadius + pad;
  }

  getSurfaceCenter(x, z) {
    const top = this.getTopY(Math.round(x), Math.round(z));
    return top === null ? null : new THREE.Vector3(x, top + 1, z);
  }

  addTree(x, z, height = 4, canopy = 2.2, tint = null) {
    const top = this.getTopY(x, z);
    if (top === null) return;
    const base = top + 1;
    for (let i = 0; i < height; i++) {
      this.addBlock('wood', x, base + i, z, { tint: this.tintFor('wood') });
    }
    const crownY = base + height - 1;
    const r = Math.ceil(canopy);
    for (let dy = 0; dy <= r + 1; dy++) {
      const layer = dy === 0 ? canopy * 0.62 : dy >= r ? canopy * 0.42 : canopy * (0.98 - dy * 0.1);
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          const dist = Math.hypot(dx, dz);
          if (dist > layer) continue;
          if (dx === 0 && dz === 0 && dy < height) continue;
          if (dist > layer - 0.6 && this._rand() < 0.34) continue;
          const yy = crownY + dy;
          if (!this.getBlock(x + dx, yy, z + dz)) {
            const leafTint = tint || this.tintFor('leaves');
            this.addBlock('leaves', x + dx, yy, z + dz, { tint: leafTint });
          }
        }
      }
    }
  }

  addRock(x, z, size = 2) {
    const top = this.getTopY(x, z);
    if (top === null) return;
    const random = mulberry32(x * 93 + z * 31 + 5);
    const count = 2 + Math.floor(random() * size);
    for (let i = 0; i < count; i++) {
      const dx = Math.round((random() - 0.5) * 2.2);
      const dz = Math.round((random() - 0.5) * 2.2);
      const t = this.getTopY(x + dx, z + dz);
      if (t === null) continue;
      this.addBlock(random() > 0.82 ? 'moss' : 'stone', x + dx, t + 1, z + dz, { tint: this.tintFor('stone') });
      if (random() > 0.7) this.addBlock('stone', x + dx, t + 2, z + dz, { tint: this.tintFor('stone') });
    }
  }

  addLantern(x, z, postHeight = 2) {
    const top = this.getTopY(x, z);
    if (top === null) return;
    for (let i = 1; i <= postHeight; i++) {
      this.addBlock('wood', x, top + i, z, { tint: this.tintFor('wood') });
    }
    this.addBlock('lantern', x, top + postHeight + 1, z, { tint: '#ffffff', scale: 0.72 });
    const y = top + postHeight + 1;
    const light = new THREE.PointLight('#ffb65c', 0, 8.5, 1.8);
    light.position.set(x, y + 0.2, z);
    this.group.add(light);
    this.pointLights.push({ light, base: 2.6, night: 1 });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeSoftTexture(),
      color: '#ffc164',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    halo.scale.setScalar(3.4);
    halo.position.set(x, y, z);
    this.group.add(halo);
    this.haloSprites.push(halo);
    this.lanterns.push(new THREE.Vector3(x, y, z));
  }

  addHouse() {
    const cx = -4;
    const cz = -4;
    const top = this.getTopY(cx, cz);
    if (top === null) return;
    const floor = top;
    const x0 = cx - 2;
    const x1 = cx + 2;
    const z0 = cz - 2;
    const z1 = cz + 1;

    // Floor
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        this.setBlock('planks', x, floor, z, { tint: this.tintFor('planks') });
      }
    }

    // Walls and corner posts
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const edge = x === x0 || x === x1 || z === z0 || z === z1;
        if (!edge) continue;
        const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
        for (let y = floor + 1; y <= floor + 3; y++) {
          const door = z === z1 && x === cx && y <= floor + 2;
          if (door) continue;
          const window = y === floor + 2 && (
            (x === x0 || x === x1) && z === cz
          );
          if (window) {
            this.addBlock('glow', x, y, z, { tint: '#fff0bd' });
          } else {
            this.addBlock(corner ? 'wood' : 'planks', x, y, z, { tint: this.tintFor(corner ? 'wood' : 'planks') });
          }
        }
      }
    }

    // A stepped gable roof.
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      for (let z = z0 - 1; z <= z1 + 1; z++) {
        if (x === x0 - 1 || x === x1 + 1 || z === z0 - 1 || z === z1 + 1) {
          this.addBlock('roof', x, floor + 4, z, { tint: this.tintFor('roof') });
        }
      }
    }
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        this.addBlock('roof', x, floor + 5, z, { tint: this.tintFor('roof') });
      }
    }
    for (let x = x0 + 1; x <= x1 - 1; x++) {
      for (let z = z0 + 1; z <= z1 - 1; z++) {
        this.addBlock('roof', x, floor + 6, z, { tint: this.tintFor('roof') });
      }
    }
    // Chimney
    for (let y = floor + 4; y <= floor + 8; y++) {
      this.addBlock('stone', x0 + 1, y, z0 + 1, { tint: this.tintFor('stone') });
    }
    this.smokeOrigins.push(new THREE.Vector3(x0 + 1, floor + 9.1, z0 + 1));

    // Porch and a warm porch lantern.
    for (let x = cx - 1; x <= cx + 1; x++) {
      this.setBlock('planks', x, floor, z1 + 1, { tint: this.tintFor('planks') });
    }
    this.addBlock('wood', cx - 1, floor + 1, z1 + 1, { tint: this.tintFor('wood') });
    this.addBlock('lantern', cx - 1, floor + 2, z1 + 1, { tint: '#ffffff', scale: 0.72 });
    const porchLight = new THREE.PointLight('#ffb45a', 0, 7.5, 1.8);
    porchLight.position.set(cx - 1, floor + 2.2, z1 + 1.2);
    this.group.add(porchLight);
    this.pointLights.push({ light: porchLight, base: 2.2, night: 1 });
    this.lanterns.push(new THREE.Vector3(cx - 1, floor + 2, z1 + 1));

    const insideLight = new THREE.PointLight('#ffb45a', 0, 8, 1.7);
    insideLight.position.set(cx, floor + 2.2, cz);
    this.group.add(insideLight);
    this.pointLights.push({ light: insideLight, base: 1.4, night: 1 });

    // A path stone right at the door.
    this.setBlock('path', cx, floor, z1 + 2, { tint: this.tintFor('path') });
  }

  addCampfire() {
    const x = 3;
    const z = 1;
    const top = this.getTopY(x, z);
    if (top === null) return;
    const y = top + 1;
    const logs = new THREE.Group();
    const logMat = new THREE.MeshLambertMaterial({ color: '#6e4528' });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 1.25), logMat);
      log.rotation.y = (i / 4) * Math.PI;
      log.rotation.x = 0.16;
      log.position.y = 0.15;
      log.castShadow = true;
      logs.add(log);
    }
    const ember = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, 0.34),
      new THREE.MeshBasicMaterial({ color: '#ff9d3e', toneMapped: false }),
    );
    ember.position.y = 0.25;
    logs.add(ember);
    logs.position.set(x, y, z);
    this.group.add(logs);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.65, 0.12, 5, 12),
      new THREE.MeshLambertMaterial({ color: '#8a9597' }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y + 0.08, z);
    ring.receiveShadow = true;
    this.group.add(ring);

    const light = new THREE.PointLight('#ff9d4e', 0, 8, 1.9);
    light.position.set(x, y + 0.8, z);
    this.group.add(light);
    this.pointLights.push({ light, base: 2.3, night: 1 });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeSoftTexture(),
      color: '#ff9b46',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    halo.scale.setScalar(2.5);
    halo.position.set(x, y + 0.5, z);
    this.group.add(halo);
    this.haloSprites.push(halo);
    this.smokeOrigins.push(new THREE.Vector3(x, y + 1.1, z));
  }

  addDock() {
    const zStart = 9;
    const zEnd = 15;
    for (let z = zStart; z <= zEnd; z++) {
      for (let x = -1; x <= 1; x++) {
        const top = this.getTopY(x, z) ?? 2;
        this.setBlock('planks', x, top, z, { tint: this.tintFor('planks') });
        if (z === zEnd) {
          this.addBlock('wood', x, top - 1, z, { tint: this.tintFor('wood') });
          this.addBlock('wood', x, top - 2, z, { tint: this.tintFor('wood') });
        }
      }
    }
    this.addLantern(1, zEnd, 1);
  }

  decorate() {
    // Landmarks around the meadow.
    this.addTree(-7, 2, 5, 2.35);
    this.addTree(7, -6, 4, 1.9);
    this.addTree(-1, -8, 3, 1.5);
    this.addTree(-8, -5, 4, 1.7);
    this.addTree(9, 8, 3, 1.35);
    this.addRock(-9, 6, 3);
    this.addRock(8, -2, 2);
    this.addRock(-2, 5, 2);
    this.addRock(10, 1, 2);
    this.addRock(4, -8, 2);

    this.addHouse();
    this.addCampfire();
    this.addDock();
    this.addLantern(-2, 4, 2);
    this.addLantern(0, 2, 1);

    // A tiny garden of flowers is scattered over open grass.
    this.flowerSpots = [];
    const random = mulberry32(177);
    const blocked = new Set(['-4,-4', '-3,-4', '3,1', '5,3', '1,9', '0,9']);
    for (let i = 0; i < 80 && this.flowerSpots.length < 34; i++) {
      const x = Math.round((random() - 0.5) * 20);
      const z = Math.round((random() - 0.5) * 20);
      const key = `${x},${z}`;
      if (blocked.has(key)) continue;
      const top = this.getTopY(x, z);
      if (top === null) continue;
      if (this.getBlock(x, top + 1, z)) continue;
      if (top <= 1) continue;
      const existing = this.blockMap.get(`${x},${top},${z}`);
      if (!existing || existing.type !== 'grass') continue;
      this.flowerSpots.push({ x, z, y: top + 1, variant: Math.floor(random() * 3) });
    }

    // Small floating islets give the sky depth.
    this.addIslet(22, 7, -11, 3.7);
    this.addIslet(-20, 11, 8, 3.0);
    this.addIslet(13, 16, -22, 2.2);
  }

  addIslet(cx, cy, cz, radius) {
    const random = mulberry32(cx * 13 + cy * 71 + cz * 37 + 100);
    const topRadius = Math.ceil(radius);
    for (let x = -topRadius; x <= topRadius; x++) {
      for (let z = -topRadius; z <= topRadius; z++) {
        const dist = Math.hypot(x, z);
        if (dist > radius + (random() - 0.5) * 0.8) continue;
        const top = cy + Math.round((1 - dist / radius) * 1.8);
        const bottom = cy - 2 - Math.floor(random() * 3);
        for (let y = top; y >= bottom; y--) {
          if (y < cy && dist > radius * (1 - (cy - y) * 0.16)) continue;
          const type = y === top ? 'grass' : y >= top - 1 ? 'dirt' : 'stone';
          this.addBlock(type, cx + x, y, cz + z, { tint: this.tintFor(type) });
        }
      }
    }
    if (radius > 2.5) {
      this.addTree(cx, cz, 3, 1.35);
    } else {
      this.addBlock('glow', cx, cy + 2, cz, { tint: '#ffffff' });
    }
  }

  buildFoliage() {
    const tuftTex = grassTuftTexture();
    const tuftMat = new THREE.MeshLambertMaterial({
      map: tuftTex,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      transparent: false,
    });
    const cross = makeCrossGeometry(0.62, 0.58);
    const tuftCount = this.mobile ? 55 : 95;
    this.tufts = new THREE.InstancedMesh(cross, tuftMat, tuftCount);
    this.tufts.count = 0;
    this.tufts.frustumCulled = false;
    this.tufts.castShadow = false;
    this.tufts.receiveShadow = false;
    this.tufts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.tufts);
    const random = mulberry32(313);
    for (let i = 0; i < tuftCount * 2 && this.tufts.count < tuftCount; i++) {
      const x = Math.round((random() - 0.5) * 21);
      const z = Math.round((random() - 0.5) * 21);
      const top = this.getTopY(x, z);
      if (top === null || top <= 1) continue;
      if (this.getBlock(x, top + 1, z)) continue;
      const entry = this.blockMap.get(`${x},${top},${z}`);
      if (!entry || entry.type !== 'grass') continue;
      this.dummy.position.set(x + (random() - 0.5) * 0.6, top + 1, z + (random() - 0.5) * 0.6);
      this.dummy.rotation.set(0, random() * Math.PI, 0);
      this.dummy.scale.setScalar(0.7 + random() * 0.55);
      this.dummy.updateMatrix();
      this.tufts.setMatrixAt(this.tufts.count++, this.dummy.matrix);
    }
    this.tufts.instanceMatrix.needsUpdate = true;

    const flowerColors = [
      { key: 'poppy', petal: '#e85c4a', center: '#ffd45c' },
      { key: 'daisy', petal: '#f7f1d2', center: '#ffc84d' },
      { key: 'cornflower', petal: '#7fa9ff', center: '#ffe9a6' },
    ];
    this.flowerMeshes = [];
    for (let v = 0; v < 3; v++) {
      const tex = flowerTexture(flowerColors[v].key, flowerColors[v].petal, flowerColors[v].center);
      const mat = new THREE.MeshLambertMaterial({
        map: tex,
        alphaTest: 0.38,
        side: THREE.DoubleSide,
        transparent: false,
      });
      const geo = makeCrossGeometry(0.55, 0.62);
      const mesh = new THREE.InstancedMesh(geo, mat, 14);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.group.add(mesh);
      this.flowerMeshes.push(mesh);
    }
    for (const spot of this.flowerSpots) {
      const mesh = this.flowerMeshes[spot.variant % 3];
      if (mesh.count >= 14) continue;
      this.dummy.position.set(spot.x, spot.y, spot.z);
      this.dummy.rotation.set(0, (spot.x * 0.73 + spot.z * 1.19) % Math.PI, 0);
      this.dummy.scale.setScalar(0.85 + (spot.z % 3) * 0.08);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(mesh.count++, this.dummy.matrix);
    }
    for (const mesh of this.flowerMeshes) mesh.instanceMatrix.needsUpdate = true;

    // Falling-petal-like motes: a few tiny luminous specks in the air.
    const moteCount = this.mobile ? 24 : 40;
    const positions = new Float32Array(moteCount * 3);
    const random2 = mulberry32(818);
    for (let i = 0; i < moteCount; i++) {
      positions[i * 3] = (random2() - 0.5) * 24;
      positions[i * 3 + 1] = 2 + random2() * 9;
      positions[i * 3 + 2] = (random2() - 0.5) * 24;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.075,
      color: '#fff3c4',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }));
    this.motes.frustumCulled = false;
    this.group.add(this.motes);
    this.moteBase = positions.slice();
  }

  buildParticles() {
    // Smoke rising from the chimney and campfire.
    const smokeCount = 48;
    const positions = new Float32Array(smokeCount * 3);
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const smokeMat = new THREE.PointsMaterial({
      size: 1.15,
      map: makeSoftTexture(),
      color: '#d4ded8',
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.smoke = new THREE.Points(smokeGeo, smokeMat);
    this.smoke.frustumCulled = false;
    this.group.add(this.smoke);
    this.smokeParticles = Array.from({ length: smokeCount }, (_, i) => ({
      origin: this.smokeOrigins[i % this.smokeOrigins.length] || new THREE.Vector3(0, 5, 0),
      life: (i / smokeCount) * 5,
      maxLife: 5 + (i % 5) * 0.5,
      drift: ((i % 7) - 3) * 0.03,
      phase: i * 0.7,
    }));

    // A soft mist at the foot of the waterfall.
    const mistCount = 26;
    const mistPositions = new Float32Array(mistCount * 3);
    const random = mulberry32(515);
    for (let i = 0; i < mistCount; i++) {
      mistPositions[i * 3] = 13.3 + (random() - 0.5) * 2.2;
      mistPositions[i * 3 + 1] = -8.5 + (random() - 0.5) * 1.6;
      mistPositions[i * 3 + 2] = 4 + (random() - 0.5) * 2.4;
    }
    const mistGeo = new THREE.BufferGeometry();
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
    this.mist = new THREE.Points(mistGeo, new THREE.PointsMaterial({
      size: 1.6,
      map: makeSoftTexture(),
      color: '#d7f7ff',
      transparent: true,
      opacity: 0.23,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }));
    this.mist.frustumCulled = false;
    this.group.add(this.mist);
  }

  buildFireflies() {
    const count = this.mobile ? 34 : 58;
    const positions = new Float32Array(count * 3);
    const random = mulberry32(612);
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const r = 2 + random() * 10;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = 2.5 + random() * 5.5;
      positions[i * 3 + 2] = Math.sin(angle) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.fireflyMaterial = new THREE.PointsMaterial({
      size: 0.12,
      color: '#ffe887',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.fireflies = new THREE.Points(geo, this.fireflyMaterial);
    this.fireflies.frustumCulled = false;
    this.group.add(this.fireflies);
    this.fireflyBase = positions.slice();
  }

  buildDebris() {
    const cap = 90;
    const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    this.debrisMesh = new THREE.InstancedMesh(geo, mat, cap);
    this.debrisMesh.count = cap;
    this.debrisMesh.frustumCulled = false;
    this.debrisMesh.castShadow = false;
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const colors = new Float32Array(cap * 3);
    colors.fill(1);
    this.debrisMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    this.group.add(this.debrisMesh);
    this.debris = Array.from({ length: cap }, () => ({
      active: false, life: 0, maxLife: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
      rot: new THREE.Euler(), spin: new THREE.Vector3(), scale: 1,
    }));
    this.debrisCursor = 0;
    this.debrisDummy = new THREE.Object3D();
    this.hideAllDebris();
  }

  hideAllDebris() {
    this.debrisDummy.position.set(0, -1000, 0);
    this.debrisDummy.scale.setScalar(0.0001);
    this.debrisDummy.updateMatrix();
    for (let i = 0; i < this.debris.length; i++) this.debrisMesh.setMatrixAt(i, this.debrisDummy.matrix);
    this.debrisMesh.instanceMatrix.needsUpdate = true;
  }

  spawnDebris(x, y, z, type) {
    const palette = BLOCK_DEBRIS_COLORS[type] || ['#ffffff'];
    for (let i = 0; i < 12; i++) {
      const p = this.debris[this.debrisCursor];
      this.debrisCursor = (this.debrisCursor + 1) % this.debris.length;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.55 + Math.random() * 0.55;
      p.pos.set(x + (Math.random() - 0.5) * 0.6, y + 0.2 + Math.random() * 0.6, z + (Math.random() - 0.5) * 0.6);
      p.vel.set((Math.random() - 0.5) * 3.4, 2.2 + Math.random() * 3.4, (Math.random() - 0.5) * 3.4);
      p.rot.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      p.spin.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
      p.scale = 0.65 + Math.random() * 0.8;
      this.debrisMesh.setColorAt(this.debris.indexOf(p), new THREE.Color(palette[Math.floor(Math.random() * palette.length)]));
    }
    this.debrisMesh.instanceColor.needsUpdate = true;
  }

  pick(raycaster, reach = null, origin = null) {
    const hits = raycaster.intersectObjects(this.pickMeshes, false);
    for (const hit of hits) {
      const mesh = hit.object;
      const instanceId = hit.instanceId;
      if (instanceId === undefined) continue;
      const key = mesh.userData.keys[instanceId];
      if (!key) continue;
      const [x, y, z] = key.split(',').map(Number);
      let distance = hit.distance;
      if (reach !== null && origin) {
        distance = Math.hypot(hit.point.x - origin.x, hit.point.y - origin.y, hit.point.z - origin.z);
        if (distance > reach) continue;
      }
      return {
        key,
        x, y, z,
        type: mesh.userData.type,
        point: hit.point.clone(),
        normal: hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0),
        distance,
        instanceId,
      };
    }
    return null;
  }

  update(dt, elapsed, night) {
    this.time = elapsed;
    for (const mat of this.emissiveMaterials) {
      mat.emissiveIntensity = 0.32 + night * 1.8;
    }
    for (const item of this.pointLights) {
      item.light.intensity = item.base * (0.05 + night * 0.95);
    }
    for (const halo of this.haloSprites) {
      halo.material.opacity = night * 0.32;
    }
    if (this.waterMeshes.length) {
      for (const mesh of this.waterMeshes) {
        const map = mesh.material.map;
        if (map) {
          map.offset.x = (elapsed * 0.035) % 1;
          map.offset.y = Math.sin(elapsed * 0.42) * 0.045;
        }
      }
    }
    if (this.fireflyMaterial) {
      this.fireflyMaterial.opacity = night * 0.9;
      this.fireflies.visible = night > 0.02;
      if (this.fireflies.visible) {
        const pos = this.fireflies.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const ix = i * 3;
          pos.array[ix] = this.fireflyBase[ix] + Math.sin(elapsed * 0.45 + i * 1.7) * 0.6;
          pos.array[ix + 1] = this.fireflyBase[ix + 1] + Math.sin(elapsed * 0.7 + i * 2.3) * 0.35;
          pos.array[ix + 2] = this.fireflyBase[ix + 2] + Math.cos(elapsed * 0.4 + i * 1.2) * 0.6;
        }
        pos.needsUpdate = true;
      }
    }
    if (this.motes) {
      this.motes.rotation.y = elapsed * 0.012;
      this.motes.material.opacity = 0.26 + Math.sin(elapsed * 0.3) * 0.06;
    }
    if (this.smoke) {
      const pos = this.smoke.geometry.attributes.position;
      for (let i = 0; i < this.smokeParticles.length; i++) {
        const p = this.smokeParticles[i];
        p.life += dt;
        if (p.life > p.maxLife) p.life = 0;
        const k = p.life / p.maxLife;
        pos.array[i * 3] = p.origin.x + Math.sin(elapsed * 0.6 + p.phase) * 0.22 + k * 0.6;
        pos.array[i * 3 + 1] = p.origin.y + k * 3.8;
        pos.array[i * 3 + 2] = p.origin.z + Math.cos(elapsed * 0.5 + p.phase) * 0.22 + k * 0.3;
      }
      pos.needsUpdate = true;
      this.smoke.material.opacity = 0.1 + night * 0.12;
    }
    if (this.mist) {
      this.mist.rotation.y = Math.sin(elapsed * 0.12) * 0.15;
      this.mist.material.opacity = 0.18 + Math.sin(elapsed * 0.5) * 0.04;
    }
    this.updateDebris(dt);
  }

  updateDebris(dt) {
    let any = false;
    for (let i = 0; i < this.debris.length; i++) {
      const p = this.debris[i];
      if (!p.active) continue;
      any = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.debrisDummy.position.set(0, -1000, 0);
        this.debrisDummy.scale.setScalar(0.0001);
        this.debrisDummy.updateMatrix();
        this.debrisMesh.setMatrixAt(i, this.debrisDummy.matrix);
        continue;
      }
      p.vel.y -= 13 * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      const fade = 1 - p.life / p.maxLife;
      this.debrisDummy.position.copy(p.pos);
      this.debrisDummy.rotation.copy(p.rot);
      this.debrisDummy.scale.setScalar(Math.max(0.001, p.scale * (0.35 + fade * 0.65)));
      this.debrisDummy.updateMatrix();
      this.debrisMesh.setMatrixAt(i, this.debrisDummy.matrix);
    }
    if (any) this.debrisMesh.instanceMatrix.needsUpdate = true;
  }

  findPlacement(target, playerPos) {
    let x;
    let y;
    let z;
    if (target) {
      x = target.x + Math.round(target.normal.x);
      y = target.y + Math.round(target.normal.y);
      z = target.z + Math.round(target.normal.z);
    } else {
      const dir = new THREE.Vector3();
      const yaw = playerPos.yaw ?? 0;
      dir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      x = Math.round(playerPos.x + dir.x * 2.4);
      z = Math.round(playerPos.z + dir.z * 2.4);
      const top = this.getTopY(x, z);
      y = top === null ? Math.round(playerPos.y) : top + 1;
    }
    if (this.blockMap.has(`${x},${y},${z}`)) {
      y += 1;
    }
    if (y < -11 || y > 22) return null;
    if (Math.abs(x) > 26 || Math.abs(z) > 26) return null;
    return { x, y, z };
  }
}
