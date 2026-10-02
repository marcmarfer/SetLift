<script setup lang="ts">
defineProps<{ kicker: string; title: string }>()
</script>

<template>
  <section class="flex h-full w-full shrink-0 snap-start snap-always flex-col">
    <div class="flex min-h-0 flex-grow flex-col overflow-hidden rounded-b-[32px] bg-app pt-12" aria-hidden="true">
      <div class="relative min-h-0 flex-grow overflow-hidden">
        <div class="pointer-events-none flex select-none flex-col gap-3.5 px-4 pt-1">
          <slot name="mockup" />
        </div>
        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-app to-transparent" />
      </div>
      <div class="pointer-events-none shrink-0 select-none">
        <slot name="dock" />
      </div>
    </div>
    <div class="flex min-h-[9.5rem] shrink-0 flex-col gap-2 px-6 pt-5 [@media(max-height:600px)]:min-h-0 [@media(max-height:600px)]:gap-1.5 [@media(max-height:600px)]:pt-3.5">
      <span class="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">{{ kicker }}</span>
      <h2 class="text-[26px] font-bold leading-tight tracking-[-0.02em] [@media(max-height:600px)]:text-[22px]">{{ title }}</h2>
      <p class="text-sm leading-relaxed text-muted"><slot /></p>
    </div>
  </section>
</template>
