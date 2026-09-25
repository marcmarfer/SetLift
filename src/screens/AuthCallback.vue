<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import BrandMark from '../components/BrandMark.vue'

const router = useRouter()
const auth = useAuthStore()
const failed = ref(false)

async function land() {
  failed.value = false
  const ok = await auth.finishLink()

  if (!ok) {
    failed.value = true
    return
  }

  if (auth.phase === 'recovery') router.replace({ name: 'reset-password' })
  else if (auth.phase === 'challenge') router.replace({ name: 'login' })
  else router.replace({ name: 'today' })
}

onMounted(land)
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-4 px-6">
    <BrandMark :size="34" />

    <p v-if="!failed" class="text-sm text-muted">Entrando…</p>

    <template v-else>
      <p class="rounded-2xl border border-warn bg-warn-soft px-3.5 py-2.5 text-center text-[12.5px] leading-snug text-ink">
        {{ auth.error }}
      </p>
      <button
        class="flex h-13 items-center justify-center rounded-2xl bg-accent px-6 text-[15px] font-bold text-hero-ink disabled:opacity-60"
        type="button"
        :disabled="auth.working"
        @click="land"
      >Reintentar</button>
      <RouterLink to="/login" class="text-sm text-muted">Volver a entrar</RouterLink>
    </template>
  </div>
</template>
