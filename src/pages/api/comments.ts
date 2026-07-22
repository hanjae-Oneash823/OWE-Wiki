export const prerender = false;

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { hasSuspiciousLinkDensity } from '../../lib/moderation';

const MAX_COMMENTS_PER_MINUTE = 5;

export const GET: APIRoute = async ({ request, cookies, url }) => {
  const noteId = url.searchParams.get('noteId');
  if (!noteId) return new Response(JSON.stringify({ error: 'noteId is required' }), { status: 400 });

  const supabase = createSupabaseServerClient(request, cookies);
  const { data, error } = await supabase
    .from('comments')
    .select('id, content, created_at, users(github_username)')
    .eq('note_id', noteId)
    .eq('status', 'approved')
    .order('created_at', { ascending: true });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  return new Response(JSON.stringify({ comments: data }), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const { noteId, content, website } = await request.json();
  const trimmed = typeof content === 'string' ? content.trim() : '';

  // Honeypot: real users never fill this hidden field in. Pretend success so bots don't learn they were caught.
  if (typeof website === 'string' && website.trim() !== '') {
    return new Response(JSON.stringify({ status: 'pending' }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (!noteId || !trimmed) {
    return new Response(JSON.stringify({ error: 'noteId and content are required' }), { status: 400 });
  }
  if (trimmed.length > 2000) {
    return new Response(JSON.stringify({ error: 'Comment is too long (max 2000 characters)' }), { status: 400 });
  }

  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userData.user.id)
    .gte('created_at', oneMinuteAgo);

  if ((count ?? 0) >= MAX_COMMENTS_PER_MINUTE) {
    return new Response(JSON.stringify({ error: "You're commenting too fast — try again in a minute" }), {
      status: 429,
    });
  }

  const status = hasSuspiciousLinkDensity(trimmed) ? 'flagged' : 'pending';

  const { error } = await supabase
    .from('comments')
    .insert({ user_id: userData.user.id, note_id: noteId, content: trimmed, status });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  return new Response(JSON.stringify({ status }), { headers: { 'Content-Type': 'application/json' } });
};
