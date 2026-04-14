import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { T, GLOBAL_CSS } from '../theme'

const C = {
  page:   T.page,
  orb:    T.orb,
  label:  T.label,
  gc:     T.card,
  gtext:  { background: `linear-gradient(90deg, ${T.cyan}, ${T.purple})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  gtextG: { background: `linear-gradient(90deg, ${T.green}, ${T.cyan})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
}

const confColor = c => ({ ALTA: T.green, MEDIA: T.gold, BASSA: T.red }[c] || '#666')

function AccuracyChart({ data }) {
  if (data?.length < 2) return null
  const W = 280, H = 56, PAD = 6
  const pts = data.slice(-20)
  let correct = 0
  const running = pts.map((p, i) => {
    if (p.direzione_corretta) correct++
    return { x: i, acc: Math.round(correct / (i + 1) * 100) }
  })
  const toX = i => PAD + (i / (running.length - 1)) * (W - PAD * 2)
  const toY = v => H - PAD - ((v - 20) / 80) * (H - PAD * 2)
  const path = running.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.acc).toFixed(1)}`).join(' ')
  const fill = `${path} L${toX(running.length-1).toFixed(1)},${H} L${PAD},${H} Z`
  const lastAcc = running[running.length-1]?.acc || 0
  const color = lastAcc >= 45 ? '#00ff96' : lastAcc >= 33 ? '#f59e0b' : '#ff4646'
  return (
    <svg width={W} height={H} style={{ display:'block', margin:'8px 0' }}>
      <line x1={PAD} y1={toY(33)} x2={W-PAD} y2={toY(33)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3,3"/>
      <line x1={PAD} y1={toY(44.9)} x2={W-PAD} y2={toY(44.9)} stroke="rgba(0,212,255,0.18)" strokeWidth="1" strokeDasharray="3,3"/>
      <path d={fill} fill={`${color}10`}/>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {running.map((p,i) => <circle key={i} cx={toX(i)} cy={toY(p.acc)} r="2" fill={p.acc>=45?'#00ff96':p.acc>=33?'#f59e0b':'#ff4646'}/>)}
    </svg>
  )
}

export default function StoricoPronostici() {
  const [storico, setStorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('tutti')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('pronostici_storico')
      .select('*')
      .order('data', { ascending: false })
      .limit(100)
    if (data) setStorico(data)
    setLoading(false)
  }

  const verificati = storico.filter(p => p.verificato)
  const nonVerificati = storico.filter(p => !p.verificato)
  const corrEsatti = verificati.filter(p => p.esatto).length
  const corrDir = verificati.filter(p => p.direzione_corretta).length
  const accDir = verificati.length ? Math.round(corrDir / verificati.length * 1000) / 10 : 0
  const accEs = verificati.length ? Math.round(corrEsatti / verificati.length * 1000) / 10 : 0

  const byConf = conf => {
    const v = verificati.filter(p => p.pred_confidenza === conf)
    const ok = v.filter(p => p.direzione_corretta).length
    return v.length ? { tot: v.length, acc: Math.round(ok / v.length * 100) } : null
  }

  const filtered = storico.filter(p => {
    if (filtro === 'corretti') return p.verificato && p.direzione_corretta
    if (filtro === 'sbagliati') return p.verificato && !p.direzione_corretta
    if (filtro === 'attesa') return !p.verificato
    return true
  })

  if (loading) return (
    <div style={{ minHeight:'100vh', background: T.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width:36, height:36, borderRadius:'50%', border:`2px solid ${T.cyan}18`, borderTop:`2px solid ${T.cyan}`, animation:'spin 1s linear infinite' }}/>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background: T.bg, fontFamily:"'Space Grotesk', sans-serif" }}>
      <style>{GLOBAL_CSS}</style>
      <div style={C.page}>

        <div style={{ marginBottom:20 }}>
          <div style={{ ...C.orb, fontSize:16, fontWeight:800, color:'#fff', letterSpacing:1 }}>
            STORICO<span style={C.gtext}> PRONOSTICI</span>
          </div>
          <div style={{ fontSize:9, color:'rgba(160,130,255,0.4)', letterSpacing:3, marginTop:4 }}>ACCURATEZZA REALE NEL TEMPO</div>
        </div>

        {verificati.length > 0 ? (
          <div style={{ marginBottom:20 }}>
            {/* Big stats */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <div style={{ padding:'14px', borderRadius:18, background:'linear-gradient(135deg,rgba(0,212,255,0.09),rgba(160,80,255,0.07))', border:'1px solid rgba(0,212,255,0.18)' }}>
                <div style={C.label}>Accuratezza 1X2</div>
                <div style={{ ...C.orb, ...C.gtext, fontSize:26, fontWeight:800 }}>{accDir}%</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:4 }}>{corrDir}/{verificati.length} corretti</div>
              </div>
              <div style={{ padding:'14px', borderRadius:18, background:'linear-gradient(135deg,rgba(0,255,150,0.07),rgba(0,212,255,0.05))', border:'1px solid rgba(0,255,150,0.18)' }}>
                <div style={C.label}>Risultato esatto</div>
                <div style={{ ...C.orb, ...C.gtextG, fontSize:26, fontWeight:800 }}>{accEs}%</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:4 }}>{corrEsatti}/{verificati.length} corretti</div>
              </div>
            </div>

            {/* Baseline */}
            <div style={{ ...C.gc, padding:'12px 14px', marginBottom:8 }}>
              <div style={C.label}>Confronto baseline</div>
              {[
                { l:'Random', v:33.3, c:'rgba(255,255,255,0.25)' },
                { l:'Modello storico', v:44.9, c:'#00d4ff' },
                { l:'Reale corrente', v:accDir, c:accDir>=44.9?'#00ff96':'#f59e0b' },
              ].map(s => (
                <div key={s.l} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', minWidth:110 }}>{s.l}</div>
                  <div style={{ flex:1, height:4, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.min(100, s.v/70*100)}%`, background:s.c, borderRadius:99 }}/>
                  </div>
                  <div style={{ ...C.orb, fontSize:11, color:s.c, minWidth:38, textAlign:'right' }}>{s.v}%</div>
                </div>
              ))}
            </div>

            {/* Grafico */}
            <div style={{ ...C.gc, padding:'12px 14px', marginBottom:8 }}>
              <div style={C.label}>Andamento accuratezza</div>
              <AccuracyChart data={verificati}/>
              <div style={{ display:'flex', gap:12, marginTop:2 }}>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.18)' }}>— Random 33%</div>
                <div style={{ fontSize:8, color:'rgba(0,212,255,0.35)' }}>— Storico 44.9%</div>
              </div>
            </div>

            {/* Per confidenza */}
            <div style={{ ...C.gc, padding:'12px 14px', marginBottom:8 }}>
              <div style={C.label}>Per confidenza</div>
              <div style={{ display:'flex', gap:6 }}>
                {['ALTA','MEDIA','BASSA'].map(conf => {
                  const s = byConf(conf)
                  return (
                    <div key={conf} style={{ flex:1, padding:'10px 6px', background:`${confColor(conf)}0d`, border:`1px solid ${confColor(conf)}28`, borderRadius:12, textAlign:'center' }}>
                      <div style={{ ...C.orb, fontSize:16, fontWeight:800, color:confColor(conf) }}>{s ? `${s.acc}%` : '—'}</div>
                      <div style={{ fontSize:8, color:confColor(conf), letterSpacing:1, marginTop:2 }}>{conf}</div>
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.2)', marginTop:1 }}>{s ? `${s.tot} partite` : '0'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ ...C.gc, padding:'20px', marginBottom:20, textAlign:'center' }}>
            <div style={{ ...C.orb, fontSize:10, color:'rgba(160,130,255,0.4)', letterSpacing:2 }}>NESSUNA VERIFICA ANCORA</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)', marginTop:8, lineHeight:1.8 }}>
              Le partite vengono verificate automaticamente<br/>ogni notte alle 02:00
            </div>
            {nonVerificati.length > 0 && <div style={{ fontSize:11, color:'rgba(0,212,255,0.5)', marginTop:8 }}>{nonVerificati.length} pronostici in attesa</div>}
          </div>
        )}

        {/* Filtri */}
        <div style={{ display:'flex', gap:5, marginBottom:14, flexWrap:'wrap' }}>
          {[
            { k:'tutti', l:`Tutti (${storico.length})` },
            { k:'corretti', l:`✓ (${corrDir})` },
            { k:'sbagliati', l:`✗ (${verificati.length - corrDir})` },
            { k:'attesa', l:`⏳ (${nonVerificati.length})` },
          ].map(f => (
            <button key={f.k} onClick={() => setFiltro(f.k)} style={{ padding:'6px 12px', borderRadius:99, border:`1px solid ${filtro===f.k?'rgba(0,212,255,0.4)':'rgba(255,255,255,0.07)'}`, background:filtro===f.k?'rgba(0,212,255,0.12)':'transparent', color:filtro===f.k?'#00d4ff':'rgba(255,255,255,0.3)', fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'Space Grotesk, sans-serif', letterSpacing:1 }}>
              {f.l}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map((p, i) => {
            const isOpen = expanded === i
            const bc = !p.verificato ? 'rgba(255,255,255,0.07)' : p.esatto ? 'rgba(0,255,150,0.3)' : p.direzione_corretta ? 'rgba(0,212,255,0.22)' : 'rgba(255,70,70,0.22)'
            const bg = !p.verificato ? 'rgba(255,255,255,0.02)' : p.esatto ? 'rgba(0,255,150,0.04)' : p.direzione_corretta ? 'rgba(0,212,255,0.04)' : 'rgba(255,70,70,0.04)'
            return (
              <div key={p.id} style={{ background:bg, border:`1px solid ${bc}`, borderRadius:16, overflow:'hidden', cursor:'pointer' }} onClick={() => setExpanded(isOpen?null:i)}>
                <div style={{ padding:'12px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:1 }}>
                      {p.league_flag} {p.league} · {new Date(p.data).toLocaleDateString('it-IT',{day:'2-digit',month:'short'})}
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      <div style={{ fontSize:8, padding:'2px 7px', borderRadius:99, background:`${confColor(p.pred_confidenza)}15`, border:`1px solid ${confColor(p.pred_confidenza)}35`, color:confColor(p.pred_confidenza), fontWeight:700 }}>{p.pred_confidenza}</div>
                      {!p.verificato && <div style={{ fontSize:8, padding:'2px 7px', borderRadius:99, background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.3)', letterSpacing:1 }}>⏳</div>}
                      {p.verificato && p.esatto && <div style={{ fontSize:8, padding:'2px 7px', borderRadius:99, background:'rgba(0,255,150,0.15)', border:'1px solid rgba(0,255,150,0.35)', color:'#00ff96', fontWeight:700 }}>✓ ESATTO</div>}
                      {p.verificato && !p.esatto && p.direzione_corretta && <div style={{ fontSize:8, padding:'2px 7px', borderRadius:99, background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', color:'#00d4ff', fontWeight:700 }}>~ 1X2</div>}
                      {p.verificato && !p.direzione_corretta && <div style={{ fontSize:8, padding:'2px 7px', borderRadius:99, background:'rgba(255,70,70,0.1)', border:'1px solid rgba(255,70,70,0.3)', color:'#ff4646', fontWeight:700 }}>✗</div>}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1, textAlign:'right', fontSize:12, fontWeight:700, color:'#fff' }}>{p.home}</div>
                    <div style={{ flexShrink:0, textAlign:'center' }}>
                      <div style={{ ...C.orb, ...C.gtext, fontSize:18, fontWeight:800, lineHeight:1 }}>{p.pred_gol_casa}<span style={{ WebkitTextFillColor:'rgba(255,255,255,0.15)', fontSize:14 }}>-</span>{p.pred_gol_trasferta}</div>
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.2)', letterSpacing:2 }}>PREVISTO</div>
                      {p.verificato && <>
                        <div style={{ fontSize:7, color:'rgba(255,255,255,0.15)', letterSpacing:1, marginTop:3 }}>REALE</div>
                        <div style={{ ...C.orb, fontSize:16, fontWeight:800, color:p.esatto?'#00ff96':p.direzione_corretta?'#00d4ff':'#ff4646' }}>{p.real_gol_casa}-{p.real_gol_trasferta}</div>
                      </>}
                    </div>
                    <div style={{ flex:1, fontSize:12, fontWeight:700, color:'#fff' }}>{p.away}</div>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'12px 14px' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:8 }}>
                      {[{l:'xG Casa',v:p.pred_xg_home},{l:'xG Trasferta',v:p.pred_xg_away},{l:'Confidenza',v:p.pred_confidenza}].map(s => (
                        <div key={s.l} style={{ padding:'8px', background:'rgba(255,255,255,0.03)', borderRadius:10, textAlign:'center' }}>
                          <div style={{ ...C.orb, fontSize:12, color:'#00d4ff' }}>{s.v}</div>
                          <div style={{ fontSize:7, color:'rgba(255,255,255,0.25)', marginTop:2, letterSpacing:1 }}>{s.l.toUpperCase()}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:8 }}>
                      {[{l:'P.Casa',v:`${p.pred_p_home}%`},{l:'P.Pari',v:`${p.pred_p_draw}%`},{l:'P.Trasferta',v:`${p.pred_p_away}%`}].map(s => (
                        <div key={s.l} style={{ padding:'8px', background:'rgba(255,255,255,0.03)', borderRadius:10, textAlign:'center' }}>
                          <div style={{ ...C.orb, fontSize:12, color:'rgba(255,255,255,0.55)' }}>{s.v}</div>
                          <div style={{ fontSize:7, color:'rgba(255,255,255,0.22)', marginTop:2, letterSpacing:1 }}>{s.l.toUpperCase()}</div>
                        </div>
                      ))}
                    </div>
                    {p.verificato && (
                      <div style={{ padding:'10px 12px', background:p.esatto?'rgba(0,255,150,0.06)':p.direzione_corretta?'rgba(0,212,255,0.06)':'rgba(255,70,70,0.06)', border:`1px solid ${p.esatto?'rgba(0,255,150,0.2)':p.direzione_corretta?'rgba(0,212,255,0.2)':'rgba(255,70,70,0.2)'}`, borderRadius:10 }}>
                        <div style={{ fontSize:11, color:p.esatto?'#00ff96':p.direzione_corretta?'#00d4ff':'#ff4646', fontWeight:700 }}>
                          {p.esatto?'✓ Risultato esatto corretto!':p.direzione_corretta?'~ Direzione 1X2 corretta':'✗ Previsione errata'}
                        </div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:4 }}>Previsto {p.pred_risultato} · Reale {p.real_risultato}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ height:20 }}/>
      </div>
    </div>
  )
}
