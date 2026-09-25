import { db, newId, plain } from '../db'
import type { Exercise } from '../types'

export const isMine = (exercise: Exercise | null | undefined, userId: string | null) =>
  Boolean(exercise?.ownerId && exercise.ownerId === userId)

export interface ExerciseDraft {
  name: string
  group: string
  bodyweight: boolean
}

export async function createExercise(draft: ExerciseDraft, ownerId: string) {
  const exercise: Exercise = {
    id: newId(),
    ownerId,
    name: draft.name.trim(),
    group: draft.group.trim(),
    bodyweight: draft.bodyweight,
    updatedAt: Date.now(),
  }
  await db.exercises.put(exercise)
  return exercise
}

export async function updateExercise(id: string, draft: ExerciseDraft) {
  await db.exercises.update(id, {
    name: draft.name.trim(),
    group: draft.group.trim(),
    bodyweight: draft.bodyweight,
    updatedAt: Date.now(),
  })
}

export async function duplicateExercise(source: Exercise, ownerId: string) {
  return createExercise(
    { name: `${source.name} (mío)`, group: source.group, bodyweight: source.bodyweight },
    ownerId,
  )
}

export interface ExerciseUsage {
  sets: number
  sessions: number
  routines: string[]
}

export async function usageOf(exerciseId: string): Promise<ExerciseUsage> {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray()
  const routines = (await db.routines.toArray())
    .filter((routine) => routine.exercises.some((item) => item.exerciseId === exerciseId))
    .map((routine) => routine.name)

  return {
    sets: sets.length,
    sessions: new Set(sets.map((set) => set.sessionId)).size,
    routines,
  }
}

async function detachFromRoutines(exerciseId: string, replacement?: string) {
  const routines = await db.routines.toArray()

  for (const routine of routines) {
    if (!routine.exercises.some((item) => item.exerciseId === exerciseId)) continue

    const exercises = replacement
      ? routine.exercises.map((item) =>
          item.exerciseId === exerciseId ? { ...item, exerciseId: replacement } : item,
        )
      : routine.exercises.filter((item) => item.exerciseId !== exerciseId)

    await db.routines.update(routine.id, { exercises: plain(exercises), updatedAt: Date.now() })
  }
}

export async function deleteExercise(exerciseId: string) {
  await detachFromRoutines(exerciseId)

  await db.transaction('rw', db.exercises, db.sets, db.exercisePreferences, async () => {
    await db.sets.where('exerciseId').equals(exerciseId).delete()
    await db.exercisePreferences.delete(exerciseId)
    await db.exercises.delete(exerciseId)
  })
}

export async function mergeExercise(sourceId: string, targetId: string) {
  const now = Date.now()

  await db.sets
    .where('exerciseId')
    .equals(sourceId)
    .modify((set) => {
      set.exerciseId = targetId
      set.updatedAt = now
    })

  await detachFromRoutines(sourceId, targetId)
  await db.exercisePreferences.delete(sourceId)
  await db.exercises.delete(sourceId)
}

export async function muscleGroups() {
  const all = await db.exercises.toArray()
  return [...new Set(all.map((exercise) => exercise.group).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
}
