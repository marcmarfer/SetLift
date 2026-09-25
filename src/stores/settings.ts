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
  avatar: string
  onboarded: boolean
  updatedAt: number
  syncedAt: number
}

const defaults: StoredSettings = {
  units: 'kg',
  defaultRestSec: 120,
  sound: true,
  name: '',
  bodyweightKg: 75,
  avatar: '',
  onboarded: false,
  updatedAt: 0,
  syncedAt: 0,
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

export const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

export const useSettingsStore = defineStore('settings', () => {
  const stored = load()

  const units = ref(stored.units)
  const defaultRestSec = ref(stored.defaultRestSec)
  const sound = ref(stored.sound)
  const name = ref(stored.name)
  const bodyweightKg = ref(stored.bodyweightKg)
  const avatar = ref(stored.avatar)
  const onboarded = ref(stored.onboarded)
  const updatedAt = ref(stored.updatedAt)
  const syncedAt = ref(stored.syncedAt)

  let applyingRemote = false

  const snapshot = (): StoredSettings => ({
    units: units.value,
    defaultRestSec: defaultRestSec.value,
    sound: sound.value,
    name: name.value,
    bodyweightKg: bodyweightKg.value,
    avatar: avatar.value,
    onboarded: onboarded.value,
    updatedAt: updatedAt.value,
    syncedAt: syncedAt.value,
  })

  function cache() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()))
    } catch {}
  }

  watch([units, defaultRestSec, sound, name, bodyweightKg, avatar, onboarded], () => {
    if (!applyingRemote) updatedAt.value = Date.now()
    cache()
  }, { deep: true, flush: 'sync' })

  function quietly(apply: () => void) {
    applyingRemote = true
    apply()
    applyingRemote = false
    cache()
  }

  function adopt(row: Record<string, unknown>) {
    quietly(() => {
      units.value = (row.units as StoredSettings['units']) ?? units.value
      defaultRestSec.value = (row.default_rest_sec as number) ?? defaultRestSec.value
      sound.value = (row.sound as boolean) ?? sound.value
      name.value = (row.name as string) ?? name.value
      bodyweightKg.value = (row.bodyweight_kg as number) ?? bodyweightKg.value
      avatar.value = (row.avatar as string) ?? ''
      updatedAt.value = Date.parse(String(row.updated_at ?? 0)) || 0
      syncedAt.value = updatedAt.value
    })
  }

  let syncing: Promise<'pulled' | 'pushed' | 'idle'> | null = null
  let loadedFor: string | null = null

  function syncProfile(userId: string) {
    if (!syncing) {
      syncing = exchange(userId)
        .then((result) => {
          loadedFor = userId
          return result
        })
        .finally(() => {
          syncing = null
        })
    }
    return syncing
  }

  async function ensureProfile(userId: string, timeoutMs = 6000) {
    if (loadedFor === userId) return true
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    try {
      await Promise.race([syncProfile(userId), timeout])
      return true
    } catch {
      return false
    }
  }

  async function exchange(userId: string): Promise<'pulled' | 'pushed' | 'idle'> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error

    if (data?.onboarded_at && !onboarded.value) quietly(() => (onboarded.value = true))

    const remoteAt = data ? Date.parse(String(data.updated_at ?? 0)) || 0 : 0
    if (data && remoteAt > updatedAt.value) {
      adopt(data)
      return 'pulled'
    }

    if (updatedAt.value === 0) return 'idle'

    const pushedAt = updatedAt.value

    const { error: failed } = await supabase.from('profiles').upsert(
      {
        user_id: userId,
        units: units.value,
        default_rest_sec: defaultRestSec.value,
        sound: sound.value,
        name: name.value,
        bodyweight_kg: bodyweightKg.value,
        avatar: avatar.value || null,
        ...(onboarded.value ? { onboarded_at: new Date(updatedAt.value).toISOString() } : {}),
        updated_at: new Date(updatedAt.value).toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (failed) throw failed

    syncedAt.value = Math.max(syncedAt.value, pushedAt)
    cache()
    return 'pushed'
  }

  function reset() {
    loadedFor = null
    quietly(() => {
      units.value = defaults.units
      defaultRestSec.value = defaults.defaultRestSec
      sound.value = defaults.sound
      name.value = defaults.name
      bodyweightKg.value = defaults.bodyweightKg
      avatar.value = defaults.avatar
      onboarded.value = defaults.onboarded
      updatedAt.value = defaults.updatedAt
      syncedAt.value = defaults.syncedAt
    })
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  function seedName(from: string | null | undefined) {
    if (!name.value.trim() && from?.trim()) name.value = from.trim()
  }

  const initials = () => initialsOf(name.value)

  const hasPendingProfile = () => updatedAt.value > syncedAt.value

  return {
    units,
    defaultRestSec,
    sound,
    name,
    bodyweightKg,
    avatar,
    onboarded,
    updatedAt,
    initials,
    syncProfile,
    ensureProfile,
    hasPendingProfile,
    seedName,
    reset,
  }
})
