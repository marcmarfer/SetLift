import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRestStore = defineStore('rest', () => {
  const secondsLeft = ref(0)
  const total = ref(0)
  const enabled = ref(true)
  const nextLabel = ref('')

  let ticker: ReturnType<typeof setInterval> | null = null

  function stopTicker() {
    if (ticker) clearInterval(ticker)
    ticker = null
  }

  function start(seconds: number, label: string) {
    if (!enabled.value || seconds <= 0) return
    total.value = seconds
    secondsLeft.value = seconds
    nextLabel.value = label
    stopTicker()
    ticker = setInterval(() => {
      secondsLeft.value -= 1
      if (secondsLeft.value <= 0) skip()
    }, 1000)
  }

  function add(seconds: number) {
    if (secondsLeft.value <= 0) return
    secondsLeft.value = Math.max(0, secondsLeft.value + seconds)
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

  return { secondsLeft, total, enabled, nextLabel, start, add, skip, setEnabled }
})
