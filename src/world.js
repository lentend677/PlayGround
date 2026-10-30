import * as THREE from 'three'
import { makeRng, clamp, lerp, smoothstep, dist2 } from './utils.js'

export const ISLAND_RADIUS = 262

export const POIS = [
  { name: 'Sunny Shores', x: 138, z: -138, r: 30, type: 'beach', color: '#ffe08a' },
  { name: 'Pine Peak', x: -124, z: -82, r: 30, type: 'camp', color: '#9ee27a' },
  { name: 'Rusty Ridge', x: 128, z: 82, r: 33, type: 'industrial', color: '#ffb07a' },
  { name: 'Cloud Court', x: -88, z: 126, r: 32, type: 'manor', color: '#c8b5ff' },
  { name: 'Mossy Mill', x: -152, z: 26, r: 31, type: 'farm', color: '#ffe28f' },
]

const BOX_MATS = {
  wallA: { color: 0xf1dfc2, rough: 0.9 },
  wallB: { color: 0x8fc0b6, rough: 0.85 },
  wallC: { color: 0xe2937f, rough: 0.9 },
  wallD: { color: 0x71838f, rough: 0.85 },
  brick: { color: 0xb96f57, rough: 0.95 },
  trim: { color: 0xf7f1e2, rough: 0.85 },
  wood: { color: 0xad7648, rough: 0.9 },
  woodDark: { color: 0x71492b, rough: 0.92 },
  roofRed: { color: 0xc95448, rough: 0.85 },
  roofBlue: { color: 0x507f9f, rough: 0.8 },
  roofSlate: { color: 0x4e5b66, rough: 0.8 },
  roofTeal: { color: 0x3d8b84, rough: 0.8 },
  glass: { color: 0x1d3547, rough: 0.12, metal: 0.55 },
  stone: { color: 0x9c9588, rough: 0.98 },
  stoneDark: { color: 0x756f66, rough: 1 },
  metal: { color: 0x96a2ac, rough: 0.45, metal: 0.65 },
  metalDark: { color: 0x596673, rough: 0.5, metal: 0.6 },
  containerA: { color: 0xd15f4b, rough: 0.65, metal: 0.3 },
  containerB: { color: 0x3d8fb3, rough: 0.65, metal: 0.3 },
  containerC: { color: 0xdda23c, rough: 0.65, metal: 0.3 },
  gold: { color: 0xffc247, rough: 0.35, metal: 0.55, emissive: 0x5c3300, emissiveIntensity: 0.5 },
  path: { color: 0xcbb88f, rough: 1, shadow: false },
  soil: { color: 0x74543a, rough: 1, shadow: false },
  crop: { color: 0x86b948, rough: 0.95, shadow: false },
  fabricCream: { color: 0xf2e5c9, rough: 0.95 },
  fabricRed: { color: 0xd15a51, rough: 0.95 },
  fabricTeal: { color: 0x3f918c, rough: 0.95 },
  white: { color: 0xe9eef2, rough: 0.8 },
  hedge: { color: 0x4c8f47, rough: 1 },
  water: { color: 0x54c0cf, rough: 0.25, metal: 0.2, transparent: true, opacity: 0.85 },
  neon: { color: 0x66e9ff, rough: 0.4, emissive: 0x2299bb, emissiveIntensity: 1.2 },
}

function hash2(x, z) {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return n - Math.floor(n)
}

export class World {
  constructor(scene, quality = 'high') {
    this.scene = scene
    this.quality = quality
    this.group = new THREE.Group()
    this.group.name = 'island'
    scene.add(this.group)
    this.rng = makeRng(20261030)
    this.colliders = []
    this.solidMeshes = []
    this.resourceNodes = []
    this.chests = []
    this.builds = []
    this.time = 0
    this.chestSpots = []
    this.raycaster = new THREE.Raycaster()
    this.tmp = new THREE.Vector3()

    this.flatZones = POIS.map((p) => ({ x: p.x, z: p.z, r: p.r, y: this.rawHeight(p.x, p.z) }))

    this._makeMaterials()
    this._buildSky()
    this._buildTerrain()
    this._buildWater()
    this._buildMountains()
    this._buildLayout()
    this._buildTrees()
    this._buildRocks()
    this._buildDetails()
    this._buildChests()
    this._buildBus()
    this._buildClouds()

    this.storm = new Storm(scene)
  }

  /* ---------------------------------------------------------------- terrain */
  rawHeight(x, z) {
    const r = Math.hypot(x, z)
    const n =
      Math.sin(x * 0.021 + 0.4) * Math.cos(z * 0.017 - 0.7) * 3.1 +
      Math.sin(x * 0.051 + 1.3) * Math.cos(z * 0.043 - 0.8) * 1.55 +
      Math.sin((x + z) * 0.107 + 2.1) * 0.45
    const coast = smoothstep(ISLAND_RADIUS + 18, ISLAND_RADIUS - 34, r)
    return lerp(-7.5, 7.4 + n, coast)
  }

  heightAt(x, z) {
    let h = this.rawHeight(x, z)
    for (const zone of this.flatZones) {
      const d = Math.hypot(x - zone.x, z - zone.z)
      if (d < zone.r + 12) {
        const t = smoothstep(zone.r + 10, zone.r - 5, d) * 0.94
        h = lerp(h, zone.y, t)
      }
    }
    return h
  }

  /* -------------------------------------------------------------- materials */
  _makeMaterials() {
    this.materials = {}
    for (const [key, m] of Object.entries(BOX_MATS)) {
      this.materials[key] = new THREE.MeshStandardMaterial({
        color: m.color,
        roughness: m.rough ?? 0.85,
        metalness: m.metal ?? 0.05,
        transparent: m.transparent ?? false,
        opacity: m.opacity ?? 1,
        emissive: m.emissive ?? 0x000000,
        emissiveIntensity: m.emissiveIntensity ?? 0,
        flatShading: false,
      })
    }
    this.woodTex = makePlankTexture()
    this.buildMat = new THREE.MeshStandardMaterial({ map: this.woodTex, roughness: 0.88, metalness: 0 })
    this.ghostMat = new THREE.MeshStandardMaterial({
      color: 0x5ce8ff, transparent: true, opacity: 0.34, roughness: 0.4,
      emissive: 0x33cced, emissiveIntensity: 0.7, depthWrite: false, side: THREE.DoubleSide,
    })
  }

