export const prerender = false;

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { getUserRole, isAdmin } from '../../../../lib/supabase/roles';
import { recordAuditLog } from '../../../../lib/supabase/auditLog';

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  const { decision } = await request.json();
  if (decision !== 'approved' && decision !== 'flagged') {
    return new Response(JSON.stringify({ error: 'decision must be "approved" or "flagged"' }), { status: 400 });
  }

  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const role = await getUserRole(supabase, userData.user.id);
  if (!isAdmin(role)) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });

  const { error } = await supabase.from('comments').update({ status: decision }).eq('id', params.id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  await recordAuditLog(supabase, userData.user.id, `comment_${decision}`, params.id as string);

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
