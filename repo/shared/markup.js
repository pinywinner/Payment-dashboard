/* The page skeleton, shared by every client.
   Edit this file once and every dashboard changes. */

window.renderShell = function (CLIENT) {
  return `
  <div class="w-full max-w-screen-2xl mx-auto space-y-6 sm:space-y-8 lg:space-y-10">

    <header class="py-4 sm:py-6 md:py-10 fade-in-up" style="animation-delay: 0.1s;">
      <div class="flex flex-col gap-4 sm:gap-6 max-w-4xl">
        <h1 class="text-4xl sm:text-5xl md:text-7xl font-extrabold text-google-dark tracking-tight leading-[1.1]">
          Payment Dashboard<br>
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-google-blue to-google-dark">${CLIENT.projectName}</span>
        </h1>
        <p class="text-lg sm:text-xl md:text-2xl text-gray-500 font-normal leading-relaxed max-w-2xl">
          ${CLIENT.subtitle || 'Tracking and detailing cash flows, and analyzing expenses with vendors and contractors.'}
        </p>
        <p id="last-updated" class="text-sm text-gray-400 font-medium"></p>
      </div>
    </header>

    <div id="load-state"></div>

    <div id="dashboard-body" class="space-y-6 sm:space-y-8 lg:space-y-10" style="display:none;">

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 fade-in-up" style="animation-delay: 0.2s;">
        ${kpiCard('account_balance_wallet', 'kpi-total-paid', '₪0', 'Total Paid')}
        ${kpiCard('donut_large', 'kpi-percentage', '0%', 'Total Percentage')}
        ${kpiCard('account_balance', 'kpi-balance', '₪0', 'Total Balance', true)}
        ${kpiCard('architecture', 'kpi-estimated', '₪0', 'Total Project Estimated')}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 fade-in-up" style="animation-delay: 0.3s;">
        <div class="google-editorial-card p-5 sm:p-6 lg:p-8 lg:col-span-2 flex flex-col min-h-[320px] sm:min-h-[400px]">
          <div class="flex justify-between items-end mb-6 sm:mb-8">
            <div>
              <h3 class="text-xl sm:text-2xl font-extrabold text-google-dark mb-1">Payment Trends</h3>
              <p class="text-gray-500 text-sm">Financial volume by month</p>
            </div>
          </div>
          <div class="relative w-full flex-grow"><canvas id="timelineChart"></canvas></div>
        </div>
        <div class="google-editorial-card p-5 sm:p-6 lg:p-8 flex flex-col min-h-[320px] sm:min-h-[400px]">
          <div class="mb-6 sm:mb-8">
            <h3 class="text-xl sm:text-2xl font-extrabold text-google-dark mb-1">Expense Breakdown</h3>
            <p class="text-gray-500 text-sm">Distribution by scope of work</p>
          </div>
          <div class="relative w-full flex-grow flex items-center justify-center"><canvas id="scopeChart"></canvas></div>
        </div>
      </div>

      <div class="fade-in-up" style="animation-delay: 0.4s;">
        <div class="overflow-x-auto custom-scrollbar -mx-1 px-1 mb-4 sm:mb-6">
          <div class="inline-flex items-center gap-1 p-1.5 rounded-full bg-gray-100 border border-gray-200 w-max">
            ${tabBtn('vendors', 'groups', 'Vendor Breakdown')}
            ${tabBtn('transactions', 'receipt_long', 'Transaction Details')}
            ${tabBtn('schedule', 'event_upcoming', 'Upcoming Schedule')}
          </div>
        </div>

        <div id="panel-vendors" class="tab-panel">
          <div class="google-editorial-card p-5 sm:p-6 lg:p-8 flex flex-col">
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8">
              <div>
                <h3 class="text-xl sm:text-2xl font-extrabold text-google-dark mb-1">Vendor Breakdown</h3>
                <p class="text-gray-500 text-sm">How much each supplier received, versus their budget &middot; Click a vendor to see all their transfers</p>
              </div>
              <div class="text-left sm:text-right">
                <p class="text-2xl sm:text-3xl font-black text-google-dark number-font leading-none" id="vendor-count">0</p>
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Active Vendors</p>
              </div>
            </div>
            <div class="hidden sm:grid grid-cols-12 gap-4 px-2 pb-3 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <div class="col-span-4">Vendor / Supplier</div>
              <div class="col-span-5">Progress vs Budget</div>
              <div class="col-span-3 text-right">Received / Budget</div>
            </div>
            <div id="vendor-breakdown" class="flex flex-col"></div>
          </div>
        </div>

        <div id="panel-transactions" class="tab-panel hidden">
          <div class="google-editorial-card overflow-hidden flex flex-col">
            <div class="p-5 sm:p-8 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 sm:gap-6 bg-white z-10">
              <div>
                <h3 class="text-xl sm:text-2xl font-extrabold text-google-dark mb-1">Transaction Details</h3>
                <p class="text-gray-500 text-sm">Complete vendor transfer list</p>
              </div>
              <div class="relative w-full sm:w-auto">
                <span translate="no" class="notranslate material-symbols-outlined absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">search</span>
                <input type="text" id="searchInput" placeholder="Search vendor or scope..."
                       class="pl-12 pr-6 py-3 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-gray-400 focus:ring-4 focus:ring-gray-50 transition-all w-full sm:w-72 bg-gray-50 hover:bg-white font-medium text-gray-700">
              </div>
            </div>
            <div class="hidden sm:block overflow-x-auto custom-scrollbar px-2 pb-2">
              <table class="w-full text-left border-collapse min-w-[650px]">
                <thead class="bg-white sticky top-0 z-10">
                  <tr>
                    <th class="py-4 px-8 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Date</th>
                    <th class="py-4 px-8 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Vendor / Contractor</th>
                    <th class="py-4 px-8 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Scope of Work</th>
                    <th class="py-4 px-8 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 text-right">Amount (₪)</th>
                  </tr>
                </thead>
                <tbody id="table-body" class="bg-white"></tbody>
              </table>
            </div>
            <div id="mobile-cards" class="sm:hidden flex flex-col gap-3 px-4 pb-6"></div>
          </div>
        </div>

        <div id="panel-schedule" class="tab-panel hidden">
          <div class="google-editorial-card p-5 sm:p-6 lg:p-8 flex flex-col">
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8">
              <div>
                <div class="inline-flex items-center gap-2 mb-2">
                  <h3 class="text-xl sm:text-2xl font-extrabold text-google-dark">Upcoming Schedule</h3>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-google-yellow_light text-[#B06000] border border-[#F9E3A0]">Estimated</span>
                </div>
                <p class="text-gray-500 text-sm">Planned remaining payments &mdash; not yet paid</p>
              </div>
              <div class="text-left sm:text-right">
                <p class="text-2xl sm:text-3xl font-black text-google-dark number-font leading-none" id="schedule-total">₪0</p>
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Total Outstanding</p>
              </div>
            </div>
            <div id="schedule-body" class="flex flex-col gap-6 sm:gap-8"></div>
          </div>
        </div>

      </div>
    </div>
  </div>`;
};

