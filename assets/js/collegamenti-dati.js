// Collegamenti pubblici tra le residenze: orari di partenza (si modificano dalla pagina Collegamenti).
// Ogni linea e' una tabella di testo: prima riga i giorni di ogni corsa, poi una riga per fermata.
// Giorni: FER lun-sab, LV lun-ven, SAB sabato, FEST domenica e festivi, SCO solo giorni di scuola (lun-sab), TUTTI ogni giorno.
window.NaviCollegamentiDefault = {
 "versione": 1,
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
     "id": "slink202",
     "nome": "S-Link 202 · Salò ↔ Maderno ↔ Gargnano",
     "tipo": "bus",
     "testo": "giorni\nSalò\nMaderno\nGargnano",
     "fonte": "https://brescia.arriva.it",
     "note": "Circa ogni 30 minuti nei feriali: da compilare con l'orario Arriva."
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
