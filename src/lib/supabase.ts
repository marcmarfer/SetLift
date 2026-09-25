import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local')
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storageKey: 'setlift.auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    experimental: {
      recoveryCodes: true,
      appendPkceFlowIdToRedirects: true,
    },
  },
})
