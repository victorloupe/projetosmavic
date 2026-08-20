// ══════════════════════════════════════════
//  ORÇAMENTO LOGIC
// ══════════════════════════════════════════
let editingOrcItemId = null;
let tempOrcAttachments = [];
let tempOrcShowAttachments = false; // controla se a seção de anexos entra no PDF/impressão (padrão: desligado)
let orcDefaultFilterApplied = false; // garante que o filtro padrão "Pendentes" só é aplicado uma vez, na primeira carga

function initPage() {
  ensureOrcNumbers();
  updateClientFilter();
  updateYearFilter();

  // Ao abrir a página pela primeira vez, começa filtrando por "Pendentes" em vez de "Todos".
  // Só roda uma única vez — chamadas seguintes de initPage() (ex.: depois de restaurar backup
  // ou editar tipos de projeto) preservam o filtro que o usuário já tiver escolhido na tela.
  if (!orcDefaultFilterApplied) {
    orcDefaultFilterApplied = true;
    const statusSel = document.getElementById('fOrcStatus');
    if (statusSel) statusSel.value = 'Pendente';
  }

  renderOrcamentos();
  setupOrcDropzoneEvents();
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
    tempOrcAttachments = Array.isArray(b.attachments) ? JSON.parse(JSON.stringify(b.attachments)) : [];
    tempOrcShowAttachments = b.showAttachments === true; // padrão: desligado (só liga se foi explicitamente salvo como true)
    document.getElementById('orcModalTitle').textContent = 'Editar Orçamento';
    document.getElementById('btnPrnOrc').style.display = 'inline-flex';
    document.getElementById('btnPdfOrc').style.display = 'inline-flex';
    document.getElementById('btnDownloadPdfOrc').style.display = 'inline-flex';
    document.getElementById('btnSharePdfOrc').style.display = 'inline-flex';

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
    tempOrcAttachments = [];
    tempOrcShowAttachments = false;
    document.getElementById('orcModalTitle').textContent = 'Novo Orçamento';
    document.getElementById('btnPrnOrc').style.display = 'none';
    document.getElementById('btnPdfOrc').style.display = 'none';
    document.getElementById('btnDownloadPdfOrc').style.display = 'none';
    document.getElementById('btnSharePdfOrc').style.display = 'none';
  }
  
  updateOrcItemFormMode();
  renderOrcItems();
  renderOrcAttachments();
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

  if (!val) return hideOrcItemSuggestions();

  // Busca serviços gerais e serviços associados a este cliente
  const availableServices = getServicesForClient(cl ? cl.id : null);
  const clientLegacyProducts = (cl && Array.isArray(cl.products)) ? cl.products : [];
  
  const allItems = [...availableServices];
  clientLegacyProducts.forEach(lp => {
    if (!allItems.some(x => (x.name || '').toLowerCase() === (lp.name || '').toLowerCase())) {
      allItems.push(lp);
    }
  });

  const matches = allItems.filter(p => (p.name || '').toLowerCase().includes(val)).slice(0, 6);
  if (!matches.length) return hideOrcItemSuggestions();

  box.innerHTML = matches.map(p => `
    <div class="ac-item" onclick="selectOrcItemSuggestion('${p.id}')">
      <div class="ac-item-top">
        <span class="ac-item-name">${escapeHtml(p.name)}</span>
        <span class="ac-item-price">${fmt(p.price || 0)}</span>
      </div>
      ${p.desc ? `<div class="ac-item-desc">${escapeHtml(p.desc)}</div>` : ''}
    </div>
  `).join('');
  box.classList.remove('d-none');
}

