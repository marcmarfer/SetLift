import { db, newId } from '../db'
import { addDays, sameWeek, today, weekStart } from './dates'
import { estimateOneRepMax } from './progress'
import { forgetDraft } from './draft'
import { entryTarget } from './targets'
import { startingWeight } from './bodyweight'
import { readBodyweightKg } from '../stores/settings'
import type { Routine, Session, SetEntry, SetTemplate } from '../types'

const now = () => Date.now()

async function datesOf(sessionIds: string[]) {
  const sessions = await db.sessions.bulkGet(sessionIds)
  return new Map(
    sessions.filter((session): session is Session => Boolean(session)).map((item) => [item.id, item.date]),
  )
}

export async function previousSession(exerciseId: string, excludeSessionId?: string, before?: string) {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray()
  const done = sets.filter((set) => set.done && set.sessionId !== excludeSessionId)
  if (done.length === 0) return []

  const dateOf = await datesOf([...new Set(done.map((set) => set.sessionId))])
  const ids = [...new Set(done.map((set) => set.sessionId))].filter(
    (id) => !before || (dateOf.get(id) ?? '') < before,
  )
  if (ids.length === 0) return []

  const lastId = [...ids].sort((a, b) => ((dateOf.get(a) ?? '') < (dateOf.get(b) ?? '') ? 1 : -1))[0]

  return done.filter((set) => set.sessionId === lastId).sort((a, b) => a.index - b.index)
}

export async function bestOneRepMax(exerciseId: string, excludeSessionId?: string, before?: string) {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray()
  const done = sets.filter((set) => set.done && set.sessionId !== excludeSessionId && set.reps)
  const dateOf = await datesOf([...new Set(done.map((set) => set.sessionId))])

  return done
    .filter((set) => !before || (dateOf.get(set.sessionId) ?? '') < before)
    .reduce((best, set) => Math.max(best, estimateOneRepMax(set.weight ?? 0, set.reps ?? 0)), 0)
}

function entryFrom(
  sessionId: string,
  exerciseId: string,
  template: SetTemplate,
  index: number,
  load: { weight: number | null; bodyweightKg?: number },
  slot: number,
): SetEntry {
  return {
    id: newId(),
    sessionId,
    exerciseId,
    slot,
    index,
    ...entryTarget(template),
    ...load,
    reps: null,
    done: false,
    doneAt: null,
    updatedAt: now(),
  }
}

async function usesBodyweight(exerciseId: string) {
  return Boolean((await db.exercises.get(exerciseId))?.bodyweight)
}

async function templateEntries(routine: Routine, sessionId: string, date: string) {
  const entries: SetEntry[] = []
  const bodyweightKg = readBodyweightKg()

  for (const [slot, exercise] of routine.exercises.entries()) {
    const previous = await previousSession(exercise.exerciseId, sessionId, date)
    const bodyweight = await usesBodyweight(exercise.exerciseId)

    exercise.sets.forEach((template, position) => {
      const before = previous[position] ?? previous[previous.length - 1]
      entries.push(
        entryFrom(
          sessionId,
          exercise.exerciseId,
          template,
          position + 1,
          startingWeight(bodyweight, bodyweightKg, before, template),
          slot,
        ),
      )
    })
  }

  return entries
}

export async function openWorkout(routine: Routine, planId: string | null, date = today()) {
  const existing = await db.sessions.where('date').equals(date).toArray()
  const match = existing.find((session) => session.routineId === routine.id && !session.skipped)

  if (match) {
    const written = await db.sets.where('sessionId').equals(match.id).count()
    if (written > 0) return match.id

    const entries = await templateEntries(routine, match.id, date)
    await db.transaction('rw', db.sessions, db.sets, async () => {
      await db.sessions.update(match.id, { freestyle: false, updatedAt: now() })
      await db.sets.bulkPut(entries)
    })

    forgetDraft(match.id)
    return match.id
  }

  const sessionId = newId()
  const entries = await templateEntries(routine, sessionId, date)

  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sessions.put({ id: sessionId, date, routineId: routine.id, planId, updatedAt: now() })
    await db.sets.bulkPut(entries)
  })

  return sessionId
}

export async function openFreeWorkout(date = today()) {
  const id = newId()
  await db.sessions.put({ id, date, routineId: null, planId: null, updatedAt: now() })
  return id
}

