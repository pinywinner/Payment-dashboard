/* Loads dependencies, injects the shared page, fetches data, renders.
   Every client's index.html loads only this file. */

(function () {
  const BASE = '/shared/';

  const loadScript = src => new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok;
    s.onerror = () => fail(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });

  const loadCss = href => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    document.head.appendChild(l);
  };

  function banner(kind, title, lines) {
    const c = kind === 'error'
      ? { bg: '#FCE8E6', border: '#F5C4BE', text: '#C5221F', icon: 'error' }
      : { bg: '#FEF7E0', border: '#F9E3A0', text: '#B06000', icon: 'warning' };
    return `
      <div style="background:${c.bg};border:1px solid ${c.border};border-radius:20px;padding:20px 24px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span translate="no" class="notranslate material-symbols-outlined" style="font-size:22px;color:${c.text};">${c.icon}</span>
          <strong style="color:${c.text};font-size:15px;">${title}</strong>
        </div>
        <ul style="margin:0;padding-inline-start:20px;color:${c.text};font-size:13px;line-height:1.7;">
          ${lines.map(l => `<li>${l}</li>`).join('')}
        </ul>
      </div>`;
  }

  async function main() {
    const CLIENT = window.CLIENT;
    if (!CLIENT || !CLIENT.sheetId) {
      document.body.innerHTML = '<p style="font:14px sans-serif;padding:40px;">No CLIENT config found in index.html.</p>';
      return;
    }

    loadCss('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;700;900&display=swap');
    loadCss('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
    loadCss(BASE + 'styles.css');

    await loadScript('https://cdn.tailwindcss.com');
    tailwind.config = {
      theme: { extend: { colors: { google: {
        blue: '#4285F4', blue_light: '#E8F0FE',
        red: '#EA4335', red_light: '#FCE8E6',
        green: '#34A853', green_light: '#E6F4EA',
        yellow: '#FBBC05', yellow_light: '#FEF7E0',
        gray: '#5F6368', dark: '#1F2023'
      } } } }
    };

    await Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'),
      loadScript(BASE + 'markup.js'),
      loadScript(BASE + 'loader.js'),
      loadScript(BASE + 'dashboard.js')
    ]);

    document.body.className = 'min-h-screen p-4 sm:p-6 md:p-8 lg:p-12';
    document.body.innerHTML = window.renderShell(CLIENT);

    const state = document.getElementById('load-state');
    state.innerHTML = '<div style="text-align:center;padding:60px 0;color:#9AA0A6;font-size:14px;">Loading latest figures…</div>';

    let data;
    try {
      data = await window.loadSheetData(CLIENT);
    } catch (err) {
      state.innerHTML = banner('error', 'Could not load the data', [err.message]);
      console.error(err);
      return;
    }

    const fatal = data.errors.length && data.blockOnMismatch;
    let notices = '';
    if (data.errors.length) {
      notices += banner(fatal ? 'error' : 'warn',
        fatal ? 'The numbers do not reconcile — dashboard not shown' : 'The numbers do not reconcile',
        data.errors);
    }
    if (data.warnings.length && !fatal) notices += banner('warn', 'Worth checking', data.warnings);
    state.innerHTML = notices;
    if (fatal) return;

    const stamp = document.getElementById('last-updated');
    if (stamp) {
      stamp.textContent = 'Updated ' + (data.lastUpdated || new Date().toLocaleDateString('en-GB'));
    }

    document.getElementById('dashboard-body').style.display = '';
    window.startDashboard(data);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();
