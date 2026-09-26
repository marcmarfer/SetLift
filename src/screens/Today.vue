<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import { db } from '../db'
import { useLive } from '../composables/useLive'
import { addDays, headerDate, sameWeek, timeAgo, tinyDay, today, weekStart } from '../lib/dates'
import { dueRoutine, hasTraining, pendingRoutines, planRotation, planWeek, sessionVolume, type RoutineStatus, type SheetProgress } from '../lib/plan'
import AccountButton from '../components/AccountButton.vue'
import SwitchPlanSheet from '../components/SwitchPlanSheet.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import LogSheet, { type LoggedSheet } from '../components/LogSheet.vue'
import { markLater, openFreeWorkout, openFreestyleWorkout, openWorkout, removeSession, sheetName, skipRoutine } from '../lib/session'
import { forgetDraft } from '../lib/draft'
import { useUndoStore } from '../stores/undo'
import type { Exercise, Plan, Routine, Session, SetEntry } from '../types'

interface TodayData {
  plan: Plan | null
  plans: Plan[]
  routines: Routine[]
  sessions: Session[]
  exercises: Exercise[]
  lastSets: SetEntry[]
  lastSession: Session | null
  doneToday: { id: string; routineId: string | null; name: string; sets: number; total: number; volume: number; at: number } | null
  laterToday: { id: string; name: string } | null
  progress: Record<string, SheetProgress>
  weekSets: SetEntry[]
}

const router = useRouter()
const undo = useUndoStore()

const data = useLive<TodayData>(
  async () => {
    const plans = await db.plans.toArray()
    const plan = plans.find((candidate) => candidate.active) ?? plans[0] ?? null
    const routines = await db.routines.toArray()
    const sessions = await db.sessions.toArray()
    const exercises = await db.exercises.toArray()

    const tracked = sessions.filter((session) => !session.skipped)
    const progress: Record<string, SheetProgress> = {}
    for (const session of tracked) {
      const sets = await db.sets.where('sessionId').equals(session.id).toArray()
      const done = sets.filter((set) => set.done)
      progress[session.id] = {
        done: done.length,
        total: sets.length,
        lastDoneAt: done.reduce((latest, set) => Math.max(latest, set.doneAt ?? 0), 0),
      }
    }

    const due = plan ? dueRoutine(plan, sessions, progress) : null
    const previous = sessions
      .filter((session) => session.routineId === due && !session.skipped)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
    const lastSession = previous[0] ?? null
    const lastSets = lastSession
      ? await db.sets.where('sessionId').equals(lastSession.id).toArray()
      : []

    const monday = weekStart()
    const weekSessions = sessions.filter((session) => session.routineId && session.date >= monday)
    const weekSets = (
      await Promise.all(weekSessions.map((session) => db.sets.where('sessionId').equals(session.id).toArray()))
    ).flat().filter((set) => set.done)

    const todaySheets = await Promise.all(
      sessions
        .filter((session) => session.routineId && session.date === today() && !session.skipped)
        .map(async (session) => ({
          session,
          sets: await db.sets.where('sessionId').equals(session.id).toArray(),
        })),
    )

    const lastMark = (sets: SetEntry[]) =>
      sets.reduce((latest, set) => Math.max(latest, set.doneAt ?? 0), 0)

    const trained = todaySheets
      .filter((sheet) => sheet.sets.some((set) => set.done))
      .sort((a, b) => lastMark(b.sets) - lastMark(a.sets) || b.session.updatedAt - a.session.updatedAt)[0]
    const doneSets = trained?.sets.filter((set) => set.done) ?? []
    const doneToday = trained
      ? {
          id: trained.session.id,
          routineId: trained.session.routineId,
          name: sheetName(
            trained.session,
            routines.find((item) => item.id === trained.session.routineId)?.name,
          ),
          sets: doneSets.length,
          total: trained.sets.length,
          volume: Math.round(sessionVolume(doneSets)),
          at: Math.max(lastMark(trained.sets), trained.session.updatedAt),
        }
      : null

    const waiting = todaySheets.find((sheet) => sheet.session.later && !sheet.sets.some((set) => set.done))
    const laterToday = waiting
      ? {
          id: waiting.session.id,
          name: sheetName(
            waiting.session,
            routines.find((item) => item.id === waiting.session.routineId)?.name,
          ),
        }
      : null

    return { plan, plans, routines, sessions, exercises, lastSets, lastSession, doneToday, laterToday, progress, weekSets }
  },
  { plan: null, plans: [], routines: [], sessions: [], exercises: [], lastSets: [], lastSession: null, doneToday: null, laterToday: null, progress: {}, weekSets: [] },
)

const currentWeek = computed(() => {
  const current = data.value
  return current.plan ? planWeek(current.plan, current.routines, current.sessions, current.progress) : []
})

const weekComplete = computed(() => {
  const current = data.value
  return (
    current.plan?.mode === 'weekly' &&
    currentWeek.value.length > 0 &&
    currentWeek.value.every((item) => item.done || item.skipped || item.later) &&
    !routine.value
  )
})

