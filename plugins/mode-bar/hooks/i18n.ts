import type { Lang } from '../types'

export function languageOf(tag: string): Lang {
  return tag.toLowerCase().startsWith('de') ? 'de' : 'en'
}

const NUMBER = {
  de: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }),
  en: new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }),
}

// 950, 12.3k, 1.2M
export function short(lang: Lang, n: number) {
  if (n < 1000) return String(Math.round(n))
  if (n < 1_000_000) return `${NUMBER[lang].format(n >= 100_000 ? Math.round(n / 1000) : n / 1000)}k`
  return `${NUMBER[lang].format(n / 1_000_000)}M`
}

export function wordsFor(lang: Lang) {
  const n = (x: number) => short(lang, x)
  return lang === 'de'
    ? {
        modeOn: (label: string, hint: string) => `Modus ${label}: ${hint}`,
        blocked: (label: string, tool: string) =>
          `Im Modus ${label} sind Dateiänderungen gesperrt (${tool}). Beschreibe die Änderung stattdessen oder bitte darum, den Modus zu wechseln.`,
        modeList: (list: string) => `Modi: ${list}. Wählen mit /modus <Name oder Nummer>, z. B. /modus knapp.`,
        modeUnknown: (word: string, list: string) => `Keinen Modus „${word}“ gefunden. Modi: ${list}.`,
        noTask: 'Noch keine Aufgabe gemessen',
        running: 'Aufgabe läuft',
        last: (s: number) => `Letzte Aufgabe · ${s} s`,
        counts: (steps: number, tools: number) => `${steps} Modell-Schritte · ${tools} Tool-Aufrufe`,
        tokens: (fresh: number, cache: number, out: number) =>
          `Neu gelesen ${n(fresh)} · aus dem Cache ${n(cache)} · geschrieben ${n(out)}`,
        weighted: (w: number) => `Aufwand ${n(w)} (Tokens gewichtet nach Preis)`,
        limit: (p: number) => `≈ ${p} % vom 5-Stunden-Limit`,
        scale: 'Grün unter 50k · Gelb unter 200k · Rot darüber',
      }
    : {
        modeOn: (label: string, hint: string) => `${label} mode: ${hint}`,
        blocked: (label: string, tool: string) =>
          `File changes are blocked in ${label} mode (${tool}). Describe the change instead, or ask to switch modes.`,
        modeList: (list: string) => `Modes: ${list}. Pick one with /mode <name or number>, e.g. /mode brief.`,
        modeUnknown: (word: string, list: string) => `No mode called "${word}". Modes: ${list}.`,
        noTask: 'No task measured yet',
        running: 'Task running',
        last: (s: number) => `Last task · ${s}s`,
        counts: (steps: number, tools: number) => `${steps} model steps · ${tools} tool calls`,
        tokens: (fresh: number, cache: number, out: number) =>
          `Read new ${n(fresh)} · from cache ${n(cache)} · written ${n(out)}`,
        weighted: (w: number) => `Effort ${n(w)} (tokens weighted by price)`,
        limit: (p: number) => `≈ ${p}% of the 5-hour limit`,
        scale: 'Green under 50k · yellow under 200k · red above',
      }
}

export type Words = ReturnType<typeof wordsFor>
