import * as THREE from '../vendor/three.module.min.js';

function faceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#e7b486';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#d79b70';
  for (let i = 0; i < 40; i++) ctx.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 64), 1, 1);
  // fringe
  ctx.fillStyle = '#3a271c';
  ctx.fillRect(0, 0, 64, 12);
  ctx.fillRect(0, 12, 6, 8);
  ctx.fillRect(58, 12, 6, 8);
  ctx.fillRect(12, 12, 8, 4);
  ctx.fillRect(44, 12, 8, 4);
  // brows
  ctx.fillStyle = '#4b3325';
  ctx.fillRect(14, 25, 12, 3);
  ctx.fillRect(38, 25, 12, 3);
  // eyes
  ctx.fillStyle = '#f6f3e2';
  ctx.fillRect(15, 31, 12, 9);
  ctx.fillRect(37, 31, 12, 9);
  ctx.fillStyle = '#2b4c4f';
  ctx.fillRect(19, 33, 5, 6);
  ctx.fillRect(40, 33, 5, 6);
  ctx.fillStyle = '#0c1414';
  ctx.fillRect(21, 35, 2, 3);
  ctx.fillRect(42, 35, 2, 3);
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.fillRect(20, 33, 1, 1);
  ctx.fillRect(41, 33, 1, 1);
  // nose + mouth
  ctx.fillStyle = '#c88a64';
  ctx.fillRect(30, 42, 4, 3);
  ctx.fillStyle = '#8c4b40';
  ctx.fillRect(24, 50, 16, 3);
  ctx.fillStyle = '#f2c6a1';
  ctx.fillRect(26, 50, 12, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(0,0,0,.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,.26)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function mat(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, ...extra });
}

const SKIN = 0xe7b486;
const SHIRT = 0x2f7e79;
const SHIRT_LIGHT = 0x3d9990;
const TROUSERS = 0x2e4659;
const BOOTS = 0x302b28;
const HAIR = 0x3a271c;

export class Player {
  constructor(scene, world) {
    this.world = world;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Wanderer';
    this.model = new THREE.Group();
    this.group.add(this.model);
    scene.add(this.group);

    const spawnCol = world.columnAt(0.5, 8.5) || world.columnAt(0.5, 10.5);
    this.spawn = new THREE.Vector3(0.5, (spawnCol?.top ?? 8), 8.5);
    this.position = this.spawn.clone();
    this.velocityY = 0;
    this.onGround = true;
    this.facing = Math.PI;
    this.targetFacing = Math.PI;
    this.walkPhase = 0;
    this.walkDistance = 0;
    this.speedSmooth = 0;
    this.time = 0;
    this.respawning = false;
    this.onFootstep = null;
    this.onJump = null;
    this.onLand = null;

    this.buildModel();
    this.buildBlob();
    this.group.position.copy(this.position);
    this.group.rotation.y = this.facing;
  }

