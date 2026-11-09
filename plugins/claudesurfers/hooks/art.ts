// Everything drawn: one picture of the stream per frame, in a view 240 by 300
// that is scaled to the pane, and the small pictures of the menus.
import { BLINK_MS, FAR, heightOf, isObstacle } from './game'
import type { Kind, Run, Thing } from './game'
import { textPath, textWidth } from './pixel'
import { skinOf } from './skins'
import type { Skin } from './skins'

export const VIEW_W = 240
export const VIEW_H = 300
const HORIZON = 92
const GROUND = 250
const LANE = 54
// Screen pixels of one unit of height, at the surfer's distance.
const UNIT = 20
const DEPTH = 6
const NEAREST = -1.45
const CX = VIEW_W / 2
const SUN_X = 176

// What a pane of a given size shows: the same world, with more beach beside
// it where the pane is wide and more sky above it where it is tall. The desktop
// needs a picture's size in pixels but lays the pane out in cells of a size it
// does not say: the width is asked too large and held to the pane by the page,
// the height is worked out from a row's height and the picture sits on the
// pane's floor, so if a row is taller the room left over is more of the sky.
export const PICTURE_W = 3000
const CELL_W = 7.5
const CELL_H = 19

export type View = { w: number; h: number; left: number; top: number; ratio: number; markupW: number; markupH: number; columns: number; rows: number }

export function viewFor(columns: number, rows: number): View {
  const cols = columns > 0 ? columns : 60
  const px = cols * CELL_W
  const lines = rows > 0 ? rows : Math.ceil((px * VIEW_H) / VIEW_W / CELL_H)
  const aspect = px / (lines * CELL_H)
  const isWide = aspect >= VIEW_W / VIEW_H
  const w = Math.round((isWide ? VIEW_H * aspect : VIEW_W) * 10) / 10
  const h = Math.round((isWide ? VIEW_H : VIEW_W / aspect) * 10) / 10
  const markupW = Math.ceil(px)
  const markupH = Math.ceil(lines * CELL_H)
  return { w, h, left: (VIEW_W - w) / 2, top: VIEW_H - h, ratio: px / w, markupW, markupH, columns: cols, rows: lines }
}

const sOf = (z: number) => DEPTH / (DEPTH + z)
const n = (v: number) => Math.round(v * 10) / 10
const fine = (v: number) => Math.round(v * 1000) / 1000
const screenY = (s: number) => HORIZON + (GROUND - HORIZON) * s

// ---- colours ----

type Theme = { skyTop: string; skyLow: string; sun: string; duneFar: string; duneNear: string; ground: string; trackA: string; trackB: string; edge: string; lane: string; tick: string }

const THEMES: readonly Theme[] = [
  { skyTop: '#FAF5EC', skyLow: '#F4DCBE', sun: '#E8916F', duneFar: '#E6CBA9', duneNear: '#D7B28B', ground: '#EAD4B7', trackA: '#FBF4E8', trackB: '#F2E6D3', edge: '#D97757', lane: '#CDB79B', tick: '#D9C7AC' },
  { skyTop: '#7E4436', skyLow: '#EFA079', sun: '#FDE7C0', duneFar: '#A8573F', duneNear: '#7D3F30', ground: '#6E3A2C', trackA: '#96553F', trackB: '#874A37', edge: '#F4C08E', lane: '#C07F64', tick: '#A9654D' },
  { skyTop: '#121211', skyLow: '#302922', sun: '#D97757', duneFar: '#2C2823', duneNear: '#201D19', ground: '#1A1815', trackA: '#2A2621', trackB: '#22201B', edge: '#D97757', lane: '#4A433A', tick: '#3B362E' },
]
const THEME_LENGTH = 1400
const THEME_BLEND = 0.08

function mix(a: string, b: string, f: number) {
  if (f <= 0) return a
  const part = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16)
  const at = (i: number) => Math.round(part(a, i) + (part(b, i) - part(a, i)) * f).toString(16).padStart(2, '0')
  return `#${at(1)}${at(3)}${at(5)}`
}

function themeAt(dist: number): Theme {
  const place = dist / THEME_LENGTH
  const index = Math.floor(place)
  const into = place - index
  const from = THEMES[index % THEMES.length]!
  const to = THEMES[(index + 1) % THEMES.length]!
  const f = into > 1 - THEME_BLEND ? (into - (1 - THEME_BLEND)) / THEME_BLEND : 0
  const out = {} as Theme
  for (const key of Object.keys(from) as (keyof Theme)[]) out[key] = mix(from[key], to[key], f)
  return out
}

// 0..1 goes darker, above 1 towards white.
function shade(hex: string, f: number) {
  return f <= 1 ? mix(hex, '#000000', 1 - f) : mix(hex, '#ffffff', f - 1)
}

const brightness = (hex: string) => (parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16)) / 3

const rect = (x: number, y: number, w: number, tall: number, fill: string) => `<rect x='${x}' y='${y}' width='${w}' height='${tall}' fill='${fill}'/>`

// A plate with its corners bitten off, the shape of every panel and button.
function platePath(x: number, y: number, w: number, tall: number, notch = 2) {
  return `M${fine(x + notch)} ${fine(y)}h${fine(w - 2 * notch)}v${notch}h${notch}v${fine(tall - 2 * notch)}h${-notch}v${notch}h${fine(2 * notch - w)}v${-notch}h${-notch}v${fine(2 * notch - tall)}h${notch}z`
}

const plate = (x: number, y: number, w: number, tall: number, fill: string, opacity = 1, notch = 2) => `<path fill='${fill}'${opacity < 1 ? ` opacity='${opacity}'` : ''} d='${platePath(x, y, w, tall, notch)}'/>`

// Rows of letters as paths, one per colour, each run of a row one rectangle.
function pix(rows: readonly string[], ink: Record<string, string>, ox = 0, oy = 0) {
  const paths = new Map<string, string>()
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]!
      const color = ink[c]
      if (!color) {
        x++
        continue
      }
      let end = x
      while (row[end] === c) end++
      paths.set(color, `${paths.get(color) ?? ''}M${x + ox} ${y + oy}h${end - x}v1h${x - end}z`)
      x = end
    }
  })
  return [...paths].map(([color, d]) => `<path fill='${color}' d='${d}'/>`).join('')
}

// The same with a one-pixel edge all round, one row and column bigger each way.
function outlined(rows: readonly string[], ink: Record<string, string>, edge: string, ox = 0, oy = 0) {
  const at = (x: number, y: number) => rows[y]?.[x] ?? '.'
  const out: string[] = []
  for (let y = -1; y <= rows.length; y++) {
    let line = ''
    for (let x = -1; x <= rows[0]!.length; x++) {
      const c = at(x, y)
      line += c !== '.' ? c : at(x - 1, y) !== '.' || at(x + 1, y) !== '.' || at(x, y - 1) !== '.' || at(x, y + 1) !== '.' ? '#' : '.'
    }
    out.push(line)
  }
  return pix(out, { ...ink, '#': edge }, ox - 1, oy - 1)
}

