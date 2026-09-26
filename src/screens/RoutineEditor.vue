<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import { db, plain } from '../db'
import { useLive } from '../composables/useLive'
import { useUndoStore } from '../stores/undo'
import Collapse from '../components/Collapse.vue'
import ExercisePicker from '../components/ExercisePicker.vue'
import ExerciseSheet from '../components/ExerciseSheet.vue'
import SetTargetSheet from '../components/SetTargetSheet.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { shortLabel } from '../lib/targets'
import { createExercise, muscleGroups, type ExerciseDraft } from '../lib/exercises'
import { useAuthStore } from '../stores/auth'
import type { Exercise, Routine, RoutineExercise, SetTemplate, SetType } from '../types'

const route = useRoute()
const router = useRouter()
const undo = useUndoStore()
const auth = useAuthStore()

const creating = ref<string | null>(null)
const groups = ref<string[]>([])

async function openCreate(name: string) {
  groups.value = await muscleGroups()
  creating.value = name
}

async function saveNewExercise(draft: ExerciseDraft) {
  const owner = auth.userId
  creating.value = null
  if (!owner) return
  const exercise = await createExercise(draft, owner)
  await addExercise(exercise.id)
}

const DEFAULT_REST_SEC = 90
const INCREMENTS = [1, 2, 2.5, 5, 10, 20]
const WEIGHT_STEP = 2.5

const routineId = computed(() => String(route.params.id ?? ''))
const openIndex = ref<number | null>(0)
const picking = ref(false)
const targetEditor = ref<{ index: number; position: number } | null>(null)
const splitWeight = ref(new Set<string>())
const items = ref<RoutineExercise[]>([])

interface EditorData {
  routine: Routine | null
  exercises: Exercise[]
}

const data = useLive<EditorData>(
  async () => ({
    routine: (await db.routines.get(routineId.value)) ?? null,
    exercises: await db.exercises.toArray(),
  }),
  { routine: null, exercises: [] },
  routineId,
)

watch(
  () => data.value.routine?.exercises,
  (exercises) => {
    items.value = exercises ? [...exercises] : []
  },
  { immediate: true },
)

const nameOf = (id: string) => data.value.exercises.find((exercise) => exercise.id === id)?.name ?? '—'

const isBodyweight = (id: string) =>
  data.value.exercises.find((exercise) => exercise.id === id)?.bodyweight ?? false

const totalSets = computed(() => items.value.reduce((count, item) => count + item.sets.length, 0))

async function save(exercises: RoutineExercise[]) {
  const routine = data.value.routine
  if (!routine) return
  await db.routines.update(routine.id, { exercises: plain(exercises), updatedAt: Date.now() })
}

function replace(index: number, changes: Partial<RoutineExercise>) {
  const exercises = [...items.value]
  exercises[index] = { ...exercises[index], ...changes }
  return save(exercises)
}

async function rename(value: string) {
  const routine = data.value.routine
  if (!routine || !value.trim()) return
  await db.routines.update(routine.id, { name: value.trim(), updatedAt: Date.now() })
}

function persistOrder() {
  openIndex.value = null
  return save([...items.value])
}

function removeExercise(index: number) {
  const exercises = [...items.value]
  const [item] = exercises.splice(index, 1)
  openIndex.value = null

  undo.offer(`${nameOf(item.exerciseId)} eliminado`, async () => {
    const restored = [...items.value]
    restored.splice(index, 0, item)
    await save(restored)
  })

  return save(exercises)
}

const confirmingRemoval = ref<string | null>(null)

async function askRemoveRoutine() {
  const routine = data.value.routine
  if (!routine) return

  const plans = (await db.plans.toArray()).filter((plan) => plan.routineIds.includes(routine.id))
  const inPlans = plans.length === 0
    ? 'No está en ningún plan.'
    : plans.length === 1
      ? `Sale del plan ${plans[0].name}.`
      : `Sale de ${plans.length} planes: ${plans.map((plan) => plan.name).join(', ')}.`

  confirmingRemoval.value = `Se borra ${routine.name} con sus ejercicios. ${inPlans} Los entrenos que ya hiciste siguen en Historial.`
}

