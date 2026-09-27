import { db, newId, plain } from '../db'
import type { ExercisePlanning, PlannedSets, Routine, RoutineExercise, Session, SetEntry } from '../types'

export const bySession = (exercise: RoutineExercise) => exercise.planning === 'sessions'

function aliveIds(sessions: Session[]) {
  return new Set(sessions.filter((session) => !session.skipped).map((session) => session.id))
}

export function openPlans(exercise: RoutineExercise, sessions: Session[]): PlannedSets[] {
  if (!bySession(exercise)) return []
  const alive = aliveIds(sessions)
  return (exercise.upcoming ?? []).filter((plan) => !plan.usedBy || !alive.has(plan.usedBy))
}

function lastDone(exercise: RoutineExercise, sessions: Session[]): PlannedSets | undefined {
  const alive = aliveIds(sessions)
  return (exercise.upcoming ?? []).filter((plan) => plan.usedBy && alive.has(plan.usedBy)).pop()
}

function withPlan(exercise: RoutineExercise, plan: PlannedSets | undefined): RoutineExercise {
  return plan ? { ...exercise, sets: plan.sets, technique: plan.technique } : exercise
}

function upcomingFor(exercise: RoutineExercise, sessions: Session[]) {
  if (!bySession(exercise)) return undefined
  return openPlans(exercise, sessions)[0] ?? lastDone(exercise, sessions)
}

export function nextExercises(routine: Routine, sessions: Session[]): RoutineExercise[] {
  return routine.exercises.map((exercise) => withPlan(exercise, upcomingFor(exercise, sessions)))
}

export function blueprintOf(routine: Routine, sessions: Session[], sessionId: string): RoutineExercise[] {
  return routine.exercises.map((exercise) =>
    withPlan(
      exercise,
      exercise.upcoming?.find((plan) => plan.usedBy === sessionId) ?? upcomingFor(exercise, sessions),
    ),
  )
}

export function preparedCount(routine: Routine, sessions: Session[]) {
  return routine.exercises.reduce((total, exercise) => total + openPlans(exercise, sessions).length, 0)
}

export function unplanned(routine: Routine, sessions: Session[]) {
  return routine.exercises.filter((exercise) => bySession(exercise) && openPlans(exercise, sessions).length === 0)
}

export function findPlan(routine: Routine, planId: string) {
  for (const [index, exercise] of routine.exercises.entries()) {
    const plan = exercise.upcoming?.find((item) => item.id === planId)
    if (plan) return { index, exercise, plan }
  }
  return null
}

export async function routineSessions(routineId: string) {
  return db.sessions.where('routineId').equals(routineId).toArray()
}

async function saveExercises(routine: Routine, exercises: RoutineExercise[]) {
  await db.routines.update(routine.id, { exercises: plain(exercises), updatedAt: Date.now() })
}

export async function spendUpcoming(session: Session, sets: SetEntry[]) {
  if (!session.routineId || session.freestyle) return

  const routine = await db.routines.get(session.routineId)
  if (!routine?.exercises.some((exercise) => bySession(exercise) && exercise.upcoming?.length)) return

  const sessions = await routineSessions(routine.id)
  const trained = new Set(sets.filter((set) => set.done).map((set) => set.slot))
  let spent = false

  const exercises = routine.exercises.map((exercise, slot) => {
    if (!exercise.upcoming?.length || !trained.has(slot)) return exercise
    if (exercise.upcoming.some((plan) => plan.usedBy === session.id)) return exercise

    const plan = openPlans(exercise, sessions)[0]
    if (!plan) return exercise

    spent = true
    return {
      ...exercise,
      upcoming: exercise.upcoming.map((item) => (item.id === plan.id ? { ...item, usedBy: session.id } : item)),
    }
  })

  if (spent) await saveExercises(routine, exercises)
}

function freshPlan(exercise: RoutineExercise, sessions: Session[]): PlannedSets {
  const open = openPlans(exercise, sessions)
  const source = open[open.length - 1] ?? lastDone(exercise, sessions) ?? exercise
  return { id: newId(), sets: plain(source.sets), technique: source.technique }
}

export async function preparePlan(routine: Routine, index: number, sessions: Session[]) {
  const exercise = routine.exercises[index]
  if (!exercise) return null

  const plan = freshPlan(exercise, sessions)
  const exercises = routine.exercises.map((item, spot) =>
    spot === index ? { ...item, upcoming: [...(item.upcoming ?? []), plan] } : item,
  )
  await saveExercises(routine, exercises)
  return plan.id
}

export async function setPlanning(routine: Routine, index: number, planning: ExercisePlanning, sessions: Session[]) {
  const exercise = routine.exercises[index]
  if (!exercise || (exercise.planning ?? 'fixed') === planning) return

  let changed: RoutineExercise
  if (planning === 'sessions') {
    const armed = { ...exercise, planning }
    changed = openPlans(armed, sessions).length
      ? armed
      : { ...armed, upcoming: [...(exercise.upcoming ?? []), freshPlan(exercise, [])] }
  } else {
    changed = { ...withPlan(exercise, upcomingFor(exercise, sessions)), planning }
  }

  await saveExercises(routine, routine.exercises.map((item, spot) => (spot === index ? changed : item)))
}

export async function dropPlan(routine: Routine, planId: string) {
  const exercises = routine.exercises.map((exercise) =>
    exercise.upcoming?.some((plan) => plan.id === planId)
      ? { ...exercise, upcoming: exercise.upcoming.filter((plan) => plan.id !== planId) }
      : exercise,
  )
  await saveExercises(routine, exercises)
}
