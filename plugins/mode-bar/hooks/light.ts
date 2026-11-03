import type { Task } from '../types'

export type Level = 'none' | 'green' | 'yellow' | 'red'

// Where the light turns yellow and red, in weighted tokens.
export const YELLOW_AT = 50_000
export const RED_AT = 200_000

// What one model response cost, in tokens as they are priced: reading from the
// cache a tenth, writing to it a quarter more, output five times, and the
// smaller models a fraction of the largest.
export function weigh(
  model: string,
  u: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number },
) {
  const factor = /haiku/i.test(model) ? 0.2 : /sonnet/i.test(model) ? 0.6 : 1
  return factor * (u.input_tokens + u.cache_creation_input_tokens * 1.25 + u.cache_read_input_tokens * 0.1 + u.output_tokens * 5)
}

export function levelOf(task: Task | null): Level {
  if (!task) return 'none'
  if (task.weighted >= RED_AT) return 'red'
  if (task.weighted >= YELLOW_AT) return 'yellow'
  return 'green'
}

export const LEVEL_COLOR: Record<Level, string> = {
  none: '#8F8F8A',
  green: '#7D9B63',
  yellow: '#D2A24C',
  red: '#C25A4A',
}

export const LIGHT_WIDTH = 38
export const LIGHT_HEIGHT = 16

// A small horizontal traffic light: red, yellow, green. The lit lamp pulses
// while the task runs and stays lit, softer, once it is done.
export function lightSvg(level: Level, isRunning: boolean) {
  const lamps: [Level, number][] = [
    ['red', 9],
    ['yellow', 19],
    ['green', 29],
  ]
  const off = '#4A4A46'
  const pulse = "<animate attributeName='opacity' values='1;0.45;1' dur='1.4s' repeatCount='indefinite'/>"
  const circles = lamps
    .map(([lamp, cx]) => {
      const isLit = lamp === level
      const fill = isLit ? LEVEL_COLOR[lamp] : off
      const opacity = isLit && !isRunning ? 0.7 : 1
      return `<circle cx='${cx}' cy='8' r='4' fill='${fill}' opacity='${opacity}'>${isLit && isRunning ? pulse : ''}</circle>`
    })
    .join('')
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${LIGHT_WIDTH}' height='${LIGHT_HEIGHT}' viewBox='0 0 ${LIGHT_WIDTH} ${LIGHT_HEIGHT}'>` +
    `<rect x='0.5' y='0.5' width='${LIGHT_WIDTH - 1}' height='${LIGHT_HEIGHT - 1}' rx='7.5' fill='#262624' stroke='#00000033'/>` +
    circles +
    '</svg>'
  )
}
