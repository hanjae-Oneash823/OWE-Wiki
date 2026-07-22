-- Run this in the Supabase SQL editor, same as the previous migrations.

create table public.role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  requested_role text not null check (requested_role in ('writer', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now()
);

alter table public.role_requests enable row level security;

create policy "Users can view their own role requests"
  on public.role_requests for select
  using (auth.uid() = user_id);

create policy "Admins can view all role requests"
  on public.role_requests for select
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Users can submit their own role request"
  on public.role_requests for insert
  with check (auth.uid() = user_id and status = 'pending');

create policy "Admins can update role requests"
  on public.role_requests for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  content text not null default '',
  domain text not null check (domain in ('coding', 'bioinformatics', 'biology', 'ml-dl-ai')),
  growth_stage text not null default 'seedling' check (growth_stage in ('seedling', 'sprout', 'established')),
  slug text not null,
  status text not null default 'draft' check (status in ('draft', 'pending_publish', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.drafts enable row level security;

create policy "Writers can view their own drafts"
  on public.drafts for select
  using (auth.uid() = author_id);

create policy "Admins can view all drafts"
  on public.drafts for select
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Writers can create their own drafts"
  on public.drafts for insert
  with check (
    auth.uid() = author_id
    and exists (select 1 from public.users where id = auth.uid() and role in ('writer', 'admin'))
  );

create policy "Writers can update their own drafts"
  on public.drafts for update
  using (auth.uid() = author_id);

create policy "Writers can delete their own drafts"
  on public.drafts for delete
  using (auth.uid() = author_id);
