// Comitive: archivio su PocketBase (collection «comitive», pocketbase/comitive.json), con ripiego sulle comitive
// dell'O.d.S. (comitive-ods.js) se PocketBase non risponde. Usato dalla pagina Comitive e da Il mio turno.
(function (root) {
  const PB = () => root.NaviAdminPB;
  const ODS = () => root.NaviComitiveOds || { ods: '', comitive: [] };
  // chiave stabile di una comitiva dell'O.d.S. (le nuove hanno la propria)
  const chiave = c => String(c.chiave || `${c.data}|${c.percorso}|${c.cliente}|${c.corse}`);
  const numeri = corse => String(corse || '').split(/[-\/+ ]+/).map(n => n.trim()).filter(Boolean);
  const daRecord = r => ({ id: r.id, chiave: r.chiave, data: r.data, percorso: r.percorso, cliente: r.cliente, citta: r.citta || '', naz: r.naz || '', pax: r.pax, pagamento: r.pagamento || '', corse: r.corse, turno: r.turno || '', fonte: r.fonte || '', ods: r.ods || '' });

  // Tutte le comitive (dal giorno «da», se indicato): PocketBase + O.d.S. non ancora copiate. {lista, pb: true|false}
  async function carica({ da = '' } = {}) {
    const ods = ODS().comitive.filter(c => !da || c.data >= da).map(c => ({ ...c, chiave: chiave(c), fonte: 'ods', ods: ODS().ods, turno: '' }));
    try {
      const filter = da ? `data >= "${da}"` : '';
      const records = await PB().list('comitive', { filter, perPage: 500, sort: 'data' });
      const pb = records.map(daRecord), viste = new Set(pb.map(c => c.chiave));
      return { lista: [...pb, ...ods.filter(c => !viste.has(c.chiave))], pb: true };
    } catch (error) {
      console.warn('Comitive: PocketBase non raggiungibile', error);
      return { lista: ods, pb: false };
    }
  }
  // Copia su PocketBase le comitive dell'O.d.S. che mancano
  async function copiaOds(lista, autore = '') {
    let copiate = 0;
    for (const c of lista.filter(x => !x.id && x.fonte === 'ods')) {
      try { const r = await PB().create('comitive', { ...campi(c), inserito_da: autore }); c.id = r.id; copiate++; } catch (error) { if (error?.status !== 400) throw error; }
    }
    return copiate;
  }
  const campi = c => ({ chiave: chiave(c), data: c.data, percorso: c.percorso, cliente: c.cliente, citta: c.citta || '', naz: c.naz || '', pax: String(c.pax), pagamento: c.pagamento || '', corse: c.corse, turno: c.turno || '', fonte: c.fonte || 'manuale', ods: c.ods || '' });
  async function salva(c, autore = '') {
    if (c.id) return daRecord(await PB().patch('comitive', c.id, campi(c)));
    const nuova = { ...c, chiave: c.chiave || `m${Date.now().toString(36)}`, fonte: c.fonte || 'manuale' };
    return daRecord(await PB().create('comitive', { ...campi(nuova), inserito_da: autore }));
  }
  const togli = id => PB().remove('comitive', id);

  // Comitive di una corsa in un giorno: per il turno assegnato, o per qualunque turno se non e' assegnato.
  // tratta: da dove a dove con quella corsa (i-esima corsa = i-esimo tratto del percorso).
  function diCorsa(lista, giorno, numero, turno = '') {
    return lista.filter(c => c.data === giorno && numeri(c.corse).includes(String(numero)) && (!c.turno || !turno || c.turno === turno)).map(c => {
      const scali = String(c.percorso).split('+')[0].split('-').map(s => s.trim()).filter(Boolean), i = numeri(c.corse).indexOf(String(numero));
      return { ...c, sale: scali[i] || '', scende: scali[i + 1] || '' };
    });
  }

  root.NaviComitive = { chiave, numeri, carica, copiaOds, salva, togli, diCorsa };
})(typeof window !== 'undefined' ? window : globalThis);
