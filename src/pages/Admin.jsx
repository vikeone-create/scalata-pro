import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { T, GLOBAL_CSS } from '../theme'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || ''
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

const fmt = n => `€${Number(n).toFixed(2)}`
const fmtDate = d => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtDateTime = d => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Mai'

async function apiCall(path, opts = {}, token = '') {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) }
  })
  return res.json()
}

function Badge({ label, color }) {
  return (
    <span style={{ ...T.sg, fontSize: 9, padding: '2px 8px', borderRadius: 99, background: `${color}18`, border: `1px solid ${color}33`, color, fontWeight: 700, letterSpacing: 1 }}>
      {label}
    </span>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...T.card, width: '100%', maxWidth: 400, padding: '24px', position: 'relative', animation: 'fadeUp 0.2s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ ...T.orb, fontSize: 13, color: T.text, letterSpacing: 1 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.4)', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── TAB UTENTI ──
function TabUtenti({ token }) {
  const [utenti, setUtenti]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState(null)
  const [modalPag, setModalPag]       = useState(null)  // user per aggiungere pagamento
  const [modalMagic, setModalMagic]   = useState(null)  // user per inviare magic link
  const [pagForm, setPagForm]         = useState({ importo: '', note: '', scadenza: '' })
  const [saving, setSaving]           = useState(false)
  const [copied, setCopied]           = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await apiCall('/api/invite?action=users', {}, token)
    if (Array.isArray(data)) setUtenti(data)
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  const revoca = async (user_id, isRevocato) => {
    const action = isRevocato ? 'ripristina' : 'revoca'
    const conf = confirm(isRevocato ? 'Ripristinare l\'accesso?' : 'Revocare l\'accesso a questo utente?')
    if (!conf) return
    await apiCall(`/api/invite?action=${action}`, { method: 'PATCH', body: JSON.stringify({ user_id }) }, token)
    load()
  }

  const inviaMagic = async (email) => {
    setSaving(true)
    await apiCall('/api/invite?action=send-magic', { method: 'POST', body: JSON.stringify({ email }) }, token)
    setSaving(false)
    setModalMagic(null)
    alert(`Magic link inviato a ${email}`)
  }

  const aggiungiPag = async () => {
    if (!pagForm.importo) return
    setSaving(true)
    await apiCall('/api/invite?action=pagamento', {
      method: 'POST',
      body: JSON.stringify({
        user_id: modalPag.id,
        email: modalPag.email,
        importo: pagForm.importo,
        note: pagForm.note,
        scadenza: pagForm.scadenza || null,
      })
    }, token)
    setPagForm({ importo: '', note: '', scadenza: '' })
    setSaving(false)
    setModalPag(null)
    load()
  }

  const eliminaPag = async (pag_id) => {
    if (!confirm('Eliminare questo pagamento?')) return
    await apiCall('/api/invite?action=pagamento', { method: 'DELETE', body: JSON.stringify({ id: pag_id }) }, token)
    load()
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${T.cyan}18`, borderTop: `2px solid ${T.cyan}`, animation: 'spin 1s linear infinite', margin: '0 auto' }} />
    </div>
  )

  return (
    <div>
      {/* Stats utenti */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 20 }}>
        {[
          { l: 'Registrati', v: utenti.length, c: T.cyan },
          { l: 'Attivi', v: utenti.filter(u => !u.revocato).length, c: T.green },
          { l: 'Revocati', v: utenti.filter(u => u.revocato).length, c: T.red },
        ].map(s => (
          <div key={s.l} style={{ ...T.card, padding: '12px', textAlign: 'center' }}>
            <div style={{ ...T.orb, fontSize: 20, color: s.c }}>{s.v}</div>
            <div style={{ ...T.label, marginBottom: 0, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Lista utenti */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {utenti.length === 0 && (
          <div style={{ ...T.sg, fontSize: 13, color: 'rgba(245,240,232,0.2)', textAlign: 'center', padding: '30px 0' }}>Nessun utente registrato</div>
        )}
        {utenti.map((u, i) => {
          const isOpen = expanded === i
          const totPagato = u.pagamenti.reduce((a, p) => a + Number(p.importo), 0)
          const hasPag = u.pagamenti.length > 0
          const ultimoPag = u.pagamenti[0]
          const scaduto = ultimoPag?.scadenza && new Date(ultimoPag.scadenza) < new Date()

          return (
            <div key={u.id} style={{ ...T.card, overflow: 'hidden', border: `1px solid ${u.revocato ? T.red + '25' : hasPag ? T.green + '20' : 'rgba(255,255,255,0.08)'}` }}>
              <div onClick={() => setExpanded(isOpen ? null : i)} style={{ padding: '14px 16px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                    <div style={{ ...T.sg, fontSize: 13, fontWeight: 600, color: u.revocato ? 'rgba(245,240,232,0.3)' : T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.email}
                    </div>
                    <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.25)', marginTop: 2 }}>
                      Iscritto {fmtDate(u.created_at)} · Ultimo accesso {fmtDateTime(u.last_sign_in)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {u.revocato && <Badge label="REVOCATO" color={T.red} />}
                    {!u.revocato && hasPag && !scaduto && <Badge label="PAGANTE" color={T.green} />}
                    {!u.revocato && hasPag && scaduto && <Badge label="SCADUTO" color={T.gold} />}
                    {!u.revocato && !hasPag && <Badge label="FREE" color="rgba(245,240,232,0.3)" />}
                  </div>
                </div>
                {hasPag && (
                  <div style={{ ...T.sg, fontSize: 11, color: T.green }}>
                    Totale pagato: {fmt(totPagato)}
                    {ultimoPag?.scadenza && <span style={{ color: scaduto ? T.red : 'rgba(245,240,232,0.3)', marginLeft: 8 }}>· Scadenza {fmtDate(ultimoPag.scadenza)}</span>}
                  </div>
                )}
                <div style={{ ...T.sg, fontSize: 9, color: 'rgba(245,240,232,0.18)', textAlign: 'right', marginTop: 4 }}>{isOpen ? '▲' : '▼'}</div>
              </div>

              {isOpen && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>

                  {/* Pagamenti */}
                  <div style={T.label}>Pagamenti</div>
                  {u.pagamenti.length === 0 ? (
                    <div style={{ ...T.sg, fontSize: 12, color: 'rgba(245,240,232,0.2)', marginBottom: 10 }}>Nessun pagamento registrato</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      {u.pagamenti.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div>
                            <div style={{ ...T.orb, fontSize: 14, color: T.green }}>{fmt(p.importo)}</div>
                            <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.3)', marginTop: 1 }}>
                              {fmtDate(p.data_pag)}{p.scadenza ? ` → ${fmtDate(p.scadenza)}` : ''}{p.note ? ` · ${p.note}` : ''}
                            </div>
                          </div>
                          <button onClick={() => eliminaPag(p.id)}
                            style={{ background: 'none', border: 'none', color: `${T.red}50`, fontSize: 16, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Azioni */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={() => setModalPag(u)}
                      style={{ ...T.btnGhost, padding: '9px', fontSize: 11, background: `${T.green}0a`, border: `1px solid ${T.green}25`, color: T.green }}>
                      + Aggiungi pagamento
                    </button>
                    <button onClick={() => setModalMagic(u)}
                      style={{ ...T.btnGhost, padding: '9px', fontSize: 11 }}>
                      📧 Invia Magic Link
                    </button>
                    <button onClick={() => revoca(u.id, u.revocato)}
                      style={{ ...T.btnGhost, padding: '9px', fontSize: 11, background: u.revocato ? `${T.green}0a` : `${T.red}0a`, border: `1px solid ${u.revocato ? T.green : T.red}25`, color: u.revocato ? T.green : T.red }}>
                      {u.revocato ? '✓ Ripristina accesso' : '✗ Revoca accesso'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button onClick={load} style={{ ...T.btnGhost, width: '100%', padding: '10px', marginTop: 16, fontSize: 11 }}>
        Aggiorna lista
      </button>

      {/* Modal pagamento */}
      {modalPag && (
        <Modal title={`Pagamento — ${modalPag.email}`} onClose={() => setModalPag(null)}>
          <div style={{ marginBottom: 12 }}>
            <div style={T.label}>Importo (€)</div>
            <input type="number" value={pagForm.importo} onChange={e => setPagForm(p => ({ ...p, importo: e.target.value }))}
              placeholder="Es. 39" style={{ ...T.input, ...T.orb, fontSize: 22 }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={T.label}>Scadenza (opzionale)</div>
            <input type="date" value={pagForm.scadenza} onChange={e => setPagForm(p => ({ ...p, scadenza: e.target.value }))}
              style={{ ...T.input, fontSize: 14 }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={T.label}>Note (opzionale)</div>
            <input type="text" value={pagForm.note} onChange={e => setPagForm(p => ({ ...p, note: e.target.value }))}
              placeholder="Es. Abbonamento mensile" style={{ ...T.input, fontSize: 14 }} />
          </div>
          <button onClick={aggiungiPag} disabled={saving || !pagForm.importo} style={{ ...T.btn, opacity: saving || !pagForm.importo ? 0.4 : 1 }}>
            {saving ? '...' : 'SALVA PAGAMENTO'}
          </button>
        </Modal>
      )}

      {/* Modal magic link */}
      {modalMagic && (
        <Modal title="Invia Magic Link" onClose={() => setModalMagic(null)}>
          <div style={{ ...T.sg, fontSize: 13, color: 'rgba(245,240,232,0.5)', marginBottom: 20, lineHeight: 1.6 }}>
            Verrà inviato un link di accesso direttamente a:<br />
            <span style={{ color: T.cyan, fontWeight: 600 }}>{modalMagic.email}</span>
          </div>
          <button onClick={() => inviaMagic(modalMagic.email)} disabled={saving}
            style={{ ...T.btn, opacity: saving ? 0.4 : 1 }}>
            {saving ? 'Invio...' : '📧 INVIA LINK'}
          </button>
        </Modal>
      )}
    </div>
  )
}

// ── TAB INVITI ──
function TabInviti({ token }) {
  const [links, setLinks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [emailInput, setEmailInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await apiCall('/api/invite?action=list', {}, token)
    if (Array.isArray(data)) setLinks(data)
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  const creaLink = async () => {
    setCreating(true)
    await apiCall('/api/invite?action=create-link', {
      method: 'POST',
      body: JSON.stringify({ email: emailInput || null })
    }, token)
    setEmailInput('')
    setCreating(false)
    load()
  }

  const copyLink = (url) => {
    navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${T.cyan}18`, borderTop: `2px solid ${T.cyan}`, animation: 'spin 1s linear infinite', margin: '0 auto' }} />
    </div>
  )

  return (
    <div>
      {/* Genera link */}
      <div style={{ ...T.card, padding: '16px', marginBottom: 20 }}>
        <div style={T.label}>Genera link invito</div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="email"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            placeholder="Email destinatario (opzionale)"
            style={{ ...T.input, fontSize: 14 }}
          />
          <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.2)', marginTop: 6 }}>
            Se inserisci l'email, il link sarà associato a quella persona
          </div>
        </div>
        <button onClick={creaLink} disabled={creating} style={{ ...T.btn, opacity: creating ? 0.4 : 1 }}>
          {creating ? '...' : '+ GENERA LINK INVITO'}
        </button>
      </div>

      {/* Lista link */}
      <div style={T.label}>Link generati ({links.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {links.map(l => {
          const url = `${APP_URL}/invite/${l.code}`
          const isCopied = copied === url
          return (
            <div key={l.id} style={{ ...T.card, padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ ...T.orb, fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: 2 }}>{l.code}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {l.revocato && <Badge label="REVOCATO" color={T.red} />}
                  {!l.revocato && l.used_by && <Badge label="USATO" color={T.green} />}
                  {!l.revocato && !l.used_by && <Badge label="DISPONIBILE" color={T.cyan} />}
                </div>
              </div>
              {l.email_invitata && (
                <div style={{ ...T.sg, fontSize: 11, color: T.cyan, marginBottom: 4 }}>📧 {l.email_invitata}</div>
              )}
              {l.used_by_email && (
                <div style={{ ...T.sg, fontSize: 11, color: T.green, marginBottom: 4 }}>✓ Usato da: {l.used_by_email}</div>
              )}
              <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.18)', marginBottom: 10, wordBreak: 'break-all' }}>{url}</div>
              {!l.used_by && (
                <button onClick={() => copyLink(url)}
                  style={{ padding: '7px 14px', background: isCopied ? `${T.green}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${isCopied ? T.green + '33' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, color: isCopied ? T.green : 'rgba(245,240,232,0.4)', ...T.sg, fontSize: 11, cursor: 'pointer' }}>
                  {isCopied ? '✓ Copiato' : 'Copia link'}
                </button>
              )}
            </div>
          )
        })}
        {links.length === 0 && (
          <div style={{ ...T.sg, fontSize: 13, color: 'rgba(245,240,232,0.18)', textAlign: 'center', padding: '30px 0' }}>Nessun link ancora</div>
        )}
      </div>
    </div>
  )
}

// ── COMPONENTE PRINCIPALE ──
export default function Admin({ session }) {
  const isAdmin = session?.user?.email === ADMIN_EMAIL
  const [token, setToken]       = useState('')
  const [activeTab, setActiveTab] = useState('utenti')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s?.access_token) setToken(s.access_token)
    })
  }, [])

  if (!isAdmin) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ ...T.sg, fontSize: 13, color: 'rgba(245,240,232,0.2)' }}>Accesso non autorizzato</div>
    </div>
  )

  const tabs = [
    { id: 'utenti',  label: '👥 Utenti' },
    { id: 'inviti',  label: '🔗 Inviti' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <style>{GLOBAL_CSS}</style>
      <div style={T.page}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...T.orb, fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>
            <span style={{ color: T.text }}>ADMIN</span>
            <span style={{ background: `linear-gradient(135deg, ${T.cyan}, ${T.purple})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}> PANEL</span>
          </div>
          <div style={{ ...T.sg, fontSize: 9, color: `${T.purple}80`, letterSpacing: 3, marginTop: 2 }}>GESTIONE UTENTI E ACCESSI</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 99, padding: 4, marginBottom: 24 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 99, border: 'none', cursor: 'pointer', transition: 'all 0.2s', ...T.sg, fontSize: 12, fontWeight: 600, background: activeTab === t.id ? `linear-gradient(135deg, ${T.cyan}, ${T.purple})` : 'transparent', color: activeTab === t.id ? T.bg : 'rgba(245,240,232,0.35)' }}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'utenti' && token && <TabUtenti token={token} />}
        {activeTab === 'inviti' && token && <TabInviti token={token} />}

      </div>
    </div>
  )
}
