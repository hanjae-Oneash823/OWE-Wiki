-- Run this in the Supabase SQL editor, same as the previous migrations.
--
-- Stores the editor's native block document (preserves image resize/alignment/crop,
-- which plain Markdown can't represent) alongside the existing lossy `content` markdown
-- used for publishing. Nullable so existing drafts keep loading via the markdown fallback.

alter table drafts add column if not exists content_json jsonb;
