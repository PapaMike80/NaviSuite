window.NAVI_UPDATE_PACKAGES = {
  ods29: {
    id:"ODS_29_2026",
    title:"Ordine di Servizio 29/2026",
    description:"Variazioni turni da ufficio del 31 luglio e 1 agosto 2026.",
    variations:[
      {attiva:true,data:"2026-07-31",id_agente:"115",agente:"PEROTTI D.",turno_originale:"RIP",turno_nuovo:"D2",ods:"29/2026",tipo:"D'UFFICIO",note:""},
      {attiva:true,data:"2026-08-01",id_agente:"46",agente:"ALGERI A.",turno_originale:"CR3",turno_nuovo:"R2",ods:"29/2026",tipo:"D'UFFICIO",note:""},
      {attiva:true,data:"2026-08-01",id_agente:"70",agente:"GRUMELLI M.",turno_originale:"RIP",turno_nuovo:"D2",ods:"29/2026",tipo:"D'UFFICIO",note:"SN - BURDO istruttore"},
      {attiva:true,data:"2026-08-01",id_agente:"112",agente:"PEGORARI C.",turno_originale:"BIS2",turno_nuovo:"BIS2",ods:"29/2026",tipo:"D'UFFICIO",note:"Pronti a muovere 08:55-19:05 con Cat. VERGA; pausa pranzo 1 ora"},
      {attiva:true,data:"2026-08-01",id_agente:"124",agente:"SCHIPPERS E.",turno_originale:"BIS2",turno_nuovo:"BIS2",ods:"29/2026",tipo:"D'UFFICIO",note:"Pronti a muovere 08:55-19:05 con Cat. VERGA; pausa pranzo 1 ora"},
      {attiva:true,data:"2026-08-01",id_agente:"147",agente:"BIGNOTTI F.",turno_originale:"BIS2",turno_nuovo:"BIS2",ods:"29/2026",tipo:"D'UFFICIO",note:"Pronti a muovere 08:55-19:05 con Cat. VERGA; pausa pranzo 1 ora"},
      {attiva:true,data:"2026-08-01",id_agente:"76",agente:"COSTAMAGNA S.",turno_originale:"RIP",turno_nuovo:"D3",ods:"29/2026",tipo:"D'UFFICIO",note:""},
      {attiva:true,data:"2026-08-01",id_agente:"110",agente:"LAVELLI D.",turno_originale:"CD4C",turno_nuovo:"RIP",ods:"29/2026",tipo:"D'UFFICIO",note:""}
    ]
  },
  bariste0309: {
    id:"BARISTE_2026_08_03_09",
    title:"Turni bariste 3-9 agosto 2026",
    description:"P1, P2, D2 e D3 estratti dal prospetto Turni Navi.",
    records:[
      ["2026-08-03","P1","IVANA"],["2026-08-04","P1","ANNA"],["2026-08-04","P1","IVANA"],["2026-08-04","P1","SARA"],["2026-08-04","P1","MIHAELA"],["2026-08-05","P1","IVANA"],["2026-08-06","P1","ANNA"],["2026-08-07","P1","IVANA"],["2026-08-08","P1","ANNA"],["2026-08-09","P1","ANNA"],
      ["2026-08-03","P2","ANNA"],["2026-08-04","P2","BARBARA"],["2026-08-05","P2","MIHAELA"],["2026-08-06","P2","MIHAELA"],["2026-08-07","P2","ANNA"],["2026-08-08","P2","MIHAELA"],["2026-08-09","P2","MIHAELA"],
      ["2026-08-03","D2","BARBARA"],["2026-08-04","D2","HIBA"],["2026-08-05","D2","BARBARA"],["2026-08-06","D2","BARBARA"],["2026-08-07","D2","HIBA"],["2026-08-08","D2","BARBARA"],["2026-08-09","D2","HIBA"],
      ["2026-08-03","D3","HIBA"],["2026-08-04","D3","ALESSIA"],["2026-08-05","D3","HIBA"],["2026-08-06","D3","ALESSIA"],["2026-08-07","D3","ALESSIA"],["2026-08-08","D3","ALESSIA"],["2026-08-09","D3","ALESSIA"]
    ].map(([data,corsa,barista]) => ({
      attiva:true,
      data,
      corsa,
      id:`BARISTA_${barista}`,
      barista,
      note:"Turni Navi 3-9 agosto 2026"
    }))
  }
};
