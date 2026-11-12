import type { AgentState, Held, Kind, Segment, StepState } from '../types'
import { textPath, textWidth } from './pixel'

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

// --- The Craft Skin: a blocky figure in a dark slot, with tools to match.

export const CRAFT_W = 28
export const CRAFT_H = 20
export const CRAFT_PX = 3

// 9 × 9 pixels each, the bottom-left corner in the figure's hand.
const CRAFT_ITEMS: Record<Held | 'emerald', Item> = {
  terminal: { rows: ['..ddddd..', '.d...hhd.', '.....hh.d', '....hh..d', '...hh....', '..hh.....', '.hh......', 'hh.......', 'h........'], ink: { d: '#7FE3DC', h: '#8A6A48' } },
  pencil: { rows: ['.......ww', '.....wwww', '....wwwg.', '...wwwg..', '..wwwg...', '..wwg....', '.kg......', 'k........', '.........'], ink: { w: '#F1EEE6', g: '#B9B5AA', k: '#3A3226' } },
  book: { rows: ['.bbbbbbb.', 'bbrrrrrbw', 'bbryyrrbw', 'bbrrrrrbw', 'bbrrrrrbw', 'bbrrrrrbw', 'bbbbbbbbw', '.wwwwwww.', '.........'], ink: { b: '#6B4426', r: '#9A3530', y: '#E8C65A', w: '#E9E4D6' } },
  lens: { rows: ['..ggggg..', '.gwwwwwg.', 'gwwwrwwwg', 'gwwwrwwwg', 'gwwwkwwwg', 'gwwwkwwwg', 'gwwwwwwwg', '.gwwwwwg.', '..ggggg..'], ink: { g: '#8A8F98', w: '#EDEAE0', r: '#D2453C', k: '#3A3D44' } },
  globe: { rows: ['ppppppppp', 'pgggbbbbp', 'pggbbbggp', 'pgbbgggrp', 'pbbggggrp', 'pbgggbbbp', 'pggbbbggp', 'pgbbggggp', 'ppppppppp'], ink: { p: '#D9CFAE', g: '#7CAB5A', b: '#5AA5E0', r: '#D2453C' } },
  plug: { rows: ['....r....', '...rRr...', '..rRRRr..', '...rRr...', '....h....', '....h....', '....h....', '....h....', '....h....'], ink: { r: '#A31515', R: '#FF4A3A', h: '#6B4A2C' } },
  gear: { rows: ['.......ss', '......sss', '.....sss.', '....sss..', 'g..sss...', '.gsss....', '.hgg.....', 'h..g.....', '.........'], ink: { s: '#D8DEE6', g: '#C49A3C', h: '#5B4A35' } },
  emerald: { rows: ['...ee....', '..eEEe...', '.eEWEEe..', 'eEWEEEEe.', '.eeEEee..', '..eeee...', '...ee....', '.........', '.........'], ink: { e: '#1E9E55', E: '#46E08A', W: '#D8FFE8' } },
}

const SKIN_TONES = ['#E9B98F', '#C98E5F', '#8B5A3A']
const HAIR = ['#5A3A1E', '#D9B24C', '#26221E', '#B5522A']

const TOOL_X = 17
const TOOL_Y = 3

function craftItemRects(item: Item) {
  return item.rows
    .map((row, j) =>
      [...row]
        .map((c, i) => (c === '.' ? '' : px(TOOL_X + i, TOOL_Y + j, 1, 1, item.ink[c] ?? '#000')))
        .join(''),
    )
    .join('')
}

// The dark slot the figure stands in, lit from the bottom right like a game's
// inventory, so it reads as a place and not as a sticker on the card.
function craftSlot() {
  return [
    px(0, 0, CRAFT_W, CRAFT_H, '#0A0A14'),
    px(0, 0, CRAFT_W, 1, '#24222E'),
    px(0, 0, 1, CRAFT_H, '#24222E'),
    px(0, CRAFT_H - 1, CRAFT_W, 1, '#55516A'),
    px(CRAFT_W - 1, 0, 1, CRAFT_H, '#55516A'),
  ].join('')
}

