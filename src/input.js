import { clamp } from './utils.js'

const ACTION_KEYS = {
  Space: 'jump',
  KeyR: 'reload',
  KeyB: 'build',
  KeyF: 'place',
  KeyQ: 'buildType',
  KeyX: 'switch',
  KeyE: 'interact',
  Digit1: 'slot0',
  Digit2: 'slot1',
  Digit3: 'slot2',
}

export class Input {
  constructor(canvas) {
    this.canvas = canvas
    this.touchUI = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || window.innerWidth < 820
    this.keys = new Set()
    this.move = { x: 0, y: 0 }
    this.look = { x: 0, y: 0 }
    this.firing = false
    this.aiming = false
    this.sprinting = false
    this.actions = {}
    this.slotRequest = -1
    this.enabled = false
    this.pointerLocked = false
    this.tiltOn = false
    this.tiltStatus = 'off'
    this.tiltRaw = { yaw: 0, pitch: 0 }
    this.tiltSmooth = { yaw: 0, pitch: 0 }
    this.tiltBase = null
    this.tiltActive = false
    this._tiltHandler = null
    this._lookPointer = null
    this._stickPointer = null
    this._stickOrigin = { x: 0, y: 0 }
    this._stickEl = document.getElementById('stickBase')
    this._knobEl = document.getElementById('stickKnob')
    this._onLockChange = null
    this._lockRequestedAt = 0
    this.pointerLockFailed = false
    this._bind()
    document.body.classList.toggle('touch-ui', this.touchUI)
    document.body.classList.toggle('desktop-ui', !this.touchUI)
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
      if (e.repeat) return
      this.keys.add(e.code)
      const action = ACTION_KEYS[e.code]
      if (action && this.enabled) {
        if (action.startsWith('slot')) this.slotRequest = parseInt(action.slice(4), 10)
        else this.actions[action] = true
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprinting = true
    })
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code)
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprinting = false
    })
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.firing = false
      this.aiming = false
      this.move.x = this.move.y = 0
    })

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas
      if (this.pointerLocked) this.pointerLockFailed = false
      else {
        this.firing = false
        this.aiming = false
      }
      this._onLockChange?.(this.pointerLocked)
    })
    document.addEventListener('pointerlockerror', () => {
      this.pointerLockFailed = true
    })
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled) return
      if (this.pointerLocked) {
        this.look.x += e.movementX
        this.look.y += e.movementY
      }
    })
    document.addEventListener('mousedown', (e) => {
      if (!this.enabled) return
      if (e.target.closest?.('button, .panel, .modal')) return
      if (!this.touchUI && !this.pointerLocked && !this.pointerLockFailed
        && performance.now() - this._lockRequestedAt < 400) return
      if (e.button === 0) this.firing = true
      if (e.button === 2) this.aiming = true
    })
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.firing = false
      if (e.button === 2) this.aiming = false
    })
    document.addEventListener('contextmenu', (e) => e.preventDefault())

    this.canvas.addEventListener('pointerdown', (e) => this._pointerDown(e))
    window.addEventListener('pointermove', (e) => this._pointerMove(e))
    window.addEventListener('pointerup', (e) => this._pointerUp(e))
    window.addEventListener('pointercancel', (e) => this._pointerUp(e))

    for (const el of document.querySelectorAll('[data-action]')) {
      const action = el.dataset.action
      const down = (e) => {
        e.preventDefault()
        e.stopPropagation()
        try { el.setPointerCapture?.(e.pointerId) } catch {}
        el.classList.add('pressed')
        this._press(action, true)
      }
      const up = (e) => {
        e.preventDefault()
        e.stopPropagation()
        el.classList.remove('pressed')
        this._press(action, false)
      }
      el.addEventListener('pointerdown', down)
      el.addEventListener('pointerup', up)
      el.addEventListener('pointercancel', up)
      el.addEventListener('lostpointercapture', up)
    }
    for (const el of document.querySelectorAll('[data-slot]')) {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.slotRequest = parseInt(el.dataset.slot, 10)
      })
    }
  }

  _press(action, down) {
    if (!this.enabled) return
    if (action === 'fire') {
      this.firing = down
      if (down) this.actions.fire = true
    } else if (action === 'aim') {
      this.aiming = down
    } else if (down) {
      this.actions[action] = true
    }
  }

  _pointerDown(e) {
    if (!this.enabled) return
    if (e.pointerType === 'mouse' && !this.touchUI) {
      if (!this.pointerLocked) {
        this._lockRequestedAt = performance.now()
        const req = this.canvas.requestPointerLock?.()
        if (req && typeof req.catch === 'function') req.catch(() => { this.pointerLockFailed = true })
        return
      }
      return
    }
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const w = rect.width
    const h = rect.height
    if (x < w * 0.46 && y > h * 0.34 && this._stickPointer === null) {
      this._stickPointer = e.pointerId
      this._stickOrigin.x = e.clientX
      this._stickOrigin.y = e.clientY
      if (this._stickEl) {
        this._stickEl.style.left = e.clientX + 'px'
        this._stickEl.style.top = e.clientY + 'px'
        this._stickEl.style.bottom = 'auto'
        this._stickEl.classList.add('active')
      }
      try { this.canvas.setPointerCapture?.(e.pointerId) } catch {}
      e.preventDefault()
    } else if (this._lookPointer === null) {
      this._lookPointer = e.pointerId
      this._lastLook = { x: e.clientX, y: e.clientY }
      try { this.canvas.setPointerCapture?.(e.pointerId) } catch {}
      e.preventDefault()
    }
  }

  _pointerMove(e) {
    if (!this.enabled) return
    if (e.pointerId === this._stickPointer) {
      const dx = e.clientX - this._stickOrigin.x
      const dy = e.clientY - this._stickOrigin.y
      const max = 48
      const len = Math.hypot(dx, dy)
      const cl = len > max ? max / len : 1
      const ox = dx * cl
      const oy = dy * cl
      if (this._knobEl) this._knobEl.style.transform = `translate(-50%,-50%) translate(${ox}px, ${oy}px)`
      const nx = clamp(dx / max, -1, 1)
      const ny = clamp(dy / max, -1, 1)
      const dead = 0.1
      const m = Math.hypot(nx, ny)
      if (m < dead) {
        this.move.x = 0
        this.move.y = 0
      } else {
        const k = Math.min(1, (m - dead) / (1 - dead))
        this.move.x = (nx / m) * k
        this.move.y = -(ny / m) * k
      }
    } else if (e.pointerId === this._lookPointer) {
      const dx = e.clientX - this._lastLook.x
      const dy = e.clientY - this._lastLook.y
      this._lastLook.x = e.clientX
      this._lastLook.y = e.clientY
      const sens = e.pointerType === 'touch' ? 0.0052 : 0.0042
      this.look.x += dx * sens
      this.look.y += dy * sens
    }
  }

  _pointerUp(e) {
    if (e.pointerId === this._stickPointer) {
      this._stickPointer = null
      this.move.x = 0
      this.move.y = 0
      if (this._knobEl) this._knobEl.style.transform = 'translate(-50%,-50%)'
      if (this._stickEl) {
        this._stickEl.classList.remove('active')
        this._stickEl.style.left = ''
        this._stickEl.style.top = ''
        this._stickEl.style.bottom = ''
      }
    }
    if (e.pointerId === this._lookPointer) this._lookPointer = null
  }

  requestLock() {
    if (this.touchUI) return
    this.canvas.requestPointerLock?.()
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock?.()
  }

  onLockChange(fn) { this._onLockChange = fn }

  enable(on) {
    this.enabled = on
    if (!on) {
      this.move.x = this.move.y = 0
      this.firing = false
      this.aiming = false
      this.keys.clear()
    }
  }

  updateMove() {
    if (this._stickPointer !== null) return
    let x = 0
    let y = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1
    if (x || y) {
      const len = Math.hypot(x, y)
      x /= len
      y /= len
    }
    this.move.x = x
    this.move.y = y
  }

  endFrame() {
    this.actions = {}
    this.slotRequest = -1
    this.look.x = 0
    this.look.y = 0
  }

  updateTilt(dt) {
    if (!this.tiltOn || !this.tiltActive) return
    const k = 1 - Math.exp(-10 * dt)
    this.tiltSmooth.yaw += (this.tiltRaw.yaw - this.tiltSmooth.yaw) * k
    this.tiltSmooth.pitch += (this.tiltRaw.pitch - this.tiltSmooth.pitch) * k
  }

  get tilt() {
    if (!this.tiltOn || !this.tiltActive) return { yaw: 0, pitch: 0 }
    const dz = (v) => (Math.abs(v) < 2.5 ? 0 : v - Math.sign(v) * 2.5)
    return {
      yaw: clamp(dz(this.tiltSmooth.yaw) * 0.032, -1.3, 1.3),
      pitch: clamp(dz(this.tiltSmooth.pitch) * 0.022, -0.8, 0.8),
    }
  }

  async enableTilt() {
    if (this.tiltOn) return this.tiltStatus
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission()
        if (res !== 'granted') {
          this.tiltStatus = 'denied'
          return 'denied'
        }
      } else if (typeof DeviceOrientationEvent === 'undefined') {
        this.tiltStatus = 'unsupported'
        return 'unsupported'
      }
      if (!this._tiltHandler) {
        this._tiltHandler = (e) => this._onOrientation(e)
        window.addEventListener('deviceorientation', this._tiltHandler, true)
      }
      this.tiltOn = true
      this.tiltStatus = 'waiting'
      this.tiltBase = null
      this.tiltActive = false
      setTimeout(() => {
        if (this.tiltOn && !this.tiltActive) this.tiltStatus = 'no-data'
      }, 1800)
      return 'granted'
    } catch {
      this.tiltStatus = 'denied'
      return 'denied'
    }
  }

  disableTilt() {
    this.tiltOn = false
    this.tiltActive = false
    this.tiltStatus = 'off'
    this.tiltRaw.yaw = this.tiltRaw.pitch = 0
    this.tiltSmooth.yaw = this.tiltSmooth.pitch = 0
    if (this._tiltHandler) {
      window.removeEventListener('deviceorientation', this._tiltHandler, true)
      this._tiltHandler = null
    }
  }

  _onOrientation(e) {
    if (e.beta === null && e.gamma === null) return
    const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0
    let yawRaw = e.gamma || 0
    let pitchRaw = e.beta || 0
    if (angle === 90) { yawRaw = -(e.beta || 0); pitchRaw = e.gamma || 0 }
    else if (angle === -90 || angle === 270) { yawRaw = e.beta || 0; pitchRaw = -(e.gamma || 0) }
    else if (Math.abs(angle) === 180) { yawRaw = -(e.gamma || 0); pitchRaw = -(e.beta || 0) }
    if (!this.tiltBase) {
      this.tiltBase = { yaw: yawRaw, pitch: pitchRaw }
      this.tiltActive = true
      this.tiltStatus = 'active'
      return
    }
    this.tiltRaw.yaw = clamp(yawRaw - this.tiltBase.yaw, -55, 55)
    this.tiltRaw.pitch = clamp(pitchRaw - this.tiltBase.pitch, -55, 55)
  }
}
