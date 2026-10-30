import * as THREE from 'three'
import { clamp, damp, lerp, PLAYER_COLORS, angleDelta } from './utils.js'
import { makeWeapon, WEAPON_DEFS, AMMO_MAX } from './weapons.js'
import { createCharacter, setWeapon, animateCharacter } from './character.js'

const UP = new THREE.Vector3(0, 1, 0)

export class Player {
  constructor(game) {
    this.game = game
    this.world = game.world
    this.input = game.input
    this.fx = game.fx
    this.audio = game.audio
    this.ui = game.ui
    this.camera = game.camera
    this.model = createCharacter(PLAYER_COLORS)
    game.scene.add(this.model)

    this.pos = new THREE.Vector3()
    this.vel = new THREE.Vector3()
    this.spawn = { x: 0, z: 0 }
    this.camYaw = 0
    this.camPitch = -0.05
    this.camDist = 5.4
    this.aimFactor = 0
    this.radius = 0.42
    this.reset({ x: 0, z: 20 })
  }

  reset(spawn) {
    this.spawn = spawn
    this.pos.set(spawn.x, this.world.heightAt(spawn.x, spawn.z) + 26, spawn.z)
    this.vel.set(0, 0, 0)
    this.hp = 100
    this.maxHp = 100
    this.shield = 0
    this.maxShield = 100
    this.wood = 160
    this.kills = 0
    this.damageDealt = 0
    this.state = 'drop'
    this.dead = false
    this.grounded = false
    this.vy = 0
    this.current = 1
    this.weapons = [makeWeapon('ar', 0), null]
    this.weapon = this.weapons[0]
    this.fireCooldown = 0
    this.triggerHeld = false
    this.reloadT = 0
    this.reloadTotal = 0
    this.lastDamage = -99
    this.buildMode = false
    this.buildType = 'wall'
    this.buildCooldown = 0
    this.ghost = null
    this.walkDust = 0
    this.stepTimer = 0
    this.aimAssistTarget = null
    this.dropSway = Math.random() * 6
    this.slotPulse = 0
    this.camYaw = Math.random() * Math.PI * 2
    this.camPitch = -0.12
    this.camPos = null
    this.model.position.copy(this.pos)
    this.model.rotation.set(0, this.camYaw, 0)
    this.model.userData.swing = 0
    this.model.userData.pickaxe.visible = false
    this.gun = setWeapon(this.model, this.weapon)
    this.model.userData.gunHolder.visible = true
    this.game.scene.add(this.model)
  }

