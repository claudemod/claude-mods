import { ITEM_PATHS } from './items'
// The font's text comes as lines one pixel thick, so it is stroked, not filled.
import { textPath, textWidth } from './pixel'

// The modes as a hotbar: ten slots as wide as the XP bar above them, an item in
// each, a frame round the active one, and a slot apart on the left with the
// lamp of the task's cost in it. All of it drawn here, in game pixels.

export const HOTBAR_W = 240
export const HOTBAR_H = 24
export const HOTBAR_SCALE = 2
export const SLOTS = 10
export const LAMP = 'lamp'

const SLOT_X = 30
const SLOT_Y = 3
const SLOT_SIZE = 18
const LAMP_X = 3

export type HotbarItem = { id: string; label: string }

export type HotbarLook = {
  items: readonly HotbarItem[]
  active: string
  hover: string | null
  lamp: { color: string; isRunning: boolean; amount: string }
}

// The ten modes that have a slot: the first ten, and the active one in the
// last slot should it stand further back.
export function slotted<T extends { id: string }>(items: readonly T[], active: string): T[] {
  const first = items.slice(0, SLOTS)
  const chosen = items.find(item => item.id === active)
  if (chosen && !first.includes(chosen)) first[SLOTS - 1] = chosen
  return first
}

// What stands at this point of the picture, as a share of its width: a slot's
// number, the lamp, or nothing.
export function hotbarTargetAt(shareX: number): number | typeof LAMP | null {
  const x = shareX * HOTBAR_W
  if (x >= LAMP_X && x < LAMP_X + SLOT_SIZE) return LAMP
  if (x < SLOT_X || x >= SLOT_X + SLOT_SIZE * SLOTS) return null
  return Math.floor((x - SLOT_X) / SLOT_SIZE)
}

function slot(x: number) {
  return (
    `<rect x="${x}" y="${SLOT_Y}" width="${SLOT_SIZE}" height="${SLOT_SIZE}" fill="#5C5C5C"/>` +
    `<rect x="${x + 1}" y="${SLOT_Y + 1}" width="${SLOT_SIZE - 2}" height="${SLOT_SIZE - 2}" fill="#303030"/>`
  )
}

// A mode with no item of its own: its first letter on a plain block.
function letterItem(label: string, x: number, y: number) {
  const letter = [...label][0]?.toUpperCase() ?? '?'
  const d = textPath(letter, x + Math.floor((16 - textWidth(letter)) / 2), y + 4)
  return `<rect x="${x + 1}" y="${y + 1}" width="14" height="14" fill="#6B6B6B"/><path d="${d}" stroke="#FFFFFF"/>`
}

function itemAt(item: HotbarItem, x: number, y: number) {
  const paths = ITEM_PATHS[item.id]
  return paths ? `<g transform="translate(${x} ${y})">${paths}</g>` : letterItem(item.label, x, y)
}

function hoverGlow(x: number) {
  return `<rect x="${x + 1}" y="${SLOT_Y + 1}" width="16" height="16" fill="#FFFFFF" fill-opacity="0.35"/>`
}

// The frame round the active slot: it stands two pixels past the slot on each side.
function frame(x: number) {
  const left = x - 2
  const top = SLOT_Y - 2
  return (
    `<path fill-rule="evenodd" fill="#000" d="M${left} ${top}h22v22h-22zM${left + 1} ${top + 1}v20h20v-20z"/>` +
    `<path fill-rule="evenodd" fill="#E8E8E8" d="M${left + 1} ${top + 1}h20v20h-20zM${left + 3} ${top + 3}v16h16v-16z"/>`
  )
}

function lampArt(lamp: HotbarLook['lamp']) {
  const left = LAMP_X + 3
  const top = SLOT_Y + 3
  const pulse = lamp.isRunning ? '<animate attributeName="opacity" values="1;.5;1" dur="1.2s" repeatCount="indefinite"/>' : ''
  const textD = lamp.amount ? textPath(lamp.amount, Math.max(0, LAMP_X + SLOT_SIZE - textWidth(lamp.amount)), SLOT_Y + SLOT_SIZE - 8) : ''
  return (
    `<rect x="${left}" y="${top}" width="12" height="12" fill="#4A321C"/>` +
    `<rect x="${left + 1}" y="${top + 1}" width="10" height="10" fill="${lamp.color}">${pulse}</rect>` +
    `<rect x="${left + 2}" y="${top + 2}" width="3" height="3" fill="#FFFFFF" fill-opacity="0.45"/>` +
    (textD ? `<path d="${textD}" stroke="#3F3F3F" transform="translate(1 1)"/><path d="${textD}" stroke="#FFFFFF"/>` : '')
  )
}

// The last hotbar drawn, by what it was drawn from: a redraw that changes
// nothing in the picture (the hint under it, a new frame) reuses it.
let lastLook = ''
let lastSvg = ''

export function hotbarSvg(look: HotbarLook) {
  const key = JSON.stringify(look)
  if (key === lastLook) return lastSvg
  lastSvg = hotbarSvgOf(look)
  lastLook = key
  return lastSvg
}

function hotbarSvgOf(look: HotbarLook) {
  const items = slotted(look.items, look.active)
  const slots = Array.from({ length: SLOTS }, (_, i) => slot(SLOT_X + SLOT_SIZE * i)).join('')
  const drawn = items
    .map((item, i) => {
      const x = SLOT_X + SLOT_SIZE * i
      return itemAt(item, x + 1, SLOT_Y + 1) + (item.id === look.hover ? hoverGlow(x) : '')
    })
    .join('')
  const activeIndex = items.findIndex(item => item.id === look.active)
  const body =
    `<rect x="${SLOT_X - 1}" y="${SLOT_Y - 1}" width="${SLOT_SIZE * SLOTS + 2}" height="${SLOT_SIZE + 2}" fill="#000"/>` +
    slots +
    drawn +
    (activeIndex >= 0 ? frame(SLOT_X + SLOT_SIZE * activeIndex) : '') +
    `<rect x="${LAMP_X - 1}" y="${SLOT_Y - 1}" width="${SLOT_SIZE + 2}" height="${SLOT_SIZE + 2}" fill="#000"/>` +
    slot(LAMP_X) +
    lampArt(look.lamp) +
    (look.hover === LAMP ? hoverGlow(LAMP_X) : '')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${HOTBAR_W} ${HOTBAR_H}" width="${HOTBAR_W * HOTBAR_SCALE}" height="${HOTBAR_H * HOTBAR_SCALE}" shape-rendering="crispEdges">` +
    body +
    '</svg>'
  )
}

// A mode's name under the hotbar: white with a black edge, legible on the
// light chat and the dark one alike.
export function itemNameSvg(text: string) {
  const width = textWidth(text) + 2
  const height = 10
  const d = textPath(text, 1, 1)
  const edge = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
    .map(([dx, dy]) => `<path d="${d}" stroke="#000" transform="translate(${dx} ${dy})"/>`)
    .join('')
  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * HOTBAR_SCALE}" height="${height * HOTBAR_SCALE}" shape-rendering="crispEdges">` +
      `${edge}<path d="${d}" stroke="#FFFFFF"/></svg>`,
    width: width * HOTBAR_SCALE,
    height: height * HOTBAR_SCALE,
  }
}
