<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useSettingsStore } from '../stores/settings'
import BrandMark from '../components/BrandMark.vue'

const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()

const name = ref('')
const email = ref('')
const password = ref('')
const reveal = ref(false)

async function create() {
  if (!(await auth.signUp(name.value, email.value, password.value))) return
  if (name.value.trim()) settings.name = name.value.trim()
  router.replace('/')
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <header class="flex items-center px-4 py-2.5">
      <button class="-ml-2.5 flex h-11 w-11 items-center justify-center text-muted" type="button" @click="router.back()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
    </header>

    <div class="flex flex-col gap-2 px-5 pt-3">
      <BrandMark :size="26" />
      <h1 class="pt-2 text-[30px] font-bold leading-tight tracking-[-0.025em]">Crea tu cuenta</h1>
      <p class="text-sm leading-relaxed text-muted">Solo hace falta para guardar el historial y sincronizarlo.</p>
    </div>

    <div class="flex-grow" />

    <div class="flex flex-col gap-2.5 px-5 pb-6">
      <label class="flex flex-col gap-1.5">
        <span class="text-[11.5px] font-medium tracking-[0.04em] text-faint">Nombre</span>
        <input
          v-model="name"
          class="h-14 rounded-2xl border border-line-btn bg-app px-4 text-[15px] outline-none focus:border-accent"
          type="text"
        />
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-[11.5px] font-medium tracking-[0.04em] text-faint">Email</span>
        <input
          v-model="email"
          class="h-14 rounded-2xl border border-line-btn bg-app px-4 text-[15px] outline-none focus:border-accent"
          type="email"
        />
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-[11.5px] font-medium tracking-[0.04em] text-faint">Contraseña</span>
        <div class="flex h-14 items-center gap-2.5 rounded-2xl border border-line-btn bg-app pl-4 pr-2 focus-within:border-accent">
          <input
            v-model="password"
            class="num h-full flex-grow bg-transparent text-[15px] tracking-[0.16em] outline-none"
            :type="reveal ? 'text' : 'password'"
            placeholder="••••••••"
          />
          <button
            class="flex h-11 w-11 items-center justify-center rounded-xl text-dim"
            type="button"
            :aria-label="reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            @click="reveal = !reveal"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
        <span class="text-[11.5px] text-faint">Mínimo 8 caracteres</span>
      </label>

      <p v-if="auth.error" class="rounded-2xl border border-warn bg-warn-soft px-3.5 py-2.5 text-[12.5px] leading-snug text-ink">
        {{ auth.error }}
      </p>

      <button
        class="mt-1 flex h-14 items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink disabled:opacity-60"
        type="button"
        :disabled="auth.working"
        @click="create"
      >{{ auth.working ? 'Creando…' : 'Crear cuenta' }}</button>

      <p class="px-2 text-center text-[11.5px] leading-relaxed text-faint">
        Al crear la cuenta aceptas los términos y la política de privacidad.
      </p>
    </div>
  </div>
</template>
