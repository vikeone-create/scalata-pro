import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const SPORTS = [
  { key: 'soccer_italy_serie_a', label: 'Serie A' },
  { key: 'soccer_epl', label: 'Premier League' },
  { key: 'soccer_spain_la_liga', label: 'La Liga' },
  { key: 'soccer_germany_bundesliga', label: 'Bundesliga' },
  { key: 'soccer_uefa_champs_league', label: 'Champions League' },
]

const PROFILI = [
  { id: 'x2', label: 'Raddoppia', desc: 'Obiettivo ×2', mult: 2, tipo: 'sicura', quotaMin: 1.1, quotaMax: 1.5, icon: '×2' },
  { id: 'x3', label: 'Triplica', desc: 'Obiettivo ×3', mult: 3, tipo: 'normale', quotaMin: 1.6, quotaMax: 2.2, icon: '×3' },
  { id: 'x5', label: 'Quintuplica', desc: 'Obiettivo ×5', mult: 5, tipo: 'aggressiva', quotaMin: 2.3, quotaMax: 3.5, icon: '×5' },
]

function calcScalata(capitale, obiettivo, quotaMedia) {
  const steps = [], profitTarget = obiettivo - capitale
  let profitoCumulato = 0, bankroll = capitale
  for (let i = 0; i < 25; i++) {
    let importo = Math.ceil(((profitTarget - profitoCumulato) / (quotaMedia - 1)) * 100) / 100
    if (importo <= 0) break
    if (importo > bankroll) importo = bankroll
    const vincita = +(importo * quotaMedia).toFixed(2)
    profitoCumulato += vincita - importo
    steps.push({ step:i+1, importo:+importo.toFixed(2), quota:quotaMedia, vincita, profitoPrevisto:+profitoCumulato.toFixed(2), bankrollSeVince:+(bankroll-importo+vincita).toFixed(2), bankrollSePerde:+(bankroll-importo).toFixed(2), done:false, esito:null })
    if (profitoCumulato >= profitTarget) break
  }
  return steps
}

const fmt = n => `€${Number(n).toFixed(2)}`
const fmtDate = d => new Date(d).toLocaleDateString('it-IT', { weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })

const verdettoBg = v => ({ OTTIMA:'#86efac', BUONA:'#f59e0b', ACCETTABILE:'#fb923c' }[v] || '#888')

async function loadData(userId) {
  const { data } = await supabase.from('user_data').select('*').eq('user_id', userId).single()
  return data
}
async function saveData(userId, patch) {
  await supabase.from('user_data').upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
}

// ── UI atoms
const C = {
  page: { maxWidth:480, margin:'0 auto', padding:'24px 16px' },
  h: { fontFamily:'DM Serif Display,serif' },
  card: (border) => ({ background:'rgba(255,255,255,0.03)', border:`1px solid ${border||'rgba(255,255,255,0.07)'}`, borderRadius:16, overflow:'hidden' }),
  label: { fontSize:10, color:'rgba(245,240,232,0.35)', letterSpacing:3, textTransform:'uppercase', marginBottom:8 },
  gold: '#c9a84c',
}

