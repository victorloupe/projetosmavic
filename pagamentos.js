// ══════════════════════════════════════════
//  PAGAMENTOS & CONTROLE FINANCEIRO LOGIC
// ══════════════════════════════════════════
let currentPayTab = 'areceber';

function initPage() {
  currentPayTab = localStorage.getItem('mavic_pay_tab') || 'areceber';
  updateClientFilter();
  updatePendingClientFilter();
  updateYearFilter();
  updatePayKPIs();
  switchPayTab(currentPayTab);
}

function switchPayTab(tab) {
  currentPayTab = tab;
  localStorage.setItem('mavic_pay_tab', tab);

  const btnAReceber = document.getElementById('tabBtnAReceber');
  const btnAReceber2 = document.getElementById('tabBtnAReceber2');
  const btnPagos = document.getElementById('tabBtnPagos');
  const btnPagos2 = document.getElementById('tabBtnPagos2');
  const viewAReceber = document.getElementById('tabContentAReceber');
  const viewPagos = document.getElementById('tabContentPagos');

  if (tab === 'areceber') {
    btnAReceber?.classList.add('active');
    btnAReceber2?.classList.add('active');
    btnPagos?.classList.remove('active');
    btnPagos2?.classList.remove('active');
    if (viewAReceber) viewAReceber.style.display = 'flex';
    if (viewPagos) viewPagos.style.display = 'none';
    renderPendingInstallments();
  } else {
    btnPagos?.classList.add('active');
    btnPagos2?.classList.add('active');
    btnAReceber?.classList.remove('active');
    btnAReceber2?.classList.remove('active');
    if (viewAReceber) viewAReceber.style.display = 'none';
    if (viewPagos) viewPagos.style.display = 'flex';
    renderPagamentos();
  }

  updatePayKPIs();
}

function updateYearFilter() {
  const ySel = document.getElementById('fPayYear');
  if (!ySel) return;
  const cur = ySel.value;
  const years = new Set();
  const currentYear = new Date().getFullYear();
  years.add(String(currentYear));
  years.add(String(currentYear - 1));
  years.add(String(currentYear - 2));

  (projects || []).forEach(p => {
    let pays = p?.payments;
    if (typeof pays === 'string') {
      try { pays = JSON.parse(pays); } catch(e) { pays = []; }
    }
    if (Array.isArray(pays)) {
      pays.forEach(pay => {
        if (pay?.date) {
          const y = String(pay.date).substring(0, 4);
          if (/^\d{4}$/.test(y)) years.add(y);
        }
      });
    }
  });

  const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));
  ySel.innerHTML = '<option value="">Todos os Anos</option>' + sortedYears.map(y => `<option value="${y}" ${y === cur ? 'selected' : ''}>${y}</option>`).join('');
}

function updateClientFilter(){
  const clList = Array.isArray(clients) ? clients : [];
  const clientNames = new Set(clList.map(c => c?.name).filter(Boolean));
  (projects || []).forEach(p => {
    if (p && p.client) clientNames.add(p.client);
  });
  const sortedNames = Array.from(clientNames).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const list = sortedNames.map(name => `<option value="${name}">${name}</option>`).join('');
  const pSel = document.getElementById('fPayClient');
  if (pSel) {
    const pCur = pSel.value;
    pSel.innerHTML = '<option value="">Todos os Clientes</option>' + list;
    if (pCur && sortedNames.includes(pCur)) pSel.value = pCur;
  }
}

function updatePendingClientFilter(){
  const clList = Array.isArray(clients) ? clients : [];
  const clientNames = new Set(clList.map(c => c?.name).filter(Boolean));
  (projects || []).forEach(p => {
    if (p && p.client) clientNames.add(p.client);
  });
  const sortedNames = Array.from(clientNames).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const list = sortedNames.map(name => `<option value="${name}">${name}</option>`).join('');
  const pSel = document.getElementById('fPendingClient');
  if (pSel) {
    const pCur = pSel.value;
    pSel.innerHTML = '<option value="">Todos os Clientes</option>' + list;
    if (pCur && sortedNames.includes(pCur)) pSel.value = pCur;
  }
}

