import * as THREE from 'three';
import { VoxelWorld } from './world.js';
import { SkySystem } from './sky.js';
import { PlayerController } from './player.js';
import { AudioEngine } from './audio.js';
import { clamp, damp, formatClock, lerp, phaseName, smoothstep } from './util.js';

const CYCLE_SECONDS = 200;
const SPEEDS = [1, 6, 24];
const PALETTE = ['grass', 'planks', 'stone', 'sand'];

const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');
const errorScreen = document.getElementById('errorScreen');
const errorText = document.getElementById('errorText');
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const hud = document.getElementById('hud');
const toast = document.getElementById('toast');
const clockEl = document.getElementById('clock');
const dayCountEl = document.getElementById('dayCount');
const phaseEl = document.getElementById('phase');
const cycleFill = document.getElementById('cycleFill');
const cycleDot = document.getElementById('cycleDot');
const cycleBtn = document.getElementById('cycleBtn');
const speedBtn = document.getElementById('speedBtn');
const orb = document.getElementById('orb');
const tiltBtn = document.getElementById('tiltBtn');
const soundBtn = document.getElementById('soundBtn');
const fullBtn = document.getElementById('fullBtn');
const joystick = document.getElementById('joystick');
const stickKnob = document.getElementById('stickKnob');
const breakBtn = document.getElementById('breakBtn');
const placeBtn = document.getElementById('placeBtn');
const jumpBtn = document.getElementById('jumpBtn');
const hotbar = document.getElementById('hotbar');
const reticle = document.getElementById('reticle');
const targetPill = document.getElementById('targetPill');

let started = false;
let timeOfDay = 0.27;
let dayNumber = 1;
let cyclePaused = false;
let speedIndex = 0;
let soundOn = true;
let selectedType = 'grass';
let elapsed = 0;
let introT = 0;
let introStart = 0;
let shake = 0;
let currentTarget = null;
let toastTimer = 0;
let hintTimer = 0;
let lastTime = timeOfDay;

const input = {
  moveX: 0,
  moveY: 0,
  jump: false,
  sprint: false,
};

const keys = new Set();
const joystickState = { active: false, pointerId: null, x: 0, y: 0, radius: 38 };
const lookState = { active: false, pointerId: null, lastX: 0, lastY: 0, startX: 0, startY: 0, moved: 0, startTime: 0 };

let tiltEnabled = false;
let tiltCalibrated = false;
let tiltNeutralBeta = 0;
let tiltNeutralGamma = 0;
let tiltTargetX = 0;
let tiltTargetY = 0;
let tiltX = 0;
let tiltY = 0;
let tiltCheckTimer = 0;
let tiltEventCount = 0;

const audio = new AudioEngine();

function isTouchDevice() {
  return navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
}

function updateTouchMode() {
  const touch = isTouchDevice() || window.innerWidth <= 860;
  document.body.classList.toggle('touch-mode', touch);
}

function showToast(message, duration = 2400) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), duration);
}

function showError(error) {
  console.error(error);
  loading?.classList.add('is-done');
  errorScreen.hidden = false;
  errorText.textContent = error?.message
    ? `The island could not be built: ${error.message}`
    : 'This browser could not start WebGL. Try a newer browser with hardware acceleration enabled.';
}

