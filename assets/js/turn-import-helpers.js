(function (root) {
  const RESIDENCES = ['RIVA', 'MADERNO', 'DESENZANO', 'PESCHIERA'];
  const clean = value => String(value || '').replace(/[Ɓɓ]/g, 'B').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const norm = value => clean(value).replace(/[^A-Z0-9]/g, '');

  // "MESSINA Gni." -> cognome MESSINA, iniziali G,I,N (ordinate: il PDF puo'
  // invertirle rispetto all'anagrafica, es. "MORETTO C.A." / "MORETTO A.C.").
  function splitName(name) {
    const match = String(name || '').trim().match(/^(.*?)\s+((?:[A-Za-z]{1,3}\.)+)\s*$/);
    if (!match) return { surname: norm(name), initials: '' };
    return { surname: norm(match[1]), initials: clean(match[2]).replace(/[^A-Z]/g, '').split('').sort().join('') };
  }

  function sameAgent(a, b) {
    if (norm(a) && norm(a) === norm(b)) return true;
    const x = splitName(a), y = splitName(b);
    return !!x.initials && x.surname === y.surname && x.initials === y.initials;
  }

  // Riga con intestazione dei giorni: "Residenza di RIVA" / "MADERNO".
  function sectionResidence(prefix) {
    const text = clean(prefix).replace(/RESIDENZA\s+DI/g, '').replace(/COMPETENZE/g, '').replace(/\s+/g, ' ').trim();
    return RESIDENCES.includes(text) ? text : '';
  }

  // "23 OMEZZOLLI O." -> { number: 23, name: 'OMEZZOLLI O.' }
  function parseRowPrefix(prefix) {
    const text = String(prefix || '').replace(/[Ɓɓ]/g, 'B').replace(/\s+/g, ' ').trim();
    const match = text.match(/^(\d{1,3})\s+(.+?)\s+((?:[A-Za-z]{1,3}\.)+)$/);
    if (!match || match[2].replace(/[^A-Za-zÀ-ÖØ-ý]/g, '').length < 3) return null;
    return { number: Number(match[1]), name: `${match[2].trim()} ${match[3]}` };
  }

  const isTransferMarker = value => /^A\s+[A-Z]{3,}$/i.test(String(value || '').trim());

  // Un agente in trasferta compare in due residenze (es. Riva e Maderno): nella
  // riga di casa i giorni fuori sede sono "A MADERNO", nell'altra "A RIVA".
  // Si tiene, giorno per giorno, il valore reale; RIP solo se nessuna riga ha altro.
  function mergeCells(cellsList) {
    const length = Math.max(0, ...cellsList.map(cells => cells.length));
    return Array.from({ length }, (_, index) => {
      const values = cellsList.map(cells => cells[index]).filter(value => value && !isTransferMarker(value));
      return values.find(value => value !== 'RIP') || 'RIP';
    });
  }

  // Confronta la residenza del PDF con quella che l'agente aveva PRIMA di questo
  // periodo. Se l'agente e' gia' stato spostato da un import che decorre dalla
  // stessa data (o piu' avanti) si parte dalla residenza precedente, cosi' anche
  // il turno "ufficiale" successivo alla bozza porta con se' lo spostamento.
  function planResidenceMove(agent, pdfResidence, start) {
    const wanted = String(pdfResidence || '').toUpperCase();
    if (!wanted || agent?.nuovo) return null;
    const current = String(agent?.residence || '').toUpperCase();
    const movedAlready = agent?.residenzaDal && String(agent.residenzaDal) >= String(start || '') && agent.residenzaPrecedente;
    const before = movedAlready ? String(agent.residenzaPrecedente).toUpperCase() : current;
    if (!before || before === wanted) return null;
    return { residenzaNuova: wanted, residenzaPrecedente: before, residenzaDal: start, sposta: true };
  }

  const api = { RESIDENCES, splitName, sameAgent, sectionResidence, parseRowPrefix, isTransferMarker, mergeCells, planResidenceMove };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NaviTurnImport = api;
})(typeof window !== 'undefined' ? window : globalThis);
