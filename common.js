// ══════════════════════════════════════════
//  GLOBAL STATE & CONFIG
// ══════════════════════════════════════════
const INIT_COLS=[
  {id:'Briefing',icon:'bi-clipboard',color:'#92623a'},
  {id:'Desenvolvimento',icon:'bi-pencil',color:'#ea580c'},
  {id:'Revisão',icon:'bi-search',color:'#2563eb'},
  {id:'Obra',icon:'bi-hammer',color:'#d97706'},
  {id:'Concluído',icon:'bi-check-circle',color:'#16a34a',isFinal:true}
];
const DEFAULT_COL_COLOR='#92623a';
const DEFAULT_COL_ICON='bi-folder';

// Observações padrão do orçamento — editável pelo usuário (Configurar > Observações Padrão).
// Esses 3 textos abaixo são só o valor inicial, pra quem já usava o sistema não perder nada.
const INIT_NOTE_TEMPLATES=[
  {id:'padrao',title:'Padrão MAVIC (50% entrada + 50% entrega, prod. a consultar)',text:`1. FORMA DE PAGAMENTO:
• 50% no ato do pedido e 50% no ato da entrega.
• Pagamento em mais vezes consultar.
TEMPO DE PRODUÇÃO:
• A consultar.
2. PRODUÇÃO:
• Os itens acima fazem parte de um orçamento ao todo, não sendo possível a execução de somente um item ou mais separadamente.
• Os Itens com * se torna opcional, porém se torna necessário realizar os anteriores.`},
  {id:'vista',title:'Pagamento à Vista (100% no pedido, 5% desconto)',text:`1. FORMA DE PAGAMENTO:
• 100% no ato do pedido (com 5% de desconto incluso).
TEMPO DE PRODUÇÃO:
• A consultar.`},
  {id:'parcelado',title:'Parcelado (40% entrada + 3x sem juros no cartão)',text:`1. FORMA DE PAGAMENTO:
• Entrada de 40% + saldo em até 3x sem juros no cartão de crédito.
TEMPO DE PRODUÇÃO:
• A consultar.`}
];
let noteTemplates=[];

// Tipos de projeto — editável (Configurações > Gerenciar Tipos de Projeto).
// Cores replicam as que já existiam fixas no CSS, pra não mudar nada visualmente
// pra quem já usava. Tipos novos ganham a cor escolhida na hora de cadastrar.
const INIT_PROJECT_TYPES=[
  {id:'Residencial',color:'#2563eb',defaultFolders:['01. Documentos','02. Plantas','03. Executivo','04. Renders','04. Renders/01. Prints','05. Outros']},
  {id:'Comercial',color:'#7c3aed',defaultFolders:['01. Documentos','02. Plantas','03. Executivo','04. Aprovações','05. Renders','05. Renders/01. Prints','06. Outros']},
  {id:'Prefeitura',color:'#0d9488',defaultFolders:['01. Documentos','02. Prefeitura','03. Renders','03. Renders/01. Prints','04. Outros']},
  {id:'Render',color:'#db2777',defaultFolders:['01. Renders','01. Renders/01. Prints']},
  {id:'Estrutural',color:'#d97706',defaultFolders:['01. Documentos','02. Calculo','03. Desenhos','04. Relatorios']},
  {id:'Urbanismo',color:'#059669',defaultFolders:['01. Documentos','02. Topografia','03. Masterplan','04. Renders','04. Renders/01. Prints']},
  {id:'Outro',color:'#71717a',defaultFolders:['01. Documentos','02. Renders','02. Renders/01. Prints','03. Outros']}
];
let projectTypes=[];
function typeColor(typeId){
  const t=(typeof projectTypes!=='undefined'&&projectTypes.length?projectTypes:INIT_PROJECT_TYPES).find(x=>x.id===typeId);
  return t?t.color:'#71717a';
}
function hexToRgba(hex,alpha){
  const h=(hex||'#71717a').replace('#','');
  const full=h.length===3?h.split('').map(c=>c+c).join(''):h;
  const r=parseInt(full.slice(0,2),16)||113,g=parseInt(full.slice(2,4),16)||113,b=parseInt(full.slice(4,6),16)||113;
  return `rgba(${r},${g},${b},${alpha})`;
}
function typeBg(typeId){ return hexToRgba(typeColor(typeId),0.13); }
function getProjectDefaultFolders(typeId){
  const low=(typeId||'').toLowerCase().trim();
  const allTypes=(typeof projectTypes!=='undefined'&&projectTypes.length?projectTypes:INIT_PROJECT_TYPES);
  const found=allTypes.find(x=>(x.id||'').trim().toLowerCase()===low);
  if(found && Array.isArray(found.defaultFolders) && found.defaultFolders.length){
    return found.defaultFolders;
  }

  if(low.includes('render')){
    return ['01. Renders','01. Renders/01. Prints'];
  }
  if(low.includes('prefeit')){
    return ['01. Documentos','02. Prefeitura','03. Renders','03. Renders/01. Prints','04. Outros'];
  }
  if(low.includes('residenc')||low.includes('interiores')){
    return ['01. Documentos','02. Plantas','03. Executivo','04. Renders','04. Renders/01. Prints','05. Outros'];
  }
  if(low.includes('comercial')){
    return ['01. Documentos','02. Plantas','03. Executivo','04. Aprovações','05. Renders','05. Renders/01. Prints','06. Outros'];
  }
  if(low.includes('estrutur')){
    return ['01. Documentos','02. Calculo','03. Desenhos','04. Relatorios'];
  }
  if(low.includes('urbanis')){
    return ['01. Documentos','02. Topografia','03. Masterplan','04. Renders','04. Renders/01. Prints'];
  }

  return ['01. Documentos','02. Renders','02. Renders/01. Prints','03. Outros'];
}
function populateProjectTypeSelects(){
  const opts=(projectTypes.length?projectTypes:INIT_PROJECT_TYPES).map(t=>`<option value="${t.id}">${t.id}</option>`).join('');
  document.querySelectorAll('.project-type-select').forEach(sel=>{
    const cur=sel.value;
    const hasEmpty=sel.querySelector('option[value=""]');
    sel.innerHTML=(hasEmpty?hasEmpty.outerHTML:'')+opts;
    if(cur) sel.value=cur;
  });
}

// ══════════════════════════════════════════
//  LAZY LOADER: HTML2PDF (Carrega sob demanda)
// ══════════════════════════════════════════
// Opções de captura usadas por TODOS os PDFs do app.
// scrollX/scrollY zerados são obrigatórios: o html2pdf renderiza o conteúdo dentro
// de um container `position:fixed`, e sem isso o html2canvas soma o scroll da página
// ao recorte, capturando uma área vazia — o PDF sai totalmente em branco sempre que
// a página está rolada (o que é a regra no mobile, onde a lista é longa).
function pdfCanvasOpts(extra) {
  return Object.assign({
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0
  }, extra || {});
}

function loadHtml2Pdf() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="html2pdf"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.html2pdf));
      existing.addEventListener('error', () => reject(new Error('Erro ao carregar motor de PDF')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    script.onload = () => resolve(window.html2pdf);
    script.onerror = () => reject(new Error('Não foi possível carregar o motor de PDF. Verifique a conexão com a internet.'));
    document.head.appendChild(script);
  });
}

// Detecta se o dispositivo é mobile / touchscreen
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
}

// Compartilha o PDF no mobile via Web Share API (WhatsApp, Email, Imprimir...) ou abre/baixa no desktop
async function shareOrOpenPdfBlob(pdfBlob, filename, { title = '', text = '', previewTab = null } = {}) {
  const isMobile = isMobileDevice();
  const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

  // No mobile, tenta abrir a folha nativa de compartilhamento (WhatsApp, Email, Imprimir, Salvar...)
  if (isMobile && typeof navigator.share === 'function') {
    let canShareFile = false;
    try {
      canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [pdfFile] });
    } catch (e) {
      canShareFile = false;
    }

    if (canShareFile) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: title || filename.replace(/\.pdf$/i, ''),
          text: text || title || ''
        });
        showToast('Recibo pronto!', 'success');
        return;
      } catch (err) {
        if (err.name === 'AbortError') {
          // Usuário apenas cancelou ou fechou o menu de compartilhamento
          return;
        }
        console.warn('Falha no Web Share, aplicando fallback:', err);
      }
    }
  }

  // Fallback: visualização na nova aba (desktop) ou download direto (mobile sem suporte ao Web Share)
  const blobUrl = URL.createObjectURL(pdfBlob);
  if (previewTab && !previewTab.closed) {
    previewTab.location.href = blobUrl;
    showToast('PDF gerado! Confira a pré-visualização na nova aba.', 'success');
  } else if (isMobile) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    showToast('PDF gerado!', 'success');
  } else {
    window.open(blobUrl, '_blank');
    showToast('PDF gerado!', 'success');
  }
}

