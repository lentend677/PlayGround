/* ─────────────────────────────────────────────────────────────────────
   A tiny procedural soundscape. Created lazily after the first tap so
   iOS Safari is happy. No audio files, no network requests.
   ───────────────────────────────────────────────────────────────────── */

export class Soundscape {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this.wind = null;
    this.windGain = null;
    this.noiseBuffer = null;
    this.night = false;
    this.birdTimer = 4;
    this.cricketTimer = 1;
    this.started = false;
  }

  async start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.42 : 0;
    this.master.connect(ctx.destination);
    this.noiseBuffer = this.makeNoise(ctx, 4);

    // Wind: filtered looping noise, very quiet.
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 460;
    filter.Q.value = 0.4;
    const gain = ctx.createGain();
    gain.gain.value = 0.032;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.075;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.014;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    lfo.start();
    this.wind = src;
    this.windGain = gain;
    this.started = true;
    if (ctx.state === 'suspended') await ctx.resume();
  }

  makeNoise(ctx, seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 2.6;
    }
    return buffer;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.42 : 0, this.ctx.currentTime, 0.08);
    }
    if (on) this.start();
  }

  setNight(night) {
    this.night = night;
  }

  update(dt, dayFactor) {
    if (!this.ctx || !this.started) return;
    this.night = dayFactor < 0.38;
    this.birdTimer -= dt;
    this.cricketTimer -= dt;
    if (this.night) {
      if (this.cricketTimer <= 0) {
        this.cricketTimer = 1.1 + Math.random() * 1.7;
        this.cricket();
      }
    } else if (this.birdTimer <= 0 && dayFactor > 0.55) {
      this.birdTimer = 4 + Math.random() * 7;
      this.bird();
    }
    // Wind breathes a little with the time of day.
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(0.022 + dayFactor * 0.013, this.ctx.currentTime, 0.6);
    }
  }

  tone(freq, dur, type = 'sine', volume = 0.15, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + Math.min(0.02, dur * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  noiseBurst(dur = 0.09, freq = 900, q = 1, volume = 0.18, type = 'bandpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t, Math.random() * 2);
    src.stop(t + dur + 0.02);
  }

  mine(material = 'dirt') {
    if (!this.ctx) return;
    const map = {
      grass: [520, 0.55, 0.14],
      dirt: [380, 0.7, 0.16],
      stone: [1500, 0.9, 0.12],
      sand: [720, 0.55, 0.13],
      wood: [620, 1.1, 0.15],
      leaves: [920, 0.7, 0.1],
      glass: [1900, 1.4, 0.1],
    };
    const [freq, q, vol] = map[material] || map.dirt;
    this.noiseBurst(0.08 + Math.random() * 0.05, freq, q, vol);
    this.tone(material === 'stone' ? 150 : 95, 0.07, 'sine', 0.05, -30);
  }

  place(material = 'dirt') {
    if (!this.ctx) return;
    this.noiseBurst(0.07, material === 'stone' ? 900 : 420, 0.8, 0.11);
    this.tone(material === 'wood' ? 180 : 120, 0.09, 'sine', 0.09, -45);
  }

  step(material = 'grass') {
    if (!this.ctx) return;
    const map = { grass: 480, dirt: 360, sand: 720, stone: 1200, wood: 600, leaves: 880, glass: 1500 };
    this.noiseBurst(0.045, (map[material] || 480) * (0.9 + Math.random() * 0.2), 0.8, 0.045);
  }

  jump() {
    this.tone(210, 0.12, 'triangle', 0.05, 70);
    this.noiseBurst(0.1, 500, 0.6, 0.04, 'highpass');
  }

  land() {
    this.tone(95, 0.09, 'sine', 0.08, -25);
    this.noiseBurst(0.06, 320, 0.7, 0.06);
  }

  ui() {
    this.tone(880, 0.08, 'sine', 0.04, 120);
  }

  bird() {
    if (!this.ctx) return;
    const base = 1700 + Math.random() * 900;
    const notes = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < notes; i++) {
      setTimeout(() => {
        if (!this.ctx || !this.enabled) return;
        this.tone(base + i * 130, 0.09, 'sine', 0.018, 100);
      }, i * 90);
    }
  }

  cricket() {
    if (!this.ctx) return;
    const base = 2900 + Math.random() * 700;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (!this.ctx || !this.enabled) return;
        this.tone(base, 0.035, 'square', 0.008, 40);
      }, i * 48);
    }
  }
}
