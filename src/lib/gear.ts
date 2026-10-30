import type { Gear } from '../types'

export const GEAR_OPTIONS: Array<{ value: Gear; label: string }> = [
  { value: 'chalk', label: 'Magnesio' },
  { value: 'belt', label: 'Cinturón' },
  { value: 'straps', label: 'Straps' },
  { value: 'wristWraps', label: 'Muñequeras' },
  { value: 'kneeSleeves', label: 'Rodilleras' },
]

const ORDER = GEAR_OPTIONS.map((option) => option.value)

export function normalGear(gear: readonly Gear[] | null | undefined): Gear[] {
  return ORDER.filter((value) => gear?.includes(value))
}

export const sameGear = (a: readonly Gear[] | null | undefined, b: readonly Gear[] | null | undefined) =>
  normalGear(a).join() === normalGear(b).join()

export const storedGear = (gear: readonly Gear[] | null | undefined) => {
  const list = normalGear(gear)
  return list.length ? list : undefined
}

export function gearLabel(gear: readonly Gear[] | null | undefined): string {
  const names = normalGear(gear).map((value) => GEAR_OPTIONS.find((option) => option.value === value)!.label)
  return names.map((name, spot) => (spot === 0 ? name : name.toLowerCase())).join(' + ')
}

type Geared = ReadonlyArray<{ gear?: readonly Gear[] | null }>

export const gearVaries = (sets: Geared) => sets.some((set) => !sameGear(set.gear, sets[0]?.gear))

export const sharedGear = (sets: Geared) => (gearVaries(sets) ? [] : normalGear(sets[0]?.gear))
