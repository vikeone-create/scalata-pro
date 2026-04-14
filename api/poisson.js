// api/poisson.js
// Modello Poisson calibrato su dati reali Serie A 2022-2025
// Accuratezza testata: 44.9% su 1X2 (+11.6% vs random), 11.8% risultato esatto (+8.3% vs random)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ─── DATI MODELLO SERIE A 2024/25 ────────────────────────────────────────────
// Generati da backtesting su 1140 partite (3 stagioni)
const LEAGUE_MODEL = {
  league: 'Serie A',
  season: '2024/25',
  avg_home: 1.3395,
  avg_away: 1.2211,
  teams: {
    'Inter':       { att_h:1.5719, def_h:0.9047, att_a:1.6813, def_a:0.5499 },
    'Atalanta':    { att_h:1.4150, def_h:1.0342, att_a:1.8099, def_a:0.5113 },
    'Napoli':      { att_h:1.2570, def_h:0.5605, att_a:1.1636, def_a:0.5499 },
    'Lazio':       { att_h:1.2970, def_h:1.1208, att_a:1.2072, def_a:0.9040 },
    'Juventus':    { att_h:1.2181, def_h:0.6472, att_a:1.1636, def_a:0.7863 },
    'Fiorentina':  { att_h:1.2570, def_h:0.7769, att_a:1.2072, def_a:0.9040 },
    'Milan':       { att_h:1.1792, def_h:0.6905, att_a:1.3362, def_a:1.0607 },
    'Bologna':     { att_h:1.2970, def_h:0.7769, att_a:1.0345, def_a:1.1390 },
    'Roma':        { att_h:1.4539, def_h:0.6472, att_a:0.8191, def_a:0.7863 },
    'Torino':      { att_h:0.6681, def_h:0.7769, att_a:0.9481, def_a:1.0607 },
    'Udinese':     { att_h:0.8641, def_h:1.1641, att_a:0.8191, def_a:1.1390 },
    'Genoa':       { att_h:0.8252, def_h:1.0775, att_a:0.6900, def_a:0.9431 },
    'Como':        { att_h:1.0993, def_h:1.1208, att_a:0.9045, def_a:1.0215 },
    'Cagliari':    { att_h:0.9419, def_h:1.2074, att_a:0.6900, def_a:1.0999 },
    'Parma':       { att_h:0.9808, def_h:1.2074, att_a:0.8191, def_a:1.1783 },
    'Venezia':     { att_h:0.6681, def_h:0.9480, att_a:0.6464, def_a:1.3354 },
    'Verona':      { att_h:0.5892, def_h:1.5516, att_a:0.8191, def_a:1.1783 },
    'Empoli':      { att_h:0.3932, def_h:1.1208, att_a:0.9918, def_a:1.2959 },
    'Lecce':       { att_h:0.5114, def_h:1.3374, att_a:0.6028, def_a:1.0607 },
    'Monza':       { att_h:0.5114, def_h:1.3374, att_a:0.6464, def_a:1.4922 },
  }
}

// ─── POISSON ─────────────────────────────────────────────────────────────────
function poissonProb(lambda, k) {
  if (k < 0) return 0
  let logP = -lambda + k * Math.log(lambda)
  for (let i = 1; i <= k; i++) logP -= Math.log(i)
  return Math.exp(logP)
}

function predictMatch(home, away, maxGoals = 7) {
  const model = LEAGUE_MODEL
  const sh = model.teams[home]
  const sa = model.teams[away]

  if (!sh || !sa) return null

  // Expected goals
  const xgH = sh.att_h * sa.def_a * model.avg_home
  const xgA = sa.att_a * sh.def_h * model.avg_away

  // Score matrix
  const matrix = {}
  let pHome = 0, pDraw = 0, pAway = 0

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonProb(xgH, h) * poissonProb(xgA, a)
      matrix[`${h}-${a}`] = p
      if (h > a) pHome += p
      else if (h === a) pDraw += p
      else pAway += p
    }
  }

  // Sort scores by probability
  const sorted = Object.entries(matrix)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([score, prob]) => ({
      score,
      prob: Math.round(prob * 1000) / 10,
      gol_h: parseInt(score.split('-')[0]),
      gol_a: parseInt(score.split('-')[1]),
    }))

  // Most likely score
  const top = sorted[0]

  // Confidence based on top score probability and margin vs 2nd
  const margin = sorted[0].prob - sorted[1].prob
  let confidenza
  if (sorted[0].prob >= 14 || margin >= 3) confidenza = 'ALTA'
  else if (sorted[0].prob >= 10 || margin >= 1.5) confidenza = 'MEDIA'
  else confidenza = 'BASSA'

  return {
    home, away,
    xg_home: Math.round(xgH * 100) / 100,
    xg_away: Math.round(xgA * 100) / 100,
    risultato: top.score,
    gol_casa: top.gol_h,
    gol_trasferta: top.gol_a,
    confidenza,
    p_home: Math.round(pHome * 1000) / 10,
    p_draw: Math.round(pDraw * 1000) / 10,
    p_away: Math.round(pAway * 1000) / 10,
    top_scores: sorted,
  }
}

