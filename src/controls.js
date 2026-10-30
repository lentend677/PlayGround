import * as THREE from '../vendor/three.module.min.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoothstep = (t) => t * t * (3 - 2 * t);

export class Controls {
  constructor({ canvas, joystick, knob, jumpBtn, runBtn, tiltBtn, tiltState, onTiltChange, onToast, onInteract }) {
    this.canvas = canvas;
    this.joystickEl = joystick;
    this.knob = knob;
    this.jumpBtn = jumpBtn;
    this.runBtn = runBtn;
    this.tiltBtn = tiltBtn;
    this.tiltState = tiltState;
    this.onTiltChange = onTiltChange;
    this.onToast = onToast;
    this.onInteract = onInteract;

    this.move = { x: 0, y: 0 };
    this.jumpQueued = false;
    this.runToggle = false;
    this.keys = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.zoomDelta = 0;
    this.pointers = new Map();
    this.dragPointer = null;
    this.pinchStart = null;
    this.joyPointer = null;
    this.joyRadius = 48;
    this.joyCenter = { x: 0, y: 0 };
    this.tiltEnabled = false;
    this.tiltReady = false;
    this.tiltBusy = false;
    this.tiltRaw = { yaw: 0, pitch: 0 };
    this.tiltSmooth = { yaw: 0, pitch: 0 };
    this.tiltBaseline = null;
    this.motionHandler = null;
    this.lastInteract = 0;

    this.bindJoystick();
    this.bindLook();
    this.bindButtons();
    this.bindKeyboard();
    this.bindTilt();
  }

  interact() {
    const now = performance.now();
    if (now - this.lastInteract > 500) {
      this.lastInteract = now;
      if (this.onInteract) this.onInteract();
    }
  }

