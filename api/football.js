// api/football.js — Proxy per API-Football
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'FOOTBALL_API_KEY mancante' })

  const { endpoint, ...params } = req.query
  if (!endpoint) return res.status(400).json({ error: 'endpoint richiesto' })

  const qs = new URLSearchParams(params).toString()
  const url = `https://v3.football.api-sports.io/${endpoint}${qs ? '?' + qs : ''}`

  try {
    const upstream = await fetch(url, {
      headers: {
        'x-apisports-key': apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    })
    const data = await upstream.json()
    if (!upstream.ok) return res.status(upstream.status).json({ error: data.message || 'Errore API' })
    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
