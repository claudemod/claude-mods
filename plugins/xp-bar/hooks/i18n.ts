// The mod's words in German and English, and how each language writes its
// numbers, times and days. Every date is formatted in the person's own time
// zone, which the module runs in.
export type Lang = 'de' | 'en'

export function languageOf(tag: string): Lang {
  return tag.toLowerCase().startsWith('de') ? 'de' : 'en'
}

const CLOCK = {
  de: new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }),
  en: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }),
}
const DAY = {
  de: new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }),
  en: new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
}
const DATE = {
  de: new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }),
  en: new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric' }),
}

// The pixel font has a plain space only; ICU puts narrow and no-break ones in times.
function plainSpaces(text: string) {
  return text.replace(/[  ]/g, ' ')
}

// "19:00", or "7 PM" and "7:30 PM"
function clock(lang: Lang, ms: number) {
  const text = plainSpaces(CLOCK[lang].format(ms))
  return lang === 'en' ? text.replace(':00 ', ' ') : text
}

function isSameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// When something happens, from now: "um 19:00", "morgen 01:30", "Fr. 06.11. 11:00";
// "at 7 PM", "tomorrow 1:30 AM", "Fri 11/6, 11 AM".
function when(lang: Lang, atMs: number, nowMs: number) {
  const tomorrow = new Date(nowMs)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const time = clock(lang, atMs)

  if (isSameDay(atMs, nowMs)) return `${lang === 'de' ? 'um' : 'at'} ${time}`
  if (isSameDay(atMs, tomorrow.getTime())) return `${lang === 'de' ? 'morgen' : 'tomorrow'} ${time}`
  const day = plainSpaces(DAY[lang].format(atMs)).replace(',', '')
  return lang === 'de' ? `${day} ${time}` : `${day}, ${time}`
}

// "2h 13m", "13m", and "3T 4h" or "3d 4h"
function duration(lang: Lang, ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return `${days}${lang === 'de' ? 'T' : 'd'} ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

// "37,5 %" or "37.5%"
function percent(lang: Lang, p: number) {
  const rounded = Math.round(p * 10) / 10
  return lang === 'de' ? `${String(rounded).replace('.', ',')} %` : `${rounded}%`
}

// "12,4" or "12.4": limits' worth, to a tenth
function times(lang: Lang, n: number) {
  const text = (Math.round(n * 10) / 10).toFixed(1)
  return lang === 'de' ? text.replace('.', ',') : text
}

// "6,3 Mio.", "845 Tsd." or "6.3M", "845K"
function amount(lang: Lang, n: number) {
  const units = lang === 'de' ? [' Mrd.', ' Mio.', ' Tsd.'] : ['B', 'M', 'K']
  const fixed = (x: number, digits: number) => {
    const text = x.toFixed(digits)
    return lang === 'de' ? text.replace('.', ',') : text
  }
  if (n >= 1e9) return `${fixed(n / 1e9, n >= 1e10 ? 0 : 1)}${units[0]}`
  if (n >= 1e6) return `${fixed(n / 1e6, n >= 1e7 ? 0 : 1)}${units[1]}`
  if (n >= 1e3) return `${fixed(n / 1e3, 0)}${units[2]}`
  return String(Math.round(n))
}

const WINDOWS: Record<Lang, Record<string, string>> = {
  de: { five_hour: 'Sitzung', seven_day: 'Woche', spend_limit: 'Budget' },
  en: { five_hour: 'Session', seven_day: 'Week', spend_limit: 'Budget' },
}

export function wordsFor(lang: Lang) {
  const de = lang === 'de'
  return {
    title: de ? 'Nutzungslimit' : 'Usage limit',
    window: (kind: string, used: number) => `${WINDOWS[lang][kind] ?? kind} ${percent(lang, used)}`,
    tokensLeft: (n: number) => (de ? `≈ ${amount(lang, n)} Tokens übrig` : `≈ ${amount(lang, n)} tokens left`),
    measuringTokens: de ? 'Tokens werden gemessen' : 'Measuring tokens',
    full: (atMs: number, nowMs: number) => `${de ? 'Voll' : 'Full'} ${when(lang, atMs, nowMs)}`,
    countdown: (ms: number) => `(in ${duration(lang, ms)})`,
    fullLimit: de ? 'Volles Limit verfügbar' : 'Full limit available',
    pace: de ? 'Bei deinem Tempo:' : 'At your pace:',
    weekLasts: de ? 'Woche reicht bis zum Reset' : 'Week lasts until the reset',
    weekFull: (atMs: number, nowMs: number) => `${de ? 'Woche voll' : 'Week full'} ${when(lang, atMs, nowMs)}`,
    measuringPace: de ? 'Woche: Tempo wird gemessen' : 'Week: measuring pace',
    chatTokens: (n: number) => (de ? `${amount(lang, n)} Tokens in diesem Chat` : `${amount(lang, n)} tokens in this chat`),
    firstAnswer: de ? 'Kommt mit der ersten Antwort' : 'Shows after the first answer',
    totalSince: (ms: number) => `${de ? 'Insgesamt seit' : 'Total since'} ${plainSpaces(DATE[lang].format(ms))}:`,
    totalLimits: (session: number, week: number) =>
      de
        ? `${times(lang, session)}× Sitzung · ${times(lang, week)}× Woche`
        : `${times(lang, session)}× session · ${times(lang, week)}× week`,
    totalTokens: (n: number) => (de ? `${amount(lang, n)} Tokens in allen Chats` : `${amount(lang, n)} tokens in all chats`),
    barFirstAnswer: de ? 'XP-Leiste erscheint nach der ersten Antwort' : 'XP bar shows after the first answer',
  }
}

export type Words = ReturnType<typeof wordsFor>