// ══════════════════════════════════════════
//  SUPABASE STORAGE & IMAGE COMPRESSION
// ══════════════════════════════════════════
// Comprime imagens antes do upload para economizar banda e agilizar carregamento
async function compressImageForUpload(file, maxWidth = 1600, quality = 0.82) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compFile = new File([blob], (file.name || 'imagem.jpg').replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// Faz upload de arquivos/imagens diretamente para o bucket 'mavic_files' no Supabase Storage
async function uploadToSupabaseStorage(file, folder = 'uploads') {
  if (!sb || !sb.storage) {
    throw new Error('Supabase Storage não está disponível.');
  }

  // Comprime imagens antes de subir para a nuvem
  let fileToUpload = file;
  if (file.type && file.type.startsWith('image/')) {
    try {
      fileToUpload = await compressImageForUpload(file, 1600, 0.82);
    } catch(e) {
      console.warn('Falha na compressão da imagem:', e);
    }
  }

  const cleanName = (file.name || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${cleanName}`;

  const { data, error } = await sb.storage.from('mavic_files').upload(path, fileToUpload, {
    cacheControl: '31536000',
    upsert: true
  });

  if (error) {
    console.error('Supabase Storage upload error:', error);
    throw error;
  }

  const { data: urlData } = sb.storage.from('mavic_files').getPublicUrl(path);
  return urlData?.publicUrl || '';
}

// Uma coluna conta como "concluída" se estiver marcada com isFinal.
// Compatibilidade: configs salvas antes desse campo existir caem no nome
// literal "Concluído", pra não quebrar dados já sincronizados.
// Isso só afeta contadores de relatório e o badge de prioridade — o projeto
// ainda aparece normalmente pro cliente (ex: pode estar concluído mas não
// aprovado/pago ainda).
function isFinalColumn(colId){
  const col=(typeof appColumns!=='undefined'?appColumns:INIT_COLS).find(c=>c.id===colId);
  if(!col) return colId==='Concluído';
  return col.isFinal===true || (col.isFinal===undefined && col.id==='Concluído');
}

// Coluna "encerrada": o projeto já foi entregue/pago e não precisa mais
// aparecer pro cliente. É um conceito diferente de isFinal (que é só pra
// relatórios) — marcado com hideClient, com fallback pro nome "Finalizado".
// Também dispara o cartão compacto no quadro (estilo "Arquivados").
function isHiddenColumn(colId){
  const col=(typeof appColumns!=='undefined'?appColumns:INIT_COLS).find(c=>c.id===colId);
  if(!col) return colId==='Finalizado';
  return col.hideClient===true || (col.hideClient===undefined && col.id==='Finalizado');
}

function parseDateSafe(dStr) {
  if (!dStr) return null;
  const str = String(dStr).trim();
  if (!str) return null;
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const dt = new Date(y, m, d, 12, 0, 0);
      return isNaN(dt.getTime()) ? null : dt;
    }
  }
  const clean = str.includes('T') ? str : str + 'T12:00:00';
  const dt = new Date(clean);
  return isNaN(dt.getTime()) ? null : dt;
}

function formatDateSafe(dStr) {
  const dt = parseDateSafe(dStr);
  return dt ? dt.toLocaleDateString('pt-BR') : (dStr || '—');
}

// ══════════════════════════════════════════
//  MÁSCARA DE CPF/CNPJ
// ══════════════════════════════════════════
// Detecta automaticamente CPF (11 dígitos, 000.000.000-00) ou CNPJ (14 dígitos, 00.000.000/0000-00)
function formatDocMask(v){
  if(!v) return '';
  let d=String(v).replace(/\D/g,'').slice(0,14);
  if(!d) return v;
  if(d.length<=11){
    d=d.replace(/(\d{3})(\d)/,'$1.$2');
    d=d.replace(/(\d{3})(\d)/,'$1.$2');
    d=d.replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  }else{
    d=d.replace(/(\d{2})(\d)/,'$1.$2');
    d=d.replace(/(\d{3})(\d)/,'$1.$2');
    d=d.replace(/(\d{3})(\d)/,'$1/$2');
    d=d.replace(/(\d{4})(\d{1,2})$/,'$1-$2');
  }
  return d;
}
function maskDocInput(el){ el.value=formatDocMask(el.value); }

function formatPhoneMask(v) {
  if (!v) return '';
  const d = String(v).replace(/\D/g, '');
  if (d.length > 11) return d.substring(0, 11).replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  } else {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  }
}
function maskPhoneInput(el){ if(el) el.value = formatPhoneMask(el.value); }

function insertWaVar(varTag) {
  const ta = document.getElementById('waTemplate');
  if (!ta) return;
  const start = ta.selectionStart || 0;
  const end = ta.selectionEnd || 0;
  const val = ta.value;
  ta.value = val.substring(0, start) + varTag + val.substring(end);
  ta.selectionStart = ta.selectionEnd = start + varTag.length;
  ta.focus();
}

function formatWaMsgText(symbol) {
  const ta = document.getElementById('waMsg');
  if (!ta) return;
  const start = ta.selectionStart || 0;
  const end = ta.selectionEnd || 0;
  const selected = ta.value.substring(start, end);
  if (selected) {
    const replacement = `${symbol}${selected}${symbol}`;
    ta.value = ta.value.substring(0, start) + replacement + ta.value.substring(end);
    ta.selectionStart = start;
    ta.selectionEnd = start + replacement.length;
  } else {
    const replacement = `${symbol}texto${symbol}`;
    ta.value = ta.value.substring(0, start) + replacement + ta.value.substring(end);
    ta.selectionStart = start + 1;
    ta.selectionEnd = start + 6;
  }
  ta.focus();
}

// Validação de dígito verificador (algoritmo padrão mod11). Campo vazio não é erro —
// o CPF/CNPJ é opcional em vários formulários daqui.
function isValidCPF(v){
  const d=String(v).replace(/\D/g,'');
  if(d.length!==11||/^(\d)\1{10}$/.test(d)) return false;
  let sum=0; for(let i=0;i<9;i++) sum+=parseInt(d[i])*(10-i);
  let r=(sum*10)%11; if(r===10) r=0;
  if(r!==parseInt(d[9])) return false;
  sum=0; for(let i=0;i<10;i++) sum+=parseInt(d[i])*(11-i);
  r=(sum*10)%11; if(r===10) r=0;
  return r===parseInt(d[10]);
}
function isValidCNPJ(v){
  const d=String(v).replace(/\D/g,'');
  if(d.length!==14||/^(\d)\1{13}$/.test(d)) return false;
  const calc=base=>{
    const w=base.length===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2];
    let sum=0; for(let i=0;i<base.length;i++) sum+=parseInt(base[i])*w[i];
    const r=sum%11; return r<2?0:11-r;
  };
  if(calc(d.slice(0,12))!==parseInt(d[12])) return false;
  return calc(d.slice(0,13))===parseInt(d[13]);
}
function isValidDoc(v){
  const d=String(v||'').replace(/\D/g,'');
  if(!d) return true;
  if(d.length===11) return isValidCPF(d);
  if(d.length===14) return isValidCNPJ(d);
  return false;
}
function checkDocValidity(el){
  const v=el.value.trim();
  if(!v||isValidDoc(v)){ el.classList.remove('inp-invalid'); return; }
  el.classList.add('inp-invalid');
  showToast('CPF/CNPJ parece inválido — confira os números digitados.','info');
}
const COL_ICONS=[
  {v:'bi-clipboard',l:'Clipboard'},{v:'bi-pencil',l:'Lápis'},{v:'bi-search',l:'Lupa'},{v:'bi-hammer',l:'Martelo'},
  {v:'bi-check-circle',l:'Check'},{v:'bi-flag',l:'Bandeira'},{v:'bi-folder',l:'Pasta'},{v:'bi-chat-dots',l:'Chat'},
  {v:'bi-star',l:'Estrela'},{v:'bi-bookmark',l:'Marcador'},{v:'bi-lightning',l:'Urgente'},{v:'bi-send',l:'Envio'}
];
// Mensagens rápidas do aviso ao cliente — editável (Board > Avisar cliente > engrenagem).
// Esses 6 textos são só o valor inicial, pra quem já usava não perder nada.
const INIT_QUICK_MSGS=[
  { title: "Andamento do Projeto", msg: "Projeto em andamento! Em breve temos novidades." },
  { title: "Aprovação Necessária", msg: "Precisamos de sua aprovação para avançar." },
  { title: "Documentos Pendentes", msg: "Documentos pendentes — por favor entre em contato." },
  { title: "Etapa Concluída", msg: "Etapa concluída com sucesso! ✅" },
  { title: "Pagamento Confirmado", msg: "Pagamento confirmado. Obrigado!" },
  { title: "Prazo Atualizado", msg: "Prazo atualizado. Verifique as datas no painel." }
];
let quickMsgs=[];
const DEFAULT_WA_TEMPLATE = `Olá, *{Cliente}*!

*{Projeto}*

*Etapa:* {Etapa}
*Prazo:* {Prazo}
*Valor contratado:* {ValorTotal}
*Pago:* {ValorPago} | *Pendente:* {SaldoPendente}
{TarefaAtual}
{Observacao}

_Equipe MAVIC Projetos_`;

if (localStorage.getItem('mavic_waTemplate') === null) {
  localStorage.setItem('mavic_waTemplate', DEFAULT_WA_TEMPLATE);
}

let sb=null, projects=[], clients=[], appColumns=[...INIT_COLS], budgets=[], services=[];
let globalNotices=[];
let visibleColumns=INIT_COLS.map(c=>c.id), minimizedColumns=[], colSorts={};
let notifications=[], appTheme='light', currentView='board';
let tempSubs=[], tempPayments=[], tempProds=[], tempInstallments=[], tempPaymentCondition='';
let tempOrcItems=[];
let pinnedCards=new Set(), expandedFin=new Set();
let openGnIds = new Set();
let isDragging=false, currentCliId=null, notifyProjId=null;
let syncTimer=null;
window.CLIENT_PANEL_URL=localStorage.getItem('mavic_clientUrl')||'cliente.html';
// Compartilhado por todas as páginas que geram/copiam o link do cliente
// (Board, Clientes, etc.) — antes só existia em clientes.js, quebrando
// os botões de WhatsApp/compartilhar em páginas que não carregam esse arquivo.
function genTokenStr(){return Math.random().toString(36).substring(2,10)+Math.random().toString(36).substring(2,6);}
function buildLink(name,token){return `${window.CLIENT_PANEL_URL}?nome=${encodeURIComponent(name)}&token=${token}`;}
if(localStorage.getItem('mavic_pixKey')===null){
  localStorage.setItem('mavic_pixKey','350.605.018-41');
  localStorage.setItem('mavic_pixName','Victor Lourenço Pereira');
  localStorage.setItem('mavic_pixBank','Nu Pagamentos');
}

// Determine active view based on filename
const currentPath = window.location.pathname;
if (currentPath.includes('dashboard.html')) {
  currentView = 'dashboard';
} else if (currentPath.includes('orcamento.html')) {
  currentView = 'orcamentos';
} else if (currentPath.includes('pagamentos.html')) {
  currentView = 'pagamentos';
} else if (currentPath.includes('servicos.html')) {
  currentView = 'servicos';
} else if (currentPath.includes('relatorio.html')) {
  currentView = 'relatorios';
} else if (currentPath.includes('clientes.html')) {
  currentView = 'clientes';
} else {
  currentView = 'board';
}

function getServicesForClient(clientId) {
  const cid = clientId ? (typeof clientId === 'number' ? clientId : parseInt(clientId)) : null;
  return (services || []).filter(s => {
    if (!s.targetType || s.targetType === 'all') return true;
    if (s.targetType === 'selected') {
      if (!cid) return true;
      const ids = Array.isArray(s.clientIds) ? s.clientIds.map(Number) : [];
      return ids.includes(cid);
    }
    return true;
  });
}

function safeParsePrice(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^\d.,]/g, '').trim();
    if (!cleaned) return 0;
    if (cleaned.includes(',')) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(cleaned) || 0;
  }
  return 0;
}

function checkAndMigrateLegacyProducts() {
  if (!Array.isArray(services)) services = [];
  let updated = false;
  let migratedCount = 0;

  // 1. Sincroniza produtos cadastrados nos Clientes
  (clients || []).forEach(cl => {
    let prods = cl.products;
    if (typeof prods === 'string') {
      try { prods = JSON.parse(prods); } catch(e) { prods = []; }
    }
    if (Array.isArray(prods)) {
      prods.forEach(p => {
        if (!p) return;
        const pNameTrim = (p.name || p.desc || p.title || '').trim();
        if (!pNameTrim) return;
        const priceNum = safeParsePrice(p.price);
        const existing = services.find(s => (s.name || '').trim().toLowerCase() === pNameTrim.toLowerCase());
        if (existing) {
          if (!Array.isArray(existing.clientIds)) existing.clientIds = [];
          if (cl.id && !existing.clientIds.includes(cl.id)) {
            existing.clientIds.push(cl.id);
            updated = true;
          }
          if ((!existing.price || existing.price === 0) && priceNum > 0) {
            existing.price = priceNum;
            updated = true;
          }
          if (!existing.desc && p.desc) {
            existing.desc = p.desc;
            updated = true;
          }
        } else {
          services.push({
            id: p.id || (Date.now() + migratedCount),
            name: pNameTrim,
            category: 'Geral',
            price: priceNum,
            desc: p.desc || '',
            targetType: 'selected',
            clientIds: cl.id ? [cl.id] : [],
            createdAt: Date.now()
          });
          migratedCount++;
          updated = true;
        }
      });
    }
  });

  // 2. Sincroniza produtos cadastrados em Projetos legados
  (projects || []).forEach(proj => {
    let prods = proj.products;
    if (typeof prods === 'string') {
      try { prods = JSON.parse(prods); } catch(e) { prods = []; }
    }
    if (Array.isArray(prods)) {
      prods.forEach(p => {
        if (!p) return;
        const pNameTrim = (p.name || p.desc || p.title || '').trim();
        if (!pNameTrim) return;
        const priceNum = safeParsePrice(p.price);
        const existing = services.find(s => (s.name || '').trim().toLowerCase() === pNameTrim.toLowerCase());
        if (!existing) {
          const matchedCli = (clients || []).find(c => (c.name || '').trim().toLowerCase() === (proj.client || '').trim().toLowerCase());
          services.push({
            id: p.id || (Date.now() + migratedCount),
            name: pNameTrim,
            category: 'Geral',
            price: priceNum,
            desc: p.desc || '',
            targetType: matchedCli ? 'selected' : 'all',
            clientIds: matchedCli ? [matchedCli.id] : [],
            createdAt: Date.now()
          });
          migratedCount++;
          updated = true;
        }
      });
    }
  });

  // 3. Sincroniza itens cadastrados em Orçamentos legados
  (budgets || []).forEach(b => {
    let items = b.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch(e) { items = []; }
    }
    if (Array.isArray(items)) {
      items.forEach(it => {
        if (!it) return;
        const itName = (it.desc || it.name || it.title || '').trim();
        if (!itName) return;
        const priceNum = safeParsePrice(it.price);
        const existing = services.find(s => (s.name || '').trim().toLowerCase() === itName.toLowerCase());
        if (!existing) {
          const matchedCli = (clients || []).find(c => (c.name || '').trim().toLowerCase() === (b.client || '').trim().toLowerCase());
          services.push({
            id: it.id || (Date.now() + migratedCount),
            name: itName,
            category: 'Geral',
            price: priceNum,
            desc: it.note || it.desc || '',
            targetType: matchedCli ? 'selected' : 'all',
            clientIds: matchedCli ? [matchedCli.id] : [],
            createdAt: Date.now()
          });
          migratedCount++;
          updated = true;
        }
      });
    }
  });

  if (updated) {
    syncLocal();
    scheduleSync();
  }
}

// ══════════════════════════════════════════
//  FINANCIAL DATA INTEGRITY & RECONCILIATION
// ══════════════════════════════════════════
function reconcileProjectFinancials(p) {
  if (!p) return false;
  let changed = false;

  // Garante que pagamentos seja um array válido
  if (typeof p.payments === 'string') {
    try { p.payments = JSON.parse(p.payments); changed = true; } catch(e) { p.payments = []; changed = true; }
  }
  if (!Array.isArray(p.payments)) {
    p.payments = [];
  }

  // Recalcula o total pago a partir do array de pagamentos real
  const calculatedPaid = p.payments.reduce((s, x) => s + parseFloat(x?.amount || 0), 0);
  if (parseFloat(p.paid || 0) !== calculatedPaid) {
    p.paid = calculatedPaid;
    changed = true;
  }

  // Se o projeto tiver cronograma de parcelas (installments)
  if (typeof p.installments === 'string') {
    try { p.installments = JSON.parse(p.installments); changed = true; } catch(e) { p.installments = []; }
  }

  if (Array.isArray(p.installments) && p.installments.length > 0) {
    const totalInstsVal = p.installments.reduce((s, inst) => s + parseFloat(inst?.amount || 0), 0);

    if (p.payments.length === 0 || calculatedPaid <= 0.001) {
      // Se não há nenhum pagamento registrado, TODAS as parcelas devem estar Pendentes
      p.installments.forEach(inst => {
        if (inst && inst.status === 'Pago') {
          inst.status = 'Pendente';
          delete inst.paidDate;
          delete inst.method;
          changed = true;
        }
      });
    } else if (calculatedPaid >= totalInstsVal - 0.01 || calculatedPaid >= parseFloat(p.value || 0) - 0.01) {
      // SE O TOTAL PAGO COBRE 100% DO PROJETO / PARCELAS (ex: Quitação total de 800 cobrindo 2x 400)
      // TODAS as parcelas devem ser marcadas como 'Pago'!
      const latestPay = p.payments[p.payments.length - 1] || {};
      p.installments.forEach(inst => {
        if (!inst) return;
        if (inst.status !== 'Pago') {
          inst.status = 'Pago';
          inst.paidDate = inst.paidDate || latestPay.date || today();
          inst.method = inst.method || latestPay.method || 'Pix';
          changed = true;
        }
      });
    } else {
      // Há pagamentos registrados: concilia cada parcela com os pagamentos existentes
      const usedPayIds = new Set();
      const unmatchedInsts = [];

      // 1. Match direto por ID, installmentId ou descrição
      p.installments.forEach(inst => {
        if (!inst) return;

        let matchingPay = p.payments.find(pay => pay && !usedPayIds.has(pay.id) && (
          (pay.installmentId && String(pay.installmentId) === String(inst.id)) ||
          String(pay.id) === String(inst.id) ||
          (pay.desc && inst.desc && pay.desc === inst.desc)
        ));

        if (matchingPay) {
          usedPayIds.add(matchingPay.id);
          if (inst.status !== 'Pago') {
            inst.status = 'Pago';
            inst.paidDate = matchingPay.date || today();
            inst.method = matchingPay.method || 'Pix';
            changed = true;
          }
        } else {
          unmatchedInsts.push(inst);
        }
      });

      // 2. Match por valor exato 1-para-1
      const stillUnmatched = [];
      unmatchedInsts.forEach(inst => {
        const matchingPay = p.payments.find(pay => pay && !usedPayIds.has(pay.id) && Math.abs(parseFloat(pay.amount || 0) - parseFloat(inst.amount || 0)) < 0.01);
        if (matchingPay) {
          usedPayIds.add(matchingPay.id);
          if (inst.status !== 'Pago') {
            inst.status = 'Pago';
            inst.paidDate = matchingPay.date || today();
            inst.method = matchingPay.method || 'Pix';
            changed = true;
          }
        } else {
          stillUnmatched.push(inst);
        }
      });

      // 3. Distribuição cumulativa para pagamentos agrupados/restantes
      let remainingPool = p.payments.filter(pay => !usedPayIds.has(pay.id)).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
      stillUnmatched.forEach(inst => {
        const instVal = parseFloat(inst.amount || 0);
        if (remainingPool >= instVal - 0.01 && instVal > 0) {
          remainingPool -= instVal;
          if (inst.status !== 'Pago') {
            const latestPay = p.payments[p.payments.length - 1] || {};
            inst.status = 'Pago';
            inst.paidDate = inst.paidDate || latestPay.date || today();
            inst.method = inst.method || latestPay.method || 'Pix';
            changed = true;
          }
        } else {
          // Não foi coberta: deve ser Pendente
          if (inst.status === 'Pago') {
            inst.status = 'Pendente';
            delete inst.paidDate;
            delete inst.method;
            changed = true;
          }
        }
      });
    }
  }

  return changed;
}

function reconcileAllProjectsFinancials() {
  if (!Array.isArray(projects)) return false;
  let anyChanged = false;
  projects.forEach(p => {
    if (reconcileProjectFinancials(p)) {
      anyChanged = true;
    }
  });
  if (anyChanged) {
    syncLocal();
  }
  return anyChanged;
}

// ══════════════════════════════════════════
//  ADMIN AUTHENTICATION & ACCESS GUARD
// ══════════════════════════════════════════
function getAdminSession() {
  try {
    const raw = localStorage.getItem('mavic_admin_session') || sessionStorage.getItem('mavic_admin_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || !session.expiresAt || session.expiresAt <= Date.now()) {
      localStorage.removeItem('mavic_admin_session');
      sessionStorage.removeItem('mavic_admin_session');
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}

function isAdminLoggedIn() {
  return getAdminSession() !== null;
}

function requireAdminAuth() {
  // Ignora página do cliente e página de login
  if (window.location.pathname.includes('cliente.html') || window.location.pathname.includes('login.html')) {
    return true;
  }
  if (!isAdminLoggedIn()) {
    const file = window.location.pathname.split('/').pop() || 'index.html';
    const query = window.location.search || '';
    const dest = file + query;
    window.location.replace('login.html?redirect=' + encodeURIComponent(dest));
    return false;
  }
  return true;
}

// Executa verificação imediata para telas administrativas
requireAdminAuth();

async function logoutAdmin() {
  showConfirm('Deseja realmente sair do painel administrativo?', async () => {
    if (sb && sb.auth) {
      try { await sb.auth.signOut(); } catch(e){}
    }
    localStorage.removeItem('mavic_admin_session');
    sessionStorage.removeItem('mavic_admin_session');
    showToast('Sessão encerrada', 'info');
    setTimeout(() => {
      window.location.replace('login.html');
    }, 250);
  }, { title: 'Encerrar Sessão', okText: 'Sair do Painel', danger: true });
}

// ══════════════════════════════════════════
//  SUPABASE CONNECTION & CACHE
// ══════════════════════════════════════════
function initSupabase(){
  const url=SB_URL,key=SB_KEY;
  if(url&&key){sb=window.supabase.createClient(url,key);return true;}
  return false;
}

let sbRealtimeSubscribed = false;
function setupSupabaseRealtime() {
  if (!sb || sbRealtimeSubscribed) return;
  try {
    sb.channel('mavic_store_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mavic_store' }, async (payload) => {
        const lastLocalSave = parseInt(sessionStorage.getItem('mavic_last_local_save') || '0', 10);
        if (Date.now() - lastLocalSave < 2500) return;

        try {
          const { data, error } = await sb.from('mavic_store').select('key,data');
          if (!error && data) {
            const map = {};
            data.forEach(r => map[r.key] = r.data);
            projects = map.projects || [];
            clients = map.clients || [];
            notifications = map.notifications || [];
            globalNotices = map.global_notices || (map.global_notice ? [map.global_notice] : []);
            budgets = map.budgets || [];
            services = map.services || [];
            checkAndMigrateLegacyProducts();
            reconcileAllProjectsFinancials();
            syncLocal();
            updateNavAlertBadges();

            if (typeof renderBoard === 'function') renderBoard();
            if (typeof renderDashboard === 'function') renderDashboard();
            if (typeof renderOrcamentos === 'function') renderOrcamentos();
            if (typeof renderPagamentos === 'function') { renderPagamentos(); if (typeof renderPendingInstallments === 'function') renderPendingInstallments(); }
            if (typeof renderServicos === 'function') { if (typeof updateServKPIs === 'function') updateServKPIs(); renderServicos(); }
            if (typeof renderRelatorios === 'function') renderRelatorios();
            if (typeof renderClientList === 'function') renderClientList();
          }
        } catch (e) {
          console.warn('[Realtime] Falha ao recarregar dados', e);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          sbRealtimeSubscribed = true;
        }
      });
  } catch (err) {
    console.warn('[Realtime] Falha ao configurar canal', err);
  }
}

function updateNavAlertBadges() {
  const active = (projects || []).filter(p => !p.archived && !isFinalColumn(p.column) && !isHiddenColumn(p.column) && p.date);
  const now = new Date().setHours(0, 0, 0, 0);
  const criticalCount = active.filter(p => {
    const dl = new Date(p.date + 'T12:00:00');
    const diff = Math.ceil((dl - now) / 86400000);
    return diff <= 2;
  }).length;

  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.textContent.includes('Dashboard') || tab.getAttribute('href') === 'dashboard.html') {
      let badge = tab.querySelector('.nav-alert-badge');
      if (criticalCount > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'nav-alert-badge';
          tab.appendChild(badge);
        }
        badge.textContent = criticalCount;
        badge.title = `${criticalCount} projeto(s) com prazo crítico ou vencido`;
      } else if (badge) {
        badge.remove();
      }
    }
  });

  document.querySelectorAll('.mtab-item').forEach(item => {
    if (item.getAttribute('href') === 'dashboard.html' || item.textContent.includes('Dashboard')) {
      let badge = item.querySelector('.nav-alert-badge');
      if (criticalCount > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'nav-alert-badge';
          badge.style.position = 'absolute';
          badge.style.top = '4px';
          badge.style.right = 'calc(50% - 16px)';
          item.style.position = 'relative';
          item.appendChild(badge);
        }
        badge.textContent = criticalCount;
      } else if (badge) {
        badge.remove();
      }
    }
  });
}

async function loadData(){
  let hasSb=false;
  try{hasSb=initSupabase();}catch(e){console.warn('initSupabase falhou',e);hasSb=false;}
  
  // Offline-first: if local storage has pending changes, load them and sync to cloud
  const pendingSync = localStorage.getItem('mavic_pending_sync') === 'true';
  if (pendingSync) {
    loadLocal();
    if (hasSb) {
      syncCloud(); // trigger cloud sync in background
      setupSupabaseRealtime();
    }
    return;
  }
  
  if(!hasSb){loadLocal();return;}
  try{
    const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),8000));
    const query=sb.from('mavic_store').select('key,data');
    const{data,error}=await Promise.race([query,timeout]);
    if(error)throw error;
    const map={};(data||[]).forEach(r=>map[r.key]=r.data);
    projects=map.projects||[];clients=map.clients||[];notifications=map.notifications||[];
    globalNotices=map.global_notices||(map.global_notice?[map.global_notice]:[]);
    budgets=map.budgets||[];
    services=map.services||[];
    checkAndMigrateLegacyProducts();
    reconcileAllProjectsFinancials();
    const cfg=map.config||{};
    appColumns=cfg.columns?.length?cfg.columns:INIT_COLS;
    visibleColumns=cfg.visibleColumns||appColumns.map(c=>c.id);
    minimizedColumns=cfg.minimizedColumns||[];
    noteTemplates=cfg.noteTemplates?.length?cfg.noteTemplates:INIT_NOTE_TEMPLATES;
    quickMsgs=cfg.quickMsgs?.length?cfg.quickMsgs:INIT_QUICK_MSGS;
    projectTypes=cfg.projectTypes?.length?cfg.projectTypes:INIT_PROJECT_TYPES;
    appTheme=cfg.theme||localStorage.getItem('mavic_theme')||'light';
    if(cfg.waTemplate!==undefined) localStorage.setItem('mavic_waTemplate',cfg.waTemplate);
    if(cfg.companyName!==undefined) localStorage.setItem('mavic_companyName',cfg.companyName);
    if(cfg.companyDoc!==undefined) localStorage.setItem('mavic_companyDoc',cfg.companyDoc);
    if(cfg.pixKey!==undefined) localStorage.setItem('mavic_pixKey',cfg.pixKey);
    if(cfg.pixName!==undefined) localStorage.setItem('mavic_pixName',cfg.pixName);
    if(cfg.pixBank!==undefined) localStorage.setItem('mavic_pixBank',cfg.pixBank);
    applyTheme(appTheme);syncLocal();
    updateNavAlertBadges();
    setupSupabaseRealtime();
  }catch(e){console.warn('Supabase load failed',e);loadLocal();showToast('Modo offline — dados locais','warning');}
}

function loadLocal(){
  projects=JSON.parse(localStorage.getItem('mavic_projects')||'[]') || [];
  clients=JSON.parse(localStorage.getItem('mavic_clients')||'[]') || [];
  notifications=JSON.parse(localStorage.getItem('mavic_notifications')||'[]') || [];
  globalNotices=JSON.parse(localStorage.getItem('mavic_global_notices')||'[]') || [];
  budgets=JSON.parse(localStorage.getItem('mavic_budgets')||'[]') || [];
  services=JSON.parse(localStorage.getItem('mavic_services')||'[]') || [];
  checkAndMigrateLegacyProducts();
  reconcileAllProjectsFinancials();
  const cfg=JSON.parse(localStorage.getItem('mavic_config')||'{}') || {};
  appColumns=cfg.columns?.length?cfg.columns:INIT_COLS;
  visibleColumns=cfg.visibleColumns||appColumns.map(c=>c.id);
  minimizedColumns=cfg.minimizedColumns||[];
  noteTemplates=cfg.noteTemplates?.length?cfg.noteTemplates:INIT_NOTE_TEMPLATES;
  quickMsgs=cfg.quickMsgs?.length?cfg.quickMsgs:INIT_QUICK_MSGS;
  projectTypes=cfg.projectTypes?.length?cfg.projectTypes:INIT_PROJECT_TYPES;
  if(cfg.waTemplate!==undefined) localStorage.setItem('mavic_waTemplate',cfg.waTemplate);
  if(cfg.companyName!==undefined) localStorage.setItem('mavic_companyName',cfg.companyName);
  if(cfg.companyDoc!==undefined) localStorage.setItem('mavic_companyDoc',cfg.companyDoc);
  if(cfg.pixKey!==undefined) localStorage.setItem('mavic_pixKey',cfg.pixKey);
  if(cfg.pixName!==undefined) localStorage.setItem('mavic_pixName',cfg.pixName);
  if(cfg.pixBank!==undefined) localStorage.setItem('mavic_pixBank',cfg.pixBank);
  applyTheme(localStorage.getItem('mavic_theme')||'light');
}

function syncLocal(){
  localStorage.setItem('mavic_projects',JSON.stringify(projects));
  localStorage.setItem('mavic_clients',JSON.stringify(clients));
  localStorage.setItem('mavic_notifications',JSON.stringify(notifications));
  localStorage.setItem('mavic_global_notices',JSON.stringify(globalNotices));
  localStorage.setItem('mavic_budgets',JSON.stringify(budgets));
  localStorage.setItem('mavic_services',JSON.stringify(services));
  localStorage.setItem('mavic_config',JSON.stringify({
    columns:appColumns,
    visibleColumns,
    minimizedColumns,
    noteTemplates,
    quickMsgs,
    projectTypes,
    waTemplate:localStorage.getItem('mavic_waTemplate')||'',
    companyName:localStorage.getItem('mavic_companyName')||'',
    companyDoc:localStorage.getItem('mavic_companyDoc')||'',
    pixKey:localStorage.getItem('mavic_pixKey')||'',
    pixName:localStorage.getItem('mavic_pixName')||'',
    pixBank:localStorage.getItem('mavic_pixBank')||''
  }));
  localStorage.setItem('mavic_theme',appTheme);
}

function scheduleSync(){
  sessionStorage.setItem('mavic_last_local_save', String(Date.now()));
  localStorage.setItem('mavic_pending_sync', 'true');
  syncLocal();
  clearTimeout(syncTimer);
  syncTimer=setTimeout(syncCloud,900);
}

async function syncCloud(){
  if(!sb){setSync('off');return;}
  setSync('sync');
  try{
    await sb.from('mavic_store').upsert([
      {key:'projects',data:projects},{key:'clients',data:clients},
      {key:'notifications',data:notifications},
      {key:'global_notices',data:globalNotices},
      {key:'budgets',data:budgets},
      {key:'services',data:services},
      {key:'config',data:{
        columns:appColumns,
        visibleColumns,
        minimizedColumns,
        noteTemplates,
        quickMsgs,
        projectTypes,
        theme:appTheme,
        waTemplate:localStorage.getItem('mavic_waTemplate')||'',
        companyName:localStorage.getItem('mavic_companyName')||'',
        companyDoc:localStorage.getItem('mavic_companyDoc')||'',
        pixKey:localStorage.getItem('mavic_pixKey')||'',
        pixName:localStorage.getItem('mavic_pixName')||'',
        pixBank:localStorage.getItem('mavic_pixBank')||''
      }}
    ],{onConflict:'key'});
    sessionStorage.setItem('mavic_last_local_save', String(Date.now()));
    localStorage.removeItem('mavic_pending_sync');
    setSync('ok');
    updateNavAlertBadges();
  }catch(e){setSync('off');}
}

function setSync(s){
  const el=document.getElementById('syncStatus');
  if(!el) return;
  if(s==='ok'){el.className='nav-sync ok';el.innerHTML='<i class="bi bi-cloud-check"></i> Sincronizado';}
  else if(s==='sync'){el.className='nav-sync sync';el.innerHTML='<i class="bi bi-arrow-repeat"></i> Sincronizando…';}
  else{el.className='nav-sync off';el.innerHTML='<i class="bi bi-cloud-slash"></i> Offline';}
}

// ══════════════════════════════════════════
//  THEME MANAGEMENT
// ══════════════════════════════════════════
function toggleTheme(){appTheme=appTheme==='light'?'dark':'light';applyTheme(appTheme);scheduleSync();}
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  document.documentElement.style.colorScheme = t;
  appTheme=t;
  try{localStorage.setItem('mavic_theme',t);}catch(e){}
  const btn=document.getElementById('themeBtn');
  const logo=document.getElementById('navLogo');
  if (btn) {
    if(t==='dark'){btn.innerHTML='<i class="bi bi-sun" style="color:#fbbf24"></i>';if(logo)logo.src='https://i.postimg.cc/vZmmNLjj/LOGO-NOVA-black.png';}
    else{btn.innerHTML='<i class="bi bi-moon-stars"></i>';if(logo)logo.src='LOGO NOVA.png';}
  }
}

// ══════════════════════════════════════════
//  TOAST & GENERAL HELPERS
// ══════════════════════════════════════════
function showToast(msg,type='success'){
  const wrap=document.getElementById('toastWrap');
  if(!wrap) return;
  const ic={success:'bi-check-circle',warning:'bi-exclamation-circle',error:'bi-x-circle',info:'bi-info-circle'};
  const cl={success:'var(--green)',warning:'var(--yellow)',error:'var(--red)',info:'var(--blue)'};
  const t=document.createElement('div');t.className='toast';
  t.style.cursor = 'pointer';
  t.style.position = 'relative';
  t.style.overflow = 'hidden';
  t.innerHTML=`<i class="bi ${ic[type]||ic.success}" style="color:${cl[type]||cl.success}"></i>
               <span>${msg}</span>
               <div class="toast-progress" style="position:absolute;bottom:0;left:0;height:3px;background:${cl[type]||cl.success};width:100%;transition:width 2.8s linear;"></div>`;
  
  let timer = setTimeout(()=>{
    t.classList.remove('show');
    setTimeout(()=>t.remove(),400);
  }, 2800);

  t.onclick=()=>{
    clearTimeout(timer);
    t.classList.remove('show');
    setTimeout(()=>t.remove(),400);
  };

  t.onmouseenter=()=>{
    clearTimeout(timer);
    const prog = t.querySelector('.toast-progress');
    if (prog) {
      const curWidth = prog.getBoundingClientRect().width;
      prog.style.transition = 'none';
      prog.style.width = curWidth + 'px';
    }
  };

  t.onmouseleave=()=>{
    const prog = t.querySelector('.toast-progress');
    if (prog) {
      prog.style.transition = 'width 2.8s linear';
      prog.style.width = '0%';
    }
    timer = setTimeout(()=>{
      t.classList.remove('show');
      setTimeout(()=>t.remove(),400);
    }, 2800);
  };

  wrap.appendChild(t);
  t.offsetHeight; 
  
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    t.classList.add('show');
    const prog = t.querySelector('.toast-progress');
    if (prog) {
      prog.style.width = '0%';
    }
  }));
}

function copyTextToClipboard(text, successMsg = 'Copiado para a área de transferência! 📋') {
  if (!text) return;
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => showToast(successMsg, 'success'))
      .catch(() => fallbackCopyText(text, successMsg));
  } else {
    fallbackCopyText(text, successMsg);
  }
}

function fallbackCopyText(text, successMsg) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(ta);
    if (successful) {
      showToast(successMsg || 'Copiado para a área de transferência! 📋', 'success');
      return;
    }
  } catch (err) {}
  const shareInput = document.getElementById('shareLinkInput');
  const shareOverlay = document.getElementById('shareLinkOverlay');
  if (shareInput && shareOverlay) {
    shareInput.value = text;
    shareOverlay.classList.add('open');
  } else {
    showToast('Não foi possível copiar automaticamente.', 'warning');
  }
}

// ══════════════════════════════════════════
//  CONFIRM MODAL (substitui o confirm() nativo do navegador)
// ══════════════════════════════════════════
(function injectConfirmModal(){
  let overlay = document.getElementById('confirmOverlay');
  if (!overlay) {
    const wrap=document.createElement('div');
    wrap.innerHTML=`<div class="overlay" id="confirmOverlay" onclick="if(event.target===this)closeConfirm()">
      <div class="mbox msm" id="confirmBox" style="max-width:520px;width:100%">
        <div class="mhdr">
          <h5 id="confirmTitle" style="color:var(--accent);display:flex;align-items:center;gap:6px"><i class="bi bi-question-circle"></i> Confirmar ação</h5>
          <button class="btn-icon btn-sm" onclick="closeConfirm()"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="mbody"><div id="confirmMsg" style="font-size:14px;color:var(--text2);line-height:1.5;margin:0"></div></div>
        <div class="mftr confirm-ftr" id="confirmFooter">
          <button class="btn btn-ghost" id="confirmBtnCancel" onclick="closeConfirm()">Cancelar</button>
          <div id="confirmExtraBtns" style="display:inline-flex;gap:8px"></div>
          <button class="btn btn-danger" id="confirmBtnOk">Confirmar</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(wrap.firstElementChild);
  }
})();

