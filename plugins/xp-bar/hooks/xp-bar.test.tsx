import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, SessionUsage } from 'claude-code'

import { BAR_HEIGHT, BAR_WIDTH, TIP_MAX_WIDTH, tierOf, xpTipSvg } from './bar-svg'
import { GLYPH_ROWS, glyphNames, glyphRows } from './pixel-font'

const BAND = {
  plugin: 'xp-bar',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
} as const

const MODE = {
  plugin: 'xp-bar',
  component: 'SessionMode',
  requestId: 'session-mode',
  props: { modes: [] },
} as const

const NOW = Date.parse('2026-11-02T15:47:00Z')

const USAGE: SessionUsage = {
  startedAt: 0,
  context: { window: 200_000 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 37.5, resetsAt: '2026-11-02T18:00:00Z' },
    { kind: 'seven_day', percentUsed: 12, resetsAt: '2026-11-06T10:00:00Z' },
  ],
}

const NO_READING: SessionUsage = { ...USAGE, rateLimits: [] }

// The engine beneath the plugin; its store and clock are handed back for the test to use.
// The system speaks German unless a test gives other variables.
function engine(
  on: On,
  usage: SessionUsage,
  entries: Record<string, unknown> = {},
  env: Record<string, string> = { LANG: 'de_DE.UTF-8' },
) {
  const store = new Map<string, unknown>(Object.entries(entries))
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, env)
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => (store.set(e.key, e.value), { value: undefined }))
  on('store.delete', (_, e) => (store.delete(e.key), { value: undefined }))
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('session.usage', () => ({ value: usage }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  // Beneath the plugin stands the engine's own drawing.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  return { store, clock }
}

async function desktopBar($: Engine) {
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const bar = await ui.find({ type: 'Svg' })
  await ui.unmount()
  return bar
}

test('auf dem Desktop: Pixel-Leiste im Band, die Details als Hover-Karte', async ($, on) => {
  engine(on, USAGE)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  const [bar, card] = await ui.findAll({ type: 'Svg' })
  // Plain images: no frame that reloads blank when the bar changes.
  expect(bar?.props.isInteractive).toBeFalsy()
  expect(bar?.props.width).toBe(BAR_WIDTH)
  expect(bar?.props.height).toBe(BAR_HEIGHT)
  expect(String(bar?.props.alt)).toMatch(
    /^Sitzung 37,5 %: Tokens werden gemessen, Voll um \d\d:\d\d \(in 2h 13m\)\. Woche 12 %: Tokens werden gemessen, Voll Fr\.,? 06\.11\.,? \d\d:\d\d\. Bei deinem Tempo: Woche reicht bis zum Reset\. Insgesamt seit 02\.11\.: 0,4× Sitzung · 0,1× Woche, 0 Tokens in allen Chats$/,
  )
  expect(card?.props.alt).toBe(bar?.props.alt)
  expect(await ui.findAll({ type: 'Text' })).toHaveLength(0)

  // The card waits hidden; its `hover` (kept apart from the props the kit
  // describes) has the desktop lift it above the bar while the pointer is on it,
  // and the margins inside let the tooltip cover the popover's own frame.
  const boxes = await ui.findAll({ type: 'Box' })
  expect(boxes.find(box => box.props.display === 'none')?.props.position).toBe('absolute')
  const cover = boxes.find(box => box.props.marginTop === -1)
  expect(cover?.props).toMatchObject({ marginLeft: -2, marginRight: -2, marginTop: -1, marginBottom: -1 })

  // An absolute ground in the chat's own colour lies behind the bar and reaches
  // far past the band's padding; the bar stands on its own layer above it.
  const ground = boxes.find(box => box.props.backgroundColor !== undefined)
  expect(ground?.props).toEqual({
    position: 'absolute',
    top: -3,
    bottom: -3,
    left: -6,
    right: -6,
    backgroundColor: 'userMessageBackground',
  })
  expect(boxes.find(box => box.key === 'xp')?.props.position).toBe('relative')
  await ui.unmount()
})

test('im Terminal: Zahl, Leiste und Details als Textzeile', async ($, on) => {
  engine(on, USAGE)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /^38$/ })).toBeDefined()
  expect(
    await ui.find({
      type: 'Text',
      text: /^Sitzung 37,5 % · Tokens werden gemessen · Voll um \d\d:\d\d \(in 2h 13m\)  \|  Woche 12 % · /,
    }),
  ).toBeDefined()
  await ui.unmount()
})

