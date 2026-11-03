// The game itself, as pure functions of the board: the recipes, the random
// inventory and deliveries, and the slots handled the way a block game's
// inventory is: a click picks up a stack or puts it down, a right click takes
// half or lays one, a drag shares a stack out, a shift click moves it across.
import type { Material } from './sprites'

export type Mode = 'small' | 'table'
export type Stack = { item: string; count: number }
export type Slot = Stack | null
export type Area = 'inv' | 'grid' | 'result'

export const GRID_SIZE: Record<Mode, number> = { small: 2, table: 3 }
export const ROUND_MS: Record<Mode, number> = { small: 60_000, table: 90_000 }
// How often a delivery comes, and when the first one does.
export const DROP_MS: Record<Mode, number> = { small: 5_000, table: 6_000 }
const FIRST_DROP_MS = 2_500
// The inventory: three rows of storage, then the hotbar.
export const INV_SLOTS = 36
export const HOTBAR_START = 27

export type Board = {
  phase: 'menu' | 'play' | 'over'
  mode: Mode
  inv: Slot[]
  grid: Slot[]
  // The stack the pointer carries.
  cursor: Slot
  score: number
  crafts: number
  endsAt: number
  nextDropAt: number
  // A delivery, and the recipe whose ingredients it brought whole, if any.
  lastDrop: { items: Stack[]; at: number; kit?: string } | null
  lastCraft: { item: string; count: number; points: number; at: number } | null
  // The best score of the mode when the round began.
  best: number
  endReason: 'time' | 'quit' | null
  // A round the demo's bot plays: it keeps no record.
  isDemo: boolean
}

export type Recipe = {
  output: string
  count: number
  points: number
  // Rows of the pattern, tight, `null` for an empty slot.
  pattern: (string | null)[][]
  // For a recipe whose items may lie anywhere.
  shapeless?: string[]
  // Recipes of one kind (the five pickaxes) share a family in the book.
  family?: string
}

function recipe(output: string, shape: string[], key: Record<string, string>, points: number, count = 1, family?: string): Recipe {
  const pattern = shape.map(row => [...row].map(char => (char === '.' ? null : key[char]!)))
  return { output, count, points, pattern, family }
}

const TIERS: { material: Material; item: string }[] = [
  { material: 'wood', item: 'planks' },
  { material: 'stone', item: 'cobble' },
  { material: 'iron', item: 'iron' },
  { material: 'gold', item: 'gold' },
  { material: 'diamond', item: 'diamond' },
]

const TOOLS: Record<string, { shape: string[]; points: number[] }> = {
  pickaxe: { shape: ['MMM', '.S.', '.S.'], points: [5, 7, 11, 13, 22] },
  axe: { shape: ['MM', 'MS', '.S'], points: [5, 7, 11, 13, 22] },
  shovel: { shape: ['M', 'S', 'S'], points: [3, 4, 7, 8, 14] },
  hoe: { shape: ['MM', '.S', '.S'], points: [3, 5, 8, 9, 15] },
  sword: { shape: ['M', 'M', 'S'], points: [4, 6, 9, 11, 18] },
}

const ARMOR: Record<string, { shape: string[]; points: number[] }> = {
  helmet: { shape: ['MMM', 'M.M'], points: [10, 12, 20] },
  chestplate: { shape: ['M.M', 'MMM', 'MMM'], points: [18, 22, 36] },
  leggings: { shape: ['MMM', 'M.M', 'M.M'], points: [15, 18, 30] },
  boots: { shape: ['M.M', 'M.M'], points: [8, 10, 16] },
}

const P = 'planks'
const S = 'stick'

