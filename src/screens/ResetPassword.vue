<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import BrandMark from '../components/BrandMark.vue'

const router = useRouter()
const auth = useAuthStore()

const password = ref('')
const reveal = ref(false)
const done = ref(false)

async function save() {
  if (await auth.updatePassword(password.value)) {
    done.value = true
    router.replace(auth.phase === 'challenge' ? { name: 'login' } : { name: 'today' })
  }
}

async function giveUp() {
  await auth.abandonRecovery()
  router.replace({ name: 'login' })
}

onBeforeUnmount(() => {
  if (!done.value && auth.phase === 'recovery') auth.abandonRecovery()
})
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex flex-col gap-2.5 px-5 pt-14">
      <BrandMark :size="34" />
      <h1 class="pt-3.5 text-[30px] font-bold leading-tight tracking-[-0.025em]">Nueva contraseña</h1>
      <p class="text-sm leading-relaxed text-muted">Elige una y la guardas en tu gestor.</p>
    </div>

    <div class="flex-grow" />

    <div class="flex flex-col gap-2.5 px-5 pb-7">
      <label class="flex flex-col gap-1.5">
        <span class="text-[11.5px] font-medium tracking-[0.04em] text-faint">Contraseña</span>
        <div class="flex h-14 items-center gap-2.5 rounded-2xl border border-line-btn bg-app pl-4 pr-2 focus-within:border-accent">
          <input
            v-model="password"
            class="num h-full flex-grow bg-transparent text-[15px] tracking-[0.16em] outline-none"
            :type="reveal ? 'text' : 'password'"
            placeholder="••••••••"
          />
          <button class="flex h-11 w-11 items-center justify-center rounded-xl text-dim" type="button" :aria-label="reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="reveal = !reveal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </label>

      <p v-if="auth.error" class="rounded-2xl border border-warn bg-warn-soft px-3.5 py-2.5 text-[12.5px] leading-snug text-ink">
        {{ auth.error }}
      </p>

      <button
        class="flex h-14 items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink disabled:opacity-60"
        type="button"
        :disabled="auth.working || !password"
        @click="save"
      >{{ auth.working ? 'Guardando…' : 'Guardar y entrar' }}</button>

      <button class="flex h-13 items-center justify-center text-sm text-muted" type="button" @click="giveUp">
        Dejarlo y volver a entrar
      </button>
    </div>
  </div>
</template>