function setupScene() {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouchDevice() ? 1.8 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#102c2c');
  const camera = new THREE.PerspectiveCamera(51, window.innerWidth / window.innerHeight, 0.1, 520);
  camera.position.set(15, 10, 15);

  const sky = new SkySystem(scene, renderer, { mobile: isTouchDevice() || window.innerWidth <= 860 });
  const world = new VoxelWorld(scene, { mobile: isTouchDevice() || window.innerWidth <= 860 });
  const player = new PlayerController(scene, world);

  const selection = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.035, 1.035, 1.035)),
    new THREE.LineBasicMaterial({
      color: '#ffd875',
      transparent: true,
      opacity: 0.88,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  selection.visible = false;
  selection.renderOrder = 4;
  scene.add(selection);

  const raycaster = new THREE.Raycaster();
  raycaster.far = 42;
  const screenCenter = new THREE.Vector2(0, 0);
  const targetOrigin = new THREE.Vector3();

  const rig = {
    yaw: 0.02,
    pitch: 0.35,
    dist: 8.4,
    targetDist: 8.4,
    lookTarget: new THREE.Vector3(0, 3.4, 0),
  };
  let transitionFromPos = new THREE.Vector3(15, 10, 15);
  let transitionFromTarget = new THREE.Vector3(0, 3.4, 0);

  const state = {
    renderer,
    scene,
    camera,
    sky,
    world,
    player,
    rig,
    selection,
    raycaster,
  };

  function selectType(type) {
    if (!PALETTE.includes(type)) return;
    selectedType = type;
    hotbar.querySelectorAll('.swatch').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.type === type);
    });
    const labels = { grass: 'Grass block', planks: 'Oak planks', stone: 'Stone', sand: 'Sand' };
    showToast(`${labels[type]} selected`);
  }

  function tryBreak() {
    if (!started || !currentTarget) return;
    const { x, y, z, type } = currentTarget;
    const removed = world.removeBlock(currentTarget.key);
    if (!removed) return;
    world.spawnDebris(x, y, z, removed);
    audio.breakBlock(removed);
    shake = Math.max(shake, 0.12);
    currentTarget = null;
    selection.visible = false;
    reticle.classList.remove('has-target');
    targetPill.classList.remove('show');
    breakBtn.disabled = true;
  }

  function tryPlace() {
    if (!started) return;
    const placement = world.findPlacement(currentTarget, {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      yaw: rig.yaw,
    });
    if (!placement) {
      showToast('No room to build here');
      return;
    }
    const { x, y, z } = placement;
    const nearX = Math.abs(x - player.position.x) < 0.8;
    const nearZ = Math.abs(z - player.position.z) < 0.8;
    const inBody = y >= Math.floor(player.position.y) - 1 && y <= player.position.y + 1.8;
    if (nearX && nearZ && inBody) {
      showToast('Step back a little');
      return;
    }
    const placed = world.addBlock(selectedType, x, y, z, { tint: new THREE.Color(1, 1, 1) });
    if (!placed) {
      showToast('No room to build here');
      return;
    }
    audio.placeBlock();
    shake = Math.max(shake, 0.035);
    showToast(`${selectedType === 'planks' ? 'Oak planks' : selectedType[0].toUpperCase() + selectedType.slice(1)} placed`, 1300);
  }

  function jump() {
    if (!started) return;
    input.jump = true;
    jumpBtn.classList.add('pressed');
    window.setTimeout(() => jumpBtn.classList.remove('pressed'), 120);
    audio.jump();
  }

  function updateTarget() {
    if (!started) {
      currentTarget = null;
      selection.visible = false;
      reticle.classList.remove('has-target');
      targetPill.classList.remove('show');
      breakBtn.disabled = true;
      return;
    }
    camera.updateMatrixWorld();
    raycaster.far = rig.dist + 7.4;
    raycaster.setFromCamera(screenCenter, camera);
    targetOrigin.set(player.position.x, player.position.y + 1.15, player.position.z);
    const hit = world.pick(raycaster, 6.4, targetOrigin);
    if (hit) {
      currentTarget = hit;
      selection.visible = true;
      selection.position.set(hit.x, hit.y, hit.z);
      reticle.classList.add('has-target');
      const label = world.getLabel(hit.type);
      targetPill.textContent = `${label} · ${hit.distance.toFixed(1)}m`;
      targetPill.classList.add('show');
      breakBtn.disabled = false;
    } else {
      currentTarget = null;
      selection.visible = false;
      reticle.classList.remove('has-target');
      targetPill.classList.remove('show');
      breakBtn.disabled = true;
    }
  }

  function updateTimeUI() {
    clockEl.textContent = formatClock(timeOfDay);
    dayCountEl.textContent = `Day ${dayNumber}`;
    const phase = phaseName(timeOfDay);
    if (phaseEl.textContent !== phase) phaseEl.textContent = phase;
    const percent = `${(timeOfDay * 100).toFixed(2)}%`;
    cycleFill.style.width = percent;
    cycleDot.style.left = percent;
    orb.classList.toggle('is-moon', sky.night > 0.48);
  }

  function startGame() {
    if (started) return;
    started = true;
    introT = 0;
    introStart = performance.now();
    transitionFromPos.copy(camera.position);
    transitionFromTarget.copy(rig.lookTarget);
    startScreen.classList.add('is-leaving');
    hud.classList.remove('is-hidden');
    if (soundOn) audio.start();
    window.setTimeout(() => {
      startScreen.setAttribute('aria-hidden', 'true');
      startScreen.style.display = 'none';
    }, 850);
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => {
      if (!started) return;
      if (isTouchDevice() || window.innerWidth <= 860) {
        showToast('Drag to look · follow the path to the cabin', 3600);
      } else {
        showToast('Drag to look · click to break · F to place', 3600);
      }
    }, 3600);
  }

  function toggleCycle() {
    cyclePaused = !cyclePaused;
    cycleBtn.classList.toggle('is-paused', cyclePaused);
    cycleBtn.setAttribute('aria-label', cyclePaused ? 'Resume day and night cycle' : 'Pause day and night cycle');
    cycleBtn.title = cyclePaused ? 'Resume cycle' : 'Pause cycle';
    showToast(cyclePaused ? 'Day and night paused' : 'Day and night flowing');
  }

  function cycleSpeed() {
    speedIndex = (speedIndex + 1) % SPEEDS.length;
    speedBtn.textContent = `${SPEEDS[speedIndex]}×`;
    showToast(`Time speed ${SPEEDS[speedIndex]}×`);
  }

  function toggleSound() {
    soundOn = !soundOn;
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Enable sound');
    audio.setEnabled(soundOn);
    if (soundOn) {
      audio.start();
      showToast('Sound on');
    } else {
      showToast('Sound off');
    }
  }

  async function toggleTilt() {
    if (tiltEnabled) {
      tiltEnabled = false;
      tiltBtn.classList.remove('is-on');
      tiltBtn.setAttribute('aria-pressed', 'false');
      tiltBtn.setAttribute('aria-label', 'Enable tilt steering');
      tiltTargetX = 0;
      tiltTargetY = 0;
      tiltX = 0;
      tiltY = 0;
      showToast('Tilt steering off');
      return;
    }
    if (!('DeviceOrientationEvent' in window)) {
      showToast('Tilt is not available on this device');
      return;
    }
    try {
      if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await window.DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          showToast('Motion access was not granted');
          return;
        }
      }
    } catch (error) {
      showToast('Motion access is unavailable here');
      return;
    }
    tiltEnabled = true;
    tiltCalibrated = false;
    tiltEventCount = 0;
    tiltBtn.classList.add('is-on');
    tiltBtn.setAttribute('aria-pressed', 'true');
    tiltBtn.setAttribute('aria-label', 'Disable tilt steering');
    showToast('Tilt steering on — hold your phone naturally', 3200);
    window.clearTimeout(tiltCheckTimer);
    tiltCheckTimer = window.setTimeout(() => {
      if (tiltEnabled && tiltEventCount === 0) {
        showToast('No motion data — tilt may not be supported', 3400);
      }
    }, 2600);
  }

  function onDeviceOrientation(event) {
    if (!tiltEnabled || event.beta == null || event.gamma == null) return;
    tiltEventCount++;
    if (!tiltCalibrated) {
      tiltNeutralBeta = event.beta;
      tiltNeutralGamma = event.gamma;
      tiltCalibrated = true;
      return;
    }
    let x = (event.gamma - tiltNeutralGamma) / 24;
    let y = (tiltNeutralBeta - event.beta) / 21;
    const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    if (angle === 90) {
      const nx = y;
      const ny = -x;
      x = nx;
      y = ny;
    } else if (angle === -90 || angle === 270) {
      const nx = -y;
      const ny = x;
      x = nx;
      y = ny;
    } else if (angle === 180) {
      x = -x;
      y = -y;
    }
    const dead = (v) => (Math.abs(v) < 0.11 ? 0 : (v - Math.sign(v) * 0.11) / 0.89);
    tiltTargetX = clamp(dead(x), -1, 1);
    tiltTargetY = clamp(dead(y), -1, 1);
  }

  function onFullscreen() {
    if (!document.fullscreenEnabled) {
      fullBtn.hidden = true;
      return;
    }
    fullBtn.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch {
        showToast('Fullscreen is not available');
      }
    });
  }

  function setupEvents() {
    startBtn.addEventListener('click', startGame);
    cycleBtn.addEventListener('click', toggleCycle);
    speedBtn.addEventListener('click', cycleSpeed);
    soundBtn.addEventListener('click', toggleSound);
    tiltBtn.addEventListener('click', toggleTilt);
    breakBtn.addEventListener('click', tryBreak);
    placeBtn.addEventListener('click', tryPlace);
    jumpBtn.addEventListener('click', jump);

    hotbar.addEventListener('click', (event) => {
      const button = event.target.closest('.swatch');
      if (button) selectType(button.dataset.type);
    });

    window.addEventListener('deviceorientation', onDeviceOrientation, true);

    window.addEventListener('keydown', (event) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (event.code === 'Space') jump();
      if (event.code === 'KeyF') tryPlace();
      if (event.code === 'KeyE') tryBreak();
      if (event.code === 'KeyR') player.respawn();
      if (event.code === 'KeyT') toggleTilt();
      if (event.code === 'Digit1') selectType('grass');
      if (event.code === 'Digit2') selectType('planks');
      if (event.code === 'Digit3') selectType('stone');
      if (event.code === 'Digit4') selectType('sand');
      keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => keys.delete(event.code));
    window.addEventListener('blur', () => keys.clear());

    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      lookState.active = true;
      lookState.pointerId = event.pointerId;
      lookState.lastX = event.clientX;
      lookState.lastY = event.clientY;
      lookState.startX = event.clientX;
      lookState.startY = event.clientY;
      lookState.moved = 0;
      lookState.startTime = performance.now();
      canvas.setPointerCapture?.(event.pointerId);
      canvas.classList.add('is-dragging');
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!lookState.active || event.pointerId !== lookState.pointerId) return;
      const dx = event.clientX - lookState.lastX;
      const dy = event.clientY - lookState.lastY;
      lookState.lastX = event.clientX;
      lookState.lastY = event.clientY;
      lookState.moved += Math.abs(dx) + Math.abs(dy);
      rig.yaw -= dx * 0.0052;
      rig.pitch = clamp(rig.pitch + dy * 0.0042, 0.07, 1.02);
    });
    const endLook = (event) => {
      if (!lookState.active || event.pointerId !== lookState.pointerId) return;
      lookState.active = false;
      canvas.classList.remove('is-dragging');
      const quick = performance.now() - lookState.startTime < 320;
      if (lookState.moved < 8 && quick) tryBreak();
    };
    canvas.addEventListener('pointerup', endLook);
    canvas.addEventListener('pointercancel', endLook);

    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      rig.targetDist = clamp(rig.targetDist + Math.sign(event.deltaY) * 0.75, 4.4, 11);
    }, { passive: false });

    joystick.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      joystickState.active = true;
      joystickState.pointerId = event.pointerId;
      joystick.setPointerCapture?.(event.pointerId);
      joystick.classList.add('active');
      updateJoystick(event);
    });
    joystick.addEventListener('pointermove', (event) => {
      if (!joystickState.active || event.pointerId !== joystickState.pointerId) return;
      event.preventDefault();
      updateJoystick(event);
    });
    const endJoystick = (event) => {
      if (!joystickState.active || event.pointerId !== joystickState.pointerId) return;
      joystickState.active = false;
      joystickState.x = 0;
      joystickState.y = 0;
      joystick.classList.remove('active');
      stickKnob.style.transform = 'translate(-50%, -50%)';
    };
    joystick.addEventListener('pointerup', endJoystick);
    joystick.addEventListener('pointercancel', endJoystick);
    joystick.addEventListener('lostpointercapture', endJoystick);

    window.addEventListener('resize', resize);
    onFullscreen();
    updateTouchMode();
  }

  function updateJoystick(event) {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const max = joystickState.radius;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    joystickState.x = dx / max;
    joystickState.y = -dy / max;
    stickKnob.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    rig.targetDist = height > width * 1.1 ? 10.2 : 8.4;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouchDevice() ? 1.8 : 2));
    renderer.setSize(width, height, false);
    updateTouchMode();
  }

  function cinematicCamera(time) {
    const angle = 0.62 + time * 0.024;
    const radius = 20.5;
    return {
      position: new THREE.Vector3(
        Math.cos(angle) * radius,
        9.4 + Math.sin(time * 0.26) * 0.45,
        Math.sin(angle) * radius,
      ),
      target: new THREE.Vector3(0, 3.35, 0),
    };
  }

  function updateCamera(dt) {
    if (!started) {
      const cine = cinematicCamera(elapsed);
      camera.position.copy(cine.position);
      rig.lookTarget.copy(cine.target);
      camera.lookAt(rig.lookTarget);
      camera.updateMatrixWorld();
      return;
    }

    rig.dist = damp(rig.dist, rig.targetDist, 8, dt);
    const focus = player.getFocus();
    // Frame the explorer slightly left of the reticle so the crosshair reads
    // the world past their shoulder instead of sitting on their back.
    const shoulder = camera.aspect < 0.85 ? 0.55 : 0.9;
    focus.x += Math.cos(rig.yaw) * shoulder;
    focus.z -= Math.sin(rig.yaw) * shoulder;
    const desired = new THREE.Vector3(
      focus.x + Math.sin(rig.yaw) * Math.cos(rig.pitch) * rig.dist,
      focus.y + Math.sin(rig.pitch) * rig.dist,
      focus.z + Math.cos(rig.yaw) * Math.cos(rig.pitch) * rig.dist,
    );
    const camGround = world.getWalkHeight(desired.x, desired.z);
    if (camGround !== null && desired.y < camGround + 0.78) desired.y = camGround + 0.78;

    if (introT < 1) {
      introT = Math.min(1, (performance.now() - introStart) / 900);
      const k = smoothstep(0, 1, introT);
      camera.position.lerpVectors(transitionFromPos, desired, k);
      rig.lookTarget.lerpVectors(transitionFromTarget, focus, k);
    } else {
      const posK = 1 - Math.exp(-12 * dt);
      const lookK = 1 - Math.exp(-16 * dt);
      camera.position.lerp(desired, posK);
      rig.lookTarget.lerp(focus, lookK);
    }

    if (shake > 0.001) {
      const s = shake;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s * 0.7;
      camera.position.z += (Math.random() - 0.5) * s;
      shake = damp(shake, 0, 10, dt);
    }

    camera.lookAt(rig.lookTarget);
    camera.updateMatrixWorld();
  }

  function update(dt) {
    elapsed += dt;
    if (started && !cyclePaused) {
      lastTime = timeOfDay;
      timeOfDay = (timeOfDay + (dt * SPEEDS[speedIndex]) / CYCLE_SECONDS) % 1;
      if (lastTime < 0.75 && timeOfDay >= 0.75) {
        dayNumber += 1;
        showToast(`Day ${dayNumber} — midnight passes`, 2600);
        audio.chime();
      }
    } else if (!started) {
      timeOfDay = (timeOfDay + dt / (CYCLE_SECONDS * 3)) % 1;
    }

    sky.time = timeOfDay;
    sky.update(dt, elapsed);
    world.update(dt, elapsed, sky.night);
    audio.update(sky.night);

    if (started) {
      tiltX = damp(tiltX, tiltTargetX, 5.5, dt);
      tiltY = damp(tiltY, tiltTargetY, 5.5, dt);
      const keyX = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      const keyY = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      let mx = joystickState.x + keyX + tiltX;
      let my = joystickState.y + keyY + tiltY;
      const mag = Math.hypot(mx, my);
      if (mag > 1) {
        mx /= mag;
        my /= mag;
      }
      input.moveX = mx;
      input.moveY = my;
      input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const result = player.update(dt, input, rig.yaw);
      if (result.respawned) showToast('The sky caught you — back to the path', 2600);
      input.jump = false;
    } else {
      player.update(dt, { moveX: 0, moveY: 0, jump: false, sprint: false }, rig.yaw);
    }

    updateCamera(dt);
    updateTarget();
    updateTimeUI();

    selection.material.opacity = 0.64 + Math.sin(elapsed * 5.2) * 0.24;
    reticle.style.transform = 'translate(-50%, -50%)';
    if (started && player.position.y < -10) {
      // Respawn is handled inside the controller; this guard keeps the camera
      // from chasing a falling avatar for an extra frame.
      shake = Math.max(shake, 0.05);
    }

    renderer.render(scene, camera);
  }

  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.0001, (now - lastFrame) / 1000));
    lastFrame = now;
    update(dt);
  }

  let lastFrame = performance.now();

  setupEvents();
  resize();
  renderer.render(scene, camera);
  requestAnimationFrame(() => {
    loading.classList.add('is-done');
    window.setTimeout(() => loading.remove(), 900);
  });
  requestAnimationFrame(loop);

  // Exposed for browser-based visual verification and debugging.
  window.__isle = {
    scene,
    camera,
    renderer,
    world,
    player,
    sky,
    rig,
    start: () => startGame(),
    setTime: (value) => {
      timeOfDay = ((value % 1) + 1) % 1;
      sky.time = timeOfDay;
      sky.update(0, elapsed);
      updateTimeUI();
    },
    getState: () => ({
      started,
      timeOfDay,
      dayNumber,
      night: sky.night,
      player: player.position.toArray(),
      target: currentTarget ? { ...currentTarget } : null,
      blocks: world.blockMap.size,
    }),
    breakBlock: tryBreak,
    placeBlock: tryPlace,
  };

  return state;
}

try {
  setupScene();
} catch (error) {
  showError(error);
}
