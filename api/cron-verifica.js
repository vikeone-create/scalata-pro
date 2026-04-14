// api/cron-verifica.js
// Gira ogni notte — controlla i risultati reali delle partite del giorno precedente
// Aggiorna pronostici_storico con esito corretto/sbagliato

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
const FOOTBALL_KEY = process.env.FOOTBALL_API_KEY
const CRON_SECRET  = process.env.CRON_SECRET

const fb = async (ep, params = {}) => {
  const qs = new URLSearchParams(params).toString()
  const r = await fetch(
    `https://v3.football.api-sports.io/${ep}${qs ? '?' + qs : ''}`,
    { headers: { 'x-apisports-key': FOOTBALL_KEY } }
  )
  const d = await r.json()
  return d?.response || []
}

export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== CRON_SECRET) {
    return res.status(401).json({ error: 'Non autorizzato' })
  }
  if (req.method !== 'POST') return res.status(405).end()

  // Ieri
  const ieri = new Date()
  ieri.setDate(ieri.getDate() - 1)
  const dataIeri = ieri.toISOString().split('T')[0]

  console.log(`[VERIFICA] Controllo risultati del ${dataIeri}`)

  try {
    // 1. Carica i pronostici di ieri non ancora verificati
    const { data: pronostici, error } = await supabase
      .from('pronostici_storico')
      .select('*')
      .eq('data', dataIeri)
      .eq('verificato', false)

    if (error) throw error
    if (!pronostici?.length) {
      console.log('[VERIFICA] Nessun pronostico da verificare')
      return res.status(200).json({ message: 'Nessun pronostico da verificare', date: dataIeri })
    }

    console.log(`[VERIFICA] ${pronostici.length} pronostici da verificare`)

    // 2. Carica i risultati reali da API-Football
    const fixtureIds = pronostici
      .filter(p => p.fixture_id)
      .map(p => p.fixture_id)

    // Fetch risultati per fixture ID
    const risultatiReali = {}
    for (const fid of fixtureIds) {
      try {
        const data = await fb('fixtures', { id: fid })
        if (data?.[0]) {
          const f = data[0]
          const status = f.fixture?.status?.short
          // Solo partite finite
          if (['FT', 'AET', 'PEN'].includes(status)) {
            risultatiReali[fid] = {
              gol_casa: f.goals?.home,
              gol_trasferta: f.goals?.away,
              status,
            }
          }
        }
      } catch (e) {
        console.warn(`[VERIFICA] Errore fixture ${fid}:`, e.message)
      }
    }

    // 3. Aggiorna ogni pronostico con il risultato reale
    let verificati = 0
    let corretti_esatti = 0
    let corretti_direzione = 0

    for (const p of pronostici) {
      const reale = p.fixture_id ? risultatiReali[p.fixture_id] : null
      if (!reale) {
        // Partita non ancora finita o dati non disponibili — skip
        continue
      }

      const realGolCasa = reale.gol_casa
      const realGolTrasferta = reale.gol_trasferta
      const realRisultato = `${realGolCasa}-${realGolTrasferta}`
      let realEsito = 'D'
      if (realGolCasa > realGolTrasferta) realEsito = 'H'
      else if (realGolCasa < realGolTrasferta) realEsito = 'A'

      // Previsione esatta
      const esatto = p.pred_risultato === realRisultato

      // Direzione corretta (1X2)
      let predEsito = 'D'
      if (p.pred_gol_casa > p.pred_gol_trasferta) predEsito = 'H'
      else if (p.pred_gol_casa < p.pred_gol_trasferta) predEsito = 'A'
      const direzioneCorretta = predEsito === realEsito

      if (esatto) corretti_esatti++
      if (direzioneCorretta) corretti_direzione++

      // Aggiorna su Supabase
      await supabase
        .from('pronostici_storico')
        .update({
          real_gol_casa: realGolCasa,
          real_gol_trasferta: realGolTrasferta,
          real_risultato: realRisultato,
          real_esito: realEsito,
          esatto,
          direzione_corretta: direzioneCorretta,
          verificato: true,
          verificato_alle: new Date().toISOString(),
        })
        .eq('id', p.id)

      verificati++
      console.log(`[VERIFICA] ${p.home} vs ${p.away}: Prev ${p.pred_risultato} → Reale ${realRisultato} ${esatto ? '✓ ESATTO' : direzioneCorretta ? '~ DIREZIONE OK' : '✗ SBAGLIATO'}`)
    }

    // 4. Calcola stats globali aggiornate
    const { data: tuttiVerificati } = await supabase
      .from('pronostici_storico')
      .select('esatto, direzione_corretta')
      .eq('verificato', true)

    const totale = tuttiVerificati?.length || 0
    const totEsatti = tuttiVerificati?.filter(p => p.esatto).length || 0
    const totDirezione = tuttiVerificati?.filter(p => p.direzione_corretta).length || 0

    const stats = {
      totale,
      acc_esatti: totale ? Math.round(totEsatti / totale * 1000) / 10 : 0,
      acc_direzione: totale ? Math.round(totDirezione / totale * 1000) / 10 : 0,
    }

    // Salva stats globali
    await supabase.from('app_config').upsert({
      key: 'pronostici_stats',
      value: JSON.stringify(stats),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

    console.log(`[VERIFICA] Completato — ${verificati} verificati, ${corretti_esatti} esatti, ${corretti_direzione} direzione corretta`)
    console.log(`[VERIFICA] Stats globali: ${stats.acc_esatti}% esatti, ${stats.acc_direzione}% direzione`)

    return res.status(200).json({
      success: true,
      date: dataIeri,
      verificati,
      corretti_esatti,
      corretti_direzione,
      stats_globali: stats,
    })

  } catch (e) {
    console.error('[VERIFICA] Errore:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
