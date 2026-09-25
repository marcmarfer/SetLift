<script setup lang="ts">
import type { ExerciseTrend } from '../lib/progress'

defineProps<{ trend: ExerciseTrend }>()

const weightLabel = (weight: number) => (weight === 0 ? 'BW' : `${weight} kg`)

const changeLabel = (change: number, unit: 'percent' | 'reps') => {
  if (change === 0) return '='
  const sign = change > 0 ? '↑ +' : '↓ −'
  const value = Math.abs(change)
  return unit === 'reps' ? `${sign}${value} reps` : `${sign}${value.toFixed(value < 10 ? 1 : 0)}%`
}
</script>

<template>
  <RouterLink
    :to="`/progress/${trend.exercise.id}`"
    class="flex h-14 items-center gap-2.5 border-t border-line"
  >
    <div class="flex flex-grow flex-col gap-0.5">
      <span class="text-[15px] font-semibold">{{ trend.exercise.name }}</span>
      <span class="num text-[12.5px] text-sub">
        {{ weightLabel(trend.best.weight) }} × {{ trend.best.reps }}
      </span>
    </div>
    <span
      class="num text-[13px] font-bold"
      :class="trend.change > 0 ? 'text-accent' : trend.change < 0 ? 'text-down' : 'text-dim'"
    >{{ changeLabel(trend.change, trend.unit) }}</span>
    <span class="text-icon">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
    </span>
  </RouterLink>
</template>
