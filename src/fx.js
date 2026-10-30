import * as THREE from 'three'
import { clamp } from './utils.js'

const MAX_PARTICLES = 260
const MAX_TRACERS = 36

export class Effects {
  constructor(scene, camera, ui) {
    this.scene = scene
    this.camera = camera
    this.ui = ui

    const positions = new Float32Array(MAX_PARTICLES * 3)
    const colors = new Float32Array(MAX_PARTICLES * 3)
    const sizes = new Float32Array(MAX_PARTICLES)
    const alphas = new Float32Array(MAX_PARTICLES)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vAlpha = aAlpha;
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (320.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.05, d) * vAlpha;
          gl_FragColor = vec4(vColor, a);
        }`,
    })
    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
    scene.add(this.points)
    this.pGeo = geo
    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, maxLife: 1, size: 0.1, gravity: 0, drag: 0, color: new THREE.Color(),
    }))
    this.pIndex = 0

    const tGeo = new THREE.BufferGeometry()
    const tPos = new Float32Array(MAX_TRACERS * 2 * 3)
    const tCol = new Float32Array(MAX_TRACERS * 2 * 3)
    tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3))
    tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3))
    tGeo.setDrawRange(0, MAX_TRACERS * 2)
    this.tracerMesh = new THREE.LineSegments(tGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    }))
    this.tracerMesh.frustumCulled = false
    scene.add(this.tracerMesh)
    this.tPos = tPos
    this.tCol = tCol
    this.tracers = Array.from({ length: MAX_TRACERS }, () => ({ life: 0, max: 0.075, color: new THREE.Color(1, 0.85, 0.5) }))
    this.tIndex = 0

    this.flashLight = new THREE.PointLight(0xffc86a, 0, 14, 2)
    scene.add(this.flashLight)
    this.flashLife = 0
    this.flashMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    scene.add(this.flashMesh)
    this.tmpV = new THREE.Vector3()
  }

  spawnParticle(pos, vel, color, size, life, gravity = 9, drag = 0.5) {
    const p = this.particles[this.pIndex]
    this.pIndex = (this.pIndex + 1) % MAX_PARTICLES
    p.pos.copy(pos)
    p.vel.copy(vel)
    p.color.set(color)
    p.size = size
    p.life = life
    p.maxLife = life
    p.gravity = gravity
    p.drag = drag
  }

  burst(pos, color, count = 8, power = 3, size = 0.13) {
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize()
      const vel = dir.multiplyScalar(power * (0.5 + Math.random() * 0.8))
      this.spawnParticle(pos, vel, color, size * (0.7 + Math.random() * 0.8), 0.35 + Math.random() * 0.35, 11, 1.2)
    }
  }

  leaves(pos, count = 10) {
    const greens = [0x6fbf4f, 0x4f9e45, 0x8ac75a]
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 1.2, Math.random() - 0.5).normalize()
      this.spawnParticle(pos, dir.multiplyScalar(2 + Math.random() * 3), greens[i % 3], 0.16, 0.7 + Math.random() * 0.5, 5, 1.4)
    }
  }

  shootTracer(from, to, color = 0xffd97a, width = 1) {
    const i = this.tIndex
    this.tIndex = (this.tIndex + 1) % MAX_TRACERS
    const a = i * 6
    this.tPos[a] = from.x
    this.tPos[a + 1] = from.y
    this.tPos[a + 2] = from.z
    this.tPos[a + 3] = to.x
    this.tPos[a + 4] = to.y
    this.tPos[a + 5] = to.z
    const col = new THREE.Color(color)
    this.tCol[a] = col.r * width
    this.tCol[a + 1] = col.g * width
    this.tCol[a + 2] = col.b * width
    this.tCol[a + 3] = col.r * width
    this.tCol[a + 4] = col.g * width
    this.tCol[a + 5] = col.b * width
    this.tracers[i].life = 0.075
    this.tracers[i].max = 0.075
    this.tracers[i].color.set(color)
    const attr = this.tracerMesh.geometry.attributes.position
    attr.needsUpdate = true
    this.tracerMesh.geometry.attributes.color.needsUpdate = true
  }

  muzzle(pos, big = false) {
    this.flashLight.position.copy(pos)
    this.flashLight.intensity = big ? 22 : 10
    this.flashLife = 0.06
    this.flashMesh.position.copy(pos)
    this.flashMesh.scale.setScalar(big ? 1.7 : 1)
    this.flashMesh.material.opacity = 1
    this.flashMesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
  }

  damageNumber(worldPos, value, crit = false) {
    this.ui?.damageNumber(worldPos, value, crit)
  }

  update(dt) {
    const posAttr = this.pGeo.attributes.position
    const colAttr = this.pGeo.attributes.aColor
    const sizeAttr = this.pGeo.attributes.aSize
    const alphaAttr = this.pGeo.attributes.aAlpha
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i]
      const a = i * 3
      if (p.life > 0) {
        p.life -= dt
        p.vel.y -= p.gravity * dt
        p.vel.multiplyScalar(1 - Math.min(0.9, p.drag * dt))
        p.pos.addScaledVector(p.vel, dt)
        const alpha = clamp(p.life / p.maxLife, 0, 1)
        posAttr.array[a] = p.pos.x
        posAttr.array[a + 1] = p.pos.y
        posAttr.array[a + 2] = p.pos.z
        colAttr.array[a] = p.color.r
        colAttr.array[a + 1] = p.color.g
        colAttr.array[a + 2] = p.color.b
        sizeAttr.array[i] = p.size
        alphaAttr.array[i] = alpha
      } else {
        alphaAttr.array[i] = 0
      }
    }
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    sizeAttr.needsUpdate = true
    alphaAttr.needsUpdate = true

    const colAttrT = this.tracerMesh.geometry.attributes.color
    for (let i = 0; i < MAX_TRACERS; i++) {
      const t = this.tracers[i]
      if (t.life > 0) {
        t.life -= dt
        const f = clamp(t.life / t.max, 0, 1)
        const a = i * 6
        const c = t.color
        colAttrT.array[a] = c.r * f
        colAttrT.array[a + 1] = c.g * f
        colAttrT.array[a + 2] = c.b * f
        colAttrT.array[a + 3] = c.r * f
        colAttrT.array[a + 4] = c.g * f
        colAttrT.array[a + 5] = c.b * f
      } else {
        const a = i * 6
        colAttrT.array[a] = colAttrT.array[a + 1] = colAttrT.array[a + 2] = 0
        colAttrT.array[a + 3] = colAttrT.array[a + 4] = colAttrT.array[a + 5] = 0
      }
    }
    colAttrT.needsUpdate = true

    if (this.flashLife > 0) {
      this.flashLife -= dt
      const f = clamp(this.flashLife / 0.06, 0, 1)
      this.flashLight.intensity *= 0.72
      this.flashMesh.material.opacity = f
      this.flashMesh.scale.setScalar(1 + (1 - f) * 1.6)
    } else {
      this.flashLight.intensity = 0
      this.flashMesh.material.opacity = 0
    }
  }
}
