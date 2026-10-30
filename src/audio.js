export class Soundscape {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.windGain = null;
    this.windFilter = null;
    this.enabled = true;
    this.night = 0;
    this.ambientTimer = null;
    this.started = false;
    this.lastStep = 0;
  }

  async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.22 : 0;
    this.master.connect(this.ctx.destination);
    this.startWind();
    this.scheduleAmbient();
    this.started = true;
  }

  makeNoiseBuffer(seconds = 2, brown = false) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.floor(rate * seconds), rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      } else {
        data[i] = white;
      }
    }
    return buffer;
  }

  startWind() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(4, true);
    src.loop = true;
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 420;
    this.windFilter.Q.value = 0.8;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0;
    src.connect(this.windFilter).connect(this.windGain).connect(this.master);
    src.start();
    this.windGain.gain.linearRampToValueAtTime(0.09, this.ctx.currentTime + 2.5);
  }

  scheduleAmbient() {
    if (this.ambientTimer) clearTimeout(this.ambientTimer);
    const delay = 2200 + Math.random() * 5200;
    this.ambientTimer = setTimeout(() => {
      if (this.ctx && this.enabled) {
        if (this.night > 0.52) this.cricket();
        else this.bird();
      }
      this.scheduleAmbient();
    }, delay);
  }

  bird() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500 + Math.random() * 500, t);
    osc.frequency.exponentialRampToValueAtTime(2400 + Math.random() * 600, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(1300 + Math.random() * 300, t + 0.16);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.026, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.22);
    if (Math.random() > 0.5) {
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      const t2 = t + 0.24;
      osc2.frequency.setValueAtTime(1900, t2);
      osc2.frequency.exponentialRampToValueAtTime(2600, t2 + 0.05);
      osc2.frequency.exponentialRampToValueAtTime(1500, t2 + 0.14);
      gain2.gain.setValueAtTime(0.0001, t2);
      gain2.gain.exponentialRampToValueAtTime(0.02, t2 + 0.015);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.16);
      osc2.connect(gain2).connect(this.master);
      osc2.start(t2);
      osc2.stop(t2 + 0.18);
    }
  }

  cricket() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const start = t + i * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 3900 + Math.random() * 300;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.012, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.045);
      osc.connect(gain).connect(this.master);
      osc.start(start);
      osc.stop(start + 0.055);
    }
  }

  footstep(running = false) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStep < 0.12) return;
    this.lastStep = now;
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(0.18, false);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 240 + Math.random() * 120;
    filter.Q.value = 0.9;
    const gain = this.ctx.createGain();
    const vol = running ? 0.045 : 0.032;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(now);
    src.stop(now + 0.16);
  }

  land() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(0.25, true);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(now);
    src.stop(now + 0.24);
  }

  jump() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.018, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  chime(index = 0) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    const base = notes[index % notes.length];
    [1, 1.5, 2].forEach((mult, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = base * mult;
      const t = now + i * 0.045;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.05 / (i + 1), t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.75);
    });
  }

  click() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.05);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.025, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  setNight(night) {
    this.night = night;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.windFilter) this.windFilter.frequency.setTargetAtTime(300 + (1 - night) * 260, t, 1.5);
    if (this.windGain) this.windGain.gain.setTargetAtTime(0.055 + (1 - night) * 0.035, t, 2);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.enabled ? 0.22 : 0, this.ctx.currentTime, 0.12);
    }
    return this.enabled;
  }

  get isEnabled() { return this.enabled; }
}
