// NaviDiaria · straordinari trasformati in banca ore (come in Ore NaviG): per ogni mese l'agente sceglie quante ore
// degli straordinari maturati trasformare. Quelle ore non sono pagate e vanno in banca ore con il 10% in piu'.
// Salvate per mese sul telefono e su Firebase (private/adminUpdates/diariaConversioni/<agente>).
(() => {
  // sotto la Distinta mensile (la tabella del mese)
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
  box.innerHTML = '<span class="hc-row"><small>Straordinari del mese</small><b data-hc="maturati">—</b></span>' +
    '<label class="hc-row"><small>Trasformati in banca ore</small><span class="hc-campo"><input data-hc="input" inputmode="decimal" placeholder="0:00" aria-label="Ore di straordinario da trasformare in banca ore"><button type="button" class="hc-trasforma" data-hc="apri">Trasforma</button></span>' +
    '<span class="hc-perc" data-hc="perc" hidden><button type="button" data-pct="50">50%</button><button type="button" data-pct="100">100%</button>' +
    '<input data-hc="pct" inputmode="numeric" placeholder="%" aria-label="Percentuale da trasformare"><button type="button" data-hc="applica">OK</button></span></label>' +
    '<span class="hc-row"><small>In banca ore (+10%)</small><b data-hc="bonus">—</b></span>' +
    '<span class="hc-row"><small>Straordinari pagati</small><b data-hc="pagati">—</b></span>' +
    '<div class="hc-anno"><span><small data-hc="anno-label">Banca ore dell\'anno</small><b data-hc="anno">—</b></span><p data-hc="anno-nota"></p></div>' +
    '<div class="hc-note"><b>Come chiedere la trasformazione (O.d.S. 40, 5/3°)</b>' +
    '<p>Dal 1° novembre 2026 la richiesta si manda <b>solo via e-mail</b> a <a href="mailto:pers.navigarda@navigazionelaghi.it">pers.navigarda@navigazionelaghi.it</a>, ' +
    '<b>entro il 5 del mese successivo</b> (per ottobre entro il 5 novembre). Una richiesta per ogni mese, con solo le ore da trasformare: ' +
    'non valgono richieste di più mesi insieme o scritte diversamente.</p>' +
    '<p class="hc-scadenza" data-hc="scadenza"></p>' +
    '<p class="hc-testo" data-hc="testo"></p>' +
    '<div class="hc-azioni"><a class="hc-mail" data-hc="mail" href="#">✉ Invia mail</a><button type="button" class="hc-copia" data-hc="copia">Copia testo</button></div></div>';
  grid.insertAdjacentElement('afterend', box);
  const $ = name => box.querySelector(`[data-hc="${name}"]`);

  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const EMAIL = 'pers.navigarda@navigazionelaghi.it';
  // nome dell'agente collegato come in anagrafica, con le maiuscole giuste ("PEDRONI MARCO" -> "Pedroni Marco")
  const nome = () => String(agent()?.name || '').trim().split(/\s+/).map(p => p.charAt(0) + p.slice(1).toLocaleLowerCase('it')).join(' ');
  const oreTesto = m => { const h = Math.floor(m / 60), r = m % 60; return `${h} ${h === 1 ? 'ora' : 'ore'}${r ? ` e ${r} minuti` : ''}`; };
  function richiesta(month, scelti) {
    const [y, m] = month.split('-').map(Number);
    return `Io sottoscritto ${nome()} chiede di trasformare numero ${oreTesto(scelti)} di straordinarie maturate nel mese di ${MESI[m - 1]} ${y}.`;
  }
  function scadenza(month) {
    const [y, m] = month.split('-').map(Number);
    const fine = new Date(y, m, 5, 23, 59); // il 5 del mese dopo
    const testo = `${fine.getDate()} ${MESI[fine.getMonth()]} ${fine.getFullYear()}`;
    return new Date() > fine ? `⚠ Termine scaduto il ${testo}.` : `Da inviare entro il ${testo}.`;
  }

  // ore trasformate del mese (al massimo gli straordinari del mese, se noti)
  function trasformati(month) {
    const v = stato.map[month] || 0;
    const mese = window.NaviDiariaMese?.month === month ? window.NaviDiariaMese.totale : null;
    return mese == null ? v : Math.min(v, mese);
  }
  // Banca ore dell'anno: quella di ogni giorno dell'anno (anche quella usata, in negativo) + le trasformazioni dei
  // mesi dell'anno con il 10% in piu'. Va usata entro il 31 dicembre.
  function bancaAnno(year) {
    const giorni = (typeof entries !== 'undefined' ? entries : []).filter(e => String(e.date || '').startsWith(`${year}-`))
      .reduce((sum, e) => sum + (Math.round(Number(e.bank) || 0)), 0);
    const conv = Object.keys(stato.map).filter(k => k.startsWith(`${year}-`)).reduce((sum, k) => sum + Math.round(trasformati(k) * MAGGIORAZIONE), 0);
    return giorni + conv;
  }

  function aggiorna() {
    const t = window.NaviDiariaTotals;
    if (!t) return;
    // come la colonna TOT. MESE della Distinta (anche le settimane non ancora finite, previste dai turni)
    const mese = window.NaviDiariaMese?.month === t.month ? window.NaviDiariaMese : null;
    const maturati = mese ? mese.totale : (t.overtime || 0), previsti = mese ? mese.previsti : 0;
    const scelti = Math.min(stato.map[t.month] || 0, maturati);
    const bonus = Math.round(scelti * MAGGIORAZIONE);
    $('maturati').textContent = testo(maturati) + (previsti ? ` (di cui ${testo(previsti)} previsti)` : '');
    $('bonus').textContent = scelti ? `+${testo(bonus)}` : '—';
    $('pagati').textContent = testo(maturati - scelti);
    if (document.activeElement !== $('input')) $('input').value = scelti ? testo(scelti) : '';
    $('scadenza').textContent = scadenza(t.month);
    const anno = t.month.slice(0, 4), bancaTot = bancaAnno(anno);
    $('anno-label').textContent = `Banca ore ${anno}`;
    $('anno').textContent = `${bancaTot < 0 ? '-' : ''}${testo(Math.abs(bancaTot))}`;
    $('anno-nota').textContent = `Le ore in banca vanno usate entro il 31 dicembre ${anno}.`;
    const corpo = scelti ? richiesta(t.month, scelti) : '';
    $('testo').textContent = corpo || 'Scrivi qui sopra le ore da trasformare: il testo della richiesta si prepara da solo.';
    const [y, m] = t.month.split('-').map(Number);
    $('mail').href = corpo ? `mailto:${EMAIL}?subject=${encodeURIComponent(`Trasformazione straordinari in banca ore - ${MESI[m - 1]} ${y} - ${nome()}`)}&body=${encodeURIComponent(corpo)}` : '#';
    $('mail').classList.toggle('off', !corpo);
    $('copia').disabled = !corpo;
    $('copia').dataset.testo = corpo;
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
    window.NaviDiariaRefreshMonthly?.(); // colonna TOT. MESE con la trasformazione
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
    salva(t.month, Math.min(value, window.NaviDiariaMese?.month === t.month ? window.NaviDiariaMese.totale : (t.overtime || 0)));
    event.target.blur();
    if (typeof render === 'function') render(); else aggiorna();
  });
  $('input').addEventListener('keydown', event => { if (event.key === 'Enter') event.target.blur(); });
  // Trasforma: una percentuale degli straordinari del mese (50%, 100% o scritta a mano)
  const totaleMese = t => (window.NaviDiariaMese?.month === t.month ? window.NaviDiariaMese.totale : (t.overtime || 0));
  function trasformaPercentuale(pct) {
    const t = window.NaviDiariaTotals;
    if (!t || !(pct >= 0)) return;
    salva(t.month, Math.round(totaleMese(t) * Math.min(100, pct) / 100));
    $('perc').hidden = true;
    if (typeof render === 'function') render(); else aggiorna();
  }
  $('apri').addEventListener('click', event => { event.preventDefault(); $('perc').hidden = !$('perc').hidden; if (!$('perc').hidden) $('pct').value = ''; });
  $('perc').addEventListener('click', event => {
    const b = event.target.closest('[data-pct]');
    if (b) { event.preventDefault(); trasformaPercentuale(Number(b.dataset.pct)); }
  });
  const applicaPct = () => { const v = Number(String($('pct').value).replace('%', '').replace(',', '.')); if (Number.isFinite(v) && v >= 0) trasformaPercentuale(v); };
  $('applica').addEventListener('click', event => { event.preventDefault(); applicaPct(); });
  $('pct').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); applicaPct(); } });

  $('mail').addEventListener('click', event => { if ($('mail').classList.contains('off')) event.preventDefault(); });
  $('copia').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('copia').dataset.testo || ''); $('copia').textContent = 'Copiato ✓'; }
    catch { $('copia').textContent = 'Copia non riuscita'; }
    setTimeout(() => { $('copia').textContent = 'Copia testo'; }, 1800);
  });
  document.addEventListener('navidiaria:render', aggiorna);
  window.NaviDiariaConversione = { aggiorna, trasformati };
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
        window.NaviDiariaRefreshMonthly?.();
        if (typeof render === 'function') render(); else aggiorna();
      } else if (stato.updatedAt && (!remoto || remoto.updatedAt < stato.updatedAt)) {
        await window.NaviAdminFirebase.saveDiariaConversioni(String(id), stato);
      }
    } catch (error) { console.warn('Trasformazione: Firebase non disponibile', error); }
  })();
})();
