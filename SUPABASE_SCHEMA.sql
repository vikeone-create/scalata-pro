-- ESEGUI QUESTO NEL SQL EDITOR DI SUPABASE

-- Tabella link invito
create table invite_links (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_by uuid references auth.users(id),
  used_by uuid references auth.users(id),
  used_at timestamptz,
  created_at timestamptz default now()
);

-- Tabella dati utente
create table user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  scalata_attiva jsonb,
  storico jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- RLS
alter table invite_links enable row level security;
alter table user_data enable row level security;

-- Policy invite_links: tutti possono leggere (per validare il codice)
create policy "Chiunque può leggere i link invito"
  on invite_links for select using (true);

-- Policy invite_links: solo admin può inserire
create policy "Solo admin inserisce link"
  on invite_links for insert
  with check (auth.uid() = (select id from auth.users where email = current_setting('app.admin_email', true) limit 1));

-- Policy user_data
create policy "Utente vede solo i suoi dati"
  on user_data for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
