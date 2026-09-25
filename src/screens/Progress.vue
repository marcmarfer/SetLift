<script setup lang="ts">
import { computed, ref } from 'vue'
import { db } from '../db'
import { useLive } from '../composables/useLive'
import { preferencesById } from '../lib/preferences'
import { setsByMuscleGroup, trends, type ExerciseTrend } from '../lib/progress'
import { addDays, today } from '../lib/dates'
import AccountButton from '../components/AccountButton.vue'
import Select from '../components/Select.vue'
import TrendRow from '../components/TrendRow.vue'
import type { Exercise, ExercisePreference, Session, SetEntry } from '../types'

interface ProgressData {
  exercises: Exercise[]
  preferences: Record<string, ExercisePreference>
  sessions: Session[]
  sets: SetEntry[]
}

const TARGET = { min: 10, max: 20, scale: 24 }
const ACTIVE_DAYS = 28

const TREND_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'up', label: 'Subiendo' },
  { value: 'down', label: 'Bajando' },
  { value: 'flat', label: 'Estancados' },
] as const

const SORT_OPTIONS = [
  { value: 'recent', label: 'Más reciente' },
  { value: 'gain', label: 'Mayor mejora' },
  { value: 'drop', label: 'Mayor caída' },
  { value: 'name', label: 'A–Z' },
] as const

const data = useLive<ProgressData>(
  async () => ({
    exercises: await db.exercises.toArray(),
    preferences: await preferencesById(),
    sessions: await db.sessions.toArray(),
    sets: await db.sets.toArray(),
  }),
  { exercises: [], preferences: {}, sessions: [], sets: [] },
)

const exerciseTrends = computed(() => trends(data.value.exercises, data.value.sessions, data.value.sets))

const favorites = computed(() =>
  exerciseTrends.value
    .filter((trend) => data.value.preferences[trend.exercise.id]?.favorite)
    .sort((a, b) => a.exercise.name.localeCompare(b.exercise.name, 'es')),
)

const groups = computed(() => setsByMuscleGroup(data.value.exercises, data.value.sessions, data.value.sets))

const filtering = ref(false)
const groupFilter = ref('')
const trendFilter = ref<(typeof TREND_OPTIONS)[number]['value']>('')
const activeOnly = ref(false)
const sortBy = ref<(typeof SORT_OPTIONS)[number]['value']>('recent')

const sortOptions = computed(() => SORT_OPTIONS.map((option) => ({ ...option })))

const muscleGroups = computed(() =>
  [...new Set(exerciseTrends.value.map((trend) => trend.exercise.group))].sort((a, b) => a.localeCompare(b, 'es')),
)

function score(trend: ExerciseTrend) {
  if (!trend.previous) return 0
  if (trend.unit !== 'reps') return trend.change
  return trend.previous.reps > 0 ? ((trend.best.reps - trend.previous.reps) / trend.previous.reps) * 100 : 0
}

const visibleTrends = computed(() => {
  const cutoff = addDays(today(), -ACTIVE_DAYS)

  const list = exerciseTrends.value.filter((trend) => {
    if (groupFilter.value && trend.exercise.group !== groupFilter.value) return false
    if (activeOnly.value && trend.best.date < cutoff) return false
    if (trendFilter.value === 'up') return trend.change > 0
    if (trendFilter.value === 'down') return trend.change < 0
    if (trendFilter.value === 'flat') return trend.previous !== null && trend.change === 0
    return true
  })

  if (sortBy.value === 'name') return [...list].sort((a, b) => a.exercise.name.localeCompare(b.exercise.name, 'es'))
  if (sortBy.value === 'gain') return [...list].sort((a, b) => score(b) - score(a))
  if (sortBy.value === 'drop') return [...list].sort((a, b) => score(a) - score(b))
  return list
})

const activeFilters = computed(
  () => [groupFilter.value !== '', trendFilter.value !== '', activeOnly.value].filter(Boolean).length,
)

function clearFilters() {
  groupFilter.value = ''
  trendFilter.value = ''
  activeOnly.value = false
}

const chip = (active: boolean) =>
  `flex h-10 items-center rounded-xl border px-3.5 text-[13px] transition-colors ${
    active
      ? 'border-accent bg-accent font-bold text-hero-ink'
      : 'border-line-btn bg-surface-2 font-medium text-muted'
  }`

const barWidth = (sets: number) => `${Math.min(100, (sets / TARGET.scale) * 100)}%`

const targetBand = {
  left: `${(TARGET.min / TARGET.scale) * 100}%`,
  width: `${((TARGET.max - TARGET.min) / TARGET.scale) * 100}%`,
}
</script>

