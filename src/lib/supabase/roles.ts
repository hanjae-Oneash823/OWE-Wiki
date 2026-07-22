import type { SupabaseClient } from '@supabase/supabase-js';

export type UserRole = 'reader' | 'writer' | 'admin';

export async function getUserRole(supabase: SupabaseClient, userId: string): Promise<UserRole | null> {
  const { data } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
  return (data?.role as UserRole | undefined) ?? null;
}

export function canWrite(role: UserRole | null): boolean {
  return role === 'writer' || role === 'admin';
}

export function isAdmin(role: UserRole | null): boolean {
  return role === 'admin';
}
