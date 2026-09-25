<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import { db, newId } from '../db'
import { useLive } from '../composables/useLive'
import { timeAgo, weekStart } from '../lib/dates'
import { dueRoutine } from '../lib/plan'
import { pruneRoutines, restoreRoutines } from '../lib/routines'
import { useUndoStore } from '../stores/undo'
import SwitchPlanSheet from '../components/SwitchPlanSheet.vue'
import type { Plan, PlanMode, Routine, Session } from '../types'

const route = useRoute()
const router = useRouter()
const undo = useUndoStore()

const planId = computed(() => String(route.params.id ?? ''))
const adding = ref(false)
const switching = ref<Plan | null>(null)

interface PlanEditorData {
  plan: Plan | null
  plans: Plan[]
  routines: Routine[]
  sessions: Session[]
}

const data = useLive<PlanEditorData>(
  async () => ({
    plan: (await db.plans.get(planId.value)) ?? null,
    plans: await db.plans.toArray(),
    routines: await db.routines.toArray(),
    sessions: await db.sessions.toArray(),
  }),
  { plan: null, plans: [], routines: [], sessions: [] },
  planId,
)

const nameOf = (id: string) => data.value.routines.find((routine) => routine.id === id)?.name ?? '—'

const rows = ref<Array<{ id: string; name: string; exercises: number; lastDate: string | null }>>([])

const planRoutines = computed(() => {
  const plan = data.value.plan
  if (!plan) return []

  return plan.routineIds.flatMap((id) => {
    const routine = data.value.routines.find((candidate) => candidate.id === id)
    if (!routine) return []

    const previous = data.value.sessions
      .filter((session) => session.routineId === id && !session.skipped)
      .sort((a, b) => (a.date < b.date ? 1 : -1))

    return [{ id, name: routine.name, exercises: routine.exercises.length, lastDate: previous[0]?.date ?? null }]
  })
})

watch(planRoutines, (list) => { rows.value = [...list] }, { immediate: true })

const available = computed(() => {
  const plan = data.value.plan
  if (!plan) return []
  return data.value.routines.filter((routine) => !routine.archived && !plan.routineIds.includes(routine.id))
})

const dueName = computed(() => {
  const active = data.value.plans.find((item) => item.active) ?? null
  if (!active) return null
  const id = dueRoutine(active, data.value.sessions)
  return id ? nameOf(id) : null
})

const weekDone = computed(() => {
  const active = data.value.plans.find((item) => item.active) ?? null
  if (!active) return []
  const monday = weekStart()
  const done = new Set(
    data.value.sessions
      .filter((session) => session.routineId && session.date >= monday)
      .map((session) => session.routineId as string),
  )
  return active.routineIds.filter((id) => done.has(id)).map(nameOf)
})

async function rename(value: string) {
  const name = value.trim()
  if (!name) return
  await db.plans.update(planId.value, { name, updatedAt: Date.now() })
}

async function setMode(mode: PlanMode) {
  const plan = data.value.plan
  if (!plan || plan.mode === mode) return
  await db.plans.update(plan.id, { mode, updatedAt: Date.now() })
}

async function persistOrder() {
  await db.plans.update(planId.value, { routineIds: rows.value.map((row) => row.id), updatedAt: Date.now() })
}

async function addRoutine(routineId: string) {
  const plan = data.value.plan
  if (!plan) return
  adding.value = false
  await db.plans.update(plan.id, { routineIds: [...plan.routineIds, routineId], updatedAt: Date.now() })
}

async function createRoutine() {
  const plan = data.value.plan
  if (!plan) return
  const id = newId()
  await db.routines.put({ id, name: 'Rutina nueva', exercises: [], updatedAt: Date.now() })
  await db.plans.update(plan.id, { routineIds: [...plan.routineIds, id], updatedAt: Date.now() })
  router.push(`/routines/${id}`)
}

async function removeRoutine(routineId: string) {
  const plan = data.value.plan
  if (!plan) return

  const before = [...plan.routineIds]
  const name = nameOf(routineId)

  await db.plans.update(plan.id, {
    routineIds: before.filter((id) => id !== routineId),
    updatedAt: Date.now(),
  })

  const pruned = await pruneRoutines([routineId])

  undo.offer(`${name} fuera del plan`, async () => {
    await restoreRoutines(pruned)
    await db.plans.update(plan.id, { routineIds: before, updatedAt: Date.now() })
  })
}

async function activate() {
  const plan = data.value.plan
  if (!plan) return

  await db.transaction('rw', db.plans, async () => {
    for (const candidate of data.value.plans) {
      if (candidate.active === (candidate.id === plan.id)) continue
      await db.plans.update(candidate.id, { active: candidate.id === plan.id, updatedAt: Date.now() })
    }
  })

  switching.value = null
}
</script>

