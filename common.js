// ══════════════════════════════════════════
//  GLOBAL STATE & CONFIG
// ══════════════════════════════════════════
const INIT_COLS=[
  {id:'Briefing',icon:'bi-clipboard',color:'#92623a'},
  {id:'Desenvolvimento',icon:'bi-pencil',color:'#ea580c'},
  {id:'Revisão',icon:'bi-search',color:'#2563eb'},
  {id:'Obra',icon:'bi-hammer',color:'#d97706'},
  {id:'Concluído',icon:'bi-check-circle',color:'#16a34a',isFinal:true}
];
const DEFAULT_COL_COLOR='#92623a';
const DEFAULT_COL_ICON='bi-folder';

// Observações padrão do orçamento — editável pelo usuário (Configurar > Observações Padrão).
// Esses 3 textos abaixo são só o valor inicial, pra quem já usava o sistema não perder nada.
const INIT_NOTE_TEMPLATES=[
  {id:'padrao',title:'Padrão MAVIC (50% entrada + 50% entrega, prod. a consultar)',text:`1. FORMA DE PAGAMENTO:
• 50% no ato do pedido e 50% no ato da entrega.
• Pagamento em mais vezes consultar.
TEMPO DE PRODUÇÃO:
• A consultar.
2. PRODUÇÃO:
• Os itens acima fazem parte de um orçamento ao todo, não sendo possível a execução de somente um item ou mais separadamente.
• Os Itens com * se torna opcional, porém se torna necessário realizar os anteriores.`},
  {id:'vista',title:'Pagamento à Vista (100% no pedido, 5% desconto)',text:`1. FORMA DE PAGAMENTO:
• 100% no ato do pedido (com 5% de desconto incluso).
TEMPO DE PRODUÇÃO:
• A consultar.`},
  {id:'parcelado',title:'Parcelado (40% entrada + 3x sem juros no cartão)',text:`1. FORMA DE PAGAMENTO:
• Entrada de 40% + saldo em até 3x sem juros no cartão de crédito.
TEMPO DE PRODUÇÃO:
• A consultar.`}
];
let noteTemplates=[];

// Tipos de projeto — editável (Configurações > Gerenciar Tipos de Projeto).
// Cores replicam as que já existiam fixas no CSS, pra não mudar nada visualmente
// pra quem já usava. Tipos novos ganham a cor escolhida na hora de cadastrar.
const INIT_PROJECT_TYPES=[
  {id:'Residencial',color:'#2563eb'},
  {id:'Comercial',color:'#7c3aed'},
  {id:'Estrutural',color:'#d97706'},
  {id:'Urbanismo',color:'#0d9488'},
  {id:'Outro',color:'#71717a'}
];
let projectTypes=[];
function typeColor(typeId){
  const t=(typeof projectTypes!=='undefined'&&projectTypes.length?projectTypes:INIT_PROJECT_TYPES).find(x=>x.id===typeId);
  return t?t.color:'#71717a';
}
function hexToRgba(hex,alpha){
  const h=(hex||'#71717a').replace('#','');
  const full=h.length===3?h.split('').map(c=>c+c).join(''):h;
  const r=parseInt(full.slice(0,2),16)||113,g=parseInt(full.slice(2,4),16)||113,b=parseInt(full.slice(4,6),16)||113;
  return `rgba(${r},${g},${b},${alpha})`;
}
function typeBg(typeId){ return hexToRgba(typeColor(typeId),0.13); }
function populateProjectTypeSelects(){
  const opts=(projectTypes.length?projectTypes:INIT_PROJECT_TYPES).map(t=>`<option value="${t.id}">${t.id}</option>`).join('');
  document.querySelectorAll('.project-type-select').forEach(sel=>{
    const cur=sel.value;
    const hasEmpty=sel.querySelector('option[value=""]');
    sel.innerHTML=(hasEmpty?hasEmpty.outerHTML:'')+opts;
    if(cur) sel.value=cur;
  });
}

// ══════════════════════════════════════════
//  LAZY LOADER: HTML2PDF (Carrega sob demanda)
// ══════════════════════════════════════════
function loadHtml2Pdf() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="html2pdf"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.html2pdf));
      existing.addEventListener('error', () => reject(new Error('Erro ao carregar motor de PDF')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    script.onload = () => resolve(window.html2pdf);
    script.onerror = () => reject(new Error('Não foi possível carregar o motor de PDF. Verifique a conexão com a internet.'));
    document.head.appendChild(script);
  });
}

// Uma coluna conta como "concluída" se estiver marcada com isFinal.
// Compatibilidade: configs salvas antes desse campo existir caem no nome
// literal "Concluído", pra não quebrar dados já sincronizados.
// Isso só afeta contadores de relatório e o badge de prioridade — o projeto
// ainda aparece normalmente pro cliente (ex: pode estar concluído mas não
// aprovado/pago ainda).
function isFinalColumn(colId){
  const col=(typeof appColumns!=='undefined'?appColumns:INIT_COLS).find(c=>c.id===colId);
  if(!col) return colId==='Concluído';
  return col.isFinal===true || (col.isFinal===undefined && col.id==='Concluído');
}

// Coluna "encerrada": o projeto já foi entregue/pago e não precisa mais
// aparecer pro cliente. É um conceito diferente de isFinal (que é só pra
// relatórios) — marcado com hideClient, com fallback pro nome "Finalizado".
// Também dispara o cartão compacto no quadro (estilo "Arquivados").
function isHiddenColumn(colId){
  const col=(typeof appColumns!=='undefined'?appColumns:INIT_COLS).find(c=>c.id===colId);
  if(!col) return colId==='Finalizado';
  return col.hideClient===true || (col.hideClient===undefined && col.id==='Finalizado');
}

// ══════════════════════════════════════════
//  MÁSCARA DE CPF/CNPJ
// ══════════════════════════════════════════
// Detecta automaticamente CPF (11 dígitos, 000.000.000-00) ou CNPJ (14 dígitos, 00.000.000/0000-00)
function formatDocMask(v){
  if(!v) return '';
  let d=String(v).replace(/\D/g,'').slice(0,14);
  if(!d) return v;
  if(d.length<=11){
    d=d.replace(/(\d{3})(\d)/,'$1.$2');
    d=d.replace(/(\d{3})(\d)/,'$1.$2');
    d=d.replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  }else{
    d=d.replace(/(\d{2})(\d)/,'$1.$2');
    d=d.replace(/(\d{3})(\d)/,'$1.$2');
    d=d.replace(/(\d{3})(\d)/,'$1/$2');
    d=d.replace(/(\d{4})(\d{1,2})$/,'$1-$2');
  }
  return d;
}
function maskDocInput(el){ el.value=formatDocMask(el.value); }

function formatPhoneMask(v) {
  if (!v) return '';
  const d = String(v).replace(/\D/g, '');
  if (d.length > 11) return d.substring(0, 11).replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  } else {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  }
}
function maskPhoneInput(el){ if(el) el.value = formatPhoneMask(el.value); }

function insertWaVar(varTag) {
  const ta = document.getElementById('waTemplate');
  if (!ta) return;
  const start = ta.selectionStart || 0;
  const end = ta.selectionEnd || 0;
  const val = ta.value;
  ta.value = val.substring(0, start) + varTag + val.substring(end);
  ta.selectionStart = ta.selectionEnd = start + varTag.length;
  ta.focus();
}

function formatWaMsgText(symbol) {
  const ta = document.getElementById('waMsg');
  if (!ta) return;
  const start = ta.selectionStart || 0;
  const end = ta.selectionEnd || 0;
  const selected = ta.value.substring(start, end);
  if (selected) {
    const replacement = `${symbol}${selected}${symbol}`;
    ta.value = ta.value.substring(0, start) + replacement + ta.value.substring(end);
    ta.selectionStart = start;
    ta.selectionEnd = start + replacement.length;
  } else {
    const replacement = `${symbol}texto${symbol}`;
    ta.value = ta.value.substring(0, start) + replacement + ta.value.substring(end);
    ta.selectionStart = start + 1;
    ta.selectionEnd = start + 6;
  }
  ta.focus();
}

