import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './util.js';

const PALETTES = [
  {
    t: 0.0,
    top: '#35557e', horizon: '#ffb47b', ground: '#5a4c5e',
    sun: '#ffd09a', light: '#ffd6ae', ambient: '#60769a', cloud: '#f7c9ae',
    sunIntensity: 0.7, moonIntensity: 0, hemi: 0.58, exposure: 1.04,
  },
  {
    t: 0.08,
    top: '#4f83b9', horizon: '#ffd0a1', ground: '#6c665b',
    sun: '#ffe0b3', light: '#ffe3bd', ambient: '#7695b5', cloud: '#ffe0c8',
    sunIntensity: 1.15, moonIntensity: 0, hemi: 0.72, exposure: 1.05,
  },
  {
    t: 0.2,
    top: '#3b8dd1', horizon: '#bfe8ff', ground: '#8ba17b',
    sun: '#fff3cf', light: '#fff1cc', ambient: '#91b5d0', cloud: '#fffdf3',
    sunIntensity: 1.75, moonIntensity: 0, hemi: 0.92, exposure: 1.07,
  },
  {
    t: 0.32,
    top: '#2d84cf', horizon: '#b4e5ff', ground: '#8da171',
    sun: '#fff8de', light: '#fff4d4', ambient: '#91b8d2', cloud: '#fffef6',
    sunIntensity: 1.85, moonIntensity: 0, hemi: 0.94, exposure: 1.06,
  },
  {
    t: 0.43,
    top: '#4d7fb6', horizon: '#ffd29b', ground: '#8c7c64',
    sun: '#ffd69b', light: '#ffdcb1', ambient: '#8499b0', cloud: '#ffe4c9',
    sunIntensity: 1.35, moonIntensity: 0, hemi: 0.75, exposure: 1.06,
  },
  {
    t: 0.5,
    top: '#3e4c83', horizon: '#ff8f66', ground: '#6b4f55',
    sun: '#ffab70', light: '#ffb181', ambient: '#77688c', cloud: '#f7a88c',
    sunIntensity: 0.7, moonIntensity: 0.03, hemi: 0.56, exposure: 1.02,
  },
  {
    t: 0.56,
    top: '#1b2852', horizon: '#925877', ground: '#3c394d',
    sun: '#e9a478', light: '#c89b9c', ambient: '#525a83', cloud: '#a97b8a',
    sunIntensity: 0.15, moonIntensity: 0.1, hemi: 0.42, exposure: 0.98,
  },
  {
    t: 0.64,
    top: '#071127', horizon: '#18294b', ground: '#171e30',
    sun: '#ffc78c', light: '#8495c5', ambient: '#2e3e66', cloud: '#66749a',
    sunIntensity: 0, moonIntensity: 0.28, hemi: 0.3, exposure: 0.92,
  },
  {
    t: 0.8,
    top: '#050b1e', horizon: '#13213f', ground: '#101828',
    sun: '#ffc78c', light: '#7b90c7', ambient: '#263a62', cloud: '#56688f',
    sunIntensity: 0, moonIntensity: 0.34, hemi: 0.27, exposure: 0.9,
  },
  {
    t: 0.9,
    top: '#0b1834', horizon: '#23345a', ground: '#1b2235',
    sun: '#ffd19e', light: '#8598c9', ambient: '#334a74', cloud: '#6a7a9d',
    sunIntensity: 0, moonIntensity: 0.25, hemi: 0.34, exposure: 0.94,
  },
  {
    t: 1.0,
    top: '#35557e', horizon: '#ffb47b', ground: '#5a4c5e',
    sun: '#ffd09a', light: '#ffd6ae', ambient: '#60769a', cloud: '#f7c9ae',
    sunIntensity: 0.7, moonIntensity: 0, hemi: 0.58, exposure: 1.04,
  },
];

function colorFrom(hex) {
  return new THREE.Color(hex);
}

