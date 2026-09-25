import { db, CATALOGUE_TABLE, REFERENCE_TABLES, SYNCED_TABLES, plain, withoutTombstones } from '../db'
import { supabase } from './supabase'
import { conflictKeyOf, remoteTableOf, remoteUpdatedAt, toLocal, toRemote } from './rows'
import type { SyncTable, Tombstone } from '../types'

const PULLED = 'setlift.sync.pulled'
const PUSHED = 'setlift.sync.pushed'
const EPOCH = '1970-01-01T00:00:00Z'

const PAGE = 1000
const DELETE_BATCH = 100

const OVERLAP_MS = 60_000

interface LocalRow extends Record<string, unknown> {
  id: string
  ownerId?: string
  updatedAt: number
}

const pulledKey = (userId: string, table: SyncTable) => `${PULLED}.${userId}.${table}`
const pushedKey = (userId: string) => `${PUSHED}.${userId}`

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

export function forgetSyncState(userId: string) {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`${PULLED}.${userId}`) || key === pushedKey(userId)) localStorage.removeItem(key)
    }
  } catch {}
}

async function fetchSince(table: SyncTable, since: string) {
  const rows: Array<Record<string, unknown>> = []

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(remoteTableOf(table))
      .select('*')
      .gt('synced_at', since)
      .order('synced_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) throw error
    const page = (data ?? []) as Array<Record<string, unknown>>
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}

async function pullTable(table: SyncTable, userId: string): Promise<string[]> {
  const key = pulledKey(userId, table)
  const rows = await fetchSince(table, read(key, EPOCH))
  if (rows.length === 0) return []

  const target = db.table(table)
  const incoming = rows.filter((row) => !row.deleted_at)
  const gone = rows.filter((row) => row.deleted_at).map((row) => String(row.id))

  const current = await target.bulkGet(incoming.map((row) => String(row.id)))
  const fresher = incoming.filter((row, spot) => {
    const local = current[spot] as LocalRow | undefined
    return !local || remoteUpdatedAt(row) > local.updatedAt
  })

  await withoutTombstones(async () => {
    if (fresher.length) await target.bulkPut(fresher.map((row) => toLocal(table, row)))
    if (gone.length) await target.bulkDelete(gone)
  })

  const newest = Date.parse(String(rows[rows.length - 1].synced_at))
  write(key, new Date(newest - OVERLAP_MS).toISOString())

  return fresher.map((row) => String(row.id))
}

async function changedSince(table: SyncTable, userId: string, since: number) {
  const changed = (await db.table(table).where('updatedAt').above(since).toArray()) as LocalRow[]

  return table === CATALOGUE_TABLE ? changed.filter((row) => row.ownerId === userId) : changed
}

async function pushTable(table: SyncTable, userId: string, since: number, justPulled: Set<string>) {
  const mine = (await changedSince(table, userId, since)).filter((row) => !justPulled.has(row.id))
  if (mine.length === 0) return 0

  const payload = mine.map((row) => toRemote(table, plain(row) as Record<string, unknown>, userId))

  const { error } = await supabase
    .from(remoteTableOf(table))
    .upsert(payload, { onConflict: conflictKeyOf(table) })
  if (error) throw error

  return payload.length
}

async function pushDeletions(userId: string) {
  const stones = await db.tombstones.toArray()
  if (stones.length === 0) return 0

  const alive = await Promise.all(
    stones.map((stone) => db.table(stone.table).get(stone.rowId)),
  )
  const spurious = stones.filter((_, spot) => alive[spot] !== undefined)
  const real = stones.filter((_, spot) => alive[spot] === undefined)

  if (spurious.length) await db.tombstones.bulkDelete(spurious.map((stone) => stone.id))
  if (real.length === 0) return 0

  const byTable = new Map<SyncTable, Tombstone[]>()
  for (const stone of real) {
    byTable.set(stone.table, [...(byTable.get(stone.table) ?? []), stone])
  }

  const stamp = () => ({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })

  for (const [table, group] of byTable) {
    const owner = table === CATALOGUE_TABLE ? 'owner_id' : 'user_id'

    for (let from = 0; from < group.length; from += DELETE_BATCH) {
      const batch = group.slice(from, from + DELETE_BATCH)

      const { error } = await supabase
        .from(remoteTableOf(table))
        .update(stamp())
        .eq(owner, userId)
        .in('id', batch.map((stone) => stone.rowId))

      if (error) throw error
      await db.tombstones.bulkDelete(batch.map((stone) => stone.id))
    }
  }

  return real.length
}

export async function hasPendingChanges(userId: string) {
  if ((await db.tombstones.count()) > 0) return true

  const since = Number(read(pushedKey(userId), '0'))
  for (const table of SYNCED_TABLES) {
    if ((await changedSince(table, userId, since)).length > 0) return true
  }
  return false
}

let running: Promise<{ pulled: number; pushed: number; deleted: number }> | null = null

export function sync(userId: string) {
  if (running) return running

  running = (async () => {
    const pushedSince = Number(read(pushedKey(userId), '0'))
    const startedAt = Date.now()
    const justPulled = new Map<SyncTable, Set<string>>()

    let pulled = 0
    for (const table of [...REFERENCE_TABLES, ...SYNCED_TABLES]) {
      const ids = await pullTable(table, userId)
      justPulled.set(table, new Set(ids))
      pulled += ids.length
    }

    const deleted = await pushDeletions(userId)

    let pushed = 0
    for (const table of SYNCED_TABLES) {
      pushed += await pushTable(table, userId, pushedSince, justPulled.get(table) ?? new Set())
    }

    write(pushedKey(userId), String(startedAt))
    return { pulled, pushed, deleted }
  })()

  running
    .finally(() => {
      running = null
    })
    .catch(() => {})

  return running
}
