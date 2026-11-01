const dateFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

/** "Heute, 14:20", "Gestern" oder "3. Nov. 2026". */
export function formatRelativeDate(value: string | null, withTime = true): string {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  if (sameDay(date, now)) return withTime ? `Heute, ${timeFormat.format(date)}` : 'Heute'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(date, yesterday)) return 'Gestern'
  return dateFormat.format(date)
}

/** Nur http(s): So kann ein gespeicherter Link kein Skript ausfuehren (javascript:...). */
export function isSafeUrl(value: string | null | undefined): boolean {
  if (!value) return false
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}
