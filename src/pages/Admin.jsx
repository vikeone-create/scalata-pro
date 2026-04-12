import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || ''

export default function Admin({ session }) {
  const isAdmin = session?.user?.email === ADMIN_EMAIL
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(null)

  const fetchLinks = async () => {
    const { data: { session: s } } = await supabase.auth.getSession()
    const token = s?.access_token
    const res = await fetch('/api/invite?action=list', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setLinks(data)
  }

  useEffect(() => { if (isAdmin) fetchLinks() }, [isAdmin])

  const creaLink = async () => {
    setLoading(true)
    const { data: { session: s } } = await supabase.auth.getSession()
    const token = s?.access_token
    const res = await fetch('/api/invite', { method:'POST', headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' } })
    const data = await res.json()
    if (data.code) { await fetchLinks() }
    setLoading(false)
  }

  const copyLink = (url) => {
    navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 2000)
  }

  const appUrl = window.location.origin

  const C = {
    page: { maxWidth:480, margin:'0 auto', padding:'24px 16px' },
    h: { fontFamily:'DM Serif Display,serif' },
    gold: '#c9a84c',
    label: { fontSize:10, color:'rgba(245,240,232,0.35)', letterSpacing:3, textTransform:'uppercase', marginBottom:8 },
  }

  if (!isAdmin) return (
    <div style={{ minHeight:'100vh', background:'#0c0c0c', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize:14, color:'rgba(245,240,232,0.3)' }}>Accesso non autorizzato</div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0c0c0c' }}>
      <div style={C.page}>
        <div style={{ marginBottom:28 }}>
          <div style={{ ...C.h, fontSize:28, color:'#f5f0e8', fontWeight:400 }}>Admin</div>
          <div style={{ fontSize:12, color:'rgba(245,240,232,0.3)', marginTop:4 }}>Gestione link invito</div>
        </div>

        <button onClick={creaLink} disabled={loading} style={{ width:'100%', padding:'14px', borderRadius:14, border:`1px solid ${C.gold}55`, background:'rgba(201,168,76,0.12)', color:'#f5f0e8', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif', letterSpacing:1.5, marginBottom:24, opacity:loading?0.5:1 }}>
          {loading ? '...' : '+ CREA NUOVO LINK INVITO'}
        </button>

        <div style={C.label}>Link generati ({links.length})</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {links.map(l => {
            const url = `${appUrl}/invite/${l.code}`
            const isCopied = copied === url
            return (
              <div key={l.id} style={{ padding:'14px 16px', background:'rgba(255,255,255,0.03)', border:`1px solid ${l.used_by ? 'rgba(134,239,172,0.15)' : 'rgba(255,255,255,0.07)'}`, borderRadius:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'rgba(245,240,232,0.8)', fontFamily:'monospace', letterSpacing:2 }}>{l.code}</div>
                  <div style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background: l.used_by ? 'rgba(134,239,172,0.1)' : 'rgba(255,255,255,0.05)', color: l.used_by ? '#86efac' : 'rgba(245,240,232,0.3)', border:`1px solid ${l.used_by ? 'rgba(134,239,172,0.2)' : 'rgba(255,255,255,0.08)'}` }}>
                    {l.used_by ? 'Usato' : 'Disponibile'}
                  </div>
                </div>
                <div style={{ fontSize:11, color:'rgba(245,240,232,0.25)', marginBottom:10, wordBreak:'break-all' }}>{url}</div>
                <button onClick={() => copyLink(url)} style={{ padding:'7px 14px', background: isCopied ? 'rgba(134,239,172,0.1)' : 'rgba(255,255,255,0.04)', border:`1px solid ${isCopied ? 'rgba(134,239,172,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius:8, color: isCopied ? '#86efac' : 'rgba(245,240,232,0.5)', fontSize:11, cursor:'pointer', fontFamily:'DM Sans,sans-serif', transition:'all 0.15s' }}>
                  {isCopied ? '✓ Copiato' : 'Copia link'}
                </button>
              </div>
            )
          })}
          {links.length === 0 && <div style={{ fontSize:13, color:'rgba(245,240,232,0.2)', textAlign:'center', padding:'30px 0' }}>Nessun link ancora</div>}
        </div>
      </div>
    </div>
  )
}
