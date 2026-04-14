# ScalataPro v3

## Nuove env vars Vercel
| Nome | Valore |
|------|--------|
| `FOOTBALL_API_KEY` | `8119ccafd7d119d4ebc19775bdcbd993` |
| `CRON_SECRET` | Stringa segreta es. `mioSegreto2025` |

## Nuovo SQL Supabase
Esegui il contenuto di `SUPABASE_PRONOSTICI.sql` nel SQL Editor.

## GitHub Actions secrets
Vai su GitHub repo → Settings → Secrets → Actions:
| Secret | Valore |
|--------|--------|
| `CRON_SECRET` | Stessa stringa di Vercel |
| `APP_URL` | `https://scalata-pro.vercel.app` |

## Deploy
```bash
git add .
git commit -m "v3: pronostici giornalieri + cron"
git push
```

## Test manuale cron
GitHub → Actions → Pronostici Giornalieri → Run workflow
