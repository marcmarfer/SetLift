import { supabase } from './supabase'

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workouts`

export const shareUrl = (token: string) => `${ENDPOINT}?token=${token}`

export async function currentShareToken(): Promise<string | null> {
  const { data, error } = await supabase
    .from('share_links')
    .select('token')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.token ?? null
}

export async function createShareToken(): Promise<string> {
  const { data, error } = await supabase.from('share_links').insert({}).select('token').single()
  if (error) throw error
  return data.token
}

export async function revokeShareTokens() {
  const { error } = await supabase.from('share_links').delete().not('token', 'is', null)
  if (error) throw error
}
