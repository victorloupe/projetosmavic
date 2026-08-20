// ══════════════════════════════════════════
//  SERVIÇOS MODULE (servicos.js)
// ══════════════════════════════════════════

function initPage() {
  initServicosPage();
}

function initServicosPage() {
  checkAndMigrateLegacyProducts();
  populateCategoryFilter();
  populateClientFilter();
  updateServKPIs();
  renderServChips();
  renderServicos();
}

function renderServChips() {
  const bar = document.getElementById('servChipsBar');
  if (!bar) return;

  const currentTarget = document.getElementById('fServTarget')?.value || '';
  const total = (services || []).length;
  const gerais = (services || []).filter(s => !s.targetType || s.targetType === 'all').length;
  const espec = (services || []).filter(s => s.targetType === 'selected').length;

  bar.innerHTML = `
    <button type="button" class="serv-chip ${!currentTarget ? 'active' : ''}" onclick="setServTargetFilter('')">
      <span>Todos</span>
      <span class="serv-chip-count">${total}</span>
    </button>
    <button type="button" class="serv-chip ${currentTarget === 'all' ? 'active' : ''}" onclick="setServTargetFilter('all')">
      <span>🌐 Gerais</span>
      <span class="serv-chip-count">${gerais}</span>
    </button>
    <button type="button" class="serv-chip ${currentTarget === 'selected' ? 'active' : ''}" onclick="setServTargetFilter('selected')">
      <span>🎯 Por Cliente</span>
      <span class="serv-chip-count">${espec}</span>
    </button>
  `;
}

function setServTargetFilter(val) {
  const sel = document.getElementById('fServTarget');
  if (sel) sel.value = val;
  pgReset('servicos');
  renderServChips();
  renderServicos();
}

function clearServFilters() {
  const srch = document.getElementById('fServSearch');
  const cat = document.getElementById('fServCategory');
  const tgt = document.getElementById('fServTarget');
  const cli = document.getElementById('fServClient');
  if (srch) srch.value = '';
  if (cat) cat.value = '';
  if (tgt) tgt.value = '';
  if (cli) cli.value = '';
  pgReset('servicos');
  renderServChips();
  renderServicos();
}

function updateServKPIs() {
  const total = (services || []).length;
  const gerais = (services || []).filter(s => !s.targetType || s.targetType === 'all').length;
  const especificos = (services || []).filter(s => s.targetType === 'selected').length;
  
  let sumPrice = 0;
  (services || []).forEach(s => { sumPrice += parseFloat(s.price || 0); });
  const media = total > 0 ? (sumPrice / total) : 0;

  const elTotal = document.getElementById('kpiTotalServicos');
  const elGerais = document.getElementById('kpiServicosGerais');
  const elEspec = document.getElementById('kpiServicosEspecificos');
  const elMedia = document.getElementById('kpiMediaPreco');

  if (elTotal) elTotal.textContent = total;
  if (elGerais) elGerais.textContent = gerais;
  if (elEspec) elEspec.textContent = especificos;
  if (elMedia) elMedia.textContent = fmt(media);
}

function populateCategoryFilter() {
  const sel = document.getElementById('fServCategory');
  if (!sel) return;
  const current = sel.value;
  const cats = new Set();
  (services || []).forEach(s => {
    if (s.category && s.category.trim()) cats.add(s.category.trim());
  });

  const sortedCats = Array.from(cats).sort();
  let html = '<option value="">Todas as Categorias</option>';
  sortedCats.forEach(c => {
    html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
  });
  sel.innerHTML = html;
  if (current && cats.has(current)) sel.value = current;
}

function populateClientFilter() {
  const sel = document.getElementById('fServClient');
  if (!sel) return;
  const current = sel.value;
  let html = '<option value="">Filtrar por Cliente</option>';
  (clients || []).forEach(c => {
    html += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
  });
  sel.innerHTML = html;
  if (current) sel.value = current;
}

