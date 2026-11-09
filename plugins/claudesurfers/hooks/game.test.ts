import { expect, test } from 'claude-code/testing'

import { sceneSvg, viewFor } from './art'
import { botStep } from './bot'
import { act, heightOf, newRun, step, GRACE_MS, JUMP_MS } from './game'
import type { Kind, Run } from './game'
import { EMPTY, SKINS, buy, isUnlocked, nextGoal, select, shape } from './skins'

const FRAME = 40

function with1(kind: Kind, lane: number, z: number, lift = 0): Run {
  return { ...newRun(1), things: [{ id: 999, kind, lane, z, lift }], nextRow: 1e9, nextPower: 1e9 }
}

function advance(r: Run, ms: number) {
  let out = r
  for (let t = 0; t < ms; t += FRAME) out = step(out, FRAME)
  return out
}

test('a wall in the lane ends the run and names what did it', async () => {
  const r = advance(with1('wall', 0, 3), 400)
  expect(r.phase).toBe('over')
  expect(r.crash).toBe('wall')
})

test('moving aside passes a wall', async () => {
  const r = advance(act(with1('wall', 0, 6), 'left'), 700)
  expect(r.phase).toBe('play')
})

test('a jump clears a low barrier, and standing still does not', async () => {
  expect(advance(with1('low', 0, 3), 400).phase).toBe('over')
  // Timed for the barrier to arrive near the top of the jump.
  const r = advance(act(with1('low', 0, 5.5), 'jump'), JUMP_MS)
  expect(r.phase).toBe('play')
})

test('ducking passes under a high gate, and standing still does not', async () => {
  expect(advance(with1('high', 0, 3), 400).phase).toBe('over')
  expect(advance(act(with1('high', 0, 3), 'duck'), 400).phase).toBe('play')
})

test('a fast run cannot pass through a thing between two frames', async () => {
  const r = { ...with1('wall', 0, 2), speed: 46 }
  expect(step(r, 120).phase === 'over' || advance(r, 300).phase === 'over').toBe(true)
})

test('a jump pressed a moment too late still clears the barrier', async () => {
  // The barrier reaches the surfer on the second frame; the key comes a frame after.
  const r0 = step(step(with1('low', 0, 1), FRAME), FRAME)
  let r = step(r0, FRAME)
  expect(r.phase).toBe('play')
  expect(r.grace).not.toBeNull()
  r = act(r, 'jump')
  r = advance(r, GRACE_MS * 2)
  expect(r.phase).toBe('play')
  expect(r.grace).toBeNull()
})

test('a jump right before the barrier and one long before it both clear it', async () => {
  // Pressed when it is a frame away, and when it is most of a jump away.
  expect(advance(act(with1('low', 0, 1), 'jump'), 500).phase).toBe('play')
  expect(advance(act(with1('low', 0, 9.5), 'jump'), JUMP_MS).phase).toBe('play')
})

test('a late dodge out of a wall still counts, and no dodge does not', async () => {
  let r = advance(with1('wall', 0, 1), 120)
  expect(r.phase).toBe('play')
  r = advance(act(r, 'left'), GRACE_MS * 2)
  expect(r.phase).toBe('play')
  expect(advance(with1('wall', 0, 1), 120 + GRACE_MS * 2).phase).toBe('over')
})

test('the jump rises and comes back', async () => {
  expect(heightOf(0)).toBe(0)
  expect(heightOf(JUMP_MS / 2)).toBeGreaterThan(2.5)
  expect(heightOf(JUMP_MS)).toBe(0)
})

test('tokens count once and add to the score', async () => {
  const r = advance(with1('token', 0, 3, 0.4), 400)
  expect(r.tokens).toBe(1)
  expect(r.score).toBeGreaterThan(10)
  expect(r.things.some(t => t.kind === 'token' && t.z > r.dist)).toBe(false)
})

test('a shield takes one hit and is gone', async () => {
  const shielded = { ...with1('wall', 0, 3), shield: true }
  const r = advance(shielded, 400)
  expect(r.phase).toBe('play')
  expect(r.shield).toBe(false)
  expect(r.blink).toBeGreaterThan(0)
})

test('the dash smashes what is in the way', async () => {
  const r = advance({ ...with1('wall', 0, 5), fast: 2000 }, 300)
  expect(r.phase).toBe('play')
  expect(r.score).toBeGreaterThan(25)
})

