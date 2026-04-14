import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { supabase } from './supabase'
import Login from './pages/Login'
import Scalata from './pages/Scalata'
import Storico from './pages/Storico'
import StoricoPronostici from './pages/StoricoPronostici'
import Pronostici from './pages/Pronostici'
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
          <Route path="/pronostici" element={<Pronostici />} />
          <Route path="/storico" element={<Storico session={session} />} />
          <Route path="/storico-pronostici" element={<StoricoPronostici />} />
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
    <div style={{ minHeight:'100vh', background:'#080812', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Space+Grotesk:wght@300;400;500;600;700&display=swap'); @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.85)}}`}</style>
      <div style={{ fontFamily:"'Orbitron', sans-serif", fontSize:22, fontWeight:800, letterSpacing:2, background:'linear-gradient(90deg,#00d4ff,#a050ff)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
        SCALATAPRO
      </div>
      <div style={{ display:'flex', gap:6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'linear-gradient(135deg,#00d4ff,#a050ff)', animation:`pulse 1.2s ${i*0.2}s ease-in-out infinite` }}/>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.2;transform:scale(1)}50%{opacity:1;transform:scale(1.4)}}`}</style>
    </div>
  )
}
