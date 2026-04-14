-- Esegui nel SQL Editor di Supabase

-- Tabella config app (usata per salvare il token Betfair)
create table if not exists app_config (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

-- Solo service role può leggere/scrivere
alter table app_config enable row level security;

create policy "Service role gestisce config"
  on app_config for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
