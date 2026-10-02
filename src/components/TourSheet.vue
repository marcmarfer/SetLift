<script setup lang="ts">
import TourStep from './TourStep.vue'
</script>

<template>
  <TourStep kicker="La hoja del día" title="Empiezas con un toque">
    <span class="font-semibold text-ink">Empezar</span> abre la hoja de hoy con los pesos ya puestos, también sin cobertura. ¿Entrenaste sin el móvil? Apúntalo luego, con su fecha.
    <template #mockup>
      <div class="flex flex-col gap-4 rounded-[30px] bg-hero p-5 shadow-hero">
        <div class="flex items-start gap-3">
          <div class="flex flex-grow flex-col gap-2">
            <span class="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">Toca hoy</span>
            <span class="text-4xl font-bold leading-none tracking-[-0.03em] text-hero-ink">Pull</span>
          </div>
          <div class="flex flex-col items-end gap-1.5">
            <span class="num text-[13px] text-hero-muted">hace 6 días</span>
            <span class="num flex h-6.5 items-center rounded-full bg-hero-surface px-2.5 text-[11.5px] text-hero-ink">9 series · 4065 kg</span>
          </div>
        </div>
        <p class="text-[12.5px] leading-[1.55] text-hero-muted">Remo con barra · Dominadas · Curl martillo</p>
        <span class="flex h-16 items-center justify-center gap-2.5 rounded-[32px] bg-accent text-[19px] font-bold tracking-[-0.01em] text-hero-ink">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
          Empezar
        </span>
      </div>
      <div class="flex h-12 items-center gap-2.5 text-sm text-muted">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /><path d="M12 14v4M10 16h4" /></svg>
        Apuntar o editar un entreno anterior
      </div>
    </template>
  </TourStep>
</template>
