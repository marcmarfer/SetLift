<script setup lang="ts">
import { computed, ref } from 'vue'

export interface SelectOption {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{ modelValue: string; options: SelectOption[]; triggerClass?: string }>(),
  { triggerClass: 'text-[11px] font-medium uppercase tracking-[0.08em] text-faint' },
)
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()

const open = ref(false)

const current = computed(
  () => props.options.find((option) => option.value === props.modelValue)?.label ?? '',
)

function pick(value: string) {
  emit('update:modelValue', value)
  open.value = false
}
</script>

<template>
  <div class="relative flex">
    <button
      class="flex items-center gap-1"
      :class="triggerClass"
      type="button"
      :aria-expanded="open"
      @click="open = !open"
    >
      {{ current }}
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-icon transition-transform duration-300 ease-out motion-reduce:transition-none"
        :class="open ? 'rotate-180' : ''"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <template v-if="open">
      <div class="fixed inset-0 z-20" @click="open = false" />
      <div
        class="absolute top-full left-0 z-30 mt-2 flex max-h-64 min-w-40 flex-col gap-0.5 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-card"
        role="listbox"
      >
        <button
          v-for="option in options"
          :key="option.value"
          class="flex h-10 shrink-0 items-center rounded-xl px-3 text-left text-[13px] capitalize transition-colors"
          :class="option.value === modelValue ? 'bg-accent-soft font-semibold text-accent-ink' : 'font-medium text-muted'"
          type="button"
          role="option"
          :aria-selected="option.value === modelValue"
          @click="pick(option.value)"
        >{{ option.label }}</button>
      </div>
    </template>
  </div>
</template>