test('die Fußzeile bleibt der Engine', async ($, on) => {
  engine(on, USAGE)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...MODE, surface })
    expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
    await ui.unmount()
  }
})

test('gemessene Tokens pro Prozent ergeben die Schätzung', async ($, on) => {
  engine(on, USAGE, { 'samples.five_hour': [90_000, 100_000, 400_000] })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(String((await desktopBar($))?.props.alt)).toMatch(/^Sitzung 37,5 %: ≈ 6,3 Mio\. Tokens übrig, Voll um/)
})

test('vor der ersten Antwort zeigt die Leiste den zuletzt gespeicherten Stand', async ($, on) => {
  engine(on, NO_READING, {
    lastLimits: {
      at: NOW - 600_000,
      limits: [{ kind: 'five_hour', percentUsed: 55, resetsAt: '2026-11-02T18:00:00Z' }],
    },
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(String((await desktopBar($))?.props.alt)).toMatch(/^Sitzung 55 %: Tokens werden gemessen, Voll um/)
})

test('ist die Reset-Zeit vorbei, steht die Leiste auf 0', async ($, on) => {
  engine(on, NO_READING, {
    lastLimits: {
      at: NOW - 6 * 3_600_000,
      limits: [{ kind: 'five_hour', percentUsed: 80, resetsAt: '2026-11-02T14:00:00Z' }],
    },
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(String((await desktopBar($))?.props.alt)).toMatch(/^Sitzung 0 %: Tokens werden gemessen, Volles Limit verfügbar$/)
})

test('eine neue Messung wird für die nächsten Sitzungen gespeichert', async ($, on) => {
  const { store } = engine(on, USAGE)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const stored = store.get('lastLimits') as { limits: { percentUsed: number }[] }
  expect(stored.limits.map(l => l.percentUsed)).toEqual([37.5, 12])
})

test('ein neuer Stand füllt die Leiste vom alten aus auf, einmal', async ($, on) => {
  const { store, clock } = engine(on, USAGE)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  let ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('width="68" height="3"')

  // Another session read 55 %: the next tick takes it over and the green grows.
  store.set('lastLimits', {
    at: NOW + 1_000_000,
    limits: [{ kind: 'five_hour', percentUsed: 55, resetsAt: '2026-11-02T18:00:00Z' }],
  })
  await clock.advance(30_000)
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain(
    '<animate attributeName="width" from="68" to="99" begin="0s"',
  )
  await ui.unmount()

  // Drawn again once the growth is over, the bar stands full and does not grow again.
  await clock.advance(1_000)
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const source = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect(source).toContain('width="99" height="3"')
  expect(source).not.toContain('<animate')
  await ui.unmount()
})

function weekAt(percentUsed: number): SessionUsage {
  // The week began four days before NOW and resets three days after it.
  return { ...USAGE, rateLimits: [USAGE.rateLimits[0]!, { kind: 'seven_day', percentUsed, resetsAt: '2026-11-05T15:47:00Z' }] }
}

test('bei schnellem Tempo sagt die Karte, wann das Wochenlimit voll ist', async ($, on) => {
  // 60 % in four days: the last 40 % last another 2 2/3 days, before the reset.
  engine(on, weekAt(60))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(String((await desktopBar($))?.props.alt)).toMatch(/Bei deinem Tempo: Woche voll Do\.,? 05\.11\.,? \d\d:\d\d\. Insgesamt/)
})

test('bei ruhigem Tempo reicht die Woche bis zum Reset', async ($, on) => {
  engine(on, weekAt(20))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(String((await desktopBar($))?.props.alt)).toMatch(/Bei deinem Tempo: Woche reicht bis zum Reset\. Insgesamt/)
})

test('unter 1 % ist das Tempo noch nicht messbar', async ($, on) => {
  engine(on, weekAt(0.5))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(String((await desktopBar($))?.props.alt)).toMatch(/Bei deinem Tempo: Woche: Tempo wird gemessen\. Insgesamt/)
})

test('auch mit langen Zeilen bleibt die Karte so schmal, wie die App sie zeigt', () => {
  const card = xpTipSvg([
    { text: 'Nutzungslimit', color: 'title' },
    { text: 'Sitzung 100 %', color: 'gray' },
    { text: ' ≈ 888 Mio. Tokens übrig', color: 'value' },
    { text: ' Voll morgen 00:00 (in 23h 59m)', color: 'value' },
    { text: 'Woche 100 %', color: 'gray' },
    { text: ' Voll Mi. 30.12. 23:59', color: 'value' },
    null,
    { text: 'Bei deinem Tempo:', color: 'gray' },
    { text: ' Woche voll Mi. 30.12. 23:59', color: 'warn' },
    { text: 'Insgesamt seit 30.12.:', color: 'gray' },
    { text: ' 888,8× Sitzung · 88,8× Woche', color: 'total' },
    { text: ' 888 Mio. Tokens in allen Chats', color: 'total' },
    { text: '888 Mio. Tokens in diesem Chat', color: 'lore' },
  ])
  expect(card.width).toBeLessThanOrEqual(TIP_MAX_WIDTH * 2)
})

test('die Farbe der Leiste folgt dem Wochenlimit: grün, ab 70 % gelb, ab 80 % orange, ab 90 % rot', () => {
  expect([0, 69.9, 70, 79.9, 80, 89.9, 90, 100].map(tierOf)).toEqual([
    'green', 'green', 'yellow', 'yellow', 'orange', 'orange', 'red', 'red',
  ])
  expect(tierOf(null)).toBe('green')
})

test('bei 85 % der Woche zeichnet sich die Leiste orange', async ($, on) => {
  engine(on, weekAt(85))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const source = String((await desktopBar($))?.props.source)
  expect(source).toContain('fill="#F28C1B"')
  expect(source).not.toContain('fill="#6FD81E"')
})

test('im Terminal hat die Leiste dieselbe Stufenfarbe', async ($, on) => {
  engine(on, weekAt(95))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^▰+$/ }))?.props.color).toBe('#FF5555')
  await ui.unmount()
})