const lastSkipToday = computed(() =>
  data.value.sessions
    .filter((session) => session.skipped && session.date === today())
    .reduce((latest, session) => Math.max(latest, session.updatedAt), 0),
)

const restToday = computed(() => {
  const sheet = data.value.doneToday
  if (!sheet || sheet.sets !== sheet.total) return null
  return sheet.at >= lastSkipToday.value ? sheet : null
})

const halfwayToday = computed(() => {
  const sheet = data.value.doneToday
  return sheet && sheet.sets < sheet.total ? sheet : null
})

const weekDone = computed(() => currentWeek.value.filter((item) => item.done).length)
const weekSkipped = computed(() => currentWeek.value.filter((item) => item.skipped).length)
const weekLater = computed(() => currentWeek.value.filter((item) => item.later).map((item) => item.name))

const weekTotals = computed(() => ({
  sets: data.value.weekSets.length,
  volume: Math.round(sessionVolume(data.value.weekSets)),
}))

const choosingPlan = ref(false)
const switching = ref<Plan | null>(null)

const otherPlans = computed(() =>
  data.value.plans
    .filter((item) => !item.active)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
)

const switchDueName = computed(() => {
  const current = data.value
  if (!current.plan) return null
  const id = dueRoutine(current.plan, current.sessions, current.progress)
  return current.routines.find((item) => item.id === id)?.name ?? null
})

const switchWeekDone = computed(() => {
  const current = data.value
  if (!current.plan) return []
  const monday = weekStart()
  const done = new Set(
    current.sessions
      .filter((session) => session.routineId && session.date >= monday)
      .map((session) => session.routineId as string),
  )
  return current.plan.routineIds
    .filter((id) => done.has(id))
    .map((id) => current.routines.find((item) => item.id === id)?.name ?? '—')
})

async function activatePlan(target: Plan) {
  await db.transaction('rw', db.plans, async () => {
    for (const candidate of data.value.plans) {
      if (candidate.active === (candidate.id === target.id)) continue
      await db.plans.update(candidate.id, { active: candidate.id === target.id, updatedAt: Date.now() })
    }
  })

  switching.value = null
  choosingPlan.value = false
  back.value = 0
}

const confirming = ref<{
  title: string
  message: string
  label: string
  tone?: 'danger' | 'accent'
  run: () => Promise<void>
} | null>(null)

function warnEmpty(target: Routine) {
  if (target.exercises.length > 0) return false

  confirming.value = {
    title: `${target.name} no tiene ejercicios`,
    message: 'Añade al menos un ejercicio a la rutina antes de entrenarla. Lo que añadas o quites después en la hoja de un día cuenta solo para ese día.',
    label: `Configurar ${target.name}`,
    tone: 'accent',
    run: async () => {
      confirming.value = null
      await router.push(`/routines/${target.id}`)
    },
  }
  return true
}

const dueTitle = computed(() => {
  const target = routine.value
  if (!target) return ''

  const sheet = sheetToday(target.id)
  return sheet?.freestyle && sheet.total > 0 ? `${target.name} (a mi aire)` : target.name
})

function sheetToday(routineId: string) {
  const current = data.value
  const session = current.sessions.find(
    (item) => item.date === today() && item.routineId === routineId && !item.skipped,
  )
  if (!session) return null

  const sheet = current.progress[session.id] ?? { done: 0, total: 0 }
  return { id: session.id, done: sheet.done, total: sheet.total, freestyle: session.freestyle === true }
}

async function goFreestyle(target: Routine) {
  const id = await openFreestyleWorkout(target.id, data.value.plan?.id ?? null)

  confirming.value = null
  router.push(`/workout/${id}`)
}

async function startFreestyleWorkout(target: Routine) {
  if (warnEmpty(target)) return
  const sheet = sheetToday(target.id)

  if (sheet && sheet.done > 0 && !sheet.freestyle) {
    confirming.value = {
      title: `${target.name} a mi aire`,
      message: `Hoy llevas ${sheet.done} de ${sheet.total} series apuntadas en ${target.name}. Empezar a tu aire vacía la hoja y la montas desde cero.`,
      label: 'Vaciar y empezar de cero',
      run: () => goFreestyle(target),
    }
    return
  }

  await goFreestyle(target)
}

const freestyleTarget = computed(() => {
  if (routine.value) return routine.value
  const sheet = halfwayToday.value
  if (!sheet?.routineId) return null
  return data.value.routines.find((item) => item.id === sheet.routineId) ?? null
})

const skipTarget = computed(() => {
  const sheet = halfwayToday.value
  if (sheet?.routineId) return { routineId: sheet.routineId, name: sheet.name }
  if (routine.value) return { routineId: routine.value.id, name: routine.value.name }
  return null
})

