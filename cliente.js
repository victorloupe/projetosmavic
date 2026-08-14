// URL da Edge Function — ajuste se o projeto Supabase mudar
const EDGE_FN = 'https://ygwrpwkkriaeqaeuuxan.supabase.co/functions/v1/cliente-data';

let projects=[],clients=[],globalNotices=[],appColumns=[{id:'Briefing',icon:'bi-clipboard',color:'#92623a'},{id:'Desenvolvimento',icon:'bi-pencil',color:'#ea580c'},{id:'Revisão',icon:'bi-search',color:'#2563eb'},{id:'Obra',icon:'bi-hammer',color:'#d97706'},{id:'Concluído',icon:'bi-check-circle',color:'#16a34a',isFinal:true}];
const DEFAULT_COL_COLOR='#92623a';
const DEFAULT_COL_ICON='bi-folder';
// Mesma lógica do painel admin: coluna final é marcada por isFinal, com
// fallback pro nome "Concluído" pra compatibilidade com configs antigas.
function isFinalColumn(colId){
  const col=appColumns.find(c=>c.id===colId);
  if(!col) return colId==='Concluído';
  return col.isFinal===true || (col.isFinal===undefined && col.id==='Concluído');
}
// Coluna "encerrada": projeto já entregue/pago, some por completo do painel
// do cliente (lista de projetos e totais financeiros).
// Marcado com hideClient, com fallback pro nome "Finalizado".
function isHiddenColumn(colId){
  const col=appColumns.find(c=>c.id===colId);
  if(!col) return colId==='Finalizado';
  return col.hideClient===true || (col.hideClient===undefined && col.id==='Finalizado');
}
let notifications=[],appTheme='light';
let clientName='',clientToken='';
let clientDoc='',clientAddress='',companyName='MAVIC Arquitetura e Engenharia',companyDoc='';
let pixKey='',pixName='',pixBank='';

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

// Máscara de CPF/CNPJ (cópia autônoma — cliente.js não carrega common.js)
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
// Tipos de projeto — mesmo padrão-de-fábrica do admin. Se o servidor mandar
// config.projectTypes (edge function atualizada), usa os tipos personalizados
// do usuário; senão cai nesses aqui, sem quebrar nada.
const DEFAULT_PROJECT_TYPES=[
  {id:'Residencial',color:'#2563eb'},
  {id:'Comercial',color:'#7c3aed'},
  {id:'Estrutural',color:'#d97706'},
  {id:'Urbanismo',color:'#0d9488'},
  {id:'Outro',color:'#71717a'}
];
let projectTypes=DEFAULT_PROJECT_TYPES;
function typeColor(typeId){
  const t=projectTypes.find(x=>x.id===typeId);
  return t?t.color:'#71717a';
}
function hexToRgba(hex,alpha){
  const h=(hex||'#71717a').replace('#','');
  const full=h.length===3?h.split('').map(c=>c+c).join(''):h;
  const r=parseInt(full.slice(0,2),16)||113,g=parseInt(full.slice(2,4),16)||113,b=parseInt(full.slice(4,6),16)||113;
  return `rgba(${r},${g},${b},${alpha})`;
}
function typeBg(typeId){ return hexToRgba(typeColor(typeId),0.13); }
function populateTypeFilter(){
  const sel=document.getElementById('fType');
  if(!sel) return;
  sel.innerHTML='<option value="">Todos os Tipos</option>'+projectTypes.map(t=>`<option value="${t.id}">${t.id}</option>`).join('');
}

