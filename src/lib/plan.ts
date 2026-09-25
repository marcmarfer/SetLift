import type { Plan, Routine, Session } from '../types'
import { addDays, sameWeek, today, weekStart } from './dates'

export interface SheetProgress {
  done: number
  total: number
  lastDoneAt?: number
}

export interface RoutineStatus {
  routineId: string
  name: string
  done: boolean
  started: boolean
  due: boolean
  skipped: boolean
  free: boolean
  freestyle: boolean
  later: boolean
  count: number
  progress: SheetProgress | null
  sessionId: string | null
  lastDate: string | null
}

function nameFor(
  routineId: string,
  routines: Routine[],
  session: Session | null,
  due: string | null,
  progress: Record<string, SheetProgress>,
  count = session ? 1 : 0,
): RoutineStatus {
  const name = routines.find((routine) => routine.id === routineId)?.name ?? '—'

  return {
    routineId,
    name,
    due: routineId === due,
    free: false,
    count,
    ...statusOf(session, progress),
  }
}

export function hasTraining(session: Session, progress: Record<string, SheetProgress>) {
  return !session.skipped && (progress[session.id]?.done ?? 0) > 0
}

function counts(session: Session | null | undefined, progress: Record<string, SheetProgress>) {
  if (!session) return false
  if (session.skipped) return true
  if (session.later && (progress[session.id]?.done ?? 0) === 0) return true
  return (progress[session.id]?.done ?? 0) > 0
}

function laterThan(a: Session, b: Session) {
  return a.date === b.date ? a.updatedAt >= b.updatedAt : a.date > b.date
}

function latestByRoutine(
  sessions: Session[],
  progress: Record<string, SheetProgress>,
  matches: (session: Session) => boolean,
) {
  const latest = new Map<string, Session>()

  for (const session of sessions) {
    if (!session.routineId || !matches(session)) continue
    const current = latest.get(session.routineId)
    if (!current || laterThan(session, current)) latest.set(session.routineId, session)
  }

  return new Set(
    [...latest.entries()]
      .filter(([, session]) => counts(session, progress))
      .map(([id]) => id),
  )
}

interface Cycle {
  routines: Map<string, Session>
}

function rotationCycles(
  plan: Plan,
  sessions: Session[],
  progress: Record<string, SheetProgress>,
): Cycle[] {
  const order = plan.routineIds
  const ordered = sessions
    .filter((item) => item.routineId && order.includes(item.routineId) && counts(item, progress))
    .sort((a, b) => (a.date === b.date ? a.updatedAt - b.updatedAt : a.date < b.date ? -1 : 1))

  const cycles: Cycle[] = []
  let current: Cycle = { routines: new Map() }

  for (const session of ordered) {
    if (current.routines.has(session.routineId as string) || current.routines.size === order.length) {
      cycles.push(current)
      current = { routines: new Map() }
    }
    current.routines.set(session.routineId as string, session)
  }

  cycles.push(current)

  const closedToday = [...current.routines.values()].some(
    (session) => session.date === today() && !session.skipped,
  )
  if (current.routines.size === order.length && !closedToday) {
    cycles.push({ routines: new Map() })
  }

  return cycles
}

export function dueRoutine(
  plan: Plan,
  sessions: Session[],
  progress: Record<string, SheetProgress> = {},
): string | null {
  const order = plan.routineIds
  if (order.length === 0) return null

  if (plan.mode === 'weekly') {
    const taken = latestByRoutine(sessions, progress, (session) => sameWeek(session.date))
    return order.find((id) => !taken.has(id)) ?? null
  }

  const cycles = rotationCycles(plan, sessions, progress)
  const cycle = cycles[cycles.length - 1]

  return order.find((id) => !cycle?.routines.has(id)) ?? order[0]
}

