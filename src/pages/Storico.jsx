import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const fmt = n => `€${Number(n).toFixed(2)}`
const fmtDate = d => new Date(d).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' })

const PROFILI = {
  x2: { label:'Raddoppia', icon:'×2' },
  x3: { label:'Triplica', icon:'×3' },
  x5: { label:'Quintuplica', icon:'×5' },
}

const STATUS = {
  completata: { label:'Completata', color:'#86efac' },
  fallita:    { label:'Fallita',    color:'#f87171' },
  abbandonata:{ label:'Abbandonata',color:'rgba(245,240,232,0.3)' },
}

export default function Storico({ session }) {
  const userId = session?.user?.id
  const [storico, setStorico] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    supabase.from('user_data').select('storico').eq('user_id', userId).single()
      .then(({ data }) => { if (data?.storico) setStorico(data.storico); setLoading(false) })
      .catch(() => setLoading(false))
  }, [userId])

  const C = {
    page: { maxWidth:480, margin:'0 auto', padding:'24px 16px' },
    h: { fontFamily:'DM Serif Display,serif' },
    gold: '#c9a84c',
    label: { fontSize:10, color:'rgba(245,240,232,0.35)', letterSpacing:3, textTransform:'uppercase', marginBottom:8 },
  }

  const stats = {
    totali: storico.length,
    completate: storico.filter(s => s.status === 'completata').length,
    fallite: storico.filter(s => s.status === 'fallita').length,
    profitto: storico.filter(s => s.status === 'completata').reduce((a, s) => a + (s.obiettivo - s.capitale), 0),
    winRate: storico.length ? Math.round(storico.filter(s => s.status === 'completata').length / storico.length * 100) : 0,
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0c0c0c', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', border:'2px solid rgba(201,168,76,0.2)', borderTop:`2px solid ${C.gold}`, animation:'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0c0c0c' }}>
      <div style={C.page}>
        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ ...C.h, fontSize:28, color:'#f5f0e8', fontWeight:400 }}>Storico</div>
          <div style={{ fontSize:12, color:'rgba(245,240,232,0.3)', marginTop:4 }}>Le tue scalate passate</div>
        </div>

        {/* Stats */}
        {storico.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:28 }}>
            {[
              { l:'Win Rate', v:`${stats.winRate}%`, c:C.gold },
              { l:'Profitto tot.', v:fmt(stats.profitto), c:'#86efac' },
              { l:'Completate', v:stats.completate, c:'rgba(245,240,232,0.7)' },
              { l:'Fallite', v:stats.fallite, c:'rgba(245,240,232,0.7)' },
            ].map(s => (
              <div key={s.l} style={{ padding:'14px 16px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14 }}>
                <div style={{ ...C.h, fontSize:22, color:s.c }}>{s.v}</div>
                <div style={{ fontSize:10, color:'rgba(245,240,232,0.3)', letterSpacing:2, textTransform:'uppercase', marginTop:4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Lista */}
        {storico.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'rgba(245,240,232,0.2)' }}>
            <div style={{ ...C.h, fontSize:40, marginBottom:12 }}>◎</div>
            <div style={{ fontSize:14 }}>Nessuna scalata ancora</div>
            <div style={{ fontSize:12, marginTop:8, color:'rgba(245,240,232,0.15)' }}>Completa la prima per vederla qui</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {storico.map((s, i) => {
              const st = STATUS[s.status] || STATUS.abbandonata
              const profilo = PROFILI[s.profilo] || { label: s.tipo, icon:'?' }
              const vinti = s.steps?.filter(x => x.esito === 'vinto').length || 0
              const fatti = s.steps?.filter(x => x.done).length || 0
              const profitto = s.status === 'completata' ? s.obiettivo - s.capitale : -(s.capitale - s.bankrollCorrente)

              return (
                <div key={i} style={{ padding:'16px', background:'rgba(255,255,255,0.02)', border:`1px solid ${st.color}22`, borderRadius:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <div style={{ ...C.h, fontSize:18, color:'#f5f0e8' }}>{profilo.icon}</div>
                        <div style={{ fontSize:14, fontWeight:600, color:'rgba(245,240,232,0.8)' }}>{profilo.label}</div>
                      </div>
                      <div style={{ fontSize:11, color:'rgba(245,240,232,0.3)' }}>{fmtDate(s.createdAt)}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:10, padding:'3px 10px', borderRadius:99, background:`${st.color}15`, border:`1px solid ${st.color}33`, color:st.color, fontWeight:600, marginBottom:4 }}>{st.label}</div>
                      <div style={{ ...C.h, fontSize:16, color: profitto >= 0 ? '#86efac' : '#f87171' }}>
                        {profitto >= 0 ? '+' : ''}{fmt(profitto)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:16, marginBottom:10 }}>
                    {[
                      { l:'Capitale', v:fmt(s.capitale) },
                      { l:'Obiettivo', v:fmt(s.obiettivo) },
                      { l:'Step', v:`${fatti}/${s.steps?.length || 0}` },
                      { l:'Vinti', v:vinti },
                    ].map(x => (
                      <div key={x.l}>
                        <div style={{ fontSize:13, fontWeight:600, color:'rgba(245,240,232,0.7)', fontFamily:'DM Serif Display,serif' }}>{x.v}</div>
                        <div style={{ fontSize:9, color:'rgba(245,240,232,0.25)', textTransform:'uppercase', letterSpacing:1 }}>{x.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Mini timeline */}
                  <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                    {(s.steps || []).map((st2, j) => (
                      <div key={j} style={{ width:20, height:20, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, background:!st2.done?'rgba(255,255,255,0.04)':st2.esito==='vinto'?'rgba(134,239,172,0.15)':'rgba(248,113,113,0.15)', color:!st2.done?'rgba(245,240,232,0.2)':st2.esito==='vinto'?'#86efac':'#f87171' }}>
                        {!st2.done ? j+1 : st2.esito==='vinto' ? '✓' : '✗'}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
