// Guide animate alla prima apertura: il menu la prima volta che si entra nell'app, la Distinta la prima
// volta che si apre la Distinta. Ognuna una sola volta per dispositivo («Ho capito»); si aspetta che non
// ci siano altri avvisi aperti (es. le Novità).
(function () {
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const GUIDE = [
    { id: 'distinta', pagine: ['navidiaria.html'], titolo: 'Modificare una giornata', testo: 'Tocca il giorno, cambia le voci o tocca una bolla, poi chiudi con la ✕: la giornata è salvata.', gif: 'assets/images/guide/guida-distinta.gif' },
    { id: 'menu', pagine: null, titolo: 'Sposta le pagine nel menu', testo: 'Apri il menu ☰, tieni premuta una pagina e trascinala dove vuoi: il menu si riordina da solo.', gif: 'assets/images/guide/guida-menu.gif' }
  ];
  const chiave = id => `navisuite.guidaVista.${id}`;
  const vista = id => { try { return localStorage.getItem(chiave(id)) === '1'; } catch (_) { return true; } };
  const segna = id => { try { localStorage.setItem(chiave(id), '1'); } catch (_) {} };
  const guida = GUIDE.find(g => !vista(g.id) && (!g.pagine || g.pagine.includes(file)));
  if (!guida) return;
  // altri riquadri aperti (Novità, accesso, ecc.): si riprova finche' non si chiudono
  const visibile = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const occupato = () => [...document.querySelectorAll('#loginOverlay,.announcement-overlay,.navi-news-overlay,[role="dialog"]:not(#navi-guida),.weekly-edit-overlay,#navisuite-popup')].some(visibile) || document.body.classList.contains('login-open');
  function mostra() {
    if (vista(guida.id)) return;
    if (occupato()) { setTimeout(mostra, 1200); return; }
    const box = document.createElement('div');
    box.id = 'navi-guida'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', guida.titolo);
    box.innerHTML = `<style>
      #navi-guida{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(2,12,17,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
      #navi-guida .ng-box{width:min(380px,100%);max-height:calc(100dvh - 32px);display:grid;gap:10px;padding:16px;border-radius:22px;border:1px solid #2e6971;background:linear-gradient(165deg,#102e39,#0a222c);box-shadow:0 22px 56px rgba(0,0,0,.55);color:#eaf2f4;font:500 14px/1.45 Manrope,system-ui,sans-serif;overflow:auto}
      #navi-guida small{color:#2dd4bf;font-weight:800;letter-spacing:.2em;font-size:11px}
      #navi-guida h2{margin:0;font-size:20px;font-weight:800}
      #navi-guida p{margin:0;color:#9fb8c2;font-size:13px}
      #navi-guida img{width:100%;max-height:52dvh;object-fit:contain;border-radius:14px;border:1px solid #1f4250;background:#071923}
      #navi-guida button{min-height:46px;border:0;border-radius:14px;background:linear-gradient(90deg,#2dd4bf,#67d7e6);color:#06231f;font:800 15px Manrope,system-ui,sans-serif;cursor:pointer}
    </style><div class="ng-box"><small>COME SI FA</small><h2>${guida.titolo}</h2><img src="${guida.gif}" alt="${guida.titolo}: guida animata"><p>${guida.testo}</p><button type="button">Ho capito</button></div>`;
    const chiudi = () => { segna(guida.id); box.remove(); };
    box.querySelector('button').addEventListener('click', chiudi);
    box.addEventListener('click', e => { if (e.target === box) chiudi(); });
    document.body.appendChild(box);
  }
  const via = () => setTimeout(mostra, 1500);
  if (document.readyState === 'complete') via(); else addEventListener('load', via, { once: true });
})();
