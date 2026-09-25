<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import { db, newId, plain } from '../db'
import { useLive } from '../composables/useLive'
import { weekStart } from '../lib/dates'
import { dueRoutine } from '../lib/plan'
import { pruneRoutines, restoreRoutines } from '../lib/routines'
import { useUndoStore } from '../stores/undo'
import SwitchPlanSheet from '../components/SwitchPlanSheet.vue'
import type { Plan, Routine, Session } from '../types'

const router = useRouter()
const undo = useUndoStore()

const switching = ref<Plan | null>(null)
const ordered = ref<Plan[]>([])

interface PlansData {
  plans: Plan[]
  routines: Routine[]
  sessions: Session[]
}

const data = useLive<PlansData>(
  async () => ({
    plans: await db.plans.toArray(),
    routines: await db.routines.toArray(),
    sessions: await db.sessions.toArray(),
  }),
  { plans: [], routines: [], sessions: [] },
)

watch(
  () => data.value.plans,
  (plans) => {
    ordered.value = plans.filter((plan) => !plan.active).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  },
  { immediate: true },
)

const nameOf = (id: string) => data.value.routines.find((routine) => routine.id === id)?.name ?? '—'

const activePlan = computed(() => data.value.plans.find((plan) => plan.active) ?? null)

const weekDone = computed(() => {
  const plan = activePlan.value
  if (!plan) return []
  const monday = weekStart()
  const done = new Set(
    data.value.sessions
      .filter((session) => session.routineId && session.date >= monday)
      .map((session) => session.routineId as string),
  )
  return plan.routineIds.filter((id) => done.has(id)).map(nameOf)
})

const dueName = computed(() => {
  const plan = activePlan.value
  if (!plan) return null
  const id = dueRoutine(plan, data.value.sessions)
  return id ? nameOf(id) : null
})

async function persistOrder() {
  for (const [index, plan] of ordered.value.entries()) {
    if (plan.order === index + 1) continue
    await db.plans.update(plan.id, { order: index + 1, updatedAt: Date.now() })
  }
}

async function activate(plan: Plan) {
  await db.transaction('rw', db.plans, async () => {
    for (const candidate of data.value.plans) {
      if (candidate.active === (candidate.id === plan.id)) continue
      await db.plans.update(candidate.id, { active: candidate.id === plan.id, updatedAt: Date.now() })
    }
  })
  switching.value = null
}

async function createPlan() {
  const base = activePlan.value
  const id = newId()

  await db.plans.put({
    id,
    name: base ? `${base.name} (copia)` : 'Plan nuevo',
    mode: base?.mode ?? 'weekly',
    routineIds: base ? [...base.routineIds] : [],
    active: data.value.plans.length === 0,
    order: ordered.value.length,
    updatedAt: Date.now(),
  })

  if (data.value.plans.length === 0) router.push(`/plans/${id}`)
}

async function rename(planId: string, value: string) {
  const name = value.trim()
  if (!name) return
  await db.plans.update(planId, { name, updatedAt: Date.now() })
}

async function removePlan(plan: Plan) {
  const wasActive = plan.active
  const replacement = data.value.plans.find((candidate) => candidate.id !== plan.id) ?? null

  await db.plans.delete(plan.id)
  if (wasActive && replacement) {
    await db.plans.update(replacement.id, { active: true, updatedAt: Date.now() })
  }

  const pruned = await pruneRoutines(plan.routineIds)

  undo.offer(`${plan.name} eliminado`, async () => {
    await restoreRoutines(pruned)
    await db.plans.put(plain(plan))
    if (wasActive && replacement) {
      await db.plans.update(replacement.id, { active: false, updatedAt: Date.now() })
    }
  })
}
</script>

