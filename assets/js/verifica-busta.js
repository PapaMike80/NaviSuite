// Pagina "Verifica busta paga": legge il PDF sul dispositivo (busta-parser.js),
// calcola i totali della Distinta (distinta-totals.js) e li confronta
// (busta-compare.js). La Diaria arriva da Firebase come in navidiaria.html.
(function () {
  const $ = id => document.getElementById(id);
  const els = {
    login: $('vbLogin'),
    fileInput: $('vbFileInput'),
    fileLabel: $('vbFileLabel'),
    fileInfo: $('vbFileInfo'),
    month: $('vbMonth'),
    period: $('vbPeriod'),
    source: $('vbSource'),
    alerts: $('vbAlerts'),
    result: $('vbResult'),
    months: $('vbMonths'),
    files: $('vbFiles'),
    clear: $('vbClear'),
    monthField: $('vbMonthField')
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const number = (value, decimals = 2) => Number(value).toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const euro = value => `${number(value, 2)} €`;
  const clock = minutes => { const m = Math.round(Math.abs(Number(minutes) || 0)); return `${minutes < 0 ? '-' : ''}${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
  const dateText = isoValue => { const [y, m, d] = String(isoValue || '').split('-'); return y ? `${d}/${m}/${y}` : ''; };
  const monthLabel = value => { const match = /^(\d{4})-(\d{2})$/.exec(value || ''); if (!match) return ''; const text = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(Number(match[1]), Number(match[2]) - 1, 1, 12)); return text.charAt(0).toUpperCase() + text.slice(1); };
  function unitValue(value, unit) {
    if (value === null || value === undefined) return '—';
    if (unit === 'ore') return `${number(value, 2)} h`;
    return number(value, Number.isInteger(value) ? 0 : 2);
  }
  function signedUnit(value, unit) {
    if (!value) return unit === 'ore' ? '0,00 h' : '0';
    return `${value > 0 ? '+' : '−'}${unitValue(Math.abs(value), unit)}`;
  }

  let agent = null;
  try { agent = JSON.parse(localStorage.getItem('navidiaria.activeAgent') || 'null'); } catch (_) { agent = null; }

  const state = { buste: [], data: null, loadingData: null };

  function setAlerts(list) {
    els.alerts.innerHTML = list.map(alert => `<p class="vb-alert ${alert.kind || 'warn'}">${escapeHtml(alert.text)}</p>`).join('');
  }

  function previousOfToday() {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() - 1, 1, 12);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function readLocalEntries(id) {
    try {
      const parsed = JSON.parse(localStorage.getItem(`navidiaria.entries.v1.${id}`) || '[]');
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (_) { return []; }
  }

  // Stessa priorita' di navidiaria.html: con modifiche non sincronizzate vale
  // la copia locale; altrimenti Firebase, con ripiego sulla copia locale.
  async function loadEntries() {
    const id = String(agent.id);
    const local = readLocalEntries(id);
    const warnings = [];
    if (localStorage.getItem(`navidiaria.cloudDirty.${id}`) === '1') {
      warnings.push({ kind: 'warn', text: 'Hai modifiche della Distinta non ancora sincronizzate: uso la copia salvata su questo dispositivo. Apri la Distinta per sincronizzarla.' });
      return { entries: local, source: 'local', updatedAt: '', warnings };
    }
    // Come la Distinta: prima PocketBase (copia principale), se non risponde il backup Firebase
    let remote = null, source = '';
    try { if (window.NaviAdminPB?.loadDiaria) { remote = await window.NaviAdminPB.loadDiaria(id); source = 'pocketbase'; } } catch (error) { console.warn('Verifica busta: PocketBase non raggiungibile', error); }
    if (!remote || !remote.entries.length) {
      try {
        if (!window.NaviAdminFirebase?.loadDiaria) throw new Error('Modulo Firebase non disponibile');
        await window.NaviAdminFirebase.ready;
        const fb = await window.NaviAdminFirebase.loadDiaria(id);
        if (fb.entries.length) { remote = fb; source = 'firebase'; }
      } catch (error) { console.warn('Verifica busta: Firebase non raggiungibile', error); }
    }
    if (!remote || !remote.entries.length) {
      warnings.push({ kind: 'warn', text: `Archivio della Distinta non raggiungibile: uso la copia su questo dispositivo${local.length ? ', che potrebbe non essere aggiornata' : ', ma è vuota'}.` });
      return { entries: local, source: 'local', updatedAt: '', warnings };
    }
    return { entries: remote.entries, source, updatedAt: remote.updatedAt, warnings };
  }

  // Ricarica la Distinta (dopo una modifica in navidiaria.html): pulsante e ritorno sulla pagina
  function ricarica() { state.loadingData = null; state.data = null; return render().catch(error => console.error('Verifica busta', error)); }
  function ensureData() {
    if (!state.loadingData) state.loadingData = loadEntries().then(data => { state.data = data; return data; });
    return state.loadingData;
  }

  // Da dove arrivano i dati: visibile solo agli admin
  function sourceText(data) {
    if (!data) return 'Carico la Distinta…';
    if (!window.NaviRoles?.isAdminAgent?.(agent)) return '';
    return data.source === 'pocketbase' ? 'Dati: PocketBase' : data.source === 'firebase' ? 'Dati: Firebase (PocketBase non raggiungibile)' : 'Dati: copia locale su questo dispositivo';
  }

  const STATUS = {
    diff: { label: 'Differenza', className: 'is-diff' },
    check: { label: 'Da verificare', className: 'is-check' },
    ok: { label: 'Coerente', className: 'is-ok' }
  };

  const monthOf = busta => (busta.period ? `${busta.period.year}-${String(busta.period.month).padStart(2, '0')}` : '');

  // Una tabella per busta: voce, Distinta, busta, differenza (con la stima in euro), valore in busta, stato.
  function tableHtml(rows) {
    if (!rows.length) return '<p class="vb-empty">Nessuna delle voci confrontabili compare nella busta o nella Distinta di questo mese.</p>';
    return `<div class="vb-summary-wrap"><table class="vb-table vb-summary"><thead><tr><th>Voce</th><th>Distinta</th><th>Busta</th><th>Diff.</th><th>Valore</th><th>Stato</th></tr></thead><tbody>${rows.map(row => {
      const state = row.status === 'ok' ? 'Match' : row.status === 'check' ? 'Da verificare' : 'Mismatch';
      const diffEuro = row.status !== 'ok' && row.euro ? `<small class="vb-euro-diff">${row.euro > 0 ? '+' : '−'}${escapeHtml(euro(Math.abs(row.euro)))}</small>` : '';
      return `<tr class="${STATUS[row.status].className}"><td>${escapeHtml(row.label)}<small>${escapeHtml(row.codes.join(' + '))}</small>${row.status === 'check' && row.notes?.length ? `<small class="vb-note-row">${escapeHtml(row.notes[row.notes.length - 1]).replace(/\n/g, '<br>')}</small>` : ''}</td><td>${unitValue(row.distinta, row.unit)}</td><td>${row.busta === null ? 'assente' : unitValue(row.busta, row.unit)}</td><td>${row.status === 'ok' ? '—' : signedUnit(row.diff, row.unit)}${diffEuro}</td><td>${row.importo ? escapeHtml(euro(row.importo)) : '—'}${row.importoDistinta !== null && row.importoDistinta !== undefined && row.status !== 'ok' ? `<small class="vb-euro-diff">Distinta ${escapeHtml(euro(row.importoDistinta))}</small>` : ''}</td><td class="vb-state">${row.status === 'ok' ? '✓' : '✕'} ${state}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  // Totali della busta: lordo (totale competenze), ritenute e netto a pagare
  function totaliHtml(busta) {
    const t = busta.totals || {}, cella = (nome, v, cls = '') => `<div class="${cls}"><dt>${nome}</dt><dd>${v === null || v === undefined ? '—' : escapeHtml(euro(v))}</dd></div>`;
    return `<dl class="vb-values vb-totali">${cella('Lordo', t.competenze)}${cella('Ritenute', t.ritenute)}${cella('Netto', t.netto, 'vb-netto')}</dl>`;
  }

  // Tolleranza scelta (0, 5 o 10%), ricordata sul dispositivo
  const TOLL_KEY = 'navisuite.verificaBusta.tolleranza';
  const tolleranza = () => { const v = Number($('vbToll')?.value); return Number.isFinite(v) ? v / 100 : 0.1; };

  // Differenze fuori dalla tolleranza scelta: mail pronta per l'ufficio personale (si apre nell'app di posta, si puo' anche copiare)
  function mailHtml(item, rows) {
    const voci = rows.filter(row => row.status !== 'ok' && !row.trascurabile); // fuori dalla tolleranza scelta
    if (!voci.length) return '';
    const mese = monthLabel(item.month).toLowerCase(), busta = item.bustaMonth ? monthLabel(item.bustaMonth).toLowerCase() : item.fileName;
    const nome = String(agent?.name || '').trim();
    const righe = voci.map(row => `- ${row.label} (voce ${row.codes.join(' + ')}): in busta ${row.busta === null ? 'assente' : unitValue(row.busta, row.unit)}, dalla mia distinta ${unitValue(row.distinta, row.unit)} (differenza ${signedUnit(row.diff, row.unit)}${row.euro ? `, circa ${euro(Math.abs(row.euro))}` : ''}).`).join('\n');
    const oggetto = `Verifica busta paga di ${busta} (dati di ${mese})${nome ? ` - ${nome}` : ''}`;
    const testo = `Buongiorno,\n\nconfrontando la busta paga di ${busta} con la mia distinta di ${mese} ho trovato queste differenze:\n\n${righe}\n\nVi chiedo cortesemente di verificare e, se necessario, di correggere nella prossima busta.\n\nGrazie,\n${nome}`;
    const href = `mailto:?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(testo)}`;
    return `<div class="vb-mail"><p><strong>${voci.length === 1 ? '1 differenza' : `${voci.length} differenze`} oltre la tolleranza del ${Math.round(tolleranza() * 100)}%</strong>: puoi segnalarle all'ufficio personale.</p><a class="vb-reload" href="${href}">✉ Prepara la mail</a> <button type="button" class="vb-reload" data-copia="${escapeHtml(`${oggetto}\n\n${testo}`)}">Copia il testo</button></div>`;
  }

  function renderFiles() {
    els.files.innerHTML = state.buste.map(item => `<li class="is-ok"><strong>${escapeHtml(item.bustaMonth ? `Busta di ${monthLabel(item.bustaMonth).toLowerCase()}` : item.fileName)}</strong> ${escapeHtml(item.fileName)}${item.month ? ` · Distinta di ${escapeHtml(monthLabel(item.month).toLowerCase())}` : ''}</li>`).join('');
    els.clear.hidden = !state.buste.length;
    els.monthField.hidden = state.buste.length > 1;
  }

  async function render() {
    const single = state.buste.length <= 1;
    if (state.buste.length === 1) state.buste[0].month = els.month.value || state.buste[0].month;
    const month = els.month.value;
    const period = window.NaviDistintaTotals.competencePeriod(month);
    els.period.textContent = !single ? 'Con più buste ognuna si confronta con la Distinta del mese precedente.' : period.startIso ? `Periodo di competenza: ${dateText(period.startIso)} – ${dateText(period.endIso)} (${period.weeks.length} settimane)` : 'Scegli il mese della Distinta.';
    els.source.textContent = sourceText(state.data);
    renderFiles();
    const data = await ensureData();
    els.source.textContent = sourceText(data);
    const alerts = [...data.warnings];
    if (!state.buste.length) { setAlerts(alerts); els.result.hidden = true; return; }
    const calculator = window.NaviDistintaTotals.create({ storage: localStorage });
    const blocks = state.buste.map(item => {
      const nome = item.bustaMonth ? `busta di ${monthLabel(item.bustaMonth).toLowerCase()}` : item.fileName;
      if (!item.busta.period && single) alerts.push({ kind: 'warn', text: `${nome}: non trovo il mese della busta, scegli tu il mese della Distinta.` });
      if (!item.busta.check.completa) alerts.push({ kind: item.busta.check.headerFound ? 'warn' : 'error', text: `${nome}: ${item.busta.check.message}` });
      const p = window.NaviDistintaTotals.competencePeriod(item.month);
      if (!p.startIso) return `<div class="vb-month"><h3>${escapeHtml(nome)}</h3><p>Mese della Distinta non trovato: carica questa busta da sola e scegli il mese.</p></div>`;
      const distinta = calculator.compute(data.entries, item.month);
      if (!distinta.entryCount) alerts.push({ kind: 'warn', text: `${nome}: nessuna giornata nella Distinta dal ${dateText(p.startIso)} al ${dateText(p.endIso)}.` });
      const result = window.NaviBustaCompare.compare(item.busta, distinta.totals, { tolleranza: tolleranza() });
      const mail = mailHtml(item, result.rows);
      const s = result.summary;
      return `<div class="vb-month"><h3>${escapeHtml(item.bustaMonth ? `Busta di ${monthLabel(item.bustaMonth).toLowerCase()}` : item.fileName)} → Distinta di ${escapeHtml(monthLabel(item.month).toLowerCase())}</h3><p>${s.ok} match · ${s.diff} mismatch · ${s.check} da verificare</p>${totaliHtml(item.busta)}${tableHtml(result.rows)}${mail}</div>`;
    });
    setAlerts(alerts);
    els.months.innerHTML = blocks.join('');
    els.result.hidden = false;
  }

  async function onFile() {
    const files = [...(els.fileInput.files || [])];
    if (!files.length) return;
    els.fileLabel.classList.add('is-busy');
    const errori = [];
    for (const file of files) {
      els.fileInfo.textContent = `Leggo ${file.name}…`;
      try {
        const busta = await window.NaviBustaParser.parsePdf(file);
        const bustaMonth = monthOf(busta);
        const item = { busta, fileName: file.name, bustaMonth, month: busta.period ? window.NaviBustaParser.previousMonth(busta.period) : els.month.value };
        // la stessa busta caricata di nuovo sostituisce quella vecchia
        const i = state.buste.findIndex(b => (bustaMonth && b.bustaMonth === bustaMonth) || b.fileName === file.name);
        if (i >= 0) state.buste[i] = item; else state.buste.push(item);
      } catch (error) {
        console.error('Verifica busta: lettura PDF non riuscita', error);
        errori.push(`${file.name} (${error.message || error})`);
      }
    }
    state.buste.sort((a, b) => String(a.bustaMonth).localeCompare(String(b.bustaMonth)));
    if (state.buste.length === 1) els.month.value = state.buste[0].month;
    els.fileInfo.textContent = errori.length ? `Non riesco a leggere: ${errori.join(', ')}.` : `${state.buste.length === 1 ? '1 busta caricata' : `${state.buste.length} buste caricate`}. I dati variabili di ogni busta si riferiscono al mese precedente.`;
    els.fileLabel.classList.remove('is-busy');
    els.fileInput.value = '';
    await render();
  }

  function init() {
    if (!agent?.id) {
      els.login.hidden = false;
      els.fileInput.disabled = true;
      els.month.disabled = true;
      document.querySelectorAll('.vb-card').forEach(card => card.classList.add('is-disabled'));
      return;
    }
    els.month.value = previousOfToday();
    els.fileInput.addEventListener('change', onFile);
    $('vbReload')?.addEventListener('click', ricarica);
    // Nascondi cifre: sfoca tutti gli importi in euro (scelta ricordata sul dispositivo)
    const BLUR_KEY = 'navisuite.verificaBusta.nascondi';
    const blur = on => { document.body.classList.toggle('vb-blur', on); const b = $('vbBlur'); if (b) { b.textContent = on ? '👁 Mostra cifre' : '🙈 Nascondi cifre'; b.setAttribute('aria-pressed', String(on)); } try { localStorage.setItem(BLUR_KEY, on ? '1' : '0'); } catch (_) {} };
    try { blur(localStorage.getItem(BLUR_KEY) === '1'); } catch (_) { blur(false); }
    $('vbBlur')?.addEventListener('click', () => blur(!document.body.classList.contains('vb-blur')));
    els.months.addEventListener('click', e => { const b = e.target.closest('[data-copia]'); if (!b) return; navigator.clipboard?.writeText(b.dataset.copia).then(() => { b.textContent = '✓ Copiato'; }).catch(() => {}); });
    try { const salvata = localStorage.getItem(TOLL_KEY); if (salvata !== null && $('vbToll')) $('vbToll').value = salvata; } catch (_) {}
    $('vbToll')?.addEventListener('change', () => { try { localStorage.setItem(TOLL_KEY, $('vbToll').value); } catch (_) {} render().catch(error => console.error(error)); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ricarica(); });
    els.clear.addEventListener('click', () => { state.buste = []; els.fileInfo.textContent = ''; render().catch(error => console.error(error)); });
    els.month.addEventListener('change', () => { render().catch(error => console.error(error)); });
    render().catch(error => console.error('Verifica busta', error));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
