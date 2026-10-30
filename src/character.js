import * as THREE from './three.module.min.js';

export const SKINS = {
  kevin: {
    name: 'Kevin',
    body: 0xf7d51d,
    overalls: 0x2c5cc5,
    eyeCount: 2,
    eyeRadius: 0.118,
    height: 1.04,
    hair: 'spikes',
    unlock: 'Tall and dependable',
  },
  stuart: {
    name: 'Stuart',
    body: 0xf9d92a,
    overalls: 0x2c5cc5,
    eyeCount: 1,
    eyeRadius: 0.175,
    height: 0.98,
    hair: 'side',
    unlock: 'One eye, zero chill',
  },
  bob: {
    name: 'Bob',
    body: 0xffdb3d,
    overalls: 0x2c5cc5,
    eyeCount: 2,
    eyeRadius: 0.11,
    height: 0.86,
    hair: 'tuft',
    unlock: 'Small legs, big heart',
  },
  evil: {
    name: 'Evil',
    body: 0x9c6ade,
    overalls: 0x2c2c48,
    eyeCount: 2,
    eyeRadius: 0.12,
    height: 1.0,
    hair: 'wild',
    unlock: 'Bananas? For evil!',
    evil: true,
  },
};

export const SKIN_ORDER = ['kevin', 'stuart', 'bob', 'evil'];

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...opts });
  matCache.set(key, m);
  return m;
}

const GEO = {
  body: new THREE.CapsuleGeometry(0.37, 0.6, 10, 22),
  arm: new THREE.CapsuleGeometry(0.1, 0.34, 6, 12),
  leg: new THREE.CapsuleGeometry(0.085, 0.13, 5, 10),
  band: new THREE.TorusGeometry(0.35, 0.045, 8, 28),
  rim: new THREE.TorusGeometry(1, 0.24, 8, 26),
  eye: new THREE.CircleGeometry(1, 26),
  small: new THREE.SphereGeometry(1, 12, 10),
  hair: new THREE.CylinderGeometry(0.012, 0.026, 0.2, 5),
};

function mesh(geo, material, opts = {}) {
  const m = new THREE.Mesh(geo, material);
  if (opts.shadow !== false) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  return m;
}

