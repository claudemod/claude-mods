import type { DetailLine, Lang } from '../types'

// Turns any tool call into a row: nothing here assumes which tools an agent
// has. Known tools get a tidy label and detail, every other one (an MCP tool, a
// plugin's) still shows its name, its first text argument and its answer.

const MAX_LINE = 160
const MAX_SIDE = 5
const MAX_OUTPUT = 8
const RESERVED = new Set(['tool', 'tool_use_id', 'consent', 'agentId'])

type Input = Record<string, unknown>

const text = (value: unknown) => (typeof value === 'string' ? value : '')

export function cleanLine(line: string) {
  return line
    .replace(/\t/g, '  ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .slice(0, MAX_LINE)
}

export function shortPath(path: string) {
  return path.split('/').filter(Boolean).slice(-2).join('/') || path
}

function hostOf(url: string) {
  return /^[a-z]+:\/\/([^/]+)/i.exec(url)?.[1] ?? url
}

function firstText(input: Input) {
  for (const [key, value] of Object.entries(input)) {
    if (!RESERVED.has(key) && typeof value === 'string' && value.trim() !== '') return value
  }
  return ''
}

export function labelOf(input: Input): { name: string; arg: string } {
  const tool = text(input.tool)
  const firstLine = (value: string) => cleanLine(value.split('\n')[0] ?? '')
  switch (tool) {
    case 'Read':
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
      return { name: tool, arg: shortPath(text(input.file_path)) }
    case 'NotebookEdit':
      return { name: tool, arg: shortPath(text(input.notebook_path)) }
    case 'Bash':
      return { name: tool, arg: firstLine(text(input.command)) }
    case 'Grep': {
      const where = text(input.path)
      return { name: tool, arg: `"${firstLine(text(input.pattern))}"${where ? ` ${shortPath(where)}` : ''}` }
    }
    case 'Glob':
      return { name: tool, arg: firstLine(text(input.pattern)) }
    case 'WebFetch':
      return { name: tool, arg: hostOf(text(input.url)) }
    case 'WebSearch':
      return { name: tool, arg: firstLine(text(input.query)) }
    default: {
      const mcp = /^mcp__(.+?)__(.+)$/.exec(tool)
      return { name: mcp?.[2] ?? tool, arg: firstLine(firstText(input)) }
    }
  }
}

function capped(lines: string[], tone: DetailLine['tone'], limit: number, prefix: string): DetailLine[] {
  const shown = lines.slice(0, limit).map(line => ({ text: cleanLine(prefix + line), tone }))
  if (lines.length > limit) shown.push({ text: `… +${lines.length - limit}`, tone: 'dim' })
  return shown
}

function diffOf(oldText: string, newText: string): DetailLine[] {
  return [
    ...(oldText === '' ? [] : capped(oldText.split('\n'), 'del', MAX_SIDE, '- ')),
    ...(newText === '' ? [] : capped(newText.split('\n'), 'add', MAX_SIDE, '+ ')),
  ]
}

// What is known before the tool has run.
export function detailBefore(input: Input): DetailLine[] {
  switch (text(input.tool)) {
    case 'Edit':
      return diffOf(text(input.old_string), text(input.new_string))
    case 'MultiEdit': {
      const edits = Array.isArray(input.edits) ? (input.edits as Input[]) : []
      return edits.slice(0, 2).flatMap(edit => diffOf(text(edit.old_string), text(edit.new_string)))
    }
    case 'Write':
      return capped(text(input.content).split('\n'), 'add', MAX_OUTPUT, '+ ')
    case 'Bash':
      return [{ text: cleanLine(`$ ${text(input.command).split('\n')[0] ?? ''}`), tone: 'dim' }]
    default:
      return []
  }
}

function outputLines(body: string, tool: string) {
  const lines = body.split('\n').filter(line => line.trim() !== '')
  // Read answers with line numbers in front; the row needs only the text.
  return tool === 'Read' ? lines.map(line => line.replace(/^\s*\d+[→\t]/, '')) : lines
}

// What the tool answered, added to the detail once it has run.
export function detailAfter(tool: string, result: { text?: string; deny?: string; isError?: boolean }): DetailLine[] {
  if (result.deny !== undefined) return capped(outputLines(result.deny, tool), 'del', MAX_OUTPUT, '')
  const body = result.text ?? ''
  if (result.isError) return capped(outputLines(body, tool), 'del', MAX_OUTPUT, '')
  // An edit's answer only says it worked: the diff already shows what changed.
  if (/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(tool)) return []
  const lines = outputLines(body, tool)
  if (tool === 'Bash' && lines.length > MAX_OUTPUT) {
    return [{ text: `… +${lines.length - MAX_OUTPUT}`, tone: 'dim' }, ...lines.slice(-MAX_OUTPUT).map(line => ({ text: cleanLine(line) }))]
  }
  return capped(lines, undefined, MAX_OUTPUT, '')
}

// A finished agent's line, e.g. "Read 14 files · 3 searches": the two kinds of
// work it did most, from the tools it actually called.
const KINDS: { tools: RegExp; en: (n: number) => string; de: (n: number) => string }[] = [
  { tools: /^(Read|NotebookRead)$/, en: n => `Read ${n} file${n === 1 ? '' : 's'}`, de: n => `${n} Datei${n === 1 ? '' : 'en'} gelesen` },
  { tools: /^(Edit|MultiEdit|Write|NotebookEdit)$/, en: n => `${n} edit${n === 1 ? '' : 's'}`, de: n => `${n} Änderung${n === 1 ? '' : 'en'}` },
  { tools: /^(Bash|PowerShell)$/, en: n => `${n} command${n === 1 ? '' : 's'}`, de: n => `${n} Befehl${n === 1 ? '' : 'e'}` },
  { tools: /^(Grep|Glob|WebSearch|ToolSearch)$/, en: n => `${n} search${n === 1 ? '' : 'es'}`, de: n => `${n} Suche${n === 1 ? '' : 'n'}` },
  { tools: /^WebFetch$/, en: n => `${n} page${n === 1 ? '' : 's'}`, de: n => `${n} Seite${n === 1 ? '' : 'n'}` },
]

export function summaryOf(counts: Record<string, number>, lang: Lang) {
  return KINDS.map(kind => ({
    kind,
    n: Object.entries(counts).reduce((sum, [tool, n]) => (kind.tools.test(tool) ? sum + n : sum), 0),
  }))
    .filter(entry => entry.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 2)
    .map(entry => entry.kind[lang](entry.n))
    .join(' · ')
}
