// The run: three lanes of a stream, things coming down them, and what happens
// when they reach the surfer. Pure, so a run can be played without a screen.
export type Kind = 'token' | 'low' | 'high' | 'wall' | 'magnet' | 'double' | 'fast' | 'shield'
export type Action = 'left' | 'right' | 'jump' | 'duck'

export type Thing = { id: number; kind: Kind; lane: number; z: number; lift: number }
export type Pop = { z: number; lane: number; lift: number; age: number; isBig: boolean }

export type Run = {
  phase: 'play' | 'over'
  rng: number
  // Milliseconds played, and how far the stream has carried the surfer.
  t: number
  dist: number
  speed: number
  // The lane aimed for (-1, 0, 1) and where the surfer is on the way there.
  lane: number
  x: number
  // Milliseconds into a jump or a duck, 0 when neither.
  air: number
  duck: number
  jumpQueued: number
  score: number
  tokens: number
  magnet: number
  double: number
  fast: number
  shield: boolean
  // Untouchable for this long, after a hit was absorbed or a dash ended.
  blink: number
  // What has just been touched, and how long there is left to get out of it.
  grace: { thing: Thing; left: number } | null
  things: Thing[]
  pops: Pop[]
  nextId: number
  nextRow: number
  nextPower: number
  crash: Kind | null
}

// How far ahead things exist.
export const FAR = 92
export const JUMP_MS = 680
export const DUCK_MS = 620
export const JUMP_HEIGHT = 2.8
// Clearing a low barrier takes this much height.
export const LOW_CLEAR = 0.5
export const MAGNET_MS = 8000
export const DOUBLE_MS = 8000
export const FAST_MS = 4000
export const BLINK_MS = 1200
// How long after touching something a jump, a duck or a dodge still counts: a
// key takes a moment to get here, and a person is allowed to be a moment late.
export const GRACE_MS = 160

const SPEED_START = 19
const SPEED_MAX = 46
const SPEED_RAMP_S = 95
const FAST_FACTOR = 1.6
// Lanes crossed a second, on the way to the one aimed for.
const LANE_RATE = 9
const JUMP_BUFFER_MS = 130
const MAGNET_REACH = 16
const SMASH_POINTS = 25

export const speedAt = (t: number) => SPEED_START + (SPEED_MAX - SPEED_START) * Math.min(1, t / 1000 / SPEED_RAMP_S)
export const isObstacle = (kind: Kind) => kind === 'low' || kind === 'high' || kind === 'wall'
export const heightOf = (air: number) => {
  if (air <= 0) return 0
  const p = Math.min(1, air / JUMP_MS)
  return 4 * JUMP_HEIGHT * p * (1 - p)
}

