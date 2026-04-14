-- Esegui nel SQL Editor di Supabase

create table pronostici_giornalieri (
  id uuid primary key default gen_random_uuid(),
  data date unique not null,
  pronostici jsonb default '[]'::jsonb,
  note text,
  generato_alle timestamptz default now()
);

-- Tutti gli utenti autenticati possono leggere
alter table pronostici_giornalieri enable row level security;

create policy "Utenti autenticati leggono pronostici"
  on pronostici_giornalieri for select
  using (auth.role() = 'authenticated');

-- Solo service role può scrivere (usato dal cron)
create policy "Service role scrive pronostici"
  on pronostici_giornalieri for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
