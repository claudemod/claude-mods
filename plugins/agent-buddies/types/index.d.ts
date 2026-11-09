export type Lang = 'de' | 'en'

export type StepState = 'running' | 'ok' | 'error'
export type AgentState = 'running' | 'done' | 'stopped' | 'failed'
export type Held = 'pencil' | 'book' | 'terminal' | 'lens' | 'globe' | 'plug' | 'gear'

// One line of what a step shows when it is opened.
export type DetailLine = { text: string; tone?: 'add' | 'del' | 'dim' }

// One tool call of one agent, whichever tool it was.
export type Step = {
  id: string
  name: string
  arg: string
  tool: string
  state: StepState
  detail: DetailLine[]
}

export type Agent = {
  id: string
  name: string
  color: string
  state: AgentState
  startedAt: number
  endedAt?: number
  // Every call it made; `steps` keeps only the latest ones.
  total: number
  counts: Record<string, number>
  steps: Step[]
}

// What one card is drawn from. Details travel only for the steps that are open.
export type CardRow = {
  id: string
  name: string
  arg: string
  state: StepState
  isOpen: boolean
  detail: DetailLine[]
}

export type CardProps = {
  id: string
  name: string
  color: string
  state: AgentState
  status: string
  subtitle: string
  held: Held | null
  // Staggers the buddies so they do not walk in step.
  phase: number
  columns: number
  hasPictures: boolean
  rows: CardRow[]
  isExpanded: boolean
}

export type CardMessage = { kind: 'step'; id: string } | { kind: 'agent'; id: string }

declare module 'claude-code' {
  interface PluginState {
    'agent-buddies': {
      agents: Agent[]
      open: string[]
      expanded: string[]
      language: Lang
    }
  }
}
