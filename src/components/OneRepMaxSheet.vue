<script setup lang="ts">
import { ref } from 'vue'
import { today } from '../lib/dates'
import Calendar from './Calendar.vue'
import NumberPad from './NumberPad.vue'

const props = defineProps<{
  name: string
  weight: number | null
  date: string | null
}>()

const emit = defineEmits<{
  (event: 'save', payload: { weight: number; date: string }): void
  (event: 'clear'): void
  (event: 'close'): void
}>()

const step = ref<'weight' | 'date'>('weight')
const draftWeight = ref<number | null>(props.weight)
const draftDate = ref(props.date ?? today())

function goToDate(value: number | null) {
  if (value == null || value <= 0) return
  draftWeight.value = value
  step.value = 'date'
}

function save() {
  if (draftWeight.value == null || draftWeight.value <= 0) return
  emit('save', { weight: draftWeight.value, date: draftDate.value })
}

const format = (value: number) => String(value).replace('.', ',')
</script>

<template>
  <div class="absolute inset-0 z-20 flex flex-col justify-end bg-black/40" @click.self="emit('close')">
    <NumberPad
      v-if="step === 'weight'"
      field="weight"
      :value="draftWeight"
      :context="`${name} · 1RM real`"
      :hint="null"
      @commit="draftWeight = $event"
      @next="goToDate"
      @close="emit('close')"
    />

    <div v-else class="flex max-h-[92%] flex-col gap-3 rounded-t-[28px] border-t border-line-btn bg-surface px-4 pt-3 pb-4">
      <div class="flex shrink-0 justify-center"><span class="h-1 w-9 rounded-sm bg-line-btn" /></div>

      <div class="flex shrink-0 items-start gap-3">
        <div class="flex flex-grow flex-col gap-1">
          <h2 class="text-lg font-bold tracking-[-0.01em]">¿Qué día lo hiciste?</h2>
          <button class="num self-start text-[12.5px] font-semibold text-accent" type="button" @click="step = 'weight'">
            {{ draftWeight == null ? '—' : format(draftWeight) }} kg · cambiar
          </button>
        </div>
        <button
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-muted"
          type="button"
          aria-label="Cerrar"
          @click="emit('close')"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div class="-mr-2 flex flex-col overflow-y-auto pr-2"><Calendar v-model="draftDate" compact /></div>

      <button
        class="flex h-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink"
        type="button"
        @click="save"
      >Guardar</button>

      <button
        v-if="weight != null"
        class="flex h-12 shrink-0 items-center justify-center text-sm font-semibold text-danger"
        type="button"
        @click="emit('clear')"
      >Quitar el 1RM a mano</button>
    </div>
  </div>
</template>
