export type XpLimit = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    'xp-bar': {
      limits: XpLimit[]
      tokensPerPercent: Record<string, number>
      now: number
      sessionTokens: number
      language: 'de' | 'en'
    }
  }
}
