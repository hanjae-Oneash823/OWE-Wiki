export const prerender = false;

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { getUserRole } from '../../lib/supabase/roles';

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return new Response(JSON.stringify({ user: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const role = await getUserRole(supabase, data.user.id);

  return new Response(
    JSON.stringify({
      user: {
        username: data.user.user_metadata.user_name ?? data.user.user_metadata.preferred_username ?? null,
        avatarUrl: data.user.user_metadata.avatar_url ?? null,
        role,
      },
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