async function skipDue() {
  const sheet = halfwayToday.value
  if (sheet) {
    confirming.value = {
      title: `Saltar ${sheet.name}`,
      message: `Tienes ${sheet.sets} de ${sheet.total} series apuntadas hoy. Si saltas esta rutina se borra lo que llevas escrito y se pasa a la siguiente.`,
      label: 'Saltar y borrar lo apuntado',
      run: confirmSkip,
    }
    return
  }

  const target = skipTarget.value
  if (!target) return

  const untouched = data.value.sessions.find(
    (session) => session.date === today() && session.routineId === target.routineId && !session.skipped,
  )
  const blank = untouched ? await db.sessions.get(untouched.id) : null
  const blankSets = blank ? await db.sets.where('sessionId').equals(blank.id).toArray() : []

  if (blank) {
    await removeSession(blank.id)
    try {
      localStorage.removeItem(`setlift:draft:${blank.id}`)
    } catch {}
  }

  const id = await skipRoutine(target.routineId, data.value.plan?.id ?? null)

  undo.offer(`${target.name} saltada`, async () => {
    await db.sessions.delete(id)
    if (blank) await db.sessions.put(blank)
    if (blankSets.length) await db.sets.bulkPut(blankSets)
  })
}

async function confirmSkip() {
  const sheet = halfwayToday.value
  confirming.value = null
  if (!sheet?.routineId) return

  const session = await db.sessions.get(sheet.id)
  const sets = await db.sets.where('sessionId').equals(sheet.id).toArray()

  await removeSession(sheet.id)
  forgetDraft(sheet.id)

  const skipId = await skipRoutine(sheet.routineId, data.value.plan?.id ?? null)

  undo.offer(`${sheet.name} saltada`, async () => {
    await db.sessions.delete(skipId)
    if (session) await db.sessions.put(session)
    if (sets.length) await db.sets.bulkPut(sets)
  })
}

async function undoSkip(item: RoutineStatus) {
  if (!canUndoSkip(item)) return

  const session = item.sessionId ? await db.sessions.get(item.sessionId) : null
  if (!session) return

  const later = data.value.sessions.filter(
    (candidate) =>
      candidate.skipped &&
      candidate.id !== session.id &&
      candidate.planId === session.planId &&
      (rotation.value || sameWeek(candidate.date, session.date)) &&
      (candidate.date === session.date
        ? candidate.updatedAt > session.updatedAt
        : candidate.date > session.date),
  )

  const restore = [session, ...later]

  await db.sessions.bulkDelete(restore.map((candidate) => candidate.id))
  back.value = 0

  undo.offer(`${item.name} vuelve a tocar`, async () => {
    await db.sessions.bulkPut(restore)
  })
}

const logging = ref<string | null>(null)

const pendingMark = computed(() => {
  const target = routine.value
  if (!target || trainedOn(today())) return {}
  return { [today()]: [target.name] }
})

const loggedSheets = computed(() => {
  const current = data.value
  const map: Record<string, LoggedSheet[]> = {}

  for (const session of current.sessions) {
    if (!hasTraining(session, current.progress) && !session.later) continue
    const routine = session.routineId ? current.routines.find((item) => item.id === session.routineId) : null
    const list = map[session.date] ?? []
    const name = sheetName(session, routine?.name)
    list.push({
      id: session.id,
      label: session.later && (current.progress[session.id]?.done ?? 0) === 0 ? `${name} · a rellenar` : name,
      routineId: session.routineId,
    })
    map[session.date] = list
  }

  return map
})

const logRoutines = computed(() => {
  const current = data.value
  if (!current.plan || !logging.value) return []

  return pendingRoutines(current.plan, current.sessions, current.progress, logging.value)
    .slice(0, 1)
    .flatMap((id) => current.routines.find((item) => item.id === id) ?? [])
})

async function logPast({ date, routineId }: { date: string; routineId: string | null }) {
  const current = data.value
  if (routineId && trainedOn(date)) return

  const routine = current.routines.find((item) => item.id === routineId)
  if (routine && warnEmpty(routine)) {
    logging.value = null
    return
  }

  const id = routine
    ? await openWorkout(routine, current.plan?.id ?? null, date)
    : await openFreeWorkout(date)

  logging.value = null
  router.push(`/workout/${id}`)
}

async function startFreeWorkout() {
  const id = await openFreeWorkout()
  router.push(`/workout/${id}`)
}

async function fillLater() {
  const current = data.value
  const target = routine.value
  if (!target || !canMarkLater.value || trainedOn(today())) return
  if (warnEmpty(target)) return

  const existing = current.sessions.find(
    (item) => item.routineId === target.id && !item.skipped && (item.date === today() || item.later),
  )
  const previousDate = existing?.date

  const id = await markLater(target, current.plan?.id ?? null)

  undo.offer(`${target.name} marcado para rellenar`, async () => {
    if (existing) {
      await db.sessions.update(id, {
        later: false,
        date: previousDate,
        updatedAt: Date.now(),
      })
    }
    else await removeSession(id)
  })
}

