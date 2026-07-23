export const prerender = false;

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const GET: APIRoute = async ({ request, cookies, params }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const { data, error } = await supabase.from('drafts').select('*').eq('id', params.id).maybeSingle();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  if (!data) return new Response(JSON.stringify({ error: 'Draft not found' }), { status: 404 });

  return new Response(JSON.stringify({ draft: data }), { headers: { 'Content-Type': 'application/json' } });
};

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  const body = await request.json();
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of ['title', 'content', 'domain', 'status'] as const) {
    if (field in body) {
      updates[field] = body[field];
    }
  }
  if ('contentJson' in body) {
    updates.content_json = body.contentJson;
  }
  if ('coverImage' in body) {
    updates.cover_image = body.coverImage;
  }

  const { error } = await supabase.from('drafts').update(updates).eq('id', params.id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ request, cookies, params }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const { data: draft, error: fetchError } = await supabase
    .from('drafts')
    .select('id, status')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) return new Response(JSON.stringify({ error: fetchError.message }), { status: 400 });
  if (!draft) return new Response(JSON.stringify({ error: 'Draft not found' }), { status: 404 });
  if (draft.status === 'pending_publish') {
    return new Response(
      JSON.stringify({ error: "Can't delete a draft that's awaiting publish" }),
      { status: 409 },
    );
  }

  const { error } = await supabase.from('drafts').delete().eq('id', params.id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
