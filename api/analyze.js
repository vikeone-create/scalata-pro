// api/analyze.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY mancante' })

  const { matches, scalataType, capitale, obiettivo } = req.body
  if (!matches?.length) return res.status(400).json({ error: 'matches richiesti' })

  const TYPES = {
    aggressiva: { label: 'Aggressiva', quotaMin: 2.3, quotaMax: 3.5 },
    normale:    { label: 'Normale',    quotaMin: 1.6, quotaMax: 2.2 },
    sicura:     { label: 'Sicura',     quotaMin: 1.1, quotaMax: 1.5 },
  }
  const cfg = TYPES[scalataType]

  const matchList = matches.slice(0, 15).map((m, i) =>
    `${i+1}. ${m.home} vs ${m.away} | Esito: ${m.esito} | Quota: ${m.quota} | ${m.bookmaker} | ${new Date(m.commence).toLocaleDateString('it-IT')}`
  ).join('\n')

  const prompt = `Sei un analista sportivo esperto. Analizza queste partite per una scalata betting ${cfg.label} (quote ${cfg.quotaMin}-${cfg.quotaMax}) con capitale €${capitale} e obiettivo €${obiettivo}. Scopo puramente educativo.

PARTITE DISPONIBILI:
${matchList}

Cerca informazioni recenti su ciascuna partita (infortuni, forma, statistiche). Seleziona le 3 MIGLIORI in base a affidabilità, valore della quota e adeguatezza alla scalata.

Rispondi SOLO con questo JSON, nessun testo extra:
{
  "partite_consigliate": [
    {
      "index": <numero 1-based dalla lista>,
      "rating": <1-10>,
      "verdetto": "<OTTIMA|BUONA|ACCETTABILE>",
      "probabilita_stimata": <0-100>,
      "value_bet": <true|false>,
      "forma_casa": "<V-P-V-P-V>",
      "forma_trasferta": "<V-P-V-P-V>",
      "motivo_principale": "<1 frase concisa sul perché consigliarla>",
      "rischio_principale": "<1 frase sul rischio chiave>",
      "notizie": "<aggiornamento recente rilevante in 1 frase>"
    }
  ]
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1500,

        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Errore Anthropic' })

    const textBlocks = data.content?.filter(b => b.type === 'text') || []
    const lastText = textBlocks[textBlocks.length - 1]?.text || ''
    const jsonMatch = lastText.replace(/```json|```/g, '').match(/\{[\s\S]*\}/)
    if (!jsonMatch) return res.status(500).json({ error: 'Nessun JSON nella risposta' })

    const result = JSON.parse(jsonMatch[0])
    // Attach full match data to each recommendation
    result.partite_consigliate = result.partite_consigliate.map(p => ({
      ...p,
      match: matches[p.index - 1],
    }))

    return res.status(200).json(result)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
