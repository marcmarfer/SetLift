<script setup lang="ts">
import { useSettingsStore } from '../stores/settings'
import Avatar from './Avatar.vue'

const settings = useSettingsStore()
</script>

<template>
  <RouterLink to="/account" aria-label="Tu cuenta" class="shrink-0">
    <Avatar :src="settings.avatar" :initials="settings.initials()" class="h-11 w-11 text-sm" />
  </RouterLink>
</template>
