# ScalataPro AI 🎯

Strumento educativo per la gestione delle scalate betting con analisi AI, quote live e storico per utente.

> ⚠️ **Solo uso educativo** · Non costituisce invito al gioco · Il gioco d'azzardo può creare dipendenza

---

## Stack

- **React + Vite** — frontend
- **Supabase** — autenticazione + database per utente
- **Vercel** — deploy + serverless function proxy (API key nascosta)
- **The Odds API** — quote live reali
- **Claude AI** — analisi partite con web search

---

## Setup in 5 step

### 1. Supabase — crea il progetto

1. Vai su [supabase.com](https://supabase.com) → **New Project**
2. Vai su **SQL Editor** e incolla questo:

```sql
create table scalata_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  scalata_attiva jsonb,
  storico jsonb default '[]'::jsonb,
  analysis_cache jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Sicurezza: ogni utente vede solo i propri dati
alter table scalata_data enable row level security;

create policy "Utente vede solo i suoi dati"
  on scalata_data for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

3. Vai su **Authentication → Providers** → abilita **Google** (opzionale ma consigliato)
4. Copia da **Settings → API**:
   - `Project URL`
   - `anon public key`

### 2. Variabili d'ambiente

Copia `.env.example` in `.env` e compila:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://tuoprogetto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
ODDS_API_KEY=545203a15fce5f578d1da8b69c02f21a
```

### 3. Installa e testa in locale

```bash
npm install
npm run dev
```

Apri [http://localhost:5173](http://localhost:5173)

### 4. Deploy su Vercel

```bash
# Installa Vercel CLI se non ce l'hai
npm i -g vercel

# Deploy
vercel

# Segui le istruzioni, poi aggiungi le env vars:
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add ODDS_API_KEY

# Re-deploy con le variabili
vercel --prod
```

In alternativa: collega il repo GitHub su [vercel.com](https://vercel.com) e aggiungi le env vars dalla dashboard.

### 5. Configura Google OAuth (opzionale)

In Supabase → **Authentication → URL Configuration**:
- Site URL: `https://tuosito.vercel.app`
- Redirect URLs: `https://tuosito.vercel.app/**`

---

## Struttura progetto

```
scalata-pro/
├── api/
│   └── odds.js          ← Vercel serverless proxy (nasconde API key)
├── src/
│   ├── main.jsx         ← Entry point
│   ├── App.jsx          ← Routing + auth guard
│   ├── Login.jsx        ← Pagina login (email/password, magic link, Google)
│   ├── ScalataPro.jsx   ← App principale
│   └── supabase.js      ← Client Supabase
├── index.html
├── vite.config.js
├── vercel.json
├── .env.example
└── package.json
```

---

## Funzionalità

- ✅ Login con email/password, magic link, Google
- ✅ Dati sincronizzati per utente su Supabase
- ✅ Quote live reali da bookmaker europei (filtrate per tipo scalata)
- ✅ API key Odds nascosta lato server (Vercel Function)
- ✅ Analisi AI partite: notizie, forma, value bet, rating 1-10
- ✅ Storico scalate con statistiche globali
- ✅ UI glassmorphism warm amber responsive
