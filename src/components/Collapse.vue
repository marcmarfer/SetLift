<script setup lang="ts">
import { ref, toRef } from 'vue'
import { useCollapse } from '../composables/useCollapse'

const props = withDefaults(defineProps<{ open: boolean; panelId?: string; labelledBy?: string }>(), {
  panelId: undefined,
  labelledBy: undefined,
})

const panel = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)

useCollapse(toRef(props, 'open'), panel, content)
</script>

<template>
  <div :id="panelId" ref="panel" role="region" :aria-labelledby="labelledBy">
    <div ref="content" :inert="!open || undefined">
      <slot />
    </div>
  </div>
</template>