let _confirmCallback=null;
function showConfirm(message,onConfirm,opts={}){
  const overlay=document.getElementById('confirmOverlay');
  if(!overlay){ onConfirm(); return; }
  
  const box = document.getElementById('confirmBox');
  if (box) {
    box.style.maxWidth = opts.maxWidth || (opts.extraBtn || opts.extraBtns ? '520px' : '440px');
  }

  const titleEl = document.getElementById('confirmTitle');
  if (titleEl) titleEl.innerHTML=`<i class="${opts.icon||'bi bi-question-circle'}"></i> ${opts.title||'Confirmar ação'}`;
  
  const msgEl = document.getElementById('confirmMsg');
  if (msgEl) msgEl.innerHTML=message;
  
  const btnCancel = document.getElementById('confirmBtnCancel');
  if (btnCancel) {
    btnCancel.textContent = opts.cancelText || 'Cancelar';
    btnCancel.style.display = opts.hideCancel ? 'none' : 'inline-flex';
  }

  const extraContainer = document.getElementById('confirmExtraBtns');
  if (extraContainer) {
    extraContainer.innerHTML = '';
    const extraList = Array.isArray(opts.extraBtns) ? opts.extraBtns : (opts.extraBtn ? [opts.extraBtn] : []);
    extraList.forEach(btnInfo => {
      if (!btnInfo) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = btnInfo.className || 'btn btn-ghost';
      if (btnInfo.style) btn.style.cssText = btnInfo.style;
      btn.innerHTML = (btnInfo.icon ? `<i class="${btnInfo.icon}"></i> ` : '') + (btnInfo.text || 'Copiar');
      if (btnInfo.title) btn.title = btnInfo.title;
      btn.onclick = (e) => {
        if (typeof btnInfo.onClick === 'function') {
          btnInfo.onClick(e);
        }
        if (btnInfo.closeOnClick) {
          closeConfirm();
        }
      };
      extraContainer.appendChild(btn);
    });
  }

  const btn=document.getElementById('confirmBtnOk');
  if (btn) {
    btn.textContent=opts.okText||'Confirmar';
    btn.className=opts.danger===false?'btn btn-primary':'btn btn-danger';
    if (opts.okIcon) {
      btn.innerHTML = `<i class="${opts.okIcon}"></i> ${opts.okText || 'Confirmar'}`;
    }
    btn.style.display = opts.hideOk ? 'none' : 'inline-flex';
  }
  
  _confirmCallback=onConfirm;
  overlay.classList.add('open');
}
function closeConfirm(){
  document.getElementById('confirmOverlay')?.classList.remove('open');
  _confirmCallback=null;
}
document.addEventListener('click',(e)=>{
  // closest(): o botão pode conter um <i>, e nesse caso e.target é o ícone
  if(e.target && e.target.closest && e.target.closest('#confirmBtnOk')){
    const cb=_confirmCallback;
    closeConfirm();
    if(cb) cb();
  }
});

// ══════════════════════════════════════════
//  PROMPT MODAL PADRÃO DO SISTEMA
// ══════════════════════════════════════════
(function injectPromptModal(){
  if(document.getElementById('promptOverlay')) return;
  const wrap=document.createElement('div');
  wrap.innerHTML=`<div class="overlay" id="promptOverlay" onclick="if(event.target===this)closePrompt()">
    <div class="mbox msm" style="max-width:440px">
      <div class="mhdr">
        <h5 id="promptTitle" style="color:var(--accent)"><i class="bi bi-pencil-square"></i> Entrada de Dados</h5>
        <button class="btn-icon btn-sm" onclick="closePrompt()"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="mbody" style="padding:14px 18px">
        <p id="promptMsg" style="font-size:13.5px;color:var(--text2);margin-bottom:12px;line-height:1.4"></p>
        <div class="fld">
          <label class="flbl" id="promptInputLabel" style="display:none"></label>
          <input type="text" class="inp" id="promptInput" style="width:100%;font-size:14px">
          <div id="promptHelp" style="font-size:11.5px;color:var(--text3);margin-top:4px;display:none"></div>
        </div>
      </div>
      <div class="mftr">
        <button class="btn btn-ghost" onclick="closePrompt()">Cancelar</button>
        <button class="btn btn-primary" id="promptBtnOk" style="background:var(--accent);border-color:var(--accent)">Confirmar</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(wrap.firstElementChild);
})();

let _promptCallback=null;
function showPrompt(message, onConfirm, opts={}){
  const overlay=document.getElementById('promptOverlay');
  if(!overlay){ 
    const val = prompt(message, opts.defaultValue || '');
    if(val !== null && onConfirm) onConfirm(val);
    return;
  }
  document.getElementById('promptTitle').innerHTML=`<i class="${opts.icon||'bi bi-pencil-square'}"></i> ${opts.title||'Entrada de Dados'}`;
  document.getElementById('promptMsg').textContent=message;
  
  const inp=document.getElementById('promptInput');
  inp.value=opts.defaultValue!==undefined?opts.defaultValue:'';
  inp.placeholder=opts.placeholder||'';
  inp.type=opts.type||'text';
  if(opts.inputMode) inp.inputMode=opts.inputMode; else inp.removeAttribute('inputmode');

  const lbl=document.getElementById('promptInputLabel');
  if(opts.label){ lbl.textContent=opts.label; lbl.style.display='block'; } else lbl.style.display='none';

  const help=document.getElementById('promptHelp');
  if(opts.helpText){ help.textContent=opts.helpText; help.style.display='block'; } else help.style.display='none';

  if(opts.isCurrency){
    inp.oninput=function(){ maskCurrencyInput(this); };
  } else {
    inp.oninput=null;
  }

  const btn=document.getElementById('promptBtnOk');
  btn.textContent=opts.okText||'Confirmar';
  btn.className=opts.danger?'btn btn-danger':'btn btn-primary';
  if(!opts.danger) { btn.style.background='var(--accent)'; btn.style.borderColor='var(--accent)'; }
  else { btn.style.background=''; btn.style.borderColor=''; }

  _promptCallback=onConfirm;
  overlay.classList.add('open');
  setTimeout(()=>{ inp.focus(); if(inp.select) inp.select(); }, 100);
}

function closePrompt(){
  document.getElementById('promptOverlay')?.classList.remove('open');
  _promptCallback=null;
}

document.addEventListener('click',(e)=>{
  if(e.target && e.target.id==='promptBtnOk'){
    const val=document.getElementById('promptInput')?.value;
    const cb=_promptCallback;
    closePrompt();
    if(cb) cb(val);
  }
});

document.addEventListener('keydown',(e)=>{
  const overlay=document.getElementById('promptOverlay');
  if(overlay && overlay.classList.contains('open')){
    if(e.key==='Enter'){
      e.preventDefault();
      const val=document.getElementById('promptInput')?.value;
      const cb=_promptCallback;
      closePrompt();
      if(cb) cb(val);
    } else if(e.key==='Escape'){
      closePrompt();
    }
  }
});

// ══════════════════════════════════════════
//  GERENCIAR TIPOS DE PROJETO
// ══════════════════════════════════════════
// Injetado uma vez, disponível em qualquer página admin — sem precisar
// duplicar esse HTML nos 6 arquivos.
(function injectTypesModal(){
  if(document.getElementById('typesOverlay')) return;
  if(!document.querySelector('.nav')) return; // só nas páginas admin
  const wrap=document.createElement('div');
  wrap.innerHTML=`<div class="overlay" id="typesOverlay" onclick="if(event.target===this)closeManageProjectTypesModal()">
    <div class="mbox" style="max-width:920px;width:95vw">
      <div class="mhdr"><h5 style="color:var(--accent)"><i class="bi bi-tags"></i> Tipos de Projeto & Pastas Padrão</h5><button class="btn-icon btn-sm" onclick="closeManageProjectTypesModal()"><i class="bi bi-x-lg"></i></button></div>
      <div class="mbody">
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px;line-height:1.4">
          Defina os tipos de projeto e suas subpastas padrão. Ao abrir a pasta no Windows Explorer, você poderá escolher quais subpastas deseja criar.
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;max-height:58vh;overflow-y:auto;padding-right:4px" id="typesManagerList"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:16px;flex-wrap:wrap">
          <div style="display:flex;gap:6px">
            <button type="button" class="btn btn-ghost btn-sm" onclick="addTypeInput()"><i class="bi bi-plus-lg"></i> Novo Tipo</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="applyDefaultNumberedFoldersAll()" title="Aplica a numeração 01., 02., 03... em todos os tipos listados"><i class="bi bi-sort-numeric-down"></i> Aplicar Numeração</button>
          </div>
          <button type="button" class="btn btn-ghost btn-xs" onclick="resetAllProjectTypesToDefault()" title="Restaura os tipos originais com Prefeitura e Render" style="color:var(--text-muted)"><i class="bi bi-arrow-counterclockwise"></i> Restaurar Padrões</button>
        </div>
      </div>
      <div class="mftr">
        <button class="btn btn-ghost" onclick="closeManageProjectTypesModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveProjectTypes()"><i class="bi bi-check2"></i> Salvar Alterações</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(wrap.firstElementChild);
})();
function stripFolderNumbering(segment) {
  return (segment || '').replace(/^\s*\d+[\.\-_\s]+\s*/, '').trim();
}

function formatAndNumberFolderString(folderStr) {
  if (!folderStr || typeof folderStr !== 'string') return '';
  const rawList = folderStr.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  if (!rawList.length) return '';

  const parsedItems = [];
  const seenKeys = new Set();

  rawList.forEach(item => {
    const rawParts = item.split(/[\/\\]/).map(p => stripFolderNumbering(p)).filter(Boolean);
    if (!rawParts.length) return;
    const cleanKey = rawParts.join('/').toLowerCase();
    if (seenKeys.has(cleanKey)) return;
    seenKeys.add(cleanKey);
    parsedItems.push({
      parts: rawParts,
      isSub: rawParts.length > 1
    });
  });

  const rootNumberedMap = new Map();
  let rootCounter = 1;

  parsedItems.forEach(item => {
    const rootName = item.parts[0];
    const rootKey = rootName.toLowerCase();
    if (!rootNumberedMap.has(rootKey)) {
      const numStr = String(rootCounter).padStart(2, '0');
      rootNumberedMap.set(rootKey, `${numStr}. ${rootName}`);
      rootCounter++;
    }
  });

  const subCounters = new Map();
  const result = [];

  parsedItems.forEach(item => {
    const rootName = item.parts[0];
    const rootKey = rootName.toLowerCase();
    const numberedRoot = rootNumberedMap.get(rootKey) || rootName;

    if (item.parts.length === 1) {
      result.push(numberedRoot);
    } else {
      const subParts = item.parts.slice(1);
      let subCount = (subCounters.get(rootKey) || 0) + 1;
      subCounters.set(rootKey, subCount);
      const subNumStr = String(subCount).padStart(2, '0');
      const numberedSub = `${subNumStr}. ${subParts[0]}`;
      const restParts = subParts.slice(1);
      const fullPath = [numberedRoot, numberedSub, ...restParts].join('/');
      result.push(fullPath);
    }
  });

  return result.join(', ');
}

