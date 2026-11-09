import { expect, test } from 'claude-code/testing'
import type { RenderElement } from 'claude-code'

const PANE = {
  plugin: 'claudesurfers',
  component: 'Pane',
  requestId: 'claudesurfers',
  props: {
    title: 'ClaudeSurfers',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

type Kit = Parameters<Exclude<Parameters<typeof test>[2], undefined>>

async function engineBeneath($: Kit[0], on: Kit[1], stored: Record<string, unknown> = {}) {
  on('command.register', () => ({ value: { command: 'surf' } }))
  on('clock.now', () => ({ value: 1_000 }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => {
    stored[e.key] = e.value
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
}

type Placed = { left: number; top: number; alt: string; source: string; width: unknown; height: unknown }

// Every picture the board drew, where the box placing it sits.
function pictures(tree: RenderElement): Placed[] {
  const out: Placed[] = []
  const walk = (node: unknown, left: number, top: number) => {
    if (!node || typeof node !== 'object') return
    const element = node as { type: string; props?: Record<string, unknown>; children?: unknown[] }
    const props = element.props ?? {}
    const x = typeof props.left === 'number' ? props.left : left
    const y = typeof props.top === 'number' ? props.top : top
    if (element.type === 'Svg') out.push({ left: x, top: y, alt: String(props.alt), source: String(props.source), width: props.width, height: props.height })
    for (const child of element.children ?? []) walk(child, x, y)
  }
  walk(tree, 0, 0)
  return out
}

type Mounted = {
  pointer: (event: { type: 'down' | 'up'; x: number; y: number; button: 'left' }) => Promise<void>
  drawn: (scope: { in: string }) => Promise<RenderElement>
}

// Presses a drawn button by the words on it: its region in cells, shifted by
// how far the stage is centred inside the region (none at this size).
async function pressDrawn(ui: Mounted, words: RegExp) {
  const found = pictures(await ui.drawn({ in: 'board' })).find(p => words.test(p.alt))
  expect(found).toBeDefined()
  const x = found!.left + 1
  await ui.pointer({ type: 'down', x, y: found!.top, button: 'left' })
  await ui.pointer({ type: 'up', x, y: found!.top, button: 'left' })
}

const texts = (node: unknown): string => JSON.stringify(node)

test('the menu draws, a click starts a run and it banks when it ends', { options: { language: 'en' } }, async ($, on) => {
  const stored: Record<string, unknown> = {}
  await engineBeneath($, on, stored)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.resize({ columns: 60, rows: 27, in: 'board' })
  await ui.advance(80)

  const menu = pictures(await ui.drawn({ in: 'board' }))
  expect(menu.some(p => p.alt === 'ClaudeSurfers' && p.source.startsWith('<svg'))).toBe(true)
  expect(menu.some(p => /^Go$/.test(p.alt))).toBe(true)

  await pressDrawn(ui, /^Go$/)
  await ui.advance(200)
  const playing = pictures(await ui.drawn({ in: 'board' }))
  expect(playing.some(p => /^\d+$/.test(p.alt))).toBe(true)

  // Left alone, the first row of obstacles or a later one ends the run.
  await ui.advance(60_000)
  const over = pictures(await ui.drawn({ in: 'board' }))
  expect(over.some(p => /Crash/.test(p.alt))).toBe(true)
  const profile = stored.profile as { runs: number; best: number }
  expect(profile.runs).toBe(1)
  expect(profile.best).toBeGreaterThan(0)
  await ui.unmount()
})

test('keys steer once the game is running and p pauses it', { options: { language: 'en' } }, async ($, on) => {
  await engineBeneath($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.resize({ columns: 60, rows: 27, in: 'board' })
  await ui.advance(40)
  await ui.key({ key: 'return', in: 'board' })
  await ui.advance(80)
  await ui.key({ key: 'left', in: 'board' })
  await ui.key({ key: 'p', in: 'board' })
  await ui.advance(80)
  const paused = pictures(await ui.drawn({ in: 'board' }))
  expect(paused.some(p => /Pause/.test(p.alt))).toBe(true)
  await ui.key({ key: 'p', in: 'board' })
  await ui.advance(80)
  expect(pictures(await ui.drawn({ in: 'board' })).some(p => /Pause/.test(p.alt))).toBe(false)
  await ui.unmount()
})

test('a buddy can be bought with banked tokens and is then worn', { options: { language: 'en' } }, async ($, on) => {
  const stored: Record<string, unknown> = { profile: { best: 10, bank: 100, owned: [], selected: 'claude', runs: 1 } }
  await engineBeneath($, on, stored)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.resize({ columns: 60, rows: 27, in: 'board' })
  await ui.advance(40)
  await pressDrawn(ui, /^Buddies$/)
  await ui.advance(40)
  const garage = pictures(await ui.drawn({ in: 'board' }))
  expect(garage.filter(p => /^[A-Z][a-z]+: /.test(p.alt)).length).toBe(12)

  await pressDrawn(ui, /^Explorer: /)
  await ui.advance(40)
  const profile = stored.profile as { bank: number; owned: string[]; selected: string }
  expect(profile.bank).toBe(25)
  expect(profile.owned).toEqual(['explorer'])
  expect(profile.selected).toBe('explorer')
  await ui.unmount()
})

test('a buddy too dear stays locked and says what is missing', { options: { language: 'en' } }, async ($, on) => {
  const stored: Record<string, unknown> = { profile: { best: 0, bank: 10, owned: [], selected: 'claude', runs: 0 } }
  await engineBeneath($, on, stored)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.resize({ columns: 60, rows: 27, in: 'board' })
  await ui.advance(40)
  await pressDrawn(ui, /^Buddies$/)
  await ui.advance(40)
  await pressDrawn(ui, /^Opus: /)
  await ui.advance(40)
  expect((stored.profile as { owned?: string[] } | undefined)?.owned ?? []).toEqual([])
  expect(pictures(await ui.drawn({ in: 'board' })).some(p => /3490/.test(p.alt))).toBe(true)
  await ui.unmount()
})

test('quitting from the pause banks what the run collected', { options: { language: 'en' } }, async ($, on) => {
  const stored: Record<string, unknown> = {}
  await engineBeneath($, on, stored)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.resize({ columns: 60, rows: 27, in: 'board' })
  await ui.advance(40)
  await ui.key({ key: 'return', in: 'board' })
  await ui.advance(1200)
  await ui.key({ key: 'p', in: 'board' })
  await ui.advance(40)
  await pressDrawn(ui, /^Quit$/)
  await ui.advance(40)
  const profile = stored.profile as { runs: number; best: number }
  expect(profile.runs).toBe(1)
  expect(profile.best).toBeGreaterThan(0)
  await ui.unmount()
})

// What the desktop's page refuses a whole drawing over: a picture has to say
// its size in pixels, positive and no more than 4096.
function expectDrawable(tree: RenderElement) {
  for (const p of pictures(tree)) {
    if (typeof p.width !== 'number' || typeof p.height !== 'number') throw new Error(`no size on "${p.alt}"`)
    if (p.width <= 0 || p.height <= 0 || p.width > 4096 || p.height > 4096) throw new Error(`bad size on "${p.alt}": ${p.width} x ${p.height}`)
    if (p.source.length > 131072) throw new Error(`too long: "${p.alt}"`)
  }
}

test('every screen is one the desktop page can draw, in any pane', { options: { language: 'en' } }, async ($, on) => {
  const stored: Record<string, unknown> = { profile: { best: 10, bank: 100, owned: [], selected: 'claude', runs: 1 } }
  await engineBeneath($, on, stored)
  for (const size of [{ columns: 40, rows: 40 }, { columns: 60, rows: 27 }, { columns: 180, rows: 50 }]) {
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    await ui.resize({ ...size, in: 'board' })
    await ui.advance(80)
    expectDrawable(await ui.drawn({ in: 'board' }))
    await pressDrawn(ui, /^Buddies$/)
    await ui.advance(40)
    expectDrawable(await ui.drawn({ in: 'board' }))
    await pressDrawn(ui, /^Back$/)
    await ui.advance(40)
    await ui.key({ key: 'return', in: 'board' })
    await ui.advance(400)
    expectDrawable(await ui.drawn({ in: 'board' }))
    await ui.key({ key: 'p', in: 'board' })
    await ui.advance(40)
    expectDrawable(await ui.drawn({ in: 'board' }))
    await ui.key({ key: 'p', in: 'board' })
    await ui.advance(60_000)
    expect(pictures(await ui.drawn({ in: 'board' })).some(p => /Crash/.test(p.alt))).toBe(true)
    expectDrawable(await ui.drawn({ in: 'board' }))
    await ui.unmount()
  }
})

const withRows = (bodyRows: number) => ({ ...PANE, props: { ...PANE.props, scroll: { offset: 0, bodyRows } } })

test('the game takes the rows the pane has, not the rows its region was first given', { options: { language: 'en' } }, async ($, on) => {
  await engineBeneath($, on)
  const ui = await $.ui.mount({ ...withRows(44), surface: 'desktop' })
  // The desktop lays the region out at one row before anything is drawn in it.
  await ui.resize({ columns: 140, rows: 1, in: 'board' })
  await ui.advance(80)
  const tree = (await ui.drawn({ in: 'board' })) as unknown as { props: Record<string, unknown> }
  expect(tree.props.width).toBe(140)
  expect(tree.props.height).toBe(44)
  expect(tree.props.backgroundColor).toBeDefined()
  const drawn = pictures(tree as unknown as RenderElement)
  expect(drawn.find(p => p.alt === 'Go')!.top).toBe(41)
  await pressDrawn(ui, /^Go$/)
  await ui.advance(120)
  expect(pictures(await ui.drawn({ in: 'board' })).some(p => /^\d+$/.test(p.alt))).toBe(true)
  await ui.unmount()
})

test('a pane that has not measured itself yet still gets a whole game', { options: { language: 'en' } }, async ($, on) => {
  await engineBeneath($, on)
  const ui = await $.ui.mount({ ...withRows(1), surface: 'desktop' })
  await ui.resize({ columns: 60, rows: 1, in: 'board' })
  await ui.advance(80)
  const tree = (await ui.drawn({ in: 'board' })) as unknown as { props: Record<string, number> }
  expect(tree.props.height).toBeGreaterThan(20)
  await ui.unmount()
})

test('after a crash only Enter or the button go again, and not straight away', { options: { language: 'en' } }, async ($, on) => {
  await engineBeneath($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.resize({ columns: 60, rows: 40, in: 'board' })
  await ui.advance(40)
  await ui.key({ key: 'return', in: 'board' })
  const isCrash = async () => pictures(await ui.drawn({ in: 'board' })).some(p => /Crash/.test(p.alt))
  for (let i = 0; i < 400 && !(await isCrash()); i++) await ui.advance(200)
  expect(await isCrash()).toBe(true)

  // The keys of the run are still arriving.
  await ui.key({ key: 'space', in: 'board' })
  await ui.key({ key: 'up', in: 'board' })
  await ui.key({ key: 'return', in: 'board' })
  await ui.advance(120)
  expect(await isCrash()).toBe(true)

  // The space bar never restarts; Enter does, once the moment has passed.
  await ui.advance(2000)
  await ui.key({ key: 'space', in: 'board' })
  await ui.advance(80)
  expect(await isCrash()).toBe(true)
  await ui.key({ key: 'return', in: 'board' })
  await ui.advance(80)
  expect(await isCrash()).toBe(false)
  await ui.unmount()
})

test('the terminal gets the same game in letters', { options: { language: 'en' } }, async ($, on) => {
  await engineBeneath($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.advance(40)
  expect(texts(await ui.drawn({ in: 'board' }))).toContain('CLAUDE SURFERS')
  await ui.press({ key: 'start' })
  await ui.advance(200)
  expect(texts(await ui.drawn({ in: 'board' }))).toContain('│')
  await ui.unmount()
})