  buildModel() {
    const skin = mat(SKIN);
    const shirt = mat(SHIRT);
    const shirtLight = mat(SHIRT_LIGHT);
    const trousers = mat(TROUSERS);
    const boots = mat(BOOTS);
    const hair = mat(HAIR);
    const leather = mat(0x795034);
    const leatherDark = mat(0x53351f);

    // legs
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.17, 0.88, 0);
    const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.78, 0.32), trousers);
    leftLegMesh.position.y = -0.34;
    leftLegMesh.castShadow = true;
    this.leftLeg.add(leftLegMesh);
    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.4), boots);
    leftBoot.position.set(0, -0.72, 0.04);
    leftBoot.castShadow = true;
    this.leftLeg.add(leftBoot);

    this.rightLeg = this.leftLeg.clone();
    this.rightLeg.position.x = 0.17;
    this.model.add(this.leftLeg, this.rightLeg);

    // torso
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.36), shirt);
    body.position.y = 1.28;
    body.castShadow = true;
    body.receiveShadow = true;
    this.body = body;
    this.model.add(body);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 0.38), leatherDark);
    belt.position.y = 0.92;
    belt.castShadow = true;
    this.model.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.03), mat(0xd9b35e));
    buckle.position.set(0, 0.92, 0.2);
    this.model.add(buckle);

    // scarf
    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.15, 0.4), mat(0xb9543d));
    scarf.position.y = 1.68;
    scarf.castShadow = true;
    this.model.add(scarf);
    const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.08), mat(0xa44935));
    scarfTail.position.set(0.14, 1.47, -0.22);
    scarfTail.rotation.x = -0.24;
    scarfTail.castShadow = true;
    this.model.add(scarfTail);

    // head
    this.head = new THREE.Group();
    this.head.position.y = 1.8;
    const headGeo = new THREE.BoxGeometry(0.52, 0.52, 0.52);
    const faceMat = new THREE.MeshLambertMaterial({ map: faceTexture() });
    const headMesh = new THREE.Mesh(headGeo, [skin, skin, skin, skin, faceMat, skin]);
    headMesh.position.y = 0.26;
    headMesh.castShadow = true;
    this.head.add(headMesh);
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.13, 0.55), hair);
    hairTop.position.y = 0.54;
    hairTop.castShadow = true;
    this.head.add(hairTop);
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.42, 0.1), hair);
    hairBack.position.set(0, 0.29, -0.26);
    hairBack.castShadow = true;
    this.head.add(hairBack);
    this.model.add(this.head);

    // arms
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.45, 1.58, 0);
    const sleeveL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.28), shirtLight);
    sleeveL.position.y = -0.12;
    sleeveL.castShadow = true;
    this.leftArm.add(sleeveL);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.48, 0.24), skin);
    armL.position.y = -0.48;
    armL.castShadow = true;
    this.leftArm.add(armL);
    const handL = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.12, 0.23), skin);
    handL.position.y = -0.74;
    handL.castShadow = true;
    this.leftArm.add(handL);

    this.rightArm = this.leftArm.clone();
    this.rightArm.position.x = 0.45;
    this.model.add(this.leftArm, this.rightArm);

    // backpack
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.55, 0.26), leather);
    pack.position.set(0, 1.34, -0.29);
    pack.castShadow = true;
    this.model.add(pack);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.2, 0.28), leatherDark);
    flap.position.set(0, 1.55, -0.3);
    flap.castShadow = true;
    this.model.add(flap);
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.58, 0.04), leatherDark);
    strapL.position.set(-0.21, 1.33, 0.19);
    this.model.add(strapL);
    const strapR = strapL.clone();
    strapR.position.x = 0.21;
    this.model.add(strapR);

    // bedroll on top of the pack
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8), mat(0xb89057));
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, 1.67, -0.29);
    roll.castShadow = true;
    this.model.add(roll);

    // lantern on the backpack
    const lantern = new THREE.Group();
    lantern.position.set(-0.31, 1.12, -0.24);
    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), mat(0x4d3d2b));
    lantern.add(cage);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.16, 0.13),
      new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xff9a3c, emissiveIntensity: 2.2 })
    );
    glass.position.y = 0.01;
    lantern.add(glass);
    this.model.add(lantern);
    this.lantern = lantern;
    this.lanternLight = new THREE.PointLight(0xffb35f, 0, 8, 2);
    this.lanternLight.position.set(0, 0.1, 0);
    lantern.add(this.lanternLight);

    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  buildBlob() {
    const tex = blobTexture();
    const geo = new THREE.PlaneGeometry(1.5, 1.5);
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false });
    this.blob = new THREE.Mesh(geo, m);
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 1;
    this.scene.add(this.blob);
  }

  update(dt, input, cameraYaw, night = 0) {
    this.time += dt;
    const moveX = input.x;
    const moveY = input.y;
    const mag = Math.min(1, Math.hypot(moveX, moveY));
    const running = !!input.run;
    const maxSpeed = running ? 7.1 : 4.25;
    const targetSpeed = mag * maxSpeed;

    // camera-relative movement basis
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    let dirX = forwardX * moveY + rightX * moveX;
    let dirZ = forwardZ * moveY + rightZ * moveX;
    const dirLen = Math.hypot(dirX, dirZ);
    if (dirLen > 1e-4) {
      dirX /= dirLen;
      dirZ /= dirLen;
      this.targetFacing = Math.atan2(dirX, dirZ);
    }

    // smooth turning
    let delta = this.targetFacing - this.facing;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.facing += delta * Math.min(1, dt * 12);

    this.speedSmooth += (targetSpeed - this.speedSmooth) * Math.min(1, dt * 9);

    const step = this.speedSmooth * dt;
    if (step > 0.0001 && dirLen > 1e-4) {
      this.tryMove(dirX * step, dirZ * step, true);
      this.tryMove(0, 0, false);
    }

    // gravity and ground
    const ground = this.world.surfaceAt(this.position.x, this.position.z);
    this.velocityY -= 26 * dt;
    this.position.y += this.velocityY * dt;
    let landed = false;
    if (ground !== null) {
      if (this.position.y <= ground) {
        if (this.velocityY < -4.5 && !this.onGround) landed = true;
        this.position.y = ground;
        this.velocityY = 0;
        if (!this.onGround) this.onGround = true;
      } else if (this.position.y - ground > 0.02) {
        this.onGround = false;
      }
    } else {
      this.onGround = false;
    }

    // step up onto a block (Minecraft-ish little hop)
    if (ground !== null && this.onGround && this.position.y < ground) this.position.y = ground;

    if (input.jump && this.onGround) {
      this.velocityY = 8.6;
      this.onGround = false;
      input.jump = false;
      if (this.onJump) this.onJump();
    }

    if (landed && this.onLand) this.onLand();

    // walking animation
    if (this.onGround && this.speedSmooth > 0.3) {
      const stride = running ? 7.4 : 6.0;
      this.walkPhase += dt * stride * (0.55 + this.speedSmooth / maxSpeed * 0.55);
      this.walkDistance += step;
      if (this.walkDistance > (running ? 0.85 : 0.65)) {
        this.walkDistance = 0;
        if (this.onFootstep) this.onFootstep(running);
      }
    } else {
      this.walkPhase += dt * 1.1;
      this.walkDistance = 0;
    }

    const swing = Math.sin(this.walkPhase) * (this.onGround ? Math.min(1, this.speedSmooth / 4) : 0.2);
    const swingAmount = running ? 0.95 : 0.7;
    this.leftLeg.rotation.x = swing * swingAmount;
    this.rightLeg.rotation.x = -swing * swingAmount;
    this.leftArm.rotation.x = -swing * swingAmount * 0.85;
    this.rightArm.rotation.x = swing * swingAmount * 0.85;
    this.leftArm.rotation.z = 0.06 + Math.sin(this.time * 1.4) * 0.015;
    this.rightArm.rotation.z = -0.06 - Math.sin(this.time * 1.4) * 0.015;

    if (!this.onGround) {
      const jumpT = Math.min(1, Math.abs(this.velocityY) / 9);
      this.leftLeg.rotation.x = 0.35 * jumpT;
      this.rightLeg.rotation.x = -0.15 * jumpT;
      this.leftArm.rotation.x = -0.5;
      this.rightArm.rotation.x = 0.25;
    }

    const bob = this.onGround ? Math.abs(Math.sin(this.walkPhase)) * 0.035 * Math.min(1, this.speedSmooth / 4) : 0;
    this.model.position.y = bob;
    this.model.rotation.x = running && this.onGround ? -0.055 : 0;
    this.head.rotation.y = Math.sin(this.time * 0.7) * 0.04;
    this.head.rotation.x = Math.sin(this.time * 0.45) * 0.025 - (running ? 0.035 : 0);

    this.group.position.copy(this.position);
    this.group.rotation.y = this.facing;

    // lantern glow
    if (this.lanternLight) this.lanternLight.intensity = 0.5 + night * 1.9;
    if (this.lantern) this.lantern.rotation.z = Math.sin(this.walkPhase) * 0.08;

    // respawn if lost to the sky
    if (this.position.y < -24 && !this.respawning) {
      this.respawning = true;
      this.position.copy(this.spawn);
      this.position.y += 0.4;
      this.velocityY = 0;
      this.onGround = true;
      this.respawning = false;
      if (this.onRespawn) this.onRespawn();
    }

    // shadow blob
    if (this.blob) {
      const g = this.world.surfaceAt(this.position.x, this.position.z);
      if (g !== null) {
        this.blob.position.set(this.position.x, g + 0.015, this.position.z);
        const height = Math.max(0, this.position.y - g);
        this.blob.material.opacity = Math.max(0, 0.4 - height * 0.1);
        this.blob.scale.setScalar(Math.max(0.55, 1 - height * 0.08));
      } else {
        this.blob.material.opacity = 0;
      }
    }
    return { running, speed: this.speedSmooth, onGround: this.onGround };
  }

  tryMove(dx, dz, horizontal) {
    if (!horizontal) {
      // resolve the current cell after stepping up
      const g = this.world.surfaceAt(this.position.x, this.position.z);
      if (g !== null && this.position.y < g && g - this.position.y < 1.05 && this.onGround) this.position.y = g;
      return;
    }
    if (dx === 0 && dz === 0) return;
    const nx = this.position.x + dx;
    const nz = this.position.z + dz;

    const obstacleHit = (x, z) => {
      for (const o of this.world.obstacles) {
        if (this.position.y < o.top - 0.2 && Math.hypot(x - o.x, z - o.z) < o.r) return true;
      }
      return false;
    };

    const testX = (x, z) => {
      const surf = this.world.surfaceAt(x, z);
      if (surf === null) return true;
      if (surf - this.position.y > 1.02) return false;
      if (obstacleHit(x, z)) return false;
      return true;
    };

    if (testX(nx, this.position.z)) this.position.x = nx;
    if (testX(this.position.x, nz)) this.position.z = nz;
    const surf = this.world.surfaceAt(this.position.x, this.position.z);
    if (surf !== null && surf - this.position.y <= 1.02 && surf > this.position.y) {
      this.position.y = surf;
    }
  }

  respawn() {
    this.position.copy(this.spawn);
    this.position.y += 0.2;
    this.velocityY = 0;
    this.onGround = false;
  }

  get eyePosition() {
    return new THREE.Vector3(this.position.x, this.position.y + 1.55, this.position.z);
  }
}
