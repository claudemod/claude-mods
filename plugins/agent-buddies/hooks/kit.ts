import type { ClientPointerEvent, ClientSurface, RenderElement } from 'claude-code'

import type { CardMessage, DetailLine, Segment } from '../types'
import { CRAFT_KIND_INK, KIND_INK } from './art'
import { labelSvg, textWidth } from './pixel'

// What the card and the detail view share: pictures with a text stand-in,
// pixel labels for the Craft Skin, diff tones and the click map.

// A cell is at least this wide on the desktop; a pixel label is cut to fit by it.
export const CELL_PX = 7.5
// The second size of pixel text: crisp on a Retina screen, and it leaves room.
export const SMALL = 1.5
export const CRAFT_MUTED = '#AAAAAA'
export const CRAFT_HOVER = '#2A0A3A'

export const toneBackground = (tone: DetailLine['tone']) =>
  tone === 'add' ? 'diffAddedDimmed' : tone === 'del' ? 'diffRemovedDimmed' : undefined
export const toneText = (tone: DetailLine['tone']) => (tone === 'add' ? 'diffAdded' : tone === 'del' ? 'diffRemoved' : undefined)

export function fit(text: string, widthPx: number, scale: number) {
  const room = Math.floor(widthPx / scale)
  if (textWidth(text) <= room) return text
  let cut = [...text]
  while (cut.length > 1 && textWidth(`${cut.join('')}..`) > room) cut = cut.slice(0, -1)
  return `${cut.join('')}..`
}

export type Picture = (source: string, alt: string, width: number, height: number, fallback: RenderElement) => RenderElement

// The desktop draws pictures here though its table does not always list them.
export function pictures(surface: ClientSurface<true>, hasPictures: boolean): Picture {
  const Svg = (surface.elements as unknown as Record<string, ((p: object) => RenderElement) | undefined>).Svg
  return (source, alt, width, height, fallback) => {
    if (!hasPictures) return fallback
    const svgProps = { source, alt, width, height }
    return Svg ? Svg(svgProps) : ({ type: 'Svg', props: svgProps } as unknown as RenderElement)
  }
}

export function pixelLabeler(picture: Picture) {
  return (text: string, widthCols: number, scale: number, color: string, fallback: RenderElement) => {
    const label = labelSvg([fit(text, widthCols * CELL_PX, scale)], scale, { color, hasShadow: true })
    return picture(label.source, text, label.width, label.height, fallback)
  }
}

// A region of rows (and, where given, columns) a click there answers with.
export type Target = { from: number; to: number; x0?: number; x1?: number; message: CardMessage }

// Modules are shared between instances: each finds its own map by its key.
const targetsOf = new Map<string, Target[]>()
const pressedOf = new Map<string, Target | undefined>()

const hit = (key: string, event: ClientPointerEvent) =>
  (targetsOf.get(key) ?? []).find(
    t => event.y >= t.from && event.y < t.to && (t.x0 === undefined || event.x >= t.x0) && (t.x1 === undefined || event.x < t.x1),
  )

// Listens once per instance: a press and release on the same target posts its message.
export function listen(surface: ClientSurface<true>, key: string) {
  if (surface.state !== undefined) return
  surface.setState(true)
  surface.onPointer((event: ClientPointerEvent) => {
    if (event.button !== 'left') return
    if (event.type === 'down') pressedOf.set(key, hit(key, event))
    if (event.type === 'up') {
      const target = hit(key, event)
      const pressed = pressedOf.get(key)
      pressedOf.delete(key)
      // By what it says, not by identity: a redraw between press and release makes new targets.
      if (target && pressed && JSON.stringify(pressed.message) === JSON.stringify(target.message)) surface.post(target.message)
    }
  })
}

export function setTargets(key: string, targets: Target[]) {
  targetsOf.set(key, targets)
}

// The strip as text, where no pictures are drawn: a bar of cells in the kinds' colours.
export function stripText(segments: readonly Segment[], cols: number, isCraft: boolean, Text: (p: object) => RenderElement, progress = 1) {
  const ink = isCraft ? CRAFT_KIND_INK : KIND_INK
  if (segments.length === 0) return Text({ dimColor: true, children: '─'.repeat(cols) })
  const total = segments.reduce((sum, s) => sum + s.weight, 0)
  // Neighbouring steps of one kind share their cells, so short steps still show.
  const runs: { color: string; weight: number }[] = []
  for (const s of segments) {
    const last = runs[runs.length - 1]
    if (last && last.color === ink[s.kind]) last.weight += s.weight
    else runs.push({ color: ink[s.kind], weight: s.weight })
  }
  const reach = Math.max(runs.length, Math.round(cols * Math.min(1, Math.max(0, progress))))
  let used = 0
  const parts = runs.map((run, i) => {
    const n = i === runs.length - 1 ? Math.max(1, reach - used) : Math.max(1, Math.round((run.weight / total) * reach))
    used += n
    return Text({ color: run.color, children: '━'.repeat(Math.max(0, n)) })
  })
  if (cols - used > 0) parts.push(Text({ dimColor: true, children: '─'.repeat(cols - used) }))
  return Text({ wrap: 'truncate-end', children: parts })
}

