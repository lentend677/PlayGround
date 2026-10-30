import * as THREE from './three.module.min.js';
import {
  makeTrackTexture,
  makeConcreteTexture,
  makeFacadeTexture,
  makeBillboardTexture,
  makeCloudTexture,
  makeGlowTexture,
} from './textures.js';

const TRACK_LEN = 380;
const TRACK_TILE = 9.5;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.buildings = [];
    this.lamps = [];
    this.billboards = [];
    this.clouds = [];
    this.time = 0;
    this.buildSky();
    this.buildTrack();
    this.buildCity();
    this.buildProps();
    this.buildClouds();
  }

  buildSky() {
    const top = new THREE.Color(0x2f7be8);
    const mid = new THREE.Color(0x9fd6ff);
    const bottom = new THREE.Color(0xffe0a8);
    const geo = new THREE.SphereGeometry(280, 32, 18);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: top },
        uMid: { value: mid },
        uBottom: { value: bottom },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uBottom;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 c = mix(uBottom, uMid, smoothstep(-0.08, 0.16, h));
          c = mix(c, uTop, smoothstep(0.12, 0.72, h));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false;
    this.scene.add(sky);

    // Sun glow
    const glow = makeGlowTexture('rgba(255,246,200,1)', 'rgba(255,214,120,0)');
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow,
      color: 0xfff3c4,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }));
    sun.position.set(-55, 52, -185);
    sun.scale.set(52, 52, 1);
    this.scene.add(sun);

    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow,
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }));
    core.position.set(-55, 52, -184);
    core.scale.set(16, 16, 1);
    this.scene.add(core);
  }

  buildTrack() {
    const trackTex = makeTrackTexture();
    this.trackTex = trackTex;
    const groundMat = new THREE.MeshStandardMaterial({
      map: trackTex,
      roughness: 0.95,
      metalness: 0.02,
      color: 0xb9b9c4,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(12.4, TRACK_LEN), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -TRACK_LEN / 2 + 20);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // rails
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xd7dce4,
      metalness: 0.92,
      roughness: 0.28,
    });
    const railGeo = new THREE.BoxGeometry(0.095, 0.1, TRACK_LEN);
    for (const laneX of [-2.5, 0, 2.5]) {
      for (const off of [-0.72, 0.72]) {
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(laneX + off, 0.105, -TRACK_LEN / 2 + 20);
        rail.castShadow = true;
        rail.receiveShadow = true;
        this.scene.add(rail);
      }
    }

    // side concrete platforms
    const conc = makeConcreteTexture();
    const concMat = new THREE.MeshStandardMaterial({ map: conc, roughness: 0.9, color: 0xd9dbe2 });
    const platGeo = new THREE.BoxGeometry(2.4, 0.62, TRACK_LEN);
    for (const side of [-1, 1]) {
      const plat = new THREE.Mesh(platGeo, concMat);
      plat.position.set(side * 7.3, 0.31, -TRACK_LEN / 2 + 20);
      plat.receiveShadow = true;
      this.scene.add(plat);

      // safe yellow edge line
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.035, TRACK_LEN),
        new THREE.MeshStandardMaterial({ color: 0xffcf2e, roughness: 0.65, emissive: 0x4a3600, emissiveIntensity: 0.5 })
      );
      line.position.set(side * 6.15, 0.63, -TRACK_LEN / 2 + 20);
      this.scene.add(line);

      // low wall behind platform
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 1.15, TRACK_LEN),
        new THREE.MeshStandardMaterial({ color: 0x3d4a6e, roughness: 0.8 })
      );
      wall.position.set(side * 8.55, 0.58, -TRACK_LEN / 2 + 20);
      this.scene.add(wall);
    }

    // wide distant ground plane
    const far = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 500),
      new THREE.MeshStandardMaterial({ color: 0x4b5c76, roughness: 1 })
    );
    far.rotation.x = -Math.PI / 2;
    far.position.set(0, -0.02, -220);
    far.receiveShadow = false;
    this.scene.add(far);
  }

  buildCity() {
    this.facades = [];
    this.facadeMats = [];
    for (let i = 0; i < 6; i++) {
      const map = makeFacadeTexture(i);
      this.facades.push(map);
      this.facadeMats.push(new THREE.MeshStandardMaterial({
        map,
        roughness: 0.82,
        metalness: 0.05,
        color: 0xd8dbe8,
        emissive: 0x2b3f6b,
        emissiveIntensity: 0.5,
      }));
    }
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c3550, roughness: 0.9 });
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    for (let side of [-1, 1]) {
      for (let i = 0; i < 15; i++) {
        const mesh = new THREE.Mesh(boxGeo, roofMat);
        this.placeBuilding(mesh, side, 24 - i * 29 - Math.random() * 10, true);
        this.scene.add(mesh);
        this.buildings.push(mesh);
      }
    }

    // distant skyline blocks (static, cheap)
    for (let i = 0; i < 26; i++) {
      const h = 20 + Math.random() * 40;
      const w = 14 + Math.random() * 20;
      const mesh = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.61, 0.22, 0.45 + Math.random() * 0.08),
        fog: true,
      }));
      mesh.position.set((Math.random() - 0.5) * 180, h / 2, -270 - Math.random() * 70);
      mesh.scale.set(w, h, 14);
      this.scene.add(mesh);
    }
  }

  placeBuilding(mesh, side, z, initial = false) {
    const w = 6 + Math.random() * 6;
    const h = 9 + Math.random() * 26;
    const d = 7 + Math.random() * 10;
    mesh.scale.set(w, h, d);
    mesh.position.set(side * (10.8 + Math.random() * 8.5), h / 2, z);
    mesh.material = this.facadeMats[(Math.random() * this.facadeMats.length) | 0];
    mesh.rotation.y = (side > 0 ? -1 : 1) * (0.04 + Math.random() * 0.12);
    mesh.userData.side = side;
    if (!initial) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
    return mesh;
  }

  buildProps() {
    // billboards
    const kinds = ['banana', 'rush', 'yay'];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(8.6, 4.3),
        new THREE.MeshBasicMaterial({ map: makeBillboardTexture(kinds[i % 3]), side: THREE.DoubleSide })
      );
      sign.position.y = 1.4;
      g.add(sign);
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(9.1, 4.8, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x131c38, roughness: 0.7 })
      );
      frame.position.z = -0.16;
      frame.position.y = 1.4;
      g.add(frame);
      const postGeo = new THREE.BoxGeometry(0.22, 5.2, 0.22);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x39435f, roughness: 0.7 });
      for (const px of [-2.8, 2.8]) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(px, -1.3, -0.1);
        g.add(post);
      }
      const side = i % 2 === 0 ? -1 : 1;
      g.position.set(side * 11.4, 5.4, 4 - i * 105);
      g.rotation.y = side > 0 ? -Math.PI / 2 - 0.16 : Math.PI / 2 + 0.16;
      g.userData.side = side;
      this.scene.add(g);
      this.billboards.push(g);
    }

    // lamp posts
    const poleGeo = new THREE.CylinderGeometry(0.075, 0.1, 4.6, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x26324f, roughness: 0.55, metalness: 0.35 });
    const armGeo = new THREE.BoxGeometry(0.8, 0.09, 0.09);
    const headGeo = new THREE.BoxGeometry(0.42, 0.11, 0.22);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfff6cf,
      emissive: 0xffe6a0,
      emissiveIntensity: 1.6,
      roughness: 0.35,
    });
    for (let side of [-1, 1]) {
      for (let i = 0; i < 11; i++) {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 2.9;
        pole.castShadow = true;
        g.add(pole);
        const arm = new THREE.Mesh(armGeo, poleMat);
        arm.position.set(-side * 0.38, 5.12, 0);
        g.add(arm);
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(-side * 0.75, 5.08, 0);
        g.add(head);
        g.position.set(side * 6.55, 0.6, 12 - i * 38 - Math.random() * 5);
        this.scene.add(g);
        this.lamps.push(g);
      }
    }
  }

  buildClouds() {
    const cloudTex = makeCloudTexture();
    for (let i = 0; i < 11; i++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.5 + Math.random() * 0.35,
        depthWrite: false,
        fog: false,
      });
      const s = new THREE.Sprite(mat);
      const scale = 18 + Math.random() * 30;
      s.scale.set(scale, scale * 0.52, 1);
      s.position.set(-75 + Math.random() * 150, 16 + Math.random() * 28, -240 + Math.random() * 240);
      this.scene.add(s);
      this.clouds.push(s);
    }
  }

  update(dt, speed) {
    this.time += dt;
    const dz = speed * dt;
    this.trackTex.offset.y += dz / TRACK_TILE;

    for (const b of this.buildings) {
      b.position.z += dz;
      if (b.position.z > 38) {
        this.placeBuilding(b, b.userData.side, -420 - Math.random() * 40);
      }
    }

    for (const g of this.billboards) {
      g.position.z += dz;
      if (g.position.z > 40) {
        g.position.z -= 440;
        g.position.x = g.userData.side * 11.4;
      }
    }

    for (const g of this.lamps) {
      g.position.z += dz;
      if (g.position.z > 36) g.position.z -= 420;
    }

    for (const c of this.clouds) {
      c.position.z += dz * 0.06 + dt * 0.35;
      c.position.x += dt * 0.25;
      if (c.position.z > 40) {
        c.position.z = -250;
        c.position.x = -75 + Math.random() * 150;
      }
      if (c.position.x > 90) c.position.x = -90;
    }
  }
}
