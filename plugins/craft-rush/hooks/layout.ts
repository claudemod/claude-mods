// Where everything on the board sits, in cells (a column is 1ch, a row 1lh):
// what the board draws by and the pointer is read by, and where the demo's
// bot aims. A slot is 5 columns wide where the pane has room, 4 or 3 where it
// is narrow; it is always 2 rows tall. The bot thinks in the 5-wide board.
import { GRID_SIZE, HOTBAR_START } from './game'
import type { Area, Mode } from './game'

export const STANDARD_SLOT_W = 5
export const SLOT_H = 2
// A column of margin either side of the nine slots.
export const LEFT = 1
export const CRAFT_TOP = 4

export type Spot = { area: Area; index: number }

export const innerWidth = (slotW = STANDARD_SLOT_W) => 9 * slotW
export const boardWidth = (slotW = STANDARD_SLOT_W) => innerWidth(slotW) + 2 * LEFT

// The widest slot that lets the board fit `columns`; the narrowest where
// nothing does, or where the region is not laid out yet (0) the widest.
export function slotWidthFor(columns: number) {
  if (columns <= 0 || columns >= boardWidth(5)) return 5
  if (columns >= boardWidth(4)) return 4
  return 3
}

export function layout(mode: Mode, slotW = STANDARD_SLOT_W) {
  const n = GRID_SIZE[mode]
  const gridX = LEFT + Math.floor((innerWidth(slotW) - (n * slotW + 2 * slotW + 2)) / 2)
  const arrowX = gridX + n * slotW + 1
  const resultX = arrowX + slotW + 1
  const resultY = CRAFT_TOP + n - 1
  const infoY = CRAFT_TOP + n * SLOT_H
  const invY = infoY + 2
  const hotY = invY + 3 * SLOT_H + 1
  const buttonsY = hotY + SLOT_H + 1
  return { n, gridX, arrowX, resultX, resultY, infoY, invY, hotY, buttonsY, height: buttonsY + SLOT_H + 1 }
}

// The top-left cell of a slot.
export function spotCorner(mode: Mode, spot: Spot, slotW = STANDARD_SLOT_W) {
  const l = layout(mode, slotW)
  if (spot.area === 'result') return { x: l.resultX, y: l.resultY }
  if (spot.area === 'grid') return { x: l.gridX + (spot.index % l.n) * slotW, y: CRAFT_TOP + Math.floor(spot.index / l.n) * SLOT_H }
  const top = spot.index >= HOTBAR_START ? l.hotY : l.invY + Math.floor(spot.index / 9) * SLOT_H
  return { x: LEFT + (spot.index % 9) * slotW, y: top }
}

// The middle of a slot, where a pointer aiming at it ends up.
export function spotCenter(mode: Mode, spot: Spot, slotW = STANDARD_SLOT_W) {
  const corner = spotCorner(mode, spot, slotW)
  return { x: corner.x + slotW / 2, y: corner.y + SLOT_H / 2 }
}

export function spotAt(mode: Mode, x: number, y: number, slotW = STANDARD_SLOT_W): Spot | null {
  const l = layout(mode, slotW)
  const inside = (left: number, top: number) => x >= left && x < left + slotW && y >= top && y < top + SLOT_H
  if (inside(l.resultX, l.resultY)) return { area: 'result', index: 0 }
  for (let r = 0; r < l.n; r++) {
    for (let c = 0; c < l.n; c++) {
      if (inside(l.gridX + c * slotW, CRAFT_TOP + r * SLOT_H)) return { area: 'grid', index: r * l.n + c }
    }
  }
  if (x < LEFT || x >= LEFT + innerWidth(slotW)) return null
  const column = Math.floor((x - LEFT) / slotW)
  for (let r = 0; r < 3; r++) if (y >= l.invY + r * SLOT_H && y < l.invY + (r + 1) * SLOT_H) return { area: 'inv', index: r * 9 + column }
  if (y >= l.hotY && y < l.hotY + SLOT_H) return { area: 'inv', index: HOTBAR_START + column }
  return null
}

// A point of the 5-wide board where the board is drawn narrower: across,
// scaled about the margin; down, the same.
export function scalePoint(point: { x: number; y: number }, slotW: number) {
  return { x: LEFT + ((point.x - LEFT) * slotW) / STANDARD_SLOT_W, y: point.y }
}

export const sameSpot = (a: Spot | null, b: Spot | null) => !!a && !!b && a.area === b.area && a.index === b.index
