import { db } from '../db'
import type { ExercisePreference } from '../types'

const now = () => Date.now()

export async function preferencesById(): Promise<Record<string, ExercisePreference>> {
  const all = await db.exercisePreferences.toArray()
  return Object.fromEntries(all.map((item) => [item.id, item]))
}

export async function toggleFavorite(exerciseId: string) {
  const current = await db.exercisePreferences.get(exerciseId)
  await db.exercisePreferences.put({
    ...current,
    id: exerciseId,
    favorite: !current?.favorite,
    updatedAt: now(),
  })
}

export async function saveManualOneRepMax(exerciseId: string, weight: number, date: string) {
  const current = await db.exercisePreferences.get(exerciseId)
  await db.exercisePreferences.put({
    ...current,
    id: exerciseId,
    manualOneRepMaxKg: weight,
    manualOneRepMaxDate: date,
    updatedAt: now(),
  })
}

export async function clearManualOneRepMax(exerciseId: string) {
  const current = await db.exercisePreferences.get(exerciseId)
  if (!current) return
  await db.exercisePreferences.put({
    ...current,
    id: exerciseId,
    manualOneRepMaxKg: undefined,
    manualOneRepMaxDate: undefined,
    updatedAt: now(),
  })
}
