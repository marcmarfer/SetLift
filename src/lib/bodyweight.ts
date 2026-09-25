import type { SetTemplate } from '../types'

export interface WeighedSet {
  weight: number | null
  bodyweightKg?: number
}

const round = (value: number) => Math.round(value * 100) / 100

export function extraLoad(set: WeighedSet): number | null {
  if (set.bodyweightKg == null) return null
  return round((set.weight ?? 0) - set.bodyweightKg)
}

export function startingWeight(
  bodyweight: boolean,
  bodyweightKg: number,
  previous: WeighedSet | undefined,
  template: SetTemplate | undefined,
): { weight: number | null; bodyweightKg?: number } {
  if (!bodyweight) {
    return { weight: previous?.weight ?? template?.weight ?? null }
  }

  const carried = previous ? extraLoad(previous) : null
  const load = carried ?? template?.weight ?? 0

  return { weight: Math.max(0, round(bodyweightKg + load)), bodyweightKg }
}

export function weightLabel(set: WeighedSet, format: (value: number) => string): string | null {
  const load = extraLoad(set)
  if (load == null || set.weight == null) return null
  if (load === 0) return 'BW'
  return `BW ${load > 0 ? '+' : '-'}${format(Math.abs(load))}`
}
