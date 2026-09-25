<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import BrandMark from '../components/BrandMark.vue'

const router = useRouter()
const auth = useAuthStore()

const email = ref(auth.email ?? '')
const password = ref('')
const reveal = ref(false)

const code = ref('')
const usingRecovery = ref(false)

async function enter() {
  if (!(await auth.signIn(email.value, password.value))) return
  if (auth.phase === 'ready') router.replace('/')
}

async function confirm() {
  const ok = usingRecovery.value
    ? await auth.verifyRecoveryCode(code.value)
    : await auth.verifyChallenge(code.value)
  if (ok) router.replace('/')
}

async function useAnotherAccount() {
  await auth.signOut()
  code.value = ''
  password.value = ''
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex flex-col gap-2.5 px-5 pt-14">
      <BrandMark :size="34" />
      <h1 class="pt-3.5 text-[30px] font-bold leading-tight tracking-[-0.025em]">
        {{ auth.phase === 'challenge' ? 'Verifica que eres tú' : 'Entra a tu cuenta' }}
      </h1>
      <p class="text-sm leading-relaxed text-muted">
        {{ auth.phase === 'challenge'
          ? 'Abre tu app de autenticación y escribe el código de 6 dígitos.'
          : 'Tus rutinas y tu progreso, en cualquier móvil.' }}
      </p>
    </div>

    <div class="flex-grow" />

    <div v-if="auth.phase === 'challenge'" class="flex flex-col gap-2.5 px-5 pb-7">
      <label class="flex flex-col gap-1.5">
        <span class="text-[11.5px] font-medium tracking-[0.04em] text-faint">{{ usingRecovery ? 'Código de recuperación' : 'Código' }}</span>
        <input
          v-model="code"
          class="num h-16 rounded-2xl border border-line-btn bg-app px-4 text-center text-[26px] font-bold tracking-[0.3em] outline-none focus:border-accent"
          inputmode="numeric"
          autocomplete="one-time-code"
          :placeholder="usingRecovery ? '' : '000000'"
          @keyup.enter="confirm"
        />
      </label>

      <p v-if="auth.error" class="rounded-2xl border border-warn bg-warn-soft px-3.5 py-2.5 text-[12.5px] leading-snug text-ink">
        {{ auth.error }}
      </p>

      <button
        class="flex h-14 items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink disabled:opacity-60"
        type="button"
        :disabled="auth.working || !code.trim()"
        @click="confirm"
      >{{ auth.working ? 'Comprobando…' : 'Confirmar' }}</button>

      <button
        v-if="auth.recoveryCodesAvailable"
        class="flex h-13 items-center justify-center text-sm text-muted"
        type="button"
        @click="usingRecovery = !usingRecovery; code = ''"
      >{{ usingRecovery ? 'Usar la app de autenticación' : '¿No tienes el móvil? Usa un código de recuperación' }}</button>


      <button class="flex h-13 items-center justify-center text-sm text-muted" type="button" @click="useAnotherAccount">
        Entrar con otra cuenta
      </button>
    </div>

    <div v-else class="flex flex-col gap-2.5 px-5 pb-7">
      <button
        class="flex h-14 items-center justify-center gap-2.5 rounded-2xl border border-line-btn bg-surface-2 text-[15px] font-medium disabled:opacity-60"
        type="button"
        :disabled="auth.working"
        @click="auth.signInWithGoogle()"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z" />
          <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3a11.5 11.5 0 0 0 10.2 6.3z" />
          <path fill="#FBBC05" d="M5.6 14.7a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3z" />
          <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 7.3l3.8 3c.9-2.7 3.4-4.7 6.4-4.7z" />
        </svg>
        Continuar con Google
      </button>

      <div class="flex items-center gap-3 py-2">
        <span class="h-px flex-grow bg-line" />
        <span class="text-xs text-faint">o</span>
        <span class="h-px flex-grow bg-line" />
      </div>

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
            @keyup.enter="enter"
          />
          <button class="flex h-11 w-11 items-center justify-center rounded-xl text-dim" type="button" :aria-label="reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="reveal = !reveal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </label>

      <div class="flex justify-end">
        <RouterLink to="/forgot-password" class="flex h-11 items-center text-[13px] text-muted">
          ¿Olvidaste la contraseña?
        </RouterLink>
      </div>

      <p v-if="auth.error" class="rounded-2xl border border-warn bg-warn-soft px-3.5 py-2.5 text-[12.5px] leading-snug text-ink">
        {{ auth.error }}
      </p>

      <button
        class="flex h-14 items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink disabled:opacity-60"
        type="button"
        :disabled="auth.working"
        @click="enter"
      >{{ auth.working ? 'Entrando…' : 'Entrar' }}</button>

      <RouterLink to="/signup" class="flex h-13 items-center justify-center gap-1.5 text-sm text-muted">
        ¿No tienes cuenta? <span class="font-semibold text-accent">Crear una</span>
      </RouterLink>
    </div>
  </div>
</template>