async function removeRoutine() {
  confirmingRemoval.value = null
  const routine = data.value.routine
  if (!routine) return

  const plans = await db.plans.toArray()
  const affected = plans.filter((plan) => plan.routineIds.includes(routine.id))

  await db.routines.delete(routine.id)
  for (const plan of affected) {
    await db.plans.update(plan.id, {
      routineIds: plan.routineIds.filter((id) => id !== routine.id),
      updatedAt: Date.now(),
    })
  }

  undo.offer(`${routine.name} eliminada`, async () => {
    await db.routines.put(routine)
    for (const plan of affected) {
      await db.plans.update(plan.id, { routineIds: plan.routineIds, updatedAt: Date.now() })
    }
  })

  router.push('/routines')
}

function addSet(index: number) {
  const item = items.value[index]
  const last = item.sets[item.sets.length - 1] ?? { type: 'range' as SetType, repsMin: 8, repsMax: 12, weight: 0 }
  return replace(index, { sets: [...item.sets, { ...last }] })
}

function removeSet(index: number) {
  const item = items.value[index]
  if (!item || item.sets.length <= 1) return
  return replace(index, { sets: item.sets.slice(0, -1) })
}

const editingTarget = computed(() => {
  const spot = targetEditor.value
  if (!spot) return null
  const item = items.value[spot.index]
  const template = item?.sets[spot.position]
  if (!item || !template) return null
  return { spot, template, count: item.sets.length, name: nameOf(item.exerciseId) }
})

function applyTarget(changes: Partial<SetTemplate>, all: boolean) {
  const current = editingTarget.value
  if (!current) return

  const item = items.value[current.spot.index]
  const sets = item.sets.map((template, position) =>
    all || position === current.spot.position ? { ...template, ...changes } : template,
  )

  targetEditor.value = null
  return replace(current.spot.index, { sets })
}

function shiftWeight(index: number, direction: -1 | 1) {
  const item = items.value[index]
  if (!item) return
  const step = WEIGHT_STEP * direction
  const sets = item.sets.map((template) => ({
    ...template,
    weight: Math.max(0, Math.round(((template.weight ?? 0) + step) * 100) / 100),
  }))
  return replace(index, { sets })
}

function kgText(weight: number | undefined) {
  return String(weight ?? 0).replace('.', ',')
}

function weightText(item: RoutineExercise) {
  return kgText(item.sets[item.sets.length - 1]?.weight)
}

function setWeight(index: number, value: string) {
  const item = items.value[index]
  const weight = parseWeight(value)
  if (!item || weight == null) return
  return replace(index, { sets: item.sets.map((template) => ({ ...template, weight })) })
}

function parseWeight(value: string) {
  const parsed = Number(value.replace(',', '.'))
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.round(parsed * 100) / 100)
}

function setSetWeight(index: number, position: number, value: string) {
  const item = items.value[index]
  const weight = parseWeight(value)
  if (!item || weight == null) return
  const sets = item.sets.map((template, spot) => (spot === position ? { ...template, weight } : template))
  return replace(index, { sets })
}

function shiftSetWeight(index: number, position: number, direction: -1 | 1) {
  const item = items.value[index]
  const template = item?.sets[position]
  if (!item || !template) return
  const weight = Math.max(0, Math.round(((template.weight ?? 0) + WEIGHT_STEP * direction) * 100) / 100)
  const sets = item.sets.map((set, spot) => (spot === position ? { ...set, weight } : set))
  return replace(index, { sets })
}

function weightVaries(item: RoutineExercise) {
  return new Set(item.sets.map((template) => template.weight ?? 0)).size > 1
}

function perSetWeight(item: RoutineExercise) {
  return weightVaries(item) || splitWeight.value.has(item.exerciseId)
}

function toggleSplitWeight(index: number) {
  const item = items.value[index]
  if (!item) return

  if (!perSetWeight(item)) {
    splitWeight.value.add(item.exerciseId)
    return
  }

  splitWeight.value.delete(item.exerciseId)
  const weight = item.sets[item.sets.length - 1]?.weight ?? 0
  return replace(index, { sets: item.sets.map((template) => ({ ...template, weight })) })
}

function shiftRest(index: number, direction: -1 | 1) {
  const item = items.value[index]
  if (!item || item.restSec == null) return
  return replace(index, { restSec: Math.min(600, Math.max(15, item.restSec + direction * 15)) })
}

function toggleRest(index: number) {
  const item = items.value[index]
  if (!item) return
  return replace(index, { restSec: item.restSec == null ? DEFAULT_REST_SEC : null })
}