export const RECIPES: Recipe[] = [
  recipe('planks', ['L'], { L: 'log' }, 1, 4),
  recipe('stick', ['P', 'P'], { P }, 1, 4),
  recipe('table', ['PP', 'PP'], { P }, 4),
  recipe('torch', ['C', 'S'], { C: 'coal', S }, 2, 4),
  recipe('plate', ['PP'], { P }, 2),
  recipe('shears', ['.I', 'I.'], { I: 'iron' }, 4),
  recipe('flint_and_steel', ['I.', '.F'], { I: 'iron', F: 'flint' }, 5),
  recipe('redstone_torch', ['R', 'S'], { R: 'redstone', S }, 3),
  recipe('wool', ['TT', 'TT'], { T: 'string' }, 4),
  recipe('button_wood', ['P'], { P }, 1),
  recipe('button_stone', ['C'], { C: 'cobble' }, 1),
  recipe('plate_stone', ['CC'], { C: 'cobble' }, 2),
  recipe('sugar', ['S'], { S: 'sugarcane' }, 1),
  { output: 'book', count: 1, points: 6, pattern: [['paper', 'paper'], ['paper', 'leather']], shapeless: ['paper', 'paper', 'paper', 'leather'] },
  recipe('paper', ['CCC'], { C: 'sugarcane' }, 3, 3),
  recipe('bread', ['WWW'], { W: 'wheat' }, 4),
  recipe('chest', ['PPP', 'P.P', 'PPP'], { P }, 8),
  recipe('furnace', ['CCC', 'C.C', 'CCC'], { C: 'cobble' }, 8),
  recipe('ladder', ['S.S', 'SSS', 'S.S'], { S }, 5, 3),
  recipe('fence', ['PSP', 'PSP'], { P, S }, 4, 3),
  recipe('door', ['PP', 'PP', 'PP'], { P }, 5, 3),
  recipe('boat', ['P.P', 'PPP'], { P }, 6),
  recipe('bowl', ['P.P', '.P.'], { P }, 3, 4),
  recipe('bow', ['.ST', 'S.T', '.ST'], { S, T: 'string' }, 9),
  recipe('bucket', ['I.I', '.I.'], { I: 'iron' }, 9),
  recipe('minecart', ['I.I', 'III'], { I: 'iron' }, 12),
  recipe('cauldron', ['I.I', 'I.I', 'III'], { I: 'iron' }, 16),
  recipe('rail', ['I.I', 'ISI', 'I.I'], { I: 'iron', S }, 12, 16),
  recipe('shield', ['PIP', 'PPP', '.P.'], { P, I: 'iron' }, 10),
  recipe('compass', ['.I.', 'IRI', '.I.'], { I: 'iron', R: 'redstone' }, 12),
  recipe('clock', ['.G.', 'GRG', '.G.'], { G: 'gold', R: 'redstone' }, 14),
  recipe('bookshelf', ['PPP', 'BBB', 'PPP'], { P, B: 'book' }, 20),
  recipe('jukebox', ['PPP', 'PDP', 'PPP'], { P, D: 'diamond' }, 14),
  recipe('hay', ['WWW', 'WWW', 'WWW'], { W: 'wheat' }, 12),
  ...Object.entries(TOOLS).flatMap(([tool, { shape, points }]) =>
    TIERS.map(({ material, item }, tier) => recipe(`${tool}_${material}`, shape, { M: item, S }, points[tier]!, 1, tool)),
  ),
  ...Object.entries(ARMOR).flatMap(([piece, { shape, points }]) =>
    TIERS.slice(2).map(({ material, item }, tier) => recipe(`${piece}_${material}`, shape, { M: item }, points[tier]!, 1, piece)),
  ),
  recipe('block_iron', ['III', 'III', 'III'], { I: 'iron' }, 20, 1, 'block'),
  recipe('block_gold', ['GGG', 'GGG', 'GGG'], { G: 'gold' }, 24, 1, 'block'),
  recipe('block_diamond', ['DDD', 'DDD', 'DDD'], { D: 'diamond' }, 40, 1, 'block'),
]

export function fits(r: Recipe, mode: Mode) {
  const size = GRID_SIZE[mode]
  if (r.shapeless) return r.shapeless.length <= size * size
  return r.pattern.length <= size && r.pattern.every(row => row.length <= size)
}

