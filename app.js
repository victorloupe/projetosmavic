// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
const INIT_COLS=[{id:'Briefing',icon:'📋'},{id:'Desenvolvimento',icon:'✏️'},{id:'Revisão',icon:'🔍'},{id:'Obra',icon:'🏗️'},{id:'Concluído',icon:'✅'}];
const QUICK_MSGS=[
  { title: "Andamento do Projeto", msg: "Projeto em andamento! Em breve temos novidades." },
  { title: "Aprovação Necessária", msg: "Precisamos de sua aprovação para avançar." },
  { title: "Documentos Pendentes", msg: "Documentos pendentes — por favor entre em contato." },
  { title: "Etapa Concluída", msg: "Etapa concluída com sucesso! ✅" },
  { title: "Pagamento Confirmado", msg: "Pagamento confirmado. Obrigado!" },
  { title: "Prazo Atualizado", msg: "Prazo atualizado. Verifique as datas no painel." }
];
let openGnIds = new Set();

let sb=null,projects=[],clients=[],appColumns=[...INIT_COLS];
let globalNotices=[];
let visibleColumns=INIT_COLS.map(c=>c.id),minimizedColumns=[],colSorts={};
let notifications=[],appTheme='light',currentView='board';
let tempSubs=[],tempPayments=[],tempProds=[];
let pinnedCards=new Set(),expandedFin=new Set();
let isDragging=false,currentCliId=null,notifyProjId=null;
let syncTimer=null,touchTimer=null,touchDragId=null,touchGhost=null;
window.CLIENT_PANEL_URL=localStorage.getItem('mavic_clientUrl')||'cliente.html';

// ══════════════════════════════════════════
//  SUPABASE
// ══════════════════════════════════════════
function initSupabase(){
  const url=SB_URL,key=SB_KEY;
  if(url&&key){sb=window.supabase.createClient(url,key);return true;}
  return false;
}
async function loadData(){
  if(!initSupabase()){loadLocal();return;}
  try{
    const{data,error}=await sb.from('mavic_store').select('key,data');
    if(error)throw error;
    const map={};(data||[]).forEach(r=>map[r.key]=r.data);
    projects=map.projects||[];clients=map.clients||[];notifications=map.notifications||[];
    globalNotices=map.global_notices||(map.global_notice?[map.global_notice]:[]);
    const cfg=map.config||{};
    appColumns=cfg.columns?.length?cfg.columns:INIT_COLS;
    visibleColumns=cfg.visibleColumns||appColumns.map(c=>c.id);
    minimizedColumns=cfg.minimizedColumns||[];
    appTheme=cfg.theme||localStorage.getItem('mavic_theme')||'light';
    applyTheme(appTheme);syncLocal();
  }catch(e){console.warn('Supabase load failed',e);loadLocal();showToast('Modo offline — dados locais','warning');}
}
function loadLocal(){
  projects=JSON.parse(localStorage.getItem('mavic_projects')||'[]');
  clients=JSON.parse(localStorage.getItem('mavic_clients')||'[]');
  notifications=JSON.parse(localStorage.getItem('mavic_notifications')||'[]');
  globalNotices=JSON.parse(localStorage.getItem('mavic_global_notices')||'[]');
  const cfg=JSON.parse(localStorage.getItem('mavic_config')||'{}');
  appColumns=cfg.columns?.length?cfg.columns:INIT_COLS;
  visibleColumns=cfg.visibleColumns||appColumns.map(c=>c.id);
  minimizedColumns=cfg.minimizedColumns||[];
  applyTheme(localStorage.getItem('mavic_theme')||'light');
}
function syncLocal(){
  localStorage.setItem('mavic_projects',JSON.stringify(projects));
  localStorage.setItem('mavic_clients',JSON.stringify(clients));
  localStorage.setItem('mavic_notifications',JSON.stringify(notifications));
  localStorage.setItem('mavic_global_notices',JSON.stringify(globalNotices));
  localStorage.setItem('mavic_config',JSON.stringify({columns:appColumns,visibleColumns,minimizedColumns}));
  localStorage.setItem('mavic_theme',appTheme);
}
function scheduleSync(){clearTimeout(syncTimer);syncTimer=setTimeout(syncCloud,900);}
async function syncCloud(){
  syncLocal();if(!sb){setSync('off');return;}
  setSync('sync');
  try{
    await sb.from('mavic_store').upsert([
      {key:'projects',data:projects},{key:'clients',data:clients},
      {key:'notifications',data:notifications},
      {key:'global_notices',data:globalNotices},
      {key:'config',data:{columns:appColumns,visibleColumns,minimizedColumns,theme:appTheme}}
    ],{onConflict:'key'});
    setSync('ok');
  }catch(e){setSync('off');}
}
function setSync(s){
  const el=document.getElementById('syncStatus');
  if(s==='ok'){el.className='nav-sync ok';el.innerHTML='<i class="bi bi-cloud-check-fill"></i> Sincronizado';}
  else if(s==='sync'){el.className='nav-sync sync';el.innerHTML='<i class="bi bi-arrow-repeat"></i> Sincronizando…';}
  else{el.className='nav-sync off';el.innerHTML='<i class="bi bi-cloud-slash-fill"></i> Offline';}
}

// ══════════════════════════════════════════
//  THEME / VIEW
// ══════════════════════════════════════════
function toggleTheme(){appTheme=appTheme==='light'?'dark':'light';applyTheme(appTheme);scheduleSync();}
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);appTheme=t;
  const btn=document.getElementById('themeBtn'),logo=document.getElementById('navLogo');
  if(t==='dark'){btn.innerHTML='<i class="bi bi-sun-fill" style="color:#fbbf24"></i>';if(logo)logo.src='https://i.postimg.cc/vZmmNLjj/LOGO-NOVA-black.png';}
  else{btn.innerHTML='<i class="bi bi-moon-stars-fill"></i>';if(logo)logo.src='LOGO NOVA.png';}
}
function setView(v){
  currentView=v;
  const bv=document.getElementById('boardView'),dv=document.getElementById('dashView');
  bv.style.display=v==='board'?'flex':'none';if(v==='board')bv.style.flexDirection='column';
  dv.classList.toggle('on',v==='dash');
  document.querySelectorAll('.nav-tab').forEach((t,i)=>t.classList.toggle('on',(i===0&&v==='board')||(i===1&&v==='dash')));
  if(v==='dash')renderDashboard();
}

// ══════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════
function showToast(msg,type='success'){
  const ic={success:'bi-check-circle-fill',warning:'bi-exclamation-circle-fill',error:'bi-x-circle-fill',info:'bi-info-circle-fill'};
  const cl={success:'var(--green)',warning:'var(--yellow)',error:'var(--red)',info:'var(--blue)'};
  const t=document.createElement('div');t.className='toast';
  t.innerHTML=`<i class="bi ${ic[type]||ic.success}" style="color:${cl[type]||cl.success}"></i><span>${msg}</span>`;
  document.getElementById('toastWrap').appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),400);},2800);
}

