// api/invite.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // service role key — NON la anon key
)

function generateCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const adminEmail = process.env.ADMIN_EMAIL
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')

  // Verifica che sia l'admin
  if (req.method === 'POST' || req.query.action === 'list') {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user || user.email !== adminEmail) {
      return res.status(403).json({ error: 'Non autorizzato' })
    }

    if (req.method === 'POST') {
      // Crea nuovo link invito
      const code = generateCode()
      const { data, error: insertError } = await supabase
        .from('invite_links')
        .insert({ code, created_by: user.id })
        .select()
        .single()

      if (insertError) return res.status(500).json({ error: insertError.message })
      return res.status(200).json({ code, url: `${process.env.VITE_APP_URL}/invite/${code}` })
    }

    if (req.query.action === 'list') {
      const { data, error: listError } = await supabase
        .from('invite_links')
        .select('*')
        .order('created_at', { ascending: false })
      if (listError) return res.status(500).json({ error: listError.message })
      return res.status(200).json(data)
    }
  }

  // Validate invite code (pubblico)
  if (req.method === 'GET' && req.query.code) {
    const { data, error } = await supabase
      .from('invite_links')
      .select('*')
      .eq('code', req.query.code)
      .single()

    if (error || !data) return res.status(404).json({ valid: false })
    if (data.used_by) return res.status(200).json({ valid: false, reason: 'già utilizzato' })
    return res.status(200).json({ valid: true })
  }

  return res.status(400).json({ error: 'Richiesta non valida' })
}
