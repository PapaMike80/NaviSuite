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

  // certainty 'certa': una differenza e' un errore; 'confermare': da verificare.
  // source: 'quantity' (colonna Ore/Giorni/Num.) oppure 'quantityOrFigurative'.
  const RULES = [
    { id: 'overtime', codes: ['334'], label: 'Straordinari', distintaLabel: 'Straordinari', unit: 'ore', certainty: 'certa', source: 'quantity', distinta: t => t.overtimeMinutes / 60 },
    { id: 'embark', codes: ['43X'], label: 'Indennità imbarco', distintaLabel: 'Giorni con imbarco', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => t.embark },
    { id: 'sunday', codes: ['47X'], label: 'Indennità prestazione domenicale', distintaLabel: 'Domeniche lavorate', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => t.sundayShift },
    { id: 'cash', codes: ['FC0'], label: 'Maneggio denaro', distintaLabel: 'Giorni con maneggio denaro', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => t.cashHandling },
    { id: 'overnight40', codes: ['FC1'], label: 'Pernottazione navigante 40%', distintaLabel: 'Giorni con pernotto 40%', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => t.overnight40 },
    { id: 'bank', codes: ['594'], label: 'Banca ore maturata', distintaLabel: 'Banca ore', unit: 'ore', certainty: 'certa', source: 'quantity', distinta: t => t.bankMinutes / 60 },
    { id: 'allowance24', codes: ['18X', '28Y', '29Y'], label: 'Diarie 24%', distintaLabel: 'Giorni con diaria 24%', unit: 'giorni', certainty: 'certa', source: 'quantity', distinta: t => t.allowance24 },
    { id: 'ticket', codes: ['1TK'], label: 'Ticket elettronico', distintaLabel: 'Ticket non usati (da accreditare)', unit: 'ticket', certainty: 'confermare', source: 'quantityOrFigurative', distinta: t => t.ticketCredit }
  ];

  const NOT_COMPARED_REASON = 'La Distinta non ha una riga equivalente.';
  const NOT_COMPARED = [
    { codes: ['013'], label: 'Lavoro in FI-FN' },
    { codes: ['01Y'], label: 'Straordinari con parametro 139' },
    { codes: ['55Y', '56Y'], label: 'Ore differenza paga' },
    { codes: ['49X'], label: 'Indennità prestazione giornaliera' },
    { codes: ['FD0'], label: 'Indennità di rendimento' }
  ];

  // Voci escluse dalla coerenza quantita' x base = importo.
  const COHERENCE_EXCLUDED = /contribut|impost|inail|irpef/i;

  const round2 = value => Math.round(value * 100) / 100;
  const sum = values => values.reduce((total, value) => total + value, 0);

  function bustaValue(rule, voci) {
    const matching = voci.filter(voce => rule.codes.includes(voce.code));
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
  function compare(busta, distinta) {
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
      const equal = Math.abs(diff) <= tolerance + 1e-9;
      const status = equal ? 'ok' : (rule.certainty === 'certa' ? 'diff' : 'check');
      const euro = !equal && fromBusta.base !== null ? round2(diff * fromBusta.base) : null;
      const notes = [];
      if (!fromBusta.present) notes.push('Voce assente in busta, ma presente nella Distinta.');
      else if (!distintaValue && bustaNumber) notes.push('Voce presente in busta, ma non risulta nella Distinta.');
      if (!equal && euro === null) notes.push(fromBusta.present ? 'Importo non stimabile: la busta non riporta un dato base.' : 'Importo non stimabile senza il dato base della busta.');
      if (fromBusta.baseNote) notes.push(fromBusta.baseNote);
      rows.push({
        id: rule.id,
        codes: rule.codes.slice(),
        label: rule.label,
        distintaLabel: rule.distintaLabel,
        unit: rule.unit,
        certainty: rule.certainty,
        busta: fromBusta.present ? fromBusta.value : null,
        distinta: distintaValue,
        diff,
        status,
        base: fromBusta.base,
        euro,
        euroText: euroText(euro),
        missing: !fromBusta.present ? 'busta' : (!distintaValue && bustaNumber ? 'distinta' : null),
        notes
      });
    });
    const order = { diff: 0, check: 1, ok: 2 };
    rows.sort((a, b) => order[a.status] - order[b.status]);

    const notCompared = [];
    NOT_COMPARED.forEach(item => {
      voci.filter(voce => item.codes.includes(voce.code)).forEach(voce => notCompared.push({ ...voce, label: item.label, reason: NOT_COMPARED_REASON }));
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
        return { code: voce.code, description: voce.description, quantity: voce.quantity, base: voce.base, amount: voce.amount, expected, difference, ok: Math.abs(difference) <= EURO_TOLERANCE + 1e-9 };
      });
  }

  function knownCodes() {
    return new Set([...RULES.flatMap(rule => rule.codes), ...NOT_COMPARED.flatMap(item => item.codes)]);
  }

  return { RULES, NOT_COMPARED, NOT_COMPARED_REASON, HOURS_TOLERANCE, COUNT_TOLERANCE, EURO_TOLERANCE, compare, coherence, euroText, knownCodes };
});
