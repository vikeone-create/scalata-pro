// api/betfair.js
// Betfair Exchange API — lettura quote e movement mercato
// Usato SOLO per leggere dati (read-only), mai per piazzare scommesse

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const appKey = process.env.BETFAIR_APP_KEY
  const sessionToken = process.env.BETFAIR_SESSION_TOKEN
  if (!appKey) return res.status(500).json({ error: 'BETFAIR_APP_KEY mancante' })
  if (!sessionToken) return res.status(500).json({ error: 'BETFAIR_SESSION_TOKEN mancante' })

  const { action, params } = req.body
  if (!action) return res.status(400).json({ error: 'action richiesta' })

  const BF_URL = 'https://api.betfair.com/exchange/betting/rest/v1.0'
  const headers = {
    'Content-Type': 'application/json',
    'X-Application': appKey,
    'X-Authentication': sessionToken,
    'Accept': 'application/json',
  }

  try {
    switch (action) {

      // Cerca mercati per una partita specifica
      case 'listMarkets': {
        const { homeTeam, awayTeam, date } = params
        const dateFrom = new Date(date)
        dateFrom.setHours(0, 0, 0, 0)
        const dateTo = new Date(date)
        dateTo.setHours(23, 59, 59, 999)

        const body = {
          filter: {
            eventTypeIds: ['1'], // 1 = Soccer
            marketCountries: ['IT', 'GB', 'FR', 'DE', 'ES'],
            marketTypeCodes: ['MATCH_ODDS'],
            marketStartTime: {
              from: dateFrom.toISOString(),
              to: dateTo.toISOString(),
            },
            textQuery: homeTeam,
          },
          marketProjection: ['COMPETITION', 'EVENT', 'MARKET_START_TIME', 'RUNNER_DESCRIPTION'],
          maxResults: 20,
        }

        const r = await fetch(`${BF_URL}/listMarketCatalogue/`, { method:'POST', headers, body: JSON.stringify(body) })
        const data = await r.json()
        return res.status(200).json(data)
      }

      // Ottieni quote attuali per un mercato
      case 'getOdds': {
        const { marketId } = params
        if (!marketId) return res.status(400).json({ error: 'marketId richiesto' })

        const body = {
          marketIds: [marketId],
          priceProjection: {
            priceData: ['EX_BEST_OFFERS', 'LAST_PRICE_TRADED'],
            exBestOffersOverrides: { bestPricesDepth: 3 },
            rollupModel: 'STAKE',
          },
          orderProjection: 'EXECUTABLE',
          matchProjection: 'NO_ROLLUP',
        }

        const r = await fetch(`${BF_URL}/listMarketBook/`, { method:'POST', headers, body: JSON.stringify(body) })
        const data = await r.json()
        if (!data?.[0]) return res.status(404).json({ error: 'Mercato non trovato' })

        const market = data[0]
        const runners = market.runners?.map(runner => ({
          selectionId: runner.selectionId,
          status: runner.status,
          lastPriceTraded: runner.lastPriceTraded,
          totalMatched: runner.totalMatched,
          bestBack: runner.ex?.availableToBack?.[0]?.price,
          bestLay: runner.ex?.availableToLay?.[0]?.price,
          backDepth: runner.ex?.availableToBack?.slice(0,3),
          layDepth: runner.ex?.availableToLay?.slice(0,3),
        }))

        return res.status(200).json({
          marketId: market.marketId,
          status: market.status,
          totalMatched: market.totalMatched,
          runners,
        })
      }

      // Analisi completa: quote + confronto con modello Poisson
      case 'analyzeValue': {
        const { marketId, poissonProbs } = params
        if (!marketId || !poissonProbs) return res.status(400).json({ error: 'marketId e poissonProbs richiesti' })

        // Fetch quote Betfair
        const body = {
          marketIds: [marketId],
          priceProjection: {
            priceData: ['EX_BEST_OFFERS', 'LAST_PRICE_TRADED'],
            exBestOffersOverrides: { bestPricesDepth: 1 },
          },
        }
        const r = await fetch(`${BF_URL}/listMarketBook/`, { method:'POST', headers, body: JSON.stringify(body) })
        const data = await r.json()
        const market = data?.[0]
        if (!market) return res.status(404).json({ error: 'Mercato non trovato' })

        // runners: [0]=home, [1]=draw, [2]=away (standard Betfair soccer)
        const runners = market.runners || []
        const results = ['home', 'draw', 'away']
        const analysis = runners.slice(0,3).map((runner, i) => {
          const outcome = results[i]
          const betfairOdds = runner.ex?.availableToBack?.[0]?.price || runner.lastPriceTraded
          const betfairProb = betfairOdds ? Math.round((1/betfairOdds)*1000)/10 : null
          const modelProb = poissonProbs[outcome]
          const value = modelProb && betfairProb ? Math.round((modelProb - betfairProb)*10)/10 : null

          return {
            outcome,
            betfairOdds,
            betfairProb,
            modelProb,
            value, // positivo = value bet (modello più ottimista del mercato)
            signal: value > 3 ? 'FORTE' : value > 1 ? 'LIEVE' : value < -3 ? 'CONTRO' : 'NEUTRO',
            totalMatched: runner.totalMatched,
          }
        })

        const bestValue = analysis.reduce((best, a) => (a.value || 0) > (best.value || 0) ? a : best, analysis[0])

        return res.status(200).json({
          marketId,
          totalMatched: market.totalMatched,
          analysis,
          bestValue,
          marketSignal: bestValue.value > 3 ? 'VALUE_CONFERMATO' : bestValue.value > 1 ? 'VALUE_LIEVE' : 'NESSUN_VALUE',
        })
      }

      default:
        return res.status(400).json({ error: `Azione non riconosciuta: ${action}` })
    }
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
