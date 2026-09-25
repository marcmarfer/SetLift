<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore, type TotpEnrollment } from '../stores/auth'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const router = useRouter()
const auth = useAuthStore()

const enrolling = ref<TotpEnrollment | null>(null)
const code = ref('')
const codes = ref<string[] | null>(null)
const turningOff = ref(false)

onMounted(() => auth.refreshFactors())

async function start() {
  code.value = ''
  enrolling.value = await auth.enrollTotp()
}

async function confirm() {
  const pending = enrolling.value
  if (!pending) return
  if (!(await auth.confirmTotp(pending.factorId, code.value))) return

  enrolling.value = null
}

async function cancel() {
  const pending = enrolling.value
  enrolling.value = null
  if (pending) await auth.cancelTotp(pending.factorId)
}

async function renew() {
  codes.value = await auth.generateRecoveryCodes()
}

async function turnOff() {
  turningOff.value = false
  if (await auth.disableTotp()) codes.value = null
}

onBeforeUnmount(cancel)
</script>

<template>
  <div class="relative flex h-full flex-col overflow-hidden">
    <header class="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
      <button class="-ml-2.5 flex h-11 w-11 items-center justify-center text-muted" type="button" @click="router.back()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <h1 class="flex-grow text-lg font-bold tracking-[-0.01em]">Verificación en dos pasos</h1>
    </header>

    <div class="flex flex-grow flex-col gap-3.5 overflow-y-auto px-4 py-4">
      <p v-if="auth.error" class="rounded-2xl border border-warn bg-warn-soft px-3.5 py-2.5 text-[12.5px] leading-snug text-ink">
        {{ auth.error }}
      </p>

      <div v-if="codes" class="flex flex-col gap-2.5 rounded-[20px] border border-accent-line bg-accent-soft p-4">
        <span class="text-[15px] font-bold text-accent-ink">Guárdalos ahora</span>
        <p class="text-[12.5px] leading-relaxed text-accent-ink">No se vuelven a enseñar.</p>
        <div class="num grid grid-cols-2 gap-1.5 rounded-2xl bg-surface p-3 text-[13px] font-semibold">
          <span v-for="entry in codes" :key="entry">{{ entry }}</span>
        </div>
        <button class="flex h-12 items-center justify-center rounded-2xl bg-accent text-sm font-bold text-hero-ink" type="button" @click="codes = null">
          Ya los tengo
        </button>
      </div>

      <template v-else-if="enrolling">
        <div class="flex flex-col items-center gap-3 rounded-[20px] border border-line bg-surface p-4 shadow-card">
          <p class="text-center text-[13px] leading-relaxed text-muted">
            Escanea el código con Google Authenticator, 1Password o la que uses.
          </p>
          <img :src="enrolling.qrCode" alt="Código QR de verificación" class="h-48 w-48 rounded-2xl bg-white p-2" />
          <div class="flex w-full flex-col gap-1.5 rounded-2xl bg-surface-2 p-3">
            <span class="text-[11.5px] font-medium tracking-[0.04em] text-faint">O escribe esta clave a mano</span>
            <span class="num text-[13px] font-semibold break-all">{{ enrolling.secret }}</span>
            <span class="text-[11.5px] leading-relaxed text-faint">Guárdala en tu gestor: sirve para dar de alta otra app.</span>
          </div>
        </div>

        <label class="flex flex-col gap-1.5">
          <span class="text-[11.5px] font-medium tracking-[0.04em] text-faint">Código de 6 dígitos</span>
          <input
            v-model="code"
            class="num h-16 rounded-2xl border border-line-btn bg-app px-4 text-center text-[26px] font-bold tracking-[0.3em] outline-none focus:border-accent"
            inputmode="numeric"
            placeholder="000000"
            @keyup.enter="confirm"
          />
        </label>

        <button
          class="flex h-14 items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink disabled:opacity-60"
          type="button"
          :disabled="auth.working || !code.trim()"
          @click="confirm"
        >{{ auth.working ? 'Comprobando…' : 'Activar' }}</button>

        <button class="flex h-13 items-center justify-center text-sm text-muted" type="button" @click="cancel">Cancelar</button>
      </template>

      <template v-else-if="auth.totpEnabled">
        <div class="flex items-center gap-3 rounded-[20px] border border-ok-line bg-ok-soft px-4 py-3.5">
          <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-ok text-ok-ink">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
          </span>
          <span class="flex-grow text-[15px] font-semibold">Activada</span>
        </div>

        <button
          class="flex h-14 items-center gap-2.5 rounded-2xl border border-line-btn bg-surface-2 px-3.5 disabled:opacity-50"
          type="button"
          :disabled="auth.working"
          @click="renew"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4h-4" /></svg>
          <span class="flex-grow text-left text-[15px] font-semibold">Códigos de recuperación</span>
        </button>

        <p v-if="!auth.recoveryCodesAvailable" class="px-1 text-[11.5px] leading-relaxed text-faint">
          Supabase todavía no los deja activar. Puedes probar: el día que los abran, este botón
          funcionará solo. Mientras tanto, escanea el QR en una segunda app como respaldo.
        </p>
        <p v-else class="px-1 text-[11.5px] text-faint">Los anteriores dejarán de valer.</p>

        <button
          class="flex h-14 items-center gap-2.5 rounded-2xl border border-line-btn bg-surface-2 px-3.5 text-danger"
          type="button"
          @click="turningOff = true"
        >
          <span class="flex-grow text-left text-[15px] font-semibold">Desactivarla</span>
        </button>
      </template>

      <template v-else>
        <p class="px-1 text-[13px] leading-relaxed text-muted">
          Añade un segundo paso al entrar: además de la contraseña, un código que cambia cada 30
          segundos en tu móvil.
        </p>

        <button
          class="flex h-14 items-center justify-center rounded-2xl bg-accent text-base font-bold text-hero-ink disabled:opacity-60"
          type="button"
          :disabled="auth.working"
          @click="start"
        >{{ auth.working ? 'Preparando…' : 'Activar' }}</button>
      </template>
    </div>

    <ConfirmDialog
      v-if="turningOff"
      title="Desactivar la verificación"
      message="Dejará de pedirte el código al entrar desde un dispositivo nuevo."
      label="Desactivar"
      @confirm="turnOff"
      @close="turningOff = false"
    />
  </div>
</template>