// Validação de dígito verificador (algoritmo padrão mod11). Campo vazio não é erro —
// o CPF/CNPJ é opcional em vários formulários daqui.
function isValidCPF(v){
  const d=String(v).replace(/\D/g,'');
  if(d.length!==11||/^(\d)\1{10}$/.test(d)) return false;
  let sum=0; for(let i=0;i<9;i++) sum+=parseInt(d[i])*(10-i);
  let r=(sum*10)%11; if(r===10) r=0;
  if(r!==parseInt(d[9])) return false;
  sum=0; for(let i=0;i<10;i++) sum+=parseInt(d[i])*(11-i);
  r=(sum*10)%11; if(r===10) r=0;
  return r===parseInt(d[10]);
}
function isValidCNPJ(v){
  const d=String(v).replace(/\D/g,'');
  if(d.length!==14||/^(\d)\1{13}$/.test(d)) return false;
  const calc=base=>{
    const w=base.length===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2];
    let sum=0; for(let i=0;i<base.length;i++) sum+=parseInt(base[i])*w[i];
    const r=sum%11; return r<2?0:11-r;
  };
  if(calc(d.slice(0,12))!==parseInt(d[12])) return false;
  return calc(d.slice(0,13))===parseInt(d[13]);
}
function isValidDoc(v){
  const d=String(v||'').replace(/\D/g,'');
  if(!d) return true;
  if(d.length===11) return isValidCPF(d);
  if(d.length===14) return isValidCNPJ(d);
  return false;
}
function checkDocValidity(el){
  const v=el.value.trim();
  if(!v||isValidDoc(v)){ el.classList.remove('inp-invalid'); return; }
  el.classList.add('inp-invalid');
  showToast('CPF/CNPJ parece inválido — confira os números digitados.','info');
}
const COL_ICONS=[
  {v:'bi-clipboard',l:'Clipboard'},{v:'bi-pencil',l:'Lápis'},{v:'bi-search',l:'Lupa'},{v:'bi-hammer',l:'Martelo'},
  {v:'bi-check-circle',l:'Check'},{v:'bi-flag',l:'Bandeira'},{v:'bi-folder',l:'Pasta'},{v:'bi-chat-dots',l:'Chat'},
  {v:'bi-star',l:'Estrela'},{v:'bi-bookmark',l:'Marcador'},{v:'bi-lightning',l:'Urgente'},{v:'bi-send',l:'Envio'}
];
// Mensagens rápidas do aviso ao cliente — editável (Board > Avisar cliente > engrenagem).
// Esses 6 textos são só o valor inicial, pra quem já usava não perder nada.
const INIT_QUICK_MSGS=[
  { title: "Andamento do Projeto", msg: "Projeto em andamento! Em breve temos novidades." },
  { title: "Aprovação Necessária", msg: "Precisamos de sua aprovação para avançar." },
  { title: "Documentos Pendentes", msg: "Documentos pendentes — por favor entre em contato." },
  { title: "Etapa Concluída", msg: "Etapa concluída com sucesso! ✅" },
  { title: "Pagamento Confirmado", msg: "Pagamento confirmado. Obrigado!" },
  { title: "Prazo Atualizado", msg: "Prazo atualizado. Verifique as datas no painel." }
];
let quickMsgs=[];
const DEFAULT_WA_TEMPLATE = `Olá, *{Cliente}*!

*{Projeto}*

*Etapa:* {Etapa}
*Prazo:* {Prazo}
*Valor contratado:* {ValorTotal}
*Pago:* {ValorPago} | *Pendente:* {SaldoPendente}
{TarefaAtual}
{Observacao}

_Equipe MAVIC Projetos_`;

if (localStorage.getItem('mavic_waTemplate') === null) {
  localStorage.setItem('mavic_waTemplate', DEFAULT_WA_TEMPLATE);
}

let sb=null, projects=[], clients=[], appColumns=[...INIT_COLS], budgets=[];
let globalNotices=[];
let visibleColumns=INIT_COLS.map(c=>c.id), minimizedColumns=[], colSorts={};
let notifications=[], appTheme='light', currentView='board';
let tempSubs=[], tempPayments=[], tempProds=[];
let tempOrcItems=[];
let pinnedCards=new Set(), expandedFin=new Set();
let openGnIds = new Set();
let isDragging=false, currentCliId=null, notifyProjId=null;
let syncTimer=null;
window.CLIENT_PANEL_URL=localStorage.getItem('mavic_clientUrl')||'cliente.html';
// Compartilhado por todas as páginas que geram/copiam o link do cliente
// (Board, Clientes, etc.) — antes só existia em clientes.js, quebrando
// os botões de WhatsApp/compartilhar em páginas que não carregam esse arquivo.
function genTokenStr(){return Math.random().toString(36).substring(2,10)+Math.random().toString(36).substring(2,6);}
function buildLink(name,token){return `${window.CLIENT_PANEL_URL}?nome=${encodeURIComponent(name)}&token=${token}`;}
if(localStorage.getItem('mavic_pixKey')===null){
  localStorage.setItem('mavic_pixKey','350.605.018-41');
  localStorage.setItem('mavic_pixName','Victor Lourenço Pereira');
  localStorage.setItem('mavic_pixBank','Nu Pagamentos');
}

// Determine active view based on filename
const currentPath = window.location.pathname;
if (currentPath.includes('dashboard.html')) {
  currentView = 'dashboard';
} else if (currentPath.includes('orcamento.html')) {
  currentView = 'orcamentos';
} else if (currentPath.includes('pagamentos.html')) {
  currentView = 'pagamentos';
} else if (currentPath.includes('relatorio.html')) {
  currentView = 'relatorios';
} else if (currentPath.includes('clientes.html')) {
  currentView = 'clientes';
} else {
  currentView = 'board';
}

