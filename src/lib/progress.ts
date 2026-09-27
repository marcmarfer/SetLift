import type { Exercise, Session, SetEntry } from '../types'
import { weekStart } from './dates'
import { repsOf } from './targets'

export interface Progression {
  carried: SetEntry[]
  raised: boolean
  uniform: boolean
  missing: number | null
  next: number | null
}

const addLoad = (weight: number | null, increment: number) => Math.round(((weight ?? 0) + increment) * 100) / 100

export function progression(sets: SetEntry[], increment: number): Progression {
  const done = sets.filter((set) => set.done).sort((a, b) => a.index - b.index)
  const ranged = done.filter(
    (set) => repsOf(set) === 'range' && set.targetRepsMax != null && set.reps != null,
  )
  const idle: Progression = { carried: done, raised: false, uniform: false, missing: null, next: null }
  if (ranged.length === 0) return idle

  const topped = (set: SetEntry) => (set.reps ?? 0) >= (set.targetRepsMax ?? 0)
  const uniform = new Set(ranged.map((set) => set.weight)).size === 1

  if (uniform) {
    if (done.length < sets.length) return { ...idle, uniform }
    const missing = ranged.reduce((total, set) => total + Math.max(0, (set.targetRepsMax ?? 0) - (set.reps ?? 0)), 0)
    const next = addLoad(ranged[0].weight, increment)
    const raised = missing === 0
    const carried = raised
      ? done.map((set) => (ranged.includes(set) ? { ...set, weight: next } : set))
      : done
    return { carried, raised, uniform, missing, next }
  }

  const carried = done.map((set) =>
    ranged.includes(set) && topped(set) ? { ...set, weight: addLoad(set.weight, increment) } : set,
  )
  return { carried, raised: carried.some((set, spot) => set !== done[spot]), uniform, missing: null, next: null }
}

export interface BestSet {
  weight: number
  reps: number
  sessionId: string
  date: string
}

export interface ExerciseTrend {
  exercise: Exercise
  best: BestSet
  previous: BestSet | null
  change: number
  unit: 'percent' | 'reps'
}

function bestOf(sets: SetEntry[], date: string, sessionId: string): BestSet | null {
  const done = sets.filter((set) => set.done && set.reps != null)
  if (done.length === 0) return null

  const best = done.reduce((a, b) => {
    const scoreA = (a.weight ?? 0) * 1000 + (a.reps ?? 0)
    const scoreB = (b.weight ?? 0) * 1000 + (b.reps ?? 0)
    return scoreB > scoreA ? b : a
  })

  return { weight: best.weight ?? 0, reps: best.reps ?? 0, sessionId, date }
}

export function estimateOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  if (reps <= 1) return weight
  return weight * (1 + reps / 30)
}

export function trends(
  exercises: Exercise[],
  sessions: Session[],
  sets: SetEntry[],
): ExerciseTrend[] {
  const dateOf = new Map(sessions.map((session) => [session.id, session.date]))
  const byExercise = new Map<string, Map<string, SetEntry[]>>()

  for (const set of sets) {
    if (!set.done) continue
    const bySession = byExercise.get(set.exerciseId) ?? new Map<string, SetEntry[]>()
    const list = bySession.get(set.sessionId) ?? []
    list.push(set)
    bySession.set(set.sessionId, list)
    byExercise.set(set.exerciseId, bySession)
  }

  const result: ExerciseTrend[] = []

  for (const [exerciseId, bySession] of byExercise) {
    const exercise = exercises.find((candidate) => candidate.id === exerciseId)
    if (!exercise) continue

    const sorted = [...bySession.entries()]
      .map(([sessionId, list]) => ({ sessionId, date: dateOf.get(sessionId) ?? '', list }))
      .filter((entry) => entry.date)
      .sort((a, b) => (a.date < b.date ? 1 : -1))

    const best = sorted[0] ? bestOf(sorted[0].list, sorted[0].date, sorted[0].sessionId) : null
    if (!best) continue

    const previous = sorted[1] ? bestOf(sorted[1].list, sorted[1].date, sorted[1].sessionId) : null
    const unit: ExerciseTrend['unit'] = exercise.bodyweight ? 'reps' : 'percent'

    let change = 0
    if (previous) {
      if (unit === 'reps') {
        change = best.reps - previous.reps
      } else {
        const before = estimateOneRepMax(previous.weight, previous.reps)
        const now = estimateOneRepMax(best.weight, best.reps)
        change = before > 0 ? ((now - before) / before) * 100 : 0
      }
    }

    result.push({ exercise, best, previous, change, unit })
  }

  return result.sort((a, b) => (a.best.date < b.best.date ? 1 : -1))
}

export function setsByMuscleGroup(
  exercises: Exercise[],
  sessions: Session[],
  sets: SetEntry[],
): Array<{ group: string; sets: number }> {
  const monday = weekStart()
  const thisWeek = new Set(sessions.filter((session) => session.date >= monday).map((s) => s.id))
  const groupOf = new Map(exercises.map((exercise) => [exercise.id, exercise.group]))
  const count = new Map<string, number>()

  for (const set of sets) {
    if (!set.done || !thisWeek.has(set.sessionId)) continue
    const group = groupOf.get(set.exerciseId)
    if (!group) continue
    count.set(group, (count.get(group) ?? 0) + 1)
  }

  return [...count.entries()]
    .map(([group, total]) => ({ group, sets: total }))
    .sort((a, b) => b.sets - a.sets)
}