let pinnedCards=new Set(),expandedFin=new Set();
let openNotifIds = new Set();
const AVATAR_COLORS=['#e07b54','#5b8dd9','#8b5cf6','#059669','#d97706','#db2777','#0891b2','#65a30d','#dc2626','#7c3aed'];
function getClientColor(name){let h=0;for(let i=0;i<name.length;i++)h=name.charCodeAt(i)+((h<<5)-h);return AVATAR_COLORS[Math.abs(h)%AVATAR_COLORS.length];}
function getInitials(name){return(name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();}

const params=new URLSearchParams(window.location.search);
clientName=(params.get('nome')||'').trim();
clientToken=(params.get('token')||'').trim();

// ══════════════════════════════════════════
//  LOAD DATA — via Edge Function (server-side auth)
// ══════════════════════════════════════════
async function loadData(){
  const rIcon = document.getElementById('refreshIcon');
  if(rIcon) rIcon.classList.add('spinning');
  document.getElementById('loading').style.display='flex';
  document.getElementById('errorScreen').classList.add('d-none');
  document.getElementById('boardView').style.display='flex';

  if(!clientName){showError('bi-link-45deg','Link inválido','Nenhum cliente especificado na URL.');if(rIcon)rIcon.classList.remove('spinning');return;}
  document.getElementById('clientLabel').textContent=clientName;
  document.getElementById('loadingText').textContent=`Carregando projetos de ${clientName}`;

  try{
    const url=`${EDGE_FN}?nome=${encodeURIComponent(clientName)}${clientToken?'&token='+encodeURIComponent(clientToken):''}`;
    const res=await fetch(url);
    const payload=await res.json();

    if(!res.ok){
      if(res.status===401||payload.error==='invalid_token')
        showError('bi-shield-lock','Acesso negado','Token inválido. Solicite um novo link ao escritório MAVIC.');
      else if(res.status===404||payload.error==='client_not_found')
        showError('bi-person-x','Cliente não encontrado','Verifique o link recebido ou entre em contato com o escritório.');
      else
        showError('bi-exclamation-triangle','Erro ao carregar','Não foi possível conectar ao servidor. Tente novamente.');
      if(rIcon)rIcon.classList.remove('spinning');
      return;
    }

    projects      = payload.projects      || [];
    notifications = payload.notifications || [];
    globalNotices = payload.globalNotices || [];
    if(payload.config?.columns?.length) appColumns=payload.config.columns;
    if(payload.config?.projectTypes?.length) projectTypes=payload.config.projectTypes;
    applyTheme(payload.config?.theme || localStorage.getItem('mavic_theme') || 'light');

    // Dados pro recibo em PDF
    clientDoc = payload.clientDoc || '';
    clientAddress = payload.clientAddress || '';
    companyName = payload.config?.companyName || 'MAVIC Arquitetura e Engenharia';
    companyDoc = payload.config?.companyDoc || '';
    pixKey = payload.config?.pixKey || '';
    pixName = payload.config?.pixName || '';
    pixBank = payload.config?.pixBank || '';

  }catch(e){
    console.warn('Edge Function indisponível, usando cache local:', e);
    // Fallback para dados locais (sem dados reais do servidor)
    projects      = JSON.parse(localStorage.getItem('mavic_projects_'+clientName)||'[]');
    notifications = JSON.parse(localStorage.getItem('mavic_notifications_'+clientName)||'[]');
    globalNotices = JSON.parse(localStorage.getItem('mavic_global_notices')||'[]');
    const cfg=JSON.parse(localStorage.getItem('mavic_config')||'{}');
    if(cfg.columns?.length) appColumns=cfg.columns;
    if(cfg.projectTypes?.length) projectTypes=cfg.projectTypes;
  }
  populateTypeFilter();

  document.getElementById('loading').style.display='none';
  if(rIcon) rIcon.classList.remove('spinning');
  calcFinance();renderNotifications();renderBoard();
}

// ══════════════════════════════════════════
//  WRITE — marcar avisos como lidos (server-side)
// ══════════════════════════════════════════
async function postEdgeFn(body){
  try{
    await fetch(EDGE_FN,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...body, nome:clientName, token:clientToken})
    });
  }catch(e){console.warn('Falha ao sincronizar leitura:', e);}
}

function showError(icon,title,msg){
  document.getElementById('loading').style.display='none';
  document.getElementById('boardView').style.display='none';
  document.getElementById('notifWrap').classList.add('d-none');
  document.getElementById('errorScreen').classList.remove('d-none');
  document.getElementById('errIcon').className='bi '+icon;
  document.getElementById('errTitle').textContent=title;
  document.getElementById('errMsg').textContent=msg;
}

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

function fmt(v){return parseFloat(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}

function calcFinance(){
  let pago=0,rest=0;
  projects.filter(p=>!p.archived&&!isHiddenColumn(p.column)).forEach(p=>{
    const t=parseFloat(p.value||0);const pg=(p.payments||[]).reduce((s,x)=>s+parseFloat(x.amount||0),0);
    pago+=pg;if(t-pg>0)rest+=t-pg;
  });
  const pF=fmt(pago),rF=fmt(rest);
  document.getElementById('totalPago').textContent=pF;
  document.getElementById('totalRest').textContent=rF;
  document.getElementById('totalPagoM').textContent=pF;
  document.getElementById('totalRestM').textContent=rF;
}

function toggleTheme(){appTheme=appTheme==='light'?'dark':'light';applyTheme(appTheme);localStorage.setItem('mavic_theme',appTheme);}
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);appTheme=t;
  const btn=document.getElementById('themeBtn'),logo=document.getElementById('navLogo');
  if(t==='dark'){btn.innerHTML='<i class="bi bi-sun" style="color:#fbbf24"></i>';if(logo)logo.src='https://i.postimg.cc/vZmmNLjj/LOGO-NOVA-black.png';}
  else{btn.innerHTML='<i class="bi bi-moon-stars"></i>';if(logo)logo.src='LOGO NOVA.png';}
}

// ══════════════════════════════════════════
//  NOTIFICATIONS & GLOBALS ACCORDION
// ══════════════════════════════════════════
function getNotifDismissed(){return JSON.parse(localStorage.getItem('mavic_notif_read_'+clientName)||'[]');}
function getNotifDeleted(){return JSON.parse(localStorage.getItem('mavic_notif_deleted_'+clientName)||'[]');}

