// Numeri corsa, prima partenza / ultimo arrivo e orario di presentazione
// per corsa (gruppo). Fonte unica per la pagina Oggi, il riepilogo nelle
// notifiche (push-center.js) e il push-worker su TrueNAS, che scarica questo
// file da GitHub Pages. Modulo puro: niente DOM.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NaviCourseInfo = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  // Orario estivo: dalla tabella corse ufficiale con
  // tools/generate-shift-times.py --raw (stessa fonte di assets/shift-times.json,
  // qui pero' SENZA il margine di presentazione: orario reale della corsa).
  // T1/T2 non presenti nella tabella corse imbarcata: restano senza orario.
  const COURSE_TRIPS={D1:'22–27',D2:'8–13',D3:'28–31',D4:'40–49',T1:'201–218',T2:'231–246',M1:'91–93 · 95–98',R1:'5–6',R2:'61–70',R3:'71–78',R4:'81–90',CAR:'151–153 · 155–156',P1:'2–3',P2:'14–19',P3:'33–39',CAP:'159–163',SR1:'110–114'};
  const COURSE_TIMES={D1:['08:55','20:15'],D2:['08:20','18:25'],D3:['08:00','19:20'],D4:['08:15','19:45'],M1:['08:20','19:50'],R1:['08:50','20:05'],R2:['08:00','19:30'],R3:['08:40','19:20'],R4:['09:20','20:30'],CAR:['08:20','19:40'],P1:['09:10','20:10'],P2:['08:00','19:20'],P3:['08:35','19:00'],CAP:['08:30','19:35'],SR1:['08:50','19:30']};
  // Orario invernale dal 05/10/2026 (O.d.S. n. 39/2026, orari pag. 15-17):
  // nuova numerazione delle corse e prima partenza / ultimo arrivo per gruppo.
  // D3, D4, R4, CAR, P3 e CAP non sono piu' in servizio; SR1/SR2 fino all'11/10.
  const WINTER_FROM='2026-10-05';
  const COURSE_TRIPS_WINTER={D1:'14–19',D2:'20–27',T1:'201–214',T2:'231–244',M1:'91–94',R1:'7–8',R2:'51–60',R3:'61–66',P1:'2–3',P2:'30–39',SR1:'102–107',SR2:'111–114'};
  const COURSE_TIMES_WINTER={D1:['09:15','19:40'],D2:['08:50','19:00'],BIS:['08:30','18:40'],T1:['08:10','18:30'],T2:['08:45','19:10'],M1:['09:15','19:25'],R1:['08:45','19:25'],R2:['08:10','18:50'],R3:['09:40','17:40'],P1:['09:10','19:30'],P2:['08:25','18:35'],SR1:['09:00','18:30'],SR2:['08:40','18:55']};
  // Presentazione: 60 minuti prima della prima partenza; con il rifornimento
  // del mattino 30 minuti prima ancora.
  const PRESENTATION_MINUTES = 60;
  const REFUEL_EXTRA_MINUTES = 30;

  const toMinutes = value => { const m = String(value || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const toClock = minutes => { const value = ((minutes % 1440) + 1440) % 1440; return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; };

  // Codice corsa dal turno: trasferte CxxC -> xx, CAR1/CAP1 -> CAR/CAP.
  function courseCode(shift) {
    let code = String(shift || '').trim().toUpperCase().replace(/[^A-Z0-9]+$/, '');
    if (code.length > 2 && /^C.+C$/.test(code) && !COURSE_TIMES[code] && !COURSE_TIMES_WINTER[code]) code = code.slice(1, -1);
    if (/^(CAR|CAP)\d+$/.test(code)) code = code.replace(/\d+$/, '');
    return code;
  }

  function info(shift, iso, options = {}) {
    const course = courseCode(shift);
    const winter = String(iso || '') >= WINTER_FROM;
    const trips = (winter ? COURSE_TRIPS_WINTER : COURSE_TRIPS)[course] || '';
    const times = (winter ? COURSE_TIMES_WINTER : COURSE_TIMES)[course] || null;
    if (!trips && !times) return null;
    const first = times ? times[0] : '', last = times ? times[1] : '';
    const start = toMinutes(first);
    const refuel = !!options.refuel;
    const presentation = start === null ? '' : toClock(start - PRESENTATION_MINUTES - (refuel ? REFUEL_EXTRA_MINUTES : 0));
    return { course, trips, firstDeparture: first, lastArrival: last, presentation, refuel };
  }

  // Testo breve "14–19 · 09:15–19:40" usato nella pagina Oggi.
  function tripLabel(shift, iso) {
    const item = info(shift, iso);
    if (!item) return '';
    return [item.trips, item.firstDeparture ? `${item.firstDeparture}–${item.lastArrival}` : ''].filter(Boolean).join(' · ');
  }

  return { WINTER_FROM, COURSE_TRIPS, COURSE_TIMES, COURSE_TRIPS_WINTER, COURSE_TIMES_WINTER, PRESENTATION_MINUTES, REFUEL_EXTRA_MINUTES, courseCode, info, tripLabel };
});
