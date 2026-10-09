// NaviSuite · widget per iPhone (app Scriptable, gratuita)
// A terra: la prossima nave che arriva al tuo scalo. A bordo: il prossimo scalo.
// Nel widget, in "Parameter", scrivi il tuo cognome (es. Pedroni; con omonimi anche l'iniziale: Pedroni M.)
// oppure il tuo numero di agente. Oppure scrivilo qui sotto.
const AGENTE = '';
const API_KEY = 'AIzaSyBfJZWHjr3AIANDBj2p8uQ0_hbcHdmnSiE';
const DB = 'https://navisuite-f116f-default-rtdb.europe-west1.firebasedatabase.app';
const APP = 'https://papamike80.github.io/NaviSuite/mio-turno.html';

const scritto = String(args.widgetParameter || AGENTE || '').trim();
let agente = '';
const famiglia = config.widgetFamily || 'medium';
const oggi = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const minuti = t => { const [h, m] = String(t).split('.').map(Number); return h * 60 + m; };
const adesso = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

// accesso a Firebase come l'app (anonimo), con il token ricordato nel Portachiavi
async function token() {
  const K = 'navisuite.widget.refresh';
  if (Keychain.contains(K)) {
    try {
      const r = new Request(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`);
      r.method = 'POST'; r.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      r.body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(Keychain.get(K))}`;
      const j = await r.loadJSON();
      if (j.id_token) { Keychain.set(K, j.refresh_token); return j.id_token; }
    } catch (e) { /* si rifa' l'accesso */ }
  }
  const r = new Request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`);
  r.method = 'POST'; r.headers = { 'Content-Type': 'application/json' }; r.body = '{"returnSecureToken":true}';
  const j = await r.loadJSON();
  Keychain.set(K, j.refreshToken);
  return j.idToken;
}

// cognome -> numero di agente (elenco preparato dal TrueNAS), ricordato sul telefono
async function numeroAgente(tok) {
  if (/^\d+$/.test(scritto) || /^[A-Z]+_[A-Z]+$/.test(scritto)) return scritto;
  const norm = String(scritto).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const K = `navisuite.widget.agente.${norm}`;
  if (Keychain.contains(K)) return Keychain.get(K);
  const nomi = await new Request(`${DB}/private/adminUpdates/widgetNomi.json?auth=${tok}`).loadJSON() || {};
  const id = nomi[norm.replace(/ /g, '_')] || nomi[norm];
  if (id === 'PIU') throw new Error('omonimi');
  if (!id) throw new Error('nome');
  Keychain.set(K, String(id));
  return String(id);
}

async function dati() {
  const tok = await token();
  agente = await numeroAgente(tok);
  const r = new Request(`${DB}/private/adminUpdates/widget/${encodeURIComponent(agente)}.json?auth=${tok}`);
  return r.loadJSON();
}

// "D1 S. MARCO arriva alle 19.00" -> "D1 S. MARCO"; prossimo scalo -> nome dello scalo
function righe(e) {
  const prima = String(e.testo || '').split('\n')[0];
  if (e.scalo) return { grande: e.scalo, piccola: `${e.titolo.split(' · ')[0]} · ${prima}` };
  return { grande: e.titolo.replace(/ (arriva|fa scalo) alle \d+\.\d+.*$/, ''), piccola: prima };
}

const w = new ListWidget();
w.url = APP;
w.backgroundColor = new Color('#0b2731');
const testo = (s, size, colore = '#ffffff', peso = 'bold') => { const t = w.addText(String(s)); t.font = peso === 'bold' ? Font.boldSystemFont(size) : Font.systemFont(size); t.textColor = new Color(colore); t.lineLimit = 1; t.minimumScaleFactor = 0.6; return t; };

let prossimi = [], turno = '', errore = '';
if (!scritto) errore = 'Scrivi il tuo cognome in Parameter';
else {
  try {
    const d = await dati();
    if (!d) errore = 'Agente non trovato';
    else if (d.data !== oggi()) errore = 'Dati di oggi non ancora pronti';
    else { turno = d.turno || ''; prossimi = (d.prossimi || []).filter(e => minuti(e.ora) >= adesso()); }
  } catch (e) { errore = e.message === 'omonimi' ? `Più agenti "${scritto}": aggiungi l'iniziale` : e.message === 'nome' ? `Non trovo "${scritto}"` : 'Nessuna connessione'; }
}

const lockscreen = famiglia.startsWith('accessory');
if (famiglia === 'accessoryInline') {
  const e = prossimi[0];
  testo(e ? `${e.ora} ${righe(e).grande}` : (errore || `${turno || 'NaviSuite'} · niente in arrivo`), 12);
} else if (lockscreen) {
  const e = prossimi[0];
  if (e) { const r = righe(e); testo(`${e.ora}  ${r.grande}`, 15); testo(r.piccola, 11, '#ffffff', 'regular'); if (prossimi[1]) testo(`poi ${prossimi[1].ora} ${righe(prossimi[1]).grande}`, 11, '#ffffff', 'regular'); }
  else { testo(turno || 'NaviSuite', 14); testo(errore || 'Niente altro oggi', 11, '#ffffff', 'regular'); }
} else {
  testo(`NAVISUITE${turno ? ' · ' + turno : ''}`, 10, '#2dd4bf');
  w.addSpacer(4);
  const e = prossimi[0];
  if (e) {
    const r = righe(e), manca = minuti(e.ora) - adesso();
    testo(e.ora, famiglia === 'small' ? 28 : 32, '#fde68a');
    testo(r.grande, famiglia === 'small' ? 15 : 18);
    testo(r.piccola, 12, '#a7c4cc', 'regular');
    testo(manca <= 0 ? 'adesso' : manca < 60 ? `tra ${manca} min` : `tra ${Math.floor(manca / 60)} h ${manca % 60} min`, 12, '#5eead4');
    if (famiglia !== 'small') prossimi.slice(1, 3).forEach(x => testo(`${x.ora}  ${righe(x).grande}`, 12, '#cfe3e8', 'regular'));
  } else {
    testo(errore || 'Niente altro oggi', 14);
  }
  w.addSpacer();
}
// iPhone ricarica i widget quando vuole: chiediamo ogni 5 minuti
w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium();
Script.complete();