// What each buddy has on its head, so that no two in a row look alike.
function craftHeadwear(phase: number, color: string, hair: string) {
  const look = phase % 4
  if (look === 1) return [px(6, 1, 8, 2, color), px(6, 1, 8, 1, shade(color, 1.3)), px(5, 3, 7, 1, shade(color, 0.6))].join('')
  if (look === 2) return [px(6, 1, 8, 2, hair), px(6, 3, 8, 1, color), px(14, 3, 1, 2, shade(color, 0.75))].join('')
  if (look === 3) return [px(6, 1, 8, 3, '#BFC5CE'), px(6, 1, 8, 1, '#E4E8EE'), px(13, 1, 1, 3, '#8E949E'), px(6, 4, 1, 1, '#8E949E'), px(13, 4, 1, 1, '#8E949E')].join('')
  return [px(6, 1, 8, 2, hair), px(6, 3, 1, 2, hair), px(13, 3, 1, 2, hair), px(8, 3, 1, 1, hair)].join('')
}

function craftHead(phase: number, color: string) {
  const skin = SKIN_TONES[phase % SKIN_TONES.length] ?? '#E9B98F'
  const hair = HAIR[phase % HAIR.length] ?? '#5A3A1E'
  return [
    px(6, 1, 8, 8, skin),
    px(13, 3, 1, 6, shade(skin, 0.82)),
    px(6, 8, 8, 1, shade(skin, 0.86)),
    px(9, 7, 2, 1, shade(skin, 0.66)),
    craftHeadwear(phase, color, hair),
  ].join('')
}

const craftOpenEyes = () => [px(8, 5, 1, 2, EYE), px(11, 5, 1, 2, EYE)].join('')
const craftShutEyes = () => [px(8, 6, 2, 1, EYE), px(10, 6, 2, 1, EYE)].join('')
const craftCrossEyes = () =>
  [7, 10]
    .map(x => [px(x, 4, 1, 1, EYE), px(x + 2, 4, 1, 1, EYE), px(x + 1, 5, 1, 1, EYE), px(x, 6, 1, 1, EYE), px(x + 2, 6, 1, 1, EYE)].join(''))
    .join('')

function craftTorso(color: string) {
  return [
    px(7, 9, 6, 5, color),
    px(7, 9, 1, 5, shade(color, 1.28)),
    px(12, 9, 1, 5, shade(color, 0.72)),
    px(7, 13, 6, 1, shade(color, 0.5)),
    px(9, 9, 2, 1, shade(color, 0.6)),
  ].join('')
}

function craftLimbs(color: string, skin: string, step: 0 | 1) {
  const pants = shade(color, 0.42)
  const pantsLit = shade(color, 0.55)
  const boots = shade(color, 0.22)
  const sleeve = shade(color, 0.84)
  const leg = (x: number, up: number) => [px(x, 14, 3, 3 - up, pants), px(x, 14, 1, 3 - up, pantsLit), px(x, 17 - up, 3, 1, boots)].join('')
  const arm = (x: number, down: number) => [px(x, 9 + down, 2, 3, sleeve), px(x, 12 + down, 2, 2, skin)].join('')
  return [leg(7, step), leg(10, 1 - step), arm(5, step), arm(13, 1 - step)].join('')
}

