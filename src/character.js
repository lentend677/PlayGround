import * as THREE from 'three'
import { createGunMesh, createPickaxe } from './weapons.js'

const skinMatCache = new Map()
function skinMat(color) {
  if (!skinMatCache.has(color)) skinMatCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.75 }))
  return skinMatCache.get(color)
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

export function createCharacter(colors) {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)

  const jacket = new THREE.MeshStandardMaterial({ color: colors.jacket, roughness: 0.62 })
  const pants = new THREE.MeshStandardMaterial({ color: colors.pants, roughness: 0.85 })
  const hat = new THREE.MeshStandardMaterial({ color: colors.hat, roughness: 0.7 })
  const pack = new THREE.MeshStandardMaterial({ color: colors.pack, roughness: 0.72 })
  const skin = skinMat(colors.skin)
  const dark = new THREE.MeshStandardMaterial({ color: 0x222733, roughness: 0.8 })
  const boot = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.9 })
  const glow = new THREE.MeshStandardMaterial({ color: 0x8ff8ff, emissive: 0x39d7e8, emissiveIntensity: 1.8, roughness: 0.3 })

  const torso = mesh(new THREE.CapsuleGeometry(0.27, 0.26, 4, 10), jacket, 0, 1.36, 0)
  torso.scale.z = 0.8
  body.add(torso)
  const chest = mesh(new THREE.BoxGeometry(0.5, 0.32, 0.14), dark, 0, 1.42, 0.21)
  body.add(chest)
  const belt = mesh(new THREE.BoxGeometry(0.52, 0.1, 0.36), dark, 0, 1.08, 0)
  body.add(belt)
  const shoulderL = mesh(new THREE.BoxGeometry(0.2, 0.18, 0.3), jacket, -0.34, 1.56, 0)
  const shoulderR = shoulderL.clone()
  shoulderR.position.x = 0.34
  body.add(shoulderL, shoulderR)

  const head = new THREE.Group()
  head.position.y = 1.82
  body.add(head)
  const skull = mesh(new THREE.SphereGeometry(0.205, 14, 12), skin, 0, 0, 0)
  head.add(skull)
  const cap = mesh(new THREE.SphereGeometry(0.215, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hat, 0, 0.04, 0)
  head.add(cap)
  const brim = mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.04, 12), hat, 0, 0.04, 0.09)
  brim.scale.z = 0.72
  head.add(brim)
  const eyeL = mesh(new THREE.SphereGeometry(0.027, 8, 6), dark, -0.075, -0.01, 0.19)
  const eyeR = eyeL.clone()
  eyeR.position.x = 0.075
  head.add(eyeL, eyeR)
  const earpiece = mesh(new THREE.BoxGeometry(0.05, 0.13, 0.12), glow, 0.2, 0, 0)
  head.add(earpiece)

  const armL = new THREE.Group()
  armL.position.set(-0.36, 1.6, 0)
  const armR = new THREE.Group()
  armR.position.set(0.36, 1.6, 0)
  for (const [arm, dir] of [[armL, -1], [armR, 1]]) {
    const upper = mesh(new THREE.CapsuleGeometry(0.095, 0.3, 4, 8), jacket, 0, -0.22, 0)
    upper.scale.z = 0.85
    arm.add(upper)
    const hand = mesh(new THREE.SphereGeometry(0.085, 8, 6), skin, 0, -0.47, 0)
    arm.add(hand)
    arm.rotation.z = dir * 0.08
    body.add(arm)
  }

  const legL = new THREE.Group()
  legL.position.set(-0.16, 0.98, 0)
  const legR = new THREE.Group()
  legR.position.set(0.16, 0.98, 0)
  for (const leg of [legL, legR]) {
    const thigh = mesh(new THREE.CapsuleGeometry(0.13, 0.4, 4, 8), pants, 0, -0.32, 0)
    leg.add(thigh)
    const shin = mesh(new THREE.CapsuleGeometry(0.11, 0.28, 4, 8), pants, 0, -0.69, 0)
    leg.add(shin)
    const shoe = mesh(new THREE.BoxGeometry(0.22, 0.16, 0.36), boot, 0, -0.9, 0.05)
    leg.add(shoe)
    body.add(leg)
  }

  const packMesh = mesh(new THREE.BoxGeometry(0.46, 0.56, 0.26), pack, 0, 1.38, -0.33)
  body.add(packMesh)
  const packTrim = mesh(new THREE.BoxGeometry(0.48, 0.12, 0.28), dark, 0, 1.5, -0.33)
  body.add(packTrim)
  for (const x of [-0.16, 0.16]) {
    const strap = mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), dark, x, 1.38, 0.06)
    body.add(strap)
  }

  const gunHolder = new THREE.Group()
  gunHolder.position.set(0.32, 1.36, 0.34)
  body.add(gunHolder)
  const pickaxe = createPickaxe()
  pickaxe.visible = false
  pickaxe.position.set(0.36, 0.9, 0.25)
  pickaxe.rotation.set(0.2, 0, -0.2)
  body.add(pickaxe)

  const glider = createGlider()
  glider.position.y = 2.65
  glider.visible = false
  root.add(glider)

  root.userData = {
    body, head, armL, armR, legL, legR, gunHolder, pickaxe, glider,
    torso, packMesh, hat, colors, walkPhase: 0, recoil: 0, swing: 0, flash: 0,
  }
  return root
}