const SINGLE = /^(pickaxe|axe|shovel|hoe|sword|helmet|chestplate|leggings|boots)_|^(shears|flint_and_steel|bow|boat|shield|minecart)$/

// How many of an item one slot holds.
export function maxStack(item: string) {
  if (SINGLE.test(item)) return 1
  if (item === 'bucket') return 16
  return 64
}

export type Random = () => number

// The same run of numbers for the same seed (mulberry32), so a round can be
// played again exactly.
export function seeded(seed: number): Random {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function between(random: Random, low: number, high: number) {
  return low + Math.floor(random() * (high - low + 1))
}

// What a round starts with: [item, fewest, most]. Besides, a round starts
// with the ingredients of a few recipes, so something can be made at once.
const START: Record<Mode, [string, number, number][]> = {
  small: [
    ['log', 5, 9],
    ['cobble', 3, 6],
    ['coal', 2, 4],
    ['iron', 2, 4],
    ['string', 2, 6],
    ['flint', 1, 2],
    ['redstone', 1, 3],
    ['paper', 2, 4],
    ['leather', 1, 2],
    ['sugarcane', 1, 3],
  ],
  table: [
    ['log', 6, 10],
    ['cobble', 6, 12],
    ['iron', 4, 8],
    ['gold', 1, 4],
    ['diamond', 1, 3],
    ['coal', 2, 5],
    ['string', 2, 5],
    ['wheat', 3, 8],
    ['sugarcane', 3, 6],
    ['leather', 1, 3],
    ['redstone', 1, 3],
    ['flint', 0, 2],
  ],
}
const START_KITS: Record<Mode, number> = { small: 2, table: 3 }

// How likely each item is in a delivery.
const DROPS: Record<Mode, [string, number][]> = {
  small: [
    ['log', 5],
    ['cobble', 3],
    ['coal', 2.5],
    ['iron', 2],
    ['string', 2],
    ['paper', 1.5],
    ['sugarcane', 1.5],
    ['redstone', 1.2],
    ['leather', 1],
    ['flint', 1],
  ],
  table: [
    ['log', 5],
    ['cobble', 4],
    ['iron', 3],
    ['wheat', 2.5],
    ['coal', 2],
    ['sugarcane', 2],
    ['gold', 1.5],
    ['string', 1.5],
    ['leather', 1.2],
    ['redstone', 1.2],
    ['diamond', 1],
    ['flint', 0.8],
  ],
}

// Items that come by the handful rather than one at a time.
const BULK = new Set(['log', 'cobble', 'wheat', 'sugarcane', 'string', 'paper', 'coal'])
// How likely a delivery brings the whole of one recipe's ingredients.
const KIT_CHANCE = 0.6

// The base items of a mode, for the book.
export function baseItems(mode: Mode) {
  return DROPS[mode].map(([item]) => item)
}

function pick(random: Random, weights: [string, number][]) {
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = random() * total
  for (const [item, weight] of weights) {
    roll -= weight
    if (roll < 0) return item
  }
  return weights[weights.length - 1]![0]
}

// The ingredients of one craft of a recipe.
function ingredients(r: Recipe): Stack[] {
  const counts = new Map<string, number>()
  for (const item of r.shapeless ?? r.pattern.flat()) if (item) counts.set(item, (counts.get(item) ?? 0) + 1)
  return [...counts].map(([item, count]) => ({ item, count }))
}

// A recipe worth handing the ingredients of: one that fits the grid and needs
// more than one item, the cheaper ones likelier; never a block of nine.
function pickKit(mode: Mode, random: Random): Recipe | undefined {
  const weights = RECIPES.filter(r => fits(r, mode) && r.family !== 'block' && ingredients(r).reduce((n, s) => n + s.count, 0) > 1).map(
    r => [r, r.points <= 6 ? 3 : r.points <= 12 ? 2 : 1] as const,
  )
  const total = weights.reduce((sum, [, w]) => sum + w, 0)
  let roll = random() * total
  for (const [r, w] of weights) {
    roll -= w
    if (roll < 0) return r
  }
  return weights[weights.length - 1]?.[0]
}

export const IDLE: Board = {
  phase: 'menu',
  mode: 'table',
  inv: Array.from({ length: INV_SLOTS }, () => null),
  grid: [],
  cursor: null,
  score: 0,
  crafts: 0,
  endsAt: 0,
  nextDropAt: 0,
  lastDrop: null,
  lastCraft: null,
  best: 0,
  endReason: null,
  isDemo: false,
}

// Puts `count` of `item` into the slots at `order`: onto stacks of it first,
// then into empty slots. Answers the slots and what did not fit.
function store(slots: Slot[], order: number[], item: string, count: number): { slots: Slot[]; left: number } {
  const next = [...slots]
  const max = maxStack(item)
  let left = count
  for (const i of order) {
    const here = next[i]
    if (left === 0) break
    if (here && here.item === item && here.count < max) {
      const moved = Math.min(left, max - here.count)
      next[i] = { item, count: here.count + moved }
      left -= moved
    }
  }
  for (const i of order) {
    if (left === 0) break
    if (!next[i]) {
      const moved = Math.min(left, max)
      next[i] = { item, count: moved }
      left -= moved
    }
  }
  return { slots: next, left }
}

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i)
// Where picked-up items go: the hotbar first, then storage.
const PICKUP_ORDER = [...range(HOTBAR_START, INV_SLOTS), ...range(0, HOTBAR_START)]

