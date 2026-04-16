// api/odds.js — fetcha da tutte le leghe principali in parallelo
const ALL_SPORTS = [
  'soccer_italy_serie_a',
  'soccer_epl',
  'soccer_spain_la_liga',
  'soccer_germany_bundesliga',
  'soccer_france_ligue_one',
  'soccer_uefa_champs_league',
  'soccer_uefa_europa_league',
]

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { quotaMin, quotaMax } = req.query
  const apiKey = process.env.ODDS_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ODDS_API_KEY mancante' })

  const min = parseFloat(quotaMin) || 1.0
  const max = parseFloat(quotaMax) || 10.0
  const now = new Date()

  try {
    // Fetcha tutte le leghe in parallelo
    const results = await Promise.allSettled(
      ALL_SPORTS.map(sport =>
        fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`)
          .then(r => r.json())
          .then(data => ({ sport, data }))
      )
    )

    const seen = new Set()
    const filtered = []

    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      const { sport, data } = result.value
      if (!Array.isArray(data)) continue

      for (const game of data) {
        if (!game.bookmakers?.length) continue
        // Solo partite future
        if (new Date(game.commence_time) < now) continue

        for (const bm of game.bookmakers) {
          const h2h = bm.markets?.find(m => m.key === 'h2h')
          if (!h2h) continue
          for (const outcome of h2h.outcomes) {
            const q = outcome.price
            if (q < min || q > max) continue
            const k = `${game.home_team}_${game.away_team}_${outcome.name}`
            if (seen.has(k)) continue
            seen.add(k)
            filtered.push({
              id: `${game.id}_${outcome.name}_${bm.key}`,
              home: game.home_team,
              away: game.away_team,
              league: sport.replace('soccer_', '').replace(/_/g, ' '),
              commence: game.commence_time,
              bookmaker: bm.title,
              esito: outcome.name,
              quota: q,
            })
          }
        }
      }
    }

    // Ordina per vicinanza alla quota target
    const media = (min + max) / 2
    filtered.sort((a, b) => Math.abs(a.quota - media) - Math.abs(b.quota - media))

    return res.status(200).json(filtered.slice(0, 50))
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
