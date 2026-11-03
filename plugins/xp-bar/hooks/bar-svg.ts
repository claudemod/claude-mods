import { textPath, textWidth } from './pixel-font'

// CSS pixels per game pixel: the game's GUI scale 2.
const SCALE = 2
// The bar as the game draws it: 182 wide, 5 tall, a black frame, 18 segments.
const BAR = 182
const INNER = BAR - 2
// The level number's nine rows (its outline included) stand on the bar's top edge.
const HEIGHT = 14

export const BAR_WIDTH = BAR * SCALE
export const BAR_HEIGHT = HEIGHT * SCALE

// How long the green takes to grow from the last reading to the new one.
export const FILL_MS = 700

// The card's text starts inside its border and three pixels of padding, as the
// game's does; the right side keeps one more for the text's shadow.
const TIP_INSET = 4
const TIP_PADDING = TIP_INSET * 2 + 1
// Dark ground around the violet border. The desktop clips the card to its own
// rounded box, which the tooltip only just overreaches: this margin keeps the
// border, corners included, inside the cut.
const TIP_MARGIN = 3
// The widest card the desktop's popover holds (360 px) once the tooltip's
// overreach is added back, in game pixels.
export const TIP_MAX_WIDTH = 183
// The widest line of text that card holds.
export const TIP_TEXT_MAX_WIDTH = TIP_MAX_WIDTH - TIP_PADDING - TIP_MARGIN * 2

// The game's text colours for an item tooltip, and the shadow each casts: the
// same colour at a quarter of its brightness.
const TIP_COLORS = {
  title: '#55FFFF', // an enchanted item's name
  gray: '#AAAAAA', // its enchantments
  value: '#5555FF', // its attribute modifiers
  warn: '#FFAA00', // gold, a warning
  good: '#55FF55', // green, all is well
  total: '#00AAAA', // dark aqua, the running totals
  lore: '#AA00AA', // its lore
} as const

export type TipColor = keyof typeof TIP_COLORS

// One line of the card, or null for the half-height gap the game leaves before its lore.
export type TipLine = { text: string; color: TipColor } | null

function shadowOf(color: string) {
  const channel = (i: number) => (parseInt(color.slice(i, i + 2), 16) >> 2).toString(16).padStart(2, '0')
  return `#${channel(1)}${channel(3)}${channel(5)}`
}

export function fillWidth(percent: number | null) {
  return Math.round(((percent ?? 0) / 100) * INNER)
}

function svg(width: number, height: number, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * SCALE}" height="${height * SCALE}" shape-rendering="crispEdges">
${body}
</svg>`
}

// A growth under way: the level it grows from and how far into it this drawing comes.
export type Grow = { fromPercent: number | null; elapsedMs: number }

// How much of the week's limit is gone, as the bar's colour tells it.
export type Tier = 'green' | 'yellow' | 'orange' | 'red'

// Green below 70 % of the week, yellow from 70, orange from 80, red from 90.
export function tierOf(weekPercent: number | null): Tier {
  const p = weekPercent ?? 0
  return p >= 90 ? 'red' : p >= 80 ? 'orange' : p >= 70 ? 'yellow' : 'green'
}

// Each tier as the game shades its bar: the fill, a lighter top row, a darker
// bottom row, and the empty track tinted to match.
const TIER_COLORS: Record<Tier, { fill: string; top: string; bottom: string; track: string }> = {
  green: { fill: '#6FD81E', top: '#B4FF6E', bottom: '#3E8E12', track: '#2E3A28' },
  yellow: { fill: '#F2D21B', top: '#FFF27A', bottom: '#A88F0A', track: '#3A3722' },
  orange: { fill: '#F28C1B', top: '#FFC27A', bottom: '#A8560A', track: '#3A2E22' },
  red: { fill: '#E8342E', top: '#FF8A80', bottom: '#9A1A16', track: '#3A2424' },
}

// The terminal's bar in the same tiers, in the game's text colours.
export const TIER_TEXT: Record<Tier, string> = {
  green: '#80FF20',
  yellow: '#FFFF55',
  orange: '#FFAA00',
  red: '#FF5555',
}

// The game's HUD: the level number centred above the bar, outlined in black,
// the bar in its tier's colour. While `grow` is under way the fill grows from
// its old width to the new one, picking up `elapsedMs` in, so a drawing made
// mid-growth carries on smoothly.
export function xpBarSvg(percent: number | null, grow?: Grow, tier: Tier = 'green') {
  const colors = TIER_COLORS[tier]
  const to = fillWidth(percent)
  const from = fillWidth(grow?.fromPercent ?? percent)
  const notches = Array.from({ length: 17 }, (_, i) => {
    const x = 1 + Math.round(((i + 1) * INNER) / 18)
    return `<rect x="${x}" y="10" width="1" height="3" fill="#000" fill-opacity="0.55"/>`
  }).join('')
  const animate =
    grow === undefined || from === to || grow.elapsedMs >= FILL_MS
      ? ''
      : `<animate attributeName="width" from="${from}" to="${to}" begin="${-grow.elapsedMs / 1000}s" dur="${FILL_MS / 1000}s" calcMode="spline" keyTimes="0;1" keySplines="0.2 0 0.2 1" fill="freeze"/>`

  const level = percent === null ? '' : String(Math.round(percent))
  const levelX = Math.floor((BAR - textWidth(level)) / 2)
  const color = percent !== null && percent >= 90 ? '#FF5555' : '#80FF20'

  return svg(
    BAR,
    HEIGHT,
    `<defs>
