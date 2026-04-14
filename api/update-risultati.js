// api/update-risultati.js
// Chiamato dal cron ogni mattina — aggiorna i risultati reali delle partite di ieri
// e calcola esattezza del modello

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const FOOTBALL_KEY = process.env.FOOTBALL_API_KEY
const CRON_SECRET  = process.env.CRON_SECRET

function get1x2(gCasa, gTrasferta) {
  if (gCasa > gTrasferta) return 'H'
  if (gCasa < gTrasferta) return 'A'
  return 'D'
}

export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== CRON_SECRET) return res.status(401).json({ error: 'Non autorizzato' })
  if (req.method !== 'POST') return res.status(405).end()

  // Ieri
  const ieri = new Date()
  ieri.setDate(ieri.getDate() - 1)
  const dataIeri = ieri.toISOString().split('T')[0]

  console.log(`[UPDATE] Aggiornamento risultati per ${dataIeri}`)

  try {
    // 1. Prendi pronostici di ieri senza risultato reale
    const { data: pronostici, error } = await supabase
      .from('storico_pronostici')
      .select('*')
      .eq('data', dataIeri)
      .is('risultato_reale', null)

    if (error) throw error
    if (!pronostici?.length) {
      console.log('[UPDATE] Nessun pronostico da aggiornare')
      return res.status(200).json({ message: 'Nessun pronostico da aggiornare', date: dataIeri })
    }

    console.log(`[UPDATE] ${pronostici.length} pronostici da aggiornare`)

    // 2. Per ogni pronostico cerca il risultato reale su API-Football
    let aggiornati = 0, esatti = 0, direzioneCorretta = 0

    for (const p of pronostici) {
      try {
        const url = `https://v3.football.api-sports.io/fixtures?date=${dataIeri}&league=${getLeagueId(p.league)}&season=2024`
        const r = await fetch(url, { headers: { 'x-apisports-key': FOOTBALL_KEY } })
        const data = await r.json()
        const fixtures = data?.response || []

        // Trova la partita
        const match = fixtures.find(f => {
          const h = f.teams?.home?.name?.toLowerCase()
          const a = f.teams?.away?.name?.toLowerCase()
          return h?.includes(p.home.toLowerCase().split(' ')[0]) ||
                 a?.includes(p.away.toLowerCase().split(' ')[0])
        })

        if (!match) continue
        const status = match.fixture?.status?.short
        if (!['FT', 'AET', 'PEN'].includes(status)) continue // partita non finita

        const gCasa = match.goals?.home
        const gTrasferta = match.goals?.away
        if (gCasa === null || gCasa === undefined) continue

        const risultatoReale = `${gCasa}-${gTrasferta}`
        const res1x2 = get1x2(gCasa, gTrasferta)
        const isEsatto = risultatoReale === p.pronostico_risultato
        const isDirezione = res1x2 === p.pronostico_1x2

        await supabase
          .from('storico_pronostici')
          .update({
            risultato_reale: risultatoReale,
            gol_casa_reale: gCasa,
            gol_trasferta_reale: gTrasferta,
            risultato_1x2_reale: res1x2,
            esatto: isEsatto,
            direzione_corretta: isDirezione,
            aggiornato_alle: new Date().toISOString(),
          })
          .eq('id', p.id)

        aggiornati++
        if (isEsatto) esatti++
        if (isDirezione) direzioneCorretta++

        console.log(`[UPDATE] ${p.home} vs ${p.away}: prev ${p.pronostico_risultato} → reale ${risultatoReale} | esatto:${isEsatto} dir:${isDirezione}`)
      } catch(e) {
        console.error(`[UPDATE] Errore ${p.home} vs ${p.away}:`, e.message)
      }
    }

    return res.status(200).json({
      success: true,
      date: dataIeri,
      aggiornati,
      esatti,
      direzioneCorretta,
      accuratezza_esatto: aggiornati ? `${Math.round(esatti/aggiornati*100)}%` : 'N/D',
      accuratezza_1x2: aggiornati ? `${Math.round(direzioneCorretta/aggiornati*100)}%` : 'N/D',
    })

  } catch(e) {
    console.error('[UPDATE] Errore:', e.message)
    return res.status(500).json({ error: e.message })
  }
}

function getLeagueId(league) {
  const map = { 'Serie A': 135, 'Champions League': 2, 'Premier League': 39, 'La Liga': 140, 'Bundesliga': 78, 'Ligue 1': 61 }
  return map[league] || 135
}
