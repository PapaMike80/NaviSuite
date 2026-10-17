// Ricorda per ogni pagina quali sezioni l'utente ha aperto o chiuso, e le rimette cosi' al passaggio successivo.
// Vale per i quattro tipi di sezione richiudibile di NaviSuite: <details>, .ns-sez (.chiusa), .settings-foldable
// (data-collapsed) e .section con freccia (.collapsed, pagina Agenti). Si salva solo dopo un tocco dell'utente:
// le chiusure fatte dalla pagina all'apertura non contano. Per riaprire/chiudere si "tocca" il titolo, cosi'
// la pagina fa le sue cose (riassunti, caricamenti) come se lo avesse fatto l'utente.
(() => {
  if (window.__naviSectionMemory) return;
  window.__naviSectionMemory = true;
  const pagina = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const KEY = `navisuite.sezioni.${pagina}`;
  const leggi = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
  const scrivi = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* niente */ } };

  // tipo di sezione: come si legge se e' aperta e quale elemento si tocca per cambiarla
  function tipo(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.tagName === 'DETAILS') return { aperta: () => el.open, testa: () => el.querySelector(':scope>summary') };
    if (el.classList.contains('ns-sez')) return { aperta: () => !el.classList.contains('chiusa'), testa: () => el.querySelector(':scope>.pref-head,:scope>.section-head') };
    if (el.classList.contains('settings-foldable') && el.dataset.collapsed) return { aperta: () => el.dataset.collapsed !== 'true', testa: () => el.querySelector(':scope>.section-head') };
    if (el.classList.contains('section') && el.querySelector(':scope>.section-head>.chevron')) return { aperta: () => !el.classList.contains('collapsed'), testa: () => el.querySelector(':scope>.section-head') };
    return null;
  }
  const SEL = 'details,.ns-sez,.settings-foldable,.section';
  function chiave(el) {
    if (el.id) return '#' + el.id;
    const t = el.querySelector(':scope>summary,:scope>.pref-head h2,:scope>.section-head h2,:scope>.section-head h3');
    const testo = String(t?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return testo ? 't:' + testo : '';
  }

  // salvataggio: subito dopo un tocco o un tasto, la sezione che lo contiene ha cambiato stato?
  function dopoTocco(event) {
    const el = event.target.closest?.(SEL);
    if (!el) return;
    const prima = [];
    for (let s = el; s; s = s.parentElement?.closest(SEL)) { const t = tipo(s); if (t) prima.push([s, t, t.aperta()]); }
    setTimeout(() => {
      const stato = leggi();
      let cambiato = false;
      prima.forEach(([s, t, era]) => { const ora = t.aperta(), k = chiave(s); if (k && ora !== era) { stato[k] = ora; cambiato = true; } });
      if (cambiato) scrivi(stato);
    }, 60);
  }
  document.addEventListener('click', dopoTocco, true);
  document.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') dopoTocco(e); }, true);

  // ripristino: per qualche secondo (le sezioni arrivano anche dopo, da Firebase) rimette lo stato salvato
  const fatte = new Set();
  function ripristina() {
    const stato = leggi();
    if (!Object.keys(stato).length) return;
    document.querySelectorAll(SEL).forEach(el => {
      const t = tipo(el), k = t && chiave(el);
      if (!k || fatte.has(el) || !(k in stato)) return;
      fatte.add(el);
      if (t.aperta() === stato[k]) return;
      if (el.tagName === 'DETAILS') { el.open = stato[k]; return; }
      t.testa()?.click();
    });
  }
  const avvia = () => {
    setTimeout(ripristina, 300);
    const obs = new MutationObserver(() => { clearTimeout(avvia.t); avvia.t = setTimeout(ripristina, 120); });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-collapsed'] });
    setTimeout(() => obs.disconnect(), 5000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia); else avvia();
})();
