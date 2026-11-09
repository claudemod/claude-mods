import type { AgentState, Held, StepState } from '../types'

// The buddy: an original blocky little figure drawn on a pixel grid, one per
// agent in that agent's colour. It walks and blinks by itself (SMIL in the
// picture, so no redraw is needed), holds what fits the tool the agent is using
// and closes its eyes when the agent is done.

export const GRID_W = 25
export const GRID_H = 14
export const BUDDY_PX = 3

type Item = { rows: string[]; ink: Record<string, string> }

// 7×7 pixels each, held in the buddy's right hand.
const ITEMS: Record<Held | 'check', Item> = {
  pencil: { rows: ['.....py', '....yyy', '...yyy.', '..yyy..', '.yyy...', 'tyy....', 'tt.....'], ink: { p: '#E58FA0', y: '#EFC24E', t: '#5B4A35' } },
  book: { rows: ['bbbbbbb', 'bwwbwwb', 'bggbggb', 'bwwbwwb', 'bggbggb', 'bwwbwwb', 'bbbbbbb'], ink: { w: '#F1EEE6', g: '#A9A59B', b: '#7A5A3C' } },
  terminal: { rows: ['fffffff', 'fkkkkkf', 'fgkkkkf', 'fkgkkkf', 'fgkgggf', 'fkkkkkf', 'fffffff'], ink: { f: '#8C93A0', k: '#2F343B', g: '#7EE787' } },
  lens: { rows: ['.sss...', 's...s..', 's.c.s..', 's...s..', '.sss...', '....hh.', '.....hh'], ink: { s: '#C9CED6', c: '#8FD0F2', h: '#8A6A48' } },
  globe: { rows: ['..bbb..', '.bgbbb.', 'bggbbbb', 'bbgggbb', 'bbbggbb', '.bbbgb.', '..bbb..'], ink: { b: '#5AA5E0', g: '#7CC46D' } },
  plug: { rows: ['.s...s.', '.s...s.', 'ppppppp', 'ppppppp', '.ppppp.', '...w...', '...w...'], ink: { s: '#C9CED6', p: '#8C93A0', w: '#5B4A35' } },
  gear: { rows: ['...g...', '.g.g.g.', '..ggg..', 'ggg.ggg', '..ggg..', '.g.g.g.', '...g...'], ink: { g: '#A9B0BC' } },
  check: { rows: ['.......', '......g', '.....gg', 'g...gg.', 'gg.gg..', '.ggg...', '..g....'], ink: { g: '#79C97F' } },
}

// What a buddy holds while its agent uses a tool.
export function heldFor(tool: string): Held {
  if (/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(tool)) return 'pencil'
  if (/^(Read|NotebookRead)$/.test(tool)) return 'book'
  if (/^(Bash|PowerShell|BashOutput|KillShell|Monitor)$/.test(tool)) return 'terminal'
  if (/^(Grep|Glob|LS|ToolSearch)$/.test(tool)) return 'lens'
  if (/^Web(Fetch|Search)$/.test(tool)) return 'globe'
  if (tool.startsWith('mcp__')) return 'plug'
  return 'gear'
}

// 0..1 goes darker, above 1 towards white.
export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16)
  const part = (bits: number) => (n >> bits) & 255
  const mix = (c: number) => (f <= 1 ? Math.round(c * f) : Math.round(c + (255 - c) * (f - 1)))
  return `rgb(${mix(part(16))},${mix(part(8))},${mix(part(0))})`
}

const px = (x: number, y: number, w: number, tall: number, fill: string) =>
  `<rect x='${x}' y='${y}' width='${w}' height='${tall}' fill='${fill}'/>`

const flip = (from: string, to: string, dur: string, begin: string) =>
  `<animate attributeName='opacity' values='${from};${to}' dur='${dur}' begin='${begin}' calcMode='discrete' repeatCount='indefinite'/>`

function itemRects(item: Item) {
  return item.rows
    .map((row, j) =>
      [...row]
        .map((c, i) => (c === '.' ? '' : px(17 + i, 2 + j, 1, 1, item.ink[c] ?? '#000')))
        .join(''),
    )
    .join('')
}

function bodyRects(color: string) {
  const dark = shade(color, 0.74)
  const lite = shade(color, 1.22)
  const high = shade(color, 1.42)
  const rows: string[] = []
  for (let j = 0; j < 11; j++) {
    const inset = j === 0 || j === 10 ? 2 : j === 1 || j === 9 ? 1 : 0
    rows.push(px(3 + inset, j, 13 - inset * 2, 1, color))
  }
  return [
    ...rows,
    px(5, 0, 8, 1, high),
    px(4, 1, 10, 1, lite),
    px(3, 2, 1, 7, lite),
    px(15, 2, 1, 7, dark),
    px(5, 10, 9, 1, dark),
    px(4, 9, 11, 1, dark),
    px(4, 7, 2, 1, shade(color, 1.5)),
    px(13, 7, 2, 1, shade(color, 1.5)),
    px(9, 7, 1, 1, shade(color, 0.56)),
  ].join('')
}

