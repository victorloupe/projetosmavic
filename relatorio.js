// ══════════════════════════════════════════
//  RELATÓRIOS & GRÁFICOS (CHART.JS)
// ══════════════════════════════════════════
let chartMonthly = null;
let chartStatus = null;
let chartTypes = null;

function initPage() {
  updateClientFilter();
  updateStageFilter();
  
  // Default to current year and current month
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  
  const ySel = document.getElementById('fRepYear');
  if (ySel && !ySel.value) ySel.value = currentYear;
  
  const mSel = document.getElementById('fRepMonth');
  if (mSel && !mSel.value) mSel.value = currentMonth;

  renderRelatorios();
}

function filterProjectsByPeriod(projs, yearFilter, monthFilter) {
  if (!yearFilter && !monthFilter) return projs;
  return projs.filter(p => {
    let pYear = '';
    let pMonth = '';
    if (p.createdAt) {
      const d = new Date(p.createdAt);
      pYear = String(d.getFullYear());
      pMonth = String(d.getMonth() + 1).padStart(2, '0');
    } else if (p.date) {
      pYear = p.date.substring(0, 4);
      pMonth = p.date.substring(5, 7);
    } else {
      return false;
    }
    const matchYear = !yearFilter || pYear === yearFilter;
    const matchMonth = !monthFilter || pMonth === monthFilter;
    return matchYear && matchMonth;
  });
}

function clearRepFilters() {
  const srch = document.getElementById('srchRep');
  const cli = document.getElementById('fRepClient');
  const yr = document.getElementById('fRepYear');
  const mo = document.getElementById('fRepMonth');
  const tp = document.getElementById('fRepType');
  const st = document.getElementById('fRepStage');
  const pr = document.getElementById('fRepPriority');
  if (srch) srch.value = '';
  if (cli) cli.value = '';
  if (yr) yr.value = '';
  if (mo) mo.value = '';
  if (tp) tp.value = '';
  if (st) st.value = '';
  if (pr) pr.value = '';
  renderRelatorios();
}

