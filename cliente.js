// URL da Edge Function — ajuste se o projeto Supabase mudar
const EDGE_FN = 'https://ygwrpwkkriaeqaeuuxan.supabase.co/functions/v1/cliente-data';

let projects=[],clients=[],globalNotices=[],appColumns=[{id:'Briefing',icon:'📋'},{id:'Desenvolvimento',icon:'✏️'},{id:'Revisão',icon:'🔍'},{id:'Obra',icon:'🏗️'},{id:'Concluído',icon:'✅'}];
let notifications=[],appTheme='light';
let clientName='',clientToken='';
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
  document.getElementById('loading').style.display='flex';
  document.getElementById('errorScreen').classList.add('d-none');
  document.getElementById('boardView').style.display='flex';

  if(!clientName){showError('bi-link-45deg','Link inválido','Nenhum cliente especificado na URL.');return;}
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
      return;
    }

    projects      = payload.projects      || [];
    notifications = payload.notifications || [];
    globalNotices = payload.globalNotices || [];
    if(payload.config?.columns?.length) appColumns=payload.config.columns;
    applyTheme(payload.config?.theme || localStorage.getItem('mavic_theme') || 'light');

  }catch(e){
    console.warn('Edge Function indisponível, usando cache local:', e);
    // Fallback para dados locais (sem dados reais do servidor)
    projects      = JSON.parse(localStorage.getItem('mavic_projects_'+clientName)||'[]');
    notifications = JSON.parse(localStorage.getItem('mavic_notifications_'+clientName)||'[]');
    globalNotices = JSON.parse(localStorage.getItem('mavic_global_notices')||'[]');
    const cfg=JSON.parse(localStorage.getItem('mavic_config')||'{}');
    if(cfg.columns?.length) appColumns=cfg.columns;
  }

  document.getElementById('loading').style.display='none';
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

