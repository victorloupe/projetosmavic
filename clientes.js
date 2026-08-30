// ══════════════════════════════════════════
//  CRM - CLIENTES LOGIC
// ══════════════════════════════════════════
function initPage() {
  renderCliList();
  if (clients && clients.length > 0) {
    const sorted = [...clients].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    selectClient(sorted[0].id);
  } else {
    document.getElementById('cliDetail').classList.add('d-none');
    document.getElementById('cliPlaceholder').style.display = 'flex';
    currentCliId = null;
  }
}

function renderCliList(){
  const el=document.getElementById('cliList');
  if(!el) return;
  const searchInput = document.getElementById('cliSearch');
  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  
  let filtered = [...clients];
  if (search) {
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(search) || 
      (c.phone && c.phone.includes(search))
    );
  }
  
  filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const pgEl = document.getElementById('cliPagination');
  if (pgEl) pgEl.innerHTML = pgBarHtml('clientes', filtered.length, 'renderCliList', {hideSize:true, compact:true});

  if(!filtered.length){el.innerHTML='<div class="empty-state"><i class="bi bi-people"></i><span>Nenhum cliente cadastrado</span></div>';return;}
  const pageItems = pgSlice(filtered, 'clientes');
  el.innerHTML=pageItems.map(c=>{
    const pCount = (projects || []).filter(p => p && p.client && p.client.toLowerCase().trim() === c.name.toLowerCase().trim()).length;
    const servCount = c.products?.length || 0;
    return `<div class="cli-item ${currentCliId===c.id?'on':''}" onclick="selectClient(${c.id}, true)">
      <div style="display:flex;align-items:center;gap:9px;min-width:0;overflow:hidden">
        <span class="kcard-avatar" style="background:${getClientColor(c.name)};width:28px;height:28px;font-size:11px;flex-shrink:0">${getInitials(c.name)}</span>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600">${escapeHtml(c.name)}</span>
      </div>
      <span style="font-size:11px;color:var(--text3);flex-shrink:0;margin-left:6px">${pCount}p · ${servCount}s</span>
    </div>`;
  }).join('');
}

// Linhas de preenchimento desativadas para layout limpo
function cliFillerRowsHtml(actualCount) {
  return '';
}

function createClient(){
  const inp=document.getElementById('newCliName'),name=inp.value.trim();
  if(!name)return showToast('Digite o nome','warning');
  if(clients.find(c=>c.name.toLowerCase()===name.toLowerCase()))return showToast('Cliente já existe','warning');
  const cl={id:Date.now(),name,products:[],token:genTokenStr()};clients.push(cl);inp.value='';
  renderCliList();selectClient(cl.id);scheduleSync();showToast('Cliente cadastrado!','success');
}

