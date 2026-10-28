# -*- coding: utf-8 -*-
import json
import os

workspace_dir = r"C:\Users\Marco\.gemini\antigravity\worktrees\NaviSuite\leggi_bando_concorso"

modules_data = [
    {
        "id": "ggnl",
        "num": "MODULO 1",
        "title": "Gestione Governativa Navigazione Laghi & Legge 614/1957",
        "ref": "Legge 18 luglio 1957, n. 614",
        "color": "var(--teal)",
        "icon": "🏛️",
        "key_points": [
            "<strong>Anno di Istituzione:</strong> <strong>1957</strong> con Legge n. 614 del 18 luglio 1957.",
            "<strong>Vigilanza e Competenza:</strong> Posta sotto la diretta vigilanza del <strong>Ministero delle Infrastrutture e dei Trasporti (MIT)</strong>.",
            "<strong>Organo di Vertice:</strong> <strong>Gestore Governativo</strong>, nominato con Decreto del Ministro dei Trasporti.",
            "<strong>Durata dell'incarico (Art. 1 vigente, modif. L. 14/2023):</strong> Nominato con Decreto del Ministro per un periodo di <strong>5 anni, rinnovabile per una sola volta</strong>.",
            "<strong>I 3 Bacini di Esercizio:</strong> Lago Maggiore (sede Arona), Lago di Garda (sede Desenzano del Garda), Lago di Como (sede Como).",
            "<strong>Sede della Direzione Generale:</strong> <strong>Milano, Via Ludovico Ariosto n. 21</strong>."
        ],
        "body_text": "La Gestione Governativa Navigazione Laghi (GGNL) è un organo dello Stato dipendente dal MIT, preposto alla gestione in concessione dei servizi di linea lacustri sui tre maggiori laghi subalpini italiani. La legge 614/1957 ne disciplina l'ordinamento, la nomina del Gestore Governativo per 5 anni (rinnovabile una volta), la contabilità di Stato, il bilancio annuale sottoposto ad approvazione ministeriale e il regime patrimoniale dei beni della navigazione.",
        "traps": [
            "Attenzione ai quiz: l'ente NON dipende dal Ministero del Turismo o dalle Regioni, ma dal MIT.",
            "TRAPPOLA CRITICA SULLA DURATA DEL GESTORE: Nel testo storico originario non c'era scadenza (era a tempo indeterminato), MA con la modifica introdotta dal D.L. 198/2022 convertito con L. 14/2023 (nota 6 Normattiva), la durata è espressamente di <strong>5 ANNI RINNOVABILE PER UNA SOLA VOLTA</strong>. Nei quiz attuali la risposta corretta è 5 anni rinnovabile una sola volta!"
        ],
        "dispensa_html": "docs/controllo/dispense_navisuite/01_Ordinamento_GGNL_Legge_614.html",
        "pdf_link": "docs/controllo/01_Normativa_GGNL_e_Trasporti/LEGGE 18 luglio 1957, n. 614.pdf",
        "pdf_name": "Testo Ufficiale Legge 614/1957"
    },
    {
        "id": "regolamento",
        "num": "MODULO 2",
        "title": "Regolamento di Esercizio GGNL (Edizione 2004)",
        "ref": "Approvato dal MIT nota NI/1716 del 09/11/2004",
        "color": "var(--cyan)",
        "icon": "⚓",
        "key_points": [
            "<strong>Pubblicità del Regolamento:</strong> È reso pubblico mediante affissione <strong>a bordo delle navi</strong> della flotta.",
            "<strong>Gerarchia di Bordo:</strong> 1° <strong>Comandante</strong>, 2° <strong>Timoniere</strong>, 3° <strong>Motorista o Macchinista</strong>, 4° <strong>Marinaio</strong>.",
            "<strong>Imbarco navi affiancate:</strong> Ammesso solo <strong>in via eccezionale</strong> con passerella metallica a due sponde vigilata da un componente di ciascun equipaggio.",
            "<strong>Rapporto di Corsa:</strong> Deve pervenire agli uffici di esercizio entro le <strong>24 ore successive</strong> al servizio.",
            "<strong>Telefoni personali:</strong> I telefoni aziendali sono solo per servizio; i cellulari personali vanno usati al minimo indispensabile, mai davanti al pubblico.",
            "<strong>Prove di addestramento:</strong> Recupero uomo in mare, incendio a bordo, falla o via d'acqua, abbandono nave, avaria grave al timone e sbandamento."
        ],
        "body_text": "Il Regolamento di Esercizio 2004 definisce le condizioni generali di trasporto e le norme comportamentali per l'equipaggio, il personale di terra e i viaggiatori. Regola l'ammissione dei passeggeri, il trasporto di animali (cani con guinzaglio e museruola, tariffe 1.50/3.50 con gratuità per cani guida e piccola taglia), le merci e le precedenze di imbarco.",
        "traps": [
            "Nella gerarchia di bordo il Timoniere precede il Motorista.",
            "Il termine di trasmissione del rapporto di corsa è di 24 ore (non 48 ore né fine mese)."
        ],
        "dispensa_html": "docs/controllo/dispense_navisuite/02_Regolamento_Esercizio_2004.html",
        "pdf_link": "docs/controllo/01_Normativa_GGNL_e_Trasporti/Regolamento_di_Esercizio_2004.pdf",
        "pdf_name": "Regolamento di Esercizio 2004"
    },
    {
        "id": "polizia",
        "num": "MODULO 3",
        "title": "Polizia, Sicurezza e Regolarità dei Trasporti (D.P.R. 753/1980)",
        "ref": "D.P.R. 11 luglio 1980, n. 753",
        "color": "var(--amber)",
        "icon": "🛡️",
        "key_points": [
            "<strong>Qualifica Giuridica Controllori:</strong> Il personale ispettivo e di vigilanza nell'esercizio delle funzioni riveste la qualifica di <strong>pubblico ufficiale o incaricato di pubblico servizio con funzioni di polizia amministrativa</strong>.",
            "<strong>Poteri di Accertamento:</strong> Facoltà di richiedere le generalità e i documenti, redigere verbali di contestazione a carico degli utenti inadempienti.",
            "<strong>Mancanza Titolo di Viaggio:</strong> Il viaggiatore non munito di biglietto è tenuto al pagamento del costo del biglietto a tariffa ordinaria + <strong>sanzione/soprattassa amministrativa</strong>.",
            "<strong>Divieti a Bordo:</strong> Divieto di salire o scendere con battello in movimento, divieto di oltrepassare i parapetti o sporgersi oltre le paratie, rispetto dei segnali di sicurezza."
        ],
        "body_text": "Il D.P.R. 753/1980 detta le norme di sicurezza e regolarità applicabili ai trasporti ferroviari e assimilati, inclusa la navigazione interna di linea. Conferisce agli agenti aziendali preposti poteri autoritativi di verbalizzazione e disciplina gli obblighi a tutela dell'incolumità pubblica e della regolarità delle corse.",
        "traps": [
            "I controllori nei trasporti pubblici NON sono 'semplici impiegati': le loro dichiarazioni e verbali hanno fede privilegiata fino a querela di falso."
        ],
        "dispensa_html": "docs/controllo/dispense_navisuite/03_Polizia_e_Sicurezza_DPR_753.html",
        "pdf_link": "docs/controllo/01_Normativa_GGNL_e_Trasporti/DPR_753_1980_Polizia_Sicurezza_Trasporti.pdf",
        "pdf_name": "Testo D.P.R. 753/1980"
    },
    {
        "id": "diritti",
        "num": "MODULO 4",
        "title": "Diritti dei Passeggeri e PMR (Regolamento UE 1177/2010)",
        "ref": "Regolamento (UE) n. 1177/2010 · D.P.C.M. 30/12/1998 (Carta Servizi)",
        "color": "var(--green)",
        "icon": "♿",
        "key_points": [
            "<strong>Preavviso Passeggeri a Mobilità Ridotta (PMR):</strong> La richiesta di assistenza va inoltrata almeno <strong>48 ore prima</strong> della partenza.",
            "<strong>Gratuità dell'Assistenza:</strong> L'assistenza nei porti, pontili e a bordo nave è <strong>completamente gratuita</strong> per il passeggero disabile o PMR.",
            "<strong>Ritardo superiore a 90 minuti o Cancellazione:</strong> Obbligo di offrire <strong>bevande e spuntini/pasti gratuiti</strong> in misura ragionevole all'attesa; diritto a percorso alternativo o rimborso del biglietto.",
            "<strong>Organismo Nazionale di Vigilanza in Italia:</strong> <strong>ART (Autorità di Regolazione dei Trasporti)</strong>.",
            "<strong>Principi della Carta dei Servizi:</strong> Eguaglianza, imparzialità, continuità, diritto di scelta, partecipazione, efficienza ed efficacia."
        ],
        "body_text": "Il Regolamento UE 1177/2010 tutela i passeggeri che viaggiano via mare e su vie d'acqua interne. Riconosce diritti inderogabili di informazione, indennizzo per ritardi prolungati e massima accessibilità per persone con disabilità o ridotta mobilità. La Carta dei Servizi (DPCM 30/12/1998) fissa gli standard qualitativi aziendali.",
        "traps": [
            "Il preavviso PMR standard è 48 ore (non 24 ore e non 7 giorni).",
            "La soglia per l'assistenza pasti e bevande in caso di ritardo alla partenza è 90 minuti."
        ],
        "dispensa_html": "docs/controllo/dispense_navisuite/04_Carta_Servizi_e_Diritti_PMR_Reg_1177.html",
        "pdf_link": "docs/controllo/01_Normativa_GGNL_e_Trasporti/Regolamento_UE_1177_2010_Diritti_Passeggeri.pdf",
        "pdf_name": "Regolamento UE 1177/2010"
    },
    {
        "id": "iva_tariffe",
        "num": "MODULO 5",
        "title": "Tariffe, Bigliettazione, Disciplina IVA 10% e Registri Corrispettivi",
        "ref": "D.P.R. 633/1972 · D.M. Finanze 30/06/1992 · D.M. MIT 255/2016 · Legge 14/1965",
        "color": "var(--violet)",
        "icon": "💶",
        "key_points": [
            "<strong>Aliquota IVA Trasporto Passeggeri:</strong> <strong>10%</strong> (aliquota ridotta Tabella A, parte III, DPR 633/72).",
            "<strong>Formula di Scorporo IVA 10%:</strong> <code>Imponibile = Totale Lordo / 1,10</code> · <code>IVA = Totale Lordo - Imponibile</code>.",
            "<strong>Valenza Fiscale del Biglietto:</strong> Ai sensi del D.M. 30/06/1992, il biglietto di trasporto sostituisce lo scontrino fiscale.",
            "<strong>Esonero Obbligo Fattura (Art. 22 DPR 633/72):</strong> Per il trasporto persone non è obbligatorio emettere fattura, salvo richiesta preventiva espressa del cliente.",
            "<strong>Registro Corrispettivi (Art. 24 DPR 633/72):</strong> Le somme giornaliere vanno annotate <strong>entro il primo giorno non festivo successivo</strong>.",
            "<strong>Assuntorie (Legge 14/1965):</strong> Gestione affidata a terzi per scali/fermate, vendita titoli di viaggio con rendiconto periodico.",
            "<strong>Scontrino POS:</strong> Certifica il pagamento bancario, ma NON sostituisce il biglietto di viaggio né il documento fiscale."
        ],
        "body_text": "L'Operatore dell'Ufficio Controllo verifica la corretta concordanza tra i biglietti staccati dalle biglietterie/emettitrici automatiche/assuntori e gli incassi versati (contanti e pagamenti POS/elettronici). Gestisce la tenuta dei registri corrispettivi ex art. 24 del DPR 633/1972 distinguendo per aliquota e sede di servizio.",
        "traps": [
            "Il biglietto al pubblico include già l'IVA al 10%: su 22 € l'imponibile è 20 € e l'IVA è 2 € (non il 10% sottratto a ritroso!).",
            "Il POS non è il biglietto: senza il titolo di viaggio emesso dal sistema di bigliettazione il viaggiatore è irregolare."
        ],
        "dispensa_html": "docs/controllo/dispense_navisuite/05_Tariffe_Biglietti_IVA_Registri_Corrispettivi.html",
        "pdf_link": "docs/controllo/02_Tariffe_Biglietti_IVA_Pagamenti/DISPENSA_IVA_REGISTRI_E_PAGAMENTI.md",
        "pdf_name": "Dispensa IVA e Registri MD"
    },
    {
        "id": "assuntorie",
        "num": "MODULO 6",
        "title": "Regolamentazione delle Assuntorie (Legge 14/1965)",
        "ref": "Legge 3 febbraio 1965, n. 14",
        "color": "var(--orange)",
        "icon": "🏪",
        "key_points": [
            "<strong>Regime delle Assuntorie:</strong> Gestione convenzionata a terzi (assuntori) per scali o fermate secondarie e stagionali.",
            "<strong>Compiti dell'Assuntore:</strong> Vendita titoli di viaggio, custodia del pontile, esposizione orari e ormeggio battelli.",
            "<strong>Rendicontazione all'Ufficio Controllo:</strong> Compilazione della distinta periodica con numerazione iniziale e finale dei biglietti staccati.",
            "<strong>Aggio e Versamenti:</strong> Riconoscimento dell'aggio contrattuale pattuito e versamento del netto sul c/c della GGNL."
        ],
        "body_text": "La Legge 14/1965 regola il rapporto contrattuale delle assuntorie. L'Ufficio Controllo effettua il carico delle matricole di biglietti, il controllo dei bollettari e la verifica della puntualità dei versamenti periodici da parte di ciascun assuntore convenzionato.",
        "traps": [
            "L'assuntore non è un dipendente di ruolo GGNL ma un gestore convenzionato ex L. 14/1965.",
            "L'assuntore deve applicare rigorosamente le tariffe ufficiali GGNL senza alcuna discrezionalità."
        ],
        "dispensa_html": "docs/controllo/dispense_navisuite/06_Assuntorie_Legge_14_1965.html",
        "pdf_link": "docs/controllo/01_Normativa_GGNL_e_Trasporti/Legge_14_1965_Assuntorie.pdf",
        "pdf_name": "Testo Legge 14/1965"
    },
    {
        "id": "personale",
        "num": "MODULO 7",
        "title": "Stato Giuridico Autoferrotranviari (R.D. 148/1931) & Codice Etico",
        "ref": "R.D. 8 gennaio 1931, n. 148 · CCNL · D.P.R. 81/2023 · Codice Etico GGNL",
        "color": "var(--rose)",
        "icon": "⚖️",
        "key_points": [
            "<strong>Statuto di Categoria:</strong> R.D. 8 gennaio 1931, n. 148 (Allegato A) e CCNL Autoferrotranviari.",
            "<strong>Periodo di Prova:</strong> Massimo <strong>1 anno di servizio effettivo</strong> per tramvie e navigazione interna (art. 13 R.D. 148/31).",
            "<strong>Sanzione di Richiamo:</strong> La <strong>Censura</strong> è una punizione scritta che ha specifica funzione di richiamo preliminare per mancanze lievi.",
            "<strong>Pena Accessoria:</strong> Il <strong>trasloco punitivo</strong> è previsto espressamente come punizione accessoria (art. 37).",
            "<strong>Dimissioni Volontarie:</strong> Hanno effetto <strong>solo dopo essere state accettate per iscritto dall'azienda</strong> (art. 30).",
            "<strong>Concorso di Mancanze (Art. 48):</strong> Si applica la sanzione prevista per la <strong>mancanza più grave</strong>.",
            "<strong>Regalie e Regali (DPR 81/2023):</strong> Divieto generale; ammessi solo quelli d'uso di modico valore (indicativamente <strong>non oltre 100 euro</strong>).",
            "<strong>Social Media:</strong> Divieto di post o dichiarazioni che ledano l'immagine, la reputazione o la credibilità della GGNL."
        ],
        "body_text": "Il R.D. 148/1931 costituisce la legge speciale che disciplina il personale della navigazione interna. Comprende la classificazione del personale, i doveri verso l'azienda e l'utenza, e le garanzie procedimentali in caso di sanzioni disciplinari (censura, multa, sospensione, retrocessione, destituzione). Il D.P.R. 81/2023 integra le regole di integrità e condotta.",
        "traps": [
            "Nel R.D. 148/1931 la prova non può superare 1 anno per la navigazione (mentre nelle ferrovie è 2 anni).",
            "Le dimissioni non sono immediate: richiedono l'accettazione formale dell'amministrazione."
        ],
        "dispensa_html": "docs/controllo/dispense_navisuite/07_Stato_Giuridico_Autoferrotranviari_RD_148.html",
        "pdf_link": "docs/controllo/03_Stato_Giuridico_e_Codice_Comportamento/Codice_Etico_GGNL_Allegato_A.pdf",
        "pdf_name": "Codice Etico GGNL Allegato A"
    },
    {
        "id": "privacy",
        "num": "MODULO 8",
        "title": "Gestione Elettronica Documentale (DPCM 3/12/2013) & Privacy GDPR",
        "ref": "D.P.C.M. 3 dicembre 2013 · Regolamento (UE) 2016/679 (GDPR)",
        "color": "var(--teal)",
        "icon": "📂",
        "key_points": [
            "<strong>Segnatura di Protocollo:</strong> Associazione univoca e immodificabile di: <strong>numero progressivo, data/ora, mittente, destinatario, oggetto</strong> e impronta hash.",
            "<strong>Registro Giornaliero:</strong> Il registro di protocollo informatico è bloccato e non modificabile retroattivamente a tutela della pubblica fede.",
            "<strong>Titolare del Trattamento:</strong> <strong>Gestione Governativa Navigazione Laghi</strong> (rappresentata dal Gestore Governativo).",
            "<strong>DPO / RPD:</strong> Responsabile della Protezione dei Dati, collocato presso la Direzione Generale a Milano.",
            "<strong>Diritti dell'Interessato:</strong> Accesso (art. 15), rettifica (art. 16), cancellazione / <strong>diritto all'oblio</strong> (art. 17), limitazione e opposizione."
        ],
        "body_text": "Il DPCM 3/12/2013 fissa le regole tecniche del Codice dell'Amministrazione Digitale (CAD) per formare, protocollare, fascicolare e conservare nel tempo i documenti informatici senza perdita di autenticità. Il GDPR garantisce la protezione dei dati dei passeggeri (bigliettazione nominativa, abbonamenti) e dei dipendenti.",
        "traps": [
            "Il Titolare del trattamento non è il singolo impiegato o direttore, ma l'ente GGNL.",
            "La segnatura di protocollo non può mai essere riutilizzata o azzerata arbitrariamente durante l'anno."
        ],
        "dispensa_html": "docs/controllo/dispense_navisuite/09_Protocollo_Informatico_DPCM_2013_e_Privacy_GDPR.html",
        "pdf_link": "docs/controllo/04_Gestione_Documentale_e_Privacy/DPCM_3_12_2013_Gestione_Documentale.pdf",
        "pdf_name": "D.P.C.M. 3/12/2013 Protocollo"
    },
    {
        "id": "geografia",
        "num": "MODULO 9",
        "title": "Aspetti Geografici dei Laghi (Garda, Como, Maggiore)",
        "ref": "Morfologia, bacini, scali, traghetti autoveicoli e venti termici",
        "color": "var(--cyan)",
        "icon": "🗺️",
        "key_points": [
            "<strong>Lago di Garda (Benaco):</strong> Il più esteso d'Italia (~370 km²). Immissario: <strong>fiume Sarca</strong> (a nord); Unico Emissario: <strong>fiume Mincio</strong> (esce a Peschiera del Garda). Traghetti auto: <strong>Maderno - Torri del Benaco</strong> (tutto l'anno), Limone - Malcesine (estivo). Venti: <strong>Pelèr</strong> (nord, mattino), <strong>Ora</strong> (sud, pomeriggio), <strong>Ander</strong> (sud-ovest).",
            "<strong>Lago di Como (Lario):</strong> Più profondo d'Italia (<strong>418 metri</strong> tra Argegno e Nesso). Forma a 'Y' rovesciata con centro a <strong>Bellagio</strong>. Emissario: <strong>fiume Adda</strong> (ramo di Lecco). Traghetto centro lago: Bellagio, Varenna, Menaggio, Cadenabbia. Venti: <strong>Tivano</strong> (nord-est mattino), <strong>Breva</strong> (sud pomeriggio).",
            "<strong>Lago Maggiore (Verbano):</strong> Secondo per superficie (~212 km²). Immissario ed emissario: <strong>fiume Ticino</strong> (esce a Sesto Calende). Isole Borromee (Bella, Madre, Pescatori). Traghetto auto annuale: <strong>Intra (VB) - Laveno (VA)</strong>."
        ],
        "body_text": "La conoscenza degli approdi, dei collegamenti traghetto veicoli e dei confini amministrativi dei tre laghi (Garda: Lombardia, Veneto, Trentino; Maggiore: Piemonte, Lombardia, Svizzera; Como: Lombardia) è fondamentale per l'Operatore di Ufficio per la gestione delle tariffe a zone, delle relazioni di traffico e delle statistiche.",
        "traps": [
            "L'emissario del Garda è il Mincio (il Sarca è l'immissario!).",
            "Il lago più profondo d'Italia è Como (418 m), non il Garda e non il Maggiore."
        ],
        "dispensa_html": "docs/controllo/dispense_navisuite/10_Geografia_dei_Tre_Laghi.html",
        "pdf_link": "docs/controllo/05_Geografia_dei_Laghi/DISPENSA_GEOGRAFIA_LAGHI.md",
        "pdf_name": "Dispensa Geografia dei Laghi"
    },
    {
        "id": "informatica_inglese",
        "num": "MODULO 10",
        "title": "Informatica d'Ufficio (Excel, PEC) & Lingua Inglese",
        "ref": "Pacchetto Office · AgID PEC · Glossario dei Trasporti",
        "color": "var(--amber)",
        "icon": "💻",
        "key_points": [
            "<strong>Excel - Riferimento Assoluto:</strong> Blocco cella col dollaro (es. <code>$A$1</code>).",
            "<strong>Excel - Formule Chiave:</strong> <code>=CERCA.VERT()</code> per estrazione dati da matrici; <code>=SOMMA.SE()</code>; <code>=SE()</code>; tabelle pivot per aggregazione incassi.",
            "<strong>PEC - Ricevuta di Consegna:</strong> È emessa dal <strong>gestore del destinatario</strong> ed è l'unica che certifica con valore legale l'avvenuto recapito.",
            "<strong>Email - CCN:</strong> Copia Conoscenza Nascosta per non mostrare gli indirizzi ai destinatari (obbligo GDPR).",
            "<strong>Inglese - Titoli di Viaggio:</strong> <em>One-way ticket</em> (corsa semplice), <em>Round-trip / Return ticket</em> (andata e ritorno), <em>Daily pass</em> (libera circolazione giornaliera), <em>Car ferry</em> (traghetto autoveicoli), <em>PRM</em> (Persone a Mobilità Ridotta)."
        ],
        "body_text": "L'Operatore di Ufficio Controllo utilizza quotidianamente fogli di calcolo Excel per la quadratura delle casse, la verifica delle matricole dei biglietti e l'elaborazione di report statistici, interfacciandosi via PEC con enti esterni e fornendo assistenza in lingua inglese ai viaggiatori stranieri.",
        "traps": [
            "La ricevuta di accettazione prova solo l'invio: il perfezionamento della notifica PEC richiede la ricevuta di avvenuta consegna.",
            "Nel campo CCN gli indirizzi rimangono segreti (mentre in CC sono visibili a tutti)."
        ],
        "dispensa_html": "docs/controllo/dispense_navisuite/11_Informatica_Excel_PEC_e_Inglese.html",
        "pdf_link": "docs/controllo/06_Informatica_e_Inglese/DISPENSA_INFORMATICA_E_INGLESE.md",
        "pdf_name": "Dispensa Informatica & Inglese"
    }
]

print("modules_data aggiornato con dispensa_html.")
