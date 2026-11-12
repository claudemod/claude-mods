import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Agent, AgentState, CardMessage, Lang, Step } from '../types'
import { craftHeadingSvg } from './art'
import { languageOf, wordsFor } from './i18n'
import { detailAfter, detailBefore, labelOf } from './steps'
import { cardOf, detailOf, kindOf } from './view'

const PANE = 'agent-buddies'

// A calm set around Claude's orange, one per agent in the order they start.
export const COLORS = ['#D97757', '#6A9BCC', '#7D9B63', '#8C7DB8', '#C9A24B', '#4FA3A5', '#CC7A9B', '#9A8C7A']

const KEPT_STEPS = 60
const KEPT_AGENTS = 12
const KEPT_PROMPT = 4000
const KEPT_ANSWER = 6000

const agents = atom({ plugin: 'agent-buddies', key: 'agents' } as const, [], { shape: 'agents-2' })
const open = atom({ plugin: 'agent-buddies', key: 'open' } as const, [])
const expanded = atom({ plugin: 'agent-buddies', key: 'expanded' } as const, [])
const focus = atom({ plugin: 'agent-buddies', key: 'focus' } as const, '')
const chosenPhases = atom({ plugin: 'agent-buddies', key: 'phases' } as const, [])

// How many steps the last finished agents of each type took, kept across
// sessions: what a running agent's progress is measured against.
const HISTORY = 'history-1'
const KEPT_HISTORY = 20
type History = Record<string, number[]>

async function historyOf($: EngineInterface): Promise<History> {
  const stored = await $.store.get(HISTORY).catch(() => undefined)
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {}
  const out: History = {}
  for (const [type, list] of Object.entries(stored as Record<string, unknown>)) {
    if (Array.isArray(list)) out[type] = list.filter((n): n is number => typeof n === 'number' && n > 0)
  }
  return out
}

function median(list: readonly number[]) {
  const sorted = [...list].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

// What a to-do tool call says about how far its agent is.
function todosAfter(tool: string, input: Record<string, unknown>, before: Agent['todos']): Agent['todos'] {
  if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
    const todos = input.todos as { status?: string }[]
    return {
      done: todos.filter(t => t.status === 'completed').length,
      active: todos.filter(t => t.status === 'in_progress').length,
      total: todos.length,
    }
  }
  const now = before ?? { done: 0, active: 0, total: 0 }
  if (tool === 'TaskCreate') return { ...now, total: now.total + 1 }
  if (tool === 'TaskUpdate') {
    if (input.status === 'completed') return { ...now, done: Math.min(now.total, now.done + 1), active: Math.max(0, now.active - 1) }
    if (input.status === 'in_progress') return { ...now, active: now.active + 1 }
    if (input.status === 'deleted') return { ...now, total: Math.max(0, now.total - 1) }
  }
  return before
}
const language = atom({ plugin: 'agent-buddies', key: 'language' } as const, 'en')
// The Craft Skin is the XP bar's to set; without that mod it is simply off.
const craftSkin = atom({ plugin: 'xp-bar', key: 'craftSkin' } as const, false)
// With the skin a card is dressed like an item's tooltip.
const CRAFT_EDGE = '#5000FF'
const CRAFT_GROUND = '#100010'

// A new prompt starts a new round: the next agent clears what finished before.
let isNewRound = true
// The person closed the pane: it stays closed until their next prompt.
let isDismissed = false

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

function nextColor(list: readonly Agent[]) {
  const free = COLORS.find(color => !list.some(agent => agent.color === color))
  return free ?? COLORS[list.length % COLORS.length] ?? '#D97757'
}

type Spawned = { id: string; name: string; prompt?: string; type?: string; model?: string }

function welcome(list: readonly Agent[], spawned: Spawned, now: number, isFresh: boolean): Agent[] {
  const known = list.find(agent => agent.id === spawned.id)
  if (known) return list.map(agent => (agent.id === spawned.id ? { ...agent, state: 'running', endedAt: undefined } : agent))
  const kept = isFresh ? list.filter(agent => agent.state === 'running') : list
  const agent: Agent = {
    id: spawned.id,
    name: spawned.name || 'Agent',
    color: nextColor(kept),
    state: 'running',
    startedAt: now,
    prompt: (spawned.prompt ?? '').slice(0, KEPT_PROMPT),
    type: spawned.type ?? '',
    model: spawned.model ?? '',
    answer: '',
    tokens: 0,
    total: 0,
    counts: {},
    steps: [],
  }
  return [...kept, agent].slice(-KEPT_AGENTS)
}

