import type { ClientModule, RenderElement } from 'claude-code'

import type { CardProps, CardRow } from '../types'
import {
  BUDDY_PX,
  CRAFT_H,
  CRAFT_PX,
  CRAFT_W,
  GRID_H,
  GRID_W,
  buddySvg,
  chevronSvg,
  craftBuddySvg,
  craftChevronSvg,
  craftStepIconSvg,
  stepIconSvg,
  stripSvg,
} from './art'
import { CELL_PX, CRAFT_HOVER, CRAFT_MUTED, SMALL, type Target, listen, pictures, pixelLabeler, setTargets, stripText, toneBackground, toneText } from './kit'
import { textWidth } from './pixel'

// One agent's card. Every row is one line tall, so a click is found by its row
// alone. What is open is kept by the hooks module: a click only says which row.
// The header opens the agent's detail view.

const HEADER_ROWS = 3
const MASCOT_COLS = 12
const ICON_COLS = 3
const CHEVRON_COLS = 3
const SIDE_COLS = 2
// Past this many rows a card would outgrow what a region may hold, as every
// pixel label is a small picture: from there the tool names stay plain text.
const PIXEL_ROWS = 12
const CRAFT_MASCOT_COLS = 13

const STATUS_INK: Record<CardProps['state'], string> = { running: '#55FF55', done: '#AAAAAA', stopped: '#FFAA00', failed: '#FF5555' }

