<script setup lang="ts">
import { addDays, tinyDay, today } from '../lib/dates'
import TourStep from './TourStep.vue'

const doneDay = tinyDay(addDays(today(), -2))
const dueDay = tinyDay(today())
</script>

<template>
  <TourStep kicker="El plan" title="Qué toca, cada día">
    Un plan ordena tus rutinas y <span class="font-semibold text-ink">Hoy</span> te pone delante la que toca. Semanal empieza cada lunes; en rotación, la siguiente te espera.
    <template #mockup>
      <div class="flex items-center gap-3 rounded-[22px] bg-hero p-3.5 shadow-hero">
        <div class="flex flex-grow flex-col gap-1.5">
          <span class="text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Plan activo</span>
          <span class="text-[17px] font-bold tracking-[-0.01em] text-hero-ink">Push Pull Legs</span>
          <span class="num text-xs text-hero-muted">3 rutinas</span>
        </div>
        <span class="flex h-9 items-center rounded-full bg-hero-surface px-3.5 text-[13px] font-semibold text-hero-ink">Cambiar</span>
      </div>
      <div class="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-3.5 shadow-card">
        <div class="flex items-center gap-2.5">
          <span class="flex-grow text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Tu rotación</span>
          <span class="num text-[13px] text-muted">1 de 3</span>
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          <div class="flex flex-col items-center justify-center gap-1 rounded-2xl border border-ok-line bg-ok-soft py-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" class="text-ok"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
            <span class="text-xs font-semibold">Push</span>
            <span class="num text-[10px] text-dim">{{ doneDay }}</span>
          </div>
          <div class="flex flex-col items-center justify-center gap-1 rounded-2xl border border-accent bg-accent-soft py-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="text-accent"><path d="M9 5.5v13l10-6.5z" /></svg>
            <span class="text-xs font-bold">Pull</span>
            <span class="num text-[10px] text-dim">{{ dueDay }}</span>
            <span class="-mb-1 mt-0.5 flex rotate-90 text-faint"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg></span>
          </div>
          <div class="flex flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface-2 py-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-icon"><circle cx="12" cy="12" r="7" /></svg>
            <span class="text-xs text-dim">Legs</span>
            <span class="-mb-1 mt-0.5 flex rotate-90 text-faint"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg></span>
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <div class="grid grid-cols-2 gap-1 rounded-[18px] border border-line bg-surface p-1 shadow-card">
          <span class="flex h-11 items-center justify-center rounded-xl text-sm font-medium text-muted">Semanal</span>
          <span class="flex h-11 items-center justify-center rounded-xl bg-accent text-sm font-bold text-hero-ink">Rotación continua</span>
        </div>
        <span class="px-1 text-xs text-dim">Avanza al completar un entreno. Si no entrenas, te espera.</span>
      </div>
    </template>
  </TourStep>
</template>
