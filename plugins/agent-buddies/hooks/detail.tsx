import type { ClientModule, RenderElement } from 'claude-code'

import type { DetailProps, DetailRow, Fold, Phase } from '../types'
import {
  BUDDY_PX,
  CRAFT_H,
  CRAFT_KIND_INK,
  CRAFT_PX,
  CRAFT_W,
  GRID_H,
  GRID_W,
  KIND_INK,
  buddySvg,
  chevronSvg,
  craftBuddySvg,
  craftChevronSvg,
  craftStepIconSvg,
  dotSvg,
  kindIconSvg,
  stepIconSvg,
  stripSvg,
} from './art'
import { CELL_PX, CRAFT_HOVER, CRAFT_MUTED, SMALL, type Target, listen, pictures, pixelLabeler, setTargets, stripText, toneBackground, toneText } from './kit'
import { textWidth } from './pixel'
import { clock } from './view'

// One agent's whole run, top to bottom: who it is and how far it got, the
// task it was given, its steps grouped into phases of one kind of work, and
// what it answered. Every row is one line tall, so a click is found by its row
// (and, in the tab row, its column); the hooks module keeps what is open.

const KEY = 'detail'
const HERO_ROWS = 3
const MASCOT_COLS = 12
const CRAFT_MASCOT_COLS = 13
const ICON_COLS = 3
const CHEVRON_COLS = 3
const RAIL_COLS = 2
const AT_COLS = 7
const TOOK_COLS = 8
const BACK_COLS = 8

const STATUS_INK: Record<DetailProps['state'], string> = { running: '#55FF55', done: '#AAAAAA', stopped: '#FFAA00', failed: '#FF5555' }

// Whether the instance's clock should tick: only while its agent runs.
let isTicking = false

