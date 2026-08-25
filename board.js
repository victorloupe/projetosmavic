// ══════════════════════════════════════════
//  BOARD / KANBAN LOGIC
// ══════════════════════════════════════════
let touchTimer=null, touchDragId=null, touchGhost=null;
let activeMobileCol = sessionStorage.getItem('board_active_col') || 'all';

function setMobileColFilter(colId){
  activeMobileCol = colId;
  sessionStorage.setItem('board_active_col', colId);
  renderBoard();
}

function renderBoardColPills(columnsWithCounts, totalCount){
  const pillsEl = document.getElementById('boardColPills');
  if(!pillsEl) return;
  const isMobile = Boolean(window.matchMedia && window.matchMedia('(max-width:768px)').matches);
  if(!isMobile) {
    pillsEl.innerHTML = '';
    return;
  }
  
  let html = `<button class="board-col-pill ${activeMobileCol === 'all' ? 'active' : ''}" onclick="setMobileColFilter('all')">
    <i class="bi bi-kanban"></i> <span>Todas</span> <span class="pill-badge">${totalCount}</span>
  </button>`;
  
  columnsWithCounts.forEach(c => {
    const isActive = activeMobileCol === c.id;
    html += `<button class="board-col-pill ${isActive ? 'active' : ''}" onclick="setMobileColFilter('${c.id}')">
      <i class="bi ${c.icon || DEFAULT_COL_ICON}" style="color:${isActive ? '#fff' : (c.color || DEFAULT_COL_COLOR)}"></i>
      <span>${c.id}</span>
      <span class="pill-badge">${c.count}</span>
    </button>`;
  });
  pillsEl.innerHTML = html;
}

function initPage() {
  updateProjColSelect();
  updateProjClientSelect();
  updateClientFilter();

  // Restaurar filtros salvos do sessionStorage
  const savedType = sessionStorage.getItem('board_fType');
  const savedPrio = sessionStorage.getItem('board_fPrio');
  const savedCli = sessionStorage.getItem('board_fClient');
  const savedSearch = sessionStorage.getItem('board_srch');

  if(savedType && document.getElementById('fType')) document.getElementById('fType').value = savedType;
  if(savedPrio && document.getElementById('fPrio')) document.getElementById('fPrio').value = savedPrio;
  if(savedCli && document.getElementById('fClient')) document.getElementById('fClient').value = savedCli;
  if(savedSearch && document.getElementById('srch')) document.getElementById('srch').value = savedSearch;

  renderBoard();

  // Checar parâmetro da URL para abrir modal de projeto automaticamente
  const params = new URLSearchParams(window.location.search);
  const openProjId = params.get('openProj');
  if (openProjId) {
    const id = parseInt(openProjId);
    setTimeout(() => {
      openProjectModal(id);
    }, 150);
  }
}

