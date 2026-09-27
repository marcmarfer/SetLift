<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  EFFORT_MODES,
  RANGE_PRESETS,
  REPS_MODES,
  RIR_PRESETS,
  RPE_STEPS,
  allowsEffort,
  effortOf,
  repsOf,
  shortLabel,
} from '../lib/targets'
import type { EffortTarget, RepsTarget, SetTemplate } from '../types'

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

const reps = ref<RepsTarget>(repsOf(props.template))
const effort = ref<EffortTarget | null>(effortOf(props.template))

const fixedReps = ref(props.template.reps ?? 5)
const repsMin = ref(props.template.repsMin ?? 8)
const repsMax = ref(props.template.repsMax ?? 12)
const rirMin = ref(props.template.rirMin ?? 1)
const rirMax = ref(props.template.rirMax ?? props.template.rirMin ?? 2)
const rpe = ref(props.template.rpe ?? 8)

const customRange = ref(
  reps.value === 'range' && !RANGE_PRESETS.some(([min, max]) => min === repsMin.value && max === repsMax.value),
)
const customRir = ref(
  effort.value === 'rir' && !RIR_PRESETS.some(([min, max]) => min === rirMin.value && max === rirMax.value),
)

const effortModes = computed(() => EFFORT_MODES.filter((mode) => allowsEffort(reps.value, mode.value)))

watch(reps, (value) => {
  if (!allowsEffort(value, effort.value)) effort.value = null
})

const activeRange = computed(() =>
  customRange.value ? null : RANGE_PRESETS.findIndex(([min, max]) => min === repsMin.value && max === repsMax.value),
)
const activeRir = computed(() =>
  customRir.value ? null : RIR_PRESETS.findIndex(([min, max]) => min === rirMin.value && max === rirMax.value),
)

const bound = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

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

function shiftFixed(step: number) {
  fixedReps.value = bound(fixedReps.value + step, 1, 50)
}

function shiftRepsMin(step: number) {
  repsMin.value = bound(repsMin.value + step, 1, 50)
  if (repsMax.value < repsMin.value) repsMax.value = repsMin.value
}

function shiftRepsMax(step: number) {
  repsMax.value = bound(repsMax.value + step, 1, 50)
  if (repsMin.value > repsMax.value) repsMin.value = repsMax.value
}

function shiftRirMin(step: number) {
  rirMin.value = bound(rirMin.value + step, 0, 6)
  if (rirMax.value < rirMin.value) rirMax.value = rirMin.value
}

function shiftRirMax(step: number) {
  rirMax.value = bound(rirMax.value + step, 0, 6)
  if (rirMin.value > rirMax.value) rirMin.value = rirMax.value
}

const changes = computed<Partial<SetTemplate>>(() => ({
  type: reps.value,
  reps: reps.value === 'fixed' ? fixedReps.value : reps.value === 'single' ? 1 : undefined,
  repsMin: reps.value === 'range' ? repsMin.value : undefined,
  repsMax: reps.value === 'range' ? repsMax.value : undefined,
  effort: effort.value ?? undefined,
  rpe: effort.value === 'rpe' ? rpe.value : undefined,
  rirMin: effort.value === 'rir' ? rirMin.value : undefined,
  rirMax: effort.value === 'rir' ? rirMax.value : undefined,
}))

const preview = computed(() => shortLabel({ ...props.template, ...changes.value }))
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
          <p class="text-[12.5px] text-muted">{{ exerciseName }} · <span class="num font-semibold text-ink">{{ preview }}</span></p>
        </div>
        <button
          class="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-muted"
          type="button"
          @click="emit('close')"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-[13px] text-muted">Repeticiones</span>
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="option in REPS_MODES"
            :key="option.value"
            class="flex h-11 items-center justify-center rounded-xl border text-[12.5px] font-semibold"
            :class="reps === option.value ? 'border-accent bg-accent text-hero-ink' : 'border-line-btn bg-surface-2 text-muted'"
            type="button"
            @click="reps = option.value"
          >{{ option.label }}</button>
        </div>

        <template v-if="reps === 'range'">
          <div class="grid grid-cols-4 gap-1.5">
            <button
              v-for="(preset, spot) in RANGE_PRESETS"
              :key="preset.join('-')"
              class="num flex h-11 items-center justify-center rounded-xl border text-[14px] font-semibold"
              :class="activeRange === spot ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-btn bg-surface-2'"
              type="button"
              @click="pickRange(preset)"
            >{{ preset[0] }}–{{ preset[1] }}</button>
            <button
              class="flex h-11 items-center justify-center rounded-xl border text-[13px] font-semibold"
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
        </template>

        <div v-else-if="reps === 'fixed'" class="flex items-center gap-2.5 rounded-2xl border border-line bg-app p-3">
          <span class="flex-grow text-[13px] text-muted">Repeticiones</span>
          <button class="flex h-11 w-11 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shiftFixed(-1)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14" /></svg>
          </button>
          <span class="num w-10 text-center text-xl font-bold">{{ fixedReps }}</span>
          <button class="flex h-11 w-11 items-center justify-center rounded-xl border border-line-btn bg-surface text-muted" type="button" @click="shiftFixed(1)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-[13px] text-muted">Esfuerzo</span>
        <div class="grid gap-1.5" :style="{ gridTemplateColumns: `repeat(${effortModes.length}, minmax(0, 1fr))` }">
          <button
            v-for="option in effortModes"
            :key="option.label"
            class="flex h-11 items-center justify-center rounded-xl border px-1 text-[12.5px] font-semibold"
            :class="effort === option.value ? 'border-accent bg-accent text-hero-ink' : 'border-line-btn bg-surface-2 text-muted'"
            type="button"
            @click="effort = option.value"
          >{{ option.label }}</button>
        </div>

        <div v-if="effort === 'rpe'" class="grid grid-cols-6 gap-1.5">
          <button
            v-for="step in RPE_STEPS"
            :key="step"
            class="num flex h-11 items-center justify-center rounded-xl border text-[14px] font-semibold"
            :class="rpe === step ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-btn bg-surface-2'"
            type="button"
            @click="rpe = step"
          >{{ String(step).replace('.', ',') }}</button>
        </div>

        <template v-else-if="effort === 'rir'">
          <div class="grid grid-cols-6 gap-1.5">
            <button
              v-for="(preset, spot) in RIR_PRESETS"
              :key="preset.join('-')"
              class="num flex h-11 items-center justify-center rounded-xl border text-[14px] font-semibold"
              :class="activeRir === spot ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-btn bg-surface-2'"
              type="button"
              @click="pickRir(preset)"
            >{{ preset[0] === preset[1] ? preset[0] : `${preset[0]}–${preset[1]}` }}</button>
            <button
              class="flex h-11 items-center justify-center rounded-xl border text-[13px] font-semibold"
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
        </template>
      </div>

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
