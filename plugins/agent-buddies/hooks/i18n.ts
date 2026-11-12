import type { Kind, Lang } from '../types'

export function languageOf(tag: string): Lang {
  return tag.toLowerCase().startsWith('de') ? 'de' : 'en'
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

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
        calls: (n: number) => plural(n, 'Tool-Aufruf', 'Tool-Aufrufe'),
        starting: 'Startet …',
        steps: (n: number) => plural(n, 'Schritt', 'Schritte'),
        tokens: (n: string) => `${n} Tokens`,
        errors: (n: number) => plural(n, 'Fehler', 'Fehler'),
        more: (n: number) => `+ ${plural(n, 'weitere Zeile', 'weitere Zeilen')}`,
        less: 'weniger anzeigen',
        back: 'Alle',
        task: 'AUFTRAG',
        flow: 'ABLAUF',
        result: 'ERGEBNIS',
        waiting: 'Arbeitet noch …',
        noSteps: 'Noch keine Schritte.',
        earlier: '… {n} frühere Schritte',
        percent: (n: number, isExact: boolean) => `${isExact ? '' : '~'}${n} %`,
        todos: (done: number, total: number) => `${done} von ${total} Aufgaben`,
        history: (n: number) => `geschätzt nach ${n} früheren Agenten`,
        rough: 'grob geschätzt',
        explore: 'Erkunden',
        kinds: { read: 'Lesen', search: 'Suchen', edit: 'Ändern', run: 'Ausführen', web: 'Web', tool: 'Tools' } as Record<Kind, string>,
        phase: (kind: Kind, n: number) =>
          kind === 'read'
            ? plural(n, 'Datei', 'Dateien')
            : kind === 'search'
              ? plural(n, 'Suche', 'Suchen')
              : kind === 'edit'
                ? plural(n, 'Änderung', 'Änderungen')
                : kind === 'run'
                  ? plural(n, 'Befehl', 'Befehle')
                  : kind === 'web'
                    ? plural(n, 'Seite', 'Seiten')
                    : plural(n, 'Aufruf', 'Aufrufe'),
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
        calls: (n: number) => plural(n, 'tool call', 'tool calls'),
        starting: 'Starting …',
        steps: (n: number) => plural(n, 'step', 'steps'),
        tokens: (n: string) => `${n} tokens`,
        errors: (n: number) => plural(n, 'error', 'errors'),
        more: (n: number) => `+ ${plural(n, 'more line', 'more lines')}`,
        less: 'show less',
        back: 'All',
        task: 'TASK',
        flow: 'FLOW',
        result: 'RESULT',
        waiting: 'Still working …',
        noSteps: 'No steps yet.',
        earlier: '… {n} earlier steps',
        percent: (n: number, isExact: boolean) => `${isExact ? '' : '~'}${n}%`,
        todos: (done: number, total: number) => `${done} of ${total} tasks`,
        history: (n: number) => `estimated from ${n} earlier agents`,
        rough: 'rough estimate',
        explore: 'Exploring',
        kinds: { read: 'Reading', search: 'Searching', edit: 'Editing', run: 'Running', web: 'Web', tool: 'Tools' } as Record<Kind, string>,
        phase: (kind: Kind, n: number) =>
          kind === 'read'
            ? plural(n, 'file', 'files')
            : kind === 'search'
              ? plural(n, 'search', 'searches')
              : kind === 'edit'
                ? plural(n, 'edit', 'edits')
                : kind === 'run'
                  ? plural(n, 'command', 'commands')
                  : kind === 'web'
                    ? plural(n, 'page', 'pages')
                    : plural(n, 'call', 'calls'),
      }
}

export type Words = ReturnType<typeof wordsFor>
