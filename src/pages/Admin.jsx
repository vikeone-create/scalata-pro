import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { T, GLOBAL_CSS } from '../theme'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || ''

export default function Admin({ session }) {
  const isAdmin = session?.user?.email === ADMIN_EMAIL
  const [links, setLinks]             = useState([])
  const [copied, setCopied]           = useState(null)
  const [loadingLink, setLoadingLink] = useState(false)
  const [stats, setStats]             = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [activeTab, setActiveTab]     = useState('stats')

  useEffect(() => {
    if (!isAdmin) return
    fetchStats(); fetchLinks()
  }, [isAdmin])

  const fetchStats = async () => {
    setLoadingStats(true)
    try {
      const { data: rows } = await supabase
        .from('pronostici_storico')
        .select('esatto, direzione_corretta, pred_confidenza, data, league')
        .eq('verificato', true)
        .order('data', { ascending: false })
        .limit(500)

      if (!rows?.length) { setStats(null); setLoadingStats(false); return }

      const totali   = rows.length
      const esatti   = rows.filter(r => r.esatto).length
      const direzione = rows.filter(r => r.direzione_corretta).length
      const alta     = rows.filter(r => r.pred_confidenza === 'ALTA')
      const altaEsatti = alta.filter(r => r.esatto).length
      const ultimi30 = rows.slice(0, 30)
      const ultimi30Dir = ultimi30.filter(r => r.direzione_corretta).length

      const perLega = {}
      for (const r of rows) {
        const k = r.league || 'Altro'
        if (!perLega[k]) perLega[k] = { tot: 0, esatti: 0, dir: 0 }
        perLega[k].tot++
        if (r.esatto) perLega[k].esatti++
        if (r.direzione_corretta) perLega[k].dir++
      }

      setStats({
        totali, esatti, direzione,
        accEsatto: Math.round(esatti / totali * 100),
        acc1x2: Math.round(direzione / totali * 100),
        altaTot: alta.length,
        altaAcc: alta.length ? Math.round(altaEsatti / alta.length * 100) : 0,
        ultimi30Acc: Math.round(ultimi30Dir / Math.min(30, ultimi30.length) * 100),
        perLega,
      })
    } catch(e) { console.error(e) }
    setLoadingStats(false)
  }

  const fetchLinks = async () => {
    const { data: { session: s } } = await supabase.auth.getSession()
    const token = s?.access_token
    const res = await fetch('/api/invite?action=list', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setLinks(data)
  }

  const creaLink = async () => {
    setLoadingLink(true)
    const { data: { session: s } } = await supabase.auth.getSession()
    const token = s?.access_token
    await fetch('/api/invite', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
    await fetchLinks()
    setLoadingLink(false)
  }

  const copyLink = (url) => {
    navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 2000)
  }

  const appUrl = window.location.origin

  if (!isAdmin) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ ...T.sg, fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>Accesso non autorizzato</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <style>{GLOBAL_CSS}</style>
      <div style={T.page}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...T.orb, fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: 2 }}>ADMIN</div>
          <div style={{ ...T.sg, fontSize: 9, color: `${T.purple}80`, letterSpacing: 3, marginTop: 2, textTransform: 'uppercase' }}>Pannello di controllo</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 99, padding: 4, marginBottom: 20 }}>
          {[{ id: 'stats', label: '📊 Modello' }, { id: 'links', label: '🔗 Inviti' }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 99, border: 'none', cursor: 'pointer', transition: 'all 0.2s', ...T.sg, fontSize: 12, fontWeight: 600, background: activeTab === t.id ? `linear-gradient(135deg, ${T.cyan}, ${T.purple})` : 'transparent', color: activeTab === t.id ? T.bg : 'rgba(245,240,232,0.35)' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── STATS TAB ── */}
        {activeTab === 'stats' && (
          <div>
            {loadingStats ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${T.cyan}18`, borderTop: `2px solid ${T.cyan}`, animation: 'spin 1s linear infinite', margin: '0 auto' }} />
              </div>
            ) : !stats ? (
              <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                <div style={{ ...T.orb, fontSize: 36, color: 'rgba(0,212,255,0.12)', marginBottom: 12 }}>◎</div>
                <div style={{ ...T.sg, fontSize: 13, color: 'rgba(245,240,232,0.3)' }}>Nessun dato ancora</div>
                <div style={{ ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.18)', marginTop: 8, lineHeight: 1.8 }}>
                  I risultati reali vengono aggiornati<br />automaticamente ogni mattina
                </div>
              </div>
            ) : (
              <>
                {/* KPI */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {[
                    { l: 'Acc. 1X2',    v: `${stats.acc1x2}%`,      sub: `${stats.direzione}/${stats.totali}`,          g: `linear-gradient(90deg, ${T.cyan}, ${T.purple})` },
                    { l: 'Acc. Esatto', v: `${stats.accEsatto}%`,    sub: `${stats.esatti}/${stats.totali}`,             g: `linear-gradient(90deg, ${T.green}, ${T.cyan})` },
                    { l: 'Trend 30gg',  v: `${stats.ultimi30Acc}%`,  sub: 'ultime 30 partite',                           g: `linear-gradient(90deg, ${T.purple}, ${T.pink})` },
                    { l: 'Alta conf.',  v: `${stats.altaAcc}%`,      sub: `${stats.altaTot} partite`,                    g: `linear-gradient(90deg, ${T.cyan}, ${T.green})` },
                  ].map(s => (
                    <div key={s.l} style={{ ...T.card, padding: '14px' }}>
                      <div style={{ ...T.orb, fontSize: 22, fontWeight: 800, background: s.g, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.v}</div>
                      <div style={{ ...T.label, marginTop: 3, marginBottom: 2 }}>{s.l}</div>
                      <div style={{ ...T.sg, fontSize: 9, color: 'rgba(245,240,232,0.2)' }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Baseline comparison */}
                <div style={{ ...T.card, padding: '14px', marginBottom: 16 }}>
                  <div style={T.label}>Confronto baseline random</div>
                  {[
                    { l: '1X2 (modello)',   v: stats.acc1x2,    base: 33, color: T.cyan },
                    { l: 'Esatto (modello)', v: stats.accEsatto, base: 4,  color: T.green },
                  ].map(s => (
                    <div key={s.l} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', ...T.sg, fontSize: 11, color: 'rgba(245,240,232,0.45)', marginBottom: 4 }}>
                        <span>{s.l}</span>
                        <span style={{ color: s.color, fontWeight: 700 }}>{s.v}% <span style={{ color: 'rgba(245,240,232,0.2)', fontWeight: 400 }}>vs {s.base}% random</span></span>
                      </div>
                      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${s.base}%`, background: 'rgba(255,255,255,0.12)', borderRadius: 99 }} />
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${s.v}%`, background: s.color, borderRadius: 99, boxShadow: `0 0 8px ${s.color}66`, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Per lega */}
                <div style={T.label}>Per campionato</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {Object.entries(stats.perLega).sort(([,a],[,b]) => b.tot - a.tot).map(([lega, s]) => (
                    <div key={lega} style={{ ...T.card, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ ...T.sg, fontSize: 12, fontWeight: 600, color: 'rgba(245,240,232,0.7)' }}>{lega}</div>
                        <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.25)' }}>{s.tot} partite</div>
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ ...T.sg, fontSize: 11, color: T.cyan }}>1X2: <span style={{ fontWeight: 700 }}>{Math.round(s.dir / s.tot * 100)}%</span></div>
                        <div style={{ ...T.sg, fontSize: 11, color: T.green }}>Esatto: <span style={{ fontWeight: 700 }}>{Math.round(s.esatti / s.tot * 100)}%</span></div>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={fetchStats} style={{ ...T.btnGhost, width: '100%', padding: '11px', letterSpacing: 1 }}>
                  AGGIORNA STATISTICHE
                </button>
              </>
            )}
          </div>
        )}

        {/* ── LINKS TAB ── */}
        {activeTab === 'links' && (
          <div>
            <button onClick={creaLink} disabled={loadingLink}
              style={{ ...T.btn, marginBottom: 20, opacity: loadingLink ? 0.4 : 1 }}>
              {loadingLink ? '...' : '+ CREA LINK INVITO'}
            </button>

            <div style={T.label}>Link generati ({links.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {links.map(l => {
                const url = `${appUrl}/invite/${l.code}`
                const isCopied = copied === url
                return (
                  <div key={l.id} style={{ ...T.card, padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ ...T.orb, fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: 2 }}>{l.code}</div>
                      <div style={{ ...T.sg, fontSize: 9, padding: '2px 8px', borderRadius: 99, background: l.used_by ? `${T.green}18` : 'rgba(255,255,255,0.04)', color: l.used_by ? T.green : 'rgba(245,240,232,0.3)', border: `1px solid ${l.used_by ? T.green + '33' : 'rgba(255,255,255,0.07)'}`, fontWeight: 700 }}>
                        {l.used_by ? '✓ Usato' : 'Disponibile'}
                      </div>
                    </div>
                    <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.18)', marginBottom: 10, wordBreak: 'break-all', lineHeight: 1.6 }}>{url}</div>
                    <button onClick={() => copyLink(url)}
                      style={{ padding: '7px 14px', background: isCopied ? `${T.green}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${isCopied ? T.green + '33' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, color: isCopied ? T.green : 'rgba(245,240,232,0.4)', ...T.sg, fontSize: 11, cursor: 'pointer', transition: 'all 0.2s' }}>
                      {isCopied ? '✓ Copiato' : 'Copia link'}
                    </button>
                  </div>
                )
              })}
              {links.length === 0 && (
                <div style={{ ...T.sg, fontSize: 13, color: 'rgba(245,240,232,0.18)', textAlign: 'center', padding: '30px 0' }}>Nessun link ancora</div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