async function addExercise(exerciseId: string) {
  const exercises = [...items.value, {
    exerciseId,
    sets: [
      { type: 'range' as SetType, repsMin: 8, repsMax: 12, weight: 0 },
      { type: 'range' as SetType, repsMin: 8, repsMax: 12, weight: 0 },
      { type: 'range' as SetType, repsMin: 8, repsMax: 12, weight: 0 },
    ],
    restSec: null,
    incrementKg: 2.5,
    alternativeIds: [],
  }]

  picking.value = false
  openIndex.value = exercises.length - 1
  await save(exercises)
}

function summary(item: RoutineExercise) {
  const labels = new Set(item.sets.map(shortLabel))
  const kind = labels.size === 1 ? [...labels][0] : 'mixta'
  return `${item.sets.length} × ${kind}${weightSummary(item)}`
}

function weightSummary(item: RoutineExercise) {
  const weights = item.sets.map((template) => template.weight ?? 0)
  const low = Math.min(...weights)
  const high = Math.max(...weights)
  if (!high) return ''
  const sign = isBodyweight(item.exerciseId) ? '+' : ''
  const text = (value: number) => `${sign}${String(value).replace('.', ',')}`
  return low === high ? ` · ${text(high)} kg` : ` · ${text(low)}–${text(high)} kg`
}

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function restLabel(item: RoutineExercise) {
  return item.restSec == null ? 'sin descanso' : `desc. ${clock(item.restSec)}`
}
</script>

