export const prerender = false;

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { createPresignedUpload } from '../../lib/r2';

const ALLOWED_CONTENT_TYPES = new Set(['image/webp', 'image/png', 'image/jpeg', 'image/gif']);

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

  const body = await request.json();
  const contentType = body.contentType;
  if (typeof contentType !== 'string' || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    return new Response(JSON.stringify({ error: 'Unsupported image type' }), { status: 400 });
  }

  const extension = contentType.split('/')[1];
  const key = `${userData.user.id}/${crypto.randomUUID()}.${extension}`;

  try {
    const { uploadUrl, publicUrl } = await createPresignedUpload(key, contentType);
    return new Response(JSON.stringify({ uploadUrl, publicUrl }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create upload URL';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
