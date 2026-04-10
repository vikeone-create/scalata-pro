// api/odds.js — Vercel Serverless Function
// Proxy per nascondere la Odds API key dal frontend

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { sport, quotaMin, quotaMax } = req.query;
  if (!sport) return res.status(400).json({ error: 'sport required' });

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key non configurata' });

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`;
    const upstream = await fetch(url);
    const remaining = upstream.headers.get('x-requests-remaining');

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Odds API error ${upstream.status}` });
    }

    const data = await upstream.json();

    // Filtra per range quote lato server
    const min = parseFloat(quotaMin) || 0;
    const max = parseFloat(quotaMax) || 99;
    const seen = new Set();
    const filtered = [];

    for (const game of data) {
      if (!game.bookmakers?.length) continue;
      if (new Date(game.commence_time) < new Date()) continue;
      for (const bm of game.bookmakers) {
        const h2h = bm.markets?.find(m => m.key === 'h2h');
        if (!h2h) continue;
        for (const outcome of h2h.outcomes) {
          const q = outcome.price;
          if (q < min || q > max) continue;
          const k = `${game.home_team}_${game.away_team}_${outcome.name}`;
          if (seen.has(k)) continue;
          seen.add(k);
          filtered.push({
            id: `${game.id}_${outcome.name}_${bm.key}`,
            home: game.home_team,
            away: game.away_team,
            commence: game.commence_time,
            bookmaker: bm.title,
            esito: outcome.name,
            quota: q,
          });
        }
      }
    }

    const media = (min + max) / 2;
    filtered.sort((a, b) => Math.abs(a.quota - media) - Math.abs(b.quota - media));

    res.setHeader('x-requests-remaining', remaining || '');
    return res.status(200).json(filtered.slice(0, 15));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