  /* -------------------------------------------------------------------- sky */
  _buildSky() {
    const geo = new THREE.SphereGeometry(720, 32, 20)
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x3e69bd) },
        midColor: { value: new THREE.Color(0xffc99c) },
        horizonColor: { value: new THREE.Color(0xffe6c4) },
        sunDir: { value: new THREE.Vector3(-0.52, 0.26, 0.81).normalize() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 topColor, midColor, horizonColor, sunDir;
        void main() {
          float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(horizonColor, midColor, smoothstep(0.42, 0.56, h));
          col = mix(col, topColor, smoothstep(0.55, 0.9, h));
          float d = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += vec3(1.0, 0.72, 0.42) * pow(d, 7.0) * 0.45;
          col += vec3(1.0, 0.92, 0.72) * pow(d, 380.0) * 2.2;
          float below = smoothstep(0.5, 0.38, h);
          col = mix(col, vec3(0.72, 0.82, 0.85), below * 0.5);
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
    this.sky = new THREE.Mesh(geo, mat)
    this.sky.frustumCulled = false
    this.sky.renderOrder = -20
    this.scene.add(this.sky)

    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x7d6b50, 1.45)
    this.scene.add(this.hemi)
    this.sun = new THREE.DirectionalLight(0xffd9b0, 2.9)
    this.sun.position.set(78, 118, 56)
    this.sun.castShadow = true
    const size = this.quality === 'high' ? 2048 : 1024
    this.sun.shadow.mapSize.set(size, size)
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 260
    this.sun.shadow.camera.left = -48
    this.sun.shadow.camera.right = 48
    this.sun.shadow.camera.top = 48
    this.sun.shadow.camera.bottom = -48
    this.sun.shadow.bias = -0.0006
    this.sun.shadow.normalBias = 0.035
    this.sun.target.position.set(0, 0, 0)
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)

    this.scene.fog = new THREE.Fog(0xcfe0e2, 175, 560)
  }

  /* ---------------------------------------------------------------- terrain */
  _buildTerrain() {
    const size = 600
    const seg = this.quality === 'high' ? 190 : 120
    const geo = new THREE.PlaneGeometry(size, size, seg, seg)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const cGrass = new THREE.Color(0x7dbb60)
    const cGrassDark = new THREE.Color(0x58984c)
    const cSand = new THREE.Color(0xf0d69c)
    const cSandWet = new THREE.Color(0xd8bd85)
    const cRock = new THREE.Color(0x9c9888)
    const cDirt = new THREE.Color(0x9c7c58)
    const tmp = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const h = this.heightAt(x, z)
      pos.setY(i, h)
      const slope = Math.hypot(this.heightAt(x + 1.6, z) - h, this.heightAt(x, z + 1.6) - h)
      const n = hash2(x * 0.7, z * 0.7)
      if (h < 0.65) tmp.copy(cSandWet).lerp(cSand, clamp(h / 0.65, 0, 1))
      else if (h < 2.3) tmp.copy(cSand).lerp(cGrass, smoothstep(1.1, 2.3, h))
      else {
        tmp.copy(cGrass).lerp(cGrassDark, smoothstep(2.5, 10, h) * 0.75 + n * 0.25)
        if (slope > 1.05) tmp.lerp(cRock, smoothstep(1.05, 2.4, slope) * 0.85)
        if (h > 8.5) tmp.lerp(cDirt, smoothstep(8.5, 12, h) * 0.35)
      }
      tmp.offsetHSL((n - 0.5) * 0.015, 0, (n - 0.5) * 0.04)
      colors[i * 3] = tmp.r
      colors[i * 3 + 1] = tmp.g
      colors[i * 3 + 2] = tmp.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
    this.terrain = new THREE.Mesh(geo, mat)
    this.terrain.receiveShadow = true
    this.group.add(this.terrain)
  }

  _buildWater() {
    const geo = new THREE.PlaneGeometry(1700, 1700, 1, 1)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(0x247f9b) },
        uShallow: { value: new THREE.Color(0x63c9c5) },
        uFog: { value: new THREE.Color(0xcfe0e2) },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uDeep, uShallow, uFog;
        varying vec3 vWorld;
        void main() {
          float d = length(vWorld.xz);
          float bands = sin(vWorld.x * 0.09 + uTime * 1.1) * 0.5 + sin(vWorld.z * 0.07 - uTime * 0.8) * 0.5;
          float bands2 = sin((vWorld.x + vWorld.z) * 0.23 + uTime * 1.6) * 0.5 + 0.5;
          vec3 col = mix(uDeep, uShallow, 0.35 + bands * 0.09 + bands2 * 0.08);
          float shore = smoothstep(300.0, 210.0, d);
          col = mix(col, uShallow * 1.05, shore * 0.25);
          float fade = smoothstep(260.0, 680.0, d);
          col = mix(col, uFog, fade);
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
    this.waterMat = mat
    this.water = new THREE.Mesh(geo, mat)
    this.water.position.y = 0
    this.water.receiveShadow = false
    this.group.add(this.water)
  }

  _buildMountains() {
    const geo = new THREE.ConeGeometry(1, 1, 5)
    const mat = new THREE.MeshStandardMaterial({ color: 0x93a9b8, roughness: 1, flatShading: true })
    const count = 16
    const mesh = new THREE.InstancedMesh(geo, mat, count)
    const dummy = new THREE.Object3D()
    const rng = makeRng(77)
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng.range(-0.08, 0.08)
      const r = rng.range(430, 620)
      const h = rng.range(45, 130)
      dummy.position.set(Math.cos(a) * r, h / 2 - 18, Math.sin(a) * r)
      dummy.scale.set(rng.range(55, 130), h, rng.range(55, 130))
      dummy.rotation.set(0, rng.range(0, 3), 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.frustumCulled = false
    this.group.add(mesh)
  }

  /* -------------------------------------------------------------- buildings */
  _buildLayout() {
    const L = new Layout(this)
    this.layout = L

    this._buildBeach(L)
    this._buildCamp(L)
    this._buildIndustrial(L)
    this._buildManor(L)
    this._buildFarm(L)

    // scattered lone cabins
    const rng = makeRng(9001)
    for (let i = 0; i < 5; i++) {
      const a = rng.range(0, Math.PI * 2)
      const r = rng.range(60, 170)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (POIS.some((p) => dist2(x, z, p.x, p.z) < p.r + 18)) continue
      const rot = rng.range(0, 4) | 0
      this.house(L, x, z, {
        w: 7, d: 6, h: 3.1, rot: rot * Math.PI / 2,
        wall: rng.pick(['wallA', 'wallB', 'wallC']),
        roof: rng.pick(['roofRed', 'roofBlue', 'roofTeal']),
        chimney: true,
      })
    }

    L.finish(this.group)
    for (const m of L.meshes) {
      m.castShadow = true
      m.receiveShadow = true
      this.solidMeshes.push(m)
    }
    for (const sign of this.signs || []) this.group.add(sign)
  }

  poi(name) { return POIS.find((p) => p.name === name) }

  _buildBeach(L) {
    const p = this.poi('Sunny Shores')
    const spots = [
      [-11, -7, 0.15], [10, -8, -0.3], [-8, 11, Math.PI * 0.92], [13, 10, Math.PI * 1.12],
    ]
    for (const [dx, dz, rot] of spots) {
      const x = p.x + dx
      const z = p.z + dz
      this.house(L, x, z, {
        w: 6.4, d: 5.6, h: 2.9, rot,
        wall: 'wallB', roof: 'roofTeal', deck: 1.0, chimney: false, steps: true,
      })
      L.box('path', x + Math.cos(rot) * 1, this.heightAt(x, z) + 0.08, z + Math.sin(rot) * 1,
        2.2, 0.1, 2.2, rot, false)
    }
    // beach palapa
    const hx = p.x - 1
    const hz = p.z + 2
    const hy = this.heightAt(hx, hz)
    for (const [ox, oz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
      L.cylinder('woodDark', hx + ox, hy + 1.5, hz + oz, 0.16, 3.2, true)
    }
    L.cone('fabricCream', hx, hy + 3.6, hz, 8.5, 1.4, 8, Math.PI / 8, false)
    L.box('woodDark', hx, hy + 0.45, hz, 6.8, 0.18, 6.8, 0, false)
    // row of beach umbrellas
    for (let i = 0; i < 4; i++) {
      const ux = p.x - 18 + i * 10
      const uz = p.z + 20 + Math.sin(i) * 2
      const uy = this.heightAt(ux, uz)
      L.cylinder('white', ux, uy + 1.3, uz, 0.07, 2.6, true)
      L.cone(i % 2 ? 'fabricRed' : 'fabricTeal', ux, uy + 2.7, uz, 3.6, 0.8, 10, 0, false)
    }
    // dock toward the sea
    const dx = p.x + 22
    const dz = p.z - 24
    const dy = Math.max(0.9, this.heightAt(dx, dz))
    for (let i = 0; i < 9; i++) {
      const px = dx + i * 1.9
      const pz = dz - i * 1.9
      L.box('wood', px, dy + 0.3, pz, 2.6, 0.22, 2.6, Math.PI / 4, false)
      if (i % 2 === 0) {
        L.cylinder('woodDark', px + 0.9, dy - 0.4, pz - 0.9, 0.16, 2.2, false)
        L.cylinder('woodDark', px - 0.9, dy - 0.4, pz + 0.9, 0.16, 2.2, false)
      }
    }
    this.poiMarkers = this.poiMarkers || []
    this.poiMarkers.push({ ...p })
  }

  _buildCamp(L) {
    const p = this.poi('Pine Peak')
    const spots = [[-13, -9, 0.2], [12, -10, -0.25], [-12, 12, Math.PI * 0.9], [13, 12, Math.PI * 1.1]]
    for (const [dx, dz, rot] of spots) {
      this.house(L, p.x + dx, p.z + dz, {
        w: 7, d: 6, h: 3, rot, wall: 'wood', roof: 'roofSlate', chimney: true,
      })
    }
    // watchtower
    const tx = p.x
    const tz = p.z
    const ty = this.heightAt(tx, tz)
    for (const [ox, oz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      L.cylinder('woodDark', tx + ox, ty + 2.8, tz + oz, 0.22, 5.6, true)
    }
    L.box('wood', tx, ty + 5.8, tz, 5.4, 0.35, 5.4, 0, true)
    L.box('woodDark', tx, ty + 6.3, tz, 5.8, 0.4, 5.8, 0, true)
    for (const [ox, oz] of [[0, -2.5], [0, 2.5], [-2.5, 0], [2.5, 0]]) {
      L.box('wood', tx + ox, ty + 7.2, tz + oz, ox ? 0.25 : 5.2, 1.6, ox ? 5.2 : 0.25, 0, false)
    }
    L.cone('roofRed', tx, ty + 8.9, tz, 7.2, 1.8, 4, Math.PI / 4, false)
    // tents
    const rng = makeRng(441)
    for (let i = 0; i < 5; i++) {
      const a = rng.range(0, 6.2)
      const r = rng.range(14, 24)
      const x = p.x + Math.cos(a) * r
      const z = p.z + Math.sin(a) * r
      const y = this.heightAt(x, z)
      const s = rng.range(2.8, 4)
      L.cone(rng.pick(['fabricCream', 'fabricRed', 'fabricTeal']), x, y + s * 0.42, z, s, s * 0.84, 4, Math.PI / 4, true)
      L.box('woodDark', x, y + 0.1, z, 0.3, 0.2, s * 0.55, rng.range(0, 3), false)
    }
    // campfire
    const fx = p.x + 1
    const fz = p.z + 3
    const fy = this.heightAt(fx, fz)
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2
      L.cylinder('stoneDark', fx + Math.cos(a) * 1.1, fy + 0.12, fz + Math.sin(a) * 1.1, 0.3, 0.28, true)
    }
    for (let i = 0; i < 4; i++) {
      L.cylinder('woodDark', fx, fy + 0.18, fz, 0.14, 1.7, true, (i / 4) * Math.PI)
    }
    L.cone('neon', fx, fy + 0.6, fz, 0.8, 1.1, 6, 0, false)
    const fireLight = new THREE.PointLight(0xff9b47, 16, 18, 2)
    fireLight.position.set(fx, fy + 1.5, fz)
    this.group.add(fireLight)
    this.fireLight = fireLight
    this.poiMarkers = this.poiMarkers || []
    this.poiMarkers.push({ ...p })
  }

  _buildIndustrial(L) {
    const p = this.poi('Rusty Ridge')
    this.warehouse(L, p.x - 4, p.z - 4, 18, 13, Math.PI * 0.04)
    this.house(L, p.x + 16, p.z - 12, {
      w: 7.5, d: 6.5, h: 3.3, rot: Math.PI, wall: 'metal', roof: 'roofSlate', chimney: false,
    })
    // containers
    const rng = makeRng(313)
    for (let i = 0; i < 4; i++) {
      const x = p.x - 18 + i * 5.4
      const z = p.z + 15
      const y = this.heightAt(x, z)
      const key = rng.pick(['containerA', 'containerB', 'containerC'])
      L.box(key, x, y + 1.3, z, 2.6, 2.6, 6.2, 0, true)
      L.box('metalDark', x, y + 1.3, z + 3.13, 2.4, 2.35, 0.08, 0, false)
    }
    // stacked container
    const sx = p.x + 12
    const sz = p.z + 8
    const sy = this.heightAt(sx, sz)
    L.box('containerB', sx, sy + 1.3, sz, 6.2, 2.6, 2.6, 0, true)
    L.box('containerC', sx + 0.4, sy + 3.9, sz, 6.2, 2.6, 2.6, 0, true)
    // pipes & barrels
    for (let i = 0; i < 6; i++) {
      const x = p.x - 16 + i * 6
      const z = p.z - 17
      const y = this.heightAt(x, z)
      L.cylinder('metalDark', x, y + 0.6, z, 0.5, 1.2, true)
      L.cylinder('metal', x, y + 1.3, z, 0.42, 0.35, true)
    }
    this.poiMarkers = this.poiMarkers || []
    this.poiMarkers.push({ ...p })
  }

  _buildManor(L) {
    const p = this.poi('Cloud Court')
    this.house(L, p.x, p.z - 3, {
      w: 15, d: 11, h: 4.4, rot: 0, wall: 'wallA', roof: 'roofBlue', chimney: true,
      columns: true, balcony: true,
    })
    this.house(L, p.x - 18, p.z + 12, {
      w: 8, d: 7, h: 3.4, rot: Math.PI * 0.5, wall: 'wallC', roof: 'roofBlue',
    })
    this.house(L, p.x + 18, p.z + 12, {
      w: 8, d: 7, h: 3.4, rot: Math.PI * 1.5, wall: 'wallC', roof: 'roofBlue',
    })
    // fountain
    const fx = p.x
    const fz = p.z + 19
    const fy = this.heightAt(fx, fz)
    L.cylinder('stone', fx, fy + 0.4, fz, 4.2, 0.8, true)
    L.cylinder('water', fx, fy + 0.75, fz, 3.6, 0.12, false)
    L.cylinder('stone', fx, fy + 1.2, fz, 0.6, 1.6, true)
    L.cylinder('gold', fx, fy + 2.05, fz, 0.7, 0.18, false)
    // hedges
    for (let i = 0; i < 10; i++) {
      const x = p.x - 22 + i * 4.8
      const z = p.z - 20
      const y = this.heightAt(x, z)
      L.box('hedge', x, y + 0.7, z, 4.2, 1.5, 1.2, 0, true)
    }
    // lamps
    for (let i = 0; i < 4; i++) {
      const x = p.x - 12 + i * 8
      const z = p.z + 14
      const y = this.heightAt(x, z)
      L.cylinder('metalDark', x, y + 1.9, z, 0.09, 3.8, true)
      L.box('neon', x, y + 3.9, z, 0.5, 0.32, 0.5, 0, false)
    }
    this.poiMarkers = this.poiMarkers || []
    this.poiMarkers.push({ ...p })
  }

  _buildFarm(L) {
    const p = this.poi('Mossy Mill')
    // barn
    this.house(L, p.x - 5, p.z - 4, {
      w: 14, d: 11, h: 5, rot: 0, wall: 'brick', roof: 'roofRed', door: 3.4,
      roofHeight: 3.2, chimney: false,
    })
    this.house(L, p.x + 17, p.z - 12, {
      w: 8.5, d: 7, h: 3.4, rot: Math.PI * 0.5, wall: 'wallA', roof: 'roofRed', chimney: true,
    })
    // silos
    for (let i = 0; i < 2; i++) {
      const x = p.x + 15 + i * 6.2
      const z = p.z + 6
      const y = this.heightAt(x, z)
      L.cylinder('metal', x, y + 4.5, z, 2.5, 9, true)
      L.cone('metalDark', x, y + 9.5, z, 5.6, 1.9, 10, 0, false)
      L.cylinder('metalDark', x, y + 4.5, z, 2.56, 0.28, false)
    }
    // fields
    for (let i = 0; i < 5; i++) {
      const x = p.x - 22 + i * 5.4
      const z = p.z + 17
      const y = this.heightAt(x, z)
      L.box('soil', x, y + 0.08, z, 3.8, 0.16, 15, 0, false)
      for (let j = 0; j < 6; j++) {
        L.box('crop', x, y + 0.32, z - 6 + j * 2.4, 3.2, 0.35, 1.4, 0, false)
      }
    }
    // fence
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2
      const x = p.x + Math.cos(a) * 27
      const z = p.z + Math.sin(a) * 27
      const y = this.heightAt(x, z)
      L.box('woodDark', x, y + 0.75, z, 0.16, 1.5, 0.16, 0, false)
      if (i % 2 === 0) {
        const nx = p.x + Math.cos(a + 0.13) * 27
        const nz = p.z + Math.sin(a + 0.13) * 27
        const ny = this.heightAt(nx, nz)
        L.box('woodDark', (x + nx) / 2, (y + ny) / 2 + 0.85, (z + nz) / 2, 2.6, 0.16, 0.12, -a, false)
        L.box('woodDark', (x + nx) / 2, (y + ny) / 2 + 0.4, (z + nz) / 2, 2.6, 0.14, 0.12, -a, false)
      }
    }
    this.poiMarkers = this.poiMarkers || []
    this.poiMarkers.push({ ...p })
  }

  house(L, cx, cz, opt = {}) {
    const {
      w = 8, d = 7, h = 3.4, rot = 0, wall = 'wallA', roof = 'roofRed',
      door = 1.8, deck = 0, chimney = false, steps = false, columns = false,
      balcony = false, roofHeight = 2.1, windows = true,
    } = opt
    const baseY = this.heightAt(cx, cz) + 0.03
    const floorY = baseY + deck + 0.3
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    const P = (dx, dz) => [cx + dx * cos + dz * sin, cz - dx * sin + dz * cos]
    const B = (dx, dy, dz, sx, sy, sz, key = wall, lr = 0, collide = true, rx = 0, rz = 0) => {
      const [x, z] = P(dx, dz)
      return L.box(key, x, dy, z, sx, sy, sz, rot + lr, collide, rx, rz)
    }

    if (deck > 0) {
      // stilted deck
      for (const [ox, oz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
        const [x, z] = P(ox, oz)
        L.cylinder('woodDark', x, baseY + deck / 2, z, 0.22, deck + 0.4, true)
      }
      B(0, baseY + deck + 0.1, 0, w + 0.8, 0.3, d + 0.8, 'wood', 0, true)
      if (steps) {
        for (let i = 0; i < 3; i++) {
          B(0, baseY + 0.22 + i * 0.28, d / 2 + 1.3 - i * 0.7, 3, 0.5, 0.8, 'wood', 0, true)
        }
      }
    } else {
      B(0, baseY - 0.2, 0, w + 0.7, 1.0, d + 0.7, 'stoneDark', 0, true)
      B(0, floorY + 0.02, 0, w - 0.1, 0.12, d - 0.1, 'woodDark', 0, false)
    }

    // walls
    const wy = floorY + h / 2
    const t = 0.3
    B(-w / 2, wy, 0, t, h, d, wall)
    B(w / 2, wy, 0, t, h, d, wall)
    B(0, wy, -d / 2, w, h, t, wall)
    const seg = (w - door) / 2
    B(-(door / 2 + seg / 2), wy, d / 2, seg, h, t, wall)
    B(door / 2 + seg / 2, wy, d / 2, seg, h, t, wall)
    B(0, floorY + 2.45 + (h - 2.45) / 2, d / 2, door, h - 2.45, t, wall)
    B(-door / 2 - 0.09, floorY + 1.2, d / 2, 0.18, 2.4, t + 0.08, 'trim', 0, false)
    B(door / 2 + 0.09, floorY + 1.2, d / 2, 0.18, 2.4, t + 0.08, 'trim', 0, false)
    B(0, floorY + 2.44, d / 2, door + 0.24, 0.16, t + 0.1, 'trim', 0, false)

    if (windows) {
      for (const side of [-1, 1]) {
        for (const i of [-1, 1]) {
          const wx = i * w * 0.27
          B(wx, floorY + 1.85, side * (d / 2 + 0.07), 1.15, 1.05, 0.08, 'glass', 0, false)
          B(wx, floorY + 1.85, side * (d / 2 + 0.04), 1.35, 1.25, 0.07, 'trim', 0, false)
        }
        for (const i of [-1, 1]) {
          const wz = i * d * 0.25
          B(side * (w / 2 + 0.07), floorY + 1.85, wz, 0.08, 1.05, 1.15, 'glass', 0, false)
          B(side * (w / 2 + 0.04), floorY + 1.85, wz, 0.07, 1.25, 1.35, 'trim', 0, false)
        }
      }
    }

    // porch
    if (columns) {
      for (const i of [-1, 1]) {
        const [x, z] = P(i * w * 0.36, d / 2 + 2.2)
        L.cylinder('trim', x, floorY + 2, z, 0.28, 4, true)
      }
      B(0, floorY + 4.1, d / 2 + 2.2, w * 0.82, 0.3, 4.8, 'trim', 0, false)
      for (let i = 0; i < 3; i++) {
        B(0, baseY + 0.2 + i * 0.3, d / 2 + 3 - i * 0.55, w * 0.7, 0.55, 0.8, 'stone', 0, true)
      }
    }

    if (balcony) {
      B(0, floorY + 2.6, d / 2 + 1.2, w * 0.7, 0.22, 2.2, 'woodDark', 0, true)
      B(0, floorY + 3.25, d / 2 + 2.25, w * 0.7, 0.9, 0.1, 'woodDark', 0, false)
    }

    // pyramid roof
    const eave = floorY + h
    const [rx, rz] = P(0, 0)
    L.cone(roof, rx, eave + roofHeight / 2, rz, (w + 1.2) / 0.707, roofHeight, 4, rot + Math.PI / 4, false)
    B(0, eave + 0.08, 0, w + 0.9, 0.18, d + 0.9, 'trim', 0, false)
    if (chimney) {
      B(w * 0.27, eave + roofHeight * 0.72, -d * 0.18, 0.8, 2.4, 0.8, 'brick', 0, false)
      B(w * 0.27, eave + roofHeight * 0.72 + 1.25, -d * 0.18, 1.0, 0.18, 1.0, 'stoneDark', 0, false)
    }

    // interior loot spot
    const [lx, lz] = P(0, 0)
    this.chestSpots.push({ x: lx, z: lz, y: floorY + 0.08 })
    // paths
    const [px, pz] = P(0, d / 2 + 3)
    L.box('path', px, this.heightAt(px, pz) + 0.08, pz, 2.2, 0.12, 2.4, rot, false)
    return floorY
  }

  warehouse(L, cx, cz, w, d, rot) {
    const baseY = this.heightAt(cx, cz) + 0.03
    const floorY = baseY + 0.25
    const h = 5
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    const P = (dx, dz) => [cx + dx * cos + dz * sin, cz - dx * sin + dz * cos]
    const B = (dx, dy, dz, sx, sy, sz, key, lr = 0, collide = true) => {
      const [x, z] = P(dx, dz)
      return L.box(key, x, dy, z, sx, sy, sz, rot + lr, collide)
    }
    B(0, baseY - 0.1, 0, w + 1, 0.7, d + 1, 'stoneDark', 0, true)
    B(-w / 2, floorY + h / 2, 0, 0.35, h, d, 'metal', 0, true)
    B(w / 2, floorY + h / 2, 0, 0.35, h, d, 'metal', 0, true)
    B(0, floorY + h / 2, -d / 2, w, h, 0.35, 'metal', 0, true)
    B(0, floorY + h - 0.5, d / 2, w, 1, 0.35, 'metal', 0, false)
    B(0, floorY + h + 0.1, 0, w + 1, 0.3, d + 1, 'roofSlate', 0, false)
    // ribs
    for (let i = -3; i <= 3; i++) {
      B(i * (w / 7), floorY + h / 2, d / 2 + 0.18, 0.12, h, 0.1, 'metalDark', 0, false)
      B(i * (w / 7), floorY + h / 2, -d / 2 - 0.18, 0.12, h, 0.1, 'metalDark', 0, false)
    }
    // interior containers
    B(-w * 0.22, floorY + 1.3, -d * 0.2, 5.6, 2.6, 2.6, 'containerA', 0, true)
    B(w * 0.18, floorY + 1.3, -d * 0.18, 2.6, 2.6, 5.6, 'containerC', 0, true)
    B(w * 0.22, floorY + 3.9, -d * 0.18, 2.6, 2.6, 5.6, 'containerB', 0, true)
    for (let i = 0; i < 4; i++) {
      B(-w * 0.3 + i * 1.5, floorY + 0.6, d * 0.22, 1.2, 1.2, 1.2, 'wood', 0, true)
    }
    // hanging lights
    for (let i = -1; i <= 1; i++) {
      const [hx, hz] = P(i * w * 0.25, 0)
      B(i * w * 0.25, floorY + h - 1.6, 0, 0.3, 0.3, 0.3, 'neon', 0, false)
      L.cylinder('metalDark', hx, floorY + h - 0.8, hz, 0.03, 1.6, false)
    }
    const [lx, lz] = P(w * 0.28, d * 0.24)
    this.chestSpots.push({ x: lx, z: lz, y: floorY + 0.08 })
    const [lx2, lz2] = P(-w * 0.32, d * 0.26)
    this.chestSpots.push({ x: lx2, z: lz2, y: floorY + 0.08 })
  }

  /* ------------------------------------------------------------------ props */
  _buildTrees() {
    const rng = makeRng(123456)
    const positions = []
    let guard = 0
    while (positions.length < 170 && guard++ < 4000) {
      const a = rng.range(0, Math.PI * 2)
      const r = Math.sqrt(rng.next()) * 225
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (this.heightAt(x, z) < 1.1) continue
      if (POIS.some((p) => dist2(x, z, p.x, p.z) < p.r + 7)) continue
      if (positions.some((p) => dist2(x, z, p.x, p.z) < 5)) continue
      positions.push({ x, z, scale: rng.range(0.8, 1.45), hue: rng.int(0, 4) })
    }
    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.48, 1, 6)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.95, flatShading: true })
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, positions.length)
    const canopyGeo = new THREE.ConeGeometry(0.5, 1, 7)
    canopyGeo.rotateY(Math.PI / 7)
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, flatShading: true })
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, positions.length * 3)
    const palette = [0x4f9e45, 0x6cb84d, 0x3d7d3a, 0x8ac75a, 0x2f6b34].map((c) => new THREE.Color(c))
    const dummy = new THREE.Object3D()
    const col = new THREE.Color()
    let ci = 0
    positions.forEach((p, i) => {
      const y = this.heightAt(p.x, p.z)
      const th = 2.4 * p.scale
      dummy.position.set(p.x, y + th / 2, p.z)
      dummy.scale.set(p.scale, th, p.scale)
      dummy.rotation.set(0, rng.range(0, 6.28), 0)
      dummy.updateMatrix()
      trunks.setMatrixAt(i, dummy.matrix)
      const layers = [
        [0.0, 3.6, 3.0],
        [1.6, 2.6, 2.15],
        [3.0, 1.7, 1.45],
      ]
      for (const [oy, radius, height] of layers) {
        dummy.position.set(p.x, y + th * 0.62 + oy * p.scale, p.z)
        dummy.scale.set(radius * p.scale, height * p.scale, radius * p.scale)
        dummy.rotation.set(0, rng.range(0, 6.28), 0)
        dummy.updateMatrix()
        canopies.setMatrixAt(ci, dummy.matrix)
        col.copy(palette[p.hue]).offsetHSL(0, 0, rng.range(-0.04, 0.04))
        canopies.setColorAt(ci, col)
        ci++
      }
      this.resourceNodes.push({ x: p.x, z: p.z, y, r: 0.8, type: 'tree', scale: p.scale })
      this.colliders.push({
        minX: p.x - 0.45, maxX: p.x + 0.45, minZ: p.z - 0.45, maxZ: p.z + 0.45,
        minY: y, maxY: y + th * 1.8, tree: true,
      })
    })
    trunks.castShadow = true
    trunks.receiveShadow = true
    canopies.castShadow = true
    canopies.receiveShadow = true
    this.group.add(trunks, canopies)
    this.solidMeshes.push(trunks, canopies)
    this.trees = positions
  }

  _buildRocks() {
    const rng = makeRng(5150)
    const geo = new THREE.DodecahedronGeometry(0.7, 0)
    const mat = new THREE.MeshStandardMaterial({ color: 0x9b978c, roughness: 1, flatShading: true })
    const count = 55
    const mesh = new THREE.InstancedMesh(geo, mat, count)
    const dummy = new THREE.Object3D()
    const col = new THREE.Color()
    for (let i = 0; i < count; i++) {
      let x, z, y, s
      let guard = 0
      do {
        const a = rng.range(0, 6.28)
        const r = Math.sqrt(rng.next()) * 220
        x = Math.cos(a) * r
        z = Math.sin(a) * r
        y = this.heightAt(x, z)
        s = rng.range(0.7, 2.1)
      } while (y < 0.8 && guard++ < 50)
      dummy.position.set(x, y + s * 0.35, z)
      dummy.scale.set(s * rng.range(0.8, 1.4), s * rng.range(0.6, 1.1), s * rng.range(0.8, 1.4))
      dummy.rotation.set(rng.range(-0.2, 0.2), rng.range(0, 6.28), rng.range(-0.2, 0.2))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      col.setHex(0x9b978c).offsetHSL(0, 0, rng.range(-0.08, 0.08))
      mesh.setColorAt(i, col)
      if (s > 1.0) {
        this.colliders.push({
          minX: x - s * 0.55, maxX: x + s * 0.55, minZ: z - s * 0.55, maxZ: z + s * 0.55,
          minY: y - 0.5, maxY: y + s * 0.7,
        })
        this.resourceNodes.push({ x, z, y, r: s * 0.6, type: 'rock', scale: s })
      }
    }
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.group.add(mesh)
    this.solidMeshes.push(mesh)
    this.rocks = mesh
  }

  _buildDetails() {
    const rng = makeRng(8080)
    // bushes
    const bushGeo = new THREE.IcosahedronGeometry(0.5, 0)
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x4d9447, roughness: 1, flatShading: true })
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, 150)
    const dummy = new THREE.Object3D()
    const col = new THREE.Color()
    for (let i = 0; i < 150; i++) {
      let x, z, y
      let guard = 0
      do {
        const p = this.poi(this.poiMarkers?.[i % 5]?.name || 'Sunny Shores')
        x = p.x + rng.range(-p.r - 8, p.r + 8)
        z = p.z + rng.range(-p.r - 8, p.r + 8)
        y = this.heightAt(x, z)
      } while (y < 1 && guard++ < 30)
      const s = rng.range(0.8, 1.9)
      dummy.position.set(x, y + s * 0.25, z)
      dummy.scale.set(s, s * rng.range(0.55, 0.9), s)
      dummy.rotation.set(0, rng.range(0, 6.28), 0)
      dummy.updateMatrix()
      bushes.setMatrixAt(i, dummy.matrix)
      col.setHex(0x4d9447).offsetHSL(rng.range(-0.02, 0.02), 0, rng.range(-0.06, 0.06))
      bushes.setColorAt(i, col)
    }
    bushes.castShadow = false
    bushes.receiveShadow = true
    this.group.add(bushes)

    // grass tufts
    const grassGeo = new THREE.ConeGeometry(0.09, 0.55, 3)
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x79b95c, roughness: 1, flatShading: true })
    const grass = new THREE.InstancedMesh(grassGeo, grassMat, 700)
    for (let i = 0; i < 700; i++) {
      const a = rng.range(0, 6.28)
      const r = Math.sqrt(rng.next()) * 205
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const y = Math.max(0.4, this.heightAt(x, z))
      dummy.position.set(x, y + 0.22, z)
      dummy.scale.setScalar(rng.range(0.7, 1.5))
      dummy.rotation.set(rng.range(-0.12, 0.12), rng.range(0, 6.28), rng.range(-0.12, 0.12))
      dummy.updateMatrix()
      grass.setMatrixAt(i, dummy.matrix)
      col.setHex(0x79b95c).offsetHSL(rng.range(-0.02, 0.02), 0, rng.range(-0.05, 0.05))
      grass.setColorAt(i, col)
    }
    grass.receiveShadow = true
    this.group.add(grass)

    // POI sign posts
    this.signs = []
    for (const p of POIS) {
      const sx = p.x + p.r * 0.1
      const sz = p.z + p.r + 1
      const sy = this.heightAt(sx, sz)
      const sign = makeSign(p.name)
      sign.position.set(sx, sy + 2.1, sz)
      sign.rotation.y = Math.atan2(-sx, -sz)
      this.signs.push(sign)
    }
  }

  /* ------------------------------------------------------------------ chests */
  _buildChests() {
    const rng = makeRng(7171)
    const spots = [...this.chestSpots]
    // outdoor chests
    for (const p of POIS) {
      for (let i = 0; i < 2; i++) {
        const a = rng.range(0, 6.28)
        const r = p.r * rng.range(0.25, 0.7)
        const x = p.x + Math.cos(a) * r
        const z = p.z + Math.sin(a) * r
        spots.push({ x, z, y: this.heightAt(x, z) + 0.1 })
      }
    }
    const glowTex = makeGlowTexture()
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xdca72e, roughness: 0.35, metalness: 0.65, emissive: 0x533000, emissiveIntensity: 0.6 })
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x4b3520, roughness: 0.6, metalness: 0.4 })
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffcf5a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    for (const s of spots) {
      const group = new THREE.Group()
      group.position.set(s.x, s.y, s.z)
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.65), baseMat)
      base.position.y = 0.3
      base.castShadow = true
      group.add(base)
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.1, 0.72), trimMat)
      trim.position.y = 0.53
      group.add(trim)
      const lid = new THREE.Group()
      lid.position.set(0, 0.58, -0.3)
      const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.2, 0.62), baseMat)
      lidMesh.position.set(0, 0.08, 0.3)
      lidMesh.castShadow = true
      lid.add(lidMesh)
      const lidTrim = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.66), trimMat)
      lidTrim.position.set(0, 0.2, 0.3)
      lid.add(lidTrim)
      group.add(lid)
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.08), trimMat)
      lock.position.set(0, 0.35, 0.34)
      group.add(lock)
      const glow = new THREE.Sprite(glowMat)
      glow.scale.set(3.2, 3.2, 1)
      glow.position.y = 0.9
      group.add(glow)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.75, 0.95, 24),
        new THREE.MeshBasicMaterial({ color: 0xffd15c, transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.06
      group.add(ring)
      this.group.add(group)
      this.chests.push({ group, lid, glow, ring, opened: false, openT: 0, phase: rng.range(0, 6.28), x: s.x, y: s.y, z: s.z })
    }
  }

  /* --------------------------------------------------------------------- bus */
  _buildBus() {
    const bus = new THREE.Group()
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3b7dd8, roughness: 0.45, metalness: 0.4 })
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe7ff, roughness: 0.15, metalness: 0.5 })
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xffcc3d, roughness: 0.5 })
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.1, 6.4), bodyMat)
    bus.add(body)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.3, 6.5), accentMat)
    roof.position.y = 1.2
    bus.add(roof)
    for (let i = -2; i <= 2; i++) {
      for (const side of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.65, 0.8), glassMat)
        w.position.set(side * 1.53, 0.35, i * 1.15)
        bus.add(w)
      }
    }
    for (const i of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.35, 10), new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.9 }))
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(0, -1.15, i * 2)
      bus.add(wheel)
    }
    const balloon = new THREE.Mesh(
      new THREE.SphereGeometry(4.6, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xff8c42, roughness: 0.6, flatShading: false }),
    )
    balloon.position.y = 9.2
    balloon.scale.y = 1.15
    bus.add(balloon)
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(4.62, 0.2, 6, 24), accentMat)
    stripe.rotation.x = Math.PI / 2
    stripe.position.y = 9.2
    stripe.scale.y = 1.1
    bus.add(stripe)
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 4.2, 4), trimLineMat())
      rope.position.set(x * 0.75, 6.8, z * 0.75)
      rope.rotation.z = x > 0 ? 0.35 : -0.35
      rope.rotation.x = z > 0 ? -0.2 : 0.2
      bus.add(rope)
    }
    bus.position.set(-120, 98, -55)
    bus.scale.setScalar(1.35)
    bus.traverse((o) => { if (o.isMesh) o.castShadow = true })
    this.bus = bus
    this.group.add(bus)
  }

  _buildClouds() {
    const geo = new THREE.IcosahedronGeometry(1, 1)
    const mat = new THREE.MeshStandardMaterial({ color: 0xfff1df, roughness: 1, transparent: true, opacity: 0.92 })
    const count = 46
    const mesh = new THREE.InstancedMesh(geo, mat, count)
    const rng = makeRng(3300)
    this.cloudData = []
    const dummy = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, 6.28)
      const r = rng.range(40, 480)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const y = rng.range(90, 140)
      const s = rng.range(7, 22)
      const d = { x, y, z, sx: s * rng.range(0.8, 1.5), sy: s * rng.range(0.3, 0.55), sz: s * rng.range(0.8, 1.4), speed: rng.range(0.3, 0.9) }
      this.cloudData.push(d)
      dummy.position.set(x, y, z)
      dummy.scale.set(d.sx, d.sy, d.sz)
      dummy.rotation.set(rng.range(-0.2, 0.2), rng.range(0, 6.28), rng.range(-0.2, 0.2))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.castShadow = false
    mesh.frustumCulled = false
    this.group.add(mesh)
    this.cloudMesh = mesh
  }

  /* ---------------------------------------------------------------- queries */
  addCollider(minX, maxX, minZ, maxZ, minY, maxY, extra = {}) {
    const c = { minX, maxX, minZ, maxZ, minY, maxY, ...extra }
    this.colliders.push(c)
    return c
  }

  resolveCircle(pos, radius, feetY, height = 1.75) {
    for (let iter = 0; iter < 2; iter++) {
      for (const c of this.colliders) {
        if (c.maxY - feetY <= 0.6) continue
        if (c.minY >= feetY + height) continue
        if (c.disabled) continue
        const nx = clamp(pos.x, c.minX, c.maxX)
        const nz = clamp(pos.z, c.minZ, c.maxZ)
        let dx = pos.x - nx
        let dz = pos.z - nz
        const d2 = dx * dx + dz * dz
        if (d2 > radius * radius) continue
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2)
          const push = radius - d
          pos.x += (dx / d) * push
          pos.z += (dz / d) * push
        } else {
          const left = pos.x - c.minX
          const right = c.maxX - pos.x
          const back = pos.z - c.minZ
          const front = c.maxZ - pos.z
          const m = Math.min(left, right, back, front)
          if (m === left) pos.x = c.minX - radius
          else if (m === right) pos.x = c.maxX + radius
          else if (m === back) pos.z = c.minZ - radius
          else pos.z = c.maxZ + radius
        }
      }
    }
  }

  supportAt(x, z, feetY, radius = 0.4) {
    let s = this.heightAt(x, z)
    if (s < 0.35) s = 0.35
    for (const c of this.colliders) {
      if (c.disabled || c.tree) continue
      if (c.maxY > feetY + 0.62 || c.maxY < s) continue
      const nx = clamp(x, c.minX, c.maxX)
      const nz = clamp(z, c.minZ, c.maxZ)
      if ((x - nx) ** 2 + (z - nz) ** 2 <= radius * radius) s = c.maxY
    }
    return s
  }

  raycastWorld(origin, dir, maxDist) {
    this.raycaster.set(origin, dir)
    this.raycaster.far = maxDist
    const hits = this.raycaster.intersectObjects(this.solidMeshes, false)
    if (!hits.length) return null
    const hit = hits[0]
    return {
      dist: hit.distance,
      point: hit.point.clone(),
      object: hit.object,
      instanceId: hit.instanceId,
      build: hit.object.userData.build || null,
    }
  }

  terrainRay(origin, dir, maxDist) {
    let prev = origin.clone()
    const step = 2.2
    for (let t = 0; t <= maxDist; t += step) {
      const p = origin.clone().addScaledVector(dir, t)
      const h = this.heightAt(p.x, p.z)
      if (p.y <= h) {
        // refine
        const a = prev.clone()
        const b = p.clone()
        for (let i = 0; i < 5; i++) {
          const m = a.clone().lerp(b, 0.5)
          if (m.y <= this.heightAt(m.x, m.z)) b.copy(m)
          else a.copy(m)
        }
        return { dist: origin.distanceTo(b), point: b }
      }
      prev = p
    }
    return null
  }

  lineBlocked(a, b) {
    const dir = b.clone().sub(a)
    const dist = dir.length()
    dir.normalize()
    const hit = this.raycastWorld(a, dir, dist - 0.5)
    if (hit) return true
    const t = this.terrainRay(a, dir, dist)
    return Boolean(t && t.dist < dist - 0.5)
  }

  /* ------------------------------------------------------------------ builds */
  makeBuildMesh(type) {
    const group = new THREE.Group()
    if (type === 'ramp') {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 0.28, 4.3), this.buildMat)
      mesh.rotation.x = -Math.PI / 4
      mesh.position.set(0, 1.42, 0)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
      for (let i = 0; i < 5; i++) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 4.3), this.buildMat)
        rail.rotation.x = -Math.PI / 4
        rail.position.set(i === 0 ? -1.95 : i === 4 ? 1.95 : 0, 1.42, 0)
        if (i > 0 && i < 4) continue
        group.add(rail)
      }
    } else {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.22), this.buildMat)
      mesh.position.y = 1.5
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
      const top = new THREE.Mesh(new THREE.BoxGeometry(4.15, 0.16, 0.34), this.materials.woodDark)
      top.position.y = 3
      top.castShadow = true
      group.add(top)
      for (const x of [-1.9, 1.9]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3, 0.32), this.materials.woodDark)
        post.position.set(x, 1.5, 0)
        group.add(post)
      }
    }
    return group
  }

  makeGhost(type) {
    const group = new THREE.Group()
    if (type === 'ramp') {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 0.28, 4.3), this.ghostMat)
      mesh.rotation.x = -Math.PI / 4
      mesh.position.y = 1.42
      group.add(mesh)
    } else {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.22), this.ghostMat)
      mesh.position.y = 1.5
      group.add(mesh)
    }
    group.visible = false
    return group
  }

  buildPlacement(type, playerPos, yaw) {
    const snapped = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2)
    const fx = Math.sin(snapped)
    const fz = Math.cos(snapped)
    if (type === 'ramp') {
      const x = playerPos.x + fx * 2.0
      const z = playerPos.z + fz * 2.0
      return { x, z, y: playerPos.y, yaw: snapped, cost: 20 }
    }
    const x = playerPos.x + fx * 3.0
    const z = playerPos.z + fz * 3.0
    return { x, z, y: playerPos.y, yaw: snapped, cost: 10 }
  }

  placeBuild(type, placement) {
    const { x, y, z, yaw } = placement
    const group = this.makeBuildMesh(type)
    group.position.set(x, y, z)
    group.rotation.y = yaw
    group.scale.set(0.8, 0.8, 0.8)
    this.group.add(group)
    const cos = Math.abs(Math.cos(yaw)) > 0.5
    const halfW = 2.1
    const halfD = 0.22
    const hw = cos ? halfW : halfD
    const hd = cos ? halfD : halfW
    const build = { type, group, x, y, z, yaw, hp: 220, maxHp: 220, colliders: [], age: 0, dead: false }
    if (type === 'wall') {
      const c1 = this.addCollider(x - hw, x + hw, z - hd, z + hd, y, y + 3.1, { build })
      build.colliders.push(c1)
    } else {
      const fx = Math.sin(yaw)
      const fz = Math.cos(yaw)
      for (let i = 0; i < 6; i++) {
        const d = 0.35 + i * 0.62
        const cx = x + fx * (d - 2.0)
        const cz = z + fz * (d - 2.0)
        const top = y + (i + 1) * 0.5
        const c = this.addCollider(cx - 2, cx + 2, cz - 2, cz + 2, y, top, { build })
        build.colliders.push(c)
      }
    }
    this.builds.push(build)
    this.meshesForBuild = this.meshesForBuild || []
    group.traverse((o) => { if (o.isMesh) { o.userData.build = build; this.solidMeshes.push(o) } })
    if (this.builds.length > 70) {
      const old = this.builds.shift()
      this.removeBuild(old)
    }
    return build
  }

  damageBuild(build, amount) {
    if (build.dead) return false
    build.hp -= amount
    build.group.position.x += (Math.random() - 0.5) * 0.06
    build.group.position.z += (Math.random() - 0.5) * 0.06
    if (build.hp <= 0) {
      this.removeBuild(build)
      return true
    }
    return false
  }

  removeBuild(build) {
    if (!build || build.dead) return
    build.dead = true
    this.group.remove(build.group)
    for (const c of build.colliders) c.disabled = true
    this.solidMeshes = this.solidMeshes.filter((m) => !m.userData || m.userData.build !== build)
    build.group.traverse((o) => { if (o.isMesh) o.geometry?.dispose?.() })
  }

  resetBuilds() {
    for (const b of [...this.builds]) this.removeBuild(b)
    this.builds = []
  }

  /* ------------------------------------------------------------------ update */
  update(dt, playerPos) {
    this.time += dt
    this.waterMat.uniforms.uTime.value = this.time
    if (this.sky) this.sky.position.copy(this.cameraPos || new THREE.Vector3())
    if (this.fireLight) this.fireLight.intensity = 13 + Math.sin(this.time * 13) * 3 + Math.random() * 2
    // bus
    if (this.bus) {
      const t = (this.time * 8 + 180) % 900
      this.bus.position.x = -400 + t
      this.bus.position.z = -55 + Math.sin(this.time * 0.2) * 16
      this.bus.position.y = 98 + Math.sin(this.time * 0.5) * 2
      this.bus.rotation.y = Math.PI / 2
      this.bus.rotation.z = Math.sin(this.time * 0.7) * 0.02
    }
    // clouds
    if (this.cloudMesh) {
      const dummy = this._dummy || (this._dummy = new THREE.Object3D())
      for (let i = 0; i < this.cloudData.length; i++) {
        const c = this.cloudData[i]
        c.x += c.speed * dt
        if (c.x > 540) c.x = -540
        dummy.position.set(c.x, c.y, c.z)
        dummy.scale.set(c.sx, c.sy, c.sz)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        this.cloudMesh.setMatrixAt(i, dummy.matrix)
      }
      this.cloudMesh.instanceMatrix.needsUpdate = true
    }
    // chest idle
    for (const c of this.chests) {
      c.phase += dt
      c.group.position.y = c.y + Math.sin(c.phase * 2.4) * 0.04
      c.ring.rotation.z += dt * 0.8
      c.ring.scale.setScalar(1 + Math.sin(c.phase * 3) * 0.06)
      if (!c.opened) {
        c.glow.material.opacity = 0.45 + Math.sin(c.phase * 3.4) * 0.12
        c.lid.rotation.x = Math.sin(c.phase * 1.6) * 0.016
      } else {
        c.openT = Math.min(1, c.openT + dt * 5)
        c.lid.rotation.x = -1.85 * easeOutBack(c.openT)
        c.glow.material.opacity = Math.max(0, 0.55 * (1 - c.openT))
        c.ring.material.opacity = Math.max(0, 0.55 * (1 - c.openT))
      }
    }
    for (const b of this.builds) {
      b.age += dt
      if (b.age < 0.18) {
        const s = 0.8 + easeOutBack(b.age / 0.18) * 0.2
        b.group.scale.setScalar(s)
      }
    }
    this.storm.update(dt, this.time)
  }

  reset() {
    this.resetBuilds()
    for (const c of this.chests) {
      c.opened = false
      c.openT = 0
      c.lid.rotation.x = 0
      c.glow.material.opacity = 0.55
      c.ring.material.opacity = 0.55
    }
    this.storm.reset()
  }

  openChest(chest) {
    if (chest.opened) return false
    chest.opened = true
    chest.openT = 0
    return true
  }
}