function selectClient(id, userClick=false){
  currentCliId=id;const cl=clients.find(x=>x.id===id);if(!cl)return;
  if(!cl.token){cl.token=genTokenStr();scheduleSync();}
  document.getElementById('cliDetail').classList.remove('d-none');document.getElementById('cliPlaceholder').style.display='none';
  document.getElementById('cliDetailName').textContent=cl.name;document.getElementById('cliToken').value=cl.token;
  
  const avatarEl = document.getElementById('cliAvatar');
  if (avatarEl) {
    avatarEl.textContent = getInitials(cl.name);
    avatarEl.style.background = getClientColor(cl.name);
  }

  document.getElementById('cliPhone').value=formatPhoneMask(cl.phone||'');
  document.getElementById('cliAddress').value=cl.address||'';
  document.getElementById('cliEmail').value=cl.email||'';
  document.getElementById('cliDoc').value=formatDocMask(cl.doc||'');
  document.getElementById('cliDueDay').value=cl.dueDay || '';
  document.getElementById('cliDoc').classList.remove('inp-invalid');

  // Renderizar estatísticas do cliente (LTV e projetos)
  const cliProjs = (projects || []).filter(p => p && p.client && p.client.toLowerCase().trim() === cl.name.toLowerCase().trim());
  const cliTotalVal = cliProjs.reduce((s, p) => s + parseFloat(p.value || 0), 0);
  const cliTotalPaid = cliProjs.reduce((s, p) => s + (Array.isArray(p.payments) ? p.payments : []).reduce((a, x) => a + parseFloat(x.amount || 0), 0), 0);
  const cliPending = Math.max(0, cliTotalVal - cliTotalPaid);
  const cliConcl = cliProjs.filter(p => isFinalColumn(p.column)).length;

  const subtitleEl = document.getElementById('cliSubtitle');
  if (subtitleEl) {
    subtitleEl.textContent = `${cliProjs.length} projeto(s) cadastrado(s) · ${(cl.products || []).length} serviço(s) personalizado(s)`;
  }

  const statsEl = document.getElementById('cliStatsGrid');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="dash-card dc-accent cli-stat-card">
        <div class="dc-lbl">Total Faturado (LTV)</div>
        <div class="dc-val">${fmt(cliTotalVal)}</div>
        <div class="dc-sub">${cliProjs.length} projeto(s)</div>
      </div>
      <div class="dash-card dc-green cli-stat-card">
        <div class="dc-lbl">Total Recebido</div>
        <div class="dc-val" style="color:var(--green)">${fmt(cliTotalPaid)}</div>
        <div class="dc-sub">${cliConcl} concluído(s)</div>
      </div>
      <div class="dash-card dc-red cli-stat-card">
        <div class="dc-lbl">Saldo Pendente</div>
        <div class="dc-val" style="color:${cliPending > 0 ? 'var(--red)' : 'var(--text3)'}">${fmt(cliPending)}</div>
        <div class="dc-sub">${cliPending > 0 ? 'em aberto' : '100% quitado'}</div>
      </div>
    `;
  }

  updateCliLink(cl);renderCliProductsTable(cl);renderCliList();
  document.getElementById('cliDeleteBtn').onclick=()=>{
    showConfirm(`Remover "${cl.name}"?`, () => {
      clients=clients.filter(x=>x.id!==id);
      initPage();scheduleSync();showToast('Cliente removido','info');
    });
  };

  // Scroll suave no mobile para visualizar os detalhes do cliente selecionado
  if (userClick && window.innerWidth <= 768) {
    const detailWrap = document.getElementById('cliDetailWrap');
    if (detailWrap) {
      setTimeout(() => {
        detailWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }
}

function openClientWaDirect() {
  const cl = clients.find(x => x.id === currentCliId);
  if (!cl) return;
  const rawPhone = (cl.phone || '').replace(/\D/g, '');
  if (!rawPhone) {
    showToast('Cadastre o telefone do cliente primeiro', 'warning');
    const phoneInput = document.getElementById('cliPhone');
    if (phoneInput) {
      phoneInput.focus();
      phoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }
  const cleanPhone = rawPhone.length <= 11 ? '55' + rawPhone : rawPhone;
  const firstName = (cl.name || 'Cliente').trim().split(' ')[0];
  const msg = encodeURIComponent(`Olá ${firstName}, tudo bem?`);
  window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
}

function updateCliLink(cl){document.getElementById('cliLinkBox').textContent=cl.token?buildLink(cl.name,cl.token):'⚠️ Defina um token';}

function saveClientFull() {
  const cl = clients.find(x => x.id === currentCliId);
  if (!cl) return;

  const rawPhone = (document.getElementById('cliPhone')?.value || '').trim();
  cl.phone = formatPhoneMask(rawPhone);
  if (document.getElementById('cliPhone')) document.getElementById('cliPhone').value = cl.phone;

  cl.address = (document.getElementById('cliAddress')?.value || '').trim();
  cl.email = (document.getElementById('cliEmail')?.value || '').trim();
  cl.doc = formatDocMask((document.getElementById('cliDoc')?.value || '').trim());
  if (document.getElementById('cliDoc')) document.getElementById('cliDoc').value = cl.doc;

  const rawDay = parseInt(document.getElementById('cliDueDay')?.value);
  cl.dueDay = (rawDay >= 1 && rawDay <= 31) ? rawDay : null;

  const t = (document.getElementById('cliToken')?.value || '').trim();
  if (t) {
    if (/[\s&?#]/.test(t)) {
      return showToast('O token não pode conter espaços ou os caracteres & ? #', 'warning');
    }
    cl.token = t;
    updateCliLink(cl);
  }

  scheduleSync();
  renderCliList();

  const btn = document.getElementById('btnSaveClientFull');
  if (btn) {
    const origHtml = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-check-lg"></i> Salvo!';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-success');
    setTimeout(() => {
      btn.innerHTML = origHtml;
      btn.classList.remove('btn-success');
      btn.classList.add('btn-primary');
    }, 1800);
  }

  showToast('Dados do cliente salvos com sucesso!', 'success');
}

function saveClientContact(){ saveClientFull(); }
function saveToken(){ saveClientFull(); }

function genToken(){document.getElementById('cliToken').value=genTokenStr();showToast('Gere e clique em Salvar','info');}

function copyCliLink(){
  const text = document.getElementById('cliLinkBox').textContent;
  const btn = document.getElementById('btnCopyCliLink');

  const onSuccess = () => {
    showToast('Link do painel copiado!', 'success');
    if (btn) {
      const origHtml = btn.innerHTML;
      btn.innerHTML = '<i class="bi bi-check-lg" style="color:var(--green)"></i> <span style="color:var(--green);font-weight:700">Link Copiado!</span>';
      btn.style.borderColor = 'var(--green)';
      setTimeout(() => {
        btn.innerHTML = origHtml;
        btn.style.borderColor = '';
      }, 2000);
    }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
      fallbackCopyText(text);
      onSuccess();
    });
  } else {
    fallbackCopyText(text);
    onSuccess();
  }
}

function fallbackCopyText(text) {
  const dummy = document.createElement('textarea');
  dummy.style.position = 'fixed';
  dummy.style.opacity = '0';
  document.body.appendChild(dummy);
  dummy.value = text;
  dummy.select();
  document.execCommand('copy');
  document.body.removeChild(dummy);
}

function renderCliProductsTable(cl,editingId=null){
  const tb=document.getElementById('cliProdList');
  if(!tb) return;
  
  const clientServices = getServicesForClient(cl.id);
  const clientLegacy = Array.isArray(cl.products) ? cl.products : [];
  
  const allProds = [...clientServices];
  clientLegacy.forEach(lp => {
    if (!allProds.some(x => String(x.id) === String(lp.id) || (x.name||'').toLowerCase() === (lp.name||'').toLowerCase())) {
      allProds.push(lp);
    }
  });

  if(!allProds.length){
    tb.innerHTML='<tr><td colspan="4"><div class="empty-state" style="padding:16px"><i class="bi bi-table"></i><span>Nenhum serviço associado</span></div></td></tr>';
    return;
  }

  tb.innerHTML=allProds.map(p=>{
    const isGlobal = !p.targetType || p.targetType === 'all';
    if(p.id===editingId){
      return `<tr style="background:var(--accent-bg)">
        <td style="padding:5px 8px">
          <input id="epName_${p.id}" class="inp inp-sm" value="${escapeHtml(p.name)}" style="width:100%;margin-bottom:4px">
          <input id="epDesc_${p.id}" class="inp inp-sm" value="${escapeHtml(p.desc||'')}" placeholder="Descrição (opcional)" style="width:100%;font-size:11.5px">
        </td>
        <td style="padding:5px 8px"><input id="epPrice_${p.id}" type="text" inputmode="decimal" class="inp inp-sm" value="${toBRLInputStr(p.price)}" oninput="maskCurrencyInput(this)" style="width:110px"></td>
        <td style="padding:5px 8px;text-align:right;white-space:nowrap">
          <button class="btn btn-primary btn-sm" onclick="saveProdEdit(${p.id})"><i class="bi bi-check2"></i></button>
          <button class="prod-del" onclick="renderCliProductsTable(clients.find(x=>x.id===currentCliId))"><i class="bi bi-x-lg"></i></button>
        </td>
      </tr>`;
    }
    return `<tr>
      <td style="padding:7px 10px">
        <div style="font-size:13px;font-weight:500;display:flex;align-items:center;gap:6px">
          <span>${escapeHtml(p.name)}</span>
          ${isGlobal ? '<span class="badge" style="font-size:9.5px;padding:1px 5px;background:rgba(22,163,74,0.12);color:var(--green)">Geral</span>' : ''}
        </div>
        ${p.desc?`<div style="font-size:11px;color:var(--text3);margin-top:2px;line-height:1.4">${escapeHtml(p.desc)}</div>`:''}
      </td>
      <td style="padding:7px 10px;font-family:'Outfit',sans-serif;font-weight:700;font-size:13.5px;color:var(--green);text-align:right">${fmt(p.price)}</td>
      <td style="padding:7px 10px;text-align:right;white-space:nowrap">
        <button class="prod-del" onclick="editProdCli(${p.id})" title="Editar"><i class="bi bi-pencil" style="font-size:12px"></i></button>
        <button class="prod-del" onclick="removeProdFromCli(${p.id})" title="Excluir"><i class="bi bi-trash3" style="font-size:12px"></i></button>
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
  const newName=document.getElementById('epName_'+id)?.value.trim();
  const newDesc=document.getElementById('epDesc_'+id)?.value.trim();
  const newPriceStr=document.getElementById('epPrice_'+id)?.value.trim();
  if(!newPriceStr)return showToast('Preço inválido','warning');
  const newPrice=parseCurrencyInput(newPriceStr);
  if(!newName)return showToast('Nome não pode ser vazio','warning');

  // Atualiza em cl.products se existir
  if (Array.isArray(cl.products)) {
    const p=cl.products.find(x=>x.id===id);
    if (p) { p.name=newName; p.price=newPrice; p.desc=newDesc; }
  }

  // Atualiza em services se existir
  if (Array.isArray(services)) {
    const s = services.find(x => x.id === id);
    if (s) { s.name=newName; s.price=newPrice; s.desc=newDesc; }
  }

  renderCliProductsTable(cl);renderCliList();scheduleSync();showToast('Serviço atualizado!','success');
}

