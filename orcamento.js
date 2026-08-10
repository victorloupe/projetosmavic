// ══════════════════════════════════════════
//  ORÇAMENTO LOGIC
// ══════════════════════════════════════════
let editingOrcItemId = null;

function initPage() {
  ensureOrcNumbers();
  updateClientFilter();
  renderOrcamentos();
}

// Numeração sequencial (#1, #2, #3...) em vez do id interno (timestamp)
function getNextOrcNumber() {
  return Math.max(0, ...budgets.map(b => b.number || 0)) + 1;
}

// Preenche o número sequencial de orçamentos antigos que ainda não têm (compatibilidade)
function ensureOrcNumbers() {
  const missing = budgets.filter(b => !b.number).sort((a, b) => a.id - b.id);
  if (!missing.length) return;
  let next = getNextOrcNumber();
  missing.forEach(b => { b.number = next++; });
  scheduleSync();
}

// ══════════════════════════════════════════
//  CLIENTE DO ORÇAMENTO (select compartilhado)
// ══════════════════════════════════════════
// Campo de cliente virou um autocomplete: digitando, sugere clientes já
// cadastrados; se o nome não bater com nenhum, cria um cliente novo na hora
// (ensureOrcClient), tanto pra usar um já existente quanto pra criar um novo.
function populateOrcClientSelect(clientName) {
  const inp = document.getElementById('orcClient');
  if (!inp) return;
  inp.value = clientName || '';
}

function handleOrcClientInput() {
  const val = document.getElementById('orcClient').value.trim().toLowerCase();
  const box = document.getElementById('orcClientSuggest');
  if (!box) return;
  if (!val) return hideOrcClientSuggestions();
  const matches = clients.filter(c => c.name.toLowerCase().includes(val)).slice(0, 6);
  if (!matches.length) return hideOrcClientSuggestions();
  box.innerHTML = matches.map(c => `
    <div class="ac-item" onclick="selectOrcClientSuggestion(${c.id})">
      <div class="ac-item-top"><span class="ac-item-name">${c.name}</span></div>
    </div>
  `).join('');
  box.classList.remove('d-none');
}

function selectOrcClientSuggestion(clientId) {
  const cl = clients.find(c => c.id === clientId);
  if (!cl) return;
  document.getElementById('orcClient').value = cl.name;
  hideOrcClientSuggestions();
  handleOrcClientChange();
  updateOrcPreviewLabels();
}

function hideOrcClientSuggestions() {
  const box = document.getElementById('orcClientSuggest');
  if (box) { box.classList.add('d-none'); box.innerHTML = ''; }
}

function handleOrcClientBlur() {
  // Pequeno atraso pra deixar o clique numa sugestão acontecer antes de esconder.
  setTimeout(() => {
    hideOrcClientSuggestions();
    ensureOrcClient();
    updateOrcPreviewLabels();
  }, 150);
}

// Garante que o cliente digitado exista no CRM: usa o já cadastrado (match
// case-insensitive) ou cria um novo agora — permite orçar pra alguém que
// ainda não está no sistema, sem precisar ir na tela de Clientes primeiro.
function ensureOrcClient() {
  const inp = document.getElementById('orcClient');
  if (!inp) return null;
  const name = inp.value.trim();
  if (!name) return null;
  let cl = clients.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!cl) {
    cl = { id: Date.now(), name, products: [], token: genTokenStr() };
    clients.push(cl);
    scheduleSync();
    showToast(`Cliente "${name}" criado!`, 'success');
  } else if (inp.value !== cl.name) {
    inp.value = cl.name;
  }
  return cl;
}

// ══════════════════════════════════════════
//  MÁSCARA DE MOEDA (R$)
// MÁSCARA DE MOEDA BRL carregada globalmente de common.js

