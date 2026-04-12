import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || ''

export default function Layout({ session }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = session?.user?.email === ADMIN_EMAIL

  const tabs = [
    { path: '/', label: 'Scalata', icon: <IconScalata /> },
    { path: '/storico', label: 'Storico', icon: <IconStorico /> },
    ...(isAdmin ? [{ path: '/admin', label: 'Admin', icon: <IconAdmin /> }] : []),
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#0c0c0c', paddingBottom:80 }}>
      <Outlet />
      {/* Bottom Nav */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'rgba(12,12,12,0.95)', backdropFilter:'blur(20px)', borderTop:'1px solid rgba(255,255,255,0.06)', zIndex:100 }}>
        <div style={{ maxWidth:480, margin:'0 auto', display:'flex', padding:'0 8px' }}>
          {tabs.map(t => {
            const active = location.pathname === t.path
            return (
              <button key={t.path} onClick={() => navigate(t.path)} style={{ flex:1, padding:'12px 4px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:4, border:'none', background:'transparent', cursor:'pointer', color: active ? '#c9a84c' : 'rgba(245,240,232,0.3)', transition:'color 0.15s' }}>
                <div style={{ width:22, height:22, opacity: active ? 1 : 0.5 }}>{t.icon}</div>
                <div style={{ fontSize:10, fontWeight: active ? 600 : 400, letterSpacing:0.5 }}>{t.label}</div>
                {active && <div style={{ width:20, height:2, borderRadius:99, background:'#c9a84c', marginTop:-2 }} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function IconScalata() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}
function IconStorico() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
function IconAdmin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}
