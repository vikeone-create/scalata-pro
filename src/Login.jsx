import { useState } from 'react'
import { supabase } from './supabase'

const WCard = ({ children, style }) => (
  <div style={{
    background: 'rgba(255,245,230,0.07)',
    border: '1px solid rgba(255,220,160,0.15)',
    borderRadius: 24,
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    boxShadow: 'inset 0 1px 0 rgba(255,220,160,0.1)',
    ...style,
  }}>
    {children}
  </div>
)

export default function Login() {
  const [mode, setMode] = useState('login') // login | signup | magic
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'success'|'error', text }

  const inputStyle = {
    width: '100%', padding: '13px 16px',
    background: 'rgba(255,245,230,0.06)',
    border: '1px solid rgba(255,220,160,0.15)',
    borderRadius: 14, color: '#fef3c7',
    fontSize: 15, fontFamily: 'DM Sans, sans-serif',
    boxSizing: 'border-box', outline: 'none',
  }

  const handleSubmit = async () => {
    if (!email) return setMessage({ type: 'error', text: 'Inserisci email' })
    setLoading(true); setMessage(null)
    try {
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        setMessage({ type: 'success', text: '✉️ Link inviato! Controlla la mail.' })
      } else if (mode === 'signup') {
        if (!password) throw new Error('Inserisci una password')
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage({ type: 'success', text: '✅ Account creato! Controlla la mail per confermare.' })
      } else {
        if (!password) throw new Error('Inserisci la password')
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'DM Sans, sans-serif', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>
      {/* Warm bokeh bg */}
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#2a1500 0%,#1c0e00 50%,#0f1a08 100%)', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: -100, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,#b4530955 0%,transparent 65%)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -80, left: -60, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,#92400e44 0%,transparent 65%)', zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 5, width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, fontFamily: 'DM Serif Display, Georgia, serif', color: '#fef3c7', fontWeight: 400, letterSpacing: 1 }}>
            Scalata<span style={{ color: '#f59e0b' }}>Pro</span>
            <span style={{ fontSize: 13, color: 'rgba(134,239,172,0.7)', marginLeft: 8, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, letterSpacing: 2, verticalAlign: 'middle' }}>AI</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,200,120,0.35)', letterSpacing: 4, marginTop: 6, textTransform: 'uppercase' }}>Educational Tool</div>
        </div>

        <WCard style={{ padding: '28px 24px' }}>
          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,200,120,0.06)', borderRadius: 12, padding: 4 }}>
            {[['login','Accedi'],['signup','Registrati'],['magic','Magic Link']].map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); setMessage(null) }} style={{ flex: 1, padding: '8px 4px', border: 'none', borderRadius: 9, background: mode === m ? 'rgba(245,158,11,0.2)' : 'transparent', color: mode === m ? '#f5d090' : 'rgba(255,200,120,0.35)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,200,120,0.4)', letterSpacing: 2, marginBottom: 7, textTransform: 'uppercase' }}>Email</div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tuaemail@esempio.it" onKeyDown={e => e.key === 'Enter' && handleSubmit()} style={{ ...inputStyle, '::placeholder': { color: 'rgba(255,200,120,0.2)' } }} />
          </div>

          {mode !== 'magic' && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,200,120,0.4)', letterSpacing: 2, marginBottom: 7, textTransform: 'uppercase' }}>Password</div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()} style={inputStyle} />
            </div>
          )}

          {mode === 'magic' && (
            <div style={{ marginBottom: 20, padding: '10px 12px', background: 'rgba(255,200,120,0.05)', border: '1px solid rgba(255,200,120,0.1)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,200,120,0.5)', lineHeight: 1.7 }}>Ricevi un link di accesso direttamente nella tua email. Nessuna password necessaria.</div>
            </div>
          )}

          {/* Message */}
          {message && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: message.type === 'success' ? 'rgba(134,239,172,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${message.type === 'success' ? 'rgba(134,239,172,0.3)' : 'rgba(248,113,113,0.3)'}`, borderRadius: 10, fontSize: 12, color: message.type === 'success' ? '#86efac' : '#f87171', lineHeight: 1.6 }}>
              {message.text}
            </div>
          )}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.18)', color: loading ? 'rgba(255,200,120,0.3)' : '#fef3c7', fontSize: 13, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', letterSpacing: 2, backdropFilter: 'blur(10px)', boxShadow: '0 0 24px rgba(245,158,11,0.2)', transition: 'all 0.2s', marginBottom: 12 }}>
            {loading ? '⏳ ...' : mode === 'login' ? 'ACCEDI →' : mode === 'signup' ? 'REGISTRATI →' : 'INVIA LINK →'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,220,160,0.08)' }} />
            <div style={{ fontSize: 10, color: 'rgba(255,200,120,0.25)' }}>oppure</div>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,220,160,0.08)' }} />
          </div>

          {/* Google */}
          <button onClick={handleGoogle} disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: 14, border: '1px solid rgba(255,220,160,0.1)', background: 'rgba(255,245,230,0.04)', color: 'rgba(255,220,160,0.6)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all 0.2s' }}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#EA4335" d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"/><path fill="#FBBC05" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96a4.3 4.3 0 0 1-1.84 2.81l2.84 2.2c1.7-1.55 2.68-3.85 2.68-6.51z"/><path fill="#34A853" d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z"/><path fill="#4285F4" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.79.53-1.8.84-3.12.84-2.38 0-4.4-1.57-5.12-3.74L.96 13.04C2.44 15.98 5.48 18 9 18z"/></svg>
            Continua con Google
          </button>
        </WCard>

        <div style={{ marginTop: 20, fontSize: 10, color: 'rgba(255,200,120,0.2)', textAlign: 'center', lineHeight: 2 }}>
          ⚠️ Strumento puramente educativo · Non costituisce invito al gioco<br />Il gioco d'azzardo può creare dipendenza · Gioca responsabilmente
        </div>
      </div>
    </div>
  )
}
