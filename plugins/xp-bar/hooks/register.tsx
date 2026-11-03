import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { XpLimit } from '../types'
import { BAR_HEIGHT, BAR_WIDTH, FILL_MS, TIP_TEXT_MAX_WIDTH, xpBarSvg, xpTipSvg } from './bar-svg'
import type { TipLine } from './bar-svg'
import { languageOf, wordsFor } from './i18n'
import type { Lang, Words } from './i18n'
import { textWidth } from './pixel-font'

const limits = atom({ plugin: 'xp-bar', key: 'limits' } as const, [])
const tokensPerPercent = atom({ plugin: 'xp-bar', key: 'tokensPerPercent' } as const, {})
// The clock to the minute, for the card's countdown: the band is drawn again
// once a minute at most, and the bar's image only changes with its level.
const now = atom({ plugin: 'xp-bar', key: 'now' } as const, 0)
// The tokens this session's requests have used, for the card's lore line.
const sessionTokens = atom({ plugin: 'xp-bar', key: 'sessionTokens' } as const, 0)
// The language the bar speaks: the `language` option, or the system's when it is `auto`.
const language = atom({ plugin: 'xp-bar', key: 'language' } as const, 'en')

// How far the tooltip reaches past the popover's padding, which would show its
// grey ground: across in characters (the padding is 12 px, a character about
// 7.5), up and down in the desktop's rows of half a line (10 px; the padding is
// 8). The popover clips what reaches further, so the overreach stays just past
// the padding and the tooltip's dark margin takes up the difference.
const COVER_ACROSS = 2
const COVER_ABOVE = 1
const COVER_BELOW = 1

// The band's grey box is a 5 % veil over the chat's own ground, inside 8 px of
// padding across and (40 px - a line) / 2 down. A ground in the chat's colour
// ("userMessageBackground" is the desktop's surface-1, the page itself, in light
// and dark alike), laid behind the bar on its own layer and reaching far past
// that padding, hides the box: the band clips it at its edge, and its height
// stays the bar's. Offsets are whole characters across and whole lines down.
const BLEND_GROUND = 'userMessageBackground'
const BLEND_ACROSS = 6
const BLEND_DOWN = 3

// How many calibration readings are kept per window; the estimate is their median.
const MAX_SAMPLES = 21
// A reading needs at least this many tokens behind it, else other usage
// (claude.ai, another session) moved the window and this one did not.
const MIN_SAMPLE_TOKENS = 1000

// The last reading any session of this mod took, kept so a new session shows
// the bar before its first answer brings a reading of its own.
const LAST_LIMITS = 'lastLimits'
type StoredLimits = { at: number; limits: XpLimit[] }

type Anchor = { percent: number; resetsAt?: string; tokens: number }

// Where each window stood at its last reading, and the tokens this session
// has spent since. Lost on reload, which only costs one reading.
const anchors = new Map<string, Anchor>()
// When the reading the bar shows was taken, so a newer one from another session wins.
let shownAt = 0
// The level the desktop bar last drew, the one it grows from and when the
// growth began: a drawing made while it runs picks it up where it stands.
let drawnPercent: number | null = null
let fromPercent: number | null = null
let grewAt = 0

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function isSameWindow(a: Anchor, l: SessionRateLimit) {
  if (l.percentUsed < a.percent) return false
  if (a.resetsAt === l.resetsAt) return true
  if (!a.resetsAt || !l.resetsAt) return false
  return Math.abs(Date.parse(a.resetsAt) - Date.parse(l.resetsAt)) < 60_000
}

function isPast(l: XpLimit, nowMs: number) {
  return l.resetsAt !== undefined && Date.parse(l.resetsAt) <= nowMs
}

// Tokens per percent come from this account's own use: the tokens spent
// between two readings over how far the window moved, the median of the last few.
async function calibrate($: EngineInterface, l: SessionRateLimit) {
  const anchor = anchors.get(l.kind)
  const fresh = { percent: l.percentUsed, resetsAt: l.resetsAt, tokens: 0 }

  if (!anchor || !isSameWindow(anchor, l)) {
    anchors.set(l.kind, fresh)
    return
  }

  const delta = l.percentUsed - anchor.percent
  if (delta < 1) return

  anchors.set(l.kind, fresh)
  if (anchor.tokens < MIN_SAMPLE_TOKENS) return

  const key = `samples.${l.kind}`
  const stored = (await $.store.get(key)) as number[] | undefined
  const samples = [...(stored ?? []), anchor.tokens / delta].slice(-MAX_SAMPLES)
  await $.store.set(key, samples)
  await update($, tokensPerPercent, all => ({ ...all, [l.kind]: median(samples) }))
}