// ══════════════════════════════════════════
//  ADMIN AUTHENTICATION & ACCESS GUARD
// ══════════════════════════════════════════
function getAdminSession() {
  try {
    const raw = localStorage.getItem('mavic_admin_session') || sessionStorage.getItem('mavic_admin_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || !session.expiresAt || session.expiresAt <= Date.now()) {
      localStorage.removeItem('mavic_admin_session');
      sessionStorage.removeItem('mavic_admin_session');
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}

function isAdminLoggedIn() {
  return getAdminSession() !== null;
}

function requireAdminAuth() {
  // Ignora página do cliente e página de login
  if (window.location.pathname.includes('cliente.html') || window.location.pathname.includes('login.html')) {
    return true;
  }
  if (!isAdminLoggedIn()) {
    const file = window.location.pathname.split('/').pop() || 'index.html';
    const query = window.location.search || '';
    const dest = file + query;
    window.location.replace('login.html?redirect=' + encodeURIComponent(dest));
    return false;
  }
  return true;
}

// Executa verificação imediata para telas administrativas
requireAdminAuth();

async function logoutAdmin() {
  showConfirm('Deseja realmente sair do painel administrativo?', async () => {
    if (sb && sb.auth) {
      try { await sb.auth.signOut(); } catch(e){}
    }
    localStorage.removeItem('mavic_admin_session');
    sessionStorage.removeItem('mavic_admin_session');
    showToast('Sessão encerrada', 'info');
    setTimeout(() => {
      window.location.replace('login.html');
    }, 250);
  }, { title: 'Encerrar Sessão', okText: 'Sair do Painel', danger: true });
}

// ══════════════════════════════════════════
//  SUPABASE CONNECTION & CACHE
// ══════════════════════════════════════════
function initSupabase(){
  const url=SB_URL,key=SB_KEY;
  if(url&&key){sb=window.supabase.createClient(url,key);return true;}
  return false;
}

async function loadData(){
  let hasSb=false;
  try{hasSb=initSupabase();}catch(e){console.warn('initSupabase falhou',e);hasSb=false;}
  
  // Offline-first: if local storage has pending changes, load them and sync to cloud
  const pendingSync = localStorage.getItem('mavic_pending_sync') === 'true';
  if (pendingSync) {
    loadLocal();
    if (hasSb) {
      syncCloud(); // trigger cloud sync in background
    }
    return;
  }
  
  if(!hasSb){loadLocal();return;}
  try{
    const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),8000));
    const query=sb.from('mavic_store').select('key,data');
    const{data,error}=await Promise.race([query,timeout]);
    if(error)throw error;
    const map={};(data||[]).forEach(r=>map[r.key]=r.data);
    projects=map.projects||[];clients=map.clients||[];notifications=map.notifications||[];
    globalNotices=map.global_notices||(map.global_notice?[map.global_notice]:[]);
    budgets=map.budgets||[];
    const cfg=map.config||{};
    appColumns=cfg.columns?.length?cfg.columns:INIT_COLS;
    visibleColumns=cfg.visibleColumns||appColumns.map(c=>c.id);
    minimizedColumns=cfg.minimizedColumns||[];
    noteTemplates=cfg.noteTemplates?.length?cfg.noteTemplates:INIT_NOTE_TEMPLATES;
    quickMsgs=cfg.quickMsgs?.length?cfg.quickMsgs:INIT_QUICK_MSGS;
    projectTypes=cfg.projectTypes?.length?cfg.projectTypes:INIT_PROJECT_TYPES;
    appTheme=cfg.theme||localStorage.getItem('mavic_theme')||'light';
    if(cfg.waTemplate!==undefined) localStorage.setItem('mavic_waTemplate',cfg.waTemplate);
    if(cfg.companyName!==undefined) localStorage.setItem('mavic_companyName',cfg.companyName);
    if(cfg.companyDoc!==undefined) localStorage.setItem('mavic_companyDoc',cfg.companyDoc);
    if(cfg.pixKey!==undefined) localStorage.setItem('mavic_pixKey',cfg.pixKey);
    if(cfg.pixName!==undefined) localStorage.setItem('mavic_pixName',cfg.pixName);
    if(cfg.pixBank!==undefined) localStorage.setItem('mavic_pixBank',cfg.pixBank);
    applyTheme(appTheme);syncLocal();
  }catch(e){console.warn('Supabase load failed',e);loadLocal();showToast('Modo offline — dados locais','warning');}
}

function loadLocal(){
  projects=JSON.parse(localStorage.getItem('mavic_projects')||'[]');
  clients=JSON.parse(localStorage.getItem('mavic_clients')||'[]');
  notifications=JSON.parse(localStorage.getItem('mavic_notifications')||'[]');
  globalNotices=JSON.parse(localStorage.getItem('mavic_global_notices')||'[]');
  budgets=JSON.parse(localStorage.getItem('mavic_budgets')||'[]');
  const cfg=JSON.parse(localStorage.getItem('mavic_config')||'{}');
  appColumns=cfg.columns?.length?cfg.columns:INIT_COLS;
  visibleColumns=cfg.visibleColumns||appColumns.map(c=>c.id);
  minimizedColumns=cfg.minimizedColumns||[];
  noteTemplates=cfg.noteTemplates?.length?cfg.noteTemplates:INIT_NOTE_TEMPLATES;
  quickMsgs=cfg.quickMsgs?.length?cfg.quickMsgs:INIT_QUICK_MSGS;
  projectTypes=cfg.projectTypes?.length?cfg.projectTypes:INIT_PROJECT_TYPES;
  if(cfg.waTemplate!==undefined) localStorage.setItem('mavic_waTemplate',cfg.waTemplate);
  if(cfg.companyName!==undefined) localStorage.setItem('mavic_companyName',cfg.companyName);
  if(cfg.companyDoc!==undefined) localStorage.setItem('mavic_companyDoc',cfg.companyDoc);
  if(cfg.pixKey!==undefined) localStorage.setItem('mavic_pixKey',cfg.pixKey);
  if(cfg.pixName!==undefined) localStorage.setItem('mavic_pixName',cfg.pixName);
  if(cfg.pixBank!==undefined) localStorage.setItem('mavic_pixBank',cfg.pixBank);
  applyTheme(localStorage.getItem('mavic_theme')||'light');
}

function syncLocal(){
  localStorage.setItem('mavic_projects',JSON.stringify(projects));
  localStorage.setItem('mavic_clients',JSON.stringify(clients));
  localStorage.setItem('mavic_notifications',JSON.stringify(notifications));
  localStorage.setItem('mavic_global_notices',JSON.stringify(globalNotices));
  localStorage.setItem('mavic_budgets',JSON.stringify(budgets));
  localStorage.setItem('mavic_config',JSON.stringify({
    columns:appColumns,
    visibleColumns,
    minimizedColumns,
    noteTemplates,
    quickMsgs,
    projectTypes,
    waTemplate:localStorage.getItem('mavic_waTemplate')||'',
    companyName:localStorage.getItem('mavic_companyName')||'',
    companyDoc:localStorage.getItem('mavic_companyDoc')||'',
    pixKey:localStorage.getItem('mavic_pixKey')||'',
    pixName:localStorage.getItem('mavic_pixName')||'',
    pixBank:localStorage.getItem('mavic_pixBank')||''
  }));
  localStorage.setItem('mavic_theme',appTheme);
}

function scheduleSync(){
  localStorage.setItem('mavic_pending_sync', 'true');
  syncLocal();
  clearTimeout(syncTimer);
  syncTimer=setTimeout(syncCloud,900);
}

async function syncCloud(){
  if(!sb){setSync('off');return;}
  setSync('sync');
  try{
    await sb.from('mavic_store').upsert([
      {key:'projects',data:projects},{key:'clients',data:clients},
      {key:'notifications',data:notifications},
      {key:'global_notices',data:globalNotices},
      {key:'budgets',data:budgets},
      {key:'config',data:{
        columns:appColumns,
        visibleColumns,
        minimizedColumns,
        noteTemplates,
        quickMsgs,
        projectTypes,
        theme:appTheme,
        waTemplate:localStorage.getItem('mavic_waTemplate')||'',
        companyName:localStorage.getItem('mavic_companyName')||'',
        companyDoc:localStorage.getItem('mavic_companyDoc')||'',
        pixKey:localStorage.getItem('mavic_pixKey')||'',
        pixName:localStorage.getItem('mavic_pixName')||'',
        pixBank:localStorage.getItem('mavic_pixBank')||''
      }}
    ],{onConflict:'key'});
    localStorage.removeItem('mavic_pending_sync');
    setSync('ok');
  }catch(e){setSync('off');}
}

function setSync(s){
  const el=document.getElementById('syncStatus');
  if(!el) return;
  if(s==='ok'){el.className='nav-sync ok';el.innerHTML='<i class="bi bi-cloud-check"></i> Sincronizado';}
  else if(s==='sync'){el.className='nav-sync sync';el.innerHTML='<i class="bi bi-arrow-repeat"></i> Sincronizando…';}
  else{el.className='nav-sync off';el.innerHTML='<i class="bi bi-cloud-slash"></i> Offline';}
}

