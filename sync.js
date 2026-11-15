// ══════════════════════════════════════════════════════════════════════════
//  MAVIC — Sincronização por registro (tabela public.mavic_records)
//
//  Cada projeto, cliente, orçamento, serviço, notificação e aviso é uma linha
//  própria: (collection, id, data). O app continua trabalhando com os arrays
//  em memória (projects, clients, ...); este módulo só decide O QUE enviar:
//
//  * "snapshot" = último estado conhecido do servidor, por id (JSON canônico).
//  * Ao sincronizar, só os registros diferentes do snapshot são enviados
//    (upsert), e só os que sumiram localmente são apagados no servidor.
//  * Alterações de outros dispositivos chegam pelo Realtime, registro a
//    registro, sem sobrescrever o que este dispositivo ainda não enviou.
//
//  As configurações (colunas, modelos, Pix...) continuam numa linha única:
//  mavic_store.key = 'config'.
// ══════════════════════════════════════════════════════════════════════════

const SYNC_COLLECTIONS = ['projects', 'clients', 'notifications', 'global_notices', 'budgets', 'services'];
const SYNC_SNAPSHOT_KEY = 'mavic_sync_snapshot';
const SYNC_PAGE_SIZE = 1000;

let syncSnapshot = null;      // { projects: {id: json}, ..., __config: json }
let syncInFlight = false;
let syncAgain = false;
let remoteRenderTimer = null;

// ── Acesso aos arrays globais do app (declarados no common.js) ─────────────
function syncGetCollection(name) {
  switch (name) {
    case 'projects': return projects;
    case 'clients': return clients;
    case 'notifications': return notifications;
    case 'global_notices': return globalNotices;
    case 'budgets': return budgets;
    case 'services': return services;
  }
  return [];
}

function syncSetCollection(name, arr) {
  switch (name) {
    case 'projects': projects = arr; break;
    case 'clients': clients = arr; break;
    case 'notifications': notifications = arr; break;
    case 'global_notices': globalNotices = arr; break;
    case 'budgets': budgets = arr; break;
    case 'services': services = arr; break;
  }
}

function syncRecordId(r) {
  return (r && typeof r === 'object' && r.id !== undefined && r.id !== null && r.id !== '') ? String(r.id) : null;
}

// JSON com chaves ordenadas: o Postgres (jsonb) devolve as chaves em outra
// ordem, então a comparação precisa ser independente da ordem.
function stableJson(v) {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(x => (x === undefined || typeof x === 'function') ? 'null' : stableJson(x)).join(',') + ']';
  const keys = Object.keys(v).filter(k => v[k] !== undefined && typeof v[k] !== 'function').sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableJson(v[k])).join(',') + '}';
}

function sortById(arr) {
  return arr.sort((a, b) => {
    const na = Number(a?.id), nb = Number(b?.id);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a?.id).localeCompare(String(b?.id));
  });
}

function buildConfigPayload() {
  return {
    columns: appColumns,
    visibleColumns,
    minimizedColumns,
    noteTemplates,
    quickMsgs,
    projectTypes,
    theme: appTheme,
    waTemplate: localStorage.getItem('mavic_waTemplate') || '',
    companyName: localStorage.getItem('mavic_companyName') || '',
    companyDoc: localStorage.getItem('mavic_companyDoc') || '',
    pixKey: localStorage.getItem('mavic_pixKey') || '',
    pixName: localStorage.getItem('mavic_pixName') || '',
    pixBank: localStorage.getItem('mavic_pixBank') || ''
  };
}

// ── Snapshot (persistido para sobreviver a recarregamentos e modo offline) ─
function loadSyncSnapshot() {
  try { syncSnapshot = JSON.parse(localStorage.getItem(SYNC_SNAPSHOT_KEY) || 'null'); }
  catch (e) { syncSnapshot = null; }
  return syncSnapshot;
}

function saveSyncSnapshot() {
  try { localStorage.setItem(SYNC_SNAPSHOT_KEY, JSON.stringify(syncSnapshot)); } catch (e) {}
}

function snapshotFromState(cols, cfg) {
  const s = { __config: cfg ? stableJson(cfg) : null };
  SYNC_COLLECTIONS.forEach(c => {
    s[c] = {};
    (cols[c] || []).forEach(r => { const id = syncRecordId(r); if (id) s[c][id] = stableJson(r); });
  });
  return s;
}

// ── Leitura da nuvem ───────────────────────────────────────────────────────
async function fetchAllRecords() {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from('mavic_records')
      .select('collection,id,data')
      .order('collection').order('id')
      .range(from, from + SYNC_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < SYNC_PAGE_SIZE) break;
    from += SYNC_PAGE_SIZE;
  }
  return rows;
}

