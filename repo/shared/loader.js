/* Loads a client's data, validates it, and hands it to the dashboard.
   Two modes, decided by what's in the client's index.html:

     sheetId  -> reads published CSV tabs directly (one sheet per client)
     apiUrl   -> calls the Apps Script gateway (one master sheet, filtered
                 server-side by token; the sheet itself stays private)

   apiUrl wins if both are present. */

window.SHEET_DEFAULTS = {
  tabs: { payments: 'Payments', contracts: 'Contracts', schedule: 'Schedule', config: 'Config' },
  columns: {
    payments:  { date: 'date', vendor: 'vendor', scope: 'scope', amount: 'paid' },
    contracts: { vendor: 'vendor', contract: 'contract', budget: 'budget' },
    schedule:  { month: 'month', category: 'category', cost: 'cost' },
    config:    { key: 'key', value: 'value' }
  },
  dateFormat: 'DMY',
  blockOnMismatch: false,
  tolerance: 1
};

window.loadSheetData = async function (CLIENT) {
  const S = Object.assign({}, window.SHEET_DEFAULTS, CLIENT);
  const warnings = [], errors = [];

  /* ---------------------------- helpers ---------------------------- */

  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    let s = String(v).trim();
    const neg = /^\(.*\)$/.test(s);
    s = s.replace(/[()₪,\s]/g, '').replace(/[^\d.\-]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : (neg ? -n : n);
  }

  const pad = n => String(n).padStart(2, '0');

  function normaliseDate(v) {
    if (!v) return null;
    const s = String(v).trim();
    const g = s.match(/^Date\((\d+),(\d+),(\d+)/);
    if (g) return pad(+g[3]) + '/' + pad(+g[2] + 1) + '/' + g[1];
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return pad(+iso[3]) + '/' + pad(+iso[2]) + '/' + iso[1];
    const m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/);
    if (m) {
      let [, a, b, y] = m;
      if (y.length === 2) y = '20' + y;
      const day = S.dateFormat === 'MDY' ? b : a;
      const mon = S.dateFormat === 'MDY' ? a : b;
      return pad(+day) + '/' + pad(+mon) + '/' + y;
    }
    return null;
  }

  /* Renames incoming keys to the canonical names the code below expects. */
  function pickCols(objects, colMap, tabName) {
    if (!objects || !objects.length) return [];
    const headers = Object.keys(objects[0]);
    const map = {};
    for (const [key, needle] of Object.entries(colMap)) {
      const n = needle.toLowerCase();
      const h = headers.find(x => x === n) || headers.find(x => x.includes(n));
      if (!h) throw new Error(
        `Tab "${tabName}": no column matching "${needle}". Found: ${headers.join(', ')}`);
      map[key] = h;
    }
    return objects.map(o => {
      const r = {};
      for (const [k, h] of Object.entries(map)) r[k] = o[h] || '';
      return r;
    });
  }

  /* ------------------------- source: Apps Script ------------------- */

  function fetchViaApi(url, token) {
    return new Promise((resolve, reject) => {
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const tag = document.createElement('script');

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('The data gateway did not respond. Check that the Apps Script ' +
                         'is deployed with access set to "Anyone".'));
      }, 20000);

      function cleanup() {
        clearTimeout(timer);
        delete window[cb];
        if (tag.parentNode) tag.parentNode.removeChild(tag);
      }

      window[cb] = payload => {
        cleanup();
        if (payload && payload.error) reject(new Error(payload.error));
        else resolve(payload);
      };

      tag.src = url + (url.includes('?') ? '&' : '?') +
                'token=' + encodeURIComponent(token) + '&callback=' + cb;
      tag.onerror = () => { cleanup(); reject(new Error('Could not reach the data gateway.')); };
      document.head.appendChild(tag);
    });
  }

  /* ------------------------- source: published CSV ----------------- */

  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map(h => h.trim().toLowerCase());
    return rows.slice(1).map(r => {
      const o = {};
      headers.forEach((h, i) => { if (h) o[h] = (r[i] || '').trim(); });
      return o;
    });
  }

  async function fetchCsvTab(tab) {
    const url = `https://docs.google.com/spreadsheets/d/${S.sheetId}` +
                `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(
      `Could not read tab "${tab}" (HTTP ${res.status}). Check the tab name, ` +
      `and that the sheet is shared with "Anyone with the link".`);
    const text = await res.text();
    if (text.trim().startsWith('<')) throw new Error(
      'Google returned a login page instead of data. The sheet is not shared, or the ID is wrong.');
    return rowsToObjects(parseCsv(text));
  }

  /* ------------------------------ load ----------------------------- */

  let src;
  if (S.apiUrl) {
    if (!S.token) throw new Error('This client has an apiUrl but no token.');
    src = await fetchViaApi(S.apiUrl, S.token);
  } else if (S.sheetId) {
    const [payments, contracts, schedule, config] = await Promise.all([
      fetchCsvTab(S.tabs.payments), fetchCsvTab(S.tabs.contracts),
      fetchCsvTab(S.tabs.schedule), fetchCsvTab(S.tabs.config)
    ]);
    src = { payments, contracts, schedule, config };
  } else {
    throw new Error('This client has neither a sheetId nor an apiUrl.');
  }

  /* ------------------------------ config --------------------------- */

  const cfg = {};
  pickCols(src.config, S.columns.config, S.tabs.config)
    .forEach(r => { if (r.key) cfg[r.key.toLowerCase()] = r.value; });

  const totalProjectEstimated = num(cfg['total project estimated']);
  if (!totalProjectEstimated) throw new Error('Config is missing a "Total project estimated" row.');

  /* ----------------------------- payments -------------------------- */

  const rawData = [];
  pickCols(src.payments, S.columns.payments, S.tabs.payments).forEach((r, i) => {
    if (!r.vendor) return;
    const amount = num(r.amount);
    if (amount <= 0) return;
    const date = normaliseDate(r.date);
    if (!date) { warnings.push(`Payments row ${i + 2}: unreadable date "${r.date}" — row skipped.`); return; }
    if (!r.scope) warnings.push(`Payments row ${i + 2}: ${r.vendor} — no scope of work filled in.`);
    rawData.push({ date, vendor: r.vendor, scope: r.scope || 'General', paidNum: amount });
  });
  if (!rawData.length) throw new Error('No usable payment rows found for this client.');

  /* ---------------------------- contracts -------------------------- */

  const vendorInfo = {};
  pickCols(src.contracts, S.columns.contracts, S.tabs.contracts).forEach((r, i) => {
    if (!r.vendor) return;
    const budget = num(r.budget);
    if (budget <= 0) { warnings.push(`Contracts row ${i + 2}: ${r.vendor} — budget is empty or zero.`); return; }
    if (!vendorInfo[r.vendor]) vendorInfo[r.vendor] = { budget: 0, parts: [] };
    vendorInfo[r.vendor].budget += budget;
    if (r.contract) vendorInfo[r.vendor].parts.push(r.contract);
  });
  Object.values(vendorInfo).forEach(v => {
    v.category = v.parts.length ? v.parts.join(' + ') : 'General';
    delete v.parts;
  });

  /* ----------------------------- schedule -------------------------- */

  const scheduleData = [];
  let currentMonth = null;
  pickCols(src.schedule, S.columns.schedule, S.tabs.schedule).forEach(r => {
    if (r.month) currentMonth = r.month;
    if (!r.category || !currentMonth) return;
    const cost = num(r.cost);
    if (cost <= 0) return;
    let g = scheduleData.find(x => x.month === currentMonth);
    if (!g) { g = { month: currentMonth, items: [] }; scheduleData.push(g); }
    g.items.push({ category: r.category, cost });
  });

  /* --------------------------- reconciliation ---------------------- */

  const totalPaid = rawData.reduce((s, r) => s + r.paidNum, 0);
  const totalScheduled = scheduleData.reduce((s, g) => s + g.items.reduce((a, i) => a + i.cost, 0), 0);
  const gap = totalProjectEstimated - (totalPaid + totalScheduled);
  const nis = n => '₪' + Math.round(n).toLocaleString('en-US');

  if (Math.abs(gap) > S.tolerance) errors.push(
    `Paid (${nis(totalPaid)}) + scheduled (${nis(totalScheduled)}) = ${nis(totalPaid + totalScheduled)}, ` +
    `but the project estimate is ${nis(totalProjectEstimated)}. Off by ${nis(Math.abs(gap))}.`);

  const paidBy = {};
  rawData.forEach(r => { paidBy[r.vendor] = (paidBy[r.vendor] || 0) + r.paidNum; });

  Object.entries(paidBy).forEach(([vendor, paid]) => {
    if (!vendorInfo[vendor]) {
      errors.push(`"${vendor}" received ${nis(paid)} but has no row in Contracts.`);
    } else if (paid - vendorInfo[vendor].budget > S.tolerance) {
      errors.push(`"${vendor}" was paid ${nis(paid)} against a budget of ` +
                  `${nis(vendorInfo[vendor].budget)} — a contract is probably missing.`);
    }
  });
  Object.keys(vendorInfo).forEach(v => {
    if (!paidBy[v]) warnings.push(`"${v}" has a contract but no payments yet.`);
  });

  return {
    rawData, vendorInfo, scheduleData, totalProjectEstimated,
    lastUpdated: cfg['last updated'] || '',
    blockOnMismatch: S.blockOnMismatch,
    errors, warnings
  };
};
