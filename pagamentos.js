// ══════════════════════════════════════════
//  PAGAMENTOS & RECIBOS LOGIC
// ══════════════════════════════════════════
function initPage() {
  updateClientFilter();
  renderPagamentos();
}

function renderPagamentos() {
  const tbody = document.getElementById('payTableBody');
  if(!tbody) return;
  const search = document.getElementById('fPaySearch').value.toLowerCase().trim();
  const clientFilter = document.getElementById('fPayClient').value;
  const yearFilter = document.getElementById('fPayYear').value;
  const monthFilter = document.getElementById('fPayMonth').value;
  
  let allPayments = [];
  projects.forEach(p => {
    const pays = Array.isArray(p.payments) ? p.payments : [];
    pays.forEach(pay => {
      allPayments.push({
        payment: pay,
        project: p,
        client: p.client
      });
    });
  });
  
  allPayments.sort((a, b) => new Date(b.payment.date) - new Date(a.payment.date));
  
  if (search) {
    allPayments = allPayments.filter(item => 
      item.client.toLowerCase().includes(search) || 
      item.project.name.toLowerCase().includes(search)
    );
  }
  
  if (clientFilter) {
    allPayments = allPayments.filter(item => item.client === clientFilter);
  }
  
  if (yearFilter) {
    allPayments = allPayments.filter(item => item.payment.date && item.payment.date.startsWith(yearFilter));
  }
  
  if (monthFilter) {
    allPayments = allPayments.filter(item => item.payment.date && item.payment.date.substring(5, 7) === monthFilter);
  }
  
  const pgEl = document.getElementById('payPagination');
  if (pgEl) pgEl.innerHTML = pgBarHtml('pagamentos', allPayments.length, 'renderPagamentos');

  if (!allPayments.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">Nenhum pagamento encontrado</td></tr>`;
    return;
  }

  const pageItems = pgSlice(allPayments, 'pagamentos');

  tbody.innerHTML = pageItems.map(item => {
    return `
      <tr>
        <td style="font-weight:600">
          <span class="kcard-avatar" style="background:${getClientColor(item.client)};display:inline-flex;margin-right:8px;vertical-align:middle;width:24px;height:24px;font-size:10px">${getInitials(item.client)}</span>
          ${item.client}
        </td>
        <td>${item.project.name}</td>
        <td><i class="bi bi-calendar3"></i> ${new Date(item.payment.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
        <td>${item.payment.method || 'Pix'}</td>
        <td style="font-family:'Courier New',monospace;font-weight:700;color:var(--green)">+${fmt(item.payment.amount)}</td>
        <td style="text-align:right">
          <div style="display:inline-flex;gap:4px;justify-content:flex-end;width:100%;align-items:center">
            <button class="btn btn-ghost btn-sm" onclick="downloadReceiptPDFDirect(${item.project.id}, ${item.payment.id})" style="padding:4px 8px;color:var(--red)" title="Visualizar PDF"><i class="bi bi-file-pdf"></i></button>
            <button class="btn btn-ghost btn-sm" onclick="sendPaymentWhatsApp(${item.project.id}, ${item.payment.id})" style="padding:4px 8px;color:#25D366" title="Confirmar Recebimento via WhatsApp"><i class="bi bi-whatsapp"></i></button>
            <button class="btn btn-ghost btn-sm" onclick="generateReceipt(${item.project.id}, ${item.payment.id})" style="padding:4px 8px" title="Gerar Recibo"><i class="bi bi-receipt"></i> Recibo</button>
            <button class="btn btn-danger btn-sm" onclick="deletePaymentDirect(${item.project.id}, ${item.payment.id})" style="padding:4px 8px" title="Excluir"><i class="bi bi-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function deletePaymentDirect(projId, payId) {
  showConfirm('Deseja excluir este pagamento definitivamente?', () => {
    const p = projects.find(x => x.id === parseInt(projId));
    if (p) {
      p.payments = p.payments.filter(pay => pay.id !== parseInt(payId));
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
  clientSel.innerHTML = '<option value="">Selecione o cliente…</option>' + clients.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  document.getElementById('directPayProject').innerHTML = '<option value="">Selecione o cliente primeiro…</option>';
  document.getElementById('directPayAmount').value = '';
  document.getElementById('directPayDate').value = today();
  const newMode = document.getElementById('directPayNewMode');
  if (newMode) newMode.checked = false;
  const newClient = document.getElementById('directPayNewClient'); if (newClient) newClient.value = '';
  const newProject = document.getElementById('directPayNewProject'); if (newProject) newProject.value = '';
  const finalCol = appColumns.find(c => isHiddenColumn(c.id));
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

// Autocomplete do "Nome do Cliente" no fluxo de cliente/projeto novos — sugere
// clientes já cadastrados pra evitar duplicar por erro de digitação (mesmo
// padrão usado no Orçamento).
function handleDirectPayNewClientInput() {
  const val = document.getElementById('directPayNewClient').value.trim().toLowerCase();
  const box = document.getElementById('directPayNewClientSuggest');
  if (!box) return;
  if (!val) return hideDirectPayNewClientSuggestions();
  const matches = clients.filter(c => c.name.toLowerCase().includes(val)).slice(0, 6);
  if (!matches.length) return hideDirectPayNewClientSuggestions();
  box.innerHTML = matches.map(c => `
    <div class="ac-item" onmousedown="selectDirectPayNewClientSuggestion(${c.id})">
      <div class="ac-item-top"><span class="ac-item-name">${c.name}</span></div>
    </div>
  `).join('');
  box.classList.remove('d-none');
}

function selectDirectPayNewClientSuggestion(clientId) {
  const cl = clients.find(c => c.id === clientId);
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
  // Só esconde projeto que já tem um valor de contrato definido E já foi
  // 100% quitado. Projeto sem valor definido (0) continua aparecendo — senão
  // fica impossível registrar o primeiro pagamento antes do contrato ter total.
  const activeProjs = projects.filter(p => {
    if (p.client !== clientName || p.archived) return false;
    const total = parseFloat(p.value || 0);
    const paid = (p.payments || []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
    return !(total > 0 && paid >= total);
  });
  if (!activeProjs.length) {
    projectSel.innerHTML = '<option value="">Nenhum projeto com saldo pendente para este cliente</option>';
    return;
  }
  projectSel.innerHTML = activeProjs.map(p => {
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
    let cl = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
    if (!cl) {
      cl = { id: now, name: clientName, products: [], token: genTokenStr() };
      clients.push(cl);
    }

    const finalCol = appColumns.find(c => isHiddenColumn(c.id)) || appColumns[appColumns.length - 1];
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
      column: finalCol.id,
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
    p = projects.find(x => x.id === parseInt(projId));
    if (!p) return;
  }

  if (!p.payments) p.payments = [];
  p.payments.push({ id: Date.now() + 2, amount, date, method });
  p.paid = p.payments.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  scheduleSync();
  renderPagamentos();
  closeAddPaymentDirectModal();
  showToast(isNew ? `Cliente, projeto e pagamento criados em "${p.column}"!` : 'Pagamento registrado com sucesso!', 'success');
}

function generateReceipt(projId, payId) {
  const p = projects.find(x => x.id === parseInt(projId));
  if (!p) return;
  const pay = p.payments.find(x => x.id === parseInt(payId));
  if (!pay) return;
  
  const cl = clients.find(x => x.name.toLowerCase().trim() === p.client.toLowerCase().trim());
  const clientDoc = cl && cl.doc ? formatDocMask(cl.doc) : 'Não informado';
  const clientAddress = cl && cl.address ? cl.address : 'Não informado';
  
  const modal = document.getElementById('reciboOverlay');
  modal.dataset.projId = projId;
  modal.dataset.payId = payId;
  
  document.getElementById('recNum').textContent = `Nº REC-${pay.id}`;
  document.getElementById('recValNum').textContent = fmt(pay.amount);
  document.getElementById('recClientName').textContent = p.client;
  document.getElementById('recClientDoc').textContent = clientDoc;
  document.getElementById('recClientAddress').textContent = clientAddress;
  document.getElementById('recProjectName').textContent = p.name;
  document.getElementById('recValWords').textContent = valorPorExtenso(pay.amount);
  
  const pDate = new Date(pay.date + 'T12:00:00');
  const mesesExtenso = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const formattedDate = `${pDate.getDate()} de ${mesesExtenso[pDate.getMonth()]} de ${pDate.getFullYear()}`;
  document.getElementById('recDateAndLocation').textContent = `São José do Rio Preto, ${formattedDate}`;
  
  const companyName = localStorage.getItem('mavic_companyName') || 'Victor Lourenço Pereira';
  const companyDoc = localStorage.getItem('mavic_companyDoc') || '350.605.018-41';
  document.getElementById('recEmissorName').textContent = companyName;
  document.getElementById('recEmissorDoc').textContent = `CPF/CNPJ: ${formatDocMask(companyDoc)}`;
  
  document.getElementById('reciboOverlay').classList.add('open');
}

function closeReciboModal() {
  document.getElementById('reciboOverlay').classList.remove('open');
}

function printReceipt() {
  window.print();
}

function sendPaymentWhatsApp(projId, payId) {
  const p = projects.find(x => x.id === projId);
  if (!p) return;
  const pay = p.payments.find(x => x.id === payId);
  if (!pay) return;
  const cl = clients.find(c => c.name.toLowerCase().trim() === p.client.toLowerCase().trim());
  const phone = cl?.phone ? cl.phone.replace(/\D/g, '') : '';
  
  const msg = `Olá, *${p.client.split(' ')[0]}*!
  
Confirmamos o recebimento do pagamento no valor de *${fmt(pay.amount)}* realizado em *${new Date(pay.date + 'T12:00:00').toLocaleDateString('pt-BR')}* referente ao projeto *${p.name}*.

Agradecemos pela parceria!`;

  const url = `https://api.whatsapp.com/send?phone=${phone ? '55' + phone : ''}&text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

async function downloadReceiptPDFDirect(projId, payId) {
  const p = projects.find(x => x.id === projId);
  if (!p) return;
  const pay = p.payments.find(x => x.id === payId);
  if (!pay) return;

  // Abre a aba já aqui (ainda dentro do gesto de clique do usuário) para o navegador não bloquear o popup
  const previewTab = window.open('', '_blank');

  generateReceipt(projId, payId);

  const element = document.querySelector('#reciboOverlay .mbody.print-area');
  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     `Recibo_${pay.id}_${p.client.replace(/\s+/g, '_')}.pdf`,
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
  }
}

function downloadReceiptPDFModal() {
  const modal = document.getElementById('reciboOverlay');
  const projId = parseInt(modal.dataset.projId);
  const payId = parseInt(modal.dataset.payId);
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

function updateClientFilter(){
  const list = clients.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
  const pSel=document.getElementById('fPayClient');
  if(pSel) {
    const pCur=pSel.value;
    pSel.innerHTML='<option value="">Todos os Clientes</option>'+list;
    if(pCur)pSel.value=pCur;
  }
}