<clipPath id="fill"><rect x="1" y="10" width="${to}" height="3">${animate}</rect></clipPath>
<path id="level" d="${textPath(level, levelX, 1)}"/>
</defs>
<rect x="0" y="9" width="${BAR}" height="5" fill="#000"/>
<rect x="1" y="10" width="${INNER}" height="3" fill="${colors.track}"/>
<g clip-path="url(#fill)">
<rect x="1" y="10" width="${INNER}" height="3" fill="${colors.fill}"/>
<rect x="1" y="10" width="${INNER}" height="1" fill="${colors.top}"/>
<rect x="1" y="12" width="${INNER}" height="1" fill="${colors.bottom}"/>
</g>
${notches}
<use href="#level" x="-1" fill="#000"/><use href="#level" x="1" fill="#000"/><use href="#level" y="-1" fill="#000"/><use href="#level" y="1" fill="#000"/>
<use href="#level" fill="${color}"/>`,
  )
}

// The hover card, as the game draws an item's tooltip: the name, its lines
// beneath at ten pixels apart (two more under the name), each in its colour
// with a shadow, on the dark-violet ground with the violet edge.
export function xpTipSvg(lines: readonly TipLine[]) {
  const texts = lines.flatMap(line => (line === null ? [] : [line.text]))
  const inner = Math.max(...texts.map(textWidth)) + TIP_PADDING
  const width = inner + TIP_MARGIN * 2

  const left = TIP_MARGIN + TIP_INSET
  let y = TIP_MARGIN + TIP_INSET
  const drawn = lines.map((line, i) => {
    if (line === null) {
      y += 5
      return ''
    }
    const d = textPath(line.text, left, y)
    y += i === 0 ? 12 : 10
    const color = TIP_COLORS[line.color]
    return `<path d="${d}" fill="${shadowOf(color)}" transform="translate(1 1)"/><path d="${d}" fill="${color}"/>`
  })
  // The last line's ten pixels hold its descender and two of the padding; two more close it.
  const innerHeight = y + 2 - TIP_MARGIN
  const height = innerHeight + TIP_MARGIN * 2

  const source = svg(
    width,
    height,
    `<defs>
<linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5000FF" stop-opacity="0.7"/><stop offset="1" stop-color="#28007F" stop-opacity="0.7"/></linearGradient>
</defs>
<rect width="${width}" height="${height}" fill="#100010"/>
<rect x="${TIP_MARGIN + 0.5}" y="${TIP_MARGIN + 0.5}" width="${inner - 1}" height="${innerHeight - 1}" fill="none" stroke="url(#edge)" stroke-width="1"/>
${drawn.join('')}`,
  )

  return { source, width: width * SCALE, height: height * SCALE }
}
