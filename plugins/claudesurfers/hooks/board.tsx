// The game, drawn where the person plays: it holds the run itself, so a key
// answers at once, and tells the hooks module only what outlives it.
//
// On a surface with pictures, each frame is one picture of the stream, with
// the buttons placed over it in cells, where the pointer finds them. The
// terminal gets the same run in its own letters.
import type { ClientKeyEvent, ClientModule, ClientPointerEvent, RenderElement } from 'claude-code'

import type { BoardMessage, BoardProps, Profile } from '../types'
import { PICTURE_W, buttonSvg, cardSvg, hud, labelSvg, overOverlay, panelSvg, pauseOverlay, sceneSvg, skyColor, titleOverlay, viewFor } from './art'
import type { ButtonLook } from './art'
import { botStep } from './bot'
import { act, isObstacle, newRun, step } from './game'
import type { Action, Run, Thing } from './game'
import { wordsFor } from './i18n'
import { SKINS, isUnlocked, nextGoal, skinOf } from './skins'
import type { Skin } from './skins'

type Screen = 'menu' | 'play' | 'pause' | 'over' | 'garage'

type Summary = { score: number; tokens: number; bestBefore: number; profileBank: number }

type Local = {
  screen: Screen
  run: Run
  attract: Run
  t: number
  hover: { x: number; y: number } | null
  pressed: string | null
  swipe: { x: number; y: number; isDone: boolean } | null
  summary: Summary | null
  note: string | null
  askNonce: number
}

type Hotspot = { key: string; x: number; y: number; w: number; h: number; act: () => void }

const FRAME_MS = 40
// The menu's background needs fewer frames than a run.
const ATTRACT_EVERY = 2
const PROGRESS_MS = 1000
const MAX_STEP_MS = 120
const CELL_PX = 7
const ROW_PX = 19
const HINT_MS = 5000
const SWIPE_COLUMNS = 3
const SWIPE_ROWS = 2
// Right after a crash nothing restarts: the keys and clicks of the run are still coming.
const OVER_LOCK_FRAMES = 15

const seed = () => Math.floor(Math.random() * 2 ** 31)

// Latest props and drawn buttons, for the listeners set up on the first call.
let current: BoardProps = { lang: 'en', surface: 'desktop', profile: { best: 0, bank: 0, owned: [], selected: 'claude', runs: 0 }, bodyRows: 0, ask: null }
let hotspots: Hotspot[] = []
let lastFrame = Date.now()
let lastProgress = 0
let frameCount = 0
let overFrame = -OVER_LOCK_FRAMES

const KEYS: Record<string, Action> = { left: 'left', a: 'left', right: 'right', d: 'right', up: 'jump', w: 'jump', ' ': 'jump', space: 'jump', down: 'duck', s: 'duck' }

