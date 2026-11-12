import type { Agent, CardProps, DetailProps, DetailRow, Fold, Kind, Lang, Phase, Segment, Step } from '../types'
import { heldFor } from './art'
import { wordsFor } from './i18n'
import { summaryOf } from './steps'

// Turns what the hooks module keeps into what the cards and the detail view
// draw. Everything here is plain: no `$`, so the tests can call it directly.

export const SHOWN_STEPS = 3
const TASK_LINES = 3
const RESULT_LINES = 6
const OPEN_LINES = 80
// An agent with no more steps than this shows every phase open.
const SMALL_RUN = 12

export function kindOf(tool: string): Kind {
  if (/^(Read|NotebookRead)$/.test(tool)) return 'read'
  if (/^(Grep|Glob|LS|ToolSearch)$/.test(tool)) return 'search'
  if (/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(tool)) return 'edit'
  if (/^(Bash|PowerShell|BashOutput|KillShell|Monitor)$/.test(tool)) return 'run'
  if (/^Web(Fetch|Search)$/.test(tool)) return 'web'
  return 'tool'
}

export const KIND_ORDER: Kind[] = ['read', 'search', 'edit', 'run', 'web', 'tool']

// How long something took: tenths under ten seconds, then seconds, then m:ss.
export function took(ms: number, lang: Lang) {
  const sep = lang === 'de' ? ' ' : ''
  if (ms < 10_000) return `${(Math.max(0, ms) / 1000).toFixed(1).replace('.', lang === 'de' ? ',' : '.')}${sep}s`
  if (ms < 60_000) return `${Math.round(ms / 1000)}${sep}s`
  return clock(ms)
}

export function clock(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// "claude-haiku-5-5" reads "Haiku 5.5"; anything else stays as it came.
export function modelName(id: string) {
  const match = /claude-([a-z]+)-(\d+)(?:-(\d+))?/i.exec(id)
  if (!match) return id
  const family = match[1] ?? ''
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${match[2]}${match[3] ? `.${match[3]}` : ''}`
}

export function tokenCount(n: number, lang: Lang) {
  if (n < 1000) return String(n)
  const k = n < 100_000 ? (n / 1000).toFixed(1) : String(Math.round(n / 1000))
  return `${lang === 'de' ? k.replace('.', ',') : k}k`
}

// Markdown read as plain lines, wrapped at word boundaries to `width` characters.
export function wrapText(text: string, width: number): string[] {
  const room = Math.max(12, width)
  const out: string[] = []
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    if (/^\s*```/.test(raw)) continue
    const line = raw
      .replace(/\t/g, '  ')
      .replace(/^\s*#{1,6}\s+/, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\s+$/, '')
    if (line.trim() === '') {
      if (out.length > 0 && out[out.length - 1] !== '') out.push('')
      continue
    }
    const indent = /^\s*/.exec(line)?.[0] ?? ''
    let current = ''
    for (const word of line.trim().split(/\s+/)) {
      let rest = word
      while (rest.length > room - indent.length) {
        if (current) {
          out.push(indent + current)
          current = ''
        }
        out.push(indent + rest.slice(0, room - indent.length))
        rest = rest.slice(room - indent.length)
      }
      if (!current) current = rest
      else if (indent.length + current.length + 1 + rest.length <= room) current += ` ${rest}`
      else {
        out.push(indent + current)
        current = rest
      }
    }
    if (current) out.push(indent + current)
  }
  while (out[out.length - 1] === '') out.pop()
  return out
}

function fold(id: string, text: string, width: number, shown: number, expanded: readonly string[], lang: Lang): Fold {
  const words = wordsFor(lang)
  // Blank lines cost a row each and say nothing in a pane this narrow.
  const lines = wrapText(text, width).filter(line => line !== '')
  const isOpen = expanded.includes(id)
  // One hidden line is not worth a row of its own that says so.
  if (lines.length <= shown + 1) return { id, lines, isOpen: false, more: '' }
  if (isOpen) return { id, lines: lines.slice(0, OPEN_LINES), isOpen, more: words.less }
  return { id, lines: lines.slice(0, shown), isOpen, more: words.more(lines.length - shown) }
}

