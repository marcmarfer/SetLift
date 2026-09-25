import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { forgetSyncState, hasPendingChanges, sync } from '../lib/sync'
import { clearDevice } from '../lib/localData'
import { useSettingsStore } from './settings'

export type AuthPhase = 'anonymous' | 'returning' | 'recovery' | 'challenge' | 'ready'

const SESSION_KEY = 'setlift.session'
const RECOVERY_KEY = 'setlift.recovery'

export function rememberedUserId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function remember(userId: string) {
  try {
    localStorage.setItem(SESSION_KEY, userId)
  } catch {}
}

function forget() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {}
}

function recoveryPending(): boolean {
  try {
    return localStorage.getItem(RECOVERY_KEY) === '1'
  } catch {
    return false
  }
}

function rememberRecovery() {
  try {
    localStorage.setItem(RECOVERY_KEY, '1')
  } catch {}
}

function forgetRecovery() {
  try {
    localStorage.removeItem(RECOVERY_KEY)
  } catch {}
}

const CODES_KEY = 'setlift.recoveryCodes'

function recoveryCodesKnown(): boolean {
  try {
    return localStorage.getItem(CODES_KEY) === '1'
  } catch {
    return false
  }
}

function rememberRecoveryCodes(available: boolean) {
  try {
    localStorage.setItem(CODES_KEY, available ? '1' : '0')
  } catch {}
}

const MESSAGES: Array<[RegExp, string]> = [
  [/mfa_verification_failed|invalid totp code/i, 'Ese código no es correcto. Mira la app del autenticador y prueba con el siguiente.'],
  [/mfa_challenge_expired/i, 'El código ha caducado. Prueba con el que salga ahora.'],
  [/mfa_factor_not_found/i, 'Ese factor ya no existe. Vuelve a activar la verificación en dos pasos.'],
  [/mfa_verified_factor_exists/i, 'Ya tienes la verificación en dos pasos activada.'],
  [/too_many_enrolled_mfa_factors/i, 'Has llegado al máximo de factores. Quita uno antes de añadir otro.'],
  [/mfa_totp_enroll_not_enabled|mfa_totp_verify_not_enabled/i, 'La verificación en dos pasos no está activada en el servidor.'],
  [/mfa_recovery_codes_enroll_not_enabled|mfa_recovery_codes_verify_not_enabled/i, 'Supabase todavía no permite activar los códigos de recuperación.'],
  [/mfa_recovery_codes_locked/i, 'Demasiados intentos con códigos de recuperación. Espera un rato.'],
  [/mfa_recovery_codes_sole_factor/i, 'Los códigos de recuperación no pueden ser tu único factor.'],
  [/insufficient_aal/i, 'Antes tienes que introducir el código de la app del autenticador.'],
  [/bad_oauth_state|bad_oauth_callback/i, 'La vuelta de Google no ha cuadrado. Inténtalo otra vez.'],
  [/provider_disabled|oauth_provider_not_supported/i, 'La entrada con Google no está activada.'],
  [/provider_email_needs_verification/i, 'Google todavía no ha confirmado ese email.'],
  [/single_identity_not_deletable/i, 'No puedes quitar la única forma de entrar que te queda.'],
  [/access_denied|user denied/i, 'Has cancelado la entrada con Google.'],
  [/bad_code_verifier/i, 'Abre el enlace en el mismo navegador donde lo pediste.'],
  [/flow_state_not_found|flow_state_expired|otp_expired/i, 'Ese enlace ya no vale. Pide uno nuevo.'],
  [/same_password/i, 'La contraseña nueva tiene que ser distinta de la anterior.'],
  [/weak_password/i, 'Esa contraseña es demasiado fácil. Hazla más larga o mézclala más.'],
  [/reauthentication_needed|reauthentication_not_valid/i, 'Por seguridad, vuelve a entrar antes de cambiar la contraseña.'],
  [/invalid login credentials/i, 'Email o contraseña incorrectos.'],
  [/email not confirmed/i, 'Tienes que confirmar el email antes de entrar.'],
  [/user already registered|already been registered/i, 'Ya hay una cuenta con ese email.'],
  [/password should be at least/i, 'La contraseña es demasiado corta.'],
  [/unable to validate email|invalid email/i, 'Ese email no es válido.'],
  [/failed to fetch|network|timeout/i, 'Sin conexión. Para entrar la primera vez necesitas red.'],
  [/rate.?limit|too many requests|only request this after|for security purposes/i, 'Espera un momento antes de volver a intentarlo.'],
  [/invalid api key/i, 'La clave de Supabase no es válida. Revisa .env.local.'],
  [/error sending/i, 'No se ha podido enviar el correo a esa dirección.'],
]

