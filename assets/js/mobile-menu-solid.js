(() => {
  const start = () => {
    let profile = null;
    try { profile = JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null'); } catch (_) {}
    if (!profile) return;
    document.querySelectorAll('.mobile-liquid-nav,.admin-mobile-nav,.hiba-mobile-nav,.hiba-updates-mobile-nav,.navisuite-mobile-nav').forEach(node => node.hidden = true);
    document.getElementById('navisuite-mobile-solid')?.remove();
    document.getElementById('navisuite-mobile-solid-panel')?.remove();

    const path = location.pathname.toLowerCase();
    const active = name => path.endsWith(name);
    const nav = document.createElement('nav');
    nav.id = 'navisuite-mobile-solid';
    nav.setAttribute('aria-label', 'Navigazione principale');
    nav.innerHTML =
      '<a class="' + (!active('cambi_turno.html') && !active('navidiaria.html') && !active('documenti.html') ? 'active' : '') + '" href="naviturni.html"><span>▦</span><b>Turni</b></a>' +
      '<a class="' + (active('cambi_turno.html') ? 'active' : '') + '" href="cambi_turno.html"><span>⇄</span><b>Cambio</b></a>' +
      '<a class="' + (active('navidiaria.html') ? 'active' : '') + '" href="navidiaria.html"><span>≈</span><b>Diaria</b></a>' +
      '<a class="' + (active('documenti.html') ? 'active' : '') + '" href="documenti.html"><span>▤</span><b>Documenti</b></a>' +
      '<button type="button" data-open-menu><span>☰</span><b>Menu</b></button>';
    document.body.appendChild(nav);

    const isAdmin = ['91','92'].includes(String(profile.id || '')) || String(profile.role || '').toLowerCase() === 'admin';
    const isHiba = String(profile.id || '').toUpperCase() === 'BARISTA_HIBA' || (String(profile.role || '').toLowerCase() === 'barista' && String(profile.name || profile.agente || '').trim().toUpperCase() === 'HIBA');
    const entries = [];
    if (isAdmin) entries.push(['impostazioni.html','⚙','Impostazioni']);
    if (isAdmin || isHiba) entries.push(['aggiornamenti.html','↻','Aggiornamenti']);
    if (isAdmin) entries.push(['agenti.html','♙','Agenti'],['Orario.html','◴','Orario']);
    entries.push(['segnalazioni.html','✉','Segnalazioni']);

    const panel = document.createElement('div');
    panel.id = 'navisuite-mobile-solid-panel';
    panel.hidden = true;
    panel.innerHTML = '<section><header><strong>Menu NaviSuite</strong><button type="button" data-close-menu aria-label="Chiudi">✕</button></header><div class="links">' +
      entries.map(([href,icon,label]) => '<a href="' + href + '"><span>' + icon + '</span>' + label + '</a>').join('') +
      '<button type="button" data-logout><span>⇥</span>Esci</button></div></section>';
    document.body.appendChild(panel);

    const open = () => { panel.hidden = false; };
    const close = () => { panel.hidden = true; };
    nav.querySelector('[data-open-menu]').addEventListener('click', open);
    panel.querySelector('[data-close-menu]').addEventListener('click', close);
    panel.addEventListener('click', event => { if (event.target === panel) close(); });
    panel.querySelector('[data-logout]').addEventListener('click', () => {
      if (typeof window.logoutAgent === 'function') { window.logoutAgent(); return; }
      localStorage.removeItem('navidiaria.activeAgent');
      localStorage.removeItem('naviturni_logged_agent');
      location.href = 'index.html';
    });
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once:true });
})();