import type { User } from '@supabase/supabase-js'
import type { Ledger } from './types'
import { supabase } from './supabase'

export type SyncedLedger = Ledger & { updatedAt?: string }

export const stamp = (ledger: Ledger): SyncedLedger => ({ ...ledger, updatedAt: new Date().toISOString() })

export async function fetchCloudLedger(user: User): Promise<SyncedLedger | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('ledgers').select('data, updated_at').eq('user_id', user.id).maybeSingle()
  if (error) throw error
  return data ? { ...(data.data as Ledger), updatedAt: data.updated_at } : null
}

export async function saveCloudLedger(user: User, ledger: SyncedLedger) {
  if (!supabase) return
  const { error } = await supabase.from('ledgers').upsert({ user_id: user.id, data: ledger, updated_at: ledger.updatedAt })
  if (error) throw error
}
