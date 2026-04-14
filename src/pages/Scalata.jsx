import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { T, GLOBAL_CSS } from '../theme'

const SPORTS = [
  { key: 'soccer_italy_serie_a',        label: '🇮🇹 Serie A' },
  { key: 'soccer_epl',                   label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League' },
  { key: 'soccer_spain_la_liga',         label: '🇪🇸 La Liga' },
  { key: 'soccer_germany_bundesliga',    label: '🇩🇪 Bundesliga' },
  { key: 'soccer_uefa_champs_league',    label: '🏆 Champions League' },
]
const N_GIOCATE = [3, 5, 8, 12]

function calcQuotaMedia(c, o, n) { return Math.pow(o / c, 1 / n) }
function classificaTipo(q) {
  if (q >= 2.3) return { tipo: 'aggressiva', label: 'Aggressiva', tag: 'ALTO RISCHIO', color: T.red }
  if (q >= 1.6) return { tipo: 'normale',    label: 'Normale',    tag: 'BILANCIATA',  color: T.gold }
  if (q >= 1.3) return { tipo: 'sicura',     label: 'Sicura',     tag: 'BASSO RISCHIO', color: T.green }
  return               { tipo: 'molto_sicura', label: 'Molto sicura', tag: 'MOLTO SICURA', color: T.green }
}
function rangeQuote(q) {
  const s = q < 1.5 ? 0.15 : q < 2.0 ? 0.3 : 0.5
  return { min: Math.max(1.05, +(q - s).toFixed(2)), max: +(q + s).toFixed(2) }
}
function calcScalata(capitale, obiettivo, quotaMedia) {
  const steps = [], profitTarget = obiettivo - capitale
  let profitoCumulato = 0, bankroll = capitale
  for (let i = 0; i < 25; i++) {
    let importo = Math.ceil(((profitTarget - profitoCumulato) / (quotaMedia - 1)) * 100) / 100
    if (importo <= 0) break
    if (importo > bankroll) importo = bankroll
    const vincita = +(importo * quotaMedia).toFixed(2)
    profitoCumulato += vincita - importo
    steps.push({ step: i + 1, importo: +importo.toFixed(2), quota: +quotaMedia.toFixed(2), vincita, profitoPrevisto: +profitoCumulato.toFixed(2), bankrollSeVince: +(bankroll - importo + vincita).toFixed(2), bankrollSePerde: +(bankroll - importo).toFixed(2), done: false, esito: null })
    if (profitoCumulato >= profitTarget) break
  }
  return steps
}

const fmt = n => `€${Number(n).toFixed(2)}`
const fmtDate = d => new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

async function loadData(userId) {
  const { data } = await supabase.from('user_data').select('*').eq('user_id', userId).single()
  return data
}
async function saveData(userId, patch) {
  await supabase.from('user_data').upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
}

function Spinner({ msg }) {
  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, padding: 24 }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${T.cyan}18`, borderTop: `2px solid ${T.cyan}`, animation: 'spin 1s linear infinite' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ ...T.orb, fontSize: 16, color: T.text, marginBottom: 8 }}>Preparando la scalata</div>
        <div style={{ ...T.sg, fontSize: 13, color: 'rgba(245,240,232,0.35)' }}>{msg}</div>
      </div>
    </div>
  )
}

export default function Scalata({ session }) {
  const userId = session?.user?.id
  const [fase, setFase]           = useState('setup')
  const [capitale, setCapitale]   = useState('')
  const [obiettivo, setObiettivo] = useState('')
  const [nGiocate, setNGiocate]   = useState(null)
  const [sport, setSport]         = useState('soccer_italy_serie_a')
  const [scalataAttiva, setScalataAttiva] = useState(null)
  const [partiteConsigliate, setPartiteConsigliate] = useState([])
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError]         = useState(null)
  const [selectedForStep, setSelectedForStep] = useState({})

  useEffect(() => {
    if (!userId) return
    loadData(userId).then(d => {
      if (d?.scalata_attiva) {
        setScalataAttiva(d.scalata_attiva)
        if (d.scalata_attiva.partiteConsigliate) setPartiteConsigliate(d.scalata_attiva.partiteConsigliate)
        setFase('scalata')
      }
    })
  }, [userId])

  const persist = patch => saveData(userId, patch)
  const cap = Number(capitale), obj = Number(obiettivo)
  const isValido = cap >= 1 && obj > cap && nGiocate !== null
  const opzioni = N_GIOCATE.map(n => {
    const quota = calcQuotaMedia(cap || 1, obj || 2, n)
    return { n, quota, tipo: classificaTipo(quota), range: rangeQuote(quota) }
  })

  const avvia = async () => {
    if (!isValido) return
    setError(null); setFase('caricamento')
    const opz = opzioni.find(o => o.n === nGiocate)
    try {
      const quotaMedia = +opz.quota.toFixed(2)
      setLoadingMsg('Raccolta quote live...')
      const oddsRes = await fetch(`/api/odds?sport=${sport}&quotaMin=${opz.range.min}&quotaMax=${opz.range.max}`)
      const odds = await oddsRes.json()
      if (!odds?.length) throw new Error('Nessuna partita disponibile. Prova un campionato o numero giocate diverso.')
      setLoadingMsg('Analisi AI delle partite...')
      const aiRes = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches: odds, scalataType: opz.tipo.tipo, capitale: cap, obiettivo: obj }),
      })
      const aiData = await aiRes.json()
      if (!aiRes.ok) throw new Error(aiData.error || 'Errore analisi AI')
      const scalata = {
        id: Date.now(), tipo: opz.tipo.tipo, tipoLabel: opz.tipo.label,
        capitale: cap, obiettivo: obj, nGiocate, quotaMedia,
        profitTarget: obj - cap,
        steps: calcScalata(cap, obj, quotaMedia),
        stepCorrente: 0, bankrollCorrente: cap,
        createdAt: new Date().toISOString(), status: 'attiva',
        partiteConsigliate: aiData.partite_consigliate || [], sport,
      }
      setScalataAttiva(scalata); setPartiteConsigliate(aiData.partite_consigliate || [])
      persist({ scalata_attiva: scalata }); setFase('scalata')
    } catch(e) { setError(e.message); setFase('setup') }
    setLoadingMsg('')
  }

  const registraEsito = (stepIndex, esito, matchUsato) => {
    const steps = scalataAttiva.steps.map((s, i) => i === stepIndex ? { ...s, done: true, esito, timestamp: new Date().toISOString(), matchUsato } : s)
    const step = steps[stepIndex]
    const bankrollCorrente = esito === 'vinto' ? step.bankrollSeVince : step.bankrollSePerde
    const stepCorrente = stepIndex + 1
    let status = 'attiva'
    if (esito === 'vinto' && bankrollCorrente >= scalataAttiva.obiettivo) status = 'completata'
    else if (esito === 'perso' && (bankrollCorrente <= 0 || stepCorrente >= steps.length)) status = 'fallita'
    const updated = { ...scalataAttiva, steps, stepCorrente, bankrollCorrente, status }
    setScalataAttiva(updated); persist({ scalata_attiva: updated })
    if (status !== 'attiva') {
      const closed = { ...updated, closedAt: new Date().toISOString() }
      loadData(userId).then(d => {
        persist({ storico: [closed, ...(d?.storico || [])].slice(0, 100), scalata_attiva: null })
      })
      setTimeout(() => { setScalataAttiva(null); setPartiteConsigliate([]); setFase('setup'); setNGiocate(null); setCapitale(''); setObiettivo('') }, 1200)
    }
  }

  const abbandonaScalata = async () => {
    if (!confirm('Abbandonare la scalata?')) return
    const closed = { ...scalataAttiva, status: 'abbandonata', closedAt: new Date().toISOString() }
    const d = await loadData(userId)
    persist({ storico: [closed, ...(d?.storico || [])].slice(0, 100), scalata_attiva: null })
    setScalataAttiva(null); setPartiteConsigliate([]); setFase('setup'); setNGiocate(null); setCapitale(''); setObiettivo('')
  }

  const stepIdx = scalataAttiva?.stepCorrente || 0
  const stepCorrente = scalataAttiva?.steps?.[stepIdx]
  const profitPct = scalataAttiva ? Math.min(100, Math.max(0, ((scalataAttiva.bankrollCorrente - scalataAttiva.capitale) / (scalataAttiva.obiettivo - scalataAttiva.capitale)) * 100)) : 0

  if (fase === 'caricamento') return <Spinner msg={loadingMsg} />

  // ── SETUP ──
  if (fase === 'setup') return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <style>{GLOBAL_CSS}</style>
      {/* Ambient glows */}
      <div style={{ position: 'fixed', top: 0, right: 0, width: 250, height: 250, background: `radial-gradient(circle, ${T.cyan}0a 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '20%', left: 0, width: 200, height: 200, background: `radial-gradient(circle, ${T.purple}08 0%, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={T.page}>
        <div style={{ marginBottom: 28, animation: 'fadeUp 0.3s ease' }}>
          <div style={{ ...T.orb, fontSize: 26, fontWeight: 700, letterSpacing: 2 }}>
            <span style={{ color: T.text }}>SCALATA</span>
            <span style={{ background: `linear-gradient(135deg, ${T.cyan}, ${T.purple})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PRO</span>
          </div>
          <div style={{ ...T.sg, fontSize: 12, color: 'rgba(245,240,232,0.25)', marginTop: 4 }}>Imposta la tua scalata</div>
        </div>

        {scalataAttiva && (
          <div style={{ ...T.cardGlow(T.cyan), padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...T.sg, fontSize: 12, color: T.cyan }}>Hai una scalata in corso</span>
            <button onClick={() => setFase('scalata')} style={{ background: `${T.cyan}18`, border: `1px solid ${T.cyan}40`, borderRadius: 8, color: T.cyan, ...T.sg, fontSize: 11, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>Vai →</button>
          </div>
        )}

        {/* Capitale */}
        <div style={{ marginBottom: 16 }}>
          <div style={T.label}>Capitale iniziale (€)</div>
          <input type="number" value={capitale} min={1} onChange={e => setCapitale(e.target.value)} placeholder="Es. 100"
            style={{ ...T.input, ...T.orb, fontSize: 28, padding: '14px 18px' }} />
        </div>

        {/* Obiettivo */}
        <div style={{ marginBottom: 20 }}>
          <div style={T.label}>Obiettivo (€)</div>
          <input type="number" value={obiettivo} min={cap + 1} onChange={e => setObiettivo(e.target.value)} placeholder="Es. 300"
            style={{ ...T.input, ...T.orb, fontSize: 28, padding: '14px 18px' }} />
          {cap > 0 && obj > cap && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              {[{ l: 'Profitto', v: fmt(obj - cap), c: T.green }, { l: 'ROI', v: `${Math.round((obj - cap) / cap * 100)}%`, c: T.cyan }].map(s => (
                <div key={s.l} style={{ ...T.card, padding: '10px', textAlign: 'center' }}>
                  <div style={{ ...T.orb, fontSize: 16, color: s.c }}>{s.v}</div>
                  <div style={{ ...T.label, marginBottom: 0, marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Numero giocate */}
        {cap > 0 && obj > cap && (
          <div style={{ marginBottom: 20 }}>
            <div style={T.label}>Numero di giocate</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {opzioni.map(({ n, quota, tipo, range }) => {
                const sel = nGiocate === n
                return (
                  <button key={n} onClick={() => setNGiocate(n)}
                    style={{ width: '100%', padding: '14px 16px', border: `1px solid ${sel ? tipo.color + '55' : 'rgba(255,255,255,0.07)'}`, borderRadius: 14, background: sel ? `${tipo.color}0a` : 'rgba(255,255,255,0.02)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.15s', fontFamily: 'inherit', boxShadow: sel ? `0 0 16px ${tipo.color}12` : 'none' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ ...T.sg, fontSize: 15, fontWeight: 600, color: sel ? T.text : 'rgba(245,240,232,0.5)' }}>{n} giocate</div>
                      <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.28)', marginTop: 2 }}>Quota ~{quota.toFixed(2)} · {tipo.label} · {range.min}–{range.max}</div>
                    </div>
                    <div style={{ ...T.sg, fontSize: 9, padding: '3px 10px', borderRadius: 99, background: `${tipo.color}18`, border: `1px solid ${tipo.color}40`, color: tipo.color, fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>{tipo.tag}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Campionato */}
        {isValido && (
          <div style={{ marginBottom: 20 }}>
            <div style={T.label}>Campionato</div>
            <select value={sport} onChange={e => setSport(e.target.value)}
              style={{ ...T.input, fontSize: 14 }}>
              {SPORTS.map(s => <option key={s.key} value={s.key} style={{ background: T.bg }}>{s.label}</option>)}
            </select>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', background: `${T.red}08`, border: `1px solid ${T.red}30`, borderRadius: 12, ...T.sg, fontSize: 13, color: T.red, marginBottom: 16, lineHeight: 1.6 }}>{error}</div>
        )}

        <button onClick={avvia} disabled={!isValido} style={{ ...T.btn, opacity: isValido ? 1 : 0.3, cursor: isValido ? 'pointer' : 'not-allowed' }}>
          ANALIZZA E AVVIA →
        </button>

        <div style={{ marginTop: 14, ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.12)', textAlign: 'center', lineHeight: 2 }}>
          Solo uso educativo · Non costituisce invito al gioco<br />Il gioco d'azzardo può creare dipendenza
        </div>
      </div>
    </div>
  )

  // ── SCALATA ATTIVA ──
  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <style>{GLOBAL_CSS}</style>
      <div style={T.page}>

        {/* Hero bankroll */}
        <div style={{ ...T.card, padding: '20px', marginBottom: 22, animation: 'fadeUp 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={T.label}>Bankroll</div>
              <div style={{ ...T.orb, fontSize: 36, fontWeight: 900, background: `linear-gradient(135deg, ${T.cyan}, ${T.purple})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
                {fmt(scalataAttiva.bankrollCorrente)}
              </div>
              <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.25)', marginTop: 5 }}>
                Obiettivo {fmt(scalataAttiva.obiettivo)} · {scalataAttiva.nGiocate} giocate · {scalataAttiva.tipoLabel}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={T.label}>STEP</div>
              <div style={{ ...T.orb, fontSize: 30, color: T.cyan }}>{stepIdx + 1}<span style={{ fontSize: 14, color: 'rgba(245,240,232,0.2)' }}>/{scalataAttiva.steps.length}</span></div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 99, height: 4 }}>
            <div style={{ height: '100%', borderRadius: 99, width: `${profitPct}%`, background: `linear-gradient(90deg, ${T.cyan}, ${T.purple})`, transition: 'width 0.5s ease', boxShadow: `0 0 8px ${T.cyan}` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ ...T.sg, fontSize: 9, color: 'rgba(245,240,232,0.18)' }}>{fmt(scalataAttiva.capitale)}</span>
            <span style={{ ...T.sg, fontSize: 9, color: 'rgba(245,240,232,0.3)' }}>{Math.round(profitPct)}%</span>
            <span style={{ ...T.sg, fontSize: 9, color: 'rgba(245,240,232,0.18)' }}>{fmt(scalataAttiva.obiettivo)}</span>
          </div>
        </div>

        {/* Step corrente */}
        {stepCorrente && !stepCorrente.done && (
          <div style={{ marginBottom: 22 }}>
            <div style={T.label}>Prossima giocata</div>
            <div style={{ ...T.cardGlow(T.cyan), padding: '16px 18px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ ...T.orb, fontSize: 28, color: T.text }}>{fmt(stepCorrente.importo)}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.3)' }}>Vincita potenziale</div>
                  <div style={{ ...T.orb, fontSize: 18, color: T.green }}>{fmt(stepCorrente.vincita)}</div>
                </div>
              </div>
              <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.3)' }}>
                Quota {stepCorrente.quota} · ▲ {fmt(stepCorrente.bankrollSeVince)} · ▼ {fmt(stepCorrente.bankrollSePerde)}
              </div>
            </div>

            {/* Partite AI */}
            {partiteConsigliate.length > 0 && (
              <>
                <div style={T.label}>Partite consigliate dall'AI</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {partiteConsigliate.map((p, i) => {
                    const isSel = selectedForStep[stepIdx]?.index === p.index
                    const vc = { OTTIMA: T.green, BUONA: T.cyan, ACCETTABILE: T.gold }[p.verdetto] || 'rgba(245,240,232,0.3)'
                    return (
                      <div key={i} onClick={() => setSelectedForStep(prev => ({ ...prev, [stepIdx]: isSel ? null : p }))}
                        style={{ padding: '14px 16px', background: isSel ? `${T.cyan}07` : 'rgba(255,255,255,0.02)', border: `1px solid ${isSel ? T.cyan + '40' : 'rgba(255,255,255,0.07)'}`, borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s', boxShadow: isSel ? `0 0 16px ${T.cyan}08` : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                            <div style={{ ...T.sg, fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.match?.home} <span style={{ color: 'rgba(245,240,232,0.25)' }}>vs</span> {p.match?.away}
                            </div>
                            <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.3)', marginTop: 2 }}>
                              {p.match?.esito} · {p.match?.bookmaker} · {p.match?.commence ? fmtDate(p.match.commence) : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                            <div style={{ ...T.orb, fontSize: 18, color: T.cyan }}>{p.match?.quota}</div>
                            <div style={{ ...T.sg, fontSize: 8, padding: '2px 8px', borderRadius: 99, background: `${vc}18`, border: `1px solid ${vc}40`, color: vc, fontWeight: 700, letterSpacing: 1 }}>{p.verdetto}</div>
                          </div>
                        </div>
                        {(p.forma_casa || p.forma_trasferta) && (
                          <div style={{ display: 'flex', gap: 10, marginBottom: 7, flexWrap: 'wrap' }}>
                            {[{ label: p.match?.home?.split(' ')[0], forma: p.forma_casa }, { label: p.match?.away?.split(' ')[0], forma: p.forma_trasferta }].map(({ label, forma }) => forma && (
                              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.3)' }}>{label}</span>
                                <div style={{ display: 'flex', gap: 2 }}>
                                  {forma.split('-').map((r, j) => (
                                    <div key={j} style={{ width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, background: r === 'V' ? 'rgba(0,255,150,0.15)' : r === 'P' ? 'rgba(255,68,68,0.15)' : 'rgba(201,168,76,0.15)', color: r === 'V' ? T.green : r === 'P' ? T.red : T.gold }}>{r}</div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.5)', lineHeight: 1.5 }}>
                          <span style={{ color: T.green }}>✓</span> {p.motivo_principale}
                        </div>
                        {p.rischio_principale && <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.3)', marginTop: 3 }}><span style={{ color: T.red }}>⚠</span> {p.rischio_principale}</div>}
                        {p.notizie && <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.25)', marginTop: 4 }}>📰 {p.notizie}</div>}
                        {p.value_bet && <div style={{ ...T.sg, fontSize: 10, color: T.green, marginTop: 4 }}>✨ Value bet</div>}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Vinto / Perso */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => registraEsito(stepIdx, 'vinto', selectedForStep[stepIdx]?.match)}
                style={{ padding: '14px', background: `${T.green}0a`, border: `1px solid ${T.green}30`, borderRadius: 14, color: T.green, ...T.sg, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: `0 0 16px ${T.green}10` }}>✓ Vinto</button>
              <button onClick={() => registraEsito(stepIdx, 'perso', selectedForStep[stepIdx]?.match)}
                style={{ padding: '14px', background: `${T.red}0a`, border: `1px solid ${T.red}30`, borderRadius: 14, color: T.red, ...T.sg, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✗ Perso</button>
            </div>
          </div>
        )}

        {/* Step completati */}
        {scalataAttiva.steps.filter(s => s.done).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={T.label}>Step completati</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {scalataAttiva.steps.filter(s => s.done).map((step, i) => (
                <div key={i} style={{ padding: '12px 16px', background: step.esito === 'vinto' ? `${T.green}05` : `${T.red}05`, border: `1px solid ${step.esito === 'vinto' ? T.green + '20' : T.red + '20'}`, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ ...T.sg, fontSize: 13, color: 'rgba(245,240,232,0.65)' }}>
                      <span style={{ color: step.esito === 'vinto' ? T.green : T.red, marginRight: 8 }}>{step.esito === 'vinto' ? '✓' : '✗'}</span>
                      Step {step.step} · {fmt(step.importo)}
                    </div>
                    {step.matchUsato && <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.25)', marginTop: 2 }}>{step.matchUsato.home} vs {step.matchUsato.away}</div>}
                  </div>
                  <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.25)' }}>{step.timestamp ? new Date(step.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={abbandonaScalata} style={{ width: '100%', padding: '12px', background: 'transparent', border: `1px solid ${T.red}20`, borderRadius: 12, color: `${T.red}50`, ...T.sg, fontSize: 11, cursor: 'pointer', letterSpacing: 2 }}>
          ABBANDONA SCALATA
        </button>
      </div>
    </div>
  )
}
