export class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.enabled = true
    this.ready = false
    this.stormGain = null
    this.windGain = null
    this.lastStep = 0
    this._ambientTimer = 4
    this._noise = null
  }

  init() {
    if (this.ready) { this.ctx.resume?.(); return }
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    try {
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.enabled ? 0.7 : 0
      this.master.connect(this.ctx.destination)
      this._noise = this._makeNoise(2.5)
      this._startAmbient()
      this.ready = true
    } catch { this.ready = false }
  }

  _makeNoise(seconds = 1) {
    const ctx = this.ctx
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2
    }
    return buffer
  }

  _startAmbient() {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this._noise
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0.035
    src.connect(filter).connect(this.windGain).connect(this.master)
    src.start()

    const src2 = ctx.createBufferSource()
    src2.buffer = this._noise
    src2.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 260
    bp.Q.value = 0.7
    this.stormGain = ctx.createGain()
    this.stormGain.gain.value = 0.0001
    src2.connect(bp).connect(this.stormGain).connect(this.master)
    src2.start()

    const hum = ctx.createOscillator()
    hum.type = 'sine'
    hum.frequency.value = 46
    const humGain = ctx.createGain()
    humGain.gain.value = 0.018
    hum.connect(humGain).connect(this.stormGain)
    hum.start()
  }

  setEnabled(on) {
    this.enabled = on
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.05)
  }

  _env(node, t0, attack, hold, release, peak = 1) {
    node.gain.setValueAtTime(0.0001, t0)
    node.gain.exponentialRampToValueAtTime(peak, t0 + attack)
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release)
  }

  _noiseBurst({ dur = 0.15, freq = 1200, q = 0.8, gain = 0.2, type = 'lowpass', t0 = 0 }) {
    if (!this.ready || !this.enabled) return
    const ctx = this.ctx
    const t = ctx.currentTime + t0
    const src = ctx.createBufferSource()
    src.buffer = this._noise
    src.playbackRate.value = 0.8 + Math.random() * 0.4
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    filter.Q.value = q
    const g = ctx.createGain()
    this._env(g, t, 0.004, dur * 0.25, dur, gain)
    src.connect(filter).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.1)
  }

  _tone({ freq = 440, dur = 0.12, gain = 0.08, type = 'sine', slide = 0, t0 = 0, attack = 0.006 }) {
    if (!this.ready || !this.enabled) return
    const ctx = this.ctx
    const t = ctx.currentTime + t0
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur)
    const g = ctx.createGain()
    this._env(g, t, attack, dur * 0.2, dur, gain)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.1)
  }

  shot(kind = 'ar', dist = 0) {
    if (!this.ready || !this.enabled) return
    const vol = Math.max(0.05, 1 - dist / 260)
    if (kind === 'shotgun') {
      this._noiseBurst({ dur: 0.28, freq: 900, gain: 0.42 * vol, type: 'lowpass' })
      this._tone({ freq: 90, slide: -50, dur: 0.24, gain: 0.25 * vol, type: 'triangle' })
    } else if (kind === 'sniper') {
      this._noiseBurst({ dur: 0.4, freq: 1500, gain: 0.5 * vol })
      this._tone({ freq: 140, slide: -100, dur: 0.35, gain: 0.28 * vol, type: 'sawtooth' })
    } else if (kind === 'smg') {
      this._noiseBurst({ dur: 0.09, freq: 1800, gain: 0.16 * vol, type: 'bandpass', q: 1.2 })
      this._tone({ freq: 180, slide: -80, dur: 0.06, gain: 0.1 * vol, type: 'square' })
    } else if (kind === 'pistol') {
      this._noiseBurst({ dur: 0.12, freq: 1600, gain: 0.23 * vol, type: 'bandpass', q: 1 })
      this._tone({ freq: 150, slide: -60, dur: 0.09, gain: 0.12 * vol, type: 'square' })
    } else {
      this._noiseBurst({ dur: 0.12, freq: 1350, gain: 0.26 * vol, type: 'bandpass', q: 0.9 })
      this._tone({ freq: 130, slide: -60, dur: 0.09, gain: 0.13 * vol, type: 'square' })
    }
  }

  hit(head = false) {
    this._tone({ freq: head ? 1400 : 900, dur: 0.06, gain: 0.1, type: 'square' })
    this._tone({ freq: head ? 2200 : 1300, dur: 0.05, gain: 0.06, type: 'sine', t0: 0.03 })
  }

  hurt() {
    this._noiseBurst({ dur: 0.18, freq: 600, gain: 0.18 })
    this._tone({ freq: 220, slide: -100, dur: 0.18, gain: 0.1, type: 'sawtooth' })
  }

  chest() {
    this._tone({ freq: 660, dur: 0.1, gain: 0.07, type: 'triangle' })
    this._tone({ freq: 880, dur: 0.1, gain: 0.07, type: 'triangle', t0: 0.08 })
    this._tone({ freq: 1320, dur: 0.22, gain: 0.08, type: 'triangle', t0: 0.16 })
  }

  pickaxe() {
    this._noiseBurst({ dur: 0.1, freq: 900, gain: 0.13, type: 'bandpass', q: 1.4 })
    this._tone({ freq: 520, slide: -260, dur: 0.1, gain: 0.04, type: 'triangle' })
  }

  wood() {
    this._noiseBurst({ dur: 0.12, freq: 700, gain: 0.12, type: 'lowpass' })
    this._tone({ freq: 340, slide: 120, dur: 0.1, gain: 0.04, type: 'triangle' })
  }

  build() {
    this._tone({ freq: 240, slide: 120, dur: 0.12, gain: 0.08, type: 'square' })
    this._noiseBurst({ dur: 0.16, freq: 800, gain: 0.1 })
  }

  reload() {
    this._tone({ freq: 380, dur: 0.05, gain: 0.06, type: 'square' })
    this._tone({ freq: 240, dur: 0.07, gain: 0.06, type: 'square', t0: 0.16 })
    this._tone({ freq: 500, dur: 0.06, gain: 0.06, type: 'square', t0: 0.32 })
  }

  jump() { this._tone({ freq: 300, slide: 120, dur: 0.12, gain: 0.035, type: 'sine' }) }
  land() { this._noiseBurst({ dur: 0.1, freq: 300, gain: 0.08 }) }
  step() {
    const now = performance.now()
    if (now - this.lastStep < 170) return
    this.lastStep = now
    this._noiseBurst({ dur: 0.05, freq: 340, gain: 0.045, type: 'lowpass' })
  }

  elim() {
    this._tone({ freq: 520, dur: 0.09, gain: 0.08, type: 'triangle' })
    this._tone({ freq: 780, dur: 0.12, gain: 0.08, type: 'triangle', t0: 0.07 })
    this._tone({ freq: 1040, dur: 0.2, gain: 0.09, type: 'triangle', t0: 0.15 })
  }

  death() {
    this._tone({ freq: 320, slide: -240, dur: 0.7, gain: 0.12, type: 'sawtooth' })
    this._noiseBurst({ dur: 0.5, freq: 500, gain: 0.15 })
  }

  victory() {
    const notes = [523, 659, 784, 1047, 1319]
    notes.forEach((f, i) => {
      this._tone({ freq: f, dur: 0.5, gain: 0.09, type: 'triangle', t0: i * 0.13 })
      this._tone({ freq: f * 2, dur: 0.4, gain: 0.025, type: 'sine', t0: i * 0.13 })
    })
  }

  click() { this._tone({ freq: 640, dur: 0.04, gain: 0.03, type: 'square' }) }

  update(dt, { outside = 0, menu = false } = {}) {
    if (!this.ready) return
    const t = this.ctx.currentTime
    if (this.stormGain) this.stormGain.gain.setTargetAtTime(outside > 0 ? 0.16 + outside * 0.2 : menu ? 0.01 : 0.0001, t, 0.3)
    if (this.windGain) this.windGain.gain.setTargetAtTime(menu ? 0.05 : 0.025, t, 1.5)
    this._ambientTimer -= dt
    if (this._ambientTimer <= 0 && !menu) {
      this._ambientTimer = 7 + Math.random() * 12
      const dist = 90 + Math.random() * 90
      this.shot(Math.random() < 0.2 ? 'shotgun' : 'ar', dist)
    }
  }
}

export const audio = new AudioEngine()
