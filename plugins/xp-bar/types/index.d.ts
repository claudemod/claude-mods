export type XpLimit = { kind: string; percentUsed: number; resetsAt?: string }

// What has been used in all since the mod began counting: limits' worth of
// each window (1.5 is one and a half full limits) and the tokens of every chat.
export type XpTotals = { since: number; sessionLimits: number; weekLimits: number; tokens: number }

declare module 'claude-code' {
  interface PluginState {
    'xp-bar': {
      limits: XpLimit[]
      tokensPerPercent: Record<string, number>
      now: number
      sessionTokens: number
      language: 'de' | 'en'
      totals: XpTotals | null
      processKey: string
    }
  }
}
