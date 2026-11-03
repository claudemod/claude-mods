import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { CommandRunInput, On, PromptSubmitInput, SessionUsage, TurnStepResult } from 'claude-code'

import type { PillsProps } from '../types'
import { layoutTiles } from './layout'
import { parseMode } from './modes'

// The traffic light: the picture in the tile field that is no tile.
async function lightOf(ui: { drawn: (scope: { in: string }) => Promise<unknown> }) {
  return svgs(await ui.drawn({ in: 'mode-pills' }))
    .map(p => ({ props: p }))
    .find(p => /^(Noch keine|Aufgabe|Letzte)/.test(p.props.alt))
}

// Every picture a drawn tree holds, in order.
function svgs(tree: unknown): { alt: string; source: string }[] {
  const out: { alt: string; source: string }[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const element = node as { type?: string; props?: Record<string, unknown>; children?: unknown[] }
    if (element.type === 'Svg') out.push({ alt: String(element.props?.alt), source: String(element.props?.source) })
    for (const child of element.children ?? []) walk(child)
  }
  walk(tree)
  return out
}

const BAND = {
  plugin: 'mode-bar',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
} as const

const NOW = Date.parse('2026-11-03T22:00:00Z')
const ORIGIN = { kind: 'user' } as unknown as PromptSubmitInput['origin']

const FILES: Record<string, string> = {
  '01-eco.md': `---
label: Eco
label_de: Spar
color: "#5E9E6E"
model: haiku
effort: low
block:
hint: Haiku, low effort.
hint_de: Haiku, wenig Effort.
---
Eco mode: answer briefly.`,
  '04-normal.md': `---
label: Normal
label_de: Normal
color: "#8F8F8A"
hint: As usual.
hint_de: Wie immer.
---
`,
  '05-plan.md': `---
label: Plan
label_de: Plan
color: "#4C7FD9"
icon: 📋
block: Edit, Write, NotebookEdit
hint: Plans only.
hint_de: Nur planen.
---
Plan mode: do not change any files.`,
  'notes.txt': 'not a mode',
}

const USAGE: SessionUsage = {
  startedAt: NOW,
  context: { usedTokens: 0, maxTokens: 200_000, percentUsed: 0 } as unknown as SessionUsage['context'],
  rateLimits: [{ kind: 'five_hour', percentUsed: 10, source: 'api' } as SessionUsage['rateLimits'][number]],
}

