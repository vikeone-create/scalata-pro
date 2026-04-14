// api/pronostici.js — Pronostici risultati esatti con dati reali API-Football
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const footballKey = process.env.FOOTBALL_API_KEY
  if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY mancante' })
  if (!footballKey) return res.status(500).json({ error: 'FOOTBALL_API_KEY mancante' })

  const { fixtures } = req.body
  if (!fixtures?.length) return res.status(400).json({ error: 'fixtures richiesti' })

  const headers = { 'x-apisports-key': footballKey }

  const fixturesWithStats = await Promise.all(
    fixtures.slice(0, 8).map(async (f) => {
      try {
        const [h2hRes, homeStatsRes, awayStatsRes] = await Promise.all([
          fetch(`https://v3.football.api-sports.io/fixtures/headtohead?h2h=${f.homeId}-${f.awayId}&last=5`, { headers }),
          fetch(`https://v3.football.api-sports.io/teams/statistics?league=${f.leagueId}&season=${f.season}&team=${f.homeId}`, { headers }),
          fetch(`https://v3.football.api-sports.io/teams/statistics?league=${f.leagueId}&season=${f.season}&team=${f.awayId}`, { headers }),
        ])
        const [h2h, homeStats, awayStats] = await Promise.all([h2hRes.json(), homeStatsRes.json(), awayStatsRes.json()])

        const ext = (s) => {
          const r = s?.response; if (!r) return null
          return {
            wins: r.fixtures?.wins?.total || 0, draws: r.fixtures?.draws?.total || 0,
            loses: r.fixtures?.loses?.total || 0, goalsFor: r.goals?.for?.average?.total || '0',
            goalsAgainst: r.goals?.against?.average?.total || '0',
            cleanSheets: r.clean_sheet?.total || 0, form: r.form || '',
          }
        }

        return {
          ...f,
          stats: {
            home: ext(homeStats), away: ext(awayStats),
            h2h: (h2h?.response || []).slice(0, 5).map(m => ({
              home: m.teams?.home?.name, away: m.teams?.away?.name,
              scoreHome: m.goals?.home, scoreAway: m.goals?.away,
            })),
          }
        }
      } catch { return { ...f, stats: null } }
    })
  )

  const matchesText = fixturesWithStats.map((f, i) => {
    const s = f.stats
    let t = `${i+1}. ${f.home} vs ${f.away} (${f.league}) — ${f.date} ${f.time}`
    if (s?.home && s?.away) {
      t += `\n   ${f.home}: ${s.home.wins}V ${s.home.draws}P ${s.home.loses}S | Gol avg: ${s.home.goalsFor} fatti / ${s.home.goalsAgainst} subiti | CS: ${s.home.cleanSheets} | Forma: ${s.home.form?.slice(-5)||'N/D'}`
      t += `\n   ${f.away}: ${s.away.wins}V ${s.away.draws}P ${s.away.loses}S | Gol avg: ${s.away.goalsFor} fatti / ${s.away.goalsAgainst} subiti | CS: ${s.away.cleanSheets} | Forma: ${s.away.form?.slice(-5)||'N/D'}`
      if (s.h2h?.length) t += `\n   H2H: ${s.h2h.map(m => `${m.home} ${m.scoreHome}-${m.scoreAway} ${m.away}`).join(' | ')}`
    }
    return t
  }).join('\n\n')

  const prompt = `Sei un analista calcistico esperto. Usa SOLO i dati statistici forniti per pronosticare il risultato esatto più probabile di ogni partita. Scopo puramente educativo.

PARTITE:
${matchesText}

Rispondi SOLO con JSON valido:
{"pronostici":[{"index":<1-based>,"risultato":"<X-Y>","confidenza":"<ALTA|MEDIA|BASSA>","gol_casa":<n>,"gol_trasferta":<n>,"motivazione":"<2-3 frasi sui dati>","trend_casa":"<forma in una frase>","trend_trasferta":"<forma in una frase>","h2h_nota":"<nota h2h>"}]}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Errore AI' })
    const text = data.content?.find(b => b.type === 'text')?.text || ''
    const jsonMatch = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/)
    if (!jsonMatch) return res.status(500).json({ error: 'Nessun JSON' })
    const result = JSON.parse(jsonMatch[0])
    result.pronostici = result.pronostici.map(p => ({ ...p, fixture: fixturesWithStats[p.index - 1] }))
    return res.status(200).json(result)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
