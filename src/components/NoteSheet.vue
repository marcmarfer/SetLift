<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSheetDrag } from '../composables/useSheetDrag'

const props = defineProps<{
  value: string | null
  exerciseName: string
}>()

const emit = defineEmits<{
  (event: 'apply', value: string | null): void
  (event: 'close'): void
}>()

const panel = ref<HTMLElement | null>(null)
const field = ref<HTMLTextAreaElement | null>(null)
const drag = useSheetDrag(panel, () => emit('close'))

const draft = ref(props.value ?? '')

onMounted(() => field.value?.focus())

const apply = () => emit('apply', draft.value.trim() || null)
</script>

<template>
  <div class="absolute inset-0 z-20 flex flex-col justify-end bg-black/40" @click.self="emit('close')">
    <div ref="panel" class="flex max-h-[92%] flex-col gap-3.5 overflow-y-auto rounded-t-[28px] border-t border-line-btn bg-surface px-4 pb-4">
      <div class="flex shrink-0 touch-none select-none flex-col gap-3.5 pt-3" @pointerdown="drag">
        <div class="flex justify-center">
          <span class="h-1 w-9 rounded-sm bg-line-btn" />
        </div>

        <div class="flex flex-col gap-1">
          <h2 class="text-lg font-bold tracking-[-0.01em]">Nota · {{ exerciseName }}</h2>
          <p class="text-[12.5px] text-muted">Solo para este día. La verás la próxima vez que hagas el ejercicio.</p>
        </div>
      </div>

      <textarea
        ref="field"
        v-model="draft"
        class="min-h-28 resize-none rounded-2xl border border-line-btn bg-app px-4 py-3 text-[15px] leading-snug outline-none focus:border-accent"
        maxlength="280"
        placeholder="Tríceps cargado del día anterior, me costó"
      />

      <button
        class="flex h-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink"
        type="button"
        @click="apply"
      >Guardar</button>

      <button
        v-if="value"
        class="flex h-12 shrink-0 items-center justify-center text-sm font-semibold text-danger"
        type="button"
        @click="emit('apply', null)"
      >Borrar la nota</button>
    </div>
  </div>
</template>
