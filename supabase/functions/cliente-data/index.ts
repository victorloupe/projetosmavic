// MAVIC — Edge Function: cliente-data
// Valida o token server-side e retorna apenas os dados do cliente autenticado.
// Nunca expõe dados de outros clientes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

type Rec = Record<string, unknown>
type Store = Record<string, unknown>

// Lê os registros (um por linha em mavic_records) e monta o mesmo formato de antes:
// store.projects = [...], store.clients = [...], ..., store.config = {...}
// deno-lint-ignore no-explicit-any
async function loadStore(supabase: any): Promise<Store | null> {
  const store: Store = { clients: [], projects: [], notifications: [], global_notices: [] }
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('mavic_records')
      .select('collection,data')
      .in('collection', ['clients', 'projects', 'notifications', 'global_notices'])
      .order('collection').order('id')
      .range(from, from + PAGE - 1)
    if (error) return null
    ;(data ?? []).forEach((r: { collection: string; data: unknown }) => { (store[r.collection] as unknown[]).push(r.data) })
    if (!data || data.length < PAGE) break
  }
  const { data: cfgRow, error: cfgErr } = await supabase.from('mavic_store').select('data').eq('key', 'config').maybeSingle()
  if (cfgErr) return null
  store['config'] = cfgRow?.data ?? {}
  return store
}

