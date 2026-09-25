<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db, newId, plain } from '../db'
import { useLive } from '../composables/useLive'
import { forgetDraft, readDraft, writeDraft } from '../lib/draft'
import { longDay, shortDay, today } from '../lib/dates'
import { estimateOneRepMax } from '../lib/progress'
import { bestOneRepMax, exerciseEntries, moveSession, previousSession, removeSession, sessionOn, sheetName } from '../lib/session'
import { dueRoutine, hasTraining, type SheetProgress } from '../lib/plan'
import { minReps, shortLabel, targetOf } from '../lib/targets'
import { startingWeight, weightLabel } from '../lib/bodyweight'
import { createExercise, muscleGroups, type ExerciseDraft } from '../lib/exercises'
import { useAuthStore } from '../stores/auth'
import { useRestStore } from '../stores/rest'
import { useSettingsStore } from '../stores/settings'
import { useUndoStore } from '../stores/undo'
import ExercisePicker from '../components/ExercisePicker.vue'
import ExerciseSheet from '../components/ExerciseSheet.vue'
import NumberPad from '../components/NumberPad.vue'
import Collapse from '../components/Collapse.vue'
import RestBar from '../components/RestBar.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import Calendar from '../components/Calendar.vue'
import type { Exercise, Routine, Session, SetEntry } from '../types'

interface WorkoutGroup {
  slot: number
  recordIds: Set<string>
  exerciseId: string
  name: string
  restSec: number | null
  increment: number
  alternativeIds: string[]
  sets: SetEntry[]
  done: number
  total: number
  previous: SetEntry[]
  record: number
}

withDefaults(defineProps<{ readonly?: boolean }>(), { readonly: false })

const route = useRoute()
const router = useRouter()
const rest = useRestStore()
const undo = useUndoStore()
const settings = useSettingsStore()
const auth = useAuthStore()

const creating = ref<string | null>(null)
const exerciseGroups = ref<string[]>([])

async function openCreate(name: string) {
  exerciseGroups.value = await muscleGroups()
  creating.value = name
}

async function saveNewExercise(draft: ExerciseDraft) {
  const owner = auth.userId
  creating.value = null
  if (!owner) return
  const exercise = await createExercise(draft, owner)
  swapping.value ? swapExercise(exercise.id) : await addExercise(exercise.id)
}

const sessionId = computed(() => String(route.params.id ?? ''))
const openExerciseId = ref<string | null>(null)
const editing = ref<{ setId: string; field: 'weight' | 'reps' } | null>(null)
const swapping = ref<WorkoutGroup | null>(null)
const adding = ref(false)
const draft = ref<SetEntry[] | null>(null)

const sheetSets = computed(() => draft.value ?? data.value.sets)
const touched = computed(() => draft.value !== null)

function draftSets() {
  if (!draft.value) draft.value = data.value.sets.map((set) => ({ ...set }))
  return draft.value
}

function change(setId: string) {
  return draftSets().find((set) => set.id === setId) ?? null
}

function save() {
  writeDraft(sessionId.value, draft.value)
}

function discard() {
  draft.value = null
  forgetDraft(sessionId.value)
}

async function confirm() {
  const pending = draft.value
  if (!pending) return

  const kept = new Set(pending.map((set) => set.id))
  const removed = data.value.sets.filter((set) => !kept.has(set.id)).map((set) => set.id)
  const stamped = pending.map((set) => ({ ...set, updatedAt: Date.now() }))

  await db.transaction('rw', db.sets, async () => {
    if (removed.length) await db.sets.bulkDelete(removed)
    await db.sets.bulkPut(plain(stamped))
  })

  const session = data.value.session
  if (session?.later && stamped.some((set) => set.done)) {
    await db.sessions.update(session.id, { later: false, updatedAt: Date.now() })
  }

  discard()
}

watch(sessionId, (id) => { draft.value = readDraft<SetEntry[]>(id) }, { immediate: true })

const swapAlternatives = computed(() => {
  const group = swapping.value
  if (!group) return []
  const current = data.value.exercises.find((exercise) => exercise.id === group.exerciseId)
  const sameGroup = data.value.exercises
    .filter((exercise) => exercise.group === current?.group && exercise.id !== group.exerciseId)
    .map((exercise) => exercise.id)
  return [...new Set([...group.alternativeIds, ...sameGroup])]
})

