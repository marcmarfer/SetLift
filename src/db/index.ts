import Dexie, { type Table } from 'dexie'
import type {
  Exercise,
  ExerciseFamily,
  ExercisePreference,
  Plan,
  Routine,
  Session,
  SetEntry,
  SyncTable,
  Tombstone,
} from '../types'

const SCHEMA = {
  exercises: 'id, name, group, updatedAt',
  routines: 'id, name, updatedAt',
  plans: 'id, updatedAt',
  sessions: 'id, date, routineId, updatedAt',
  sets: 'id, sessionId, exerciseId, doneAt, [sessionId+exerciseId]',
}

const SCHEMA_V3 = { ...SCHEMA, tombstones: 'id, table, deletedAt' }

const SCHEMA_V4 = { ...SCHEMA_V3, exercisePreferences: 'id, updatedAt' }

const SCHEMA_V5 = { ...SCHEMA_V4, exerciseFamilies: 'id, updatedAt' }

const SCHEMA_V6 = {
  ...SCHEMA_V5,
  sets: 'id, sessionId, exerciseId, doneAt, updatedAt, [sessionId+exerciseId]',
}

export const SYNCED_TABLES: SyncTable[] = [
  'exercises',
  'exercisePreferences',
  'routines',
  'plans',
  'sessions',
  'sets',
]

export const CATALOGUE_TABLE: SyncTable = 'exercises'

export const REFERENCE_TABLES: SyncTable[] = ['exerciseFamilies']

const LEGACY_MODES: Record<string, Plan['mode']> = {
  semanal: 'weekly',
  rotacion: 'rotation',
}

const LEGACY_SET_TYPES: Record<string, SetEntry['type']> = {
  fija: 'fixed',
  rango: 'range',
  fallo: 'failure',
}

export class SetLiftDB extends Dexie {
  exerciseFamilies!: Table<ExerciseFamily, string>
  exercises!: Table<Exercise, string>
  exercisePreferences!: Table<ExercisePreference, string>
  routines!: Table<Routine, string>
  plans!: Table<Plan, string>
  sessions!: Table<Session, string>
  sets!: Table<SetEntry, string>
  tombstones!: Table<Tombstone, string>

  constructor() {
    super('setlift')

    this.version(1).stores(SCHEMA)

    this.version(2)
      .stores(SCHEMA)
      .upgrade(async (tx) => {
        await tx.table('plans').toCollection().modify((plan: Plan) => {
          plan.mode = LEGACY_MODES[plan.mode] ?? plan.mode
        })

        await tx.table('sets').toCollection().modify((set: SetEntry) => {
          set.type = LEGACY_SET_TYPES[set.type] ?? set.type
        })

        await tx.table('routines').toCollection().modify((routine: Routine) => {
          for (const exercise of routine.exercises) {
            for (const template of exercise.sets) {
              template.type = LEGACY_SET_TYPES[template.type] ?? template.type
            }
          }
        })
      })

    this.version(3).stores(SCHEMA_V3)

    this.version(4)
      .stores(SCHEMA_V4)
      .upgrade(async (tx) => {
        const legacy = (await tx.table('exercises').toArray()) as Array<
          Exercise & { favorite?: boolean; manualOneRepMaxKg?: number; manualOneRepMaxDate?: string }
        >

        const preferences = legacy
          .filter((item) => item.favorite || item.manualOneRepMaxKg)
          .map((item) => ({
            id: item.id,
            favorite: item.favorite,
            manualOneRepMaxKg: item.manualOneRepMaxKg,
            manualOneRepMaxDate: item.manualOneRepMaxDate,
            updatedAt: item.updatedAt,
          }))

        if (preferences.length) await tx.table('exercisePreferences').bulkPut(preferences)

        await tx.table('exercises').toCollection().modify((item: Record<string, unknown>) => {
          delete item.favorite
          delete item.manualOneRepMaxKg
          delete item.manualOneRepMaxDate
        })
      })

    this.version(5).stores(SCHEMA_V5)

    this.version(6).stores(SCHEMA_V6)
  }
}

export const db = new SetLiftDB()

let applyingRemote = false

export const isApplyingRemote = () => applyingRemote

export async function withoutTombstones<T>(apply: () => Promise<T>): Promise<T> {
  applyingRemote = true
  try {
    return await apply()
  } finally {
    applyingRemote = false
  }
}

export function onLocalChange(notify: () => void) {
  const touched = () => {
    if (!applyingRemote) notify()
  }

  for (const name of SYNCED_TABLES) {
    const table = db.table(name)
    table.hook('creating', touched)
    table.hook('updating', touched)
    table.hook('deleting', touched)
  }
}

for (const name of SYNCED_TABLES) {
  db.table(name).hook('deleting', (primKey) => {
    if (applyingRemote) return
    const rowId = String(primKey)
    Dexie.ignoreTransaction(() =>
      db.tombstones.put({ id: `${name}:${rowId}`, table: name, rowId, deletedAt: Date.now() }),
    ).catch(() => {})
  })
}

export const newId = () => crypto.randomUUID()

export const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
