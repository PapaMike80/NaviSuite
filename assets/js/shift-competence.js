// Ore/pasto/imbarco/diaria per ogni codice turno, con possibilita' di far
// decorrere valori diversi da una data (es. il turno del 05/10/2026 accorcia
// gli orari a Desenzano/Riva/Peschiera). Un solo posto per app.js,
// navidistinta-app.js, day-popup.js, navidiaria-*.js, naviturni.html e
// cambi_turno.html, cosi' non restano piu' copie disallineate della stessa
// tabella.
(function (root) {
  const hm = (hours, minutes = 0) => hours + minutes / 60;

  const DEFAULT_SHIFTS = [
    { code: 'D1', hours: hm(13), allowance: true, allowanceRate: 24, meal: true },
    { code: 'D2', hours: hm(11, 25), allowance: true, allowanceRate: 24, meal: true },
    { code: 'D3', hours: hm(13, 20), allowance: true, allowanceRate: 24, meal: true },
    { code: 'D4', hours: hm(13, 15), allowance: true, allowanceRate: 24, meal: true },
    { code: 'T1', hours: hm(13, 35), allowance: true, allowanceRate: 24, meal: true },
    { code: 'T2', hours: hm(12, 29), allowance: true, allowanceRate: 24, meal: true },
    { code: 'M1', hours: hm(13, 30), allowance: true, allowanceRate: 24, meal: true },
    { code: 'R1', hours: hm(13, 15), allowance: true, allowanceRate: 24, meal: true },
    { code: 'R2', hours: hm(13, 15), allowance: true, allowanceRate: 24, meal: true },
    { code: 'R3', hours: hm(12, 20), allowance: true, allowanceRate: 24, meal: true },
    { code: 'R4', hours: hm(12, 40), allowance: true, allowanceRate: 24, meal: true },
    { code: 'CAR1', hours: hm(12, 10), allowance: true, allowanceRate: 24, meal: true },
    { code: 'P1', hours: hm(12, 45), allowance: true, allowanceRate: 24, meal: true },
    { code: 'P2', hours: hm(13, 5), allowance: true, allowanceRate: 24, meal: true },
    { code: 'P3', hours: hm(12, 55), allowance: true, allowanceRate: 24, meal: true },
    { code: 'CAP1', hours: hm(12, 55), allowance: true, allowanceRate: 24, meal: true },
    { code: 'CAP', hours: hm(12, 55), allowance: true, allowanceRate: 24, meal: true },
    { code: 'SR1', hours: hm(12, 15), allowance: true, allowanceRate: 24, meal: true },
    { code: 'IE', hours: 0, allowance: false, allowanceRate: 24, meal: true },
    { code: 'BIS', hours: hm(12, 15), allowance: true, allowanceRate: 24, meal: true },
    { code: 'AgB', hours: hm(10, 25), allowance: false, allowanceRate: 24, meal: false },
    { code: 'PonD', hours: hm(9, 25), allowance: false, allowanceRate: 24, meal: false },
    { code: 'DT', hours: hm(9, 25), allowance: false, allowanceRate: 24, meal: false },
    { code: 'PT', hours: hm(9, 30), allowance: false, allowanceRate: 24, meal: false },
    { code: 'AgM', hours: hm(9, 45), allowance: false, allowanceRate: 24, meal: false },
    { code: 'AgT', hours: hm(11, 10), allowance: false, allowanceRate: 24, meal: false },
    { code: 'PonM', hours: hm(10, 25), allowance: false, allowanceRate: 24, meal: false },
    { code: 'LD', hours: hm(8), allowance: false, allowanceRate: 24, meal: false },
    { code: 'F.P.', hours: hm(8), allowance: false, allowanceRate: 24, meal: false },
    { code: 'LAV', hours: hm(8), allowance: false, allowanceRate: 24, meal: true },
    { code: 'RF', hours: 0, allowance: false, allowanceRate: 24, meal: false },
    { code: 'Malattia', hours: 0, allowance: false, allowanceRate: 24, meal: false },
    { code: 'Riposo', hours: 0, allowance: false, allowanceRate: 24, meal: false }
  ];

  // Turno dal 05/10/2026: meno corse e orari piu' corti a Desenzano, Riva e
  // Peschiera (Maderno resta invariato). Valori SEGNAPOSTO, identici a quelli
  // attuali: quando esce l'ODS con gli orari ufficiali si cambiano solo i
  // numeri qui sotto, nient'altro nel codice.
  const SHIFTS_FROM_2026_10_05 = [
    // Desenzano
    { code: 'D1', hours: hm(13) },
    { code: 'D2', hours: hm(11, 25) },
    { code: 'D3', hours: hm(13, 20) },
    { code: 'D4', hours: hm(13, 15) },
    { code: 'BIS', hours: hm(12, 15) },
    { code: 'AgB', hours: hm(10, 25) },
    { code: 'DT', hours: hm(9, 25) },
    { code: 'PonD', hours: hm(9, 25) },
    { code: 'PT', hours: hm(9, 30) },
    // Riva
    { code: 'R1', hours: hm(13, 15) },
    { code: 'R2', hours: hm(13, 15) },
    { code: 'R3', hours: hm(12, 20) },
    { code: 'R4', hours: hm(12, 40) },
    { code: 'CAR1', hours: hm(12, 10) },
    // Peschiera
    { code: 'P1', hours: hm(12, 45) },
    { code: 'P2', hours: hm(13, 5) },
    { code: 'P3', hours: hm(12, 55) },
    { code: 'CAP1', hours: hm(12, 55) },
    { code: 'CAP', hours: hm(12, 55) },
    { code: 'SR1', hours: hm(12, 15) }
  ];

  // Elenco ordinato per data di decorrenza (vuota = sempre valida, e' la base).
  const COMPETENCE_SETS = [
    { from: '', shifts: DEFAULT_SHIFTS },
    { from: '2026-10-05', shifts: SHIFTS_FROM_2026_10_05 }
  ];

  function todayIsoLocal() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // Applica sopra baseShifts (di norma la tabella eventualmente personalizzata
  // salvata sul dispositivo) le sole variazioni dei set con decorrenza <= data,
  // in ordine: un codice non toccato da nessun set resta con i suoi valori.
  function shiftsFor(dateIso, baseShifts) {
    const date = String(dateIso || todayIsoLocal()).slice(0, 10);
    const base = Array.isArray(baseShifts) && baseShifts.length ? baseShifts : DEFAULT_SHIFTS;
    const merged = new Map(base.map(shift => [shift.code, { ...shift }]));
    COMPETENCE_SETS.forEach(set => {
      if (!set.from || date < set.from) return;
      set.shifts.forEach(override => {
        merged.set(override.code, { ...(merged.get(override.code) || {}), ...override });
      });
    });
    return [...merged.values()];
  }

  function shiftForCode(code, dateIso, baseShifts) {
    const list = shiftsFor(dateIso, baseShifts);
    return list.find(shift => shift.code === code) || list.at(-1);
  }

  const api = { DEFAULT_SHIFTS, COMPETENCE_SETS, shiftsFor, shiftForCode, todayIsoLocal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NaviShiftCompetence = api;
})(typeof window !== 'undefined' ? window : globalThis);
