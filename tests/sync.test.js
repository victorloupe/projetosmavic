// Simula dois dispositivos usando sync.js contra um "banco" em memória.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const src = fs.readFileSync(process.argv[2], 'utf8');

// ── Banco em memória com realtime ─────────────────────────────
const db = { records: new Map(), store: new Map(), listeners: [] };
const key = (c, id) => c + '|' + id;
const clone = o => JSON.parse(JSON.stringify(o));
function emit(table, eventType, row, old) {
  db.listeners.forEach(l => l(table, eventType, clone(row || {}), clone(old || {})));
}
function makeQuery(table) {
  const q = { table, filters: [], op: 'select', rangeFrom: 0, rangeTo: 1e9 };
  const api = {
    select() { return api; },
    order() { return api; },
    range(a, b) { q.rangeFrom = a; q.rangeTo = b; return api; },
    eq(col, val) { q.filters.push(r => String(r[col]) === String(val)); return api; },
    in(col, vals) { q.filters.push(r => vals.map(String).includes(String(r[col]))); return api; },
    limit() { return api; },
    maybeSingle() { q.single = true; return api; },
    upsert(rows) { q.op = 'upsert'; q.rows = rows; return api; },
    delete() { q.op = 'delete'; return api; },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); }
  };
  function run() {
    if (table === 'mavic_records') {
      if (q.op === 'upsert') {
        q.rows.forEach(r => {
          const k = key(r.collection, r.id);
          const ev = db.records.has(k) ? 'UPDATE' : 'INSERT';
          db.records.set(k, clone({ collection: r.collection, id: r.id, data: r.data }));
          emit(table, ev, db.records.get(k));
        });
        return { error: null };
      }
      if (q.op === 'delete') {
        [...db.records.values()].filter(r => q.filters.every(f => f(r))).forEach(r => {
          db.records.delete(key(r.collection, r.id));
          emit(table, 'DELETE', null, { collection: r.collection, id: r.id });
        });
        return { error: null };
      }
      const rows = [...db.records.values()].filter(r => q.filters.every(f => f(r)));
      return { data: clone(rows.slice(q.rangeFrom, q.rangeTo + 1)), error: null };
    }
    if (table === 'mavic_store') {
      if (q.op === 'upsert') { q.rows.forEach(r => { db.store.set(r.key, clone(r)); emit(table, 'UPDATE', r); }); return { error: null }; }
      const rows = [...db.store.values()].filter(r => q.filters.every(f => f(r)));
      return { data: q.single ? (rows[0] ? clone(rows[0]) : null) : clone(rows), error: null };
    }
  }
  return api;
}

