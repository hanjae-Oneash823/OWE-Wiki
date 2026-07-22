-- Run this in the Supabase SQL editor, same as 0001_users.sql.

create table public.bookmarks (
  user_id uuid not null references public.users (id) on delete cascade,
  note_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, note_id)
);

alter table public.bookmarks enable row level security;

create policy "Users manage their own bookmarks"
  on public.bookmarks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  note_id text not null,
  content text not null check (char_length(content) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'flagged')),
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "Anyone can read approved comments"
  on public.comments for select
  using (status = 'approved');

create policy "Authors can read their own comments regardless of status"
  on public.comments for select
  using (auth.uid() = user_id);

create policy "Authenticated users can insert their own pending comments"
  on public.comments for insert
  with check (auth.uid() = user_id and status = 'pending');

create policy "Admins can update comment status"
  on public.comments for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