  bindJoystick() {
    const setKnob = (dx, dy) => {
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };
    const update = (e) => {
      const dx = e.clientX - this.joyCenter.x;
      const dy = e.clientY - this.joyCenter.y;
      const len = Math.hypot(dx, dy);
      const radius = this.joyRadius;
      const scale = len > radius ? radius / len : 1;
      const kx = dx * scale;
      const ky = dy * scale;
      setKnob(kx, ky);
      this.move.x = clamp(kx / radius, -1, 1);
      this.move.y = clamp(-ky / radius, -1, 1);
    };
    const end = (e) => {
      if (this.joyPointer !== e.pointerId) return;
      this.joyPointer = null;
      this.move.x = 0;
      this.move.y = 0;
      setKnob(0, 0);
      this.joystickEl.classList.remove('active');
      try { this.joystickEl.releasePointerCapture(e.pointerId); } catch {}
    };
    this.joystickEl.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this.interact();
      const r = this.joystickEl.getBoundingClientRect();
      this.joyCenter.x = r.left + r.width / 2;
      this.joyCenter.y = r.top + r.height / 2;
      this.joyRadius = r.width * 0.34;
      this.joyPointer = e.pointerId;
      this.joystickEl.classList.add('active');
      try { this.joystickEl.setPointerCapture(e.pointerId); } catch {}
      update(e);
    });
    this.joystickEl.addEventListener('pointermove', (e) => {
      if (this.joyPointer !== e.pointerId) return;
      e.preventDefault();
      update(e);
    });
    this.joystickEl.addEventListener('pointerup', end);
    this.joystickEl.addEventListener('pointercancel', end);
    this.joystickEl.addEventListener('lostpointercapture', end);
  }

  bindLook() {
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.interact();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { this.canvas.setPointerCapture(e.pointerId); } catch {}
      if (this.pointers.size === 1) {
        this.dragPointer = e.pointerId;
        this.dragLast = { x: e.clientX, y: e.clientY };
        this.canvas.classList.add('dragging');
      } else if (this.pointers.size === 2) {
        const pts = [...this.pointers.values()];
        this.pinchStart = {
          distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          active: true,
        };
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const prev = this.pointers.get(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size >= 2) {
        const pts = [...this.pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (this.pinchStart) {
          const diff = dist - this.pinchStart.distance;
          if (Math.abs(diff) > 1) this.zoomDelta += diff * 0.012;
          this.pinchStart.distance = dist;
        }
        return;
      }
      if (this.dragPointer !== e.pointerId) return;
      const dx = e.clientX - this.dragLast.x;
      const dy = e.clientY - this.dragLast.y;
      this.dragLast = { x: e.clientX, y: e.clientY };
      this.lookDX += dx;
      this.lookDY += dy;
    });

    const release = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      try { this.canvas.releasePointerCapture(e.pointerId); } catch {}
      if (this.pointers.size === 0) {
        this.dragPointer = null;
        this.pinchStart = null;
        this.canvas.classList.remove('dragging');
      } else if (this.pointers.size === 1) {
        const id = [...this.pointers.keys()][0];
        const p = this.pointers.get(id);
        this.dragPointer = id;
        this.dragLast = { x: p.x, y: p.y };
        this.pinchStart = null;
      }
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
    this.canvas.addEventListener('lostpointercapture', release);

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomDelta += e.deltaY * 0.004;
    }, { passive: false });

    // right-click drag for desktop users who expect it
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  bindButtons() {
    const pressJump = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.interact();
      this.jumpQueued = true;
      this.jumpBtn.classList.add('pressed');
      setTimeout(() => this.jumpBtn.classList.remove('pressed'), 130);
    };
    this.jumpBtn.addEventListener('pointerdown', pressJump);
    this.jumpBtn.addEventListener('click', (e) => { e.preventDefault(); });

    this.runBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.interact();
      this.runToggle = !this.runToggle;
      this.runBtn.classList.toggle('active', this.runToggle);
    });
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const key = e.code;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'].includes(key)) {
        e.preventDefault();
      }
      this.keys.add(key);
      if (key === 'Space' && !e.repeat) {
        this.jumpQueued = true;
        this.jumpBtn.classList.add('pressed');
        setTimeout(() => this.jumpBtn.classList.remove('pressed'), 130);
      }
      if (key === 'ShiftLeft' || key === 'ShiftRight' || key === 'KeyR') this.interact();
      if (key === 'KeyR' && !e.repeat) {
        this.runToggle = !this.runToggle;
        this.runBtn.classList.toggle('active', this.runToggle);
      }
      if (key === 'KeyH' && !e.repeat && this.onHelp) this.onHelp();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
  }

  async toggleTilt() {
    if (this.tiltBusy) return;
    if (this.tiltEnabled) {
      this.disableTilt();
      return;
    }
    this.tiltBusy = true;
    try {
      if (!('DeviceOrientationEvent' in window)) {
        this.onToast('This device has no motion sensor available.', '');
        this.tiltBusy = false;
        return;
      }
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        let permission;
        try {
          permission = await DeviceOrientationEvent.requestPermission();
        } catch (err) {
          this.onToast('Motion access was blocked. Enable it in Settings → Safari.', '');
          this.tiltBusy = false;
          return;
        }
        if (permission !== 'granted') {
          this.onToast('Motion access wasn’t granted. Tilt stays off.', '');
          this.tiltBusy = false;
          return;
        }
      }
      this.enableTilt();
    } finally {
      this.tiltBusy = false;
    }
  }

  bindTilt() {
    this.tiltBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.interact();
      this.toggleTilt();
    });
  }

  enableTilt() {
    if (!this.motionHandler) {
      this.motionHandler = (e) => {
        if (!this.tiltEnabled) return;
        const beta = e.beta ?? 0;
        const gamma = e.gamma ?? 0;
        if (this.tiltBaseline === null) this.tiltBaseline = { beta, gamma };
        let yawDeg;
        let pitchDeg;
        const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
        if (Math.abs(angle) === 90) {
          yawDeg = beta - this.tiltBaseline.beta;
          pitchDeg = gamma - this.tiltBaseline.gamma;
          if (angle === 90) yawDeg = -yawDeg;
        } else {
          yawDeg = gamma - this.tiltBaseline.gamma;
          pitchDeg = beta - this.tiltBaseline.beta;
        }
        this.tiltRaw.yaw = clamp(-yawDeg * 0.014, -0.46, 0.46);
        this.tiltRaw.pitch = clamp(pitchDeg * 0.009, -0.24, 0.28);
      };
      window.addEventListener('deviceorientation', this.motionHandler, true);
    }
    this.tiltEnabled = true;
    this.tiltReady = false;
    this.tiltBaseline = null;
    this.tiltSmooth.yaw = 0;
    this.tiltSmooth.pitch = 0;
    this.tiltState.textContent = 'ON';
    this.tiltBtn.classList.add('active');
    this.onTiltChange?.(true);
    this.onToast('Tilt look is on. Lean your device gently.', 'gold');
    setTimeout(() => {
      if (!this.tiltEnabled) return;
      this.tiltReady = true;
    }, 500);
  }

  disableTilt() {
    this.tiltEnabled = false;
    this.tiltSmooth.yaw = 0;
    this.tiltSmooth.pitch = 0;
    this.tiltState.textContent = 'OFF';
    this.tiltBtn.classList.remove('active');
    this.onTiltChange?.(false);
    this.onToast('Tilt look is off.', '');
  }

  update(dt) {
    const keyboardX = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const keyboardY = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    let x = this.move.x + keyboardX;
    let y = this.move.y + keyboardY;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const run = this.runToggle || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const jump = this.jumpQueued;
    this.jumpQueued = false;

    const t = 1 - Math.exp(-dt * 10);
    this.tiltSmooth.yaw += (this.tiltRaw.yaw - this.tiltSmooth.yaw) * t;
    this.tiltSmooth.pitch += (this.tiltRaw.pitch - this.tiltSmooth.pitch) * t;

    return { x, y, run, jump, tilt: this.tiltEnabled ? this.tiltSmooth : null };
  }

  consumeLook() {
    const look = { x: this.lookDX, y: this.lookDY };
    this.lookDX = 0;
    this.lookDY = 0;
    return look;
  }

  consumeZoom() {
    const z = this.zoomDelta;
    this.zoomDelta = 0;
    return z;
  }
}
