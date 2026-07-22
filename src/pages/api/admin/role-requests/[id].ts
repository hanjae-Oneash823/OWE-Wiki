export const prerender = false;

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { getUserRole, isAdmin } from '../../../../lib/supabase/roles';
import { recordAuditLog } from '../../../../lib/supabase/auditLog';

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  const { decision } = await request.json();
  if (decision !== 'approved' && decision !== 'denied') {
    return new Response(JSON.stringify({ error: 'decision must be "approved" or "denied"' }), { status: 400 });
  }

  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const role = await getUserRole(supabase, userData.user.id);
  if (!isAdmin(role)) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });

  const { data: roleRequest, error: fetchError } = await supabase
    .from('role_requests')
    .select('id, user_id, requested_role, status')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) return new Response(JSON.stringify({ error: fetchError.message }), { status: 400 });
  if (!roleRequest) return new Response(JSON.stringify({ error: 'Role request not found' }), { status: 404 });
  if (roleRequest.status !== 'pending') {
    return new Response(JSON.stringify({ error: 'Role request already decided' }), { status: 409 });
  }

  if (decision === 'approved') {
    const { error: roleUpdateError } = await supabase
      .from('users')
      .update({ role: roleRequest.requested_role })
      .eq('id', roleRequest.user_id);
    if (roleUpdateError) return new Response(JSON.stringify({ error: roleUpdateError.message }), { status: 400 });
  }

  const { error: statusUpdateError } = await supabase
    .from('role_requests')
    .update({ status: decision })
    .eq('id', roleRequest.id);
  if (statusUpdateError) return new Response(JSON.stringify({ error: statusUpdateError.message }), { status: 400 });

  await recordAuditLog(supabase, userData.user.id, `role_request_${decision}`, roleRequest.user_id);

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
