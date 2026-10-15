// Confronto busta paga INAZ <-> Distinta. Tutta la mappatura voce -> riga
// della Distinta sta nella tabella RULES qui sotto. Modulo puro (nessun DOM).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NaviBustaCompare = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const HOURS_TOLERANCE = 0.02; // ~1 minuto
  const COUNT_TOLERANCE = 0.001;
  const EURO_TOLERANCE = 0.02;
  // Tolleranza relativa: differenze fino al 10% del valore (ore, giorni o euro) contano come coerenti.
  const RELATIVE_TOLERANCE = 0.10;
  // la tolleranza si puo' scegliere (0, 5 o 10%): compare(busta, distinta, { tolleranza: 0.05 })
  let tolleranzaAttiva = RELATIVE_TOLERANCE;
  const entro = (diff, riferimento, assoluta) => Math.abs(diff) <= Math.max(assoluta, Math.abs(riferimento) * tolleranzaAttiva) + 1e-9;

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
    { id: 'embark', codes: ['43X'], label: 'Indennità imbarco', distintaLabel: 'Giorni con imbarco', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => mese(t).embark },
    { id: 'sunday', codes: ['47X'], label: 'Indennità prestazione domenicale', distintaLabel: 'Domeniche lavorate', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => mese(t).sundayShift },
    { id: 'cash', codes: ['FC0'], label: 'Maneggio denaro', distintaLabel: 'Giorni con maneggio denaro senza imbarco', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => mese(t).cashHandlingGround },
    { id: 'overnight40', codes: ['FC1'], label: 'Pernottazione navigante 40%', distintaLabel: 'Giorni con pernotto 40%', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => mese(t).overnight40 },
    { id: 'bank', codes: ['594'], label: 'Banca ore maturata', distintaLabel: 'Banca ore', unit: 'ore', certainty: 'certa', source: 'quantity', distinta: t => t.bankMinutes / 60 },
    { id: 'allowance24', codes: ['13X', '18X', '28Y', '29Y'], label: 'Diarie 24%', distintaLabel: 'Giorni con diaria 24% + trasferte 50%', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => mese(t).allowance24 + (mese(t).travel50 || 0) },
    // 013 e' in ore (busta di settembre 2026: 9,9167 h senza festivita' nel mese): mancato riposo + ore lavorate nelle festivita'.
    { id: 'holiday', codes: ['013'], label: 'Lavoro in FI-FN (festività e mancato riposo)', distintaLabel: 'Ore di mancato riposo e ore lavorate nelle festività', unit: 'ore', certainty: t => (mese(t).holiday ? 'confermare' : 'certa'), source: 'quantity', distinta: t => ((mese(t).missedRestMinutes || 0) + (mese(t).holidayMinutes || 0)) / 60, notes: t => (mese(t).holiday ? [`Comprende ${mese(t).holiday === 1 ? 'una festività lavorata' : `${mese(t).holiday} festività lavorate`}: controlla che la busta le paghi con 013.`] : []) },
    { id: 'dailyDM', codes: ['49X'], label: 'Indennità prestazione giornaliera D.M.', distintaLabel: 'Giorni con maneggio denaro (Ind. giorn. D.M.)', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => mese(t).cashHandling, notes: () => ['Giorni con maneggio denaro nel mese di calendario, come le altre competenze.'] },
    { id: 'secondTicket', codes: ['70X'], label: '2 ticket inps/fisc.', distintaLabel: 'Giorni con secondo ticket', unit: 'ticket', certainty: 'certa', source: 'quantityOrFigurative', distinta: t => mese(t).secondMeal },
    { id: 'ticket', codes: ['1TK'], label: 'Ticket elettronico', distintaLabel: 'Ticket non usati (da accreditare)', unit: 'ticket', certainty: 'confermare', source: 'quantityOrFigurative', distinta: t => mese(t).ticketCredit }
  ];

  // 55Y paga le ore a parametro 139, 56Y toglie le stesse ore a parametro 121: il valore vero e' la differenza.
  function differenzaPaga(voci, ore) {
    const p139 = voci.filter(v => ['55Y', '56Y'].includes(v.code) && /139/.test(v.description || ''));
    const p121 = voci.filter(v => ['55Y', '56Y'].includes(v.code) && !/139/.test(v.description || ''));
    if (!p139.length || !p121.length) return {};
    const base = (p139[0].base || 0) - (p121[0].base || 0);
    return { base: round2(base * 100000) / 100000, importo: round2(sum([...p139, ...p121].map(v => Number(v.amount) || 0))), importoDistinta: round2(ore * base) };
  }

  const ruleMatches = (rule, voce) => rule.codes.includes(voce.code) && (!rule.filter || rule.filter(voce));

  const NOT_COMPARED_REASON = 'La Distinta non ha una riga equivalente.';
  // Le voci gia' usate da una regola (es. 55Y con "139") non compaiono qui.
  const NOT_COMPARED = [
    { codes: ['55Y', '56Y'], label: 'Ore differenza paga' },
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
    const voci = Array.isArray(busta?.voci) ? busta.voci : [];
    const totals = distinta || {};
    const rows = [];
    RULES.forEach(rule => {
      const fromBusta = bustaValue(rule, voci);
      const distintaValue = round2(Number(rule.distinta(totals)) || 0);
      const bustaNumber = fromBusta.present ? fromBusta.value : 0;
      // Voce assente in entrambe: nessuna riga.
      if (!fromBusta.present && !distintaValue) return;
      const tolerance = rule.unit === 'ore' ? HOURS_TOLERANCE : COUNT_TOLERANCE;
      const diff = round2(distintaValue - bustaNumber);
      const exact = Math.abs(diff) <= tolerance + 1e-9;
      const dp = rule.id === 'cashEmbark' ? differenzaPaga(voci, distintaValue) : {};
      const baseEuro = dp.base ?? fromBusta.base;
      const euroDiff = baseEuro !== null && baseEuro !== undefined ? round2(diff * baseEuro) : null;
      // Differenze trascurabili (sotto 1 ora o sotto 1 euro) non sono errori, con qualunque tolleranza
      const trascurabile = (rule.unit === 'ore' && Math.abs(diff) < 1) || (euroDiff !== null && Math.abs(euroDiff) < 1);
      const equal = entro(diff, bustaNumber || distintaValue, tolerance) || trascurabile;
      const certainty = typeof rule.certainty === 'function' ? rule.certainty(totals) : rule.certainty;
      const status = equal ? 'ok' : (certainty === 'certa' ? 'diff' : 'check');
      const euro = !equal ? euroDiff : null;
      const notes = [];
      if (!fromBusta.present) notes.push('Voce assente in busta, ma presente nella Distinta.');
      else if (!distintaValue && bustaNumber) notes.push('Voce presente in busta, ma non risulta nella Distinta.');
      if (!equal && euro === null) notes.push(fromBusta.present ? 'Importo non stimabile: la busta non riporta un dato base.' : 'Importo non stimabile senza il dato base della busta.');
      if (equal && !exact) notes.push(trascurabile && !entro(diff, bustaNumber || distintaValue, tolerance) ? 'Differenza trascurabile (sotto 1 ora o sotto 1 €).' : `Differenza entro la tolleranza del ${Math.round(tolleranzaAttiva * 100)}%.`);
      if (fromBusta.baseNote) notes.push(fromBusta.baseNote);
      if (typeof rule.notes === 'function') notes.push(...rule.notes(totals, voci));
      rows.push({
        id: rule.id,
        codes: rule.codes.slice(),
        label: rule.label,
        distintaLabel: rule.distintaLabel,
        unit: rule.unit,
        certainty,
        busta: fromBusta.present ? fromBusta.value : null,
        distinta: distintaValue,
        diff,
        status,
        base: fromBusta.base,
        euro,
        euroText: euroText(euro),
        trascurabile,
        // Valore in busta: importo delle voci; per il ticket elettronico (1TK) e' il dato figurativo (ticket x 8 euro)
        importo: fromBusta.present ? round2(sum(fromBusta.voci.map(voce => Number(voce.amount) || (Number.isFinite(voce.figurative) ? voce.figurative : 0)))) : null,
        // Valore atteso dalla Distinta: quantita' della Distinta x dato base della busta
        importoDistinta: fromBusta.base !== null ? round2(distintaValue * fromBusta.base) : null,
        ...(dp.importo !== undefined ? { importo: dp.importo, importoDistinta: dp.importoDistinta } : {}),
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
  function confronta(distinta, busta) {
    const result = compare(Array.isArray(busta) ? { voci: busta } : busta, distinta);
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

  function knownCodes() {
    return new Set([...RULES.flatMap(rule => rule.codes), ...NOT_COMPARED.flatMap(item => item.codes)]);
  }

  return { RULES, NOT_COMPARED, NOT_COMPARED_REASON, RELATIVE_TOLERANCE, HOURS_TOLERANCE, COUNT_TOLERANCE, EURO_TOLERANCE, compare, confronta, coherence, euroText, knownCodes };
});
