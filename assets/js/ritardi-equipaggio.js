// Ritardi dell'equipaggio (NaviDiaria e NaviDistinta).
// Il primo agente che segna un ritardo su una corsa (stesso turno, stesso giorno) lo passa a tutti i colleghi di quel turno.
// Dopo, ognuno puo' correggere il proprio: la correzione resta solo sua, anche se a correggere e' chi l'aveva inviato.
// Firebase: ritardiEquipaggio/<giorno>/<TURNO>/<agente> = { minuti, nome, t }; vale solo il primo (t piu' basso).
// Sulla giornata: ritardoInviato = l'ho inviato io; ritardoEquipaggio = { da, minuti, t } ricevuto da un collega.
// Usa le variabili globali della pagina: entries, activeAgent, persist, saveEntriesToFirebase, syncEntriesWithFirebase.
(function () {
  if (typeof entries === 'undefined' || typeof saveEntriesToFirebase !== 'function') return;
  const GIORNI = 40;
  const NON_SERVIZIO = ['', 'RIPOSO', 'RIP', 'MALATTIA', 'FERIE', '-', '--', '---', '—'];
  const fb = () => window.NaviAdminFirebase;
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const oggi = () => iso(new Date());
  const dal = () => iso(new Date(Date.now() - GIORNI * 864e5));
  const id = () => String(activeAgent?.id || '').trim();
  const mio = () => id().replace(/[.#$\[\]\/]/g, '_');
  const turno = e => String(e?.shift || '').trim().toUpperCase().replace(/\s+/g, '').replace(/\*+$/, '');
  const inServizio = e => !!e?.date && !NON_SERVIZIO.includes(turno(e)) && !turno(e).startsWith('#');
  const ordinario = e => Math.max(0, Math.round(Number(window.NaviDiariaOvertime?.ordinary?.(e)) || 0));
  const manuale = e => e?.overtimeMeta?.ordinaryMode === 'manual';
  const servizio = e => Math.max(0, Math.round(Number(e?.serviceMinutes) || 0));
  const recenti = () => entries.filter(e => inServizio(e) && e.date >= dal() && e.date <= oggi());
  // Il primo ritardo segnato da un altro agente su quel giorno e quel turno
  const primo = (dati, e, ancheMio) => Object.entries(dati?.[e.date]?.[turno(e)] || {})
    .filter(([chi, r]) => (ancheMio || chi !== mio()) && r && Number.isFinite(Number(r.t)))
    .map(([, r]) => r).sort((a, b) => a.t - b.t)[0] || null;
  const segnaModificato = () => { try { writeEntriesLocal('ritardo equipaggio'); markCloudDirty(); } catch { /* niente */ } };

  // Dopo un salvataggio: un ritardo segnato a mano parte verso i colleghi solo se nessuno l'ha gia' segnato
  async function pubblica() {
    if (!id() || !fb()?.saveRitardoEquipaggio || !navigator.onLine) return;
    const da = recenti().filter(e => !e.ritardoEquipaggio && !e.ritardoInviato && manuale(e) && ordinario(e) > 0);
    if (!da.length) return;
    await fb().ready;
    const dati = await fb().getRitardiEquipaggio(dal());
    for (const e of da) {
      e.ritardoInviato = true; // anche se un collega e' arrivato prima: il mio valore resta mio
      if (primo(dati, e, true)) continue;
      await fb().saveRitardoEquipaggio(e.date, turno(e), id(), { minuti: ordinario(e), nome: activeAgent?.name || id(), t: Date.now() });
    }
    segnaModificato();
  }

  // Ritardi dei colleghi: si applicano una volta sola ai giorni con lo stesso turno in cui non ho gia' un ritardo mio
  let inCorso = false;
  async function ricevi() {
    if (inCorso || !id() || !fb()?.getRitardiEquipaggio || !navigator.onLine) return;
    inCorso = true;
    try {
      await fb().ready;
      const dati = await fb().getRitardiEquipaggio(dal());
      let cambiati = 0;
      for (const e of recenti()) {
        if (e.ritardoEquipaggio || e.ritardoInviato || (manuale(e) && ordinario(e) > 0)) continue;
        const r = primo(dati, e, false);
        if (!r) continue;
        const min = Math.max(0, Math.round(Number(r.minuti) || 0));
        window.NaviDiariaOvertime.setOrdinary(e, min, servizio(e));
        e.ritardoEquipaggio = { da: String(r.nome || ''), minuti: min, t: r.t };
        e.imported = false;
        e.modificatoIl = Date.now();
        cambiati++;
      }
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
      ricevi();
      return risultato;
    };
  }
  setTimeout(ricevi, 1500);
  setInterval(() => { if (document.visibilityState === 'visible') ricevi(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ricevi(); });
  window.addEventListener('online', ricevi);
  window.NaviRitardiEquipaggio = { ricevi, pubblica };
})();
