export const TAU = Math.PI * 2

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const invLerp = (a, b, v) => (v - a) / (b - a)
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a)
export const randInt = (a, b) => Math.floor(rand(a, b + 1))
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz)
export const angleDelta = (a, b) => {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}
export const dampAngle = (a, b, lambda, dt) => a + angleDelta(a, b) * (1 - Math.exp(-lambda * dt))
export const fmtTime = (s) => {
  s = Math.max(0, Math.ceil(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeRng(seed) {
  const r = mulberry32(seed)
  return {
    next: r,
    range: (a, b) => a + r() * (b - a),
    int: (a, b) => Math.floor(a + r() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    chance: (p) => r() < p,
    sign: () => (r() < 0.5 ? -1 : 1),
  }
}

export const BOT_NAMES = [
  'NovaKit', 'BrickLord', 'PixelPine', 'TurboTaco', 'GlitchWitch',
  'SirBuildsALot', 'MoonMuffin', 'ThunderThumb', 'CloudCrasher', 'SneakySquid',
  'RiffRaff', 'BoltBunny', 'TangoFox', 'MossBoss', 'EchoEcho', 'FizzBuzz',
]

export const KILL_VERBS = ['eliminated', 'wiped out', 'outlasted', 'sent home']

export const BOT_COLORS = [
  { jacket: 0xef5b5b, pants: 0x243049, hat: 0xffd166, skin: 0xf1c27d, pack: 0x2a9d8f },
  { jacket: 0x4ea8de, pants: 0x1d2b43, hat: 0xffffff, skin: 0xc68642, pack: 0xffb703 },
  { jacket: 0x8ac926, pants: 0x2b2d42, hat: 0xff595e, skin: 0xf1c27d, pack: 0x3a86ff },
  { jacket: 0x9b5de5, pants: 0x22223b, hat: 0xfee440, skin: 0x8d5524, pack: 0x00bbf9 },
  { jacket: 0xf15bb5, pants: 0x14213d, hat: 0xffffff, skin: 0xe0ac69, pack: 0xfca311 },
  { jacket: 0xff9f1c, pants: 0x293241, hat: 0x3d5a80, skin: 0xf1c27d, pack: 0x98c1d9 },
  { jacket: 0x2ec4b6, pants: 0x011627, hat: 0xff3366, skin: 0xc68642, pack: 0xfdfffc },
]

export const PLAYER_COLORS = {
  jacket: 0x17b7a4, pants: 0x17233c, hat: 0xffb830, skin: 0xe8b47b, pack: 0xf25c54,
}
