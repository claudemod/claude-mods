// The board, drawn where the person plays: it holds the round itself, so a
// click answers at once, and tells the hooks module only what outlives it
// (a finished round's score, a quit).
//
// On a surface with pictures everything is pixel art on a stone panel: the
// words in the pixel font, the buttons drawn and pressed through the pointer.
// The terminal gets the same board in its own letters and buttons.
import type { ClientModule, ClientPointerEvent, RenderElement } from 'claude-code'

import type { BoardMessage, BoardProps } from '../types'
import {
  HOTBAR_START,
  IDLE,
  ROUND_MS,
  RECIPES,
  click,
  craftAll,
  deliver,
  finish,
  gather,
  matchRecipe,
  newBoard,
  quickMove,
  spread,
  takeResult,
} from './game'
import type { Board, Mode, Slot } from './game'
import { DEMO_TICK_MS, advanceDemo, startDemo } from './bot'
import type { DemoRun } from './bot'
import { itemName, wordsFor } from './i18n'
import type { Lang } from './i18n'
import { CRAFT_TOP, LEFT, SLOT_H, boardWidth, innerWidth, layout, sameSpot, scalePoint, slotWidthFor, spotAt } from './layout'
import type { Spot } from './layout'
import { labelSvg, textWidth, wrap } from './pixel'
import type { Ink } from './pixel'
import { UI, arrowSvg, chipSvg, heldSvg, pointerSvg, slotSvg, timerSvg, tintOf, tipSvg } from './sprites'
import type { SlotLook } from './sprites'

// The picture in a slot, for each width a slot may have.
const PICTURE_PX: Record<number, number> = { 5: 38, 4: 30, 3: 22 }
// Screen pixels to a font pixel, and the narrowest a cell is likely to be,
// so a box sized for a picture holds it.
const FONT = 2
const CELL_PX = 7
// Past this many characters a drawing leaves things out: one drawing may
// carry 100,000.
const TREE_BUDGET = 90_000
const DOUBLE_CLICK_MS = 350

const INK: Ink = { color: UI.ink }
const GOLD: Ink = { color: UI.gold, hasShadow: true }
const GREEN: Ink = { color: '#2f6b12' }

type Local = {
  board: Board
  hover: { x: number; y: number } | null
  drag: { button: 'left' | 'right'; spots: Spot[] } | null
  lastPickup: (Spot & { at: number }) | null
  // The drawn button a press went down on.
  pressed: string | null
  startNonce: number
  shownSecond: number
  // The demo's bot and its round, while it plays, and the language it was
  // asked to speak, if any.
  demo: DemoRun | null
  demoLang: Lang | null
}

// A drawn button, where the pointer finds it.
type Hotspot = { key: string; x: number; y: number; w: number; h: number; act: () => void }

function slotOf(b: Board, spot: Spot): Slot {
  if (spot.area === 'inv') return b.inv[spot.index] ?? null
  if (spot.area === 'grid') return b.grid[spot.index] ?? null
  const r = matchRecipe(b.grid, b.mode)
  return r ? { item: r.output, count: r.count } : null
}

// The round's clock: the further of the frame clock's ticks and real time, so
// it runs with real time where the ticks lag and with the ticks where real
// time stands still or crawls (as under a test's clock).
const TICK_MS = 250
const clockBase = Date.now()
let ticks = 0
let virtual = clockBase

function tickClock() {
  ticks += 1
  virtual = Math.max(virtual, clockBase + ticks * TICK_MS, Date.now())
  return virtual
}

function clockNow() {
  return Math.max(virtual, Date.now())
}

// The latest props and drawn buttons, for the listeners set up on the first call.
let current: BoardProps = { lang: 'en', best: { small: 0, table: 0 }, start: null, surface: 'desktop', showBook: false }
let hotspots: Hotspot[] = []
// The slot width the board was last drawn with, for reading the pointer.
let drawnSlotW = 5

const round3 = (n: number) => Math.round(n * 1000) / 1000

