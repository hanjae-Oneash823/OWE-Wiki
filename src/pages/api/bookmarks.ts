export const prerender = false;

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export const GET: APIRoute = async ({ request, cookies, url }) => {
  const noteId = url.searchParams.get('noteId');
  if (!noteId) return new Response(JSON.stringify({ error: 'noteId is required' }), { status: 400 });

  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return new Response(JSON.stringify({ bookmarked: false }), { headers: { 'Content-Type': 'application/json' } });
  }

  const { data } = await supabase
    .from('bookmarks')
    .select('note_id')
    .eq('user_id', userData.user.id)
    .eq('note_id', noteId)
    .maybeSingle();

  return new Response(JSON.stringify({ bookmarked: Boolean(data) }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const { noteId } = await request.json();
  if (!noteId) return new Response(JSON.stringify({ error: 'noteId is required' }), { status: 400 });

  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const { error } = await supabase.from('bookmarks').insert({ user_id: userData.user.id, note_id: noteId });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  return new Response(JSON.stringify({ bookmarked: true }), { headers: { 'Content-Type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const { noteId } = await request.json();
  if (!noteId) return new Response(JSON.stringify({ error: 'noteId is required' }), { status: 400 });

  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', userData.user.id)
    .eq('note_id', noteId);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  return new Response(JSON.stringify({ bookmarked: false }), { headers: { 'Content-Type': 'application/json' } });
};
