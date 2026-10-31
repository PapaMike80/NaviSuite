(function () {
  'use strict';

  if (window.NaviDocViewer) return;

  const esc = str => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Inietta lo stile del visualizzatore con supporto autohide e scrolling fluido
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
        z-index: 9990; /* sotto #navisuite-popup (10000) per aprire il menu sopra */
        display: flex;
        flex-direction: column;
        background: #071923;
        color: #eaf2f4;
        min-width: 0;
        min-height: 0;
        box-sizing: border-box;
        overflow: hidden;
      }

      body.navi-doc-open {
        overflow: hidden !important;
        touch-action: none;
      }
      body.navi-doc-open .mobile-liquid-nav {
        display: none !important;
      }

      /* Barra superiore con animazione a comparsa/scomparsa */
      .navi-doc-toolbar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 25;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: calc(10px + env(safe-area-inset-top, 0px)) 12px 10px;
        background: rgba(11, 28, 38, 0.96);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-bottom: 1px solid #1f4250;
        min-height: calc(56px + env(safe-area-inset-top, 0px));
        box-sizing: border-box;
        transform: translateY(0);
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
        will-change: transform;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
      }

      .navi-doc-toolbar.navi-doc-toolbar-hidden {
        transform: translateY(-100%);
        pointer-events: none;
      }

      /* Sensore touch invisibile in alto per riaprire la barra con un tocco quando è nascosta */
      .navi-doc-top-sensor {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: calc(28px + env(safe-area-inset-top, 0px));
        z-index: 20;
        cursor: pointer;
        display: none;
      }
      .navi-doc-toolbar-hidden ~ .navi-doc-top-sensor {
        display: block;
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
        transform: scale(0.95);
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

      /* Viewport a pieno schermo per immersione totale */
      .navi-doc-viewport {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        background: #071923;
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

      /* Pagine PDF native renderizzate con PDF.js */
      .navi-doc-pdf-pages {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        background: #071923;
        color: #eaf2f4;
        padding: calc(68px + env(safe-area-inset-top, 0px)) 10px calc(40px + env(safe-area-inset-bottom, 0px));
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }
      .navi-doc-pdf-pages[hidden] {
        display: none !important;
      }

      .navi-doc-pdf-jump-banner {
        width: 100%;
        max-width: 860px;
        background: rgba(16, 58, 61, 0.95);
        border: 1px solid #2dd4bf;
        border-radius: 12px;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        color: #eaf2f4;
        font-size: 13px;
        box-sizing: border-box;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        position: sticky;
        top: 0;
        z-index: 10;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      .navi-doc-pdf-jump-btn {
        background: #2dd4bf;
        color: #071923;
        border: none;
        border-radius: 8px;
        font-weight: 800;
        font-size: 12.5px;
        padding: 7px 14px;
        cursor: pointer;
        white-space: nowrap;
        transition: transform 0.1s ease, filter 0.15s ease;
      }
      .navi-doc-pdf-jump-btn:active {
        transform: scale(0.96);
      }

      .navi-doc-pdf-page-holder {
        width: 100%;
        max-width: 860px;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45);
        overflow: hidden;
        position: relative;
        box-sizing: border-box;
        transition: box-shadow 0.3s ease, border-color 0.3s ease;
      }
      .navi-doc-pdf-page-holder.navi-doc-page-target {
        border: 2px solid #2dd4bf;
        box-shadow: 0 0 24px rgba(45, 212, 191, 0.45);
      }
      .navi-doc-pdf-page-holder canvas {
        display: block;
        width: 100% !important;
        height: auto !important;
      }
      .navi-doc-pdf-page-num {
        position: absolute;
        top: 8px;
        right: 10px;
        background: rgba(11, 28, 38, 0.85);
        color: #2dd4bf;
        border: 1px solid rgba(45, 212, 191, 0.45);
        font-size: 11px;
        font-weight: 800;
        padding: 3px 8px;
        border-radius: 6px;
        pointer-events: none;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }

      .navi-doc-pdf-loading, .navi-doc-pdf-error {
        color: #2dd4bf;
        font-size: 14.5px;
        font-weight: 700;
        padding: 40px 20px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }
      .navi-doc-pdf-error {
        color: #fca5a5;
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
        padding: calc(72px + env(safe-area-inset-top, 0px)) 20px calc(30px + env(safe-area-inset-bottom, 0px));
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
  let toolbarEl = null;
  let iframeEl = null;
  let pdfPagesEl = null;
  let mdViewEl = null;
  let titleEl = null;
  let subEl = null;
  let downloadBtn = null;
  let hasPushedState = false;
  let isToolbarHidden = false;
  let activeRenderToken = 0;

  function setToolbarHidden(hidden) {
    if (isToolbarHidden === hidden || !toolbarEl) return;
    isToolbarHidden = hidden;
    if (hidden) {
      toolbarEl.classList.add('navi-doc-toolbar-hidden');
    } else {
      toolbarEl.classList.remove('navi-doc-toolbar-hidden');
    }
  }

  function setupScrollWatcher(targetWin, targetDoc) {
    if (!targetWin) return;
    let lastY = 0;
    let touchStartY = 0;

    targetWin.addEventListener('scroll', () => {
      const currentY = targetWin.scrollY || targetDoc?.documentElement?.scrollTop || targetDoc?.body?.scrollTop || 0;
      const diff = currentY - lastY;

      if (currentY <= 25) {
        setToolbarHidden(false);
      } else if (diff > 10) {
        // Scorrimento verso il basso -> nascondi
        setToolbarHidden(true);
      } else if (diff < -8) {
        // Scorrimento verso l'alto -> mostra
        setToolbarHidden(false);
      }
      lastY = currentY;
    }, { passive: true });

    targetWin.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    targetWin.addEventListener('touchmove', (e) => {
      if (!e.touches || !e.touches[0]) return;
      const touchY = e.touches[0].clientY;
      const diff = touchY - touchStartY;
      const currentY = targetWin.scrollY || targetDoc?.documentElement?.scrollTop || targetDoc?.body?.scrollTop || 0;

      if (currentY <= 25) {
        setToolbarHidden(false);
      } else if (diff < -15) {
        // Dito va su, pagina scorre in basso -> nascondi
        setToolbarHidden(true);
      } else if (diff > 12) {
        // Dito va giù, pagina scorre in alto -> mostra
        setToolbarHidden(false);
      }
      touchStartY = touchY;
    }, { passive: true });
  }

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
      <div id="naviDocToolbar" class="navi-doc-toolbar">
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

      <div class="navi-doc-top-sensor" id="naviDocTopSensor" title="Tocca per mostrare la barra"></div>

      <div class="navi-doc-viewport" id="naviDocViewport">
        <div id="naviDocPdfPages" class="navi-doc-pdf-pages" hidden></div>
        <iframe id="naviDocIframe" title="Visualizzatore Documento" allow="fullscreen"></iframe>
        <div id="naviDocMarkdown" class="navi-doc-md" hidden></div>
      </div>
    `;

    document.body.appendChild(viewerEl);

    toolbarEl = document.getElementById('naviDocToolbar');
    iframeEl = document.getElementById('naviDocIframe');
    pdfPagesEl = document.getElementById('naviDocPdfPages');
    mdViewEl = document.getElementById('naviDocMarkdown');
    titleEl = document.getElementById('naviDocTitle');
    subEl = document.getElementById('naviDocSubtitle');
    downloadBtn = document.getElementById('naviDocDownloadBtn');

    // Tocco sulla barra superiore nascosta o sul sensore per ripristinare
    document.getElementById('naviDocTopSensor').addEventListener('click', () => setToolbarHidden(false));

    document.getElementById('naviDocCloseBtn').addEventListener('click', () => close(true));
    document.getElementById('naviDocMenuBtn').addEventListener('click', () => {
      if (typeof window.NaviSuiteMenu?.open === 'function') {
        window.NaviSuiteMenu.open();
      } else {
        location.href = 'quiz.html';
      }
    });

    window.addEventListener('popstate', () => {
      if (!viewerEl.hidden) {
        close(false);
      }
    });

    // Monitoraggio scroll per PDF view
    let lastPdfY = 0;
    pdfPagesEl.addEventListener('scroll', () => {
      const currentY = pdfPagesEl.scrollTop;
      const diff = currentY - lastPdfY;
      if (currentY <= 25) {
        setToolbarHidden(false);
      } else if (diff > 12) {
        setToolbarHidden(true);
      } else if (diff < -8) {
        setToolbarHidden(false);
      }
      lastPdfY = currentY;
    }, { passive: true });

    // Monitoraggio scroll per Markdown view
    let lastMdY = 0;
    mdViewEl.addEventListener('scroll', () => {
      const currentY = mdViewEl.scrollTop;
      const diff = currentY - lastMdY;
      if (currentY <= 25) {
        setToolbarHidden(false);
      } else if (diff > 10) {
        setToolbarHidden(true);
      } else if (diff < -8) {
        setToolbarHidden(false);
      }
      lastMdY = currentY;
    }, { passive: true });

    // Monitoraggio scroll sull'iframe quando caricato
    iframeEl.addEventListener('load', () => {
      try {
        const win = iframeEl.contentWindow;
        if (win) {
          setupScrollWatcher(win, win.document);
        }
      } catch (_) {
        // Frame cross-origin o plugin PDF nativo
      }
    });
  }

  function getPdfJsBasePath() {
    if (location.pathname.includes('/docs/controllo/dispense_navisuite/')) return '../../../';
    if (location.pathname.includes('/docs/controllo/')) return '../../';
    return './';
  }

  async function ensurePdfJs() {
    if (window.pdfjsLib?.getDocument) {
      if (window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfJsBasePath() + 'vendor/pdfjs/pdf.worker.min.js';
      }
      return window.pdfjsLib;
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      const basePath = getPdfJsBasePath();
      s.src = basePath + 'vendor/pdfjs/pdf.min.js';
      s.onload = () => {
        if (window.pdfjsLib?.GlobalWorkerOptions) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = basePath + 'vendor/pdfjs/pdf.worker.min.js';
        }
        resolve(window.pdfjsLib);
      };
      s.onerror = () => reject(new Error('PDF.js non disponibile'));
      document.head.appendChild(s);
    });
  }

  async function findTargetPage(pdf, options) {
    if (!pdf || pdf.numPages <= 1) return null;
    const agentQuery = String(options?.agentName || '').trim().toUpperCase();
    const surnameMatch = agentQuery.match(/^([A-ZÀ-ÖØ-öø-ÿ'\s]+?)(?:\s+[A-Z]\.|\s+[(]|$)/);
    const surname = (surnameMatch ? surnameMatch[1] : agentQuery).trim();

    let variationPage = null;
    let agentPage = null;

    const variationRegex = /(?:variazion[ie]|modifiche|moviment[io])\s+(?:turn[oi]|personale)|turno\s+del\s+personale|variazioni\s+turni|variazioni\s+servizio/i;

    for (let p = 1; p <= pdf.numPages; p++) {
      try {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        const text = textContent.items.map(it => it.str).join(' ');

        if (!variationPage && variationRegex.test(text)) {
          variationPage = p;
        }

        if (surname && surname.length >= 3) {
          const nameRegex = new RegExp('\\b' + surname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
          if (nameRegex.test(text)) {
            if (variationPage || variationRegex.test(text)) {
              agentPage = p;
              break;
            } else if (!agentPage) {
              agentPage = p;
            }
          }
        }
      } catch (_) {}
    }

    return agentPage || variationPage || null;
  }

  async function renderPdfDocument(url, displayTitle, options, renderId) {
    if (!pdfPagesEl) return;
    pdfPagesEl.hidden = false;
    pdfPagesEl.scrollTop = 0;
    pdfPagesEl.innerHTML = `
      <div class="navi-doc-pdf-loading">
        <span style="font-size:26px;">⏳</span>
        <span>Caricamento documento in corso…</span>
      </div>
    `;
    iframeEl.style.display = 'none';
    mdViewEl.style.display = 'none';

    let pdfjs = null;
    try {
      pdfjs = await ensurePdfJs();
    } catch (e) {
      console.warn('PDF.js non disponibile, fallback a iframe:', e);
      pdfPagesEl.hidden = true;
      iframeEl.style.display = 'block';
      iframeEl.src = !url.includes('#') ? `${url}#view=FitH` : url;
      return;
    }

    if (renderId !== activeRenderToken) return;

    try {
      let docParam = url;
      if (typeof url === 'string' && url.startsWith('data:')) {
        const b64 = url.split(',')[1] || '';
        const binStr = atob(b64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        docParam = { data: bytes, isEvalSupported: false };
      } else {
        docParam = { url: url, isEvalSupported: false };
      }

      const loadingTask = pdfjs.getDocument(docParam);
      const pdf = await loadingTask.promise;

      if (renderId !== activeRenderToken) return;

      subEl.textContent = `Documento PDF · ${pdf.numPages} ${pdf.numPages === 1 ? 'pagina' : 'pagine'}`;

      const targetPageNumber = await findTargetPage(pdf, options);

      if (renderId !== activeRenderToken) return;

      pdfPagesEl.replaceChildren();

      let jumpBtn = null;
      if (targetPageNumber && targetPageNumber > 1) {
        const banner = document.createElement('div');
        banner.className = 'navi-doc-pdf-jump-banner';
        banner.id = 'naviDocJumpBanner';

        const agentText = options?.agentName ? `per <strong>${esc(options.agentName)}</strong> ` : '';
        banner.innerHTML = `
          <span>📌 <strong>Variazioni turno</strong> ${agentText}a <strong>Pagina ${targetPageNumber}</strong></span>
          <button type="button" class="navi-doc-pdf-jump-btn" id="naviDocJumpBtn">Vai a Pagina ${targetPageNumber} ↓</button>
        `;
        pdfPagesEl.appendChild(banner);
        jumpBtn = banner.querySelector('#naviDocJumpBtn');
      }

      const availableWidth = Math.max(280, Math.min(860, (pdfPagesEl.clientWidth || window.innerWidth) - 20));
      const outputScale = Math.min(window.devicePixelRatio || 1, 2.2);

      let targetHolderEl = null;

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        if (renderId !== activeRenderToken) return;

        const page = await pdf.getPage(pageNumber);
        const naturalViewport = page.getViewport({ scale: 1 });
        const cssScale = Math.min(1.5, availableWidth / naturalViewport.width);
        const cssViewport = page.getViewport({ scale: cssScale });
        const renderViewport = page.getViewport({ scale: cssScale * outputScale });

        const holder = document.createElement('div');
        holder.className = 'navi-doc-pdf-page-holder';
        holder.id = `naviDocPage-${pageNumber}`;
        holder.setAttribute('aria-label', `Pagina ${pageNumber} di ${pdf.numPages}`);
        holder.style.maxWidth = `${Math.floor(cssViewport.width)}px`;
        holder.style.minHeight = `${Math.floor(cssViewport.height)}px`;

        if (pageNumber === targetPageNumber) {
          holder.classList.add('navi-doc-page-target');
          targetHolderEl = holder;
        }

        const badge = document.createElement('div');
        badge.className = 'navi-doc-pdf-page-num';
        badge.textContent = `Pag. ${pageNumber} / ${pdf.numPages}`;
        holder.appendChild(badge);

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        holder.appendChild(canvas);

        pdfPagesEl.appendChild(holder);

        await page.render({
          canvasContext: canvas.getContext('2d', { alpha: false }),
          viewport: renderViewport
        }).promise;
      }

      function scrollToHolder(el) {
        if (!el || !pdfPagesEl) return;
        const top = Math.max(0, el.offsetTop - 64);
        pdfPagesEl.scrollTo({ top, behavior: 'smooth' });
      }

      if (jumpBtn && targetHolderEl) {
        jumpBtn.addEventListener('click', () => scrollToHolder(targetHolderEl));
      }

      if (targetHolderEl && targetPageNumber > 1) {
        setTimeout(() => {
          if (renderId === activeRenderToken && targetHolderEl) {
            scrollToHolder(targetHolderEl);
          }
        }, 180);
      }

    } catch (err) {
      if (renderId !== activeRenderToken) return;
      console.warn('Errore PDF.js, uso fallback iframe:', err);
      pdfPagesEl.hidden = true;
      iframeEl.style.display = 'block';
      iframeEl.src = !url.includes('#') ? `${url}#view=FitH` : url;
    }
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

  function open(url, title, options) {
    if (!url) return;
    ensureViewerElements();
    activeRenderToken++;
    const currentToken = activeRenderToken;

    // Mostra sempre la barra all'apertura
    setToolbarHidden(false);

    const displayTitle = cleanTitle(title, url);
    titleEl.textContent = displayTitle;

    const isPdf = /\.pdf($|\?)/i.test(url) || url.startsWith('blob:') || url.startsWith('data:application/pdf');
    const isMd = /\.md($|\?)/i.test(url);
    const isDispensa = url.includes('dispense_navisuite/');

    let subText = 'Documento Ufficiale';
    if (isPdf) subText = 'Documento PDF · Visualizzazione protetta';
    else if (isMd) subText = 'Guida di Studio · Formato Markdown';
    else if (isDispensa) subText = 'Dispensa NaviSuite · Modulo Didattico';
    subEl.textContent = subText;

    downloadBtn.href = url;
    if (isPdf) downloadBtn.setAttribute('download', displayTitle + '.pdf');

    if (isMd) {
      if (pdfPagesEl) pdfPagesEl.hidden = true;
      iframeEl.style.display = 'none';
      mdViewEl.style.display = 'block';
      mdViewEl.hidden = false;
      mdViewEl.scrollTop = 0;
      mdViewEl.innerHTML = '<p style="color:var(--teal)">Caricamento documento in corso...</p>';

      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then(text => {
          if (currentToken !== activeRenderToken) return;
          mdViewEl.innerHTML = renderMarkdownBasic(text);
        })
        .catch(() => {
          if (currentToken !== activeRenderToken) return;
          mdViewEl.hidden = true;
          iframeEl.style.display = 'block';
          iframeEl.src = url;
        });
    } else if (isPdf) {
      iframeEl.style.display = 'none';
      mdViewEl.style.display = 'none';
      mdViewEl.hidden = true;
      renderPdfDocument(url, displayTitle, options, currentToken);
    } else {
      if (pdfPagesEl) pdfPagesEl.hidden = true;
      mdViewEl.style.display = 'none';
      mdViewEl.hidden = true;
      iframeEl.style.display = 'block';
      const targetUrl = isPdf && !url.includes('#') ? `${url}#view=FitH` : url;
      iframeEl.src = targetUrl;
    }

    viewerEl.hidden = false;
    document.body.classList.add('navi-doc-open');

    try {
      history.pushState({ naviDocOpen: true }, '', location.href);
      hasPushedState = true;
    } catch (_) {}
  }

  function close(popHistory) {
    if (!viewerEl || viewerEl.hidden) return;
    activeRenderToken++;
    viewerEl.hidden = true;
    setToolbarHidden(false);
    if (pdfPagesEl) {
      pdfPagesEl.hidden = true;
      pdfPagesEl.replaceChildren();
    }
    if (iframeEl) iframeEl.src = 'about:blank';
    document.body.classList.remove('navi-doc-open');

    if (popHistory && hasPushedState) {
      hasPushedState = false;
      try {
        if (history.state?.naviDocOpen) {
          history.back();
        }
      } catch (_) {}
    }
  }

  // Intercettore universale per i click sui documenti
  document.addEventListener('click', function (event) {
    const link = event.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    if (/^(tel:|mailto:|whatsapp:|sms:)/i.test(href)) return;

    if (link.hasAttribute('data-no-viewer')) return;

    const isExplicit = link.hasAttribute('data-doc-viewer');
    const isPdf = /\.pdf($|\?)/i.test(href);
    const isMd = /\.md($|\?)/i.test(href);
    const isDispensa = href.includes('dispense_navisuite/') || (href.includes('docs/controllo/') && href.endsWith('.html'));

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
    isOpen: () => viewerEl && !viewerEl.hidden,
    setToolbarHidden,
    findTargetPage
  };

  window.openDocument = open;

})();
