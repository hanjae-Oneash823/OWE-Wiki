-- Run this in the Supabase SQL editor, same as the previous migrations.
--
-- Moves domains from a hardcoded array in content.config.ts into an admin-editable
-- table. drafts.domain stays plain text (no FK) so a domain can be deleted while
-- leaving existing drafts/notes "orphaned" under its old slug, which is a deliberate,
-- valid state rather than an integrity error.

create table public.domains (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  created_at timestamptz not null default now()
);

insert into public.domains (slug, description) values
  ('coding', 'Software engineering, languages, and the patterns that make code maintainable.'),
  ('bioinformatics', 'Computational methods for biological data — sequencing, genomics, and analysis pipelines.'),
  ('biology', 'Foundational and molecular biology — the mechanisms underneath the data.'),
  ('ml-dl-ai', 'Machine learning, deep learning, and AI — models, training, and theory.');

alter table public.drafts drop constraint if exists drafts_domain_check;

alter table public.domains enable row level security;

create policy "Anyone can view domains"
  on public.domains for select
  using (true);
