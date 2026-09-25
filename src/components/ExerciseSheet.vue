<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ExerciseDraft, ExerciseUsage } from '../lib/exercises'

const props = defineProps<{
  title: string
  groups: string[]
  draft?: ExerciseDraft
  usage?: ExerciseUsage | null
}>()

const emit = defineEmits<{
  (event: 'save', draft: ExerciseDraft): void
  (event: 'remove'): void
  (event: 'merge'): void
  (event: 'close'): void
}>()

const used = computed(() => (props.usage?.sets ?? 0) > 0)

const removeLabel = computed(() => {
  const usage = props.usage
  if (!usage) return ''
  const parts: string[] = []
  if (usage.sets) {
    parts.push(`${usage.sets} ${usage.sets === 1 ? 'serie' : 'series'} en ${usage.sessions} ${usage.sessions === 1 ? 'entreno' : 'entrenos'}`)
  }
  if (usage.routines.length) {
    parts.push(`${usage.routines.length} ${usage.routines.length === 1 ? 'rutina' : 'rutinas'}`)
  }
  return parts.join(' · ')
})

const name = ref(props.draft?.name ?? '')
const group = ref(props.draft?.group ?? '')
const bodyweight = ref(props.draft?.bodyweight ?? false)

function save() {
  if (!name.value.trim() || !group.value.trim()) return
  emit('save', { name: name.value, group: group.value, bodyweight: bodyweight.value })
}
</script>

<template>
  <div class="absolute inset-0 z-30 flex flex-col justify-end bg-black/40" @click.self="emit('close')">
    <div class="flex max-h-[92%] flex-col gap-3.5 overflow-y-auto rounded-t-[28px] border-t border-line-btn bg-surface px-4 pt-3 pb-4">
      <div class="flex shrink-0 justify-center"><span class="h-1 w-9 rounded-sm bg-line-btn" /></div>

      <div class="flex shrink-0 items-start gap-3">
        <h2 class="flex-grow text-lg font-bold tracking-[-0.01em]">{{ title }}</h2>
        <button
          class="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-muted"
          type="button"
          @click="emit('close')"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="text-[11.5px] font-medium tracking-[0.04em] text-faint">Nombre</span>
        <input
          v-model="name"
          class="h-14 rounded-2xl border border-line-btn bg-app px-4 text-[15px] outline-none focus:border-accent"
          type="text"
          placeholder="Remo en punta"
        />
      </label>

      <div class="flex flex-col gap-1.5">
        <span class="text-[11.5px] font-medium tracking-[0.04em] text-faint">Grupo</span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="option in groups"
            :key="option"
            class="flex h-11 items-center rounded-xl border px-3.5 text-[13px] font-semibold"
            :class="group === option
              ? 'border-accent bg-accent text-hero-ink'
              : 'border-line-btn bg-surface-2 text-muted'"
            type="button"
            @click="group = option"
          >{{ option }}</button>
        </div>
        <input
          v-model="group"
          class="h-14 rounded-2xl border border-line-btn bg-app px-4 text-[15px] outline-none focus:border-accent"
          type="text"
          placeholder="O escribe uno nuevo"
        />
      </div>

      <button
        class="flex h-14 items-center gap-2.5 rounded-2xl border border-line-btn bg-surface-2 px-3.5"
        type="button"
        role="switch"
        :aria-checked="bodyweight"
        @click="bodyweight = !bodyweight"
      >
        <span class="flex flex-grow flex-col items-start gap-0.5">
          <span class="text-[15px] font-semibold">A peso corporal</span>
          <span class="text-[11.5px] text-faint">Dominadas, fondos…</span>
        </span>
        <span class="flex h-7 w-12 items-center rounded-full p-0.5 transition-colors" :class="bodyweight ? 'bg-accent' : 'bg-line-btn'">
          <span class="h-6 w-6 rounded-full bg-surface shadow-card transition-transform" :class="bodyweight ? 'translate-x-5' : ''" />
        </span>
      </button>

      <button
        class="flex h-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink disabled:opacity-50"
        type="button"
        :disabled="!name.trim() || !group.trim()"
        @click="save"
      >Guardar</button>

      <template v-if="usage">
        <div class="flex shrink-0 items-center gap-3 pt-1">
          <span class="h-px flex-grow bg-line" />
        </div>

        <button
          v-if="used"
          class="flex h-13 shrink-0 items-center gap-2.5 rounded-2xl border border-line-btn bg-surface-2 px-3.5 text-left"
          type="button"
          @click="emit('merge')"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><path d="M7 4v6a4 4 0 0 0 4 4h8" /><path d="M17 4v6a4 4 0 0 1-4 4H5" /><path d="M16 11l3 3-3 3" /></svg>
          <span class="flex flex-grow flex-col gap-0.5">
            <span class="text-[14.5px] font-semibold">Fusionar con otro ejercicio</span>
            <span class="text-[11.5px] text-faint">Conserva el historial</span>
          </span>
        </button>

        <button
          class="flex h-13 shrink-0 items-center gap-2.5 rounded-2xl border border-line-btn bg-surface-2 px-3.5 text-left text-danger"
          type="button"
          @click="emit('remove')"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 7h14" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" />
          </svg>
          <span class="flex flex-grow flex-col gap-0.5">
            <span class="text-[14.5px] font-semibold">Borrar ejercicio</span>
            <span v-if="removeLabel" class="text-[11.5px] text-faint">{{ removeLabel }}</span>
          </span>
        </button>
      </template>
    </div>
  </div>
</template>