export function addToInventory(b: Board, item: string, count: number): { board: Board; left: number } {
  const { slots, left } = store(b.inv, PICKUP_ORDER, item, count)
  return { board: { ...b, inv: slots }, left }
}

export function newBoard(
  mode: Mode,
  now: number,
  best: number,
  random: Random = Math.random,
  options: { roundMs?: number; isDemo?: boolean } = {},
): Board {
  let board: Board = {
    ...IDLE,
    phase: 'play',
    mode,
    grid: Array.from({ length: GRID_SIZE[mode] ** 2 }, () => null),
    endsAt: now + (options.roundMs ?? ROUND_MS[mode]),
    nextDropAt: now + FIRST_DROP_MS,
    best,
    isDemo: options.isDemo ?? false,
  }
  // The start lies in storage, as if gathered, with random gaps between.
  const slots = [...board.inv]
  const free = range(0, HOTBAR_START)
  for (const [item, low, high] of START[mode]) {
    let count = between(random, low, high)
    while (count > 0 && free.length > 0) {
      const at = free.splice(Math.floor(random() * free.length), 1)[0]!
      const here = Math.min(count, maxStack(item))
      slots[at] = { item, count: here }
      count -= here
    }
  }
  let inv = slots
  for (let i = 0; i < START_KITS[mode]; i++) {
    const kit = pickKit(mode, random)
    for (const stack of kit ? ingredients(kit) : []) inv = store(inv, range(0, HOTBAR_START), stack.item, stack.count).slots
  }
  board = { ...board, inv }
  return board
}

// ---- matching ----

function trim(grid: readonly Slot[], size: number) {
  const rows: (string | null)[][] = []
  for (let r = 0; r < size; r++) rows.push(grid.slice(r * size, r * size + size).map(slot => slot?.item ?? null))
  const used = (cells: (string | null)[]) => cells.some(cell => cell !== null)
  const top = rows.findIndex(used)
  if (top === -1) return []
  const bottom = rows.length - 1 - [...rows].reverse().findIndex(used)
  const columns = Array.from({ length: size }, (_, c) => rows.map(row => row[c]!))
  const left = columns.findIndex(used)
  const right = size - 1 - [...columns].reverse().findIndex(used)
  return rows.slice(top, bottom + 1).map(row => row.slice(left, right + 1))
}

function same(a: (string | null)[][], b: (string | null)[][]) {
  return a.length === b.length && a.every((row, r) => row.length === b[r]!.length && row.every((cell, c) => cell === b[r]![c]))
}

