<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '../db'
import { useLive } from '../composables/useLive'
import { addDays, monthName, shortDate, shortDay, today } from '../lib/dates'
import { estimateOneRepMax } from '../lib/progress'
import { clearManualOneRepMax, saveManualOneRepMax, toggleFavorite as favoriteToggle } from '../lib/preferences'
import {
  deleteExercise,
  duplicateExercise,
  isMine,
  mergeExercise,
  muscleGroups,
  updateExercise,
  usageOf,
  type ExerciseDraft,
  type ExerciseUsage,
} from '../lib/exercises'
import { useAuthStore } from '../stores/auth'
import { useUndoStore } from '../stores/undo'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import ExercisePicker from '../components/ExercisePicker.vue'
import ExerciseSheet from '../components/ExerciseSheet.vue'
import OneRepMaxSheet from '../components/OneRepMaxSheet.vue'
import type { Exercise, ExercisePreference, Session, SetEntry } from '../types'

const route = useRoute()
const router = useRouter()

const exerciseId = computed(() => String(route.params.id ?? ''))
const rangeDays = ref<number | null>(90)

const ranges = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: 'Todo', days: null },
]

const repTargets = [1, 3, 5, 8, 10, 12]

interface DetailData {
  exercise: Exercise | null
  preference: ExercisePreference | null
  sets: SetEntry[]
  sessions: Session[]
}

const data = useLive<DetailData>(
  async () => {
    const exercise = (await db.exercises.get(exerciseId.value)) ?? null
    const preference = (await db.exercisePreferences.get(exerciseId.value)) ?? null
    const sets = (await db.sets.where('exerciseId').equals(exerciseId.value).toArray())
      .filter((set) => set.done && set.reps)
    const ids = [...new Set(sets.map((set) => set.sessionId))]
    const sessions = (await db.sessions.bulkGet(ids)).filter((item): item is Session => Boolean(item))
    return { exercise, preference, sets, sessions }
  },
  { exercise: null, preference: null, sets: [], sessions: [] },
  exerciseId,
)

const bodyweight = computed(() => data.value.exercise?.bodyweight ?? false)

const auth = useAuthStore()
const mine = computed(() => isMine(data.value.exercise, auth.userId))
const editing = ref(false)
const exerciseGroups = ref<string[]>([])

const undo = useUndoStore()
const usage = ref<ExerciseUsage | null>(null)
const confirmingRemoval = ref(false)
const merging = ref(false)
const catalogue = ref<Exercise[]>([])

async function openEditor() {
  exerciseGroups.value = await muscleGroups()
  usage.value = await usageOf(exerciseId.value)
  editing.value = true
}

const removalMessage = computed(() => {
  const found = usage.value
  const name = data.value.exercise?.name ?? 'El ejercicio'
  if (!found?.sets) return `${name} desaparecerá de la app.`
  return `${name} y sus ${found.sets} series desaparecerán de tus entrenos. Se guardan en el servidor, pero dejarás de verlas. Si quieres conservarlas a la vista, fusiónalo con otro ejercicio.`
})

async function askRemoval() {
  editing.value = false
  confirmingRemoval.value = true
}

async function remove() {
  const exercise = data.value.exercise
  confirmingRemoval.value = false
  if (!exercise) return

  const sets = await db.sets.where('exerciseId').equals(exercise.id).toArray()
  const preference = await db.exercisePreferences.get(exercise.id)

  await deleteExercise(exercise.id)
  router.replace('/progress')

  undo.offer(`${exercise.name} borrado`, async () => {
    await db.exercises.put(exercise)
    if (sets.length) await db.sets.bulkPut(sets)
    if (preference) await db.exercisePreferences.put(preference)
  })
}

async function openMerge() {
  editing.value = false
  catalogue.value = (await db.exercises.toArray()).filter((item) => item.id !== exerciseId.value)
  merging.value = true
}

async function merge(targetId: string) {
  const source = data.value.exercise
  merging.value = false
  if (!source) return
  await mergeExercise(source.id, targetId)
  router.replace(`/progress/${targetId}`)
}

