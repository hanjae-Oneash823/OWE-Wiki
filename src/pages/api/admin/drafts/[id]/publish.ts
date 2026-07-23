export const prerender = false;

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { getUserRole, isAdmin } from '../../../../../lib/supabase/roles';
import { recordAuditLog } from '../../../../../lib/supabase/auditLog';
import { publishNoteToGitHub } from '../../../../../lib/github';

export const POST: APIRoute = async ({ cookies, params, request }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const role = await getUserRole(supabase, userData.user.id);
  if (!isAdmin(role)) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });

  const { data: draft, error: fetchError } = await supabase
    .from('drafts')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) return new Response(JSON.stringify({ error: fetchError.message }), { status: 400 });
  if (!draft) return new Response(JSON.stringify({ error: 'Draft not found' }), { status: 404 });
  if (draft.status !== 'pending_publish') {
    return new Response(JSON.stringify({ error: 'Draft is not awaiting publish' }), { status: 409 });
  }

  const noteId = crypto.randomUUID();
  const publishedDate = new Date().toISOString().slice(0, 10);

  try {
    await publishNoteToGitHub({
      noteId,
      title: draft.title,
      domain: draft.domain,
      slug: draft.slug,
      content: draft.content,
      publishedDate,
      coverImage: draft.cover_image,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to publish to GitHub';
    return new Response(JSON.stringify({ error: message }), { status: 502 });
  }

  const { error: updateError } = await supabase.from('drafts').update({ status: 'published' }).eq('id', draft.id);
  if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 400 });

  await recordAuditLog(supabase, userData.user.id, 'publish_draft', `${draft.domain}/${draft.slug}`);

  return new Response(JSON.stringify({ ok: true, noteId }), { headers: { 'Content-Type': 'application/json' } });
};