const Board: ClientModule<BoardProps, Local> = (props, surface) => {
  current = props
  const { Box, Text, Button } = surface.elements
  // The board's language: the person's, or the one the demo was asked for.
  let lang: Lang = props.lang
  let words = wordsFor(lang)
  const hasPictures = props.surface !== 'terminal'
  const now = clockNow()

  const state = (): Local =>
    surface.state ?? { board: IDLE, hover: null, drag: null, lastPickup: null, pressed: null, startNonce: 0, shownSecond: -1, demo: null, demoLang: null }
  const post = (message: BoardMessage) => surface.post(message)

  const setBoard = (board: Board, extra: Partial<Local> = {}) => {
    const before = state().board
    surface.setState({ ...state(), ...extra, board })
    if (board.crafts !== before.crafts && board.phase === 'play') {
      post({ kind: 'score', mode: board.mode, score: board.score, crafts: board.crafts })
    }
  }

  const start = (mode: Mode, nonce = state().startNonce, isDemo = false, demoLang: Lang | null = null) => {
    const fresh = { drag: null, lastPickup: null, pressed: null, startNonce: nonce, shownSecond: -1 }
    if (isDemo) {
      const demo = startDemo()
      surface.setState({ ...state(), ...fresh, board: demo.board, demo, demoLang })
      post({ kind: 'started', mode: demo.board.mode, isDemo: true })
      return
    }
    const board = newBoard(mode, clockNow(), current.best[mode])
    surface.setState({ ...state(), ...fresh, board, demo: null, demoLang: null })
    post({ kind: 'started', mode })
  }

  // A round's end; the demo's keeps no record, its quit only closes.
  const end = (reason: 'time' | 'quit') => {
    const board = finish(state().board, reason)
    surface.setState({ ...state(), board, drag: null, demo: null })
    if (board.isDemo) {
      if (reason === 'quit') post({ kind: 'close' })
      return
    }
    post({ kind: reason === 'time' ? 'over' : 'quit', mode: board.mode, score: board.score, crafts: board.crafts })
  }

  if (surface.state === undefined) {
    surface.setState(state())
    surface.every(TICK_MS, () => {
      const at = tickClock()
      const local = state()
      const b = local.board
      if (b.phase !== 'play' || b.isDemo) return
      if (at >= b.endsAt) return end('time')
      const next = at >= b.nextDropAt ? deliver(b, at) : b
      const second = Math.ceil((b.endsAt - at) / 1000)
      if (next !== b || second !== local.shownSecond) surface.setState({ ...local, board: next, shownSecond: second })
    })
    // The demo plays on a clock of its own, a fixed step a frame.
    surface.every(DEMO_TICK_MS, () => {
      const local = state()
      if (!local.demo || local.board.phase !== 'play') return
      const demo = advanceDemo(local.demo, DEMO_TICK_MS)
      surface.setState({ ...local, demo, board: demo.board })
    })
    surface.onPointer((event: ClientPointerEvent) => onPointer(event))
  }

  // A round asked for by `/craft 2x2` or `/craft 3x3`.
  if (props.start && props.start.nonce !== state().startNonce) start(props.start.mode, props.start.nonce, props.start.isDemo, props.start.lang ?? null)

  function onPointer(event: ClientPointerEvent) {
    const local = state()
    const b = local.board
    const hover = event.type === 'leave' ? null : { x: event.x, y: event.y }
    const button = event.button === 'right' ? 'right' : event.button === 'left' ? 'left' : undefined
    const hot = hover ? hotspots.find(h => hover.x >= h.x && hover.x < h.x + h.w && hover.y >= h.y && hover.y < h.y + h.h) : undefined

    // The drawn buttons: pressed by a left click that goes down and up on them.
    if (event.type === 'down' && hot && button === 'left') return surface.setState({ ...local, hover, pressed: hot.key })
    if (event.type === 'up' && local.pressed) {
      surface.setState({ ...local, hover, pressed: null })
      if (hot && hot.key === local.pressed) hot.act()
      return
    }

    if (b.isDemo && b.phase === 'play') {
      if (event.type !== 'down' && event.type !== 'up') surface.setState({ ...local, hover })
      return
    }

    const spot = b.phase === 'play' ? spotAt(b.mode, event.x, event.y, drawnSlotW) : null
    if (event.type === 'move' || event.type === 'enter' || event.type === 'leave') {
      let drag = local.drag
      if (drag && spot && spot.area !== 'result' && !drag.spots.some(s => sameSpot(s, spot))) {
        drag = { ...drag, spots: [...drag.spots, spot] }
      }
      const moved = !local.hover || !hover || hover.x !== local.hover.x || hover.y !== local.hover.y
      if (moved || drag !== local.drag) surface.setState({ ...local, hover, drag })
      return
    }
    if (b.phase !== 'play') return

    if (event.type === 'down') {
      if (!spot || !button) return
      const at = clockNow()
      if (spot.area === 'result') {
        return setBoard(event.shift ? craftAll(b, at) : takeResult(b, at), { hover })
      }
      if (event.shift) return setBoard(quickMove(b, spot.area, spot.index), { hover })
      if (b.cursor) {
        const last = local.lastPickup
        if (button === 'left' && last && sameSpot(last, spot) && at - last.at < DOUBLE_CLICK_MS) {
          return setBoard(gather(b), { hover, lastPickup: null })
        }
        return surface.setState({ ...local, hover, drag: { button, spots: [spot] } })
      }
      const picked = click(b, spot.area, spot.index, button)
      return setBoard(picked, { hover, lastPickup: picked.cursor ? { ...spot, at } : null })
    }

    if (event.type === 'up') {
      const drag = local.drag
      if (!drag) return
      const board =
        drag.spots.length > 1
          ? spread(b, drag.spots, drag.button)
          : click(b, drag.spots[0]!.area, drag.spots[0]!.index, drag.button)
      return setBoard(board, { hover, drag: null, lastPickup: null })
    }
  }

  // ---- drawing ----

  const local = state()
  const b = local.board
  const drawn: Hotspot[] = []
  // The board's size for the room its region has: narrower slots in a narrow pane.
  const slotW = slotWidthFor(surface.columns)
  drawnSlotW = slotW
  const innerW = innerWidth(slotW)
  const boardW = boardWidth(slotW)
  const px = PICTURE_PX[slotW] ?? 38
  // The widest line of words the panel holds, in font pixels.
  const lineW = Math.floor((innerW * CELL_PX) / FONT) - 4
  const demo = b.isDemo && local.demo ? local.demo : null
  if (b.isDemo && local.demoLang) {
    lang = local.demoLang
    words = wordsFor(lang)
  }
  // Where the slots are pointed at from: the bot's pointer in the demo.
  const botPointer = demo ? scalePoint(demo.pointer, slotW) : null
  const pointer = botPointer ? { x: Math.floor(botPointer.x), y: Math.floor(botPointer.y) } : local.hover

  const picture = (source: string, alt: string, width: number, height = width): RenderElement => {
    const Svg = (surface.elements as unknown as Record<string, ((p: object) => RenderElement) | undefined>).Svg
    const props = { source, alt, width, height }
    return Svg ? Svg(props) : ({ type: 'Svg', props } as unknown as RenderElement)
  }

  const isHovered = (x: number, y: number, w: number, tall: number) =>
    !!local.hover && local.hover.x >= x && local.hover.x < x + w && local.hover.y >= y && local.hover.y < y + tall

  // A bevelled block: an outline, a dark edge right and below, a light one
  // left and above, and the face; `w` and `tall` in cells. (No parameter is
  // called `h`: JSX compiles to calls of it.)
  const bevel = (w: number, tall: number, face: string, light: string, dark: string, inner?: RenderElement) => (
    <Box width={w} height={tall} backgroundColor={UI.outline} alignItems="center" justifyContent="center">
      <Box width={round3(w - 0.3)} height={round3(tall - 0.12)} backgroundColor={dark} flexDirection="column">
        <Box
          width={round3(w - 0.55)}
          height={round3(tall - 0.24)}
          backgroundColor={light}
          flexDirection="column"
          alignItems="flex-end"
          justifyContent="flex-end"
        >
          <Box width={round3(w - 0.8)} height={round3(tall - 0.36)} backgroundColor={face} alignItems="center" justifyContent="center">
            {inner}
          </Box>
        </Box>
      </Box>
    </Box>
  )

  // A line of words at a place: pixel letters, or the terminal's own.
  const say = (text: string, x: number, y: number, w: number, ink: Ink, opts: { scale?: number; rows?: number; align?: 'left' | 'center' } = {}) => {
    const rows = opts.rows ?? 1
    if (!hasPictures) {
      return (
        <Box position="absolute" left={x} top={y} width={w} height={rows}>
          <Text color={ink.color === UI.ink ? undefined : ink.color} wrap="truncate">
            {text}
          </Text>
        </Box>
      )
    }
    const label = labelSvg([text], opts.scale ?? FONT, ink, opts.align)
    return (
      <Box
        position="absolute"
        left={x}
        top={y}
        width={w}
        height={rows}
        alignItems="center"
        justifyContent={opts.align === 'center' ? 'center' : 'flex-start'}
      >
        {picture(label.source, text, label.width, label.height)}
      </Box>
    )
  }

  // A dark inset display with gold words in it: the title, the score.
  const display = (text: string, x: number, y: number, w: number, tall: number, scale: number) => {
    if (!hasPictures) return say(text, x, y, w, GOLD, { rows: tall })
    const label = labelSvg([text], scale, GOLD, 'center')
    return (
      <Box position="absolute" left={x} top={y}>
        {bevel(w, tall, '#2a2722', UI.outline, '#5a564e', picture(label.source, text, label.width, label.height))}
      </Box>
    )
  }

  // A button: drawn, and pressed through the pointer; the terminal's own there.
  const button = (key: string, text: string, x: number, y: number, w: number, act: () => void) => {
    if (!hasPictures) {
      return (
        <Box position="absolute" left={x} top={y}>
          <Button key={key} onPress={act}>
            {text}
          </Button>
        </Box>
      )
    }
    drawn.push({ key, x, y, w, h: 2, act })
    const hot = isHovered(x, y, w, 2)
    const down = local.pressed === key
    const label = labelSvg([text], FONT, { color: hot ? '#fff8e8' : '#ffffff', hasShadow: true }, 'center')
    return (
      <Box position="absolute" left={x} top={y}>
        {bevel(
          w,
          2,
          hot ? UI.buttonHover : UI.button,
          down ? UI.buttonDark : hot ? UI.buttonHoverLight : UI.buttonLight,
          down ? UI.buttonLight : hot ? UI.buttonHoverDark : UI.buttonDark,
          picture(label.source, text, label.width, label.height),
        )}
      </Box>
    )
  }

  const panel = (height: number) =>
    hasPictures ? (
      <Box position="absolute" left={0} top={0}>
        {bevel(boardW, height, UI.panel, UI.panelLight, UI.panelDark)}
      </Box>
    ) : null

  const textCell = (slot: Slot, hovered: boolean) => (
    <Box width={slotW} height={SLOT_H} backgroundColor={hovered ? '#5a5a5a' : '#373737'} flexDirection="column">
      <Text color={slot ? tintOf(slot.item) : '#555555'}>{slot ? ' ██' : ' ··'}</Text>
      <Text color="#ffffff">{slot && slot.count > 1 ? String(slot.count).padStart(4) : ''}</Text>
    </Box>
  )

  // A slot that only shows an item (the menu's, the trophies).
  const showSlot = (item: string, count: number, x: number, y: number) => (
    <Box position="absolute" left={x} top={y} width={slotW} height={SLOT_H} alignItems="center" justifyContent="center">
      {hasPictures ? picture(slotSvg({ item, count }, px), itemName(lang, item), px) : textCell({ item, count }, false)}
    </Box>
  )

  const centered = (w: number) => LEFT + Math.floor((innerW - w) / 2)
  // Whether words fit `cells` columns; how wide a button for them is.
  const fitsIn = (text: string, cells: number, scale = FONT) => (textWidth(text) * scale) / CELL_PX + 1 <= cells
  const buttonW = (...texts: string[]) => Math.max(8, ...texts.map(text => Math.ceil((textWidth(text) * FONT) / CELL_PX) + 2))
  // The mode's name, or its short one where the long one does not fit.
  const modeName = (mode: Mode, cells: number) => {
    const full = mode === 'small' ? words.small : words.table
    return fitsIn(full, cells) ? full : mode === 'small' ? words.smallShort : words.tableShort
  }
  // Wide buttons, a little wider still in a narrow board.
  const wideW = slotW === 5 ? innerW - 6 : innerW - 2
  // The record the round plays against: the demo's own, never the person's.
  const shownBest = b.isDemo ? b.best : Math.max(b.best, props.best[b.mode])

  if (b.phase === 'menu') {
    let y = 1
    const parts: (RenderElement | null)[] = []
    parts.push(display('CRAFT RUSH', LEFT, y, innerW, 2, 3))
    y += 3
    const showcase = ['log', 'planks', 'stick', 'pickaxe_diamond', 'chestplate_gold', 'bookshelf', 'compass']
    showcase.forEach((item, i) => parts.push(showSlot(item, 1, centered(showcase.length * slotW) + i * slotW, y)))
    y += 3
    for (const line of wrap(words.intro, lineW)) parts.push(say(line, LEFT, y++, innerW, INK))
    y++
    for (const control of words.controlLines) {
      for (const line of wrap(control, lineW)) parts.push(say(line, LEFT, y++, innerW, INK))
    }
    y++
    const startLabel = (mode: Mode) => `${modeName(mode, wideW - 6)} · ${words.seconds(ROUND_MS[mode] / 1000)}`
    parts.push(button('start-small', startLabel('small'), centered(wideW), y, wideW, () => start('small')))
    y += 3
    parts.push(button('start-table', startLabel('table'), centered(wideW), y, wideW, () => start('table')))
    y += 3
    const closeW = buttonW(words.close)
    parts.push(button('close', words.close, centered(closeW), y, closeW, () => post({ kind: 'close' })))
    y += 3
    const record = `${words.best}: 2×2 ${props.best.small || words.noBest} · 3×3 ${props.best.table || words.noBest}`
    for (const line of wrap(record, lineW)) parts.push(say(line, LEFT, y++, innerW, INK, { align: 'center' }))
    const height = y + 1
    hotspots = drawn
    return (
      <Box width={boardW} height={height}>
        {panel(height)}
        {parts}
      </Box>
    )
  }

  if (b.phase === 'over') {
    const isNewBest = b.score > b.best
    let y = 1
    const parts: (RenderElement | null)[] = []
    parts.push(display(b.endReason === 'time' ? words.timeUp : words.ended, LEFT, y, innerW, 2, 3))
    y += 3
    parts.push(say(`★ ${words.points(b.score)}`, LEFT, y++, innerW, { color: '#8a5a06' }, { align: 'center' }))
    const craftsText = `${words.crafts(b.crafts)} · ${modeName(b.mode, innerW)}`
    parts.push(say(fitsIn(craftsText, innerW) ? craftsText : words.crafts(b.crafts), LEFT, y++, innerW, INK, { align: 'center' }))
    parts.push(
      isNewBest
        ? say(words.newBest, LEFT, y++, innerW, GREEN, { align: 'center' })
        : say(`${words.best}: ${shownBest}`, LEFT, y++, innerW, INK, { align: 'center' }),
    )
    y++
    const trophies = b.inv.filter((slot): slot is NonNullable<Slot> => !!slot && RECIPES.some(r => r.output === slot.item)).slice(0, 9)
    if (trophies.length > 0) {
      trophies.forEach((slot, i) => parts.push(showSlot(slot.item, slot.count, centered(trophies.length * slotW) + i * slotW, y)))
      y += 3
    }
    parts.push(button('again', words.again, centered(wideW), y, wideW, () => start(b.mode, state().startNonce, b.isDemo, local.demoLang)))
    y += 3
    parts.push(button('menu', words.otherMode, centered(wideW), y, wideW, () => surface.setState({ ...state(), board: IDLE, pressed: null })))
    y += 3
    const closeW = buttonW(words.close)
    parts.push(button('close', words.close, centered(closeW), y, closeW, () => post({ kind: 'close' })))
    const height = y + 3
    hotspots = drawn
    return (
      <Box width={boardW} height={height}>
        {panel(height)}
        {parts}
      </Box>
    )
  }

  const l = layout(b.mode, slotW)
  const leftMs = Math.max(0, b.endsAt - (demo ? demo.now : now))
  const hovered = pointer ? spotAt(b.mode, pointer.x, pointer.y, slotW) : null
  const hoveredSlot = hovered ? slotOf(b, hovered) : null

  const info =
    b.lastCraft && b.lastCraft.at >= (b.lastDrop?.at ?? 0)
      ? { text: words.crafted(b.lastCraft.points, b.lastCraft.count, itemName(lang, b.lastCraft.item)), ink: GREEN }
      : b.lastDrop
        ? {
            text: `${b.lastDrop.kit ? words.kitFor(itemName(lang, b.lastDrop.kit)) : words.delivery} ${b.lastDrop.items
              .map(s => `+${s.count} ${itemName(lang, s.item)}`)
              .join(', ')}`,
            ink: INK,
          }
        : { text: words.controlsShort, ink: INK }
  // Two lines at most; what does not fit ends in an ellipsis.
  const wrapped = wrap(info.text, lineW)
  const infoLines = wrapped.slice(0, 2)
  if (wrapped.length > 2) {
    const words2 = infoLines[1]!.split(' ')
    while (words2.length > 1 && textWidth(`${words2.join(' ')} …`) > lineW) words2.pop()
    infoLines[1] = `${words2.join(' ').replace(/,$/, '')} …`
  }

  const scoreText = `★ ${b.score}`
  const scoreW = Math.ceil(labelSvg([scoreText], FONT, GOLD).width / CELL_PX) + 2
  // The buttons below and the record, side by side where they fit, else
  // each on a row of its own.
  const bookW = buttonW(words.book, words.hideBook)
  const quitW = buttonW(words.quit)
  const quitAt = bookW + 1 + quitW <= innerW ? { x: LEFT + bookW + 1, y: l.buttonsY } : { x: LEFT, y: l.buttonsY + 2 }
  const recordText = `${words.best} ${shownBest}`
  const recordX = quitAt.x + quitW + 1
  const recordBeside = fitsIn(recordText, LEFT + innerW - recordX)
  const recordAt = recordBeside ? { x: recordX, y: quitAt.y } : { x: LEFT, y: quitAt.y + 2 }
  const boardH = recordBeside ? quitAt.y + 3 : recordAt.y + 2
  const cursor = b.cursor
  const tooltip = !demo && !cursor && hoveredSlot && local.hover ? itemName(lang, hoveredSlot.item) : null

  // The round's board, leaving out more the higher `thrift` is, so the tree
  // stays inside what one drawing may carry: 1 the items' shadows, 2 also the
  // pictures of empty slots (plain squares instead), 3 also every slot's frame
  // (the square drawn behind the item instead), 4 also the storage's items,
  // drawn as chips of their colour.
  const drawPlay = (thrift: number) => {
    drawn.length = 0

    const slotAt = (spot: Spot, left: number, top: number) => {
      const slot = slotOf(b, spot)
      const look: SlotLook = {
        item: slot?.item ?? null,
        count: slot?.count,
        isHovered: sameSpot(hovered, spot),
        isPressed: !!demo?.pressed && sameSpot(demo.pressed.spot, spot),
        isResult: spot.area === 'result',
      }
      const isPlain = thrift >= 2 && !slot && !look.isHovered && !look.isResult
      const isBare = thrift >= 3
      const isChip = thrift >= 4 && !!slot && spot.area === 'inv' && spot.index < HOTBAR_START && !look.isHovered
      const alt = slot ? itemName(lang, slot.item) : '·'
      return (
        <Box
          position="absolute"
          left={left}
          top={top}
          width={slotW}
          height={SLOT_H}
          alignItems="center"
          justifyContent="center"
          {...(isBare && hasPictures ? { backgroundColor: look.isHovered ? UI.slotHover : UI.slot } : {})}
        >
          {!hasPictures ? (
            textCell(slot, !!look.isHovered)
          ) : isPlain && !isBare ? (
            <Box width={slotW - 0.4} height={SLOT_H - 0.1} backgroundColor={UI.slot} />
          ) : isPlain ? null : isChip ? (
            picture(chipSvg(slot.item, slot.count, px), alt, px)
          ) : (
            picture(slotSvg({ ...look, lite: thrift >= 1, bare: isBare }, px), alt, px)
          )}
        </Box>
      )
    }

    const slots: RenderElement[] = []
    for (let r = 0; r < l.n; r++) {
      for (let c = 0; c < l.n; c++) {
        slots.push(slotAt({ area: 'grid', index: r * l.n + c }, l.gridX + c * slotW, CRAFT_TOP + r * SLOT_H))
      }
    }
    slots.push(slotAt({ area: 'result', index: 0 }, l.resultX, l.resultY))
    for (let i = 0; i < 36; i++) {
      const top = i >= HOTBAR_START ? l.hotY : l.invY + Math.floor(i / 9) * SLOT_H
      slots.push(slotAt({ area: 'inv', index: i }, LEFT + (i % 9) * slotW, top))
    }

    const parts: (RenderElement | null)[] = [
      panel(boardH),
      say(modeName(b.mode, innerW - scoreW - 1), LEFT, 1, innerW - scoreW - 1, INK),
      display(scoreText, LEFT + innerW - scoreW, 1, scoreW, 1, FONT),
      hasPictures ? (
        <Box position="absolute" left={LEFT} top={2} width={innerW} height={1} alignItems="center">
          {picture(timerSvg(leftMs, ROUND_MS[b.mode], innerW * CELL_PX), words.seconds(Math.ceil(leftMs / 1000)), innerW * CELL_PX * 2, 18)}
        </Box>
      ) : (
        say('█'.repeat(Math.round((innerW - 6) * (leftMs / ROUND_MS[b.mode]))), LEFT, 2, innerW - 6, { color: UI.green })
      ),
      hasPictures
        ? say(`${Math.ceil(leftMs / 1000)}s`, LEFT, 2, innerW, { color: '#ffffff', hasShadow: true }, { align: 'center' })
        : say(`${Math.ceil(leftMs / 1000)}s`, LEFT + innerW - 5, 2, 5, INK),
      ...slots,
      <Box position="absolute" left={l.arrowX} top={l.resultY} width={slotW} height={SLOT_H} alignItems="center" justifyContent="center">
        {hasPictures ? picture(arrowSvg(px), '→', px) : <Text>{'  →'}</Text>}
      </Box>,
      ...infoLines.map((line, i) => say(line, LEFT, l.infoY + i, innerW, info.ink)),
      button('book', props.showBook ? words.hideBook : words.book, LEFT, l.buttonsY, bookW, () => post({ kind: 'book' })),
      button('quit', words.quit, quitAt.x, quitAt.y, quitW, () => end('quit')),
      say(recordText, recordAt.x, recordAt.y, LEFT + innerW - recordAt.x, INK, { rows: recordBeside ? 2 : 1 }),
    ]

    if (tooltip && local.hover) {
      if (hasPictures) {
        const tip = tipSvg(tooltip, FONT)
        const w = Math.ceil(tip.width / CELL_PX) + 1
        parts.push(
          <Box position="absolute" left={Math.max(0, Math.min(boardW - w, local.hover.x + 2))} top={Math.max(0, local.hover.y - 1)} width={w}>
            {picture(tip.source, tooltip, tip.width, tip.height)}
          </Box>,
        )
      } else {
        parts.push(
          <Box
            position="absolute"
            left={Math.max(0, Math.min(boardW - tooltip.length - 2, local.hover.x + 2))}
            top={Math.max(0, local.hover.y - 1)}
            paddingX={1}
            backgroundColor={UI.tip}
          >
            <Text color="#ffffff">{tooltip}</Text>
          </Box>,
        )
      }
    }

    // The demo's bot: what it carries, gliding with its pointer, the pointer
    // itself over all, placed to a fraction of a cell by margins.
    if (demo && hasPictures) {
      const { x, y } = botPointer ?? demo.pointer
      const placed = (left: number, top: number, child: RenderElement) => (
        <Box position="absolute" left={Math.floor(left)} top={Math.floor(top)}>
          <Box marginLeft={round3(left - Math.floor(left))} marginTop={round3(top - Math.floor(top))}>
            {child}
          </Box>
        </Box>
      )
      if (cursor) {
        parts.push(
          placed(
            Math.max(0, x - slotW / 2),
            Math.max(0, y - SLOT_H / 2),
            <Box width={slotW} height={SLOT_H} alignItems="center" justifyContent="center">
              {picture(heldSvg(cursor.item, cursor.count, px), itemName(lang, cursor.item), px)}
            </Box>,
          ),
        )
      }
      parts.push(placed(x, y, picture(pointerSvg(2), '↖', 20, 32)))
    } else if (cursor && local.hover) {
      parts.push(
        <Box
          position="absolute"
          left={Math.max(0, Math.min(boardW - slotW, local.hover.x - 2))}
          top={Math.max(0, Math.min(boardH - SLOT_H, local.hover.y - 1))}
          width={slotW}
          height={SLOT_H}
          alignItems="center"
          justifyContent="center"
        >
          {hasPictures ? picture(heldSvg(cursor.item, cursor.count, px), itemName(lang, cursor.item), px) : textCell(cursor, true)}
        </Box>,
      )
    }

    return (
      <Box width={boardW} height={boardH}>
        {parts}
      </Box>
    )
  }

  let thrift = 0
  let tree = drawPlay(thrift)
  while (thrift < 4 && JSON.stringify(tree).length > TREE_BUDGET) tree = drawPlay(++thrift)
  hotspots = drawn
  return tree
}

export default Board
