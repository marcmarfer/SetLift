<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TabBar from './components/TabBar.vue'
import UndoBar from './components/UndoBar.vue'
import { TAB_PATHS } from './router'
import { useAuthStore } from './stores/auth'

const route = useRoute()
const auth = useAuthStore()

const showTabs = computed(() => TAB_PATHS.includes(route.path))
const showReauth = computed(() => auth.needsReauth && auth.phase === 'ready')
</script>

<template>
  <div class="mx-auto flex h-full max-w-[430px] flex-col bg-app">
    <RouterLink
      v-if="showReauth"
      to="/login"
      class="flex shrink-0 items-center gap-2 border-b border-warn bg-warn-soft px-4 py-2 text-[12px] leading-snug text-ink"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="shrink-0 text-warn"><path d="M12 8v5M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></svg>
      <span class="flex-grow">Sin conexión con tu cuenta. No se está guardando la copia.</span>
      <span class="font-semibold text-accent-ink">Entrar</span>
    </RouterLink>

    <main class="flex-grow overflow-hidden">
      <RouterView />
    </main>
    <UndoBar />
    <TabBar v-if="showTabs" />
  </div>
</template>
