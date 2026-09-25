<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '../db'
import { useLive } from '../composables/useLive'
import { sheetName } from '../lib/session'
import { longDay } from '../lib/dates'
import { estimateOneRepMax } from '../lib/progress'
import { bestOneRepMax, previousSession } from '../lib/session'
import { sessionVolume } from '../lib/plan'
import { extraLoad } from '../lib/bodyweight'
import type { Exercise, Routine, Session, SetEntry } from '../types'

const route = useRoute()
const router = useRouter()

const sessionId = computed(() => String(route.params.id ?? ''))
const closeTo = computed(() => (route.query.from === 'history' ? '/history' : '/'))
const routineUpdated = ref(false)

interface SummaryData {
  session: Session | null
  routine: Routine | null
  exercises: Exercise[]
  sets: SetEntry[]
  previous: Record<string, SetEntry[]>
  records: Record<string, number>
}

const data = useLive<SummaryData>(
  async () => {
    const session = (await db.sessions.get(sessionId.value)) ?? null
    if (!session) return { session: null, routine: null, exercises: [], sets: [], previous: {}, records: {} }

    const routine = session.routineId ? (await db.routines.get(session.routineId)) ?? null : null
    const exercises = await db.exercises.toArray()
    const sets = (await db.sets.where('sessionId').equals(session.id).toArray()).filter((set) => set.done)

    const ids = [...new Set(sets.map((set) => set.exerciseId))]
    const previous: Record<string, SetEntry[]> = {}
    const records: Record<string, number> = {}
    for (const id of ids) {
      previous[id] = await previousSession(id, session.id, session.date)
      records[id] = await bestOneRepMax(id, session.id, session.date)
    }

    return { session, routine, exercises, sets, previous, records }
  },
  { session: null, routine: null, exercises: [], sets: [], previous: {}, records: {} },
  sessionId,
)

const nameOf = (id: string) => data.value.exercises.find((item) => item.id === id)?.name ?? '—'

const format = (value: number) => String(value).replace('.', ',')

function best(sets: SetEntry[]) {
  if (sets.length === 0) return null
  return sets.reduce((a, b) =>
    estimateOneRepMax(b.weight ?? 0, b.reps ?? 0) > estimateOneRepMax(a.weight ?? 0, a.reps ?? 0) ? b : a,
  )
}

const lines = computed(() => {
  const current = data.value
  const ids = [...new Set(current.sets.map((set) => set.exerciseId))]

  return ids.map((id) => {
    const mine = current.sets.filter((set) => set.exerciseId === id)
    const bestNow = best(mine)
    const bestBefore = best(current.previous[id] ?? [])

    const nowScore = estimateOneRepMax(bestNow?.weight ?? 0, bestNow?.reps ?? 0)
    const beforeScore = estimateOneRepMax(bestBefore?.weight ?? 0, bestBefore?.reps ?? 0)

    let delta = ''
    if (bestBefore && bestNow) {
      if ((bestNow.weight ?? 0) > (bestBefore.weight ?? 0)) {
        delta = `↑ +${format((bestNow.weight ?? 0) - (bestBefore.weight ?? 0))} kg`
      } else if ((bestNow.reps ?? 0) > (bestBefore.reps ?? 0)) {
        delta = `↑ +${(bestNow.reps ?? 0) - (bestBefore.reps ?? 0)} rep`
      } else if (nowScore < beforeScore) {
        delta = '↓'
      } else {
        delta = '='
      }
    }

    return {
      id,
      name: nameOf(id),
      best: bestNow,
      delta,
      isRecord: nowScore > (current.records[id] ?? 0) && (current.records[id] ?? 0) > 0,
    }
  })
})

const records = computed(() => lines.value.filter((line) => line.isRecord))

const totals = computed(() => ({
  sets: data.value.sets.length,
  volume: Math.round(sessionVolume(data.value.sets)),
}))

function templateWeight(set: SetEntry | undefined) {
  if (!set) return null
  return extraLoad(set) ?? set.weight
}

const weightChanges = computed(() => {
  const routine = data.value.routine
  if (!routine) return []

  return routine.exercises.flatMap((item) => {
    const mine = data.value.sets.filter((set) => set.exerciseId === item.exerciseId)
    const used = templateWeight(mine[mine.length - 1])
    const planned = item.sets[item.sets.length - 1]?.weight
    if (used == null || planned == null || used === planned) return []
    return [{ name: nameOf(item.exerciseId), from: planned, to: used }]
  })
})

