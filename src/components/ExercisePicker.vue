<script setup lang="ts">
import { computed, ref } from 'vue'
import Select from './Select.vue'
import { useLive } from '../composables/useLive'
import { db } from '../db'
import type { Exercise, ExerciseFamily } from '../types'

const props = defineProps<{
  title: string
  exercises: Exercise[]
  suggestedIds?: string[]
  subtitle?: string
}>()

const emit = defineEmits<{
  (event: 'pick', exerciseId: string): void
  (event: 'create', name: string): void
  (event: 'close'): void
}>()

type Entry =
  | { kind: 'exercise'; exercise: Exercise }
  | { kind: 'family'; family: ExerciseFamily; variants: Exercise[]; narrowed: boolean }

const search = ref('')
const group = ref('')
const openFamily = ref<string | null>(null)

const families = useLive<ExerciseFamily[]>(() => db.exerciseFamilies.toArray(), [])

const groupOptions = computed(() => [
  { value: '', label: 'Todos los grupos' },
  ...[...new Set(props.exercises.map((exercise) => exercise.group).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((name) => ({ value: name, label: name })),
])

const suggested = computed(() =>
  (props.suggestedIds ?? [])
    .map((id) => props.exercises.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is Exercise => Boolean(exercise)),
)

const contains = (text: string | undefined, term: string) => Boolean(text?.toLowerCase().includes(term))

const byOrder = (a: Exercise, b: Exercise) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'es')

const labelOf = (entry: Entry) => (entry.kind === 'family' ? entry.family.name : entry.exercise.name)

const entries = computed<Entry[]>(() => {
  const term = search.value.trim().toLowerCase()
  const familyById = new Map(families.value.map((family) => [family.id, family]))
  const members = new Map<string, Exercise[]>()
  const loose: Exercise[] = []

  for (const exercise of props.exercises) {
    if (group.value && exercise.group !== group.value) continue
    const family = exercise.familyId ? familyById.get(exercise.familyId) : undefined
    if (family) members.set(family.id, [...(members.get(family.id) ?? []), exercise])
    else loose.push(exercise)
  }

  const list: Entry[] = []

  for (const [id, variants] of members) {
    const family = familyById.get(id)!
    const whole = !term || contains(family.name, term) || contains(family.group, term)
    const hits = whole
      ? variants
      : variants.filter((exercise) => contains(exercise.name, term) || contains(exercise.variant, term))

    if (hits.length === 1) loose.push(hits[0])
    else if (hits.length > 1) list.push({ kind: 'family', family, variants: [...hits].sort(byOrder), narrowed: !whole })
  }

  for (const exercise of loose) {
    const kept = !term || contains(exercise.name, term) || contains(exercise.group, term) || contains(exercise.variant, term)
    if (kept) list.push({ kind: 'exercise', exercise })
  }

  return list.sort((a, b) => labelOf(a).localeCompare(labelOf(b), 'es'))
})

const count = computed(() =>
  entries.value.reduce((total, entry) => total + (entry.kind === 'family' ? entry.variants.length : 1), 0),
)

const isOpen = (entry: Extract<Entry, { kind: 'family' }>) => entry.narrowed || openFamily.value === entry.family.id

function toggle(familyId: string) {
  openFamily.value = openFamily.value === familyId ? null : familyId
}
</script>

<template>
  <div class="absolute inset-0 z-20 flex flex-col justify-end bg-black/40" @click.self="emit('close')">
    <div class="flex max-h-[86%] flex-col gap-3 rounded-t-[28px] border-t border-line-btn bg-surface px-4 pt-3 pb-4">
      <div class="flex shrink-0 justify-center">
        <span class="h-1 w-9 rounded-sm bg-line-btn" />
      </div>

      <div class="flex shrink-0 items-start gap-3">
        <div class="flex flex-grow flex-col gap-1">
          <h2 class="text-lg font-bold tracking-[-0.01em]">{{ title }}</h2>
          <p v-if="subtitle" class="text-[12.5px] text-muted">{{ subtitle }}</p>
        </div>
        <button
          class="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-muted"
          type="button"
          @click="emit('close')"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <label class="flex h-10 shrink-0 items-center gap-3 rounded-2xl border border-line-btn bg-app px-4 text-muted">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input
          v-model="search"
          class="h-full flex-grow bg-transparent text-[15px] text-ink outline-none placeholder:text-dim"
          placeholder="Buscar ejercicio"
          type="search"
        />
      </label>

      <div class="flex h-9 shrink-0 items-center gap-2">
        <Select
          v-model="group"
          :options="groupOptions"
          :trigger-class="`h-9 shrink-0 rounded-xl border px-3 text-[12.5px] font-semibold ${
            group ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-btn bg-surface-2 text-muted'
          }`"
        />
        <span class="num flex-grow text-right text-[11.5px] text-faint">
          {{ count }} {{ count === 1 ? 'ejercicio' : 'ejercicios' }}
        </span>
      </div>

      <div class="-mr-2 flex flex-col gap-2 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
        <template v-if="suggested.length && !search">
          <span class="px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Alternativas sugeridas</span>
          <button
            v-for="exercise in suggested"
            :key="`suggested-${exercise.id}`"
            class="flex min-h-[68px] items-center gap-3 rounded-2xl border border-line-btn bg-surface-2 px-3.5 py-3.5 text-left"
            type="button"
            @click="emit('pick', exercise.id)"
          >
            <span class="flex flex-grow flex-col gap-1">
              <span class="text-[15px] font-semibold">{{ exercise.name }}</span>
              <span class="text-xs text-sub">{{ exercise.group }}</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <span class="px-1 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Todos</span>
        </template>

        <template v-for="entry in entries" :key="entry.kind === 'family' ? `family-${entry.family.id}` : entry.exercise.id">
          <div v-if="entry.kind === 'family'" class="flex flex-col rounded-2xl border border-line bg-surface">
            <button
              class="flex min-h-[64px] items-center gap-3 px-3.5 py-3.5 text-left"
              type="button"
              :aria-expanded="isOpen(entry)"
              @click="toggle(entry.family.id)"
            >
              <span class="flex flex-grow flex-col gap-1">
                <span class="text-[14.5px] font-medium">{{ entry.family.name }}</span>
                <span class="text-xs text-sub">{{ entry.family.group }} · {{ entry.variants.length }} variantes</span>
              </span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-icon transition-transform"
                :class="isOpen(entry) ? 'rotate-90' : ''"
              ><path d="M9 6l6 6-6 6" /></svg>
            </button>

            <div v-if="isOpen(entry)" class="flex flex-col gap-1.5 px-2 pb-2">
              <button
                v-for="variant in entry.variants"
                :key="variant.id"
                class="flex min-h-12 items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-left"
                type="button"
                @click="emit('pick', variant.id)"
              >
                <span class="flex-grow text-[14px] font-medium leading-snug">{{ variant.name }}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-icon"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            </div>
          </div>

          <button
            v-else
            class="flex min-h-[64px] items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3.5 text-left"
            type="button"
            @click="emit('pick', entry.exercise.id)"
          >
            <span class="flex flex-grow flex-col gap-1">
              <span class="text-[14.5px] font-medium">{{ entry.exercise.name }}</span>
              <span class="flex items-center gap-1.5 text-xs text-sub">
                {{ entry.exercise.group }}
                <span v-if="entry.exercise.ownerId" class="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-ink">Mío</span>
              </span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </template>

        <button
          class="flex min-h-[64px] items-center gap-3 rounded-2xl border border-dashed border-line-btn px-3.5 py-3.5 text-left"
          type="button"
          @click="emit('create', search.trim())"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="text-accent"><path d="M12 5v14M5 12h14" /></svg>
          <span class="flex flex-grow flex-col gap-1">
            <span class="text-[14.5px] font-semibold text-accent-ink">
              {{ search.trim() ? `Crear «${search.trim()}»` : 'Crear un ejercicio' }}
            </span>
            <span class="text-xs text-sub">Si lo que has hecho no está en la lista</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