// ══════════════════════════════════════════
//  THEME MANAGEMENT
// ══════════════════════════════════════════
function toggleTheme(){appTheme=appTheme==='light'?'dark':'light';applyTheme(appTheme);scheduleSync();}
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  appTheme=t;
  const btn=document.getElementById('themeBtn');
  const logo=document.getElementById('navLogo');
  if (btn) {
    if(t==='dark'){btn.innerHTML='<i class="bi bi-sun" style="color:#fbbf24"></i>';if(logo)logo.src='https://i.postimg.cc/vZmmNLjj/LOGO-NOVA-black.png';}
    else{btn.innerHTML='<i class="bi bi-moon-stars"></i>';if(logo)logo.src='LOGO NOVA.png';}
  }
}

// ══════════════════════════════════════════
//  TOAST & GENERAL HELPERS
// ══════════════════════════════════════════
function showToast(msg,type='success'){
  const wrap=document.getElementById('toastWrap');
  if(!wrap) return;
  const ic={success:'bi-check-circle',warning:'bi-exclamation-circle',error:'bi-x-circle',info:'bi-info-circle'};
  const cl={success:'var(--green)',warning:'var(--yellow)',error:'var(--red)',info:'var(--blue)'};
  const t=document.createElement('div');t.className='toast';
  t.style.cursor = 'pointer';
  t.style.position = 'relative';
  t.style.overflow = 'hidden';
  t.innerHTML=`<i class="bi ${ic[type]||ic.success}" style="color:${cl[type]||cl.success}"></i>
               <span>${msg}</span>
               <div class="toast-progress" style="position:absolute;bottom:0;left:0;height:3px;background:${cl[type]||cl.success};width:100%;transition:width 2.8s linear;"></div>`;
  
  let timer = setTimeout(()=>{
    t.classList.remove('show');
    setTimeout(()=>t.remove(),400);
  }, 2800);

  t.onclick=()=>{
    clearTimeout(timer);
    t.classList.remove('show');
    setTimeout(()=>t.remove(),400);
  };

  t.onmouseenter=()=>{
    clearTimeout(timer);
    const prog = t.querySelector('.toast-progress');
    if (prog) {
      const curWidth = prog.getBoundingClientRect().width;
      prog.style.transition = 'none';
      prog.style.width = curWidth + 'px';
    }
  };

  t.onmouseleave=()=>{
    const prog = t.querySelector('.toast-progress');
    if (prog) {
      prog.style.transition = 'width 2.8s linear';
      prog.style.width = '0%';
    }
    timer = setTimeout(()=>{
      t.classList.remove('show');
      setTimeout(()=>t.remove(),400);
    }, 2800);
  };

  wrap.appendChild(t);
  t.offsetHeight; 
  
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    t.classList.add('show');
    const prog = t.querySelector('.toast-progress');
    if (prog) {
      prog.style.width = '0%';
    }
  }));
}

// ══════════════════════════════════════════
//  CONFIRM MODAL (substitui o confirm() nativo do navegador)
// ══════════════════════════════════════════
// Injeta o modal uma única vez, no padrão visual do sistema (.overlay/.mbox),
// pra nenhuma página precisar duplicar esse HTML.
(function injectConfirmModal(){
  if(document.getElementById('confirmOverlay')) return;
  const wrap=document.createElement('div');
  wrap.innerHTML=`<div class="overlay" id="confirmOverlay" onclick="if(event.target===this)closeConfirm()">
    <div class="mbox msm">
      <div class="mhdr"><h5 id="confirmTitle" style="color:var(--accent)"><i class="bi bi-question-circle"></i> Confirmar ação</h5></div>
      <div class="mbody"><p id="confirmMsg" style="font-size:14px;color:var(--text2);line-height:1.5;margin:0"></p></div>
      <div class="mftr"><button class="btn btn-ghost" onclick="closeConfirm()">Cancelar</button><button class="btn btn-danger" id="confirmBtnOk">Confirmar</button></div>
    </div>
  </div>`;
  document.body.appendChild(wrap.firstElementChild);
})();

let _confirmCallback=null;
function showConfirm(message,onConfirm,opts={}){
  const overlay=document.getElementById('confirmOverlay');
  if(!overlay){ onConfirm(); return; } // fallback de segurança, nunca deve cair aqui
  document.getElementById('confirmTitle').innerHTML=`<i class="bi bi-question-circle"></i> ${opts.title||'Confirmar ação'}`;
  document.getElementById('confirmMsg').textContent=message;
  const btn=document.getElementById('confirmBtnOk');
  btn.textContent=opts.okText||'Confirmar';
  btn.className=opts.danger===false?'btn btn-primary':'btn btn-danger';
  _confirmCallback=onConfirm;
  overlay.classList.add('open');
}
function closeConfirm(){
  document.getElementById('confirmOverlay')?.classList.remove('open');
  _confirmCallback=null;
}
document.addEventListener('click',(e)=>{
  if(e.target && e.target.id==='confirmBtnOk'){
    const cb=_confirmCallback;
    closeConfirm();
    if(cb) cb();
  }
});