function openOrcamentoModal(id = null) {
  if (!document.getElementById('orcClient')) return;

  editingOrcItemId = null;
  document.getElementById('newOrcItemDesc').value = '';
  document.getElementById('newOrcItemNote').value = '';
  document.getElementById('newOrcItemPrice').value = '';
  document.getElementById('newOrcItemQty').value = 1;
  document.getElementById('orcNotes').value = '';
  document.getElementById('orcDiscount').value = toBRLInputStr(0);
  populateOrcNotesTemplateSelect();
  populateProjectTypeSelects();
  hideOrcItemSuggestions();

  if (id) {
    const b = budgets.find(x => x.id === id);
    if (!b) return;
    if (!b.number) { b.number = getNextOrcNumber(); scheduleSync(); }
    document.getElementById('orcId').value = b.id;
    document.getElementById('orcNumber').value = b.number;
    populateOrcClientSelect(b.client);
    document.getElementById('orcTitle').value = b.title;
    document.getElementById('orcDate').value = b.date;
    document.getElementById('orcValidUntil').value = b.validUntil;
    document.getElementById('orcStatus').value = b.status;
    document.getElementById('orcProjectType').value = b.projectType || 'Residencial';
    document.getElementById('orcNotes').value = b.notes || '';
    document.getElementById('orcDiscount').value = toBRLInputStr(b.discount || 0);
    tempOrcItems = [...b.items];
    document.getElementById('orcModalTitle').textContent = 'Editar Orçamento';
    document.getElementById('btnPrnOrc').style.display = 'block';
    document.getElementById('btnPdfOrc').style.display = 'block';

    handleOrcClientChange(true);
  } else {
    document.getElementById('orcId').value = '';
    document.getElementById('orcNumber').value = getNextOrcNumber();
    populateOrcClientSelect('');
    document.getElementById('orcTitle').value = '';
    document.getElementById('orcDate').value = today();
    
    const d = new Date();
    d.setDate(d.getDate() + 15);
    document.getElementById('orcValidUntil').value = d.toISOString().split('T')[0];
    document.getElementById('orcStatus').value = 'Pendente';
    document.getElementById('orcProjectType').value = 'Residencial';
    tempOrcItems = [];
    document.getElementById('orcModalTitle').textContent = 'Novo Orçamento';
    document.getElementById('btnPrnOrc').style.display = 'none';
    document.getElementById('btnPdfOrc').style.display = 'none';
  }
  
  updateOrcItemFormMode();
  renderOrcItems();
  updateOrcPreviewLabels();
  document.getElementById('orcamentoOverlay').classList.add('open');
}

function closeOrcamentoModal() {
  document.getElementById('orcamentoOverlay').classList.remove('open');
}

function handleOrcClientChange(keepTitle = false) {
  const clientName = document.getElementById('orcClient').value;
  if (clientName && !document.getElementById('orcTitle').value && !keepTitle) {
    document.getElementById('orcTitle').value = `Proposta Comercial - ${clientName}`;
  }
  hideOrcItemSuggestions();
}

// ══════════════════════════════════════════
//  AUTOCOMPLETE — tabela de preços do cliente
// ══════════════════════════════════════════
function handleOrcItemDescInput() {
  const val = document.getElementById('newOrcItemDesc').value.trim().toLowerCase();
  const box = document.getElementById('orcItemSuggest');
  if (!box) return;
  const clientName = document.getElementById('orcClient').value;
  const cl = clients.find(c => c.name === clientName);

  if (!val || !cl || !cl.products?.length) return hideOrcItemSuggestions();

  const matches = cl.products.filter(p => p.name.toLowerCase().includes(val)).slice(0, 6);
  if (!matches.length) return hideOrcItemSuggestions();

  box.innerHTML = matches.map(p => `
    <div class="ac-item" onclick="selectOrcItemSuggestion(${p.id})">
      <div class="ac-item-top">
        <span class="ac-item-name">${p.name}</span>
        <span class="ac-item-price">${fmt(p.price)}</span>
      </div>
      ${p.desc ? `<div class="ac-item-desc">${p.desc}</div>` : ''}
    </div>
  `).join('');
  box.classList.remove('d-none');
}

function selectOrcItemSuggestion(prodId) {
  const clientName = document.getElementById('orcClient').value;
  const cl = clients.find(c => c.name === clientName);
  if (!cl) return;
  const prod = cl.products.find(p => p.id === prodId);
  if (!prod) return;
  document.getElementById('newOrcItemDesc').value = prod.name;
  document.getElementById('newOrcItemPrice').value = toBRLInputStr(prod.price);
  document.getElementById('newOrcItemNote').value = prod.desc || '';
  hideOrcItemSuggestions();
  document.getElementById('newOrcItemPrice').focus();
}

