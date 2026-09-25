<script setup lang="ts">
import { ref } from 'vue'
import Avatar from './Avatar.vue'
import { squareAvatar } from '../lib/avatar'

defineProps<{ modelValue: string; initials: string }>()

const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()

const input = ref<HTMLInputElement | null>(null)
const failed = ref(false)

async function choose(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (input.value) input.value.value = ''
  if (!file) return

  failed.value = false
  try {
    emit('update:modelValue', await squareAvatar(file))
  } catch {
    failed.value = true
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <button class="relative rounded-full" type="button" aria-label="Cambiar foto" @click="input?.click()">
      <Avatar :src="modelValue" :initials="initials" class="h-22 w-22 text-[28px]" />
      <span class="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-app bg-accent text-hero-ink">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
      </span>
    </button>

    <input ref="input" type="file" accept="image/*" class="hidden" @change="choose" />

    <button
      v-if="modelValue"
      class="h-9 text-[12.5px] font-medium text-muted"
      type="button"
      @click="emit('update:modelValue', '')"
    >Quitar foto</button>

    <span v-if="failed" class="text-[12px] text-danger">No se ha podido abrir esa imagen.</span>
  </div>
</template>
