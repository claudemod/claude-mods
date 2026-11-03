// The demo: a bot that plays a round of the crafting table by itself, for a
// recording. It runs on a clock of its own, advanced a fixed step a frame, so
// the same seed plays the same round again; it aims a pointer at each slot
// and glides there before it clicks, and pauses after a craft so its points
// can be read.
//
// It plays to score: it weighs every recipe it can make by points for the
// time its clicks take, the precious ones first, a delivery's set of
// ingredients at once, and lays a whole stack and crafts all of it where a
// recipe takes one item of each kind.
import { GRID_SIZE, RECIPES, click, craftAll, deliver, finish, fits, newBoard, quickMove, seeded } from './game'
import type { Board, Random, Recipe, Slot } from './game'
import { spotCenter } from './layout'
import type { Spot } from './layout'

export const DEMO_SEED = 144
export const DEMO_MS = 40_000
// The record the demo starts against: low enough that it ends in a new best.
export const DEMO_RECORD = 150
export const DEMO_TICK_MS = 50

// How long a glide takes, the look of a press, the pause after a craft and
// before the first move.
const GLIDE_MIN_MS = 200
const GLIDE_MAX_MS = 400
const PRESS_MS = 140
const CRAFT_PAUSE_MS = 900
const INTRO_MS = 1_200
// A row is about this many columns tall, for distances on the board.
const ROW_IN_COLUMNS = 2.5
// What one click costs the bot in its weighing, in seconds.
const MOVE_S = (GLIDE_MIN_MS + GLIDE_MAX_MS) / 2 / 1000 + PRESS_MS / 1000

export type BotStep =
  // The biggest stack of an item onto the pointer.
  | { kind: 'pick'; item: string }
  // Into a grid slot: the whole stack the pointer holds, or one of it.
  | { kind: 'lay'; index: number; isWhole: boolean }
  // What the pointer holds back into the inventory.
  | { kind: 'stash' }
  // A shift click on a grid slot: its stack back into the inventory.
  | { kind: 'clear'; index: number }
  // A shift click on the result: everything the grid makes.
  | { kind: 'craft' }

type Point = { x: number; y: number }

export type DemoRun = {
  board: Board
  now: number
  random: Random
  steps: BotStep[]
  pointer: Point
  glide: { from: Point; to: Point; start: number; ms: number; step: BotStep; spot: Spot } | null
  pressed: { spot: Spot; until: number } | null
  waitUntil: number
  // How often the bot has made each thing: it likes to show variety.
  made: Record<string, number>
}

export function startDemo(seed = DEMO_SEED): DemoRun {
  const random = seeded(seed)
  const board = newBoard('table', 0, DEMO_RECORD, random, { roundMs: DEMO_MS, isDemo: true })
  return { board, now: 0, random, steps: [], pointer: { x: 24, y: 22 }, glide: null, pressed: null, waitUntil: INTRO_MS, made: {} }
}

// ---- weighing ----

type Stock = { total: Map<string, number>; biggest: Map<string, number> }

function stockOf(inv: readonly Slot[]): Stock {
  const total = new Map<string, number>()
  const biggest = new Map<string, number>()
  for (const slot of inv) {
    if (!slot) continue
    total.set(slot.item, (total.get(slot.item) ?? 0) + slot.count)
    biggest.set(slot.item, Math.max(biggest.get(slot.item) ?? 0, slot.count))
  }
  return { total, biggest }
}

// Where a recipe's items go: its pattern in the middle of the grid, the grid
// slots of each item in the order they first appear.
function placement(r: Recipe, size: number): Map<string, number[]> {
  const rows = r.pattern
  const top = Math.floor((size - rows.length) / 2)
  const left = Math.floor((size - Math.max(...rows.map(row => row.length))) / 2)
  const slots = new Map<string, number[]>()
  rows.forEach((row, i) =>
    row.forEach((item, j) => {
      if (item) slots.set(item, [...(slots.get(item) ?? []), (top + i) * size + left + j])
    }),
  )
  return slots
}

