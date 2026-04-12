# ScalataPro v2

## Env vars da aggiungere su Vercel

| Nome | Valore |
|------|--------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` |
| `SUPABASE_SERVICE_KEY` | La **service_role** key (da Supabase → Settings → API → Secret keys) |
| `ODDS_API_KEY` | `545203a15fce5f578d1da8b69c02f21a` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `VITE_ADMIN_EMAIL` | La tua email (quella con cui ti sei registrato) |
| `ADMIN_EMAIL` | Stessa email sopra |
| `VITE_APP_URL` | `https://scalata-pro.vercel.app` |

## SQL da eseguire su Supabase (SQL Editor)

```sql
create table invite_links (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_by uuid references auth.users(id),
  used_by uuid references auth.users(id),
  used_at timestamptz,
  created_at timestamptz default now()
);

create table user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  scalata_attiva jsonb,
  storico jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

alter table invite_links enable row level security;
alter table user_data enable row level security;

create policy "Leggi invite" on invite_links for select using (true);
create policy "Utente dati" on user_data for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## Deploy

```bash
npm install
git add .
git commit -m "v2 - refactor completo"
git push
```

Vercel si aggiorna automaticamente.

## Come usare i link invito

1. Accedi con la tua email admin
2. Vai sul tab Admin (⭐ in basso)
3. Clicca "Crea nuovo link invito"
4. Copia il link e mandalo all'amico
5. L'amico apre il link e si registra
