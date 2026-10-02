import { computed, ref } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'setlift.installDismissed'

const deferred = ref<BeforeInstallPromptEvent | null>(null)
const installed = ref(isStandalone())
const dismissed = ref(readDismissed())

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

function readDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function useInstallPrompt() {
  const mode = computed<'native' | 'ios' | null>(() => {
    if (installed.value || dismissed.value) return null
    if (deferred.value) return 'native'
    return isIos ? 'ios' : null
  })

  function dismiss() {
    dismissed.value = true
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {}
  }

  async function install() {
    const event = deferred.value
    if (!event) return
    deferred.value = null
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'dismissed') dismiss()
  }

  return { mode, install, dismiss }
}