<template>
  <div class="relative flex h-full flex-col overflow-hidden">
    <header class="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
      <button class="-ml-2.5 flex h-11 w-11 items-center justify-center text-muted" type="button" @click="router.back()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <h1 class="flex-grow text-lg font-bold tracking-[-0.01em]">Planes</h1>
      <button
        class="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-btn bg-surface-2"
        type="button"
        @click="createPlan"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </header>

    <div class="flex flex-grow flex-col gap-2.5 overflow-y-auto px-4 py-3.5">
      <article v-if="activePlan" class="flex flex-col gap-2.5 rounded-3xl bg-hero p-4 shadow-hero">
        <div class="flex items-center gap-2">
          <input
            class="w-full flex-grow bg-transparent text-[17px] font-bold tracking-[-0.01em] text-hero-ink outline-none"
            :value="activePlan.name"
            aria-label="Nombre del plan"
            @change="rename(activePlan.id, ($event.target as HTMLInputElement).value)"
          />
          <span class="flex h-6 shrink-0 items-center rounded-xl bg-accent px-2.5 text-[10px] font-bold tracking-[0.08em] text-hero-ink">
            ACTIVO
          </span>
          <button
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hero-line bg-hero-surface text-hero-ink"
            type="button"
            @click="removePlan(activePlan)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 7h14" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" />
            </svg>
          </button>
        </div>

        <p class="text-[12.5px] leading-relaxed text-hero-muted">
          {{ activePlan.routineIds.map(nameOf).join(' · ') || 'Sin rutinas' }}
        </p>

        <div class="flex items-center gap-2">
          <span class="flex h-6.5 items-center rounded-full bg-hero-surface px-2.5 text-[11.5px] font-medium text-hero-ink">
            {{ activePlan.mode === 'weekly' ? 'Semanal' : 'Rotación continua' }}
          </span>
          <span class="num flex-grow text-xs text-hero-muted">{{ activePlan.routineIds.length }} rutinas</span>
          <RouterLink
            :to="`/plans/${activePlan.id}`"
            class="flex h-9 items-center gap-1 rounded-xl bg-hero-surface px-3 text-[12.5px] font-semibold text-hero-ink"
          >
            Configurar
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </RouterLink>
        </div>
      </article>

      <draggable
        v-model="ordered"
        item-key="id"
        handle=".drag-handle"
        :animation="160"
        class="flex flex-col gap-2.5"
        @end="persistOrder"
      >
        <template #item="{ element: plan }">
          <article class="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface p-4 shadow-card">
            <div class="flex items-center gap-2">
              <span class="drag-handle flex cursor-grab touch-none items-center text-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" />
                  <circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                </svg>
              </span>
              <input
                class="w-full flex-grow bg-transparent text-[17px] font-bold tracking-[-0.01em] outline-none"
                :value="plan.name"
                aria-label="Nombre del plan"
                @change="rename(plan.id, ($event.target as HTMLInputElement).value)"
              />
              <button
                class="flex h-9 shrink-0 items-center rounded-xl border border-line-btn px-3 text-[12.5px] font-semibold text-muted"
                type="button"
                @click="switching = plan"
              >Activar</button>
              <button
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line-btn text-danger"
                type="button"
                @click="removePlan(plan)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 7h14" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" />
                </svg>
              </button>
            </div>

            <p class="text-[12.5px] leading-relaxed text-sub">
              {{ plan.routineIds.map(nameOf).join(' · ') || 'Sin rutinas' }}
            </p>

            <div class="flex items-center gap-2">
              <span class="flex h-6.5 items-center rounded-full border border-line-btn bg-surface-2 px-2.5 text-[11.5px] font-medium text-muted">
                {{ plan.mode === 'weekly' ? 'Semanal' : 'Rotación continua' }}
              </span>
              <span class="num flex-grow text-xs text-dim">{{ plan.routineIds.length }} rutinas</span>
              <RouterLink
                :to="`/plans/${plan.id}`"
                class="flex h-9 items-center gap-1 rounded-xl border border-line-btn bg-surface-2 px-3 text-[12.5px] font-semibold text-muted"
              >
                Configurar
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </RouterLink>
            </div>
          </article>
        </template>
      </draggable>

      <button
        v-if="data.plans.length === 0"
        class="flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent text-base font-bold text-hero-ink"
        type="button"
        @click="createPlan"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Crear un plan
      </button>

      <p class="px-1 pt-1 text-[11.5px] leading-relaxed text-dim">
        Las rutinas son las mismas en todos los planes: un plan solo elige cuáles entran y en qué orden.
        Cambiar de plan no toca su historial.
      </p>
    </div>

    <SwitchPlanSheet
      v-if="switching"
      :plan="switching"
      :due-name="dueName"
      :week-done="weekDone"
      @confirm="activate(switching)"
      @close="switching = null"
    />

  </div>
</template>
