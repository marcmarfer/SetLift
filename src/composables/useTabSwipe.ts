import { nextTick, onBeforeUnmount, onMounted, type Ref } from 'vue'
import type { Router } from 'vue-router'

const EDGE_PX = 24
const LOCK_PX = 10
const COMMIT_RATIO = 0.25
const FLICK_PX_PER_MS = 0.45
const FLICK_MIN_PX = 40
const RUBBER = 0.25
const OUT_MS = 180
const IN_MS = 220
const BACK_MS = 180
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

const OVERLAY = '.inset-0.z-20, .inset-0.z-30'
const UNTOUCHABLE = 'input, textarea, select, [contenteditable], .drag-handle, .sortable-chosen'

export function useTabSwipe(
  area: Ref<HTMLElement | null>,
  pager: Ref<HTMLElement | null>,
  tabs: string[],
  router: Router,
  enabled: () => boolean,
) {
  let state: 'idle' | 'pending' | 'dragging' = 'idle'
  let busy = false
  let startX = 0
  let startY = 0
  let startTime = 0
  let offset = 0

  const current = () => tabs.indexOf(router.currentRoute.value.path)
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function scrollsSideways(target: Element) {
    for (let node: Element | null = target; node && node !== area.value; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowX
      if ((overflow === 'auto' || overflow === 'scroll') && node.scrollWidth > node.clientWidth) return true
    }
    return false
  }

  function blocked(target: EventTarget | null) {
    if (!(target instanceof Element)) return true
    if (document.querySelector(OVERLAY)) return true
    if (target.closest(UNTOUCHABLE)) return true
    return scrollsSideways(target)
  }

  function slide(element: HTMLElement, from: number, to: number, duration: number, fadeIn = false) {
    element.style.transform = `translateX(${to}px)`
    if (reducedMotion()) return Promise.resolve()
    const animation = element.animate(
      [
        { transform: `translateX(${from}px)`, opacity: fadeIn ? 0 : 1 },
        { transform: `translateX(${to}px)`, opacity: 1 },
      ],
      { duration, easing: EASING },
    )
    const deadline = new Promise<void>((resolve) => setTimeout(resolve, duration + 120))
    return Promise.race([animation.finished.then(() => undefined, () => undefined), deadline]).then(() => {
      animation.cancel()
    })
  }

  function onStart(event: TouchEvent) {
    if (busy || !enabled() || event.touches.length !== 1 || current() === -1) return
    const touch = event.touches[0]
    if (touch.clientX < EDGE_PX || touch.clientX > window.innerWidth - EDGE_PX) return
    if (blocked(event.target)) return

    startX = touch.clientX
    startY = touch.clientY
    startTime = event.timeStamp
    offset = 0
    state = 'pending'
  }

  function onMove(event: TouchEvent) {
    if (state === 'idle') return
    if (event.touches.length !== 1) {
      state = 'idle'
      return
    }

    const touch = event.touches[0]
    const dx = touch.clientX - startX
    const dy = touch.clientY - startY

    if (state === 'pending') {
      if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return
      if (Math.abs(dx) <= Math.abs(dy) * 1.2) {
        state = 'idle'
        return
      }
      state = 'dragging'
    }

    event.preventDefault()
    const index = current()
    const pastEnd = (dx > 0 && index === 0) || (dx < 0 && index === tabs.length - 1)
    offset = pastEnd ? dx * RUBBER : dx
    if (pager.value) pager.value.style.transform = `translateX(${offset}px)`
  }

  async function onEnd(event: TouchEvent) {
    if (state !== 'dragging') {
      state = 'idle'
      return
    }
    state = 'idle'

    const element = pager.value
    if (!element) return

    const width = element.clientWidth
    const direction = offset < 0 ? 1 : -1
    const target = current() + direction
    const speed = Math.abs(offset) / Math.max(1, event.timeStamp - startTime)
    const far = Math.abs(offset) > width * COMMIT_RATIO
    const flick = speed > FLICK_PX_PER_MS && Math.abs(offset) > FLICK_MIN_PX
    const commit = event.type === 'touchend' && target >= 0 && target < tabs.length && (far || flick)

    busy = true
    try {
      if (!commit) {
        await slide(element, offset, 0, BACK_MS)
        return
      }
      await slide(element, offset, -direction * width, OUT_MS)
      await router.push(tabs[target])
      await nextTick()
      await slide(element, direction * width * 0.3, 0, IN_MS, true)
    } finally {
      element.style.transform = ''
      busy = false
    }
  }

  onMounted(() => {
    const element = area.value
    if (!element) return
    element.addEventListener('touchstart', onStart, { passive: true })
    element.addEventListener('touchmove', onMove, { passive: false })
    element.addEventListener('touchend', onEnd)
    element.addEventListener('touchcancel', onEnd)
  })

  onBeforeUnmount(() => {
    const element = area.value
    if (!element) return
    element.removeEventListener('touchstart', onStart)
    element.removeEventListener('touchmove', onMove)
    element.removeEventListener('touchend', onEnd)
    element.removeEventListener('touchcancel', onEnd)
  })
}