function askClearLater(sessionId: string, name: string) {
  confirming.value = {
    title: 'Quitar a rellenar',
    message: `Si quitas la marca, ${name} pasa a saltado. No cuenta como hecho y el plan sigue.`,
    label: 'Marcar como saltado',
    run: () => clearLater(sessionId, name),
  }
}

async function clearLater(sessionId: string, name: string) {
  confirming.value = null
  await db.sessions.update(sessionId, { later: false, skipped: true, updatedAt: Date.now() })

  undo.offer(`${name} saltado`, async () => {
    await db.sessions.update(sessionId, { later: true, skipped: false, updatedAt: Date.now() })
  })
}

async function startWorkout() {
  const current = data.value
  if (!routine.value || trainedOn(today())) return
  if (warnEmpty(routine.value)) return
  const id = await openWorkout(routine.value, current.plan?.id ?? null)
  router.push(`/workout/${id}`)
}

const plan = computed(() => data.value.plan)

const routine = computed(() => {
  const current = data.value
  if (!current.plan) return null
  const due = dueRoutine(current.plan, current.sessions, current.progress)
  return current.routines.find((candidate) => candidate.id === due) ?? null
})

const exerciseNames = computed(() => {
  const current = data.value
  if (!routine.value) return ''
  return routine.value.exercises
    .map((item) => current.exercises.find((exercise) => exercise.id === item.exerciseId)?.name ?? '—')
    .join(' · ')
})

const lastSummary = computed(() => {
  const current = data.value
  if (!current.lastSession) return null
  const done = current.lastSets.filter((set) => set.done)
  return {
    when: timeAgo(current.lastSession.date),
    sets: done.length,
    volume: Math.round(sessionVolume(done)),
  }
})

const rotation = computed(() => data.value.plan?.mode === 'rotation')
const back = ref(0)

const week = computed(() => {
  const current = data.value
  if (!current.plan) return []
  const build = rotation.value ? planRotation : planWeek
  return build(current.plan, current.routines, current.sessions, current.progress, back.value)
})

const canMarkLater = computed(() => {
  const due = routine.value
  const current = data.value
  if (!due || !current.plan) return false

  const strip = rotation.value
    ? planRotation(current.plan, current.routines, current.sessions, current.progress)
    : planWeek(current.plan, current.routines, current.sessions, current.progress)

  return strip
    .filter((item) => item.routineId !== due.id)
    .every((item) => item.done || item.skipped)
})

const hasPrevious = computed(() => {
  const current = data.value
  if (!current.plan) return false
  const build = rotation.value ? planRotation : planWeek
  return build(current.plan, current.routines, current.sessions, current.progress, 1).some((item) => item.sessionId)
})

const stripTitle = computed(() => {
  if (rotation.value) return back.value ? 'Rotación anterior' : 'Tu rotación'
  return back.value ? 'Semana pasada' : 'Esta semana'
})

const planned = computed(() => week.value.filter((item) => !item.free))
const doneThisWeek = computed(() => planned.value.filter((item) => item.done).length)

const freeWeek = computed(() => {
  const current = data.value
  const monday = weekStart()

  return current.sessions
    .filter((session) => !session.skipped && !session.routineId && session.date >= monday)
    .sort((a, b) => (a.date === b.date ? b.updatedAt - a.updatedAt : a.date < b.date ? 1 : -1))
    .flatMap((session) => {
      const sheet = current.progress[session.id] ?? { done: 0, total: 0 }
      if (sheet.total === 0 && session.date !== today()) return []
      return [{
        id: session.id,
        name: sheetName(session, null),
        done: sheet.done,
        total: sheet.total,
        finished: sheet.total > 0 && sheet.done === sheet.total,
        started: sheet.done > 0 && sheet.done < sheet.total,
      }]
    })
})

function canUndoSkip(item: RoutineStatus) {
  if (!item.skipped || !item.sessionId) return false

  const current = data.value
  const skip = current.sessions.find((session) => session.id === item.sessionId)
  if (!skip) return false

  return !current.sessions.some((session) => {
    if (session.skipped || session.id === skip.id || !session.routineId) return false
    if (skip.planId && session.planId && session.planId !== skip.planId) return false
    const sheet = current.progress[session.id]
    if (!sheet || sheet.done === 0) return false
    const trainedAt = sheet.lastDoneAt || session.updatedAt
    return trainedAt > skip.updatedAt
  })
}

const strip = ref<RoutineStatus[]>([])

watch(week, (list) => { strip.value = [...list] }, { immediate: true })

function trainedOn(date: string) {
  const current = data.value
  return current.sessions.some(
    (session) => session.date === date && session.routineId && hasTraining(session, current.progress),
  )
}

function canStart(item: RoutineStatus) {
  return !back.value && item.due && !item.sessionId && !trainedOn(today())
}

async function startRoutine(routineId: string) {
  const current = data.value
  const target = current.routines.find((item) => item.id === routineId)
  if (!target || warnEmpty(target)) return

  const id = await openWorkout(target, current.plan?.id ?? null)
  router.push(`/workout/${id}`)
}

