import * as THREE from 'three'
import { BOT_COLORS, BOT_NAMES, clamp, damp, dist2, pick, rand, randInt } from './utils.js'
import { makeWeapon, WEAPON_DEFS } from './weapons.js'
import { createCharacter, setWeapon, animateCharacter, createHealthBar } from './character.js'

const DEF_IDS = ['ar', 'smg', 'shotgun', 'pistol', 'ar', 'smg']

export class Bot {
  constructor(game, index) {
    this.game = game
    this.world = game.world
    this.fx = game.fx
    this.audio = game.audio
    this.name = BOT_NAMES[index % BOT_NAMES.length]
    this.colors = BOT_COLORS[index % BOT_COLORS.length]
    this.model = createCharacter(this.colors)
    game.scene.add(this.model)
    this.bar = createHealthBar()
    game.scene.add(this.bar)
    this.pos = new THREE.Vector3()
    this.muzzle = new THREE.Vector3()
    this.tmp = new THREE.Vector3()
    this.alive = true
    this.isPlayer = false
    this.reset(index)
  }

  reset(index = 0) {
    const world = this.world
    const p = this.game.getBotSpawn(index)
    this.pos.set(p.x, world.heightAt(p.x, p.z) + rand(22, 46), p.z)
    this.spawnPoint = { x: p.x, z: p.z }
    this.state = 'drop'
    this.alive = true
    this.dead = false
    this.hp = 100
    this.maxHp = 100
    this.shield = pick([0, 0, 25, 50])
    this.maxShield = 100
    this.yaw = rand(0, Math.PI * 2)
    this.vel = new THREE.Vector3()
    this.grounded = false
    this.vy = 0
    this.target = null
    this.thinkTimer = rand(0.2, 0.8)
    this.fireTimer = rand(1.5, 3.5)
    this.strafeTimer = rand(1, 3)
    this.strafeDir = Math.random() < 0.5 ? -1 : 1
    this.moveTarget = null
    this.moveTimer = 0
    this.losTimer = 0
    this.hasLos = false
    this.deathT = 0
    this.dropSpeed = rand(19, 27)
    this.landedAt = 0
    this.weapon = makeWeapon(DEF_IDS[index % DEF_IDS.length], randInt(0, 2), 20)
    setWeapon(this.model, this.weapon)
    this.gun = this.model.userData.gunHolder.children[0]
    this.model.userData.pickaxe.visible = false
    this.model.userData.gunHolder.visible = true
    this.model.position.copy(this.pos)
    this.model.rotation.set(0, this.yaw, 0)
    this.model.visible = true
    this.model.scale.setScalar(1)
    this.model.userData.glider.visible = true
    this.bar.visible = false
    this.bar.userData.shieldBg.visible = false
    this.bar.userData.shield.visible = false
  }

  get eye() { return this.pos.clone().add(new THREE.Vector3(0, 1.5, 0)) }
  get chest() { return this.pos.clone().add(new THREE.Vector3(0, 1.2, 0)) }

  update(dt) {
    if (this.dead) {
      this.deathT += dt
      this.model.rotation.z = Math.min(Math.PI / 2, this.deathT * 4) * -1
      this.model.position.y = Math.max(this.pos.y - this.deathT * 0.4, this.pos.y - 4)
      this.model.position.x = this.pos.x + this.deathT * 0.3
      if (this.deathT > 2.6) this.model.visible = false
      return
    }
    if (this.state === 'drop') {
      this._updateDrop(dt)
      this.model.position.copy(this.pos)
      this.model.rotation.y = this.yaw
      animateCharacter(this.model, dt, { speed: 0, aiming: false, drop: true })
      return
    }
    this._updateAi(dt)
    this.model.position.copy(this.pos)
    this.model.rotation.y = this.yaw
    animateCharacter(this.model, dt, {
      speed: Math.hypot(this.vel.x, this.vel.z),
      aiming: Boolean(this.target),
      drop: false,
    })
    this._updateBar()
  }

  _updateDrop(dt) {
    const tx = this.spawnPoint.x
    const tz = this.spawnPoint.z
    const dx = tx - this.pos.x
    const dz = tz - this.pos.z
    const d = Math.hypot(dx, dz)
    if (d > 2) {
      this.pos.x += (dx / d) * Math.min(11, d) * dt
      this.pos.z += (dz / d) * Math.min(11, d) * dt
      this.yaw = Math.atan2(dx, dz)
    }
    this.pos.y -= this.dropSpeed * dt
    const floor = this.world.supportAt(this.pos.x, this.pos.z, this.pos.y, 0.45)
    if (this.pos.y <= floor + 0.02) {
      this.pos.y = floor
      this.state = 'active'
      this.grounded = true
      this.landedAt = performance.now()
      this.model.userData.glider.visible = false
      this.fx.burst(this.pos.clone(), 0xd8c49a, 7, 2, 0.12)
      this.fireTimer = rand(1.5, 3)
    }
  }