// A live reading: shown at once and kept for the sessions that start next.
async function setLimits($: EngineInterface, rateLimits: readonly SessionRateLimit[]) {
  const at = await $.clock.now()
  const kept = rateLimits.map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, resetsAt }))
  shownAt = at
  await update($, limits, () => kept)
  await $.store.set(LAST_LIMITS, { at, limits: kept } satisfies StoredLimits)
}

// Shows what another session (or an earlier one) read, when it is newer than what is shown.
async function adoptStoredLimits($: EngineInterface) {
  const stored = (await $.store.get(LAST_LIMITS)) as StoredLimits | undefined
  if (!stored || !Array.isArray(stored.limits) || stored.at <= shownAt) return

  shownAt = stored.at
  await update($, limits, () => stored.limits)
}

// A window whose reset has passed is full again: its reading goes to zero.
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

async function expireLimits($: EngineInterface, nowMs: number) {
  const all = await read($, limits)
  if (!all.some(l => isPast(l, nowMs))) return

  await update($, limits, current =>
    current.map(l => (isPast(l, nowMs) ? { kind: l.kind, percentUsed: 0 } : l)),
  )
}

type View = {
  // The session (5-hour) window's use, 0 to 100; null before any reading.
  percent: number | null
  // The hover card: the name, each window with its tokens and its reset, the lore.
  lines: TipLine[]
  // The terminal's line beside its bar, which no pointer can hover.
  line: string
  // What the bar says, for a reader that cannot see it.
  alt: string
}

const WEEK_MS = 7 * 24 * 3_600_000

// When the week's limit runs out if it keeps being used as it has been since
// the week began (seven days before its reset): gold with the time, green when
// it lasts to the reset, grey while too little of the week has gone to tell.
function weekForecast(words: Words, week: XpLimit | undefined, nowMs: number): Exclude<TipLine, null> | null {
  const resetMs = week?.resetsAt ? Date.parse(week.resetsAt) : NaN
  if (!week || !Number.isFinite(resetMs)) return null

  const elapsed = nowMs - (resetMs - WEEK_MS)
  if (elapsed < 3_600_000 || week.percentUsed < 1) return { text: ` ${words.measuringPace}`, color: 'gray' }

  const fullAt = nowMs + ((100 - week.percentUsed) * elapsed) / week.percentUsed
  return fullAt >= resetMs
    ? { text: ` ${words.weekLasts}`, color: 'good' }
    : { text: ` ${words.weekFull(fullAt, nowMs)}`, color: 'warn' }
}

