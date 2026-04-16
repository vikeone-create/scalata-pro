// api/footballdata.js
// Proxy football-data.org — gratis per Serie A, Champions, Premier, LaLiga, Bundesliga, Ligue 1
// Endpoints: standings, H2H, fixtures, squadra

const FD_KEY = process.env.FOOTBALL_DATA_KEY
const BASE   = 'https://api.football-data.org/v4'

const LEAGUE_CODE = {
  'Serie A':          'SA',
  'Champions League': 'CL',
  'Europa League':    'EL',
  'Premier League':   'PL',
  'La Liga':          'PD',
  'Bundesliga':       'BL1',
  'Ligue 1':          'FL1',
}

// ID squadre football-data.org per H2H
const TEAM_FD_ID = {
  // Serie A
  'Inter':          108, 'Internazionale': 108,
  'Napoli':         113, 'Juventus':       109,
  'Milan':           98, 'AC Milan':        98,
  'Roma':           100, 'Lazio':          110,
  'Atalanta':       102, 'Fiorentina':     99,
  'Bologna':        103, 'Torino':         114,
  'Udinese':        115, 'Genoa':          107,
  'Como':           5890,'Cagliari':       104,
  'Parma':          112, 'Verona':         450,
  'Empoli':         445, 'Lecce':          5911,
  // Champions League
  'Real Madrid':     86, 'Barcelona':       81,
  'Bayern Munich':    5, 'Arsenal':         57,
  'Manchester City':  65,'Liverpool':        64,
  'PSG':             524,'Paris Saint-Germain': 524,
  'Inter Milan':     108,'Atletico Madrid':  78,
  'Borussia Dortmund': 4,'Dortmund':          4,
  'Bayer Leverkusen':  3,'Chelsea':           61,
  'Benfica':         294,'Porto':            297,
  'Sporting CP':     498,'Sporting Lisbona': 498,
  'Ajax':            674,'Feyenoord':        675,
  'Aston Villa':      58,'Tottenham':         73,
  'Newcastle':        67,'Manchester United': 66,
  // Bundesliga extra
  'Leipzig':           721,'RB Leipzig':       721,
  'Eintracht Frankfurt': 19,
  // La Liga extra
  'Sevilla':           559,'Villarreal':       94,
  'Athletic Club':     77, 'Real Sociedad':   92,
}

async function fdFetch(endpoint) {
  const r = await fetch(`${BASE}${endpoint}`, {
    headers: { 'X-Auth-Token': FD_KEY }
  })
  if (!r.ok) return null
  return r.json()
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!FD_KEY) return res.status(500).json({ error: 'FOOTBALL_DATA_KEY mancante' })

  const { action, league, homeTeam, awayTeam } = req.query

  // ── FIXTURES ──
  if (action === 'fixtures') {
    const code = LEAGUE_CODE[league]
    if (!code) return res.status(400).json({ error: 'Lega non supportata' })
    const today = new Date().toISOString().split('T')[0]
    const data = await fdFetch(`/competitions/${code}/matches?dateFrom=${today}&dateTo=${today}&status=SCHEDULED,TIMED,IN_PLAY`)
    if (!data) return res.status(500).json({ error: 'Errore football-data.org' })

    const fixtures = (data.matches || []).map(m => ({
      fixtureId: m.id,
      home: m.homeTeam?.name,
      away: m.awayTeam?.name,
      homeId: m.homeTeam?.id,
      awayId: m.awayTeam?.id,
      time: m.utcDate ? new Date(m.utcDate).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'}) : '--:--',
      status: m.status,
    }))
    return res.status(200).json({ fixtures })
  }

  // ── STANDINGS ──
  if (action === 'standings') {
    const code = LEAGUE_CODE[league]
    if (!code) return res.status(400).json({ error: 'Lega non supportata' })
    const data = await fdFetch(`/competitions/${code}/standings`)
    if (!data) return res.status(500).json({ error: 'Errore football-data.org' })

    const table = data.standings?.[0]?.table || []
    const standings = table.map(t => ({
      position: t.position,
      team: t.team?.name,
      played: t.playedGames,
      won: t.won, draw: t.draw, lost: t.lost,
      points: t.points,
      goalsFor: t.goalsFor, goalsAgainst: t.goalsAgainst,
      form: t.form,
    }))
    return res.status(200).json({ standings })
  }

  // ── H2H ──
  if (action === 'h2h') {
    const homeId = TEAM_FD_ID[homeTeam]
    const awayId = TEAM_FD_ID[awayTeam]
    if (!homeId || !awayId) return res.status(200).json({ h2h: [], found: false })

    // football-data.org: usa endpoint match con filtro team
    const data = await fdFetch(`/teams/${homeId}/matches?status=FINISHED&limit=20`)
    if (!data?.matches) return res.status(200).json({ h2h: [], found: false })

    // Filtra solo le partite contro l'avversario
    const h2h = data.matches
      .filter(m =>
        (m.homeTeam?.id === homeId && m.awayTeam?.id === awayId) ||
        (m.homeTeam?.id === awayId && m.awayTeam?.id === homeId)
      )
      .slice(0, 5)
      .map(m => ({
        date: m.utcDate,
        home: m.homeTeam?.name,
        away: m.awayTeam?.name,
        score: {
          home: m.score?.fullTime?.home,
          away: m.score?.fullTime?.away,
        },
        winner: m.score?.winner, // HOME_TEAM, AWAY_TEAM, DRAW
      }))

    return res.status(200).json({ h2h, found: true })
  }

  return res.status(400).json({ error: 'action non valida. Usa: standings, h2h' })
}