function renderRelatorios() {
  const clientFilter = document.getElementById('fRepClient').value;
  const yearFilter = document.getElementById('fRepYear').value;
  const monthFilter = document.getElementById('fRepMonth').value;
  const typeFilter = document.getElementById('fRepType').value;
  const stageFilter = document.getElementById('fRepStage').value;
  const priorityFilter = document.getElementById('fRepPriority').value;
  const srch = document.getElementById('srchRep')?.value.toLowerCase().trim() || '';
  
  let filteredProjects = projects.filter(p => !p.archived);
  let filteredBudgets = [...budgets];

  if (srch) {
    filteredProjects = filteredProjects.filter(p => 
      (p.name && p.name.toLowerCase().includes(srch)) || 
      (p.client && p.client.toLowerCase().includes(srch))
    );
    filteredBudgets = filteredBudgets.filter(b => 
      (b.title && b.title.toLowerCase().includes(srch)) || 
      (b.client && b.client.toLowerCase().includes(srch))
    );
  }
  
  if (clientFilter) {
    filteredProjects = filteredProjects.filter(p => p.client === clientFilter);
    filteredBudgets = filteredBudgets.filter(b => b.client === clientFilter);
  }
  if (typeFilter) {
    filteredProjects = filteredProjects.filter(p => p.type === typeFilter);
    filteredBudgets = filteredBudgets.filter(b => b.projectType === typeFilter);
  }
  if (stageFilter) {
    filteredProjects = filteredProjects.filter(p => p.column === stageFilter);
    filteredBudgets = [];
  }
  if (priorityFilter) {
    filteredProjects = filteredProjects.filter(p => p.priority === priorityFilter);
    filteredBudgets = [];
  }
  
  let billingProjects = filterProjectsByPeriod(filteredProjects, yearFilter, monthFilter);
  const totalBilled = billingProjects.reduce((s, p) => s + parseFloat(p.value || 0), 0);
  
  // Received sum calculation
  let receivedSum = 0;
  filteredProjects.forEach(p => {
    const pays = Array.isArray(p.payments) ? p.payments : [];
    pays.forEach(pay => {
      const matchYear = !yearFilter || (pay.date && pay.date.startsWith(yearFilter));
      const matchMonth = !monthFilter || (pay.date && pay.date.substring(5, 7) === monthFilter);
      if (matchYear && matchMonth) {
        receivedSum += parseFloat(pay.amount || 0);
      }
    });
  });
  
  const totalPaid = receivedSum;
  // Saldo pendente real dos projetos contratados no período selecionado (nunca negativo)
  const totalRest = billingProjects.reduce((s, p) => {
    const v = parseFloat(p.value || 0);
    const pd = (Array.isArray(p.payments) ? p.payments : []).reduce((a, x) => a + parseFloat(x.amount || 0), 0);
    return s + Math.max(0, v - pd);
  }, 0);
  
  const paidPct = totalBilled ? Math.round((totalPaid / totalBilled) * 100) : 0;
  const restPct = totalBilled ? Math.round((totalRest / totalBilled) * 100) : 0;
  
  let activeBudgets = filteredBudgets.filter(b => b.status === 'Pendente' || b.status === 'Parcial');
  if (yearFilter || monthFilter) {
    activeBudgets = activeBudgets.filter(b => {
      if (!b.date) return false;
      const matchYear = !yearFilter || b.date.startsWith(yearFilter);
      const matchMonth = !monthFilter || b.date.substring(5, 7) === monthFilter;
      return matchYear && matchMonth;
    });
  }
  const pendingBudgetsVal = activeBudgets.reduce((s, b) => s + Math.max(0, parseFloat(b.total || 0) - (parseFloat(b.discount) || 0)), 0);
  
  let totalFilteredMinutes = 0;
  let totalFilteredLogsCount = 0;
  billingProjects.forEach(p => {
    (p.timeLogs || []).forEach(l => {
      let lDate = l.date;
      let matchDate = true;
      if (yearFilter && (!lDate || !lDate.startsWith(yearFilter))) matchDate = false;
      if (monthFilter && (!lDate || lDate.substring(5, 7) !== monthFilter)) matchDate = false;
      if (matchDate) {
        totalFilteredMinutes += parseInt(l.minutes || 0);
        totalFilteredLogsCount++;
      }
    });
  });
  const totalFilteredHours = (totalFilteredMinutes / 60).toFixed(1);

  document.getElementById('repTotalBilled').textContent = fmt(totalBilled);
  document.getElementById('repTotalPaid').textContent = fmt(totalPaid);
  document.getElementById('repPaidPct').textContent = `${paidPct}% do faturamento`;
  document.getElementById('repTotalRest').textContent = fmt(totalRest);
  document.getElementById('repRestPct').textContent = `${restPct}% pendente`;
  document.getElementById('repPendingOrcCount').textContent = activeBudgets.length;
  document.getElementById('repPendingOrcValue').textContent = `${fmt(pendingBudgetsVal)} em negociação`;
  
  const repHoursEl = document.getElementById('repHoursWorked');
  const repHoursSubEl = document.getElementById('repHoursSub');
  if (repHoursEl) repHoursEl.textContent = `${totalFilteredHours}h`;
  if (repHoursSubEl) repHoursSubEl.textContent = `${formatMinutes(totalFilteredMinutes)} (${totalFilteredLogsCount} sessões)`;
  
  setTimeout(() => {
    initMonthlyRevenueChart(clientFilter, yearFilter, typeFilter, stageFilter, priorityFilter, monthFilter);
    initProjectStatusChart(clientFilter, yearFilter, typeFilter, stageFilter, priorityFilter, monthFilter);
    initProjectTypesChart(clientFilter, yearFilter, typeFilter, stageFilter, priorityFilter, monthFilter);
  }, 100);
}

