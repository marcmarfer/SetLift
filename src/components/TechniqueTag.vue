<script setup lang="ts">
withDefaults(defineProps<{ technique: string; chip?: boolean }>(), { chip: false })
</script>

<template>
  <span
    v-if="chip"
    class="flex h-8 items-center rounded-full border border-line-btn px-3 text-[12.5px] font-medium text-muted"
  >{{ technique }}</span>
  <span v-else class="font-semibold text-accent-ink">{{ technique }}</span>
</template>
