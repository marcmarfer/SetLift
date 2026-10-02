<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { db } from '../db'
import { useLive } from '../composables/useLive'
import BrandMark from './BrandMark.vue'
import TourPlan from './TourPlan.vue'
import TourRoutine from './TourRoutine.vue'
import TourSheet from './TourSheet.vue'
import TourSets from './TourSets.vue'
import TourProgress from './TourProgress.vue'

const props = withDefaults(defineProps<{ replay?: boolean }>(), { replay: false })
const emit = defineEmits<{ finish: [next: 'plans' | 'today'] }>()

const steps = [TourPlan, TourRoutine, TourSheet, TourSets, TourProgress]
const ENTER_MS = 220
const SETTLE_MS = 700
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

const root = ref<HTMLElement | null>(null)
const track = ref<HTMLElement | null>(null)
const primary = ref<HTMLButtonElement | null>(null)
const back = ref<HTMLButtonElement | null>(null)
const skip = ref<HTMLButtonElement | null>(null)
const index = ref(0)
const announcement = ref('')

let settleTimer: ReturnType<typeof setTimeout> | undefined
let settling = false

const last = computed(() => index.value === steps.length - 1)
const hasPlan = useLive(async () => (await db.plans.count()) > 0, false)
const showBack = computed(() => index.value > 0)
const showSkip = computed(() => props.replay || !last.value || !hasPlan.value)

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function onScroll() {
  const element = track.value
  if (!element || element.clientWidth === 0) return
  index.value = Math.round(element.scrollLeft / element.clientWidth)
}

function settle() {
  settling = false
  clearTimeout(settleTimer)
}

function go(target: number) {
  const element = track.value
  if (!element || settling) return
  const position = Math.min(Math.max(target, 0), steps.length - 1)
  if (position === index.value) return
  settling = true
  clearTimeout(settleTimer)
  settleTimer = setTimeout(settle, SETTLE_MS)
  element.scrollTo({ left: position * element.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' })
}

function next() {
  if (settling) return
  if (!last.value) {
    go(index.value + 1)
    return
  }
  emit('finish', props.replay || hasPlan.value ? 'today' : 'plans')
}

function onKey(event: KeyboardEvent) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return
  event.preventDefault()
  go(index.value + (event.key === 'ArrowRight' ? 1 : -1))
}

async function enter() {
  const element = root.value
  if (!element || reducedMotion()) return
  const animation = element.animate(
    [
      { transform: 'translateX(30%)', opacity: 0 },
      { transform: 'translateX(0)', opacity: 1 },
    ],
    { duration: ENTER_MS, easing: EASING },
  )
  const deadline = new Promise<void>((resolve) => setTimeout(resolve, ENTER_MS + 120))
  await Promise.race([animation.finished.then(() => undefined, () => undefined), deadline])
  animation.cancel()
}

function keepFocus(element: HTMLElement | null) {
  if (element && document.activeElement === element) nextTick(() => primary.value?.focus({ preventScroll: true }))
}

watch(showBack, (visible) => visible || keepFocus(back.value), { flush: 'pre' })
watch(showSkip, (visible) => visible || keepFocus(skip.value), { flush: 'pre' })

watch(index, async (position) => {
  await nextTick()
  const block = track.value?.children[position]?.lastElementChild
  if (!block) return
  const copy = block.cloneNode(true) as HTMLElement
  copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove())
  announcement.value = [...copy.children]
    .map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('. ')
})

onMounted(() => {
  window.addEventListener('keydown', onKey)
  primary.value?.focus({ preventScroll: true })
  enter()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(settleTimer)
})
</script>

<template>
  <div ref="root" class="relative flex h-full flex-col overflow-hidden bg-surface">
    <h1 class="sr-only">Cómo funciona SetLift</h1>

    <div
      ref="track"
      class="flex min-h-0 flex-grow snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="region"
      aria-roledescription="carrusel"
      aria-label="Cómo funciona SetLift"
      @scroll.passive="onScroll"
      @scrollend="settle"
    >
      <component
        :is="step"
        v-for="(step, position) in steps"
        :key="position"
        role="group"
        aria-roledescription="paso"
        :aria-label="`${position + 1} de ${steps.length}`"
        :aria-hidden="position !== index"
      />
    </div>

    <div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-12 items-center px-5">
      <div class="flex flex-1">
        <BrandMark :size="22" />
      </div>
      <div class="flex gap-1.5" aria-hidden="true">
        <span
          v-for="dot in steps.length"
          :key="dot"
          class="h-1.5 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none"
          :class="dot - 1 === index ? 'w-5 bg-accent' : 'w-1.5 bg-faint'"
        />
      </div>
      <div class="flex flex-1 justify-end">
        <button
          v-if="showSkip"
          ref="skip"
          class="pointer-events-auto -mr-2 flex h-11 items-center px-2 text-sm font-medium text-muted"
          type="button"
          @click="emit('finish', 'today')"
        >{{ replay ? 'Cerrar' : last ? 'Ahora no' : 'Saltar' }}</button>
      </div>
    </div>

    <p class="sr-only" aria-live="polite">Paso {{ index + 1 }} de {{ steps.length }}. {{ announcement }}</p>

    <div class="flex shrink-0 gap-2 px-5 pb-5 pt-3">
      <button
        v-if="showBack"
        ref="back"
        class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-muted"
        type="button"
        aria-label="Paso anterior"
        @click="go(index - 1)"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <button
        ref="primary"
        class="flex h-14 flex-grow items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink"
        type="button"
        @click="next"
      >
        <template v-if="!last">Siguiente</template>
        <template v-else-if="replay">Listo</template>
        <template v-else-if="hasPlan">Empezar</template>
        <template v-else>Crear mi plan</template>
      </button>
    </div>
  </div>
</template>
