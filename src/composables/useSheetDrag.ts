import type { Ref } from 'vue'

const LOCK_PX = 6
const CLOSE_RATIO = 0.25
const FLICK_PX_PER_MS = 0.45
const FLICK_MIN_PX = 40
const OUT_MS = 180
const BACK_MS = 200
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

export function useSheetDrag(panel: Ref<HTMLElement | null>, close: () => void) {
  let handle: HTMLElement | null = null
  let pointer: number | null = null
  let dragging = false
  let startY = 0
  let startTime = 0
  let offset = 0

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function place(y: number) {
    if (panel.value) panel.value.style.transform = y ? `translateY(${y}px)` : ''
  }

  async function slide(to: number, duration: number) {
    const element = panel.value
    if (!element) return
    const from = offset
    place(to)
    if (reducedMotion()) return
    const animation = element.animate(
      [{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }],
      { duration, easing: EASING },
    )
    const deadline = new Promise<void>((resolve) => setTimeout(resolve, duration + 120))
    await Promise.race([animation.finished.then(() => undefined, () => undefined), deadline])
    animation.cancel()
  }

  function unlisten() {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', release)
    window.removeEventListener('pointercancel', release)
  }

  function start(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) return
    unlisten()
    handle = event.currentTarget as HTMLElement
    pointer = event.pointerId
    dragging = false
    startY = event.clientY
    startTime = event.timeStamp
    offset = 0
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
  }

  function move(event: PointerEvent) {
    if (event.pointerId !== pointer) return
    const dy = event.clientY - startY

    if (!dragging) {
      if (Math.abs(dy) < LOCK_PX) return
      dragging = true
      handle?.setPointerCapture(event.pointerId)
    }

    offset = Math.max(0, dy)
    place(offset)
  }

  async function release(event: PointerEvent) {
    if (event.pointerId !== pointer) return
    unlisten()
    pointer = null
    if (!dragging) return
    dragging = false

    const height = panel.value?.offsetHeight ?? 0
    const speed = offset / Math.max(1, event.timeStamp - startTime)
    const far = offset > height * CLOSE_RATIO
    const flick = speed > FLICK_PX_PER_MS && offset > FLICK_MIN_PX

    if (event.type === 'pointerup' && (far || flick)) {
      await slide(height, OUT_MS)
      close()
      return
    }

    await slide(0, BACK_MS)
    offset = 0
  }

  return start
}
