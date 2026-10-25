// Impostazioni › Guide popup › card "📊 Sondaggi" (solo admin): domande e risposte modificabili, anteprima,
// attiva/chiudi (si pubblica solo quando lo decide l'admin), nuovo sondaggio, risultati, commenti ed esportazione Excel.
// Le risposte sono anonime.
(function () {
  'use strict';
  if (!/(?:^|\/)impostazioni\.html$/i.test(location.pathname)) return;
  const COLORI = [['#67d7e6', 'Ciano'], ['#fbbf24', 'Giallo'], ['#a78bfa', 'Viola'], ['#fb923c', 'Arancione'], ['#2dd4bf', 'Turchese'], ['#52c879', 'Verde'], ['#f472b6', 'Rosa'], ['#fb7185', 'Rosso']];
  const TIPI = [['single', 'Una scelta'], ['multi', 'Più scelte'], ['text', 'Testo libero']];
  const sessione = () => { try { return JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null'); } catch (_) { return null; } };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const oggi = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };
  const nuovaVersione = () => { const a = 'abcdefghijkmnpqrstuvwxyz23456789', b = new Uint8Array(3); crypto.getRandomValues(b); return `S${oggi()}${Array.from(b, x => a[x % a.length]).join('')}`; };
  const F = () => window.NaviAdminFirebase;
  let config = null, risposte = [], completati = 0, bozza = null;
  const domande = () => config?.questions?.length ? config.questions : (F()?.defaultSurveyQuestions?.() || []);

  function injectStyle() {
    if (document.getElementById('survey-admin-style')) return;
    const s = el('style'); s.id = 'survey-admin-style';
    s.textContent = '#survey-admin-card{--c:#fbbf24;margin-top:14px;padding:16px;border-radius:16px;border:1px solid color-mix(in srgb,var(--c) 40%,transparent);background:color-mix(in srgb,var(--c) 10%,#102733);color:#eaf2f4}'
      + '#survey-admin-card h3{margin:0 0 4px;color:var(--c)}#survey-admin-card .sa-stato{margin:0 0 10px;color:#9fb8c2;font-size:13px}'
      + '#survey-admin-card .sa-azioni{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px}'
      + '#survey-admin-card button{padding:8px 12px;border-radius:999px;border:1px solid #1f4250;background:#102733;color:#eaf2f4;font-weight:800;cursor:pointer}'
      + '#survey-admin-card .sa-primario{border:0;background:linear-gradient(90deg,#2dd4bf,#67d7e6);color:#06231f}'
      + '#survey-admin-card .sa-num{display:flex;gap:16px;flex-wrap:wrap;margin:6px 0 12px}#survey-admin-card .sa-num b{display:block;font-size:24px;color:#2dd4bf}#survey-admin-card .sa-num span{color:#9fb8c2;font-size:12px}'
      + '#survey-admin-card h4{margin:12px 0 6px;color:var(--k);font-size:13px}'
      + '#survey-admin-card .sa-riga{display:grid;grid-template-columns:minmax(110px,170px) 1fr 70px;gap:8px;align-items:center;margin:4px 0;font-size:12px}'
      + '#survey-admin-card .sa-barra{height:10px;border-radius:99px;background:#143140;overflow:hidden}#survey-admin-card .sa-barra i{display:block;height:100%;background:var(--k)}'
      + '#survey-admin-card .sa-riga em{font-style:normal;color:#9fb8c2;text-align:right}'
      + '#survey-admin-card .sa-commento{margin:5px 0;padding:8px 10px;border-radius:10px;border:1px solid color-mix(in srgb,var(--k) 40%,transparent);background:color-mix(in srgb,var(--k) 10%,#102733);font-size:13px;white-space:pre-wrap}'
      + '#survey-admin-card .sa-msg{min-height:16px;color:#9fb8c2;font-size:12px}'
      + '#survey-admin-card details.sa-editor{margin:4px 0 12px;padding:10px;border-radius:12px;border:1px solid #1f4250;background:#0b1c26}'
      + '#survey-admin-card details.sa-editor summary{cursor:pointer;font-weight:900;color:#fbbf24}'
      + '#survey-admin-card .sa-dom{margin:10px 0;padding:10px;border-radius:12px;border:1px solid color-mix(in srgb,var(--k) 45%,transparent);background:color-mix(in srgb,var(--k) 10%,#102733)}'
      + '#survey-admin-card .sa-dom label{display:block;margin:6px 0 3px;color:#9fb8c2;font-size:11px;font-weight:800;text-transform:uppercase}'
      + '#survey-admin-card .sa-dom input,#survey-admin-card .sa-dom select,#survey-admin-card .sa-dom textarea{box-sizing:border-box;width:100%;padding:8px;border:1px solid #1f4250;border-radius:9px;background:#071923;color:#eaf2f4;font:inherit}'
      + '#survey-admin-card .sa-dom textarea{min-height:90px;resize:vertical}'
      + '#survey-admin-card .sa-dom .sa-linea{display:grid;grid-template-columns:56px 1fr;gap:8px}#survey-admin-card .sa-dom .sa-linea2{display:grid;grid-template-columns:1fr 1fr;gap:8px}'
      + '#survey-admin-card .sa-dom .sa-mini{display:flex;gap:6px;justify-content:flex-end;margin-top:8px}#survey-admin-card .sa-dom .sa-mini button{padding:5px 10px}';
    document.head.appendChild(s);
  }

  const conDati = (r, qs) => r && qs.some(q => Array.isArray(r[q.key]) ? r[q.key].length : r[q.key]);
  const contaScelte = (lista, q) => q.options.map(o => [o, lista.filter(r => Array.isArray(r[q.key]) ? r[q.key].includes(o) : r[q.key] === o).length]);
  const conRisposta = (lista, q) => lista.filter(r => Array.isArray(r[q.key]) ? r[q.key].length : r[q.key]).length;

  function blocco(box, titolo, colore, righe, totale) {
    const h = el('h4', '', titolo); h.style.setProperty('--k', colore); box.appendChild(h);
    righe.forEach(([nome, n]) => {
      const pct = totale ? Math.round(n / totale * 100) : 0;
      const riga = el('div', 'sa-riga'); riga.style.setProperty('--k', colore);
      const barra = el('div', 'sa-barra'), fill = el('i'); fill.style.width = `${pct}%`; barra.appendChild(fill);
      riga.append(el('span', '', nome), barra, el('em', '', `${n} · ${pct}%`));
      box.appendChild(riga);
    });
  }

  // ---- Editor delle domande (si lavora su una bozza; "Salva domande" la registra) ----
  function editor(card) {
    const box = card.querySelector('.sa-editor-lista'); box.replaceChildren();
    bozza.forEach((q, i) => {
      const d = el('div', 'sa-dom'); d.style.setProperty('--k', q.color);
      const linea = el('div', 'sa-linea'), icona = el('input'), titolo = el('input');
      icona.value = q.icon || ''; icona.maxLength = 4; icona.placeholder = '🙂'; titolo.value = q.title; titolo.maxLength = 140;
      icona.addEventListener('input', () => { q.icon = icona.value; }); titolo.addEventListener('input', () => { q.title = titolo.value; });
      linea.append(icona, titolo); d.append(el('label', '', `Domanda ${i + 1} · icona e testo`), linea);
      const linea2 = el('div', 'sa-linea2'), tipo = el('select'), colore = el('select');
      TIPI.forEach(([v, t]) => { const o = el('option', '', t); o.value = v; o.selected = q.type === v; tipo.appendChild(o); });
      COLORI.forEach(([v, t]) => { const o = el('option', '', t); o.value = v; o.selected = q.color === v; colore.appendChild(o); });
      tipo.addEventListener('change', () => { q.type = tipo.value; editor(card); });
      colore.addEventListener('change', () => { q.color = colore.value; d.style.setProperty('--k', q.color); });
      linea2.append(tipo, colore); d.append(el('label', '', 'Tipo e colore'), linea2);
      if (q.type !== 'text') {
        const opz = el('textarea');
        opz.value = (q.options || []).join('\n');
        opz.addEventListener('input', () => { q.options = opz.value.split('\n').map(x => x.trim()).filter(Boolean); });
        d.append(el('label', '', 'Risposte (una per riga)'), opz);
      }
      const mini = el('div', 'sa-mini');
      const mb = (t, f) => { const b = el('button', '', t); b.type = 'button'; b.addEventListener('click', f); mini.appendChild(b); };
      if (i > 0) mb('↑', () => { [bozza[i - 1], bozza[i]] = [bozza[i], bozza[i - 1]]; editor(card); });
      if (i < bozza.length - 1) mb('↓', () => { [bozza[i + 1], bozza[i]] = [bozza[i], bozza[i + 1]]; editor(card); });
      mb('Togli', () => { if (confirm('Togliere questa domanda?')) { bozza.splice(i, 1); editor(card); } });
      d.appendChild(mini);
      box.appendChild(d);
    });
  }

  async function salvaDomande(card) {
    const msg = card.querySelector('.sa-msg');
    const pulite = F().normalizeSurveyQuestions(bozza.map(q => ({ ...q, options: q.options || [] })));
    if (!pulite.length) { msg.textContent = 'Serve almeno una domanda con delle risposte.'; return; }
    let version = config?.version || nuovaVersione();
    const enabled = !!config?.enabled;
    // con risposte già raccolte, domande diverse = sondaggio nuovo (le vecchie risposte restano archiviate)
    if (config?.version && risposte.length) {
      if (!confirm('Questo sondaggio ha già delle risposte.\nSalvo le domande come NUOVO sondaggio? Le risposte di prima restano archiviate e tutti rivedranno il popup.')) return;
      version = nuovaVersione();
    }
    try {
      config = await F().saveSurveyConfig({ enabled, version, questions: pulite });
      await aggiorna(card);
      msg.textContent = enabled ? '✓ Domande salvate (il sondaggio è aperto)' : '✓ Domande salvate (il sondaggio resta chiuso finché non lo attivi)';
    } catch (e) { msg.textContent = `Non salvato: ${e.message}`; }
  }

  function disegna(card) {
    const stato = card.querySelector('.sa-stato'), ris = card.querySelector('.sa-risultati'), attiva = card.querySelector('[data-sa="attiva"]');
    const v = config?.version || '', qs = domande();
    stato.textContent = v ? `Versione ${v} · ${config.enabled ? 'aperto: gli agenti lo vedono' : 'chiuso: gli agenti non lo vedono'}` : 'Nessun sondaggio pubblicato: prepara le domande, poi premi Attiva';
    attiva.textContent = config?.enabled ? 'Chiudi' : 'Attiva';
    ris.replaceChildren();
    if (!v) return;
    const validi = risposte.filter(r => conDati(r, qs));
    const num = el('div', 'sa-num');
    [[completati, 'agenti che hanno completato'], [validi.length, 'con almeno una risposta']].forEach(([n, t]) => { const d = el('div'); d.append(el('b', '', String(n)), el('span', '', t)); num.appendChild(d); });
    ris.appendChild(num);
    qs.forEach(q => {
      const titolo = `${q.icon ? q.icon + ' ' : ''}${q.title}`;
      if (q.type !== 'text') { blocco(ris, titolo, q.color, contaScelte(validi, q), conRisposta(validi, q)); return; }
      const testi = validi.filter(r => r[q.key]).sort((a, b) => String(b.day).localeCompare(String(a.day))).slice(0, 20);
      const h = el('h4', '', `${titolo} · ultimi ${testi.length}`); h.style.setProperty('--k', q.color); ris.appendChild(h);
      testi.forEach(r => { const c = el('div', 'sa-commento', `${r.day || ''} · ${r[q.key]}`); c.style.setProperty('--k', q.color); ris.appendChild(c); });
    });
  }

  async function aggiorna(card) {
    const msg = card.querySelector('.sa-msg');
    msg.textContent = '';
    try {
      config = await F().getSurveyConfig();
      const v = config?.version;
      [risposte, completati] = v ? await Promise.all([F().listSurveyResponses(v), F().countSurveyDone(v)]) : [[], 0];
    } catch (e) { msg.textContent = `Dati non disponibili: ${e.message}`; }
    bozza = JSON.parse(JSON.stringify(domande()));
    editor(card); disegna(card);
  }

  function esporta() {
    const v = config?.version; if (!v) { alert('Nessun sondaggio da esportare.'); return; }
    const qs = domande(), validi = risposte.filter(r => conDati(r, qs));
    const tabella = [];
    qs.filter(q => q.type !== 'text').forEach(q => { const tot = conRisposta(validi, q); contaScelte(validi, q).forEach(([o, n]) => tabella.push([q.title, o, n, { v: tot ? n / tot : 0, pct: true }])); });
    const riepilogo = [['Sondaggio NaviSuite', ''], ['Versione', v], ['Agenti che hanno completato il popup', completati], ['Risposte con almeno un dato', validi.length], [],
      ['Domanda', 'Risposta', 'N.', '%'], ...tabella];
    const righe = [['Data', ...qs.map(q => q.title)],
      ...validi.slice().sort((a, b) => String(a.day).localeCompare(String(b.day))).map(r => [r.day || '', ...qs.map(q => Array.isArray(r[q.key]) ? r[q.key].join(', ') : (r[q.key] || ''))])];
    window.NaviSurveyXlsx.download(`sondaggio-${v}-${oggi()}.xlsx`, [
      { name: 'Riepilogo', rows: riepilogo, widths: [40, 30, 8, 8], headerRows: [0, 5] },
      { name: 'Risposte', rows: righe, widths: [12, ...qs.map(q => q.type === 'text' ? 60 : 30)], headerRows: 1 }
    ]);
  }

  function crea() {
    injectStyle();
    const card = el('div'); card.id = 'survey-admin-card';
    card.append(el('h3', '', '📊 Sondaggi'), el('p', 'sa-stato', 'Caricamento…'));
    const az = el('div', 'sa-azioni'), msg = el('div', 'sa-msg'), ris = el('div', 'sa-risultati');
    const btn = (testo, chiave, primario, dove = az) => { const b = el('button', primario ? 'sa-primario' : '', testo); b.type = 'button'; b.dataset.sa = chiave; dove.appendChild(b); return b; };
    btn('👁 Anteprima', 'anteprima').addEventListener('click', () => window.NaviSurvey?.preview?.(F().normalizeSurveyQuestions(bozza || domande())));
    btn('Attiva', 'attiva', true).addEventListener('click', async () => {
      const apri = !config?.enabled;
      if (apri && !confirm('Pubblicare il sondaggio? Da ora gli agenti lo vedranno in un popup.')) return;
      try { config = await F().saveSurveyConfig({ enabled: apri, version: config?.version || nuovaVersione(), questions: domande() }); await aggiorna(card); }
      catch (e) { msg.textContent = `Non salvato: ${e.message}`; }
    });
    btn('Nuovo sondaggio', 'nuovo').addEventListener('click', async () => {
      if (!confirm('Creare un nuovo sondaggio con le domande attuali?\nResta chiuso finché non premi Attiva; le risposte di quello di prima restano archiviate.')) return;
      try { config = await F().saveSurveyConfig({ enabled: false, version: nuovaVersione(), questions: domande() }); await aggiorna(card); }
      catch (e) { msg.textContent = `Non salvato: ${e.message}`; }
    });
    btn('⬇ Esporta Excel', 'esporta').addEventListener('click', esporta);
    btn('↻ Aggiorna', 'aggiorna').addEventListener('click', () => aggiorna(card));
    const ed = el('details', 'sa-editor'); ed.appendChild(el('summary', '', '✏️ Domande e risposte'));
    const lista = el('div', 'sa-editor-lista'), az2 = el('div', 'sa-azioni');
    btn('＋ Aggiungi domanda', 'aggiungi', false, az2).addEventListener('click', () => { bozza.push({ key: '', icon: '', title: 'Nuova domanda', color: '#2dd4bf', type: 'single', options: ['Sì', 'No'] }); editor(card); });
    btn('Domande di partenza', 'ripristina', false, az2).addEventListener('click', () => { if (confirm('Rimettere le domande di partenza nella bozza?')) { bozza = F().defaultSurveyQuestions(); editor(card); } });
    btn('Salva domande', 'salva', true, az2).addEventListener('click', () => salvaDomande(card));
    ed.append(lista, az2);
    card.append(az, ed, msg, ris);
    return card;
  }

  let tentativi = 0;
  const timer = setInterval(() => {
    tentativi++;
    const sez = document.getElementById('gestione-avvisi'), grid = document.getElementById('announcement-grid');
    if (tentativi > 40) { clearInterval(timer); return; }
    if (!sez || sez.hidden || !grid || !window.NaviRoles?.isAdminAgent?.(sessione()) || !F()?.getSurveyConfig) return;
    clearInterval(timer);
    if (document.getElementById('survey-admin-card')) return;
    // dopo la griglia (fratello): il re-render della griglia non la cancella
    const card = crea(); grid.after(card); aggiorna(card);
  }, 500);
})();
