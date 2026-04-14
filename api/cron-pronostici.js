// api/cron-pronostici.js — v4
// Poisson (matematica) + Betfair (mercato) + Odds API (bookmaker) + AI (contesto)
// Eseguito una volta al giorno da GitHub Actions — costo fisso indipendente dagli utenti

import { createClient } from '@supabase/supabase-js'

const supabase    = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const FOOTBALL_KEY = process.env.FOOTBALL_API_KEY
const ODDS_KEY     = process.env.ODDS_API_KEY
const BETFAIR_KEY  = process.env.BETFAIR_APP_KEY
const CRON_SECRET  = process.env.CRON_SECRET
const APP_URL      = process.env.VITE_APP_URL || 'http://localhost:3000'

const LEAGUES = [
  { id:135, name:'Serie A',          flag:'🇮🇹', season:2024 },
  { id:2,   name:'Champions League', flag:'⭐',  season:2024 },
  { id:39,  name:'Premier League',   flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', season:2024 },
  { id:140, name:'La Liga',          flag:'🇪🇸', season:2024 },
  { id:78,  name:'Bundesliga',       flag:'🇩🇪', season:2024 },
  { id:61,  name:'Ligue 1',          flag:'🇫🇷', season:2024 },
]

const TEAM_NAME_MAP = {
  'AC Milan':'Milan','AS Roma':'Roma','SS Lazio':'Lazio',
  'Internazionale':'Inter','Inter Milan':'Inter',
  'Hellas Verona':'Verona','SSC Napoli':'Napoli',
}
const mapTeam = n => TEAM_NAME_MAP[n] || n

const fb = async (ep, params={}) => {
  const qs = new URLSearchParams(params).toString()
  const r = await fetch(`https://v3.football.api-sports.io/${ep}${qs?'?'+qs:''}`, {
    headers: { 'x-apisports-key': FOOTBALL_KEY }
  })
  const d = await r.json()
  return d?.response || []
}

// Betfair session token da Supabase
async function getBetfairToken() {
  try {
    const { data } = await supabase.from('app_config').select('value').eq('key','betfair_session').single()
    return data?.value || null
  } catch { return null }
}

// Quote migliori da The Odds API per una partita
async function getBestOdds(homeTeam, awayTeam, date) {
  if (!ODDS_KEY) return null
  try {
    // Cerca su tutte le leghe principali
    const sports = [
      'soccer_italy_serie_a',
      'soccer_uefa_champs_league',
      'soccer_epl',
      'soccer_spain_la_liga',
      'soccer_germany_bundesliga',
      'soccer_france_ligue_one',
    ]
    let games = []
    for (const sport of sports) {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${ODDS_KEY}&regions=eu&markets=h2h&oddsFormat=decimal&dateFrom=${date}T00:00:00Z&dateTo=${date}T23:59:59Z`
      const r = await fetch(url)
      const data = await r.json()
      if (Array.isArray(data)) games = games.concat(data)
    }

    // Trova la partita
    const game = games.find(g =>
      g.home_team?.toLowerCase().includes(homeTeam.toLowerCase().split(' ')[0]) ||
      g.away_team?.toLowerCase().includes(awayTeam.toLowerCase().split(' ')[0])
    )
    if (!game) return null

    // Trova la quota migliore per ogni esito
    let bestH = 0, bestD = 0, bestA = 0
    let bestHBook = '', bestDBook = '', bestABook = ''

    for (const bm of (game.bookmakers || [])) {
      const h2h = bm.markets?.find(m => m.key === 'h2h')
      if (!h2h) continue
      for (const outcome of h2h.outcomes) {
        if (outcome.name === game.home_team && outcome.price > bestH) { bestH = outcome.price; bestHBook = bm.title }
        if (outcome.name === 'Draw' && outcome.price > bestD) { bestD = outcome.price; bestDBook = bm.title }
        if (outcome.name === game.away_team && outcome.price > bestA) { bestA = outcome.price; bestABook = bm.title }
      }
    }

    return {
      home: { odds: bestH, bookmaker: bestHBook, impliedProb: bestH ? Math.round(100/bestH*10)/10 : null },
      draw: { odds: bestD, bookmaker: bestDBook, impliedProb: bestD ? Math.round(100/bestD*10)/10 : null },
      away: { odds: bestA, bookmaker: bestABook, impliedProb: bestA ? Math.round(100/bestA*10)/10 : null },
    }
  } catch { return null }
}

// Betfair market data per una partita
async function getBetfairOdds(homeTeam, awayTeam, date, sessionToken) {
  if (!BETFAIR_KEY || !sessionToken) return null
  try {
    const BF = 'https://api.betfair.com/exchange/betting/rest/v1.0'
    const headers = { 'Content-Type':'application/json', 'X-Application':BETFAIR_KEY, 'X-Authentication':sessionToken }

    const dateFrom = `${date}T00:00:00Z`
    const dateTo   = `${date}T23:59:59Z`

    // Cerca il mercato
    const catalogRes = await fetch(`${BF}/listMarketCatalogue/`, {
      method: 'POST', headers,
      body: JSON.stringify({
        filter: {
          eventTypeIds: ['1'],
          marketTypeCodes: ['MATCH_ODDS'],
          marketStartTime: { from: dateFrom, to: dateTo },
          textQuery: homeTeam.split(' ')[0],
        },
        marketProjection: ['COMPETITION','EVENT','RUNNER_DESCRIPTION'],
        maxResults: 10,
      })
    })
    const catalog = await catalogRes.json()
    if (!catalog?.length) return null

    // Trova la partita giusta
    const market = catalog.find(m =>
      m.event?.name?.toLowerCase().includes(awayTeam.toLowerCase().split(' ')[0])
    ) || catalog[0]

    if (!market) return null

    // Ottieni le quote
    const bookRes = await fetch(`${BF}/listMarketBook/`, {
      method: 'POST', headers,
      body: JSON.stringify({
        marketIds: [market.marketId],
        priceProjection: { priceData:['EX_BEST_OFFERS','LAST_PRICE_TRADED'], exBestOffersOverrides:{ bestPricesDepth:1 } },
      })
    })
    const book = await bookRes.json()
    const mkt = book?.[0]
    if (!mkt) return null

    const runners = mkt.runners?.slice(0,3) || []
    return {
      marketId: market.marketId,
      totalMatched: mkt.totalMatched,
      home: {
        odds: runners[0]?.ex?.availableToBack?.[0]?.price || runners[0]?.lastPriceTraded,
        impliedProb: runners[0]?.ex?.availableToBack?.[0]?.price ? Math.round(100/runners[0].ex.availableToBack[0].price*10)/10 : null,
        totalMatched: runners[0]?.totalMatched,
      },
      draw: {
        odds: runners[1]?.ex?.availableToBack?.[0]?.price || runners[1]?.lastPriceTraded,
        impliedProb: runners[1]?.ex?.availableToBack?.[0]?.price ? Math.round(100/runners[1].ex.availableToBack[0].price*10)/10 : null,
        totalMatched: runners[1]?.totalMatched,
      },
      away: {
        odds: runners[2]?.ex?.availableToBack?.[0]?.price || runners[2]?.lastPriceTraded,
        impliedProb: runners[2]?.ex?.availableToBack?.[0]?.price ? Math.round(100/runners[2].ex.availableToBack[0].price*10)/10 : null,
        totalMatched: runners[2]?.totalMatched,
      },
    }
  } catch (e) {
    console.warn('[BETFAIR]', e.message)
    return null
  }
}

// Calcola value bet confrontando Poisson vs mercato
function calcValue(poissonProb, marketOdds) {
  if (!poissonProb || !marketOdds) return null
  const impliedProb = 100 / marketOdds
  const value = Math.round((poissonProb - impliedProb) * 10) / 10
  return {
    value,
    signal: value > 4 ? 'FORTE' : value > 2 ? 'LIEVE' : value < -4 ? 'CONTRO' : 'NEUTRO',
    isValue: value > 2,
  }
}

export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== CRON_SECRET) return res.status(401).json({ error:'Non autorizzato' })
  if (req.method !== 'POST') return res.status(405).end()

  const today = new Date().toISOString().split('T')[0]
  console.log(`[CRON v4] Avvio ${today}`)

  try {
    // Betfair session
    const betfairToken = await getBetfairToken()
    console.log(`[CRON] Betfair token: ${betfairToken ? 'OK' : 'N/D'}`)

    // 1. Partite di oggi
    const allFixtures = []
    for (const league of LEAGUES) {
      const fixtures = await fb('fixtures', { league:league.id, season:league.season, date:today })
      for (const f of fixtures) {
        if (!['NS','TBD'].includes(f.fixture?.status?.short)) continue
        allFixtures.push({
          fixtureId: f.fixture?.id,
          home: f.teams?.home?.name,
          away: f.teams?.away?.name,
          homeId: f.teams?.home?.id,
          awayId: f.teams?.away?.id,
          league: league.name,
          leagueFlag: league.flag,
          leagueId: league.id,
          season: league.season,
          date: today,
          time: f.fixture?.date
            ? new Date(f.fixture.date).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'})
            : '--:--',
        })
      }
    }

    if (!allFixtures.length) {
      await supabase.from('pronostici_giornalieri').upsert({ data:today, pronostici:[], note:'Nessuna partita oggi', generato_alle:new Date().toISOString() }, { onConflict:'data' })
      return res.status(200).json({ message:'Nessuna partita', date:today })
    }

    console.log(`[CRON] ${allFixtures.length} partite trovate`)

    // 2. Analisi per ogni partita
    const pronostici = []

    for (const f of allFixtures.slice(0,10)) {
      try {
        const homeModel = mapTeam(f.home)
        const awayModel = mapTeam(f.away)

        // Dati paralleli: aggiungiamo H2H
        const [lastHome, lastAway, injuries, h2h, bestOdds, betfairOdds] = await Promise.all([
          fb('fixtures', { team:f.homeId, last:8 }),
          fb('fixtures', { team:f.awayId, last:8 }),
          fb('injuries', { fixture:f.fixtureId }),
          fb('fixtures/headtohead', { h2h:`${f.homeId}-${f.awayId}`, last:5 }),
          getBestOdds(f.home, f.away, today),
          getBetfairOdds(f.home, f.away, today, betfairToken),
        ])

        // Form
        const processForm = (games, teamId) => games.map(g => {
          const isH = g.teams?.home?.id === teamId
          const s = isH ? g.goals?.home : g.goals?.away
          const c = isH ? g.goals?.away : g.goals?.home
          return { result: s>c?'W':s<c?'L':'D', scored:s, conceded:c, opponent: isH?g.teams?.away?.name:g.teams?.home?.name, venue:isH?'H':'A' }
        })
        const homeForm = processForm(lastHome, f.homeId)
        const awayForm = processForm(lastAway, f.awayId)

        // Calcola giorni dall'ultima partita (stanchezza)
        const daysSinceLastHome = lastHome[0]?.fixture?.date
          ? Math.floor((Date.now() - new Date(lastHome[0].fixture.date)) / 86400000)
          : 7
        const daysSinceLastAway = lastAway[0]?.fixture?.date
          ? Math.floor((Date.now() - new Date(lastAway[0].fixture.date)) / 86400000)
          : 7

        // Poisson v2 con tutti i parametri
        const poissonRes = await fetch(`${APP_URL}/api/poisson`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            home: homeModel,
            away: awayModel,
            leagueName: f.league,
            homeForm,
            awayForm,
            h2h: h2h.map(g => ({
              home: g.teams?.home?.name,
              away: g.teams?.away?.name,
              score: { home: g.goals?.home, away: g.goals?.away },
            })),
            homeInjuries: injuries.filter(i => i.team?.id === f.homeId),
            awayInjuries: injuries.filter(i => i.team?.id === f.awayId),
            homeDaysRest: daysSinceLastHome,
            awayDaysRest: daysSinceLastAway,
            withContext: true,
          }),
        })
        if (!poissonRes.ok) { console.warn(`[CRON] Poisson skip ${f.home}`); continue }
        const poisson = await poissonRes.json()

        // Value analysis
        const valueAnalysis = {
          bookmaker: bestOdds ? {
            home: calcValue(poisson.p_home, bestOdds.home?.odds),
            draw: calcValue(poisson.p_draw, bestOdds.draw?.odds),
            away: calcValue(poisson.p_away, bestOdds.away?.odds),
          } : null,
          betfair: betfairOdds ? {
            home: calcValue(poisson.p_home, betfairOdds.home?.odds),
            draw: calcValue(poisson.p_draw, betfairOdds.draw?.odds),
            away: calcValue(poisson.p_away, betfairOdds.away?.odds),
          } : null,
        }

        // Trova il miglior value confermato da entrambe le fonti
        let valueBetConfermato = null
        if (valueAnalysis.bookmaker && valueAnalysis.betfair) {
          const outcomes = ['home','draw','away']
          for (const outcome of outcomes) {
            const vBook = valueAnalysis.bookmaker[outcome]
            const vBf   = valueAnalysis.betfair[outcome]
            if (vBook?.isValue && vBf?.isValue) {
              valueBetConfermato = {
                outcome,
                valueBook: vBook.value,
                valueBetfair: vBf.value,
                bestOdds: bestOdds?.[outcome]?.odds,
                bestBookmaker: bestOdds?.[outcome]?.bookmaker,
                betfairOdds: betfairOdds?.[outcome]?.odds,
                signal: 'DOPPIO_VALUE', // confermato da bookmaker E betfair
              }
              break
            }
          }
          // Fallback: value solo da una fonte
          if (!valueBetConfermato) {
            for (const outcome of outcomes) {
              if (valueAnalysis.bookmaker[outcome]?.signal === 'FORTE' || valueAnalysis.betfair[outcome]?.signal === 'FORTE') {
                const src = valueAnalysis.bookmaker[outcome]?.signal === 'FORTE' ? 'bookmaker' : 'betfair'
                valueBetConfermato = {
                  outcome,
                  valueBook: valueAnalysis.bookmaker[outcome]?.value,
                  valueBetfair: valueAnalysis.betfair[outcome]?.value,
                  bestOdds: bestOdds?.[outcome]?.odds,
                  bestBookmaker: bestOdds?.[outcome]?.bookmaker,
                  betfairOdds: betfairOdds?.[outcome]?.odds,
                  signal: `VALUE_${src.toUpperCase()}`,
                }
                break
              }
            }
          }
        }

        const injuryList = injuries.slice(0,6).map(i => ({
          player: i.player?.name, type: i.injury?.type, team: i.team?.name,
        })).filter(i => i.player)

        pronostici.push({
          fixture: { ...f, home_display:f.home, away_display:f.away },
          // Poisson
          risultato: poisson.risultato,
          gol_casa: poisson.gol_casa,
          gol_trasferta: poisson.gol_trasferta,
          confidenza: poisson.confidenza,
          xg_home: poisson.xg_home,
          xg_away: poisson.xg_away,
          p_home: poisson.p_home,
          p_draw: poisson.p_draw,
          p_away: poisson.p_away,
          top_scores: poisson.top_scores?.slice(0,6),
          form_adjusted: poisson.form_adjusted,
          home_form_score: poisson.home_form_score,
          away_form_score: poisson.away_form_score,
          // Market data
          best_odds: bestOdds,
          betfair_odds: betfairOdds,
          value_analysis: valueAnalysis,
          value_bet: valueBetConfermato,
          // Form + injuries
          home_form: homeForm.slice(0,5),
          away_form: awayForm.slice(0,5),
          injuries: injuryList,
          // AI context
          context: poisson.context,
          nota_aggiustamento: poisson.nota_aggiustamento,
          model: poisson.model_info,
        })

        console.log(`[CRON] ✓ ${f.home} vs ${f.away} → ${poisson.risultato} (${poisson.confidenza})${valueBetConfermato ? ` ⚡ VALUE ${valueBetConfermato.outcome}` : ''}`)

      } catch(e) {
        console.error(`[CRON] Errore ${f.home} vs ${f.away}:`, e.message)
      }
    }

    // Salva pronostici giornalieri
    await supabase.from('pronostici_giornalieri').upsert({
      data: today, pronostici,
      note: null,
      generato_alle: new Date().toISOString(),
    }, { onConflict:'data' })

    // Salva in storico per tracking accuratezza
    if (pronostici.length) {
      for (const p of pronostici) {
        const row = {
          data: today,
          fixture_id: p.fixture?.fixtureId || null,
          home: p.fixture?.home_display || p.fixture?.home,
          away: p.fixture?.away_display || p.fixture?.away,
          league: p.fixture?.league,
          league_flag: p.fixture?.leagueFlag,
          pred_risultato: p.risultato,
          pred_gol_casa: p.gol_casa,
          pred_gol_trasferta: p.gol_trasferta,
          pred_confidenza: p.confidenza,
          pred_p_home: p.p_home,
          pred_p_draw: p.p_draw,
          pred_p_away: p.p_away,
          pred_xg_home: p.xg_home,
          pred_xg_away: p.xg_away,
          verificato: false,
        }
        await supabase.from('pronostici_storico')
          .insert(row)
          .catch(e => console.warn('[CRON] Storico insert skip:', e.message))
      }
    }

    const valueBets = pronostici.filter(p => p.value_bet).length
    console.log(`[CRON] Completato — ${pronostici.length} pronostici, ${valueBets} value bet trovati`)
    return res.status(200).json({ success:true, date:today, count:pronostici.length, value_bets:valueBets })

  } catch(e) {
    console.error('[CRON] Fatale:', e.message)
    return res.status(500).json({ error:e.message })
  }
}
