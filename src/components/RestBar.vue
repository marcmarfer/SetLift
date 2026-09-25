<script setup lang="ts">
import { computed } from 'vue'
import { useRestStore } from '../stores/rest'

const rest = useRestStore()

const clock = computed(() => {
  const seconds = Math.max(0, rest.secondsLeft)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})
</script>

<template>
  <div class="px-3 pt-2 pb-3">
    <div class="flex flex-col gap-2.5 rounded-[28px] bg-hero px-4 py-3.5 shadow-hero">
      <div class="flex items-center gap-2.5">
        <div class="flex flex-grow flex-col gap-0.5">
          <span class="text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Descanso</span>
          <span class="num text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-hero-ink">{{ clock }}</span>
        </div>
        <div class="flex gap-1.5">
          <button
            class="num flex h-12 w-13 items-center justify-center rounded-3xl bg-hero-surface text-[12.5px] font-semibold text-hero-ink"
            type="button"
            @click="rest.add(-15)"
          >−15s</button>
          <button
            class="num flex h-12 w-13 items-center justify-center rounded-3xl bg-hero-surface text-[12.5px] font-semibold text-hero-ink"
            type="button"
            @click="rest.add(15)"
          >+15s</button>
          <button
            class="flex h-12 items-center rounded-3xl bg-accent px-4 text-[13px] font-bold text-hero-ink"
            type="button"
            @click="rest.skip()"
          >Saltar</button>
        </div>
      </div>
      <p v-if="rest.nextLabel" class="text-[12.5px] text-hero-muted">
        Siguiente: <span class="num font-semibold text-hero-ink">{{ rest.nextLabel }}</span>
      </p>
    </div>
  </div>
</template>