function codeOf(error: unknown): string {
  if (typeof error !== 'object' || !error) return ''
  const source = error as { code?: unknown; error_code?: unknown; status?: unknown }
  return String(source.code ?? source.error_code ?? source.status ?? '')
}

function describe(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return `${codeOf(error)} ${text}`
}

function translate(error: unknown): string {
  const known = MESSAGES.find(([pattern]) => pattern.test(describe(error)))?.[1]
  if (known) return known

  const code = codeOf(error)
  return code ? `No se ha podido completar (${code}).` : 'No se ha podido completar. Inténtalo otra vez.'
}

export interface TotpEnrollment {
  factorId: string
  qrCode: string
  secret: string
}

const redirectTo = (path: string) => `${location.origin}${path}`

export const useAuthStore = defineStore('auth', () => {
  const userId = ref<string | null>(rememberedUserId())
  const email = ref<string | null>(null)
  const displayName = ref<string | null>(null)
  const photoUrl = ref<string | null>(null)
  const phase = ref<AuthPhase>('anonymous')
  const working = ref(false)
  const error = ref<string | null>(null)
  const needsReauth = ref(false)
  const pendingFactorId = ref<string | null>(null)
  const totpEnabled = ref(false)
  const recoveryCodesAvailable = ref(recoveryCodesKnown())

  const linkCode = ref<string | null>(null)
  const linkFlowId = ref<string | null>(null)
  const linkToken = ref<{ hash: string; type: 'recovery' | 'email' } | null>(null)

  function unlock(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
    const previous = rememberedUserId()
    if (previous && previous !== user.id) {
      error.value = 'Esa cuenta no es la de este dispositivo.'
      phase.value = 'anonymous'
      supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      return
    }

    userId.value = user.id
    email.value = user.email ?? null
    displayName.value = (user.user_metadata?.name as string | undefined) ?? displayName.value
    photoUrl.value =
      (user.user_metadata?.avatar_url as string | undefined) ??
      (user.user_metadata?.picture as string | undefined) ??
      photoUrl.value
    needsReauth.value = false
    pendingFactorId.value = null
    forgetRecovery()
    remember(user.id)
    phase.value = 'ready'
  }

  async function settle(session: Session | null): Promise<AuthPhase> {
    if (!session) return 'anonymous'

    userId.value = session.user.id
    email.value = session.user.email ?? null

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
      pendingFactorId.value =
        session.user.factors?.find((factor) => factor.status === 'verified')?.id ?? null
      totpEnabled.value = true
      return 'challenge'
    }

    unlock(session.user)
    return phase.value
  }

  function begin() {
    const params = new URLSearchParams(location.search)
    const strip = () => history.replaceState(null, '', location.pathname)

    if (params.has('error')) {
      strip()
      error.value = translate(params.get('error_description') ?? params.get('error'))
      phase.value = rememberedUserId() ? 'ready' : 'anonymous'
      return
    }

    const tokenHash = params.get('token_hash')
    if (tokenHash) {
      linkToken.value = {
        hash: tokenHash,
        type: params.get('type') === 'email' ? 'email' : 'recovery',
      }
      strip()
      phase.value = 'returning'
      return
    }

    const code = params.get('code')
    if (code) {
      linkCode.value = code
      linkFlowId.value = params.get('sb_flow_id')
      strip()
      phase.value = 'returning'
      return
    }

    if (recoveryPending()) {
      phase.value = 'recovery'
      return
    }

    phase.value = rememberedUserId() ? 'ready' : 'anonymous'
  }

  async function signIn(mail: string, password: string) {
    working.value = true
    error.value = null
    try {
      const { data, error: failed } = await supabase.auth.signInWithPassword({
        email: mail.trim(),
        password,
      })
      if (failed) throw failed
      phase.value = await settle(data.session)
      return phase.value !== 'anonymous'
    } catch (problem) {
      error.value = translate(problem)
      return false
    } finally {
      working.value = false
    }
  }

  async function signUp(name: string, mail: string, password: string) {
    working.value = true
    error.value = null
    try {
      const { data, error: failed } = await supabase.auth.signUp({
        email: mail.trim(),
        password,
        options: { data: { name: name.trim() } },
      })
      if (failed) throw failed

      if (!data.session) {
        error.value = 'Cuenta creada. Confirma el email y entra.'
        return false
      }

      phase.value = await settle(data.session)
      return phase.value !== 'anonymous'
    } catch (problem) {
      error.value = translate(problem)
      return false
    } finally {
      working.value = false
    }
  }

  async function signInWithGoogle() {
    working.value = true
    error.value = null
    try {
      const { error: failed } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo('/auth/callback') },
      })
      if (failed) throw failed
      return true
    } catch (problem) {
      error.value = translate(problem)
      working.value = false
      return false
    }
  }

  async function finishLink() {
    const token = linkToken.value
    const code = linkCode.value

    if (!token && !code) {
      phase.value = rememberedUserId() ? 'ready' : 'anonymous'
      return false
    }

    working.value = true
    error.value = null
    try {
      if (token) {
        const { data, error: failed } = await supabase.auth.verifyOtp({
          token_hash: token.hash,
          type: token.type,
        })
        if (failed) throw failed

        linkToken.value = null

        if (token.type === 'recovery') {
          rememberRecovery()
          userId.value = data.session?.user.id ?? null
          email.value = data.session?.user.email ?? null
          phase.value = 'recovery'
          return true
        }

        phase.value = await settle(data.session)
        return true
      }

      const { data, error: failed } = await supabase.auth.exchangeCodeForSession(
        code!,
        linkFlowId.value ? { flowId: linkFlowId.value } : undefined,
      )
      if (failed) throw failed

      const { redirectType } = data as typeof data & { redirectType: string | null }

      if (redirectType === 'recovery') {
        rememberRecovery()
        userId.value = data.session?.user.id ?? null
        email.value = data.session?.user.email ?? null
        phase.value = 'recovery'
        return true
      }

      linkCode.value = null
      linkFlowId.value = null
      phase.value = await settle(data.session)
      return true
    } catch (problem) {
      error.value = translate(problem)
      phase.value = rememberedUserId() ? 'ready' : 'anonymous'
      return false
    } finally {
      working.value = false
    }
  }

  async function requestPasswordReset(mail: string) {
    working.value = true
    error.value = null
    try {
      const { error: failed } = await supabase.auth.resetPasswordForEmail(mail.trim(), {
        redirectTo: redirectTo('/reset-password'),
      })
      if (failed) throw failed
      return true
    } catch (problem) {
      error.value = translate(problem)
      return false
    } finally {
      working.value = false
    }
  }

  async function updatePassword(next: string) {
    working.value = true
    error.value = null
    try {
      const { error: failed } = await supabase.auth.updateUser({ password: next })
      if (failed) throw failed

      forgetRecovery()
      const { data } = await supabase.auth.getSession()
      phase.value = await settle(data.session)
      return true
    } catch (problem) {
      error.value = translate(problem)
      return false
    } finally {
      working.value = false
    }
  }

  async function abandonRecovery() {
    forgetRecovery()
    phase.value = rememberedUserId() ? 'ready' : 'anonymous'
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {}
  }

  async function verifyChallenge(code: string) {
    const factorId = pendingFactorId.value
    if (!factorId) {
      error.value = 'No hay ninguna verificación pendiente.'
      return false
    }

    working.value = true
    error.value = null
    try {
      const { data, error: failed } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.trim().replace(/\s/g, ''),
      })
      if (failed) throw failed
      if (data) unlock(data.user)
      return phase.value === 'ready'
    } catch (problem) {
      error.value = translate(problem)
      return false
    } finally {
      working.value = false
    }
  }


  async function refreshFactors() {
    try {
      const { data } = await supabase.auth.mfa.listFactors()
      totpEnabled.value = (data?.totp ?? []).some((factor) => factor.status === 'verified')
    } catch {}

  }

  async function generateRecoveryCodes(): Promise<string[] | null> {
    working.value = true
    error.value = null
    try {
      const { data, error: failed } = await supabase.auth.mfa.recoveryCodes.generate()
      if (failed) throw failed
      rememberRecoveryCodes(true)
      recoveryCodesAvailable.value = true
      return data?.codes ?? null
    } catch (problem) {
      if (/not_enabled/i.test(describe(problem))) {
        rememberRecoveryCodes(false)
        recoveryCodesAvailable.value = false
      }
      error.value = translate(problem)
      return null
    } finally {
      working.value = false
    }
  }

  async function verifyRecoveryCode(code: string) {
    working.value = true
    error.value = null
    try {
      const { data, error: failed } = await supabase.auth.mfa.recoveryCodes.verify({
        code: code.trim().replace(/\s/g, ''),
      })
      if (failed) throw failed
      if (data) unlock(data.user)
      return phase.value === 'ready'
    } catch (problem) {
      error.value = translate(problem)
      return false
    } finally {
      working.value = false
    }
  }

  async function enrollTotp(): Promise<TotpEnrollment | null> {
    working.value = true
    error.value = null
    try {
      const { data: existing } = await supabase.auth.mfa.listFactors()
      for (const factor of existing?.all ?? []) {
        if (factor.status === 'unverified') {
          await supabase.auth.mfa.unenroll({ factorId: factor.id })
        }
      }

      const { data, error: failed } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `SetLift ${Date.now()}`,
      })
      if (failed) throw failed

      return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
    } catch (problem) {
      error.value = translate(problem)
      return null
    } finally {
      working.value = false
    }
  }

  async function confirmTotp(factorId: string, code: string) {
    working.value = true
    error.value = null
    try {
      const { error: failed } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.trim().replace(/\s/g, ''),
      })
      if (failed) throw failed
      totpEnabled.value = true
      return true
    } catch (problem) {
      error.value = translate(problem)
      return false
    } finally {
      working.value = false
    }
  }


  async function cancelTotp(factorId: string) {
    try {
      await supabase.auth.mfa.unenroll({ factorId })
    } catch {}
  }

  async function disableTotp() {
    working.value = true
    error.value = null
    try {
      const { data } = await supabase.auth.mfa.listFactors()
      for (const factor of data?.all ?? []) {
        const { error: failed } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
        if (failed) throw failed
      }
      totpEnabled.value = false
      return true
    } catch (problem) {
      error.value = translate(problem)
      return false
    } finally {
      working.value = false
    }
  }

  async function signOut(discardPending = false) {
    const leaving = userId.value
    error.value = null

    const settings = useSettingsStore()
    const pending = leaving && (settings.hasPendingProfile() || (await hasPendingChanges(leaving)))

    if (leaving && pending && !discardPending) {
      try {
        await sync(leaving)
        await settings.syncProfile(leaving)
      } catch (problem) {
        const code = codeOf(problem)
        error.value = navigator.onLine
          ? `No se han podido subir tus cambios${code ? ` (${code})` : ''}. Si sales ahora, se perderán.`
          : 'Tienes cambios sin subir. Conéctate antes de cerrar sesión para no perderlos.'
        return false
      }
    }

    await clearDevice()
    settings.reset()
    forget()
    forgetRecovery()
    if (leaving) forgetSyncState(leaving)
    userId.value = null
    email.value = null
    needsReauth.value = false
    pendingFactorId.value = null
    totpEnabled.value = false
    phase.value = 'anonymous'
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {}
    return true
  }

  async function restore() {
    const entered = phase.value

    if (entered !== 'returning' && entered !== 'recovery') {
      try {
        const { data } = await supabase.auth.getSession()
        if (phase.value !== entered) return

        if (data.session) {
          const settled = await settle(data.session)
          if (phase.value === entered) phase.value = settled
        } else if (rememberedUserId()) {
          needsReauth.value = true
        }
      } catch {
        if (rememberedUserId()) needsReauth.value = true
      }
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        rememberRecovery()
        userId.value = session?.user.id ?? userId.value
        email.value = session?.user.email ?? email.value
        phase.value = 'recovery'
        return
      }

      if (event === 'SIGNED_OUT') {
        if (rememberedUserId()) needsReauth.value = true
        return
      }

      if (!session || phase.value === 'recovery') return

      if (phase.value === 'ready') {
        unlock(session.user)
        return
      }

      email.value = session.user.email ?? email.value
    })
  }

  return {
    userId,
    email,
    displayName,
    photoUrl,
    phase,
    working,
    error,
    needsReauth,
    pendingFactorId,
    totpEnabled,
    recoveryCodesAvailable,
    begin,
    restore,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    finishLink,
    requestPasswordReset,
    updatePassword,
    abandonRecovery,
    verifyChallenge,
    refreshFactors,
    generateRecoveryCodes,
    verifyRecoveryCode,
    enrollTotp,
    confirmTotp,
    cancelTotp,
    disableTotp,
  }
})