function locked(item: RoutineStatus) {
  return item.done || item.started || item.skipped || item.free || item.later
}

function allowMove(event: { draggedContext: { element: RoutineStatus }; relatedContext: { element: RoutineStatus } }) {
  return !locked(event.draggedContext.element) && !locked(event.relatedContext.element)
}

async function swapOrder(event: { oldIndex?: number; newIndex?: number }) {
  const current = data.value
  const from = week.value[event.oldIndex ?? -1]
  const to = week.value[event.newIndex ?? -1]

  strip.value = [...week.value]
  if (!current.plan || !from || !to || from.routineId === to.routineId) return

  const routineIds = [...current.plan.routineIds]
  const first = routineIds.indexOf(from.routineId)
  const second = routineIds.indexOf(to.routineId)
  if (first < 0 || second < 0) return
  ;[routineIds[first], routineIds[second]] = [routineIds[second], routineIds[first]]

  await db.plans.update(current.plan.id, { routineIds, updatedAt: Date.now() })
}

const thousands = (value: number) => value.toLocaleString('es-ES')
</script>

<template>
  <div class="relative flex h-full flex-col overflow-hidden">
    <header class="flex items-center gap-3 px-4 pt-4.5 pb-3.5">
      <div class="flex flex-grow flex-col gap-0.5">
        <span class="text-[12.5px] uppercase tracking-[0.06em] text-faint">{{ headerDate() }}</span>
        <h1 class="text-[26px] font-bold tracking-[-0.02em]">Hoy</h1>
      </div>
      <AccountButton />
    </header>

    <div class="flex flex-grow flex-col gap-3.5 overflow-y-auto px-4 pb-4">
      <section v-if="weekComplete" class="flex flex-col gap-4 rounded-[30px] bg-hero p-5 shadow-hero">
        <div class="flex items-start gap-3">
          <div class="flex flex-grow flex-col gap-2">
            <span class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ok">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
              Semana completa
            </span>
            <span class="text-[32px] font-bold leading-tight tracking-[-0.03em] text-hero-ink">Nada más esta semana</span>
          </div>
        </div>

        <p class="text-[13px] leading-[1.55] text-hero-muted">
          {{ weekLater.length
            ? `Te queda ${weekLater.join(', ')} por rellenar.`
            : weekSkipped
              ? `Has hecho ${weekDone} de las ${currentWeek.length} rutinas del plan y saltado ${weekSkipped}.`
              : `Has hecho las ${currentWeek.length} rutinas del plan.` }}
          La semana se reinicia el lunes.
        </p>

        <div class="flex items-center gap-2">
          <span class="num flex h-8 items-center rounded-full bg-hero-surface px-3 text-[12.5px] text-hero-ink">
            {{ weekTotals.sets }} series
          </span>
          <span class="num flex h-8 items-center rounded-full bg-hero-surface px-3 text-[12.5px] text-hero-ink">
            {{ thousands(weekTotals.volume) }} kg
          </span>
        </div>
      </section>

      <section v-else-if="restToday" class="flex flex-col gap-4 rounded-[30px] bg-hero p-5 shadow-hero">
        <div class="flex flex-col gap-2">
          <span class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ok">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
            {{ restToday.name }} hecho
          </span>
          <span class="text-[32px] font-bold leading-tight tracking-[-0.03em] text-hero-ink">Ya estás por hoy</span>
        </div>

        <p class="text-[13px] leading-[1.55] text-hero-muted">
          {{ routine
            ? `Lo siguiente es ${routine.name}, cuando vuelvas.`
            : plan
              ? 'Nada más en el plan por ahora.'
              : 'Este entreno queda en Historial. Si quieres, crea un plan.' }}
        </p>

        <div class="flex items-center gap-2">
          <span class="num flex h-8 items-center rounded-full bg-hero-surface px-3 text-[12.5px] text-hero-ink">
            {{ restToday.sets }} series
          </span>
          <span class="num flex h-8 items-center rounded-full bg-hero-surface px-3 text-[12.5px] text-hero-ink">
            {{ thousands(restToday.volume) }} kg
          </span>
          <RouterLink
            :to="`/workout/${restToday.id}`"
            class="flex h-8 items-center rounded-full bg-hero-surface px-3 text-[12.5px] font-semibold text-hero-ink"
          >Ver la hoja</RouterLink>
        </div>
      </section>

      <section v-else-if="data.laterToday && !routine" class="flex flex-col gap-4 rounded-[30px] bg-hero p-5 shadow-hero">
        <div class="flex flex-col gap-2">
          <span class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-accent">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.5l3.5 2" /></svg>
            {{ data.laterToday.name }}
          </span>
          <span class="text-[32px] font-bold leading-tight tracking-[-0.03em] text-hero-ink">Falta rellenarlo</span>
        </div>

        <p class="text-[13px] leading-[1.55] text-hero-muted">
          Lo diste por hecho para apuntarlo luego.
        </p>

        <RouterLink
          :to="`/workout/${data.laterToday.id}`"
          class="flex h-16 items-center justify-center gap-2.5 rounded-[32px] bg-accent text-[19px] font-bold tracking-[-0.01em] text-hero-ink"
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5z" /></svg>
          Rellenar ahora
        </RouterLink>

        <button
          class="flex h-8 items-center justify-center gap-1.5 text-[12.5px] font-medium text-hero-muted"
          type="button"
          @click="askClearLater(data.laterToday.id, data.laterToday.name)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          Marcar como saltado
        </button>
      </section>

      <section v-else-if="halfwayToday" class="flex flex-col gap-4 rounded-[30px] bg-hero p-5 shadow-hero">
        <div class="flex items-start gap-3">
          <div class="flex flex-grow flex-col gap-2">
            <span class="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">En marcha</span>
            <span class="text-4xl font-bold leading-none tracking-[-0.03em] text-hero-ink">{{ halfwayToday.name }}</span>
          </div>
          <span class="num flex h-6.5 items-center rounded-full bg-hero-surface px-2.5 text-[11.5px] text-hero-ink">
            {{ thousands(halfwayToday.volume) }} kg
          </span>
        </div>

        <p class="text-[12.5px] leading-[1.55] text-hero-muted">
          Te quedan {{ halfwayToday.total - halfwayToday.sets }} series por marcar.
        </p>

        <RouterLink
          :to="`/workout/${halfwayToday.id}`"
          class="flex h-16 items-center justify-center gap-2.5 rounded-[32px] bg-accent text-[19px] font-bold tracking-[-0.01em] text-hero-ink"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
          Seguir
          <span class="num text-sm font-semibold opacity-80">{{ halfwayToday.sets }}/{{ halfwayToday.total }}</span>
        </RouterLink>
      </section>

      <section v-else-if="routine" class="flex flex-col gap-4 rounded-[30px] bg-hero p-5 shadow-hero">
        <div class="flex items-start gap-3">
          <div class="flex flex-grow flex-col gap-2">
            <span class="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">Toca hoy</span>
            <span class="text-4xl font-bold leading-none tracking-[-0.03em] text-hero-ink">{{ dueTitle }}</span>
          </div>
          <div v-if="lastSummary" class="flex flex-col items-end gap-1.5">
            <span class="num text-[13px] text-hero-muted">{{ lastSummary.when }}</span>
            <span class="num flex h-6.5 items-center rounded-full bg-hero-surface px-2.5 text-[11.5px] text-hero-ink">
              {{ lastSummary.sets }} series · {{ thousands(lastSummary.volume) }} kg
            </span>
          </div>
          <span v-else class="num text-[13px] text-hero-muted">sin registros</span>
        </div>

        <p v-if="routine.exercises.length === 0" class="text-[12.5px] leading-[1.55] text-hero-muted">
          Esta rutina no tiene ejercicios todavía. Añade al menos uno para poder empezarla.
        </p>
        <p v-else class="text-[12.5px] leading-[1.55] text-hero-muted">{{ exerciseNames }}</p>

        <RouterLink
          v-if="routine.exercises.length === 0"
          :to="`/routines/${routine.id}`"
          class="flex h-16 items-center justify-center gap-2.5 rounded-[32px] bg-accent text-[19px] font-bold tracking-[-0.01em] text-hero-ink"
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5z" /></svg>
          Configurar rutina
        </RouterLink>
        <button
          v-else
          class="flex h-16 items-center justify-center gap-2.5 rounded-[32px] bg-accent text-[19px] font-bold tracking-[-0.01em] text-hero-ink"
          type="button"
          @click="startWorkout"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
          Empezar
        </button>

        <button
          v-if="canMarkLater && routine.exercises.length > 0"
          class="flex h-8 items-center justify-center gap-1.5 text-[12.5px] font-medium text-hero-muted"
          type="button"
          @click="fillLater"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.5l3.5 2" /></svg>
          Ya lo he hecho, lo relleno luego
        </button>
      </section>

      <section v-else-if="!plan" class="flex flex-col gap-3.5 rounded-[30px] bg-hero p-5 shadow-hero">
        <div class="flex flex-col gap-2">
          <span class="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">Sin plan</span>
          <span class="text-[30px] font-bold leading-tight tracking-[-0.03em] text-hero-ink">Empieza por un plan</span>
        </div>
        <p class="text-[13px] leading-[1.55] text-hero-muted">
          Un plan elige qué rutinas entran y en qué orden. Mientras no haya uno, aquí no hay nada que tocar hoy.
        </p>
        <RouterLink
          to="/plans"
          class="flex h-14 items-center justify-center rounded-[28px] bg-accent text-base font-bold text-hero-ink"
        >Crear un plan</RouterLink>
      </section>

      <section v-if="plan" class="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-3.5 shadow-card">
        <div class="flex items-center gap-2.5">
          <span class="flex-grow text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
            {{ stripTitle }}
          </span>
          <span class="num text-[13px] text-muted">{{ doneThisWeek }} de {{ planned.length }}</span>
          <button
            v-if="hasPrevious || back"
            class="-mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-icon"
            type="button"
            :aria-label="back ? 'Volver a lo actual' : rotation ? 'Ver la rotación anterior' : 'Ver la semana pasada'"
            @click="back = back ? 0 : 1"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path :d="back ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'" />
            </svg>
          </button>
        </div>
        <draggable
          v-model="strip"
          item-key="routineId"
          tag="ul"
          class="grid gap-1.5"
          :style="{ gridTemplateColumns: `repeat(${Math.max(planned.length, 1)}, minmax(0, 1fr))` }"
          :disabled="back !== 0"
          :animation="160"
          handle=".drag-handle"
          :move="allowMove"
          @end="swapOrder"
        >
          <template #item="{ element: item }">
          <component
            :is="canUndoSkip(item) || canStart(item) ? 'button' : !item.skipped && item.sessionId ? RouterLink : 'li'"
            :to="item.skipped || !item.sessionId ? undefined : `/workout/${item.sessionId}`"
            :type="canUndoSkip(item) || canStart(item) ? 'button' : undefined"
            :aria-label="canUndoSkip(item)
              ? `Deshacer el salto de ${item.name}`
              : canStart(item)
                ? `Empezar ${item.name} hoy`
                : undefined"
            @click="canUndoSkip(item) ? undoSkip(item) : canStart(item) ? startRoutine(item.routineId) : undefined"
            class="flex flex-col items-center justify-center gap-1 rounded-2xl border py-2.5"
            :class="[
              item.done
                ? 'border-ok-line bg-ok-soft'
                : item.started || item.due
                  ? 'border-accent bg-accent-soft'
                  : 'border-line bg-surface-2',
              item.free ? 'border-dashed' : '',
            ]"
          >
            <svg v-if="item.done" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" class="text-ok">
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
            <svg v-else-if="item.later" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent">
              <circle cx="12" cy="12" r="8" stroke-dasharray="3 3" /><path d="M12 8v4.5l3 1.8" />
            </svg>
            <svg v-else-if="item.started" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-accent">
              <circle cx="12" cy="12" r="7" />
              <path d="M12 5a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
            </svg>
            <svg v-else-if="item.due" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="text-accent">
              <path d="M9 5.5v13l10-6.5z" />
            </svg>
            <svg v-else-if="item.skipped" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon">
              <path d="M5 6l7 6-7 6M14 6v12" />
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-icon">
              <circle cx="12" cy="12" r="7" />
            </svg>
            <span class="flex items-center gap-1">
              <span class="text-xs" :class="item.due ? 'font-bold' : item.done ? 'font-semibold' : 'text-dim'">
                {{ item.name }}
              </span>
              <span v-if="item.count > 1" class="num text-[10px] font-semibold text-accent-ink">×{{ item.count }}</span>
            </span>
            <span v-if="item.lastDate || item.due" class="num text-[10px] text-dim">
              {{ tinyDay(item.lastDate ?? today()) }}
            </span>
            <span v-if="item.later" class="text-[10px] font-medium text-accent-ink">a rellenar</span>
            <span v-else-if="item.skipped" class="text-[10px] font-medium" :class="canUndoSkip(item) ? 'text-accent-ink' : 'text-dim'">
              {{ canUndoSkip(item) ? 'saltada · deshacer' : 'saltada' }}
            </span>
            <span v-else-if="item.started && item.progress" class="num text-[10px] font-semibold text-accent-ink">
              {{ item.progress.done }}/{{ item.progress.total }}
              <span v-if="item.freestyle" class="font-medium text-faint">· a mi aire</span>
            </span>
            <span v-else-if="item.freestyle" class="text-[10px] font-medium text-faint">a mi aire</span>

            <span
              v-if="!back && !locked(item)"
              class="drag-handle -mb-1 mt-0.5 flex rotate-90 cursor-grab touch-none text-faint"
              @click.prevent
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
              </svg>
            </span>
          </component>
          </template>
        </draggable>
      </section>

      <section v-if="freeWeek.length" class="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-3.5 shadow-card">
        <span class="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Extras</span>
        <ul
          class="grid gap-1.5"
          :style="{ gridTemplateColumns: `repeat(${Math.max(planned.length, freeWeek.length, 1)}, minmax(0, 1fr))` }"
        >
          <RouterLink
            v-for="sheet in freeWeek"
            :key="sheet.id"
            :to="`/workout/${sheet.id}`"
            class="flex flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2.5"
            :class="sheet.finished
              ? 'border-ok-line bg-ok-soft'
              : sheet.started
                ? 'border-accent bg-accent-soft'
                : 'border-line bg-surface-2'"
          >
            <svg v-if="sheet.finished" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" class="text-ok">
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
            <svg v-else-if="sheet.started" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-accent">
              <circle cx="12" cy="12" r="7" />
              <path d="M12 5a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-icon">
              <circle cx="12" cy="12" r="7" />
            </svg>
            <span class="max-w-full truncate text-xs" :class="sheet.finished ? 'font-semibold' : sheet.started ? 'font-bold' : 'text-dim'">
              {{ sheet.name }}
            </span>
            <span class="num text-[10px]" :class="sheet.started ? 'font-semibold text-accent-ink' : 'text-dim'">
              {{ sheet.total ? `${sheet.done}/${sheet.total} extra` : 'extra' }}
            </span>
          </RouterLink>
        </ul>
      </section>

      <section v-if="plan" class="flex flex-col">
        <button class="flex h-12 items-center gap-2.5 text-sm text-muted" type="button" @click="choosingPlan = true">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
          Elegir otro plan
        </button>
        <button
          class="flex h-12 items-center gap-2.5 border-t border-line text-sm text-muted"
          type="button"
          @click="logging = addDays(today(), -1)"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /><path d="M12 14v4M10 16h4" /></svg>
          Apuntar o editar un entreno anterior
        </button>
        <button class="flex h-12 items-center gap-2.5 border-t border-line text-sm text-muted" type="button" @click="startFreeWorkout">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Entreno extra
        </button>
        <button
          v-if="freestyleTarget"
          class="flex h-12 items-center gap-2.5 border-t border-line text-sm text-muted"
          type="button"
          @click="startFreestyleWorkout(freestyleTarget)"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 17c4-9 12-9 16 0" /><circle cx="12" cy="7" r="2.5" />
          </svg>
          Hacer {{ freestyleTarget.name }} a mi aire
        </button>
        <button
          v-if="skipTarget"
          class="flex h-12 items-center gap-2.5 border-t border-line text-sm text-muted"
          type="button"
          @click="skipDue"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6l7 6-7 6M14 6v12" /></svg>
          {{ rotation ? `Saltar ${skipTarget.name} y pasar a la siguiente` : `Saltar ${skipTarget.name} esta semana` }}
        </button>
      </section>

      <section v-else-if="!plan && restToday" class="flex flex-col">
        <RouterLink to="/plans" class="flex h-12 items-center gap-2.5 text-sm text-muted">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
          Crear un plan
        </RouterLink>
      </section>
    </div>

    <div
      v-if="choosingPlan && !switching"
      class="absolute inset-0 z-20 flex flex-col justify-end bg-black/40"
      @click.self="choosingPlan = false"
    >
      <div class="flex max-h-[80%] flex-col gap-3 rounded-t-[28px] border-t border-line-btn bg-surface px-4 pt-3 pb-4">
        <div class="flex shrink-0 justify-center"><span class="h-1 w-9 rounded-sm bg-line-btn" /></div>

        <div class="flex shrink-0 items-start gap-3">
          <div class="flex flex-grow flex-col gap-1">
            <h2 class="text-lg font-bold tracking-[-0.01em]">Elegir otro plan</h2>
            <p class="text-[12.5px] text-muted">Ahora mismo sigues {{ plan?.name ?? 'ningún plan' }}</p>
          </div>
          <button
            class="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-muted"
            type="button"
            @click="choosingPlan = false"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div class="-mr-2 flex flex-col gap-2 overflow-y-auto pr-2">
          <button
            v-for="item in otherPlans"
            :key="item.id"
            class="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-left"
            type="button"
            @click="switching = item"
          >
            <span class="flex flex-grow flex-col gap-1">
              <span class="text-[15px] font-semibold">{{ item.name }}</span>
              <span class="num text-xs text-sub">
                {{ item.routineIds.length }} rutinas · {{ item.mode === 'weekly' ? 'Semanal' : 'Rotación continua' }}
              </span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon"><path d="M9 6l6 6-6 6" /></svg>
          </button>

          <p v-if="otherPlans.length === 0" class="py-6 text-center text-sm text-dim">
            Solo tienes este plan. Puedes crear otro desde Rutinas → Cambiar.
          </p>
        </div>
      </div>
    </div>

    <SwitchPlanSheet
      v-if="switching"
      :plan="switching"
      :due-name="switchDueName"
      :week-done="switchWeekDone"
      @confirm="activatePlan(switching)"
      @close="switching = null"
    />

    <LogSheet
      v-if="logging"
      :routines="logRoutines"
      :sheets="loggedSheets"
      :pending="pendingMark"
      :date="logging"
      @update:date="logging = $event"
      @pick="logPast"
      @open="router.push(`/workout/${$event}`)"
      @close="logging = null"
    />

    <ConfirmDialog
      v-if="confirming"
      :title="confirming.title"
      :message="confirming.message"
      :label="confirming.label"
      :tone="confirming.tone ?? 'danger'"
      @confirm="confirming.run()"
      @close="confirming = null"
    />

  </div>
</template>