// Devolve { cols: {projects:[...], ...}, config: {...} } direto do servidor.
async function fetchCloudState() {
  const [rows, cfgRes] = await Promise.all([
    fetchAllRecords(),
    sb.from('mavic_store').select('data').eq('key', 'config').maybeSingle()
  ]);
  if (cfgRes.error) throw cfgRes.error;
  // Tabela vazia = migração não feita ou sem permissão (RLS): nunca tratar como "apagar tudo".
  if (!rows.length) throw new Error('mavic_records vazio ou sem permissão');

  const cols = {};
  SYNC_COLLECTIONS.forEach(c => { cols[c] = []; });
  rows.forEach(r => { if (cols[r.collection] && r.data && typeof r.data === 'object') cols[r.collection].push(r.data); });
  SYNC_COLLECTIONS.forEach(c => sortById(cols[c]));
  return { cols, config: (cfgRes.data && cfgRes.data.data) || {} };
}

// Reaplica sobre o estado da nuvem as alterações locais que ainda não foram
// enviadas (feitas offline ou numa sessão que fechou antes de sincronizar).
// Compara o cache local com o snapshot antigo: só o que o usuário mudou aqui.
function overlayPendingLocalChanges(cloudCols, oldSnapshot) {
  if (!oldSnapshot || localStorage.getItem('mavic_pending_sync') !== 'true') return 0;
  const localKeys = {
    projects: 'mavic_projects', clients: 'mavic_clients', notifications: 'mavic_notifications',
    global_notices: 'mavic_global_notices', budgets: 'mavic_budgets', services: 'mavic_services'
  };
  let applied = 0;
  SYNC_COLLECTIONS.forEach(c => {
    let local;
    try { local = JSON.parse(localStorage.getItem(localKeys[c]) || 'null'); } catch (e) { local = null; }
    if (!Array.isArray(local)) return;
    const snap = oldSnapshot[c] || {};
    const target = cloudCols[c];
    const seen = new Set();
    local.forEach(rec => {
      const id = syncRecordId(rec);
      if (!id || seen.has(id)) return;
      seen.add(id);
      if (snap[id] === stableJson(rec)) return; // não mudou aqui
      const idx = target.findIndex(r => syncRecordId(r) === id);
      if (idx >= 0) target[idx] = rec; else target.push(rec);
      applied++;
    });
    // Apagados aqui (estavam no snapshot e sumiram do cache local)
    if ((c === 'projects' || c === 'clients') && local.length === 0) return; // proteção contra cache zerado
    Object.keys(snap).forEach(id => {
      if (seen.has(id)) return;
      const idx = target.findIndex(r => syncRecordId(r) === id);
      if (idx >= 0) { target.splice(idx, 1); applied++; }
    });
  });
  return applied;
}

// ── Envio para a nuvem (só diferenças) ─────────────────────────────────────
function computeSyncDiff() {
  const upserts = [];
  const deletes = {};
  SYNC_COLLECTIONS.forEach(c => {
    const cur = syncGetCollection(c) || [];
    const snap = syncSnapshot[c] || {};
    const seen = new Set();
    cur.forEach(rec => {
      const id = syncRecordId(rec);
      if (!id || seen.has(id)) return;
      seen.add(id);
      const j = stableJson(rec);
      if (snap[id] !== j) upserts.push({ collection: c, id, data: rec, json: j });
    });
    const snapIds = Object.keys(snap);
    // SyncGuard: lista de projetos/clientes zerada nunca apaga tudo na nuvem
    if ((c === 'projects' || c === 'clients') && cur.length === 0 && snapIds.length > 0) {
      console.warn('[Sync] Lista local de ' + c + ' vazia — exclusões ignoradas por segurança.');
      return;
    }
    const gone = snapIds.filter(id => !seen.has(id));
    if (gone.length) deletes[c] = gone;
  });
  const cfg = buildConfigPayload();
  const cfgJson = stableJson(cfg);
  const configChanged = syncSnapshot.__config !== cfgJson;
  return { upserts, deletes, cfg, cfgJson, configChanged };
}

async function syncCloud() {
  if (!sb) { setSync('off'); return; }
  if (!syncSnapshot) {
    // Ainda não sabemos o que existe no servidor: enviar agora poderia sobrescrever dados.
    console.warn('[Sync] Sem snapshot do servidor — aguardando carregar da nuvem.');
    setSync('off');
    return;
  }
  if (syncInFlight) { syncAgain = true; return; }
  syncInFlight = true;
  setSync('sync');
  try {
    const { upserts, deletes, cfg, cfgJson, configChanged } = computeSyncDiff();
    const now = new Date().toISOString();

    for (let i = 0; i < upserts.length; i += 500) {
      const chunk = upserts.slice(i, i + 500);
      const { error } = await sb.from('mavic_records').upsert(
        chunk.map(u => ({ collection: u.collection, id: u.id, data: u.data, updated_at: now })),
        { onConflict: 'collection,id' }
      );
      if (error) throw error;
      chunk.forEach(u => { (syncSnapshot[u.collection] = syncSnapshot[u.collection] || {})[u.id] = u.json; });
      saveSyncSnapshot();
    }

    for (const c of Object.keys(deletes)) {
      const ids = deletes[c];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error } = await sb.from('mavic_records').delete().eq('collection', c).in('id', chunk);
        if (error) throw error;
        chunk.forEach(id => { delete syncSnapshot[c][id]; });
        saveSyncSnapshot();
      }
    }

    if (configChanged) {
      const { error } = await sb.from('mavic_store').upsert([{ key: 'config', data: cfg }], { onConflict: 'key' });
      if (error) throw error;
      syncSnapshot.__config = cfgJson;
      saveSyncSnapshot();
    }

    sessionStorage.setItem('mavic_last_local_save', String(Date.now()));
    const left = computeSyncDiff();
    if (!left.upserts.length && !Object.keys(left.deletes).length && !left.configChanged) {
      localStorage.removeItem('mavic_pending_sync');
    }
    setSync('ok');
    updateNavAlertBadges();
  } catch (e) {
    console.warn('Sync failed', e);
    setSync('off');
  } finally {
    syncInFlight = false;
    if (syncAgain) { syncAgain = false; setTimeout(syncCloud, 300); }
  }
}