// ══════════════════════════════════════════
//  GERENCIAR TIPOS DE PROJETO
// ══════════════════════════════════════════
// Injetado uma vez, disponível em qualquer página admin — sem precisar
// duplicar esse HTML nos 6 arquivos.
(function injectTypesModal(){
  if(document.getElementById('typesOverlay')) return;
  if(!document.querySelector('.nav')) return; // só nas páginas admin
  const wrap=document.createElement('div');
  wrap.innerHTML=`<div class="overlay" id="typesOverlay" onclick="if(event.target===this)closeManageProjectTypesModal()">
    <div class="mbox mmd">
      <div class="mhdr"><h5 style="color:var(--accent)"><i class="bi bi-tags"></i> Tipos de Projeto</h5><button class="btn-icon btn-sm" onclick="closeManageProjectTypesModal()"><i class="bi bi-x-lg"></i></button></div>
      <div class="mbody">
        <div style="display:flex;flex-direction:column;gap:8px" id="typesManagerList"></div>
        <button class="btn btn-ghost btn-sm mt-3" onclick="addTypeInput()"><i class="bi bi-plus-lg"></i> Novo Tipo</button>
      </div>
      <div class="mftr">
        <button class="btn btn-ghost" onclick="closeManageProjectTypesModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveProjectTypes()"><i class="bi bi-check2"></i> Salvar Alterações</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(wrap.firstElementChild);
})();
function openManageProjectTypesModal(){
  const list=document.getElementById('typesManagerList');
  if(!list) return;
  list.innerHTML=(projectTypes.length?projectTypes:INIT_PROJECT_TYPES).map(t=>`<div class="cm-row" data-orig="${t.id}"><input type="color" class="cm-color" value="${t.color}" title="Cor do tipo"><input class="inp inp-sm" value="${t.id}" style="flex:1"><button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><i class="bi bi-trash3"></i></button></div>`).join('');
  document.getElementById('typesOverlay').classList.add('open');
}
function closeManageProjectTypesModal(){document.getElementById('typesOverlay').classList.remove('open');}
function addTypeInput(){
  document.getElementById('typesManagerList').innerHTML+=`<div class="cm-row" data-orig=""><input type="color" class="cm-color" value="${DEFAULT_COL_COLOR}" title="Cor do tipo"><input class="inp inp-sm" placeholder="Nome do tipo" style="flex:1"><button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><i class="bi bi-trash3"></i></button></div>`;
}
function saveProjectTypes(){
  const rows=document.querySelectorAll('#typesManagerList .cm-row'),newTypes=[],map={};
  rows.forEach(r=>{
    const orig=r.dataset.orig,color=r.querySelector('input[type=color]').value,name=r.querySelector('input:not([type=color])').value.trim();
    if(name){newTypes.push({id:name,color});if(orig&&orig!==name)map[orig]=name;}
  });
  if(!newTypes.length) return showToast('Ao menos um tipo!','warning');
  projects.forEach(p=>{if(map[p.type])p.type=map[p.type];});
  budgets.forEach(b=>{if(map[b.projectType])b.projectType=map[b.projectType];});
  projectTypes=newTypes;
  scheduleSync();
  renderCurrentPage();
  closeManageProjectTypesModal();
  showToast('Tipos de projeto atualizados!','success');
}

// ══════════════════════════════════════════
//  BARRA DE NAVEGAÇÃO INFERIOR (MOBILE)
// ══════════════════════════════════════════
// No mobile o .nav-tabs desktop some (sem espaço), e sem isso não havia
// como trocar de página a não ser voltando pro navegador. Substitui por
// uma barra fixa no rodapé com o item ativo "flutuando" — nas cores do
// sistema (var(--accent) etc.), não no arco-íris do componente original.
const MOBILE_TABS=[
  {href:'index.html',       icon:'bi-kanban',                    label:'Board',       match:['','index.html']},
  {href:'dashboard.html',   icon:'bi-speedometer2',               label:'Dashboard',   match:['dashboard.html']},
  {href:'orcamento.html',   icon:'bi-file-earmark-spreadsheet',   label:'Orçamentos',  match:['orcamento.html']},
  {href:'pagamentos.html',  icon:'bi-credit-card',                label:'Pagamentos',  match:['pagamentos.html']},
  {href:'relatorio.html',   icon:'bi-graph-up-arrow',             label:'Relatórios',  match:['relatorio.html']},
  {href:'clientes.html',    icon:'bi-people',                     label:'Clientes',    match:['clientes.html']},
];
(function injectMobileTabBar(){
  if(document.getElementById('mtabBar')) return;
  if(!document.querySelector('.nav')) return; // só nas páginas admin
  const current=location.pathname.split('/').pop();
  const wrap=document.createElement('div');
  wrap.innerHTML=`<nav class="mtab-bar" id="mtabBar">${MOBILE_TABS.map(t=>{
    const active=t.match.includes(current);
    return `<a class="mtab-item${active?' active':''}" href="${t.href}" title="${t.label}" aria-label="${t.label}">
      <span class="mtab-bubble"><i class="bi ${t.icon}"></i></span>
    </a>`;
  }).join('')}</nav>`;
  document.body.appendChild(wrap.firstElementChild);
})();

// ══════════════════════════════════════════
//  PAGINAÇÃO (listas longas — orçamentos, pagamentos, clientes)
// ══════════════════════════════════════════
const PAGE_SIZES=[5,10,20,50,100];
const _pgState={};

function pgState(key,defaultSize=20){
  if(!_pgState[key]){
    const saved=localStorage.getItem('mavic_pp_'+key);
    // Tela menor (mobile) começa com menos itens por página, se o usuário nunca escolheu um valor.
    const isMobile=window.matchMedia && window.matchMedia('(max-width:768px)').matches;
    const fallback=isMobile?5:defaultSize;
    const perPage=saved==='all'?Infinity:(parseInt(saved)||fallback);
    _pgState[key]={page:1,perPage};
  }
  return _pgState[key];
}

// Recorta o array já filtrado/ordenado pra página atual. Chame depois de aplicar filtros.
function pgSlice(arr,key){
  const st=pgState(key);
  if(!isFinite(st.perPage)) return arr;
  const totalPages=Math.max(1,Math.ceil(arr.length/st.perPage));
  if(st.page>totalPages) st.page=totalPages;
  const start=(st.page-1)*st.perPage;
  return arr.slice(start,start+st.perPage);
}

// Reseta pra página 1 — chame nos filtros/busca pra não ficar "presa" numa página vazia.
function pgReset(key){
  if(_pgState[key]) _pgState[key].page=1;
}

function pgBarHtml(key,totalItems,renderFnName,opts={}){
  const st=pgState(key);
  const perPage=isFinite(st.perPage)?st.perPage:(totalItems||1);
  const totalPages=Math.max(1,Math.ceil(totalItems/perPage));
  if(st.page>totalPages) st.page=totalPages;
  const from=totalItems===0?0:(st.page-1)*perPage+1;
  const to=Math.min(st.page*perPage,totalItems);
  const sizePicker=opts.hideSize?'':`<div class="pg-size" title="Itens por página">
      <i class="bi bi-list-ol"></i>
      <select class="inp inp-sm" onchange="pgSetSize('${key}',this.value,'${renderFnName}')">
        ${PAGE_SIZES.map(n=>`<option value="${n}" ${st.perPage===n?'selected':''}>${n}</option>`).join('')}
        <option value="all" ${!isFinite(st.perPage)?'selected':''}>Todos</option>
      </select>
    </div>`;
  return `<div class="pg-bar${opts.compact?' pg-bar-compact':''}">
    <div class="pg-info">${totalItems===0?'Nenhum item':`${from}–${to} de ${totalItems}`}</div>
    <div class="pg-controls">
      <button class="btn-icon btn-sm" ${st.page<=1?'disabled':''} onclick="pgGo('${key}',1,'${renderFnName}')" title="Primeira página"><i class="bi bi-chevron-bar-left"></i></button>
      <button class="btn-icon btn-sm" ${st.page<=1?'disabled':''} onclick="pgGo('${key}',${st.page-1},'${renderFnName}')" title="Anterior"><i class="bi bi-chevron-left"></i></button>
      <span class="pg-page">${st.page} / ${totalPages}</span>
      <button class="btn-icon btn-sm" ${st.page>=totalPages?'disabled':''} onclick="pgGo('${key}',${st.page+1},'${renderFnName}')" title="Próxima"><i class="bi bi-chevron-right"></i></button>
      <button class="btn-icon btn-sm" ${st.page>=totalPages?'disabled':''} onclick="pgGo('${key}',${totalPages},'${renderFnName}')" title="Última página"><i class="bi bi-chevron-bar-right"></i></button>
    </div>
    ${sizePicker}
  </div>`;
}

function pgGo(key,page,renderFnName){
  pgState(key).page=Math.max(1,page);
  if(typeof window[renderFnName]==='function') window[renderFnName]();
}
function pgSetSize(key,value,renderFnName){
  const st=pgState(key);
  st.perPage=value==='all'?Infinity:parseInt(value);
  st.page=1;
  localStorage.setItem('mavic_pp_'+key,value);
  if(typeof window[renderFnName]==='function') window[renderFnName]();
}

function fmt(v){return parseFloat(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function today(){return new Date().toISOString().split('T')[0];}
function formatPhone(phone){
  const d=(phone||'').replace(/\D/g,'');
  if(d.length===11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if(d.length===10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return phone||'';
}
const AVATAR_COLORS=['#e07b54','#5b8dd9','#8b5cf6','#059669','#d97706','#db2777','#0891b2','#65a30d','#dc2626','#7c3aed'];
function getClientColor(name){let h=0;for(let i=0;i<name.length;i++)h=name.charCodeAt(i)+((h<<5)-h);return AVATAR_COLORS[Math.abs(h)%AVATAR_COLORS.length];}
function getInitials(name){return(name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();}

// ══════════════════════════════════════════
//  SETTINGS MODAL (GLOBAL)
// ══════════════════════════════════════════
function openSettings(){
  if(!document.getElementById('settingsOverlay')) return;
  const sess = getAdminSession();
  const emailEl = document.getElementById('stAdminEmail');
  if (emailEl) emailEl.textContent = sess?.email || 'projetos.mavic@hotmail.com';
  document.getElementById('clientUrl').value=localStorage.getItem('mavic_clientUrl')||'cliente.html';
  document.getElementById('pixKey').value=localStorage.getItem('mavic_pixKey')||'';
  document.getElementById('pixName').value=localStorage.getItem('mavic_pixName')||'';
  document.getElementById('pixBank').value=localStorage.getItem('mavic_pixBank')||'';
  document.getElementById('waTemplate').value=localStorage.getItem('mavic_waTemplate')||'';
  document.getElementById('companyName').value=localStorage.getItem('mavic_companyName')||'';
  document.getElementById('companyDoc').value=formatDocMask(localStorage.getItem('mavic_companyDoc')||'');
  document.getElementById('companyDoc').classList.remove('inp-invalid');
  document.getElementById('companyEmail').value=localStorage.getItem('mavic_companyEmail')||'';
  document.getElementById('companyInsta').value=localStorage.getItem('mavic_companyInsta')||'';
  document.getElementById('stProjCnt').textContent=projects.length;
  document.getElementById('stCliCnt').textContent=clients.length;
  document.getElementById('settingsOverlay').classList.add('open');
}
function hasSettingsChanges() {
  const clientUrl = document.getElementById('clientUrl')?.value.trim() || 'cliente.html';
  const pixKey = document.getElementById('pixKey')?.value.trim() || '';
  const pixName = document.getElementById('pixName')?.value.trim() || '';
  const pixBank = document.getElementById('pixBank')?.value.trim() || '';
  const waTemplate = document.getElementById('waTemplate')?.value.trim() || '';
  const companyName = document.getElementById('companyName')?.value.trim() || '';
  const companyDoc = document.getElementById('companyDoc')?.value.trim() || '';
  const companyEmail = document.getElementById('companyEmail')?.value.trim() || '';
  const companyInsta = document.getElementById('companyInsta')?.value.trim() || '';

  return clientUrl !== (localStorage.getItem('mavic_clientUrl') || 'cliente.html') ||
         pixKey !== (localStorage.getItem('mavic_pixKey') || '') ||
         pixName !== (localStorage.getItem('mavic_pixName') || '') ||
         pixBank !== (localStorage.getItem('mavic_pixBank') || '') ||
         waTemplate !== (localStorage.getItem('mavic_waTemplate') || '') ||
         companyName !== (localStorage.getItem('mavic_companyName') || '') ||
         companyDoc !== (localStorage.getItem('mavic_companyDoc') || '') ||
         companyEmail !== (localStorage.getItem('mavic_companyEmail') || '') ||
         companyInsta !== (localStorage.getItem('mavic_companyInsta') || '');
}

function closeSettings(confirmIfDirty = false){
  const el=document.getElementById('settingsOverlay');
  if(!el) return;
  if(confirmIfDirty && hasSettingsChanges()){
    showConfirm('Deseja descartar as alterações não salvas nas configurações?', () => {
      el.classList.remove('open');
    }, { title: 'Descartar alterações?', okText: 'Descartar', danger: true });
  } else {
    el.classList.remove('open');
  }
}
function saveSettings(){
  const cUrl=document.getElementById('clientUrl').value.trim()||'cliente.html';
  localStorage.setItem('mavic_clientUrl',cUrl);window.CLIENT_PANEL_URL=cUrl;
  localStorage.setItem('mavic_pixKey',document.getElementById('pixKey').value.trim());
  localStorage.setItem('mavic_pixName',document.getElementById('pixName').value.trim());
  localStorage.setItem('mavic_pixBank',document.getElementById('pixBank').value.trim());
  localStorage.setItem('mavic_waTemplate',document.getElementById('waTemplate').value.trim());
  localStorage.setItem('mavic_companyName',document.getElementById('companyName').value.trim());
  localStorage.setItem('mavic_companyDoc',document.getElementById('companyDoc').value.trim());
  localStorage.setItem('mavic_companyEmail',document.getElementById('companyEmail').value.trim());
  localStorage.setItem('mavic_companyInsta',document.getElementById('companyInsta').value.trim());
  closeSettings();scheduleSync();showToast('Configurações salvas!','success');
  // Trigger update if defined
  if (typeof updateOrcPreviewLabels === 'function') updateOrcPreviewLabels();
}

// ══════════════════════════════════════════
//  MEGAPHONE NOTICES (GLOBAL)
// ══════════════════════════════════════════
function openGlobalNoticeModal(){
  if(!document.getElementById('globalNoticeOverlay')) return;
  resetGnForm();
  renderGnList();
  updateGnNavBtn();
  document.getElementById('globalNoticeOverlay').classList.add('open');
}
function closeGlobalNoticeModal(){
  const el=document.getElementById('globalNoticeOverlay');
  if(el) el.classList.remove('open');
}
function resetGnForm(){
  if(!document.getElementById('gnTitle')) return;
  document.getElementById('gnTitle').value='';
  document.getElementById('gnMsg').value='';
  document.getElementById('gnActive').checked=true;
  document.getElementById('gnAllClients').checked=true;
  document.getElementById('gnClientsContainer').innerHTML=clients.map(c=>`<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;padding:3px 0">
    <input type="checkbox" class="gn-cli-cb" value="${c.name}" checked style="accent-color:var(--accent);width:14px;height:14px">
    <span><i class="bi bi-person" style="color:var(--accent)"></i> ${c.name}</span>
  </label>`).join('');
  toggleGnAllClients();updateGnPreview();
}
function toggleGnAllClients(){
  const el = document.getElementById('gnAllClients');
  if(!el) return;
  const all=el.checked;
  document.getElementById('gnClientsContainer').style.display=all?'none':'flex';
}
function toggleGnAccordion(id){
  if(openGnIds.has(id)) openGnIds.delete(id);
  else openGnIds.add(id);
  renderGnList();
}
function formatNoticeText(t){
  return t
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*([^*\n]+)\*/g,'<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g,'<em>$1</em>')
    .replace(/\n/g,'<br>');
}
function wrapGnText(before,after){
  const ta=document.getElementById('gnMsg');
  if(!ta) return;
  const s=ta.selectionStart,e=ta.selectionEnd;
  const sel=ta.value.substring(s,e)||'texto';
  ta.setRangeText(before+sel+after,s,e,'select');
  ta.focus();updateGnPreview();
}
function insertGnText(text){
  const ta=document.getElementById('gnMsg');
  if(!ta) return;
  const s=ta.selectionStart;
  ta.setRangeText(text,s,s,'end');
  ta.focus();updateGnPreview();
}
function updateGnPreview(){
  const titleEl=document.getElementById('gnTitle');
  const msgEl=document.getElementById('gnMsg');
  if(!titleEl || !msgEl) return;
  const title=titleEl.value.trim();
  const msg=msgEl.value.trim();
  const active=document.getElementById('gnActive').checked;
  const lbl=document.getElementById('gnStatusLabel');
  lbl.textContent=active?'Ativo':'Inativo';
  lbl.style.color=active?'var(--green)':'var(--text2)';
  if(msg || title){
    document.getElementById('gnPreview').style.display='block';
    document.getElementById('gnPreviewText').innerHTML=`
      <div style="font-weight:700;margin-bottom:4px">${title || 'Sem Título'}</div>
      <div>${formatNoticeText(msg)}</div>
    `;
  }
  else document.getElementById('gnPreview').style.display='none';
}
function renderGnList(){
  const el=document.getElementById('gnList');
  if(!el) return;
  
  const formattedGlobals = globalNotices.map(gn => ({
    id: gn.id,
    type: 'global',
    title: gn.title || 'Aviso Geral',
    message: gn.message,
    active: gn.active,
    createdAt: gn.createdAt,
    targetLabel: gn.targetAll ? 'Todos os clientes' : `${gn.targetClients?.length || 0} cliente(s)`,
    targetedNames: gn.targetAll ? clients.map(c=>c.name) : (gn.targetClients||[]),
    readBy: gn.readBy || []
  }));

  const formattedIndivs = notifications.map(n => {
    const targetCli = clients.find(c => c.token === n.clientToken);
    const targetName = targetCli ? targetCli.name : 'Cliente Desconhecido';
    return {
      id: n.id,
      type: 'individual',
      title: n.title || `Aviso do Projeto: ${n.projectName || 'MAVIC'}`,
      message: n.message,
      active: true,
      createdAt: n.createdAt,
      targetLabel: targetName,
      targetedNames: [targetName],
      readBy: n.read ? [targetName] : []
    };
  });

  const combined = [...formattedGlobals, ...formattedIndivs]
    .filter(gn => gn && gn.message && gn.message.trim() !== '')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if(!combined.length){el.innerHTML='<div class="empty-state"><i class="bi bi-megaphone"></i><span>Nenhum aviso enviado ainda</span></div>';return;}
  
  el.innerHTML=combined.map(gn=>{
    const total = gn.targetedNames.length;
    const readCount = gn.readBy.length;
    const allRead = total > 0 && readCount >= total;
    
    const clientChips = gn.targetedNames.map(n=>{
      const read = gn.readBy.includes(n);
      return `<span style="font-size:11px;padding:2px 8px;border-radius:20px;display:inline-flex;align-items:center;gap:3px;${read?'background:var(--green-bg);color:var(--green)':'background:var(--surface);border:1px solid var(--border);color:var(--text3)'}">
        ${read?'<i class="bi bi-check2"></i>':'<i class="bi bi-clock"></i>'} ${n}
      </span>`;
    }).join('');

    const isOpen = openGnIds.has(gn.id);
    const preview=gn.message.replace(/<[^>]*>/g,'').replace(/\*|_/g,'').substring(0,60)+(gn.message.length>60?'…':'');
    
    return `<div class="gn-accordion ${isOpen ? 'open' : ''}">
      <div class="gn-header" onclick="toggleGnAccordion(${gn.id})">
        <div class="gn-header-title">
          <i class="bi ${gn.type==='global'?'bi-megaphone':'bi-folder'}" style="color:${gn.type==='global'?'var(--accent)':'var(--green)'};flex-shrink:0"></i>
          <span>${gn.title||'Aviso'}</span>
          ${!isOpen?`<span class="gn-header-preview">— ${preview}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span class="badge ${gn.type==='global'?'b-pago':'b-tResidencial'}" style="font-size:10px">${gn.type==='global'?'Global':'Individual'}</span>
          <i class="bi bi-chevron-down gn-header-arrow"></i>
        </div>
      </div>
      <div class="gn-content">
        <div style="font-size:13px;font-weight:500;line-height:1.6;margin-bottom:10px">${formatNoticeText(gn.message)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text3);flex-wrap:wrap">
            <span><i class="bi bi-people"></i> ${gn.targetLabel}</span>
            <span>·</span>
            <span><i class="bi bi-calendar3"></i> ${new Date(gn.createdAt).toLocaleDateString('pt-BR')}</span>
            <span>·</span>
            <span style="font-weight:600;color:${allRead?'var(--green)':readCount>0?'var(--yellow)':'var(--text3)'}">
              <i class="bi bi-eye"></i> ${readCount}/${total} leram
            </span>
          </div>
          <div style="display:flex;gap:3px;flex-shrink:0">
            ${gn.type === 'global' ? `<button class="cbtn" style="color:${gn.active?'var(--green)':'var(--text3)'}" title="${gn.active?'Desativar':'Ativar'}" onclick="toggleGnActive(${gn.id}); event.stopPropagation();"><i class="bi bi-${gn.active?'toggle-on':'toggle-off'}"></i></button>` : ''}
            <button class="cbtn del" onclick="deleteAdminNotice(${gn.id}, '${gn.type}'); event.stopPropagation();" title="Excluir"><i class="bi bi-trash3"></i></button>
          </div>
        </div>
        ${gn.targetedNames.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">${clientChips}</div>`:''}
      </div>
    </div>`;
  }).join('');
}
function saveGlobalNotice(){
  const title=document.getElementById('gnTitle').value.trim();
  const msg=document.getElementById('gnMsg').value.trim();
  if(!title)return showToast('Escreva o título','warning');
  if(!msg)return showToast('Escreva a mensagem','warning');
  const active=document.getElementById('gnActive').checked;
  const targetAll=document.getElementById('gnAllClients').checked;
  const targetClients=targetAll?[]:Array.from(document.querySelectorAll('.gn-cli-cb:checked')).map(cb=>cb.value);
  if(!targetAll&&!targetClients.length)return showToast('Selecione ao menos um cliente','warning');
  globalNotices.push({id:Date.now(),title,message:msg,active,targetAll,targetClients,readBy:[],createdAt:new Date().toISOString()});
  updateGnNavBtn();renderGnList();resetGnForm();
  scheduleSync();showToast(active?'Aviso publicado!':'Aviso salvo (inativo)','success');
}
function toggleGnActive(id){
  const gn=globalNotices.find(x=>x.id===id);if(!gn)return;
  gn.active=!gn.active;renderGnList();updateGnNavBtn();scheduleSync();
  showToast(gn.active?'Aviso ativado':'Aviso desativado','info');
}
function deleteAdminNotice(id, type){
  showConfirm('Excluir este aviso definitivamente?', () => {
    if(type === 'global'){
      globalNotices=globalNotices.filter(x=>x.id!==id);
    } else {
      notifications=notifications.filter(x=>x.id!==id);
    }
    renderGnList();updateGnNavBtn();scheduleSync();showToast('Aviso removido','info');
  });
}
function updateGnNavBtn(){
  const btn=document.getElementById('gnNavBtn');
  if(!btn) return;
  const hasActive=globalNotices.some(x=>x.active);
  btn.style.color=hasActive?'var(--yellow)':'';
}

// ══════════════════════════════════════════
//  ARCHIVE ACTIONS (GLOBAL)
// ══════════════════════════════════════════
function openArchiveModal(){
  if(!document.getElementById('archiveOverlay')) return;
  renderArchived();
  document.getElementById('archiveOverlay').classList.add('open');
}
function closeArchiveModal(){
  const el=document.getElementById('archiveOverlay');
  if(el) el.classList.remove('open');
}
function renderArchived(){
  const el=document.getElementById('archiveList');
  if(!el) return;
  const arch=projects.filter(p=>p.archived);
  if(!arch.length){el.innerHTML='<div class="empty-state"><i class="bi bi-archive"></i><span>Nenhum projeto arquivado</span></div>';return;}
  el.innerHTML=arch.map(p=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border)"><div><div style="font-weight:600;font-size:13.5px">${p.name}</div><div style="font-size:12px;color:var(--text2)">${p.client} · ${p.column}</div></div><div style="display:flex;gap:7px"><button class="btn btn-ghost btn-sm" onclick="restoreProject(${p.id})"><i class="bi bi-arrow-counterclockwise"></i></button><button class="btn btn-danger btn-sm" onclick="deleteProject(${p.id},true)"><i class="bi bi-trash3"></i></button></div></div>`).join('');
}
function restoreProject(id){
  const idx=projects.findIndex(p=>p.id===id);
  if(idx>-1){
    projects[idx].archived=false;
    if (typeof renderBoard === 'function') renderBoard();
    renderArchived();
    scheduleSync();
    showToast('Restaurado!','success');
  }
}
function deleteProject(id,fromArch=false){
  showConfirm('Excluir definitivamente?', () => {
    projects=projects.filter(p=>p.id!==id);
    pinnedCards.delete(id);
    expandedFin.delete(id);
    if(fromArch) renderArchived();
    if (typeof renderBoard === 'function') renderBoard();
    scheduleSync();
    showToast('Excluído','info');
  });
}