async function showPane($: EngineInterface) {
  if (isDismissed) return
  const words = wordsFor(await read($, language))
  void $.ui.open({ id: PANE, title: words.title })
}

async function addAgent($: EngineInterface, spawned: Spawned) {
  const isFresh = isNewRound
  isNewRound = false
  const past = (await historyOf($))[spawned.type ?? ''] ?? []
  await update($, agents, list =>
    welcome(list, spawned, Date.now(), isFresh).map(agent =>
      agent.id === spawned.id && agent.samples === undefined ? { ...agent, expected: median(past), samples: past.length } : agent,
    ),
  )
  await showPane($)
}

function toggled(list: readonly string[], id: string) {
  return list.includes(id) ? list.filter(one => one !== id) : [...list, id].slice(-40)
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'buddies', description: 'Agent Buddies: show the agents panel' })
    const result = await next(e)
    const chosen = options.language
    const lang = chosen === 'de' || chosen === 'en' ? chosen : await systemLanguage($)
    await update($, language, () => lang)
    return result
  })

  on('command.run', { command: 'buddies' }, async $ => {
    isDismissed = false
    const words = wordsFor(await read($, language))
    await $.ui.open({ id: PANE, title: words.title, focus: true })
    return { text: words.opened }
  })

  on('prompt.submit', async ($, e, next) => {
    if (!e.isMeta) {
      isNewRound = true
      isDismissed = false
    }
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if (result.deny === undefined && result.agentId) {
      await addAgent($, { id: result.agentId, name: e.description, prompt: e.prompt, type: e.subagentType, model: result.model })
    }
    return result
  })

  // Each call of an agent's loop, whichever tool it is. The engine's own forks
  // carry ids no agent list names, so they never get a buddy.
  on('tool.call', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId === undefined) return next(e)

    const isKnown = (await read($, agents)).some(agent => agent.id === agentId)
    if (!isKnown) {
      const listed = (await $.agent.list().catch(() => [])).find(agent => agent.id === agentId)
      if (!listed) return next(e)
      await addAgent($, { id: listed.id, name: listed.description })
    }

    const input = e as unknown as Record<string, unknown>
    const { name, arg } = labelOf(input)
    const step: Step = {
      id: e.tool_use_id,
      name,
      arg,
      tool: e.tool,
      kind: kindOf(e.tool),
      state: 'running',
      startedAt: Date.now(),
      detail: detailBefore(input),
    }
    await update($, agents, list =>
      list.map(agent =>
        agent.id === agentId
          ? {
              ...agent,
              state: 'running' as const,
              endedAt: undefined,
              total: agent.total + 1,
              todos: todosAfter(e.tool, input, agent.todos),
              counts: { ...agent.counts, [e.tool]: (agent.counts[e.tool] ?? 0) + 1 },
              steps: [...agent.steps, step].slice(-KEPT_STEPS),
            }
          : agent,
      ),
    )

    const finish = (state: Step['state'], extra: Step['detail']) =>
      update($, agents, list =>
        list.map(agent =>
          agent.id === agentId
            ? {
                ...agent,
                steps: agent.steps.map(one =>
                  one.id === step.id ? { ...one, state, endedAt: Date.now(), detail: [...one.detail, ...extra].slice(0, 24) } : one,
                ),
              }
            : agent,
        ),
      )

    try {
      const result = await next(e)
      await finish(result.deny !== undefined || result.isError ? 'error' : 'ok', detailAfter(e.tool, result))
      return result
    } catch (error) {
      await finish('error', [])
      throw error
    }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) return result
    const state: AgentState = e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'stopped' : 'failed'
    const now = Date.now()
    const usage = e.usage
    const tokens = usage
      ? usage.input_tokens + usage.output_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0)
      : 0
    await update($, agents, list =>
      list.map(agent =>
        agent.id === e.agentId
          ? {
              ...agent,
              state,
              endedAt: now,
              answer: e.answer ? e.answer.slice(0, KEPT_ANSWER) : agent.answer,
              tokens: agent.tokens + tokens,
              model: usage?.model ?? agent.model,
              steps: agent.steps.map(step => (step.state === 'running' ? { ...step, state: 'ok' as const, endedAt: now } : step)),
            }
          : agent,
      ),
    )
    // A finished agent teaches the estimate how many steps its type takes.
    const finished = (await read($, agents)).find(agent => agent.id === e.agentId)
    if (state === 'done' && finished && finished.total > 0) {
      const history = await historyOf($)
      const type = finished.type
      history[type] = [...(history[type] ?? []), finished.total].slice(-KEPT_HISTORY)
      await $.store.set(HISTORY, history).catch(() => undefined)
    }
    return result
  })

  on('ui.message', async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const message = e.data as CardMessage
    if (message.kind === 'step') await update($, open, list => toggled(list, message.id))
    if (message.kind === 'toggle') await update($, expanded, list => toggled(list, message.id))
    if (message.kind === 'phase') {
      const mark = `${message.open ? '+' : '-'}${message.id}`
      await update($, chosenPhases, list => [...list.filter(one => one.slice(1) !== message.id), mark].slice(-200))
    }
    if (message.kind === 'agent') await update($, focus, () => message.id)
    if (message.kind === 'back') await update($, focus, () => '')
    return {}
  })

  on('ui.close', ($, e, next) => {
    if (e.id === PANE && e.origin.kind === 'person') isDismissed = true
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    const lang = await read($, language)
    const words = wordsFor(lang)
    const list = await read($, agents)

    if (list.length === 0) return <Text dimColor>{words.empty}</Text>

    const running = list.filter(agent => agent.state === 'running').length
    // vscode lists Client in its table but drops it, and the pane would stay empty.
    if (!('Client' in elements) || e.surface === 'vscode') {
      return (
        <Box flexDirection="column">
          {list.map(agent => (
            <Text color={agent.color}>
              ■ <Text>{agent.name}</Text> <Text dimColor>{agent.steps[agent.steps.length - 1]?.name ?? ''}</Text>
            </Text>
          ))}
        </Box>
      )
    }

    const { Client } = elements
    const openIds = await read($, open)
    const isCraftSkin = await read($, craftSkin)
    const hasPictures = 'Svg' in elements
    const now = Date.now()

    // One agent picked: its whole run, phase by phase.
    const focusId = await read($, focus)
    const focused = list.findIndex(agent => agent.id === focusId)
    if (focused >= 0) {
      const expandedIds = await read($, expanded)
      const chosen = await read($, chosenPhases)
      const agent = list[focused] as Agent
      const props = detailOf(agent, list, focused, lang, Math.max(28, e.props.bodyColumns - (isCraftSkin ? 3 : 1)), hasPictures, openIds, expandedIds, chosen, isCraftSkin, now)
      const view = <Client key="detail" module="./detail.tsx" props={props} width="100%" />
      return isCraftSkin ? (
        <Box borderStyle="single" borderColor={CRAFT_EDGE} backgroundColor={CRAFT_GROUND}>
          {view}
        </Box>
      ) : (
        view
      )
    }

    // Inside a card's padded frame: the frame is the app's own rounded border.
    const columns = Math.max(24, e.props.bodyColumns - 4)

    return (
      <Box flexDirection="column" gap="sm">
        {isCraftSkin && 'Svg' in elements ? (
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <elements.Svg {...craftHeadingSvg(words.title, 2, '#FFFFFF')} alt={words.title} />
            <elements.Svg {...craftHeadingSvg(words.count(running, list.length - running), 1.5, '#AAAAAA')} alt={words.count(running, list.length - running)} />
          </Box>
        ) : (
          <Box flexDirection="row" justifyContent="space-between">
            <Text weight="semibold">{words.title}</Text>
            <Text size="footnote" dimColor>
              {words.count(running, list.length - running)}
            </Text>
          </Box>
        )}
        {list.map((agent, index) => {
          const card = (
            <Client key={agent.id} module="./card.tsx" props={cardOf(agent, index, lang, columns, hasPictures, openIds, isCraftSkin, now)} width="100%" />
          )
          // With the skin the frame is an item tooltip's: dark outside, violet within.
          return isCraftSkin ? (
            <Box key={`card-${agent.id}`} borderStyle="single" borderColor={CRAFT_GROUND} padding={0}>
              <Box borderStyle="single" borderColor={CRAFT_EDGE} backgroundColor={CRAFT_GROUND}>
                {card}
              </Box>
            </Box>
          ) : (
            <Box key={`card-${agent.id}`} borderStyle="round" borderColor={agent.state === 'running' ? agent.color : undefined} borderDimColor>
              {card}
            </Box>
          )
        })}
      </Box>
    )
  })
}
