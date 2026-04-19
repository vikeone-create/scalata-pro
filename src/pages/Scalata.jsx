// ═══════════════════════════════════════════════════════════════════════════════
// SCALATA — v13 clean rewrite, Eurobet-style schedina
// ═══════════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { T, GLOBAL_CSS } from '../theme'

// ─── COSTANTI ─────────────────────────────────────────────────────────────────
const N_GIOCATE = [3, 5, 8, 12, 16, 20, 25]

// ─── HELPER MATH ──────────────────────────────────────────────────────────────
const fmt = n => `€${Number(n || 0).toFixed(2)}`
const fmtDate = d => new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function calcQuotaMedia(c, o, n) { return Math.pow(o / c, 1 / n) }

function classificaTipo(q) {
  if (q >= 2.3) return { tipo: 'aggressiva',   label: 'Aggressiva',   tag: 'ALTO RISCHIO',  color: T.red }
  if (q >= 1.6) return { tipo: 'normale',      label: 'Normale',      tag: 'BILANCIATA',    color: T.gold }
  if (q >= 1.3) return { tipo: 'sicura',       label: 'Sicura',       tag: 'BASSO RISCHIO', color: T.green }
  return               { tipo: 'molto_sicura', label: 'Molto sicura', tag: 'MOLTO SICURA',  color: T.green }
}

function rangeQuote(q) {
  const s = q < 1.5 ? 0.15 : q < 2.0 ? 0.3 : 0.5
  return { min: Math.max(1.05, +(q - s).toFixed(2)), max: +(q + s).toFixed(2) }
}

function calcScalata(capitale, obiettivo, quotaMedia) {
  const steps = []
  const profitTarget = obiettivo - capitale
  let profitoCumulato = 0
  let bankroll = capitale
  for (let i = 0; i < 25; i++) {
    let importo = Math.ceil(((profitTarget - profitoCumulato) / (quotaMedia - 1)) * 100) / 100
    if (importo <= 0) break
    if (importo > bankroll) importo = bankroll
    const vincita = +(importo * quotaMedia).toFixed(2)
    profitoCumulato += vincita - importo
    steps.push({
      step: i + 1,
      importo: +importo.toFixed(2),
      quota: +quotaMedia.toFixed(2),
      vincita,
      bankrollSeVince: +(bankroll - importo + vincita).toFixed(2),
      bankrollSePerde: +(bankroll - importo).toFixed(2),
      done: false,
      esito: null,
    })
    if (profitoCumulato >= profitTarget) break
  }
  return steps
}

