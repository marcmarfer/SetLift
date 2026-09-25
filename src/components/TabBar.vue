<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  { to: '/', label: 'Hoy' },
  { to: '/routines', label: 'Rutinas' },
  { to: '/history', label: 'Historial' },
  { to: '/progress', label: 'Progreso' },
]

const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
</script>

<template>
  <nav class="grid grid-cols-4 gap-1 border-t border-line bg-surface px-3 pt-2 pb-3.5">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="flex h-13 flex-col items-center justify-center gap-1"
    >
      <span
        class="flex h-7.5 w-12 items-center justify-center rounded-full transition-colors"
        :class="isActive(tab.to) ? 'bg-accent text-hero-ink' : 'text-dim'"
      >
        <svg v-if="tab.to === '/'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /><path d="M9 15l2 2 4-4" />
        </svg>
        <svg v-else-if="tab.to === '/routines'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.4" /><circle cx="4.5" cy="12" r="1.4" /><circle cx="4.5" cy="18" r="1.4" />
        </svg>
        <svg v-else-if="tab.to === '/history'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.5l3.5 2" />
        </svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 16l5-5 3.5 3.5L20 7" /><path d="M15 7h5v5" />
        </svg>
      </span>
      <span class="text-[11px]" :class="isActive(tab.to) ? 'font-semibold text-accent' : 'text-dim'">
        {{ tab.label }}
      </span>
    </RouterLink>
  </nav>
</template>
