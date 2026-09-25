<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { db } from '../db'
import { useLive } from '../composables/useLive'
import { sheetName } from '../lib/session'
import { addDays, fromIso, monthName, shortDay, today, toIso } from '../lib/dates'
import AccountButton from '../components/AccountButton.vue'
import Select from '../components/Select.vue'
import type { Exercise, Routine, Session, SetEntry } from '../types'

interface HistoryData {
  sessions: Session[]
  sets: SetEntry[]
  routines: Routine[]
  exercises: Exercise[]
}

const WEEKDAY_LABELS = ['', 'Lun', '', 'Mié', '', 'Vie', '']

function gridWeekStart(value: string): string {
  return addDays(value, -fromIso(value).getDay())
}

const viewMode = ref<'month' | 'year'>('month')
const period = ref(today().slice(0, 7))

function inRange(date: string): boolean {
  return date.startsWith(period.value)
}

const data = useLive<HistoryData>(
  async () => ({
    sessions: await db.sessions.toArray(),
    sets: await db.sets.toArray(),
    routines: await db.routines.toArray(),
    exercises: await db.exercises.toArray(),
  }),
  { sessions: [], sets: [], routines: [], exercises: [] },
)

const periods = computed(() => {
  const size = viewMode.value === 'year' ? 4 : 7
  const keys = new Set(data.value.sessions.map((session) => session.date.slice(0, size)))
  keys.add(period.value)
  return [...keys].sort().reverse()
})

const periodOptions = computed(() =>
  periods.value.map((key) => ({
    value: key,
    label: key.length === 4 ? key : `${monthName(`${key}-01`)} ${key.slice(0, 4)}`,
  })),
)

function setMode(mode: 'month' | 'year') {
  if (viewMode.value === mode) return
  const year = period.value.slice(0, 4)

  if (mode === 'year') {
    period.value = year
  } else {
    const months = data.value.sessions
      .map((session) => session.date.slice(0, 7))
      .filter((month) => month.startsWith(year))
      .sort()
    period.value = months.at(-1) ?? (year === today().slice(0, 4) ? today().slice(0, 7) : `${year}-12`)
  }

  viewMode.value = mode
}

