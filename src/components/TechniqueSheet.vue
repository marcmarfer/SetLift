<script setup lang="ts">
import { computed, ref } from 'vue'
import { SECONDS_RANGE, TECHNIQUE_MAX, readTechnique, writeTechnique } from '../lib/technique'

const props = defineProps<{
  value: string | null
  exerciseName: string
  subtitle: string
}>()

const emit = defineEmits<{
  (event: 'apply', value: string | null): void
  (event: 'close'): void
}>()

const draft = ref(readTechnique(props.value))

const preview = computed(() => writeTechnique(draft.value) ?? 'Normal')

const clamp = (value: number) => Math.min(SECONDS_RANGE.max, Math.max(SECONDS_RANGE.min, value))

function shift(field: 'pauseSec' | 'tempoSec', step: number) {
  draft.value[field] = clamp(draft.value[field] + step)
}
</script>

<template>
  <div class="absolute inset-0 z-20 flex flex-col justify-end bg-black/40" @click.self="emit('close')">
    <div class="flex max-h-[92%] flex-col gap-3.5 overflow-y-auto rounded-t-[28px] border-t border-line-btn bg-surface px-4 pt-3 pb-4">
      <div class="flex shrink-0 justify-center">
        <span class="h-1 w-9 rounded-sm bg-line-btn" />
      </div>

      <div class="flex shrink-0 items-start gap-3">
        <div class="flex flex-grow flex-col gap-1">
          <h2 class="text-lg font-bold tracking-[-0.01em]">Técnica · {{ exerciseName }}</h2>
          <p class="text-[12.5px] text-muted">{{ subtitle }}</p>
        </div>
        <button
          class="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-muted"
          type="button"
          @click="emit('close')"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div class="grid grid-cols-3 gap-1.5">
        <button
          class="flex h-11 items-center justify-center rounded-xl border text-[13px] font-semibold"
          :class="draft.pause ? 'border-accent bg-accent text-hero-ink' : 'border-line-btn bg-surface-2 text-muted'"
          type="button"
          :aria-pressed="draft.pause"
          @click="draft.pause = !draft.pause"
        >Pausa</button>
        <button
          class="flex h-11 items-center justify-center rounded-xl border text-[13px] font-semibold"
          :class="draft.tempo ? 'border-accent bg-accent text-hero-ink' : 'border-line-btn bg-surface-2 text-muted'"
          type="button"
          :aria-pressed="draft.tempo"
          @click="draft.tempo = !draft.tempo"
        >Tempo</button>
        <button
          class="flex h-11 items-center justify-center rounded-xl border text-[13px] font-semibold"
          :class="draft.custom ? 'border-accent bg-accent text-hero-ink' : 'border-line-btn bg-surface-2 text-muted'"
          type="button"
          :aria-pressed="draft.custom"
          @click="draft.custom = !draft.custom"
        >Otra</button>
      </div>

      <div v-if="draft.pause || draft.tempo" class="flex flex-col gap-2 rounded-2xl border border-line bg-app p-3">
        <div v-if="draft.pause" class="flex items-center gap-2.5">
          <span class="flex-grow text-[13px] text-muted">Segundos de pausa</span>
          <button class="flex h-10 w-10 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shift('pauseSec', -1)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14" /></svg>
          </button>
          <span class="num w-12 text-center text-[17px] font-bold">{{ draft.pauseSec }} s</span>
          <button class="flex h-10 w-10 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shift('pauseSec', 1)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
        <div v-if="draft.tempo" class="flex items-center gap-2.5">
          <span class="flex-grow text-[13px] text-muted">Segundos de bajada</span>
          <button class="flex h-10 w-10 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shift('tempoSec', -1)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14" /></svg>
          </button>
          <span class="num w-12 text-center text-[17px] font-bold">{{ draft.tempoSec }} s</span>
          <button class="flex h-10 w-10 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shift('tempoSec', 1)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </div>

      <input
        v-if="draft.custom"
        v-model="draft.text"
        class="h-13 rounded-2xl border border-line-btn bg-app px-4 text-[15px] outline-none focus:border-accent"
        :maxlength="TECHNIQUE_MAX"
        placeholder="Pines, cadenas, déficit…"
        aria-label="Otra técnica"
        @keyup.enter="emit('apply', writeTechnique(draft))"
      />

      <button
        class="flex h-13 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-accent text-sm font-bold text-hero-ink"
        type="button"
        @click="emit('apply', writeTechnique(draft))"
      >Aplicar <span class="font-semibold opacity-80">· {{ preview }}</span></button>
    </div>
  </div>
</template>
