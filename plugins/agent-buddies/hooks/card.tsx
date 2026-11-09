import type { ClientModule, ClientPointerEvent, RenderElement } from 'claude-code'

import type { CardMessage, CardProps, CardRow, DetailLine } from '../types'
import { BUDDY_PX, GRID_H, GRID_W, buddySvg, chevronSvg, stepIconSvg } from './art'

// One agent's card. Every row is one line tall, so a click is found by its row
// alone. What is open is kept by the hooks module: a click only says which row.

const HEADER_ROWS = 3
const MASCOT_COLS = 12
const ICON_COLS = 3
const CHEVRON_COLS = 3
const SIDE_COLS = 2

type Target = { from: number; to: number; message: CardMessage }

// Modules are shared between instances: each card finds its own by its id.
const targetsOf = new Map<string, Target[]>()
const pressedOf = new Map<string, number>()

const toneBackground = (tone: DetailLine['tone']) =>
  tone === 'add' ? 'diffAddedDimmed' : tone === 'del' ? 'diffRemovedDimmed' : undefined
const toneText = (tone: DetailLine['tone']) => (tone === 'add' ? 'diffAdded' : tone === 'del' ? 'diffRemoved' : undefined)

const Card: ClientModule<CardProps, true> = (props, surface) => {
  const { Box, Text } = surface.elements
  const id = props.id

  if (surface.state === undefined) {
    surface.setState(true)
    surface.onPointer((event: ClientPointerEvent) => {
      const at = (targetsOf.get(id) ?? []).findIndex(t => event.y >= t.from && event.y < t.to)
      if (event.type === 'down' && event.button === 'left') pressedOf.set(id, at)
      if (event.type === 'up' && event.button === 'left') {
        const target = at >= 0 && pressedOf.get(id) === at ? targetsOf.get(id)?.[at] : undefined
        pressedOf.delete(id)
        if (target) surface.post(target.message)
      }
    })
  }

  const Svg = (surface.elements as unknown as Record<string, ((p: object) => RenderElement) | undefined>).Svg
  // The desktop draws pictures here though its table does not always list them.
  const picture = (source: string, alt: string, width: number, height: number, fallback: RenderElement): RenderElement => {
    if (!props.hasPictures) return fallback
    const svgProps = { source, alt, width, height }
    return Svg ? Svg(svgProps) : ({ type: 'Svg', props: svgProps } as unknown as RenderElement)
  }

  const targets: Target[] = [{ from: 0, to: HEADER_ROWS, message: { kind: 'agent', id } }]
  let y = HEADER_ROWS

  const columns = Math.max(20, props.columns)
  const textCols = columns - MASCOT_COLS - SIDE_COLS
  const statusCols = Math.min(14, props.status.length + 2)
  const nameCols = textCols - statusCols

  const header = (
    <Box key={`head-${id}`} height={HEADER_ROWS} flexDirection="row" alignItems="center" hover={{ backgroundColor: 'userMessageBackgroundHover' }}>
      <Box width={MASCOT_COLS} height={HEADER_ROWS} alignItems="center">
        {picture(
          buddySvg({ color: props.color, state: props.state, held: props.held, phase: props.phase }),
          props.name,
          GRID_W * BUDDY_PX,
          GRID_H * BUDDY_PX,
          <Text color={props.color}>■</Text>,
        )}
      </Box>
      <Box width={textCols} flexDirection="column" justifyContent="center">
        <Box height={1} flexDirection="row" justifyContent="space-between">
          <Box width={nameCols}>
            <Text weight="semibold" dimColor={props.state !== 'running'} wrap="truncate-end">
              {props.name}
            </Text>
          </Box>
          <Box width={statusCols} justifyContent="flex-end">
            <Text size="footnote" weight="medium" dimColor={props.state !== 'running'} color={props.state === 'running' ? props.color : undefined} wrap="truncate-end">
              {props.status}
            </Text>
          </Box>
        </Box>
        <Box height={1} flexDirection="row" justifyContent="space-between">
          <Box width={textCols - CHEVRON_COLS}>
            <Text size="footnote" mono dimColor wrap="truncate-end">
              {props.subtitle}
            </Text>
          </Box>
          <Box width={CHEVRON_COLS} height={1} alignItems="center" justifyContent="flex-end">
            {picture(chevronSvg(props.isExpanded), props.isExpanded ? 'open' : 'closed', 12, 12, <Text dimColor>{props.isExpanded ? '⌄' : '›'}</Text>)}
          </Box>
        </Box>
      </Box>
    </Box>
  )

  const argCols = (row: CardRow) => Math.max(4, columns - ICON_COLS - CHEVRON_COLS - SIDE_COLS - row.name.length - 2)

  const stepRow = (row: CardRow) => {
    targets.push({ from: y, to: y + 1, message: { kind: 'step', id: row.id } })
    y += 1
    return (
      <Box key={`row-${row.id}`} height={1} flexDirection="row" alignItems="center" hover={{ backgroundColor: 'userMessageBackgroundHover' }}>
        <Box width={ICON_COLS} height={1} alignItems="center">
          {picture(stepIconSvg(row.state, props.color), row.state, 14, 14, <Text color={props.color}>{row.state === 'ok' ? '✓' : row.state === 'error' ? '✗' : '*'}</Text>)}
        </Box>
        <Box width={row.name.length + 2}>
          <Text size="footnote" weight="semibold" wrap="truncate-end">
            {row.name}
          </Text>
        </Box>
        <Box width={argCols(row)}>
          <Text size="footnote" mono dimColor wrap="truncate-end">
            {row.arg}
          </Text>
        </Box>
        <Box width={CHEVRON_COLS} height={1} alignItems="center" justifyContent="flex-end">
          {picture(chevronSvg(row.isOpen), row.isOpen ? 'open' : 'closed', 12, 12, <Text dimColor>{row.isOpen ? '⌄' : '›'}</Text>)}
        </Box>
      </Box>
    )
  }

  const detailRows = (row: CardRow) =>
    row.detail.map((line, i) => {
      y += 1
      return (
        <Box key={`line-${row.id}-${i}`} height={1} paddingX={1} marginLeft={ICON_COLS} backgroundColor={toneBackground(line.tone)}>
          <Text size="footnote" mono color={toneText(line.tone)} dimColor={line.tone === 'dim' || line.tone === undefined} wrap="truncate-end">
            {line.text}
          </Text>
        </Box>
      )
    })

  const rows = props.rows.flatMap(row => {
    const drawn = [stepRow(row)]
    if (row.isOpen) drawn.push(...detailRows(row))
    return drawn
  })

  targetsOf.set(id, targets)

  return (
    <Box flexDirection="column" width="100%">
      {header}
      {rows}
    </Box>
  )
}

export default Card
