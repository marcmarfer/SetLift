import type { SetEntry, SetTemplate, SetType } from '../types'

export interface Target {
  type: SetType
  reps?: number
  repsMin?: number
  repsMax?: number
  rirMin?: number
  rirMax?: number
}

export const MODES: Array<{ value: SetType; label: string }> = [
  { value: 'range', label: 'Rango' },
  { value: 'fixed', label: 'Fija' },
  { value: 'single', label: 'Single' },
  { value: 'rir', label: 'RIR' },
  { value: 'failure', label: 'Al fallo' },
]

export const RANGE_PRESETS: Array<[number, number]> = [
  [6, 8],
  [8, 12],
  [12, 15],
]

export const RIR_PRESETS: Array<[number, number]> = [
  [0, 0],
  [1, 1],
  [2, 2],
  [1, 2],
  [2, 3],
]

export function targetOf(set: SetEntry): Target {
  return {
    type: set.type,
    reps: set.targetReps,
    repsMin: set.targetRepsMin,
    repsMax: set.targetRepsMax,
    rirMin: set.targetRirMin,
    rirMax: set.targetRirMax,
  }
}

export function entryTarget(template: SetTemplate) {
  return {
    type: template.type,
    targetReps: template.reps,
    targetRepsMin: template.repsMin,
    targetRepsMax: template.repsMax,
    targetRirMin: template.rirMin,
    targetRirMax: template.rirMax,
  }
}

export function rirLabel(target: Target) {
  const min = target.rirMin ?? 0
  const max = target.rirMax ?? min
  return min === max ? `RIR ${min}` : `RIR ${min}–${max}`
}

export function targetLabel(target: Target) {
  if (target.type === 'failure') return 'Al fallo'
  if (target.type === 'single') return 'Single'
  if (target.type === 'rir') return rirLabel(target)
  if (target.type === 'fixed') return `${target.reps ?? 0} reps`
  return `${target.repsMin ?? 0}–${target.repsMax ?? 0}`
}

export function shortLabel(target: Target) {
  if (target.type === 'failure') return 'Fallo'
  if (target.type === 'single') return 'Single'
  if (target.type === 'rir') return rirLabel(target)
  if (target.type === 'fixed') return String(target.reps ?? '')
  return `${target.repsMin ?? 0}–${target.repsMax ?? 0}`
}

export function minReps(target: Target) {
  if (target.type === 'single') return 1
  if (target.type === 'fixed') return target.reps ?? null
  if (target.type === 'range') return target.repsMin ?? null
  return null
}
