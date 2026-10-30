import * as THREE from '../vendor/three.module.js';

/* ─────────────────────────────────────────────────────────────────────
   Touch, mouse, keyboard and tilt input.
   ───────────────────────────────────────────────────────────────────── */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

export class TiltLook {
  constructor(onStatus) {
    this.onStatus = onStatus || (() => {});
    this.enabled = false;
    this.status = 'off';
    this.supported = typeof window !== 'undefined' && typeof window.DeviceOrientationEvent !== 'undefined';
    this.needsPermission = this.supported && typeof window.DeviceOrientationEvent.requestPermission === 'function';
    this.zeroBeta = null;
    this.zeroGamma = null;
    this.beta = 0;
    this.gamma = 0;
    this.smoothYaw = 0;
    this.smoothPitch = 0;
    this.calibrating = false;
    this.calSamples = [];
    this.orientationAngle = 0;
    this.lastEvent = 0;
    this._onOrient = this.handleOrientation.bind(this);
    this._onOrientationChange = () => {
      this.orientationAngle = this.currentScreenAngle();
      this.recenter();
    };
  }

  currentScreenAngle() {
    if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
    if (typeof window.orientation === 'number') return window.orientation;
    return 0;
  }

  async enable() {
    if (this.enabled) return true;
    if (!this.supported) {
      this.status = 'unsupported';
      this.onStatus(this.status);
      return false;
    }
    try {
      if (this.needsPermission) {
        const result = await window.DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') {
          this.status = 'denied';
          this.onStatus(this.status);
          return false;
        }
      }
    } catch (err) {
      this.status = 'denied';
      this.onStatus(this.status);
      return false;
    }
    this.orientationAngle = this.currentScreenAngle();
    this.calibrating = true;
    this.calSamples = [];
    this.zeroBeta = null;
    this.zeroGamma = null;
    this.beta = 0;
    this.gamma = 0;
    this.smoothYaw = 0;
    this.smoothPitch = 0;
    window.addEventListener('deviceorientation', this._onOrient, true);
    window.addEventListener('orientationchange', this._onOrientationChange, true);
    if (screen.orientation?.addEventListener) screen.orientation.addEventListener('change', this._onOrientationChange);
    this.enabled = true;
    this.status = 'on';
    this.onStatus(this.status);
    return true;
  }

  disable() {
    if (!this.enabled) return;
    window.removeEventListener('deviceorientation', this._onOrient, true);
    window.removeEventListener('orientationchange', this._onOrientationChange, true);
    if (screen.orientation?.removeEventListener) screen.orientation.removeEventListener('change', this._onOrientationChange);
    this.enabled = false;
    this.status = 'off';
    this.onStatus(this.status);
  }

  recenter() {
    this.calibrating = true;
    this.calSamples = [];
    this.zeroBeta = null;
    this.zeroGamma = null;
    this.smoothYaw = 0;
    this.smoothPitch = 0;
    this.onStatus(this.enabled ? 'recentered' : this.status);
  }

  handleOrientation(event) {
    if (event.beta == null || event.gamma == null) return;
    this.beta = event.beta;
    this.gamma = event.gamma;
    this.lastEvent = performance.now();

    if (this.calibrating || this.zeroBeta == null) {
      this.calSamples.push([this.beta, this.gamma]);
      if (this.calSamples.length >= 6) {
        let b = 0, g = 0;
        for (const s of this.calSamples) { b += s[0]; g += s[1]; }
        this.zeroBeta = b / this.calSamples.length;
        this.zeroGamma = g / this.calSamples.length;
        this.calibrating = false;
        this.calSamples = [];
      }
    }
  }

  update(dt) {
    if (!this.enabled || this.zeroBeta == null) {
      this.smoothYaw = damp(this.smoothYaw, 0, 8, dt);
      this.smoothPitch = damp(this.smoothPitch, 0, 8, dt);
      return { yawRate: 0, pitchRate: 0, active: this.enabled };
    }
    const landscape = Math.abs(this.orientationAngle) === 90 || Math.abs(this.orientationAngle) === 270;
    let dx = this.gamma - this.zeroGamma;
    let dy = this.beta - this.zeroBeta;
    if (landscape) {
      const t = dx;
      dx = dy;
      dy = t;
    }
    const dead = 2.6;
    const sx = Math.abs(dx) < dead ? 0 : (dx - Math.sign(dx) * dead);
    const sy = Math.abs(dy) < dead ? 0 : (dy - Math.sign(dy) * dead);
    const targetYaw = -clamp(sx * 0.034, -1.05, 1.05);
    const targetPitch = -clamp(sy * 0.027, -0.8, 0.8);
    this.smoothYaw = damp(this.smoothYaw, targetYaw, 7, dt);
    this.smoothPitch = damp(this.smoothPitch, targetPitch, 7, dt);
    return { yawRate: this.smoothYaw, pitchRate: this.smoothPitch, active: true };
  }
}

