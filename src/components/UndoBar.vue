<script setup lang="ts">
import { useUndoStore } from '../stores/undo'

const undo = useUndoStore()
</script>

<template>
  <div
    v-if="undo.message"
    class="px-3 pb-2 transition-opacity ease-linear"
    :class="undo.fading ? 'opacity-0' : 'opacity-100'"
    :style="{ transitionDuration: `${undo.fadeMs}ms` }"
  >
    <div class="flex items-center gap-3 rounded-2xl bg-hero px-4 py-2.5 shadow-hero">
      <span class="flex-grow text-[13px] text-hero-ink">{{ undo.message }}</span>
      <button class="h-10 rounded-xl bg-accent px-4 text-[13px] font-bold text-hero-ink" type="button" @click="undo.undo()">
        Deshacer
      </button>
    </div>
  </div>
</template>
