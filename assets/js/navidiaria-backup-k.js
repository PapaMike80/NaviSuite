// NaviDiaria · converte il backup di "Ore NaviG" (orario-navig-4.netlify.app) nelle giornate della Distinta.
// Il file di K ha una chiave per mese (ore_v3_ANNO_MESE, mese da 0) con i campi di ogni cella: o_/r_ ore, d_ diaria,
// k_ ticket, bo_ banca ore, i_ imbarco, ff_ bigliettaio (= maneggio denaro), n_ note. Il turno non c'e': si usa quello gia' presente nella Distinta.
(() => {
  const RE_MESE = /^ore_v3_(\d{4})_(\d{1,2})$/;
  const riconosci = dati => !!dati && typeof dati === 'object' && !Array.isArray(dati) && Object.keys(dati).some(k => RE_MESE.test(k));
  const minuti = v => { const m = String(v || '').trim().match(/^(\d{1,3})(?:[:.,](\d{1,2}))?$/); return m ? Number(m[1]) * 60 + Number((m[2] || '0').padEnd(2, '0').slice(0, 2)) : 0; };
  const due = n => String(n).padStart(2, '0');
  const lavora = s => !['RIP', 'RIPOSO', 'MALATTIA'].includes(String(s || '').toUpperCase());

  // attuali: Map data -> giornata gia' in Distinta. Restituisce { entries, conversioni, saltati, mesi }
  function converti(dati, attuali, { servizio } = {}) {
    const entries = [], conversioni = {}, saltati = [], mesi = new Set();
    const ovt = window.NaviDiariaOvertime;
    for (const [chiave, grezzo] of Object.entries(dati)) {
      const k = chiave.match(RE_MESE);
      if (!k) continue;
      let mese; try { mese = typeof grezzo === 'string' ? JSON.parse(grezzo) : grezzo; } catch { continue; }
      if (!mese || typeof mese !== 'object') continue;
      const anno = Number(k[1]), m = Number(k[2]), tag = `${anno}-${due(m + 1)}`;
      const trasf = minuti(mese['str-trasformati']);
      if (trasf) conversioni[tag] = trasf;
      const giorni = new Date(anno, m + 1, 0).getDate();
      for (let g = 1; g <= giorni; g++) {
        const id = `${anno}-${m}-${g}`, data = `${tag}-${due(g)}`;
        const lav = minuti(mese[`o_${id}`]) + minuti(mese[`r_${id}`]);
        const diaria = String(mese[`d_${id}`] || ''), tk = Number(mese[`k_${id}`]) || 0, bo = minuti(mese[`bo_${id}`]);
        const imb = mese[`i_${id}`] === true, big = mese[`ff_${id}`] === "1", nota = String(mese[`n_${id}`] || '').trim();
        if (!lav && !diaria && !tk && !bo && !imb && !big && !nota) continue;
        const base = attuali.get(data);
        if (!base || !lavora(base.shift)) { if (lav || diaria) saltati.push(data); continue; }
        const e = JSON.parse(JSON.stringify(base));
        const serv = servizio ? servizio(e) : Number(e.serviceMinutes) || 0;
        // lo straordinario totale e' ore - servizio; cambio e sentine gia' presenti in Distinta restano, il resto e' ritardo
        const altri = (Number(e.overtimeComponents?.cambi) || 0) + (Number(e.overtimeComponents?.sentine) || 0);
        if (lav && ovt) ovt.setOrdinary(e, Math.max(0, lav - serv - altri), serv);
        const parti = diaria.split('+');
        if (parti.includes('40')) e.overnight40 = true;
        const perc = parti.map(Number).find(n => [9, 24, 50].includes(n));
        if (perc) e.allowanceRate = perc;
        if (tk) { e.ticketPresence = true; e.mealUsed = true; if (tk >= 2) e.secondMeal = 1; }
        if (bo) e.bank = bo;
        if (imb) e.embark = true;
        if (big) { e.cashHandling = true; e.cashHandlingManual = true; } // bigliettaio = maneggio denaro
        if (nota) e.note = e.note ? `${e.note} · ${nota}` : nota;
        e.imported = false; e.manualOverride = true;
        entries.push(e); mesi.add(tag);
      }
    }
    return { entries, conversioni, saltati, mesi: [...mesi].sort() };
  }
  window.NaviDiariaBackupK = { riconosci, converti };
})();
