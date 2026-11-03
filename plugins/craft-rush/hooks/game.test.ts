import { expect, test } from 'claude-code/testing'

import {
  GRID_SIZE,
  HOTBAR_START,
  IDLE,
  RECIPES,
  click,
  craftAll,
  deliver,
  gather,
  matchRecipe,
  newBoard,
  quickMove,
  spread,
  takeResult,
} from './game'
import type { Board, Mode, Slot } from './game'
import { SPRITES } from './sprites'

const stack = (item: string, count = 1) => ({ item, count })

function board(mode: Mode, inv: Record<number, Slot> = {}, grid: Slot[] = []): Board {
  const size = GRID_SIZE[mode] ** 2
  return {
    ...IDLE,
    phase: 'play',
    mode,
    inv: IDLE.inv.map((_, i) => inv[i] ?? null),
    grid: Array.from({ length: size }, (_, i) => grid[i] ?? null),
  }
}

test('every recipe has a picture for what it makes and what it takes', async () => {
  for (const r of RECIPES) {
    expect(SPRITES[r.output]).toBeDefined()
    for (const row of r.pattern) for (const item of row) if (item) expect(SPRITES[item]).toBeDefined()
  }
})

test('no two recipes of a mode share a pattern', async () => {
  for (const mode of ['small', 'table'] as const) {
    const seen = new Set<string>()
    for (const r of RECIPES) {
      if (r.shapeless) continue
      const key = JSON.stringify(r.pattern)
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
    expect(seen.size).toBeGreaterThan(mode === 'small' ? 5 : 30)
  }
})

test('the grid matches anywhere in it, mirrored too', async () => {
  const log = stack('log')
  expect(matchRecipe(board('table', {}, [null, null, null, null, null, null, null, null, log]).grid, 'table')?.output).toBe('planks')
  const P = stack('planks')
  const S = stack('stick')
  // An axe, and the same axe the other way round.
  expect(matchRecipe(board('table', {}, [P, P, null, P, S, null, null, S, null]).grid, 'table')?.output).toBe('axe_wood')
  expect(matchRecipe(board('table', {}, [null, P, P, null, S, P, null, S, null]).grid, 'table')?.output).toBe('axe_wood')
  // A pickaxe does not fit the small grid.
  expect(matchRecipe(board('small', {}, [P, P, null, S]).grid, 'small')).toBeUndefined()
  // A book takes its paper and leather in any order.
  const paper = stack('paper')
  expect(matchRecipe(board('small', {}, [stack('leather'), paper, paper, paper]).grid, 'small')?.output).toBe('book')
})

test('a left click picks a stack up and puts it down', async () => {
  let b = board('table', { 0: stack('log', 5) })
  b = click(b, 'inv', 0, 'left')
  expect(b.cursor).toEqual(stack('log', 5))
  expect(b.inv[0]).toBeNull()
  b = click(b, 'inv', 3, 'left')
  expect(b.inv[3]).toEqual(stack('log', 5))
  expect(b.cursor).toBeNull()
})

test('a right click takes half, or lays one', async () => {
  let b = board('table', { 0: stack('cobble', 7) })
  b = click(b, 'inv', 0, 'right')
  expect(b.cursor).toEqual(stack('cobble', 4))
  expect(b.inv[0]).toEqual(stack('cobble', 3))
  b = click(b, 'grid', 0, 'right')
  b = click(b, 'grid', 1, 'right')
  expect(b.grid[0]).toEqual(stack('cobble', 1))
  expect(b.cursor).toEqual(stack('cobble', 2))
})

test('stacks merge up to 64 and other items swap', async () => {
  let b = board('table', { 0: stack('planks', 60), 1: stack('planks', 10), 2: stack('iron', 3) })
  b = click(b, 'inv', 1, 'left')
  b = click(b, 'inv', 0, 'left')
  expect(b.inv[0]).toEqual(stack('planks', 64))
  expect(b.cursor).toEqual(stack('planks', 6))
  b = click(b, 'inv', 2, 'left')
  expect(b.inv[2]).toEqual(stack('planks', 6))
  expect(b.cursor).toEqual(stack('iron', 3))
})

test('a drag shares a stack out evenly, a right drag lays one each', async () => {
  let b: Board = { ...board('table'), cursor: stack('planks', 10) }
  const spots = [0, 1, 3].map(index => ({ area: 'grid' as const, index }))
  b = spread(b, spots, 'left')
  expect(b.grid.slice(0, 4)).toEqual([stack('planks', 3), stack('planks', 3), null, stack('planks', 3)])
  expect(b.cursor).toEqual(stack('planks', 1))

  let r: Board = { ...board('table'), cursor: stack('stick', 5) }
  r = spread(r, spots, 'right')
  expect(r.grid[3]).toEqual(stack('stick', 1))
  expect(r.cursor).toEqual(stack('stick', 2))
})

test('taking the result crafts once onto the pointer', async () => {
  let b = board('table', {}, [stack('log', 3)])
  b = takeResult(b, 1)
  expect(b.cursor).toEqual(stack('planks', 4))
  expect(b.grid[0]).toEqual(stack('log', 2))
  expect(b.score).toBe(1)
  b = takeResult(b, 2)
  expect(b.cursor).toEqual(stack('planks', 8))
  // Holding something else, the result stays where it is.
  const held = takeResult({ ...b, cursor: stack('iron') }, 3)
  expect(held.grid[0]).toEqual(stack('log', 1))
})

test('a shift click on the result crafts all it can into the inventory', async () => {
  let b = board('table', {}, [stack('log', 5)])
  b = craftAll(b, 1)
  expect(b.grid[0]).toBeNull()
  expect(b.crafts).toBe(5)
  expect(b.inv[HOTBAR_START]).toEqual(stack('planks', 20))
  expect(b.lastCraft).toMatchObject({ item: 'planks', count: 20, points: 5 })
})

test('tools take one slot each', async () => {
  const P = stack('planks', 2)
  const S = stack('stick', 2)
  let b = board('table', {}, [P, P, P, null, S, null, null, S, null])
  b = craftAll(b, 1)
  expect(b.crafts).toBe(2)
  expect(b.inv[HOTBAR_START]).toEqual(stack('pickaxe_wood'))
  expect(b.inv[HOTBAR_START + 1]).toEqual(stack('pickaxe_wood'))
})

test('a shift click moves a stack between storage and hotbar', async () => {
  let b = board('table', { 4: stack('coal', 3) })
  b = quickMove(b, 'inv', 4)
  expect(b.inv[4]).toBeNull()
  expect(b.inv[HOTBAR_START]).toEqual(stack('coal', 3))
  b = quickMove(b, 'inv', HOTBAR_START)
  expect(b.inv[0]).toEqual(stack('coal', 3))
})

test('a double click gathers the item into the pointer', async () => {
  let b = board('table', { 0: stack('string', 2), 5: stack('string', 3) }, [stack('string', 1)])
  b = { ...b, cursor: stack('string', 1) }
  b = gather(b)
  expect(b.cursor).toEqual(stack('string', 7))
  expect(b.inv[0]).toBeNull()
  expect(b.grid[0]).toBeNull()
})

test('a round starts in storage, and a delivery joins its stacks or the hotbar', async () => {
  let rolls = 0
  const random = () => (rolls++ * 0.37) % 1
  const b = newBoard('table', 0, 0, random)
  expect(b.grid).toHaveLength(9)
  expect(b.inv.slice(0, HOTBAR_START).some(slot => slot !== null)).toBe(true)
  expect(b.inv.slice(HOTBAR_START).every(slot => slot === null)).toBe(true)

  const total = (board: Board) => board.inv.reduce((sum, slot) => sum + (slot?.count ?? 0), 0)
  const after = deliver(b, 10_000, random)
  const brought = after.lastDrop?.items.reduce((sum, s) => sum + s.count, 0) ?? 0
  expect(brought).toBeGreaterThan(1)
  expect(total(after)).toBe(total(b) + brought)

  const fresh = deliver(board('table'), 10_000, random)
  expect(fresh.inv.slice(HOTBAR_START).some(slot => slot !== null)).toBe(true)
})