// ══════════════════════════════════════════
//  INITIALIZATION & NAV HIGHLIGHT
// ══════════════════════════════════════════
function highlightActiveTab() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    const href = tab.getAttribute('href');
    if (href) {
      const match = window.location.pathname.endsWith(href) || 
                    (href === 'index.html' && (window.location.pathname === '/' || window.location.pathname.endsWith('ProjetosMavic/') || window.location.pathname.endsWith('ProjetosMavic/index.html')));
      tab.classList.toggle('on', match);
    }
  });
}

// Ping Supabase every 30 mins to prevent database pausing
setInterval(async()=>{
  if(!sb)return;
  try{await sb.from('mavic_store').select('key').limit(1);}catch(e){}
},30*60*1000);

document.addEventListener('DOMContentLoaded', async () => {
  // Automatically unregister Service Worker on localhost to prevent dev cache freezes
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '::1') {
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let reg of regs) {
          await reg.unregister();
        }
      } catch (err) {
        console.warn('SW unregister failed:', err);
      }
    }
  } else if ('serviceWorker' in navigator) {
    // Em produção, registra em toda página admin (antes só o Board fazia isso —
    // quem abrisse direto o Orçamentos/Pagamentos nunca instalava o cache offline).
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW:', e));
  }

  // Bind default values to theme
  applyTheme(localStorage.getItem('mavic_theme') || 'light');

  await reloadPageData();
  document.body.classList.remove('preload');
});