// The engine beneath the plugin: the mode files, a German system, a clock, and
// a model that answers every request with the given usage, noting what it was sent.
function engine(
  on: On,
  usage = { input: 1000, cacheWrite: 0, cacheRead: 0, output: 200 },
  files: Record<string, string> = FILES,
  entries: Record<string, unknown> = {},
) {
  const store = new Map<string, unknown>(Object.entries(entries))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => (store.set(e.key, e.value), { value: undefined }))
  on('session.id', () => ({ value: 'chat-1' }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  const sent: { model: string; effort?: unknown }[] = []
  const toasts: string[] = []
  mock.clock(on, { now: NOW })
  mock.env(on, { LANG: 'de_DE.UTF-8' })
  on('fs.list', (_, e) => ({
    value: e.path.endsWith('/modes')
      ? Object.keys(files).map(name => ({ name, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false }))
      : [],
  }))
  on('fs.read', (_, e) => {
    const name = e.path.split('/').pop() ?? ''
    const text = files[name]
    if (text === undefined) throw new Error('ENOENT')
    return { value: text }
  })
  on('session.usage', () => ({ value: USAGE }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.toast', (_, e) => (toasts.push(String(e.text)), { value: undefined }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('prompt.submit', (_, e) => ({ text: e.text, ...(e.context ? { context: e.context } : {}) }))
  on('tool.call', () => ({ result: {} }))
  // eslint-disable-next-line require-yield
  on('turn.step', async function* (_, e): AsyncGenerator<never, TurnStepResult> {
    sent.push({ model: e.model, effort: e.effort })
    return {
      turnId: e.turnId,
      index: e.index,
      answer: 'ok',
      toolUses: [],
      stopReason: 'end_turn',
      usage: {
        model: e.model,
        input_tokens: usage.input,
        output_tokens: usage.output,
        cache_read_input_tokens: usage.cacheRead,
        cache_creation_input_tokens: usage.cacheWrite,
      },
    }
  })
  // Beneath the plugin stands what others draw in the band (the XP bar).
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>xp-bar</Text>
  })
  return { sent, toasts, store }
}

const RUN = { origin: ORIGIN, presentation: {} } as unknown as Omit<CommandRunInput, 'command' | 'args'>

async function start($: Engine) {
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
}

// A model request runs as a stream: read it to its end for the response.
async function drain<R>(stream: AsyncGenerator<unknown, R>): Promise<R> {
  for (;;) {
    const next = await stream.next()
    if (next.done) return next.value
  }
}

async function step($: Engine, turnId = 't1', index = 0) {
  return drain($.turn.step({ turnId, index, model: 'claude-opus-5-5', effort: 'medium', messageCount: 3 }))
}

test('die Modus-Dateien werden gelesen: Kopf, Sperren und Notiz', () => {
  const eco = parseMode('01-eco.md', FILES['01-eco.md'] ?? '')
  expect(eco).toEqual({
    id: 'eco',
    label: { en: 'Eco', de: 'Spar' },
    hint: { en: 'Haiku, low effort.', de: 'Haiku, wenig Effort.' },
    color: '#5E9E6E',
    icon: '🌱',
    model: 'haiku',
    effort: 'low',
    block: [],
    text: 'Eco mode: answer briefly.',
  })
  expect(parseMode('05-plan.md', FILES['05-plan.md'] ?? '')?.block).toEqual(['Edit', 'Write', 'NotebookEdit'])
  expect(parseMode('05-plan.md', FILES['05-plan.md'] ?? '')?.icon).toBe('📋')
  expect(parseMode('07-own.md', '---\nlabel: Turbo\n---\n')?.icon).toBe('T')
  expect(parseMode('04-normal.md', FILES['04-normal.md'] ?? '')?.text).toBe('')
  expect(parseMode('x.md', 'no header')).toBeNull()
})

test('auf dem Desktop: Ampel und farbige Pillen unter dem, was darüber gezeichnet ist; Normal ist aktiv', async ($, on) => {
  engine(on)
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  // The pills are a field of the mod's own, handed each mode's name, colour and hint.
  const field = await ui.find({ key: 'mode-pills' })
  expect(String(field?.props.module)).toMatch(/pills\.tsx$/)
  expect(field?.props.width).toBe(98)
  const props = field?.props.props as PillsProps
  expect(props.active).toBe('normal')
  expect(props.pills).toEqual([
    { id: 'eco', label: 'Spar', color: '#5E9E6E', hint: 'Haiku, wenig Effort.' },
    { id: 'normal', label: 'Normal', color: '#8F8F8A', hint: 'Wie immer.' },
    { id: 'plan', label: 'Plan', color: '#4C7FD9', hint: 'Nur planen.' },
  ])
  expect(await ui.find({ type: 'Button' })).toBeUndefined()

  // Each mode is an icon tile in its colour with a line symbol, its name under
  // it in the app's own type; the active tile stands in a ring.
  const pictures = svgs(await ui.drawn({ in: 'mode-pills' }))
  expect(pictures.map(p => p.alt).slice(1)).toEqual(['Spar', 'Normal', 'Plan'])
  expect(pictures[1]?.source).toContain('linearGradient')
  expect(pictures[1]?.source).toContain("stroke-linecap='round'")
  expect(pictures[1]?.source).not.toContain("stroke-width='1.2'")
  expect(pictures[2]?.source).toContain("stroke='#8F8F8A' stroke-width='1.2'")
  expect(pictures[1]?.source).not.toContain('<text')
  expect((await ui.findAll({ type: 'Text', in: 'mode-pills' })).map(t => t.text)).toEqual(['–', ' ', 'Spar', 'Normal', 'Plan'])

  // The XP bar (here: what the engine beneath draws) comes first; no mode name beside the pills.
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text)
  expect(texts[0]).toBe('xp-bar')
  expect((await lightOf(ui))?.props.alt).toMatch(/^Noch keine Aufgabe gemessen/)

  // The band's grey box is hidden under the chat's colour; the row stands above it,
  // a line below what is above, and starts with the empty absolute Box that lifts it.
  const boxes = await ui.findAll({ type: 'Box' })
  expect(boxes.find(b => b.props.backgroundColor !== undefined)?.props).toEqual({
    position: 'absolute',
    top: -3,
    bottom: -3,
    left: -6,
    right: -6,
    backgroundColor: 'userMessageBackground',
  })
  const row = boxes.find(b => b.props.position === 'relative' && b.props.marginTop === 2)
  expect((row?.children[0] as { props?: Record<string, unknown> } | undefined)?.props).toEqual({ position: 'absolute', top: 0, left: 0 })
  await ui.unmount()
})

