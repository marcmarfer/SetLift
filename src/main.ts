import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { onLocalChange } from './db'
import { useAuthStore } from './stores/auth'
import { useSettingsStore } from './stores/settings'
import { expireWeeklyLaterSessions, parkDeferredFromToday } from './lib/session'
import { sync } from './lib/sync'
import './style.css'

expireWeeklyLaterSessions()
  .then(() => parkDeferredFromToday())
  .catch((error) => console.error('[sessions]', error))
  .finally(() => {
    const pinia = createPinia()
    const app = createApp(App).use(pinia).use(router)

    const auth = useAuthStore(pinia)
    const settings = useSettingsStore(pinia)
    auth.begin()
    app.mount('#app')

    const ready = () => (auth.phase === 'ready' ? auth.userId : null)

    function catchUp() {
      const id = ready()
      if (!id) return
      sync(id).catch((error) => console.error('[sync]', error))
      settings.syncProfile(id).catch((error) => console.error('[profile]', error))
    }

    let pending: ReturnType<typeof setTimeout> | null = null
    function soon() {
      if (!ready()) return
      if (pending) clearTimeout(pending)
      pending = setTimeout(() => {
        pending = null
        catchUp()
      }, 4000)
    }

    auth.restore().then(() => {
      settings.seedName(auth.displayName)
      catchUp()
    })

    onLocalChange(soon)
    watch(() => settings.updatedAt, soon)
    window.addEventListener('online', catchUp)

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      expireWeeklyLaterSessions()
        .then(() => parkDeferredFromToday())
        .then(catchUp)
        .catch((error) => console.error('[sessions]', error))
    })
  })
