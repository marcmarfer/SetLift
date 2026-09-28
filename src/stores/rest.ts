import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRestStore = defineStore('rest', () => {
  const secondsLeft = ref(0)
  const total = ref(0)
  const enabled = ref(true)
  const nextLabel = ref('')

  let endsAt = 0
  let ticker: ReturnType<typeof setInterval> | null = null

  function stopTicker() {
    if (ticker) clearInterval(ticker)
    ticker = null
  }

  function tick() {
    if (!ticker) return
    secondsLeft.value = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
    if (secondsLeft.value <= 0) skip()
  }

  function start(seconds: number, label: string) {
    if (!enabled.value || seconds <= 0) return
    stopTicker()
    endsAt = Date.now() + seconds * 1000
    total.value = seconds
    nextLabel.value = label
    ticker = setInterval(tick, 500)
    tick()
  }

  function add(seconds: number) {
    if (!ticker) return
    endsAt += seconds * 1000
    tick()
    total.value = Math.max(total.value, secondsLeft.value)
  }

  function skip() {
    stopTicker()
    secondsLeft.value = 0
    nextLabel.value = ''
  }

  function setEnabled(value: boolean) {
    enabled.value = value
    if (!value) skip()
  }

  document.addEventListener('visibilitychange', tick)

  return { secondsLeft, total, enabled, nextLabel, start, add, skip, setEnabled }
})
