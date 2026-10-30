import { clamp, fmtTime, lerp, TAU } from './utils.js'
import { audio } from './audio.js'

const $ = (id) => document.getElementById(id)

const MENU_TIPS = [
  'TIP: Chests glow gold. Open them for rarer gear.',
  'TIP: Harvest trees and rocks with your pickaxe to build.',
  'TIP: The storm ignores shields. Keep moving inward.',
  'TIP: Build a wall before reviving your aim — cover wins fights.',
  'TIP: Headshots deal extra damage. Aim for the cap.',
  'TIP: Lean your phone with tilt aiming for micro-adjustments.',
  'TIP: You can outrun the first storm. Do not outrun the last one.',
]

export class UI {
  constructor(game) {
    this.game = game
    this.world = game.world
    this.camera = game.camera
    this.soundOn = true
    this.playing = false
    this.aiming = false
    this.bloom = 0
    this.damageFlash = 0
    this.stormOpacity = 0
    this.mapAccum = 0
    this.last = {}
    this.feedTimers = []
    this.toastCount = 0
    this.settingsReturn = 'menu'
    this._readPrefs()
    this._cache()
    this._buildPhaseDots()
    this._coast = this._makeCoast()
    this._bind()
    this._applySound()
    this._syncTiltUI()
    this._setQualityUI()
    this._startTipRotation()
  }

