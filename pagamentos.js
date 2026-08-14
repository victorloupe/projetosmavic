// ══════════════════════════════════════════
//  PAGAMENTOS & RECIBOS LOGIC
// ══════════════════════════════════════════
function initPage() {
  updateClientFilter();
  updateYearFilter();
  renderPagamentos();
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
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px"><i class="bi bi-cash-stack" style="font-size:24px;display:block;margin-bottom:6px;opacity:0.6"></i>Nenhum pagamento encontrado</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<div style="text-align:center;color:var(--text3);padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:16px"><i class="bi bi-cash-stack" style="font-size:28px;display:block;margin-bottom:6px;opacity:0.6"></i>Nenhum pagamento encontrado</div>`;
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
              <button class="btn btn-ghost btn-sm" onclick="downloadReceiptPDFDirect('${projId}', '${payId}')" style="padding:4px 8px;color:var(--red)" title="Visualizar PDF"><i class="bi bi-file-pdf"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="sendPaymentWhatsApp('${projId}', '${payId}')" style="padding:4px 8px;color:#25D366" title="Confirmar Recebimento via WhatsApp"><i class="bi bi-whatsapp"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="generateReceipt('${projId}', '${payId}')" style="padding:4px 8px" title="Gerar Recibo"><i class="bi bi-receipt"></i> Recibo</button>
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
              <button class="btn btn-ghost btn-sm" onclick="sendPaymentWhatsApp('${projId}', '${payId}')" style="padding:6px 10px;color:#25D366;font-size:12px"><i class="bi bi-whatsapp"></i> WhatsApp</button>
              <button class="btn btn-ghost btn-sm" onclick="downloadReceiptPDFDirect('${projId}', '${payId}')" style="padding:6px 9px;color:var(--red)" title="Visualizar PDF"><i class="bi bi-file-pdf"></i> PDF</button>
              <button class="btn btn-ghost btn-sm" onclick="generateReceipt('${projId}', '${payId}')" style="padding:6px 9px" title="Ver Recibo"><i class="bi bi-receipt"></i> Recibo</button>
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
      renderPagamentos();
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
  p.payments.push({ id: Date.now() + 2, amount, date, method });
  p.paid = p.payments.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  scheduleSync();
  updateClientFilter();
  updateYearFilter();
  renderPagamentos();
  closeAddPaymentDirectModal();
  showToast(isNew ? `Cliente, projeto e pagamento criados em "${p.column}"!` : 'Pagamento registrado com sucesso!', 'success');
}

function generateReceipt(projId, payId) {
  const p = (projects || []).find(x => String(x.id) === String(projId));
  if (!p) return showToast('Projeto não encontrado', 'error');
  const pay = (p.payments || []).find(x => String(x.id) === String(payId));
  if (!pay) return showToast('Pagamento não encontrado', 'error');
  
  const clientName = p.client || '';
  const cl = (clients || []).find(x => x && x.name && x.name.toLowerCase().trim() === clientName.toLowerCase().trim());
  const clientDoc = cl && cl.doc ? formatDocMask(cl.doc) : 'Não informado';
  const clientAddress = cl && cl.address ? cl.address : 'Não informado';
  
  const modal = document.getElementById('reciboOverlay');
  if (!modal) return;
  modal.dataset.projId = String(projId);
  modal.dataset.payId = String(payId);
  
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
  
  modal.classList.add('open');
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

  const previewTab = window.open('', '_blank');

  generateReceipt(projId, payId);

  const element = document.querySelector('#reciboOverlay .mbody.print-area');
  if (!element) return;
  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     `Recibo_${pay.id}_${(p.client || 'Cliente').replace(/\s+/g, '_')}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  showToast('Gerando PDF...', 'info');
  try {
    const clone = element.cloneNode(true);
    clone.querySelectorAll('.no-print').forEach(el => el.remove());
    clone.style.background = '#ffffff';
    clone.style.color = '#000000';
    clone.style.padding = '25px';
    clone.style.width = '190mm';
    clone.style.boxSizing = 'border-box';
    clone.style.border = '2px dotted #4b5563';
    clone.style.borderRadius = '8px';

    let wrapper = null;
    try {
      wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '0';
      wrapper.style.top = '0';
      wrapper.style.zIndex = '-9999';
      wrapper.style.pointerEvents = 'none';
      wrapper.style.background = '#ffffff';
      wrapper.style.width = '190mm';
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      await loadHtml2Pdf();
      const pdfBlob = await html2pdf().from(clone).set(opt).outputPdf('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      if (previewTab) {
        previewTab.location.href = blobUrl;
      } else {
        window.open(blobUrl, '_blank');
      }
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
  } catch(e) {
    console.error('Erro ao preparar PDF:', e);
    if (previewTab) previewTab.close();
    showToast('Erro ao gerar PDF', 'error');
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
