// Pagina Distinte (solo admin): legge le distinte di tutti (database o file di backup), le mostra per agente e mese,
// e manda a ogni agente la sua (uno .zip con il backup ricaricabile nella Distinta e il CSV da aprire con Excel).
(() => {
  'use strict';
  const B = window.NaviDiariaBackup, R = window.NaviRoles;
  const $ = id => document.getElementById(id);
  const sessione = (() => { try { return JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null'); } catch { return null; } })();
  if (!R?.isAdminAgent?.(sessione)) { location.replace('index.html?home=1'); return; }
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ore = m => { const n = Math.round(Number(m) || 0), a = Math.abs(n); return n ? `${n < 0 ? '-' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}` : '—'; };
  // giorno di lavoro: con un turno e non riposo o malattia (i giorni senza dati non contano)
  const lavoro = e => !!e && !!String(e.shift || '').trim() && !['RIP', 'RIPOSO', 'MALATTIA'].includes(String(e.shift || '').toUpperCase());
  const status = t => { $('status').textContent = t; };
  let agenti = [], scelto = null;
  // periodo scelto: un mese ("2026-10") o un anno intero ("2026")
  const etichetta = p => (p.length === 4 ? `anno ${p}` : `${MESI[Number(p.slice(5)) - 1]} ${p.slice(0, 4)}`);
  const convPeriodo = (a, p) => Object.fromEntries(Object.entries(a.conversioni || {}).filter(([k]) => k.startsWith(p)));
  const sommaConv = (a, p) => Object.values(convPeriodo(a, p)).reduce((s, v) => s + (Number(v) || 0), 0);
  const inviati = (() => { try { return JSON.parse(localStorage.getItem('navisuite.distinteInviate') || '{}'); } catch { return {}; } })();
  const segnaInviato = id => { inviati[`${id}|${$('mese').value}`] = new Date().toISOString(); try { localStorage.setItem('navisuite.distinteInviate', JSON.stringify(inviati)); } catch { /* niente */ } };

  // da backup centrale (database o file) all'elenco agenti
  function carica(dati) {
    const au = dati?.adminUpdates || dati || {};
    const diaria = au.diaria || {}, conv = au.diariaConversioni || {};
    const nomi = new Map();
    Object.values(dati?.schedule?.residenze || {}).forEach(l => (l || []).forEach(a => { if (a?.id) nomi.set(String(a.id), a.agente || ''); if (a?.agent_uid) nomi.set(String(a.agent_uid), a.agente || ''); }));
    (window.NaviSharedData?.directory?.() || []).forEach(a => { if (a?.id && !nomi.has(String(a.id))) nomi.set(String(a.id), a.name); });
    Object.values(au.userRegistry || {}).forEach(u => { if (u?.id && u.name && !nomi.has(String(u.id))) nomi.set(String(u.id), u.name); });
    Object.values(au.agentProfiles || {}).forEach(p => { if (p?.id && p.name && !nomi.has(String(p.id))) nomi.set(String(p.id), p.name); });
    agenti = Object.entries(diaria).map(([key, r]) => {
      const id = String(r?.agentId || key);
      return { id, nome: nomi.get(id) || id.replace(/^AG_/, '').replace(/_([A-Z])$/, ' $1.').replace(/_/g, ' '),
        entries: (Array.isArray(r?.entries) ? r.entries : []).filter(e => e?.date).sort((a, b) => a.date.localeCompare(b.date)),
        conversioni: conv[key]?.map || conv[id]?.map || {}, aggiornata: r?.updatedAt || '' };
    }).filter(a => a.entries.length).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    // mesi presenti, il piu' recente gia' passato come proposta
    const mesi = [...new Set(agenti.flatMap(a => a.entries.map(e => e.date.slice(0, 7))))].sort().reverse();
    const attuale = new Date().toISOString().slice(0, 7);
    const anni = [...new Set(mesi.map(m => m.slice(0, 4)))];
    $('mese').innerHTML = anni.map(y => `<optgroup label="${y}"><option value="${y}">Tutto il ${y}</option>` +
      mesi.filter(m => m.startsWith(y)).map(m => `<option value="${m}">${MESI[Number(m.slice(5)) - 1]} ${y}</option>`).join('') + '</optgroup>').join('');
    $('mese').value = mesi.find(m => m < attuale) || mesi[0] || '';
    $('elenco').hidden = !agenti.length;
    status(`${agenti.length} distinte lette${dati?.creato ? ` · backup del ${String(dati.creato).slice(0, 10)}` : ''}.`);
    elenco();
    riepilogoTutti();
  }

  function elenco() {
    const q = $('cerca').value.trim().toLocaleLowerCase('it'), mese = $('mese').value;
    $('agenti').innerHTML = agenti.filter(a => !q || a.nome.toLocaleLowerCase('it').includes(q) || a.id.includes(q)).map(a => {
      const giorni = a.entries.filter(e => e.date.startsWith(mese)), inv = inviati[`${a.id}|${mese}`];
      return `<button type="button" class="agente${scelto?.id === a.id ? ' on' : ''}" data-id="${esc(a.id)}"><b>${esc(a.nome)}</b>` +
        `<small>n. ${esc(a.id)} · ${giorni.length} giorni ${mese.length === 4 ? `nel ${mese}` : 'nel mese'}</small>` +
        `<span class="stato${inv ? ' ok' : ''}">${inv ? `✓ inviata il ${new Date(inv).toLocaleDateString('it-IT')}` : 'da inviare'}</span></button>`;
    }).join('') || '<p class="status">Nessun agente trovato.</p>';
  }

  // Settimane del periodo di un agente (solo quelle con dati): [{dal, al, lavorate, straordinario, giorni}]
  function settimaneDi(a, periodo) {
    const byDate = new Map(a.entries.map(e => [e.date, e]));
    return B.domeniche(periodo).map(dom => {
      const w = B.sett(a.entries, dom), giorni = [];
      for (let d = new Date(`${w.dal}T12:00:00`); ; d.setDate(d.getDate() + 1)) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        giorni.push(byDate.get(iso) || { date: iso, shift: '' });
        if (iso === dom) break;
      }
      return { ...w, giorni };
    }).filter(w => w.giorni.some(e => e.shift));
  }
  // festivita' come nella Distinta: feste nazionali e Pasquetta (la domenica e' l'indennita' turno domenicale)
  const FESTE = new Set(['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26']);
  function pasquetta(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mese = Math.floor((h + l - 7 * m + 114) / 31), giorno = ((h + l - 7 * m + 114) % 31) + 1, x = new Date(y, mese - 1, giorno + 1, 12); return `${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
  const festivo = e => (e.holidayWorked === undefined ? FESTE.has(e.date.slice(5)) || e.date.slice(5) === pasquetta(Number(e.date.slice(0, 4))) : !!e.holidayWorked);
  // Tutte le competenze di un agente nel periodo (mese o anno)
  const COMPETENZE = [['giorni', 'Giorni', 'n'], ['lavorate', 'Ore lavorate', 'h'], ['straordinari', 'Straordinari', 'h'], ['trasformati', 'Trasformati', 'h'], ['pagati', 'Str. pagati', 'h'],
    ['banca', 'Banca ore', 'h'], ['ticket', 'Ticket', 'n'], ['ticket2', '2° ticket', 'n'], ['d9', 'Diaria 9%', 'n'], ['d24', 'Diaria 24%', 'n'], ['d50', 'Diaria 50%', 'n'],
    ['pernotto', 'Pernotto 40%', 'n'], ['festivi', 'Festività', 'n'], ['domeniche', 'Ind. dom.', 'n'], ['imbarco', 'Imbarco', 'n'], ['denaro', 'Maneggio denaro', 'n'],
    ['aliscafo', 'Aliscafo', 'n'], ['rf', 'Recupero forfait', 'n'], ['trasferte', 'Trasferte', 'n'], ['rifornimenti', 'Rifornimenti', 'n'], ['cambi', 'Cambi', 'h'], ['sentine', 'Sentine', 'h'], ['mancatiRiposi', 'Mancati riposi', 'n']];
  function competenze(a, periodo, settimane = settimaneDi(a, periodo)) {
    const gg = settimane.flatMap(w => w.giorni), lav = gg.filter(lavoro), n = f => lav.filter(f).length;
    const straordinari = settimane.reduce((s, w) => s + w.straordinario, 0), trasformati = sommaConv(a, periodo);
    return { giorni: lav.length, lavorate: settimane.reduce((s, w) => s + w.lavorate, 0), straordinari, trasformati, pagati: Math.max(0, straordinari - trasformati),
      banca: gg.reduce((s, e) => s + (Math.round(Number(e.bank) || 0)), 0) + Math.round(trasformati * 1.1),
      ticket: n(e => e.ticketPresence ?? e.mealUsed), ticket2: n(e => Number(e.secondMeal) > 0), d9: n(e => Number(e.allowanceRate) === 9), d24: n(e => Number(e.allowanceRate) === 24), d50: n(e => Number(e.allowanceRate) === 50),
      pernotto: n(e => e.overnight40), festivi: n(festivo), domeniche: n(e => new Date(`${e.date}T12:00:00`).getDay() === 0), imbarco: n(e => e.embark), denaro: n(e => e.cashHandling),
      aliscafo: n(e => (e.hydrofoil === undefined ? String(e.shift).toUpperCase() === 'SR1' : Number(e.hydrofoil) > 0)), rf: n(e => e.rf), trasferte: n(e => e.travel),
      rifornimenti: n(e => e.refuelDone === true || Number(e.refuel) > 0), cambi: lav.reduce((s, e) => s + B.causali(e).cambio, 0), sentine: lav.reduce((s, e) => s + B.causali(e).sentine, 0),
      mancatiRiposi: lav.reduce((s, e) => s + (Number(e.missedRest) || 0), 0) };
  }
  const valore = (c, [k, , tipo]) => (tipo === 'h' ? (c[k] ? ore(c[k]) : '') : (c[k] || ''));
  const intestazione = () => COMPETENZE.map(([, t]) => `<th>${esc(t)}</th>`).join('');
  const celle = c => COMPETENZE.map(col => `<td${col[0] === 'straordinari' ? ' class="forte"' : ''}>${esc(valore(c, col))}</td>`).join('');

  // Riepilogo di tutti gli agenti nel periodo scelto: un agente per riga, tutte le competenze
  function riepilogoTutti() {
    const periodo = $('mese').value;
    if (!agenti.length || !periodo) { $('tutti-card').hidden = true; return; }
    const righe = agenti.map(a => ({ a, c: competenze(a, periodo) })).filter(x => x.c.giorni);
    const somma = Object.fromEntries(COMPETENZE.map(([k]) => [k, righe.reduce((s, x) => s + (Number(x.c[k]) || 0), 0)]));
    $('tutti-titolo').textContent = `Riepilogo di tutti · ${etichetta(periodo)}`;
    $('tutti-tabella').innerHTML = `<thead><tr><th class="fisso">Agente</th>${intestazione()}</tr></thead><tbody>` +
      righe.map(({ a, c }) => `<tr data-id="${esc(a.id)}"><td class="fisso"><b>${esc(a.nome)}</b> <small>${esc(a.id)}</small></td>${celle(c)}</tr>`).join('') +
      `<tr class="tot"><td class="fisso">Totale · ${righe.length} agenti</td>${celle(somma)}</tr></tbody>`;
    $('tutti-card').hidden = false;
    riepilogoTutti.righe = righe;
  }

  // Periodo di competenza come nella Distinta: le settimane (lunedi'-domenica) la cui domenica cade nel mese (o nell'anno).
  // Lo straordinario e' quello oltre le 39 ore di ogni settimana.
  function dettaglio() {
    const a = scelto, periodo = $('mese').value;
    if (!a) { $('dettaglio').hidden = true; return; }
    const settimane = settimaneDi(a, periodo);
    const giorni = settimane.flatMap(w => w.giorni), lav = giorni.filter(lavoro);
    const tot = f => lav.reduce((s, e) => s + f(e), 0);
    const straord = settimane.reduce((s, w) => s + w.straordinario, 0), conv = sommaConv(a, periodo);
    const fmt = iso => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
    $('det-numero').textContent = `AGENTE N. ${a.id} · ${etichetta(periodo).toUpperCase()}${settimane.length ? ` · DAL ${fmt(settimane[0].dal)} AL ${fmt(settimane.at(-1).al)}` : ''}`;
    $('det-nome').textContent = a.nome;
    $('riepilogo').innerHTML = [['Giorni lavorati', lav.length], ['Ore lavorate', ore(tot(B.lavorate))], ['Straordinari (oltre 39 h a settimana)', ore(straord)],
      ...(conv ? [['Trasformati in banca ore', `${ore(conv)} → +${ore(Math.round(conv * 1.1))}`], ['Straordinari pagati', ore(Math.max(0, straord - conv))]] : []),
      ['Banca ore', ore(giorni.reduce((s, e) => s + (Math.round(Number(e.bank) || 0)), 0) + Math.round(conv * 1.1))], ['Ticket', lav.filter(e => e.ticketPresence ?? e.mealUsed).length],
      ['Diarie', lav.filter(e => e.allowanceRate != null).length]]
      .map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('');
    // anno intero: riepilogo dei 12 mesi in una tabella, sopra ai giorni
    let mensile = '';
    if (periodo.length === 4) {
      const righeMesi = MESI.map((nome, i) => {
        const mese = `${periodo}-${String(i + 1).padStart(2, '0')}`, ws = settimane.filter(w => w.al.startsWith(mese));
        if (!ws.some(w => w.giorni.some(lavoro))) return `<tr class="vuoto"><td class="fisso">${esc(nome)}</td><td colspan="${COMPETENZE.length}">—</td></tr>`;
        return `<tr><td class="fisso">${esc(nome)}</td>${celle(competenze(a, mese, ws))}</tr>`;
      });
      mensile = `<h3 class="tit-mesi">Riepilogo mensile ${esc(periodo)}</h3><div class="wrap mesi"><table><thead><tr><th class="fisso">Mese</th>${intestazione()}</tr></thead><tbody>${righeMesi.join('')}` +
        `<tr class="tot"><td class="fisso">Totale</td>${celle(competenze(a, periodo, settimane))}</tr></tbody></table></div>` +
        '<h3 class="tit-mesi">Giorno per giorno</h3>';
    }
    $('mensile').innerHTML = mensile;
    const rigaGiorno = e => { const d = new Date(`${e.date}T12:00:00`), w = lavoro(e), c = B.causali(e);
      return `<tr class="${w ? '' : 'rip'}"><td>${GIORNI[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}</td><td>${esc(e.shift || '')}</td><td>${w ? ore(B.servizio(e)) : ''}</td><td>${w ? ore(B.lavorate(e)) : ''}</td>` +
        `<td>${w && c.ritardo + c.cambio + c.sentine ? ore(c.ritardo + c.cambio + c.sentine) : ''}</td><td>${e.bank ? ore(e.bank) : ''}</td><td>${w && (e.ticketPresence ?? e.mealUsed) ? 'sì' : ''}</td><td>${w && e.allowanceRate != null ? `${e.allowanceRate}%` : ''}</td>` +
        `<td>${w && e.embark ? 'sì' : ''}</td><td>${esc(e.note || '')}</td></tr>`; };
    const rigaSett = w => `<tr class="sett"><td colspan="3">Settimana ${fmt(w.dal)} – ${fmt(w.al)}</td><td>${ore(w.lavorate)}</td><td colspan="6">${w.straordinario ? `straordinario <b>${ore(w.straordinario)}</b> (oltre 39 h)` : 'nessuno straordinario (39 h)'}</td></tr>`;
    const righe = [];
    settimane.forEach((w, i) => {
      w.giorni.forEach(e => righe.push(rigaGiorno(e)));
      righe.push(rigaSett(w));
      // anno intero: totale del mese dopo la sua ultima settimana
      const mese = w.al.slice(0, 7);
      if (periodo.length === 4 && (i === settimane.length - 1 || settimane[i + 1].al.slice(0, 7) !== mese)) {
        const ws = settimane.filter(x => x.al.startsWith(mese)), gm = ws.flatMap(x => x.giorni).filter(lavoro);
        righe.push(`<tr class="tot"><td colspan="3">${esc(MESI[Number(mese.slice(5)) - 1])} · ${gm.length} gg</td><td>${ore(ws.reduce((s, x) => s + x.lavorate, 0))}</td><td colspan="6">straordinario ${ore(ws.reduce((s, x) => s + x.straordinario, 0))}</td></tr>`);
      }
    });
    $('tabella').innerHTML = `<thead><tr><th>Data</th><th>Turno</th><th>Servizio</th><th>Lavorate</th><th>Straord. giorno</th><th>Banca</th><th>Ticket</th><th>Diaria</th><th>Imbarco</th><th>Note</th></tr></thead><tbody>` +
      righe.join('') + `<tr class="tot"><td colspan="3">Totale ${periodo.length === 4 ? 'anno' : 'mese'} · ${lav.length} gg</td><td>${ore(tot(B.lavorate))}</td><td colspan="6">straordinario ${ore(straord)} (oltre 39 h a settimana)</td></tr></tbody>`;
    $('dettaglio').hidden = false;
  }

  // lo .zip per un agente: backup ricaricabile nella sua Distinta (tutti i giorni) + CSV del mese scelto
  function zipAgente(a) {
    const mese = $('mese').value, base = `Distinta-${B.nomeFile(a.nome)}-${mese}`;
    const json = { tipo: 'navidiaria-backup', versione: 1, creato: new Date().toISOString(), agente: { id: a.id, nome: a.nome }, entries: a.entries, conversioni: a.conversioni };
    return { nome: `${base}.zip`, dati: B.zip([{ name: `${base}.csv`, data: B.csv([{ id: a.id, nome: a.nome, entries: a.entries, periodo: mese, conversioni: convPeriodo(a, mese) }]) },
      { name: `Distinta-${B.nomeFile(a.nome)}-backup.json`, data: JSON.stringify(json) }]) };
  }

  $('invia').addEventListener('click', async () => {
    if (!scelto) return;
    const z = zipAgente(scelto), mese = $('mese').value, quando = etichetta(mese);
    const file = new File([z.dati], z.nome, { type: 'application/zip' });
    const testo = `Ciao, ecco la tua distinta di ${quando} da NaviSuite.\nDentro lo zip: il file .csv si apre con Excel o Numbers; il file .json si può ricaricare nella Distinta con "Carica backup".`;
    // dal telefono: si sceglie a chi mandarla (Mail, WhatsApp, Messaggi…) con il file allegato
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `Distinta ${quando}`, text: testo }); segnaInviato(scelto.id); elenco(); return; }
      catch (error) { if (error?.name === 'AbortError') return; }
    }
    // dal computer: si scarica lo zip e si apre la mail da completare (l'allegato va aggiunto a mano)
    B.scarica(z.nome, z.dati, 'application/zip');
    location.href = `mailto:?subject=${encodeURIComponent(`Distinta ${quando} - ${scelto.nome}`)}&body=${encodeURIComponent(`${testo}\n\n(allega il file ${z.nome} appena scaricato)`)}`;
    segnaInviato(scelto.id); elenco();
  });
  $('scarica').addEventListener('click', () => { if (scelto) { const z = zipAgente(scelto); B.scarica(z.nome, z.dati, 'application/zip'); } });
  $('tutti').addEventListener('click', () => {
    const mese = $('mese').value, files = agenti.map(a => ({ name: `Distinta-${B.nomeFile(a.nome)}-${mese}.csv`, data: B.csv([{ id: a.id, nome: a.nome, entries: a.entries, periodo: mese, conversioni: convPeriodo(a, mese) }]) }));
    B.scarica(`Distinte-${mese}.zip`, B.zip(files), 'application/zip');
  });
  $('agenti').addEventListener('click', event => { const b = event.target.closest('[data-id]'); if (!b) return; scelto = agenti.find(a => a.id === b.dataset.id); elenco(); dettaglio(); $('dettaglio').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('cerca').addEventListener('input', elenco);
  $('mese').addEventListener('change', () => { elenco(); dettaglio(); riepilogoTutti(); });
  $('tutti-tabella').addEventListener('click', event => { const r = event.target.closest('tr[data-id]'); if (!r) return; scelto = agenti.find(a => a.id === r.dataset.id); elenco(); dettaglio(); $('dettaglio').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('tutti-csv').addEventListener('click', () => {
    const periodo = $('mese').value, cella = v => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const testo = '\ufeff' + [['Agente', 'Numero', ...COMPETENZE.map(([, t]) => t)], ...(riepilogoTutti.righe || []).map(({ a, c }) => [a.nome, a.id, ...COMPETENZE.map(col => valore(c, col))])]
      .map(r => r.map(cella).join(';')).join('\r\n');
    B.scarica(`Riepilogo-competenze-${periodo}.csv`, testo, 'text/csv;charset=utf-8');
  });
  $('da-firebase').addEventListener('click', async () => {
    status('Leggo le distinte dal database…');
    try { await window.NaviAdminFirebase.ready; carica(await window.NaviAdminFirebase.getBackupCentrale()); }
    catch (error) { status(`Database non raggiungibile (${error.message}): apri un file di backup.`); }
  });
  $('da-file').addEventListener('click', () => { $('file').value = ''; $('file').click(); });
  $('file').addEventListener('change', async () => {
    const f = $('file').files?.[0];
    if (!f) return;
    try {
      let testo;
      if (/\.zip$/i.test(f.name) || f.type.includes('zip')) { const files = B.unzip(new Uint8Array(await f.arrayBuffer())); testo = files[Object.keys(files).find(n => /\.json$/i.test(n))]; }
      else testo = await f.text();
      const dati = JSON.parse(testo);
      if (dati?.tipo === 'navidiaria-backup') return status('Questo è il backup di un solo agente: apri il backup di tutti (pagina Agenti o TrueNAS).');
      carica(dati);
    } catch (error) { status(`File non leggibile: ${error.message}`); }
  });
})();
