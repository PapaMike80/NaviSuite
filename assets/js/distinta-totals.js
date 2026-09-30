// Totali mensili della Distinta (Diaria) senza DOM, con le STESSE regole di
// assets/js/navidiaria-monthly.js (summarizedTotal), app.js (competencePeriod,
// tabella turni) e della correzione di baseWorkedMinutes applicata da sw.js.
// Nessuna regola nuova: se cambia l'originale va allineato anche questo file
// (tests/busta-verifica.test.js confronta i due calcoli).
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NaviDistintaTotals = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  // Stessi valori di app.js.
  const SHIFTS_STORAGE = 'navidiaria.shifts.v1';
  const COMPETENCE_VERSION = 'terra-rinominato-lav-2026-09-17';
  const GROUND_SHIFTS = new Set(['AGB', 'POND', 'DT', 'PT', 'AGM', 'AGT', 'PONM', 'LD', 'LAV', 'MALATTIA', 'RIPOSO']);
  const NOT_WORKING = ['RIPOSO', 'RIP', 'MALATTIA'];
  const fixedHolidays = new Set(['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26']);

  function easterMondayKey(year) { const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1, monday = new Date(year, month - 1, day + 1, 12); return `${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`; }
  function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function isHoliday(d) { const key = iso(d).slice(5); return fixedHolidays.has(key) || key === easterMondayKey(d.getFullYear()); }

  // Tabella turni come in app.js: quella personalizzata sul dispositivo se la
  // versione coincide, altrimenti DEFAULT_SHIFTS, con le stesse normalizzazioni.
  function loadShifts(storage, defaultShifts) {
    let shifts = null;
    try {
      if (storage && storage.getItem('navidiaria.competenceVersion') === COMPETENCE_VERSION) shifts = JSON.parse(storage.getItem(SHIFTS_STORAGE) || 'null');
    } catch (_) { shifts = null; }
    if (!Array.isArray(shifts) || !shifts.length) shifts = (defaultShifts || []).map(s => ({ ...s }));
    else shifts = shifts.map(s => ({ ...s }));
    (defaultShifts || []).forEach(defaultShift => { if (!shifts.some(s => s.code === defaultShift.code)) shifts.push({ ...defaultShift }); });
    shifts.forEach(s => { if (Number(s.allowanceRate) === 25) s.allowanceRate = 24; if (![0, 9, 12, 24].includes(Number(s.allowanceRate))) s.allowanceRate = 24; });
    shifts.forEach(s => { if (s.embark === undefined) s.embark = !GROUND_SHIFTS.has(String(s.code).toUpperCase()); });
    shifts.forEach(s => { const code = String(s.code).toUpperCase(); if (GROUND_SHIFTS.has(code) && !['RIPOSO', 'MALATTIA'].includes(code)) s.meal = true; });
    return shifts;
  }

  // Periodo di competenza come competencePeriod() di app.js: le settimane
  // lun-dom la cui domenica cade nel mese.
  function competencePeriod(monthValue) {
    const match = String(monthValue || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return { weeks: [], dates: [], start: null, end: null, startIso: '', endIso: '' };
    const year = Number(match[1]), monthIndex = Number(match[2]) - 1, firstDay = new Date(year, monthIndex, 1, 12), lastDay = new Date(year, monthIndex + 1, 0, 12);
    const firstSunday = new Date(firstDay); firstSunday.setDate(firstSunday.getDate() + (7 - firstSunday.getDay()) % 7);
    const lastSunday = new Date(lastDay); lastSunday.setDate(lastSunday.getDate() - lastSunday.getDay());
    const weeks = [];
    for (let sunday = new Date(firstSunday); sunday <= lastSunday; sunday.setDate(sunday.getDate() + 7)) {
      const start = new Date(sunday); start.setDate(start.getDate() - 6);
      const end = new Date(sunday); weeks.push({ start, end });
    }
    const dates = weeks.flatMap(({ start }) => Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index); return date; }));
    return { weeks, dates, start: dates[0] || null, end: dates.at(-1) || null, startIso: dates[0] ? iso(dates[0]) : '', endIso: dates.length ? iso(dates.at(-1)) : '' };
  }

  function create(options = {}) {
    const overtime = options.overtime || root.NaviOvertimeComponents || null;
    const competence = options.shiftCompetence || root.NaviShiftCompetence;
    if (!competence?.shiftForCode) throw new Error('Tabella turni non disponibile (shift-competence.js).');
    const SHIFTS = options.shifts || loadShifts(options.storage, competence.DEFAULT_SHIFTS);
    const shiftFor = (code, dateIso) => competence.shiftForCode(code, dateIso, SHIFTS);

    // --- Da navidiaria-monthly.js (baseWorkedMinutes con la correzione di sw.js) ---
    function isWorking(e) { return !!e && !NOT_WORKING.includes(String(e.shift || '').toUpperCase()); }
    function serviceMinutes(e) { return e ? Math.max(0, Number.isFinite(Number(e.serviceMinutes)) ? Number(e.serviceMinutes) : Math.round(shiftFor(e.shift, e.date).hours * 60)) : 0; }
    function changeMinutes(e) { return overtime?.changes(e) ?? Math.max(0, Math.round(Number(e?.changeMinutes) || 0)); }
    function overtimeTotal(e) { return overtime?.total(e) ?? Math.max(0, Math.round(Number(e?.delay) || 0)); }
    function ordinaryOvertime(e) { return overtime?.ordinary(e) ?? Math.max(0, Math.round(Number(e?.delay) || 0)); }
    function baseWorkedMinutes(e) { const manual = Number(e?.workedMinutes), manualWorked = overtime?.isWorkedManual?.(e); if (manualWorked && Number.isFinite(manual) && manual >= 0) return manual; if (overtime?.structured(e)) return serviceMinutes(e) + overtimeTotal(e); return Number.isFinite(manual) && manual >= 0 ? manual : serviceMinutes(e) + ordinaryOvertime(e); }
    function workedMinutes(e) { return baseWorkedMinutes(e) + (overtime?.structured(e) ? 0 : changeMinutes(e)); }
    function holidayValue(e, d) { return e.holidayWorked === undefined ? isHoliday(d) : !!e.holidayWorked; }
    function ticketDue(e) { return isWorking(e) && !!shiftFor(e.shift, e.date).meal; }
    function ticketValue(e) { return e.ticketPresence === undefined ? !!e.mealUsed : !!e.ticketPresence; }

    // Come summarizedTotal(), ma con i numeri invece del testo della cella.
    function summarize(weekGroups) {
      const worked = weekGroups.flat().filter(isWorking);
      const dateOf = e => new Date(`${e.date}T12:00:00`);
      const due = worked.filter(ticketDue).length;
      // Maneggio denaro da imbarcato = parametro 139 (differenza paga sulle ore
      // del turno e sullo straordinario); a terra = indennita' FC0. Lo
      // straordinario e' settimanale: e' a 139 solo nelle settimane in cui
      // tutte le giornate lavorate hanno maneggio e imbarco.
      const cash139 = e => !!(e.cashHandling && e.embark);
      let overtime139Minutes = 0;
      let overtimeMixedWeeks = 0;
      weekGroups.forEach(group => {
        const working = group.filter(isWorking);
        const extra = Math.max(0, working.reduce((total, e) => total + workedMinutes(e), 0) - 39 * 60);
        if (!extra) return;
        const cashDays = working.filter(cash139).length;
        if (cashDays === working.length) overtime139Minutes += extra;
        else if (cashDays) overtimeMixedWeeks += 1;
      });
      const used = worked.filter(e => ticketDue(e) && ticketValue(e)).length;
      return {
        workedDays: worked.length,
        serviceMinutes: worked.reduce((sum, e) => sum + serviceMinutes(e), 0),
        workedMinutes: worked.reduce((sum, e) => sum + workedMinutes(e), 0),
        overtimeMinutes: weekGroups.reduce((total, group) => total + Math.max(0, group.filter(isWorking).reduce((sum, e) => sum + workedMinutes(e), 0) - 39 * 60), 0),
        bankMinutes: worked.reduce((sum, e) => sum + (Number(e.bank) || 0), 0),
        ticketDue: due,
        ticketUsed: used,
        ticketCredit: due - used,
        allowance9: worked.filter(e => Number(e.allowanceRate) === 9).length,
        allowance24: worked.filter(e => Number(e.allowanceRate) === 24).length,
        allowance50: worked.filter(e => Number(e.allowanceRate) === 50).length,
        overnight40: worked.filter(e => e.overnight40).length,
        holiday: worked.filter(e => holidayValue(e, dateOf(e))).length,
        sundayShift: worked.filter(e => dateOf(e).getDay() === 0).length,
        secondMeal: worked.filter(e => e.secondMeal).length,
        embark: worked.filter(e => e.embark).length,
        cashHandling: worked.filter(e => e.cashHandling).length,
        cashHandlingGround: worked.filter(e => e.cashHandling && !e.embark).length,
        cashHandlingEmbark: worked.filter(cash139).length,
        cashEmbarkServiceMinutes: worked.filter(cash139).reduce((total, e) => total + serviceMinutes(e), 0),
        overtime139Minutes,
        overtimeMixedWeeks,
        hydrofoil: worked.filter(e => String(e.shift).toUpperCase() === 'SR1').length,
        rf: worked.filter(e => e.rf).length
      };
    }

    function compute(entries, monthValue) {
      const period = competencePeriod(monthValue);
      const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
      const groups = period.weeks.map(({ start, end }) => {
        const from = iso(start), to = iso(end);
        return list.filter(e => e.date >= from && e.date <= to);
      });
      const weeks = period.weeks.map(({ start, end }, index) => {
        const group = groups[index];
        const worked = group.filter(isWorking).reduce((sum, e) => sum + workedMinutes(e), 0);
        return { startIso: iso(start), endIso: iso(end), workedDays: group.filter(isWorking).length, cash139Days: group.filter(e => isWorking(e) && e.cashHandling && e.embark).length, workedMinutes: worked, overtimeMinutes: Math.max(0, worked - 39 * 60) };
      });
      return { month: monthValue, period: { startIso: period.startIso, endIso: period.endIso, weeks }, entryCount: groups.flat().length, totals: summarize(groups) };
    }

    return { compute, summarize, isWorking, serviceMinutes, workedMinutes, baseWorkedMinutes, ticketDue, ticketValue, holidayValue, shiftFor, shifts: SHIFTS };
  }

  return { COMPETENCE_VERSION, SHIFTS_STORAGE, create, loadShifts, competencePeriod, isHoliday, easterMondayKey, iso };
});
