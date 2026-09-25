<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { initialsOf, useSettingsStore } from '../stores/settings'
import AvatarPicker from '../components/AvatarPicker.vue'

const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()

const name = ref(settings.name || auth.displayName || '')
const avatar = ref(settings.avatar || auth.photoUrl || '')
const bodyweight = ref(String(settings.bodyweightKg).replace('.', ','))

const initials = computed(() => initialsOf(name.value))

function start() {
  if (name.value.trim()) settings.name = name.value.trim()
  settings.avatar = avatar.value
  const weight = Number(bodyweight.value.replace(',', '.'))
  if (Number.isFinite(weight) && weight > 0) settings.bodyweightKg = weight
  settings.onboarded = true
  router.replace({ name: 'today' })
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex flex-col gap-2 px-5 pt-10">
      <h1 class="text-[30px] font-bold leading-tight tracking-[-0.025em]">Configura tu perfil</h1>
      <p class="text-sm leading-relaxed text-muted">Solo esto y a entrenar.</p>
    </div>

    <div class="flex flex-grow flex-col justify-center gap-3.5 overflow-y-auto px-5 py-6">
      <AvatarPicker v-model="avatar" :initials="initials" />

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

    <div class="px-5 pb-7">
      <button
        class="flex h-14 w-full items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink"
        type="button"
        @click="start"
      >Empezar</button>
    </div>
  </div>
</template>