async function addExercise(exerciseId: string) {
  adding.value = false
  const sets = draftSets()
  const slot = sets.reduce((highest, set) => Math.max(highest, set.slot ?? 0), -1) + 1
  sets.push(...(await exerciseEntries(sessionId.value, exerciseId, slot, data.value.session?.date)))
  openExerciseId.value = exerciseId
  save()
}

function removeGroup(group: WorkoutGroup) {
  const gone = new Set(group.sets.map((set) => set.id))
  draft.value = draftSets().filter((set) => !gone.has(set.id))
  openExerciseId.value = null
  save()

  undo.offer(`${group.name} fuera de la hoja`, () => {
    draft.value = [...draftSets(), ...group.sets]
    save()
  })
}

function swapExercise(exerciseId: string) {
  const group = swapping.value
  if (!group) return

  const bodyweight = Boolean(data.value.exercises.find((item) => item.id === exerciseId)?.bodyweight)

  for (const set of group.sets) {
    const target = change(set.id)
    if (!target) continue
    if (bodyweight !== (target.bodyweightKg != null)) {
      const fresh = startingWeight(bodyweight, settings.bodyweightKg, undefined, undefined)
      target.weight = fresh.weight
      target.bodyweightKg = fresh.bodyweightKg
    }
    target.exerciseId = exerciseId
    target.reps = null
    target.done = false
    target.doneAt = null
  }

  swapping.value = null
  openExerciseId.value = exerciseId
  save()
}

interface WorkoutData {
  session: Session | null
  routine: Routine | null
  exercises: Exercise[]
  sets: SetEntry[]
  previous: Record<string, SetEntry[]>
  records: Record<string, number>
  marks: Record<string, string[]>
  pending: Record<string, string[]>
}

const data = useLive<WorkoutData>(
  async () => {
    const session = (await db.sessions.get(sessionId.value)) ?? null
    if (!session) {
      return { session: null, routine: null, exercises: [], sets: [], previous: {}, records: {}, marks: {}, pending: {} }
    }

    const routine = session.routineId ? (await db.routines.get(session.routineId)) ?? null : null
    const exercises = await db.exercises.toArray()
    const sets = await db.sets.where('sessionId').equals(session.id).toArray()

    const ids = [...new Set(sets.map((set) => set.exerciseId))]
    const previous: Record<string, SetEntry[]> = {}
    const records: Record<string, number> = {}

    for (const id of ids) {
      previous[id] = await previousSession(id, session.id, session.date)
      records[id] = await bestOneRepMax(id, session.id, session.date)
    }

    const everySession = await db.sessions.toArray()
    const everyRoutine = await db.routines.toArray()
    const everySet = await db.sets.toArray()
    const progress: Record<string, SheetProgress> = {}
    const marks: Record<string, string[]> = {}

    for (const entry of everySet) {
      const sheet = progress[entry.sessionId] ?? { done: 0, total: 0 }
      sheet.total += 1
      if (entry.done) sheet.done += 1
      progress[entry.sessionId] = sheet
    }

    for (const sheet of everySession) {
      if (!hasTraining(sheet, progress) && !sheet.later) continue
      const name = sheetName(sheet, everyRoutine.find((item) => item.id === sheet.routineId)?.name)
      marks[sheet.date] = [...(marks[sheet.date] ?? []), name]
    }

    const plans = await db.plans.toArray()
    const active = plans.find((item) => item.active) ?? null
    const trainedToday = everySession.some(
      (item) => item.date === today() && item.routineId && hasTraining(item, progress),
    )
    const due = active && !trainedToday ? dueRoutine(active, everySession, progress) : null
    const dueName = everyRoutine.find((item) => item.id === due)?.name
    const pending = dueName ? { [today()]: [dueName] } : {}

    return { session, routine, exercises, sets, previous, records, marks, pending }
  },
  { session: null, routine: null, exercises: [], sets: [], previous: {}, records: {}, marks: {}, pending: {} },
  sessionId,
)

