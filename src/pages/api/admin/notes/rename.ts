export const prerender = false;

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { getUserRole, isAdmin } from '../../../../lib/supabase/roles';
import { recordAuditLog } from '../../../../lib/supabase/auditLog';
import { renameNoteOnGitHub } from '../../../../lib/github';
import { getNoteSlug } from '../../../../lib/noteSlug';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const role = await getUserRole(supabase, userData.user.id);
  if (!isAdmin(role)) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });

  const body = await request.json().catch(() => ({}));
  const noteId = typeof body.noteId === 'string' ? body.noteId : '';
  const newTitle = typeof body.newTitle === 'string' ? body.newTitle.trim() : '';

  if (!noteId || !newTitle) {
    return new Response(JSON.stringify({ error: 'noteId and newTitle are required' }), { status: 400 });
  }

  const notes = await getCollection('notes');
  const note = notes.find((n) => n.data.noteId === noteId);
  if (!note) return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 });

  if (newTitle === note.data.title) {
    return new Response(JSON.stringify({ error: 'That is already the current title' }), { status: 400 });
  }

  try {
    const result = await renameNoteOnGitHub({
      domain: note.data.domain,
      oldSlug: getNoteSlug(note.id, note.data.domain),
      oldTitle: note.data.title,
      newTitle,
    });
    await recordAuditLog(supabase, userData.user.id, 'rename_note', `${note.data.title} → ${newTitle}`);
    return new Response(JSON.stringify({ ok: true, href: result.href }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to rename note';
    const status = message === 'Note not found' ? 404 : message === 'A note with that title already exists' ? 409 : 502;
    return new Response(JSON.stringify({ error: message }), { status });
  }
};
