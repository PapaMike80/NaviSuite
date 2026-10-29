(function () {
  'use strict';

  if (window.NaviDocViewer) return;

  // Inietta lo stile del visualizzatore
  function injectStyles() {
    if (document.getElementById('navi-doc-viewer-styles')) return;
    const style = document.createElement('style');
    style.id = 'navi-doc-viewer-styles';
    style.textContent = `
      .navi-doc-viewer[hidden] {
        display: none !important;
      }
      .navi-doc-viewer {
        position: fixed;
        inset: 0;
        z-index: 9990; /* appena sotto #navisuite-popup (10000) per aprire il menu sopra */
        display: flex;
        flex-direction: column;
        background: #071923;
        color: #eaf2f4;
        min-width: 0;
        min-height: 0;
        box-sizing: border-box;
      }

      body.navi-doc-open {
        overflow: hidden !important;
        touch-action: none;
      }
      body.navi-doc-open .mobile-liquid-nav {
        display: none !important;
      }

      .navi-doc-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: calc(10px + env(safe-area-inset-top, 0px)) 12px 10px;
        background: rgba(11, 28, 38, 0.98);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border-bottom: 1px solid #1f4250;
        min-height: calc(56px + env(safe-area-inset-top, 0px));
        box-sizing: border-box;
        flex-shrink: 0;
      }

      .navi-doc-action-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 42px;
        height: 42px;
        border-radius: 12px;
        font-family: 'Manrope', system-ui, -apple-system, sans-serif;
        font-weight: 800;
        font-size: 13.5px;
        text-decoration: none;
        cursor: pointer;
        box-sizing: border-box;
        transition: transform 0.1s ease, filter 0.15s ease, background 0.15s ease;
        -webkit-tap-highlight-color: transparent;
        flex-shrink: 0;
      }
      .navi-doc-action-btn:active {
        transform: scale(0.96);
      }

      .navi-doc-close-btn {
        background: #e0455f;
        color: #ffffff !important;
        border: 1px solid rgba(255, 255, 255, 0.25);
        padding: 0 14px;
        box-shadow: 0 2px 10px rgba(224, 69, 95, 0.45);
      }
      .navi-doc-close-btn:hover {
        background: #ef536e;
      }

      .navi-doc-title-wrap {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 0 4px;
        line-height: 1.25;
      }

      .navi-doc-title {
        font-size: 13.5px;
        font-weight: 800;
        color: #eaf2f4;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .navi-doc-sub {
        font-size: 11px;
        color: #8da4ae;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .navi-doc-actions-right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .navi-doc-ext-btn {
        background: rgba(45, 212, 191, 0.14);
        border: 1px solid rgba(45, 212, 191, 0.45);
        color: #a7fff0 !important;
        padding: 0 11px;
      }
      .navi-doc-ext-btn:hover {
        background: rgba(45, 212, 191, 0.25);
      }

      .navi-doc-menu-btn {
        background: #103a3d;
        border: 1px solid #2dd4bf;
        color: #a7fff0 !important;
        width: 44px;
        min-width: 44px;
        padding: 0;
        font-size: 23px;
        font-weight: 900;
      }
      .navi-doc-menu-btn:hover {
        background: #154c50;
      }

      .navi-doc-viewport {
        position: relative;
        flex: 1;
        min-height: 0;
        width: 100%;
        background: #ffffff;
        overflow: hidden;
      }

      #naviDocIframe {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: none;
        background: #ffffff;
        -webkit-overflow-scrolling: touch;
      }

      .navi-doc-md {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        background: #071923;
        color: #eaf2f4;
        padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 0px));
        box-sizing: border-box;
        font-family: 'Manrope', system-ui, sans-serif;
        line-height: 1.6;
      }
      .navi-doc-md h1 { font-size: 1.4rem; color: #2dd4bf; margin: 0 0 14px; border-bottom: 1px solid #1f4250; padding-bottom: 8px; }
      .navi-doc-md h2 { font-size: 1.2rem; color: #67d7e6; margin: 20px 0 10px; }
      .navi-doc-md h3 { font-size: 1.05rem; color: #a78bfa; margin: 16px 0 8px; }
      .navi-doc-md p { margin: 0 0 12px; color: #c4d9e0; font-size: 0.95rem; }
      .navi-doc-md ul, .navi-doc-md ol { margin: 0 0 14px 22px; color: #c4d9e0; font-size: 0.94rem; }
      .navi-doc-md li { margin-bottom: 6px; }
      .navi-doc-md code { background: #102733; padding: 2px 6px; border-radius: 6px; font-family: monospace; font-size: 0.88rem; color: #2dd4bf; }
      .navi-doc-md pre { background: #102733; padding: 12px; border-radius: 10px; overflow-x: auto; border: 1px solid #1f4250; }
      .navi-doc-md table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 0.88rem; }
      .navi-doc-md th, .navi-doc-md td { border: 1px solid #1f4250; padding: 8px 10px; text-align: left; }
      .navi-doc-md th { background: #102733; color: #2dd4bf; }

      @media (max-width: 480px) {
        .navi-doc-toolbar {
          padding-left: 8px;
          padding-right: 8px;
          gap: 6px;
        }
        .navi-doc-btn-label-long {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  let viewerEl = null;
  let iframeEl = null;
  let mdViewEl = null;
  let titleEl = null;
  let subEl = null;
  let downloadBtn = null;
  let hasPushedState = false;

  function ensureViewerElements() {
    if (viewerEl) return;
    injectStyles();

    viewerEl = document.createElement('div');
    viewerEl.id = 'naviDocViewer';
    viewerEl.className = 'navi-doc-viewer';
    viewerEl.hidden = true;
    viewerEl.setAttribute('role', 'dialog');
    viewerEl.setAttribute('aria-modal', 'true');
    viewerEl.setAttribute('aria-label', 'Visualizzatore Documenti NaviSuite');

    viewerEl.innerHTML = `
      <div class="navi-doc-toolbar">
        <button type="button" id="naviDocCloseBtn" class="navi-doc-action-btn navi-doc-close-btn" aria-label="Chiudi documento" title="Chiudi documento">
          <span>✕</span>
          <span>Chiudi</span>
        </button>

        <div class="navi-doc-title-wrap">
          <strong id="naviDocTitle" class="navi-doc-title">Documento</strong>
          <span id="naviDocSubtitle" class="navi-doc-sub">NaviSuite · In-App Document Viewer</span>
        </div>

        <div class="navi-doc-actions-right">
          <a id="naviDocDownloadBtn" class="navi-doc-action-btn navi-doc-ext-btn" href="#" target="_blank" rel="noopener noreferrer" title="Scarica o apri in Safari">
            <span>⤓</span>
            <span class="navi-doc-btn-label-long">Scarica</span>
          </a>
          <button type="button" id="naviDocMenuBtn" class="navi-doc-action-btn navi-doc-menu-btn" aria-label="Menu NaviSuite" title="Apri Menu NaviSuite per cambiare pagina">
            <span>☰</span>
          </button>
        </div>
      </div>

      <div class="navi-doc-viewport">
        <iframe id="naviDocIframe" title="Visualizzatore Documento" allow="fullscreen"></iframe>
        <div id="naviDocMarkdown" class="navi-doc-md" hidden></div>
      </div>
    `;

    document.body.appendChild(viewerEl);

    iframeEl = document.getElementById('naviDocIframe');
    mdViewEl = document.getElementById('naviDocMarkdown');
    titleEl = document.getElementById('naviDocTitle');
    subEl = document.getElementById('naviDocSubtitle');
    downloadBtn = document.getElementById('naviDocDownloadBtn');

    document.getElementById('naviDocCloseBtn').addEventListener('click', () => close(true));
    document.getElementById('naviDocMenuBtn').addEventListener('click', () => {
      if (typeof window.NaviSuiteMenu?.open === 'function') {
        window.NaviSuiteMenu.open();
      } else {
        location.href = 'quiz.html';
      }
    });

    window.addEventListener('popstate', (e) => {
      if (!viewerEl.hidden) {
        close(false);
      }
    });
  }

  function cleanTitle(rawTitle, url) {
    if (rawTitle && rawTitle.length > 2 && !/^(pdf|leggi|scarica|apri|vai|clicca)/i.test(rawTitle.trim())) {
      return rawTitle.replace(/[📄📖↓🔗]/g, '').trim();
    }
    const filename = (url.split('/').pop() || '').split('#')[0].split('?')[0];
    return decodeURIComponent(filename)
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim();
  }

  function renderMarkdownBasic(md) {
    const esc = str => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = '';
    const lines = md.split(/\r?\n/);
    let inList = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (inList) { html += '</ul>'; inList = false; }
        continue;
      }
      if (line.startsWith('# ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h1>${esc(line.slice(2))}</h1>`;
      } else if (line.startsWith('## ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h2>${esc(line.slice(3))}</h2>`;
      } else if (line.startsWith('### ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h3>${esc(line.slice(4))}</h3>`;
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList) { html += '<ul>'; inList = true; }
        let item = esc(line.slice(2));
        item = item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        item = item.replace(/`(.*?)`/g, '<code>$1</code>');
        html += `<li>${item}</li>`;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        let p = esc(line);
        p = p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        p = p.replace(/`(.*?)`/g, '<code>$1</code>');
        html += `<p>${p}</p>`;
      }
    }
    if (inList) html += '</ul>';
    return html;
  }

  function open(url, title) {
    if (!url) return;
    ensureViewerElements();

    const displayTitle = cleanTitle(title, url);
    titleEl.textContent = displayTitle;

    const isPdf = /\.pdf($|\?)/i.test(url);
    const isMd = /\.md($|\?)/i.test(url);
    const isDispensa = url.includes('dispense_navisuite/');

    let subText = 'Documento Ufficiale';
    if (isPdf) subText = 'Documento PDF · Visualizzazione protetta';
    else if (isMd) subText = 'Guida di Studio · Formato Markdown';
    else if (isDispensa) subText = 'Dispensa NaviSuite · Modulo Didattico';
    subEl.textContent = subText;

    downloadBtn.href = url;

    if (isMd) {
      iframeEl.style.display = 'none';
      mdViewEl.style.display = 'block';
      mdViewEl.hidden = false;
      mdViewEl.innerHTML = '<p style="color:var(--teal)">Caricamento documento in corso...</p>';

      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then(text => {
          mdViewEl.innerHTML = renderMarkdownBasic(text);
        })
        .catch(err => {
          mdViewEl.hidden = true;
          iframeEl.style.display = 'block';
          iframeEl.src = url;
        });
    } else {
      mdViewEl.style.display = 'none';
      mdViewEl.hidden = true;
      iframeEl.style.display = 'block';
      // Append #view=FitH for PDFs to fit width in supported mobile viewports
      const targetUrl = isPdf && !url.includes('#') ? `${url}#view=FitH` : url;
      iframeEl.src = targetUrl;
    }

    viewerEl.hidden = false;
    document.body.classList.add('navi-doc-open');

    // Salva lo stato history per consentire il tasto "Indietro" di chiudere il visualizzatore
    try {
      history.pushState({ naviDocOpen: true }, '', location.href);
      hasPushedState = true;
    } catch (e) {}
  }

  function close(popHistory) {
    if (!viewerEl || viewerEl.hidden) return;
    viewerEl.hidden = true;
    if (iframeEl) iframeEl.src = 'about:blank';
    document.body.classList.remove('navi-doc-open');

    if (popHistory && hasPushedState) {
      hasPushedState = false;
      try {
        if (history.state?.naviDocOpen) {
          history.back();
        }
      } catch (e) {}
    }
  }

  // Intercettore universale per i click sui documenti
  document.addEventListener('click', function (event) {
    const link = event.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    if (/^(tel:|mailto:|whatsapp:|sms:)/i.test(href)) return;

    // Se il link ha data-no-viewer, lascia passare
    if (link.hasAttribute('data-no-viewer')) return;

    const isExplicit = link.hasAttribute('data-doc-viewer');
    const isPdf = /\.pdf($|\?)/i.test(href);
    const isMd = /\.md($|\?)/i.test(href);
    const isDispensa = href.includes('dispense_navisuite/') || (href.includes('docs/controllo/') && href.endsWith('.html'));

    // Link esterni a siti terzi (es. inPA o albo navigazionelaghi) che NON sono PDF
    const isExternal = link.origin && link.origin !== location.origin;
    if (isExternal && !isPdf && !isExplicit) return;

    if (isExplicit || isPdf || isMd || isDispensa) {
      event.preventDefault();
      event.stopPropagation();

      const title = link.getAttribute('data-doc-title') ||
                    link.getAttribute('title') ||
                    link.innerText ||
                    link.querySelector('span:last-child')?.innerText;

      open(href, title);
    }
  }, true);

  window.NaviDocViewer = {
    open,
    close,
    isOpen: () => viewerEl && !viewerEl.hidden
  };

  window.openDocument = open;

})();
