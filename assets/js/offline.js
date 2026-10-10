// NaviSuite senza rete (o con segnale debole, in mezzo al lago).
// - Barra in alto "Senza rete · dati delle 10:42" quando manca la connessione.
// - Coda di invio: ritardi, pontili e altre scritte fatte senza rete restano sul telefono
//   ("⏳ in attesa di invio") e partono da sole appena torna il segnale.
// Uso: NaviOffline.gestore('ritardo', async dati => { ...invio... });  NaviOffline.accoda('ritardo', dati, chiave)
(function (root) {
  if (root.NaviOffline) return;
  const KEY = 'navisuite.codaInvio';
  const gestori = {};
  const leggi = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch { return []; } };
  const scrivi = lista => { try { localStorage.setItem(KEY, JSON.stringify(lista)); } catch { /* niente */ } aggiornaBarra(); };
  const hhmm = ms => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  // Un errore di rete (non un "permesso negato" o un dato sbagliato): conviene riprovare piu' tardi.
  function erroreDiRete(error) {
    if (!navigator.onLine) return true;
    const m = String(error?.message || error || '');
    return error?.name === 'TypeError' || error?.name === 'AbortError' || /fetch|network|rete|non risponde|timeout|Load failed/i.test(m);
  }

  // chiave: un nuovo invio con la stessa chiave sostituisce quello in coda (es. stesso ritardo corretto due volte)
  function accoda(tipo, dati, chiave = '') {
    const lista = leggi().filter(x => !(chiave && x.tipo === tipo && x.chiave === chiave));
    lista.push({ tipo, dati, chiave, t: Date.now() });
    scrivi(lista);
  }
  const inAttesa = (tipo, chiave) => leggi().some(x => x.tipo === tipo && (!chiave || x.chiave === chiave));
  const datiInAttesa = (tipo, chiave) => leggi().filter(x => x.tipo === tipo && x.chiave === chiave).pop()?.dati || null;

  let invio = null;
  async function svuota() {
    if (invio || !navigator.onLine) return invio;
    invio = (async () => {
      for (const item of leggi()) {
        const fn = gestori[item.tipo];
        if (!fn) continue;
        try {
          await fn(item.dati);
          scrivi(leggi().filter(x => !(x.t === item.t && x.tipo === item.tipo)));
        } catch (error) {
          if (erroreDiRete(error)) break; // ancora senza segnale: si riprova piu' tardi
          console.warn('Invio in coda scartato', item, error);
          scrivi(leggi().filter(x => !(x.t === item.t && x.tipo === item.tipo)));
        }
      }
    })().finally(() => { invio = null; document.dispatchEvent(new CustomEvent('navioffline:inviati')); });
    return invio;
  }
  function gestore(tipo, fn) { gestori[tipo] = fn; setTimeout(svuota, 500); }

  // Barra di stato
  let barra = null, copiaLocale = false;
  // rete lenta: i dati non sono arrivati e si usa la copia sul telefono (anche se il telefono risulta online)
  function segnaCopiaLocale(si) { copiaLocale = !!si; aggiornaBarra(); }
  function aggiornaBarra() {
    if (!document.body) return;
    const coda = leggi().length, offline = !navigator.onLine || copiaLocale;
    if (!offline && !coda) { barra?.remove(); barra = null; return; }
    if (!barra) {
      barra = document.createElement('div');
      barra.id = 'navi-offline-bar';
      barra.setAttribute('role', 'status');
      barra.style.cssText = 'position:fixed;left:50%;top:calc(6px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:100050;max-width:92vw;padding:6px 12px;border-radius:999px;font:800 12px/1.3 Manrope,Arial,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35);pointer-events:none;text-align:center';
      document.body.appendChild(barra);
    }
    const quando = Number(localStorage.getItem('navi.sharedDataTime.v1') || 0);
    const parti = [];
    if (offline) parti.push(`OFFLINE · copia locale${quando ? ` delle ${hhmm(quando)}` : ''}, si aggiorna al ritorno della rete`);
    if (coda) parti.push(`⏳ ${coda} ${coda === 1 ? 'modifica' : 'modifiche'} in attesa di invio`);
    barra.textContent = parti.join(' · ');
    barra.style.background = offline ? '#3f2a07' : '#0f303c';
    barra.style.color = offline ? '#fbbf24' : '#5eead4';
    barra.style.border = `1px solid ${offline ? '#f59e0b' : '#2dd4bf'}`;
  }

  root.addEventListener('online', () => { copiaLocale = false; aggiornaBarra(); svuota(); });
  root.addEventListener('offline', aggiornaBarra);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') svuota(); });
  setInterval(svuota, 30000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aggiornaBarra); else aggiornaBarra();

  root.NaviOffline = { segnaCopiaLocale, datiInAttesa, accoda, gestore, svuota, inAttesa, erroreDiRete, aggiornaBarra };
})(window);
