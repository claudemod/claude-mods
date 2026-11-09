// A surfer that plays by itself: the menu's background, and the proof in the
// tests that every stretch of stream can be passed.
import { DUCK_MS, act, isObstacle } from './game'
import type { Kind, Run, Thing } from './game'

const costOf = (kind: Kind | undefined) => (kind === undefined ? 0 : kind === 'wall' ? 100 : 1)

// The next row of obstacles ahead of the surfer.
function nextRow(r: Run): Thing[] {
  const ahead = r.things.filter(t => isObstacle(t.kind) && t.z > r.dist)
  if (ahead.length === 0) return []
  const z = Math.min(...ahead.map(t => t.z))
  return ahead.filter(t => t.z === z)
}

export function botStep(r: Run): Run {
  const row = nextRow(r)
  if (row.length === 0) return r
  const inLane = (lane: number) => row.find(t => t.lane === lane)?.kind
  const best = [-1, 0, 1].sort((a, b) => costOf(inLane(a)) - costOf(inLane(b)) || Math.abs(a - r.lane) - Math.abs(b - r.lane))[0]!

  let next = r
  if (best < next.lane) next = act(next, 'left')
  else if (best > next.lane) next = act(next, 'right')

  const kind = inLane(best)
  const seconds = (row[0]!.z - r.dist) / r.speed
  if (kind === 'low' && seconds < 0.2 && r.air === 0) next = act(next, 'jump')
  if (kind === 'high' && seconds < DUCK_MS / 1000 / 2 && r.duck === 0) next = act(next, 'duck')
  return next
}
