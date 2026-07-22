import type { SupabaseClient } from '@supabase/supabase-js';

export async function recordAuditLog(
  supabase: SupabaseClient,
  actorId: string,
  action: string,
  target: string,
): Promise<void> {
  await supabase.from('audit_log').insert({ actor_id: actorId, action, target });
}