function initMonthlyRevenueChart(clientFilter, yearFilter, typeFilter, stageFilter, priorityFilter, monthFilter) {
  const canvas = document.getElementById('chartMonthlyRevenue');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (chartMonthly) {
    chartMonthly.destroy();
  }
  
  const monthsExt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const now = new Date();
  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const label = monthsExt[d.getMonth()] + '/' + String(d.getFullYear()).substring(2);
    last6Months.push({ key, label, amount: 0 });
  }
  
  projects.forEach(p => {
    if (clientFilter && p.client !== clientFilter) return;
    if (typeFilter && p.type !== typeFilter) return;
    if (stageFilter && p.column !== stageFilter) return;
    if (priorityFilter && p.priority !== priorityFilter) return;
    const pays = Array.isArray(p.payments) ? p.payments : [];
    pays.forEach(pay => {
      if (pay.date) {
        const payMonthKey = pay.date.substring(0, 7);
        const found = last6Months.find(m => m.key === payMonthKey);
        if (found) {
          found.amount += parseFloat(pay.amount || 0);
        }
      }
    });
  });
  
  const labels = last6Months.map(m => m.label);
  const data = last6Months.map(m => m.amount);
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';
  const gridColor = isDark ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.6)';
  
  chartMonthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Recebido (R$)',
        data: data,
        backgroundColor: '#92623a',
        borderRadius: 6,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ' ' + fmt(context.raw);
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor },
          grid: { display: false }
        },
        y: {
          ticks: { color: textColor },
          grid: { color: gridColor }
        }
      }
    }
  });
}

function initProjectStatusChart(clientFilter, yearFilter, typeFilter, stageFilter, priorityFilter, monthFilter) {
  const canvas = document.getElementById('chartProjectStatus');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (chartStatus) {
    chartStatus.destroy();
  }
  
  // Colunas "encerradas" (ex: Finalizado) ficam de fora — como não têm mais
  // ação pendente, só cresceriam pra sempre e dominariam o gráfico, escondendo
  // a distribuição das etapas realmente ativas.
  let active = projects.filter(p => !p.archived && !isHiddenColumn(p.column));
  if (clientFilter) {
    active = active.filter(p => p.client === clientFilter);
  }
  active = filterProjectsByPeriod(active, yearFilter, monthFilter);
  if (typeFilter) {
    active = active.filter(p => p.type === typeFilter);
  }
  if (stageFilter) {
    active = active.filter(p => p.column === stageFilter);
  }
  if (priorityFilter) {
    active = active.filter(p => p.priority === priorityFilter);
  }

  const activeCols = appColumns.filter(c => !isHiddenColumn(c.id));
  const labels = activeCols.map(c => c.id);
  const data = labels.map(colName => active.filter(p => p.column === colName).length);
  const colors = activeCols.map(c => c.color || '#92623a');
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';
  
  chartStatus = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: isDark ? 2 : 1,
        borderColor: isDark ? '#1f2937' : '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            boxWidth: 10,
            padding: 8,
            font: { size: 10 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ' ' + context.raw + ' projeto(s)';
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}

function initProjectTypesChart(clientFilter, yearFilter, typeFilter, stageFilter, priorityFilter, monthFilter) {
  const canvas = document.getElementById('chartProjectTypes');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (chartTypes) {
    chartTypes.destroy();
  }
  
  let active = projects.filter(p => !p.archived);
  if (clientFilter) {
    active = active.filter(p => p.client === clientFilter);
  }
  active = filterProjectsByPeriod(active, yearFilter, monthFilter);
  if (typeFilter) {
    active = active.filter(p => p.type === typeFilter);
  }
  if (stageFilter) {
    active = active.filter(p => p.column === stageFilter);
  }
  if (priorityFilter) {
    active = active.filter(p => p.priority === priorityFilter);
  }
  
  const types = projectTypes.length ? projectTypes : INIT_PROJECT_TYPES;
  const labels = types.map(t => t.id);
  const data = labels.map(tName => active.filter(p => p.type === tName).length);
  const colors = types.map(t => t.color);
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';
  
  chartTypes = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: isDark ? 2 : 1,
        borderColor: isDark ? '#1f2937' : '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            boxWidth: 10,
            padding: 8,
            font: { size: 10 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ' ' + context.raw + ' projeto(s)';
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}

function updateClientFilter(){
  const list = clients.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
  const rSel=document.getElementById('fRepClient');
  if(rSel) {
    const rCur=rSel.value;
    rSel.innerHTML='<option value="">Todos os Clientes</option>'+list;
    if(rCur)rSel.value=rCur;
  }
}

function updateStageFilter() {
  const sSel = document.getElementById('fRepStage');
  if (sSel) {
    const cur = sSel.value;
    sSel.innerHTML = '<option value="">Todas as Etapas</option>' + 
      appColumns.map(c => `<option value="${c.id}">${c.id}</option>`).join('');
    if (cur) sSel.value = cur;
  }
}
