<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../db'
import { useLive } from '../composables/useLive'
import { longDay } from '../lib/dates'
import { deleteAllTraining } from '../lib/localData'
import { useAuthStore } from '../stores/auth'
import { useSettingsStore } from '../stores/settings'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import type { Session } from '../types'

const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()
const importing = ref<string | null>(null)
const wiping = ref(false)
const stranded = ref(false)

async function leave(discardPending = false) {
  if (await auth.signOut(discardPending)) {
    router.replace('/login')
    return
  }
  stranded.value = true
}

async function wipe() {
  wiping.value = false
  await deleteAllTraining()
  location.reload()
}

onMounted(() => auth.refreshFactors())

const sessions = useLive<Session[]>(async () => db.sessions.toArray(), [])

const stats = computed(() => {
  const list = [...sessions.value].sort((a, b) => (a.date < b.date ? -1 : 1))
  return { total: list.length, since: list[0]?.date ?? null }
})

const restLabel = computed(() => {
  const seconds = settings.defaultRestSec
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})

async function exportBackup() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      units: settings.units,
      defaultRestSec: settings.defaultRestSec,
      sound: settings.sound,
      name: settings.name,
      bodyweightKg: settings.bodyweightKg,
    },
    exercises: await db.exercises.toArray(),
    routines: await db.routines.toArray(),
    plans: await db.plans.toArray(),
    sessions: await db.sessions.toArray(),
    sets: await db.sets.toArray(),
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `setlift-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

async function importBackup(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const payload = JSON.parse(await file.text())
    await db.transaction('rw', db.exercises, db.routines, db.plans, db.sessions, db.sets, async () => {
      if (payload.exercises) await db.exercises.bulkPut(payload.exercises)
      if (payload.routines) await db.routines.bulkPut(payload.routines)
      if (payload.plans) await db.plans.bulkPut(payload.plans)
      if (payload.sessions) await db.sessions.bulkPut(payload.sessions)
      if (payload.sets) await db.sets.bulkPut(payload.sets)
    })
    importing.value = 'Copia importada.'
  } catch {
    importing.value = 'No se pudo leer esa copia.'
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <div class="relative flex h-full flex-col overflow-hidden">
    <header class="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
      <button class="-ml-2.5 flex h-11 w-11 items-center justify-center text-muted" type="button" @click="router.back()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <h1 class="flex-grow text-lg font-bold tracking-[-0.01em]">Cuenta</h1>
    </header>

    <div class="flex flex-grow flex-col gap-3.5 overflow-y-auto px-4 py-3.5">
      <section class="flex flex-col rounded-[20px] border border-line bg-surface px-3.5 pt-3.5 shadow-card">
        <div class="flex items-center gap-3.5 pb-3.5">
          <span class="num flex h-14 w-14 items-center justify-center rounded-full border border-accent-line bg-accent-soft text-[19px] font-bold text-accent">
            {{ settings.initials() }}
          </span>
          <div class="flex flex-grow flex-col gap-1">
            <span class="text-[17px] font-bold tracking-[-0.01em]">{{ settings.name || auth.email }}</span>
            <span v-if="settings.name" class="text-[13px] text-muted">{{ auth.email }}</span>
          </div>
        </div>
        <RouterLink to="/account/edit" class="flex h-13 items-center gap-2.5 border-t border-line text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z" /><path d="M14 6.5l3.5 3.5" /></svg>
          <span class="flex-grow text-[14.5px] text-ink">Editar perfil</span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon"><path d="M9 6l6 6-6 6" /></svg>
        </RouterLink>

        <RouterLink to="/account/two-factor" class="flex h-13 items-center gap-2.5 border-t border-line text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6z" /></svg>
          <span class="flex-grow text-[14.5px] text-ink">Verificación en dos pasos</span>
          <span class="text-[13px]" :class="auth.totpEnabled ? 'text-ok' : 'text-faint'">
            {{ auth.totpEnabled ? 'Activada' : 'Desactivada' }}
          </span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon"><path d="M9 6l6 6-6 6" /></svg>
        </RouterLink>
      </section>

      <p class="num px-1 text-xs text-faint">
        {{ stats.total }} entrenos<span v-if="stats.since"> · desde {{ longDay(stats.since) }}</span>
      </p>

      <section class="flex flex-col gap-2">
        <span class="px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Ajustes</span>
        <div class="flex flex-col rounded-[20px] border border-line bg-surface px-3.5 shadow-card">
          <div class="flex h-14 items-center gap-2.5">
            <span class="flex-grow text-[14.5px]">Unidades</span>
            <div class="flex gap-1 rounded-xl bg-surface-2 p-1">
              <button
                v-for="unit in (['kg', 'lb'] as const)"
                :key="unit"
                class="num h-9 w-12 rounded-lg text-[13px]"
                :class="settings.units === unit ? 'bg-accent font-bold text-hero-ink' : 'text-muted'"
                type="button"
                @click="settings.units = unit"
              >{{ unit }}</button>
            </div>
          </div>

          <div class="flex h-14 items-center gap-2.5 border-t border-line">
            <span class="flex-grow text-[14.5px]">Descanso por defecto</span>
            <button class="flex h-9 w-9 items-center justify-center rounded-lg border border-line-btn text-muted" type="button" @click="settings.defaultRestSec = Math.max(0, settings.defaultRestSec - 15)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14" /></svg>
            </button>
            <span class="num w-12 text-center text-sm font-semibold">{{ restLabel }}</span>
            <button class="flex h-9 w-9 items-center justify-center rounded-lg border border-line-btn text-muted" type="button" @click="settings.defaultRestSec = settings.defaultRestSec + 15">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>

          <div class="flex h-14 items-center gap-2.5 border-t border-line">
            <span class="flex-grow text-[14.5px]">Sonido al acabar el descanso</span>
            <button
              class="flex h-7 w-12 items-center rounded-full p-[3px] transition-colors"
              :class="settings.sound ? 'justify-end bg-accent' : 'justify-start bg-line-btn'"
              type="button"
              @click="settings.sound = !settings.sound"
            >
              <span class="h-5.5 w-5.5 rounded-full bg-surface" />
            </button>
          </div>

          <button class="flex h-14 items-center gap-2.5 border-t border-line" type="button" @click="exportBackup">
            <span class="flex-grow text-left text-[14.5px]">Exportar copia</span>
            <span class="num text-xs text-faint">json</span>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon"><path d="M9 6l6 6-6 6" /></svg>
          </button>

          <label class="flex h-14 cursor-pointer items-center gap-2.5 border-t border-line">
            <span class="flex-grow text-[14.5px]">Importar copia</span>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon"><path d="M9 6l6 6-6 6" /></svg>
            <input type="file" accept="application/json" class="hidden" @change="importBackup" />
          </label>
        </div>
        <p v-if="importing" class="px-1 text-xs text-accent">{{ importing }}</p>
      </section>

      <button
        class="flex h-14 items-center gap-2.5 rounded-2xl border border-line-btn bg-surface-2 px-3.5 text-danger"
        type="button"
        @click="wiping = true"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 7h14" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" />
        </svg>
        <span class="flex-grow text-left text-[15px] font-semibold">Borrar todos los datos</span>
      </button>

      <button
        class="flex h-14 items-center gap-2.5 rounded-2xl border border-line-btn bg-surface-2 px-3.5"
        type="button"
        @click="leave()"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="M16 15l4-3-4-3" /><path d="M20 12H9" /></svg>
        <span class="flex-grow text-left text-[15px] font-semibold">Cerrar sesión</span>
      </button>

      <template v-if="stranded && auth.error">
        <p class="rounded-2xl border border-warn bg-warn-soft px-3.5 py-2.5 text-[12.5px] leading-snug text-ink">
          {{ auth.error }}
        </p>
        <button class="h-11 text-[13.5px] font-semibold text-danger" type="button" @click="leave(true)">
          Salir igualmente y perderlos
        </button>
      </template>
    </div>

    <ConfirmDialog
      v-if="wiping"
      title="Borrar todos los datos"
      message="Se borran tus ejercicios, rutinas, planes y todo tu historial, también en tus otros dispositivos. No se puede deshacer."
      label="Borrar y empezar de cero"
      @confirm="wipe"
      @close="wiping = false"
    />
  </div>
</template>
