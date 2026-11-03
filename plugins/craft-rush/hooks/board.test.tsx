import { expect, test } from 'claude-code/testing'
import type { RenderElement } from 'claude-code'

const PANE = {
  plugin: 'craft-rush',
  component: 'Pane',
  requestId: 'craft-rush',
  props: {
    title: 'Craft Rush',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// `/craft demo`, typed at the prompt.
const CRAFT_DEMO = {
  command: 'craft',
  args: 'demo',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 120 },
} as const

type Placed = { left: number; top: number; alt: string }

// Every picture the board drew, where the box placing it sits.
function pictures(tree: RenderElement): Placed[] {
  const out: Placed[] = []
  const walk = (node: unknown, left: number, top: number) => {
    if (!node || typeof node !== 'object') return
    const element = node as { type: string; props?: Record<string, unknown>; children?: unknown[] }
    const props = element.props ?? {}
    const x = typeof props.left === 'number' ? props.left : left
    const y = typeof props.top === 'number' ? props.top : top
    if (element.type === 'Svg') out.push({ left: x, top: y, alt: String(props.alt) })
    for (const child of element.children ?? []) walk(child, x, y)
  }
  walk(tree, 0, 0)
  return out
}

type Kit = Parameters<Exclude<Parameters<typeof test>[2], undefined>>
// What the helpers need of a mounted drawing.
type Mounted = {
  pointer: (event: { type: 'down' | 'up'; x: number; y: number; button: 'left' | 'right' }) => Promise<void>
  drawn: (scope: { in: string }) => Promise<RenderElement>
}

// The engine beneath the plugin, a store included; `stored` collects what the
// mod keeps, `closed` the panes it closes.
async function engineBeneath($: Kit[0], on: Kit[1], stored: Record<string, unknown> = {}, closed: string[] = []) {
  on('command.register', () => ({ value: { command: 'craft' } }))
  on('clock.now', () => ({ value: 1_000 }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', (_, e) => {
    closed.push(e.id)
    return { value: undefined }
  })
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => {
    stored[e.key] = e.value
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
}

async function clickAt(ui: Mounted, x: number, y: number, button: 'left' | 'right' = 'left') {
  await ui.pointer({ type: 'down', x, y, button })
  await ui.pointer({ type: 'up', x, y, button })
}

// Presses a drawn button by the words on it.
async function pressDrawn(ui: Mounted, words: RegExp) {
  const found = pictures(await ui.drawn({ in: 'board' })).find(p => words.test(p.alt))
  expect(found).toBeDefined()
  await clickAt(ui, found!.left + 2, found!.top)
}

test('a round: pick up a stack, lay it in the grid, take what it makes', { options: { language: 'de' } }, async ($, on) => {
  await engineBeneath($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pressDrawn(ui, /^Werkbank 3×3/)

  // The crafting table's storage starts at row 12; take a log there.
  const log = pictures(await ui.drawn({ in: 'board' })).find(p => p.alt === 'Holzstamm' && p.top >= 12)
  expect(log).toBeDefined()
  await clickAt(ui, log!.left + 2, log!.top)

  // One log, laid by a right click into the middle of the grid (columns 15 to
  // 19, rows 6 and 7); the result slot stands at column 32.
  await clickAt(ui, 17, 6, 'right')
  const laid = pictures(await ui.drawn({ in: 'board' }))
  expect(laid.find(p => p.left === 15 && p.top === 6)?.alt).toBe('Holzstamm')
  expect(laid.find(p => p.left === 32 && p.top === 6)?.alt).toBe('Bretter')

  // Put the rest back, then take the planks.
  await clickAt(ui, log!.left + 2, log!.top)
  await clickAt(ui, 34, 6)
  const crafted = pictures(await ui.drawn({ in: 'board' })).find(p => /\+1 ★/.test(p.alt))
  expect(crafted?.alt).toContain('Bretter')
  await ui.unmount()
})

test('the round ends when its time is up, and the score counts', { options: { language: 'de' } }, async ($, on) => {
  const stored: Record<string, unknown> = { records: { small: 3, table: 0 } }
  await engineBeneath($, on, stored)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pressDrawn(ui, /^Inventar 2×2/)

  // Craft planks once: half the logs, one into the grid, the rest back, the result.
  const log = pictures(await ui.drawn({ in: 'board' })).find(p => p.alt === 'Holzstamm' && p.top >= 10)
  expect(log).toBeDefined()
  await clickAt(ui, log!.left + 2, log!.top, 'right')
  await clickAt(ui, 14, 4, 'right')
  await clickAt(ui, log!.left + 2, log!.top)
  await clickAt(ui, 30, 5)

  await ui.advance(61_000)
  const over = pictures(await ui.drawn({ in: 'board' }))
  expect(over.some(p => p.alt === 'Zeit um!')).toBe(true)
  expect(over.some(p => p.alt === 'Nochmal')).toBe(true)
  // One craft scores one point: the record of three stands.
  expect(stored.records).toEqual({ small: 3, table: 0 })
  await ui.unmount()
})

test('the quit button ends the round and closes the pane', { options: { language: 'en' } }, async ($, on) => {
  const closed: string[] = []
  await engineBeneath($, on, {}, closed)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pressDrawn(ui, /^Inventory 2×2/)
  await pressDrawn(ui, /^Quit$/)
  expect(closed).toContain('craft-rush')
  await ui.unmount()
})

test('the terminal draws the board without pictures', { options: { language: 'en' } }, async ($, on) => {
  await engineBeneath($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'start-small' })
  const tree = await ui.drawn({ in: 'board' })
  expect(pictures(tree)).toHaveLength(0)
  expect(await ui.find({ type: 'Button', key: 'quit', in: 'board' })).toBeDefined()
  await ui.unmount()
})

test('/craft demo plays a round by itself and keeps no record', { options: { language: 'en', demo: 'on' } }, async ($, on) => {
  const stored: Record<string, unknown> = { records: { small: 0, table: 999 } }
  await engineBeneath($, on, stored)
  await $.command.run({ ...CRAFT_DEMO })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // The record shown is the demo's own, not the person's 999.
  const playing = pictures(await ui.drawn({ in: 'board' }))
  expect(playing.some(p => p.alt === 'Best 150')).toBe(true)
  await ui.advance(41_000)
  const over = pictures(await ui.drawn({ in: 'board' }))
  expect(over.some(p => p.alt === "Time's up!")).toBe(true)
  expect(over.some(p => p.alt === 'New best!')).toBe(true)
  expect(stored.records).toEqual({ small: 0, table: 999 })
  await ui.unmount()
})

test('/craft demo is an ordinary /craft where the demo option is off', { options: { language: 'en' } }, async ($, on) => {
  await engineBeneath($, on)
  await $.command.run({ ...CRAFT_DEMO })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(pictures(await ui.drawn({ in: 'board' })).some(p => p.alt === 'CRAFT RUSH')).toBe(true)
  await ui.unmount()
})

test('/craft demo en speaks English on a German system', { options: { language: 'de', demo: 'on' } }, async ($, on) => {
  await engineBeneath($, on)
  await $.command.run({ ...CRAFT_DEMO, args: 'demo en' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const playing = pictures(await ui.drawn({ in: 'board' }))
  expect(playing.some(p => p.alt === 'Best 150')).toBe(true)
  expect(playing.some(p => p.alt === 'Crafting table 3×3')).toBe(true)
  await ui.advance(41_000)
  const over = pictures(await ui.drawn({ in: 'board' }))
  expect(over.some(p => p.alt === 'New best!')).toBe(true)
  expect(over.some(p => p.alt === 'Play again')).toBe(true)
  await ui.unmount()
})

test('a narrow pane gets narrower slots, and nothing past its edge', { options: { language: 'en' } }, async ($, on) => {
  await engineBeneath($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.resize({ columns: 30, rows: 60, in: 'board' })
  await pressDrawn(ui, /^3×3/)
  const drawn = pictures(await ui.drawn({ in: 'board' }))
  // The hotbar's nine slots stand three columns apart.
  const hotbar = drawn.filter(p => p.top === 19).map(p => p.left)
  expect(hotbar.slice(0, 9)).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25])
  // Every drawn thing starts inside the board's 29 columns.
  expect(drawn.every(p => p.left < 29)).toBe(true)
  // Its buttons still press: quit ends the round.
  await pressDrawn(ui, /^Quit$/)
  await ui.unmount()
})
