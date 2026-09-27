import type { EffortTarget, RepsTarget, SetEntry, SetTemplate, SetType } from '../types'

export interface Target {
  type: SetType
  reps?: number
  repsMin?: number
  repsMax?: number
  rirMin?: number
  rirMax?: number
  rpe?: number
  effort?: EffortTarget
}

export const REPS_MODES: Array<{ value: RepsTarget; label: string }> = [
  { value: 'range', label: 'Rango' },
  { value: 'fixed', label: 'Fijas' },
  { value: 'single', label: 'Single' },
  { value: 'amrap', label: 'AMRAP' },
]

export const EFFORT_MODES: Array<{ value: EffortTarget | null; label: string }> = [
  { value: null, label: 'Sin objetivo' },
  { value: 'rpe', label: '@' },
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

export const RPE_STEPS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

export function repsOf(target: Pick<Target, 'type'>): RepsTarget {
  return target.type === 'rir' || target.type === 'failure' ? 'amrap' : target.type
}

export function effortOf(target: Pick<Target, 'type' | 'effort' | 'rpe'>): EffortTarget | null {
  if (target.type === 'rir') return 'rir'
  if (target.type === 'failure') return null
  if (target.effort) return target.effort
  return target.rpe != null ? 'rpe' : null
}

const EFFORTS_BY_REPS: Record<RepsTarget, Array<EffortTarget | null>> = {
  range: [null, 'rpe', 'rir', 'failure'],
  fixed: [null, 'rpe', 'rir', 'failure'],
  single: [null, 'rpe'],
  amrap: [null, 'rpe', 'rir'],
}

export const allowsEffort = (reps: RepsTarget, effort: EffortTarget | null) =>
  EFFORTS_BY_REPS[reps].includes(effort)

export function targetOf(set: SetEntry): Target {
  return {
    type: set.type,
    reps: set.targetReps,
    repsMin: set.targetRepsMin,
    repsMax: set.targetRepsMax,
    rirMin: set.targetRirMin,
    rirMax: set.targetRirMax,
    rpe: set.targetRpe,
    effort: set.targetEffort,
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
    targetRpe: template.rpe,
    targetEffort: effortOf(template) ?? undefined,
  }
}

export const rpeLabel = (rpe: number) => `@${String(rpe).replace('.', ',')}`

export function rirLabel(target: Pick<Target, 'rirMin' | 'rirMax'>) {
  const min = target.rirMin ?? 0
  const max = target.rirMax ?? min
  return min === max ? `RIR ${min}` : `RIR ${min}–${max}`
}

export function repsLabel(target: Target) {
  const reps = repsOf(target)
  if (reps === 'amrap') return 'AMRAP'
  if (reps === 'single') return 'Single'
  if (reps === 'fixed') return String(target.reps ?? '')
  return `${target.repsMin ?? 0}–${target.repsMax ?? 0}`
}

export function effortLabel(target: Target) {
  const effort = effortOf(target)
  if (effort === 'rpe' && target.rpe != null) return rpeLabel(target.rpe)
  if (effort === 'rir') return rirLabel(target)
  if (effort === 'failure') return 'fallo'
  return ''
}

export function shortLabel(target: Target) {
  const effort = effortLabel(target)
  if (!effort) return repsLabel(target)
  return effortOf(target) === 'rpe' ? `${repsLabel(target)} ${effort}` : `${repsLabel(target)} · ${effort}`
}

export function minReps(target: Target) {
  const reps = repsOf(target)
  if (reps === 'single') return 1
  if (reps === 'fixed') return target.reps ?? null
  if (reps === 'range') return target.repsMin ?? null
  return null
}