function createGlider() {
  const group = new THREE.Group()
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x22c3b1, roughness: 0.6, side: THREE.DoubleSide })
  const canopyMat2 = new THREE.MeshStandardMaterial({ color: 0xffc23d, roughness: 0.6, side: THREE.DoubleSide })
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x233040, roughness: 0.5, metalness: 0.4 })
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 1.5), i === 1 ? canopyMat2 : canopyMat)
    m.position.set(-1.05 + i * 1.05, 0.18 - Math.abs(i - 1) * 0.12, 0)
    m.rotation.z = (i - 1) * -0.16
    m.castShadow = true
    group.add(m)
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6), strutMat)
  bar.rotation.z = Math.PI / 2
  bar.position.y = -0.1
  group.add(bar)
  for (const side of [-1, 1]) {
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.25, 4), strutMat)
    line.position.set(side * 0.35, -0.75, 0.05)
    line.rotation.z = side * 0.28
    group.add(line)
  }
  return group
}

export function createHealthBar() {
  const group = new THREE.Group()
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.18, 0.13),
    new THREE.MeshBasicMaterial({ color: 0x0a0f18, transparent: true, opacity: 0.7, depthWrite: false }),
  )
  group.add(bg)
  const hp = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.075),
    new THREE.MeshBasicMaterial({ color: 0x6ff26f, depthWrite: false }),
  )
  hp.position.z = 0.01
  group.add(hp)
  const shieldBg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.045),
    new THREE.MeshBasicMaterial({ color: 0x1a2d44, transparent: true, opacity: 0.6, depthWrite: false }),
  )
  shieldBg.position.y = 0.1
  shieldBg.position.z = 0.01
  shieldBg.visible = false
  group.add(shieldBg)
  const shield = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.035),
    new THREE.MeshBasicMaterial({ color: 0x58c8ff, depthWrite: false }),
  )
  shield.position.y = 0.1
  shield.position.z = 0.02
  shield.visible = false
  group.add(shield)
  group.userData = { hp, shield, shieldBg, bg }
  group.visible = false
  return group
}

export function setWeapon(model, weapon) {
  const holder = model.userData.gunHolder
  while (holder.children.length) holder.remove(holder.children[0])
  if (!weapon) return null
  const gun = createGunMesh(weapon.defId, weapon.color)
  holder.add(gun)
  return gun
}

export function animateCharacter(model, dt, opts = {}) {
  const u = model.userData
  const speed = opts.speed || 0
  const aiming = !!opts.aiming
  const drop = !!opts.drop
  const moving = speed > 0.4
  u.walkPhase += dt * (moving ? Math.min(13, 5 + speed * 1.5) : 2.4)
  const swingSpeed = Math.min(1, speed / 6)
  const swing = Math.sin(u.walkPhase) * 0.62 * swingSpeed
  const idle = Math.sin(u.walkPhase * 0.8) * 0.015
  u.body.position.y = Math.abs(Math.sin(u.walkPhase)) * 0.045 * swingSpeed + idle
  u.body.rotation.x = aiming ? 0.06 : moving ? 0.05 * swingSpeed : 0
  if (drop) {
    u.legL.rotation.x = 0.35 + Math.sin(u.walkPhase * 1.3) * 0.12
    u.legR.rotation.x = 0.2 + Math.sin(u.walkPhase * 1.3 + 1) * 0.12
    u.armL.rotation.x = -2.35
    u.armR.rotation.x = -2.35
    u.glider.visible = true
    u.glider.rotation.z = Math.sin(u.walkPhase * 0.8) * 0.09
    u.glider.rotation.y = Math.sin(u.walkPhase * 0.5) * 0.06
    u.body.rotation.z = Math.sin(u.walkPhase * 0.7) * 0.04
  } else {
    u.glider.visible = false
    u.body.rotation.z *= 0.9
    u.legL.rotation.x = swing
    u.legR.rotation.x = -swing
    if (aiming) {
      u.armR.rotation.x = -1.48
      u.armR.rotation.z = 0.08
      u.armL.rotation.x = -1.18
      u.armL.rotation.z = -0.2
    } else {
      u.armL.rotation.x = -swing * 0.7
      u.armR.rotation.x = swing * 0.7
      u.armL.rotation.z = -0.08
      u.armR.rotation.z = 0.08
    }
  }
  if (u.swing > 0) {
    u.swing = Math.max(0, u.swing - dt * 2.4)
    const t = 1 - u.swing / 0.42
    u.pickaxe.rotation.x = -1.8 + t * 2.4
    u.pickaxe.rotation.z = -0.2 + t * 0.5
    u.armR.rotation.x = -1.9 + t * 2.2
  } else {
    u.pickaxe.rotation.set(0.2, 0, -0.2)
  }
  u.head.rotation.y = aiming ? Math.sin(u.walkPhase * 0.3) * 0.03 : Math.sin(u.walkPhase * 0.4) * 0.05
  u.gunHolder.position.y = 1.36 + (u.recoil > 0 ? -u.recoil * 0.06 : 0)
  u.recoil = Math.max(0, u.recoil - dt * 5)
}