// ─── DATA LAYER ───────────────────────────────────────────────────────────────
async function loadData(userId) {
  const { data } = await supabase.from('user_data').select('*').eq('user_id', userId).single()
  return data
}
async function saveData(userId, patch, attempt = 0) {
  try {
    const { error } = await supabase.from('user_data').upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    if (error) throw error
    return { ok: true }
  } catch (e) {
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, (attempt + 1) * 800))
      return saveData(userId, patch, attempt + 1)
    }
    return { ok: false, error: e.message || 'Errore salvataggio' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════
export default function Scalata({ session }) {
  const userId = session?.user?.id
  const [fase, setFase] = useState('lista') // 'lista' | 'setup' | 'caricamento' | 'attiva'
  const [scalate, setScalate] = useState([])
  const [apertaIdx, setApertaIdx] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [error, setError] = useState(null)

  const apertaScalata = apertaIdx !== null ? scalate[apertaIdx] : null

  // ─── LOAD + SYNC ─────────────────────────────────────────────────────────────
  const reload = async () => {
    if (!userId) return
    const d = await loadData(userId)
    let attive = []
    if (d?.scalate_attive?.length) attive = d.scalate_attive
    else if (d?.scalata_attiva) attive = [d.scalata_attiva]
    setScalate(attive)
  }

  useEffect(() => { reload() }, [userId])

  // Auto-sync su focus
  useEffect(() => {
    if (!userId) return
    const sync = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
    }
  }, [userId])

  const persist = async (nuove) => {
    setSaveStatus('saving')
    const r = await saveData(userId, { scalate_attive: nuove })
    if (r.ok) {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } else {
      setSaveStatus('error')
    }
    return r
  }

  const updateScalata = (idx, patch) => {
    const nuove = scalate.map((s, i) => i === idx ? { ...s, ...patch } : s)
    setScalate(nuove)
    persist(nuove)
  }

  const aggiungiScalata = async (nuovaScalata) => {
    const nuove = [...scalate, nuovaScalata]
    setScalate(nuove)
    await persist(nuove)
    setApertaIdx(nuove.length - 1)
    setFase('attiva')
  }

  const archiviaScalata = async (idx, status) => {
    const s = scalate[idx]
    const closed = { ...s, status, closedAt: new Date().toISOString() }
    const d = await loadData(userId)
    const nuovoStorico = [closed, ...(d?.storico || [])].slice(0, 100)
    const nuoveAttive = scalate.filter((_, i) => i !== idx)
    await saveData(userId, { storico: nuovoStorico, scalate_attive: nuoveAttive })
    setScalate(nuoveAttive)
    setApertaIdx(null)
    setFase('lista')
  }

  // ─── ROUTING ─────────────────────────────────────────────────────────────────
  if (fase === 'caricamento') return <Loader />

  if (fase === 'lista') return (
    <SchermataLista
      scalate={scalate}
      saveStatus={saveStatus}
      onRipristina={() => persist(scalate)}
      onApri={i => { setApertaIdx(i); setFase('attiva') }}
      onNuova={() => { setError(null); setFase('setup') }}
    />
  )

  if (fase === 'setup') return (
    <SchermataSetup
      onBack={() => setFase('lista')}
      onCrea={async (payload) => {
        setFase('caricamento')
        try {
          // Fetch partite AI
          const opz = payload.opz
          const res = await fetch(`/api/odds?quotaMin=${opz.range.min}&quotaMax=${opz.range.max}`)
          const odds = await res.json()
          let partite = []
          if (odds?.length) {
            const aiRes = await fetch('/api/analyze', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ matches: odds, scalataType: opz.tipo.tipo, capitale: payload.bankrollInizio, obiettivo: payload.obiettivo }),
            })
            const aiData = await aiRes.json()
            partite = aiData.partite_consigliate || []
          }
          await aggiungiScalata({ ...payload.scalata, partiteConsigliate: partite })
        } catch (e) {
          setError(e.message)
          setFase('setup')
        }
      }}
    />
  )

  if (fase === 'attiva' && apertaScalata) return (
    <SchermataAttiva
      scalata={apertaScalata}
      tutte={scalate}
      apertaIdx={apertaIdx}
      saveStatus={saveStatus}
      onBack={() => { setApertaIdx(null); setFase('lista') }}
      onUpdate={patch => updateScalata(apertaIdx, patch)}
      onArchivia={status => archiviaScalata(apertaIdx, status)}
    />
  )

  return null
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHERMATA 1: LISTA
// ═══════════════════════════════════════════════════════════════════════════════
function SchermataLista({ scalate, saveStatus, onRipristina, onApri, onNuova }) {
  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <style>{GLOBAL_CSS}</style>
      <div style={T.page}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
          <div>
            <div style={{ ...T.orb, fontSize: 28, fontWeight: 700, letterSpacing: 2, color: T.text }}>SCALATA</div>
            <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.3)', marginTop: 4 }}>
              {scalate.length === 0 ? 'Crea la tua prima scalata' : `${scalate.length} ${scalate.length === 1 ? 'scalata attiva' : 'scalate attive'}`}
            </div>
          </div>
          <SaveBadge status={saveStatus} onRetry={onRipristina} />
        </div>

        {/* Cards scalate */}
        {scalate.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {scalate.map((s, i) => <CardScalataLista key={s.id || i} s={s} onClick={() => onApri(i)} />)}
          </div>
        ) : (
          <EmptyState />
        )}

        {/* CTA nuova */}
        <button onClick={onNuova}
          style={{
            width: '100%', padding: '18px 16px', marginTop: 8,
            background: `linear-gradient(135deg, ${T.cyan}22, ${T.purple}22)`,
            border: `1px solid ${T.cyan}40`,
            borderRadius: 16,
            color: T.cyan,
            ...T.orb, fontSize: 15, fontWeight: 700, letterSpacing: 3,
            cursor: 'pointer',
            boxShadow: `0 0 30px ${T.cyan}10`,
            transition: 'all 0.2s',
          }}>
          + NUOVA SCALATA
        </button>
      </div>
    </div>
  )
}

