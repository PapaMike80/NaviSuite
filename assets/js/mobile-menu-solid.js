(() => {
  const start = () => {
    if (!document.getElementById('navisuite-mobile-solid-style')) {
      const style = document.createElement('style');
      style.id = 'navisuite-mobile-solid-style';
      style.textContent = '.mobile-liquid-nav[hidden],.admin-mobile-nav[hidden],.hiba-mobile-nav[hidden],.hiba-updates-mobile-nav[hidden],.navisuite-mobile-nav[hidden]{display:none!important}#navisuite-mobile-solid,#navisuite-mobile-solid-panel{display:none}@media(max-width:850px){body{padding-bottom:102px!important}#navisuite-mobile-solid{position:fixed!important;left:50vw!important;bottom:14px!important;z-index:99999!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;align-items:center!important;width:calc(100vw - 24px)!important;max-width:620px!important;height:68px!important;margin:0!important;transform:translateX(-50%)!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:36px!important;background:rgba(18,34,45,.94)!important;box-shadow:0 18px 40px rgba(0,0,0,.45)!important;backdrop-filter:blur(24px) saturate(180%)!important;overflow:hidden!important}#navisuite-mobile-solid a,#navisuite-mobile-solid button{display:flex!important;min-width:0!important;width:100%!important;height:68px!important;align-items:center!important;justify-content:center!important;flex-direction:column!important;gap:3px!important;margin:0!important;padding:5px 1px!important;border:0!important;border-radius:0!important;background:transparent!important;color:#b9d2d8!important;text-decoration:none!important;font:800 9px/1 Inter,Arial,sans-serif!important;white-space:nowrap!important}#navisuite-mobile-solid span{font-size:20px!important;line-height:20px!important}#navisuite-mobile-solid a.active{background:rgba(45,212,191,.18)!important;color:#99f6e4!important}#navisuite-mobile-solid a.active span{color:#2dd4bf!important}#navisuite-mobile-solid-panel{position:fixed!important;inset:0!important;z-index:100000!important;background:rgba(1,15,21,.62)!important}#navisuite-mobile-solid-panel[hidden]{display:none!important}#navisuite-mobile-solid-panel section{position:absolute!important;left:12px!important;right:12px!important;bottom:94px!important;padding:12px!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:23px!important;background:#0d2732!important;box-shadow:0 18px 45px rgba(0,0,0,.42)!important}#navisuite-mobile-solid-panel header{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:4px 5px 10px!important;color:#e9ffff!important;font:800 15px Inter,Arial,sans-serif!important}#navisuite-mobile-solid-panel header button{width:32px!important;height:32px!important;border:1px solid rgba(151,212,221,.35)!important;border-radius:50%!important;background:transparent!important;color:#9de8e0!important;font-size:16px!important}#navisuite-mobile-solid-panel .links{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}#navisuite-mobile-solid-panel .links a,#navisuite-mobile-solid-panel .links button{display:flex!important;align-items:center!important;gap:9px!important;min-height:45px!important;padding:10px 12px!important;border:1px solid rgba(114,170,181,.35)!important;border-radius:13px!important;background:#071b24!important;color:#e7fbfb!important;text-decoration:none!important;font:800 12px Inter,Arial,sans-serif!important;text-align:left!important}#navisuite-mobile-solid-panel .links span{font-size:18px!important;color:#34d6c0!important}}';
      document.head.appendChild(style);
    }
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