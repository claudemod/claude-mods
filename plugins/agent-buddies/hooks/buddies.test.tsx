import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = {
  plugin: 'agent-buddies',
  component: 'Pane',
  requestId: 'agent-buddies',
  props: {
    title: 'Agents',
    isFocused: false,
    bodyColumns: 52,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

function engine(on: On) {
  const opened: string[] = []
  let next = 0
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', (_, e) => (opened.push(e.id), { value: { isPlaced: true } }))
  on('agent.list', () => ({ value: [] }))
  on('agent.spawn', () => ({ agentId: `a${++next}`, model: 'claude-haiku-5-5' }))
  on('tool.call', (_, e) => ({
    result: {},
    text: e.tool === 'Bash' ? 'built in 2s\nall good' : 'answer',
  }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  return opened
}

// Every text a drawn tree holds, in order.
function words(tree: unknown): string[] {
  const out: string[] = []
  const walk = (node: unknown) => {
    if (typeof node === 'string') out.push(node)
    if (!node || typeof node !== 'object') return
    for (const child of (node as { children?: unknown[] }).children ?? []) walk(child)
  }
  walk(tree)
  return out
}

function pictures(tree: unknown): string[] {
  const out: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const element = node as { type?: string; props?: Record<string, unknown>; children?: unknown[] }
    if (element.type === 'Svg') out.push(String(element.props?.source))
    for (const child of element.children ?? []) walk(child)
  }
  walk(tree)
  return out
}

const spawn = ($: { agent: { spawn: (a: never) => Promise<unknown> } }, description: string) =>
  $.agent.spawn({ prompt: 'go', description, subagentType: 'general-purpose' } as never)

test('each agent gets its own card, colour and real tools', { options: { language: 'en' } }, async ($, on) => {
  const opened = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await spawn($, 'Build the page')
  await spawn($, 'Research pickers')
  await $.tool.call({ tool: 'Edit', file_path: '/x/src/page.tsx', old_string: 'a', new_string: 'b', agentId: 'a1' } as never)
  await $.tool.call({ tool: 'WebSearch', query: 'date picker', agentId: 'a2' } as never)
  await $.tool.call({ tool: 'mcp__linear__create_issue', title: 'Fix it', agentId: 'a2' } as never)
  // The main loop's own calls belong to no buddy.
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)

  expect(opened).toContain('agent-buddies')
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const first = words(await ui.drawn({ in: 'a1' })).join(' ')
  const second = words(await ui.drawn({ in: 'a2' })).join(' ')
  expect(first).toContain('Build the page')
  expect(first).toContain('src/page.tsx')
  expect(first).not.toContain('WebSearch')
  expect(second).toContain('WebSearch')
  expect(second).toContain('create_issue')
  expect(second).toContain('Fix it')
  expect(second).not.toContain('Edit')
  expect(first + second).not.toContain('Bash')

  const a1 = pictures(await ui.drawn({ in: 'a1' }))[0]
  const a2 = pictures(await ui.drawn({ in: 'a2' }))[0]
  expect(a1).toContain('#D97757')
  expect(a2).toContain('#6A9BCC')
  await ui.unmount()
})

test('a click on a step opens it, a second click closes it', { options: { language: 'en' } }, async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await spawn($, 'Build the page')
  await $.tool.call({ tool: 'Edit', file_path: '/x/page.tsx', old_string: 'old line', new_string: 'new line', agentId: 'a1' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm run build', agentId: 'a1' } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(words(await ui.drawn({ in: 'a1' })).join(' ')).not.toContain('old line')

  // The header takes three rows; the first step is the row after it.
  const click = async (y: number) => {
    await ui.pointer({ type: 'down', x: 5, y, button: 'left', in: 'a1' })
    await ui.pointer({ type: 'up', x: 5, y, button: 'left', in: 'a1' })
  }
  await click(3)
  const opened = words(await ui.drawn({ in: 'a1' })).join(' ')
  expect(opened).toContain('- old line')
  expect(opened).toContain('+ new line')

  // Bash sits below the two diff lines now.
  await click(6)
  const both = words(await ui.drawn({ in: 'a1' })).join(' ')
  expect(both).toContain('$ npm run build')
  expect(both).toContain('all good')

  await click(3)
  expect(words(await ui.drawn({ in: 'a1' })).join(' ')).not.toContain('old line')
  await ui.unmount()
})

test('only the latest three steps show until the card is opened', { options: { language: 'en' } }, async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await spawn($, 'Explore')
  for (const file of ['one', 'two', 'three', 'four', 'five']) {
    await $.tool.call({ tool: 'Read', file_path: `/x/${file}.ts`, agentId: 'a1' } as never)
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const before = words(await ui.drawn({ in: 'a1' })).join(' ')
  expect(before).not.toContain('one.ts')
  expect(before).toContain('five.ts')

  await ui.pointer({ type: 'down', x: 2, y: 0, button: 'left', in: 'a1' })
  await ui.pointer({ type: 'up', x: 2, y: 0, button: 'left', in: 'a1' })
  expect(words(await ui.drawn({ in: 'a1' })).join(' ')).toContain('one.ts')
  await ui.unmount()
})

test('a finished agent closes its eyes and sums up its work', { options: { language: 'en' } }, async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await spawn($, 'Explore')
  await $.tool.call({ tool: 'Read', file_path: '/x/a.ts', agentId: 'a1' } as never)
  await $.tool.call({ tool: 'Read', file_path: '/x/b.ts', agentId: 'a1' } as never)
  await $.tool.call({ tool: 'Grep', pattern: 'x', agentId: 'a1' } as never)
  await $.turn.complete({ turnId: 't1', answer: 'done', durationMs: 900, isAborted: false, reason: 'answer', agentId: 'a1' } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const card = words(await ui.drawn({ in: 'a1' })).join(' ')
  expect(card).toContain('Done')
  expect(card).toContain('Read 2 files · 1 search')
  expect(card).not.toContain('a.ts')
  const buddy = pictures(await ui.drawn({ in: 'a1' }))[0]
  expect(buddy).toContain('<svg')
  expect(buddy).not.toContain('animate')
  await ui.unmount()
})

test('a new prompt clears the finished agents at the next spawn', { options: { language: 'en' } }, async ($, on) => {
  engine(on)
  on('prompt.submit', (_, e) => ({ text: e.text }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await spawn($, 'First round')
  await $.turn.complete({ turnId: 't1', answer: 'done', durationMs: 900, isAborted: false, reason: 'answer', agentId: 'a1' } as never)
  await $.prompt.submit({ text: 'next', origin: { kind: 'user' } } as never)
  await spawn($, 'Second round')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const pane = JSON.stringify(await ui.drawn({ in: 'a2' }))
  expect(pane).toContain('Second round')
  await expect(ui.drawn({ in: 'a1' })).rejects.toThrow()
  await ui.unmount()
})

test('without agents the pane says so, on every surface', { options: { language: 'de' } }, async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text' }))?.text).toContain('Noch keine Agenten')
    await ui.unmount()
  }
})