export async function openFreestyleWorkout(routineId: string, planId: string | null, date = today()) {
  const sheets = await db.sessions.where('date').equals(date).toArray()
  const existing = sheets.find((session) => session.routineId === routineId && !session.skipped)

  if (existing) {
    const sets = await db.sets.where('sessionId').equals(existing.id).toArray()
    const hasProgress = sets.some((set) => set.done)
    if (existing.freestyle && hasProgress) return existing.id

    await db.transaction('rw', db.sessions, db.sets, async () => {
      await db.sets.where('sessionId').equals(existing.id).delete()
      await db.sessions.update(existing.id, { freestyle: true, updatedAt: now() })
    })

    forgetDraft(existing.id)
    return existing.id
  }

  const id = newId()
  await db.sessions.put({ id, date, routineId, planId, freestyle: true, updatedAt: now() })
  return id
}

export function sheetName(
  session: { routineId: string | null; freestyle?: boolean; name?: string },
  routineName: string | null | undefined,
) {
  if (!session.routineId) return session.name?.trim() || 'Entreno extra'
  const name = routineName ?? 'Entreno'
  return session.freestyle ? `${name} (a mi aire)` : name
}

export async function exerciseEntries(sessionId: string, exerciseId: string, slot: number, before?: string) {
  const previous = await previousSession(exerciseId, sessionId, before)
  const bodyweight = await usesBodyweight(exerciseId)
  const bodyweightKg = readBodyweightKg()

  const templates: SetTemplate[] = previous.length
    ? previous.map((set) => ({
        type: set.type,
        reps: set.targetReps,
        repsMin: set.targetRepsMin,
        repsMax: set.targetRepsMax,
        rirMin: set.targetRirMin,
        rirMax: set.targetRirMax,
        weight: set.weight ?? 0,
      }))
    : Array.from({ length: 3 }, () => ({ type: 'range' as const, repsMin: 8, repsMax: 12, weight: 0 }))

  return templates.map((template, position) =>
    entryFrom(
      sessionId,
      exerciseId,
      template,
      position + 1,
      startingWeight(bodyweight, bodyweightKg, previous[position], template),
      slot,
    ),
  )
}

export async function deferDate(planId: string | null, from = today()) {
  const previous = addDays(from, -1)
  if (!planId) return previous

  const plan = await db.plans.get(planId)
  if (plan?.mode === 'weekly' && !sameWeek(previous, from)) return from
  return previous
}

export async function markLater(routine: Routine, planId: string | null, date?: string) {
  const slot = date ?? await deferDate(planId)
  const opened = await sessionOn(today(), routine.id)
  if (opened && opened.date !== slot) await moveSession(opened.id, slot)

  const id = opened?.id ?? await openWorkout(routine, planId, slot)
  await db.sessions.update(id, { later: true, updatedAt: now() })
  return id
}

export async function parkDeferredFromToday() {
  const sessions = (await db.sessions.toArray()).filter(
    (session) => session.date === today() && (session.later || session.skipped),
  )

  for (const session of sessions) {
    const slot = await deferDate(session.planId)
    if (slot !== session.date) await moveSession(session.id, slot)
  }
}

export async function expireWeeklyLaterSessions(reference = today()) {
  const plans = await db.plans.toArray()
  const weeklyPlanIds = new Set(plans.filter((plan) => plan.mode === 'weekly').map((plan) => plan.id))
  const start = weekStart(reference)
  const expired = (await db.sessions.toArray()).filter(
    (session) =>
      session.later &&
      !session.skipped &&
      session.date < start &&
      session.planId !== null &&
      weeklyPlanIds.has(session.planId),
  )

  if (expired.length === 0) return

  await db.sessions.bulkPut(
    expired.map((session) => ({
      ...session,
      later: false,
      skipped: true,
      updatedAt: now(),
    })),
  )
}

export async function skipRoutine(routineId: string, planId: string | null, date?: string) {
  const id = newId()
  await db.sessions.put({
    id,
    date: date ?? await deferDate(planId),
    routineId,
    planId,
    skipped: true,
    updatedAt: now(),
  })
  return id
}

export async function moveSession(sessionId: string, date: string) {
  await db.sessions.update(sessionId, { date, updatedAt: now() })
}

export async function sessionOn(date: string, routineId: string | null) {
  const sheets = await db.sessions.where('date').equals(date).toArray()
  return sheets.find((session) => session.routineId === routineId && !session.skipped) ?? null
}

export async function removeSession(sessionId: string) {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets.where('sessionId').equals(sessionId).delete()
    await db.sessions.delete(sessionId)
  })
}