function hideOrcItemSuggestions() {
  const box = document.getElementById('orcItemSuggest');
  if (box) { box.classList.add('d-none'); box.innerHTML = ''; }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#newOrcItemDesc') && !e.target.closest('#orcItemSuggest')) hideOrcItemSuggestions();
  if (!e.target.closest('#orcClient') && !e.target.closest('#orcClientSuggest')) hideOrcClientSuggestions();
});


function updateOrcPreviewLabels() {
  const clientName = document.getElementById('orcClient').value;
  const title = document.getElementById('orcTitle').value;
  const date = document.getElementById('orcDate').value;
  const notes = document.getElementById('orcNotes').value;
  const number = document.getElementById('orcNumber').value;
  const discountVal = parseCurrencyInput(document.getElementById('orcDiscount').value);
  
  const cl = clients.find(x => x.name === clientName);
  
  document.getElementById('lblOrcClientName').textContent = clientName || '—';
  
  let phoneStr = 'Não informado';
  if (cl && cl.phone) {
    phoneStr = formatPhone(cl.phone);
  }
  document.getElementById('lblOrcClientPhone').textContent = phoneStr;
  
  const companyName = localStorage.getItem('mavic_companyName') || 'MAVIC Arquitetura e Engenharia';
  const companyDoc = localStorage.getItem('mavic_companyDoc') || '35060501841';
  const companyEmail = localStorage.getItem('mavic_companyEmail') || 'projetos.mavic@hotmail.com';
  const companyInsta = localStorage.getItem('mavic_companyInsta') || '@mavic.arquitetuta';
  
  document.getElementById('lblOrcProviderHeaderName').textContent = companyName;
  document.getElementById('lblOrcProviderHeaderContact').textContent = `${companyEmail} | ${companyInsta}`;
  document.getElementById('lblOrcProviderHeaderDoc').textContent = `CPF/CNPJ: ${formatDocMask(companyDoc)}`;
  
  document.getElementById('lblProposalNum').textContent = number ? `Orçamento #${number}` : 'Novo Orçamento';
  
  document.getElementById('lblOrcDatePreview').textContent = date ? new Date(date + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
  document.getElementById('lblOrcNotesPreview').textContent = notes || 'Nenhuma observação informada.';
  
  // Calculate discount & totals
  const subtotal = tempOrcItems.reduce((s, x) => s + (parseFloat(x.price || 0) * parseInt(x.qty || 1)), 0);
  const totalGeral = subtotal - discountVal;
  
  const subLabel = document.getElementById('lblOrcSubtotalPreview');
  const discLabel = document.getElementById('lblOrcDiscountPreview');
  const totalLabel = document.getElementById('lblOrcTotalGeralPreview');
  
  if (subLabel) subLabel.textContent = fmt(subtotal);
  if (discLabel) discLabel.textContent = fmt(discountVal);
  if (totalLabel) totalLabel.textContent = fmt(totalGeral);
  
  document.getElementById('lblSigProviderName').textContent = companyName.startsWith('MAVIC') ? 'Victor Lourenço Pereira' : companyName;
}

// Preenche o <select> com as observações padrão salvas (config.noteTemplates),
// mais a opção fixa de limpar o campo.
function populateOrcNotesTemplateSelect() {
  const sel = document.getElementById('orcNotesTemplate');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione uma observação padrão...</option>'
    + noteTemplates.map(t => `<option value="${t.id}">${t.title}</option>`).join('')
    + '<option value="limpar">Limpar Observações</option>';
}

function applyOrcNotesTemplate() {
  const tSel = document.getElementById('orcNotesTemplate').value;
  const area = document.getElementById('orcNotes');

  if (tSel === 'limpar') {
    area.value = '';
  } else if (tSel) {
    const t = noteTemplates.find(x => x.id === tSel);
    if (t) area.value = t.text;
  }

  updateOrcPreviewLabels();
}

// ══════════════════════════════════════════
//  GERENCIAR OBSERVAÇÕES PADRÃO
// ══════════════════════════════════════════
function openManageNotesModal() {
  const list = document.getElementById('notesManagerList');
  if (!list) return;
  list.innerHTML = noteTemplates.map(t => `
    <div class="nm-row" data-id="${t.id}" style="border:1px solid var(--border);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;gap:6px">
        <input class="inp inp-sm nm-title" value="${t.title.replace(/"/g,'&quot;')}" placeholder="Nome da observação" style="flex:1">
        <button class="btn btn-danger btn-sm" onclick="this.closest('.nm-row').remove()" title="Excluir"><i class="bi bi-trash3"></i></button>
      </div>
      <textarea class="inp nm-text" rows="4" placeholder="Texto da observação...">${t.text}</textarea>
    </div>
  `).join('') || '<p style="font-size:12.5px;color:var(--text3);text-align:center;padding:10px">Nenhuma observação padrão ainda.</p>';
  document.getElementById('notesOverlay').classList.add('open');
}
function closeManageNotesModal() {
  document.getElementById('notesOverlay').classList.remove('open');
}
function addNoteTemplateInput() {
  const list = document.getElementById('notesManagerList');
  const empty = list.querySelector('p');
  if (empty) empty.remove();
  const row = document.createElement('div');
  row.className = 'nm-row';
  row.dataset.id = '';
  row.style.cssText = 'border:1px solid var(--border);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px';
  row.innerHTML = `
    <div style="display:flex;gap:6px">
      <input class="inp inp-sm nm-title" placeholder="Nome da observação" style="flex:1">
      <button class="btn btn-danger btn-sm" onclick="this.closest('.nm-row').remove()" title="Excluir"><i class="bi bi-trash3"></i></button>
    </div>
    <textarea class="inp nm-text" rows="4" placeholder="Texto da observação..."></textarea>
  `;
  list.appendChild(row);
  row.querySelector('.nm-title').focus();
}
function saveNoteTemplates() {
  const rows = document.querySelectorAll('#notesManagerList .nm-row');
  const updated = [];
  rows.forEach(r => {
    const title = r.querySelector('.nm-title').value.trim();
    const text = r.querySelector('.nm-text').value.trim();
    if (!title) return;
    const id = r.dataset.id || ('t' + Date.now() + Math.floor(Math.random() * 1000));
    updated.push({ id, title, text });
  });
  noteTemplates = updated;
  scheduleSync();
  populateOrcNotesTemplateSelect();
  closeManageNotesModal();
  showToast('Observações padrão atualizadas!', 'success');
}

function addOrcItem() {
  const desc = document.getElementById('newOrcItemDesc').value.trim();
  const note = document.getElementById('newOrcItemNote').value.trim();
  const price = parseCurrencyInput(document.getElementById('newOrcItemPrice').value);
  const qty = parseInt(document.getElementById('newOrcItemQty').value) || 1;

  if (!desc) return showToast('Preencha o nome do produto/serviço', 'warning');
  if (isNaN(price) || price <= 0) return showToast('Informe um valor válido', 'warning');

  if (editingOrcItemId) {
    const item = tempOrcItems.find(i => i.id === editingOrcItemId);
    if (item) {
      item.desc = desc;
      item.note = note;
      item.price = price;
      item.qty = qty;
    }
    showToast('Item atualizado!', 'success');
    cancelOrcItemEdit();
  } else {
    tempOrcItems.push({ id: Date.now(), desc, note, price, qty });
    saveOrcItemToClientCatalog(desc, price, note);
    document.getElementById('newOrcItemDesc').value = '';
    document.getElementById('newOrcItemNote').value = '';
    document.getElementById('newOrcItemPrice').value = '';
    document.getElementById('newOrcItemQty').value = 1;
  }

  renderOrcItems();
}

// Salva o item na "Tabela de Preços" do cliente selecionado, se ele ainda não
// tiver um produto com esse nome — assim fica disponível pra sugestão em
// orçamentos futuros, igual pediu: usar um que já existe ou criar um novo.
function saveOrcItemToClientCatalog(name, price, desc) {
  const cl = ensureOrcClient();
  if (!cl) return;
  if (!cl.products) cl.products = [];
  const exists = cl.products.some(p => p.name.toLowerCase() === name.toLowerCase());
  if (!exists) {
    cl.products.push({ id: Date.now(), name, price, desc });
    scheduleSync();
  }
}

function editOrcItem(itemId) {
  const item = tempOrcItems.find(i => i.id === itemId);
  if (!item) return;
  editingOrcItemId = itemId;
  document.getElementById('newOrcItemDesc').value = item.desc;
  document.getElementById('newOrcItemNote').value = item.note || '';
  document.getElementById('newOrcItemPrice').value = toBRLInputStr(item.price);
  document.getElementById('newOrcItemQty').value = item.qty;
  updateOrcItemFormMode();
  renderOrcItems();
  document.getElementById('newOrcItemDesc').focus();
}

function cancelOrcItemEdit() {
  editingOrcItemId = null;
  document.getElementById('newOrcItemDesc').value = '';
  document.getElementById('newOrcItemNote').value = '';
  document.getElementById('newOrcItemPrice').value = '';
  document.getElementById('newOrcItemQty').value = 1;
  updateOrcItemFormMode();
  renderOrcItems();
}

function updateOrcItemFormMode() {
  const label = document.getElementById('orcItemFormLabel');
  const submitBtn = document.getElementById('btnOrcItemSubmit');
  const cancelBtn = document.getElementById('btnOrcItemCancel');
  if (!label || !submitBtn || !cancelBtn) return;
  if (editingOrcItemId) {
    label.innerHTML = '<i class="bi bi-pencil"></i> Editando Item';
    submitBtn.innerHTML = '<i class="bi bi-check2"></i>';
    submitBtn.title = 'Salvar alterações';
    cancelBtn.style.display = '';
  } else {
    label.textContent = 'Adicionar Item à Proposta';
    submitBtn.innerHTML = '+';
    submitBtn.title = 'Adicionar';
    cancelBtn.style.display = 'none';
  }
}

function removeOrcItem(itemId) {
  tempOrcItems = tempOrcItems.filter(item => item.id !== itemId);
  if (editingOrcItemId === itemId) cancelOrcItemEdit();
  renderOrcItems();
}

function renderItemDescription(item) {
  let title = item.desc;
  let sub = item.note || '';

  // Compatibilidade com itens antigos que embutiam a descrição no próprio nome
  if (!sub && title.includes(' - ')) {
    const idx = title.indexOf(' - ');
    sub = title.substring(idx + 3);
    title = title.substring(0, idx);
  } else if (!sub && title.includes('\n')) {
    const idx = title.indexOf('\n');
    sub = title.substring(idx + 1);
    title = title.substring(0, idx);
  }

  if (sub) {
    return `<div class="proposal-item-name">${title}</div><div class="proposal-item-desc">${sub}</div>`;
  }
  return `<div class="proposal-item-name">${title}</div>`;
}

function renderOrcItems() {
  const tbody = document.getElementById('orcItemsTableBody');
  const previewSubtotal = document.getElementById('lblOrcSubtotalPreview');
  const previewDiscount = document.getElementById('lblOrcDiscountPreview');
  const previewTotalGeral = document.getElementById('lblOrcTotalGeralPreview');
  const inputTotal = document.getElementById('orcTotalVal');
  const discountVal = parseCurrencyInput(document.getElementById('orcDiscount').value);

  if (!tempOrcItems.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px">Nenhum item adicionado à proposta</td></tr>`;
    if (previewSubtotal) previewSubtotal.textContent = fmt(0);
    if (previewDiscount) previewDiscount.textContent = fmt(0);
    if (previewTotalGeral) previewTotalGeral.textContent = fmt(0);
    inputTotal.value = fmt(0);
    return;
  }

  let total = 0;
  let html = tempOrcItems.map((item) => {
    const subtotal = parseFloat(item.price || 0) * parseInt(item.qty || 1);
    total += subtotal;

    const fmtVal = toBRLInputStr(item.price);
    const fmtSub = toBRLInputStr(subtotal);
    const isEditing = editingOrcItemId === item.id;

    return `
      <tr${isEditing ? ' class="orc-item-editing"' : ''}>
        <td>
          ${renderItemDescription(item)}
        </td>
        <td style="text-align:right;font-weight:600">${fmtVal}</td>
        <td style="text-align:right;font-weight:700">${fmtSub}</td>
        <td style="text-align:center" class="no-print">
          <button class="prod-del" onclick="editOrcItem(${item.id})" title="Editar item"><i class="bi bi-pencil"></i></button>
          <button class="prod-del" onclick="removeOrcItem(${item.id})" title="Remover item"><i class="bi bi-trash3"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;

  const totalGeral = total - discountVal;

  if (previewSubtotal) previewSubtotal.textContent = fmt(total);
  if (previewDiscount) previewDiscount.textContent = fmt(discountVal);
  if (previewTotalGeral) previewTotalGeral.textContent = fmt(totalGeral);
  inputTotal.value = fmt(totalGeral);
}

function saveOrcamento() {
  const clientObj = ensureOrcClient();
  const client = clientObj ? clientObj.name : document.getElementById('orcClient').value.trim();
  const title = document.getElementById('orcTitle').value.trim();
  const date = document.getElementById('orcDate').value;
  const validUntil = document.getElementById('orcValidUntil').value;
  const status = document.getElementById('orcStatus').value;
  const projectType = document.getElementById('orcProjectType').value;
  const notes = document.getElementById('orcNotes').value.trim();
  const discount = parseCurrencyInput(document.getElementById('orcDiscount').value);

  if (!client || !title) return showToast('Cliente e Título são obrigatórios', 'warning');
  if (!tempOrcItems.length) return showToast('Adicione pelo menos um item ao orçamento', 'warning');

  const id = document.getElementById('orcId').value;
  const total = tempOrcItems.reduce((s, x) => s + (parseFloat(x.price || 0) * parseInt(x.qty || 1)), 0);

  const bData = {
    id: id ? parseInt(id) : Date.now(),
    number: parseInt(document.getElementById('orcNumber').value) || getNextOrcNumber(),
    client,
    title,
    date,
    validUntil,
    status,
    projectType,
    notes,
    items: tempOrcItems,
    discount,
    total
  };

  if (id) {
    const idx = budgets.findIndex(x => x.id === parseInt(id));
    if (idx > -1) {
      bData.status = budgets[idx].status === 'Convertido' ? 'Convertido' : status;
      budgets[idx] = bData;
      showToast('Orçamento atualizado!', 'success');
    }
  } else {
    budgets.push(bData);
    showToast('Orçamento criado!', 'success');
  }
  
  closeOrcamentoModal();
  scheduleSync();
  renderOrcamentos();
  return bData.id;
}

function saveOrcamentoAndDownloadPdf() {
  const savedId = saveOrcamento();
  if (savedId) downloadOrcamentoPDFDirect(savedId);
}

function renderOrcamentos() {
  const tbody = document.getElementById('orcTableBody');
  if(!tbody) return;
  const search = document.getElementById('fOrcSearch').value.toLowerCase().trim();
  const clientFilter = document.getElementById('fOrcClient').value;
  const statusFilter = document.getElementById('fOrcStatus').value;
  const yearFilter = document.getElementById('fOrcYear').value;
  
  let filtered = [...budgets];
  
  if (search) {
    filtered = filtered.filter(b => 
      b.title.toLowerCase().includes(search) || 
      b.client.toLowerCase().includes(search)
    );
  }
  
  if (clientFilter) {
    filtered = filtered.filter(b => b.client === clientFilter);
  }
  
  if (statusFilter) {
    filtered = filtered.filter(b => b.status === statusFilter);
  }
  
  if (yearFilter) {
    filtered = filtered.filter(b => b.date && b.date.startsWith(yearFilter));
  }
  
  filtered.sort((a, b) => b.id - a.id);

  const pgEl = document.getElementById('orcPagination');
  if (pgEl) pgEl.innerHTML = pgBarHtml('orcamentos', filtered.length, 'renderOrcamentos');

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px">Nenhum orçamento encontrado</td></tr>`;
    return;
  }

  const pageItems = pgSlice(filtered, 'orcamentos');

  tbody.innerHTML = pageItems.map(b => {
    const dStr = b.date ? new Date(b.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
    const vStr = b.validUntil ? new Date(b.validUntil + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
    
    const showConvert = b.status !== 'Convertido';
    const convertBtn = showConvert 
      ? `<button class="btn btn-success btn-sm" onclick="transformBudgetToProject(${b.id})" style="padding:4px 8px;margin-right:4px" title="Transformar em Fatura (Projeto)"><i class="bi bi-arrow-right-circle"></i> Faturar</button>`
      : `<span style="font-size:11px;color:var(--text3);margin-right:8px;font-weight:600"><i class="bi bi-check-all" style="color:var(--green)"></i> Faturado</span>`;
      
    const netTotal = b.total - (parseFloat(b.discount) || 0);

    const isExpired = b.validUntil && b.status !== 'Convertido' && new Date(b.validUntil + 'T23:59:59') < new Date();
    const expiredBadge = isExpired ? ' <span class="badge b-venc" style="font-size:9px">Vencido</span>' : '';

    return `
      <tr>
        <td style="font-weight:600">${b.number ? `<span style="color:var(--text3);font-weight:600;font-family:'Courier New',monospace;font-size:11.5px">#${b.number}</span> ` : ''}${b.title}</td>
        <td>
          <span class="kcard-avatar" style="background:${getClientColor(b.client)};display:inline-flex;margin-right:8px;vertical-align:middle;width:24px;height:24px;font-size:10px">${getInitials(b.client)}</span>
          ${b.client}
        </td>
        <td>${dStr}</td>
        <td>${vStr}</td>
        <td style="font-family:'Courier New',monospace;font-weight:700">${fmt(netTotal)}</td>
        <td><span class="b-orc-${b.status}">${b.status}</span>${expiredBadge}</td>
        <td style="text-align:right">
          <div style="display:inline-flex;gap:4px;justify-content:flex-end;width:100%;align-items:center">
            ${convertBtn}
            <button class="btn btn-ghost btn-sm" onclick="duplicateOrcamento(${b.id})" style="padding:4px 8px" title="Duplicar"><i class="bi bi-copy"></i></button>
            <button class="btn btn-ghost btn-sm" onclick="downloadOrcamentoPDFDirect(${b.id})" style="padding:4px 8px;color:var(--red)" title="Visualizar PDF"><i class="bi bi-file-pdf"></i></button>
            <button class="btn btn-ghost btn-sm" onclick="sendOrcamentoWhatsApp(${b.id})" style="padding:4px 8px;color:#25D366" title="Enviar Proposta via WhatsApp"><i class="bi bi-whatsapp"></i></button>
            <button class="btn btn-ghost btn-sm" onclick="openOrcamentoModal(${b.id})" style="padding:4px 8px" title="Editar"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-danger btn-sm" onclick="deleteOrcamento(${b.id})" style="padding:4px 8px" title="Excluir"><i class="bi bi-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function deleteOrcamento(id) {
  showConfirm('Deseja excluir este orçamento definitivamente?', () => {
    budgets = budgets.filter(b => b.id !== id);
    scheduleSync();
    renderOrcamentos();
    showToast('Orçamento excluído', 'info');
  });
}

function duplicateOrcamento(id) {
  const b = budgets.find(x => x.id === id);
  if (!b) return;

  const d = new Date();
  d.setDate(d.getDate() + 15);

  const copy = {
    id: Date.now(),
    number: getNextOrcNumber(),
    client: b.client,
    title: `${b.title} (cópia)`,
    date: today(),
    validUntil: d.toISOString().split('T')[0],
    status: 'Pendente',
    projectType: b.projectType || 'Residencial',
    notes: b.notes || '',
    items: (b.items || []).map((it, idx) => ({ ...it, id: Date.now() + idx })),
    discount: b.discount || 0,
    total: b.total || 0
  };

  budgets.push(copy);
  scheduleSync();
  renderOrcamentos();
  showToast('Orçamento duplicado! Revise antes de enviar.', 'success');
  openOrcamentoModal(copy.id);
}

function printOrcamento() {
  window.print();
}

function transformBudgetToProject(id) {
  const b = budgets.find(x => x.id === id);
  if (!b) return;
  if (b.status === 'Convertido') return showToast('Orçamento já foi faturado (convertido)!', 'warning');

  document.getElementById('fatOrcId').value = b.id;
  document.getElementById('fatOrcInfo').textContent = `${b.title} — ${b.client}`;
  document.getElementById('fatPriority').value = 'Média';
  document.getElementById('fatDeadline').value = b.validUntil || today();
  document.getElementById('faturarOverlay').classList.add('open');
}

function closeFaturarModal() {
  document.getElementById('faturarOverlay').classList.remove('open');
}

function confirmFaturarOrcamento() {
  const id = parseInt(document.getElementById('fatOrcId').value);
  const b = budgets.find(x => x.id === id);
  if (!b) return closeFaturarModal();

  const priority = document.getElementById('fatPriority').value;
  const deadline = document.getElementById('fatDeadline').value;
  if (!deadline) return showToast('Informe o prazo de entrega', 'warning');

  const products = b.items.map((item, idx) => ({
    id: Date.now() + idx,
    name: `${item.desc} (x${item.qty})`,
    price: parseFloat(item.price)
  }));

  // Os itens da proposta viram as subtarefas do projeto (checklist de andamento)
  const subtasks = b.items.map((item, idx) => ({
    id: Date.now() + idx + 1,
    text: item.qty > 1 ? `${item.desc} (x${item.qty})` : item.desc,
    done: false,
    current: false
  }));

  const value = b.total - (parseFloat(b.discount) || 0);

  const newProj = {
    id: Date.now(),
    name: b.title,
    client: b.client,
    image: '',
    value: value,
    payments: [],
    paid: 0,
    products: products,
    product: products.map(p => p.name).join(', '),
    type: b.projectType || 'Outro',
    priority: priority,
    column: 'Briefing',
    date: deadline,
    note: '',
    subtasks: subtasks,
    archived: false,
    createdAt: Date.now()
  };

  projects.push(newProj);
  b.status = 'Convertido';
  scheduleSync();
  closeFaturarModal();
  showToast('Orçamento faturado com sucesso! Salvo no Kanban da Página Inicial.', 'success');
  renderOrcamentos();
}

function sendOrcamentoWhatsApp(id) {
  const b = budgets.find(x => x.id === id);
  if (!b) return;
  const cl = clients.find(c => c.name.toLowerCase().trim() === b.client.toLowerCase().trim());
  const phone = cl?.phone ? cl.phone.replace(/\D/g, '') : '';
  
  const itemsText = b.items.map(item => `• *${item.desc}* (x${item.qty}): ${fmt(item.price * item.qty)}`).join('\n');
  const netTotal = b.total - (parseFloat(b.discount) || 0);
  
  const msg = `Olá, *${b.client.split(' ')[0]}*!
  
Seguem os detalhes da Proposta Comercial *${b.title}*:

${itemsText}

${b.discount ? `*Total dos Itens:* ${fmt(b.total)}\n*Desconto:* -${fmt(b.discount)}\n` : ''}*Valor Final da Proposta:* ${fmt(netTotal)}
*Validade:* ${b.validUntil ? new Date(b.validUntil + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
${b.notes ? `\n*Condições e Observações:*\n_${b.notes}_` : ''}

Fico à disposição para qualquer dúvida ou para prosseguirmos com a contratação!`;

  const url = `https://api.whatsapp.com/send?phone=${phone ? '55' + phone : ''}&text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

async function downloadOrcamentoPDFDirect(id) {
  const b = budgets.find(x => x.id === id);
  if (!b) return;

  // Abre a aba já aqui (ainda dentro do gesto de clique do usuário) para o navegador não bloquear o popup
  const previewTab = window.open('', '_blank');

  if (!b.number) { b.number = getNextOrcNumber(); scheduleSync(); }

  document.getElementById('orcId').value = b.id;
  document.getElementById('orcNumber').value = b.number;
  populateOrcClientSelect(b.client);
  document.getElementById('orcTitle').value = b.title;
  document.getElementById('orcDate').value = b.date;
  document.getElementById('orcValidUntil').value = b.validUntil;
  document.getElementById('orcNotes').value = b.notes || '';
  document.getElementById('orcStatus').value = b.status;
  document.getElementById('orcDiscount').value = toBRLInputStr(b.discount || 0);
  tempOrcItems = [...b.items];
  editingOrcItemId = null;

  renderOrcItems();
  updateOrcPreviewLabels();

  const element = document.querySelector('#orcamentoOverlay .proposal-sheet');
  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     `Orcamento_${b.number}_${b.client.replace(/\s+/g, '_')}.pdf`,
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
    clone.style.padding = '20px';
    clone.style.width = '190mm';
    clone.style.boxSizing = 'border-box';

    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '-9999px';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    const pdfBlob = await html2pdf().from(clone).set(opt).outputPdf('blob');
    document.body.removeChild(wrapper);
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
  }
}

function downloadOrcamentoPDFModal() {
  const id = parseInt(document.getElementById('orcId').value);
  if (id) {
    downloadOrcamentoPDFDirect(id);
  }
}

function updateClientFilter(){
  const list = clients.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
  const oSel=document.getElementById('fOrcClient');
  if(oSel) {
    const oCur=oSel.value;
    oSel.innerHTML='<option value="">Todos os Clientes</option>'+list;
    if(oCur)oSel.value=oCur;
  }
}
