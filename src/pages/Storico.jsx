import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { T, GLOBAL_CSS } from '../theme'

const C = {
  bg:     T.bg,
  card:   T.card,
  page:   T.page,
  label:  T.label,
  serif:  T.orb,
  cyan:   T.cyan,
  purple: T.purple,
  green:  T.green,
  pink:   T.pink,
  gold:   T.gold,
  text:   T.text,
}

const fmt     = n  => `€${Number(n).toFixed(2)}`
const fmtDate = d  => new Date(d).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' })
const fmtTime = d  => new Date(d).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })

const STATUS = {
  completata:  { label:'Completata',  color:'#00ff96' },
  fallita:     { label:'Fallita',     color:'#ff4444' },
  abbandonata: { label:'Abbandonata', color:'rgba(245,240,232,0.3)' },
}

function BankrollChart({ scalata }) {
  const steps = scalata.steps?.filter(s => s.done) || []
  if (steps.length < 2) return null
  const points = [{ x:0, y:scalata.capitale }]
  steps.forEach(s => {
    points.push({ x:points.length, y:s.esito==='vinto' ? s.bankrollSeVince : s.bankrollSePerde })
  })
  const maxY = Math.max(...points.map(p=>p.y), scalata.obiettivo)
  const minY = Math.min(...points.map(p=>p.y), 0)
  const rangeY = maxY-minY||1
  const W=280,H=60,PAD=4
  const toX = i => PAD+(i/(points.length-1))*(W-PAD*2)
  const toY = y => PAD+(1-(y-minY)/rangeY)*(H-PAD*2)
  const pathD = points.map((p,i)=>`${i===0?'M':'L'} ${toX(i).toFixed(1)} ${toY(p.y).toFixed(1)}`).join(' ')
  const areaD = pathD+` L ${toX(points.length-1).toFixed(1)} ${H} L ${toX(0).toFixed(1)} ${H} Z`
  const objY = toY(scalata.obiettivo)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:60,display:'block'}}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.cyan} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={C.cyan} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {scalata.obiettivo>=minY&&scalata.obiettivo<=maxY&&(
        <line x1={PAD} y1={objY} x2={W-PAD} y2={objY} stroke={C.gold} strokeWidth="0.5" strokeDasharray="3,3" opacity="0.4"/>
      )}
      <path d={areaD} fill="url(#cg)"/>
      <path d={pathD} fill="none" stroke={C.cyan} strokeWidth="1.5" strokeLinejoin="round"/>
      {points.map((p,i)=>(
        <circle key={i} cx={toX(i)} cy={toY(p.y)} r="2"
          fill={i===0?C.gold:p.y>=scalata.obiettivo?C.green:p.y<(points[i-1]?.y??p.y)?'#ff4444':C.cyan}/>
      ))}
    </svg>
  )
}

