-- Run this in the Supabase SQL editor, same as the previous migrations.

-- Comments with suspicious link density are now inserted directly as 'flagged'
-- instead of 'pending', so the insert policy needs to allow that status too.
drop policy "Authenticated users can insert their own pending comments" on public.comments;

create policy "Authenticated users can insert their own comments"
  on public.comments for insert
  with check (auth.uid() = user_id and status in ('pending', 'flagged'));
