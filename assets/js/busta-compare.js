// Confronto busta paga INAZ <-> Distinta. Tutta la mappatura voce -> riga
// della Distinta sta nella tabella RULES qui sotto. Modulo puro (nessun DOM).
(function (root, factory) {
  const ccnlModule = (typeof require !== 'undefined')
    ? (function () { try { return require('./ccnl-config.js'); } catch (_) { return null; } })()
    : null;
  const api = factory(ccnlModule);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NaviBustaCompare = api;
})(typeof window !== 'undefined' ? window : globalThis, function (ccnlModule) {
  const HOURS_TOLERANCE = 0.02; // ~1 minuto
  const COUNT_TOLERANCE = 0.001;
  const EURO_TOLERANCE = 0.02;
  // Tolleranza relativa: differenze fino al 10% del valore (ore, giorni o euro) contano come coerenti.
  const RELATIVE_TOLERANCE = 0.10;
  // la tolleranza si puo' scegliere (0, 5 o 10%): compare(busta, distinta, { tolleranza: 0.05 })
  let tolleranzaAttiva = RELATIVE_TOLERANCE;
  const entro = (diff, riferimento, assoluta) => Math.abs(diff) <= Math.max(assoluta, Math.abs(riferimento) * tolleranzaAttiva) + 1e-9;

  const getCcnl = () => {
    if (ccnlModule && typeof ccnlModule.calcolaVoceAttesa === 'function') return ccnlModule;
    if (typeof window !== 'undefined' && window.NaviCCNLConfig) return window.NaviCCNLConfig;
    if (typeof globalThis !== 'undefined' && globalThis.NaviCCNLConfig) return globalThis.NaviCCNLConfig;
    return null;
  };

  const calcolaAttesa = (code, qty, param, scatti) => {
    const mod = getCcnl();
    if (mod && typeof mod.calcolaVoceAttesa === 'function') {
      return mod.calcolaVoceAttesa(code, qty, param, scatti);
    }
    if (typeof calcolaVoceAttesa === 'function') {
      return calcolaVoceAttesa(code, qty, param, scatti);
    }
    return null;
  };

  function leggiParametro(opzioni = {}) {
    if (opzioni.parametro !== undefined && opzioni.parametro !== null && opzioni.parametro !== '') {
      return Number(opzioni.parametro) || 139;
    }
    if (typeof document !== 'undefined') {
      const el = document.getElementById('vbParametro');
      if (el && el.value) return Number(el.value) || 139;
    }
    return 139;
  }

  function leggiScatti(opzioni = {}) {
    if (opzioni.scatti !== undefined && opzioni.scatti !== null && opzioni.scatti !== '') {
      return Number(opzioni.scatti) || 0;
    }
    if (typeof document !== 'undefined') {
      const el = document.getElementById('vbScatti');
      if (el && el.value !== undefined) return Number(el.value) || 0;
    }
    return 0;
  }

  // certainty 'certa': una differenza e' un errore; 'confermare': da verificare
  // (puo' anche essere una funzione dei totali della Distinta).
  // source: 'quantity' (colonna Ore/Giorni/Num.) oppure 'quantityOrFigurative'.
  // filter: condizione in piu' sulla voce (oltre al codice).
  // Parametro 139 = bigliettaio con maneggio denaro (altrimenti 121): da
  // imbarcato il maneggio si paga come differenza paga 121->139 sulle ore del
  // turno (D.P. Ore diff.paga 139B) e sullo straordinario (01Y D.P.lav.str.
  // Qu.139B, stesse ore di 334, non ore in piu'); a terra con FC0.
  // Giornate: solo i giorni del mese di calendario (senza il riporto RIP); se mancano, i totali delle settimane.
  const mese = t => t.calendar || t;
  const RULES = [
    // 334 = straordinario a parametro 121, 01Y = straordinario a parametro 139 (maneggio da imbarcato):
    // sono ore diverse e si sommano (nelle buste di luglio e agosto 2026 c'e' solo 01Y).
    { id: 'overtime', codes: ['334', '01Y'], label: 'Straordinari', distintaLabel: 'Straordinari (oltre 39 h a settimana)', unit: 'ore', certainty: 'certa', source: 'quantity', distinta: t => t.overtimeMinutes / 60, notes: (t, voci) => { const ore = code => voci.filter(v => v.code === code).reduce((n, v) => n + (Number(v.quantity) || 0), 0); const a = ore('334'), b = ore('01Y'); return a && b ? [`In busta: ${String(Math.round(a * 100) / 100).replace('.', ',')} h a parametro 121 (334) + ${String(Math.round(b * 100) / 100).replace('.', ',')} h a parametro 139 (01Y).`] : []; } },
    { id: 'cashEmbark', codes: ['55Y', '56Y'], filter: voce => /139/.test(voce.description || ''), label: 'Ore differenza paga 139 (maneggio da imbarcato)', distintaLabel: 'Ore lavorate nei giorni con maneggio denaro e imbarco', unit: 'ore', certainty: 'confermare', source: 'quantity', distinta: t => mese(t).cashEmbarkServiceMinutes / 60, notes: t => { const m = mese(t), h = v => `${String(Math.round((v || 0) / 60 * 100) / 100).replace('.', ',')} h`; return [`Da confermare\n${m.cashEmbarkDays || 0} giorni con cassa a bordo\nturno ${h(m.cashEmbarkShiftMinutes)} · lavorate ${h(m.cashEmbarkServiceMinutes)}`]; } },
    { id: 'cashGround138', codes: ['55H', '56H'], filter: voce => /138/.test(voce.description || ''), label: 'Ore differenza paga 138A (biglietteria a terra)', distintaLabel: 'Ore lavorate in biglietteria a terra (AgB / AgM / AgT)', unit: 'ore', certainty: 'certa', source: 'quantity', distinta: t => (mese(t).cashGround138Minutes || 0) / 60, notes: t => { const m = mese(t), h = v => `${String(Math.round((v || 0) / 60 * 100) / 100).replace('.', ',')} h`; return m.cashGround138Days ? [`${m.cashGround138Days} ${m.cashGround138Days === 1 ? 'giorno' : 'giorni'} in biglietteria a terra · turno ${h(m.cashGround138ShiftMinutes)} · lavorate ${h(m.cashGround138Minutes)}`] : []; } },
    { id: 'embark', codes: ['43X'], label: 'Indennità imbarco', distintaLabel: 'Giorni con imbarco', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => mese(t).embark },
    { id: 'rendimento', codes: ['FD0'], filter: voce => voce.quantity !== null && voce.quantity !== undefined, label: 'Indennità di rendimento (servizi a terra)', distintaLabel: 'Giorni lavorati a terra (senza imbarco)', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => mese(t).groundDays || 0 },
    { id: 'sunday', codes: ['47X', '48X'], label: 'Indennità prestazione domenicale', distintaLabel: 'Domeniche lavorate', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => mese(t).sundayShift, notes: (t, voci) => { const gg = code => voci.filter(v => v.code === code).reduce((n, v) => n + (Number(v.quantity) || 0), 0); const a = gg('47X'), b = gg('48X'); return a && b ? [`In busta: ${a} in turno (47X) + ${b} non in turno (48X).`] : b ? [`In busta: ${b} non in turno (48X).`] : []; } },
    { id: 'cash', codes: ['FC0'], label: 'Maneggio denaro', distintaLabel: 'Giorni con maneggio denaro senza imbarco', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => mese(t).cashHandlingGround },
    { id: 'overnight40', codes: ['FC1'], label: 'Pernottazione navigante 40%', distintaLabel: 'Giorni con pernotto 40%', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => mese(t).overnight40 },
    { id: 'bank', codes: ['594'], label: 'Banca ore maturata', distintaLabel: 'Banca ore', unit: 'ore', certainty: 'certa', source: 'quantity', distinta: t => t.bankMinutes / 60 },
    { id: 'allowance24', codes: ['13X', '18X', '28Y', '29Y'], label: 'Diarie 24%', distintaLabel: 'Giorni con diaria 24% + trasferte 50%', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => mese(t).allowance24 + (mese(t).travel50 || 0) },
    // 013 e' in ore (busta di settembre 2026: 9,9167 h senza festivita' nel mese): mancato riposo + ore lavorate nelle festivita'.
    { id: 'holiday', codes: ['013'], label: 'Lavoro in FI-FN (festività e mancato riposo)', distintaLabel: 'Ore di mancato riposo e ore lavorate nelle festività', unit: 'ore', certainty: t => (mese(t).holiday ? 'confermare' : 'certa'), source: 'quantity', distinta: t => ((mese(t).missedRestMinutes || 0) + (mese(t).holidayMinutes || 0)) / 60, notes: t => (mese(t).holiday ? [`Comprende ${mese(t).holiday === 1 ? 'una festività lavorata' : `${mese(t).holiday} festività lavorate`}: controlla che la busta le paghi con 013.`] : []) },
    { id: 'dailyDM', codes: ['49X'], label: 'Indennità prestazione giornaliera D.M.', distintaLabel: 'Giorni lavorati feriali (escluse le domeniche)', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => { const m = mese(t); return m.weekdayWorkedDays !== undefined ? m.weekdayWorkedDays : m.cashHandling; }, notes: t => { const m = mese(t), cal = m.weekdayWorkedDays, per = t?.weekdayWorkedDays; return cal !== undefined && per !== undefined && cal !== per ? [`Giorni lavorati feriali (non domenicali): ${cal} nel mese di calendario, ${per} nelle settimane del periodo.`] : ['Giorni lavorati feriali (escluse le domeniche, pagate con 47X/48X).']; } },
    { id: 'secondTicket', codes: ['70X'], label: '2 ticket inps/fisc.', distintaLabel: 'Giorni con secondo ticket', unit: 'ticket', certainty: 'certa', source: 'quantityOrFigurative', distinta: t => mese(t).secondMeal },
    { id: 'ticket', codes: ['1TK'], label: 'Ticket elettronico', distintaLabel: 'Ticket non usati (da accreditare)', unit: 'ticket', certainty: 'confermare', source: 'quantityOrFigurative', distinta: t => mese(t).ticketCredit }
  ];

  // 55Y/56Y (parametro 139B a bordo) e 55H/56H (parametro 138A in biglietteria a terra):
  // la 55 paga le ore al parametro superiore, la 56 toglie le stesse ore a parametro 121.
  function differenzaPaga(voci, ore, codes = ['55Y', '56Y'], re = /139/, parametro = 139, scatti = 0) {
    const sup = voci.filter(v => codes.includes(v.code) && re.test(v.description || ''));
    const p121 = voci.filter(v => codes.includes(v.code) && !re.test(v.description || ''));
    if (!sup.length || !p121.length) {
      if (codes[0] === '55Y' && sup.length) {
        const att55 = calcolaAttesa('55Y', 1, parametro, scatti);
        const att56 = calcolaAttesa('56Y', 1, parametro, scatti);
        if (att55 !== null && att56 !== null) {
          const base = round2((9.22020 - 8.34262) * 100000) / 100000;
          const matching = voci.filter(v => codes.includes(v.code));
          const importo = matching.length ? round2(sum(matching.map(v => Number(v.amount) || 0))) : undefined;
          return { base, importo, importoDistinta: round2(ore * base) };
        }
      }
      return {};
    }
    const base = (sup[0].base || 0) - (p121[0].base || 0);
    return { base: round2(base * 100000) / 100000, importo: round2(sum([...sup, ...p121].map(v => Number(v.amount) || 0))), importoDistinta: round2(ore * base) };
  }
  const diffPagaRegola = (rule, voci, ore, parametro, scatti) => rule.id === 'cashEmbark' ? differenzaPaga(voci, ore, ['55Y', '56Y'], /139/, parametro, scatti) : rule.id === 'cashGround138' ? differenzaPaga(voci, ore, ['55H', '56H'], /138/, parametro, scatti) : {};

  const ruleMatches = (rule, voce) => rule.codes.includes(voce.code) && (!rule.filter || rule.filter(voce));

  const NOT_COMPARED_REASON = 'La Distinta non ha una riga equivalente.';
  // Le voci gia' usate da una regola (es. 55Y con "139", 55H con "138", FD0 con quantita') non compaiono qui.
  const NOT_COMPARED = [
    { codes: ['55Y', '56Y', '55H', '56H'], label: 'Ore differenza paga' },
    { codes: ['FD0'], label: 'Indennità di rendimento' }
  ];

  // Voci escluse dalla coerenza quantita' x base = importo.
  const COHERENCE_EXCLUDED = /contribut|impost|inail|irpef/i;

  const round2 = value => Math.round(value * 100) / 100;
  const sum = values => values.reduce((total, value) => total + value, 0);

  function bustaValue(rule, voci) {
    const matching = voci.filter(voce => ruleMatches(rule, voce));
    if (!matching.length) return { present: false, value: null, base: null, voci: [] };
    const values = matching.map(voce => {
      if (voce.quantity !== null && voce.quantity !== undefined) return voce.quantity;
      if (rule.source === 'quantityOrFigurative' && voce.figurative !== null && voce.figurative !== undefined) return voce.figurative;
      return 0;
    });
    const withBase = matching.filter(voce => Number.isFinite(voce.base) && voce.base !== 0);
    let base = null;
    let baseNote = '';
    if (withBase.length) {
      const bases = [...new Set(withBase.map(voce => voce.base))];
      if (bases.length === 1) base = bases[0];
      else {
        const quantity = sum(withBase.map(voce => Number(voce.quantity) || 0));
        base = quantity ? sum(withBase.map(voce => (Number(voce.quantity) || 0) * voce.base)) / quantity : bases[0];
        baseNote = 'Dato base medio fra più voci.';
      }
    }
    return { present: true, value: round2(sum(values)), base, baseNote, voci: matching };
  }

  function euroText(euro) {
    if (euro === null || !Number.isFinite(euro) || Math.abs(euro) < 0.005) return '';
    const amount = Math.abs(euro).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return euro > 0 ? `In busta mancano circa ${amount} €` : `In busta ci sono circa ${amount} € in più`;
  }

  // busta: risultato di NaviBustaParser.parseItems; distinta: totals di
  // NaviDistintaTotals (compute().totals).
  function compare(busta, distinta, opzioni = {}) {
    tolleranzaAttiva = Number.isFinite(opzioni.tolleranza) ? opzioni.tolleranza : RELATIVE_TOLERANCE;
    const parametro = leggiParametro(opzioni);
    const scatti = leggiScatti(opzioni);
    const voci = Array.isArray(busta?.voci) ? busta.voci : [];
    const totals = distinta || {};
    const rows = [];
    RULES.forEach(rule => {
      const fromBusta = bustaValue(rule, voci);
      const distintaValue = round2(Number(rule.distinta(totals)) || 0);
      const distintaOriginale = totals.raw ? round2(Number(rule.distinta(totals.raw)) || 0) : distintaValue;
      const correzione = round2(distintaValue - distintaOriginale);
      const bustaNumber = fromBusta.present ? fromBusta.value : 0;
      // Voce assente in entrambe (e senza correzione applicata): nessuna riga.
      if (!fromBusta.present && !distintaValue && !correzione) return;
      const tolerance = rule.unit === 'ore' ? HOURS_TOLERANCE : COUNT_TOLERANCE;
      const diff = round2(distintaValue - bustaNumber);
      const exact = Math.abs(diff) <= tolerance + 1e-9;
      const dp = diffPagaRegola(rule, voci, distintaValue, parametro, scatti);
      let baseEuro = dp.base ?? fromBusta.base;
      if (rule.id !== 'ticket' && (baseEuro === null || baseEuro === undefined) && opzioni.parametro !== undefined) {
        for (const code of rule.codes) {
          const mod = getCcnl();
          if (mod && typeof mod.calcolaBaseOraria === 'function') {
            const b = mod.calcolaBaseOraria(code, parametro, scatti);
            if (Number.isFinite(b)) { baseEuro = b; break; }
          }
        }
      }
      const euroDiff = baseEuro !== null && baseEuro !== undefined ? round2(diff * baseEuro) : null;
      // Differenze trascurabili (sotto 1 ora o sotto 1 euro) non sono errori, con qualunque tolleranza
      const trascurabile = (rule.unit === 'ore' && Math.abs(diff) < 1) || (euroDiff !== null && Math.abs(euroDiff) < 1);
      const equal = entro(diff, bustaNumber || distintaValue, tolerance) || trascurabile;
      const certainty = typeof rule.certainty === 'function' ? rule.certainty(totals) : rule.certainty;
      const status = equal ? 'ok' : (certainty === 'certa' ? 'diff' : 'check');
      const euro = !equal ? euroDiff : null;
      const notes = [];
      if (correzione) notes.push(`Allineata alla busta: correzione ${correzione > 0 ? '+' : '−'}${String(Math.abs(correzione)).replace('.', ',')} ${rule.unit} (Distinta originaria: ${String(distintaOriginale).replace('.', ',')} ${rule.unit}).`);
      if (!fromBusta.present && distintaValue) notes.push('Voce assente in busta, ma presente nella Distinta.');
      else if (!distintaValue && bustaNumber) notes.push('Voce presente in busta, ma non risulta nella Distinta.');
      if (!equal && euro === null) notes.push(fromBusta.present ? 'Importo non stimabile: la busta non riporta un dato base.' : 'Importo non stimabile senza il dato base della busta.');
      if (equal && !exact) notes.push(trascurabile && !entro(diff, bustaNumber || distintaValue, tolerance) ? 'Differenza trascurabile (sotto 1 ora o sotto 1 €).' : `Differenza entro la tolleranza del ${Math.round(tolleranzaAttiva * 100)}%.`);
      if (fromBusta.baseNote) notes.push(fromBusta.baseNote);
      if (typeof rule.notes === 'function') notes.push(...rule.notes(totals, voci));

      const importoBusta = fromBusta.present
        ? round2(sum(fromBusta.voci.map(voce => Number(voce.amount) || (Number.isFinite(voce.figurative) ? voce.figurative : 0))))
        : null;
      let importoDistinta = fromBusta.base !== null && fromBusta.base !== undefined
        ? round2(distintaValue * fromBusta.base)
        : null;
      if (importoDistinta === null && distintaValue && opzioni.parametro !== undefined) {
        for (const code of rule.codes) {
          const att = calcolaAttesa(code, distintaValue, parametro, scatti);
          if (att !== null && Number.isFinite(att)) {
            importoDistinta = round2(att);
            break;
          }
        }
      }

      rows.push({
        id: rule.id,
        codes: rule.codes.slice(),
        label: rule.label,
        distintaLabel: rule.distintaLabel,
        unit: rule.unit,
        certainty,
        busta: fromBusta.present ? fromBusta.value : null,
        distinta: distintaValue,
        distintaOriginale,
        correzione,
        diff,
        status,
        base: fromBusta.base,
        euro,
        euroText: euroText(euro),
        trascurabile,
        importo: dp.importo !== undefined ? dp.importo : importoBusta,
        importoDistinta: dp.importoDistinta !== undefined ? dp.importoDistinta : importoDistinta,
        missing: !fromBusta.present ? 'busta' : (!distintaValue && bustaNumber ? 'distinta' : null),
        notes
      });
    });
    const order = { diff: 0, check: 1, ok: 2 };
    rows.sort((a, b) => order[a.status] - order[b.status]);

    const notCompared = [];
    NOT_COMPARED.forEach(item => {
      voci.filter(voce => item.codes.includes(voce.code) && !RULES.some(rule => ruleMatches(rule, voce))).forEach(voce => notCompared.push({ ...voce, label: item.label, reason: NOT_COMPARED_REASON }));
    });

    const summary = {
      ok: rows.filter(row => row.status === 'ok').length,
      diff: rows.filter(row => row.status === 'diff').length,
      check: rows.filter(row => row.status === 'check').length,
      notCompared: notCompared.length
    };
    return { rows, notCompared, summary, coherence: coherence(voci) };
  }

  // Coerenza interna: quantita' x dato base = importo (tolleranza 0,02 €).
  function coherence(voci) {
    return (voci || [])
      .filter(voce => Number.isFinite(voce.quantity) && Number.isFinite(voce.base) && Number.isFinite(voce.amount))
      .filter(voce => !COHERENCE_EXCLUDED.test(voce.description || ''))
      .map(voce => {
        const expected = round2(voce.quantity * voce.base);
        const actual = Math.abs(voce.amount);
        const difference = round2(actual - expected);
        return { code: voce.code, description: voce.description, quantity: voce.quantity, base: voce.base, amount: voce.amount, expected, difference, ok: entro(difference, expected, EURO_TOLERANCE) };
      });
  }

  // Riepilogo piatto: una riga per voce con Match/Mismatch. busta: { voci } oppure l'array delle voci.
  function confronta(distinta, busta, opzioni = {}) {
    const result = compare(Array.isArray(busta) ? { voci: busta } : busta, distinta, opzioni);
    return result.rows.map(row => ({
      voce: row.label,
      codici: row.codes.join(' + '),
      unita: row.unit,
      valoreDistinta: row.distinta,
      valoreBusta: row.busta,
      stato: row.status === 'ok' ? 'Match' : 'Mismatch',
      differenza: row.diff,
      daVerificare: row.status === 'check',
      importo: row.euro
    }));
  }

  // Giroconto differenza paga (56Y, 56H): in busta INAZ gonfia sia Totale Competenze (con 55Y/55H)
  // sia Totale Ritenute (con 56Y/56H), ma si annulla nel lordo mese (CN5) e nel netto.
  const isGirocontoDiffPaga = v => (['56Y', '56H'].includes(v?.code) || /tratt\.?\s*ore\s*diff\.?\s*paga/i.test(v?.description || '')) && Number(v?.amount) < 0;
  // Conguaglio 730 / rimborso IRPEF (C75, B03, ecc.): rimborso o trattenuta fiscale una tantum, fuori dal lordo mensile.
  const isConguaglio730 = v => ['B03', 'C75'].includes(v?.code) || /\b730\b|dic\.credito|irpef\s*730|rimb(?:orso)?\s*irpef/i.test(v?.description || '');
  const conguaglio730 = voci => round2(sum((voci || []).filter(isConguaglio730).map(v => Number(v.amount) || 0)));
  const girocontoDiffPaga = voci => round2(sum((voci || []).filter(isGirocontoDiffPaga).map(v => Math.abs(Number(v.amount) || 0))));

  // Stima di una busta: voci variabili = quantita' della Distinta x dato base della busta di riferimento;
  // il resto del lordo resta come nella busta di riferimento; ritenute nella stessa proporzione sul lordo.
  // ref: { voci, totals } di una busta salvata; distinta: totals di NaviDistintaTotals;
  // altreBuste: altre buste salvate da cui recuperare il prezzo base se una voce manca in ref.
  function stima(ref, distinta, altreBuste = []) {
    const voci = Array.isArray(ref?.voci) ? ref.voci : [];
    const t = ref?.totals || {};
    const giro = girocontoDiffPaga(voci);
    const c730 = conguaglio730(voci);
    const lordoRef = round2((Number(t.competenze) || 0) - giro - (c730 > 0 ? c730 : 0));
    const ritenuteRef = round2(Math.max(0, Math.abs(Number(t.ritenute) || 0) - giro - (c730 < 0 ? -c730 : 0)));
    if (lordoRef <= 0) return null;
    const righe = [];
    let variabileRef = 0, variabile = 0;
    RULES.forEach(rule => {
      const qta = round2(Number(rule.distinta(distinta || {})) || 0);
      const qtaOrig = distinta?.raw ? round2(Number(rule.distinta(distinta.raw)) || 0) : qta;
      const corr = round2(qta - qtaOrig);
      const fromBusta = bustaValue(rule, voci);
      const dp = diffPagaRegola(rule, voci, qta);
      let base = dp.base ?? fromBusta.base;
      let daMese = '';
      if ((base === null || base === undefined) && qta && Array.isArray(altreBuste)) {
        for (const altra of altreBuste) {
          const av = Array.isArray(altra?.voci) ? altra.voci : [];
          const adp = diffPagaRegola(rule, av, qta);
          const afb = bustaValue(rule, av);
          const ab = adp.base ?? afb.base;
          if (ab !== null && ab !== undefined) { base = ab; daMese = altra.mese || ''; break; }
        }
      }
      const importoRef = dp.importo ?? round2(sum(fromBusta.voci.map(v => Number(v.amount) || 0)));
      // ticket elettronico: figurativo, non entra nel netto
      if (rule.id === 'ticket') return;
      if (base === null || base === undefined) { if (qta || corr) righe.push({ id: rule.id, label: rule.label, unit: rule.unit, quantita: qta, quantitaOriginale: qtaOrig, correzione: corr, base: null, importo: null }); return; }
      const importo = round2(qta * base);
      const importoCorrezione = corr ? round2(corr * base) : 0;
      variabileRef += importoRef; variabile += importo;
      if (qta || importoRef || corr) righe.push({ id: rule.id, label: rule.label, unit: rule.unit, quantita: qta, quantitaOriginale: qtaOrig, correzione: corr, importoCorrezione, base, importo, importoRef, ...(daMese ? { daMese } : {}) });
    });
    const fisso = round2(lordoRef - variabileRef);
    const lordo = round2(fisso + variabile);
    const quota = ritenuteRef / lordoRef;
    const ritenute = round2(lordo * quota);
    const netto = round2(lordo - ritenute);
    righe.sort((a, b) => (b.importo || 0) - (a.importo || 0));
    return { righe, fisso, lordo, ritenute, netto, quotaRitenute: quota, margine: round2(Math.abs(netto) * 0.04) };
  }

  function knownCodes() {
    return new Set([...RULES.flatMap(rule => rule.codes), ...NOT_COMPARED.flatMap(item => item.codes)]);
  }

  return { RULES, NOT_COMPARED, NOT_COMPARED_REASON, RELATIVE_TOLERANCE, HOURS_TOLERANCE, COUNT_TOLERANCE, EURO_TOLERANCE, compare, confronta, stima, conguaglio730, girocontoDiffPaga, coherence, euroText, knownCodes, leggiParametro, leggiScatti, calcolaAttesa };
});