// Recipes the bot leaves alone: they only turn something useful into a point.
const IDLE_RECIPES = new Set(['button_wood', 'button_stone', 'plate', 'plate_stone', 'sugar', 'bowl'])

type Option = { recipe: Recipe; crafts: number; seconds: number; points: number }

// How the bot would make a recipe from what it holds: how many at once, in
// what time; undefined where it cannot.
function optionFor(r: Recipe, stock: Stock, size: number): Option | undefined {
  const slots = placement(r, size)
  const isOneEach = [...slots.values()].every(at => at.length === 1)
  let crafts = Infinity
  let moves = 1
  for (const [item, at] of slots) {
    const biggest = stock.biggest.get(item) ?? 0
    if (biggest < at.length) return undefined
    if (isOneEach) {
      crafts = Math.min(crafts, biggest)
      moves += 2
    } else {
      crafts = 1
      moves += 1 + at.length + (biggest > at.length ? 1 : 0)
    }
  }
  if (isOneEach && slots.size > 1) moves += 1
  crafts = Math.min(crafts, 64)
  return { recipe: r, crafts, seconds: moves * MOVE_S + CRAFT_PAUSE_MS / 1000, points: r.points * crafts }
}

// How much an option is worth: points a second, less for what the bot made
// before, more for a delivered set made at once.
function worth(o: Option, b: Board, now: number, made: Record<string, number>) {
  let value = (o.points / o.seconds) * 0.55 ** (made[o.recipe.output] ?? 0)
  if (o.recipe.family === 'block') value *= 0.6
  if (b.lastDrop?.kit === o.recipe.output && now - b.lastDrop.at < 8_000) value *= 1.5
  return value
}

const byOutput = (output: string) => RECIPES.find(r => r.output === output)!

// The recipe to make next. Where the best one waits only on sticks or
// planks, those come first.
function choose(b: Board, now: number, made: Record<string, number>): Option | undefined {
  const size = GRID_SIZE[b.mode]
  const stock = stockOf(b.inv)
  let best: { option: Option; value: number } | undefined
  const consider = (option: Option, value: number) => {
    if (!best || value > best.value) best = { option, value }
  }
  const sticks = optionFor(byOutput('stick'), stock, size)
  const planks = optionFor(byOutput('planks'), stock, size)
  for (const r of RECIPES) {
    if (!fits(r, b.mode) || IDLE_RECIPES.has(r.output)) continue
    const option = optionFor(r, stock, size)
    if (option) {
      consider(option, worth(option, b, now, made))
      continue
    }
    // Would sticks, or planks, make it possible?
    for (const helper of [sticks, planks]) {
      if (!helper) continue
      const boosted = new Map(stock.biggest)
      boosted.set(helper.recipe.output, (boosted.get(helper.recipe.output) ?? 0) + helper.recipe.count * helper.crafts)
      const after = optionFor(r, { total: stock.total, biggest: boosted }, size)
      if (!after) continue
      const value = worth({ ...after, seconds: after.seconds + helper.seconds, points: after.points + helper.points }, b, now, made)
      consider(helper, value)
    }
  }
  return best?.option
}

// The clicks of the next thing to do: put away what the pointer holds, clear
// the grid, or lay and craft the best recipe.
export function plan(b: Board, now: number, made: Record<string, number> = {}): BotStep[] {
  if (b.phase !== 'play') return []
  if (b.cursor) return [{ kind: 'stash' }]
  const filled = b.grid.flatMap((slot, index) => (slot ? [index] : []))
  if (filled.length > 0) return filled.map(index => ({ kind: 'clear', index }))
  const option = choose(b, now, made)
  if (!option) return []
  const stock = stockOf(b.inv)
  const slots = placement(option.recipe, GRID_SIZE[b.mode])
  const isOneEach = [...slots.values()].every(at => at.length === 1)
  const steps: BotStep[] = []
  for (const [item, at] of slots) {
    steps.push({ kind: 'pick', item })
    if (isOneEach) {
      steps.push({ kind: 'lay', index: at[0]!, isWhole: true })
      continue
    }
    for (const index of at) steps.push({ kind: 'lay', index, isWhole: false })
    if ((stock.biggest.get(item) ?? 0) > at.length) steps.push({ kind: 'stash' })
  }
  steps.push({ kind: 'craft' })
  return steps
}