// Words in whole screen pixels, whatever the view's scale: uneven letters are
// what a scaled pixel font looks worst for.
type InkStyle = { shadow?: string; outline?: string }

function pen(view: View) {
  const ratio = view.ratio
  const unit = (scale: number) => Math.max(1, Math.round(scale * ratio)) / ratio
  const snap = (v: number) => Math.round(v * ratio) / ratio
  const size = (text: string, scale = 1) => textWidth(text) * unit(scale)
  const write = (text: string, x: number, y: number, color: string, scale = 1, style: InkStyle = {}) => {
    const u = unit(scale)
    const d = textPath(text, 0, 0)
    const at = (dx: number, dy: number) => `transform='translate(${fine(snap(x) + dx)} ${fine(snap(y) + dy)}) scale(${fine(u)})'`
    const outline = style.outline ? `<path ${at(0, 0)} stroke='${style.outline}' stroke-width='1.9' stroke-linecap='square' d='${d}'/>` : ''
    const shadow = style.shadow ? `<path ${at(u, u)} stroke='${style.shadow}' d='${d}'/>` : ''
    return `${outline}${shadow}<path ${at(0, 0)} stroke='${color}' d='${d}'/>`
  }
  const center = (text: string, y: number, color: string, scale = 1, style: InkStyle = {}) => write(text, CX - size(text, scale) / 2, y, color, scale, style)
  return { size, write, center, unit }
}

// ---- the buddy ----

export type Pose = 'ride' | 'duck' | 'air' | 'crash'

const buddyCache = new Map<string, string>()
const EYE = '#1c1b19'
// The buddy's grid runs from these, with room for what it wears and its edge.
const GRID_LEFT = -1
const GRID_TOP = -7
const GRID_W = 21
const GRID_H = 24

function gridArt(cells: (string | null)[][], edge: string) {
  const at = (x: number, y: number) => cells[y]?.[x] ?? null
  const paths = new Map<string, string>()
  const put = (color: string, x: number, y: number, w: number) => paths.set(color, `${paths.get(color) ?? ''}M${x + GRID_LEFT} ${y + GRID_TOP}h${w}v1h${-w}z`)
  for (let y = 0; y < GRID_H; y++) {
    let x = 0
    while (x < GRID_W) {
      const color = at(x, y) ?? (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) ? edge : null)
      if (!color) {
        x++
        continue
      }
      let end = x + 1
      while (end < GRID_W && (at(end, y) ?? (at(end - 1, y) || at(end + 1, y) || at(end, y - 1) || at(end, y + 1) ? edge : null)) === color) end++
      put(color, x, y, end - x)
      x = end
    }
  }
  return [...paths].map(([color, d]) => `<path fill='${color}' d='${d}'/>`).join('')
}

// A buddy on its board, on a grid 19 wide with the board's underside at 15.
export function buddyArt(skin: Skin, pose: Pose) {
  const key = `${skin.id}|${pose}`
  const cached = buddyCache.get(key)
  if (cached) return cached
  const c = skin.color
  const cells: (string | null)[][] = Array.from({ length: GRID_H }, () => Array<string | null>(GRID_W).fill(null))
  const fill = (x: number, y: number, w: number, tall: number, color: string) => {
    for (let j = y; j < y + tall; j++) for (let i = x; i < x + w; i++) {
      const row = cells[j - GRID_TOP]
      if (row && i - GRID_LEFT >= 0 && i - GRID_LEFT < GRID_W) row[i - GRID_LEFT] = color
    }
  }
  const dark = shade(c, 0.74)
  const deep = shade(c, 0.56)

  for (let j = 0; j < 11; j++) {
    const inset = j === 0 || j === 10 ? 2 : j === 1 || j === 9 ? 1 : 0
    fill(3 + inset, j, 13 - inset * 2, 1, c)
  }
  fill(5, 0, 8, 1, shade(c, 1.42))
  fill(4, 1, 10, 1, shade(c, 1.22))
  fill(3, 2, 1, 7, shade(c, 1.22))
  fill(15, 2, 1, 7, dark)
  fill(4, 9, 11, 1, dark)
  fill(5, 10, 9, 1, dark)
  fill(4, 7, 2, 1, shade(c, 1.5))
  fill(13, 7, 2, 1, shade(c, 1.5))
  // Arms out for balance, legs on the board.
  const armY = pose === 'air' ? 3 : 5
  fill(1, armY, 2, 2, dark)
  fill(16, armY, 2, 2, dark)
  fill(5, 11, 3, 2, deep)
  fill(11, 11, 3, 2, deep)

  const eye = skin.eye ?? EYE
  if (pose === 'crash') {
    for (const x of [6, 11]) {
      fill(x, 3, 1, 1, eye)
      fill(x + 2, 3, 1, 1, eye)
      fill(x + 1, 4, 1, 1, eye)
      fill(x, 5, 1, 1, eye)
      fill(x + 2, 5, 1, 1, eye)
    }
  } else if (pose === 'duck') {
    fill(6, 5, 3, 1, eye)
    fill(11, 5, 3, 1, eye)
  } else {
    fill(6, 3, 2, 4, eye)
    fill(11, 3, 2, 4, eye)
    fill(6, 3, 1, 1, '#ffffff')
    fill(11, 3, 1, 1, '#ffffff')
  }

  if (skin.wear) {
    const { at, rows, ink } = skin.wear
    rows.forEach((row, j) => [...row].forEach((ch, i) => ink[ch] && fill(at[0] + i, at[1] + j, 1, 1, ink[ch]!)))
  }

  // The board: a nose either side, the buddy's colour down its middle.
  fill(2, 13, 15, 1, '#FBF7F0')
  fill(5, 13, 9, 1, shade(c, 1.12))
  fill(0, 14, 19, 1, '#EFE7DA')
  fill(1, 15, 17, 1, '#B7A78F')

  const edge = brightness(c) < 70 ? '#8E8678' : shade(c, 0.4)
  const art = gridArt(cells, edge)
  const done = skin.isSheer ? `<g opacity='.74'>${art}</g>` : art
  buddyCache.set(key, done)
  return done
}

// ---- things ----

const TOKEN_INK = { o: '#EE7F45', y: '#FFE6B8' }
const TOKEN_EDGE = '#7A3620'
const TOKEN_FRAMES = [
  ['....o....', '....o....', '.o..y..o.', '..oyyyo..', 'ooyyyyyoo', '..oyyyo..', '.o..y..o.', '....o....', '....o....'],
  ['....o....', '...ooo...', '.o.oyo.o.', '..ooyoo..', '.ooyyyoo.', '..ooyoo..', '.o.oyo.o.', '...ooo...', '....o....'],
  ['....o....', '...ooo...', '...oyo...', '...oyo...', '..oyyyo..', '...oyo...', '...oyo...', '...ooo...', '....o....'],
  ['....o....', '...ooo...', '.o.oyo.o.', '..ooyoo..', '.ooyyyoo.', '..ooyoo..', '.o.oyo.o.', '...ooo...', '....o....'],
].map(rows => outlined(rows, TOKEN_INK, TOKEN_EDGE, 1, 1))
const TOKEN_SIZE = 11

