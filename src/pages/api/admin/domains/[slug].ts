export const prerender = false;

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { getUserRole, isAdmin } from '../../../../lib/supabase/roles';
import { recordAuditLog } from '../../../../lib/supabase/auditLog';
import { getDomains } from '../../../../lib/domains';
import { slugify } from '../../../../lib/slugify';
import { getNoteSlug } from '../../../../lib/noteSlug';
import { moveNotesBetweenDomains } from '../../../../lib/github';

/** Notes currently filed under `domain`, from the last build's content snapshot. */
async function notesInDomain(domain: string) {
  const notes = await getCollection('notes');
  return notes.filter((note) => note.data.domain === domain);
}

/** Throws if moving `fromDomain`'s notes into `toDomain` would collide on slug. */
async function assertNoCollisions(fromDomain: string, toDomain: string) {
  const [fromNotes, toNotes] = await Promise.all([notesInDomain(fromDomain), notesInDomain(toDomain)]);
  const toSlugs = new Set(toNotes.map((note) => getNoteSlug(note.id, toDomain)));
  const colliding = fromNotes.filter((note) => toSlugs.has(getNoteSlug(note.id, fromDomain)));

  if (colliding.length > 0) {
    const titles = colliding.map((note) => note.data.title).join(', ');
    throw new Error(`Can't move — these titles already exist in "${toDomain}": ${titles}`);
  }

  return fromNotes;
}

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const role = await getUserRole(supabase, userData.user.id);
  if (!isAdmin(role)) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });

  const oldSlug = params.slug as string;
  const body = await request.json().catch(() => ({}));
  const newSlug = typeof body.newSlug === 'string' ? body.newSlug.trim() : undefined;
  const description = typeof body.description === 'string' ? body.description.trim() || null : undefined;

  if (newSlug === undefined && description === undefined) {
    return new Response(JSON.stringify({ error: 'Nothing to update' }), { status: 400 });
  }

  if (newSlug !== undefined && newSlug !== oldSlug) {
    if (!newSlug || slugify(newSlug) !== newSlug) {
      return new Response(
        JSON.stringify({ error: 'Slug must be lowercase letters, numbers, and hyphens only (e.g. "physics")' }),
        { status: 400 },
      );
    }

    const domains = await getDomains(supabase);
    if (!domains.some((d) => d.slug === oldSlug)) {
      return new Response(JSON.stringify({ error: 'Domain not found' }), { status: 404 });
    }
    if (domains.some((d) => d.slug === newSlug)) {
      return new Response(JSON.stringify({ error: 'A domain with that slug already exists' }), { status: 409 });
    }

    try {
      const notesToMove = await assertNoCollisions(oldSlug, newSlug);
      await moveNotesBetweenDomains(
        oldSlug,
        newSlug,
        notesToMove.map((note) => ({ slug: getNoteSlug(note.id, oldSlug) })),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to move notes on GitHub';
      return new Response(JSON.stringify({ error: message }), { status: 502 });
    }

    await supabase.from('drafts').update({ domain: newSlug }).eq('domain', oldSlug);

    const { error: renameError } = await supabase.from('domains').update({ slug: newSlug }).eq('slug', oldSlug);
    if (renameError) return new Response(JSON.stringify({ error: renameError.message }), { status: 400 });

    await recordAuditLog(supabase, userData.user.id, 'rename_domain', `${oldSlug} → ${newSlug}`);
  }

  if (description !== undefined) {
    const targetSlug = newSlug ?? oldSlug;
    const { error: descError } = await supabase.from('domains').update({ description }).eq('slug', targetSlug);
    if (descError) return new Response(JSON.stringify({ error: descError.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ ok: true, slug: newSlug ?? oldSlug }), { headers: { 'Content-Type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ request, cookies, params }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const role = await getUserRole(supabase, userData.user.id);
  if (!isAdmin(role)) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });

  const slug = params.slug as string;
  const body = await request.json().catch(() => ({}));
  const mode = body.mode === 'move' ? 'move' : 'orphan';
  const targetDomain = typeof body.targetDomain === 'string' ? body.targetDomain.trim() : '';

  const domains = await getDomains(supabase);
  if (!domains.some((d) => d.slug === slug)) {
    return new Response(JSON.stringify({ error: 'Domain not found' }), { status: 404 });
  }

  if (mode === 'move') {
    if (!targetDomain || targetDomain === slug || !domains.some((d) => d.slug === targetDomain)) {
      return new Response(JSON.stringify({ error: 'Choose a different, existing domain to move notes into' }), { status: 400 });
    }

    try {
      const notesToMove = await assertNoCollisions(slug, targetDomain);
      await moveNotesBetweenDomains(
        slug,
        targetDomain,
        notesToMove.map((note) => ({ slug: getNoteSlug(note.id, slug) })),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to move notes on GitHub';
      return new Response(JSON.stringify({ error: message }), { status: 502 });
    }

    await supabase.from('drafts').update({ domain: targetDomain }).eq('domain', slug);
  }

  const { error } = await supabase.from('domains').delete().eq('slug', slug);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  await recordAuditLog(supabase, userData.user.id, 'delete_domain', mode === 'move' ? `${slug} (moved to ${targetDomain})` : `${slug} (orphaned)`);

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
