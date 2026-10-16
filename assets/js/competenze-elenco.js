// Competenze e servizi (solo admin): elenco dei servizi come nella modifica della giornata
// (Su una corsa · A terra · Assenze). Toccando un servizio si apre un popup con le bolle:
// Ore servizio, Ticket, Diaria, Ind. imbarco, Ind. aliscafo. Ore e diaria possono essere
// diverse fra orario estivo e autunno/inverno/primavera (shift.stagioni[stagione]).
(function () {
  if (typeof SHIFTS === 'undefined' || typeof renderShiftSettings !== 'function') return;
  const SC = window.NaviShiftCompetence;
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NOMI = { RIPOSO: 'Riposo', MALATTIA: 'Malattia', CON: 'Congedo', LD: 'L.D.', LAV: 'Lavori', 'F.P.': 'F.P.', RF: 'RF' };
  const gruppo = code => {
    const c = String(code).toUpperCase();
    if (/^(RIP|RIPOSO|MALATTIA|MAL|CON|CONG|FERIE|F\.P\.|RF)$/.test(c)) return 2;
    if (/^(LD|L\.D\.|LAV|TERRA|AGB|POND|DT|PT|AGM|AGT[12]?|PONM|IE)$/.test(c)) return 1;
    return 0;
  };
  const TITOLI = ['Su una corsa', 'A terra', 'Assenze'];
  // stessi colori dei turni nella Distinta
  const COLORI = {D1:'#2563eb',D2:'#059669',D3:'#ea580c',D4:'#c026d3',BIS:'#0891b2',BIS2:'#0891b2',DT:'#d4a900',AGB:'#2563eb',AGB2:'#2563eb',POND:'#dc2626',T1:'#2563eb',T2:'#059669',M1:'#ea580c',AGM:'#2563eb',AGT:'#d4a900',AGT1:'#d4a900',AGT2:'#d4a900',PONM:'#dc2626',R1:'#2563eb',R2:'#059669',R3:'#ea580c',R4:'#c026d3',CAR:'#0891b2',CAR1:'#0891b2',P1:'#2563eb',P2:'#059669',P3:'#ea580c',CAP:'#0891b2',CAP1:'#0891b2',SR1:'#7c3aed',SR2:'#c026d3',IE:'#64748b',PT:'#64748b',LD:'#64748b',LAV:'#64748b'};
  const colore = code => COLORI[String(code).toUpperCase()] || '#64748b';
  const RATE = [0, 9, 12, 24];
  const orario = h => { const m = Math.round((Number(h) || 0) * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
  const dataEsempio = st => {
    const oggi = SC.todayIsoLocal();
    if (SC.stagioneDi(oggi) === st) return oggi;
    return st === 'estivo' ? '2026-07-15' : '2026-12-01';
  };
  const effettivo = (code, st) => SC.shiftForCode(code, dataEsempio(st), SHIFTS) || {};
  const aliscafo = code => SC.aliscafo ? SC.aliscafo(code, SC.todayIsoLocal(), SHIFTS) : String(code).toUpperCase() === 'SR1';
  // Competenze uguali su tutti i dispositivi: archivio unico su Firebase.
  const chi = () => { try { const a = JSON.parse(localStorage.getItem('navidiaria.activeAgent') || 'null'); return a ? `${a.id} ${a.name || ''}`.trim() : ''; } catch (_) { return ''; } };
  const amministratore = () => { try { return typeof isAdmin === 'function' && isAdmin(); } catch (_) { return false; } };
  function applica(lista) {
    lista = (lista || []).filter(x => x && x.code);
    if (!lista.length || JSON.stringify(lista) === JSON.stringify(SHIFTS)) return;
    // i servizi nuovi dell'app (non ancora nella copia condivisa) restano
    SHIFTS.forEach(x => { if (!lista.some(y => y.code === x.code)) lista.push(x); });
    SHIFTS.splice(0, SHIFTS.length, ...lista);
    localStorage.setItem(SHIFTS_STORAGE, JSON.stringify(SHIFTS));
    try { refreshShiftSelect(); } catch (_) {}
    try { render(); } catch (_) {}
    try { elenco(); } catch (_) {}
  }
  async function scaricaCompetenze() {
    const fb = window.NaviAdminFirebase;
    let lista = [];
    try { if (fb?.getCompetenzeServizi) { await fb.ready; lista = (await fb.getCompetenzeServizi()).servizi; } } catch (error) { console.warn('Competenze da Firebase non lette', error); }
    if (lista.length) applica(lista);
  }
  let timerPb = 0;
  function inviaCompetenze() {
    clearTimeout(timerPb);
    timerPb = setTimeout(async () => {
      let fbOk = false;
      try { await window.NaviAdminFirebase?.saveCompetenzeServizi?.(SHIFTS, chi()); fbOk = true; } catch (error) { console.warn('Competenze non salvate su Firebase', error); }
      try { notify(fbOk ? 'Competenze salvate per tutti gli agenti' : 'Competenze NON salvate per tutti (Firebase non raggiungibile)'); } catch (_) {}
    }, 800);
  }
  function salva() {
    localStorage.setItem(SHIFTS_STORAGE, JSON.stringify(SHIFTS));
    try { refreshShiftSelect(); } catch (_) {}
    try { render(); } catch (_) {}
    inviaCompetenze();
  }
  // "Ripristina valori PDF" (app.js) -> anche per tutti
  document.getElementById('resetShifts')?.addEventListener('click', () => setTimeout(() => { if (typeof isAdmin === 'function' && isAdmin()) inviaCompetenze(); }, 0));

  // ---------- elenco ----------
  const elenco = function renderShiftSettingsElenco() {
    const box = document.getElementById('shiftCards');
    if (!box) return;
    const gruppi = [[], [], []];
    SHIFTS.filter(s => s.code !== 'Riposo').forEach(s => gruppi[gruppo(s.code)].push(s));
    box.className = 'comp-elenco';
    box.innerHTML = gruppi.map((lista, i) => lista.length ? `<p class="comp-gruppo">${TITOLI[i]}</p><div class="comp-righe">${lista.map(s => {
      const est = effettivo(s.code, 'estivo'), inv = effettivo(s.code, 'invernale');
      const ore = orario(est.hours) === orario(inv.hours) ? orario(est.hours) : `${orario(est.hours)} / ${orario(inv.hours)}`;
      const dia = est.allowance === false && !est.allowanceRate ? '' : `${est.allowanceRate || 0}%${(inv.allowanceRate || 0) !== (est.allowanceRate || 0) ? ` / ${inv.allowanceRate || 0}%` : ''}`;
      const tag = [ore !== '0:00' ? ore : '', s.meal ? 'Ticket' : '', dia && (est.allowance || inv.allowance) ? `Diaria ${dia}` : '', s.embark ? 'Imbarco' : '', aliscafo(s.code) ? 'Aliscafo' : ''].filter(Boolean).join(' · ');
      return `<button type="button" class="comp-riga" style="--c:${colore(s.code)}" data-comp="${esc(s.code)}"><b>${esc(NOMI[String(s.code).toUpperCase()] || s.code)}</b><small>${esc(tag || '—')}</small></button>`;
    }).join('')}</div>` : '').join('');
  };
  // sostituisce la vecchia tabella (stesso nome, cosi' app.js chiama questa)
  renderShiftSettings = elenco;

  // ---------- popup ----------
  let codice = '', stagione = SC.stagioneDi(SC.todayIsoLocal());
  function modale() {
    let m = document.getElementById('compModale');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'compModale'; m.className = 'weekly-edit-overlay'; m.hidden = true;
    m.innerHTML = '<div class="weekly-edit-dialog comp-dialog"><button type="button" class="weekly-edit-close" data-chiudi aria-label="Chiudi">✕</button><small>COMPETENZE</small><h3 data-titolo></h3><div class="comp-stagioni" data-stagioni></div><div class="comp-bolle" data-bolle></div><p class="comp-nota" data-nota></p></div>';
    document.body.appendChild(m);
    m.addEventListener('click', e => {
      if (e.target === m || e.target.closest('[data-chiudi]')) { m.hidden = true; document.body.classList.remove('weekly-dialog-open'); elenco(); return; }
      const st = e.target.closest('[data-stagione]'); if (st) { stagione = st.dataset.stagione; disegna(); return; }
      const b = e.target.closest('[data-bolla]'); if (b && b.dataset.bolla !== 'ore') cambia(b.dataset.bolla);
    });
    m.addEventListener('change', e => { if (e.target.matches('[data-ore]')) { imposta('hours', SC && typeof clockToHours === 'function' ? clockToHours(e.target.value) : 0); } });
    return m;
  }
  const shift = () => SHIFTS.find(s => s.code === codice);
  // ore e diaria: per stagione; ticket, imbarco e aliscafo: per tutte le stagioni
  function imposta(campo, valore) {
    const s = shift(); if (!s) return;
    if (campo === 'hours' || campo === 'allowanceRate' || campo === 'allowance') {
      s.stagioni = s.stagioni || {};
      s.stagioni[stagione] = { ...(s.stagioni[stagione] || {}), [campo]: valore };
      if (campo === 'allowanceRate') s.stagioni[stagione].allowance = valore > 0;
    } else {
      s[campo] = valore;
      Object.values(s.stagioni || {}).forEach(o => { delete o[campo]; });
    }
    salva(); disegna();
  }
  function cambia(bolla) {
    const e = effettivo(codice, stagione), s = shift();
    if (bolla === 'meal') imposta('meal', !s.meal);
    else if (bolla === 'embark') imposta('embark', !s.embark);
    else if (bolla === 'hydrofoil') imposta('hydrofoil', !aliscafo(codice));
    else if (bolla === 'diaria') { const cur = e.allowance === false ? 0 : Number(e.allowanceRate) || 0; imposta('allowanceRate', RATE[(RATE.indexOf(cur) + 1) % RATE.length]); }
  }
  function disegna() {
    const m = modale(), s = shift(); if (!s) return;
    const e = effettivo(codice, stagione);
    const dia = e.allowance === false ? 0 : Number(e.allowanceRate) || 0;
    m.querySelector('[data-titolo]').textContent = NOMI[String(codice).toUpperCase()] || codice;
    m.querySelector('.comp-dialog').style.setProperty('--c', colore(codice));
    m.querySelector('[data-stagioni]').innerHTML = Object.entries(SC.STAGIONI).map(([k, v]) => `<button type="button" data-stagione="${k}" class="${k === stagione ? 'on' : ''}">${v}</button>`).join('');
    const bolla = (k, label, valore, on, extra = '') => `<button type="button" class="weekly-bubble comp-bolla${on ? ' has-value' : ' is-empty'}" data-bolla="${k}"><span>${label}</span><strong>${valore}</strong>${extra}</button>`;
    const oreHm = orario(e.hours).split(':').map(x => x.padStart(2, '0')).join(':');
    m.querySelector('[data-bolle]').innerHTML =
      `<label class="weekly-bubble comp-bolla has-value" data-bolla="ore"><span>Ore servizio</span><input type="time" data-ore value="${oreHm}"></label>` +
      bolla('meal', 'Ticket', s.meal ? 'Sì' : 'No', !!s.meal) +
      bolla('diaria', 'Diaria', dia ? `${dia}%` : 'Nessuna', dia > 0) +
      bolla('embark', 'Ind. imbarco', s.embark ? 'Sì' : 'No', !!s.embark) +
      bolla('hydrofoil', 'Ind. aliscafo', aliscafo(codice) ? 'Sì' : 'No', aliscafo(codice));
    m.querySelector('[data-nota]').textContent = `Ore e diaria valgono per l'orario ${SC.STAGIONI[stagione].toLowerCase()}; ticket e indennità per tutto l'anno. Tocca una bolla per cambiarla: si salva subito.`;
  }
  document.addEventListener('click', e => {
    const r = e.target.closest('#shiftCards [data-comp]');
    if (!r) return;
    if (typeof isAdmin === 'function' && !isAdmin()) return;
    codice = r.dataset.comp; stagione = SC.stagioneDi(SC.todayIsoLocal());
    const m = modale(); disegna(); m.hidden = false; document.body.classList.add('weekly-dialog-open');
  });

  const st = document.createElement('style');
  st.textContent = `.comp-elenco{display:block!important}.comp-gruppo{margin:14px 2px 6px;color:#7fb1b9;font:900 11px Manrope,sans-serif;letter-spacing:.1em;text-transform:uppercase}
  .comp-righe{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
  .comp-riga{display:grid;gap:3px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--c) 55%,#285560);border-left:5px solid var(--c);border-radius:14px;background:color-mix(in srgb,var(--c) 14%,transparent);color:#e8f7f7;text-align:left;cursor:pointer;font:inherit}
  .comp-riga:hover{background:color-mix(in srgb,var(--c) 24%,transparent)}.comp-riga b{font:800 16px Manrope,sans-serif;color:color-mix(in srgb,var(--c) 45%,#fff)}.comp-riga small{color:#9fb8c2;font-size:11.5px;line-height:1.3}
  .comp-stagioni{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0}.comp-stagioni button{padding:9px 6px;border:1px solid #285560;border-radius:12px;background:transparent;color:#cfe9ea;font:700 12.5px DM Sans,sans-serif;cursor:pointer}
  .comp-stagioni button.on{border-color:#45d9c7;background:rgba(45,212,191,.16);color:#fff}
  .comp-bolle{display:grid;grid-template-columns:1fr 1fr;gap:8px}.comp-bolla{cursor:pointer}.comp-bolla input[type=time]{width:100%;margin-top:4px;padding:6px;border-radius:10px;border:1px solid #285560;background:#0b222c;color:#fff;font:800 16px Manrope,sans-serif}
  .comp-dialog h3{color:color-mix(in srgb,var(--c) 50%,#fff)}.comp-dialog .comp-bolla.has-value{border-color:color-mix(in srgb,var(--c) 70%,#285560)!important;background:color-mix(in srgb,var(--c) 16%,transparent)!important}.comp-stagioni button.on{border-color:var(--c)!important;background:color-mix(in srgb,var(--c) 22%,transparent)!important}
  .comp-nota{margin:12px 0 0;color:#9fb8c2;font-size:12px;line-height:1.4}
  #saveAllShifts{display:none!important}`;
  document.head.appendChild(st);
  try { elenco(); } catch (_) {}
  scaricaCompetenze();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scaricaCompetenze(); });
})();
