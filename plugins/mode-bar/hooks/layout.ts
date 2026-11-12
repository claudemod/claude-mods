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

// How the row is drawn, from the most room to the least: tiles with their
// names under them, evenly spaced; the same as tight as their names allow;
// tiles alone (the active mode's name then stands on the info line); smaller
// tiles; and the smallest, side by side. The tiles always stay in one row.
export type Fit = 'even' | 'named' | 'icons' | 'small' | 'tiny'
export type Layout = { placed: Placed[]; gap: number; left: number; fit: Fit; tilePx: number; tileRows: number; hasNames: boolean }

const SIZES: Record<Exclude<Fit, 'even' | 'named'>, { w: number; px: number; rows: number }> = {
  icons: { w: 4, px: TILE_PX, rows: TILE_ROWS },
  small: { w: 3, px: 22, rows: 1.25 },
  tiny: { w: 2, px: 15, rows: 1 },
}
// On a wide window the tiles get more air between them, up to this.
const MAX_GAP = 3

function place(items: readonly { id: string }[], widths: readonly number[], gap: number, columns: number) {
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1)
  let x = Math.max(0, Math.floor((columns - total) / 2))
  return items.map((item, i) => {
    const w = widths[i] ?? 2
    const at = { id: item.id, x, w }
    x += w + gap
    return at
  })
}

// The tiles in one row, centred in `columns`, in the roomiest way that fits.
export function layoutTiles(items: readonly { id: string; label: string }[], columns: number): Layout {
  const n = items.length
  const gaps = Math.max(1, n - 1)
  const result = (fit: Fit, widths: number[], gap: number, tile: { px: number; rows: number }): Layout => {
    const placed = place(items, widths, gap, columns)
    return { placed, gap, left: placed[0]?.x ?? 0, fit, tilePx: tile.px, tileRows: tile.rows, hasNames: fit === 'even' || fit === 'named' }
  }
  const named = items.map(item => tileWidth(item.label))
  const widest = Math.max(4, ...named)
  // Every tile as wide as the widest name: the icons stand on an even grid.
  for (let gap = MAX_GAP; gap >= 1; gap--) {
    if (n * widest + gap * (n - 1) <= columns) return result('even', named.map(() => widest), gap, { px: TILE_PX, rows: TILE_ROWS })
  }
  const sum = named.reduce((s, w) => s + w, 0)
  if (sum + (n - 1) <= columns) {
    const gap = Math.min(MAX_GAP, Math.max(1, Math.floor((columns - sum) / gaps)))
    return result('named', named, gap, { px: TILE_PX, rows: TILE_ROWS })
  }
  for (const fit of ['icons', 'small', 'tiny'] as const) {
    const size = SIZES[fit]
    for (const gap of [2, 1, 0]) {
      if (n * size.w + gap * (n - 1) <= columns) return result(fit, items.map(() => size.w), gap, size)
    }
  }
  // More modes than even the smallest tiles hold: they share what there is.
  const w = Math.max(1, Math.floor(columns / Math.max(1, n)))
  return result('tiny', items.map(() => w), 0, SIZES.tiny)
}

// The width the field needs to hold every tile in one row.
export function oneLineWidth(items: readonly { label: string }[]) {
  return items.reduce((sum, p, i) => sum + tileWidth(p.label) + (i > 0 ? TILE_GAP : 0), 0)
}

// What the pointer is on: a tile, the traffic light, or nothing.
export function targetAt(layout: Layout, x: number, y: number): string | undefined {
  const { placed } = layout
  if (y < INFO_ROWS) {
    const left = placed[0]?.x ?? 0
    return x >= left && x < left + LIGHT_COLUMNS ? LIGHT : undefined
  }
  if (y < TILES_Y + layout.tileRows + (layout.hasNames ? NAME_ROWS : 0)) return placed.find(p => x >= p.x && x < p.x + p.w)?.id
  return undefined
}

export const LIGHT = '#light'
