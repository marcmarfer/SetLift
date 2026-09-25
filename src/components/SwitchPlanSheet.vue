<script setup lang="ts">
import type { Plan } from '../types'

defineProps<{
  plan: Plan
  dueName: string | null
  weekDone: string[]
}>()

const emit = defineEmits<{
  (event: 'confirm'): void
  (event: 'close'): void
}>()
</script>

<template>
  <div class="absolute inset-0 z-20 flex flex-col justify-end bg-black/40" @click.self="emit('close')">
    <div class="flex flex-col gap-3.5 rounded-t-[28px] border-t border-line-btn bg-surface px-4 pt-3 pb-4.5 shadow-hero">
      <div class="flex justify-center"><span class="h-1 w-9 rounded-sm bg-line-btn" /></div>

      <div class="flex flex-col gap-1.5">
        <h2 class="text-[19px] font-bold tracking-[-0.02em]">Activar {{ plan.name }}</h2>
        <p v-if="dueName" class="text-[13.5px] leading-relaxed text-muted">
          Hoy te tocaba <span class="font-semibold text-ink">{{ dueName }}</span> del plan actual.
        </p>
      </div>

      <div class="flex flex-col gap-2.5 rounded-[18px] border border-accent-line bg-accent-soft p-3.5">
        <p class="text-[13px] leading-snug text-accent-ink">
          <template v-if="weekDone.length">
            Esta semana llevas <span class="font-bold">{{ weekDone.join(' y ') }}</span>. Se queda así, a medias.
          </template>
          <template v-else>Esta semana todavía no has entrenado con el plan actual.</template>
        </p>
        <p class="text-[12.5px] leading-snug text-accent-ink">
          No se borra nada: si vuelves a este plan antes del lunes, recuperas su progreso.
        </p>
      </div>

      <div class="flex gap-2">
        <button
          class="h-14 flex-grow rounded-[20px] bg-accent text-base font-bold text-hero-ink"
          type="button"
          @click="emit('confirm')"
        >Activar</button>
        <button
          class="h-14 w-28 rounded-[20px] border border-line-btn bg-surface-2 text-[15px] font-semibold"
          type="button"
          @click="emit('close')"
        >Cancelar</button>
      </div>
    </div>
  </div>
</template>