function openManageProjectTypesModal(){
  const list=document.getElementById('typesManagerList');
  if(!list) return;
  const currentList = (projectTypes.length ? projectTypes : INIT_PROJECT_TYPES);
  list.innerHTML = currentList.map(t => {
    const foldersList = Array.isArray(t.defaultFolders) && t.defaultFolders.length ? t.defaultFolders : getProjectDefaultFolders(t.id);
    const folders = foldersList.join(', ');
    return `<div class="cm-type-card" data-orig="${escapeHtml(t.id)}" style="background:var(--bg-subtle, rgba(0,0,0,0.02));border:1px solid var(--border);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:center;gap:8px">
        <input type="color" class="cm-color cm-type-color" value="${t.color || '#71717a'}" title="Cor do tipo">
        <input class="inp inp-sm cm-type-name" value="${escapeHtml(t.id)}" placeholder="Nome do tipo" style="max-width:240px;font-weight:600">
        <div style="flex:1"></div>
        <button class="btn btn-danger btn-sm" onclick="this.closest('.cm-type-card').remove()" title="Excluir tipo"><i class="bi bi-trash3"></i></button>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <i class="bi bi-folder" style="font-size:14px;color:var(--accent);opacity:0.9" title="Subpastas padrão"></i>
        <input class="inp inp-sm cm-type-folders" value="${escapeHtml(folders)}" placeholder="Subpastas padrão (ex: 01. Documentos, 02. Renders, 02. Renders/01. Prints...)" style="flex:1;font-size:12px" title="Subpastas padrão que serão sugeridas ao abrir a pasta">
      </div>
    </div>`;
  }).join('');
  document.getElementById('typesOverlay').classList.add('open');
}
function closeManageProjectTypesModal(){document.getElementById('typesOverlay').classList.remove('open');}
function applyDefaultNumberedFoldersAll(){
  const cards = document.querySelectorAll('#typesManagerList .cm-type-card');
  cards.forEach(c => {
    const folderInp = c.querySelector('.cm-type-folders');
    if (folderInp) {
      const currentVal = folderInp.value.trim();
      if (currentVal) {
        folderInp.value = formatAndNumberFolderString(currentVal);
      } else {
        const name = c.querySelector('.cm-type-name')?.value.trim();
        const def = getProjectDefaultFolders(name);
        folderInp.value = def.join(', ');
      }
    }
  });
  showToast('Numeração aplicada mantendo todas as pastas adicionadas!', 'success');
}
function resetAllProjectTypesToDefault(){
  if (!confirm('Deseja restaurar todos os tipos de projeto para a lista original com numeração (incluindo Prefeitura e Render)?')) return;
  projectTypes = JSON.parse(JSON.stringify(INIT_PROJECT_TYPES));
  openManageProjectTypesModal();
  showToast('Tipos restaurados! Clique em Salvar Alterações para confirmar.', 'info');
}
function addTypeInput(){
  const list=document.getElementById('typesManagerList');
  if(!list) return;
  const card=document.createElement('div');
  card.className='cm-type-card';
  card.dataset.orig='';
  card.style.cssText='background:var(--bg-subtle, rgba(0,0,0,0.02));border:1px solid var(--border);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px';
  card.innerHTML=`<div style="display:flex;align-items:center;gap:8px">
    <input type="color" class="cm-color cm-type-color" value="${typeof DEFAULT_COL_COLOR !== 'undefined' ? DEFAULT_COL_COLOR : '#71717a'}" title="Cor do tipo">
    <input class="inp inp-sm cm-type-name" placeholder="Nome do novo tipo..." style="max-width:240px;font-weight:600">
    <div style="flex:1"></div>
    <button class="btn btn-danger btn-sm" onclick="this.closest('.cm-type-card').remove()" title="Excluir tipo"><i class="bi bi-trash3"></i></button>
  </div>
  <div style="display:flex;align-items:center;gap:8px">
    <i class="bi bi-folder" style="font-size:14px;color:var(--accent);opacity:0.9" title="Subpastas padrão"></i>
    <input class="inp inp-sm cm-type-folders" value="01. Documentos, 02. Renders, 02. Renders/01. Prints, 03. Outros" placeholder="Subpastas padrão (ex: 01. Documentos, 02. Renders...)" style="flex:1;font-size:12px" title="Subpastas padrão que serão sugeridas ao abrir a pasta">
  </div>`;
  list.appendChild(card);
}
function saveProjectTypes(){
  const cards=document.querySelectorAll('#typesManagerList .cm-type-card');
  const newTypes=[],map={};
  cards.forEach(c=>{
    const orig=c.dataset.orig;
    const color=c.querySelector('.cm-type-color')?.value || '#71717a';
    const name=(c.querySelector('.cm-type-name')?.value || '').trim();
    const foldersStr=(c.querySelector('.cm-type-folders')?.value || '').trim();
    const defaultFolders=foldersStr ? foldersStr.split(/[,;\n]+/).map(s=>s.trim().replace(/^[\/\\]+|[\/\\]+$/g,'')).filter(Boolean) : [];
    if(name){
      newTypes.push({id:name,color,defaultFolders});
      if(orig&&orig!==name)map[orig]=name;
    }
  });
  if(!newTypes.length) return showToast('Ao menos um tipo!','warning');
  projects.forEach(p=>{if(map[p.type])p.type=map[p.type];});
  budgets.forEach(b=>{if(map[b.projectType])b.projectType=map[b.projectType];});
  projectTypes=newTypes;
  scheduleSync();
  renderCurrentPage();
  closeManageProjectTypesModal();
  showToast('Tipos de projeto e pastas padrão atualizados!','success');
}

