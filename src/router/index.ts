import { createRouter, createWebHistory } from 'vue-router'
import Today from '../screens/Today.vue'
import { useAuthStore } from '../stores/auth'
import { useSettingsStore } from '../stores/settings'

export const TAB_PATHS = ['/', '/routines', '/history', '/progress']

declare module 'vue-router' {
  interface RouteMeta {
    access?: 'guest' | 'any'
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'today', component: Today },
    { path: '/routines', name: 'routines', component: () => import('../screens/Routines.vue') },
    { path: '/routines/:id', name: 'routine-editor', component: () => import('../screens/RoutineEditor.vue') },
    { path: '/plans', name: 'plans', component: () => import('../screens/Plans.vue') },
    { path: '/plans/:id', name: 'plan-editor', component: () => import('../screens/PlanEditor.vue') },
    { path: '/history', name: 'history', component: () => import('../screens/History.vue') },
    { path: '/progress', name: 'progress', component: () => import('../screens/Progress.vue') },
    { path: '/progress/:id', name: 'progress-detail', component: () => import('../screens/ProgressDetail.vue') },
    { path: '/workout/:id', name: 'workout', component: () => import('../screens/Workout.vue') },
    {
      path: '/workout/:id/view',
      name: 'workout-view',
      component: () => import('../screens/Workout.vue'),
      props: { readonly: true },
    },
    { path: '/workout/:id/summary', name: 'summary', component: () => import('../screens/Summary.vue') },
    { path: '/account', name: 'account', component: () => import('../screens/Account.vue') },
    { path: '/account/edit', name: 'edit-profile', component: () => import('../screens/EditProfile.vue') },
    { path: '/account/two-factor', name: 'two-factor', component: () => import('../screens/TwoFactor.vue') },
    { path: '/welcome', name: 'welcome', component: () => import('../screens/Welcome.vue') },
    { path: '/login', name: 'login', component: () => import('../screens/Login.vue'), meta: { access: 'guest' } },
    { path: '/signup', name: 'signup', component: () => import('../screens/SignUp.vue'), meta: { access: 'guest' } },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('../screens/ForgotPassword.vue'),
      meta: { access: 'guest' },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('../screens/ResetPassword.vue'),
      meta: { access: 'any' },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('../screens/AuthCallback.vue'),
      meta: { access: 'any' },
    },
    { path: '/:rest(.*)', name: 'not-found', redirect: { name: 'today' } },
  ],
})

router.beforeEach(async (to, from) => {
  const auth = useAuthStore()

  if (auth.phase === 'returning') {
    return to.name === 'auth-callback' ? true : { name: 'auth-callback' }
  }

  if (to.meta.access === 'any') return true
  if (auth.phase === 'recovery') return { name: 'reset-password' }
  if (auth.phase === 'challenge') return to.name === 'login' ? true : { name: 'login' }
  if (auth.phase === 'ready') {
    const settings = useSettingsStore()
    if (from.name === 'welcome' && to.name !== 'welcome' && !settings.onboarded) return false
    if (to.meta.access === 'guest') return { name: 'today' }

    const pendingWelcome =
      to.name !== 'welcome' &&
      !settings.onboarded &&
      auth.userId !== null &&
      (await settings.ensureProfile(auth.userId)) &&
      !settings.onboarded

    return pendingWelcome ? { name: 'welcome' } : true
  }

  return to.meta.access === 'guest' ? true : { name: 'login' }
})