const Board: ClientModule<BoardProps, Local> = (props, surface) => {
  current = props
  const { Box, Text, Button } = surface.elements
  const words = wordsFor(props.lang)
  const hasPictures = props.surface !== 'terminal'

  const fresh = (): Local => ({ screen: 'menu', run: newRun(1), attract: newRun(seed()), t: 0, hover: null, pressed: null, swipe: null, summary: null, note: null, askNonce: 0 })
  const state = (): Local => surface.state ?? fresh()
  const post = (message: BoardMessage) => surface.post(message)

  const startRun = () => {
    lastProgress = 0
    surface.setState({ ...state(), screen: 'play', run: newRun(seed()), pressed: null, swipe: null, summary: null, note: null })
    post({ kind: 'started' })
  }

  const score = (run: Run) => Math.floor(run.score)

  const isOverLocked = () => frameCount - overFrame < OVER_LOCK_FRAMES

  const finish = (run: Run) => {
    const local = state()
    overFrame = frameCount
    surface.setState({
      ...local,
      screen: 'over',
      run,
      pressed: null,
      swipe: null,
      summary: { score: score(run), tokens: run.tokens, bestBefore: current.profile.best, profileBank: current.profile.bank },
    })
    post({ kind: 'over', score: score(run), tokens: run.tokens })
  }

  const quit = () => {
    const local = state()
    post({ kind: 'quit', score: score(local.run), tokens: local.run.tokens })
    surface.setState({ ...local, screen: 'menu', pressed: null, swipe: null })
  }

  const steer = (action: Action) => {
    const local = state()
    if (local.screen === 'play') surface.setState({ ...local, run: act(local.run, action) })
  }

  const togglePause = () => {
    const local = state()
    if (local.screen === 'play') surface.setState({ ...local, screen: 'pause', pressed: null })
    else if (local.screen === 'pause') {
      lastFrame = Date.now()
      surface.setState({ ...local, screen: 'play', pressed: null })
    }
  }

  const tryCard = (skin: Skin) => {
    const local = state()
    const p = current.profile
    if (isUnlocked(skin, p)) {
      post({ kind: 'select', id: skin.id })
      surface.setState({ ...local, note: null })
      return
    }
    const u = skin.unlock
    if ('cost' in u) {
      if (p.bank >= u.cost) {
        post({ kind: 'buy', id: skin.id })
        surface.setState({ ...local, note: null })
      } else surface.setState({ ...local, note: words.tooPoor(u.cost - p.bank) })
    } else if ('best' in u) surface.setState({ ...local, note: words.earnBest(skin.name, u.best) })
    else if ('runs' in u) surface.setState({ ...local, note: words.earnRuns(skin.name, u.runs) })
    else surface.setState({ ...local, note: words.earnAll(skin.name) })
  }

  function onKey(event: ClientKeyEvent) {
    const local = state()
    const key = event.key.toLowerCase()
    if (local.screen === 'play') {
      if (key === 'p') return togglePause()
      const action = KEYS[key]
      if (action) steer(action)
      return
    }
    if (local.screen === 'pause') {
      if (key === 'p' || key === 'return' || key === 'enter' || key === ' ') togglePause()
      return
    }
    if (local.screen === 'menu' && (key === 'return' || key === 'enter' || key === ' ' || key === 'space')) startRun()
    // After a crash only Enter goes again: the space bar is the jump key.
    if (local.screen === 'over' && (key === 'return' || key === 'enter') && !isOverLocked()) startRun()
  }

  function onPointer(event: ClientPointerEvent) {
    const local = state()
    const hover = event.type === 'leave' ? null : { x: event.x, y: event.y }
    const hot = hover ? hotspots.find(h => hover.x >= h.x && hover.x < h.x + h.w && hover.y >= h.y && hover.y < h.y + h.h) : undefined

    if (event.type === 'down' && hot && event.button === 'left') {
      if (local.screen === 'over' && isOverLocked()) return
      return surface.setState({ ...local, hover, pressed: hot.key })
    }
    if (event.type === 'up' && local.pressed) {
      surface.setState({ ...local, hover, pressed: null })
      if (hot && hot.key === local.pressed) hot.act()
      return
    }

    if (local.screen === 'play') {
      if (event.type === 'down') return surface.setState({ ...local, swipe: { x: event.x, y: event.y, isDone: false } })
      if (!local.swipe) return
      const dx = event.x - local.swipe.x
      const dy = event.y - local.swipe.y
      if (event.type === 'move' && !local.swipe.isDone) {
        const action: Action | null = Math.abs(dx) >= SWIPE_COLUMNS ? (dx < 0 ? 'left' : 'right') : Math.abs(dy) >= SWIPE_ROWS ? (dy < 0 ? 'jump' : 'duck') : null
        if (action) surface.setState({ ...local, run: act(local.run, action), swipe: { ...local.swipe, isDone: true } })
        return
      }
      if (event.type === 'up') {
        // A tap where it landed: the sides steer, the middle jumps or ducks.
        const across = surface.columns > 0 ? event.x / surface.columns : 0.5
        const down = surface.rows > 0 ? event.y / surface.rows : 0.5
        const action: Action = across < 0.33 ? 'left' : across > 0.67 ? 'right' : down < 0.55 ? 'jump' : 'duck'
        surface.setState({ ...local, swipe: null, run: local.swipe.isDone ? local.run : act(local.run, action) })
      }
      return
    }

    // Past here only the hovered button matters.
    const before = local.hover ? hotspots.find(h => local.hover!.x >= h.x && local.hover!.x < h.x + h.w && local.hover!.y >= h.y && local.hover!.y < h.y + h.h) : undefined
    if (before?.key !== hot?.key) surface.setState({ ...local, hover })
  }

  if (surface.state === undefined) {
    surface.setState(state())
    surface.every(FRAME_MS, () => {
      const now = Date.now()
      const dt = Math.min(MAX_STEP_MS, Math.max(FRAME_MS, now - lastFrame))
      lastFrame = now
      frameCount += 1
      const local = state()

      if (local.screen === 'play') {
        const run = step(local.run, dt)
        if (run.phase === 'over') return finish(run)
        lastProgress += dt
        if (lastProgress >= PROGRESS_MS) {
          lastProgress = 0
          post({ kind: 'progress', score: score(run), tokens: run.tokens })
        }
        surface.setState({ ...local, run, t: local.t + dt })
        return
      }
      if (local.screen === 'menu' && frameCount % ATTRACT_EVERY === 0) {
        const played = step(botStep(local.attract), dt * ATTRACT_EVERY)
        surface.setState({ ...local, attract: played.phase === 'over' ? newRun(seed()) : played, t: local.t + dt * ATTRACT_EVERY })
      }
    })
    surface.onPointer(onPointer)
    surface.onKey(onKey)
  }

  if (props.ask && props.ask.nonce !== state().askNonce) {
    surface.setState({ ...state(), screen: 'garage', askNonce: props.ask.nonce, note: null, pressed: null })
  }

  // ---- drawing ----

  const local = state()
  const p = props.profile
  const drawn: Hotspot[] = []

  if (!hasPictures) {
    return drawText({ local, props, surface, words, startRun, quit, togglePause, tryCard, post, Box, Text, Button })
  }

  // The whole pane: the world widens or grows to fit it.
  // The pane's own rows. The region's are no help: it is as tall as what is
  // drawn here, and a pane that has not measured itself yet says 1.
  const knownRows = props.bodyRows > 1 ? props.bodyRows : 0
  const view = viewFor(surface.columns, knownRows)
  const stageCols = view.columns
  const rows = view.rows

  const picture = (source: string, alt: string, w: number, tall: number): RenderElement => {
    const Svg = (surface.elements as unknown as Record<string, ((p: object) => RenderElement) | undefined>).Svg
    const pictureProps = { source, alt, width: w, height: tall }
    return Svg ? Svg(pictureProps) : ({ type: 'Svg', props: pictureProps } as unknown as RenderElement)
  }

  const isOver = (x: number, y: number, w: number, tall: number) => !!local.hover && local.hover.x >= x && local.hover.x < x + w && local.hover.y >= y && local.hover.y < y + tall

  const button = (key: string, label: string, x: number, y: number, w: number, look: ButtonLook, action: () => void, tall = 2) => {
    drawn.push({ key, x, y, w, h: tall, act: action })
    const px = w * CELL_PX
    const pxTall = tall * ROW_PX
    return (
      <Box position="absolute" left={x} top={y} width={w} height={tall} alignItems="center" justifyContent="center">
        {picture(buttonSvg(label, px, pxTall, look, isOver(x, y, w, tall), local.pressed === key), label, px, pxTall)}
      </Box>
    )
  }

  const stage = (source: string, alt: string, overlays: (RenderElement | null)[], background: string) => {
    hotspots = drawn
    return (
      <Box width={stageCols} height={rows} backgroundColor={background} overflow="hidden" flexDirection="column" justifyContent="flex-end">
        {picture(source, alt, PICTURE_W, view.markupH)}
        {overlays}
      </Box>
    )
  }

  const row3 = (y: number, entries: [string, string, ButtonLook, () => void][]) => {
    const gap = 1
    const w = Math.min(22, Math.floor((stageCols - 2 - gap * (entries.length - 1)) / entries.length))
    const start = Math.floor((stageCols - (entries.length * w + gap * (entries.length - 1))) / 2)
    return entries.map(([key, label, look, action], i) => button(key, label, start + i * (w + gap), y, w, look, action))
  }

  const buttonsY = Math.max(0, rows - 3)
  const skin = skinOf(p.selected)

  if (local.screen === 'garage') {
    const COLUMNS = 3
    const LINES = Math.ceil(SKINS.length / COLUMNS)
    const top = 3
    const cardW = Math.min(30, Math.floor((stageCols - 2) / COLUMNS))
    const gridLeft = Math.floor((stageCols - cardW * COLUMNS) / 2)
    const cardRows = Math.max(4, Math.min(9, Math.floor((buttonsY - top) / LINES)))
    const cardPx = cardW * CELL_PX
    const cardPxTall = cardRows * ROW_PX
    const parts: (RenderElement | null)[] = []
    const title = labelSvg(words.buddies, 3, '#FFF8EE')
    const bank = labelSvg(local.note ?? words.bank(p.bank), 2, local.note ? '#FFE2B0' : '#FFF8EE')
    parts.push(
      <Box position="absolute" left={1} top={0} width={stageCols - 2} height={2} alignItems="center" justifyContent="space-between">
        {picture(title.source, words.buddies, title.width, title.height)}
        {picture(bank.source, local.note ?? words.bank(p.bank), bank.width, bank.height)}
      </Box>,
    )
    SKINS.forEach((s, i) => {
      const x = gridLeft + (i % COLUMNS) * cardW
      const y = top + Math.floor(i / COLUMNS) * cardRows
      const isOwned = isUnlocked(s, p)
      const u = s.unlock
      const note = isOwned ? (p.selected === s.id ? words.chosen : words.owned) : 'cost' in u ? words.buy(u.cost) : 'best' in u ? words.needsBest(u.best) : 'runs' in u ? words.needsRuns(u.runs) : words.needsAll
      const canBuy = !isOwned && 'cost' in u && p.bank >= u.cost
      drawn.push({ key: `card-${s.id}`, x, y, w: cardW, h: cardRows, act: () => tryCard(s) })
      parts.push(
        <Box position="absolute" left={x} top={y} width={cardW} height={cardRows} alignItems="center" justifyContent="center">
          {picture(cardSvg({ skin: s, isOwned, isSelected: p.selected === s.id, canBuy, isHot: isOver(x, y, cardW, cardRows), note }, cardPx, cardPxTall), `${s.name}: ${note}`, cardPx, cardPxTall)}
        </Box>,
      )
    })
    parts.push(...row3(buttonsY, [['back', words.back, 'plain', () => surface.setState({ ...state(), screen: 'menu', note: null, pressed: null })]]))
    return stage(panelSvg(view), words.buddies, parts, '#F5F0E8')
  }

  if (local.screen === 'menu') {
    const source = sceneSvg({
      run: local.attract,
      skinId: p.selected,
      t: local.t,
      view,
      overlay: titleOverlay(words.bestShort(p.best), String(p.bank), view),
    })
    return stage(
      source,
      'ClaudeSurfers',
      row3(buttonsY, [
        ['buddies', words.buddies, 'plain', () => surface.setState({ ...state(), screen: 'garage', note: null, pressed: null })],
        ['start', words.start, 'primary', startRun],
        ['close', words.close, 'plain', () => post({ kind: 'close' })],
      ]),
      skyColor(local.attract.dist),
    )
  }

  if (local.screen === 'over' && local.summary) {
    const summary = local.summary
    const isNew = summary.score > summary.bestBefore
    const goal = nextGoal(p)
    const overlay = overOverlay({
      title: words.crashed,
      reason: local.run.crash && isObstacle(local.run.crash) ? words.crash[local.run.crash as 'low' | 'high' | 'wall'] : '',
      score: String(summary.score),
      tokens: words.tokens(summary.tokens),
      best: isNew ? words.newBest : words.bestShort(Math.max(p.best, summary.bestBefore)),
      bestIsNew: isNew,
      goal: goal ? (p.bank >= goal.cost ? words.goalReady(goal.skin.name) : words.goal(goal.skin.name, goal.cost - p.bank)) : null,
      goalPart: goal ? p.bank / goal.cost : 0,
      goalSkinId: goal ? goal.skin.id : null,
    }, view)
    return stage(
      sceneSvg({ run: local.run, skinId: p.selected, t: local.t, view, overlay }),
      `${words.crashed} ${summary.score}`,
      row3(buttonsY, [
        ['menu', words.menu, 'plain', () => surface.setState({ ...state(), screen: 'menu', pressed: null })],
        ['again', words.again, 'primary', startRun],
        ['buddies', words.buddies, 'plain', () => surface.setState({ ...state(), screen: 'garage', note: null, pressed: null })],
      ]),
      skyColor(local.run.dist, 0.38),
    )
  }

  if (local.screen === 'pause') {
    return stage(
      sceneSvg({ run: local.run, skinId: p.selected, t: local.t, view, overlay: hud(local.run, null, view) + pauseOverlay(words.pause, view) }),
      words.pause,
      row3(buttonsY, [
        ['quit', words.quit, 'plain', quit],
        ['resume', words.resume, 'primary', togglePause],
      ]),
      skyColor(local.run.dist, 0.55),
    )
  }

  // The run. The pause button sits between the score and the tokens.
  const pauseW = 6
  return stage(
    sceneSvg({ run: local.run, skinId: skin.id, t: local.t, view, overlay: hud(local.run, local.run.t < HINT_MS ? words.hint : null, view) }),
    `${score(local.run)}`,
    [button('pause', 'II', Math.floor((stageCols - pauseW) / 2), 0, pauseW, 'dark', togglePause)],
    skyColor(local.run.dist),
  )
}