// ── Realtime: alterações de outros dispositivos, registro a registro ──────
function scheduleRemoteRender() {
  clearTimeout(remoteRenderTimer);
  remoteRenderTimer = setTimeout(() => {
    try {
      checkAndMigrateLegacyProducts();
      reconcileAllProjectsFinancials();
      syncLocal();
      updateNavAlertBadges();
      if (typeof renderCurrentPage === 'function') renderCurrentPage();
    } catch (e) {
      console.warn('[Realtime] Falha ao atualizar a tela', e);
    }
  }, 200);
}

function applyRemoteRecord(payload) {
  if (!syncSnapshot) return;
  const ev = payload.eventType;
  const row = ev === 'DELETE' ? payload.old : payload.new;
  if (!row || !row.collection || row.id === undefined || row.id === null) return;
  const c = row.collection;
  if (!SYNC_COLLECTIONS.includes(c)) return;
  const id = String(row.id);
  const arr = syncGetCollection(c) || [];
  const idx = arr.findIndex(r => syncRecordId(r) === id);
  const snapCol = syncSnapshot[c] || (syncSnapshot[c] = {});
  const localJson = idx >= 0 ? stableJson(arr[idx]) : undefined;
  const pendingLocal = localJson !== snapCol[id]; // mudança feita aqui e ainda não enviada

  if (ev === 'DELETE') {
    if (snapCol[id] === undefined && idx < 0) return;
    delete snapCol[id];
    // Se havia edição local pendente, mantém o registro (será reenviado): perder edição é pior.
    if (idx >= 0 && !pendingLocal) arr.splice(idx, 1);
  } else {
    if (!row.data || typeof row.data !== 'object') return;
    const j = stableJson(row.data);
    if (snapCol[id] === j) return; // eco do próprio envio
    snapCol[id] = j;
    if (idx >= 0 && pendingLocal) {
      // Conflito: este dispositivo editou o mesmo registro e ainda não enviou.
      // Mantém a versão local; ela será enviada no próximo sync.
      console.warn('[Realtime] Conflito em ' + c + '/' + id + ' — mantendo a edição local.');
    } else if (idx >= 0) {
      arr[idx] = row.data;
    } else {
      arr.push(row.data);
    }
  }
  saveSyncSnapshot();
  scheduleRemoteRender();
}

function applyRemoteConfig(payload) {
  const cfg = payload && payload.new && payload.new.data;
  if (!cfg || !syncSnapshot) return;
  const j = stableJson(cfg);
  if (syncSnapshot.__config === j) return;
  if (stableJson(buildConfigPayload()) !== syncSnapshot.__config) return; // config local pendente
  syncSnapshot.__config = j;
  if (cfg.columns) appColumns = alignAppColumns(cfg.columns);
  if (cfg.visibleColumns) visibleColumns = alignVisibleColumns(cfg.visibleColumns, appColumns);
  if (cfg.minimizedColumns) minimizedColumns = cfg.minimizedColumns;
  if (cfg.noteTemplates?.length) noteTemplates = cfg.noteTemplates;
  if (cfg.quickMsgs?.length) quickMsgs = cfg.quickMsgs;
  if (cfg.projectTypes?.length) projectTypes = cfg.projectTypes;
  ['waTemplate', 'companyName', 'companyDoc', 'pixKey', 'pixName', 'pixBank'].forEach(k => {
    if (cfg[k] !== undefined) localStorage.setItem('mavic_' + k, cfg[k]);
  });
  saveSyncSnapshot();
  scheduleRemoteRender();
}

let sbRealtimeSubscribed = false;
function setupSupabaseRealtime() {
  if (!sb || sbRealtimeSubscribed) return;
  try {
    sb.channel('mavic_records_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mavic_records' }, applyRemoteRecord)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mavic_store', filter: 'key=eq.config' }, applyRemoteConfig)
      .subscribe(status => { if (status === 'SUBSCRIBED') sbRealtimeSubscribed = true; });
  } catch (err) {
    console.warn('[Realtime] Falha ao configurar canal', err);
  }
}

// Exporta para testes em Node (no navegador é ignorado)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { stableJson, snapshotFromState, overlayPendingLocalChanges, computeSyncDiff, applyRemoteRecord, syncCloud, fetchCloudState };
}