// ── Dispositivo ──────────────────────────────────────────────
function makeDevice(name) {
  const ls = new Map(), ss = new Map();
  const storage = m => ({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) });
  const ctx = {
    console: { log() {}, warn() {} },
    setTimeout: (fn) => { ctx.__timers.push(fn); return ctx.__timers.length; }, clearTimeout() {},
    __timers: [],
    localStorage: storage(ls), sessionStorage: storage(ss),
    module: undefined,
    sb: {
      from: makeQuery,
      channel() {
        const handlers = [];
        const ch = { on(_e, opts, fn) { handlers.push({ table: opts.table, fn }); return ch; }, subscribe(cb) { db.listeners.push((table, ev, n, o) => handlers.filter(h => h.table === table).forEach(h => h.fn({ eventType: ev, new: n, old: o }))); cb && cb('SUBSCRIBED'); return ch; } };
        return ch;
      }
    },
    setSync() {}, updateNavAlertBadges() {}, checkAndMigrateLegacyProducts() {}, reconcileAllProjectsFinancials() {},
    renderCurrentPage() { ctx.renders = (ctx.renders || 0) + 1; },
    alignAppColumns: c => c || [], alignVisibleColumns: v => v || [],
  };
  vm.createContext(ctx);
  vm.runInContext(`
    var projects=[], clients=[], notifications=[], globalNotices=[], budgets=[], services=[];
    var appColumns=[], visibleColumns=[], minimizedColumns=[], noteTemplates=[], quickMsgs=[], projectTypes=[], appTheme='light';
    function syncLocal(){
      localStorage.setItem('mavic_projects',JSON.stringify(projects));
      localStorage.setItem('mavic_clients',JSON.stringify(clients));
      localStorage.setItem('mavic_notifications',JSON.stringify(notifications));
      localStorage.setItem('mavic_global_notices',JSON.stringify(globalNotices));
      localStorage.setItem('mavic_budgets',JSON.stringify(budgets));
      localStorage.setItem('mavic_services',JSON.stringify(services));
    }
    function scheduleSync(){ localStorage.setItem('mavic_pending_sync','true'); syncLocal(); }
  `, ctx);
  vm.runInContext(src.replace(/\nconst /g, '\nvar ').replace(/\nlet /g, '\nvar '), ctx);
  // Equivalente ao trecho novo do loadData no common.js
  ctx.load = async () => vm.runInContext(`(async()=>{
    const state=await fetchCloudState();
    const oldSnapshot=loadSyncSnapshot();
    syncSnapshot=snapshotFromState(state.cols,state.config);
    const applied=overlayPendingLocalChanges(state.cols,oldSnapshot);
    saveSyncSnapshot();
    projects=state.cols.projects;clients=state.cols.clients;notifications=state.cols.notifications;
    globalNotices=state.cols.global_notices;budgets=state.cols.budgets;services=state.cols.services;
    syncLocal(); setupSupabaseRealtime();
    if(!applied) localStorage.removeItem('mavic_pending_sync');
    return applied;
  })()`, ctx);
  ctx.run = code => vm.runInContext(code, ctx);
  ctx.sync = () => vm.runInContext('syncCloud()', ctx);
  ctx.flushTimers = () => { const t = ctx.__timers.splice(0); t.forEach(f => f()); };
  ctx.name = name;
  return ctx;
}

process.on("unhandledRejection",e=>{console.error(e)});
const projData = id => ({ id, name: 'Projeto ' + id, client: 'Ana', column: 'Briefing', payments: [] });

