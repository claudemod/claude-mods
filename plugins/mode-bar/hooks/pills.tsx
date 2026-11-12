import type { ClientModule, ClientPointerEvent, RenderElement } from 'claude-code'

import type { PillsProps } from '../types'
import { INFO_ROWS, LIGHT, LIGHT_COLUMNS, NAME_ROWS, TILES_Y, layoutTiles, targetAt } from './layout'
import type { Layout } from './layout'
import { tileSvg } from './tiles'

// The mode tiles on the desktop, drawn like app icons in one row right above
// the prompt box: a rounded square in the mode's colour with a white line
// symbol, the mode's name under it in the app's own type. Above them, on the
// left, the traffic light with its number; beside it what the pointer is on: a
// mode's name and what it does, or the light's figures. A click on a tile picks
// the mode (posted to the mod).

type Local = { hover: string | null; pressed: string | null }

let current: PillsProps = { pills: [], active: '', columns: 0, light: { source: '', alt: '', amount: '', isRunning: false, lines: [] } }
let drawn: Layout | null = null

const LIGHT_PX = { width: 38, height: 16 }

const Tiles: ClientModule<PillsProps, Local> = (props, surface) => {
  current = props
  const { Box, Text } = surface.elements
  const local = (): Local => surface.state ?? { hover: null, pressed: null }

  if (surface.state === undefined) {
    surface.setState(local())
    surface.onPointer((event: ClientPointerEvent) => {
      const now = local()
      const hover = event.type === 'leave' || !drawn ? null : (targetAt(drawn, event.x, event.y) ?? null)
      if (event.type === 'down' && event.button === 'left') {
        surface.setState({ hover, pressed: hover })
        return
      }
      if (event.type === 'up' && event.button === 'left') {
        if (hover && hover !== LIGHT && hover === now.pressed) surface.post({ kind: 'pick', id: hover })
        surface.setState({ hover, pressed: null })
        return
      }
      if (hover !== now.hover) surface.setState({ ...now, hover })
    })
  }

  const { hover } = local()
  const layout = layoutTiles(
    current.pills.map(p => ({ id: p.id, label: p.label })),
    current.columns > 0 ? current.columns : surface.columns,
  )
  const { placed, gap, left, tilePx, tileRows, hasNames } = layout
  drawn = layout

  const Svg = (surface.elements as unknown as Record<string, ((p: object) => RenderElement) | undefined>).Svg
  const picture = (source: string, alt: string, width: number, height: number): RenderElement => {
    const svgProps = { source, alt, width, height }
    return Svg ? Svg(svgProps) : ({ type: 'Svg', props: svgProps } as unknown as RenderElement)
  }

  const tiles = placed.map((p, i) => {
    const item = current.pills.find(q => q.id === p.id)
    if (!item) return null
    const isActive = item.id === current.active
    const state = isActive ? 'active' : item.id === hover ? 'hover' : 'rest'
    return (
      <Box width={p.w} flexDirection="column" alignItems="center" marginLeft={i > 0 ? gap : 0}>
        <Box height={tileRows} alignItems="center" justifyContent="center">
          {picture(tileSvg(item.id, item.label, item.color, state, tilePx), item.label, tilePx, tilePx)}
        </Box>
        {hasNames ? (
          <Box height={NAME_ROWS} justifyContent="center">
            <Text size="footnote" weight={isActive ? 'semibold' : 'medium'} dimColor={!isActive && item.id !== hover} wrap="truncate-end">
              {item.label}
            </Text>
          </Box>
        ) : null}
      </Box>
    )
  })

  const light = current.light
  // Without names under the tiles, the active mode is named on the info line.
  const shown = current.pills.find(p => p.id === hover) ?? (hasNames || hover === LIGHT ? undefined : current.pills.find(p => p.id === current.active))
  const info = shown ? (
    <Text size="footnote" wrap="truncate-end">
      <Text weight="semibold" color={shown.color}>
        {shown.label}
      </Text>
      <Text dimColor>{`  ${shown.hint}`}</Text>
    </Text>
  ) : hover === LIGHT ? (
    <Text size="footnote" dimColor wrap="truncate-end">
      {light.lines.join('  ·  ')}
    </Text>
  ) : (
    <Text size="footnote"> </Text>
  )

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" height={INFO_ROWS} marginLeft={left} alignItems="center">
        <Box width={LIGHT_COLUMNS} flexDirection="row" alignItems="center" gap={1}>
          {picture(light.source, light.alt, LIGHT_PX.width, LIGHT_PX.height)}
          <Text size="footnote" dimColor={!light.isRunning}>
            {light.amount}
          </Text>
        </Box>
        {info}
      </Box>
      <Box height={TILES_Y - INFO_ROWS} />
      <Box flexDirection="row" height={tileRows + (hasNames ? NAME_ROWS : 0)} marginLeft={left}>
        {tiles}
      </Box>
    </Box>
  )
}

export default Tiles