  _updateAi(dt) {
    this.thinkTimer -= dt
    this.fireTimer -= dt
    this.strafeTimer -= dt
    this.moveTimer -= dt
    this.losTimer -= dt
    if (this.strafeTimer <= 0) {
      this.strafeTimer = rand(0.7, 2.2)
      this.strafeDir = Math.random() < 0.5 ? -1 : 1
    }
    if (this.thinkTimer <= 0) {
      this.thinkTimer = rand(0.35, 0.7)
      this._pickTarget()
    }
    const storm = this.game.world.storm
    const outside = storm.outside(this.pos.x, this.pos.z, 2)
    let desired = new THREE.Vector3()
    const target = this.target
    let targetDist = 999
    if (target && target.alive) {
      targetDist = dist2(this.pos.x, this.pos.z, target.pos.x, target.pos.z)
    }

    if (target && target.alive && targetDist < 58) {
      const dx = target.pos.x - this.pos.x
      const dz = target.pos.z - this.pos.z
      const d = Math.max(0.001, Math.hypot(dx, dz))
      const fwd = new THREE.Vector3(dx / d, 0, dz / d)
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x)
      if (outside) {
        desired.copy(fwd)
        this.yaw = Math.atan2(dx, dz)
      } else {
        if (d > 16) desired.addScaledVector(fwd, 1)
        else if (d < 7) desired.addScaledVector(fwd, -1)
        else desired.addScaledVector(right, this.strafeDir * 0.7 + fwd.x * 0.1)
        desired.addScaledVector(right, this.strafeDir * 0.45)
        this.yaw = damp(this.yaw, Math.atan2(dx, dz), 7, dt)
      }
      if (this.losTimer <= 0) {
        this.losTimer = rand(0.25, 0.5)
        this.hasLos = !this.world.lineBlocked(this.eye, target.eye)
      }
      if (this.hasLos && targetDist < 55 && this.fireTimer <= 0 && !outside) {
        this._shoot(target, targetDist)
      }
    } else {
      if (outside) {
        const c = storm.center
        const r = Math.max(5, storm.radius * 0.55)
        desired.set(c.x - this.pos.x + rand(-r * 0.3, r * 0.3), 0, c.y - this.pos.z + rand(-r * 0.3, r * 0.3))
      } else {
        if (!this.moveTarget || this.moveTimer <= 0 || dist2(this.pos.x, this.pos.z, this.moveTarget.x, this.moveTarget.z) < 3) {
          const a = rand(0, Math.PI * 2)
          const r = Math.sqrt(Math.random()) * Math.max(6, storm.radius * 0.72)
          this.moveTarget = { x: storm.center.x + Math.cos(a) * r, z: storm.center.y + Math.sin(a) * r }
          this.moveTimer = rand(5, 10)
        }
        desired.set(this.moveTarget.x - this.pos.x, 0, this.moveTarget.z - this.pos.z)
        this.yaw = damp(this.yaw, Math.atan2(desired.x, desired.z), 4, dt)
      }
    }

