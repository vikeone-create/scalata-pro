import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Login({ inviteCode }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState(inviteCode ? 'signup' : 'login')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [inviteValid, setInviteValid] = useState(null)

  useEffect(() => {
    if (!inviteCode) return
    fetch(`/api/invite?code=${inviteCode}`)
      .then(r => r.json())
      .then(d => setInviteValid(d.valid))
      .catch(() => setInviteValid(false))
  }, [inviteCode])

  const handle = async () => {
    if (!email) return setMsg({ type:'error', text:'Inserisci la tua email' })
    setLoading(true); setMsg(null)
    try {
      if (mode === 'login') {
        if (!password) throw new Error('Inserisci la password')
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        if (!password) throw new Error('Scegli una password')
        if (!inviteCode) throw new Error('Registrazione solo su invito')
        // Validate invite again
        const r = await fetch(`/api/invite?code=${inviteCode}`)
        const d = await r.json()
        if (!d.valid) throw new Error('Link invito non valido o già usato')
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg({ type:'success', text:'Account creato! Controlla la mail per confermare.' })
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        setMsg({ type:'success', text:'Link inviato! Controlla la mail.' })
      }
    } catch(e) { setMsg({ type:'error', text: e.message }) }
    setLoading(false)
  }

  const s = {
    wrap: { minHeight:'100vh', background:'#0c0c0c', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 20px' },
    card: { width:'100%', maxWidth:380, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:24, padding:'36px 28px' },
    logo: { textAlign:'center', marginBottom:32 },
    logoText: { fontFamily:'DM Serif Display,serif', fontSize:30, color:'#f5f0e8', letterSpacing:1 },
    sub: { fontSize:11, color:'rgba(245,240,232,0.3)', letterSpacing:3, marginTop:6, textTransform:'uppercase' },
    label: { fontSize:11, color:'rgba(245,240,232,0.4)', letterSpacing:2, marginBottom:7, textTransform:'uppercase' },
    input: { width:'100%', padding:'13px 16px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, color:'#f5f0e8', fontSize:15, fontFamily:'DM Sans,sans-serif', boxSizing:'border-box', outline:'none', marginBottom:16 },
    btn: { width:'100%', padding:'14px', borderRadius:14, border:'1px solid rgba(201,168,76,0.4)', background:'rgba(201,168,76,0.12)', color:'#f5f0e8', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif', letterSpacing:1.5, marginTop:4, transition:'all 0.15s' },
    tabs: { display:'flex', gap:4, marginBottom:28, background:'rgba(255,255,255,0.04)', borderRadius:12, padding:4 },
    tab: (active) => ({ flex:1, padding:'8px', border:'none', borderRadius:9, background: active ? 'rgba(201,168,76,0.15)' : 'transparent', color: active ? '#c9a84c' : 'rgba(245,240,232,0.3)', fontSize:12, cursor:'pointer', fontFamily:'DM Sans,sans-serif', fontWeight: active ? 600 : 400, transition:'all 0.15s' }),
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logo}>
          <div style={s.logoText}>Scalata<span style={{ color:'#c9a84c' }}>Pro</span></div>
          {inviteCode && inviteValid === true && <div style={{ marginTop:10, fontSize:11, color:'#86efac', letterSpacing:1 }}>✓ Link invito valido</div>}
          {inviteCode && inviteValid === false && <div style={{ marginTop:10, fontSize:11, color:'#f87171' }}>✗ Link invito non valido</div>}
          {!inviteCode && <div style={s.sub}>Accesso riservato</div>}
        </div>

        {!inviteCode && (
          <div style={s.tabs}>
            {[['login','Accedi'],['magic','Magic Link']].map(([m,l]) => (
              <button key={m} onClick={() => { setMode(m); setMsg(null) }} style={s.tab(mode===m)}>{l}</button>
            ))}
          </div>
        )}

        <div>
          <div style={s.label}>Email</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==='Enter' && handle()} placeholder="tuaemail@esempio.it" style={s.input} />
        </div>

        {mode !== 'magic' && (
          <div>
            <div style={s.label}>Password</div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==='Enter' && handle()} placeholder="••••••••" style={s.input} />
          </div>
        )}

        {msg && (
          <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14, fontSize:12, background: msg.type==='success' ? 'rgba(134,239,172,0.08)' : 'rgba(248,113,113,0.08)', border:`1px solid ${msg.type==='success' ? 'rgba(134,239,172,0.3)' : 'rgba(248,113,113,0.3)'}`, color: msg.type==='success' ? '#86efac' : '#f87171', lineHeight:1.6 }}>
            {msg.text}
          </div>
        )}

        <button onClick={handle} disabled={loading || (inviteCode && inviteValid === false)} style={{ ...s.btn, opacity: (loading || (inviteCode && inviteValid === false)) ? 0.4 : 1 }}>
          {loading ? '...' : mode==='login' ? 'ACCEDI' : mode==='signup' ? 'CREA ACCOUNT' : 'INVIA LINK'}
        </button>

        <div style={{ marginTop:20, fontSize:10, color:'rgba(245,240,232,0.15)', textAlign:'center', lineHeight:1.9 }}>
          Solo uso educativo · Il gioco può creare dipendenza
        </div>
      </div>
    </div>
  )
}
