// Ritardi dell'equipaggio (NaviDiaria e NaviDistinta).
// Il primo agente che segna un ritardo su una corsa (stesso turno, stesso giorno) lo passa a tutti i colleghi di quel turno.
// Al collega compare un popup: Registra lo mette nella sua distinta, Annulla lo scarta.
// Dopo, ognuno puo' correggere il proprio: la correzione resta solo sua, anche se a correggere e' chi l'aveva inviato.
// Prova e correzione: il ritardo segnato da un admin passa sempre ai colleghi, anche se l'avevano gia' ricevuto o corretto.
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
  const avvio = Date.now();
  // Giornata cambiata in questa sessione (ritardo, ore lavorate o altro): solo queste partono verso i colleghi
  const cambiataOra = e => Number(e?.modificatoIl) >= avvio;
  const avvisa = t => { try { if (typeof notify === 'function') notify(t); } catch { /* niente */ } };
  const servizio = e => Math.max(0, Math.round(Number(e?.serviceMinutes) || 0));
  const recenti = () => entries.filter(e => inServizio(e) && e.date >= dal() && e.date <= oggi());
  // Il primo ritardo segnato da un altro agente su quel giorno e quel turno
  const primo = (dati, e, ancheMio) => Object.entries(dati?.[e.date]?.[turno(e)] || {})
    .filter(([chi, r]) => (ancheMio || chi !== mio()) && r && Number.isFinite(Number(r.t)))
    .map(([, r]) => r).sort((a, b) => a.t - b.t)[0] || null;
  const admin = () => { try { return typeof isAdmin === 'function' && !!isAdmin(); } catch { return false; } };
  // L'ultimo ritardo inviato da un admin (diverso da me)
  const ultimoAdmin = (dati, e) => Object.entries(dati?.[e.date]?.[turno(e)] || {})
    .filter(([chi, r]) => chi !== mio() && r?.admin && Number.isFinite(Number(r.at || r.t)))
    .map(([, r]) => r).sort((a, b) => (b.at || b.t) - (a.at || a.t))[0] || null;
  const segnaModificato = () => { try { writeEntriesLocal('ritardo equipaggio'); markCloudDirty(); } catch { /* niente */ } };

  // Dopo un salvataggio: un ritardo segnato a mano parte verso i colleghi solo se nessuno l'ha gia' segnato
  async function pubblica() {
    if (!id() || !fb()?.saveRitardoEquipaggio || !navigator.onLine) return;
    if (admin()) return pubblicaAdmin();
    const da = recenti().filter(e => !e.ritardoEquipaggio && !e.ritardoInviato && cambiataOra(e) && ordinario(e) > 0);
    if (!da.length) return;
    await fb().ready;
    const dati = await fb().getRitardiEquipaggio(dal());
    for (const e of da) {
      e.ritardoInviato = true; // anche se un collega e' arrivato prima: il mio valore resta mio
      if (primo(dati, e, true)) continue;
      await fb().saveRitardoEquipaggio(e.date, turno(e), id(), { minuti: ordinario(e), nome: activeAgent?.name || id(), t: Date.now() });
      avvisa(`Ritardo inviato ai colleghi della ${turno(e)}`);
    }
    segnaModificato();
  }

  // Admin: ogni ritardo cambiato a mano parte sempre (t resta quello del primo invio, at e' l'ora della modifica)
  async function pubblicaAdmin() {
    const da = recenti().filter(e => cambiataOra(e) && ordinario(e) > 0 && e.ritardoAdminInviato !== ordinario(e) && !(e.ritardoEquipaggio && e.ritardoEquipaggio.minuti === ordinario(e)));
    if (!da.length) return;
    await fb().ready;
    const dati = await fb().getRitardiEquipaggio(dal());
    for (const e of da) {
      const mioPrima = dati?.[e.date]?.[turno(e)]?.[mio()];
      const at = Date.now();
      await fb().saveRitardoEquipaggio(e.date, turno(e), id(), { minuti: ordinario(e), nome: activeAgent?.name || id(), t: Number(mioPrima?.t) || at, at, admin: true });
      e.ritardoAdminInviato = ordinario(e);
      avvisa(`Ritardo inviato ai colleghi della ${turno(e)}`);
      e.ritardoInviato = true;
    }
    segnaModificato();
  }

  // Ritardi dei colleghi: si applicano una volta sola ai giorni con lo stesso turno in cui non ho gia' un ritardo mio
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
      const chi = p.admin ? "L'ufficio" : esc(p.nome || 'Un collega');
      ov.innerHTML = `<div class="rit-eq" role="dialog" aria-modal="true"><small>${p.admin ? "RITARDO SEGNATO DALL'UFFICIO" : "RITARDO DELL'EQUIPAGGIO"}</small><h3>${chi} ha segnato un ritardo</h3><p>Sulla tua stessa corsa. Vuoi registrarlo anche nella tua distinta?</p>`
        + `<div class="rit-eq-box"><div class="rit-eq-ch">${esc(p.turno)}</div><div class="rit-eq-n">${esc(giornoLungo(p.date))}<span>da ${esc(p.nome || '')} · alle ${oraDi(p.quando)}</span></div><div class="rit-eq-v">${hhmm(p.minuti)}</div></div>`
        + '<div class="rit-eq-b"><button type="button" data-no>Annulla</button><button type="button" class="ok" data-si>Registra</button></div><div class="rit-eq-f">Se registri, potrai sempre modificarlo dalla giornata.</div></div>';
      const chiudi = v => { ov.remove(); fine(v); };
      ov.querySelector('[data-si]').onclick = () => chiudi(true);
      ov.querySelector('[data-no]').onclick = () => chiudi(false);
      document.body.appendChild(ov);
    });
  }
  const chiedi = p => (window.NaviRitardiEquipaggio?.chiedi || popup)(p);

  // Ritardi dei colleghi da proporre: il primo segnato sulla corsa (se non ho gia' un ritardo mio) o l'ultimo dell'admin
  let inCorso = false;
  async function ricevi() {
    if (inCorso || !id() || !fb()?.getRitardiEquipaggio || !navigator.onLine) return;
    inCorso = true;
    try {
      await fb().ready;
      const dati = await fb().getRitardiEquipaggio(dal());
      const proposte = [];
      for (const e of recenti().sort((x, y) => x.date.localeCompare(y.date))) {
        const a = ultimoAdmin(dati, e), atA = a ? Number(a.at || a.t) : 0;
        if (a && atA > (Number(e.ritardoEquipaggio?.at) || 0) && atA > (Number(e.ritardoAdminVisto) || 0)) { proposte.push({ e, r: a, admin: true, quando: atA }); continue; }
        if (e.ritardoEquipaggio || e.ritardoInviato || ordinario(e) > 0) continue;
        const r = primo(dati, e, false);
        if (r && Number(e.ritardoRifiutato) !== Number(r.t)) proposte.push({ e, r, admin: false, quando: r.t });
      }
      let cambiati = 0;
      for (const { e, r, admin: daAdmin, quando } of proposte) {
        const min = Math.max(0, Math.round(Number(r.minuti) || 0));
        const si = await chiedi({ date: e.date, turno: turno(e), minuti: min, nome: String(r.nome || ''), admin: daAdmin, quando });
        if (si) {
          window.NaviDiariaOvertime.setOrdinary(e, min, servizio(e));
          e.ritardoEquipaggio = { da: String(r.nome || ''), minuti: min, t: r.t, ...(daAdmin ? { at: quando, admin: true } : {}) };
          e.imported = false;
        } else e.ritardoRifiutato = Number(r.t);
        if (daAdmin) e.ritardoAdminVisto = quando;
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
  window.NaviRitardiEquipaggio = { ...(window.NaviRitardiEquipaggio || {}), ricevi, pubblica };
})();
