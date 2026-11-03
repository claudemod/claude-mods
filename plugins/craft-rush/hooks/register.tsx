import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { BoardMessage, BoardProps, Mode, Records } from '../types'
import { RECIPES, fits } from './game'
import { familyName, itemName, languageOf, wordsFor } from './i18n'
import type { Lang, Words } from './i18n'
import { bookSvgs } from './sprites'
import type { BookEntry } from './sprites'

const PANE = 'craft-rush'
const BOARD = 'board'

const records = atom({ plugin: 'craft-rush', key: 'records' } as const, { small: 0, table: 0 })
// The language the game speaks: the `language` option, or the system's when it is `auto`.
const language = atom({ plugin: 'craft-rush', key: 'language' } as const, 'en')
const start = atom({ plugin: 'craft-rush', key: 'start' } as const, null)
const showBook = atom({ plugin: 'craft-rush', key: 'showBook' } as const, false)
const bookMode = atom({ plugin: 'craft-rush', key: 'bookMode' } as const, 'table')

// The best scores, kept across sessions.
const RECORDS = 'records'

// The round being played, as the board last told it: what a pane closed
// mid-round still counts.
let live: { mode: Mode; score: number } | null = null

async function keepScore($: EngineInterface, mode: Mode, score: number) {
  const best = await update($, records, r => ({ ...r, [mode]: Math.max(r[mode], score) }))
  await $.store.set(RECORDS, best)
  return best
}

// The system's language: a locale variable when one is set, else the first of
// macOS's preferred languages, else the runtime's own locale. German is
// German, everything else English.
async function systemLanguage($: EngineInterface): Promise<Lang> {
  const unset = () => undefined
  const variable =
    (await $.env.get('LC_ALL').catch(unset)) ??
    (await $.env.get('LC_MESSAGES').catch(unset)) ??
    (await $.env.get('LANG').catch(unset))
  if (variable && !/^(C|POSIX)([._]|$)/.test(variable)) return languageOf(variable)

  const mac = await $.process.run(['defaults', 'read', '-g', 'AppleLanguages'], { timeoutMs: 3000 }).catch(unset)
  const preferred = mac?.exitCode === 0 ? /\(\s*"?([A-Za-z_-]+)/.exec(mac.stdout)?.[1] : undefined
  return languageOf(preferred ?? Intl.DateTimeFormat().resolvedOptions().locale)
}

function modeOf(args: string): Mode | undefined {
  const arg = args.trim().toLowerCase()
  if (/^(2|klein|small|inv)/.test(arg)) return 'small'
  if (/^(3|werkbank|table|craft|gro|big)/.test(arg)) return 'table'
  return undefined
}

// One book entry per recipe of the mode; the materials of a tool or a piece
// of armor, and the three blocks, share one entry that shows the iron one.
export function bookEntries(lang: Lang, words: Words, mode: Mode): BookEntry[] {
  const families = new Set<string>()
  const entries: BookEntry[] = []
  for (const r of RECIPES) {
    if (!fits(r, mode)) continue
    if (r.family === undefined) {
      entries.push({ shape: r.pattern, output: r.output, count: r.count, label: itemName(lang, r.output), points: words.each(r.points) })
      continue
    }
    if (families.has(r.family)) continue
    families.add(r.family)
    const members = RECIPES.filter(other => other.family === r.family)
    const shown = members.find(other => other.output.endsWith('iron')) ?? r
    const points = members.map(other => other.points)
    entries.push({
      shape: shown.pattern,
      output: shown.output,
      count: shown.count,
      label: familyName(lang, r.family),
      points: words.range(Math.min(...points), Math.max(...points)),
    })
  }
  return entries
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)

    const chosen = options.language
    const lang = chosen === 'de' || chosen === 'en' ? chosen : await systemLanguage($)
    await update($, language, () => lang)

    const stored = (await $.store.get(RECORDS)) as Partial<Records> | undefined
    await update($, records, r => ({
      small: Math.max(r.small, Number(stored?.small) || 0),
      table: Math.max(r.table, Number(stored?.table) || 0),
    }))

    const words = wordsFor(lang)
    await $.command.register({
      name: 'craft',
      description: words.description,
      argumentHint: words.argumentHint,
      immediate: true,
    })

    return result
  })

  on('command.run', { command: 'craft' }, async ($, e) => {
    const now = await $.clock.now()
    // `/craft demo`, or `/craft demo en` in a language of its own: the bot
    // plays a round for a recording, where the `demo` option is on; a build
    // that leaves it off has no demo.
    const demo = options.demo === 'on' ? /^demo(?:\s+(de|en))?\b/i.exec(e.args.trim()) : null
    const mode = demo ? 'table' : modeOf(e.args)
    const demoLang = demo?.[1]?.toLowerCase() as Lang | undefined
    await update($, start, () =>
      mode ? { mode, nonce: now, ...(demo ? { isDemo: true } : {}), ...(demoLang ? { lang: demoLang } : {}) } : null,
    )
    await $.ui.open({ id: PANE, title: 'Craft Rush', focus: true })

    return { text: wordsFor(await read($, language)).opened }
  })

  on('ui.message', async ($, e, next) => {
    if (e.requestId !== PANE || e.element !== BOARD) return next(e)
    const message = e.data as BoardMessage
    const words = wordsFor(await read($, language))
    switch (message.kind) {
      case 'started':
        live = message.isDemo ? null : { mode: message.mode, score: 0 }
        await update($, bookMode, () => message.mode)
        await update($, start, () => null)
        break
      case 'score':
        live = { mode: message.mode, score: message.score }
        break
      case 'over':
        live = null
        await keepScore($, message.mode, message.score)
        break
      case 'quit': {
        live = null
        const best = await keepScore($, message.mode, message.score)
        $.ui.toast(words.quitToast(message.score, best[message.mode]))
        await $.ui.close({ id: PANE })
        break
      }
      case 'book':
        await update($, showBook, shown => !shown)
        break
      case 'close':
        await $.ui.close({ id: PANE })
        break
    }
    return {}
  })

  // A pane closed in the middle of a round still counts what was scored.
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && live) {
      const { mode, score } = live
      live = null
      const best = await keepScore($, mode, score)
      $.ui.toast(wordsFor(await read($, language)).quitToast(score, best[mode]))
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    const lang = await read($, language)
    const words = wordsFor(lang)
    if (!('Client' in elements)) {
      return <Text>{words.unsupported}</Text>
    }
    const { Client } = elements
    const Svg = 'Svg' in elements ? elements.Svg : undefined
    const isBookShown = await read($, showBook)
    const mode = await read($, bookMode)
    const props: BoardProps = {
      lang,
      best: await read($, records),
      start: await read($, start),
      surface: e.surface,
      showBook: isBookShown,
    }
    const width = Math.max(200, Math.min(440, e.props.bodyColumns * 7))

    return (
      <Box flexDirection="column" gap={1}>
        {/* As wide as the pane, so the board knows the room it has. */}
        <Client key={BOARD} module="./board.tsx" props={props} width="100%" />
        {isBookShown && Svg && (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="column">
              {bookSvgs(bookEntries(lang, words, mode), width).map((source, i) => (
                <Svg source={source} alt={`${words.book} ${i + 1}`} width={width} />
              ))}
            </Box>
            {mode === 'table' && <Text dimColor>{words.allMaterials}</Text>}
          </Box>
        )}
      </Box>
    )
  })
}
