// api/invite.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function generateCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function getAdmin(token) {
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user || user.email !== process.env.ADMIN_EMAIL) return null
  return user
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  const { action } = req.query

  // ── CHECK EMAIL (usato dal Login per sapere se email è autorizzata) ──
  if (req.method === 'GET' && action === 'check-email') {
    const { email } = req.query
    if (!email) return res.status(400).json({ allowed: false })

    // 1. Già registrata in auth.users?
    const { data: users } = await supabase.auth.admin.listUsers()
    const esistente = users?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (esistente) {
      // Controlla che non sia revocato
      const { data: link } = await supabase
        .from('invite_links')
        .select('revocato')
        .eq('used_by', esistente.id)
        .single()
      if (link?.revocato) return res.status(200).json({ allowed: false, reason: 'accesso_revocato' })
      return res.status(200).json({ allowed: true, registered: true })
    }

    // 2. Email nella whitelist?
    const { data: wl } = await supabase
      .from('email_whitelist')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()
    if (wl) return res.status(200).json({ allowed: true, registered: false })

    // 3. Email associata a un link invito non ancora usato?
    const { data: inv } = await supabase
      .from('invite_links')
      .select('id, used_by')
      .eq('email_invitata', email.toLowerCase())
      .is('used_by', null)
      .single()
    if (inv) return res.status(200).json({ allowed: true, registered: false })

    return res.status(200).json({ allowed: false, reason: 'non_autorizzata' })
  }

  // ── VALIDATE CODE (pubblico, dal link /invite/:code) ──
  if (req.method === 'GET' && req.query.code) {
    const { data, error } = await supabase
      .from('invite_links')
      .select('*')
      .eq('code', req.query.code)
      .single()
    if (error || !data) return res.status(404).json({ valid: false })
    if (data.used_by) return res.status(200).json({ valid: false, reason: 'già utilizzato' })
    if (data.revocato) return res.status(200).json({ valid: false, reason: 'revocato' })
    return res.status(200).json({ valid: true, email: data.email_invitata })
  }

  // ── TUTTO IL RESTO RICHIEDE ADMIN ──
  const admin = await getAdmin(token)
  if (!admin) return res.status(403).json({ error: 'Non autorizzato' })

  // ── LIST LINKS ──
  if (req.method === 'GET' && action === 'list') {
    const { data, error } = await supabase
      .from('invite_links')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })

    // Arricchisci con email utente se used_by presente
    const { data: users } = await supabase.auth.admin.listUsers()
    const userMap = {}
    users?.users?.forEach(u => { userMap[u.id] = u.email })

    const enriched = data.map(l => ({
      ...l,
      used_by_email: l.used_by ? userMap[l.used_by] : null,
    }))
    return res.status(200).json(enriched)
  }

  // ── LIST USERS ──
  if (req.method === 'GET' && action === 'users') {
    const { data: { users }, error } = await supabase.auth.admin.listUsers()
    if (error) return res.status(500).json({ error: error.message })

    // Prendi link associati per sapere chi è revocato
    const { data: links } = await supabase
      .from('invite_links')
      .select('used_by, revocato')
      .not('used_by', 'is', null)

    const revokedSet = new Set(
      (links || []).filter(l => l.revocato).map(l => l.used_by)
    )

    // Prendi pagamenti
    const { data: pags } = await supabase
      .from('pagamenti')
      .select('user_id, importo, stato, scadenza, data_pag')
      .order('created_at', { ascending: false })

    const pagByUser = {}
    ;(pags || []).forEach(p => {
      if (!pagByUser[p.user_id]) pagByUser[p.user_id] = []
      pagByUser[p.user_id].push(p)
    })

    const result = users
      .filter(u => u.email !== process.env.ADMIN_EMAIL)
      .map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in: u.last_sign_in_at,
        revocato: revokedSet.has(u.id),
        pagamenti: pagByUser[u.id] || [],
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    return res.status(200).json(result)
  }

  // ── CREA LINK INVITO ──
  if (req.method === 'POST' && action === 'create-link') {
    const { email } = req.body || {}
    const code = generateCode()
    const { data, error } = await supabase
      .from('invite_links')
      .insert({ code, created_by: admin.id, email_invitata: email?.toLowerCase() || null })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ code, url: `${process.env.VITE_APP_URL}/invite/${code}` })
  }

  // ── CREA LINK (vecchio metodo POST senza action — compatibilità) ──
  if (req.method === 'POST' && !action) {
    const { email } = req.body || {}
    const code = generateCode()
    const { data, error } = await supabase
      .from('invite_links')
      .insert({ code, created_by: admin.id, email_invitata: email?.toLowerCase() || null })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ code, url: `${process.env.VITE_APP_URL}/invite/${code}` })
  }

  // ── REVOCA ACCESSO ──
  if (req.method === 'PATCH' && action === 'revoca') {
    const { user_id } = req.body || {}
    if (!user_id) return res.status(400).json({ error: 'user_id mancante' })

    // Revoca il link associato all'utente
    await supabase
      .from('invite_links')
      .update({ revocato: true })
      .eq('used_by', user_id)

    // Disabilita utente su Supabase Auth
    await supabase.auth.admin.updateUserById(user_id, { ban_duration: '876600h' }) // ~100 anni

    return res.status(200).json({ success: true })
  }

  // ── RIPRISTINA ACCESSO ──
  if (req.method === 'PATCH' && action === 'ripristina') {
    const { user_id } = req.body || {}
    if (!user_id) return res.status(400).json({ error: 'user_id mancante' })

    await supabase
      .from('invite_links')
      .update({ revocato: false })
      .eq('used_by', user_id)

    await supabase.auth.admin.updateUserById(user_id, { ban_duration: 'none' })

    return res.status(200).json({ success: true })
  }

  // ── AGGIUNGI PAGAMENTO ──
  if (req.method === 'POST' && action === 'pagamento') {
    const { user_id, email, importo, note, scadenza, data_pag } = req.body || {}
    if (!user_id || !importo) return res.status(400).json({ error: 'Dati mancanti' })

    const { data, error } = await supabase
      .from('pagamenti')
      .insert({ user_id, email, importo: Number(importo), note, scadenza: scadenza || null, data_pag: data_pag || new Date().toISOString().split('T')[0], stato: 'attivo' })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // ── ELIMINA PAGAMENTO ──
  if (req.method === 'DELETE' && action === 'pagamento') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id mancante' })
    await supabase.from('pagamenti').delete().eq('id', id)
    return res.status(200).json({ success: true })
  }

  // ── INVIA MAGIC LINK MANUALE ──
  if (req.method === 'POST' && action === 'send-magic') {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ error: 'email mancante' })
    const { error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: process.env.VITE_APP_URL }
    })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(400).json({ error: 'Azione non valida' })
}
