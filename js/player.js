import * as THREE from 'three';
import { clamp, damp, lerp } from './util.js';

const SKIN = '#e6b585';
const SKIN_DARK = '#c98f63';
const SHIRT = '#2e8f82';
const SHIRT_DARK = '#237065';
const PANTS = '#2f405f';
const BOOT = '#6d472e';
const HAIR = '#3d2a1f';
const SCARF = '#e9774f';
const PACK = '#b97b43';

function box(w, h, d, color, extra = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, ...extra }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addLimb(parent, x, y, z, w, h, d, color, handColor = null) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const limb = box(w, h, d, color);
  limb.position.y = -h / 2;
  pivot.add(limb);
  if (handColor) {
    const hand = box(w * 1.04, h * 0.2, d * 1.04, handColor);
    hand.position.y = -h + h * 0.09;
    pivot.add(hand);
  }
  parent.add(pivot);
  return pivot;
}

export class PlayerController {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.position = new THREE.Vector3(1.2, 4, 7.2);
    this.velocity = new THREE.Vector3();
    this.radius = 0.28;
    this.onGround = true;
    this.speed = 0;
    this.walkPhase = 0;
    this.targetYaw = Math.PI;
    this.currentYaw = Math.PI;
    this.jumpQueued = false;
    this.coyote = 0;
    this.spawn = new THREE.Vector3(1.2, 4, 7.2);
    this.lastSafe = this.position.clone();
    this.falling = false;
    this.respawnFlash = 0;

    this.group = new THREE.Group();
    this.group.name = 'explorer';
    scene.add(this.group);
    this.buildAvatar();

