import type { ClientModule, ClientPointerEvent, RenderElement } from 'claude-code'

import type { HotbarProps } from '../types'
import { HOTBAR_H, HOTBAR_SCALE, HOTBAR_W, LAMP, hotbarSvg, hotbarTargetAt, itemNameSvg, slotted } from './hotbar-art'

// The modes as a hotbar, with the Craft Skin on. The region is exactly as wide
// as the picture, so where the pointer is comes from its share of the region;
// `columns` is rounded down from the true width, hence half a cell more. Under
// the hotbar the name of the mode (the active one, or the one the pointer is
// on, with what it does). The row's minimum width keeps it from widening the region.

type Local = { hover: string | null; pressed: string | null }

const BAR_ROWS = 3

let current: HotbarProps = { pills: [], active: '', scale: 2, lamp: { color: '', alt: '', amount: '', isRunning: false, lines: [] } }

const Hotbar: ClientModule<HotbarProps, Local> = (props, surface) => {
  current = props
  const { Box, Text } = surface.elements
  const local = (): Local => surface.state ?? { hover: null, pressed: null }

  const targetOf = (event: ClientPointerEvent): string | null => {
    if (event.type === 'leave' || event.y >= BAR_ROWS || surface.columns <= 0) return null
    const target = hotbarTargetAt((event.x + 0.5) / (surface.columns + 0.5))
    if (target === LAMP || target === null) return target
    return slotted(current.pills, current.active)[target]?.id ?? null
  }

  if (surface.state === undefined) {
    surface.setState(local())
    surface.onPointer((event: ClientPointerEvent) => {
      const now = local()
      const hover = targetOf(event)
      if (event.type === 'down' && event.button === 'left') return surface.setState({ hover, pressed: hover })
      if (event.type === 'up' && event.button === 'left') {
        if (hover && hover !== LAMP && hover === now.pressed) surface.post({ kind: 'pick', id: hover })
        return surface.setState({ hover, pressed: null })
      }
      if (hover !== now.hover) surface.setState({ ...now, hover })
    })
  }

  const Svg = (surface.elements as unknown as Record<string, ((p: object) => RenderElement) | undefined>).Svg
  const picture = (source: string, alt: string, width: number, height: number): RenderElement => {
    const svgProps = { source, alt, width, height }
    return Svg ? Svg(svgProps) : ({ type: 'Svg', props: svgProps } as unknown as RenderElement)
  }

  const { hover } = local()
  const lamp = current.lamp
  const hovered = current.pills.find(p => p.id === hover)
  const named = hovered ?? current.pills.find(p => p.id === current.active)
  const name = hover !== LAMP && named ? itemNameSvg(named.label) : null
  const hint = hover === LAMP ? lamp.lines.join('  ·  ') : (hovered?.hint ?? '')
  const source = hotbarSvg({ items: current.pills, active: current.active, hover, lamp })

  return (
    <Box flexDirection="column" alignItems="center">
      {picture(source, lamp.alt, HOTBAR_W * (props.scale || HOTBAR_SCALE), HOTBAR_H * (props.scale || HOTBAR_SCALE))}
      <Box width={0} minWidth="100%" flexDirection="row" alignItems="center" justifyContent="center" gap={1}>
        {name ? picture(name.source, named?.label ?? '', name.width, name.height) : null}
        {hint ? (
          <Text size="footnote" dimColor wrap="truncate-end">
            {hint}
          </Text>
        ) : null}
      </Box>
    </Box>
  )
}

export default Hotbar
