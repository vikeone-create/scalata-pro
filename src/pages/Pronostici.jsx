import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { T, GLOBAL_CSS } from '../theme'

const confColor = c => ({ ALTA: T.green, MEDIA: T.gold, BASSA: T.red }[c] || 'rgba(245,240,232,0.3)')
const pct = v => v !== undefined && v !== null ? `${v}%` : '—'
const fmt2 = v => v !== undefined && v !== null ? Number(v).toFixed(2) : '—'

function Spinner() {
  return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:36, height:36, borderRadius:'50%', border:`2px solid ${T.cyan}18`, borderTop:`2px solid ${T.cyan}`, animation:'spin 1s linear infinite' }}/>
    </div>
  )
}

// ── FORM DOTS ─────────────────────────────────────────────────────────────────
function FormDots({ form }) {
  if (!form?.length) return null
  return (
    <div style={{ display:'flex', gap:3 }}>
      {form.slice(0,5).map((r,i) => (
        <div key={i} style={{ width:20, height:20, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:800, background: r.result==='W'?'rgba(0,255,150,0.15)':r.result==='D'?'rgba(201,168,76,0.15)':'rgba(255,68,68,0.15)', border:`1px solid ${r.result==='W'?T.green+'44':r.result==='D'?T.gold+'44':T.red+'44'}`, color: r.result==='W'?T.green:r.result==='D'?T.gold:T.red }}>
          {r.result}
        </div>
      ))}
    </div>
  )
}

// ── XG BAR ────────────────────────────────────────────────────────────────────
function XGBar({ xgH, xgA }) {
  const total = (xgH||0) + (xgA||0) || 1
  return (
    <div style={{ marginTop:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', ...T.sg, fontSize:10, color:'rgba(245,240,232,0.35)', marginBottom:4 }}>
        <span>xG {fmt2(xgH)}</span>
        <span style={{ fontSize:8, letterSpacing:2, color:'rgba(245,240,232,0.18)' }}>EXPECTED GOALS</span>
        <span>xG {fmt2(xgA)}</span>
      </div>
      <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden', display:'flex' }}>
        <div style={{ height:'100%', width:`${(xgH/total)*100}%`, background:`linear-gradient(90deg,${T.cyan},${T.purple})`, borderRadius:99 }}/>
      </div>
    </div>
  )
}

// ── MERCATO ROW ───────────────────────────────────────────────────────────────
function MercatoRow({ label, yes, no, yesLabel='Sì', noLabel='No', highlight }) {
  const yVal = Number(yes||0)
  const nVal = Number(no||0)
  const total = yVal + nVal || 100
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
        <span style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.4)' }}>{label}</span>
        <div style={{ display:'flex', gap:6 }}>
          <span style={{ ...T.orb, fontSize:11, color: highlight==='yes'?T.green:T.cyan }}>{yesLabel} {pct(yes)}</span>
          <span style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.25)' }}>|</span>
          <span style={{ ...T.orb, fontSize:11, color:'rgba(245,240,232,0.4)' }}>{noLabel} {pct(no)}</span>
        </div>
      </div>
      <div style={{ height:3, background:'rgba(255,255,255,0.05)', borderRadius:99, overflow:'hidden', display:'flex' }}>
        <div style={{ height:'100%', width:`${(yVal/total)*100}%`, background: highlight==='yes'?T.green:T.cyan, borderRadius:99 }}/>
      </div>
    </div>
  )
}

