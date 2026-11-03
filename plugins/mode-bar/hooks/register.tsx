import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Lang, Mode, PillsProps, Task } from '../types'
import { languageOf, short, wordsFor } from './i18n'
import { LEVEL_COLOR, levelOf, lightSvg, weigh } from './light'
import { NORMAL, parseMode, startMode } from './modes'

// The mode this session is in: each chat starts in Normal, so a mode chosen in
// one chat never changes another.
const mode = atom({ plugin: 'mode-bar', key: 'mode' } as const, NORMAL)
const modes = atom({ plugin: 'mode-bar', key: 'modes' } as const, [])
const task = atom({ plugin: 'mode-bar', key: 'task' } as const, null)
const language = atom({ plugin: 'mode-bar', key: 'language' } as const, 'en')

// The band's grey box is hidden under a ground in the chat's own colour, as the
// XP bar does it: an absolute box reaching past the band's padding (whole
// characters across, whole lines down), the content on a layer above it.
const BLEND_GROUND = 'userMessageBackground'
const BLEND_ACROSS = 6
const BLEND_DOWN = 3

// The pill field's key; it posts `{ kind: 'pick', id }` when a pill is clicked.
const PILLS = 'mode-pills'

const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

// The system's language: a locale variable when one is set, else the first of
// macOS's preferred languages, else the runtime's own locale.
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

// The modes are the files in `modes/`, in the order of their names.
async function loadModes($: EngineInterface): Promise<Mode[]> {
  const dir = `${$.plugin.root}/modes`
  const entries = await $.fs.list(dir).catch(() => [])
  const files = entries
    .filter(entry => entry.kind === 'file' && entry.name.toLowerCase().endsWith('.md'))
    .map(entry => entry.name)
    .sort()
  const loaded: Mode[] = []
  for (const name of files) {
    const source = await $.fs.read(`${dir}/${name}`).catch(() => null)
    const parsed = typeof source === 'string' ? parseMode(name, source) : null
    if (parsed) loaded.push(parsed)
  }
  return loaded
}

async function current($: EngineInterface): Promise<Mode | undefined> {
  const id = await read($, mode)
  return (await read($, modes)).find(m => m.id === id)
}

// A mode named by its id, its English or German label (umlauts or not) or its
// number in the bar.
function normal(word: string) {
  return word.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
}
export function findMode(all: readonly Mode[], word: string): Mode | undefined {
  const n = normal(word.trim())
  if (/^\d+$/.test(n)) return all[Number(n) - 1]
  const plain = (text: string) => normal(text).replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
  return all.find(m => [m.id, m.label.en, m.label.de].some(name => normal(name) === n || plain(name) === plain(n)))
}

// The mode chosen in each chat, kept past the chat's process: the app ends the
// process of a chat left idle and starts a new one with the next message.
const BY_CHAT = 'modeByChat'
const KEEP_MS = 30 * 24 * 3600_000
type ByChat = Record<string, { mode: string; at: number }>

async function chatKey($: EngineInterface) {
  return $.session.id().catch(() => '')
}

async function setMode($: EngineInterface, m: Mode) {
  await update($, mode, () => m.id)
  const key = await chatKey($)
  if (!key) return
  const at = await $.clock.now()
  const stored = ((await $.store.get(BY_CHAT).catch(() => undefined)) ?? {}) as ByChat
  const kept: ByChat = {}
  for (const [k, v] of Object.entries(stored)) if (at - v.at < KEEP_MS) kept[k] = v
  kept[key] = { mode: m.id, at }
  await $.store.set(BY_CHAT, kept).catch(() => undefined)
}

async function storedMode($: EngineInterface): Promise<string | undefined> {
  const key = await chatKey($)
  if (!key) return undefined
  const stored = (await $.store.get(BY_CHAT).catch(() => undefined)) as ByChat | undefined
  return stored?.[key]?.mode
}

async function fiveHour($: EngineInterface) {
  const usage = await $.session.usage().catch(() => null)
  return usage?.rateLimits.find(l => l.kind === 'five_hour')?.percentUsed
}

