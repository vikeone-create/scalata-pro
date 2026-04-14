import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { T, GLOBAL_CSS } from '../theme'

export default function Login({ inviteCode }) {
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [mode, setMode]           = useState(inviteCode ? 'signup' : 'login')
  const [loading, setLoading]     = useState(false)
  const [msg, setMsg]             = useState(null)
  const [inviteValid, setInviteValid] = useState(null)

  useEffect(() => {
    if (!inviteCode) return
    fetch(`/api/invite?code=${inviteCode}`)
      .then(r => r.json())
      .then(d => setInviteValid(d.valid))
      .catch(() => setInviteValid(false))
  }, [inviteCode])

  const handle = async () => {
    if (!email) return setMsg({ type: 'error', text: 'Inserisci la tua email' })
    setLoading(true); setMsg(null)
    try {
      if (mode === 'login') {
        if (!password) throw new Error('Inserisci la password')
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        if (!password) throw new Error('Scegli una password')
        if (!inviteCode) throw new Error('Registrazione solo su invito')
        const r = await fetch(`/api/invite?code=${inviteCode}`)
        const d = await r.json()
        if (!d.valid) throw new Error('Link invito non valido o già usato')
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg({ type: 'success', text: 'Account creato! Controlla la mail per confermare.' })
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        setMsg({ type: 'success', text: 'Link inviato! Controlla la mail.' })
      }
    } catch(e) { setMsg({ type: 'error', text: e.message }) }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 300, height: 300, background: `radial-gradient(circle, ${T.cyan}12 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '15%', left: '20%', width: 200, height: 200, background: `radial-gradient(circle, ${T.purple}10 0%, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 380, position: 'relative', animation: 'fadeUp 0.4s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ ...T.orb, fontSize: 32, fontWeight: 900, letterSpacing: 3 }}>
            <span style={{ color: T.text }}>SCALATA</span>
            <span style={{ background: `linear-gradient(135deg, ${T.cyan}, ${T.purple})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PRO</span>
          </div>
          <div style={{ ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.25)', letterSpacing: 3, marginTop: 6, textTransform: 'uppercase' }}>
            {inviteCode ? '' : 'Accesso riservato'}
          </div>
          {inviteCode && inviteValid === true  && <div style={{ marginTop: 10, ...T.sg, fontSize: 11, color: T.green }}>✓ Link invito valido</div>}
          {inviteCode && inviteValid === false && <div style={{ marginTop: 10, ...T.sg, fontSize: 11, color: T.red }}>✗ Link invito non valido</div>}
        </div>

        <div style={{ ...T.card, padding: '28px 24px' }}>
          {!inviteCode && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 99, padding: 4 }}>
              {[['login', 'Accedi'], ['magic', 'Magic Link']].map(([m, l]) => (
                <button key={m} onClick={() => { setMode(m); setMsg(null) }} style={{ flex: 1, padding: '9px 0', borderRadius: 99, border: 'none', cursor: 'pointer', transition: 'all 0.2s', ...T.sg, fontSize: 12, fontWeight: 600, background: mode === m ? `linear-gradient(135deg, ${T.cyan}, ${T.purple})` : 'transparent', color: mode === m ? T.bg : 'rgba(245,240,232,0.35)' }}>
                  {l}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={T.label}>Email</div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} placeholder="tuaemail@esempio.it" style={T.input} />
          </div>

          {mode !== 'magic' && (
            <div style={{ marginBottom: 16 }}>
              <div style={T.label}>Password</div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} placeholder="••••••••" style={T.input} />
            </div>
          )}

          {msg && (
            <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, ...T.sg, fontSize: 12, lineHeight: 1.6, background: msg.type === 'success' ? 'rgba(0,255,150,0.07)' : 'rgba(255,68,68,0.07)', border: `1px solid ${msg.type === 'success' ? T.green + '44' : T.red + '44'}`, color: msg.type === 'success' ? T.green : T.red }}>
              {msg.text}
            </div>
          )}

          <button onClick={handle} disabled={loading || (inviteCode && inviteValid === false)} style={{ ...T.btn, opacity: (loading || (inviteCode && inviteValid === false)) ? 0.4 : 1 }}>
            {loading ? '...' : mode === 'login' ? 'ACCEDI' : mode === 'signup' ? 'CREA ACCOUNT' : 'INVIA LINK'}
          </button>
        </div>

        <div style={{ marginTop: 20, ...T.sg, fontSize: 10, color: 'rgba(245,240,232,0.12)', textAlign: 'center', lineHeight: 2 }}>
          Solo uso educativo · Il gioco può creare dipendenza
        </div>
      </div>
    </div>
  )
}
