import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'setlift.settings'

interface StoredSettings {
  units: 'kg' | 'lb'
  defaultRestSec: number
  sound: boolean
  name: string
  bodyweightKg: number
  updatedAt: number
}

const defaults: StoredSettings = {
  units: 'kg',
  defaultRestSec: 120,
  sound: true,
  name: '',
  bodyweightKg: 75,
  updatedAt: 0,
}

function load(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<StoredSettings>) } : defaults
  } catch {
    return defaults
  }
}

export const readBodyweightKg = () => load().bodyweightKg

export const useSettingsStore = defineStore('settings', () => {
  const stored = load()

  const units = ref(stored.units)
  const defaultRestSec = ref(stored.defaultRestSec)
  const sound = ref(stored.sound)
  const name = ref(stored.name)
  const bodyweightKg = ref(stored.bodyweightKg)
  const updatedAt = ref(stored.updatedAt)

  let applyingRemote = false

  const snapshot = (): StoredSettings => ({
    units: units.value,
    defaultRestSec: defaultRestSec.value,
    sound: sound.value,
    name: name.value,
    bodyweightKg: bodyweightKg.value,
    updatedAt: updatedAt.value,
  })

  function cache() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()))
    } catch {}
  }

  watch([units, defaultRestSec, sound, name, bodyweightKg], () => {
    if (!applyingRemote) updatedAt.value = Date.now()
    cache()
  }, { deep: true, flush: 'sync' })

  function adopt(row: Record<string, unknown>) {
    applyingRemote = true
    units.value = (row.units as StoredSettings['units']) ?? units.value
    defaultRestSec.value = (row.default_rest_sec as number) ?? defaultRestSec.value
    sound.value = (row.sound as boolean) ?? sound.value
    name.value = (row.name as string) ?? name.value
    bodyweightKg.value = (row.bodyweight_kg as number) ?? bodyweightKg.value
    updatedAt.value = Date.parse(String(row.updated_at ?? 0)) || 0
    applyingRemote = false
    cache()
  }

  async function syncProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error

    const remoteAt = data ? Date.parse(String(data.updated_at ?? 0)) || 0 : 0
    if (data && remoteAt > updatedAt.value) {
      adopt(data)
      return 'pulled'
    }

    if (updatedAt.value === 0) return 'idle'

    const { error: failed } = await supabase.from('profiles').upsert(
      {
        user_id: userId,
        units: units.value,
        default_rest_sec: defaultRestSec.value,
        sound: sound.value,
        name: name.value,
        bodyweight_kg: bodyweightKg.value,
        updated_at: new Date(updatedAt.value).toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (failed) throw failed

    return 'pushed'
  }

  function reset() {
    applyingRemote = true
    units.value = defaults.units
    defaultRestSec.value = defaults.defaultRestSec
    sound.value = defaults.sound
    name.value = defaults.name
    bodyweightKg.value = defaults.bodyweightKg
    updatedAt.value = defaults.updatedAt
    applyingRemote = false
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  function seedName(from: string | null | undefined) {
    if (!name.value.trim() && from?.trim()) name.value = from.trim()
  }

  const initials = () =>
    name.value
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('')

  return {
    units,
    defaultRestSec,
    sound,
    name,
    bodyweightKg,
    updatedAt,
    initials,
    syncProfile,
    seedName,
    reset,
  }
})
