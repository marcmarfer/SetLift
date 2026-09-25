<script setup lang="ts">
import { computed, ref } from 'vue'
import { fromIso, monthName, today, toIso } from '../lib/dates'

const props = withDefaults(
  defineProps<{
    modelValue: string
    marks?: Record<string, string[]>
    pending?: Record<string, string[]>
    max?: string
    compact?: boolean
  }>(),
  { marks: () => ({}), pending: () => ({}), max: undefined, compact: false },
)

const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const cursor = ref(startOfMonth(props.modelValue))
const hovered = ref<string | null>(null)

function startOfMonth(value: string) {
  const date = fromIso(value)
  return toIso(new Date(date.getFullYear(), date.getMonth(), 1))
}

function shiftMonth(months: number) {
  const date = fromIso(cursor.value)
  cursor.value = toIso(new Date(date.getFullYear(), date.getMonth() + months, 1))
}

const limit = computed(() => props.max ?? today())

const canGoForward = computed(() => cursor.value < startOfMonth(limit.value))

const title = computed(() => {
  const date = fromIso(cursor.value)
  return `${monthName(cursor.value)} ${date.getFullYear()}`
})

const days = computed(() => {
  const first = fromIso(cursor.value)
  const offset = (first.getDay() + 6) % 7
  const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()

  const cells: Array<{ date: string; day: number } | null> = Array.from({ length: offset }, () => null)

  for (let day = 1; day <= total; day += 1) {
    cells.push({ date: toIso(new Date(first.getFullYear(), first.getMonth(), day)), day })
  }

  return cells
})

const focus = computed(() => hovered.value ?? props.modelValue)

const focusLabels = computed(() => {
  const done = props.marks[focus.value] ?? []
  const waiting = (props.pending[focus.value] ?? []).map((label) => `${label} · pendiente`)
  return [...done, ...waiting]
})

function pick(date: string) {
  if (date > limit.value) return
  emit('update:modelValue', date)
}
</script>

<template>
  <div
    class="flex flex-col rounded-[20px] border border-line bg-surface shadow-card"
    :class="compact ? 'gap-2 p-3' : 'gap-2.5 p-3.5'"
  >
    <div class="flex items-center gap-1">
      <span class="flex-grow font-bold capitalize tracking-[-0.01em]" :class="compact ? 'text-[13px]' : 'text-[14px]'">{{ title }}</span>
      <button
        class="flex items-center justify-center rounded-xl border border-line-btn bg-surface-2 text-muted"
        :class="compact ? 'h-8 w-8' : 'h-9 w-9'"
        type="button"
        aria-label="Mes anterior"
        @click="shiftMonth(-1)"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <button
        class="flex items-center justify-center rounded-xl border border-line-btn bg-surface-2 text-muted disabled:opacity-35"
        :class="compact ? 'h-8 w-8' : 'h-9 w-9'"
        type="button"
        aria-label="Mes siguiente"
        :disabled="!canGoForward"
        @click="shiftMonth(1)"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </button>
    </div>

    <div class="grid grid-cols-7 gap-1">
      <span
        v-for="label in WEEKDAYS"
        :key="label"
        class="flex items-center justify-center font-medium uppercase tracking-[0.06em] text-faint"
        :class="compact ? 'h-5 text-[10px]' : 'h-6 text-[11px]'"
      >{{ label }}</span>

      <template v-for="(cell, index) in days" :key="cell?.date ?? `empty-${index}`">
        <span v-if="!cell" />
        <button
          v-else
          class="num relative flex flex-col items-center justify-center rounded-xl border transition-colors"
          :class="[
            compact ? 'h-8 text-[12.5px]' : 'h-10 text-[13.5px]',
            cell.date === modelValue
              ? 'border-accent bg-accent font-bold text-hero-ink'
              : marks[cell.date]
                ? 'border-accent-line bg-accent-soft font-semibold text-accent-ink'
                : pending[cell.date]
                  ? 'border-dashed border-accent-line text-ink'
                  : 'border-transparent text-ink',
            cell.date === today() && cell.date !== modelValue ? 'border-accent' : '',
            cell.date > limit ? 'text-faint' : '',
          ]"
          type="button"
          :disabled="cell.date > limit"
          :title="(marks[cell.date] ?? []).join(' · ')"
          @click="pick(cell.date)"
          @mouseenter="hovered = cell.date"
          @mouseleave="hovered = null"
        >
          {{ cell.day }}
          <span
            v-if="marks[cell.date] && cell.date !== modelValue"
            class="absolute bottom-1 h-1 w-1 rounded-full bg-accent"
          />
          <span
            v-else-if="pending[cell.date] && cell.date !== modelValue"
            class="absolute bottom-1 h-1 w-1 rounded-full border border-accent"
          />
        </button>
      </template>
    </div>

    <p
      v-if="!compact || focusLabels.length"
      class="min-h-[18px] text-center text-[12px] leading-snug"
      :class="focusLabels.length ? 'text-muted' : 'text-faint'"
    >
      {{ focusLabels.length ? focusLabels.join(' · ') : 'Sin entreno ese día' }}
    </p>
  </div>
</template>