async function confirmNotice(id, type) {
  const key = isNaN(id) ? id : Number(id);
  if (type === 'individual') {
    const d = getNotifDismissed();
    if (!d.includes(key)) d.push(key);
    localStorage.setItem('mavic_notif_read_' + clientName, JSON.stringify(d));
    // Sincronizar com o servidor via Edge Function
    await postEdgeFn({ action: 'mark_read', notifId: key });
    notifications = notifications.map(n => n.id===key ? {...n, read:true} : n);
    renderNotifications();renderBoard();
  } else if (type === 'global') {
    dismissGlobalNotice(key);
  }
}

function deleteNotice(id, type) {
  const key = isNaN(id) ? id : Number(id);
  showConfirm('Excluir este aviso permanentemente do seu painel?', () => {
    const del = getNotifDeleted();
    if (!del.includes(key)) del.push(key);
    localStorage.setItem('mavic_notif_deleted_' + clientName, JSON.stringify(del));
    renderNotifications();
  });
}

// ══════════════════════════════════════════
//  CONFIRM MODAL (substitui o confirm() nativo do navegador)
// ══════════════════════════════════════════
let _confirmCallback = null;
function showConfirm(message, onConfirm) {
  const overlay = document.getElementById('confirmOverlay');
  if (!overlay) { onConfirm(); return; }
  document.getElementById('confirmMsg').textContent = message;
  _confirmCallback = onConfirm;
  overlay.classList.remove('d-none');
}
function closeConfirm() {
  document.getElementById('confirmOverlay')?.classList.add('d-none');
  _confirmCallback = null;
}
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'confirmBtnOk') {
    const cb = _confirmCallback;
    closeConfirm();
    if (cb) cb();
  }
});

async function dismissGlobalNotice(id) {
  const key = isNaN(id) ? id : Number(id);
  localStorage.setItem('mavic_notice_read_' + key, '1');
  await postEdgeFn({ action: 'mark_global_read', noticeId: key });
  renderNotifications();
}

function toggleAccordion(id) {
  const key = isNaN(id) ? id : Number(id);
  if (openNotifIds.has(key)) openNotifIds.delete(key);
  else openNotifIds.add(key);
  renderNotifications();
}

function formatNoticeText(t){
  return t
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*([^*\n]+)\*/g,'<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g,'<em>$1</em>')
    .replace(/\n/g,'<br>');
}

