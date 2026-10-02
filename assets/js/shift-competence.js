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
    { code: 'SR2', hours: hm(11, 15), allowance: true, allowanceRate: 24, meal: true },
    { code: 'IE', hours: 0, allowance: false, allowanceRate: 24, meal: true },
    { code: 'BIS', hours: hm(12, 15), allowance: true, allowanceRate: 24, meal: true },
    { code: 'AgB', hours: hm(10, 25), allowance: false, allowanceRate: 24, meal: false },
    { code: 'PonD', hours: hm(9, 25), allowance: false, allowanceRate: 24, meal: false },
    { code: 'DT', hours: hm(9, 25), allowance: false, allowanceRate: 24, meal: false },
    { code: 'PT', hours: hm(9, 30), allowance: false, allowanceRate: 24, meal: false },
    { code: 'AgM', hours: hm(9, 45), allowance: false, allowanceRate: 24, meal: false },
    { code: 'AgT', hours: hm(11, 10), allowance: false, allowanceRate: 24, meal: false },
    // Due turni AgT a Maderno dall'orario invernale 2026/27 (ODS 39/2026):
    // stesse ore di AgT.
    { code: 'AgT1', hours: hm(11, 10), allowance: false, allowanceRate: 24, meal: true, embark: false },
    { code: 'AgT2', hours: hm(11, 10), allowance: false, allowanceRate: 24, meal: true, embark: false },
    { code: 'PonM', hours: hm(10, 25), allowance: false, allowanceRate: 24, meal: false },
    { code: 'LD', hours: hm(8), allowance: false, allowanceRate: 24, meal: false },
    { code: 'F.P.', hours: hm(8), allowance: false, allowanceRate: 24, meal: false },
    { code: 'LAV', hours: hm(8), allowance: false, allowanceRate: 24, meal: true },
    { code: 'RF', hours: 0, allowance: false, allowanceRate: 24, meal: false },
    { code: 'Malattia', hours: 0, allowance: false, allowanceRate: 24, meal: false },
    { code: 'Riposo', hours: 0, allowance: false, allowanceRate: 24, meal: false }
  ];

  // Orario invernale dal 05/10/2026 al 25/03/2027: tassazione dell'O.d.S.
  // n. 39/2026 (ods/O.d.S. n. 39-2026 INVERNO.pdf, pag. 18-19). D3, D4, R4,
  // CAR, P3 e CAP non sono piu' in servizio; SR1 e SR2 solo fino all'11/10 e
  // dal 20/03/2027. Lavori e L.D.: 8 ore, 7 il venerdi' feriale.
  const SHIFTS_FROM_2026_10_05 = [
    // Desenzano
    { code: 'D1', hours: hm(12, 5) },
    { code: 'D2', hours: hm(11, 10) },
    { code: 'BIS', hours: hm(12, 10) },
    { code: 'AgB', hours: hm(8, 30) },
    { code: 'PonD', hours: hm(8, 55) },
    // Maderno
    { code: 'T1', hours: hm(11, 30) },
    { code: 'T2', hours: hm(11, 33) },
    { code: 'M1', hours: hm(11, 25) },
    { code: 'AgM', hours: hm(9, 30) },
    { code: 'AgT', hours: hm(9, 30) },
    { code: 'AgT1', hours: hm(9, 30) },
    { code: 'AgT2', hours: hm(9, 30) },
    // Riva
    { code: 'R1', hours: hm(12, 40) },
    { code: 'R2', hours: hm(12) },
    { code: 'R3', hours: hm(9, 30), allowanceRate: 9 },
    // Peschiera
    { code: 'P1', hours: hm(12, 20) },
    { code: 'P2', hours: hm(11, 40) },
    { code: 'SR1', hours: hm(11, 10), allowanceRate: 9 },
    { code: 'SR2', hours: hm(11, 15) },
    // Lavori / L.D.
    { code: 'LAV', fridayHours: hm(7) },
    { code: 'LD', fridayHours: hm(7) }
  ];

  // Dal 02/11/2026 al 12/03/2027 gira solo il traghetto T1 Maderno-Torri:
  // chi non ha corse fa LAV. AgT 7.55-12.15 / 13.15-18.50.
  const SHIFTS_FROM_2026_11_02 = [
    { code: 'AgT', hours: hm(9, 55) },
    { code: 'AgT1', hours: hm(9, 55) },
    { code: 'AgT2', hours: hm(9, 55) }
  ];

  // Dal 13/03/2027 tornano le corse e gli orari di terra di ottobre.
  const SHIFTS_FROM_2027_03_13 = [
    { code: 'AgT', hours: hm(9, 30) },
    { code: 'AgT1', hours: hm(9, 30) },
    { code: 'AgT2', hours: hm(9, 30) }
  ];

  // Elenco ordinato per data di decorrenza (vuota = sempre valida, e' la base).
  const COMPETENCE_SETS = [
    { from: '', shifts: DEFAULT_SHIFTS },
    { from: '2026-10-05', shifts: SHIFTS_FROM_2026_10_05 },
    { from: '2026-11-02', shifts: SHIFTS_FROM_2026_11_02 },
    { from: '2027-03-13', shifts: SHIFTS_FROM_2027_03_13 }
  ];

  function todayIsoLocal() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // Festivita' come nella Distinta (navidiaria-monthly.js): fisse + Lunedi'
  // dell'Angelo.
  const FIXED_HOLIDAYS = new Set(['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26']);
  function easterMondayKey(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1, monday = new Date(year, month - 1, day + 1, 12);
    return `${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  }
  function isWeekdayFriday(dateIso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateIso || ''));
    if (!match) return false;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
    const key = `${match[2]}-${match[3]}`;
    return date.getDay() === 5 && !FIXED_HOLIDAYS.has(key) && key !== easterMondayKey(date.getFullYear());
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
    // Venerdi' feriale: i turni con fridayHours (Lavori, L.D.) durano meno.
    if (isWeekdayFriday(date)) {
      merged.forEach(shift => { if (Number.isFinite(Number(shift.fridayHours))) shift.hours = Number(shift.fridayHours); });
    }
    return [...merged.values()];
  }

  function shiftForCode(code, dateIso, baseShifts) {
    const list = shiftsFor(dateIso, baseShifts);
    return list.find(shift => shift.code === code) || list.at(-1);
  }

  const api = { DEFAULT_SHIFTS, COMPETENCE_SETS, shiftsFor, shiftForCode, todayIsoLocal, isWeekdayFriday };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NaviShiftCompetence = api;
})(typeof window !== 'undefined' ? window : globalThis);
