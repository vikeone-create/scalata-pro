-- ============================================================
-- SUPABASE_STORICO_PRONOSTICI.sql
-- Esegui nel SQL Editor di Supabase (Table Editor → SQL)
-- ⚠️  Se la tabella esiste già con la struttura vecchia, droppala prima:
--     drop table if exists pronostici_storico;
-- ============================================================

create table if not exists pronostici_storico (
  id                   uuid primary key default gen_random_uuid(),

  -- Identifica la partita
  data                 date not null,
  fixture_id           integer,           -- ID API-Football (per fetch risultato reale)
  home                 text not null,
  away                 text not null,
  league               text,
  league_flag          text,

  -- Predizioni Poisson (scritte da cron-pronostici)
  pred_risultato       text,              -- es. "2-1"
  pred_gol_casa        integer,
  pred_gol_trasferta   integer,
  pred_confidenza      text,              -- "ALTA" | "MEDIA" | "BASSA"
  pred_p_home          numeric,           -- probabilità casa (0-1)
  pred_p_draw          numeric,           -- probabilità pareggio (0-1)
  pred_p_away          numeric,           -- probabilità trasferta (0-1)
  pred_xg_home         numeric,
  pred_xg_away         numeric,

  -- Risultato reale (popolato da cron-verifica)
  real_risultato       text,              -- es. "1-1"
  real_gol_casa        integer,
  real_gol_trasferta   integer,
  real_esito           text,             -- "H" | "D" | "A"

  -- Verifica accuratezza
  verificato           boolean default false,
  verificato_alle      timestamptz,
  esatto               boolean,          -- risultato esatto corrispondente
  direzione_corretta   boolean,          -- 1X2 corretta

  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- Indici per query frequenti
create index if not exists pronostici_storico_data_idx       on pronostici_storico(data);
create index if not exists pronostici_storico_verificato_idx on pronostici_storico(verificato);
create index if not exists pronostici_storico_fixture_idx    on pronostici_storico(fixture_id);

-- Constraint unico: una riga per partita per giorno
alter table pronostici_storico
  drop constraint if exists pronostici_storico_unique;
alter table pronostici_storico
  add constraint pronostici_storico_unique unique (data, home, away);

-- Row Level Security
alter table pronostici_storico enable row level security;

drop policy if exists "Utenti leggono storico pronostici" on pronostici_storico;
create policy "Utenti leggono storico pronostici"
  on pronostici_storico for select
  using (auth.role() = 'authenticated');

drop policy if exists "Service role scrive storico" on pronostici_storico;
create policy "Service role scrive storico"
  on pronostici_storico for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Trigger per aggiornare updated_at automaticamente
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pronostici_storico_updated_at on pronostici_storico;
create trigger pronostici_storico_updated_at
  before update on pronostici_storico
  for each row execute procedure update_updated_at_column();

