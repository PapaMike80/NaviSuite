// Ritardi dell'equipaggio (NaviDiaria e NaviDistinta).
// Tizio segna un ritardo nella sua distinta -> la distinta di Caio (stesso turno, stesso giorno) prende lo stesso ritardo.
// Se poi Caio corregge il ritardo, la correzione resta solo sua: non torna a Tizio e non riceve piu' aggiornamenti per quel giorno.
// Usa le variabili globali della pagina: entries, activeAgent, persist, saveEntriesToFirebase, syncEntriesWithFirebase.
(function () {
  if (typeof entries === 'undefined' || typeof saveEntriesToFirebase !== 'function') return;
  const GIORNI = 40;
  const NON_SERVIZIO = ['', 'RIPOSO', 'RIP', 'MALATTIA', 'FERIE'];
  const fb = () => window.NaviAdminFirebase;
  const oggi = () => new Date().toISOString().slice(0, 10);
  const dal = () => new Date(Date.now() - GIORNI * 864e5).toISOString().slice(0, 10);
  const id = () => String(activeAgent?.id || '').trim();
  const turno = e => String(e?.shift || '').trim().toUpperCase();
  const inServizio = e => !!e?.date && !NON_SERVIZIO.includes(turno(e));
  const ordinario = e => Math.max(0, Math.round(Number(window.NaviDiariaOvertime?.ordinary?.(e)) || 0));
  const servizio = e => Math.max(0, Math.round(Number(e?.serviceMinutes) || 0));
  const chiave = e => `${e.date}|${turno(e)}`;
  const mappaKey = () => `navisuite.ritardiEquipaggio.${id()}`;
  const leggiMappa = () => { try { return JSON.parse(localStorage.getItem(mappaKey()) || '{}') || {}; } catch { return {}; } };
  const scriviMappa = m => { try { localStorage.setItem(mappaKey(), JSON.stringify(m)); } catch { /* niente */ } };
  const recenti = () => entries.filter(e => inServizio(e) && e.date >= dal() && e.date <= oggi());

  // Valori gia' noti: all'avvio non si pubblica nulla, solo le modifiche fatte da qui in poi.
  function allinea() {
    if (!id()) return;
    const m = leggiMappa();
    let cambiato = false;
    for (const e of recenti()) if (m[chiave(e)] === undefined) { m[chiave(e)] = ordinario(e); cambiato = true; }
    if (cambiato) scriviMappa(m);
  }

  // Dopo un salvataggio: i ritardi cambiati a mano partono verso i colleghi (se non erano ricevuti da un collega).
  async function pubblica() {
    if (!id() || !fb()?.saveRitardoEquipaggio) return;
    const m = leggiMappa(), invii = [];
    let segnato = false;
    for (const e of recenti()) {
      const k = chiave(e), min = ordinario(e);
      if (m[k] === min) continue;
      m[k] = min;
      if (e.ritardoEquipaggio && !e.ritardoProprio) { e.ritardoProprio = true; segnato = true; continue; } // Caio corregge: resta suo
      if (e.ritardoEquipaggio) continue;
      e.ritardoProprio = true; segnato = true;
      invii.push(fb().saveRitardoEquipaggio(e.date, turno(e), id(), { minuti: min, nome: activeAgent?.name || id(), t: Date.now() }));
    }
    scriviMappa(m);
    if (segnato) { try { writeEntriesLocal('ritardo equipaggio'); markCloudDirty(); } catch { /* niente */ } }
    await Promise.allSettled(invii);
  }

  // Ritardi dei colleghi: si applicano ai giorni con lo stesso turno, se non li ho segnati o corretti io.
  let inCorso = false;
  async function ricevi() {
    if (inCorso || !id() || !fb()?.getRitardiEquipaggio || !navigator.onLine) return;
    inCorso = true;
    try {
      await fb().ready;
      const dati = await fb().getRitardiEquipaggio(dal());
      const m = leggiMappa(), mio = id().replace(/[.#$\[\]\/]/g, '_');
      let cambiati = 0;
      for (const e of recenti()) {
        if (e.ritardoProprio) continue;
        const righe = Object.entries(dati?.[e.date]?.[turno(e)] || {}).filter(([chi]) => chi !== mio).map(([, r]) => r).filter(r => r && Number.isFinite(Number(r.t)));
        if (!righe.length) continue;
        const ultimo = righe.sort((a, b) => b.t - a.t)[0];
        if (Number(e.ritardoEquipaggio?.t || 0) >= ultimo.t) continue;
        const min = Math.max(0, Math.round(Number(ultimo.minuti) || 0));
        window.NaviDiariaOvertime.setOrdinary(e, min, servizio(e));
        e.ritardoEquipaggio = { da: String(ultimo.nome || ''), minuti: min, t: ultimo.t };
        e.imported = false;
        m[chiave(e)] = ordinario(e);
        cambiati++;
      }
      scriviMappa(m);
      if (cambiati) {
        persist();
        document.dispatchEvent(new CustomEvent('navidiaria:render'));
      }
    } catch (error) { console.warn('Ritardi equipaggio non letti', error); }
    finally { inCorso = false; }
  }

  const salvaOriginale = saveEntriesToFirebase;
  saveEntriesToFirebase = async function (...args) {
    const risultato = await salvaOriginale.apply(this, args);
    pubblica().catch(error => console.warn('Ritardo equipaggio non inviato', error));
    return risultato;
  };
  if (typeof syncEntriesWithFirebase === 'function') {
    const syncOriginale = syncEntriesWithFirebase;
    syncEntriesWithFirebase = async function (...args) {
      const risultato = await syncOriginale.apply(this, args);
      allinea();
      ricevi();
      return risultato;
    };
  }
  allinea();
  setTimeout(ricevi, 1500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ricevi(); });
  window.addEventListener('online', ricevi);
  window.NaviRitardiEquipaggio = { ricevi, pubblica };
})();
