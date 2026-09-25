import { db } from '../db'
import type { Routine } from '../types'

export interface PrunedRoutines {
  archived: string[]
  deleted: Routine[]
}

export async function pruneRoutines(candidates?: string[]): Promise<PrunedRoutines> {
  const plans = await db.plans.toArray()
  const used = new Set(plans.flatMap((plan) => plan.routineIds))
  const routines = await db.routines.toArray()

  const orphans = routines.filter(
    (routine) => !used.has(routine.id) && (!candidates || candidates.includes(routine.id)),
  )

  const archived: string[] = []
  const deleted: Routine[] = []

  for (const routine of orphans) {
    const sessions = await db.sessions.where('routineId').equals(routine.id).count()

    if (sessions > 0) {
      if (routine.archived) continue
      await db.routines.update(routine.id, { archived: true, updatedAt: Date.now() })
      archived.push(routine.id)
      continue
    }

    await db.routines.delete(routine.id)
    deleted.push(routine)
  }

  return { archived, deleted }
}

export async function restoreRoutines(pruned: PrunedRoutines) {
  for (const id of pruned.archived) {
    await db.routines.update(id, { archived: false, updatedAt: Date.now() })
  }
  if (pruned.deleted.length) await db.routines.bulkPut(pruned.deleted)
}
