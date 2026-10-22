// Confronto giorno per giorno tra la Distinta attuale e una fonte (backup NaviSuite, backup di K, copia online o copia automatica).
// Nessun DOM: lo usa backup-dati.js e lo prova tests/backup-diff.test.js.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NaviBackupDiff = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const ore = m => { const v = Math.max(0, Math.round(Number(m) || 0)); return v ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` : '—'; };
  const si = v => (v ? 'sì' : '—');
  const comp = (e, k) => Number(e?.overtimeComponents?.[k]) || 0;
  // chiave, etichetta, lettura del valore (confrontato) e testo mostrato
  const CAMPI = [
    ['shift', 'Turno', e => String(e?.shift || ''), v => v || '—'],
    ['straordinario', 'Straordinario', e => (e?.overtimeComponents ? comp(e, 'ordinario') + comp(e, 'cambi') + comp(e, 'sentine') : Number(e?.delay) || 0), ore],
    ['cambi', 'Cambio', e => comp(e, 'cambi') || Number(e?.changeMinutes) || 0, ore],
    ['sentine', 'Sentine', e => comp(e, 'sentine'), ore],
    ['bank', 'Banca ore', e => Number(e?.bank) || 0, ore],
    ['allowanceRate', 'Diaria', e => Number(e?.allowanceRate) || 0, v => (v ? `${v}%` : '—')],
    ['overnight40', 'Pernotto 40%', e => !!e?.overnight40, si],
    ['ticket', 'Ticket', e => (e?.ticketPresence === undefined ? !!e?.mealUsed : !!e?.ticketPresence), si],
    ['secondMeal', '2° ticket', e => !!Number(e?.secondMeal), si],
    ['embark', 'Imbarco', e => !!e?.embark, si],
    ['cashHandling', 'Maneggio denaro', e => !!e?.cashHandling, si],
    ['holidayWorked', 'Festività', e => !!e?.holidayWorked, si],
    ['travel', 'Trasferta', e => !!e?.travel, si],
    ['refuel', 'Rifornimento', e => Number(e?.refuel) || 0, ore],
    ['note', 'Note', e => String(e?.note || '').trim(), v => v || '—']
  ];

  // attuali / fonte: array di giornate. Restituisce una riga per ogni giorno della fonte che non e' gia' uguale.
  function confronta(attuali, fonte) {
    const mappa = new Map((attuali || []).filter(e => e?.date).map(e => [e.date, e]));
    const righe = [];
    let uguali = 0;
    for (const nuova of (fonte || []).filter(e => e?.date)) {
      const vecchia = mappa.get(nuova.date);
      if (!vecchia) { righe.push({ date: nuova.date, stato: 'nuovo', campi: [], entry: nuova }); continue; }
      const campi = CAMPI.map(([key, label, leggi, testo]) => ({ key, label, prima: leggi(vecchia), dopo: leggi(nuova), testoPrima: testo(leggi(vecchia)), testoDopo: testo(leggi(nuova)) }))
        .filter(c => c.prima !== c.dopo);
      if (campi.length) righe.push({ date: nuova.date, stato: 'diverso', campi, entry: nuova });
      else uguali++;
    }
    righe.sort((a, b) => a.date.localeCompare(b.date));
    return { righe, uguali };
  }

  // scelte: insieme delle date da applicare
  function applica(attuali, righe, scelte) {
    const mappa = new Map((attuali || []).filter(e => e?.date).map(e => [e.date, e]));
    let n = 0;
    for (const r of righe) if (scelte.has(r.date)) { mappa.set(r.date, r.entry); n++; }
    return { entries: [...mappa.values()].sort((a, b) => a.date.localeCompare(b.date)), applicati: n };
  }

  return { CAMPI, confronta, applica };
});