export function craftBuddySvg(options: { color: string; state: AgentState; held: Held | null; phase: number }) {
  const { color, state, held, phase } = options
  const skin = SKIN_TONES[phase % SKIN_TONES.length] ?? '#E9B98F'
  const size = `width='${CRAFT_W * CRAFT_PX}' height='${CRAFT_H * CRAFT_PX}' viewBox='0 0 ${CRAFT_W} ${CRAFT_H}'`
  const open = `<svg xmlns='http://www.w3.org/2000/svg' ${size} shape-rendering='crispEdges'>${craftSlot()}`
  const shadow = px(6, 18, 8, 1, 'rgba(255,255,255,.12)')
  const shirt = state === 'failed' ? '#6B6B73' : color
  const body = craftTorso(shirt) + craftHead(phase, shirt)

  if (state !== 'running') {
    const eyes = state === 'done' ? craftShutEyes() : craftCrossEyes()
    const mark = state === 'done' ? craftItemRects(CRAFT_ITEMS.emerald) : ''
    return `${open}${shadow}${craftLimbs(shirt, skin, 0)}${body}${eyes}${mark}</svg>`
  }

  const stride = '.4s'
  const begin = `${(-(phase % 7) * 0.13).toFixed(2)}s`
  const blinkBegin = `${(-(phase % 5) * 0.7).toFixed(1)}s`
  const blink = (values: string) =>
    `<animate attributeName='opacity' values='${values}' keyTimes='0;.95;1' dur='3.6s' begin='${blinkBegin}' calcMode='discrete' repeatCount='indefinite'/>`
  // The tool goes up and down with the arm that holds it, a pixel at a time.
  const swing = `<animateTransform attributeName='transform' type='translate' values='0 0;1 -1' dur='${stride}' begin='${begin}' calcMode='discrete' repeatCount='indefinite'/>`
  const tool = held ? `<g>${swing}${craftItemRects(CRAFT_ITEMS[held])}</g>` : ''
  const glint = (x: number, y: number, delay: string) =>
    `<rect x='${x}' y='${y}' width='1' height='1' fill='#FFFFA0'><animate attributeName='opacity' values='0;1;0;0' dur='1.2s' begin='${delay}' calcMode='discrete' repeatCount='indefinite'/></rect>`
  const glints = held ? [glint(26, 2, begin), glint(23, 1, '-.4s'), glint(25, 12, '-.8s')].join('') : ''
  return [
    open,
    shadow,
    `<g>${flip('1', '0', stride, begin)}${craftLimbs(shirt, skin, 0)}</g>`,
    `<g>${flip('0', '1', stride, begin)}${craftLimbs(shirt, skin, 1)}</g>`,
    body,
    `<g>${blink('1;0;0')}${craftOpenEyes()}</g>`,
    `<g>${blink('0;1;1')}${craftShutEyes()}</g>`,
    tool,
    glints,
    '</svg>',
  ].join('')
}

// A heading on the chat's own ground: an edge all round keeps it legible on
// the light chat and the dark one alike.
export function craftHeadingSvg(text: string, scale: number, color: string) {
  const width = textWidth(text) + 2
  const height = 10
  const d = textPath(text, 1, 1)
  const edge = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    .map(([dx, dy]) => `<path d='${d}' stroke='#000' transform='translate(${dx} ${dy})'/>`)
    .join('')
  return {
    source: `<svg xmlns='http://www.w3.org/2000/svg' width='${width * scale}' height='${height * scale}' viewBox='0 0 ${width} ${height}' shape-rendering='crispEdges'>${edge}<path d='${d}' stroke='${color}'/></svg>`,
    width: width * scale,
    height: height * scale,
  }
}

// The marks on a Craft Skin card, 7 × 7 pixels drawn at twice the size.
const open7 = `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 7 7' shape-rendering='crispEdges'>`

function cells(rows: readonly string[], ink: string) {
  return rows.map((row, j) => [...row].map((c, i) => (c === '#' ? px(i, j, 1, 1, ink) : '')).join('')).join('')
}

export function craftStepIconSvg(state: StepState, color: string) {
  if (state === 'ok') return `${open7}${cells(['.......', '......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'], '#55FF55')}</svg>`
  if (state === 'error') return `${open7}${cells(['##...##', '###.###', '.#####.', '..###..', '.#####.', '###.###', '##...##'], '#FF5555')}</svg>`
  const spin = `<animateTransform attributeName='transform' type='rotate' values='0 3.5 3.5;90 3.5 3.5;180 3.5 3.5;270 3.5 3.5' dur='.8s' calcMode='discrete' repeatCount='indefinite'/>`
  return `${open7}<g>${spin}${cells(['..###..', '.#...#.', '#......', '#......', '#......', '.#.....', '..#....'], color)}</g></svg>`
}

export function craftChevronSvg(isOpen: boolean) {
  const rows = isOpen ? ['.......', '.......', '#.....#', '##...##', '.##.##.', '..###..', '...#...'] : ['..#....', '..##...', '...##..', '....##.', '...##..', '..##...', '..#....']
  return `${open7.replace(/='14'/g, "='12'")}${cells(rows, '#AAAAAA')}</svg>`
}

