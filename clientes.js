// ══════════════════════════════════════════
//  CRM - CLIENTES LOGIC
// ══════════════════════════════════════════
function initPage() {
  renderCliList();
  document.getElementById('cliDetail').classList.add('d-none');
  document.getElementById('cliPlaceholder').style.display = 'flex';
  currentCliId = null;
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
  el.innerHTML=pageItems.map(c=>`<div class="cli-item ${currentCliId===c.id?'on':''}" onclick="selectClient(${c.id})"><span><i class="bi bi-person"></i> ${c.name}</span><span style="font-size:11px;color:var(--text3)">${c.products?.length||0} itens</span></div>`).join('');
}

function createClient(){
  const inp=document.getElementById('newCliName'),name=inp.value.trim();
  if(!name)return showToast('Digite o nome','warning');
  if(clients.find(c=>c.name.toLowerCase()===name.toLowerCase()))return showToast('Cliente já existe','warning');
  const cl={id:Date.now(),name,products:[],token:genTokenStr()};clients.push(cl);inp.value='';
  renderCliList();selectClient(cl.id);scheduleSync();showToast('Cliente cadastrado!','success');
}

function selectClient(id){
  currentCliId=id;const cl=clients.find(x=>x.id===id);if(!cl)return;
  if(!cl.token){cl.token=genTokenStr();scheduleSync();}
  document.getElementById('cliDetail').classList.remove('d-none');document.getElementById('cliPlaceholder').style.display='none';
  document.getElementById('cliDetailName').textContent=cl.name;document.getElementById('cliToken').value=cl.token;
  document.getElementById('cliPhone').value=cl.phone||'';
  document.getElementById('cliAddress').value=cl.address||'';
  document.getElementById('cliEmail').value=cl.email||'';
  document.getElementById('cliDoc').value=formatDocMask(cl.doc||'');
  document.getElementById('cliDoc').classList.remove('inp-invalid');
  document.getElementById('tokenOkMsg').classList.add('d-none');
  document.getElementById('contactOkMsg').classList.add('d-none');
  updateCliLink(cl);renderCliProductsTable(cl);renderCliList();
  document.getElementById('cliDeleteBtn').onclick=()=>{
    showConfirm(`Remover "${cl.name}"?`, () => {
      clients=clients.filter(x=>x.id!==id);
      initPage();scheduleSync();showToast('Cliente removido','info');
    });
  };
}

function updateCliLink(cl){document.getElementById('cliLinkBox').textContent=cl.token?buildLink(cl.name,cl.token):'⚠️ Defina um token';}

function saveClientContact(){
  const cl=clients.find(x=>x.id===currentCliId);if(!cl)return;
  cl.phone=document.getElementById('cliPhone').value.trim();
  cl.address=document.getElementById('cliAddress').value.trim();
  cl.email=document.getElementById('cliEmail').value.trim();
  cl.doc=document.getElementById('cliDoc').value.trim();
  scheduleSync();
  const ok=document.getElementById('contactOkMsg');ok.classList.remove('d-none');
  setTimeout(()=>ok.classList.add('d-none'),2500);
  showToast('Contato salvo!','success');
}

function saveToken(){
  const cl=clients.find(x=>x.id===currentCliId);if(!cl)return;
  const t=document.getElementById('cliToken').value.trim();if(!t)return showToast('Digite o token','warning');
  if(/[\s&?#]/.test(t))return showToast('Sem espaços ou & ? #','warning');
  cl.token=t;updateCliLink(cl);renderCliList();
  document.getElementById('tokenOkMsg').classList.remove('d-none');setTimeout(()=>document.getElementById('tokenOkMsg').classList.add('d-none'),3000);
  scheduleSync();showToast('Token salvo!','success');
}

function genToken(){document.getElementById('cliToken').value=genTokenStr();showToast('Gere e clique em Salvar','info');}

function copyCliLink(){
  const text = document.getElementById('cliLinkBox').textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Link copiado!', 'success');
  }).catch(() => {
    const dummy = document.createElement('textarea');
    document.body.appendChild(dummy);
    dummy.value = text;
    dummy.select();
    document.execCommand('copy');
    document.body.removeChild(dummy);
    showToast('Link copiado!', 'success');
  });
}

function renderCliProductsTable(cl,editingId=null){
  const tb=document.getElementById('cliProdList');
  if(!tb) return;
  if(!cl.products?.length){tb.innerHTML='<tr><td colspan="4"><div class="empty-state" style="padding:16px"><i class="bi bi-table"></i><span>Tabela vazia</span></div></td></tr>';return;}
  tb.innerHTML=cl.products.map(p=>{
    if(p.id===editingId){
      return `<tr style="background:var(--accent-bg)">
        <td style="padding:5px 8px">
          <input id="epName_${p.id}" class="inp inp-sm" value="${p.name}" style="width:100%;margin-bottom:4px">
          <input id="epDesc_${p.id}" class="inp inp-sm" value="${p.desc||''}" placeholder="Descrição (opcional)" style="width:100%;font-size:11.5px">
        </td>
        <td style="padding:5px 8px"><input id="epPrice_${p.id}" type="number" class="inp inp-sm" value="${p.price}" step="0.01" style="width:90px"></td>
        <td style="padding:5px 8px;text-align:right;white-space:nowrap">
          <button class="btn btn-primary btn-sm" onclick="saveProdEdit(${p.id})"><i class="bi bi-check2"></i></button>
          <button class="prod-del" onclick="renderCliProductsTable(clients.find(x=>x.id===currentCliId))"><i class="bi bi-x-lg"></i></button>
        </td>
      </tr>`;
    }
    return `<tr>
      <td style="padding:7px 10px">
        <div style="font-size:13px;font-weight:500">${p.name}</div>
        ${p.desc?`<div style="font-size:11px;color:var(--text3);margin-top:2px;line-height:1.4">${p.desc}</div>`:''}
      </td>
      <td style="padding:7px 10px;font-family:'Courier New',monospace;font-weight:700;color:var(--green)">${fmt(p.price)}</td>
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
  const p=cl.products.find(x=>x.id===id);if(!p)return;
  const newName=document.getElementById('epName_'+id)?.value.trim();
  const newDesc=document.getElementById('epDesc_'+id)?.value.trim();
  const newPrice=parseFloat(document.getElementById('epPrice_'+id)?.value);
  if(!newName)return showToast('Nome não pode ser vazio','warning');
  if(isNaN(newPrice)||newPrice<0)return showToast('Preço inválido','warning');
  p.name=newName;p.price=newPrice;p.desc=newDesc;
  renderCliProductsTable(cl);renderCliList();scheduleSync();showToast('Serviço atualizado!','success');
}

function addProdToCli(){
  const n=document.getElementById('newProdName').value.trim(),pr=parseFloat(document.getElementById('newProdPrice').value);
  const desc=document.getElementById('newProdDesc').value.trim();
  if(!n||isNaN(pr))return showToast('Preencha nome e preço','warning');
  const cl=clients.find(x=>x.id===currentCliId);if(!cl)return;
  if(!cl.products)cl.products=[];cl.products.push({id:Date.now(),name:n,price:pr,desc});
  document.getElementById('newProdName').value='';document.getElementById('newProdPrice').value='';document.getElementById('newProdDesc').value='';
  renderCliProductsTable(cl);renderCliList();scheduleSync();showToast('Item adicionado!','success');
}

function removeProdFromCli(id){
  const cl=clients.find(x=>x.id===currentCliId);if(!cl)return;
  cl.products=cl.products.filter(p=>p.id!==id);
  renderCliProductsTable(cl);renderCliList();scheduleSync();
}