test('auf dem Desktop: Zeiger auf einer Pille zeigt, was der Modus macht; ein Klick wählt ihn', async ($, on) => {
  const { sent, toasts } = engine(on)
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  // One row, centred in 98 columns: Spar at 39–43, Normal at 45–51, Plan at 53–57;
  // the tiles start at row 1.5, the light's line is row 0.
  await ui.pointer({ type: 'move', x: 54, y: 2 })
  expect(await ui.find({ type: 'Text', text: /Nur planen\./, in: 'mode-pills' })).toBeDefined()
  await ui.pointer({ type: 'move', x: 44, y: 2 })
  expect(await ui.find({ type: 'Text', text: /Nur planen|Wie immer|wenig Effort/, in: 'mode-pills' })).toBeUndefined()

  await ui.pointer({ type: 'down', x: 40, y: 3, button: 'left' })
  await ui.pointer({ type: 'up', x: 40, y: 3, button: 'left' })
  // The pointer on the light shows its figures on the same line.
  await ui.pointer({ type: 'move', x: 41, y: 0 })
  expect(await ui.find({ type: 'Text', text: /^Noch keine Aufgabe gemessen  ·  Grün unter 50k/, in: 'mode-pills' })).toBeDefined()
  expect(toasts.at(-1)).toBe('Modus Spar: Haiku, wenig Effort.')
  expect(((await ui.find({ key: 'mode-pills' }))?.props.props as PillsProps).active).toBe('eco')
  await step($)
  expect(sent.at(-1)).toEqual({ model: 'haiku', effort: 'low' })
  await ui.unmount()
})

test('Eco schickt die Anfragen an Haiku mit wenig Effort und hängt die Notiz an', async ($, on) => {
  const { sent, toasts } = engine(on)
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await step($)
  expect(sent.at(-1)).toEqual({ model: 'claude-opus-5-5', effort: 'medium' })
  const before = await $.prompt.submit({ text: 'hi', wait: false, origin: ORIGIN })
  expect(before.context ?? []).toEqual([])

  await $.command.run({ ...RUN, command: 'modus', args: 'spar' })
  expect(toasts).toEqual([])

  await step($)
  expect(sent.at(-1)).toEqual({ model: 'haiku', effort: 'low' })
  const after = await $.prompt.submit({ text: 'hi', wait: false, origin: ORIGIN })
  expect(after.context).toEqual(['[Mode Bar · Eco] Eco mode: answer briefly.'])

  // A subagent keeps its own model.
  await drain($.turn.step({ turnId: 't9', index: 0, model: 'claude-sonnet-5-5', messageCount: 1, agentId: 'a1' }))
  expect(sent.at(-1)?.model).toBe('claude-sonnet-5-5')
  await ui.unmount()
})

test('Plan sperrt Dateiänderungen, Lesen geht weiter', async ($, on) => {
  engine(on)
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await $.command.run({ ...RUN, command: 'modus', args: 'plan' })

  const edit = await $.tool.call({ tool: 'Edit', file_path: '/a.ts', old_string: 'a', new_string: 'b' })
  expect(String(edit.deny)).toMatch(/^Im Modus Plan sind Dateiänderungen gesperrt \(Edit\)/)
  const readCall = await $.tool.call({ tool: 'Read', file_path: '/a.ts' })
  expect(readCall.deny).toBeUndefined()
  await ui.unmount()
})