function selectOrcItemSuggestion(prodId) {
  const clientName = document.getElementById('orcClient').value;
  const cl = clients.find(c => c.name === clientName);
  
  const availableServices = getServicesForClient(cl ? cl.id : null);
  const clientLegacyProducts = (cl && Array.isArray(cl.products)) ? cl.products : [];
  const allItems = [...availableServices, ...clientLegacyProducts];

  const prod = allItems.find(p => String(p.id) === String(prodId));
  if (!prod) return;

  document.getElementById('newOrcItemDesc').value = prod.name;
  document.getElementById('newOrcItemPrice').value = toBRLInputStr(prod.price || 0);
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
  const clientName = document.getElementById('orcClient')?.value.trim() || '';
  const title = document.getElementById('orcTitle')?.value.trim() || '';
  const date = document.getElementById('orcDate')?.value || '';
  const validUntil = document.getElementById('orcValidUntil')?.value || '';
  const notes = document.getElementById('orcNotes')?.value.trim() || '';
  const number = document.getElementById('orcNumber')?.value || '';
  const projectType = document.getElementById('orcProjectType')?.value || '';
  const discountVal = parseCurrencyInput(document.getElementById('orcDiscount')?.value || '0');
  
  const cl = clients.find(x => x.name.toLowerCase() === clientName.toLowerCase());
  
  // Projeto e Tipo de Projeto
  const projNameEl = document.getElementById('lblOrcProjectName');
  if (projNameEl) {
    projNameEl.textContent = title || (clientName ? `Projeto - ${clientName}` : 'Proposta de Projeto');
  }
  const projTypeEl = document.getElementById('lblOrcProjectTypePreview');
  if (projTypeEl) {
    projTypeEl.textContent = projectType || 'Geral';
  }

  // Cliente
  const clientNameEl = document.getElementById('lblOrcClientName');
  if (clientNameEl) {
    clientNameEl.textContent = clientName || '—';
  }
  
  let phoneStr = 'Não informado';
  if (cl && cl.phone) {
    phoneStr = formatPhone(cl.phone);
  }
  const clientPhoneEl = document.getElementById('lblOrcClientPhone');
  if (clientPhoneEl) {
    clientPhoneEl.textContent = phoneStr;
  }
  
  // Emissor MAVIC
  const companyName = localStorage.getItem('mavic_companyName') || 'MAVIC Arquitetura e Engenharia';
  const companyDoc = localStorage.getItem('mavic_companyDoc') || '35060501841';
  const companyEmail = localStorage.getItem('mavic_companyEmail') || 'projetos.mavic@hotmail.com';
  const companyInsta = localStorage.getItem('mavic_companyInsta') || '@mavic.arquitetuta';
  
  const hName = document.getElementById('lblOrcProviderHeaderName');
  const hContact = document.getElementById('lblOrcProviderHeaderContact');
  const hDoc = document.getElementById('lblOrcProviderHeaderDoc');
  if (hName) hName.textContent = companyName;
  if (hContact) hContact.textContent = `${companyEmail} | ${companyInsta}`;
  if (hDoc) hDoc.textContent = `CPF/CNPJ: ${formatDocMask(companyDoc)}`;
  
  // Identificação e Datas
  const numEl = document.getElementById('lblProposalNum');
  if (numEl) {
    numEl.textContent = number ? `Orçamento #${number}` : 'Novo Orçamento';
  }
  
  const dateEl = document.getElementById('lblOrcDatePreview');
  if (dateEl) {
    dateEl.textContent = date ? new Date(date + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
  }

  const validEl = document.getElementById('lblOrcValidUntilPreview');
  if (validEl) {
    validEl.textContent = validUntil ? new Date(validUntil + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
  }
  
  const notesEl = document.getElementById('lblOrcNotesPreview');
  if (notesEl) {
    notesEl.textContent = notes || 'Nenhuma observação informada.';
  }
  
  // Calculate discount & totals
  const subtotal = tempOrcItems.reduce((s, x) => s + (parseFloat(x.price || 0) * parseInt(x.qty || 1)), 0);
  const totalGeral = Math.max(0, subtotal - discountVal);
  
  const subLabel = document.getElementById('lblOrcSubtotalPreview');
  const discLabel = document.getElementById('lblOrcDiscountPreview');
  const discRow = document.getElementById('lblOrcDiscountRow');
  const totalLabel = document.getElementById('lblOrcTotalGeralPreview');
  
  if (subLabel) subLabel.textContent = fmt(subtotal);
  if (discLabel) discLabel.textContent = fmt(discountVal);
  if (discRow) discRow.style.display = discountVal > 0 ? 'flex' : 'none';
  if (totalLabel) totalLabel.textContent = fmt(totalGeral);
  
  const sigName = document.getElementById('lblSigProviderName');
  if (sigName) {
    sigName.textContent = companyName.startsWith('MAVIC') ? 'Victor Lourenço Pereira' : companyName;
  }
}

// Preenche o <select> com as observações padrão salvas (config.noteTemplates),
// mais a opção fixa de limpar o campo.
function populateOrcNotesTemplateSelect() {
  const sel = document.getElementById('orcNotesTemplate');
  if (!sel) return;
  const list = noteTemplates && noteTemplates.length ? noteTemplates : (typeof INIT_NOTE_TEMPLATES !== 'undefined' ? INIT_NOTE_TEMPLATES : []);
  sel.innerHTML = '<option value="">Selecione uma observação padrão...</option>'
    + list.map(t => `<option value="${t.id}">${t.title}</option>`).join('')
    + '<option value="limpar">Limpar Observações</option>';
}

function applyOrcNotesTemplate() {
  const sel = document.getElementById('orcNotesTemplate');
  if (!sel) return;
  const tSel = sel.value;
  const area = document.getElementById('orcNotes');
  if (!area) return;

  const list = noteTemplates && noteTemplates.length ? noteTemplates : (typeof INIT_NOTE_TEMPLATES !== 'undefined' ? INIT_NOTE_TEMPLATES : []);

  if (tSel === 'limpar') {
    area.value = '';
  } else if (tSel) {
    const t = list.find(x => x.id === tSel);
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
  const discountVal = parseCurrencyInput(document.getElementById('orcDiscount')?.value || '0');

  if (!tempOrcItems.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:24px">Nenhum produto ou serviço adicionado</td></tr>`;
    if (previewSubtotal) previewSubtotal.textContent = fmt(0);
    if (previewDiscount) previewDiscount.textContent = fmt(0);
    if (previewTotalGeral) previewTotalGeral.textContent = fmt(0);
    if (inputTotal) inputTotal.value = fmt(0);
    return;
  }

  let total = 0;
  let html = tempOrcItems.map((item) => {
    const qty = parseInt(item.qty || 1);
    const subtotal = parseFloat(item.price || 0) * qty;
    total += subtotal;

    const fmtVal = fmt(item.price);
    const fmtSub = fmt(subtotal);
    const isEditing = editingOrcItemId === item.id;

    return `
      <tr${isEditing ? ' class="orc-item-editing"' : ''}>
        <td>
          ${renderItemDescription(item)}
        </td>
        <td style="text-align:center;font-weight:600;color:var(--text2)">
          ${qty}
        </td>
        <td style="text-align:right;font-weight:600;font-family:'Outfit',sans-serif;color:var(--text2)">${fmtVal}</td>
        <td style="text-align:right;font-weight:700;font-family:'Outfit',sans-serif;color:var(--text)">${fmtSub}</td>
        <td style="text-align:center" class="no-print">
          <button class="prod-del" onclick="editOrcItem(${item.id})" title="Editar item"><i class="bi bi-pencil"></i></button>
          <button class="prod-del" onclick="removeOrcItem(${item.id})" title="Remover item"><i class="bi bi-trash3"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;

  const totalGeral = Math.max(0, total - discountVal);

  if (previewSubtotal) previewSubtotal.textContent = fmt(total);
  if (previewDiscount) previewDiscount.textContent = fmt(discountVal);
  if (previewTotalGeral) previewTotalGeral.textContent = fmt(totalGeral);
  if (inputTotal) inputTotal.value = fmt(totalGeral);
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
    attachments: tempOrcAttachments || [],
    showAttachments: tempOrcShowAttachments,
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
  updateClientFilter();
  updateYearFilter();
  renderOrcamentos();
  return bData.id;
}

function saveOrcamentoAndDownloadPdf() {
  const savedId = saveOrcamento();
  if (savedId) downloadOrcamentoPDFDirect(savedId);
}

function renderOrcKpis() {
  const kpiEl = document.getElementById('orcKpis');
  if (!kpiEl) return;
  const total = budgets.reduce((acc, b) => acc + (b.total - (parseFloat(b.discount) || 0)), 0);
  const pendentes = budgets.filter(b => b.status === 'Pendente');
  const pendenteTotal = pendentes.reduce((acc, b) => acc + (b.total - (parseFloat(b.discount) || 0)), 0);
  const convertidos = budgets.filter(b => b.status === 'Convertido' || b.status === 'Aprovado');
  const convertidoTotal = convertidos.reduce((acc, b) => acc + (b.total - (parseFloat(b.discount) || 0)), 0);
  const taxa = budgets.length ? Math.round((convertidos.length / budgets.length) * 100) : 0;

  kpiEl.innerHTML = `
    <div class="orc-kpi-card">
      <div class="orc-kpi-icon" style="background:var(--accent-bg);color:var(--accent)"><i class="bi bi-file-earmark-text"></i></div>
      <div>
        <div class="orc-kpi-lbl">TOTAL EM PROPOSTAS</div>
        <div class="orc-kpi-val">${fmt(total)}</div>
        <div class="orc-kpi-sub">${budgets.length} ${budgets.length === 1 ? 'proposta' : 'propostas'} cadastradas</div>
      </div>
    </div>
    <div class="orc-kpi-card">
      <div class="orc-kpi-icon" style="background:var(--yellow-bg);color:var(--yellow)"><i class="bi bi-hourglass-split"></i></div>
      <div>
        <div class="orc-kpi-lbl">AGUARDANDO APROVAÇÃO</div>
        <div class="orc-kpi-val" style="color:var(--yellow)">${fmt(pendenteTotal)}</div>
        <div class="orc-kpi-sub">${pendentes.length} ${pendentes.length === 1 ? 'pendente' : 'pendentes'}</div>
      </div>
    </div>
    <div class="orc-kpi-card">
      <div class="orc-kpi-icon" style="background:var(--green-bg);color:var(--green)"><i class="bi bi-check2-circle"></i></div>
      <div>
        <div class="orc-kpi-lbl">APROVADOS / CONVERTIDOS</div>
        <div class="orc-kpi-val" style="color:var(--green)">${fmt(convertidoTotal)}</div>
        <div class="orc-kpi-sub">${convertidos.length} ${convertidos.length === 1 ? 'fechado' : 'fechados'} (${taxa}% conversão)</div>
      </div>
    </div>
  `;
}

function renderOrcChips(currentStatus) {
  const chipBar = document.getElementById('orcChipsBar');
  if (!chipBar) return;

  const totalCount = budgets.length;
  const pendenteCount = budgets.filter(b => b.status === 'Pendente').length;
  const aprovadoCount = budgets.filter(b => b.status === 'Aprovado').length;
  const convertidoCount = budgets.filter(b => b.status === 'Convertido').length;
  const recusadoCount = budgets.filter(b => b.status === 'Recusado').length;

  const chips = [
    { label: 'Todos', value: '', count: totalCount },
    { label: 'Pendentes', value: 'Pendente', count: pendenteCount },
    { label: 'Aprovados', value: 'Aprovado', count: aprovadoCount },
    { label: 'Convertidos', value: 'Convertido', count: convertidoCount },
    { label: 'Recusados', value: 'Recusado', count: recusadoCount }
  ];

  chipBar.innerHTML = chips.map(c => `
    <button class="orc-chip ${c.value === currentStatus ? 'active' : ''}" onclick="setOrcChipFilter('${c.value}')">
      ${c.label} <span class="orc-chip-count">${c.count}</span>
    </button>
  `).join('');
}

function setOrcChipFilter(statusVal) {
  const sel = document.getElementById('fOrcStatus');
  if (sel) sel.value = statusVal;
  pgReset('orcamentos');
  renderOrcamentos();
}

function toggleOrcActionsMenu(event, budgetId) {
  event.stopPropagation();
  const dropdown = document.getElementById('orcTableActionDropdown');
  if (!dropdown) return;

  if (dropdown.classList.contains('open') && dropdown._activeId === budgetId) {
    closeOrcActionsMenu();
    return;
  }

  const budget = budgets.find(b => b.id === budgetId);
  if (!budget) return;

  dropdown._activeId = budgetId;
  dropdown.innerHTML = `
    <button onclick="closeOrcActionsMenu();downloadOrcamentoPDFDirect(${budgetId})"><i class="bi bi-file-pdf" style="color:var(--red)"></i> Visualizar PDF</button>
    <button onclick="closeOrcActionsMenu();downloadOrcamentoPDFFile(${budgetId})"><i class="bi bi-download" style="color:var(--accent)"></i> Baixar Arquivo PDF</button>
    <button onclick="closeOrcActionsMenu();shareOrcamentoPDF(${budgetId})"><i class="bi bi-share" style="color:#2563EB"></i> Compartilhar Link</button>
    <button onclick="closeOrcActionsMenu();duplicateOrcamento(${budgetId})"><i class="bi bi-copy"></i> Duplicar Proposta</button>
    <div class="dropdown-sep"></div>
    <button class="del" onclick="closeOrcActionsMenu();deleteOrcamento(${budgetId})"><i class="bi bi-trash"></i> Excluir Orçamento</button>
  `;

  const btnRect = event.currentTarget.getBoundingClientRect();
  const menuWidth = 190;
  let left = btnRect.right - menuWidth;
  if (left < 10) left = 10;
  let top = btnRect.bottom + 6;

  dropdown.style.top = `${top}px`;
  dropdown.style.left = `${left}px`;
  dropdown.classList.add('open');
}

function closeOrcActionsMenu() {
  const dropdown = document.getElementById('orcTableActionDropdown');
  if (dropdown) {
    dropdown.classList.remove('open');
    dropdown._activeId = null;
  }
}

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('orcTableActionDropdown');
  if (dropdown && dropdown.classList.contains('open') && !dropdown.contains(e.target)) {
    closeOrcActionsMenu();
  }
});

function clearOrcFilters() {
  const srch = document.getElementById('fOrcSearch');
  const cli = document.getElementById('fOrcClient');
  const st = document.getElementById('fOrcStatus');
  const yr = document.getElementById('fOrcYear');
  const mo = document.getElementById('fOrcMonth');
  if (srch) srch.value = '';
  if (cli) cli.value = '';
  if (st) st.value = '';
  if (yr) yr.value = '';
  if (mo) mo.value = '';
  pgReset('orcamentos');
  renderOrcamentos();
}

function renderOrcamentos() {
  const tbody = document.getElementById('orcTableBody');
  const mobileList = document.getElementById('orcMobileList');
  if(!tbody && !mobileList) return;
  const search = (document.getElementById('fOrcSearch')?.value || '').toLowerCase().trim();
  const clientFilter = document.getElementById('fOrcClient')?.value || '';
  const statusFilter = document.getElementById('fOrcStatus')?.value || '';
  const yearFilter = document.getElementById('fOrcYear')?.value || '';
  const monthFilter = document.getElementById('fOrcMonth')?.value || '';
  
  renderOrcKpis();
  renderOrcChips(statusFilter);

  let filtered = [...budgets];
  
  if (search) {
    filtered = filtered.filter(b => 
      (b.title || '').toLowerCase().includes(search) || 
      (b.client || '').toLowerCase().includes(search) ||
      (b.number && String(b.number).includes(search)) ||
      fmt(b.total - (parseFloat(b.discount) || 0)).toLowerCase().includes(search)
    );
  }
  
  if (clientFilter) {
    filtered = filtered.filter(b => b.client === clientFilter);
  }
  
  if (statusFilter) {
    filtered = filtered.filter(b => b.status === statusFilter);
  }
  
  if (yearFilter) {
    filtered = filtered.filter(b => {
      const dt = parseDateSafe(b.date || b.validUntil);
      return dt ? String(dt.getFullYear()) === yearFilter : (b.date && b.date.startsWith(yearFilter));
    });
  }

  if (monthFilter) {
    filtered = filtered.filter(b => {
      const dt = parseDateSafe(b.date || b.validUntil);
      if (dt) {
        return String(dt.getMonth() + 1).padStart(2, '0') === monthFilter;
      }
      return b.date && b.date.includes(`-${monthFilter}-`);
    });
  }
  
  filtered.sort((a, b) => (b.number || b.id) - (a.number || a.id));

  const pgEl = document.getElementById('orcPagination');
  if (pgEl) pgEl.innerHTML = pgBarHtml('orcamentos', filtered.length, 'renderOrcamentos');

  if (!filtered.length) {
    const isFiltered = Boolean(search || clientFilter || statusFilter || yearFilter || monthFilter);
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:28px"><i class="bi bi-file-earmark-spreadsheet" style="font-size:26px;display:block;margin-bottom:8px;opacity:0.5"></i>Nenhum orçamento encontrado para os filtros selecionados${isFiltered ? `<br><button class="btn-clear-filter" onclick="clearOrcFilters()"><i class="bi bi-x-circle"></i> Limpar filtros</button>` : ''}</td></tr>` + pgFillerRowsHtml('orcamentos', 0, 7);
    if (mobileList) mobileList.innerHTML = `<div style="text-align:center;color:var(--text3);padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:16px"><i class="bi bi-file-earmark-spreadsheet" style="font-size:28px;display:block;margin-bottom:6px;opacity:0.6"></i>Nenhum orçamento encontrado${isFiltered ? `<br><button class="btn-clear-filter" onclick="clearOrcFilters()"><i class="bi bi-x-circle"></i> Limpar filtros</button>` : ''}</div>` + pgFillerCardsHtml('orcamentos', 0, 150);
    return;
  }

  const pageItems = pgSlice(filtered, 'orcamentos');

  if (tbody) {
    tbody.innerHTML = pageItems.map(b => {
      const clientName = b.client || 'Sem cliente';
      const dStr = b.date ? new Date(b.date + (b.date.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR') : '—';
      const vStr = b.validUntil ? new Date(b.validUntil + (b.validUntil.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR') : '—';
      
      const showConvert = b.status !== 'Convertido';
      const convertBtn = showConvert 
        ? `<button class="btn btn-success btn-sm" onclick="transformBudgetToProject(${b.id})" style="padding:4px 9px;font-size:11.5px" title="Transformar em Fatura (Projeto)"><i class="bi bi-arrow-right-circle"></i> Faturar</button>`
        : `<span style="font-size:11px;color:var(--text3);font-weight:600;padding:4px 6px"><i class="bi bi-check-all" style="color:var(--green);font-size:13px"></i> Faturado</span>`;
        
      const netTotal = b.total - (parseFloat(b.discount) || 0);

      const isExpired = b.validUntil && b.status !== 'Convertido' && new Date(b.validUntil + 'T23:59:59') < new Date();
      const expiredBadge = isExpired ? ' <span class="badge b-venc" style="font-size:9.5px">Vencido</span>' : '';

      return `
        <tr>
          <td>
            <div style="font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px">
              ${b.number ? `<span style="color:var(--accent);background:var(--accent-bg);padding:1px 6px;border-radius:6px;font-family:'Outfit',sans-serif;font-weight:700;font-size:11px">#${b.number}</span>` : ''}
              <span>${b.title || 'Sem título'}</span>
            </div>
          </td>
          <td>
            <span class="kcard-avatar" style="background:${getClientColor(clientName)};display:inline-flex;margin-right:8px;vertical-align:middle;width:24px;height:24px;font-size:10px">${getInitials(clientName)}</span>
            <span style="font-weight:500">${clientName}</span>
          </td>
          <td style="font-size:12.5px;color:var(--text2)">${dStr}</td>
          <td style="font-size:12.5px;color:var(--text2)">${vStr}</td>
          <td style="font-family:'Outfit',sans-serif;font-weight:700;font-size:14px;color:var(--text);text-align:right;letter-spacing:-0.01em">${fmt(netTotal)}</td>
          <td><span class="b-orc-${b.status}">${b.status}</span>${expiredBadge}</td>
          <td style="text-align:right">
            <div style="display:inline-flex;gap:4px;justify-content:flex-end;width:100%;align-items:center">
              ${convertBtn}
              <button class="btn btn-ghost btn-sm" onclick="sendOrcamentoWhatsApp(${b.id})" style="padding:4px 8px;color:#25D366" title="Enviar WhatsApp"><i class="bi bi-whatsapp"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="openOrcamentoModal(${b.id})" style="padding:4px 8px" title="Editar"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="toggleOrcActionsMenu(event, ${b.id})" style="padding:4px 7px" title="Mais Opções"><i class="bi bi-three-dots-vertical"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('') + pgFillerRowsHtml('orcamentos', pageItems.length, 7);
  }

  if (mobileList) {
    mobileList.innerHTML = pageItems.map(b => {
      const clientName = b.client || 'Sem cliente';
      const dStr = b.date ? new Date(b.date + (b.date.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR') : '—';
      const vStr = b.validUntil ? new Date(b.validUntil + (b.validUntil.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR') : '—';
      const netTotal = b.total - (parseFloat(b.discount) || 0);
      const showConvert = b.status !== 'Convertido';
      const isExpired = b.validUntil && b.status !== 'Convertido' && new Date(b.validUntil + 'T23:59:59') < new Date();
      const expiredBadge = isExpired ? ' <span class="badge b-venc" style="font-size:9px">Vencido</span>' : '';

      return `
        <div class="orc-card">
          <div class="orc-card-top">
            <div class="orc-card-title">
              ${b.number ? `<span class="orc-card-num">#${b.number}</span>` : ''}
              <span>${b.title || 'Sem título'}</span>
            </div>
            <div>
              <span class="b-orc-${b.status}">${b.status}</span>${expiredBadge}
            </div>
          </div>

          <div class="orc-card-client">
            <span class="kcard-avatar" style="background:${getClientColor(clientName)};display:inline-flex;width:24px;height:24px;font-size:10px">${getInitials(clientName)}</span>
            <span>${clientName}</span>
            ${b.projectType ? `<span class="badge" style="margin-left:auto;font-size:10px;background:${typeBg(b.projectType)};color:${typeColor(b.projectType)}">${b.projectType}</span>` : ''}
          </div>
          
          <div class="orc-card-dates" style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text3);margin:8px 0">
            <span>Data: <strong>${dStr}</strong></span>
            <span>Validade: <strong>${vStr}</strong></span>
          </div>

          <div class="orc-card-bottom" style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--border)">
            <div style="font-family:'Outfit',sans-serif;font-weight:700;font-size:15px;color:var(--text)">${fmt(netTotal)}</div>
            <div style="display:inline-flex;gap:4px;align-items:center">
              ${showConvert ? `<button class="btn btn-success btn-sm" onclick="transformBudgetToProject(${b.id})" style="padding:4px 8px;font-size:11px"><i class="bi bi-arrow-right-circle"></i> Faturar</button>` : ''}
              <button class="btn btn-ghost btn-sm" onclick="sendOrcamentoWhatsApp(${b.id})" style="padding:4px 7px;color:#25D366"><i class="bi bi-whatsapp"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="openOrcamentoModal(${b.id})" style="padding:4px 7px"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="toggleOrcActionsMenu(event, ${b.id})" style="padding:4px 6px"><i class="bi bi-three-dots-vertical"></i></button>
            </div>
          </div>
        </div>
      `;
    }).join('') + pgFillerCardsHtml('orcamentos', pageItems.length, 150);
  }
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
    attachments: Array.isArray(b.attachments) ? JSON.parse(JSON.stringify(b.attachments)) : [],
    showAttachments: b.showAttachments === true,
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

function addDays(dateStr, days) {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function transformBudgetToProject(id) {
  const b = budgets.find(x => x.id === id);
  if (!b) return;
  if (b.status === 'Convertido') return showToast('Orçamento já foi faturado (convertido)!', 'warning');

  currentFaturarPlan = null;
  const netTotal = b.total - (parseFloat(b.discount) || 0);

  document.getElementById('fatOrcId').value = b.id;
  document.getElementById('fatOrcInfo').innerHTML = `
    <span><strong>${b.title}</strong> · ${b.client}</span>
    <span style="color:var(--accent);font-weight:800;font-size:15px">${fmt(netTotal)}</span>
  `;
  document.getElementById('fatPriority').value = 'Média';
  document.getElementById('fatDeadline').value = b.validUntil || addDays(today(), 15);
  
  const condSel = document.getElementById('fatPayCondition');
  if (condSel) condSel.value = '50_50';
  
  handleFatConditionChange();
  document.getElementById('faturarOverlay').classList.add('open');
}

function closeFaturarModal() {
  document.getElementById('faturarOverlay').classList.remove('open');
}

function handleFatConditionChange() {
  const cond = document.getElementById('fatPayCondition')?.value || '50_50';
  const wrap = document.getElementById('fatDynamicControls');
  if (!wrap) return;

  const id = parseInt(document.getElementById('fatOrcId')?.value || '0');
  const b = budgets.find(x => x.id === id);
  const netTotal = b ? (b.total - (parseFloat(b.discount) || 0)) : 0;
  const deadline = document.getElementById('fatDeadline')?.value || addDays(today(), 15);

  if (cond === '50_50') {
    const halfVal = Math.round((netTotal / 2) * 100) / 100;
    wrap.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--surface);border:1px solid var(--border);border-radius:8px">
          <span style="font-size:12.5px;font-weight:600">Entrada (50%): <strong style="color:var(--accent)">${fmt(halfVal)}</strong></span>
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;margin:0;font-weight:600">
            <input type="checkbox" id="fatEntryPaid" checked onchange="updateFaturarPlanPreview()" style="accent-color:var(--accent)">
            Já recebida hoje
          </label>
        </div>
        <div class="row2" id="fatEntryMethodWrap">
          <div class="fld" style="margin:0"><label class="flbl">Forma de Pagamento da Entrada</label>
            <select class="inp inp-sm" id="fatEntryMethod" onchange="updateFaturarPlanPreview()">
              <option value="Pix" selected>Pix</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Boleto">Boleto</option>
              <option value="Transferência">Transferência</option>
            </select>
          </div>
          <div class="fld" style="margin:0"><label class="flbl">Data da Entrada</label>
            <input type="date" class="inp inp-sm" id="fatEntryDate" value="${today()}" onchange="updateFaturarPlanPreview()">
          </div>
        </div>
        <div style="font-size:12px;color:var(--text2);padding:4px 2px">
          <i class="bi bi-calendar-check" style="color:var(--accent)"></i> Saldo restante de <strong>${fmt(netTotal - halfVal)}</strong> com vencimento na data de entrega (${deadline ? new Date(deadline + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}).
        </div>
      </div>
    `;
  } else if (cond === 'vista') {
    wrap.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--surface);border:1px solid var(--border);border-radius:8px">
          <span style="font-size:12.5px;font-weight:600">Total à Vista: <strong style="color:var(--accent)">${fmt(netTotal)}</strong></span>
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;margin:0;font-weight:600">
            <input type="checkbox" id="fatVistaPaid" checked onchange="updateFaturarPlanPreview()" style="accent-color:var(--accent)">
            Já recebido hoje
          </label>
        </div>
        <div class="row2">
          <div class="fld" style="margin:0"><label class="flbl">Forma de Pagamento</label>
            <select class="inp inp-sm" id="fatVistaMethod" onchange="updateFaturarPlanPreview()">
              <option value="Pix" selected>Pix</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Boleto">Boleto</option>
              <option value="Transferência">Transferência</option>
            </select>
          </div>
          <div class="fld" style="margin:0"><label class="flbl">Data do Vencimento / Recebimento</label>
            <input type="date" class="inp inp-sm" id="fatVistaDate" value="${today()}" onchange="updateFaturarPlanPreview()">
          </div>
        </div>
      </div>
    `;
  } else if (cond === 'entrada_parc') {
    const defaultEntry = Math.round((netTotal * 0.3) * 100) / 100;
    wrap.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="row2">
          <div class="fld" style="margin:0"><label class="flbl">Valor da Entrada (R$)</label>
            <input type="text" inputmode="decimal" class="inp inp-sm" id="fatCustomEntryAmount" value="${toBRLInputStr(defaultEntry)}" oninput="maskCurrencyInput(this);updateFaturarPlanPreview()">
          </div>
          <div class="fld" style="margin:0"><label class="flbl">Parcelas do Saldo</label>
            <select class="inp inp-sm" id="fatCustomParcCount" onchange="updateFaturarPlanPreview()">
              <option value="2" selected>2x no Saldo</option>
              <option value="3">3x no Saldo</option>
              <option value="4">4x no Saldo</option>
              <option value="5">5x no Saldo</option>
              <option value="6">6x no Saldo</option>
              <option value="10">10x no Saldo</option>
              <option value="12">12x no Saldo</option>
            </select>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--surface);border:1px solid var(--border);border-radius:8px">
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;margin:0;font-weight:600">
            <input type="checkbox" id="fatEntryPaid" checked onchange="updateFaturarPlanPreview()" style="accent-color:var(--accent)">
            Entrada já recebida hoje
          </label>
          <select class="inp inp-sm" id="fatEntryMethod" style="width:auto;padding:3px 8px;font-size:12px" onchange="updateFaturarPlanPreview()">
            <option value="Pix" selected>Pix</option>
            <option value="Cartão de Crédito">Cartão de Crédito</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="Boleto">Boleto</option>
          </select>
        </div>
        <div class="row2">
          <div class="fld" style="margin:0"><label class="flbl">1º Vencimento do Saldo</label>
            <input type="date" class="inp inp-sm" id="fatCustomFirstDueDate" value="${addDays(today(), 30)}" onchange="updateFaturarPlanPreview()">
          </div>
          <div class="fld" style="margin:0"><label class="flbl">Intervalo</label>
            <select class="inp inp-sm" id="fatCustomInterval" onchange="updateFaturarPlanPreview()">
              <option value="30" selected>Mensal (a cada 30 dias)</option>
              <option value="15">Quinzenal (a cada 15 dias)</option>
            </select>
          </div>
        </div>
      </div>
    `;
  } else if (cond === 'parcelado') {
    wrap.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="row2">
          <div class="fld" style="margin:0"><label class="flbl">Quantidade de Parcelas</label>
            <select class="inp inp-sm" id="fatDirectParcCount" onchange="updateFaturarPlanPreview()">
              <option value="2">2x</option>
              <option value="3" selected>3x</option>
              <option value="4">4x</option>
              <option value="5">5x</option>
              <option value="6">6x</option>
              <option value="10">10x</option>
              <option value="12">12x</option>
            </select>
          </div>
          <div class="fld" style="margin:0"><label class="flbl">1º Vencimento</label>
            <input type="date" class="inp inp-sm" id="fatDirectFirstDueDate" value="${addDays(today(), 30)}" onchange="updateFaturarPlanPreview()">
          </div>
        </div>
        <div class="fld" style="margin:0"><label class="flbl">Intervalo entre Parcelas</label>
          <select class="inp inp-sm" id="fatDirectInterval" onchange="updateFaturarPlanPreview()">
            <option value="30" selected>Mensal (a cada 30 dias)</option>
            <option value="15">Quinzenal (a cada 15 dias)</option>
          </select>
        </div>
      </div>
    `;
  }

  updateFaturarPlanPreview();
}

function calculateFaturarPlan(netTotal, deadline) {
  const cond = document.getElementById('fatPayCondition')?.value || '50_50';
  let installments = [];
  let payments = [];

  if (cond === '50_50') {
    const halfVal = Math.round((netTotal / 2) * 100) / 100;
    const restVal = Math.round((netTotal - halfVal) * 100) / 100;
    const isEntryPaid = document.getElementById('fatEntryPaid')?.checked ?? true;
    const entryMethod = document.getElementById('fatEntryMethod')?.value || 'Pix';
    const entryDate = document.getElementById('fatEntryDate')?.value || today();

    const inst1Id = Date.now();
    const inst2Id = Date.now() + 1;

    const inst1 = {
      id: inst1Id,
      number: 1,
      desc: 'Entrada (50%)',
      amount: halfVal,
      dueDate: entryDate,
      status: isEntryPaid ? 'Pago' : 'Pendente',
      paidDate: isEntryPaid ? entryDate : null,
      method: isEntryPaid ? entryMethod : null
    };

    const inst2 = {
      id: inst2Id,
      number: 2,
      desc: 'Saldo na Entrega (50%)',
      amount: restVal,
      dueDate: deadline || addDays(today(), 15),
      status: 'Pendente'
    };

    installments = [inst1, inst2];

    if (isEntryPaid) {
      payments.push({
        id: inst1Id,
        amount: halfVal,
        date: entryDate,
        method: entryMethod,
        desc: 'Entrada (50%)'
      });
    }
  } else if (cond === 'vista') {
    const isPaid = document.getElementById('fatVistaPaid')?.checked ?? true;
    const method = document.getElementById('fatVistaMethod')?.value || 'Pix';
    const vDate = document.getElementById('fatVistaDate')?.value || today();
    const instId = Date.now();

    installments.push({
      id: instId,
      number: 1,
      desc: 'Pagamento Integral À Vista',
      amount: netTotal,
      dueDate: vDate,
      status: isPaid ? 'Pago' : 'Pendente',
      paidDate: isPaid ? vDate : null,
      method: isPaid ? method : null
    });

    if (isPaid) {
      payments.push({
        id: instId,
        amount: netTotal,
        date: vDate,
        method: method,
        desc: 'Pagamento Integral À Vista'
      });
    }
  } else if (cond === 'entrada_parc') {
    const entryAmount = parseBRL(document.getElementById('fatCustomEntryAmount')?.value || '0');
    const validEntry = Math.min(Math.max(0, entryAmount), netTotal);
    const count = parseInt(document.getElementById('fatCustomParcCount')?.value || '2');
    const isEntryPaid = document.getElementById('fatEntryPaid')?.checked ?? true;
    const entryMethod = document.getElementById('fatEntryMethod')?.value || 'Pix';
    const firstDate = document.getElementById('fatCustomFirstDueDate')?.value || addDays(today(), 30);
    const intervalDays = parseInt(document.getElementById('fatCustomInterval')?.value || '30');

    let runningId = Date.now();

    if (validEntry > 0) {
      const entryInstId = runningId++;
      installments.push({
        id: entryInstId,
        number: 1,
        desc: 'Entrada',
        amount: validEntry,
        dueDate: today(),
        status: isEntryPaid ? 'Pago' : 'Pendente',
        paidDate: isEntryPaid ? today() : null,
        method: isEntryPaid ? entryMethod : null
      });

      if (isEntryPaid) {
        payments.push({
          id: entryInstId,
          amount: validEntry,
          date: today(),
          method: entryMethod,
          desc: 'Entrada'
        });
      }
    }

    const restTotal = Math.max(0, netTotal - validEntry);
    if (restTotal > 0 && count > 0) {
      const perParc = Math.round((restTotal / count) * 100) / 100;
      let accum = 0;
      for (let i = 1; i <= count; i++) {
        const pVal = (i === count) ? Math.round((restTotal - accum) * 100) / 100 : perParc;
        accum += pVal;
        const pDate = addDays(firstDate, (i - 1) * intervalDays);
        installments.push({
          id: runningId++,
          number: installments.length + 1,
          desc: `Parcela ${i}/${count}`,
          amount: pVal,
          dueDate: pDate,
          status: 'Pendente'
        });
      }
    }
  } else if (cond === 'parcelado') {
    const count = parseInt(document.getElementById('fatDirectParcCount')?.value || '3');
    const firstDate = document.getElementById('fatDirectFirstDueDate')?.value || addDays(today(), 30);
    const intervalDays = parseInt(document.getElementById('fatDirectInterval')?.value || '30');

    let runningId = Date.now();
    const perParc = Math.round((netTotal / count) * 100) / 100;
    let accum = 0;

    for (let i = 1; i <= count; i++) {
      const pVal = (i === count) ? Math.round((netTotal - accum) * 100) / 100 : perParc;
      accum += pVal;
      const pDate = addDays(firstDate, (i - 1) * intervalDays);
      installments.push({
        id: runningId++,
        number: i,
        desc: `Parcela ${i}/${count}`,
        amount: pVal,
        dueDate: pDate,
        status: 'Pendente'
      });
    }
  }

  const paid = payments.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  return { installments, payments, paid };
}

let currentFaturarPlan = null;

function updateFaturarPlanPreview(keepEdits = false) {
  const id = parseInt(document.getElementById('fatOrcId')?.value || '0');
  const b = budgets.find(x => x.id === id);
  if (!b) return;

  const netTotal = b.total - (parseFloat(b.discount) || 0);
  const deadline = document.getElementById('fatDeadline')?.value || addDays(today(), 15);

  if (!keepEdits || !currentFaturarPlan || !Array.isArray(currentFaturarPlan.installments)) {
    currentFaturarPlan = calculateFaturarPlan(netTotal, deadline);
  }

  const preview = document.getElementById('fatInstallmentsPreview');
  const sumEl = document.getElementById('fatSummaryTotal');
  if (sumEl) sumEl.textContent = `Total: ${fmt(netTotal)}`;

  if (!preview) return;

  preview.innerHTML = currentFaturarPlan.installments.map((inst, idx) => {
    const isPaid = inst.status === 'Pago';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--surface);border:1px solid ${isPaid ? 'rgba(22,163,74,0.35)' : 'var(--border)'};border-radius:8px;font-size:12px;gap:8px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:200px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${isPaid ? 'rgba(22,163,74,0.15)' : 'var(--surface2)'};color:${isPaid ? 'var(--green)' : 'var(--text3)'};font-size:11px;font-weight:700">${inst.number}</span>
          <div style="display:flex;flex-direction:column;gap:3px;flex:1">
            <div style="font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px">
              <span>${inst.desc}</span>
              <span class="badge" style="font-size:9.5px;padding:1px 6px;background:${isPaid ? 'rgba(22,163,74,0.15)' : 'var(--surface2)'};color:${isPaid ? 'var(--green)' : 'var(--text3)'}">${isPaid ? '✓ Já Pago' : '⏳ Pendente'}</span>
            </div>
            <div style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--text2)">
              <i class="bi bi-calendar3" style="color:var(--accent)"></i>
              <span>Vencimento:</span>
              <input type="date" class="inp inp-sm" style="padding:1px 6px;font-size:11.5px;height:24px;border-radius:6px;width:125px;background:var(--surface2);border:1px solid var(--border);color:var(--text);cursor:pointer" value="${inst.dueDate || ''}" onchange="changeFaturarInstDate(${idx}, this.value)" title="Clique para editar a data de vencimento desta parcela">
            </div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-family:'Outfit',sans-serif;font-size:13.5px;color:${isPaid ? 'var(--green)' : 'var(--text)'}">${fmt(inst.amount)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function changeFaturarInstDate(index, newDate) {
  if (!currentFaturarPlan || !currentFaturarPlan.installments || !currentFaturarPlan.installments[index]) return;
  currentFaturarPlan.installments[index].dueDate = newDate;

  const inst = currentFaturarPlan.installments[index];
  if (inst.status === 'Pago') {
    inst.paidDate = newDate;
    if (Array.isArray(currentFaturarPlan.payments)) {
      const pay = currentFaturarPlan.payments.find(p => p.id === inst.id || p.desc === inst.desc);
      if (pay) pay.date = newDate;
    }
  }
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

  if (!currentFaturarPlan || !Array.isArray(currentFaturarPlan.installments)) {
    currentFaturarPlan = calculateFaturarPlan(value, deadline);
  }

  const installments = currentFaturarPlan.installments;
  const payments = currentFaturarPlan.payments || [];
  const paid = payments.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  const condition = document.getElementById('fatPayCondition')?.value || '50_50';

  const newProj = {
    id: Date.now(),
    name: b.title,
    client: b.client,
    image: '',
    value: value,
    payments: payments,
    paid: paid,
    installments: installments,
    paymentCondition: condition,
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
  showToast('Orçamento faturado com sucesso! Salvo no Kanban da Página Inicial com parcelamento configurado.', 'success');
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

function getOrcamentoPdfFilename(b) {
  const num = b.number || '0';
  const client = (b.client || 'Cliente').trim().replace(/[/\\?%*:|"<>]/g, '');
  const proj = (b.title || 'Projeto').trim().replace(/[/\\?%*:|"<>]/g, '');
  
  let dateFormatted = '';
  if (b.date) {
    const parts = b.date.split('-');
    if (parts.length === 3) {
      dateFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
    } else {
      dateFormatted = b.date;
    }
  } else {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    dateFormatted = `${d}-${m}-${y}`;
  }

  return `Orçamento ${num}_${client}_${proj}_${dateFormatted}.pdf`;
}

async function generateOrcamentoPdfBlob(b) {
  if (!b.number) { b.number = getNextOrcNumber(); scheduleSync(); }

  document.getElementById('orcId').value = b.id;
  document.getElementById('orcNumber').value = b.number;
  populateOrcClientSelect(b.client);
  document.getElementById('orcTitle').value = b.title;
  document.getElementById('orcDate').value = b.date;
  document.getElementById('orcValidUntil').value = b.validUntil;
  document.getElementById('orcProjectType').value = b.projectType || 'Residencial';
  document.getElementById('orcNotes').value = b.notes || '';
  document.getElementById('orcStatus').value = b.status;
  document.getElementById('orcDiscount').value = toBRLInputStr(b.discount || 0);
  tempOrcItems = [...(b.items || [])];
  editingOrcItemId = null;

  renderOrcItems();
  updateOrcPreviewLabels();

  const element = document.querySelector('#orcamentoOverlay .proposal-sheet');
  if (!element) throw new Error('Modelo de proposta não encontrado');

  const filename = getOrcamentoPdfFilename(b);
  const opt = {
    margin:       [4, 4, 4, 4],
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false, scrollY: 0, scrollX: 0 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  const clone = element.cloneNode(true);
  clone.classList.remove('mbody');
  clone.classList.add('proposal-sheet-pdf');
  clone.querySelectorAll('.no-print').forEach(el => el.remove());

  // Anexos & Fotos de Referência: só entram no PDF se o toggle "Exibir no PDF" estiver
  // ligado e houver pelo menos um arquivo anexado. Quando entram, vão para uma página
  // separada (depois do orçamento), via quebra de página forçada no html2pdf.
  const attachSection = clone.querySelector('#orcAttachmentsSection');
  if (attachSection) {
    const hasAttachments = Array.isArray(b.attachments) && b.attachments.length > 0;
    const includeAttachments = b.showAttachments === true && hasAttachments;
    if (!includeAttachments) {
      attachSection.remove();
    } else {
      attachSection.style.breakBefore = 'page';
      attachSection.style.pageBreakBefore = 'always';
    }
  }

  clone.style.background = '#ffffff';
  clone.style.color = '#1C1B19';
  clone.style.padding = '4mm 4mm';
  clone.style.width = '202mm';
  clone.style.minWidth = '202mm';
  clone.style.maxWidth = '202mm';
  clone.style.boxSizing = 'border-box';
  clone.style.boxShadow = 'none';
  clone.style.margin = '0 auto';

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.zIndex = '-9999';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.background = '#ffffff';
  wrapper.style.width = '202mm';
  wrapper.style.minWidth = '202mm';
  wrapper.style.maxWidth = '202mm';
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    await loadHtml2Pdf();
    const pdfBlob = await html2pdf().from(clone).set(opt).outputPdf('blob');
    return { blob: pdfBlob, filename, budget: b };
  } finally {
    if (wrapper && wrapper.parentNode) {
      document.body.removeChild(wrapper);
    }
  }
}

async function downloadOrcamentoPDFDirect(id) {
  const b = budgets.find(x => x.id === id);
  if (!b) return;

  const isMobile = isMobileDevice();
  let previewTab = null;
  if (!isMobile) {
    try {
      previewTab = window.open('', '_blank');
    } catch(e) {}
  }
  showToast('Gerando visualização do PDF...', 'info');

  try {
    const { blob, filename } = await generateOrcamentoPdfBlob(b);
    await shareOrOpenPdfBlob(blob, filename, {
      title: filename.replace(/\.pdf$/i, ''),
      text: `Olá! Segue a Proposta Comercial referente ao projeto ${b.title || 'MAVIC'}.`,
      previewTab
    });
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    if (previewTab) previewTab.close();
    showToast('Erro ao gerar PDF: ' + (err.message || err), 'error');
  }
}

async function downloadOrcamentoPDFFile(id) {
  const b = budgets.find(x => x.id === id);
  if (!b) return;

  showToast('Baixando PDF...', 'info');
  try {
    const { blob, filename } = await generateOrcamentoPdfBlob(b);
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    showToast(`PDF baixado com sucesso! (${filename})`, 'success');
  } catch (err) {
    console.error('Erro ao baixar PDF:', err);
    showToast('Erro ao baixar PDF: ' + (err.message || err), 'error');
  }
}

async function shareOrcamentoPDF(id) {
  const b = budgets.find(x => x.id === id);
  if (!b) return;

  showToast('Preparando para compartilhar...', 'info');
  try {
    const { blob, filename } = await generateOrcamentoPdfBlob(b);
    const file = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename.replace('.pdf', ''),
        text: `Olá! Segue a Proposta Comercial referente ao projeto ${b.title || 'MAVIC'}.`
      });
      showToast('Orçamento compartilhado com sucesso!', 'success');
    } else {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      
      showToast('PDF baixado! Abrindo WhatsApp...', 'success');
      setTimeout(() => sendOrcamentoWhatsApp(b.id), 600);
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Erro ao compartilhar PDF:', err);
      showToast('Erro ao compartilhar PDF: ' + (err.message || err), 'error');
    }
  }
}

function downloadOrcamentoPDFModal() {
  const id = parseInt(document.getElementById('orcId').value);
  if (id) downloadOrcamentoPDFDirect(id);
}

function downloadOrcamentoPDFFileModal() {
  const id = parseInt(document.getElementById('orcId').value);
  if (id) downloadOrcamentoPDFFile(id);
}

function shareOrcamentoPDFModal() {
  const id = parseInt(document.getElementById('orcId').value);
  if (id) shareOrcamentoPDF(id);
}

function saveOrcamentoAndDownloadPdf() {
  const savedId = saveOrcamento();
  if (savedId) downloadOrcamentoPDFDirect(savedId);
}

function saveOrcamentoAndDownloadFile() {
  const savedId = saveOrcamento();
  if (savedId) downloadOrcamentoPDFFile(savedId);
}

function saveOrcamentoAndShare() {
  const savedId = saveOrcamento();
  if (savedId) shareOrcamentoPDF(savedId);
}

function updateClientFilter(){
  const clList = Array.isArray(clients) ? clients : [];
  const clientNames = new Set(clList.map(c => c?.name).filter(Boolean));
  (budgets || []).forEach(b => {
    if (b && b.client) clientNames.add(b.client);
  });
  const sortedNames = Array.from(clientNames).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const list = sortedNames.map(name => `<option value="${name}">${name}</option>`).join('');
  const oSel = document.getElementById('fOrcClient');
  if (oSel) {
    const oCur = oSel.value;
    oSel.innerHTML = '<option value="">Todos os Clientes</option>' + list;
    if (oCur && sortedNames.includes(oCur)) oSel.value = oCur;
  }
}

function updateYearFilter() {
  const ySel = document.getElementById('fOrcYear');
  if (!ySel) return;
  const cur = ySel.value;
  const years = new Set();
  const currentYear = new Date().getFullYear();
  years.add(String(currentYear));
  years.add(String(currentYear - 1));
  years.add(String(currentYear - 2));

  (budgets || []).forEach(b => {
    if (b?.date) {
      const y = String(b.date).substring(0, 4);
      if (/^\d{4}$/.test(y)) years.add(y);
    }
  });

  const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));
  ySel.innerHTML = '<option value="">Todos os Anos</option>' + sortedYears.map(y => `<option value="${y}" ${y === cur ? 'selected' : ''}>${y}</option>`).join('');
}

// ══════════════════════════════════════════
//  ANEXOS & FOTOS DO ORÇAMENTO
// ══════════════════════════════════════════
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIconClass(filename, type) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext) || (type && type.startsWith('image/'))) {
    return 'bi-file-earmark-image';
  }
  if (ext === 'pdf' || type === 'application/pdf') return 'bi-file-earmark-pdf';
  if (['doc', 'docx'].includes(ext)) return 'bi-file-earmark-word';
  if (['xls', 'xlsx'].includes(ext)) return 'bi-file-earmark-excel';
  if (['dwg', 'dxf', 'skp', 'rvt', 'ifc', '3ds', 'obj', 'blend'].includes(ext)) return 'bi-boxes';
  if (['zip', 'rar', '7z'].includes(ext)) return 'bi-file-earmark-zip';
  return 'bi-file-earmark-text';
}

function compressOrcImage(file, maxDimension = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleOrcFilesSelected(files) {
  if (!files || !files.length) return;
  
  showToast(`Processando ${files.length} arquivo(s)...`, 'info');
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isImg = file.type ? file.type.startsWith('image/') : /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
    
    try {
      let dataUrl = '';
      if (isImg) {
        dataUrl = await compressOrcImage(file, 1200, 0.82);
      } else {
        dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
      }
      
      tempOrcAttachments.push({
        id: 'att_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: formatFileSize(file.size),
        isImage: isImg,
        data: dataUrl,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Erro ao ler arquivo:', err);
    }
  }
  
  renderOrcAttachments();
  showToast('Arquivos anexados com sucesso!', 'success');
  
  const inp = document.getElementById('orcFileInput');
  if (inp) inp.value = '';
}

// Liga/desliga a inclusão da seção de anexos no PDF/impressão do orçamento.
// Os arquivos continuam anexados e visíveis no editor — o que muda é só o que sai no documento final.
function toggleOrcShowAttachments() {
  const chk = document.getElementById('orcShowAttachments');
  tempOrcShowAttachments = chk ? chk.checked : true;
  syncOrcAttachmentsVisibilityUI();
}

function syncOrcAttachmentsVisibilityUI() {
  const chk = document.getElementById('orcShowAttachments');
  if (chk) chk.checked = tempOrcShowAttachments;

  const hasAttachments = Array.isArray(tempOrcAttachments) && tempOrcAttachments.length > 0;
  const includeInOutput = tempOrcShowAttachments && hasAttachments;

  // Classes usadas só pelo @media print (impressão nativa via Ctrl+P / botão Imprimir).
  // A geração de PDF (html2canvas) trata isso separadamente em generateOrcamentoPdfBlob.
  const section = document.getElementById('orcAttachmentsSection');
  if (section) {
    section.classList.toggle('orc-attach-print-off', !includeInOutput);
    section.classList.toggle('orc-attach-print-on', includeInOutput);
  }

  const hint = document.getElementById('orcAttachPdfHint');
  if (hint) hint.style.display = tempOrcShowAttachments ? 'none' : 'flex';
}

function renderOrcAttachments() {
  const grid = document.getElementById('orcAttachmentsGrid');
  const badge = document.getElementById('orcAttachCountBadge');
  if (!grid) return;
  
  if (badge) {
    badge.textContent = `${tempOrcAttachments.length} arquivo${tempOrcAttachments.length === 1 ? '' : 's'}`;
  }

  syncOrcAttachmentsVisibilityUI();

  if (!tempOrcAttachments.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:12px;color:var(--text3);font-size:12px;background:var(--surface2);border:1px dashed var(--border);border-radius:8px">
        Nenhum arquivo ou foto anexado ainda.
      </div>
    `;
    return;
  }
  
  grid.innerHTML = tempOrcAttachments.map(att => {
    const iconClass = getFileIconClass(att.name, att.type);
    const isImg = att.isImage && att.data;
    
    return `
      <div class="orc-attachment-card" data-id="${att.id}">
        <button type="button" class="orc-attach-del-btn no-print" onclick="removeOrcAttachment('${att.id}')" title="Excluir anexo">
          <i class="bi bi-trash3"></i>
        </button>
        <div class="orc-attach-preview-box" onclick="viewOrcAttachment('${att.id}')" title="Clique para visualizar">
          ${isImg 
            ? `<img src="${att.data}" alt="${escapeHtml(att.name)}" class="orc-attach-thumb">`
            : `<i class="bi ${iconClass} orc-attach-icon"></i>`
          }
        </div>
        <div class="orc-attach-info">
          <span class="orc-attach-name" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</span>
          <div class="orc-attach-meta">
            <span>${att.size || ''}</span>
            <span style="color:var(--accent);cursor:pointer" onclick="viewOrcAttachment('${att.id}')"><i class="bi bi-eye"></i> Ver</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function removeOrcAttachment(id) {
  tempOrcAttachments = tempOrcAttachments.filter(a => a.id !== id);
  renderOrcAttachments();
  showToast('Anexo removido.', 'info');
}

function viewOrcAttachment(id) {
  const att = tempOrcAttachments.find(a => a.id === id);
  if (!att) return;
  
  const overlay = document.getElementById('orcAttachPreviewOverlay');
  const title = document.getElementById('orcAttachPreviewTitle');
  const icon = document.getElementById('orcAttachPreviewIcon');
  const dlBtn = document.getElementById('orcAttachDownloadBtn');
  const imgEl = document.getElementById('orcAttachPreviewImg');
  const docWrap = document.getElementById('orcAttachDocPreview');
  const docIcon = document.getElementById('orcAttachDocIcon');
  const docName = document.getElementById('orcAttachDocName');
  const docSize = document.getElementById('orcAttachDocSize');
  const docOpenBtn = document.getElementById('orcAttachDocOpenBtn');
  
  if (!overlay) return;
  
  title.textContent = att.name;
  dlBtn.href = att.data;
  dlBtn.download = att.name;
  
  if (att.isImage) {
    icon.className = 'bi bi-image';
    imgEl.src = att.data;
    imgEl.style.display = 'block';
    docWrap.style.display = 'none';
  } else {
    const iconClass = getFileIconClass(att.name, att.type);
    icon.className = `bi ${iconClass}`;
    imgEl.style.display = 'none';
    docWrap.style.display = 'block';
    docIcon.className = `bi ${iconClass}`;
    docName.textContent = att.name;
    docSize.textContent = att.size || '';
    docOpenBtn.href = att.data;
  }
  
  overlay.classList.add('open');
}

function closeOrcAttachPreviewModal() {
  const overlay = document.getElementById('orcAttachPreviewOverlay');
  if (overlay) overlay.classList.remove('open');
}

function setupOrcDropzoneEvents() {
  const dz = document.getElementById('orcDropzone');
  if (!dz) return;
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dz.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.add('dragover');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dz.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.remove('dragover');
    }, false);
  });
  
  dz.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt ? dt.files : null;
    if (files && files.length) {
      handleOrcFilesSelected(files);
    }
  }, false);
}

