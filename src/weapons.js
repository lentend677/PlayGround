import * as THREE from 'three'
import { makeRng } from './utils.js'

export const RARITIES = [
  { id: 'common', name: 'Common', color: '#c3ccd6', glow: '#9aa6b2', mult: 1.0 },
  { id: 'uncommon', name: 'Uncommon', color: '#63e06b', glow: '#37b845', mult: 1.08 },
  { id: 'rare', name: 'Rare', color: '#4db2ff', glow: '#1688e8', mult: 1.16 },
  { id: 'epic', name: 'Epic', color: '#c979ff', glow: '#9b3ff0', mult: 1.26 },
  { id: 'legendary', name: 'Legendary', color: '#ffbb38', glow: '#e58b00', mult: 1.38 },
]

export const WEAPON_DEFS = {
  ar: {
    id: 'ar', name: 'Ranger AR', short: 'AR', ammo: 'medium', ammoName: 'Medium',
    damage: 24, fireRate: 5.4, mag: 30, reload: 1.9, spread: 0.016, pellets: 1,
    range: 190, auto: true, recoil: 0.011, moveSpread: 0.6,
    desc: 'Reliable all-round automatic rifle.',
  },
  smg: {
    id: 'smg', name: 'Zip SMG', short: 'SMG', ammo: 'light', ammoName: 'Light',
    damage: 12, fireRate: 10.5, mag: 32, reload: 1.65, spread: 0.031, pellets: 1,
    range: 95, auto: true, recoil: 0.007, moveSpread: 0.8,
    desc: 'Shreds up close. Feeds on light ammo.',
  },
  shotgun: {
    id: 'shotgun', name: 'Boomstick', short: 'SG', ammo: 'shells', ammoName: 'Shells',
    damage: 9.5, fireRate: 1.15, mag: 6, reload: 2.2, spread: 0.072, pellets: 9,
    range: 48, auto: false, recoil: 0.05, moveSpread: 0.4,
    desc: 'Nine pellets of close-range persuasion.',
  },
  sniper: {
    id: 'sniper', name: 'Longshot', short: 'SNP', ammo: 'heavy', ammoName: 'Heavy',
    damage: 88, fireRate: 0.62, mag: 4, reload: 2.7, spread: 0.0015, pellets: 1,
    range: 330, auto: false, recoil: 0.055, moveSpread: 1.6, scope: 4.2,
    desc: 'One shot, one highlight reel.',
  },
  pistol: {
    id: 'pistol', name: 'Sidekick', short: 'PST', ammo: 'light', ammoName: 'Light',
    damage: 22, fireRate: 4.4, mag: 15, reload: 1.35, spread: 0.021, pellets: 1,
    range: 120, auto: false, recoil: 0.015, moveSpread: 0.7,
    desc: 'Small, snappy, surprisingly rude.',
  },
}

export const AMMO_MAX = { light: 240, medium: 240, shells: 48, heavy: 24 }

export function rollRarity(rand = Math.random) {
  const r = rand()
  if (r < 0.36) return 0
  if (r < 0.67) return 1
  if (r < 0.86) return 2
  if (r < 0.965) return 3
  return 4
}

export function makeWeapon(defId, rarityIdx = 0, ammoBonus = 0) {
  const def = WEAPON_DEFS[defId]
  const rarity = RARITIES[rarityIdx]
  const mag = def.mag
  return {
    defId,
    rarity: rarityIdx,
    name: def.name,
    rarityName: rarity.name,
    color: rarity.color,
    damage: def.damage * rarity.mult,
    mag,
    magSize: mag,
    reserve: Math.round((def.id === 'sniper' ? 8 : def.id === 'shotgun' ? 14 : 60) + ammoBonus),
    cooldown: 0,
    reloading: 0,
    shots: 0,
  }
}

export function randomWeapon(rand = Math.random) {
  const defs = ['ar', 'smg', 'shotgun', 'sniper', 'pistol']
  const weights = [0.3, 0.26, 0.2, 0.1, 0.14]
  let r = rand()
  let defId = defs[0]
  for (let i = 0; i < defs.length; i++) {
    r -= weights[i]
    if (r <= 0) { defId = defs[i]; break }
  }
  return makeWeapon(defId, rollRarity(rand), Math.floor(rand() * 30))
}

const gunMats = {}
function mat(key, color, rough = 0.55, metal = 0.25) {
  const k = key + color
  if (!gunMats[k]) gunMats[k] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })
  return gunMats[k]
}

function addBox(group, m, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m)
  mesh.position.set(x, y, z)
  mesh.rotation.set(rx, ry, rz)
  mesh.castShadow = true
  group.add(mesh)
  return mesh
}

function addCyl(group, m, x, y, z, r, len, rx = Math.PI / 2, seg = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m)
  mesh.position.set(x, y, z)
  mesh.rotation.x = rx
  mesh.castShadow = true
  group.add(mesh)
  return mesh
}