<template>
  <div class="relative flex h-full flex-col overflow-hidden">
    <header class="flex items-center gap-3 px-4 pt-4.5 pb-3">
      <h1 class="flex-grow text-[26px] font-bold tracking-[-0.02em]">Progreso</h1>
      <AccountButton />
    </header>

    <div class="flex flex-grow flex-col gap-3.5 overflow-y-auto px-4 pb-4">
      <section
        v-if="favorites.length"
        class="flex flex-col rounded-[20px] border border-line bg-surface px-3.5 pb-2 shadow-card"
      >
        <div class="flex h-[38px] items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="text-accent"><path d="M12 3.8l2.41 5.28 5.77.66-4.28 3.93 1.16 5.69L12 16.5l-5.06 2.86 1.16-5.69-4.28-3.93 5.77-.66z" /></svg>
          <span class="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Favoritos</span>
        </div>
        <TrendRow v-for="trend in favorites" :key="trend.exercise.id" :trend="trend" />
      </section>

      <section class="flex flex-col rounded-[20px] border border-line bg-surface px-3.5 pb-2 shadow-card">
        <div class="flex h-12 items-center gap-2">
          <span class="min-w-0 flex-grow truncate text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
            Todos los ejercicios
          </span>
          <Select
            v-model="sortBy"
            :options="sortOptions"
            trigger-class="h-7 shrink-0 rounded-lg border border-line-btn bg-surface-2 px-2 text-[11px] font-semibold text-muted"
          />
          <button
            class="flex h-7 shrink-0 items-center gap-1 rounded-lg border px-1.5 text-[11px] font-semibold transition-colors"
            :class="activeFilters ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-btn bg-surface-2 text-muted'"
            type="button"
            aria-label="Filtrar"
            @click="filtering = true"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16l-6.5 7.5V19l-3-1.5v-5.5z" /></svg>
            <span v-if="activeFilters" class="num">{{ activeFilters }}</span>
          </button>
        </div>
        <TrendRow v-for="trend in visibleTrends" :key="trend.exercise.id" :trend="trend" />
        <p v-if="visibleTrends.length === 0" class="py-8 text-center text-sm text-dim">
          {{ exerciseTrends.length === 0
            ? 'Marca alguna serie y aquí verás la tendencia.'
            : 'Ningún ejercicio cumple el filtro.' }}
        </p>
      </section>

      <section v-if="groups.length" class="flex flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-3.5 shadow-card">
        <div class="flex items-baseline gap-2">
          <span class="flex-grow text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
            Series por grupo · esta semana
          </span>
          <span class="num text-[11px] text-icon">franja {{ TARGET.min }}–{{ TARGET.max }}</span>
        </div>
        <div class="flex flex-col gap-2.5">
          <div v-for="group in groups" :key="group.group" class="flex items-center gap-2.5">
            <span class="w-16 text-[12.5px] text-muted">{{ group.group }}</span>
            <div class="relative h-3 flex-grow overflow-hidden rounded bg-surface-2">
              <span class="absolute inset-y-0 bg-line" :style="targetBand" />
              <span class="absolute inset-y-0 left-0 rounded-r bg-accent" :style="{ width: barWidth(group.sets) }" />
            </div>
            <span class="num w-5 text-right text-[12.5px] font-semibold">{{ group.sets }}</span>
          </div>
        </div>
      </section>
    </div>

    <div
      v-if="filtering"
      class="absolute inset-0 z-20 flex flex-col justify-end bg-black/40"
      @click.self="filtering = false"
    >
      <div class="flex max-h-[92%] flex-col gap-4 rounded-t-[28px] border-t border-line-btn bg-surface px-4 pt-3 pb-4">
        <div class="flex shrink-0 justify-center"><span class="h-1 w-9 rounded-sm bg-line-btn" /></div>

        <div class="flex shrink-0 items-center gap-3">
          <h2 class="flex-grow text-lg font-bold tracking-[-0.01em]">Filtrar</h2>
          <button
            class="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-muted"
            type="button"
            aria-label="Cerrar"
            @click="filtering = false"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div class="-mr-2 flex flex-col gap-4 overflow-y-auto pr-2">
          <div class="flex flex-col gap-2">
            <span class="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Grupo muscular</span>
            <div class="flex flex-wrap gap-2">
              <button :class="chip(groupFilter === '')" type="button" @click="groupFilter = ''">Todos</button>
              <button
                v-for="group in muscleGroups"
                :key="group"
                :class="chip(groupFilter === group)"
                type="button"
                @click="groupFilter = group"
              >{{ group }}</button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Tendencia</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="option in TREND_OPTIONS"
                :key="option.value"
                :class="chip(trendFilter === option.value)"
                type="button"
                @click="trendFilter = option.value"
              >{{ option.label }}</button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Actividad</span>
            <div class="flex flex-wrap gap-2">
              <button :class="chip(!activeOnly)" type="button" @click="activeOnly = false">Todos</button>
              <button :class="chip(activeOnly)" type="button" @click="activeOnly = true">Últimas 4 semanas</button>
            </div>
          </div>

        </div>

        <button
          v-if="activeFilters"
          class="flex h-12 shrink-0 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-sm font-semibold text-muted"
          type="button"
          @click="clearFilters"
        >Quitar filtros</button>
      </div>
    </div>
  </div>
</template>