test('the magnet draws tokens from the other lanes', async () => {
  const r = advance({ ...with1('token', 1, 8, 0.4), magnet: 4000 }, 700)
  expect(r.tokens).toBe(1)
})

test('every stretch of stream can be passed: a bot survives minutes of it', async () => {
  for (let seed = 1; seed <= 40; seed++) {
    let r = newRun(seed * 7919)
    for (let t = 0; t < 180_000 && r.phase === 'play'; t += FRAME) r = step(botStep(r), FRAME)
    if (r.phase !== 'play') throw new Error(`seed ${seed} crashed on ${r.crash} after ${Math.round(r.t / 1000)}s`)
  }
})

test('a run pays out enough tokens to buy the first buddy within a few runs', async () => {
  let r = newRun(4242)
  for (let t = 0; t < 60_000 && r.phase === 'play'; t += FRAME) r = step(botStep(r), FRAME)
  expect(r.tokens).toBeGreaterThan(20)
})

test('one frame stays well inside what a drawing may carry', async () => {
  let r = newRun(77)
  let longest = 0
  for (let t = 0; t < 90_000 && r.phase === 'play'; t += FRAME) {
    r = step(botStep(r), FRAME)
    if (t % 400 === 0) for (const view of [viewFor(60, 27), viewFor(200, 50), viewFor(46, 60)]) longest = Math.max(longest, sceneSvg({ run: r, skinId: 'opus', t, view, overlay: '' }).length)
  }
  expect(longest).toBeGreaterThan(1000)
  expect(longest).toBeLessThan(60_000)
})

test('buying spends tokens, selects the buddy and refuses what it cannot afford', async () => {
  const rich = { ...EMPTY, bank: 100 }
  const bought = buy(rich, 'explorer')
  expect(bought.bank).toBe(25)
  expect(bought.owned).toEqual(['explorer'])
  expect(bought.selected).toBe('explorer')
  expect(buy(rich, 'opus')).toBe(rich)
  expect(buy(bought, 'explorer')).toBe(bought)
})

test('selecting works only for a buddy that is unlocked', async () => {
  expect(select(EMPTY, 'opus').selected).toBe('claude')
  expect(select({ ...EMPTY, owned: ['opus'] }, 'opus').selected).toBe('opus')
})

test('earned buddies come from their feat, not from tokens', async () => {
  const terminal = SKINS.find(s => s.id === 'terminal')!
  const ghost = SKINS.find(s => s.id === 'ghost')!
  expect(isUnlocked(terminal, { ...EMPTY, bank: 99999 })).toBe(false)
  expect(isUnlocked(terminal, { ...EMPTY, best: 5000 })).toBe(true)
  expect(isUnlocked(ghost, { ...EMPTY, runs: 30 })).toBe(true)
  expect(buy({ ...EMPTY, bank: 99999 }, 'terminal').owned).toEqual([])
})

test('golden takes every other buddy', async () => {
  const golden = SKINS.find(s => s.id === 'golden')!
  const owned = SKINS.filter(s => 'cost' in s.unlock).map(s => s.id)
  expect(isUnlocked(golden, { ...EMPTY, owned })).toBe(false)
  expect(isUnlocked(golden, { ...EMPTY, owned, best: 5000, runs: 30 })).toBe(true)
})

test('the goal is the cheapest buddy left', async () => {
  expect(nextGoal(EMPTY)?.skin.id).toBe('explorer')
  expect(nextGoal({ ...EMPTY, owned: ['explorer'] })?.skin.id).toBe('planner')
})

test('a damaged or older profile is read safely', async () => {
  expect(shape(undefined)).toEqual(EMPTY)
  expect(shape({ best: 'x', bank: -4, owned: ['opus', 'nobody', 3], selected: 'nobody' })).toEqual({ ...EMPTY, owned: ['opus'] })
})

test('the view always fills the pane: wide shows more beach, tall more sky', async () => {
  const wide = viewFor(200, 40)
  expect(wide.h).toBe(300)
  expect(wide.w).toBeGreaterThan(240)
  expect(wide.left).toBeLessThan(0)
  const tall = viewFor(40, 70)
  expect(tall.w).toBe(240)
  expect(tall.top).toBeLessThan(0)
  // The world's own 240 by 300 is always in the picture.
  for (const v of [wide, tall, viewFor(60, 27)]) {
    expect(v.left).toBeLessThanOrEqual(0)
    expect(v.left + v.w).toBeGreaterThanOrEqual(240)
    expect(Math.abs(v.top + v.h - 300)).toBeLessThan(0.5)
  }
})