(async () => {
  // Estado inicial migrado (chaves em ordem diferente, como o jsonb devolve)
  [1, 2, 3].forEach(id => db.records.set(key('projects', String(id)), { collection: 'projects', id: String(id), data: { payments: [], name: 'Projeto ' + id, id, column: 'Briefing', client: 'Ana' } }));
  db.records.set(key('clients', '10'), { collection: 'clients', id: '10', data: { id: 10, name: 'Ana', token: 'abc' } });
  db.store.set('config', { key: 'config', data: {} });

  const A = makeDevice('notebook'), B = makeDevice('celular');
  await A.load(); await B.load();
  assert.strictEqual(A.run('projects.length'), 3);

  // 1. Sem alterações → nada é enviado (ordem de chaves não gera falso "mudou")
  let writes = 0; const origUpsert = db.listeners.length;
  const countBefore = JSON.stringify([...db.records]);
  A.run('appTheme="light"');
  const diff0 = A.run('computeSyncDiff()');
  assert.strictEqual(diff0.upserts.length, 0, 'sem mudanças não deve enviar registros');
  assert.strictEqual(Object.keys(diff0.deletes).length, 0);

  // 2. Cenário do bug antigo: A edita projeto 1, B edita projeto 2 (B com dados velhos)
  A.run(`projects.find(p=>p.id===1).column='Desenvolvimento'; scheduleSync();`);
  B.run(`projects.find(p=>p.id===2).name='Renomeado no celular'; scheduleSync();`);
  await A.sync();
  // B recebeu o realtime de A antes de sincronizar
  A.flushTimers(); B.flushTimers();
  await B.sync();
  A.flushTimers(); B.flushTimers();
  const db1 = db.records.get(key('projects', '1')).data, db2 = db.records.get(key('projects', '2')).data;
  assert.strictEqual(db1.column, 'Desenvolvimento', 'edição do notebook preservada');
  assert.strictEqual(db2.name, 'Renomeado no celular', 'edição do celular preservada');
  assert.strictEqual(A.run('projects.find(p=>p.id===2).name'), 'Renomeado no celular', 'notebook recebeu via realtime');
  assert.strictEqual(B.run('projects.find(p=>p.id===1).column'), 'Desenvolvimento', 'celular recebeu via realtime');

  // 3. Exclusão em A some em B; criação em B aparece em A
  A.run(`projects=projects.filter(p=>p.id!==3); scheduleSync();`);
  await A.sync();
  assert.ok(!db.records.has(key('projects', '3')), 'projeto 3 apagado no banco');
  assert.strictEqual(B.run('projects.some(p=>p.id===3)'), false, 'projeto 3 sumiu no celular');
  B.run(`projects.push(${JSON.stringify(projData(4))}); scheduleSync();`);
  await B.sync();
  assert.strictEqual(A.run('projects.some(p=>p.id===4)'), true, 'projeto 4 apareceu no notebook');

  // 4. Celular offline: edita projeto 4, fecha o app; notebook edita projeto 1; celular reabre
  B.run(`projects.find(p=>p.id===4).name='Editado offline'; scheduleSync();`); // sem sync
  db.listeners = db.listeners.filter((_, i) => i === 0); // só o notebook continua ouvindo
  A.run(`projects.find(p=>p.id===1).name='Editado no notebook'; scheduleSync();`);
  await A.sync();
  const B2 = makeDevice('celular-reaberto');
  // mesmo localStorage do celular anterior
  ['mavic_projects', 'mavic_clients', 'mavic_notifications', 'mavic_global_notices', 'mavic_budgets', 'mavic_services', 'mavic_pending_sync', 'mavic_sync_snapshot']
    .forEach(k => { const v = B.localStorage.getItem(k); if (v !== null) B2.localStorage.setItem(k, v); });
  const applied = await B2.load();
  assert.strictEqual(applied, 1, 'uma alteração offline reaplicada');
  assert.strictEqual(B2.run('projects.find(p=>p.id===1).name'), 'Editado no notebook', 'não reverteu o notebook');
  assert.strictEqual(B2.run('projects.find(p=>p.id===4).name'), 'Editado offline', 'manteve edição offline');
  await B2.sync();
  assert.strictEqual(db.records.get(key('projects', '1')).data.name, 'Editado no notebook', 'banco mantém edição do notebook');
  assert.strictEqual(db.records.get(key('projects', '4')).data.name, 'Editado offline', 'banco recebeu edição offline');

  // 5. Proteção: lista de projetos vazia não apaga a nuvem
  B2.run('projects=[]; scheduleSync();');
  await B2.sync();
  assert.ok(db.records.size >= 4, 'nuvem intacta após lista vazia');

  // 6. Sem snapshot (nunca carregou da nuvem) → não envia nada
  const C = makeDevice('novo');
  C.run(`projects=[${JSON.stringify(projData(99))}]`);
  await C.sync();
  assert.ok(!db.records.has(key('projects', '99')), 'sem snapshot não envia');

  // 7. Conflito: A edita projeto 2 sem enviar; chega alteração remota do mesmo projeto → mantém local
  A.run(`projects.find(p=>p.id===2).name='Local pendente';`);
  const D = makeDevice('tablet'); await D.load();
  D.run(`projects.find(p=>p.id===2).column='Revisão'; scheduleSync();`);
  await D.sync();
  assert.strictEqual(A.run('projects.find(p=>p.id===2).name'), 'Local pendente', 'edição local pendente preservada');
  await A.sync();
  assert.strictEqual(db.records.get(key('projects', '2')).data.name, 'Local pendente');

  console.log('TODOS OS TESTES PASSARAM');
})().catch(e => { console.error('FALHOU:', e.stack); process.exit(1); });
