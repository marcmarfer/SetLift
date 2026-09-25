import { defineStore } from 'pinia'
import { ref } from 'vue'

const VISIBLE_MS = 6000
const FADE_MS = 1200

export const useUndoStore = defineStore('undo', () => {
  const message = ref('')
  const pending = ref<(() => void | Promise<void>) | null>(null)
  const fading = ref(false)

  let fadeTimer: ReturnType<typeof setTimeout> | null = null
  let clearTimer: ReturnType<typeof setTimeout> | null = null

  function stopTimers() {
    if (fadeTimer) clearTimeout(fadeTimer)
    if (clearTimer) clearTimeout(clearTimer)
    fadeTimer = null
    clearTimer = null
  }

  function clear() {
    stopTimers()
    message.value = ''
    pending.value = null
    fading.value = false
  }

  function offer(text: string, restore: () => void | Promise<void>) {
    stopTimers()
    message.value = text
    pending.value = restore
    fading.value = false
    fadeTimer = setTimeout(() => {
      fading.value = true
    }, VISIBLE_MS)
    clearTimer = setTimeout(clear, VISIBLE_MS + FADE_MS)
  }

  async function undo() {
    const restore = pending.value
    clear()
    if (restore) await restore()
  }

  return { message, pending, fading, fadeMs: FADE_MS, offer, undo, clear }
})
