export const prerender = false;

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getUserRole, isAdmin } from '../../../lib/supabase/roles';
import { recordAuditLog } from '../../../lib/supabase/auditLog';
import { getDomains } from '../../../lib/domains';
import { slugify } from '../../../lib/slugify';

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const role = await getUserRole(supabase, userData.user.id);
  if (!isAdmin(role)) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });

  const domains = await getDomains(supabase);
  const notes = await getCollection('notes');
  const { data: draftRows, error: draftsError } = await supabase.from('drafts').select('domain');
  if (draftsError) return new Response(JSON.stringify({ error: draftsError.message }), { status: 400 });

  const result = domains.map(({ slug, description }) => ({
    slug,
    description,
    noteCount: notes.filter((note) => note.data.domain === slug).length,
    draftCount: (draftRows ?? []).filter((row) => row.domain === slug).length,
  }));

  return new Response(JSON.stringify({ domains: result }), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const role = await getUserRole(supabase, userData.user.id);
  if (!isAdmin(role)) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });

  const body = await request.json().catch(() => ({}));
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null;

  if (!slug || slugify(slug) !== slug) {
    return new Response(
      JSON.stringify({ error: 'Slug must be lowercase letters, numbers, and hyphens only (e.g. "physics")' }),
      { status: 400 },
    );
  }

  const { error } = await supabase.from('domains').insert({ slug, description });
  if (error) {
    const status = error.code === '23505' ? 409 : 400;
    const message = error.code === '23505' ? 'A domain with that slug already exists' : error.message;
    return new Response(JSON.stringify({ error: message }), { status });
  }

  await recordAuditLog(supabase, userData.user.id, 'create_domain', slug);
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
