// MAVIC — Edge Function: cliente-data
// Valida o token server-side e retorna apenas os dados do cliente autenticado.
// Nunca expõe dados de outros clientes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',   // chave secreta — nunca chega ao browser
  )

  // ── GET: carregar dados do cliente ───────────────────────────────────────
  if (req.method === 'GET') {
    const url   = new URL(req.url)
    const nome  = url.searchParams.get('nome')?.trim().toLowerCase()
    const token = url.searchParams.get('token')?.trim()

    if (!nome) return json({ error: 'nome_required' }, 400)

    const { data, error } = await supabase.from('mavic_store').select('key,data')
    if (error) return json({ error: 'db_error' }, 500)

    const store: Record<string, unknown[]> = {}
    ;(data ?? []).forEach((r: { key: string; data: unknown }) => { store[r.key] = r.data as unknown[] })

    const allClients: Record<string, string>[] = (store['clients'] ?? []) as Record<string, string>[]
    const cli = allClients.find(c => c.name?.toLowerCase().trim() === nome)

    if (!cli) return json({ error: 'client_not_found' }, 404)

    // Validação de token (server-side — não pode ser bypassada)
    if (cli.token && token !== cli.token) return json({ error: 'invalid_token' }, 401)

    // Filtrar projetos apenas deste cliente
    type Project = Record<string, unknown>
    const allProjects: Project[] = (store['projects'] ?? []) as Project[]
    const myProjects = allProjects
      .filter(p => (p.client as string)?.toLowerCase().trim() === nome)
      .map(p => ({
        id:        p.id,
        name:      p.name,
        column:    p.column,
        type:      p.type,
        priority:  p.priority,
        date:      p.date,
        value:     p.value,
        payments:  p.payments,
        subtasks:  p.subtasks,
        products:  p.products,
        note:      p.note,
        image:     p.image,
        driveLink: p.driveLink,
        archived:  p.archived,
      }))

    // Filtrar notificações apenas deste cliente
    type Notification = Record<string, unknown>
    const allNotifications: Notification[] = (store['notifications'] ?? []) as Notification[]
    const myNotifications = allNotifications.filter(n => n.clientToken === cli.token)

    // Avisos globais ativos destinados a este cliente
    type GlobalNotice = Record<string, unknown>
    const globalNotices: GlobalNotice[] = (store['global_notices'] ?? []) as GlobalNotice[]
    const myGlobalNotices = globalNotices.filter(gn =>
      gn.active &&
      (gn.targetAll || (gn.targetClients as string[] | undefined)?.some(n => n.toLowerCase() === nome))
    )

    const cfg = (store['config'] ?? {}) as Record<string, unknown>

    return json({
      projects:      myProjects,
      notifications: myNotifications,
      globalNotices: myGlobalNotices,
      // companyName/companyDoc são dados públicos do emissor (usados no recibo em PDF do cliente).
      config:        { columns: cfg.columns, theme: cfg.theme, companyName: cfg.companyName, companyDoc: cfg.companyDoc, projectTypes: cfg.projectTypes, pixKey: cfg.pixKey, pixName: cfg.pixName, pixBank: cfg.pixBank },
      clientName:    cli.name,
      // Dados do próprio cliente devolvidos a ele mesmo — usados só pra montar o recibo em PDF.
      clientDoc:     cli.doc || '',
      clientAddress: cli.address || '',
      hasToken:      !!cli.token,
    })
  }

  // ── POST: marcar aviso como lido ─────────────────────────────────────────
  if (req.method === 'POST') {
    const body = await req.json() as {
      action: 'mark_read' | 'mark_global_read'
      nome: string
      token?: string
      notifId?: number
      noticeId?: number
    }

    const nome  = body.nome?.trim().toLowerCase()
    const token = body.token?.trim()

    if (!nome) return json({ error: 'nome_required' }, 400)

    const { data, error } = await supabase.from('mavic_store').select('key,data')
    if (error) return json({ error: 'db_error' }, 500)

    const store: Record<string, unknown[]> = {}
    ;(data ?? []).forEach((r: { key: string; data: unknown }) => { store[r.key] = r.data as unknown[] })

    const allClients: Record<string, string>[] = (store['clients'] ?? []) as Record<string, string>[]
    const cli = allClients.find(c => c.name?.toLowerCase().trim() === nome)

    if (!cli) return json({ error: 'client_not_found' }, 404)
    if (cli.token && token !== cli.token) return json({ error: 'invalid_token' }, 401)

    // Marcar notificação individual como lida
    if (body.action === 'mark_read' && body.notifId !== undefined) {
      type Notification = Record<string, unknown>
      const notifications: Notification[] = (store['notifications'] ?? []) as Notification[]
      // Só pode marcar como lida uma notificação que pertence a este cliente (mesmo token)
      const target = notifications.find(n => n.id === body.notifId)
      if (!target) return json({ error: 'notification_not_found' }, 404)
      if (target.clientToken !== cli.token) return json({ error: 'forbidden' }, 403)
      const updated = notifications.map(n => n.id === body.notifId ? { ...n, read: true } : n)
      await supabase.from('mavic_store').upsert([{ key: 'notifications', data: updated }], { onConflict: 'key' })
      return json({ ok: true })
    }

    // Marcar aviso global como lido por este cliente
    if (body.action === 'mark_global_read' && body.noticeId !== undefined) {
      type GlobalNotice = Record<string, unknown>
      const globalNotices: GlobalNotice[] = (store['global_notices'] ?? []) as GlobalNotice[]
      // Só pode marcar como lido um aviso que era realmente destinado a este cliente
      const target = globalNotices.find(gn => gn.id === body.noticeId)
      if (!target) return json({ error: 'notice_not_found' }, 404)
      const targetedAtMe = !!target.targetAll ||
        ((target.targetClients as string[] | undefined)?.some(n => n.toLowerCase() === nome))
      if (!targetedAtMe) return json({ error: 'forbidden' }, 403)
      const updated = globalNotices.map(gn => {
        if (gn.id !== body.noticeId) return gn
        const readBy: string[] = Array.isArray(gn.readBy) ? [...gn.readBy as string[]] : []
        if (!readBy.includes(cli.name)) readBy.push(cli.name)
        return { ...gn, readBy }
      })
      await supabase.from('mavic_store').upsert([{ key: 'global_notices', data: updated }], { onConflict: 'key' })
      return json({ ok: true })
    }

    return json({ error: 'invalid_action' }, 400)
  }

  return json({ error: 'method_not_allowed' }, 405)
})
