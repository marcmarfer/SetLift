import { db, withoutTombstones } from '../db'
import type { SyncTable, Tombstone } from '../types'

const DRAFT_PREFIX = 'setlift:draft:'

function forgetDrafts() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(DRAFT_PREFIX)) localStorage.removeItem(key)
    }
  } catch {}
}

export async function clearDevice() {
  await withoutTombstones(() =>
    db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((table) => table.clear()))
    }),
  )
  forgetDrafts()
}

export async function deleteAllTraining() {
  const deletedAt = Date.now()

  await db.transaction(
    'rw',
    [db.sets, db.sessions, db.plans, db.routines, db.exercisePreferences, db.exercises, db.tombstones],
    async () => {
      const ownExercises = await db.exercises.filter((exercise) => Boolean(exercise.ownerId)).primaryKeys()

      const targets: Array<[SyncTable, string[]]> = [
        ['sets', await db.sets.toCollection().primaryKeys()],
        ['sessions', await db.sessions.toCollection().primaryKeys()],
        ['plans', await db.plans.toCollection().primaryKeys()],
        ['routines', await db.routines.toCollection().primaryKeys()],
        ['exercisePreferences', await db.exercisePreferences.toCollection().primaryKeys()],
        ['exercises', ownExercises],
      ]

      const stones: Tombstone[] = targets.flatMap(([table, ids]) =>
        ids.map((rowId) => ({ id: `${table}:${rowId}`, table, rowId, deletedAt })),
      )
      await db.tombstones.bulkPut(stones)

      await withoutTombstones(async () => {
        for (const [table, ids] of targets) await db.table(table).bulkDelete(ids)
      })
    },
  )

  forgetDrafts()
}