function badge(face: string, rows: string[], glyph: string) {
  return plate(0, 0, 20, 20, '#2B2621', 1, 3) + plate(1, 1, 18, 18, shade(face, 0.8), 1, 3) + plate(1, 1, 18, 16, face, 1, 3) + rect(4, 3, 12, 1, shade(face, 1.4)) + pix(rows, { w: glyph }, 6, 6)
}

const pixelWords = (text: string, x: number, y: number, ink: string) => `<path transform='translate(${x} ${y})' stroke='${ink}' d='${textPath(text, 0, 0)}'/>`

const ARROW_UP = ['...a...', '..aaa..', '.aaaaa.', 'aaaaaaa', '..aaa..', '..aaa..', '..aaa..']
const ARROW_DOWN = ['..aaa..', '..aaa..', '..aaa..', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...']

const low = () => {
  const stripes = [3, 33].map(x => `<path fill='#F5F0E8' d='M${x} 2h3l-3 9h-3z'/>`).join('')
  return (
    rect(3, 10, 3, 7, '#3D3929') + rect(32, 10, 3, 7, '#3D3929') + rect(1, 16, 7, 1, '#2B2621') + rect(30, 16, 7, 1, '#2B2621') +
    rect(0, 1, 38, 11, '#7E2B25') + rect(0, 2, 38, 9, '#D0503F') + stripes +
    plate(8, 2, 22, 9, '#2B2621', 1, 1) + pixelWords('429', 10, 3, '#FFD9C8') +
    // Over this one: the way to pass it, on the thing itself.
    outlined(ARROW_UP, { a: '#7EE787' }, '#1F5A2F', 16, -11)
  )
}

const high = () =>
  rect(1, 0, 2, 36, '#3D3929') + rect(35, 0, 2, 36, '#3D3929') + rect(0, 34, 4, 2, '#2B2621') + rect(34, 34, 4, 2, '#2B2621') +
  plate(0, 0, 38, 19, '#2B2621') + plate(1, 1, 36, 17, '#FBF7F0') + rect(2, 2, 34, 4, '#D97757') + rect(3, 3, 2, 2, '#FBF7F0') + rect(7, 3, 2, 2, '#F4C08E') + rect(2, 16, 34, 1, '#D8CDBB') + pixelWords('ALLOW?', 3, 8, '#3D3929') + outlined(ARROW_DOWN, { a: '#8FBCE0' }, '#2B4A66', 16, 23)

const wall = () => {
  const line = (text: string, y: number, band: string, ink: string) => rect(3, y, 32, 12, band) + rect(3, y, 2, 12, ink) + pixelWords(text, 8, y + 2, ink)
  return rect(0, 0, 38, 62, '#1C1B19') + rect(0, 0, 38, 3, '#D97757') + rect(36, 3, 2, 59, '#0E0E0D') + rect(0, 60, 38, 2, '#0E0E0D') + line('<<<<', 7, '#4A1F1B', '#F2A49B') + line('====', 24, '#2F2B26', '#C9BFAE') + line('>>>>', 41, '#1E3B24', '#8FE0A0')
}

const SIZES: Record<'low' | 'high' | 'wall', [number, number]> = { low: [38, 17], high: [38, 36], wall: [38, 62] }

const ART: Record<'low' | 'high' | 'wall' | 'magnet' | 'double' | 'fast' | 'shield', string> = {
  low: low(),
  high: high(),
  wall: wall(),
  magnet: badge('#8FBCE0', ['w.....w', 'w.....w', 'w.....w', 'w.....w', 'w.....w', '.w...w.', '..www..'], '#1c1b19') + rect(6, 6, 2, 2, '#C2453C') + rect(12, 6, 2, 2, '#C2453C'),
  double: badge('#E3B341', [], '#1c1b19') + pixelWords('X2', 5, 6, '#1c1b19'),
  fast: badge('#E58FA0', ['...ww..', '..ww...', '.wwww..', '...ww..', '..ww...', '.ww....', '.w.....'], '#1c1b19'),
  shield: badge('#7EC98F', ['wwwwwww', 'w.....w', 'w.....w', 'w.....w', '.w...w.', '..w.w..', '...w...'], '#1c1b19'),
}
const LOD: Record<Kind, string> = { token: '#EE7F45', low: '#D0503F', high: '#FBF7F0', wall: '#1C1B19', magnet: '#8FBCE0', double: '#E3B341', fast: '#E58FA0', shield: '#7EC98F' }

// The top and the visible side of a block, so a wall stands in the stream.
function wallDepth(thing: Thing, dist: number) {
  const z0 = Math.max(NEAREST, thing.z - dist)
  const z1 = thing.z - dist + 3.4
  if (z1 <= NEAREST) return ''
  const [w, tall] = SIZES.wall
  const half = (w * 1.3) / 2 / LANE
  const height = (tall * 1.3) / UNIT
  const a = sOf(z0)
  const b = sOf(z1)
  const xAt = (l: number, s: number) => CX + l * LANE * s
  const topAt = (s: number) => screenY(s) - height * UNIT * s
  const top = `<path fill='#3B362F' d='M${n(xAt(thing.lane - half, a))} ${n(topAt(a))}L${n(xAt(thing.lane + half, a))} ${n(topAt(a))}L${n(xAt(thing.lane + half, b))} ${n(topAt(b))}L${n(xAt(thing.lane - half, b))} ${n(topAt(b))}z'/>`
  if (thing.lane === 0) return top
  const l = thing.lane < 0 ? thing.lane + half : thing.lane - half
  return `<path fill='#0E0E0D' d='M${n(xAt(l, a))} ${n(topAt(a))}L${n(xAt(l, b))} ${n(topAt(b))}L${n(xAt(l, b))} ${n(screenY(b))}L${n(xAt(l, a))} ${n(screenY(a))}z'/>${top}`
}

function drawThing(thing: Thing, dist: number, t: number) {
  const z = thing.z - dist
  if (z > FAR || z < NEAREST - 3.4) return ''
  const s = sOf(Math.max(NEAREST, z))
  const x = CX + thing.lane * LANE * s
  const ground = screenY(s)
  const fade = z > FAR - 14 ? ` opacity='${n((FAR - z) / 14)}'` : ''

  if (thing.kind === 'token') {
    const k = s * 1.2
    const y = ground - (thing.lift + Math.sin(t / 180 + thing.id) * 0.08) * UNIT * s
    if (k < 0.42) {
      const size = Math.max(2, n(9 * k))
      return `<rect x='${n(x - size / 2)}' y='${n(y - size)}' width='${size}' height='${size}' fill='${LOD.token}' stroke='${TOKEN_EDGE}' stroke-width='.6'${fade}/>`
    }
    const shadow = `<rect x='${n(x - 4 * k)}' y='${n(ground - 1)}' width='${n(8 * k)}' height='${Math.max(1, n(2 * k))}' fill='#000' opacity='.14'/>`
    return `${shadow}<g transform='translate(${n(x - (TOKEN_SIZE / 2) * k)} ${n(y - TOKEN_SIZE * k)}) scale(${fine(k)})'${fade}>${TOKEN_FRAMES[Math.floor(t / 110 + thing.id) % TOKEN_FRAMES.length]}</g>`
  }

  if (isObstacle(thing.kind)) {
    const kind = thing.kind as 'low' | 'high' | 'wall'
    const [w, tall] = SIZES[kind]
    const k = s * 1.3
    if (k < 0.2) return `<rect x='${n(x - (w * k) / 2)}' y='${n(ground - tall * k)}' width='${Math.max(1, n(w * k))}' height='${Math.max(1, n(tall * k))}' fill='${LOD[kind]}'${fade}/>`
    const shadow = `<rect x='${n(x - (w * k) / 2 - 1)}' y='${n(ground - 1)}' width='${n(w * k + 2)}' height='${Math.max(1, n(4 * k))}' fill='#000' opacity='.2'/>`
    const depth = kind === 'wall' ? wallDepth(thing, dist) : ''
    return `${shadow}${depth}<g transform='translate(${n(x - (w * k) / 2)} ${n(ground - tall * k)}) scale(${fine(k)})'${fade}>${ART[kind]}</g>`
  }

  const k = s * 1.25
  const y = ground - (thing.lift + 0.5 + Math.sin(t / 220) * 0.12) * UNIT * s
  if (k < 0.22) return `<rect x='${n(x - 9 * k)}' y='${n(y - 9 * k)}' width='${Math.max(1, n(18 * k))}' height='${Math.max(1, n(18 * k))}' fill='${LOD[thing.kind]}'${fade}/>`
  const pulse = 12 + Math.sin(t / 130) * 2
  const beam = `<rect x='${n(x - 7 * k)}' y='${n(y - 70 * k)}' width='${n(14 * k)}' height='${n(ground - y + 70 * k)}' fill='${LOD[thing.kind]}' opacity='.16'/>`
  const ring = `<circle cx='${n(x)}' cy='${n(y - 10 * k)}' r='${n(pulse * k + 3)}' fill='none' stroke='#fff' stroke-opacity='.75' stroke-width='${Math.max(1, n(1.5 * k))}'/>`
  return `${beam}${ring}<g transform='translate(${n(x - 10 * k)} ${n(y - 20 * k)}) scale(${fine(k)})'${fade}>${ART[thing.kind]}</g>`
}

// ---- the world ----

const hash = (i: number) => {
  let v = Math.imul(i ^ 0x9e3779b1, 0x85ebca6b)
  v ^= v >>> 13
  v = Math.imul(v, 0xc2b2ae35)
  return (v ^ (v >>> 16)) >>> 0
}

function dunes(offset: number, base: number, amp: number, fill: string, view: View) {
  const from = Math.floor(view.left / 12) * 12 - 12
  const to = Math.ceil((view.left + view.w) / 12) * 12 + 12
  let crest = ''
  for (let x = from; x <= to; x += 12) {
    const w = Math.sin((x + offset) * 0.031) + 0.5 * Math.sin((x + offset) * 0.083 + 1.7)
    crest += `L${x} ${n(base - amp * (0.6 + 0.4 * w))}`
  }
  const shape = `M${from} ${HORIZON + 2}${crest}L${to} ${HORIZON + 2}z`
  return `<path fill='${mix(fill, '#ffffff', 0.22)}' d='${shape}' transform='translate(0 -1)'/><path fill='${fill}' d='${shape}'/>`
}

const quad = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => `M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}L${n(x3)} ${n(y3)}z`

// A slab of the stream across lanes `l0` to `l1`, from `z0` to the further `z1`.
function slab(l0: number, l1: number, z0: number, z1: number) {
  // Wholly behind the view: past the camera the projection turns over.
  if (z1 <= NEAREST) return ''
  const a = sOf(Math.max(NEAREST, z0))
  const b = sOf(z1)
  return quad(CX + l0 * LANE * a, screenY(a), CX + l1 * LANE * a, screenY(a), CX + l1 * LANE * b, screenY(b), CX + l0 * LANE * b, screenY(b))
}

type SidePiece = { art: string; w: number; tall: number; k: number }

const SIDE: readonly SidePiece[] = [
  // A terminal window on a post.
  {
    art:
      rect(11, 20, 2, 12, '#3D3929') + plate(0, 0, 24, 21, '#141413') + rect(1, 1, 22, 4, '#D97757') + rect(2, 2, 2, 2, '#F5F0E8') + rect(5, 2, 2, 2, '#F4C08E') +
      rect(3, 8, 3, 1, '#7EE787') + rect(7, 8, 11, 1, '#C9BFAE') + rect(3, 11, 14, 1, '#8C8476') + rect(3, 14, 9, 1, '#8C8476') + rect(3, 17, 2, 2, '#7EE787'),
    w: 24,
    tall: 32,
    k: 1.5,
  },
  // A palm.
  {
    art: pix(
      [
        '.....gg....gg.......',
        '...gggGg..gGggg.....',
        '..gg..ggGGgg..gg....',
        '.g...gggGGggg...g...',
        '....gg..tt..gg......',
        '...g....tt....g.....',
        '........Tt..........',
        '.........tT.........',
        '.........Tt.........',
        '.........tT.........',
        '........Tt..........',
        '........tT..........',
        '........Tt..........',
        '.........tT.........',
        '.........Tt.........',
        '.........tT.........',
      ],
      { g: '#5E7D4E', G: '#7FA068', t: '#8A6A48', T: '#6B5036' },
    ),
    w: 20,
    tall: 16,
    k: 3.1,
  },
  // A board stuck in the sand.
  {
    art: pix(
      ['...oo...', '..oooo..', '.oowwoo.', '.oowwoo.', '.oooooo.', '.oowwoo.', '.oowwoo.', '.oooooo.', '.oowwoo.', '.oowwoo.', '.oooooo.', '..oooo..', '...oo...'],
      { o: '#D97757', w: '#FBF7F0' },
    ),
    w: 8,
    tall: 13,
    k: 3,
  },
  // A beach umbrella.
  {
    art: pix(
      [
        '.......oooooo.......',
        '....oowwoooowwoo....',
        '..oooowwoooowwoooo..',
        '.ooooowwoooowwooooo.',
        'ooooowwwoooowwwooooo',
        '.........kk.........',
        '.........kk.........',
        '.........kk.........',
        '.........kk.........',
        '.........kk.........',
        '.........kk.........',
        '.........kk.........',
      ],
      { o: '#D97757', w: '#FBF7F0', k: '#3D3929' },
    ),
    w: 20,
    tall: 12,
    k: 2.8,
  },
  // A speech bubble.
  {
    art: plate(0, 0, 26, 15, '#FBF7F0') + rect(1, 14, 24, 1, '#CDBFA9') + rect(4, 15, 4, 3, '#FBF7F0') + rect(5, 18, 2, 2, '#FBF7F0') + rect(4, 4, 18, 1, '#B89F80') + rect(4, 8, 12, 1, '#B89F80'),
    w: 26,
    tall: 20,
    k: 1.5,
  },
]

const SIDE_GAP = 8

function scenery(dist: number, view: View) {
  const first = Math.floor(dist / SIDE_GAP)
  const columns = Math.max(1, Math.min(3, Math.ceil((view.w / 2 / LANE - 1.6) / 2.6)))
  const out: string[] = []
  for (let i = 8; i >= 0; i--) {
    const z = (first + i) * SIDE_GAP - dist
    if (z < NEAREST) continue
    const s = sOf(z)
    if (s < 0.13) continue
    for (let column = columns - 1; column >= 0; column--) {
      for (const side of [-1, 1]) {
        const h = hash(first + i + (side > 0 ? 7777 : 0) + column * 9973)
        const piece = SIDE[(h >>> 8) % SIDE.length]!
        const l = side * (2.15 + column * 2.6 + (h % 90) / 100)
        const k = s * piece.k
        const x = CX + l * LANE * s
        out.push(`<g transform='translate(${n(x - (piece.w * k) / 2)} ${n(screenY(s) - piece.tall * k)}) scale(${fine(k)})'>${piece.art}</g>`)
      }
    }
  }
  return out.join('')
}

function groundDetail(dist: number, theme: Theme, view: View) {
  const BAND = 9
  const firstBand = Math.floor(dist / BAND)
  let bands = ''
  for (let i = -1; i < 11; i++) {
    if ((firstBand + i) % 2 !== 0) continue
    const z0 = (firstBand + i) * BAND - dist
    bands += slab(-160, 160, z0, z0 + BAND)
  }
  const STEP = 2.4
  const firstMark = Math.floor(dist / STEP)
  let marks = ''
  for (let i = 0; i < 20; i++) {
    const h = hash(firstMark + i + 313)
    const z = (firstMark + i) * STEP - dist
    const l = (h % 2 ? 1 : -1) * (1.95 + (((h >>> 3) % 420) / 100) * (view.w / VIEW_W))
    marks += slab(l, l + 0.16, z, z + 0.22)
  }
  return `<path fill='${mix(theme.ground, theme.duneNear, 0.3)}' d='${bands}'/><path fill='${mix(theme.ground, theme.duneNear, 0.75)}' d='${marks}'/>`
}

function stream(dist: number, theme: Theme) {
  const BAND = 4
  const firstBand = Math.floor(dist / BAND)
  let lightBands = ''
  let curbs = ''
  for (let i = -1; i < 20; i++) {
    if ((firstBand + i) % 2 !== 0) continue
    const z0 = (firstBand + i) * BAND - dist
    lightBands += slab(-1.56, 1.56, z0, z0 + BAND)
    curbs += slab(-1.65, -1.53, z0, z0 + BAND) + slab(1.53, 1.65, z0, z0 + BAND)
  }

  const DASH = 3
  const firstDash = Math.floor(dist / DASH)
  let dashes = ''
  for (let i = -1; i < 16; i++) {
    const z0 = (firstDash + i) * DASH - dist
    for (const l of [-0.5, 0.5]) dashes += slab(l - 0.03, l + 0.03, z0, z0 + 1.1)
  }

  // Lines of code going by in the stream, in blocks down each lane: added,
  // removed, unchanged, with the indents code has.
  const STEP = 1.6
  const firstLine = Math.floor(dist / STEP)
  const lines: [string, string, string] = ['', '', '']
  for (const lane of [0, 1, 2]) {
    for (let i = 0; i < 26; i++) {
      const index = firstLine + i
      const h = hash(index * 3 + lane + 91)
      if (h % 10 < 3) continue
      const z = index * STEP - dist
      if (z < NEAREST) continue
      const blockHash = hash(Math.floor(index / 7) * 11 + lane)
      const x0 = -1.42 + lane + 0.04 * (blockHash % 4) + 0.075 * ((h >>> 5) % 3)
      const len = 0.16 + ((h >>> 9) % 44) / 100
      const kind = (h >>> 13) % 8
      lines[kind === 0 ? 0 : kind === 1 ? 1 : 2] += slab(x0, x0 + len, z, z + 0.14)
    }
  }

  const rim = mix(theme.edge, '#000000', 0.42)
  return (
    `<path fill='${rim}' d='${slab(-1.8, -1.65, NEAREST, FAR)}${slab(1.65, 1.8, NEAREST, FAR)}'/>` +
    `<path fill='${theme.trackB}' d='${slab(-1.56, 1.56, NEAREST, FAR)}'/>` +
    `<path fill='${theme.trackA}' d='${lightBands}'/>` +
    `<path fill='${theme.tick}' d='${lines[2]}'/>` +
    `<path fill='#6FBF7E' fill-opacity='.8' d='${lines[0]}'/>` +
    `<path fill='#E08A7E' fill-opacity='.8' d='${lines[1]}'/>` +
    `<path fill='${theme.lane}' d='${dashes}'/>` +
    `<path fill='${theme.edge}' d='${slab(-1.65, -1.53, NEAREST, FAR)}${slab(1.53, 1.65, NEAREST, FAR)}'/>` +
    `<path fill='${mix(theme.edge, '#ffffff', 0.62)}' d='${curbs}'/>`
  )
}

// A tint down the lane in front of what stands in it, to read it from afar.
function dangerMarks(run: Run) {
  const paths: Record<'low' | 'high' | 'wall', string> = { low: '', high: '', wall: '' }
  for (const thing of run.things) {
    if (!isObstacle(thing.kind)) continue
    const z = thing.z - run.dist
    if (z < NEAREST || z > 70) continue
    paths[thing.kind as 'low' | 'high' | 'wall'] += slab(thing.lane - 0.47, thing.lane + 0.47, z - 2.6, z)
  }
  return `<path fill='#D0503F' fill-opacity='.2' d='${paths.low}'/><path fill='#6A9BCC' fill-opacity='.24' d='${paths.high}'/><path fill='#141413' fill-opacity='.18' d='${paths.wall}'/>`
}

function backdrop(dist: number, t: number, theme: Theme, view: View) {
  const bands: string[] = []
  const COUNT = 10
  const skyTall = HORIZON + 4 - view.top
  for (let i = 0; i < COUNT; i++) {
    bands.push(rect(view.left, n(view.top + Math.floor((i * skyTall) / COUNT)), view.w, Math.ceil(skyTall / COUNT) + 1, mix(theme.skyTop, theme.skyLow, i / (COUNT - 1))))
  }
  const sunY = HORIZON - 20
  // The sun is the spark: eight tapered arms, turning slowly behind the disc.
  let arms = ''
  const turn = t / 9000
  for (let a = 0; a < 8; a++) {
    const angle = turn + (a * Math.PI) / 4
    const reach = a % 2 === 0 ? 38 : 31
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    arms += `M${n(SUN_X + c * reach)} ${n(sunY + s * reach)}L${n(SUN_X - s * 7)} ${n(sunY + c * 7)}L${n(SUN_X + s * 7)} ${n(sunY - c * 7)}z`
  }
  let slits = ''
  for (let i = 0; i < 4; i++) slits += rect(SUN_X - 24, sunY + 3 + i * 5, 48, 1 + i * 0.6, mix(theme.skyTop, theme.skyLow, 0.86))
  const cloud = (seed: number, y: number) => {
    const x = view.left - 40 + ((seed * 83 + t / 70 + dist * 0.04) % (view.w + 80))
    return `<path fill='#FFFFFF' opacity='.62' d='M${n(x)} ${y}h40v4h-40zM${n(x + 8)} ${y - 4}h22v4h-22zM${n(x + 14)} ${y - 7}h10v3h-10z'/><path fill='#000000' opacity='.05' d='M${n(x + 4)} ${y + 4}h32v2h-32z'/>`
  }
  return (
    bands.join('') +
    cloud(1, 22) +
    cloud(3, 40) +
    cloud(5, 58) +
    (view.w > 330 ? cloud(2.4, 30) + cloud(4.2, 50) : '') +
    (view.top < -30 ? cloud(6.1, n(view.top * 0.45)) + cloud(7.3, n(view.top * 0.75)) : '') +
    `<circle cx='${SUN_X}' cy='${sunY}' r='42' fill='${theme.sun}' opacity='.1'/>` +
    `<circle cx='${SUN_X}' cy='${sunY}' r='32' fill='${theme.sun}' opacity='.16'/>` +
    `<path fill='${theme.sun}' opacity='.7' d='${arms}'/>` +
    `<circle cx='${SUN_X}' cy='${sunY}' r='21' fill='${theme.sun}'/>` +
    slits +
    dunes(dist * 0.35, HORIZON - 2, 22, theme.duneFar, view) +
    dunes(dist * 0.9 + 400, HORIZON + 1, 13, theme.duneNear, view) +
    rect(view.left, HORIZON, view.w, VIEW_H - HORIZON, theme.ground)
  )
}

const haze = (theme: Theme, view: View) => `<rect x='${view.left}' y='${HORIZON}' width='${view.w}' height='9' fill='${theme.skyLow}' opacity='.55'/><rect x='${view.left}' y='${HORIZON + 9}' width='${view.w}' height='9' fill='${theme.skyLow}' opacity='.26'/>`

// The foam the board throws out behind it, opening towards the viewer.
function wake(px: number, t: number) {
  const top = GROUND + 3
  const tall = VIEW_H - top
  const SEGMENTS = 5
  const drift = (t / 260) % (1 / SEGMENTS)
  let d = ''
  for (const side of [-1, 1]) {
    for (let i = -1; i < SEGMENTS; i++) {
      const a = Math.max(0, i / SEGMENTS + drift)
      const b = Math.min(1, (i + 0.62) / SEGMENTS + drift)
      if (b <= a) continue
      const y0 = top + tall * a
      const y1 = top + tall * b
      const x0 = px + side * (13 + (y0 - top) * 0.8)
      const x1 = px + side * (13 + (y1 - top) * 0.8)
      const w0 = 1.5 + (y0 - top) * 0.1
      const w1 = 1.5 + (y1 - top) * 0.1
      d += quad(x0, y0, x0 + side * w0, y0, x1 + side * w1, y1, x1, y1)
    }
  }
  return `<path fill='#FFFFFF' opacity='.62' d='${d}'/>`
}

function speedLines(t: number, strength: number) {
  let d = ''
  const COUNT = Math.round(4 + strength * 10)
  for (let i = 0; i < COUNT; i++) {
    const h = hash(Math.floor(t / 45) + i * 13)
    const angle = ((h % 628) / 100)
    const from = 90 + ((h >>> 9) % 70)
    const len = 18 + strength * 34
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const ox = CX + c * from
    const oy = HORIZON + 24 + s * from
    d += `M${n(ox)} ${n(oy)}L${n(ox + c * len)} ${n(oy + s * len)}L${n(ox + c * len + s * 1.4)} ${n(oy + s * len - c * 1.4)}z`
  }
  return `<path fill='#FFFFFF' opacity='${n(0.3 + strength * 0.4)}' d='${d}'/>`
}

function surfer(run: Run, skin: Skin, t: number) {
  const y = heightOf(run.air)
  const isDucking = run.duck > 0 && run.air === 0
  const isCrashed = run.phase === 'over'
  const pose: Pose = isCrashed ? 'crash' : isDucking ? 'duck' : run.air > 0 ? 'air' : 'ride'
  const px = CX + run.x * LANE
  const bob = pose === 'ride' ? Math.round(Math.sin(t / 130)) : 0
  const lean = (run.lane - run.x) * -14
  const squash = isDucking ? 0.62 : 1
  const py = GROUND - y * UNIT + bob

  let trail = ''
  if (run.phase === 'play' && run.air === 0) {
    trail += wake(px, t)
    for (let i = 0; i < 7; i++) {
      const h = hash(Math.floor(t / 55) + i)
      trail += rect(n(px - 20 + (h % 40)), n(GROUND + 3 + ((h >>> 6) % 11)), 2, 2, '#FFFFFF')
    }
  }

  const width = 40 * (1 - y * 0.12)
  const shadow = `<path fill='#000' opacity='.22' d='M${n(px - width / 2 + 3)} ${GROUND + 1}h${n(width - 6)}v1h3v2h-3v1h${n(6 - width)}v-1h-3v-2h3z'/>`
  const hidden = run.blink > 0 && Math.floor(t / 80) % 2 === 0 && run.phase === 'play'
  const motion = isCrashed ? 'rotate(24)' : `skewX(${n(lean)})`
  const figure = hidden ? '' : `<g transform='translate(${n(px)} ${n(py)}) ${motion} scale(2 ${n(2 * squash)}) translate(-9.5 -15)'>${buddyArt(skin, pose)}</g>`

  let aura = ''
  if (run.shield && !hidden && !isCrashed) aura += `<circle cx='${n(px)}' cy='${n(py - 16)}' r='${n(27 + Math.sin(t / 160))}' fill='#7EC98F' fill-opacity='.14' stroke='#7EC98F' stroke-width='2'/>`
  if (run.magnet > 0) {
    const r = 18 + ((t / 8) % 26)
    aura += `<circle cx='${n(px)}' cy='${n(py - 14)}' r='${n(r)}' fill='none' stroke='#8FBCE0' stroke-opacity='${n(0.8 - (r - 18) / 34)}' stroke-width='2'/>`
  }
  if (run.fast > 0) aura += speedLines(t, 1)
  else if (run.phase === 'play' && run.speed > 32) aura += speedLines(t, (run.speed - 32) / 14 * 0.45)
  return trail + shadow + figure + aura
}

// The burst a collected or smashed thing leaves.
function drawPops(run: Run) {
  let out = ''
  for (const pop of run.pops) {
    const s = sOf(Math.max(NEAREST, pop.z - run.dist))
    const x = CX + pop.lane * LANE * s
    const y = screenY(s) - pop.lift * UNIT * s
    const f = pop.age / 420
    const reach = (pop.isBig ? 38 : 20) * f * s + 2
    const size = Math.max(1, n((pop.isBig ? 5 : 3.5) * (1 - f)))
    for (let a = 0; a < 8; a += pop.isBig ? 1 : 2) {
      const angle = (a * Math.PI) / 4
      out += rect(n(x + Math.cos(angle) * reach), n(y + Math.sin(angle) * reach), size, size, pop.isBig ? '#FBF7F0' : '#FFC48F')
    }
  }
  return out
}

// ---- the overlays ----

const PLATE = '#1c1b19'
const IVORY = '#F5F0E8'
const TERRACOTTA = '#D97757'

export function hud(run: Run, hint: string | null, view: View) {
  const p = pen(view)
  const left = view.left + 5
  const right = view.left + view.w - 5
  const top = view.top + 5
  const score = String(Math.floor(run.score))
  const tokens = String(run.tokens)
  const NUMBERS = 1.5
  const scoreW = p.size(score, NUMBERS) + 12
  const tokensW = p.size(tokens, NUMBERS) + 26
  const rowH = p.unit(NUMBERS) * 7 + 8
  const textY = top + (rowH - p.unit(NUMBERS) * 7) / 2

  let out = plate(left, top, scoreW, rowH, PLATE, 0.86) + p.write(score, left + 6, textY, IVORY, NUMBERS)
  if (run.double > 0) {
    const x = left + scoreW + 3
    const label = 'X2'
    out += plate(x, top, p.size(label) + 10, rowH, '#E3B341') + p.write(label, x + 5, top + (rowH - p.unit(1) * 7) / 2, PLATE)
  }
  const tokensX = right - tokensW
  out += plate(tokensX, top, tokensW, rowH, PLATE, 0.86) + `<g transform='translate(${n(tokensX + 4)} ${n(top + (rowH - TOKEN_SIZE) / 2)})'>${TOKEN_FRAMES[0]}</g>` + p.write(tokens, tokensX + 19, textY, IVORY, NUMBERS)

  const bars: [string, number, number][] = [
    ['#8FBCE0', run.magnet, 8000],
    ['#E3B341', run.double, 8000],
    ['#E58FA0', run.fast, 4000],
  ]
  let y = top + rowH + 3
  for (const [color, timeLeft, total] of bars) {
    if (timeLeft <= 0) continue
    out += plate(left, y, 56, 10, PLATE, 0.86, 1) + rect(left + 3, y + 3, 4, 4, color) + rect(left + 10, y + 4, 42, 2, '#3B362F') + rect(left + 10, y + 4, n((42 * timeLeft) / total), 2, color)
    y += 12
  }
  if (run.shield) out += plate(left, y, 14, 14, PLATE, 0.86, 1) + pix(['ggggggg', 'g.....g', 'g.....g', '.g...g.', '..ggg..', '...g...'], { g: '#7EC98F' }, left + 3.5, y + 4)

  if (hint) {
    const w = p.size(hint) + 14
    const hintY = top + rowH + 6
    out += plate(CX - w / 2, hintY, w, 16, PLATE, 0.86) + p.center(hint, hintY + 4, IVORY)
  }
  return out
}

export function titleOverlay(best: string, bank: string, view: View) {
  const p = pen(view)
  const line = `${best} · ◆ ${bank}`
  const w = p.size(line) + 16
  const style = { outline: '#2B2621', shadow: '#2B2621' }
  const lift = view.top * 0.45
  return (
    p.center('CLAUDE', 8 + lift, TERRACOTTA, 4, style) +
    p.center('SURFERS', 42 + lift, '#FBF7F0', 4, style) +
    plate(CX - w / 2, 83 + lift, w, 15, PLATE, 0.86) +
    p.center(line, 87 + lift, IVORY)
  )
}

const veil = (view: View, o = 0.55) => `<rect x='${view.left}' y='${view.top}' width='${view.w}' height='${view.h}' fill='#3A1E12' opacity='${o}'/>`

export function pauseOverlay(title: string, view: View) {
  const p = pen(view)
  return veil(view) + p.center(title, 110, IVORY, 4, { outline: '#2B2621', shadow: '#2B2621' })
}

export type OverLines = { title: string; reason: string; score: string; tokens: string; best: string; bestIsNew: boolean; goal: string | null; goalPart: number; goalSkinId: string | null }

export function overOverlay(o: OverLines, view: View) {
  const p = pen(view)
  const left = 22
  const w = VIEW_W - 2 * left
  // In a tall pane the card moves up with the sky, towards the middle.
  const top = 26 + view.top * 0.5
  const tall = 186
  let out = veil(view, 0.38)
  out += plate(left - 2, top + 3, w + 4, tall, '#000000', 0.3, 4) + plate(left, top, w, tall, TERRACOTTA, 1, 4) + plate(left + 2, top + 2, w - 4, tall - 4, '#201D1A', 1, 3)
  out += p.center(o.title, top + 14, TERRACOTTA, 4, { shadow: '#5E2C1D' })
  out += p.center(o.reason, top + 52, '#C9BFAE')
  out += p.center(o.score, top + 70, IVORY, 4, { shadow: '#000000' })
  out += p.center(o.tokens, top + 108, '#FFC48F', 2)
  out += p.center(o.best, top + 130, o.bestIsNew ? '#7EE787' : '#C9BFAE')
  if (o.goal && o.goalSkinId) {
    const barW = w - 62
    const x = left + 46
    const y = top + 152
    out += `<g transform='translate(${left + 10} ${y - 6}) scale(1.5)'>${silhouette(buddyArt(skinOf(o.goalSkinId), 'ride'))}</g>`
    out += p.write(o.goal, x, y - 2, IVORY)
    out += rect(x, y + 13, barW, 6, '#3B362F') + rect(x + 1, y + 14, n((barW - 2) * Math.min(1, o.goalPart)), 4, TERRACOTTA)
  }
  return out
}

export type Frame = { run: Run; skinId: string; t: number; view: View; overlay: string }

// The colour of the top of the sky, dimmed as the picture is, for any room above it.
export const skyColor = (dist: number, dim = 0) => mix(themeAt(dist).skyTop, '#3A1E12', dim)

export function sceneSvg(frame: Frame) {
  const { run, t, view, overlay } = frame
  const skin = skinOf(frame.skinId)
  const theme = themeAt(run.dist)
  const ordered = run.things.slice().sort((a, b) => b.z - a.z)
  const ahead: string[] = []
  const behind: string[] = []
  for (const thing of ordered) (thing.z > run.dist ? ahead : behind).push(drawThing(thing, run.dist, t))
  const flash = run.phase === 'play' && run.blink > BLINK_MS - 140 ? `<rect x='${view.left}' y='${view.top}' width='${view.w}' height='${view.h}' fill='#FFFFFF' opacity='.5'/>` : ''
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${view.markupW}' height='${view.markupH}' viewBox='${view.left} ${view.top} ${view.w} ${view.h}' preserveAspectRatio='none' shape-rendering='crispEdges'>` +
    backdrop(run.dist, t, theme, view) +
    groundDetail(run.dist, theme, view) +
    scenery(run.dist, view) +
    stream(run.dist, theme) +
    dangerMarks(run) +
    haze(theme, view) +
    ahead.join('') +
    surfer(run, skin, t) +
    behind.join('') +
    drawPops(run) +
    flash +
    overlay +
    '</svg>'
  )
}

