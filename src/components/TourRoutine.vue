<script setup lang="ts">
import TourStep from './TourStep.vue'
</script>

<template>
  <TourStep kicker="Las rutinas" title="Series con objetivo">
    Cada ejercicio lleva sus series y un objetivo para cada una, como <span class="num font-semibold text-ink">8–12 @8</span>. El esfuerzo es una guía para ti: no hace falta apuntarlo.
    <template #mockup>
      <div class="flex flex-col gap-2">
        <div class="flex flex-col rounded-[18px] border-[1.5px] border-accent bg-surface shadow-card">
          <div class="flex items-center gap-2.5 px-3.5 pt-3.5">
            <span class="flex text-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>
            </span>
            <span class="flex-grow text-[15px] font-bold">Remo con barra</span>
            <span class="flex h-10 w-10 items-center justify-center rounded-xl text-muted">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
            </span>
            <span class="flex h-9 w-9 items-center justify-center rounded-xl border border-line-btn text-danger">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" /></svg>
            </span>
            <span class="flex h-10 w-10 items-center justify-center rounded-xl text-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
            </span>
          </div>
          <div class="flex flex-col gap-3 px-3.5 pb-3.5 pt-3">
            <div class="-mt-1 flex h-10 items-center gap-2.5">
              <span class="flex-grow text-[13px] text-muted">Planificar sesión a sesión</span>
              <span class="flex h-7 w-12 items-center rounded-full bg-line-btn p-0.5">
                <span class="h-6 w-6 rounded-full bg-surface shadow-card" />
              </span>
            </div>
            <div class="flex items-center gap-2.5">
              <span class="flex-grow text-[13px] text-muted">Series</span>
              <span class="flex h-11 w-11 items-center justify-center rounded-xl border border-line-btn bg-surface-2 text-muted">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14" /></svg>
              </span>
              <span class="num w-8 text-center text-lg font-bold">3</span>
              <span class="flex h-11 w-11 items-center justify-center rounded-xl border border-line-btn bg-surface-2 text-muted">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </span>
            </div>
            <div class="flex flex-col gap-2">
              <span class="text-[13px] text-muted">Objetivo por serie</span>
              <div class="grid grid-cols-3 gap-1.5">
                <div
                  v-for="[label, rpe] in [['S1', 8], ['S2', 8], ['S3', 9]]"
                  :key="label"
                  class="flex flex-col items-center gap-1 rounded-xl border border-accent-line bg-accent-soft px-1 py-2"
                >
                  <span class="num text-[10px] text-dim">{{ label }}</span>
                  <span class="num text-[12.5px] font-semibold text-accent-ink">8–12</span>
                  <span class="num text-[10.5px] font-semibold text-accent-ink">@{{ rpe }}</span>
                </div>
              </div>
            </div>
            <div class="flex h-12 items-center gap-2.5 border-t border-line">
              <span class="flex-grow text-[13px] text-muted">Técnica</span>
              <span class="text-[13px] font-semibold text-dim">Normal</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon"><path d="M9 6l6 6-6 6" /></svg>
            </div>
          </div>
        </div>
        <div
          v-for="exercise in [
            { name: 'Dominadas', summary: '3 × 6–8 · +10 kg · desc. 2:00' },
            { name: 'Curl martillo', summary: '3 × 10 · 14 kg · desc. 1:00' },
          ]"
          :key="exercise.name"
          class="flex flex-col rounded-[18px] border border-line bg-surface shadow-card"
        >
          <div class="flex h-[62px] items-center gap-3 px-3.5">
            <span class="flex text-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>
            </span>
            <span class="flex flex-grow flex-col gap-1">
              <span class="text-[15px] font-semibold">{{ exercise.name }}</span>
              <span class="num text-[11.5px] text-sub">{{ exercise.summary }}</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon"><path d="M6 9l6 6 6-6" /></svg>
          </div>
        </div>
      </div>
    </template>
  </TourStep>
</template>
