-- Run this in the Supabase SQL editor, same as the previous migrations.

create table public.pending_revisions (
  id uuid primary key default gen_random_uuid(),
  note_id text not null,
  author_id uuid not null references public.users (id) on delete cascade,
  content text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.pending_revisions enable row level security;

create policy "Writers can view their own pending revisions"
  on public.pending_revisions for select
  using (auth.uid() = author_id);

create policy "Admins can view all pending revisions"
  on public.pending_revisions for select
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Writers can submit their own pending revisions"
  on public.pending_revisions for insert
  with check (
    auth.uid() = author_id
    and status = 'pending_review'
    and exists (select 1 from public.users where id = auth.uid() and role in ('writer', 'admin'))
  );

create policy "Admins can update pending revisions"
  on public.pending_revisions for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users (id) on delete cascade,
  action text not null,
  target text not null,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "Admins can view the audit log"
  on public.audit_log for select
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Admins can write audit log entries"
  on public.audit_log for insert
  with check (
    auth.uid() = actor_id
    and exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Gaps left from Phase 5: admins need to publish drafts and moderate all comments.
create policy "Admins can update any draft"
  on public.drafts for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Admins can view all comments"
  on public.comments for select
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