const nameOf = (id: string) => data.value.exercises.find((item) => item.id === id)?.name ?? '—'

async function renameSheet(value: string) {
  const session = data.value.session
  if (!session) return
  const name = value.trim()
  await db.sessions.update(session.id, { name: name || undefined, updatedAt: Date.now() })
}

const groups = computed(() => {
  const current = data.value

  const slots = new Map<number, SetEntry[]>()
  for (const set of sheetSets.value) {
    const slot = set.slot ?? current.routine?.exercises.findIndex((item) => item.exerciseId === set.exerciseId) ?? 0
    const list = slots.get(slot) ?? []
    list.push(set)
    slots.set(slot, list)
  }

  return [...slots.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([slot, list]) => {
      const sets = [...list].sort((a, b) => a.index - b.index)
      const exerciseId = sets[0].exerciseId
      const template = current.routine?.exercises[slot]
      const best = current.records[exerciseId] ?? 0
      const recordIds = new Set(
        sets
          .filter((set) => set.done && set.reps != null && best > 0 && estimateOneRepMax(set.weight ?? 0, set.reps) > best)
          .map((set) => set.id),
      )

      return {
        recordIds,
        slot,
        exerciseId,
        name: nameOf(exerciseId),
        restSec: template?.restSec ?? null,
        increment: template?.incrementKg ?? 2.5,
        alternativeIds: template?.alternativeIds ?? [],
        sets,
        done: sets.filter((set) => set.done).length,
        total: sets.length,
        previous: current.previous[exerciseId] ?? [],
        record: current.records[exerciseId] ?? 0,
      }
    })
})

const currentGroup = computed(() => {
  const pending = groups.value.find((group) => group.done < group.total)
  return pending ?? groups.value[groups.value.length - 1] ?? null
})

const openId = computed(() => openExerciseId.value ?? currentGroup.value?.exerciseId ?? null)

const doneExercises = computed(() => groups.value.filter((group) => group.total > 0 && group.done === group.total).length)

const editingSet = computed(() => sheetSets.value.find((set) => set.id === editing.value?.setId) ?? null)

const editingGroup = computed(() =>
  groups.value.find((group) => group.exerciseId === editingSet.value?.exerciseId) ?? null,
)

const isPast = computed(() => {
  const date = data.value.session?.date
  return Boolean(date) && date !== today()
})

watch(
  isPast,
  (past) => {
    rest.setEnabled(!past)
    if (past) rest.skip()
  },
  { immediate: true },
)

function previousLabel(group: { previous: SetEntry[] }, index: number) {
  const before = group.previous[index - 1] ?? group.previous[group.previous.length - 1]
  if (!before || before.reps == null) return '—'
  return `${format(before.weight ?? 0)} × ${before.reps}`
}

function targetLabel(set: SetEntry) {
  if (set.type === 'rir') return '—'
  return shortLabel(targetOf(set))
}

function typeLabel(set: SetEntry) {
  return shortLabel(targetOf(set))
}

function format(value: number) {
  return String(value).replace('.', ',')
}

function resultTone(set: SetEntry) {
  if (!set.done || set.reps == null) return 'pending'
  const min = minReps(targetOf(set))
  if (min != null && set.reps < min) return 'below'
  return 'ok'
}

function gainLabel(set: SetEntry) {
  if (set.type !== 'range' || set.reps == null || set.targetRepsMax == null) return ''
  const extra = set.reps - set.targetRepsMax
  return extra > 0 ? `↑ +${extra}` : ''
}

function suggestion(set: SetEntry, group: { increment: number }) {
  if (isPast.value) return null
  if (set.type !== 'range' || set.reps == null || set.targetRepsMax == null) return null
  if (set.reps <= set.targetRepsMax) return null

  return { reps: set.reps, weight: (set.weight ?? 0) + group.increment }
}

function record(set: SetEntry, group: { recordIds: Set<string>; record: number }) {
  if (set.type !== 'single' || !set.done || set.reps == null) return null
  if (!group.recordIds.has(set.id)) return null

  const mark = estimateOneRepMax(set.weight ?? 0, set.reps)
  return { mark, gain: Math.round((mark - group.record) * 100) / 100 }
}

