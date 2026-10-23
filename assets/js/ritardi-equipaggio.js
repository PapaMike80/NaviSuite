// Ritardi dell'equipaggio (NaviDiaria e NaviDistinta).
// Solo per la giornata di oggi. Chiunque segni, modifichi o cancelli (0) un ritardo su una corsa (stesso turno, stesso giorno) lo manda a tutti i colleghi
// di quel turno: a ognuno compare un popup con l'ultima modifica fatta da un altro. Registra la mette nella sua distinta,
// Annulla tiene il suo valore (quella modifica non ricompare; la prossima di qualcuno si'). Admin compreso.
// Firebase: ritardiEquipaggio/<giorno>/<TURNO>/<agente> = { minuti, nome, t, at } (at = ora dell'ultima modifica).
// Sulla giornata: ritardoPubblicato = ultimo valore mandato o registrato da me; ritardoPubblicatoAt = quando;
// ritardoVistoAt = ora dell'ultima modifica di un collega gia' proposta; ritardoEquipaggio = { da, minuti, at } registrato.
// Usa le variabili globali della pagina: entries, activeAgent, persist, saveEntriesToFirebase, syncEntriesWithFirebase.
(function () {
  if (typeof entries === 'undefined' || typeof saveEntriesToFirebase !== 'function') return;
  const NON_SERVIZIO = ['', 'RIPOSO', 'RIP', 'MALATTIA', 'FERIE', '-', '--', '---', '—'];
  const fb = () => window.NaviAdminFirebase;
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const oggi = () => iso(new Date());
  const dal = oggi; // solo la giornata di oggi: i ritardi passati o futuri restano personali
  const id = () => String(activeAgent?.id || '').trim();
  const mio = () => id().replace(/[.#$\[\]\/]/g, '_');
  const turno = e => String(e?.shift || '').trim().toUpperCase().replace(/\s+/g, '').replace(/\*+$/, '');
  const inServizio = e => !!e?.date && !NON_SERVIZIO.includes(turno(e)) && !turno(e).startsWith('#');
  const ordinario = e => Math.max(0, Math.round(Number(window.NaviDiariaOvertime?.ordinary?.(e)) || 0));
  const avvio = Date.now();
  // Giornata cambiata in questa sessione (ritardo, ore lavorate o altro): solo queste partono verso i colleghi
  const cambiataOra = e => Number(e?.modificatoIl) >= avvio;
  const avvisa = t => { try { if (typeof notify === 'function') notify(t); } catch { /* niente */ } };
  const servizio = e => Math.max(0, Math.round(Number(e?.serviceMinutes) || 0));
  const recenti = () => entries.filter(e => inServizio(e) && e.date === oggi());
  const quando = r => Number(r?.at || r?.t) || 0;
  // L'ultima modifica fatta da un altro agente su quel giorno e quel turno
  const ultimo = (dati, e) => Object.entries(dati?.[e.date]?.[turno(e)] || {})
    .filter(([chi, r]) => chi !== mio() && r && quando(r) > 0)
    .map(([, r]) => r).sort((a, b) => quando(b) - quando(a))[0] || null;
  // Giornate delle versioni precedenti: quello che avevano gia' visto non si ripropone
  const vistoAt = e => Math.max(Number(e.ritardoVistoAt) || 0, Number(e.ritardoAdminVisto) || 0, Number(e.ritardoRifiutato) || 0,
    Number(e.ritardoEquipaggio?.at || e.ritardoEquipaggio?.t) || 0, Number(e.ritardoPubblicatoAt) || 0);
  const pubblicato = e => Number(e.ritardoPubblicato ?? e.ritardoMio?.minuti ?? e.ritardoAdminInviato ?? e.ritardoEquipaggio?.minuti ?? (e.ritardoInviato ? ordinario(e) : 0)) || 0;
  const segnaModificato = () => { try { writeEntriesLocal('ritardo equipaggio'); markCloudDirty(); } catch { /* niente */ } };

  // Dopo un salvataggio: ogni ritardo cambiato a mano (anche a 0) parte verso i colleghi
  async function pubblica() {
    if (!id() || !fb()?.saveRitardoEquipaggio || !navigator.onLine) return;
    const da = recenti().filter(e => cambiataOra(e) && ordinario(e) !== pubblicato(e));
    if (!da.length) return;
    await fb().ready;
    for (const e of da) {
      const at = Date.now(), min = ordinario(e);
      await fb().saveRitardoEquipaggio(e.date, turno(e), id(), { minuti: min, nome: activeAgent?.name || id(), t: at, at });
      e.ritardoPubblicato = min;
      e.ritardoPubblicatoAt = at;
      avvisa(min ? `Ritardo inviato ai colleghi della ${turno(e)}` : `Ritardo cancellato per i colleghi della ${turno(e)}`);
    }
    segnaModificato();
  }

  // Popup «Tizio ha segnato un ritardo»: Registra lo mette nella mia distinta, Annulla lo scarta (non ricompare).
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hhmm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const giornoLungo = d => { const s = new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };
  const oraDi = t => new Date(Number(t)).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  function popup(p) {
    return new Promise(fine => {
      if (!document.getElementById('ritEqStyle')) {
        const st = document.createElement('style'); st.id = 'ritEqStyle';
        st.textContent = '.rit-eq-ov{position:fixed;inset:0;z-index:9999;background:rgba(3,10,14,.65);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px}'
          + '.rit-eq{width:min(420px,100%);background:#12303b;border:1px solid rgba(45,212,191,.35);border-radius:20px;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.65);color:#e8f3f6;font-family:inherit}'
          + '.rit-eq small{color:#fbbf24;letter-spacing:.18em;font-weight:800;font-size:11px}.rit-eq h3{margin:6px 0 4px;font-size:20px}.rit-eq p{margin:0;color:#9fb8c2;font-size:14px}'
          + '.rit-eq-box{margin:16px 0;background:#0b1d26;border-radius:14px;padding:14px;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center}'
          + '.rit-eq-ch{background:rgba(45,212,191,.13);color:#2dd4bf;font-weight:800;border-radius:10px;padding:8px 10px}.rit-eq-n{font-weight:700}.rit-eq-n span{display:block;font-weight:400;color:#9fb8c2;font-size:13px}'
          + '.rit-eq-v{font-size:28px;font-weight:800;color:#fbbf24}.rit-eq-b{display:flex;gap:10px}.rit-eq-b button{flex:1;padding:14px;border-radius:14px;font:inherit;font-size:16px;font-weight:700;border:1px solid rgba(45,212,191,.35);background:transparent;color:#e8f3f6}'
          + '.rit-eq-b .ok{background:#2dd4bf;color:#062028;border:0}.rit-eq-f{margin-top:12px;font-size:12px;color:#6f8b96;text-align:center}';
        document.head.appendChild(st);
      }
      const ov = document.createElement('div'); ov.className = 'rit-eq-ov';
      const chi = esc(p.nome || 'Un collega');
      ov.innerHTML = `<div class="rit-eq" role="dialog" aria-modal="true"><small>RITARDO DELL'EQUIPAGGIO</small><h3>${chi} ${p.modifica ? (p.minuti ? 'ha modificato il ritardo' : 'ha cancellato il ritardo') : 'ha segnato un ritardo'}</h3><p>Sulla tua stessa corsa. ${p.modifica && !p.minuti ? 'Vuoi toglierlo anche dalla tua distinta?' : 'Vuoi registrarlo anche nella tua distinta?'}</p>`
        + `<div class="rit-eq-box"><div class="rit-eq-ch">${esc(p.turno)}</div><div class="rit-eq-n">${esc(giornoLungo(p.date))}<span>da ${esc(p.nome || '')} · alle ${oraDi(p.quando)}</span></div><div class="rit-eq-v">${hhmm(p.minuti)}</div></div>`
        + '<div class="rit-eq-b"><button type="button" data-no>Annulla</button><button type="button" class="ok" data-si>Registra</button></div><div class="rit-eq-f">Se registri, potrai sempre modificarlo dalla giornata.</div></div>';
      const chiudi = v => { ov.remove(); fine(v); };
      ov.querySelector('[data-si]').onclick = () => chiudi(true);
      ov.querySelector('[data-no]').onclick = () => chiudi(false);
      document.body.appendChild(ov);
    });
  }
  const chiedi = p => (window.NaviRitardiEquipaggio?.chiedi || popup)(p);

  // Modifiche dei colleghi da proporre: l'ultima di un altro, se piu' recente di quanto ho gia' visto o mandato io
  let inCorso = false;
  async function ricevi() {
    if (inCorso || !id() || !fb()?.getRitardiEquipaggio || !navigator.onLine) return;
    inCorso = true;
    try {
      await fb().ready;
      const dati = await fb().getRitardiEquipaggio(dal());
      const proposte = [];
      let segnati = 0;
      for (const e of recenti().sort((x, y) => x.date.localeCompare(y.date))) {
        const r = ultimo(dati, e);
        if (!r || quando(r) <= vistoAt(e)) continue;
        const min = Math.max(0, Math.round(Number(r.minuti) || 0));
        if (min === ordinario(e)) { e.ritardoVistoAt = quando(r); e.ritardoPubblicato = min; segnati++; continue; } // ho gia' lo stesso valore
        proposte.push({ e, r, min });
      }
      for (const { e, r, min } of proposte) {
        const prima = ordinario(e);
        const si = await chiedi({ date: e.date, turno: turno(e), minuti: min, nome: String(r.nome || ''), quando: quando(r), modifica: prima > 0 });
        if (si) {
          window.NaviDiariaOvertime.setOrdinary(e, min, servizio(e));
          e.ritardoEquipaggio = { da: String(r.nome || ''), minuti: min, at: quando(r) };
          e.ritardoPubblicato = min; // registrato: non riparte da me
          e.imported = false;
          e.modificatoIl = Date.now();
        } else if (e.ritardoPubblicato === undefined) e.ritardoPubblicato = ordinario(e); // Annulla: il mio valore resta, non riparte
        e.ritardoVistoAt = quando(r);
        segnati++;
      }
      if (segnati) {
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
  window.NaviRitardiEquipaggio = { ...(window.NaviRitardiEquipaggio || {}), ricevi, pubblica };
})();