export function pendingRoutines(
  plan: Plan,
  sessions: Session[],
  progress: Record<string, SheetProgress>,
  date: string,
): string[] {
  if (plan.mode === 'weekly') {
    const taken = latestByRoutine(sessions, progress, (session) => sameWeek(session.date, date))
    return plan.routineIds.filter((id) => !taken.has(id))
  }

  const cycles = rotationCycles(plan, sessions, progress)
  let chosen = cycles[cycles.length - 1] ?? { routines: new Map<string, Session>() }

  for (const cycle of cycles) {
    const dates = [...cycle.routines.values()].map((session) => session.date).sort()
    if (dates.length === 0) continue
    if (date < dates[0]) {
      chosen = cycle
      break
    }
    if (date <= dates[dates.length - 1]) {
      chosen = cycle
      break
    }
    chosen = cycle
  }

  return plan.routineIds.filter((id) => !chosen.routines.has(id))
}

function withoutStaleDue(statuses: RoutineStatus[]): RoutineStatus[] {
  const busy = statuses.some((status) => status.started)

  return statuses.map((status) => ({
    ...status,
    due: status.due && !busy && !status.done && !status.skipped,
  }))
}

function statusOf(session: Session | null, progress: Record<string, SheetProgress>) {
  const sheet = session && !session.skipped ? progress[session.id] ?? null : null
  const done = Boolean(sheet && sheet.total > 0 && sheet.done === sheet.total)
  const open = Boolean(sheet && sheet.done > 0)

  return {
    done,
    started: open && !done,
    skipped: session?.skipped === true,
    freestyle: session?.freestyle === true,
    later: session?.later === true && (sheet?.done ?? 0) === 0,
    progress: sheet,
    sessionId: session?.id ?? null,
    lastDate: session?.date ?? null,
  }
}

export function planWeek(
  plan: Plan,
  routines: Routine[],
  sessions: Session[],
  progress: Record<string, SheetProgress> = {},
  weeksBack = 0,
): RoutineStatus[] {
  const from = addDays(weekStart(), -7 * weeksBack)
  const until = weeksBack > 0 ? addDays(from, 7) : null
  const latest = new Map<string, Session>()
  const repeats = new Map<string, number>()

  const inWeek = sessions.filter(
    (item) =>
      item.routineId &&
      plan.routineIds.includes(item.routineId) &&
      item.date >= from &&
      (until === null || item.date < until),
  )

  const ordered = inWeek.sort((a, b) =>
    a.date === b.date ? a.updatedAt - b.updatedAt : a.date < b.date ? -1 : 1,
  )

  for (const session of ordered) {
    const routineId = session.routineId as string
    const real = hasTraining(session, progress)

    latest.set(routineId, session)
    if (real) repeats.set(routineId, (repeats.get(routineId) ?? 0) + 1)
  }

  const due = weeksBack === 0 ? dueRoutine(plan, sessions, progress) : null

  return withoutStaleDue(
    plan.routineIds.map((id) =>
      nameFor(id, routines, latest.get(id) ?? null, due, progress, repeats.get(id) ?? 0),
    ),
  )
}

export function planRotation(
  plan: Plan,
  routines: Routine[],
  sessions: Session[],
  progress: Record<string, SheetProgress> = {},
  back = 0,
): RoutineStatus[] {
  const cycles = rotationCycles(plan, sessions, progress)
  const cycle = cycles[cycles.length - 1 - back] ?? { routines: new Map<string, Session>() }
  const due = back === 0 ? dueRoutine(plan, sessions, progress) : null

  return withoutStaleDue(
    plan.routineIds.map((id) => nameFor(id, routines, cycle.routines.get(id) ?? null, due, progress)),
  )
}

export function sessionVolume(
  sets: Array<{ weight: number | null; reps: number | null; done: boolean }>,
): number {
  return sets.reduce((total, set) => {
    if (!set.done || set.weight == null || set.reps == null) return total
    return total + set.weight * set.reps
  }, 0)
}
