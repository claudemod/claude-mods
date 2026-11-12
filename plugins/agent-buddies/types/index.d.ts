export type Lang = 'de' | 'en'

export type StepState = 'running' | 'ok' | 'error'
export type AgentState = 'running' | 'done' | 'stopped' | 'failed'
export type Held = 'pencil' | 'book' | 'terminal' | 'lens' | 'globe' | 'plug' | 'gear'
// What kind of work a step is: the phases of an agent's run are runs of one kind.
export type Kind = 'read' | 'search' | 'edit' | 'run' | 'web' | 'tool'

// One line of what a step shows when it is opened.
export type DetailLine = { text: string; tone?: 'add' | 'del' | 'dim' }

// One tool call of one agent, whichever tool it was.
export type Step = {
  id: string
  name: string
  arg: string
  tool: string
  kind: Kind
  state: StepState
  startedAt: number
  endedAt?: number
  detail: DetailLine[]
}

export type Agent = {
  id: string
  name: string
  color: string
  state: AgentState
  startedAt: number
  endedAt?: number
  // The task it was given, its type and model, and what it answered.
  prompt: string
  type: string
  model: string
  answer: string
  tokens: number
  // The agent's own to-do list, where it keeps one: how far it says it is.
  todos?: { done: number; active: number; total: number }
  // How many steps finished agents of its type took before, for the estimate.
  expected?: number
  samples?: number
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

// One piece of the activity strip: a step, as wide as it took.
export type Segment = { kind: Kind; weight: number; state: StepState }

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
  strip: Segment[]
  // 0..1: how far the strip reaches; 1 once the agent has stopped.
  progress: number
  // The Craft Skin: blocky figure, pixel words, a card like an item's tooltip.
  isCraftSkin: boolean
}

// A step in the detail view: when it started and how long it took.
export type DetailRow = CardRow & { kind: Kind; at: string; took: string }

export type Phase = {
  id: string
  kind: Kind
  label: string
  summary: string
  errors: string
  took: string
  isOpen: boolean
  // The person opened it themselves: it is folded for room only as a last resort.
  isPinned: boolean
  rows: DetailRow[]
}

// A block of text, cut to a few lines until it is opened.
export type Fold = { id: string; lines: string[]; isOpen: boolean; more: string }

export type Tab = { id: string; name: string; color: string; state: AgentState }

export type DetailProps = {
  id: string
  name: string
  color: string
  state: AgentState
  status: string
  meta: string
  held: Held | null
  phase: number
  columns: number
  hasPictures: boolean
  isCraftSkin: boolean
  startedAt: number
  tabs: Tab[]
  strip: Segment[]
  progress: number
  // How the progress was found, e.g. "3 von 5 Aufgaben" or "geschätzt".
  basis: string
  legend: { kind: Kind; label: string; count: number }[]
  // `earlier` holds {n} for the number of steps left out.
  words: { back: string; task: string; flow: string; result: string; waiting: string; noSteps: string; earlier: string }
  task: Fold
  phases: Phase[]
  result: Fold | null
}

export type CardMessage =
  | { kind: 'step'; id: string }
  | { kind: 'agent'; id: string }
  | { kind: 'back' }
  | { kind: 'toggle'; id: string }
  | { kind: 'phase'; id: string; open: boolean }

declare module 'claude-code' {
  interface PluginState {
    // Chosen in the XP bar's options; read here, written only there.
    'xp-bar': {
      craftSkin: boolean
    }
    'agent-buddies': {
      agents: Shaped<Agent[]>
      open: string[]
      expanded: string[]
      // Phases the person opened (+id) or closed (-id) themselves.
      phases: string[]
      // The agent whose detail view is shown; '' for the list.
      focus: string
      language: Lang
    }
  }
}