const Card: ClientModule<CardProps, true> = (props, surface) => {
  const { Box, Text } = surface.elements
  const id = props.id
  listen(surface, id)

  const picture = pictures(surface, props.hasPictures)
  const pixelLabel = pixelLabeler(picture)

  const isCraft = props.isCraftSkin
  const drawBuddy = isCraft ? craftBuddySvg : buddySvg
  const drawStepIcon = isCraft ? craftStepIconSvg : stepIconSvg
  const drawChevron = isCraft ? craftChevronSvg : chevronSvg
  const hoverGround = isCraft ? CRAFT_HOVER : 'userMessageBackgroundHover'
  const muted = isCraft ? CRAFT_MUTED : undefined

  const targets: Target[] = [{ from: 0, to: HEADER_ROWS, message: { kind: 'agent', id } }]
  let y = HEADER_ROWS

  const columns = Math.max(20, props.columns)
  const mascotCols = props.isCraftSkin ? CRAFT_MASCOT_COLS : MASCOT_COLS
  const textCols = columns - mascotCols - SIDE_COLS
  const statusCols = props.isCraftSkin ? Math.min(16, Math.ceil((textWidth(props.status) * SMALL) / CELL_PX) + 2) : Math.min(17, props.status.length + 2)
  const nameCols = textCols - statusCols

  const plainName = (
    <Text weight="semibold" dimColor={props.state !== 'running'} wrap="truncate-end">
      {props.name}
    </Text>
  )
  const plainStatus = (
    <Text size="footnote" weight="medium" dimColor={props.state !== 'running'} color={props.state === 'running' ? props.color : undefined} wrap="truncate-end">
      {props.status}
    </Text>
  )
  // With the skin the name and the state are in the pixel font, as on an item.
  const name = isCraft ? pixelLabel(props.name, nameCols, 2, '#55FFFF', plainName) : plainName
  const status = isCraft ? pixelLabel(props.status, statusCols, SMALL, STATUS_INK[props.state], plainStatus) : plainStatus
  const plainSubtitle = (
    <Text size="footnote" mono color={muted} dimColor={!isCraft} wrap="truncate-end">
      {props.subtitle}
    </Text>
  )
  const subtitle = isCraft ? pixelLabel(props.subtitle, textCols - CHEVRON_COLS, SMALL, CRAFT_MUTED, plainSubtitle) : plainSubtitle
  const stripCols = textCols - CHEVRON_COLS
  const strip = picture(
    stripSvg(props.strip, stripCols * CELL_PX, 8, isCraft, props.progress),
    `${props.strip.length}`,
    Math.round(stripCols * CELL_PX),
    8,
    stripText(props.strip, stripCols, isCraft, Text as unknown as (p: object) => RenderElement, props.progress),
  )

  const header = (
    <Box key={`head-${id}`} height={HEADER_ROWS} flexDirection="row" alignItems="center" hover={{ backgroundColor: hoverGround }}>
      <Box width={mascotCols} height={HEADER_ROWS} alignItems="center">
        {picture(
          drawBuddy({ color: props.color, state: props.state, held: props.held, phase: props.phase }),
          props.name,
          isCraft ? CRAFT_W * CRAFT_PX : GRID_W * BUDDY_PX,
          isCraft ? CRAFT_H * CRAFT_PX : GRID_H * BUDDY_PX,
          <Text color={props.color}>■</Text>,
        )}
      </Box>
      <Box width={textCols} flexDirection="column" justifyContent="center">
        <Box height={1} flexDirection="row" justifyContent="space-between">
          <Box width={nameCols}>{name}</Box>
          <Box width={statusCols} justifyContent="flex-end">
            {status}
          </Box>
        </Box>
        <Box height={1} flexDirection="row" justifyContent="space-between">
          <Box width={textCols - CHEVRON_COLS}>{subtitle}</Box>
          <Box width={CHEVRON_COLS} height={1} alignItems="center" justifyContent="flex-end">
            {picture(drawChevron(false), 'details', 12, 12, <Text dimColor>›</Text>)}
          </Box>
        </Box>
        <Box height={1} width={stripCols} alignItems="center">
          {strip}
        </Box>
      </Box>
    </Box>
  )

  const hasPixelNames = isCraft && props.rows.length <= PIXEL_ROWS
  const nameColsOf = (row: CardRow) => (hasPixelNames ? Math.ceil((textWidth(row.name) * SMALL) / CELL_PX) + 2 : row.name.length + 2)
  const argCols = (row: CardRow) => Math.max(4, columns - ICON_COLS - CHEVRON_COLS - SIDE_COLS - nameColsOf(row))

  const plainStepName = (row: CardRow) => (
    <Text size="footnote" weight="semibold" color={isCraft ? '#FFFFFF' : undefined} wrap="truncate-end">
      {row.name}
    </Text>
  )

  const stepRow = (row: CardRow) => {
    targets.push({ from: y, to: y + 1, message: { kind: 'step', id: row.id } })
    y += 1
    return (
      <Box key={`row-${row.id}`} height={1} flexDirection="row" alignItems="center" hover={{ backgroundColor: hoverGround }}>
        <Box width={ICON_COLS} height={1} alignItems="center">
          {picture(drawStepIcon(row.state, props.color), row.state, 14, 14, <Text color={props.color}>{row.state === 'ok' ? '✓' : row.state === 'error' ? '✗' : '*'}</Text>)}
        </Box>
        <Box width={nameColsOf(row)}>{hasPixelNames ? pixelLabel(row.name, nameColsOf(row), SMALL, '#FFFFFF', plainStepName(row)) : plainStepName(row)}</Box>
        <Box width={argCols(row)}>
          <Text size="footnote" mono color={muted} dimColor={!isCraft} wrap="truncate-end">
            {row.arg}
          </Text>
        </Box>
        <Box width={CHEVRON_COLS} height={1} alignItems="center" justifyContent="flex-end">
          {picture(drawChevron(row.isOpen), row.isOpen ? 'open' : 'closed', 12, 12, <Text dimColor>{row.isOpen ? '⌄' : '›'}</Text>)}
        </Box>
      </Box>
    )
  }

  const detailRows = (row: CardRow) =>
    row.detail.map((line, i) => {
      y += 1
      return (
        <Box key={`line-${row.id}-${i}`} height={1} paddingX={1} marginLeft={ICON_COLS} backgroundColor={toneBackground(line.tone)}>
          <Text size="footnote" mono color={toneText(line.tone) ?? muted} dimColor={!isCraft && (line.tone === 'dim' || line.tone === undefined)} wrap="truncate-end">
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

  setTargets(id, targets)

  return (
    <Box flexDirection="column" width="100%">
      {header}
      {rows}
    </Box>
  )
}

export default Card