// One number from the run's generator (mulberry32).
function rand(r: Run) {
  r.rng = (r.rng + 0x6d2b79f5) | 0
  let t = r.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const pick = <T>(r: Run, list: readonly T[]) => list[Math.floor(rand(r) * list.length)]!

type Cell = '' | 'low' | 'high' | 'wall'
const EASY: Cell[][] = [
  ['wall', '', ''],
  ['low', '', ''],
  ['high', '', ''],
  ['low', '', 'low'],
  ['wall', '', 'high'],
]
const MEDIUM: Cell[][] = [
  ['wall', 'wall', ''],
  ['low', 'low', 'low'],
  ['high', 'high', 'high'],
  ['wall', 'low', ''],
]
// Every lane holds something, and at least one of them can be passed.
const HARD: Cell[][] = [
  ['wall', 'wall', 'low'],
  ['wall', 'wall', 'high'],
  ['low', 'high', 'wall'],
  ['wall', 'low', 'wall'],
]
const POWERS: Kind[] = ['magnet', 'double', 'fast', 'shield']

function shuffled<T>(r: Run, list: readonly T[]) {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand(r) * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

function add(r: Run, kind: Kind, lane: number, z: number, lift = 0) {
  r.things.push({ id: r.nextId++, kind, lane, z, lift })
}

// A row of obstacles, the tokens that go with it, and the gap to the next.
function spawnRow(r: Run) {
  const z = r.nextRow
  const seconds = r.t / 1000
  const difficulty = Math.min(1, seconds / 70)
  const roll = rand(r)
  const pool = roll < 0.75 - 0.6 * difficulty ? EASY : roll < 0.95 - 0.3 * difficulty ? MEDIUM : HARD
  const row = shuffled(r, pick(r, pool))
  row.forEach((cell, i) => {
    if (cell) add(r, cell, i - 1, z)
  })

  const gapSeconds = Math.max(0.66, 1.12 - seconds * 0.004)
  const gap = Math.max(14, r.speed * gapSeconds)

  // Tokens: an arc over a low barrier, or a trail down a lane in the gap.
  const lowLane = row.indexOf('low')
  if (lowLane >= 0 && rand(r) < 0.5) {
    for (let o = -2; o <= 2; o++) add(r, 'token', lowLane - 1, z + o * 1.8, 2.3 * (1 - (o / 3) ** 2))
  } else if (rand(r) < 0.85) {
    const lane = Math.floor(rand(r) * 3) - 1
    const count = Math.min(7, Math.floor((gap - 6) / 3))
    for (let i = 0; i < count; i++) add(r, 'token', lane, z + 4 + i * 3, 0.4)
  }

  if (z >= r.nextPower) {
    add(r, pick(r, POWERS), Math.floor(rand(r) * 3) - 1, z + gap / 2, 0.6)
    r.nextPower = z + 240 + rand(r) * 160
  }

  r.nextRow = z + gap
}

export function newRun(seed: number): Run {
  const r: Run = {
    phase: 'play',
    rng: seed | 0,
    t: 0,
    dist: 0,
    speed: SPEED_START,
    lane: 0,
    x: 0,
    air: 0,
    duck: 0,
    jumpQueued: 0,
    score: 0,
    tokens: 0,
    magnet: 0,
    double: 0,
    fast: 0,
    shield: false,
    blink: 0,
    grace: null,
    things: [],
    pops: [],
    nextId: 1,
    nextRow: 36,
    nextPower: 150,
    crash: null,
  }
  while (r.nextRow < r.dist + FAR) spawnRow(r)
  return r
}

export function act(prev: Run, action: Action): Run {
  if (prev.phase !== 'play') return prev
  switch (action) {
    case 'left':
      return { ...prev, lane: Math.max(-1, prev.lane - 1) }
    case 'right':
      return { ...prev, lane: Math.min(1, prev.lane + 1) }
    case 'jump':
      if (prev.air > 0) return { ...prev, jumpQueued: JUMP_BUFFER_MS }
      return { ...prev, air: 1, duck: 0 }
    case 'duck':
      // In the air it drops straight down and ducks on landing.
      return { ...prev, air: prev.air > 0 ? Math.max(prev.air, JUMP_MS - 60) : 0, duck: 1, jumpQueued: 0 }
  }
}

function bump(r: Run, thing: Thing) {
  r.pops.push({ z: thing.z, lane: thing.lane, lift: thing.lift + 1, age: 0, isBig: true })
}

function collect(r: Run, thing: Thing) {
  if (thing.kind === 'token') {
    r.tokens += 1
    r.score += r.double > 0 ? 20 : 10
    r.pops.push({ z: thing.z, lane: thing.lane, lift: thing.lift, age: 0, isBig: false })
    return
  }
  bump(r, thing)
  if (thing.kind === 'magnet') r.magnet = MAGNET_MS
  if (thing.kind === 'double') r.double = DOUBLE_MS
  if (thing.kind === 'fast') r.fast = FAST_MS
  if (thing.kind === 'shield') r.shield = true
}

// Whether a thing that has just reached the surfer's plane touches them.
function touches(thing: Thing, x: number, y: number, isDucking: boolean) {
  if (Math.abs(thing.lane - x) >= 0.62) return false
  switch (thing.kind) {
    case 'low':
      return y < LOW_CLEAR
    case 'high':
      return !isDucking
    case 'wall':
      return true
    default:
      return Math.abs(thing.lift - 0.4 - y) < 1.3
  }
}

// A touch nothing got the surfer out of: a checkpoint takes it, or the run ends.
function strike(r: Run, thing: Thing) {
  if (r.shield) {
    r.shield = false
    r.blink = BLINK_MS
    bump(r, thing)
    r.things = r.things.filter(t => t.id !== thing.id)
    return
  }
  r.phase = 'over'
  r.crash = thing.kind
}

export function step(prev: Run, dtMs: number): Run {
  if (prev.phase !== 'play') return prev
  const dt = Math.min(dtMs, 120)
  const r: Run = { ...prev, things: prev.things.slice(), pops: prev.pops.map(p => ({ ...p, age: p.age + dt })).filter(p => p.age < 420) }

  r.t += dt
  r.magnet = Math.max(0, r.magnet - dt)
  r.double = Math.max(0, r.double - dt)
  r.blink = Math.max(0, r.blink - dt)
  r.jumpQueued = Math.max(0, r.jumpQueued - dt)
  if (r.fast > 0) {
    r.fast = Math.max(0, r.fast - dt)
    if (r.fast === 0) r.blink = Math.max(r.blink, BLINK_MS)
  }
  r.speed = speedAt(r.t) * (r.fast > 0 ? FAST_FACTOR : 1)

  const move = (LANE_RATE * dt) / 1000
  r.x = r.x < r.lane ? Math.min(r.lane, r.x + move) : Math.max(r.lane, r.x - move)

  if (r.air > 0) {
    r.air += dt
    if (r.air >= JUMP_MS) {
      r.air = r.jumpQueued > 0 && r.duck === 0 ? 1 : 0
      r.jumpQueued = 0
    }
  }
  if (r.duck > 0 && r.air === 0) {
    r.duck += dt
    if (r.duck >= DUCK_MS) r.duck = 0
  }

  const before = r.dist
  r.dist += (r.speed * dt) / 1000
  const y = heightOf(r.air)
  const isDucking = r.duck > 0 && r.air === 0

  if (r.magnet > 0) {
    const pull = Math.min(1, dt * 0.012)
    r.things = r.things.map(t =>
      t.kind === 'token' && t.z > r.dist && t.z < r.dist + MAGNET_REACH
        ? { ...t, lane: t.lane + (r.x - t.lane) * pull, lift: t.lift + (y + 0.4 - t.lift) * pull }
        : t,
    )
  }

  const kept: Thing[] = []
  for (const thing of r.things) {
    if (thing.z <= before || thing.z > r.dist) {
      if (thing.z > r.dist - 4) kept.push(thing)
      continue
    }
    if (!touches(thing, r.x, y, isDucking)) {
      kept.push(thing)
      continue
    }
    if (!isObstacle(thing.kind)) {
      collect(r, thing)
      continue
    }
    if (r.fast > 0) {
      r.score += SMASH_POINTS
      bump(r, thing)
      continue
    }
    if (r.blink > 0) {
      kept.push(thing)
      continue
    }
    if (!r.grace) r.grace = { thing, left: GRACE_MS }
    kept.push(thing)
  }
  r.things = kept

  if (r.grace) {
    const left = r.grace.left - dt
    if (r.fast > 0 || !touches(r.grace.thing, r.x, y, isDucking)) r.grace = null
    else if (left > 0) r.grace = { thing: r.grace.thing, left }
    else {
      const { thing } = r.grace
      r.grace = null
      strike(r, thing)
    }
  }

  r.score += (r.dist - before) * (r.double > 0 ? 2 : 1)

  while (r.nextRow < r.dist + FAR) spawnRow(r)
  return r
}