export function matchRecipe(grid: readonly Slot[], mode: Mode): Recipe | undefined {
  const pattern = trim(grid, GRID_SIZE[mode])
  if (pattern.length === 0) return undefined
  const mirrored = pattern.map(row => [...row].reverse())
  const items = grid.filter((slot): slot is Stack => slot !== null).map(slot => slot.item).sort()
  return RECIPES.find(r => {
    if (!fits(r, mode)) return false
    if (r.shapeless) return same([items], [[...r.shapeless].sort()])
    return same(pattern, r.pattern) || same(mirrored, r.pattern)
  })
}

// ---- crafting ----

// Takes one craft's ingredients off the grid.
function consume(grid: readonly Slot[]): Slot[] {
  return grid.map(slot => (slot && slot.count > 1 ? { item: slot.item, count: slot.count - 1 } : null))
}

function scored(b: Board, r: Recipe, now: number, times = 1): Board {
  return {
    ...b,
    score: b.score + r.points * times,
    crafts: b.crafts + times,
    lastCraft: { item: r.output, count: r.count * times, points: r.points * times, at: now },
  }
}

// A click on the result: one craft onto the pointer, if it can carry it.
export function takeResult(b: Board, now: number): Board {
  const r = matchRecipe(b.grid, b.mode)
  if (!r) return b
  const held = b.cursor
  if (held && (held.item !== r.output || held.count + r.count > maxStack(r.output))) return b
  const cursor = { item: r.output, count: (held?.count ?? 0) + r.count }
  return scored({ ...b, grid: consume(b.grid), cursor }, r, now)
}

// A shift click on the result: craft again and again, straight into the
// inventory, while the grid still makes it and there is room.
export function craftAll(b: Board, now: number): Board {
  let board = b
  let times = 0
  let r = matchRecipe(board.grid, board.mode)
  const first = r
  while (r && first && r.output === first.output && times < 64) {
    const { board: stored, left } = addToInventory(board, r.output, r.count)
    if (left > 0) break
    board = { ...stored, grid: consume(board.grid) }
    times++
    r = matchRecipe(board.grid, board.mode)
  }
  return first && times > 0 ? scored(board, first, now, times) : b
}

// ---- clicks ----

function slotsOf(b: Board, area: Area) {
  return area === 'inv' ? b.inv : b.grid
}

function withSlots(b: Board, area: Area, slots: Slot[]): Board {
  return area === 'inv' ? { ...b, inv: slots } : { ...b, grid: slots }
}

// A left or right click on an inventory or grid slot.
export function click(b: Board, area: Area, index: number, button: 'left' | 'right'): Board {
  if (b.phase !== 'play') return b
  const slots = [...slotsOf(b, area)]
  const here = slots[index] ?? null
  const held = b.cursor
  let cursor = held
  if (!held) {
    if (!here) return b
    if (button === 'left') {
      cursor = here
      slots[index] = null
    } else {
      const taken = Math.ceil(here.count / 2)
      cursor = { item: here.item, count: taken }
      slots[index] = here.count - taken > 0 ? { item: here.item, count: here.count - taken } : null
    }
  } else if (!here) {
    if (button === 'left') {
      slots[index] = held
      cursor = null
    } else {
      slots[index] = { item: held.item, count: 1 }
      cursor = held.count > 1 ? { item: held.item, count: held.count - 1 } : null
    }
  } else if (here.item === held.item) {
    const room = maxStack(here.item) - here.count
    const moved = Math.min(room, button === 'left' ? held.count : 1)
    if (moved <= 0) return b
    slots[index] = { item: here.item, count: here.count + moved }
    cursor = held.count - moved > 0 ? { item: held.item, count: held.count - moved } : null
  } else {
    slots[index] = held
    cursor = here
  }
  return { ...withSlots(b, area, slots), cursor }
}

