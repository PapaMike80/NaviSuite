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
  const lavoro = e => !!e && !['RIP', 'RIPOSO', 'MALATTIA'].includes(String(e.shift || '').toUpperCase());
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

  function dettaglio() {
    const a = scelto, mese = $('mese').value;
    if (!a) { $('dettaglio').hidden = true; return; }
    const giorni = a.entries.filter(e => e.date.startsWith(mese)), lav = giorni.filter(lavoro);
    const tot = f => lav.reduce((s, e) => s + f(e), 0), caus = e => { const c = B.causali(e); return c.ritardo + c.cambio + c.sentine; };
    const conv = sommaConv(a, mese);
    $('det-numero').textContent = `AGENTE N. ${a.id} · ${etichetta(mese).toUpperCase()}`;
    $('det-nome').textContent = a.nome;
    $('riepilogo').innerHTML = [['Giorni lavorati', lav.length], ['Ore lavorate', ore(tot(B.lavorate))], ['Straordinari del giorno', ore(tot(caus))],
      ['Banca ore', ore(giorni.reduce((s, e) => s + (Math.round(Number(e.bank) || 0)), 0))], ['Ticket', lav.filter(e => e.ticketPresence ?? e.mealUsed).length],
      ['Diarie', lav.filter(e => e.allowanceRate != null).length], ...(conv ? [['Trasformati in banca ore', `${ore(conv)} → +${ore(Math.round(conv * 1.1))}`]] : [])]
      .map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('');
    $('tabella').innerHTML = `<thead><tr><th>Data</th><th>Turno</th><th>Servizio</th><th>Lavorate</th><th>Straord.</th><th>Banca</th><th>Ticket</th><th>Diaria</th><th>Imbarco</th><th>Note</th></tr></thead><tbody>` +
      giorni.map((e, i) => { const d = new Date(`${e.date}T12:00:00`), w = lavoro(e);
        const fineMese = mese.length === 4 && (i === giorni.length - 1 || giorni[i + 1].date.slice(0, 7) !== e.date.slice(0, 7));
        const lm = fineMese ? giorni.filter(x => x.date.startsWith(e.date.slice(0, 7)) && lavoro(x)) : [];
        const totMese = fineMese ? `<tr class="tot"><td>${esc(MESI[d.getMonth()])}</td><td>${lm.length} gg</td><td>${ore(lm.reduce((s, x) => s + B.servizio(x), 0))}</td><td>${ore(lm.reduce((s, x) => s + B.lavorate(x), 0))}</td><td>${ore(lm.reduce((s, x) => s + caus(x), 0))}</td><td>${ore(giorni.filter(x => x.date.startsWith(e.date.slice(0, 7))).reduce((s, x) => s + (Math.round(Number(x.bank) || 0)), 0))}</td><td>${lm.filter(x => x.ticketPresence ?? x.mealUsed).length}</td><td>${lm.filter(x => x.allowanceRate != null).length}</td><td>${lm.filter(x => x.embark).length}</td><td></td></tr>` : '';
        return `<tr class="${w ? '' : 'rip'}"><td>${GIORNI[d.getDay()]} ${d.getDate()}</td><td>${esc(e.shift || '')}</td><td>${w ? ore(B.servizio(e)) : ''}</td><td>${w ? ore(B.lavorate(e)) : ''}</td>` +
          `<td>${w ? ore(caus(e)) : ''}</td><td>${ore(e.bank)}</td><td>${w && (e.ticketPresence ?? e.mealUsed) ? 'sì' : ''}</td><td>${w && e.allowanceRate != null ? `${e.allowanceRate}%` : ''}</td>` +
          `<td>${w && e.embark ? 'sì' : ''}</td><td>${esc(e.note || '')}</td></tr>` + totMese; }).join('') +
      `<tr class="tot"><td>Totale ${mese.length === 4 ? 'anno' : ''}</td><td>${lav.length} gg</td><td>${ore(tot(B.servizio))}</td><td>${ore(tot(B.lavorate))}</td><td>${ore(tot(caus))}</td><td></td><td>${lav.filter(e => e.ticketPresence ?? e.mealUsed).length}</td><td>${lav.filter(e => e.allowanceRate != null).length}</td><td>${lav.filter(e => e.embark).length}</td><td></td></tr></tbody>`;
    $('dettaglio').hidden = false;
  }

  // lo .zip per un agente: backup ricaricabile nella sua Distinta (tutti i giorni) + CSV del mese scelto
  function zipAgente(a) {
    const mese = $('mese').value, base = `Distinta-${B.nomeFile(a.nome)}-${mese}`;
    const json = { tipo: 'navidiaria-backup', versione: 1, creato: new Date().toISOString(), agente: { id: a.id, nome: a.nome }, entries: a.entries, conversioni: a.conversioni };
    const delMese = a.entries.filter(e => e.date.startsWith(mese));
    return { nome: `${base}.zip`, dati: B.zip([{ name: `${base}.csv`, data: B.csv([{ id: a.id, nome: a.nome, entries: delMese, conversioni: convPeriodo(a, mese) }]) },
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
    const mese = $('mese').value, files = agenti.map(a => ({ name: `Distinta-${B.nomeFile(a.nome)}-${mese}.csv`, data: B.csv([{ id: a.id, nome: a.nome, entries: a.entries.filter(e => e.date.startsWith(mese)), conversioni: convPeriodo(a, mese) }]) }));
    B.scarica(`Distinte-${mese}.zip`, B.zip(files), 'application/zip');
  });
  $('agenti').addEventListener('click', event => { const b = event.target.closest('[data-id]'); if (!b) return; scelto = agenti.find(a => a.id === b.dataset.id); elenco(); dettaglio(); $('dettaglio').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('cerca').addEventListener('input', elenco);
  $('mese').addEventListener('change', () => { elenco(); dettaglio(); });
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
