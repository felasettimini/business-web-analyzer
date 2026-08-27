import { supabase, APP_STATE_ROW_ID } from './supabaseClient';

export interface AppStateRow {
  businesses: unknown[];
  results: unknown[];
  sent_messages: string[];
  no_whatsapp: string[];
}

export async function fetchAppState(): Promise<AppStateRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('bwa_app_state')
    .select('businesses, results, sent_messages, no_whatsapp')
    .eq('id', APP_STATE_ROW_ID)
    .maybeSingle();
  if (error) {
    console.error('Error fetching app state from Supabase', error);
    return null;
  }
  return data as AppStateRow | null;
}

export async function saveAppState(partial: Partial<AppStateRow>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('bwa_app_state')
    .upsert({ id: APP_STATE_ROW_ID, ...partial, updated_at: new Date().toISOString() });
  if (error) {
    console.error('Error saving app state to Supabase', error);
  }
}
