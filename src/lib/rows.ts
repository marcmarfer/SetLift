import type { SyncTable } from '../types'

const ALIASES: Partial<Record<SyncTable, Record<string, string>>> = {
  exerciseFamilies: { group: 'muscle_group', order: 'sort_order' },
  exercises: { group: 'muscle_group', order: 'sort_order' },
  plans: { order: 'sort_order' },
  sets: { index: 'set_index' },
}

const INSTANTS: Partial<Record<SyncTable, string[]>> = {
  sets: ['doneAt'],
}

const NULLABLE: Partial<Record<SyncTable, string[]>> = {
  sessions: ['routineId', 'planId'],
  sets: ['weight', 'reps', 'doneAt'],
}

const OWNED: SyncTable[] = ['exercises']

export const conflictKeyOf = (table: SyncTable) =>
  OWNED.includes(table) ? 'id' : 'user_id,id'

const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
const camel = (key: string) => key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())

export const remoteTableOf = (table: SyncTable) => snake(table)

const instantsOf = (table: SyncTable) => ['updatedAt', ...(INSTANTS[table] ?? [])]

export function toRemote(table: SyncTable, local: Record<string, unknown>, userId: string) {
  const aliases = ALIASES[table] ?? {}
  const instants = instantsOf(table)
  const row: Record<string, unknown> = OWNED.includes(table) ? {} : { user_id: userId }

  for (const [key, value] of Object.entries(local)) {
    if (value === undefined) continue
    const column = aliases[key] ?? snake(key)
    row[column] = instants.includes(key) && typeof value === 'number'
      ? new Date(value).toISOString()
      : value
  }

  return row
}

export function toLocal(table: SyncTable, remote: Record<string, unknown>) {
  const aliases = Object.fromEntries(
    Object.entries(ALIASES[table] ?? {}).map(([field, column]) => [column, field]),
  )
  const instants = instantsOf(table)
  const nullable = NULLABLE[table] ?? []
  const row: Record<string, unknown> = {}

  for (const [column, value] of Object.entries(remote)) {
    if (column === 'user_id' || column === 'deleted_at' || column === 'synced_at') continue
    const key = aliases[column] ?? camel(column)
    if (value === null && !nullable.includes(key)) continue
    row[key] = instants.includes(key) && typeof value === 'string' ? Date.parse(value) : value
  }

  return row
}

export const remoteUpdatedAt = (remote: Record<string, unknown>) =>
  Date.parse(String(remote.updated_at ?? 0)) || 0
