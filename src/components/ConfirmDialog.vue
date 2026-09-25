<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    message: string
    label: string
    tone?: 'danger' | 'accent'
  }>(),
  { tone: 'danger' },
)

const emit = defineEmits<{
  (event: 'confirm'): void
  (event: 'close'): void
}>()
</script>

<template>
  <div class="absolute inset-0 z-30 flex items-center justify-center bg-black/45 px-6" @click.self="emit('close')">
    <div class="flex w-full flex-col gap-3 rounded-[26px] border border-line bg-surface p-5 shadow-card">
      <h2 class="text-lg font-bold tracking-[-0.01em]">{{ title }}</h2>
      <p class="text-[13.5px] leading-[1.55] text-muted">{{ message }}</p>

      <div class="mt-1 flex flex-col gap-2">
        <button
          class="flex h-13 items-center justify-center rounded-2xl text-sm font-bold text-hero-ink"
          :class="tone === 'accent' ? 'bg-accent' : 'bg-danger'"
          type="button"
          @click="emit('confirm')"
        >{{ label }}</button>
        <button
          class="flex h-13 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 text-sm font-semibold text-muted"
          type="button"
          @click="emit('close')"
        >Cancelar</button>
      </div>
    </div>
  </div>
</template>
