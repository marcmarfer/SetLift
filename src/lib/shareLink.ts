import { supabase } from './supabase'

export const API_ENDPOINT = 'https://setlift.es/api/v1/workouts'

export interface ShareLink {
  token: string
  createdAt: string
}

const toLink = (row: { token: string; created_at: string }): ShareLink => ({
  token: row.token,
  createdAt: row.created_at,
})

export async function hasApiAccess(): Promise<boolean> {
  const { data, error } = await supabase.from('api_access').select('user_id').limit(1)
  if (error) throw error
  return (data ?? []).length > 0
}

export async function currentShareLink(): Promise<ShareLink | null> {
  const { data, error } = await supabase
    .from('share_links')
    .select('token, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? toLink(data) : null
}

export async function createShareLink(): Promise<ShareLink> {
  const { data, error } = await supabase.from('share_links').insert({}).select('token, created_at').single()
  if (error) throw error
  return toLink(data)
}

export async function revokeShareTokens() {
  const { error } = await supabase.from('share_links').delete().not('token', 'is', null)
  if (error) throw error
}
