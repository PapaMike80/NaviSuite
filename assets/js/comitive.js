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

  // Turno che fa ogni corsa della comitiva quel giorno (orario della stagione, orari-stagioni.js): [{numero, turno}]
  const cacheCorse = {};
  function turniCorse(c) {
    const S = root.NaviOrariStagioni;
    let corse = cacheCorse[c.data];
    if (!corse) { try { corse = cacheCorse[c.data] = S?.corseTutte ? S.corseTutte(c.data) : []; } catch (_) { corse = []; } }
    return numeri(c.corse).map(n => ({ numero: n, turno: corse.find(x => x.numero === n)?.turno || '' }));
  }
  // Comitive di una corsa in un giorno (la corsa la fa un solo turno: chi la fa le vede)
  // tratta: da dove a dove con quella corsa (i-esima corsa = i-esimo tratto del percorso).
  function diCorsa(lista, giorno, numero, turno = '') {
    return lista.filter(c => c.data === giorno && numeri(c.corse).includes(String(numero))).map(c => {
      const scali = String(c.percorso).split('+')[0].split('-').map(s => s.trim()).filter(Boolean), i = numeri(c.corse).indexOf(String(numero));
      return { ...c, sale: scali[i] || '', scende: scali[i + 1] || '' };
    });
  }

  // Comitive dall'allegato «Comitive O.d.S.» di un PDF (pagine di elementi pdf.js {text,x,y,width}).
  // Le colonne si ricavano dall'intestazione (percorso, cliente, città, naz., n. pax, pagamento, pranzo, corse);
  // cliente e città stanno nella stessa fascia: la città e' il blocco staccato a destra.
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  function daPdf(pages, ods = '') {
    const out = [];
    let data = '';
    (pages || []).forEach(items => {
      const h = nome => items.find(i => i.text.trim().toLowerCase() === nome);
      const [hPerc, hCli, hNaz, hPag, hPra, hCor] = ['percorso', 'cliente', 'naz.', 'pagamento', 'pranzo', 'corse'].map(h);
      const hPax = h('n. pax') || h('n.');
      if (!hPerc || !hCli || !hPag || !hCor) return;
      const sotto = items.filter(i => i.y < hPerc.y - 2);
      const righe = [];
      sotto.slice().sort((a, b) => b.y - a.y || a.x - b.x).forEach(i => { const r = righe.find(r => Math.abs(r.y - i.y) < 2.5); if (r) r.items.push(i); else righe.push({ y: i.y, items: [i] }); });
      const xNaz = (hNaz?.x ?? hPax?.x - 30) - 8, xPax = (hPax?.x ?? hPag.x - 40) - 8, xPag = hPag.x - 6, xPra = (hPra?.x ?? hCor.x - 40) - 2, xCor = hPra ? hPra.x + (hPra.width || 26) + 2 : hCor.x - 15, xCli = hCli.x - 12;
      for (const r of righe) {
        const its = r.items.sort((a, b) => a.x - b.x), testo = its.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
        const g = /^\S+\s+(\d{1,2})\s+(\S+)\s+(\d{4})$/.exec(testo);
        if (g && MESI.includes(g[2].toLowerCase())) { data = `${g[3]}-${String(MESI.indexOf(g[2].toLowerCase()) + 1).padStart(2, '0')}-${g[1].padStart(2, '0')}`; continue; }
        if (/^TURNO NAVI/i.test(testo)) break;
        const col = (da, a) => its.filter(i => i.x >= da && i.x < a);
        const unisci = list => list.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
        const pagamento = unisci(col(xPag, xPra)), corse = unisci(col(xCor, 1e9)), pax = unisci(col(xPax, xPag));
        if (!data || !/voucher|diretto/i.test(pagamento) || !corse || !pax) continue;
        let percorso = unisci(col(-1e9, xCli));
        // fascia cliente + città: blocchi separati da uno spazio largo
        const fascia = col(xCli, xNaz), blocchi = [];
        fascia.forEach(i => { const b = blocchi[blocchi.length - 1]; if (b && i.x - b.fine < 8) { b.items.push(i); b.fine = i.x + (i.width || i.text.length * 4); } else blocchi.push({ items: [i], fine: i.x + (i.width || i.text.length * 4) }); });
        let cliente = blocchi.length ? unisci(blocchi[0].items) : '', citta = blocchi.slice(1).map(b => unisci(b.items)).join(' ');
        // percorso attaccato al cliente (es. «Desenzano-Sirmione-DesenzanoAg. Easylake»)
        const attaccato = /^(.*?)((?:Ag|Gr)\.\s.*)$/.exec(percorso);
        if (attaccato && attaccato[1]) { percorso = attaccato[1].trim(); cliente = `${attaccato[2]} ${cliente}`.trim(); }
        const naz = unisci(col(xNaz, xPax));
        out.push({ data, percorso, cliente, citta: /^[-=]+$/.test(citta) ? '' : citta, naz: /^[-=]+$/.test(naz) ? '' : naz, pax, pagamento, corse, ods });
      }
    });
    return out;
  }
  // Salva su PocketBase le comitive di un O.d.S. (aggiorna quelle gia' presenti, tiene il turno assegnato)
  async function salvaOds(lista, autore = '') {
    const esistenti = new Map((await PB().list('comitive', { filter: `fonte = "ods"`, perPage: 1000 })).map(r => [r.chiave, r]));
    let nuove = 0, aggiornate = 0;
    for (const c of lista) {
      const k = chiave(c), r = esistenti.get(k);
      if (r) { await PB().patch('comitive', r.id, { ...campi({ ...c, fonte: 'ods', turno: r.turno }), chiave: k }); aggiornate++; }
      else { await PB().create('comitive', { ...campi({ ...c, fonte: 'ods' }), inserito_da: autore }); nuove++; }
    }
    return { nuove, aggiornate };
  }

  // Allo scalo: comitive che salgono con la corsa in partenza e che scendono da quella in arrivo
  // stesso scalo: nome intero, o abbreviazione con il punto dell'O.d.S. («Pesc.», «Sirm.»)
  const pulito = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z.]/g, '');
  const stessoScalo = (scalo, nome) => { const a = pulito(scalo).replace(/\./g, ''), b = pulito(nome); return !!b && (b.endsWith('.') ? a.startsWith(b.slice(0, -1)) : a === b.replace(/\./g, '')); };
  function alloScalo(lista, giorno, scalo, corsaParte, corsaArriva, turno = '') {
    const salgono = [], scendono = [];
    lista.filter(c => c.data === giorno).forEach(c => {
      const scali = String(c.percorso).split('+')[0].split('-').map(s => s.trim()).filter(Boolean);
      numeri(c.corse).forEach((n, i) => {
        if (corsaParte && n === String(corsaParte) && stessoScalo(scalo, scali[i])) salgono.push({ ...c, verso: scali[i + 1] || '' });
        if (corsaArriva && n === String(corsaArriva) && stessoScalo(scalo, scali[i + 1])) scendono.push({ ...c, da: scali[i] || '' });
      });
    });
    return { salgono, scendono };
  }

  root.NaviComitive = { chiave, numeri, carica, copiaOds, salva, togli, diCorsa, daPdf, salvaOds, alloScalo, turniCorse, stessoScalo };
})(typeof window !== 'undefined' ? window : globalThis);