// ---- the menus' pictures ----

export function panelSvg(view: View) {
  const width = Math.round(view.w * view.ratio)
  const height = Math.round(view.h * view.ratio)
  let dots = ''
  for (let y = 54; y < height; y += 28) for (let x = (y - 54) % 56 === 0 ? 10 : 24; x < width; x += 28) dots += `M${x} ${y}h2v2h-2z`
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${view.markupW}' height='${view.markupH}' viewBox='0 0 ${width} ${height}' preserveAspectRatio='none' shape-rendering='crispEdges'>` +
    rect(0, 0, width, height, '#F5F0E8') +
    `<path fill='#E6DCCB' d='${dots}'/>` +
    rect(0, 0, width, 42, TERRACOTTA) +
    rect(0, 42, width, 3, '#9E4F37') +
    rect(0, 0, width, 2, '#EFA88E') +
    '</svg>'
  )
}

export type ButtonLook = 'primary' | 'plain' | 'dark'

const BUTTONS: Record<ButtonLook, { face: string; hot: string; edge: string; ink: string; shine: string }> = {
  primary: { face: '#D97757', hot: '#E58A6C', edge: '#9E4F37', ink: '#FFFFFF', shine: '#F2B49D' },
  plain: { face: '#F5F0E8', hot: '#FFFFFF', edge: '#B89F80', ink: '#3D3929', shine: '#FFFFFF' },
  dark: { face: '#2B2621', hot: '#3B362F', edge: '#141413', ink: '#F5F0E8', shine: '#4F483F' },
}

