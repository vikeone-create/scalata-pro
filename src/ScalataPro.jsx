import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SPORTS = [
  { key: 'soccer_italy_serie_a', label: 'Serie A 🇮🇹' },
  { key: 'soccer_epl', label: 'Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { key: 'soccer_spain_la_liga', label: 'La Liga 🇪🇸' },
  { key: 'soccer_germany_bundesliga', label: 'Bundesliga 🇩🇪' },
  { key: 'soccer_uefa_champs_league', label: 'Champions League ⭐' },
]

const SCALATA_TYPES = {
  aggressiva: { label: 'Aggressiva', icon: '🔥', quotaMin: 2.3, quotaMax: 3.5, color: '#ef4444', soft: 'rgba(239,68,68,0.15)', winRate: '35–45%', desc: 'Quote alte · Alto rischio' },
  normale:    { label: 'Normale',    icon: '⚡', quotaMin: 1.6, quotaMax: 2.2, color: '#f59e0b', soft: 'rgba(245,158,11,0.15)', winRate: '50–60%', desc: 'Quote medie · Bilanciata' },
  sicura:     { label: 'Sicura',     icon: '🛡️', quotaMin: 1.1, quotaMax: 1.5, color: '#86efac', soft: 'rgba(134,239,172,0.15)', winRate: '65–80%', desc: 'Quote basse · Basso rischio' },
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = n => `€${Number(n).toFixed(2)}`
const fmtDate = d => new Date(d).toLocaleDateString('it-IT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
const ratingColor = r => r >= 8 ? '#86efac' : r >= 6 ? '#f59e0b' : r >= 4 ? '#fb923c' : '#f87171'
const verdettoBg = v => ({ CONSIGLIATA:'#86efac', ACCETTABILE:'#f59e0b', RISCHIOSA:'#fb923c', SCONSIGLIATA:'#f87171' }[v] || '#d4b896')

function calcScalata(capitale, obiettivo, quotaMedia) {
  const steps = [], profitTarget = obiettivo - capitale
  let profitoCumulato = 0, bankroll = capitale
  for (let i = 0; i < 25; i++) {
    let importo = Math.ceil(((profitTarget - profitoCumulato) / (quotaMedia - 1)) * 100) / 100
    if (importo > bankroll) importo = bankroll
    const vincita = +(importo * quotaMedia).toFixed(2)
    profitoCumulato += vincita - importo
    steps.push({ step:i+1, importo:+importo.toFixed(2), quota:quotaMedia, vincita, profitoPrevisto:+profitoCumulato.toFixed(2), bankrollSeVince:+(bankroll-importo+vincita).toFixed(2), bankrollSePerde:+(bankroll-importo).toFixed(2), done:false, esito:null })
    if (profitoCumulato >= profitTarget) break
  }
  return steps
}

// ─── SUPABASE DATA LAYER ──────────────────────────────────────────────────────
async function loadUserData(userId) {
  const { data } = await supabase
    .from('scalata_data')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

async function saveUserData(userId, payload) {
  await supabase
    .from('scalata_data')
    .upsert({ user_id: userId, ...payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
}

// ─── AI ANALYSIS ─────────────────────────────────────────────────────────────
async function analyzeMatch(match, scalataType) {
  const cfg = SCALATA_TYPES[scalataType]
  const prompt = `Sei un analista sportivo esperto in calcio e betting. Analizza questa partita in modo oggettivo per scopo puramente educativo/statistico.

PARTITA: ${match.home} vs ${match.away}
ESITO: ${match.esito} | QUOTA: ${match.quota} | DATA: ${new Date(match.commence).toLocaleDateString('it-IT')}
SCALATA: ${cfg.label} (${cfg.quotaMin}-${cfg.quotaMax})

Cerca notizie recenti, infortuni, forma squadre, statistiche h2h. Valuta se la quota è corretta.

Rispondi SOLO con JSON valido, nessun testo extra:
{"rating":<1-10>,"verdetto":"<CONSIGLIATA|ACCETTABILE|RISCHIOSA|SCONSIGLIATA>","probabilita_stimata":<0-100>,"probabilita_quota":<0-100>,"value_bet":<true|false>,"forma_casa":"<V-P-V-P-V>","forma_trasferta":"<V-P-V-P-V>","notizie_chiave":["<n1>","<n2>","<n3>"],"punti_forza":["<p1>","<p2>"],"punti_rischio":["<r1>","<r2>"],"analisi":"<3-4 frasi>","consiglio_scalata":"<1-2 frasi>"}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await response.json()
  const textBlocks = data.content?.filter(b => b.type === 'text') || []
  const lastText = textBlocks[textBlocks.length - 1]?.text || ''
  const jsonMatch = lastText.replace(/```json|```/g, '').match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Nessun JSON trovato')
  return JSON.parse(jsonMatch[0])
}

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
const WCard = ({ children, style, glow }) => (
  <div style={{ background:'rgba(255,245,230,0.07)', border:'1px solid rgba(255,220,160,0.15)', borderRadius:20, backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', boxShadow: glow ? `0 0 30px ${glow}33, inset 0 1px 0 rgba(255,220,160,0.1)` : 'inset 0 1px 0 rgba(255,220,160,0.08)', ...style }}>
    {children}
  </div>
)
const Label = ({ children }) => (
  <div style={{ fontSize:10, letterSpacing:3, color:'rgba(255,200,120,0.5)', marginBottom:8, textTransform:'uppercase', fontWeight:600 }}>{children}</div>
)
const Pill = ({ children, color, bg, style }) => (
  <div style={{ display:'inline-flex', alignItems:'center', padding:'4px 12px', borderRadius:99, background:bg||'rgba(255,200,120,0.12)', border:`1px solid ${color||'rgba(255,200,120,0.25)'}`, fontSize:10, fontWeight:700, color:color||'#f5d090', letterSpacing:1, ...style }}>{children}</div>
)

// ─── ANALYSIS PANEL ──────────────────────────────────────────────────────────
function AnalysisPanel({ match, analysis, loading, error, scalataType, onClose, onUse }) {
  const cfg = SCALATA_TYPES[scalataType]
  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, overflowY:'auto', padding:'0 0 60px' }}>
      <div style={{ position:'fixed', inset:0, background:'linear-gradient(160deg,#2a1500 0%,#1a0e00 50%,#0f1a0a 100%)', zIndex:-1 }} />
      <div style={{ position:'fixed', top:-80, right:-60, width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,#b4530966 0%,transparent 70%)', zIndex:-1 }} />
      <div style={{ maxWidth:460, margin:'0 auto', padding:'20px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:600, color:'#fef3c7', fontFamily:'DM Serif Display,Georgia,serif' }}>{match.home} <span style={{ color:'rgba(255,200,120,0.4)' }}>vs</span> {match.away}</div>
            <div style={{ fontSize:11, color:'rgba(255,200,120,0.5)', marginTop:3 }}>{match.esito} · <span style={{ color:cfg.color, fontWeight:700 }}>@{match.quota}</span> · {match.bookmaker}</div>
          </div>
          <button onClick={onClose} style={{ width:36, height:36, borderRadius:12, background:'rgba(255,220,160,0.1)', border:'1px solid rgba(255,220,160,0.2)', color:'#f5d090', cursor:'pointer', fontSize:16 }}>×</button>
        </div>

        {loading && (
          <WCard style={{ padding:36, textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:14 }}>🧠</div>
            <div style={{ fontSize:14, color:'#f5d090', fontWeight:600, marginBottom:8 }}>Analisi AI in corso...</div>
            <div style={{ fontSize:11, color:'rgba(255,200,120,0.5)', lineHeight:2 }}>Ricerca notizie & infortuni<br/>Analisi statistiche storiche<br/>Valutazione value bet</div>
            <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:20 }}>
              {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'#f59e0b', animation:`wb 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
            </div>
            <style>{`@keyframes wb{0%,100%{transform:scale(1);opacity:0.3}50%{transform:scale(1.5);opacity:1}}`}</style>
          </WCard>
        )}

        {error && <WCard style={{ padding:20, textAlign:'center' }}><div style={{ color:'#f87171', fontSize:12 }}>⚠️ {error}</div></WCard>}

        {analysis && !loading && (() => {
          const rc = ratingColor(analysis.rating)
          const vc = verdettoBg(analysis.verdetto)
          return (
            <div>
              <WCard glow={rc} style={{ padding:'24px 20px', marginBottom:12, textAlign:'center' }}>
                <div style={{ fontSize:11, color:'rgba(255,200,120,0.5)', letterSpacing:3, marginBottom:10 }}>RATING AI</div>
                <div style={{ fontSize:64, fontWeight:400, color:rc, lineHeight:1, fontFamily:'DM Serif Display,Georgia,serif' }}>{analysis.rating}<span style={{ fontSize:22, color:'rgba(255,200,120,0.3)' }}>/10</span></div>
                <Pill color={vc} bg={`${vc}22`} style={{ marginTop:12 }}>{analysis.verdetto}</Pill>
                {analysis.value_bet && <div style={{ marginTop:10, fontSize:11, color:'#86efac' }}>✨ Value Bet rilevato</div>}
              </WCard>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                {[{l:'Prob. AI',v:`${analysis.probabilita_stimata}%`,c:'#f59e0b'},{l:'Prob. quota',v:`${analysis.probabilita_quota}%`,c:'#d4b896'}].map(s => (
                  <WCard key={s.l} style={{ padding:'14px', textAlign:'center' }}>
                    <div style={{ fontSize:26, fontWeight:400, color:s.c, fontFamily:'DM Serif Display,Georgia,serif' }}>{s.v}</div>
                    <div style={{ fontSize:9, color:'rgba(255,200,120,0.4)', letterSpacing:2, marginTop:4 }}>{s.l}</div>
                  </WCard>
                ))}
              </div>

              {(analysis.forma_casa || analysis.forma_trasferta) && (
                <WCard style={{ padding:'14px 16px', marginBottom:12 }}>
                  <Label>Forma Recente</Label>
                  {[{label:match.home,forma:analysis.forma_casa},{label:match.away,forma:analysis.forma_trasferta}].map(({label,forma}) => forma && (
                    <div key={label} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <div style={{ fontSize:11, color:'rgba(255,200,120,0.6)', minWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</div>
                      <div style={{ display:'flex', gap:4 }}>
                        {forma.split('-').map((r,i) => <div key={i} style={{ width:24, height:24, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, background:r==='V'?'rgba(134,239,172,0.2)':r==='P'?'rgba(248,113,113,0.2)':'rgba(245,158,11,0.2)', color:r==='V'?'#86efac':r==='P'?'#f87171':'#f59e0b', border:`1px solid ${r==='V'?'rgba(134,239,172,0.4)':r==='P'?'rgba(248,113,113,0.4)':'rgba(245,158,11,0.4)'}` }}>{r}</div>)}
                      </div>
                    </div>
                  ))}
                </WCard>
              )}

              {analysis.notizie_chiave?.length > 0 && (
                <WCard style={{ padding:'14px 16px', marginBottom:12 }}>
                  <Label>📰 Notizie Chiave</Label>
                  {analysis.notizie_chiave.map((n,i) => <div key={i} style={{ fontSize:11, color:'rgba(255,220,160,0.7)', padding:'7px 0', borderBottom:i<analysis.notizie_chiave.length-1?'1px solid rgba(255,200,120,0.08)':'none', lineHeight:1.5 }}>· {n}</div>)}
                </WCard>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                <WCard style={{ padding:'12px' }}><Label>✓ Forza</Label>{analysis.punti_forza?.map((p,i) => <div key={i} style={{ fontSize:10, color:'rgba(255,220,160,0.65)', marginBottom:5, lineHeight:1.4 }}>· {p}</div>)}</WCard>
                <WCard style={{ padding:'12px' }}><Label>⚠ Rischi</Label>{analysis.punti_rischio?.map((p,i) => <div key={i} style={{ fontSize:10, color:'rgba(255,220,160,0.65)', marginBottom:5, lineHeight:1.4 }}>· {p}</div>)}</WCard>
              </div>

              <WCard style={{ padding:'14px 16px', marginBottom:12 }}>
                <Label>🧠 Analisi</Label>
                <div style={{ fontSize:12, color:'rgba(255,220,160,0.75)', lineHeight:1.9 }}>{analysis.analisi}</div>
              </WCard>

              <WCard glow={cfg.color} style={{ padding:'14px 16px', marginBottom:16 }}>
                <Label>{cfg.icon} Scalata {cfg.label}</Label>
                <div style={{ fontSize:12, color:'rgba(255,220,160,0.75)', lineHeight:1.8 }}>{analysis.consiglio_scalata}</div>
              </WCard>

              <div style={{ display:'flex', gap:8 }}>
                <button onClick={onClose} style={{ flex:1, padding:'13px', background:'rgba(255,220,160,0.06)', border:'1px solid rgba(255,220,160,0.15)', borderRadius:14, color:'rgba(255,200,120,0.5)', fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>Indietro</button>
                <button onClick={onUse} style={{ flex:2, padding:'13px', background:'rgba(245,158,11,0.2)', border:`1px solid ${cfg.color}88`, borderRadius:14, color:'#fef3c7', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:700, boxShadow:`0 0 20px ${cfg.color}33` }}>Usa questa partita →</button>
              </div>
              <div style={{ marginTop:12, fontSize:10, color:'rgba(255,200,120,0.25)', textAlign:'center' }}>⚠️ Solo scopo educativo · Non costituisce pronostico</div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function ScalataPro({ session }) {
  const userId = session?.user?.id
  const userEmail = session?.user?.email

  const [tab, setTab] = useState('setup')
  const [capitale, setCapitale] = useState(100)
  const [obiettivo, setObiettivo] = useState(200)
  const [tipo, setTipo] = useState('normale')
  const [sport, setSport] = useState('soccer_italy_serie_a')
  const [scalataAttiva, setScalataAttiva] = useState(null)
  const [matches, setMatches] = useState([])
  const [loadingOdds, setLoadingOdds] = useState(false)
  const [oddsError, setOddsError] = useState(null)
  const [oddsRemaining, setOddsRemaining] = useState(null)
  const [storico, setStorico] = useState([])
  const [analysisTarget, setAnalysisTarget] = useState(null)
  const [analysisData, setAnalysisData] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState(null)
  const [analysisCache, setAnalysisCache] = useState({})
  const [dataLoading, setDataLoading] = useState(true)

  // Load from Supabase on mount
  useEffect(() => {
    if (!userId) return
    loadUserData(userId).then(data => {
      if (data) {
        if (data.scalata_attiva) setScalataAttiva(data.scalata_attiva)
        if (data.storico) setStorico(data.storico)
        if (data.analysis_cache) setAnalysisCache(data.analysis_cache)
      }
      setDataLoading(false)
    }).catch(() => setDataLoading(false))
  }, [userId])

  const persist = useCallback(async (patch) => {
    if (!userId) return
    await saveUserData(userId, patch)
  }, [userId])

  // Fetch odds via proxy
  const fetchOdds = useCallback(async () => {
    setLoadingOdds(true); setOddsError(null)
    try {
      const cfg = SCALATA_TYPES[tipo]
      const url = `/api/odds?sport=${sport}&quotaMin=${cfg.quotaMin}&quotaMax=${cfg.quotaMax}`
      const res = await fetch(url)
      setOddsRemaining(res.headers.get('x-requests-remaining'))
      if (!res.ok) throw new Error(`Errore API ${res.status}`)
      const data = await res.json()
      setMatches(data.map(m => ({ ...m, analysis: analysisCache[m.id] || null })))
    } catch(e) { setOddsError(e.message) }
    setLoadingOdds(false)
  }, [sport, tipo, analysisCache])

  const openAnalysis = async (match) => {
    setAnalysisTarget(match); setAnalysisError(null)
    if (analysisCache[match.id]) { setAnalysisData(analysisCache[match.id]); setAnalysisLoading(false); return }
    setAnalysisData(null); setAnalysisLoading(true)
    try {
      const result = await analyzeMatch(match, tipo)
      setAnalysisData(result)
      const newCache = { ...analysisCache, [match.id]: result }
      setAnalysisCache(newCache)
      persist({ analysis_cache: newCache })
      setMatches(prev => prev.map(m => m.id===match.id ? { ...m, analysis:result } : m))
    } catch(e) { setAnalysisError(e.message) }
    setAnalysisLoading(false)
  }

  const closeAnalysis = () => { setAnalysisTarget(null); setAnalysisData(null); setAnalysisError(null) }

  const useAnalyzedMatch = () => {
    if (!analysisTarget || !scalataAttiva) return
    const step = scalataAttiva.stepCorrente || 0
    const updated = { ...scalataAttiva, selectedMatches: { ...scalataAttiva.selectedMatches, [step]: { ...analysisTarget, analysis: analysisData } } }
    setScalataAttiva(updated); persist({ scalata_attiva: updated })
    closeAnalysis(); setTab('scalata')
  }

  const avviaScalata = () => {
    const cfg = SCALATA_TYPES[tipo]
    const quotaMedia = +((cfg.quotaMin+cfg.quotaMax)/2).toFixed(2)
    const s = { id:Date.now(), tipo, capitale, obiettivo, quotaMedia, profitTarget:obiettivo-capitale, steps:calcScalata(capitale,obiettivo,quotaMedia), stepCorrente:0, bankrollCorrente:capitale, createdAt:new Date().toISOString(), status:'attiva', selectedMatches:{} }
    setScalataAttiva(s); persist({ scalata_attiva: s }); setTab('scalata')
  }

  const registraEsito = (stepIndex, esito) => {
    const steps = scalataAttiva.steps.map((s,i) => i===stepIndex ? { ...s, done:true, esito, timestamp:new Date().toISOString() } : s)
    const step = steps[stepIndex]
    const bankrollCorrente = esito==='vinto' ? step.bankrollSeVince : step.bankrollSePerde
    const stepCorrente = stepIndex+1
    let status = 'attiva'
    if (esito==='vinto' && step.profitoPrevisto >= scalataAttiva.profitTarget) status='completata'
    else if (esito==='perso' && (bankrollCorrente<=0 || stepCorrente>=steps.length)) status='fallita'
    const updated = { ...scalataAttiva, steps, stepCorrente, bankrollCorrente, status }
    setScalataAttiva(updated); persist({ scalata_attiva: updated })
    if (status!=='attiva') {
      const closed = { ...updated, closedAt: new Date().toISOString() }
      const ns = [closed,...storico].slice(0,50)
      setStorico(ns); persist({ storico: ns, scalata_attiva: null })
      setTimeout(() => { setScalataAttiva(null); setTab('storico') }, 900)
    }
  }

  const abbandonaScalata = () => {
    const closed = { ...scalataAttiva, status:'abbandonata', closedAt:new Date().toISOString() }
    const ns = [closed,...storico].slice(0,50)
    setStorico(ns); persist({ storico: ns, scalata_attiva: null })
    setScalataAttiva(null); setTab('setup')
  }

  const logout = async () => { await supabase.auth.signOut() }

  const cfg = SCALATA_TYPES[tipo]
  const activeCfg = scalataAttiva ? SCALATA_TYPES[scalataAttiva.tipo] : null
  const isValid = capitale >= 1 && obiettivo > capitale
  const profitPct = scalataAttiva ? Math.min(100,Math.max(0,((scalataAttiva.bankrollCorrente-scalataAttiva.capitale)/(scalataAttiva.obiettivo-scalataAttiva.capitale))*100)) : 0

  const TABS = [
    { id:'setup', icon:'⚙️', label:'Setup' },
    { id:'scalata', icon:'🎯', label:'Scalata' },
    { id:'quote', icon:'📡', label:'Live' },
    { id:'storico', icon:'🗃', label:'Log' },
  ]

  const inputStyle = { width:'100%', padding:'13px 16px', background:'rgba(255,245,230,0.07)', border:'1px solid rgba(255,220,160,0.15)', borderRadius:14, color:'#fef3c7', fontSize:22, fontWeight:700, fontFamily:'DM Serif Display,Georgia,serif', boxSizing:'border-box', outline:'none' }

  if (dataLoading) return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#2a1500,#1c0e00,#0f1a08)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:28, fontFamily:'DM Serif Display,Georgia,serif', color:'#fef3c7' }}>Scalata<span style={{ color:'#f59e0b' }}>Pro</span></div>
      <div style={{ display:'flex', gap:6 }}>
        {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'#f59e0b', opacity:0.6, animation:`p 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
      </div>
      <style>{`@keyframes p{0%,100%{transform:scale(1);opacity:0.3}50%{transform:scale(1.5);opacity:1}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', fontFamily:'DM Sans,Helvetica Neue,Arial,sans-serif', position:'relative', overflowX:'hidden' }}>
      {/* Bokeh bg */}
      <div style={{ position:'fixed', inset:0, background:'linear-gradient(160deg,#2a1500 0%,#1c0e00 45%,#0f1a08 100%)', zIndex:0 }} />
      <div style={{ position:'fixed', top:-100, right:-80, width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,#b4530955 0%,transparent 65%)', zIndex:0, pointerEvents:'none' }} />
      <div style={{ position:'fixed', top:200, left:-120, width:320, height:320, borderRadius:'50%', background:'radial-gradient(circle,#92400e44 0%,transparent 65%)', zIndex:0, pointerEvents:'none' }} />
      <div style={{ position:'fixed', bottom:-80, right:60, width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle,#78350f33 0%,transparent 65%)', zIndex:0, pointerEvents:'none' }} />

      {analysisTarget && <AnalysisPanel match={analysisTarget} analysis={analysisData} loading={analysisLoading} error={analysisError} scalataType={tipo} onClose={closeAnalysis} onUse={useAnalyzedMatch} />}

      {/* HEADER */}
      <div style={{ position:'relative', zIndex:10, padding:'20px 20px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:11, letterSpacing:4, color:'rgba(255,200,120,0.35)', marginBottom:3, textTransform:'uppercase' }}>Educational Tool</div>
            <div style={{ fontSize:24, fontWeight:400, color:'#fef3c7', fontFamily:'DM Serif Display,Georgia,serif' }}>
              Scalata<span style={{ color:'#f59e0b' }}>Pro</span>
              <span style={{ fontSize:11, color:'rgba(134,239,172,0.7)', marginLeft:8, fontFamily:'DM Sans,sans-serif', fontWeight:600, letterSpacing:2 }}>AI</span>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {scalataAttiva && (
              <WCard style={{ padding:'7px 12px', textAlign:'center' }}>
                <div style={{ fontSize:9, color:'rgba(255,200,120,0.4)', letterSpacing:2, textTransform:'uppercase' }}>Live</div>
                <div style={{ fontSize:15, fontWeight:700, color:'#f5d090', fontFamily:'DM Serif Display,Georgia,serif' }}>{(scalataAttiva.stepCorrente||0)+1}/{scalataAttiva.steps.length}</div>
              </WCard>
            )}
            <button onClick={logout} title={`Esci (${userEmail})`} style={{ width:34, height:34, borderRadius:10, background:'rgba(255,220,160,0.08)', border:'1px solid rgba(255,220,160,0.15)', color:'rgba(255,200,120,0.5)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>⎋</button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ position:'relative', zIndex:5, padding:'0 16px 110px', maxWidth:480, margin:'0 auto' }}>

        {/* ══ SETUP ══ */}
        {tab==='setup' && (
          <div>
            {scalataAttiva && (
              <WCard style={{ padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:12, color:'#f59e0b' }}>⚠️ Scalata già attiva</span>
                <button onClick={() => setTab('scalata')} style={{ background:'rgba(245,158,11,0.2)', border:'1px solid rgba(245,158,11,0.4)', borderRadius:10, color:'#f5d090', fontSize:11, padding:'5px 12px', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>Vai →</button>
              </WCard>
            )}

            <Label>Tipo di Scalata</Label>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              {Object.entries(SCALATA_TYPES).map(([key,val]) => (
                <button key={key} onClick={() => setTipo(key)} style={{ flex:1, padding:'16px 6px', border:`1px solid ${tipo===key?val.color+'88':'rgba(255,220,160,0.1)'}`, borderRadius:18, cursor:'pointer', fontFamily:'inherit', background:tipo===key?'rgba(255,220,160,0.08)':'rgba(255,245,230,0.03)', backdropFilter:'blur(20px)', transition:'all 0.2s', boxShadow:tipo===key?`0 0 24px ${val.color}33, inset 0 1px 0 rgba(255,220,160,0.1)`:'none' }}>
                  <div style={{ fontSize:22 }}>{val.icon}</div>
                  <div style={{ fontSize:11, fontWeight:600, marginTop:6, color:tipo===key?val.color:'rgba(255,200,120,0.35)' }}>{val.label}</div>
                  <div style={{ fontSize:9, marginTop:3, color:'rgba(255,200,120,0.3)' }}>{val.quotaMin}–{val.quotaMax}</div>
                </button>
              ))}
            </div>

            <WCard glow={cfg.color} style={{ padding:'10px 16px', marginBottom:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, color:'rgba(255,220,160,0.6)' }}>{cfg.desc}</span>
                <Pill color={cfg.color} bg={cfg.soft}>{cfg.winRate}</Pill>
              </div>
            </WCard>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              {[{label:'Capitale (€)',val:capitale,set:setCapitale},{label:'Obiettivo (€)',val:obiettivo,set:setObiettivo}].map(({label,val,set}) => (
                <div key={label}><Label>{label}</Label><input type="number" value={val} min={1} onChange={e => set(+e.target.value)} style={inputStyle} /></div>
              ))}
            </div>

            <Label>Campionato</Label>
            <select value={sport} onChange={e => setSport(e.target.value)} style={{ ...inputStyle, fontSize:13, fontFamily:'DM Sans,sans-serif', marginBottom:20 }}>
              {SPORTS.map(s => <option key={s.key} value={s.key} style={{ background:'#2a1500' }}>{s.label}</option>)}
            </select>

            {isValid && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:20 }}>
                {[{l:'Profitto',v:fmt(obiettivo-capitale),c:'#86efac'},{l:'ROI',v:`${Math.round((obiettivo-capitale)/capitale*100)}%`,c:'#f59e0b'},{l:'Quota avg',v:((cfg.quotaMin+cfg.quotaMax)/2).toFixed(2),c:cfg.color}].map(s => (
                  <WCard key={s.l} style={{ padding:'12px 8px', textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:700, color:s.c, fontFamily:'DM Serif Display,Georgia,serif' }}>{s.v}</div>
                    <div style={{ fontSize:9, color:'rgba(255,200,120,0.35)', letterSpacing:2, marginTop:3, textTransform:'uppercase' }}>{s.l}</div>
                  </WCard>
                ))}
              </div>
            )}

            <button onClick={avviaScalata} disabled={!isValid||!!scalataAttiva} style={{ width:'100%', padding:'16px', borderRadius:18, border:`1px solid ${isValid&&!scalataAttiva?'rgba(245,158,11,0.5)':'rgba(255,220,160,0.1)'}`, background:isValid&&!scalataAttiva?'rgba(245,158,11,0.2)':'rgba(255,245,230,0.03)', color:isValid&&!scalataAttiva?'#fef3c7':'rgba(255,200,120,0.2)', fontSize:13, fontWeight:700, cursor:isValid&&!scalataAttiva?'pointer':'not-allowed', fontFamily:'inherit', letterSpacing:2, backdropFilter:'blur(20px)', boxShadow:isValid&&!scalataAttiva?'0 0 30px rgba(245,158,11,0.2)':'none', transition:'all 0.2s' }}>
              AVVIA SCALATA →
            </button>
            <div style={{ marginTop:14, fontSize:10, color:'rgba(255,200,120,0.2)', textAlign:'center', lineHeight:2 }}>⚠️ Solo uso educativo · Non costituisce invito al gioco<br/>Il gioco può creare dipendenza · Gioca responsabilmente</div>
          </div>
        )}

        {/* ══ SCALATA ══ */}
        {tab==='scalata' && (
          <div>
            {!scalataAttiva ? (
              <div style={{ textAlign:'center', padding:'60px 20px', color:'rgba(255,200,120,0.3)' }}><div style={{ fontSize:40, marginBottom:12 }}>🎯</div><div>Nessuna scalata attiva. Configurala nel Setup.</div></div>
            ) : (
              <>
                <WCard glow={activeCfg.color} style={{ padding:'22px 20px', marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:10, color:'rgba(255,200,120,0.4)', letterSpacing:3, textTransform:'uppercase', marginBottom:4 }}>Bankroll corrente</div>
                      <div style={{ fontSize:36, fontWeight:400, color:'#fef3c7', fontFamily:'DM Serif Display,Georgia,serif', lineHeight:1 }}>{fmt(scalataAttiva.bankrollCorrente)}</div>
                      <div style={{ fontSize:11, color:'rgba(255,200,120,0.4)', marginTop:4 }}>Target {fmt(scalataAttiva.obiettivo)}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:10, color:'rgba(255,200,120,0.4)', letterSpacing:2, marginBottom:2 }}>STEP</div>
                      <div style={{ fontSize:32, fontWeight:400, color:activeCfg.color, fontFamily:'DM Serif Display,Georgia,serif' }}>{(scalataAttiva.stepCorrente||0)+1}<span style={{ fontSize:14, color:'rgba(255,200,120,0.3)' }}>/{scalataAttiva.steps.length}</span></div>
                    </div>
                  </div>
                  <div style={{ background:'rgba(255,200,120,0.1)', borderRadius:99, height:5 }}>
                    <div style={{ height:'100%', borderRadius:99, width:`${profitPct}%`, background:`linear-gradient(90deg,${activeCfg.color},#fef3c7)`, transition:'width 0.6s ease', boxShadow:`0 0 10px ${activeCfg.color}66` }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
                    <span style={{ fontSize:9, color:'rgba(255,200,120,0.25)' }}>{fmt(scalataAttiva.capitale)}</span>
                    <span style={{ fontSize:9, color:'rgba(255,200,120,0.4)' }}>{Math.round(profitPct)}%</span>
                    <span style={{ fontSize:9, color:'rgba(255,200,120,0.25)' }}>{fmt(scalataAttiva.obiettivo)}</span>
                  </div>
                </WCard>

                {scalataAttiva.steps.map((step,i) => {
                  const isCurrent = i===(scalataAttiva.stepCorrente||0) && !step.done
                  const selected = scalataAttiva.selectedMatches?.[i]
                  const isV = step.done && step.esito==='vinto'
                  const isP = step.done && step.esito==='perso'
                  return (
                    <WCard key={i} glow={isCurrent?activeCfg.color:null} style={{ marginBottom:8, opacity:(!step.done&&!isCurrent)?0.35:1, transition:'all 0.3s', border:`1px solid ${isCurrent?activeCfg.color+'55':isV?'rgba(134,239,172,0.25)':isP?'rgba(248,113,113,0.25)':'rgba(255,220,160,0.08)'}`, background:isCurrent?'rgba(255,200,120,0.06)':isV?'rgba(134,239,172,0.05)':isP?'rgba(248,113,113,0.05)':'rgba(255,245,230,0.03)' }}>
                      <div style={{ padding:'12px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <div style={{ width:34, height:34, borderRadius:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:isV?'rgba(134,239,172,0.15)':isP?'rgba(248,113,113,0.15)':isCurrent?'rgba(245,158,11,0.15)':'rgba(255,200,120,0.06)', border:`1px solid ${isV?'rgba(134,239,172,0.4)':isP?'rgba(248,113,113,0.4)':isCurrent?activeCfg.color+'66':'rgba(255,200,120,0.1)'}`, fontSize:step.done?14:12, fontWeight:700, color:isV?'#86efac':isP?'#f87171':isCurrent?'#f5d090':'rgba(255,200,120,0.3)', fontFamily:'DM Serif Display,Georgia,serif' }}>
                            {step.done?(isV?'✓':'✗'):i+1}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                              <span style={{ fontSize:20, fontWeight:700, color:'#fef3c7', fontFamily:'DM Serif Display,Georgia,serif' }}>{fmt(step.importo)}</span>
                              <span style={{ fontSize:11, color:'rgba(255,200,120,0.35)' }}>×{step.quota}</span>
                              <span style={{ fontSize:15, fontWeight:700, color:'#86efac', fontFamily:'DM Serif Display,Georgia,serif' }}>{fmt(step.vincita)}</span>
                            </div>
                            <div style={{ fontSize:10, color:'rgba(255,200,120,0.3)', marginTop:3, display:'flex', gap:12 }}>
                              <span style={{ color:'rgba(134,239,172,0.5)' }}>▲ {fmt(step.bankrollSeVince)}</span>
                              <span style={{ color:'rgba(248,113,113,0.45)' }}>▼ {fmt(step.bankrollSePerde)}</span>
                              {step.timestamp && <span style={{ marginLeft:'auto' }}>{fmtDate(step.timestamp)}</span>}
                            </div>
                          </div>
                        </div>
                        {selected && isCurrent && (
                          <div style={{ marginTop:10, padding:'9px 12px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div>
                              <div style={{ fontSize:11, color:'#f5d090', fontWeight:600 }}>{selected.home} vs {selected.away}</div>
                              <div style={{ fontSize:10, color:'rgba(255,200,120,0.4)' }}>{selected.esito} · @{selected.quota}</div>
                            </div>
                            {selected.analysis && (
                              <div style={{ background:`${ratingColor(selected.analysis.rating)}22`, border:`1px solid ${ratingColor(selected.analysis.rating)}44`, borderRadius:10, padding:'5px 10px', textAlign:'center' }}>
                                <div style={{ fontSize:14, fontWeight:700, color:ratingColor(selected.analysis.rating), fontFamily:'DM Serif Display,Georgia,serif' }}>{selected.analysis.rating}/10</div>
                                <div style={{ fontSize:8, color:'rgba(255,200,120,0.4)' }}>AI</div>
                              </div>
                            )}
                          </div>
                        )}
                        {isCurrent && (
                          <div style={{ display:'flex', gap:8, marginTop:12 }}>
                            <button onClick={() => setTab('quote')} style={{ flex:1, padding:'9px 6px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, color:'#f5d090', fontSize:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>📡 Partita</button>
                            <button onClick={() => registraEsito(i,'vinto')} style={{ flex:1, padding:'9px 6px', background:'rgba(134,239,172,0.1)', border:'1px solid rgba(134,239,172,0.3)', borderRadius:12, color:'#86efac', fontSize:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>✓ Vinto</button>
                            <button onClick={() => registraEsito(i,'perso')} style={{ flex:1, padding:'9px 6px', background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:12, color:'#f87171', fontSize:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>✗ Perso</button>
                          </div>
                        )}
                      </div>
                    </WCard>
                  )
                })}
                <button onClick={abbandonaScalata} style={{ width:'100%', marginTop:8, padding:'11px', background:'rgba(248,113,113,0.06)', border:'1px solid rgba(248,113,113,0.15)', borderRadius:14, color:'rgba(248,113,113,0.5)', fontSize:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700, letterSpacing:2 }}>ABBANDONA SCALATA</button>
              </>
            )}
          </div>
        )}

        {/* ══ QUOTE ══ */}
        {tab==='quote' && (
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <select value={sport} onChange={e => setSport(e.target.value)} style={{ flex:1, padding:'10px 12px', background:'rgba(255,245,230,0.06)', border:'1px solid rgba(255,220,160,0.15)', borderRadius:12, color:'#fef3c7', fontSize:12, fontFamily:'inherit', outline:'none' }}>
                {SPORTS.map(s => <option key={s.key} value={s.key} style={{ background:'#2a1500' }}>{s.label}</option>)}
              </select>
              <button onClick={fetchOdds} disabled={loadingOdds} style={{ padding:'10px 16px', background:loadingOdds?'rgba(255,245,230,0.04)':'rgba(245,158,11,0.2)', border:`1px solid ${loadingOdds?'rgba(255,220,160,0.1)':'rgba(245,158,11,0.4)'}`, borderRadius:12, color:loadingOdds?'rgba(255,200,120,0.25)':'#f5d090', fontSize:12, fontWeight:700, cursor:loadingOdds?'wait':'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                {loadingOdds ? '⏳' : '📡 Aggiorna'}
              </button>
            </div>

            {oddsRemaining && <div style={{ fontSize:10, color:'rgba(255,200,120,0.3)', marginBottom:10 }}>API: <span style={{ color:'#f59e0b' }}>{oddsRemaining}</span>/500 richieste</div>}
            {oddsError && <WCard style={{ padding:'10px 14px', marginBottom:12 }}><span style={{ fontSize:12, color:'#f87171' }}>⚠️ {oddsError}</span></WCard>}

            <div style={{ fontSize:10, color:'rgba(255,200,120,0.3)', marginBottom:12 }}>
              {cfg.icon} <span style={{ color:cfg.color }}>{cfg.label}</span> · {cfg.quotaMin}–{cfg.quotaMax} · {matches.length} partite
            </div>

            {matches.length===0 && !loadingOdds && <div style={{ textAlign:'center', padding:'60px 20px', color:'rgba(255,200,120,0.25)' }}><div style={{ fontSize:36, marginBottom:10 }}>📡</div><div style={{ fontSize:13 }}>Premi Aggiorna per le quote live</div></div>}

            {matches.map(m => {
              const stepCorrente = scalataAttiva?.stepCorrente||0
              const isSelected = scalataAttiva?.selectedMatches?.[stepCorrente]?.id===m.id
              const hasAnalysis = !!m.analysis
              const rc = hasAnalysis ? ratingColor(m.analysis.rating) : null
              return (
                <WCard key={m.id} style={{ marginBottom:8, border:`1px solid ${isSelected?'rgba(245,158,11,0.4)':'rgba(255,220,160,0.08)'}`, background:isSelected?'rgba(245,158,11,0.07)':'rgba(255,245,230,0.03)', boxShadow:isSelected?'0 0 20px rgba(245,158,11,0.15)':undefined, overflow:'hidden', transition:'all 0.2s' }}>
                  <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'#fef3c7', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.home} <span style={{ color:'rgba(255,200,120,0.3)' }}>vs</span> {m.away}</div>
                      <div style={{ fontSize:10, color:'rgba(255,200,120,0.4)', marginTop:3 }}>{m.bookmaker} · <span style={{ color:cfg.color }}>{m.esito}</span> · {fmtDate(m.commence)}</div>
                    </div>
                    <div style={{ background:cfg.soft, border:`1px solid ${cfg.color}44`, borderRadius:12, padding:'6px 12px', textAlign:'center', flexShrink:0 }}>
                      <div style={{ fontSize:18, fontWeight:700, color:cfg.color, fontFamily:'DM Serif Display,Georgia,serif' }}>{m.quota}</div>
                    </div>
                    {hasAnalysis && (
                      <div style={{ background:`${rc}18`, border:`1px solid ${rc}44`, borderRadius:10, padding:'5px 9px', textAlign:'center', flexShrink:0 }}>
                        <div style={{ fontSize:15, fontWeight:700, color:rc, fontFamily:'DM Serif Display,Georgia,serif' }}>{m.analysis.rating}</div>
                        <div style={{ fontSize:8, color:'rgba(255,200,120,0.35)', letterSpacing:1 }}>AI</div>
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', borderTop:'1px solid rgba(255,220,160,0.06)' }}>
                    <button onClick={() => openAnalysis(m)} style={{ flex:1, padding:'9px', background:'transparent', border:'none', borderRight:'1px solid rgba(255,220,160,0.06)', color:'rgba(245,158,11,0.7)', fontSize:10, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                      {hasAnalysis ? '🧠 Rivedi' : '🔍 Analizza AI'}
                    </button>
                    {scalataAttiva && (
                      <button onClick={() => { const u={...scalataAttiva,selectedMatches:{...scalataAttiva.selectedMatches,[scalataAttiva.stepCorrente||0]:m}}; setScalataAttiva(u); persist({scalata_attiva:u}); setTab('scalata') }} style={{ flex:1, padding:'9px', background:isSelected?'rgba(245,158,11,0.12)':'transparent', border:'none', color:isSelected?'#f5d090':'rgba(255,200,120,0.4)', fontSize:10, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                        {isSelected ? '✓ Selezionata' : 'Usa →'}
                      </button>
                    )}
                  </div>
                </WCard>
              )
            })}
          </div>
        )}

        {/* ══ STORICO ══ */}
        {tab==='storico' && (
          <div>
            {storico.length===0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px', color:'rgba(255,200,120,0.25)' }}><div style={{ fontSize:36, marginBottom:10 }}>🗃</div><div style={{ fontSize:13 }}>Nessuna scalata nel log ancora</div></div>
            ) : (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, marginBottom:16 }}>
                  {(() => {
                    const comp=storico.filter(s=>s.status==='completata').length
                    const fall=storico.filter(s=>s.status==='fallita').length
                    const prof=storico.filter(s=>s.status==='completata').reduce((a,s)=>a+(s.obiettivo-s.capitale),0)
                    const wr=storico.length?Math.round(comp/storico.length*100):0
                    return [{l:'Completate',v:comp,c:'#86efac'},{l:'Win Rate',v:`${wr}%`,c:'#f59e0b'},{l:'Fallite',v:fall,c:'#f87171'},{l:'Profitto',v:fmt(prof),c:'#fef3c7'}]
                  })().map(s => (
                    <WCard key={s.l} style={{ padding:'14px', textAlign:'center' }}>
                      <div style={{ fontSize:22, fontWeight:700, color:s.c, fontFamily:'DM Serif Display,Georgia,serif' }}>{s.v}</div>
                      <div style={{ fontSize:9, color:'rgba(255,200,120,0.35)', letterSpacing:2, textTransform:'uppercase', marginTop:3 }}>{s.l}</div>
                    </WCard>
                  ))}
                </div>

                {storico.map(s => {
                  const sc=SCALATA_TYPES[s.tipo]
                  const stMap={completata:{c:'#86efac',l:'Completata'},fallita:{c:'#f87171',l:'Fallita'},abbandonata:{c:'rgba(255,200,120,0.4)',l:'Abbandonata'},attiva:{c:'#f59e0b',l:'Attiva'}}
                  const st=stMap[s.status]||stMap.attiva
                  const vinti=s.steps.filter(x=>x.esito==='vinto').length
                  const fatti=s.steps.filter(x=>x.done).length
                  return (
                    <WCard key={s.id} style={{ marginBottom:10, padding:'14px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                        <div>
                          <div style={{ fontSize:14, fontWeight:600, color:'#fef3c7' }}>{sc.icon} {sc.label}</div>
                          <div style={{ fontSize:10, color:'rgba(255,200,120,0.35)', marginTop:2 }}>{fmtDate(s.createdAt)}</div>
                        </div>
                        <Pill color={st.c} bg={`${st.c}22`}>{st.l}</Pill>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, marginBottom:10 }}>
                        {[{l:'Da',v:fmt(s.capitale)},{l:'A',v:fmt(s.obiettivo),c:'#f5d090'},{l:'Step',v:`${fatti}/${s.steps.length}`},{l:'Vinti',v:vinti,c:'#86efac'}].map(x => (
                          <div key={x.l} style={{ textAlign:'center' }}>
                            <div style={{ fontSize:13, fontWeight:600, color:x.c||'rgba(255,220,160,0.6)', fontFamily:'DM Serif Display,Georgia,serif' }}>{x.v}</div>
                            <div style={{ fontSize:8, color:'rgba(255,200,120,0.25)', textTransform:'uppercase', letterSpacing:1 }}>{x.l}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {s.steps.map((st2,j) => (
                          <div key={j} style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, background:!st2.done?'rgba(255,200,120,0.04)':st2.esito==='vinto'?'rgba(134,239,172,0.15)':'rgba(248,113,113,0.15)', border:`1px solid ${!st2.done?'rgba(255,200,120,0.08)':st2.esito==='vinto'?'rgba(134,239,172,0.4)':'rgba(248,113,113,0.4)'}`, color:!st2.done?'rgba(255,200,120,0.2)':st2.esito==='vinto'?'#86efac':'#f87171' }}>
                            {!st2.done?j+1:st2.esito==='vinto'?'✓':'✗'}
                          </div>
                        ))}
                      </div>
                    </WCard>
                  )
                })}
                <button onClick={async()=>{if(confirm('Cancellare tutto lo storico?')){setStorico([]);persist({storico:[]})}}} style={{ width:'100%', marginTop:6, padding:'11px', background:'rgba(248,113,113,0.05)', border:'1px solid rgba(248,113,113,0.15)', borderRadius:14, color:'rgba(248,113,113,0.4)', fontSize:10, cursor:'pointer', fontFamily:'inherit', letterSpacing:2 }}>CANCELLA STORICO</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:50 }}>
        <div style={{ background:'rgba(28,14,0,0.8)', backdropFilter:'blur(30px)', WebkitBackdropFilter:'blur(30px)', borderTop:'1px solid rgba(255,220,160,0.1)', padding:'8px 0 24px' }}>
          <div style={{ display:'flex', maxWidth:480, margin:'0 auto', padding:'0 16px' }}>
            {TABS.map(t => {
              const isActive=tab===t.id
              const isDisabled=t.id==='scalata'&&!scalataAttiva
              return (
                <button key={t.id} onClick={()=>!isDisabled&&setTab(t.id)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'8px 4px', border:'none', background:'transparent', cursor:isDisabled?'not-allowed':'pointer', fontFamily:'inherit', opacity:isDisabled?0.2:1, transition:'all 0.2s' }}>
                  <div style={{ fontSize:18, lineHeight:1, filter:isActive?'drop-shadow(0 0 5px rgba(245,158,11,0.7))':'none' }}>{t.icon}</div>
                  <div style={{ fontSize:9, fontWeight:600, letterSpacing:2, color:isActive?'#f5d090':'rgba(255,200,120,0.3)', textTransform:'uppercase' }}>{t.label}</div>
                  {isActive && <div style={{ width:16, height:2, borderRadius:99, background:'linear-gradient(90deg,#f59e0b,#fef3c7)', marginTop:1 }} />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