export default function Scalata({ session }) {
  const userId = session?.user?.id

  // State
  const [fase, setFase] = useState('setup') // setup | caricamento | scalata
  const [profilo, setProfilo] = useState(null)
  const [capitale, setCapitale] = useState('')
  const [sport, setSport] = useState('soccer_italy_serie_a')
  const [scalataAttiva, setScalataAttiva] = useState(null)
  const [partiteConsigliate, setPartiteConsigliate] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState(null)
  const [selectedForStep, setSelectedForStep] = useState({})

  // Load from Supabase
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

  const persist = (patch) => saveData(userId, patch)

  const avvia = async () => {
    if (!profilo || !capitale || Number(capitale) < 1) return setError('Inserisci un capitale valido')
    setError(null)
    setLoading(true)
    setFase('caricamento')

    try {
      const p = PROFILI.find(x => x.id === profilo)
      const obiettivo = Number(capitale) * p.mult
      const quotaMedia = +((p.quotaMin + p.quotaMax) / 2).toFixed(2)

      // 1. Fetch odds
      setLoadingMsg('Raccolta quote live...')
      const oddsRes = await fetch(`/api/odds?sport=${sport}&quotaMin=${p.quotaMin}&quotaMax=${p.quotaMax}`)
      const odds = await oddsRes.json()
      if (!odds?.length) throw new Error('Nessuna partita disponibile per questo profilo. Prova un altro campionato o torna più tardi.')

      // 2. AI analysis
      setLoadingMsg('Analisi AI delle partite...')
      const aiRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches: odds, scalataType: p.tipo, capitale: Number(capitale), obiettivo }),
      })
      const aiData = await aiRes.json()
      if (!aiRes.ok) throw new Error(aiData.error || 'Errore analisi AI')

      const consigliate = aiData.partite_consigliate || []

      // 3. Build scalata
      const scalata = {
        id: Date.now(),
        profilo: p.id,
        tipo: p.tipo,
        capitale: Number(capitale),
        obiettivo,
        quotaMedia,
        steps: calcScalata(Number(capitale), obiettivo, quotaMedia),
        stepCorrente: 0,
        bankrollCorrente: Number(capitale),
        createdAt: new Date().toISOString(),
        status: 'attiva',
        partiteConsigliate: consigliate,
        sport,
      }

      setScalataAttiva(scalata)
      setPartiteConsigliate(consigliate)
      persist({ scalata_attiva: scalata })
      setFase('scalata')
    } catch(e) {
      setError(e.message)
      setFase('setup')
    }
    setLoading(false)
    setLoadingMsg('')
  }

  const registraEsito = (stepIndex, esito, matchUsato) => {
    const steps = scalataAttiva.steps.map((s, i) =>
      i === stepIndex ? { ...s, done:true, esito, timestamp:new Date().toISOString(), matchUsato } : s
    )
    const step = steps[stepIndex]
    const bankrollCorrente = esito === 'vinto' ? step.bankrollSeVince : step.bankrollSePerde
    const stepCorrente = stepIndex + 1
    let status = 'attiva'
    if (esito === 'vinto' && step.profitoPrevisto >= scalataAttiva.profitTarget || (esito === 'vinto' && bankrollCorrente >= scalataAttiva.obiettivo)) status = 'completata'
    else if (esito === 'perso' && (bankrollCorrente <= 0 || stepCorrente >= steps.length)) status = 'fallita'

    const updated = { ...scalataAttiva, steps, stepCorrente, bankrollCorrente, status }
    setScalataAttiva(updated)
    persist({ scalata_attiva: updated })

    if (status !== 'attiva') {
      const closed = { ...updated, closedAt: new Date().toISOString() }
      // Move to storico
      loadData(userId).then(d => {
        const storico = d?.storico || []
        const ns = [closed, ...storico].slice(0, 100)
        persist({ storico: ns, scalata_attiva: null })
      })
      setTimeout(() => { setScalataAttiva(null); setPartiteConsigliate([]); setFase('setup'); setProfilo(null); setCapitale('') }, 1200)
    }
  }

  const abbandonaScalata = async () => {
    if (!confirm('Abbandonare la scalata?')) return
    const closed = { ...scalataAttiva, status:'abbandonata', closedAt:new Date().toISOString() }
    const d = await loadData(userId)
    const storico = d?.storico || []
    const ns = [closed, ...storico].slice(0, 100)
    persist({ storico: ns, scalata_attiva: null })
    setScalataAttiva(null); setPartiteConsigliate([]); setFase('setup'); setProfilo(null); setCapitale('')
  }

  const profCorrente = PROFILI.find(x => x.id === scalataAttiva?.profilo)
  const stepIdx = scalataAttiva?.stepCorrente || 0
  const stepCorrente = scalataAttiva?.steps?.[stepIdx]
  const profitPct = scalataAttiva ? Math.min(100, Math.max(0, ((scalataAttiva.bankrollCorrente - scalataAttiva.capitale) / (scalataAttiva.obiettivo - scalataAttiva.capitale)) * 100)) : 0

  // ── FASE CARICAMENTO
  if (fase === 'caricamento') return (
    <div style={{ minHeight:'100vh', background:'#0c0c0c', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:24, padding:24 }}>
      <div style={{ width:60, height:60, borderRadius:'50%', border:'2px solid rgba(201,168,76,0.2)', borderTop:`2px solid ${C.gold}`, animation:'spin 1s linear infinite' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'DM Serif Display,serif', fontSize:20, color:'#f5f0e8', marginBottom:8 }}>Preparando la scalata</div>
        <div style={{ fontSize:13, color:'rgba(245,240,232,0.4)' }}>{loadingMsg}</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── FASE SETUP
  if (fase === 'setup') return (
    <div style={{ minHeight:'100vh', background:'#0c0c0c' }}>
      <div style={C.page}>
        {/* Header */}
        <div style={{ marginBottom:32 }}>
          <div style={{ ...C.h, fontSize:28, color:'#f5f0e8', fontWeight:400, letterSpacing:0.5 }}>
            Scalata<span style={{ color:C.gold }}>Pro</span>
          </div>
          <div style={{ fontSize:12, color:'rgba(245,240,232,0.3)', marginTop:4 }}>Scegli il tuo profilo e inizia</div>
        </div>

        {/* Profili */}
        <div style={{ marginBottom:28 }}>
          <div style={C.label}>Profilo di gioco</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {PROFILI.map(p => (
              <button key={p.id} onClick={() => setProfilo(p.id)} style={{ width:'100%', padding:'16px 20px', border:`1px solid ${profilo===p.id ? C.gold+'88' : 'rgba(255,255,255,0.07)'}`, borderRadius:14, background: profilo===p.id ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all 0.15s' }}>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontSize:15, fontWeight:600, color: profilo===p.id ? '#f5f0e8' : 'rgba(245,240,232,0.6)', fontFamily:'DM Sans,sans-serif' }}>{p.label}</div>
                  <div style={{ fontSize:11, color:'rgba(245,240,232,0.3)', marginTop:2 }}>{p.desc} · Quote {p.quotaMin}–{p.quotaMax}</div>
                </div>
                <div style={{ fontSize:24, fontWeight:700, color: profilo===p.id ? C.gold : 'rgba(245,240,232,0.2)', fontFamily:'DM Serif Display,serif' }}>{p.icon}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Capitale */}
        <div style={{ marginBottom:20 }}>
          <div style={C.label}>Capitale iniziale (€)</div>
          <input
            type="number" value={capitale} min={1}
            onChange={e => setCapitale(e.target.value)}
            placeholder="Es. 50"
            style={{ width:'100%', padding:'16px 18px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, color:'#f5f0e8', fontSize:24, fontFamily:'DM Serif Display,serif', boxSizing:'border-box', outline:'none' }}
          />
          {profilo && capitale && Number(capitale) > 0 && (
            <div style={{ marginTop:10, display:'flex', gap:8 }}>
              {[
                { l:'Obiettivo', v:fmt(Number(capitale) * PROFILI.find(x=>x.id===profilo).mult), c:C.gold },
                { l:'Profitto', v:fmt(Number(capitale) * (PROFILI.find(x=>x.id===profilo).mult - 1)), c:'#86efac' },
              ].map(s => (
                <div key={s.l} style={{ flex:1, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'10px', textAlign:'center' }}>
                  <div style={{ fontSize:16, fontWeight:600, color:s.c, fontFamily:'DM Serif Display,serif' }}>{s.v}</div>
                  <div style={{ fontSize:9, color:'rgba(245,240,232,0.3)', letterSpacing:2, marginTop:2, textTransform:'uppercase' }}>{s.l}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Campionato */}
        <div style={{ marginBottom:28 }}>
          <div style={C.label}>Campionato</div>
          <select value={sport} onChange={e => setSport(e.target.value)} style={{ width:'100%', padding:'13px 16px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, color:'#f5f0e8', fontSize:14, fontFamily:'DM Sans,sans-serif', outline:'none' }}>
            {SPORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        {error && (
          <div style={{ padding:'12px 16px', background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:12, fontSize:13, color:'#f87171', marginBottom:16, lineHeight:1.6 }}>
            {error}
          </div>
        )}

        <button
          onClick={avvia}
          disabled={!profilo || !capitale || Number(capitale) < 1 || loading}
          style={{ width:'100%', padding:'16px', borderRadius:16, border:`1px solid ${C.gold}55`, background: profilo && capitale ? `rgba(201,168,76,0.15)` : 'rgba(255,255,255,0.03)', color: profilo && capitale ? '#f5f0e8' : 'rgba(245,240,232,0.2)', fontSize:14, fontWeight:600, cursor: profilo && capitale ? 'pointer' : 'not-allowed', fontFamily:'DM Sans,sans-serif', letterSpacing:1.5, transition:'all 0.2s', boxShadow: profilo && capitale ? '0 0 30px rgba(201,168,76,0.15)' : 'none' }}
        >
          ANALIZZA E AVVIA →
        </button>

        <div style={{ marginTop:16, fontSize:10, color:'rgba(245,240,232,0.15)', textAlign:'center', lineHeight:2 }}>
          ⚠️ Solo uso educativo · Non costituisce invito al gioco<br/>Il gioco d'azzardo può creare dipendenza
        </div>
      </div>
    </div>
  )

  // ── FASE SCALATA ATTIVA
  return (
    <div style={{ minHeight:'100vh', background:'#0c0c0c' }}>
      <div style={C.page}>
        {/* Hero bankroll */}
        <div style={{ marginBottom:24, padding:'22px 20px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
            <div>
              <div style={{ fontSize:11, color:'rgba(245,240,232,0.3)', letterSpacing:3, textTransform:'uppercase', marginBottom:6 }}>Bankroll</div>
              <div style={{ ...C.h, fontSize:38, color:'#f5f0e8', lineHeight:1 }}>{fmt(scalataAttiva.bankrollCorrente)}</div>
              <div style={{ fontSize:12, color:'rgba(245,240,232,0.3)', marginTop:6 }}>
                Obiettivo {fmt(scalataAttiva.obiettivo)} · {profCorrente?.label}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, color:'rgba(245,240,232,0.3)', letterSpacing:2, marginBottom:4 }}>STEP</div>
              <div style={{ ...C.h, fontSize:32, color:C.gold }}>{stepIdx + 1}<span style={{ fontSize:16, color:'rgba(245,240,232,0.2)' }}>/{scalataAttiva.steps.length}</span></div>
            </div>
          </div>
          {/* Progress */}
          <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:99, height:4 }}>
            <div style={{ height:'100%', borderRadius:99, width:`${profitPct}%`, background:`linear-gradient(90deg,${C.gold},#f5f0e8)`, transition:'width 0.5s ease', boxShadow:`0 0 8px ${C.gold}55` }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
            <span style={{ fontSize:9, color:'rgba(245,240,232,0.2)' }}>{fmt(scalataAttiva.capitale)}</span>
            <span style={{ fontSize:9, color:'rgba(245,240,232,0.3)' }}>{Math.round(profitPct)}%</span>
            <span style={{ fontSize:9, color:'rgba(245,240,232,0.2)' }}>{fmt(scalataAttiva.obiettivo)}</span>
          </div>
        </div>

        {/* Step corrente */}
        {stepCorrente && !stepCorrente.done && (
          <div style={{ marginBottom:24 }}>
            <div style={C.label}>Prossima giocata</div>
            <div style={{ padding:'18px 20px', background:'rgba(201,168,76,0.06)', border:`1px solid ${C.gold}33`, borderRadius:16, marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <div style={{ ...C.h, fontSize:28, color:'#f5f0e8' }}>{fmt(stepCorrente.importo)}</div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'rgba(245,240,232,0.3)' }}>Potenziale vincita</div>
                  <div style={{ ...C.h, fontSize:20, color:'#86efac' }}>{fmt(stepCorrente.vincita)}</div>
                </div>
              </div>
              <div style={{ fontSize:11, color:'rgba(245,240,232,0.3)' }}>
                Quota media: {stepCorrente.quota} · ▲ {fmt(stepCorrente.bankrollSeVince)} · ▼ {fmt(stepCorrente.bankrollSePerde)}
              </div>
            </div>

            {/* Partite consigliate */}
            {partiteConsigliate.length > 0 && (
              <div>
                <div style={C.label}>Partite consigliate dall'AI</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                  {partiteConsigliate.map((p, i) => {
                    const isSelected = selectedForStep[stepIdx]?.index === p.index
                    const vc = verdettoBg(p.verdetto)
                    return (
                      <div key={i} onClick={() => setSelectedForStep(prev => ({ ...prev, [stepIdx]: isSelected ? null : p }))}
                        style={{ padding:'14px 16px', background: isSelected ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.03)', border:`1px solid ${isSelected ? C.gold+'55' : 'rgba(255,255,255,0.07)'}`, borderRadius:14, cursor:'pointer', transition:'all 0.15s' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:600, color:'#f5f0e8' }}>{p.match?.home} <span style={{ color:'rgba(245,240,232,0.3)' }}>vs</span> {p.match?.away}</div>
                            <div style={{ fontSize:11, color:'rgba(245,240,232,0.4)', marginTop:2 }}>
                              {p.match?.esito} · {p.match?.bookmaker} · {p.match?.commence ? fmtDate(p.match.commence) : ''}
                            </div>
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                            <div style={{ ...C.h, fontSize:20, color:C.gold }}>{p.match?.quota}</div>
                            <div style={{ fontSize:9, padding:'2px 8px', borderRadius:99, background:`${vc}22`, border:`1px solid ${vc}44`, color:vc, fontWeight:700, letterSpacing:1 }}>{p.verdetto}</div>
                          </div>
                        </div>
                        {/* Forma */}
                        {(p.forma_casa || p.forma_trasferta) && (
                          <div style={{ display:'flex', gap:12, marginBottom:8 }}>
                            {[{label:p.match?.home?.split(' ')[0], forma:p.forma_casa},{label:p.match?.away?.split(' ')[0], forma:p.forma_trasferta}].map(({label,forma}) => forma && (
                              <div key={label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                                <span style={{ fontSize:10, color:'rgba(245,240,232,0.35)' }}>{label}</span>
                                <div style={{ display:'flex', gap:2 }}>
                                  {forma.split('-').map((r,j) => (
                                    <div key={j} style={{ width:16, height:16, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:800, background:r==='V'?'rgba(134,239,172,0.2)':r==='P'?'rgba(248,113,113,0.2)':'rgba(245,158,11,0.2)', color:r==='V'?'#86efac':r==='P'?'#f87171':'#f59e0b' }}>{r}</div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize:11, color:'rgba(245,240,232,0.5)', lineHeight:1.6 }}>
                          <span style={{ color:'#86efac' }}>✓</span> {p.motivo_principale}
                        </div>
                        {p.rischio_principale && (
                          <div style={{ fontSize:11, color:'rgba(245,240,232,0.4)', marginTop:3 }}>
                            <span style={{ color:'#f87171' }}>⚠</span> {p.rischio_principale}
                          </div>
                        )}
                        {p.notizie && (
                          <div style={{ fontSize:10, color:'rgba(245,240,232,0.3)', marginTop:4, fontStyle:'italic' }}>
                            📰 {p.notizie}
                          </div>
                        )}
                        {p.value_bet && <div style={{ fontSize:10, color:'#86efac', marginTop:4 }}>✨ Value bet</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Azioni esito */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <button
                onClick={() => registraEsito(stepIdx, 'vinto', selectedForStep[stepIdx]?.match)}
                style={{ padding:'14px', background:'rgba(134,239,172,0.08)', border:'1px solid rgba(134,239,172,0.25)', borderRadius:14, color:'#86efac', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}
              >
                ✓ Vinto
              </button>
              <button
                onClick={() => registraEsito(stepIdx, 'perso', selectedForStep[stepIdx]?.match)}
                style={{ padding:'14px', background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:14, color:'#f87171', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}
              >
                ✗ Perso
              </button>
            </div>
          </div>
        )}

        {/* Step precedenti */}
        {scalataAttiva.steps.filter(s => s.done).length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={C.label}>Step completati</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {scalataAttiva.steps.filter(s => s.done).map((step, i) => (
                <div key={i} style={{ padding:'12px 16px', background: step.esito==='vinto' ? 'rgba(134,239,172,0.04)' : 'rgba(248,113,113,0.04)', border:`1px solid ${step.esito==='vinto' ? 'rgba(134,239,172,0.15)' : 'rgba(248,113,113,0.15)'}`, borderRadius:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:13, color:'rgba(245,240,232,0.7)' }}>
                      <span style={{ color: step.esito==='vinto' ? '#86efac' : '#f87171', marginRight:8 }}>{step.esito==='vinto' ? '✓' : '✗'}</span>
                      Step {step.step} · {fmt(step.importo)}
                    </div>
                    {step.matchUsato && <div style={{ fontSize:10, color:'rgba(245,240,232,0.3)', marginTop:2 }}>{step.matchUsato.home} vs {step.matchUsato.away}</div>}
                  </div>
                  <div style={{ fontSize:11, color:'rgba(245,240,232,0.3)' }}>{step.timestamp ? new Date(step.timestamp).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' }) : ''}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={abbandonaScalata} style={{ width:'100%', padding:'12px', background:'transparent', border:'1px solid rgba(248,113,113,0.15)', borderRadius:12, color:'rgba(248,113,113,0.4)', fontSize:11, cursor:'pointer', fontFamily:'DM Sans,sans-serif', letterSpacing:2 }}>
          ABBANDONA SCALATA
        </button>
      </div>
    </div>
  )
}
