// Backup e fonti dei dati: confronta la Distinta con un file (NaviSuite o Ore NaviG), la copia online o una copia automatica
// del telefono, mostra le differenze giorno per giorno e applica solo i giorni scelti.
(() => {
  const $ = id => document.getElementById(id);
  const D = window.NaviBackupDiff;
  let agent = null;
  try { agent = JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null'); } catch { agent = null; }
  const root = $('bdMain');
  if (!agent?.id) { $('bdLogin').hidden = false; return; }
  const id = String(agent.id);
  const K = { entries: `navidiaria.entries.v1.${id}`, meta: `navidiaria.entries.meta.${id}`, history: `navidiaria.entries.history.${id}`,
    dirty: `navidiaria.cloudDirty.${id}`, conv: `navidiaria.conversioni.${id}` };
  const leggi = (key, ripiego) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? ripiego; } catch { return ripiego; } };
  const locali = () => { const l = leggi(K.entries, []); return Array.isArray(l) ? l.filter(Boolean) : []; };
  const el = (tag, attrs = {}, ...figli) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); }
    n.append(...figli.flat().filter(f => f != null && f !== false));
    return n;
  };
  const data = iso => { const d = new Date(`${iso}T12:00:00`); return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).format(d); };
  const quando = v => { const d = new Date(v); return v && !Number.isNaN(d.getTime()) ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(d) : '—'; };
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const nomeMese = tag => { const [y, m] = tag.split('-').map(Number); return `${MESI[m - 1]} ${y}`; };

  const state = { attuali: { entries: [], origine: '' }, fonte: null, righe: [], uguali: 0, scelte: new Set(), mese: '', conv: false };

  // La Distinta con cui si confronta: con modifiche non ancora online vale il telefono, altrimenti la copia online
  // (su NaviBeta il telefono resta vuoto perche' non si puo' scrivere), con ripiego sul telefono.
  async function caricaAttuali() {
    const local = locali();
    if (localStorage.getItem(K.dirty) === '1') return { entries: local, origine: 'questo telefono (modifiche non ancora online)' };
    try {
      await window.NaviAdminFirebase.ready;
      const remoto = await window.NaviAdminFirebase.loadDiaria(id);
      if (remoto?.entries?.length) return { entries: remoto.entries.filter(Boolean), origine: `copia online, aggiornata ${quando(remoto.updatedAt)}` };
    } catch (errore) { console.warn('Backup: copia online non raggiungibile', errore); }
    return { entries: local, origine: 'questo telefono (copia online non raggiungibile)' };
  }

  // ---------- Fonti dei dati (solo admin): il database del telefono e quello su Firebase sono uguali? ----------
  async function verificaFonti() {
    const sezione = $('bdFonti'), meta = leggi(K.meta, {}), sporco = localStorage.getItem(K.dirty) === '1', locale = locali();
    const pb = (() => { try { return localStorage.getItem('navisuite.pbBase') || ''; } catch { return ''; } })();
    const card = (titolo, righe, azioni) => el('article', { class: 'bd-card' }, el('h3', {}, titolo), el('p', {}, ...righe), azioni ? el('div', { class: 'bd-azioni' }, azioni) : null);
    sezione.replaceChildren(el('p', {}, 'Controllo in corso…'));
    let remoto = null, errore = '';
    try { await window.NaviAdminFirebase.ready; remoto = await window.NaviAdminFirebase.loadDiaria(id); } catch (e) { errore = e.message || String(e); }
    const schede = [card('📱 Questo dispositivo', [`${locale.length} giorni · ultimo salvataggio ${quando(meta.updatedAt)}`, sporco ? el('b', { class: 'bd-warn' }, ' · modifiche non ancora online') : ''])];
    if (!remoto) schede.push(card('☁ Firebase', [`Non raggiungibile: ${errore}`]));
    else {
      const online = remoto.entries.filter(Boolean), { righe, uguali } = D.confronta(online, locale);
      const soloTelefono = righe.filter(r => r.stato === 'nuovo').length, diversi = righe.length - soloTelefono;
      const date = new Set(locale.map(e => e.date)), soloOnline = online.filter(e => !date.has(e.date)).length;
      const ok = !righe.length && !soloOnline;
      schede.push(card('☁ Firebase', [`${online.length} giorni · aggiornato ${quando(remoto.updatedAt)}`]),
        card(ok ? '✅ Database uguali' : '⚠ Database diversi', [ok ? `I ${uguali} giorni sul dispositivo coincidono con Firebase.` : `${diversi} giorni diversi · ${soloTelefono} solo sul dispositivo · ${soloOnline} solo su Firebase`],
          righe.length ? [el('button', { type: 'button', class: 'chip', onclick: () => impostaFonte({ nome: 'Dispositivo ↔ Firebase: il dispositivo ha…', tipo: 'dispositivo', entries: locale, conversioni: {}, soloLettura: true }, online) }, 'Vedi le differenze')] : null));
    }
    if (pb) schede.push(card('🗄 Server PocketBase', [pb]));
    sezione.replaceChildren(...schede);
  }

  // ---------- File ----------
  async function leggiFile(file, atteso) {
    const B = window.NaviDiariaBackup;
    let dati;
    if (/\.zip$/i.test(file.name) || file.type.includes('zip')) {
      const files = B.unzip(new Uint8Array(await file.arrayBuffer())), nome = Object.keys(files).find(n => /\.json$/i.test(n));
      if (!nome) throw new Error('Nello zip non c’è il file .json del backup');
      dati = JSON.parse(files[nome]);
    } else dati = JSON.parse(await file.text());
    const daK = window.NaviDiariaBackupK.riconosci(dati);
    if (atteso === 'navisuite' && daK) throw new Error('Questo è un backup di Ore NaviG 4.3: usa “Da Ore NaviG 4.3”');
    if (atteso === 'k' && !daK) throw new Error('Questo non è un backup di Ore NaviG 4.3: usa “Da NaviSuite”');
    if (daK) {
      const gia = new Map(state.attuali.entries.map(e => [e.date, e]));
      const totali = window.NaviDistintaTotals.create();
      const k = window.NaviDiariaBackupK.converti(dati, gia, { servizio: e => totali.serviceMinutes(e) });
      return { nome: `Ore NaviG · ${file.name}`, tipo: 'k', entries: k.entries, conversioni: k.conversioni, saltati: k.saltati };
    }
    if (dati?.tipo !== 'navidiaria-backup' || !Array.isArray(dati.entries)) throw new Error('Non è un backup della Distinta né di Ore NaviG');
    return { nome: `NaviSuite · ${file.name}`, tipo: 'navisuite', entries: dati.entries.filter(Boolean), conversioni: dati.conversioni || {}, agente: dati.agente };
  }

  // ---------- Differenze ----------
  function impostaFonte(fonte, base = state.attuali.entries) {
    const { righe, uguali } = D.confronta(base, fonte.entries);
    const conv = leggi(K.conv, { map: {} }).map || {};
    fonte.convDiverse = Object.entries(fonte.conversioni || {}).filter(([m, v]) => Number(conv[m]) !== Number(v));
    Object.assign(state, { fonte, righe, uguali, scelte: new Set(righe.map(r => r.date)), mese: '', conv: fonte.convDiverse.length > 0 });
    disegnaDiff();
    $('bdDiff').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function disegnaDiff() {
    const { fonte, righe } = state, box = $('bdDiff');
    box.hidden = false;
    const mesi = [...new Set(righe.map(r => r.date.slice(0, 7)))];
    const viste = righe.filter(r => !state.mese || r.date.startsWith(state.mese));
    const nuovi = righe.filter(r => r.stato === 'nuovo').length;
    const intestazione = el('header', { class: 'bd-diff-head' },
      el('h2', {}, fonte.nome),
      el('p', {}, `${nuovi} giorni nuovi · ${righe.length - nuovi} diversi · ${state.uguali} già uguali`, fonte.saltati?.length ? ` · ${fonte.saltati.length} saltati (nessun turno in Distinta)` : ''),
      fonte.agente?.id && String(fonte.agente.id) !== id ? el('p', { class: 'bd-warn' }, `⚠ Il backup è di ${fonte.agente.nome || fonte.agente.id}, non tuo.`) : null);
    const barra = el('div', { class: 'bd-barra' },
      mesi.length > 1 ? el('select', { 'aria-label': 'Mese', onchange: e => { state.mese = e.target.value; disegnaDiff(); } },
        el('option', { value: '' }, 'Tutti i mesi'), ...mesi.map(m => el('option', { value: m, selected: m === state.mese }, nomeMese(m)))) : null,
      fonte.soloLettura ? null : el('button', { type: 'button', class: 'chip', onclick: () => { viste.forEach(r => state.scelte.add(r.date)); disegnaDiff(); } }, 'Seleziona tutti'),
      fonte.soloLettura ? null : el('button', { type: 'button', class: 'chip', onclick: () => { viste.forEach(r => state.scelte.delete(r.date)); disegnaDiff(); } }, 'Nessuno'));
    const elenco = el('div', { class: 'bd-lista' }, ...(viste.length ? viste.map(riga) : [el('p', { class: 'bd-vuoto' }, righe.length ? 'Nessun giorno in questo mese.' : 'Nessuna differenza: la Distinta è già uguale a questa fonte.')]));
    const conv = fonte.convDiverse.length && !fonte.soloLettura ? el('label', { class: 'bd-conv' },
      el('input', { type: 'checkbox', checked: state.conv, onchange: e => { state.conv = e.target.checked; } }),
      ` Applica anche le ore trasformate in banca ore: ${fonte.convDiverse.map(([m, v]) => `${nomeMese(m)} ${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`).join(', ')}`) : null;
    const applica = fonte.soloLettura ? null : el('button', { type: 'button', class: 'chip on bd-applica', disabled: !righe.length && !fonte.convDiverse.length, onclick: applicaScelte }, `Applica ${state.scelte.size} giorni`);
    box.replaceChildren(...[intestazione, barra, elenco, conv, applica].filter(Boolean));
  }

  // Stessi colori e bolle del popup della giornata (day-popup.js / navidiaria-monthly.css)
  const COLORI_TURNO = { D1: '#2563eb', D2: '#059669', D3: '#ea580c', D4: '#c026d3', BIS: '#0891b2', BIS2: '#0891b2', DT: '#d4a900', AGB: '#2563eb', AGB2: '#2563eb', POND: '#dc2626', T1: '#2563eb', T2: '#059669', M1: '#ea580c', AGM: '#2563eb', AGT: '#d4a900', AGT1: '#d4a900', AGT2: '#d4a900', PONM: '#dc2626', R1: '#2563eb', R2: '#059669', R3: '#ea580c', R4: '#c026d3', CAR: '#0891b2', CAR1: '#0891b2', P1: '#2563eb', P2: '#059669', P3: '#ea580c', CAP: '#0891b2', CAP1: '#0891b2', SR1: '#7c3aed', SR2: '#c026d3', IE: '#64748b', PT: '#64748b', LD: '#64748b', LAV: '#64748b' };
  const COLORE_CAMPO = { straordinario: '245,158,11', cambi: '245,158,11', sentine: '245,158,11', bank: '34,197,94', allowanceRate: '168,85,247', overnight40: '99,102,241',
    ticket: '6,182,212', secondMeal: '14,165,233', embark: '249,115,22', cashHandling: '45,212,191', holidayWorked: '239,68,68', travel: '148,163,184', refuel: '245,158,11', note: '148,163,184' };
  const GRUPPO_STRAORD = ['straordinario', 'cambi', 'sentine', 'bank', 'refuel'];
  const VUOTO = v => v === '' || v === 0 || v === false;

  function bolla(c, nuovoGiorno) {
    const col = COLORE_CAMPO[c.key] || '148,163,184';
    return el('div', { class: `bd-bolla${nuovoGiorno ? '' : ' cambiata'}`, style: `--cc:${col}` },
      el('span', {}, c.label),
      el('strong', {}, c.testoDopo),
      nuovoGiorno ? null : el('small', {}, 'era ', c.testoPrima === '—' ? 'vuoto' : el('s', {}, c.testoPrima)));
  }

  function riga(r) {
    const nuovoGiorno = r.stato === 'nuovo';
    const campi = nuovoGiorno ? D.CAMPI.map(([key, label, leggi, testo]) => ({ key, label, dopo: leggi(r.entry), testoDopo: testo(leggi(r.entry)) })).filter(c => c.key !== 'shift' && !VUOTO(c.dopo)) : r.campi;
    const turno = nuovoGiorno ? { testoDopo: r.entry.shift } : r.campi.find(c => c.key === 'shift');
    const codice = String(turno?.testoDopo || r.entry.shift || '').toUpperCase();
    const colore = COLORI_TURNO[codice] || '#64748b';
    const straord = campi.filter(c => GRUPPO_STRAORD.includes(c.key)), altre = campi.filter(c => !GRUPPO_STRAORD.includes(c.key) && c.key !== 'shift');
    return el('label', { class: `bd-giorno ${r.stato}` },
      el('div', { class: 'bd-giorno-testa' },
        state.fonte?.soloLettura ? null : el('input', { type: 'checkbox', 'aria-label': `Applica ${data(r.date)}`, checked: state.scelte.has(r.date), onchange: e => { if (e.target.checked) state.scelte.add(r.date); else state.scelte.delete(r.date); $('bdDiff').querySelector('.bd-applica').textContent = `Applica ${state.scelte.size} giorni`; } }),
        el('b', {}, data(r.date)), el('span', { class: `bd-tag ${r.stato}` }, nuovoGiorno ? 'Nuovo' : 'Diverso')),
      el('div', { class: 'bd-turno', style: `--c:${colore}` }, el('b', {}, turno?.testoDopo || r.entry.shift || '—'), turno?.testoPrima ? el('small', {}, 'era ', el('s', {}, turno.testoPrima)) : null),
      straord.length ? el('section', { class: 'bd-straord' }, el('small', {}, 'STRAORDINARI'), el('div', { class: 'bd-bolle' }, straord.map(c => bolla(c, nuovoGiorno)))) : null,
      altre.length ? el('div', { class: 'bd-bolle' }, altre.map(c => bolla(c, nuovoGiorno))) : null);
  }

  // ---------- Applicazione ----------
  async function applicaScelte() {
    if (window.__naviBetaReadOnly) return alert('NaviBeta è in sola lettura: puoi guardare le differenze, ma non applicarle.');
    const { fonte, righe } = state;
    const quanti = righe.filter(r => state.scelte.has(r.date)).length, convs = state.conv ? fonte.convDiverse : [];
    if (!quanti && !convs.length) return;
    if (!confirm(`Applicare ${quanti} giorni${convs.length ? ` e ${convs.length} mesi di ore trasformate` : ''} dalla fonte “${fonte.nome}”?\nPrima si salva una copia automatica della Distinta attuale.`)) return;
    const attuali = state.attuali.entries;
    try { // copia di sicurezza, come fa la Distinta
      const storia = leggi(K.history, []);
      storia.push({ savedAt: new Date().toISOString(), reason: 'prima di importare un backup', entryCount: attuali.length, entries: attuali });
      localStorage.setItem(K.history, JSON.stringify(storia.slice(-35)));
    } catch { /* memoria piena: si prosegue */ }
    const { entries } = D.applica(attuali, righe, state.scelte);
    const adesso = Date.now();
    entries.forEach(e => { if (state.scelte.has(e.date) && !e.modificatoIl) e.modificatoIl = adesso; });
    localStorage.setItem(K.entries, JSON.stringify(entries));
    localStorage.setItem(K.meta, JSON.stringify({ updatedAt: new Date().toISOString(), entryCount: entries.length }));
    localStorage.setItem(K.dirty, '1');
    if (convs.length) {
      const stato = leggi(K.conv, { map: {} });
      stato.map = { ...(stato.map || {}), ...Object.fromEntries(convs) }; stato.updatedAt = new Date().toISOString();
      localStorage.setItem(K.conv, JSON.stringify(stato));
      window.NaviAdminFirebase?.saveDiariaConversioni?.(id, stato).catch(e => console.warn('Ore trasformate non salvate online', e));
    }
    let esito = 'salvate su questo telefono';
    try { await window.NaviAdminFirebase.ready; await window.NaviAdminFirebase.saveDiaria(id, entries); localStorage.removeItem(K.dirty); esito = 'salvate anche online'; }
    catch (errore) { console.warn(errore); esito = 'salvate sul telefono, online al prossimo accesso alla Distinta'; }
    $('bdDiff').replaceChildren(el('p', { class: 'bd-ok' }, `✓ ${quanti} giorni applicati, ${esito}.`), el('a', { class: 'chip on', href: 'navidiaria.html' }, 'Apri la Distinta'));
    if (!$('bdAdmin').hidden) verificaFonti();
  }

  for (const [campo, atteso] of [['bdFileNavi', 'navisuite'], ['bdFileK', 'k']]) {
    $(campo).addEventListener('change', async e => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (!state.attuali.origine) { $('bdFileInfo').textContent = 'Aspetta: sto leggendo la Distinta.'; e.target.value = ''; return; }
      $('bdFileInfo').textContent = 'Lettura…';
      try { const fonte = await leggiFile(f, atteso); $('bdFileInfo').textContent = ''; impostaFonte(fonte); }
      catch (errore) { $('bdFileInfo').textContent = `File non leggibile: ${errore.message || errore}`; }
      e.target.value = '';
    });
  }
  $('bdScarica').addEventListener('click', () => {
    const B = window.NaviDiariaBackup, lista = locali();
    const base = `Distinta-${B.nomeFile(agent.name)}-${B.oggi()}`;
    const json = { tipo: 'navidiaria-backup', versione: 1, creato: new Date().toISOString(), agente: { id, nome: agent.name || '', residenza: agent.residence || '' },
      entries: lista, conversioni: (leggi(K.conv, { map: {} }).map) || {} };
    B.scarica(`${base}.zip`, B.zip([{ name: `${base}.json`, data: JSON.stringify(json, null, 1) }, { name: `${base}.csv`, data: B.csv([{ id, nome: agent.name, entries: lista, conversioni: json.conversioni }]) }]), 'application/zip');
  });
  if (!window.NaviDiariaOvertime) window.NaviDiariaOvertime = { setOrdinary: (e, v, s) => window.NaviOvertimeComponents.setOrdinary(e, v, s) };
  root.hidden = false;
  if (window.__naviBetaReadOnly) $('bdBeta').hidden = false;
  caricaAttuali().then(a => { state.attuali = a; });
  if (window.NaviRoles?.isAdminAgent?.(agent)) { $('bdAdmin').hidden = false; verificaFonti(); }
})();
