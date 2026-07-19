/* Rendering. Identical for every client — edit here once. */

window.startDashboard = function (DATA) {
  const { rawData, vendorInfo, scheduleData, totalProjectEstimated } = DATA;

  const formatCurrency = (num, showCents = false) =>
    '₪' + num.toLocaleString('en-US', {
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0
    });

  const parsedData = rawData.map(item => {
    const [day, month, year] = item.date.split('/');
    return {
      ...item,
      dateObj: new Date(year, month - 1, day),
      monthKey: `${year}-${month}`
    };
  }).sort((a, b) => a.dateObj - b.dateObj);

  let totalPaid = 0;
  const paymentsByMonth = {}, paymentsByVendor = {}, paymentsByScope = {};

  parsedData.forEach(row => {
    totalPaid += row.paidNum;
    paymentsByMonth[row.monthKey] = (paymentsByMonth[row.monthKey] || 0) + row.paidNum;
    paymentsByVendor[row.vendor]  = (paymentsByVendor[row.vendor]  || 0) + row.paidNum;
    paymentsByScope[row.scope]    = (paymentsByScope[row.scope]    || 0) + row.paidNum;
  });

  const totalBalance = totalProjectEstimated - totalPaid;
  const totalPercentage = ((totalPaid / totalProjectEstimated) * 100).toFixed(2);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  function animateCount(el, target, formatter, duration = 1300) {
    if (prefersReducedMotion || !el) { if (el) el.innerText = formatter(target); return; }
    const start = performance.now();
    (function frame(now) {
      const p = Math.min(((now || start) - start) / duration, 1);
      el.innerText = formatter(target * easeOutCubic(p));
      if (p < 1) requestAnimationFrame(frame); else el.innerText = formatter(target);
    })(start);
  }

  animateCount(document.getElementById('kpi-total-paid'), Math.round(totalPaid), v => formatCurrency(Math.round(v)));
  animateCount(document.getElementById('kpi-percentage'), parseFloat(totalPercentage), v => v.toFixed(2) + '%');
  animateCount(document.getElementById('kpi-balance'), Math.round(totalBalance), v => formatCurrency(Math.round(v)));
  animateCount(document.getElementById('kpi-estimated'), totalProjectEstimated, v => formatCurrency(Math.round(v)));

  const getVendorColor = (name) => {
    const colors = ['bg-[#E8F0FE] text-[#1A73E8]', 'bg-[#FCE8E6] text-[#D93025]',
                    'bg-[#E6F4EA] text-[#1E8E3E]', 'bg-[#FEF7E0] text-[#F29900]',
                    'bg-[#F3E8FD] text-[#9334E6]'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const renderTable = (data) => {
    const tbody = document.getElementById('table-body');
    const mobile = document.getElementById('mobile-cards');
    tbody.innerHTML = ''; mobile.innerHTML = '';
    const displayData = [...data].sort((a, b) => b.dateObj - a.dateObj);

    if (!displayData.length) {
      mobile.innerHTML = '<p class="text-center text-sm text-gray-400 py-8">No matching transactions.</p>';
    }

    displayData.forEach(row => {
      const vendorStyle = getVendorColor(row.vendor);

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-[#F8F9FA] transition-colors border-b border-gray-50 last:border-0';
      tr.innerHTML = `
        <td class="py-5 px-8 text-sm text-gray-500 number-font whitespace-nowrap font-medium">${row.date}</td>
        <td class="py-5 px-8 flex items-center gap-4">
          <div class="w-10 h-10 rounded-full ${vendorStyle} flex items-center justify-center text-sm font-bold uppercase shrink-0">${row.vendor.charAt(0)}</div>
          <span class="text-sm font-bold text-gray-900 truncate max-w-[200px]" title="${row.vendor}">${row.vendor}</span>
        </td>
        <td class="py-5 px-8">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">${row.scope}</span>
        </td>
        <td class="py-5 px-8 text-base font-black text-gray-900 number-font text-right">${formatCurrency(row.paidNum, true)}</td>`;
      tbody.appendChild(tr);

      const card = document.createElement('div');
      card.className = 'border border-gray-100 rounded-2xl p-4 flex flex-col gap-3';
      card.innerHTML = `
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-full ${vendorStyle} flex items-center justify-center text-sm font-bold uppercase shrink-0">${row.vendor.charAt(0)}</div>
            <span class="text-sm font-bold text-gray-900 truncate" title="${row.vendor}">${row.vendor}</span>
          </div>
          <span class="text-xs text-gray-400 number-font font-medium whitespace-nowrap shrink-0">${row.date}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 truncate max-w-[55%]">${row.scope}</span>
          <span class="text-base font-black text-gray-900 number-font whitespace-nowrap">${formatCurrency(row.paidNum, true)}</span>
        </div>`;
      mobile.appendChild(card);
    });
  };
  renderTable(parsedData);

  const renderVendors = () => {
    const container = document.getElementById('vendor-breakdown');
    container.innerHTML = '';

    const vendors = Object.entries(paymentsByVendor).map(([name, paid]) => {
      const info = vendorInfo[name] || {};
      const budget = info.budget || paid;
      const balance = budget - paid;
      return { name, paid, budget, balance,
               pct: budget > 0 ? (paid / budget) * 100 : 100,
               category: info.category || 'General' };
    }).sort((a, b) => b.paid - a.paid);

    document.getElementById('vendor-count').innerText = vendors.length;

    vendors.forEach(v => {
      const vendorStyle = getVendorColor(v.name);
      const barWidth = Math.min(v.pct, 100);
      const settled = v.balance <= 1;
      const barColor = settled ? '#34A853' : '#4285F4';

      const statusHtml = settled
        ? `<span class="inline-flex items-center gap-1 text-google-green font-bold">
             <span translate="no" class="notranslate material-symbols-outlined" style="font-size:16px;">check_circle</span> Fully paid</span>`
        : `<span class="text-gray-500 font-medium">Remaining <span class="number-font font-bold text-gray-700">${formatCurrency(v.balance)}</span></span>`;

      const txs = parsedData.filter(t => t.vendor === v.name).sort((a, b) => a.dateObj - b.dateObj);

      const wrapper = document.createElement('div');
      wrapper.className = 'vendor-wrapper';
      wrapper.style.setProperty('--vendor-accent', barColor);

      const row = document.createElement('div');
      row.className = 'vendor-summary flex flex-col gap-2.5 sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center px-4 py-4 sm:px-3 hover:bg-[#F8F9FA] transition-colors rounded-xl cursor-pointer select-none';
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-expanded', 'false');
      row.setAttribute('aria-label', `Show all transfers for ${v.name}`);
      row.innerHTML = `
        <div class="sm:col-span-4 flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-full ${vendorStyle} flex items-center justify-center text-sm font-bold uppercase shrink-0">${v.name.charAt(0)}</div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-gray-900 truncate" title="${v.name}">${v.name}</p>
            <p class="text-xs text-gray-400 truncate">${v.category}</p>
          </div>
          <span translate="no" class="notranslate material-symbols-outlined vendor-chevron text-gray-300 transition-transform duration-300 shrink-0 sm:hidden" style="font-size:22px;">expand_more</span>
        </div>
        <div class="flex items-baseline gap-2 min-w-0 sm:hidden">
          <span class="text-xl font-black text-gray-900 number-font whitespace-nowrap">${formatCurrency(v.paid)}</span>
          <span class="text-xs text-gray-400 number-font truncate">of ${formatCurrency(v.budget)}</span>
        </div>
        <div class="sm:col-span-5 min-w-0">
          <div class="flex items-center gap-3">
            <div class="flex-1 min-w-0 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all" style="width:${barWidth}%; background:${barColor};"></div>
            </div>
            <span class="number-font font-bold text-gray-500 text-xs shrink-0">${v.pct.toFixed(0)}%</span>
          </div>
          <div class="mt-1.5 text-xs">${statusHtml}</div>
        </div>
        <div class="hidden sm:flex sm:col-span-3 items-center justify-end gap-2 min-w-0">
          <div class="flex items-baseline gap-1.5 justify-end min-w-0">
            <span class="text-xl font-black text-gray-900 number-font whitespace-nowrap shrink-0">${formatCurrency(v.paid)}</span>
            <span class="text-xs text-gray-400 number-font truncate">of ${formatCurrency(v.budget)}</span>
          </div>
          <span translate="no" class="notranslate material-symbols-outlined vendor-chevron text-gray-400 transition-transform duration-300 shrink-0" style="font-size:22px;">expand_more</span>
        </div>`;

      const details = document.createElement('div');
      details.className = 'vendor-detail hidden';
      details.innerHTML = `
        <div>
          ${txs.map((t, i) => `
            <div class="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 ${i !== txs.length - 1 ? 'border-b border-gray-50' : ''}">
              <div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <span class="text-xs text-gray-400 number-font font-medium whitespace-nowrap shrink-0">${t.date}</span>
                <span class="truncate min-w-0 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">${t.scope}</span>
              </div>
              <span class="text-sm font-bold text-gray-900 number-font whitespace-nowrap shrink-0">
                <span class="sm:hidden">${formatCurrency(t.paidNum)}</span>
                <span class="hidden sm:inline">${formatCurrency(t.paidNum, true)}</span>
              </span>
            </div>`).join('')}
          <div class="px-4 sm:px-5 py-2.5 bg-gray-50 border-t border-gray-100">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">${txs.length} transfer${txs.length !== 1 ? 's' : ''}</span>
          </div>
        </div>`;

      const toggle = () => {
        const willOpen = details.classList.contains('hidden');
        container.querySelectorAll('.vendor-detail').forEach(d => d.classList.add('hidden'));
        container.querySelectorAll('.vendor-wrapper').forEach(w => w.classList.remove('open'));
        container.querySelectorAll('[aria-expanded]').forEach(r => r.setAttribute('aria-expanded', 'false'));
        container.querySelectorAll('.vendor-chevron').forEach(c => c.style.transform = '');
        if (willOpen) {
          details.classList.remove('hidden');
          wrapper.classList.add('open');
          row.setAttribute('aria-expanded', 'true');
          row.querySelectorAll('.vendor-chevron').forEach(c => c.style.transform = 'rotate(180deg)');
        }
      };
      row.addEventListener('click', toggle);
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });

      wrapper.appendChild(row);
      wrapper.appendChild(details);
      container.appendChild(wrapper);
    });
  };
  renderVendors();

  const renderSchedule = () => {
    const body = document.getElementById('schedule-body');
    body.innerHTML = '';
    let grandTotal = 0;

    scheduleData.forEach(group => {
      const monthTotal = group.items.reduce((s, i) => s + i.cost, 0);
      grandTotal += monthTotal;
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2.5">
            <span translate="no" class="notranslate material-symbols-outlined text-gray-400" style="font-size:20px;">calendar_month</span>
            <h4 class="text-base sm:text-lg font-extrabold text-google-dark">${group.month}</h4>
          </div>
          <span class="text-sm sm:text-base font-black text-gray-900 number-font">${formatCurrency(monthTotal)}</span>
        </div>
        <div class="rounded-2xl border border-gray-100 overflow-hidden">
          ${group.items.map((i, idx) => `
            <div class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 ${idx !== group.items.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-[#F8F9FA] transition-colors">
              <span class="text-sm font-semibold text-gray-700 truncate">${i.category}</span>
              <span class="text-sm font-bold text-gray-900 number-font whitespace-nowrap shrink-0">${formatCurrency(i.cost)}</span>
            </div>`).join('')}
        </div>`;
      body.appendChild(wrap);
    });

    animateCount(document.getElementById('schedule-total'), grandTotal, v => formatCurrency(Math.round(v)));
  };
  renderSchedule();

  document.getElementById('searchInput').addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    renderTable(parsedData.filter(row =>
      row.vendor.toLowerCase().includes(term) || row.scope.toLowerCase().includes(term)));
  });

  try {
    Chart.defaults.font.family = "'Outfit', 'Inter', sans-serif";
    Chart.defaults.color = '#5f6368';
    Chart.defaults.rtl = false;

    const brandColors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#202124', '#8AB4F8', '#FDE293'];
    const commonChartOptions = {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1F2023', titleColor: '#fff', bodyColor: '#fff',
          padding: 16, cornerRadius: 12, displayColors: false,
          titleFont: { size: 14, family: "'Inter', sans-serif" },
          bodyFont: { size: 16, family: "'Outfit', sans-serif", weight: 'bold' }
        }
      }
    };

    const monthKeys = Object.keys(paymentsByMonth).sort();
    const monthLabels = monthKeys.map(m => {
      const [y, mo] = m.split('-');
      return new Date(y, parseInt(mo) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    const timelineChart = new Chart(document.getElementById('timelineChart').getContext('2d'), {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [{
          data: monthKeys.map(m => paymentsByMonth[m]),
          borderColor: '#4285F4', borderWidth: 4,
          pointBackgroundColor: '#FFFFFF', pointBorderColor: '#4285F4',
          pointBorderWidth: 3, pointRadius: 6, pointHoverRadius: 8,
          tension: 0.3, fill: false
        }]
      },
      options: {
        ...commonChartOptions,
        scales: {
          x: { grid: { display: false, drawBorder: false },
               ticks: { font: { weight: 'bold', size: 12 }, autoSkip: true, maxRotation: 0 } },
          y: { border: { display: false },
               grid: { color: '#E6E8EA', borderDash: [5, 5] },
               ticks: { callback: v => '₪' + (v / 1000000).toFixed(1) + 'M',
                        font: { family: "'Outfit', sans-serif", weight: '500', size: 12 } } }
        }
      }
    });

    const scopesSorted = Object.entries(paymentsByScope).sort((a, b) => b[1] - a[1]);
    const topScopes = scopesSorted.slice(0, 5);
    const otherVal = scopesSorted.slice(5).reduce((s, v) => s + v[1], 0);
    if (otherVal > 0) topScopes.push(['Other', otherVal]);

    const scopeChart = new Chart(document.getElementById('scopeChart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: topScopes.map(s => s[0]),
        datasets: [{ data: topScopes.map(s => s[1]), backgroundColor: brandColors,
                     borderWidth: 4, borderColor: '#ffffff', hoverOffset: 8 }]
      },
      options: {
        ...commonChartOptions, cutout: '70%',
        plugins: {
          ...commonChartOptions.plugins,
          legend: { display: true, position: 'bottom',
                    labels: { usePointStyle: true, padding: 20,
                              font: { family: "'Inter', sans-serif", weight: 'bold', size: 12 } } },
          tooltip: { callbacks: { label: ctx => formatCurrency(ctx.raw) } }
        }
      }
    });

    function applyResponsiveCharts() {
      const w = window.innerWidth, isMobile = w < 640, isSmall = w < 480;
      const tickFont = isSmall ? 10 : (isMobile ? 11 : 12);
      timelineChart.options.scales.x.ticks.font.size = tickFont;
      timelineChart.options.scales.x.ticks.maxRotation = isMobile ? 55 : 0;
      timelineChart.options.scales.x.ticks.minRotation = isMobile ? 45 : 0;
      timelineChart.options.scales.x.ticks.maxTicksLimit = isMobile ? 6 : 24;
      timelineChart.options.scales.y.ticks.font.size = tickFont;
      timelineChart.update('none');
      scopeChart.options.plugins.legend.labels.font.size = isSmall ? 10 : 12;
      scopeChart.options.plugins.legend.labels.padding = isMobile ? 12 : 20;
      scopeChart.update('none');
    }
    applyResponsiveCharts();
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(applyResponsiveCharts, 150);
    });
  } catch (chartErr) {
    console.warn('Charts could not be initialized — data and tabs are unaffected:', chartErr);
  }

  (function initTabs() {
    const buttons = document.querySelectorAll('.tab-btn');
    const panels = {
      vendors: document.getElementById('panel-vendors'),
      transactions: document.getElementById('panel-transactions'),
      schedule: document.getElementById('panel-schedule')
    };
    let scheduleShown = false;
    const activate = name => {
      buttons.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
      Object.entries(panels).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
      if (name === 'schedule' && !scheduleShown) {
        scheduleShown = true;
        const total = scheduleData.reduce((s, g) => s + g.items.reduce((a, i) => a + i.cost, 0), 0);
        animateCount(document.getElementById('schedule-total'), total, v => formatCurrency(Math.round(v)));
      }
    };
    buttons.forEach(b => b.addEventListener('click', () => activate(b.dataset.tab)));
    activate('vendors');
  })();

  (function protectFromTranslation() {
    const mark = root => (root || document)
      .querySelectorAll('.material-symbols-outlined, .number-font')
      .forEach(el => { el.setAttribute('translate', 'no'); el.classList.add('notranslate'); });
    mark();
    if (typeof MutationObserver !== 'undefined') {
      const obs = new MutationObserver(() => mark());
      ['table-body', 'mobile-cards'].forEach(id => {
        const el = document.getElementById(id);
        if (el) obs.observe(el, { childList: true });
      });
    }
  })();
};
