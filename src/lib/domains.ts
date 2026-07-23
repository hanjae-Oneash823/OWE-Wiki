import type { SupabaseClient } from '@supabase/supabase-js';

export interface Domain {
  slug: string;
  description: string | null;
}

export async function getDomains(supabase: SupabaseClient): Promise<Domain[]> {
  const { data, error } = await supabase.from('domains').select('slug, description').order('slug');
  if (error) throw new Error(error.message);
  return data ?? [];
}