// ══════════════════════════════════════════
//  MODAL DE SELEÇÃO DE SUBPASTAS POR PROJETO
// ══════════════════════════════════════════
(function injectFolderSelectionModal(){
  if(document.getElementById('folderSelectionOverlay')) return;
  if(!document.querySelector('.nav')) return;
  const wrap=document.createElement('div');
  wrap.innerHTML=`<div class="overlay" id="folderSelectionOverlay" onclick="if(event.target===this)closeFolderSelectionModal()">
    <div class="mbox" style="max-width:560px;width:95vw">
      <div class="mhdr">
        <h5 style="color:var(--accent);display:flex;align-items:center;gap:6px"><i class="bi bi-folder-check"></i> Subpastas do Projeto</h5>
        <button class="btn-icon btn-sm" onclick="closeFolderSelectionModal()"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="mbody">
        <div style="margin-bottom:12px;background:var(--bg-subtle, rgba(0,0,0,0.02));padding:10px 12px;border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:13.5px;font-weight:700;color:var(--text-main)" id="fsProjName">Projeto</div>
          <div style="font-size:11.5px;color:var(--text-muted);word-break:break-all;margin-top:3px" id="fsProjPath">Caminho</div>
        </div>
        
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;line-height:1.4">
          Marque quais subpastas você deseja verificar ou criar no computador para este projeto:
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--accent)">
            Tipo: <strong id="fsProjType" style="color:var(--text-main)">Residencial</strong>
          </span>
          <div style="display:flex;gap:8px;font-size:11.5px">
            <a href="javascript:void(0)" onclick="toggleAllFsFolders(true)" style="color:var(--accent);text-decoration:none;font-weight:600">Marcar todas</a>
            <span style="color:var(--border)">|</span>
            <a href="javascript:void(0)" onclick="toggleAllFsFolders(false)" style="color:var(--text-muted);text-decoration:none">Desmarcar todas</a>
          </div>
        </div>

        <div id="fsFoldersChecklist" style="display:flex;flex-direction:column;gap:6px;max-height:42vh;overflow-y:auto;padding:8px;background:var(--bg-subtle, rgba(0,0,0,0.02));border:1px solid var(--border);border-radius:8px">
        </div>
      </div>
      <div class="mftr" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="closeFolderSelectionModal()">Cancelar</button>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="fsConfirmOnlyOpen()" title="Apenas abre a pasta no Windows Explorer sem criar subpastas">Abrir Sem Criar</button>
          <button class="btn btn-primary btn-sm" onclick="fsConfirmCreateAndOpen()"><i class="bi bi-folder2-open"></i> Criar Selecionadas e Abrir</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(wrap.firstElementChild);
})();

let _fsCallback = null;
let _fsPath = '';
let _fsType = '';

function openFolderSelectionModal(caminho, tipoProjeto, projName, onConfirm, currentSelectedFolders) {
  if (!caminho || !caminho.trim()) {
    showToast('Informe o caminho da pasta primeiro.', 'warning');
    return;
  }
  let clean = caminho.trim().replace(/^["']|["']$/g, '');
  if (/^https?:\/\//i.test(clean)) {
    window.open(clean, '_blank');
    return;
  }

  _fsPath = clean;
  _fsType = tipoProjeto || '';
  _fsCallback = onConfirm || null;

  const overlay = document.getElementById('folderSelectionOverlay');
  if (!overlay) {
    if (typeof onConfirm === 'function') onConfirm(getProjectDefaultFolders(tipoProjeto));
    else abrirPastaLocal(clean, tipoProjeto);
    return;
  }

  const nameEl = document.getElementById('fsProjName');
  const pathEl = document.getElementById('fsProjPath');
  const typeEl = document.getElementById('fsProjType');
  const listEl = document.getElementById('fsFoldersChecklist');

  if (nameEl) nameEl.textContent = projName || 'Projeto';
  if (pathEl) pathEl.textContent = clean;
  if (typeEl) typeEl.textContent = tipoProjeto || 'Geral';

  const defaultFolders = getProjectDefaultFolders(tipoProjeto);
  const hasSavedSelection = Array.isArray(currentSelectedFolders) && currentSelectedFolders.length > 0;

  if (listEl) {
    if (!defaultFolders.length) {
      listEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:12px">Nenhuma subpasta padrão configurada para este tipo.</div>';
    } else {
      listEl.innerHTML = defaultFolders.map((f) => {
        const isSub = f.includes('/') || f.includes('\\');
        const pad = isSub ? 'margin-left:20px;opacity:0.95;' : '';
        const icon = isSub ? 'bi-arrow-return-right' : 'bi-folder-fill';
        const isChecked = hasSavedSelection ? currentSelectedFolders.includes(f) : true;

        return `
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 10px;border-radius:6px;background:var(--card-bg, #fff);border:1px solid var(--border);${pad}user-select:none;font-size:12.5px;transition:background 0.15s">
            <input type="checkbox" class="fs-folder-chk" value="${escapeHtml(f)}" ${isChecked ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer">
            <i class="bi ${icon}" style="color:var(--accent);font-size:${isSub ? '12px' : '14px'}"></i>
            <span style="flex:1;font-weight:${isSub ? '400' : '600'}">${escapeHtml(f)}</span>
          </label>
        `;
      }).join('');
    }
  }

  overlay.classList.add('open');
}

function closeFolderSelectionModal() {
  const overlay = document.getElementById('folderSelectionOverlay');
  if (overlay) overlay.classList.remove('open');
}

function toggleAllFsFolders(check) {
  document.querySelectorAll('.fs-folder-chk').forEach(chk => {
    chk.checked = !!check;
  });
}

function fsConfirmCreateAndOpen() {
  const selected = [];
  document.querySelectorAll('.fs-folder-chk:checked').forEach(chk => {
    if (chk.value) selected.push(chk.value);
  });
  closeFolderSelectionModal();
  if (typeof _fsCallback === 'function') {
    _fsCallback(selected);
  } else {
    abrirPastaLocal(_fsPath, _fsType, selected);
  }
}

function fsConfirmOnlyOpen() {
  closeFolderSelectionModal();
  if (typeof _fsCallback === 'function') {
    _fsCallback([]);
  } else {
    abrirPastaLocal(_fsPath, _fsType, []);
  }
}

// ══════════════════════════════════════════
//  BARRA DE NAVEGAÇÃO INFERIOR (MOBILE)
// ══════════════════════════════════════════
// No mobile o .nav-tabs desktop some (sem espaço), e sem isso não havia
// como trocar de página a não ser voltando pro navegador. Substitui por
// uma barra fixa no rodapé com o item ativo "flutuando" — nas cores do
// sistema (var(--accent) etc.), não no arco-íris do componente original.
const MOBILE_TABS=[
  {href:'index.html',       icon:'bi-kanban',                    label:'Board',       match:['','index.html']},
  {href:'dashboard.html',   icon:'bi-speedometer2',               label:'Dashboard',   match:['dashboard.html']},
  {href:'orcamento.html',   icon:'bi-file-earmark-spreadsheet',   label:'Orçamentos',  match:['orcamento.html']},
  {href:'pagamentos.html',  icon:'bi-credit-card',                label:'Pagamentos',  match:['pagamentos.html']},
  {href:'relatorio.html',   icon:'bi-graph-up-arrow',             label:'Relatórios',  match:['relatorio.html']},
  {href:'clientes.html',    icon:'bi-people',                     label:'Clientes',    match:['clientes.html']},
  {href:'servicos.html',    icon:'bi-box-seam',                   label:'Serviços',    match:['servicos.html']},
  {href:'javascript:void(0)', icon:'bi-stopwatch',                label:'Cronômetro',  isTimer:true},
];

function getMobileTabBarHtml(){
  const current=location.pathname.split('/').pop();
  return MOBILE_TABS.map(t=>{
    if(t.isTimer){
      return `<a class="mtab-item" id="mtabTimerBtn" href="javascript:void(0)" onclick="onMobileTimerClick(event)" title="Cronômetro" aria-label="Cronômetro">
        <span class="mtab-bubble">
          <i class="bi bi-stopwatch" id="mtabTimerIcon"></i>
          <span class="mtab-timer-dot" id="mtabTimerDot" style="display:none"></span>
        </span>
      </a>`;
    }
    const active=t.match && t.match.includes(current);
    return `<a class="mtab-item${active?' active':''}" href="${t.href}" title="${t.label}" aria-label="${t.label}">
      <span class="mtab-bubble"><i class="bi ${t.icon}"></i></span>
    </a>`;
  }).join('');
}

(function injectMobileTabBar(){
  if(document.getElementById('mtabBar')) return;
  if(!document.querySelector('.nav') && !document.querySelector('nav.nav')) return; // só nas páginas admin
  const wrap=document.createElement('div');
  wrap.innerHTML=`<nav class="mtab-bar" id="mtabBar">${getMobileTabBarHtml()}</nav>`;
  document.body.appendChild(wrap.firstElementChild);
  if(typeof updateMobileTimerIndicator === 'function') updateMobileTimerIndicator();
})();

// ══════════════════════════════════════════
//  PAGINAÇÃO (listas longas — orçamentos, pagamentos, clientes)
// ══════════════════════════════════════════
const PAGE_SIZES=[5,10,20,50,100];
const _pgState={};

function pgState(key,defaultSize=10){
  const isMobile=Boolean(window.matchMedia && window.matchMedia('(max-width:768px)').matches);
  const storageKey = isMobile ? 'mavic_pp_m_'+key : 'mavic_pp_'+key;
  if(!_pgState[key] || _pgState[key]._isMobile !== isMobile){
    const saved=localStorage.getItem(storageKey);
    // Tela menor (mobile) começa com 5 itens por página por padrão
    const fallback=isMobile?5:defaultSize;
    const perPage=saved==='all'?Infinity:(parseInt(saved)||fallback);
    _pgState[key]={page:1,perPage,_isMobile:isMobile};
  }
  return _pgState[key];
}

// Recorta o array já filtrado/ordenado pra página atual. Chame depois de aplicar filtros.
function pgSlice(arr,key){
  const st=pgState(key);
  if(!isFinite(st.perPage)) return arr;
  const totalPages=Math.max(1,Math.ceil(arr.length/st.perPage));
  if(st.page>totalPages) st.page=totalPages;
  const start=(st.page-1)*st.perPage;
  return arr.slice(start,start+st.perPage);
}

// Reseta pra página 1 — chame nos filtros/busca pra não ficar "presa" numa página vazia.
function pgReset(key){
  if(_pgState[key]) _pgState[key].page=1;
}

function pgBarHtml(key,totalItems,renderFnName,opts={}){
  const st=pgState(key);
  const perPage=isFinite(st.perPage)?st.perPage:(totalItems||1);
  const totalPages=Math.max(1,Math.ceil(totalItems/perPage));
  if(st.page>totalPages) st.page=totalPages;
  const from=totalItems===0?0:(st.page-1)*perPage+1;
  const to=Math.min(st.page*perPage,totalItems);
  const sizePicker=opts.hideSize?'':`<div class="pg-size" title="Itens por página">
      <i class="bi bi-list-ol"></i>
      <select class="inp inp-sm" onchange="pgSetSize('${key}',this.value,'${renderFnName}')">
        ${PAGE_SIZES.map(n=>`<option value="${n}" ${st.perPage===n?'selected':''}>${n}</option>`).join('')}
        <option value="all" ${!isFinite(st.perPage)?'selected':''}>Todos</option>
      </select>
    </div>`;
  return `<div class="pg-bar${opts.compact?' pg-bar-compact':''}">
    <div class="pg-info">${totalItems===0?'Nenhum item':`${from}–${to} de ${totalItems}`}</div>
    <div class="pg-controls">
      <button class="btn-icon btn-sm" ${st.page<=1?'disabled':''} onclick="pgGo('${key}',1,'${renderFnName}')" title="Primeira página"><i class="bi bi-chevron-bar-left"></i></button>
      <button class="btn-icon btn-sm" ${st.page<=1?'disabled':''} onclick="pgGo('${key}',${st.page-1},'${renderFnName}')" title="Anterior"><i class="bi bi-chevron-left"></i></button>
      <span class="pg-page">${st.page} / ${totalPages}</span>
      <button class="btn-icon btn-sm" ${st.page>=totalPages?'disabled':''} onclick="pgGo('${key}',${st.page+1},'${renderFnName}')" title="Próxima"><i class="bi bi-chevron-right"></i></button>
      <button class="btn-icon btn-sm" ${st.page>=totalPages?'disabled':''} onclick="pgGo('${key}',${totalPages},'${renderFnName}')" title="Última página"><i class="bi bi-chevron-bar-right"></i></button>
    </div>
    ${sizePicker}
  </div>`;
}

function pgGo(key,page,renderFnName){
  pgState(key).page=Math.max(1,page);
  if(typeof window[renderFnName]==='function') window[renderFnName]();
}
function pgSetSize(key,value,renderFnName){
  const isMobile=Boolean(window.matchMedia && window.matchMedia('(max-width:768px)').matches);
  const storageKey = isMobile ? 'mavic_pp_m_'+key : 'mavic_pp_'+key;
  const st=pgState(key);
  st.perPage=value==='all'?Infinity:parseInt(value);
  st.page=1;
  st._isMobile=isMobile;
  localStorage.setItem(storageKey,value);
  if(typeof window[renderFnName]==='function') window[renderFnName]();
}

// Linhas/cards vazios desativados para layout limpo com rodapé fixo/flexível
function pgFillerCount(key,actualCount){
  return 0;
}

function pgFillerRowsHtml(key,actualCount,colspan=12){
  return '';
}

function pgFillerCardsHtml(key,actualCount,heightPx=72,extraClass=''){
  return '';
}

function fmt(v){return parseFloat(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function today(){return new Date().toISOString().split('T')[0];}
function addDays(dateStr, days) {
  if (!dateStr) return today();
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + (parseInt(days) || 0));
  return d.toISOString().split('T')[0];
}

function getClientDueDay(clientName) {
  if (!clientName) return null;
  if (typeof clients !== 'undefined' && Array.isArray(clients)) {
    const cl = clients.find(c => (c.name || '').toLowerCase().trim() === String(clientName).toLowerCase().trim() || String(c.id) === String(clientName));
    if (cl && cl.dueDay && cl.dueDay >= 1 && cl.dueDay <= 31) {
      return parseInt(cl.dueDay);
    }
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
function formatPhone(phone){
  const d=(phone||'').replace(/\D/g,'');
  if(d.length===11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if(d.length===10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return phone||'';
}
const AVATAR_COLORS=['#e07b54','#5b8dd9','#8b5cf6','#059669','#d97706','#db2777','#0891b2','#65a30d','#dc2626','#7c3aed'];
function getClientColor(name){
  if(!name || typeof name !== 'string') return AVATAR_COLORS[0] || '#e07b54';
  let h=0;for(let i=0;i<name.length;i++)h=name.charCodeAt(i)+((h<<5)-h);return AVATAR_COLORS[Math.abs(h)%AVATAR_COLORS.length];
}
function getInitials(name){
  return (name && typeof name === 'string' ? name : '?').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || '?';
}

function abrirPastaLocal(caminho, tipoProjeto, customFolders) {
  if (!caminho || !caminho.trim()) {
    showToast('Nenhum caminho de pasta configurado para este projeto.', 'warning');
    return;
  }
  let clean = caminho.trim().replace(/^["']|["']$/g, '');
  
  if (/^https?:\/\//i.test(clean)) {
    window.open(clean, '_blank');
    return;
  }

  const folders = Array.isArray(customFolders) ? customFolders : getProjectDefaultFolders(tipoProjeto);
  const payload = {
    path: clean,
    type: tipoProjeto || '',
    folders: folders
  };

  try {
    const jsonStr = JSON.stringify(payload);
    const b64 = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, function toSolidBytes(match, p1) {
      return String.fromCharCode('0x' + p1);
    }));
    showToast('Abrindo pasta no Windows Explorer…', 'info');
    window.location.href = 'mavic-folder://open?b64=' + encodeURIComponent(b64);
  } catch (err) {
    showToast('Abrindo pasta no Windows Explorer…', 'info');
    window.location.href = 'mavic-folder://' + encodeURIComponent(clean);
  }
}

function abrirSubpastaEspecifica(basePath, subfolder) {
  if (!basePath || !basePath.trim()) {
    showToast('Nenhum caminho de pasta configurado.', 'warning');
    return;
  }
  let cleanBase = basePath.trim().replace(/^["']|["']$/g, '').replace(/\//g, '\\').replace(/\\+$/, '');
  let sub = (subfolder || '').trim().replace(/^[\/\\]+/, '').replace(/\//g, '\\');
  let fullPath = sub ? `${cleanBase}\\${sub}` : cleanBase;
  abrirPastaLocal(fullPath, '', []);
}

// ══════════════════════════════════════════
//  SETTINGS MODAL (GLOBAL)
// ══════════════════════════════════════════
function openSettings(){
  if(!document.getElementById('settingsOverlay')) return;
  const sess = getAdminSession();
  const emailEl = document.getElementById('stAdminEmail');
  if (emailEl) emailEl.textContent = sess?.email || 'projetos.mavic@hotmail.com';
  document.getElementById('clientUrl').value=localStorage.getItem('mavic_clientUrl')||'cliente.html';
  document.getElementById('pixKey').value=localStorage.getItem('mavic_pixKey')||'';
  document.getElementById('pixName').value=localStorage.getItem('mavic_pixName')||'';
  document.getElementById('pixBank').value=localStorage.getItem('mavic_pixBank')||'';
  document.getElementById('waTemplate').value=localStorage.getItem('mavic_waTemplate')||'';
  document.getElementById('companyName').value=localStorage.getItem('mavic_companyName')||'';
  document.getElementById('companyDoc').value=formatDocMask(localStorage.getItem('mavic_companyDoc')||'');
  document.getElementById('companyDoc').classList.remove('inp-invalid');
  document.getElementById('companyEmail').value=localStorage.getItem('mavic_companyEmail')||'';
  document.getElementById('companyInsta').value=localStorage.getItem('mavic_companyInsta')||'';
  const hrRateEl = document.getElementById('hourlyRate');
  if (hrRateEl) hrRateEl.value = localStorage.getItem('mavic_hourlyRate') || '80';
  document.getElementById('stProjCnt').textContent=projects.length;
  document.getElementById('stCliCnt').textContent=clients.length;
  document.getElementById('settingsOverlay').classList.add('open');
}
function hasSettingsChanges() {
  const clientUrl = document.getElementById('clientUrl')?.value.trim() || 'cliente.html';
  const pixKey = document.getElementById('pixKey')?.value.trim() || '';
  const pixName = document.getElementById('pixName')?.value.trim() || '';
  const pixBank = document.getElementById('pixBank')?.value.trim() || '';
  const waTemplate = document.getElementById('waTemplate')?.value.trim() || '';
  const companyName = document.getElementById('companyName')?.value.trim() || '';
  const companyDoc = document.getElementById('companyDoc')?.value.trim() || '';
  const companyEmail = document.getElementById('companyEmail')?.value.trim() || '';
  const companyInsta = document.getElementById('companyInsta')?.value.trim() || '';
  const hourlyRate = document.getElementById('hourlyRate')?.value.trim() || '80';

  return clientUrl !== (localStorage.getItem('mavic_clientUrl') || 'cliente.html') ||
         pixKey !== (localStorage.getItem('mavic_pixKey') || '') ||
         pixName !== (localStorage.getItem('mavic_pixName') || '') ||
         pixBank !== (localStorage.getItem('mavic_pixBank') || '') ||
         waTemplate !== (localStorage.getItem('mavic_waTemplate') || '') ||
         companyName !== (localStorage.getItem('mavic_companyName') || '') ||
         companyDoc !== (localStorage.getItem('mavic_companyDoc') || '') ||
         companyEmail !== (localStorage.getItem('mavic_companyEmail') || '') ||
         companyInsta !== (localStorage.getItem('mavic_companyInsta') || '') ||
         hourlyRate !== (localStorage.getItem('mavic_hourlyRate') || '80');
}

function closeSettings(confirmIfDirty = false){
  const el=document.getElementById('settingsOverlay');
  if(!el) return;
  if(confirmIfDirty && hasSettingsChanges()){
    showConfirm('Deseja descartar as alterações não salvas nas configurações?', () => {
      el.classList.remove('open');
    }, { title: 'Descartar alterações?', okText: 'Descartar', danger: true });
  } else {
    el.classList.remove('open');
  }
}
function saveSettings(){
  const cUrl=document.getElementById('clientUrl').value.trim()||'cliente.html';
  localStorage.setItem('mavic_clientUrl',cUrl);window.CLIENT_PANEL_URL=cUrl;
  localStorage.setItem('mavic_pixKey',document.getElementById('pixKey').value.trim());
  localStorage.setItem('mavic_pixName',document.getElementById('pixName').value.trim());
  localStorage.setItem('mavic_pixBank',document.getElementById('pixBank').value.trim());
  localStorage.setItem('mavic_waTemplate',document.getElementById('waTemplate').value.trim());
  localStorage.setItem('mavic_companyName',document.getElementById('companyName').value.trim());
  localStorage.setItem('mavic_companyDoc',document.getElementById('companyDoc').value.trim());
  localStorage.setItem('mavic_companyEmail',document.getElementById('companyEmail').value.trim());
  localStorage.setItem('mavic_companyInsta',document.getElementById('companyInsta').value.trim());
  const hrRateEl = document.getElementById('hourlyRate');
  if (hrRateEl) localStorage.setItem('mavic_hourlyRate', hrRateEl.value.trim() || '80');
  closeSettings();scheduleSync();showToast('Configurações salvas!','success');
  // Trigger update if defined
  if (typeof updateOrcPreviewLabels === 'function') updateOrcPreviewLabels();
}

// ══════════════════════════════════════════
//  MEGAPHONE NOTICES (GLOBAL)
// ══════════════════════════════════════════
function openGlobalNoticeModal(){
  if(!document.getElementById('globalNoticeOverlay')) return;
  resetGnForm();
  renderGnList();
  updateGnNavBtn();
  document.getElementById('globalNoticeOverlay').classList.add('open');
}
function closeGlobalNoticeModal(){
  const el=document.getElementById('globalNoticeOverlay');
  if(el) el.classList.remove('open');
}
function resetGnForm(){
  if(!document.getElementById('gnTitle')) return;
  document.getElementById('gnTitle').value='';
  document.getElementById('gnMsg').value='';
  document.getElementById('gnActive').checked=true;
  document.getElementById('gnAllClients').checked=true;
  document.getElementById('gnClientsContainer').innerHTML=clients.map(c=>`<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;padding:3px 0">
    <input type="checkbox" class="gn-cli-cb" value="${c.name}" checked style="accent-color:var(--accent);width:14px;height:14px">
    <span><i class="bi bi-person" style="color:var(--accent)"></i> ${c.name}</span>
  </label>`).join('');
  toggleGnAllClients();updateGnPreview();
}
function toggleGnAllClients(){
  const el = document.getElementById('gnAllClients');
  if(!el) return;
  const all=el.checked;
  document.getElementById('gnClientsContainer').style.display=all?'none':'flex';
}
function toggleGnAccordion(id){
  if(openGnIds.has(id)) openGnIds.delete(id);
  else openGnIds.add(id);
  renderGnList();
}
function formatNoticeText(t){
  return t
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*([^*\n]+)\*/g,'<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g,'<em>$1</em>')
    .replace(/\n/g,'<br>');
}
function wrapGnText(before,after){
  const ta=document.getElementById('gnMsg');
  if(!ta) return;
  const s=ta.selectionStart,e=ta.selectionEnd;
  const sel=ta.value.substring(s,e)||'texto';
  ta.setRangeText(before+sel+after,s,e,'select');
  ta.focus();updateGnPreview();
}
function insertGnText(text){
  const ta=document.getElementById('gnMsg');
  if(!ta) return;
  const s=ta.selectionStart;
  ta.setRangeText(text,s,s,'end');
  ta.focus();updateGnPreview();
}
function updateGnPreview(){
  const titleEl=document.getElementById('gnTitle');
  const msgEl=document.getElementById('gnMsg');
  if(!titleEl || !msgEl) return;
  const title=titleEl.value.trim();
  const msg=msgEl.value.trim();
  const active=document.getElementById('gnActive').checked;
  const lbl=document.getElementById('gnStatusLabel');
  lbl.textContent=active?'Ativo':'Inativo';
  lbl.style.color=active?'var(--green)':'var(--text2)';
  if(msg || title){
    document.getElementById('gnPreview').style.display='block';
    document.getElementById('gnPreviewText').innerHTML=`
      <div style="font-weight:700;margin-bottom:4px">${title || 'Sem Título'}</div>
      <div>${formatNoticeText(msg)}</div>
    `;
  }
  else document.getElementById('gnPreview').style.display='none';
}
function renderGnList(){
  const el=document.getElementById('gnList');
  if(!el) return;
  
  const formattedGlobals = globalNotices.map(gn => ({
    id: gn.id,
    type: 'global',
    title: gn.title || 'Aviso Geral',
    message: gn.message,
    active: gn.active,
    createdAt: gn.createdAt,
    targetLabel: gn.targetAll ? 'Todos os clientes' : `${gn.targetClients?.length || 0} cliente(s)`,
    targetedNames: gn.targetAll ? clients.map(c=>c.name) : (gn.targetClients||[]),
    readBy: gn.readBy || []
  }));

  const formattedIndivs = notifications.map(n => {
    const targetCli = clients.find(c => c.token === n.clientToken);
    const targetName = targetCli ? targetCli.name : 'Cliente Desconhecido';
    return {
      id: n.id,
      type: 'individual',
      title: n.title || `Aviso do Projeto: ${n.projectName || 'MAVIC'}`,
      message: n.message,
      active: true,
      createdAt: n.createdAt,
      targetLabel: targetName,
      targetedNames: [targetName],
      readBy: n.read ? [targetName] : []
    };
  });

  const combined = [...formattedGlobals, ...formattedIndivs]
    .filter(gn => gn && gn.message && gn.message.trim() !== '')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if(!combined.length){el.innerHTML='<div class="empty-state"><i class="bi bi-megaphone"></i><span>Nenhum aviso enviado ainda</span></div>';return;}
  
  el.innerHTML=combined.map(gn=>{
    const total = gn.targetedNames.length;
    const readCount = gn.readBy.length;
    const allRead = total > 0 && readCount >= total;
    
    const clientChips = gn.targetedNames.map(n=>{
      const read = gn.readBy.includes(n);
      return `<span style="font-size:11px;padding:2px 8px;border-radius:20px;display:inline-flex;align-items:center;gap:3px;${read?'background:var(--green-bg);color:var(--green)':'background:var(--surface);border:1px solid var(--border);color:var(--text3)'}">
        ${read?'<i class="bi bi-check2"></i>':'<i class="bi bi-clock"></i>'} ${n}
      </span>`;
    }).join('');

    const isOpen = openGnIds.has(gn.id);
    const preview=gn.message.replace(/<[^>]*>/g,'').replace(/\*|_/g,'').substring(0,60)+(gn.message.length>60?'…':'');
    
    return `<div class="gn-accordion ${isOpen ? 'open' : ''}">
      <div class="gn-header" onclick="toggleGnAccordion(${gn.id})">
        <div class="gn-header-title">
          <i class="bi ${gn.type==='global'?'bi-megaphone':'bi-folder'}" style="color:${gn.type==='global'?'var(--accent)':'var(--green)'};flex-shrink:0"></i>
          <span>${gn.title||'Aviso'}</span>
          ${!isOpen?`<span class="gn-header-preview">— ${preview}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span class="badge ${gn.type==='global'?'b-pago':'b-tResidencial'}" style="font-size:10px">${gn.type==='global'?'Global':'Individual'}</span>
          <i class="bi bi-chevron-down gn-header-arrow"></i>
        </div>
      </div>
      <div class="gn-content">
        <div style="font-size:13px;font-weight:500;line-height:1.6;margin-bottom:10px">${formatNoticeText(gn.message)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text3);flex-wrap:wrap">
            <span><i class="bi bi-people"></i> ${gn.targetLabel}</span>
            <span>·</span>
            <span><i class="bi bi-calendar3"></i> ${new Date(gn.createdAt).toLocaleDateString('pt-BR')}</span>
            <span>·</span>
            <span style="font-weight:600;color:${allRead?'var(--green)':readCount>0?'var(--yellow)':'var(--text3)'}">
              <i class="bi bi-eye"></i> ${readCount}/${total} leram
            </span>
          </div>
          <div style="display:flex;gap:3px;flex-shrink:0">
            ${gn.type === 'global' ? `<button class="cbtn" style="color:${gn.active?'var(--green)':'var(--text3)'}" title="${gn.active?'Desativar':'Ativar'}" onclick="toggleGnActive(${gn.id}); event.stopPropagation();"><i class="bi bi-${gn.active?'toggle-on':'toggle-off'}"></i></button>` : ''}
            <button class="cbtn del" onclick="deleteAdminNotice(${gn.id}, '${gn.type}'); event.stopPropagation();" title="Excluir"><i class="bi bi-trash3"></i></button>
          </div>
        </div>
        ${gn.targetedNames.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">${clientChips}</div>`:''}
      </div>
    </div>`;
  }).join('');
}
function saveGlobalNotice(){
  const title=document.getElementById('gnTitle').value.trim();
  const msg=document.getElementById('gnMsg').value.trim();
  if(!title)return showToast('Escreva o título','warning');
  if(!msg)return showToast('Escreva a mensagem','warning');
  const active=document.getElementById('gnActive').checked;
  const targetAll=document.getElementById('gnAllClients').checked;
  const targetClients=targetAll?[]:Array.from(document.querySelectorAll('.gn-cli-cb:checked')).map(cb=>cb.value);
  if(!targetAll&&!targetClients.length)return showToast('Selecione ao menos um cliente','warning');
  globalNotices.push({id:Date.now(),title,message:msg,active,targetAll,targetClients,readBy:[],createdAt:new Date().toISOString()});
  updateGnNavBtn();renderGnList();resetGnForm();
  scheduleSync();showToast(active?'Aviso publicado!':'Aviso salvo (inativo)','success');
}
function toggleGnActive(id){
  const gn=globalNotices.find(x=>x.id===id);if(!gn)return;
  gn.active=!gn.active;renderGnList();updateGnNavBtn();scheduleSync();
  showToast(gn.active?'Aviso ativado':'Aviso desativado','info');
}
function deleteAdminNotice(id, type){
  showConfirm('Excluir este aviso definitivamente?', () => {
    if(type === 'global'){
      globalNotices=globalNotices.filter(x=>x.id!==id);
    } else {
      notifications=notifications.filter(x=>x.id!==id);
    }
    renderGnList();updateGnNavBtn();scheduleSync();showToast('Aviso removido','info');
  });
}
function updateGnNavBtn(){
  const btn=document.getElementById('gnNavBtn');
  if(!btn) return;
  const hasActive=globalNotices.some(x=>x.active);
  btn.style.color=hasActive?'var(--yellow)':'';
}

// ══════════════════════════════════════════
//  ARCHIVE ACTIONS (GLOBAL)
// ══════════════════════════════════════════
function openArchiveModal(){
  if(!document.getElementById('archiveOverlay')) return;
  renderArchived();
  document.getElementById('archiveOverlay').classList.add('open');
}
function closeArchiveModal(){
  const el=document.getElementById('archiveOverlay');
  if(el) el.classList.remove('open');
}
function renderArchived(){
  const el=document.getElementById('archiveList');
  if(!el) return;
  const arch=projects.filter(p=>p.archived);
  if(!arch.length){el.innerHTML='<div class="empty-state"><i class="bi bi-archive"></i><span>Nenhum projeto arquivado</span></div>';return;}
  el.innerHTML=arch.map(p=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border)"><div><div style="font-weight:600;font-size:13.5px">${p.name}</div><div style="font-size:12px;color:var(--text2)">${p.client} · ${p.column}</div></div><div style="display:flex;gap:7px"><button class="btn btn-ghost btn-sm" onclick="restoreProject(${p.id})"><i class="bi bi-arrow-counterclockwise"></i></button><button class="btn btn-danger btn-sm" onclick="deleteProject(${p.id},true)"><i class="bi bi-trash3"></i></button></div></div>`).join('');
}
function restoreProject(id){
  const idx=projects.findIndex(p=>p.id===id);
  if(idx>-1){
    projects[idx].archived=false;
    if (typeof renderBoard === 'function') renderBoard();
    renderArchived();
    scheduleSync();
    showToast('Restaurado!','success');
  }
}
function deleteProject(id,fromArch=false){
  showConfirm('Excluir definitivamente?', () => {
    projects=projects.filter(p=>p.id!==id);
    pinnedCards.delete(id);
    expandedFin.delete(id);
    if(fromArch) renderArchived();
    if (typeof renderBoard === 'function') renderBoard();
    scheduleSync();
    showToast('Excluído','info');
  });
}

// ══════════════════════════════════════════
//  INITIALIZATION & NAV HIGHLIGHT WITH SLIDING PILL
// ══════════════════════════════════════════
function highlightActiveTab() {
  const currentPath = window.location.pathname;
  const isHome = currentPath === '/' || currentPath.endsWith('/') || currentPath.endsWith('index.html');

  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    const href = tab.getAttribute('href');
    if (href) {
      const match = (href === 'index.html' && isHome) || (href !== 'index.html' && currentPath.endsWith(href));
      tab.classList.toggle('on', match);
    }
  });

  const mtabs = document.querySelectorAll('.mtab-item');
  mtabs.forEach(tab => {
    const href = tab.getAttribute('href');
    if (href) {
      const match = (href === 'index.html' && isHome) || (href !== 'index.html' && currentPath.endsWith(href));
      tab.classList.toggle('active', match);
    }
  });

  initNavTabIndicator();
}

function initNavTabIndicator() {
  const navTabs = document.querySelector('.nav-tabs');
  if (!navTabs) return;

  let indicator = navTabs.querySelector('.nav-tab-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'nav-tab-indicator';
    navTabs.appendChild(indicator);
  }

  const activeTab = navTabs.querySelector('.nav-tab.on');
  if (!activeTab) return;

  const prevRectStr = sessionStorage.getItem('mavic_nav_prev_pill');
  let hadPrev = false;

  if (prevRectStr) {
    try {
      const prev = JSON.parse(prevRectStr);
      sessionStorage.removeItem('mavic_nav_prev_pill');
      if (prev && typeof prev.left === 'number' && typeof prev.width === 'number') {
        hadPrev = true;
      }
    } catch (e) {}
  }

  function moveIndicatorTo(tab, animate = true) {
    if (!tab) return;
    const targetLeft = tab.offsetLeft;
    const targetWidth = tab.offsetWidth;

    if (!animate) {
      indicator.style.transition = 'none';
      indicator.style.transform = `translateX(${targetLeft}px)`;
      indicator.style.width = `${targetWidth}px`;
      indicator.classList.add('ready');
    } else {
      indicator.style.transition = 'transform 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.15), width 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.15), opacity 0.2s ease';
      indicator.style.transform = `translateX(${targetLeft}px)`;
      indicator.style.width = `${targetWidth}px`;
      indicator.classList.add('ready');
    }
  }

  if (hadPrev) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        moveIndicatorTo(activeTab, true);
      });
    });
  } else {
    moveIndicatorTo(activeTab, false);
    setTimeout(() => {
      indicator.style.transition = 'transform 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.15), width 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.15), opacity 0.2s ease';
    }, 50);
  }

  // Intercepta cliques para iniciar o deslizamento antes da troca de página
  const allTabs = navTabs.querySelectorAll('.nav-tab');
  allTabs.forEach(tab => {
    if (tab._navIndicatorBound) return;
    tab._navIndicatorBound = true;

    tab.addEventListener('click', () => {
      const currentTab = navTabs.querySelector('.nav-tab.on');
      if (currentTab) {
        sessionStorage.setItem('mavic_nav_prev_pill', JSON.stringify({
          left: currentTab.offsetLeft,
          width: currentTab.offsetWidth
        }));
      }

      allTabs.forEach(t => t.classList.remove('on'));
      tab.classList.add('on');
      moveIndicatorTo(tab, true);
    });
  });

  if (!window._navResizeBound) {
    window._navResizeBound = true;
    window.addEventListener('resize', () => {
      const curr = navTabs.querySelector('.nav-tab.on');
      if (curr) moveIndicatorTo(curr, false);
    });
  }
}

