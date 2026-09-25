<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ src?: string | null; initials: string }>()

const broken = ref(false)

watch(
  () => props.src,
  () => {
    broken.value = false
  },
)
</script>

<template>
  <span class="num flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-accent-line bg-accent-soft font-bold text-accent">
    <img
      v-if="src && !broken"
      :src="src"
      alt=""
      class="h-full w-full object-cover"
      referrerpolicy="no-referrer"
      @error="broken = true"
    />
    <template v-else>{{ initials }}</template>
  </span>
</template>
