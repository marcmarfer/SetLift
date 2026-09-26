export type SyncTable =
  | 'exerciseFamilies'
  | 'exercises'
  | 'exercisePreferences'
  | 'routines'
  | 'plans'
  | 'sessions'
  | 'sets'

export interface Tombstone {
  id: string
  table: SyncTable
  rowId: string
  deletedAt: number
}

export type PlanMode = 'weekly' | 'rotation'

export type SetType = 'fixed' | 'range' | 'rir' | 'failure' | 'single'

export interface ExerciseFamily {
  id: string
  name: string
  group: string
  order?: number
  updatedAt: number
}

export interface Exercise {
  id: string
  ownerId?: string
  name: string
  group: string
  bodyweight: boolean
  familyId?: string
  variant?: string
  order?: number
  updatedAt: number
}

export interface ExercisePreference {
  id: string
  favorite?: boolean
  manualOneRepMaxKg?: number
  manualOneRepMaxDate?: string
  updatedAt: number
}

export interface SetTemplate {
  type: SetType
  reps?: number
  repsMin?: number
  repsMax?: number
  rirMin?: number
  rirMax?: number
  weight?: number
}

export interface RoutineExercise {
  exerciseId: string
  sets: SetTemplate[]
  restSec: number | null
  incrementKg: number
  alternativeIds: string[]
  supersetGroup?: number
}

export interface Routine {
  id: string
  name: string
  exercises: RoutineExercise[]
  archived?: boolean
  updatedAt: number
}

export interface Plan {
  id: string
  name: string
  mode: PlanMode
  routineIds: string[]
  active: boolean
  order?: number
  updatedAt: number
}

export interface Session {
  id: string
  date: string
  routineId: string | null
  planId: string | null
  skipped?: boolean
  freestyle?: boolean
  later?: boolean
  edited?: boolean
  name?: string
  note?: string
  updatedAt: number
}

export interface SetEntry {
  id: string
  sessionId: string
  exerciseId: string
  slot?: number
  index: number
  type: SetType
  targetReps?: number
  targetRepsMin?: number
  targetRepsMax?: number
  targetRirMin?: number
  targetRirMax?: number
  weight: number | null
  bodyweightKg?: number
  reps: number | null
  done: boolean
  doneAt: number | null
  updatedAt: number
}
