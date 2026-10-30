import * as THREE from 'three'
import { World, POIS } from './world.js'
import { Input } from './input.js'
import { UI } from './ui.js'
import { Effects } from './fx.js'
import { Player } from './player.js'
import { Bot } from './bot.js'
import { audio } from './audio.js'
import { randomWeapon } from './weapons.js'
import { clamp, dist2, pick } from './utils.js'

const BOT_COUNT = 15
const UP = new THREE.Vector3(0, 1, 0)

function readQuality() {
  try {
    const prefs = JSON.parse(localStorage.getItem('stormfall.prefs') || '{}')
    return prefs.quality === 'balanced' ? 'balanced' : 'high'
  } catch {
    return 'high'
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById('game')
    this.quality = readQuality()

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(0x0a1020, 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.06
    this.renderer.shadowMap.enabled = this.quality === 'high'
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this._applyPixelRatio()

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900)
    this.scene.add(this.camera)

    this.world = new World(this.scene, this.quality)
    this.world.cameraPos = this.camera.position

    this.audio = audio
    this.input = new Input(this.canvas)
    this.ui = new UI(this)
    this.fx = new Effects(this.scene, this.camera, this.ui)
    this.player = new Player(this)

    this.state = 'menu'
    this.matchTime = 0
    this.bots = []
    this._usedSpawns = []
    this._endAt = 0
    this._endWin = false
    this._killerName = ''
    this._placement = 16
    this._stormPlayerTick = 0
    this._stormBotTick = 0
    this._matchNumber = 0

    for (let i = 0; i < BOT_COUNT; i++) this.bots.push(new Bot(this, i))

    this._menuT = 0
    this._lastFrame = performance.now()
    this._resize = this._resize.bind(this)
    this._frame = this._frame.bind(this)

    // Menu is a slow cinematic orbit of the island.
    this.world.storm.active = false
    this.world.storm.group.visible = false
    this._setActorsVisible(false)
    this._setMenuCamera(0)
    this.ui.showMenu()
    this.ui.hideLoading()

    window.addEventListener('resize', this._resize)
    this._bindLifecycle()
    this._bindAudioUnlock()

    // Restart flow: Play Again reloads the page, then drops straight back in.
    let auto = false
    try {
      auto = sessionStorage.getItem('stormfall_auto') === '1'
      if (auto) sessionStorage.removeItem('stormfall_auto')
    } catch {}
    if (auto) setTimeout(() => this.startMatch({ auto: true }), 30)

    requestAnimationFrame(this._frame)
  }

  /* --------------------------------------------------------------- rendering */
  _applyPixelRatio() {
    const cap = this.quality === 'high' ? 1.75 : 1.1
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap))
  }

  _resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
  }

  setQuality(quality) {
    this.quality = quality === 'balanced' ? 'balanced' : 'high'
    this._applyPixelRatio()
    this.renderer.setSize(window.innerWidth, window.innerHeight, false)
    const shadows = this.quality === 'high'
    this.renderer.shadowMap.enabled = shadows
    const sun = this.world.sun
    sun.castShadow = shadows
    const size = shadows ? 2048 : 1024
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size)
      sun.shadow.map?.dispose()
      sun.shadow.map = null
    }
    this.scene.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) m.needsUpdate = true
      }
    })
  }

  _frame(now) {
    const raw = (now - this._lastFrame) / 1000
    this._lastFrame = now
    const dt = clamp(Number.isFinite(raw) ? raw : 0.016, 0.001, 0.05)

    this.input.updateMove()

    if (this.state === 'menu') this._updateMenu(dt)
    else if (this.state === 'playing') this._updateMatch(dt)
    else if (this.state === 'ended') this._updateAftermath(dt)

    if (this.state === 'playing' || this.state === 'menu') {
      this.input.updateTilt(dt)
    }

    this.renderer.render(this.scene, this.camera)
    this.input.endFrame()
    requestAnimationFrame(this._frame)
  }

  _setMenuCamera(dt) {
    this._menuT += dt
    const a = this._menuT * 0.045 + 0.72
    const radius = 182
    const y = 68 + Math.sin(this._menuT * 0.16) * 5
    this.camera.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius)
    this.camera.lookAt(0, 8, 0)
    if (Math.abs(this.camera.fov - 56) > 0.01) {
      this.camera.fov = 56
      this.camera.updateProjectionMatrix()
    }
  }

  _updateMenu(dt) {
    this._setMenuCamera(dt)
    this.world.cameraPos.copy(this.camera.position)
    this.world.update(dt, this.camera.position)
    this.world.sun.position.set(78, 118, 56)
    this.world.sun.target.position.set(0, 0, 0)
    this.world.sun.target.updateMatrixWorld()
    this.fx.update(dt)
    if (audio.ready) audio.update(dt, { menu: true })
  }

  _updateAftermath(dt) {
    this.world.cameraPos.copy(this.camera.position)
    this.world.update(dt, this.player.pos)
    this.fx.update(dt)
    if (audio.ready) audio.update(dt, { menu: false })
    this._placeSun(this.player.pos)
  }

  /* ------------------------------------------------------------------ match */
  startMatch(opts = {}) {
    if (this.state === 'playing') return
    audio.init()
    audio.setEnabled(this.ui.soundOn)

    this._matchNumber++
    this._usedSpawns = []
    this._endAt = 0
    this._endWin = false
    this._killerName = ''
    this._placement = 16
    this._stormPlayerTick = 0
    this._stormBotTick = 0
    this.matchTime = 0

    this.world.reset()
    this.world.storm.active = true
    this.world.storm.group.visible = true
    this.world.storm.update(0, this.world.time)

    const spawn = this._pickSpawn(7)
    this.player.reset(spawn)
    const toCenter = Math.atan2(-spawn.x, -spawn.z)
    this.player.camYaw = toCenter + (Math.random() - 0.5) * 0.35
    this.player.camPitch = -0.14
    this.player.model.visible = true
    if (this.player.ghost) this.player.ghost.visible = false

    for (let i = 0; i < this.bots.length; i++) this.bots[i].reset(i)

    this.state = 'playing'
    this.ui.resetEnd()
    this.ui.startHud()
    this.ui.banner('DROP IN', 'Glide toward loot — stay inside the circle', 'drop')
    this.ui.setAim(false)
    this.ui.setScope(false)
    this.input.enable(true)

    this._placeSun(this.player.pos)
    if (this.world.storm.group) this.world.storm.group.visible = true

    if (!this.input.touchUI && !this.input.pointerLockFailed) this._requestLock()
    if (opts.auto) this._bindAudioUnlock()
  }

  _updateMatch(dt) {
    this.matchTime += dt
    if (audio.ready) audio.update(dt, {
      outside: this.world.storm.outside(this.player.pos.x, this.player.pos.z, 1.5) ? 1 : 0,
      menu: false,
    })

    this.player.update(dt)
    for (const bot of this.bots) bot.update(dt)
    this.world.cameraPos.copy(this.camera.position)
    this.world.update(dt, this.player.pos)
    this._placeSun(this.player.pos)
    this.fx.update(dt)

    this._lootNearby()
    this._applyStormDamage(dt)
    this.ui.update(dt)

    if (this._endAt && performance.now() >= this._endAt) this.endMatch(this._endWin)
  }

  _placeSun(pos) {
    const sun = this.world.sun
    sun.position.set(pos.x + 74, pos.y + 116, pos.z + 52)
    sun.target.position.set(pos.x, pos.y, pos.z)
    sun.target.updateMatrixWorld()
  }

  _lootNearby() {
    if (!this.player.alive || this.player.state !== 'active') return
    for (const chest of this.world.chests) {
      if (chest.opened) continue
      if (Math.abs(chest.y - this.player.pos.y) > 2.6) continue
      if (dist2(chest.x, chest.z, this.player.pos.x, this.player.pos.z) > 2.25) continue
      this.openChestLoot(chest)
    }
  }

  openChestLoot(chest) {
    if (!this.world.openChest(chest)) return
    const at = new THREE.Vector3(chest.x, chest.y + 0.8, chest.z)
    this.fx.burst(at, 0xffd166, 22, 3.4, 0.16)
    this.audio.chest()

    let gotWeapon = false
    if (Math.random() < 0.82) {
      const weapon = randomWeapon()
      gotWeapon = this.player.pickupWeapon(weapon)
    }
    const shield = pick([25, 25, 50])
    this.player.addShield(shield)
    this.player.wood = Math.min(400, this.player.wood + 25)
    this.ui.toast('CHEST OPENED', '#ffd166', `+${shield} shield · +25 wood${gotWeapon ? '' : ' · ammo'}`)
  }

  _applyStormDamage(dt) {
    const storm = this.world.storm
    this._stormPlayerTick += dt
    this._stormBotTick += dt

    if (this._stormPlayerTick >= 0.5) {
      this._stormPlayerTick = 0
      const p = this.player
      if (p.alive && p.state === 'active' && storm.outside(p.pos.x, p.pos.z, 0.5)) {
        // The storm cuts through shields.
        p.hp = Math.max(0, p.hp - storm.damage)
        p.lastDamage = this.matchTime
        this.ui.flashDamage(0.35)
        this.audio.hurt()
        if (p.hp <= 0) {
          p.hp = 0
          p.dead = true
          p.state = 'dead'
          this.onPlayerDeath(null)
        }
      }
    }

    if (this._stormBotTick >= 0.5) {
      this._stormBotTick = 0
      for (const bot of this.bots) {
        if (!bot.alive || bot.state !== 'active') continue
        if (!storm.outside(bot.pos.x, bot.pos.z, 0.5)) continue
        bot.hp -= storm.damage * 2.2
        bot.lastDamage = this.matchTime
        if (bot.hp <= 0) {
          bot.hp = 0
          bot.die(this, null)
        }
      }
    }
  }

  /* ------------------------------------------------------------------ combat */
  raycastBots(origin, dir, range, radiusBonus = 0.15) {
    let best = null
    let bestT = range
    for (const bot of this.bots) {
      if (!bot.alive) continue
      const body = new THREE.Vector3(bot.pos.x, bot.pos.y + 1.14, bot.pos.z)
      const head = new THREE.Vector3(bot.pos.x, bot.pos.y + 1.82, bot.pos.z)
      const tBody = raySphere(origin, dir, body, 0.58 + radiusBonus)
      const tHead = raySphere(origin, dir, head, 0.3 + radiusBonus)
      const t = tHead >= 0 && (tBody < 0 || tHead <= tBody + 0.1) ? tHead : tBody
      if (t < 0 || t > bestT) continue
      const isHead = t === tHead
      bestT = t
      best = {
        bot,
        dist: t,
        head: isHead,
        point: origin.clone().addScaledVector(dir, t),
      }
    }
    return best
  }

  damageBot(bot, amount, attacker, headshot = false) {
    if (!bot || !bot.alive) return false
    bot.takeDamage(amount, attacker, this, headshot)
    return !bot.alive
  }

  damagePlayer(amount, source) {
    if (this.state !== 'playing') return
    const p = this.player
    if (!p.alive || p.state !== 'active') return
    p.takeDamage(amount, source || null)
  }

  onPlayerHit(headshot = false) {
    this.audio.hit(headshot)
  }

  onPlayerLanded() {
    this.ui.banner('TOUCHDOWN', 'Loot chests · harvest wood · build cover', 'land')
    this.ui.toast('AUTO RIFLE READY', '#8ef29a', 'press 2 or tap the slot')
  }

  onBotKilled(bot, killer) {
    const byPlayer = killer === this.player
    const killerName = byPlayer ? 'YOU' : (killer?.name || 'STORM')
    this.ui.killfeed(killerName, bot.name, { byPlayer, victimPlayer: false })
    if (byPlayer) {
      this.player.kills++
      this.audio.elim()
      this.ui.banner('ELIMINATION', `${bot.name} eliminated`, 'elim')
      this.ui.toast(`ELIMINATED ${bot.name}`, '#ffd166', 'one step closer')
    }
    this._checkVictory()
  }

  onPlayerDeath(source) {
    if (this._endAt) return
    this._placement = this.bots.reduce((n, b) => n + (b.alive ? 1 : 0), 0) + 1
    this._killerName = source?.name || 'the storm'
    this.input.enable(false)
    this.ui.banner('ELIMINATED', source ? `Bested by ${source.name}` : 'The storm got the last word', 'danger')
    this._scheduleEnd(false, 1250)
  }

  _checkVictory() {
    if (!this.player.alive || this._endAt) return
    if (this.bots.some((b) => b.alive)) return
    this._placement = 1
    this._killerName = ''
    this.ui.banner('VICTORY ROYALE', 'The island is yours', 'win')
    this._scheduleEnd(true, 1400)
  }

  _scheduleEnd(win, delay) {
    if (this._endAt) return
    this._endWin = win
    this._endAt = performance.now() + delay
  }

  endMatch(win) {
    if (this.state === 'ended') return
    this._endAt = 0
    win = Boolean(win && this.player.alive)
    if (win) this._placement = 1
    this.state = 'ended'
    this.input.enable(false)
    this.input.releaseLock()
    const stats = this.player.getStats()
    stats.time = this.matchTime
    this.ui.showEnd(win, this._placement, stats, this._killerName)
    this._setActorsVisible(false)
  }

  /* ------------------------------------------------------------- match flow */
  pause() {
    if (this.state !== 'playing' || this._endAt) return
    this.state = 'paused'
    this.input.enable(false)
    this.input.releaseLock()
    this.ui.pause()
    this.ui.playing = true
  }

  resume() {
    if (this.state !== 'paused') return
    this.state = 'playing'
    this.input.enable(true)
    this.ui.unpause()
    this.ui.playing = true
    if (!this.input.touchUI) this._requestLock()
  }

  quitToMenu() {
    this.state = 'menu'
    this._endAt = 0
    this.input.enable(false)
    this.input.releaseLock()
    this.world.reset()
    this.world.storm.active = false
    this.world.storm.group.visible = false
    this.player.dead = true
    this.player.state = 'dead'
    this._setActorsVisible(false)
    this.ui.resetEnd()
    this.ui.showMenu()
    this._menuT = 0
  }

  restart() {
    try { sessionStorage.setItem('stormfall_auto', '1') } catch {}
    location.reload()
  }

  /* ------------------------------------------------------------------ spawns */
  getBotSpawn(index) {
    return this._pickSpawn(index + 1)
  }

  _pickSpawn(index) {
    const poi = POIS[(index * 3 + 1) % POIS.length]
    for (let i = 0; i < 72; i++) {
      const a = index * 1.31 + i * 2.399963
      const ring = 7 + (i % 8) * 2.35
      const x = poi.x + Math.cos(a) * ring
      const z = poi.z + Math.sin(a) * ring
      const y = this.world.heightAt(x, z)
      if (y < 0.95) continue
      if (this._spawnBlocked(x, z, y)) continue
      if (this._usedSpawns.some((s) => dist2(x, z, s.x, s.z) < 4.6)) continue
      const spot = { x, z }
      this._usedSpawns.push(spot)
      return spot
    }
    // Deterministic fallback ring around the island centre.
    for (let i = 0; i < 48; i++) {
      const a = index * 1.7 + i * 2.399963
      const x = Math.cos(a) * (42 + (i % 6) * 9)
      const z = Math.sin(a) * (42 + (i % 6) * 9)
      const y = this.world.heightAt(x, z)
      if (y < 1) continue
      if (this._spawnBlocked(x, z, y)) continue
      const spot = { x, z }
      this._usedSpawns.push(spot)
      return spot
    }
    return { x: 0, z: 30 }
  }

  _spawnBlocked(x, z, groundY) {
    const r = 1.05
    for (const c of this.world.colliders) {
      if (c.disabled) continue
      if (c.maxY - groundY <= 0.12) continue
      if (c.minY >= groundY + 1.85) continue
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true
    }
    return false
  }

  _setActorsVisible(on) {
    this.player.model.visible = on
    if (this.player.ghost) this.player.ghost.visible = on && this.player.buildMode
    for (const bot of this.bots) {
      bot.model.visible = on
      bot.bar.visible = false
    }
  }

  _requestLock() {
    try {
      const req = this.canvas.requestPointerLock?.()
      if (req && typeof req.catch === 'function') req.catch(() => {})
    } catch {}
  }

  /* ---------------------------------------------------------------- lifecycle */
  _bindLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing' && !this._endAt) this.pause()
    })
    this.input.onLockChange((locked) => {
      if (!locked && this.state === 'playing' && !this._endAt && !this.input.touchUI) this.pause()
    })
    window.addEventListener('blur', () => {
      if (this.state === 'playing' && !this._endAt) this.pause()
    })
  }

  _bindAudioUnlock() {
    const unlock = () => {
      audio.init()
      audio.setEnabled(this.ui.soundOn)
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
      window.removeEventListener('touchstart', unlock, true)
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    window.addEventListener('touchstart', unlock, true)
  }
}

function raySphere(origin, dir, center, radius) {
  const ox = center.x - origin.x
  const oy = center.y - origin.y
  const oz = center.z - origin.z
  const b = ox * dir.x + oy * dir.y + oz * dir.z
  const c = ox * ox + oy * oy + oz * oz - radius * radius
  if (c > 0 && b < 0) return -1
  const disc = b * b - c
  if (disc < 0) return -1
  const t = b - Math.sqrt(disc)
  if (t >= 0) return t
  return c < 0 ? 0 : -1
}

const game = new Game()
window.stormfall = game