// ---- playing ----

// The slot a step aims at, as the board stands now.
function aim(b: Board, step: BotStep): Spot | undefined {
  switch (step.kind) {
    case 'pick': {
      let at = -1
      b.inv.forEach((slot, i) => {
        if (slot && slot.item === step.item && (at < 0 || slot.count > b.inv[at]!.count)) at = i
      })
      return at < 0 ? undefined : { area: 'inv', index: at }
    }
    case 'lay':
      return { area: 'grid', index: step.index }
    case 'clear':
      return b.grid[step.index] ? { area: 'grid', index: step.index } : undefined
    case 'craft':
      return { area: 'result', index: 0 }
    case 'stash': {
      const held = b.cursor
      if (!held) return undefined
      const same = b.inv.findIndex(slot => slot && slot.item === held.item && slot.count + held.count <= 64)
      const empty = b.inv.findIndex(slot => !slot)
      const at = same >= 0 ? same : empty
      return at < 0 ? undefined : { area: 'inv', index: at }
    }
  }
}

function act(b: Board, step: BotStep, spot: Spot, now: number): Board {
  switch (step.kind) {
    case 'pick':
    case 'stash':
      return click(b, 'inv', spot.index, 'left')
    case 'lay':
      return click(b, 'grid', spot.index, step.isWhole ? 'left' : 'right')
    case 'clear':
      return quickMove(b, 'grid', spot.index)
    case 'craft':
      return craftAll(b, now)
  }
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

// The demo a step of its clock later: the round's own clock (its end, its
// deliveries) and the bot's glide, click or pause.
export function advanceDemo(run: DemoRun, dt: number): DemoRun {
  const now = run.now + dt
  let board = run.board
  if (board.phase !== 'play') return { ...run, now }
  if (now >= board.endsAt) return { ...run, now, board: finish(board, 'time'), glide: null, steps: [] }
  if (now >= board.nextDropAt) board = deliver(board, board.nextDropAt, run.random)
  const pressed = run.pressed && run.pressed.until > now ? run.pressed : null
  const next: DemoRun = { ...run, now, board, pressed }

  const glide = run.glide
  if (glide) {
    const t = Math.min(1, (now - glide.start) / glide.ms)
    const e = ease(t)
    next.pointer = { x: glide.from.x + (glide.to.x - glide.from.x) * e, y: glide.from.y + (glide.to.y - glide.from.y) * e }
    if (t < 1) return next
    next.board = act(board, glide.step, glide.spot, now)
    const crafted = next.board.lastCraft
    if (glide.step.kind === 'craft' && crafted && crafted !== board.lastCraft) {
      next.made = { ...run.made, [crafted.item]: (run.made[crafted.item] ?? 0) + 1 }
    }
    next.glide = null
    next.pressed = { spot: glide.spot, until: now + PRESS_MS }
    next.waitUntil = now + (glide.step.kind === 'craft' ? CRAFT_PAUSE_MS : PRESS_MS)
    return next
  }
  if (now < run.waitUntil) return next

  const steps = run.steps.length > 0 ? run.steps : plan(board, now, run.made)
  const step = steps[0]
  if (!step) return { ...next, waitUntil: now + 400 }
  const spot = aim(board, step)
  if (!spot) return { ...next, steps: [] }
  const to = spotCenter(board.mode, spot)
  const distance = Math.hypot(to.x - run.pointer.x, (to.y - run.pointer.y) * ROW_IN_COLUMNS)
  const ms = Math.max(GLIDE_MIN_MS, Math.min(GLIDE_MAX_MS, 160 + distance * 5))
  return { ...next, steps: steps.slice(1), glide: { from: run.pointer, to, start: now, ms, step, spot } }
}