// --- The detail view: what kind of work each step was.

export const KIND_HELD: Record<Kind, Held> = { read: 'book', search: 'lens', edit: 'pencil', run: 'terminal', web: 'globe', tool: 'gear' }

// One calm colour per kind of work; on the Craft Skin, the game's chat colours.
export const KIND_INK: Record<Kind, string> = { read: '#6A9BCC', search: '#9B86C9', edit: '#D97757', run: '#7DAE63', web: '#4FA3A5', tool: '#A3957F' }
export const CRAFT_KIND_INK: Record<Kind, string> = { read: '#5555FF', search: '#FF55FF', edit: '#FFAA00', run: '#55FF55', web: '#55FFFF', tool: '#AAAAAA' }

// The kind's item, on its own: the same pixels the buddy holds.
export function kindIconSvg(kind: Kind, isCraft: boolean) {
  const item = isCraft ? CRAFT_ITEMS[KIND_HELD[kind]] : ITEMS[KIND_HELD[kind]]
  const size = item.rows.length
  const rects = item.rows
    .map((row, j) => [...row].map((c, i) => (c === '.' ? '' : px(i, j, 1, 1, item.ink[c] ?? '#000'))).join(''))
    .join('')
  return `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 ${size} ${size}' shape-rendering='crispEdges'>${rects}</svg>`
}

// The activity strip: every step a piece as wide as it took, in its kind's
// colour, so the whole run reads at a glance. A step still running pulses,
// one that failed is marked red underneath.
export function stripSvg(segments: readonly Segment[], widthPx: number, heightPx: number, isCraft: boolean) {
  const ink = isCraft ? CRAFT_KIND_INK : KIND_INK
  const w = Math.max(40, Math.round(widthPx))
  const h = Math.max(4, Math.round(heightPx))
  const bar = Math.max(3, h - 3)
  const top = Math.round((h - bar) / 2) - 1
  const open = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'${isCraft ? " shape-rendering='crispEdges'" : ''}>`
  const ground = isCraft ? `<rect x='0' y='${top}' width='${w}' height='${bar}' fill='#2A2A2A'/>` : `<rect x='0' y='${top}' width='${w}' height='${bar}' rx='${bar / 2}' fill='rgba(128,128,128,.18)'/>`
  if (segments.length === 0) return `${open}${ground}</svg>`
  const total = segments.reduce((sum, s) => sum + s.weight, 0)
  const gap = segments.length > 40 ? 0 : 1
  const room = w - gap * (segments.length - 1)
  let x = 0
  const parts = segments
    .map((s, i) => {
      const width = i === segments.length - 1 ? Math.max(1, w - x) : Math.max(1, (s.weight / total) * room)
      const at = x
      x += width + gap
      const fill = ink[s.kind]
      const pulse = s.state === 'running' ? `<animate attributeName='opacity' values='1;.35;1' dur='1.2s' repeatCount='indefinite'/>` : ''
      const fail = s.state === 'error' ? `<rect x='${at.toFixed(1)}' y='${h - 2}' width='${width.toFixed(1)}' height='2' fill='#E06C5F'/>` : ''
      return `<rect x='${at.toFixed(1)}' y='${top}' width='${width.toFixed(1)}' height='${bar}' fill='${fill}'>${pulse}</rect>${fail}`
    })
    .join('')
  const clip = isCraft ? '' : `<clipPath id='c'><rect x='0' y='${top}' width='${w}' height='${bar}' rx='${bar / 2}'/></clipPath>`
  return `${open}${clip}${ground}<g${isCraft ? '' : " clip-path='url(#c)'"}>${parts}</g></svg>`
}

// A small dot in a kind's colour, for the legend.
export function dotSvg(color: string, isCraft: boolean) {
  return isCraft
    ? `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 4 4' shape-rendering='crispEdges'><rect width='4' height='4' fill='${color}'/></svg>`
    : `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'><circle cx='4' cy='4' r='4' fill='${color}'/></svg>`
}
