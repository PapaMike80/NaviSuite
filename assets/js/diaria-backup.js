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
  // Ore lavorate con la stessa formula della Distinta (navidiaria-monthly.js): quelle salvate, altrimenti
  // servizio + straordinario (record vecchi: + cambio)
  function lavorate(e) {
    if (!lavoro(e)) return 0;
    const c = e.overtimeComponents, strutturato = !!c && typeof c === 'object' && !Array.isArray(c), k = causali(e);
    const manuale = Number(e.workedMinutes);
    const base = Number.isFinite(manuale) && manuale >= 0 ? manuale : servizio(e) + (strutturato ? k.ritardo + k.cambio + k.sentine : k.ritardo);
    return base + (strutturato ? 0 : k.cambio);
  }

  // Straordinario come nella Distinta: per settimana (lunedi'-domenica) le ore lavorate oltre le 39, contate nel mese
  // della domenica. sett(entries, domenica) -> {dal, al, lavorate, straordinario}
  const SOGLIA = 39 * 60;
  const isoD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function sett(entries, domenica) {
    const fine = new Date(`${domenica}T12:00:00`), inizio = new Date(fine); inizio.setDate(fine.getDate() - 6);
    const dal = isoD(inizio), lav = (entries || []).filter(e => e?.date >= dal && e.date <= domenica).reduce((s, e) => s + lavorate(e), 0);
    return { dal, al: domenica, lavorate: lav, straordinario: Math.max(0, lav - SOGLIA) };
  }
  // domeniche di un mese ("2026-10") o di un anno ("2026")
  function domeniche(periodo) {
    const y = Number(periodo.slice(0, 4)), out = [];
    for (let d = new Date(y, periodo.length === 4 ? 0 : Number(periodo.slice(5)) - 1, 1, 12); d.getFullYear() === y && (periodo.length === 4 || isoD(d).startsWith(periodo)); d.setDate(d.getDate() + 1))
      if (d.getDay() === 0) out.push(isoD(d));
    return out;
  }
  const straordinarioPeriodo = (entries, periodo) => domeniche(periodo).reduce((s, dom) => s + sett(entries, dom).straordinario, 0);

  const COLONNE = ['Data', 'Giorno', 'Turno', 'Ore servizio', 'Ore lavorate', 'Straordinario del giorno (totale: oltre 39 ore settimanali)', 'di cui ritardo', 'di cui cambio',
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
  // agenti: [{id, nome, entries, conversioni: {'2026-10': minuti}, periodo?: '2026' | '2026-10'}]; mesi di competenza (settimane
  // con la domenica nel mese, come la Distinta); con piu' agenti si aggiungono le colonne Agente e Numero.
  function csv(agenti) {
    const multi = agenti.length > 1;
    const out = [linea([...(multi ? ['Agente', 'Numero'] : []), ...COLONNE])];
    agenti.forEach(a => {
      const pre = multi ? [a.nome || '', a.id || ''] : [];
      const giorni = (a.entries || []).filter(e => e?.date).sort((x, y) => x.date.localeCompare(y.date));
      // mese di competenza come nella Distinta: quello della domenica della settimana del giorno
      const competenza = iso => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + (7 - d.getDay()) % 7); return isoD(d).slice(0, 7); };
      const mesi = [...new Set(giorni.map(e => competenza(e.date)))].filter(m => !a.periodo || m.startsWith(a.periodo));
      mesi.forEach(mese => {
        const lista = giorni.filter(e => competenza(e.date) === mese);
        lista.forEach(e => {
          out.push(linea([...pre, ...riga(e)]));
          if (new Date(`${e.date}T12:00:00`).getDay() === 0) {
            const w = sett(giorni, e.date);
            out.push(linea([...pre, `Settimana ${w.dal.slice(8)}/${w.dal.slice(5, 7)}-${w.al.slice(8)}/${w.al.slice(5, 7)}`, '', '', '', ore(w.lavorate), '', '', '', '', '', '', '', '', '', '', '', '', '', '', `straordinario oltre 39 ore: ${ore(w.straordinario) || '0:00'}`]));
          }
        });
        const lav = lista.filter(lavoro), tot = f => lav.reduce((s, e) => s + f(e), 0);
        const [y, m] = mese.split('-').map(Number);
        out.push(linea([...pre, `TOTALE ${MESI[m - 1]} ${y}`, '', `${lav.length} gg`, ore(tot(servizio)), ore(tot(lavorate)),
          ore(straordinarioPeriodo(giorni, mese)), '', '', '', ore(lista.reduce((s, e) => s + (Math.round(Number(e.bank) || 0)), 0)),
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

  // ZIP senza compressione (metodo "store"): due file in uno, apribile su ogni telefono e computer.
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parti = [], centrale = [];
    let offset = 0;
    const d = new Date(), dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(({ name, data }) => {
      const nome = enc.encode(name), dati = typeof data === 'string' ? enc.encode(data) : data, crc = crc32(dati);
      const h = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, dosTime, 2], [12, dosDate, 2], [14, crc, 4], [18, dati.length, 4], [22, dati.length, 4], [26, nome.length, 2], [28, 0, 2]]
        .forEach(([o, v, n]) => (n === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true)));
      const c = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, dosTime, 2], [14, dosDate, 2], [16, crc, 4], [20, dati.length, 4], [24, dati.length, 4], [28, nome.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]]
        .forEach(([o, v, n]) => (n === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true)));
      parti.push(new Uint8Array(h.buffer), nome, dati);
      centrale.push(new Uint8Array(c.buffer), nome);
      offset += 30 + nome.length + dati.length;
    });
    const dimCentrale = centrale.reduce((s, x) => s + x.length, 0);
    const fine = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [8, files.length, 2], [10, files.length, 2], [12, dimCentrale, 4], [16, offset, 4]].forEach(([o, v, n]) => (n === 4 ? fine.setUint32(o, v, true) : fine.setUint16(o, v, true)));
    const tutto = [...parti, ...centrale, new Uint8Array(fine.buffer)], out = new Uint8Array(tutto.reduce((s, x) => s + x.length, 0));
    let i = 0; tutto.forEach(x => { out.set(x, i); i += x.length; });
    return out;
  }
  // legge i file di uno zip senza compressione (come quelli fatti qui): {nome: testo}
  function unzip(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), v = new DataView(b.buffer, b.byteOffset, b.byteLength), dec = new TextDecoder(), out = {};
    let i = 0;
    while (i + 30 <= b.length && v.getUint32(i, true) === 0x04034b50) {
      const metodo = v.getUint16(i + 8, true), size = v.getUint32(i + 18, true), nl = v.getUint16(i + 26, true), xl = v.getUint16(i + 28, true);
      const nome = dec.decode(b.subarray(i + 30, i + 30 + nl)), start = i + 30 + nl + xl;
      if (metodo !== 0) throw new Error('zip compresso: carica il file .json');
      out[nome] = dec.decode(b.subarray(start, start + size));
      i = start + size;
    }
    return out;
  }

  root.NaviDiariaBackup = { COLONNE, riga, csv, oggi, nomeFile, scarica, lavorate, servizio, causali, zip, unzip, sett, domeniche, straordinarioPeriodo, SOGLIA };
})(typeof window !== 'undefined' ? window : globalThis);
