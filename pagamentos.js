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
  const btnPagos = document.getElementById('tabBtnPagos');
  const viewAReceber = document.getElementById('tabContentAReceber');
  const viewPagos = document.getElementById('tabContentPagos');

  if (tab === 'areceber') {
    btnAReceber?.classList.add('active');
    btnPagos?.classList.remove('active');
    if (viewAReceber) viewAReceber.style.display = 'block';
    if (viewPagos) viewPagos.style.display = 'none';
    renderPendingInstallments();
  } else {
    btnPagos?.classList.add('active');
    btnAReceber?.classList.remove('active');
    if (viewAReceber) viewAReceber.style.display = 'none';
    if (viewPagos) viewPagos.style.display = 'block';
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
  const badgePagos = document.getElementById('badgeCountPagos');

  if (kpiRec) kpiRec.textContent = fmt(totalRecebido);
  if (kpiARec) kpiARec.textContent = fmt(totalAReceber);
  if (kpiAtr) kpiAtr.textContent = fmt(totalAtrasado);
  if (badgeARec) badgeARec.textContent = pendingList.length;
  if (badgePagos) badgePagos.textContent = countPagos;
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
    list = list.filter(item => item.timingStatus === statusFilter);
  }

  const pgEl = document.getElementById('pendingPagination');
  if (pgEl) pgEl.innerHTML = pgBarHtml('pending_pays', list.length, 'renderPendingInstallments');

  if (!list.length) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px"><i class="bi bi-check2-circle" style="font-size:28px;display:block;margin-bottom:6px;opacity:0.6;color:var(--green)"></i>Nenhuma parcela pendente encontrada</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<div style="text-align:center;color:var(--text3);padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:16px"><i class="bi bi-check2-circle" style="font-size:28px;display:block;margin-bottom:6px;opacity:0.6;color:var(--green)"></i>Nenhuma parcela pendente encontrada</div>`;
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
      } else {
        const d = item.daysDiff;
        badgeHtml = `<span class="badge badge-upcoming"><i class="bi bi-calendar3"></i> ${d === 1 ? 'Amanhã' : 'Em ' + d + 'd'} (${dateFormatted})</span>`;
      }

      return `
        <tr>
          <td style="font-weight:600">
            <span class="kcard-avatar" style="background:${getClientColor(clientName)};display:inline-flex;margin-right:8px;vertical-align:middle;width:24px;height:24px;font-size:10px">${getInitials(clientName)}</span>
            ${clientName}
          </td>
          <td>
            <a href="index.html" style="color:var(--text);text-decoration:none;font-weight:600" title="Ver no Kanban">
              ${projectName}
            </a>
          </td>
          <td><span style="font-weight:600;color:var(--accent)">${desc}</span></td>
          <td>
            <div style="display:inline-flex;align-items:center;gap:6px">
              ${badgeHtml}
              <input type="date" class="inp inp-sm" style="padding:1px 4px;font-size:11px;height:22px;border-radius:6px;width:115px;background:var(--surface2);border:1px solid var(--border);color:var(--text);cursor:pointer" value="${rawDate}" onchange="updateInstallmentDueDate('${projId}', '${instId}', this.value)" title="Alterar data de vencimento desta parcela">
            </div>
          </td>
          <td style="font-family:'Courier New',monospace;font-weight:700;color:var(--text)">${fmt(amountVal)}</td>
          <td style="text-align:right">
            <div style="display:inline-flex;gap:4px;justify-content:flex-end;width:100%;align-items:center">
              <button class="btn btn-primary btn-sm" onclick="openDarBaixaModal('${projId}', '${instId}')" style="padding:4px 9px;background:var(--green);border-color:var(--green);font-size:12px" title="Confirmar Recebimento"><i class="bi bi-check2"></i> Dar Baixa</button>
              <button class="btn btn-ghost btn-sm" onclick="sendCobrarWhatsApp('${projId}', '${instId}')" style="padding:4px 8px;color:#25D366" title="Cobrar / Lembrar via WhatsApp"><i class="bi bi-whatsapp"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
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

          <div class="pay-card-project">
            <i class="bi bi-folder2-open" style="color:var(--accent);margin-right:4px"></i>
            <strong>${projectName}</strong>
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
    }).join('');
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
  document.getElementById('baixaMethod').value = 'Pix';
  
  const chkReceipt = document.getElementById('baixaOpenReceipt');
  if (chkReceipt) chkReceipt.checked = true;

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

  if (isNaN(amount) || amount <= 0) return showToast('Valor recebido inválido', 'warning');
  if (!date) return showToast('Informe a data do recebimento', 'warning');

  // Atualiza ou marca a parcela como paga
  let instDesc = 'Parcela';
  if (Array.isArray(p.installments)) {
    const inst = p.installments.find(x => String(x.id) === String(instId));
    if (inst) {
      inst.status = 'Pago';
      inst.paidDate = date;
      inst.method = method;
      instDesc = inst.desc;
    }
  }

  // Registra no histórico de pagamentos do projeto
  if (!Array.isArray(p.payments)) p.payments = [];
  const newPayId = Date.now();
  p.payments.push({
    id: newPayId,
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
}

// ══════════════════════════════════════════
//  WHATSAPP: COBRANÇA DE PARCELA PENDENTE
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

  const msg = `Olá, *${firstName}*! Tudo bem?

Passando para informar sobre o pagamento referente ao projeto *${p.name}*:

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
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px"><i class="bi bi-cash-stack" style="font-size:24px;display:block;margin-bottom:6px;opacity:0.6"></i>Nenhum pagamento registrado</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<div style="text-align:center;color:var(--text3);padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:16px"><i class="bi bi-cash-stack" style="font-size:28px;display:block;margin-bottom:6px;opacity:0.6"></i>Nenhum pagamento registrado</div>`;
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
          <td>${projectName}</td>
          <td><i class="bi bi-calendar3"></i> ${formattedDate}</td>
          <td><span class="badge" style="background:var(--surface2);color:var(--text2);font-size:11px;font-weight:600;border:1px solid var(--border)">${method}</span></td>
          <td style="font-family:'Courier New',monospace;font-weight:700;color:var(--green)">+${fmt(amountVal)}</td>
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
    }).join('');
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

          <div class="pay-card-project">
            <i class="bi bi-folder2-open" style="color:var(--accent);margin-right:4px"></i>
            <strong>${projectName}</strong>
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
    }).join('');
  }
}

function deletePaymentDirect(projId, payId) {
  showConfirm('Deseja excluir este pagamento definitivamente?', () => {
    const p = (projects || []).find(x => String(x.id) === String(projId));
    if (p) {
      p.payments = (p.payments || []).filter(pay => String(pay.id) !== String(payId));
      p.paid = p.payments.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
      scheduleSync();
      updatePayKPIs();
      renderPagamentos();
      renderPendingInstallments();
      showToast('Pagamento excluído!', 'info');
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
    p = {
      id: now + 1,
      name: projectName,
      client: cl.name,
      image: '',
      value: amount,
      payments: [],
      paid: 0,
      installments: [{
        id: now + 2,
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
  p.payments.push({ id: Date.now() + 2, amount, date, method, desc: 'Pagamento Avulso' });
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
  const msg = `Olá, *${firstName}*!\n\nConfirmamos o recebimento do pagamento no valor de *${fmt(pay.amount)}* realizado em *${formattedDate}* referente ao projeto *${p.name || 'Projeto'}*.\n\nAgradecemos pela parceria!`;

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