function renderBoard(){
  const board=document.getElementById('board');
  if(!board) return;
  board.innerHTML='';
  const fType=document.getElementById('fType').value;
  const fPrio=document.getElementById('fPrio').value;
  const fCli=document.getElementById('fClient').value;
  const srchEl=document.getElementById('srch');
  const srch=srchEl ? srchEl.value.toLowerCase().trim() : '';

  // Persistir filtros no sessionStorage
  sessionStorage.setItem('board_fType', fType);
  sessionStorage.setItem('board_fPrio', fPrio);
  sessionStorage.setItem('board_fClient', fCli);
  sessionStorage.setItem('board_srch', srchEl ? srchEl.value : '');

  let total=0;
  const visibleCols = appColumns.filter(c=>visibleColumns.includes(c.id));
  const isMobile = Boolean(window.matchMedia && window.matchMedia('(max-width:768px)').matches);

  // Calcular contagens para os pills mobile
  const columnsWithCounts = visibleCols.map(col => {
    const colProjs = projects.filter(p=>!p.archived&&p.column===col.id&&(!fType||p.type===fType)&&(!fPrio||p.priority===fPrio)&&(!fCli||p.client===fCli)&&(!srch||p.name?.toLowerCase().includes(srch)||p.client?.toLowerCase().includes(srch)));
    total += colProjs.length;
    return { id: col.id, icon: col.icon, color: col.color, count: colProjs.length };
  });

  renderBoardColPills(columnsWithCounts, total);

  const colsToRender = (isMobile && activeMobileCol !== 'all')
    ? visibleCols.filter(c => c.id === activeMobileCol)
    : visibleCols;
  
  colsToRender.forEach(col=>{
    const isMin=minimizedColumns.includes(col.id);
    let colProjs=projects.filter(p=>!p.archived&&p.column===col.id&&(!fType||p.type===fType)&&(!fPrio||p.priority===fPrio)&&(!fCli||p.client===fCli)&&(!srch||p.name?.toLowerCase().includes(srch)||p.client?.toLowerCase().includes(srch)));
    colProjs=sortProjs(colProjs,col.id);
    const colVal = colProjs.reduce((s, p) => s + parseFloat(p.value || 0), 0);
    const colValHtml = colVal > 0 ? `<span class="kcol-val" style="font-family:'Outfit',sans-serif;font-size:11px;font-weight:700;color:var(--accent);background:var(--accent-bg);padding:1px 6px;border-radius:6px;margin-left:4px" title="Faturamento total nesta etapa">${fmt(colVal)}</span>` : '';

    const el=document.createElement('div');
    if(isMin){
      el.className='kcol-mini';el.onclick=()=>toggleMinimize(col.id);
      el.innerHTML=`<i class="bi bi-arrows-angle-expand" style="color:var(--text3);font-size:12px"></i><span class="mc">${colProjs.length}</span><div class="ml"><i class="bi ${col.icon||DEFAULT_COL_ICON}" style="color:${col.color||DEFAULT_COL_COLOR}"></i> ${col.id}</div>`;
    }else{
      const cur=colSorts[col.id]||'default';
      const sortLabels={default:'Padrão',priority:'Prioridade',deadline:'Prazo',value:'Valor',name:'Nome'};
      el.className='kcol';
      el.innerHTML=`<div class="kcol-hdr">
        <div class="kcol-title"><i class="bi ${col.icon||DEFAULT_COL_ICON}" style="color:${col.color||DEFAULT_COL_COLOR}"></i> ${col.id} <span class="kcol-cnt">${colProjs.length}</span>${colValHtml}${isHiddenColumn(col.id)?'<i class="bi bi-eye-slash-fill kcol-hidden-ic" title="Encerrada — não aparece pro cliente"></i>':''}</div>
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
      <div class="kdrop${isHiddenColumn(col.id)?' kdrop-compact':''}" data-column="${col.id}">
        ${isHiddenColumn(col.id)?colProjs.map(p=>createCompactCardHTML(p)).join(''):colProjs.map((p,i)=>createCardHTML(p,i)).join('')}
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
  if(s==='priority'){
    const map={Alta:3,Média:2,Baixa:1};
    return a.sort((x,y)=>(map[y.priority]||0)-(map[x.priority]||0));
  }
  if(s==='deadline') return a.sort((x,y)=>{if(!x.date)return 1;if(!y.date)return -1;return new Date(x.date)-new Date(y.date);});
  if(s==='value') return a.sort((x,y)=>parseFloat(y.value||0)-parseFloat(x.value||0));
  if(s==='name') return a.sort((x,y)=>(x.name||'').localeCompare(y.name||''));
  return a.sort((x,y)=>y.id-x.id);
}

function createCardHTML(p, cardIdx=0){
  const pays=p.payments||[];
  const total=parseFloat(p.value||0);
  const paid=pays.reduce((s,x)=>s+parseFloat(x.amount||0),0);
  const rest=total-paid;
  const dl=p.date?new Date(p.date+'T12:00:00'):null;
  const diff=dl?Math.ceil((dl-new Date().setHours(0,0,0,0))/86400000):null;
  let dateCls='',dateBadge='';
  if(dl){
    if(diff<0){
      dateCls='b-venc';
      dateBadge=`<span class="badge b-venc" title="Prazo vencido há ${Math.abs(diff)} dias"><i class="bi bi-exclamation-circle"></i> Atrasado (${Math.abs(diff)}d)</span>`;
    } else if(diff===0){
      dateCls='b-urg';
      dateBadge=`<span class="badge b-urg" title="Prazo de entrega hoje!"><i class="bi bi-alarm"></i> Vence hoje</span>`;
    } else if(diff===1){
      dateCls='b-urg';
      dateBadge=`<span class="badge b-urg" title="Vence amanhã"><i class="bi bi-calendar-event"></i> Amanhã</span>`;
    } else if(diff<=3){
      dateCls='b-urg';
      dateBadge=`<span class="badge b-urg" title="Faltam ${diff} dias"><i class="bi bi-hourglass-split"></i> Faltam ${diff}d</span>`;
    }
  }
  const dlClass=diff===null?'':(diff<0?'dl-overdue':diff<=7?'dl-urgent':'');
  const pMap={Alta:'b-alta',Média:'b-media',Baixa:'b-baixa'};
  const pIcon={Alta:'🔴',Média:'🟡',Baixa:'🟢'};
  let sClass='',sLabel='';
  if(total>0){if(rest<=0){sClass='b-pago';sLabel='✓ 100% Pago';}else if(paid>0){sClass='b-parcial';sLabel=`Parcial (${Math.round((paid/total)*100)}%)`;}else{sClass='b-pendente';sLabel='Pendente';}}
  // Avatar
  const avatarColor=getClientColor(p.client||'?');
  const initials=getInitials(p.client||'?');
  // Progresso checklist
  const subs=p.subtasks||[];
  const subDone=subs.filter(s=>s.done).length;
  const subPct=subs.length?Math.round((subDone/subs.length)*100):0;
  const progColor=subPct===100?'var(--green)':subPct>0?'var(--accent)':'transparent';
  const activeSubs = subs.filter(s => s.current && !s.done);
  const currSubs = activeSubs.length ? activeSubs : (subs.find(s => !s.done) ? [subs.find(s => !s.done)] : []);
  const isCurrent = (sId) => currSubs.some(cs => cs.id === sId);
  const isExp=expandedFin.has(p.id);
  let finHtml='';
  if(total>0){
    const hRows=pays.length?pays.map(pg=>`<div class="fin-hist-item"><span style="color:var(--text3);font-size:11px"><i class="bi bi-calendar3"></i> ${pg.date?new Date(pg.date+'T12:00:00').toLocaleDateString('pt-BR'):'—'} · ${pg.method||'Pix'}</span><span class="fv" style="font-family:'Outfit',sans-serif;font-weight:700">+${fmt(pg.amount)}</span></div>`).join(''):'<div class="fin-hist-item" style="color:var(--text3);justify-content:center;font-size:12px">Sem pagamentos</div>';
    finHtml=`<div class="fin-blk"><div class="fin-sum"><div class="fin-row"><span class="lbl">Contrato</span><span class="val" style="font-family:'Outfit',sans-serif;font-weight:700">${fmt(total)}</span></div><div class="fin-row"><span class="lbl">Recebido</span><span class="val" style="color:var(--green);font-family:'Outfit',sans-serif;font-weight:700">${fmt(paid)}</span></div><div class="fin-row" style="border-top:1px solid var(--border);padding-top:3px;margin-top:2px"><span class="lbl">Saldo</span><span class="val" style="color:${rest>0?'var(--red)':'var(--text3)'};font-family:'Outfit',sans-serif;font-weight:700">${fmt(rest)} <span class="badge ${sClass}" style="font-size:10px">${sLabel}</span></span></div></div><button class="fin-hist-btn" onclick="toggleFinHist(${p.id});event.stopPropagation()"><i class="bi bi-clock-history"></i> ${pays.length} pagamento${pays.length!==1?'s':''} <i class="bi bi-chevron-${isExp?'up':'down'}" style="float:right;margin-top:1px;font-size:10px"></i></button><div class="fin-hist-rows ${isExp?'':'d-none'}">${hRows}</div></div>`;
  }
  let checkHtml='';
  if(subs.length){
    const rows=subs.map(s=>{
      const sIsCurrent = isCurrent(s.id);
      const playIcon = s.done ? '' : `<i class="bi ${s.current?'bi-play-circle-fill':'bi-play-circle'}" style="cursor:pointer;color:${s.current?'var(--accent)':'var(--text3)'};font-size:13px;margin-right:2px" onclick="toggleSubActive(${p.id},${s.id});event.stopPropagation()" title="Definir foco atual"></i>`;
      return `<div class="sub-row ${sIsCurrent?'sub-in-progress':''}">${playIcon}<input type="checkbox" ${s.done?'checked':''} onclick="toggleSub(${p.id},${s.id});event.stopPropagation()"><span class="${s.done?'sub-done':''}">${s.text}</span></div>`;
    }).join('');
    checkHtml=`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-top:7px"><div style="padding:5px 8px;display:flex;justify-content:space-between;font-size:12px;font-weight:600"><span><i class="bi bi-ui-checks"></i> Andamento</span><span style="font-family:'Outfit',sans-serif;font-weight:700">${subDone}/${subs.length}</span></div><div class="prog" style="margin:0 8px 6px"><div class="prog-fill ${subPct===100?'done':''}" style="width:${subPct}%"></div></div><div style="max-height:96px;overflow-y:auto">${rows}</div></div>`;
  }
  const noteHtml=p.note?`<p style="font-size:12px;color:var(--text2);margin-top:7px;line-height:1.5;background:var(--surface2);padding:6px 8px;border-radius:6px">${p.note}</p>`:'';
  const driveHtml = p.driveLink ? `
    <div style="margin-top:8px">
      <a href="${p.driveLink}" target="_blank" class="drive-btn" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:6px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);text-decoration:none;font-size:11.5px;font-weight:600;transition:all .2s" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='var(--surface2)'" onclick="event.stopPropagation()">
        <i class="bi bi-folder2-open" style="color:var(--accent)"></i> Pasta de Arquivos
      </a>
    </div>
  ` : '';
  return `<div class="kcard ${dlClass} ${pinnedCards.has(p.id)?'pinned':''}" data-id="${p.id}" draggable="true" onclick="togglePin(event,${p.id})" style="animation-delay:${cardIdx*0.04}s;--type-color:${typeColor(p.type)}">
    ${subs.length?`<div class="kcard-prog-bar"><div class="kcard-prog-fill" style="width:${subPct}%;background:${progColor}"></div></div>`:''}
    ${p.image?`<img src="${p.image}" class="kcard-cover" onerror="this.style.display='none'">`:''}
    <div class="kcard-body">
      <div class="kcard-name">${p.name}</div>
      ${p.client?`<div class="kcard-client"><span class="kcard-avatar" style="background:${avatarColor}">${initials}</span>${p.client}</div>`:''}
      ${currSubs.length?`<div class="kcard-current-task" title="Foco atual"><i class="bi bi-lightning-charge-fill" style="color:var(--yellow)"></i> <span>${currSubs.map(cs => cs.text).join(', ')}</span></div>`:''}
      <div class="kcard-tags">
        ${!isFinalColumn(p.column)?`<span class="badge ${pMap[p.priority]||'b-baixa'}">${pIcon[p.priority]||'🟢'} ${p.priority}</span>`:''}
        <span class="badge" style="background:${typeBg(p.type)};color:${typeColor(p.type)}">${p.type}</span>
        ${p.originBudgetNumber?`<a href="orcamento.html" class="proj-origin-badge" title="Orçamento de Origem #${p.originBudgetNumber}" onclick="event.stopPropagation()"><i class="bi bi-file-earmark-spreadsheet"></i> #${p.originBudgetNumber}</a>`:''}
        ${total>0?`<span class="badge ${sClass}" style="margin-left:auto">${sLabel}</span>`:''}
      </div>
    </div>
    <div class="kcard-exp">
      ${dl?`<div style="font-size:12px;margin-bottom:6px;display:flex;align-items:center;gap:6px" class="${dateCls}"><i class="bi bi-calendar3"></i>${dl.toLocaleDateString('pt-BR')} ${dateBadge}</div>`:''}
      ${finHtml}${checkHtml}${noteHtml}
      ${driveHtml}
      <div class="cact">
        <button class="cbtn ntf" onclick="openNotifyModal(${p.id});event.stopPropagation()" title="Notificar cliente"><i class="bi bi-bell"></i></button>
        <button class="cbtn" style="color:#25D366" onclick="openWhatsApp(${p.id});event.stopPropagation()" title="Enviar WhatsApp"><i class="bi bi-whatsapp"></i></button>
        <button class="cbtn shr" onclick="shareLink(${p.id});event.stopPropagation()" title="Link do cliente"><i class="bi bi-share"></i></button>
        <button class="cbtn" onclick="editProject(${p.id});event.stopPropagation()" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="cbtn arc" onclick="archiveProject(${p.id});event.stopPropagation()" title="Arquivar"><i class="bi bi-archive"></i></button>
        <button class="cbtn del" onclick="deleteProject(${p.id});event.stopPropagation()" title="Excluir"><i class="bi bi-trash3"></i></button>
        <button class="cbtn" style="margin-left:auto;color:var(--accent)" onclick="moveNext(${p.id});event.stopPropagation()" title="Avançar etapa"><i class="bi bi-arrow-right-circle"></i></button>
      </div>
    </div>
  </div>`;
}

function createCompactCardHTML(p){
  return `<div class="kcard-compact" data-id="${p.id}" draggable="true">
    <div class="kcard-compact-info" onclick="editProject(${p.id})">
      <div class="kcard-compact-name">${p.name}</div>
      <div class="kcard-compact-sub">${p.client||'—'} · ${p.column}</div>
    </div>
    <div class="kcard-compact-acts">
      <button class="btn btn-ghost btn-sm" onclick="editProject(${p.id});event.stopPropagation()" title="Editar"><i class="bi bi-pencil"></i></button>
      <button class="btn btn-danger btn-sm" onclick="deleteProject(${p.id});event.stopPropagation()" title="Excluir"><i class="bi bi-trash3"></i></button>
    </div>
  </div>`;
}

function toggleMinimize(colId){
  if(minimizedColumns.includes(colId)) minimizedColumns=minimizedColumns.filter(c=>c!==colId);
  else minimizedColumns.push(colId);
  renderBoard();scheduleSync();
}

function toggleSortMenu(colId){
  document.querySelectorAll('.sort-menu').forEach(m=>{if(m.id!==`sort-${colId}`)m.classList.remove('open');});
  document.getElementById(`sort-${colId}`).classList.toggle('open');
}

function setColSort(colId,sort){
  colSorts[colId]=sort;
  document.getElementById(`sort-${colId}`).classList.remove('open');
  renderBoard();scheduleSync();
}

// Exclui #colsMenu: ele tem sua própria lógica de abrir/fechar (toggleColsMenu/closeColsMenu
// no index.html) — se ele também fosse fechado aqui, abriria e fecharia no mesmo clique.
document.addEventListener('click',()=>document.querySelectorAll('.sort-menu:not(#colsMenu)').forEach(m=>m.classList.remove('open')));

// ══════════════════════════════════════════
//  DRAG & DROP EVENTS
// ══════════════════════════════════════════
function setupDragDrop(){
  document.querySelectorAll('.kcard[draggable], .kcard-compact[draggable]').forEach(card=>{
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
      if(idx>-1&&projects[idx].column!==col){
          projects[idx].column=col;renderBoard();scheduleSync();
          if(isHiddenColumn(col)) showToast(`Movido para ${col} — não aparece mais pro cliente`,'warning');
          else showToast(`Movido para ${col}`,'info');
        }
    });
  });
  setupTouchDrag();
}

function setupTouchDrag(){
  document.querySelectorAll('.kcard[draggable], .kcard-compact[draggable]').forEach(card=>{
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
        if(idx>-1&&projects[idx].column!==col){
          projects[idx].column=col;renderBoard();scheduleSync();
          if(isHiddenColumn(col)) showToast(`Movido para ${col} — não aparece mais pro cliente`,'warning');
          else showToast(`Movido para ${col}`,'info');
        }
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

function togglePin(e,id){
  if(isDragging)return;
  if(e.target.closest('.cbtn')||e.target.closest('input'))return;
  const card=e.currentTarget;
  if(pinnedCards.has(id)){pinnedCards.delete(id);card.classList.remove('pinned');}
  else{pinnedCards.add(id);card.classList.add('pinned');}
}

// ══════════════════════════════════════════
//  PROJECT MODAL
// ══════════════════════════════════════════
function openProjectModal(id=null){
  if(isDragging)return;
  updateProjClientSelect();
  populateProjectTypeSelects();
  document.getElementById('newSubTask').value='';
  document.getElementById('newProdName').value='';
  document.getElementById('newProdPrice').value='';
  document.getElementById('newPayAmount').value='';
  document.getElementById('newPayDate').value=today();
  
  if(id){
    const p=projects.find(x=>x.id===id);if(!p)return;
    document.getElementById('projModalTitle').innerHTML=`Editar Projeto ${p.originBudgetNumber?`<a href="orcamento.html" class="proj-origin-badge" style="font-size:11px;margin-left:6px;vertical-align:middle" title="Ver Orçamento de Origem"><i class="bi bi-file-earmark-spreadsheet"></i> Orçamento #${p.originBudgetNumber}</a>`:''}`;
    document.getElementById('projId').value=p.id;
    document.getElementById('projName').value=p.name;
    document.getElementById('projClient').value=p.client;
    document.getElementById('projImage').value=p.image||'';
    document.getElementById('projDriveLink').value=p.driveLink||'';
    document.getElementById('projValue').value=p.value?toBRLInputStr(p.value):'';
    document.getElementById('projType').value=p.type;
    document.getElementById('projPrio').value=p.priority;
    document.getElementById('projCol').value=p.column;
    document.getElementById('projDate').value=p.date||'';
    document.getElementById('projNote').value=p.note||'';
    if (typeof reconcileProjectFinancials === 'function') reconcileProjectFinancials(p);
    tempSubs=[...(p.subtasks||[])];
    tempPayments=[...(p.payments||[])];
    tempProds=[...(p.products||[])];
    tempInstallments=[...(p.installments||[])];
    tempPaymentCondition=p.paymentCondition||'';
    document.getElementById('btnDelProj').style.display='block';
    document.getElementById('btnArchProj').textContent=p.archived?'Desarquivar':'Arquivar';
    
    handleClientChange(true);
  }else{
    document.getElementById('projModalTitle').textContent='Novo Projeto';
    document.getElementById('projId').value='';
    document.getElementById('projName').value='';
    document.getElementById('projClient').value='';
    document.getElementById('projImage').value='';
    document.getElementById('projDriveLink').value='';
    document.getElementById('projValue').value='';
    document.getElementById('projType').value='Residencial';
    document.getElementById('projPrio').value='Média';
    document.getElementById('projCol').value='Briefing';
    document.getElementById('projDate').value='';
    document.getElementById('projNote').value='';
    tempSubs=[];tempPayments=[];tempProds=[];tempInstallments=[];tempPaymentCondition='';
    document.getElementById('btnDelProj').style.display='none';
  }
  renderSubsList();renderPaymentsModal();renderProjProdsTable();
  document.getElementById('projectOverlay').classList.add('open');
}

function hasProjModalChanges() {
  const id = document.getElementById('projId').value;
  const name = document.getElementById('projName').value.trim();
  const client = document.getElementById('projClient').value;
  const img = document.getElementById('projImage').value.trim();
  const drive = document.getElementById('projDriveLink').value.trim();
  const val = document.getElementById('projValue').value.trim();
  const type = document.getElementById('projType').value;
  const prio = document.getElementById('projPrio').value;
  const col = document.getElementById('projCol').value;
  const note = document.getElementById('projNote').value.trim();
  const date = document.getElementById('projDate').value;
  
  if (!id) {
    // Modo: Criação de Novo Projeto
    return name !== '' || client !== '' || img !== '' || drive !== '' || val !== '' || note !== '' || date !== '' || tempSubs.length > 0 || tempPayments.length > 0 || tempProds.length > 0;
  } else {
    // Modo: Edição de Projeto Existente
    const p = projects.find(x => x.id === parseInt(id));
    if (!p) return false;
    
    const isSubsChanged = JSON.stringify(p.subtasks || []) !== JSON.stringify(tempSubs);
    const isPaysChanged = JSON.stringify(p.payments || []) !== JSON.stringify(tempPayments);
    const isProdsChanged = JSON.stringify(p.products || []) !== JSON.stringify(tempProds);
    
    return name !== (p.name || '') ||
           client !== (p.client || '') ||
           img !== (p.image || '') ||
           drive !== (p.driveLink || '') ||
           parseCurrencyInput(val) !== (p.value || 0) ||
           type !== (p.type || 'Residencial') ||
           prio !== (p.priority || 'Média') ||
           col !== (p.column || 'Briefing') ||
           note !== (p.note || '') ||
           date !== (p.date || '') ||
           isSubsChanged ||
           isPaysChanged ||
           isProdsChanged;
  }
}

function closeProjectModal(confirmIfDirty = false){
  const el = document.getElementById('projectOverlay');
  if(!el) return;
  if(confirmIfDirty && hasProjModalChanges()){
    showConfirm('Deseja descartar as alterações não salvas no projeto?', () => {
      el.classList.remove('open');
    }, { title: 'Descartar alterações?', okText: 'Descartar', danger: true });
  } else {
    el.classList.remove('open');
  }
}

function handleClientChange(keepTitle=false) {
  const clientName = document.getElementById('projClient')?.value;
  const wrap = document.getElementById('projClientProdWrap');
  const sel = document.getElementById('projClientProd');
  if (!wrap || !sel) return;
  
  if (!clientName) {
    wrap.classList.add('d-none');
    return;
  }
  
  const cl = clients.find(c => c.name === clientName);
  const availableServices = getServicesForClient(cl ? cl.id : null);
  const clientLegacyProducts = (cl && Array.isArray(cl.products)) ? cl.products : [];
  
  const allItems = [...availableServices];
  clientLegacyProducts.forEach(lp => {
    if (!allItems.some(x => (x.name || '').toLowerCase() === (lp.name || '').toLowerCase())) {
      allItems.push(lp);
    }
  });

  if (!allItems.length) {
    wrap.classList.add('d-none');
    return;
  }
  
  wrap.classList.remove('d-none');
  sel.innerHTML = '<option value="">Selecione um serviço cadastrado (opcional)…</option>' + 
                  allItems.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${fmt(p.price || 0)})</option>`).join('');
}

function applyProjClientProd() {
  const clientName = document.getElementById('projClient')?.value;
  const prodId = document.getElementById('projClientProd')?.value;
  if (!clientName || !prodId) return;
  
  const cl = clients.find(c => c.name === clientName);
  const availableServices = getServicesForClient(cl ? cl.id : null);
  const clientLegacyProducts = (cl && Array.isArray(cl.products)) ? cl.products : [];
  const allItems = [...availableServices, ...clientLegacyProducts];
  
  const prod = allItems.find(p => String(p.id) === String(prodId));
  if (!prod) return;
  
  document.getElementById('newProdName').value = prod.name;
  document.getElementById('newProdPrice').value = toBRLInputStr(prod.price || 0);
}

function saveProject(){
  const name=document.getElementById('projName').value.trim();const client=document.getElementById('projClient').value;
  if(!name||!client)return showToast('Cliente e Nome são obrigatórios','warning');
  const id=document.getElementById('projId').value;
  const existingProj = id ? projects.find(x => x.id === parseInt(id)) : null;
  const pData={
    id:id?parseInt(id):Date.now(),
    name,
    client,
    image:document.getElementById('projImage').value.trim(),
    driveLink:document.getElementById('projDriveLink').value.trim(),
    originBudgetId: existingProj?.originBudgetId || null,
    originBudgetNumber: existingProj?.originBudgetNumber || null,
    value:parseCurrencyInput(document.getElementById('projValue').value),
    payments:tempPayments,
    paid:tempPayments.reduce((s,x)=>s+parseFloat(x.amount||0),0),
    installments:tempInstallments,
    paymentCondition:tempPaymentCondition,
    products:tempProds,
    product:tempProds.map(x=>x.name).join(', '),
    type:document.getElementById('projType').value,
    priority:document.getElementById('projPrio').value,
    column:document.getElementById('projCol').value,
    date:document.getElementById('projDate').value,
    note:document.getElementById('projNote').value,
    subtasks:tempSubs,
    archived:false,
    createdAt:id?(projects.find(x=>x.id===parseInt(id))?.createdAt||Date.now()):Date.now()
  };
  if(id){
    const idx=projects.findIndex(x=>x.id===parseInt(id));
    pData.archived=projects[idx]?.archived||false;
    projects[idx]=pData;showToast('Projeto atualizado!','success');
  }
  else{projects.push(pData);showToast('Projeto criado!','success');}
  renderBoard();closeProjectModal();scheduleSync();
  if (typeof renderDashboard === 'function') renderDashboard();
}

function archiveCurrentProject(){
  const id=document.getElementById('projId').value;if(!id)return;
  const idx=projects.findIndex(p=>p.id===parseInt(id));
  if(idx>-1){
    projects[idx].archived=!projects[idx].archived;
    closeProjectModal();renderBoard();scheduleSync();
    showToast(projects[idx].archived?'Projeto arquivado':'Projeto desarquivado','info');
  }
}

function deleteCurrentProject(){
  const id=document.getElementById('projId').value;if(!id)return;
  showConfirm('Excluir este projeto definitivamente?', () => {
    projects=projects.filter(p=>p.id!==parseInt(id));pinnedCards.delete(parseInt(id));
    closeProjectModal();renderBoard();scheduleSync();showToast('Projeto excluído','info');
    if (typeof renderDashboard === 'function') renderDashboard();
  });
}

// ══════════════════════════════════════════
//  SUBTASKS
// ══════════════════════════════════════════
function addSubtask(){
  const val=document.getElementById('newSubTask').value.trim();if(!val)return;
  tempSubs.push({id:Date.now(),text:val,done:false,current:false});
  document.getElementById('newSubTask').value='';renderSubsList();
}
function toggleSubtask(id){
  const s=tempSubs.find(x=>x.id===id);if(!s)return;s.done=!s.done;if(s.done)s.current=false;renderSubsList();
}
function deleteSubtask(id){tempSubs=tempSubs.filter(x=>x.id!==id);renderSubsList();}
function setSubtaskCurrent(id){
  tempSubs.forEach(s => { if(s.id === id) s.current = !s.current; else s.current = false; });
  renderSubsList();
}
function renderSubsList(){
  const c=document.getElementById('subsContainer');const done=tempSubs.filter(s=>s.done).length;
  document.getElementById('subProgress').textContent=`${done}/${tempSubs.length}`;
  if(!tempSubs.length){c.innerHTML='<div class="empty-state" style="padding:16px"><i class="bi bi-list-check"></i><span>Nenhuma tarefa</span></div>';return;}
  const activeSubs = tempSubs.filter(s => s.current && !s.done);
  const currSubs = activeSubs.length ? activeSubs : (tempSubs.find(s => !s.done) ? [tempSubs.find(s => !s.done)] : []);
  const isCurrent = (sId) => currSubs.some(cs => cs.id === sId);
  c.innerHTML=tempSubs.map(s=>`<div class="sub-item ${s.done?'done':''} ${isCurrent(s.id)?'curr':''}">
    <input type="checkbox" ${s.done?'checked':''} onclick="toggleSubtask(${s.id})">
    <span class="sub-text">${s.text}</span>
    <div style="display:flex;gap:4px">
      <button class="cbtn" style="color:${s.current?'var(--yellow)':'var(--text3)'}" onclick="setSubtaskCurrent(${s.id})" title="Foco Principal"><i class="bi bi-lightning-charge"></i></button>
      <button class="cbtn del" onclick="deleteSubtask(${s.id})"><i class="bi bi-trash3"></i></button>
    </div>
  </div>`).join('');
}

// ══════════════════════════════════════════
//  FINANCE IN PROJECT
// ══════════════════════════════════════════
function addPayment(){
  const amount=parseCurrencyInput(document.getElementById('newPayAmount').value),date=document.getElementById('newPayDate').value;
  const method=document.getElementById('newPayMethod')?.value||'Pix';
  if(isNaN(amount)||amount<=0||!date)return showToast('Preencha valores corretos','warning');

  let matchedInstId = null;
  let instDesc = 'Pagamento';
  if (tempInstallments && tempInstallments.length > 0) {
    const pendingInst = tempInstallments.find(x => x.status !== 'Pago' && Math.abs(parseFloat(x.amount || 0) - amount) < 0.01)
                     || tempInstallments.find(x => x.status !== 'Pago');
    if (pendingInst) {
      pendingInst.status = 'Pago';
      pendingInst.paidDate = date;
      pendingInst.method = method;
      matchedInstId = pendingInst.id;
      instDesc = pendingInst.desc;
    }
  }
  tempPayments.push({id:Date.now(), installmentId: matchedInstId, amount, date, method, desc: instDesc});
  document.getElementById('newPayAmount').value='';renderPaymentsModal();
}
function delPayment(id){
  const payToDelete = tempPayments.find(x => x.id === id);
  if (tempInstallments && tempInstallments.length > 0 && payToDelete) {
    let inst = null;
    if (payToDelete.installmentId) {
      inst = tempInstallments.find(x => String(x.id) === String(payToDelete.installmentId));
    }
    if (!inst) {
      inst = tempInstallments.find(x => String(x.id) === String(payToDelete.id));
    }
    if (!inst && payToDelete.desc) {
      inst = tempInstallments.find(x => x.desc === payToDelete.desc && x.status === 'Pago');
    }
    if (!inst) {
      inst = tempInstallments.find(x => x.status === 'Pago' && Math.abs(parseFloat(x.amount || 0) - parseFloat(payToDelete.amount || 0)) < 0.01)
          || tempInstallments.slice().reverse().find(x => x.status === 'Pago');
    }
    if (inst) {
      inst.status = 'Pendente';
      delete inst.paidDate;
      delete inst.method;
    }
  }
  tempPayments=tempPayments.filter(x=>x.id!==id);renderPaymentsModal();
}
function renderPaymentsModal(){
  const c=document.getElementById('paysContainer');
  const total=tempPayments.reduce((s,x)=>s+parseFloat(x.amount||0),0);
  document.getElementById('payProgress').textContent=fmt(total);

  let instHtml = '';
  if (tempInstallments && tempInstallments.length > 0) {
    instHtml = `
      <div style="margin-bottom:10px;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">
        <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;color:var(--text3);margin-bottom:6px;display:flex;justify-content:space-between">
          <span><i class="bi bi-calendar-event"></i> Cronograma (${tempInstallments.length} parcelas)</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${tempInstallments.map(inst => {
            const isPaid = inst.status === 'Pago';
            const dateStr = inst.dueDate ? new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;padding:2px 0">
                <span>${inst.desc} · <span style="color:var(--text3)">Venc: ${dateStr}</span></span>
                <span style="display:inline-flex;align-items:center;gap:6px">
                  <strong style="font-family:'Outfit',sans-serif;font-weight:700">${fmt(inst.amount)}</strong>
                  <span class="badge" style="font-size:9.5px;padding:1px 5px;background:${isPaid ? 'rgba(22,163,74,0.15)' : 'var(--surface)'};color:${isPaid ? 'var(--green)' : 'var(--text3)'}">${isPaid ? '✓ Pago' : '⏳ Pendente'}</span>
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  if(!tempPayments.length){
    c.innerHTML = instHtml + '<div class="empty-state" style="padding:16px"><i class="bi bi-cash-coin"></i><span>Nenhum pagamento registrado</span></div>';
    return;
  }
  c.innerHTML = instHtml + tempPayments.map(p=>`<div class="pay-item"><span>+ ${fmt(p.amount)} em ${new Date(p.date+'T12:00:00').toLocaleDateString('pt-BR')} <span style="color:var(--text3)">· ${p.method||'Pix'}</span></span><button class="cbtn del" onclick="delPayment(${p.id})"><i class="bi bi-trash3"></i></button></div>`).join('');
}

// ══════════════════════════════════════════
//  PRODUCTS IN PROJECT
// ══════════════════════════════════════════
function addProdToProj(){
  const name=document.getElementById('newProdName').value.trim(),price=parseCurrencyInput(document.getElementById('newProdPrice').value);
  if(!name||isNaN(price)||price<=0)return showToast('Valores incorretos','warning');
  tempProds.push({id:Date.now(),name,price});
  document.getElementById('newProdName').value='';document.getElementById('newProdPrice').value='';
  document.getElementById('projClientProd').value='';
  renderProjProdsTable();
}
function removeProdFromProj(id){tempProds=tempProds.filter(p=>p.id!==id);renderProjProdsTable();}
function renderProjProdsTable(){
  const el=document.getElementById('projProdsTable');
  const total=tempProds.reduce((s,p)=>s+parseFloat(p.price||0),0);
  // Só sobrescreve o campo quando há produtos vinculados somando algo — assim
  // um valor de contrato digitado à mão (ou vindo de um pagamento direto sem
  // produtos) não é apagado toda vez que o modal abre/fecha um produto.
  if(total>0) document.getElementById('projValue').value=toBRLInputStr(total);
  if(!tempProds.length){el.innerHTML='<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:10px">Nenhum produto cadastrado</td></tr>';return;}
  el.innerHTML=tempProds.map(p=>`<tr><td style="font-weight:600">${p.name}</td><td style="text-align:right">${fmt(p.price)}</td><td style="text-align:center"><button class="btn btn-ghost btn-sm" style="padding:3px" onclick="removeProdFromProj(${p.id})"><i class="bi bi-trash3"></i></button></td></tr>`).join('');
}

// ══════════════════════════════════════════
//  NOTIFICATIONS CALL (BOARD CARD ACTIONS)
// ══════════════════════════════════════════
function applyQuickMsg(idx){
  const q = quickMsgs[idx];
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
  document.getElementById('quickMsgs').innerHTML=quickMsgs.map((m, idx)=>`<button class="btn btn-ghost btn-sm" style="font-size:11.5px" onclick="applyQuickMsg(${idx})">${m.title}</button>`).join('');
  document.getElementById('notifyOverlay').classList.add('open');
}
function closeNotifyModal(){document.getElementById('notifyOverlay').classList.remove('open');}

// ══════════════════════════════════════════
//  GERENCIAR MENSAGENS RÁPIDAS
// ══════════════════════════════════════════
function openManageQuickMsgsModal(){
  const list = document.getElementById('qmManagerList');
  if (!list) return;
  list.innerHTML = quickMsgs.map(m => `
    <div class="nm-row" style="border:1px solid var(--border);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;gap:6px">
        <input class="inp inp-sm qm-title" value="${m.title.replace(/"/g,'&quot;')}" placeholder="Título do botão" style="flex:1">
        <button class="btn btn-danger btn-sm" onclick="this.closest('.nm-row').remove()" title="Excluir"><i class="bi bi-trash3"></i></button>
      </div>
      <textarea class="inp qm-msg" rows="2" placeholder="Texto da mensagem...">${m.msg}</textarea>
    </div>
  `).join('') || '<p style="font-size:12.5px;color:var(--text3);text-align:center;padding:10px">Nenhuma mensagem rápida ainda.</p>';
  document.getElementById('qmOverlay').classList.add('open');
}
function closeManageQuickMsgsModal(){document.getElementById('qmOverlay').classList.remove('open');}
function addQuickMsgInput(){
  const list = document.getElementById('qmManagerList');
  const empty = list.querySelector('p');
  if (empty) empty.remove();
  const row = document.createElement('div');
  row.className = 'nm-row';
  row.style.cssText = 'border:1px solid var(--border);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px';
  row.innerHTML = `
    <div style="display:flex;gap:6px">
      <input class="inp inp-sm qm-title" placeholder="Título do botão" style="flex:1">
      <button class="btn btn-danger btn-sm" onclick="this.closest('.nm-row').remove()" title="Excluir"><i class="bi bi-trash3"></i></button>
    </div>
    <textarea class="inp qm-msg" rows="2" placeholder="Texto da mensagem..."></textarea>
  `;
  list.appendChild(row);
  row.querySelector('.qm-title').focus();
}
function saveQuickMsgs(){
  const rows = document.querySelectorAll('#qmManagerList .nm-row');
  const updated = [];
  rows.forEach(r => {
    const title = r.querySelector('.qm-title').value.trim();
    const msg = r.querySelector('.qm-msg').value.trim();
    if (title && msg) updated.push({ title, msg });
  });
  quickMsgs = updated;
  scheduleSync();
  closeManageQuickMsgsModal();
  showToast('Mensagens rápidas atualizadas!', 'success');
}
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
//  SELECT & FILTER UPDATES
// ══════════════════════════════════════════
function updateProjClientSelect(){
  const sel=document.getElementById('projClient');
  if(!sel) return;
  const cur=sel.value;
  sel.innerHTML='<option value="">Selecione…</option>'+clients.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
  if(cur)sel.value=cur;
}
function updateProjColSelect(){
  const el = document.getElementById('projCol');
  if(el) el.innerHTML=appColumns.map(c=>`<option value="${c.id}">${c.id}</option>`).join('');
}
function updateClientFilter(){
  const list = clients.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
  
  const sel=document.getElementById('fClient');
  if(sel) {
    const cur=sel.value;
    sel.innerHTML='<option value="">Todos os Clientes</option>'+list;
    if(cur)sel.value=cur;
  }
}

// ══════════════════════════════════════════
//  MANAGE COLUMNS
// ══════════════════════════════════════════
function colIconOptions(sel){return COL_ICONS.map(o=>`<option value="${o.v}" ${o.v===sel?'selected':''}>${o.l}</option>`).join('');}
function openManageColumnsModal(){
  document.getElementById('colManagerList').innerHTML=appColumns.map(c=>`<div class="cm-row" data-orig="${c.id}"><select class="inp inp-sm cm-icon">${colIconOptions(c.icon)}</select><input type="color" class="cm-color" value="${c.color||DEFAULT_COL_COLOR}" title="Cor da coluna"><input class="inp inp-sm" value="${c.id}" style="flex:1"><label class="cm-final" title="Etapa concluída (conta nos relatórios e some o selo de prioridade — o projeto ainda aparece pro cliente)"><input type="checkbox" class="cm-isfinal" ${isFinalColumn(c.id)?'checked':''}><i class="bi bi-flag-fill"></i></label><label class="cm-hidden" title="Projeto encerrado (já entregue/pago — some do painel do cliente e vira cartão compacto no quadro)"><input type="checkbox" class="cm-hideclient" ${isHiddenColumn(c.id)?'checked':''}><i class="bi bi-eye-slash-fill"></i></label><button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><i class="bi bi-trash3"></i></button></div>`).join('');
  document.getElementById('colsOverlay').classList.add('open');
}
function closeManageColumnsModal(){document.getElementById('colsOverlay').classList.remove('open');}
function addColInput(){document.getElementById('colManagerList').innerHTML+=`<div class="cm-row" data-orig=""><select class="inp inp-sm cm-icon">${colIconOptions()}</select><input type="color" class="cm-color" value="${DEFAULT_COL_COLOR}" title="Cor da coluna"><input class="inp inp-sm" placeholder="Nome da coluna" style="flex:1"><label class="cm-final" title="Etapa concluída (conta nos relatórios e some o selo de prioridade — o projeto ainda aparece pro cliente)"><input type="checkbox" class="cm-isfinal"><i class="bi bi-flag-fill"></i></label><label class="cm-hidden" title="Projeto encerrado (já entregue/pago — some do painel do cliente e vira cartão compacto no quadro)"><input type="checkbox" class="cm-hideclient"><i class="bi bi-eye-slash-fill"></i></label><button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><i class="bi bi-trash3"></i></button></div>`;}
function saveColumnsConfig(){
  const rows=document.querySelectorAll('#colManagerList .cm-row'),newCols=[],map={};
  rows.forEach(r=>{const orig=r.dataset.orig,icon=r.querySelector('select').value,color=r.querySelectorAll('input')[0].value,name=r.querySelectorAll('input')[1].value.trim(),isFinal=r.querySelector('.cm-isfinal').checked,hideClient=r.querySelector('.cm-hideclient').checked;if(name){newCols.push({id:name,icon,color,isFinal,hideClient});if(orig&&orig!==name)map[orig]=name;}});
  if(!newCols.length)return showToast('Ao menos uma coluna!','warning');
  projects.forEach(p=>{if(map[p.column])p.column=map[p.column];if(!newCols.find(c=>c.id===p.column))p.column=newCols[0].id;});
  appColumns=newCols;visibleColumns=appColumns.map(c=>c.id);minimizedColumns=[];
  updateProjColSelect();renderBoard();closeManageColumnsModal();scheduleSync();showToast('Colunas atualizadas!','success');
}



function moveNext(id){
  const p=projects.find(x=>x.id===id);if(!p)return;
  const cols=appColumns.filter(c=>visibleColumns.includes(c.id));
  const idx=cols.findIndex(c=>c.id===p.column);
  if(idx===-1||idx===cols.length-1)return showToast('Já na última etapa','info');
  p.column=cols[idx+1].id;
  renderBoard();scheduleSync();
  if(isHiddenColumn(p.column)) showToast(`➡ ${p.column} — não aparece mais pro cliente`,'warning');
  else showToast(`➡ ${p.column}`,'info');
}

function toggleFinHist(id){if(expandedFin.has(id))expandedFin.delete(id);else expandedFin.add(id);renderBoard();}
function toggleSub(pId,sId){
  const p=projects.find(x=>x.id===pId);if(!p)return;
  const s=p.subtasks?.find(x=>x.id===sId);
  if(s){
    s.done=!s.done;
    if(s.done) s.current=false;
    renderBoard();
    scheduleSync();
  }
}
function toggleSubActive(pId,sId){
  const p=projects.find(x=>x.id===pId);if(!p)return;
  p.subtasks?.forEach(s=>{
    if(s.id===sId){
      s.current = !s.current;
      if(s.current) s.done = false;
    }
  });
  renderBoard();
  scheduleSync();
}

function editProject(id){openProjectModal(id);}

function archiveProject(id){
  const idx=projects.findIndex(p=>p.id===id);
  if(idx>-1){
    projects[idx].archived=true;
    renderBoard();
    scheduleSync();
    showToast('Arquivado','info');
  }
}

function deleteProject(id,fromArch=false){
  showConfirm('Excluir definitivamente?', () => {
    projects=projects.filter(p=>p.id!==id);
    pinnedCards.delete(id);
    expandedFin.delete(id);
    if(fromArch && typeof renderArchived === 'function') renderArchived();
    renderBoard();
    scheduleSync();
    showToast('Excluído','info');
  });
}

// ══════════════════════════════════════════
//  WHATSAPP HANDLERS
// ══════════════════════════════════════════
const WA_PRESETS = {
  default: null,
  update: `Olá, *{Cliente}*!

Passando para informar sobre o andamento do projeto *{Projeto}*:

*Etapa atual:* {Etapa}
*Prazo:* {Prazo}
{TarefaAtual}
{Observacao}
{LinkPainel}
_Equipe MAVIC Projetos_`,

  payment: `Olá, *{Cliente}*!

Segue o resumo financeiro do projeto *{Projeto}*:

*Valor contratado:* {ValorTotal}
*Pago:* {ValorPago} | *Pendente:* {SaldoPendente}
{DadosPix}
Dúvidas, estamos à disposição!
_Equipe MAVIC Projetos_`,

  completed: `Olá, *{Cliente}*!

Projeto *{Projeto}* concluído com sucesso! 🎉

Você pode visualizar e acessar todos os arquivos nos links abaixo:
{LinkPainel}
{LinkDrive}
Agradecemos a confiança!
_Equipe MAVIC Projetos_`
};

function getWaPrefs() {
  try {
    const raw = localStorage.getItem('mavic_waPrefs');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { pix: true, link: false, drive: false };
}

function saveWaPrefs() {
  const pixBox = document.getElementById('waIncludePix');
  const linkBox = document.getElementById('waIncludeLink');
  const driveBox = document.getElementById('waIncludeDrive');
  const prefs = {
    pix: pixBox ? pixBox.checked : true,
    link: linkBox ? linkBox.checked : false,
    drive: driveBox ? driveBox.checked : false
  };
  localStorage.setItem('mavic_waPrefs', JSON.stringify(prefs));
}

function buildWhatsAppMsg(projId, customTemplate = null){
  const p=projects.find(x=>x.id===projId);if(!p)return {msg:'',waLinkBlock:'',waPixBlock:'',waDriveBlock:'',hasLinkTag:false,hasPixTag:false,hasDriveTag:false};
  const cli=clients.find(c=>c.name===p.client);
  const pays=p.payments||[];
  const total=parseFloat(p.value||0);
  const paid=pays.reduce((s,x)=>s+parseFloat(x.amount||0),0);
  const rest=total-paid;
  const link=cli?.token?buildLink(cli.name,cli.token):'';
  const dl=p.date?new Date(p.date+'T12:00:00').toLocaleDateString('pt-BR'):'Sem prazo';
  const firstName=p.client?(p.client.trim().split(' ')[0]):'';
  const pixKey=(localStorage.getItem('mavic_pixKey')||'').trim();
  const pixName=(localStorage.getItem('mavic_pixName')||'').trim();
  const pixBank=(localStorage.getItem('mavic_pixBank')||'').trim();

  const activeSubs = (p.subtasks || []).filter(s => s.current && !s.done);
  const currSubs = activeSubs.length ? activeSubs : ((p.subtasks || []).find(s => !s.done) ? [(p.subtasks || []).find(s => !s.done)] : []);

  let subtaskText = '';
  if (currSubs.length === 1) {
    subtaskText = `*Foco atual:* ${currSubs[0].text}`;
  } else if (currSubs.length > 1) {
    subtaskText = `*Foco atual:*\n` + currSubs.map(cs => `• ${cs.text}`).join('\n');
  }

  const waLinkBlock=link?`\n*Seu painel:*\n${link}\n`:'';
  const waPixBlock=pixKey?`\n*Dados para PIX:*\n*Chave:* ${pixKey}\n*Titular:* ${pixName}\n*Banco:* ${pixBank}\n`:'';
  const waDriveBlock=(p.driveLink && p.driveLink.trim())?`\n*Pasta de arquivos:*\n${p.driveLink.trim()}\n`:'';

  const linkBox=document.getElementById('waIncludeLink');
  const pixBox=document.getElementById('waIncludePix');
  const driveBox=document.getElementById('waIncludeDrive');

  let template = customTemplate || localStorage.getItem('mavic_waTemplate') || DEFAULT_WA_TEMPLATE;
  let msg = template
    .replace(/{Cliente}/g, firstName)
    .replace(/{ClienteCompleto}/g, p.client || '')
    .replace(/{Projeto}/g, p.name || '')
    .replace(/{Etapa}/g, p.column || '')
    .replace(/{Prazo}/g, dl)
    .replace(/{ValorTotal}/g, fmt(total))
    .replace(/{ValorPago}/g, fmt(paid))
    .replace(/{SaldoPendente}/g, rest <= 0 ? 'Quitado' : fmt(rest))
    .replace(/{Observacao}/g, p.note ? `_${p.note}_` : '')
    .replace(/{TarefaAtual}/g, subtaskText);

  const hasLinkTag = template.includes('{LinkPainel}');
  const hasPixTag = template.includes('{DadosPix}');
  const hasDriveTag = template.includes('{LinkDrive}');

  if (hasLinkTag) {
    msg = msg.replace(/{LinkPainel}/g, (linkBox && linkBox.checked) ? waLinkBlock : '');
  }
  if (hasPixTag) {
    msg = msg.replace(/{DadosPix}/g, (pixBox && pixBox.checked) ? waPixBlock : '');
  }
  if (hasDriveTag) {
    msg = msg.replace(/{LinkDrive}/g, (driveBox && driveBox.checked) ? waDriveBlock : '');
  }

  return { msg, waLinkBlock, waPixBlock, waDriveBlock, hasLinkTag, hasPixTag, hasDriveTag };
}

function applyWaPreset(presetKey) {
  const projId = parseInt(document.getElementById('waOverlay').dataset.projId);
  const presetTemplate = WA_PRESETS[presetKey] || null;
  const res = buildWhatsAppMsg(projId, presetTemplate);
  document.getElementById('waMsg').value = cleanNewlines(res.msg);

  const linkBox = document.getElementById('waIncludeLink');
  const pixBox = document.getElementById('waIncludePix');
  const driveBox = document.getElementById('waIncludeDrive');

  if (!res.hasLinkTag && linkBox && linkBox.checked) insertBlock(res.waLinkBlock);
  if (!res.hasPixTag && pixBox && pixBox.checked) insertBlock(res.waPixBlock);
  if (!res.hasDriveTag && driveBox && driveBox.checked) insertBlock(res.waDriveBlock);

  document.getElementById('waMsg').value = cleanNewlines(document.getElementById('waMsg').value);
}

function openWhatsApp(projId){
  document.getElementById('waOverlay').dataset.projId = projId;
  const p=projects.find(x=>x.id===projId);if(!p)return;
  const cli=clients.find(c=>c.name===p.client);
  const link=cli?.token?buildLink(cli.name,cli.token):'';
  const pixKey=(localStorage.getItem('mavic_pixKey')||'').trim();
  const driveLink=(p.driveLink||'').trim();
  const prefs = getWaPrefs();

  const linkWrap=document.getElementById('waLinkWrap');
  const linkBox=document.getElementById('waIncludeLink');
  if(link){linkWrap.style.display='';linkBox.checked=prefs.link;}
  else{linkWrap.style.display='none';linkBox.checked=false;}

  const pixWrap=document.getElementById('waPixWrap');
  const pixBox=document.getElementById('waIncludePix');
  if(pixKey){pixWrap.style.display='';pixBox.checked=prefs.pix;}
  else{pixWrap.style.display='none';pixBox.checked=false;}

  const driveWrap=document.getElementById('waDriveWrap');
  const driveBox=document.getElementById('waIncludeDrive');
  if(driveWrap && driveBox){
    if(driveLink){driveWrap.style.display='';driveBox.checked=prefs.drive;}
    else{driveWrap.style.display='none';driveBox.checked=false;}
  }

  const presetSel = document.getElementById('waPresetSelect');
  if (presetSel) presetSel.value = 'default';

  const rawPhone = cli?.phone || '';
  document.getElementById('waPhone').value = typeof formatPhoneMask === 'function' ? formatPhoneMask(rawPhone) : rawPhone;

  const res = buildWhatsAppMsg(projId);
  document.getElementById('waMsg').value=cleanNewlines(res.msg);

  if (!res.hasLinkTag && linkBox && linkBox.checked) insertBlock(res.waLinkBlock);
  if (!res.hasPixTag && pixBox && pixBox.checked) insertBlock(res.waPixBlock);
  if (!res.hasDriveTag && driveBox && driveBox.checked) insertBlock(res.waDriveBlock);

  document.getElementById('waMsg').value=cleanNewlines(document.getElementById('waMsg').value);

  document.getElementById('waOverlay').classList.add('open');
}

function cleanNewlines(text) {
  if (!text) return '';
  return text
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function insertBlock(block){
  const ta=document.getElementById('waMsg');
  if(!block||ta.value.includes(block))return;
  const marker='_Equipe MAVIC Projetos_';
  const idx=ta.value.indexOf(marker);
  if(idx>=0)ta.value=ta.value.slice(0,idx)+block+'\n'+ta.value.slice(idx);
  else ta.value+=block;
  ta.value = cleanNewlines(ta.value);
}
function removeBlock(block){
  const ta=document.getElementById('waMsg');
  if(!block)return;
  ta.value=ta.value.split(block+'\n').join('').split(block).join('');
  ta.value = cleanNewlines(ta.value);
}
function toggleWaPix(){
  saveWaPrefs();
  const projId = parseInt(document.getElementById('waOverlay').dataset.projId);
  const box=document.getElementById('waIncludePix');
  const presetVal = document.getElementById('waPresetSelect')?.value || 'default';
  const presetTpl = WA_PRESETS[presetVal] || null;
  const res = buildWhatsAppMsg(projId, presetTpl);
  if (res.hasPixTag) {
    document.getElementById('waMsg').value = cleanNewlines(res.msg);
  } else {
    if(box.checked)insertBlock(res.waPixBlock);else removeBlock(res.waPixBlock);
    document.getElementById('waMsg').value = cleanNewlines(document.getElementById('waMsg').value);
  }
}
function toggleWaLink(){
  saveWaPrefs();
  const projId = parseInt(document.getElementById('waOverlay').dataset.projId);
  const box=document.getElementById('waIncludeLink');
  const presetVal = document.getElementById('waPresetSelect')?.value || 'default';
  const presetTpl = WA_PRESETS[presetVal] || null;
  const res = buildWhatsAppMsg(projId, presetTpl);
  if (res.hasLinkTag) {
    document.getElementById('waMsg').value = cleanNewlines(res.msg);
  } else {
    if(box.checked)insertBlock(res.waLinkBlock);else removeBlock(res.waLinkBlock);
    document.getElementById('waMsg').value = cleanNewlines(document.getElementById('waMsg').value);
  }
}
function toggleWaDrive(){
  saveWaPrefs();
  const projId = parseInt(document.getElementById('waOverlay').dataset.projId);
  const box=document.getElementById('waIncludeDrive');
  const presetVal = document.getElementById('waPresetSelect')?.value || 'default';
  const presetTpl = WA_PRESETS[presetVal] || null;
  const res = buildWhatsAppMsg(projId, presetTpl);
  if (res.hasDriveTag) {
    document.getElementById('waMsg').value = cleanNewlines(res.msg);
  } else {
    if(box && box.checked)insertBlock(res.waDriveBlock);else removeBlock(res.waDriveBlock);
    document.getElementById('waMsg').value = cleanNewlines(document.getElementById('waMsg').value);
  }
}
function closeWaModal(){document.getElementById('waOverlay').classList.remove('open');}
function copyWhatsAppMsg(){
  const msg=document.getElementById('waMsg').value.trim();
  copyText(msg, 'Mensagem copiada para a área de transferência! 📋');
}
function sendWhatsApp(){
  const msg=document.getElementById('waMsg').value.trim();
  const rawPhone=document.getElementById('waPhone').value.replace(/\D/g,'');
  const waUrl=rawPhone
    ?`https://wa.me/55${rawPhone}?text=${encodeURIComponent(msg)}`
    :`https://wa.me/?text=${encodeURIComponent(msg)}`;
  
  if(navigator.clipboard&&window.isSecureContext){
    navigator.clipboard.writeText(msg).then(()=>{
      showToast('Mensagem copiada e abrindo WhatsApp! 📱', 'success');
      setTimeout(()=>window.open(waUrl,'_blank'), 200);
    }).catch(()=>{
      window.open(waUrl,'_blank');
    });
  } else {
    window.open(waUrl,'_blank');
  }
  closeWaModal();
}

// ══════════════════════════════════════════
//  SHARE LINK AND COPY
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

