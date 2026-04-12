import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { supabase } from './supabase'
import Login from './pages/Login'
import Scalata from './pages/Scalata'
import Storico from './pages/Storico'
import Admin from './pages/Admin'
import Layout from './components/Layout'

function InviteRedirect() {
  const { code } = useParams()
  return <Login inviteCode={code} />
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return <Splash />

  return (
    <Routes>
      <Route path="/invite/:code" element={<InviteRedirect />} />
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/" replace />} />
      {session ? (
        <Route element={<Layout session={session} />}>
          <Route path="/" element={<Scalata session={session} />} />
          <Route path="/storico" element={<Storico session={session} />} />
          <Route path="/admin" element={<Admin session={session} />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  )
}

function Splash() {
  return (
    <div style={{ minHeight:'100vh', background:'#0c0c0c', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20 }}>
      <div style={{ fontFamily:'DM Serif Display,serif', fontSize:32, color:'#f5f0e8', letterSpacing:1 }}>
        Scalata<span style={{ color:'#c9a84c' }}>Pro</span>
      </div>
      <div style={{ display:'flex', gap:6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#c9a84c', animation:`pulse 1.2s ${i*0.2}s ease-in-out infinite` }} />
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.2;transform:scale(1)}50%{opacity:1;transform:scale(1.4)}}`}</style>
    </div>
  )
}
