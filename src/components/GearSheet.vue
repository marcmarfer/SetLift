<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSheetDrag } from '../composables/useSheetDrag'
import { GEAR_OPTIONS, gearLabel, normalGear, sameGear } from '../lib/gear'
import type { Gear } from '../types'

const props = defineProps<{
  sets: Array<readonly Gear[] | null | undefined>
  position: number
  exerciseName: string
  subtitle: string
}>()

const emit = defineEmits<{
  (event: 'apply', gear: Gear[], all: boolean, position: number): void
  (event: 'close'): void
}>()

const panel = ref<HTMLElement | null>(null)
const drag = useSheetDrag(panel, () => emit('close'))

const uniform = props.sets.every((gear) => sameGear(gear, props.sets[0]))
const chosen = ref<number | 'all'>(uniform && props.sets.length > 1 ? 'all' : props.position)
const picked = ref<Gear[]>(normalGear(props.sets[uniform ? 0 : props.position]))

function choose(position: number | 'all') {
  chosen.value = position
  if (position !== 'all') picked.value = normalGear(props.sets[position])
}

function toggle(value: Gear) {
  picked.value = picked.value.includes(value)
    ? picked.value.filter((item) => item !== value)
    : normalGear([...picked.value, value])
}

const preview = computed(() => gearLabel(picked.value) || 'Sin material')

function apply() {
  if (chosen.value === 'all') emit('apply', picked.value, true, props.position)
  else emit('apply', picked.value, false, chosen.value)
}
</script>

<template>
  <div class="absolute inset-0 z-20 flex flex-col justify-end bg-black/40" @click.self="emit('close')">
    <div ref="panel" class="flex max-h-[92%] flex-col gap-3.5 overflow-y-auto rounded-t-[28px] border-t border-line-btn bg-surface px-4 pb-4">
      <div class="flex shrink-0 touch-none select-none flex-col gap-3.5 pt-3" @pointerdown="drag">
        <div class="flex justify-center">
          <span class="h-1 w-9 rounded-sm bg-line-btn" />
        </div>

        <div class="flex flex-col gap-1">
          <h2 class="text-lg font-bold tracking-[-0.01em]">Material · {{ exerciseName }}</h2>
          <p class="text-[12.5px] text-muted"><span class="font-semibold text-ink">{{ preview }}</span></p>
          <p class="text-[12.5px] text-muted">{{ subtitle }}</p>
        </div>
      </div>

      <div v-if="sets.length > 1" class="flex flex-col gap-2">
        <span class="text-[13px] text-muted">Serie</span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="(_, spot) in sets"
            :key="spot"
            class="num flex h-11 min-w-11 flex-grow items-center justify-center rounded-xl border px-2 text-[13px] font-semibold"
            :class="chosen === spot ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-btn bg-surface-2'"
            type="button"
            @click="choose(spot)"
          >{{ spot + 1 }}</button>
          <button
            class="flex h-11 flex-grow items-center justify-center rounded-xl border px-3 text-[13px] font-semibold"
            :class="chosen === 'all' ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-btn bg-surface-2'"
            type="button"
            @click="choose('all')"
          >Todas</button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-[13px] text-muted">Material</span>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="option in GEAR_OPTIONS"
            :key="option.value"
            class="flex h-11 items-center justify-center rounded-xl border text-[13px] font-semibold"
            :class="picked.includes(option.value) ? 'border-accent bg-accent text-hero-ink' : 'border-line-btn bg-surface-2 text-muted'"
            type="button"
            :aria-pressed="picked.includes(option.value)"
            @click="toggle(option.value)"
          >{{ option.label }}</button>
        </div>
      </div>

      <button
        class="flex h-13 shrink-0 items-center justify-center rounded-2xl bg-accent text-sm font-bold text-hero-ink"
        type="button"
        @click="apply"
      >{{ chosen === 'all' ? 'Aplicar a todas las series' : `Aplicar a la serie ${chosen + 1}` }}</button>
    </div>
  </div>
</template>