const Detail: ClientModule<DetailProps, true> = (props, surface) => {
  const { Box, Text } = surface.elements
  const isFirst = surface.state === undefined
  listen(surface, KEY)
  // The running time counts up by itself, a redraw a second while the agent works.
  if (isFirst) surface.every(1000, () => isTicking && surface.setState(true))
  isTicking = props.state === 'running'

  const picture = pictures(surface, props.hasPictures)
  const pixelLabel = pixelLabeler(picture)
  const isCraft = props.isCraftSkin
  const ink = isCraft ? CRAFT_KIND_INK : KIND_INK
  const hoverGround = isCraft ? CRAFT_HOVER : 'userMessageBackgroundHover'
  const muted = isCraft ? CRAFT_MUTED : undefined
  const drawChevron = isCraft ? craftChevronSvg : chevronSvg
  const drawStepIcon = isCraft ? craftStepIconSvg : stepIconSvg
  const columns = Math.max(28, props.columns)

  const targets: Target[] = []
  let y = 0
  const out: RenderElement[] = []
  const spacer = (key: string) => {
    y += 1
    out.push(<Box key={key} height={1} />)
  }
  const chevron = (isOpen: boolean) => picture(drawChevron(isOpen), isOpen ? 'open' : 'closed', 12, 12, <Text dimColor>{isOpen ? '⌄' : '›'}</Text>)
  const dim = (text: string, extra: object = {}) => (
    <Text size="footnote" color={muted} dimColor={!isCraft} wrap="truncate-end" {...extra}>
      {text}
    </Text>
  )

  // --- The tab row: back to the list, and every agent of the round.
  {
    targets.push({ from: y, to: y + 1, x0: 0, x1: BACK_COLS, message: { kind: 'back' } })
    const tabs = props.tabs.length > 1 ? props.tabs : []
    const tabCols = tabs.length > 0 ? Math.max(6, Math.floor((columns - BACK_COLS) / tabs.length)) : 0
    const fits = tabCols > 0 ? Math.max(1, Math.floor((columns - BACK_COLS) / tabCols)) : 0
    const shown = tabs.slice(0, fits)
    shown.forEach((tab, i) => {
      const x0 = BACK_COLS + i * tabCols
      targets.push({ from: y, to: y + 1, x0, x1: x0 + tabCols, message: { kind: 'agent', id: tab.id } })
    })
    out.push(
      <Box key="tabs" height={1} flexDirection="row" alignItems="center">
        <Box key="back" width={BACK_COLS} height={1} alignItems="center" hover={{ backgroundColor: hoverGround }}>
          <Text size="footnote" weight="medium" color={isCraft ? '#FFFFFF' : undefined} wrap="truncate-end">
            ‹ {props.words.back}
          </Text>
        </Box>
        {shown.map(tab => {
          const isActive = tab.id === props.id
          return (
            <Box
              key={`tab-${tab.id}`}
              width={tabCols}
              height={1}
              paddingX={1}
              alignItems="center"
              backgroundColor={isActive ? hoverGround : undefined}
              hover={{ backgroundColor: hoverGround }}
            >
              <Text size="footnote" wrap="truncate-end" color={isCraft ? '#FFFFFF' : undefined} dimColor={!isActive && !isCraft}>
                <Text color={tab.color}>{tab.state === 'running' ? '●' : '○'}</Text> {tab.name}
              </Text>
            </Box>
          )
        })}
      </Box>,
    )
    y += 1
  }
  spacer('s-hero')

  // --- The hero: the buddy, its name and state, what it is, and the strip.
  {
    const mascotCols = isCraft ? CRAFT_MASCOT_COLS : MASCOT_COLS
    const textCols = columns - mascotCols - 1
    const elapsed = props.state === 'running' ? ` · ${clock(Date.now() - props.startedAt)}` : ''
    const status = `${props.status}${elapsed}`
    const statusCols = Math.min(18, isCraft ? Math.ceil((textWidth(status) * SMALL) / CELL_PX) + 2 : status.length + 2)
    const nameCols = textCols - statusCols
    const plainName = (
      <Text weight="bold" color={isCraft ? '#55FFFF' : undefined} wrap="truncate-end">
        {props.name}
      </Text>
    )
    const plainStatus = (
      <Text size="footnote" weight="medium" tabular color={props.state === 'running' ? props.color : props.state === 'failed' ? 'error' : undefined} dimColor={props.state === 'done'} wrap="truncate-end">
        {status}
      </Text>
    )
    out.push(
      <Box key="hero" height={HERO_ROWS} flexDirection="row" alignItems="center">
        <Box width={mascotCols} height={HERO_ROWS} alignItems="center">
          {picture(
            (isCraft ? craftBuddySvg : buddySvg)({ color: props.color, state: props.state, held: props.held, phase: props.phase }),
            props.name,
            isCraft ? CRAFT_W * CRAFT_PX : GRID_W * BUDDY_PX,
            isCraft ? CRAFT_H * CRAFT_PX : GRID_H * BUDDY_PX,
            <Text color={props.color}>■</Text>,
          )}
        </Box>
        <Box width={textCols} flexDirection="column" justifyContent="center">
          <Box height={1} flexDirection="row" justifyContent="space-between">
            <Box width={nameCols}>{isCraft ? pixelLabel(props.name, nameCols, 2, '#55FFFF', plainName) : plainName}</Box>
            <Box width={statusCols} justifyContent="flex-end">
              {isCraft ? pixelLabel(status, statusCols, SMALL, STATUS_INK[props.state], plainStatus) : plainStatus}
            </Box>
          </Box>
          <Box height={1}>{dim(props.meta, { mono: true })}</Box>
          <Box height={1} width={textCols} alignItems="center">
            {picture(
              stripSvg(props.strip, textCols * CELL_PX, 10, isCraft),
              props.legend.map(entry => `${entry.label} ${entry.count}`).join(', ') || props.words.noSteps,
              Math.round(textCols * CELL_PX),
              10,
              stripText(props.strip, textCols, isCraft, Text as unknown as (p: object) => RenderElement),
            )}
          </Box>
        </Box>
      </Box>,
    )
    y += HERO_ROWS
  }

  // --- The legend under the strip: how many calls of each kind.
  if (props.legend.length > 0) {
    out.push(
      <Box key="legend" height={1} flexDirection="row" alignItems="center" marginLeft={isCraft ? CRAFT_MASCOT_COLS : MASCOT_COLS}>
        {props.legend.map(entry => (
          <Box key={`legend-${entry.kind}`} height={1} flexDirection="row" alignItems="center" marginRight={2}>
            {picture(dotSvg(ink[entry.kind], isCraft), entry.label, 8, 8, <Text color={ink[entry.kind]}>●</Text>)}
            <Text size="footnote" color={muted} dimColor={!isCraft} wrap="truncate-end">
              {' '}
              {entry.label} <Text weight="semibold">{String(entry.count)}</Text>
            </Text>
          </Box>
        ))}
      </Box>,
    )
    y += 1
  }

  const sectionLabel = (key: string, text: string, right = '') => {
    y += 1
    out.push(
      <Box key={key} height={1} flexDirection="row" justifyContent="space-between" alignItems="center">
        {isCraft ? (
          pixelLabel(text, columns - 10, SMALL, '#FFFF55', <Text weight="semibold">{text}</Text>)
        ) : (
          <Text size="caption" weight="semibold" dimColor>
            {text}
          </Text>
        )}
        {right ? dim(right, { tabular: true }) : null}
      </Box>,
    )
  }

  // A block of text: a few lines, and one more row that opens or closes the rest.
  const foldRows = (key: string, fold: Fold, isMono: boolean) => {
    const canToggle = fold.more !== ''
    const from = y
    fold.lines.forEach((line, i) => {
      y += 1
      out.push(
        <Box key={`${key}-${i}`} height={1} paddingX={1} hover={canToggle ? { backgroundColor: hoverGround } : undefined}>
          <Text size="footnote" mono={isMono} color={isCraft ? '#FFFFFF' : undefined} wrap="truncate-end">
            {line === '' ? ' ' : line}
          </Text>
        </Box>,
      )
    })
    if (canToggle) {
      y += 1
      out.push(
        <Box key={`${key}-more`} height={1} paddingX={1} flexDirection="row" alignItems="center" hover={{ backgroundColor: hoverGround }}>
          <Box width={CHEVRON_COLS} height={1} alignItems="center">
            {chevron(fold.isOpen)}
          </Box>
          <Text size="footnote" weight="medium" color={isCraft ? '#55FFFF' : 'suggestion'} wrap="truncate-end">
            {fold.more}
          </Text>
        </Box>,
      )
      targets.push({ from, to: y, message: { kind: 'toggle', id: fold.id } })
    }
  }

  // --- The task it was given.
  spacer('s-task')
  sectionLabel('task-label', props.words.task)
  foldRows('task', props.task, false)

  // --- The flow: phases of one kind of work, each with its steps.
  spacer('s-flow')
  sectionLabel('flow-label', props.words.flow)

  const stepRow = (row: DetailRow, color: string) => {
    targets.push({ from: y, to: y + 1, message: { kind: 'step', id: row.id } })
    y += 1
    const nameCols = Math.min(18, row.name.length + 2)
    const argCols = Math.max(4, columns - RAIL_COLS - ICON_COLS - AT_COLS - nameCols - TOOK_COLS - CHEVRON_COLS)
    out.push(
      <Box key={`row-${row.id}`} height={1} flexDirection="row" alignItems="center" hover={{ backgroundColor: hoverGround }}>
        <Box width={RAIL_COLS} height={1} alignItems="center">
          <Text color={color}>│</Text>
        </Box>
        <Box width={ICON_COLS} height={1} alignItems="center">
          {picture(drawStepIcon(row.state, color), row.state, 14, 14, <Text color={color}>{row.state === 'ok' ? '✓' : row.state === 'error' ? '✗' : '*'}</Text>)}
        </Box>
        <Box width={AT_COLS}>{dim(row.at, { mono: true, tabular: true })}</Box>
        <Box width={nameCols}>
          <Text size="footnote" weight="semibold" color={row.state === 'error' ? 'error' : isCraft ? '#FFFFFF' : undefined} wrap="truncate-end">
            {row.name}
          </Text>
        </Box>
        <Box width={argCols}>{dim(row.arg, { mono: true })}</Box>
        <Box width={TOOK_COLS} justifyContent="flex-end">
          {dim(row.took, { tabular: true })}
        </Box>
        <Box width={CHEVRON_COLS} height={1} alignItems="center" justifyContent="flex-end">
          {chevron(row.isOpen)}
        </Box>
      </Box>,
    )
    if (row.isOpen) {
      row.detail.forEach((line, i) => {
        y += 1
        out.push(
          <Box key={`line-${row.id}-${i}`} height={1} flexDirection="row">
            <Box width={RAIL_COLS} height={1}>
              <Text color={color}>│</Text>
            </Box>
            <Box flexGrow={1} height={1} paddingX={1} marginLeft={ICON_COLS} backgroundColor={toneBackground(line.tone)}>
              <Text size="footnote" mono color={toneText(line.tone) ?? muted} dimColor={!isCraft && (line.tone === 'dim' || line.tone === undefined)} wrap="truncate-end">
                {line.text}
              </Text>
            </Box>
          </Box>,
        )
      })
    }
  }

  const phaseRow = (phase: Phase, index: number) => {
    const color = ink[phase.kind]
    targets.push({ from: y, to: y + 1, message: { kind: 'toggle', id: phase.id } })
    y += 1
    const labelCols = Math.min(14, phase.label.length + 2)
    const summaryCols = Math.min(18, phase.summary.length + 2)
    const errorCols = phase.errors ? Math.min(12, phase.errors.length + 2) : 0
    const restCols = Math.max(0, columns - ICON_COLS - labelCols - summaryCols - errorCols - TOOK_COLS - CHEVRON_COLS)
    out.push(
      <Box key={`phase-${phase.id}`} height={1} flexDirection="row" alignItems="center" hover={{ backgroundColor: hoverGround }}>
        <Box width={ICON_COLS} height={1} alignItems="center">
          {picture(kindIconSvg(phase.kind, isCraft), phase.label, 14, 14, <Text color={color}>■</Text>)}
        </Box>
        <Box width={labelCols}>
          <Text size="footnote" weight="bold" color={color} wrap="truncate-end">
            {phase.label}
          </Text>
        </Box>
        <Box width={summaryCols}>{dim(phase.summary)}</Box>
        {errorCols > 0 ? (
          <Box width={errorCols}>
            <Text size="footnote" weight="medium" color="error" wrap="truncate-end">
              {phase.errors}
            </Text>
          </Box>
        ) : null}
        <Box width={restCols} />
        <Box width={TOOK_COLS} justifyContent="flex-end">
          {dim(phase.took, { tabular: true })}
        </Box>
        <Box width={CHEVRON_COLS} height={1} alignItems="center" justifyContent="flex-end">
          {chevron(phase.isOpen)}
        </Box>
      </Box>,
    )
    if (phase.isOpen) phase.rows.forEach(row => stepRow(row, color))
    // A thin gap between phases keeps them apart without a line.
    if (index < props.phases.length - 1 && phase.isOpen) spacer(`gap-${phase.id}`)
  }

  if (props.phases.length === 0) {
    y += 1
    out.push(
      <Box key="no-steps" height={1} paddingX={1}>
        {dim(props.words.noSteps)}
      </Box>,
    )
  } else {
    props.phases.forEach(phaseRow)
  }

  // --- What it answered, once it has.
  if (props.result || props.state === 'running') {
    spacer('s-result')
    sectionLabel('result-label', props.words.result)
    if (props.result) foldRows('result', props.result, false)
    else {
      y += 1
      out.push(
        <Box key="waiting" height={1} paddingX={1}>
          {dim(props.words.waiting, { italic: true })}
        </Box>,
      )
    }
  }

  setTargets(KEY, targets)

  return (
    <Box flexDirection="column" width="100%">
      {out}
    </Box>
  )
}

export default Detail