const EYE = '#1c1b19'
const openEyes = () =>
  [px(6, 3, 2, 4, EYE), px(11, 3, 2, 4, EYE), px(6, 3, 1, 1, '#fff'), px(11, 3, 1, 1, '#fff')].join('')
const shutEyes = () => [px(6, 5, 3, 1, EYE), px(11, 5, 3, 1, EYE)].join('')
const crossEyes = () =>
  [6, 11]
    .map(x => [px(x, 3, 1, 1, EYE), px(x + 2, 3, 1, 1, EYE), px(x + 1, 4, 1, 1, EYE), px(x, 5, 1, 1, EYE), px(x + 2, 5, 1, 1, EYE)].join(''))
    .join('')

const limbs = (color: string, step: 0 | 1) => {
  const deep = shade(color, 0.56)
  const dark = shade(color, 0.74)
  return [
    px(5, 11, 3, step ? 1 : 2, deep),
    px(11, 11, 3, step ? 2 : 1, deep),
    px(1, 6 + step, 2, 2, dark),
    px(16, 7 - step, 2, 2, dark),
  ].join('')
}

export function buddySvg(options: { color: string; state: AgentState; held: Held | null; phase: number }) {
  const { color, state, held, phase } = options
  const size = `width='${GRID_W * BUDDY_PX}' height='${GRID_H * BUDDY_PX}' viewBox='0 0 ${GRID_W} ${GRID_H}'`
  const open = `<svg xmlns='http://www.w3.org/2000/svg' ${size} shape-rendering='crispEdges'>`
  const shadow = px(4, 13, 11, 1, 'rgba(0,0,0,.18)')

  if (state !== 'running') {
    const eyes = state === 'done' ? shutEyes() : crossEyes()
    const mark = state === 'done' ? itemRects(ITEMS.check) : ''
    return `${open}${shadow}<g opacity='.82'>${limbs(color, 0)}${bodyRects(color)}${eyes}</g>${mark}</svg>`
  }

  const stride = '.4s'
  const begin = `${(-(phase % 7) * 0.13).toFixed(2)}s`
  const blinkBegin = `${(-(phase % 5) * 0.7).toFixed(1)}s`
  const item = held ? itemRects(ITEMS[held]) : ''
  const bob = `<animateTransform attributeName='transform' type='translate' values='0 0;0 -1' dur='${stride}' begin='${begin}' calcMode='discrete' repeatCount='indefinite'/>`
  const blink = (values: string) =>
    `<animate attributeName='opacity' values='${values}' keyTimes='0;.95;1' dur='3.6s' begin='${blinkBegin}' calcMode='discrete' repeatCount='indefinite'/>`

  return [
    open,
    shadow,
    `<g>${flip('1', '0', stride, begin)}${limbs(color, 0)}</g>`,
    `<g>${flip('0', '1', stride, begin)}${limbs(color, 1)}</g>`,
    `<g>${bob}${bodyRects(color)}`,
    `<g>${blink('1;0;0')}${openEyes()}</g>`,
    `<g>${blink('0;1;1')}${shutEyes()}</g>`,
    item,
    '</g></svg>',
  ].join('')
}

// The mark in front of a step: a tick, a turning star in the agent's colour or a cross.
export function stepIconSvg(state: StepState, color: string) {
  const open = `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 16 16'>`
  if (state === 'ok') {
    return `${open}<circle cx='8' cy='8' r='7.5' fill='#6FBF73'/><path d='M4.6 8.3l2.4 2.4 4.4-5' fill='none' stroke='#1b2a1d' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/></svg>`
  }
  if (state === 'error') {
    return `${open}<circle cx='8' cy='8' r='7.5' fill='#E06C5F'/><path d='M5.3 5.3l5.4 5.4M10.7 5.3l-5.4 5.4' stroke='#2a1a18' stroke-width='1.9' stroke-linecap='round'/></svg>`
  }
  const arms = [0, 45, 90, 135]
    .map(a => `<path d='M8 1.6V14.4' transform='rotate(${a} 8 8)' stroke='${color}' stroke-width='2' stroke-linecap='round'/>`)
    .join('')
  return `${open}<g>${arms}<animateTransform attributeName='transform' type='rotate' from='0 8 8' to='360 8 8' dur='2.2s' repeatCount='indefinite'/></g></svg>`
}

// The arrow at the end of a row, pointing down once the step is open.
export function chevronSvg(isOpen: boolean) {
  const path = isOpen ? 'M2.5 4.5L6 8l3.5-3.5' : 'M4.5 2.5L8 6l-3.5 3.5'
  return `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='${path}' fill='none' stroke='#8a8a85' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>`
}
