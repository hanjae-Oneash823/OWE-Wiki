-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  github_username text not null,
  role text not null default 'reader' check (role in ('reader', 'writer', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read all profiles"
  on public.users for select
  using (true);

create policy "Users can update their own non-role fields"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.users where id = auth.uid()));

create policy "Only admins can change roles"
  on public.users for update
  using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Auto-provision a public.users row on first GitHub sign-in.
-- The site owner's GitHub account is auto-promoted to admin; everyone else starts as reader.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, github_username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'user_name', new.raw_user_meta_data ->> 'preferred_username', 'unknown'),
    case
      when new.raw_user_meta_data ->> 'user_name' = 'hanjae-Oneash823' then 'admin'
      else 'reader'
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
