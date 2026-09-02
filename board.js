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
  const savedFin = sessionStorage.getItem('board_fFinance');
  const savedTag = sessionStorage.getItem('board_fTag');
  const savedSearch = sessionStorage.getItem('board_srch');

  if(savedType && document.getElementById('fType')) document.getElementById('fType').value = savedType;
  if(savedPrio && document.getElementById('fPrio')) document.getElementById('fPrio').value = savedPrio;
  if(savedCli && document.getElementById('fClient')) document.getElementById('fClient').value = savedCli;
  if(savedFin && document.getElementById('fFinance')) document.getElementById('fFinance').value = savedFin;
  if(savedTag && document.getElementById('fTag')) document.getElementById('fTag').value = savedTag;
  if(savedSearch && document.getElementById('srch')) document.getElementById('srch').value = savedSearch;

  if (localStorage.getItem('mavic_weekSummaryOpen') === 'true') {
    const bar = document.getElementById('weekSummaryBar');
    const btn = document.getElementById('btnToggleWeekSummary');
    if (bar) { bar.style.display = 'flex'; bar.classList.remove('d-none'); }
    if (btn) btn.classList.add('active');
  }

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

function matchesFinanceFilter(p, filter) {
  if (!filter) return true;
  const total = parseFloat(p.value || 0);
  const pays = p.payments || [];
  const paid = pays.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  const rest = total - paid;
  const insts = Array.isArray(p.installments) ? p.installments : [];
  const todayObj = new Date().setHours(0, 0, 0, 0);

  if (filter === 'paid') {
    return total > 0 && rest <= 0.01;
  }
  if (filter === 'pending') {
    return rest > 0.01;
  }
  if (filter === 'overdue') {
    if (insts.length > 0) {
      return insts.some(inst => {
        if (!inst || inst.status === 'Pago' || !inst.dueDate) return false;
        const dDue = new Date(inst.dueDate + 'T12:00:00');
        return Math.ceil((dDue - todayObj) / 86400000) < 0;
      });
    }
    if (p.date && rest > 0.01) {
      const dDue = new Date(p.date + 'T12:00:00');
      return Math.ceil((dDue - todayObj) / 86400000) < 0;
    }
    return false;
  }
  if (filter === 'upcoming') {
    if (insts.length > 0) {
      return insts.some(inst => {
        if (!inst || inst.status === 'Pago' || !inst.dueDate) return false;
        const dDue = new Date(inst.dueDate + 'T12:00:00');
        const diff = Math.ceil((dDue - todayObj) / 86400000);
        return diff >= 0 && diff <= 7;
      });
    }
    if (p.date && rest > 0.01) {
      const dDue = new Date(p.date + 'T12:00:00');
      const diff = Math.ceil((dDue - todayObj) / 86400000);
      return diff >= 0 && diff <= 7;
    }
    return false;
  }
  return true;
}

function updateTagFilter() {
  const sel = document.getElementById('fTag');
  if (!sel) return;
  const cur = sel.value;
  const tagSet = new Set();
  projects.forEach(p => {
    (Array.isArray(p.tags) ? p.tags : []).forEach(t => {
      const clean = (t || '').trim();
      if (clean) tagSet.add(clean);
    });
  });
  const tags = Array.from(tagSet).sort();
  sel.innerHTML = '<option value="">Todas as Tags</option>' + tags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  if (cur && tags.includes(cur)) sel.value = cur;
}

function addTagToInput(tag) {
  const inp = document.getElementById('projTags');
  if (!inp) return;
  const current = inp.value.split(',').map(s => s.trim()).filter(Boolean);
  if (!current.includes(tag)) {
    current.push(tag);
    inp.value = current.join(', ');
  }
}

function renderWeekSummary() {
  const bar = document.getElementById('weekSummaryBar');
  if (!bar) return;
  
  const todayStr = today();
  const next7Str = (typeof addDays === 'function') ? addDays(todayStr, 7) : todayStr;

  // Entregas da semana (próximos 7 dias)
  const weekProjs = projects.filter(p => !p.archived && !isFinalColumn(p.column) && p.date && p.date >= todayStr && p.date <= next7Str);
  const countDeliveriesEl = document.getElementById('weekDeliveriesCount');
  if (countDeliveriesEl) {
    countDeliveriesEl.textContent = `${weekProjs.length} projeto${weekProjs.length !== 1 ? 's' : ''}`;
  }

  // Recebimentos previstos da semana
  let sumReceivables = 0;
  let countInsts = 0;
  projects.forEach(p => {
    if (p.archived) return;
    (p.installments || []).forEach(inst => {
      if (inst.status !== 'Pago' && inst.dueDate && inst.dueDate >= todayStr && inst.dueDate <= next7Str) {
        sumReceivables += parseFloat(inst.amount || 0);
        countInsts++;
      }
    });
  });

  const sumReceivablesEl = document.getElementById('weekReceivablesSum');
  if (sumReceivablesEl) {
    sumReceivablesEl.textContent = fmt(sumReceivables);
  }

  const itemsEl = document.getElementById('weekSummaryItems');
  if (itemsEl) {
    const list = [];
    weekProjs.slice(0, 3).forEach(wp => {
      const d = wp.date ? new Date(wp.date + 'T12:00:00').toLocaleDateString('pt-BR') : '';
      list.push(`<span class="badge" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);font-size:11.5px"><i class="bi bi-box-seam me-1"></i> ${escapeHtml(wp.name)} (${d})</span>`);
    });
    if (weekProjs.length > 3) {
      list.push(`<span class="badge" style="background:var(--surface2);border:1px solid var(--border);color:var(--text3);font-size:11.5px">+${weekProjs.length - 3} mais</span>`);
    }
    itemsEl.innerHTML = list.join('');
  }
}

function toggleWeekSummary() {
  const bar = document.getElementById('weekSummaryBar');
  const btn = document.getElementById('btnToggleWeekSummary');
  if (!bar) return;
  const isHidden = bar.style.display === 'none' || bar.classList.contains('d-none');
  if (isHidden) {
    bar.style.display = 'flex';
    bar.classList.remove('d-none');
    if (btn) btn.classList.add('active');
    localStorage.setItem('mavic_weekSummaryOpen', 'true');
    renderWeekSummary();
  } else {
    bar.style.display = 'none';
    bar.classList.add('d-none');
    if (btn) btn.classList.remove('active');
    localStorage.setItem('mavic_weekSummaryOpen', 'false');
  }
}

function clearBoardFilters(){
  const srch = document.getElementById('srch');
  const fType = document.getElementById('fType');
  const fPrio = document.getElementById('fPrio');
  const fClient = document.getElementById('fClient');
  const fFinance = document.getElementById('fFinance');
  const fTag = document.getElementById('fTag');
  if (srch) srch.value = '';
  if (fType) fType.value = '';
  if (fPrio) fPrio.value = '';
  if (fClient) fClient.value = '';
  if (fFinance) fFinance.value = '';
  if (fTag) fTag.value = '';
  renderBoard();
}