<template>
  <div v-if="data.plan" class="relative flex h-full flex-col overflow-hidden">
    <header class="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
      <button class="-ml-2.5 flex h-11 w-11 items-center justify-center text-muted" type="button" @click="router.back()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <div class="flex flex-grow flex-col gap-0.5">
        <input
          class="w-full bg-transparent text-lg font-bold tracking-[-0.01em] outline-none"
          :value="data.plan.name"
          aria-label="Nombre del plan"
          @change="rename(($event.target as HTMLInputElement).value)"
        />
        <span class="num text-xs text-dim">{{ rows.length }} rutinas</span>
      </div>
      <span
        v-if="data.plan.active"
        class="flex h-8 items-center rounded-xl bg-accent px-2.5 text-[10px] font-bold tracking-[0.08em] text-hero-ink"
      >ACTIVO</span>
      <button
        v-else
        class="flex h-11 items-center rounded-2xl border border-line-btn bg-surface-2 px-3.5 text-[13px] font-semibold text-muted"
        type="button"
        @click="switching = data.plan"
      >Activar</button>
    </header>

    <div class="flex flex-grow flex-col gap-3.5 overflow-y-auto px-4 py-3.5">
      <section class="flex flex-col gap-2">
        <div class="grid grid-cols-2 gap-1 rounded-[18px] border border-line bg-surface p-1 shadow-card">
          <button
            class="flex h-11 items-center justify-center rounded-xl text-sm transition-colors"
            :class="data.plan.mode === 'weekly' ? 'bg-accent font-bold text-hero-ink' : 'font-medium text-muted'"
            type="button"
            @click="setMode('weekly')"
          >Semanal</button>
          <button
            class="flex h-11 items-center justify-center rounded-xl text-sm transition-colors"
            :class="data.plan.mode === 'rotation' ? 'bg-accent font-bold text-hero-ink' : 'font-medium text-muted'"
            type="button"
            @click="setMode('rotation')"
          >Rotación continua</button>
        </div>
        <p class="px-1 text-xs text-dim">
          {{ data.plan.mode === 'weekly'
            ? 'Se reinicia cada lunes. Las que falten no se arrastran.'
            : 'Avanza al completar un entreno. Si no entrenas, te espera.' }}
        </p>
      </section>

      <draggable
        v-model="rows"
        item-key="id"
        handle=".drag-handle"
        :animation="160"
        class="flex flex-col gap-2"
        @end="persistOrder"
      >
        <template #item="{ element: item }">
          <div class="flex items-center gap-2 rounded-[18px] border border-line bg-surface px-3.5 shadow-card">
            <span class="drag-handle flex cursor-grab touch-none text-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
              </svg>
            </span>
            <RouterLink :to="`/routines/${item.id}`" class="flex h-[74px] flex-grow flex-col justify-center gap-1">
              <span class="text-base font-semibold">{{ item.name }}</span>
              <span class="num text-xs text-sub">
                {{ item.exercises }} ejercicios · {{ item.lastDate ? timeAgo(item.lastDate) : 'sin registros' }}
              </span>
            </RouterLink>
            <button
              class="flex h-9 w-9 items-center justify-center rounded-xl border border-line-btn text-icon"
              type="button"
              :aria-label="`Quitar ${item.name} del plan`"
              @click="removeRoutine(item.id)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14" /></svg>
            </button>
          </div>
        </template>
      </draggable>

      <button
        class="flex h-13 items-center justify-center gap-2 rounded-2xl border border-dashed border-line-btn text-sm font-medium text-muted"
        type="button"
        @click="adding = true"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Añadir rutina
      </button>
    </div>

    <div
      v-if="adding"
      class="absolute inset-0 z-20 flex flex-col justify-end bg-black/40"
      @click.self="adding = false"
    >
      <div class="flex max-h-[80%] flex-col gap-3 rounded-t-[28px] border-t border-line-btn bg-surface px-4 pt-3 pb-4">
        <div class="flex shrink-0 justify-center"><span class="h-1 w-9 rounded-sm bg-line-btn" /></div>

        <div class="flex shrink-0 items-start gap-3">
          <div class="flex flex-grow flex-col gap-1">
            <h2 class="text-lg font-bold tracking-[-0.01em]">Añadir rutina</h2>
            <p class="text-[12.5px] text-muted">Las rutinas se comparten entre planes</p>
          </div>
          <button
            class="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-muted"
            type="button"
            @click="adding = false"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div class="-mr-2 flex flex-col gap-2 overflow-y-auto pr-2">
          <button
            v-for="routine in available"
            :key="routine.id"
            class="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-left"
            type="button"
            @click="addRoutine(routine.id)"
          >
            <span class="flex flex-grow flex-col gap-1">
              <span class="text-[15px] font-semibold">{{ routine.name }}</span>
              <span class="num text-xs text-sub">{{ routine.exercises.length }} ejercicios</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-icon"><path d="M9 6l6 6-6 6" /></svg>
          </button>

          <p v-if="available.length === 0" class="py-4 text-center text-sm text-dim">
            Este plan ya usa todas tus rutinas.
          </p>
        </div>

        <button
          class="flex h-13 shrink-0 items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-bold text-hero-ink"
          type="button"
          @click="createRoutine"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Crear una rutina nueva
        </button>
      </div>
    </div>

    <SwitchPlanSheet
      v-if="switching"
      :plan="switching"
      :due-name="dueName"
      :week-done="weekDone"
      @confirm="activate"
      @close="switching = null"
    />
  </div>

  <div v-else class="flex h-full items-center justify-center px-8 text-center">
    <p class="text-sm text-dim">Este plan ya no existe. <button class="text-accent" type="button" @click="router.push('/plans')">Ver planes</button></p>
  </div>
</template>
