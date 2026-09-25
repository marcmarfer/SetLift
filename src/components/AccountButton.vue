<script setup lang="ts">
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
</script>

<template>
  <RouterLink
    to="/account"
    aria-label="Tu cuenta"
    class="num flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent-line bg-accent-soft text-sm font-bold text-accent"
  >
    {{ settings.initials() }}
  </RouterLink>
</template>