    const h = world.getWalkHeight(this.spawn.x, this.spawn.z);
    if (h !== null) this.spawn.y = h;
    this.position.copy(this.spawn);
    this.group.position.copy(this.position);
    this.group.rotation.y = this.currentYaw;
    this.lastSafe.copy(this.position);
  }

  buildAvatar() {
    const body = new THREE.Group();
    this.body = body;
    this.group.add(body);

    const torso = box(0.56, 0.66, 0.34, SHIRT);
    torso.position.y = 1.05;
    body.add(torso);

    const belt = box(0.58, 0.09, 0.36, '#4b3524');
    belt.position.y = 0.73;
    body.add(belt);

    const collar = box(0.36, 0.09, 0.37, SHIRT_DARK);
    collar.position.y = 1.36;
    body.add(collar);

    const scarf = box(0.46, 0.12, 0.4, SCARF);
    scarf.position.set(0, 1.39, 0.01);
    body.add(scarf);
    const scarfTail = box(0.16, 0.44, 0.1, SCARF);
    scarfTail.position.set(0.18, 1.16, -0.24);
    scarfTail.rotation.z = -0.18;
    body.add(scarfTail);
    this.scarfTail = scarfTail;

    const head = box(0.55, 0.55, 0.55, SKIN);
    head.position.y = 1.66;
    body.add(head);

    const hair = box(0.58, 0.17, 0.58, HAIR);
    hair.position.y = 1.9;
    body.add(hair);
    const fringe = box(0.58, 0.1, 0.12, HAIR);
    fringe.position.set(0, 1.81, 0.26);
    body.add(fringe);
    const sideHair = box(0.08, 0.28, 0.52, HAIR);
    sideHair.position.set(-0.28, 1.7, 0);
    body.add(sideHair);

    const eyeL = box(0.075, 0.09, 0.03, '#28302f');
    eyeL.position.set(-0.115, 1.68, 0.285);
    body.add(eyeL);
    const eyeR = box(0.075, 0.09, 0.03, '#28302f');
    eyeR.position.set(0.115, 1.68, 0.285);
    body.add(eyeR);
    const nose = box(0.08, 0.07, 0.06, SKIN_DARK);
    nose.position.set(0, 1.58, 0.3);
    body.add(nose);

    const pack = box(0.42, 0.48, 0.22, PACK);
    pack.position.set(0, 1.05, -0.27);
    body.add(pack);
    const packFlap = box(0.36, 0.13, 0.24, '#d2a069');
    packFlap.position.set(0, 1.26, -0.29);
    body.add(packFlap);
    const bedroll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.62, 8),
      new THREE.MeshLambertMaterial({ color: '#e4c17c' }),
    );
    bedroll.rotation.z = Math.PI / 2;
    bedroll.position.set(0, 1.35, -0.39);
    bedroll.castShadow = true;
    body.add(bedroll);

    this.armL = addLimb(body, -0.37, 1.34, 0, 0.17, 0.59, 0.19, SHIRT, SKIN);
    this.armR = addLimb(body, 0.37, 1.34, 0, 0.17, 0.59, 0.19, SHIRT, SKIN);
    this.legL = addLimb(body, -0.16, 0.73, 0, 0.2, 0.62, 0.22, PANTS, BOOT);
    this.legR = addLimb(body, 0.16, 0.73, 0, 0.2, 0.62, 0.22, PANTS, BOOT);

    // A soft contact shadow so the explorer always feels grounded.
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.48, 18),
      new THREE.MeshBasicMaterial({
        color: '#12211e',
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.025;
    blob.renderOrder = 1;
    this.group.add(blob);
    this.blob = blob;
  }

  respawn() {
    const h = this.world.getWalkHeight(this.spawn.x, this.spawn.z);
    this.position.set(this.spawn.x, h ?? this.spawn.y, this.spawn.z);
    this.velocity.set(0, 0, 0);
    this.onGround = true;
    this.falling = false;
    this.lastSafe.copy(this.position);
    this.group.position.copy(this.position);
    this.respawnFlash = 1;
  }

  update(dt, input, cameraYaw) {
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    const mx = clamp(input.moveX || 0, -1, 1);
    const my = clamp(input.moveY || 0, -1, 1);
    const move = new THREE.Vector3()
      .addScaledVector(forward, my)
      .addScaledVector(right, mx);
    const mag = Math.min(1, move.length());
    if (mag > 0.001) move.normalize();

    const sprint = input.sprint && mag > 0.35;
    const maxSpeed = sprint ? 6.2 : 4.15;
    const targetSpeed = mag * maxSpeed;
    this.speed = damp(this.speed, targetSpeed, 12, dt);

    const oldX = this.position.x;
    const oldZ = this.position.z;
    const stepX = move.x * this.speed * dt;
    const stepZ = move.z * this.speed * dt;
    let nx = oldX + stepX;
    let nz = oldZ + stepZ;

    const currentGround = this.world.getWalkHeight(this.position.x, this.position.z);
    const nextGround = this.world.getWalkHeight(nx, nz);
    if (nextGround !== null && this.onGround && currentGround !== null) {
      if (nextGround > this.position.y + 1.08) {
        nx = oldX;
        nz = oldZ;
      }
    }
    this.position.x = nx;
    this.position.z = nz;

    if (input.jump && this.onGround) {
      this.velocity.y = 7.1;
      this.onGround = false;
      this.coyote = 0.12;
      input.jump = false;
    }

    if (!this.onGround) {
      this.coyote -= dt;
    }

    this.velocity.y -= 20.5 * dt;
    this.position.y += this.velocity.y * dt;
    const ground = this.world.getWalkHeight(this.position.x, this.position.z);
    if (ground !== null && this.position.y <= ground && this.velocity.y <= 0) {
      this.position.y = ground;
      this.velocity.y = 0;
      this.onGround = true;
      this.falling = false;
      this.lastSafe.copy(this.position);
    } else if (ground === null) {
      this.onGround = false;
      this.falling = true;
    }

    if (this.position.y < -25) {
      this.respawn();
      return { respawned: true, speed: this.speed };
    }

    if (mag > 0.05) {
      this.targetYaw = Math.atan2(move.x, move.z);
    }
    let diff = ((this.targetYaw - this.currentYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.currentYaw += diff * Math.min(1, dt * 11);
    this.group.rotation.y = this.currentYaw;
    this.group.position.copy(this.position);

    // Walk cycle and a little life in the idle pose.
    const stride = this.onGround ? this.speed : 0;
    this.walkPhase += dt * (3.2 + stride * 1.65);
    const swing = Math.sin(this.walkPhase * 2.1) * Math.min(1, stride / 3.5);
    const idle = Math.sin(this.walkPhase * 0.9) * 0.025;
    if (this.onGround) {
      this.legL.rotation.x = swing * 0.62;
      this.legR.rotation.x = -swing * 0.62;
      this.armL.rotation.x = -swing * 0.55;
      this.armR.rotation.x = swing * 0.55;
      this.body.position.y = Math.abs(Math.sin(this.walkPhase * 2.1)) * 0.035 * Math.min(1, stride / 3);
    } else {
      this.legL.rotation.x = damp(this.legL.rotation.x, -0.55, 8, dt);
      this.legR.rotation.x = damp(this.legR.rotation.x, 0.32, 8, dt);
      this.armL.rotation.x = damp(this.armL.rotation.x, -0.85, 8, dt);
      this.armR.rotation.x = damp(this.armR.rotation.x, -0.85, 8, dt);
      this.body.position.y = damp(this.body.position.y, 0.02, 8, dt);
    }
    this.body.rotation.z = Math.sin(this.walkPhase * 2.1) * 0.018 * Math.min(1, stride / 3) + idle;
    this.scarfTail.rotation.x = Math.sin(this.walkPhase * 1.7) * 0.08 + (this.onGround ? 0 : 0.35);
    this.blob.material.opacity = this.onGround ? 0.18 : 0.08;
    this.blob.position.y = 0.025;

    if (this.respawnFlash > 0) this.respawnFlash = Math.max(0, this.respawnFlash - dt * 1.5);

    return { respawned: false, speed: this.speed };
  }

  getFocus() {
    return new THREE.Vector3(this.position.x, this.position.y + 1.25, this.position.z);
  }
}
