<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import { db, newId } from '../db'
import { useLive } from '../composables/useLive'
import { addDays, timeAgo, today } from '../lib/dates'
import { dueRoutine, type SheetProgress } from '../lib/plan'
import AccountButton from '../components/AccountButton.vue'
import type { Plan, PlanMode, Routine, Session } from '../types'

interface RoutinesData {
  plans: Plan[]
  routines: Routine[]
  sessions: Session[]
  progress: Record<string, SheetProgress>
}

const router = useRouter()

const data = useLive<RoutinesData>(
  async () => {
    const sessions = await db.sessions.toArray()
    const progress: Record<string, SheetProgress> = {}

    for (const session of sessions.filter((item) => !item.skipped && item.date >= addDays(today(), -60))) {
      const sets = await db.sets.where('sessionId').equals(session.id).toArray()
      progress[session.id] = { done: sets.filter((set) => set.done).length, total: sets.length }
    }

    return {
      plans: await db.plans.toArray(),
      routines: await db.routines.toArray(),
      sessions,
      progress,
    }
  },
  { plans: [], routines: [], sessions: [], progress: {} },
)

const activePlan = computed(() => data.value.plans.find((plan) => plan.active) ?? null)

const planRoutines = computed(() => {
  const plan = activePlan.value
  if (!plan) return []
  const due = dueRoutine(plan, data.value.sessions, data.value.progress)

  return plan.routineIds.flatMap((id) => {
    const routine = data.value.routines.find((candidate) => candidate.id === id)
    if (!routine) return []

    const previous = data.value.sessions
      .filter((session) => session.routineId === id && !session.skipped)
      .sort((a, b) => (a.date < b.date ? 1 : -1))

    return [{
      id,
      name: routine.name,
      exercises: routine.exercises.length,
      lastDate: previous[0]?.date ?? null,
      due: id === due,
    }]
  })
})

const rows = ref<Array<{ id: string; name: string; exercises: number; lastDate: string | null; due: boolean }>>([])

watch(planRoutines, (list) => { rows.value = [...list] }, { immediate: true })

async function persistOrder() {
  const plan = activePlan.value
  if (!plan) return
  await db.plans.update(plan.id, { routineIds: rows.value.map((row) => row.id), updatedAt: Date.now() })
}

async function renamePlan(planId: string, value: string) {
  const name = value.trim()
  if (!name) return
  await db.plans.update(planId, { name, updatedAt: Date.now() })
}

async function createRoutine() {
  const plan = activePlan.value
  if (!plan) {
    router.push('/plans')
    return
  }

  const id = newId()
  await db.routines.put({ id, name: 'Rutina nueva', exercises: [], updatedAt: Date.now() })
  await db.plans.update(plan.id, { routineIds: [...plan.routineIds, id], updatedAt: Date.now() })
  router.push(`/routines/${id}`)
}

async function setMode(mode: PlanMode) {
  const plan = activePlan.value
  if (!plan || plan.mode === mode) return
  await db.plans.update(plan.id, { mode, updatedAt: Date.now() })
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <header class="flex items-center gap-3 px-4 pt-4.5 pb-3">
      <h1 class="flex-grow text-[26px] font-bold tracking-[-0.02em]">Rutinas</h1>
      <button class="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-btn bg-surface-2" type="button" @click="createRoutine">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <AccountButton />
    </header>

    <div class="flex flex-grow flex-col gap-3.5 overflow-y-auto px-4 pb-4">
      <section v-if="!activePlan" class="flex flex-col gap-3.5 rounded-[26px] border border-line bg-surface p-5 shadow-card">
        <div class="flex flex-col gap-1.5">
          <h2 class="text-[19px] font-bold tracking-[-0.02em]">Todavía no hay plan</h2>
          <p class="text-[13px] leading-relaxed text-muted">
            Un plan elige qué rutinas entran y en qué orden. Sin plan, la app no sabe qué toca hoy.
          </p>
        </div>
        <RouterLink
          to="/plans"
          class="flex h-13 items-center justify-center rounded-2xl bg-accent text-sm font-bold text-hero-ink"
        >Crear un plan</RouterLink>
      </section>

      <section v-if="activePlan" class="flex items-center gap-3 rounded-[22px] bg-hero p-3.5 shadow-hero">
        <div class="flex flex-grow flex-col gap-1.5">
          <span class="text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Plan activo</span>
          <input
            class="w-full bg-transparent text-[17px] font-bold tracking-[-0.01em] text-hero-ink outline-none"
            :value="activePlan.name"
            aria-label="Nombre del plan"
            @change="renamePlan(activePlan.id, ($event.target as HTMLInputElement).value)"
          />
          <span class="num text-xs text-hero-muted">{{ activePlan.routineIds.length }} rutinas</span>
        </div>
        <RouterLink to="/plans" class="flex h-9 items-center rounded-full bg-hero-surface px-3.5 text-[13px] font-semibold text-hero-ink">Cambiar</RouterLink>
      </section>

      <section v-if="activePlan" class="flex flex-col gap-2">
        <div class="grid grid-cols-2 gap-1 rounded-[18px] border border-line bg-surface p-1 shadow-card">
          <button
            class="flex h-11 items-center justify-center rounded-xl text-sm transition-colors"
            :class="activePlan.mode === 'weekly' ? 'bg-accent font-bold text-hero-ink' : 'font-medium text-muted'"
            type="button"
            @click="setMode('weekly')"
          >Semanal</button>
          <button
            class="flex h-11 items-center justify-center rounded-xl text-sm transition-colors"
            :class="activePlan.mode === 'rotation' ? 'bg-accent font-bold text-hero-ink' : 'font-medium text-muted'"
            type="button"
            @click="setMode('rotation')"
          >Rotación continua</button>
        </div>
        <p class="px-1 text-xs text-dim">
          {{ activePlan.mode === 'weekly'
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
          <RouterLink
            :to="`/routines/${item.id}`"
            class="flex h-[74px] items-center gap-3 rounded-[18px] border px-3.5"
            :class="item.due ? 'border-accent bg-accent-soft' : 'border-line bg-surface shadow-card'"
          >
            <span class="drag-handle flex cursor-grab touch-none text-icon" @click.prevent>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
              </svg>
            </span>
            <div class="flex flex-grow flex-col gap-1">
              <span class="text-base" :class="item.due ? 'font-bold' : 'font-semibold'">{{ item.name }}</span>
              <span class="num text-xs" :class="item.due ? 'text-accent-ink' : 'text-sub'">
                {{ item.exercises }} ejercicios · {{ item.due ? 'toca ahora' : item.lastDate ? timeAgo(item.lastDate) : 'sin registros' }}
              </span>
            </div>
            <span class="text-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </span>
          </RouterLink>
        </template>
      </draggable>
    </div>
  </div>
</template>