function defaultReps(set: SetEntry, group: { previous: SetEntry[] }) {
  if (set.reps != null) return set.reps
  if (set.type === 'single') return 1
  if (set.type === 'fixed') return set.targetReps ?? null
  if (set.type === 'range') return set.targetRepsMin ?? null
  const before = group.previous[set.index - 1]
  return before?.reps ?? null
}

function toggle(set: SetEntry, group: { restSec: number | null; previous: SetEntry[]; sets: SetEntry[]; name: string }) {
  const target = change(set.id)
  if (!target) return

  if (target.done) {
    target.done = false
    target.doneAt = null
    save()
    return
  }

  target.reps = defaultReps(target, group)
  target.done = true
  target.doneAt = Date.now()
  save()

  if (isPast.value) return

  if (group.restSec == null) return

  const next = group.sets.find((candidate) => candidate.index > set.index && !candidate.done)
  const label = next
    ? `Serie ${next.index} · ${format(next.weight ?? 0)} kg × ${targetLabel(next)}`
    : `${group.name} completado`

  rest.start(group.restSec, label)
}

function applySuggestion(set: SetEntry, weight: number, group: { sets: SetEntry[] }) {
  for (const candidate of group.sets) {
    if (candidate.index <= set.index) continue
    const target = change(candidate.id)
    if (target) target.weight = weight
  }
  save()
}

function removeSet(group: WorkoutGroup) {
  const last = group.sets[group.sets.length - 1]
  if (!last || group.sets.length <= 1) return

  draft.value = draftSets().filter((set) => set.id !== last.id)
  save()

  undo.offer(`Serie ${last.index} de ${group.name} quitada`, () => {
    draft.value = [...draftSets(), last]
    save()
  })
}

function addSet(exerciseId: string) {
  const sets = draftSets()
  const own = sets.filter((set) => set.exerciseId === exerciseId).sort((a, b) => a.index - b.index)
  const last = own[own.length - 1]
  if (!last) return

  sets.push({
    ...last,
    id: newId(),
    index: last.index + 1,
    reps: null,
    done: false,
    doneAt: null,
    updatedAt: Date.now(),
  })

  save()
}

function edit(set: SetEntry, field: 'weight' | 'reps') {
  editing.value = { setId: set.id, field }
}

function commit(value: number | null) {
  const set = editingSet.value
  if (!set || !editing.value) return
  const target = change(set.id)
  if (!target) return

  if (editing.value.field === 'weight') target.weight = value
  else target.reps = value

  save()
}

function commitAndAdvance(value: number | null) {
  const set = editingSet.value
  const group = editingGroup.value
  if (!set || !group || !editing.value) return

  const field = editing.value.field
  commit(value)

  if (field === 'reps') {
    const fresh = editingSet.value
    if (fresh) toggle({ ...fresh, done: false }, group)
    editing.value = null
    return
  }

  editing.value = { setId: set.id, field: 'reps' }
}

const confirming = ref<{
  title: string
  message: string
  label: string
  tone?: 'danger' | 'accent'
  run: () => Promise<void>
} | null>(null)
const picking = ref(false)

function pickDate(value: string) {
  picking.value = false
  changeDate(value)
}

async function changeDate(value: string) {
  const session = data.value.session
  if (!session || !value || value === session.date || value > today()) return

  const clash = await sessionOn(value, session.routineId)
  if (clash && clash.id !== session.id) {
    confirming.value = {
      title: 'Ya hay una hoja ese día',
      message: `El ${longDay(value)} ya tienes ${sheetName(clash, data.value.routine?.name)}. Abre esa hoja o elige otro día.`,
      label: 'Abrir esa hoja',
      tone: 'accent',
      run: async () => {
        confirming.value = null
        router.replace(`/workout/${clash.id}`)
      },
    }
    return
  }

  await moveSession(session.id, value)
}

function askClearLater() {
  const session = data.value.session
  if (!session?.later) return

  const name = sheetName(session, data.value.routine?.name)
  confirming.value = {
    title: 'Quitar a rellenar',
    message: `Si quitas la marca, ${name} pasa a saltado. No cuenta como hecho y el plan sigue.`,
    label: 'Marcar como saltado',
    run: clearLater,
  }
}