function addProdToCli(){
  const n=document.getElementById('newProdName').value.trim();
  const desc=document.getElementById('newProdDesc').value.trim();
  const prStr=document.getElementById('newProdPrice').value.trim();
  if(!n||!prStr)return showToast('Preencha nome e preço','warning');
  const pr=parseCurrencyInput(prStr);
  const cl=clients.find(x=>x.id===currentCliId);if(!cl)return;
  
  const newId = Date.now();
  if(!cl.products)cl.products=[];
  cl.products.push({id:newId,name:n,price:pr,desc});
  
  if(!Array.isArray(services)) services = [];
  services.push({
    id: newId,
    name: n,
    category: 'Geral',
    price: pr,
    desc: desc,
    targetType: 'selected',
    clientIds: [cl.id],
    createdAt: Date.now()
  });

  document.getElementById('newProdName').value='';document.getElementById('newProdPrice').value='';document.getElementById('newProdDesc').value='';
  renderCliProductsTable(cl);renderCliList();scheduleSync();showToast('Item adicionado!','success');
}

function removeProdFromCli(id){
  const cl=clients.find(x=>x.id===currentCliId);if(!cl)return;
  if(Array.isArray(cl.products)) cl.products=cl.products.filter(p=>p.id!==id);
  if(Array.isArray(services)) {
    const s = services.find(x => x.id === id);
    if (s && s.targetType === 'selected') {
      s.clientIds = (s.clientIds || []).filter(cid => cid !== cl.id);
      if (s.clientIds.length === 0) {
        services = services.filter(x => x.id !== id);
      }
    }
  }
  renderCliProductsTable(cl);renderCliList();scheduleSync();
}
