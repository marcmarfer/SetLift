<script setup lang="ts">
import { computed, ref } from 'vue'
import { MODES, RANGE_PRESETS, RIR_PRESETS, rirLabel } from '../lib/targets'
import type { SetTemplate, SetType } from '../types'

const props = defineProps<{
  template: SetTemplate
  position: number
  count: number
  exerciseName: string
}>()

const emit = defineEmits<{
  (event: 'apply', changes: Partial<SetTemplate>, all: boolean): void
  (event: 'close'): void
}>()

const mode = ref<SetType>(props.template.type)
const reps = ref(props.template.reps ?? 8)
const repsMin = ref(props.template.repsMin ?? 8)
const repsMax = ref(props.template.repsMax ?? 12)
const rirMin = ref(props.template.rirMin ?? 1)
const rirMax = ref(props.template.rirMax ?? props.template.rirMin ?? 2)

const matchesRange = RANGE_PRESETS.some(
  ([min, max]) => props.template.repsMin === min && props.template.repsMax === max,
)
const matchesRir = RIR_PRESETS.some(
  ([min, max]) => props.template.rirMin === min && (props.template.rirMax ?? props.template.rirMin) === max,
)

const customRange = ref(props.template.type === 'range' && !matchesRange)
const customRir = ref(props.template.type === 'rir' && !matchesRir)

const activeRange = computed(() =>
  customRange.value ? null : RANGE_PRESETS.findIndex(([min, max]) => min === repsMin.value && max === repsMax.value),
)
const activeRir = computed(() =>
  customRir.value ? null : RIR_PRESETS.findIndex(([min, max]) => min === rirMin.value && max === rirMax.value),
)

function pickRange([min, max]: [number, number]) {
  repsMin.value = min
  repsMax.value = max
  customRange.value = false
}

function pickRir([min, max]: [number, number]) {
  rirMin.value = min
  rirMax.value = max
  customRir.value = false
}

function shiftReps(step: number) {
  reps.value = Math.min(50, Math.max(1, reps.value + step))
}

function shiftRepsMin(step: number) {
  repsMin.value = Math.min(50, Math.max(1, repsMin.value + step))
  if (repsMax.value < repsMin.value) repsMax.value = repsMin.value
}

function shiftRepsMax(step: number) {
  repsMax.value = Math.min(50, Math.max(1, repsMax.value + step))
  if (repsMin.value > repsMax.value) repsMin.value = repsMax.value
}

function shiftRirMin(step: number) {
  rirMin.value = Math.min(6, Math.max(0, rirMin.value + step))
  if (rirMax.value < rirMin.value) rirMax.value = rirMin.value
}

function shiftRirMax(step: number) {
  rirMax.value = Math.min(6, Math.max(0, rirMax.value + step))
  if (rirMin.value > rirMax.value) rirMin.value = rirMax.value
}

const changes = computed<Partial<SetTemplate>>(() => {
  const empty = {
    reps: undefined,
    repsMin: undefined,
    repsMax: undefined,
    rirMin: undefined,
    rirMax: undefined,
  }

  if (mode.value === 'failure') return { ...empty, type: 'failure' }
  if (mode.value === 'single') return { ...empty, type: 'single', reps: 1 }
  if (mode.value === 'fixed') return { ...empty, type: 'fixed', reps: reps.value }
  if (mode.value === 'rir') return { ...empty, type: 'rir', rirMin: rirMin.value, rirMax: rirMax.value }
  return { ...empty, type: 'range', repsMin: repsMin.value, repsMax: repsMax.value }
})

const preview = computed(() => {
  if (mode.value === 'failure') return 'Al fallo'
  if (mode.value === 'single') return 'Single'
  if (mode.value === 'fixed') return `${reps.value} reps`
  if (mode.value === 'rir') return rirLabel({ type: 'rir', rirMin: rirMin.value, rirMax: rirMax.value })
  return `${repsMin.value}–${repsMax.value} reps`
})
</script>

