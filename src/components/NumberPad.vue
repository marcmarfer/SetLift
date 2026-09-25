<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  field: 'weight' | 'reps'
  value: number | null
  context: string
  hint: number | null
}>()

const emit = defineEmits<{
  (event: 'commit', value: number | null): void
  (event: 'next', value: number | null): void
  (event: 'close'): void
}>()

const draft = ref(props.value == null ? '' : String(props.value).replace('.', ','))

watch(
  () => props.value,
  (value) => {
    draft.value = value == null ? '' : String(value).replace('.', ',')
  },
)

const parsed = computed(() => {
  const clean = draft.value.replace(',', '.')
  if (clean === '') return null
  const value = Number(clean)
  return Number.isFinite(value) ? value : null
})

const quickReps = computed(() => {
  const base = props.hint ?? 10
  return Array.from({ length: 7 }, (_, index) => Math.max(1, base - 2 + index))
})

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0']

function press(key: string) {
  if (key === ',' && draft.value.includes(',')) return
  draft.value += key
  emit('commit', parsed.value)
}

function backspace() {
  draft.value = draft.value.slice(0, -1)
  emit('commit', parsed.value)
}

function step(amount: number) {
  const current = parsed.value ?? 0
  const next = Math.max(0, Math.round((current + amount) * 100) / 100)
  draft.value = String(next).replace('.', ',')
  emit('commit', parsed.value)
}

function pick(reps: number) {
  draft.value = String(reps)
  emit('commit', parsed.value)
}
</script>

<template>
  <div class="flex flex-col gap-3 rounded-t-[28px] border-t border-line-btn bg-surface px-3.5 pt-2.5 pb-4">
    <div class="flex justify-center">
      <span class="h-1 w-9 rounded-sm bg-line-btn" />
    </div>

    <div class="flex items-center gap-2">
      <span class="text-[13px] font-semibold">{{ field === 'weight' ? 'Peso' : 'Reps' }}</span>
      <span class="flex-grow" />
      <span class="text-xs text-dim">{{ context }}</span>
    </div>

    <div v-if="field === 'reps'" class="flex items-center gap-1.5 overflow-x-auto">
      <button
        v-for="reps in quickReps"
        :key="reps"
        class="num flex h-12 w-11 flex-shrink-0 items-center justify-center rounded-xl border text-[15px]"
        :class="String(reps) === draft
          ? 'border-accent bg-accent-soft font-bold'
          : 'border-line-btn bg-surface-2 text-muted'"
        type="button"
        @click="pick(reps)"
      >{{ reps }}</button>
    </div>

    <div v-else class="flex items-center gap-2">
      <button class="num h-14 w-[74px] rounded-2xl border border-line-btn bg-surface-2 text-[15px] font-semibold" type="button" @click="step(-2.5)">−2,5</button>
      <div class="num flex h-14 flex-grow items-center justify-center gap-1 rounded-2xl border border-line-btn bg-app">
        <span class="text-[22px] font-bold">{{ draft || '—' }}</span>
        <span class="text-[13px] text-dim">kg</span>
      </div>
      <button class="num h-14 w-[74px] rounded-2xl border border-line-btn bg-surface-2 text-[15px] font-semibold" type="button" @click="step(2.5)">+2,5</button>
    </div>

    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="key in keys"
        :key="key"
        class="num h-13 rounded-2xl border border-line-btn bg-surface-2 text-[19px] font-medium"
        type="button"
        @click="press(key)"
      >{{ key }}</button>
      <button class="flex h-13 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-muted" type="button" @click="backspace()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 5H9l-5 7 5 7h12z" /><path d="M15 9.5l-4 5M11 9.5l4 5" />
        </svg>
      </button>
    </div>

    <button
      class="flex h-14 items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink"
      type="button"
      @click="emit('next', parsed)"
    >Siguiente</button>
  </div>
</template>
