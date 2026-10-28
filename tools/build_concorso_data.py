# -*- coding: utf-8 -*-
import json
import os

workspace_dir = r"C:\Users\Marco\.gemini\antigravity\worktrees\NaviSuite\leggi_bando_concorso"

# Moduli format uniformati
from build_concorso_pages import modules_data

# Prove passate files
past_papers = [
    {
        "title": "Prova Scritta Ufficiale 12/2025 (Desenzano)",
        "file": "docs/controllo/08_Prove_Passate_Ufficiali/Domande_Prova_Scritta_12_2025_DE.pdf",
        "date": "Anno 2025 · Esercizio Lago di Garda",
        "desc": "30 quesiti a risposta multipla su Legge 614/1957, R.D. 148/1931, D.Lgs. 81/2008, Regolamento di Navigazione Interna, nomenclatura navale e sicurezza."
    },
    {
        "title": "Prova Scritta Ufficiale 33/2025 (Desenzano)",
        "file": "docs/controllo/08_Prove_Passate_Ufficiali/Domande-Prova-Scritta_33_2025_DE.pdf",
        "date": "Anno 2025 · Esercizio Lago di Garda",
        "desc": "30 quesiti su geografia dei laghi (Garda, Como, Maggiore), Grotte di Catullo, Isole Borromee, R.D. 148/1931 e sicurezza sul lavoro."
    },
    {
        "title": "Prova Scritta Ufficiale 04/2025 (Como)",
        "file": "docs/controllo/08_Prove_Passate_Ufficiali/Domande-Prova-Scritta-04_2025_C.pdf",
        "date": "Anno 2025 · Esercizio Lago di Como",
        "desc": "30 quesiti su istituzione GGNL, terminologia marinara, classi di incendio A/B/C, tonneggio, primo soccorso e regolamenti."
    },
    {
        "title": "Prova Scritta Ufficiale 18/2025 (Como)",
        "file": "docs/controllo/08_Prove_Passate_Ufficiali/Domande-Prova-Scritta-18_2025_C.pdf",
        "date": "Anno 2025 · Esercizio Lago di Como",
        "desc": "30 quesiti con quesiti su sicurezza, antincendio, precedenze tra battelli di linea e unità da diporto, codice del personale."
    }
]

# Database quesiti storici commentati per la tabella
historical_questions = [
    {
        "q": "In base all'Art. 1 della Legge 614/1957 (testo vigente), quale durata ha l'incarico del Gestore Governativo?",
        "ans": "5 anni, rinnovabile per una sola volta",
        "source": "L. 614/1957 Art. 1 c. 1 (modificato da L. 14/2023)",
        "note": "ATTENZIONE: Nel testo originario del 1957 non c'era scadenza (indeterminato); la L. 14/2023 ha introdotto il termine espresso di 5 anni rinnovabile una sola volta!"
    },
    {
        "q": "Quale sanzione del R.D. 148/1931 ha funzione di richiamo preliminare?",
        "ans": "La Censura (rimprovero scritto per mancanze lievi)",
        "source": "Prova Ufficiale CE Movimento & 12/2025",
        "note": "Allegato A al R.D. 148/1931, artt. 37 e 40."
    },
    {
        "q": "Quale sanzione del R.D. 148/1931 è considerata pena accessoria?",
        "ans": "Il trasloco punitivo",
        "source": "Prova Ufficiale CE Movimento",
        "note": "Art. 37: applicabile in caso di incompatibilità ambientale o di servizio."
    },
    {
        "q": "Quali elementi determinano la gerarchia tra gli agenti secondo il R.D. 148/1931?",
        "ans": "Grado, anzianità nel grado, anzianità nel grado precedente, anzianità di servizio, maggiore età",
        "source": "Prova Ufficiale CE 130 & DE 12/2025",
        "note": "Art. 19 Allegato A R.D. 148/1931. Il titolo di studio non rientra tra i criteri primari."
    },
    {
        "q": "Qual è il lago italiano con la maggiore estensione superficiale?",
        "ans": "Lago di Garda (Benaco, circa 370 km²)",
        "source": "Prova Ufficiale DE 33/2025",
        "note": "Il lago più profondo è invece Como (418 metri)."
    },
    {
        "q": "In quale lago si trovano le famose Isole Borromee (Bella, Madre, Pescatori)?",
        "ans": "Lago Maggiore (Golfo Borromeo, tra Stresa e Baveno/Verbania)",
        "source": "Prova Ufficiale DE 33/2025",
        "note": "L'Isola Comacina si trova invece sul Lago di Como; l'Isola del Garda sul Benaco."
    },
    {
        "q": "In un orario grafico di trasporto lacustre, cosa rappresenta la pendenza della traccia?",
        "ans": "La velocità media del mezzo (più la traccia tende alla verticale, maggiore è la velocità)",
        "source": "Prova Ufficiale CE 130",
        "note": "Diagramma spazio-tempo: asse orizzontale = tempo, asse verticale = distanza scali."
    },
    {
        "q": "Quale vento caratteristico soffia da Sud-Ovest sul Lago di Garda?",
        "ans": "L'Ander",
        "source": "Prova Ufficiale CE 130",
        "note": "Il Pelèr è da Nord al mattino; l'Ora è da Sud al pomeriggio; la Vinessa da Est/Sud-Est."
    },
    {
        "q": "Nei viaggi in comitiva scolastica, a chi viene riconosciuta la gratuità secondo le condizioni GGNL?",
        "ans": "A un insegnante/accompagnatore ogni 10 studenti paganti",
        "source": "Prova Ufficiale CE 130",
        "note": "Condizioni generali tariffarie vigenti."
    },
    {
        "q": "Entro quale termine deve essere inviato il rapporto di corsa del personale navigante?",
        "ans": "Entro le 24 ore successive all'effettuazione del servizio",
        "source": "Prova Ufficiale CE 130",
        "note": "Regolamento di Esercizio 2004."
    }
]

