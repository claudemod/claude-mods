// The picture of a mode tile: an app-icon-like rounded square in the mode's
// colour with a white line symbol.
import { TILE_PX } from './layout'

// White line symbols on a 24-unit grid, one per built-in mode.
export const GLYPHS: Record<string, string> = {
  eco: "<path d='M5 19c0-8.5 5-13.5 14-14 0 9-5 14-13.5 14z'/><path d='M5.5 18.5l7.5-7.5'/>",
  quick: "<path d='M13.5 3L5.5 13.5h6l-1 7.5 8-10.5h-6z' fill='#ffffff'/>",
  brief: "<path d='M5 7.5h14M5 12h9.5M5 16.5h5'/>",
  normal: "<path d='M7 5h10a2.2 2.2 0 0 1 2.2 2.2v6.6A2.2 2.2 0 0 1 17 16h-5.5L7.5 19.2V16H7a2.2 2.2 0 0 1-2.2-2.2V7.2A2.2 2.2 0 0 1 7 5z'/>",
  plan: "<path d='M10 7h9M10 12h9M10 17h9'/><circle cx='5.8' cy='7' r='1.3' fill='#ffffff' stroke='none'/><circle cx='5.8' cy='12' r='1.3' fill='#ffffff' stroke='none'/><circle cx='5.8' cy='17' r='1.3' fill='#ffffff' stroke='none'/>",
  review: "<circle cx='10.5' cy='10.5' r='5.5'/><path d='M14.6 14.6L19 19'/>",
  explain: "<path d='M12 3.5a5.8 5.8 0 0 0-3.4 10.5c.6.5.9 1.1.9 1.9h5c0-.8.3-1.4.9-1.9A5.8 5.8 0 0 0 12 3.5z'/><path d='M9.8 18.6h4.4M10.6 21h2.8'/>",
  debug: "<ellipse cx='12' cy='14' rx='4.3' ry='5.3'/><path d='M9.6 9a2.4 2.4 0 0 1 4.8 0M12 9v10M7.7 12.5H4.5M7.8 16.5H5M16.3 12.5h3.2M16.2 16.5H19'/>",
  test: "<path d='M9.5 3.5h5M10.3 3.5v5.8L5.8 17.2A2 2 0 0 0 7.5 20h9a2 2 0 0 0 1.7-2.8l-4.5-7.9V3.5'/><path d='M7.6 14.5h8.8'/>",
  deep: "<path d='M12 3.5v17M3.5 12h17M6 6l12 12M18 6L6 18'/>",
}

// An Apple-style rounded square (a superellipse) of side `s`.
function squircle(s: number, inset = 0) {
  const n = 5
  const a = s / 2 - inset
  const c = s / 2
  const points: string[] = []
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2
    const cos = Math.cos(t)
    const sin = Math.sin(t)
    const x = c + a * Math.sign(cos) * Math.abs(cos) ** (2 / n)
    const y = c + a * Math.sign(sin) * Math.abs(sin) ** (2 / n)
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return `M${points.join('L')}Z`
}

// A colour moved toward white (amount > 0) or black (amount < 0).
function shade(color: string, amount: number) {
  const hex = color.replace('#', '')
  const full = hex.length === 3 ? [...hex].map(ch => ch + ch).join('') : hex.slice(0, 6)
  const channels = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16))
  const target = amount > 0 ? 255 : 0
  const mixed = channels.map(v => Math.round(v + (target - v) * Math.abs(amount)))
  return `#${mixed.map(v => v.toString(16).padStart(2, '0')).join('')}`
}

function escape(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function tileSvg(id: string, label: string, color: string, state: 'active' | 'hover' | 'rest') {
  const s = TILE_PX
  const gid = `g${id.replace(/[^a-z0-9]/gi, '')}`
  const glyph =
    GLYPHS[id] ??
    `<text x='12' y='12.5' text-anchor='middle' dominant-baseline='central' font-family='system-ui, sans-serif' font-size='11' font-weight='600' fill='#ffffff' stroke='none'>${escape([...label][0] ?? '?')}</text>`
  const opacity = state === 'rest' ? 0.8 : 1
  // The active tile stands in a thin ring of its own colour.
  const ring = state === 'active' ? `<path d='${squircle(s, 0.6)}' fill='none' stroke='${color}' stroke-width='1.2'/>` : ''
  const inner = state === 'active' ? 2.6 : 0.5
  const scale = ((s - inner * 2) * 0.68) / 24
  const offset = s / 2 - 12 * scale
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}' viewBox='0 0 ${s} ${s}'>` +
    `<defs><linearGradient id='${gid}' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='${shade(color, 0.2)}'/><stop offset='1' stop-color='${shade(color, -0.08)}'/></linearGradient></defs>` +
    ring +
    `<g opacity='${opacity}'>` +
    `<path d='${squircle(s, inner)}' fill='url(#${gid})'/>` +
    `<path d='${squircle(s, inner + 0.5)}' fill='none' stroke='#ffffff' stroke-opacity='0.22' stroke-width='0.8'/>` +
    `<g transform='translate(${offset.toFixed(2)} ${offset.toFixed(2)}) scale(${scale.toFixed(3)})' fill='none' stroke='#ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${glyph}</g>` +
    '</g></svg>'
  )
}

