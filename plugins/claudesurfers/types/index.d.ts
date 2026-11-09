// The mod's state and what the board and the hooks module tell each other.
// The run itself lives in the board, where the person plays.
export type Lang = 'de' | 'en'

// What outlives a run, kept across sessions.
export type Profile = {
  best: number
  // Tokens collected and not yet spent.
  bank: number
  // Buddies bought; the free one and the earned ones need no entry.
  owned: string[]
  selected: string
  runs: number
}

// What the hooks module hands the board.
export type BoardProps = {
  lang: Lang
  surface: string
  profile: Profile
  // Rows the pane shows, 0 where it is not known.
  bodyRows: number
  // `/surf buddies` asks for the buddy screen; the nonce tells a new ask apart.
  ask: { screen: 'garage'; nonce: number } | null
}

// What the board posts to the hooks module.
export type BoardMessage =
  | { kind: 'started' }
  | { kind: 'progress'; score: number; tokens: number }
  | { kind: 'over'; score: number; tokens: number }
  | { kind: 'quit'; score: number; tokens: number }
  | { kind: 'buy'; id: string }
  | { kind: 'select'; id: string }
  | { kind: 'close' }

declare module 'claude-code' {
  interface PluginState {
    'claudesurfers': {
      profile: Profile
      language: Lang
      ask: { screen: 'garage'; nonce: number } | null
    }
  }
}
