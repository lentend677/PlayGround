/* ==========================================================================
   VOXEL ISLE
   A hand-built little world in the clouds — Three.js, no build step.
   ========================================================================== */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));

  const canvas = document.getElementById('scene');
  const boot = document.getElementById('boot');
  const bootBar = document.getElementById('bootBar');
  const bootStatus = document.getElementById('bootStatus');
  const clockEl = document.getElementById('clock');
  const phaseEl = document.getElementById('phase');
  const speedEl = document.getElementById('speedLabel');
  const timeCard = document.getElementById('timeCard');
  const tiltBtn = document.getElementById('tiltBtn');
  const tiltState = document.getElementById('tiltState');
  const jumpBtn = document.getElementById('jumpBtn');
  const hint = document.getElementById('hint');
  const hintText = document.getElementById('hintText');
  const toastEl = document.getElementById('toast');
  const helpModal = document.getElementById('helpModal');
  const joystick = document.getElementById('joystick');
  const joyKnob = document.getElementById('joyKnob');
  const desktopHelp = document.getElementById('desktopHelp');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const helpBtn = document.getElementById('helpBtn');

  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setBoot(pct, label) {
    bootBar.style.width = `${clamp(pct, 0, 100)}%`;
    if (label) bootStatus.textContent = label;
  }

  if (!window.THREE) {
    setBoot(100, 'WebGL could not be loaded.');
    return;
  }

  /* ------------------------------------------------------------------ noise */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const hash2 = (x, z) => {
    const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  };
  const mix2 = (a, b, t) => a + (b - a) * t;
  function valueNoise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi), b = hash2(xi + 1, zi);
    const c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
    return mix2(mix2(a, b, u), mix2(c, d, u), v);
  }
  function fbm(x, z, oct = 4) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += valueNoise(x * freq, z * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  }
  function edgeRadius(angle) {
    return 17.1 + Math.sin(angle * 3 + 0.5) * 2.0 + Math.sin(angle * 7 - 1.15) * 1.15 + Math.cos(angle * 11 + 2.4) * 0.7;
  }

  /* ---------------------------------------------------------------- renderer */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
  } catch (err) {
    setBoot(100, 'This browser cannot create a WebGL scene.');
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.85 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x8cc7e8, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb8d9e4, 58, 230);

  const camera = new THREE.PerspectiveCamera(isTouch ? 50 : 44, window.innerWidth / window.innerHeight, 0.08, 500);
  camera.position.set(12, 12, 18);

  const clock = new THREE.Clock();
  const worldRoot = new THREE.Group();
  scene.add(worldRoot);

  setBoot(10, 'Mixing the sky…');

  /* ------------------------------------------------------------------- sky */
  const skyUniforms = {
    uTop: { value: new THREE.Color('#3c82cf') },
    uHorizon: { value: new THREE.Color('#d2e9f0') },
    uBottom: { value: new THREE.Color('#7ba6bb') },
    uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.4).normalize() },
    uSunColor: { value: new THREE.Color('#ffe3aa') },
    uSunPower: { value: 0.8 },
    uSkyNight: { value: 0 }
  };
  const skyGeo = new THREE.SphereGeometry(300, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uSunPower;
      uniform float uSkyNight;
      varying vec3 vDir;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        float h = vDir.y;
        float up = smoothstep(-0.03, 0.74, h);
        vec3 col = mix(uHorizon, uTop, pow(up, 0.78));
        float below = smoothstep(0.03, -0.55, h);
        col = mix(col, uBottom, below * 0.9);

        float sd = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
        float halo = pow(sd, 5.0) * 0.22 + pow(sd, 28.0) * 0.48 + pow(sd, 400.0) * 1.7;
        col += uSunColor * halo * uSunPower;

        float band = sin((vDir.x * 2.2 + vDir.z * 1.1) * 6.0 + h * 7.0);
        col += uHorizon * (band * 0.5 + 0.5) * 0.012;

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  /* --------------------------------------------------------------- lighting */
  const hemi = new THREE.HemisphereLight(0xcdeaff, 0x3e5733, 1.35);
  scene.add(hemi);

  const sunLight = new THREE.DirectionalLight(0xfff0cb, 2.1);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 90;
  sunLight.shadow.camera.left = -28;
  sunLight.shadow.camera.right = 28;
  sunLight.shadow.camera.top = 30;
  sunLight.shadow.camera.bottom = -30;
  sunLight.shadow.bias = -0.0012;
  sunLight.shadow.normalBias = 0.035;
  sunLight.target.position.set(0, 2, 0);
  scene.add(sunLight, sunLight.target);

  const moonLight = new THREE.DirectionalLight(0x9cb9f2, 0.0);
  moonLight.target.position.set(0, 2, 0);
  scene.add(moonLight, moonLight.target);

  const ambient = new THREE.AmbientLight(0xffe6c4, 0.24);
  scene.add(ambient);

  /* -------------------------------------------------------------- celestial */
  function makeGlowTexture(inner, outer, size = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.18, inner);
    grad.addColorStop(0.48, outer);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const sunGlowTex = makeGlowTexture('rgba(255,248,220,1)', 'rgba(255,197,102,0.24)');
  const moonGlowTex = makeGlowTexture('rgba(240,247,255,1)', 'rgba(172,199,255,0.18)');

  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunGlowTex, color: 0xfff4d6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false
  }));
  sunSprite.scale.set(42, 42, 1);
  scene.add(sunSprite);

  const sunCore = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunGlowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false
  }));
  sunCore.scale.set(12, 12, 1);
  scene.add(sunCore);

  function makeMoonTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = '#eaf2ff';
    g.beginPath(); g.arc(64, 64, 31, 0, TAU); g.fill();
    g.fillStyle = 'rgba(176,194,220,.35)';
    const craters = [[50, 52, 7], [76, 70, 5], [57, 78, 4], [80, 43, 3], [43, 70, 3]];
    for (const [x, y, r] of craters) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeMoonTexture(), transparent: true, depthWrite: false, fog: false, toneMapped: false
  }));
  moonSprite.scale.set(15, 15, 1);
  scene.add(moonSprite);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: moonGlowTex, color: 0xbdd5ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false
  }));
  moonGlow.scale.set(38, 38, 1);
  scene.add(moonGlow);

  /* ----------------------------------------------------------------- stars */
  const starCount = isTouch ? 420 : 760;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starSize = new Float32Array(starCount);
  const starPhase = new Float32Array(starCount);
  const starTint = new Float32Array(starCount * 3);
  const sr = mulberry32(1177);
  for (let i = 0; i < starCount; i++) {
    const a = sr() * TAU;
    const y = Math.pow(sr(), 0.62) * 0.92 + 0.04;
    const rr = Math.sqrt(1 - y * y);
    starPos[i * 3] = Math.cos(a) * rr * 260;
    starPos[i * 3 + 1] = y * 260;
    starPos[i * 3 + 2] = Math.sin(a) * rr * 260;
    starSize[i] = 1.1 + Math.pow(sr(), 3) * 4.4;
    starPhase[i] = sr() * TAU;
    const warm = sr();
    starTint[i * 3] = warm > 0.8 ? 1.0 : 0.82;
    starTint[i * 3 + 1] = warm > 0.8 ? 0.91 : 0.9;
    starTint[i * 3 + 2] = 1.0;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhase, 1));
  starGeo.setAttribute('aTint', new THREE.BufferAttribute(starTint, 3));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 aTint;
      uniform float uTime;
      uniform float uOpacity;
      varying float vAlpha;
      varying vec3 vTint;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (330.0 / max(1.0, -mv.z));
        vAlpha = uOpacity * (0.58 + 0.42 * sin(uTime * 1.6 + aPhase));
        vTint = aTint;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec3 vTint;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float a = smoothstep(0.5, 0.05, d) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vTint, a);
      }
    `
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  setBoot(26, 'Carving the voxels…');

  /* ------------------------------------------------------------ pixel atlas */
  const ATLAS_TILES = 8;
  const TILE = 16;
  const ATLAS = ATLAS_TILES * TILE;

  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = atlasCanvas.height = ATLAS;
  const actx = atlasCanvas.getContext('2d');
  actx.imageSmoothingEnabled = false;

  function hexRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const tileRand = mulberry32(9931);
  function paintTile(col, row, base, variance, seed, detail) {
    const rnd = mulberry32(seed);
    const [br, bg, bb] = hexRgb(base);
    const x0 = col * TILE, y0 = row * TILE;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        let m = 1 + (rnd() - 0.5) * variance;
        if (rnd() > 0.9) m *= 0.9;
        if (rnd() > 0.95) m *= 1.1;
        actx.fillStyle = `rgb(${clamp(br * m, 0, 255) | 0},${clamp(bg * m, 0, 255) | 0},${clamp(bb * m, 0, 255) | 0})`;
        actx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
    if (detail) detail(actx, x0, y0, rnd);
  }
  function speck(col, row, x, y, w, h, color) {
    actx.fillStyle = color;
    actx.fillRect(col * TILE + x, row * TILE + y, w, h);
  }

  // row 0 — land
  paintTile(0, 0, '#6b9c4a', 0.24, 11, (g, x, y, r) => {
    for (let i = 0; i < 9; i++) speck(0, 0, (r() * 16) | 0, (r() * 16) | 0, 1, 1, r() > 0.5 ? '#7caf59' : '#5b8a41');
    for (let i = 0; i < 3; i++) speck(0, 0, (r() * 15) | 0, (r() * 15) | 0, 2, 1, '#87bd67');
  });
  paintTile(1, 0, '#7b5236', 0.28, 12, (g, x, y, r) => {
    for (let x = 0; x < 16; x++) {
      const edge = 3 + ((x * 7 + 3) % 3);
      for (let y = 0; y < edge; y++) {
        actx.fillStyle = y === edge - 1 ? '#4f7a37' : (r() > 0.5 ? '#6a9b46' : '#7fb457');
        actx.fillRect(x + 0, y, 1, 1);
      }
    }
    for (let i = 0; i < 8; i++) speck(1, 0, (r() * 16) | 0, 4 + (r() * 11) | 0, 1, 1, '#62402b');
  });
  paintTile(2, 0, '#795237', 0.3, 13, (g, x, y, r) => {
    for (let i = 0; i < 9; i++) speck(2, 0, (r() * 16) | 0, (r() * 16) | 0, 1, 1, r() > 0.5 ? '#8d6442' : '#66442d');
  });
  paintTile(3, 0, '#d3be85', 0.2, 14, (g, x, y, r) => {
    for (let i = 0; i < 13; i++) speck(3, 0, (r() * 16) | 0, (r() * 16) | 0, 1, 1, r() > 0.5 ? '#e4d39d' : '#bea671');
  });
  paintTile(4, 0, '#77766f', 0.24, 15, (g, x, y, r) => {
    for (let i = 0; i < 9; i++) speck(4, 0, (r() * 14) | 0, (r() * 14) | 0, 1, 2, '#5f5f59');
  });
  paintTile(5, 0, '#8d8b81', 0.22, 16, (g, x, y, r) => {
    for (let i = 0; i < 10; i++) {
      const x = (r() * 14) | 0, y = (r() * 14) | 0;
      speck(5, 0, x, y, 2 + (r() * 2 | 0), 1, r() > 0.5 ? '#6d6c64' : '#a3a197');
    }
  });
  paintTile(6, 0, '#ad7c4b', 0.2, 17, (g, x, y, r) => {
    for (let i = 0; i < 4; i++) {
      actx.strokeStyle = '#7d5734';
      actx.lineWidth = 1;
      actx.beginPath();
      actx.arc(x + 8, y + 8, 2 + i * 2.2, 0, TAU);
      actx.stroke();
    }
  });
  paintTile(7, 0, '#6c4b31', 0.26, 18, (g, x, y, r) => {
    for (let x = 0; x < 16; x++) {
      if (x % 4 === 0) speck(7, 0, x, 0, 1, 16, '#573b27');
      else if (r() > 0.5) speck(7, 0, x, (r() * 12) | 0, 1, 3 + (r() * 5 | 0), '#7f5b3b');
    }
  });

  // row 1 — foliage and built things
  paintTile(0, 1, '#437f42', 0.3, 21, (g, x, y, r) => {
    for (let i = 0; i < 18; i++) {
      const s = r();
      speck(0, 1, (r() * 16) | 0, (r() * 16) | 0, 2, 2, s > 0.68 ? '#356b36' : (s > 0.36 ? '#52924d' : '#5f9f57'));
    }
  });
  paintTile(1, 1, '#ac7d4f', 0.17, 22, (g, x, y, r) => {
    for (let y = 3; y < 16; y += 4) speck(1, 1, 0, y, 16, 1, '#7e5736');
    for (let i = 0; i < 5; i++) speck(1, 1, (r() * 15) | 0, (r() * 15) | 0, 1, 1, '#c49461');
    speck(1, 1, 6, 0, 1, 3, '#7e5736');
    speck(1, 1, 11, 4, 1, 4, '#7e5736');
    speck(1, 1, 4, 8, 1, 4, '#7e5736');
  });
  paintTile(2, 1, '#71503a', 0.18, 23, (g, x, y, r) => {
    for (let y = 3; y < 16; y += 4) speck(2, 1, 0, y, 16, 1, '#503524');
    speck(2, 1, 8, 0, 1, 3, '#503524');
    speck(2, 1, 3, 4, 1, 4, '#503524');
  });
  paintTile(3, 1, '#9b5143', 0.2, 24, (g, x, y, r) => {
    for (let y = 0; y < 16; y += 4) {
      speck(3, 1, 0, y, 16, 1, '#73362f');
      speck(3, 1, (y * 3 + 2) % 16, y, 1, 4, '#73362f');
    }
    for (let i = 0; i < 6; i++) speck(3, 1, (r() * 16) | 0, (r() * 16) | 0, 1, 1, '#b96856');
  });
  paintTile(4, 1, '#ffd079', 0.08, 25, (g, x, y, r) => {
    actx.fillStyle = '#6d4a2b';
    actx.fillRect(x + 1, y + 1, 14, 14);
    actx.fillStyle = '#f6b64d';
    actx.fillRect(x + 3, y + 3, 10, 10);
    actx.fillStyle = '#ffe59e';
    actx.fillRect(x + 4, y + 4, 3, 3);
    actx.fillStyle = '#8c5c30';
    actx.fillRect(x + 8, y + 2, 1, 12);
    actx.fillRect(x + 2, y + 8, 12, 1);
  });
  paintTile(5, 1, '#978b74', 0.22, 26, (g, x, y, r) => {
    for (let i = 0; i < 6; i++) {
      const x = (r() * 13) | 0, y = (r() * 13) | 0;
      speck(5, 1, x, y, 2, 2, r() > 0.5 ? '#756b59' : '#b3a88e');
    }
  });
  paintTile(6, 1, '#4e97b2', 0.14, 27, (g, x, y, r) => {
    for (let i = 0; i < 7; i++) {
      const y = 2 + (i * 2) % 13;
      speck(6, 1, (r() * 8) | 0, y, 5 + (r() * 6 | 0), 1, '#75c1d4');
    }
    for (let i = 0; i < 4; i++) speck(6, 1, (r() * 16) | 0, (r() * 16) | 0, 2, 1, '#347b99');
  });
  paintTile(7, 1, '#6f7b58', 0.25, 28, (g, x, y, r) => {
    for (let i = 0; i < 18; i++) speck(7, 1, (r() * 16) | 0, (r() * 16) | 0, 2, 1, r() > 0.55 ? '#587342' : '#82915e');
  });

  // row 2 — details
  function plantTile(col, row, petal, center, seed) {
    const x0 = col * TILE, y0 = row * TILE;
    actx.clearRect(x0, y0, TILE, TILE);
    actx.fillStyle = '#4c7f3c';
    actx.fillRect(x0 + 7, y0 + 8, 2, 8);
    actx.fillRect(x0 + 4, y0 + 11, 3, 1);
    actx.fillRect(x0 + 10, y0 + 10, 3, 1);
    actx.fillStyle = petal;
    actx.fillRect(x0 + 5, y0 + 4, 6, 5);
    actx.fillRect(x0 + 4, y0 + 5, 8, 3);
    actx.fillRect(x0 + 6, y0 + 2, 4, 2);
    actx.fillStyle = center;
    actx.fillRect(x0 + 7, y0 + 6, 2, 2);
    actx.fillStyle = 'rgba(255,255,255,.55)';
    actx.fillRect(x0 + 6, y0 + 4, 1, 1);
  }
  plantTile(0, 2, '#ef7775', '#f6d477', 31);
  plantTile(1, 2, '#f2cc64', '#c77836', 32);
  // grass tuft
  actx.clearRect(2 * TILE, 2 * TILE, TILE, TILE);
  for (let i = 0; i < 7; i++) {
    const x = 3 + i * 2;
    const h = 7 + (i % 3) * 3;
    actx.fillStyle = i % 2 ? '#5f954b' : '#79ad58';
    actx.fillRect(2 * TILE + x, 2 * TILE + 16 - h, 1, h);
    actx.fillRect(2 * TILE + x + 1, 2 * TILE + 13, 1, 1);
  }
  // fern
  actx.clearRect(3 * TILE, 2 * TILE, TILE, TILE);
  actx.fillStyle = '#4e8844';
  actx.fillRect(3 * TILE + 8, 2 * TILE + 5, 1, 11);
  for (let i = 0; i < 5; i++) {
    actx.fillRect(3 * TILE + 8 - i * 2, 2 * TILE + 7 + i * 2, 2 + i, 1);
    actx.fillRect(3 * TILE + 9, 2 * TILE + 7 + i * 2, 2 + i, 1);
  }
  // mushroom
  actx.clearRect(4 * TILE, 2 * TILE, TILE, TILE);
  actx.fillStyle = '#e5dbc3'; actx.fillRect(4 * TILE + 7, 2 * TILE + 9, 2, 6);
  actx.fillStyle = '#d85e4c'; actx.fillRect(4 * TILE + 5, 2 * TILE + 5, 6, 5); actx.fillRect(4 * TILE + 6, 2 * TILE + 4, 4, 1);
  actx.fillStyle = '#ffd8c6'; actx.fillRect(4 * TILE + 6, 2 * TILE + 6, 1, 1); actx.fillRect(4 * TILE + 9, 2 * TILE + 7, 1, 1);
  // blossom leaves
  paintTile(5, 2, '#e6a3b6', 0.26, 35, (g, x, y, r) => {
    for (let i = 0; i < 20; i++) {
      const s = r();
      speck(5, 2, (r() * 15) | 0, (r() * 15) | 0, 2, 2, s > 0.62 ? '#d47f9b' : (s > 0.3 ? '#f4c4d2' : '#fbe1e8'));
    }
  });
  // crystal
  actx.clearRect(6 * TILE, 2 * TILE, TILE, TILE);
  actx.fillStyle = '#a9f0e2'; actx.beginPath();
  actx.moveTo(6 * TILE + 8, 2 * TILE + 1); actx.lineTo(6 * TILE + 14, 2 * TILE + 8);
  actx.lineTo(6 * TILE + 11, 2 * TILE + 15); actx.lineTo(6 * TILE + 5, 2 * TILE + 14);
  actx.lineTo(6 * TILE + 3, 2 * TILE + 7); actx.closePath(); actx.fill();
  actx.fillStyle = '#e0fff9'; actx.fillRect(6 * TILE + 7, 2 * TILE + 4, 2, 7);
  // ember
  paintTile(7, 2, '#e6853f', 0.25, 37, (g, x, y, r) => {
    for (let i = 0; i < 8; i++) speck(7, 2, (r() * 16) | 0, (r() * 16) | 0, 2, 2, r() > 0.5 ? '#ffd173' : '#b84e29');
  });

  const atlasTex = new THREE.CanvasTexture(atlasCanvas);
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  atlasTex.magFilter = THREE.NearestFilter;
  atlasTex.minFilter = THREE.NearestFilter;
  atlasTex.generateMipmaps = false;
  atlasTex.wrapS = atlasTex.wrapT = THREE.ClampToEdgeWrapping;

  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = waterCanvas.height = 32;
  const wctx = waterCanvas.getContext('2d');
  const wrand = mulberry32(771);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const n = Math.sin(x * 0.5 + y * 0.23) * 0.5 + 0.5;
      const v = 0.82 + wrand() * 0.16 + n * 0.08;
      wctx.fillStyle = `rgb(${(47 * v) | 0},${(124 * v) | 0},${(145 * v) | 0})`;
      wctx.fillRect(x, y, 1, 1);
    }
  }
  for (let i = 0; i < 9; i++) {
    wctx.fillStyle = 'rgba(164,226,232,.35)';
    wctx.fillRect((wrand() * 30) | 0, (wrand() * 30) | 0, 4 + (wrand() * 6) | 0, 1);
  }
  const waterTex = new THREE.CanvasTexture(waterCanvas);
  waterTex.colorSpace = THREE.SRGBColorSpace;
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.magFilter = THREE.NearestFilter;
  waterTex.minFilter = THREE.NearestFilter;
  waterTex.generateMipmaps = false;

  /* ---------------------------------------------------------------- blocks */
  const BLOCKS = {
    grass: { top: [0, 0], side: [1, 0], bottom: [2, 0], tint: 1 },
    dirt: { all: [2, 0], tint: 1 },
    sand: { all: [3, 0], tint: 1 },
    stone: { all: [4, 0], tint: 1 },
    cobble: { all: [5, 0], tint: 1 },
    log: { top: [6, 0], side: [7, 0], bottom: [6, 0], tint: 1 },
    leaves: { all: [0, 1], tint: 1 },
    pine: { all: [0, 1], tint: 0.74 },
    blossom: { all: [5, 2], tint: 1.04 },
    planks: { all: [1, 1], tint: 1 },
    darkPlanks: { all: [2, 1], tint: 1 },
    roof: { all: [3, 1], tint: 1 },
    window: { all: [4, 1], glow: true, tint: 1 },
    path: { top: [5, 1], side: [2, 0], bottom: [2, 0], tint: 1 },
    moss: { top: [7, 1], side: [2, 0], bottom: [2, 0], tint: 1 },
    crystal: { all: [6, 2], glow: true, tint: 1 },
    ember: { all: [7, 2], glow: true, tint: 1 }
  };

  const blocks = new Map();
  const waterBlocks = new Map();
  const surfaceMap = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  const solid = (x, y, z) => blocks.has(key(x, y, z));
  const setBlock = (x, y, z, type) => blocks.set(key(x, y, z), type);
  const removeBlock = (x, y, z) => blocks.delete(key(x, y, z));
  const surfaceAt = (x, z) => surfaceMap.get(`${x},${z}`);

  /* ---------------------------------------------------------------- terrain */
  const ISLAND_RADIUS = 17.1;
  const islets = [
    { x: -25, y: -4, z: -7, r: 3.2, tree: true },
    { x: 24, y: 4, z: -9, r: 2.5, tree: false },
    { x: 15, y: -8, z: 21, r: 2.1, tree: false },
    { x: -18, y: 7, z: 19, r: 1.8, tree: false }
  ];

  function baseTerrainHeight(x, z, r, edge) {
    const n = fbm(x * 0.105 + 8.2, z * 0.105 - 3.7, 3);
    const n2 = fbm(x * 0.21 - 11.4, z * 0.21 + 7.1, 2);
    let h = 3.05 + (1 - clamp(r / edge, 0, 1)) * 1.3 + (n - 0.5) * 4.1 + (n2 - 0.5) * 0.55;
    h += Math.exp(-((x + 3.4) * (x + 3.4) + (z + 1.6) * (z + 1.6)) / 60) * 3.15;
    h += Math.exp(-((x - 9.2) * (x - 9.2) + (z + 8.6) * (z + 8.6)) / 33) * 1.45;
    const shore = smooth(edge - 2.8, edge - 0.2, r);
    h = lerp(h, 1.1, shore * 0.94);
    return h;
  }

  function applyTerrainFeatures(x, z, h) {
    // A quiet clearing for the cabin.
    const cabinDist = Math.max(Math.abs(x + 7.2) / 5.7, Math.abs(z + 6.6) / 4.8);
    if (cabinDist < 1.2) h = lerp(h, 4.05, smooth(1.2, 0.62, cabinDist));
    // Level the spawn meadow.
    const spawnDist = Math.sqrt((x - 2.2) ** 2 + (z - 10.5) ** 2);
    if (spawnDist < 4.3) h = lerp(h, 2.45, smooth(4.3, 1.3, spawnDist));

    // The pond basin, south-west of the cabin.
    const pd = Math.sqrt((x + 8.4) ** 2 + (z - 4.6) ** 2);
    if (pd < 2.85) h = 1.18;
    else if (pd < 4.3) h = lerp(h, 2.72, smooth(4.3, 2.85, pd));
    return h;
  }

  function buildMainIsland() {
    const rnd = mulberry32(202405);
    const min = -25, max = 25;
    const size = max - min + 1;
    const raw = new Float32Array(size * size);
    const land = new Uint8Array(size * size);
    const edges = new Float32Array(size * size);
    const idx = (x, z) => (x - min) + (z - min) * size;

    for (let x = min; x <= max; x++) {
      for (let z = min; z <= max; z++) {
        const r = Math.sqrt(x * x + z * z);
        const edge = edgeRadius(Math.atan2(z, x));
        const i = idx(x, z);
        edges[i] = edge;
        if (r > edge) continue;
        land[i] = 1;
        raw[i] = baseTerrainHeight(x, z, r, edge);
      }
    }

    // Soften the height field so the island reads as rolling ground, not static.
    const smoothed = new Float32Array(raw);
    for (let pass = 0; pass < 2; pass++) {
      const prev = new Float32Array(smoothed);
      for (let x = min; x <= max; x++) {
        for (let z = min; z <= max; z++) {
          const i = idx(x, z);
          if (!land[i]) continue;
          let sum = prev[i] * 4;
          let weight = 4;
          for (let ox = -1; ox <= 1; ox++) {
            for (let oz = -1; oz <= 1; oz++) {
              if (!ox && !oz) continue;
              const j = idx(x + ox, z + oz);
              if (j < 0 || j >= raw.length || !land[j]) continue;
              const w = ox === 0 || oz === 0 ? 1 : 0.6;
              sum += prev[j] * w;
              weight += w;
            }
          }
          smoothed[i] = sum / weight;
        }
      }
    }

    for (let x = min; x <= max; x++) {
      for (let z = min; z <= max; z++) {
        const i = idx(x, z);
        if (!land[i]) continue;
        const r = Math.sqrt(x * x + z * z);
        const edge = edges[i];
        let h = applyTerrainFeatures(x, z, smoothed[i]);
        h += (hash2(x * 1.3, z * 0.7) - 0.5) * 0.16;
        const topY = Math.max(0, Math.floor(h));
        surfaceMap.set(`${x},${z}`, topY);

        const depth = 2.5 + Math.pow(1 - clamp(r / edge, 0, 1), 1.3) * 10.8 + (rnd() - 0.5) * 2.0;
        const baseY = Math.floor(-depth);
        const pd = Math.sqrt((x + 8.4) ** 2 + (z - 4.6) ** 2);
        let topType = 'grass';
        if (pd < 2.9) topType = 'sand';
        else if (pd < 4.4 && rnd() > 0.18) topType = 'sand';
        for (let y = topY; y >= baseY; y--) {
          let type = 'stone';
          if (y === topY) type = topType;
          else if (y === topY - 1 && topType === 'sand') type = 'sand';
          else if (y > topY - 3) type = 'dirt';
          else if (rnd() > 0.9) type = 'moss';
          setBlock(x, y, z, type);
        }
      }
    }

    // Pond surface.
    for (let x = -12; x <= -4; x++) {
      for (let z = 0; z <= 9; z++) {
        const pd = Math.sqrt((x + 8.4) ** 2 + (z - 4.6) ** 2);
        if (pd < 2.75) {
          surfaceMap.set(`${x},${z}`, 1);
          for (let y = 2; y <= 5; y++) removeBlock(x, y, z);
          setBlock(x, 1, z, 'sand');
          waterBlocks.set(`${x},${z}`, 2);
        }
      }
    }

    // A scatter of boulders.
    const rocks = [[-13, -2, 1.1], [11, 4, 0.9], [6, -10, 0.8], [-3, 13, 0.7]];
    for (const [cx, cz, scale] of rocks) {
      const top = surfaceAt(cx, cz);
      if (top === undefined) continue;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > 1 && rnd() > 0.35) continue;
          const yy = top + (rnd() > 0.55 ? 1 : 0);
          setBlock(cx + dx, yy, cz + dz, rnd() > 0.7 ? 'moss' : 'stone');
        }
      }
    }
  }

  function buildIslet(islet) {
    const { x: cx, y: cy, z: cz, r } = islet;
    const rnd = mulberry32(Math.floor((cx + 40) * 101 + (cz + 50) * 37));
    for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
      for (let z = Math.floor(cz - r - 2); z <= cz + r + 2; z++) {
        const d = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
        const edge = r + Math.sin(Math.atan2(z - cz, x - cx) * 4 + 1) * 0.55;
        if (d > edge) continue;
        const topY = Math.floor(cy + (1 - d / edge) * 1.1);
        const bottom = Math.floor(cy - 1 - (1 - d / edge) * (r * 1.7) + (rnd() - 0.5) * 1.4);
        for (let y = topY; y >= bottom; y--) {
          setBlock(x, y, z, y === topY ? (d > edge - 1.2 ? 'sand' : 'grass') : (y > topY - 2 ? 'dirt' : 'stone'));
        }
        if (!islet.tiny) surfaceMap.set(`${x},${z}`, topY);
      }
    }
    if (islet.tree) addTree(Math.round(cx), Math.round(cz), 3, 'oak', true);
  }

  buildMainIsland();
  for (const islet of islets) buildIslet(islet);

  setBoot(38, 'Planting ancient trees…');

  /* ---------------------------------------------------------------- trees */
  function addTree(cx, cz, trunkHeight, kind = 'oak', quiet = false) {
    cx = Math.round(cx);
    cz = Math.round(cz);
    const top = surfaceAt(cx, cz);
    if (top === undefined) return;
    const base = top + 1;
    const rnd = mulberry32((cx + 97) * 733 + (cz + 31) * 157 + trunkHeight);
    const trunkType = 'log';
    for (let i = 0; i < trunkHeight; i++) setBlock(cx, base + i, cz, trunkType);
    const crown = base + trunkHeight;

    if (kind === 'pine') {
      const leafType = 'pine';
      const layers = [
        { y: crown - 1, r: 2.9 },
        { y: crown, r: 2.4 },
        { y: crown + 1, r: 1.8 },
        { y: crown + 2, r: 1.15 },
        { y: crown + 3, r: 0.42 }
      ];
      for (const layer of layers) {
        const rad = Math.ceil(layer.r);
        for (let dx = -rad; dx <= rad; dx++) {
          for (let dz = -rad; dz <= rad; dz++) {
            if (Math.sqrt(dx * dx + dz * dz) > layer.r + 0.15) continue;
            if (Math.abs(dx) + Math.abs(dz) === rad + (rad > 1 ? 1 : 0) && rnd() > 0.56) continue;
            if (dx === 0 && dz === 0 && layer.y <= crown + 1) continue;
            setBlock(cx + dx, layer.y, cz + dz, leafType);
          }
        }
      }
    } else {
      const leafType = kind === 'blossom' ? 'blossom' : 'leaves';
      const spread = kind === 'blossom' ? 2.05 : 3.05;
      for (let dy = -1; dy <= 3; dy++) {
        const rad = spread - Math.abs(dy - 1) * 0.54 + (rnd() - 0.5) * 0.55;
        const ir = Math.ceil(rad);
        for (let dx = -ir; dx <= ir; dx++) {
          for (let dz = -ir; dz <= ir; dz++) {
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d > rad) continue;
            if (d > rad - 0.8 && rnd() > 0.8) continue;
            if (dy === 3 && d > 1.9 && rnd() > 0.5) continue;
            if (dx === 0 && dz === 0 && dy < 2) continue;
            setBlock(cx + dx, crown + dy, cz + dz, leafType);
          }
        }
      }
      // A few blossom clusters drop lower.
      if (kind === 'blossom') {
        for (let i = 0; i < 4; i++) {
          const a = rnd() * TAU, r = 1.2 + rnd() * 1.1;
          setBlock(cx + Math.round(Math.cos(a) * r), crown - 1 + (rnd() * 2 | 0), cz + Math.round(Math.sin(a) * r), 'blossom');
        }
        // Bare branches poking through the crown read as a cherry tree.
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1]]) {
          setBlock(cx + dx, crown - 1, cz + dz, 'log');
          setBlock(cx + dx * 2, crown - 1, cz + dz * 2, 'log');
        }
      }
    }
  }

  function addLanternPost(x, z) {
    const top = surfaceAt(x, z);
    if (top === undefined) return null;
    for (let y = top + 1; y <= top + 2; y++) setBlock(x, y, z, 'log');
    setBlock(x, top + 3, z, 'window');
    return new THREE.Vector3(x + 0.5, top + 3.55, z + 0.5);
  }

  function addCabin() {
    const top = surfaceAt(-7, -7) ?? 4;
    const base = top + 1;
    const x0 = -10, x1 = -5, z0 = -9, z1 = -5;

    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        removeBlock(x, top, z);
        setBlock(x, top, z, 'planks');
      }
    }

    for (let y = base; y < base + 3; y++) {
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const edge = x === x0 || x === x1 || z === z0 || z === z1;
          if (!edge) continue;
          const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
          let type = corner ? 'log' : 'planks';
          if (z === z1 && (x === -8 || x === -7) && y < base + 2) continue;
          setBlock(x, y, z, type);
        }
      }
    }

    // Windows.
    removeBlock(-9, base + 1, z1); setBlock(-9, base + 1, z1, 'window');
    removeBlock(-10, base + 1, -7); setBlock(-10, base + 1, -7, 'window');
    removeBlock(-6, base + 1, -7); setBlock(-6, base + 1, -7, 'window');

    // A door lintel and warm trim around the doorway.
    setBlock(-8, base + 2, z1, 'darkPlanks');
    setBlock(-7, base + 2, z1, 'darkPlanks');

    // Stepped roof.
    const roofLayers = [
      { y: base + 3, x0: x0 - 1, x1: x1 + 1, z0: z0 - 1, z1: z1 + 1 },
      { y: base + 4, x0: x0, x1: x1, z0: z0, z1: z1 },
      { y: base + 5, x0: x0 + 1, x1: x1 - 1, z0: z0 + 1, z1: z1 - 1 }
    ];
    for (const layer of roofLayers) {
      for (let x = layer.x0; x <= layer.x1; x++) {
        for (let z = layer.z0; z <= layer.z1; z++) {
          if (layer.y === base + 4 && x > layer.x0 && x < layer.x1 && z > layer.z0 && z < layer.z1) continue;
          setBlock(x, layer.y, z, 'roof');
        }
      }
    }
    for (let y = base + 4; y <= base + 6; y++) {
      setBlock(-9, y, -8, 'cobble');
      setBlock(-8, y, -8, 'cobble');
    }
    setBlock(-9, base + 7, -8, 'cobble');

    // Porch posts.
    for (let z = z1 + 1; z <= z1 + 2; z++) {
      setBlock(x0, base, z, 'log');
      setBlock(x0 + 1, base, z, 'planks');
      setBlock(x1, base, z, 'log');
      setBlock(x1 - 1, base, z, 'planks');
    }

    // Fence garden.
    const fence = [[-12, -4], [-11, -4], [-4, -4], [-3, -4], [-12, -2], [-3, -2]];
    for (const [x, z] of fence) {
      const t = surfaceAt(x, z);
      if (t === undefined) continue;
      setBlock(x, t + 1, z, 'darkPlanks');
      if ((x + z) % 2 === 0) setBlock(x, t + 2, z, 'darkPlanks');
    }

    const lightPos = new THREE.Vector3(-7.5, base + 1.8, -6.5);
    const haloPos = new THREE.Vector3(-9.5, base + 1.6, z1 + 0.55);
    return { base, lightPos, haloPos };
  }

  function addPath() {
    const points = [
      [-7.5, -4.2], [-6.5, -2.3], [-5.4, -0.3], [-4.4, 1.8],
      [-3.2, 3.8], [-1.8, 5.6], [-0.2, 7.4], [1.8, 9.3]
    ];
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i], [bx, bz] = points[i + 1];
      const steps = 12;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = Math.round(lerp(ax, bx, t));
        const z = Math.round(lerp(az, bz, t));
        for (let ox = -1; ox <= 1; ox++) {
          for (let oz = -1; oz <= 1; oz++) {
            if (Math.abs(ox) + Math.abs(oz) > 1) continue;
            if (ox !== 0 && oz !== 0) continue;
            const top = surfaceAt(x + ox, z + oz);
            if (top === undefined) continue;
            const cur = blocks.get(key(x + ox, top, z + oz));
            if (cur === 'grass' || cur === 'moss' || cur === 'dirt') setBlock(x + ox, top, z + oz, 'path');
          }
        }
      }
    }
  }

  /* ------------------------------------------------------------- campfire */
  let campfirePos = new THREE.Vector3(2.5, 3, 8.5);
  let campfireLight;
  let flameGroup;
  function addCampfire() {
    const top = surfaceAt(2, 8) ?? 2;
    const y = top + 1;
    campfirePos.set(2.5, top + 2.06, 8.5);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const x = 2 + Math.round(Math.cos(a) * 1.35);
      const z = 8 + Math.round(Math.sin(a) * 1.35);
      setBlock(x, top + 1, z, 'cobble');
    }
    setBlock(2, top + 1, 8, 'ember');
    campfireLight = new THREE.PointLight(0xff8d3a, 0, 11, 1.8);
    campfireLight.position.set(2.5, top + 2.8, 8.5);
    worldRoot.add(campfireLight);

    flameGroup = new THREE.Group();
    flameGroup.position.copy(campfirePos);
    worldRoot.add(flameGroup);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb04d, transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false });
    for (let i = 0; i < 7; i++) {
      const flame = new THREE.Mesh(new THREE.BoxGeometry(0.11 + Math.random() * 0.11, 0.18 + Math.random() * 0.3, 0.11), i % 3 === 0 ? coreMat : flameMat);
      flame.position.set((Math.random() - 0.5) * 0.55, 0.16 + Math.random() * 0.34, (Math.random() - 0.5) * 0.55);
      flame.userData.phase = Math.random() * TAU;
      flame.userData.baseY = flame.position.y;
      flameGroup.add(flame);
    }
    // Logs.
    const logMat = new THREE.MeshStandardMaterial({ color: 0x4d3324, roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.2, 0.23), logMat);
      log.rotation.y = (i / 4) * TAU + 0.2;
      log.position.y = 0.12;
      log.castShadow = true;
      flameGroup.add(log);
    }
  }

  /* --------------------------------------------------------------- scenery */
  setBoot(49, 'Hanging the lanterns…');

  const { base: cabinBase, lightPos: cabinLightPos, haloPos: cabinHaloPos } = addCabin();
  addPath();

  addTree(8.5, -4.5, 6, 'oak');
  addTree(4.5, 4.8, 4, 'blossom');
  addTree(-12.4, 5.8, 6, 'pine');
  addTree(-12.8, -9.2, 4, 'oak');
  addTree(12.6, 8.0, 3, 'oak');
  addTree(-3.0, -11.8, 4, 'pine');

  const lanternA = addLanternPost(-4.5, 1.5);
  const lanternB = addLanternPost(0.5, 6.8);
  addCampfire();

  // Petals drifting from the cherry tree.
  const blossomCrownY = (surfaceAt(5, 5) ?? 4) + 5;
  const petalCount = 44;
  const petalSeed = mulberry32(4417);
  const petalGeo = new THREE.BufferGeometry();
  const petalPos = new Float32Array(petalCount * 3);
  const petalLife = new Float32Array(petalCount);
  const petalMeta = new Float32Array(petalCount * 2);
  for (let i = 0; i < petalCount; i++) {
    petalLife[i] = petalSeed();
    petalMeta[i * 2] = petalSeed() * TAU;
    petalMeta[i * 2 + 1] = 0.6 + petalSeed() * 2.5;
    petalPos[i * 3] = 5.5;
    petalPos[i * 3 + 1] = blossomCrownY;
    petalPos[i * 3 + 2] = 5.5;
  }
  petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3));
  const petalTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = '#f7bfd0';
    g.beginPath();
    g.ellipse(8, 8, 5, 3, 0.6, 0, TAU);
    g.fill();
    g.fillStyle = '#ffe3ea';
    g.fillRect(6, 5, 3, 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  })();
  const petalMat = new THREE.PointsMaterial({
    map: petalTex, color: 0xffd0de, size: 0.3, transparent: true, opacity: 0.9,
    depthWrite: false, sizeAttenuation: true
  });
  const petals = new THREE.Points(petalGeo, petalMat);
  petals.frustumCulled = false;
  worldRoot.add(petals);

  // A little shrine on the north islet, visible when orbiting.
  setBlock(-25, 0, -7, 'crystal');

  // Glowing mineral veins and hanging moss on the island underside.
  let veinCount = 0;
  for (const [k, type] of blocks) {
    if (type !== 'stone') continue;
    const [x, y, z] = k.split(',').map(Number);
    if (y > -2 || y < -10) continue;
    const radius = Math.sqrt(x * x + z * z);
    if (radius < 13) continue;
    const h = hash2(x * 7.3 + y * 1.9, z * 4.1 - y);
    if (h > 0.986 && veinCount < 14) {
      setBlock(x, y, z, 'crystal');
      veinCount++;
    } else if (h > 0.968) {
      setBlock(x, y, z, 'leaves');
    }
  }

  /* ------------------------------------------------------------- geometry */
  const FACE_DATA = [
    { dir: 'px', n: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.83 },
    { dir: 'nx', n: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.72 },
    { dir: 'py', n: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 1.0 },
    { dir: 'ny', n: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.48 },
    { dir: 'pz', n: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.9 },
    { dir: 'nz', n: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.68 }
  ];

  const AO_LEVELS = [0.54, 0.7, 0.86, 1.0];
  const tileUvCache = new Map();
  function tileUv(tile) {
    const cacheKey = tile.join(',');
    if (tileUvCache.has(cacheKey)) return tileUvCache.get(cacheKey);
    const [col, row] = tile;
    const pad = 0.16;
    const uv = {
      u0: (col * TILE + pad) / ATLAS,
      u1: (col * TILE + TILE - pad) / ATLAS,
      v0: (ATLAS - (row + 1) * TILE + pad) / ATLAS,
      v1: (ATLAS - row * TILE - pad) / ATLAS
    };
    tileUvCache.set(cacheKey, uv);
    return uv;
  }
  function defTile(def, dir) {
    if (dir === 'py') return def.top || def.all;
    if (dir === 'ny') return def.bottom || def.all;
    return def.side || def.all || def.top;
  }

  function aoFor(x, y, z, face, corner) {
    let ax = 0, ay = 0, az = 0;
    if (face.dir === 'px' || face.dir === 'nx') ax = face.n[0];
    else if (face.dir === 'py' || face.dir === 'ny') ay = face.n[1];
    else az = face.n[2];
    let s1, s2, c;
    if (ax !== 0) {
      const oy = corner[1] === 1 ? 0 : -1;
      const oz = corner[2] === 1 ? 0 : -1;
      s1 = solid(x + ax, y + oy, z) ? 1 : 0;
      s2 = solid(x + ax, y, z + oz) ? 1 : 0;
      c = solid(x + ax, y + oy, z + oz) ? 1 : 0;
    } else if (ay !== 0) {
      const ox = corner[0] === 1 ? 0 : -1;
      const oz = corner[2] === 1 ? 0 : -1;
      s1 = solid(x + ox, y + ay, z) ? 1 : 0;
      s2 = solid(x, y + ay, z + oz) ? 1 : 0;
      c = solid(x + ox, y + ay, z + oz) ? 1 : 0;
    } else {
      const ox = corner[0] === 1 ? 0 : -1;
      const oy = corner[1] === 1 ? 0 : -1;
      s1 = solid(x + ox, y, z + az) ? 1 : 0;
      s2 = solid(x, y + oy, z + az) ? 1 : 0;
      c = solid(x + ox, y + oy, z + az) ? 1 : 0;
    }
    const occ = s1 && s2 ? 3 : s1 + s2 + c;
    return AO_LEVELS[3 - occ] || 0.54;
  }

  function buildBlockMesh(includeGlow) {
    const positions = [], normals = [], colors = [], uvs = [], indices = [];
    let v = 0;
    for (const [k, type] of blocks) {
      const def = BLOCKS[type];
      if (!def) continue;
      if (!!def.glow !== includeGlow) continue;
      const [x, y, z] = k.split(',').map(Number);
      const tint = (def.tint || 1) * (0.96 + hash2(x * 3.1 + y * 0.73, z * 1.7 + y * 0.31) * 0.08);
      for (const face of FACE_DATA) {
        if (solid(x + face.n[0], y + face.n[1], z + face.n[2])) continue;
        const tile = defTile(def, face.dir);
        if (!tile) continue;
        const uv = tileUv(tile);
        const start = v;
        for (let i = 0; i < 4; i++) {
          const c = face.corners[i];
          positions.push(x + c[0], y + c[1], z + c[2]);
          normals.push(face.n[0], face.n[1], face.n[2]);
          const u = face.uv[i][0], vv = face.uv[i][1];
          uvs.push(u ? uv.u1 : uv.u0, vv ? uv.v1 : uv.v0);
          const ao = aoFor(x, y, z, face, c);
          const brightness = face.shade * tint * ao;
          colors.push(brightness, brightness, brightness);
          v++;
        }
        indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      }
    }
    if (!positions.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }

  const opaqueGeo = buildBlockMesh(false);
  const opaqueMat = new THREE.MeshStandardMaterial({
    map: atlasTex,
    vertexColors: true,
    roughness: 0.93,
    metalness: 0
  });
  const worldMesh = new THREE.Mesh(opaqueGeo, opaqueMat);
  worldMesh.castShadow = true;
  worldMesh.receiveShadow = true;
  worldRoot.add(worldMesh);

  const glowGeo = buildBlockMesh(true);
  const glowMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, toneMapped: false });
  const glowMesh = glowGeo ? new THREE.Mesh(glowGeo, glowMat) : null;
  if (glowMesh) worldRoot.add(glowMesh);

  /* --------------------------------------------------------------- water */
  function buildWater() {
    const positions = [], normals = [], uvs = [], indices = [], colors = [];
    let v = 0;
    for (const [k, wy] of waterBlocks) {
      const [x, z] = k.split(',').map(Number);
      for (const face of FACE_DATA) {
        const nx = x + face.n[0], ny = wy + face.n[1], nz = z + face.n[2];
        if (solid(nx, ny, nz) || waterBlocks.get(`${nx},${nz}`) === ny) continue;
        const start = v;
        for (let i = 0; i < 4; i++) {
          const c = face.corners[i];
          positions.push(x + c[0], wy + c[1], z + c[2]);
          normals.push(face.n[0], face.n[1], face.n[2]);
          uvs.push(face.uv[i][0], face.uv[i][1]);
          const b = face.shade * 0.95;
          colors.push(b, b, b);
          v++;
        }
        indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      }
    }
    if (!positions.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    return geo;
  }
  const waterGeo = buildWater();
  const waterMat = new THREE.MeshStandardMaterial({
    map: waterTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    roughness: 0.24,
    metalness: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const waterMesh = waterGeo ? new THREE.Mesh(waterGeo, waterMat) : null;
  if (waterMesh) {
    waterMesh.renderOrder = 2;
    worldRoot.add(waterMesh);
  }

  /* ---------------------------------------------------------- wildflowers */
  function buildDecorations() {
    const positions = [], normals = [], uvs = [], colors = [], indices = [];
    let v = 0;
    const rnd = mulberry32(88421);

    function cross(x, y, z, tile, width, height, rotation, tint) {
      const uv = tileUv(tile);
      const w = width / 2;
      for (let plane = 0; plane < 2; plane++) {
        const ang = rotation + plane * Math.PI / 2;
        const dx = Math.cos(ang) * w;
        const dz = Math.sin(ang) * w;
        const nx = Math.sin(ang), nz = -Math.cos(ang);
        const verts = [
          [x - dx, y, z - dz, 0, 0],
          [x + dx, y, z + dz, 1, 0],
          [x + dx, y + height, z + dz, 1, 1],
          [x - dx, y + height, z - dz, 0, 1]
        ];
        const start = v;
        for (const [vx, vy, vz, u, vv] of verts) {
          positions.push(vx, vy, vz);
          normals.push(nx, 0, nz);
          uvs.push(u ? uv.u1 : uv.u0, vv ? uv.v1 : uv.v0);
          colors.push(tint[0], tint[1], tint[2]);
          v++;
        }
        indices.push(start, start + 1, start + 2, start, start + 2, start + 3, start, start + 2, start + 1, start, start + 3, start + 2);
      }
    }

    const green = [0.75, 0.92, 0.63];
    for (let i = 0; i < 380; i++) {
      const x = Math.floor((rnd() - 0.5) * 34);
      const z = Math.floor((rnd() - 0.5) * 34);
      const top = surfaceAt(x, z);
      if (top === undefined) continue;
      const type = blocks.get(key(x, top, z));
      if (type !== 'grass' && type !== 'moss') continue;
      if (solid(x, top + 1, z)) continue;
      if (Math.abs(x - 2) < 2.2 && Math.abs(z - 8.5) < 2.2) continue;
      if (Math.abs(x + 7) < 6 && Math.abs(z + 7) < 5.5) continue;
      const roll = rnd();
      if (roll > 0.86) {
        cross(x + 0.5, top + 1.01, z + 0.5, rnd() > 0.5 ? [0, 2] : [1, 2], 0.48, 0.62, rnd() * TAU, [1, 1, 1]);
      } else if (roll > 0.805) {
        cross(x + 0.5, top + 1.01, z + 0.5, [3, 2], 0.55, 0.68, rnd() * TAU, green);
      } else if (roll > 0.79) {
        cross(x + 0.5, top + 1.01, z + 0.5, [4, 2], 0.34, 0.4, rnd() * TAU, [1, 1, 1]);
      } else {
        cross(x + 0.5, top + 1.01, z + 0.5, [2, 2], 0.64, 0.64 + rnd() * 0.3, rnd() * TAU, green);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    const mat = new THREE.MeshStandardMaterial({
      map: atlasTex,
      vertexColors: true,
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    worldRoot.add(mesh);
  }
  buildDecorations();

  /* ---------------------------------------------------------------- clouds */
  const cloudMeshes = [];
  const cloudMats = [];
  function buildClouds() {
    const rnd = mulberry32(5003);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (let layerIndex = 0; layerIndex < 4; layerIndex++) {
      const high = layerIndex === 3;
      const lumps = [];
      for (let c = 0; c < (high ? 10 : 20); c++) {
        const angle = rnd() * TAU;
        const radius = high ? 88 + rnd() * 50 : layerIndex === 2 ? 70 + rnd() * 55 : 28 + rnd() * 78;
        const cx = Math.cos(angle) * radius;
        const cz = Math.sin(angle) * radius;
        const cy = layerIndex === 0 ? -13 - rnd() * 8 : layerIndex === 1 ? -26 - rnd() * 10 : layerIndex === 2 ? -40 - rnd() * 12 : 26 + rnd() * 16;
        const pieces = high ? 8 + Math.floor(rnd() * 7) : 9 + Math.floor(rnd() * 8);
        for (let p = 0; p < pieces; p++) {
          lumps.push({
            x: cx + (rnd() - 0.5) * 10,
            y: cy + (rnd() - 0.5) * 2.4,
            z: cz + (rnd() - 0.5) * 7,
            sx: 1.2 + rnd() * 2.6,
            sy: 0.7 + rnd() * 1.2,
            sz: 1.2 + rnd() * 2.3
          });
        }
      }
      const mat = new THREE.MeshStandardMaterial({
        color: 0xf1f8f4,
        transparent: true,
        opacity: 0.58,
        roughness: 1,
        metalness: 0,
        depthWrite: false
      });
      mat.userData.layer = layerIndex;
      const inst = new THREE.InstancedMesh(geo, mat, lumps.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      const p = new THREE.Vector3();
      lumps.forEach((l, i) => {
        p.set(l.x, l.y, l.z);
        s.set(l.sx, l.sy, l.sz);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * TAU);
        m.compose(p, q, s);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = false;
      inst.userData.phase = rnd() * TAU;
      inst.userData.speed = 0.06 + layerIndex * 0.025;
      inst.userData.layer = layerIndex;
      worldRoot.add(inst);
      cloudMeshes.push(inst);
      cloudMats.push(mat);
    }
  }
  buildClouds();


  /* ----------------------------------------------------------------- birds */
  const birdFlock = new THREE.Group();
  const birds = [];
  function buildBirds() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x273a3f, transparent: true, opacity: 0.84, toneMapped: false });
    for (let i = 0; i < 5; i++) {
      const bird = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.14, 0.5), mat);
      bird.add(body);
      const wingL = new THREE.Group();
      const wingR = new THREE.Group();
      const wingGeo = new THREE.BoxGeometry(0.75, 0.05, 0.28);
      const wl = new THREE.Mesh(wingGeo, mat);
      const wr = new THREE.Mesh(wingGeo, mat);
      wl.position.x = -0.39;
      wr.position.x = 0.39;
      wingL.add(wl); wingR.add(wr);
      wingL.position.set(-0.08, 0, 0);
      wingR.position.set(0.08, 0, 0);
      bird.add(wingL, wingR);
      bird.userData = { wingL, wingR, phase: i * 0.8 + Math.random() * 0.5, radius: 19 + i * 2.3, height: 11 + i * 0.8, speed: 0.08 + Math.random() * 0.03 };
      bird.scale.setScalar(0.7 + i * 0.08);
      birdFlock.add(bird);
      birds.push(bird);
    }
    worldRoot.add(birdFlock);
  }
  buildBirds();

  /* -------------------------------------------------------------- fireflies */
  const fireflyCount = isTouch ? 46 : 78;
  const ffGeo = new THREE.BufferGeometry();
  const ffPos = new Float32Array(fireflyCount * 3);
  const ffPhase = new Float32Array(fireflyCount);
  const ffSize = new Float32Array(fireflyCount);
  const fr = mulberry32(9912);
  for (let i = 0; i < fireflyCount; i++) {
    const x = (fr() - 0.5) * 30;
    const z = (fr() - 0.5) * 30;
    const top = surfaceAt(Math.round(x), Math.round(z));
    const y = top !== undefined ? top + 1.2 + fr() * 3.2 : 2 + fr() * 5;
    ffPos[i * 3] = x; ffPos[i * 3 + 1] = y; ffPos[i * 3 + 2] = z;
    ffPhase[i] = fr() * TAU;
    ffSize[i] = 2.4 + fr() * 3.2;
  }
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  ffGeo.setAttribute('aPhase', new THREE.BufferAttribute(ffPhase, 1));
  ffGeo.setAttribute('aSize', new THREE.BufferAttribute(ffSize, 1));
  const ffMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniformsNeedUpdate: true,
    vertexShader: `
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.47 + aPhase) * 0.85;
        p.y += sin(uTime * 0.63 + aPhase * 2.1) * 0.5;
        p.z += cos(uTime * 0.39 + aPhase * 1.7) * 0.85;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (200.0 / max(1.0, -mv.z));
        vAlpha = uOpacity * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 2.3 + aPhase), 3.0));
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float core = smoothstep(0.5, 0.02, d);
        float halo = smoothstep(0.5, 0.12, d) * 0.35;
        if (vAlpha < 0.01) discard;
        gl_FragColor = vec4(vec3(1.0, 0.82, 0.38) * (core + halo), (core + halo) * vAlpha);
      }
    `
  });
  const fireflies = new THREE.Points(ffGeo, ffMat);
  fireflies.frustumCulled = false;
  worldRoot.add(fireflies);

  /* ------------------------------------------------------------- glow dust */
  const haloMatBase = new THREE.SpriteMaterial({
    map: sunGlowTex, color: 0xffb363, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, fog: false
  });
  const halos = [];
  function addHalo(pos, scale, color, strength = 1) {
    const mat = haloMatBase.clone();
    mat.color.set(color);
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.set(scale, scale, 1);
    sprite.userData.strength = strength;
    worldRoot.add(sprite);
    halos.push(sprite);
    return sprite;
  }
  if (lanternA) addHalo(lanternA, 3.6, 0xffc171, 0.75);
  if (lanternB) addHalo(lanternB, 3.6, 0xffc171, 0.75);
  addHalo(cabinHaloPos, 6.5, 0xffad5c, 0.7);
  addHalo(new THREE.Vector3(2.5, campfirePos.y + 0.8, 8.5), 4.8, 0xff8b3a, 1.1);
  addHalo(new THREE.Vector3(-25, 0.8, -7), 4.2, 0x83f5e3, 0.7);


  /* ----------------------------------------------------- smoke and embers */
  const softDotTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 31);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.36)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  const smokeCount = 28;
  const smokeGeo = new THREE.BufferGeometry();
  const smokePos = new Float32Array(smokeCount * 3);
  const smokeLife = new Float32Array(smokeCount);
  const smokeSeed = mulberry32(5512);
  for (let i = 0; i < smokeCount; i++) {
    smokePos[i * 3] = -8.5 + (smokeSeed() - 0.5) * 0.8;
    smokePos[i * 3 + 1] = cabinBase + 8 + smokeSeed() * 4;
    smokePos[i * 3 + 2] = -8 + (smokeSeed() - 0.5) * 0.8;
    smokeLife[i] = smokeSeed();
  }
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  const smokeTexMat = new THREE.PointsMaterial({
    map: softDotTex, color: 0xd6deda, size: 1.5, transparent: true, opacity: 0.2,
    depthWrite: false, sizeAttenuation: true, blending: THREE.NormalBlending
  });
  const smoke = new THREE.Points(smokeGeo, smokeTexMat);
  smoke.frustumCulled = false;
  worldRoot.add(smoke);

  const emberCount = 22;
  const emberGeo = new THREE.BufferGeometry();
  const emberPos = new Float32Array(emberCount * 3);
  const emberLife = new Float32Array(emberCount);
  const emberSeed = mulberry32(8801);
  for (let i = 0; i < emberCount; i++) {
    emberPos[i * 3] = 2.5 + (emberSeed() - 0.5) * 0.7;
    emberPos[i * 3 + 1] = campfirePos.y + emberSeed() * 1.4;
    emberPos[i * 3 + 2] = 8.5 + (emberSeed() - 0.5) * 0.7;
    emberLife[i] = emberSeed();
  }
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const emberMat = new THREE.PointsMaterial({
    map: softDotTex, color: 0xffb15d, size: 0.22, transparent: true, opacity: 0.95,
    depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending
  });
  const embers = new THREE.Points(emberGeo, emberMat);
  embers.frustumCulled = false;
  worldRoot.add(embers);

  const windowLight = new THREE.PointLight(0xffb45e, 0, 14, 1.9);
  windowLight.position.copy(cabinLightPos);
  worldRoot.add(windowLight);

  const lanternLights = [];
  for (const pos of [lanternA, lanternB]) {
    if (!pos) continue;
    const light = new THREE.PointLight(0xffc174, 0, 7.5, 2);
    light.position.copy(pos);
    worldRoot.add(light);
    lanternLights.push(light);
  }

  /* ---------------------------------------------------------------- avatar */
  function mat(color, rough = 0.95) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
  }
  const skinMat = mat(0xd7a06b);
  const skinDarkMat = mat(0xba8355);
  const hairMat = mat(0x35251f);
  const shirtMat = mat(0x2f7f71);
  const shirtDarkMat = mat(0x245f56);
  const pantsMat = mat(0x3f5364);
  const shoeMat = mat(0x25211e);
  const packMat = mat(0x745237);

  function createAvatar() {
    const root = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.58, 0.3), shirtMat);
    body.position.y = 1.17;
    root.add(body);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.09, 0.32), shirtDarkMat);
    belt.position.y = 0.9;
    root.add(belt);

    const headPivot = new THREE.Group();
    headPivot.position.y = 1.57;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.52), skinMat);
    head.position.y = 0.23;
    headPivot.add(head);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.56), hairMat);
    hair.position.y = 0.52;
    headPivot.add(hair);
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 0.08), hairMat);
    fringe.position.set(0, 0.42, 0.26);
    headPivot.add(fringe);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.02), mat(0x1b1b1e));
    eyeL.position.set(-0.13, 0.24, 0.269);
    headPivot.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.13;
    headPivot.add(eyeR);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.08), skinDarkMat);
    nose.position.set(0, 0.15, 0.265);
    headPivot.add(nose);
    root.add(headPivot);

    function arm(side) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.34, 1.43, 0);
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.27, 0.24), shirtMat);
      sleeve.position.y = -0.13;
      pivot.add(sleeve);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.36, 0.22), skinMat);
      hand.position.y = -0.43;
      pivot.add(hand);
      root.add(pivot);
      return pivot;
    }
    const armL = arm(-1), armR = arm(1);

    function leg(side) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.14, 0.88, 0);
      const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.26), pantsMat);
      legMesh.position.y = -0.37;
      pivot.add(legMesh);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.16, 0.35), shoeMat);
      shoe.position.set(0, -0.77, 0.05);
      pivot.add(shoe);
      root.add(pivot);
      return pivot;
    }
    const legL = leg(-1), legR = leg(1);

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.2), packMat);
    pack.position.set(0, 1.2, -0.26);
    root.add(pack);
    const packFlap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.11, 0.22), mat(0x5d402a));
    packFlap.position.set(0, 1.4, -0.27);
    root.add(packFlap);

    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return { root, armL, armR, legL, legR, headPivot, body, pack };
  }

  const avatar = createAvatar();
  worldRoot.add(avatar.root);

  const player = {
    x: 2.3,
    z: 11.2,
    y: 3,
    vy: 0,
    grounded: true,
    heading: Math.PI,
    moveAmount: 0,
    walkCycle: 0,
    speed: 0
  };
  const spawnTop = surfaceAt(Math.round(player.x), Math.round(player.z));
  player.y = (spawnTop ?? 2) + 1;
  avatar.root.position.set(player.x, player.y, player.z);

  /* -------------------------------------------------------- contact shadows */
  const shadowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0,0,0,0.82)');
    grad.addColorStop(0.38, 'rgba(0,0,0,0.48)');
    grad.addColorStop(0.78, 'rgba(0,0,0,0.1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  const contactShadows = [];
  function addContactShadow(x, z, size, strength) {
    const top = surfaceAt(Math.round(x), Math.round(z));
    if (top === undefined) return;
    const mat = new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x18301f, transparent: true, opacity: strength, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, top + 1.025, z);
    mesh.renderOrder = 1;
    worldRoot.add(mesh);
    contactShadows.push({ mesh, mat, strength });
  }
  addContactShadow(8.5, -4.5, 5.8, 0.16);
  addContactShadow(4.5, 4.8, 4.6, 0.14);
  addContactShadow(-12.4, 5.8, 4.0, 0.13);
  addContactShadow(-12.8, -9.2, 4.2, 0.13);
  addContactShadow(12.6, 8.0, 3.4, 0.11);
  addContactShadow(-3.0, -11.8, 3.6, 0.11);
  addContactShadow(-7.4, -6.6, 6.2, 0.12);

  const avatarShadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x122018, transparent: true, opacity: 0.28, depthWrite: false });
  const avatarShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), avatarShadowMat);
  avatarShadow.rotation.x = -Math.PI / 2;
  avatarShadow.renderOrder = 1;
  worldRoot.add(avatarShadow);
  avatarShadow.position.set(player.x, player.y + 0.025, player.z);

  /* ------------------------------------------------------------- controls */
  const state = {
    yaw: 0.4,
    pitch: 0.63,
    dist: isTouch ? 34 : 43,
    targetYaw: 0.4,
    targetPitch: 0.63,
    targetDist: isTouch ? 34 : 43,
    tiltYaw: 0,
    tiltPitch: 0,
    tiltRoll: 0,
    time: 0.695,
    speedIndex: 0,
    fastSpeeds: [1, 10, 40]
  };
  const keys = new Set();
  const joy = { active: false, x: 0, y: 0, pointerId: null };
  const look = { pointers: new Map(), dragging: false, lastX: 0, lastY: 0, pinch: null, moved: false };
  let jumpQueued = false;
  let introDismissed = false;

  function dismissIntro() {
    if (introDismissed) return;
    introDismissed = true;
    hint.classList.add('gone');
    setTimeout(() => hint.classList.remove('visible'), 650);
  }

  function showToast(text, timeout = 3000) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toastEl.classList.remove('show'), timeout);
  }

  function updateJoystickFromEvent(e) {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = rect.width * 0.31;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = dx / len * max;
      dy = dy / len * max;
    }
    joy.x = dx / max;
    joy.y = -dy / max;
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  joystick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    joy.active = true;
    joy.pointerId = e.pointerId;
    joystick.classList.add('active');
    joystick.setPointerCapture(e.pointerId);
    updateJoystickFromEvent(e);
    dismissIntro();
  });
  joystick.addEventListener('pointermove', (e) => {
    if (!joy.active || e.pointerId !== joy.pointerId) return;
    e.preventDefault();
    updateJoystickFromEvent(e);
  });
  function endJoystick(e) {
    if (e.pointerId !== joy.pointerId) return;
    joy.active = false;
    joy.x = 0;
    joy.y = 0;
    joyKnob.style.transform = 'translate(0px, 0px)';
    joystick.classList.remove('active');
    joy.pointerId = null;
  }
  joystick.addEventListener('pointerup', endJoystick);
  joystick.addEventListener('pointercancel', endJoystick);

  function queueJump() {
    jumpQueued = true;
    jumpBtn.classList.add('pressed');
    setTimeout(() => jumpBtn.classList.remove('pressed'), 130);
    dismissIntro();
  }
  jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); queueJump(); });

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
      if (k === ' ') e.preventDefault();
      keys.add(k);
      dismissIntro();
    }
    if (k === ' ' && !e.repeat) queueJump();
    if (k === 'h') toggleModal(true);
    if (k === 'escape') toggleModal(false);
    if (k === 't') cycleTimeSpeed();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    look.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (look.pointers.size === 1) {
      look.dragging = true;
      look.lastX = e.clientX;
      look.lastY = e.clientY;
      look.moved = false;
      canvas.classList.add('dragging');
    } else if (look.pointers.size === 2) {
      look.dragging = false;
      const pts = [...look.pointers.values()];
      look.pinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
    dismissIntro();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!look.pointers.has(e.pointerId)) return;
    look.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (look.pointers.size === 2) {
      const pts = [...look.pointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (look.pinch) {
        state.targetDist = clamp(state.targetDist * (look.pinch / Math.max(20, d)), 8.5, 23);
      }
      look.pinch = d;
      return;
    }
    if (!look.dragging) return;
    const dx = e.clientX - look.lastX;
    const dy = e.clientY - look.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 1) look.moved = true;
    state.targetYaw -= dx * 0.0052;
    state.targetPitch = clamp(state.targetPitch + dy * 0.004, 0.07, 1.12);
    look.lastX = e.clientX;
    look.lastY = e.clientY;
  });
  function endLook(e) {
    look.pointers.delete(e.pointerId);
    if (look.pointers.size < 2) look.pinch = null;
    if (look.pointers.size === 0) {
      look.dragging = false;
      canvas.classList.remove('dragging');
    }
  }
  canvas.addEventListener('pointerup', endLook);
  canvas.addEventListener('pointercancel', endLook);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.targetDist = clamp(state.targetDist + e.deltaY * 0.012, 8.5, 23);
    dismissIntro();
  }, { passive: false });

  /* ----------------------------------------------------------------- tilt */
  let tiltEnabled = false;
  let motionHandler = null;
  let tiltBase = null;
  let hasMotionEvent = false;
  const motionSupported = 'DeviceOrientationEvent' in window;

  function setTiltUI(mode) {
    if (mode === 'on') {
      tiltBtn.classList.add('active');
      tiltBtn.classList.remove('denied');
      tiltBtn.setAttribute('aria-pressed', 'true');
      tiltState.textContent = 'on';
      tiltBtn.setAttribute('aria-label', 'Disable accelerometer tilt control');
    } else if (mode === 'denied') {
      tiltBtn.classList.remove('active');
      tiltBtn.classList.add('denied');
      tiltBtn.setAttribute('aria-pressed', 'false');
      tiltState.textContent = 'denied';
      tiltBtn.setAttribute('aria-label', 'Accelerometer permission denied');
    } else {
      tiltBtn.classList.remove('active', 'denied');
      tiltBtn.setAttribute('aria-pressed', 'false');
      tiltState.textContent = 'off';
      tiltBtn.setAttribute('aria-label', 'Toggle accelerometer tilt control');
    }
  }

  async function toggleTilt() {
    dismissIntro();
    if (!motionSupported) {
      showToast('Tilt needs a phone or tablet with motion sensors.');
      setTiltUI('denied');
      setTimeout(() => setTiltUI('off'), 1800);
      return;
    }
    if (tiltEnabled) {
      tiltEnabled = false;
      if (motionHandler) window.removeEventListener('deviceorientation', motionHandler);
      motionHandler = null;
      tiltBase = null;
      state.tiltYaw = state.tiltPitch = state.tiltRoll = 0;
      setTiltUI('off');
      showToast('Tilt control off.');
      return;
    }
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          setTiltUI('denied');
          showToast('Motion permission was not granted. You can still drag to look.');
          setTimeout(() => setTiltUI('off'), 2500);
          return;
        }
      }
      tiltBase = null;
      hasMotionEvent = false;
      motionHandler = (e) => {
        if (e.beta == null && e.gamma == null) return;
        hasMotionEvent = true;
        if (!tiltBase) tiltBase = { beta: e.beta || 0, gamma: e.gamma || 0 };
        const beta = (e.beta || 0) - tiltBase.beta;
        const gamma = (e.gamma || 0) - tiltBase.gamma;
        state.tiltYaw = clamp(-gamma * 0.0042, -0.34, 0.34);
        state.tiltPitch = clamp(beta * 0.0032, -0.22, 0.22);
        state.tiltRoll = clamp(-gamma * 0.0024, -0.13, 0.13);
      };
      window.addEventListener('deviceorientation', motionHandler);
      tiltEnabled = true;
      setTiltUI('on');
      showToast('Tilt on — move your device gently to look.', 2600);
      setTimeout(() => {
        if (tiltEnabled && !hasMotionEvent) {
          showToast('No motion data arrived. Check browser motion permissions.', 3200);
        }
      }, 2200);
    } catch (err) {
      setTiltUI('denied');
      showToast('Motion permission was unavailable. Drag to look instead.');
      setTimeout(() => setTiltUI('off'), 2500);
    }
  }
  tiltBtn.addEventListener('click', toggleTilt);

  /* ---------------------------------------------------------- time + modal */
  function cycleTimeSpeed() {
    state.speedIndex = (state.speedIndex + 1) % state.fastSpeeds.length;
    const speed = state.fastSpeeds[state.speedIndex];
    speedEl.textContent = `${speed}×`;
    timeCard.classList.toggle('fast', speed > 1);
    timeCard.setAttribute('aria-label', `Change the speed of time. Currently ${speed} times speed.`);
    dismissIntro();
    if (speed > 1) showToast(`Time is now moving ${speed}× faster.`);
  }
  timeCard.addEventListener('click', cycleTimeSpeed);

  function toggleModal(open) {
    const isOpen = open ?? !helpModal.classList.contains('open');
    helpModal.classList.toggle('open', isOpen);
    helpModal.setAttribute('aria-hidden', String(!isOpen));
    if (isOpen) {
      helpModal.querySelector('.modal-close')?.focus({ preventScroll: true });
    } else {
      helpBtn.focus({ preventScroll: true });
    }
  }
  helpBtn.addEventListener('click', () => toggleModal(true));
  helpModal.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', () => toggleModal(false));
  });

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        showToast('Fullscreen is not available in this browser.');
      });
    } else {
      document.exitFullscreen?.();
    }
  }
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    fullscreenBtn.classList.toggle('active', !!document.fullscreenElement);
  });

  const DAY_LENGTH = 246;
  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  const tmpColorA = new THREE.Color();
  const tmpColorB = new THREE.Color();
  const tmpColorC = new THREE.Color();
  const NIGHT_TOP = new THREE.Color('#061126');
  const NIGHT_HORIZON = new THREE.Color('#15243d');
  const NIGHT_BOTTOM = new THREE.Color('#0a1826');
  const DAY_TOP = new THREE.Color('#3c86d1');
  const DAY_HORIZON = new THREE.Color('#c9e9f0');
  const DAY_BOTTOM = new THREE.Color('#89b8ca');
  const DUSK_TOP = new THREE.Color('#3c4f87');
  const DUSK_HORIZON = new THREE.Color('#ff9b69');
  const DUSK_BOTTOM = new THREE.Color('#6f7c9c');
  let displayMinute = -1;
  let nightAmount = 0;
  let dayAmount = 1;

  function updateTime(dt) {
    const speed = state.fastSpeeds[state.speedIndex];
    state.time = (state.time + dt * speed / DAY_LENGTH) % 1;

    const theta = (state.time - 0.25) * TAU;
    sunDir.set(Math.cos(theta) * 0.9, Math.sin(theta), 0.36).normalize();
    moonDir.set(-Math.cos(theta) * 0.86, -Math.sin(theta) * 0.92, -0.3).normalize();

    const sunH = sunDir.y;
    dayAmount = smooth(-0.09, 0.34, sunH);
    nightAmount = 1 - smooth(-0.2, 0.05, sunH);
    const warm = clamp(1 - Math.abs(sunH) / 0.42, 0, 1) * smooth(-0.32, -0.02, sunH);

    const top = tmpColorA.copy(NIGHT_TOP).lerp(DAY_TOP, dayAmount);
    const horizon = tmpColorB.copy(NIGHT_HORIZON).lerp(DAY_HORIZON, dayAmount);
    const bottom = tmpColorC.copy(NIGHT_BOTTOM).lerp(DAY_BOTTOM, dayAmount);
    top.lerp(DUSK_TOP, warm * 0.72);
    horizon.lerp(DUSK_HORIZON, warm * 0.92);
    bottom.lerp(DUSK_BOTTOM, warm * 0.65);

    skyUniforms.uTop.value.copy(top);
    skyUniforms.uHorizon.value.copy(horizon);
    skyUniforms.uBottom.value.copy(bottom);
    skyUniforms.uSunDir.value.copy(sunDir);
    skyUniforms.uSunColor.value.copy(DUSK_HORIZON).lerp(new THREE.Color('#fff2c4'), 1 - warm * 0.55);
    skyUniforms.uSkyNight.value = nightAmount;
    if (scene.fog) scene.fog.color.copy(horizon).lerp(top, 0.18);

    const sunColor = tmpColorA.copy(new THREE.Color('#ffb36a')).lerp(new THREE.Color('#fff3d0'), smooth(0.0, 0.55, sunH));
    sunLight.position.copy(sunDir).multiplyScalar(55);
    sunLight.color.copy(sunColor);
    sunLight.intensity = 2.75 * smooth(-0.04, 0.22, sunH) * (0.72 + 0.28 * smooth(0, 0.5, sunH));
    moonLight.position.copy(moonDir).multiplyScalar(55);
    moonLight.intensity = 0.6 * nightAmount;

    hemi.color.copy(horizon).lerp(new THREE.Color('#eaf7ff'), 0.4);
    hemi.groundColor.setRGB(0.18 + 0.12 * dayAmount, 0.2 + 0.18 * dayAmount, 0.12 + 0.1 * dayAmount);
    hemi.intensity = 0.34 + dayAmount * 0.78;
    ambient.intensity = 0.1 + dayAmount * 0.14;
    ambient.color.copy(new THREE.Color('#ffdcae')).lerp(new THREE.Color('#a7c6ff'), nightAmount * 0.72);

    sunSprite.position.copy(sunDir).multiplyScalar(225);
    sunCore.position.copy(sunSprite.position);
    moonSprite.position.copy(moonDir).multiplyScalar(228);
    moonGlow.position.copy(moonSprite.position);
    sunSprite.material.opacity = clamp((sunH + 0.13) * 5, 0, 1) * (1 - warm * 0.15);
    sunCore.material.opacity = clamp((sunH + 0.09) * 7, 0, 1);
    moonSprite.material.opacity = clamp((moonDir.y + 0.04) * 7, 0, 0.95);
    moonGlow.material.opacity = clamp((moonDir.y + 0.05) * 5, 0, 0.6) * 0.55;
    const sunScale = 46 + warm * 12;
    sunSprite.scale.set(sunScale, sunScale, 1);

    starMat.uniforms.uTime.value += dt;
    starMat.uniforms.uOpacity.value = nightAmount * 0.95;
    ffMat.uniforms.uTime.value += dt * (0.5 + nightAmount * 0.75);
    ffMat.uniforms.uOpacity.value = smooth(0.05, 0.7, nightAmount) * 0.95;

    waterTex.offset.x += dt * 0.014;
    waterTex.offset.y += dt * 0.006;
    waterMat.opacity = 0.72 + dayAmount * 0.08;

    for (const s of contactShadows) s.mat.opacity = s.strength * (0.35 + dayAmount * 0.65);

    const glowBrightness = 0.66 + nightAmount * 0.5;
    glowMat.color.setScalar(glowBrightness);
    windowLight.intensity = nightAmount * 8.5;
    for (const l of lanternLights) l.intensity = nightAmount * 3.6;
    if (campfireLight) campfireLight.intensity = 1.1 + nightAmount * 4.2;

    const haloPulse = 0.84 + Math.sin(performance.now() * 0.0041) * 0.06;
    for (const halo of halos) {
      halo.material.opacity = nightAmount * halo.userData.strength * haloPulse;
    }
    for (const cloudMat of cloudMats) {
      cloudMat.color.copy(new THREE.Color('#d8eef2')).lerp(new THREE.Color('#22344d'), nightAmount * 0.95).lerp(DUSK_HORIZON, warm * 0.17);
      const high = cloudMat.userData.layer === 3;
      cloudMat.opacity = high ? 0.18 + dayAmount * 0.22 : 0.34 + dayAmount * 0.32;
    }

    const hour = state.time * 24;
    const minute = Math.floor((hour % 1) * 60);
    if (minute !== displayMinute) {
      displayMinute = minute;
      const hh = Math.floor(hour).toString().padStart(2, '0');
      const mm = minute.toString().padStart(2, '0');
      clockEl.textContent = `${hh}:${mm}`;
    }
    let phase;
    if (hour < 4.6) phase = 'deep night';
    else if (hour < 6.0) phase = 'first light';
    else if (hour < 8.2) phase = 'sunrise';
    else if (hour < 11.2) phase = 'morning';
    else if (hour < 15.8) phase = 'high sun';
    else if (hour < 18.0) phase = 'golden hour';
    else if (hour < 19.3) phase = 'sunset';
    else if (hour < 21.4) phase = 'dusk';
    else phase = 'night';
    if (phaseEl.textContent !== phase) phaseEl.textContent = phase;
    timeCard.classList.toggle('night', nightAmount > 0.35);
    document.body.classList.toggle('is-night', nightAmount > 0.4);

    // Project the sun into screen space for the CSS grade.
    const p = sunDir.clone().multiplyScalar(60).project(camera);
    document.documentElement.style.setProperty('--sun-x', `${clamp((p.x * 0.5 + 0.5) * 100, 0, 100)}%`);
    document.documentElement.style.setProperty('--sun-y', `${clamp((-p.y * 0.5 + 0.5) * 100, 0, 100)}%`);
  }

  /* --------------------------------------------------------------- movement */
  function groundHeightAt(x, z) {
    const bx = Math.round(x), bz = Math.round(z);
    if (waterBlocks.has(`${bx},${bz}`)) return null;
    const top = surfaceAt(bx, bz);
    if (top === undefined) return null;
    return top + 1;
  }

  function angleDelta(a, b) {
    let d = (b - a + Math.PI) % TAU;
    if (d < 0) d += TAU;
    return d - Math.PI;
  }

  function canStandAt(nx, nz, feetY) {
    const g = groundHeightAt(nx, nz);
    if (g === null) return false;
    if (player.grounded && g - feetY > 1.15) return false;
    if (!player.grounded && g - feetY > 0.7 && player.vy <= 0) return false;
    const samples = [[0, 0], [0.28, 0], [-0.28, 0], [0, 0.28], [0, -0.28]];
    for (const [ox, oz] of samples) {
      const bx = Math.floor(nx + ox);
      const bz = Math.floor(nz + oz);
      if (solid(bx, Math.floor(g + 0.45), bz)) return false;
      if (solid(bx, Math.floor(g + 1.5), bz)) return false;
    }
    return true;
  }

  let moveX = 0, moveZ = 0;
  function updatePlayer(dt) {
    let ix = 0, iz = 0;
    if (joy.active) {
      ix = joy.x;
      iz = joy.y;
    } else {
      if (keys.has('d') || keys.has('arrowright')) ix += 1;
      if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
      if (keys.has('w') || keys.has('arrowup')) iz += 1;
      if (keys.has('s') || keys.has('arrowdown')) iz -= 1;
    }
    const inLen = Math.hypot(ix, iz);
    if (inLen > 1) { ix /= inLen; iz /= inLen; }
    const active = Math.min(1, Math.hypot(ix, iz));

    const fx = -Math.sin(state.yaw);
    const fz = -Math.cos(state.yaw);
    const rx = Math.cos(state.yaw);
    const rz = -Math.sin(state.yaw);
    const speed = 4.45;
    const targetVX = (fx * iz + rx * ix) * speed;
    const targetVZ = (fz * iz + rz * ix) * speed;
    moveX = damp(moveX, targetVX, active > 0.02 ? 13 : 18, dt);
    moveZ = damp(moveZ, targetVZ, active > 0.02 ? 13 : 18, dt);

    if (Math.abs(moveX) < 0.005) moveX = 0;
    if (Math.abs(moveZ) < 0.005) moveZ = 0;

    const stepX = player.x + moveX * dt;
    if (canStandAt(stepX, player.z, player.y)) player.x = stepX;
    else moveX = 0;
    const stepZ = player.z + moveZ * dt;
    if (canStandAt(player.x, stepZ, player.y)) player.z = stepZ;
    else moveZ = 0;

    if (jumpQueued && player.grounded) {
      player.vy = 5.9;
      player.grounded = false;
      player.y += 0.02;
    }
    jumpQueued = false;

    const g = groundHeightAt(player.x, player.z);
    if (g !== null) {
      if (player.grounded) {
        if (g >= player.y) player.y = g;
        else if (g < player.y - 0.16) {
          player.grounded = false;
          player.vy = 0;
        } else player.y = g;
      }
      if (!player.grounded) {
        player.vy -= 19 * dt;
        player.y += player.vy * dt;
        if (player.y <= g && player.vy <= 0) {
          player.y = g;
          player.vy = 0;
          player.grounded = true;
        }
      }
    } else if (player.grounded) {
      // Safety net: never let the little explorer leave the island.
      player.x -= moveX * dt;
      player.z -= moveZ * dt;
      moveX = moveZ = 0;
    }

    const planarSpeed = Math.hypot(moveX, moveZ);
    player.speed = planarSpeed;
    player.moveAmount = damp(player.moveAmount, clamp(planarSpeed / speed, 0, 1), 12, dt);
    if (planarSpeed > 0.1) {
      const targetHeading = Math.atan2(moveX, moveZ);
      player.heading += angleDelta(player.heading, targetHeading) * Math.min(1, dt * 11);
    }

    const cycleSpeed = 8.4 * clamp(planarSpeed / speed, 0, 1.25);
    player.walkCycle += dt * cycleSpeed;
    const swing = Math.sin(player.walkCycle) * 0.72 * player.moveAmount;
    const air = !player.grounded;
    avatar.armL.rotation.x = air ? -0.4 : -swing;
    avatar.armR.rotation.x = air ? -0.4 : swing;
    avatar.legL.rotation.x = air ? 0.25 : swing * 0.9;
    avatar.legR.rotation.x = air ? -0.2 : -swing * 0.9;
    avatar.armL.rotation.z = air ? -0.2 : 0.03 + Math.abs(swing) * 0.08;
    avatar.armR.rotation.z = air ? 0.2 : -0.03 - Math.abs(swing) * 0.08;
    avatar.headPivot.rotation.y = Math.sin(player.walkCycle * 0.5) * 0.04 * player.moveAmount;
    avatar.body.scale.y = 1 + Math.sin(performance.now() * 0.0024) * 0.005;
    avatar.pack.rotation.z = -swing * 0.08;

    const bob = player.grounded ? Math.abs(Math.sin(player.walkCycle)) * 0.028 * player.moveAmount : 0;
    avatar.root.position.set(player.x, player.y + bob, player.z);
    avatar.root.rotation.y = player.heading;
    const shadowGround = groundHeightAt(player.x, player.z);
    if (shadowGround !== null) {
      avatarShadow.position.set(player.x, shadowGround + 0.026, player.z);
      avatarShadow.scale.setScalar(1 - clamp((player.y - shadowGround) * 0.08, 0, 0.3));
      avatarShadowMat.opacity = 0.3 - clamp((player.y - shadowGround) * 0.05, 0, 0.16);
    }

    // Warm rim light from the campfire, so the character reads at night.
    if (campfireLight) {
      const d = Math.hypot(player.x - 2.5, player.z - 8.5);
      campfireLight.intensity = (1.0 + nightAmount * 4.0) * (0.93 + Math.sin(performance.now() * 0.013) * 0.07);
    }
  }

  /* ----------------------------------------------------------------- camera */
  const cameraTarget = new THREE.Vector3(player.x, player.y + 1.25, player.z);
  function updateCamera(dt, snap = false) {
    state.yaw = damp(state.yaw, state.targetYaw, 12, dt);
    state.pitch = damp(state.pitch, state.targetPitch, 12, dt);
    state.dist = damp(state.dist, state.targetDist, 9, dt);

    const tYaw = state.yaw + state.tiltYaw;
    const tPitch = clamp(state.pitch + state.tiltPitch, 0.055, 1.2);
    const cp = Math.cos(tPitch);
    const lookAhead = isTouch ? 3.2 : 4.2;
    const desiredTarget = new THREE.Vector3(
      player.x - Math.sin(state.yaw) * lookAhead,
      player.y + 1.35,
      player.z - Math.cos(state.yaw) * lookAhead
    );
    const desiredPos = new THREE.Vector3(
      desiredTarget.x + Math.sin(tYaw) * cp * state.dist,
      desiredTarget.y + Math.sin(tPitch) * state.dist,
      desiredTarget.z + Math.cos(tYaw) * cp * state.dist
    );

    const camGround = groundHeightAt(desiredPos.x, desiredPos.z);
    if (camGround !== null) desiredPos.y = Math.max(desiredPos.y, camGround + 1.15);
    // Keep the camera above the pond surface too.
    if (desiredPos.y < 3.4 && waterBlocks.size) desiredPos.y = Math.max(desiredPos.y, 3.4);

    if (snap) {
      camera.position.copy(desiredPos);
      cameraTarget.copy(desiredTarget);
    } else {
      const posLerp = 1 - Math.exp(-7.5 * dt);
      camera.position.lerp(desiredPos, posLerp);
      cameraTarget.lerp(desiredTarget, 1 - Math.exp(-10 * dt));
    }
    camera.lookAt(cameraTarget);
    if (Math.abs(state.tiltRoll) > 0.0002) camera.rotateZ(state.tiltRoll);
  }
  updateCamera(1, true);

  /* ---------------------------------------------------------------- animate */
  let elapsed = 0;
  let lastFrame = performance.now();
  let bootDone = false;
  const cloudBase = cloudMeshes.map((m) => m.position.clone());

  function animate(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    elapsed += dt;

    updateTime(dt);
    updatePlayer(dt);
    updateCamera(dt);

    // Drifting clouds.
    for (let i = 0; i < cloudMeshes.length; i++) {
      const m = cloudMeshes[i];
      m.position.x = cloudBase[i].x + Math.sin(elapsed * m.userData.speed + m.userData.phase) * 5.5;
      m.position.z = cloudBase[i].z + Math.cos(elapsed * m.userData.speed * 0.7 + m.userData.phase) * 3.2;
    }

    // Birds wheeling over the island.
    for (const bird of birds) {
      const d = bird.userData;
      const a = elapsed * d.speed + d.phase;
      bird.position.set(Math.cos(a) * d.radius, d.height + Math.sin(a * 2.1) * 0.7, Math.sin(a) * d.radius);
      const flap = Math.sin(elapsed * 7 + d.phase * 4) * 0.55;
      d.wingL.rotation.z = flap;
      d.wingR.rotation.z = -flap;
      bird.rotation.y = -a + Math.PI / 2;
    }

    // Chimney smoke and rising embers.
    for (let i = 0; i < smokeCount; i++) {
      smokeLife[i] = (smokeLife[i] + dt * 0.11) % 1;
      const a = smokeLife[i];
      const spread = a * 1.8;
      smokePos[i * 3] = -8.5 + Math.sin(i * 2.1 + a * 5.5) * (0.18 + spread * 0.35);
      smokePos[i * 3 + 1] = cabinBase + 8 + a * 6.2;
      smokePos[i * 3 + 2] = -8 + Math.cos(i * 1.7 + a * 4.2) * (0.16 + spread * 0.28) + a * 0.8;
    }
    smokeGeo.attributes.position.needsUpdate = true;
    smokeTexMat.opacity = (0.12 + nightAmount * 0.06) * (0.8 + dayAmount * 0.3);

    for (let i = 0; i < emberCount; i++) {
      emberLife[i] = (emberLife[i] + dt * 0.42) % 1;
      const a = emberLife[i];
      emberPos[i * 3] = 2.5 + Math.sin(i * 3.2 + a * 10) * (0.25 + a * 0.45);
      emberPos[i * 3 + 1] = campfirePos.y + 0.1 + a * 2.4;
      emberPos[i * 3 + 2] = 8.5 + Math.cos(i * 2.3 + a * 8) * (0.25 + a * 0.4);
    }
    emberGeo.attributes.position.needsUpdate = true;
    petalMat.opacity = 0.5 + dayAmount * 0.42;

    // Cherry petals spiralling down around the blossom tree.
    for (let i = 0; i < petalCount; i++) {
      petalLife[i] = (petalLife[i] + dt * (0.09 + (i % 4) * 0.012)) % 1;
      const a = petalLife[i];
      const ang = petalMeta[i * 2] + elapsed * 0.32 + a * 2.2;
      const rad = petalMeta[i * 2 + 1] * (1 + a * 0.55);
      petalPos[i * 3] = 5.5 + Math.cos(ang) * rad;
      petalPos[i * 3 + 1] = blossomCrownY + 2.1 - a * 5.8;
      petalPos[i * 3 + 2] = 5.5 + Math.sin(ang) * rad;
    }
    petalGeo.attributes.position.needsUpdate = true;

    // Fire.
    if (flameGroup) {
      for (const flame of flameGroup.children) {
        if (!flame.userData.phase) continue;
        const ph = flame.userData.phase;
        flame.scale.y = 0.8 + Math.sin(elapsed * 11 + ph) * 0.28;
        flame.scale.x = 0.85 + Math.sin(elapsed * 8 + ph * 1.7) * 0.18;
        flame.position.y = flame.userData.baseY + Math.sin(elapsed * 9 + ph) * 0.055;
      }
      flameGroup.rotation.y += dt * 0.08;
    }

    // Character catch-light from windows.
    if (windowLight) windowLight.intensity = nightAmount * (8.2 + Math.sin(elapsed * 2.4) * 0.35);

    renderer.render(scene, camera);

    if (!bootDone) {
      bootDone = true;
      setBoot(100, 'Welcome to the isle.');
      setTimeout(() => {
        boot.classList.add('done');
        hint.classList.add('visible');
        setTimeout(() => {
          if (!introDismissed) hint.classList.remove('visible');
        }, 7600);
      }, 430);
    }
    requestAnimationFrame(animate);
  }

  /* ---------------------------------------------------------------- resize */
  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.85 : 2));
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 120));

  // Pause the clock if the tab is hidden, so a return visit still feels coherent.
  document.addEventListener('visibilitychange', () => { lastFrame = performance.now(); });

  /* ------------------------------------------------------------ public api */
  window.__VOXEL_ISLE__ = {
    setTime(value) {
      state.time = ((value % 1) + 1) % 1;
      updateTime(0);
    },
    get time() { return state.time; },
    setSpeed(index) {
      state.speedIndex = clamp(index, 0, state.fastSpeeds.length - 1);
      const speed = state.fastSpeeds[state.speedIndex];
      speedEl.textContent = `${speed}×`;
      timeCard.classList.toggle('fast', speed > 1);
    },
    teleport(x, z) {
      const g = groundHeightAt(x, z);
      if (g === null) return false;
      player.x = x; player.z = z; player.y = g; player.vy = 0;
      updateCamera(1, true);
      return true;
    },
    get player() { return { x: player.x, y: player.y, z: player.z }; },
    debugWorld() {
      const types = {};
      for (const t of blocks.values()) types[t] = (types[t] || 0) + 1;
      const samples = [];
      for (const [x, z] of [[0, 0], [2, 11], [2, 8], [-7, -7], [8, 4], [-8, 4], [12, 0]]) {
        const top = surfaceAt(x, z);
        const at = top === undefined ? null : blocks.get(key(x, top, z));
        samples.push({ x, z, top, at });
      }
      return { count: blocks.size, water: waterBlocks.size, types, samples };
    },
    scene, camera, renderer, state
  };

  // A tiny frame of grace before the curtain lifts.
  updateTime(0);
  setBoot(82, 'Lighting the windows…');
  requestAnimationFrame(animate);
})();