/* ---------------------------------------------------------------------- storm */
export class Storm {
  constructor(scene) {
    this.group = new THREE.Group()
    scene.add(this.group)
    const geo = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true)
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.85 } },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPos;
        void main() {
          vUv = uv;
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float uTime, uOpacity;
        varying vec2 vUv;
        varying vec3 vPos;
        void main() {
          float bands = sin(vUv.y * 54.0 + uTime * 2.3 + sin(vUv.x * 38.0 + uTime * 0.8) * 2.0) * 0.5 + 0.5;
          float bands2 = sin(vUv.y * 19.0 - uTime * 1.4 + vUv.x * 27.0) * 0.5 + 0.5;
          float vertical = smoothstep(0.0, 0.1, vUv.y) * (1.0 - smoothstep(0.78, 1.0, vUv.y));
          vec3 col = mix(vec3(0.32, 0.08, 0.72), vec3(0.28, 0.75, 1.0), bands2 * 0.55);
          float a = (0.10 + bands * 0.10 + bands2 * 0.06) * vertical * uOpacity;
          gl_FragColor = vec4(col, a);
        }`,
    })
    this.wall = new THREE.Mesh(geo, this.mat)
    this.wall.position.y = 42
    this.wall.frustumCulled = false
    this.group.add(this.wall)
    this.reset()
  }

  reset() {
    this.phases = []
    let center = new THREE.Vector2(0, 0)
    let radius = 235
    const radii = [165, 112, 73, 45, 24, 9]
    const waits = [26, 22, 19, 17, 15, 14]
    const shrinks = [24, 22, 19, 17, 15, 18]
    const rng = makeRng(4242)
    for (let i = 0; i < radii.length; i++) {
      const maxShift = Math.max(0, radius - radii[i] - 14)
      const a = rng.range(0, Math.PI * 2)
      const d = maxShift * rng.range(0.25, 0.85)
      const c = new THREE.Vector2(center.x + Math.cos(a) * d, center.y + Math.sin(a) * d)
      this.phases.push({ center: c, radius: radii[i], wait: waits[i], shrink: shrinks[i] })
      center = c
      radius = radii[i]
    }
    this.radius = 235
    this.center = new THREE.Vector2(0, 0)
    this.index = 0
    this.phase = 'wait'
    this.timer = this.phases[0].wait + 8
    this.shrinkT = 0
    this.fromRadius = this.radius
    this.fromCenter = this.center.clone()
    this.active = true
    this.damage = 1
    this.totalPhases = this.phases.length
  }

  update(dt, time) {
    this.mat.uniforms.uTime.value = time
    if (!this.active) return
    this.timer -= dt
    if (this.phase === 'wait') {
      if (this.timer <= 0) {
        this.phase = 'shrink'
        this.timer = this.phases[this.index].shrink
        this.shrinkT = 0
        this.fromRadius = this.radius
        this.fromCenter = this.center.clone()
      }
    } else if (this.phase === 'shrink') {
      const target = this.phases[this.index]
      this.shrinkT = clamp(1 - this.timer / target.shrink, 0, 1)
      const e = smoothstep(0, 1, this.shrinkT)
      this.radius = lerp(this.fromRadius, target.radius, e)
      this.center.set(
        lerp(this.fromCenter.x, target.center.x, e),
        lerp(this.fromCenter.y, target.center.y, e),
      )
      if (this.timer <= 0) {
        this.radius = target.radius
        this.center.copy(target.center)
        this.index++
        this.damage = 1 + this.index * 1.6
        if (this.index >= this.phases.length) {
          this.phase = 'final'
          this.timer = 9999
          this.radius = this.phases[this.phases.length - 1].radius
        } else {
          this.phase = 'wait'
          this.timer = this.phases[this.index].wait
        }
      }
    }
    this.wall.position.set(this.center.x, 42, this.center.y)
    this.wall.scale.set(Math.max(0.01, this.radius), 84, Math.max(0.01, this.radius))
  }

  get nextCircle() {
    if (this.phase === 'final') return null
    const target = this.phases[Math.min(this.index, this.phases.length - 1)]
    return { x: target.center.x, z: target.center.y, r: target.radius }
  }

  outside(x, z, pad = 0) {
    return Math.hypot(x - this.center.x, z - this.center.y) > this.radius - pad
  }

  get label() {
    if (this.phase === 'final') return 'FINAL CIRCLE'
    if (this.phase === 'shrink') return 'STORM CLOSING'
    return 'STORM IN'
  }

  get countdown() {
    return Math.max(0, this.timer)
  }
}

/* --------------------------------------------------------------------- layout */
class Layout {
  constructor(world) {
    this.world = world
    this.collections = new Map()
    this.meshes = []
    this.dummy = new THREE.Object3D()
  }

  _add(kind, key, x, y, z, sx, sy, sz, ry, rx = 0, rz = 0) {
    if (!this.collections.has(kind + key)) this.collections.set(kind + key, { kind, key, items: [] })
    this.collections.get(kind + key).items.push({ x, y, z, sx, sy, sz, ry, rx, rz })
  }

  box(key, x, y, z, sx, sy, sz, ry = 0, collide = true, rx = 0, rz = 0) {
    this._add('box', key, x, y, z, sx, sy, sz, ry, rx, rz)
    if (collide) {
      const cos = Math.cos(ry)
      const sin = Math.sin(ry)
      // axis-aligned extents of a rotated box
      const ex = Math.abs(sx * cos) + Math.abs(sz * sin)
      const ez = Math.abs(sx * sin) + Math.abs(sz * cos)
      this.world.addCollider(x - ex / 2, x + ex / 2, z - ez / 2, z + ez / 2, y - sy / 2, y + sy / 2)
    }
  }

  cylinder(key, x, y, z, radius, height, collide = true, rot = 0) {
    this._add('cyl', key, x, y, z, radius * 2, height, radius * 2, rot)
    if (collide) {
      this.world.addCollider(x - radius, x + radius, z - radius, z + radius, y - height / 2, y + height / 2)
    }
  }

  cone(key, x, y, z, diameter, height, segments = 4, ry = 0, collide = false) {
    this._add('cone' + segments, key, x, y, z, diameter, height, diameter, ry)
    if (collide) {
      const r = diameter * 0.36
      this.world.addCollider(x - r, x + r, z - r, z + r, y - height / 2, y + height / 2)
    }
  }

  finish(scene) {
    for (const { kind, key, items } of this.collections.values()) {
      let geo
      if (kind === 'box') geo = new THREE.BoxGeometry(1, 1, 1)
      else if (kind === 'cyl') geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12)
      else geo = new THREE.ConeGeometry(0.5, 1, parseInt(kind.slice(4), 10) || 4)
      const mat = this.world.materials[key] || new THREE.MeshStandardMaterial({ color: 0xff00ff })
      const mesh = new THREE.InstancedMesh(geo, mat, items.length)
      const cast = !['path', 'soil', 'crop'].includes(key)
      mesh.castShadow = cast
      mesh.receiveShadow = true
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        this.dummy.position.set(it.x, it.y, it.z)
        this.dummy.rotation.set(it.rx, it.ry, it.rz)
        this.dummy.scale.set(it.sx, it.sy, it.sz)
        this.dummy.updateMatrix()
        mesh.setMatrixAt(i, this.dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
      scene.add(mesh)
      this.meshes.push(mesh)
    }
  }
}

/* ------------------------------------------------------------------- helpers */
function makePlankTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#a97545'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 8; i++) {
    const w = 32
    const x = i * w
    const shade = 0.82 + Math.random() * 0.25
    g.fillStyle = `rgb(${Math.floor(169 * shade)}, ${Math.floor(117 * shade)}, ${Math.floor(69 * shade)})`
    g.fillRect(x + 2, 0, w - 4, 256)
    g.strokeStyle = 'rgba(70,40,20,.55)'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(x + 1, 0)
    g.lineTo(x + 1, 256)
    g.stroke()
    for (let k = 0; k < 5; k++) {
      g.strokeStyle = `rgba(90,55,30,${0.1 + Math.random() * 0.12})`
      g.lineWidth = 1
      g.beginPath()
      const yy = Math.random() * 256
      g.moveTo(x + 4, yy)
      g.bezierCurveTo(x + 12, yy + 8, x + 22, yy - 6, x + w - 4, yy + 3)
      g.stroke()
    }
    g.fillStyle = '#4c3220'
    g.beginPath()
    g.arc(x + 7, 20, 2.5, 0, 6.3)
    g.fill()
    g.beginPath()
    g.arc(x + 25, 236, 2.5, 0, 6.3)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2, 2)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeGlowTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,220,130,.75)')
  grad.addColorStop(1, 'rgba(255,180,40,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

function makeSign(text) {
  const group = new THREE.Group()
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 160
  const g = c.getContext('2d')
  g.font = '700 64px Outfit, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#45301c'
  g.fillRect(0, 0, 512, 160)
  g.strokeStyle = '#d8b06a'
  g.lineWidth = 10
  g.strokeRect(8, 8, 496, 144)
  g.fillStyle = '#ffe9bb'
  g.fillText(text.toUpperCase(), 256, 84)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const board = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.35, 0.18), [
    new THREE.MeshStandardMaterial({ color: 0x4d3520, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x4d3520, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x4d3520, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x4d3520, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x4d3520, roughness: 0.9 }),
  ])
  board.castShadow = true
  group.add(board)
  const postMat = new THREE.MeshStandardMaterial({ color: 0x5b3c22, roughness: 0.95 })
  for (const x of [-1.6, 1.6]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.2, 6), postMat)
    post.position.set(x, -1.2, 0)
    post.castShadow = true
    group.add(post)
  }
  return group
}

function trimLineMat() {
  if (!trimLineMat.mat) trimLineMat.mat = new THREE.MeshStandardMaterial({ color: 0xcfd8e2, roughness: 0.8 })
  return trimLineMat.mat
}

function easeOutBack(t) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