# Elenco completo documenti ufficiali (incluso atti ufficiali inPA scaricati)
all_docs = [
    ("Elenco Candidati Ammessi (Pubblicato il 14/10/2026)", "docs/controllo/00_Bando_e_Atti_Ufficiali/Elenco_candidati_ammessi_16_2026_DE.pdf", "Determina e firma RUP del 14/10/2026 con i 69 candidati ammessi alla prova scritta", "Atti inPA / GGNL"),
    ("Bando Ufficiale Concorso Operatore Ufficio (Prot. C163 / Det. C162)", "docs/controllo/00_Bando_e_Atti_Ufficiali/Bando162026_DE.pdf", "Bando integrale per 3 posti (Arona, Como, Desenzano), requisiti e materie esame", "Bando Ufficiale inPA"),
    ("Allegato B - Carta della Mobilità e dei Servizi GGNL", "docs/controllo/00_Bando_e_Atti_Ufficiali/AllegatoB_CartaMobilita.pdf", "Carta della mobilità ufficiale della Gestione Governativa Navigazione Laghi", "Documento Ufficiale GGNL"),
    ("Allegato A - Codice Etico Navigazione Laghi", "docs/controllo/00_Bando_e_Atti_Ufficiali/AllegatoA_Codice-Etico-GestioneNavigazioneLaghi.pdf", "Codice etico aziendale e regole di integrità del dipendente GGNL", "Allegato Bando inPA"),
    ("Allegato C - Regolamento di Esercizio GGNL", "docs/controllo/00_Bando_e_Atti_Ufficiali/AllegatoC_REGOLAMENTO_ESERCIZIO_13_05_03.pdf", "Condizioni di trasporto passeggeri, compiti equipaggio e controlleria", "Allegato Bando inPA"),
    ("Informativa Trattamento Dati Personali Candidati", "docs/controllo/00_Bando_e_Atti_Ufficiali/InformativaAlTrattamentoDeiDatiPersonaliDeiCandidati_Regolamento(UE)n.679_2016-1.pdf", "Informativa ex artt. 13-14 Regolamento UE 2016/679 (GDPR) per i candidati", "Privacy inPA"),
    ("Guida Generale allo Studio & Indice", "docs/controllo/00_GUIDA_STUDIO_E_INDICE_MATERIE.md", "Mappa concettuale 18 materie e piano 4 settimane", "Markdown Guida"),
    ("Legge 18 luglio 1957, n. 614", "docs/controllo/01_Normativa_GGNL_e_Trasporti/LEGGE 18 luglio 1957, n. 614.pdf", "Legge istitutiva Gestione Governativa", "Normativa"),
    ("Regolamento di Esercizio 2004", "docs/controllo/01_Normativa_GGNL_e_Trasporti/Regolamento_di_Esercizio_2004.pdf", "Regolamento approvato dal MIT nota NI/1716", "Regolamento Aziendale"),
    ("D.P.R. 11 luglio 1980, n. 753", "docs/controllo/01_Normativa_GGNL_e_Trasporti/DPR_753_1980_Polizia_Sicurezza_Trasporti.pdf", "Polizia, sicurezza e regolarità trasporti", "DPR Nazionale"),
    ("D.P.C.M. 30 dicembre 1998", "docs/controllo/01_Normativa_GGNL_e_Trasporti/DPCM_30_12_1998_Carta_Servizi_Mobilita.pdf", "Carta dei servizi pubblici settore trasporti", "DPCM"),
    ("Regolamento (UE) n. 1177/2010", "docs/controllo/01_Normativa_GGNL_e_Trasporti/Regolamento_UE_1177_2010_Diritti_Passeggeri.pdf", "Diritti passeggeri navigazione interna e PMR", "Regolamento UE"),
    ("Legge 3 febbraio 1965, n. 14", "docs/controllo/01_Normativa_GGNL_e_Trasporti/Legge_14_1965_Assuntorie.pdf", "Regolamentazione delle assuntorie di scalo", "Legge"),
    ("Dispensa IVA 10%, Registri art. 24 & POS", "docs/controllo/02_Tariffe_Biglietti_IVA_Pagamenti/DISPENSA_IVA_REGISTRI_E_PAGAMENTI.md", "Sintesi mirata per Operatore di Ufficio", "Dispensa Studio"),
    ("Tariffario Ufficiale GGNL A4", "docs/controllo/02_Tariffe_Biglietti_IVA_Pagamenti/Tariffario 2023 A4.pdf", "Tariffe vigenti e condizioni generali di viaggio", "Tariffario"),
    ("D.M. Finanze 30 giugno 1992", "docs/controllo/02_Tariffe_Biglietti_IVA_Pagamenti/DM_30_06_1992_Min_Finanze_Biglietti.pdf", "Valenza fiscale biglietti di pubblico trasporto", "Decreto Fiscale"),
    ("D.M. MIT 27 ottobre 2016 n. 255", "docs/controllo/02_Tariffe_Biglietti_IVA_Pagamenti/DM_MIT_255_2016_Bigliettazione_Elettronica.pdf", "Regole e interoperabilità bigliettazione elettronica", "Decreto MIT"),
    ("R.D. 8 gennaio 1931, n. 148", "docs/controllo/03_Stato_Giuridico_e_Codice_Comportamento/RD_148_1931_Stato_Giuridico_Autoferrotranviari.pdf", "Stato giuridico e disciplina autoferrotranviari", "Regio Decreto"),
    ("CCNL Autoferrotranviari", "docs/controllo/03_Stato_Giuridico_e_Codice_Comportamento/CCNL_AUTOFERROTRANVIERI_0.pdf", "Contratto Collettivo Nazionale di Lavoro", "CCNL"),
    ("D.P.R. 13 giugno 2023, n. 81", "docs/controllo/03_Stato_Giuridico_e_Codice_Comportamento/DPR_81_2023_Codice_Comportamento.pdf", "Nuovo codice di comportamento dipendenti pubblici", "DPR Nazionale"),
    ("D.P.C.M. 3 dicembre 2013", "docs/controllo/04_Gestione_Documentale_e_Privacy/DPCM_3_12_2013_Gestione_Documentale.pdf", "Regole tecniche protocollo e conservazione a norma", "DPCM Tecnico"),
    ("Regolamento (UE) 2016/679 (GDPR)", "docs/controllo/04_Gestione_Documentale_e_Privacy/Regolamento_UE_2016_679_GDPR.pdf", "Protezione persone fisiche e dati personali", "Regolamento UE"),
    ("Dispensa Geografia dei 3 Laghi", "docs/controllo/05_Geografia_dei_Laghi/DISPENSA_GEOGRAFIA_LAGHI.md", "Bacini, porti, traghetti auto e venti (Garda, Como, Maggiore)", "Dispensa Studio"),
    ("Dispensa Informatica (Excel, PEC) & Inglese", "docs/controllo/06_Informatica_e_Inglese/DISPENSA_INFORMATICA_E_INGLESE.md", "Excel avanzato, ricevute PEC, glossario trasporti", "Dispensa Studio")
]
