-- ============================================================
--  Renovate — Supabase setup
--  Paste this whole file into Supabase → SQL Editor → New query
--  → Run. It is safe to run again if you need to.
-- ============================================================

-- 1) One table holding the whole board as a single JSON record.
create table if not exists public.board (
  id text primary key,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) Turn on Row Level Security, then allow the public browser key to
--    read and write THIS ONE TABLE. (No login — anyone with your app's
--    URL can edit the board. That's fine for a private tool shared with
--    one person; see the README for how to lock it down further.)
alter table public.board enable row level security;

drop policy if exists "public read board"   on public.board;
drop policy if exists "public insert board"  on public.board;
drop policy if exists "public update board"  on public.board;

create policy "public read board"   on public.board for select using (true);
create policy "public insert board"  on public.board for insert with check (true);
create policy "public update board"  on public.board for update using (true) with check (true);

-- 3) Stream live changes so both people see updates instantly.
do $$
begin
  alter publication supabase_realtime add table public.board;
exception
  when duplicate_object then null;  -- already added; ignore
end $$;
