export const prerender = false;

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getUserRole, isAdmin } from '../../../lib/supabase/roles';

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const role = await getUserRole(supabase, userData.user.id);
  if (!isAdmin(role)) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });

  const { data, error } = await supabase
    .from('drafts')
    .select('id, title, domain, updated_at, users(github_username)')
    .eq('status', 'pending_publish')
    .order('updated_at', { ascending: true });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  return new Response(JSON.stringify({ drafts: data }), { headers: { 'Content-Type': 'application/json' } });
};