function monthBounds(key: string) {
  const date = fromIso(`${key}-01`)
  return {
    first: toIso(date),
    last: toIso(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  }
}

function sectionTitle(key: string): string {
  if (viewMode.value === 'year') return monthName(`${key}-01`)

  const { first, last } = monthBounds(period.value)
  const from = key < first ? first : key
  const saturday = addDays(key, 6)
  const to = saturday > last ? last : saturday
  const month = monthName(from)

  return from === to
    ? `${fromIso(from).getDate()} de ${month}`
    : `${fromIso(from).getDate()} – ${fromIso(to).getDate()} de ${month}`
}

const sections = computed(() => {
  const current = data.value
  const routineName = new Map(current.routines.map((routine) => [routine.id, routine.name]))
  const exerciseName = new Map(current.exercises.map((exercise) => [exercise.id, exercise.name]))
  const setsBySession = new Map<string, SetEntry[]>()

  for (const set of current.sets) {
    const list = setsBySession.get(set.sessionId) ?? []
    list.push(set)
    setsBySession.set(set.sessionId, list)
  }

  const groups = new Map<string, Array<{
    id: string
    date: string
    routine: string
    sets: number
    exercises: string
  }>>()

  const sorted = [...current.sessions].sort((a, b) => (a.date < b.date ? 1 : -1))

  for (const session of sorted) {
    if (!inRange(session.date)) continue
    const sets = (setsBySession.get(session.id) ?? []).filter((set) => set.done)
    if (sets.length === 0) continue

    const names: string[] = []
    for (const set of sets) {
      const name = exerciseName.get(set.exerciseId)
      if (name && !names.includes(name)) names.push(name)
    }

    const key = viewMode.value === 'year' ? session.date.slice(0, 7) : gridWeekStart(session.date)
    const list = groups.get(key) ?? []
    list.push({
      id: session.id,
      date: session.date,
      routine: sheetName(session, session.routineId ? routineName.get(session.routineId) : null),
      sets: sets.length,
      exercises: names.join(' · '),
    })
    groups.set(key, list)
  }

  return [...groups.entries()].map(([key, sessions]) => ({
    key,
    title: sectionTitle(key),
    sessions,
  }))
})

const total = computed(() => sections.value.reduce((count, section) => count + section.sessions.length, 0))

const heatmap = computed(() => {
  const trained = new Set(data.value.sessions.filter((session) => !session.skipped).map((session) => session.date))
  const year = Number(period.value.slice(0, 4))
  const month = viewMode.value === 'year' ? null : Number(period.value.slice(5, 7)) - 1
  const first = month === null ? new Date(year, 0, 1) : new Date(year, month, 1)
  const last = month === null ? new Date(year, 11, 31) : new Date(year, month + 1, 0)

  const starts: string[] = []
  const limit = gridWeekStart(toIso(last))
  for (let start = gridWeekStart(toIso(first)); start <= limit; start = addDays(start, 7)) {
    starts.push(start)
  }

  return starts.map((start) => {
    const days = Array.from({ length: 7 }, (_, offset) => {
      const date = addDays(start, offset)
      return {
        date,
        trained: trained.has(date),
        outside: !date.startsWith(period.value),
      }
    })
    const opening = days.find((day) => !day.outside && fromIso(day.date).getDate() === 1)

    return { start, days, label: opening ? monthName(opening.date).slice(0, 3) : '' }
  })
})

const track = ref<HTMLElement | null>(null)

watch(
  period,
  async () => {
    await nextTick()
    const element = track.value
    if (!element) return

    const columns = heatmap.value
    const current = columns.findIndex((week) => week.days.some((day) => day.date === today()))
    const lastTrained = columns
      .map((week, index) => (week.days.some((day) => day.trained && !day.outside) ? index : -1))
      .filter((index) => index >= 0)
      .at(-1)

    const column = current === -1 ? (lastTrained ?? -1) : current
    const pitch = element.scrollWidth / columns.length
    element.scrollLeft = column === -1 ? 0 : Math.max(0, (column + 1) * pitch - element.clientWidth)
  },
  { immediate: true },
)
</script>

<template>
  <div class="relative flex h-full flex-col overflow-hidden">
    <header class="flex items-center gap-3 px-4 pt-4.5 pb-3">
      <h1 class="flex-grow text-[26px] font-bold tracking-[-0.02em]">Historial</h1>
      <span class="num text-[13px] text-dim">{{ total }} {{ total === 1 ? 'entreno' : 'entrenos' }}</span>
      <AccountButton />
    </header>

    <div class="flex flex-grow flex-col gap-3.5 overflow-y-auto px-4 pb-4">
      <section class="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-3.5 shadow-card">
        <div class="flex items-center gap-2">
          <Select v-model="period" :options="periodOptions" />

          <div class="ml-auto flex items-center gap-0.5 rounded-lg bg-surface-2 p-0.5">
            <button
              class="h-7 rounded-md px-2 text-[11px] transition-colors"
              :class="viewMode === 'month' ? 'bg-surface font-semibold text-ink shadow-card' : 'font-medium text-dim'"
              type="button"
              @click="setMode('month')"
            >Mes</button>
            <button
              class="h-7 rounded-md px-2 text-[11px] transition-colors"
              :class="viewMode === 'year' ? 'bg-surface font-semibold text-ink shadow-card' : 'font-medium text-dim'"
              type="button"
              @click="setMode('year')"
            >Año</button>
          </div>
        </div>
        <div class="flex gap-1.5">
          <div class="flex shrink-0 flex-col gap-1 pt-[18px]">
            <span
              v-for="(label, row) in WEEKDAY_LABELS"
              :key="row"
              class="h-3 text-[8.5px] leading-3 text-icon"
            >{{ label }}</span>
          </div>

          <div ref="track" class="overflow-x-auto">
            <div class="flex w-max flex-col gap-1 pr-6">
              <div class="flex gap-1">
                <div v-for="column in heatmap" :key="column.start" class="relative h-3.5 w-3 shrink-0">
                  <span
                    v-if="column.label"
                    class="absolute top-0 left-0 text-[8.5px] leading-3 whitespace-nowrap text-icon capitalize"
                  >{{ column.label }}</span>
                </div>
              </div>

              <div class="flex gap-1">
                <div v-for="column in heatmap" :key="column.start" class="flex flex-col gap-1">
                  <span
                    v-for="day in column.days"
                    :key="day.date"
                    class="h-3 w-3 rounded"
                    :class="day.outside ? 'bg-transparent' : day.trained ? 'bg-accent' : 'bg-surface-2'"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-for="section in sections" :key="section.key" class="flex flex-col gap-2">
        <span class="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{{ section.title }}</span>
        <RouterLink
          v-for="session in section.sessions"
          :key="session.id"
          :to="`/workout/${session.id}/view`"
          class="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface px-3.5 py-3 shadow-card"
        >
          <div class="flex items-center gap-2">
            <span class="num w-[70px] text-[13px] text-sub">{{ shortDay(session.date) }}</span>
            <span class="flex-grow text-[15px] font-semibold">{{ session.routine }}</span>
            <span class="num text-[13px] text-muted">{{ session.sets }} series</span>
          </div>
          <p class="truncate text-[11.5px] text-faint">{{ session.exercises }}</p>
        </RouterLink>
      </section>

      <p v-if="sections.length === 0" class="py-12 text-center text-sm text-dim">
        Todavía no hay entrenos apuntados.
      </p>
    </div>
  </div>
</template>
