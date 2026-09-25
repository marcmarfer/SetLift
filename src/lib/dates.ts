const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function toIso(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromIso(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function today(): string {
  return toIso()
}

export function addDays(value: string, days: number): string {
  const date = fromIso(value)
  date.setDate(date.getDate() + days)
  return toIso(date)
}

export function weekStart(value: string = today()): string {
  const date = fromIso(value)
  const weekday = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - weekday)
  return toIso(date)
}

export function sameWeek(a: string, b: string = today()): boolean {
  return weekStart(a) === weekStart(b)
}

export function daysSince(value: string, reference: string = today()): number {
  return Math.round((fromIso(reference).getTime() - fromIso(value).getTime()) / 86400000)
}

export function timeAgo(value: string): string {
  const days = daysSince(value)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`

  const weeks = Math.floor(days / 7)
  if (weeks === 1) return 'hace 1 semana'
  if (weeks < 5) return `hace ${weeks} semanas`

  const months = Math.floor(days / 30)
  return months === 1 ? 'hace 1 mes' : `hace ${months} meses`
}

export function shortDay(value: string): string {
  const date = fromIso(value)
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()}`
}

export function tinyDay(value: string): string {
  const date = fromIso(value)
  return `${DAY_NAMES[date.getDay()].slice(0, 3)} ${date.getDate()}`
}

export function longDay(value: string): string {
  const date = fromIso(value)
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`
}

export function monthName(value: string): string {
  return MONTH_NAMES[fromIso(value).getMonth()]
}

export function shortDate(value: string): string {
  const date = fromIso(value)
  const month = MONTH_NAMES[date.getMonth()].slice(0, 3)
  return date.getFullYear() === new Date().getFullYear()
    ? `${date.getDate()} ${month}`
    : `${month} ${date.getFullYear()}`
}

export function headerDate(value: string = today()): string {
  const date = fromIso(value)
  const day = DAY_NAMES[date.getDay()]
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`
}