export function buttonSvg(label: string, width: number, height: number, look: ButtonLook, isHot: boolean, isDown: boolean) {
  const b = BUTTONS[look]
  const drop = isDown ? 2 : 0
  const scale = textWidth(label) * 2 > width - 12 ? 1 : 2
  const x = Math.round((width - textWidth(label) * scale) / 2)
  const y = Math.round((height - 5 - 7 * scale) / 2) + drop
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}' shape-rendering='crispEdges'>` +
    plate(0, drop, width, height - drop, '#2B2621', 1, 3) +
    plate(2, 2 + drop, width - 4, height - 4 - drop, b.edge, 1, 2) +
    plate(2, 2 + drop, width - 4, height - 9, isHot ? b.hot : b.face, 1, 2) +
    rect(6, 4 + drop, width - 12, 1, b.shine) +
    `<path transform='translate(${x} ${y}) scale(${scale})' stroke='${b.ink}' d='${textPath(label, 0, 0)}'/></svg>`
  )
}

export type CardLook = { skin: Skin; isOwned: boolean; isSelected: boolean; canBuy: boolean; isHot: boolean; note: string }

function silhouette(art: string) {
  return art.replace(/fill='#[0-9A-Fa-f]{3,8}'/g, "fill='#8E8678'")
}

const LOCK = ['..kkk..', '.k...k.', '.k...k.', 'kkkkkkk', 'kkk.kkk', 'kkk.kkk', 'kkkkkkk']
const CHECK = ['......w', '.....ww', 'w...ww.', 'ww.ww..', '.www...', '..w....']

