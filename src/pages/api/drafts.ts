export const prerender = false;

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { canWrite, getUserRole } from '../../lib/supabase/roles';
import { getDomains } from '../../lib/domains';
import { slugify } from '../../lib/slugify';

const MAX_DRAFTS_PER_DAY = 5;

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const { data, error } = await supabase
    .from('drafts')
    .select('id, title, domain, status, updated_at')
    .eq('author_id', userData.user.id)
    .order('updated_at', { ascending: false });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  return new Response(JSON.stringify({ drafts: data }), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json().catch(() => ({}));
  const trimmedTitle = typeof body.title === 'string' ? body.title.trim() : '';
  const title = trimmedTitle || 'Untitled draft';
  const content = body.content;

  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const role = await getUserRole(supabase, userData.user.id);
  if (!canWrite(role)) return new Response(JSON.stringify({ error: 'Writer access required' }), { status: 403 });

  const domains = await getDomains(supabase);
  if (domains.length === 0) {
    return new Response(JSON.stringify({ error: 'No domains are configured yet' }), { status: 409 });
  }
  const domainSlugs = domains.map(({ slug }) => slug);
  const domain = typeof body.domain === 'string' && domainSlugs.includes(body.domain) ? body.domain : domainSlugs[0];

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('drafts')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', userData.user.id)
    .gte('created_at', startOfToday.toISOString());

  if ((count ?? 0) >= MAX_DRAFTS_PER_DAY) {
    return new Response(
      JSON.stringify({ error: `You've reached the limit of ${MAX_DRAFTS_PER_DAY} new drafts per day` }),
      { status: 429 },
    );
  }

  const { data, error } = await supabase
    .from('drafts')
    .insert({
      author_id: userData.user.id,
      title,
      content: typeof content === 'string' ? content : '',
      domain,
      slug: slugify(title),
    })
    .select('id')
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  return new Response(JSON.stringify({ id: data.id }), { headers: { 'Content-Type': 'application/json' } });
};
