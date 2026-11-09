import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Agent, CardMessage, CardProps, Lang, Step } from '../types'
import { heldFor } from './art'
import { languageOf, wordsFor } from './i18n'
import { detailAfter, detailBefore, labelOf, summaryOf } from './steps'

const PANE = 'agent-buddies'

// A calm set around Claude's orange, one per agent in the order they start.
export const COLORS = ['#D97757', '#6A9BCC', '#7D9B63', '#8C7DB8', '#C9A24B', '#4FA3A5', '#CC7A9B', '#9A8C7A']

const SHOWN_STEPS = 3
const KEPT_STEPS = 60
const KEPT_AGENTS = 12

const agents = atom({ plugin: 'agent-buddies', key: 'agents' } as const, [], { shape: 'agents-1' })
const open = atom({ plugin: 'agent-buddies', key: 'open' } as const, [])
const expanded = atom({ plugin: 'agent-buddies', key: 'expanded' } as const, [])
const language = atom({ plugin: 'agent-buddies', key: 'language' } as const, 'en')

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

function welcome(list: readonly Agent[], id: string, name: string, now: number, isFresh: boolean): Agent[] {
  const known = list.find(agent => agent.id === id)
  if (known) return list.map(agent => (agent.id === id ? { ...agent, state: 'running', endedAt: undefined } : agent))
  const kept = isFresh ? list.filter(agent => agent.state === 'running') : list
  const agent: Agent = { id, name: name || 'Agent', color: nextColor(kept), state: 'running', startedAt: now, total: 0, counts: {}, steps: [] }
  return [...kept, agent].slice(-KEPT_AGENTS)
}

async function showPane($: EngineInterface) {
  if (isDismissed) return
  const words = wordsFor(await read($, language))
  void $.ui.open({ id: PANE, title: words.title })
}

async function addAgent($: EngineInterface, id: string, name: string) {
  const isFresh = isNewRound
  isNewRound = false
  await update($, agents, list => welcome(list, id, name, Date.now(), isFresh))
  await showPane($)
}

function toggled(list: readonly string[], id: string) {
  return list.includes(id) ? list.filter(one => one !== id) : [...list, id].slice(-40)
}

function cardOf(agent: Agent, index: number, lang: Lang, columns: number, hasPictures: boolean, openIds: readonly string[], expandedIds: readonly string[]): CardProps {
  const words = wordsFor(lang)
  const isExpanded = expandedIds.includes(agent.id)
  const steps = isExpanded ? agent.steps : agent.state === 'running' ? agent.steps.slice(-SHOWN_STEPS) : []
  const isDone = agent.state !== 'running'
  const seconds = Math.max(1, Math.round(((agent.endedAt ?? agent.startedAt) - agent.startedAt) / 1000))
  const status =
    agent.state === 'running' ? words.running : agent.state === 'done' ? words.done(seconds) : agent.state === 'stopped' ? words.stopped : words.failed
  const latest = agent.steps[agent.steps.length - 1]
  const subtitle = isDone ? summaryOf(agent.counts, lang) || words.calls(agent.total) : agent.total > 0 ? words.calls(agent.total) : words.starting
  return {
    id: agent.id,
    name: agent.name,
    color: agent.color,
    state: agent.state,
    status,
    subtitle,
    held: agent.state === 'running' && latest ? heldFor(latest.tool) : null,
    phase: index,
    columns,
    hasPictures,
    isExpanded,
    rows: steps.map(step => {
      const isOpen = openIds.includes(step.id) && step.detail.length > 0
      return { id: step.id, name: step.name, arg: step.arg, state: step.state, isOpen, detail: isOpen ? step.detail : [] }
    }),
  }
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
    if (result.deny === undefined && result.agentId) await addAgent($, result.agentId, e.description)
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
      await addAgent($, listed.id, listed.description)
    }

    const input = e as unknown as Record<string, unknown>
    const { name, arg } = labelOf(input)
    const step: Step = { id: e.tool_use_id, name, arg, tool: e.tool, state: 'running', detail: detailBefore(input) }
    await update($, agents, list =>
      list.map(agent =>
        agent.id === agentId
          ? {
              ...agent,
              state: 'running',
              endedAt: undefined,
              total: agent.total + 1,
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
            ? { ...agent, steps: agent.steps.map(one => (one.id === step.id ? { ...one, state, detail: [...one.detail, ...extra].slice(0, 16) } : one)) }
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
    const state = e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'stopped' : 'failed'
    await update($, agents, list =>
      list.map(agent =>
        agent.id === e.agentId
          ? {
              ...agent,
              state,
              endedAt: Date.now(),
              steps: agent.steps.map(step => (step.state === 'running' ? { ...step, state: 'ok' } : step)),
            }
          : agent,
      ),
    )
    return result
  })

  on('ui.message', async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const message = e.data as CardMessage
    if (message.kind === 'step') await update($, open, list => toggled(list, message.id))
    if (message.kind === 'agent') await update($, expanded, list => toggled(list, message.id))
    return {}
  })

  on('ui.close', ($, e, next) => {
    if (e.id === PANE && e.origin === 'person') isDismissed = true
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
    if (!('Client' in elements)) {
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
    const expandedIds = await read($, expanded)
    // Inside a card's padded frame: the frame is the app's own rounded border.
    const columns = Math.max(24, e.props.bodyColumns - 4)

    return (
      <Box flexDirection="column" gap="sm">
        <Box flexDirection="row" justifyContent="space-between">
          <Text weight="semibold">{words.title}</Text>
          <Text size="footnote" dimColor>
            {words.count(running, list.length - running)}
          </Text>
        </Box>
        {list.map((agent, index) => (
          <Box key={`card-${agent.id}`} borderStyle="round" borderColor={agent.state === 'running' ? agent.color : undefined} borderDimColor>
            <Client key={agent.id} module="./card.tsx" props={cardOf(agent, index, lang, columns, 'Svg' in elements, openIds, expandedIds)} width="100%" />
          </Box>
        ))}
      </Box>
    )
  })
}