function fmt(v){return parseFloat(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}

function calcFinance(){
  let pago=0,rest=0;
  projects.filter(p=>!p.archived).forEach(p=>{
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
  if(t==='dark'){btn.innerHTML='<i class="bi bi-sun-fill" style="color:#fbbf24"></i>';if(logo)logo.src='https://i.postimg.cc/vZmmNLjj/LOGO-NOVA-black.png';}
  else{btn.innerHTML='<i class="bi bi-moon-stars-fill"></i>';if(logo)logo.src='LOGO NOVA.png';}
}

// ══════════════════════════════════════════
//  NOTIFICATIONS & GLOBALS ACCORDION
// ══════════════════════════════════════════
function getNotifDismissed(){return JSON.parse(localStorage.getItem('mavic_notif_read_'+clientName)||'[]');}
function getNotifDeleted(){return JSON.parse(localStorage.getItem('mavic_notif_deleted_'+clientName)||'[]');}

async function confirmNotice(id, type) {
  if (type === 'individual') {
    const d = getNotifDismissed();
    if (!d.includes(id)) d.push(id);
    localStorage.setItem('mavic_notif_read_' + clientName, JSON.stringify(d));
    // Sincronizar com o servidor via Edge Function
    await postEdgeFn({ action: 'mark_read', notifId: id });
    notifications = notifications.map(n => n.id===id ? {...n, read:true} : n);
    renderNotifications();renderBoard();
  } else if (type === 'global') {
    dismissGlobalNotice(id);
  }
}

function deleteNotice(id, type) {
  if (!confirm("Excluir este aviso permanentemente do seu painel?")) return;
  const del = getNotifDeleted();
  if (!del.includes(id)) del.push(id);
  localStorage.setItem('mavic_notif_deleted_' + clientName, JSON.stringify(del));
  renderNotifications();
}

async function dismissGlobalNotice(id) {
  localStorage.setItem('mavic_notice_read_' + id, '1');
  await postEdgeFn({ action: 'mark_global_read', noticeId: id });
  renderNotifications();
}

function toggleAccordion(id) {
  if (openNotifIds.has(id)) openNotifIds.delete(id);
  else openNotifIds.add(id);
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
    <i class="bi bi-bell-fill"></i> Central de Avisos
    ${unreadCount > 0 ? `<span style="background:var(--accent);color:#fff;padding:1px 7px;border-radius:20px;font-size:11px;margin-left:6px">${unreadCount} novo(s)</span>` : ''}
  </div>`;

  html += allNotices.map(n => {
    const dt = new Date(n.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const isUnread   = !n.read;
    const borderClass = isUnread ? (n.type === 'global' ? 'notif-global-unread' : 'notif-unread') : 'notif-read';
    const isOpen      = openNotifIds.has(n.id);

    return `<div class="notif-accordion ${borderClass} ${isOpen ? 'open' : ''}">
      <div class="notif-header" onclick="toggleAccordion(${n.id})">
        <div class="notif-header-title">
          <i class="bi ${n.type === 'global' ? 'bi-megaphone-fill' : 'bi-folder-fill'}" style="color:${isUnread ? (n.type === 'global' ? 'var(--yellow)' : 'var(--green)') : 'var(--text3)'}"></i>
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
              <button onclick="confirmNotice(${n.id}, '${n.type}')" style="background:var(--green-bg);border:1px solid var(--green);color:var(--green);border-radius:6px;padding:3px 9px;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px">
                <i class="bi bi-check2"></i> Confirmar leitura
              </button>
            ` : `
              <span style="font-size:11px;color:var(--text3);font-weight:500;margin-right:6px"><i class="bi bi-check2-all"></i> Lido</span>
            `}
            <button onclick="deleteNotice(${n.id}, '${n.type}')" style="background:var(--red-bg);border:1px solid var(--red);color:var(--red);border-radius:6px;padding:3px 9px;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px" title="Excluir aviso do painel">
              <i class="bi bi-trash"></i> Excluir
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
  const myProjs=projects.filter(p=>!p.archived
    &&(!fType||p.type===fType)
    &&(!srch||p.name?.toLowerCase().includes(srch)));
  let total=0;
  appColumns.forEach(col=>{
    const colProjs=myProjs.filter(p=>p.column===col.id);
    if(!colProjs.length&&window.innerWidth<=768)return;
    total+=colProjs.length;
    const el=document.createElement('div');el.className='kcol';
    el.innerHTML=`
      <div class="kcol-hdr">
        <div class="kcol-title">${col.icon} ${col.id} <span class="kcol-cnt">${colProjs.length}</span></div>
      </div>
      <div class="kdrop">
        ${colProjs.map((p,i)=>createCardHTML(p,i)).join('')}
        ${!colProjs.length?'<div class="kempty">Nenhum projeto nesta etapa</div>':''}
      </div>`;
    board.appendChild(el);
  });
  document.getElementById('boardCount').textContent=`${total} projeto${total!==1?'s':''}`;
  pinnedCards.forEach(id=>{const el=board.querySelector(`.kcard[data-id="${id}"]`);if(el)el.classList.add('pinned');});
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

  // Finance block
  const isExp=expandedFin.has(p.id);
  let finHtml='';
  if(total>0){
    const hRows=pays.length?pays.map(pg=>`<div class="fin-hist-item"><span style="color:var(--text3);font-size:11px"><i class="bi bi-calendar3"></i> ${pg.date?new Date(pg.date+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</span><span class="fv">+${fmt(pg.amount)}</span></div>`).join(''):'<div class="fin-hist-item" style="color:var(--text3);justify-content:center;font-size:12px">Sem pagamentos</div>';
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
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--text3);margin-bottom:4px"><i class="bi bi-tags-fill"></i> Serviços Contratados</div>
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
      ${subs.map(s=>`<div class="sub-row"><input type="checkbox" disabled ${s.done?'checked':''}><span class="${s.done?'sub-done':''}">${s.text}</span></div>`).join('')}
    </div>`;
  }

  const noteHtml=p.note?`<p style="font-size:12px;color:var(--text2);margin-top:7px;line-height:1.5;background:var(--surface2);padding:6px 8px;border-radius:6px">${p.note}</p>`:'';

  // Notificações não lidas para este projeto
  const dismissed=getNotifDismissed();
  const unreadNotifs=notifications.filter(n=>n.projectName===p.name&&!dismissed.includes(n.id)&&!n.read);
  const hasBell=unreadNotifs.length>0;

  return `<div class="kcard t-${p.type} ${dlClass}" data-id="${p.id}" onclick="togglePin(event,${p.id})" style="animation-delay:${cardIdx*0.04}s">
    ${subs.length?`<div class="kcard-prog-bar"><div class="kcard-prog-fill" style="width:${subPct}%;background:${progColor}"></div></div>`:''}
    ${p.image?`<img src="${p.image}" class="kcard-cover" onerror="this.style.display='none'">`:''}
    <div class="kcard-body">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
        <div class="kcard-name" style="flex:1">${p.name}</div>
        ${hasBell?`<button onclick="scrollToNotif(event,'${p.name}')" title="${unreadNotifs.length} aviso${unreadNotifs.length>1?'s':''} não lido${unreadNotifs.length>1?'s':''}" style="flex-shrink:0;position:relative;background:none;border:none;cursor:pointer;padding:2px 4px;color:var(--yellow)">
          <i class="bi bi-bell-fill" style="font-size:16px"></i>
          <span style="position:absolute;top:-2px;right:-2px;background:var(--red);color:#fff;font-size:9px;font-weight:700;border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;line-height:1">${unreadNotifs.length}</span>
        </button>`:''}
      </div>
      <div class="kcard-tags">
        ${p.column!=='Concluído'?`<span class="badge ${pMap[p.priority]||'b-baixa'}">${pIcon[p.priority]||'🟢'} ${p.priority}</span>`:''}
        <span class="badge b-t${p.type}">${p.type}</span>
        ${dl
          ?`<span class="badge ${dateCls||''}" style="margin-left:auto">${dl.toLocaleDateString('pt-BR')} ${dateBadge}</span>`
          :(total>0?`<span class="badge ${sClass}" style="margin-left:auto">${sLabel}</span>`:'')}
      </div>
    </div>
    <div class="kcard-exp">
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

document.addEventListener('DOMContentLoaded',loadData);