// Roda o init da página atual (re-render a partir do estado global já carregado).
// Seguro chamar mais de uma vez — todas as páginas apenas reconstroem HTML a
// partir do zero (innerHTML) e os gráficos já se destroem antes de recriar.
function renderCurrentPage(){
  highlightActiveTab();
  updateGnNavBtn();
  populateProjectTypeSelects();
  try {
    if (typeof initPage === 'function') {
      initPage();
    }
  } catch(err) {
    console.error('Page init failed:', err);
  }
}

// Carrega os dados e roda o init da página atual.
//
// Stale-while-revalidate: se já existe alguma coisa em cache local (ou seja,
// não é a primeira visita), a página renderiza IMEDIATAMENTE com os dados
// salvos — sem passar pela tela de carregamento — e só depois atualiza da
// nuvem por trás, em silêncio. É isso que resolve o "piscando tudo" ao trocar
// de menu: antes, toda navegação esperava a rede pra só então desenhar a tela.
// Na primeira visita (sem nada salvo ainda) não tem como fugir da espera.
async function reloadPageData(){
  const loadingEl = document.getElementById('loading');
  const hasCache = localStorage.getItem('mavic_config') !== null;

  if (hasCache) {
    loadLocal();
    renderCurrentPage();
    if (loadingEl) loadingEl.style.display = 'none';
    try {
      await loadData();
    } catch(e) {
      console.error('Atualização em segundo plano falhou, mantendo dados locais', e);
      return;
    }
    renderCurrentPage();
    return;
  }

  try {
    await loadData();
  } catch(e) {
    console.error('loadData failed, falling back to local storage caching', e);
    loadLocal();
  }
  renderCurrentPage();
  if (loadingEl) loadingEl.style.display = 'none';
}

