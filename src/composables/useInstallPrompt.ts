import { computed, ref } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const deferred = ref<BeforeInstallPromptEvent | null>(null)
const installed = ref(isStandalone())

const isIos =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferred.value = event as BeforeInstallPromptEvent
})

window.addEventListener('appinstalled', () => {
  installed.value = true
  deferred.value = null
})

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function useInstallPrompt() {
  const mode = computed<'native' | 'ios' | null>(() => {
    if (installed.value) return null
    if (deferred.value) return 'native'
    return isIos ? 'ios' : null
  })

  async function install() {
    const event = deferred.value
    if (!event) return
    deferred.value = null
    await event.prompt()
    await event.userChoice
  }

  return { mode, install }
}