// `/modus knapp` or `/mode brief`: the mode, then whatever follows as the prompt.
async function pick($: EngineInterface, args: string) {
  let all = await read($, modes)
  if (all.length === 0) {
    all = await loadModes($)
    await update($, modes, () => all)
  }
  const words = wordsFor(await read($, language))
  const lang = await read($, language)
  const list = all.map((m, i) => `${i + 1} ${m.label[lang]}`).join(' · ')
  const [word = '', ...rest] = args.trim().split(/\s+/)
  if (!word) return { text: words.modeList(list) }
  const m = findMode(all, word)
  if (!m) return { text: words.modeUnknown(word, list) }
  await setMode($, m)
  const prompt = args.trim().slice(word.length).trim()
  if (prompt && rest.length > 0) void $.prompt.submit({ text: prompt })
  return { text: words.modeOn(m.label[lang], m.hint[lang]) }
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    // Before the first message a chat has no Claude Code yet, so no bar: the
    // mode can come with the first message instead, as `/modus knapp`.
    await $.command.register({ name: 'mode', description: 'Mode Bar: pick a mode, e.g. /mode brief', argumentHint: '<mode> [prompt]' })
    await $.command.register({ name: 'modus', description: 'Mode Bar: Modus wählen, z. B. /modus knapp', argumentHint: '<Modus> [Prompt]' })
    const result = await next(e)

    const chosen = options.language
    const lang = chosen === 'de' || chosen === 'en' ? chosen : await systemLanguage($)
    await update($, language, () => lang)

    const loaded = await loadModes($)
    await update($, modes, () => loaded)
    // A reload keeps the chosen mode while it still exists; a chat the app
    // started again takes the mode it had.
    const kept = await storedMode($)
    await update($, mode, id => {
      if (id !== NORMAL && loaded.some(m => m.id === id)) return id
      if (kept && loaded.some(m => m.id === kept)) return kept
      return loaded.some(m => m.id === id) ? id : startMode(loaded)
    })

    return result
  })

  // A click on a pill: that mode, with the same toast as a button.
  on('ui.message', async ($, e, next) => {
    if (e.element !== PILLS) return next(e)
    const data = e.data as { kind?: string; id?: string } | null
    const m = (await read($, modes)).find(x => x.id === data?.id)
    if (data?.kind === 'pick' && m) {
      await setMode($, m)
      const lang = await read($, language)
      const hint = m.hint[lang]
      if (hint) $.ui.toast(wordsFor(lang).modeOn(m.label[lang], hint))
    }
    return {}
  })

  on('command.run', { command: 'mode' }, async ($, e) => pick($, e.args))
  on('command.run', { command: 'modus' }, async ($, e) => pick($, e.args))

  // The mode's note rides with each message the person sends, for the model
  // alone. It stays out of the system prompt, which a change would make the
  // whole conversation be read again without the cache.
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta) return next(e)
    const m = await current($)
    if (!m?.text) return next(e)
    return next({ ...e, context: [...(e.context ?? []), `[Mode Bar · ${m.label.en}] ${m.text}`] })
  })

  // A new task for the traffic light whenever the main loop starts a turn.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const startedAt = await $.clock.now()
      const limitStart = await fiveHour($)
      const fresh: Task = {
        startedAt,
        steps: 0,
        tools: 0,
        fresh: 0,
        cacheRead: 0,
        output: 0,
        weighted: 0,
        ...(limitStart === undefined ? {} : { limitStart }),
      }
      await update($, task, () => fresh)
    }
    return next(e)
  })

  // Every model request: the mode's model and effort on the main loop, and the
  // tokens of every response, subagents' too, onto the running task.
  on('turn.step', async function* ($, e, next) {
    let step = e
    if (e.agentId === undefined) {
      const m = await current($)
      if (m?.model) step = { ...step, model: m.model }
      if (m?.effort) step = { ...step, effort: m.effort }
    }

    const response = yield* next(step)
    const u = response.usage

    const running = await read($, task)
    if (running && running.endedAt === undefined) {
      const limitNow = await fiveHour($)
      await update($, task, t =>
        t
          ? {
              ...t,
              steps: t.steps + 1,
              fresh: t.fresh + (u ? u.input_tokens + u.cache_creation_input_tokens : 0),
              cacheRead: t.cacheRead + (u?.cache_read_input_tokens ?? 0),
              output: t.output + (u?.output_tokens ?? 0),
              weighted: t.weighted + (u ? weigh(u.model, u) : 0),
              ...(limitNow === undefined ? {} : { limitNow }),
            }
          : t,
      )
    }

    return response
  })

  // Plan and Review keep their hands off the files; every call counts.
  on('tool.call', async ($, e, next) => {
    const m = await current($)
    if (m?.block.includes(e.tool)) {
      const words = wordsFor(await read($, language))
      return { deny: words.blocked(m.label.en, e.tool) }
    }
    const running = await read($, task)
    if (running && running.endedAt === undefined) {
      await update($, task, t => (t ? { ...t, tools: t.tools + 1 } : t))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const endedAt = await $.clock.now()
      await update($, task, t => (t && t.endedAt === undefined ? { ...t, endedAt } : t))
    }
    return next(e)
  })

  // The band above the prompt: the traffic light and the mode buttons. What the
  // plugins beneath draw there (the XP bar) stands above the buttons.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const below = await next(e)
    const all = await read($, modes)
    if (all.length === 0) return below

    const lang = await read($, language)
    const words = wordsFor(lang)
    const active = await read($, mode)
    const t = await read($, task)
    const level = levelOf(t)
    const isRunning = t !== null && t.endedAt === undefined
    const elements = $.ui.resolve(e)
    const { Box, Button, Text } = elements

    const choose = (m: Mode) => async () => {
      await setMode($, m)
      const hint = m.hint[lang]
      if (hint) $.ui.toast(words.modeOn(m.label[lang], hint))
    }

    const buttons = all.map((m, i) => (
      <Button
        key={`mode-${m.id}`}
        onPress={choose(m)}
        {...(m.id === active ? { variant: 'primary' as const } : {})}
        {...(HOTKEYS[i] ? { hotkey: HOTKEYS[i] } : {})}
      >
        <Text color={m.color}>●</Text> {m.label[lang]}
      </Button>
    ))

    const amount = t ? short(lang, t.weighted) : '–'
    const lines = !t
      ? [words.noTask, words.scale]
      : [
          isRunning ? words.running : words.last(Math.max(1, Math.round(((t.endedAt ?? t.startedAt) - t.startedAt) / 1000))),
          words.counts(t.steps, t.tools),
          words.tokens(t.fresh, t.cacheRead, t.output),
          words.weighted(t.weighted),
          ...(t.limitStart !== undefined && t.limitNow !== undefined && t.limitNow > t.limitStart
            ? [words.limit(Math.round((t.limitNow - t.limitStart) * 10) / 10)]
            : []),
          words.scale,
        ]

    if (e.surface === 'terminal') {
      return (
        <Box flexDirection="column">
          {below}
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            <Text color={LEVEL_COLOR[level]}>●</Text>
            <Text dimColor>{amount}</Text>
            {buttons}
          </Box>
        </Box>
      )
    }

    // On a desktop the modes are coloured pills with their names, drawn by a
    // field of the mod's own (the desktop's buttons take no colour or font):
    // a click picks a mode, the pointer on one shows what it does.
    if (!('Client' in elements)) return below
    const { Client } = elements
    const list = all.map(m => ({ id: m.id, label: m.label[lang], color: m.color, hint: m.hint[lang] }))
    // The tiles stand in one row as wide as the band; the light sits under them.
    const fieldWidth = Math.max(20, e.props.bodyColumns - 2)
    const pills: PillsProps = {
      pills: list,
      active,
      columns: fieldWidth,
      light: { source: lightSvg(level, isRunning), alt: lines.join(' · '), amount, isRunning, lines },
    }
    return (
      <Box flexDirection="column" alignItems="center">
        <Box
          position="absolute"
          top={-BLEND_DOWN}
          bottom={-BLEND_DOWN}
          left={-BLEND_ACROSS}
          right={-BLEND_ACROSS}
          backgroundColor={BLEND_GROUND}
        />
        {below}
        {/* A line's room between what is above (the XP bar) and the tiles. */}
        <Box position="relative" flexDirection="row" marginTop={2}>
          {/* The desktop makes a Box relative only when it holds an absolute Box
              of its own: this empty one lifts the row above the chat-coloured
              ground, which would otherwise be painted over the tiles. */}
          <Box position="absolute" top={0} left={0} />
          <Client key={PILLS} module="./pills.tsx" props={pills} width={fieldWidth} />
        </Box>
      </Box>
    )
  })
}
