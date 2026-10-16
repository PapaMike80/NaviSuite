// Pagina "Verifica busta paga": legge il PDF sul dispositivo (busta-parser.js),
// calcola i totali della Distinta (distinta-totals.js) e li confronta
// (busta-compare.js). La Diaria arriva da Firebase come in navidiaria.html.
(function () {
  const $ = id => document.getElementById(id);
  const els = {
    login: $('vbLogin'), bar: $('vbBar'), fileInput: $('vbFileInput'), fileLabel: $('vbFileLabel'), fileInfo: $('vbFileInfo'),
    source: $('vbSource'), alerts: $('vbAlerts'), vuoto: $('vbVuoto'), tabs: $('vbTabs'), confronto: $('vbConfronto'), anno: $('vbAnno'), titolo: $('vbTitolo')
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

  // buste: chiave (mese della busta, o nome del file se il mese non si legge) -> {busta, fileName, bustaMonth, month}
  const state = { buste: {}, corrente: '', tab: 'confronto', anno: '', data: null, loadingData: null, archivio: {} };

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
    // Come la Distinta: solo Firebase
    let remote = null, source = '';
    try {
      await window.NaviAdminFirebase.ready;
      remote = await window.NaviAdminFirebase.loadDiaria(id); source = 'firebase';
    } catch (error) { console.warn('Verifica busta: archivio della Distinta non raggiungibile', error); }
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
    return data.source === 'firebase' ? 'Dati: Firebase' : 'Dati: copia locale su questo dispositivo';
  }

  const STATUS = {
    diff: { label: 'Differenza', className: 'is-diff' },
    check: { label: 'Da verificare', className: 'is-check' },
    ok: { label: 'Coerente', className: 'is-ok' }
  };

  const monthOf = busta => (busta.period ? `${busta.period.year}-${String(busta.period.month).padStart(2, '0')}` : '');

  // Tolleranza scelta (0, 5 o 10%), ricordata sul dispositivo
  const TOLL_KEY = 'navisuite.verificaBusta.tolleranza';
  const tolleranza = () => { const v = Number($('vbToll')?.value); return Number.isFinite(v) ? v / 100 : 0.1; };

  // Differenze fuori dalla tolleranza scelta: mail pronta per l'ufficio personale (si apre nell'app di posta, si puo' anche copiare)
  // Giorni della Distinta che compongono una voce contestata: tabella per la mail all'ufficio.
  // Le competenze si contano nel mese di calendario; straordinari e banca ore sulle settimane del periodo.
  const hh = min => clock(min).replace(':', 'h');
  const ggmm = d => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const GIORNO = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  function dettaglioGiorni(row, item, c, calc) {
    const entries = (state.data?.entries || []).filter(Boolean);
    const lavorati = list => list.filter(e => calc.isWorking(e)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const delMese = lavorati(entries.filter(e => String(e.date).slice(0, 7) === item.month));
    const riga = (e, valore) => `${ggmm(e.date)} ${GIORNO[new Date(`${e.date}T12:00:00`).getDay()]}  ${String(e.shift || '').padEnd(6)} ${valore}`;
    const scelti = (filtro, valore = () => '1') => delMese.filter(filtro).map(e => riga(e, valore(e)));
    const holiday = e => calc.holidayValue(e, new Date(`${e.date}T12:00:00`));
    const missed = e => Number(e.missedRest ?? e.missedRestMinutes ?? e.mancatoRiposo) || 0;
    switch (row.id) {
      case 'embark': return scelti(e => e.embark);
      case 'sunday': return scelti(e => new Date(`${e.date}T12:00:00`).getDay() === 0);
      case 'cash': return scelti(e => e.cashHandling && !e.embark);
      case 'dailyDM': return scelti(e => e.cashHandling);
      case 'overnight40': return scelti(e => e.overnight40);
      case 'secondTicket': return scelti(e => e.secondMeal);
      case 'ticket': return scelti(e => calc.ticketDue(e) && !calc.ticketValue(e), () => 'ticket non usato');
      case 'allowance24': return scelti(e => [24, 50].includes(Number(e.allowanceRate)) || e.travel === true, e => Number(e.allowanceRate) === 50 || e.travel === true ? 'trasferta 50%' : 'diaria 24%');
      case 'cashEmbark': return scelti(e => e.cashHandling && e.embark, e => `turno ${hh(calc.serviceMinutes(e))} · lavorate ${hh(calc.workedMinutes(e))}`);
      case 'holiday': return scelti(e => holiday(e) || missed(e), e => [holiday(e) ? `festività ${hh(calc.workedMinutes(e))}` : '', missed(e) ? `mancato riposo ${hh(missed(e))}` : ''].filter(Boolean).join(' + '));
      case 'bank': return lavorati(entries.filter(e => e.date >= c.p.startIso && e.date <= c.p.endIso && Number(e.bank))).map(e => riga(e, hh(Number(e.bank))));
      case 'overtime': {
        const righe = (c.distinta.period.weeks || []).map(w => `sett. ${ggmm(w.startIso)}–${ggmm(w.endIso)}  lavorate ${hh(w.workedMinutes)}  straord. ${hh(w.overtimeMinutes)}`);
        if (c.distinta.totals.overtimeTailMinutes) righe.push(`giorni dopo il ${ggmm(c.p.endIso)}  straord. ${hh(c.distinta.totals.overtimeTailMinutes)}`);
        return righe;
      }
      default: return [];
    }
  }

  function mailTesto(item, c, calc) {
    const voci = c.result.rows.filter(row => row.status !== 'ok' && !row.trascurabile); // fuori dalla tolleranza scelta
    if (!voci.length) return null;
    const mese = monthLabel(item.month).toLowerCase(), busta = item.bustaMonth ? monthLabel(item.bustaMonth).toLowerCase() : item.fileName;
    const nome = String(agent?.name || '').trim();
    const blocchi = voci.map((row, i) => {
      const giorni = dettaglioGiorni(row, item, c, calc);
      return [
        `${i + 1}. ${row.label} (voce ${row.codes.join(' + ')})`,
        `   In busta: ${row.busta === null ? 'assente' : unitValue(row.busta, row.unit)}${row.importo ? ` (${euro(row.importo)})` : ''}`,
        `   Dalla mia distinta: ${unitValue(row.distinta, row.unit)} — ${row.distintaLabel || row.label}`,
        `   Differenza: ${signedUnit(row.diff, row.unit)}${row.euro ? `, circa ${euro(Math.abs(row.euro))}` : ''}${row.status === 'check' ? ' (da verificare)' : ''}`,
        ...(giorni.length ? ['   Dettaglio dalla distinta:', ...giorni.map(g => `     ${g}`)] : [])
      ].join('\n');
    }).join('\n\n');
    const oggetto = `Verifica busta paga di ${busta} (dati di ${mese})${nome ? ` - ${nome}` : ''}`;
    const testo = `Buongiorno,\n\nsono ${nome || 'l\'agente'}${agent?.id ? ` (matricola ${agent.id})` : ''}. Confrontando la busta paga di ${busta} con la mia distinta di ${mese} (periodo ${dateText(c.p.startIso)} – ${dateText(c.p.endIso)}) ho trovato ${voci.length === 1 ? 'questa differenza' : 'queste differenze'}:\n\n${blocchi}\n\nVi chiedo cortesemente di verificare e, se necessario, di correggere nella prossima busta.\n\nGrazie,\n${nome}`;
    return { oggetto, testo, n: voci.length };
  }
  function mailHtml(item, c, calc) {
    const m = mailTesto(item, c, calc);
    if (!m) return '';
    const href = `mailto:?subject=${encodeURIComponent(m.oggetto)}&body=${encodeURIComponent(m.testo)}`;
    return `<div class="mail"><div class="mail-head"><span><b>${m.n === 1 ? '1 differenza' : `${m.n} differenze`}</b> oltre il ${Math.round(tolleranza() * 100)}%: testo per l'ufficio personale</span><span><a class="chip" href="${href}">✉ Apri mail</a> <button type="button" class="chip" data-copia="${escapeHtml(`${m.oggetto}\n\n${m.testo}`)}">Copia</button></span></div><p class="mail-ogg"><b>Oggetto:</b> ${escapeHtml(m.oggetto)}</p><pre class="mail-testo">${escapeHtml(m.testo)}</pre></div>`;
  }

  // ---------------- Archivio delle buste: solo i dati letti (mese, totali, voci), mai il PDF ----------------
  const ARCH_KEY = () => `navisuite.bustePaga.${agent?.id}`;
  const archivioLocale = () => { try { return JSON.parse(localStorage.getItem(ARCH_KEY()) || '{}') || {}; } catch (_) { return {}; } };
  const scriviLocale = () => { try { localStorage.setItem(ARCH_KEY(), JSON.stringify(state.archivio)); } catch (_) {} };
  // Dove sono salvate le buste: solo per gli admin
  const statoAnno = t => { const el = $('vbAnnoStato'); if (el) el.textContent = window.NaviRoles?.isAdminAgent?.(agent) ? t : ''; };
  function datiBusta(item) {
    const b = item.busta;
    return {
      bustaMonth: item.bustaMonth, month: item.month, fileName: item.fileName, period: b.period || null,
      totals: b.totals || {}, check: b.check || {},
      voci: (b.voci || []).map(v => ({ flag: v.flag ?? null, code: v.code, description: v.description, quantity: v.quantity, base: v.base, figurative: v.figurative, amount: v.amount })),
      savedAt: new Date().toISOString()
    };
  }
  async function salvaBusta(item) {
    if (!item.bustaMonth) return;
    const dati = datiBusta(item);
    state.archivio[item.bustaMonth] = dati; scriviLocale();
    // Firebase (archivio unico) e copia sul telefono
    try { await window.NaviAdminFirebase.saveBustaPaga(agent.id, item.bustaMonth, dati); statoAnno('Buste salvate: Firebase ✓ · telefono ✓'); }
    catch (error) { console.warn('Busta non salvata su Firebase', error); statoAnno('Busta salvata solo sul telefono (Firebase non raggiungibile): verrà copiata alla prossima apertura.'); }
  }
  async function togliBusta(mese) {
    if (!confirm(`Togliere dal riepilogo la busta di ${monthLabel(mese).toLowerCase()}?`)) return;
    delete state.archivio[mese]; delete state.buste[mese]; scriviLocale(); ridisegna();
    try { await window.NaviAdminFirebase?.saveBustaPaga?.(agent.id, mese, null); } catch (error) { console.warn(error); }
  }
  async function caricaArchivio() {
    state.archivio = archivioLocale(); dallArchivio(); ridisegna();
    // Firebase: vince la busta salvata piu' di recente; quelle rimaste solo sul telefono vengono copiate
    try {
      const remoto = (await window.NaviAdminFirebase.ready, await window.NaviAdminFirebase.getBustePaga(agent.id)) || {};
      const unione = { ...state.archivio };
      Object.entries(remoto).forEach(([m, d]) => { if (!unione[m] || String(d?.savedAt || '') > String(unione[m]?.savedAt || '')) unione[m] = d; });
      Object.entries(unione).forEach(([m, d]) => { if (String(remoto[m]?.savedAt || '') !== String(d?.savedAt || '')) window.NaviAdminFirebase.saveBustaPaga(agent.id, m, d).catch(e => console.warn(`Busta ${m} non copiata su Firebase`, e)); });
      state.archivio = unione; scriviLocale(); dallArchivio(); ridisegna(); statoAnno('Buste: Firebase ✓');
    } catch (error) { console.warn('Archivio buste non letto da Firebase', error); statoAnno('Riepilogo dalla copia su questo telefono (Firebase non raggiungibile)'); }
  }
  const chiave = item => item.bustaMonth || `file:${item.fileName}`;
  const itemDaArchivio = (mese, d) => ({ busta: { period: d.period, voci: d.voci || [], totals: d.totals || {}, check: { completa: true, headerFound: true, message: '', ...(d.check || {}) } }, fileName: d.fileName || `busta ${mese}`, bustaMonth: mese, month: d.month || (d.period ? window.NaviBustaParser.previousMonth(d.period) : '') });
  function dallArchivio() {
    Object.entries(state.archivio).forEach(([m, d]) => { if (/^\d{4}-\d{2}$/.test(m) && !state.buste[m]) state.buste[m] = itemDaArchivio(m, d); });
    Object.keys(state.buste).forEach(k => { if (/^\d{4}-\d{2}$/.test(k) && !state.archivio[k]) delete state.buste[k]; });
  }
  const chiaviOrdinate = () => Object.keys(state.buste).sort((a, b) => String(state.buste[a].bustaMonth || '9999').localeCompare(String(state.buste[b].bustaMonth || '9999')));
  const nomeBusta = item => item.bustaMonth ? monthLabel(item.bustaMonth) : item.fileName;
  const meseCorto = m => new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1, 12)).replace('.', '');
  const eurv = v => v === null || v === undefined || v === '' ? '—' : `<span class="eurv">${escapeHtml(euro(v))}</span>`;
  const COLORE = { ok: 'var(--green)', diff: 'var(--rose)', check: 'var(--amber)' };

  // Confronto di una busta con la Distinta del mese prima (null se il mese manca)
  function confronta(item, data, calculator) {
    const p = window.NaviDistintaTotals.competencePeriod(item.month);
    if (!p.startIso) return null;
    const distinta = calculator.compute(data.entries, item.month);
    return { p, distinta, result: window.NaviBustaCompare.compare(item.busta, distinta.totals, { tolleranza: tolleranza() }) };
  }
  const statoMese = c => !c ? 'check' : c.result.rows.some(r => r.status === 'diff' && !r.trascurabile) ? 'diff' : c.result.rows.some(r => r.status !== 'ok' && !r.trascurabile) ? 'check' : 'ok';

  // Totali: netto in primo piano, lordo e ritenute piccoli a destra
  function tilesHtml(t) {
    return `<div class="tot num"><div><small>Netto</small><span class="tot-n">${eurv(t.netto)}</span></div><div class="tot-side">lordo <b>${eurv(t.competenze)}</b><br>ritenute <b>${t.ritenute === null || t.ritenute === undefined ? '—' : `<span class="eurv">−${escapeHtml(euro(Math.abs(t.ritenute)))}</span>`}</b></div></div>`;
  }

  function voceHtml(row) {
    const c = COLORE[row.status];
    const pill = row.status === 'ok' ? '✓' : row.status === 'check' ? 'Verifica' : `${signedUnit(row.diff, row.unit)}${row.euro ? ` · <span class="eurv">${escapeHtml(euro(Math.abs(row.euro)))}</span>` : ''}`;
    const riga = row.status === 'ok' ? unitValue(row.busta ?? row.distinta, row.unit) : `distinta ${unitValue(row.distinta, row.unit)} · busta ${row.busta === null ? 'assente' : unitValue(row.busta, row.unit)}`;
    const nota = row.notes?.length ? `<p>${escapeHtml(row.notes[row.notes.length - 1]).replace(/\n/g, '<br>')}</p>` : '';
    return `<button type="button" class="voce" style="--c:${c}" aria-expanded="false"><span class="n">${escapeHtml(row.label)}${row.importo ? ` <span class="eur num eurv">${escapeHtml(euro(row.importo))}</span>` : ''}</span><span class="pill num">${pill}</span><span class="c num">${riga}</span>`
      + `<span class="det num"><span><small>Distinta</small>${unitValue(row.distinta, row.unit)}</span><span><small>Busta</small>${row.busta === null ? 'assente' : unitValue(row.busta, row.unit)}</span><span><small>Importo busta</small>${eurv(row.importo)}</span><span><small>${row.status === 'ok' ? 'Distinta in euro' : 'Differenza circa'}</small>${row.status === 'ok' ? eurv(row.importoDistinta) : row.euro ? eurv(Math.abs(row.euro)) : '—'}</span><span><small>Voci in busta</small>${escapeHtml(row.codes.join(' + '))}</span>${nota}</span></button>`;
  }

  function renderConfronto(data, calculator, alerts) {
    const chiavi = chiaviOrdinate();
    if (!chiavi.includes(state.corrente)) state.corrente = chiavi[chiavi.length - 1] || '';
    const item = state.buste[state.corrente];
    if (!item) { els.confronto.innerHTML = ''; return; }
    const pills = chiavi.map(k => { const it = state.buste[k]; const c = confronta(it, data, calculator); return `<button type="button" class="chip${k === state.corrente ? ' on' : ''}" data-mese="${escapeHtml(k)}"><i class="dot" style="--c:${COLORE[statoMese(c)]}"></i>${escapeHtml(it.bustaMonth ? `${meseCorto(it.bustaMonth)} ${it.bustaMonth.slice(2, 4)}` : it.fileName)}</button>`; }).join('');
    const nome = nomeBusta(item);
    if (!item.busta.check.completa) alerts.push({ kind: item.busta.check.headerFound ? 'warn' : 'error', text: `${nome}: ${item.busta.check.message}` });
    const c = confronta(item, data, calculator);
    let corpo;
    if (!c) corpo = '<p class="msub">Non trovo il mese di questa busta: non posso confrontarla con la Distinta.</p>';
    else {
      if (!c.distinta.entryCount) alerts.push({ kind: 'warn', text: `Nessuna giornata nella Distinta dal ${dateText(c.p.startIso)} al ${dateText(c.p.endIso)}.` });
      // Ordine per valore economico: prima le voci che pesano di piu' in euro
      const valore = row => Math.abs(Number(row.importo) || Number(row.importoDistinta) || Number(row.euro) || 0);
      // Prima le differenze, poi le voci da verificare, poi quelle ok; in ogni gruppo per valore in euro
      const ordine = { diff: 0, check: 1, ok: 2 };
      const rows = c.result.rows.slice().sort((a, b) => ordine[a.status] - ordine[b.status] || valore(b) - valore(a));
      const brutte = rows.filter(r => r.status !== 'ok'), buone = rows.filter(r => r.status === 'ok');
      const s = c.result.summary;
      corpo = `<div class="sum"><span style="--c:var(--green)">${s.ok} ok</span><span style="--c:var(--rose)">${s.diff} diff.</span><span style="--c:var(--amber)">${s.check} verifica</span></div>`
        + (rows.length ? '' : '<p class="msub">Nessuna delle voci confrontabili compare nella busta o nella Distinta di questo mese.</p>')
        + `<div class="voci">${!brutte.length && buone.length ? '<div class="ok-all">✓ Tutte le voci tornano con la Distinta</div>' : ''}${rows.map(voceHtml).join('')}</div>`
        + mailHtml(item, c, calculator);
    }
    els.titolo.textContent = nome;
    els.confronto.innerHTML = `<div class="sel">${pills}</div><div><p class="msub">Busta di ${escapeHtml(nome.toLowerCase())}${c ? ` → Distinta di ${escapeHtml(monthLabel(item.month).toLowerCase())} (${dateText(c.p.startIso)} – ${dateText(c.p.endIso)})` : ''}</p></div>${tilesHtml(item.busta.totals || {})}${corpo}`;
  }

  function renderAnno(data, calculator) {
    const mesi = Object.keys(state.archivio).filter(m => /^\d{4}-\d{2}$/.test(m)).sort();
    if (!mesi.length) { els.anno.innerHTML = '<p class="msub">Nessuna busta salvata.</p>'; return; }
    const anni = [...new Set(mesi.map(m => m.slice(0, 4)))].sort().reverse();
    if (!anni.includes(state.anno)) state.anno = anni[0];
    const delAnno = mesi.filter(m => m.startsWith(state.anno));
    const tot = { competenze: 0, ritenute: 0, netto: 0 };
    delAnno.forEach(m => { const t = state.archivio[m].totals || {}; Object.keys(tot).forEach(k => { tot[k] += Number(t[k]) || 0; }); });
    const stato = m => data && calculator && state.buste[m] ? statoMese(confronta(state.buste[m], data, calculator)) : 'ok';
    const max = Math.max(1, ...delAnno.map(m => Number(state.archivio[m].totals?.netto) || 0));
    // Quota degli straordinari (voci 334 e 01Y) dentro la colonna del netto
    const STRAORD = ['334', '01Y'];
    const straord = m => (state.archivio[m]?.voci || []).filter(v => STRAORD.includes(v.code)).reduce((t, v) => t + (Number(v.amount) || 0), 0);
    const totStraord = delAnno.reduce((t, m) => t + straord(m), 0);
    const barre = Array.from({ length: 12 }, (_, i) => {
      const m = `${state.anno}-${String(i + 1).padStart(2, '0')}`, n = Number(state.archivio[m]?.totals?.netto) || 0, o = straord(m);
      const quota = n ? Math.min(100, Math.round(o / n * 100)) : 0;
      return `<div title="${escapeHtml(monthLabel(m))}${o ? ` · straordinari ${escapeHtml(euro(o))}` : ''}"><i class="${!state.archivio[m] ? 'v' : stato(m) === 'diff' ? 'r' : ''}" style="height:${state.archivio[m] ? Math.max(3, Math.round(n / max * 64)) : 2}px">${quota ? `<b style="height:${quota}%"></b>` : ''}</i><span>${meseCorto(m).slice(0, 1).toUpperCase()}</span></div>`;
    }).join('');
    const lista = delAnno.slice().reverse().map(m => `<div class="yr"><i class="dot" style="--c:${COLORE[stato(m)]}"></i><button type="button" class="mm" data-apri="${m}">${escapeHtml(monthLabel(m).split(' ')[0])}</button><span class="num">${eurv(state.archivio[m].totals?.netto)}</span><button type="button" class="x" data-togli="${m}" aria-label="Togli la busta di ${escapeHtml(monthLabel(m).toLowerCase())}">✕</button></div>`).join('');
    const voci = new Map();
    delAnno.forEach(m => (state.archivio[m].voci || []).forEach(v => {
      if (!v.code) return;
      const x = voci.get(v.code) || { code: v.code, description: v.description, quantity: 0, amount: 0, mesi: 0 };
      x.quantity += Number(v.quantity) || 0; x.amount += Number(v.amount) || 0; x.mesi += 1; voci.set(v.code, x);
    }));
    const righeVoci = [...voci.values()].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).map(v => `<tr><td>${escapeHtml(v.code)}<small>${escapeHtml(v.description || '')}</small></td><td class="num">${v.quantity ? number(v.quantity, 2) : '—'}</td><td class="num">${eurv(v.amount)}</td><td class="num">${v.mesi}</td></tr>`).join('');
    els.titolo.textContent = `Anno ${state.anno}`;
    els.anno.innerHTML = `<div class="sel">${anni.map(a => `<button type="button" class="chip${a === state.anno ? ' on' : ''}" data-anno="${a}">${a}</button>`).join('')}</div>`
      + `<p class="msub">${delAnno.length} ${delAnno.length === 1 ? 'busta' : 'buste'} · netto mese per mese (rosso: differenze con la Distinta)</p>`
      + `<div class="spark" aria-hidden="true">${barre}</div><p class="legenda"><i class="q q-n"></i>netto <i class="q q-s"></i>di cui straordinari${totStraord ? ` · <b class="num">${eurv(totStraord)}</b> nell'anno (${Math.round(totStraord / (tot.netto || 1) * 100)}% del netto)` : ''}</p>${tilesHtml(tot)}<div class="ylist">${lista}</div>`
      + (righeVoci ? `<details class="altre"><summary>Totali per voce nel ${state.anno} ▾</summary><div class="vwrap"><table class="vtab"><thead><tr><th>Voce</th><th>Quantità</th><th>Importo</th><th>Mesi</th></tr></thead><tbody>${righeVoci}</tbody></table></div></details>` : '');
  }

  async function render() {
    const vuoto = !Object.keys(state.buste).length;
    els.bar.hidden = false;
    els.vuoto.hidden = !vuoto;
    els.tabs.hidden = vuoto;
    $('vbTabConfronto').setAttribute('aria-selected', String(state.tab === 'confronto'));
    $('vbTabAnno').setAttribute('aria-selected', String(state.tab === 'anno'));
    els.confronto.hidden = vuoto || state.tab !== 'confronto';
    els.anno.hidden = vuoto || state.tab !== 'anno';
    if (vuoto) { els.titolo.textContent = 'Buste paga'; }
    els.source.textContent = sourceText(state.data);
    const data = await ensureData();
    els.source.textContent = sourceText(data);
    const alerts = [...data.warnings];
    const calculator = window.NaviDistintaTotals.create({ storage: localStorage });
    if (!vuoto) { if (state.tab === 'anno') renderAnno(data, calculator); else renderConfronto(data, calculator, alerts); }
    setAlerts(alerts);
  }
  const ridisegna = () => render().catch(error => console.error('Verifica busta', error));

  async function onFile() {
    const files = [...(els.fileInput.files || [])];
    if (!files.length) return;
    els.fileLabel.classList.add('is-busy');
    const errori = [];
    let ultima = '';
    for (const file of files) {
      els.fileInfo.textContent = `Leggo ${file.name}…`;
      try {
        const busta = await window.NaviBustaParser.parsePdf(file);
        const bustaMonth = monthOf(busta);
        const item = { busta, fileName: file.name, bustaMonth, month: busta.period ? window.NaviBustaParser.previousMonth(busta.period) : previousOfToday() };
        state.buste[chiave(item)] = item; ultima = chiave(item);
        await salvaBusta(item);
      } catch (error) {
        console.error('Verifica busta: lettura PDF non riuscita', error);
        errori.push(`${file.name} (${error.message || error})`);
      }
    }
    if (ultima) { state.corrente = ultima; state.tab = 'confronto'; }
    els.fileInfo.textContent = errori.length ? `Non riesco a leggere: ${errori.join(', ')}.` : '';
    els.fileLabel.classList.remove('is-busy');
    els.fileInput.value = '';
    await render();
  }

  function init() {
    if (!agent?.id) { els.login.hidden = false; els.fileInput.disabled = true; return; }
    els.fileInput.addEventListener('change', onFile);
    $('vbReload')?.addEventListener('click', ricarica);
    // Nascondi cifre: sfoca tutti gli importi in euro (scelta ricordata sul dispositivo)
    const BLUR_KEY = 'navisuite.verificaBusta.nascondi';
    const blur = on => { document.body.classList.toggle('vb-blur', on); const b = $('vbBlur'); if (b) { b.textContent = on ? '👁' : '🙈'; b.title = on ? 'Mostra cifre' : 'Nascondi cifre'; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); } try { localStorage.setItem(BLUR_KEY, on ? '1' : '0'); } catch (_) {} };
    try { blur(localStorage.getItem(BLUR_KEY) === '1'); } catch (_) { blur(false); }
    $('vbBlur')?.addEventListener('click', () => blur(!document.body.classList.contains('vb-blur')));
    try { const salvata = localStorage.getItem(TOLL_KEY); if (salvata !== null && $('vbToll')) $('vbToll').value = salvata; } catch (_) {}
    $('vbToll')?.addEventListener('change', () => { try { localStorage.setItem(TOLL_KEY, $('vbToll').value); } catch (_) {} ridisegna(); });
    $('vbTabConfronto').addEventListener('click', () => { state.tab = 'confronto'; ridisegna(); });
    $('vbTabAnno').addEventListener('click', () => { state.tab = 'anno'; ridisegna(); });
    els.confronto.addEventListener('click', e => {
      const copia = e.target.closest('[data-copia]'); if (copia) { navigator.clipboard?.writeText(copia.dataset.copia).then(() => { copia.textContent = '✓ Copiato'; }).catch(() => {}); return; }
      const mese = e.target.closest('[data-mese]'); if (mese) { state.corrente = mese.dataset.mese; ridisegna(); return; }
      const voce = e.target.closest('.voce'); if (voce) voce.setAttribute('aria-expanded', String(voce.getAttribute('aria-expanded') !== 'true'));
    });
    els.anno.addEventListener('click', e => {
      const a = e.target.closest('[data-apri]'), t = e.target.closest('[data-togli]'), y = e.target.closest('[data-anno]');
      if (a) { state.corrente = a.dataset.apri; state.tab = 'confronto'; ridisegna(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      if (t) togliBusta(t.dataset.togli);
      if (y) { state.anno = y.dataset.anno; ridisegna(); }
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ricarica(); });
    caricaArchivio();
    ridisegna();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
