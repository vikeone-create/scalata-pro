import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { T, GLOBAL_CSS } from '../theme'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || ''

export default function Layout({ session }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = session?.user?.email === ADMIN_EMAIL

  const tabs = [
    { path: '/',                    label: 'SCALATA',     icon: IconScalata },
    { path: '/pronostici',          label: 'PRONOSTICI',  icon: IconPronostici },
    { path: '/storico',             label: 'SCALATE',     icon: IconStorico },
    { path: '/storico-pronostici',  label: 'STATS',       icon: IconStats },
    ...(isAdmin ? [{ path: '/admin', label: 'ADMIN', icon: IconAdmin }] : []),
  ]

  return (
    <div style={{ minHeight: '100vh', background: T.bg, paddingBottom: 80, fontFamily: "'Space Grotesk', sans-serif" }}>
      <style>{GLOBAL_CSS}</style>
      <Outlet />

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(8,8,18,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.07)', zIndex: 100 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', padding: '0 4px', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {tabs.map(t => {
            const active = location.pathname === t.path
            return (
              <button key={t.path} onClick={() => navigate(t.path)}
                style={{ flex: 1, padding: '10px 2px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, border: 'none', background: 'transparent', cursor: 'pointer', transition: 'all 0.2s', WebkitTapHighlightColor: 'transparent', minWidth: 0 }}>
                <div style={{ width: 20, height: 20, color: active ? T.cyan : 'rgba(255,255,255,0.2)', transition: 'color 0.2s', filter: active ? `drop-shadow(0 0 6px ${T.cyan})` : 'none' }}>
                  <t.icon />
                </div>
                <div style={{ ...T.orb, fontSize: 7, fontWeight: active ? 700 : 400, letterSpacing: 1.5, color: active ? T.cyan : 'rgba(255,255,255,0.2)', transition: 'color 0.2s', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%' }}>
                  {t.label}
                </div>
                {active && (
                  <div style={{ width: 20, height: 2, borderRadius: 99, background: `linear-gradient(90deg, ${T.cyan}, ${T.purple})`, boxShadow: `0 0 8px ${T.cyan}` }} />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function IconScalata() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
}
function IconPronostici() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
}
function IconStorico() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
}
function IconStats() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}
function IconAdmin() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
}
