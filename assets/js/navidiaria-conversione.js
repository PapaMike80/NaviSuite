// NaviDiaria · straordinari trasformati in banca ore (come in Ore NaviG): per ogni mese l'agente sceglie quante ore
// degli straordinari maturati trasformare. Quelle ore non sono pagate e vanno in banca ore con il 10% in piu'.
// Salvate per mese sul telefono e su Firebase (private/adminUpdates/diariaConversioni/<agente>).
(() => {
  // sopra la Distinta mensile (la tabella del mese)
  const grid = document.getElementById('monthlySheetGrid');
  if (!grid) return;
  const MAGGIORAZIONE = 1.10;
  const agent = () => { try { return JSON.parse(localStorage.getItem('navidiaria.activeAgent') || 'null'); } catch { return null; } };
  const key = () => `navidiaria.conversioni.${agent()?.id || 'guest'}`;
  const leggi = () => { try { return JSON.parse(localStorage.getItem(key()) || 'null') || { map: {}, updatedAt: '' }; } catch { return { map: {}, updatedAt: '' }; } };
  let stato = leggi();
  const testo = m => { const v = Math.max(0, Math.round(m)); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; };
  // "3", "3:30", "3.30", "3,30" -> minuti
  const minuti = value => {
    const t = String(value || '').trim();
    if (!t) return 0;
    const m = t.match(/^(\d{1,3})(?:[:.,](\d{1,2}))?$/);
    if (!m) return NaN;
    return Number(m[1]) * 60 + Number((m[2] || '0').padEnd(2, '0').slice(0, 2));
  };

  const box = document.createElement('div');
  box.className = 'hero-convert';
  box.innerHTML = '<span class="hc-row"><small>Straordinari maturati</small><b data-hc="maturati">—</b></span>' +
    '<label class="hc-row"><small>Trasformati in banca ore</small><input data-hc="input" inputmode="decimal" placeholder="0:00" aria-label="Ore di straordinario da trasformare in banca ore"></label>' +
    '<span class="hc-row"><small>In banca ore (+10%)</small><b data-hc="bonus">—</b></span>' +
    '<span class="hc-row"><small>Straordinari pagati</small><b data-hc="pagati">—</b></span>';
  grid.insertAdjacentElement('beforebegin', box);
  const $ = name => box.querySelector(`[data-hc="${name}"]`);

  function aggiorna() {
    const t = window.NaviDiariaTotals;
    if (!t) return;
    const maturati = t.overtime || 0;
    const scelti = Math.min(stato.map[t.month] || 0, maturati);
    const bonus = Math.round(scelti * MAGGIORAZIONE);
    $('maturati').textContent = testo(maturati);
    $('bonus').textContent = scelti ? `+${testo(bonus)}` : '—';
    $('pagati').textContent = testo(maturati - scelti);
    if (document.activeElement !== $('input')) $('input').value = scelti ? testo(scelti) : '';
    // nel riepilogo: straordinari pagati e banca ore con le ore trasformate
    const hero = document.getElementById('heroOvertime'), banca = document.getElementById('heroBank');
    if (hero && typeof minutesToText === 'function') hero.textContent = minutesToText(maturati - scelti) + (scelti ? ' pagati' : '');
    if (banca && typeof minutesToText === 'function') banca.textContent = minutesToText((t.bank || 0) + bonus);
  }

  let timer = null;
  function salva(month, value) {
    stato = { map: { ...stato.map, [month]: value }, updatedAt: new Date().toISOString() };
    if (!value) delete stato.map[month];
    try { localStorage.setItem(key(), JSON.stringify(stato)); } catch { /* memoria piena */ }
    clearTimeout(timer);
    timer = setTimeout(() => {
      const id = agent()?.id;
      if (id) window.NaviAdminFirebase?.saveDiariaConversioni?.(String(id), stato).catch(error => console.warn('Trasformazione non salvata su Firebase', error));
    }, 1200);
  }

  $('input').addEventListener('change', event => {
    const t = window.NaviDiariaTotals;
    if (!t) return;
    const value = minuti(event.target.value);
    if (!Number.isFinite(value)) { event.target.value = ''; return; }
    salva(t.month, Math.min(value, t.overtime || 0));
    event.target.blur();
    if (typeof render === 'function') render(); else aggiorna();
  });
  $('input').addEventListener('keydown', event => { if (event.key === 'Enter') event.target.blur(); });
  document.addEventListener('navidiaria:render', aggiorna);
  aggiorna();

  // copia su Firebase: vince la piu' recente
  (async () => {
    try {
      const id = agent()?.id;
      if (!id || !window.NaviAdminFirebase?.getDiariaConversioni) return;
      await window.NaviAdminFirebase.ready;
      const remoto = await window.NaviAdminFirebase.getDiariaConversioni(String(id));
      if (remoto?.updatedAt && (!stato.updatedAt || remoto.updatedAt > stato.updatedAt)) {
        stato = { map: remoto.map || {}, updatedAt: remoto.updatedAt };
        localStorage.setItem(key(), JSON.stringify(stato));
        if (typeof render === 'function') render(); else aggiorna();
      } else if (stato.updatedAt && (!remoto || remoto.updatedAt < stato.updatedAt)) {
        await window.NaviAdminFirebase.saveDiariaConversioni(String(id), stato);
      }
    } catch (error) { console.warn('Trasformazione: Firebase non disponibile', error); }
  })();
})();
