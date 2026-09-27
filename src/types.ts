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

export type RepsTarget = 'fixed' | 'range' | 'single' | 'amrap'

export type SetType = RepsTarget | 'rir' | 'failure'

export type EffortTarget = 'rpe' | 'rir' | 'failure'

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
  rpe?: number
  effort?: EffortTarget
  weight?: number
}

export interface RoutineExercise {
  exerciseId: string
  sets: SetTemplate[]
  restSec: number | null
  incrementKg: number
  technique?: string
  planning?: ExercisePlanning
  upcoming?: PlannedSets[]
  supersetGroup?: number
}

export type ExercisePlanning = 'fixed' | 'sessions'

export interface PlannedSets {
  id: string
  sets: SetTemplate[]
  technique?: string
  usedBy?: string
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
  targetRpe?: number
  targetEffort?: EffortTarget
  technique?: string | null
  weight: number | null
  bodyweightKg?: number
  reps: number | null
  done: boolean
  doneAt: number | null
  updatedAt: number
}