  get alive() { return !this.dead }
  get forward() { return new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw)) }
  get right() { return new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw)) }
  get eye() { return this.pos.clone().add(new THREE.Vector3(0, 1.55, 0)) }
  get chest() { return this.pos.clone().add(new THREE.Vector3(0, 1.2, 0)) }

  setBuildType(type) {
    this.buildType = type
    this._rebuildGhost()
    this.ui.setBuildType(type)
  }

  _rebuildGhost() {
    if (this.ghost) {
      this.game.scene.remove(this.ghost)
      this.ghost.traverse((o) => { if (o.isMesh) o.geometry?.dispose?.() })
    }
    this.ghost = this.world.makeGhost(this.buildType)
    this.game.scene.add(this.ghost)
    this.ghost.visible = this.buildMode
  }

  toggleBuild() {
    if (this.state !== 'active') return
    this.buildMode = !this.buildMode
    if (this.buildMode && !this.ghost) this._rebuildGhost()
    if (this.ghost) this.ghost.visible = this.buildMode
    this.ui.setBuildMode(this.buildMode, this.buildType)
    this.audio.click()
  }

  equip(n) {
    if (n === 0) {
      this.current = 0
      this.weapon = null
      setWeapon(this.model, null)
      this.model.userData.pickaxe.visible = true
      this.model.userData.gunHolder.visible = true
      this.reloadT = 0
      this.slotPulse = 1
      return
    }
    const w = this.weapons[n - 1]
    if (!w) return
    this.current = n
    this.weapon = w
    this.gun = setWeapon(this.model, w)
    this.model.userData.pickaxe.visible = false
    this.reloadT = 0
    this.slotPulse = 1
    this.audio.click()
  }

  cycleWeapon() {
    const options = [0]
    if (this.weapons[0]) options.push(1)
    if (this.weapons[1]) options.push(2)
    const i = options.indexOf(this.current)
    this.equip(options[(i + 1) % options.length])
  }

  pickupWeapon(weapon) {
    let slot = -1
    if (!this.weapons[0]) slot = 0
    else if (!this.weapons[1]) slot = 1
    if (slot >= 0) {
      this.weapons[slot] = weapon
      this.equip(slot + 1)
      this.ui.toast(`${weapon.rarityName} ${weapon.name}`, weapon.color, 'equipped')
      return true
    }
    const current = this.weapon
    let worst = 0
    if (this.weapons[1] && this.weapons[1].rarity < this.weapons[0].rarity) worst = 1
    if (weapon.rarity > this.weapons[worst].rarity) {
      this.weapons[worst] = weapon
      this.equip(worst + 1)
      this.ui.toast(`${weapon.rarityName} ${weapon.name}`, weapon.color, 'upgraded')
      return true
    }
    // convert into ammo for the equipped gun
    if (current) current.reserve = Math.min(AMMO_MAX[current.defId === 'sniper' ? 'heavy' : 'medium'] || 240, current.reserve + 30)
    this.ui.toast('Ammo +30', '#ffd166', 'chest')
    return false
  }

  addShield(n) {
    this.shield = clamp(this.shield + n, 0, this.maxShield)
  }

  heal(n) {
    this.hp = clamp(this.hp + n, 0, this.maxHp)
  }

  reload() {
    const w = this.weapon
    if (!w || this.reloadT > 0) return
    if (w.mag >= w.magSize || w.reserve <= 0) return
    this.reloadT = this.reloadTotal = WEAPON_DEFS[w.defId].reload
    this.audio.reload()
  }

  update(dt) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt)
    this.buildCooldown = Math.max(0, this.buildCooldown - dt)
    this.slotPulse = Math.max(0, this.slotPulse - dt * 3)
    this.model.userData.recoil = Math.max(0, this.model.userData.recoil - dt * 5)
    if (this.reloadT > 0) {
      this.reloadT -= dt
      if (this.reloadT <= 0) {
        this.reloadT = 0
        const w = this.weapon
        if (w && w.mag < w.magSize) {
          const need = w.magSize - w.mag
          const take = Math.min(need, w.reserve)
          w.mag += take
          w.reserve -= take
        }
      }
    }
    if (this.state === 'drop') this._updateDrop(dt)
    else if (this.state === 'active') this._updateActive(dt)
    this._updateCamera(dt)
    animateCharacter(this.model, dt, {
      speed: this.vel.length(),
      aiming: this.input.aiming || this.input.firing,
      drop: this.state === 'drop',
    })
    this.model.position.copy(this.pos)
    this.model.rotation.y = this.camYaw
    if (this.ghost && this.buildMode) {
      const p = this.world.buildPlacement(this.buildType, this.pos, this.camYaw)
      this.ghost.position.set(p.x, p.y, p.z)
      this.ghost.rotation.y = p.yaw
      this.ghost.visible = true
      const affordable = this.wood >= p.cost
      this.world.ghostMat.color.setHex(affordable ? 0x5ce8ff : 0xff5566)
      this.world.ghostMat.emissive.setHex(affordable ? 0x33cced : 0xcc2233)
      this._ghostPlacement = p
    } else if (this.ghost) {
      this.ghost.visible = false
    }
    // health regen
    if (this.state === 'active' && this.hp < this.maxHp && this.game.matchTime - this.lastDamage > 7) {
      this.hp = Math.min(this.maxHp, this.hp + 5.5 * dt)
    }
    this.shotsJustFired = false
  }

  _updateDrop(dt) {
    const input = this.input
    const speed = 15
    const move = new THREE.Vector2(input.move.x, input.move.y)
    if (move.length() > 1) move.normalize()
    const f = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw))
    const r = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw))
    this.pos.x += (f.x * move.y + r.x * move.x) * speed * dt
    this.pos.z += (f.z * move.y + r.z * move.x) * speed * dt
    this.pos.y -= 26 * dt
    this.dropSway += dt
    const floor = this.world.supportAt(this.pos.x, this.pos.z, this.pos.y, 0.5)
    if (this.pos.y <= floor + 0.02) {
      this.pos.y = floor
      this.state = 'active'
      this.vel.set(0, 0, 0)
      this.audio.land()
      this.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 0xd8c49a, 14, 3.2, 0.16)
      this.game.onPlayerLanded()
    }
  }

  _updateActive(dt) {
    const input = this.input
    const move = new THREE.Vector2(input.move.x, input.move.y)
    const mag = Math.min(1, move.length())
    if (mag > 0.05) move.normalize()
    else move.set(0, 0)
    const forward = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw))
    const right = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw))
    const water = this.world.heightAt(this.pos.x, this.pos.z) < 0.35
    let maxSpeed = input.sprinting || mag > 0.94 ? 7.6 : 5.9
    if (water) maxSpeed = 3.2
    const desired = new THREE.Vector3()
    desired.addScaledVector(forward, move.y)
    desired.addScaledVector(right, move.x)
    if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(maxSpeed * mag)
    const accel = this.grounded ? 14 : 4
    this.vel.x = damp(this.vel.x, desired.x, accel, dt)
    this.vel.z = damp(this.vel.z, desired.z, accel, dt)

    const wasGrounded = this.grounded
    this.pos.x += this.vel.x * dt
    this.pos.z += this.vel.z * dt
    this.world.resolveCircle(this.pos, this.radius, this.pos.y, 1.75)
    const support = this.world.supportAt(this.pos.x, this.pos.z, this.pos.y, this.radius)
    if (this.grounded) {
      if (support > this.pos.y - 0.2 && support < this.pos.y + 0.62) {
        this.pos.y = support
        this.vy = 0
      } else if (support < this.pos.y - 0.2) {
        this.grounded = false
      }
    }
    if (!this.grounded) {
      this.vy -= 25 * dt
      this.pos.y += this.vy * dt
      if (this.pos.y <= support) {
        this.pos.y = support
        if (this.vy < -5) {
          this.audio.land()
          this.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 0.1, 0)), 0xd8c49a, 6, 1.6, 0.12)
        }
        this.vy = 0
        this.grounded = true
      }
    }
    if (wasGrounded && !this.grounded && this.vy === 0) this.vy = 0.1

    if (input.actions.jump && this.grounded) {
      this.vy = 8.6
      this.grounded = false
      this.audio.jump()
      this.fx.burst(this.pos.clone(), 0xe8dfc8, 5, 1.2, 0.09)
    }
    if (this.pos.y < 0.25) {
      this.pos.y = 0.25
      this.vy = Math.max(0, this.vy)
      this.grounded = false
    }
    const r = Math.hypot(this.pos.x, this.pos.z)
    if (r > 330) {
      this.pos.x *= 330 / r
      this.pos.z *= 330 / r
    }

    // footsteps
    const hspeed = Math.hypot(this.vel.x, this.vel.z)
    if (this.grounded && hspeed > 1.2) {
      this.stepTimer -= dt
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.34 - Math.min(0.16, hspeed * 0.02)
        this.audio.step()
        if (Math.random() < 0.4) {
          this.fx.spawnParticle(this.pos.clone().add(new THREE.Vector3(0, 0.06, 0)), new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.5, (Math.random() - 0.5) * 0.4), 0xd8cfae, 0.09, 0.35, 4, 1)
        }
      }
    }

    if (input.slotRequest >= 0) this.equip(input.slotRequest)
    if (input.actions.switch) this.cycleWeapon()
    if (input.actions.reload) this.reload()
    if (input.actions.build) this.toggleBuild()
    if (input.actions.buildType) this.setBuildType(this.buildType === 'wall' ? 'ramp' : 'wall')
    if (input.aiming && this.current === 0) this.equip(this.weapons[0] ? 1 : 0)

    if (this.buildMode) {
      if ((input.actions.place || input.actions.fire) && this.buildCooldown <= 0) this.placeBuild()
    } else if (this.current === 0) {
      if ((input.firing || input.actions.fire) && this.fireCooldown <= 0) this.swingPickaxe()
    } else {
      this._handleShooting(dt)
    }
  }

  _handleShooting(dt) {
    const input = this.input
    const w = this.weapon
    if (!w) return
    const wantFire = input.firing || input.actions.fire
    const canSemi = !this.triggerHeld
    if (wantFire) {
      if (w.mag <= 0) {
        if (!this.triggerHeld) {
          this.audio.click()
          this.reload()
        }
      } else if (this.fireCooldown <= 0 && (WEAPON_DEFS[w.defId].auto || canSemi)) {
        this.shoot()
      }
    }
    this.triggerHeld = input.firing
  }

  getAimRay() {
    const origin = this.camera.position.clone()
    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)
    return { origin, dir }
  }

  getAimPoint(range) {
    const { origin, dir } = this.getAimRay()
    const wHit = this.world.raycastWorld(origin, dir, range)
    const tHit = this.world.terrainRay(origin, dir, Math.min(range, wHit ? wHit.dist : range))
    let dist = range
    let point = origin.clone().addScaledVector(dir, range)
    if (wHit && wHit.dist < dist) { dist = wHit.dist; point = wHit.point.clone() }
    if (tHit && tHit.dist < dist) { point = tHit.point.clone() }
    return point
  }

  shoot() {
    const input = this.input
    const w = this.weapon
    const def = WEAPON_DEFS[w.defId]
    if (this.state !== 'active') return
    if (this.reloadT > 0) return
    if (w.mag <= 0) { this.reload(); return }
    w.mag--
    w.shots++
    this.fireCooldown = 1 / def.fireRate
    this.triggerHeld = true
    this.shotsJustFired = true
    this.model.userData.recoil = 1
    this.camPitch = clamp(this.camPitch + def.recoil * (input.aiming ? 0.55 : 1), -1.15, 0.85)
    this.camYaw += (Math.random() - 0.5) * def.recoil * 0.7

    const range = def.range
    const aimPoint = this.getAimPoint(range)
    const muzzle = new THREE.Vector3()
    if (this.gun?.userData.muzzle) this.gun.userData.muzzle.getWorldPosition(muzzle)
    else muzzle.copy(this.pos).add(new THREE.Vector3(0, 1.4, 0))

    // touch aim assist: bend toward the closest target in a narrow cone
    let assistTarget = null
    if (input.touchUI) {
      const dir = aimPoint.clone().sub(muzzle).normalize()
      let best = 0.16
      for (const bot of this.game.bots) {
        if (!bot.alive) continue
        const chest = bot.pos.clone().add(new THREE.Vector3(0, 1.25, 0))
        const to = chest.clone().sub(muzzle)
        const dist = to.length()
        if (dist > 75) continue
        const ang = dir.angleTo(to.normalize())
        if (ang < best) { best = ang; assistTarget = bot }
      }
    }
    const assistPos = assistTarget ? assistTarget.pos.clone().add(new THREE.Vector3(0, 1.3, 0)) : null

    const spreadBase = def.spread * (input.aiming ? 0.42 : 1) * (this.vel.length() > 1 ? 1 + def.moveSpread * 0.35 : 1)
    let anyHit = false
    let headshot = false
    const pellets = def.pellets
    const originGround = this.pos.clone().add(new THREE.Vector3(0, 1.2, 0))
    for (let i = 0; i < pellets; i++) {
      const targetPoint = aimPoint.clone()
      const spread = spreadBase * (pellets > 1 ? 1 : 0.85)
      targetPoint.x += (Math.random() - 0.5) * 2 * spread * range
      targetPoint.y += (Math.random() - 0.5) * 2 * spread * range * 0.7
      targetPoint.z += (Math.random() - 0.5) * 2 * spread * range
      if (assistPos) targetPoint.lerp(assistPos, 0.35)
      let dir = targetPoint.sub(muzzle).normalize()

      const worldHit = this.world.raycastWorld(muzzle, dir, range)
      const botHit = this.game.raycastBots(muzzle, dir, range, input.touchUI ? 0.45 : 0.15)
      const terrainHit = this.world.terrainRay(muzzle, dir, Math.min(range, worldHit ? worldHit.dist : range))
      let end = muzzle.clone().addScaledVector(dir, range)
      let endDist = range
      if (worldHit && worldHit.dist < endDist) { endDist = worldHit.dist; end = worldHit.point.clone() }
      if (terrainHit && terrainHit.dist < endDist) { endDist = terrainHit.dist; end = terrainHit.point.clone() }
      let hitBot = false
      if (botHit && botHit.dist < endDist) {
        endDist = botHit.dist
        end = botHit.point.clone()
        hitBot = true
        headshot = botHit.head
        const falloff = 1 - 0.32 * clamp(botHit.dist / range, 0, 1)
        let dmg = w.damage * falloff * (botHit.head ? 1.85 : 1)
        const killed = this.game.damageBot(botHit.bot, dmg, this, botHit.head)
        this.fx.damageNumber(botHit.point, Math.round(dmg), botHit.head || killed)
        this.fx.burst(botHit.point, botHit.head ? 0xffd166 : 0xff6b5b, botHit.head ? 9 : 5, 2.4, 0.11)
        anyHit = true
        this.damageDealt += dmg
      } else if (worldHit && worldHit.dist <= endDist + 0.001) {
        if (worldHit.build) {
          if (this.world.damageBuild(worldHit.build, w.damage)) {
            this.fx.burst(worldHit.point, 0xb88455, 14, 3.2, 0.14)
          }
        }
        this.fx.burst(worldHit.point, 0xd6c6a2, 4, 1.8, 0.1)
      } else if (terrainHit && terrainHit.dist <= endDist + 0.001) {
        this.fx.burst(terrainHit.point, 0xcaa96f, 5, 2, 0.11)
      }
      this.fx.shootTracer(muzzle, end, 0xffe08a, pellets > 1 ? 0.6 : 1)
      if (pellets > 1) {
        // spread the visible pellet origins a bit
        muzzle.addScaledVector(dir, 0.05)
      }
    }
    this.fx.muzzle(muzzle, w.defId === 'shotgun' || w.defId === 'sniper')
    this.audio.shot(w.defId)
    if (anyHit) {
      this.game.onPlayerHit(headshot)
      this.ui.hitmarker(headshot)
    }
    this.ui.kickCrosshair(0.6 + (def.recoil || 0) * 8)
    this.ui.updateAmmoFlash()
  }

  swingPickaxe() {
    this.fireCooldown = 0.52
    this.model.userData.swing = 0.42
    this.audio.pickaxe()
    const f = this.forward
    // resource gathering
    let best = null
    let bestD = 99
    for (const node of this.world.resourceNodes) {
      const dx = node.x - this.pos.x
      const dz = node.z - this.pos.z
      const d = Math.hypot(dx, dz)
      if (d > 4.2 || d > bestD) continue
      if (Math.abs(node.y - this.pos.y) > 2.6) continue
      const dot = (dx * f.x + dz * f.z) / Math.max(0.001, d)
      if (dot < 0.25) continue
      best = node
      bestD = d
    }
    const origin = this.pos.clone().add(new THREE.Vector3(0, 1.2, 0))
    const botHit = this.game.raycastBots(origin, f, 3.6, 0.2)
    if (botHit && (!best || botHit.dist < bestD)) {
      this.game.damageBot(botHit.bot, 24, this, false)
      this.fx.damageNumber(botHit.point, 24, false)
      this.fx.burst(botHit.point, 0xffb38a, 5, 1.8, 0.1)
      this.ui.hitmarker(false)
      return
    }
    if (best) {
      const amount = best.type === 'tree' ? 8 : 12
      this.wood = Math.min(400, this.wood + amount)
      if (best.type === 'tree') this.fx.leaves(new THREE.Vector3(best.x, best.y + 2.3, best.z), 12)
      else this.fx.burst(new THREE.Vector3(best.x, best.y + 0.7, best.z), 0x9b978c, 10, 2.4, 0.11)
      this.audio.wood()
      this.fx.damageNumber(new THREE.Vector3(best.x, best.y + 2.1, best.z), `+${amount} WOOD`, false, '#8ef29a')
    } else {
      this.fx.burst(origin.addScaledVector(f, 2), 0xd6c6a2, 3, 1, 0.08)
    }
  }

  placeBuild() {
    if (this.buildCooldown > 0) return
    const p = this._ghostPlacement || this.world.buildPlacement(this.buildType, this.pos, this.camYaw)
    if (this.wood < p.cost) {
      this.ui.toast('Not enough wood', '#ff8a80', 'harvest trees & rocks')
      this.audio.click()
      this.buildCooldown = 0.4
      return
    }
    this.wood -= p.cost
    this.world.placeBuild(this.buildType, p)
    const center = new THREE.Vector3(p.x, p.y + 1.2, p.z)
    this.fx.burst(center, 0xd9ab72, 8, 2.2, 0.12)
    this.audio.build()
    this.buildCooldown = 0.22
    this.model.userData.swing = 0.2
  }

  _updateCamera(dt) {
    const input = this.input
    const sens = input.touchUI ? 0.72 : 0.0023
    this.camYaw -= input.look.x * sens
    this.camPitch -= input.look.y * sens * (input.touchUI ? 0.8 : 0.82)
    if (input.tiltOn) {
      const t = input.tilt
      this.camYaw -= t.yaw * dt * 1.15
      this.camPitch += t.pitch * dt * 0.9
    }
    this.camPitch = clamp(this.camPitch, -1.12, 0.8)
    const w = this.weapon
    const scoped = input.aiming && w && w.defId === 'sniper'
    const targetAim = input.aiming ? 1 : 0
    this.aimFactor = damp(this.aimFactor, targetAim, 14, dt)
    const dist = this.state === 'drop' ? 7.4 : lerp(5.6, scoped ? 2.2 : 3.1, this.aimFactor)
    const shoulder = this.state === 'drop' ? 0.2 : lerp(0.72, 0.55, this.aimFactor)
    const dir = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch),
    )
    const target = this.pos.clone().add(new THREE.Vector3(0, this.state === 'drop' ? 2.2 : 1.55, 0))
    const right = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw))
    let ideal = target.clone().addScaledVector(dir, -dist).addScaledVector(right, shoulder)
    const toCam = ideal.clone().sub(target)
    const camDist = toCam.length()
    toCam.normalize()
    const hit = this.world.raycastWorld(target, toCam, camDist)
    if (hit) {
      const d = Math.max(0.7, hit.dist - 0.35)
      ideal = target.clone().addScaledVector(toCam, d)
    }
    const minY = Math.max(
      this.world.heightAt(ideal.x, ideal.z),
      this.world.supportAt(ideal.x, ideal.z, ideal.y, 0.25),
    ) + 0.55
    if (ideal.y < minY) ideal.y = minY
    if (!this.camPos) this.camPos = ideal.clone()
    const lerpK = 1 - Math.exp(-(hit ? 30 : 16) * dt)
    this.camPos.lerp(ideal, lerpK)
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camPos.clone().add(dir))
    const fov = this.state === 'drop' ? 70 : scoped ? 34 : lerp(64, 53, this.aimFactor)
    this.camera.fov = damp(this.camera.fov, fov, 12, dt)
    this.camera.updateProjectionMatrix()
    this.ui.setScope(Boolean(scoped))
    this.ui.setAim(input.aiming)
  }

  takeDamage(amount, source = null) {
    if (this.dead) return
    const shieldBefore = this.shield
    const absorbed = Math.min(this.shield, amount)
    this.shield -= absorbed
    this.hp -= amount - absorbed
    this.lastDamage = this.game.matchTime
    this.audio.hurt()
    this.ui.flashDamage(Math.min(1, amount / 35))
    if (source) {
      const sp = source.pos || source
      const dx = sp.x - this.pos.x
      const dz = sp.z - this.pos.z
      const worldAng = Math.atan2(dx, dz)
      const rel = angleDelta(this.camYaw, worldAng)
      this.ui.damageDirection(rel)
    }
    if (this.hp <= 0) {
      this.hp = 0
      this.dead = true
      this.state = 'dead'
      this.game.onPlayerDeath(source)
    }
  }

  getStats() {
    return {
      kills: this.kills,
      damage: Math.round(this.damageDealt),
      hp: Math.max(0, Math.round(this.hp)),
      shield: Math.round(this.shield),
    }
  }
}
