/* Tiny WebAudio synth — no external assets. */
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.muted = localStorage.getItem('mr.muted') === '1';
    this.musicOn = false;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.noise = null;
    this.stepDur = 60 / 112 / 4;
    this.tempo = 112;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.42;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.3;
    this.musicGain.connect(this.master);
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('mr.muted', muted ? '1' : '0');
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 1, this.ctx.currentTime + 0.12);
    }
  }

  makeNoise() {
    if (this.noise) return this.noise;
    const len = this.ctx.sampleRate * 0.7;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return buf;
  }

  tone(freq, when, dur, type = 'triangle', gain = 0.3, slideTo = null, dest = null) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    g.connect(dest || this.sfxGain);
    o.start(when);
    o.stop(when + dur + 0.02);
  }

  noiseHit(when, dur, freq, gain = 0.2, q = 1) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoise();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(when);
    src.stop(when + dur);
  }

  play(name, data = {}) {
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    switch (name) {
      case 'click':
        this.tone(520, t, 0.07, 'square', 0.16, 700);
        break;
      case 'coin': {
        const base = 760 + Math.min(12, data.combo || 0) * 42;
        this.tone(base, t, 0.08, 'triangle', 0.26);
        this.tone(base * 1.5, t + 0.055, 0.11, 'triangle', 0.2);
        break;
      }
      case 'jump':
        this.tone(300, t, 0.17, 'sine', 0.3, 640);
        this.noiseHit(t, 0.09, 1400, 0.06, 1.4);
        break;
      case 'land':
        this.tone(150, t, 0.1, 'sine', 0.24, 70);
        break;
      case 'roll':
        this.noiseHit(t, 0.22, 700, 0.18, 0.7);
        break;
      case 'lane':
        this.noiseHit(t, 0.12, 1100, 0.09, 1.1);
        this.tone(360, t, 0.09, 'sine', 0.07, 460);
        break;
      case 'power':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.07, 0.16, 'triangle', 0.2));
        break;
      case 'shield':
        this.tone(220, t, 0.3, 'sine', 0.18, 880);
        this.noiseHit(t + 0.04, 0.25, 2200, 0.08, 2);
        break;
      case 'crash':
        this.noiseHit(t, 0.55, 420, 0.34, 0.6);
        this.tone(190, t, 0.55, 'sawtooth', 0.26, 38);
        this.tone(90, t + 0.05, 0.5, 'square', 0.18, 30);
        break;
      case 'gameover':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, t + i * 0.13, 0.26, 'triangle', 0.16));
        break;
      default:
        break;
    }
  }

  startMusic() {
    this.ensure();
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.musicGain.gain.exponentialRampToValueAtTime(0.3, this.ctx.currentTime + 0.6);
    this.timer = setInterval(() => this.scheduleMusic(), 70);
  }

  stopMusic(fade = true) {
    this.musicOn = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx && this.musicGain && fade) {
      const t = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(t);
      this.musicGain.gain.setValueAtTime(Math.max(0.0001, this.musicGain.gain.value), t);
      this.musicGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    }
  }

  scheduleMusic() {
    if (!this.ctx || !this.musicOn) return;
    while (this.nextTime < this.ctx.currentTime + 0.28) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += this.stepDur;
      this.step = (this.step + 1) % 32;
    }
  }

  playStep(step, when) {
    const bassRoots = [130.81, 98.0, 110.0, 87.31]; // C2 G2 A2 F2
    const chord = bassRoots[Math.floor(step / 8)];
    const inBar = step % 8;
    const dest = this.musicGain;

    // bouncy bass
    if (inBar % 2 === 0) {
      this.tone(chord * (inBar === 4 ? 1.5 : 1), when, 0.15, 'triangle', 0.34, null, dest);
    }
    // offbeat chord pluck
    if (inBar % 2 === 1) {
      const notes = [chord * 2, chord * 2.5, chord * 3];
      notes.forEach((f, i) => this.tone(f, when + i * 0.005, 0.09, 'square', 0.05, null, dest));
    }
    // lead melody
    const lead = [0, 4, 7, 12, 7, 4, 0, 9];
    const note = lead[step % 8];
    const octave = step < 16 ? 4 : 4;
    if (note !== 0 && (step % 2 === 0 || step % 8 === 6)) {
      const freq = 261.63 * Math.pow(2, note / 12) * Math.pow(2, octave - 4);
      this.tone(freq, when, 0.13, 'triangle', 0.12, null, dest);
    }
    // kick
    if (inBar === 0 || inBar === 5) {
      this.tone(110, when, 0.13, 'sine', 0.3, 42, dest);
    }
    // hat
    if (step % 2 === 1) {
      this.noiseHit(when, 0.03, 7000, 0.03, 2);
    }
  }
}