function AccuracyChart({ pronostici }) {
  const W=280,H=60,PAD=4
  const byDay={}
  pronostici.forEach(p=>{
    if(!byDay[p.data]) byDay[p.data]={esatti:0,totale:0,dirOk:0}
    byDay[p.data].totale++
    if(p.esatto) byDay[p.data].esatti++
    if(p.direzione_corretta) byDay[p.data].dirOk++
  })
  const giorni=Object.entries(byDay).sort(([a],[b])=>a.localeCompare(b))
  if(giorni.length<2) return null
  const n=giorni.length
  const toX=i=>PAD+(i/(n-1))*(W-PAD*2)
  const toY=y=>PAD+(1-y/100)*(H-PAD*2)
  const ptsDir=giorni.map(([,v],i)=>({x:i,y:v.dirOk/v.totale*100}))
  const ptsEx =giorni.map(([,v],i)=>({x:i,y:v.esatti/v.totale*100}))
  const pathDir=ptsDir.map((p,i)=>`${i===0?'M':'L'} ${toX(i).toFixed(1)} ${toY(p.y).toFixed(1)}`).join(' ')
  const pathEx =ptsEx.map((p,i)=>`${i===0?'M':'L'} ${toX(i).toFixed(1)} ${toY(p.y).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:60,display:'block'}}>
      <line x1={PAD} y1={toY(33)} x2={W-PAD} y2={toY(33)} stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" strokeDasharray="2,3"/>
      <path d={pathDir} fill="none" stroke={C.cyan}  strokeWidth="1.5" strokeLinejoin="round" opacity="0.85"/>
      <path d={pathEx}  fill="none" stroke={C.green} strokeWidth="1"   strokeLinejoin="round" opacity="0.6" strokeDasharray="3,2"/>
      {ptsDir.map((p,i)=>(
        <circle key={i} cx={toX(i)} cy={toY(p.y)} r="2" fill={C.cyan}/>
      ))}
    </svg>
  )
}

function calcolaProssimaGiocata(scalata) {
  const {bankrollCorrente,obiettivo,quotaMedia,steps,stepCorrente}=scalata
  if(!bankrollCorrente||!obiettivo||!quotaMedia) return null
  const profitTarget=obiettivo-scalata.capitale
  const profitoCumulato=steps.filter(s=>s.done&&s.esito==='vinto').reduce((acc,s)=>acc+(s.vincita-s.importo),0)
  const profitoDaFare=profitTarget-profitoCumulato
  if(profitoDaFare<=0) return null
  let importo=Math.ceil((profitoDaFare/(quotaMedia-1))*100)/100
  if(importo>bankrollCorrente) importo=bankrollCorrente
  return {importo:+importo.toFixed(2),quota:+quotaMedia.toFixed(2),vincitaPotenziale:+(importo*quotaMedia).toFixed(2),step:(stepCorrente||0)+1}
}

function TabScalate({storico}) {
  const [expanded,setExpanded]=useState(null)
  const completate=storico.filter(s=>s.status==='completata')
  const fallite=storico.filter(s=>s.status==='fallita')
  const totProfitto=completate.reduce((a,s)=>a+(s.obiettivo-s.capitale),0)
  const totPerdita=fallite.reduce((a,s)=>a+(s.capitale-(s.bankrollCorrente||0)),0)
  const netto=totProfitto-totPerdita
  const winRate=storico.length?Math.round(completate.length/storico.length*100):0

  if(storico.length===0) return (
    <div style={{textAlign:'center',padding:'60px 20px',color:'rgba(245,240,232,0.2)'}}>
      <div style={{...C.serif,fontSize:36,marginBottom:12,color:'rgba(0,212,255,0.2)'}}>◎</div>
      <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:14}}>Nessuna scalata ancora</div>
      <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:12,marginTop:8,color:'rgba(245,240,232,0.15)'}}>Completa la prima per vederla qui</div>
    </div>
  )

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div style={{...C.card,padding:'14px 16px'}}>
            <div style={{...C.serif,fontSize:24,color:C.cyan}}>{winRate}%</div>
            <div style={{...C.label,marginBottom:0,marginTop:4}}>Win Rate</div>
          </div>
          <div style={{...C.card,padding:'14px 16px'}}>
            <div style={{...C.serif,fontSize:24,color:netto>=0?C.green:'#ff4444'}}>{netto>=0?'+':''}{fmt(netto)}</div>
            <div style={{...C.label,marginBottom:0,marginTop:4}}>Netto totale</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
          {[{l:'Scalate',v:storico.length,c:'rgba(245,240,232,0.6)'},{l:'Completate',v:completate.length,c:C.green},{l:'Fallite',v:fallite.length,c:'#ff4444'}].map(s=>(
            <div key={s.l} style={{...C.card,padding:'12px',textAlign:'center'}}>
              <div style={{...C.serif,fontSize:20,color:s.c}}>{s.v}</div>
              <div style={{...C.label,marginBottom:0,marginTop:3}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {storico.map((s,i)=>{
          const st=STATUS[s.status]||STATUS.abbandonata
          const vinti=s.steps?.filter(x=>x.esito==='vinto').length||0
          const persi=s.steps?.filter(x=>x.esito==='perso').length||0
          const fatti=s.steps?.filter(x=>x.done).length||0
          const profitto=s.status==='completata'?s.obiettivo-s.capitale:-((s.capitale||0)-(s.bankrollCorrente||0))
          const isOpen=expanded===i
          const prossima=s.status==='attiva'?calcolaProssimaGiocata(s):null

          return (
            <div key={i} style={{background:'rgba(255,255,255,0.02)',border:`1px solid ${st.color}22`,borderRadius:16,overflow:'hidden'}}>
              <div onClick={()=>setExpanded(isOpen?null:i)} style={{padding:'16px',cursor:'pointer'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div>
                    <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:14,fontWeight:600,color:C.text,marginBottom:3}}>
                      {fmt(s.capitale)} → {fmt(s.obiettivo)}
                      <span style={{fontSize:11,color:'rgba(245,240,232,0.35)',fontWeight:400,marginLeft:8}}>{s.nGiocate?`${s.nGiocate} giocate`:s.tipoLabel||s.tipo}</span>
                    </div>
                    <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:11,color:'rgba(245,240,232,0.3)'}}>{fmtDate(s.createdAt)}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:10,padding:'3px 10px',borderRadius:99,background:`${st.color}15`,border:`1px solid ${st.color}33`,color:st.color,fontWeight:600,marginBottom:6}}>{st.label}</div>
                    <div style={{...C.serif,fontSize:16,color:profitto>=0?C.green:'#ff4444'}}>{profitto>=0?'+':''}{fmt(profitto)}</div>
                  </div>
                </div>
                <div style={{display:'flex',gap:16,marginBottom:10}}>
                  {[{l:'Step fatti',v:`${fatti}/${s.steps?.length||0}`},{l:'Vinti',v:vinti,c:C.green},{l:'Persi',v:persi,c:'#ff4444'},{l:'Quota',v:s.quotaMedia?s.quotaMedia.toFixed(2):'—'}].map(x=>(
                    <div key={x.l}>
                      <div style={{...C.serif,fontSize:13,color:x.c||'rgba(245,240,232,0.6)'}}>{x.v}</div>
                      <div style={{...C.label,marginBottom:0}}>{x.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:6}}>
                  {(s.steps||[]).map((st2,j)=>(
                    <div key={j} style={{width:22,height:22,borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,background:!st2.done?'rgba(255,255,255,0.04)':st2.esito==='vinto'?'rgba(0,255,150,0.1)':'rgba(255,68,68,0.1)',border:`1px solid ${!st2.done?'rgba(255,255,255,0.07)':st2.esito==='vinto'?'rgba(0,255,150,0.35)':'rgba(255,68,68,0.35)'}`,color:!st2.done?'rgba(245,240,232,0.2)':st2.esito==='vinto'?C.green:'#ff4444'}}>
                      {!st2.done?j+1:st2.esito==='vinto'?'✓':'✗'}
                    </div>
                  ))}
                </div>
                <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:10,color:'rgba(245,240,232,0.2)',textAlign:'right'}}>{isOpen?'▲ chiudi':'▼ dettaglio'}</div>
              </div>

              {isOpen&&(
                <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',padding:'16px'}}>
                  {s.steps?.filter(x=>x.done).length>=2&&(
                    <div style={{marginBottom:16}}>
                      <div style={C.label}>Andamento bankroll</div>
                      <div style={{display:'flex',justifyContent:'space-between',fontFamily:"'Space Grotesk', sans-serif",fontSize:10,color:'rgba(245,240,232,0.3)',marginBottom:2}}>
                        <span>Inizio {fmt(s.capitale)}</span>
                        <span style={{color:'rgba(201,168,76,0.5)'}}>— obiettivo {fmt(s.obiettivo)}</span>
                        <span>Fine {fmt(s.bankrollCorrente)}</span>
                      </div>
                      <BankrollChart scalata={s}/>
                    </div>
                  )}
                  {prossima&&(
                    <div style={{marginBottom:16,padding:'14px 16px',background:'rgba(0,212,255,0.04)',border:`1px solid rgba(0,212,255,0.15)`,borderRadius:12}}>
                      <div style={C.label}>Prossima giocata consigliata</div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <div style={{...C.serif,fontSize:24,color:C.text}}>{fmt(prossima.importo)}</div>
                          <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:11,color:'rgba(245,240,232,0.35)',marginTop:3}}>Quota {prossima.quota} · Vincita {fmt(prossima.vincitaPotenziale)}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{...C.label}}>Step</div>
                          <div style={{...C.serif,fontSize:22,color:C.cyan}}>{prossima.step}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={C.label}>Step dettagliati</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {(s.steps||[]).map((step,j)=>{
                      if(!step.done) return (
                        <div key={j} style={{padding:'10px 14px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:10,opacity:0.4}}>
                          <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:12,color:'rgba(245,240,232,0.3)'}}>Step {step.step} — non giocato</div>
                        </div>
                      )
                      const isV=step.esito==='vinto'
                      return (
                        <div key={j} style={{padding:'12px 14px',background:isV?'rgba(0,255,150,0.03)':'rgba(255,68,68,0.03)',border:`1px solid ${isV?'rgba(0,255,150,0.12)':'rgba(255,68,68,0.12)'}`,borderRadius:10}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <div style={{width:24,height:24,borderRadius:8,background:isV?'rgba(0,255,150,0.12)':'rgba(255,68,68,0.12)',border:`1px solid ${isV?'rgba(0,255,150,0.35)':'rgba(255,68,68,0.35)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:isV?C.green:'#ff4444',fontWeight:700,flexShrink:0}}>{isV?'✓':'✗'}</div>
                              <div>
                                <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:13,fontWeight:600,color:'rgba(245,240,232,0.8)'}}>Step {step.step} · <span style={C.serif}>{fmt(step.importo)}</span></div>
                                {step.timestamp&&<div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:10,color:'rgba(245,240,232,0.3)',marginTop:1}}>{fmtDate(step.timestamp)} · {fmtTime(step.timestamp)}</div>}
                              </div>
                            </div>
                            <div style={{textAlign:'right'}}>
                              <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:11,color:'rgba(245,240,232,0.4)'}}>× {step.quota}</div>
                              <div style={{...C.serif,fontSize:14,color:isV?C.green:'#ff4444'}}>{isV?'+'+fmt(step.vincita-step.importo):'-'+fmt(step.importo)}</div>
                            </div>
                          </div>
                          {step.matchUsato&&(
                            <div style={{padding:'8px 10px',background:'rgba(255,255,255,0.03)',borderRadius:8,fontFamily:"'Space Grotesk', sans-serif",fontSize:11}}>
                              <div style={{color:'rgba(245,240,232,0.6)',fontWeight:600}}>{step.matchUsato.home} <span style={{color:'rgba(245,240,232,0.25)'}}>vs</span> {step.matchUsato.away}</div>
                              <div style={{color:'rgba(245,240,232,0.3)',marginTop:2,fontSize:10}}>{step.matchUsato.esito} · {step.matchUsato.bookmaker}</div>
                            </div>
                          )}
                          <div style={{marginTop:6,fontFamily:"'Space Grotesk', sans-serif",fontSize:10,color:'rgba(245,240,232,0.3)'}}>
                            Bankroll dopo: <span style={{color:isV?C.green:'#ff4444'}}>{fmt(isV?step.bankrollSeVince:step.bankrollSePerde)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TabPronostici({pronostici,stats,loading}) {
  const [filtro,setFiltro]=useState('tutti')
  const verificati=pronostici.filter(p=>p.verificato)
  const nonVerificati=pronostici.filter(p=>!p.verificato)
  const esatti=verificati.filter(p=>p.esatto)
  const direzioneOk=verificati.filter(p=>p.direzione_corretta)
  const accEsatti=verificati.length?Math.round(esatti.length/verificati.length*100):0
  const accDirezione=verificati.length?Math.round(direzioneOk.length/verificati.length*100):0
  const listaMostrata=filtro==='verificati'?verificati:filtro==='pending'?nonVerificati:pronostici

  if(loading) return (
    <div style={{textAlign:'center',padding:40}}>
      <div style={{width:28,height:28,borderRadius:'50%',border:`2px solid rgba(0,212,255,0.1)`,borderTop:`2px solid ${C.cyan}`,animation:'spin 1s linear infinite',margin:'0 auto'}}/>
    </div>
  )

  if(pronostici.length===0) return (
    <div style={{textAlign:'center',padding:'60px 20px',color:'rgba(245,240,232,0.2)'}}>
      <div style={{...C.serif,fontSize:36,marginBottom:12,color:'rgba(0,212,255,0.2)'}}>🎯</div>
      <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:14}}>Nessun pronostico ancora</div>
      <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:12,marginTop:8,color:'rgba(245,240,232,0.15)'}}>I pronostici appaiono dopo il primo cron (06:00)</div>
    </div>
  )

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div style={{...C.card,padding:'14px 16px'}}>
            <div style={{...C.serif,fontSize:24,color:C.cyan}}>{accDirezione}%</div>
            <div style={{...C.label,marginBottom:0,marginTop:4}}>Acc. 1X2</div>
            <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:10,color:'rgba(245,240,232,0.25)',marginTop:2}}>+{Math.max(0,accDirezione-33)}% vs random</div>
          </div>
          <div style={{...C.card,padding:'14px 16px'}}>
            <div style={{...C.serif,fontSize:24,color:C.green}}>{accEsatti}%</div>
            <div style={{...C.label,marginBottom:0,marginTop:4}}>Esatti</div>
            <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:10,color:'rgba(245,240,232,0.25)',marginTop:2}}>+{Math.max(0,accEsatti-3)}% vs random</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
          {[{l:'Totali',v:pronostici.length,c:'rgba(245,240,232,0.6)'},{l:'Verificati',v:verificati.length,c:C.cyan},{l:'Pending',v:nonVerificati.length,c:'rgba(245,240,232,0.35)'}].map(s=>(
            <div key={s.l} style={{...C.card,padding:'12px',textAlign:'center'}}>
              <div style={{...C.serif,fontSize:20,color:s.c}}>{s.v}</div>
              <div style={{...C.label,marginBottom:0,marginTop:3}}>{s.l}</div>
            </div>
          ))}
        </div>
        {verificati.length>=3&&(
          <div style={{...C.card,padding:'14px 16px',marginTop:8}}>
            <div style={C.label}>Accuratezza nel tempo</div>
            <div style={{display:'flex',gap:16,marginBottom:8}}>
              {[{c:C.cyan,l:'1X2'},{c:C.green,l:'Esatti'},{c:'rgba(255,255,255,0.2)',l:'Base 33%'}].map(x=>(
                <div key={x.l} style={{display:'flex',alignItems:'center',gap:4}}>
                  <div style={{width:16,height:2,background:x.c,borderRadius:1}}/>
                  <span style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:10,color:'rgba(245,240,232,0.35)'}}>{x.l}</span>
                </div>
              ))}
            </div>
            <AccuracyChart pronostici={verificati}/>
          </div>
        )}
      </div>

      <div style={{display:'flex',gap:6,marginBottom:16}}>
        {[{k:'tutti',l:'Tutti'},{k:'verificati',l:'Verificati'},{k:'pending',l:'Pending'}].map(f=>(
          <button key={f.k} onClick={()=>setFiltro(f.k)} style={{flex:1,padding:'8px 0',borderRadius:99,border:'none',fontFamily:"'Space Grotesk', sans-serif",fontSize:12,fontWeight:600,cursor:'pointer',transition:'all 0.2s',background:filtro===f.k?`linear-gradient(135deg, ${C.cyan}, ${C.purple})`:'rgba(255,255,255,0.04)',color:filtro===f.k?'#080812':'rgba(245,240,232,0.4)'}}>
            {f.l}
          </button>
        ))}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {listaMostrata.length===0?(
          <div style={{textAlign:'center',padding:'30px 20px',fontFamily:"'Space Grotesk', sans-serif",fontSize:13,color:'rgba(245,240,232,0.2)'}}>Nessun pronostico in questa categoria</div>
        ):listaMostrata.map((p,i)=>{
          const esito=p.verificato?(p.esatto?'esatto':p.direzione_corretta?'direzione':'sbagliato'):'pending'
          const colori={
            esatto:   {bg:'rgba(0,255,150,0.04)',  border:'rgba(0,255,150,0.2)',  badge:'#00ff96', label:'✓ ESATTO'},
            direzione:{bg:'rgba(0,212,255,0.04)',  border:'rgba(0,212,255,0.2)',  badge:C.cyan,    label:'~ DIREZIONE OK'},
            sbagliato:{bg:'rgba(255,68,68,0.04)',  border:'rgba(255,68,68,0.2)',  badge:'#ff4444', label:'✗ SBAGLIATO'},
            pending:  {bg:'rgba(255,255,255,0.02)',border:'rgba(255,255,255,0.07)',badge:'rgba(245,240,232,0.3)',label:'IN ATTESA'},
          }
          const col=colori[esito]
          const dataFmt=new Date(p.data).toLocaleDateString('it-IT',{day:'2-digit',month:'short'})

          return (
            <div key={i} style={{background:col.bg,border:`1px solid ${col.border}`,borderRadius:14,padding:'14px 16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  {p.league_flag&&<span style={{fontSize:14}}>{p.league_flag}</span>}
                  <span style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:10,color:'rgba(245,240,232,0.3)'}}>{p.league||'Serie A'} · {dataFmt}</span>
                </div>
                <span style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:99,background:`${col.badge}18`,border:`1px solid ${col.badge}44`,color:col.badge,letterSpacing:1}}>{col.label}</span>
              </div>

              <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:14,fontWeight:600,color:C.text,marginBottom:10}}>
                {p.home} <span style={{color:'rgba(245,240,232,0.3)',fontWeight:400}}>vs</span> {p.away}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:8,alignItems:'center'}}>
                <div style={{...C.card,padding:'10px 12px',textAlign:'center'}}>
                  <div style={{...C.label,marginBottom:4}}>Previsione</div>
                  <div style={{...C.serif,fontSize:22,color:C.cyan}}>{p.pred_risultato||'—'}</div>
                  {(p.pred_xg_home||p.pred_xg_away)&&(
                    <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:10,color:'rgba(245,240,232,0.3)',marginTop:4}}>xG {p.pred_xg_home?.toFixed(1)} – {p.pred_xg_away?.toFixed(1)}</div>
                  )}
                </div>
                <div style={{textAlign:'center',color:'rgba(245,240,232,0.2)',fontSize:16}}>→</div>
                <div style={{...C.card,padding:'10px 12px',textAlign:'center',background:p.verificato?`${col.badge}08`:'rgba(255,255,255,0.02)'}}>
                  <div style={{...C.label,marginBottom:4}}>Reale</div>
                  {p.verificato?(
                    <>
                      <div style={{...C.serif,fontSize:22,color:col.badge}}>{p.real_risultato}</div>
                      <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:10,color:'rgba(245,240,232,0.3)',marginTop:4}}>
                        {p.real_esito==='H'?'Casa':p.real_esito==='A'?'Trasferta':'Pareggio'}
                      </div>
                    </>
                  ):(
                    <div style={{...C.serif,fontSize:22,color:'rgba(245,240,232,0.2)'}}>?</div>
                  )}
                </div>
              </div>

              {(p.pred_p_home||p.pred_p_draw||p.pred_p_away)&&(
                <div style={{display:'flex',gap:6,marginTop:10}}>
                  {[{l:'1',v:p.pred_p_home,c:C.cyan},{l:'X',v:p.pred_p_draw,c:'rgba(245,240,232,0.5)'},{l:'2',v:p.pred_p_away,c:C.purple}].map(x=>(
                    <div key={x.l} style={{flex:1,textAlign:'center',padding:'6px 4px',background:'rgba(255,255,255,0.02)',borderRadius:8}}>
                      <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:9,color:'rgba(245,240,232,0.25)',marginBottom:2}}>{x.l}</div>
                      <div style={{...C.serif,fontSize:13,color:x.c}}>{x.v?(x.v*100).toFixed(0)+'%':'—'}</div>
                    </div>
                  ))}
                </div>
              )}

              {p.pred_confidenza&&(
                <div style={{marginTop:8,textAlign:'right',fontFamily:"'Space Grotesk', sans-serif",fontSize:10,color:'rgba(245,240,232,0.3)'}}>
                  Confidenza: <span style={{color:p.pred_confidenza==='ALTA'?C.green:p.pred_confidenza==='MEDIA'?C.cyan:'rgba(245,240,232,0.5)'}}>{p.pred_confidenza}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Storico() {
  const [session,setSession]=useState(null)
  const [tab,setTab]=useState('scalate')
  const [storico,setStorico]=useState([])
  const [loadingScalate,setLoadingScalate]=useState(true)
  const [pronostici,setPronostici]=useState([])
  const [stats,setStats]=useState(null)
  const [loadingPron,setLoadingPron]=useState(false)
  const [pronCaricati,setPronCaricati]=useState(false)

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>setSession(session))
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s))
    return ()=>subscription.unsubscribe()
  },[])

  const userId=session?.user?.id

  useEffect(()=>{
    if(!userId) return
    supabase.from('user_data').select('storico').eq('user_id',userId).single()
      .then(({data})=>{if(data?.storico)setStorico(data.storico);setLoadingScalate(false)})
      .catch(()=>setLoadingScalate(false))
  },[userId])

  useEffect(()=>{
    if(tab!=='pronostici'||pronCaricati) return
    setLoadingPron(true)
    Promise.all([
      supabase.from('pronostici_storico').select('*').order('data',{ascending:false}).limit(120),
      supabase.from('app_config').select('value').eq('key','pronostici_stats').single(),
    ]).then(([{data:pData},{data:sData}])=>{
      if(pData) setPronostici(pData)
      if(sData?.value){try{setStats(JSON.parse(sData.value))}catch{}}
      setPronCaricati(true)
      setLoadingPron(false)
    }).catch(()=>setLoadingPron(false))
  },[tab,pronCaricati])

  if(loadingScalate&&tab==='scalate') return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:32,height:32,borderRadius:'50%',border:`2px solid rgba(0,212,255,0.1)`,borderTop:`2px solid ${C.cyan}`,animation:'spin 1s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:"'Space Grotesk', sans-serif"}}>
      <style>{GLOBAL_CSS}</style>
      <div style={C.page}>
        <div style={{marginBottom:24}}>
          <div style={{fontFamily:"'Orbitron', sans-serif",fontSize:26,color:C.text,letterSpacing:2}}>Storico</div>
          <div style={{fontSize:12,color:'rgba(245,240,232,0.3)',marginTop:4}}>{tab==='scalate'?'Le tue scalate passate':'Tracking accuratezza modello'}</div>
        </div>

        <div style={{display:'flex',gap:4,marginBottom:24,background:'rgba(255,255,255,0.03)',borderRadius:99,padding:'4px'}}>
          {[{k:'scalate',l:'📈 Scalate'},{k:'pronostici',l:'🎯 Pronostici'}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{flex:1,padding:'10px 0',borderRadius:99,border:'none',fontFamily:"'Space Grotesk', sans-serif",fontSize:13,fontWeight:600,cursor:'pointer',transition:'all 0.25s',background:tab===t.k?`linear-gradient(135deg, ${C.cyan}, ${C.purple})`:'transparent',color:tab===t.k?'#080812':'rgba(245,240,232,0.4)',boxShadow:tab===t.k?`0 0 20px rgba(0,212,255,0.25)`:'none'}}>
              {t.l}
            </button>
          ))}
        </div>

        {tab==='scalate'
          ?<TabScalate storico={storico}/>
          :<TabPronostici pronostici={pronostici} stats={stats} loading={loadingPron}/>
        }
      </div>
    </div>
  )
}