function paletteAt(t) {
  const x = ((t % 1) + 1) % 1;
  let a = PALETTES[0];
  let b = PALETTES[PALETTES.length - 1];
  for (let i = 0; i < PALETTES.length - 1; i++) {
    if (x >= PALETTES[i].t && x <= PALETTES[i + 1].t) {
      a = PALETTES[i];
      b = PALETTES[i + 1];
      break;
    }
  }
  const span = Math.max(0.0001, b.t - a.t);
  const k = smoothstep(0, 1, (x - a.t) / span);
  const out = {};
  for (const key of ['top', 'horizon', 'ground', 'sun', 'light', 'ambient', 'cloud']) {
    out[key] = colorFrom(a[key]).lerp(colorFrom(b[key]), k);
  }
  for (const key of ['sunIntensity', 'moonIntensity', 'hemi', 'exposure']) {
    out[key] = lerp(a[key], b[key], k);
  }
  return out;
}

function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.98)');
  g.addColorStop(0.28, 'rgba(255,255,255,0.42)');
  g.addColorStop(0.52, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCloudData() {
  const clouds = [];
  let seed = 17;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let c = 0; c < 14; c++) {
    const cluster = {
      angle: random() * Math.PI * 2,
      radius: 26 + random() * 54,
      y: 14 + random() * 20,
      speed: 0.006 + random() * 0.008,
      cubes: [],
    };
    const count = 4 + Math.floor(random() * 5);
    for (let i = 0; i < count; i++) {
      cluster.cubes.push({
        x: (random() - 0.5) * 8,
        y: (random() - 0.5) * 1.5,
        z: (random() - 0.5) * 4.5,
        sx: 1.8 + random() * 3.2,
        sy: 0.9 + random() * 1.1,
        sz: 1.4 + random() * 2.8,
      });
    }
    clouds.push(cluster);
  }
  return clouds;
}

