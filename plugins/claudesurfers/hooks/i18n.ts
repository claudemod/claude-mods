// The mod's words in German and English.
import type { Kind } from './game'
import type { Lang } from '../types'

export function languageOf(tag: string): Lang {
  return tag.toLowerCase().startsWith('de') ? 'de' : 'en'
}

type Crash = Record<Extract<Kind, 'low' | 'high' | 'wall'>, string>

export type Words = {
  description: string
  argumentHint: string
  opened: string
  unsupported: string
  start: string
  buddies: string
  close: string
  again: string
  menu: string
  resume: string
  pause: string
  quit: string
  back: string
  best: string
  bestShort: (n: number) => string
  newBest: string
  crashed: string
  crash: Crash
  points: (n: number) => string
  tokens: (n: number) => string
  hint: string
  terminalHint: string
  goal: (name: string, left: number) => string
  goalReady: (name: string) => string
  chosen: string
  owned: string
  buy: (cost: number) => string
  needsBest: (n: number) => string
  needsRuns: (n: number) => string
  needsAll: string
  bank: (n: number) => string
  tooPoor: (left: number) => string
  earnBest: (name: string, n: number) => string
  earnRuns: (name: string, n: number) => string
  earnAll: (name: string) => string
  unlocked: (name: string) => string
  quitToast: (score: number, tokens: number) => string
}

const DE: Words = {
  description: 'ClaudeSurfers: surfen, Tokens sammeln, Buddies freischalten',
  argumentHint: '[buddies]',
  opened: 'ClaudeSurfers ist offen. Klick ins Spiel, dann steuern die Pfeiltasten.',
  unsupported: 'ClaudeSurfers läuft in der Desktop-App und im Terminal.',
  start: 'Los',
  buddies: 'Buddies',
  close: 'Zu',
  again: 'Nochmal',
  menu: 'Menü',
  resume: 'Weiter',
  pause: 'Pause',
  quit: 'Beenden',
  back: 'Zurück',
  best: 'Rekord',
  bestShort: n => `Rekord ${n}`,
  newBest: 'Neuer Rekord!',
  crashed: 'Crash!',
  crash: { low: 'Rate-Limit erwischt', high: 'Permission nicht erteilt', wall: 'Merge-Konflikt' },
  points: n => `${n} Punkte`,
  tokens: n => `◆ ${n}`,
  hint: '← → Spur · ↑ Springen · ↓ Ducken',
  terminalHint: '←/→ Spur · ↑ Springen · ↓ Ducken · p Pause',
  goal: (name, left) => `Noch ${left} bis ${name}`,
  goalReady: name => `${name} kannst du kaufen!`,
  chosen: 'Aktiv',
  owned: 'Wählen',
  buy: cost => `◆ ${cost}`,
  needsBest: n => `★ ${n}`,
  needsRuns: n => `${n} Runs`,
  needsAll: 'Alle',
  bank: n => `◆ ${n}`,
  tooPoor: left => `Dir fehlen noch ${left} Tokens`,
  earnBest: (name, n) => `${name}: erreiche ${n} Punkte`,
  earnRuns: (name, n) => `${name}: spiele ${n} Runs`,
  earnAll: name => `${name}: schalte alle anderen frei`,
  unlocked: name => `Neuer Buddy freigeschaltet: ${name}`,
  quitToast: (score, tokens) => `ClaudeSurfers: ${score} Punkte, ${tokens} Tokens eingesammelt`,
}

const EN: Words = {
  description: 'ClaudeSurfers: surf, collect tokens, unlock buddies',
  argumentHint: '[buddies]',
  opened: 'ClaudeSurfers is open. Click the game, then steer with the arrow keys.',
  unsupported: 'ClaudeSurfers runs in the desktop app and the terminal.',
  start: 'Go',
  buddies: 'Buddies',
  close: 'Close',
  again: 'Again',
  menu: 'Menu',
  resume: 'Resume',
  pause: 'Paused',
  quit: 'Quit',
  back: 'Back',
  best: 'Best',
  bestShort: n => `Best ${n}`,
  newBest: 'New best!',
  crashed: 'Crash!',
  crash: { low: 'Hit a rate limit', high: 'Permission denied', wall: 'Merge conflict' },
  points: n => `${n} points`,
  tokens: n => `◆ ${n}`,
  hint: '← → Lane · ↑ Jump · ↓ Duck',
  terminalHint: '←/→ lane · ↑ jump · ↓ duck · p pause',
  goal: (name, left) => `${left} more for ${name}`,
  goalReady: name => `You can buy ${name}!`,
  chosen: 'Active',
  owned: 'Pick',
  buy: cost => `◆ ${cost}`,
  needsBest: n => `★ ${n}`,
  needsRuns: n => `${n} runs`,
  needsAll: 'All',
  bank: n => `◆ ${n}`,
  tooPoor: left => `${left} more tokens needed`,
  earnBest: (name, n) => `${name}: score ${n} points`,
  earnRuns: (name, n) => `${name}: play ${n} runs`,
  earnAll: name => `${name}: unlock all the others`,
  unlocked: name => `New buddy unlocked: ${name}`,
  quitToast: (score, tokens) => `ClaudeSurfers: ${score} points, ${tokens} tokens collected`,
}

export const wordsFor = (lang: Lang) => (lang === 'de' ? DE : EN)
