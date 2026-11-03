import { expect, test } from 'claude-code/testing'

import { DEMO_MS, DEMO_RECORD, DEMO_TICK_MS, advanceDemo, plan, startDemo } from './bot'
import type { DemoRun } from './bot'
import { IDLE } from './game'
import type { Board } from './game'

// Plays the demo to its end; what it made, in order.
function playOut(): { run: DemoRun; made: string[] } {
  let run = startDemo()
  const made: string[] = []
  let last = run.board.lastCraft
  while (run.board.phase === 'play' && run.now < DEMO_MS + 5_000) {
    run = advanceDemo(run, DEMO_TICK_MS)
    if (run.board.lastCraft && run.board.lastCraft !== last) {
      last = run.board.lastCraft
      made.push(last.item)
    }
  }
  return { run, made }
}

test('the demo plays a whole round and beats its record', async () => {
  const { run, made } = playOut()
  expect(run.board.phase).toBe('over')
  expect(run.board.isDemo).toBe(true)
  expect(run.board.score).toBeGreaterThan(DEMO_RECORD)
  expect(made.some(item => item.endsWith('_diamond'))).toBe(true)
  expect(made.length).toBeGreaterThan(5)
})

test('the same seed plays the same round', async () => {
  const first = playOut()
  const second = playOut()
  expect(second.made).toEqual(first.made)
  expect(second.run.board.score).toBe(first.run.board.score)
})

test('the bot puts away what it holds and clears the grid before anything else', async () => {
  const board: Board = { ...IDLE, phase: 'play', mode: 'table', grid: Array.from({ length: 9 }, () => null) }
  expect(plan({ ...board, cursor: { item: 'log', count: 3 } }, 0)).toEqual([{ kind: 'stash' }])
  const grid = [...board.grid]
  grid[4] = { item: 'stick', count: 2 }
  expect(plan({ ...board, grid }, 0)).toEqual([{ kind: 'clear', index: 4 }])
})

test('the bot crafts a whole stack of logs at once', async () => {
  const inv = IDLE.inv.map((_, i) => (i === 0 ? { item: 'log', count: 6 } : null))
  const board: Board = { ...IDLE, phase: 'play', mode: 'table', inv, grid: Array.from({ length: 9 }, () => null) }
  expect(plan(board, 0)).toEqual([
    { kind: 'pick', item: 'log' },
    { kind: 'lay', index: 4, isWhole: true },
    { kind: 'craft' },
  ])
})
