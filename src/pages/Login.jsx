import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { T, GLOBAL_CSS } from '../theme'

export default function Login({ inviteCode }) {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState(null)
  const [inviteValid, setInviteValid] = useState(null)
  const [sent, setSent]       = useState(false)

  useEffect(() => {
    if (!inviteCode) return
    fetch(`/api/invite?code=${inviteCode}`)
      .then(r => r.json())
      .then(d => {
        setInviteValid(d.valid)
        if (d.email) setEmail(d.email) // pre-compila email se presente nel link
      })
      .catch(() => setInviteValid(false))
  }, [inviteCode])

  const handle = async () => {
    if (!email) return setMsg({ type: 'error', text: 'Inserisci la tua email' })
    setLoading(true); setMsg(null)

    try {
      if (inviteCode) {
        // Flusso con link invito — valida il codice
        if (inviteValid === false) throw new Error('Link invito non valido')
        const r = await fetch(`/api/invite?code=${inviteCode}`)
        const d = await r.json()
        if (!d.valid) throw new Error('Link invito non valido o già usato')
      } else {
        // Flusso Magic Link normale — controlla se email è autorizzata
        const r = await fetch(`/api/invite?action=check-email&email=${encodeURIComponent(email)}`)
        const d = await r.json()
        if (!d.allowed) {
          if (d.reason === 'accesso_revocato') throw new Error('Il tuo accesso è stato revocato. Contatta l\'amministratore.')
          throw new Error('Email non autorizzata. Accesso solo su invito.')
        }
      }

      // Invia magic link
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
      })
      if (error) throw error
      setSent(true)
    } catch(e) {
      setMsg({ type: 'error', text: e.message })
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 300, height: 300, background: `radial-gradient(circle, ${T.cyan}12 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '15%', left: '20%', width: 200, height: 200, background: `radial-gradient(circle, ${T.purple}10 0%, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 380, position: 'relative', animation: 'fadeUp 0.4s ease' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ ...T.orb, fontSize: 32, fontWeight: 900, letterSpacing: 3 }}>
            <span style={{ color: T.text }}>SCALATA</span>
            <span style={{ background: `linear-gradient(135deg, ${T.cyan}, ${T.purple})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PRO</span>
          </div>
          <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.25)', letterSpacing: 3, marginTop: 6, textTransform: 'uppercase' }}>
            Accesso riservato
          </div>
          {inviteCode && inviteValid === true  && <div style={{ marginTop: 10, ...T.sg, fontSize: 11, color: T.green }}>✓ Link invito valido</div>}
          {inviteCode && inviteValid === false && <div style={{ marginTop: 10, ...T.sg, fontSize: 11, color: T.red }}>✗ Link invito non valido</div>}
        </div>

        <div style={{ ...T.card, padding: '28px 24px' }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
              <div style={{ ...T.orb, fontSize: 14, color: T.cyan, marginBottom: 8 }}>Link inviato!</div>
              <div style={{ ...T.sg, fontSize: 13, color: 'rgba(245,240,232,0.45)', lineHeight: 1.7 }}>
                Controlla la mail a<br />
                <span style={{ color: T.text, fontWeight: 600 }}>{email}</span><br />
                e clicca il link per accedere.
              </div>
              <button onClick={() => { setSent(false); setEmail(''); setMsg(null) }}
                style={{ ...T.btnGhost, marginTop: 20, width: '100%', padding: '10px' }}>
                Usa un'altra email
              </button>
            </div>
          ) : (
            <>
              <div style={{ ...T.sg, fontSize: 13, color: 'rgba(245,240,232,0.4)', marginBottom: 20, lineHeight: 1.6 }}>
                Inserisci la tua email — ti mandiamo un link magico per accedere.
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={T.label}>Email</div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handle()}
                  placeholder="tuaemail@esempio.it"
                  style={T.input}
                  autoFocus
                  readOnly={inviteCode && !!email} // se email pre-compilata dal link, blocca modifica
                />
              </div>

              {msg && (
                <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, ...T.sg, fontSize: 12, lineHeight: 1.6, background: msg.type === 'success' ? 'rgba(0,255,150,0.07)' : 'rgba(255,68,68,0.07)', border: `1px solid ${msg.type === 'success' ? T.green + '44' : T.red + '44'}`, color: msg.type === 'success' ? T.green : T.red }}>
                  {msg.text}
                </div>
              )}

              <button
                onClick={handle}
                disabled={loading || (inviteCode && inviteValid === false)}
                style={{ ...T.btn, opacity: (loading || (inviteCode && inviteValid === false)) ? 0.4 : 1 }}
              >
                {loading ? '...' : 'INVIA MAGIC LINK'}
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: 20, ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.12)', textAlign: 'center', lineHeight: 2 }}>
          Solo uso educativo · Il gioco può creare dipendenza
        </div>
      </div>
    </div>
  )
}
