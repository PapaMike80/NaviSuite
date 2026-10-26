// Modulo Dati e Calcoli CCNL Autoferrotranvieri per NaviSuite / Navibeta.
// Tabellari, voci fisse e variabili, indennità, trattenute e ratei mensili.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.NaviCCNLConfig = api;
    root.CCNL_DB = api.CCNL_DB;
    root.calcolaVoceAttesa = api.calcolaVoceAttesa;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const round2 = value => Math.round((Number(value) || 0) * 100) / 100;
  const round5 = value => Math.round((Number(value) || 0) * 100000) / 100000;

  const CCNL_DB = {
    divisoreOrario: 166,

    // Tabellari base per parametro contrattuale (valori CCNL aggiornati da agosto 2026)
    parametri: {
      121: {
        descrizione: 'Marinaio / Operatore d\'esercizio',
        minimo: 938.80,
        contingenza: 527.56,
        cau: 16.53,
        indProduttivita: 4.65,
        tdr: 172.70,
        mensa: 35.71,
        composizione: {
          minimo: 938.80,
          contingenza: 527.56,
          cau: 16.53,
          indProduttivita: 4.65,
          tdr: 172.70,
          mensa: 35.71
        },
        retribuzioneMensile: 1695.95, // Voce 002: 938,80 + 527,56 + 16,53 + 4,65 + 172,70 + 35,71
        valoreScatto: 18.59,
        indImbarco: 2.02,
        baseOraria: {
          ordinario: 10.21657, // 1695,95 / 166
          straordinario: 10.92637, // Voce 334
          festivo: 12.14059 // Voce 013 (lavoro in FI-FN)
        }
      },
      129: {
        descrizione: 'Addetto d\'esercizio',
        minimo: 1000.87,
        contingenza: 562.44,
        cau: 16.53,
        indProduttivita: 4.65,
        tdr: 184.12,
        mensa: 35.71,
        retribuzioneMensile: 1808.08,
        valoreScatto: 19.82,
        indImbarco: 2.02,
        baseOraria: {
          ordinario: 10.89205,
          straordinario: 11.64878,
          festivo: 12.94326
        }
      },
      139: {
        descrizione: 'Bigliettaio con maneggio denaro / Conduttore',
        minimo: 1078.46,
        contingenza: 606.04,
        cau: 16.53,
        indProduttivita: 4.65,
        tdr: 198.39,
        mensa: 35.71,
        retribuzioneMensile: 1948.24,
        valoreScatto: 21.36,
        indImbarco: 2.02,
        baseOraria: {
          ordinario: 9.22020, // base 55Y D.P. Ore diff.paga 139B
          straordinario: 11.56263, // 01Y D.P.lav.str. Qu.139B
          festivo: 13.94635
        }
      },
      140: {
        descrizione: 'Capotreno / Motorista',
        minimo: 1086.21,
        contingenza: 610.40,
        cau: 16.53,
        indProduttivita: 4.65,
        tdr: 199.82,
        mensa: 35.71,
        retribuzioneMensile: 1962.25,
        valoreScatto: 21.51,
        indImbarco: 2.02,
        baseOraria: {
          ordinario: 11.82078,
          straordinario: 12.64207,
          festivo: 14.04672
        }
      },
      158: {
        descrizione: 'Capitano / Macchinista / Operatore Tecnico',
        minimo: 1225.87,
        contingenza: 688.88,
        cau: 16.53,
        indProduttivita: 4.65,
        tdr: 225.51,
        mensa: 35.71,
        retribuzioneMensile: 2214.54,
        valoreScatto: 24.27,
        indImbarco: 2.02,
        baseOraria: {
          ordinario: 13.34060,
          straordinario: 14.26743,
          festivo: 15.85292
        }
      }
    },

    // Voci fisse mensili
    vociFisse: {
      '03N': { label: 'EDR Rinn.CCNL', importo: 27.66 },
      '01P': { label: 'Ind. professionalizzante', importo: 6.00 },
      '10Z': { label: 'Trattam. Integrat.', importo: 40.00 }
    },

    // Voci variabili orarie e mansioni superiori (differenza parametro 139B)
    vociVariabili: {
      '334': { label: 'Prest. straordinarie', tipo: 'oraria_maggiorata' },
      '013': { label: 'Lavoro in FI-FN (festività e mancato riposo)', tipo: 'oraria_maggiorata' },
      '01Y': { label: 'D.P.lav.str. Qu.139B', tipo: 'oraria', baseOraria: 11.56263 },
      '55Y': { label: 'D.P. Ore diff.paga 139B', tipo: 'oraria', baseOraria: 9.22020 },
      '56Y': { label: 'Tratt.ore diff.paga', tipo: 'oraria_trattenuta', baseOraria: 8.34262, basiPossibili: [8.34262, 8.69718] }
    },

    // Mansioni superiori / differenze parametro
    differenzeParametro: {
      '139B': {
        '01Y': { label: 'D.P.lav.str. Qu.139B', baseOraria: 11.56263 },
        '55Y': { label: 'D.P. Ore diff.paga 139B', baseOraria: 9.22020 },
        '56Y': { label: 'Tratt.ore diff.paga', baseOraria: 8.34262, basiPossibili: [8.34262, 8.69718] }
      }
    },

    // Indennità a moltiplicatore fisso o da parametro
    indennita: {
      '41X': { label: 'Ind. imbarco', tipo: 'giornaliera', importo: 2.02 },
      '43X': { label: 'Ind. imbarco 2.02 P.121', tipo: 'giornaliera', importo: 2.02 },
      '47X': { label: 'Ind. prest. domenicale', tipo: 'giornaliera', importo: 12.00 },
      '49X': { label: 'Ind. prest. giornaliera D.M.', tipo: 'giornaliera', importo: 0.52 },
      '1TK': { label: 'Ticket elettronico', tipo: 'ticket', importo: 8.00, figurativo: true },
      '70X': { label: '2 ticket inps/fisc.', tipo: 'ticket', importo: 8.00 },
      '13X': { label: 'Diarie 24%', tipo: 'giornaliera', importo: 7.44 },
      '18X': { label: 'Diarie 24%', tipo: 'giornaliera', importo: 7.44 },
      '28Y': { label: 'Diarie 24% (es.30,99)', tipo: 'giornaliera', importo: 7.44 },
      '29Y': { label: 'Diarie 24%', tipo: 'giornaliera', importo: 7.44 },
      'FC0': { label: 'Maneggio denaro terra', tipo: 'giornaliera', importo: 2.00 },
      'FC1': { label: 'Pernottazione navigante 40%', tipo: 'giornaliera', importo: 12.00 }
    },

    // Trattenute e previdenza integrativa
    trattenute: {
      '047': { label: 'Contributi FPLD / IVS', aliquota: 0.0919 },
      '070': { label: 'Contributo Sindacale', aliquota: 0.01, quotaFissa: 15.00 },
      'PRIAMO': { label: 'Fondo Priamo', aliquotaLavoratore: 0.01, aliquotaAzienda: 0.01 }
    },

    // Regole di maturazione ferie e permessi (rateo mensile)
    rateiMensili: {
      ferie: 2.08, // +2,08 giorni/ore al mese (es. 4,16 a luglio, 8,32 a settembre)
      exFestivita: 2.60 // +2,60 al mese (es. 5,20 a luglio, 10,40 a settembre)
    }
  };

  function getParametroInfo(parametro) {
    const p = Number(parametro) || 139;
    return CCNL_DB.parametri[p] || CCNL_DB.parametri[139] || CCNL_DB.parametri[121];
  }

  // Calcolo paga base mensile e oraria
  function calcolaPagaBase(parametro, numScatti = 0) {
    const pInfo = getParametroInfo(parametro);
    const scatti = Math.max(0, Math.min(5, Number(numScatti) || 0));
    const totaleScatti = round2(scatti * pInfo.valoreScatto);
    const totaleMensile = round2(pInfo.retribuzioneMensile + totaleScatti);
    const pagaOrariaBase = round5(totaleMensile / CCNL_DB.divisoreOrario);
    return {
      parametro: Number(parametro) || 139,
      scatti,
      retribuzioneMensile: pInfo.retribuzioneMensile,
      valoreScatto: pInfo.valoreScatto,
      totaleScatti,
      totaleMensile,
      pagaOrariaBase,
      divisore: CCNL_DB.divisoreOrario
    };
  }

  // Base oraria attesa per una voce
  function calcolaBaseOraria(codiceVoce, parametro = 139, numScatti = 0) {
    const code = String(codiceVoce?.code || codiceVoce || '').trim().toUpperCase();
    const pInfo = getParametroInfo(parametro);
    const scatti = Math.max(0, Math.min(5, Number(numScatti) || 0));
    const quotaScattoOrario = scatti > 0 ? (scatti * pInfo.valoreScatto) / CCNL_DB.divisoreOrario : 0;

    if (code === '334') {
      const base = pInfo.baseOraria?.straordinario || 10.92637;
      return round5(base + (quotaScattoOrario > 0 ? quotaScattoOrario * (base / (pInfo.retribuzioneMensile / CCNL_DB.divisoreOrario)) : 0));
    }
    if (code === '013') {
      const base = pInfo.baseOraria?.festivo || 12.14059;
      return round5(base + (quotaScattoOrario > 0 ? quotaScattoOrario * (base / (pInfo.retribuzioneMensile / CCNL_DB.divisoreOrario)) : 0));
    }
    if (code === '01Y') return 11.56263;
    if (code === '55Y') return 9.22020;
    if (code === '56Y') return -8.34262;
    if (code === 'D.P.' || code === 'DP') return round5(9.22020 - 8.34262);
    if (CCNL_DB.indennita[code]) {
      const ind = CCNL_DB.indennita[code];
      return (code === '41X' || code === '43X') ? (pInfo.indImbarco || ind.importo) : ind.importo;
    }
    return null;
  }

  // Calcolo del valore in Euro atteso per una voce specifica
  function calcolaVoceAttesa(codiceVoce, quantita, parametro = 139, numScatti = 0) {
    const code = String(codiceVoce?.code || codiceVoce || '').trim().toUpperCase();
    let qty = quantita !== undefined && quantita !== null
      ? Number(quantita)
      : Number(codiceVoce?.quantity ?? codiceVoce?.figurative ?? 1);
    if (!Number.isFinite(qty)) qty = 1;

    const pInfo = getParametroInfo(parametro);
    const scatti = Math.max(0, Math.min(5, Number(numScatti) || 0));

    // Voci base retribuzione mensile fissa
    if (code === '001' || code === '002') {
      return round2(pInfo.retribuzioneMensile + scatti * pInfo.valoreScatto);
    }

    // Voci fisse aggiuntive
    if (CCNL_DB.vociFisse[code]) {
      return round2(CCNL_DB.vociFisse[code].importo);
    }

    // Straordinario feriale (334)
    if (code === '334') {
      const base = calcolaBaseOraria('334', parametro, scatti);
      return round2(qty * base);
    }

    // Lavoro in festività / mancato riposo (013)
    if (code === '013') {
      const base = calcolaBaseOraria('013', parametro, scatti);
      return round2(qty * base);
    }

    // Mansioni superiori / D.P. Qu.139B
    if (code === '01Y') {
      return round2(qty * 11.56263);
    }
    if (code === '55Y') {
      return round2(qty * 9.22020);
    }
    if (code === '56Y') {
      // In busta paga è una trattenuta (importo negativo)
      return -round2(qty * 8.34262);
    }
    if (code === 'D.P.' || code === 'DP') {
      // Differenza netta 55Y - 56Y
      return round2(qty * (9.22020 - 8.34262));
    }

    // Indennità a importo fisso o da parametro
    if (CCNL_DB.indennita[code]) {
      const ind = CCNL_DB.indennita[code];
      const unitario = (code === '41X' || code === '43X') ? (pInfo.indImbarco || ind.importo) : ind.importo;
      return round2(qty * unitario);
    }

    // Trattenute previdenziali e sindacali
    if (code === '047' || code === 'C01') {
      return -round2(qty * CCNL_DB.trattenute['047'].aliquota);
    }
    if (code === '070') {
      return -round2(qty * CCNL_DB.trattenute['070'].aliquota);
    }

    return null;
  }

  // Ratei mensili maturati (ferie ed ex festività)
  function calcolaRateiMaturati(mesi, tipo) {
    const m = Math.max(0, Number(mesi) || 0);
    const tipoNorm = String(tipo || '').toLowerCase();
    if (tipoNorm === 'ferie') return round2(m * CCNL_DB.rateiMensili.ferie);
    if (tipoNorm === 'exfestivita' || tipoNorm === 'ex_festivita' || tipoNorm === 'ex') {
      return round2(m * CCNL_DB.rateiMensili.exFestivita);
    }
    return {
      mesi: m,
      ferie: round2(m * CCNL_DB.rateiMensili.ferie),
      exFestivita: round2(m * CCNL_DB.rateiMensili.exFestivita)
    };
  }

  return {
    CCNL_DB,
    calcolaPagaBase,
    calcolaBaseOraria,
    calcolaVoceAttesa,
    calcolaRateiMaturati
  };
});