async function applyToRoutine() {
  const routine = data.value.routine
  if (!routine) return

  const exercises = routine.exercises.map((item) => {
    const mine = data.value.sets.filter((set) => set.exerciseId === item.exerciseId)
    const used = templateWeight(mine[mine.length - 1])
    if (used == null) return item
    return { ...item, sets: item.sets.map((template) => ({ ...template, weight: used })) }
  })

  await db.routines.update(routine.id, { exercises, updatedAt: Date.now() })
  routineUpdated.value = true
}

const thousands = (value: number) => value.toLocaleString('es-ES')
</script>

<template>
  <div v-if="data.session" class="flex h-full flex-col overflow-hidden">
    <header class="flex items-center gap-2 px-4 pt-4 pb-3">
      <button
        class="-ml-2.5 flex h-11 w-9 shrink-0 items-center justify-center text-muted"
        type="button"
        aria-label="Volver al entreno"
        @click="router.back()"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <div class="flex min-w-0 flex-col gap-1">
        <h1 class="text-[22px] font-bold tracking-[-0.02em]">Resumen</h1>
        <p class="truncate text-[13px] text-muted">{{ sheetName(data.session, data.routine?.name) }} · {{ longDay(data.session.date) }}</p>
      </div>
    </header>

    <div class="flex flex-grow flex-col gap-2.5 overflow-y-auto px-4 pb-4">
      <section v-if="records.length" class="flex flex-col gap-2.5 rounded-[26px] bg-hero p-4 shadow-hero">
        <div class="flex items-center gap-2.5">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="text-accent">
            <path d="M7 4h10v4.5a5 5 0 0 1-10 0z" /><path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 2.7" /><path d="M17 6h2.5a2.5 2.5 0 0 1-2.5 2.7" /><path d="M12 13.5V17" /><path d="M8.5 20h7" />
          </svg>
          <span class="text-[13px] font-bold uppercase tracking-[0.08em] text-accent">
            {{ records.length === 1 ? '1 récord nuevo' : `${records.length} récords nuevos` }}
          </span>
        </div>
        <div v-for="line in records" :key="line.id" class="flex items-center gap-2.5">
          <span class="flex-grow text-sm text-hero-ink">{{ line.name }}</span>
          <span class="num text-[15px] font-bold text-hero-ink">
            {{ format(line.best?.weight ?? 0) }} × {{ line.best?.reps }}
          </span>
        </div>
      </section>

      <section class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-3 shadow-card">
          <span class="text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint">Series</span>
          <span class="num text-xl font-bold">{{ totals.sets }}</span>
        </div>
        <div class="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-3 shadow-card">
          <span class="text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint">Volumen</span>
          <span class="num text-xl font-bold">
            {{ thousands(totals.volume) }}<span class="text-xs font-medium text-dim"> kg</span>
          </span>
        </div>
      </section>

      <section class="flex flex-col rounded-[18px] border border-line bg-surface px-3.5 py-3 shadow-card">
        <span class="pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint">Frente a la última vez</span>
        <div
          v-for="(line, index) in lines"
          :key="line.id"
          class="flex h-9 items-center gap-2.5"
          :class="index > 0 ? 'border-t border-line' : ''"
        >
          <span class="flex-grow truncate text-sm">{{ line.name }}</span>
          <span class="num text-[13px] text-muted">{{ format(line.best?.weight ?? 0) }} × {{ line.best?.reps }}</span>
          <span
            class="num w-[62px] text-right text-[13px] font-semibold"
            :class="line.delta.startsWith('↑') ? 'text-accent' : line.delta === '=' ? 'text-dim' : 'text-down'"
          >{{ line.delta }}</span>
        </div>
      </section>

      <section
        v-if="weightChanges.length && !routineUpdated"
        class="flex flex-col gap-2.5 rounded-[18px] border border-accent-line bg-accent-soft p-3.5"
      >
        <p class="text-[15px] font-semibold">¿Actualizar la rutina con estos cambios?</p>
        <p class="num text-xs text-accent-ink">
          {{ weightChanges.map((change) => `${change.name} ${format(change.from)} → ${format(change.to)} kg`).join(' · ') }}
        </p>
        <div class="flex gap-2">
          <button
            class="h-12 flex-grow rounded-xl bg-accent text-[15px] font-bold text-hero-ink"
            type="button"
            @click="applyToRoutine"
          >Sí, actualizar</button>
          <button
            class="h-12 w-24 rounded-xl border border-line-btn bg-surface-2 text-[15px] font-semibold"
            type="button"
            @click="routineUpdated = true"
          >No</button>
        </div>
      </section>

      <p v-else-if="routineUpdated" class="px-1 text-xs text-dim">Rutina actualizada con los pesos de hoy.</p>
    </div>

    <div class="px-4 pb-4 pt-2">
      <button
        class="flex h-14 w-full items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-base font-semibold"
        type="button"
        @click="router.push(closeTo)"
      >Cerrar</button>
    </div>
  </div>
</template>