async function saveExercise(draft: ExerciseDraft) {
  const exercise = data.value.exercise
  editing.value = false
  if (exercise) await updateExercise(exercise.id, draft)
}

async function duplicate() {
  const exercise = data.value.exercise
  if (!exercise || !auth.userId) return
  const copy = await duplicateExercise(exercise, auth.userId)
  router.replace(`/progress/${copy.id}`)
}

const favorite = computed(() => data.value.preference?.favorite === true)

async function toggleFavorite() {
  if (data.value.exercise) await favoriteToggle(data.value.exercise.id)
}

const dateOf = computed(
  () => new Map(data.value.sessions.map((session) => [session.id, session.date])),
)

const points = computed(() => {
  const current = data.value
  const limit = rangeDays.value ? addDays(today(), -rangeDays.value) : '0000-00-00'

  const byDate = new Map<string, number>()
  for (const set of current.sets) {
    const date = dateOf.value.get(set.sessionId)
    if (!date || date < limit) continue
    const score = bodyweight.value ? (set.reps ?? 0) : estimateOneRepMax(set.weight ?? 0, set.reps ?? 0)
    byDate.set(date, Math.max(byDate.get(date) ?? 0, score))
  }

  return [...byDate.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
})

const chart = computed(() => {
  const list = points.value
  if (list.length < 2) return null

  const values = list.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const width = 320
  const height = 150

  const mapped = list.map((point, index) => ({
    x: 30 + (index / (list.length - 1)) * (width - 50),
    y: 20 + (1 - (point.value - min) / span) * (height - 50),
    ...point,
  }))

  const line = mapped.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const last = mapped[mapped.length - 1]
  const area = `M${mapped[0].x.toFixed(1)},${mapped[0].y.toFixed(1)} L${line.split(' ').slice(1).join(' L')} L${last.x.toFixed(1)},${height - 18} L${mapped[0].x.toFixed(1)},${height - 18} Z`

  return { mapped, line, area, min: Math.round(min), max: Math.round(max), last, width, height }
})

const current = computed(() => {
  const list = points.value
  if (list.length === 0) return null
  const last = list[list.length - 1]
  const first = list[0]
  const change = first.value > 0 ? ((last.value - first.value) / first.value) * 100 : 0
  return { value: Math.round(last.value), change }
})

const manualOneRepMax = computed(() => {
  const preference = data.value.preference
  if (!preference?.manualOneRepMaxKg) return null
  return { weight: preference.manualOneRepMaxKg, date: preference.manualOneRepMaxDate ?? null }
})

const derivedOneRepMax = computed(() => {
  let best: { weight: number; date: string } | null = null

  for (const set of data.value.sets) {
    if (set.reps !== 1) continue
    const weight = set.weight ?? 0
    const date = dateOf.value.get(set.sessionId)
    if (weight <= 0 || !date) continue
    if (!best || weight > best.weight || (weight === best.weight && date > best.date)) {
      best = { weight, date }
    }
  }

  return best
})

const realOneRepMax = computed(() => manualOneRepMax.value ?? derivedOneRepMax.value)

const derivedNote = computed(() => {
  const manual = manualOneRepMax.value
  const derived = derivedOneRepMax.value
  if (!manual || !derived || derived.weight === manual.weight) return null
  return { ...derived, beatsManual: derived.weight > manual.weight }
})

const editingOneRepMax = ref(false)

async function saveOneRepMax(payload: { weight: number; date: string }) {
  const exercise = data.value.exercise
  if (!exercise) return
  await saveManualOneRepMax(exercise.id, payload.weight, payload.date)
  editingOneRepMax.value = false
}

async function clearOneRepMax() {
  const exercise = data.value.exercise
  if (!exercise) return
  await clearManualOneRepMax(exercise.id)
  editingOneRepMax.value = false
}

const records = computed(() =>
  repTargets.map((reps) => {
    const candidates = data.value.sets.filter((set) => set.reps === reps)
    if (candidates.length === 0) return { reps, weight: null, date: null }

    const best = candidates.reduce((a, b) => {
      const weightA = a.weight ?? 0
      const weightB = b.weight ?? 0
      if (weightA !== weightB) return weightB > weightA ? b : a
      return (dateOf.value.get(b.sessionId) ?? '') > (dateOf.value.get(a.sessionId) ?? '') ? b : a
    })

    return { reps, weight: best.weight ?? 0, date: dateOf.value.get(best.sessionId) ?? null }
  }),
)

const format = (value: number) => String(value).replace('.', ',')
</script>

<template>
  <div v-if="data.exercise" class="relative flex h-full flex-col overflow-hidden">
    <header class="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
      <button class="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center text-muted" type="button" @click="router.back()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <h1 class="min-w-0 flex-grow truncate text-lg font-bold tracking-[-0.01em]">{{ data.exercise.name }}</h1>
      <span class="flex h-7 shrink-0 items-center rounded-lg bg-surface-2 px-2.5 text-[11.5px] text-muted">{{ data.exercise.group }}</span>
      <button
        class="-mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center transition-colors"
        :class="favorite ? 'text-accent' : 'text-icon'"
        type="button"
        :aria-pressed="favorite"
        :aria-label="favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'"
        @click="toggleFavorite"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          :fill="favorite ? 'currentColor' : 'none'"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3.8l2.41 5.28 5.77.66-4.28 3.93 1.16 5.69L12 16.5l-5.06 2.86 1.16-5.69-4.28-3.93 5.77-.66z" />
        </svg>
      </button>
    </header>

    <div class="flex flex-grow flex-col gap-3.5 overflow-y-auto px-4 py-3.5">
      <section v-if="current || !bodyweight" class="flex items-start gap-3">
        <button
          v-if="!bodyweight"
          class="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
          type="button"
          :aria-label="realOneRepMax ? 'Editar el 1RM real' : 'Añadir un 1RM real'"
          @click="editingOneRepMax = true"
        >
          <span class="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">1RM real</span>

          <span v-if="realOneRepMax" class="flex items-baseline gap-1.5">
            <span class="num text-[38px] font-bold leading-none tracking-[-0.02em]">{{ format(realOneRepMax.weight) }}</span>
            <span class="text-[15px] text-dim">kg</span>
          </span>
          <span v-else class="flex h-[38px] items-center gap-1.5 text-[15px] text-dim">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Añadir
          </span>

          <span class="num text-[11px] text-faint">
            <template v-if="realOneRepMax">
              {{ realOneRepMax.date ? shortDate(realOneRepMax.date) : 'sin fecha' }} · {{ manualOneRepMax ? 'a mano' : 'registrado' }}
            </template>
            <template v-else>1 repetición</template>
          </span>

          <span
            v-if="derivedNote"
            class="num text-[11px]"
            :class="derivedNote.beatsManual ? 'text-accent' : 'text-faint'"
          >↳ {{ format(derivedNote.weight) }} kg · {{ shortDate(derivedNote.date) }}</span>
        </button>

        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
            {{ bodyweight ? 'Mejor serie' : '1RM estimado' }}
          </span>
          <div class="flex items-baseline gap-1.5">
            <span class="num text-[38px] font-bold leading-none tracking-[-0.02em]">{{ current ? current.value : '—' }}</span>
            <span v-if="current" class="text-[15px] text-dim">{{ bodyweight ? 'reps' : 'kg' }}</span>
          </div>
          <span
            v-if="current"
            class="num text-[13px] font-bold"
            :class="current.change > 0 ? 'text-accent' : current.change < 0 ? 'text-down' : 'text-dim'"
          >{{ current.change > 0 ? '↑ +' : current.change < 0 ? '↓ −' : '' }}{{ Math.abs(current.change).toFixed(1) }}%</span>
        </div>
      </section>

      <section class="grid grid-cols-4 gap-1 rounded-2xl border border-line bg-surface p-1">
        <button
          v-for="range in ranges"
          :key="range.label"
          class="num flex h-11 items-center justify-center rounded-xl text-[13px]"
          :class="rangeDays === range.days ? 'bg-accent font-bold text-hero-ink' : 'text-muted'"
          type="button"
          @click="rangeDays = range.days"
        >{{ range.label }}</button>
      </section>

      <section class="rounded-[20px] border border-line bg-surface px-3 pb-2.5 pt-3.5 shadow-card">
        <svg v-if="chart" :viewBox="`0 0 ${chart.width} ${chart.height}`" class="block h-[150px] w-full">
          <defs>
            <linearGradient id="detailFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--c-accent)" stop-opacity="0.34" />
              <stop offset="100%" stop-color="var(--c-accent)" stop-opacity="0.02" />
            </linearGradient>
          </defs>
          <line x1="28" y1="20" :x2="chart.width - 12" y2="20" stroke="var(--c-border)" stroke-width="1" />
          <line x1="28" :y1="chart.height - 18" :x2="chart.width - 12" :y2="chart.height - 18" stroke="var(--c-border)" stroke-width="1" />
          <text x="0" y="24" fill="var(--c-icon)" font-size="9" class="num">{{ chart.max }}</text>
          <text x="0" :y="chart.height - 14" fill="var(--c-icon)" font-size="9" class="num">{{ chart.min }}</text>
          <path :d="chart.area" fill="url(#detailFill)" />
          <polyline
            :points="chart.line"
            fill="none"
            stroke="var(--c-accent)"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle :cx="chart.last.x" :cy="chart.last.y" r="5" fill="var(--c-accent)" stroke="var(--c-surface)" stroke-width="2.5" />
        </svg>
        <p v-else class="py-10 text-center text-sm text-dim">Hacen falta al menos dos sesiones para dibujar la tendencia.</p>
      </section>

      <button
        class="flex h-13 items-center gap-2.5 rounded-2xl border border-line-btn bg-surface-2 px-3.5 text-left"
        type="button"
        @click="mine ? openEditor() : duplicate()"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="text-muted">
          <path v-if="mine" d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z" />
          <path v-else d="M9 9h10v10H9zM5 15H4V4h11v1" />
        </svg>
        <span class="flex-grow text-[14.5px]">{{ mine ? 'Editar ejercicio' : 'Hacer una copia mía' }}</span>
        <span v-if="!mine" class="text-[11.5px] text-faint">El catálogo no se edita</span>
      </button>

      <section class="flex flex-col rounded-[20px] border border-line bg-surface px-3.5 pb-2.5 shadow-card">
        <span class="flex h-[38px] items-center text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
          Récords por repeticiones · histórico
        </span>
        <div
          v-for="record in records"
          :key="record.reps"
          class="flex h-11 items-center gap-2.5 border-t border-line"
        >
          <span class="num w-14 text-[13px] text-muted">{{ record.reps }} {{ record.reps === 1 ? 'rep' : 'reps' }}</span>
          <span class="num flex-grow text-[15px] font-semibold">
            {{ record.weight == null ? '—' : record.weight === 0 ? 'BW' : `${format(record.weight)} kg` }}
          </span>
          <span v-if="record.date" class="num text-xs text-faint">
            {{ shortDay(record.date) }} {{ monthName(record.date).slice(0, 3) }}
          </span>
        </div>
      </section>
    </div>

    <ExerciseSheet
      v-if="editing && data.exercise"
      title="Editar ejercicio"
      :groups="exerciseGroups"
      :draft="{ name: data.exercise.name, group: data.exercise.group, bodyweight: data.exercise.bodyweight }"
      :usage="usage"
      @save="saveExercise"
      @remove="askRemoval"
      @merge="openMerge"
      @close="editing = false"
    />

    <ExercisePicker
      v-if="merging"
      title="Fusionar con"
      subtitle="El historial pasa al ejercicio que elijas"
      :exercises="catalogue"
      @pick="merge"
      @create="openMerge"
      @close="merging = false"
    />

    <ConfirmDialog
      v-if="confirmingRemoval"
      title="Borrar ejercicio"
      :message="removalMessage"
      label="Borrar"
      @confirm="remove"
      @close="confirmingRemoval = false"
    />

    <OneRepMaxSheet
      v-if="editingOneRepMax"
      :name="data.exercise.name"
      :weight="data.preference?.manualOneRepMaxKg ?? null"
      :date="data.preference?.manualOneRepMaxDate ?? null"
      @save="saveOneRepMax"
      @clear="clearOneRepMax"
      @close="editingOneRepMax = false"
    />
  </div>
</template>
