/* NaviSuite: unico menu mobile comune. */
(() => {
  'use strict';

  const OLD_MENUS = '.mobile-liquid-nav,.admin-mobile-nav,.hiba-mobile-nav,.hiba-updates-mobile-nav,.navisuite-mobile-nav';
  const barId = 'navisuite-mobile-menu';
  const panelId = 'navisuite-mobile-menu-panel';

  const currentProfile = () => {
    try {
      return JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null');
    } catch (_) {
      return null;
    }
  };

  const isAdmin = profile => ['91', '92'].includes(String(profile?.id || '')) || String(profile?.role || '').toLowerCase() === 'admin';
  const isHiba = profile => String(profile?.id || '').toUpperCase() === 'BARISTA_HIBA' ||
    (String(profile?.role || '').toLowerCase() === 'barista' && String(profile?.name || profile?.agente || profile?.cognome || '').trim().toUpperCase() === 'HIBA');

  const addStyle = () => {
    if (document.getElementById('navisuite-mobile-menu-style')) return;
    const style = document.createElement('style');
    style.id = 'navisuite-mobile-menu-style';
    style.textContent = `
      ${OLD_MENUS}[hidden] { display:none !important; pointer-events:none !important; }
      #${barId}, #${panelId} { display:none; }
      @media (max-width:850px) {
        html, body { min-height:100%; }
        body { padding-bottom:calc(84px + env(safe-area-inset-bottom, 0px)) !important; }
        #${barId} {
          position:fixed !important;
          left:0 !important;
          right:0 !important;
          bottom:0 !important;
          z-index:2147483000 !important;
          display:grid !important;
          grid-template-columns:repeat(5, minmax(0, 1fr)) !important;
          width:auto !important;
          max-width:none !important;
          height:calc(70px + env(safe-area-inset-bottom, 0px)) !important;
          box-sizing:border-box !important;
          padding:0 2px env(safe-area-inset-bottom, 0px) !important;
          margin:0 !important;
          transform:none !important;
          overflow:visible !important;
          background:#102733 !important;
          border-top:1px solid rgba(145,210,216,.35) !important;
          box-shadow:0 -5px 22px rgba(0,0,0,.34) !important;
          isolation:isolate !important;
          touch-action:manipulation !important;
        }
        #${barId} a, #${barId} button {
          display:flex !important;
          min-width:0 !important;
          min-height:64px !important;
          width:auto !important;
          height:70px !important;
          box-sizing:border-box !important;
          align-items:center !important;
          justify-content:center !important;
          flex-direction:column !important;
          gap:3px !important;
          padding:6px 1px !important;
          margin:0 !important;
          border:0 !important;
          border-radius:0 !important;
          background:transparent !important;
          color:#bed0d5 !important;
          text-decoration:none !important;
          font:800 10px/1.05 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important;
          white-space:nowrap !important;
          appearance:none !important;
          -webkit-appearance:none !important;
          cursor:pointer !important;
          touch-action:manipulation !important;
        }
        #${barId} .ns-icon { font-size:23px !important; line-height:22px !important; }
        #${barId} a.active { color:#8ff4e4 !important; background:rgba(45,212,191,.17) !important; }
        #${barId} a.active .ns-icon { color:#2dd4bf !important; }
        #${barId} button:active, #${barId} a:active { background:rgba(45,212,191,.24) !important; }
        #${panelId} {
          position:fixed !important;
          inset:0 !important;
          z-index:2147483001 !important;
          display:block !important;
          box-sizing:border-box !important;
          background:rgba(1,15,21,.66) !important;
          touch-action:manipulation !important;
        }
        #${panelId}[hidden] { display:none !important; }
        #${panelId} .ns-menu-sheet {
          position:absolute !important;
          left:12px !important;
          right:12px !important;
          bottom:calc(82px + env(safe-area-inset-bottom, 0px)) !important;
          box-sizing:border-box !important;
          padding:14px !important;
          border:1px solid rgba(151,212,221,.35) !important;
          border-radius:20px !important;
          background:#0d2732 !important;
          box-shadow:0 18px 45px rgba(0,0,0,.48) !important;
        }
        #${panelId} header { display:flex !important; align-items:center !important; justify-content:space-between !important; gap:12px !important; margin-bottom:10px !important; color:#e9ffff !important; font:800 16px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important; }
        #${panelId} .ns-close { width:36px !important; height:36px !important; padding:0 !important; border:1px solid rgba(151,212,221,.45) !important; border-radius:50% !important; background:transparent !important; color:#9de8e0 !important; font-size:19px !important; }
        #${panelId} .ns-links { display:grid !important; grid-template-columns:repeat(2, minmax(0, 1fr)) !important; gap:8px !important; }
        #${panelId} .ns-links a, #${panelId} .ns-links button { display:flex !important; min-width:0 !important; min-height:48px !important; align-items:center !important; gap:9px !important; padding:10px 12px !important; border:1px solid rgba(114,170,181,.35) !important; border-radius:13px !important; background:#071b24 !important; color:#e7fbfb !important; text-decoration:none !important; font:800 13px/1.1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important; text-align:left !important; appearance:none !important; -webkit-appearance:none !important; }
        #${panelId} .ns-links span { color:#34d6c0 !important; font-size:18px !important; }
        #${panelId} .ns-links .ns-logout { color:#ffd3d9 !important; }
        #${panelId} .ns-links .ns-logout span { color:#fb8291 !important; }
      }
    `;
    document.head.appendChild(style);
  };

  const disableOldMenus = () => {
    document.querySelectorAll(OLD_MENUS).forEach(node => {
      node.hidden = true;
      node.setAttribute('aria-hidden', 'true');
      node.style.setProperty('display', 'none', 'important');
      node.style.pointerEvents = 'none';
    });
  };

  const install = () => {
    addStyle();
    disableOldMenus();
    document.getElementById(barId)?.remove();
    document.getElementById(panelId)?.remove();

    const profile = currentProfile();
    const path = location.pathname.toLowerCase();
    const active = file => path.endsWith(file);
    const bar = document.createElement('nav');
    bar.id = barId;
    bar.setAttribute('aria-label', 'Navigazione principale');
    bar.innerHTML = [
      ['naviturni.html', '▦', 'Turni', !active('cambi_turno.html') && !active('navidiaria.html') && !active('documenti.html')],
      ['cambi_turno.html', '⇄', 'Cambio', active('cambi_turno.html')],
      ['navidiaria.html', '≈', 'Diaria', active('navidiaria.html')],
      ['documenti.html', '▤', 'Documenti', active('documenti.html')]
    ].map(([href, icon, label, selected]) => `<a href="${href}" class="${selected ? 'active' : ''}"><span class="ns-icon">${icon}</span><b>${label}</b></a>`).join('') + '<button type="button" data-ns-menu aria-expanded="false" aria-controls="' + panelId + '"><span class="ns-icon">☰</span><b>Menu</b></button>';
    document.body.appendChild(bar);

    const links = [];
    if (isAdmin(profile)) links.push(['impostazioni.html', '⚙', 'Impostazioni']);
    if (isAdmin(profile) || isHiba(profile)) links.push(['aggiornamenti.html', '↻', 'Aggiornamenti']);
    if (isAdmin(profile)) links.push(['agenti.html', '♙', 'Agenti'], ['Orario.html', '◴', 'Orario']);
    links.push(['segnalazioni.html', '✉', 'Segnalazioni']);

    const panel = document.createElement('div');
    panel.id = panelId;
    panel.hidden = true;
    panel.innerHTML = '<section class="ns-menu-sheet" role="dialog" aria-modal="true" aria-label="Menu NaviSuite"><header><strong>Menu NaviSuite</strong><button type="button" class="ns-close" data-ns-close aria-label="Chiudi menu">✕</button></header><div class="ns-links">' +
      links.map(([href, icon, label]) => `<a href="${href}"><span>${icon}</span>${label}</a>`).join('') +
      '<button type="button" class="ns-logout" data-ns-logout><span>⇥</span>Esci</button></div></section>';
    document.body.appendChild(panel);

    const menuButton = bar.querySelector('[data-ns-menu]');
    const close = () => { panel.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); };
    const open = event => { event?.preventDefault(); event?.stopPropagation(); panel.hidden = false; menuButton.setAttribute('aria-expanded', 'true'); };
    ['pointerdown', 'click'].forEach(type => menuButton.addEventListener(type, event => {
      if (type === 'click' && !panel.hidden) return;
      open(event);
    }));
    ['pointerdown', 'click'].forEach(type => bar.addEventListener(type, event => event.stopPropagation()));
    panel.querySelector('[data-ns-close]').addEventListener('click', close);
    panel.addEventListener('pointerdown', event => { if (event.target === panel) close(); });
    panel.addEventListener('click', event => { if (event.target === panel) close(); });
    panel.querySelector('[data-ns-logout]').addEventListener('click', () => {
      if (typeof window.logoutAgent === 'function') return window.logoutAgent();
      localStorage.removeItem('navidiaria.activeAgent');
      localStorage.removeItem('naviturni_logged_agent');
      location.href = 'index.html';
    });
  };

  // Non attendere window.load: NaviTurni può continuare a caricare dati per molto tempo.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