// ---- the terminal's version ----

type TextArgs = {
  local: Local
  props: BoardProps
  surface: Parameters<ClientModule<BoardProps, Local>>[1]
  words: ReturnType<typeof wordsFor>
  startRun: () => void
  quit: () => void
  togglePause: () => void
  tryCard: (skin: Skin) => void
  post: (message: BoardMessage) => void
  Box: Parameters<ClientModule<BoardProps, Local>>[1]['elements']['Box']
  Text: Parameters<ClientModule<BoardProps, Local>>[1]['elements']['Text']
  Button: Parameters<ClientModule<BoardProps, Local>>[1]['elements']['Button']
}

const TEXT_ROWS = 12
const TEXT_ROW_Z = 6

function textCell(thing: Thing | undefined) {
  if (!thing) return { text: '     ', color: undefined }
  switch (thing.kind) {
    case 'wall':
      return { text: '█████', color: '#C2453C' }
    case 'low':
      return { text: '▄▄▄▄▄', color: '#D97757' }
    case 'high':
      return { text: '▀▀▀▀▀', color: '#8FBCE0' }
    case 'token':
      return { text: '  ◆  ', color: '#E3B341' }
    default:
      return { text: '  ★  ', color: '#7EC98F' }
  }
}

function drawText({ local, props, surface, words, startRun, quit, togglePause, tryCard, post, Box, Text, Button }: TextArgs): RenderElement {
  const p: Profile = props.profile
  const toMenu = () => surface.setState({ ...local, screen: 'menu', note: null })

  if (local.screen === 'garage') {
    return (
      <Box flexDirection="column">
        <Text bold>
          {words.buddies} · {words.bank(p.bank)}
        </Text>
        {SKINS.map(s => {
          const isOwned = isUnlocked(s, p)
          const u = s.unlock
          const note = isOwned ? (p.selected === s.id ? words.chosen : words.owned) : 'cost' in u ? words.buy(u.cost) : 'best' in u ? words.needsBest(u.best) : 'runs' in u ? words.needsRuns(u.runs) : words.needsAll
          return (
            <Button key={s.id} onPress={() => tryCard(s)}>
              {`${s.name} · ${note}`}
            </Button>
          )
        })}
        {local.note ? <Text color="#D97757">{local.note}</Text> : null}
        <Button key="back" onPress={toMenu}>
          {words.back}
        </Button>
      </Box>
    )
  }

  if (local.screen === 'menu') {
    return (
      <Box flexDirection="column">
        <Text bold color="#D97757">
          CLAUDE SURFERS
        </Text>
        <Text>
          {words.bestShort(p.best)} · {words.bank(p.bank)}
        </Text>
        <Text dimColor>{words.terminalHint}</Text>
        <Box gap={1}>
          <Button key="start" onPress={startRun}>
            {words.start}
          </Button>
          <Button key="buddies" onPress={() => surface.setState({ ...local, screen: 'garage', note: null })}>
            {words.buddies}
          </Button>
          <Button key="close" onPress={() => post({ kind: 'close' })}>
            {words.close}
          </Button>
        </Box>
      </Box>
    )
  }

  const run = local.run
  const lines: RenderElement[] = []
  for (let row = 0; row < TEXT_ROWS; row++) {
    const near = (TEXT_ROWS - 1 - row) * TEXT_ROW_Z
    const cells = [-1, 0, 1].map(lane => textCell(run.things.find(t => t.lane === lane && t.z - run.dist >= near && t.z - run.dist < near + TEXT_ROW_Z)))
    lines.push(
      <Text key={`row-${row}`}>
        {'│'}
        {cells.map((cell, i) => (
          <Text key={`cell-${i}`} color={cell.color}>
            {row === TEXT_ROWS - 1 && Math.round(run.x) === i - 1 ? (run.duck > 0 ? ' ▂▂▂ ' : run.air > 0 ? ' ^o^ ' : ' [o] ') : cell.text}
          </Text>
        ))}
        {'│'}
      </Text>,
    )
  }

  return (
    <Box flexDirection="column">
      <Text>
        {Math.floor(run.score)} · {words.tokens(run.tokens)}
      </Text>
      {lines}
      {local.screen === 'over' ? (
        <Box flexDirection="column">
          <Text bold color="#D97757">
            {words.crashed} {run.crash && isObstacle(run.crash) ? words.crash[run.crash as 'low' | 'high' | 'wall'] : ''}
          </Text>
          <Box gap={1}>
            <Button key="again" onPress={startRun}>
              {words.again}
            </Button>
            <Button key="menu" onPress={toMenu}>
              {words.menu}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box gap={1}>
          <Button key="pause" onPress={togglePause}>
            {local.screen === 'pause' ? words.resume : words.pause}
          </Button>
          <Button key="quit" onPress={quit}>
            {words.quit}
          </Button>
        </Box>
      )}
    </Box>
  )
}

export default Board
