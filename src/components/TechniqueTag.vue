<script setup lang="ts">
withDefaults(defineProps<{ technique: string; chip?: boolean }>(), { chip: false })
</script>

<template>
  <span
    v-if="chip"
    class="flex h-8 items-center rounded-full border border-accent bg-accent-soft px-3 text-[12.5px] font-semibold text-accent-ink"
  >{{ technique }}</span>
  <span v-else class="font-semibold text-accent-ink">{{ technique }}</span>
</template>