function renderBoard(){
  const board=document.getElementById('board');
  if(!board) return;
  board.innerHTML='';
  updateTagFilter();
  renderWeekSummary();

  const fType=document.getElementById('fType')?.value || '';
  const fPrio=document.getElementById('fPrio')?.value || '';
  const fCli=document.getElementById('fClient')?.value || '';
  const fFin=document.getElementById('fFinance')?.value || '';
  const fTag=document.getElementById('fTag')?.value || '';
  const srchEl=document.getElementById('srch');
  const srch=srchEl ? srchEl.value.toLowerCase().trim() : '';

  // Destaque visual dos filtros ativos e exibição do botão limpar
  const isFiltered = Boolean(fType || fPrio || fCli || fFin || fTag || srch);
  const clearBtn = document.getElementById('btnClearBoardFilters');
  if (clearBtn) clearBtn.style.display = isFiltered ? 'inline-flex' : 'none';

  const fTypeEl = document.getElementById('fType');
  const fPrioEl = document.getElementById('fPrio');
  const fCliEl = document.getElementById('fClient');
  const fFinEl = document.getElementById('fFinance');
  const fTagEl = document.getElementById('fTag');
  if (fTypeEl) fTypeEl.classList.toggle('filter-active', Boolean(fType));
  if (fPrioEl) fPrioEl.classList.toggle('filter-active', Boolean(fPrio));
  if (fCliEl) fCliEl.classList.toggle('filter-active', Boolean(fCli));
  if (fFinEl) fFinEl.classList.toggle('filter-active', Boolean(fFin));
  if (fTagEl) fTagEl.classList.toggle('filter-active', Boolean(fTag));
  if (srchEl) srchEl.classList.toggle('filter-active', Boolean(srch));

  // Persistir filtros no sessionStorage
  sessionStorage.setItem('board_fType', fType);
  sessionStorage.setItem('board_fPrio', fPrio);
  sessionStorage.setItem('board_fClient', fCli);
  sessionStorage.setItem('board_fFinance', fFin);
  sessionStorage.setItem('board_fTag', fTag);
  sessionStorage.setItem('board_srch', srchEl ? srchEl.value : '');

  let total=0;
  const visibleCols = appColumns.filter(c=>visibleColumns.includes(c.id));
  const isMobile = Boolean(window.matchMedia && window.matchMedia('(max-width:768px)').matches);

  const filterProj = (p, colId) => {
    if (p.archived || p.column !== colId) return false;
    if (fType && p.type !== fType) return false;
    if (fPrio && p.priority !== fPrio) return false;
    if (fCli && p.client !== fCli) return false;
    if (!matchesFinanceFilter(p, fFin)) return false;
    if (fTag && !(Array.isArray(p.tags) && p.tags.includes(fTag))) return false;
    if (srch && !((p.name || '').toLowerCase().includes(srch) || (p.client || '').toLowerCase().includes(srch) || (p.tags || []).some(t => (t || '').toLowerCase().includes(srch)))) return false;
    return true;
  };

  // Calcular contagens para os pills mobile
  const columnsWithCounts = visibleCols.map(col => {
    const colProjs = projects.filter(p => filterProj(p, col.id));
    total += colProjs.length;
    return { id: col.id, icon: col.icon, color: col.color, count: colProjs.length };
  });

  renderBoardColPills(columnsWithCounts, total);

  const colsToRender = (isMobile && activeMobileCol !== 'all')
    ? visibleCols.filter(c => c.id === activeMobileCol)
    : visibleCols;
  
  colsToRender.forEach(col=>{
    const isMin=minimizedColumns.includes(col.id);
    let colProjs=projects.filter(p => filterProj(p, col.id));
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
  
  // Próxima parcela a vencer ou parcela vencida
  const pendingInsts = (Array.isArray(p.installments) ? p.installments : []).filter(x => x && x.status !== 'Pago');
  let instBadge = '';
  if (pendingInsts.length > 0) {
    const sortedPending = pendingInsts.slice().sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate + 'T12:00:00') - new Date(b.dueDate + 'T12:00:00');
    });
    const nextInst = sortedPending[0];
    if (nextInst && nextInst.dueDate) {
      const dInst = new Date(nextInst.dueDate + 'T12:00:00');
      const diffInst = Math.ceil((dInst - new Date().setHours(0,0,0,0))/86400000);
      const dateStr = dInst.toLocaleDateString('pt-BR');
      if (diffInst < 0) {
        instBadge = `<div style="margin-top:4px"><span class="badge b-venc" style="font-size:10px;padding:2px 6px;display:inline-flex;align-items:center;gap:4px" title="Parcela de ${fmt(nextInst.amount)} vencida em ${dateStr}"><i class="bi bi-exclamation-triangle-fill"></i> Parcela vencida (${dateStr} · ${fmt(nextInst.amount)})</span></div>`;
      } else if (diffInst === 0) {
        instBadge = `<div style="margin-top:4px"><span class="badge b-urg" style="font-size:10px;padding:2px 6px;display:inline-flex;align-items:center;gap:4px" title="Parcela de ${fmt(nextInst.amount)} vence hoje!"><i class="bi bi-alarm-fill"></i> Parcela vence hoje (${fmt(nextInst.amount)})</span></div>`;
      } else if (diffInst <= 3) {
        instBadge = `<div style="margin-top:4px"><span class="badge b-urg" style="font-size:10px;padding:2px 6px;display:inline-flex;align-items:center;gap:4px" title="Parcela de ${fmt(nextInst.amount)} vence em ${diffInst} dias"><i class="bi bi-clock-fill"></i> Parcela em ${diffInst}d (${dateStr})</span></div>`;
      } else {
        instBadge = `<div style="margin-top:4px"><span class="badge" style="font-size:10px;padding:2px 6px;background:var(--surface2);color:var(--text2);display:inline-flex;align-items:center;gap:4px" title="Próxima parcela: ${fmt(nextInst.amount)} em ${dateStr}"><i class="bi bi-calendar-event"></i> Próx. Parcela: ${dateStr} (${fmt(nextInst.amount)})</span></div>`;
      }
    }
  }

  let finHtml='';
  if(total>0){
    let instListHtml = '';
    if (Array.isArray(p.installments) && p.installments.length > 0) {
      instListHtml = `
        <div style="padding:6px 8px;background:var(--surface2);border-radius:6px;margin-bottom:6px;font-size:11px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:4px;display:flex;justify-content:space-between">
            <span><i class="bi bi-calendar-event"></i> Cronograma (${p.installments.length} parcelas)</span>
          </div>
          ${p.installments.map(inst => {
            const isP = inst.status === 'Pago';
            const dStr = inst.dueDate ? new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px dashed var(--border)">
                <span>${escapeHtml(inst.desc || 'Parcela')} <span style="color:var(--text3);font-size:10px">(${dStr})</span></span>
                <span style="display:flex;align-items:center;gap:4px">
                  <strong style="font-family:'Outfit',sans-serif">${fmt(inst.amount)}</strong>
                  ${!isP ? `
                    <button type="button" class="btn-quick-pay" style="padding:1px 5px;font-size:9.5px;border-radius:4px" onclick="quickPayFromCard(${p.id}, ${inst.id});event.stopPropagation()" title="Dar baixa nesta parcela com 1 clique">
                      <i class="bi bi-check2"></i> Receber
                    </button>
                    <button type="button" class="cbtn" style="color:#25D366;font-size:11px;padding:2px" onclick="openWhatsAppInstallment(${p.id}, ${inst.id});event.stopPropagation()" title="Lembrar cobrança via WhatsApp"><i class="bi bi-whatsapp"></i></button>
                  ` : `
                    <span class="badge" style="font-size:9px;padding:1px 4px;background:rgba(22,163,74,0.15);color:var(--green)">✓ Pago</span>
                  `}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    const hRows=pays.length?pays.map(pg=>`
      <div class="fin-hist-item" style="display:flex;justify-content:space-between;align-items:center">
        <span style="color:var(--text3);font-size:11px"><i class="bi bi-calendar3"></i> ${pg.date?new Date(pg.date+'T12:00:00').toLocaleDateString('pt-BR'):'—'} · ${escapeHtml(pg.method||'Pix')}</span>
        <span style="display:flex;align-items:center;gap:4px">
          <span class="fv" style="font-family:'Outfit',sans-serif;font-weight:700">+${fmt(pg.amount)}</span>
          <button class="cbtn" style="color:#25D366;font-size:11px;padding:2px" onclick="openWhatsAppReceipt(${p.id}, ${pg.id});event.stopPropagation()" title="Enviar comprovante pelo WhatsApp"><i class="bi bi-whatsapp"></i></button>
        </span>
      </div>
    `).join(''):'<div class="fin-hist-item" style="color:var(--text3);justify-content:center;font-size:11px">Nenhum pagamento registrado</div>';
    
    finHtml=`<div class="fin-blk"><div class="fin-sum"><div class="fin-row"><span class="lbl">Contrato</span><span class="val" style="font-family:'Outfit',sans-serif;font-weight:700">${fmt(total)}</span></div><div class="fin-row"><span class="lbl">Recebido</span><span class="val" style="color:var(--green);font-family:'Outfit',sans-serif;font-weight:700">${fmt(paid)}</span></div><div class="fin-row" style="border-top:1px solid var(--border);padding-top:3px;margin-top:2px"><span class="lbl">Saldo</span><span class="val" style="color:${rest>0?'var(--red)':'var(--text3)'};font-family:'Outfit',sans-serif;font-weight:700">${fmt(rest)} <span class="badge ${sClass}" style="font-size:10px">${sLabel}</span></span></div></div><button class="fin-hist-btn" onclick="toggleFinHist(${p.id});event.stopPropagation()"><i class="bi bi-clock-history"></i> ${pays.length} recebimento${pays.length!==1?'s':''} ${Array.isArray(p.installments)&&p.installments.length?`· ${p.installments.length} parcelas`:''} <i class="bi bi-chevron-${isExp?'up':'down'}" style="float:right;margin-top:1px;font-size:10px"></i></button><div class="fin-hist-rows ${isExp?'':'d-none'}">${instListHtml}${pays.length>0?`<div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin:4px 0 2px 2px"><i class="bi bi-cash-stack"></i> Recebimentos Efetuados</div>`:''}${hRows}</div></div>`;
  }
  let checkHtml='';
  if(subs.length){
    const rows=subs.map(s=>{
      const sIsCurrent = isCurrent(s.id);
      const playIcon = s.done ? '' : `<i class="bi ${s.current?'bi-play-circle-fill':'bi-play-circle'}" style="cursor:pointer;color:${s.current?'var(--accent)':'var(--text3)'};font-size:13px;margin-right:2px" onclick="toggleSubActive(${p.id},${s.id});event.stopPropagation()" title="Definir foco atual"></i>`;
      return `<div class="sub-row ${sIsCurrent?'sub-in-progress':''}">${playIcon}<input type="checkbox" ${s.done?'checked':''} onclick="toggleSub(${p.id},${s.id});event.stopPropagation()"><span class="${s.done?'sub-done':''}">${s.text}</span></div>`;
    }).join('');
    checkHtml=`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-top:7px"><div style="padding:5px 8px;display:flex;justify-content:space-between;font-size:12px;font-weight:600"><span><i class="bi bi-ui-checks"></i> Andamento</span><span style="font-family:'Outfit',sans-serif;font-weight:700">${subDone}/${subs.length}</span></div><div class="prog" style="margin:0 8px 6px"><div class="prog-fill ${subPct===100?'done':''}" style="width:${subPct}%"></div></div><div style="max-height:185px;overflow-y:auto">${rows}</div></div>`;
  }
  const noteHtml=p.note?`<p style="font-size:12px;color:var(--text2);margin-top:7px;line-height:1.5;background:var(--surface2);padding:6px 8px;border-radius:6px">${p.note}</p>`:'';
  const isMob = (typeof isMobileDevice === 'function') && isMobileDevice();
  const hasFolder = isMob
    ? Boolean((p.driveLink && p.driveLink.trim()) || (p.localPath && /^https?:\/\//i.test(p.localPath.trim())))
    : Boolean(p.localPath && p.localPath.trim());
  const folderIcon = isMob
    ? (hasFolder ? 'bi-cloud-check' : 'bi-cloud-plus')
    : (hasFolder ? 'bi-folder2-open' : 'bi-folder-plus');
  const subCount = Array.isArray(p.selectedFolders) ? p.selectedFolders.length : 0;
  const subText = subCount > 0 ? ` (${subCount} subpasta${subCount > 1 ? 's' : ''} ativa${subCount > 1 ? 's' : ''})` : '';
  const folderTitle = isMob
    ? (hasFolder ? `Abrir pasta na nuvem: ${escapeHtml(p.driveLink || p.localPath)}` : 'Vincular pasta na nuvem (Drive)')
    : (hasFolder ? `Abrir pasta no PC: ${escapeHtml(p.localPath)}${subText}` : 'Vincular pasta no computador');

  const revCount = parseInt(p.revisions || 0);
  const revLimit = parseInt(p.revisionsLimit !== undefined ? p.revisionsLimit : 2);
  const isOverLimit = revCount > revLimit;
  const extraRevs = Math.max(0, revCount - revLimit);

  const revBoxStyle = isOverLimit 
    ? 'background:rgba(221,107,32,0.1);border-color:rgba(221,107,32,0.4);color:#dd6b20' 
    : '';

  const revBadgeOver = isOverLimit 
    ? `<span class="badge" style="background:#dd6b20;color:#fff;font-size:9.5px;padding:1px 5px;font-weight:700" title="Limite contratado (${revLimit}) excedido">+${extraRevs} Extra</span>`
    : '';

  const revHtml = `
    <div class="kcard-rev-row ${isOverLimit ? 'over-limit' : ''}" style="${revBoxStyle}">
      <div style="display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:${isOverLimit ? '#dd6b20' : 'var(--text2)'};cursor:pointer" onclick="openRevisionLogModal(${p.id});event.stopPropagation()" title="Ver histórico e notas das alterações">
        <i class="bi ${isOverLimit ? 'bi-exclamation-triangle-fill' : 'bi-arrow-repeat'}" style="color:${isOverLimit ? '#dd6b20' : 'var(--accent)'};font-size:12.5px"></i>
        <span>Alterações</span>
        ${revBadgeOver}
      </div>
      <div style="display:flex;align-items:center;gap:4px">
        <button type="button" class="rev-step-btn" onclick="adjustProjRevisions(${p.id}, -1);event.stopPropagation()" title="Diminuir alteração" ${revCount === 0 ? 'disabled style="opacity:0.35;cursor:not-allowed"' : ''}>
          <i class="bi bi-dash"></i>
        </button>
        <span style="font-family:'Outfit',sans-serif;font-weight:700;font-size:12px;min-width:18px;text-align:center;color:${isOverLimit ? '#dd6b20' : (revCount > 0 ? 'var(--accent)' : 'var(--text3)')}">${revCount}</span>
        <button type="button" class="rev-step-btn" onclick="adjustProjRevisions(${p.id}, 1);event.stopPropagation()" title="Adicionar alteração">
          <i class="bi bi-plus"></i>
        </button>
        <button type="button" class="rev-step-btn" onclick="openRevisionLogModal(${p.id});event.stopPropagation()" title="Ver histórico e notas das alterações" style="margin-left:2px">
          <i class="bi bi-journal-text"></i>
        </button>
      </div>
    </div>
  `;

  const revLogs = Array.isArray(p.revisionLogs) ? p.revisionLogs : [];
  let latestClientRevNoteHtml = '';
  if (revLogs.length > 0) {
    const latestLog = revLogs[revLogs.length - 1];
    if (latestLog && latestLog.text) {
      const dLog = latestLog.timestamp ? new Date(latestLog.timestamp) : (latestLog.date ? new Date(latestLog.date + 'T12:00:00') : new Date());
      const dStr = dLog.toLocaleDateString('pt-BR') + (latestLog.timestamp ? ` às ${dLog.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '');
      const hasPins = Array.isArray(latestLog.pins) && latestLog.pins.length > 0;
      const pinsBadgeHtml = hasPins ? `
        <div style="margin-top:4px">
          <span class="badge" style="background:rgba(234,88,12,0.18);color:#ea580c;font-size:10px;font-weight:700;padding:2px 6px;display:inline-flex;align-items:center;gap:3px">
            <i class="bi bi-pin-map-fill"></i> ${latestLog.pins.length} marcaç${latestLog.pins.length === 1 ? 'ão' : 'ões'} no render
          </span>
        </div>
      ` : '';

      latestClientRevNoteHtml = `
        <div class="kcard-rev-note" style="background:${isClient ? 'rgba(234,88,12,0.08)' : 'var(--surface2)'};border:1px solid ${isClient ? 'rgba(234,88,12,0.3)' : 'var(--border)'};border-radius:8px;padding:7px 9px;margin-top:6px;font-size:11.5px;display:flex;flex-direction:column;gap:3px;cursor:pointer" onclick="openRevisionLogModal(${p.id});event.stopPropagation()" title="Clique para ver todo o histórico de alterações">
          <div style="display:flex;align-items:center;justify-content:space-between;font-weight:700;color:${isClient ? '#ea580c' : 'var(--accent)'};font-size:11px">
            <span><i class="bi ${isClient ? 'bi-chat-left-dots-fill' : 'bi-journal-text'}"></i> ${isClient ? `Ajuste do Cliente (${escapeHtml(latestLog.author || 'Cliente')}):` : 'Última anotação de alteração:'}</span>
            <span style="font-size:10px;font-weight:500;color:var(--text3)">${dStr}</span>
          </div>
          <div style="color:var(--text);font-size:11.5px;line-height:1.35;word-break:break-word">
            "${escapeHtml(latestLog.text)}"
          </div>
          ${pinsBadgeHtml}
        </div>
      `;
    }
  }

  const tagsList = Array.isArray(p.tags) ? p.tags : [];
  const tagsHtml = tagsList.map(t => {
    const clean = (t || '').trim();
    if (!clean) return '';
    let style = 'background:var(--surface2);color:var(--text2);border:1px solid var(--border)';
    const low = clean.toLowerCase();
    if (low.includes('urgente') || low.includes('crítico')) style = 'background:rgba(229,62,62,0.12);color:var(--red);border:1px solid rgba(229,62,62,0.3)';
    else if (low.includes('aguardando') || low.includes('esperando') || low.includes('pendente')) style = 'background:rgba(214,158,46,0.12);color:var(--yellow);border:1px solid rgba(214,158,46,0.3)';
    else if (low.includes('medição') || low.includes('medicao') || low.includes('visita')) style = 'background:rgba(49,130,206,0.12);color:var(--blue);border:1px solid rgba(49,130,206,0.3)';
    else if (low.includes('render') || low.includes('3d') || low.includes('imagem')) style = 'background:rgba(128,90,213,0.12);color:#805ad5;border:1px solid rgba(128,90,213,0.3)';
    return `<span class="badge" style="${style};font-size:10px;font-weight:600">${escapeHtml(clean)}</span>`;
  }).join('');

  const isDevOrAlt = p.column === 'Desenvolvimento' || (p.column || '').toLowerCase().includes('altera') || (p.column || '').toLowerCase().includes('desenv');
  const hasClientAdjustment = Boolean(p.pendingClientRevision || (isDevOrAlt && revLogs.length > 0 && revLogs[revLogs.length - 1]?.author && revLogs[revLogs.length - 1]?.author.toLowerCase() !== 'mavic'));

  let bellClass = '';
  let bellIcon = 'bi-bell';
  let bellTitle = '🔔 Solicitar Aprovação do Cliente';
  let bellOnClick = `toggleSendToClientReview(event, ${p.id})`;

  if (hasClientAdjustment) {
    bellClass = 'has-adjustment pulse';
    bellIcon = 'bi-exclamation-diamond-fill';
    bellTitle = '⚠️ Ajuste Solicitado pelo Cliente! Clique para ler o que precisa alterar';
    bellOnClick = `openRevisionLogModal(${p.id});event.stopPropagation()`;
  } else if (p.column === 'Revisão') {
    bellClass = 'in-review pulse';
    bellIcon = 'bi-bell-fill';
    bellTitle = '🔔 Em Revisão: Aguardando aprovação do cliente · Clique para avisar no WhatsApp';
  } else if (p.clientApproved) {
    bellClass = 'approved';
    bellIcon = 'bi-check-circle-fill';
    bellTitle = `✓ Aprovado pelo cliente${p.clientApprovedAt ? ' em ' + new Date(p.clientApprovedAt).toLocaleDateString('pt-BR') : ''}`;
  }

  const pTimeLogs = p.timeLogs || [];
  const pTotalMins = pTimeLogs.reduce((s, l) => s + parseInt(l.minutes || 0), 0);
  const pTimeStr = formatMinutes(pTotalMins);
  const activeTimer = (typeof getActiveTimer === 'function') ? getActiveTimer() : null;
  const isRunningOnThis = activeTimer && activeTimer.projectId === p.id && !activeTimer.pausedAt;

  return `<div class="kcard ${dlClass} ${pinnedCards.has(p.id)?'pinned':''}" data-id="${p.id}" draggable="true" onclick="togglePin(event,${p.id})" style="--type-color:${typeColor(p.type)}">
    ${subs.length?`<div class="kcard-prog-bar"><div class="kcard-prog-fill" style="width:${subPct}%;background:${progColor}"></div></div>`:''}
    ${p.image?`<img src="${p.image}" class="kcard-cover" onerror="this.style.display='none'">`:''}
    <div class="kcard-body">
      <div class="kcard-top-row">
        <div class="kcard-name">${escapeHtml(p.name)}</div>
        <div style="display:flex;align-items:center;gap:4px">
          <button type="button" class="kcard-bell-btn ${bellClass}" onclick="${bellOnClick}" title="${bellTitle}">
            <i class="bi ${bellIcon}"></i>
          </button>
          <button type="button" class="kcard-folder-btn ${hasFolder ? 'has-local' : ''}" onclick="openCardFolder(event, ${p.id})" title="${folderTitle}">
            <i class="bi ${folderIcon}"></i>
          </button>
        </div>
      </div>
      ${p.client?`
        <div class="kcard-client">
          <span class="kcard-avatar" style="background:${avatarColor}">${initials}</span>
          <span class="kcard-client-name" title="${escapeHtml(p.client)}">${escapeHtml(p.client)}</span>
          ${total>0?`<span class="badge ${sClass} kcard-fin-badge">${sLabel}</span>`:''}
        </div>
      `:''}
      ${currSubs.length?`<div class="kcard-current-task" title="Foco atual"><i class="bi bi-lightning-charge-fill" style="color:var(--yellow)"></i> <span>${currSubs.map(cs => cs.text).join(', ')}</span></div>`:''}
      <div class="kcard-tags">
        <div style="display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap">
          <span class="badge" style="background:${typeBg(p.type)};color:${typeColor(p.type)}">${p.type}</span>
          ${p.originBudgetNumber?`<a href="orcamento.html" class="proj-origin-badge" title="Orçamento de Origem #${p.originBudgetNumber}" onclick="event.stopPropagation()"><i class="bi bi-file-earmark-spreadsheet"></i> #${p.originBudgetNumber}</a>`:''}
          ${tagsHtml}
          <span class="card-time-badge ${isRunningOnThis ? 'running' : ''}" onclick="openTimeTracker(${p.id});event.stopPropagation()" title="${isRunningOnThis ? 'Cronômetro ativo — clique para ver detalhes' : 'Total trabalhado: clique para apontar horas'}">
            <i class="bi ${isRunningOnThis ? 'bi-stopwatch-fill' : 'bi-stopwatch'}"></i> ${pTimeStr}
          </span>
          <button type="button" class="btn-card-timer ${isRunningOnThis ? 'active' : ''}" onclick="toggleGlobalTimer(${p.id});event.stopPropagation()" title="${isRunningOnThis ? 'Pausar/Ver cronômetro' : 'Iniciar cronômetro nesta etapa'}">
            <i class="bi ${isRunningOnThis ? 'bi-pause-fill' : 'bi-play-fill'}"></i>
          </button>
        </div>
        ${revCount > 0 ? `<span class="badge b-rev" style="margin:0 auto" title="Rodada de alteração ${revCount}">Rev ${revCount}</span>` : ''}
        ${!isFinalColumn(p.column)?`<span class="badge ${pMap[p.priority]||'b-baixa'}" style="margin-left:auto">${pIcon[p.priority]||'🟢'} ${p.priority}</span>`:''}
      </div>
    </div>
    <div class="kcard-exp">
      ${dl?`<div style="font-size:12px;margin-bottom:6px;display:flex;align-items:center;gap:6px" class="${dateCls}"><i class="bi bi-calendar3"></i>${dl.toLocaleDateString('pt-BR')} ${dateBadge}</div>`:''}
      ${instBadge}
      ${finHtml}${checkHtml}${noteHtml}${revHtml}${latestClientRevNoteHtml}
      <div class="cact">
        <button class="cbtn" style="color:var(--accent)" onclick="openTimeTracker(${p.id});event.stopPropagation()" title="Apontamento de Horas & Lucratividade"><i class="bi bi-stopwatch"></i></button>
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
  const isMob = (typeof isMobileDevice === 'function') && isMobileDevice();
  const hasFolder = isMob
    ? Boolean((p.driveLink && p.driveLink.trim()) || (p.localPath && /^https?:\/\//i.test(p.localPath.trim())))
    : Boolean(p.localPath && p.localPath.trim());
  const folderIcon = isMob
    ? (hasFolder ? 'bi-cloud-check' : 'bi-cloud-plus')
    : (hasFolder ? 'bi-folder2-open' : 'bi-folder-plus');
  const subCount = Array.isArray(p.selectedFolders) ? p.selectedFolders.length : 0;
  const subText = subCount > 0 ? ` (${subCount} subpasta${subCount > 1 ? 's' : ''} ativa${subCount > 1 ? 's' : ''})` : '';
  const folderTitle = isMob
    ? (hasFolder ? `Abrir pasta na nuvem: ${escapeHtml(p.driveLink || p.localPath)}` : 'Vincular pasta na nuvem (Drive)')
    : (hasFolder ? `Abrir pasta no PC: ${escapeHtml(p.localPath)}${subText}` : 'Vincular pasta no computador');

  const pTimeLogs = p.timeLogs || [];
  const pTotalMins = pTimeLogs.reduce((s, l) => s + parseInt(l.minutes || 0), 0);
  const pTimeStr = formatMinutes(pTotalMins);

  return `<div class="kcard-compact" data-id="${p.id}" draggable="true">
    <div class="kcard-compact-info" onclick="editProject(${p.id})">
      <div class="kcard-compact-name">${escapeHtml(p.name)}</div>
      <div class="kcard-compact-sub">${escapeHtml(p.client||'—')} · ${escapeHtml(p.column)} <span class="card-time-badge" style="font-size:9.5px;padding:1px 4px;margin-left:4px" onclick="openTimeTracker(${p.id});event.stopPropagation()"><i class="bi bi-stopwatch"></i> ${pTimeStr}</span></div>
    </div>
    <div class="kcard-compact-acts">
      <button class="btn btn-ghost btn-sm ${hasFolder ? 'has-local' : ''}" onclick="openCardFolder(event, ${p.id})" title="${folderTitle}"><i class="bi ${folderIcon}"></i></button>
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

function applyColumnChange(p, newCol) {
  if (!p || !newCol || p.column === newCol) return false;
  const oldCol = p.column;
  p.column = newCol;

  const fromAdvStages = ['revisão', 'revisao', 'obra', 'concluído', 'concluido', 'finalizado', 'entregue'];
  const toDevStages = ['desenvolvimento', 'briefing', 'modelagem', 'estudo'];

  const isFromAdv = fromAdvStages.some(s => (oldCol || '').toLowerCase().includes(s));
  const isToDev = toDevStages.some(s => (newCol || '').toLowerCase().includes(s));

  if (newCol === 'Revisão' || (newCol || '').toLowerCase().includes('revis')) {
    p.pendingClientRevision = false;
    setTimeout(() => {
      openSendReviewModal(p.id);
    }, 150);
  }

  if (isHiddenColumn(newCol) || newCol === 'Finalizado') {
    if (Array.isArray(p.reviewFiles) && p.reviewFiles.length > 0) {
      showConfirm(
        `O projeto "<strong>${escapeHtml(p.name)}</strong>" foi movido para <strong>${escapeHtml(newCol)}</strong>.<br><br>Deseja <strong>apagar os ${p.reviewFiles.length} arquivo${p.reviewFiles.length !== 1 ? 's' : ''} temporário${p.reviewFiles.length !== 1 ? 's' : ''} de render</strong> do Supabase Storage para liberar espaço na nuvem?`,
        () => {
          cleanupProjectReviewFiles(p);
        },
        {
          title: 'Liberar Espaço na Nuvem',
          icon: 'bi bi-cloud-slash',
          okText: 'Sim, Liberar Espaço',
          cancelText: 'Manter por Enquanto',
          danger: true
        }
      );
    }
    showToast(`Movido para ${newCol} — não aparece mais pro cliente`, 'warning');
  } else if (isFromAdv && isToDev) {
    p.revisions = (parseInt(p.revisions) || 0) + 1;
    showToast(`Projeto retornou para ${newCol}: +1 alteração computada (${p.revisions}ª alteração)!`, 'warning');
  } else {
    showToast(`Movido para ${newCol}`, 'info');
  }
  return true;
}

function adjustProjRevisions(projId, delta) {
  const p = projects.find(x => x.id === projId);
  if (!p) return;
  p.revisions = Math.max(0, (parseInt(p.revisions) || 0) + delta);
  updateCardDOM(projId);
  scheduleSync();
  showToast(`Alterações de "${p.name}": ${p.revisions}`, 'info');
}

// ══════════════════════════════════════════
//  DRAG & DROP EVENTS
// ══════════════════════════════════════════
function bindCardDragEvents(card){
  card.addEventListener('dragstart',e=>{isDragging=true;e.dataTransfer.setData('text/plain',card.dataset.id);setTimeout(()=>card.classList.add('dragging'),0);});
  card.addEventListener('dragend',()=>{card.classList.remove('dragging');setTimeout(()=>isDragging=false,50);});

  // Suporte para arrastar e soltar imagem (PNG/JPG) direto no card para atualizar a capa
  card.addEventListener('dragover', e => {
    if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      card.classList.add('drag-target-image');
    }
  });
  card.addEventListener('dragleave', e => {
    if (!card.contains(e.relatedTarget)) {
      card.classList.remove('drag-target-image');
    }
  });
  card.addEventListener('drop', async e => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file && file.type && file.type.startsWith('image/')) {
        e.preventDefault();
        e.stopPropagation();
        card.classList.remove('drag-target-image');
        const id = parseInt(card.dataset.id);
        const p = projects.find(x => x.id === id);
        if (!p) return;

        showToast(`Enviando capa do projeto "${p.name}" para a nuvem...`, 'info');
        try {
          let publicUrl = '';
          if (typeof uploadToSupabaseStorage === 'function') {
            publicUrl = await uploadToSupabaseStorage(file, 'covers');
          } else {
            const re = await new Promise((res, rej) => {
              const r = new FileReader();
              r.onload = () => res(r.result);
              r.onerror = rej;
              r.readAsDataURL(file);
            });
            publicUrl = re;
          }
          p.image = publicUrl;
          renderBoard();
          scheduleSync();
          showToast(`Capa do projeto "${p.name}" atualizada com sucesso!`, 'success');
        } catch(err) {
          console.error('Falha ao subir capa:', err);
          showToast('Erro ao enviar capa para o Supabase Storage. Verifique se o bucket "mavic_files" foi criado.', 'error');
        }
      }
    }
  });

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
        applyColumnChange(projects[idx], col);
        renderBoard();scheduleSync();
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
}

function setupDragDrop(){
  document.querySelectorAll('.kcard[draggable], .kcard-compact[draggable]').forEach(card=>{
    bindCardDragEvents(card);
  });
  document.querySelectorAll('.kdrop').forEach(zone=>{
    zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('drop-over');});
    zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('drop-over');});
    zone.addEventListener('drop',e=>{
      e.preventDefault();zone.classList.remove('drop-over');
      const id=parseInt(e.dataTransfer.getData('text/plain'));const col=zone.dataset.column;
      const idx=projects.findIndex(p=>p.id===id);
      if(idx>-1&&projects[idx].column!==col){
        applyColumnChange(projects[idx], col);
        renderBoard();scheduleSync();
      }
    });
  });
}

function updateCardDOM(pId){
  const p = projects.find(x => x.id === pId);
  if (!p) return false;
  const oldCard = document.querySelector(`.kcard[data-id="${pId}"], .kcard-compact[data-id="${pId}"]`);
  if (!oldCard) {
    renderBoard();
    return true;
  }
  const isHovered = oldCard.matches(':hover') || oldCard.classList.contains('is-hovered');
  const isCompact = oldCard.classList.contains('kcard-compact') || isHiddenColumn(p.column);
  const scrollContainer = oldCard.querySelector('.kcard-exp div[style*="overflow-y:auto"]');
  const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

  const temp = document.createElement('div');
  temp.innerHTML = isCompact ? createCompactCardHTML(p) : createCardHTML(p);
  const newCard = temp.firstElementChild;
  if (!newCard) {
    renderBoard();
    return true;
  }

  if (isHovered && !newCard.classList.contains('pinned')) {
    newCard.classList.add('is-hovered');
    newCard.addEventListener('mouseleave', () => {
      newCard.classList.remove('is-hovered');
    }, { once: true });
  }

  oldCard.replaceWith(newCard);
  bindCardDragEvents(newCard);

  if (pinnedCards.has(p.id) && !newCard.classList.contains('pinned')) {
    newCard.classList.add('pinned');
  }

  const newScrollContainer = newCard.querySelector('.kcard-exp div[style*="overflow-y:auto"]');
  if (newScrollContainer && scrollTop) {
    newScrollContainer.scrollTop = scrollTop;
  }
  return true;
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
    document.getElementById('projLocalPath').value=p.localPath||'';
    document.getElementById('projDriveLink').value=p.driveLink||'';
    document.getElementById('projValue').value=p.value?toBRLInputStr(p.value):'';
    document.getElementById('projType').value=p.type;
    document.getElementById('projPrio').value=p.priority;
    document.getElementById('projRevision').value=p.revisions || 0;
    document.getElementById('projRevLimit').value=p.revisionsLimit !== undefined ? p.revisionsLimit : 2;
    document.getElementById('projTags').value=(Array.isArray(p.tags) ? p.tags : []).join(', ');
    document.getElementById('projCol').value=p.column;
    document.getElementById('projDate').value=p.date||'';
    document.getElementById('projNote').value=p.note||'';
    if (typeof reconcileProjectFinancials === 'function') reconcileProjectFinancials(p);
    tempSubs=[...(p.subtasks||[])];
    tempPayments=[...(p.payments||[])];
    tempProds=[...(p.products||[])];
    tempInstallments=[...(p.installments||[])];
    tempPaymentCondition=p.paymentCondition||'';
    tempSelectedFolders=p.selectedFolders ? [...p.selectedFolders] : null;
    document.getElementById('btnDelProj').style.display='block';
    const ttBtn = document.getElementById('btnProjTimeTracker');
    if (ttBtn) {
      const pMins = (p.timeLogs || []).reduce((s, l) => s + parseInt(l.minutes || 0), 0);
      ttBtn.style.display = 'inline-flex';
      ttBtn.innerHTML = `<i class="bi bi-stopwatch" style="color:var(--accent)"></i> Horas (${formatMinutes(pMins)}) & Lucro`;
    }
    document.getElementById('btnArchProj').textContent=p.archived?'Desarquivar':'Arquivar';
    
    handleClientChange(true);
  }else{
    document.getElementById('projModalTitle').textContent='Novo Projeto';
    document.getElementById('projId').value='';
    document.getElementById('projName').value='';
    document.getElementById('projClient').value='';
    document.getElementById('projImage').value='';
    document.getElementById('projLocalPath').value='';
    document.getElementById('projDriveLink').value='';
    document.getElementById('projValue').value='';
    document.getElementById('projType').value='Residencial';
    document.getElementById('projPrio').value='Média';
    document.getElementById('projRevision').value=0;
    document.getElementById('projRevLimit').value=2;
    document.getElementById('projTags').value='';
    document.getElementById('projCol').value='Briefing';
    document.getElementById('projDate').value='';
    document.getElementById('projNote').value='';
    tempSubs=[];tempPayments=[];tempProds=[];tempInstallments=[];tempPaymentCondition='';tempSelectedFolders=null;
    document.getElementById('btnDelProj').style.display='none';
    const ttBtn = document.getElementById('btnProjTimeTracker');
    if (ttBtn) ttBtn.style.display = 'none';
  }
  updateProjCoverPreview();
  updateProjEditReviewFiles(id ? projects.find(x => x.id === parseInt(id)) : null);
  renderSubsList();renderPaymentsModal();renderProjProdsTable();
  document.getElementById('projectOverlay').classList.add('open');
}

function updateProjEditReviewFiles(p) {
  const countEl = document.getElementById('projEditReviewCount');
  const listEl = document.getElementById('projEditReviewThumbList');
  const files = p && Array.isArray(p.reviewFiles) ? p.reviewFiles : [];
  if (countEl) countEl.textContent = files.length;
  if (listEl) {
    if (!files.length) {
      listEl.innerHTML = '<span style="font-size:11px;color:var(--text3)">Nenhum render anexado.</span>';
    } else {
      listEl.innerHTML = files.map(f => {
        const isImg = (f.type && f.type.startsWith('image/')) || /\.(png|jpe?g|webp|gif)$/i.test(f.name);
        const url = f.previewUrl || f.originalUrl || f.url;
        if (isImg) {
          return `<img src="${url}" title="${escapeHtml(f.name)}" style="width:32px;height:32px;border-radius:6px;object-fit:cover;border:1px solid var(--border);flex-shrink:0">`;
        }
        return `<div style="width:32px;height:32px;border-radius:6px;background:rgba(37,99,235,0.1);color:#2563eb;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0" title="${escapeHtml(f.name)}"><i class="bi bi-file-earmark-pdf"></i></div>`;
      }).join('');
    }
  }
}

function openSendReviewFromEditModal() {
  const id = document.getElementById('projId').value;
  if (!id) {
    showToast('Salve o projeto primeiro para anexar arquivos de revisão.', 'warning');
    return;
  }
  openSendReviewModal(parseInt(id));
}

function updateProjCoverPreview() {
  const urlInp = document.getElementById('projImage');
  const previewBox = document.getElementById('projCoverPreviewBox');
  const previewImg = document.getElementById('projCoverPreviewImg');
  if (!urlInp || !previewBox || !previewImg) return;
  const url = urlInp.value.trim();
  if (url) {
    previewImg.src = url;
    previewBox.style.display = 'block';
  } else {
    previewBox.style.display = 'none';
    previewImg.src = '';
  }
}

function removeProjCoverImage() {
  const urlInp = document.getElementById('projImage');
  if (urlInp) urlInp.value = '';
  updateProjCoverPreview();
}

async function handleProjImageFileSelect(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const btn = document.getElementById('btnUploadProjCover');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spin" style="width:12px;height:12px;display:inline-block"></span> Enviando...';
  }
  showToast('Enviando imagem para a nuvem...', 'info');
  try {
    let publicUrl = '';
    if (typeof uploadToSupabaseStorage === 'function') {
      publicUrl = await uploadToSupabaseStorage(file, 'covers');
    } else {
      const re = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      publicUrl = re;
    }
    const urlInp = document.getElementById('projImage');
    if (urlInp) urlInp.value = publicUrl;
    updateProjCoverPreview();
    showToast('Capa enviada com sucesso!', 'success');
  } catch(err) {
    console.error('Falha no upload da capa:', err);
    showToast('Falha ao enviar imagem. Verifique se o bucket "mavic_files" foi criado no Supabase.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
    input.value = '';
  }
}

function stepRevision(delta){
  const el = document.getElementById('projRevision');
  if (!el) return;
  let val = (parseInt(el.value) || 0) + delta;
  if (val < 0) val = 0;
  el.value = val;
}

function hasProjModalChanges() {
  const id = document.getElementById('projId').value;
  const name = document.getElementById('projName').value.trim();
  const client = document.getElementById('projClient').value;
  const img = document.getElementById('projImage').value.trim();
  const local = (document.getElementById('projLocalPath')?.value || '').trim();
  const drive = (document.getElementById('projDriveLink')?.value || '').trim();
  const val = document.getElementById('projValue').value.trim();
  const type = document.getElementById('projType').value;
  const prio = document.getElementById('projPrio').value;
  const rev = parseInt(document.getElementById('projRevision')?.value || 0);
  const revLimit = parseInt(document.getElementById('projRevLimit')?.value || 2);
  const tagsStr = (document.getElementById('projTags')?.value || '').trim();
  const col = document.getElementById('projCol').value;
  const note = document.getElementById('projNote').value.trim();
  const date = document.getElementById('projDate').value;
  
  if (!id) {
    // Modo: Criação de Novo Projeto
    return name !== '' || client !== '' || img !== '' || local !== '' || drive !== '' || val !== '' || note !== '' || date !== '' || rev > 0 || tagsStr !== '' || tempSubs.length > 0 || tempPayments.length > 0 || tempProds.length > 0 || tempInstallments.length > 0;
  } else {
    // Modo: Edição de Projeto Existente
    const p = projects.find(x => x.id === parseInt(id));
    if (!p) return false;
    
    const isSubsChanged = JSON.stringify(p.subtasks || []) !== JSON.stringify(tempSubs);
    const isPaysChanged = JSON.stringify(p.payments || []) !== JSON.stringify(tempPayments);
    const isProdsChanged = JSON.stringify(p.products || []) !== JSON.stringify(tempProds);
    const isInstsChanged = JSON.stringify(p.installments || []) !== JSON.stringify(tempInstallments);
    const pTagsStr = (Array.isArray(p.tags) ? p.tags : []).join(', ');
    
    return name !== (p.name || '') ||
           client !== (p.client || '') ||
           img !== (p.image || '') ||
           local !== (p.localPath || '') ||
           drive !== (p.driveLink || '') ||
           parseCurrencyInput(val) !== (p.value || 0) ||
           type !== (p.type || 'Residencial') ||
           prio !== (p.priority || 'Média') ||
           rev !== (p.revisions || 0) ||
           revLimit !== (p.revisionsLimit !== undefined ? p.revisionsLimit : 2) ||
           tagsStr !== pTagsStr ||
           col !== (p.column || 'Briefing') ||
           note !== (p.note || '') ||
           date !== (p.date || '') ||
           isSubsChanged ||
           isPaysChanged ||
           isProdsChanged ||
           isInstsChanged;
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
  const dueBadge = document.getElementById('projClientDueDayBadge');
  const dueVal = document.getElementById('projClientDueDayVal');
  
  if (!clientName) {
    if (wrap) wrap.classList.add('d-none');
    if (dueBadge) dueBadge.style.display = 'none';
    return;
  }
  
  const cl = clients.find(c => c.name === clientName);
  if (dueBadge && dueVal) {
    if (cl && cl.dueDay) {
      dueVal.textContent = cl.dueDay;
      dueBadge.style.display = 'block';
    } else {
      dueBadge.style.display = 'none';
    }
  }

  // Se o cliente tem dia de vencimento fixo e ainda não há cronograma, sugere automaticamente o pagamento mensal
  if (!keepTitle && cl && cl.dueDay && (!tempInstallments || tempInstallments.length === 0)) {
    const contractVal = parseCurrencyInput(document.getElementById('projValue')?.value) || 0;
    if (contractVal > 0) {
      const targetDay = cl.dueDay;
      const baseToday = today();
      const todayDay = parseInt(baseToday.split('-')[2]);
      const startOffset = todayDay <= targetDay ? 0 : 1;
      const d = calculateNextDueDateWithTargetDay(baseToday, targetDay, startOffset);
      tempInstallments = [{
        id: Date.now(),
        number: 1,
        desc: 'Mensalidade do Projeto',
        amount: contractVal,
        dueDate: d,
        status: 'Pendente'
      }];
      tempPaymentCondition = 'mensal_unico';
      renderPaymentsModal();
    }
  }

  if (!wrap || !sel) return;
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
    localPath:(document.getElementById('projLocalPath')?.value || '').trim(),
    driveLink:(document.getElementById('projDriveLink')?.value || '').trim(),
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
    revisions:parseInt(document.getElementById('projRevision')?.value || 0) || 0,
    revisionsLimit:parseInt(document.getElementById('projRevLimit')?.value || 2),
    revisionLogs: existingProj?.revisionLogs || [],
    reviewFiles: existingProj?.reviewFiles || [],
    reviewNotes: existingProj?.reviewNotes || '',
    tags: (document.getElementById('projTags')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
    column:document.getElementById('projCol').value,
    date:document.getElementById('projDate').value,
    note:document.getElementById('projNote').value,
    subtasks:tempSubs,
    selectedFolders: tempSelectedFolders !== null ? tempSelectedFolders : (existingProj?.selectedFolders || null),
    archived:false,
    createdAt:id?(projects.find(x=>x.id===parseInt(id))?.createdAt||Date.now()):Date.now()
  };
  if (typeof reconcileProjectFinancials === 'function') reconcileProjectFinancials(pData);
  if(id){
    const idx=projects.findIndex(x=>x.id===parseInt(id));
    pData.archived=projects[idx]?.archived||false;
    projects[idx]=pData;showToast('Projeto atualizado!','success');
  }
  else{projects.push(pData);showToast('Projeto criado!','success');}
  renderBoard();closeProjectModal();scheduleSync();
  if (typeof renderDashboard === 'function') renderDashboard();
}

function testProjLocalPath() {
  const val = document.getElementById('projLocalPath')?.value;
  if (!val || !val.trim()) {
    showToast('Digite o caminho da pasta local primeiro para abrir.', 'warning');
    return;
  }
  const type = document.getElementById('projType')?.value;
  const id = document.getElementById('projId')?.value;
  const p = id ? projects.find(x => x.id === parseInt(id)) : null;
  const folders = (tempSelectedFolders !== null ? tempSelectedFolders : p?.selectedFolders) || [];
  abrirPastaLocal(val, type, folders);
}

function openProjFolderCustomChecklist() {
  const val = document.getElementById('projLocalPath')?.value;
  if (!val || !val.trim()) {
    showToast('Digite o caminho da pasta local primeiro.', 'warning');
    return;
  }
  const type = document.getElementById('projType')?.value;
  const name = document.getElementById('projName')?.value || 'Projeto';
  const id = document.getElementById('projId')?.value;
  const p = id ? projects.find(x => x.id === parseInt(id)) : null;
  const currentSaved = (tempSelectedFolders !== null ? tempSelectedFolders : p?.selectedFolders) || null;

  openFolderSelectionModal(val, type, name, (selectedFolders) => {
    tempSelectedFolders = [...selectedFolders];
    if (p) {
      p.selectedFolders = [...selectedFolders];
      scheduleSync();
    }
    abrirPastaLocal(val, type, selectedFolders);
  }, currentSaved);
}

function testProjDriveLink() {
  const val = document.getElementById('projDriveLink')?.value;
  if (!val || !val.trim()) {
    showToast('Digite o link da pasta na nuvem primeiro para testar.', 'warning');
    return;
  }
  let url = val.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  window.open(url, '_blank');
}

// ══════════════════════════════════════════
//  MODAL DE SELEÇÃO DE SUBPASTAS
// ══════════════════════════════════════════
let currentFolderProjId = null;

function openCardFolder(event, projId) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const p = projects.find(x => x.id === projId);
  if (!p) return;

  if (!p.localPath && !p.driveLink) {
    showPrompt(
      `Informe o caminho da pasta deste projeto no seu computador (Windows Explorer):`,
      (caminho) => {
        if (!caminho || !caminho.trim()) return;
        const clean = caminho.trim().replace(/^["']|["']$/g, '');
        p.localPath = clean;
        scheduleSync();
        renderBoard();
        showToast('Pasta vinculada!', 'success');
        openProjFoldersModal(p.id);
      },
      {
        title: `Vincular Pasta — ${p.name}`,
        icon: 'bi bi-folder-plus',
        label: 'Caminho no Computador (Windows Explorer)',
        placeholder: 'Ex: D:\\COISAS\\Projetos\\' + p.name,
        defaultValue: p.localPath || '',
        helpText: 'Cole o caminho completo da pasta no seu computador.',
        okText: 'Salvar e Abrir'
      }
    );
    return;
  }

  openProjFoldersModal(p.id);
}

function openProjFoldersModal(projId) {
  const p = projects.find(x => x.id === projId);
  if (!p) return;
  currentFolderProjId = projId;

  document.getElementById('pfModalTitle').textContent = `Pastas: ${p.name}`;
  document.getElementById('pfLocalPathText').textContent = p.localPath || '(Nenhum caminho local configurado)';
  
  const btnRoot = document.getElementById('pfBtnRootFolder');
  if (btnRoot) {
    btnRoot.onclick = () => {
      if (p.localPath) {
        abrirPastaLocal(p.localPath, p.type, p.selectedFolders);
      } else {
        showToast('Nenhum caminho local configurado', 'warning');
      }
    };
  }

  const btnDrive = document.getElementById('pfBtnDriveFolder');
  if (btnDrive) {
    if (p.driveLink && p.driveLink.trim()) {
      btnDrive.style.display = 'inline-flex';
      btnDrive.onclick = () => {
        let url = p.driveLink.trim();
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        window.open(url, '_blank');
      };
    } else {
      btnDrive.style.display = 'none';
    }
  }

  const folders = Array.isArray(p.selectedFolders) && p.selectedFolders.length 
    ? p.selectedFolders 
    : getProjectDefaultFolders(p.type);

  const listEl = document.getElementById('pfSubfoldersList');
  if (listEl) {
    listEl.innerHTML = '';
    if (!folders || !folders.length) {
      listEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px">Nenhuma subpasta configurada.</div>';
    } else {
      folders.forEach(f => {
        let icon = 'bi-folder2';
        const fLow = (f || '').toLowerCase();
        if (fLow.includes('render') || fLow.includes('print') || fLow.includes('imagem') || fLow.includes('foto')) icon = 'bi-images';
        else if (fLow.includes('doc') || fLow.includes('texto') || fLow.includes('brief')) icon = 'bi-file-earmark-text';
        else if (fLow.includes('plant') || fLow.includes('cad') || fLow.includes('dwg')) icon = 'bi-bounding-box';
        else if (fLow.includes('exec') || fLow.includes('marcen') || fLow.includes('obra')) icon = 'bi-hammer';
        else if (fLow.includes('3d') || fLow.includes('skp') || fLow.includes('model')) icon = 'bi-box';
        else if (fLow.includes('final') || fLow.includes('apresent')) icon = 'bi-award';

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px';

        const left = document.createElement('span');
        left.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:var(--text)';
        left.innerHTML = `<i class="bi ${icon}" style="color:var(--accent);font-size:14px"></i><span>${escapeHtml(f)}</span>`;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-ghost btn-xs';
        btn.style.cssText = 'font-size:11.5px;padding:3px 8px;border-radius:6px;display:flex;align-items:center;gap:4px';
        btn.innerHTML = '<i class="bi bi-box-arrow-up-right"></i> Abrir';
        btn.onclick = (e) => {
          e.stopPropagation();
          abrirSubpastaEspecifica(p.localPath || '', f);
        };

        row.appendChild(left);
        row.appendChild(btn);
        listEl.appendChild(row);
      });
    }
  }

  document.getElementById('projFoldersOverlay').classList.add('open');
}

function closeProjFoldersModal() {
  const el = document.getElementById('projFoldersOverlay');
  if (el) el.classList.remove('open');
  currentFolderProjId = null;
}

function editFolderFromModal() {
  if (!currentFolderProjId) return;
  const p = projects.find(x => x.id === currentFolderProjId);
  if (!p) return;

  showPrompt(
    `Alterar caminho local no Windows Explorer:`,
    (caminho) => {
      if (caminho === null) return;
      p.localPath = (caminho || '').trim().replace(/^["']|["']$/g, '');
      scheduleSync();
      renderBoard();
      openProjFoldersModal(p.id);
      showToast('Caminho atualizado!', 'success');
    },
    {
      title: `Caminho da Pasta — ${p.name}`,
      icon: 'bi bi-pencil-square',
      label: 'Caminho no Computador (Windows Explorer)',
      placeholder: 'Ex: D:\\COISAS\\Projetos\\' + p.name,
      defaultValue: p.localPath || '',
      okText: 'Salvar Caminho'
    }
  );
}

// ══════════════════════════════════════════
//  MODAL DE HISTÓRICO DE ALTERAÇÕES
// ══════════════════════════════════════════
let currentRevLogProjId = null;

function openRevisionLogModal(projId) {
  const p = projects.find(x => x.id === projId);
  if (!p) return;
  currentRevLogProjId = projId;

  const revCount = parseInt(p.revisions || 0);
  const revLimit = parseInt(p.revisionsLimit !== undefined ? p.revisionsLimit : 2);
  const isOver = revCount > revLimit;
  const extra = Math.max(0, revCount - revLimit);

  document.getElementById('revLogModalTitle').textContent = `Alterações: ${p.name}`;
  
  const summaryBox = document.getElementById('revLogSummaryBox');
  if (summaryBox) {
    summaryBox.innerHTML = `
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase">Status de Alterações</div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">
          <b>${revCount}</b> rodada${revCount !== 1 ? 's' : ''} realizada${revCount !== 1 ? 's' : ''} <span style="font-size:11.5px;color:var(--text3);font-weight:400">(Limite incluso: ${revLimit})</span>
        </div>
      </div>
      <div>
        ${isOver 
          ? `<span class="badge" style="background:#dd6b20;color:#fff;font-weight:700;font-size:11px;padding:3px 8px"><i class="bi bi-exclamation-triangle-fill"></i> +${extra} Extra a Faturar</span>` 
          : `<span class="badge b-pago" style="font-size:11px;padding:3px 8px">Dentro do Limite</span>`}
      </div>
    `;
  }

  renderRevisionLogsList(p);
  const inp = document.getElementById('newRevLogText');
  if (inp) inp.value = '';

  document.getElementById('revisionLogOverlay').classList.add('open');
}

function closeRevisionLogModal() {
  const el = document.getElementById('revisionLogOverlay');
  if (el) el.classList.remove('open');
  currentRevLogProjId = null;
}

function renderRevisionLogsList(p) {
  const listEl = document.getElementById('revLogsList');
  if (!listEl) return;
  const logs = Array.isArray(p.revisionLogs) ? p.revisionLogs : [];
  if (!logs.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 4px;text-align:center">Nenhuma anotação de alteração registrada ainda.</div>';
    return;
  }

  listEl.innerHTML = logs.map((lg, idx) => {
    const isClient = lg.author && lg.author.toLowerCase() !== 'mavic';
    const dLog = lg.timestamp ? new Date(lg.timestamp) : (lg.date ? new Date(lg.date + 'T12:00:00') : new Date());
    const dStr = dLog.toLocaleDateString('pt-BR') + (lg.timestamp ? ` às ${dLog.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '');
    
    let pinsVisualHtml = '';
    if (Array.isArray(lg.pins) && lg.pins.length > 0) {
      const pinsByImg = {};
      lg.pins.forEach(pin => {
        const key = pin.fileUrl || pin.fileName || 'render';
        if (!pinsByImg[key]) pinsByImg[key] = { url: pin.fileUrl, name: pin.fileName || 'Render', pins: [] };
        pinsByImg[key].pins.push(pin);
      });

      pinsVisualHtml = Object.values(pinsByImg).map(group => {
        const pinMarkers = group.pins.map(pin => `
          <div id="adminPin_${pin.id}" class="admin-rev-pin-marker" style="position:absolute;left:${pin.xPct}%;top:${pin.yPct}%;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;background:#ea580c;color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800;z-index:2;transition:all .15s ease" title="Ponto #${pin.number}: ${escapeHtml(pin.comment || '')}">
            ${pin.number}
          </div>
        `).join('');

        const pinComments = group.pins.map(pin => `
          <div style="font-size:11.5px;color:var(--text);display:flex;align-items:flex-start;gap:6px;background:var(--surface);padding:5px 8px;border-radius:6px;border:1px solid var(--border);cursor:pointer;transition:background .15s" onmouseenter="highlightAdminPin('${pin.id}')" onmouseleave="unhighlightAdminPin('${pin.id}')">
            <span style="font-weight:800;color:#ea580c;flex-shrink:0">📍 #${pin.number}:</span>
            <span style="flex:1">${escapeHtml(pin.comment || 'Sem descrição')}</span>
          </div>
        `).join('');

        return `
          <div style="margin-top:6px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px">
            <div style="font-size:11px;font-weight:700;color:var(--text2);display:flex;align-items:center;gap:4px">
              <i class="bi bi-pin-map-fill" style="color:#ea580c"></i> Marcações no Render: <b>${escapeHtml(group.name)}</b>
            </div>
            ${group.url ? `
              <div style="position:relative;width:100%;max-height:180px;background:#111;border-radius:6px;overflow:hidden;border:1px solid var(--border);display:flex;align-items:center;justify-content:center">
                <img src="${group.url}" style="width:100%;max-height:180px;object-fit:contain;display:block" alt="">
                <div style="position:absolute;inset:0">${pinMarkers}</div>
              </div>
            ` : ''}
            <div style="display:flex;flex-direction:column;gap:4px">${pinComments}</div>
          </div>
        `;
      }).join('');
    }

    return `
      <div style="background:${isClient ? 'rgba(234,88,12,0.06)' : 'var(--surface2)'};border:1px solid ${isClient ? 'rgba(234,88,12,0.3)' : 'var(--border)'};border-radius:8px;padding:9px 12px;display:flex;flex-direction:column;gap:5px">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text3)">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-weight:700;color:${isClient ? '#ea580c' : 'var(--accent)'}"><i class="bi ${isClient ? 'bi-chat-left-dots-fill' : 'bi-arrow-repeat'}"></i> Alteração #${lg.number || (idx + 1)}</span>
            ${isClient ? `<span class="badge" style="background:rgba(234,88,12,0.15);color:#ea580c;font-size:9.5px;padding:1px 5px;font-weight:700"><i class="bi bi-person-fill"></i> Solicitado por ${escapeHtml(lg.author || 'Cliente')}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span><i class="bi bi-clock"></i> ${dStr}</span>
            <button type="button" class="btn-icon btn-xs" onclick="deleteRevisionLogEntry(${p.id}, ${lg.id})" style="color:var(--danger);width:18px;height:18px;padding:0" title="Excluir nota"><i class="bi bi-trash3"></i></button>
          </div>
        </div>
        <div style="font-size:12.5px;color:var(--text);line-height:1.45;white-space:pre-wrap;background:var(--surface);padding:6px 8px;border-radius:6px;border:1px solid var(--border)">${escapeHtml(lg.text)}</div>
        ${pinsVisualHtml}
      </div>
    `;
  }).reverse().join('');
}

function addNewRevisionLogEntry() {
  if (!currentRevLogProjId) return;
  const p = projects.find(x => x.id === currentRevLogProjId);
  if (!p) return;

  const inp = document.getElementById('newRevLogText');
  const txt = inp?.value?.trim();
  if (!txt) return showToast('Descreva a solicitação da alteração', 'warning');

  if (!Array.isArray(p.revisionLogs)) p.revisionLogs = [];
  p.revisions = (parseInt(p.revisions) || 0) + 1;
  
  p.revisionLogs.push({
    id: Date.now(),
    number: p.revisions,
    date: today(),
    text: txt
  });

  inp.value = '';
  scheduleSync();
  updateCardDOM(p.id);
  openRevisionLogModal(p.id);
  showToast(`Alteração #${p.revisions} registrada!`, 'success');
}

function deleteRevisionLogEntry(projId, logId) {
  const p = projects.find(x => x.id === projId);
  if (!p || !Array.isArray(p.revisionLogs)) return;
  p.revisionLogs = p.revisionLogs.filter(l => l.id !== logId);
  scheduleSync();
  renderRevisionLogsList(p);
  showToast('Registro de alteração removido', 'info');
}

function highlightAdminPin(pinId) {
  const el = document.getElementById(`adminPin_${pinId}`);
  if (el) el.classList.add('pin-highlighted');
}

function unhighlightAdminPin(pinId) {
  const el = document.getElementById(`adminPin_${pinId}`);
  if (el) el.classList.remove('pin-highlighted');
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
  document.getElementById('newPayAmount').value='';
  renderPaymentsModal();
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
  tempPayments=tempPayments.filter(x=>x.id!==id);
  renderPaymentsModal();
}

function quickPayInstallment(instId) {
  const inst = (tempInstallments || []).find(x => String(x.id) === String(instId));
  if (!inst) return;

  const fullAmount = parseFloat(inst.amount || 0);
  const clientDueDay = getClientDueDay();

  showPrompt(
    `Registrar Recebimento — "${inst.desc || 'Parcela'}"\nInforme o valor integral ou parcial recebido (R$):`,
    (valStr) => {
      if (valStr === null || valStr === undefined) return;
      const payAmount = parseCurrencyInput(valStr);
      if (isNaN(payAmount) || payAmount <= 0) return showToast('Informe um valor válido maior que zero', 'warning');

      const payDate = today();
      const payMethod = document.getElementById('newPayMethod')?.value || 'Pix';

      if (payAmount >= fullAmount - 0.01) {
        // Pagamento Integral
        inst.status = 'Pago';
        inst.paidDate = payDate;
        inst.method = payMethod;
        inst.amount = payAmount;

        tempPayments.push({
          id: Date.now(),
          installmentId: inst.id,
          amount: payAmount,
          date: payDate,
          method: payMethod,
          desc: inst.desc || 'Pagamento'
        });

        renderPaymentsModal();
        showToast(`Recebimento integral de ${fmt(payAmount)} registrado!`, 'success');
      } else {
        // Pagamento Parcial
        const remainder = Math.round((fullAmount - payAmount) * 100) / 100;
        const targetDay = clientDueDay || 10;
        const nextDueDate = calculateNextDueDateWithTargetDay(inst.dueDate || today(), targetDay, 1);

        inst.status = 'Pago';
        inst.paidDate = payDate;
        inst.method = payMethod;
        inst.amount = payAmount;

        tempPayments.push({
          id: Date.now(),
          installmentId: inst.id,
          amount: payAmount,
          date: payDate,
          method: payMethod,
          desc: `${inst.desc || 'Parcela'} (Parcial)`
        });

        // Cria parcela de saldo restante com vencimento no próximo ciclo
        tempInstallments.push({
          id: Date.now() + 1,
          number: tempInstallments.length + 1,
          desc: `${inst.desc || 'Parcela'} (Saldo Restante)`,
          amount: remainder,
          dueDate: nextDueDate,
          status: 'Pendente'
        });

        renderPaymentsModal();
        showToast(`Recebimento parcial de ${fmt(payAmount)} registrado! Saldo de ${fmt(remainder)} programado para ${formatDateSafe(nextDueDate)}.`, 'success');
      }
    },
    {
      title: 'Registrar Recebimento',
      icon: 'bi bi-cash-coin',
      label: 'Valor Recebido (R$)',
      defaultValue: toBRLInputStr(fullAmount),
      okText: 'Confirmar Recebimento'
    }
  );
}

function editInstallment(instId) {
  const inst = (tempInstallments || []).find(x => String(x.id) === String(instId));
  if (!inst) return;

  const curDesc = inst.desc || '';
  const curVal = toBRLInputStr(inst.amount || 0);

  showPrompt(`Editar Parcela "${curDesc}"\nInforme o novo valor (R$):`, (valStr) => {
    if (valStr === null || valStr === undefined) return;
    const newAmount = parseCurrencyInput(valStr);
    if (isNaN(newAmount) || newAmount <= 0) return showToast('Valor inválido', 'warning');
    
    inst.amount = newAmount;
    renderPaymentsModal();
    showToast('Valor da parcela atualizado!', 'success');
  }, {
    title: `Editar Parcela — ${curDesc}`,
    icon: 'bi bi-pencil-square',
    label: 'Valor da Parcela (R$)',
    defaultValue: curVal,
    okText: 'Salvar'
  });
}

function updateInstallmentDate(instId, newDate) {
  const inst = (tempInstallments || []).find(x => String(x.id) === String(instId));
  if (inst) {
    inst.dueDate = newDate;
    renderPaymentsModal();
  }
}

function deleteInstallment(instId) {
  const inst = (tempInstallments || []).find(x => String(x.id) === String(instId));
  const desc = inst ? `"${inst.desc}"` : 'esta parcela';
  showConfirm(`Deseja excluir ${desc} do cronograma?`, () => {
    tempInstallments = (tempInstallments || []).filter(x => String(x.id) !== String(instId));
    renderPaymentsModal();
    showToast('Parcela removida do cronograma', 'info');
  });
}

function getClientDueDay(clientName) {
  if (!clientName) clientName = document.getElementById('projClient')?.value;
  if (!clientName) return null;
  const cl = clients.find(c => c.name === clientName);
  if (cl && cl.dueDay && cl.dueDay >= 1 && cl.dueDay <= 31) {
    return parseInt(cl.dueDay);
  }
  return null;
}

function calculateNextDueDateWithTargetDay(baseDateStr, targetDay, monthOffset = 1) {
  const base = baseDateStr ? new Date(baseDateStr + 'T12:00:00') : new Date();
  let year = base.getFullYear();
  let month = base.getMonth() + monthOffset;
  
  while (month > 11) {
    month -= 12;
    year += 1;
  }
  while (month < 0) {
    month += 12;
    year -= 1;
  }
  
  const day = targetDay || base.getDate();
  const maxDayInMonth = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(day, maxDayInMonth);
  
  const mStr = String(month + 1).padStart(2, '0');
  const dStr = String(clampedDay).padStart(2, '0');
  return `${year}-${mStr}-${dStr}`;
}

function addCustomInstallment() {
  const num = (tempInstallments?.length || 0) + 1;
  const contractVal = parseCurrencyInput(document.getElementById('projValue')?.value) || 0;
  const currentInstSum = (tempInstallments || []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  const defaultAmount = Math.max(0, contractVal - currentInstSum);
  const clientDueDay = getClientDueDay();

  let defaultDueDate = document.getElementById('projDate')?.value;
  if (!defaultDueDate) {
    if (clientDueDay) {
      const offset = (tempInstallments && tempInstallments.length > 0) ? tempInstallments.length : 1;
      defaultDueDate = calculateNextDueDateWithTargetDay(today(), clientDueDay, offset);
    } else {
      defaultDueDate = addDays(today(), 15);
    }
  }

  showPrompt('Descrição da nova parcela:', (desc) => {
    if (!desc || !desc.trim()) return;
    const newInst = {
      id: Date.now(),
      number: num,
      desc: desc.trim(),
      amount: defaultAmount > 0 ? defaultAmount : 100,
      dueDate: defaultDueDate,
      status: 'Pendente'
    };
    tempInstallments = tempInstallments || [];
    tempInstallments.push(newInst);
    renderPaymentsModal();
    showToast('Nova parcela adicionada ao cronograma!', 'success');
  }, {
    title: 'Adicionar Parcela ao Cronograma',
    icon: 'bi bi-calendar-plus',
    label: 'Descrição da Parcela (ex: Entrada, Parcela 2, Saldo na Entrega)',
    defaultValue: `Parcela ${num}`,
    okText: 'Adicionar'
  });
}

function convertToVista() {
  const contractVal = parseCurrencyInput(document.getElementById('projValue')?.value) || 0;
  const paidVal = tempPayments.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  const finalVal = contractVal > 0 ? contractVal : (paidVal > 0 ? paidVal : 0);

  if (finalVal <= 0) {
    return showToast('Informe o valor do contrato primeiro', 'warning');
  }

  showConfirm('Deseja converter o cronograma para 1 parcela única À Vista no valor total?', () => {
    const isPaid = paidVal >= finalVal - 0.01;
    const latestPay = tempPayments[tempPayments.length - 1] || {};
    const singleInst = {
      id: Date.now(),
      number: 1,
      desc: 'Pagamento Integral À Vista',
      amount: finalVal,
      dueDate: latestPay.date || document.getElementById('projDate')?.value || today(),
      status: isPaid ? 'Pago' : 'Pendente',
      paidDate: isPaid ? (latestPay.date || today()) : null,
      method: isPaid ? (latestPay.method || 'Pix') : null
    };

    tempInstallments = [singleInst];
    tempPaymentCondition = 'vista';
    renderPaymentsModal();
    showToast('Cronograma convertido para À Vista!', 'success');
  });
}

function rebalanceInstallments() {
  const contractVal = parseCurrencyInput(document.getElementById('projValue')?.value) || 0;
  if (contractVal <= 0) return showToast('Defina o valor do contrato primeiro', 'warning');
  if (!tempInstallments || !tempInstallments.length) return showToast('Nenhum cronograma para reajustar', 'warning');

  const paidInsts = tempInstallments.filter(x => x.status === 'Pago');
  const pendingInsts = tempInstallments.filter(x => x.status !== 'Pago');

  const totalPaidInInsts = paidInsts.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  const remaining = contractVal - totalPaidInInsts;

  if (pendingInsts.length === 0) {
    if (Math.abs(contractVal - totalPaidInInsts) > 0.01 && remaining > 0) {
      tempInstallments.push({
        id: Date.now(),
        number: tempInstallments.length + 1,
        desc: `Adicional / Ajuste`,
        amount: Math.round(remaining * 100) / 100,
        dueDate: document.getElementById('projDate')?.value || addDays(today(), 15),
        status: 'Pendente'
      });
    }
  } else {
    const portion = Math.max(0, Math.floor((remaining / pendingInsts.length) * 100) / 100);
    let accumulated = 0;
    pendingInsts.forEach((inst, idx) => {
      if (idx === pendingInsts.length - 1) {
        inst.amount = Math.max(0, Math.round((remaining - accumulated) * 100) / 100);
      } else {
        inst.amount = portion;
        accumulated += portion;
      }
    });
  }

  renderPaymentsModal();
  showToast('Parcelas ajustadas ao valor do contrato!', 'success');
}

function generateSchedule5050() {
  const contractVal = parseCurrencyInput(document.getElementById('projValue')?.value) || 0;
  if (contractVal <= 0) return showToast('Defina o valor do contrato primeiro', 'warning');

  const halfVal = Math.round((contractVal / 2) * 100) / 100;
  const restVal = Math.round((contractVal - halfVal) * 100) / 100;
  const clientDueDay = getClientDueDay();
  const projDueDate = document.getElementById('projDate')?.value;
  
  let secondDueDate = projDueDate;
  if (!secondDueDate) {
    if (clientDueDay) {
      secondDueDate = calculateNextDueDateWithTargetDay(today(), clientDueDay, 1);
    } else {
      secondDueDate = addDays(today(), 15);
    }
  }

  showConfirm(`Gerar cronograma 50% Entrada (${fmt(halfVal)}) + 50% Saldo na Entrega (${fmt(restVal)})?`, () => {
    tempInstallments = [
      { id: Date.now(), number: 1, desc: 'Entrada (50%)', amount: halfVal, dueDate: today(), status: 'Pendente' },
      { id: Date.now() + 1, number: 2, desc: 'Saldo na Entrega (50%)', amount: restVal, dueDate: secondDueDate, status: 'Pendente' }
    ];
    tempPaymentCondition = '50_50';
    renderPaymentsModal();
    showToast('Cronograma 50/50 gerado!', 'success');
  }, { title: 'Gerar 50/50', okText: 'Gerar' });
}

function generateSchedule3x() {
  const contractVal = parseCurrencyInput(document.getElementById('projValue')?.value) || 0;
  if (contractVal <= 0) return showToast('Defina o valor do contrato primeiro', 'warning');

  const part = Math.floor((contractVal / 3) * 100) / 100;
  const lastPart = Math.round((contractVal - (part * 2)) * 100) / 100;
  const clientDueDay = getClientDueDay();

  let date2, date3;
  if (clientDueDay) {
    date2 = calculateNextDueDateWithTargetDay(today(), clientDueDay, 1);
    date3 = calculateNextDueDateWithTargetDay(today(), clientDueDay, 2);
  } else {
    date2 = addDays(today(), 30);
    date3 = addDays(today(), 60);
  }

  showConfirm(`Gerar cronograma em 3 parcelas de ~${fmt(part)}?`, () => {
    tempInstallments = [
      { id: Date.now(), number: 1, desc: '1ª Parcela', amount: part, dueDate: today(), status: 'Pendente' },
      { id: Date.now() + 1, number: 2, desc: '2ª Parcela', amount: part, dueDate: date2, status: 'Pendente' },
      { id: Date.now() + 2, number: 3, desc: '3ª Parcela', amount: lastPart, dueDate: date3, status: 'Pendente' }
    ];
    tempPaymentCondition = '3x';
    renderPaymentsModal();
    showToast('Cronograma em 3x gerado!', 'success');
  }, { title: 'Gerar 3x', okText: 'Gerar' });
}

function generateScheduleSingleMonthly() {
  const contractVal = parseCurrencyInput(document.getElementById('projValue')?.value) || 0;
  if (contractVal <= 0) return showToast('Defina o valor do contrato primeiro', 'warning');
  
  const clientDueDay = getClientDueDay();
  const targetDay = clientDueDay || 10;
  const baseToday = today();
  const todayDay = parseInt(baseToday.split('-')[2]);
  const startOffset = todayDay <= targetDay ? 0 : 1;
  const d = calculateNextDueDateWithTargetDay(baseToday, targetDay, startOffset);

  showConfirm(`Gerar 1 cobrança mensal de ${fmt(contractVal)} com vencimento em ${formatDateSafe(d)} (todo dia ${targetDay})?`, () => {
    tempInstallments = [
      {
        id: Date.now(),
        number: 1,
        desc: 'Mensalidade do Projeto',
        amount: contractVal,
        dueDate: d,
        status: 'Pendente'
      }
    ];
    tempPaymentCondition = 'mensal_unico';
    renderPaymentsModal();
    showToast(`Cobrança mensal gerada para ${formatDateSafe(d)}!`, 'success');
  }, { title: 'Gerar Cobrança Mensal', okText: 'Gerar' });
}

function generateScheduleMonthly() {
  const contractVal = parseCurrencyInput(document.getElementById('projValue')?.value) || 0;
  if (contractVal <= 0) return showToast('Defina o valor do contrato primeiro', 'warning');
  
  const clientDueDay = getClientDueDay();
  const dayText = clientDueDay ? ` (Vencimento programado: todo dia ${clientDueDay})` : '';

  showPrompt(
    `Informe a quantidade de parcelas mensais${dayText}:`,
    (qtyStr) => {
      if (!qtyStr) return;
      const n = parseInt(qtyStr);
      if (isNaN(n) || n < 1 || n > 36) return showToast('Informe um número de parcelas entre 1 e 36', 'warning');

      const targetDay = clientDueDay || 10;
      const part = Math.floor((contractVal / n) * 100) / 100;
      const diff = Math.round((contractVal - (part * n)) * 100) / 100;

      const insts = [];
      const baseToday = today();
      const todayDay = parseInt(baseToday.split('-')[2]);

      const startOffset = todayDay <= targetDay ? 0 : 1;

      for (let i = 0; i < n; i++) {
        const isLast = (i === n - 1);
        const amt = isLast ? Math.round((part + diff) * 100) / 100 : part;
        const d = calculateNextDueDateWithTargetDay(baseToday, targetDay, startOffset + i);
        
        insts.push({
          id: Date.now() + i,
          number: i + 1,
          desc: `${i + 1}ª Parcela`,
          amount: amt,
          dueDate: d,
          status: 'Pendente'
        });
      }

      tempInstallments = insts;
      tempPaymentCondition = `${n}x_mensal`;
      renderPaymentsModal();
      showToast(`Cronograma mensal gerado (${n}x todo dia ${targetDay})!`, 'success');
    },
    {
      title: 'Gerar Parcelamento Mensal',
      icon: 'bi bi-calendar2-range',
      label: 'Quantidade de Parcelas Mensais',
      defaultValue: '4',
      helpText: clientDueDay 
        ? `As parcelas serão programadas automaticamente para todo dia ${clientDueDay} (vencimento padrão cadastrado para este cliente).` 
        : 'As parcelas serão agendadas mensalmente com vencimento todo dia 10.',
      okText: 'Gerar Cronograma'
    }
  );
}

function quickPayFromCard(projId, instId) {
  const p = projects.find(x => x.id === projId);
  if (!p) return;
  const inst = (p.installments || []).find(x => String(x.id) === String(instId));
  if (!inst) return;

  const fullAmount = parseFloat(inst.amount || 0);
  const clientDueDay = getClientDueDay(p.client);

  showPrompt(
    `Receber Parcela — "${p.name}"\n${inst.desc || 'Parcela'}\nInforme o valor integral ou parcial recebido (R$):`,
    (valStr) => {
      if (valStr === null || valStr === undefined) return;
      const payAmount = parseCurrencyInput(valStr);
      if (isNaN(payAmount) || payAmount <= 0) return showToast('Informe um valor válido maior que zero', 'warning');

      const payDate = today();
      const payMethod = 'Pix';

      if (payAmount >= fullAmount - 0.01) {
        // Integral
        inst.status = 'Pago';
        inst.paidDate = payDate;
        inst.method = payMethod;
        inst.amount = payAmount;

        p.payments = p.payments || [];
        p.payments.push({
          id: Date.now(),
          installmentId: inst.id,
          amount: payAmount,
          date: payDate,
          method: payMethod,
          desc: inst.desc || 'Recebimento de Parcela'
        });
      } else {
        // Parcial
        const remainder = Math.round((fullAmount - payAmount) * 100) / 100;
        const targetDay = clientDueDay || 10;
        const nextDueDate = calculateNextDueDateWithTargetDay(inst.dueDate || today(), targetDay, 1);

        inst.status = 'Pago';
        inst.paidDate = payDate;
        inst.method = payMethod;
        inst.amount = payAmount;

        p.payments = p.payments || [];
        p.payments.push({
          id: Date.now(),
          installmentId: inst.id,
          amount: payAmount,
          date: payDate,
          method: payMethod,
          desc: `${inst.desc || 'Parcela'} (Parcial)`
        });

        p.installments.push({
          id: Date.now() + 1,
          number: p.installments.length + 1,
          desc: `${inst.desc || 'Parcela'} (Saldo Restante)`,
          amount: remainder,
          dueDate: nextDueDate,
          status: 'Pendente'
        });
      }

      p.paid = (p.payments || []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);

      if (typeof reconcileProjectFinancials === 'function') {
        reconcileProjectFinancials(p);
      }

      updateCardDOM(p.id);
      scheduleSync();
      if (typeof renderDashboard === 'function') renderDashboard();
      showToast(`Recebimento de ${fmt(payAmount)} confirmado!`, 'success');
    },
    {
      title: 'Registrar Recebimento',
      icon: 'bi bi-cash-coin',
      label: 'Valor Recebido (R$)',
      defaultValue: toBRLInputStr(fullAmount),
      okText: 'Confirmar'
    }
  );
}

const DEFAULT_SUBTASKS_BY_TYPE = {
  'Residencial': [
    'Briefing e Levantamento de Medidas',
    'Estudo Preliminar e Layout 2D',
    'Modelagem 3D e Renders',
    'Apresentação e Aprovação do Cliente',
    'Projeto Executivo e Detalhamento'
  ],
  'Comercial': [
    'Briefing e Identidade da Marca',
    'Layout Comercial e Fluxo',
    'Modelagem 3D e Renders',
    'Projeto Luminotécnico e Pontos',
    'Executivo e Memorial Descritivo'
  ],
  'Fachada Comercial': [
    'Medição e Levantamento no Local',
    'Proposta 3D de Fachada',
    'Renders Diurno e Noturno',
    'Detalhamento de Comunicação Visual'
  ],
  'Interiores': [
    'Briefing de Estilo e Necessidades',
    'Layout e Distribuição dos Ambientes',
    'Modelagem 3D e Renders Realistas',
    'Especificação de Materiais e Móveis',
    'Detalhamento de Marcenaria'
  ],
  'Marcenaria': [
    'Levantamento Técnico no Local',
    'Desenho 3D dos Mobiliários',
    'Plano de Corte e Detalhamento',
    'Aprovação Final com Cliente'
  ],
  '3D / Render': [
    'Importação e Ajuste do Modelo 3D',
    'Texturização e Iluminação Realista',
    'Renders Preliminares',
    'Pós-produção e Renders em Alta'
  ]
};

function onProjTypeChange() {
  const type = document.getElementById('projType')?.value;
  if (!type) return;
  const tpl = DEFAULT_SUBTASKS_BY_TYPE[type] || DEFAULT_SUBTASKS_BY_TYPE['Residencial'];
  if (!tpl || !tpl.length) return;

  if (!tempSubs || tempSubs.length === 0) {
    tempSubs = tpl.map((text, idx) => ({ id: Date.now() + idx, text, done: false, current: false }));
    renderSubsList();
    showToast(`Checklist padrão carregado para ${type}!`, 'info');
  }
}

function onProjValueInput() {
  const contractVal = parseCurrencyInput(document.getElementById('projValue')?.value) || 0;
  const btnRebalance = document.getElementById('btnRebalanceInsts');
  if (!btnRebalance) return;

  if (tempInstallments && tempInstallments.length > 0) {
    const totalInstsVal = tempInstallments.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
    if (contractVal > 0 && Math.abs(contractVal - totalInstsVal) > 0.01) {
      btnRebalance.style.display = 'inline-flex';
      const diff = contractVal - totalInstsVal;
      btnRebalance.innerHTML = `<i class="bi bi-arrow-repeat"></i> Ajustar parcelas (${diff > 0 ? '+' : ''}${fmt(diff)})`;
    } else {
      btnRebalance.style.display = 'none';
    }
  } else {
    btnRebalance.style.display = 'none';
  }
}

function renderPaymentsModal(){
  const totalPaid = tempPayments.reduce((s,x)=>s+parseFloat(x.amount||0),0);
  const contractVal = parseCurrencyInput(document.getElementById('projValue')?.value) || 0;

  // Atualiza badge de progresso no topo da seção de recebimentos
  const progEl = document.getElementById('payProgress');
  if (progEl) {
    const totalRef = contractVal > 0 ? contractVal : totalPaid;
    progEl.textContent = `${fmt(totalPaid)} / ${fmt(totalRef)}`;
    progEl.className = `badge ${contractVal > 0 && totalPaid >= contractVal - 0.01 ? 'b-pago' : totalPaid > 0 ? 'b-parcial' : 'b-pendente'}`;
  }

  // Conciliação automática de status das parcelas com base nos pagamentos
  if (tempInstallments && tempInstallments.length > 0) {
    const dummyObj = { value: contractVal, paid: totalPaid, payments: tempPayments, installments: tempInstallments };
    if (typeof reconcileProjectFinancials === 'function') {
      reconcileProjectFinancials(dummyObj);
    }
  }

  // 1. Renderiza o container de Cronograma de Parcelas
  const instContainer = document.getElementById('projInstsContainer');
  if (instContainer) {
    if (!tempInstallments || !tempInstallments.length) {
      instContainer.innerHTML = `
        <div style="padding:10px;text-align:center;color:var(--text3);font-size:11px">
          <i class="bi bi-calendar-x" style="font-size:14px;margin-right:4px"></i> Nenhum cronograma configurado.
          <button type="button" class="btn btn-ghost btn-sm" style="font-size:10px;padding:1px 6px;margin-left:6px" onclick="addCustomInstallment()">
            <i class="bi bi-plus-circle"></i> Criar Parcela
          </button>
        </div>
      `;
    } else {
      instContainer.innerHTML = tempInstallments.map((inst, idx) => {
        const isPaid = inst.status === 'Pago';
        const dueDate = inst.dueDate || '';
        let timingBadge = '';
        let cardClass = isPaid ? 'paid' : 'pending';

        if (isPaid) {
          timingBadge = `<span class="badge" style="font-size:9.5px;padding:1px 5px;background:rgba(22,163,74,0.15);color:var(--green)">✓ Pago</span>`;
        } else if (dueDate) {
          const dDue = new Date(dueDate + 'T12:00:00');
          const diff = Math.ceil((dDue - new Date().setHours(0,0,0,0)) / 86400000);
          if (diff < 0) {
            cardClass = 'overdue';
            timingBadge = `<span class="badge b-venc" style="font-size:9.5px;padding:1px 5px" title="Vencido há ${Math.abs(diff)} dias">⚠️ Vencida (${Math.abs(diff)}d)</span>`;
          } else if (diff === 0) {
            timingBadge = `<span class="badge b-urg" style="font-size:9.5px;padding:1px 5px">Hoje</span>`;
          } else if (diff <= 3) {
            timingBadge = `<span class="badge b-urg" style="font-size:9.5px;padding:1px 5px">${diff}d</span>`;
          } else {
            timingBadge = `<span class="badge" style="font-size:9.5px;padding:1px 5px;background:var(--surface);color:var(--text3)">⏳ Pendente</span>`;
          }
        } else {
          timingBadge = `<span class="badge" style="font-size:9.5px;padding:1px 5px;background:var(--surface);color:var(--text3)">⏳ Pendente</span>`;
        }

        return `
          <div class="inst-card ${cardClass}">
            <div class="inst-header">
              <span class="inst-desc">${escapeHtml(inst.desc || `Parcela ${idx+1}`)}</span>
              <div class="inst-actions">
                ${!isPaid ? `
                  <button type="button" class="btn-quick-pay" onclick="quickPayInstallment(${inst.id})" title="Dar baixa nesta parcela agora">
                    <i class="bi bi-check2"></i> Receber
                  </button>
                ` : `
                  <span style="font-size:10px;color:var(--green);font-weight:600"><i class="bi bi-check-circle-fill"></i> Quitado</span>
                `}
                <button type="button" class="cbtn" onclick="editInstallment(${inst.id})" title="Editar valor da parcela" style="font-size:11px;padding:2px 4px">
                  <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="cbtn del" onclick="deleteInstallment(${inst.id})" title="Remover do cronograma" style="font-size:11px;padding:2px 4px">
                  <i class="bi bi-trash3"></i>
                </button>
              </div>
            </div>
            <div class="inst-body">
              <div style="display:flex;align-items:center;gap:4px">
                <span style="font-size:10.5px;color:var(--text3)">Venc:</span>
                <input type="date" class="inp inp-sm" style="padding:1px 4px;font-size:10.5px;height:22px;width:auto;border:1px solid var(--border)" value="${dueDate}" onchange="updateInstallmentDate(${inst.id}, this.value)" ${isPaid ? 'disabled style="opacity:0.7"' : ''}>
                ${timingBadge}
              </div>
              <strong style="font-family:'Outfit',sans-serif;font-size:12px">${fmt(inst.amount)}</strong>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Renderiza o container de Histórico de Recebimentos
  const paysEl = document.getElementById('paysContainer');
  if (paysEl) {
    if (!tempPayments.length) {
      paysEl.innerHTML = '<div class="empty-state" style="padding:12px;font-size:11.5px"><i class="bi bi-cash-coin"></i><span>Nenhum pagamento registrado</span></div>';
    } else {
      paysEl.innerHTML = tempPayments.map(p => `
        <div class="pay-item" style="padding:6px 10px;font-size:12px">
          <span style="display:flex;align-items:center;gap:6px">
            <strong style="font-family:'Outfit',sans-serif;font-weight:700;color:var(--green)">+${fmt(p.amount)}</strong>
            <span style="color:var(--text2);font-size:11px">${p.date ? new Date(p.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span>
            <span style="color:var(--text3);font-size:11px">· ${escapeHtml(p.method || 'Pix')}</span>
          </span>
          <button class="cbtn del" onclick="delPayment(${p.id})" title="Excluir este recebimento" style="padding:2px 4px"><i class="bi bi-trash3"></i></button>
        </div>
      `).join('');
    }
  }

  // 3. Atualiza botão de reajuste de parcelas ao valor do contrato
  onProjValueInput();
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
//  ENVIO PARA REVISÃO & ARQUIVOS DO CLIENTE
// ══════════════════════════════════════════
let tempReviewFiles = [];

function toggleSendToClientReview(event, projId) {
  if (event) event.stopPropagation();
  openSendReviewModal(projId);
}

function openSendReviewModal(projId) {
  const p = projects.find(x => x.id === projId);
  if (!p) return;

  document.getElementById('sendReviewProjId').value = p.id;
  document.getElementById('sendReviewProjName').textContent = p.name;
  document.getElementById('sendReviewClientName').textContent = p.client || 'Sem cliente';
  document.getElementById('sendReviewNotes').value = p.reviewNotes || '';
  tempReviewFiles = Array.isArray(p.reviewFiles) ? JSON.parse(JSON.stringify(p.reviewFiles)) : [];

  const progWrap = document.getElementById('reviewUploadProgressWrap');
  if (progWrap) progWrap.style.display = 'none';

  renderSendReviewFilesList();
  document.getElementById('sendReviewOverlay').classList.add('open');
}

function closeSendReviewModal() {
  document.getElementById('sendReviewOverlay').classList.remove('open');
  tempReviewFiles = [];
}

function renderSendReviewFilesList() {
  const listEl = document.getElementById('sendReviewFilesList');
  const countEl = document.getElementById('sendReviewFilesCount');
  const clearBtn = document.getElementById('btnClearAllReviewFiles');
  if (!listEl) return;

  const count = tempReviewFiles.length;
  if (countEl) countEl.textContent = count;
  if (clearBtn) clearBtn.style.display = count > 0 ? 'inline-flex' : 'none';

  if (!count) {
    listEl.innerHTML = `
      <div style="font-size:12px;color:var(--text3);text-align:center;padding:16px 8px;background:var(--surface2);border-radius:8px;border:1px dashed var(--border)">
        <i class="bi bi-images" style="font-size:18px;display:block;margin-bottom:4px"></i>
        Nenhum render ou prancha anexado ainda.
      </div>
    `;
    return;
  }

  listEl.innerHTML = tempReviewFiles.map((f, idx) => {
    const isImg = (f.type && f.type.startsWith('image/')) || /\.(png|jpe?g|webp|gif)$/i.test(f.name);
    const isPdf = (f.type && f.type.includes('pdf')) || /\.pdf$/i.test(f.name);
    const thumbHtml = isImg
      ? `<img src="${f.previewUrl || f.originalUrl}" class="review-file-thumb" onerror="this.src='';this.className='review-file-icon-box'">`
      : `<div class="review-file-icon-box" style="${isPdf ? 'background:rgba(220,38,38,0.1);color:#dc2626' : ''}"><i class="bi ${isPdf ? 'bi-file-earmark-pdf' : 'bi-file-earmark'}"></i></div>`;

    return `
      <div class="review-file-item">
        <div style="display:flex;align-items:center;gap:10px;overflow:hidden;flex:1">
          ${thumbHtml}
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            <div style="font-weight:600;font-size:12.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(f.name)}</div>
            <div style="font-size:11px;color:var(--text3)">${formatFileSize(f.size)} ${isImg ? '· Render' : isPdf ? '· Prancha PDF' : ''}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <a href="${f.originalUrl}" target="_blank" class="btn-icon btn-sm" title="Abrir arquivo original"><i class="bi bi-box-arrow-up-right"></i></a>
          <button type="button" class="btn-icon btn-sm" onclick="removeReviewFile(${idx})" title="Remover arquivo" style="color:var(--red)"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

function handleReviewDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  const dz = document.getElementById('reviewDropzone');
  if (dz) dz.classList.add('dragover');
}

function handleReviewDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  const dz = document.getElementById('reviewDropzone');
  if (dz) dz.classList.remove('dragover');
}

function handleReviewDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const dz = document.getElementById('reviewDropzone');
  if (dz) dz.classList.remove('dragover');
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
    handleReviewFilesSelected(e.dataTransfer.files);
  }
}

async function handleReviewFilesSelected(fileList) {
  if (!fileList || !fileList.length) return;
  const projId = parseInt(document.getElementById('sendReviewProjId').value) || Date.now();
  const files = Array.from(fileList);

  const progWrap = document.getElementById('reviewUploadProgressWrap');
  const progBar = document.getElementById('reviewUploadProgressBar');
  const progPct = document.getElementById('reviewUploadProgressPct');
  const progLbl = document.getElementById('reviewUploadProgressLabel');

  if (progWrap) progWrap.style.display = 'block';

  let completed = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (progLbl) progLbl.innerHTML = `<span class="spin" style="width:11px;height:11px;display:inline-block"></span> Enviando "${escapeHtml(file.name)}" (${i + 1}/${files.length})...`;
    try {
      if (typeof uploadReviewFile === 'function') {
        const reviewFile = await uploadReviewFile(file, projId);
        tempReviewFiles.push(reviewFile);
      } else {
        showToast('Módulo de upload não inicializado.', 'error');
        break;
      }
    } catch (err) {
      console.error('Falha no upload do arquivo:', err);
      showToast(`Erro ao enviar "${file.name}".`, 'error');
    }
    completed++;
    const pct = Math.round((completed / files.length) * 100);
    if (progBar) progBar.style.width = `${pct}%`;
    if (progPct) progPct.textContent = `${pct}%`;
  }

  if (progWrap) {
    setTimeout(() => { progWrap.style.display = 'none'; }, 400);
  }

  renderSendReviewFilesList();
  showToast(`${completed} arquivo${completed > 1 ? 's' : ''} carregado${completed > 1 ? 's' : ''} com sucesso!`, 'success');
  const inp = document.getElementById('reviewFileInput');
  if (inp) inp.value = '';
}

function removeReviewFile(idx) {
  if (idx < 0 || idx >= tempReviewFiles.length) return;
  const removed = tempReviewFiles.splice(idx, 1);
  if (removed && removed[0] && typeof deleteReviewFilesFromStorage === 'function') {
    deleteReviewFilesFromStorage(removed);
  }
  renderSendReviewFilesList();
}

function clearAllReviewFiles() {
  if (!tempReviewFiles.length) return;
  showConfirm('Deseja remover todos os arquivos anexados desta revisão?', () => {
    if (typeof deleteReviewFilesFromStorage === 'function') {
      deleteReviewFilesFromStorage(tempReviewFiles);
    }
    tempReviewFiles = [];
    renderSendReviewFilesList();
    showToast('Todos os arquivos foram removidos.', 'info');
  });
}

async function saveSendReview(mode = false) {
  const projId = parseInt(document.getElementById('sendReviewProjId').value);
  const p = projects.find(x => x.id === projId);
  if (!p) return;

  const notes = document.getElementById('sendReviewNotes').value.trim();
  p.column = 'Revisão';
  p.pendingClientRevision = false;
  p.reviewFiles = [...tempReviewFiles];
  p.reviewNotes = notes;

  closeSendReviewModal();
  updateCardDOM(p.id);
  renderBoard();
  scheduleSync();

  if (mode === 'copy') {
    const msg = getWhatsAppApprovalMessage(p.id, notes);
    if (msg) {
      copyTextToClipboard(msg, 'Mensagem copiada para a área de transferência! 📋');
    } else {
      showToast(`Projeto "${p.name}" atualizado em Revisão!`, 'success');
    }
  } else if (mode === true || mode === 'whatsapp') {
    showToast(`Projeto "${p.name}" atualizado em Revisão com ${p.reviewFiles.length} arquivo${p.reviewFiles.length !== 1 ? 's' : ''}!`, 'success');
    openWhatsAppApprovalRequest(p.id);
  } else {
    showToast(`Projeto "${p.name}" atualizado em Revisão com ${p.reviewFiles.length} arquivo${p.reviewFiles.length !== 1 ? 's' : ''}!`, 'success');
  }
}

async function cleanupProjectReviewFiles(p) {
  if (!p || !Array.isArray(p.reviewFiles) || !p.reviewFiles.length) return;
  const filesToDelete = [...p.reviewFiles];
  const count = filesToDelete.length;
  p.reviewFiles = [];
  p.reviewNotes = '';
  scheduleSync();

  if (typeof deleteReviewFilesFromStorage === 'function') {
    const ok = await deleteReviewFilesFromStorage(filesToDelete);
    if (ok) {
      showToast(`Projeto finalizado: ${count} arquivo${count > 1 ? 's' : ''} temporário${count > 1 ? 's' : ''} de render removido${count > 1 ? 's' : ''} da nuvem para liberar espaço!`, 'info');
    }
  }
}

function getWhatsAppApprovalMessage(projId, customNotes) {
  const p = projects.find(x => x.id === projId);
  if (!p) return '';
  const cl = clients.find(c => (c.name || '').toLowerCase().trim() === (p.client || '').toLowerCase().trim());
  if (cl && !cl.token) {
    cl.token = genTokenStr();
    scheduleSync();
  }
  const clientFirstName = (cl?.name || p.client || 'Cliente').trim().split(' ')[0];
  const link = cl?.token ? buildLink(cl.name, cl.token) : '';
  const notes = (customNotes !== undefined ? customNotes : (p.reviewNotes || '')).trim();

  let msg = `Olá, *${clientFirstName}*! Tudo bem?\n\n`;
  msg += `Seu projeto *${p.name}* está pronto para sua avaliação e aprovação! 🌟\n\n`;
  if (notes) {
    msg += `📝 *Orientações:* ${notes}\n\n`;
  }
  if (link) {
    msg += `Acesse seu painel exclusivo para conferir e aprovar com 1 clique:\n👉 ${link}\n\n`;
  }
  msg += `Qualquer dúvida ou ajuste necessário, estou à disposição!`;
  return msg;
}

function copyWhatsAppApprovalRequest(projId) {
  const msg = getWhatsAppApprovalMessage(projId);
  if (!msg) return showToast('Projeto não encontrado', 'warning');
  copyTextToClipboard(msg, 'Mensagem copiada para a área de transferência! 📋');
}

function openWhatsAppApprovalRequest(projId) {
  const p = projects.find(x => x.id === projId);
  if (!p) return;
  const cl = clients.find(c => (c.name || '').toLowerCase().trim() === (p.client || '').toLowerCase().trim());
  const msg = getWhatsAppApprovalMessage(projId);

  if (!cl || !cl.phone) {
    if (msg) {
      copyTextToClipboard(msg, 'Cliente sem WhatsApp cadastrado. A mensagem foi copiada para a área de transferência! 📋');
    } else {
      showToast('Cliente sem WhatsApp cadastrado', 'warning');
    }
    return;
  }

  const raw = cl.phone.replace(/\D/g, '');
  const num = raw.length <= 11 ? '55' + raw : raw;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(msg).then(() => {
      showToast('Mensagem copiada e abrindo WhatsApp! 📱', 'success');
      setTimeout(() => window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank'), 200);
    }).catch(() => {
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
    });
  } else {
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  }
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

function renderColManagerRow(c) {
  const isFinal = isFinalColumn(c.id);
  const isHidden = isHiddenColumn(c.id);
  return `
    <div class="cm-row" data-orig="${escapeHtml(c.id || '')}">
      <div class="cm-reorder-wrap" style="display:flex;flex-direction:column;gap:2px;flex-shrink:0">
        <button type="button" class="btn-icon btn-xs cm-move-btn" onclick="moveColumnRow(this, -1);event.stopPropagation()" title="Mover coluna para cima" style="width:24px;height:16px;padding:0;font-size:10px;border-radius:4px;background:var(--surface2);border:1px solid var(--border);color:var(--text2);display:flex;align-items:center;justify-content:center;cursor:pointer">
          <i class="bi bi-chevron-up"></i>
        </button>
        <button type="button" class="btn-icon btn-xs cm-move-btn" onclick="moveColumnRow(this, 1);event.stopPropagation()" title="Mover coluna para baixo" style="width:24px;height:16px;padding:0;font-size:10px;border-radius:4px;background:var(--surface2);border:1px solid var(--border);color:var(--text2);display:flex;align-items:center;justify-content:center;cursor:pointer">
          <i class="bi bi-chevron-down"></i>
        </button>
      </div>
      <select class="inp inp-sm cm-icon" style="min-width:90px">${colIconOptions(c.icon)}</select>
      <input type="color" class="cm-color" value="${c.color || DEFAULT_COL_COLOR}" title="Cor da coluna">
      <input class="inp inp-sm cm-name-inp" value="${escapeHtml(c.id || '')}" placeholder="Nome da coluna" style="flex:1">
      <label class="cm-final" title="Etapa concluída (conta nos relatórios e some o selo de prioridade — o projeto ainda aparece pro cliente)">
        <input type="checkbox" class="cm-isfinal" ${isFinal ? 'checked' : ''}>
        <i class="bi bi-flag-fill"></i>
      </label>
      <label class="cm-hidden" title="Projeto encerrado (já entregue/pago — some do painel do cliente e vira cartão compacto no quadro)">
        <input type="checkbox" class="cm-hideclient" ${isHidden ? 'checked' : ''}>
        <i class="bi bi-eye-slash-fill"></i>
      </label>
      <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.cm-row').remove()" title="Excluir coluna">
        <i class="bi bi-trash3"></i>
      </button>
    </div>
  `;
}

function moveColumnRow(btn, dir) {
  const row = btn.closest('.cm-row');
  if (!row) return;
  const parent = row.parentNode;
  if (dir === -1) {
    const prev = row.previousElementSibling;
    if (prev) {
      parent.insertBefore(row, prev);
      row.style.transition = 'transform 0.15s ease';
      row.style.transform = 'translateY(-2px)';
      setTimeout(() => row.style.transform = '', 150);
    }
  } else if (dir === 1) {
    const next = row.nextElementSibling;
    if (next) {
      parent.insertBefore(next, row);
      row.style.transition = 'transform 0.15s ease';
      row.style.transform = 'translateY(2px)';
      setTimeout(() => row.style.transform = '', 150);
    }
  }
}

function openManageColumnsModal(){
  document.getElementById('colManagerList').innerHTML = appColumns.map(c => renderColManagerRow(c)).join('');
  document.getElementById('colsOverlay').classList.add('open');
}

function closeManageColumnsModal(){document.getElementById('colsOverlay').classList.remove('open');}

function addColInput(){
  const list = document.getElementById('colManagerList');
  if (!list) return;
  const newRowWrapper = document.createElement('div');
  newRowWrapper.innerHTML = renderColManagerRow({ id: '', icon: 'bi-folder', color: DEFAULT_COL_COLOR, isFinal: false, hideClient: false });
  list.appendChild(newRowWrapper.firstElementChild);
}

function saveColumnsConfig(){
  const rows = document.querySelectorAll('#colManagerList .cm-row');
  const newCols = [], map = {};
  rows.forEach(r => {
    const orig = r.dataset.orig;
    const icon = r.querySelector('select')?.value || 'bi-folder';
    const color = r.querySelector('input[type="color"]')?.value || DEFAULT_COL_COLOR;
    const name = r.querySelector('.cm-name-inp')?.value?.trim() || '';
    const isFinal = r.querySelector('.cm-isfinal')?.checked || false;
    const hideClient = r.querySelector('.cm-hideclient')?.checked || false;
    if (name) {
      newCols.push({ id: name, icon, color, isFinal, hideClient });
      if (orig && orig !== name) map[orig] = name;
    }
  });
  if (!newCols.length) return showToast('Ao menos uma coluna!', 'warning');
  projects.forEach(p => {
    if (map[p.column]) p.column = map[p.column];
    if (!newCols.find(c => c.id === p.column)) p.column = newCols[0].id;
  });
  appColumns = newCols;
  visibleColumns = appColumns.map(c => c.id);
  minimizedColumns = [];
  updateProjColSelect();
  renderBoard();
  closeManageColumnsModal();
  scheduleSync();
  showToast('Ordem e configurações das colunas atualizadas com sucesso!', 'success');
}



function moveNext(id){
  const p=projects.find(x=>x.id===id);if(!p)return;
  const cols=appColumns.filter(c=>visibleColumns.includes(c.id));
  const idx=cols.findIndex(c=>c.id===p.column);
  if(idx===-1||idx===cols.length-1)return showToast('Já na última etapa','info');
  applyColumnChange(p, cols[idx+1].id);
  renderBoard();scheduleSync();
}

function toggleFinHist(id){
  if(expandedFin.has(id)) expandedFin.delete(id);
  else expandedFin.add(id);
  updateCardDOM(id);
}
function toggleSub(pId,sId){
  const p=projects.find(x=>x.id===pId);if(!p)return;
  const s=p.subtasks?.find(x=>x.id===sId);
  if(s){
    s.done=!s.done;
    if(s.done) s.current=false;
    updateCardDOM(pId);
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
  updateCardDOM(pId);
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
    const target = projects.find(p => p.id === id);
    if (target && Array.isArray(target.reviewFiles) && target.reviewFiles.length && typeof deleteReviewFilesFromStorage === 'function') {
      deleteReviewFilesFromStorage(target.reviewFiles);
    }
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

  review: `Olá, *{Cliente}*! Tudo bem?

Seu projeto *{Projeto}* está pronto para sua avaliação e aprovação! 🌟
{Observacao}
{LinkPainel}
Qualquer dúvida ou ajuste necessário, estou à disposição!
_Equipe MAVIC Projetos_`,

  payment: `Olá, *{Cliente}*!

Segue o resumo financeiro do projeto *{Projeto}*:

*Valor contratado:* {ValorTotal}
*Pago:* {ValorPago} | *Pendente:* {SaldoPendente}
{DadosPix}
Dúvidas, estamos à disposição!
_Equipe MAVIC Projetos_`,

  installment: `Olá, *{Cliente}*!

Passando para enviar o lembrete sobre a parcela do projeto *{Projeto}*:

*Parcela:* {ProximaParcelaDesc}
*Valor:* {ProximaParcelaValor}
*Vencimento:* {ProximaParcelaData}
{DadosPix}
Dúvidas, estamos à total disposição!
_Equipe MAVIC Projetos_`,

  receipt: `Olá, *{Cliente}*!

Confirmamos com sucesso o recebimento referente ao projeto *{Projeto}*! 🎉

*Valor recebido:* {ValorUltimoPagamento}
*Total pago até o momento:* {ValorPago}
*Saldo restante:* {SaldoPendente}

Muito obrigado pela parceria e confiança! ✨
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

  const lastPay = pays.length ? pays[pays.length - 1] : null;
  const lastPayStr = lastPay ? `${fmt(lastPay.amount)} (${lastPay.method || 'Pix'})` : fmt(paid);
  
  const pendingInsts = (p.installments || []).filter(i => i.status !== 'Pago');
  const nextInst = pendingInsts.length ? pendingInsts[0] : null;
  const nextInstDesc = nextInst ? (nextInst.desc || 'Parcela') : 'Parcela';
  const nextInstVal = nextInst ? fmt(nextInst.amount) : fmt(rest);
  const nextInstDate = nextInst && nextInst.dueDate ? new Date(nextInst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : dl;

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
    .replace(/{ValorUltimoPagamento}/g, lastPayStr)
    .replace(/{ProximaParcelaDesc}/g, nextInstDesc)
    .replace(/{ProximaParcelaValor}/g, nextInstVal)
    .replace(/{ProximaParcelaData}/g, nextInstDate)
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

function openWhatsAppReceipt(projId, payId) {
  openWhatsApp(projId);
  const p = projects.find(x => x.id === projId);
  const pay = (p?.payments || []).find(x => x.id === payId) || (p?.payments || [])[p?.payments?.length - 1];
  
  const presetSel = document.getElementById('waPresetSelect');
  if (presetSel) presetSel.value = 'receipt';
  applyWaPreset('receipt');

  if (pay) {
    const ta = document.getElementById('waMsg');
    if (ta) {
      ta.value = ta.value
        .replace(/{ValorUltimoPagamento}/g, `${fmt(pay.amount)} (${pay.method || 'Pix'})`);
    }
  }
}

function openWhatsAppInstallment(projId, instId) {
  openWhatsApp(projId);
  const p = projects.find(x => x.id === projId);
  const inst = (p?.installments || []).find(x => x.id === instId);
  
  const presetSel = document.getElementById('waPresetSelect');
  if (presetSel) presetSel.value = 'installment';
  applyWaPreset('installment');

  if (inst) {
    const ta = document.getElementById('waMsg');
    if (ta) {
      const dStr = inst.dueDate ? new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'A combinar';
      ta.value = ta.value
        .replace(/{ProximaParcelaDesc}/g, inst.desc || 'Parcela')
        .replace(/{ProximaParcelaValor}/g, fmt(inst.amount))
        .replace(/{ProximaParcelaData}/g, dStr);
    }
  }
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

