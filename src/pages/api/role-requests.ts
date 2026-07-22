export const prerender = false;

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { requestedRole } = await request.json();
  if (requestedRole !== 'writer' && requestedRole !== 'admin') {
    return new Response(JSON.stringify({ error: 'requestedRole must be "writer" or "admin"' }), { status: 400 });
  }

  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const { data: existing } = await supabase
    .from('role_requests')
    .select('id')
    .eq('user_id', userData.user.id)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ error: 'You already have a pending role request' }), { status: 409 });
  }

  const { error } = await supabase
    .from('role_requests')
    .insert({ user_id: userData.user.id, requested_role: requestedRole });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  return new Response(JSON.stringify({ status: 'pending' }), { headers: { 'Content-Type': 'application/json' } });
};
