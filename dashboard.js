// ══════════════════════════════════════════
//  DASHBOARD / FINANCES SUMMARY LOGIC
// ══════════════════════════════════════════
function initPage() {
  renderDashboard();
}

function renderDashboard(){
  const dashCards = document.getElementById('dashCards');
  if(!dashCards) return;
  
  const active=projects.filter(p=>!p.archived);
  const totalVal=active.reduce((s,p)=>s+parseFloat(p.value||0),0);
  const totalPaid=active.reduce((s,p)=>s+(p.payments||[]).reduce((a,x)=>a+parseFloat(x.amount||0),0),0);
  const totalPend=totalVal-totalPaid;
  const concl=active.filter(p=>isFinalColumn(p.column)).length;
  const fin=active.filter(p=>isHiddenColumn(p.column)).length;
  const venc=active.filter(p=>{if(!p.date||isFinalColumn(p.column))return false;return new Date(p.date+'T12:00:00')<new Date().setHours(0,0,0,0);}).length;
  const pendingProjs=active.filter(p=>{const t=parseFloat(p.value||0);const pg=(p.payments||[]).reduce((s,x)=>s+parseFloat(x.amount||0),0);return t>0&&pg<t;});
  
  dashCards.innerHTML=`
    <div class="dash-card dc-accent"><div class="dc-top"><div class="dc-lbl">Faturamento Total</div><div class="dc-icon" style="background:var(--accent-bg);color:var(--accent)"><i class="bi bi-cash-stack"></i></div></div><div class="dc-val">${fmt(totalVal)}</div><div class="dc-sub">${active.length} projetos ativos</div></div>
    <div class="dash-card dc-green"><div class="dc-top"><div class="dc-lbl">Total Recebido</div><div class="dc-icon" style="background:var(--green-bg);color:var(--green)"><i class="bi bi-check-circle"></i></div></div><div class="dc-val">${fmt(totalPaid)}</div><div class="dc-sub">${Math.round(totalVal?totalPaid/totalVal*100:0)}% do total</div></div>
    <div class="dash-card dc-red"><div class="dc-top"><div class="dc-lbl">A Receber</div><div class="dc-icon" style="background:var(--red-bg);color:var(--red)"><i class="bi bi-hourglass-split"></i></div></div><div class="dc-val">${fmt(totalPend)}</div><div class="dc-sub">${pendingProjs.length} projetos pendentes</div></div>
    <div class="dash-card"><div class="dc-top"><div class="dc-lbl">Concluídos</div><div class="dc-icon" style="background:var(--green-bg);color:var(--green)"><i class="bi bi-flag"></i></div></div><div class="dc-val" style="color:var(--green)">${concl}</div><div class="dc-sub">de ${active.length} ativos</div></div>
    <div class="dash-card"><div class="dc-top"><div class="dc-lbl">Finalizados</div><div class="dc-icon" style="background:var(--surface2);color:var(--text2)"><i class="bi bi-eye-slash-fill"></i></div></div><div class="dc-val" style="color:var(--text2)">${fin}</div><div class="dc-sub">não aparecem pro cliente</div></div>
    <div class="dash-card"><div class="dc-top"><div class="dc-lbl">Vencidos</div><div class="dc-icon" style="background:${venc>0?'var(--red-bg)':'var(--surface2)'};color:${venc>0?'var(--red)':'var(--text3)'}"><i class="bi bi-exclamation-triangle"></i></div></div><div class="dc-val" style="color:${venc>0?'var(--red)':'var(--text3)'}">${venc}</div><div class="dc-sub">projetos com prazo vencido</div></div>
    <div class="dash-card"><div class="dc-top"><div class="dc-lbl">Clientes</div><div class="dc-icon" style="background:var(--accent-bg);color:var(--accent)"><i class="bi bi-people"></i></div></div><div class="dc-val" style="color:var(--accent)">${clients.length}</div><div class="dc-sub">no CRM</div></div>`;

  // 1. Renderizar Tabela de Prazos Críticos e Atrasados
  const criticalTable = document.getElementById('criticalTable');
  if (criticalTable) {
    const criticalProjs = active.filter(p => {
      if (isFinalColumn(p.column) || isHiddenColumn(p.column)) return false;
      if (!p.date) return false;
      const dl = new Date(p.date + 'T12:00:00');
      const diff = Math.ceil((dl - new Date().setHours(0,0,0,0)) / 86400000);
      return diff <= 7; // Atrasado ou vence em até 7 dias
    }).sort((a,b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    });

    if (!criticalProjs.length) {
      criticalTable.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3)">Nenhum prazo crítico! 🎉</div>';
    } else {
      criticalTable.innerHTML = `<table><thead><tr><th>Projeto</th><th>Cliente</th><th>Etapa</th><th>Prazo</th><th>Situação</th></tr></thead><tbody>${criticalProjs.map(p => {
        const dl = new Date(p.date + 'T12:00:00');
        const diff = Math.ceil((dl - new Date().setHours(0,0,0,0)) / 86400000);
        let sitHtml = '';
        if (diff < 0) {
          sitHtml = `<span class="badge b-venc">🔴 Atrasado (${Math.abs(diff)}d)</span>`;
        } else if (diff === 0) {
          sitHtml = `<span class="badge b-urg">🟡 Vence hoje</span>`;
        } else {
          sitHtml = `<span class="badge b-urg">🟡 Vence em ${diff}d</span>`;
        }
        return `<tr>
          <td style="font-weight:600"><a href="index.html?openProj=${p.id}" style="color:inherit;text-decoration:none;border-bottom:1px dashed var(--border2)" title="Ver no quadro">${p.name}</a></td>
          <td>${p.client}</td>
          <td><span class="badge" style="background:${typeBg(p.type)};color:${typeColor(p.type)}">${p.column}</span></td>
          <td>${dl.toLocaleDateString('pt-BR')}</td>
          <td>${sitHtml}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
    }
  }
    
  // 2. Renderizar Tabela de Saldo Pendente
  const sorted=pendingProjs.sort((a,b)=>{const ra=parseFloat(a.value||0)-(a.payments||[]).reduce((s,x)=>s+parseFloat(x.amount||0),0);const rb=parseFloat(b.value||0)-(b.payments||[]).reduce((s,x)=>s+parseFloat(x.amount||0),0);return rb-ra;});
  const dashTable = document.getElementById('dashTable');
  if(!sorted.length){dashTable.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3)">Nenhum saldo pendente! ✅</div>';return;}
  
  dashTable.innerHTML=`<table><thead><tr><th>Projeto</th><th>Cliente</th><th>Etapa</th><th>Total</th><th>Recebido</th><th>Saldo</th><th>Prazo</th></tr></thead><tbody>${sorted.map(p=>{
    const t=parseFloat(p.value||0);const pg=(p.payments||[]).reduce((s,x)=>s+parseFloat(x.amount||0),0);const rest=t-pg;
    const dl=p.date?new Date(p.date+'T12:00:00'):null;const diff=dl?Math.ceil((dl-new Date().setHours(0,0,0,0))/86400000):null;
    const dtxt=dl?`<span style="color:${diff<0?'var(--red)':diff<=7?'var(--yellow)':'var(--text2)'}">${dl.toLocaleDateString('pt-BR')}</span>`:'—';
    return `<tr><td style="font-weight:600"><a href="index.html?openProj=${p.id}" style="color:inherit;text-decoration:none;border-bottom:1px dashed var(--border2)" title="Ver no quadro">${p.name}</a></td><td>${p.client}</td><td><span class="badge" style="background:${typeBg(p.type)};color:${typeColor(p.type)}">${p.column}</span></td><td style="font-family:'Courier New',monospace">${fmt(t)}</td><td style="font-family:'Courier New',monospace;color:var(--green)">${fmt(pg)}</td><td style="font-family:'Courier New',monospace;font-weight:700;color:var(--red)">${fmt(rest)}</td><td>${dtxt}</td></tr>`;
  }).join('')}</tbody></table>`;
}
