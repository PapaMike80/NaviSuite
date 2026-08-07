'use strict';

const CONFIG = {
  owner: 'PapaMike80',
  repo: 'NaviDiaria',
  branch: 'main',
  folders: ['turni', 'ods'],
  metadataFile: 'assets/js/documenti.json',
  version: 'v1.07'
};

const state = {
  documents: [],
  metadata: []
};

const elements = {
  turniGrid: document.getElementById('turniGrid'),
  odsGrid: document.getElementById('odsGrid'),
  turniCount: document.getElementById('turniCount'),
  odsCount: document.getElementById('odsCount'),
  refreshButton: document.getElementById('refreshButton'),
  notice: document.getElementById('notice'),
  emptyState: document.getElementById('emptyState'),
  viewer: document.getElementById('documentViewer'),
  viewerPages: document.getElementById('documentPages'),
  viewerFrame: document.getElementById('documentFrame'),
  viewerTitle: document.getElementById('viewerTitle'),
  viewerDownload: document.getElementById('viewerDownload'),
  viewerClose: document.getElementById('viewerClose')
};

let viewerRenderToken = 0;
const documentContentCache = new Map();

function isAdminUser() {
  try {
    const agent = JSON.parse(
      localStorage.getItem('navidiaria.activeAgent') ||
      localStorage.getItem('naviturni_logged_agent') ||
      'null'
    );
    if (!agent) return false;
    return ['91', '92'].includes(String(agent.id || '')) ||
      String(agent.role || '').toLowerCase() === 'admin';
  } catch {
    return false;
  }
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function addVersionToMenu() {
  if (document.getElementById('documentiVersion')) return;

  const sidebar =
    document.getElementById('archive-sidebar') ||
    document.querySelector('.app-sidebar');

  if (!sidebar) return;

  const version = document.createElement('div');
  version.id = 'documentiVersion';
  version.textContent = `Documenti ${CONFIG.version}`;
  version.style.cssText = [
    'margin:8px 12px 0',
    'padding-top:8px',
    'border-top:1px solid rgba(124,173,189,.18)',
    'color:#19e3c1',
    'font-size:11px',
    'font-weight:700',
    'letter-spacing:.04em'
  ].join(';');

  const userActions =
    sidebar.querySelector('.sidebar-user-actions') ||
    sidebar.querySelector('.sidebar-footer') ||
    sidebar.lastElementChild;

  if (userActions && userActions !== sidebar.querySelector('nav')) {
    userActions.insertAdjacentElement('beforebegin', version);
  } else {
    sidebar.appendChild(version);
  }
}

function githubApiUrl(folder) {
  return `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${folder}?ref=${CONFIG.branch}`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json' }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function loadMetadata() {
  try {
    const response = await fetch(
      `${CONFIG.metadataFile}?v=${Date.now()}`,
      { cache: 'no-store' }
    );

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : (data.documenti || []);
  } catch {
    return [];
  }
}

function metadataFor(path, filename) {
  const normalizedPath = decodeURIComponent(path).toLowerCase();
  const normalizedName = filename.toLowerCase();

  return state.metadata.find(item => {
    const file = decodeURIComponent(item.file || '').toLowerCase();
    return file === normalizedPath || file.endsWith(`/${normalizedName}`);
  }) || {};
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function titleFromFilename(filename, type, number) {
  const cleanName = filename
    .replace(/\.pdf$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (type === 'ods') {
    return `Ordine di servizio n. ${number || cleanName}`;
  }

  return cleanName
    .toLowerCase()
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function extractOdsNumber(filename) {
  const patterns = [
    /(?:o\.?\s*d\.?\s*s\.?|ods)[^0-9]*(?:n\.?\s*)?(\d{1,3})/i,
    /(?:n\.?\s*)(\d{1,3})(?=\s*[-_]\s*20\d{2})/i,
    /(\d{1,3})(?=-20\d{2})/i
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) return Number(match[1]);
  }

  return null;
}

function parseItalianRange(filename) {
  const matches = filename.match(
    /(\d{1,2})[-_](\d{1,2})(?:[-_](\d{2,4}))?/g
  );

  if (!matches || matches.length < 2) return {};

  function toIso(token) {
    const [day, month, rawYear] = token.split(/[-_]/).map(Number);
    const year = rawYear
      ? (rawYear < 100 ? 2000 + rawYear : rawYear)
      : 2026;

    return [
      year,
      String(month).padStart(2, '0'),
      String(day).padStart(2, '0')
    ].join('-');
  }

  return {
    inizio: toIso(matches[0]),
    fine: toIso(matches[1])
  };
}

function pagesPdfUrl(path) {
  return encodeURI(path);
}

function fileToDocument(file, folder) {
  const filename = file.name;
  const path = file.path || `${folder}/${filename}`;
  const metadata = metadataFor(path, filename);
  const isOds = folder === 'ods';
  const isDraft = !isOds && /bozza/i.test(filename);
  const number = metadata.numero ?? extractOdsNumber(filename);
  const range = parseItalianRange(filename);

  return {
    id: metadata.id || file.sha || path,
    tipo: metadata.tipo || (isOds ? 'ods' : isDraft ? 'bozza' : 'turno'),
    numero: number,
    titolo: metadata.titolo || titleFromFilename(
      filename,
      isOds ? 'ods' : isDraft ? 'bozza' : 'turno',
      number
    ),
    file: pagesPdfUrl(path),
    path,
    data: metadata.data || null,
    inizio: metadata.inizio || range.inizio || null,
    fine: metadata.fine || range.fine || null,
    filename,
    source:'github'
  };
}

async function scanGitHub() {
  const folderResults = await Promise.all(
    CONFIG.folders.map(async folder => {
      const entries = await fetchJson(githubApiUrl(folder));

      if (!Array.isArray(entries)) return [];

      return entries
        .filter(entry =>
          entry.type === 'file' &&
          /\.pdf$/i.test(entry.name)
        )
        .map(entry => fileToDocument(entry, folder));
    })
  );

  return folderResults.flat();
}

function fallbackFromJson() {
  return state.metadata.map((item, index) => ({
    id: item.id || `json-${index}`,
    ...item,
    file: pagesPdfUrl(item.file || ''),
    path: item.file || '',
    filename: (item.file || '').split('/').pop(),
    source:'json'
  }));
}

async function loadFirebaseDocuments() {
  const provider = window.NaviAdminFirebase;
  if (!provider?.getAdminDocuments) return [];
  await provider.ready;
  const documents = await provider.getAdminDocuments();
  return documents.map(item => ({
    ...item,
    id:String(item.id),
    file:'',
    path:'',
    source:'firebase'
  }));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function isCurrentTurn(documentItem) {
  if (documentItem.tipo !== 'turno') return false;

  const start = parseDate(documentItem.inizio);
  const end = parseDate(documentItem.fine);
  if (!start || !end) return false;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return today >= start && today <= end;
}

function documentDescription(documentItem) {
  if (documentItem.inizio && documentItem.fine) {
    const currentText = isCurrentTurn(documentItem)
      ? ' · Documento in vigore'
      : '';

    return `<b>Validità:</b> ${formatDate(documentItem.inizio)} – ${formatDate(documentItem.fine)}${currentText}`;
  }

  if (documentItem.data) {
    return `Data di emissione: ${formatDate(documentItem.data)}`;
  }

  return documentItem.tipo === 'ods'
    ? 'Documento presente nella cartella ODS'
    : 'Documento presente nella cartella turni';
}

function turnCard(documentItem) {
  const isDraft = documentItem.tipo === 'bozza';
  const isCurrent = isCurrentTurn(documentItem);

  const classes = [
    'document',
    isDraft ? 'featured draft-document' : '',
    isCurrent ? 'published-document' : ''
  ].filter(Boolean).join(' ');

  const label = isDraft
    ? 'BOZZA · NON DEFINITIVA'
    : isCurrent
      ? 'TURNO · IN VIGORE'
      : 'TURNO · PUBBLICATO';

  return `
    <article class="${classes}" data-document-id="${escapeHtml(documentItem.id)}">
      <span class="pdf-icon">PDF</span>
      <div>
        <small>${label}</small>
        <strong>${escapeHtml(documentItem.titolo)}</strong>
        <p>${documentDescription(documentItem)}</p>
      </div>
      ${documentActions(documentItem)}
    </article>
  `;
}

function odsCard(documentItem) {
  return `
    <article class="document" data-document-id="${escapeHtml(documentItem.id)}">
      <span class="ods-number">${escapeHtml(documentItem.numero || '≡')}</span>
      <div>
        <strong>${escapeHtml(documentItem.titolo)}</strong>
        <p>${documentDescription(documentItem)}</p>
      </div>
      ${documentActions(documentItem)}
    </article>
  `;
}

function documentActions(documentItem) {
  const showDelete = isAdminUser() && documentItem.source === 'firebase';
  return `
    <div class="document-actions">
      <button class="document-action" type="button" data-open-document="${escapeHtml(documentItem.id)}">Apri</button>
      <button class="document-action download" type="button" data-download-document="${escapeHtml(documentItem.id)}">↓ Scarica</button>
      ${showDelete ? `<button class="document-action delete" type="button" data-delete-document="${escapeHtml(documentItem.id)}">✕ Elimina</button>` : ''}
    </div>
  `;
}

async function documentUrl(documentItem) {
  const cacheKey = String(documentItem?.id || '');
  if (cacheKey && documentContentCache.has(cacheKey)) return documentContentCache.get(cacheKey);
  const url = documentItem?.source !== 'firebase'
    ? (documentItem?.file || '')
    : await window.NaviAdminFirebase.getAdminDocumentFile(documentItem.id);
  if (cacheKey && url) documentContentCache.set(cacheKey, url);
  return url;
}

function dataUrlBlob(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return null;
  const mimeType = match[1] || 'application/pdf';
  const decoded = match[2]
    ? atob(match[3])
    : decodeURIComponent(match[3]);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

async function openDocument(documentId) {
  const documentItem = state.documents.find(item => String(item.id) === String(documentId));
  if (!documentItem || !elements.viewer || !elements.viewerPages) return;

  const cachedUrl = documentContentCache.get(String(documentItem.id));
  const url = cachedUrl || await documentUrl(documentItem);
  if (!url) throw new Error('Contenuto del documento non disponibile');
  elements.viewerTitle.textContent = documentItem.titolo || documentItem.filename || 'Documento';
  elements.viewerDownload.dataset.documentId = String(documentItem.id);
  elements.viewer.hidden = false;
  document.body.classList.add('document-viewer-open');
  elements.viewerClose?.focus();
  await renderPdfDocument(url);
}

async function renderPdfDocument(url) {
  const pages = elements.viewerPages;
  const pdfjs = window.pdfjsLib;
  const token = ++viewerRenderToken;
  if (!pages) return;

  pages.scrollTop = 0;
  pages.innerHTML = '<div class="document-loading">Caricamento documento…</div>';
  if (!pdfjs?.getDocument) {
    showPdfFallback(url, 'Lettore PDF non disponibile.');
    return;
  }

  pdfjs.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';

  try {
    const loadingTask = pdfjs.getDocument(url);
    const pdf = await loadingTask.promise;
    if (token !== viewerRenderToken) return;

    pages.replaceChildren();
    const availableWidth = Math.max(280, pages.clientWidth - (window.innerWidth <= 720 ? 0 : 24));
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      if (token !== viewerRenderToken) return;
      const page = await pdf.getPage(pageNumber);
      const naturalViewport = page.getViewport({ scale: 1 });
      const cssScale = availableWidth / naturalViewport.width;
      const cssViewport = page.getViewport({ scale: cssScale });
      const renderViewport = page.getViewport({ scale: cssScale * outputScale });
      const holder = document.createElement('div');
      const canvas = document.createElement('canvas');

      holder.className = 'document-page';
      holder.setAttribute('aria-label', `Pagina ${pageNumber} di ${pdf.numPages}`);
      canvas.width = Math.floor(renderViewport.width);
      canvas.height = Math.floor(renderViewport.height);
      canvas.style.width = `${Math.floor(cssViewport.width)}px`;
      canvas.style.height = `${Math.floor(cssViewport.height)}px`;
      holder.appendChild(canvas);
      pages.appendChild(holder);

      await page.render({
        canvasContext: canvas.getContext('2d', { alpha: false }),
        viewport: renderViewport
      }).promise;
    }
  } catch (error) {
    if (token !== viewerRenderToken) return;
    showPdfFallback(url, `Non riesco a visualizzare il PDF (${error.message}).`);
  }
}

function showPdfFallback(url, message) {
  if (elements.viewerPages) {
    elements.viewerPages.innerHTML = `<div class="document-error">${escapeHtml(message)}<br>Uso il visualizzatore di riserva.</div>`;
    elements.viewerPages.style.display = 'none';
  }
  if (elements.viewerFrame) {
    elements.viewerFrame.style.display = 'block';
    elements.viewerFrame.src = `${url}#view=FitH`;
  }
}

async function downloadDocument(documentId) {
  const documentItem = state.documents.find(item => String(item.id) === String(documentId));
  if (!documentItem) return;
  const url = await documentUrl(documentItem);
  if (!url) throw new Error('Contenuto del documento non disponibile');

  // Un collegamento diretto a un PDF/data URL viene aperto a tutto schermo da
  // Safari iOS, anche in presenza dell'attributo download. Convertendolo prima
  // in un Blob il browser scarica il file senza abbandonare NaviSuite.
  let sourceBlob = dataUrlBlob(url);
  if (!sourceBlob) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Download non disponibile (${response.status})`);
    sourceBlob = await response.blob();
  }
  const blob = sourceBlob.type === 'application/pdf'
    ? sourceBlob
    : new Blob([sourceBlob], { type: 'application/pdf' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const rawFilename = documentItem.filename || documentItem.titolo || 'documento.pdf';
  link.href = objectUrl;
  link.download = /\.pdf$/i.test(rawFilename) ? rawFilename : `${rawFilename}.pdf`;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
}

async function deleteDocument(documentId) {
  const documentItem = state.documents.find(item => String(item.id) === String(documentId));
  if (!documentItem) return;
  if (!confirm(`Eliminare "${documentItem.titolo || documentItem.filename}"?`)) return;
  const provider = window.NaviAdminFirebase;
  if (!provider?.deleteAdminDocument) throw new Error('Eliminazione non disponibile');
  await provider.deleteAdminDocument(documentItem.id);
  documentContentCache.delete(String(documentItem.id));
  state.documents = state.documents.filter(item => String(item.id) !== String(documentId));
  renderDocuments();
}

function closeDocument() {
  if (!elements.viewer) return;
  viewerRenderToken += 1;
  elements.viewer.hidden = true;
  if (elements.viewerPages) {
    elements.viewerPages.replaceChildren();
    elements.viewerPages.style.display = '';
  }
  if (elements.viewerFrame) {
    elements.viewerFrame.src = 'about:blank';
    elements.viewerFrame.style.display = 'none';
  }
  if (elements.viewerDownload) delete elements.viewerDownload.dataset.documentId;
  document.body.classList.remove('document-viewer-open');
}

function documentScore(documentItem) {
  const date = parseDate(
    documentItem.data ||
    documentItem.inizio ||
    documentItem.fine
  );

  return date ? date.getTime() : Number(documentItem.numero || 0);
}

function countLabel(number) {
  return `${number} document${number === 1 ? 'o' : 'i'}`;
}

function renderDocuments() {
  const turni = state.documents
    .filter(item => item.tipo !== 'ods')
    .sort((a, b) => documentScore(b) - documentScore(a));

  const ods = state.documents
    .filter(item => item.tipo === 'ods')
    .sort((a, b) =>
      (b.numero || 0) - (a.numero || 0) ||
      documentScore(b) - documentScore(a)
    );

  if (elements.turniGrid) {
    elements.turniGrid.innerHTML = turni.map(turnCard).join('');
  }

  if (elements.odsGrid) {
    elements.odsGrid.innerHTML = ods.map(odsCard).join('');
  }

  if (elements.turniCount) {
    elements.turniCount.textContent = countLabel(turni.length);
  }

  if (elements.odsCount) {
    elements.odsCount.textContent = countLabel(ods.length);
  }

  if (elements.emptyState) {
    elements.emptyState.style.display =
      state.documents.length ? 'none' : 'block';
  }

  document.querySelectorAll('[data-open-document]').forEach(button => {
    button.addEventListener('click', () => openDocument(button.dataset.openDocument).catch(error => {
      if(elements.notice){elements.notice.hidden=false;elements.notice.textContent=`Non riesco ad aprire il documento: ${error.message}`}
    }));
  });
  document.querySelectorAll('[data-download-document]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      downloadDocument(button.dataset.downloadDocument).catch(error => {
      if(elements.notice){elements.notice.hidden=false;elements.notice.textContent=`Non riesco a scaricare il documento: ${error.message}`}
      });
    });
  });
  document.querySelectorAll('[data-delete-document]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      button.disabled = true;
      const originalLabel = button.textContent;
      button.textContent = 'Eliminazione…';
      deleteDocument(button.dataset.deleteDocument).catch(error => {
        if (elements.notice) { elements.notice.hidden = false; elements.notice.textContent = `Non riesco a eliminare il documento: ${error.message}`; }
        button.disabled = false;
        button.textContent = originalLabel;
      });
    });
  });
  document.querySelectorAll('[data-document-id]').forEach(card => {
    card.addEventListener('click', event => {
      if (event.target.closest('.document-actions')) return;
      openDocument(card.dataset.documentId).catch(error => {
        if(elements.notice){elements.notice.hidden=false;elements.notice.textContent=`Non riesco ad aprire il documento: ${error.message}`}
      });
    });
  });
}

async function loadDocuments() {
  if (elements.refreshButton) elements.refreshButton.disabled = true;
  setText('lastUpdate', 'Aggiornamento…');

  if (elements.notice) elements.notice.hidden = true;

  state.metadata = await loadMetadata();

  try {
    state.documents = await scanGitHub();
    setText('sourceLabel', 'Cartelle GitHub in tempo reale');
    setText(
      'lastUpdate',
      `Aggiornato ${new Date().toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit'
      })}`
    );
  } catch (error) {
    state.documents = fallbackFromJson();
    setText('sourceLabel', 'Archivio JSON di riserva');
    setText('lastUpdate', 'GitHub non raggiungibile');

    if (elements.notice) {
      elements.notice.hidden = false;
      elements.notice.textContent =
        `Non riesco a leggere ora le cartelle GitHub (${error.message}). ` +
        'Mostro i documenti registrati in assets/js/documenti.json.';
    }
  }

  try {
    const uploaded = await loadFirebaseDocuments();
    const byId = new Map(state.documents.map(item => [String(item.id), item]));
    uploaded.forEach(item => byId.set(String(item.id), item));
    state.documents = [...byId.values()];
    if (uploaded.length) setText('sourceLabel', 'Archivio GitHub + Firebase');
  } catch (error) {
    console.warn('Documenti Firebase non disponibili.', error);
  }

  renderDocuments();
  addVersionToMenu();

  if (elements.refreshButton) elements.refreshButton.disabled = false;
}

if (elements.refreshButton) {
  elements.refreshButton.addEventListener('click', loadDocuments);
}

elements.viewerClose?.addEventListener('click', closeDocument);
elements.viewerDownload?.addEventListener('click', async () => {
  const documentId = elements.viewerDownload.dataset.documentId;
  if (!documentId) return;
  elements.viewerDownload.disabled = true;
  const oldLabel = elements.viewerDownload.textContent;
  elements.viewerDownload.textContent = 'Preparazione…';
  try {
    await downloadDocument(documentId);
  } catch (error) {
    if(elements.notice){elements.notice.hidden=false;elements.notice.textContent=`Non riesco a scaricare il documento: ${error.message}`}
  } finally {
    elements.viewerDownload.disabled = false;
    elements.viewerDownload.textContent = oldLabel;
  }
});
elements.viewer?.addEventListener('click', event => {
  if (event.target === elements.viewer) closeDocument();
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !elements.viewer?.hidden) closeDocument();
});

/*
 * assets/js/shared-menu.js può ricostruire il menu dopo il caricamento della pagina.
 * Riprovare ad aggiungere la versione dopo un breve ritardo evita conflitti.
 */
window.addEventListener('load', () => {
  setTimeout(addVersionToMenu, 250);
  setTimeout(addVersionToMenu, 1000);
});

loadDocuments();