  _readPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem('stormfall.prefs') || '{}')
      if (typeof p.sound === 'boolean') this.soundOn = p.sound
      this.quality = p.quality === 'balanced' ? 'balanced' : 'high'
    } catch { this.quality = 'high' }
  }

  _savePrefs() {
    try { localStorage.setItem('stormfall.prefs', JSON.stringify({ sound: this.soundOn, quality: this.quality })) } catch {}
  }

  _cache() {
    this.els = {
      hud: $('hud'), menu: $('menu'), minimap: $('minimap'), location: $('location'),
      alive: $('aliveCount'), stormPill: $('stormPill'), stormTimer: $('stormTimer'), stormLabel: $('stormLabel'),
      phaseDots: $('phaseDots'), killfeed: $('killfeed'), banner: $('banner'), bannerMain: $('bannerMain'), bannerSub: $('bannerSub'),
      crosshair: $('crosshair'), hitmarker: $('hitmarker'), dmgDir: $('dmgDir'), fxLayer: $('fxLayer'), toastLayer: $('toastLayer'),
      healthFill: $('healthFill'), shieldFill: $('shieldFill'), healthText: $('healthText'), shieldText: $('shieldText'),
      healthRow: document.querySelector('.health-row'), wood: $('woodText'), woodChip: $('woodChip'),
      buildHud: $('buildHud'), buildWood: $('buildWood'), fireLabel: $('fireLabel'),
      weaponSlots: [$('wslot0'), $('wslot1'), $('wslot2')],
      wammo: [$('wammo0'), $('wammo1'), $('wammo2')],
      reloadRing: $('reloadRing'), damageVignette: $('damageVignette'), stormVignette: $('stormVignette'), lowHealth: $('lowHealth'),
      scope: $('scope'), tiltBadge: $('tiltBadge'), menuTip: $('menuTip'), loading: $('loading'),
      settings: $('settingsModal'), howto: $('howtoModal'), pause: $('pauseModal'), end: $('endModal'),
      settingsBtn: $('menuSettingsBtn'), pauseBtn: $('pauseBtn'), playBtn: $('playBtn'), soundBtn: $('soundBtn'),
      soundToggle: $('soundToggle'), tiltToggle: $('tiltToggle'), tiltStatus: $('tiltStatus'), qualitySeg: $('qualitySeg'),
      fullscreenBtn: $('fullscreenBtn'), pauseSettingsBtn: $('pauseSettingsBtn'), resumeBtn: $('resumeBtn'), quitBtn: $('quitBtn'),
      againBtn: $('againBtn'), menuBtn: $('menuBtn'), howtoBtn: $('howToBtn'), buildOpts: [...document.querySelectorAll('[data-build]')],
      aimBtn: document.querySelector('[data-action="aim"]'), buildBtn: document.querySelector('[data-action="build"]'),
      endKicker: $('endKicker'), endTitle: $('endTitle'), endSub: $('endSub'), statPlace: $('statPlace'), statKills: $('statKills'),
      statDamage: $('statDamage'), statTime: $('statTime'),
    }
    this.ctx = this.els.minimap.getContext('2d')
  }

  _bind() {
    this.els.playBtn.addEventListener('click', () => this.game.startMatch())
    this.els.pauseBtn.addEventListener('click', () => this.game.pause())
    this.els.resumeBtn.addEventListener('click', () => this.game.resume())
    this.els.quitBtn.addEventListener('click', () => this.game.quitToMenu())
    this.els.againBtn.addEventListener('click', () => this.game.restart())
    this.els.menuBtn.addEventListener('click', () => this.game.quitToMenu())
    this.els.pauseSettingsBtn.addEventListener('click', () => this.openSettings('pause'))
    this.els.settingsBtn.addEventListener('click', () => this.openSettings('menu'))
    this.els.soundBtn.addEventListener('click', () => this.toggleSound())
    this.els.soundToggle.addEventListener('click', () => this.toggleSound())
    this.els.tiltToggle.addEventListener('click', () => this.toggleTilt())
    this.els.howtoBtn.addEventListener('click', () => this.openHowTo())
    this.els.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen())

    for (const btn of document.querySelectorAll('[data-close]')) {
      btn.addEventListener('click', () => this.closeModal(btn.dataset.close))
    }
    for (const btn of this.els.qualitySeg.querySelectorAll('[data-quality]')) {
      btn.addEventListener('click', () => {
        this.quality = btn.dataset.quality
        this.game.setQuality(this.quality)
        this._setQualityUI()
        this._savePrefs()
        audio.click()
      })
    }
    for (const btn of this.els.buildOpts) {
      btn.addEventListener('click', () => this.game.player?.setBuildType(btn.dataset.build))
    }
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        if (!this.els.settings.classList.contains('hidden')) this.closeModal('settingsModal')
        else if (!this.els.howto.classList.contains('hidden')) this.closeModal('howtoModal')
        else if (!this.els.pause.classList.contains('hidden')) this.game.resume()
        else if (this.playing) this.game.pause()
      }
    })
    document.addEventListener('fullscreenchange', () => {
      this.els.fullscreenBtn.textContent = document.fullscreenElement ? 'EXIT' : 'TOGGLE'
    })
  }

  _applySound() {
    audio.enabled = this.soundOn
    if (audio.ready) audio.setEnabled(this.soundOn)
    this.els.soundToggle.classList.toggle('on', this.soundOn)
    this.els.soundToggle.setAttribute('aria-checked', String(this.soundOn))
    this.els.soundBtn.style.opacity = this.soundOn ? '1' : '0.45'
  }

  toggleSound() {
    this.soundOn = !this.soundOn
    this._applySound()
    this._savePrefs()
    if (this.soundOn) audio.click()
  }

  async toggleTilt() {
    const input = this.game.input
    const btn = this.els.tiltToggle
    if (input.tiltOn) {
      input.disableTilt()
      this._syncTiltUI()
      this.toast('Tilt aiming off', '#9aa9bf', 'motion sensor idle')
      return
    }
    btn.classList.add('pending')
    const res = await input.enableTilt()
    btn.classList.remove('pending')
    this._syncTiltUI()
    if (res === 'granted') {
      this.toast('Tilt aiming on', '#5ce6ff', 'lean to steer — recalibrates on enable')
      audio.click()
    } else if (res === 'denied') {
      this.toast('Motion access denied', '#ff8a80', 'allow motion in browser settings')
    } else {
      this.toast('Motion not available', '#ff8a80', 'this device has no motion sensor')
    }
  }

  _syncTiltUI() {
    const input = this.game.input
    const on = input.tiltOn
    this.els.tiltToggle.classList.toggle('on', on)
    this.els.tiltToggle.setAttribute('aria-checked', String(on))
    this.els.tiltBadge.classList.toggle('hidden', !on)
    const map = {
      off: 'Optional. Uses your device\'s motion sensor.',
      waiting: 'Waiting for motion data… keep the phone still.',
      active: 'Tilt is live. Lean gently to steer your aim.',
      denied: 'Motion access denied. Enable it in browser settings and retry.',
      unsupported: 'This browser does not expose motion sensors.',
      'no-data': 'No motion data detected. On iOS, allow Motion & Orientation access.',
    }
    this.els.tiltStatus.textContent = map[input.tiltStatus] || map.off
  }

  _setQualityUI() {
    for (const b of this.els.qualitySeg.querySelectorAll('[data-quality]')) {
      b.classList.toggle('active', b.dataset.quality === this.quality)
    }
  }

  _buildPhaseDots() {
    this.els.phaseDots.innerHTML = ''
    for (let i = 0; i < 6; i++) this.els.phaseDots.appendChild(document.createElement('i'))
  }

  _startTipRotation() {
    let i = 0
    setInterval(() => {
      if (this.els.menu.classList.contains('hidden')) return
      i = (i + 1) % MENU_TIPS.length
      this.els.menuTip.textContent = MENU_TIPS[i]
    }, 7000)
  }

  _makeCoast() {
    const outer = []
    const inner = []
    const world = this.world
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * TAU
      let lo = 20, hi = 320
      for (let k = 0; k < 18; k++) {
        const m = (lo + hi) / 2
        if (world.heightAt(Math.cos(a) * m, Math.sin(a) * m) > 0.3) lo = m
        else hi = m
      }
      outer.push([Math.cos(a) * lo, Math.sin(a) * lo])
      let lo2 = 20, hi2 = lo
      for (let k = 0; k < 14; k++) {
        const m = (lo2 + hi2) / 2
        if (world.heightAt(Math.cos(a) * m, Math.sin(a) * m) > 2.2) lo2 = m
        else hi2 = m
      }
      inner.push([Math.cos(a) * lo2, Math.sin(a) * lo2])
    }
    return { outer, inner }
  }

  hideLoading() {
    this.els.loading.classList.add('out')
    setTimeout(() => this.els.loading.classList.add('hidden'), 450)
  }

  showMenu() {
    this.playing = false
    this.els.menu.classList.remove('hidden')
    this.els.hud.classList.add('hidden')
    this.els.settings.classList.add('hidden')
    this.els.howto.classList.add('hidden')
    this.els.pause.classList.add('hidden')
    this.els.end.classList.add('hidden')
    this.els.lowHealth.style.opacity = '0'
    this.els.damageVignette.style.opacity = '0'
    this.els.stormVignette.style.opacity = '0'
    document.body.classList.remove('building', 'aiming', 'scoped')
  }

  startHud() {
    this.playing = true
    this.els.menu.classList.add('hidden')
    this.els.hud.classList.remove('hidden')
    this.els.pause.classList.add('hidden')
    this.els.end.classList.add('hidden')
    this.els.killfeed.innerHTML = ''
    this.els.toastLayer.innerHTML = ''
    this.last = {}
    document.body.classList.remove('building')
    this.setBuildMode(false, 'wall')
    this.els.lowHealth.style.opacity = '0'
    this.els.damageVignette.style.opacity = '0'
    this.els.stormVignette.style.opacity = '0'
    this.els.hitmarker.classList.remove('show')
    const hud = this.els.hud
    hud.style.transition = 'none'
    hud.style.opacity = '1'
  }

  pause() {
    this.els.pause.classList.remove('hidden')
  }

  unpause() {
    this.els.pause.classList.add('hidden')
    this.els.settings.classList.add('hidden')
  }

  openSettings(from = 'menu') {
    this.settingsReturn = from
    if (from === 'pause') this.els.pause.classList.add('hidden')
    this.els.settings.classList.remove('hidden')
    this._syncTiltUI()
    this._setQualityUI()
    audio.click()
  }

  openHowTo() {
    this.els.howto.classList.remove('hidden')
    audio.click()
  }

  closeModal(id) {
    const el = $(id)
    el?.classList.add('hidden')
    if (id === 'settingsModal' && this.settingsReturn === 'pause' && this.playing) {
      this.els.pause.classList.remove('hidden')
    }
    audio.click()
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.().catch(() => {})
    }
  }

  setScope(on) {
    this.els.scope.classList.toggle('show', on)
    document.body.classList.toggle('scoped', on)
  }

  setAim(on) {
    if (this.aiming !== on) {
      this.aiming = on
      document.body.classList.toggle('aiming', on)
      this.els.aimBtn?.classList.toggle('active', on)
    }
  }

  setBuildMode(on, type) {
    this.game.player && (this.game.player.buildMode = on)
    document.body.classList.toggle('building', on)
    this.els.buildHud.classList.toggle('hidden', !on)
    this.els.fireLabel.textContent = on ? 'PLACE' : 'FIRE'
    this.els.buildBtn?.classList.toggle('active', on)
    if (on) this.setBuildType(type)
  }

  setBuildType(type) {
    for (const b of this.els.buildOpts) b.classList.toggle('active', b.dataset.build === type)
  }

  setTiltBadge(on) { this.els.tiltBadge.classList.toggle('hidden', !on) }

  kickCrosshair(amount = 1) {
    this.bloom = Math.min(2.2, this.bloom + amount * 0.45)
  }

  updateAmmoFlash() {}

  toast(title, color = '#ffc83d', sub = '') {
    const el = document.createElement('div')
    el.className = 'toast'
    el.style.setProperty('--accent', color)
    const main = document.createElement('span')
    main.className = 't-main'
    main.textContent = title
    el.appendChild(main)
    if (sub) {
      const s = document.createElement('span')
      s.className = 't-sub'
      s.textContent = sub
      el.appendChild(s)
    }
    this.els.toastLayer.appendChild(el)
    this.toastCount++
    const kill = () => {
      el.classList.add('out')
      setTimeout(() => el.remove(), 320)
    }
    setTimeout(kill, 2600)
    while (this.els.toastLayer.children.length > 4) this.els.toastLayer.firstChild.remove()
  }

  banner(main, sub = '', variant = '') {
    this.els.bannerMain.textContent = main
    this.els.bannerSub.textContent = sub
    this.els.banner.className = 'banner show ' + variant
    if (this._bannerTimer) clearTimeout(this._bannerTimer)
    this._bannerTimer = setTimeout(() => this.els.banner.classList.remove('show'), 2600)
  }

  killfeed(killer, victim, opts = {}) {
    const el = document.createElement('div')
    el.className = 'kf-item'
    const k = document.createElement('span')
    k.className = 'kf-killer' + (opts.byPlayer ? ' you' : '')
    k.textContent = killer
    const icon = document.createElement('span')
    icon.className = 'kf-ico'
    icon.textContent = '✖'
    const v = document.createElement('span')
    v.className = 'kf-victim' + (opts.victimPlayer ? ' you' : '')
    v.textContent = victim
    el.append(k, icon, v)
    this.els.killfeed.prepend(el)
    while (this.els.killfeed.children.length > 4) this.els.killfeed.lastChild.remove()
    setTimeout(() => el.remove(), 5200)
  }

  hitmarker(crit = false) {
    const el = this.els.hitmarker
    el.classList.toggle('crit', crit)
    el.classList.remove('show')
    void el.offsetWidth
    el.classList.add('show')
  }

  flashDamage(intensity = 0.5) {
    this.damageFlash = Math.min(1, this.damageFlash + intensity)
  }

  damageDirection(rel) {
    const el = this.els.dmgDir
    el.style.transform = `translate(-50%, -50%) rotate(${rel}rad)`
    el.classList.remove('show')
    void el.offsetWidth
    el.classList.add('show')
  }

  damageNumber(worldPos, text, crit = false, color = null) {
    const v = worldPos.clone().project(this.camera)
    if (v.z > 1 || v.z < -1) return
    const x = (v.x * 0.5 + 0.5) * window.innerWidth
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight
    if (x < -40 || y < -40 || x > window.innerWidth + 40 || y > window.innerHeight + 40) return
    const el = document.createElement('div')
    el.className = 'dmg-num' + (crit ? ' crit' : '')
    el.textContent = typeof text === 'number' ? String(Math.round(text)) : text
    if (color) {
      el.style.color = color
      el.classList.add('heal')
    }
    el.style.left = x + 'px'
    el.style.top = y + 'px'
    this.els.fxLayer.appendChild(el)
    setTimeout(() => el.remove(), 860)
    while (this.els.fxLayer.children.length > 28) this.els.fxLayer.firstChild.remove()
  }

  update(dt) {
    if (!this.playing) return
    const game = this.game
    const player = game.player
    const storm = game.world.storm
    if (!player) return

    const alive = game.bots.reduce((n, b) => n + (b.alive ? 1 : 0), 0) + (player.alive ? 1 : 0)
    if (this.last.alive !== alive) {
      this.els.alive.textContent = alive
      this.last.alive = alive
    }

    const label = storm.label
    const time = storm.phase === 'final' ? '—' : fmtTime(storm.countdown)
    if (this.last.storm !== label + time) {
      this.els.stormTimer.textContent = time
      this.els.stormLabel.textContent = label
      this.els.stormPill.classList.toggle('danger', storm.countdown < 9 && storm.phase !== 'final')
      this.last.storm = label + time
    }
    const dots = this.els.phaseDots.children
    for (let i = 0; i < dots.length; i++) {
      dots[i].className = i < storm.index ? 'done' : i === storm.index ? 'now' : ''
    }

    const hp = Math.max(0, Math.ceil(player.hp))
    const sh = Math.max(0, Math.ceil(player.shield))
    this.els.healthFill.style.width = clamp((player.hp / player.maxHp) * 100, 0, 100) + '%'
    this.els.shieldFill.style.width = clamp((player.shield / player.maxShield) * 100, 0, 100) + '%'
    if (this.last.hp !== hp) { this.els.healthText.textContent = hp; this.last.hp = hp }
    if (this.last.sh !== sh) { this.els.shieldText.textContent = sh; this.last.sh = sh }
    this.els.healthRow.classList.toggle('low', player.hp < 35)
    const low = player.hp < 35 && player.alive ? 0.3 + Math.sin(performance.now() * 0.006) * 0.16 : 0
    this.els.lowHealth.style.opacity = low.toFixed(2)

    const wood = Math.floor(player.wood)
    if (this.last.wood !== wood) {
      this.els.wood.textContent = wood
      this.els.buildWood.textContent = wood
      this.last.wood = wood
    }

    const current = player.current
    if (this.last.slot !== current) {
      this.els.weaponSlots.forEach((el, i) => el.classList.toggle('active', i === current))
      this.last.slot = current
    }
    this._updateSlots(player)

    this.els.reloadRing.classList.toggle('show', player.reloadT > 0)
    if (player.reloadT > 0 && player.reloadTotal > 0) {
      this.els.reloadRing.style.setProperty('--p', String(1 - player.reloadT / player.reloadTotal))
    }

    this._updateMinimap(dt, player, storm, game)
    this._updateLocation(player, game)

    this.bloom = Math.max(0, this.bloom - dt * 2.4)
    const gap = (this.aiming ? 4 : 7) + this.bloom * 9
    this.els.crosshair.style.setProperty('--gap', gap.toFixed(1) + 'px')

    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8)
    this.els.damageVignette.style.opacity = (this.damageFlash * 0.9).toFixed(2)
    const outside = storm.outside(player.pos.x, player.pos.z, 0.5) && player.state === 'active'
    this.stormOpacity = lerp(this.stormOpacity, outside ? 0.85 : 0, 1 - Math.exp(-3 * dt))
    this.els.stormVignette.style.opacity = this.stormOpacity.toFixed(2)

    const tiltOn = Boolean(player.input?.tiltOn)
    const tiltStatus = player.input?.tiltStatus
    if (this.last.tiltOn !== tiltOn || this.last.tiltStatus !== tiltStatus) {
      this.last.tiltOn = tiltOn
      this.last.tiltStatus = tiltStatus
      this._syncTiltUI()
      this.setTiltBadge(tiltOn)
    }
  }

  _updateSlots(player) {
    for (let i = 0; i < 3; i++) {
      const el = this.els.weaponSlots[i]
      const ammo = this.els.wammo[i]
      let weapon = null
      if (i === 0) weapon = null
      else weapon = player.weapons[i - 1]
      const isPick = i === 0
      el.classList.toggle('empty', !isPick && !weapon)
      if (isPick) {
        el.style.setProperty('--rarity', '#8fa3b8')
        el.style.setProperty('--fill', '100%')
        ammo.textContent = '∞'
        const name = el.querySelector('.wslot-name')
        if (name.textContent !== 'PICKAXE') name.textContent = 'PICKAXE'
        const ico = el.querySelector('.wslot-ico')
        if (!ico.dataset.pick) {
          ico.dataset.pick = '1'
          ico.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 20 14.5 9.5M12.5 4.6l6.9 6.9M9.7 7.6l3 3M17 3l4 4-2.4 1.2-2.8-2.8z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>'
        }
      } else if (weapon) {
        el.style.setProperty('--rarity', weapon.color)
        el.style.setProperty('--fill', clamp((weapon.mag / weapon.magSize) * 100, 0, 100) + '%')
        ammo.textContent = `${weapon.mag}/${weapon.reserve}`
        const name = el.querySelector('.wslot-name')
        if (name.textContent !== weapon.name.toUpperCase()) name.textContent = weapon.name.toUpperCase()
        const ico = el.querySelector('.wslot-ico')
        if (ico.textContent !== weapon.short) ico.textContent = weapon.short
      } else {
        el.style.setProperty('--rarity', '#8fa3b8')
        el.style.setProperty('--fill', '0%')
        ammo.textContent = ''
        el.querySelector('.wslot-name').textContent = 'EMPTY'
        el.querySelector('.wslot-ico').textContent = '—'
      }
    }
  }

  _updateLocation(player, game) {
    if ((this._locTimer = (this._locTimer || 0) - 0.016) > 0) return
    this._locTimer = 0.4
    let best = null
    let bd = 42
    for (const p of this.game.world.poiMarkers || []) {
      const d = Math.hypot(player.pos.x - p.x, player.pos.z - p.z)
      if (d < bd) { bd = d; best = p }
    }
    const name = best ? best.name.toUpperCase() : player.state === 'drop' ? 'DROPPING IN' : 'THE WILDS'
    if (this.last.loc !== name) {
      this.els.location.textContent = name
      this.last.loc = name
    }
  }

  _updateMinimap(dt, player, storm, game) {
    this.mapAccum += dt
    if (this.mapAccum < 0.1) return
    this.mapAccum = 0
    const ctx = this.ctx
    const size = 188
    const c = size / 2
    const scale = 88 / 300
    const M = (x, z) => [c + x * scale, c + z * scale]

    ctx.clearRect(0, 0, size, size)
    const bg = ctx.createRadialGradient(c, c, 10, c, c, c)
    bg.addColorStop(0, '#0f4d66')
    bg.addColorStop(1, '#082638')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = 'rgba(160, 220, 255, 0.07)'
    ctx.lineWidth = 1
    for (let r = 30; r < 100; r += 25) {
      ctx.beginPath(); ctx.arc(c, c, r, 0, TAU); ctx.stroke()
    }
    // island
    ctx.beginPath()
    this._coast.outer.forEach(([x, z], i) => {
      const [px, py] = M(x, z)
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
    })
    ctx.closePath()
    ctx.fillStyle = '#d9c292'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255, 235, 190, 0.5)'
    ctx.stroke()
    ctx.beginPath()
    this._coast.inner.forEach(([x, z], i) => {
      const [px, py] = M(x, z)
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
    })
    ctx.closePath()
    const land = ctx.createLinearGradient(0, 0, 0, size)
    land.addColorStop(0, '#7fb967')
    land.addColorStop(1, '#5b9d58')
    ctx.fillStyle = land
    ctx.fill()
    ctx.strokeStyle = 'rgba(38, 83, 52, 0.35)'
    ctx.lineWidth = 1
    ctx.stroke()

    // POIs
    for (const p of this.game.world.poiMarkers || []) {
      const [px, py] = M(p.x, p.z)
      ctx.beginPath()
      ctx.arc(px, py, 3.4, 0, TAU)
      ctx.fillStyle = 'rgba(10, 16, 30, 0.65)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(px, py, 2, 0, TAU)
      ctx.fillStyle = p.color || '#ffda7a'
      ctx.fill()
      if (size > 150) {
        ctx.font = '600 7px Outfit, sans-serif'
        ctx.fillStyle = 'rgba(255,255,255,.65)'
        ctx.textAlign = 'center'
        ctx.fillText(p.name.toUpperCase(), px, py + 10)
      }
    }

    // storm: shade everything outside the safe circle
    const [sx, sy] = M(storm.center.x, storm.center.y)
    const sr = storm.radius * scale
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, size, size)
    ctx.arc(sx, sy, Math.max(0, sr), 0, TAU, true)
    ctx.fillStyle = 'rgba(153, 83, 255, 0.36)'
    ctx.fill('evenodd')
    ctx.restore()
    ctx.beginPath()
    ctx.arc(sx, sy, Math.max(0, sr), 0, TAU)
    ctx.strokeStyle = 'rgba(200, 160, 255, 0.9)'
    ctx.lineWidth = 1.6
    ctx.stroke()

    const next = storm.nextCircle
    if (next) {
      const [nx, ny] = M(next.x, next.z)
      ctx.save()
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.arc(nx, ny, next.r * scale, 0, TAU)
      ctx.strokeStyle = 'rgba(255,255,255,.75)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()
    }

    // enemies within radar range
    for (const bot of game.bots) {
      if (!bot.alive) continue
      const d = Math.hypot(bot.pos.x - player.pos.x, bot.pos.z - player.pos.z)
      if (d > 85) continue
      const [bx, by] = M(bot.pos.x, bot.pos.z)
      ctx.beginPath()
      ctx.arc(bx, by, 2.2, 0, TAU)
      ctx.fillStyle = '#ff5b5b'
      ctx.shadowColor = '#ff5b5b'
      ctx.shadowBlur = 4
      ctx.fill()
      ctx.shadowBlur = 0
    }

    // player arrow
    const [px, py] = M(player.pos.x, player.pos.z)
    const fx = Math.sin(player.camYaw)
    const fz = Math.cos(player.camYaw)
    const rx = -Math.cos(player.camYaw)
    const rz = Math.sin(player.camYaw)
    const tipX = px + fx * 8
    const tipY = py + fz * 8
    const backX = px - fx * 4
    const backY = py - fz * 4
    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(backX + rx * 5, backY + rz * 5)
    ctx.lineTo(backX - rx * 5, backY - rz * 5)
    ctx.closePath()
    ctx.fillStyle = '#5ce6ff'
    ctx.strokeStyle = 'rgba(4, 20, 30, 0.85)'
    ctx.lineWidth = 1.5
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(px, py, 1.5, 0, TAU)
    ctx.fillStyle = '#fff'
    ctx.fill()

    // compass
    ctx.font = '800 9px Outfit, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,.55)'
    ctx.fillText('N', c, 12)
    ctx.fillText('S', c, size - 5)
    ctx.fillText('W', 7, c + 3)
    ctx.fillText('E', size - 7, c + 3)
  }

  showEnd(win, placement, stats, killerName) {
    this.playing = false
    this.els.end.classList.remove('hidden')
    this.els.end.classList.toggle('defeat', !win)
    this.els.lowHealth.style.opacity = '0'
    this.els.damageVignette.style.opacity = '0'
    this.els.stormVignette.style.opacity = '0'
    this.els.hitmarker.classList.remove('show')
    this.els.banner.classList.remove('show')
    if (this._bannerTimer) clearTimeout(this._bannerTimer)
    document.body.classList.remove('building', 'aiming', 'scoped')
    this.els.scope.classList.remove('show')
    this.els.endKicker.textContent = win ? 'MATCH COMPLETE · #1 OF 16' : `MATCH COMPLETE · #${placement} OF 16`
    this.els.endTitle.innerHTML = win ? 'VICTORY<br><span>ROYALE</span>' : 'ELIMINATED'
    this.els.endSub.textContent = win
      ? 'You outlasted the island. The storm bows to you.'
      : killerName ? `You were bested by ${killerName}.` : 'The storm got the last word.'
    this.els.statPlace.textContent = '#' + placement
    this.els.statKills.textContent = stats.kills
    this.els.statDamage.textContent = stats.damage
    this.els.statTime.textContent = fmtTime(stats.time)
    if (win) {
      this._confetti()
      audio.victory()
    } else {
      audio.death()
    }
  }

  _confetti() {
    const colors = ['#ffc83d', '#5ce6ff', '#ff6b6b', '#8ef29a', '#b36bff', '#ffffff']
    for (let i = 0; i < 80; i++) {
      const el = document.createElement('i')
      el.className = 'confetti'
      el.style.left = Math.random() * 100 + '%'
      el.style.background = colors[i % colors.length]
      el.style.animationDuration = (2.6 + Math.random() * 3.2) + 's'
      el.style.animationDelay = (Math.random() * 2.4) + 's'
      el.style.transform = `rotate(${Math.random() * 360}deg)`
      el.style.borderRadius = Math.random() < 0.3 ? '50%' : '1px'
      this.els.end.appendChild(el)
    }
  }

  setTiltStatus(status) {
    this._syncTiltUI()
  }

  showSettingsForMenu() { this.openSettings('menu') }

  resetEnd() {
    this.els.end.querySelectorAll('.confetti').forEach((c) => c.remove())
  }
}
