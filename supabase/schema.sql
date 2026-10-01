-- Executar no SQL Editor do projeto Supabase.
-- Guarda um documento JSON por utilizador; cada utilizador só acede aos seus dados (RLS).

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "select own data" on public.user_data
  for select using (auth.uid() = user_id);

create policy "insert own data" on public.user_data
  for insert with check (auth.uid() = user_id);

create policy "update own data" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own data" on public.user_data
  for delete using (auth.uid() = user_id);

-- Atualizações em tempo real entre dispositivos.
alter publication supabase_realtime add table public.user_data;
