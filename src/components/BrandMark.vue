<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 30 })
</script>

<template>
  <div class="flex items-center gap-2.5">
    <span class="flex text-accent">
      <svg
        :width="size"
        :height="size"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="4.2" r="2" />
        <path d="M9.2 7.8h5.6" />
        <path d="M12 6.2v4" />
        <path d="M9.2 7.8 8.6 16" />
        <path d="M14.8 7.8 15.4 16" />
        <path d="M12 10.2 10.2 13.4 10.4 17.9" />
        <path d="M12 10.2 13.8 13.4 13.6 17.9" />
        <path d="M4 16h16" />
        <path d="M6.5 13.4v5.2M17.5 13.4v5.2" />
      </svg>
    </span>
    <span class="text-xl font-bold tracking-[-0.02em]">Set<span class="text-accent">Lift</span></span>
  </div>
</template>
