<script setup lang="ts">
import { useInstallPrompt } from '../composables/useInstallPrompt'
import TourStep from './TourStep.vue'

const { mode } = useInstallPrompt()
</script>

<template>
  <TourStep kicker="En tu móvil" title="Tenla a un toque">
    <template v-if="mode === 'ios'">
      En Safari, toca <span class="font-semibold text-ink">Compartir</span> y luego <span class="font-semibold text-ink">Añadir a pantalla de inicio</span>. Si prefieres hacerlo luego, lo tienes en Cuenta.
    </template>
    <template v-else>
      Instálala en la pantalla de inicio: se abre al momento, a pantalla completa y sin cobertura. Si prefieres hacerlo luego, lo tienes en Cuenta.
    </template>
    <template #mockup>
      <div class="flex flex-col items-center gap-5 pt-6">
        <div class="grid grid-cols-4 gap-x-5 gap-y-4 rounded-[30px] bg-hero p-5 shadow-hero">
          <span v-for="slot in 7" :key="slot" class="h-13 w-13 rounded-[14px] bg-hero-surface" />
          <span class="flex flex-col items-center gap-1.5">
            <img src="/icon-192.png" alt="" class="h-13 w-13 rounded-[14px] ring-2 ring-accent ring-offset-2 ring-offset-hero" />
            <span class="text-[10px] font-semibold text-hero-ink">SetLift</span>
          </span>
        </div>
        <div v-if="mode === 'ios'" class="flex w-full flex-col rounded-[20px] border border-line bg-surface px-3.5 shadow-card">
          <div class="flex h-13 items-center gap-3 text-[14.5px]">
            <span class="flex-grow">Compartir</span>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="text-accent"><path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
          </div>
          <div class="flex h-13 items-center gap-3 border-t border-line text-[14.5px] font-semibold">
            <span class="flex-grow">Añadir a pantalla de inicio</span>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="text-accent"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8.5v7M8.5 12h7" /></svg>
          </div>
        </div>
      </div>
    </template>
  </TourStep>
</template>
