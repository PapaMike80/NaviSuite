// NaviDiaria · backup personale: "Scarica backup" (JSON per ripristinare + CSV leggibile) e "Carica backup".
(() => {
  const B = window.NaviDiariaBackup;
  const barra = document.getElementById('monthlyVerifyPayslip')?.parentElement;
  if (!B || !barra) return;
  const agente = () => { try { return JSON.parse(localStorage.getItem('navidiaria.activeAgent') || 'null'); } catch { return null; } };
  const avviso = testo => (typeof notify === 'function' ? notify(testo) : alert(testo));

  const scaricaBtn = document.createElement('button');
  scaricaBtn.type = 'button'; scaricaBtn.className = 'monthly-today-button'; scaricaBtn.textContent = '⤓ Scarica backup';
  const caricaBtn = document.createElement('button');
  caricaBtn.type = 'button'; caricaBtn.className = 'monthly-today-button'; caricaBtn.textContent = '⤒ Carica backup';
  const file = document.createElement('input');
  file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
  barra.append(scaricaBtn, caricaBtn, file);

  scaricaBtn.addEventListener('click', () => {
    const a = agente();
    if (!a?.id) return avviso('Accedi per scaricare la tua distinta');
    const lista = (typeof entries !== 'undefined' ? entries : []).filter(Boolean);
    const conversioni = window.NaviDiariaConversione?.mappa?.() || {};
    const base = `Distinta-${B.nomeFile(a.name)}-${B.oggi()}`;
    const json = { tipo: 'navidiaria-backup', versione: 1, creato: new Date().toISOString(),
      agente: { id: String(a.id), nome: a.name || '', residenza: a.residence || '' }, entries: lista, conversioni };
    B.scarica(`${base}.json`, JSON.stringify(json, null, 1), 'application/json');
    // il secondo file poco dopo: alcuni browser bloccano due download nello stesso istante
    setTimeout(() => B.scarica(`${base}.csv`, B.csv([{ id: a.id, nome: a.name, entries: lista, conversioni }]), 'text/csv;charset=utf-8'), 700);
    avviso(`Backup scaricato: ${lista.length} giorni`);
  });

  caricaBtn.addEventListener('click', () => { file.value = ''; file.click(); });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    let dati;
    try { dati = JSON.parse(await f.text()); } catch { return avviso('File non leggibile: scegli il file .json del backup'); }
    if (dati?.tipo !== 'navidiaria-backup' || !Array.isArray(dati.entries)) return avviso('Non è un backup della Distinta (file .json)');
    const a = agente();
    if (dati.agente?.id && a?.id && String(dati.agente.id) !== String(a.id) &&
      !confirm(`Il backup è di ${dati.agente.nome || dati.agente.id}, non tuo. Caricarlo lo stesso nella tua distinta?`)) return;
    const attuali = new Map((typeof entries !== 'undefined' ? entries : []).filter(Boolean).map(e => [e.date, e]));
    const nuovi = dati.entries.filter(e => e?.date && !attuali.has(e.date));
    const doppi = dati.entries.filter(e => e?.date && attuali.has(e.date) && JSON.stringify(attuali.get(e.date)) !== JSON.stringify(e));
    if (!nuovi.length && !doppi.length && !Object.keys(dati.conversioni || {}).length) return avviso('Niente da ripristinare: la distinta è già uguale al backup');
    if (!confirm(`Backup del ${String(dati.creato || '').slice(0, 10)}: ${nuovi.length} giorni da aggiungere${doppi.length ? `, ${doppi.length} giorni diversi da quelli attuali` : ''}. Procedere?`)) return;
    const sostituisci = doppi.length ? confirm(`Sostituire anche i ${doppi.length} giorni già presenti con quelli del backup?\nOK = sostituisci · Annulla = tieni quelli attuali`) : false;
    nuovi.forEach(e => attuali.set(e.date, e));
    if (sostituisci) doppi.forEach(e => attuali.set(e.date, e));
    entries = [...attuali.values()].sort((x, y) => String(x.date).localeCompare(String(y.date)));
    if (dati.conversioni) window.NaviDiariaConversione?.importa?.(dati.conversioni);
    if (typeof persist === 'function') persist();
    window.NaviDiariaRefreshMonthly?.();
    try { await window.NaviDiariaRuntime?.saveNow?.(); } catch { /* resta da sincronizzare */ }
    avviso(`Ripristinati ${nuovi.length + (sostituisci ? doppi.length : 0)} giorni`);
  });
})();