test('die Ampel misst die Aufgabe: grün, gelb, rot', async ($, on) => {
  // Each response: 20k read from the cache, 4k new, 1k written, on Opus:
  // 2k + 4k + 5k = 11k weighted per step.
  engine(on, { input: 4000, cacheWrite: 0, cacheRead: 20_000, output: 1000 })
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.turn.start({ text: 'go', turnId: 't1' })
  await step($, 't1', 0)
  await $.tool.call({ tool: 'Read', file_path: '/a.ts' })
  expect(String((await lightOf(ui))?.props.alt)).toMatch(/^Aufgabe läuft · 1 Modell-Schritte · 1 Tool-Aufrufe · Neu gelesen 4k · aus dem Cache 20k · geschrieben 1k · Aufwand 11k/)
  expect(String((await lightOf(ui))?.props.source)).toContain("fill='#7D9B63'")

  for (let i = 1; i < 5; i++) await step($, 't1', i)
  expect(String((await lightOf(ui))?.props.source)).toContain("fill='#D2A24C'")

  for (let i = 5; i < 20; i++) await step($, 't1', i)
  expect(String((await lightOf(ui))?.props.source)).toContain("fill='#C25A4A'")

  await $.turn.complete({ turnId: 't1', answer: 'done', durationMs: 5000, isAborted: false, reason: 'answer' })
  expect(String((await lightOf(ui))?.props.alt)).toMatch(/^Letzte Aufgabe · /)

  // A new turn starts a new task.
  await $.turn.start({ text: 'again', turnId: 't2' })
  expect(String((await lightOf(ui))?.props.alt)).toMatch(/^Aufgabe läuft · 0 Modell-Schritte/)
  await ui.unmount()
})

test('im Terminal: Ampel als Punkt und die Knöpfe', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Button' })).length).toBe(3)
  expect(await ui.find({ type: 'Text', text: /^●$/ })).toBeDefined()
  await ui.unmount()
})

test('ohne Modus-Dateien bleibt das Band den anderen', async ($, on) => {
  engine(on, undefined, {})
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.findAll({ type: 'Text' })).map(t => t.text)).toEqual(['xp-bar'])
  await ui.unmount()
})

test('vor der ersten Nachricht: /modus knapp wählt den Modus, Name, Nummer oder englisch', async ($, on) => {
  const { sent, store } = engine(on)
  await start($)

  const spar = await $.command.run({ ...RUN, command: 'modus', args: 'spar' })
  expect(spar.text).toBe('Modus Spar: Haiku, wenig Effort.')
  await step($)
  expect(sent.at(-1)).toEqual({ model: 'haiku', effort: 'low' })
  expect((store.get('modeByChat') as Record<string, { mode: string }>)['chat-1']?.mode).toBe('eco')

  expect((await $.command.run({ ...RUN, command: 'mode', args: '3' })).text).toBe('Modus Plan: Nur planen.')
  expect((await $.command.run({ ...RUN, command: 'modus', args: 'Eco' })).text).toBe('Modus Spar: Haiku, wenig Effort.')
  expect((await $.command.run({ ...RUN, command: 'modus', args: '' })).text).toMatch(/^Modi: 1 Spar · 2 Normal · 3 Plan\. /)
  expect((await $.command.run({ ...RUN, command: 'modus', args: 'turbo' })).text).toMatch(/^Keinen Modus „turbo“ gefunden/)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(((await ui.find({ key: 'mode-pills' }))?.props.props as PillsProps).active).toBe('eco')
  await ui.unmount()
})

test('pausiert die App den Chat, kommt er mit seinem Modus zurück', async ($, on) => {
  engine(on, undefined, FILES, { modeByChat: { 'chat-1': { mode: 'plan', at: NOW } } })
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(((await ui.find({ key: 'mode-pills' }))?.props.props as PillsProps).active).toBe('plan')
  await ui.unmount()
})

test('alle zehn Kacheln stehen immer in einer Reihe, auch im schmalen Fenster', () => {
  const names = ['Spar', 'Schnell', 'Knapp', 'Normal', 'Plan', 'Prüfen', 'Erklären', 'Debug', 'Test', 'Gründlich']
  const items = names.map(label => ({ id: label, label }))
  for (const columns of [120, 80, 74, 60, 45]) {
    const { placed } = layoutTiles(items, columns)
    expect(placed).toHaveLength(10)
    const last = placed[9]
    expect((last?.x ?? 0) + (last?.w ?? 0)).toBeLessThanOrEqual(columns)
    for (let i = 1; i < 10; i++) expect((placed[i]?.x ?? 0) >= (placed[i - 1]?.x ?? 0) + (placed[i - 1]?.w ?? 0)).toBe(true)
  }
})