// ── H2H MINI ─────────────────────────────────────────────────────────────────
function H2HMini({ h2h, home }) {
  if (!h2h?.length) return null
  return (
    <div style={{ marginTop:12, padding:'10px 12px', background:'rgba(255,255,255,0.02)', borderRadius:10 }}>
      <div style={{ ...T.label, marginBottom:8 }}>Scontri diretti</div>
      {h2h.map((m,i) => {
        const isHome = m.home?.toLowerCase().includes(home?.toLowerCase().split(' ')[0])
        const hScore = m.score?.home ?? '?'
        const aScore = m.score?.away ?? '?'
        const homeWon = hScore > aScore
        const draw = hScore === aScore
        return (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
            <span style={{ ...T.sg, fontSize:9, color:'rgba(245,240,232,0.2)', minWidth:50 }}>
              {m.date ? new Date(m.date).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'2-digit'}) : ''}
            </span>
            <span style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.5)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {m.home} vs {m.away}
            </span>
            <span style={{ ...T.orb, fontSize:11, color: draw?T.gold:homeWon?T.green:T.red, minWidth:30, textAlign:'right' }}>
              {hScore}-{aScore}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── VALUE BADGE ───────────────────────────────────────────────────────────────
function ValueBadge({ valueBet }) {
  if (!valueBet) return null
  return (
    <div style={{ marginTop:10, padding:'10px 12px', background:`${T.green}06`, border:`1px solid ${T.green}22`, borderRadius:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <div style={{ ...T.sg, fontSize:11, fontWeight:700, color:T.green }}>⚡ VALUE BET — {valueBet.outcome?.toUpperCase()}</div>
        {valueBet.bestOdds && <div style={{ ...T.orb, fontSize:13, color:T.gold }}>{valueBet.bestOdds} <span style={{ ...T.sg, fontSize:9, color:'rgba(245,240,232,0.3)' }}>{valueBet.bestBookmaker}</span></div>}
      </div>
      <div style={{ ...T.sg, fontSize:9, color:`${T.green}70`, lineHeight:1.5 }}>
        La quota offre più valore del rischio reale stimato dal modello
      </div>
    </div>
  )
}

// ── CARD PRONOSTICO ───────────────────────────────────────────────────────────
function CardPronostico({ p, isOpen, onToggle }) {
  const f = p.fixture
  const m = p.markets
  const cc = confColor(p.confidenza)
  const hasValue = !!p.value_bet

  return (
    <div style={{ ...T.card, overflow:'hidden', border:`1px solid ${hasValue?T.green+'30':cc+'20'}`, boxShadow:hasValue?`0 0 20px ${T.green}08`:'none', marginBottom:10 }}>

      {/* ── HEADER SEMPRE VISIBILE ── */}
      <div onClick={onToggle} style={{ padding:'16px', cursor:'pointer' }}>

        {/* Lega + orario + badge */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.3)' }}>{f?.leagueFlag} {f?.league} · {f?.time}</div>
          <div style={{ display:'flex', gap:5 }}>
            {hasValue && <div style={{ ...T.sg, fontSize:8, padding:'2px 7px', borderRadius:99, background:`${T.green}18`, border:`1px solid ${T.green}44`, color:T.green, fontWeight:700 }}>⚡ VALUE</div>}
            <div style={{ ...T.sg, fontSize:8, padding:'2px 8px', borderRadius:99, background:`${cc}15`, border:`1px solid ${cc}40`, color:cc, fontWeight:700, letterSpacing:1 }}>{p.confidenza}</div>
          </div>
        </div>

        {/* Squadre + esito principale */}
        {(() => {
          // Determina esito principale
          const probs = [
            { label: '1', team: f?.home_display, value: p.p_home, color: T.cyan },
            { label: 'X', team: 'Pareggio',      value: p.p_draw, color: T.gold },
            { label: '2', team: f?.away_display, value: p.p_away, color: T.purple },
          ]
          const top = probs.reduce((best, cur) => cur.value > best.value ? cur : best, probs[0])
          return (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <div style={{ flex:1, textAlign:'right' }}>
                  <div style={{ ...T.sg, fontSize:13, fontWeight:600, color:T.text }}>{f?.home_display}</div>
                  {p.home_form_score !== undefined && <div style={{ ...T.sg, fontSize:9, color:'rgba(245,240,232,0.25)', marginTop:2 }}>Forma {p.home_form_score}%</div>}
                </div>
                <div style={{ flexShrink:0, textAlign:'center', minWidth:100, padding:'6px 10px', background:'rgba(255,255,255,0.02)', borderRadius:10 }}>
                  <div style={{ ...T.orb, fontSize:28, fontWeight:900, lineHeight:1, color: top.color }}>
                    {top.label}
                  </div>
                  <div style={{ ...T.sg, fontSize:11, color:top.color, marginTop:3, fontWeight:600 }}>{top.value.toFixed(0)}%</div>
                  <div style={{ ...T.sg, fontSize:7, color:'rgba(245,240,232,0.2)', letterSpacing:2, marginTop:3 }}>ESITO PREVISTO</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ ...T.sg, fontSize:13, fontWeight:600, color:T.text }}>{f?.away_display}</div>
                  {p.away_form_score !== undefined && <div style={{ ...T.sg, fontSize:9, color:'rgba(245,240,232,0.25)', marginTop:2 }}>Forma {p.away_form_score}%</div>}
                </div>
              </div>

              {/* Mini barre 1 X 2 */}
              <div style={{ display:'flex', gap:4, marginBottom:10 }}>
                {probs.map(x => (
                  <div key={x.label} style={{ flex: x.value, minWidth:30 }}>
                    <div style={{ height:4, background:x.color, borderRadius:99, opacity:0.7 }}/>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
                      <span style={{ ...T.sg, fontSize:9, color:'rgba(245,240,232,0.4)' }}>{x.label}</span>
                      <span style={{ ...T.sg, fontSize:9, color:x.color, fontWeight:600 }}>{x.value.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        })()}

        <XGBar xgH={p.xg_home} xgA={p.xg_away} />

        {/* Importanza partita */}
        {p.importanza?.tags?.length > 0 && (
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:8 }}>
            {p.importanza.tags.map((tag,i) => (
              <span key={i} style={{ ...T.sg, fontSize:9, padding:'2px 7px', borderRadius:99, background:'rgba(255,255,255,0.05)', color:'rgba(245,240,232,0.45)', border:'1px solid rgba(255,255,255,0.08)' }}>{tag}</span>
            ))}
          </div>
        )}

        {/* Preview mercati — tutti i principali */}
        {m && (
          <div style={{ marginTop:10 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, marginBottom:5 }}>
              {[
                { l:'GG',    v:`${m.btts?.yes}%`,                 c: m.btts?.yes > 55 ? T.green : 'rgba(245,240,232,0.5)' },
                { l:'NG',    v:`${m.btts?.no}%`,                  c: m.btts?.no > 55 ? T.green : 'rgba(245,240,232,0.5)' },
                { l:'O1.5',  v:`${m.over_under?.['1_5']?.over}%`, c: m.over_under?.['1_5']?.over > 70 ? T.cyan : 'rgba(245,240,232,0.5)' },
                { l:'O2.5',  v:`${m.over_under?.['2_5']?.over}%`, c: m.over_under?.['2_5']?.over > 55 ? T.cyan : 'rgba(245,240,232,0.5)' },
                { l:'U2.5',  v:`${m.over_under?.['2_5']?.under}%`,c: m.over_under?.['2_5']?.under > 55 ? T.purple : 'rgba(245,240,232,0.5)' },
                { l:'O3.5',  v:`${m.over_under?.['3_5']?.over}%`, c:'rgba(245,240,232,0.5)' },
              ].map(s => (
                <div key={s.l} style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'6px 4px', textAlign:'center' }}>
                  <div style={{ ...T.orb, fontSize:12, color:s.c }}>{s.v}</div>
                  <div style={{ ...T.label, marginBottom:0, marginTop:1, fontSize:8 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
              {[
                { l:'DC 1X', v:`${m.doppia_chance?.['1X']}%`, c:'rgba(245,240,232,0.5)' },
                { l:'DC X2', v:`${m.doppia_chance?.['X2']}%`, c:'rgba(245,240,232,0.5)' },
                { l:'DC 12', v:`${m.doppia_chance?.['12']}%`, c:'rgba(245,240,232,0.5)' },
                { l:'C O8.5', v:`${m.corners?.over_8_5}%`,   c: m.corners?.over_8_5 > 55 ? T.gold : 'rgba(245,240,232,0.5)' },
                { l:'C U8.5', v:`${m.corners?.under_8_5}%`,  c:'rgba(245,240,232,0.5)' },
                { l:'Corner', v:m.corners?.totale_stimati,    c:T.gold },
              ].map(s => (
                <div key={s.l} style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'6px 4px', textAlign:'center' }}>
                  <div style={{ ...T.orb, fontSize:12, color:s.c }}>{s.v}</div>
                  <div style={{ ...T.label, marginBottom:0, marginTop:1, fontSize:8 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasValue && !isOpen && (
          <div style={{ marginTop:8, ...T.sg, fontSize:10, color:T.green }}>
            ⚡ Value su {p.value_bet.outcome} · quota {p.value_bet.bestOdds} ({p.value_bet.bestBookmaker})
          </div>
        )}

        <div style={{ marginTop:8, ...T.sg, fontSize:9, color:'rgba(245,240,232,0.18)', textAlign:'right' }}>{isOpen?'▲':'▼ analisi completa'}</div>
      </div>

      {/* ── DETTAGLIO ESPANSO ── */}
      {isOpen && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'14px 16px' }}>

          <ValueBadge valueBet={p.value_bet} />

          {/* 1X2 probabilità */}
          <div style={{ marginTop:14, marginBottom:14 }}>
            <div style={T.label}>Probabilità 1X2</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
              {[
                { l:'Casa', v:p.p_home, c:T.cyan },
                { l:'Pareggio', v:p.p_draw, c:T.gold },
                { l:'Trasferta', v:p.p_away, c:T.purple },
              ].map(s => (
                <div key={s.l} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'10px 6px', textAlign:'center' }}>
                  <div style={{ ...T.orb, fontSize:18, color:s.c }}>{pct(s.v)}</div>
                  <div style={{ ...T.label, marginBottom:0, marginTop:3 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top risultati esatti */}
          {p.top_scores?.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={T.label}>Risultati esatti più probabili</div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {p.top_scores.slice(0,6).map((s,j) => (
                  <div key={j} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ ...T.orb, fontSize:13, color:j===0?T.cyan:'rgba(245,240,232,0.35)', minWidth:28 }}>{s.score}</div>
                    <div style={{ flex:1, height:4, background:'rgba(255,255,255,0.05)', borderRadius:99 }}>
                      <div style={{ height:'100%', width:`${Math.min(100,s.prob*5)}%`, background:j===0?`linear-gradient(90deg,${T.cyan},${T.purple})`:'rgba(245,240,232,0.15)', borderRadius:99 }}/>
                    </div>
                    <div style={{ ...T.sg, fontSize:11, color:'rgba(245,240,232,0.35)', minWidth:34, textAlign:'right' }}>{s.prob}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risultati esatti a gruppi — stile Eurobet */}
          {m?.grouped_scores && (
            <div style={{ marginBottom:14 }}>
              <div style={T.label}>Ris. esatto a gruppi</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
                {[
                  { label:'1-0 / 2-0 / 3-0',         key:'casa_clean_light', c:T.cyan },
                  { label:'0-1 / 0-2 / 0-3',         key:'away_clean_light', c:T.purple },
                  { label:'2-1 / 3-1 / 4-1',         key:'casa_away1',       c:T.cyan },
                  { label:'1-2 / 1-3 / 1-4',         key:'away_home1',       c:T.purple },
                  { label:'4-0 / 5-0 / 6-0',         key:'casa_clean_heavy', c:T.cyan },
                  { label:'0-4 / 0-5 / 0-6',         key:'away_clean_heavy', c:T.purple },
                  { label:'3-2 / 4-2 / 4-3 / 5-1',   key:'casa_high',        c:T.cyan },
                  { label:'2-3 / 2-4 / 3-4 / 1-5',   key:'away_high',        c:T.purple },
                  { label:'Sq.1 altro',              key:'sq1_altro',        c:'rgba(245,240,232,0.5)' },
                  { label:'Sq.2 altro',              key:'sq2_altro',        c:'rgba(245,240,232,0.5)' },
                  { label:'Pareggio (X)',            key:'draw_any',         c:T.gold },
                ].map(row => {
                  const val = m.grouped_scores[row.key]
                  if (val === undefined) return null
                  return (
                    <div key={row.key} style={{ padding:'8px 10px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:8, textAlign:'center' }}>
                      <div style={{ ...T.sg, fontSize:9, color:'rgba(245,240,232,0.4)', marginBottom:3 }}>{row.label}</div>
                      <div style={{ ...T.orb, fontSize:14, color:row.c, fontWeight:700 }}>{val}%</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
            <div style={{ marginBottom:14 }}>
              <div style={T.label}>Mercati</div>

              {/* BTTS */}
              <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
                <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.4)', marginBottom:6, fontWeight:600 }}>⚽ GG / NG (Goal / No Goal)</div>
                <MercatoRow label="Entrambe segnano" yes={m.btts?.yes} no={m.btts?.no} yesLabel="GG" noLabel="NG" highlight={m.btts?.yes > 55 ? 'yes' : 'no'} />
              </div>

              {/* Over/Under */}
              <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
                <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.4)', marginBottom:8, fontWeight:600 }}>📈 Over / Under</div>
                {['0_5','1_5','2_5','3_5','4_5'].map(k => (
                  <MercatoRow key={k} label={`O/U ${k.replace('_','.')}`}
                    yes={m.over_under?.[k]?.over} no={m.over_under?.[k]?.under}
                    yesLabel="Over" noLabel="Under"
                    highlight={m.over_under?.[k]?.over > 55 ? 'yes' : 'no'}
                  />
                ))}
              </div>

              {/* Multigol */}
              <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
                <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.4)', marginBottom:8, fontWeight:600 }}>🎯 Multigol</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div>
                    <div style={{ ...T.sg, fontSize:9, color:'rgba(245,240,232,0.3)', marginBottom:4 }}>CASA</div>
                    {['0','1','2','3+','1-2','2-3'].map(k => (
                      <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ ...T.sg, fontSize:9, color:'rgba(245,240,232,0.4)' }}>{k} gol</span>
                        <span style={{ ...T.orb, fontSize:10, color:T.cyan }}>{pct(m.multigol_casa?.[k])}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ ...T.sg, fontSize:9, color:'rgba(245,240,232,0.3)', marginBottom:4 }}>TRASFERTA</div>
                    {['0','1','2','3+','1-2','2-3'].map(k => (
                      <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ ...T.sg, fontSize:9, color:'rgba(245,240,232,0.4)' }}>{k} gol</span>
                        <span style={{ ...T.orb, fontSize:10, color:T.purple }}>{pct(m.multigol_trasferta?.[k])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Doppia chance + Combo */}
              <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
                <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.4)', marginBottom:8, fontWeight:600 }}>🎲 Doppia chance / Combo</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                  {Object.entries(m.doppia_chance||{}).map(([k,v]) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'4px 8px', background:'rgba(255,255,255,0.02)', borderRadius:6 }}>
                      <span style={{ ...T.sg, fontSize:9, color:'rgba(245,240,232,0.45)' }}>{k}</span>
                      <span style={{ ...T.orb, fontSize:10, color:T.cyan }}>{pct(v)}</span>
                    </div>
                  ))}
                  {Object.entries(m.combo_1x2_gg||{}).map(([k,v]) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'4px 8px', background:'rgba(255,255,255,0.02)', borderRadius:6 }}>
                      <span style={{ ...T.sg, fontSize:9, color:'rgba(245,240,232,0.45)' }}>{k}</span>
                      <span style={{ ...T.orb, fontSize:10, color:T.green }}>{pct(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Corner */}
              {m.corners && (
                <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
                  <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.4)', marginBottom:8, fontWeight:600 }}>📐 Corner (stima)</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:8 }}>
                    {[
                      { l:'Casa', v:m.corners.casa_stimati },
                      { l:'Trasferta', v:m.corners.trasferta_stimati },
                      { l:'Totale', v:m.corners.totale_stimati },
                    ].map(s => (
                      <div key={s.l} style={{ textAlign:'center', padding:'6px', background:'rgba(255,255,255,0.02)', borderRadius:8 }}>
                        <div style={{ ...T.orb, fontSize:14, color:T.gold }}>{s.v}</div>
                        <div style={{ ...T.label, marginBottom:0, marginTop:2, fontSize:8 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <MercatoRow label="O/U 8.5 corner" yes={m.corners.over_8_5} no={m.corners.under_8_5} yesLabel="Over" noLabel="Under" />
                </div>
              )}

              {/* Primo tempo */}
              {m.primo_tempo && (
                <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
                  <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.4)', marginBottom:8, fontWeight:600 }}>⏱ Esito primo tempo</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                    {[
                      { l:'Casa', v:m.primo_tempo.casa, c:T.cyan },
                      { l:'Pareggio', v:m.primo_tempo.pareggio, c:T.gold },
                      { l:'Trasferta', v:m.primo_tempo.trasferta, c:T.purple },
                    ].map(s => (
                      <div key={s.l} style={{ textAlign:'center', padding:'8px 4px', background:'rgba(255,255,255,0.02)', borderRadius:8 }}>
                        <div style={{ ...T.orb, fontSize:14, color:s.c }}>{pct(s.v)}</div>
                        <div style={{ ...T.label, marginBottom:0, marginTop:2 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Forma */}
          {(p.home_form?.length > 0 || p.away_form?.length > 0) && (
            <div style={{ marginBottom:12 }}>
              <div style={T.label}>Forma recente</div>
              {[{team:f?.home_display, form:p.home_form},{team:f?.away_display, form:p.away_form}].map(({team,form}) => form?.length > 0 && (
                <div key={team} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.35)', minWidth:70, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{team}</div>
                  <FormDots form={form}/>
                </div>
              ))}
            </div>
          )}

          {/* H2H */}
          <H2HMini h2h={p.h2h} home={f?.home_display} />

          {/* Infortuni */}
          {p.injuries?.length > 0 && (
            <div style={{ padding:'10px 12px', background:`${T.red}06`, border:`1px solid ${T.red}18`, borderRadius:10, marginBottom:10, marginTop:10 }}>
              <div style={{ ...T.label, color:`${T.red}60`, marginBottom:4 }}>INFORTUNI / SQUALIFICHE</div>
              <div style={{ ...T.sg, fontSize:11, color:'rgba(245,240,232,0.5)', lineHeight:1.7 }}>
                {p.injuries.map(inj => `${inj.player} (${inj.type})`).join(' · ')}
              </div>
            </div>
          )}

          {/* Notizie AI */}
          {p.context?.notizia_chiave && (
            <div style={{ padding:'10px 12px', background:`${T.gold}06`, border:`1px solid ${T.gold}18`, borderRadius:10, marginBottom:10 }}>
              <div style={{ ...T.label, color:`${T.gold}60`, marginBottom:4 }}>NOTIZIE</div>
              <div style={{ ...T.sg, fontSize:11, color:'rgba(245,240,232,0.55)', lineHeight:1.6 }}>{p.context.notizia_chiave}</div>
            </div>
          )}

          {/* Footer modello */}
          <div style={{ ...T.sg, fontSize:9, color:'rgba(245,240,232,0.18)', lineHeight:1.8 }}>
            Poisson v2 · {p.fixture?.league}
            {p.form_adjusted?' · Forma ✓':''}
            {p.h2h?.length?` · H2H (${p.h2h.length})`:''}
            {p.best_odds?' · Quote ✓':''}
          </div>
        </div>
      )}
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Pronostici() {
  const [pronostici, setPronostici] = useState([])
  const [generatoAlle, setGeneratoAlle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [nota, setNota] = useState(null)
  const today = new Date().toISOString().split('T')[0]

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('pronostici_giornalieri').select('*').eq('data', today).single()
    if (data?.pronostici?.length) {
      setPronostici(data.pronostici)
      setGeneratoAlle(data.generato_alle)
    } else {
      setPronostici([])
      setNota('Pronostici non ancora disponibili per oggi.')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const valueBets = pronostici.filter(p => p.value_bet).length

  if (loading) return <Spinner />

  return (
    <div style={{ minHeight:'100vh', background:T.bg }}>
      <style>{GLOBAL_CSS}</style>
      <div style={T.page}>

        {/* Header */}
        <div style={{ marginBottom:20, animation:'fadeUp 0.3s ease' }}>
          <div style={{ ...T.orb, fontSize:26, fontWeight:700, letterSpacing:2 }}>
            <span style={{ color:T.text }}>PRONOSTICI</span>
            <span style={{ background:`linear-gradient(135deg,${T.cyan},${T.purple})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}> AI</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
            <div style={{ ...T.sg, fontSize:11, color:'rgba(245,240,232,0.25)' }}>Poisson · Value Bet · Mercati</div>
            {generatoAlle && <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.18)' }}>{new Date(generatoAlle).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</div>}
          </div>
        </div>

        {/* Stats */}
        {pronostici.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
            {[
              { l:'Acc 1X2', v:'44.9%', c:T.green },
              { l:'Esatti', v:'11.8%', c:T.cyan },
              { l:'Value oggi', v:valueBets, c:valueBets>0?T.green:'rgba(245,240,232,0.3)' },
            ].map(s => (
              <div key={s.l} style={{ ...T.card, padding:'10px 8px', textAlign:'center' }}>
                <div style={{ ...T.orb, fontSize:16, color:s.c }}>{s.v}</div>
                <div style={{ ...T.label, marginBottom:0, marginTop:3 }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        {pronostici.length > 0 && (
          <div style={{ padding:'8px 12px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:8, ...T.sg, fontSize:10, color:'rgba(245,240,232,0.18)', marginBottom:16, textAlign:'center', lineHeight:1.8 }}>
            ⚠️ Solo uso educativo · Modello statistico · Nessun risultato garantito
          </div>
        )}

        {/* Empty */}
        {pronostici.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', animation:'fadeUp 0.4s ease' }}>
            <div style={{ fontSize:48, marginBottom:14, opacity:0.15 }}>⚽</div>
            <div style={{ ...T.sg, fontSize:14, color:'rgba(245,240,232,0.3)', marginBottom:8 }}>{nota || 'Pronostici non disponibili'}</div>
            <div style={{ ...T.sg, fontSize:12, color:'rgba(245,240,232,0.18)', lineHeight:2 }}>
              Generati ogni mattina alle 06:00<br/>Poisson + H2H + Standings + Bookmaker
            </div>
            <button onClick={load} style={{ ...T.btnGhost, marginTop:20 }}>Ricarica</button>
          </div>
        )}

        {/* Cards raggruppate per lega */}
        {(() => {
          const LEAGUE_ORDER = ['Champions League','Europa League','Serie A','Premier League','La Liga','Bundesliga','Ligue 1']
          const grouped = {}
          pronostici.forEach((p, i) => {
            const league = p.fixture?.league || 'Altro'
            if (!grouped[league]) grouped[league] = []
            grouped[league].push({ p, i })
          })
          const sortedLeagues = Object.keys(grouped).sort((a,b) => {
            const ia = LEAGUE_ORDER.indexOf(a)
            const ib = LEAGUE_ORDER.indexOf(b)
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
          })
          return sortedLeagues.map(league => (
            <div key={league}>
              {/* Header lega */}
              <div style={{ display:'flex', alignItems:'center', gap:8, margin:'16px 0 8px', padding:'0 4px' }}>
                <div style={{ ...T.sg, fontSize:11, fontWeight:700, letterSpacing:2, color:'rgba(245,240,232,0.35)', textTransform:'uppercase' }}>
                  {grouped[league][0].p.fixture?.leagueFlag} {league}
                </div>
                <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }}/>
                <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.2)' }}>{grouped[league].length} partite</div>
              </div>
              {grouped[league].map(({ p, i }) => (
                <CardPronostico
                  key={i}
                  p={p}
                  isOpen={expanded === i}
                  onToggle={() => setExpanded(expanded === i ? null : i)}
                />
              ))}
            </div>
          ))
        })()}

        <div style={{ height:20 }}/>
      </div>
    </div>
  )
}
