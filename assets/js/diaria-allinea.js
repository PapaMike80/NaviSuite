// Allineamento della Distinta tra Firebase e PocketBase.
// Legge le due copie, trova le giornate diverse e, se ce ne sono, mostra un popup:
// per ogni giornata l'agente sceglie quale versione e' corretta. Il risultato viene
// salvato su entrambi gli archivi, cosi' tornano uguali.
(function () {
  'use strict';
  const NOMI = {
    shift: 'Turno', delay: 'Ritardo/straord. (min)', overtimeComponents: 'Straordinari', bank: 'Banca ore (min)',
    allowanceRate: 'Diaria %', embark: 'Imbarco', cashHandling: 'Maneggio denaro', mealUsed: 'Ticket usato',
    ticketPresence: 'Ticket', secondMeal: '2° ticket', overnight40: 'Pernotto 40%', holidayWorked: 'Festività',
    travel: 'Trasferta', travelMinutes: 'Trasferta (min)', note: 'Note', workedMinutes: 'Ore lavorate (min)',
    serviceMinutes: 'Ore servizio (min)', missedRest: 'Mancato riposo (min)', rf: 'RF', refuel: 'Rifornimento', param139: 'Parametro 139'
  };
  const IGNORA = new Set(['modificatoIl', 'id', 'date', 'manualModified', 'manualOverride']);
  const vuoto = v => v === null || v === undefined || v === '' || v === false || v === 0 || v === '0' || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(pulisci(v)).length);
  function pulisci(o) {
    const out = {};
    Object.keys(o || {}).sort().forEach(k => {
      if (IGNORA.has(k)) return;
      let v = o[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) v = pulisci(v);
      if (!vuoto(v)) out[k] = typeof v === 'number' || typeof v === 'boolean' || typeof v === 'object' ? v : String(v);
    });
    return out;
  }
  const testo = v => v === undefined ? '—' : v === true ? 'sì' : typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k} ${x}`).join(', ') : String(v);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // [{date, fb, pb, campi:[{nome, fb, pb}], suggerita:'fb'|'pb'}]
  function differenze(fbEntries, pbEntries) {
    const mappa = list => new Map((list || []).filter(e => e && e.date).map(e => [String(e.date).slice(0, 10), e]));
    const fb = mappa(fbEntries), pb = mappa(pbEntries);
    const giorni = [...new Set([...fb.keys(), ...pb.keys()])].sort();
    const out = [];
    giorni.forEach(date => {
      const a = fb.get(date), b = pb.get(date);
      const pa = pulisci(a), pbb = pulisci(b);
      if (JSON.stringify(pa) === JSON.stringify(pbb)) return;
      const chiavi = [...new Set([...Object.keys(pa), ...Object.keys(pbb)])].sort();
      const campi = chiavi.filter(k => JSON.stringify(pa[k]) !== JSON.stringify(pbb[k])).map(k => ({ nome: NOMI[k] || k, fb: a ? testo(pa[k]) : 'giornata assente', pb: b ? testo(pbb[k]) : 'giornata assente' }));
      const suggerita = !b ? 'fb' : !a ? 'pb' : (Number(b.modificatoIl) || 0) > (Number(a.modificatoIl) || 0) ? 'pb' : 'fb';
      out.push({ date, fb: a || null, pb: b || null, campi, suggerita });
    });
    return out;
  }

  const data = d => new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  // Popup: risolve con {date: 'fb'|'pb'} oppure null se l'agente rimanda la scelta
  function scegli(diffs) {
    return new Promise(resolve => {
      document.getElementById('allinea-popup')?.remove();
      const box = document.createElement('div');
      box.id = 'allinea-popup';
      box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Manrope,system-ui,sans-serif';
      const btn = 'border-radius:999px;border:1px solid #1f4250;padding:8px 14px;font:700 13px inherit;cursor:pointer';
      box.innerHTML = `<div role="dialog" aria-modal="true" aria-labelledby="allinea-t" style="background:#0b1c26;color:#eaf2f4;border:1px solid #1f4250;border-radius:18px;width:100%;max-width:560px;max-height:90vh;display:flex;flex-direction:column">
        <div style="padding:16px 16px 8px"><h2 id="allinea-t" style="margin:0 0 4px;font-size:18px">Firebase e PocketBase non coincidono</h2>
        <p style="margin:0;color:#9fb8c2;font-size:13px">${diffs.length === 1 ? 'Una giornata è diversa' : `${diffs.length} giornate sono diverse`} nei due archivi. Scegli per ognuna la versione corretta: verrà salvata su entrambi. È già proposta quella modificata più di recente.</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><button type="button" data-tutte="fb" style="${btn};background:#102733;color:#eaf2f4">Tutte Firebase</button><button type="button" data-tutte="pb" style="${btn};background:#102733;color:#eaf2f4">Tutte PocketBase</button></div></div>
        <div style="overflow:auto;padding:0 16px">${diffs.map((d, i) => `<fieldset style="border:1px solid #1f4250;border-radius:12px;margin:8px 0;padding:10px 12px"><legend style="font-weight:800;padding:0 4px">${esc(data(d.date))}</legend>
          <table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;color:#9fb8c2;padding:2px 4px">Campo</th><th style="text-align:left;color:#2dd4bf;padding:2px 4px">Firebase</th><th style="text-align:left;color:#a78bfa;padding:2px 4px">PocketBase</th></tr></thead><tbody>${d.campi.map(c => `<tr><td style="padding:3px 4px;color:#9fb8c2">${esc(c.nome)}</td><td style="padding:3px 4px">${esc(c.fb)}</td><td style="padding:3px 4px">${esc(c.pb)}</td></tr>`).join('')}</tbody></table>
          <div style="display:flex;gap:14px;margin-top:8px;font-size:13px;font-weight:700"><label><input type="radio" name="al-${i}" value="fb"${d.suggerita === 'fb' ? ' checked' : ''}> Firebase</label><label><input type="radio" name="al-${i}" value="pb"${d.suggerita === 'pb' ? ' checked' : ''}> PocketBase</label></div></fieldset>`).join('')}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:12px 16px;border-top:1px solid #1f4250"><button type="button" data-op="dopo" style="${btn};background:transparent;color:#9fb8c2">Decidi dopo</button><button type="button" data-op="ok" style="${btn};background:#2dd4bf;border-color:#2dd4bf;color:#06231f">Salva le scelte su entrambi</button></div></div>`;
      document.body.appendChild(box);
      box.addEventListener('click', e => {
        const tutte = e.target.closest('[data-tutte]');
        if (tutte) { box.querySelectorAll(`input[value="${tutte.dataset.tutte}"]`).forEach(r => { r.checked = true; }); return; }
        const op = e.target.closest('[data-op]')?.dataset.op;
        if (!op) return;
        const scelte = op === 'ok' ? Object.fromEntries(diffs.map((d, i) => [d.date, box.querySelector(`input[name="al-${i}"]:checked`)?.value || d.suggerita])) : null;
        box.remove();
        resolve(scelte);
      });
    });
  }

  // Applica le scelte: per le giornate uguali resta Firebase, per le diverse la versione scelta.
  function unisci(fbEntries, diffs, scelte) {
    const mappa = new Map((fbEntries || []).filter(e => e && e.date).map(e => [String(e.date).slice(0, 10), e]));
        const ora = Date.now();
    // la versione scelta diventa la piu' recente: nessun telefono rimasto indietro la sovrascrive
    diffs.forEach(d => { const v = scelte[d.date] === 'pb' ? d.pb : d.fb; if (v) mappa.set(d.date, { ...v, modificatoIl: ora }); else mappa.delete(d.date); });
    return [...mappa.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  let inCorso = null;
  // Legge entrambi gli archivi e li allinea. Ritorna {entries, fonte, stato:'uguali'|'allineati'|'rimandato'|'solo-firebase'|'solo-pocketbase', diffs}
  async function carica(agentId) {
    if (inCorso) return inCorso;
    inCorso = (async () => {
      const id = String(agentId);
      const fbApi = window.NaviAdminFirebase, pbApi = window.NaviAdminPB;
      const [fb, pb] = await Promise.allSettled([
        (async () => { await fbApi.ready; return fbApi.loadDiaria(id); })(),
        pbApi?.loadDiaria ? pbApi.loadDiaria(id) : Promise.reject(new Error('PocketBase non disponibile'))
      ]);
      if (fb.status !== 'fulfilled' && pb.status !== 'fulfilled') throw fb.reason;
      if (pb.status !== 'fulfilled') return { ...fb.value, stato: 'solo-firebase', errorePB: pb.reason, diffs: [] };
      if (fb.status !== 'fulfilled') return { ...pb.value, stato: 'solo-pocketbase', diffs: [] };
      const fbE = fb.value.entries || [], pbE = pb.value.entries || [];
      // PocketBase vuoto (agente mai copiato): si copia Firebase senza chiedere
      if (!pbE.length && fbE.length) { pbApi.saveDiaria(id, fbE).catch(e => console.warn('Copia su PocketBase non riuscita', e)); return { ...fb.value, stato: 'allineati', diffs: [] }; }
      const diffs = differenze(fbE, pbE);
      if (!diffs.length) return { ...fb.value, stato: 'uguali', diffs };
      // Solo gli admin vedono il popup: gli agenti non devono sapere dove sono salvati i dati,
      // per loro vince in automatico la versione modificata piu' di recente.
      let admin = false;
      try { admin = !!window.NaviRoles?.isAdminAgent?.(JSON.parse(localStorage.getItem('navidiaria.activeAgent') || 'null')); } catch (_) { admin = false; }
      const scelte = admin ? await scegli(diffs) : Object.fromEntries(diffs.map(d => [d.date, d.suggerita]));
      if (!scelte) return { ...fb.value, stato: 'rimandato', diffs };
      const unite = unisci(fbE, diffs, scelte);
      await Promise.allSettled([fbApi.saveDiaria(id, unite), pbApi.saveDiaria(id, unite)]);
      return { ...fb.value, entries: unite, entryCount: unite.length, stato: 'allineati', diffs };
    })();
    try { return await inCorso; } finally { inCorso = null; }
  }

  const api = { differenze, scegli, unisci, carica };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.NaviDiariaAllinea = api;
})();
