// Pagina "Verifica busta paga": legge il PDF sul dispositivo (busta-parser.js),
// calcola i totali della Distinta (distinta-totals.js) e li confronta
// (busta-compare.js). La Diaria arriva da Firebase come in navidiaria.html.
(function () {
  const $ = id => document.getElementById(id);
  const els = {
    login: $('vbLogin'), fileInput: $('vbFileInput'),
    alerts: $('vbAlerts'), intestazione: $('vbIntestazione'), tabs: $('vbTabs'), meseNav: $('vbMeseNav'), confronto: $('vbConfronto'), anno: $('vbAnno'), buste: $('vbBuste'), titolo: $('vbTitolo')
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const number = (value, decimals = 2) => Number(value).toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const euro = value => `${number(value, 2)} €`;
  const clock = minutes => { const m = Math.round(Math.abs(Number(minutes) || 0)); return `${minutes < 0 ? '-' : ''}${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
  const dateText = isoValue => { const [y, m, d] = String(isoValue || '').split('-'); return y ? `${d}/${m}/${y}` : ''; };
  const isMensilitaExtra = value => /^\d{4}-1[34]$/.test(String(value || ''));
  const ordineMese = value => {
    const s = String(value || '9999');
    if (s.endsWith('-14')) return `${s.slice(0, 4)}-07-14`;
    if (s.endsWith('-13')) return `${s.slice(0, 4)}-12-13`;
    return s;
  };
  const monthLabel = value => {
    const match = /^(\d{4})-(\d{2})$/.exec(value || '');
    if (!match) return '';
    if (match[2] === '13') return `13ª mensilità ${match[1]}`;
    if (match[2] === '14') return `14ª mensilità ${match[1]}`;
    const text = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(Number(match[1]), Number(match[2]) - 1, 1, 12));
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
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
  const tolleranza = () => 0;

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
      case 'rendimento': return scelti(e => !e.embark);
      case 'sunday': return scelti(e => new Date(`${e.date}T12:00:00`).getDay() === 0, e => e.embark ? '1 (47X)' : '1 (48X non turno)');
      case 'cash': return scelti(e => e.cashHandling && !e.embark);
      case 'dailyDM': return scelti(e => new Date(`${e.date}T12:00:00`).getDay() !== 0);
      case 'overnight40': return scelti(e => e.overnight40);
      case 'secondTicket': return scelti(e => e.secondMeal);
      case 'ticket': return scelti(e => calc.ticketDue(e) && !calc.ticketValue(e), () => 'ticket non usato');
      case 'allowance24': return scelti(e => [24, 50].includes(Number(e.allowanceRate)) || e.travel === true, e => Number(e.allowanceRate) === 50 || e.travel === true ? 'trasferta 50%' : 'diaria 24%');
      case 'cashEmbark': return scelti(e => e.cashHandling && e.embark, e => `turno ${hh(calc.serviceMinutes(e))} · lavorate ${hh(calc.workedMinutes(e))}`);
      case 'cashGround138': return scelti(e => /^AG[BTM]\d*$/i.test(String(e.shift || '').trim()), e => `turno ${hh(calc.serviceMinutes(e))} · lavorate ${hh(calc.workedMinutes(e))}`);
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
        `   In busta: ${row.busta === null ? 'assente' : unitValue(row.busta, row.unit)}`,
        `   Dalla mia distinta: ${unitValue(row.distinta, row.unit)} — ${row.distintaLabel || row.label}`,
        `   Differenza: ${signedUnit(row.diff, row.unit)}${row.status === 'check' ? ' (da verificare)' : ''}`,
        ...(giorni.length ? ['   Dettaglio dalla distinta:', ...giorni.map(g => `     ${g}`)] : [])
      ].join('\n');
    }).join('\n\n');
    const oggetto = `Verifica busta paga di ${busta} (dati di ${mese})${nome ? ` - ${nome}` : ''}`;
    const testo = `Spett.le Direzione Navigazione Laghi,\nUfficio cassa\n\nBuongiorno,\nsono ${nome || 'l\'agente'}${agent?.id ? ` (matricola ${agent.id})` : ''}. Confrontando la busta paga di ${busta} con la mia distinta di ${mese} (periodo ${dateText(c.p.startIso)} – ${dateText(c.p.endIso)}) ho trovato ${voci.length === 1 ? 'questa differenza' : 'queste differenze'}:\n\n${blocchi}\n\nVi chiedo cortesemente di verificare e, se necessario, di correggere nella prossima busta.\n\nDistinti Saluti\n${nome}`;
    return { oggetto, testo, n: voci.length };
  }
  function mailHtml(item, c, calc) {
    const m = mailTesto(item, c, calc);
    if (!m) return '';
    const href = `mailto:?subject=${encodeURIComponent(m.oggetto)}&body=${encodeURIComponent(m.testo)}`;
    return `<div class="mail"><div class="mail-head"><span><b>${m.n === 1 ? '1 differenza' : `${m.n} differenze`}</b>: testo per l'ufficio personale</span><span><a class="chip" href="${href}">✉ Apri mail</a> <button type="button" class="chip" data-copia="${escapeHtml(`${m.oggetto}\n\n${m.testo}`)}">Copia</button></span></div><p class="mail-ogg"><b>Oggetto:</b> ${escapeHtml(m.oggetto)}</p><pre class="mail-testo">${escapeHtml(m.testo)}</pre></div>`;
  }

  // ---------------- Archivio delle buste: solo i dati letti (mese, totali, voci), mai il PDF ----------------
  const ARCH_KEY = () => `navisuite.bustePaga.${agent?.id}`;
  const archivioLocale = () => { try { return JSON.parse(localStorage.getItem(ARCH_KEY()) || '{}') || {}; } catch (_) { return {}; } };
  const scriviLocale = () => { try { localStorage.setItem(ARCH_KEY(), JSON.stringify(state.archivio)); } catch (_) {} };
  const statoAnno = () => {};
  function datiBusta(item) {
    const b = item.busta;
    const fp = b.feriePermessi || b.intestazione?.feriePermessi || null;
    const tfr = b.tfr || b.intestazione?.tfr || null;
    return {
      bustaMonth: item.bustaMonth, month: item.month, fileName: item.fileName, period: b.period || null,
       ...(b.intestazione ? { intestazione: b.intestazione } : {}),
       ...(fp ? { feriePermessi: fp } : {}),
       ...(tfr ? { tfr } : {}),
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
      Object.entries(remoto).forEach(([m, d]) => {
        if (!unione[m] || String(d?.savedAt || '') > String(unione[m]?.savedAt || '') || (d?.feriePermessi && !unione[m]?.feriePermessi) || (d?.tfr && !unione[m]?.tfr)) {
          unione[m] = { ...(unione[m] || {}), ...d };
        }
      });
      Object.entries(unione).forEach(([m, d]) => { if (String(remoto[m]?.savedAt || '') !== String(d?.savedAt || '')) window.NaviAdminFirebase.saveBustaPaga(agent.id, m, d).catch(e => console.warn(`Busta ${m} non copiata su Firebase`, e)); });
      state.archivio = unione; scriviLocale(); dallArchivio(); ridisegna(); statoAnno('Buste: Firebase ✓');
    } catch (error) { console.warn('Archivio buste non letto da Firebase', error); statoAnno('Riepilogo dalla copia su questo telefono (Firebase non raggiungibile)'); }
  }
  const chiave = item => item.bustaMonth || `file:${item.fileName}`;
  const itemDaArchivio = (mese, d) => ({ fromArchivio: true, busta: { period: d.period, intestazione: d.intestazione || null, feriePermessi: d.feriePermessi || d.intestazione?.feriePermessi || null, tfr: d.tfr || d.intestazione?.tfr || null, voci: d.voci || [], totals: d.totals || {}, check: { completa: true, headerFound: true, message: '', ...(d.check || {}) } }, fileName: d.fileName || `busta ${mese}`, bustaMonth: mese, month: d.month || (d.period ? window.NaviBustaParser.previousMonth(d.period) : '') });
  function dallArchivio() {
    Object.entries(state.archivio).forEach(([m, d]) => { if (/^\d{4}-\d{2}$/.test(m) && (!state.buste[m] || state.buste[m].fromArchivio)) state.buste[m] = itemDaArchivio(m, d); });
    Object.keys(state.buste).forEach(k => { if (/^\d{4}-\d{2}$/.test(k) && !state.archivio[k]) delete state.buste[k]; });
  }
  function isBustaTfr(mOrItem) {
    const it = typeof mOrItem === 'string' ? (state.buste[mOrItem] || { busta: state.archivio[mOrItem] }) : mOrItem;
    const b = it?.busta || it;
    if (!b) return false;
    if (b.period?.isTfr || b.tfr?.liquidato) return true;
    const voci = b.voci || [];
    return voci.some(v => v.code === '050' || /\bTFR\s+liq/i.test(v.description || '')) && !voci.some(v => ['49X', '43X', 'FD0', '334', '01Y'].includes(v.code));
  }
  const isSenzaDistinta = m => isMensilitaExtra(m) || isBustaTfr(m);
  const chiaviOrdinate = () => Object.keys(state.buste).sort((a, b) => ordineMese(state.buste[a].bustaMonth).localeCompare(ordineMese(state.buste[b].bustaMonth)));
  const nomeBusta = item => item.bustaMonth ? (isBustaTfr(item) ? `Liquidazione TFR (${monthLabel(item.bustaMonth).toLowerCase()})` : monthLabel(item.bustaMonth)) : item.fileName;
  const meseCorto = m => {
    if (String(m || '').endsWith('-13')) return '13ª';
    if (String(m || '').endsWith('-14')) return '14ª';
    const base = new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1, 12)).replace('.', '');
    return isBustaTfr(m) ? `TFR ${base}` : base;
  };
  const eurv = v => v === null || v === undefined || v === '' ? '—' : `<span class="eurv">${escapeHtml(euro(v))}</span>`;
  const COLORE = { ok: 'var(--green)', diff: 'var(--rose)', check: 'var(--amber)' };

  // ---------------- Correzioni da busta: riallineamento approvato voce per voce, mese o rinvio al mese dopo ----------------
  const CORR_KEY = () => `navidiaria.correzioniBusta.${agent?.id || 'guest'}`;
  const leggiCorrezioniLocali = () => { try { const r = JSON.parse(localStorage.getItem(CORR_KEY()) || 'null'); return { map: r?.map || {}, notes: r?.notes || {}, updatedAt: r?.updatedAt || '' }; } catch (_) { return { map: {}, notes: {}, updatedAt: '' }; } };
  let statoCorrezioni = leggiCorrezioniLocali();
  const correzioniMese = mese => (mese && statoCorrezioni.map?.[mese]) || {};
  const noteMese = mese => (mese && statoCorrezioni.notes?.[mese]) || {};
  const notaVoce = (mese, rowId) => { const n = noteMese(mese)[rowId]; return typeof n === 'string' ? { text: n } : (n && typeof n === 'object' ? n : null); };
  function scriviCorrezioni(nuovaMappa, nuoveNote = statoCorrezioni.notes) {
    const pulita = {}, notePulite = {};
    Object.entries(nuovaMappa || {}).forEach(([m, obj]) => {
      if (!obj || typeof obj !== 'object') return;
      const voci = Object.fromEntries(Object.entries(obj).filter(([, v]) => Number.isFinite(Number(v)) && Math.abs(Number(v)) > 1e-6));
      if (Object.keys(voci).length) pulita[m] = voci;
    });
    Object.entries(nuoveNote || {}).forEach(([m, obj]) => {
      if (!obj || typeof obj !== 'object') return;
      const voci = Object.fromEntries(Object.entries(obj).filter(([, v]) => v && (typeof v === 'string' ? v.trim() : (v.text || v.movedTo || v.movedFrom))));
      if (Object.keys(voci).length) notePulite[m] = voci;
    });
    statoCorrezioni = { map: pulita, notes: notePulite, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(CORR_KEY(), JSON.stringify(statoCorrezioni)); } catch (_) {}
    if (agent?.id && window.NaviAdminFirebase?.saveDiariaCorrezioni) {
      window.NaviAdminFirebase.saveDiariaCorrezioni(String(agent.id), statoCorrezioni).catch(e => console.warn('Correzioni non salvate su Firebase', e));
    }
  }
  async function caricaCorrezioni() {
    statoCorrezioni = leggiCorrezioniLocali();
    try {
      if (!agent?.id || !window.NaviAdminFirebase?.getDiariaCorrezioni) return;
      await window.NaviAdminFirebase.ready;
      const remoto = await window.NaviAdminFirebase.getDiariaCorrezioni(String(agent.id));
      if (remoto?.updatedAt && (!statoCorrezioni.updatedAt || remoto.updatedAt > statoCorrezioni.updatedAt)) {
        statoCorrezioni = { map: remoto.map || {}, notes: remoto.notes || {}, updatedAt: remoto.updatedAt };
        try { localStorage.setItem(CORR_KEY(), JSON.stringify(statoCorrezioni)); } catch (_) {}
        ridisegna();
      } else if (statoCorrezioni.updatedAt && (!remoto || (remoto.updatedAt || '') < statoCorrezioni.updatedAt)) {
        await window.NaviAdminFirebase.saveDiariaCorrezioni(String(agent.id), statoCorrezioni);
      }
    } catch (e) { console.warn('Correzioni da busta non lette da Firebase', e); }
  }
  function calcolaDeltaVoce(row, rawTotals) {
    const cal = rawTotals?.calendar || rawTotals || {};
    if (row.unit === 'ore') {
      const bustaMin = Math.round((Number(row.busta) || 0) * 60);
      const rawMin = row.id === 'overtime' ? (Number(rawTotals?.overtimeMinutes) || 0)
        : row.id === 'bank' ? (Number(rawTotals?.bankMinutes) || 0)
        : row.id === 'cashEmbark' ? (Number(cal.cashEmbarkServiceMinutes) || 0)
        : row.id === 'cashGround138' ? (Number(cal.cashGround138Minutes) || 0)
        : row.id === 'holiday' ? ((Number(cal.missedRestMinutes) || 0) + (Number(cal.holidayMinutes) || 0))
        : Math.round((Number(row.distintaOriginale ?? row.distinta) || 0) * 60);
      const delta = bustaMin - rawMin;
      if (row.id === 'holiday') {
        const out = { holidayMinutes: delta };
        if (bustaMin === 0 && (Number(cal.holiday) || 0) > 0) out.holiday = -(Number(cal.holiday) || 0);
        return out;
      }
      return { [row.id]: delta };
    }
    const bustaVal = Number(row.busta) || 0;
    const rawVal = Number(row.distintaOriginale ?? row.distinta) || 0;
    return { [row.id]: Math.round((bustaVal - rawVal) * 100) / 100 };
  }
  function rigaRaw(mese, rowId) {
    const item = Object.values(state.buste).find(it => it.month === mese) || state.buste[state.corrente];
    if (!item || !state.data) return null;
    const calc = window.NaviDistintaTotals.create({ storage: localStorage });
    const rawDistinta = calc.compute(state.data.entries, mese);
    const cmpRaw = window.NaviBustaCompare.compare(item.busta, rawDistinta.totals, { tolleranza: 0 });
    const row = cmpRaw.rows.find(r => r.id === rowId);
    return row ? { item, rawDistinta, row } : null;
  }
  function allineaVoce(mese, rowId, notaTesto) {
    const ctx = rigaRaw(mese, rowId);
    if (!ctx) return;
    const deltaObj = calcolaDeltaVoce(ctx.row, ctx.rawDistinta.totals);
    const mappa = { ...statoCorrezioni.map, [mese]: { ...correzioniMese(mese), ...deltaObj } };
    const note = { ...statoCorrezioni.notes };
    if (notaTesto !== undefined) {
      const prec = notaVoce(mese, rowId) || {};
      note[mese] = { ...noteMese(mese), [rowId]: { ...prec, text: String(notaTesto || '').trim() } };
    }
    scriviCorrezioni(mappa, note);
    ridisegna();
  }
  function spostaVoceMeseSuccessivo(mese, rowId, notaTesto) {
    const ctx = rigaRaw(mese, rowId);
    if (!ctx) return;
    const succ = meseDopo(mese);
    const deltaObj = calcolaDeltaVoce(ctx.row, ctx.rawDistinta.totals);
    const precNota = notaVoce(mese, rowId);
    const corrSucc = { ...correzioniMese(succ) };
    // Se c'era gia' uno spostamento precedente da questo mese per questa voce, togliamo il vecchio prima di sommare il nuovo
    if (precNota?.movedTo === succ && precNota.rawDelta) {
      Object.entries(precNota.rawDelta).forEach(([k, v]) => { corrSucc[k] = (Number(corrSucc[k]) || 0) + Number(v); });
    }
    Object.entries(deltaObj).forEach(([k, v]) => { corrSucc[k] = Math.round(((Number(corrSucc[k]) || 0) - Number(v)) * 100) / 100; });
    const testo = String(notaTesto || '').trim() || `Liquidata nella busta di ${monthLabel(meseDopo(succ)).toLowerCase()}`;
    const mappa = {
      ...statoCorrezioni.map,
      [mese]: { ...correzioniMese(mese), ...deltaObj },
      [succ]: corrSucc
    };
    const note = {
      ...statoCorrezioni.notes,
      [mese]: { ...noteMese(mese), [rowId]: { text: testo, movedTo: succ, movedUnitDelta: ctx.row.diff, rawDelta: deltaObj } },
      [succ]: { ...noteMese(succ), [rowId]: { text: testo, movedFrom: mese, movedUnitDelta: ctx.row.diff, rawDelta: deltaObj } }
    };
    scriviCorrezioni(mappa, note);
    ridisegna();
  }
  function salvaNotaVoce(mese, rowId, notaTesto) {
    const prec = notaVoce(mese, rowId) || {};
    const testo = String(notaTesto || '').trim();
    const note = { ...statoCorrezioni.notes, [mese]: { ...noteMese(mese), [rowId]: { ...prec, text: testo } } };
    if (prec.movedTo && statoCorrezioni.notes?.[prec.movedTo]?.[rowId]) {
      note[prec.movedTo] = { ...noteMese(prec.movedTo), [rowId]: { ...notaVoce(prec.movedTo, rowId), text: testo } };
    }
    if (prec.movedFrom && statoCorrezioni.notes?.[prec.movedFrom]?.[rowId]) {
      note[prec.movedFrom] = { ...noteMese(prec.movedFrom), [rowId]: { ...notaVoce(prec.movedFrom, rowId), text: testo } };
    }
    scriviCorrezioni(statoCorrezioni.map, note);
    ridisegna();
  }
  function pulisciChiaviVoce(obj, rowId) {
    delete obj[rowId];
    if (rowId === 'holiday') { delete obj.holidayMinutes; delete obj.holiday; }
    if (rowId === 'sunday') delete obj.sundayShift;
    if (rowId === 'cash') delete obj.cashHandling;
    if (rowId === 'secondTicket') delete obj['second-ticket'];
  }
  function annullaVoce(mese, rowId) {
    const corr = { ...correzioniMese(mese) };
    const nota = notaVoce(mese, rowId);
    const mappa = { ...statoCorrezioni.map, [mese]: corr };
    const note = { ...statoCorrezioni.notes, [mese]: { ...noteMese(mese) } };
    pulisciChiaviVoce(corr, rowId);
    delete note[mese][rowId];
    // Se la voce era stata spostata al mese successivo (o proveniva dal mese precedente), annulla anche l'altro lato
    if (nota?.movedTo) {
      const succ = nota.movedTo, corrSucc = { ...correzioniMese(succ) };
      if (nota.rawDelta) Object.entries(nota.rawDelta).forEach(([k, v]) => { corrSucc[k] = Math.round(((Number(corrSucc[k]) || 0) + Number(v)) * 100) / 100; });
      else pulisciChiaviVoce(corrSucc, rowId);
      mappa[succ] = corrSucc;
      note[succ] = { ...noteMese(succ) }; delete note[succ][rowId];
    } else if (nota?.movedFrom) {
      const prev = nota.movedFrom, corrPrev = { ...correzioniMese(prev) };
      pulisciChiaviVoce(corrPrev, rowId);
      mappa[prev] = corrPrev;
      note[prev] = { ...noteMese(prev) }; delete note[prev][rowId];
    }
    scriviCorrezioni(mappa, note);
    ridisegna();
  }
  function apriModalSpostaONota(mese, rowId, mode) {
    const ctx = rigaRaw(mese, rowId);
    const label = ctx?.row?.label || rowId;
    const succ = meseDopo(mese), bustaSucc = meseDopo(succ);
    const notaAttuale = notaVoce(mese, rowId);
    const diffUnit = ctx ? signedUnit(ctx.row.diff, ctx.row.unit) : '';
    const diffEuro = ctx?.row?.euro ? ` (${euro(Math.abs(ctx.row.euro))})` : '';
    const defaultText = notaAttuale?.text || (mode === 'sposta' ? `Verrà liquidata nella busta di ${monthLabel(bustaSucc).toLowerCase()} su indicazione ufficio personale` : '');
    document.querySelector('.vb-modal-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'vb-modal-overlay';
    const infoHtml = mode === 'sposta'
      ? `Allinea la Distinta di <b>${escapeHtml(monthLabel(mese).toLowerCase())}</b> (${ctx ? signedUnit(-ctx.row.diff, ctx.row.unit) : ''}) e sposta <b>${escapeHtml(diffUnit)}${escapeHtml(diffEuro)}</b> sulla Distinta di <b>${escapeHtml(monthLabel(succ).toLowerCase())}</b> (attesa nella busta di <b>${escapeHtml(monthLabel(bustaSucc).toLowerCase())}</b>).`
      : `Nota associata alla voce <b>${escapeHtml(label)}</b> nella Distinta di <b>${escapeHtml(monthLabel(mese).toLowerCase())}</b>.`;
    overlay.innerHTML = `<div class="vb-modal-card"><small>${mode === 'sposta' ? 'RINVIO COMPETENZA AL MESE SUCCESSIVO' : 'NOTA CORREZIONE BUSTA'}</small><h3>${escapeHtml(label)}</h3><div class="vb-modal-info">${infoHtml}</div><label>Nota (visibile in Verifica busta e nella Distinta)<textarea placeholder="Scrivi una nota (es. accordi con ufficio personale, turno del giorno…)">${escapeHtml(defaultText)}</textarea></label><div class="vb-modal-actions"><button type="button" data-vb-close="1">Annulla</button><button type="button" class="primary" data-vb-save="1">${mode === 'sposta' ? `↪ Sposta a ${escapeHtml(meseCorto(succ))} e salva` : 'Salva nota'}</button></div></div>`;
    document.body.appendChild(overlay);
    const ta = overlay.querySelector('textarea'), close = () => overlay.remove();
    const save = () => {
      if (mode === 'sposta') spostaVoceMeseSuccessivo(mese, rowId, ta.value);
      else salvaNotaVoce(mese, rowId, ta.value);
      close();
    };
    overlay.querySelector('[data-vb-close]').addEventListener('click', close);
    overlay.querySelector('[data-vb-save]').addEventListener('click', save);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    ta.addEventListener('keydown', e => { if (e.key === 'Escape') close(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } });
    setTimeout(() => { ta.focus(); ta.select(); }, 20);
  }
  function allineaTuttoMese(mese) {
    const item = Object.values(state.buste).find(it => it.month === mese) || state.buste[state.corrente];
    if (!item || !state.data) return;
    const calc = window.NaviDistintaTotals.create({ storage: localStorage });
    const rawDistinta = calc.compute(state.data.entries, mese);
    const cmpRaw = window.NaviBustaCompare.compare(item.busta, rawDistinta.totals, { tolleranza: 0 });
    const nuovoMese = { ...correzioniMese(mese) };
    cmpRaw.rows.forEach(row => {
      const soglia = row.unit === 'ore' ? 0.02 : 0.001;
      if (Math.abs(row.diff) > soglia) Object.assign(nuovoMese, calcolaDeltaVoce(row, rawDistinta.totals));
    });
    scriviCorrezioni({ ...statoCorrezioni.map, [mese]: nuovoMese }, statoCorrezioni.notes);
    ridisegna();
  }
  function annullaTuttoMese(mese) {
    const noteDelMese = noteMese(mese);
    Object.keys({ ...correzioniMese(mese), ...noteDelMese }).forEach(rowId => annullaVoce(mese, rowId));
    const mappa = { ...statoCorrezioni.map };
    const note = { ...statoCorrezioni.notes };
    delete mappa[mese]; delete note[mese];
    scriviCorrezioni(mappa, note);
    ridisegna();
  }

  // Confronto di una busta con la Distinta del mese prima (null se il mese manca)
  function confronta(item, data, calculator) {
    const p = window.NaviDistintaTotals.competencePeriod(item.month);
    if (!p.startIso) return null;
    const distinta = calculator.compute(data.entries, item.month, correzioniMese(item.month));
    return { p, distinta, result: window.NaviBustaCompare.compare(item.busta, distinta.totals, { tolleranza: tolleranza() }) };
  }
  // ---------------- Stime: busta attesa per ogni mese della Distinta con giornate inserite ----------------
  const meseDopo = m => { const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1, 12); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  // Busta di riferimento per i prezzi: l'ultima salvata prima della busta da stimare (o la prima, se non ce ne sono prima)
  function bustaRiferimento(bustaMonth) {
    const mesi = Object.keys(state.archivio).filter(m => /^\d{4}-\d{2}$/.test(m) && !isSenzaDistinta(m)).sort();
    const prima = mesi.filter(m => m < bustaMonth);
    const m = prima[prima.length - 1] || mesi[0];
    return m ? { mese: m, ...state.archivio[m] } : null;
  }
  function altreBusteRiferimento(bustaMonth, refMese) {
    return Object.keys(state.archivio)
      .filter(m => /^\d{4}-\d{2}$/.test(m) && !isSenzaDistinta(m) && m !== refMese && m !== bustaMonth)
      .sort((a, b) => (b < bustaMonth) - (a < bustaMonth) || b.localeCompare(a))
      .map(m => ({ mese: m, ...state.archivio[m] }));
  }
  function stimaBusta(bustaMonth, data, calculator) {
    const ref = bustaRiferimento(bustaMonth);
    if (!ref || ref.mese === bustaMonth) return null;
    const month = window.NaviBustaParser.previousMonth({ year: Number(bustaMonth.slice(0, 4)), month: Number(bustaMonth.slice(5, 7)) });
    const p = window.NaviDistintaTotals.competencePeriod(month);
    if (!p.startIso) return null;
    const corr = correzioniMese(month);
    const distinta = calculator.compute(data.entries, month, corr);
    if (!distinta.entryCount && !Object.keys(corr).length) return null;
    const s = window.NaviBustaCompare.stima(ref, distinta.totals, altreBusteRiferimento(bustaMonth, ref.mese));
    return s && { ...s, bustaMonth, month, p, ref: ref.mese, giornate: distinta.entryCount };
  }
  // Stime per i mesi senza busta: tutti i mesi coperti da giornate della Distinta o con competenze rinviate/corrette
  function stimeSenzaBusta(data, calculator) {
    const mesi = new Set();
    (data?.entries || []).forEach(e => { const m = String(e?.date || '').slice(0, 7); if (/^\d{4}-\d{2}$/.test(m)) { mesi.add(meseDopo(m)); } });
    Object.keys(statoCorrezioni.map || {}).forEach(m => { if (/^\d{4}-\d{2}$/.test(m)) mesi.add(meseDopo(m)); });
    const out = {};
    [...mesi].sort().forEach(b => { if (state.archivio[b]) return; const st = stimaBusta(b, data, calculator); if (st) out[b] = st; });
    return out;
  }
  const oggiIso = () => window.NaviDistintaTotals.iso(new Date());
  const blurBtnHtml = () => {
    const on = document.body.classList.contains('vb-blur');
    return `<button type="button" class="vb-blur-btn" data-vb-blur="1" aria-pressed="${on}" title="${on ? 'Mostra cifre' : 'Nascondi cifre'}">${on ? '👁' : '🙈'}</button>`;
  };
  function stimaHtml(st, intera) {
    const giorni = (new Date(`${st.p.endIso}T12:00:00`) - new Date(`${st.p.startIso}T12:00:00`)) / 864e5 + 1;
    const inCorso = st.p.endIso >= oggiIso();
    const testa = `<div class="tot num stima"><div><small>Netto stimato <span class="stima-tag">stima</span></small><div class="tot-main"><span class="tot-n">≈ ${eurv(st.netto)}</span>${blurBtnHtml()}</div><div class="range">tra ${eurv(st.netto - st.margine)} e ${eurv(st.netto + st.margine)}</div></div><div class="tot-side">lordo <b>≈ ${eurv(st.lordo)}</b><br>ritenute <b>≈ <span class="eurv">−${escapeHtml(euro(st.ritenute))}</span></b></div></div>`;
    if (!intera) return testa;
    const riga = r => {
      const nota = notaVoce(st.month, r.id);
      const hasCorr = Math.abs(r.correzione || 0) > 0.001;
      const corrInfo = hasCorr
        ? ` <span class="vb-corr-tag${nota?.movedFrom ? ' is-move' : ''}">include ${signedUnit(r.correzione, r.unit)}${r.importoCorrezione ? ` (${r.importoCorrezione > 0 ? '+' : '−'}${escapeHtml(euro(Math.abs(r.importoCorrezione)))})` : ''}${nota?.movedFrom ? ` da ${escapeHtml(meseCorto(nota.movedFrom))}` : ''}</span>`
        : '';
      const notaBox = nota?.text
        ? `<div class="vb-nota-box">📝 ${nota.movedFrom ? `<b>Arretrato da ${escapeHtml(monthLabel(nota.movedFrom).toLowerCase())}:</b> ` : ''}${escapeHtml(nota.text)}</div>`
        : '';
      return r.importo === null
        ? `<div class="voce st" style="--c:var(--amber)"><span class="n">${escapeHtml(r.label)}</span><span class="pill num">${unitValue(r.quantita, r.unit)}</span><span class="c">Nessun prezzo nella busta di ${escapeHtml(monthLabel(st.ref).toLowerCase())}: non calcolata${corrInfo}</span>${notaBox}</div>`
        : `<div class="voce st"><span class="n">${escapeHtml(r.label)} <span class="eur num eurv">${escapeHtml(euro(r.importo))}</span></span><span class="pill num">${unitValue(r.quantita, r.unit)}</span><span class="c num">${unitValue(r.quantita, r.unit)} × <span class="eurv">${escapeHtml(number(r.base, 2))} €</span>${r.daMese ? ` (${escapeHtml(meseCorto(r.daMese))})` : ''}${corrInfo}</span>${notaBox}</div>`;
    };
    return `<p class="msub">${st.giornate} giornate nella Distinta su ${giorni} del periodo${inCorso ? ' · periodo in corso: la stima cresce con le giornate inserite' : ''}</p>${testa}`
      + `<p class="grp">Voci dalla Distinta · prezzi della busta di ${escapeHtml(monthLabel(st.ref).toLowerCase())}</p><div class="voci">${st.righe.map(riga).join('') || '<p class="msub">Nessuna voce variabile.</p>'}</div>`
      + `<p class="grp">Parte fissa · <span class="eurv">${escapeHtml(euro(st.fisso))}</span> come la busta di ${escapeHtml(monthLabel(st.ref).toLowerCase())}</p>`
      + `<p class="msub">È una stima: ritenute al ${number(st.quotaRitenute * 100, 1)}% come la busta di riferimento. Non conta conguagli, arretrati, tredicesima e una tantum; il ticket elettronico non è nel netto.</p>`;
  }

  const statoMese = c => !c ? 'check' : c.result.rows.some(r => r.status === 'diff' && !r.trascurabile) ? 'diff' : c.result.rows.some(r => r.status !== 'ok' && !r.trascurabile) ? 'check' : 'ok';

  // Totali: netto in primo piano con scimmietta mostra/nascondi accanto, lordo e ritenute piccoli a destra
  function tilesHtml(t) {
    return `<div class="tot num"><div><small>Netto</small><div class="tot-main"><span class="tot-n">${eurv(t.netto)}</span>${blurBtnHtml()}</div></div><div class="tot-side">lordo <b>${eurv(t.competenze)}</b><br>ritenute <b>${t.ritenute === null || t.ritenute === undefined ? '—' : `<span class="eurv">−${escapeHtml(euro(Math.abs(t.ritenute)))}</span>`}</b></div></div>`;
  }

  function voceHtml(row, item) {
    const c = COLORE[row.status];
    const hasCorr = Math.abs(row.correzione || 0) > 0.001;
    const hasDiff = Math.abs(row.diff || 0) > (row.unit === 'ore' ? 0.02 : 0.001);
    const notaObj = item?.month ? notaVoce(item.month, row.id) : null;
    const isMoved = !!notaObj?.movedTo;
    const pill = row.status === 'ok' ? (isMoved ? `↪ A ${meseCorto(notaObj.movedTo)}` : hasCorr ? '✓ Allineata' : '✓') : row.status === 'check' ? 'Verifica' : `${signedUnit(row.diff, row.unit)}${row.euro ? ` · <span class="eurv">${escapeHtml(euro(Math.abs(row.euro)))}</span>` : ''}`;
    const corrBadge = hasCorr
      ? ` <span class="vb-corr-tag${isMoved ? ' is-move' : ''}" title="Correzione applicata in Distinta (originale: ${escapeHtml(unitValue(row.distintaOriginale, row.unit))})">${isMoved ? `rinviata ${signedUnit(notaObj.movedUnitDelta ?? -row.correzione, row.unit)} a ${escapeHtml(meseCorto(notaObj.movedTo))}` : `corr. ${signedUnit(row.correzione, row.unit)}`}</span>`
      : '';
    const riga = (row.status === 'ok' && !hasCorr ? unitValue(row.busta ?? row.distinta, row.unit) : `distinta ${unitValue(row.distinta, row.unit)} · busta ${row.busta === null ? 'assente' : unitValue(row.busta, row.unit)}`) + corrBadge;
    const nota = row.notes?.length ? `<p>${escapeHtml(row.notes[row.notes.length - 1]).replace(/\n/g, '<br>')}</p>` : '';
    const notaBox = notaObj?.text
      ? `<div class="vb-nota-box">📝 ${isMoved ? `<b>Rinviata a ${escapeHtml(monthLabel(notaObj.movedTo).toLowerCase())} (busta ${escapeHtml(monthLabel(meseDopo(notaObj.movedTo)).toLowerCase())}):</b> ` : notaObj.movedFrom ? `<b>Da ${escapeHtml(monthLabel(notaObj.movedFrom).toLowerCase())}:</b> ` : ''}${escapeHtml(notaObj.text)}</div>`
      : '';
    const succLabel = item?.month ? meseCorto(meseDopo(item.month)) : '';
    const btnCorr = item?.month
      ? (hasCorr
        ? `<span class="vb-corr-row"><span>Originale Distinta: <b>${unitValue(row.distintaOriginale, row.unit)}</b></span><span class="vb-corr-btns"><span role="button" tabindex="0" class="vb-corr-action is-note" data-nota-corr="${escapeHtml(row.id)}" data-corr-mese="${escapeHtml(item.month)}">✎ ${notaObj?.text ? 'Modifica nota' : 'Aggiungi nota'}</span><span role="button" tabindex="0" class="vb-corr-action is-undo" data-annulla-corr="${escapeHtml(row.id)}" data-corr-mese="${escapeHtml(item.month)}">↺ Annulla (${signedUnit(row.correzione, row.unit)})</span></span></span>`
        : hasDiff
          ? `<span class="vb-corr-row"><span>Scarto: <b>${signedUnit(row.diff, row.unit)}</b></span><span class="vb-corr-btns"><span role="button" tabindex="0" class="vb-corr-action" data-allinea-corr="${escapeHtml(row.id)}" data-corr-mese="${escapeHtml(item.month)}">✓ Allinea alla busta (${signedUnit(-row.diff, row.unit)})</span><span role="button" tabindex="0" class="vb-corr-action is-move" data-sposta-corr="${escapeHtml(row.id)}" data-corr-mese="${escapeHtml(item.month)}">↪ Sposta a ${escapeHtml(succLabel)} (${signedUnit(row.diff, row.unit)})</span></span></span>`
          : '')
      : '';
    return `<div role="button" tabindex="0" class="voce" style="--c:${c}" aria-expanded="false"><span class="n">${escapeHtml(row.label)}${row.importo ? ` <span class="eur num eurv">${escapeHtml(euro(row.importo))}</span>` : ''}</span><span class="pill num">${pill}</span><span class="c num">${riga}</span>`
      + `${notaBox}${btnCorr}<span class="det num"><span><small>Distinta</small>${unitValue(row.distinta, row.unit)}${hasCorr ? ` (da ${unitValue(row.distintaOriginale, row.unit)})` : ''}</span><span><small>Busta</small>${row.busta === null ? 'assente' : unitValue(row.busta, row.unit)}</span><span><small>Importo busta</small>${eurv(row.importo)}</span><span><small>${row.status === 'ok' ? 'Distinta in euro' : 'Differenza circa'}</small>${row.status === 'ok' ? eurv(row.importoDistinta) : row.euro ? eurv(Math.abs(row.euro)) : '—'}</span><span><small>Voci in busta</small>${escapeHtml(row.codes.join(' + '))}</span>${nota}</span></div>`;
  }

  function barraMesiHtml(chiavi, stime, statoItem) {
    const chiaviStima = Object.keys(stime).map(m => `stima:${m}`);
    const tutti = [...chiavi, ...chiaviStima];
    const idx = tutti.indexOf(state.corrente);
    const prevKey = idx > 0 ? tutti[idx - 1] : '';
    const nextKey = idx >= 0 && idx < tutti.length - 1 ? tutti[idx + 1] : '';
    const ultimaKey = chiavi[chiavi.length - 1] || '';
    const isStima = state.corrente.startsWith('stima:');
    const curMese = isStima ? state.corrente.slice(6) : (state.buste[state.corrente]?.bustaMonth || '');
    const curLabel = isStima
      ? `≈ Stima ${monthLabel(curMese)}`
      : (curMese ? nomeBusta(state.buste[state.corrente]) : (state.buste[state.corrente]?.fileName || 'Busta'));
    const curDot = isStima ? 'var(--amber)' : COLORE[statoItem(state.buste[state.corrente])];

    // Opzioni raggruppate per anno nel selettore centrale (come l'input data de "Il mio turno")
    const perAnno = new Map();
    chiavi.slice().reverse().forEach(k => {
      const it = state.buste[k];
      const y = (it?.bustaMonth || '').slice(0, 4) || 'Altro';
      if (!perAnno.has(y)) perAnno.set(y, []);
      const st = statoItem(it);
      const sym = st === 'ok' ? '●' : st === 'diff' ? '▲' : '◆';
      perAnno.get(y).push(`<option value="${escapeHtml(k)}"${k === state.corrente ? ' selected' : ''}>${sym} ${escapeHtml(nomeBusta(it))}</option>`);
    });
    const optStime = Object.keys(stime).slice().reverse().map(m => {
      const k = `stima:${m}`;
      return `<option value="${escapeHtml(k)}"${k === state.corrente ? ' selected' : ''}>≈ Stima ${escapeHtml(monthLabel(m))}</option>`;
    }).join('');
    const optGroups = (optStime ? `<optgroup label="Stime dalla Distinta">${optStime}</optgroup>` : '')
      + [...perAnno.entries()].map(([y, opts]) => `<optgroup label="Buste ${escapeHtml(y)}">${opts.join('')}</optgroup>`).join('');

    const stepper = `<div class="vb-datebar"><span class="terra-day">`
      + `<button type="button" class="terra-day-nav" data-mese="${escapeHtml(prevKey)}" ${prevKey ? '' : 'disabled'} aria-label="Mese precedente" title="Mese precedente">‹</button>`
      + `<span class="terra-day-current"><i class="dot" style="--c:${curDot}"></i><span class="terra-day-label">${escapeHtml(curLabel)}</span><span class="terra-day-chev">▾</span>`
      + `<select class="terra-day-input" data-mese-select="1" aria-label="Scegli busta paga">${optGroups}</select></span>`
      + `<button type="button" class="terra-day-nav" data-mese="${escapeHtml(nextKey)}" ${nextKey ? '' : 'disabled'} aria-label="Mese successivo" title="Mese successivo">›</button>`
      + (ultimaKey && state.corrente !== ultimaKey ? `<button type="button" class="terra-day-today" data-mese="${escapeHtml(ultimaKey)}" title="Torna all'ultima busta caricata">Ultima</button>` : '')
      + `</span></div>`;

    const pills = chiavi.map(k => { const it = state.buste[k]; return `<button type="button" class="chip${k === state.corrente ? ' on' : ''}" data-mese="${escapeHtml(k)}"><i class="dot" style="--c:${COLORE[statoItem(it)]}"></i>${escapeHtml(it.bustaMonth ? `${meseCorto(it.bustaMonth)} ${it.bustaMonth.slice(2, 4)}` : it.fileName)}</button>`; }).join('')
      + Object.keys(stime).map(m => `<button type="button" class="chip chip-stima${`stima:${m}` === state.corrente ? ' on' : ''}" data-mese="stima:${m}">≈ ${escapeHtml(`${meseCorto(m)} ${m.slice(2, 4)}`)}</button>`).join('');
    return `${stepper}<div class="sel" id="vbMesiStrip">${pills}</div>`;
  }

  function centraChipAttivo() {
    const strip = $('vbMesiStrip');
    const on = strip?.querySelector('.chip.on');
    if (!strip || !on) return;
    const targetLeft = on.offsetLeft - Math.max(0, (strip.clientWidth - on.clientWidth) / 2);
    strip.scrollLeft = Math.max(0, targetLeft);
  }

  function renderConfronto(data, calculator, alerts) {
    const chiavi = chiaviOrdinate();
    const stime = stimeSenzaBusta(data, calculator);
    const chiaviStima = Object.keys(stime).map(m => `stima:${m}`);
    if (!chiavi.includes(state.corrente) && !chiaviStima.includes(state.corrente)) state.corrente = chiavi[chiavi.length - 1] || '';
    const statoItem = it => isSenzaDistinta(it?.bustaMonth) ? 'ok' : statoMese(confronta(it, data, calculator));
    if (els.meseNav) {
      els.meseNav.hidden = false;
      els.meseNav.innerHTML = barraMesiHtml(chiavi, stime, statoItem);
      centraChipAttivo();
    }
    if (state.corrente.startsWith('stima:')) {
      const st = stime[state.corrente.slice(6)];
      els.titolo.textContent = `Stima ${monthLabel(st.bustaMonth).toLowerCase()}`;
      els.confronto.innerHTML = `<p class="msub">Stima della busta di ${escapeHtml(monthLabel(st.bustaMonth).toLowerCase())} → Distinta di ${escapeHtml(monthLabel(st.month).toLowerCase())} (${dateText(st.p.startIso)} – ${dateText(st.p.endIso)})</p>${stimaHtml(st, true)}`;
      return;
    }
    const item = state.buste[state.corrente];
    if (!item) { els.confronto.innerHTML = ''; return; }
    const nome = nomeBusta(item);
    if (!item.busta.check.completa) alerts.push({ kind: item.busta.check.headerFound ? 'warn' : 'error', text: `${nome}: ${item.busta.check.message}` });
    const extra = isSenzaDistinta(item.bustaMonth);
    const isTfr = isBustaTfr(item);
    const c = extra ? null : confronta(item, data, calculator);
    let corpo;
    if (extra) {
      const tutteVoci = item.busta.voci || [];
      const voci = tutteVoci.filter(v => Number.isFinite(Number(v.amount)) && Math.abs(Number(v.amount)) > 0.001);
      const comp = voci.filter(v => v.amount > 0);
      const rit = voci.filter(v => v.amount < 0);
      const infoTfr = isTfr ? tutteVoci.filter(v => !v.amount && v.base && ['H51', 'H53', 'H54', 'H69', 'I52'].includes(v.code)) : [];
      const rigaExtra = (v, col) => `<div class="voce" style="--c:${col}"><span class="n">${escapeHtml(v.description || v.code)} <span class="eur num eurv">${escapeHtml(euro(v.amount ?? v.base))}</span></span><span class="pill num">${escapeHtml(v.code)}</span><span class="c num">${v.quantity ? `${number(v.quantity, 2)}${v.base && v.amount ? ` × ${number(v.base, 2)} €` : v.code === 'I52' ? `% · Reddito rif. ${euro(v.base)}` : ''}` : (v.amount ? 'Importo liquidato' : 'Voce di calcolo fiscale')}</span></div>`;
      corpo = `<div class="ok-all">✓ ${isTfr ? 'Liquidazione TFR di fine contratto' : `Mensilità aggiuntiva (${escapeHtml(nome)})`}: non legata ai turni giornalieri della Distinta</div>`
        + (comp.length ? `<p class="grp">${isTfr ? 'TFR Liquidato' : `Competenze (${comp.length})`}</p><div class="voci">${comp.map(v => rigaExtra(v, 'var(--green)')).join('')}</div>` : '')
        + (rit.length ? `<p class="grp">Ritenute fiscali e previdenziali (${rit.length})</p><div class="voci">${rit.map(v => rigaExtra(v, 'var(--amber)')).join('')}</div>` : '')
        + (infoTfr.length ? `<p class="grp">Dettaglio calcolo imposta e detrazioni TFR</p><div class="voci">${infoTfr.map(v => rigaExtra(v, 'var(--cyan)')).join('')}</div>` : '');
    } else if (!c) corpo = '<p class="msub">Non trovo il mese di questa busta: non posso confrontarla con la Distinta.</p>';
    else {
      if (!c.distinta.entryCount) alerts.push({ kind: 'warn', text: `Nessuna giornata nella Distinta dal ${dateText(c.p.startIso)} al ${dateText(c.p.endIso)}.` });
      // Ordine per valore economico: prima le voci che pesano di piu' in euro
      const valore = row => Math.abs(Number(row.importo) || Number(row.importoDistinta) || Number(row.euro) || 0);
      // Prima le differenze, poi le voci da verificare, poi quelle ok; in ogni gruppo per valore in euro
      const ordine = { diff: 0, check: 1, ok: 2 };
      const rows = c.result.rows.slice().sort((a, b) => ordine[a.status] - ordine[b.status] || valore(b) - valore(a));
      const brutte = rows.filter(r => r.status !== 'ok'), buone = rows.filter(r => r.status === 'ok');
      const daAllineare = rows.filter(r => Math.abs(r.diff || 0) > (r.unit === 'ore' ? 0.02 : 0.001));
      const corrette = rows.filter(r => Math.abs(r.correzione || 0) > 0.001);
      const barraCorr = item.month && (daAllineare.length || corrette.length)
        ? `<div class="vb-corr-bar"><span><b>Correzioni da busta</b> · ${corrette.length ? `${corrette.length} ${corrette.length === 1 ? 'voce allineata' : 'voci allineate'} nella Distinta di ${escapeHtml(monthLabel(item.month).toLowerCase())}` : `allinea la Distinta di ${escapeHtml(monthLabel(item.month).toLowerCase())} ai valori della busta`}</span><span class="vb-corr-bar-btns">${daAllineare.length ? `<button type="button" class="chip vb-btn-allinea" data-allinea-tutto="${escapeHtml(item.month)}">✓ Allinea tutto il mese (${daAllineare.length})</button>` : ''}${corrette.length ? `<button type="button" class="chip vb-btn-annulla" data-annulla-tutto="${escapeHtml(item.month)}">↺ Ripristina Distinta (${corrette.length})</button>` : ''}</span></div>`
        : '';
      const s = c.result.summary;
      corpo = `<div class="sum"><span style="--c:var(--green)">${s.ok} ok</span><span style="--c:var(--rose)">${s.diff} diff.</span><span style="--c:var(--amber)">${s.check} verifica</span></div>`
        + barraCorr
        + (rows.length ? '' : '<p class="msub">Nessuna delle voci confrontabili compare nella busta o nella Distinta di questo mese.</p>')
        + `<div class="voci">${!brutte.length && buone.length ? '<div class="ok-all">✓ Tutte le voci tornano con la Distinta</div>' : ''}${rows.map(r => voceHtml(r, item)).join('')}</div>`
        + mailHtml(item, c, calculator);
    }
    els.titolo.textContent = nome;
    const emMese = extra ? (item.bustaMonth.endsWith('-14') ? `luglio ${item.bustaMonth.slice(0, 4)}` : `dicembre ${item.bustaMonth.slice(0, 4)}`) : '';
    els.confronto.innerHTML = `<div><p class="msub">Busta di ${escapeHtml(nome.toLowerCase())}${extra ? ` · emessa a ${escapeHtml(emMese)}` : c ? ` → Distinta di ${escapeHtml(monthLabel(item.month).toLowerCase())} (${dateText(c.p.startIso)} – ${dateText(c.p.endIso)})` : ''}</p></div>${tilesHtml(item.busta.totals || {})}${extra ? '' : scartoStima(item, data, calculator)}${corpo}`;
  }
  // Busta arrivata: quanto avrebbe detto la stima
  function scartoStima(item, data, calculator) {
    if (!item.bustaMonth) return '';
    const st = stimaBusta(item.bustaMonth, data, calculator), netto = Number(item.busta.totals?.netto);
    if (!st || !Number.isFinite(netto)) return '';
    const c730 = window.NaviBustaCompare.conguaglio730?.(item.busta.voci) || 0;
    const nettoOrd = netto - c730;
    const d = nettoOrd - st.netto;
    const nota730 = c730 ? ` · al netto del 730 (${c730 > 0 ? '+' : '−'}<span class="eurv">${escapeHtml(euro(Math.abs(c730)))}</span>): ${eurv(nettoOrd)}` : '';
    return `<p class="msub">Stima dalla Distinta: ≈ ${eurv(st.netto)} netto (prezzi di ${escapeHtml(monthLabel(st.ref).toLowerCase())})${nota730} · scarto ${eurv(Math.abs(d))} ${d >= 0 ? 'in più' : 'in meno'}</p>`;
  }

  function renderAnno(data, calculator) {
    const mesi = Object.keys(state.archivio).filter(m => /^\d{4}-\d{2}$/.test(m)).sort((a, b) => ordineMese(a).localeCompare(ordineMese(b)));
    if (!mesi.length) { els.anno.innerHTML = '<p class="msub">Nessuna busta salvata.</p>'; return; }
    const stime = data && calculator ? stimeSenzaBusta(data, calculator) : {};
    const anni = [...new Set([...mesi, ...Object.keys(stime)].map(m => m.slice(0, 4)))].sort().reverse();
    if (!anni.includes(state.anno)) state.anno = anni[0];
    const delAnno = mesi.filter(m => m.startsWith(state.anno));
    const tot = { competenze: 0, ritenute: 0, netto: 0 };
    delAnno.forEach(m => { const t = state.archivio[m].totals || {}; Object.keys(tot).forEach(k => { tot[k] += Number(t[k]) || 0; }); });
    const stato = m => isSenzaDistinta(m) ? 'ok' : (data && calculator && state.buste[m] ? statoMese(confronta(state.buste[m], data, calculator)) : 'ok');
    const stimeAnno = Object.keys(stime).filter(m => m.startsWith(state.anno));
    const totStime = stimeAnno.reduce((t, m) => t + stime[m].netto, 0);
    // Esclude dal grafico i rimborsi IRPEF / 730 (es. C75, B03) per non falsare la scala delle barre
    const rimborsoIrpef = m => Math.max(0, window.NaviBustaCompare.conguaglio730?.(state.archivio[m]?.voci) || 0);
    const nettoGrafico = m => Math.max(0, (Number(state.archivio[m]?.totals?.netto) || 0) - rimborsoIrpef(m));
    const totNettoGrafico = delAnno.reduce((t, m) => t + nettoGrafico(m), 0);
    const max = Math.max(1, ...delAnno.map(nettoGrafico), ...stimeAnno.map(m => stime[m].netto));
    // Quota degli straordinari (voci 334 e 01Y) dentro la colonna del netto
    const STRAORD = ['334', '01Y'];
    const straord = m => (state.archivio[m]?.voci || []).filter(v => STRAORD.includes(v.code)).reduce((t, v) => t + (Number(v.amount) || 0), 0);
    const totStraord = delAnno.reduce((t, m) => t + straord(m), 0);
    const slotMesi = [];
    for (let i = 1; i <= 12; i += 1) {
      slotMesi.push(`${state.anno}-${String(i).padStart(2, '0')}`);
      if (i === 7 && state.archivio[`${state.anno}-14`]) slotMesi.push(`${state.anno}-14`);
      if (i === 12 && state.archivio[`${state.anno}-13`]) slotMesi.push(`${state.anno}-13`);
    }
    const barre = slotMesi.map(m => {
      const n = nettoGrafico(m), o = straord(m), rimb = rimborsoIrpef(m);
      const shortLbl = m.endsWith('-14') ? '14ª' : m.endsWith('-13') ? '13ª' : isBustaTfr(m) ? 'TFR' : meseCorto(m).slice(0, 1).toUpperCase();
      if (!state.archivio[m] && stime[m]) return `<div title="${escapeHtml(monthLabel(m))} · stima ≈ ${escapeHtml(euro(stime[m].netto))}"><i class="s" style="height:${Math.max(3, Math.round(stime[m].netto / max * 64))}px"></i><span>${shortLbl}</span></div>`;
      const quota = n ? Math.min(100, Math.round(o / n * 100)) : 0;
      const rimbNote = rimb ? ` · netto ${escapeHtml(euro(n))} (escluso rimborso IRPEF/730 di ${escapeHtml(euro(rimb))})` : '';
      return `<div title="${escapeHtml(isBustaTfr(m) ? `Liquidazione TFR (${monthLabel(m)})` : monthLabel(m))}${rimbNote}${o ? ` · straordinari ${escapeHtml(euro(o))}` : ''}"><i class="${!state.archivio[m] ? 'v' : stato(m) === 'diff' ? 'r' : ''}" style="height:${state.archivio[m] ? Math.max(3, Math.round(n / max * 64)) : 2}px">${quota ? `<b style="height:${quota}%"></b>` : ''}</i><span>${shortLbl}</span></div>`;
    }).join('');
    const nomeRiga = m => isBustaTfr(m) ? `Liquidazione TFR (${monthLabel(m).split(' ')[0]})` : isMensilitaExtra(m) ? monthLabel(m).replace(/\s+\d{4}$/, '') : monthLabel(m).split(' ')[0];
    const listaStime = stimeAnno.slice().reverse().map(m => `<div class="yr yr-stima"><i class="dot" style="--c:var(--amber)"></i><button type="button" class="mm" data-apri="stima:${m}">${escapeHtml(nomeRiga(m))} <span class="stima-tag">stima</span></button><span class="num">≈ ${eurv(stime[m].netto)}</span><span></span></div>`).join('');
    const lista = listaStime + delAnno.slice().reverse().map(m => `<div class="yr"><i class="dot" style="--c:${COLORE[stato(m)]}"></i><button type="button" class="mm" data-apri="${m}">${escapeHtml(nomeRiga(m))}</button><span class="num">${eurv(state.archivio[m].totals?.netto)}</span><button type="button" class="x" data-togli="${m}" aria-label="Togli la busta di ${escapeHtml(monthLabel(m).toLowerCase())}">✕</button></div>`).join('');
    const voci = new Map();
    delAnno.forEach(m => (state.archivio[m].voci || []).forEach(v => {
      if (!v.code) return;
      const x = voci.get(v.code) || { code: v.code, description: v.description, quantity: 0, amount: 0, mesi: 0 };
      x.quantity += Number(v.quantity) || 0; x.amount += Number(v.amount) || 0; x.mesi += 1; voci.set(v.code, x);
    }));
    // per valore: prima gli importi positivi dal piu' alto, i negativi (ritenute) per ultimi
    const righeVoci = [...voci.values()].sort((a, b) => b.amount - a.amount).map(v => `<tr><td>${escapeHtml(v.code)}<small>${escapeHtml(v.description || '')}</small></td><td class="num">${v.quantity ? number(v.quantity, 2) : '—'}</td><td class="num">${eurv(v.amount)}</td><td class="num">${v.mesi}</td></tr>`).join('');
    els.titolo.textContent = `Anno ${state.anno}`;
    els.anno.innerHTML = `<div class="sel">${anni.map(a => `<button type="button" class="chip${a === state.anno ? ' on' : ''}" data-anno="${a}">${a}</button>`).join('')}</div>`
      + `<p class="msub">${delAnno.length} ${delAnno.length === 1 ? 'busta' : 'buste'} · netto mese per mese (rosso: differenze con la Distinta)</p>`
      + `<div class="spark" aria-hidden="true">${barre}</div><p class="legenda"><i class="q q-n"></i>netto (esclusi rimborsi IRPEF) <i class="q q-s"></i>di cui straordinari${stimeAnno.length ? ' <i class="q q-st"></i>stima' : ''}${totStraord ? ` · <b class="num">${eurv(totStraord)}</b> nell'anno (${Math.round(totStraord / (totNettoGrafico || 1) * 100)}% del netto)` : ''}</p>${tilesHtml(tot)}${totStime ? `<p class="msub">Con ${stimeAnno.length === 1 ? 'la stima' : `le ${stimeAnno.length} stime`}: netto dell'anno ≈ ${eurv(tot.netto + totStime)}</p>` : ''}<div class="ylist">${lista}</div>`
      + (righeVoci ? `<details class="altre"><summary>Totali per voce nel ${state.anno} ▾</summary><div class="vwrap"><table class="vtab"><thead><tr><th>Voce</th><th>Quantità</th><th>Importo</th><th>Mesi</th></tr></thead><tbody>${righeVoci}</tbody></table></div></details>` : '');
  }

  function resolveFeriePermessiForMonth(meseIso, sel, chiavi) {
    const direct = sel?.busta?.feriePermessi || sel?.busta?.intestazione?.feriePermessi;
    if (direct && !state.corrente?.startsWith('stima:')) return direct;
    const anno = String(meseIso || '').slice(0, 4);
    const meseRif = String(meseIso || '').endsWith('-14') ? `${anno}-07` : String(meseIso || '').endsWith('-13') ? `${anno}-12` : meseIso;
    const r2 = n => Math.round(n * 100) / 100;
    const delAnno = chiavi.filter(k => k.startsWith(anno + '-') && !isMensilitaExtra(k) && k <= meseRif);
    if (!delAnno.length) return direct || null;
    // Se e' una stima (es. stima:2026-11), parti dall'ultima busta reale dell'anno e aggiungi 1 mese di maturazione (+2,08 gg ferie, +2,60 h ex fest.)
    const lastKey = delAnno[delAnno.length - 1];
    const lastFp = state.buste[lastKey]?.busta?.feriePermessi || state.buste[lastKey]?.busta?.intestazione?.feriePermessi;
    if (lastFp && state.corrente?.startsWith('stima:')) {
      const fMat = r2((lastFp.ferie?.maturato || 0) + 2.08);
      const fGod = lastFp.ferie?.goduti || 0;
      const fAp = lastFp.ferie?.residuoAP || 0;
      const exMat = r2((lastFp.exFest?.maturato || 0) + 2.60);
      const exGod = lastFp.exFest?.goduti || 0;
      const exAp = lastFp.exFest?.residuoAP || 0;
      return {
        isStima: true,
        ferie: { residuoAP: lastFp.ferie?.residuoAP ?? null, maturato: fMat, goduti: lastFp.ferie?.goduti ?? null, residue: r2(fAp + fMat - fGod), unit: 'gg' },
        bancaOre: lastFp.bancaOre ? { ...lastFp.bancaOre } : null,
        exFest: { residuoAP: lastFp.exFest?.residuoAP ?? null, maturato: exMat, goduti: lastFp.exFest?.goduti ?? null, residue: r2(exAp + exMat - exGod), unit: 'ore' }
      };
    }
    return lastFp || null;
  }

  function renderIntestazione() {
    if (!els.intestazione) return;
    const chiavi = chiaviOrdinate();
    if (!chiavi.length) { els.intestazione.hidden = true; els.intestazione.innerHTML = ''; return; }
    const wasMoreOpen = Boolean(els.intestazione.querySelector('.vb-more')?.open);
    const base = {};
    chiavi.forEach(k => {
      Object.assign(base, state.buste[k]?.busta?.intestazione || {});
    });
    const selKey = state.corrente && state.buste[state.corrente] ? state.corrente : chiavi[chiavi.length - 1];
    const sel = state.buste[selKey];
    const h = { ...base, ...(sel?.busta?.intestazione || {}) };
    if (!Object.keys(h).length) { els.intestazione.hidden = true; els.intestazione.innerHTML = ''; return; }
    const meseIso = state.corrente?.startsWith('stima:') ? state.corrente.slice(6) : (sel?.bustaMonth || selKey || '');
    const fp = resolveFeriePermessiForMonth(meseIso, sel, chiavi);
    const mMatch = /^(\d{4})-(\d{2})$/.exec(meseIso);
    const emMM = mMatch ? (mMatch[2] === '14' ? '07' : mMatch[2] === '13' ? '12' : mMatch[2]) : '';
    const meseComp = mMatch ? `${emMM} · ${mMatch[2]}.${mMatch[1]}` : (h.meseCompetenza || '—');
    const nomePulito = String(h.cognomeNome || '').replace(new RegExp(`^${h.codice}\\s+`), '').trim() || '—';
    const fmtFp = (v, u) => v === null || v === undefined ? '—' : `${number(v, 2)} ${u}`;
    const ORE_GIORNO_39H = 39 / 6; // 6,50 ore/giorno (CCNL 39h/settimana su 6 giorni)
    const isTfrSel = !state.corrente?.startsWith('stima:') && isBustaTfr(sel);
    const tfrObj = sel?.busta?.tfr || sel?.busta?.intestazione?.tfr || null;
    const tfrMini = tfrObj
      ? (tfrObj.liquidato
        ? `<span>· 🏦 TFR liquidato <b class="eurv">${escapeHtml(euro(tfrObj.liquidato))}</b></span>`
        : tfrObj.progressivo
          ? `<span>· 🏦 Fondo TFR <b class="eurv">${escapeHtml(euro(tfrObj.progressivo))}</b>${tfrObj.mese ? ` (+<span class="eurv">${escapeHtml(euro(tfrObj.mese))}</span>)` : ''}</span>`
          : '')
      : '';
    let fpHtml = '';
    if (isTfrSel) {
      const liq = tfrObj?.liquidato || sel?.busta?.totals?.competenze || 0;
      const irpef = tfrObj?.ritenutaIrpef || sel?.busta?.totals?.ritenute || 0;
      const netto = sel?.busta?.totals?.netto || 0;
      fpHtml = `<div class="vb-fp-single"><div class="vb-fp-main"><small>🏦 Liquidazione TFR fine contratto</small><b class="eurv">${escapeHtml(euro(netto))}</b><em>(lordo <span class="eurv">${escapeHtml(euro(liq))}</span> · IRPEF −<span class="eurv">${escapeHtml(euro(irpef))}</span>${tfrObj?.aliquota ? ` al ${number(tfrObj.aliquota, 0)}%` : ''})</em></div><div class="vb-fp-mini"><span>Contratto cessato il <b>${escapeHtml(h.dataScadenzaContratto || '30-11-2025')}</b> · Ferie, Banca ore ed Ex festività già liquidate</span></div></div>`;
    } else if (fp) {
      const ferieGg = Number(fp.ferie?.residue ?? fp.ferie?.maturato ?? 0) || 0;
      const bancaOre = Number(fp.bancaOre?.residue ?? fp.bancaOre?.maturato ?? 0) || 0;
      const exFestOre = Number(fp.exFest?.residue ?? fp.exFest?.maturato ?? 0) || 0;
      const totOre = Math.round((bancaOre + exFestOre) * 100) / 100;
      const ggDaOre = Math.round((totOre / ORE_GIORNO_39H) * 100) / 100;
      const totGg = Math.round((ferieGg + ggDaOre) * 100) / 100;
      const sett = Math.floor(Math.max(0, totGg) / 6);
      const restoGg = Math.round((Math.max(0, totGg) - sett * 6) * 100) / 100;
      fpHtml = `<div class="vb-fp-single"><div class="vb-fp-main"><small>🏖 Totale Ferie da utilizzare</small><b>${escapeHtml(fmtFp(totGg, 'gg'))}</b><em>(${sett} sett. + ${escapeHtml(number(restoGg, 2))} gg · 39h/sett${fp.isStima ? ' · stima' : ''})</em></div><div class="vb-fp-mini"><span>Ferie <b>${escapeHtml(fmtFp(ferieGg, 'gg'))}</b></span><span>· Banca ore <b>${escapeHtml(fmtFp(bancaOre, 'h'))}</b></span><span>· Ex festività <b>${escapeHtml(fmtFp(exFestOre, 'h'))}</b></span><span>(${escapeHtml(fmtFp(totOre, 'h'))} ÷ 6,5 = <b>+${escapeHtml(fmtFp(ggDaOre, 'gg'))}</b>)</span>${tfrMini}</div></div>`;
    }
    const pills = [
      h.qualifica ? `<span class="vb-mpill"><b>${escapeHtml(h.qualifica)}</b>${h.livello ? ` · Liv. ${escapeHtml(h.livello)}` : ''}${h.parametro ? ` · Par. ${escapeHtml(h.parametro)}` : ''}</span>` : '',
      h.filiale || h.reparto ? `<span class="vb-mpill">📍 <b>${escapeHtml(h.filiale || '—')}</b>${h.reparto ? ` · ${escapeHtml(h.reparto)}` : ''}</span>` : '',
      h.dataScadenzaContratto ? `<span class="vb-mpill">⏳ Scad. <b class="num">${escapeHtml(h.dataScadenzaContratto)}</b></span>` : ''
    ].filter(Boolean).join('');
    const dItem = (lbl, val) => val ? `<div><small>${escapeHtml(lbl)}</small><b class="num">${escapeHtml(val)}</b></div>` : '';
    const moreHtml = `<details class="vb-more"${wasMoreOpen ? ' open' : ''}><summary>Dettagli anagrafici e previdenziali ▾</summary><div class="vb-more-grid">`
      + dItem('Codice Fiscale', h.codiceFiscale)
      + dItem('Data Nascita', h.dataNascita)
      + dItem('Assunzione', h.dataAssunzione)
      + dItem('Anzianità AA/MM', h.anzianitaServizio)
      + dItem('Prossimo Scatto', h.dataProssimoScatto)
      + dItem('Contratto', [h.contratto, h.tipoRapporto].filter(Boolean).join(' · '))
      + dItem('Azienda / P.IVA', `${h.azienda || 'G.G.N.L.'} (${h.cfAzienda || '—'})`)
      + dItem('INPS / INAIL', `${h.posInps || '—'} · ${h.posInail || '—'} (Sede ${h.sedeInail || '—'})`)
      + `</div></details>`;
    els.intestazione.hidden = false;
    els.intestazione.innerHTML = `<div class="vb-head-card">`
      + `<div class="vb-prof-row"><div class="vb-prof-main">${h.codice ? `<span class="vb-matr">#${escapeHtml(h.codice)}</span>` : ''}<span class="vb-nome">${escapeHtml(nomePulito)}</span><div class="vb-meta-pills">${pills}</div></div><div class="vb-prof-right"><span class="vb-comp-badge">Comp. ${escapeHtml(meseComp)}</span></div></div>`
      + fpHtml
      + moreHtml
      + `</div>`;
  }

  function renderBuste(data, calculator) {
    if (!els.buste) return;
    const chiavi = chiaviOrdinate().slice().reverse();
    const statoItem = it => isSenzaDistinta(it?.bustaMonth) ? 'ok' : (data && calculator ? statoMese(confronta(it, data, calculator)) : 'ok');
    const perAnno = new Map();
    chiavi.forEach(k => {
      const it = state.buste[k];
      const y = (it?.bustaMonth || '').slice(0, 4) || 'Altre';
      if (!perAnno.has(y)) perAnno.set(y, []);
      const t = it?.busta?.totals || {};
      const nVoci = (it?.busta?.voci || []).length;
      const sub = [
        t.competenze ? `lordo ${euro(t.competenze)}` : '',
        t.ritenute ? `rit. −${euro(Math.abs(t.ritenute))}` : '',
        nVoci ? `${nVoci} voci` : ''
      ].filter(Boolean).join(' · ');
      perAnno.get(y).push(`<div class="yr"><i class="dot" style="--c:${COLORE[statoItem(it)]}"></i><button type="button" class="mm" data-apri="${escapeHtml(k)}">${escapeHtml(nomeBusta(it))}${sub ? `<span class="vb-busta-sub num">${escapeHtml(sub)}</span>` : ''}</button><span class="num">${eurv(t.netto)}</span><button type="button" class="x" data-togli="${escapeHtml(k)}" aria-label="Togli la busta di ${escapeHtml(nomeBusta(it).toLowerCase())}">✕</button></div>`);
    });
    const elencoHtml = perAnno.size
      ? [...perAnno.entries()].map(([y, rows]) => `<p class="grp">Buste caricate · ${escapeHtml(y)} (${rows.length})</p><div class="ylist">${rows.join('')}</div>`).join('')
      : '<p class="msub">Nessuna busta paga ancora caricata.</p>';
    els.titolo.textContent = `Buste paga (${chiavi.length})`;
    els.buste.innerHTML = `<label class="drop" id="vbFileLabel" for="vbFileInput"><b>＋ Carica le buste paga</b>PDF INAZ, anche più di uno.<br>Ogni busta si confronta con la Distinta del mese prima.</label>`
      + `<p class="vb-info" id="vbFileInfo" aria-live="polite">${escapeHtml(state.fileInfo || '')}</p>`
      + elencoHtml;
  }

  async function render() {
    const vuoto = !Object.keys(state.buste).length;
    const activeTab = vuoto ? 'buste' : state.tab;
    if (els.intestazione && (vuoto || activeTab === 'buste')) { els.intestazione.hidden = true; els.intestazione.innerHTML = ''; }
    els.tabs.hidden = false;
    if (els.meseNav) els.meseNav.hidden = vuoto || activeTab !== 'confronto';
    $('vbTabConfronto')?.setAttribute('aria-selected', String(activeTab === 'confronto'));
    $('vbTabAnno')?.setAttribute('aria-selected', String(activeTab === 'anno'));
    $('vbTabBuste')?.setAttribute('aria-selected', String(activeTab === 'buste'));
    els.confronto.hidden = activeTab !== 'confronto';
    els.anno.hidden = activeTab !== 'anno';
    if (els.buste) els.buste.hidden = activeTab !== 'buste';
    const data = await ensureData();
    const alerts = [...data.warnings];
    const calculator = window.NaviDistintaTotals.create({ storage: localStorage });
    if (activeTab === 'buste') {
      renderBuste(data, calculator);
    } else if (!vuoto) {
      if (activeTab === 'anno') renderAnno(data, calculator); else renderConfronto(data, calculator, alerts);
      renderIntestazione();
    }
    setAlerts(alerts);
  }
  const ridisegna = () => render().catch(error => console.error('Verifica busta', error));

  async function onFile() {
    const files = [...(els.fileInput.files || [])];
    if (!files.length) return;
    $('vbFileLabel')?.classList.add('is-busy');
    const errori = [];
    let ultima = '';
    for (const file of files) {
      state.fileInfo = `Leggo ${file.name}…`;
      const infoEl = $('vbFileInfo'); if (infoEl) infoEl.textContent = state.fileInfo;
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
    state.fileInfo = errori.length ? `Non riesco a leggere: ${errori.join(', ')}.` : '';
    $('vbFileLabel')?.classList.remove('is-busy');
    els.fileInput.value = '';
    await render();
  }

  function init() {
    if (!agent?.id) { els.login.hidden = false; els.fileInput.disabled = true; return; }
    els.fileInput.addEventListener('change', onFile);
    // Nascondi cifre: sfoca tutti gli importi in euro (scelta ricordata sul dispositivo)
    const BLUR_KEY = 'navisuite.verificaBusta.nascondi';
    const blur = on => {
      document.body.classList.toggle('vb-blur', on);
      document.querySelectorAll('[data-vb-blur]').forEach(b => {
        b.textContent = on ? '👁' : '🙈';
        b.title = on ? 'Mostra cifre' : 'Nascondi cifre';
        b.setAttribute('aria-pressed', String(on));
      });
      try { localStorage.setItem(BLUR_KEY, on ? '1' : '0'); } catch (_) {}
    };
    try { blur(localStorage.getItem(BLUR_KEY) === '1'); } catch (_) { blur(false); }
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-vb-blur]');
      if (b) { e.stopPropagation(); blur(!document.body.classList.contains('vb-blur')); }
    });
    $('vbTabConfronto')?.addEventListener('click', () => { state.tab = 'confronto'; ridisegna(); });
    $('vbTabAnno')?.addEventListener('click', () => { state.tab = 'anno'; ridisegna(); });
    $('vbTabBuste')?.addEventListener('click', () => { state.tab = 'buste'; ridisegna(); });
    els.confronto.addEventListener('click', e => {
      const copia = e.target.closest('[data-copia]'); if (copia) { navigator.clipboard?.writeText(copia.dataset.copia).then(() => { copia.textContent = '✓ Copiato'; }).catch(() => {}); return; }
      const allinea = e.target.closest('[data-allinea-corr]'); if (allinea) { e.stopPropagation(); allineaVoce(allinea.dataset.corrMese, allinea.dataset.allineaCorr); return; }
      const sposta = e.target.closest('[data-sposta-corr]'); if (sposta) { e.stopPropagation(); apriModalSpostaONota(sposta.dataset.corrMese, sposta.dataset.spostaCorr, 'sposta'); return; }
      const notaBtn = e.target.closest('[data-nota-corr]'); if (notaBtn) { e.stopPropagation(); apriModalSpostaONota(notaBtn.dataset.corrMese, notaBtn.dataset.notaCorr, 'nota'); return; }
      const annulla = e.target.closest('[data-annulla-corr]'); if (annulla) { e.stopPropagation(); annullaVoce(annulla.dataset.corrMese, annulla.dataset.annullaCorr); return; }
      const allineaTutto = e.target.closest('[data-allinea-tutto]'); if (allineaTutto) { allineaTuttoMese(allineaTutto.dataset.allineaTutto); return; }
      const annullaTutto = e.target.closest('[data-annulla-tutto]'); if (annullaTutto) { annullaTuttoMese(annullaTutto.dataset.annullaTutto); return; }
      const mese = e.target.closest('[data-mese]'); if (mese && mese.dataset.mese) { state.corrente = mese.dataset.mese; ridisegna(); return; }
      const voce = e.target.closest('.voce'); if (voce) voce.setAttribute('aria-expanded', String(voce.getAttribute('aria-expanded') !== 'true'));
    });
    els.meseNav?.addEventListener('click', e => {
      const mese = e.target.closest('[data-mese]');
      if (mese && mese.dataset.mese) { state.corrente = mese.dataset.mese; ridisegna(); }
    });
    els.meseNav?.addEventListener('change', e => {
      const sel = e.target.closest('[data-mese-select]');
      if (sel && sel.value) { state.corrente = sel.value; ridisegna(); }
    });
    const onListaClick = e => {
      const a = e.target.closest('[data-apri]'), t = e.target.closest('[data-togli]'), y = e.target.closest('[data-anno]');
      if (a) { state.corrente = a.dataset.apri; state.tab = 'confronto'; ridisegna(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      if (t) togliBusta(t.dataset.togli);
      if (y) { state.anno = y.dataset.anno; ridisegna(); }
    };
    els.anno.addEventListener('click', onListaClick);
    els.buste?.addEventListener('click', onListaClick);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { caricaCorrezioni(); ricarica(); } });
    caricaCorrezioni();
    caricaArchivio();
    ridisegna();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