async function describe($: EngineInterface, nowMs: number): Promise<View> {
  const all = await read($, limits)
  const perPercent = await read($, tokensPerPercent)
  const spent = await read($, sessionTokens)
  const words = wordsFor(await read($, language))

  const current = all.map(l => (isPast(l, nowMs) ? { kind: l.kind, percentUsed: 0 } : l))
  const shown = current.find(l => l.kind === 'five_hour') ?? current[0]
  const lore: TipLine = { text: words.chatTokens(spent), color: 'lore' }

  if (!shown) {
    return {
      percent: null,
      lines: [{ text: words.title, color: 'title' }, { text: words.firstAnswer, color: 'gray' }, null, lore],
      line: words.barFirstAnswer,
      alt: words.barFirstAnswer,
    }
  }

  // Each window as the game lists an enchantment, its figures beneath it. The
  // session's countdown goes where its line would grow wider than the card.
  const windows = [shown, ...current.filter(l => l !== shown)].map(l => {
    const label = words.window(l.kind, l.percentUsed)
    const per = perPercent[l.kind]
    const tokens = per ? words.tokensLeft(Math.max(0, 100 - l.percentUsed) * per) : words.measuringTokens
    const resetMs = l.resetsAt ? Date.parse(l.resetsAt) : NaN
    const full = Number.isFinite(resetMs) ? words.full(resetMs, nowMs) : words.fullLimit
    const counted = `${full} ${words.countdown(resetMs - nowMs)}`
    const reset =
      l.kind === 'five_hour' && Number.isFinite(resetMs) && textWidth(` ${counted}`) <= TIP_TEXT_MAX_WIDTH
        ? counted
        : full
    return { label, tokens, reset }
  })

  const forecast = weekForecast(words, current.find(l => l.kind === 'seven_day'), nowMs)

  return {
    percent: Math.max(0, Math.min(100, shown.percentUsed)),
    lines: [
      { text: words.title, color: 'title' },
      ...windows.flatMap((w): TipLine[] => [
        { text: w.label, color: 'gray' },
        { text: ` ${w.tokens}`, color: 'value' },
        { text: ` ${w.reset}`, color: 'value' },
      ]),
      null,
      ...(forecast ? [{ text: words.pace, color: 'gray' } as const, forecast] : []),
      lore,
    ],
    line: [...windows.map(w => `${w.label} · ${w.tokens} · ${w.reset}`), forecast?.text.trim() ?? '']
      .filter(Boolean)
      .join('  |  '),
    alt: [...windows.map(w => `${w.label}: ${w.tokens}, ${w.reset}`), forecast ? `${words.pace} ${forecast.text.trim()}` : '']
      .filter(Boolean)
      .join('. '),
  }
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)

    const chosen = options.language
    const lang = chosen === 'de' || chosen === 'en' ? chosen : await systemLanguage($)
    await update($, language, () => lang)

    const seeded: Record<string, number> = {}
    for (const key of await $.store.keys()) {
      if (!key.startsWith('samples.')) continue
      const samples = (await $.store.get(key)) as number[]
      if (samples.length > 0) seeded[key.slice('samples.'.length)] = median(samples)
    }
    await update($, tokensPerPercent, () => seeded)

    const usage = await $.session.usage()
    if (usage.rateLimits.length > 0) {
      await setLimits($, usage.rateLimits)
      for (const l of usage.rateLimits) await calibrate($, l)
    } else {
      await adoptStoredLimits($)
    }

    // Every half minute: the clock to the minute, what other sessions read, and resets that came due.
    const tick = async () => {
      const ms = await $.clock.now()
      const minute = Math.floor(ms / 60_000) * 60_000
      if ((await read($, now)) !== minute) await update($, now, () => minute)
      await adoptStoredLimits($)
      await expireLimits($, ms)
    }
    await tick()
    $.clock.every(30_000, () => void tick())

    return result
  })

  // Every model request, main thread and subagents: they all count toward the limit.
  on('turn.step', async function* ($, e, next) {
    const response = yield* next(e)
    const u = response.usage

    if (u) {
      const tokens =
        u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
      for (const anchor of anchors.values()) anchor.tokens += tokens
      await update($, sessionTokens, n => n + tokens)
    }

    return response
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits') && e.rateLimits.length > 0) {
      await setLimits($, e.rateLimits)
      for (const l of e.rateLimits) await calibrate($, l)
    }

    return next(e)
  })

  // The band above the prompt: the one place the desktop draws a picture, inside
  // a grey box of its own that no mod can take away. The terminal gets a line of text.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    await read($, now)
    const nowMs = await $.clock.now()
    const view = await describe($, nowMs)
    const { Box, Text } = $.ui.resolve(e)

    if (e.surface === 'terminal') {
      const cells = 20
      const filled = Math.round(((view.percent ?? 0) / 100) * cells)
      return (
        <Box flexDirection="row" gap={1}>
          {view.percent === null ? null : (
            <Text color={view.percent >= 90 ? '#FF5555' : '#80FF20'} weight="bold">
              {String(Math.round(view.percent))}
            </Text>
          )}
          <Text>
            <Text color="#80FF20">{'▰'.repeat(filled)}</Text>
            <Text dimColor>{'▱'.repeat(cells - filled)}</Text>
          </Text>
          <Text dimColor wrap="truncate-end">
            {view.line}
          </Text>
        </Box>
      )
    }

    if (view.percent !== drawnPercent) {
      fromPercent = drawnPercent
      drawnPercent = view.percent
      grewAt = nowMs
    }
    const elapsedMs = nowMs - grewAt
    const bar = xpBarSvg(view.percent, elapsedMs < FILL_MS ? { fromPercent, elapsedMs } : undefined)
    const card = xpTipSvg(view.lines)
    const { Svg } = $.ui.resolve(e)


    // Plain images swap without a blank frame. The card is a hover card: the
    // desktop lifts it out of the band, floats it above the bar and frames it
    // in a popover of its own (padding, a rounded grey ground, a ring, a shadow).
    // Negative margins let the tooltip reach past that frame and cover it, so
    // what shows is the game's tooltip alone; at the bottom it stops short of the bar.
    // The first, absolute box is the ground in the chat's colour that hides the
    // band's grey box; the bar stands on a layer of its own above it.
    return (
      <Box flexDirection="row" justifyContent="center">
        <Box
          position="absolute"
          top={-BLEND_DOWN}
          bottom={-BLEND_DOWN}
          left={-BLEND_ACROSS}
          right={-BLEND_ACROSS}
          backgroundColor={BLEND_GROUND}
        />
        <Box key="xp" position="relative">
          <Svg source={bar} alt={view.alt} width={BAR_WIDTH} height={BAR_HEIGHT} />
          <Box position="absolute" display="none" hover={{ display: 'flex' }}>
            <Box marginLeft={-COVER_ACROSS} marginRight={-COVER_ACROSS} marginTop={-COVER_ABOVE} marginBottom={-COVER_BELOW}>
              <Svg source={card.source} alt={view.alt} width={card.width} height={card.height} />
            </Box>
          </Box>
        </Box>
      </Box>
    )
  })
}