test('auf Englisch, wenn die Einstellung es sagt', { options: { language: 'en' } }, async ($, on) => {
  engine(on, USAGE, { 'samples.five_hour': [90_000, 100_000, 400_000] })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(String((await desktopBar($))?.props.alt)).toMatch(
    /^Session 37\.5%: ≈ 6\.3M tokens left, Full at \d{1,2}(:\d\d)? (AM|PM) \(in 2h 13m\)\. Week 12%: Measuring tokens, Full Fri 11\/6, \d{1,2}(:\d\d)? (AM|PM)\. At your pace: Week lasts until the reset\. Total since 11\/2: 0\.4× session · 0\.1× week, 0 tokens in all chats$/,
  )
})

test('auf Englisch, wenn macOS Englisch als erste Sprache hat', async ($, on) => {
  engine(on, USAGE, {}, {})
  on('process.run', (_, e) => ({
    value: { exitCode: 0, stdout: e.argv[0] === 'defaults' ? '(\n    "en-US",\n    "de-DE"\n)\n' : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(String((await desktopBar($))?.props.alt)).toMatch(/^Session 37\.5%: Measuring tokens, Full at /)
})

test('auf Deutsch, wenn macOS Deutsch als erste Sprache hat', async ($, on) => {
  engine(on, USAGE, {}, {})
  on('process.run', () => ({ value: { exitCode: 0, stdout: '(\n    "de-DE"\n)\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(String((await desktopBar($))?.props.alt)).toMatch(/^Sitzung 37,5 %: Tokens werden gemessen, Voll um /)
})

test('die Einstellung schlägt die Systemsprache', { options: { language: 'de' } }, async ($, on) => {
  engine(on, USAGE, {}, { LANG: 'en_US.UTF-8' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(String((await desktopBar($))?.props.alt)).toMatch(/^Sitzung 37,5 %/)
})

test('im Terminal auf Englisch', { options: { language: 'en' } }, async ($, on) => {
  engine(on, weekAt(60))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(
    await ui.find({
      type: 'Text',
      text: /^Session 37\.5% · Measuring tokens · Full at .*\|  Week full Thu 11\/5, \d{1,2}:\d\d (AM|PM)  \|  Total since 11\/2: 0\.4× session · 0\.6× week, 0 tokens in all chats$/,
    }),
  ).toBeDefined()
  await ui.unmount()
})

// The window USAGE's session reading belongs to, as the store keys its peak.
const SESSION_WINDOW = `peak.five_hour.${Math.round(Date.parse('2026-11-02T18:00:00Z') / 600_000)}`

test('insgesamt zählt jedes Fenster mit seinem höchsten Stand und die Tokens aller Chats', async ($, on) => {
  engine(on, USAGE, {
    since: Date.parse('2026-11-01T10:00:00Z'),
    'peak.five_hour.1': 100,
    'peak.five_hour.2': 50,
    'peak.seven_day.3': 80,
    'tokens.chat-a': 2_000_000,
    'tokens.chat-b': 500_000,
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  // Sessions: 100 + 50 + 37.5 % is 1.9 limits; weeks: 80 + 12 % is 0.9.
  expect(String((await desktopBar($))?.props.alt)).toMatch(
    /Insgesamt seit 01\.11\.: 1,9× Sitzung · 0,9× Woche, 2,5 Mio\. Tokens in allen Chats$/,
  )
})

test('ein Fenster zählt nur einmal, mit seinem höchsten Stand', async ($, on) => {
  const { store } = engine(on, USAGE, { [SESSION_WINDOW]: 60 })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  // The live 37.5 % is below the 60 % another session saw in the same window.
  expect(store.get(SESSION_WINDOW)).toBe(60)
  expect(String((await desktopBar($))?.props.alt)).toMatch(/: 0,6× Sitzung · 0,1× Woche/)
})

test('die Tokens dieses Chats landen unter seinem eigenen Schlüssel', async ($, on) => {
  const { store } = engine(on, USAGE)
  on('session.id', () => ({ value: 'chat-1' }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const keys = [...store.keys()].filter(key => key.startsWith('tokens.'))
  expect(keys).toHaveLength(1)
  expect(keys[0]).toMatch(/^tokens\.chat-1\./)
})

test('ohne jede Messung erklärt die Hover-Karte, wann die Leiste kommt', async ($, on) => {
  engine(on, NO_READING)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(String((await desktopBar($))?.props.alt)).toMatch(/erscheint nach der ersten Antwort/)
})

test('die Hover-Karte wächst mit ihren Zeilen, wie ein Item-Tooltip', () => {
  const name = { text: 'Nutzungslimit', color: 'title' } as const
  const one = xpTipSvg([name])
  const more = xpTipSvg([name, { text: 'Sitzung 38 %', color: 'gray' }, null, { text: '845 Tsd. Tokens in diesem Chat', color: 'lore' }])
  // Name 12 px, a line 10 px, the gap before the lore 5 px, each at GUI scale 2.
  expect(more.height - one.height).toBe((10 + 5 + 10) * 2)
  expect(more.width).toBeGreaterThan(one.width)
  // Each colour casts its shadow at a quarter of its brightness, as the game draws it.
  expect(more.source).toContain('fill="#55FFFF"')
  expect(more.source).toContain('fill="#153f3f"')
})

test('jedes Zeichen der Pixelschrift hat gleich breite Zeilen', () => {
  for (const name of glyphNames()) {
    const rows = glyphRows(name)!
    expect(rows.length === 7 || rows.length === GLYPH_ROWS).toBe(true)
    expect(rows.every(row => row.length === rows[0]!.length)).toBe(true)
  }
})
