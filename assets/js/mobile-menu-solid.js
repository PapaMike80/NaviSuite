/* NaviSuite: unico menu mobile comune. */
(() => {
  'use strict';

  const OLD_MENUS = '.mobile-liquid-nav,.admin-mobile-nav,.mobile-nav,.hiba-mobile-nav,.hiba-updates-mobile-nav,.navisuite-mobile-nav';
  const barId = 'navisuite-mobile-menu';
  const panelId = 'navisuite-mobile-menu-panel';
  const residencePalette = {
    DESENZANO: ['#38bdf8', 'rgba(14, 116, 144, .38)'],
    MADERNO: ['#f59e0b', 'rgba(101, 66, 4, .42)'],
    PESCHIERA: ['#4ade80', 'rgba(20, 83, 45, .42)'],
    RIVA: ['#a78bfa', 'rgba(55, 48, 116, .48)']
  };

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
      ${OLD_MENUS}, ${OLD_MENUS}[hidden] { display:none !important; visibility:hidden !important; pointer-events:none !important; }
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
          height:var(--ns-bar-height, calc(70px + env(safe-area-inset-bottom, 0px))) !important;
          box-sizing:border-box !important;
          padding:0 2px env(safe-area-inset-bottom, 0px) !important;
          margin:0 !important;
          transform:translateY(0) !important;
          transition:transform .2s ease !important;
          overflow:visible !important;
          background:#102733 !important;
          border-top:1px solid rgba(145,210,216,.35) !important;
          box-shadow:0 -5px 22px rgba(0,0,0,.34) !important;
          isolation:isolate !important;
          touch-action:manipulation !important;
        }
        #${barId}.ns-turni-menu { grid-template-columns:repeat(6, minmax(0, 1fr)) !important; }
        #${barId}.ns-hidden { transform:translateY(110%) !important; }
        #${barId} a, #${barId} button {
          display:flex !important;
          min-width:0 !important;
          min-height:var(--ns-item-height, 64px) !important;
          width:auto !important;
          height:var(--ns-item-height, 70px) !important;
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
          font:800 var(--ns-label-size, 10px)/1.05 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important;
          white-space:nowrap !important;
          appearance:none !important;
          -webkit-appearance:none !important;
          cursor:pointer !important;
          touch-action:manipulation !important;
        }
        #${barId} .ns-icon { font-size:var(--ns-icon-size, 23px) !important; line-height:var(--ns-icon-line, 22px) !important; }
        #${barId}.ns-turni-menu a, #${barId}.ns-turni-menu button { font-size:var(--ns-turni-label-size, 8px) !important; }
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
        #${panelId} .ns-links .ns-residence-choice { border-color:var(--ns-residence-color, #34d6c0) !important; background:var(--ns-residence-bg, #071b24) !important; color:var(--ns-residence-color, #e7fbfb) !important; }
        #${panelId} .ns-links .ns-residence-choice span { color:var(--ns-residence-color, #34d6c0) !important; }
        #${panelId} .ns-links .ns-residence-choice.active { box-shadow:inset 0 0 0 2px var(--ns-residence-color, #34d6c0) !important; }
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
    const isTurnsPage = active('naviturni.html');
    const bar = document.createElement('nav');
    bar.id = barId;
    if (isTurnsPage) bar.classList.add('ns-turni-menu');
    bar.setAttribute('aria-label', 'Navigazione principale');
    bar.innerHTML = [
      ['naviturni.html', '▦', 'Turni', !active('cambi_turno.html') && !active('navidiaria.html') && !active('documenti.html')],
      ['cambi_turno.html', '⇄', 'Cambio', active('cambi_turno.html')],
      ['navidiaria.html', '≈', 'Diaria', active('navidiaria.html')],
      ['documenti.html', '▤', 'Documenti', active('documenti.html')]
    ].map(([href, icon, label, selected]) => `<a href="${href}" class="${selected ? 'active' : ''}"><span class="ns-icon">${icon}</span><b>${label}</b></a>`).join('') +
      (isTurnsPage ? '<button type="button" data-ns-residence aria-label="Cambia residenza"><span class="ns-icon">⌖</span><b>Residenza</b></button>' : '') +
      '<button type="button" data-ns-menu aria-expanded="false" aria-controls="' + panelId + '"><span class="ns-icon">☰</span><b>Menu</b></button>';
    document.body.appendChild(bar);

    const links = [['index.html', '⌂', 'Home']];
    if (isAdmin(profile)) links.push(['impostazioni.html', '⚙', 'Impostazioni']);
    if (isAdmin(profile) || isHiba(profile)) links.push(['aggiornamenti.html', '↻', 'Aggiornamenti']);
    if (isAdmin(profile)) links.push(['agenti.html', '♙', 'Agenti'], ['Orario.html', '◴', 'Orario']);
    links.push(['segnalazioni.html', '✉', 'Segnalazioni']);

    const panel = document.createElement('div');
    panel.id = panelId;
    panel.hidden = true;
    const pastEntry = isTurnsPage ? '<button type="button" data-ns-past><span>◷</span><b>Mostra passato</b></button>' : '';
    const mainPanelHtml = () => '<section class="ns-menu-sheet" role="dialog" aria-modal="true" aria-label="Menu NaviSuite"><header><strong>Menu NaviSuite</strong><button type="button" class="ns-close" data-ns-close aria-label="Chiudi menu">✕</button></header><div class="ns-links">' +
      links.map(([href, icon, label]) => `<a href="${href}"><span>${icon}</span>${label}</a>`).join('') +
      pastEntry + '<button type="button" class="ns-logout" data-ns-logout><span>⇥</span>Esci</button></div></section>';
    panel.innerHTML = mainPanelHtml();
    document.body.appendChild(panel);

    const menuButton = bar.querySelector('[data-ns-menu]');
    const close = () => { panel.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); };
    const bindCloseButton = () => panel.querySelector('[data-ns-close]')?.addEventListener('click', close);
    const showBar = () => bar.classList.remove('ns-hidden');
    const hideBar = () => {
      if (window.innerWidth <= 850 && panel.hidden) bar.classList.add('ns-hidden');
    };
    const open = event => {
      event?.preventDefault();
      event?.stopPropagation();
      showBar();
      // Il pulsante ☰ deve aprire sempre il menu principale, anche se prima
      // era stato aperto il selettore Residenza nello stesso overlay.
      if (panel.dataset.view !== 'main') {
        panel.innerHTML = mainPanelHtml();
        panel.dataset.view = 'main';
        bindMenuActions();
      }
      panel.hidden = false;
      menuButton.setAttribute('aria-expanded', 'true');
    };
    ['pointerdown', 'click'].forEach(type => menuButton.addEventListener(type, event => {
      if (type === 'click' && !panel.hidden && panel.dataset.view === 'main') return;
      open(event);
    }));
    const residenceButton = bar.querySelector('[data-ns-residence]');
    const showResidencePicker = event => {
      event?.preventDefault();
      event?.stopPropagation();
      showBar();
      panel.hidden = false;
      panel.dataset.view = 'residence';
      const sourceButtons = [...document.querySelectorAll('#top-residence-buttons button')];
      const choices = sourceButtons.map((button, index) => ({ button, index }))
        .filter(({ button }) => button.textContent.trim().toUpperCase() !== 'TUTTE')
        .map(({ button, index }) => {
        const label = button.textContent.trim() || `Residenza ${index + 1}`;
        const activeClass = button.classList.contains('active') ? ' active' : '';
        const [color, background] = residencePalette[label.toUpperCase()] || ['#34d6c0', 'rgba(45,212,191,.12)'];
        return `<button type="button" class="ns-residence-choice${activeClass}" data-ns-residence-index="${index}" style="--ns-residence-color:${color};--ns-residence-bg:${background}"><span>⌖</span>${label}</button>`;
      }).join('');
      panel.innerHTML = '<section class="ns-menu-sheet" role="dialog" aria-modal="true" aria-label="Cambia residenza"><header><strong>Residenza</strong><button type="button" class="ns-close" data-ns-close aria-label="Chiudi menu">✕</button></header><div class="ns-links">' +
        (choices || '<div class="ns-residence-loading">Le residenze stanno caricando…</div>') + '</div></section>';
      bindCloseButton();
      panel.querySelectorAll('[data-ns-residence-index]').forEach(choice => choice.addEventListener('click', () => {
        sourceButtons[Number(choice.dataset.nsResidenceIndex)]?.click();
        close();
      }));
    };
    residenceButton?.addEventListener('pointerdown', showResidencePicker);
    residenceButton?.addEventListener('click', event => event.preventDefault());
    ['pointerdown', 'click'].forEach(type => bar.addEventListener(type, event => event.stopPropagation()));
    panel.addEventListener('pointerdown', event => { if (event.target === panel) close(); });
    panel.addEventListener('click', event => { if (event.target === panel) close(); });
    const bindMenuActions = () => {
      bindCloseButton();
      panel.querySelector('[data-ns-past]')?.addEventListener('click', () => {
        if (typeof window.togglePastColumns === 'function') window.togglePastColumns();
        const source = document.getElementById('togglePastBtn');
        const label = panel.querySelector('[data-ns-past] b');
        if (label) label.textContent = source?.textContent.replace(/^[^A-Za-zÀ-ÿ]+/, '').trim() || 'Mostra passato';
      });
      panel.querySelector('[data-ns-logout]')?.addEventListener('click', () => {
        if (typeof window.logoutAgent === 'function') return window.logoutAgent();
        localStorage.removeItem('navidiaria.activeAgent');
        localStorage.removeItem('naviturni_logged_agent');
        location.href = 'index.html';
      });
    };
    bindMenuActions();

    // Mantiene la dimensione fisica della barra costante anche con lo zoom di Safari.
    const syncVisualViewport = () => {
      const viewport = window.visualViewport;
      const scale = Math.max(1, Number(viewport?.scale || 1));
      const width = Number(viewport?.width || window.innerWidth);
      const left = Number(viewport?.offsetLeft || 0);
      bar.style.setProperty('width', `${width}px`, 'important');
      bar.style.setProperty('left', `${left}px`, 'important');
      bar.style.setProperty('right', 'auto', 'important');
      bar.style.setProperty('--ns-bar-height', `${70 / scale}px`);
      bar.style.setProperty('--ns-item-height', `${64 / scale}px`);
      bar.style.setProperty('--ns-label-size', `${10 / scale}px`);
      bar.style.setProperty('--ns-turni-label-size', `${8 / scale}px`);
      bar.style.setProperty('--ns-icon-size', `${23 / scale}px`);
      bar.style.setProperty('--ns-icon-line', `${22 / scale}px`);
    };
    syncVisualViewport();
    window.visualViewport?.addEventListener('resize', syncVisualViewport, { passive:true });
    window.visualViewport?.addEventListener('scroll', syncVisualViewport, { passive:true });
    window.addEventListener('resize', () => { syncVisualViewport(); showBar(); }, { passive:true });

    // Scorrendo verso il basso la barra esce dallo schermo; verso l'alto ricompare.
    const positions = new WeakMap();
    const onScroll = event => {
      const source = event.target === document || event.target === window ? document.scrollingElement : event.target;
      if (!source || typeof source.scrollTop !== 'number') return;
      const current = Math.max(0, source.scrollTop);
      const previous = positions.has(source) ? positions.get(source) : current;
      positions.set(source, current);
      const delta = current - previous;
      if (current < 18 || delta < -4) showBar();
      else if (delta > 10) hideBar();
    };
    document.addEventListener('scroll', onScroll, { capture:true, passive:true });
    window.addEventListener('scroll', onScroll, { passive:true });
  };

  // Non attendere window.load: NaviTurni può continuare a caricare dati per molto tempo.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
