// ══════════════════════════════════════════
//  DASHBOARD / FINANCES SUMMARY LOGIC
// ══════════════════════════════════════════
function initPage() {
  renderDashboard();
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

function renderDashboard(){
  try {
    const dashCards = document.getElementById('dashCards');
    if(!dashCards) return;
    
    const periodSel = document.getElementById('dashPeriodSelect');
    const period = periodSel ? periodSel.value : 'all';
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let allProjs = Array.isArray(projects) ? projects : [];
    let active = allProjs.filter(p => p && !p.archived);

    // Filtra projetos por período se selecionado
    if (period === 'year') {
      active = active.filter(p => {
        const dt = parseDateSafe(p.createdAt || p.date);
        return dt ? dt.getFullYear() === currentYear : true;
      });
    } else if (period === 'month') {
      active = active.filter(p => {
        const dt = parseDateSafe(p.createdAt || p.date);
        return dt ? (dt.getFullYear() === currentYear && dt.getMonth() === currentMonth) : true;
      });
    }

    const totalVal = active.reduce((s, p) => s + parseFloat(p.value || 0), 0);
    const totalPaid = active.reduce((s, p) => s + (Array.isArray(p.payments) ? p.payments : []).reduce((a, x) => a + parseFloat(x.amount || 0), 0), 0);
    const totalPend = Math.max(0, totalVal - totalPaid);
    const concl = active.filter(p => isFinalColumn(p.column)).length;
    const fin = active.filter(p => isHiddenColumn(p.column)).length;
    
    const todayMid = new Date().setHours(0, 0, 0, 0);
    const venc = active.filter(p => {
      if (!p.date || isFinalColumn(p.column) || isHiddenColumn(p.column)) return false;
      const dl = parseDateSafe(p.date);
      return dl ? dl.getTime() < todayMid : false;
    }).length;

    const pendingProjs = active.filter(p => {
      const t = parseFloat(p.value || 0);
      const pg = (Array.isArray(p.payments) ? p.payments : []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
      return t > 0 && pg < t;
    });
    
    const periodSub = period === 'month' ? 'deste mês' : period === 'year' ? `em ${currentYear}` : 'ativos';
    const totalClientsCount = Array.isArray(clients) ? clients.length : 0;

    let totalMinutesWorked = 0;
    active.forEach(p => {
      (p.timeLogs || []).forEach(l => { totalMinutesWorked += parseInt(l.minutes || 0); });
    });
    const totalHoursWorked = (totalMinutesWorked / 60).toFixed(1);

    dashCards.innerHTML = `
      <div class="dash-card dc-accent">
        <div class="dc-top"><div class="dc-lbl">Faturamento Total</div><div class="dc-icon" style="background:var(--accent-bg);color:var(--accent)"><i class="bi bi-cash-stack"></i></div></div>
        <div class="dc-val">${fmt(totalVal)}</div>
        <div class="dc-sub">${active.length} projetos ${periodSub}</div>
      </div>
      <div class="dash-card dc-green">
        <div class="dc-top"><div class="dc-lbl">Total Recebido</div><div class="dc-icon" style="background:var(--green-bg);color:var(--green)"><i class="bi bi-check-circle"></i></div></div>
        <div class="dc-val">${fmt(totalPaid)}</div>
        <div class="dc-sub">${Math.round(totalVal ? totalPaid / totalVal * 100 : 0)}% do total contratado</div>
      </div>
      <div class="dash-card dc-red">
        <div class="dc-top"><div class="dc-lbl">Saldo a Receber</div><div class="dc-icon" style="background:var(--red-bg);color:var(--red)"><i class="bi bi-hourglass-split"></i></div></div>
        <div class="dc-val">${fmt(totalPend)}</div>
        <div class="dc-sub">${pendingProjs.length} projetos com pendência</div>
      </div>
      <div class="dash-card">
        <div class="dc-top"><div class="dc-lbl">Horas Trabalhadas</div><div class="dc-icon" style="background:var(--accent-bg);color:var(--accent)"><i class="bi bi-stopwatch"></i></div></div>
        <div class="dc-val" style="color:var(--accent)">${totalHoursWorked}h</div>
        <div class="dc-sub">${formatMinutes(totalMinutesWorked)} apontados</div>
      </div>
      <div class="dash-card">
        <div class="dc-top"><div class="dc-lbl">Concluídos</div><div class="dc-icon" style="background:var(--green-bg);color:var(--green)"><i class="bi bi-flag"></i></div></div>
        <div class="dc-val" style="color:var(--green)">${concl}</div>
        <div class="dc-sub">de ${active.length} projetos ${periodSub}</div>
      </div>
      <div class="dash-card">
        <div class="dc-top"><div class="dc-lbl">Finalizados</div><div class="dc-icon" style="background:var(--surface2);color:var(--text2)"><i class="bi bi-eye-slash-fill"></i></div></div>
        <div class="dc-val" style="color:var(--text2)">${fin}</div>
        <div class="dc-sub">arquivados / ocultos</div>
      </div>
      <div class="dash-card">
        <div class="dc-top"><div class="dc-lbl">Vencidos</div><div class="dc-icon" style="background:${venc > 0 ? 'var(--red-bg)' : 'var(--surface2)'};color:${venc > 0 ? 'var(--red)' : 'var(--text3)'}"><i class="bi bi-exclamation-triangle"></i></div></div>
        <div class="dc-val" style="color:${venc > 0 ? 'var(--red)' : 'var(--text3)'}">${venc}</div>
        <div class="dc-sub">projetos com prazo estourado</div>
      </div>
      <div class="dash-card">
        <div class="dc-top"><div class="dc-lbl">Clientes</div><div class="dc-icon" style="background:var(--accent-bg);color:var(--accent)"><i class="bi bi-people"></i></div></div>
        <div class="dc-val" style="color:var(--accent)">${totalClientsCount}</div>
        <div class="dc-sub">cadastrados no CRM</div>
      </div>`;

    // 1. Renderizar Tabela de Prazos Críticos e Atrasados
    const criticalTable = document.getElementById('criticalTable');
    const badgeCritical = document.getElementById('badgeCriticalCount');
    if (criticalTable) {
      const criticalProjs = active.filter(p => {
        if (isFinalColumn(p.column) || isHiddenColumn(p.column)) return false;
        if (!p.date) return false;
        const dl = parseDateSafe(p.date);
        if (!dl) return false;
        const diff = Math.ceil((dl.getTime() - todayMid) / 86400000);
        return diff <= 7;
      }).sort((a,b) => {
        const da = parseDateSafe(a.date);
        const db = parseDateSafe(b.date);
        if (!da) return 1;
        if (!db) return -1;
        return da.getTime() - db.getTime();
      });

      if (badgeCritical) badgeCritical.textContent = criticalProjs.length;

      if (!criticalProjs.length) {
        const fillerHtml = '<tr class="pg-filler-row" aria-hidden="true"><td colspan="5">&nbsp;</td></tr>'.repeat(3);
        criticalTable.innerHTML = `<table>
          <thead>
            <tr><th>Projeto</th><th>Cliente</th><th>Etapa</th><th>Prazo</th><th>Situação</th></tr>
          </thead>
          <tbody>
            <tr><td colspan="5" style="text-align:center;color:var(--text3);height:48px;padding:12px 16px"><i class="bi bi-emoji-smile" style="font-size:15px;color:var(--green);margin-right:6px"></i>Todos os prazos estão em dia! 🎉</td></tr>
            ${fillerHtml}
          </tbody>
        </table>`;
      } else {
        const fillerCount = Math.max(0, 4 - criticalProjs.length);
        const fillerHtml = '<tr class="pg-filler-row" aria-hidden="true"><td colspan="5">&nbsp;</td></tr>'.repeat(fillerCount);
        criticalTable.innerHTML = `<table>
          <thead>
            <tr><th>Projeto</th><th>Cliente</th><th>Etapa</th><th>Prazo</th><th>Situação</th></tr>
          </thead>
          <tbody>${criticalProjs.map(p => {
            const dl = parseDateSafe(p.date);
            const diff = dl ? Math.ceil((dl.getTime() - todayMid) / 86400000) : 0;
            let sitHtml = '';
            if (diff < 0) {
              sitHtml = `<span class="badge b-venc"><i class="bi bi-exclamation-circle"></i> Atrasado (${Math.abs(diff)}d)</span>`;
            } else if (diff === 0) {
              sitHtml = `<span class="badge b-urg"><i class="bi bi-alarm"></i> Vence hoje</span>`;
            } else {
              sitHtml = `<span class="badge b-urg"><i class="bi bi-hourglass-split"></i> Vence em ${diff}d</span>`;
            }
            return `<tr>
              <td style="font-weight:600"><a href="index.html?openProj=${p.id}" style="color:inherit;text-decoration:none;border-bottom:1px dashed var(--border2)" title="Ver no quadro">${escapeHtml(p.name)}</a></td>
              <td>${escapeHtml(p.client)}</td>
              <td><span class="badge" style="background:${typeBg(p.type)};color:${typeColor(p.type)}">${escapeHtml(p.column)}</span></td>
              <td>${formatDateSafe(p.date)}</td>
              <td>${sitHtml}</td>
            </tr>`;
          }).join('')}${fillerHtml}</tbody>
        </table>`;
      }
    }
      
    // 2. Renderizar Tabela de Saldo Pendente
    const sorted = pendingProjs.sort((a,b) => {
      const pa = Array.isArray(a.payments) ? a.payments : [];
      const pb = Array.isArray(b.payments) ? b.payments : [];
      const ra = parseFloat(a.value || 0) - pa.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
      const rb = parseFloat(b.value || 0) - pb.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
      return rb - ra;
    });
    
    const dashTable = document.getElementById('dashTable');
    const badgePending = document.getElementById('badgePendingCount');
    if (badgePending) badgePending.textContent = sorted.length;

    if (dashTable) {
      if (!sorted.length) {
        const fillerHtml = '<tr class="pg-filler-row" aria-hidden="true"><td colspan="7">&nbsp;</td></tr>'.repeat(3);
        dashTable.innerHTML = `<table>
          <thead>
            <tr><th>Projeto</th><th>Cliente</th><th>Etapa</th><th style="text-align:right">Total</th><th style="text-align:right">Recebido</th><th style="text-align:right">Saldo</th><th>Prazo</th></tr>
          </thead>
          <tbody>
            <tr><td colspan="7" style="text-align:center;color:var(--text3);height:48px;padding:12px 16px"><i class="bi bi-check2-circle" style="font-size:15px;color:var(--green);margin-right:6px"></i>Nenhum saldo pendente! ✅</td></tr>
            ${fillerHtml}
          </tbody>
        </table>`;
      } else {
        const fillerCount = Math.max(0, 4 - sorted.length);
        const fillerHtml = '<tr class="pg-filler-row" aria-hidden="true"><td colspan="7">&nbsp;</td></tr>'.repeat(fillerCount);
        dashTable.innerHTML = `<table>
          <thead>
            <tr><th>Projeto</th><th>Cliente</th><th>Etapa</th><th style="text-align:right">Total</th><th style="text-align:right">Recebido</th><th style="text-align:right">Saldo</th><th>Prazo</th></tr>
          </thead>
          <tbody>${sorted.map(p => {
            const t = parseFloat(p.value || 0);
            const pg = (Array.isArray(p.payments) ? p.payments : []).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
            const rest = t - pg;
            const dl = parseDateSafe(p.date);
            const diff = dl ? Math.ceil((dl.getTime() - todayMid) / 86400000) : null;
            const dtxt = dl ? `<span style="color:${diff < 0 ? 'var(--red)' : diff <= 7 ? 'var(--yellow)' : 'var(--text2)'}">${formatDateSafe(p.date)}</span>` : '—';
            return `<tr>
              <td style="font-weight:600"><a href="index.html?openProj=${p.id}" style="color:inherit;text-decoration:none;border-bottom:1px dashed var(--border2)" title="Ver no quadro">${escapeHtml(p.name)}</a></td>
              <td>${escapeHtml(p.client)}</td>
              <td><span class="badge" style="background:${typeBg(p.type)};color:${typeColor(p.type)}">${escapeHtml(p.column)}</span></td>
              <td style="font-family:'Outfit',sans-serif;font-weight:700;font-size:13px;text-align:right">${fmt(t)}</td>
              <td style="font-family:'Outfit',sans-serif;font-weight:700;font-size:13px;color:var(--green);text-align:right">${fmt(pg)}</td>
              <td style="font-family:'Outfit',sans-serif;font-weight:700;font-size:13px;color:var(--red);text-align:right">${fmt(rest)}</td>
              <td>${dtxt}</td>
            </tr>`;
          }).join('')}${fillerHtml}</tbody>
        </table>`;
      }
    }
  } catch (err) {
    console.error('Erro ao renderizar dashboard:', err);
  }
}