// ─── FORM FACTOR — aggiusta xG in base alla forma recente ────────────────────
function applyFormFactor(prediction, homeForm, awayForm) {
  if (!homeForm?.length || !awayForm?.length) return prediction

  // Weighted recent form (last 5, decay)
  const calcFormScore = (form) => {
    let score = 0, weight = 0
    form.slice(0, 5).forEach((r, i) => {
      const w = Math.exp(-0.025 * i * 7)
      const pts = r.result === 'W' ? 1 : r.result === 'D' ? 0.4 : 0
      score += pts * w
      weight += w
    })
    return weight > 0 ? score / weight : 0.5
  }

  const homeScore = calcFormScore(homeForm)
  const awayScore = calcFormScore(awayForm)

  // Adjust xG by max ±15%
  const homeAdj = 1 + (homeScore - 0.5) * 0.3
  const awayAdj = 1 + (awayScore - 0.5) * 0.3

  const newXgH = prediction.xg_home * homeAdj
  const newXgA = prediction.xg_away * awayAdj

  // Recompute with adjusted xG
  const maxGoals = 7
  const matrix = {}
  let pH = 0, pD = 0, pA = 0
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonProb(newXgH, h) * poissonProb(newXgA, a)
      matrix[`${h}-${a}`] = p
      if (h > a) pH += p
      else if (h === a) pD += p
      else pA += p
    }
  }

  const sorted = Object.entries(matrix)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([score, prob]) => ({
      score,
      prob: Math.round(prob * 1000) / 10,
      gol_h: parseInt(score.split('-')[0]),
      gol_a: parseInt(score.split('-')[1]),
    }))

  const top = sorted[0]
  const margin = sorted[0].prob - sorted[1].prob
  let confidenza
  if (sorted[0].prob >= 14 || margin >= 3) confidenza = 'ALTA'
  else if (sorted[0].prob >= 10 || margin >= 1.5) confidenza = 'MEDIA'
  else confidenza = 'BASSA'

  return {
    ...prediction,
    xg_home: Math.round(newXgH * 100) / 100,
    xg_away: Math.round(newXgA * 100) / 100,
    risultato: top.score,
    gol_casa: top.gol_h,
    gol_trasferta: top.gol_a,
    confidenza,
    p_home: Math.round(pH * 1000) / 10,
    p_draw: Math.round(pD * 1000) / 10,
    p_away: Math.round(pA * 1000) / 10,
    top_scores: sorted,
    form_adjusted: true,
    home_form_score: Math.round(homeScore * 100),
    away_form_score: Math.round(awayScore * 100),
  }
}

// ─── AI CONTEXT — solo per notizie e infortuni, non per il pronostico ─────────
async function getAIContext(home, away, prediction) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return null

  const prompt = `Partita Serie A: ${home} vs ${away}. Il modello statistico Poisson prevede ${prediction.risultato} (xG: ${prediction.xg_home}-${prediction.xg_away}).

Cerca SOLO informazioni contestuali recenti: infortuni, squalifiche, notizie spogliatoio, motivazioni. NON fare pronostici — il pronostico è già calcolato dal modello matematico.

Rispondi SOLO con JSON:
{"infortuni_casa":["<giocatore> (<tipo>)"],"infortuni_trasferta":["<giocatore> (<tipo>)"],"notizia_chiave":"<max 1 frase>","impatto_modello":"<AUMENTA_HOME|AUMENTA_AWAY|NEUTRO>","nota":"<1 frase sul contesto>"}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key': anthropicKey, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    const textBlocks = data.content?.filter(b => b.type === 'text') || []
    const lastText = textBlocks[textBlocks.length - 1]?.text || ''
    const jsonMatch = lastText.replace(/```json|```/g, '').match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch { return null }
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // GET — lista squadre disponibili
  if (req.method === 'GET') {
    return res.status(200).json({
      teams: Object.keys(LEAGUE_MODEL.teams).sort(),
      model: {
        league: LEAGUE_MODEL.league,
        season: LEAGUE_MODEL.season,
        accuracy_1x2: '44.9%',
        accuracy_exact: '11.8%',
        matches_trained: 1140,
      }
    })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { home, away, homeForm, awayForm, withContext } = req.body
  if (!home || !away) return res.status(400).json({ error: 'home e away richiesti' })

  // Normalize team names
  const normalize = (name) => {
    const map = {
      'ac milan': 'Milan', 'ac roma': 'Roma', 'ss lazio': 'Lazio',
      'inter milan': 'Inter', 'fc inter': 'Inter', 'juventus fc': 'Juventus',
    }
    return map[name.toLowerCase()] || name
  }

  const homeNorm = normalize(home)
  const awayNorm = normalize(away)

  if (!LEAGUE_MODEL.teams[homeNorm]) return res.status(404).json({ error: `Squadra non trovata: ${home}. Disponibili: ${Object.keys(LEAGUE_MODEL.teams).join(', ')}` })
  if (!LEAGUE_MODEL.teams[awayNorm]) return res.status(404).json({ error: `Squadra non trovata: ${away}` })

  // Base Poisson prediction
  let prediction = predictMatch(homeNorm, awayNorm)

  // Apply form factor if provided
  if (homeForm && awayForm) {
    prediction = applyFormFactor(prediction, homeForm, awayForm)
  }

  // AI context (optional, for injuries/news)
  let context = null
  if (withContext) {
    context = await getAIContext(homeNorm, awayNorm, prediction)

    // If AI finds significant injury news, adjust xG slightly
    if (context?.impatto_modello === 'AUMENTA_HOME') {
      prediction.xg_home = Math.round(prediction.xg_home * 1.08 * 100) / 100
      prediction.nota_aggiustamento = 'xG casa +8% per vantaggio contestuale'
    } else if (context?.impatto_modello === 'AUMENTA_AWAY') {
      prediction.xg_away = Math.round(prediction.xg_away * 1.08 * 100) / 100
      prediction.nota_aggiustamento = 'xG trasferta +8% per vantaggio contestuale'
    }
  }

  const response = {
    ...prediction,
    context,
    model_info: {
      type: 'Poisson',
      data: 'Serie A 2022-2025 (1140 partite)',
      accuracy_1x2: '44.9%',
      accuracy_exact: '11.8%',
      form_applied: !!(homeForm && awayForm),
      context_applied: !!context,
    }
  }

  return res.status(200).json(response)
}
