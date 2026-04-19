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
const N_GIOCATE = [3, 5, 8, 12, 16, 20, 25]

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
      // Retry 2 volte con backoff
      await new Promise(r => setTimeout(r, (attempt + 1) * 800))
      return saveData(userId, patch, attempt + 1)
    }
    return { ok: false, error: e.message || 'Errore sconosciuto' }
  }
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

// ─── AUTO IMPORT ESITO ────────────────────────────────────────────────────────
function AutoImportEsito({ step, stepIdx, registraEsito, scalataAttiva, setScalataAttiva, persist }) {
  const [risultatoAuto, setRisultatoAuto] = useState(null)
  const [loading, setLoading] = useState(true)
  const match = step.matchScelto
  const fmt = n => `€${Number(n).toFixed(2)}`

  useEffect(() => {
    if (!match?.home || !match?.away) { setLoading(false); return }
    // Cerca in pronostici_storico la partita corrispondente
    const checkResult = async () => {
      try {
        const { data } = await supabase
          .from('pronostici_storico')
          .select('*')
          .eq('verificato', true)
          .order('created_at', { ascending: false })
          .limit(50)

        if (!data?.length) { setLoading(false); return }

        // Match fuzzy per nome squadra
        const homeLower = match.home.toLowerCase()
        const awayLower = match.away.toLowerCase()
        const found = data.find(p => {
          const ph = (p.home || '').toLowerCase()
          const pa = (p.away || '').toLowerCase()
          return (ph.includes(homeLower.split(' ')[0]) || homeLower.includes(ph.split(' ')[0])) &&
                 (pa.includes(awayLower.split(' ')[0]) || awayLower.includes(pa.split(' ')[0]))
        })

        if (!found) { setLoading(false); return }

        // Determina se l'esito scelto è vinto o perso
        const esitoScelto = match.esito?.toLowerCase() || ''
        const realEsito = found.real_esito // 'H', 'A', 'D'
        let vinto = false
        if (esitoScelto.includes('draw') || esitoScelto === 'x' || esitoScelto.includes('pareggio')) {
          vinto = realEsito === 'D'
        } else if (found.home?.toLowerCase().includes(esitoScelto.split(' ')[0]) || 
                   esitoScelto.includes(found.home?.toLowerCase().split(' ')[0])) {
          vinto = realEsito === 'H'
        } else {
          vinto = realEsito === 'A'
        }

        setRisultatoAuto({ found, vinto, realRisultato: found.real_risultato })
      } catch(e) {}
      setLoading(false)
    }
    checkResult()
  }, [match?.home, match?.away])

  const annullaScelta = () => {
    const steps = scalataAttiva.steps.map((s, i) => i === stepIdx ? { ...s, matchScelto: null } : s)
    const updated = { ...scalataAttiva, steps }
    setScalataAttiva(updated)
    persist({ scalata_attiva: updated })
  }

  return (
    <div>
      {/* Info partita piazzata */}
      <div style={{ padding:'14px 16px', background:`${T.gold}06`, border:`1px solid ${T.gold}25`, borderRadius:14, marginBottom:10 }}>
        <div style={{ ...T.sg, fontSize:10, color:`${T.gold}80`, letterSpacing:1, marginBottom:6 }}>⏳ GIOCATA IN ATTESA</div>
        <div style={{ ...T.sg, fontSize:13, fontWeight:600, color:T.text, marginBottom:8 }}>
          {match.home} <span style={{color:'rgba(245,240,232,0.25)'}}>vs</span> {match.away}
        </div>
        <div style={{ display:'flex', gap:16 }}>
          <div>
            <div style={{ ...T.label, marginBottom:2 }}>Hai puntato su</div>
            <div style={{ ...T.sg, fontSize:12, color:T.cyan }}>{match.esito}</div>
          </div>
          <div>
            <div style={{ ...T.label, marginBottom:2 }}>Quota</div>
            <div style={{ ...T.orb, fontSize:14, color:T.text }}>{match.quota}</div>
          </div>
          <div>
            <div style={{ ...T.label, marginBottom:2 }}>Importo</div>
            <div style={{ ...T.orb, fontSize:14, color:T.text }}>{fmt(match.importo || step.importo)}</div>
          </div>
        </div>
      </div>

      {/* Auto-import se risultato disponibile */}
      {loading ? (
        <div style={{ ...T.sg, fontSize:11, color:'rgba(245,240,232,0.25)', textAlign:'center', padding:'8px' }}>
          Cerco risultato...
        </div>
      ) : risultatoAuto ? (
        <div style={{ padding:'14px 16px', background: risultatoAuto.vinto ? `${T.green}08` : `${T.red}08`, border:`1px solid ${risultatoAuto.vinto ? T.green : T.red}30`, borderRadius:14, marginBottom:10 }}>
          <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.4)', marginBottom:6 }}>✨ RISULTATO DISPONIBILE</div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div>
              <div style={{ ...T.orb, fontSize:22, color: risultatoAuto.vinto ? T.green : T.red }}>
                {risultatoAuto.realRisultato || '?-?'}
              </div>
              <div style={{ ...T.sg, fontSize:11, color:'rgba(245,240,232,0.4)', marginTop:2 }}>
                Risultato reale
              </div>
            </div>
            <div style={{ ...T.sg, fontSize:14, fontWeight:700, color: risultatoAuto.vinto ? T.green : T.red }}>
              {risultatoAuto.vinto ? '✓ VINTO' : '✗ PERSO'}
            </div>
          </div>
          <button onClick={() => registraEsito(stepIdx, risultatoAuto.vinto ? 'vinto' : 'perso', match)}
            style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background: risultatoAuto.vinto ? `${T.green}18` : `${T.red}18`, color: risultatoAuto.vinto ? T.green : T.red, ...T.sg, fontSize:14, fontWeight:700, cursor:'pointer' }}>
            {risultatoAuto.vinto ? '✓ Importa — Vinto' : '✗ Importa — Perso'}
          </button>
        </div>
      ) : (
        <div style={{ ...T.sg, fontSize:11, color:'rgba(245,240,232,0.25)', textAlign:'center', padding:'4px 0 8px' }}>
          La partita è finita? Registra il risultato:
        </div>
      )}

      {/* Fallback manuale sempre disponibile */}
      {!risultatoAuto && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:8 }}>
          <button onClick={() => registraEsito(stepIdx, 'vinto', match)}
            style={{ padding:'14px', background:`${T.green}0a`, border:`1px solid ${T.green}30`, borderRadius:14, color:T.green, ...T.sg, fontSize:14, fontWeight:700, cursor:'pointer' }}>✓ Vinto</button>
          <button onClick={() => registraEsito(stepIdx, 'perso', match)}
            style={{ padding:'14px', background:`${T.red}0a`, border:`1px solid ${T.red}30`, borderRadius:14, color:T.red, ...T.sg, fontSize:14, fontWeight:700, cursor:'pointer' }}>✗ Perso</button>
        </div>
      )}

      <button onClick={annullaScelta}
        style={{ width:'100%', padding:'8px', background:'transparent', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, color:'rgba(245,240,232,0.2)', ...T.sg, fontSize:10, cursor:'pointer' }}>
        ✕ Annulla scelta partita
      </button>
    </div>
  )
}

