-- Run this in the Supabase SQL editor, same as the previous migrations.
--
-- Adds a Notion-style cover image to drafts, published to notes via the
-- existing `image` frontmatter field (already read by ArticleCard.astro).

alter table public.drafts add column cover_image text;