function CardScalataLista({ s, onClick }) {
  const bankroll = s.bankrollCorrente ?? s.capitale
  const progresso = Math.min(100, Math.max(0, ((bankroll - s.capitale) / (s.obiettivo - s.capitale)) * 100))
  const stepIdx = s.stepCorrente || 0
  const stepAttivo = s.steps?.[stepIdx]
  const inAttesa = stepAttivo?.matchScelto
  const stepFatti = s.steps?.filter(x => x.done).length || 0
  const totStep = s.steps?.length || 0
  const statoColor = inAttesa ? T.gold : T.cyan
  const statoLabel = inAttesa ? '⏳ IN ATTESA ESITO' : `STEP ${stepIdx + 1}/${totStep}`

  return (
    <div onClick={onClick}
      style={{
        padding: '18px 20px',
        background: `linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))`,
        border: `1px solid ${statoColor}25`,
        borderRadius: 18,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.15s',
      }}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.99)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${statoColor}80, transparent)`,
      }}/>

      {/* Riga top: bankroll + stato */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ ...T.label, marginBottom: 4 }}>Bankroll attuale</div>
          <div style={{ ...T.orb, fontSize: 28, fontWeight: 900, color: T.text, lineHeight: 1 }}>
            {fmt(bankroll)}
          </div>
          <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.35)', marginTop: 4 }}>
            {fmt(s.capitale)} → {fmt(s.obiettivo)} · {s.nGiocate} giocate
          </div>
        </div>
        <div style={{
          ...T.sg, fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
          padding: '5px 10px', borderRadius: 99,
          background: `${statoColor}15`, border: `1px solid ${statoColor}40`,
          color: statoColor,
        }}>
          {statoLabel}
        </div>
      </div>

      {/* Progress bar con obiettivo */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          height: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 99,
          overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            height: '100%', width: `${progresso}%`,
            background: `linear-gradient(90deg, ${T.cyan}, ${T.purple})`,
            borderRadius: 99, transition: 'width 0.5s',
          }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ ...T.sg, fontSize: 9, color: 'rgba(245,240,232,0.25)' }}>{progresso.toFixed(0)}%</span>
          <span style={{ ...T.sg, fontSize: 9, color: 'rgba(245,240,232,0.25)' }}>{stepFatti}/{totStep} giocate fatte</span>
        </div>
      </div>

      {/* Footer: partita in attesa */}
      {inAttesa && (
        <div style={{
          padding: '8px 12px', marginTop: 10,
          background: `${T.gold}08`, border: `1px solid ${T.gold}20`,
          borderRadius: 10,
          ...T.sg, fontSize: 11, color: `${T.gold}b0`,
        }}>
          🎯 {inAttesa.home} vs {inAttesa.away} · quota {inAttesa.quota}
        </div>
      )}

      <div style={{ ...T.sg, fontSize: 10, color: statoColor, marginTop: 12, textAlign: 'right' }}>
        Continua →
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '50px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.15 }}>📈</div>
      <div style={{ ...T.sg, fontSize: 14, color: 'rgba(245,240,232,0.3)' }}>Nessuna scalata attiva</div>
      <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.15)', marginTop: 6 }}>Crea la tua prima scalata qui sotto</div>
    </div>
  )
}

function SaveBadge({ status, onRetry }) {
  if (status === 'saving') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.4)' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${T.cyan}30`, borderTop: `1.5px solid ${T.cyan}`, animation: 'spin 0.8s linear infinite' }}/>
      Salvo...
    </div>
  )
  if (status === 'saved') return <div style={{ ...T.sg, fontSize: 10, color: T.green }}>✓ Salvato</div>
  if (status === 'error') return (
    <button onClick={onRetry} style={{ ...T.sg, fontSize: 10, color: T.red, background: `${T.red}10`, border: `1px solid ${T.red}30`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
      ⚠ Riprova
    </button>
  )
  return null
}

function Loader({ msg = 'Preparando la scalata...' }) {
  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${T.cyan}18`, borderTop: `2px solid ${T.cyan}`, animation: 'spin 1s linear infinite' }}/>
      <div style={{ ...T.sg, fontSize: 13, color: 'rgba(245,240,232,0.5)' }}>{msg}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHERMATA 2: SETUP (nuova scalata)
// ═══════════════════════════════════════════════════════════════════════════════
function SchermataSetup({ onBack, onCrea }) {
  const [capitale, setCapitale] = useState('')
  const [obiettivo, setObiettivo] = useState('')
  const [nGiocate, setNGiocate] = useState(null)
  const [stepGiaFatti, setStepGiaFatti] = useState(0)
  const [importMode, setImportMode] = useState(false)

  const cap = Number(capitale), obj = Number(obiettivo)
  const basicValid = cap >= 1 && obj > cap
  const valido = basicValid && nGiocate !== null
  const opzioni = basicValid ? N_GIOCATE.map(n => {
    const quota = calcQuotaMedia(cap, obj, n)
    return { n, quota, tipo: classificaTipo(quota), range: rangeQuote(quota) }
  }) : []
  const selOpz = valido ? opzioni.find(o => o.n === nGiocate) : null

  const avvia = () => {
    if (!selOpz) return
    const quotaMedia = +selOpz.quota.toFixed(2)
    const steps = calcScalata(cap, obj, quotaMedia)
    let bankrollCorrente = cap
    let stepCorrente = 0

    if (stepGiaFatti > 0) {
      const now = new Date().toISOString()
      for (let i = 0; i < stepGiaFatti && i < steps.length; i++) {
        steps[i] = {
          ...steps[i], done: true, esito: 'vinto', timestamp: now,
          quotaEffettiva: steps[i].quota, importoEffettivo: steps[i].importo, vincitaEffettiva: steps[i].vincita,
        }
      }
      stepCorrente = stepGiaFatti
      bankrollCorrente = steps[stepGiaFatti - 1].bankrollSeVince
    }

    const scalata = {
      id: Date.now(),
      tipo: selOpz.tipo.tipo, tipoLabel: selOpz.tipo.label,
      capitale: cap, obiettivo: obj, nGiocate, quotaMedia,
      profitTarget: obj - cap,
      steps, stepCorrente, bankrollCorrente,
      status: 'attiva',
      createdAt: new Date().toISOString(),
    }
    onCrea({ scalata, opz: selOpz, bankrollInizio: bankrollCorrente })
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <style>{GLOBAL_CSS}</style>
      <div style={T.page}>

        <div style={{ marginBottom: 20 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.4)', cursor: 'pointer', ...T.sg, fontSize: 12, padding: 0, marginBottom: 10 }}>
            ← Lista scalate
          </button>
          <div style={{ ...T.orb, fontSize: 24, fontWeight: 700, letterSpacing: 2, color: T.text }}>NUOVA SCALATA</div>
        </div>

        {/* Input capitale + obiettivo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div>
            <div style={T.label}>Capitale (€)</div>
            <input type="number" value={capitale} min={1} onChange={e => setCapitale(e.target.value)} placeholder="2"
              style={{ ...T.input, ...T.orb, fontSize: 24, padding: '12px 14px' }} />
          </div>
          <div>
            <div style={T.label}>Obiettivo (€)</div>
            <input type="number" value={obiettivo} onChange={e => setObiettivo(e.target.value)} placeholder="500"
              style={{ ...T.input, ...T.orb, fontSize: 24, padding: '12px 14px' }} />
          </div>
        </div>

        {/* Numero giocate — cards compatte */}
        {basicValid && (
          <div style={{ marginBottom: 18 }}>
            <div style={T.label}>Numero di giocate</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
              {opzioni.map(o => {
                const sel = nGiocate === o.n
                return (
                  <button key={o.n} onClick={() => setNGiocate(o.n)}
                    style={{
                      padding: '12px 10px',
                      background: sel ? `${o.tipo.color}15` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${sel ? o.tipo.color + '60' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    }}>
                    <div style={{ ...T.orb, fontSize: 18, color: sel ? T.text : 'rgba(245,240,232,0.6)' }}>{o.n}</div>
                    <div style={{ ...T.sg, fontSize: 9, color: o.tipo.color, marginTop: 2, fontWeight: 700, letterSpacing: 1 }}>
                      q. {o.quota.toFixed(2)}
                    </div>
                  </button>
                )
              })}
            </div>
            {selOpz && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: `${selOpz.tipo.color}08`, border: `1px solid ${selOpz.tipo.color}25`, borderRadius: 8, ...T.sg, fontSize: 11, color: selOpz.tipo.color }}>
                {selOpz.tipo.label} · range {selOpz.range.min}–{selOpz.range.max}
              </div>
            )}
          </div>
        )}

        {/* Info leghe */}
        {basicValid && (
          <div style={{ marginBottom: 14, padding: '10px 12px', background: `${T.cyan}08`, border: `1px solid ${T.cyan}20`, borderRadius: 10, ...T.sg, fontSize: 11, color: `${T.cyan}b0` }}>
            🌍 Tutte le leghe principali (CL, EL, Serie A, Premier, LaLiga, Bundesliga, Ligue 1)
          </div>
        )}

        {/* Import scalata in corso — toggle */}
        {valido && (
          <div style={{ marginBottom: 18 }}>
            <button onClick={() => setImportMode(!importMode)}
              style={{
                width: '100%', padding: '10px 14px',
                background: importMode ? `${T.gold}10` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${importMode ? T.gold + '35' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                ...T.sg, fontSize: 12, color: importMode ? T.gold : 'rgba(245,240,232,0.5)',
              }}>
              {importMode ? '▼' : '▸'} Hai già iniziato questa scalata?
            </button>
            {importMode && (
              <div style={{ marginTop: 8, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
                <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.45)', marginBottom: 10 }}>
                  Seleziona quanti step <strong>vincenti</strong> hai già fatto. Il bankroll si aggiorna in automatico.
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {Array.from({ length: Math.min(nGiocate, 16) }, (_, i) => i).map(n => (
                    <button key={n} onClick={() => setStepGiaFatti(n)}
                      style={{
                        padding: '7px 12px', borderRadius: 8,
                        background: stepGiaFatti === n ? `${T.gold}25` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${stepGiaFatti === n ? T.gold + '60' : 'rgba(255,255,255,0.08)'}`,
                        color: stepGiaFatti === n ? T.gold : 'rgba(245,240,232,0.5)',
                        ...T.orb, fontSize: 13, cursor: 'pointer', fontWeight: 600,
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
                {stepGiaFatti > 0 && (() => {
                  const qm = +selOpz.quota.toFixed(2)
                  const pre = calcScalata(cap, obj, qm)
                  const br = pre[stepGiaFatti - 1]?.bankrollSeVince || cap
                  return (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: `${T.green}08`, border: `1px solid ${T.green}25`, borderRadius: 8, ...T.sg, fontSize: 11, color: T.green }}>
                      ✓ {stepGiaFatti} step già vinti — bankroll di partenza: <strong>{fmt(br)}</strong>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        <button onClick={avvia} disabled={!valido}
          style={{
            width: '100%', padding: '16px',
            background: valido ? `linear-gradient(135deg, ${T.cyan}, ${T.purple})` : 'rgba(255,255,255,0.05)',
            border: 'none', borderRadius: 14,
            color: valido ? '#080812' : 'rgba(245,240,232,0.2)',
            ...T.orb, fontSize: 14, fontWeight: 900, letterSpacing: 3,
            cursor: valido ? 'pointer' : 'not-allowed',
            boxShadow: valido ? `0 0 25px ${T.cyan}30` : 'none',
          }}>
          AVVIA SCALATA →
        </button>

        <div style={{ marginTop: 14, ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.12)', textAlign: 'center', lineHeight: 1.8 }}>
          Solo uso educativo · Non costituisce invito al gioco<br />
          Il gioco d'azzardo può creare dipendenza
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHERMATA 3: SCALATA ATTIVA — stile schedina
// ═══════════════════════════════════════════════════════════════════════════════
function SchermataAttiva({ scalata, tutte, apertaIdx, saveStatus, onBack, onUpdate, onArchivia }) {
  const stepIdx = scalata.stepCorrente || 0
  const stepAttuale = scalata.steps?.[stepIdx]
  const stepFatti = scalata.steps?.filter(s => s.done) || []
  const progresso = Math.min(100, Math.max(0, ((scalata.bankrollCorrente - scalata.capitale) / (scalata.obiettivo - scalata.capitale)) * 100))

  // ─── REGISTRA ESITO ────────────────────────────────────────────────────────
  const registraEsito = (esito, datiStep) => {
    // datiStep: { importo, quota, match? }
    const importoUsato = +Number(datiStep.importo).toFixed(2)
    const quotaUsata = +Number(datiStep.quota).toFixed(2)
    const vincitaUsata = +(importoUsato * quotaUsata).toFixed(2)

    const steps = scalata.steps.map((s, i) => i === stepIdx ? {
      ...s, done: true, esito,
      timestamp: new Date().toISOString(),
      matchUsato: datiStep.match || s.matchScelto || null,
      matchScelto: null,
      quotaEffettiva: quotaUsata, importoEffettivo: importoUsato, vincitaEffettiva: vincitaUsata,
      bankrollSeVince: +(scalata.bankrollCorrente - importoUsato + vincitaUsata).toFixed(2),
      bankrollSePerde: +(scalata.bankrollCorrente - importoUsato).toFixed(2),
    } : s)
    const stepAggiornato = steps[stepIdx]
    const bankrollCorrente = esito === 'vinto' ? stepAggiornato.bankrollSeVince : stepAggiornato.bankrollSePerde
    const stepCorrenteNew = stepIdx + 1

    let status = 'attiva'
    if (esito === 'vinto' && bankrollCorrente >= scalata.obiettivo) status = 'completata'
    else if (esito === 'perso' && (bankrollCorrente <= 0 || stepCorrenteNew >= steps.length)) status = 'fallita'

    onUpdate({ steps, stepCorrente: stepCorrenteNew, bankrollCorrente, status })

    if (status !== 'attiva') {
      setTimeout(() => onArchivia(status), 1500)
      return
    }

    // Refresh partite per il prossimo step
    refreshPartite(bankrollCorrente)
  }

  const refreshPartite = async (bankroll) => {
    try {
      const range = rangeQuote(scalata.quotaMedia)
      const res = await fetch(`/api/odds?quotaMin=${range.min}&quotaMax=${range.max}`)
      const odds = await res.json()
      if (!odds?.length) return
      const aiRes = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches: odds, scalataType: scalata.tipo, capitale: bankroll, obiettivo: scalata.obiettivo }),
      })
      const aiData = await aiRes.json()
      if (aiData?.partite_consigliate) {
        onUpdate({ partiteConsigliate: aiData.partite_consigliate })
      }
    } catch (e) {}
  }

  const piazzaPartita = (match, importo, quota) => {
    const steps = scalata.steps.map((s, i) => i === stepIdx ? {
      ...s, matchScelto: { ...match, quota: +Number(quota).toFixed(2), importo: +Number(importo).toFixed(2) },
    } : s)
    onUpdate({ steps })
  }

  const annullaMatch = () => {
    const steps = scalata.steps.map((s, i) => i === stepIdx ? { ...s, matchScelto: null } : s)
    onUpdate({ steps })
  }

  const abbandona = () => {
    if (!window.confirm('Abbandonare questa scalata?')) return
    onArchivia('abbandonata')
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <style>{GLOBAL_CSS}</style>
      <div style={T.page}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.4)', cursor: 'pointer', ...T.sg, fontSize: 13, padding: 0 }}>
            ← Tutte le scalate
          </button>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <SaveBadge status={saveStatus} />
            {tutte.length > 1 && (
              <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.25)' }}>
                {(apertaIdx || 0) + 1}/{tutte.length}
              </div>
            )}
          </div>
        </div>

        {/* ─── HEADER BANKROLL ─────────────────────────────────────── */}
        <div style={{
          padding: '18px 20px', marginBottom: 20,
          background: `linear-gradient(135deg, rgba(0,212,255,0.05), rgba(160,80,255,0.05))`,
          border: `1px solid ${T.cyan}25`, borderRadius: 18,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={T.label}>Bankroll</div>
              <div style={{
                ...T.orb, fontSize: 40, fontWeight: 900, lineHeight: 1,
                background: `linear-gradient(135deg, ${T.cyan}, ${T.purple})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {fmt(scalata.bankrollCorrente)}
              </div>
              <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.4)', marginTop: 4 }}>
                → obiettivo {fmt(scalata.obiettivo)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={T.label}>Step</div>
              <div style={{ ...T.orb, fontSize: 26, color: T.cyan, fontWeight: 900 }}>
                {stepIdx + 1}<span style={{ fontSize: 13, color: 'rgba(245,240,232,0.3)' }}>/{scalata.steps.length}</span>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${progresso}%`, background: `linear-gradient(90deg, ${T.cyan}, ${T.purple})`, borderRadius: 99, transition: 'width 0.5s' }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.3)' }}>
            <span>{fmt(scalata.capitale)}</span>
            <span>{progresso.toFixed(0)}%</span>
            <span>{fmt(scalata.obiettivo)}</span>
          </div>
        </div>

        {/* ─── SEZIONE: SCHEDINA STEP CORRENTE ────────────────────── */}
        {stepAttuale && !stepAttuale.done && (
          <SchedinaStep
            step={stepAttuale}
            stepIdx={stepIdx}
            onRegistraEsito={registraEsito}
            onPiazzaPartita={piazzaPartita}
            onAnnullaMatch={annullaMatch}
          />
        )}

        {/* ─── SEZIONE: PARTITE CONSIGLIATE ────────────────────────── */}
        {stepAttuale && !stepAttuale.done && !stepAttuale.matchScelto && (
          <SezionePartiteAI
            partite={scalata.partiteConsigliate || []}
            step={stepAttuale}
            onSelect={piazzaPartita}
          />
        )}

        {/* ─── SEZIONE: STEP PASSATI ────────────────────────────────── */}
        {stepFatti.length > 0 && (
          <SezioneStepPassati steps={stepFatti} />
        )}

        {/* Abbandona */}
        <button onClick={abbandona}
          style={{
            width: '100%', padding: '10px', marginTop: 24,
            background: 'transparent', border: `1px solid ${T.red}15`, borderRadius: 10,
            color: `${T.red}70`, ...T.sg, fontSize: 10, cursor: 'pointer', letterSpacing: 2,
          }}>
          ABBANDONA SCALATA
        </button>
      </div>
    </div>
  )
}

// ─── SCHEDINA STEP (il cuore dell'app) ───────────────────────────────────────
function SchedinaStep({ step, stepIdx, onRegistraEsito, onPiazzaPartita, onAnnullaMatch }) {
  const [importoEdit, setImportoEdit] = useState(step.matchScelto?.importo ?? step.importo)
  const [quotaEdit, setQuotaEdit] = useState(step.matchScelto?.quota ?? step.quota)

  useEffect(() => {
    setImportoEdit(step.matchScelto?.importo ?? step.importo)
    setQuotaEdit(step.matchScelto?.quota ?? step.quota)
  }, [step.matchScelto, step.importo, step.quota, stepIdx])

  const vincita = Number(importoEdit) * Number(quotaEdit)
  const match = step.matchScelto
  const hasMatch = !!match

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ ...T.sg, fontSize: 10, letterSpacing: 2, color: hasMatch ? `${T.gold}b0` : 'rgba(245,240,232,0.3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
        {hasMatch ? '⏳ Giocata in attesa' : '▸ Prossima giocata'}
      </div>

      {/* Schedina card */}
      <div style={{
        position: 'relative',
        padding: '20px',
        background: hasMatch
          ? `linear-gradient(135deg, ${T.gold}10, ${T.gold}04)`
          : `linear-gradient(135deg, rgba(0,212,255,0.06), rgba(160,80,255,0.04))`,
        border: `1px solid ${hasMatch ? T.gold + '35' : T.cyan + '30'}`,
        borderRadius: 18,
        overflow: 'hidden',
      }}>
        {/* Watermark tipo ricevuta */}
        <div style={{
          position: 'absolute', top: 10, right: 14,
          ...T.orb, fontSize: 10, color: 'rgba(255,255,255,0.08)', letterSpacing: 2, fontWeight: 700,
        }}>
          STEP #{step.step}
        </div>

        {/* Partita scelta */}
        {hasMatch && (
          <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px dashed rgba(255,255,255,0.08)' }}>
            <div style={{ ...T.sg, fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>
              {match.home} <span style={{ color: 'rgba(245,240,232,0.3)' }}>vs</span> {match.away}
            </div>
            <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.4)' }}>
              Hai puntato su <span style={{ color: T.cyan, fontWeight: 600 }}>{match.esito}</span>
              {match.bookmaker && <span style={{ color: 'rgba(245,240,232,0.3)', marginLeft: 6 }}>· {match.bookmaker}</span>}
            </div>
          </div>
        )}

        {/* Input importo + quota */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={T.label}>Importo (€)</div>
            <input type="number" step="0.01" value={importoEdit} onChange={e => setImportoEdit(e.target.value)}
              style={{ ...T.input, ...T.orb, fontSize: 22, padding: '10px 14px', textAlign: 'center' }} />
          </div>
          <div>
            <div style={T.label}>Quota</div>
            <input type="number" step="0.01" value={quotaEdit} onChange={e => setQuotaEdit(e.target.value)}
              style={{ ...T.input, ...T.orb, fontSize: 22, padding: '10px 14px', textAlign: 'center' }} />
          </div>
        </div>

        {/* Vincita potenziale — grossa come un cartello vinci */}
        <div style={{
          padding: '14px', marginBottom: 16,
          background: `${T.green}08`, border: `1px dashed ${T.green}30`,
          borderRadius: 12, textAlign: 'center',
        }}>
          <div style={{ ...T.label, color: `${T.green}70` }}>Vincita potenziale</div>
          <div style={{ ...T.orb, fontSize: 30, fontWeight: 900, color: T.green, lineHeight: 1, marginTop: 4 }}>
            {fmt(vincita)}
          </div>
          <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.3)', marginTop: 4 }}>
            profitto netto: +{fmt(vincita - Number(importoEdit || 0))}
          </div>
        </div>

        {/* Azioni */}
        {hasMatch ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => onRegistraEsito('vinto', { importo: importoEdit, quota: quotaEdit, match })}
                style={{ padding: '16px', background: `${T.green}15`, border: `1px solid ${T.green}40`, borderRadius: 12, color: T.green, ...T.orb, fontSize: 14, fontWeight: 900, cursor: 'pointer', letterSpacing: 2, boxShadow: `0 0 20px ${T.green}15` }}>
                ✓ VINTO
              </button>
              <button onClick={() => onRegistraEsito('perso', { importo: importoEdit, quota: quotaEdit, match })}
                style={{ padding: '16px', background: `${T.red}12`, border: `1px solid ${T.red}35`, borderRadius: 12, color: T.red, ...T.orb, fontSize: 14, fontWeight: 900, cursor: 'pointer', letterSpacing: 2 }}>
                ✗ PERSO
              </button>
            </div>
            <button onClick={onAnnullaMatch}
              style={{ width: '100%', marginTop: 10, padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: 'rgba(245,240,232,0.3)', ...T.sg, fontSize: 10, cursor: 'pointer' }}>
              ✕ Annulla questa partita
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '10px', ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.3)' }}>
            ↓ Scegli una partita qui sotto
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PARTITE CONSIGLIATE ─────────────────────────────────────────────────────
function SezionePartiteAI({ partite, step, onSelect }) {
  const [selIdx, setSelIdx] = useState(null)
  const [importoEdit, setImportoEdit] = useState(step.importo)
  const [quotaEdit, setQuotaEdit] = useState(step.quota)

  const sel = selIdx !== null ? partite[selIdx] : null

  useEffect(() => {
    if (sel) {
      setImportoEdit(step.importo)
      setQuotaEdit(sel.match?.quota ?? step.quota)
    }
  }, [selIdx])

  if (partite.length === 0) return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ ...T.sg, fontSize: 10, letterSpacing: 2, color: 'rgba(245,240,232,0.3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
        ⚡ Partite consigliate
      </div>
      <div style={{ padding: '32px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${T.cyan}18`, borderTop: `2px solid ${T.cyan}`, animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}/>
        <div style={{ ...T.sg, fontSize: 12, color: 'rgba(245,240,232,0.35)' }}>Analizzo le partite...</div>
      </div>
    </div>
  )

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ ...T.sg, fontSize: 10, letterSpacing: 2, color: 'rgba(245,240,232,0.3)', textTransform: 'uppercase', fontWeight: 700 }}>
          ⚡ Partite consigliate
        </div>
        <div style={{ ...T.sg, fontSize: 9, color: 'rgba(245,240,232,0.2)' }}>{partite.length} opzioni</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {partite.map((p, i) => {
          const isSel = selIdx === i
          const vc = { OTTIMA: T.green, BUONA: T.cyan, ACCETTABILE: T.gold }[p.verdetto] || 'rgba(245,240,232,0.3)'
          return (
            <div key={i}>
              <div onClick={() => setSelIdx(isSel ? null : i)}
                style={{
                  padding: '14px 16px',
                  background: isSel ? `${vc}06` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isSel ? vc + '45' : 'rgba(255,255,255,0.07)'}`,
                  borderTopLeftRadius: 14, borderTopRightRadius: 14,
                  borderBottomLeftRadius: isSel ? 0 : 14, borderBottomRightRadius: isSel ? 0 : 14,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...T.sg, fontSize: 13, fontWeight: 600, color: T.text }}>
                      {p.match?.home} <span style={{ color: 'rgba(245,240,232,0.25)' }}>vs</span> {p.match?.away}
                    </div>
                    <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.3)', marginTop: 2 }}>
                      <span style={{ color: 'rgba(245,240,232,0.5)' }}>{p.match?.esito}</span>
                      {p.match?.commence && <> · {fmtDate(p.match.commence)}</>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ ...T.orb, fontSize: 20, color: vc, fontWeight: 700 }}>{p.match?.quota}</div>
                    <div style={{ ...T.sg, fontSize: 8, padding: '2px 8px', borderRadius: 99, background: `${vc}18`, border: `1px solid ${vc}40`, color: vc, fontWeight: 700, letterSpacing: 1 }}>{p.verdetto}</div>
                  </div>
                </div>
                {p.motivo_principale && (
                  <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.5)', lineHeight: 1.4 }}>
                    <span style={{ color: T.green }}>✓</span> {p.motivo_principale}
                  </div>
                )}
                {p.value_bet && (
                  <div style={{ marginTop: 6, ...T.sg, fontSize: 9, color: T.green, fontWeight: 600 }}>
                    ✨ Value bet
                  </div>
                )}
              </div>

              {/* Expanded: confermi con i valori reali del tuo bookmaker */}
              {isSel && (
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(0,0,0,0.25)',
                  border: `1px solid ${vc}45`, borderTop: 'none',
                  borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
                }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.4)', marginBottom: 8 }}>
                    Conferma con i valori reali del tuo bookmaker:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div>
                      <div style={{ ...T.label, marginBottom: 4 }}>Importo (€)</div>
                      <input type="number" step="0.01" value={importoEdit} onChange={e => setImportoEdit(e.target.value)}
                        style={{ ...T.input, ...T.orb, fontSize: 16, padding: '8px 12px', textAlign: 'center' }} />
                    </div>
                    <div>
                      <div style={{ ...T.label, marginBottom: 4 }}>Quota reale</div>
                      <input type="number" step="0.01" value={quotaEdit} onChange={e => setQuotaEdit(e.target.value)}
                        style={{ ...T.input, ...T.orb, fontSize: 16, padding: '8px 12px', textAlign: 'center' }} />
                    </div>
                  </div>
                  <button onClick={() => { onSelect(p.match, importoEdit, quotaEdit); setSelIdx(null) }}
                    style={{
                      width: '100%', padding: '12px',
                      background: `${vc}20`, border: `1px solid ${vc}60`,
                      borderRadius: 10, color: vc,
                      ...T.orb, fontSize: 13, fontWeight: 900, letterSpacing: 2,
                      cursor: 'pointer',
                    }}>
                    ⏳ PIAZZA LA GIOCATA
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── STEP PASSATI (accordion) ────────────────────────────────────────────────
function SezioneStepPassati({ steps }) {
  return (
    <details style={{ marginBottom: 16 }}>
      <summary style={{
        cursor: 'pointer', padding: '10px 14px',
        background: 'rgba(255,255,255,0.02)', borderRadius: 10,
        ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.4)', letterSpacing: 1, listStyle: 'none',
      }}>
        📋 STEP PASSATI ({steps.length})
      </summary>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {steps.map((s, j) => {
          const isV = s.esito === 'vinto'
          const importo = s.importoEffettivo ?? s.importo
          const quota = s.quotaEffettiva ?? s.quota
          const vincita = s.vincitaEffettiva ?? s.vincita
          const delta = isV ? vincita - importo : -importo
          return (
            <div key={j} style={{
              padding: '10px 14px',
              background: isV ? `${T.green}05` : `${T.red}05`,
              border: `1px solid ${isV ? T.green + '20' : T.red + '20'}`,
              borderRadius: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ ...T.sg, fontSize: 12, color: 'rgba(245,240,232,0.7)' }}>
                  <span style={{ color: isV ? T.green : T.red, marginRight: 8 }}>{isV ? '✓' : '✗'}</span>
                  Step {s.step} · {fmt(importo)} × {quota}
                </div>
                <div style={{ ...T.orb, fontSize: 12, color: isV ? T.green : T.red, fontWeight: 700 }}>
                  {delta >= 0 ? '+' : ''}{fmt(delta)}
                </div>
              </div>
              {s.matchUsato && (
                <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.3)', marginTop: 3 }}>
                  {s.matchUsato.home} vs {s.matchUsato.away} · {s.matchUsato.esito}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </details>
  )
}
