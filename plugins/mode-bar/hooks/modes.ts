import type { Effort, Mode } from '../types'

const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

// The icon a built-in mode shows when its file names none.
const ICONS: Record<string, string> = {
  eco: '🌱',
  quick: '⚡',
  brief: '✂️',
  normal: '💬',
  plan: '🗺️',
  review: '🔍',
  explain: '💡',
  debug: '🐞',
  test: '🧪',
  deep: '🧠',
}

// A mode's icon: the file's, else the built-in one, else its label's first letter.
export function iconOf(id: string, label: string, given?: string): string {
  return given || ICONS[id] || (label.trim()[0] ?? '?').toUpperCase()
}

// A mode file: a header between two `---` lines (`key: value`, one per line)
// and the note for the model after it. The file's name without its number and
// `.md` is the mode's id: `01-eco.md` is `eco`, and the number sets the order.
export function parseMode(fileName: string, source: string): Mode | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source)
  if (!match) return null

  const [, head = '', body = ''] = match
  const header: Record<string, string> = {}
  for (const line of head.split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at < 0) continue
    header[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^"(.*)"$/, '$1')
  }

  const id = fileName.replace(/\.md$/i, '').replace(/^\d+[-_ ]*/, '').toLowerCase()
  const label = header.label || id
  const hint = header.hint ?? ''
  const effort = EFFORTS.find(level => level === header.effort)

  return {
    id,
    label: { en: label, de: header.label_de || label },
    hint: { en: hint, de: header.hint_de || hint },
    color: header.color && /^#[0-9a-f]{3,8}$/i.test(header.color) ? header.color : '#8F8F8A',
    icon: iconOf(id, label, header.icon),
    ...(header.model ? { model: header.model } : {}),
    ...(effort ? { effort } : {}),
    block: (header.block ?? '')
      .split(',')
      .map(tool => tool.trim())
      .filter(Boolean),
    text: body.trim(),
  }
}

export const NORMAL = 'normal'

// The mode a session starts in: Normal when there is one, else the first.
export function startMode(modes: readonly Mode[]): string {
  return modes.some(m => m.id === NORMAL) ? NORMAL : (modes[0]?.id ?? NORMAL)
}
