<script setup lang="ts">
import TourStep from './TourStep.vue'
</script>

<template>
  <TourStep kicker="El progreso" title="Sabes cuándo subir">
    Cuando todas las series llegan al tope del rango, la siguiente hoja ya trae más peso. En <span class="font-semibold text-ink">Progreso</span> ves cómo evoluciona cada ejercicio.
    <template #mockup>
      <div class="flex flex-col rounded-[18px] border border-line bg-surface px-3.5 py-3 shadow-card">
        <span class="pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint">La próxima vez</span>
        <div class="flex flex-col gap-0.5 py-2">
          <div class="flex items-center gap-2.5">
            <span class="flex-grow truncate text-sm">Remo con barra</span>
            <span class="num text-[13px] text-muted">12 · 12 · 12</span>
          </div>
          <span class="num text-[12.5px] font-semibold text-accent-ink">↑ la próxima vez, 62,5 kg</span>
        </div>
        <div class="flex flex-col gap-0.5 border-t border-line py-2">
          <div class="flex items-center gap-2.5">
            <span class="flex-grow truncate text-sm">Dominadas</span>
            <span class="num text-[13px] text-muted">8 · 7 · 6</span>
          </div>
          <span class="num text-[12.5px] text-dim">te faltan 3 reps para subir a lastre +12,5 kg</span>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <span class="px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Remo con barra · 1RM estimado</span>
        <div class="rounded-[20px] border border-line bg-surface px-3 pb-2.5 pt-3.5 shadow-card">
          <svg viewBox="0 0 320 150" class="block h-[150px] w-full">
            <defs>
              <linearGradient id="tourFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--c-accent)" stop-opacity="0.34" />
                <stop offset="100%" stop-color="var(--c-accent)" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            <line x1="28" y1="20" x2="308" y2="20" stroke="var(--c-border)" stroke-width="1" />
            <line x1="28" y1="132" x2="308" y2="132" stroke="var(--c-border)" stroke-width="1" />
            <text x="0" y="24" fill="var(--c-icon)" font-size="9" class="num">84</text>
            <text x="0" y="136" fill="var(--c-icon)" font-size="9" class="num">72</text>
            <path d="M30.0,120.0 L68.6,107.5 L107.1,103.3 L145.7,86.7 L184.3,90.8 L222.9,70.0 L261.4,53.3 L300.0,20.0 L300.0,132 L30.0,132 Z" fill="url(#tourFill)" />
            <polyline points="30.0,120.0 68.6,107.5 107.1,103.3 145.7,86.7 184.3,90.8 222.9,70.0 261.4,53.3 300.0,20.0" fill="none" stroke="var(--c-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="300" cy="20" r="5" fill="var(--c-accent)" stroke="var(--c-surface)" stroke-width="2.5" />
          </svg>
        </div>
      </div>
    </template>
  </TourStep>
</template>