    if (desired.lengthSq() > 1) desired.normalize()
    const speed = outside ? 5.2 : this.target ? 4.1 : 3.1
    this.vel.x = damp(this.vel.x, desired.x * speed, 7, dt)
    this.vel.z = damp(this.vel.z, desired.z * speed, 7, dt)
    this.pos.x += this.vel.x * dt
    this.pos.z += this.vel.z * dt
    this.world.resolveCircle(this.pos, 0.4, this.pos.y, 1.7)
    const support = this.world.supportAt(this.pos.x, this.pos.z, this.pos.y, 0.4)
    if (this.pos.y > support + 0.6) {
      this.vy -= 22 * dt
      this.pos.y += this.vy * dt
      if (this.pos.y < support) { this.pos.y = support; this.vy = 0 }
    } else {
      this.pos.y = support
      this.vy = 0
    }
    const rr = Math.hypot(this.pos.x, this.pos.z)
    if (rr > 310) {
      this.pos.x *= 310 / rr
      this.pos.z *= 310 / rr
    }
    // tiny idle look sway
    if (!this.target && Math.abs(this.vel.x) + Math.abs(this.vel.z) < 0.2 && Math.sin(this.game.matchTime * 0.5 + this.pos.x) > 0.985) {
      this.yaw += dt * 0.35
    }
  }

  _pickTarget() {
    let best = null
    let bestScore = Infinity
    const player = this.game.player
    if (player && player.alive && player.state === 'active') {
      const d = dist2(this.pos.x, this.pos.z, player.pos.x, player.pos.z)
      if (d < 62) {
        best = player
        bestScore = d * (this.target === player ? 0.8 : 1)
      }
    }
    for (const bot of this.game.bots) {
      if (bot === this || !bot.alive) continue
      const d = dist2(this.pos.x, this.pos.z, bot.pos.x, bot.pos.z)
      if (d < 42 && d < bestScore) {
        best = bot
        bestScore = d
      }
    }
    if (best && best !== this.target) {
      this.target = best
      this.fireTimer = Math.min(this.fireTimer, rand(0.5, 1.4))
    } else if (!best) {
      this.target = null
    }
  }

  _shoot(target, dist) {
    this.fireTimer = rand(1.05, 2.3) + (target.isPlayer ? 0.15 : 0)
    const muzzle = new THREE.Vector3()
    if (this.gun?.userData.muzzle) this.gun.userData.muzzle.getWorldPosition(muzzle)
    else muzzle.copy(this.pos).add(new THREE.Vector3(0, 1.3, 0))
    const aim = target.chest ? target.chest.clone() : target.pos.clone().add(new THREE.Vector3(0, 1.2, 0))
    const acc = clamp(0.5 - dist * 0.0065, 0.1, 0.46)
    const hit = Math.random() < acc
    const end = aim.clone()
    if (!hit) {
      const miss = 1.2 + dist * 0.045
      end.x += rand(-miss, miss)
      end.y += rand(-miss * 0.7, miss * 0.7)
      end.z += rand(-miss, miss)
    }
    this.fx.shootTracer(muzzle, end, 0xff9a72, 0.75)
    this.fx.burst(muzzle, 0xffcf8a, 2, 1.2, 0.09)
    this.audio.shot(this.weapon.defId, dist2(this.pos.x, this.pos.z, this.game.player.pos.x, this.game.player.pos.z))
    if (hit) {
      const dmg = this.weapon.damage * rand(0.4, 0.55)
      if (target.isPlayer) this.game.damagePlayer(dmg, this)
      else this.game.damageBot(target, dmg, this, false)
    }
    this.model.userData.recoil = 1
  }

  takeDamage(amount, attacker, game, headshot = false) {
    if (!this.alive) return
    const absorbed = Math.min(this.shield, amount)
    this.shield -= absorbed
    this.hp -= amount - absorbed
    this.target = attacker && attacker !== this ? attacker : this.target
    this.thinkTimer = 0
    this.losTimer = 0
    if (this.hp <= 0) this.die(game, attacker)
    else {
      this.bar.visible = true
      this._updateBar()
    }
  }

  die(game, killer) {
    if (!this.alive) return
    this.alive = false
    this.dead = true
    this.hp = 0
    this.target = null
    this.deathT = 0
    this.model.userData.glider.visible = false
    this.bar.visible = false
    this.fx.burst(this.chest, 0xffb15c, 16, 3.5, 0.15)
    game.onBotKilled(this, killer)
  }

  _updateBar() {
    const camera = this.game.camera
    const d = camera.position.distanceTo(this.pos)
    if (!this.bar.visible) {
      if (this.hp < this.maxHp || this.shield > 0 || d < 20) this.bar.visible = true
    }
    if (!this.bar.visible) return
    this.bar.position.set(this.pos.x, this.pos.y + 2.28, this.pos.z)
    this.bar.quaternion.copy(camera.quaternion)
    const u = this.bar.userData
    u.hp.scale.x = clamp(this.hp / this.maxHp, 0, 1)
    u.hp.position.x = -(1 - u.hp.scale.x) * 0.55
    const hasShield = this.shield > 0
    u.shieldBg.visible = hasShield
    u.shield.visible = hasShield
    if (hasShield) {
      u.shield.scale.x = clamp(this.shield / this.maxShield, 0, 1)
      u.shield.position.x = -(1 - u.shield.scale.x) * 0.55
    }
    if (d > 65) this.bar.visible = false
  }
}
