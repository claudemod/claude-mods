// Where each mode tile sits: shared by the band (to size the field) and the
// field itself (to draw the tiles and to know what the pointer is on).
// Across in columns (1ch), down in rows (1lh, inside the field).

// From the top: the line with the traffic light on the left and what the
// pointer is on beside it (one row), half a row of air, then all tiles in one
// row right above the prompt box: the tile (one and a half rows) with the name
// under it (one row).
export const INFO_ROWS = 1
export const TILES_Y = 1.5
export const TILE_ROWS = 1.5
export const NAME_ROWS = 1
export const TILE_GAP = 1
// The tile picture, in pixels (a row is about 20 on the desktop).
export const TILE_PX = 28
// The traffic light and its number take this many columns on the info line.
export const LIGHT_COLUMNS = 10

// The names are drawn a size smaller than a column is measured in.
export function tileWidth(label: string) {
  return Math.max(5, Math.ceil([...label].length * 0.85) + 1)
}

export type Placed = { id: string; x: number; w: number }

// The tiles in one row, centred in `columns`. Where they would not fit, the
// gaps go first, then every tile gives up the same share.
export function layoutTiles(items: readonly { id: string; label: string }[], columns: number) {
  let widths = items.map(item => tileWidth(item.label))
  let gap = TILE_GAP
  const total = () => widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1)
  if (total() > columns) gap = 0
  if (total() > columns && widths.length > 0) {
    const sum = widths.reduce((s, w) => s + w, 0)
    widths = widths.map(w => Math.max(3, Math.floor((w * columns) / sum)))
  }
  let x = Math.max(0, Math.floor((columns - total()) / 2))
  const placed: Placed[] = items.map((item, i) => {
    const w = widths[i] ?? 3
    const at = { id: item.id, x, w }
    x += w + gap
    return at
  })
  return { placed, gap, left: placed[0]?.x ?? 0 }
}

// The width the field needs to hold every tile in one row.
export function oneLineWidth(items: readonly { label: string }[]) {
  return items.reduce((sum, p, i) => sum + tileWidth(p.label) + (i > 0 ? TILE_GAP : 0), 0)
}

// What the pointer is on: a tile, the traffic light, or nothing.
export function targetAt(placed: readonly Placed[], x: number, y: number): string | undefined {
  if (y < INFO_ROWS) {
    const left = placed[0]?.x ?? 0
    return x >= left && x < left + LIGHT_COLUMNS ? LIGHT : undefined
  }
  if (y < TILES_Y + TILE_ROWS + NAME_ROWS) return placed.find(p => x >= p.x && x < p.x + p.w)?.id
  return undefined
}

export const LIGHT = '#light'
