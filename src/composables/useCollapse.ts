import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'

const OPEN_MS = 300
const CLOSE_MS = 200
const MIN_MS = 80

export function useCollapse(
  open: Ref<boolean>,
  panel: Ref<HTMLElement | null>,
  content: Ref<HTMLElement | null>,
) {
  let animation: Animation | null = null

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function settle() {
    const element = panel.value
    if (!element) return

    if (open.value) {
      element.style.height = 'auto'
      element.style.opacity = '1'
      element.style.overflow = ''
    } else {
      element.style.height = '0px'
      element.style.opacity = '0'
      element.style.overflow = 'hidden'
    }
  }

  function run() {
    const element = panel.value
    const body = content.value
    if (!element || !body) return

    const fromHeight = element.getBoundingClientRect().height
    const fromOpacity = Number(getComputedStyle(element).opacity)

    animation?.cancel()
    animation = null

    element.style.overflow = 'hidden'
    element.style.height = `${fromHeight}px`
    element.style.opacity = String(fromOpacity)

    if (prefersReducedMotion()) {
      settle()
      return
    }

    const natural = body.getBoundingClientRect().height
    const targetHeight = open.value ? natural : 0
    const progress = Math.min(1, Math.abs(targetHeight - fromHeight) / (natural || 1))
    const duration = Math.max(MIN_MS, (open.value ? OPEN_MS : CLOSE_MS) * progress)

    animation = element.animate(
      [
        { height: `${fromHeight}px`, opacity: fromOpacity },
        { height: `${targetHeight}px`, opacity: open.value ? 1 : 0 },
      ],
      { duration, easing: open.value ? 'ease-out' : 'ease-in', fill: 'forwards' },
    )

    animation.onfinish = () => {
      settle()
      animation?.cancel()
      animation = null
    }
  }

  watch(open, run)
  onMounted(settle)
  onBeforeUnmount(() => {
    animation?.cancel()
    animation = null
  })

}