<template>
  <div class="absolute inset-0 z-20 flex flex-col justify-end bg-black/40" @click.self="emit('close')">
    <div class="flex max-h-[92%] flex-col gap-3.5 overflow-y-auto rounded-t-[28px] border-t border-line-btn bg-surface px-4 pt-3 pb-4">
      <div class="flex shrink-0 justify-center">
        <span class="h-1 w-9 rounded-sm bg-line-btn" />
      </div>

      <div class="flex shrink-0 items-start gap-3">
        <div class="flex flex-grow flex-col gap-1">
          <h2 class="text-lg font-bold tracking-[-0.01em]">Objetivo · serie {{ position + 1 }}</h2>
          <p class="text-[12.5px] text-muted">{{ exerciseName }} · ahora {{ preview }}</p>
        </div>
        <button
          class="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-muted"
          type="button"
          @click="emit('close')"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div class="grid grid-cols-5 gap-1.5">
        <button
          v-for="option in MODES"
          :key="option.value"
          class="flex h-11 items-center justify-center rounded-xl border px-0.5 text-[12px] font-semibold"
          :class="mode === option.value
            ? 'border-accent bg-accent text-hero-ink'
            : 'border-line-btn bg-surface-2 text-muted'"
          type="button"
          @click="mode = option.value"
        >{{ option.label }}</button>
      </div>

      <div v-if="mode === 'range'" class="flex flex-col gap-2.5">
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="(preset, spot) in RANGE_PRESETS"
            :key="preset.join('-')"
            class="num flex h-12 items-center justify-center rounded-xl border text-[14px] font-semibold"
            :class="activeRange === spot ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-btn bg-surface-2'"
            type="button"
            @click="pickRange(preset)"
          >{{ preset[0] }}–{{ preset[1] }}</button>
          <button
            class="flex h-12 items-center justify-center rounded-xl border text-[13px] font-semibold"
            :class="customRange ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-btn bg-surface-2 text-muted'"
            type="button"
            @click="customRange = true"
          >Otro</button>
        </div>

        <div v-if="customRange" class="flex flex-col gap-2 rounded-2xl border border-line bg-app p-3">
          <div class="flex items-center gap-2.5">
            <span class="flex-grow text-[13px] text-muted">Mínimo</span>
            <button class="flex h-10 w-10 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shiftRepsMin(-1)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14" /></svg>
            </button>
            <span class="num w-8 text-center text-[17px] font-bold">{{ repsMin }}</span>
            <button class="flex h-10 w-10 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shiftRepsMin(1)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
          <div class="flex items-center gap-2.5">
            <span class="flex-grow text-[13px] text-muted">Máximo</span>
            <button class="flex h-10 w-10 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shiftRepsMax(-1)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14" /></svg>
            </button>
            <span class="num w-8 text-center text-[17px] font-bold">{{ repsMax }}</span>
            <button class="flex h-10 w-10 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shiftRepsMax(1)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="mode === 'fixed'" class="flex items-center gap-2.5 rounded-2xl border border-line bg-app p-3">
        <span class="flex-grow text-[13px] text-muted">Repeticiones</span>
        <button class="flex h-11 w-11 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shiftReps(-1)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14" /></svg>
        </button>
        <span class="num w-10 text-center text-xl font-bold">{{ reps }}</span>
        <button class="flex h-11 w-11 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shiftReps(1)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>

      <div v-else-if="mode === 'rir'" class="flex flex-col gap-2.5">
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="(preset, spot) in RIR_PRESETS"
            :key="preset.join('-')"
            class="num flex h-12 items-center justify-center rounded-xl border text-[14px] font-semibold"
            :class="activeRir === spot ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-btn bg-surface-2'"
            type="button"
            @click="pickRir(preset)"
          >{{ preset[0] === preset[1] ? preset[0] : `${preset[0]}–${preset[1]}` }}</button>
          <button
            class="flex h-12 items-center justify-center rounded-xl border text-[13px] font-semibold"
            :class="customRir ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-btn bg-surface-2 text-muted'"
            type="button"
            @click="customRir = true"
          >Otro</button>
        </div>

        <div v-if="customRir" class="flex flex-col gap-2 rounded-2xl border border-line bg-app p-3">
          <div class="flex items-center gap-2.5">
            <span class="flex-grow text-[13px] text-muted">RIR mínimo</span>
            <button class="flex h-10 w-10 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shiftRirMin(-1)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14" /></svg>
            </button>
            <span class="num w-8 text-center text-[17px] font-bold">{{ rirMin }}</span>
            <button class="flex h-10 w-10 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shiftRirMin(1)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
          <div class="flex items-center gap-2.5">
            <span class="flex-grow text-[13px] text-muted">RIR máximo</span>
            <button class="flex h-10 w-10 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shiftRirMax(-1)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14" /></svg>
            </button>
            <span class="num w-8 text-center text-[17px] font-bold">{{ rirMax }}</span>
            <button class="flex h-10 w-10 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shiftRirMax(1)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        </div>

        <p class="text-[12px] leading-relaxed text-dim">
          Reps en reserva al acabar la serie. RIR 0 es parar sin dejar ninguna, pero sin llegar al fallo.
        </p>
      </div>

      <p v-else-if="mode === 'single'" class="rounded-2xl border border-line bg-app p-3 text-[12.5px] leading-relaxed text-muted">
        Una sola repetición. El peso que muevas es tu 1RM real, no una estimación.
      </p>

      <p v-else class="rounded-2xl border border-line bg-app p-3 text-[12.5px] leading-relaxed text-muted">
        Hasta el fallo muscular: sin objetivo de repeticiones. Apuntas las que te salgan.
      </p>

      <div class="flex shrink-0 gap-2">
        <button
          v-if="count > 1"
          class="flex h-13 flex-grow items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-sm font-semibold"
          type="button"
          @click="emit('apply', changes, true)"
        >Todas las series</button>
        <button
          class="flex h-13 flex-grow items-center justify-center rounded-2xl bg-accent text-sm font-bold text-hero-ink"
          type="button"
          @click="emit('apply', changes, false)"
        >Solo la serie {{ position + 1 }}</button>
      </div>
    </div>
  </div>
</template>