function kpiCard(icon, id, initial, label, estimated) {
  const badge = estimated
    ? `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-google-yellow_light text-[#B06000] border border-[#F9E3A0] sm:absolute sm:top-6 sm:right-6 lg:top-8 lg:right-8 sm:z-[2]">Estimated</span>`
    : '';
  return `
    <div class="google-editorial-card p-5 sm:p-6 lg:p-8 flex flex-row sm:flex-col items-center sm:items-stretch justify-start sm:justify-between gap-4 sm:gap-0 group">
      <div class="flex justify-between items-center mb-0 sm:mb-8 lg:mb-10 shrink-0">
        <div class="p-3 bg-gray-50 rounded-[18px] text-gray-700">
          <span translate="no" class="notranslate material-symbols-outlined material-icon-style">${icon}</span>
        </div>
      </div>
      <div>
        <h2 class="kpi-number text-3xl sm:text-4xl lg:text-5xl font-black text-google-dark number-font mb-2 tracking-tight" id="${id}">${initial}</h2>
        <p class="text-sm font-bold text-gray-500 tracking-wide uppercase flex items-center gap-2">${label}${badge}</p>
      </div>
    </div>`;
}

function tabBtn(key, icon, label) {
  return `
    <button type="button" data-tab="${key}" aria-label="${label}"
            class="tab-btn flex items-center gap-2 px-3.5 sm:px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap">
      <span translate="no" class="notranslate material-symbols-outlined" style="font-size:18px;">${icon}</span>
      <span class="tab-label">${label}</span>
    </button>`;
}
