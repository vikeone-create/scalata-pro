// api/betfair-auth.js
// Rinnova il session token Betfair (scade ogni ~8 ore)
// Chiamato dal cron o manualmente

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'POST') return res.status(405).end()

  const secret = req.headers['x-cron-secret']
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Non autorizzato' })

  const username = process.env.BETFAIR_USERNAME
  const password = process.env.BETFAIR_PASSWORD
  const appKey   = process.env.BETFAIR_APP_KEY

  if (!username || !password || !appKey) {
    return res.status(500).json({ error: 'Credenziali Betfair mancanti' })
  }

  try {
    // Login Betfair
    const loginRes = await fetch('https://identitysso-cert.betfair.com/api/certlogin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Application': appKey,
        'Accept': 'application/json',
      },
      body: new URLSearchParams({ username, password }),
    })

    const loginData = await loginRes.json()

    if (loginData.status !== 'SUCCESS') {
      return res.status(401).json({ error: `Login Betfair fallito: ${loginData.error}` })
    }

    const sessionToken = loginData.token

    // Salva il token su Supabase per riutilizzarlo
    await supabase.from('app_config').upsert({
      key: 'betfair_session',
      value: sessionToken,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

    return res.status(200).json({ success: true, message: 'Token rinnovato' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