// A shift click: the stack moves across, from the grid into the inventory,
// from storage to the hotbar, from the hotbar to storage.
export function quickMove(b: Board, area: Area, index: number): Board {
  if (b.phase !== 'play') return b
  const here = slotsOf(b, area)[index]
  if (!here) return b
  if (area === 'grid') {
    const { board, left } = addToInventory(b, here.item, here.count)
    const grid = [...b.grid]
    grid[index] = left > 0 ? { item: here.item, count: left } : null
    return { ...board, grid }
  }
  const toHotbar = index < HOTBAR_START
  const order = toHotbar ? range(HOTBAR_START, INV_SLOTS) : range(0, HOTBAR_START)
  const inv = [...b.inv]
  inv[index] = null
  const { slots, left } = store(inv, order, here.item, here.count)
  if (left > 0) slots[index] = { item: here.item, count: left }
  return { ...b, inv: slots }
}

// A drag with a stack: a left drag shares it out evenly over the slots it
// crossed, a right drag lays one in each.
export function spread(b: Board, targets: { area: Area; index: number }[], button: 'left' | 'right'): Board {
  const held = b.cursor
  if (b.phase !== 'play' || !held) return b
  const max = maxStack(held.item)
  const open = targets.filter(({ area, index }) => {
    const here = slotsOf(b, area)[index]
    return !here || (here.item === held.item && here.count < max)
  })
  if (open.length === 0) return b
  const each = button === 'right' ? 1 : Math.max(1, Math.floor(held.count / open.length))
  let board = b
  let left = held.count
  for (const { area, index } of open) {
    if (left === 0) break
    const slots = [...slotsOf(board, area)]
    const here = slots[index]
    const moved = Math.min(each, left, max - (here?.count ?? 0))
    slots[index] = { item: held.item, count: (here?.count ?? 0) + moved }
    left -= moved
    board = withSlots(board, area, slots)
  }
  return { ...board, cursor: left > 0 ? { item: held.item, count: left } : null }
}

// A double click with a stack: it gathers that item from every slot, up to a full stack.
export function gather(b: Board): Board {
  const held = b.cursor
  if (b.phase !== 'play' || !held) return b
  const max = maxStack(held.item)
  let count = held.count
  const take = (slots: Slot[]) =>
    slots.map(slot => {
      if (!slot || slot.item !== held.item || count >= max) return slot
      const moved = Math.min(slot.count, max - count)
      count += moved
      return slot.count - moved > 0 ? { item: slot.item, count: slot.count - moved } : null
    })
  const grid = take(b.grid)
  const inv = take(b.inv)
  return { ...b, grid, inv, cursor: { item: held.item, count } }
}

// ---- the round ----

// A delivery: three to five random items, the common ones by the handful,
// and often the whole of one recipe's ingredients. What finds no room is lost.
export function deliver(b: Board, now: number, random: Random = Math.random): Board {
  if (b.phase !== 'play') return b
  const items: Stack[] = []
  const bring = (item: string, count: number) => {
    const known = items.find(stack => stack.item === item)
    if (known) known.count += count
    else items.push({ item, count })
  }
  const kit = random() < KIT_CHANCE ? pickKit(b.mode, random) : undefined
  for (const stack of kit ? ingredients(kit) : []) bring(stack.item, stack.count)
  const picks = 3 + (random() < 0.5 ? 1 : 0) + (random() < 0.25 ? 1 : 0)
  for (let i = 0; i < picks; i++) {
    const item = pick(random, DROPS[b.mode])
    bring(item, BULK.has(item) ? between(random, 2, 4) : 1)
  }
  let board = b
  for (const stack of items) board = addToInventory(board, stack.item, stack.count).board
  return { ...board, lastDrop: { items, at: now, ...(kit ? { kit: kit.output } : {}) }, nextDropAt: now + DROP_MS[b.mode] }
}

export function finish(b: Board, reason: 'time' | 'quit'): Board {
  if (b.phase !== 'play') return b
  return { ...b, phase: 'over', endReason: reason, cursor: null }
}
