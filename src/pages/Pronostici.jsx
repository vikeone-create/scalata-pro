import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { T, GLOBAL_CSS } from '../theme'

const confColor = c => ({ ALTA: T.green, MEDIA: T.gold, BASSA: T.red }[c] || 'rgba(245,240,232,0.3)')

function Spinner() {
  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid rgba(0,212,255,0.1)`, borderTop: `2px solid ${T.cyan}`, animation: 'spin 1s linear infinite' }} />
    </div>
  )
}

function FormDots({ form }) {
  if (!form?.length) return null
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {form.slice(0, 5).map((r, i) => (
        <div key={i} title={`${r.scored}-${r.conceded}`} style={{ width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, background: r.result === 'W' ? 'rgba(0,255,150,0.15)' : r.result === 'D' ? 'rgba(201,168,76,0.15)' : 'rgba(255,68,68,0.15)', border: `1px solid ${r.result === 'W' ? T.green + '44' : r.result === 'D' ? T.gold + '44' : T.red + '44'}`, color: r.result === 'W' ? T.green : r.result === 'D' ? T.gold : T.red }}>
          {r.result}
        </div>
      ))}
    </div>
  )
}

function XGBar({ xgH, xgA }) {
  const total = (xgH || 0) + (xgA || 0) || 1
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.35)', marginBottom: 4 }}>
        <span>xG {xgH?.toFixed(2)}</span>
        <span style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(245,240,232,0.18)' }}>EXPECTED GOALS</span>
        <span>xG {xgA?.toFixed(2)}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
        <div style={{ height: '100%', width: `${(xgH / total) * 100}%`, background: `linear-gradient(90deg, ${T.cyan}, ${T.purple})`, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

function ValueBadge({ valueBet }) {
  if (!valueBet) return null
  const isDouble = valueBet.signal === 'DOPPIO_VALUE'
  return (
    <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(0,255,150,0.05)', border: `1px solid ${T.green}33`, borderRadius: 12, boxShadow: `0 0 16px ${T.green}08` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ ...T.sg, fontSize: 11, fontWeight: 700, color: T.green }}>{isDouble ? '⚡⚡ DOPPIO VALUE BET' : '⚡ VALUE BET'}</div>
        <div style={{ ...T.sg, fontSize: 9, color: `${T.green}80`, letterSpacing: 1 }}>{valueBet.outcome?.toUpperCase()}</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {valueBet.bestOdds && (
          <div style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ ...T.orb, fontSize: 17, color: T.gold }}>{valueBet.bestOdds}</div>
            <div style={{ ...T.sg, fontSize: 8, color: 'rgba(245,240,232,0.25)', marginTop: 2 }}>{valueBet.bestBookmaker || 'BOOKMAKER'}</div>
          </div>
        )}
        <div style={{ flex: 1, padding: '8px', background: 'rgba(0,255,150,0.06)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ ...T.orb, fontSize: 17, color: T.green }}>+{Math.max(valueBet.valueBook || 0, valueBet.valueBetfair || 0)}%</div>
          <div style={{ ...T.sg, fontSize: 8, color: `${T.green}60`, marginTop: 2 }}>VALUE EDGE</div>
        </div>
      </div>
      <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.3)', marginTop: 8, lineHeight: 1.6 }}>
        Il modello Poisson stima probabilità più alta del mercato
      </div>
    </div>
  )
}

function OddsRow({ label, pModel, bfOdds, bfProb, bmOdds, bmProb, bmBook, isValue, vBf, vBm }) {
  return (
    <div style={{ padding: '10px 12px', background: isValue ? 'rgba(0,255,150,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isValue ? T.green + '25' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ ...T.sg, fontSize: 12, fontWeight: 600, color: isValue ? T.green : 'rgba(245,240,232,0.55)' }}>{label}</div>
        <div style={{ ...T.orb, fontSize: 15, color: T.cyan }}>{pModel}%</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {bfOdds && (
          <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.35)' }}>
            BF: <span style={{ color: T.gold }}>{bfOdds}</span>
            <span style={{ color: 'rgba(245,240,232,0.2)', marginLeft: 3 }}>({bfProb}%)</span>
            {vBf && <span style={{ marginLeft: 5, color: T.green, fontWeight: 700 }}>{vBf.value > 0 ? '+' : ''}{vBf.value}%</span>}
          </div>
        )}
        {bmOdds && (
          <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.35)' }}>
            {bmBook}: <span style={{ color: T.gold }}>{bmOdds}</span>
            <span style={{ color: 'rgba(245,240,232,0.2)', marginLeft: 3 }}>({bmProb}%)</span>
            {vBm && <span style={{ marginLeft: 5, color: T.green, fontWeight: 700 }}>{vBm.value > 0 ? '+' : ''}{vBm.value}%</span>}
          </div>
        )}
      </div>
    </div>
  )
}

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
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <style>{GLOBAL_CSS}</style>
      <div style={T.page}>

        {/* Header */}
        <div style={{ marginBottom: 20, animation: 'fadeUp 0.3s ease' }}>
          <div style={{ ...T.orb, fontSize: 26, fontWeight: 700, letterSpacing: 2 }}>
            <span style={{ color: T.text }}>PRONOSTICI</span>
            <span style={{ background: `linear-gradient(135deg, ${T.cyan}, ${T.purple})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}> AI</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.25)' }}>Poisson · Value Bet · Bookmaker</div>
            {generatoAlle && <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.18)' }}>{new Date(generatoAlle).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>}
          </div>
        </div>

        {/* Stats */}
        {pronostici.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { l: 'Acc 1X2', v: '44.9%', c: T.green },
              { l: 'Esatti', v: '11.8%', c: T.cyan },
              { l: 'Value oggi', v: valueBets, c: valueBets > 0 ? T.green : 'rgba(245,240,232,0.3)' },
            ].map(s => (
              <div key={s.l} style={{ ...T.card, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ ...T.orb, fontSize: 16, color: s.c }}>{s.v}</div>
                <div style={{ ...T.label, marginBottom: 0, marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        {pronostici.length > 0 && (
          <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.18)', marginBottom: 16, textAlign: 'center', lineHeight: 1.8 }}>
            ⚠️ Solo uso educativo · Modello statistico · Nessun risultato garantito
          </div>
        )}

        {/* Empty */}
        {pronostici.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', animation: 'fadeUp 0.4s ease' }}>
            <div style={{ fontSize: 48, marginBottom: 14, opacity: 0.15 }}>⚽</div>
            <div style={{ ...T.sg, fontSize: 14, color: 'rgba(245,240,232,0.3)', marginBottom: 8 }}>{nota || 'Pronostici non disponibili'}</div>
            <div style={{ ...T.sg, fontSize: 12, color: 'rgba(245,240,232,0.18)', lineHeight: 2 }}>
              Generati ogni mattina alle 06:00<br />Poisson + Bookmaker
            </div>
            <button onClick={load} style={{ ...T.btnGhost, marginTop: 20 }}>Ricarica</button>
          </div>
        )}

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pronostici.map((p, i) => {
            const f = p.fixture
            const cc = confColor(p.confidenza)
            const isOpen = expanded === i
            const hasValue = !!p.value_bet

            return (
              <div key={i}
                style={{ ...T.card, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${hasValue ? T.green + '30' : cc + '20'}`, boxShadow: hasValue ? `0 0 20px ${T.green}08` : 'none', animation: `fadeUp ${0.2 + i * 0.05}s ease` }}
                onClick={() => setExpanded(isOpen ? null : i)}
              >
                <div style={{ padding: '16px' }}>
                  {/* League + badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.3)', letterSpacing: 1 }}>{f?.leagueFlag} {f?.league} · {f?.time}</div>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      {hasValue && <div style={{ ...T.sg, fontSize: 8, padding: '2px 7px', borderRadius: 99, background: `${T.green}18`, border: `1px solid ${T.green}44`, color: T.green, fontWeight: 700 }}>⚡ VALUE</div>}
                      <div style={{ ...T.sg, fontSize: 8, padding: '2px 8px', borderRadius: 99, background: `${cc}15`, border: `1px solid ${cc}40`, color: cc, fontWeight: 700, letterSpacing: 1 }}>{p.confidenza}</div>
                    </div>
                  </div>

                  {/* Teams + score */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ ...T.sg, fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.3 }}>{f?.home_display}</div>
                      {p.home_form_score !== undefined && <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.25)', marginTop: 2 }}>Forma {p.home_form_score}%</div>}
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 80 }}>
                      <div style={{ ...T.orb, fontSize: 30, fontWeight: 900, lineHeight: 1, letterSpacing: 4, background: `linear-gradient(135deg, ${T.cyan}, ${T.purple})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {p.gol_casa}<span style={{ fontSize: 20, opacity: 0.4 }}>-</span>{p.gol_trasferta}
                      </div>
                      <div style={{ ...T.sg, fontSize: 7, color: 'rgba(245,240,232,0.2)', letterSpacing: 2, marginTop: 3 }}>PRONOSTICO</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...T.sg, fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.3 }}>{f?.away_display}</div>
                      {p.away_form_score !== undefined && <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.25)', marginTop: 2 }}>Forma {p.away_form_score}%</div>}
                    </div>
                  </div>

                  <XGBar xgH={p.xg_home} xgA={p.xg_away} />

                  {hasValue && !isOpen && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ ...T.sg, fontSize: 10, color: T.green }}>⚡ Value su {p.value_bet.outcome}</div>
                      {p.value_bet.bestOdds && <div style={{ ...T.orb, fontSize: 11, color: T.gold }}>{p.value_bet.bestOdds} ({p.value_bet.bestBookmaker})</div>}
                    </div>
                  )}
                  <div style={{ marginTop: 8, ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.18)', textAlign: 'right' }}>{isOpen ? '▲' : '▼ analisi'}</div>
                </div>

                {/* Dettaglio espanso */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>
                    <ValueBadge valueBet={p.value_bet} />

                    {/* 1X2 odds */}
                    <div style={{ marginTop: 14, marginBottom: 14 }}>
                      <div style={T.label}>Probabilità 1X2</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                          { outcome: 'home', label: f?.home_display?.split(' ')[0] || 'Casa', pModel: p.p_home, bfOdds: p.betfair_odds?.home?.odds, bfProb: p.betfair_odds?.home?.impliedProb, bmOdds: p.best_odds?.home?.odds, bmProb: p.best_odds?.home?.impliedProb, bmBook: p.best_odds?.home?.bookmaker },
                          { outcome: 'draw', label: 'Pareggio', pModel: p.p_draw, bfOdds: p.betfair_odds?.draw?.odds, bfProb: p.betfair_odds?.draw?.impliedProb, bmOdds: p.best_odds?.draw?.odds, bmProb: p.best_odds?.draw?.impliedProb, bmBook: p.best_odds?.draw?.bookmaker },
                          { outcome: 'away', label: f?.away_display?.split(' ')[0] || 'Trasferta', pModel: p.p_away, bfOdds: p.betfair_odds?.away?.odds, bfProb: p.betfair_odds?.away?.impliedProb, bmOdds: p.best_odds?.away?.odds, bmProb: p.best_odds?.away?.impliedProb, bmBook: p.best_odds?.away?.bookmaker },
                        ].map(row => (
                          <OddsRow key={row.outcome} {...row}
                            isValue={row.outcome === p.value_bet?.outcome}
                            vBf={p.value_analysis?.betfair?.[row.outcome]}
                            vBm={p.value_analysis?.bookmaker?.[row.outcome]}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Top risultati */}
                    {p.top_scores?.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={T.label}>Distribuzione risultati</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {p.top_scores.slice(0, 6).map((s, j) => (
                            <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ ...T.orb, fontSize: 13, color: j === 0 ? T.cyan : 'rgba(245,240,232,0.35)', minWidth: 30 }}>{s.score}</div>
                              <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 99 }}>
                                <div style={{ height: '100%', width: `${Math.min(100, s.prob * 6)}%`, background: j === 0 ? `linear-gradient(90deg, ${T.cyan}, ${T.purple})` : 'rgba(245,240,232,0.15)', borderRadius: 99 }} />
                              </div>
                              <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.35)', minWidth: 34, textAlign: 'right' }}>{s.prob}%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Forma */}
                    {(p.home_form?.length > 0 || p.away_form?.length > 0) && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={T.label}>Forma recente</div>
                        {[{ team: f?.home_display, form: p.home_form }, { team: f?.away_display, form: p.away_form }].map(({ team, form }) => form?.length > 0 && (
                          <div key={team} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.35)', minWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team}</div>
                            <FormDots form={form} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Infortuni */}
                    {p.injuries?.length > 0 && (
                      <div style={{ padding: '10px 12px', background: `${T.red}06`, border: `1px solid ${T.red}18`, borderRadius: 10, marginBottom: 10 }}>
                        <div style={{ ...T.label, color: `${T.red}60`, marginBottom: 4 }}>INFORTUNI / SQUALIFICHE</div>
                        <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.5)', lineHeight: 1.7 }}>
                          {p.injuries.map(inj => `${inj.player} (${inj.type})`).join(' · ')}
                        </div>
                      </div>
                    )}

                    {/* Notizie AI */}
                    {p.context?.notizia_chiave && (
                      <div style={{ padding: '10px 12px', background: `${T.gold}06`, border: `1px solid ${T.gold}18`, borderRadius: 10, marginBottom: 10 }}>
                        <div style={{ ...T.label, color: `${T.gold}60`, marginBottom: 4 }}>NOTIZIE</div>
                        <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.55)', lineHeight: 1.6 }}>{p.context.notizia_chiave}</div>
                      </div>
                    )}

                    {/* Footer modello */}
                    <div style={{ marginTop: 10, ...T.sg, fontSize: 9, color: 'rgba(245,240,232,0.18)', lineHeight: 1.8 }}>
                      Poisson · {p.model?.data} · Acc.1X2: {p.model?.accuracy_1x2}{p.form_adjusted ? ' · Forma ✓' : ''}
                      {p.betfair_odds ? ' · BF ✓' : ''}{p.best_odds ? ' · BK ✓' : ''}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ height: 20 }} />
      </div>
    </div>
  )
}