// How far a running agent is, 0..1, and how that was found. Its own to-do
// list says it best; else the steps that agents of its type took before;
// else a curve that rises quickly and never claims to be done.
export function progressOf(agent: Agent, lang: Lang): { value: number; isExact: boolean; basis: string } {
  const words = wordsFor(lang)
  if (agent.state !== 'running') return { value: 1, isExact: true, basis: '' }
  const todos = agent.todos
  if (todos && todos.total > 0) {
    return { value: Math.min(0.99, (todos.done + todos.active * 0.5) / todos.total), isExact: true, basis: words.todos(todos.done, todos.total) }
  }
  if (agent.expected && agent.expected > 0 && (agent.samples ?? 0) >= 2) {
    return { value: Math.max(0.02, Math.min(0.95, agent.total / agent.expected)), isExact: false, basis: words.history(agent.samples ?? 0) }
  }
  return { value: Math.max(0.02, 0.9 * (1 - Math.exp(-agent.total / 14))), isExact: false, basis: words.rough }
}

const durationOf = (step: Step, now: number) => (step.endedAt ?? now) - step.startedAt

export function stripOf(steps: readonly Step[], now: number): Segment[] {
  // The quickest steps still get a sliver: a read that took 20 ms happened too.
  return steps.map(step => ({ kind: step.kind, state: step.state, weight: Math.max(400, durationOf(step, now)) }))
}

function statusOf(agent: Agent, lang: Lang) {
  const words = wordsFor(lang)
  const seconds = Math.max(1, Math.round(((agent.endedAt ?? agent.startedAt) - agent.startedAt) / 1000))
  const progress = progressOf(agent, lang)
  const percent = words.percent(Math.round(progress.value * 100), progress.isExact)
  return agent.state === 'running' ? `${words.running} · ${percent}` : agent.state === 'done' ? words.done(seconds) : agent.state === 'stopped' ? words.stopped : words.failed
}

export function cardOf(
  agent: Agent,
  index: number,
  lang: Lang,
  columns: number,
  hasPictures: boolean,
  openIds: readonly string[],
  isCraftSkin: boolean,
  now: number,
): CardProps {
  const words = wordsFor(lang)
  const steps = agent.state === 'running' ? agent.steps.slice(-SHOWN_STEPS) : []
  const isDone = agent.state !== 'running'
  const latest = agent.steps[agent.steps.length - 1]
  const subtitle = isDone ? summaryOf(agent.counts, lang) || words.calls(agent.total) : agent.total > 0 ? words.calls(agent.total) : words.starting
  return {
    id: agent.id,
    name: agent.name,
    color: agent.color,
    state: agent.state,
    status: statusOf(agent, lang),
    subtitle,
    held: agent.state === 'running' && latest ? heldFor(latest.tool) : null,
    phase: index,
    columns,
    hasPictures,
    isCraftSkin,
    strip: stripOf(agent.steps, now),
    progress: progressOf(agent, lang).value,
    rows: steps.map(step => {
      const isOpen = openIds.includes(step.id) && step.detail.length > 0
      return { id: step.id, name: step.name, arg: step.arg, state: step.state, isOpen, detail: isOpen ? step.detail : [] }
    }),
  }
}

