import type { Lang } from '../types'

export function languageOf(tag: string): Lang {
  return tag.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export function wordsFor(lang: Lang) {
  return lang === 'de'
    ? {
        title: 'Agenten',
        empty: 'Noch keine Agenten. Sobald Claude welche losschickt, tauchen sie hier auf.',
        opened: 'Agent Buddies ist offen.',
        count: (running: number, done: number) => `${running} ${running === 1 ? 'läuft' : 'laufen'} · ${done} fertig`,
        running: 'Läuft',
        done: (seconds: number) => `Fertig · ${seconds} s`,
        stopped: 'Gestoppt',
        failed: 'Fehler',
        calls: (n: number) => `${n} Tool-Aufruf${n === 1 ? '' : 'e'}`,
        starting: 'Startet …',
      }
    : {
        title: 'Agents',
        empty: 'No agents yet. As soon as Claude sends some out, they show up here.',
        opened: 'Agent Buddies is open.',
        count: (running: number, done: number) => `${running} running · ${done} done`,
        running: 'Running',
        done: (seconds: number) => `Done · ${seconds}s`,
        stopped: 'Stopped',
        failed: 'Failed',
        calls: (n: number) => `${n} tool call${n === 1 ? '' : 's'}`,
        starting: 'Starting …',
      }
}
