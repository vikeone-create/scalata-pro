// theme.js — Design system ScalataPro · Liquid Glass
// Importato da tutti i page components

export const T = {
  // Colori
  cyan:   '#00d4ff',
  purple: '#a050ff',
  green:  '#00ff96',
  pink:   '#ff46a0',
  gold:   '#c9a84c',
  red:    '#ff4444',
  text:   '#f5f0e8',
  bg:     '#080812',

  // Font
  orb: { fontFamily: "'Orbitron', sans-serif" },
  sg:  { fontFamily: "'Space Grotesk', sans-serif" },

  // Card glass
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    backdropFilter: 'blur(12px)',
  },

  // Card con accent glow
  cardGlow: (color) => ({
    background: `${color}08`,
    border: `1px solid ${color}30`,
    borderRadius: 16,
    boxShadow: `0 0 24px ${color}10`,
  }),

  // Label uppercase
  label: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 9,
    color: 'rgba(245,240,232,0.3)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },

  // Bottone primario gradient
  btn: {
    background: 'linear-gradient(135deg, #00d4ff, #a050ff)',
    border: 'none',
    borderRadius: 99,
    color: '#080812',
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1,
    padding: '14px 24px',
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 0 24px rgba(0,212,255,0.25)',
    transition: 'all 0.2s',
  },

  // Bottone ghost
  btnGhost: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 99,
    color: 'rgba(245,240,232,0.5)',
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    padding: '10px 20px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  // Numero con gradiente cyan→purple
  numGrad: {
    background: 'linear-gradient(135deg, #00d4ff, #a050ff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontFamily: "'Orbitron', sans-serif",
  },

  // Page container
  page: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '24px 16px 96px',
  },

  // Input
  input: {
    width: '100%',
    padding: '13px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    color: '#f5f0e8',
    fontSize: 15,
    fontFamily: "'Space Grotesk', sans-serif",
    boxSizing: 'border-box',
    outline: 'none',
  },
}

// Google Fonts import string (inserita in ogni page via <style>)
export const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');`

export const GLOBAL_CSS = `
  ${FONTS}
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
  body { margin:0; background:#080812; }
  input, button { font-family: 'Space Grotesk', sans-serif; }
  input::placeholder { color: rgba(245,240,232,0.2); }
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(0,212,255,0.2); border-radius:99px; }
`