// `chosen` holds "+id" for a phase the person opened and "-id" for one they closed.
export function phasesOf(agent: Agent, lang: Lang, openIds: readonly string[], chosen: readonly string[], now: number): Phase[] {
  const words = wordsFor(lang)
  // Reading and searching take turns while an agent finds its way: one phase.
  const groupOf = (kind: Kind) => (kind === 'read' || kind === 'search' ? 'explore' : kind)
  const runs: Step[][] = []
  for (const step of agent.steps) {
    const last = runs[runs.length - 1]
    if (last && last[0] && groupOf(last[0].kind) === groupOf(step.kind)) last.push(step)
    else runs.push([step])
  }
  const isSmall = agent.steps.length <= SMALL_RUN
  return runs.map((run, i) => {
    const first = run[0] as Step
    const last = run[run.length - 1] as Step
    const tally = new Map<Kind, number>()
    for (const step of run) tally.set(step.kind, (tally.get(step.kind) ?? 0) + 1)
    // Its colour and icon are the kind it did most.
    const kind = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? first.kind
    const isMixed = tally.size > 1
    const id = `phase:${first.id}`
    const isLatest = i === runs.length - 1
    const byDefault = isSmall || isLatest || run.length <= 3
    const errors = run.filter(step => step.state === 'error').length
    const rows: DetailRow[] = run.map(step => {
      const isOpen = openIds.includes(step.id) && step.detail.length > 0
      return {
        id: step.id,
        name: step.name,
        arg: step.arg,
        state: step.state,
        kind: step.kind,
        isOpen,
        detail: isOpen ? step.detail : [],
        at: `+${clock(step.startedAt - agent.startedAt)}`,
        took: step.state === 'running' ? '' : took(durationOf(step, now), lang),
      }
    })
    return {
      id,
      kind,
      label: isMixed ? words.explore : words.kinds[kind],
      summary: KIND_ORDER.filter(k => tally.has(k))
        .map(k => words.phase(k, tally.get(k) ?? 0))
        .join(' · '),
      errors: errors > 0 ? words.errors(errors) : '',
      took: took((last.endedAt ?? now) - first.startedAt, lang),
      isOpen: chosen.includes(`+${id}`) ? true : chosen.includes(`-${id}`) ? false : byDefault,
      isPinned: chosen.includes(`+${id}`),
      rows,
    }
  })
}

export function detailOf(
  agent: Agent,
  all: readonly Agent[],
  index: number,
  lang: Lang,
  columns: number,
  hasPictures: boolean,
  openIds: readonly string[],
  expanded: readonly string[],
  chosen: readonly string[],
  isCraftSkin: boolean,
  now: number,
): DetailProps {
  const words = wordsFor(lang)
  const latest = agent.steps[agent.steps.length - 1]
  const counts = new Map<Kind, number>()
  for (const [tool, n] of Object.entries(agent.counts)) counts.set(kindOf(tool), (counts.get(kindOf(tool)) ?? 0) + n)
  const meta = [
    agent.model ? modelName(agent.model) : '',
    words.steps(agent.total),
    agent.tokens > 0 ? words.tokens(tokenCount(agent.tokens, lang)) : '',
    agent.type,
  ].filter(Boolean)
  const textWidth = columns - 2
  return {
    id: agent.id,
    name: agent.name,
    color: agent.color,
    state: agent.state,
    status: statusOf(agent, lang),
    meta: meta.join(' · '),
    held: agent.state === 'running' && latest ? heldFor(latest.tool) : null,
    phase: index,
    columns,
    hasPictures,
    isCraftSkin,
    startedAt: agent.startedAt,
    tabs: all.map(one => ({ id: one.id, name: one.name, color: one.color, state: one.state })),
    strip: stripOf(agent.steps, now),
    progress: progressOf(agent, lang).value,
    basis: progressOf(agent, lang).basis,
    legend: KIND_ORDER.filter(kind => (counts.get(kind) ?? 0) > 0).map(kind => ({ kind, label: words.kinds[kind], count: counts.get(kind) ?? 0 })),
    words: { back: words.back, task: words.task, flow: words.flow, result: words.result, waiting: words.waiting, noSteps: words.noSteps, earlier: words.earlier },
    task: fold(`task:${agent.id}`, agent.prompt || agent.name, textWidth, TASK_LINES, expanded, lang),
    phases: phasesOf(agent, lang, openIds, chosen, now),
    result: agent.answer ? fold(`result:${agent.id}`, agent.answer, textWidth, RESULT_LINES, expanded, lang) : null,
  }
}