// ══════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════
function fmt(v){return parseFloat(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function today(){return new Date().toISOString().split('T')[0];}
const AVATAR_COLORS=['#e07b54','#5b8dd9','#8b5cf6','#059669','#d97706','#db2777','#0891b2','#65a30d','#dc2626','#7c3aed'];
function getClientColor(name){let h=0;for(let i=0;i<name.length;i++)h=name.charCodeAt(i)+((h<<5)-h);return AVATAR_COLORS[Math.abs(h)%AVATAR_COLORS.length];}
function getInitials(name){return(name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();}

// ══════════════════════════════════════════
//  BOARD
// ══════════════════════════════════════════
function renderBoard(){
  const board=document.getElementById('board');board.innerHTML='';
  const fType=document.getElementById('fType').value;
  const fPrio=document.getElementById('fPrio').value;
  const fCli=document.getElementById('fClient').value;
  const srch=document.getElementById('srch').value.toLowerCase().trim();
  let total=0;
  appColumns.filter(c=>visibleColumns.includes(c.id)).forEach(col=>{
    const isMin=minimizedColumns.includes(col.id);
    let colProjs=projects.filter(p=>!p.archived&&p.column===col.id&&(!fType||p.type===fType)&&(!fPrio||p.priority===fPrio)&&(!fCli||p.client===fCli)&&(!srch||p.name?.toLowerCase().includes(srch)||p.client?.toLowerCase().includes(srch)));
    colProjs=sortProjs(colProjs,col.id);total+=colProjs.length;
    const el=document.createElement('div');
    if(isMin){
      el.className='kcol-mini';el.onclick=()=>toggleMinimize(col.id);
      el.innerHTML=`<i class="bi bi-arrows-angle-expand" style="color:var(--text3);font-size:12px"></i><span class="mc">${colProjs.length}</span><div class="ml">${col.icon} ${col.id}</div>`;
    }else{
      const cur=colSorts[col.id]||'default';
      const sortLabels={default:'Padrão',priority:'Prioridade',deadline:'Prazo',value:'Valor',name:'Nome'};
      el.className='kcol';
      el.innerHTML=`<div class="kcol-hdr">
        <div class="kcol-title">${col.icon} ${col.id} <span class="kcol-cnt">${colProjs.length}</span></div>
        <div class="kcol-acts">
          <div style="position:relative">
            <button class="cbtn" title="Ordenar" onclick="toggleSortMenu('${col.id}');event.stopPropagation()"><i class="bi bi-sort-down-alt"></i></button>
            <div class="sort-menu" id="sort-${col.id}">
              ${['default','priority','deadline','value','name'].map(s=>`<button class="${cur===s?'on':''}" onclick="setColSort('${col.id}','${s}');event.stopPropagation()">${cur===s?'<i class="bi bi-check2 me-1"></i>':''} ${sortLabels[s]}</button>`).join('')}
            </div>
          </div>
          <button class="cbtn" title="Minimizar" onclick="toggleMinimize('${col.id}');event.stopPropagation()"><i class="bi bi-dash"></i></button>
        </div>
      </div>
      <div class="kdrop" data-column="${col.id}">
        ${colProjs.map((p,i)=>createCardHTML(p,i)).join('')}
        ${!colProjs.length?'<div class="kempty">Arraste projetos aqui</div>':''}
      </div>`;
    }
    board.appendChild(el);
  });
  document.getElementById('boardCount').textContent=`${total} projeto${total!==1?'s':''}`;
  setupDragDrop();
  pinnedCards.forEach(id=>{const el=board.querySelector(`.kcard[data-id="${id}"]`);if(el)el.classList.add('pinned');});
}

function sortProjs(arr,colId){
  const s=colSorts[colId]||'default';const a=[...arr];
  if(s==='priority'){const o={Alta:0,Média:1,Baixa:2};a.sort((x,y)=>(o[x.priority]??1)-(o[y.priority]??1));}
  else if(s==='deadline'){a.sort((x,y)=>{if(!x.date)return 1;if(!y.date)return -1;return new Date(x.date)-new Date(y.date);});}
  else if(s==='value'){a.sort((x,y)=>parseFloat(y.value||0)-parseFloat(x.value||0));}
  else if(s==='name'){a.sort((x,y)=>x.name?.localeCompare(y.name));}
  return a;
}
function setColSort(colId,s){colSorts[colId]=s;renderBoard();}
function toggleSortMenu(colId){
  const m=document.getElementById('sort-'+colId);if(!m)return;
  const was=m.classList.contains('open');
  document.querySelectorAll('.sort-menu').forEach(x=>x.classList.remove('open'));
  if(!was)m.classList.add('open');
}

// ══════════════════════════════════════════
//  CARD HTML
// ══════════════════════════════════════════
function createCardHTML(p, cardIdx=0){
  const pays=Array.isArray(p.payments)?p.payments:[];
  const total=parseFloat(p.value||0);
  const paid=pays.reduce((s,x)=>s+parseFloat(x.amount||0),0);
  const rest=total-paid;
  const dl=p.date?new Date(p.date+'T12:00:00'):null;
  const diff=dl?Math.ceil((dl-new Date().setHours(0,0,0,0))/86400000):null;
  let dateCls='',dateBadge='';
  if(dl){if(diff<0){dateCls='date-vencido';dateBadge='<span class="badge b-venc">Vencido</span>';}else if(diff<=7){dateCls='date-urgente';dateBadge=`<span class="badge b-urg">${diff}d</span>`;}}
  const dlClass=diff===null?'':(diff<0?'dl-overdue':diff<=7?'dl-urgent':'');
  const pMap={Alta:'b-alta',Média:'b-media',Baixa:'b-baixa'};
  const pIcon={Alta:'🔴',Média:'🟡',Baixa:'🟢'};
  let sClass='',sLabel='';
  if(total>0){if(rest<=0){sClass='b-pago';sLabel='✓ Pago';}else if(paid>0){sClass='b-parcial';sLabel='Parcial';}else{sClass='b-pendente';sLabel='Pendente';}}
  // Avatar
  const avatarColor=getClientColor(p.client||'?');
  const initials=getInitials(p.client||'?');
  // Progresso checklist
  const subs=p.subtasks||[];
  const subDone=subs.filter(s=>s.done).length;
  const subPct=subs.length?Math.round((subDone/subs.length)*100):0;
  const progColor=subPct===100?'var(--green)':subPct>0?'var(--accent)':'transparent';
  const isExp=expandedFin.has(p.id);
  let finHtml='';
  if(total>0){
    const hRows=pays.length?pays.map(pg=>`<div class="fin-hist-item"><span style="color:var(--text3);font-size:11px"><i class="bi bi-calendar3"></i> ${pg.date?new Date(pg.date+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</span><span class="fv">+${fmt(pg.amount)}</span></div>`).join(''):'<div class="fin-hist-item" style="color:var(--text3);justify-content:center;font-size:12px">Sem pagamentos</div>';
    finHtml=`<div class="fin-blk"><div class="fin-sum"><div class="fin-row"><span class="lbl">Contrato</span><span class="val">${fmt(total)}</span></div><div class="fin-row"><span class="lbl">Recebido</span><span class="val" style="color:var(--green)">${fmt(paid)}</span></div><div class="fin-row" style="border-top:1px solid var(--border);padding-top:3px;margin-top:2px"><span class="lbl">Saldo</span><span class="val" style="color:${rest>0?'var(--red)':'var(--text3)'}">${fmt(rest)} <span class="badge ${sClass}" style="font-size:10px">${sLabel}</span></span></div></div><button class="fin-hist-btn" onclick="toggleFinHist(${p.id});event.stopPropagation()"><i class="bi bi-clock-history"></i> ${pays.length} pagamento${pays.length!==1?'s':''} <i class="bi bi-chevron-${isExp?'up':'down'}" style="float:right;margin-top:1px;font-size:10px"></i></button><div class="fin-hist-rows ${isExp?'':'d-none'}">${hRows}</div></div>`;
  }
  let checkHtml='';
  if(subs.length){
    const rows=subs.map(s=>`<div class="sub-row"><input type="checkbox" ${s.done?'checked':''} onclick="toggleSub(${p.id},${s.id});event.stopPropagation()"><span class="${s.done?'sub-done':''}">${s.text}</span></div>`).join('');
    checkHtml=`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-top:7px"><div style="padding:5px 8px;display:flex;justify-content:space-between;font-size:12px;font-weight:600"><span><i class="bi bi-ui-checks"></i> Andamento</span><span style="font-family:'Courier New',monospace">${subDone}/${subs.length}</span></div><div class="prog" style="margin:0 8px 6px"><div class="prog-fill ${subPct===100?'done':''}" style="width:${subPct}%"></div></div>${rows}</div>`;
  }
  const noteHtml=p.note?`<p style="font-size:12px;color:var(--text2);margin-top:7px;line-height:1.5;background:var(--surface2);padding:6px 8px;border-radius:6px">${p.note}</p>`:'';
  return `<div class="kcard t-${p.type} ${dlClass}" data-id="${p.id}" draggable="true" onclick="togglePin(event,${p.id})" style="animation-delay:${cardIdx*0.04}s">
    ${subs.length?`<div class="kcard-prog-bar"><div class="kcard-prog-fill" style="width:${subPct}%;background:${progColor}"></div></div>`:''}
    ${p.image?`<img src="${p.image}" class="kcard-cover" onerror="this.style.display='none'">`:''}
    <div class="kcard-body">
      <div class="kcard-name">${p.name}</div>
      ${p.client?`<div class="kcard-client"><span class="kcard-avatar" style="background:${avatarColor}">${initials}</span>${p.client}</div>`:''}
      <div class="kcard-tags">
        ${p.column!=='Concluído'?`<span class="badge ${pMap[p.priority]||'b-baixa'}">${pIcon[p.priority]||'🟢'} ${p.priority}</span>`:''}
        <span class="badge b-t${p.type}">${p.type}</span>
        ${total>0?`<span class="badge ${sClass}" style="margin-left:auto">${sLabel}</span>`:''}
      </div>
    </div>
    <div class="kcard-exp">
      ${dl?`<div style="font-size:12px;margin-bottom:6px;display:flex;align-items:center;gap:6px" class="${dateCls}"><i class="bi bi-calendar3"></i>${dl.toLocaleDateString('pt-BR')} ${dateBadge}</div>`:''}
      ${finHtml}${checkHtml}${noteHtml}
      <div class="cact">
        <button class="cbtn ntf" onclick="openNotifyModal(${p.id});event.stopPropagation()" title="Notificar cliente"><i class="bi bi-bell"></i></button>
        <button class="cbtn" style="color:#25D366" onclick="openWhatsApp(${p.id});event.stopPropagation()" title="Enviar WhatsApp"><i class="bi bi-whatsapp"></i></button>
        <button class="cbtn shr" onclick="shareLink(${p.id});event.stopPropagation()" title="Link do cliente"><i class="bi bi-share"></i></button>
        <button class="cbtn" onclick="editProject(${p.id});event.stopPropagation()" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="cbtn arc" onclick="archiveProject(${p.id});event.stopPropagation()" title="Arquivar"><i class="bi bi-archive"></i></button>
        <button class="cbtn del" onclick="deleteProject(${p.id});event.stopPropagation()" title="Excluir"><i class="bi bi-trash3"></i></button>
        <button class="cbtn" style="margin-left:auto;color:var(--accent)" onclick="moveNext(${p.id});event.stopPropagation()" title="Avançar etapa"><i class="bi bi-arrow-right-circle-fill"></i></button>
      </div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════
//  PIN / SUBTASK / FIN
// ══════════════════════════════════════════
function togglePin(e,id){
  if(isDragging)return;
  if(e.target.closest('.cbtn')||e.target.closest('input'))return;
  const card=e.currentTarget;
  if(pinnedCards.has(id)){pinnedCards.delete(id);card.classList.remove('pinned');}
  else{pinnedCards.add(id);card.classList.add('pinned');}
}
function toggleFinHist(id){if(expandedFin.has(id))expandedFin.delete(id);else expandedFin.add(id);renderBoard();}
function toggleSub(pId,sId){const p=projects.find(x=>x.id===pId);if(!p)return;const s=p.subtasks?.find(x=>x.id===sId);if(s){s.done=!s.done;renderBoard();scheduleSync();}}

// ══════════════════════════════════════════
//  DRAG & DROP (MOUSE)
// ══════════════════════════════════════════
function setupDragDrop(){
  document.querySelectorAll('.kcard[draggable]').forEach(card=>{
    card.addEventListener('dragstart',e=>{isDragging=true;e.dataTransfer.setData('text/plain',card.dataset.id);setTimeout(()=>card.classList.add('dragging'),0);});
    card.addEventListener('dragend',()=>{card.classList.remove('dragging');setTimeout(()=>isDragging=false,50);});
  });
  document.querySelectorAll('.kdrop').forEach(zone=>{
    zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('drop-over');});
    zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('drop-over');});
    zone.addEventListener('drop',e=>{
      e.preventDefault();zone.classList.remove('drop-over');
      const id=parseInt(e.dataTransfer.getData('text/plain'));const col=zone.dataset.column;
      const idx=projects.findIndex(p=>p.id===id);
      if(idx>-1&&projects[idx].column!==col){projects[idx].column=col;renderBoard();scheduleSync();showToast(`Movido para ${col}`,'info');}
    });
  });
  setupTouchDrag();
}

// ══════════════════════════════════════════
//  TOUCH DRAG
// ══════════════════════════════════════════
function setupTouchDrag(){
  document.querySelectorAll('.kcard[draggable]').forEach(card=>{
    card.addEventListener('touchstart',e=>{
      const touch=e.touches[0];
      touchTimer=setTimeout(()=>{
        touchDragId=card.dataset.id;navigator.vibrate?.(30);
        const r=card.getBoundingClientRect();
        touchGhost=card.cloneNode(true);
        Object.assign(touchGhost.style,{position:'fixed',opacity:'0.8',pointerEvents:'none',zIndex:'9999',width:r.width+'px',left:(touch.clientX-r.width/2)+'px',top:(touch.clientY-24)+'px',transform:'rotate(2deg)',boxShadow:'0 8px 32px rgba(0,0,0,.2)',borderRadius:'10px'});
        document.body.appendChild(touchGhost);card.classList.add('dragging');
      },400);
    },{passive:true});
    card.addEventListener('touchmove',e=>{
      clearTimeout(touchTimer);if(!touchDragId)return;e.preventDefault();
      const touch=e.touches[0];
      if(touchGhost){touchGhost.style.left=(touch.clientX-parseInt(touchGhost.style.width)/2)+'px';touchGhost.style.top=(touch.clientY-24)+'px';}
      if(touchGhost)touchGhost.style.display='none';
      const el=document.elementFromPoint(touch.clientX,touch.clientY);
      if(touchGhost)touchGhost.style.display='';
      document.querySelectorAll('.kdrop').forEach(z=>z.classList.remove('drop-over'));
      el?.closest('.kdrop')?.classList.add('drop-over');
    },{passive:false});
    card.addEventListener('touchend',e=>{
      clearTimeout(touchTimer);if(!touchDragId)return;
      const touch=e.changedTouches[0];
      if(touchGhost){touchGhost.style.display='none';}
      const el=document.elementFromPoint(touch.clientX,touch.clientY);
      if(touchGhost){touchGhost.remove();touchGhost=null;}
      document.querySelectorAll('.kdrop').forEach(z=>z.classList.remove('drop-over'));
      const zone=el?.closest('.kdrop');
      if(zone){
        const col=zone.dataset.column,id=parseInt(touchDragId);
        const idx=projects.findIndex(p=>p.id===id);
        if(idx>-1&&projects[idx].column!==col){projects[idx].column=col;renderBoard();scheduleSync();showToast(`Movido para ${col}`,'info');}
      }
      document.querySelector(`.kcard[data-id="${touchDragId}"]`)?.classList.remove('dragging');
      touchDragId=null;
    });
    card.addEventListener('touchcancel',()=>{
      clearTimeout(touchTimer);if(touchGhost){touchGhost.remove();touchGhost=null;}
      if(touchDragId)document.querySelector(`.kcard[data-id="${touchDragId}"]`)?.classList.remove('dragging');
      touchDragId=null;document.querySelectorAll('.kdrop').forEach(z=>z.classList.remove('drop-over'));
    });
  });
}

// ══════════════════════════════════════════
//  COLUMN MENU
// ══════════════════════════════════════════
function toggleColsMenu(){const m=document.getElementById('colsMenu');m.classList.toggle('open');renderColMenu();}
function closeColsMenu(){document.getElementById('colsMenu').classList.remove('open');}
function renderColMenu(){
  document.getElementById('colMenuItems').innerHTML=appColumns.map(c=>`<button onclick="toggleVisible('${c.id}');event.stopPropagation()" style="${visibleColumns.includes(c.id)?'font-weight:600':''}">${visibleColumns.includes(c.id)?'<i class="bi bi-check2"></i>':'<i class="bi bi-dash" style="opacity:.3"></i>'} ${c.icon} ${c.id}</button>`).join('');
}
function toggleVisible(id){
  if(visibleColumns.includes(id)){if(visibleColumns.length<=1)return showToast('Ao menos uma coluna!','warning');visibleColumns=visibleColumns.filter(x=>x!==id);minimizedColumns=minimizedColumns.filter(x=>x!==id);}
  else visibleColumns.push(id);
  renderBoard();scheduleSync();renderColMenu();
}
function toggleMinimize(id){
  if(minimizedColumns.includes(id))minimizedColumns=minimizedColumns.filter(x=>x!==id);else minimizedColumns.push(id);
  renderBoard();scheduleSync();
}

// ══════════════════════════════════════════
//  IMAGE UPLOAD
// ══════════════════════════════════════════
async function handleImageUpload(input){
  const file=input.files[0];if(!file)return;
  const status=document.getElementById('imgUploadStatus');
  const reader=new FileReader();
  reader.onload=e=>setImagePreview(e.target.result,false);
  reader.readAsDataURL(file);
  if(!sb){showToast('Sem conexão ao Supabase','error');return;}
  status.style.display='block';
  status.innerHTML='<i class="bi bi-arrow-repeat" style="animation:rot .75s linear infinite;display:inline-block"></i> Enviando imagem…';
  status.style.color='var(--accent)';
  try{
    const ext=file.name.split('.').pop().toLowerCase();
    const path=`projects/${Date.now()}.${ext}`;
    const{error}=await sb.storage.from('mavic-images').upload(path,file,{upsert:true,contentType:file.type});
    if(error)throw error;
    const{data:urlData}=sb.storage.from('mavic-images').getPublicUrl(path);
    document.getElementById('projImage').value=urlData.publicUrl;
    setImagePreview(urlData.publicUrl,false);
    status.innerHTML='<i class="bi bi-check-circle-fill" style="color:var(--green)"></i> Imagem enviada!';
    status.style.color='var(--green)';
    setTimeout(()=>{status.style.display='none';},2500);
    showToast('Imagem enviada!','success');
  }catch(e){
    console.error(e);
    status.innerHTML='<i class="bi bi-x-circle-fill" style="color:var(--red)"></i> Erro: '+e.message;
    status.style.color='var(--red)';
    showToast('Erro no upload','error');
  }
}
function setImagePreview(src, updateInput=true){
  if(updateInput) document.getElementById('projImage').value=src;
  document.getElementById('imgPreview').src=src;
  document.getElementById('imgPreviewWrap').style.display='block';
  document.getElementById('imgPickerLabel').style.display='flex';
  document.getElementById('imgPickerText').textContent='Trocar imagem…';
}
function removeImage(){
  document.getElementById('projImage').value='';
  document.getElementById('imgPreview').src='';
  document.getElementById('imgPreviewWrap').style.display='none';
  document.getElementById('imgPickerLabel').style.display='flex';
  document.getElementById('imgPickerText').textContent='Clique para escolher uma imagem…';
  document.getElementById('imgUploadStatus').style.display='none';
  document.getElementById('projImageFile').value='';
}
function resetImageField(){removeImage();}

// ══════════════════════════════════════════
//  PROJECT MODAL
// ══════════════════════════════════════════
function openProjectModal(editId=null){
  ['projId','projName','projImage','projDate','projNote'].forEach(i=>document.getElementById(i).value='');
  resetImageField();
  document.getElementById('projValue').value='';document.getElementById('projClient').value='';
  document.getElementById('projModalTitle').textContent='Novo Projeto';
  ['clientProdWrap','custProdWrap','addProdWrap','clientLinkWrap'].forEach(i=>document.getElementById(i).classList.add('d-none'));
  tempSubs=[];tempPayments=[];tempProds=[];
  renderSubsList();renderPaymentsModal();renderProjProdsList();
  updateProjClientSelect();updateProjColSelect();
  document.getElementById('pgDate').value=today();
  if(editId){
    const p=projects.find(x=>x.id===editId);if(!p)return;
    document.getElementById('projId').value=p.id;
    document.getElementById('projClient').value=p.client||';';
    document.getElementById('projName').value=p.name;
    document.getElementById('projModalTitle').textContent=p.name;
    document.getElementById('projImage').value=p.image||'';
    if(p.image){setImagePreview(p.image,false);}else{resetImageField();}
    document.getElementById('projValue').value=p.value||'';
    document.getElementById('projDate').value=p.date||'';
    document.getElementById('projNote').value=p.note||'';
    document.getElementById('projType').value=p.type||'Residencial';
    document.getElementById('projPrio').value=p.priority||'Média';
    document.getElementById('projCol').value=p.column;
    tempSubs=p.subtasks?JSON.parse(JSON.stringify(p.subtasks)):[];
    tempPayments=p.payments?JSON.parse(JSON.stringify(p.payments)):[];
    tempProds=p.products?JSON.parse(JSON.stringify(p.products)):[];
    renderSubsList();renderPaymentsModal();renderProjProdsList();
    handleClientChange();
  }
  document.getElementById('projectOverlay').classList.add('open');
}
function closeProjectModal(){document.getElementById('projectOverlay').classList.remove('open');}
function editProject(id){openProjectModal(id);}

function handleClientChange(){
  const name=document.getElementById('projClient').value;
  const cli=clients.find(c=>c.name===name);
  const ps=document.getElementById('projClientProd');
  ps.innerHTML='<option value="">Produto da tabela (opcional)…</option>';
  if(cli?.products?.length){document.getElementById('clientProdWrap').classList.remove('d-none');cli.products.forEach(p=>ps.innerHTML+=`<option value="${p.price}" data-name="${p.name}">${p.name} (${fmt(p.price)})</option>`);}
  else document.getElementById('clientProdWrap').classList.add('d-none');
  if(name){
    document.getElementById('custProdWrap').classList.remove('d-none');
    document.getElementById('addProdWrap').classList.remove('d-none');
    if(cli){if(!cli.token){cli.token=genTokenStr();scheduleSync();}document.getElementById('clientLinkPreview').textContent=buildLink(cli.name,cli.token);document.getElementById('clientLinkWrap').classList.remove('d-none');}
  }else{['custProdWrap','addProdWrap','clientLinkWrap'].forEach(i=>document.getElementById(i).classList.add('d-none'));}
}
function applyClientProd(){
  const sel=document.getElementById('projClientProd');
  if(sel.selectedIndex>0){const opt=sel.options[sel.selectedIndex];document.getElementById('custProdName').value=opt.dataset.name||'';document.getElementById('custProdPrice').value=parseFloat(sel.value).toFixed(2);}
}
function addProdToProj(){
  const n=document.getElementById('custProdName').value.trim();const pr=parseFloat(document.getElementById('custProdPrice').value);
  if(!n)return showToast('Preencha o nome','warning');if(!pr||pr<=0)return showToast('Preencha o valor','warning');
  tempProds.push({id:Date.now(),name:n,price:pr});
  document.getElementById('custProdName').value='';document.getElementById('custProdPrice').value='';document.getElementById('projClientProd').value='';
  renderProjProdsList();recalcTotal();showToast('Serviço adicionado','success');
}
function removeProd(id){tempProds=tempProds.filter(x=>x.id!==id);renderProjProdsList();recalcTotal();}
function recalcTotal(){const t=tempProds.reduce((s,x)=>s+parseFloat(x.price||0),0);document.getElementById('projValue').value=t.toFixed(2);renderPaymentsModal();}
function renderProjProdsList(){
  const c=document.getElementById('projProdsList');
  if(!tempProds.length){c.style.display='none';c.innerHTML='';return;}
  c.style.display='block';
  c.innerHTML=tempProds.map(p=>`<div class="prod-row"><span style="font-weight:600;font-size:12.5px">${p.name}</span><span style="font-weight:700;color:var(--green);font-family:'Courier New',monospace;font-size:12px">${fmt(p.price)}</span><button class="prod-del" onclick="removeProd(${p.id})"><i class="bi bi-x-lg"></i></button></div>`).join('');
}
function updateProjClientSelect(){
  const sel=document.getElementById('projClient'),cur=sel.value;
  sel.innerHTML='<option value="">Selecione…</option>'+clients.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
  if(cur)sel.value=cur;
}
function updateProjColSelect(){document.getElementById('projCol').innerHTML=appColumns.map(c=>`<option value="${c.id}">${c.id}</option>`).join('');}
function updateClientFilter(){
  const sel=document.getElementById('fClient'),cur=sel.value;
  sel.innerHTML='<option value="">Todos os Clientes</option>'+clients.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
  if(cur)sel.value=cur;
}
function saveProject(){
  const name=document.getElementById('projName').value.trim();const client=document.getElementById('projClient').value;
  if(!name||!client)return showToast('Cliente e Nome são obrigatórios','warning');
  const id=document.getElementById('projId').value;
  const pData={id:id?parseInt(id):Date.now(),name,client,image:document.getElementById('projImage').value.trim(),value:document.getElementById('projValue').value,payments:tempPayments,paid:tempPayments.reduce((s,x)=>s+parseFloat(x.amount||0),0),products:tempProds,product:tempProds.map(x=>x.name).join(', '),type:document.getElementById('projType').value,priority:document.getElementById('projPrio').value,column:document.getElementById('projCol').value,date:document.getElementById('projDate').value,note:document.getElementById('projNote').value,subtasks:tempSubs,archived:false,createdAt:id?(projects.find(x=>x.id===parseInt(id))?.createdAt||Date.now()):Date.now()};
  if(id){const idx=projects.findIndex(x=>x.id===parseInt(id));pData.archived=projects[idx]?.archived||false;projects[idx]=pData;showToast('Projeto atualizado!','success');}
  else{projects.push(pData);showToast('Projeto criado!','success');}
  renderBoard();closeProjectModal();scheduleSync();
}
function archiveProject(id){const idx=projects.findIndex(p=>p.id===id);if(idx>-1){projects[idx].archived=true;renderBoard();scheduleSync();showToast('Arquivado','info');}}
function restoreProject(id){const idx=projects.findIndex(p=>p.id===id);if(idx>-1){projects[idx].archived=false;renderBoard();renderArchived();scheduleSync();showToast('Restaurado!','success');}}
function deleteProject(id,fromArch=false){
  if(!confirm('Excluir definitivamente?'))return;
  projects=projects.filter(p=>p.id!==id);pinnedCards.delete(id);expandedFin.delete(id);
  if(fromArch)renderArchived();renderBoard();scheduleSync();showToast('Excluído','info');
}

// ══════════════════════════════════════════
//  SUBTASKS
// ══════════════════════════════════════════
function renderSubsList(){
  const c=document.getElementById('subsContainer');const done=tempSubs.filter(s=>s.done).length;
  document.getElementById('subProgress').textContent=`${done}/${tempSubs.length}`;
  if(!tempSubs.length){c.innerHTML='<div style="padding:12px;text-align:center;color:var(--text3);font-size:12px">Nenhuma tarefa</div>';return;}
  c.innerHTML=tempSubs.map(s=>`<div class="sub-row"><input type="checkbox" ${s.done?'checked':''} onchange="toggleTmpSub(${s.id})"><span class="${s.done?'sub-done':''}" style="flex:1;font-size:12.5px">${s.text}</span><button class="prod-del" onclick="delSub(${s.id})"><i class="bi bi-x"></i></button></div>`).join('');
}
function addSubtask(){const inp=document.getElementById('newSub');const t=inp.value.trim();if(!t)return;tempSubs.push({id:Date.now(),text:t,done:false});inp.value='';renderSubsList();}
function toggleTmpSub(id){const s=tempSubs.find(x=>x.id===id);if(s){s.done=!s.done;renderSubsList();}}
function delSub(id){tempSubs=tempSubs.filter(x=>x.id!==id);renderSubsList();}

// ══════════════════════════════════════════
//  PAYMENTS
// ══════════════════════════════════════════
function renderPaymentsModal(){
  const c=document.getElementById('paymentsContainer');
  const total=parseFloat(document.getElementById('projValue').value||0);
  const paid=tempPayments.reduce((s,x)=>s+parseFloat(x.amount||0),0);const rest=total-paid;
  document.getElementById('pagoLbl').textContent=`Pago: ${fmt(paid)}`;
  const rl=document.getElementById('restLbl');rl.textContent=`Restante: ${fmt(rest)}`;rl.style.color=rest>0?'var(--red)':'var(--green)';
  if(!tempPayments.length){c.innerHTML='<div style="padding:12px;text-align:center;color:var(--text3);font-size:12px">Nenhum pagamento</div>';return;}
  c.innerHTML=[...tempPayments].reverse().map(pg=>`<div class="pay-row"><span class="pay-dt"><i class="bi bi-calendar3"></i> ${pg.date?new Date(pg.date+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</span><span class="pay-val">+${fmt(pg.amount)}</span><button class="pay-del" onclick="delPayment(${pg.id})"><i class="bi bi-x-lg"></i></button></div>`).join('');
}
function addPayment(){
  const val=parseFloat(document.getElementById('pgVal').value);const dt=document.getElementById('pgDate').value;
  if(!val||val<=0)return showToast('Valor inválido','warning');if(!dt)return showToast('Informe a data','warning');
  tempPayments.push({id:Date.now(),amount:val,date:dt});document.getElementById('pgVal').value='';document.getElementById('pgDate').value=today();
  renderPaymentsModal();showToast('Pagamento registrado!','success');
}
function delPayment(id){tempPayments=tempPayments.filter(x=>x.id!==id);renderPaymentsModal();}

// ══════════════════════════════════════════
//  CLIENTS / CRM
// ══════════════════════════════════════════
function openClientsModal(){renderCliList();document.getElementById('cliDetail').classList.add('d-none');document.getElementById('cliPlaceholder').style.display='flex';currentCliId=null;document.getElementById('clientsOverlay').classList.add('open');}
function closeClientsModal(){document.getElementById('clientsOverlay').classList.remove('open');}
function renderCliList(){
  const el=document.getElementById('cliList');
  if(!clients.length){el.innerHTML='<div style="font-size:13px;color:var(--text3);padding:8px">Nenhum cliente</div>';return;}
  el.innerHTML=clients.map(c=>`<div class="cli-item ${currentCliId===c.id?'on':''}" onclick="selectClient(${c.id})"><span><i class="bi bi-person"></i> ${c.name}</span><span style="font-size:11px;color:var(--text3)">${c.products?.length||0} itens</span></div>`).join('');
}
function createClient(){
  const inp=document.getElementById('newCliName'),name=inp.value.trim();
  if(!name)return showToast('Digite o nome','warning');
  if(clients.find(c=>c.name.toLowerCase()===name.toLowerCase()))return showToast('Cliente já existe','warning');
  const cl={id:Date.now(),name,products:[],token:genTokenStr()};clients.push(cl);inp.value='';
  renderCliList();selectClient(cl.id);scheduleSync();showToast('Cliente cadastrado!','success');
  updateProjClientSelect();updateClientFilter();
}
function selectClient(id){
  currentCliId=id;const cl=clients.find(x=>x.id===id);if(!cl)return;
  if(!cl.token){cl.token=genTokenStr();scheduleSync();}
  document.getElementById('cliDetail').classList.remove('d-none');document.getElementById('cliPlaceholder').style.display='none';
  document.getElementById('cliDetailName').textContent=cl.name;document.getElementById('cliToken').value=cl.token;
  document.getElementById('cliPhone').value=cl.phone||'';
  document.getElementById('cliAddress').value=cl.address||'';
  document.getElementById('tokenOkMsg').classList.add('d-none');
  document.getElementById('contactOkMsg').classList.add('d-none');
  updateCliLink(cl);renderCliProductsTable(cl);renderCliList();
  document.getElementById('cliDeleteBtn').onclick=()=>{
    if(!confirm(`Remover "${cl.name}"?`))return;clients=clients.filter(x=>x.id!==id);
    openClientsModal();scheduleSync();showToast('Cliente removido','info');updateProjClientSelect();updateClientFilter();
  };
}
function updateCliLink(cl){document.getElementById('cliLinkBox').textContent=cl.token?buildLink(cl.name,cl.token):'⚠️ Defina um token';}
function saveClientContact(){
  const cl=clients.find(x=>x.id===currentCliId);if(!cl)return;
  cl.phone=document.getElementById('cliPhone').value.trim();
  cl.address=document.getElementById('cliAddress').value.trim();
  scheduleSync();
  const ok=document.getElementById('contactOkMsg');ok.classList.remove('d-none');
  setTimeout(()=>ok.classList.add('d-none'),2500);
  showToast('Contato salvo!','success');
}
function saveToken(){
  const cl=clients.find(x=>x.id===currentCliId);if(!cl)return;
  const t=document.getElementById('cliToken').value.trim();if(!t)return showToast('Digite o token','warning');
  if(/[\s&?#]/.test(t))return showToast('Sem espaços ou & ? #','warning');
  cl.token=t;updateCliLink(cl);renderCliList();
  document.getElementById('tokenOkMsg').classList.remove('d-none');setTimeout(()=>document.getElementById('tokenOkMsg').classList.add('d-none'),3000);
  scheduleSync();showToast('Token salvo!','success');
}
function genToken(){document.getElementById('cliToken').value=genTokenStr();showToast('Gere e clique em Salvar','info');}
function genTokenStr(){return Math.random().toString(36).substring(2,10)+Math.random().toString(36).substring(2,6);}
function copyCliLink(){copyText(document.getElementById('cliLinkBox').textContent,'Link copiado!');}
function buildLink(name,token){return `${window.CLIENT_PANEL_URL}?nome=${encodeURIComponent(name)}&token=${token}`;}
function renderCliProductsTable(cl,editingId=null){
  const tb=document.getElementById('cliProdTable');
  if(!cl.products?.length){tb.innerHTML='<tr><td colspan="4" style="padding:14px;text-align:center;color:var(--text3);font-size:13px">Tabela vazia</td></tr>';return;}
  tb.innerHTML=cl.products.map(p=>{
    if(p.id===editingId){
      return `<tr style="background:var(--accent-bg)">
        <td style="padding:5px 8px"><input id="epName_${p.id}" class="inp inp-sm" value="${p.name}" style="width:100%"></td>
        <td style="padding:5px 8px"><input id="epPrice_${p.id}" type="number" class="inp inp-sm" value="${p.price}" step="0.01" style="width:90px"></td>
        <td style="padding:5px 8px;text-align:right;white-space:nowrap">
          <button class="btn btn-primary btn-sm" onclick="saveProdEdit(${p.id})"><i class="bi bi-check2"></i></button>
          <button class="prod-del" onclick="renderCliProductsTable(clients.find(x=>x.id===currentCliId))"><i class="bi bi-x-lg"></i></button>
        </td>
      </tr>`;
    }
    return `<tr>
      <td style="padding:7px 10px;font-size:13px;font-weight:500">${p.name}</td>
      <td style="padding:7px 10px;font-family:'Courier New',monospace;font-weight:700;color:var(--green)">${fmt(p.price)}</td>
      <td style="padding:7px 10px;text-align:right;white-space:nowrap">
        <button class="prod-del" onclick="editProdCli(${p.id})" title="Editar"><i class="bi bi-pencil" style="font-size:12px"></i></button>
        <button class="prod-del" onclick="removeProdFromCli(${p.id})" title="Excluir"><i class="bi bi-trash" style="font-size:12px"></i></button>
      </td>
    </tr>`;
  }).join('');
}
function editProdCli(id){
  const cl=clients.find(x=>x.id===currentCliId);if(!cl)return;
  renderCliProductsTable(cl,id);
  setTimeout(()=>document.getElementById('epName_'+id)?.focus(),50);
}
function saveProdEdit(id){
  const cl=clients.find(x=>x.id===currentCliId);if(!cl)return;
  const p=cl.products.find(x=>x.id===id);if(!p)return;
  const newName=document.getElementById('epName_'+id)?.value.trim();
  const newPrice=parseFloat(document.getElementById('epPrice_'+id)?.value);
  if(!newName)return showToast('Nome não pode ser vazio','warning');
  if(isNaN(newPrice)||newPrice<0)return showToast('Preço inválido','warning');
  p.name=newName;p.price=newPrice;
  renderCliProductsTable(cl);renderCliList();scheduleSync();showToast('Serviço atualizado!','success');
}
function addProdToCli(){
  const n=document.getElementById('newProdName').value.trim(),pr=parseFloat(document.getElementById('newProdPrice').value);
  if(!n||isNaN(pr))return showToast('Preencha nome e preço','warning');
  const cl=clients.find(x=>x.id===currentCliId);if(!cl)return;
  if(!cl.products)cl.products=[];cl.products.push({id:Date.now(),name:n,price:pr});
  document.getElementById('newProdName').value='';document.getElementById('newProdPrice').value='';
  renderCliProductsTable(cl);renderCliList();scheduleSync();showToast('Item adicionado!','success');
}
function removeProdFromCli(id){const cl=clients.find(x=>x.id===currentCliId);if(!cl)return;cl.products=cl.products.filter(p=>p.id!==id);renderCliProductsTable(cl);renderCliList();scheduleSync();}

// ══════════════════════════════════════════
//  ARCHIVE
// ══════════════════════════════════════════
function openArchiveModal(){renderArchived();document.getElementById('archiveOverlay').classList.add('open');}
function closeArchiveModal(){document.getElementById('archiveOverlay').classList.remove('open');}
function renderArchived(){
  const el=document.getElementById('archiveList'),arch=projects.filter(p=>p.archived);
  if(!arch.length){el.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3)">Nenhum projeto arquivado</div>';return;}
  el.innerHTML=arch.map(p=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border)"><div><div style="font-weight:600;font-size:13.5px">${p.name}</div><div style="font-size:12px;color:var(--text2)">${p.client} · ${p.column}</div></div><div style="display:flex;gap:7px"><button class="btn btn-ghost btn-sm" onclick="restoreProject(${p.id})"><i class="bi bi-arrow-counterclockwise"></i></button><button class="btn btn-danger btn-sm" onclick="deleteProject(${p.id},true)"><i class="bi bi-trash3"></i></button></div></div>`).join('');
}

// ══════════════════════════════════════════
//  MANAGE COLUMNS
// ══════════════════════════════════════════
function openManageColumnsModal(){
  document.getElementById('colManagerList').innerHTML=appColumns.map(c=>`<div class="cm-row" data-orig="${c.id}"><input class="inp inp-sm" value="${c.icon}" style="width:44px;text-align:center"><input class="inp inp-sm" value="${c.id}" style="flex:1"><button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><i class="bi bi-trash"></i></button></div>`).join('');
  document.getElementById('colsOverlay').classList.add('open');
}
function closeManageColumnsModal(){document.getElementById('colsOverlay').classList.remove('open');}
function addColInput(){document.getElementById('colManagerList').innerHTML+=`<div class="cm-row" data-orig=""><input class="inp inp-sm" value="📁" style="width:44px;text-align:center"><input class="inp inp-sm" placeholder="Nome da coluna" style="flex:1"><button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><i class="bi bi-trash"></i></button></div>`;}
function saveColumnsConfig(){
  const rows=document.querySelectorAll('.cm-row'),newCols=[],map={};
  rows.forEach(r=>{const orig=r.dataset.orig,icon=r.querySelectorAll('input')[0].value.trim(),name=r.querySelectorAll('input')[1].value.trim();if(name){newCols.push({id:name,icon});if(orig&&orig!==name)map[orig]=name;}});
  if(!newCols.length)return showToast('Ao menos uma coluna!','warning');
  projects.forEach(p=>{if(map[p.column])p.column=map[p.column];if(!newCols.find(c=>c.id===p.column))p.column=newCols[0].id;});
  appColumns=newCols;visibleColumns=appColumns.map(c=>c.id);minimizedColumns=[];
  updateProjColSelect();renderBoard();closeManageColumnsModal();scheduleSync();showToast('Colunas atualizadas!','success');
}

// ══════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════
function applyQuickMsg(idx){
  const q = QUICK_MSGS[idx];
  if(q){
    document.getElementById('notifyTitle').value = q.title;
    document.getElementById('notifyMsg').value = q.msg;
  }
}
function openNotifyModal(projId){
  notifyProjId=projId;const p=projects.find(x=>x.id===projId);if(!p)return;
  document.getElementById('notifyInfo').textContent=`${p.name} — ${p.client}`;
  document.getElementById('notifyTitle').value='';
  document.getElementById('notifyMsg').value='';
  document.getElementById('quickMsgs').innerHTML=QUICK_MSGS.map((m, idx)=>`<button class="btn btn-ghost btn-sm" style="font-size:11.5px" onclick="applyQuickMsg(${idx})">${m.title}</button>`).join('');
  document.getElementById('notifyOverlay').classList.add('open');
}
function closeNotifyModal(){document.getElementById('notifyOverlay').classList.remove('open');}
function sendNotification(){
  const title=document.getElementById('notifyTitle').value.trim();
  const msg=document.getElementById('notifyMsg').value.trim();
  if(!title)return showToast('Escreva o título','warning');
  if(!msg)return showToast('Escreva a mensagem','warning');
  const p=projects.find(x=>x.id===notifyProjId);if(!p)return;
  const cli=clients.find(c=>c.name===p.client);
  if(!cli)return showToast('Cliente não no CRM','warning');
  if(!cli.token)return showToast('Cliente sem token — defina um token primeiro','warning');
  notifications.push({id:Date.now(),clientToken:cli.token,title,message:msg,projectName:p.name,createdAt:new Date().toISOString(),read:false});
  closeNotifyModal();scheduleSync();renderBoard();showToast('Aviso enviado!','success');
}

// ══════════════════════════════════════════
//  WHATSAPP
// ══════════════════════════════════════════
function openWhatsApp(projId){
  const p=projects.find(x=>x.id===projId);if(!p)return;
  const cli=clients.find(c=>c.name===p.client);
  const pays=p.payments||[];
  const total=parseFloat(p.value||0);
  const paid=pays.reduce((s,x)=>s+parseFloat(x.amount||0),0);
  const rest=total-paid;
  const link=cli?.token?buildLink(cli.name,cli.token):'';
  const dl=p.date?new Date(p.date+'T12:00:00').toLocaleDateString('pt-BR'):'';
  const firstName=p.client.split(' ')[0];

  let msg=`Olá, *${firstName}*!\n`;
  msg+=`\n`;
  msg+=`*${p.name}*\n`;
  msg+=`\n`;
  msg+=`*Etapa:* ${p.column}\n`;
  if(dl)msg+=`*Prazo:* ${dl}\n`;
  if(total>0){
    msg+=`*Valor contratado:* ${fmt(total)}\n`;
    if(rest<=0) msg+=`*Pagamento:* Quitado\n`;
    else if(paid>0) msg+=`*Pago:* ${fmt(paid)} | *Pendente:* ${fmt(rest)}\n`;
    else msg+=`*Pendente:* ${fmt(rest)}\n`;
  }
  if(p.note)msg+=`\n_${p.note}_\n`;
  if(link)msg+=`\n*Seu painel:*\n${link}\n`;
  msg+=`\n`;
  msg+=`_Equipe MAVIC Projetos_`;

  document.getElementById('waPhone').value=cli?.phone||'';
  document.getElementById('waMsg').value=msg;
  document.getElementById('waOverlay').classList.add('open');
}
function closeWaModal(){document.getElementById('waOverlay').classList.remove('open');}
function sendWhatsApp(){
  const msg=document.getElementById('waMsg').value.trim();
  const rawPhone=document.getElementById('waPhone').value.replace(/\D/g,'');
  const waUrl=rawPhone
    ?`https://wa.me/55${rawPhone}?text=${encodeURIComponent(msg)}`
    :`https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(waUrl,'_blank');
  closeWaModal();
}

// ══════════════════════════════════════════
//  SHARE LINK
// ══════════════════════════════════════════
function shareLink(projId){
  const p=projects.find(x=>x.id===projId);if(!p?.client)return showToast('Projeto sem cliente','warning');
  const cli=clients.find(c=>c.name===p.client);if(!cli)return showToast('Cliente não no CRM','warning');
  if(!cli.token){cli.token=genTokenStr();scheduleSync();}
  copyText(buildLink(cli.name,cli.token),'Link do cliente copiado! 📋');
}
function copyClientLink(){copyText(document.getElementById('clientLinkPreview').textContent,'Link copiado!');}
function copyText(txt,msg){
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(txt).then(()=>showToast(msg,'success')).catch(()=>showLinkFallback(txt));
  else showLinkFallback(txt);
}
function showLinkFallback(link){document.getElementById('shareLinkInput').value=link;document.getElementById('shareLinkOverlay').classList.add('open');}
function copyShareInput(){document.getElementById('shareLinkInput').select();document.execCommand('copy');showToast('Link copiado!','success');}

// ══════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════
function renderDashboard(){
  const active=projects.filter(p=>!p.archived);
  const totalVal=active.reduce((s,p)=>s+parseFloat(p.value||0),0);
  const totalPaid=active.reduce((s,p)=>s+(p.payments||[]).reduce((a,x)=>a+parseFloat(x.amount||0),0),0);
  const totalPend=totalVal-totalPaid;
  const concl=active.filter(p=>p.column==='Concluído').length;
  const venc=active.filter(p=>{if(!p.date||p.column==='Concluído')return false;return new Date(p.date+'T12:00:00')<new Date().setHours(0,0,0,0);}).length;
  const pendingProjs=active.filter(p=>{const t=parseFloat(p.value||0);const pg=(p.payments||[]).reduce((s,x)=>s+parseFloat(x.amount||0),0);return t>0&&pg<t;});
  document.getElementById('dashCards').innerHTML=`
    <div class="dash-card dc-accent"><div class="dc-lbl">Faturamento Total</div><div class="dc-val">${fmt(totalVal)}</div><div class="dc-sub">${active.length} projetos ativos</div></div>
    <div class="dash-card dc-green"><div class="dc-lbl">Total Recebido</div><div class="dc-val">${fmt(totalPaid)}</div><div class="dc-sub">${Math.round(totalVal?totalPaid/totalVal*100:0)}% do total</div></div>
    <div class="dash-card dc-red"><div class="dc-lbl">A Receber</div><div class="dc-val">${fmt(totalPend)}</div><div class="dc-sub">${pendingProjs.length} projetos pendentes</div></div>
    <div class="dash-card"><div class="dc-lbl">Concluídos</div><div class="dc-val" style="color:var(--green)">${concl}</div><div class="dc-sub">de ${active.length} ativos</div></div>
    <div class="dash-card"><div class="dc-lbl">Vencidos</div><div class="dc-val" style="color:${venc>0?'var(--red)':'var(--text3)'}">${venc}</div><div class="dc-sub">projetos com prazo vencido</div></div>
    <div class="dash-card"><div class="dc-lbl">Clientes</div><div class="dc-val" style="color:var(--accent)">${clients.length}</div><div class="dc-sub">no CRM</div></div>`;
  const sorted=pendingProjs.sort((a,b)=>{const ra=parseFloat(a.value||0)-(a.payments||[]).reduce((s,x)=>s+parseFloat(x.amount||0),0);const rb=parseFloat(b.value||0)-(b.payments||[]).reduce((s,x)=>s+parseFloat(x.amount||0),0);return rb-ra;});
  if(!sorted.length){document.getElementById('dashTable').innerHTML='<div style="padding:24px;text-align:center;color:var(--text3)">Nenhum saldo pendente! ✅</div>';return;}
  document.getElementById('dashTable').innerHTML=`<table><thead><tr><th>Projeto</th><th>Cliente</th><th>Etapa</th><th>Total</th><th>Recebido</th><th>Saldo</th><th>Prazo</th></tr></thead><tbody>${sorted.map(p=>{
    const t=parseFloat(p.value||0);const pg=(p.payments||[]).reduce((s,x)=>s+parseFloat(x.amount||0),0);const rest=t-pg;
    const dl=p.date?new Date(p.date+'T12:00:00'):null;const diff=dl?Math.ceil((dl-new Date().setHours(0,0,0,0))/86400000):null;
    const dtxt=dl?`<span style="color:${diff<0?'var(--red)':diff<=7?'var(--yellow)':'var(--text2)'}">${dl.toLocaleDateString('pt-BR')}</span>`:'—';
    return `<tr><td style="font-weight:600">${p.name}</td><td>${p.client}</td><td><span class="badge b-t${p.type}">${p.column}</span></td><td style="font-family:'Courier New',monospace">${fmt(t)}</td><td style="font-family:'Courier New',monospace;color:var(--green)">${fmt(pg)}</td><td style="font-family:'Courier New',monospace;font-weight:700;color:var(--red)">${fmt(rest)}</td><td>${dtxt}</td></tr>`;
  }).join('')}</tbody></table>`;
}

// ══════════════════════════════════════════
//  GLOBAL NOTICE
// ══════════════════════════════════════════
function openGlobalNoticeModal(){
  resetGnForm();
  renderGnList();
  updateGnNavBtn();
  document.getElementById('globalNoticeOverlay').classList.add('open');
}
function closeGlobalNoticeModal(){document.getElementById('globalNoticeOverlay').classList.remove('open');}

function resetGnForm(){
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

function toggleGnAccordion(id){
  if(openGnIds.has(id)) openGnIds.delete(id);
  else openGnIds.add(id);
  renderGnList();
}
function renderGnList(){
  const el=document.getElementById('gnList');
  
  // Format global notices
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

  // Format individual project notifications
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

  if(!combined.length){el.innerHTML='<div style="text-align:center;color:var(--text3);font-size:13px;padding:28px">Nenhum aviso enviado ainda</div>';return;}
  
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
          <i class="bi ${gn.type==='global'?'bi-megaphone-fill':'bi-folder-fill'}" style="color:${gn.type==='global'?'var(--accent)':'var(--green)'};flex-shrink:0"></i>
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

function toggleGnAllClients(){
  const all=document.getElementById('gnAllClients').checked;
  document.getElementById('gnClientsContainer').style.display=all?'none':'flex';
}
function updateGnPreview(){
  const title=document.getElementById('gnTitle').value.trim();
  const msg=document.getElementById('gnMsg').value.trim();
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
function formatNoticeText(t){
  return t
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*([^*\n]+)\*/g,'<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g,'<em>$1</em>')
    .replace(/\n/g,'<br>');
}
function wrapGnText(before,after){
  const ta=document.getElementById('gnMsg');
  const s=ta.selectionStart,e=ta.selectionEnd;
  const sel=ta.value.substring(s,e)||'texto';
  ta.setRangeText(before+sel+after,s,e,'select');
  ta.focus();updateGnPreview();
}
function insertGnText(text){
  const ta=document.getElementById('gnMsg');
  const s=ta.selectionStart;
  ta.setRangeText(text,s,s,'end');
  ta.focus();updateGnPreview();
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
  if(!confirm('Excluir este aviso definitivamente?'))return;
  if(type === 'global'){
    globalNotices=globalNotices.filter(x=>x.id!==id);
  } else {
    notifications=notifications.filter(x=>x.id!==id);
  }
  renderGnList();updateGnNavBtn();scheduleSync();showToast('Aviso removido','info');
}
function updateGnNavBtn(){
  const btn=document.getElementById('gnNavBtn');
  const hasActive=globalNotices.some(x=>x.active);
  btn.style.color=hasActive?'var(--yellow)':'';
}

// ══════════════════════════════════════════
//  QUICK COLUMN MOVE
// ══════════════════════════════════════════
function moveNext(id){
  const p=projects.find(x=>x.id===id);if(!p)return;
  const cols=appColumns.filter(c=>visibleColumns.includes(c.id));
  const idx=cols.findIndex(c=>c.id===p.column);
  if(idx===-1||idx===cols.length-1)return showToast('Já na última etapa','info');
  p.column=cols[idx+1].id;
  renderBoard();scheduleSync();showToast(`➡ ${p.column}`,'info');
}

// ══════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════
function openSettings(){
  document.getElementById('clientUrl').value=localStorage.getItem('mavic_clientUrl')||'cliente.html';
  document.getElementById('stProjCnt').textContent=projects.length;
  document.getElementById('stCliCnt').textContent=clients.length;
  document.getElementById('settingsOverlay').classList.add('open');
}
function closeSettings(){document.getElementById('settingsOverlay').classList.remove('open');}
function saveSettings(){
  const cUrl=document.getElementById('clientUrl').value.trim()||'cliente.html';
  localStorage.setItem('mavic_clientUrl',cUrl);window.CLIENT_PANEL_URL=cUrl;
  closeSettings();showToast('Configurações salvas!','success');
}

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
// Ping a cada 30 min para evitar hibernação do Supabase
setInterval(async()=>{
  if(!sb)return;
  try{await sb.from('mavic_store').select('key').limit(1);}catch(e){}
},30*60*1000);

document.addEventListener('DOMContentLoaded',async()=>{
  await loadData();
  updateProjColSelect();updateProjClientSelect();updateClientFilter();
  updateGnNavBtn();
  renderBoard();
  document.getElementById('loading').style.display='none';
  document.addEventListener('click',e=>{
    if(!e.target.closest('.kcol-acts'))document.querySelectorAll