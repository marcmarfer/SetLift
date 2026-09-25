<script setup lang="ts">
import { computed } from 'vue'
import { longDay } from '../lib/dates'
import Calendar from './Calendar.vue'
import type { Routine } from '../types'

export interface LoggedSheet {
  id: string
  label: string
  routineId: string | null
}

const props = defineProps<{
  routines: Routine[]
  sheets: Record<string, LoggedSheet[]>
  date: string
}>()

const emit = defineEmits<{
  (event: 'pick', payload: { date: string; routineId: string | null }): void
  (event: 'open', sessionId: string): void
  (event: 'update:date', value: string): void
  (event: 'close'): void
}>()

const date = computed({
  get: () => props.date,
  set: (value: string) => emit('update:date', value),
})

const marks = computed(() =>
  Object.fromEntries(
    Object.entries(props.sheets).map(([day, list]) => [day, list.map((sheet) => sheet.label)]),
  ),
)

const logged = computed(() => props.sheets[date.value] ?? [])

const trained = computed(() => logged.value.some((sheet) => sheet.routineId))

const available = computed(() => (trained.value ? [] : props.routines))
</script>

<template>
  <div class="absolute inset-0 z-20 flex flex-col justify-end bg-black/40" @click.self="emit('close')">
    <div class="flex max-h-[92%] flex-col gap-3 rounded-t-[28px] border-t border-line-btn bg-surface px-4 pt-3 pb-4">
      <div class="flex shrink-0 justify-center"><span class="h-1 w-9 rounded-sm bg-line-btn" /></div>

      <div class="flex shrink-0 items-start gap-3">
        <div class="flex flex-grow flex-col gap-1">
          <h2 class="text-lg font-bold tracking-[-0.01em]">{{ trained ? 'Editar o añadir' : 'Apuntar un entreno' }}</h2>
          <p class="text-[12.5px] text-muted">{{ longDay(date) }}</p>
        </div>
        <button
          class="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-muted"
          type="button"
          @click="emit('close')"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div class="-mr-2 flex flex-col gap-3 overflow-y-auto pr-2">
        <Calendar v-model="date" :marks="marks" />

        <div v-if="logged.length" class="flex flex-col gap-2">
          <span class="px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Ese día entrenaste</span>
          <button
            v-for="sheet in logged"
            :key="sheet.id"
            class="flex min-h-16 items-center gap-3 rounded-2xl border border-accent-line bg-accent-soft px-3.5 py-3 text-left"
            type="button"
            @click="emit('open', sheet.id)"
          >
            <span class="flex flex-grow flex-col gap-1">
              <span class="text-[15px] font-semibold text-accent-ink">{{ sheet.label }}</span>
              <span class="text-xs text-accent-ink opacity-75">Editar lo que apuntaste</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>

        <div class="flex flex-col gap-2">
          <span class="px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
            {{ trained ? 'Añadir aparte' : 'Qué entrenaste' }}
          </span>

          <p v-if="trained" class="px-1 text-[12px] leading-snug text-dim">
            Solo se apunta una rutina del plan por día. Lo que hicieras además va como entreno extra.
          </p>

          <button
            v-for="routine in available"
            :key="routine.id"
            class="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-left"
            type="button"
            @click="emit('pick', { date, routineId: routine.id })"
          >
            <span class="flex flex-grow flex-col gap-1">
              <span class="text-[15px] font-semibold">{{ routine.name }}</span>
              <span class="num text-xs text-sub">{{ routine.exercises.length }} ejercicios</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon"><path d="M9 6l6 6-6 6" /></svg>
          </button>

          <button
            class="flex min-h-16 items-center gap-3 rounded-2xl border border-dashed border-line-btn px-3.5 py-3 text-left"
            type="button"
            @click="emit('pick', { date, routineId: null })"
          >
            <span class="flex flex-grow flex-col gap-1">
              <span class="text-[15px] font-semibold">Entreno extra</span>
              <span class="text-xs text-sub">Fuera del plan, lo montas tú</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
