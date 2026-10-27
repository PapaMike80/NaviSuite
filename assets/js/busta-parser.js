// Lettura della busta paga INAZ (G.G.N.L.) dagli item di testo di pdf.js.
// Il PDF resta sul dispositivo: qui arrivano solo testo e coordinate.
// Modulo puro (nessun DOM): parseItems() e' testabile in Node; readPdf() usa
// window.pdfjsLib (vendor/pdfjs/pdf.min.js) solo nel browser.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NaviBustaParser = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  // Colonne su pagina A4 (595 pt), misurate su una busta reale. Le soglie
  // vengono ricalcolate dalle intestazioni quando si trovano.
  const LAYOUT = {
    flagMaxX: 44,
    codeMinX: 44,
    codeMaxX: 76,
    descriptionMinX: 78,
    // xMax (bordo destro) massimo dei numeri di ciascuna colonna.
    quantityMaxX: 308,
    baseMaxX: 392,
    figurativeMaxX: 470,
    amountMaxX: 566,
    // Un numero che finisce prima di questa x fa parte della descrizione.
    numbersMinX: 230,
    rowTolerance: 2.5,
    periodMinY: 600
  };
  const COLUMNS = ['quantity', 'base', 'figurative', 'amount'];
  const CODE_RE = /^[A-Z0-9]{3,5}$/;
  const FLAG_RE = /^[ABC]$/;
  const NUMBER_RE = /^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?-?$/;
  const PERIOD_RE = /^(0[1-9]|1[0-4])\.(?:20)?(\d{2})$/;

  // "1.695,95" -> 1695.95 ; "1021,19-" o "-16,50" -> negativo ; testo non numerico -> null
  function parseAmount(text) {
    const raw = String(text ?? '').trim();
    if (!NUMBER_RE.test(raw)) return null;
    const negative = raw.endsWith('-') || raw.startsWith('-');
    const value = Number(raw.replace(/^-|-$/g, '').replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(value)) return null;
    return negative ? -value : value;
  }

  const round2 = value => Math.round(value * 100) / 100;

  // Un item pdf.js puo' contenere piu' parole: le separa stimando la x di
  // ciascuna in proporzione ai caratteri.
  function splitWords(item) {
    const text = String(item.str ?? '');
    const width = Number(item.width) || 0;
    const x = Number(item.x) || 0;
    const perChar = text.length ? width / text.length : 0;
    const words = [];
    const re = /\S+/g;
    let match;
    while ((match = re.exec(text))) {
      const start = x + match.index * perChar;
      words.push({ text: match[0], x: start, xMax: start + match[0].length * perChar, y: Number(item.y) || 0 });
    }
    return words;
  }

  // Accetta sia item gia' normalizzati {str,x,y,width} sia quelli di pdf.js
  // {str,transform:[a,b,c,d,x,y],width}.
  function normalizeItem(item) {
    if (!item || typeof item.str !== 'string') return null;
    const x = Number.isFinite(Number(item.x)) ? Number(item.x) : Number(item.transform?.[4]);
    const y = Number.isFinite(Number(item.y)) ? Number(item.y) : Number(item.transform?.[5]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { str: item.str, x, y, width: Number(item.width) || 0 };
  }

  // Raggruppa le parole in righe (stessa y entro la tolleranza), dall'alto.
  function groupRows(words, tolerance = LAYOUT.rowTolerance) {
    const sorted = words.slice().sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    sorted.forEach(word => {
      const row = rows.find(candidate => Math.abs(candidate.y - word.y) <= tolerance);
      if (row) { row.words.push(word); row.y = (row.y * (row.words.length - 1) + word.y) / row.words.length; }
      else rows.push({ y: word.y, words: [word] });
    });
    rows.forEach(row => row.words.sort((a, b) => a.x - b.x));
    return rows.sort((a, b) => b.y - a.y);
  }

  const rowText = row => row.words.map(word => word.text).join(' ');

  // Soglie delle colonne dalle intestazioni "Ore/Giorni/Num./%", "Base",
  // "Figurativo", "Competenze"/"Ritenute": il confine fra due colonne e' a
  // meta' fra la fine di un'intestazione e l'inizio della successiva.
  function columnBounds(headerRow) {
    const fallback = {
      quantityMaxX: LAYOUT.quantityMaxX,
      baseMaxX: LAYOUT.baseMaxX,
      figurativeMaxX: LAYOUT.figurativeMaxX,
      amountMaxX: LAYOUT.amountMaxX,
      numbersMinX: LAYOUT.numbersMinX,
      fromHeader: false
    };
    if (!headerRow) return fallback;
    const find = re => headerRow.words.find(word => re.test(word.text));
    const quantity = find(/^(?:Ore|Giorni|Num)/i);
    const base = find(/^Base$/i);
    const figurative = find(/^Figurativ/i);
    const amount = find(/^(?:Competenz|Ritenut)/i);
    const between = (left, right, fallbackValue) => {
      if (!left || !right) return fallbackValue;
      const value = (left.xMax + right.x) / 2;
      // Scarta valori fuori scala (intestazione letta male).
      return Math.abs(value - fallbackValue) <= 40 ? value : fallbackValue;
    };
    return {
      quantityMaxX: between(quantity, base, fallback.quantityMaxX),
      baseMaxX: between(base, figurative, fallback.baseMaxX),
      figurativeMaxX: between(figurative, amount, fallback.figurativeMaxX),
      amountMaxX: fallback.amountMaxX,
      numbersMinX: quantity ? Math.min(quantity.x - 30, fallback.numbersMinX + 40) : fallback.numbersMinX,
      fromHeader: Boolean(quantity || base || figurative || amount)
    };
  }

  function columnFor(xMax, bounds) {
    if (xMax <= bounds.quantityMaxX + 1) return 'quantity';
    if (xMax <= bounds.baseMaxX + 1) return 'base';
    if (xMax <= bounds.figurativeMaxX + 1) return 'figurative';
    return 'amount';
  }

  // Una riga voce: flag opzionale, codice nella sua colonna, descrizione e
  // numeri allineati a destra.
  function parseVoceRow(row, bounds) {
    const words = row.words;
    let index = 0;
    let flag = '';
    if (words[index] && words[index].x < LAYOUT.flagMaxX && FLAG_RE.test(words[index].text) && words[index].xMax <= LAYOUT.codeMinX + 2) {
      flag = words[index].text;
      index += 1;
    }
    const codeWord = words[index];
    if (!codeWord || codeWord.x < LAYOUT.codeMinX - 2 || codeWord.x > LAYOUT.codeMaxX || !CODE_RE.test(codeWord.text)) return null;
    index += 1;
    const description = [];
    const voce = { flag, code: codeWord.text, description: '', quantity: null, base: null, figurative: null, amount: null, y: row.y };
    words.slice(index).forEach(word => {
      const value = parseAmount(word.text);
      if (value !== null && word.xMax > bounds.numbersMinX) {
        const column = columnFor(word.xMax, bounds);
        voce[column] = voce[column] === null ? value : voce[column];
      } else {
        description.push(word.text);
      }
    });
    voce.description = description.join(' ').replace(/\s+/g, ' ').trim();
    return voce;
  }

  const TOTAL_LABELS = [
    // Maiuscole come nel piede della busta: la voce "900 Totale ritenute sociali" non e' il totale.
    { key: 'ritenute', re: /^Totale\s+Ritenute/ },
    { key: 'competenze', re: /^Totale\s+Competenze/ },
    { key: 'netto', re: /^Netto\s+a\s+pagare/i },
    // INAZ: "NETTO" e "A PAGARE" su due righe, l'importo a destra di "A PAGARE"
    { key: 'netto', re: /^A\s+PAGARE\b/ }
  ];

  // Il valore di un totale e' il numero a destra dell'etichetta sulla stessa
  // riga oppure, se l'etichetta fa da intestazione, quello subito sotto.
  function findTotals(rows) {
    const totals = { competenze: null, ritenute: null, netto: null };
    const numbers = [];
    rows.forEach(row => row.words.forEach(word => {
      const value = parseAmount(word.text);
      if (value !== null) numbers.push({ ...word, value, rowY: row.y });
    }));
    rows.forEach(row => {
      const words = row.words;
      for (let start = 0; start < words.length; start += 1) {
        TOTAL_LABELS.forEach(label => {
          if (totals[label.key] !== null) return;
          const text = words.slice(start, start + 3).map(word => word.text).join(' ');
          const match = label.re.exec(text);
          if (!match) return;
          const labelWords = match[0].match(/\S+/g).length;
          const first = words[start];
          const last = words[Math.min(words.length - 1, start + labelWords - 1)];
          const nextLabel = words.slice(start + labelWords).find(word => /^(?:Totale|Netto)$/i.test(word.text));
          const sameRow = numbers.filter(number => Math.abs(number.rowY - row.y) < 0.01 && number.x > last.xMax && (!nextLabel || number.x < nextLabel.x));
          if (sameRow.length) { totals[label.key] = Math.abs(sameRow[0].value); return; }
          const center = (first.x + last.xMax) / 2;
          const below = numbers
            .filter(number => number.rowY < row.y && row.y - number.rowY <= 24)
            .map(number => ({ number, distance: Math.abs((number.x + number.xMax) / 2 - center) + (row.y - number.rowY) }))
            .filter(candidate => candidate.distance <= 90)
            .sort((a, b) => a.distance - b.distance);
          if (below.length) totals[label.key] = Math.abs(below[0].number.value);
        });
      }
    });
    return totals;
  }

  function findPeriod(rows) {
    for (const row of rows) {
      if (row.y <= LAYOUT.periodMinY) continue;
      for (let i = 0; i < row.words.length; i += 1) {
        const word = row.words[i];
        const match = PERIOD_RE.exec(word.text);
        if (match) {
          const month = Number(match[1]);
          const year = 2000 + Number(match[2]);
          const prev = i > 0 ? row.words[i - 1] : null;
          const emissionMonth = prev && /^(0[1-9]|1[0-2])$/.test(prev.text) ? Number(prev.text) : (month === 14 ? 7 : month === 13 ? 12 : month);
          return { month, year, label: word.text, ...(emissionMonth !== month ? { emissionMonth } : {}) };
        }
      }
    }
    return null;
  }

  // Legge i dati dell'intestazione anagrafica/contrattuale (sopra la riga "Voce").
  function findIntestazione(rows, period) {
    const headerIndex = rows.findIndex(isHeaderRow);
    const topRows = headerIndex >= 0 ? rows.slice(0, headerIndex) : rows.filter(r => r.y > 550);
    const out = {};
    const allWords = topRows.flatMap(r => r.words);

    for (const row of topRows) {
      const text = rowText(row).trim();
      if (!out.azienda && /\bGEST\.?\s*GOV\.?\s*NAVIG|\bNAVIGAZIONE\s+LAGHI\b/i.test(text)) {
        const m = /^(\d+\s+.+?)(?:\s+(?:Cod\.?\s*Fiscale|\d{10,11}|\d{7,9}-\d{2})\b|$)/i.exec(text);
        out.azienda = (m ? m[1] : text).trim();
      }
      const mDip = /^(\d{3,6})\s+(?:\1\s+)?([A-ZÀ-Ú][A-ZÀ-Ú'\s]+)$/.exec(text);
      if (!out.cognomeNome && mDip && !/GEST|INAIL|INPS|ELEMENTI|MINIMO/i.test(mDip[2])) {
        out.codice = mDip[1];
        out.cognomeNome = mDip[2].replace(/\s+/g, ' ').trim();
      }
      if (!out.qualifica && /\b(?:Autoferrotranvieri|tempo\s+(?:determinato|indeterminato)|MARINAIO|TIMONIERE|MOTORISTA|CAPITANO|BIGLIETTAIO)\b/i.test(text)) {
        const scad = /(\d{2}-\d{2}-\d{4})\s*$/.exec(text);
        if (scad) out.dataScadenzaContratto = scad[1];
        const rapp = /(tempo\s+(?:determinato|indeterminato)|apprendistato)/i.exec(text);
        if (rapp) out.tipoRapporto = rapp[1].toLowerCase();
        const livContr = /\b(\d{3}[A-Z]?)\s*(\d{3}\s+Autoferrotranvieri(?:\s*AF)?)/i.exec(text);
        if (livContr) {
          out.livello = livContr[1];
          out.contratto = livContr[2].replace(/\s+/g, ' ').trim();
          const before = text.slice(0, livContr.index).trim();
          if (before) out.qualifica = before;
        }
      }
      if (!out.filiale && /Filiale\s*:/i.test(text)) {
        const mFil = /^(.*?)\s*Filiale\s*:\s*(.+)$/i.exec(text);
        if (mFil) {
          const rep = mFil[1].replace(/^Sede\s+Lavoro\s*/i, '').trim();
          if (rep) out.reparto = rep;
          out.filiale = mFil[2].trim();
        }
      }
      const dates = row.words.filter(w => /^\d{2}-\d{2}-\d{4}$/.test(w.text));
      if (dates.length >= 2 && !out.dataNascita) {
        dates.forEach(w => {
          if (w.x < 95 && !out.dataNascita) out.dataNascita = w.text;
          else if (w.x >= 95 && w.x < 175 && !out.dataAssunzione) out.dataAssunzione = w.text;
          else if (w.x >= 175 && w.x < 255 && !out.dataAnzianita) out.dataAnzianita = w.text;
          else if (w.x >= 255 && w.x < 330 && !out.dataCessazione) out.dataCessazione = w.text;
          else if (w.x >= 350 && w.x < 450 && !out.dataProssimoScatto) out.dataProssimoScatto = w.text;
        });
        const anz = row.words.find(w => /^\d{2}\/\d{2}$/.test(w.text));
        if (anz) out.anzianitaServizio = anz.text;
        const par = row.words.find(w => w.x >= 470 && /^\d{3}[A-Z]?$/.test(w.text));
        if (par) out.parametro = par.text;
      }
    }

    for (const w of allWords) {
      if (!out.codiceFiscale && /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(w.text)) out.codiceFiscale = w.text;
      if (!out.cfAzienda && w.x > 340 && /^\d{11}$/.test(w.text)) out.cfAzienda = w.text;
      if (!out.posInps && w.x > 340 && /^\d{10}$/.test(w.text)) out.posInps = w.text;
      if (!out.posInail && w.x > 340 && /^\d{7,9}-\d{2}$/.test(w.text)) out.posInail = w.text;
      if (!out.sedeInail && w.x > 460 && /^\d{5}$/.test(w.text)) out.sedeInail = w.text;
    }

    if (period?.month && period?.year) {
      const mm = String(period.month).padStart(2, '0');
      const em = String(period.emissionMonth || (period.month === 14 ? 7 : period.month === 13 ? 12 : period.month)).padStart(2, '0');
      out.meseCompetenza = `${em}  ${mm}.${period.year}`;
    }
    return Object.keys(out).length ? out : null;
  }

  // Legge il riquadro "Ferie e Permessi" in calce alla busta INAZ:
  // Ferie (giorni), Ex Fest. (ore) e Banca Ore (ore), ciascuno con Residuo A.P., Maturato Annuo, Goduti Annuo, Residue.
  function findFeriePermessi(rows) {
    const out = {};
    const parseRow = row => {
      const entry = { residuoAP: null, maturato: null, goduti: null, residue: null };
      row.words.forEach(w => {
        if (w.x < 95 || w.x > 340) return;
        const val = parseAmount(w.text);
        if (val === null) return;
        if (w.x < 150) entry.residuoAP = val;
        else if (w.x < 203) entry.maturato = val;
        else if (w.x < 252) entry.goduti = val;
        else entry.residue = val;
      });
      return Object.values(entry).some(v => v !== null) ? entry : null;
    };
    for (const row of rows || []) {
      if (row.y > 370 || row.y < 290) continue;
      const leftText = row.words.filter(w => w.x < 95).map(w => w.text).join(' ').trim();
      if (/\bFerie\b/i.test(leftText) && !/Permessi/i.test(leftText)) {
        const parsed = parseRow(row);
        if (parsed) out.ferie = { ...parsed, unit: 'gg' };
      } else if (/\bEx\s*Fest/i.test(leftText)) {
        const parsed = parseRow(row);
        if (parsed) out.exFest = { ...parsed, unit: 'ore' };
      } else if (/\bBanca\s*Ore\b/i.test(leftText)) {
        const parsed = parseRow(row);
        if (parsed) out.bancaOre = { ...parsed, unit: 'ore' };
      }
    }
    return Object.keys(out).length ? out : null;
  }

  // Legge il riquadro TFR in calce a destra ("Ente/tes.", progressivo annuo e "F.DO TFR AP")
  // e l'eventuale liquidazione TFR (voci 050, H51, H53, H54, H56, H69, I52).
  function findTfr(rows, voci = []) {
    const out = {};
    for (const row of rows || []) {
      if (row.y > 280 || row.y < 185) continue;
      for (const w of row.words) {
        if (w.x < 355 || w.x > 445) continue;
        const val = parseAmount(w.text);
        if (val === null || val <= 0) continue;
        if (row.y >= 255 && row.y <= 274 && out.mese === undefined) out.mese = val;
        else if (row.y >= 220 && row.y <= 242 && out.progressivo === undefined) out.progressivo = val;
        else if (row.y >= 188 && row.y <= 205 && out.fondoAP === undefined) out.fondoAP = val;
      }
    }
    const v050 = (voci || []).find(v => v.code === '050' || /\bTFR\s+liq/i.test(v.description || ''));
    if (v050 && v050.amount) {
      out.liquidato = v050.amount;
      const h56 = voci.find(v => v.code === 'H56');
      const i52 = voci.find(v => v.code === 'I52');
      if (h56?.amount) out.ritenutaIrpef = Math.abs(h56.amount);
      if (i52?.quantity) out.aliquota = i52.quantity;
    }
    return Object.keys(out).length ? out : null;
  }

  const isHeaderRow = row => row.words.some(word => /^Voce$/i.test(word.text));
  const isEndRow = row => /\*\*\*\s*SEGUE|Netto\s+a\s+pagare/i.test(rowText(row)) || /Totale\s+(?:Competenze|Ritenute)/.test(rowText(row));

  // pages: [{items:[...]}] (item pdf.js o normalizzati). Restituisce
  // {period, voci, totals, check}.
  function parseItems(pages) {
    const voci = [];
    const allRows = [];
    let period = null;
    let intestazione = null;
    let headerFound = false;
    (pages || []).forEach((page, pageIndex) => {
      const words = (page.items || []).map(normalizeItem).filter(Boolean).flatMap(splitWords);
      const rows = groupRows(words);
      allRows.push(...rows);
      if (!period) period = findPeriod(rows);
      if (!intestazione) intestazione = findIntestazione(rows, period);
      const headerIndex = rows.findIndex(isHeaderRow);
      if (headerIndex < 0) return;
      headerFound = true;
      const bounds = columnBounds(rows[headerIndex]);
      for (let index = headerIndex + 1; index < rows.length; index += 1) {
        const row = rows[index];
        if (isEndRow(row)) break;
        const voce = parseVoceRow(row, bounds);
        if (voce) voci.push({ ...voce, page: pageIndex + 1 });
      }
    });
    const totals = findTotals(allRows);
    const feriePermessi = findFeriePermessi(allRows);
    const tfr = findTfr(allRows, voci);
    const isTfrOnly = Boolean(tfr?.liquidato && !voci.some(v => ['49X', '43X', 'FD0', '334', '01Y'].includes(v.code)));
    if (isTfrOnly && period) period.isTfr = true;
    if (feriePermessi && intestazione) intestazione.feriePermessi = feriePermessi;
    if (tfr && intestazione) intestazione.tfr = tfr;
    const sumCompetenze = round2(voci.reduce((sum, voce) => sum + (voce.amount > 0 ? voce.amount : 0), 0));
    const sumRitenute = round2(voci.reduce((sum, voce) => sum + (voce.amount < 0 ? -voce.amount : 0), 0));
    const totalsFound = totals.competenze !== null && totals.ritenute !== null;
    const competenzeOk = totals.competenze !== null && Math.round(sumCompetenze * 100) === Math.round(totals.competenze * 100);
    const ritenuteOk = totals.ritenute !== null && Math.round(sumRitenute * 100) === Math.round(totals.ritenute * 100);
    const check = {
      headerFound,
      totalsFound,
      sumCompetenze,
      sumRitenute,
      competenzeOk,
      ritenuteOk,
      completa: headerFound && totalsFound && competenzeOk && ritenuteOk,
      message: ''
    };
    if (!headerFound) check.message = 'Non trovo la tabella delle voci: il file non sembra una busta paga INAZ.';
    else if (!totalsFound) check.message = 'Non trovo i totali stampati (Totale Competenze / Totale Ritenute): non posso verificare che tutte le righe siano state lette.';
    else if (!check.completa) check.message = 'Le somme delle voci lette non coincidono con i totali stampati: qualche riga potrebbe non essere stata letta.';
    return { period, intestazione, feriePermessi, tfr, voci, totals, check };
  }

  // "09.26" o {month:9,year:2026} -> "2026-08" (i dati variabili della busta
  // si riferiscono al mese precedente).
  function previousMonth(period) {
    if (period && typeof period === 'object' && period.isTfr) return '';
    let month;
    let year;
    if (typeof period === 'string') {
      const match = PERIOD_RE.exec(period.trim()) || /^(\d{4})-(\d{2})$/.exec(period.trim());
      if (!match) return '';
      if (match[0].includes('-')) { year = Number(match[1]); month = Number(match[2]); }
      else { month = Number(match[1]); year = 2000 + Number(match[2]); }
    } else if (period && period.month && period.year) {
      month = Number(period.month);
      year = Number(period.year);
    } else return '';
    if (!Number.isFinite(month) || month > 12) return '';
    month -= 1;
    if (month < 1) { month = 12; year -= 1; }
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  // Solo browser: legge il File/ArrayBuffer con pdf.js e restituisce le pagine.
  async function readPdf(data, pdfjs = typeof window !== 'undefined' ? window.pdfjsLib : null) {
    if (!pdfjs?.getDocument) throw new Error('Lettore PDF non disponibile.');
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
    const buffer = data instanceof ArrayBuffer ? data : await data.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      pages.push({ items: content.items.filter(item => typeof item.str === 'string') });
    }
    try { await pdf.destroy(); } catch (_) {}
    return pages;
  }

  async function parsePdf(data, pdfjs) {
    return parseItems(await readPdf(data, pdfjs));
  }

  return { LAYOUT, COLUMNS, parseAmount, splitWords, groupRows, columnBounds, parseVoceRow, findTotals, findPeriod, findIntestazione, findFeriePermessi, findTfr, parseItems, previousMonth, readPdf, parsePdf };
});
