import { clamp } from './util.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.windGain = null;
    this.padGain = null;
    this.started = false;
    this.enabled = true;
    this.noiseBuffer = null;
    this.night = 0;
  }

  ensureContext() {
    if (this.ctx) return true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.8 : 0;
    this.master.connect(this.ctx.destination);
    return true;
  }

  start() {
    if (this.started || !this.ensureContext()) return;
    this.started = true;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const ctx = this.ctx;
    const seconds = 2.5;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.018 * white) / 1.018;
      data[i] = last * 3.4;
    }
    this.noiseBuffer = buffer;

    const wind = ctx.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 620;
    windFilter.Q.value = 0.35;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.026;
    wind.connect(windFilter).connect(windGain).connect(this.master);
    wind.start();
    this.windGain = windGain;
    this.windFilter = windFilter;

    // A soft, slow chord that feels like the island breathing.
    const padBus = ctx.createGain();
    padBus.gain.value = 0.018;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 900;
    padFilter.Q.value = 0.5;
    padBus.connect(padFilter).connect(this.master);
    const frequencies = [110, 164.81, 220, 329.63];
    for (let i = 0; i < frequencies.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 3 ? 'sine' : 'triangle';
      osc.frequency.value = frequencies[i];
      osc.detune.value = (i - 1.5) * 3.2;
      const gain = ctx.createGain();
      gain.gain.value = i === 3 ? 0.06 : 0.12;
      osc.connect(gain).connect(padBus);
      osc.start();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.045 + i * 0.013;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.07;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start();
    }
    this.padGain = padBus;
    this.padFilter = padFilter;

    // Occasional distant gull-like calls are synthesized in a very soft register.
    this.scheduleBird();
  }

  scheduleBird() {
    if (!this.started) return;
    const delay = 9 + Math.random() * 18;
    this.birdTimer = setTimeout(() => {
      if (this.enabled && this.ctx?.state === 'running') this.birdCall();
      this.scheduleBird();
    }, delay * 1000);
  }

  birdCall() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const base = 700 + Math.random() * 500;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.13;
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 0.58, t + 0.11);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.018, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.2);
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(enabled ? 0.8 : 0, now, 0.08);
    }
    if (enabled && this.ctx?.state === 'suspended') this.ctx.resume();
  }

  update(night) {
    this.night = night;
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.windGain) this.windGain.gain.setTargetAtTime(0.02 + night * 0.012, now, 0.4);
    if (this.padFilter) this.padFilter.frequency.setTargetAtTime(700 + night * 500, now, 0.6);
    if (this.padGain) this.padGain.gain.setTargetAtTime(0.015 + night * 0.007, now, 0.5);
  }

  noiseBurst({ duration = 0.1, frequency = 700, gain = 0.07, q = 0.8, type = 'bandpass' } = {}) {
    if (!this.started || !this.enabled || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  tone({ frequency = 220, endFrequency = 80, duration = 0.18, gain = 0.05, type = 'sine' } = {}) {
    if (!this.started || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  breakBlock(type) {
    const woody = type === 'wood' || type === 'planks' || type === 'leaves';
    this.noiseBurst({ duration: 0.14, frequency: woody ? 420 : 900, gain: 0.06, q: 1.1 });
    this.tone({ frequency: woody ? 150 : 110, endFrequency: 55, duration: 0.12, gain: 0.045, type: 'triangle' });
  }

  placeBlock() {
    this.tone({ frequency: 190, endFrequency: 115, duration: 0.09, gain: 0.035, type: 'triangle' });
    this.noiseBurst({ duration: 0.055, frequency: 1200, gain: 0.025, q: 0.9 });
  }

  jump() {
    this.noiseBurst({ duration: 0.1, frequency: 500, gain: 0.018, q: 0.4, type: 'lowpass' });
  }

  chime() {
    if (!this.started || !this.enabled) return;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      const ctx = this.ctx;
      const now = ctx.currentTime + i * 0.12;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.025, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      osc.connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + 1.3);
    });
  }

  dispose() {
    clearTimeout(this.birdTimer);
    this.ctx?.close();
  }
}