// Retorna todas as parcelas pendentes do sistema (inclusive retrocompatibilidade para projetos antigos)
function getAllPendingInstallments() {
  const pendingList = [];
  const todayStr = today();

  (projects || []).forEach(p => {
    if (!p || p.archived) return;
    if (typeof reconcileProjectFinancials === 'function') reconcileProjectFinancials(p);

    // Se o projeto tem array de installments configurado
    if (Array.isArray(p.installments) && p.installments.length > 0) {
      p.installments.forEach(inst => {
        if (!inst || inst.status === 'Pago') return;
        
        const dueDate = inst.dueDate || p.date || todayStr;
        let timingStatus = 'upcoming'; // upcoming, today, overdue
        let daysDiff = 0;

        if (dueDate) {
          const dDue = new Date(dueDate + 'T12:00:00');
          const dToday = new Date(todayStr + 'T12:00:00');
          const diffTime = dDue.getTime() - dToday.getTime();
          daysDiff = Math.round(diffTime / (1000 * 60 * 60 * 24));

          if (daysDiff < 0) {
            timingStatus = 'overdue';
          } else if (daysDiff === 0) {
            timingStatus = 'today';
          } else if (daysDiff <= 2) {
            timingStatus = 'soon';
          } else {
            timingStatus = 'upcoming';
          }
        }

        pendingList.push({
          installment: inst,
          project: p,
          client: p.client || 'Sem cliente',
          timingStatus,
          daysDiff,
          dueDate
        });
      });
    } else {
      // Retrocompatibilidade: projetos sem array de parcelas mas com saldo em aberto
      const totalVal = parseFloat(p.value || 0);
      const paidVal = (p.payments || []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
      const pendingVal = totalVal - paidVal;

      if (pendingVal > 0.01) {
        const dueDate = p.date || todayStr;
        let timingStatus = 'upcoming';
        let daysDiff = 0;

        if (dueDate) {
          const dDue = new Date(dueDate + 'T12:00:00');
          const dToday = new Date(todayStr + 'T12:00:00');
          const diffTime = dDue.getTime() - dToday.getTime();
          daysDiff = Math.round(diffTime / (1000 * 60 * 60 * 24));

          if (daysDiff < 0) timingStatus = 'overdue';
          else if (daysDiff === 0) timingStatus = 'today';
          else if (daysDiff <= 2) timingStatus = 'soon';
          else timingStatus = 'upcoming';
        }

        pendingList.push({
          installment: {
            id: 'legacy_' + p.id,
            number: 1,
            desc: 'Saldo Pendente do Projeto',
            amount: pendingVal,
            dueDate: dueDate,
            status: 'Pendente',
            isLegacy: true
          },
          project: p,
          client: p.client || 'Sem cliente',
          timingStatus,
          daysDiff,
          dueDate
        });
      }
    }
  });

  // Ordena por vencimento (mais antigos/atrasados primeiro)
  pendingList.sort((a, b) => {
    const dateA = a.dueDate ? new Date(a.dueDate + 'T12:00:00').getTime() : 0;
    const dateB = b.dueDate ? new Date(b.dueDate + 'T12:00:00').getTime() : 0;
    return dateA - dateB;
  });

  return pendingList;
}

// Atualiza os indicadores de KPI no topo da página
function updatePayKPIs() {
  let totalRecebido = 0;
  let countPagos = 0;

  (projects || []).forEach(p => {
    let pays = p?.payments;
    if (typeof pays === 'string') {
      try { pays = JSON.parse(pays); } catch(e) { pays = []; }
    }
    if (Array.isArray(pays)) {
      pays.forEach(pay => {
        totalRecebido += parseFloat(pay?.amount || 0);
        countPagos++;
      });
    }
  });

  const pendingList = getAllPendingInstallments();
  const totalAReceber = pendingList.reduce((s, x) => s + parseFloat(x.installment?.amount || 0), 0);
  const totalAtrasado = pendingList
    .filter(x => x.timingStatus === 'overdue')
    .reduce((s, x) => s + parseFloat(x.installment?.amount || 0), 0);

  const kpiRec = document.getElementById('kpiTotalRecebido');
  const kpiARec = document.getElementById('kpiTotalAReceber');
  const kpiAtr = document.getElementById('kpiTotalAtrasado');
  const badgeARec = document.getElementById('badgeCountAReceber');
  const badgeARec2 = document.getElementById('badgeCountAReceber2');
  const badgePagos = document.getElementById('badgeCountPagos');
  const badgePagos2 = document.getElementById('badgeCountPagos2');

  if (kpiRec) kpiRec.textContent = fmt(totalRecebido);
  if (kpiARec) kpiARec.textContent = fmt(totalAReceber);
  if (kpiAtr) kpiAtr.textContent = fmt(totalAtrasado);
  if (badgeARec) badgeARec.textContent = pendingList.length;
  if (badgeARec2) badgeARec2.textContent = pendingList.length;
  if (badgePagos) badgePagos.textContent = countPagos;
  if (badgePagos2) badgePagos2.textContent = countPagos;
}

function clearPendingFilters() {
  const srch = document.getElementById('fPendingSearch');
  const cli = document.getElementById('fPendingClient');
  const st = document.getElementById('fPendingStatus');
  if (srch) srch.value = '';
  if (cli) cli.value = '';
  if (st) st.value = '';
  pgReset('pending_pays');
  renderPendingInstallments();
}

function clearPayFilters() {
  const srch = document.getElementById('fPaySearch');
  const cli = document.getElementById('fPayClient');
  const yr = document.getElementById('fPayYear');
  const mo = document.getElementById('fPayMonth');
  if (srch) srch.value = '';
  if (cli) cli.value = '';
  if (yr) yr.value = '';
  if (mo) mo.value = '';
  pgReset('pagamentos');
  renderPagamentos();
}

// ══════════════════════════════════════════
//  RENDER: A RECEBER / PENDENTES
// ══════════════════════════════════════════
function renderPendingInstallments() {
  const tbody = document.getElementById('pendingTableBody');
  const mobileList = document.getElementById('pendingMobileList');
  if (!tbody && !mobileList) return;

  const search = (document.getElementById('fPendingSearch')?.value || '').toLowerCase().trim();
  const clientFilter = document.getElementById('fPendingClient')?.value || '';
  const statusFilter = document.getElementById('fPendingStatus')?.value || '';

  let list = getAllPendingInstallments();

  // Renderiza o Banner de Alerta se houver parcelas que precisam de atenção
  const bannerEl = document.getElementById('pendingAlertBanner');
  if (bannerEl) {
    const urgentItems = list.filter(x => x.timingStatus === 'overdue' || x.timingStatus === 'today' || x.timingStatus === 'soon');
    if (urgentItems.length > 0 && !statusFilter) {
      const overdueCount = urgentItems.filter(x => x.timingStatus === 'overdue').length;
      const todayCount = urgentItems.filter(x => x.timingStatus === 'today').length;
      const soonCount = urgentItems.filter(x => x.timingStatus === 'soon').length;
      
      let parts = [];
      if (overdueCount > 0) parts.push(`<strong style="color:var(--red)">${overdueCount} atrasada(s)</strong>`);
      if (todayCount > 0) parts.push(`<strong style="color:var(--yellow)">${todayCount} vencendo hoje</strong>`);
      if (soonCount > 0) parts.push(`<strong style="color:#ea580c">${soonCount} a vencer em até 2 dias</strong>`);

      bannerEl.style.display = 'block';
      bannerEl.innerHTML = `
        <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:10px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text)">
            <i class="bi bi-bell-fill" style="color:#ea580c;font-size:16px"></i>
            <span>Atenção aos vencimentos: ${parts.join(', ')}.</span>
          </div>
          <button class="btn btn-sm btn-ghost" onclick="filterUrgentPending()" style="border:1px solid var(--border);background:var(--surface);font-size:11.5px;padding:3px 10px;cursor:pointer">
            <i class="bi bi-funnel"></i> Filtrar Atenção
          </button>
        </div>
      `;
    } else {
      bannerEl.style.display = 'none';
      bannerEl.innerHTML = '';
    }
  }

  if (search) {
    list = list.filter(item => {
      const cli = (item.client || '').toLowerCase();
      const proj = (item.project?.name || '').toLowerCase();
      const desc = (item.installment?.desc || '').toLowerCase();
      const amountStr = String(item.installment?.amount || '');
      const fmtStr = fmt(item.installment?.amount || 0).toLowerCase();
      return cli.includes(search) || proj.includes(search) || desc.includes(search) || amountStr.includes(search) || fmtStr.includes(search);
    });
  }

  if (clientFilter) {
    list = list.filter(item => item.client === clientFilter);
  }

  if (statusFilter) {
    if (statusFilter === 'soon') {
      list = list.filter(item => item.timingStatus === 'soon' || item.timingStatus === 'today' || item.timingStatus === 'overdue');
    } else {
      list = list.filter(item => item.timingStatus === statusFilter);
    }
  }

  const pgEl = document.getElementById('pendingPagination');
  if (pgEl) pgEl.innerHTML = pgBarHtml('pending_pays', list.length, 'renderPendingInstallments');

  if (!list.length) {
    const isFiltered = Boolean(search || clientFilter || statusFilter);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px"><i class="bi bi-check2-circle" style="font-size:28px;display:block;margin-bottom:6px;opacity:0.6;color:var(--green)"></i>Nenhuma parcela pendente encontrada${isFiltered ? `<br><button class="btn-clear-filter" onclick="clearPendingFilters()"><i class="bi bi-x-circle"></i> Limpar filtros</button>` : ''}</td></tr>` + pgFillerRowsHtml('pending_pays', 0, 6);
    if (mobileList) mobileList.innerHTML = `<div style="text-align:center;color:var(--text3);padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:16px"><i class="bi bi-check2-circle" style="font-size:28px;display:block;margin-bottom:6px;opacity:0.6;color:var(--green)"></i>Nenhuma parcela pendente encontrada${isFiltered ? `<br><button class="btn-clear-filter" onclick="clearPendingFilters()"><i class="bi bi-x-circle"></i> Limpar filtros</button>` : ''}</div>` + pgFillerCardsHtml('pending_pays', 0, 195);
    return;
  }

  const pageItems = pgSlice(list, 'pending_pays');

  if (tbody) {
    tbody.innerHTML = pageItems.map(item => {
      const projId = item.project?.id || 0;
      const instId = item.installment?.id || 0;
      const clientName = item.client || 'Sem cliente';
      const projectName = item.project?.name || 'Projeto sem nome';
      const desc = item.installment?.desc || 'Parcela';
      const amountVal = parseFloat(item.installment?.amount || 0);

      const rawDate = item.dueDate || '';
      let dateFormatted = '—';
      if (rawDate) {
        const parsed = new Date(rawDate + 'T12:00:00');
        dateFormatted = isNaN(parsed.getTime()) ? rawDate : parsed.toLocaleDateString('pt-BR');
      }

      let badgeHtml = '';
      if (item.timingStatus === 'overdue') {
        const d = Math.abs(item.daysDiff);
        badgeHtml = `<span class="badge badge-overdue"><i class="bi bi-exclamation-triangle"></i> Atrasado (${d}d) · ${dateFormatted}</span>`;
      } else if (item.timingStatus === 'today') {
        badgeHtml = `<span class="badge badge-today"><i class="bi bi-alarm"></i> Vence Hoje (${dateFormatted})</span>`;
      } else if (item.timingStatus === 'soon') {
        const d = item.daysDiff;
        badgeHtml = `<span class="badge" style="background:rgba(249,115,22,0.15);color:#ea580c;border:1px solid rgba(249,115,22,0.3);font-size:11px;padding:3px 8px;font-weight:600"><i class="bi bi-bell"></i> ${d === 1 ? 'Vence Amanhã' : 'Vence em 2d'} (${dateFormatted})</span>`;
      } else {
        const d = item.daysDiff;
        badgeHtml = `<span class="badge badge-upcoming"><i class="bi bi-calendar3"></i> Em ${d}d (${dateFormatted})</span>`;
      }

      return `
        <tr>
          <td style="font-weight:600">
            <span class="kcard-avatar" style="background:${getClientColor(clientName)};display:inline-flex;margin-right:8px;vertical-align:middle;width:24px;height:24px;font-size:10px">${getInitials(clientName)}</span>
            ${clientName}
          </td>
          <td>
            <span role="button" onclick="openProjectFinanceModal('${projId}')" style="cursor:pointer;color:var(--accent);font-weight:600;display:inline-flex;align-items:center;gap:5px" title="Clique para abrir e gerenciar parcelas / financeiro deste projeto">
              <i class="bi bi-folder2-open"></i> ${projectName} <i class="bi bi-pencil-square" style="font-size:11px;opacity:0.7"></i>
            </span>
          </td>
          <td><span style="font-weight:600;color:var(--accent)">${desc}</span></td>
          <td>
            <div style="display:inline-flex;align-items:center;gap:6px">
              ${badgeHtml}
              <input type="date" class="inp inp-sm" style="padding:1px 4px;font-size:11px;height:22px;border-radius:6px;width:115px;background:var(--surface2);border:1px solid var(--border);color:var(--text);cursor:pointer" value="${rawDate}" onchange="updateInstallmentDueDate('${projId}', '${instId}', this.value)" title="Alterar data de vencimento desta parcela">
            </div>
          </td>
          <td style="font-family:'Outfit',sans-serif;font-weight:700;font-size:14px;color:var(--text)">${fmt(amountVal)}</td>
          <td style="text-align:right">
            <div style="display:inline-flex;gap:4px;justify-content:flex-end;width:100%;align-items:center">
              <button class="btn btn-primary btn-sm" onclick="openDarBaixaModal('${projId}', '${instId}')" style="padding:4px 9px;background:var(--green);border-color:var(--green);font-size:12px" title="Confirmar Recebimento"><i class="bi bi-check2"></i> Dar Baixa</button>
              <button class="btn btn-ghost btn-sm" onclick="sendCobrarWhatsApp('${projId}', '${instId}')" style="padding:4px 8px;color:#25D366" title="Cobrar / Lembrar via WhatsApp"><i class="bi bi-whatsapp"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('') + pgFillerRowsHtml('pending_pays', pageItems.length, 6);
  }

  if (mobileList) {
    mobileList.innerHTML = pageItems.map(item => {
      const projId = item.project?.id || 0;
      const instId = item.installment?.id || 0;
      const clientName = item.client || 'Sem cliente';
      const projectName = item.project?.name || 'Projeto sem nome';
      const desc = item.installment?.desc || 'Parcela';
      const amountVal = parseFloat(item.installment?.amount || 0);

      const rawDate = item.dueDate || '';
      let dateFormatted = '—';
      if (rawDate) {
        const parsed = new Date(rawDate + 'T12:00:00');
        dateFormatted = isNaN(parsed.getTime()) ? rawDate : parsed.toLocaleDateString('pt-BR');
      }

      let badgeHtml = '';
      if (item.timingStatus === 'overdue') {
        const d = Math.abs(item.daysDiff);
        badgeHtml = `<span class="badge badge-overdue"><i class="bi bi-exclamation-triangle"></i> Atrasado (${d}d)</span>`;
      } else if (item.timingStatus === 'today') {
        badgeHtml = `<span class="badge badge-today"><i class="bi bi-alarm"></i> Vence Hoje</span>`;
      } else if (item.timingStatus === 'soon') {
        const d = item.daysDiff;
        badgeHtml = `<span class="badge" style="background:rgba(249,115,22,0.15);color:#ea580c;border:1px solid rgba(249,115,22,0.3);font-size:11px;padding:3px 8px;font-weight:600"><i class="bi bi-bell"></i> ${d === 1 ? 'Amanhã' : 'Em 2d'}</span>`;
      } else {
        const d = item.daysDiff;
        badgeHtml = `<span class="badge badge-upcoming"><i class="bi bi-calendar3"></i> Em ${d}d</span>`;
      }

      return `
        <div class="pay-card">
          <div class="pay-card-top">
            <div class="pay-card-client">
              <span class="kcard-avatar" style="background:${getClientColor(clientName)};display:inline-flex;width:24px;height:24px;font-size:10px">${getInitials(clientName)}</span>
              <span>${clientName}</span>
            </div>
            ${badgeHtml}
          </div>

          <div class="pay-card-project" onclick="openProjectFinanceModal('${projId}')" style="cursor:pointer" title="Gerenciar financeiro e parcelas deste projeto">
            <i class="bi bi-folder2-open" style="color:var(--accent);margin-right:4px"></i>
            <strong style="color:var(--accent)">${projectName}</strong> <i class="bi bi-pencil-square" style="font-size:11.5px;opacity:0.8;margin-left:4px"></i>
          </div>

          <div class="pay-card-grid">
            <div class="pay-card-grid-item">
              <span class="pay-grid-lbl"><i class="bi bi-tag"></i> Parcela</span>
              <span class="pay-grid-val" style="color:var(--accent);font-weight:600">${desc}</span>
            </div>
            <div class="pay-card-grid-item">
              <span class="pay-grid-lbl"><i class="bi bi-cash-coin"></i> Valor a Receber</span>
              <span class="pay-grid-val price" style="color:var(--text)">${fmt(amountVal)}</span>
            </div>
          </div>
          
          <div style="display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:var(--text3);margin-bottom:8px;padding:6px 8px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
            <span><i class="bi bi-calendar-event"></i> Vencimento:</span>
            <input type="date" class="inp inp-sm" style="padding:1px 6px;font-size:11px;height:24px;border-radius:6px;width:125px;background:var(--surface);border:1px solid var(--border);color:var(--text);cursor:pointer" value="${rawDate}" onchange="updateInstallmentDueDate('${projId}', '${instId}', this.value)" title="Alterar data de vencimento">
          </div>

          <div class="pay-card-actions">
            <div class="pay-card-actions-left" style="width:100%;display:flex;gap:6px">
              <button class="btn btn-primary btn-sm" onclick="openDarBaixaModal('${projId}', '${instId}')" style="flex:1;background:var(--green);border-color:var(--green);padding:7px;font-size:12.5px"><i class="bi bi-check2"></i> Dar Baixa</button>
              <button class="btn btn-ghost btn-sm" onclick="sendCobrarWhatsApp('${projId}', '${instId}')" style="color:#25D366;border:1px solid var(--border);padding:7px 12px"><i class="bi bi-whatsapp"></i> Cobrar</button>
            </div>
          </div>
        </div>
      `;
    }).join('') + pgFillerCardsHtml('pending_pays', pageItems.length, 195);
  }
}

function filterUrgentPending() {
  const st = document.getElementById('fPendingStatus');
  if (st) {
    st.value = 'soon';
    pgReset('pending_pays');
    renderPendingInstallments();
  }
}

function updateInstallmentDueDate(projId, instId, newDate) {
  if (!newDate) return;
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return;
  if (Array.isArray(p.installments)) {
    const inst = p.installments.find(x => String(x.id) === String(instId));
    if (inst) {
      inst.dueDate = newDate;
      scheduleSync();
      updatePayKPIs();
      renderPendingInstallments();
      showToast('Data de vencimento atualizada!', 'success');
      return;
    }
  }
  p.date = newDate;
  scheduleSync();
  updatePayKPIs();
  renderPendingInstallments();
  showToast('Data de vencimento atualizada!', 'success');
}

// ══════════════════════════════════════════
//  MODAL: DAR BAIXA EM PARCELA
// ══════════════════════════════════════════
function openDarBaixaModal(projId, instId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return showToast('Projeto não encontrado', 'error');

  let inst = null;
  if (Array.isArray(p.installments)) {
    inst = p.installments.find(x => String(x.id) === String(instId));
  }
  
  // Fallback para projetos legados
  if (!inst) {
    const totalVal = parseFloat(p.value || 0);
    const paidVal = (p.payments || []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
    inst = {
      id: instId,
      number: 1,
      desc: 'Saldo Pendente',
      amount: Math.max(0, totalVal - paidVal)
    };
  }

  document.getElementById('baixaProjId').value = String(projId);
  document.getElementById('baixaInstId').value = String(instId);

  const infoProj = document.getElementById('baixaInfoProj');
  const infoCli = document.getElementById('baixaInfoClient');
  const infoDesc = document.getElementById('baixaInfoDesc');
  const infoAmount = document.getElementById('baixaInfoAmount');

  if (infoProj) infoProj.textContent = p.name;
  if (infoCli) infoCli.textContent = `Cliente: ${p.client || 'Sem cliente'}`;
  if (infoDesc) infoDesc.textContent = inst.desc || 'Parcela';
  if (infoAmount) infoAmount.textContent = fmt(inst.amount);

  document.getElementById('baixaAmount').value = toBRLInputStr(inst.amount);
  document.getElementById('baixaDate').value = today();
  
  const lastMethod = localStorage.getItem('mavic_lastPayMethod') || 'Pix';
  const methodEl = document.getElementById('baixaMethod');
  if (methodEl) methodEl.value = lastMethod;
  
  const chkReceipt = document.getElementById('baixaOpenReceipt');
  if (chkReceipt) chkReceipt.checked = false;

  const chkWhatsApp = document.getElementById('baixaSendWhatsApp');
  if (chkWhatsApp) {
    chkWhatsApp.checked = localStorage.getItem('mavic_sendWhatsAppOnBaixa') !== 'false';
  }

  document.getElementById('darBaixaOverlay').classList.add('open');
}

function closeDarBaixaModal() {
  document.getElementById('darBaixaOverlay').classList.remove('open');
}

function confirmDarBaixa() {
  const projId = document.getElementById('baixaProjId')?.value;
  const instId = document.getElementById('baixaInstId')?.value;
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return showToast('Projeto não encontrado', 'error');

  const amount = parseCurrencyInput(document.getElementById('baixaAmount')?.value || '0');
  const date = document.getElementById('baixaDate')?.value || today();
  const method = document.getElementById('baixaMethod')?.value || 'Pix';
  const openReceipt = document.getElementById('baixaOpenReceipt')?.checked;
  const sendWhatsApp = document.getElementById('baixaSendWhatsApp')?.checked;

  if (isNaN(amount) || amount <= 0) return showToast('Valor recebido inválido', 'warning');
  if (!date) return showToast('Informe a data do recebimento', 'warning');

  // Lembra a última forma de pagamento e preferência de WhatsApp
  localStorage.setItem('mavic_lastPayMethod', method);
  localStorage.setItem('mavic_sendWhatsAppOnBaixa', sendWhatsApp ? 'true' : 'false');

  // Atualiza ou marca a parcela como paga
  let instDesc = 'Parcela';
  let matchedInstId = null;
  if (Array.isArray(p.installments)) {
    const inst = p.installments.find(x => String(x.id) === String(instId));
    if (inst) {
      inst.status = 'Pago';
      inst.paidDate = date;
      inst.method = method;
      instDesc = inst.desc;
      matchedInstId = inst.id;
    }
  }

  // Registra no histórico de pagamentos do projeto
  if (!Array.isArray(p.payments)) p.payments = [];
  const newPayId = Date.now();
  p.payments.push({
    id: newPayId,
    installmentId: matchedInstId || instId,
    amount: amount,
    date: date,
    method: method,
    desc: instDesc
  });

  p.paid = p.payments.reduce((s, x) => s + parseFloat(x.amount || 0), 0);

  scheduleSync();
  closeDarBaixaModal();
  updatePayKPIs();
  updateClientFilter();
  updatePendingClientFilter();
  updateYearFilter();
  renderPendingInstallments();
  renderPagamentos();

  showToast(`Recebimento de ${fmt(amount)} confirmado com sucesso!`, 'success');

  if (openReceipt) {
    setTimeout(() => {
      downloadReceiptPDFDirect(projId, newPayId);
    }, 400);
  }

  if (sendWhatsApp) {
    setTimeout(() => {
      sendPaymentWhatsApp(projId, newPayId);
    }, openReceipt ? 800 : 250);
  }
}

// ══════════════════════════════════════════
//  WHATSAPP: COBRANÇA / LEMBRETE DE PARCELA PENDENTE
// ══════════════════════════════════════════
function sendCobrarWhatsApp(projId, instId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return showToast('Projeto não encontrado', 'error');
  
  let inst = (p.installments || []).find(x => String(x.id) === String(instId));
  if (!inst) {
    const totalVal = parseFloat(p.value || 0);
    const paidVal = (p.payments || []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
    inst = { desc: 'Saldo pendente', amount: Math.max(0, totalVal - paidVal), dueDate: p.date };
  }

  const cl = (clients || []).find(c => c && c.name && c.name.toLowerCase().trim() === (p.client || '').toLowerCase().trim());
  const phone = cl?.phone ? cl.phone.replace(/\D/g, '') : '';
  const pixKey = localStorage.getItem('mavic_pixKey') || '350.605.018-41';
  const pixName = localStorage.getItem('mavic_pixName') || 'Victor Lourenço Pereira';
  const pixBank = localStorage.getItem('mavic_pixBank') || 'Nu Pagamentos';

  const amountStr = fmt(inst.amount);
  const descStr = inst.desc || 'Parcela';
  const dateFormatted = inst.dueDate ? new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
  const firstName = (p.client || 'Cliente').split(' ')[0];

  let daysDiff = 0;
  if (inst.dueDate) {
    const dDue = new Date(inst.dueDate + 'T12:00:00');
    const dToday = new Date(today() + 'T12:00:00');
    daysDiff = Math.round((dDue.getTime() - dToday.getTime()) / (1000 * 60 * 60 * 24));
  }

  let introLine = `Passando para informar sobre o pagamento referente ao projeto *${p.name}*:`;
  if (daysDiff < 0) {
    introLine = `Passando para lembrar sobre a parcela referente ao projeto *${p.name}*, que venceu em *${dateFormatted}*:`;
  } else if (daysDiff === 0) {
    introLine = `Passando para lembrar que a parcela referente ao projeto *${p.name}* vence hoje (*${dateFormatted}*):`;
  } else if (daysDiff <= 2) {
    introLine = `Passando para lembrar que a parcela referente ao projeto *${p.name}* vencerá em breve (${daysDiff === 1 ? 'amanhã' : 'em 2 dias'}, *${dateFormatted}*):`;
  }

  const msg = `Olá, *${firstName}*! Tudo bem?

${introLine}

📌 *Referente a:* ${descStr}
💰 *Valor:* ${amountStr}
📅 *Vencimento:* ${dateFormatted}

🔑 *Chave Pix:* ${pixKey}
👤 *Favorecido:* ${pixName} (${pixBank})

Caso já tenha efetuado o pagamento, por favor nos envie o comprovante. Qualquer dúvida estamos à disposição!`;

  const url = `https://api.whatsapp.com/send?phone=${phone ? '55' + phone : ''}&text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// ══════════════════════════════════════════
//  RENDER: RECEBIDOS / PAGOS
// ══════════════════════════════════════════
function renderPagamentos() {
  const tbody = document.getElementById('payTableBody');
  const mobileList = document.getElementById('payMobileList');
  if(!tbody && !mobileList) return;
  const search = (document.getElementById('fPaySearch')?.value || '').toLowerCase().trim();
  const clientFilter = document.getElementById('fPayClient')?.value || '';
  const yearFilter = document.getElementById('fPayYear')?.value || '';
  const monthFilter = document.getElementById('fPayMonth')?.value || '';
  
  let allPayments = [];
  (projects || []).forEach(p => {
    if (!p) return;
    let pays = p.payments;
    if (typeof pays === 'string') {
      try { pays = JSON.parse(pays); } catch(e) { pays = []; }
    }
    if (!Array.isArray(pays)) pays = [];
    pays.forEach(pay => {
      if (!pay) return;
      allPayments.push({
        payment: pay,
        project: p,
        client: p.client || 'Sem cliente'
      });
    });
  });
  
  allPayments.sort((a, b) => {
    const dateA = a.payment?.date ? new Date(a.payment.date + (String(a.payment.date).includes('T') ? '' : 'T12:00:00')).getTime() : 0;
    const dateB = b.payment?.date ? new Date(b.payment.date + (String(b.payment.date).includes('T') ? '' : 'T12:00:00')).getTime() : 0;
    return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
  });
  
  if (search) {
    allPayments = allPayments.filter(item => {
      const cli = (item.client || '').toLowerCase();
      const proj = (item.project?.name || '').toLowerCase();
      const method = (item.payment?.method || '').toLowerCase();
      const amountStr = String(item.payment?.amount || '');
      const fmtStr = fmt(item.payment?.amount || 0).toLowerCase();
      return cli.includes(search) || proj.includes(search) || method.includes(search) || amountStr.includes(search) || fmtStr.includes(search);
    });
  }
  
  if (clientFilter) {
    allPayments = allPayments.filter(item => item.client === clientFilter);
  }
  
  if (yearFilter) {
    allPayments = allPayments.filter(item => {
      const d = String(item.payment?.date || '');
      return d.startsWith(yearFilter) || d.endsWith(yearFilter);
    });
  }
  
  if (monthFilter) {
    allPayments = allPayments.filter(item => {
      const d = String(item.payment?.date || '');
      if (d.includes('-')) {
        const parts = d.split('-');
        return parts[1] === monthFilter;
      }
      if (d.includes('/')) {
        const parts = d.split('/');
        return parts[1] === monthFilter;
      }
      return false;
    });
  }
  
  const pgEl = document.getElementById('payPagination');
  if (pgEl) pgEl.innerHTML = pgBarHtml('pagamentos', allPayments.length, 'renderPagamentos');

  if (!allPayments.length) {
    const isFiltered = Boolean(search || clientFilter || yearFilter || monthFilter);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px"><i class="bi bi-cash-stack" style="font-size:24px;display:block;margin-bottom:6px;opacity:0.6"></i>Nenhum pagamento registrado${isFiltered ? `<br><button class="btn-clear-filter" onclick="clearPayFilters()"><i class="bi bi-x-circle"></i> Limpar filtros</button>` : ''}</td></tr>` + pgFillerRowsHtml('pagamentos', 0, 6);
    if (mobileList) mobileList.innerHTML = `<div style="text-align:center;color:var(--text3);padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:16px"><i class="bi bi-cash-stack" style="font-size:28px;display:block;margin-bottom:6px;opacity:0.6"></i>Nenhum pagamento registrado${isFiltered ? `<br><button class="btn-clear-filter" onclick="clearPayFilters()"><i class="bi bi-x-circle"></i> Limpar filtros</button>` : ''}</div>` + pgFillerCardsHtml('pagamentos', 0, 170);
    return;
  }

  const pageItems = pgSlice(allPayments, 'pagamentos');

  if (tbody) {
    tbody.innerHTML = pageItems.map(item => {
      const projId = item.project?.id || 0;
      const payId = item.payment?.id || 0;
      const clientName = item.client || 'Sem cliente';
      const projectName = item.project?.name || 'Projeto sem nome';
      const rawDate = item.payment?.date || '';
      let formattedDate = '—';
      if (rawDate) {
        const parsed = new Date(rawDate + (String(rawDate).includes('T') ? '' : 'T12:00:00'));
        formattedDate = isNaN(parsed.getTime()) ? rawDate : parsed.toLocaleDateString('pt-BR');
      }
      const method = item.payment?.method || 'Pix';
      const amountVal = parseFloat(item.payment?.amount || 0);

      return `
        <tr>
          <td style="font-weight:600">
            <span class="kcard-avatar" style="background:${getClientColor(clientName)};display:inline-flex;margin-right:8px;vertical-align:middle;width:24px;height:24px;font-size:10px">${getInitials(clientName)}</span>
            ${clientName}
          </td>
          <td>
            <span role="button" onclick="openProjectFinanceModal('${projId}')" style="cursor:pointer;color:var(--accent);font-weight:600;display:inline-flex;align-items:center;gap:5px" title="Clique para ver o financeiro e parcelas deste projeto">
              <i class="bi bi-folder2-open"></i> ${projectName} <i class="bi bi-pencil-square" style="font-size:11px;opacity:0.7"></i>
            </span>
          </td>
          <td><i class="bi bi-calendar3"></i> ${formattedDate}</td>
          <td><span class="badge" style="background:var(--surface2);color:var(--text2);font-size:11px;font-weight:600;border:1px solid var(--border)">${method}</span></td>
          <td style="font-family:'Outfit',sans-serif;font-weight:700;font-size:14px;color:var(--green)">+${fmt(amountVal)}</td>
          <td style="text-align:right">
            <div style="display:inline-flex;gap:4px;justify-content:flex-end;width:100%;align-items:center">
              <button class="btn btn-ghost btn-sm" onclick="sendPaymentWhatsApp('${projId}', '${payId}')" style="padding:4px 8px;color:#25D366" title="Confirmar via WhatsApp"><i class="bi bi-whatsapp"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="downloadReceiptPDFDirect('${projId}', '${payId}')" style="padding:4px 8px;color:var(--red)" title="Visualizar / Compartilhar PDF"><i class="bi bi-file-pdf"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="generateReceipt('${projId}', '${payId}')" style="padding:4px 8px;color:var(--accent)" title="Ver Recibo"><i class="bi bi-receipt"></i></button>
              <button class="btn btn-danger btn-sm" onclick="deletePaymentDirect('${projId}', '${payId}')" style="padding:4px 8px" title="Excluir"><i class="bi bi-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('') + pgFillerRowsHtml('pagamentos', pageItems.length, 6);
  }

  if (mobileList) {
    mobileList.innerHTML = pageItems.map(item => {
      const projId = item.project?.id || 0;
      const payId = item.payment?.id || 0;
      const clientName = item.client || 'Sem cliente';
      const projectName = item.project?.name || 'Projeto sem nome';
      const rawDate = item.payment?.date || '';
      let formattedDate = '—';
      if (rawDate) {
        const parsed = new Date(rawDate + (String(rawDate).includes('T') ? '' : 'T12:00:00'));
        formattedDate = isNaN(parsed.getTime()) ? rawDate : parsed.toLocaleDateString('pt-BR');
      }
      const method = item.payment?.method || 'Pix';
      const amountVal = parseFloat(item.payment?.amount || 0);

      return `
        <div class="pay-card">
          <div class="pay-card-top">
            <div class="pay-card-client">
              <span class="kcard-avatar" style="background:${getClientColor(clientName)};display:inline-flex;width:24px;height:24px;font-size:10px">${getInitials(clientName)}</span>
              <span>${clientName}</span>
            </div>
            <span class="badge" style="background:var(--surface2);color:var(--text2);font-size:11px;font-weight:600;border:1px solid var(--border)">${method}</span>
          </div>

          <div class="pay-card-project" onclick="openProjectFinanceModal('${projId}')" style="cursor:pointer" title="Gerenciar financeiro do projeto">
            <i class="bi bi-folder2-open" style="color:var(--accent);margin-right:4px"></i>
            <strong style="color:var(--accent)">${projectName}</strong> <i class="bi bi-pencil-square" style="font-size:11.5px;opacity:0.8;margin-left:4px"></i>
          </div>

          <div class="pay-card-grid">
            <div class="pay-card-grid-item">
              <span class="pay-grid-lbl"><i class="bi bi-calendar3"></i> Data</span>
              <span class="pay-grid-val">${formattedDate}</span>
            </div>
            <div class="pay-card-grid-item">
              <span class="pay-grid-lbl"><i class="bi bi-cash-coin"></i> Valor Recebido</span>
              <span class="pay-grid-val price">+${fmt(amountVal)}</span>
            </div>
          </div>

          <div class="pay-card-actions">
            <div class="pay-card-actions-left">
              <button class="btn btn-ghost btn-sm" onclick="sendPaymentWhatsApp('${projId}', '${payId}')" style="padding:6px 9px;color:#25D366" title="Confirmar via WhatsApp"><i class="bi bi-whatsapp"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="downloadReceiptPDFDirect('${projId}', '${payId}')" style="padding:6px 9px;color:var(--red)" title="Visualizar / Compartilhar PDF"><i class="bi bi-file-pdf"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="generateReceipt('${projId}', '${payId}')" style="padding:6px 9px;color:var(--accent)" title="Ver Recibo"><i class="bi bi-receipt"></i></button>
            </div>
            <div class="pay-card-actions-right">
              <button class="btn btn-danger btn-sm" onclick="deletePaymentDirect('${projId}', '${payId}')" style="padding:6px 8px" title="Excluir"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        </div>
      `;
    }).join('') + pgFillerCardsHtml('pagamentos', pageItems.length, 170);
  }
}

function deletePaymentDirect(projId, payId) {
  showConfirm('Deseja excluir este pagamento definitivamente?', () => {
    const p = (projects || []).find(x => String(x.id) === String(projId));
    if (p) {
      const payToDelete = (p.payments || []).find(pay => String(pay.id) === String(payId));

      // Se o projeto possuir parcelas (installments), reabre a parcela correspondente para 'Pendente'
      if (Array.isArray(p.installments) && payToDelete) {
        let inst = null;
        if (payToDelete.installmentId) {
          inst = p.installments.find(x => String(x.id) === String(payToDelete.installmentId));
        }
        if (!inst) {
          inst = p.installments.find(x => String(x.id) === String(payToDelete.id));
        }
        if (!inst && payToDelete.desc) {
          inst = p.installments.find(x => x.desc === payToDelete.desc && x.status === 'Pago');
        }
        if (!inst) {
          inst = p.installments.find(x => x.status === 'Pago' && Math.abs(parseFloat(x.amount || 0) - parseFloat(payToDelete.amount || 0)) < 0.01)
              || p.installments.slice().reverse().find(x => x.status === 'Pago');
        }

        if (inst) {
          inst.status = 'Pendente';
          delete inst.paidDate;
          delete inst.method;
        }
      }

      p.payments = (p.payments || []).filter(pay => String(pay.id) !== String(payId));
      p.paid = p.payments.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
      scheduleSync();
      updatePayKPIs();
      updateClientFilter();
      updatePendingClientFilter();
      updateYearFilter();
      renderPagamentos();
      renderPendingInstallments();
      showToast('Pagamento excluído e parcela reaberta em "A Receber"!', 'info');
    }
  });
}

function openAddPaymentDirectModal() {
  const clientSel = document.getElementById('directPayClient');
  if(!clientSel) return;
  
  const clientNames = new Set((clients || []).map(c => c?.name).filter(Boolean));
  (projects || []).forEach(p => { if (p && p.client) clientNames.add(p.client); });
  const sorted = Array.from(clientNames).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  
  clientSel.innerHTML = '<option value="">Selecione o cliente…</option>' + sorted.map(name => `<option value="${name}">${name}</option>`).join('');
  document.getElementById('directPayProject').innerHTML = '<option value="">Selecione o cliente primeiro…</option>';
  document.getElementById('directPayAmount').value = '';
  document.getElementById('directPayDate').value = today();
  
  const lastMethod = localStorage.getItem('mavic_lastPayMethod') || 'Pix';
  const methodEl = document.getElementById('directPayMethod');
  if (methodEl) methodEl.value = lastMethod;

  const newMode = document.getElementById('directPayNewMode');
  if (newMode) newMode.checked = false;
  const newClient = document.getElementById('directPayNewClient'); if (newClient) newClient.value = '';
  const newProject = document.getElementById('directPayNewProject'); if (newProject) newProject.value = '';
  const finalCol = (appColumns || []).find(c => isHiddenColumn(c.id));
  const hint = document.getElementById('directPayFinalColHint');
  if (hint) hint.textContent = finalCol ? finalCol.id : 'Finalizado';
  toggleDirectPayMode();
  document.getElementById('addPaymentDirectOverlay').classList.add('open');
}

function closeAddPaymentDirectModal() {
  document.getElementById('addPaymentDirectOverlay').classList.remove('open');
}

function toggleDirectPayMode() {
  const isNew = document.getElementById('directPayNewMode')?.checked;
  document.getElementById('directPayExistingWrap').style.display = isNew ? 'none' : '';
  document.getElementById('directPayNewWrap').style.display = isNew ? '' : 'none';
}

// Autocomplete do "Nome do Cliente" no fluxo de cliente/projeto novos
function handleDirectPayNewClientInput() {
  const val = (document.getElementById('directPayNewClient')?.value || '').trim().toLowerCase();
  const box = document.getElementById('directPayNewClientSuggest');
  if (!box) return;
  if (!val) return hideDirectPayNewClientSuggestions();
  const matches = (clients || []).filter(c => c && c.name && c.name.toLowerCase().includes(val)).slice(0, 6);
  if (!matches.length) return hideDirectPayNewClientSuggestions();
  box.innerHTML = matches.map(c => `
    <div class="ac-item" onmousedown="selectDirectPayNewClientSuggestion(${c.id})">
      <div class="ac-item-top"><span class="ac-item-name">${c.name}</span></div>
    </div>
  `).join('');
  box.classList.remove('d-none');
}

function selectDirectPayNewClientSuggestion(clientId) {
  const cl = (clients || []).find(c => c.id === clientId);
  if (!cl) return;
  document.getElementById('directPayNewClient').value = cl.name;
  hideDirectPayNewClientSuggestions();
}

function hideDirectPayNewClientSuggestions() {
  const box = document.getElementById('directPayNewClientSuggest');
  if (box) { box.classList.add('d-none'); box.innerHTML = ''; }
}

function handleDirectPayClientChange() {
  const clientName = document.getElementById('directPayClient').value;
  const projectSel = document.getElementById('directPayProject');
  if (!clientName) {
    projectSel.innerHTML = '<option value="">Selecione o cliente primeiro…</option>';
    return;
  }
  
  const activeProjs = (projects || []).filter(p => {
    if (!p || p.client !== clientName || p.archived) return false;
    const total = parseFloat(p.value || 0);
    const paid = (p.payments || []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
    return !(total > 0 && paid >= total);
  });
  
  if (!activeProjs.length) {
    const allProjs = (projects || []).filter(p => p && p.client === clientName && !p.archived);
    if (allProjs.length) {
      projectSel.innerHTML = '<option value="">Selecione o projeto…</option>' + allProjs.map(p => {
        const total = parseFloat(p.value || 0);
        const paid = (p.payments || []).reduce((s,x)=>s+parseFloat(x.amount||0),0);
        return `<option value="${p.id}">${p.name} (Quitado: ${fmt(paid)}/${fmt(total)})</option>`;
      }).join('');
    } else {
      projectSel.innerHTML = '<option value="">Nenhum projeto encontrado para este cliente</option>';
    }
    return;
  }
  
  projectSel.innerHTML = '<option value="">Selecione o projeto…</option>' + activeProjs.map(p => {
    const total = parseFloat(p.value || 0);
    const paid = (p.payments || []).reduce((s,x)=>s+parseFloat(x.amount||0),0);
    return `<option value="${p.id}">${p.name} (Saldo Pendente: ${fmt(total-paid)})</option>`;
  }).join('');
}

function saveDirectPayment() {
  const isNew = document.getElementById('directPayNewMode')?.checked;
  const amount = parseCurrencyInput(document.getElementById('directPayAmount').value);
  const date = document.getElementById('directPayDate').value;
  const method = document.getElementById('directPayMethod')?.value || 'Pix';

  if (isNaN(amount) || amount <= 0) return showToast('Valor do pagamento é inválido', 'warning');
  if (!date) return showToast('Selecione uma data', 'warning');

  let p;

  if (isNew) {
    const clientName = document.getElementById('directPayNewClient').value.trim();
    const projectName = document.getElementById('directPayNewProject').value.trim();
    if (!clientName) return showToast('Digite o nome do cliente', 'warning');
    if (!projectName) return showToast('Digite o nome do projeto', 'warning');

    const now = Date.now();
    let cl = (clients || []).find(c => c && c.name && c.name.toLowerCase() === clientName.toLowerCase());
    if (!cl) {
      cl = { id: now, name: clientName, products: [], token: genTokenStr() };
      clients.push(cl);
    }

    const finalCol = (appColumns || []).find(c => isHiddenColumn(c.id)) || (appColumns && appColumns.length ? appColumns[appColumns.length - 1] : { id: 'Finalizado' });
    const instId = now + 2;
    p = {
      id: now + 1,
      name: projectName,
      client: cl.name,
      image: '',
      value: amount,
      payments: [],
      paid: 0,
      installments: [{
        id: instId,
        number: 1,
        desc: 'Pagamento Único',
        amount: amount,
        dueDate: date,
        status: 'Pago',
        paidDate: date,
        method: method
      }],
      products: [],
      product: '',
      type: (typeof projectTypes !== 'undefined' && projectTypes.length ? projectTypes[0].id : 'Outro'),
      priority: 'Baixa',
      column: finalCol.id || 'Finalizado',
      date: '',
      note: '',
      subtasks: [],
      archived: false,
      createdAt: now
    };
    projects.push(p);
  } else {
    const projId = document.getElementById('directPayProject').value;
    if (!projId) return showToast('Selecione um projeto válido', 'warning');
    p = (projects || []).find(x => String(x.id) === String(projId));
    if (!p) return showToast('Projeto não encontrado', 'error');
  }

  if (!p.payments || !Array.isArray(p.payments)) p.payments = [];
  let matchedInstId = null;
  let instDesc = 'Pagamento Avulso';
  if (isNew) {
    matchedInstId = now + 2;
    instDesc = 'Pagamento Único';
  } else if (Array.isArray(p.installments) && p.installments.length > 0) {
    const pendingInst = p.installments.find(x => x.status !== 'Pago' && Math.abs(parseFloat(x.amount || 0) - amount) < 0.01)
                     || p.installments.find(x => x.status !== 'Pago');
    if (pendingInst) {
      pendingInst.status = 'Pago';
      pendingInst.paidDate = date;
      pendingInst.method = method;
      matchedInstId = pendingInst.id;
      instDesc = pendingInst.desc;
    }
  }
  p.payments.push({ id: Date.now() + 2, installmentId: matchedInstId, amount, date, method, desc: instDesc });
  p.paid = p.payments.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  scheduleSync();
  updatePayKPIs();
  updateClientFilter();
  updatePendingClientFilter();
  updateYearFilter();
  renderPagamentos();
  renderPendingInstallments();
  closeAddPaymentDirectModal();
  showToast(isNew ? `Cliente, projeto e pagamento criados em "${p.column}"!` : 'Pagamento registrado com sucesso!', 'success');
}

function fillReceiptData(p, pay) {
  const clientName = p.client || '';
  const cl = (clients || []).find(x => x && x.name && x.name.toLowerCase().trim() === clientName.toLowerCase().trim());
  const clientDoc = cl && cl.doc ? formatDocMask(cl.doc) : 'Não informado';
  const clientAddress = cl && cl.address ? cl.address : 'Não informado';
  
  const modal = document.getElementById('reciboOverlay');
  if (modal) {
    modal.dataset.projId = String(p.id);
    modal.dataset.payId = String(pay.id);
  }
  
  const recNum = document.getElementById('recNum'); if (recNum) recNum.textContent = `Nº REC-${pay.id}`;
  const recValNum = document.getElementById('recValNum'); if (recValNum) recValNum.textContent = fmt(pay.amount);
  const recClientName = document.getElementById('recClientName'); if (recClientName) recClientName.textContent = p.client || 'Cliente';
  const recClientDoc = document.getElementById('recClientDoc'); if (recClientDoc) recClientDoc.textContent = clientDoc;
  const recClientAddress = document.getElementById('recClientAddress'); if (recClientAddress) recClientAddress.textContent = clientAddress;
  const recProjectName = document.getElementById('recProjectName'); if (recProjectName) recProjectName.textContent = p.name || 'Projeto';
  const recValWords = document.getElementById('recValWords'); if (recValWords) recValWords.textContent = valorPorExtenso(pay.amount);
  
  let formattedDate = today();
  if (pay.date) {
    const pDate = new Date(pay.date + (String(pay.date).includes('T') ? '' : 'T12:00:00'));
    if (!isNaN(pDate.getTime())) {
      const mesesExtenso = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      formattedDate = `${pDate.getDate()} de ${mesesExtenso[pDate.getMonth()]} de ${pDate.getFullYear()}`;
    }
  }
  const recDateLoc = document.getElementById('recDateAndLocation');
  if (recDateLoc) recDateLoc.textContent = `São José do Rio Preto, ${formattedDate}`;
  
  const companyName = localStorage.getItem('mavic_companyName') || 'Victor Lourenço Pereira';
  const companyDoc = localStorage.getItem('mavic_companyDoc') || '350.605.018-41';
  const recEmissor = document.getElementById('recEmissorName'); if (recEmissor) recEmissor.textContent = companyName;
  const recEmissorDoc = document.getElementById('recEmissorDoc'); if (recEmissorDoc) recEmissorDoc.textContent = `CPF/CNPJ: ${formatDocMask(companyDoc)}`;
}

function generateReceipt(projId, payId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return showToast('Projeto não encontrado', 'error');
  const pay = (p.payments || []).find(x => String(x.id) === String(payId));
  if (!pay) return showToast('Pagamento não encontrado', 'error');
  
  fillReceiptData(p, pay);
  const modal = document.getElementById('reciboOverlay');
  if (modal) modal.classList.add('open');
}

function closeReciboModal() {
  const modal = document.getElementById('reciboOverlay');
  if (modal) modal.classList.remove('open');
}

function printReceipt() {
  window.print();
}

function sendPaymentWhatsApp(projId, payId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return showToast('Projeto não encontrado', 'error');
  const pay = (p.payments || []).find(x => String(x.id) === String(payId));
  if (!pay) return showToast('Pagamento não encontrado', 'error');
  const clientName = p.client || '';
  const cl = (clients || []).find(c => c && c.name && c.name.toLowerCase().trim() === clientName.toLowerCase().trim());
  const phone = cl?.phone ? cl.phone.replace(/\D/g, '') : '';
  
  let formattedDate = '—';
  if (pay.date) {
    const pDate = new Date(pay.date + (String(pay.date).includes('T') ? '' : 'T12:00:00'));
    formattedDate = isNaN(pDate.getTime()) ? pay.date : pDate.toLocaleDateString('pt-BR');
  }

  const firstName = clientName ? clientName.split(' ')[0] : 'Cliente';
  const totalVal = parseFloat(p.value || 0);
  const totalPaid = (p.payments || []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  const rest = Math.max(0, totalVal - totalPaid);

  let statusLine = rest <= 0.01 
    ? `✨ *Status:* Projeto 100% quitado!` 
    : `⏳ *Saldo Restante:* ${fmt(rest)}`;

  const msg = `Olá, *${firstName}*! Tudo bem?

Confirmamos com sucesso o recebimento do pagamento:

📁 *Projeto:* ${p.name || 'Projeto'}
💰 *Valor Recebido:* ${fmt(pay.amount)}
📅 *Data:* ${formattedDate}
💳 *Forma:* ${pay.method || 'Pix'}
${statusLine}

Muito obrigado pela parceria e confiança! 🤝`;

  const url = `https://api.whatsapp.com/send?phone=${phone ? '55' + phone : ''}&text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

async function downloadReceiptPDFDirect(projId, payId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return showToast('Projeto não encontrado', 'error');
  const pay = (p.payments || []).find(x => String(x.id) === String(payId));
  if (!pay) return showToast('Pagamento não encontrado', 'error');

  const isMobile = isMobileDevice();
  let previewTab = null;
  if (!isMobile) {
    try {
      previewTab = window.open('', '_blank');
    } catch(e) {}
  }

  fillReceiptData(p, pay);

  const element = document.querySelector('#reciboOverlay .mbody.print-area');
  if (!element) {
    if (previewTab) previewTab.close();
    return;
  }

  const clientClean = (p.client || 'Cliente').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const projectClean = (p.name || '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const filename = `Recibo_${pay.id}_${clientClean}${projectClean ? '_' + projectClean : ''}.pdf`;
  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  showToast('Gerando PDF...', 'info');
  let wrapper = null;
  try {
    const clone = element.cloneNode(true);
    clone.classList.remove('mbody');
    clone.querySelectorAll('.no-print').forEach(el => el.remove());
    clone.style.background = '#ffffff';
    clone.style.color = '#000000';
    clone.style.padding = '25px';
    clone.style.width = '190mm';
    clone.style.minWidth = '190mm';
    clone.style.maxWidth = '190mm';
    clone.style.boxSizing = 'border-box';
    clone.style.border = '2px dotted #4b5563';
    clone.style.borderRadius = '8px';

    wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.zIndex = '-9999';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.background = '#ffffff';
    wrapper.style.width = '190mm';
    wrapper.style.minWidth = '190mm';
    wrapper.style.maxWidth = '190mm';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    await loadHtml2Pdf();
    const pdfBlob = await html2pdf().from(clone).set(opt).outputPdf('blob');
    
    await shareOrOpenPdfBlob(pdfBlob, filename, {
      title: `Recibo - ${p.client || 'Cliente'}${p.name ? ' (' + p.name + ')' : ''}`,
      text: `Recibo de Pagamento - ${p.name || 'Projeto'}`,
      previewTab
    });
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

function downloadReceiptPDFModal() {
  const modal = document.getElementById('reciboOverlay');
  if (!modal) return;
  const projId = modal.dataset.projId;
  const payId = modal.dataset.payId;
  if (projId && payId) {
    downloadReceiptPDFDirect(projId, payId);
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
  
  const total = parseFloat(v || 0).toFixed(2);
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

// ══════════════════════════════════════════
//  MODAL: GESTÃO FINANCEIRA E PARCELAS DO PROJETO
// ══════════════════════════════════════════
let currentPfProjId = null;

function openProjectFinanceModal(projId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return showToast('Projeto não encontrado', 'error');

  currentPfProjId = projId;
  renderProjectFinanceModalContent(projId);
  const overlay = document.getElementById('projFinanceOverlay');
  if (overlay) overlay.classList.add('open');
}

function closeProjectFinanceModal() {
  currentPfProjId = null;
  const overlay = document.getElementById('projFinanceOverlay');
  if (overlay) overlay.classList.remove('open');
  updatePayKPIs();
  updateClientFilter();
  updatePendingClientFilter();
  renderPagamentos();
  renderPendingInstallments();
}

function renderProjectFinanceModalContent(projId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return;

  if (typeof reconcileProjectFinancials === 'function') reconcileProjectFinancials(p);

  const titleEl = document.getElementById('pfModalProjName');
  const clientEl = document.getElementById('pfModalClientName');
  const bodyEl = document.getElementById('pfModalBody');

  if (titleEl) titleEl.innerHTML = `<i class="bi bi-folder2-open" style="color:var(--accent)"></i> ${p.name || 'Projeto'}`;
  if (clientEl) clientEl.innerHTML = `Cliente: <strong style="color:var(--text)">${p.client || 'Sem cliente'}</strong> · Etapa: <span class="badge" style="font-size:11px;background:var(--surface2)">${p.column || 'Briefing'}</span>`;

  const totalContract = parseFloat(p.value || 0);
  const pays = Array.isArray(p.payments) ? p.payments : [];
  const totalPaid = pays.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  const totalPending = Math.max(0, totalContract - totalPaid);
  const insts = Array.isArray(p.installments) ? p.installments : [];

  let html = `
    <!-- CARDS DE RESUMO DO PROJETO -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px">
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 14px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center">
          <span>Contrato Total</span>
          <button class="btn btn-ghost btn-sm" onclick="promptEditContractValue('${projId}')" style="padding:1px 6px;font-size:11px" title="Alterar valor total do contrato"><i class="bi bi-pencil"></i> Editar</button>
        </div>
        <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:var(--text)">${fmt(totalContract)}</div>
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 14px">
        <div style="font-size:11px;font-weight:700;color:var(--green);text-transform:uppercase;margin-bottom:4px">Total Recebido</div>
        <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:var(--green)">+${fmt(totalPaid)}</div>
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 14px">
        <div style="font-size:11px;font-weight:700;color:${totalPending > 0 ? 'var(--yellow)' : 'var(--text3)'};text-transform:uppercase;margin-bottom:4px">Saldo a Receber</div>
        <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:${totalPending > 0 ? 'var(--yellow)' : 'var(--text3)'}">${fmt(totalPending)}</div>
      </div>
    </div>

    <!-- AÇÕES RÁPIDAS & REORGANIZAÇÃO -->
    <div style="background:rgba(var(--accent-rgb, 196,145,92), 0.08);border:1px dashed var(--accent);border-radius:12px;padding:12px 14px">
      <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px;display:flex;align-items:center;gap:6px">
        <i class="bi bi-lightning-charge-fill"></i> Ações Rápidas & Reconfiguração de Parcelamento:
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${totalPending > 0 ? `
          <button class="btn btn-sm btn-primary" onclick="quickPayoffAll('${projId}')" style="background:var(--green);border-color:var(--green);padding:6px 12px;font-size:12px" title="Quitar todo o saldo pendente de uma só vez">
            <i class="bi bi-check2-all"></i> Quitar Saldo Total (${fmt(totalPending)})
          </button>
          <button class="btn btn-sm btn-ghost" onclick="unifyPendingInstallments('${projId}')" style="border:1px solid var(--border);padding:6px 12px;font-size:12px;background:var(--surface)" title="Juntar todas as parcelas pendentes em 1 parcela única à vista">
            <i class="bi bi-layers"></i> Unificar em 1 Parcela Única À Vista
          </button>
          <button class="btn btn-sm btn-ghost" onclick="openReparcelarModal('${projId}')" style="border:1px solid var(--border);padding:6px 12px;font-size:12px;background:var(--surface)" title="Redividir o saldo pendente em várias parcelas iguais">
            <i class="bi bi-grid-3x2-gap"></i> Re-dividir Saldo
          </button>
        ` : `
          <span style="font-size:12px;color:var(--green);font-weight:600;display:inline-flex;align-items:center;gap:4px"><i class="bi bi-check-circle-fill"></i> Este projeto está 100% quitado!</span>
        `}
        <button class="btn btn-sm btn-ghost" onclick="openAddNewInstallmentForm('${projId}')" style="border:1px solid var(--border);padding:6px 12px;font-size:12px;background:var(--surface);margin-left:auto">
          <i class="bi bi-plus-lg"></i> Nova Parcela
        </button>
      </div>
    </div>

    <!-- SEÇÃO 1: CRONOGRAMA DE PARCELAS -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
        <span><i class="bi bi-calendar-event"></i> Cronograma de Parcelas (${insts.length})</span>
        <span style="font-size:11px;color:var(--text3);font-weight:400">Edite descrições, vencimentos e valores diretamente</span>
      </div>

      ${insts.length === 0 ? `
        <div style="text-align:center;padding:18px;color:var(--text3);font-size:13px">
          Nenhuma parcela configurada neste projeto.<br>
          <button class="btn btn-sm btn-primary" onclick="initProjectInstallments('${projId}')" style="margin-top:8px">
            <i class="bi bi-magic"></i> Gerar Cronograma Automático
          </button>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:8px">
          ${insts.map((inst, idx) => {
            const isPaid = inst.status === 'Pago';
            return `
              <div style="display:flex;align-items:flex-end;gap:8px;padding:8px 10px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);flex-wrap:wrap">
                <div style="flex:1;min-width:150px">
                  <span style="font-size:10px;color:var(--text3);display:block;font-weight:600;margin-bottom:2px">Descrição:</span>
                  <input type="text" class="inp inp-sm" style="width:100%;font-size:12px;font-weight:600;height:28px;padding:2px 8px;border-radius:6px" value="${inst.desc || ''}" onchange="updateInstField('${projId}', '${inst.id}', 'desc', this.value)">
                </div>

                <div style="width:125px;min-width:110px">
                  <span style="font-size:10px;color:var(--text3);display:block;font-weight:600;margin-bottom:2px">Vencimento:</span>
                  <input type="date" class="inp inp-sm" style="width:100%;font-size:11.5px;height:28px;padding:2px 6px;border-radius:6px" value="${inst.dueDate || ''}" onchange="updateInstField('${projId}', '${inst.id}', 'dueDate', this.value)">
                </div>

                <div style="width:110px;min-width:95px">
                  <span style="font-size:10px;color:var(--text3);display:block;font-weight:600;margin-bottom:2px">Valor (R$):</span>
                  <input type="text" inputmode="decimal" class="inp inp-sm" style="width:100%;font-size:12px;font-family:'Outfit',sans-serif;font-weight:700;height:28px;padding:2px 8px;border-radius:6px" value="${toBRLInputStr(inst.amount)}" oninput="maskCurrencyInput(this)" onchange="updateInstField('${projId}', '${inst.id}', 'amount', this.value)">
                </div>

                <div style="width:90px;text-align:center">
                  <span style="font-size:10px;color:var(--text3);display:block;font-weight:600;margin-bottom:2px">Status:</span>
                  <div style="height:28px;display:flex;align-items:center;justify-content:center">
                    ${isPaid 
                      ? `<span class="badge" style="background:rgba(22,163,74,0.15);color:var(--green);font-size:11px;padding:0 8px;height:26px;display:inline-flex;align-items:center;gap:3px;font-weight:600;border-radius:6px"><i class="bi bi-check2"></i> Pago</span>` 
                      : `<span class="badge" style="background:rgba(234,179,8,0.15);color:var(--yellow);font-size:11px;padding:0 8px;height:26px;display:inline-flex;align-items:center;gap:3px;font-weight:600;border-radius:6px"><i class="bi bi-clock"></i> Pendente</span>`
                    }
                  </div>
                </div>

                <div style="display:flex;gap:5px;align-items:center;margin-left:auto;height:28px">
                  ${!isPaid ? `
                    <button class="btn btn-primary btn-sm" onclick="openDarBaixaModal('${projId}', '${inst.id}')" style="height:26px;padding:0 9px;background:var(--green);border-color:var(--green);font-size:11.5px;display:inline-flex;align-items:center;gap:3px;border-radius:6px;font-weight:600" title="Confirmar Recebimento">
                      <i class="bi bi-check2"></i> Baixa
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="deleteProjectInstallment('${projId}', '${inst.id}')" style="height:26px;width:26px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:12px;color:var(--red);border:1px solid rgba(239,68,68,0.25);background:var(--red-bg);border-radius:6px" title="Excluir Parcela">
                      <i class="bi bi-trash3"></i>
                    </button>
                  ` : `
                    <button class="btn btn-ghost btn-sm" onclick="reopenProjectInstallment('${projId}', '${inst.id}')" style="height:26px;padding:0 9px;font-size:11.5px;color:var(--yellow);border:1px solid var(--border);display:inline-flex;align-items:center;gap:3px;border-radius:6px" title="Reabrir / Estornar Parcela">
                      <i class="bi bi-arrow-counterclockwise"></i> Reabrir
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>

    <!-- SEÇÃO 2: HISTÓRICO DE PAGAMENTOS REALIZADOS -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
        <span><i class="bi bi-receipt"></i> Pagamentos Registrados (${pays.length})</span>
        <button class="btn btn-sm btn-ghost" onclick="toggleAddQuickPayForm()" style="padding:3px 8px;font-size:11.5px;border:1px solid var(--border)">
          <i class="bi bi-plus-lg"></i> Registrar Pagamento
        </button>
      </div>

      <!-- FORMULÁRIO RÁPIDO PARA ADICIONAR PAGAMENTO DIRETO NO MODAL -->
      <div id="pfAddPayBox" style="display:none;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">Novo Pagamento para este Projeto:</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px;align-items:flex-end">
          <div>
            <label style="font-size:10.5px;color:var(--text3);display:block">Valor (R$) *</label>
            <input type="text" inputmode="decimal" class="inp inp-sm" id="pfNewPayAmount" placeholder="R$ 0,00" oninput="maskCurrencyInput(this)">
          </div>
          <div>
            <label style="font-size:10.5px;color:var(--text3);display:block">Data *</label>
            <input type="date" class="inp inp-sm" id="pfNewPayDate" value="${today()}">
          </div>
          <div>
            <label style="font-size:10.5px;color:var(--text3);display:block">Forma</label>
            <select class="inp inp-sm" id="pfNewPayMethod">
              <option value="Pix">Pix</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Cartão">Cartão</option>
              <option value="Transferência">Transferência</option>
              <option value="Boleto">Boleto</option>
            </select>
          </div>
          <div>
            <button class="btn btn-primary btn-sm" onclick="savePfDirectPayment('${projId}')" style="background:var(--green);border-color:var(--green);padding:5px 10px">
              <i class="bi bi-check2"></i> Salvar
            </button>
          </div>
        </div>
      </div>

      ${pays.length === 0 ? `
        <div style="text-align:center;padding:14px;color:var(--text3);font-size:12.5px">Nenhum pagamento registrado para este projeto ainda.</div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:6px">
          ${pays.map(pay => {
            const rawDate = pay.date || '';
            let formattedDate = '—';
            if (rawDate) {
              const parsed = new Date(rawDate + (String(rawDate).includes('T') ? '' : 'T12:00:00'));
              formattedDate = isNaN(parsed.getTime()) ? rawDate : parsed.toLocaleDateString('pt-BR');
            }
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">
                <div>
                  <div style="font-size:13px;font-weight:700;font-family:'Outfit',sans-serif;color:var(--green)">
                    + ${fmt(pay.amount)} <span style="font-size:11.5px;color:var(--text3);font-weight:400;font-family:inherit">· ${formattedDate} · ${pay.method || 'Pix'}</span>
                  </div>
                  <div style="font-size:11.5px;color:var(--text2)">${pay.desc || 'Pagamento'}</div>
                </div>
                <div style="display:flex;gap:4px">
                  <button class="btn btn-ghost btn-sm" onclick="downloadReceiptPDFDirect('${projId}', '${pay.id}')" style="padding:4px 8px;color:var(--red)" title="Visualizar PDF"><i class="bi bi-file-pdf"></i></button>
                  <button class="btn btn-danger btn-sm" onclick="deletePaymentDirect('${projId}', '${pay.id}');setTimeout(()=>renderProjectFinanceModalContent('${projId}'),150)" style="padding:4px 8px" title="Excluir Pagamento"><i class="bi bi-trash"></i></button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;

  if (bodyEl) bodyEl.innerHTML = html;
}

function promptEditContractValue(projId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return;
  const currentVal = parseFloat(p.value || 0);

  showPrompt('Informe o novo valor total contratado para este projeto:', (rawInput) => {
    if (rawInput === null || rawInput === undefined || String(rawInput).trim() === '') return;
    const newVal = parseCurrencyInput(rawInput);
    if (isNaN(newVal) || newVal < 0) return showToast('Valor inválido', 'warning');

    p.value = newVal;
    reconcileProjectFinancials(p);
    scheduleSync();
    updatePayKPIs();
    renderPagamentos();
    renderPendingInstallments();
    renderProjectFinanceModalContent(projId);
    showToast(`Valor do contrato atualizado para ${fmt(newVal)}!`, 'success');
  }, {
    title: 'Alterar Valor do Contrato',
    icon: 'bi bi-cash-stack',
    label: 'Novo Valor do Contrato (R$)',
    defaultValue: toBRLInputStr(currentVal),
    isCurrency: true,
    inputMode: 'decimal',
    okText: 'Salvar Valor'
  });
}

function quickPayoffAll(projId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return;
  const totalContract = parseFloat(p.value || 0);
  const paid = (p.payments || []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  const pending = Math.max(0, totalContract - paid);
  if (pending <= 0) return showToast('Este projeto já está 100% quitado!', 'info');

  const lastMethod = localStorage.getItem('mavic_lastPayMethod') || 'Pix';

  showConfirm(`Confirmar quitação integral no valor de ${fmt(pending)} via ${lastMethod}?`, () => {
    const payDate = today();
    const newPayId = Date.now();
    if (!Array.isArray(p.payments)) p.payments = [];
    p.payments.push({
      id: newPayId,
      amount: pending,
      date: payDate,
      method: lastMethod,
      desc: 'Quitação Integral'
    });
    p.paid = p.payments.reduce((s, x) => s + parseFloat(x.amount || 0), 0);

    if (Array.isArray(p.installments) && p.installments.length > 0) {
      p.installments.forEach(inst => {
        if (inst.status !== 'Pago') {
          inst.status = 'Pago';
          inst.paidDate = payDate;
          inst.method = lastMethod;
        }
      });
    } else {
      p.installments = [{
        id: newPayId,
        number: 1,
        desc: 'Pagamento Único À Vista',
        amount: totalContract,
        dueDate: payDate,
        status: 'Pago',
        paidDate: payDate,
        method: lastMethod
      }];
    }

    scheduleSync();
    updatePayKPIs();
    renderPagamentos();
    renderPendingInstallments();
    renderProjectFinanceModalContent(projId);
    showToast(`Projeto quitado com sucesso no valor de ${fmt(pending)}!`, 'success');

    // Opção de enviar WhatsApp de quitação
    setTimeout(() => {
      showConfirm(`Deseja enviar o comprovante de quitação no WhatsApp do cliente?`, () => {
        sendPaymentWhatsApp(projId, newPayId);
      }, {
        title: 'Enviar Confirmação WhatsApp',
        icon: 'bi bi-whatsapp',
        okText: 'Enviar WhatsApp',
        danger: false
      });
    }, 450);
  }, {
    title: 'Confirmar Quitação Integral',
    icon: 'bi bi-check2-all',
    okText: 'Confirmar Quitação',
    danger: false
  });
}

function unifyPendingInstallments(projId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return;
  const totalContract = parseFloat(p.value || 0);
  const paid = (p.payments || []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  const pending = Math.max(0, totalContract - paid);
  if (pending <= 0) return showToast('Não há saldo pendente para unificar.', 'info');

  showConfirm(`Deseja unificar todas as parcelas pendentes em 1 única parcela à vista de ${fmt(pending)}?`, () => {
    const paidInsts = (p.installments || []).filter(inst => inst.status === 'Pago');
    paidInsts.push({
      id: Date.now(),
      number: paidInsts.length + 1,
      desc: 'Pagamento Único À Vista',
      amount: pending,
      dueDate: today(),
      status: 'Pendente'
    });
    p.installments = paidInsts;

    scheduleSync();
    updatePayKPIs();
    renderPagamentos();
    renderPendingInstallments();
    renderProjectFinanceModalContent(projId);
    showToast('Parcelas unificadas em 1 única parcela à vista!', 'success');
  });
}

function openReparcelarModal(projId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return;
  const totalContract = parseFloat(p.value || 0);
  const paid = (p.payments || []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  const pending = Math.max(0, totalContract - paid);
  if (pending <= 0) return showToast('Não há saldo pendente para re-dividir.', 'info');

  showPrompt(`O saldo atual em aberto é de ${fmt(pending)}. Em quantas parcelas deseja dividir?`, (countStr) => {
    if (!countStr) return;
    const count = parseInt(countStr, 10);
    if (isNaN(count) || count <= 0 || count > 36) return showToast('Número de parcelas inválido (informe de 1 a 36)', 'warning');

    const paidInsts = (p.installments || []).filter(inst => inst.status === 'Pago');
    const perParc = Math.round((pending / count) * 100) / 100;
    let accum = 0;
    let runningId = Date.now();

    for (let i = 1; i <= count; i++) {
      const pVal = (i === count) ? Math.round((pending - accum) * 100) / 100 : perParc;
      accum += pVal;
      const pDate = addDays(today(), (i - 1) * 30);
      paidInsts.push({
        id: runningId++,
        number: paidInsts.length + 1,
        desc: count === 1 ? 'Saldo À Vista' : `Parcela ${i}/${count}`,
        amount: pVal,
        dueDate: pDate,
        status: 'Pendente'
      });
    }

    p.installments = paidInsts;
    scheduleSync();
    updatePayKPIs();
    renderPagamentos();
    renderPendingInstallments();
    renderProjectFinanceModalContent(projId);
    showToast(`Saldo redividido em ${count}x com sucesso!`, 'success');
  }, {
    title: 'Re-dividir Saldo em Parcelas',
    icon: 'bi bi-grid-3x2-gap',
    label: 'Quantidade de Parcelas (ex: 2, 3, 4)',
    defaultValue: '2',
    inputMode: 'numeric',
    helpText: 'O sistema gerará as parcelas (a cada 30 dias) e dividirá os valores automaticamente.',
    okText: 'Re-dividir'
  });
}

function openAddNewInstallmentForm(projId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return;
  if (!Array.isArray(p.installments)) p.installments = [];

  const newId = Date.now();
  p.installments.push({
    id: newId,
    number: p.installments.length + 1,
    desc: `Parcela ${p.installments.length + 1}`,
    amount: 0,
    dueDate: today(),
    status: 'Pendente'
  });

  scheduleSync();
  renderProjectFinanceModalContent(projId);
  showToast('Nova parcela adicionada! Ajuste a descrição, vencimento e valor.', 'info');
}

function initProjectInstallments(projId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return;
  const total = parseFloat(p.value || 0);
  const half = Math.round((total / 2) * 100) / 100;
  const rest = Math.round((total - half) * 100) / 100;
  const now = Date.now();

  p.installments = [
    { id: now, number: 1, desc: 'Entrada (50%)', amount: half, dueDate: today(), status: 'Pendente' },
    { id: now + 1, number: 2, desc: 'Saldo na Entrega (50%)', amount: rest, dueDate: addDays(today(), 15), status: 'Pendente' }
  ];

  reconcileProjectFinancials(p);
  scheduleSync();
  renderProjectFinanceModalContent(projId);
  renderPendingInstallments();
  showToast('Cronograma gerado com sucesso!', 'success');
}

function updateInstField(projId, instId, field, value) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p || !Array.isArray(p.installments)) return;
  const inst = p.installments.find(x => String(x.id) === String(instId));
  if (!inst) return;

  if (field === 'desc') {
    inst.desc = String(value || '').trim() || 'Parcela';
  } else if (field === 'dueDate') {
    inst.dueDate = value || today();
  } else if (field === 'amount') {
    const val = parseCurrencyInput(value);
    if (!isNaN(val) && val >= 0) inst.amount = val;
  }

  reconcileProjectFinancials(p);
  scheduleSync();
  updatePayKPIs();
  renderPagamentos();
  renderPendingInstallments();
  renderProjectFinanceModalContent(projId);
}

function deleteProjectInstallment(projId, instId) {
  showConfirm('Deseja realmente excluir esta parcela do cronograma?', () => {
    const p = (projects || []).find(x => String(x.id) === String(projId));
    if (!p || !Array.isArray(p.installments)) return;

    p.installments = p.installments.filter(x => String(x.id) !== String(instId));
    reconcileProjectFinancials(p);
    scheduleSync();
    updatePayKPIs();
    renderPagamentos();
    renderPendingInstallments();
    renderProjectFinanceModalContent(projId);
    showToast('Parcela removida!', 'info');
  });
}

function reopenProjectInstallment(projId, instId) {
  showConfirm('Deseja reabrir esta parcela como Pendente (estornando a quitação)?', () => {
    const p = (projects || []).find(x => String(x.id) === String(projId));
    if (!p || !Array.isArray(p.installments)) return;
    const inst = p.installments.find(x => String(x.id) === String(instId));
    if (!inst) return;

    inst.status = 'Pendente';
    delete inst.paidDate;
    delete inst.method;

    // Remove o pagamento correspondente se houver
    if (Array.isArray(p.payments)) {
      const matchIdx = p.payments.findIndex(pay => 
        (pay.installmentId && String(pay.installmentId) === String(inst.id)) ||
        String(pay.id) === String(inst.id) ||
        (pay.desc && inst.desc && pay.desc === inst.desc)
      );
      if (matchIdx > -1) {
        p.payments.splice(matchIdx, 1);
      }
      p.paid = p.payments.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
    }

    scheduleSync();
    updatePayKPIs();
    renderPagamentos();
    renderPendingInstallments();
    renderProjectFinanceModalContent(projId);
    showToast('Parcela reaberta como Pendente!', 'info');
  });
}

function toggleAddQuickPayForm() {
  const box = document.getElementById('pfAddPayBox');
  if (box) {
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
  }
}

function savePfDirectPayment(projId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return;

  const amount = parseCurrencyInput(document.getElementById('pfNewPayAmount')?.value || '0');
  const date = document.getElementById('pfNewPayDate')?.value || today();
  const method = document.getElementById('pfNewPayMethod')?.value || 'Pix';

  if (isNaN(amount) || amount <= 0) return showToast('Valor recebido inválido', 'warning');

  if (!Array.isArray(p.payments)) p.payments = [];
  const newPayId = Date.now();
  
  let matchedInstId = null;
  let instDesc = 'Pagamento Avulso';
  if (Array.isArray(p.installments) && p.installments.length > 0) {
    const pendingInst = p.installments.find(x => x.status !== 'Pago' && Math.abs(parseFloat(x.amount || 0) - amount) < 0.01)
                     || p.installments.find(x => x.status !== 'Pago');
    if (pendingInst) {
      pendingInst.status = 'Pago';
      pendingInst.paidDate = date;
      pendingInst.method = method;
      matchedInstId = pendingInst.id;
      instDesc = pendingInst.desc;
    }
  }

  p.payments.push({ id: newPayId, installmentId: matchedInstId, amount, date, method, desc: instDesc });
  p.paid = p.payments.reduce((s, x) => s + parseFloat(x.amount || 0), 0);

  scheduleSync();
  updatePayKPIs();
  renderPagamentos();
  renderPendingInstallments();
  renderProjectFinanceModalContent(projId);
  showToast(`Pagamento de ${fmt(amount)} registrado com sucesso!`, 'success');
}

