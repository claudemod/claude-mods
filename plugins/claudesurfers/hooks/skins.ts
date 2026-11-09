// The buddies a person can surf as, and what each one takes to get.
import type { Profile } from '../types'

export type Unlock = { cost: number } | { best: number } | { runs: number } | { everyone: true } | { free: true }

// A little picture worn on the buddy, `at` its top-left on the buddy's grid.
export type Wear = { at: [number, number]; rows: string[]; ink: Record<string, string> }

export type Skin = {
  id: string
  name: string
  color: string
  unlock: Unlock
  wear?: Wear
  eye?: string
  isSheer?: boolean
}

export const SKINS: readonly Skin[] = [
  { id: 'claude', name: 'Claude', color: '#D97757', unlock: { free: true } },
  {
    id: 'explorer',
    name: 'Explorer',
    color: '#6A9BCC',
    unlock: { cost: 75 },
    wear: { at: [2, -4], rows: ['...hhhhhhhhh...', '...hhhhhhhhh...', '...ddddddddd...', '.hhhhhhhhhhhhh.'], ink: { h: '#8A6A48', d: '#4E3A26' } },
  },
  {
    id: 'planner',
    name: 'Planner',
    color: '#7D9B63',
    unlock: { cost: 150 },
    wear: { at: [3, -4], rows: ['...bb........', '..bbbbbbbb...', '.bbbbbbbbbbb.', 'bbbbbbbbbbbbb'], ink: { b: '#3F5A34' } },
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    color: '#8C7DB8',
    unlock: { cost: 300 },
    wear: { at: [5, 2], rows: ['kkkk.kkkk', 'k..k.k..k', 'k..kkk..k', 'k..k.k..k', 'k..k.k..k', 'kkkk.kkkk'], ink: { k: '#2A2438' } },
  },
  {
    id: 'builder',
    name: 'Builder',
    color: '#C9A24B',
    unlock: { cost: 500 },
    wear: { at: [3, -4], rows: ['.....ooo.....', '...ooooooo...', '..ooooooooo..', 'ooooooooooooo'], ink: { o: '#E8732E' } },
  },
  {
    id: 'debugger',
    name: 'Debugger',
    color: '#CC7A9B',
    unlock: { cost: 800 },
    wear: { at: [5, -4], rows: ['k.......k', 'kk.....kk', '..k...k..', '...k.k...'], ink: { k: '#3A2230' } },
  },
  {
    id: 'haiku',
    name: 'Haiku',
    color: '#EFE8DA',
    unlock: { cost: 1200 },
    wear: { at: [7, -5], rows: ['.p.p.', 'ppypp', '.ppp.', '..g..', '..g..'], ink: { p: '#E58FA0', y: '#EFC24E', g: '#5E7D4E' } },
  },
  {
    id: 'sonnet',
    name: 'Sonnet',
    color: '#5B7FC7',
    unlock: { cost: 2000 },
    wear: { at: [11, -5], rows: ['.....w', '....ww', '...ww.', '.www..', 'k.....'], ink: { w: '#F5F0E8', k: '#2A2438' } },
  },
  {
    id: 'opus',
    name: 'Opus',
    color: '#2E2A26',
    eye: '#F5F0E8',
    unlock: { cost: 3500 },
    wear: { at: [6, -4], rows: ['g..g..g', 'g..g..g', 'ggrgrgg', 'ggggggg'], ink: { g: '#E3B341', r: '#C2453C' } },
  },
  {
    id: 'terminal',
    name: 'Terminal',
    color: '#141413',
    eye: '#7EE787',
    unlock: { best: 5000 },
    wear: { at: [7, 7], rows: ['g....', '.g...', 'g.ggg'], ink: { g: '#7EE787' } },
  },
  { id: 'ghost', name: 'Ghost', color: '#C7CFD6', isSheer: true, unlock: { runs: 30 } },
  {
    id: 'golden',
    name: 'Golden',
    color: '#E3B341',
    unlock: { everyone: true },
    wear: { at: [6, -4], rows: ['w..w..w', 'w..w..w', 'wwwwwww', 'wwwwwww'], ink: { w: '#FFF3C4' } },
  },
]

export const skinOf = (id: string) => SKINS.find(s => s.id === id) ?? SKINS[0]!

export const EMPTY: Profile = { best: 0, bank: 0, owned: [], selected: 'claude', runs: 0 }

export function isUnlocked(skin: Skin, p: Profile): boolean {
  const u = skin.unlock
  if ('free' in u) return true
  if ('cost' in u) return p.owned.includes(skin.id)
  if ('best' in u) return p.best >= u.best
  if ('runs' in u) return p.runs >= u.runs
  return SKINS.every(s => s.id === skin.id || isUnlocked(s, p))
}

// A buddy bought, or the same profile where it cannot be.
export function buy(p: Profile, id: string): Profile {
  const skin = SKINS.find(s => s.id === id)
  if (!skin || !('cost' in skin.unlock) || isUnlocked(skin, p) || p.bank < skin.unlock.cost) return p
  return { ...p, bank: p.bank - skin.unlock.cost, owned: [...p.owned, id], selected: id }
}

export function select(p: Profile, id: string): Profile {
  const skin = SKINS.find(s => s.id === id)
  return skin && isUnlocked(skin, p) ? { ...p, selected: id } : p
}

// The cheapest buddy still to buy, for the goal shown after a run.
export function nextGoal(p: Profile): { skin: Skin; cost: number } | null {
  let goal: { skin: Skin; cost: number } | null = null
  for (const skin of SKINS) {
    if (!('cost' in skin.unlock) || isUnlocked(skin, p)) continue
    if (!goal || skin.unlock.cost < goal.cost) goal = { skin, cost: skin.unlock.cost }
  }
  return goal
}

// A stored profile, whatever an earlier version left.
export function shape(stored: unknown): Profile {
  const s = (stored ?? {}) as Partial<Profile>
  const known = new Set(SKINS.map(skin => skin.id))
  const owned = Array.isArray(s.owned) ? s.owned.filter(id => typeof id === 'string' && known.has(id)) : []
  return {
    best: Math.max(0, Number(s.best) || 0),
    bank: Math.max(0, Number(s.bank) || 0),
    owned,
    selected: typeof s.selected === 'string' && known.has(s.selected) ? s.selected : 'claude',
    runs: Math.max(0, Number(s.runs) || 0),
  }
}
