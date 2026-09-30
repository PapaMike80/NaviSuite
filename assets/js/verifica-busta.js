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
    chips: $('vbChips'),
    rows: $('vbRows'),
    weeks: $('vbWeeks'),
    notCompared: $('vbNotCompared'),
    notComparedCount: $('vbNotComparedCount'),
    checks: $('vbChecks')
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

  const state = { busta: null, fileName: '', data: null, loadingData: null };

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
    try {
      if (!window.NaviAdminFirebase?.loadDiaria) throw new Error('Modulo Firebase non disponibile');
      await window.NaviAdminFirebase.ready;
      const remote = await window.NaviAdminFirebase.loadDiaria(id);
      if (!remote.entries.length && local.length) {
        warnings.push({ kind: 'warn', text: 'Su Firebase non ci sono giornate salvate: uso la copia su questo dispositivo.' });
        return { entries: local, source: 'local', updatedAt: '', warnings };
      }
      return { entries: remote.entries, source: 'firebase', updatedAt: remote.updatedAt, warnings };
    } catch (error) {
      console.warn('Verifica busta: Firebase non raggiungibile', error);
      warnings.push({ kind: 'error', text: `Firebase non raggiungibile: uso la copia su questo dispositivo${local.length ? ', che potrebbe non essere aggiornata' : ', ma è vuota'}.` });
      return { entries: local, source: 'local', updatedAt: '', warnings };
    }
  }

  function ensureData() {
    if (!state.loadingData) state.loadingData = loadEntries().then(data => { state.data = data; return data; });
    return state.loadingData;
  }

  function sourceText(data) {
    if (!data) return 'Carico la Distinta…';
    if (data.source === 'firebase') {
      const when = data.updatedAt ? new Date(data.updatedAt) : null;
      return `Dati: Firebase${when && !Number.isNaN(when.getTime()) ? ` · aggiornati il ${new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(when)}` : ''}`;
    }
    return 'Dati: copia locale su questo dispositivo';
  }

  const STATUS = {
    diff: { label: 'Differenza', className: 'is-diff' },
    check: { label: 'Da verificare', className: 'is-check' },
    ok: { label: 'Coerente', className: 'is-ok' }
  };

  function renderRows(rows) {
    if (!rows.length) {
      els.rows.innerHTML = '<p class="vb-empty">Nessuna delle voci confrontabili compare nella busta o nella Distinta di questo mese.</p>';
      return;
    }
    els.rows.innerHTML = rows.map(row => {
      const status = STATUS[row.status];
      return `<article class="vb-row ${status.className}">
        <div class="vb-row-head"><div><h3>${escapeHtml(row.label)}</h3><p>Voce ${escapeHtml(row.codes.join(' + '))} · ${escapeHtml(row.distintaLabel)}</p></div><span class="vb-badge">${status.label}</span></div>
        <dl class="vb-values">
          <div><dt>Busta</dt><dd>${row.busta === null ? 'assente' : unitValue(row.busta, row.unit)}</dd></div>
          <div><dt>Distinta</dt><dd>${unitValue(row.distinta, row.unit)}</dd></div>
          <div><dt>Differenza</dt><dd>${signedUnit(row.diff, row.unit)}</dd></div>
        </dl>
        ${row.euroText ? `<p class="vb-euro">${escapeHtml(row.euroText)}${row.base ? ` <small>(${escapeHtml(signedUnit(row.diff, row.unit))} × ${escapeHtml(euro(row.base))})</small>` : ''}</p>` : ''}
        ${row.notes.length ? `<p class="vb-note">${row.notes.map(escapeHtml).join(' ')}</p>` : ''}
      </article>`;
    }).join('');
  }

  function renderWeeks(distinta) {
    const weeks = distinta.period.weeks;
    const totalWorked = weeks.reduce((sum, week) => sum + week.workedMinutes, 0);
    const totalOvertime = weeks.reduce((sum, week) => sum + week.overtimeMinutes, 0);
    els.weeks.innerHTML = `<table class="vb-table"><thead><tr><th>Settimana</th><th>Giorni</th><th>Ore lavorate</th><th>Straord. (oltre 39h)</th></tr></thead><tbody>${weeks.map(week => `<tr><td>${dateText(week.startIso)} – ${dateText(week.endIso)}</td><td>${week.workedDays}${week.cash139Days ? ` <small>(${week.cash139Days} con maneggio)</small>` : ''}</td><td>${clock(week.workedMinutes)}</td><td>${week.overtimeMinutes ? clock(week.overtimeMinutes) : '—'}</td></tr>`).join('')}</tbody><tfoot><tr><th>Totale</th><th>${distinta.totals.workedDays}</th><th>${clock(totalWorked)}</th><th>${clock(totalOvertime)} (${number(totalOvertime / 60, 2)} h)</th></tr></tfoot></table>`;
  }

  function renderNotCompared(list) {
    els.notComparedCount.textContent = String(list.length);
    els.notCompared.innerHTML = list.length
      ? `<ul class="vb-list">${list.map(voce => `<li><strong>${escapeHtml(voce.code)}</strong> ${escapeHtml(voce.description || voce.label)}${voce.quantity !== null ? ` · ${number(voce.quantity, 2)}` : ''}${voce.amount !== null ? ` · ${escapeHtml(euro(voce.amount))}` : ''}<small>${escapeHtml(voce.reason)}</small></li>`).join('')}</ul>`
      : '<p class="vb-empty">Nessuna voce di questo tipo nella busta.</p>';
  }

  function renderChecks(busta, coherence) {
    const check = busta.check;
    const totalsLine = (label, sum, printed, ok) => `<li class="${printed === null ? 'is-check' : ok ? 'is-ok' : 'is-diff'}"><strong>${label}</strong> somma voci ${escapeHtml(euro(sum))} · stampato ${printed === null ? 'non trovato' : escapeHtml(euro(printed))}</li>`;
    const wrong = coherence.filter(item => !item.ok);
    els.checks.innerHTML = `<ul class="vb-list">
        ${totalsLine('Competenze', check.sumCompetenze, busta.totals.competenze, check.competenzeOk)}
        ${totalsLine('Ritenute', check.sumRitenute, busta.totals.ritenute, check.ritenuteOk)}
        <li class="is-ok"><strong>Netto a pagare</strong> ${busta.totals.netto === null ? 'non trovato' : escapeHtml(euro(busta.totals.netto))}</li>
        <li class="${wrong.length ? 'is-diff' : 'is-ok'}"><strong>Quantità × dato base = importo</strong> ${coherence.length - wrong.length} voci su ${coherence.length} coerenti (esclusi contributi, imposte, INAIL e IRPEF)</li>
      </ul>
      ${wrong.length ? `<ul class="vb-list">${wrong.map(item => `<li class="is-diff"><strong>${escapeHtml(item.code)}</strong> ${escapeHtml(item.description)} · ${number(item.quantity, 2)} × ${escapeHtml(euro(item.base))} = ${escapeHtml(euro(item.expected))}, in busta ${escapeHtml(euro(Math.abs(item.amount)))}</li>`).join('')}</ul>` : ''}
      <p class="vb-muted">Voci lette dalla busta: ${busta.voci.length}.</p>`;
  }

  function renderChips(summary) {
    const chip = (className, count, label) => `<span class="vb-chip ${className}"><strong>${count}</strong> ${label}</span>`;
    els.chips.innerHTML = [
      chip('is-ok', summary.ok, summary.ok === 1 ? 'coerente' : 'coerenti'),
      chip('is-diff', summary.diff, summary.diff === 1 ? 'differenza' : 'differenze'),
      chip('is-check', summary.check, 'da verificare'),
      chip('is-muted', summary.notCompared, summary.notCompared === 1 ? 'non confrontata' : 'non confrontate')
    ].join('');
  }

  async function render() {
    const month = els.month.value;
    const period = window.NaviDistintaTotals.competencePeriod(month);
    els.period.textContent = period.startIso ? `Periodo di competenza: ${dateText(period.startIso)} – ${dateText(period.endIso)} (${period.weeks.length} settimane)` : 'Scegli il mese della Distinta.';
    els.source.textContent = sourceText(state.data);
    const data = await ensureData();
    els.source.textContent = sourceText(data);
    const alerts = [...data.warnings];
    if (!state.busta) { setAlerts(alerts); els.result.hidden = true; return; }
    const busta = state.busta;
    if (!busta.period) alerts.push({ kind: 'warn', text: 'Non trovo il mese della busta: scegli tu il mese della Distinta da confrontare.' });
    if (!busta.check.completa) alerts.push({ kind: busta.check.headerFound ? 'warn' : 'error', text: busta.check.message });
    if (!period.startIso) { setAlerts(alerts); els.result.hidden = true; return; }
    const calculator = window.NaviDistintaTotals.create({ storage: localStorage });
    const distinta = calculator.compute(data.entries, month);
    if (!distinta.entryCount) alerts.push({ kind: 'warn', text: `Nessuna giornata nella Distinta dal ${dateText(period.startIso)} al ${dateText(period.endIso)}: controlla il mese scelto.` });
    setAlerts(alerts);
    const result = window.NaviBustaCompare.compare(busta, distinta.totals);
    renderChips(result.summary);
    renderRows(result.rows);
    renderWeeks(distinta);
    renderNotCompared(result.notCompared);
    renderChecks(busta, result.coherence);
    els.result.hidden = false;
  }

  async function onFile() {
    const file = els.fileInput.files?.[0];
    if (!file) return;
    state.busta = null;
    state.fileName = file.name;
    els.result.hidden = true;
    els.fileInfo.textContent = `Leggo ${file.name}…`;
    els.fileLabel.classList.add('is-busy');
    try {
      const busta = await window.NaviBustaParser.parsePdf(file);
      state.busta = busta;
      const bustaMonth = busta.period ? monthLabel(`${busta.period.year}-${String(busta.period.month).padStart(2, '0')}`) : '';
      const distintaMonth = busta.period ? window.NaviBustaParser.previousMonth(busta.period) : '';
      if (distintaMonth) els.month.value = distintaMonth;
      els.fileInfo.textContent = bustaMonth
        ? `${file.name} · busta di ${bustaMonth} (${busta.period.label}): i dati variabili si riferiscono al mese di ${monthLabel(distintaMonth).toLowerCase()}.`
        : `${file.name} · ${busta.voci.length} voci lette.`;
    } catch (error) {
      console.error('Verifica busta: lettura PDF non riuscita', error);
      els.fileInfo.textContent = `Non riesco a leggere il PDF (${error.message || error}).`;
    } finally {
      els.fileLabel.classList.remove('is-busy');
      els.fileInput.value = '';
    }
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
    els.month.addEventListener('change', () => { render().catch(error => console.error(error)); });
    render().catch(error => console.error('Verifica busta', error));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