function makeEye(skin, x, scale = 1) {
  const group = new THREE.Group();
  const rr = skin.eyeRadius * scale;

  const rim = mesh(GEO.rim, mat(0xc9d4e4, { metalness: 0.85, roughness: 0.28 }));
  rim.scale.setScalar(rr);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  const white = new THREE.Mesh(GEO.eye, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  white.scale.setScalar(rr * 0.88);
  white.position.z = 0.006;
  group.add(white);

  const iris = new THREE.Mesh(GEO.eye, new THREE.MeshBasicMaterial({ color: skin.evil ? 0xc23b3b : 0x6a4a24 }));
  iris.scale.setScalar(rr * 0.44);
  iris.position.set(0, -rr * 0.04, 0.011);
  group.add(iris);

  const pupil = new THREE.Mesh(GEO.eye, new THREE.MeshBasicMaterial({ color: 0x101018 }));
  pupil.scale.setScalar(rr * 0.24);
  pupil.position.set(0, -rr * 0.04, 0.015);
  group.add(pupil);

  const glint = new THREE.Mesh(GEO.eye, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  glint.scale.setScalar(rr * 0.1);
  glint.position.set(-rr * 0.17, rr * 0.18, 0.018);
  group.add(glint);

  group.position.set(x, 1.43, 0.35);
  group.userData.baseY = 1.43;
  group.userData.eyeScale = 1;
  return group;
}

function makeHair(skin) {
  const g = new THREE.Group();
  const hairMat = mat(0x17161f, { roughness: 0.85 });
  if (skin.hair === 'spikes') {
    for (let i = 0; i < 5; i++) {
      const h = mesh(GEO.hair, hairMat);
      h.position.set(-0.16 + i * 0.08, 1.69 + (i % 2) * 0.02, 0.03 - (i % 2) * 0.07);
      h.rotation.z = 0.5 - i * 0.27;
      h.rotation.x = -0.15 + (i % 2) * 0.4;
      h.scale.setScalar(0.9 + (i % 3) * 0.16);
      g.add(h);
    }
  } else if (skin.hair === 'side') {
    for (let i = 0; i < 3; i++) {
      const h = mesh(GEO.hair, hairMat);
      h.position.set(-0.12 + i * 0.1, 1.69, 0.04);
      h.rotation.z = 1.2 + i * 0.15;
      h.rotation.x = 0.5;
      h.scale.set(1, 1.4, 1);
      g.add(h);
    }
  } else if (skin.hair === 'tuft') {
    for (let i = 0; i < 3; i++) {
      const h = mesh(GEO.hair, hairMat);
      h.position.set(-0.03 + i * 0.05, 1.7, 0);
      h.rotation.z = 1.5 + i * 0.3;
      h.rotation.x = -0.3;
      h.scale.set(0.9, 0.8, 0.9);
      g.add(h);
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const h = mesh(GEO.hair, hairMat);
      const a = (i / 7) * Math.PI * 2;
      h.position.set(Math.cos(a) * 0.14, 1.69, Math.sin(a) * 0.12);
      h.rotation.z = Math.cos(a) * 1.1;
      h.rotation.x = Math.sin(a) * 1.1;
      h.scale.set(1.1, 1.5, 1.1);
      g.add(h);
    }
  }
  return g;
}

export class Minion {
  constructor(skinKey) {
    this.skinKey = skinKey;
    this.skin = SKINS[skinKey] || SKINS.kevin;
    this.group = new THREE.Group();
    this.baseScale = this.skin.height;

    this.modelRoot = new THREE.Group();
    this.modelRoot.scale.setScalar(this.baseScale);
    this.group.add(this.modelRoot);

    this.pivot = new THREE.Group();
    this.pivot.position.y = 0.9;
    this.modelRoot.add(this.pivot);

    this.parts = new THREE.Group();
    this.parts.position.y = -0.9;
    this.pivot.add(this.parts);

    this.build();
    this.time = Math.random() * 10;
    this.blinkIn = 1.5 + Math.random() * 3;
    this.blinkT = 0;
    this.wave = 0;
  }

  build() {
    const s = this.skin;
    const bodyMat = mat(s.body, { roughness: 0.46 });
    const overallMat = mat(s.overalls, { roughness: 0.72 });
    const darkMat = mat(0x1b1a24, { roughness: 0.62 });
    const whiteMat = mat(0xf4f4f2, { roughness: 0.7 });
    const blueDark = mat(s.evil ? 0x1e1e34 : 0x1f459c, { roughness: 0.7 });

    // body
    const body = mesh(GEO.body, bodyMat);
    body.position.y = 1.0;
    body.scale.set(1, 1, 0.96);
    this.parts.add(body);

    // shorts / overalls
    const shorts = mesh(new THREE.SphereGeometry(0.395, 22, 16), overallMat);
    shorts.position.y = 0.63;
    shorts.scale.set(1.0, 0.56, 0.98);
    this.parts.add(shorts);

    // bib
    const bib = mesh(new THREE.BoxGeometry(0.38, 0.32, 0.09), overallMat);
    bib.position.set(0, 0.86, 0.315);
    this.parts.add(bib);

    // bib pocket
    const pocket = mesh(new THREE.BoxGeometry(0.22, 0.13, 0.03), blueDark);
    pocket.position.set(0, 0.84, 0.365);
    this.parts.add(pocket);

    // straps
    for (const side of [-1, 1]) {
      const strap = mesh(new THREE.BoxGeometry(0.065, 0.3, 0.055), overallMat);
      strap.position.set(side * 0.155, 1.05, 0.305);
      strap.rotation.z = side * 0.1;
      strap.rotation.x = -0.12;
      this.parts.add(strap);
      const btn = mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.025, 10), whiteMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(side * 0.155, 0.98, 0.352);
      this.parts.add(btn);
    }

    // back straps + pocket
    for (const side of [-1, 1]) {
      const strap = mesh(new THREE.BoxGeometry(0.065, 0.34, 0.05), overallMat);
      strap.position.set(side * 0.15, 1.03, -0.305);
      strap.rotation.z = side * -0.08;
      strap.rotation.x = 0.12;
      this.parts.add(strap);
    }
    const backPocket = mesh(new THREE.BoxGeometry(0.24, 0.17, 0.03), overallMat);
    backPocket.position.set(0, 0.67, -0.366);
    this.parts.add(backPocket);
    const backPocketLine = mesh(new THREE.BoxGeometry(0.2, 0.02, 0.01), blueDark);
    backPocketLine.position.set(0, 0.725, -0.383);
    this.parts.add(backPocketLine);

    // waist seam
    const seam = mesh(new THREE.TorusGeometry(0.382, 0.017, 6, 26), blueDark);
    seam.rotation.x = Math.PI / 2;
    seam.position.y = 0.75;
    this.parts.add(seam);

    // arms
    this.arms = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.39, 1.19, 0);
      this.parts.add(pivot);

      const arm = mesh(GEO.arm, bodyMat);
      arm.position.y = -0.26;
      arm.rotation.z = side * -0.12;
      pivot.add(arm);

      const cuff = mesh(new THREE.CylinderGeometry(0.105, 0.1, 0.07, 12), darkMat);
      cuff.position.y = -0.46;
      pivot.add(cuff);

      const glove = mesh(GEO.small, darkMat);
      glove.scale.set(0.115, 0.13, 0.115);
      glove.position.y = -0.51;
      pivot.add(glove);

      pivot.userData.side = side;
      pivot.rotation.x = 0;
      this.arms.push(pivot);
    }

    // legs
    this.legs = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.165, 0.4, 0);
      this.parts.add(pivot);

      const leg = mesh(GEO.leg, overallMat);
      leg.position.y = -0.13;
      pivot.add(leg);

      const shoe = mesh(GEO.small, darkMat);
      shoe.scale.set(0.115, 0.075, 0.17);
      shoe.position.set(0, -0.255, 0.045);
      pivot.add(shoe);

      const sole = mesh(new THREE.BoxGeometry(0.21, 0.035, 0.33), mat(0x0d0d14, { roughness: 0.8 }));
      sole.position.set(0, -0.295, 0.04);
      pivot.add(sole);

      pivot.userData.side = side;
      this.legs.push(pivot);
    }

    // goggle band
    const band = mesh(GEO.band, darkMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 1.43;
    band.scale.set(1, 1, 0.94);
    this.parts.add(band);

    // goggle bridge
    const bridge = mesh(new THREE.BoxGeometry(0.1, 0.05, 0.05), mat(0xc9d4e4, { metalness: 0.8, roughness: 0.3 }));
    bridge.position.set(0, 1.43, 0.372);
    this.parts.add(bridge);

    // eyes
    this.eyes = [];
    if (s.eyeCount === 1) {
      const eye = makeEye(s, 0, 1.35);
      this.parts.add(eye);
      this.eyes.push(eye);
    } else {
      const eyeL = makeEye(s, -0.145, 1);
      const eyeR = makeEye(s, 0.145, 1);
      this.parts.add(eyeL, eyeR);
      this.eyes.push(eyeL, eyeR);
    }

    // nostrils
    for (const side of [-1, 1]) {
      const n = mesh(GEO.small, mat(0xd0a800, { roughness: 0.8 }));
      n.scale.set(0.013, 0.019, 0.008);
      n.position.set(side * 0.038, 1.265, 0.378);
      this.parts.add(n);
    }

    // smile
    const mouth = mesh(new THREE.TorusGeometry(0.105, 0.019, 6, 18, Math.PI), mat(0x3a2415, { roughness: 0.7 }));
    mouth.position.set(0, 1.135, 0.372);
    mouth.rotation.z = Math.PI;
    this.parts.add(mouth);

    // teeth hint
    const teeth = mesh(new THREE.BoxGeometry(0.09, 0.035, 0.012), whiteMat);
    teeth.position.set(0, 1.145, 0.379);
    this.parts.add(teeth);

    // hair
    this.parts.add(makeHair(s));

    // ear nubs
    for (const side of [-1, 1]) {
      const ear = mesh(GEO.small, bodyMat);
      ear.scale.set(0.035, 0.055, 0.045);
      ear.position.set(side * 0.362, 1.36, -0.01);
      this.parts.add(ear);
    }

    this.parts.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  setVisible(v) {
    this.group.visible = v;
  }

  /**
   * @param {number} dt
   * @param {{mode:string, speed:number, lean:number}} state
   */
  update(dt, state) {
    const mode = state.mode || 'run';
    const speed = state.speed || 0;
    this.time += dt;

    // blink
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkT = 0.11;
      this.blinkIn = 2.2 + Math.random() * 4;
    }
    if (this.blinkT > 0) this.blinkT -= dt;
    const eyeOpen = this.blinkT > 0 ? 0.1 : 1;
    for (const eye of this.eyes) {
      eye.scale.y += (eyeOpen - eye.scale.y) * Math.min(1, dt * 34);
    }

    let lean = state.lean || 0;
    const back = !!state.back;
    const pivot = this.pivot;
    const arms = this.arms;
    const legs = this.legs;

    if (mode === 'run') {
      const rate = 5.2 + Math.min(9, speed * 0.24);
      this.runPhase = (this.runPhase || 0) + dt * rate;
      const p = this.runPhase;
      const amp = 0.92;

      legs[0].rotation.x = Math.sin(p) * amp;
      legs[1].rotation.x = -Math.sin(p) * amp;
      arms[0].rotation.x = -Math.sin(p) * 0.8;
      arms[1].rotation.x = Math.sin(p) * 0.8;
      arms[0].rotation.z = -0.16;
      arms[1].rotation.z = 0.16;

      pivot.position.y = 0.9 + Math.abs(Math.sin(p)) * 0.045;
      pivot.rotation.x = (back ? 0.08 : -0.08) + Math.sin(p * 2) * 0.015;
      pivot.rotation.z = (back ? lean * 0.38 : -lean * 0.38) + Math.sin(p) * 0.025;
      pivot.rotation.y = Math.sin(p) * 0.035;

      // squash bounce
      const sy = 1 + Math.sin(p * 2) * 0.012;
      this.modelRoot.scale.set(this.baseScale * (2 - sy), this.baseScale * sy, this.baseScale * (2 - sy));
    } else if (mode === 'jump') {
      legs[0].rotation.x = 0.85;
      legs[1].rotation.x = -0.35;
      arms[0].rotation.x = -0.25;
      arms[1].rotation.x = -0.25;
      arms[0].rotation.z = -2.15;
      arms[1].rotation.z = 2.15;
      pivot.position.y = 0.9;
      pivot.rotation.x = back ? 0.15 : -0.15;
      pivot.rotation.z = back ? lean * 0.3 : -lean * 0.3;
      pivot.rotation.y = 0;
      this.modelRoot.scale.setScalar(this.baseScale);
    } else if (mode === 'roll') {
      const t = Math.min(1, Math.max(0, state.rollProgress || 0));
      legs[0].rotation.x = 1.5;
      legs[1].rotation.x = 1.5;
      arms[0].rotation.x = 1.2;
      arms[1].rotation.x = 1.2;
      arms[0].rotation.z = -0.5;
      arms[1].rotation.z = 0.5;
      pivot.rotation.x = (back ? 1 : -1) * t * Math.PI * 2;
      pivot.rotation.z = 0;
      pivot.position.y = 0.9;
      this.modelRoot.scale.set(this.baseScale * 1.02, this.baseScale * 0.94, this.baseScale * 1.02);
    } else if (mode === 'idle') {
      const t = this.time;
      this.wave = Math.max(0, this.wave - dt * 2);
      const waveOut = Math.sin(Math.min(1, this.wave) * Math.PI);
      legs[0].rotation.x *= 0.9;
      legs[1].rotation.x *= 0.9;
      arms[0].rotation.x = Math.sin(t * 1.2) * 0.06;
      arms[1].rotation.x = -Math.sin(t * 1.2) * 0.06;
      arms[0].rotation.z = -0.14 + Math.sin(t * 1.6) * 0.04;
      arms[1].rotation.z = 0.14 - Math.sin(t * 1.6) * 0.04;
      if (waveOut > 0) {
        arms[1].rotation.z = 0.14 + waveOut * 2.15;
        arms[1].rotation.x = Math.sin(t * 12) * 0.35 * waveOut;
      }
      pivot.position.y = 0.9 + Math.sin(t * 1.9) * 0.022;
      pivot.rotation.z = Math.sin(t * 1.1) * 0.025;
      pivot.rotation.x = -0.03;
      pivot.rotation.y = Math.sin(t * 0.6) * 0.08;
      this.modelRoot.scale.setScalar(this.baseScale);
    } else if (mode === 'crash') {
      const t = Math.min(1, state.crashProgress || 0);
      legs[0].rotation.x = 1.2;
      legs[1].rotation.x = 0.6;
      arms[0].rotation.x = -1.8;
      arms[1].rotation.x = -1.4;
      arms[0].rotation.z = -1.5;
      arms[1].rotation.z = 1.5;
      pivot.rotation.x = (back ? -1 : 1) * t * 1.9;
      pivot.rotation.z = t * 0.6;
      pivot.position.y = 0.9 - t * 0.25;
      this.modelRoot.scale.setScalar(this.baseScale);
    }
  }

  triggerWave() {
    this.wave = 1;
  }
}