export class Controls {
  constructor({ canvas, joystickEl, joystickKnob, onTap, onMenu, onSelectSlot, onWheelSlot }) {
    this.canvas = canvas;
    this.joystickEl = joystickEl;
    this.joystickKnob = joystickKnob;
    this.onTap = onTap || (() => {});
    this.onMenu = onMenu || (() => {});
    this.onSelectSlot = onSelectSlot || (() => {});
    this.onWheelSlot = onWheelSlot || (() => {});

    this.yaw = 0;
    this.pitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.move = { x: 0, y: 0 };
    this.joystick = { x: 0, y: 0, active: false };
    this.keys = new Set();
    this.jumpQueued = false;
    this.sprint = false;
    this.enabled = false;
    this.lookSensitivity = 0.0043;

    this.lookPointer = null;
    this.lookStart = { x: 0, y: 0, time: 0 };
    this.lookMoved = 0;
    this.joystickPointer = null;
    this.joystickCenter = { x: 0, y: 0 };
    this.joystickRadius = 42;

    this.tilt = new TiltLook(() => {});
    this.bind();
  }

  setTiltStatusHandler(fn) {
    this.tilt.onStatus = fn;
  }

  async setTilt(on) {
    if (on) return this.tilt.enable();
    this.tilt.disable();
    return false;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this.keys.clear();
      this.move.x = 0;
      this.move.y = 0;
      this.joystick.x = 0;
      this.joystick.y = 0;
      this.joystick.active = false;
      this.lookPointer = null;
      this.resetKnob();
    }
  }

  setYaw(yaw, pitch = 0) {
    this.yaw = yaw;
    this.pitch = pitch;
    this.targetYaw = yaw;
    this.targetPitch = pitch;
  }

  bind() {
    const canvas = this.canvas;

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.button === 2) {
        e.preventDefault();
        this.onTap(null, 'place');
        return;
      }
      if (e.button !== 0) return;
      if (this.lookPointer !== null) return;
      this.lookPointer = e.pointerId;
      this.lookStart = { x: e.clientX, y: e.clientY, time: performance.now() };
      this.lookMoved = 0;
      canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.enabled) return;
      if (e.pointerId !== this.lookPointer) return;
      const dx = e.clientX - this.lookStart.x;
      const dy = e.clientY - this.lookStart.y;
      this.lookMoved = Math.max(this.lookMoved, Math.hypot(dx, dy));
      this.targetYaw += dx * this.lookSensitivity;
      this.targetPitch = clamp(this.targetPitch - dy * this.lookSensitivity, -1.38, 1.38);
      this.lookStart.x = e.clientX;
      this.lookStart.y = e.clientY;
    });

    const endLook = (e) => {
      if (e.pointerId !== this.lookPointer) return;
      const wasTap = this.lookMoved < 9 && performance.now() - this.lookStart.time < 360;
      this.lookPointer = null;
      if (wasTap && this.enabled) this.onTap(null, 'mine');
    };
    canvas.addEventListener('pointerup', endLook);
    canvas.addEventListener('pointercancel', (e) => {
      if (e.pointerId === this.lookPointer) this.lookPointer = null;
    });

    // ── joystick ────────────────────────────────────────────────────────
    const joyDown = (e) => {
      if (!this.enabled) return;
      if (this.joystickPointer !== null) return;
      e.preventDefault();
      e.stopPropagation();
      this.joystickPointer = e.pointerId;
      const rect = this.joystickEl.getBoundingClientRect();
      this.joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this.joystickRadius = rect.width * 0.35;
      this.joystickEl.classList.add('is-active');
      this.joystickEl.setPointerCapture?.(e.pointerId);
      this.updateJoystick(e.clientX, e.clientY);
    };
    const joyMove = (e) => {
      if (e.pointerId !== this.joystickPointer) return;
      e.preventDefault();
      this.updateJoystick(e.clientX, e.clientY);
    };
    const joyUp = (e) => {
      if (e.pointerId !== this.joystickPointer) return;
      this.joystickPointer = null;
      this.joystick = { x: 0, y: 0, active: false };
      this.joystickEl.classList.remove('is-active');
      this.resetKnob();
      this.updateMove();
    };
    this.joystickEl.addEventListener('pointerdown', joyDown);
    this.joystickEl.addEventListener('pointermove', joyMove);
    this.joystickEl.addEventListener('pointerup', joyUp);
    this.joystickEl.addEventListener('pointercancel', joyUp);

    // ── keyboard ────────────────────────────────────────────────────────
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        this.onMenu();
        return;
      }
      if (!this.enabled) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'Space') this.jumpQueued = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprint = true;
      if (e.code === 'KeyT') this.onSelectSlot(-2);
      if (/^Digit[1-7]$/.test(e.code)) this.onSelectSlot(Number(e.code.slice(5)) - 1);
      this.updateMove();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprint = false;
      this.updateMove();
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.sprint = false;
      this.updateMove();
    });

    canvas.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.onWheelSlot(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
  }

  updateJoystick(clientX, clientY) {
    const dx = clientX - this.joystickCenter.x;
    const dy = clientY - this.joystickCenter.y;
    const len = Math.hypot(dx, dy);
    const max = this.joystickRadius;
    const scale = len > max ? max / len : 1;
    const kx = dx * scale;
    const ky = dy * scale;
    this.joystickKnob.style.transform = `translate(${kx}px, ${ky}px)`;
    const nx = kx / max;
    const ny = -ky / max;
    const dead = 0.12;
    const mag = Math.hypot(nx, ny);
    if (mag < dead) {
      this.joystick = { x: 0, y: 0, active: false };
    } else {
      const scaled = (mag - dead) / (1 - dead);
      const angle = Math.atan2(ny, nx);
      this.joystick = {
        x: Math.cos(angle) * scaled,
        y: Math.sin(angle) * scaled,
        active: true,
      };
    }
    this.updateMove();
  }

  resetKnob() {
    this.joystickKnob.style.transform = 'translate(0px, 0px)';
  }

  updateMove() {
    let x = this.joystick.x;
    let y = this.joystick.y;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    const mag = Math.hypot(x, y);
    if (mag > 1) { x /= mag; y /= mag; }
    this.move.x = x;
    this.move.y = y;
  }

  consumeJump() {
    if (!this.jumpQueued) return false;
    this.jumpQueued = false;
    return true;
  }

  update(dt) {
    if (this.enabled && this.tilt.enabled) {
      const t = this.tilt.update(dt);
      this.targetYaw += t.yawRate * dt;
      this.targetPitch = clamp(this.targetPitch + t.pitchRate * dt, -1.38, 1.38);
    }
    const k = 1 - Math.exp(-24 * dt);
    this.yaw += (this.targetYaw - this.yaw) * k;
    this.pitch += (this.targetPitch - this.pitch) * k;
  }
}

export { clamp, damp };