// ══════════════════════════════════════════
//  SHARED LAYOUT & COMPONENT INJECTION
// ══════════════════════════════════════════
function injectSharedLayout() {
  if (window.location.pathname.includes('login.html') || window.location.pathname.includes('cliente.html')) {
    return;
  }

  // 1. Loading Indicator
  if (!document.getElementById('loading')) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.id = 'loading';
    loadingDiv.innerHTML = `
      <div class="spin"></div>
      <div style="font-weight:600;font-size:14px">Carregando MAVIC…</div>
      <div style="font-size:12px;color:var(--text3)">Conectando ao banco de dados</div>
    `;
    document.body.prepend(loadingDiv);
  }

  // 2. Setup Banner
  if (!document.getElementById('setupBanner')) {
    const bannerDiv = document.createElement('div');
    bannerDiv.className = 'setup-banner d-none';
    bannerDiv.id = 'setupBanner';
    bannerDiv.innerHTML = `
      <span><i class="bi bi-exclamation-triangle"></i> Supabase não configurado — dados salvos localmente.</span>
      <button class="btn btn-sm" style="background:var(--yellow);color:#fff" onclick="openSettings()">Configurar agora</button>
    `;
    const loadingEl = document.getElementById('loading');
    if (loadingEl && loadingEl.nextSibling) {
      document.body.insertBefore(bannerDiv, loadingEl.nextSibling);
    } else {
      document.body.prepend(bannerDiv);
    }
  }

  // 3. Top Navigation Bar
  if (!document.querySelector('nav.nav') && !document.getElementById('appNav')) {
    const navEl = document.createElement('nav');
    navEl.className = 'nav';
    navEl.id = 'appNav';
    navEl.innerHTML = `
      <div class="nav-brand">
        <img id="navLogo" src="LOGO NOVA.png" alt="MAVIC" class="nav-logo" onerror="this.style.display='none'">
        <div>
          <div class="nav-name">MAVIC Projetos</div>
          <div class="nav-sync ok" id="syncStatus"><i class="bi bi-cloud-check"></i> Sincronizado</div>
        </div>
      </div>
      <div class="nav-sep"></div>
      <div class="nav-tabs">
        <a class="nav-tab" href="index.html"><i class="bi bi-kanban"></i> Quadro</a>
        <a class="nav-tab" href="dashboard.html"><i class="bi bi-speedometer2"></i> Dashboard</a>
        <a class="nav-tab" href="orcamento.html"><i class="bi bi-file-earmark-spreadsheet"></i> Orçamentos</a>
        <a class="nav-tab" href="pagamentos.html"><i class="bi bi-credit-card"></i> Pagamentos</a>
        <a class="nav-tab" href="relatorio.html"><i class="bi bi-graph-up-arrow"></i> Relatórios</a>
        <a class="nav-tab" href="clientes.html"><i class="bi bi-people"></i> Clientes</a>
        <a class="nav-tab" href="servicos.html"><i class="bi bi-box-seam"></i> Serviços</a>
      </div>
      <div class="nav-spacer"></div>
      <button class="btn-icon" id="gnNavBtn" onclick="openGlobalNoticeModal()" title="Central de Avisos"><i class="bi bi-megaphone"></i></button>
      <button class="btn-icon" onclick="openArchiveModal()" title="Arquivados"><i class="bi bi-archive"></i></button>
      <button class="btn-icon" onclick="openSettings()" title="Configurações"><i class="bi bi-gear"></i></button>
      <button class="btn-icon" id="themeBtn" onclick="toggleTheme()" title="Tema"><i class="bi bi-moon-stars"></i></button>
      <button class="btn-icon btn-logout" onclick="logoutAdmin()" title="Sair do painel"><i class="bi bi-box-arrow-right"></i></button>
    `;
    const bannerEl = document.getElementById('setupBanner');
    if (bannerEl && bannerEl.nextSibling) {
      document.body.insertBefore(navEl, bannerEl.nextSibling);
    } else {
      document.body.prepend(navEl);
    }
  }

  // 4. Mobile Bottom Tabs Bar
  if (!document.getElementById('mtabBar')) {
    const mtabEl = document.createElement('nav');
    mtabEl.className = 'mtab-bar';
    mtabEl.id = 'mtabBar';
    mtabEl.innerHTML = getMobileTabBarHtml();
    document.body.appendChild(mtabEl);
  }

  // 5. Shared Global Modals
  injectSharedModals();

  // 6. Global Timer Bar
  renderGlobalTimerBar();
}

function injectSharedModals() {
  if (document.getElementById('sharedModalsContainer')) return;
  const wrap = document.createElement('div');
  wrap.id = 'sharedModalsContainer';

  let modalsHtml = '';

  // Settings Overlay
  if (!document.getElementById('settingsOverlay')) {
    modalsHtml += `
      <div class="overlay" id="settingsOverlay" onclick="if(event.target===this)closeSettings(true)">
      <div class="mbox mmd">
        <div class="mhdr"><h5 style="color:var(--accent)"><i class="bi bi-gear"></i> Configurações</h5><button class="btn-icon btn-sm" onclick="closeSettings(true)"><i class="bi bi-x-lg"></i></button></div>
        <div class="mbody">
          <div class="stgrp">
            <div class="sec"><i class="bi bi-window"></i> Painel do Cliente</div>
            <div class="fld"><label class="flbl">URL do cliente.html</label><input class="inp inp-sm" id="clientUrl" placeholder="cliente.html ou https://seusite.com/cliente.html"></div>
          </div>
          <div class="stgrp">
            <div class="sec"><i class="bi bi-qr-code" style="color:var(--accent)"></i> Pagamento (PIX)</div>
            <div class="fld"><label class="flbl">Chave PIX (CPF/CNPJ/e-mail/telefone)</label><input class="inp inp-sm" id="pixKey" placeholder="Ex: 350.605.018-41"></div>
            <div class="row2">
              <div class="fld"><label class="flbl">Titular</label><input class="inp inp-sm" id="pixName" placeholder="Nome do titular"></div>
              <div class="fld"><label class="flbl">Banco / Instituição</label><input class="inp inp-sm" id="pixBank" placeholder="Ex: Nu Pagamentos"></div>
            </div>
          </div>
          <div class="stgrp">
            <div class="sec"><i class="bi bi-whatsapp" style="color:#25D366"></i> Template do WhatsApp</div>
            <div class="fld">
              <label class="flbl">Template de Mensagem</label>
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">
                <button type="button" class="btn btn-xs btn-ghost" onclick="insertWaVar('{Cliente}')" title="Primeiro nome do cliente">+ {Cliente}</button>
                <button type="button" class="btn btn-xs btn-ghost" onclick="insertWaVar('{Projeto}')" title="Nome do projeto">+ {Projeto}</button>
                <button type="button" class="btn btn-xs btn-ghost" onclick="insertWaVar('{Etapa}')" title="Etapa/Coluna">+ {Etapa}</button>
                <button type="button" class="btn btn-xs btn-ghost" onclick="insertWaVar('{Prazo}')" title="Prazo do projeto">+ {Prazo}</button>
                <button type="button" class="btn btn-xs btn-ghost" onclick="insertWaVar('{ValorTotal}')" title="Valor total">+ {ValorTotal}</button>
                <button type="button" class="btn btn-xs btn-ghost" onclick="insertWaVar('{ValorPago}')" title="Valor pago">+ {ValorPago}</button>
                <button type="button" class="btn btn-xs btn-ghost" onclick="insertWaVar('{SaldoPendente}')" title="Saldo pendente">+ {SaldoPendente}</button>
                <button type="button" class="btn btn-xs btn-ghost" onclick="insertWaVar('{TarefaAtual}')" title="Subtarefas em foco">+ {TarefaAtual}</button>
                <button type="button" class="btn btn-xs btn-ghost" onclick="insertWaVar('{Observacao}')" title="Observações">+ {Observacao}</button>
                <button type="button" class="btn btn-xs btn-ghost" onclick="insertWaVar('{LinkPainel}')" title="Painel do cliente">+ {LinkPainel}</button>
                <button type="button" class="btn btn-xs btn-ghost" onclick="insertWaVar('{LinkDrive}')" title="Pasta de arquivos">+ {LinkDrive}</button>
                <button type="button" class="btn btn-xs btn-ghost" onclick="insertWaVar('{DadosPix}')" title="Dados PIX">+ {DadosPix}</button>
              </div>
              <textarea class="inp" id="waTemplate" rows="5" style="font-size:12.5px;line-height:1.4;resize:vertical"></textarea>
            </div>
          </div>
          <div class="stgrp">
            <div class="sec"><i class="bi bi-building"></i> Dados do Emissor (para Recibos e Orçamentos)</div>
            <div class="fld">
              <label class="flbl">Nome / Razão Social</label>
              <input class="inp inp-sm" id="companyName" placeholder="Ex: Victor Lourenço Pereira Ltda">
            </div>
            <div class="fld">
              <label class="flbl">CPF / CNPJ do Emissor</label>
              <input class="inp inp-sm" id="companyDoc" placeholder="Ex: 350.605.018-41" oninput="maskDocInput(this)" onblur="checkDocValidity(this)">
            </div>
            <div class="fld">
              <label class="flbl">E-mail do Emissor</label>
              <input class="inp inp-sm" id="companyEmail" placeholder="Ex: projetos.mavic@hotmail.com">
            </div>
            <div class="fld">
              <label class="flbl">Instagram do Emissor</label>
              <input class="inp inp-sm" id="companyInsta" placeholder="Ex: @mavic.arquitetuta">
            </div>
          </div>
          <div class="stgrp">
            <div class="sec"><i class="bi bi-stopwatch" style="color:var(--accent)"></i> Valor Hora Operacional (Lucratividade)</div>
            <div class="fld">
              <label class="flbl">Valor Base por Hora (R$/h)</label>
              <input class="inp inp-sm" id="hourlyRate" type="number" min="1" placeholder="80" style="max-width:180px">
              <div style="font-size:11px;color:var(--text3);margin-top:4px">Utilizado para calcular o custo real e a margem de lucro nos projetos.</div>
            </div>
          </div>
          <div class="stgrp">
            <div class="sec"><i class="bi bi-shield-lock" style="color:var(--accent)"></i> Sessão & Segurança</div>
            <div class="st-row"><span style="color:var(--text2)">Conectado como</span><strong id="stAdminEmail" style="color:var(--accent)">projetos.mavic@hotmail.com</strong></div>
            <div class="st-row" style="margin-top: 10px; display: flex; justify-content: flex-end;">
              <button type="button" class="btn-outline-danger" onclick="logoutAdmin()"><i class="bi bi-box-arrow-right"></i> Sair do Painel</button>
            </div>
          </div>
          <div class="stgrp">
            <div class="sec">Sistema</div>
            <div class="st-row"><span style="color:var(--text2)">Projetos</span><strong id="stProjCnt">—</strong></div>
            <div class="st-row"><span style="color:var(--text2)">Clientes</span><strong id="stCliCnt">—</strong></div>
            <div class="st-row"><span style="color:var(--text2)">Banco de dados</span><strong style="color:var(--green)"><i class="bi bi-cloud-check"></i> Supabase conectado</strong></div>
            <div class="st-row"><span style="color:var(--text2)">Versão</span><strong style="color:var(--accent)">MAVIC v3.1</strong></div>
            <div class="st-row" style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end;">
              <button class="btn btn-ghost btn-sm" onclick="exportBackup()"><i class="bi bi-download"></i> Exportar Backup</button>
              <label class="btn btn-ghost btn-sm" style="margin:0; cursor:pointer">
                <i class="bi bi-upload"></i> Importar Backup
                <input type="file" accept=".json" onchange="importBackup(event)" style="display:none">
              </label>
            </div>
          </div>
        </div>
        <div class="mftr"><button class="btn btn-ghost" onclick="closeSettings(true)">Cancelar</button><button class="btn btn-primary" onclick="saveSettings()">Salvar</button></div>
      </div>
      </div>
    `;
  }

  // Global Notice Overlay
  if (!document.getElementById('globalNoticeOverlay')) {
    modalsHtml += `
      <div class="overlay" id="globalNoticeOverlay" onclick="if(event.target===this)closeGlobalNoticeModal()">
      <div class="mbox mxl">
        <div class="mhdr">
          <h5 style="color:var(--accent)"><i class="bi bi-megaphone"></i> Central de Avisos</h5>
          <button class="btn-icon btn-sm" onclick="closeGlobalNoticeModal()"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="mbody" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div style="display:flex;flex-direction:column">
            <div class="sec" style="margin-bottom:10px">Avisos enviados</div>
            <div id="gnList" style="display:flex;flex-direction:column;gap:6px;height:460px;overflow-y:auto;padding-right:6px"></div>
          </div>
          <div style="border-left:1px solid var(--border);padding-left:20px">
            <div class="sec" style="margin-bottom:10px">Novo Aviso</div>
            <div class="fld" style="display:flex;align-items:center;justify-content:space-between">
              <label class="flbl" style="margin-bottom:0">Ativo ao publicar</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input type="checkbox" id="gnActive" checked onchange="updateGnPreview()" style="accent-color:var(--accent);width:15px;height:15px">
                <span id="gnStatusLabel" style="font-size:13px;font-weight:600;color:var(--green)">Ativo</span>
              </label>
            </div>
            <div class="fld">
              <label class="flbl">Título *</label>
              <input class="inp inp-sm" id="gnTitle" oninput="updateGnPreview()" placeholder="Ex: Recesso de Fim de Ano">
            </div>
            <div class="fld">
              <label class="flbl">Mensagem *</label>
              <div style="display:flex;gap:4px;margin-bottom:5px;flex-wrap:wrap">
                <button type="button" class="btn btn-ghost btn-sm" onclick="wrapGnText('*','*')"><b>N</b></button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="wrapGnText('_','_')"><i>I</i></button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="insertGnText('\\n')">↵ Linha</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="insertGnText('• ')">• Tópico</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="insertGnText('\\n\\n')">¶ Parágrafo</button>
              </div>
              <textarea class="inp" id="gnMsg" rows="5" oninput="updateGnPreview()" placeholder="Use os botões acima para formatar."></textarea>
            </div>
            <div class="fld">
              <label class="flbl">Destinatários</label>
              <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;padding-bottom:7px;border-bottom:1px solid var(--border);margin-bottom:6px">
                  <input type="checkbox" id="gnAllClients" checked onchange="toggleGnAllClients()">
                  <span>Todos os clientes</span>
                </label>
                <div id="gnClientsContainer" style="display:none;flex-direction:column;gap:3px;max-height:130px;overflow-y:auto"></div>
              </div>
            </div>
            <div id="gnPreview" style="display:none;background:var(--yellow-bg);border:1px solid var(--yellow);border-radius:10px;padding:11px;margin-bottom:12px">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--yellow);margin-bottom:4px"><i class="bi bi-megaphone"></i> Prévia:</div>
              <div id="gnPreviewText" style="font-size:13px;font-weight:500;color:var(--text);line-height:1.6"></div>
            </div>
            <button class="btn btn-primary" style="width:100%" onclick="saveGlobalNotice()"><i class="bi bi-megaphone"></i> Publicar Aviso</button>
          </div>
        </div>
      </div>
      </div>
    `;
  }

  // Archive Overlay
  if (!document.getElementById('archiveOverlay')) {
    modalsHtml += `
      <div class="overlay" id="archiveOverlay" onclick="if(event.target===this)closeArchiveModal()">
      <div class="mbox mmd">
        <div class="mhdr"><h5><i class="bi bi-archive"></i> Projetos Arquivados</h5><button class="btn-icon btn-sm" onclick="closeArchiveModal()"><i class="bi bi-x-lg"></i></button></div>
        <div class="mbody" id="archiveList" style="max-height:400px;overflow-y:auto"></div>
      </div>
      </div>
    `;
  }

  // Time Tracker & Profitability Overlay
  if (!document.getElementById('timeTrackerOverlay')) {
    modalsHtml += `
      <div class="overlay" id="timeTrackerOverlay" onclick="if(event.target===this)closeTimeTracker()">
      <div class="mbox mlg" style="max-width:680px">
        <div class="mhdr">
          <h5 id="ttModalTitle"><i class="bi bi-stopwatch" style="color:var(--accent)"></i> Apontamento de Horas</h5>
          <button class="btn-icon btn-sm" onclick="closeTimeTracker()"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="mbody">
          <div class="tt-kpi-grid" id="ttKpis"></div>
          
          <div id="ttTimerControls"></div>

          <!-- Formulário de Lançamento Manual -->
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:14px">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text3);margin-bottom:8px"><i class="bi bi-plus-circle"></i> Lançamento Manual de Horas</div>
            <div class="tt-manual-form-grid">
              <div class="fld" style="margin-bottom:0">
                <label class="flbl">Data</label>
                <input class="inp inp-sm" type="date" id="ttManualDate">
              </div>
              <div class="fld" style="margin-bottom:0">
                <label class="flbl">Horas</label>
                <input class="inp inp-sm" type="number" min="0" id="ttManualHours" placeholder="0">
              </div>
              <div class="fld" style="margin-bottom:0">
                <label class="flbl">Minutos</label>
                <input class="inp inp-sm" type="number" min="0" max="59" id="ttManualMinutes" placeholder="0">
              </div>
              <div class="fld tt-fld-desc" style="margin-bottom:0">
                <label class="flbl">Descrição do que foi feito</label>
                <input class="inp inp-sm" type="text" id="ttManualDesc" placeholder="Ex: Modelagem 3D, Reunião, Render…">
              </div>
              <div class="tt-fld-btn">
                <button class="btn btn-primary btn-sm" onclick="saveManualTimeLog()" style="height:34px;white-space:nowrap;width:100%"><i class="bi bi-check2"></i> Salvar</button>
              </div>
            </div>
          </div>

          <!-- Histórico de Apontamentos -->
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text3);margin-bottom:8px"><i class="bi bi-clock-history"></i> Histórico de Sessões</div>
          <div id="ttLogsList" style="max-height:220px;overflow-y:auto;padding-right:4px"></div>
        </div>
        <div class="mftr" style="display:flex;justify-content:space-between;align-items:center">
          <button class="btn btn-excel btn-sm" onclick="exportFullFinancialExcel()"><i class="bi bi-file-earmark-excel"></i> Exportar Tudo (Excel)</button>
          <button class="btn btn-ghost" onclick="closeTimeTracker()">Fechar</button>
        </div>
      </div>
      </div>
    `;
  }

  // Quick Select Project to Start Timer Overlay
  if (!document.getElementById('selectProjectTimerOverlay')) {
    modalsHtml += `
      <div class="overlay" id="selectProjectTimerOverlay" onclick="if(event.target===this)closePromptStartTimer()">
      <div class="mbox msm" style="max-width:440px">
        <div class="mhdr">
          <h5><i class="bi bi-stopwatch" style="color:var(--accent)"></i> Iniciar Cronômetro</h5>
          <button class="btn-icon btn-sm" onclick="closePromptStartTimer()"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="mbody">
          <div class="fld">
            <label class="flbl">Selecione o Projeto <span style="color:var(--red)">*</span></label>
            <select class="inp" id="selTimerProjectId" onchange="onSelectTimerProjectChange()">
              <option value="">Selecione um projeto…</option>
            </select>
          </div>
          <div class="fld">
            <label class="flbl">Etapa / Tarefa</label>
            <input class="inp inp-sm" id="selTimerStage" placeholder="Ex: Modelagem 3D, Render, Revisão…">
          </div>
          <div class="fld" style="margin-bottom:0">
            <label class="flbl">Descrição da Atividade (Opcional)</label>
            <input class="inp inp-sm" id="selTimerDesc" placeholder="Ex: Ajustes na fachada, detalhamento…">
          </div>
        </div>
        <div class="mftr" style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn btn-ghost" onclick="closePromptStartTimer()">Cancelar</button>
          <button class="btn btn-primary" onclick="confirmStartTimerFromModal()"><i class="bi bi-play-fill"></i> Iniciar Cronômetro</button>
        </div>
      </div>
      </div>
    `;
  }

  if (modalsHtml) {
    wrap.innerHTML = modalsHtml;
    document.body.appendChild(wrap);
  }
}

