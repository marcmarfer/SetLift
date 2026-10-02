<script setup lang="ts">
import { useInstallPrompt } from '../composables/useInstallPrompt'

const { mode, install, dismiss } = useInstallPrompt()
</script>

<template>
  <div v-if="mode" class="px-3 pb-2">
    <div class="flex items-center gap-3 rounded-2xl bg-hero px-4 py-2.5 shadow-hero">
      <div class="flex-grow text-[13px] leading-snug">
        <p class="font-semibold text-hero-ink">Instala SetLift</p>
        <p v-if="mode === 'native'" class="text-hero-muted">Ábrela desde la pantalla de inicio, también sin conexión.</p>
        <p v-else class="text-hero-muted">
          Toca
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline -mt-0.5"><path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
          Compartir y luego «Añadir a pantalla de inicio».
        </p>
      </div>
      <button
        v-if="mode === 'native'"
        class="h-10 shrink-0 rounded-xl bg-accent px-4 text-[13px] font-bold text-hero-ink"
        type="button"
        @click="install"
      >
        Instalar
      </button>
      <button
        class="grid h-10 w-8 shrink-0 place-items-center text-hero-muted"
        type="button"
        aria-label="Cerrar"
        @click="dismiss"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  </div>
</template>
