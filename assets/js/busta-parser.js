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
  const NUMBER_RE = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?-?$/;
  const PERIOD_RE = /^(0[1-9]|1[0-2])\.(\d{2})$/;

  // "1.695,95" -> 1695.95 ; "1021,19-" -> -1021.19 ; testo non numerico -> null
  function parseAmount(text) {
    const raw = String(text ?? '').trim();
    if (!NUMBER_RE.test(raw)) return null;
    const negative = raw.endsWith('-');
    const value = Number(raw.replace(/-$/, '').replace(/\./g, '').replace(',', '.'));
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
    { key: 'ritenute', re: /^Totale\s+Ritenute/i },
    { key: 'competenze', re: /^Totale\s+Competenze/i },
    { key: 'netto', re: /^Netto\s+a\s+pagare/i }
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
      for (const word of row.words) {
        const match = PERIOD_RE.exec(word.text);
        if (match) return { month: Number(match[1]), year: 2000 + Number(match[2]), label: word.text };
      }
    }
    return null;
  }

  const isHeaderRow = row => row.words.some(word => /^Voce$/i.test(word.text));
  const isEndRow = row => /\*\*\*\s*SEGUE|Totale\s+(?:Competenze|Ritenute)|Netto\s+a\s+pagare/i.test(rowText(row));

  // pages: [{items:[...]}] (item pdf.js o normalizzati). Restituisce
  // {period, voci, totals, check}.
  function parseItems(pages) {
    const voci = [];
    const allRows = [];
    let period = null;
    let headerFound = false;
    (pages || []).forEach((page, pageIndex) => {
      const words = (page.items || []).map(normalizeItem).filter(Boolean).flatMap(splitWords);
      const rows = groupRows(words);
      allRows.push(...rows);
      if (!period) period = findPeriod(rows);
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
    return { period, voci, totals, check };
  }

  // "09.26" o {month:9,year:2026} -> "2026-08" (i dati variabili della busta
  // si riferiscono al mese precedente).
  function previousMonth(period) {
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

  return { LAYOUT, COLUMNS, parseAmount, splitWords, groupRows, columnBounds, parseVoceRow, findTotals, findPeriod, parseItems, previousMonth, readPdf, parsePdf };
});