// ══════════════════════════════════════════
//  SHEETJS & EXCEL EXPORT ENGINE
// ══════════════════════════════════════════
function loadSheetJs(callback) {
  if (window.XLSX) {
    if (callback) callback();
    return;
  }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  s.onload = () => { if (callback) callback(); };
  s.onerror = () => { showToast('Erro ao carregar módulo do Excel.', 'danger'); };
  document.head.appendChild(s);
}

function exportFullFinancialExcel() {
  loadSheetJs(() => {
    try {
      const wb = XLSX.utils.book_new();

      const allProjs = (Array.isArray(projects) && projects.length) ? projects : JSON.parse(localStorage.getItem('mavic_projects') || '[]');
      const allBudgets = (Array.isArray(budgets) && budgets.length) ? budgets : JSON.parse(localStorage.getItem('mavic_budgets') || '[]');
      const allClients = (Array.isArray(clients) && clients.length) ? clients : JSON.parse(localStorage.getItem('mavic_clients') || '[]');

      // 1. ABA RESUMO FINANCEIRO
      const totalFaturado = allProjs.reduce((s, p) => s + parseFloat(p.value || 0), 0);
      let totalRecebido = 0;
      allProjs.forEach(p => {
        (p.payments || []).forEach(pg => { totalRecebido += parseFloat(pg.amount || 0); });
      });
      const saldoPendente = Math.max(0, totalFaturado - totalRecebido);
      
      let totalMinutos = 0;
      allProjs.forEach(p => {
        (p.timeLogs || []).forEach(l => { totalMinutos += parseInt(l.minutes || 0); });
      });
      const totalHoras = (totalMinutos / 60).toFixed(1);

      const orcTotal = allBudgets.reduce((s, b) => s + parseFloat(b.total || 0), 0);
      const orcAprovados = allBudgets.filter(b => b.status === 'Aprovado').length;

      const wsResumoData = [
        ['MAVIC PROJETOS — RELATÓRIO FINANCEIRO GERAL'],
        ['Gerado em:', new Date().toLocaleString('pt-BR')],
        [''],
        ['MÉTRICA', 'VALOR'],
        ['Faturamento Total Contratado (R$)', totalFaturado],
        ['Total Recebido (R$)', totalRecebido],
        ['Saldo Pendente a Receber (R$)', saldoPendente],
        ['Total de Projetos Cadastrados', allProjs.length],
        ['Total de Clientes', allClients.length],
        ['Total de Horas Trabalhadas', `${totalHoras} horas (${totalMinutos} min)`],
        ['Total em Orçamentos Emitidos (R$)', orcTotal],
        ['Orçamentos Aprovados', orcAprovados]
      ];
      const wsResumo = XLSX.utils.aoa_to_sheet(wsResumoData);
      wsResumo['!cols'] = [{ wch: 34 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Geral');

      // 2. ABA PROJETOS E CONTRATOS
      const wsProjsData = [
        ['ID', 'PROJETO', 'CLIENTE', 'CATEGORIA', 'ETAPA', 'VALOR CONTRATO (R$)', 'VALOR PAGO (R$)', 'SALDO PENDENTE (R$)', 'PRAZO', 'PRIORIDADE', 'HORAS TRABALHADAS (h)', 'STATUS FINANCEIRO']
      ];
      allProjs.forEach(p => {
        const val = parseFloat(p.value || 0);
        const paid = (p.payments || []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
        const bal = val - paid;
        const pMin = (p.timeLogs || []).reduce((s, l) => s + parseInt(l.minutes || 0), 0);
        const pHrs = (pMin / 60).toFixed(1);
        let finStatus = 'Pendente';
        if (val > 0) {
          if (bal <= 0) finStatus = '100% Quitado';
          else if (paid > 0) finStatus = 'Parcialmente Pago';
        }
        wsProjsData.push([
          p.id,
          p.name || 'Sem nome',
          p.client || 'Sem cliente',
          p.type || 'Geral',
          p.column || '—',
          val,
          paid,
          bal,
          p.date || '—',
          p.priority || 'Média',
          parseFloat(pHrs),
          finStatus
        ]);
      });
      const wsProjs = XLSX.utils.aoa_to_sheet(wsProjsData);
      wsProjs['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsProjs, 'Projetos & Contratos');

      // 3. ABA RECEBIMENTOS E PARCELAS
      const wsPaysData = [
        ['ID PROJETO', 'PROJETO', 'CLIENTE', 'DATA PAGAMENTO', 'VALOR RECEBIDO (R$)', 'FORMA DE PAGAMENTO', 'OBSERVAÇÃO']
      ];
      allProjs.forEach(p => {
        (p.payments || []).forEach(pg => {
          wsPaysData.push([
            p.id,
            p.name || '—',
            p.client || '—',
            pg.date || '—',
            parseFloat(pg.amount || 0),
            pg.method || 'Pix',
            pg.note || ''
          ]);
        });
      });
      const wsPays = XLSX.utils.aoa_to_sheet(wsPaysData);
      wsPays['!cols'] = [{ wch: 12 }, { wch: 26 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, wsPays, 'Histórico Recebimentos');

      // 4. ABA ORÇAMENTOS
      const wsOrcData = [
        ['Nº ORÇAMENTO', 'CLIENTE', 'TÍTULO / ESCOPO', 'DATA EMISSÃO', 'VALOR TOTAL (R$)', 'STATUS', 'VALIDADE (DIAS)']
      ];
      allBudgets.forEach(b => {
        wsOrcData.push([
          b.number ? `#${b.number}` : `#${b.id}`,
          b.client || '—',
          b.title || 'Orçamento',
          b.date || '—',
          parseFloat(b.total || 0),
          b.status || 'Pendente',
          b.validity || 15
        ]);
      });
      const wsOrc = XLSX.utils.aoa_to_sheet(wsOrcData);
      wsOrc['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsOrc, 'Orçamentos');

      // 5. ABA APONTAMENTO DE HORAS
      const wsTimeData = [
        ['DATA', 'ID PROJETO', 'PROJETO', 'CLIENTE', 'ETAPA / TAREFA', 'DURAÇÃO (MIN)', 'DURAÇÃO (HORAS)', 'DESCRICAO', 'AUTOR']
      ];
      allProjs.forEach(p => {
        (p.timeLogs || []).forEach(l => {
          const m = parseInt(l.minutes || 0);
          wsTimeData.push([
            l.date || '—',
            p.id,
            p.name || '—',
            p.client || '—',
            l.stage || p.column || 'Geral',
            m,
            parseFloat((m / 60).toFixed(2)),
            l.desc || '—',
            l.author || 'Victor'
          ]);
        });
      });
      const wsTime = XLSX.utils.aoa_to_sheet(wsTimeData);
      wsTime['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 30 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsTime, 'Apontamento de Horas');

      const fileName = `MAVIC_Financeiro_${today()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast('Planilha Excel exportada com sucesso!', 'success');
    } catch(err) {
      console.error('Erro na exportação Excel:', err);
      showToast('Falha ao gerar planilha Excel.', 'danger');
    }
  });
}

// ══════════════════════════════════════════
//  TIME TRACKING & CRONÔMETRO ENGINE
// ══════════════════════════════════════════
let globalTimerInterval = null;

function getActiveTimer() {
  try {
    const raw = localStorage.getItem('mavic_active_timer');
    return raw ? JSON.parse(raw) : null;
  } catch(e) {
    return null;
  }
}

function startGlobalTimer(projectId, stage = '', desc = '') {
  const allProjs = (Array.isArray(projects) && projects.length) ? projects : JSON.parse(localStorage.getItem('mavic_projects') || '[]');
  const p = allProjs.find(x => String(x.id) === String(projectId));
  if (!p) return showToast('Projeto não encontrado!', 'warning');

  const existing = getActiveTimer();
  if (existing && String(existing.projectId) === String(projectId) && !existing.pausedAt) {
    return;
  }

  if (existing && String(existing.projectId) !== String(projectId)) {
    stopGlobalTimer(true);
  }

  const timerState = {
    projectId: p.id,
    projectName: p.name,
    client: p.client,
    stage: stage || p.column || 'Execução',
    desc: desc || '',
    startTime: Date.now(),
    accumulatedMs: existing && String(existing.projectId) === String(projectId) ? (existing.accumulatedMs || 0) : 0,
    pausedAt: null
  };

  localStorage.setItem('mavic_active_timer', JSON.stringify(timerState));
  renderGlobalTimerBar();
  showToast(`⏱️ Cronômetro iniciado: ${p.name}`, 'info');

  if (typeof renderBoard === 'function') renderBoard();
}

function pauseGlobalTimer() {
  const timer = getActiveTimer();
  if (!timer) return;

  if (timer.pausedAt) {
    const pausedDuration = Date.now() - timer.pausedAt;
    timer.startTime += pausedDuration;
    timer.pausedAt = null;
    localStorage.setItem('mavic_active_timer', JSON.stringify(timer));
    showToast('⏱️ Cronômetro retomado!', 'info');
  } else {
    timer.pausedAt = Date.now();
    localStorage.setItem('mavic_active_timer', JSON.stringify(timer));
    showToast('⏱️ Cronômetro pausado.', 'info');
  }
  renderGlobalTimerBar();
  if (typeof renderBoard === 'function') renderBoard();
}

function stopGlobalTimer(save = true) {
  const timer = getActiveTimer();
  if (!timer) return;

  let totalElapsedMs = timer.accumulatedMs || 0;
  if (timer.pausedAt) {
    totalElapsedMs += (timer.pausedAt - timer.startTime);
  } else {
    totalElapsedMs += (Date.now() - timer.startTime);
  }

  const minutes = Math.max(1, Math.round(totalElapsedMs / 60000));

  if (save && minutes >= 1) {
    try {
      addProjectTimeLog(timer.projectId, {
        date: today(),
        minutes: minutes,
        stage: timer.stage || 'Geral',
        desc: timer.desc || 'Sessão de trabalho gravada via cronômetro',
        author: 'Victor'
      });
      showToast(`⏱️ Gravado: ${formatMinutes(minutes)} no projeto ${timer.projectName}`, 'success');
    } catch(err) {
      console.error('Erro ao gravar log:', err);
    }
  }

  localStorage.removeItem('mavic_active_timer');
  renderGlobalTimerBar();
  if (typeof renderBoard === 'function') renderBoard();
}

function toggleGlobalTimer(projectId) {
  const timer = getActiveTimer();
  if (timer && String(timer.projectId) === String(projectId)) {
    pauseGlobalTimer();
  } else {
    startGlobalTimer(projectId);
  }
}

function formatMinutes(mins) {
  const m = parseInt(mins || 0);
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h === 0) return `${remM}min`;
  return `${h}h ${remM.toString().padStart(2, '0')}m`;
}

function formatElapsedMs(ms) {
  const sec = Math.floor((ms / 1000) % 60);
  const min = Math.floor((ms / (1000 * 60)) % 60);
  const hrs = Math.floor(ms / (1000 * 60 * 60));
  return `${hrs.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function renderGlobalTimerBar() {
  updateMobileTimerIndicator();

  let bar = document.getElementById('globalTimerBar');
  const timer = getActiveTimer();

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'globalTimerBar';
    bar.className = 'global-timer-bar';
    document.body.appendChild(bar);
  }

  bar.style.display = 'flex';

  if (!timer) {
    if (globalTimerInterval) {
      clearInterval(globalTimerInterval);
      globalTimerInterval = null;
    }
    bar.classList.add('timer-idle');
    bar.onclick = (e) => {
      promptStartTimer();
    };
    bar.innerHTML = `
      <div class="timer-live-dot" style="background:var(--text3);animation:none"></div>
      <div class="timer-clock-display" style="color:var(--text3);font-size:14px">00:00:00</div>
      <div class="timer-proj-title" style="color:var(--text2);cursor:pointer" title="Clique para escolher um projeto e iniciar">Iniciar Cronômetro</div>
      <div class="timer-acts">
        <button type="button" class="btn-timer-act" style="background:var(--accent);color:#fff;border-color:var(--accent)" onclick="promptStartTimer();event.stopPropagation()" title="Escolher projeto e iniciar cronômetro">
          <i class="bi bi-play-fill"></i>
        </button>
      </div>
    `;
    return;
  }

  bar.classList.remove('timer-idle');
  bar.onclick = null;
  bar.innerHTML = `
    <div class="timer-live-dot" style="${timer.pausedAt ? 'background:var(--yellow);animation:none' : ''}"></div>
    <div class="timer-clock-display" id="globalTimerClock">00:00:00</div>
    <div class="timer-proj-title" onclick="openTimeTracker('${timer.projectId}');event.stopPropagation()" style="cursor:pointer" title="Ver detalhes de ${escapeHtml(timer.projectName)}">${escapeHtml(timer.projectName)}</div>
    <div class="timer-acts">
      <button type="button" class="btn-timer-act" onclick="pauseGlobalTimer();event.stopPropagation()" title="${timer.pausedAt ? 'Retomar cronômetro' : 'Pausar cronômetro'}">
        <i class="bi ${timer.pausedAt ? 'bi-play-fill' : 'bi-pause-fill'}"></i>
      </button>
      <button type="button" class="btn-timer-act btn-timer-stop" onclick="stopGlobalTimer(true);event.stopPropagation()" title="Parar e Salvar no Projeto">
        <i class="bi bi-stop-fill"></i>
      </button>
      <button type="button" class="btn-timer-act" onclick="openTimeTracker('${timer.projectId}');event.stopPropagation()" title="Ver Apontamentos e Lucro">
        <i class="bi bi-stopwatch"></i>
      </button>
    </div>
  `;

  updateGlobalTimerClock();

  if (!globalTimerInterval) {
    globalTimerInterval = setInterval(updateGlobalTimerClock, 1000);
  }
}

function onMobileTimerClick(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const timer = getActiveTimer();
  if (timer && timer.projectId) {
    openTimeTracker(timer.projectId);
  } else {
    promptStartTimer();
  }
}

function updateMobileTimerIndicator() {
  const timer = getActiveTimer();
  const icon = document.getElementById('mtabTimerIcon');
  const dot = document.getElementById('mtabTimerDot');
  const btn = document.getElementById('mtabTimerBtn');
  if (!icon || !btn) return;

  if (timer && !timer.pausedAt) {
    icon.className = 'bi bi-stopwatch-fill';
    icon.style.color = 'var(--red)';
    if (dot) dot.style.display = 'block';
    btn.classList.add('timer-running');
    btn.title = `Gravando: ${timer.projectName || 'Projeto'}`;
  } else if (timer && timer.pausedAt) {
    icon.className = 'bi bi-pause-circle-fill';
    icon.style.color = 'var(--yellow)';
    if (dot) dot.style.display = 'none';
    btn.classList.remove('timer-running');
    btn.title = `Pausado: ${timer.projectName || 'Projeto'}`;
  } else {
    icon.className = 'bi bi-stopwatch';
    icon.style.color = '';
    if (dot) dot.style.display = 'none';
    btn.classList.remove('timer-running');
    btn.title = 'Iniciar Cronômetro';
  }
}

function promptStartTimer() {
  let overlay = document.getElementById('selectProjectTimerOverlay');
  if (!overlay) {
    injectSharedModals();
    overlay = document.getElementById('selectProjectTimerOverlay');
  }

  const allProjs = (Array.isArray(projects) && projects.length) ? projects : JSON.parse(localStorage.getItem('mavic_projects') || '[]');
  const sel = document.getElementById('selTimerProjectId');

  const isFinalized = (val) => {
    if (!val) return false;
    const str = String(val).trim().toLowerCase();
    return str.includes('finalizad') || str.includes('concluid') || str.includes('concluíd') || str.includes('entregue') || str.includes('arquivad');
  };

  const activeProjs = allProjs.filter(p => !p.archived && !isFinalized(p.column) && !isFinalized(p.status));

  if (sel) {
    if (activeProjs.length === 0) {
      sel.innerHTML = `<option value="">Nenhum projeto em andamento no momento</option>`;
    } else {
      sel.innerHTML = `<option value="">Selecione um projeto em andamento…</option>` + activeProjs.map(p => {
        return `<option value="${p.id}" data-stage="${escapeHtml(p.column || '')}">${escapeHtml(p.name)} (${escapeHtml(p.client || 'Sem cliente')} — ${escapeHtml(p.column || 'Geral')})</option>`;
      }).join('');
    }
  }

  const stageInp = document.getElementById('selTimerStage');
  if (stageInp) stageInp.value = '';
  const descInp = document.getElementById('selTimerDesc');
  if (descInp) descInp.value = '';

  if (overlay) overlay.classList.add('open');
}

function onSelectTimerProjectChange() {
  const sel = document.getElementById('selTimerProjectId');
  const stageInp = document.getElementById('selTimerStage');
  if (!sel || !stageInp) return;
  const opt = sel.options[sel.selectedIndex];
  if (opt && opt.dataset && opt.dataset.stage) {
    stageInp.value = opt.dataset.stage;
  }
}

function closePromptStartTimer() {
  const overlay = document.getElementById('selectProjectTimerOverlay');
  if (overlay) overlay.classList.remove('open');
}

function confirmStartTimerFromModal() {
  const sel = document.getElementById('selTimerProjectId');
  const projectId = sel ? sel.value : '';
  if (!projectId) {
    return showToast('Por favor, selecione um projeto para iniciar o cronômetro.', 'warning');
  }
  const stage = document.getElementById('selTimerStage')?.value.trim() || '';
  const desc = document.getElementById('selTimerDesc')?.value.trim() || '';

  closePromptStartTimer();
  startGlobalTimer(projectId, stage, desc);
}

function updateGlobalTimerClock() {
  const timer = getActiveTimer();
  if (!timer) return;

  let totalMs = timer.accumulatedMs || 0;
  if (timer.pausedAt) {
    totalMs += (timer.pausedAt - timer.startTime);
  } else {
    totalMs += (Date.now() - timer.startTime);
  }

  const elapsedText = formatElapsedMs(Math.max(0, totalMs));

  const clockEl = document.getElementById('globalTimerClock');
  if (clockEl) {
    clockEl.textContent = elapsedText;
  }

  const modalClock = document.getElementById('ttModalLiveClock');
  if (modalClock) {
    modalClock.textContent = `— ${elapsedText}`;
  }

  updateMobileTimerIndicator();
}

function addProjectTimeLog(projectId, { date, minutes, stage, desc, author }) {
  const allProjs = (Array.isArray(projects) && projects.length) ? projects : JSON.parse(localStorage.getItem('mavic_projects') || '[]');
  const p = allProjs.find(x => String(x.id) === String(projectId));
  if (!p) return;
  if (!Array.isArray(p.timeLogs)) p.timeLogs = [];

  p.timeLogs.unshift({
    id: Date.now(),
    date: date || today(),
    minutes: parseInt(minutes || 0),
    stage: stage || p.column || 'Geral',
    desc: desc || '',
    author: author || 'Victor',
    createdAt: new Date().toISOString()
  });

  projects = allProjs;
  scheduleSync();
  if (typeof renderBoard === 'function') renderBoard();
}

function deleteProjectTimeLog(projectId, logId) {
  const allProjs = (Array.isArray(projects) && projects.length) ? projects : JSON.parse(localStorage.getItem('mavic_projects') || '[]');
  const p = allProjs.find(x => String(x.id) === String(projectId));
  if (!p || !Array.isArray(p.timeLogs)) return;

  p.timeLogs = p.timeLogs.filter(l => String(l.id) !== String(logId));
  projects = allProjs;
  scheduleSync();
  renderTimeTrackerModal(p.id);
  if (typeof renderBoard === 'function') renderBoard();
  showToast('Registro de tempo removido.', 'info');
}

// ══════════════════════════════════════════
//  TIME TRACKER MODAL
// ══════════════════════════════════════════
let currentTtProjectId = null;

function openTimeTracker(projectId) {
  let overlay = document.getElementById('timeTrackerOverlay');
  if (!overlay) {
    injectSharedModals();
    overlay = document.getElementById('timeTrackerOverlay');
  }
  currentTtProjectId = projectId;
  renderTimeTrackerModal(projectId);
  if (overlay) overlay.classList.add('open');
}

function closeTimeTracker() {
  const overlay = document.getElementById('timeTrackerOverlay');
  if (overlay) overlay.classList.remove('open');
  currentTtProjectId = null;
}

function renderTimeTrackerModal(projectId) {
  try {
    const allProjs = (Array.isArray(projects) && projects.length) ? projects : JSON.parse(localStorage.getItem('mavic_projects') || '[]');
    const p = allProjs.find(x => String(x.id) === String(projectId || currentTtProjectId));
    if (!p) return;

    const logs = p.timeLogs || [];
    const totalMin = logs.reduce((s, l) => s + parseInt(l.minutes || 0), 0);
    const totalHrs = (totalMin / 60).toFixed(1);
    const projectVal = parseFloat(p.value || 0);

    const hourlyRate = parseFloat(localStorage.getItem('mavic_hourlyRate') || 80);
    const totalCost = (totalMin / 60) * hourlyRate;
    const profitMargin = projectVal > 0 ? (((projectVal - totalCost) / projectVal) * 100).toFixed(1) : 0;
    const isProfit = projectVal >= totalCost;

    const timer = getActiveTimer();
    const isThisRunning = timer && String(timer.projectId) === String(p.id) && !timer.pausedAt;

    const titleEl = document.getElementById('ttModalTitle');
    if (titleEl) {
      titleEl.innerHTML = `<i class="bi bi-stopwatch" style="color:var(--accent)"></i> Apontamento de Horas — <strong>${escapeHtml(p.name)}</strong>`;
    }

    const kpiEl = document.getElementById('ttKpis');
    if (kpiEl) {
      kpiEl.innerHTML = `
        <div class="tt-kpi-card">
          <div class="tt-kpi-lbl">Total Trabalhado</div>
          <div class="tt-kpi-val" style="color:var(--accent)">${formatMinutes(totalMin)}</div>
          <div style="font-size:10.5px;color:var(--text3)">${totalHrs} horas</div>
        </div>
        <div class="tt-kpi-card">
          <div class="tt-kpi-lbl">Valor Contrato</div>
          <div class="tt-kpi-val" style="color:var(--green)">${fmt(projectVal)}</div>
          <div style="font-size:10.5px;color:var(--text3)">Cliente: ${escapeHtml(p.client || '—')}</div>
        </div>
        <div class="tt-kpi-card">
          <div class="tt-kpi-lbl">Custo Real (R$ ${hourlyRate}/h)</div>
          <div class="tt-kpi-val" style="color:var(--red)">${fmt(totalCost)}</div>
          <div style="font-size:10.5px;color:var(--text3)">Base operacional</div>
        </div>
        <div class="tt-kpi-card">
          <div class="tt-kpi-lbl">Margem de Lucro</div>
          <div class="tt-kpi-val" style="color:${isProfit ? 'var(--green)' : 'var(--red)'}">${profitMargin}%</div>
          <div style="font-size:10.5px;color:var(--text3)">${isProfit ? 'Lucrativo' : 'Custo excedido'}</div>
        </div>
      `;
    }

    // Timer Controls
    const timerCtrlEl = document.getElementById('ttTimerControls');
    if (timerCtrlEl) {
      timerCtrlEl.innerHTML = `
        <div class="tt-timer-live-box">
          <div style="display:flex;align-items:center;gap:10px;min-width:0">
            <div class="timer-live-dot" style="${!isThisRunning ? 'background:var(--text3);animation:none' : (timer && timer.pausedAt ? 'background:var(--yellow);animation:none' : '')}"></div>
            <div>
              <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px">
                <span>Cronômetro em Tempo Real</span>
                ${timer && String(timer.projectId) === String(p.id) ? `<span id="ttModalLiveClock" style="font-family:'Space Grotesk',sans-serif;font-weight:700;color:var(--accent)"></span>` : ''}
              </div>
              <div style="font-size:11px;color:var(--text3)">${isThisRunning ? 'Gravando atividade agora…' : (timer && timer.pausedAt ? 'Pausado' : 'Inicie para cronometrar sua sessão')}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${isThisRunning ? `
              <button class="btn btn-sm btn-ghost" onclick="pauseGlobalTimer();renderTimeTrackerModal('${p.id}')" title="Pausar"><i class="bi bi-pause-fill"></i> Pausar</button>
              <button class="btn btn-sm btn-outline-danger" onclick="stopGlobalTimer(true);renderTimeTrackerModal('${p.id}')"><i class="bi bi-stop-fill"></i> Parar e Salvar</button>
            ` : (timer && String(timer.projectId) === String(p.id) && timer.pausedAt ? `
              <button class="btn btn-sm btn-primary" onclick="pauseGlobalTimer();renderTimeTrackerModal('${p.id}')"><i class="bi bi-play-fill"></i> Retomar</button>
              <button class="btn btn-sm btn-outline-danger" onclick="stopGlobalTimer(true);renderTimeTrackerModal('${p.id}')"><i class="bi bi-stop-fill"></i> Parar e Salvar</button>
            ` : `
              <button class="btn btn-sm btn-primary" onclick="startGlobalTimer('${p.id}');renderTimeTrackerModal('${p.id}')"><i class="bi bi-play-fill"></i> Iniciar Cronômetro</button>
            `)}
          </div>
        </div>
      `;
    }

  // Logs List
  const logsEl = document.getElementById('ttLogsList');
  if (logsEl) {
    if (logs.length === 0) {
      logsEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px"><i class="bi bi-clock-history" style="font-size:24px;display:block;margin-bottom:6px"></i>Nenhum apontamento de horas registrado neste projeto.</div>`;
    } else {
      logsEl.innerHTML = logs.map(l => {
        const dStr = l.date ? new Date(l.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
        return `
          <div class="tt-log-item">
            <div style="display:flex;align-items:center;gap:8px;min-width:0">
              <span class="badge" style="font-size:11px;padding:3px 7px;background:var(--surface2);color:var(--text2);white-space:nowrap">${dStr}</span>
              <div style="min-width:0">
                <div style="font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(l.desc || 'Atividade')}</div>
                <div style="font-size:11px;color:var(--text3)">Etapa: <strong>${escapeHtml(l.stage || 'Geral')}</strong> · ${escapeHtml(l.author || 'Victor')}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <strong style="font-family:'Space Grotesk',sans-serif;font-size:13px;color:var(--accent);white-space:nowrap">${formatMinutes(l.minutes)}</strong>
              <button class="btn-icon btn-sm" style="color:var(--red)" onclick="deleteProjectTimeLog('${p.id}', '${l.id}')" title="Excluir apontamento"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  const manualDate = document.getElementById('ttManualDate');
  if (manualDate) manualDate.value = today();
  } catch(err) {
    console.error('Erro ao renderizar modal de horas:', err);
  }
}

function saveManualTimeLog() {
  if (!currentTtProjectId) return;
  const allProjs = (Array.isArray(projects) && projects.length) ? projects : JSON.parse(localStorage.getItem('mavic_projects') || '[]');
  const p = allProjs.find(x => String(x.id) === String(currentTtProjectId));
  if (!p) return;

  const date = document.getElementById('ttManualDate')?.value || today();
  const hours = parseFloat(document.getElementById('ttManualHours')?.value || 0);
  const minutes = parseInt(document.getElementById('ttManualMinutes')?.value || 0);
  const totalMin = Math.round((hours * 60) + minutes);

  const stage = p.column || 'Geral';
  const desc = document.getElementById('ttManualDesc')?.value.trim() || 'Trabalho realizado';

  if (totalMin <= 0) {
    return showToast('Informe ao menos 1 minuto de trabalho.', 'warning');
  }

  addProjectTimeLog(p.id, {
    date: date,
    minutes: totalMin,
    stage: stage,
    desc: desc,
    author: 'Victor'
  });

  document.getElementById('ttManualHours').value = '';
  document.getElementById('ttManualMinutes').value = '';
  document.getElementById('ttManualDesc').value = '';

  renderTimeTrackerModal(p.id);
  showToast('Horas registradas com sucesso!', 'success');
}

// Ping Supabase every 30 mins to prevent database pausing
setInterval(async()=>{
  if(!sb)return;
  try{await sb.from('mavic_store').select('key').limit(1);}catch(e){}
},30*60*1000);

document.addEventListener('DOMContentLoaded', async () => {
  // Inject shared layout, navbar and modals
  injectSharedLayout();

  // Automatically unregister Service Worker on localhost to prevent dev cache freezes
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '::1') {
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let reg of regs) {
          await reg.unregister();
        }
      } catch (err) {
        console.warn('SW unregister failed:', err);
      }
    }
  } else if ('serviceWorker' in navigator) {
    // Em produção, registra em toda página admin (antes só o Board fazia isso —
    // quem abrisse direto o Orçamentos/Pagamentos nunca instalava o cache offline).
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW:', e));
  }

  // Bind default values to theme
  applyTheme(localStorage.getItem('mavic_theme') || 'light');
  highlightActiveTab();
  renderGlobalTimerBar();

  await reloadPageData();
  document.body.classList.remove('preload');
});

// Roda o init da página atual (re-render a partir do estado global já carregado).
// Seguro chamar mais de uma vez — todas as páginas apenas reconstroem HTML a
// partir do zero (innerHTML) e os gráficos já se destroem antes de recriar.
function renderCurrentPage(){
  highlightActiveTab();
  updateGnNavBtn();
  populateProjectTypeSelects();
  updateNavAlertBadges();
  try {
    if (typeof initPage === 'function') {
      initPage();
    }
  } catch(err) {
    console.error('Page init failed:', err);
  }
}

// Carrega os dados e roda o init da página atual.
//
// Stale-while-revalidate: se já existe alguma coisa em cache local (ou seja,
// não é a primeira visita), a página renderiza IMEDIATAMENTE com os dados
// salvos — sem passar pela tela de carregamento — e só depois atualiza da
// nuvem por trás, em silêncio. É isso que resolve o "piscando tudo" ao trocar
// de menu: antes, toda navegação esperava a rede pra só então desenhar a tela.
// Na primeira visita (sem nada salvo ainda) não tem como fugir da espera.
async function reloadPageData(){
  const loadingEl = document.getElementById('loading');
  const hasCache = localStorage.getItem('mavic_config') !== null;

  if (hasCache) {
    loadLocal();
    renderCurrentPage();
    if (loadingEl) loadingEl.style.display = 'none';
    
    // Snapshot para checar se os dados remotos realmente mudaram
    const localSnap = JSON.stringify({
      p: projects, c: clients, b: budgets, s: services, n: notifications, gn: globalNotices,
      cols: appColumns, vCols: visibleColumns, minCols: minimizedColumns
    });

    try {
      await loadData();
    } catch(e) {
      console.error('Atualização em segundo plano falhou, mantendo dados locais', e);
      return;
    }

    const cloudSnap = JSON.stringify({
      p: projects, c: clients, b: budgets, s: services, n: notifications, gn: globalNotices,
      cols: appColumns, vCols: visibleColumns, minCols: minimizedColumns
    });

    // Só re-renderiza se os dados da nuvem forem diferentes do cache local
    if (localSnap !== cloudSnap) {
      renderCurrentPage();
    }
    return;
  }

  try {
    await loadData();
  } catch(e) {
    console.error('loadData failed, falling back to local storage caching', e);
    loadLocal();
  }
  renderCurrentPage();
  if (loadingEl) loadingEl.style.display = 'none';
}

// ══════════════════════════════════════════
//  INDICADOR DE OFFLINE + RESYNC AUTOMÁTICO
// ══════════════════════════════════════════
// Antes disso, se a internet caísse, só sincronizava de novo se a página
// fosse recarregada manualmente. Agora reage assim que o navegador percebe
// que a conexão voltou, sem precisar de F5.
(function injectOfflineBanner(){
  if(document.getElementById('offlineBanner')) return;
  const nav=document.querySelector('.nav');
  if(!nav) return; // só nas páginas admin
  const el=document.createElement('div');
  el.id='offlineBanner';
  el.className='offline-banner d-none';
  el.innerHTML='<span><i class="bi bi-wifi-off"></i> Sem conexão — trabalhando com os dados salvos neste dispositivo. Assim que a internet voltar, sincroniza sozinho.</span>';
  nav.insertAdjacentElement('afterend', el);
})();
function updateOfflineBanner(){
  const el=document.getElementById('offlineBanner');
  if(!el) return;
  el.classList.toggle('d-none', navigator.onLine);
}
window.addEventListener('load', updateOfflineBanner);
window.addEventListener('offline', updateOfflineBanner);
window.addEventListener('online', async () => {
  updateOfflineBanner();
  showToast('Conexão restabelecida — sincronizando…', 'success');
  await reloadPageData();
});

// ══════════════════════════════════════════
//  MÁSCARA DE MOEDA BRL (GLOBAL)
// ══════════════════════════════════════════
function maskCurrencyInput(el) {
  let digits = el.value.replace(/\D/g, '');
  if (!digits) { el.value = ''; return; }
  digits = digits.replace(/^0+(?=\d)/, '');
  while (digits.length < 3) digits = '0' + digits;
  const cents = digits.slice(-2);
  const intFormatted = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  el.value = `${intFormatted},${cents}`;
}
function parseCurrencyInput(str) {
  if (!str) return 0;
  const clean = String(str).replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}
function toBRLInputStr(num) {
  const cents = Math.round((parseFloat(num) || 0) * 100).toString().padStart(3, '0');
  const intFormatted = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFormatted},${cents.slice(-2)}`;
}

// ══════════════════════════════════════════
//  BACKUP E RESTAURAÇÃO DE DADOS (JSON)
// ══════════════════════════════════════════
function exportBackup() {
  const data = {
    projects,
    clients,
    notifications,
    global_notices: globalNotices,
    budgets,
    config: {
      columns: appColumns,
      visibleColumns,
      minimizedColumns,
      noteTemplates,
      quickMsgs,
      projectTypes,
      waTemplate: localStorage.getItem('mavic_waTemplate'),
      companyName: localStorage.getItem('mavic_companyName'),
      companyDoc: localStorage.getItem('mavic_companyDoc'),
      pixKey: localStorage.getItem('mavic_pixKey'),
      pixName: localStorage.getItem('mavic_pixName'),
      pixBank: localStorage.getItem('mavic_pixBank')
    }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_mavic_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backup exportado com sucesso!', 'success');
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      const projs = data.projects;
      const clis = data.clients;
      if (!projs || !clis) {
        showToast('Formato de arquivo inválido!', 'error');
        return;
      }
      showConfirm('Deseja realmente restaurar este backup? Isso substituirá todos os dados atuais (localmente e na nuvem).', () => {
        projects = projs;
        clients = clis;
        notifications = data.notifications || [];
        globalNotices = data.global_notices || data.globalNotices || [];
        budgets = data.budgets || [];
        if (data.config) {
          const cfg = data.config;
          if (cfg.columns) appColumns = cfg.columns;
          if (cfg.visibleColumns) visibleColumns = cfg.visibleColumns;
          if (cfg.minimizedColumns) minimizedColumns = cfg.minimizedColumns;
          if (cfg.noteTemplates) noteTemplates = cfg.noteTemplates;
          if (cfg.quickMsgs) quickMsgs = cfg.quickMsgs;
          if (cfg.projectTypes) projectTypes = cfg.projectTypes;
          if (cfg.waTemplate !== undefined) localStorage.setItem('mavic_waTemplate', cfg.waTemplate);
          if (cfg.companyName !== undefined) localStorage.setItem('mavic_companyName', cfg.companyName);
          if (cfg.companyDoc !== undefined) localStorage.setItem('mavic_companyDoc', cfg.companyDoc);
          if (cfg.pixKey !== undefined) localStorage.setItem('mavic_pixKey', cfg.pixKey);
          if (cfg.pixName !== undefined) localStorage.setItem('mavic_pixName', cfg.pixName);
          if (cfg.pixBank !== undefined) localStorage.setItem('mavic_pixBank', cfg.pixBank);
        }
        scheduleSync();
        renderCurrentPage();
        showToast('Backup restaurado com sucesso!', 'success');
      });
    } catch (err) {
      showToast('Erro ao ler arquivo de backup!', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ══════════════════════════════════════════
//  CSV EXPORT HELPER (UTF-8 BOM para Excel)
// ══════════════════════════════════════════
function exportToCSV(filename, headers, rows) {
  try {
    const csvContent = '\uFEFF' + [
      headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(';'),
      ...rows.map(row => row.map(v => `"${String(v !== undefined && v !== null ? v : '').replace(/"/g, '""')}"`).join(';'))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Planilha CSV exportada!', 'success');
  } catch(e) {
    console.error('Erro ao exportar CSV:', e);
    showToast('Erro ao exportar planilha', 'error');
  }
}

// ══════════════════════════════════════════
//  GLOBAL KEYBOARD SHORTCUTS
// ══════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;

  // 1. Focar busca: "/" ou "Ctrl+K" / "Cmd+K"
  if ((e.key === '/' && !isInput) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
    e.preventDefault();
    const searchInp = document.getElementById('srch') || 
                      document.getElementById('fOrcSearch') || 
                      document.getElementById('fPaySearch') || 
                      document.getElementById('fPendingSearch') || 
                      document.getElementById('fServSearch') || 
                      document.getElementById('srchRep') || 
                      document.getElementById('cliSearch');
    if (searchInp) {
      searchInp.focus();
      searchInp.select?.();
    }
  }

  // 2. Novo item com tecla "N" (fora de inputs)
  if (e.key.toLowerCase() === 'n' && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (typeof openProjectModal === 'function' && document.getElementById('boardView')) {
      e.preventDefault();
      openProjectModal();
    } else if (typeof openCreateOrcModal === 'function' && document.getElementById('orcamentosView')) {
      e.preventDefault();
      openCreateOrcModal();
    } else if (typeof openCreatePaymentModal === 'function' && document.getElementById('pagamentosView')) {
      e.preventDefault();
      openCreatePaymentModal();
    } else if (typeof openNewServiceModal === 'function' && document.getElementById('servicosView')) {
      e.preventDefault();
      openNewServiceModal();
    }
  }

  // 3. Escape para fechar modais e dropdowns
  if (e.key === 'Escape') {
    document.querySelectorAll('.overlay.open, .overlay[style*="display: flex"], .overlay[style*="display: block"]').forEach(ov => {
      ov.classList.remove('open');
      ov.style.display = 'none';
    });
    document.querySelectorAll('.sort-menu.open, .table-action-dropdown.open').forEach(dd => dd.classList.remove('open'));
  }
});

// Sincronização em tempo real do cronômetro entre abas e páginas
window.addEventListener('storage', (e) => {
  if (e.key === 'mavic_active_timer' || e.key === 'mavic_projects') {
    if (typeof renderGlobalTimerBar === 'function') renderGlobalTimerBar();
    if (typeof renderBoard === 'function') renderBoard();
  }
});

