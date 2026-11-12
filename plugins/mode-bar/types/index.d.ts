export type Lang = 'de' | 'en'
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

// One mode, read from a file in `modes/`: its words in both languages, its
// colour, the model and effort it asks for (absent: the session's), the tools
// it blocks and the note the model gets with each message (empty: none).
export type Mode = {
  id: string
  label: { en: string; de: string }
  hint: { en: string; de: string }
  color: string
  // The glyph its button shows above the chat (an emoji).
  icon: string
  model?: string
  effort?: Effort
  block: string[]
  text: string
}

// The task the traffic light measures: everything since a prompt started a
// turn, subagents included. `weighted` counts tokens as they are priced.
export type Task = {
  startedAt: number
  endedAt?: number
  steps: number
  tools: number
  fresh: number
  cacheRead: number
  output: number
  weighted: number
  limitStart?: number
  limitNow?: number
}

// What the band hands the desktop's pill field: each mode's name, colour and
// what it does, in the person's language, and which one is active.
export type PillsProps = {
  pills: { id: string; label: string; color: string; hint: string }[]
  active: string
  // The columns the field was given, which the band works out from its own width.
  columns: number
  // The traffic light: its picture, its words, its number, whether the task runs.
  light: { source: string; alt: string; amount: string; isRunning: boolean; lines: string[] }
}

// What the hotbar is drawn from, with the Craft Skin on.
export type HotbarProps = {
  pills: { id: string; label: string; hint: string }[]
  active: string
  // The slot apart: the colour of the task's cost, its number and its figures.
  lamp: { color: string; alt: string; amount: string; isRunning: boolean; lines: string[] }
  // Game pixels to screen pixels: 2 where the band has room, less in a narrow window.
  scale: number
}

declare module 'claude-code' {
  interface PluginState {
    // Chosen in the XP bar's options; read here, written only there.
    'xp-bar': {
      craftSkin: boolean
    }
    'mode-bar': {
      mode: string
      modes: Mode[]
      task: Task | null
      language: Lang
    }
  }
}
