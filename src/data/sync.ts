import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppData } from './types';

const TABLE = 'user_data';

export async function fetchRemote(client: SupabaseClient, userId: string): Promise<AppData | null> {
  const { data, error } = await client.from(TABLE).select('data').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data?.data as AppData | undefined) ?? null;
}

export async function pushRemote(client: SupabaseClient, userId: string, appData: AppData): Promise<void> {
  const { error } = await client
    .from(TABLE)
    .upsert({ user_id: userId, data: appData, updated_at: new Date(appData.updatedAt).toISOString() });
  if (error) throw error;
}

/** Calls `onChange` whenever another device saves new data for this user. */
export function subscribeRemote(client: SupabaseClient, userId: string, onChange: (data: AppData) => void) {
  const channel = client
    .channel(`user_data:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as { data?: AppData } | undefined;
        if (row?.data) onChange(row.data);
      },
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
