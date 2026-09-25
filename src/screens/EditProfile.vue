<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settings'

const router = useRouter()
const settings = useSettingsStore()

const name = ref(settings.name)
const bodyweight = ref(String(settings.bodyweightKg).replace('.', ','))

function save() {
  settings.name = name.value.trim() || settings.name
  const weight = Number(bodyweight.value.replace(',', '.'))
  if (Number.isFinite(weight) && weight > 0) settings.bodyweightKg = weight
  router.back()
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <header class="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
      <button class="h-11 text-sm text-muted" type="button" @click="router.back()">Cancelar</button>
      <h1 class="flex-grow text-center text-base font-bold">Editar perfil</h1>
      <button class="h-11 rounded-2xl bg-accent px-3.5 text-sm font-bold text-hero-ink" type="button" @click="save">
        Guardar
      </button>
    </header>

    <div class="flex flex-grow flex-col gap-3.5 overflow-y-auto px-4 py-4.5">
      <div class="flex flex-col items-center gap-2.5">
        <span class="num flex h-22 w-22 items-center justify-center rounded-full border border-accent-line bg-accent-soft text-[28px] font-bold text-accent">
          {{ settings.initials() }}
        </span>
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="text-[11.5px] font-medium tracking-[0.04em] text-faint">Nombre</span>
        <input
          v-model="name"
          class="h-14 rounded-2xl border border-line-btn bg-app px-4 text-[15px] outline-none focus:border-accent"
          type="text"
        />
      </label>


      <label class="flex flex-col gap-1.5">
        <span class="text-[11.5px] font-medium tracking-[0.04em] text-faint">Peso corporal</span>
        <div class="flex h-14 items-center gap-2 rounded-2xl border border-line-btn bg-app px-4 focus-within:border-accent">
          <input
            v-model="bodyweight"
            class="num h-full flex-grow bg-transparent text-[15px] outline-none"
            inputmode="decimal"
            type="text"
          />
          <span class="num text-[13px] text-dim">kg</span>
        </div>
        <span class="text-[11.5px] text-faint">Se usa para los ejercicios a peso corporal, como las dominadas.</span>
      </label>
    </div>
  </div>
</template>
