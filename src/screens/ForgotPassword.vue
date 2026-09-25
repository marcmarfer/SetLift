<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import BrandMark from '../components/BrandMark.vue'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const sent = ref(false)

async function send() {
  if (await auth.requestPasswordReset(email.value)) sent.value = true
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <header class="flex items-center px-4 py-2.5">
      <button class="-ml-2.5 flex h-11 w-11 items-center justify-center text-muted" type="button" @click="router.back()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
    </header>

    <div class="flex flex-col gap-2.5 px-5 pt-3">
      <BrandMark :size="26" />
      <h1 class="pt-2 text-[30px] font-bold leading-tight tracking-[-0.025em]">Recuperar la cuenta</h1>
      <p class="text-sm leading-relaxed text-muted">
        Te mandamos un enlace para poner una contraseña nueva.
      </p>
    </div>

    <div class="flex-grow" />

    <div class="flex flex-col gap-2.5 px-5 pb-7">
      <template v-if="sent">
        <p class="rounded-2xl border border-ok-line bg-ok-soft px-3.5 py-3 text-[13px] leading-relaxed text-ink">
          Te hemos enviado un enlace. Revisa tu bandeja de entrada.
        </p>
        <RouterLink
          to="/login"
          class="flex h-14 items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink"
        >Volver a entrar</RouterLink>
      </template>

      <template v-else>
        <label class="flex flex-col gap-1.5">
          <span class="text-[11.5px] font-medium tracking-[0.04em] text-faint">Email</span>
          <input
            v-model="email"
            class="h-14 rounded-2xl border border-line-btn bg-app px-4 text-[15px] outline-none focus:border-accent"
            type="email"
          />
        </label>

        <p v-if="auth.error" class="rounded-2xl border border-warn bg-warn-soft px-3.5 py-2.5 text-[12.5px] leading-snug text-ink">
          {{ auth.error }}
        </p>

        <button
          class="flex h-14 items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink disabled:opacity-60"
          type="button"
          :disabled="auth.working || !email.trim()"
          @click="send"
        >{{ auth.working ? 'Enviando…' : 'Enviar enlace' }}</button>
      </template>
    </div>
  </div>
</template>