function renderServicos() {
  const tbody = document.getElementById('servTableBody');
  const mobileList = document.getElementById('servMobileList');
  if (!tbody && !mobileList) return;

  const search = (document.getElementById('fServSearch')?.value || '').toLowerCase().trim();
  const catFilter = document.getElementById('fServCategory')?.value || '';
  const targetFilter = document.getElementById('fServTarget')?.value || '';
  const clientFilter = document.getElementById('fServClient')?.value || '';

  let list = [...(services || [])];

  if (search) {
    list = list.filter(s => {
      const name = (s.name || '').toLowerCase();
      const desc = (s.desc || '').toLowerCase();
      const cat = (s.category || '').toLowerCase();
      const priceStr = String(s.price || '');
      const fmtStr = fmt(s.price || 0).toLowerCase();
      return name.includes(search) || desc.includes(search) || cat.includes(search) || priceStr.includes(search) || fmtStr.includes(search);
    });
  }

  if (catFilter) {
    list = list.filter(s => (s.category || '').trim() === catFilter);
  }

  if (targetFilter) {
    list = list.filter(s => {
      const isAll = !s.targetType || s.targetType === 'all';
      if (targetFilter === 'all') return isAll;
      if (targetFilter === 'selected') return !isAll;
      return true;
    });
  }

  if (clientFilter) {
    const cid = parseInt(clientFilter);
    list = list.filter(s => {
      if (!s.targetType || s.targetType === 'all') return true;
      if (s.targetType === 'selected') {
        const ids = Array.isArray(s.clientIds) ? s.clientIds.map(Number) : [];
        return ids.includes(cid);
      }
      return true;
    });
  }

  // Ordena por nome
  list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (list.length === 0) {
    const isFiltered = Boolean(search || catFilter || targetFilter || clientFilter);
    const emptyRow = `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:32px"><i class="bi bi-box-seam" style="font-size:32px;display:block;margin-bottom:8px;opacity:0.6"></i>Nenhum serviço encontrado${isFiltered ? `<br><button class="btn-clear-filter" onclick="clearServFilters()"><i class="bi bi-x-circle"></i> Limpar filtros</button>` : ''}</td></tr>` + pgFillerRowsHtml('servicos', 0, 5);
    if (tbody) tbody.innerHTML = emptyRow;
    if (mobileList) mobileList.innerHTML = `<div style="text-align:center;color:var(--text3);padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:16px"><i class="bi bi-box-seam" style="font-size:28px;display:block;margin-bottom:6px;opacity:0.6"></i>Nenhum serviço encontrado${isFiltered ? `<br><button class="btn-clear-filter" onclick="clearServFilters()"><i class="bi bi-x-circle"></i> Limpar filtros</button>` : ''}</div>` + pgFillerCardsHtml('servicos', 0, 90);
    const pgEl = document.getElementById('servPagination');
    if (pgEl) pgEl.innerHTML = pgBarHtml('servicos', 0, 'renderServicos');
    return;
  }

  const pageItems = pgSlice(list, 'servicos');

  if (tbody) {
    tbody.innerHTML = pageItems.map(s => {
      const isAll = !s.targetType || s.targetType === 'all';
      let clientBadge = '';

      if (isAll) {
        clientBadge = `<span class="badge" style="background:rgba(22,163,74,0.12);color:var(--green);font-weight:600;font-size:11px"><i class="bi bi-globe"></i> Geral (Todos)</span>`;
      } else {
        const ids = Array.isArray(s.clientIds) ? s.clientIds.map(Number) : [];
        const matchedClients = (clients || []).filter(c => ids.includes(c.id));
        if (matchedClients.length === 1) {
          const cl = matchedClients[0];
          clientBadge = `<span class="badge" style="background:rgba(37,99,235,0.12);color:#2563EB;font-weight:600;font-size:11px"><i class="bi bi-person"></i> ${escapeHtml(cl.name)}</span>`;
        } else if (matchedClients.length > 1) {
          const names = matchedClients.map(c => c.name).join(', ');
          clientBadge = `<span class="badge" style="background:rgba(37,99,235,0.12);color:#2563EB;font-weight:600;font-size:11px" title="${escapeHtml(names)}"><i class="bi bi-people"></i> ${matchedClients.length} Clientes</span>`;
        } else {
          clientBadge = `<span class="badge" style="background:rgba(113,113,122,0.12);color:var(--text3);font-size:11px">Nenhum cliente</span>`;
        }
      }

      const catBadge = s.category ? `<span class="badge" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);font-size:11px">${escapeHtml(s.category)}</span>` : '<span style="color:var(--text3);font-size:11px">—</span>';

      return `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:12px 14px">
            <div style="font-weight:700;color:var(--text);font-size:13.5px">${escapeHtml(s.name)}</div>
            ${s.desc ? `<div style="font-size:11.5px;color:var(--text3);margin-top:2px;max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(s.desc)}">${escapeHtml(s.desc)}</div>` : ''}
          </td>
          <td style="padding:12px 14px">${catBadge}</td>
          <td style="padding:12px 14px;font-family:'Outfit',sans-serif;font-weight:700;font-size:14px;color:var(--accent)">${fmt(s.price || 0)}</td>
          <td style="padding:12px 14px">${clientBadge}</td>
          <td style="padding:12px 14px;text-align:right">
            <div style="display:inline-flex;gap:4px;justify-content:flex-end">
              <button class="btn btn-ghost btn-sm" onclick="openServiceModal(${s.id})" title="Editar Serviço" style="padding:4px 8px"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="duplicateService(${s.id})" title="Duplicar Serviço" style="padding:4px 8px"><i class="bi bi-copy"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="deleteService(${s.id})" title="Excluir Serviço" style="padding:4px 8px;color:var(--red)"><i class="bi bi-trash3"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('') + pgFillerRowsHtml('servicos', pageItems.length, 5);
  }

  if (mobileList) {
    mobileList.innerHTML = pageItems.map(s => {
      const isAll = !s.targetType || s.targetType === 'all';
      let clientBadge = '';

      if (isAll) {
        clientBadge = `<span class="badge" style="background:rgba(22,163,74,0.12);color:var(--green);font-weight:600;font-size:11px"><i class="bi bi-globe"></i> Geral</span>`;
      } else {
        const ids = Array.isArray(s.clientIds) ? s.clientIds.map(Number) : [];
        const matchedClients = (clients || []).filter(c => ids.includes(c.id));
        if (matchedClients.length === 1) {
          clientBadge = `<span class="badge" style="background:rgba(37,99,235,0.12);color:#2563EB;font-weight:600;font-size:11px"><i class="bi bi-person"></i> ${escapeHtml(matchedClients[0].name)}</span>`;
        } else if (matchedClients.length > 1) {
          clientBadge = `<span class="badge" style="background:rgba(37,99,235,0.12);color:#2563EB;font-weight:600;font-size:11px"><i class="bi bi-people"></i> ${matchedClients.length} Clientes</span>`;
        } else {
          clientBadge = `<span class="badge" style="background:rgba(113,113,122,0.12);color:var(--text3);font-size:11px">Específico</span>`;
        }
      }

      return `
        <div class="serv-card">
          <div class="serv-card-top">
            <div class="serv-card-title-wrap">
              <span class="serv-card-name">${escapeHtml(s.name)}</span>
              ${s.category ? `<span class="badge" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);font-size:10px;padding:1px 5px">${escapeHtml(s.category)}</span>` : ''}
            </div>
            <div class="serv-card-price">${fmt(s.price || 0)}</div>
          </div>

          ${s.desc ? `<div class="serv-card-desc">${escapeHtml(s.desc)}</div>` : ''}

          <div class="serv-card-footer">
            <div>${clientBadge}</div>
            <div class="serv-card-actions">
              <button class="btn btn-ghost btn-sm serv-act-btn" onclick="openServiceModal(${s.id})" title="Editar"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-ghost btn-sm serv-act-btn" onclick="duplicateService(${s.id})" title="Duplicar"><i class="bi bi-copy"></i></button>
              <button class="btn btn-ghost btn-sm serv-act-btn del" onclick="deleteService(${s.id})" title="Excluir"><i class="bi bi-trash3"></i></button>
            </div>
          </div>
        </div>
      `;
    }).join('') + pgFillerCardsHtml('servicos', pageItems.length, 90);
  }

  const pgEl = document.getElementById('servPagination');
  if (pgEl) pgEl.innerHTML = pgBarHtml('servicos', list.length, 'renderServicos');
}

// ══════════════════════════════════════════
//  MODAL: NOVO / EDITAR SERVIÇO
// ══════════════════════════════════════════
function openServiceModal(id = null) {
  const modal = document.getElementById('serviceOverlay');
  const title = document.getElementById('serviceModalTitle');
  if (!modal) return;

  document.getElementById('servEditId').value = id ? String(id) : '';
  
  if (id) {
    const s = (services || []).find(x => x.id === parseInt(id) || String(x.id) === String(id));
    if (!s) return;

    if (title) title.innerHTML = `<i class="bi bi-box-seam"></i> <span>Editar Serviço</span>`;
    document.getElementById('servName').value = s.name || '';
    document.getElementById('servCategory').value = s.category || '';
    document.getElementById('servPrice').value = toBRLInputStr(s.price || 0);
    document.getElementById('servDesc').value = s.desc || '';

    const isAll = !s.targetType || s.targetType === 'all';
    if (document.getElementById('servTargetAll')) document.getElementById('servTargetAll').checked = isAll;
    if (document.getElementById('servTargetSelected')) document.getElementById('servTargetSelected').checked = !isAll;

    renderServClientsChecklist(s.clientIds || []);
  } else {
    if (title) title.innerHTML = `<i class="bi bi-box-seam"></i> <span>Novo Serviço</span>`;
    document.getElementById('servName').value = '';
    document.getElementById('servCategory').value = '';
    document.getElementById('servPrice').value = '';
    document.getElementById('servDesc').value = '';

    if (document.getElementById('servTargetAll')) document.getElementById('servTargetAll').checked = true;
    if (document.getElementById('servTargetSelected')) document.getElementById('servTargetSelected').checked = false;

    renderServClientsChecklist([]);
  }

  toggleServClientPicker();
  modal.classList.add('open');
}

function closeServiceModal() {
  const modal = document.getElementById('serviceOverlay');
  if (modal) modal.classList.remove('open');
}

function toggleServClientPicker() {
  const isSelected = document.getElementById('servTargetSelected')?.checked;
  const wrap = document.getElementById('servClientsPickerWrap');
  if (wrap) wrap.style.display = isSelected ? 'block' : 'none';
}

function renderServClientsChecklist(selectedIds = []) {
  const container = document.getElementById('servClientsCheckboxList');
  if (!container) return;

  const normSelected = (selectedIds || []).map(Number);

  if (!clients || clients.length === 0) {
    container.innerHTML = `<div style="font-size:11.5px;color:var(--text3);padding:8px;text-align:center">Nenhum cliente cadastrado ainda</div>`;
    return;
  }

  container.innerHTML = clients.map(c => {
    const isChecked = normSelected.includes(c.id);
    return `
      <label class="serv-client-row" data-name="${escapeHtml(c.name).toLowerCase()}" style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:6px;cursor:pointer;font-size:12.5px;user-select:none">
        <input type="checkbox" class="serv-client-cb" value="${c.id}" ${isChecked ? 'checked' : ''} style="cursor:pointer">
        <span class="kcard-avatar" style="background:${getClientColor(c.name)};width:20px;height:20px;font-size:9.5px">${getInitials(c.name)}</span>
        <span>${escapeHtml(c.name)}</span>
      </label>
    `;
  }).join('');
}

function filterServClientList() {
  const q = (document.getElementById('servClientSearch')?.value || '').toLowerCase().trim();
  const rows = document.querySelectorAll('.serv-client-row');
  rows.forEach(r => {
    const name = r.getAttribute('data-name') || '';
    r.style.display = name.includes(q) ? 'flex' : 'none';
  });
}

function saveService() {
  const editId = document.getElementById('servEditId')?.value;
  const name = (document.getElementById('servName')?.value || '').trim();
  const category = (document.getElementById('servCategory')?.value || '').trim() || 'Geral';
  const price = parseCurrencyInput(document.getElementById('servPrice')?.value || '0');
  const desc = (document.getElementById('servDesc')?.value || '').trim();
  const targetType = document.getElementById('servTargetSelected')?.checked ? 'selected' : 'all';

  if (!name) return showToast('Informe o nome do serviço', 'warning');

  let clientIds = [];
  if (targetType === 'selected') {
    const cbs = document.querySelectorAll('.serv-client-cb:checked');
    cbs.forEach(cb => {
      const cid = parseInt(cb.value);
      if (cid) clientIds.push(cid);
    });

    if (clientIds.length === 0) {
      return showToast('Selecione ao menos um cliente associado a este serviço', 'warning');
    }
  }

  if (editId) {
    const s = (services || []).find(x => String(x.id) === String(editId));
    if (s) {
      s.name = name;
      s.category = category;
      s.price = price;
      s.desc = desc;
      s.targetType = targetType;
      s.clientIds = clientIds;
      showToast('Serviço atualizado com sucesso!', 'success');
    }
  } else {
    const newService = {
      id: Date.now(),
      name,
      category,
      price,
      desc,
      targetType,
      clientIds,
      createdAt: Date.now()
    };
    if (!Array.isArray(services)) services = [];
    services.push(newService);
    showToast('Novo serviço cadastrado com sucesso!', 'success');
  }

  scheduleSync();
  closeServiceModal();
  populateCategoryFilter();
  updateServKPIs();
  renderServicos();
}

function deleteService(id) {
  const s = (services || []).find(x => String(x.id) === String(id));
  if (!s) return;

  showConfirm(`Deseja realmente excluir o serviço "${s.name}"?`, () => {
    services = (services || []).filter(x => String(x.id) !== String(id));
    scheduleSync();
    showToast('Serviço excluído!', 'info');
    populateCategoryFilter();
    updateServKPIs();
    renderServicos();
  });
}

function duplicateService(id) {
  const s = (services || []).find(x => String(x.id) === String(id));
  if (!s) return;

  const clone = {
    id: Date.now(),
    name: `${s.name} (Cópia)`,
    category: s.category || 'Geral',
    price: parseFloat(s.price || 0),
    desc: s.desc || '',
    targetType: s.targetType || 'all',
    clientIds: Array.isArray(s.clientIds) ? [...s.clientIds] : [],
    createdAt: Date.now()
  };

  if (!Array.isArray(services)) services = [];
  services.push(clone);
  scheduleSync();
  showToast('Serviço duplicado com sucesso!', 'success');
  populateCategoryFilter();
  updateServKPIs();
  renderServicos();
}

function syncClientServicesManual() {
  const initialCount = (services || []).length;
  checkAndMigrateLegacyProducts();
  populateCategoryFilter();
  populateClientFilter();
  updateServKPIs();
  renderServicos();
  const diff = (services || []).length - initialCount;
  if (diff > 0) {
    showToast(`${diff} novos serviços sincronizados dos clientes!`, 'success');
  } else {
    showToast('Todos os serviços dos clientes já estão sincronizados!', 'info');
  }
}