<template>
  <div v-if="data.routine" class="relative flex h-full flex-col overflow-hidden">
    <header class="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
      <button class="-ml-2.5 flex h-11 w-11 items-center justify-center text-muted" type="button" @click="router.back()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <div class="flex flex-grow flex-col gap-0.5">
        <input
          class="w-full bg-transparent text-lg font-bold tracking-[-0.01em] outline-none"
          :value="data.routine.name"
          @change="rename(($event.target as HTMLInputElement).value)"
        />
        <span class="num text-xs text-dim">{{ items.length }} ejercicios · {{ totalSets }} series</span>
      </div>
      <button
        class="flex h-11 items-center rounded-2xl bg-accent px-4 text-sm font-bold text-hero-ink"
        type="button"
        @click="router.back()"
      >Listo</button>
    </header>

    <div class="flex flex-grow flex-col gap-2 overflow-y-auto px-4 py-3">
      <draggable
        v-model="items"
        item-key="exerciseId"
        handle=".drag-handle"
        :animation="160"
        class="flex flex-col gap-2"
        @end="persistOrder"
      >
        <template #item="{ element: item, index }">
          <section
            class="flex flex-col rounded-[18px] bg-surface shadow-card"
            :class="openIndex === index ? 'border-[1.5px] border-accent' : 'border border-line'"
          >
            <button
              v-if="openIndex !== index"
              class="flex h-[62px] w-full items-center gap-3 px-3.5 text-left"
              :aria-expanded="false"
              type="button"
              @click="openIndex = index"
            >
              <span class="drag-handle flex cursor-grab touch-none text-icon" @click.stop>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" />
                  <circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                </svg>
              </span>
              <span class="flex flex-grow flex-col gap-1">
                <span class="text-[15px] font-semibold">{{ nameOf(item.exerciseId) }}</span>
                <span class="num text-[11.5px] text-sub">{{ summary(item) }} · {{ restLabel(item) }}</span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon"><path d="M6 9l6 6 6-6" /></svg>
            </button>

            <div v-else class="flex items-center gap-2.5 px-3.5 pt-3.5">
                <span class="drag-handle flex cursor-grab touch-none text-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" />
                    <circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                  </svg>
                </span>
                <button
                  class="flex flex-grow items-center text-left"
                  type="button"
                  :aria-expanded="true"
                  @click="openIndex = null"
                >
                  <h2 class="text-[15px] font-bold">{{ nameOf(item.exerciseId) }}</h2>
                </button>
                <button class="flex h-9 w-9 items-center justify-center rounded-xl border border-line-btn text-danger" type="button" @click="removeExercise(index)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" /></svg>
                </button>
                <button class="flex h-10 w-10 items-center justify-center rounded-xl text-icon" type="button" :aria-expanded="true" @click="openIndex = null">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                </button>
            </div>

            <Collapse :open="openIndex === index">
              <div class="flex flex-col gap-3 px-3.5 pb-3.5 pt-3">
              <div class="flex items-center gap-2.5">
                <span class="flex-grow text-[13px] text-muted">Series</span>
                <button class="flex h-11 w-11 items-center justify-center rounded-xl border border-line-btn bg-surface-2 text-muted" type="button" @click="removeSet(index)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14" /></svg>
                </button>
                <span class="num w-8 text-center text-lg font-bold">{{ item.sets.length }}</span>
                <button class="flex h-11 w-11 items-center justify-center rounded-xl border border-line-btn bg-surface-2 text-muted" type="button" @click="addSet(index)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </button>
              </div>

              <div class="flex flex-col gap-2">
                <span class="text-[13px] text-muted">Objetivo por serie</span>
                <div class="grid gap-1.5" :style="{ gridTemplateColumns: `repeat(${Math.min(item.sets.length, 4)}, minmax(0, 1fr))` }">
                  <button
                    v-for="(template, position) in (item.sets as SetTemplate[])"
                    :key="position"
                    class="flex flex-col items-center gap-1 rounded-xl border border-accent-line bg-accent-soft px-1 py-2"
                    type="button"
                    @click="targetEditor = { index: Number(index), position }"
                  >
                    <span class="num text-[10px] text-dim">S{{ position + 1 }}</span>
                    <span class="num text-[12.5px] font-semibold text-accent-ink">
                      {{ shortLabel(template) }}
                    </span>
                  </button>
                </div>
              </div>

              <div class="flex flex-col">
                <div class="flex h-12 items-center gap-2.5 border-t border-line">
                  <span class="flex-grow text-[13px] text-muted">Mismo peso en todas las series</span>
                  <button
                    class="flex h-7 w-12 items-center rounded-full p-0.5 transition-colors"
                    :class="perSetWeight(item) ? 'bg-line-btn' : 'bg-accent'"
                    type="button"
                    role="switch"
                    :aria-checked="!perSetWeight(item)"
                    @click="toggleSplitWeight(Number(index))"
                  >
                    <span
                      class="h-6 w-6 rounded-full bg-surface shadow-card transition-transform"
                      :class="perSetWeight(item) ? '' : 'translate-x-5'"
                    />
                  </button>
                </div>

                <div v-if="perSetWeight(item)" class="flex flex-col gap-2 border-t border-line pt-3 pb-3">
                  <span class="text-[13px] text-muted">
                    {{ isBodyweight(item.exerciseId) ? 'Lastre por serie' : 'Peso por serie' }}
                  </span>
                  <div class="flex flex-col gap-1.5">
                    <div
                      v-for="(template, position) in (item.sets as SetTemplate[])"
                      :key="position"
                      class="flex h-12 items-center gap-2.5 rounded-xl bg-surface-2 px-3"
                    >
                      <span class="num flex-grow text-[12px] font-semibold text-dim">S{{ position + 1 }}</span>
                      <button class="flex h-9 w-9 items-center justify-center rounded-lg border border-line-btn bg-surface text-muted" type="button" @click="shiftSetWeight(Number(index), position, -1)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14" /></svg>
                      </button>
                      <label class="flex h-9 items-center justify-center gap-1 rounded-lg border border-line-btn bg-surface px-2.5">
                        <input
                          class="num w-auto min-w-4 bg-transparent text-center text-[14px] font-bold outline-none [field-sizing:content]"
                          inputmode="decimal"
                          :size="kgText(template.weight).length"
                          :value="kgText(template.weight)"
                          @change="setSetWeight(Number(index), position, ($event.target as HTMLInputElement).value)"
                        />
                        <span class="text-[11px] font-medium text-dim">kg</span>
                      </label>
                      <button class="flex h-9 w-9 items-center justify-center rounded-lg border border-line-btn bg-surface text-muted" type="button" @click="shiftSetWeight(Number(index), position, 1)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div v-else class="flex h-14 items-center gap-2.5 border-t border-line">
                  <span class="flex-grow text-[13px] text-muted">
                    {{ isBodyweight(item.exerciseId) ? 'Lastre' : 'Peso' }}
                  </span>
                  <button class="flex h-9 w-9 items-center justify-center rounded-lg border border-line-btn text-muted" type="button" @click="shiftWeight(index, -1)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14" /></svg>
                  </button>
                  <label class="flex h-10 items-center justify-center gap-1 rounded-xl border border-line-btn bg-surface-2 px-3">
                    <input
                      class="num w-auto min-w-4 bg-transparent text-center text-[15px] font-bold outline-none [field-sizing:content]"
                      inputmode="decimal"
                      :size="weightText(item).length"
                      :value="weightText(item)"
                      @change="setWeight(Number(index), ($event.target as HTMLInputElement).value)"
                    />
                    <span class="text-[12px] font-medium text-dim">kg</span>
                  </label>
                  <button class="flex h-9 w-9 items-center justify-center rounded-lg border border-line-btn text-muted" type="button" @click="shiftWeight(index, 1)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                </div>

                <div class="flex h-12 items-center gap-2.5 border-t border-line">
                  <span class="flex-grow text-[13px] text-muted">Contador de descanso</span>
                  <button
                    class="flex h-7 w-12 items-center rounded-full p-0.5 transition-colors"
                    :class="item.restSec == null ? 'bg-line-btn' : 'bg-accent'"
                    type="button"
                    role="switch"
                    :aria-checked="item.restSec != null"
                    @click="toggleRest(Number(index))"
                  >
                    <span
                      class="h-6 w-6 rounded-full bg-surface shadow-card transition-transform"
                      :class="item.restSec == null ? '' : 'translate-x-5'"
                    />
                  </button>
                </div>

                <div v-if="item.restSec != null" class="flex h-12 items-center gap-2.5 border-t border-line">
                  <span class="flex-grow text-[13px] text-muted">Tiempo</span>
                  <button class="flex h-9 w-9 items-center justify-center rounded-lg border border-line-btn text-muted" type="button" @click="shiftRest(index, -1)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14" /></svg>
                  </button>
                  <span class="num w-16 text-center text-sm font-semibold">{{ clock(item.restSec) }}</span>
                  <button class="flex h-9 w-9 items-center justify-center rounded-lg border border-line-btn text-muted" type="button" @click="shiftRest(index, 1)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                </div>

                <div class="flex flex-col gap-2 border-t border-line pt-3">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-[13px] text-muted">Incremento</span>
                    <span class="text-[11.5px] text-dim">Lo que te propone subir la app cuando superas el objetivo</span>
                  </div>
                  <div class="grid grid-cols-6 gap-1.5">
                    <button
                      v-for="step in INCREMENTS"
                      :key="step"
                      class="num flex h-11 items-center justify-center rounded-xl border px-0.5 text-[12px] font-semibold"
                      :class="item.incrementKg === step
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line-btn bg-surface-2 text-muted'"
                      type="button"
                      @click="replace(Number(index), { incrementKg: step })"
                    >+{{ String(step).replace('.', ',') }}</button>
                  </div>
                </div>
              </div>
              </div>
            </Collapse>
          </section>
        </template>
      </draggable>

      <button
        class="flex h-13 items-center justify-center gap-2 rounded-2xl border border-dashed border-line-btn text-sm font-medium text-muted"
        type="button"
        @click="picking = true"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Añadir ejercicio
      </button>

      <button
        class="mt-2 flex h-13 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 text-danger shadow-card"
        type="button"
        @click="askRemoveRoutine"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" /></svg>
        <span class="flex-grow text-left text-[14.5px] font-semibold">Eliminar rutina</span>
      </button>
    </div>

    <SetTargetSheet
      v-if="editingTarget"
      :template="editingTarget.template"
      :position="editingTarget.spot.position"
      :count="editingTarget.count"
      :exercise-name="editingTarget.name"
      @apply="applyTarget"
      @close="targetEditor = null"
    />

    <ExercisePicker
      v-else-if="picking"
      title="Añadir ejercicio"
      subtitle="Se añade al final de la rutina"
      :exercises="data.exercises"
      @create="openCreate"
      @pick="addExercise"
      @close="picking = false"
    />

    <ExerciseSheet
      v-if="creating !== null"
      title="Nuevo ejercicio"
      :groups="groups"
      :draft="{ name: creating, group: '', bodyweight: false }"
      @save="saveNewExercise"
      @close="creating = null"
    />

    <ConfirmDialog
      v-if="confirmingRemoval"
      title="Eliminar rutina"
      :message="confirmingRemoval"
      label="Eliminar rutina"
      @confirm="removeRoutine"
      @close="confirmingRemoval = null"
    />
  </div>
</template>
