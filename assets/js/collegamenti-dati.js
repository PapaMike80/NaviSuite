// Collegamenti pubblici tra le residenze: orari di partenza (si modificano dalla pagina Collegamenti).
// Ogni linea e' una tabella di testo: prima riga i giorni di ogni corsa, poi una riga per fermata.
// Giorni: FER lun-sab, LV lun-ven, SAB sabato, FEST domenica e festivi, SCO solo giorni di scuola (lun-sab), TUTTI ogni giorno.
window.NaviCollegamentiDefault = {
 "versione": 2,
 "stagioni": {
  "invernale": {
   "nome": "Invernale",
   "dal": "2026-10-12",
   "linee": [
    {
     "id": "r204-a",
     "nome": "R-Link 204 · Desenzano → Salò",
     "tipo": "bus",
     "testo": "giorni;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST\nDesenzano FS;06:50;08:00;09:00;10:00;11:00;12:00;13:20;14:20;15:00;16:00;17:00;18:00;19:00;20:00;21:00;22:00;23:00;07:00;08:00;09:00;10:00;11:00;12:00;13:00;14:00;15:00;16:00;17:00;18:00;19:00;20:00;21:00;22:00;23:00\nSalò;07:32;08:42;09:42;10:42;11:42;12:42;14:02;15:02;15:42;16:42;17:42;18:42;19:42;20:42;21:42;22:42;23:42;07:42;08:42;09:42;10:42;11:42;12:42;13:42;14:42;15:42;16:42;17:42;18:42;19:42;20:42;21:42;22:42;23:42",
     "fonte": "https://arriva.it/app/uploads/sites/6/2024/05/linea-R-link_204.pdf",
     "note": ""
    },
    {
     "id": "r204-r",
     "nome": "R-Link 204 · Salò → Desenzano",
     "tipo": "bus",
     "testo": "giorni;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FER;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST\nSalò;06:50;08:17;09:17;10:17;11:17;12:17;13:17;14:17;15:17;16:17;17:17;18:17;19:17;20:17;21:17;22:17;23:01;07:17;08:17;09:17;10:17;11:17;12:17;13:17;14:17;15:17;16:17;17:17;18:17;19:17;20:17;21:17;22:17;23:01\nDesenzano FS;07:59;08:59;09:59;10:59;11:59;12:59;13:59;14:59;15:59;16:59;17:59;18:59;19:59;20:59;21:59;22:59;23:43;07:59;08:59;09:59;10:59;11:59;12:59;13:59;14:59;15:59;16:59;17:59;18:59;19:59;20:59;21:59;22:59;23:43",
     "fonte": "https://arriva.it/app/uploads/sites/6/2024/05/linea-R-link_204.pdf",
     "note": ""
    },
    {
     "id": "ln027-a",
     "nome": "LN027 · Riva → Maderno → Salò",
     "tipo": "bus",
     "testo": "giorni;FER;FER;FER;FER;FER;FER;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST\nRiva;05:40;07:40;08:40;12:45;14:10;17:10;06:00;09:45;10:45;11:45;13:45;15:45;17:45;19:45\nLimone;05:53;07:53;08:53;12:58;14:23;17:23;06:13;09:58;10:58;11:58;13:58;15:58;17:58;19:58\nGargnano;06:25;08:25;09:25;13:30;14:55;17:55;06:45;10:30;11:30;12:30;14:30;16:30;18:30;20:30\nMaderno;06:37;;09:37;;;18:07;;;;;;;;\nSalò;06:50;;09:50;;;18:20;;;;;;;;",
     "fonte": "https://www.gardatrentino.it/Orari/Orari_Autobus/2026/Inverno%2026-27/Linea%2027_%20Riva-Desenzano%20AR.pdf",
     "note": "Le corse senza Maderno si fermano a Gargnano."
    },
    {
     "id": "ln027-r",
     "nome": "LN027 · Salò → Maderno → Riva",
     "tipo": "bus",
     "testo": "giorni;FER;FER;FER;FER;FER;FER;FEST;FEST;FEST;FEST;FEST;FEST;FEST\nSalò;06:20;;12:40;14:10;;18:40;;;;;;;\nMaderno;06:33;;12:53;14:23;;18:53;;;;;;;\nGargnano;06:45;09:10;13:05;14:35;15:05;19:05;08:45;09:45;10:45;12:45;14:45;16:45;18:45\nLimone;07:15;09:42;13:37;15:07;15:37;19:37;09:17;10:17;11:17;13:17;15:17;17:17;19:17\nRiva;07:31;09:52;13:48;15:18;15:47;19:48;09:27;10:27;11:27;13:27;15:27;17:27;19:27",
     "fonte": "https://www.gardatrentino.it/Orari/Orari_Autobus/2026/Inverno%2026-27/Linea%2027_%20Riva-Desenzano%20AR.pdf",
     "note": ""
    },
    {
     "id": "atv484-a",
     "nome": "ATV 484 · Riva → Malcesine → Garda",
     "tipo": "bus",
     "testo": "giorni;SCO;FER;FER;FER;SCO;FER;FER;FER;SCO;LV;SAB;LV;FER;FER;FER;FER;FEST;FEST\nRiva;05:00;05:05;05:55;07:05;;08:10;09:30;11:00;;12:40;13:00;13:30;14:30;16:10;17:15;18:10;08:10;14:10\nMalcesine;05:22;05:27;06:20;07:30;08:20;08:35;09:55;11:25;13:02;13:05;13:25;13:55;14:55;16:35;17:40;18:35;08:35;14:35\nTorri del Benaco;05:52;05:57;06:52;08:02;08:52;09:07;10:27;11:57;13:34;13:37;13:57;14:27;15:27;17:07;18:12;19:07;09:07;15:07\nGarda;;06:08;07:03;08:13;09:03;09:18;10:38;12:08;13:45;13:48;14:08;14:38;15:38;17:18;18:23;19:18;09:18;15:18",
     "fonte": "https://www.gardatrentino.it/Orari/Orari_Autobus/2026/Inverno%2026-27/ATV484_Inverno.pdf",
     "note": "Festivi dal 25/10/2026."
    },
    {
     "id": "atv484-r",
     "nome": "ATV 484 · Garda → Malcesine → Riva",
     "tipo": "bus",
     "testo": "giorni;SCO;SCO;FER;SCO;FER;FER;FER;SCO;FER;SCO;FER;FER;FER;FER;LV;FER;FER;FEST;FEST\nGarda;;;06:25;07:35;07:35;09:50;11:35;12:15;13:00;14:20;15:00;15:35;16:35;17:35;18:35;19:15;20:15;12:15;18:55\nTorri del Benaco;06:00;;06:36;07:46;07:46;10:01;11:46;12:26;13:11;14:31;15:11;15:46;16:46;17:46;18:46;19:26;20:26;12:26;19:06\nMalcesine;06:32;07:05;07:08;08:18;08:18;10:33;12:18;12:58;13:43;15:03;15:43;16:18;17:18;18:18;19:18;19:58;20:58;12:58;19:38\nRiva;;07:30;07:33;;08:43;10:58;12:43;;14:08;15:28;16:08;16:43;17:43;18:43;19:43;20:23;21:23;13:23;20:03",
     "fonte": "https://www.gardatrentino.it/Orari/Orari_Autobus/2026/Inverno%2026-27/ATV484_Inverno.pdf",
     "note": ""
    },
    {
     "id": "treno-dp",
     "nome": "Treno · Desenzano → Peschiera",
     "tipo": "treno",
     "testo": "giorni\nDesenzano FS\nPeschiera FS",
     "fonte": "https://www.trenitalia.com",
     "note": "Da compilare con l'orario Trenitalia in vigore (circa 10 minuti di viaggio)."
    },
    {
     "id": "treno-pd",
     "nome": "Treno · Peschiera → Desenzano",
     "tipo": "treno",
     "testo": "giorni\nPeschiera FS\nDesenzano FS",
     "fonte": "https://www.trenitalia.com",
     "note": "Da compilare con l'orario Trenitalia in vigore (circa 10 minuti di viaggio)."
    },
    {
     "id": "rl202-a",
     "nome": "RL202 · Salò → Maderno → Gargnano",
     "tipo": "bus",
     "testo": "giorni;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST\nSalò;06:55;07:15;07:37;07:42;07:45;07:50;08:10;08:15;08:45;09:15;09:45;10:15;10:45;11:15;11:45;12:17;12:17;12:30;12:45;13:10;13:15;13:20;13:45;14:09;14:15;14:27;14:45;15:15;15:19;15:29;15:45;16:15;17:15;17:45;18:15;18:45;19:15;19:45;20:15;20:27;20:42;21:15;07:15;07:37;07:41;07:45;07:50;08:10;08:15;08:45;09:15;09:45;10:15;10:45;11:15;11:45;12:17;12:18;12:18;12:18;12:31;12:45;12:47;13:08;13:15;13:45;14:10;14:15;14:27;14:45;15:15;15:29;15:45;16:15;17:15;17:45;18:15;18:45;19:15;19:45;20:15;20:42;21:15;05:09;05:20;08:13;09:13;09:35;10:13;11:13;12:13;13:13;14:13;15:13;16:13;17:13;18:13;19:13;20:13;21:13\nMaderno;07:08;07:28;07:50;07:54;07:58;08:02;08:23;08:28;08:58;09:28;09:58;10:28;10:58;11:28;11:58;12:28;12:29;12:42;12:58;13:23;13:28;13:33;13:58;14:22;14:28;14:38;14:58;15:28;15:32;15:40;15:58;16:28;17:28;17:58;18:28;18:58;19:28;19:58;20:28;20:40;20:56;21:28;07:28;07:50;07:54;07:58;08:02;08:23;08:28;08:58;09:28;09:58;10:28;10:58;11:28;11:58;12:28;12:30;12:31;12:33;12:44;12:56;12:58;13:21;13:28;13:58;14:24;14:28;14:38;14:58;15:28;15:40;15:58;16:28;17:28;17:58;18:28;18:58;19:28;19:58;20:28;20:56;21:28;05:22;05:33;08:26;09:26;09:49;10:26;11:26;12:26;13:26;14:26;15:26;16:26;17:26;18:26;19:26;20:26;21:26\nGargnano;07:20;07:40;;;08:10;08:14;;08:40;09:10;09:40;10:09;10:40;11:10;11:40;12:10;12:40;12:40;12:55;13:10;;13:40;13:45;14:10;;14:40;;15:10;15:40;;;16:10;16:40;17:40;18:10;18:40;19:10;19:40;20:10;20:40;;;21:40;07:40;;;08:10;08:14;;08:40;09:10;09:40;10:09;10:40;11:10;11:40;12:10;12:40;12:43;12:40;12:43;;13:10;13:10;;13:40;14:10;;14:40;;15:10;15:40;;16:10;16:40;17:40;18:10;18:40;19:10;19:40;20:10;20:40;;21:40;05:34;05:45;08:38;09:38;09:58;10:38;11:38;12:38;13:38;14:38;15:38;16:38;17:38;18:38;19:38;20:38;21:38",
     "fonte": "https://arriva.it/app/uploads/sites/6/2024/05/linea-R-link_202-1.pdf",
     "note": "Ricavati dall'orario ufficiale (solo le corse che fermano a Maderno). Lun–ven: periodo scolastico."
    },
    {
     "id": "rl202-r",
     "nome": "RL202 · Gargnano → Maderno → Salò",
     "tipo": "bus",
     "testo": "giorni;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;LV;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;SAB;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST;FEST\nGargnano;05:10;05:50;;06:20;06:50;06:50;07:20;07:20;07:25;07:50;07:50;07:50;08:20;08:20;08:50;09:20;09:50;10:20;10:50;11:20;11:50;;12:20;12:50;13:10;13:20;13:30;13:45;13:50;13:50;14:20;14:50;15:20;15:50;16:20;16:50;17:50;18:20;18:50;19:20;19:50;20:40;;05:10;05:50;;06:20;06:50;07:20;07:20;07:25;07:50;;08:14;08:20;08:50;09:20;09:50;10:20;10:50;11:20;11:50;12:20;;;12:50;;13:20;13:50;14:20;14:50;15:20;15:50;16:20;16:50;17:50;18:20;18:50;19:20;19:50;;05:45;06:45;07:45;08:45;09:45;10:45;11:45;12:45;13:45;14:45;15:45;;16:45;17:45;18:45;19:38;21:38\nMaderno;05:22;06:02;06:23;06:32;07:01;07:05;07:31;07:32;07:37;08:00;08:02;08:04;08:31;08:32;09:02;09:32;10:02;10:32;11:02;11:32;12:02;12:17;12:32;13:02;13:21;13:32;13:42;13:57;14:01;14:02;14:32;15:02;15:32;16:02;16:32;17:02;18:02;18:32;19:02;19:32;20:02;20:52;21:00;05:22;06:02;06:23;06:32;07:01;07:31;07:32;07:37;08:02;08:10;08:26;08:32;09:02;09:32;10:02;10:32;11:02;11:32;12:02;12:32;12:49;13:00;13:02;13:27;13:32;14:02;14:32;15:02;15:32;16:02;16:32;17:02;18:02;18:32;19:02;19:32;20:02;21:00;05:57;06:57;07:57;08:57;09:57;10:57;11:57;12:57;13:57;14:57;15:57;16:41;16:57;17:57;18:57;19:50;21:50\nSalò;05:35;06:15;06:35;06:45;07:15;07:17;07:44;07:44;07:50;08:15;08:15;08:15;08:44;08:44;09:15;09:45;10:15;10:45;11:15;11:45;12:15;;12:45;13:15;13:35;13:45;13:55;14:08;14:14;14:14;14:45;15:15;15:45;16:15;16:45;17:15;18:15;18:45;19:15;19:45;20:15;21:05;;05:35;06:15;06:35;06:45;07:15;07:44;07:44;07:50;08:15;;08:39;08:45;09:15;09:45;10:15;10:45;11:15;11:45;12:15;12:45;13:03;13:13;13:15;13:40;13:45;14:15;14:45;15:15;15:45;16:15;16:45;17:15;18:15;18:45;19:15;19:45;20:15;;06:10;07:10;08:10;09:10;10:10;11:10;12:10;13:10;14:10;15:10;16:10;;17:10;18:10;19:10;20:03;22:03",
     "fonte": "https://arriva.it/app/uploads/sites/6/2024/05/linea-R-link_202-1.pdf",
     "note": ""
    },
    {
     "id": "ln007-a",
     "nome": "LN007 · Desenzano porto → Salò",
     "tipo": "bus",
     "testo": "giorni;SCO\nDesenzano FS;05:35\nDesenzano porto;05:51\nSalò;06:38",
     "fonte": "https://arriva.it/app/uploads/sites/6/2026/05/LN007-Desenzano-%E2%80%93-Moniga-%E2%80%93-Manerba-%E2%80%93-San-Felice-%E2%80%93-Portese-%E2%80%93-Salo-est26.pdf",
     "note": "Corsa vista su Google Maps (15/10/2026): parte da via Anelli, porto, a 16 min a piedi dalla stazione; arrivo a Salò stimato. Da verificare sull'orario Arriva."
    }
   ]
  },
  "estivo": {
   "nome": "Estivo",
   "dal": "2027-06-09",
   "linee": [
    {
     "id": "atv483-a",
     "nome": "ATV 483 · Garda → Peschiera",
     "tipo": "bus",
     "testo": "giorni;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI\nGarda;08:30;08:45;09:45;10:45;11:45;12:45;13:45;14:45;15:45;16:45;17:45;18:45;19:45\nPeschiera FS;08:57;09:12;10:12;11:12;12:12;13:12;14:12;15:12;16:12;17:12;18:12;19:12;20:12",
     "fonte": "https://tech.atv.verona.it/atv_www/orari_extraurb/pdf/483.pdf",
     "note": "Si effettua fino al 18/10 e dal 21/03."
    },
    {
     "id": "atv483-r",
     "nome": "ATV 483 · Peschiera → Garda",
     "tipo": "bus",
     "testo": "giorni;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI;TUTTI\nPeschiera FS;08:28;09:28;10:28;11:28;12:28;13:28;14:28;15:28;16:28;17:28;18:28;19:28\nGarda;08:57;09:57;10:57;11:57;12:57;13:57;14:57;15:57;16:57;17:57;18:57;19:57",
     "fonte": "https://tech.atv.verona.it/atv_www/orari_extraurb/pdf/483.pdf",
     "note": ""
    },
    {
     "id": "treno-dp",
     "nome": "Treno · Desenzano → Peschiera",
     "tipo": "treno",
     "testo": "giorni\nDesenzano FS\nPeschiera FS",
     "fonte": "https://www.trenitalia.com",
     "note": "Da compilare con l'orario Trenitalia in vigore (circa 10 minuti di viaggio)."
    },
    {
     "id": "treno-pd",
     "nome": "Treno · Peschiera → Desenzano",
     "tipo": "treno",
     "testo": "giorni\nPeschiera FS\nDesenzano FS",
     "fonte": "https://www.trenitalia.com",
     "note": "Da compilare con l'orario Trenitalia in vigore (circa 10 minuti di viaggio)."
    }
   ]
  }
 }
};
