// The mod's state and what the board and the hooks module tell each other.
// The round itself lives in the board, where the person plays.
export type Mode = 'small' | 'table'

export type Records = { small: number; table: number }

// A round `/craft 2x2`, `/craft 3x3` or `/craft demo` asked for; the nonce
// tells a new ask apart. A demo may name its own language.
export type StartRequest = { mode: Mode; nonce: number; isDemo?: boolean; lang?: 'de' | 'en' }

// What the hooks module hands the board.
export type BoardProps = {
  lang: 'de' | 'en'
  best: Records
  start: StartRequest | null
  surface: string
  showBook: boolean
}

// What the board posts to the hooks module.
export type BoardMessage =
  | { kind: 'started'; mode: Mode; isDemo?: boolean }
  | { kind: 'score'; mode: Mode; score: number; crafts: number }
  | { kind: 'over'; mode: Mode; score: number; crafts: number }
  | { kind: 'quit'; mode: Mode; score: number; crafts: number }
  | { kind: 'book' }
  | { kind: 'close' }

declare module 'claude-code' {
  interface PluginState {
    'craft-rush': {
      records: Records
      language: 'de' | 'en'
      start: StartRequest | null
      showBook: boolean
      // The mode the recipe book shows: the one last started.
      bookMode: Mode
    }
  }
}