function renderNotifications(){
  const wrap=document.getElementById('notifWrap');
  const dismissed = getNotifDismissed();
  const deleted   = getNotifDeleted();

  // Notificações individuais
  const myIndiv = notifications
    .filter(n => !deleted.includes(n.id))
    .map(n => ({
      id: n.id, type: 'individual',
      title: n.title || `Aviso do Projeto: ${n.projectName || 'MAVIC'}`,
      message: n.message, projectName: n.projectName, createdAt: n.createdAt,
      read: dismissed.includes(n.id) || !!n.read
    }));

  // Avisos globais ativos (já filtrados pelo servidor)
  const myGlobals = globalNotices
    .filter(gn => !deleted.includes(gn.id))
    .map(gn => ({
      id: gn.id, type: 'global',
      title: gn.title || 'Aviso Geral MAVIC',
      message: gn.message, projectName: null, createdAt: gn.createdAt,
      read: !!localStorage.getItem('mavic_notice_read_' + gn.id)
    }));

  const allNotices = [...myIndiv, ...myGlobals].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if(!allNotices.length){wrap.classList.add('d-none');return;}
  wrap.classList.remove('d-none');

  const unreadCount = allNotices.filter(n => !n.read).length;

  let html = `<div class="notif-title">
    <i class="bi bi-bell"></i> Central de Avisos
    ${unreadCount > 0 ? `<span style="background:var(--accent);color:#fff;padding:1px 7px;border-radius:20px;font-size:11px;margin-left:6px">${unreadCount} novo(s)</span>` : ''}
  </div>`;

  html += allNotices.map(n => {
    const dt = new Date(n.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const isUnread   = !n.read;
    const borderClass = isUnread ? (n.type === 'global' ? 'notif-global-unread' : 'notif-unread') : 'notif-read';
    const isOpen      = openNotifIds.has(n.id);

    return `<div class="notif-accordion ${borderClass} ${isOpen ? 'open' : ''}">
      <div class="notif-header" onclick="toggleAccordion('${n.id}')">
        <div class="notif-header-title">
          <i class="bi ${n.type === 'global' ? 'bi-megaphone' : 'bi-folder'}" style="color:${isUnread ? (n.type === 'global' ? 'var(--yellow)' : 'var(--green)') : 'var(--text3)'}"></i>
          <span>${n.title}</span>
          ${isUnread ? `<span class="badge ${n.type==='global' ? 'b-urg' : 'b-baixa'}" style="font-size:9px;padding:1px 5px">Novo</span>` : ''}
        </div>
        <i class="bi bi-chevron-down notif-header-arrow"></i>
      </div>
      <div class="notif-content">
        <div class="notif-msg" style="font-size:13px;line-height:1.6;color:var(--text)">${formatNoticeText(n.message)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:8px;border-top:1px dashed var(--border);flex-wrap:wrap;gap:8px">
          <span style="font-size:11px;color:var(--text3)">
            <i class="bi bi-calendar3"></i> ${dt}${n.projectName ? ` &middot; <i class="bi bi-folder2"></i> ${n.projectName}` : ''}
          </span>
          <div style="display:flex;align-items:center;gap:6px">
            ${isUnread ? `
              <button onclick="confirmNotice('${n.id}', '${n.type}')" style="background:var(--green-bg);border:1px solid var(--green);color:var(--green);border-radius:6px;padding:3px 9px;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px">
                <i class="bi bi-check2"></i> Confirmar leitura
              </button>
            ` : `
              <span style="font-size:11px;color:var(--text3);font-weight:500;margin-right:6px"><i class="bi bi-check2-all"></i> Lido</span>
            `}
            <button onclick="deleteNotice('${n.id}', '${n.type}')" style="background:var(--red-bg);border:1px solid var(--red);color:var(--red);border-radius:6px;padding:3px 9px;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px" title="Excluir aviso do painel">
              <i class="bi bi-trash3"></i> Excluir
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('notifBanner').innerHTML = html;
}

// ══════════════════════════════════════════
//  BOARD
// ══════════════════════════════════════════
function renderBoard(){
  const board=document.getElementById('board');board.innerHTML='';
  const srch=document.getElementById('srch').value.toLowerCase().trim();
  const fType=document.getElementById('fType').value;
  const myProjs=projects.filter(p=>!p.archived&&!isHiddenColumn(p.column)
    &&(!fType||p.type===fType)
    &&(!srch||p.name?.toLowerCase().includes(srch)));
  
  document.getElementById('boardCount').textContent=`${myProjs.length} projeto${myProjs.length!==1?'s':''}`;
  
  if(!myProjs.length){
    board.innerHTML='<div class="empty-state" style="padding:40px;text-align:center;width:100%"><i class="bi bi-folder-x" style="font-size:48px;color:var(--text3)"></i><p style="margin-top:10px;color:var(--text2)">Nenhum projeto encontrado</p></div>';
    return;
  }
  
  board.innerHTML=myProjs.map((p,i)=>createCardHTML(p,i)).join('');
}

// ══════════════════════════════════════════
//  CARD HTML
// ══════════════════════════════════════════
function createCardHTML(p, cardIdx=0){
  const pays=p.payments||[];
  const total=parseFloat(p.value||0);
  const paid=pays.reduce((s,x)=>s+parseFloat(x.amount||0),0);
  const rest=total-paid;
  const dl=p.date?new Date(p.date+'T12:00:00'):null;
  const diff=dl?Math.ceil((dl-new Date().setHours(0,0,0,0))/86400000):null;
  let dateCls='',dateBadge='';
  if(dl){if(diff<0){dateCls='b-venc';dateBadge='<span class="badge b-venc">Atrasado</span>';}else if(diff<=7){dateCls='b-urg';dateBadge=`<span class="badge b-urg">${diff}d</span>`;}}
  const dlClass=diff===null?'':(diff<0?'dl-overdue':diff<=7?'dl-urgent':'');
  const pMap={Alta:'b-alta',Média:'b-media',Baixa:'b-baixa'};
  const pIcon={Alta:'🔴',Média:'🟡',Baixa:'🟢'};
  let sClass='',sLabel='';
  if(total>0){if(rest<=0){sClass='b-pago';sLabel='✓ Pago';}else if(paid>0){sClass='b-parcial';sLabel='Parcial';}else{sClass='b-pendente';sLabel='Pendente';}}
  const subs=p.subtasks||[];
  const subDone=subs.filter(s=>s.done).length;
  const subPct=subs.length?Math.round((subDone/subs.length)*100):0;
  const progColor=subPct===100?'var(--green)':subPct>0?'var(--accent)':'transparent';
  const activeSubs = subs.filter(s => s.current && !s.done);
  const currSubs = activeSubs.length ? activeSubs : (subs.find(s => !s.done) ? [subs.find(s => !s.done)] : []);
  const isCurrent = (sId) => currSubs.some(cs => cs.id === sId);

  // Timeline
  const visibleCols = appColumns.filter(c => !isHiddenColumn(c.id));
  const currentIdx = visibleCols.findIndex(c => c.id === p.column);
  const stepsHtml = visibleCols.map((col, idx) => {
    let stepCls = 'step-pending';
    let stepIcon = `<span class="step-num">${idx + 1}</span>`;
    if (idx < currentIdx) {
      stepCls = 'step-completed';
      stepIcon = '<i class="bi bi-check-lg"></i>';
    } else if (idx === currentIdx) {
      stepCls = 'step-active';
      stepIcon = `<i class="bi ${col.icon || DEFAULT_COL_ICON}"></i>`;
    }
    return `<div class="timeline-step ${stepCls}" title="${col.id}">
      <div class="step-icon-wrap" style="${idx === currentIdx ? `background:${col.color||DEFAULT_COL_COLOR};color:#fff;border-color:${col.color||DEFAULT_COL_COLOR}` : ''}">${stepIcon}</div>
    </div>`;
  }).join('<div class="timeline-line"></div>');

  const timelineHtml = `<div class="project-timeline">
    <div class="timeline-title"><i class="bi bi-compass" style="color:var(--accent)"></i> Etapa do Projeto: <strong>${p.column}</strong></div>
    <div class="timeline-stepper">${stepsHtml}</div>
  </div>`;

  // Subtask Text HTML
  let subtaskTextHtml = '';
  if (currSubs.length === 1) {
    subtaskTextHtml = `<div class="client-current-task" style="margin-top:10px;font-size:12px;background:var(--yellow-bg);padding:6px 10px;border-radius:8px;border:1px solid rgba(217,119,6,.15);display:flex;align-items:center;gap:6px;font-weight:500"><i class="bi bi-lightning-charge-fill" style="color:var(--yellow);font-size:13px"></i> <span><strong>Trabalhando em:</strong> ${currSubs[0].text}</span></div>`;
  } else if (currSubs.length > 1) {
    subtaskTextHtml = `<div class="client-current-task" style="margin-top:10px;font-size:12px;background:var(--yellow-bg);padding:6px 10px;border-radius:8px;border:1px solid rgba(217,119,6,.15);display:flex;flex-direction:column;align-items:flex-start;gap:6px;font-weight:500">
      <div style="display:flex;align-items:center;gap:6px"><i class="bi bi-lightning-charge-fill" style="color:var(--yellow);font-size:13px"></i> <span><strong>Trabalhando em:</strong></span></div>
      <ul style="margin:5px 0 0 20px;list-style-type:disc;line-height:1.4">
        ${currSubs.map(cs => `<li>${cs.text}</li>`).join('')}
      </ul>
    </div>`;
  }

  // Finance block
  const isExp=expandedFin.has(p.id);
  let finHtml='';
  if(total>0){
    const hRows=pays.length?pays.map(pg=>`<div class="fin-hist-item"><span style="color:var(--text3);font-size:11px"><i class="bi bi-calendar3"></i> ${pg.date?new Date(pg.date+'T12:00:00').toLocaleDateString('pt-BR'):'—'} · ${pg.method||'Pix'}</span><span class="fv">+${fmt(pg.amount)}</span></div>`).join(''):'<div class="fin-hist-item" style="color:var(--text3);justify-content:center;font-size:12px">Sem pagamentos</div>';
    finHtml=`<div class="fin-blk">
      <div class="fin-sum">
        <div class="fin-row"><span class="lbl">Total do contrato</span><span class="val">${fmt(total)}</span></div>
        <div class="fin-row"><span class="lbl">Valor pago</span><span class="val" style="color:var(--green)">${fmt(paid)}</span></div>
        <div class="fin-row" style="border-top:1px solid var(--border);padding-top:3px;margin-top:2px">
          <span class="lbl">Saldo restante</span>
          <span class="val" style="color:${rest>0?'var(--red)':'var(--text3)'}">
            ${fmt(rest)} <span class="badge ${sClass}" style="font-size:10px">${sLabel}</span>
          </span>
        </div>
      </div>
      <button class="fin-hist-btn" onclick="toggleFin(${p.id});event.stopPropagation()">
        <i class="bi bi-clock-history"></i> ${pays.length} pagamento${pays.length!==1?'s':''}
        <i class="bi bi-chevron-${isExp?'up':'down'}" style="float:right;margin-top:1px;font-size:10px"></i>
      </button>
      <div class="fin-hist-rows ${isExp?'':'d-none'}">${hRows}</div>
    </div>`;
  }

  // Products block
  const prods=p.products||[];
  let prodsHtml='';
  if(prods.length){
    prodsHtml=`<div style="margin-top:8px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--text3);margin-bottom:4px"><i class="bi bi-tags"></i> Serviços Contratados</div>
      <table class="prod-table"><thead><tr><th>Serviço</th><th>Valor</th></tr></thead><tbody>
        ${prods.map(pd=>`<tr><td style="font-weight:500">${pd.name}</td><td style="font-family:'Courier New',monospace;font-weight:700;color:var(--green)">${fmt(pd.price)}</td></tr>`).join('')}
      </tbody></table></div>`;
  }

  // Checklist
  let checkHtml='';
  if(subs.length){
    checkHtml=`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-top:7px">
      <div style="padding:5px 8px;display:flex;justify-content:space-between;font-size:12px;font-weight:600">
        <span><i class="bi bi-ui-checks"></i> Andamento</span>
        <span style="font-family:'Courier New',monospace">${subDone}/${subs.length}</span>
      </div>
      <div class="prog" style="margin:0 8px 6px"><div class="prog-fill ${subPct===100?'done':''}" style="width:${subPct}%"></div></div>
      <div style="max-height:96px;overflow-y:auto">
        ${subs.map(s=>{
          const sIsCurrent = isCurrent(s.id);
          return `<div class="sub-row ${sIsCurrent?'sub-in-progress':''}"><input type="checkbox" disabled ${s.done?'checked':''}><span class="${s.done?'sub-done':''}">${sIsCurrent?'<i class="bi bi-play-fill" style="color:var(--accent);font-size:10px;margin-right:2px"></i>':''}${s.text}</span></div>`;
        }).join('')}
      </div>
    </div>`;
  }

  const noteHtml=p.note?`<p style="font-size:12px;color:var(--text2);margin-top:7px;line-height:1.5;background:var(--surface2);padding:6px 8px;border-radius:6px">${p.note}</p>`:'';
  const driveHtml = p.driveLink ? `
    <div style="margin-top:8px">
      <a href="${p.driveLink}" target="_blank" class="drive-btn" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);text-decoration:none;font-size:12.5px;font-weight:600;transition:all .2s" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='var(--surface2)'">
        <i class="bi bi-folder2-open" style="color:var(--accent)"></i> Pasta de Arquivos
      </a>
    </div>
  ` : '';

  // Notificações não lidas para este projeto
  const dismissed=getNotifDismissed();
  const unreadNotifs=notifications.filter(n=>n.projectName===p.name&&!dismissed.includes(n.id)&&!n.read);
  const hasBell=unreadNotifs.length>0;

  return `<div class="kcard ${dlClass}" data-id="${p.id}" style="animation-delay:${cardIdx*0.04}s;--type-color:${typeColor(p.type)}">
    ${subs.length?`<div class="kcard-prog-bar"><div class="kcard-prog-fill" style="width:${subPct}%;background:${progColor}"></div></div>`:''}
    ${p.image?`<img src="${p.image}" class="kcard-cover" onerror="this.style.display='none'">`:''}
    <div class="kcard-body">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
        <div class="kcard-name" style="flex:1">${p.name}</div>
        ${hasBell?`<button onclick="scrollToNotif(event,'${p.name}')" title="${unreadNotifs.length} aviso${unreadNotifs.length>1?'s':''} não lido${unreadNotifs.length>1?'s':''}" style="flex-shrink:0;position:relative;background:none;border:none;cursor:pointer;padding:2px 4px;color:var(--yellow)">
          <i class="bi bi-bell" style="font-size:16px"></i>
          <span style="position:absolute;top:-2px;right:-2px;background:var(--red);color:#fff;font-size:9px;font-weight:700;border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;line-height:1">${unreadNotifs.length}</span>
        </button>`:''}
      </div>
      <div class="kcard-tags">
        ${!isFinalColumn(p.column)?`<span class="badge ${pMap[p.priority]||'b-baixa'}">${pIcon[p.priority]||'🟢'} ${p.priority}</span>`:''}
        <span class="badge" style="background:${typeBg(p.type)};color:${typeColor(p.type)}">${p.type}</span>
        ${dl
          ?`<span class="badge ${dateCls||''}" style="margin-left:auto">${dl.toLocaleDateString('pt-BR')} ${dateBadge}</span>`
          :(total>0?`<span class="badge ${sClass}" style="margin-left:auto">${sLabel}</span>`:'')}
      </div>
    </div>
    <div class="kcard-exp">
      ${timelineHtml}
      ${subtaskTextHtml}
      ${driveHtml}
      ${finHtml}${prodsHtml}${checkHtml}${noteHtml}
    </div>
  </div>`;
}

function scrollToNotif(e,projectName){
  e.stopPropagation();
  const wrap=document.getElementById('notifWrap');
  if(wrap.classList.contains('d-none'))return;
  wrap.scrollIntoView({behavior:'smooth',block:'start'});
  const items=wrap.querySelectorAll('.notif-accordion');
  items.forEach(item=>{
    if((item.textContent||'').includes(projectName)){
      item.style.transition='background .3s';
      item.style.background='var(--yellow-bg)';
      item.style.border='1px solid var(--yellow)';
      setTimeout(()=>{item.style.background='';item.style.border='';},2500);
    }
  });
}

function togglePin(e,id){
  if(e.target.closest('button')||e.target.closest('input'))return;
  const card=e.currentTarget;
  if(pinnedCards.has(id)){pinnedCards.delete(id);card.classList.remove('pinned');}
  else{pinnedCards.add(id);card.classList.add('pinned');}
}
function toggleFin(id){if(expandedFin.has(id))expandedFin.delete(id);else expandedFin.add(id);renderBoard();}

function showFinModal(type){
  const modal = document.getElementById('finModal');
  const title = document.getElementById('finModalTitle');
  const body = document.getElementById('finModalBody');
  
  const myProjs = projects.filter(p => !p.archived && !isHiddenColumn(p.column));
  let filtered = [];
  
  if (type === 'pago') {
    title.textContent = 'Resumo — Projetos Pagos';
    filtered = myProjs.filter(p => {
      const pg = (p.payments || []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
      return pg > 0;
    });
  } else {
    title.textContent = 'Resumo — Projetos A Pagar';
    filtered = myProjs.filter(p => {
      const t = parseFloat(p.value || 0);
      const pg = (p.payments || []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
      return (t - pg) > 0;
    });
  }
  
  if (!filtered.length) {
    body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)"><i class="bi bi-cash" style="font-size:32px"></i><p style="margin-top:6px;font-size:13px">Nenhum projeto encontrado</p></div>';
  } else {
    body.innerHTML = filtered.map(p => {
      const pays = p.payments || [];
      const total = parseFloat(p.value || 0);
      const paid = pays.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
      const rest = total - paid;
      
      const restCls = rest <= 0 ? 'b-pago' : (paid > 0 ? 'b-parcial' : 'b-pendente');
      const restLbl = rest <= 0 ? 'Pago' : (paid > 0 ? 'Parcial' : 'Pendente');
      const paysHtml = pays.map(py => `<div class="fin-hist-item"><span>${py.date ? new Date(py.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'} via ${py.method || 'Pix'}</span><span style="display:flex;align-items:center;gap:6px"><span class="fv">${fmt(py.amount)}</span><button onclick="downloadClientReceiptPDF(${p.id},${py.id});event.stopPropagation()" title="Baixar recibo (PDF)" style="background:none;border:none;cursor:pointer;color:var(--accent);padding:2px;display:inline-flex;align-items:center;font-size:14px"><i class="bi bi-receipt"></i></button></span></div>`).join('');
      
      return `<div>
        <div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:6px;display:flex;align-items:center;justify-content:space-between">
          <span>${p.name}</span>
          <span class="badge" style="font-size:10px;background:${typeBg(p.type)};color:${typeColor(p.type)}">${p.type}</span>
        </div>
        <div class="fin-blk" style="margin-top:0">
          <div class="fin-sum">
            <div class="fin-row"><span class="lbl">Total do contrato</span><span class="val" style="color:var(--text)">${fmt(total)}</span></div>
            <div class="fin-row"><span class="lbl">Valor pago</span><span class="val" style="color:var(--green)">${fmt(paid)}</span></div>
            <div class="fin-row" style="margin-top:4px;border-top:1px dashed var(--border);padding-top:4px"><span class="lbl">Saldo restante</span><span class="val rest">${fmt(rest)} <span class="badge ${restCls}" style="font-size:9px;padding:1px 5px;margin-left:4px">${restLbl}</span></span></div>
          </div>
          <button class="fin-hist-btn" onclick="toggleFinModal(${p.id})"><i class="bi bi-clock-history"></i> ${pays.length} pagamento${pays.length !== 1 ? 's' : ''}</button>
          <div class="fin-hist-rows d-none" id="finHistModal-${p.id}">
            ${paysHtml || '<div style="padding:6px;text-align:center;font-size:11px;color:var(--text3)">Nenhum pagamento</div>'}
          </div>
        </div>
      </div>`;
    }).join('<div style="height:1px;background:var(--border);margin:15px 0"></div>');

    if (type !== 'pago' && pixKey) {
      body.innerHTML += `
        <div style="margin-top:20px;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;display:flex;flex-direction:column;gap:6px">
          <div style="font-weight:700;font-size:13px;color:var(--accent);display:flex;align-items:center;gap:6px"><i class="bi bi-qr-code"></i> Dados para Pagamento PIX</div>
          <div style="font-size:12px;color:var(--text2);display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div><strong>Chave PIX:</strong> <span id="pixKeyVal" style="font-family:monospace;font-weight:600">${pixKey}</span></div>
            <button class="btn btn-ghost btn-sm" onclick="copyPixKey()" style="padding:2px 8px;font-size:11px;border-radius:6px;height:24px"><i class="bi bi-copy"></i> Copiar</button>
          </div>
          ${pixName?`<div style="font-size:12px;color:var(--text2)"><strong>Favorecido:</strong> ${pixName}</div>`:''}
          ${pixBank?`<div style="font-size:12px;color:var(--text2)"><strong>Banco:</strong> ${pixBank}</div>`:''}
        </div>
      `;
    }
  }
  
  modal.classList.remove('d-none');
}

function toggleFinModal(pId) {
  const el = document.getElementById(`finHistModal-${pId}`);
  if (el) {
    if (el.classList.contains('d-none')) {
      el.classList.remove('d-none');
    } else {
      el.classList.add('d-none');
    }
  }
}

function closeFinModal() {
  document.getElementById('finModal').classList.add('d-none');
}

// ══════════════════════════════════════════
//  RECIBO EM PDF (mesmo modelo usado pelo admin)
// ══════════════════════════════════════════
async function downloadClientReceiptPDF(projId, payId) {
  const p = projects.find(x => x.id === projId);
  if (!p) return;
  const pay = (p.payments || []).find(x => x.id === payId);
  if (!pay) return;

  // Abre a aba já aqui (ainda dentro do gesto de clique) pra não ser bloqueada como popup
  const previewTab = window.open('', '_blank');

  const pDate = pay.date ? new Date(pay.date + 'T12:00:00') : new Date();
  const mesesExtenso = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const formattedDate = `${pDate.getDate()} de ${mesesExtenso[pDate.getMonth()]} de ${pDate.getFullYear()}`;

  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '-9999px';
  wrapper.innerHTML = `
    <div style="width:190mm;box-sizing:border-box;padding:25px;background:#fff;color:#111;font-family:'Inter',sans-serif;border:2px dotted #4b5563;border-radius:8px">
      <div class="receipt-header">
        <div class="receipt-logo-area">
          <img src="LOGO NOVA.png" alt="MAVIC" class="receipt-logo">
          <span class="receipt-brand-text">${companyName}</span>
        </div>
        <div class="receipt-title-box">
          <h2 class="receipt-title">RECIBO</h2>
          <div class="receipt-number">Nº REC-${pay.id}</div>
        </div>
      </div>
      <div class="receipt-value-box">
        <span class="receipt-val-lbl">VALOR:</span>
        <span class="receipt-val-num">${fmt(pay.amount)}</span>
      </div>
      <div class="receipt-body">
        <p style="text-align:justify;line-height:2">
          Recebemos de <strong>${clientName}</strong>,
          inscrito(a) no CPF/CNPJ sob o nº <strong>${clientDoc ? formatDocMask(clientDoc) : 'Não informado'}</strong>,
          residente em <strong>${clientAddress || 'Não informado'}</strong>,
          a importância de <strong>${valorPorExtenso(pay.amount)}</strong>,
          referente aos serviços prestados no projeto <strong>${p.name}</strong>.
        </p>
        <p style="margin-top:35px;text-align:right">${formattedDate}.</p>
      </div>
      <div class="receipt-footer">
        <div class="receipt-signature-line"></div>
        <div class="receipt-emissor-name">${companyName}</div>
        <div class="receipt-emissor-doc">CPF/CNPJ: ${companyDoc ? formatDocMask(companyDoc) : 'Não informado'}</div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);

  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     `Recibo_${pay.id}_${clientName.replace(/\s+/g, '_')}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  showToast('Gerando PDF...', 'info');
  try {
    await loadHtml2Pdf();
    const pdfBlob = await html2pdf().from(wrapper.firstElementChild).set(opt).outputPdf('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    if (previewTab) previewTab.location.href = blobUrl;
    else window.open(blobUrl, '_blank');
    showToast('PDF gerado! Confira a pré-visualização na nova aba.', 'success');
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    if (previewTab) previewTab.close();
    showToast('Erro ao gerar PDF', 'error');
  } finally {
    if (wrapper && wrapper.parentNode) {
      document.body.removeChild(wrapper);
    }
  }
}

function valorPorExtenso(v) {
  if (v === 0) return 'zero reais';

  const singulares = ['real', 'centavo'];
  const plurais = ['reais', 'centavos'];

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezenas = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const dezenas10_19 = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function escreverInteiro(n) {
    if (n === 0) return '';
    if (n === 100) return 'cem';

    let partes = [];
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) partes.push(centenas[c]);
    if (d === 1) {
      partes.push(dezenas10_19[u]);
    } else {
      if (d > 1) partes.push(dezenas[d]);
      if (u > 0) partes.push(unidades[u]);
    }
    return partes.filter(x => x).join(' e ');
  }

  function escreverGrupo(n, escala) {
    if (n === 0) return '';
    const text = escreverInteiro(n);
    if (escala === 0) return text;
    if (escala === 1) return text === 'um' ? 'mil' : text + ' mil';
    if (escala === 2) return text === 'um' ? 'um milhão' : text + ' milhões';
    return text;
  }

  const total = parseFloat(v).toFixed(2);
  const [reaisStr, centavosStr] = total.split('.');

  let reais = parseInt(reaisStr);
  let centavos = parseInt(centavosStr);

  let partesReais = [];
  let escala = 0;

  while (reais > 0) {
    const grupo = reais % 1000;
    const descGrupo = escreverGrupo(grupo, escala);
    if (descGrupo) partesReais.unshift(descGrupo);
    reais = Math.floor(reais / 1000);
    escala++;
  }

  let textoReais = '';
  if (partesReais.length > 0) {
    const valReais = parseInt(reaisStr);
    const moeda = valReais === 1 ? singulares[0] : plurais[0];
    textoReais = partesReais.join(' e ') + ' ' + moeda;
  }

  let textoCentavos = '';
  if (centavos > 0) {
    const moedaCentavos = centavos === 1 ? singulares[1] : plurais[1];
    textoCentavos = escreverInteiro(centavos) + ' ' + moedaCentavos;
  }

  if (textoReais && textoCentavos) {
    return textoReais + ' e ' + textoCentavos;
  }
  return textoReais || textoCentavos || 'zero reais';
}

function copyPixKey() {
  const kText = document.getElementById('pixKeyVal')?.textContent || pixKey;
  if (!kText) return;
  navigator.clipboard.writeText(kText).then(() => {
    showToast('Chave PIX copiada!', 'success');
  }).catch(() => {
    showToast('Erro ao copiar chave', 'error');
  });
}

document.addEventListener('DOMContentLoaded',loadData);
