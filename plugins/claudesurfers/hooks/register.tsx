import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { BoardMessage, BoardProps, Lang, Profile } from '../types'
import { languageOf, wordsFor } from './i18n'
import { EMPTY, SKINS, buy, isUnlocked, select, shape } from './skins'

const PANE = 'claudesurfers'
const BOARD = 'board'
// Where the profile is kept across sessions.
const PROFILE = 'profile'

const profile = atom({ plugin: 'claudesurfers', key: 'profile' } as const, EMPTY)
const language = atom({ plugin: 'claudesurfers', key: 'language' } as const, 'en')
const ask = atom({ plugin: 'claudesurfers', key: 'ask' } as const, null)

// The run being played, as the board last told it: what a pane closed
// mid-run still counts.
let live: { score: number; tokens: number } | null = null

async function save($: EngineInterface, change: (p: Profile) => Profile) {
  const after = await update($, profile, change)
  await $.store.set(PROFILE, after)
  return after
}

// A finished run: its score and tokens banked, and any buddy it earned said out loud.
async function bankRun($: EngineInterface, score: number, tokens: number) {
  const before = await read($, profile)
  const after = await save($, p => ({ ...p, best: Math.max(p.best, score), bank: p.bank + tokens, runs: p.runs + 1 }))
  const words = wordsFor(await read($, language))
  for (const skin of SKINS) {
    if (!isUnlocked(skin, before) && isUnlocked(skin, after)) $.ui.toast(words.unlocked(skin.name))
  }
  return after
}

// The system's language: a locale variable when one is set, else the first of
// macOS's preferred languages, else the runtime's own locale.
async function systemLanguage($: EngineInterface): Promise<Lang> {
  const unset = () => undefined
  const variable = (await $.env.get('LC_ALL').catch(unset)) ?? (await $.env.get('LC_MESSAGES').catch(unset)) ?? (await $.env.get('LANG').catch(unset))
  if (variable && !/^(C|POSIX)([._]|$)/.test(variable)) return languageOf(variable)
  const mac = await $.process.run(['defaults', 'read', '-g', 'AppleLanguages'], { timeoutMs: 3000 }).catch(unset)
  const preferred = mac?.exitCode === 0 ? /\(\s*"?([A-Za-z_-]+)/.exec(mac.stdout)?.[1] : undefined
  return languageOf(preferred ?? Intl.DateTimeFormat().resolvedOptions().locale)
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)

    const chosen = options.language
    const lang: Lang = chosen === 'de' || chosen === 'en' ? chosen : await systemLanguage($)
    await update($, language, () => lang)

    const stored = shape(await $.store.get(PROFILE))
    await update($, profile, () => stored)

    const words = wordsFor(lang)
    await $.command.register({ name: 'surf', description: words.description, argumentHint: words.argumentHint, immediate: true })
    return result
  })

  on('command.run', { command: 'surf' }, async ($, e) => {
    if (/^(buddies|buddy|skins?)\b/i.test(e.args.trim())) {
      const now = await $.clock.now()
      await update($, ask, () => ({ screen: 'garage', nonce: now }) as const)
    }
    await $.ui.open({ id: PANE, title: 'ClaudeSurfers', focus: true })
    return { text: wordsFor(await read($, language)).opened }
  })

  on('ui.message', async ($, e, next) => {
    if (e.requestId !== PANE || e.element !== BOARD) return next(e)
    const message = e.data as BoardMessage
    switch (message.kind) {
      case 'started':
        live = { score: 0, tokens: 0 }
        break
      case 'progress':
        live = { score: message.score, tokens: message.tokens }
        break
      case 'over':
        live = null
        await bankRun($, message.score, message.tokens)
        break
      case 'quit': {
        live = null
        await bankRun($, message.score, message.tokens)
        $.ui.toast(wordsFor(await read($, language)).quitToast(message.score, message.tokens))
        break
      }
      case 'buy':
        await save($, p => buy(p, message.id))
        break
      case 'select':
        await save($, p => select(p, message.id))
        break
      case 'close':
        await $.ui.close({ id: PANE })
        break
    }
    return {}
  })

  // A pane closed in the middle of a run still banks what was collected.
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && live) {
      const { score, tokens } = live
      live = null
      await bankRun($, score, tokens)
      $.ui.toast(wordsFor(await read($, language)).quitToast(score, tokens))
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Text } = elements
    const lang = await read($, language)
    if (!('Client' in elements)) return <Text>{wordsFor(lang).unsupported}</Text>
    const { Client } = elements
    const bodyRows = e.props.scroll?.bodyRows ?? 0
    const props: BoardProps = {
      lang,
      surface: e.surface,
      profile: await read($, profile),
      bodyRows,
      ask: await read($, ask),
    }
    // No height here: the desktop fixes a region's height when it first draws
    // it, when the pane does not know its rows yet. The board draws as tall as
    // the rows it is told, and the region follows what it draws.
    return <Client key={BOARD} module="./board.tsx" props={props} width="100%" />
  })
}
