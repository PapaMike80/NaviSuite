// Notifiche degli arrivi per chi lavora a terra: il pontilista deve essere sul pontile 10 minuti
// prima dell'arrivo della nave. Per la giornata a terra dell'agente (AgB, PonD, AgM, AgT...) elenca
// le navi in arrivo nelle ore del suo servizio, con nave, pontile (scelto in Servizi a terra o
// dall'O.d.S.) e comandante, e l'ora a cui avvisare.
// Lo usano l'app aperta (arrivi-avvisi.js) e il push-worker su TrueNAS, che scarica questo file e
// quelli da cui dipende da GitHub Pages: servizi-terra-a4.js, turni-giorno.js, course-info.js,
// orario-corse.js e orario-giorno.js (in Node con globalThis.window = globalThis).
// Modulo puro: niente DOM.
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NaviPushArrivi = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const ANTICIPO = 10;
  const minutes = t => { const [h, m] = String(t).replace(':', '.').split('.').map(Number); return h * 60 + m; };
  const hhmm = n => `${Math.floor(n / 60)}.${String(n % 60).padStart(2, '0')}`;
  const T = () => root.NaviServiziTerra;
  const G = () => root.NaviTurniGiorno;
  const inServizio = (code, day) => root.NaviOrarioGiorno?.inServizio ? root.NaviOrarioGiorno.inServizio(code, day) : true;

  // Arrivi che riguardano un servizio a terra nel giorno: [{time, code, run, where, kind, evening}].
  // Desenzano (AgB, PonD, DT): gli arrivi delle navi di linea. Maderno: AgT gli arrivi del traghetto
  // da Torri, AgM (e PonM) arrivi e scali delle navi di linea. Solo nelle ore del servizio, se note.
  function arriviDelServizio(servizio, day) {
    const D = T().DATA;
    const residenza = G().terraResidenza(servizio);
    let rows = [];
    if (residenza === 'DESENZANO') rows = D.NAVI.DESENZANO.filter(row => row[1] === 'A');
    else if (/^AgT/.test(servizio)) rows = D.TRAGHETTO.filter(row => row[1] === 'A').map(([time, kind, code, run]) => [time, kind, code, run, 'da Torri']);
    else if (residenza === 'MADERNO') rows = D.NAVI.MADERNO.filter(row => row[1] === 'A' || row[1] === 'S');
    const orari = (D.SERVIZI[residenza] || []).find(([code]) => code === servizio);
    const fasce = orari ? [orari[1], orari[2]].map(fascia => fascia.split(' – ').map(minutes)) : null;
    // ultimo movimento di ogni nave nello scalo: l'arrivo della sera (ormeggio serale)
    const tutte = residenza === 'MADERNO' ? [...D.NAVI.MADERNO, ...D.TRAGHETTO] : D.NAVI.DESENZANO;
    const ultimo = {};
    tutte.forEach(([time, , code]) => { if (!ultimo[code] || minutes(time) > minutes(ultimo[code])) ultimo[code] = time; });
    return rows
      .filter(([time, , code]) => inServizio(code, day) && (!fasce || fasce.some(([a, b]) => minutes(time) >= a && minutes(time) <= b)))
      .map(([time, kind, code, run, where]) => ({
        time, code, run, kind, residenza,
        where: String(where || '').replace(/\s*\*$/, ''),
        evening: kind === 'A' && ultimo[code] === time
      }))
      .sort((a, b) => minutes(a.time) - minutes(b.time));
  }

  // Notifiche della giornata per l'agente: [{at (minuti), quando, time, code, run, title, body, tag, url}].
  // data: turni condivisi con le variazioni (come NaviSharedData o push-summary effectiveData);
  // options.pontili: pontiliCorse di Desenzano {chiaveCorsa: {data: valore}}; options.anticipo.
  function notifiche(data, agentId, day, options = {}) {
    const turno = G().turnoAgente(data, { id: agentId, name: options.agentName || '' }, day);
    const servizio = G().terraCode(turno?.turno);
    if (!servizio) return [];
    const anticipo = Number(options.anticipo) || ANTICIPO;
    const navi = T().turniDelGiorno(data?.turni_navi || [], day);
    const crews = G().equipaggi(data, day).navi;
    const pontili = options.pontili || {};
    // BIS dall'Ufficio Movimento: corse in aiuto (arrivi in piu') e corse al posto di un'altra nave
    const OG = root.NaviOrarioGiorno;
    const incarichi = navi.BIS?.incarichi || [];
    const arrivi = arriviDelServizio(servizio, day);
    const aiuti = OG?.corseIncarico ? incarichi.filter(inc => inc.tipo === 'aiuto').flatMap(inc => {
      const numeri = new Set(OG.corseIncarico(inc, day).map(c => c.numero));
      return arrivi.filter(a => a.code === inc.turno && numeri.has(String(a.run)))
        .map(a => ({ ...a, code: 'BIS', per: inc.turno, where: `${a.where} · in aiuto alla ${inc.turno}`, evening: false }));
    }) : [];
    // Ritardi del Movimento (anche quelli passati alle corse dopo): l'avviso si sposta con l'arrivo
    const ritardi = OG?.ritardiDelGiorno ? OG.ritardiDelGiorno(navi) : {};
    const effettive = {};
    const ritardoCorsa = (turno, run) => {
      if (!run || !ritardi[turno]) return null;
      effettive[turno] = effettive[turno] || OG.corseDelTurno(turno, day, ritardi[turno]);
      return effettive[turno].find(c => c.numero === String(run))?.ritardo || null;
    };
    // le corse sospese dall'Ufficio Movimento non arrivano
    return [...arrivi, ...aiuti].filter(arrivo => !navi[arrivo.code]?.sospesa && !((navi[arrivo.per || arrivo.code]?.corseSospeseRaw || []).some(x => x.corsa === String(arrivo.run) && (!x.da || minutes(arrivo.time) >= minutes(x.da))))).map(arrivo => {
      const ritardo = ritardoCorsa(arrivo.per || arrivo.code, arrivo.run);
      return { ...arrivo, scheduled: arrivo.time, ritardo, time: ritardo ? hhmm(minutes(arrivo.time) + ritardo.minuti) : arrivo.time };
    }).sort((a, b) => minutes(a.time) - minutes(b.time)).map(arrivo => {
      const { time, scheduled, ritardo, code, run, kind, where, evening, residenza } = arrivo;
      const chi = code !== 'BIS' && run && OG?.bisPerCorsa?.(incarichi, code, run, day) ? 'BIS' : code;
      const odsMooring = evening ? navi[code]?.ormeggio : '';
      const pontile = residenza === 'DESENZANO'
        ? T().pontileFor(pontili[T().courseKey(scheduled, code, run)], day, odsMooring).value
        : T().pontLabel(odsMooring || '');
      const nave = navi[chi]?.nave || '';
      const comandante = G().comandante(crews[chi]);
      const percorso = kind === 'S' ? `scalo ${where.replace('›', '→')}` : where;
      const title = `${code}${chi !== code ? ' · BIS' : ''}${nave ? ` ${nave}` : ''} ${kind === 'S' ? 'fa scalo' : 'arriva'} alle ${time}${ritardo ? ` (${OG.testoRitardo(ritardo)})` : ''}`;
      const body = [[pontile ? `⚓ Pontile ${pontile}` : '', percorso, run ? `corsa ${run}` : ''].filter(Boolean).join(' · '),
        comandante ? `Comandante ${comandante}` : ''].filter(Boolean).join('\n');
      const at = minutes(time) - anticipo;
      return {
        at, quando: hhmm(at), time, code, run, servizio, pontile, nave, comandante, title, body,
        // con un ritardo nuovo arriva un nuovo avviso
        tag: `navisuite-arrivo-${day}-${code}-${run || scheduled}${ritardo ? `-r${ritardo.minuti}` : ''}`, url: `orario.html?scalo=${residenza === 'MADERNO' ? 'Maderno' : 'Desenzano'}`, ritardo
      };
    });
  }

  // Notifiche da mandare adesso: l'ora di avviso e' passata da meno di `finestra` minuti.
  const dovute = (lista, ora, finestra = 5) => (lista || []).filter(item => ora >= item.at && ora < item.at + finestra);

  return { ANTICIPO, arriviDelServizio, notifiche, dovute };
});
