// NaviSuite · backup della Distinta (NaviDiaria): JSON per ripristinare e CSV leggibile (Excel, Numbers, Google Fogli).
// Usato dalla Distinta (backup personale), dalla pagina Agenti (backup di tutti) e dal programma sul TrueNAS.
// Modulo puro: niente DOM, salvo scarica().
(function (root) {
  'use strict';
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const min = v => Math.max(0, Math.round(Number(v) || 0));
  const ore = m => { const n = Math.round(Number(m) || 0), a = Math.abs(n); return n ? `${n < 0 ? '-' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}` : ''; };
  const si = v => (v ? 'sì' : '');
  const lavoro = e => !!e && !['RIP', 'RIPOSO', 'MALATTIA'].includes(String(e.shift || '').toUpperCase());

  // Straordinario del giorno per causali: ordinario (ritardo), cambi, sentine (record vecchi: delay + changeMinutes)
  function causali(e) {
    const c = e?.overtimeComponents;
    if (c && typeof c === 'object' && !Array.isArray(c)) return { ritardo: min(c.ordinario), cambio: min(c.cambi), sentine: min(c.sentine) };
    return { ritardo: min(e?.delay), cambio: min(e?.changeMinutes), sentine: min(e?.sentineActivity?.minutes) };
  }
  function servizio(e) {
    if (!lavoro(e)) return 0;
    if (Number.isFinite(Number(e.serviceMinutes))) return min(e.serviceMinutes);
    const C = root.NaviShiftCompetence;
    return C ? Math.round((Number(C.shiftForCode(e.shift, e.date)?.hours) || 0) * 60) : 0;
  }
  function lavorate(e) {
    if (!lavoro(e)) return 0;
    if (Number.isFinite(Number(e.workedMinutes)) && Number(e.workedMinutes) >= 0) return min(e.workedMinutes);
    const c = causali(e);
    return servizio(e) + c.ritardo + c.cambio + c.sentine + min(e.refuelWorked);
  }

  const COLONNE = ['Data', 'Giorno', 'Turno', 'Ore servizio', 'Ore lavorate', 'Straordinario del giorno', 'di cui ritardo', 'di cui cambio',
    'di cui sentine', 'Banca ore', 'Rifornimento (anticipo)', 'Ticket', '2° ticket', 'Diaria %', 'Pernotto 40%', 'Imbarco', 'Festività',
    'Maneggio denaro', 'Trasferta', 'Note'];
  function riga(e) {
    const d = new Date(`${e.date}T12:00:00`), c = causali(e), w = lavoro(e);
    return [e.date, GIORNI[d.getDay()], e.shift || '', ore(servizio(e)), ore(lavorate(e)), w ? ore(c.ritardo + c.cambio + c.sentine) : '',
      w ? ore(c.ritardo) : '', w ? ore(c.cambio) : '', w ? ore(c.sentine) : '', ore(e.bank), w ? ore(e.refuel) : '',
      w ? si(e.ticketPresence ?? e.mealUsed) : '', w ? si(Number(e.secondMeal) > 0) : '', w && e.allowanceRate != null ? String(e.allowanceRate) : '',
      w ? si(e.overnight40) : '', w ? si(e.embark) : '', w ? si(e.holidayWorked) : '', w ? si(e.cashHandling) : '', si(e.travel), e.note || ''];
  }
  const cella = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const linea = valori => valori.map(cella).join(';');

  // CSV di una o piu' distinte: una riga per giorno, dopo ogni mese i totali (con le ore trasformate in banca ore).
  // agenti: [{id, nome, entries, conversioni: {'2026-10': minuti}}]; con piu' agenti si aggiungono le colonne Agente e Numero.
  function csv(agenti) {
    const multi = agenti.length > 1;
    const out = [linea([...(multi ? ['Agente', 'Numero'] : []), ...COLONNE])];
    agenti.forEach(a => {
      const pre = multi ? [a.nome || '', a.id || ''] : [];
      const giorni = (a.entries || []).filter(e => e?.date).sort((x, y) => x.date.localeCompare(y.date));
      const mesi = [...new Set(giorni.map(e => e.date.slice(0, 7)))];
      mesi.forEach(mese => {
        const lista = giorni.filter(e => e.date.startsWith(mese));
        lista.forEach(e => out.push(linea([...pre, ...riga(e)])));
        const lav = lista.filter(lavoro), tot = f => lav.reduce((s, e) => s + f(e), 0);
        const [y, m] = mese.split('-').map(Number);
        out.push(linea([...pre, `TOTALE ${MESI[m - 1]} ${y}`, '', `${lav.length} gg`, ore(tot(servizio)), ore(tot(lavorate)),
          ore(tot(e => { const c = causali(e); return c.ritardo + c.cambio + c.sentine; })), '', '', '', ore((a.entries || []).filter(e => e?.date?.startsWith(mese)).reduce((s, e) => s + (Math.round(Number(e.bank) || 0)), 0)),
          '', String(lav.filter(e => e.ticketPresence ?? e.mealUsed).length), '', String(lav.filter(e => e.allowanceRate != null).length), '', String(lav.filter(e => e.embark).length), '', '', '', '']));
        const conv = Number(a.conversioni?.[mese]) || 0;
        if (conv) out.push(linea([...pre, `Trasformati in banca ore ${MESI[m - 1]} ${y}`, '', '', '', '', ore(conv), '', '', '', `+${ore(Math.round(conv * 1.1))}`]));
      });
      if (multi) out.push('');
    });
    return '﻿' + out.join('\r\n'); // BOM: Excel legge gli accenti
  }

  const oggi = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const nomeFile = s => String(s || '').trim().replace(/[^A-Za-z0-9À-ÿ]+/g, '-').replace(/^-|-$/g, '') || 'agente';
  function scarica(nome, testo, tipo) {
    const blob = new Blob([testo], { type: tipo });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  root.NaviDiariaBackup = { COLONNE, riga, csv, oggi, nomeFile, scarica, lavorate, servizio, causali };
})(typeof window !== 'undefined' ? window : globalThis);
