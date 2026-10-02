<script setup lang="ts">
import { ref } from 'vue'
import TourStep from './TourStep.vue'

const touched = ref(false)
const done = ref(false)

function toggle() {
  touched.value = true
  done.value = !done.value
}
</script>

<template>
  <TourStep kicker="Las series" title="Un toque por serie">
    <template v-if="done">
      Apuntada. Todo lo que marques queda sin guardar hasta que pulses <span class="font-semibold text-ink">Confirmar cambios</span>, también sin cobertura.
    </template>
    <template v-else-if="touched">
      Desmarcada. Nada se guarda hasta que pulses <span class="font-semibold text-ink">Confirmar cambios</span>.
    </template>
    <template v-else>
      Al acabar una serie, toca ✓: se apunta con el peso puesto y el mínimo de reps. ¿Hiciste más? Toca Reps y cámbialas.<span aria-hidden="true"> Pruébalo arriba.</span><span class="sr-only"> Al terminar, Confirmar cambios guarda la hoja.</span>
    </template>
    <template #mockup>
      <div class="flex flex-col rounded-[20px] border border-line bg-surface shadow-card">
        <div class="flex items-start gap-1 px-3 pt-3">
          <div class="flex flex-grow flex-col gap-1.5 pt-1">
            <span class="text-[17px] font-bold leading-tight tracking-[-0.01em]">Remo con barra</span>
            <span class="num text-[13px] text-dim">{{ done ? 1 : 0 }}/3</span>
          </div>
          <span class="flex h-10 w-10 items-center justify-center rounded-xl text-muted">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
          </span>
          <span class="flex h-9 w-9 items-center justify-center rounded-xl border border-line-btn text-danger">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" /></svg>
          </span>
          <span class="flex h-10 w-10 items-center justify-center rounded-xl text-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
          </span>
        </div>

        <div class="flex flex-col gap-2.5 px-3 pb-3 pt-2.5">
          <div
            class="grid gap-1.5 pl-3.5 pr-2 text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint"
            style="grid-template-columns: 46px 1fr 58px 58px 56px"
          >
            <span>Serie</span><span>Anterior</span><span class="text-center">kg</span><span class="text-center">Reps</span><span class="text-center">✓</span>
          </div>

          <div
            class="grid items-center gap-1.5 rounded-2xl border pl-3.5 pr-2"
            :class="done ? 'border-ok-line bg-ok-soft' : 'border-accent bg-surface'"
            style="grid-template-columns: 46px 1fr 58px 58px 56px; min-height: 60px"
          >
            <div class="flex flex-col gap-px py-2">
              <span class="num text-[15px] font-semibold">1</span>
              <span class="num text-[10px] leading-tight text-dim">8–12</span>
              <span class="num text-[10px] font-semibold leading-tight text-accent-ink">@8</span>
            </div>
            <span class="num text-[13px] text-sub">60 × 11</span>
            <span class="num flex h-11 flex-col items-center justify-center rounded-xl border border-inherit bg-surface">
              <span class="text-[17px] font-semibold leading-tight">60</span>
            </span>
            <span
              class="num flex h-11 flex-col items-center justify-center rounded-xl border"
              :class="done ? 'border-transparent bg-transparent' : 'border-line-btn bg-app'"
            >
              <span class="max-w-full truncate px-1.5 font-semibold" :class="touched ? 'text-[17px]' : 'text-[14px] text-dim'">{{ touched ? 8 : '8–12' }}</span>
            </span>
            <button class="pointer-events-auto flex h-14 w-14 items-center justify-center" type="button" tabindex="-1" @click="toggle">
              <span
                class="flex h-9 w-9 items-center justify-center rounded-xl transition-colors motion-reduce:transition-none"
                :class="done ? 'bg-ok text-ok-ink' : 'border border-line-btn bg-surface-2 text-icon'"
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
              </span>
            </button>
          </div>

          <div
            v-for="(row, position) in [
              { number: 2, effort: '@8', previous: '60 × 10' },
              { number: 3, effort: '@9', previous: '60 × 10' },
            ]"
            :key="row.number"
            class="grid items-center gap-1.5 rounded-2xl border pl-3.5 pr-2"
            :class="done && position === 0 ? 'border-accent bg-surface' : 'border-line bg-surface'"
            style="grid-template-columns: 46px 1fr 58px 58px 56px; min-height: 60px"
          >
            <div class="flex flex-col gap-px py-2">
              <span class="num text-[15px] font-semibold">{{ row.number }}</span>
              <span class="num text-[10px] leading-tight text-dim">8–12</span>
              <span class="num text-[10px] font-semibold leading-tight text-accent-ink">{{ row.effort }}</span>
            </div>
            <span class="num text-[13px] text-sub">{{ row.previous }}</span>
            <span class="num flex h-11 flex-col items-center justify-center rounded-xl border border-inherit bg-surface">
              <span class="text-[17px] font-semibold leading-tight">60</span>
            </span>
            <span class="num flex h-11 flex-col items-center justify-center rounded-xl border border-line-btn bg-app">
              <span class="max-w-full truncate px-1.5 text-[14px] font-semibold text-dim">8–12</span>
            </span>
            <span class="flex h-14 w-14 items-center justify-center">
              <span class="flex h-9 w-9 items-center justify-center rounded-xl border border-line-btn bg-surface-2 text-icon">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
              </span>
            </span>
          </div>
        </div>
      </div>
    </template>
    <template #dock>
      <div v-if="touched" class="flex items-center gap-2 border-t border-line bg-surface px-4 pb-4 pt-3">
        <span class="flex h-14 flex-grow items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink">Confirmar cambios</span>
        <span class="flex h-14 items-center justify-center rounded-2xl border border-line-btn bg-surface-2 px-4 text-sm font-semibold text-muted">Descartar</span>
      </div>
    </template>
  </TourStep>
</template>