async function clearLater() {
  const session = data.value.session
  confirming.value = null
  if (!session?.later) return

  await db.sessions.update(session.id, { later: false, skipped: true, updatedAt: Date.now() })

  undo.offer(`${sheetName(session, data.value.routine?.name)} saltado`, async () => {
    await db.sessions.update(session.id, { later: true, skipped: false, updatedAt: Date.now() })
  })

  router.back()
}

function askRemove() {
  const session = data.value.session
  if (!session) return

  confirming.value = {
    title: 'Borrar esta hoja',
    message: `Se borra ${sheetName(session, data.value.routine?.name)} del ${longDay(session.date)} con todas sus series.`,
    label: 'Borrar la hoja',
    run: removeSheet,
  }
}

async function removeSheet() {
  const session = data.value.session
  if (!session) return

  const sets = await db.sets.where('sessionId').equals(session.id).toArray()
  await removeSession(session.id)
  discard()
  confirming.value = null
  router.back()

  undo.offer(`${sheetName(session, data.value.routine?.name)} borrada`, async () => {
    await db.sessions.put(session)
    if (sets.length) await db.sets.bulkPut(sets)
  })
}
</script>

<template>
  <div v-if="data.session" class="relative flex h-full flex-col overflow-hidden">
    <header class="flex items-center gap-2 border-b border-line px-4 py-2.5">
      <button class="-ml-2.5 flex h-11 w-9 shrink-0 items-center justify-center text-muted" type="button" @click="router.back()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <div class="flex min-w-0 flex-grow flex-col gap-0.5">
        <div class="flex min-w-0 items-center gap-2">
          <input
            v-if="!data.session.routineId && !readonly"
            class="min-w-0 w-full truncate bg-transparent text-lg font-bold tracking-[-0.01em] text-ink outline-none placeholder:text-dim"
            :value="data.session.name ?? ''"
            placeholder="Entreno extra"
            aria-label="Nombre del entreno extra"
            @change="renameSheet(($event.target as HTMLInputElement).value)"
          />
          <h1 v-else class="min-w-0 truncate text-lg font-bold tracking-[-0.01em]">{{ sheetName(data.session, data.routine?.name) }}</h1>
          <span
            v-if="touched"
            class="shrink-0 text-[11.5px] font-semibold text-accent"
          >
            sin guardar
          </span>
          <button
            v-else-if="data.session.later && !readonly"
            class="flex h-[22px] shrink-0 items-center gap-1 rounded-lg bg-accent-soft px-2 text-[11.5px] font-semibold text-accent-ink"
            type="button"
            aria-label="Quitar la marca de a rellenar"
            @click="askClearLater"
          >
            a rellenar
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="readonly" class="num text-sm font-medium text-muted">{{ shortDay(data.session.date) }}</span>
          <button
            v-else
            class="num flex items-center gap-1 text-sm font-medium text-muted"
            type="button"
            aria-label="Cambiar el día del entreno"
            @click="picking = !picking"
          >
            {{ shortDay(data.session.date) }}
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="transition-transform"
              :class="picking ? 'rotate-180' : ''"
            ><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <span class="h-[3px] w-[3px] rounded-full bg-icon" />
          <span class="num text-[13px] text-dim">
            {{ doneExercises }}/{{ groups.length }}
          </span>
        </div>

      </div>
      <button
        v-if="!isPast && !readonly"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-muted"
        :class="rest.enabled ? 'border-line-btn bg-surface-2' : 'border-accent bg-accent-soft text-accent'"
        type="button"
        :title="rest.enabled ? 'Descansos activados' : 'Sin descansos'"
        @click="rest.setEnabled(!rest.enabled)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.5l3.5 2" /></svg>
      </button>
      <button
        v-if="!readonly"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-muted"
        type="button"
        aria-label="Borrar esta hoja"
        @click="askRemove"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 7h14" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" />
        </svg>
      </button>
      <RouterLink
        :to="{ name: 'summary', params: { id: data.session.id }, query: readonly ? { from: 'history' } : {} }"
        class="flex h-11 shrink-0 items-center rounded-2xl border border-line-btn bg-surface-2 px-3 text-sm font-semibold"
      >Resumen</RouterLink>
    </header>

    <div class="flex flex-grow flex-col gap-2 overflow-y-auto px-4 py-2.5">
      <template v-for="group in groups" :key="group.exerciseId">
        <section class="flex flex-col rounded-[20px] border border-line bg-surface shadow-card">
          <button
            v-if="group.exerciseId !== openId"
            class="flex h-12 items-center gap-2.5 px-3.5 text-left"
            type="button"
            :aria-expanded="false"
            :aria-controls="`panel-${group.exerciseId}`"
            @click="openExerciseId = group.exerciseId"
          >
            <svg
              v-if="group.done === group.total"
              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="text-ok"
            ><path d="M5 12.5l4.5 4.5L19 7" /></svg>
            <span v-else class="mx-[5px] h-2 w-2 rounded-full bg-icon" />
            <span class="flex-grow text-sm" :class="group.done === group.total ? 'text-muted' : 'text-ink'">{{ group.name }}</span>
            <span class="num text-[13px] text-dim">{{ group.done }}/{{ group.total }}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon"><path d="M6 9l6 6 6-6" /></svg>
          </button>

          <div v-else class="flex items-start gap-1 px-3 pt-3">
            <button
              class="flex flex-grow flex-col gap-1.5 pt-1 text-left"
              type="button"
              :aria-expanded="true"
              :aria-controls="`panel-${group.exerciseId}`"
              @click="openExerciseId = ''"
            >
              <h2 class="text-[17px] font-bold leading-tight tracking-[-0.01em]">{{ group.name }}</h2>
              <div class="flex items-center gap-2">
                <span
                  v-if="group.recordIds.size > 0"
                  class="flex h-5.5 items-center gap-1 rounded-md bg-accent px-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-hero-ink"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M7 4h10v4.5a5 5 0 0 1-10 0z" /><path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 2.7" /><path d="M17 6h2.5a2.5 2.5 0 0 1-2.5 2.7" /><path d="M12 13.5V17" /><path d="M8.5 20h7" />
                  </svg>
                  Récord
                </span>
                <span class="num text-[13px] text-dim">{{ group.done }}/{{ group.total }}</span>
              </div>
            </button>
            <button
              v-if="!readonly"
              class="flex h-10 w-10 items-center justify-center rounded-xl text-muted"
              type="button"
              @click="swapping = group"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
            </button>
            <button
              v-if="!readonly"
              class="flex h-9 w-9 items-center justify-center rounded-xl border border-line-btn text-danger"
              type="button"
              aria-label="Quitar de la hoja"
              @click="removeGroup(group)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" /></svg>
            </button>
            <button
              class="flex h-10 w-10 items-center justify-center rounded-xl text-icon"
              type="button"
              :aria-expanded="true"
              :aria-controls="`panel-${group.exerciseId}`"
              @click="openExerciseId = ''"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
            </button>
          </div>

          <Collapse :open="group.exerciseId === openId" :panel-id="`panel-${group.exerciseId}`">
            <div class="flex flex-col gap-2.5 px-3 pb-3 pt-2.5">
              <div
                class="grid gap-1.5 pl-3.5 pr-2 text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint"
                style="grid-template-columns: 46px 1fr 58px 58px 56px"
              >
                <span>Serie</span>
                <span>Anterior</span>
                <span class="text-center">kg</span>
                <span class="text-center">Reps</span>
                <span class="text-center">✓</span>
              </div>

              <template v-for="set in group.sets" :key="set.id">
            <div
              class="grid items-center gap-1.5 rounded-2xl border pl-3.5 pr-2"
              :class="group.recordIds.has(set.id)
                ? 'border-accent bg-accent-soft'
                : resultTone(set) === 'ok'
                  ? 'border-ok-line bg-ok-soft'
                  : resultTone(set) === 'below'
                  ? 'border-warn bg-warn-soft'
                  : set.id === currentGroup?.sets.find((candidate) => !candidate.done)?.id
                    ? 'border-accent bg-surface'
                    : 'border-line bg-surface'"
              style="grid-template-columns: 46px 1fr 58px 58px 56px; min-height: 60px"
            >
              <div class="flex flex-col gap-px py-2">
                <span class="num text-[15px] font-semibold">{{ set.index }}</span>
                <span
                  class="num text-[10px]"
                  :class="set.type === 'failure'
                    ? 'font-bold text-warn'
                    : set.type === 'single'
                      ? 'font-bold text-ink'
                      : 'text-dim'"
                >{{ typeLabel(set) }}</span>
              </div>

              <span class="num text-[13px] text-sub">{{ previousLabel(group, set.index) }}</span>

              <component
                :is="readonly ? 'span' : 'button'"
                class="num flex h-11 flex-col items-center justify-center rounded-xl border"
                :class="editing?.setId === set.id && editing?.field === 'weight'
                  ? 'border-accent bg-surface'
                  : 'border-inherit bg-surface'"
                :type="readonly ? null : 'button'"
                @click="!readonly && edit(set, 'weight')"
              >
                <span class="text-[17px] font-semibold leading-tight">
                  {{ set.weight == null ? '—' : format(set.weight) }}
                </span>
                <span v-if="weightLabel(set, format)" class="text-[9px] font-semibold leading-none text-dim">
                  {{ weightLabel(set, format) }}
                </span>
              </component>

              <component
                :is="readonly ? 'span' : 'button'"
                class="num flex h-11 flex-col items-center justify-center rounded-xl border"
                :class="editing?.setId === set.id && editing?.field === 'reps'
                  ? 'border-accent bg-app'
                  : set.done
                    ? 'border-transparent bg-transparent'
                    : 'border-line-btn bg-app'"
                :type="readonly ? null : 'button'"
                @click="!readonly && edit(set, 'reps')"
              >
                <span class="text-[17px] font-semibold" :class="set.reps == null ? 'text-[14px] text-dim' : ''">
                  {{ set.reps ?? targetLabel(set) }}
                </span>
                <span v-if="gainLabel(set)" class="num text-[10px] font-semibold text-ok">{{ gainLabel(set) }}</span>
              </component>

              <component
                :is="readonly ? 'span' : 'button'"
                class="flex h-14 w-14 items-center justify-center"
                :type="readonly ? null : 'button'"
                @click="!readonly && toggle(set, group)"
              >
                <span
                  class="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
                  :class="!set.done
                    ? 'border border-line-btn bg-surface-2 text-icon'
                    : group.recordIds.has(set.id)
                      ? 'bg-accent text-hero-ink'
                      : resultTone(set) === 'below'
                        ? 'bg-warn text-hero-ink'
                        : 'bg-ok text-ok-ink'"
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                </span>
              </component>
            </div>

            <div
              v-if="record(set, group)"
              class="flex items-center gap-2.5 rounded-2xl border border-accent bg-accent-soft py-2 pl-3.5 pr-3"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-accent"><path d="M7 4h10v5a5 5 0 01-10 0V4zM5 5h2v3a3 3 0 01-2-3zM19 5h-2v3a3 3 0 002-3zM9 19h6M12 14v5" /></svg>
              <span class="flex-grow text-[12.5px] leading-snug text-accent-ink">
                Récord · <span class="num font-semibold text-ink">1RM {{ format(record(set, group)?.mark ?? 0) }} kg</span>,
                <span class="num">+{{ format(record(set, group)?.gain ?? 0) }}</span> sobre tu marca anterior
              </span>
            </div>

            <div
              v-if="suggestion(set, group) && !readonly"
              class="flex items-center gap-2.5 rounded-2xl border border-accent-line bg-accent-soft py-2 pl-3.5 pr-2"
            >
              <span class="flex-grow text-[12.5px] leading-snug text-accent-ink">
                {{ suggestion(set, group)?.reps }} reps <span class="text-dim">→</span> prueba
                <span class="num font-semibold text-ink">{{ format(suggestion(set, group)?.weight ?? 0) }} kg</span> en la siguiente
              </span>
              <button
                class="h-11 rounded-xl bg-accent px-3.5 text-[13px] font-bold text-hero-ink"
                type="button"
                @click="applySuggestion(set, suggestion(set, group)?.weight ?? 0, group)"
              >Aplicar</button>
                </div>
              </template>

              <div v-if="!readonly" class="flex gap-2">
                <button
                  class="flex h-12 flex-grow items-center justify-center gap-2 rounded-2xl border border-dashed border-line-btn text-sm font-medium text-muted"
                  type="button"
                  @click="addSet(group.exerciseId)"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  Serie <span class="font-normal text-faint">· duplica la última</span>
                </button>
                <button
                  v-if="group.sets.length > 1"
                  class="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-line-btn text-muted"
                  type="button"
                  aria-label="Quitar la última serie"
                  @click="removeSet(group)"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14" /></svg>
                </button>
              </div>
            </div>
          </Collapse>
        </section>
      </template>

      <p v-if="groups.length === 0" class="px-2 py-6 text-center text-sm text-dim">
        {{ readonly ? 'Este entreno no tiene ejercicios apuntados.' : 'Hoja vacía. Añade el primer ejercicio y apunta lo que hayas hecho.' }}
      </p>

      <button
        v-if="!readonly"
        class="flex h-13 items-center justify-center gap-2 rounded-2xl border border-dashed border-line-btn text-sm font-medium text-muted"
        type="button"
        @click="adding = true"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Añadir ejercicio
      </button>
    </div>

    <div v-if="picking" class="absolute inset-0 z-20" @click="picking = false">
      <div class="absolute left-4 right-4 top-[72px] max-w-[320px]" @click.stop>
        <Calendar
          :model-value="data.session.date"
          :marks="data.marks"
          :pending="data.pending"
          compact
          @update:model-value="pickDate"
        />
      </div>
    </div>

    <ConfirmDialog
      v-if="confirming"
      :title="confirming.title"
      :message="confirming.message"
      :label="confirming.label"
      :tone="confirming.tone ?? 'danger'"
      @confirm="confirming.run()"
      @close="confirming = null"
    />

    <ExercisePicker
      v-if="swapping"
      title="Sustituir ejercicio"
      subtitle="Solo para esta hoja: la rutina no cambia"
      :exercises="data.exercises"
      :suggested-ids="swapAlternatives"
      @create="openCreate"
      @pick="swapExercise"
      @close="swapping = null"
    />

    <ExercisePicker
      v-else-if="adding"
      title="Añadir ejercicio"
      :subtitle="data.session?.routineId
        ? 'Solo para esta hoja: la rutina no cambia'
        : 'Fuera del plan: no cuenta como el día que tocaba'"
      :exercises="data.exercises"
      @create="openCreate"
      @pick="addExercise"
      @close="adding = false"
    />

    <NumberPad
      v-else-if="editingSet && editing"
      :field="editing.field"
      :value="editing.field === 'weight' ? editingSet.weight : editingSet.reps"
      :context="`${editingGroup?.name ?? ''} · serie ${editingSet.index}`"
      :hint="editingGroup?.previous[editingSet.index - 1]?.reps ?? null"
      @commit="commit"
      @next="commitAndAdvance"
      @close="editing = null"
    />

    <template v-else>
      <RestBar v-if="rest.secondsLeft > 0" />

      <div v-if="touched" class="flex items-center gap-2 border-t border-line bg-surface px-4 pb-4 pt-3">
        <button
          class="flex h-14 flex-grow items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink"
          type="button"
          @click="confirm"
        >Confirmar cambios</button>
        <button
          class="flex h-14 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 px-4 text-sm font-semibold text-muted"
          type="button"
          @click="discard"
        >Descartar</button>
      </div>
    </template>
  </div>

  <div v-else class="flex h-full items-center justify-center px-8 text-center">
    <p class="text-sm text-dim">Esta hoja ya no existe. <button class="text-accent" type="button" @click="router.push('/')">Volver a Hoy</button></p>

    <ExerciseSheet
      v-if="creating !== null"
      title="Nuevo ejercicio"
      :groups="exerciseGroups"
      :draft="{ name: creating, group: '', bodyweight: false }"
      @save="saveNewExercise"
      @close="creating = null"
    />
  </div>
</template>