export function cardSvg(look: CardLook, width: number, height: number) {
  const { skin, isOwned, isSelected, canBuy, isHot, note } = look
  const art = buddyArt(skin, 'ride')
  const nameScale = textWidth(skin.name) * 2 <= width - 10 ? 2 : 1
  const noteScale = textWidth(note) * 2 <= width - 10 ? 2 : 1
  const frame = isSelected ? TERRACOTTA : canBuy ? '#7D9B63' : isHot ? '#B89F80' : '#D8CDBB'
  const face = isHot ? '#FFFFFF' : isOwned ? '#FBF7F0' : '#EDE5D6'
  const nameY = height - 8 * noteScale - 8 * nameScale - 5
  // The buddy stands on the name; what it wears has five rows above its head.
  const scale = Math.max(1, Math.min(4, Math.floor(width / 24), Math.floor((nameY - 5) / 20)))
  const bx = Math.round((width - 19 * scale) / 2)
  const by = nameY - 3 - 16 * scale
  const stage = isOwned ? mix(skin.color, '#ffffff', 0.68) : '#DDD4C4'
  const stageBottom = by + 16 * scale
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}' shape-rendering='crispEdges'>` +
    plate(1, 2, width - 2, height - 2, '#000000', 0.14, 3) +
    plate(1, 1, width - 2, height - 3, frame, 1, 3) +
    plate(isSelected ? 4 : 3, isSelected ? 4 : 3, width - (isSelected ? 8 : 6), height - (isSelected ? 9 : 7), face, 1, 2) +
    rect(6, 6, width - 12, Math.max(1, stageBottom - 6), stage) +
    rect(6, stageBottom - 1, width - 12, 2, shade(stage === '#DDD4C4' ? '#DDD4C4' : mix(skin.color, '#ffffff', 0.4), 0.92)) +
    `<g transform='translate(${bx} ${by}) scale(${scale})'>${isOwned ? art : silhouette(art)}</g>` +
    (isOwned ? '' : pix(LOCK, { k: canBuy ? '#4E7A3E' : '#7A7263' }, width - 16, 9)) +
    (isSelected ? plate(8, 8, 13, 12, TERRACOTTA, 1, 2) + pix(CHECK, { w: '#FFFFFF' }, 11, 11) : '') +
    `<path transform='translate(${Math.round((width - textWidth(skin.name) * nameScale) / 2)} ${nameY}) scale(${nameScale})' stroke='#3D3929' d='${textPath(skin.name, 0, 0)}'/>` +
    `<path transform='translate(${Math.round((width - textWidth(note) * noteScale) / 2)} ${height - 8 * noteScale - 4}) scale(${noteScale})' stroke='${canBuy ? '#4E7A3E' : isOwned ? '#9E4F37' : '#7A7263'}' d='${textPath(note, 0, 0)}'/>` +
    '</svg>'
  )
}

export function labelSvg(text: string, scale: number, color: string) {
  const width = (textWidth(text) + 1) * scale
  const height = 9 * scale
  return { source: `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${textWidth(text) + 1} 9' shape-rendering='crispEdges'><path stroke='${color}' d='${textPath(text, 0, 0)}'/></svg>`, width, height }
}