export function createGunMesh(defId, rarityColor = '#c3ccd6') {
  const group = new THREE.Group()
  const body = mat('body-', 0x2b3140, 0.5, 0.45)
  const dark = mat('dark-', 0x151924, 0.55, 0.35)
  const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(rarityColor), roughness: 0.4, metalness: 0.35, emissive: new THREE.Color(rarityColor), emissiveIntensity: 0.22 })
  const wood = mat('wood-', 0x6d4327, 0.8, 0.05)
  let muzzleZ = 0.6

  if (defId === 'ar') {
    addBox(group, body, 0, 0, 0.08, 0.12, 0.16, 0.62)
    addBox(group, dark, 0, 0.095, 0.02, 0.07, 0.04, 0.42)
    addBox(group, accent, 0, 0.02, -0.12, 0.13, 0.07, 0.16)
    addBox(group, dark, 0, -0.12, 0.09, 0.075, 0.19, 0.13, 0.22)
    addBox(group, wood, 0, -0.01, -0.34, 0.09, 0.13, 0.24)
    addCyl(group, dark, 0, 0.025, 0.47, 0.028, 0.46)
    addBox(group, dark, 0, 0.09, 0.2, 0.03, 0.07, 0.1)
    muzzleZ = 0.72
  } else if (defId === 'smg') {
    addBox(group, body, 0, 0, 0.04, 0.11, 0.16, 0.42)
    addBox(group, accent, 0, 0.085, 0.02, 0.09, 0.05, 0.28)
    addBox(group, dark, 0, -0.16, 0.05, 0.06, 0.24, 0.09)
    addBox(group, wood, 0, -0.02, -0.24, 0.07, 0.1, 0.15)
    addCyl(group, dark, 0, 0.02, 0.28, 0.023, 0.2)
    muzzleZ = 0.4
  } else if (defId === 'shotgun') {
    addBox(group, body, 0, 0, 0.06, 0.13, 0.14, 0.55)
    addCyl(group, dark, -0.035, 0.055, 0.35, 0.036, 0.56)
    addCyl(group, dark, 0.035, 0.055, 0.35, 0.036, 0.56)
    addBox(group, accent, 0, -0.02, 0.12, 0.15, 0.06, 0.3)
    addBox(group, wood, 0, -0.03, -0.29, 0.11, 0.16, 0.34)
    addBox(group, dark, 0, -0.12, -0.1, 0.08, 0.1, 0.12)
    muzzleZ = 0.64
  } else if (defId === 'sniper') {
    addBox(group, body, 0, 0, 0.1, 0.1, 0.14, 0.7)
    addBox(group, accent, 0, 0.01, -0.05, 0.11, 0.06, 0.24)
    addCyl(group, dark, 0, 0.03, 0.62, 0.021, 0.75)
    addCyl(group, dark, 0, 0.14, 0.06, 0.045, 0.3, Math.PI / 2, 8)
    addBox(group, dark, 0, 0.12, 0.06, 0.07, 0.07, 0.24)
    addBox(group, wood, 0, -0.02, -0.38, 0.09, 0.15, 0.32)
    addBox(group, dark, 0, -0.13, -0.14, 0.08, 0.16, 0.1)
    addCyl(group, dark, 0, 0.03, 0.99, 0.032, 0.06)
    muzzleZ = 1.02
  } else {
    addBox(group, body, 0, 0.02, 0.06, 0.1, 0.13, 0.34)
    addBox(group, accent, 0, 0.1, 0.02, 0.09, 0.035, 0.22)
    addBox(group, dark, 0, -0.08, 0.02, 0.07, 0.16, 0.1, 0.2)
    addBox(group, dark, 0, 0.04, 0.23, 0.04, 0.05, 0.12)
    muzzleZ = 0.28
  }

  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.02, muzzleZ)
  group.add(muzzle)
  group.userData.muzzle = muzzle
  return group
}

export function createPickaxe() {
  const group = new THREE.Group()
  const wood = mat('wood-', 0x6d4327, 0.8, 0.05)
  const metal = mat('pick-', 0xc7d0da, 0.35, 0.75)
  const grip = mat('grip-', 0x222a38, 0.8, 0.1)
  addCyl(group, wood, 0, 0, 0.12, 0.032, 0.95)
  addCyl(group, grip, 0, 0, 0.02, 0.038, 0.18)
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.62, 4), metal)
  head.position.set(0, 0.06, 0.58)
  head.rotation.set(Math.PI / 2, Math.PI / 4, 0)
  head.scale.set(1, 1, 0.45)
  head.castShadow = true
  group.add(head)
  addBox(group, metal, 0, -0.17, 0.4, 0.05, 0.36, 0.16, 0, 0, 0.55)
  group.userData.muzzle = new THREE.Object3D()
  group.userData.muzzle.position.set(0, 0, 0.7)
  group.add(group.userData.muzzle)
  return group
}

export function makeWeaponIcon(defId) {
  return { ar: '⌐╦', smg: '≡', shotgun: '⋙', sniper: '—', pistol: '¬' }[defId] || '•'
}