// ══════════════════════════════════════════
//  INDICADOR DE OFFLINE + RESYNC AUTOMÁTICO
// ══════════════════════════════════════════
// Antes disso, se a internet caísse, só sincronizava de novo se a página
// fosse recarregada manualmente. Agora reage assim que o navegador percebe
// que a conexão voltou, sem precisar de F5.
(function injectOfflineBanner(){
  if(document.getElementById('offlineBanner')) return;
  const nav=document.querySelector('.nav');
  if(!nav) return; // só nas páginas admin
  const el=document.createElement('div');
  el.id='offlineBanner';
  el.className='offline-banner d-none';
  el.innerHTML='<span><i class="bi bi-wifi-off"></i> Sem conexão — trabalhando com os dados salvos neste dispositivo. Assim que a internet voltar, sincroniza sozinho.</span>';
  nav.insertAdjacentElement('afterend', el);
})();
function updateOfflineBanner(){
  const el=document.getElementById('offlineBanner');
  if(!el) return;
  el.classList.toggle('d-none', navigator.onLine);
}
window.addEventListener('load', updateOfflineBanner);
window.addEventListener('offline', updateOfflineBanner);
window.addEventListener('online', async () => {
  updateOfflineBanner();
  showToast('Conexão restabelecida — sincronizando…', 'success');
  await reloadPageData();
});

// ══════════════════════════════════════════
//  MÁSCARA DE MOEDA BRL (GLOBAL)
// ══════════════════════════════════════════
function maskCurrencyInput(el) {
  let digits = el.value.replace(/\D/g, '');
  if (!digits) { el.value = ''; return; }
  digits = digits.replace(/^0+(?=\d)/, '');
  while (digits.length < 3) digits = '0' + digits;
  const cents = digits.slice(-2);
  const intFormatted = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  el.value = `${intFormatted},${cents}`;
}
function parseCurrencyInput(str) {
  if (!str) return 0;
  const clean = String(str).replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}
function toBRLInputStr(num) {
  const cents = Math.round((parseFloat(num) || 0) * 100).toString().padStart(3, '0');
  const intFormatted = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFormatted},${cents.slice(-2)}`;
}

// ══════════════════════════════════════════
//  BACKUP E RESTAURAÇÃO DE DADOS (JSON)
// ══════════════════════════════════════════
function exportBackup() {
  const data = {
    projects,
    clients,
    notifications,
    global_notices: globalNotices,
    budgets,
    config: {
      columns: appColumns,
      visibleColumns,
      minimizedColumns,
      noteTemplates,
      quickMsgs,
      projectTypes,
      waTemplate: localStorage.getItem('mavic_waTemplate'),
      companyName: localStorage.getItem('mavic_companyName'),
      companyDoc: localStorage.getItem('mavic_companyDoc'),
      pixKey: localStorage.getItem('mavic_pixKey'),
      pixName: localStorage.getItem('mavic_pixName'),
      pixBank: localStorage.getItem('mavic_pixBank')
    }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_mavic_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backup exportado com sucesso!', 'success');
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      const projs = data.projects;
      const clis = data.clients;
      if (!projs || !clis) {
        showToast('Formato de arquivo inválido!', 'error');
        return;
      }
      showConfirm('Deseja realmente restaurar este backup? Isso substituirá todos os dados atuais (localmente e na nuvem).', () => {
        projects = projs;
        clients = clis;
        notifications = data.notifications || [];
        globalNotices = data.global_notices || data.globalNotices || [];
        budgets = data.budgets || [];
        if (data.config) {
          const cfg = data.config;
          if (cfg.columns) appColumns = cfg.columns;
          if (cfg.visibleColumns) visibleColumns = cfg.visibleColumns;
          if (cfg.minimizedColumns) minimizedColumns = cfg.minimizedColumns;
          if (cfg.noteTemplates) noteTemplates = cfg.noteTemplates;
          if (cfg.quickMsgs) quickMsgs = cfg.quickMsgs;
          if (cfg.projectTypes) projectTypes = cfg.projectTypes;
          if (cfg.waTemplate !== undefined) localStorage.setItem('mavic_waTemplate', cfg.waTemplate);
          if (cfg.companyName !== undefined) localStorage.setItem('mavic_companyName', cfg.companyName);
          if (cfg.companyDoc !== undefined) localStorage.setItem('mavic_companyDoc', cfg.companyDoc);
          if (cfg.pixKey !== undefined) localStorage.setItem('mavic_pixKey', cfg.pixKey);
          if (cfg.pixName !== undefined) localStorage.setItem('mavic_pixName', cfg.pixName);
          if (cfg.pixBank !== undefined) localStorage.setItem('mavic_pixBank', cfg.pixBank);
        }
        scheduleSync();
        renderCurrentPage();
        showToast('Backup restaurado com sucesso!', 'success');
      });
    } catch (err) {
      showToast('Erro ao ler arquivo de backup!', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

