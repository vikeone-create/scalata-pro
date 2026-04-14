// api/risultati.js
// Endpoint per inserire i risultati reali delle partite
// Chiamato dall'admin dopo la giornata

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function calcEsito(pronCasa, pronTrasf, realCasa, realTrasf) {
  if (realCasa === null || realCasa === undefined) return 'IN_ATTESA'
  if (pronCasa === realCasa && pronTrasf === realTrasf) return 'ESATTO'
  const pronDir = pronCasa > pronTrasf ? 'H' : pronCasa < pronTrasf ? 'A' : 'D'
  const realDir = realCasa > realTrasf ? 'H' : realCasa < realTrasf ? 'A' : 'D'
  if (pronDir === realDir) return 'DIREZIONE'
  return 'ERRATO'
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Verifica admin
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Non autorizzato' })
  }

  // GET — lista pronostici in attesa di risultato
  if (req.method === 'GET') {
    const { date } = req.query
    const targetDate = date || new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('pronostici_storico')
      .select('*')
      .eq('data', targetDate)
      .order('created_at', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // POST — salva pronostici del giorno (chiamato dal cron dopo aver generato)
  if (req.method === 'POST' && req.query.action === 'save') {
    const { pronostici, data } = req.body
    if (!pronostici?.length) return res.status(400).json({ error: 'pronostici richiesti' })

    const rows = pronostici.map(p => ({
      data: data || new Date().toISOString().split('T')[0],
      home: p.fixture?.home_display || p.fixture?.home,
      away: p.fixture?.away_display || p.fixture?.away,
      league: p.fixture?.league,
      league_flag: p.fixture?.leagueFlag,
      pronostico_casa: p.gol_casa,
      pronostico_trasferta: p.gol_trasferta,
      confidenza: p.confidenza,
      xg_home: p.xg_home,
      xg_away: p.xg_away,
      p_home: p.p_home,
      p_draw: p.p_draw,
      p_away: p.p_away,
      esito: 'IN_ATTESA',
      value_bet: p.value_bet || null,
      top_scores: p.top_scores || null,
    }))

    const { error } = await supabase.from('pronostici_storico').insert(rows)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ saved: rows.length })
  }

  // PUT — inserisci risultati reali per una data
  if (req.method === 'PUT') {
    const { risultati } = req.body
    // risultati = [{ id, risultato_casa, risultato_trasferta }]
    if (!risultati?.length) return res.status(400).json({ error: 'risultati richiesti' })

    const updates = []
    for (const r of risultati) {
      // Fetch pronostico per calcolare esito
      const { data: existing } = await supabase
        .from('pronostici_storico')
        .select('pronostico_casa, pronostico_trasferta')
        .eq('id', r.id)
        .single()

      if (!existing) continue

      const esito = calcEsito(
        existing.pronostico_casa, existing.pronostico_trasferta,
        r.risultato_casa, r.risultato_trasferta
      )

      const { error } = await supabase
        .from('pronostici_storico')
        .update({
          risultato_casa: r.risultato_casa,
          risultato_trasferta: r.risultato_trasferta,
          esito,
          updated_at: new Date().toISOString(),
        })
        .eq('id', r.id)

      if (!error) updates.push({ id: r.id, esito })
    }

    return res.status(200).json({ updated: updates.length, esiti: updates })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