export default function Scalata({ session }) {
  const userId = session?.user?.id
  const [fase, setFase]           = useState('lista') // 'lista' | 'setup' | 'caricamento' | 'scalata'
  const [scalateAttive, setScalateAttive] = useState([]) // array scalate in corso
  const [scalataAperta, setScalataAperta] = useState(null) // indice scalata aperta
  const [capitale, setCapitale]   = useState('')
  const [obiettivo, setObiettivo] = useState('')
  const [nGiocate, setNGiocate]   = useState(null)
  const [partiteConsigliate, setPartiteConsigliate] = useState([])
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError]         = useState(null)
  const [selectedForStep, setSelectedForStep] = useState({})
  const [editedValues, setEditedValues] = useState({})
  const [stepGiaFatti, setStepGiaFatti] = useState(0) // per importare scalate in corso
  const [saveStatus, setSaveStatus] = useState('idle')

  // Scalata correntemente aperta
  const scalataAttiva = scalataAperta !== null ? scalateAttive[scalataAperta] : null

  // Funzione di ricarica dati dal DB
  const reloadFromDB = async () => {
    if (!userId) return
    const d = await loadData(userId)
    if (d?.scalate_attive?.length) {
      setScalateAttive(d.scalate_attive)
    } else if (d?.scalata_attiva) {
      setScalateAttive([d.scalata_attiva])
    } else {
      setScalateAttive([])
    }
  }

  // Auto-reload quando l'utente torna sull'app (es. cambia da telefono a pc)
  useEffect(() => {
    if (!userId) return
    const onVisibility = () => {
      if (document.visibilityState === 'visible') reloadFromDB()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    loadData(userId).then(d => {
      // Migrazione vecchia struttura singola → array
      if (d?.scalata_attiva && !d?.scalate_attive) {
        const attive = [d.scalata_attiva]
        setScalateAttive(attive)
        saveData(userId, { scalate_attive: attive })
        setScalataAperta(0)
        if (d.scalata_attiva.partiteConsigliate) setPartiteConsigliate(d.scalata_attiva.partiteConsigliate)
        setFase('scalata')
      } else if (d?.scalate_attive?.length) {
        setScalateAttive(d.scalate_attive)
        setFase('lista')
      }
    })
  }, [userId])

  const persistAttive = async (nuove) => {
    setSaveStatus('saving')
    const result = await saveData(userId, { scalate_attive: nuove })
    if (result.ok) {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('error')
      // Mantieni "error" fino al prossimo tentativo
    }
    return result
  }
  const persist = patch => {
    // compat: se patch ha scalata_attiva, aggiorna quella aperta nell'array
    if (patch.scalata_attiva && scalataAperta !== null) {
      const nuove = scalateAttive.map((s, i) => i === scalataAperta ? patch.scalata_attiva : s)
      setScalateAttive(nuove)
      persistAttive(nuove)
    }
  }
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
      const oddsRes = await fetch(`/api/odds?quotaMin=${opz.range.min}&quotaMax=${opz.range.max}`)
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
        partiteConsigliate: aiData.partite_consigliate || [],
      }

      // Se ho indicato step già fatti, marcali come vinti
      if (stepGiaFatti > 0) {
        const now = new Date().toISOString()
        for (let i = 0; i < stepGiaFatti && i < scalata.steps.length; i++) {
          scalata.steps[i] = {
            ...scalata.steps[i],
            done: true,
            esito: 'vinto',
            timestamp: now,
            quotaEffettiva: scalata.steps[i].quota,
            importoEffettivo: scalata.steps[i].importo,
            vincitaEffettiva: scalata.steps[i].vincita,
          }
        }
        scalata.stepCorrente = stepGiaFatti
        scalata.bankrollCorrente = scalata.steps[stepGiaFatti - 1].bankrollSeVince
      }

      const nuove = [...scalateAttive, scalata]
      setScalateAttive(nuove)
      setScalataAperta(nuove.length - 1)
      setPartiteConsigliate(aiData.partite_consigliate || [])
      persistAttive(nuove)
      // Reset form
      setCapitale(''); setObiettivo(''); setNGiocate(null); setStepGiaFatti(0)
      setFase('scalata')
    } catch(e) { setError(e.message); setFase('setup') }
    setLoadingMsg('')
  }

  const setScalataAttiva = (updated) => {
    const nuove = scalateAttive.map((s, i) => i === scalataAperta ? updated : s)
    setScalateAttive(nuove)
    persistAttive(nuove)
  }

  const apriScalata = (idx) => {
    setScalataAperta(idx)
    const s = scalateAttive[idx]
    if (s?.partiteConsigliate) setPartiteConsigliate(s.partiteConsigliate)
    setSelectedForStep({})
    setEditedValues({})
    setFase('scalata')
  }

  const chiudiScalata = () => {
    setScalataAperta(null)
    setPartiteConsigliate([])
    setSelectedForStep({})
    setFase('lista')
  }

  const registraEsito = (stepIndex, esito, matchUsato) => {
    const step = scalataAttiva.steps[stepIndex]
    // Usa valori modificati se presenti
    const edited = editedValues[stepIndex] || {}
    const quotaUsata = Number(edited.quota) || step.quota
    const importoUsato = Number(edited.importo) || step.importo
    const vincitaUsata = +(importoUsato * quotaUsata).toFixed(2)

    const steps = scalataAttiva.steps.map((s, i) => i === stepIndex ? {
      ...s, done: true, esito,
      timestamp: new Date().toISOString(),
      matchUsato,
      quotaEffettiva: quotaUsata,
      importoEffettivo: importoUsato,
      vincitaEffettiva: vincitaUsata,
      bankrollSeVince: +(scalataAttiva.bankrollCorrente - importoUsato + vincitaUsata).toFixed(2),
      bankrollSePerde: +(scalataAttiva.bankrollCorrente - importoUsato).toFixed(2),
    } : s)

    const stepAggiornato = steps[stepIndex]
    const bankrollCorrente = esito === 'vinto' ? stepAggiornato.bankrollSeVince : stepAggiornato.bankrollSePerde
    const stepCorrente = stepIndex + 1
    let status = 'attiva'
    if (esito === 'vinto' && bankrollCorrente >= scalataAttiva.obiettivo) status = 'completata'
    else if (esito === 'perso' && (bankrollCorrente <= 0 || stepCorrente >= steps.length)) status = 'fallita'
    const updated = { ...scalataAttiva, steps, stepCorrente, bankrollCorrente, status }
    setScalataAttiva(updated)
    setSelectedForStep({})
    setEditedValues({})

    if (status === 'attiva') {
      // Ricarica partite consigliate per il passo successivo
      const opz = { tipo: { tipo: scalataAttiva.tipo }, range: rangeQuote(scalataAttiva.quotaMedia) }
      setPartiteConsigliate([]) // svuota mentre carica
      fetch(`/api/odds?quotaMin=${opz.range.min}&quotaMax=${opz.range.max}`)
        .then(r => r.json())
        .then(odds => {
          if (!odds?.length) return
          return fetch('/api/analyze', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matches: odds, scalataType: scalataAttiva.tipo, capitale: bankrollCorrente, obiettivo: scalataAttiva.obiettivo }),
          }).then(r => r.json())
        })
        .then(aiData => {
          if (!aiData?.partite_consigliate) return
          setPartiteConsigliate(aiData.partite_consigliate)
          // Salva le nuove partite nella scalata
          const withPartite = { ...updated, partiteConsigliate: aiData.partite_consigliate }
          setScalataAttiva(withPartite)
        })
        .catch(() => {})
    }
    if (status !== 'attiva') {
      const closed = { ...updated, closedAt: new Date().toISOString() }
      loadData(userId).then(d => {
        const nuoveAttive = scalateAttive.filter((_, i) => i !== scalataAperta)
        saveData(userId, {
          storico: [closed, ...(d?.storico || [])].slice(0, 100),
          scalate_attive: nuoveAttive,
        })
        setScalateAttive(nuoveAttive)
      })
      setTimeout(() => { setScalataAperta(null); setPartiteConsigliate([]); setFase('lista') }, 1200)
    }
  }

  const abbandonaScalata = async () => {
    if (!window.confirm('Abbandonare la scalata?')) return
    const closed = { ...scalataAttiva, status: 'abbandonata', closedAt: new Date().toISOString() }
    const d = await loadData(userId)
    const nuoveAttive = scalateAttive.filter((_, i) => i !== scalataAperta)
    saveData(userId, { storico: [closed, ...(d?.storico || [])].slice(0, 100), scalate_attive: nuoveAttive })
    setScalateAttive(nuoveAttive)
    setScalataAperta(null); setPartiteConsigliate([]); setFase('lista')
  }

  const stepIdx = scalataAttiva?.stepCorrente || 0
  const stepCorrente = scalataAttiva?.steps?.[stepIdx]
  const profitPct = scalataAttiva ? Math.min(100, Math.max(0, ((scalataAttiva.bankrollCorrente - scalataAttiva.capitale) / (scalataAttiva.obiettivo - scalataAttiva.capitale)) * 100)) : 0

  if (fase === 'caricamento') return <Spinner msg={loadingMsg} />

  // ── LISTA SCALATE ATTIVE ──
  if (fase === 'lista') return (
    <div style={{ minHeight:'100vh', background:T.bg }}>
      <style>{GLOBAL_CSS}</style>
      <div style={T.page}>
        <div style={{ marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
          <div>
            <div style={{ ...T.orb, fontSize:26, fontWeight:700, letterSpacing:2, color:T.text }}>SCALATA</div>
            <div style={{ ...T.sg, fontSize:11, color:'rgba(245,240,232,0.25)', marginTop:4 }}>Gestisci le tue scalate attive</div>
          </div>
          {saveStatus === 'saving' && (
            <div style={{ display:'flex', alignItems:'center', gap:5, ...T.sg, fontSize:10, color:'rgba(245,240,232,0.4)' }}>
              <div style={{ width:10, height:10, borderRadius:'50%', border:`1.5px solid ${T.cyan}30`, borderTop:`1.5px solid ${T.cyan}`, animation:'spin 0.8s linear infinite' }}/>
              Salvo...
            </div>
          )}
          {saveStatus === 'error' && (
            <button onClick={() => persistAttive(scalateAttive)}
              style={{ ...T.sg, fontSize:10, color:T.red, background:`${T.red}10`, border:`1px solid ${T.red}30`, borderRadius:8, padding:'3px 8px', cursor:'pointer' }}>
              ⚠ Riprova
            </button>
          )}
        </div>

        {/* Scalate in corso */}
        {scalateAttive.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={T.label}>In corso — {scalateAttive.length}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {scalateAttive.map((s, i) => {
                const stepFatti = s.steps?.filter(x => x.done).length || 0
                const profitPct = Math.min(100, Math.max(0, ((s.bankrollCorrente - s.capitale) / (s.obiettivo - s.capitale)) * 100))
                const inAttesa = s.steps?.[s.stepCorrente || 0]?.matchScelto
                return (
                  <div key={i} onClick={() => apriScalata(i)}
                    style={{ ...T.card, padding:'16px', cursor:'pointer', border:`1px solid ${T.cyan}25`, position:'relative' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                      <div>
                        <div style={{ ...T.orb, fontSize:18, color:T.text }}>{fmt(s.capitale)} <span style={{ fontSize:12, color:'rgba(245,240,232,0.3)' }}>→</span> {fmt(s.obiettivo)}</div>
                        <div style={{ ...T.sg, fontSize:11, color:'rgba(245,240,232,0.3)', marginTop:2 }}>{s.nGiocate} giocate · {s.tipoLabel}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ ...T.sg, fontSize:10, padding:'3px 10px', borderRadius:99, background:`${T.cyan}15`, border:`1px solid ${T.cyan}30`, color:T.cyan, fontWeight:700 }}>
                          {inAttesa ? '⏳ IN ATTESA' : `STEP ${(s.stepCorrente||0)+1}/${s.steps?.length||0}`}
                        </div>
                        <div style={{ ...T.sg, fontSize:11, color:'rgba(245,240,232,0.3)', marginTop:6 }}>{stepFatti} / {s.steps?.length||0} giocate</div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height:3, background:'rgba(255,255,255,0.05)', borderRadius:99, overflow:'hidden', marginBottom:8 }}>
                      <div style={{ height:'100%', width:`${profitPct}%`, background:`linear-gradient(90deg,${T.cyan},${T.purple})`, borderRadius:99 }}/>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.25)' }}>
                        Bankroll: <span style={{ color:T.text }}>{fmt(s.bankrollCorrente)}</span>
                      </div>
                      {inAttesa && (
                        <div style={{ ...T.sg, fontSize:10, color:T.gold }}>
                          ⏳ {inAttesa.home} vs {inAttesa.away}
                        </div>
                      )}
                    </div>
                    <div style={{ ...T.sg, fontSize:10, color:T.cyan, marginTop:8, textAlign:'right' }}>Continua →</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Nuova scalata */}
        <button onClick={() => setFase('setup')}
          style={{ width:'100%', padding:'16px', background:`linear-gradient(135deg, ${T.cyan}18, ${T.purple}18)`, border:`1px solid ${T.cyan}30`, borderRadius:14, color:T.cyan, ...T.orb, fontSize:14, fontWeight:700, cursor:'pointer', letterSpacing:2 }}>
          + NUOVA SCALATA
        </button>

        {scalateAttive.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:48, marginBottom:14, opacity:0.1 }}>📈</div>
            <div style={{ ...T.sg, fontSize:14, color:'rgba(245,240,232,0.25)' }}>Nessuna scalata attiva</div>
            <div style={{ ...T.sg, fontSize:12, color:'rgba(245,240,232,0.15)', marginTop:6 }}>Crea la prima scalata per iniziare</div>
          </div>
        )}
      </div>
    </div>
  )

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

        {scalateAttive.length > 0 && (
          <div style={{ padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background:`${T.cyan}08`, border:`1px solid ${T.cyan}25`, borderRadius:10 }}>
            <span style={{ ...T.sg, fontSize: 12, color: T.cyan }}>{scalateAttive.length} scalata{scalateAttive.length>1?'e':''} in corso</span>
            <button onClick={() => setFase('lista')} style={{ background: `${T.cyan}18`, border: `1px solid ${T.cyan}40`, borderRadius: 8, color: T.cyan, ...T.sg, fontSize: 11, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>Vedi →</button>
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

        {/* Leghe — ora automatico (tutte) */}
        {isValido && (
          <div style={{ marginBottom: 20 }}>
            <div style={T.label}>Leghe</div>
            <div style={{ ...T.sg, fontSize:12, color:`${T.cyan}90`, padding:'10px 14px', background:`${T.cyan}08`, border:`1px solid ${T.cyan}20`, borderRadius:10 }}>
              🌍 Tutte le leghe — Serie A, Premier, La Liga, Bundesliga, Ligue 1, Champions, Europa League
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', background: `${T.red}08`, border: `1px solid ${T.red}30`, borderRadius: 12, ...T.sg, fontSize: 13, color: T.red, marginBottom: 16, lineHeight: 1.6 }}>{error}</div>
        )}

        {/* Importa scalata in corso */}
        {isValido && (
          <details style={{ marginBottom: 16 }}>
            <summary style={{ cursor:'pointer', ...T.sg, fontSize:11, color:'rgba(245,240,232,0.35)', padding:'8px 0', listStyle:'none', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ color:'rgba(245,240,232,0.3)' }}>▸</span> Hai già iniziato questa scalata? (opzionale)
            </summary>
            <div style={{ marginTop:8, padding:'12px 14px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:10 }}>
              <div style={{ ...T.sg, fontSize:11, color:'rgba(245,240,232,0.45)', marginBottom:10, lineHeight:1.5 }}>
                Se hai già giocato qualche step, indica quanti <strong>step vincenti</strong> hai fatto. Verranno marcati come già vinti e il bankroll si aggiorna automaticamente.
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {Array.from({length: Math.min(nGiocate - 1, 15) + 1}, (_, i) => i).map(n => (
                  <button key={n} onClick={() => setStepGiaFatti(n)}
                    style={{
                      padding:'8px 14px', borderRadius:8,
                      background: stepGiaFatti === n ? `${T.cyan}20` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${stepGiaFatti === n ? T.cyan + '60' : 'rgba(255,255,255,0.08)'}`,
                      color: stepGiaFatti === n ? T.cyan : 'rgba(245,240,232,0.5)',
                      ...T.orb, fontSize:14, cursor:'pointer', fontWeight:600,
                    }}>
                    {n}
                  </button>
                ))}
              </div>
              {stepGiaFatti > 0 && (
                <div style={{ marginTop:10, padding:'8px 12px', background:`${T.green}08`, border:`1px solid ${T.green}20`, borderRadius:8, ...T.sg, fontSize:11, color:T.green }}>
                  ✓ {stepGiaFatti} step già vinti — il bankroll partirà da ≈ {(() => {
                    const qm = +opzioni.find(o => o.n === nGiocate).quota.toFixed(2)
                    const preSteps = calcScalata(cap, obj, qm)
                    let br = cap
                    for (let i = 0; i < stepGiaFatti && i < preSteps.length; i++) {
                      br = preSteps[i].bankrollSeVince
                      // ricalcola con bankroll aggiornato
                      const rest = preSteps.slice(i+1)
                    }
                    return fmt(preSteps[stepGiaFatti-1]?.bankrollSeVince || cap)
                  })()}
                </div>
              )}
            </div>
          </details>
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
  if (!scalataAttiva) return null

  const partitaInAttesa = stepCorrente?.matchScelto
  const stepFatti = scalataAttiva.steps.filter(s => s.done).length
  const vinti = scalataAttiva.steps.filter(s => s.esito === 'vinto').length
  const persi = scalataAttiva.steps.filter(s => s.esito === 'perso').length
  const stepCompletati = scalataAttiva.steps.filter(s => s.done)

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <style>{GLOBAL_CSS}</style>
      <div style={T.page}>

        {/* HEADER */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <button onClick={chiudiScalata}
            style={{ background:'none', border:'none', color:'rgba(245,240,232,0.4)', cursor:'pointer', ...T.sg, fontSize:13, padding:0, display:'flex', alignItems:'center', gap:6 }}>
            ← Tutte le scalate
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {/* Indicatore salvataggio */}
            {saveStatus === 'saving' && (
              <div style={{ display:'flex', alignItems:'center', gap:5, ...T.sg, fontSize:10, color:'rgba(245,240,232,0.4)' }}>
                <div style={{ width:10, height:10, borderRadius:'50%', border:`1.5px solid ${T.cyan}30`, borderTop:`1.5px solid ${T.cyan}`, animation:'spin 0.8s linear infinite' }}/>
                Salvo...
              </div>
            )}
            {saveStatus === 'saved' && (
              <div style={{ ...T.sg, fontSize:10, color:T.green }}>✓ Salvato</div>
            )}
            {saveStatus === 'error' && (
              <button onClick={() => persistAttive(scalateAttive)}
                style={{ ...T.sg, fontSize:10, color:T.red, background:`${T.red}10`, border:`1px solid ${T.red}30`, borderRadius:8, padding:'3px 8px', cursor:'pointer' }}>
                ⚠ Errore — riprova
              </button>
            )}
            {scalateAttive.length > 1 && (
              <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.25)' }}>
                {(scalataAperta||0)+1} / {scalateAttive.length}
              </div>
            )}
          </div>
        </div>

        {/* ━━━━━ SEZIONE 1: SITUAZIONE ATTUALE ━━━━━ */}
        <div style={{ marginBottom:8, ...T.sg, fontSize:10, letterSpacing:2, color:'rgba(245,240,232,0.25)', textTransform:'uppercase', fontWeight:700 }}>
          ◉ Situazione attuale
        </div>
        <div style={{ ...T.card, padding:'20px', marginBottom:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
            <div>
              <div style={T.label}>Bankroll</div>
              <div style={{ ...T.orb, fontSize:36, fontWeight:900, background:`linear-gradient(135deg, ${T.cyan}, ${T.purple})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1 }}>
                {fmt(scalataAttiva.bankrollCorrente)}
              </div>
              <div style={{ ...T.sg, fontSize:11, color:'rgba(245,240,232,0.35)', marginTop:4 }}>
                Obiettivo {fmt(scalataAttiva.obiettivo)} · {scalataAttiva.tipoLabel}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={T.label}>Step</div>
              <div style={{ ...T.orb, fontSize:28, color:T.cyan }}>
                {stepIdx+1}<span style={{ fontSize:14, color:'rgba(245,240,232,0.2)' }}>/{scalataAttiva.steps.length}</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height:6, background:'rgba(255,255,255,0.05)', borderRadius:99, overflow:'hidden', marginBottom:6 }}>
            <div style={{ height:'100%', width:`${profitPct}%`, background:`linear-gradient(90deg, ${T.cyan}, ${T.purple})`, borderRadius:99, transition:'width 0.4s' }}/>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', ...T.sg, fontSize:10, color:'rgba(245,240,232,0.25)' }}>
            <span>{fmt(scalataAttiva.capitale)}</span>
            <span>{profitPct.toFixed(0)}%</span>
            <span>{fmt(scalataAttiva.obiettivo)}</span>
          </div>

          {/* Stats mini */}
          {stepFatti > 0 && (
            <div style={{ display:'flex', gap:16, marginTop:14, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ ...T.orb, fontSize:14, color:T.green }}>{vinti}</div>
                <div style={{ ...T.label, marginBottom:0, marginTop:2 }}>Vinti</div>
              </div>
              {persi > 0 && (
                <div>
                  <div style={{ ...T.orb, fontSize:14, color:T.red }}>{persi}</div>
                  <div style={{ ...T.label, marginBottom:0, marginTop:2 }}>Persi</div>
                </div>
              )}
              <div>
                <div style={{ ...T.orb, fontSize:14, color:'rgba(245,240,232,0.5)' }}>{scalataAttiva.steps.length - stepFatti}</div>
                <div style={{ ...T.label, marginBottom:0, marginTop:2 }}>Rimanenti</div>
              </div>
            </div>
          )}
        </div>

        {/* ━━━━━ SEZIONE 2: PROSSIMA GIOCATA ━━━━━ */}
        {stepCorrente && !stepCorrente.done && (
          <>
            <div style={{ marginBottom:8, ...T.sg, fontSize:10, letterSpacing:2, color:'rgba(245,240,232,0.25)', textTransform:'uppercase', fontWeight:700 }}>
              ▸ Prossima giocata
            </div>
            <div style={{ ...T.card, padding:'18px', marginBottom:24, border:`1px solid ${T.cyan}20` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={T.label}>Importo</div>
                  <div style={{ ...T.orb, fontSize:28, color:T.text }}>{fmt(stepCorrente.importo)}</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={T.label}>Quota</div>
                  <div style={{ ...T.orb, fontSize:20, color:'rgba(245,240,232,0.6)' }}>{stepCorrente.quota}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={T.label}>Vincita</div>
                  <div style={{ ...T.orb, fontSize:22, color:T.green }}>{fmt(stepCorrente.vincita)}</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ━━━━━ SEZIONE 3: PARTITA IN ATTESA / PARTITE CONSIGLIATE ━━━━━ */}
        {partitaInAttesa ? (
          <>
            <div style={{ marginBottom:8, ...T.sg, fontSize:10, letterSpacing:2, color:`${T.gold}90`, textTransform:'uppercase', fontWeight:700 }}>
              ⏳ Giocata in attesa
            </div>
            <div style={{ marginBottom:24 }}>
              <AutoImportEsito
                step={stepCorrente}
                stepIdx={stepIdx}
                registraEsito={registraEsito}
                scalataAttiva={scalataAttiva}
                setScalataAttiva={setScalataAttiva}
                persist={persist}
              />
            </div>
          </>
        ) : stepCorrente && !stepCorrente.done && (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ ...T.sg, fontSize:10, letterSpacing:2, color:'rgba(245,240,232,0.25)', textTransform:'uppercase', fontWeight:700 }}>
                ⚡ Partite consigliate
              </div>
              {partiteConsigliate.length > 0 && (
                <div style={{ ...T.sg, fontSize:9, color:'rgba(245,240,232,0.2)' }}>
                  {partiteConsigliate.length} opzioni
                </div>
              )}
            </div>

            {partiteConsigliate.length === 0 && (
              <div style={{ padding:'32px 20px', textAlign:'center', background:'rgba(255,255,255,0.02)', borderRadius:12, marginBottom:16 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${T.cyan}18`, borderTop:`2px solid ${T.cyan}`, animation:'spin 1s linear infinite', margin:'0 auto 12px' }}/>
                <div style={{ ...T.sg, fontSize:12, color:'rgba(245,240,232,0.35)' }}>Sto analizzando le partite di oggi...</div>
              </div>
            )}

            {partiteConsigliate.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                {partiteConsigliate.map((p, i) => {
                  const isSel = selectedForStep[stepIdx]?.index === p.index
                  const vc = { OTTIMA: T.green, BUONA: T.cyan, ACCETTABILE: T.gold }[p.verdetto] || 'rgba(245,240,232,0.3)'
                  return (
                    <div key={i} onClick={() => {
                      setSelectedForStep(prev => ({ ...prev, [stepIdx]: isSel ? null : p }))
                      if (!isSel) setEditedValues(prev => ({ ...prev, [stepIdx]: { quota: p.match?.quota, importo: stepCorrente?.importo } }))
                    }}
                      style={{ padding:'14px 16px', background:isSel ? `${vc}06` : 'rgba(255,255,255,0.02)', border:`1px solid ${isSel ? vc+'45' : 'rgba(255,255,255,0.07)'}`, borderRadius:14, cursor:'pointer', transition:'all 0.15s', boxShadow:isSel ? `0 0 20px ${vc}10` : 'none' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                        <div style={{ flex:1, minWidth:0, marginRight:10 }}>
                          <div style={{ ...T.sg, fontSize:13, fontWeight:600, color:T.text }}>
                            {p.match?.home} <span style={{ color:'rgba(245,240,232,0.25)' }}>vs</span> {p.match?.away}
                          </div>
                          <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.25)', marginTop:2 }}>
                            <span style={{ color:'rgba(245,240,232,0.5)' }}>{p.match?.esito}</span> · {p.match?.commence ? fmtDate(p.match.commence) : ''}
                            <span style={{ color:'rgba(245,240,232,0.15)', marginLeft:4 }}>· {p.match?.bookmaker}</span>
                          </div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                          <div style={{ ...T.orb, fontSize:20, color:vc }}>{p.match?.quota}</div>
                          <div style={{ ...T.sg, fontSize:8, padding:'2px 8px', borderRadius:99, background:`${vc}18`, border:`1px solid ${vc}40`, color:vc, fontWeight:700, letterSpacing:1 }}>{p.verdetto}</div>
                        </div>
                      </div>
                      <div style={{ ...T.sg, fontSize:11, color:'rgba(245,240,232,0.5)', lineHeight:1.5 }}>
                        <span style={{ color:T.green }}>✓</span> {p.motivo_principale}
                      </div>
                      {p.rischio_principale && (
                        <div style={{ ...T.sg, fontSize:11, color:'rgba(245,240,232,0.3)', marginTop:3 }}>
                          <span style={{ color:T.red }}>⚠</span> {p.rischio_principale}
                        </div>
                      )}
                      {isSel && (
                        <div style={{ marginTop:12, padding:'12px', background:'rgba(0,0,0,0.25)', borderRadius:10, borderTop:`1px solid ${vc}25` }}
                          onClick={e => e.stopPropagation()}>
                          <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.35)', marginBottom:8 }}>
                            ✏️ Modifica se giochi su bookmaker diverso
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                            <div>
                              <div style={{ ...T.label, marginBottom:4 }}>Importo (€)</div>
                              <input type="number"
                                value={editedValues[stepIdx]?.importo ?? stepCorrente?.importo}
                                onChange={e => setEditedValues(prev => ({ ...prev, [stepIdx]: { ...prev[stepIdx], importo: e.target.value } }))}
                                style={{ ...T.input, ...T.orb, fontSize:16, padding:'8px 12px' }} />
                            </div>
                            <div>
                              <div style={{ ...T.label, marginBottom:4 }}>Quota</div>
                              <input type="number" step="0.01"
                                value={editedValues[stepIdx]?.quota ?? p.match?.quota}
                                onChange={e => setEditedValues(prev => ({ ...prev, [stepIdx]: { ...prev[stepIdx], quota: e.target.value } }))}
                                style={{ ...T.input, ...T.orb, fontSize:16, padding:'8px 12px' }} />
                            </div>
                          </div>
                          <button onClick={() => {
                            const match = selectedForStep[stepIdx]?.match
                            const edited = editedValues[stepIdx] || {}
                            const quotaUsata = Number(edited.quota) || match?.quota
                            const importoUsato = Number(edited.importo) || stepCorrente?.importo
                            const steps = scalataAttiva.steps.map((s, idx) => idx === stepIdx ? {
                              ...s, matchScelto: { ...match, quota: quotaUsata, importo: importoUsato },
                            } : s)
                            setScalataAttiva({ ...scalataAttiva, steps })
                            setSelectedForStep({})
                          }}
                            style={{ width:'100%', padding:'12px', background:`${T.cyan}18`, border:`1px solid ${T.cyan}40`, borderRadius:10, color:T.cyan, ...T.sg, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                            ⏳ Piazza questa giocata
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ━━━━━ SEZIONE 4: STEP PASSATI (collapsed) ━━━━━ */}
        {stepCompletati.length > 0 && (
          <details style={{ marginBottom:20 }}>
            <summary style={{ cursor:'pointer', padding:'10px 14px', background:'rgba(255,255,255,0.02)', borderRadius:10, ...T.sg, fontSize:11, color:'rgba(245,240,232,0.4)', letterSpacing:1, listStyle:'none' }}>
              📋 STEP PASSATI ({stepCompletati.length})
            </summary>
            <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
              {stepCompletati.map((step, j) => {
                const isV = step.esito === 'vinto'
                return (
                  <div key={j} style={{ padding:'10px 14px', background:isV ? `${T.green}05` : `${T.red}05`, border:`1px solid ${isV ? T.green+'20' : T.red+'20'}`, borderRadius:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ ...T.sg, fontSize:12, color:'rgba(245,240,232,0.7)' }}>
                        <span style={{ color:isV ? T.green : T.red, marginRight:8 }}>{isV ? '✓' : '✗'}</span>
                        Step {step.step} · <span style={T.orb}>{fmt(step.importo)}</span> × {step.quota}
                      </div>
                      <div style={{ ...T.orb, fontSize:12, color:isV ? T.green : T.red }}>
                        {isV ? '+' : '-'}{fmt(isV ? step.vincita - step.importo : step.importo)}
                      </div>
                    </div>
                    {step.matchUsato && (
                      <div style={{ ...T.sg, fontSize:10, color:'rgba(245,240,232,0.3)', marginTop:4 }}>
                        {step.matchUsato.home} vs {step.matchUsato.away}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </details>
        )}

        {/* BOTTONE ABBANDONA */}
        <button onClick={abbandonaScalata}
          style={{ width:'100%', padding:'10px', background:'transparent', border:`1px solid ${T.red}15`, borderRadius:10, color:`${T.red}60`, ...T.sg, fontSize:10, cursor:'pointer', letterSpacing:2, marginTop:20 }}>
          ABBANDONA SCALATA
        </button>
      </div>
    </div>
  )
}