export class SkySystem {
  constructor(scene, renderer, { mobile = false } = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.mobile = mobile;
    this.time = 0.27;
    this.night = 0;
    this.sunDirection = new THREE.Vector3();
    this.moonDirection = new THREE.Vector3();
    this.palette = paletteAt(this.time);

    this.skyUniforms = {
      topColor: { value: new THREE.Color('#2d84cf') },
      horizonColor: { value: new THREE.Color('#b4e5ff') },
      groundColor: { value: new THREE.Color('#8da171') },
      sunColor: { value: new THREE.Color('#fff8de') },
      moonColor: { value: new THREE.Color('#dce9ff') },
      sunDirection: { value: new THREE.Vector3(0, 1, 0) },
      moonDirection: { value: new THREE.Vector3(0, -1, 0) },
      sunGlow: { value: 1 },
      moonGlow: { value: 0 },
    };

    const skyGeo = new THREE.SphereGeometry(420, 32, 18);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyUniforms,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 groundColor;
        uniform vec3 sunColor;
        uniform vec3 moonColor;
        uniform vec3 sunDirection;
        uniform vec3 moonDirection;
        uniform float sunGlow;
        uniform float moonGlow;
        varying vec3 vDir;

        void main() {
          vec3 dir = normalize(vDir);
          float up = pow(clamp(dir.y, 0.0, 1.0), 0.56);
          vec3 col = mix(horizonColor, topColor, up);
          float below = smoothstep(0.015, -0.2, dir.y);
          col = mix(col, groundColor, below * 0.92);

          float sd = max(dot(dir, normalize(sunDirection)), 0.0);
          col += sunColor * pow(sd, 700.0) * 1.8 * sunGlow;
          col += sunColor * pow(sd, 16.0) * 0.17 * sunGlow;
          col += sunColor * pow(sd, 3.0) * 0.045 * sunGlow;

          float md = max(dot(dir, normalize(moonDirection)), 0.0);
          col += moonColor * pow(md, 1100.0) * 1.6 * moonGlow;
          col += moonColor * pow(md, 30.0) * 0.1 * moonGlow;

          // A warm band of light that hugs the horizon near the sun.
          vec2 flatDir = normalize(dir.xz + vec2(0.00001));
          vec2 flatSun = normalize(sunDirection.xz + vec2(0.00001));
          float horizonBand = pow(max(dot(flatDir, flatSun), 0.0), 5.0);
          float twilight = 1.0 - smoothstep(0.02, 0.45, abs(sunDirection.y));
          col += sunColor * horizonBand * twilight * 0.1;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    scene.add(this.sky);

    // A star field that only wakes up after sunset.
    const starCount = mobile ? 480 : 800;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const sr = (() => {
      let s = 99;
      return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    })();
    for (let i = 0; i < starCount; i++) {
      const u = sr();
      const v = sr() * 0.86 + 0.04;
      const theta = u * Math.PI * 2;
      const y = v;
      const r = Math.sqrt(1 - y * y);
      const radius = 360;
      starPositions[i * 3] = Math.cos(theta) * r * radius;
      starPositions[i * 3 + 1] = y * radius;
      starPositions[i * 3 + 2] = Math.sin(theta) * r * radius;
      const warm = sr();
      starColors[i * 3] = 0.72 + warm * 0.28;
      starColors[i * 3 + 1] = 0.78 + warm * 0.2;
      starColors[i * 3 + 2] = 0.9 + warm * 0.1;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    this.starMaterial = new THREE.PointsMaterial({
      size: mobile ? 1.5 : 1.75,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMaterial);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -900;
    scene.add(this.stars);

    const glowTex = makeGlowTexture();
    this.sunMaterial = new THREE.SpriteMaterial({
      map: glowTex,
      color: '#fff5d0',
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    this.sunSprite = new THREE.Sprite(this.sunMaterial);
    this.sunSprite.scale.setScalar(34);
    this.sunSprite.renderOrder = -800;
    scene.add(this.sunSprite);

    this.moonMaterial = new THREE.SpriteMaterial({
      map: glowTex,
      color: '#dbe8ff',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    this.moonSprite = new THREE.Sprite(this.moonMaterial);
    this.moonSprite.scale.setScalar(22);
    this.moonSprite.renderOrder = -800;
    scene.add(this.moonSprite);

    // Clouds made of big soft cubes, drifting slowly around the island.
    this.clouds = makeCloudData();
    this.cloudDummy = new THREE.Object3D();
    this.cloudMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: '#fffdf3', flatShading: true }),
      this.clouds.reduce((sum, c) => sum + c.cubes.length, 0),
    );
    this.cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cloudMesh.frustumCulled = false;
    this.cloudMesh.castShadow = false;
    this.cloudMesh.receiveShadow = false;
    scene.add(this.cloudMesh);

    // Lighting rig.
    this.hemi = new THREE.HemisphereLight('#bfe8ff', '#6c624a', 0.9);
    scene.add(this.hemi);

    this.sunLight = new THREE.DirectionalLight('#fff1cc', 1.7);
    this.sunLight.position.set(35, 60, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    this.sunLight.shadow.camera.left = -25;
    this.sunLight.shadow.camera.right = 25;
    this.sunLight.shadow.camera.top = 28;
    this.sunLight.shadow.camera.bottom = -28;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 130;
    this.sunLight.shadow.bias = -0.00035;
    this.sunLight.shadow.normalBias = 0.025;
    this.sunLight.target.position.set(0, 0, 0);
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.moonLight = new THREE.DirectionalLight('#9db9ff', 0.15);
    this.moonLight.position.set(-30, 40, -20);
    this.moonLight.target.position.set(0, 0, 0);
    scene.add(this.moonLight);
    scene.add(this.moonLight.target);

    this.fog = new THREE.Fog('#bfe8ff', 36, 150);
    scene.fog = this.fog;

    this.scene.add(new THREE.AmbientLight('#ffffff', 0.08));
  }

  setTime(t) {
    this.time = ((t % 1) + 1) % 1;
    this.update(0, 0);
  }

  update(dt, elapsed) {
    this.time = ((this.time % 1) + 1) % 1;
    const palette = paletteAt(this.time);
    this.palette = palette;

    const theta = (this.time - 0.25) * Math.PI * 2;
    const sun = new THREE.Vector3(Math.sin(theta), Math.cos(theta), 0.18).normalize();
    const moon = new THREE.Vector3(-Math.sin(theta), -Math.cos(theta), -0.14).normalize();
    this.sunDirection.copy(sun);
    this.moonDirection.copy(moon);

    const day = smoothstep(-0.04, 0.16, sun.y);
    const night = smoothstep(0.04, -0.14, sun.y);
    this.night = night;

    this.skyUniforms.topColor.value.copy(palette.top);
    this.skyUniforms.horizonColor.value.copy(palette.horizon);
    this.skyUniforms.groundColor.value.copy(palette.ground);
    this.skyUniforms.sunColor.value.copy(palette.sun);
    this.skyUniforms.sunDirection.value.copy(sun);
    this.skyUniforms.moonDirection.value.copy(moon);
    this.skyUniforms.sunGlow.value = smoothstep(-0.1, 0.04, sun.y) * 1.1 + 0.2;
    this.skyUniforms.moonGlow.value = night * 0.9;

    this.starMaterial.opacity = night * 0.95;
    this.stars.visible = this.starMaterial.opacity > 0.015;
    this.stars.rotation.y = elapsed * 0.0025;

    this.sunSprite.position.copy(sun).multiplyScalar(310);
    this.moonSprite.position.copy(moon).multiplyScalar(310);
    this.sunMaterial.color.copy(palette.sun);
    this.sunMaterial.opacity = smoothstep(-0.14, 0.01, sun.y) * 0.95;
    this.sunSprite.visible = this.sunMaterial.opacity > 0.01;
    this.moonMaterial.opacity = night * 0.9;
    this.moonSprite.visible = this.moonMaterial.opacity > 0.01;

    this.hemi.color.copy(palette.ambient);
    this.hemi.groundColor.copy(palette.ground);
    this.hemi.intensity = palette.hemi;

    this.sunLight.color.copy(palette.light);
    this.sunLight.intensity = palette.sunIntensity * (0.28 + 0.72 * day);
    this.sunLight.position.copy(sun).multiplyScalar(70);
    this.sunLight.position.y = Math.max(2, this.sunLight.position.y);
    this.sunLight.visible = this.sunLight.intensity > 0.01;

    this.moonLight.color.copy(palette.light);
    this.moonLight.intensity = palette.moonIntensity * night;
    this.moonLight.position.copy(moon).multiplyScalar(55);
    this.moonLight.visible = this.moonLight.intensity > 0.005;

    this.renderer.toneMappingExposure = palette.exposure;

    this.fog.color.copy(palette.horizon);
    this.fog.near = lerp(40, 28, night);
    this.fog.far = lerp(160, 100, night);

    this.cloudMesh.material.color.copy(palette.cloud);
    this.cloudMesh.material.emissive?.copy(palette.cloud).multiplyScalar(0.06);

    const dummy = this.cloudDummy;
    let index = 0;
    for (const cloud of this.clouds) {
      const angle = cloud.angle + elapsed * cloud.speed;
      const cx = Math.cos(angle) * cloud.radius;
      const cz = Math.sin(angle) * cloud.radius;
      const bob = Math.sin(elapsed * 0.18 + cloud.angle * 3) * 0.4;
      for (const cube of cloud.cubes) {
        dummy.position.set(cx + cube.x, cloud.y + cube.y + bob, cz + cube.z);
        dummy.rotation.set(0, angle * 0.45, 0);
        dummy.scale.set(cube.sx, cube.sy, cube.sz);
        dummy.updateMatrix();
        this.cloudMesh.setMatrixAt(index++, dummy.matrix);
      }
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;

    // Keep the sky centered on the island, not the camera: the island is tiny
    // and the horizon needs to feel enormous.
    this.sky.position.set(0, 0, 0);
  }
}