// Grava UM registro (não reescreve a coleção inteira)
// deno-lint-ignore no-explicit-any
async function saveRecords(supabase: any, rows: Array<{ collection: string; rec: Rec }>) {
  const now = new Date().toISOString()
  return await supabase.from('mavic_records').upsert(
    rows.map(r => ({ collection: r.collection, id: String(r.rec.id), data: r.rec, updated_at: now })),
    { onConflict: 'collection,id' },
  )
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

    const store = await loadStore(supabase) as Record<string, unknown[]> | null
    if (!store) return json({ error: 'db_error' }, 500)

    const allClients: Record<string, string>[] = (store['clients'] ?? []) as Record<string, string>[]
    const cli = allClients.find(c => c.name?.toLowerCase().trim() === nome)

    if (!cli) return json({ error: 'client_not_found' }, 404)

    // Validação de token (server-side — não pode ser bypassada).
    // Token é obrigatório: cliente sem token não acessa o portal (o admin gera um ao compartilhar o link).
    if (!cli.token || !token || token !== cli.token) return json({ error: 'invalid_token' }, 401)

    // Filtrar projetos apenas deste cliente
    type Project = Record<string, unknown>
    const allProjects: Project[] = (store['projects'] ?? []) as Project[]
    const myProjects = allProjects
      .filter(p => (p.client as string)?.toLowerCase().trim() === nome)
      .map(p => ({
        id:             p.id,
        name:           p.name,
        client:         p.client,
        createdAt:      p.createdAt,
        pendingClientRevision: p.pendingClientRevision,
        column:         p.column,
        type:           p.type,
        priority:       p.priority,
        date:           p.date,
        value:          p.value,
        payments:       p.payments,
        installments:   p.installments,
        subtasks:       p.subtasks,
        products:       p.products,
        note:           p.note,
        image:          p.image,
        driveLink:      p.driveLink,
        archived:       p.archived,
        revisions:      p.revisions,
        revisionsLimit: p.revisionsLimit,
        revisionLogs:   p.revisionLogs,
        reviewFiles:    p.reviewFiles || [],
        reviewNotes:    p.reviewNotes || '',
        clientApproved: p.clientApproved,
        clientApprovedAt: p.clientApprovedAt,
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

    const cfg = (store['config'] ?? {}) as unknown as Record<string, unknown>

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

  // ── POST: ações do cliente ─────────────────────────────────────────
  if (req.method === 'POST') {
    const body = await req.json() as {
      action: 'mark_read' | 'mark_global_read' | 'approve_project' | 'request_revision'
      nome: string
      token?: string
      notifId?: number
      noticeId?: number
      projectId?: number
      notes?: string
      pins?: Array<{ id: string | number; fileId?: string; fileName?: string; fileUrl?: string; xPct: number; yPct: number; comment: string; number: number }>
    }

    const nome  = body.nome?.trim().toLowerCase()
    const token = body.token?.trim()

    if (!nome) return json({ error: 'nome_required' }, 400)

    const store = await loadStore(supabase) as Record<string, unknown[]> | null
    if (!store) return json({ error: 'db_error' }, 500)

    const allClients: Record<string, string>[] = (store['clients'] ?? []) as Record<string, string>[]
    const cli = allClients.find(c => c.name?.toLowerCase().trim() === nome)

    if (!cli) return json({ error: 'client_not_found' }, 404)
    if (!cli.token || !token || token !== cli.token) return json({ error: 'invalid_token' }, 401)

    type Project = Record<string, unknown>
    const allProjects: Project[] = (store['projects'] ?? []) as Project[]

    // 1. Aprovar Projeto (Cliente confirma aprovação)
    if (body.action === 'approve_project' && body.projectId !== undefined) {
      const targetProj = allProjects.find(p => p.id === body.projectId)
      if (!targetProj) return json({ error: 'project_not_found' }, 404)
      if ((targetProj.client as string)?.toLowerCase().trim() !== nome) return json({ error: 'forbidden' }, 403)

      const updatedProj: Rec = {
        ...targetProj,
        column: 'Concluído',
        clientApproved: true,
        clientApprovedAt: new Date().toISOString(),
        pendingClientRevision: false
      }

      const { error: upErr } = await saveRecords(supabase, [{ collection: 'projects', rec: updatedProj }])
      if (upErr) return json({ error: 'db_error' }, 500)
      return json({ ok: true })
    }

    // 2. Solicitar Ajustes (Projeto volta para Desenvolvimento com +1 Revisão)
    if (body.action === 'request_revision' && body.projectId !== undefined) {
      const targetProj = allProjects.find(p => p.id === body.projectId)
      if (!targetProj) return json({ error: 'project_not_found' }, 404)
      if ((targetProj.client as string)?.toLowerCase().trim() !== nome) return json({ error: 'forbidden' }, 403)

      type Column = { id: string }
      const cfg = (store['config'] ?? {}) as unknown as Record<string, unknown>
      const cols = (cfg.columns ?? []) as Column[]
      const altCol = cols.find(c => (c.id || '').toLowerCase().includes('altera'))?.id
      const devCol = cols.find(c => (c.id || '').toLowerCase().includes('desenv'))?.id
      const targetColumn = altCol || devCol || 'Desenvolvimento'
      const notesText = (body.notes || '').toString().slice(0, 5000)

      const p = targetProj
      const updatedProj: Rec = (() => {
        const currentRevs = Number(p.revisions || 0) + 1
        const logs = Array.isArray(p.revisionLogs) ? [...p.revisionLogs] : []
        logs.push({
          id: Date.now(),
          timestamp: new Date().toISOString(),
          text: notesText || 'Ajustes solicitados pelo cliente',
          pins: Array.isArray(body.pins) ? body.pins.slice(0, 200) : [],
          author: cli.name || 'Cliente'
        })
        return {
          ...p,
          column: targetColumn,
          revisions: currentRevs,
          revisionLogs: logs,
          pendingClientRevision: true
        }
      })()

      // Notificação para o painel administrativo (sem clientToken = aviso interno do escritório)
      const adminNotif: Rec = {
        id: Date.now(),
        title: 'Ajuste Solicitado pelo Cliente',
        message: `O cliente ${cli.name} solicitou alteração no projeto "${targetProj.name}": "${notesText}"`,
        projectName: targetProj.name,
        createdAt: new Date().toISOString(),
        read: false
      }

      const { error: upErr } = await saveRecords(supabase, [
        { collection: 'projects', rec: updatedProj },
        { collection: 'notifications', rec: adminNotif },
      ])
      if (upErr) return json({ error: 'db_error' }, 500)
      return json({ ok: true })
    }

    // 3. Marcar notificação individual como lida
    if (body.action === 'mark_read' && body.notifId !== undefined) {
      type Notification = Record<string, unknown>
      const notifications: Notification[] = (store['notifications'] ?? []) as Notification[]
      const target = notifications.find(n => n.id === body.notifId)
      if (!target) return json({ error: 'notification_not_found' }, 404)
      if (target.clientToken !== cli.token) return json({ error: 'forbidden' }, 403)
      const { error: upErr } = await saveRecords(supabase, [{ collection: 'notifications', rec: { ...target, read: true } }])
      if (upErr) return json({ error: 'db_error' }, 500)
      return json({ ok: true })
    }

    // 4. Marcar aviso global como lido por este cliente
    if (body.action === 'mark_global_read' && body.noticeId !== undefined) {
      type GlobalNotice = Record<string, unknown>
      const globalNotices: GlobalNotice[] = (store['global_notices'] ?? []) as GlobalNotice[]
      const target = globalNotices.find(gn => gn.id === body.noticeId)
      if (!target) return json({ error: 'notice_not_found' }, 404)
      const targetedAtMe = !!target.targetAll ||
        ((target.targetClients as string[] | undefined)?.some(n => n.toLowerCase() === nome))
      if (!targetedAtMe) return json({ error: 'forbidden' }, 403)
      const readBy: string[] = Array.isArray(target.readBy) ? [...target.readBy as string[]] : []
      if (!readBy.includes(cli.name)) readBy.push(cli.name)
      const { error: upErr } = await saveRecords(supabase, [{ collection: 'global_notices', rec: { ...target, readBy } }])
      if (upErr) return json({ error: 'db_error' }, 500)
      return json({ ok: true })
    }

    return json({ error: 'invalid_action' }, 400)
  }

  return json({ error: 'method_not_allowed' }, 405)
})
