# -*- coding: utf-8 -*-
import os
import json

workspace_dir = r"C:\Users\Marco\.gemini\antigravity\worktrees\NaviSuite\leggi_bando_concorso"
dispense_dir = os.path.join(workspace_dir, "docs", "controllo", "dispense_navisuite")
os.makedirs(dispense_dir, exist_ok=True)

# Lista completa e dettagliata dei 11 documenti
dispense_data = [
    {
        "file": "01_Ordinamento_GGNL_Legge_614.html",
        "num": "DISPENSA 01",
        "title": "Ordinamento della GGNL e Legge 18 luglio 1957, n. 614",
        "subtitle": "Natura giuridica, vigilanza del MIT, Gestore Governativo, bilancio e articolazione dei tre laghi",
        "color": "var(--teal)",
        "icon": "🏛️",
        "key_facts": [
            ("Anno istitutivo", "1957 (Legge 18 luglio 1957, n. 614)"),
            ("Ministero vigilante", "Ministero delle Infrastrutture e dei Trasporti (MIT)"),
            ("Organo di vertice", "Gestore Governativo (nominato con Decreto MIT)"),
            ("Durata incarico", "5 anni, rinnovabile per una sola volta (Art. 1 c. 1 L. 614/57 modif. L. 14/2023)"),
            ("Sede Direzione Generale", "Milano, Via Ludovico Ariosto n. 21"),
            ("Direzioni di Esercizio", "Arona (NO), Como (CO), Desenzano del Garda (BS)")
        ],
        "sections": [
            {
                "title": "1. Inquadramento Giuridico e Finalità",
                "content": """
                La <strong>Gestione Governativa dei Servizi Pubblici di Navigazione di Linea sui Laghi Maggiore, di Garda e di Como (G.G.N.L.)</strong> è un organo dello Stato operante in regime di gestione diretta ministeriale ai sensi della <strong>Legge 18 luglio 1957, n. 614</strong>.<br><br>
                L'ente è stato istituito per garantire la continuità territoriale, la mobilità dei residenti, il trasporto scolastico e pendolare, nonché per valorizzare lo sviluppo turistico ed economico dei tre maggiori bacini lacustri del Nord Italia. L'amministrazione opera sotto l'alta vigilanza del <strong>Ministero delle Infrastrutture e dei Trasporti (MIT)</strong>.
                """
            },
            {
                "title": "2. Il Gestore Governativo e le sue Competenze",
                "content": """
                Al vertice dell'ente è posto il <strong>Gestore Governativo</strong>, nominato con apposito Decreto del Ministro delle Infrastrutture e dei Trasporti.<br>
                Ai sensi dell'art. 1 della L. 614/1957 (come aggiornato dal D.L. 198/2022 convertito con L. 14/2023):
                <ul>
                  <li>Il Gestore Governativo ha la rappresentanza legale dell'ente ed esercita i poteri di amministrazione ordinaria e straordinaria;</li>
                  <li><strong>Durata dell'incarico:</strong> la nomina è espressamente <strong>per un periodo di cinque anni rinnovabile per una sola volta</strong> (nel testo storico del 1957 non c'era scadenza e la nomina era a tempo indeterminato; la riforma del 2023 ha introdotto il limite quinquennale con un solo rinnovo);</li>
                  <li><strong>Trattamento economico:</strong> al Gestore si applica il tetto stipendiale pubblico fissato dall'art. 23-ter, comma 1, del D.L. 201/2011;</li>
                  <li>Il Gestore adotta i regolamenti interni, approva le delibere a contrarre, delibera l'indizione dei concorsi pubblici (come la Determina DG n. C162 per Operatore di Ufficio) e stipula i contratti di lavoro del personale.</li>
                </ul>
                """
            },
            {
                "title": "3. Struttura Organizzativa e Direzioni di Esercizio",
                "content": """
                L'articolazione della Navigazione Laghi si suddivide in una sede centrale e tre direzioni territoriali periferiche:
                <ul>
                  <li><strong>Direzione Generale:</strong> situata a <strong>Milano, Via Ludovico Ariosto 21</strong>. Coordina le Risorse Umane, gli Affari Legali, i Sistemi Informativi, gli Acquisti e la Programmazione Finanziaria;</li>
                  <li><strong>Direzione di Esercizio Lago Maggiore:</strong> sede a <strong>Arona (NO)</strong> (Piemonte/Lombardia/Canton Ticino);</li>
                  <li><strong>Direzione di Esercizio Lago di Como:</strong> sede a <strong>Como (CO)</strong> (Lombardia);</li>
                  <li><strong>Direzione di Esercizio Lago di Garda:</strong> sede a <strong>Desenzano del Garda (BS)</strong> (Lombardia/Veneto/Trentino).</li>
                </ul>
                Ciascuna Direzione di Esercizio dispone di un <em>Cantiere Navale</em> per la manutenzione della flotta (es. cantiere di Peschiera del Garda per Navigarda, Tavernola per Navicomo, Arona per Navimaggiore).
                """
            },
            {
                "title": "4. Bilancio, Contabilità e Rendicontazione",
                "content": """
                La gestione finanziaria della GGNL segue le regole della <strong>contabilità pubblica</strong>:
                <ul>
                  <li>Il bilancio di previsione e il conto consuntivo sono deliberati dal Gestore Governativo e sottoposti all'approvazione formale del Ministero delle Infrastrutture e dei Trasporti di concerto con il Ministero dell'Economia e delle Finanze (MEF);</li>
                  <li>Il controllo della gestione economica e patrimoniale è affidato a un <em>Collegio dei Revisori dei Conti</em> nominato con decreto ministeriale;</li>
                  <li>I ricavi derivanti dal traffico (bigliettazione, abbonamenti, noleggi) concorrono al pareggio di bilancio insieme ai contributi d'esercizio erogati dallo Stato per gli obblighi di servizio pubblico (OSP).</li>
                </ul>
                """
            }
        ],
        "traps": [
            "La GGNL NON è una società privata né una municipalizzata: è un organo statale in gestione governativa.",
            "TRAPPOLA CRITICA: Il Gestore Governativo dura 5 ANNI RINNOVABILE PER UNA SOLA VOLTA (Art. 1 L. 614/1957 aggiornato con L. 14/2023). Nei quiz non scegliere 'a tempo indeterminato'!",
            "La sede legale della Direzione Generale è a Milano, non a Roma né a Desenzano."
        ],
        "quiz_samples": [
            {
                "q": "In base all'Art. 1 della Legge 18 luglio 1957 n. 614 (testo vigente), per quale periodo è nominato il Gestore Governativo?",
                "a": "Per un periodo di 5 anni, rinnovabile per una sola volta",
                "source": "L. 614/1957 Art. 1 c. 1 (modificato da L. 14/2023)"
            },
            {
                "q": "Quale Ministero esercita la vigilanza sulla Gestione Governativa Navigazione Laghi?",
                "a": "Ministero delle Infrastrutture e dei Trasporti (MIT)",
                "source": "Quesito Ufficiale Prova Concorso CE 130"
            }
        ]
    },
    {
        "file": "02_Regolamento_Esercizio_2004.html",
        "num": "DISPENSA 02",
        "title": "Regolamento di Esercizio GGNL (Edizione 2004)",
        "subtitle": "Doveri del personale, gerarchia di bordo, sicurezza della navigazione, imbarco navi affiancate, trasporto bagagli e animali",
        "color": "var(--cyan)",
        "icon": "⚓",
        "key_facts": [
            ("Approvazione", "Ministero Infrastrutture e Trasporti nota NI/1716 del 09/11/2004"),
            ("Pubblicità", "Reso pubblico mediante affissione a bordo delle navi della flotta"),
            ("Gerarchia di bordo", "1° Comandante · 2° Timoniere · 3° Motorista/Macchinista · 4° Marinaio"),
            ("Rapporto di corsa", "Invio obbligatorio entro le 24 ore successive al servizio"),
            ("Navi affiancate", "Ammesso solo eccezionalmente con passerella metallica a 2 sponde vigilata"),
            ("Telefoni personali", "Uso vietato o ridotto al minimo indispensabile, mai in presenza di pubblico")
        ],
        "sections": [
            {
                "title": "1. Struttura del Regolamento e Pubblicità",
                "content": """
                Il <strong>Regolamento di Esercizio (Edizione 2004)</strong> disciplina in maniera vincolante lo svolgimento del servizio pubblico di linea lacustre. È stato approvato dal MIT con nota NI/1716 del 9 novembre 2004.<br><br>
                <strong>Obbligo di Pubblicità:</strong> il regolamento è portato a conoscenza dell'utenza e dell'equipaggio mediante affissione di estratti ben visibili <strong>a bordo di tutte le unità navali</strong> della flotta e presso le biglietterie di scalo.
                """
            },
            {
                "title": "2. La Gerarchia e i Ruoli di Bordo",
                "content": """
                A bordo di ciascuna nave, l'equipaggio opera secondo una precisa subordinazione gerarchica codificata dall'art. 8:
                <ol>
                  <li><strong>Comandante:</strong> massima autorità a bordo; responsabile della sicurezza della nave, dell'equipaggio, dei passeggeri e del carico. Decide sulla navigabilità in caso di maltempo e dirige ogni manovra;</li>
                  <li><strong>Timoniere:</strong> collabora col Comandante alla condotta della navigazione e lo sostituisce in caso di impedimento temporaneo;</li>
                  <li><strong>Motorista o Macchinista:</strong> responsabile della propulsione, dei motori termici, degli impianti idraulici, elettrici e dei livelli carburante/olio;</li>
                  <li><strong>Marinaio:</strong> provvede all'ormeggio, al disormeggio, alla manovra delle passerelle di imbarco/sbarco passeggeri e veicoli, alla guardia di coperta e al decoro dell'unità.</li>
                </ol>
                """
            },
            {
                "title": "3. Condizioni Speciali di Manovra e Rapporto di Corsa",
                "content": """
                <ul>
                  <li><strong>Imbarco e Sbarco con Navi Affiancate:</strong> di norma è vietato; è consentito solo in via <em>eccezionale</em> previa autorizzazione, utilizzando un'apposita passerella metallica munita di doppie sponde laterali protette, vigilata costantemente da almeno un componente di ciascun equipaggio;</li>
                  <li><strong>Rapporto di Corsa:</strong> documento compilato dal personale di bordo al termine di ogni turno; deve pervenire agli uffici di esercizio entro il termine tassativo di <strong>24 ore</strong> dal completamento della corsa, segnalando orari effettivi, ritardi, passeggeri trasportati ed eventuali avarie;</li>
                  <li><strong>Uso dei Telefoni Cellulari:</strong> i telefoni aziendali possono essere usati esclusivamente per comunicazioni di servizio; i cellulari personali sono vietati durante le manovre e devono essere limitati allo stretto indispensabile, mai in vista del pubblico.</li>
                </ul>
                """
            },
            {
                "title": "4. Esercitazioni Periodiche di Sicurezza",
                "content": """
                L'equipaggio deve sottoporsi ad addestramenti periodici obbligatori sulle seguenti emergenze:
                <ul>
                  <li>Recupero uomo in mare;</li>
                  <li>Incendio grave a bordo (impiego estintori CO2, polvere, schiuma e manichette);</li>
                  <li>Falla o via d'acqua e manovra delle pompe di esaurimento;</li>
                  <li>Abbandono nave con calo dei mezzi collettivi di salvataggio (zattere autogonfiabili);</li>
                  <li>Avaria al timone e sbandamento.</li>
                </ul>
                """
            }
        ],
        "traps": [
            "Nella gerarchia di bordo il Timoniere precede il Motorista/Macchinista.",
            "Il rapporto di corsa scade dopo 24 ore (non 48 ore né a fine mese).",
            "L'imbarco su navi affiancate non è ordinario ma rigorosamente eccezionale."
        ],
        "quiz_samples": [
            {
                "q": "Come è regolata la gerarchia a bordo secondo il Regolamento di Esercizio 2004?",
                "a": "Comandante, Timoniere, Motorista o Macchinista, Marinaio",
                "source": "Quesito Ufficiale CE Movimento 130"
            },
            {
                "q": "In che modo è reso pubblico il Regolamento di Esercizio?",
                "a": "A bordo delle navi della flotta",
                "source": "Quesito Ufficiale CE Movimento 130"
            }
        ]
    },
    {
        "file": "03_Polizia_e_Sicurezza_DPR_753.html",
        "num": "DISPENSA 03",
        "title": "Polizia, Sicurezza e Regolarità dei Trasporti (D.P.R. 753/1980)",
        "subtitle": "Poteri del personale ispettivo, qualifica di pubblico ufficiale, sanzioni amministrative e doveri dei viaggiatori",
        "color": "var(--amber)",
        "icon": "🛡️",
        "key_facts": [
            ("Fonte normativa", "D.P.R. 11 luglio 1980, n. 753"),
            ("Ambito applicativo", "Ferrovie, tranvie, funivie e linee di navigazione interna"),
            ("Qualifica controllori", "Pubblico ufficiale o incaricato di pubblico servizio con polizia amministrativa"),
            ("Poteri accertamento", "Richiesta documenti, contestazione immediata, redazione processo verbale"),
            ("Valore dei verbali", "Fede privilegiata fino a querela di falso per i fatti attestati"),
            ("Utente senza biglietto", "Pagamento tariffa ordinaria + sanzione amministrativa / soprattassa")
        ],
        "sections": [
            {
                "title": "1. Oggetto e Ambito del D.P.R. 753/1980",
                "content": """
                Il <strong>Decreto del Presidente della Repubblica 11 luglio 1980, n. 753</strong> reca le <em>«Nuove norme in materia di polizia, sicurezza e regolarità dell'esercizio delle ferrovie e di altri servizi di trasporto»</em>.<br><br>
                Si applica integralmente ai servizi pubblici di trasporto per vie navigabili interne svolti dalla Gestione Governativa Navigazione Laghi. Ha il duplice obiettivo di:
                <ul>
                  <li>Tutelare l'incolumità dei viaggiatori e del personale di bordo;</li>
                  <li>Assicurare il regolare svolgimento delle corse e l'esazione corretta dei proventi tariffari.</li>
                </ul>
                """
            },
            {
                "title": "2. La Qualifica Giuridica del Personale di Controllo",
                "content": """
                Il personale addetto al controllo dei titoli di viaggio e alla vigilanza degli impianti durante il servizio:
                <ul>
                  <li>Riveste la qualifica di <strong>pubblico ufficiale</strong> o di <strong>incaricato di pubblico servizio investito di funzioni di polizia amministrativa</strong> (art. 71);</li>
                  <li>Ha il potere di chiedere l'esibizione del biglietto di viaggio e del documento di riconoscimento;</li>
                  <li>In caso di rifiuto di declinare le generalità, l'agente può richiedere l'intervento della forza pubblica (Carabinieri, Polizia di Stato, Guardia di Finanza);</li>
                  <li>I verbali di accertamento redatti dal personale fanno piena prova fino a querela di falso per le constatazioni materiali compiute dall'agente.</li>
                </ul>
                """
            },
            {
                "title": "3. Irregolarità dei Titoli di Viaggio e Sanzioni",
                "content": """
                Ai sensi degli artt. 20-25 del DPR 753/1980 e dei regolamenti tariffari GGNL:
                <ul>
                  <li><strong>Mancanza di titolo di viaggio:</strong> chiunque venga trovato sprovvisto di biglietto o munito di biglietto non convalidato o non valido per la corsa è tenuto al pagamento del biglietto a tariffa ordinaria maggiorato della sanzione amministrativa stabilita;</li>
                  <li><strong>Regolarizzazione a bordo:</strong> se il passeggero si presenta spontaneamente al capobordo/controllore subito dopo l'imbarco segnalando l'impossibilità di acquisto a terra, viene applicata la tariffa ordinaria con un eventuale modesto diritto fisso di bordo, senza sanzione punitiva;</li>
                  <li><strong>Titoli contraffatti o alterati:</strong> comportano il sequestro immediato del documento e la segnalazione all'Autorità Giudiziaria per il reato di truffa o uso di atto falso.</li>
                </ul>
                """
            },
            {
                "title": "4. Norme di Comportamento e Divieti per i Passeggeri",
                "content": """
                È espressamente vietato agli utenti:
                <ul>
                  <li>Salire o scendere dal natante quando è in movimento o prima che siano state posizionate le passerelle e le catenelle di sicurezza;</li>
                  <li>Accedere nelle aree riservate all'equipaggio (plancia di comando, sala macchine, gavoni di prua/poppa);</li>
                  <li>Gettare oggetti, rifiuti o mozziconi nelle acque del lago;</li>
                  <li>Fumare all'interno dei saloni chiusi e sui ponti dove vige apposito divieto;</li>
                  <li>Accedere con armi cariche o materie esplosive/infiammabili non autorizzate.</li>
                </ul>
                """
            }
        ],
        "traps": [
            "Il controllore GGNL non è un cittadino qualunque: è un incaricato di pubblico servizio con funzioni di polizia amministrativa.",
            "Chi non ha biglietto non viene semplicemente 'fatto scendere': deve pagare biglietto + sanzione pecuniaria."
        ],
        "quiz_samples": [
            {
                "q": "Ai sensi del DPR 753/1980, gli agenti di controllo durante il servizio assumono la qualifica di:",
                "a": "Pubblico ufficiale o incaricato di pubblico servizio con compiti di polizia amministrativa",
                "source": "Quesito Simulazione Esame Ufficiale"
            }
        ]
    },
    {
        "file": "04_Carta_Servizi_e_Diritti_PMR_Reg_1177.html",
        "num": "DISPENSA 04",
        "title": "Carta dei Servizi e Diritti dei Passeggeri e PMR (Reg. UE 1177/2010)",
        "subtitle": "Standard di qualità del DPCM 30/12/1998, preavviso 48 ore PMR, assistenza gratuita, rimborsi per ritardi e vigilanza ART",
        "color": "var(--green)",
        "icon": "♿",
        "key_facts": [
            ("Normativa europea", "Regolamento (UE) n. 1177/2010 del Parlamento europeo e del Consiglio"),
            ("Carta della mobilità", "D.P.C.M. 30 dicembre 1998 e s.m.i."),
            ("Preavviso PMR", "Almeno 48 ore prima della partenza prevista"),
            ("Costo assistenza PMR", "Completamente gratuita a terra, sui pontili e a bordo nave"),
            ("Soglia ritardo pasti", "Ritardo alla partenza superiore a 90 minuti o cancellazione"),
            ("Autorità di vigilanza", "ART (Autorità di Regolazione dei Trasporti)")
        ],
        "sections": [
            {
                "title": "1. I Principi Fondamentali della Carta dei Servizi (DPCM 30/12/1998)",
                "content": """
                La <strong>Carta dei Servizi Pubblici del Settore Trasporti</strong> (detta anche Carta della Mobilità) fissa i principi inderogabili che regolano il rapporto tra GGNL e viaggiatori:
                <ul>
                  <li><strong>Eguaglianza ed Imparzialità:</strong> parità di trattamento per tutti i passeggeri, senza distinzione di nazionalità, sesso, lingua o religione; divieto di qualsiasi discriminazione tariffaria non oggettiva;</li>
                  <li><strong>Continuità del Servizio:</strong> obbligo di garantire corse regolari e continue, informando tempestivamente il pubblico di variazioni o interruzioni;</li>
                  <li><strong>Diritto di Scelta:</strong> trasparenza sulle tariffe, sulle classi di viaggio e sui percorsi alternativi;</li>
                  <li><strong>Partecipazione e Trasparenza:</strong> diritto degli utenti di inoltrare reclami, proposte e accedere alle informazioni sul servizio;</li>
                  <li><strong>Efficienza ed Efficacia:</strong> gestione ottimale delle risorse pubbliche mirata alla puntualità, pulizia e sicurezza.</li>
                </ul>
                """
            },
            {
                "title": "2. Il Regolamento Europeo n. 1177/2010",
                "content": """
                Il Regolamento UE 1177/2010 tutela i passeggeri che viaggiano su navi che effettuano servizi regolari via mare e su <strong>vie navigabili interne</strong> (laghi, fiumi, canali).<br><br>
                <strong>Ambito di applicazione:</strong> si applica alle unità con equipaggio autorizzate al trasporto di più di 12 passeggeri (tutti i battelli e traghetti GGNL).
                """
            },
            {
                "title": "3. Tutela delle Persone a Mobilità Ridotta (PMR)",
                "content": """
                Ai sensi degli articoli 6-15 del Regolamento UE 1177/2010:
                <ul>
                  <li><strong>Divieto di Rifiuto di Imbarco:</strong> i vettori non possono rifiutarsi di accettare una prenotazione o di imbarcare una persona a motivo della disabilità o ridotta mobilità, salvo motivi imperativi di sicurezza marittima stabiliti dalla legge;</li>
                  <li><strong>Assistenza Gratuita:</strong> il passeggero ha diritto all'assistenza gratuita sia negli scali/pontili sia a bordo del traghetto (imbarco, sbarco, allocazione carrozzine, sistemazione bagagli);</li>
                  <li><strong>Termine di Preavviso (48 ore):</strong> per usufruire dell'assistenza il passeggero deve notificare le proprie esigenze al vettore con almeno <strong>48 ore di anticipo</strong> rispetto all'orario di partenza, presentandosi al punto di ritrovo dello scalo almeno 60 minuti prima (o entro l'orario concordato);</li>
                  <li><strong>Cani Guida:</strong> i cani da assistenza viaggiano gratuitamente al fianco dell'utente non vedente su tutte le navi senza obbligo di museruola costante, purché idoneamente identificati.</li>
                </ul>
                """
            },
            {
                "title": "4. Diritti in Caso di Cancellazione o Ritardo Prolungato",
                "content": """
                In caso di cancellazione o partenza ritardata di <strong>oltre 90 minuti</strong> rispetto all'orario pubblicato:
                <ul>
                  <li><strong>Assistenza Immediata:</strong> distribuzione gratuita di bevande, snack o pasti adeguati al tempo di attesa, ove disponibili o ragionevolmente reperibili;</li>
                  <li><strong>Diritto di Scelta:</strong> il passeggero può scegliere tra il <em>trasporto alternativo</em> verso la destinazione finale non appena possibile senza sovrapprezzo, oppure il <em>rimborso integrale del biglietto</em> entro 7 giorni per la parte di viaggio non effettuata;</li>
                  <li><strong>Alloggio:</strong> ove il ritardo imponga un pernottamento non programmato, il vettore assicura una sistemazione alberghiera adeguata (fino a un massimo di 80 € a notte per passeggero, per max 3 notti, salvo eventi meteorologici eccezionali che mettano a rischio la navigazione).</li>
                </ul>
                """
            },
            {
                "title": "5. L'Autorità di Vigilanza in Italia: ART",
                "content": """
                L'<strong>Autorità di Regolazione dei Trasporti (ART)</strong> con sede a Torino è designata dallo Stato italiano come Organismo Nazionale Indipendente responsabile dell'applicazione del Regolamento UE 1177/2010. Raccoglie i reclami di seconda istanza e applica le sanzioni pecuniarie ai vettori inadempienti.
                """
            }
        ],
        "traps": [
            "Il preavviso PMR standard è 48 ore (non 12 né 24 ore).",
            "La soglia per l'offerta di pasti e bevande gratuite scatta oltre i 90 minuti di ritardo alla partenza.",
            "L'autorità di vigilanza è l'ART (non la Guardia Costiera né l'ENAC)."
        ],
        "quiz_samples": [
            {
                "q": "Con quale preavviso minimo il passeggero PMR deve richiedere l'assistenza al vettore?",
                "a": "Almeno 48 ore prima della partenza",
                "source": "Quesito Ufficiale Simulazione Esame"
            },
            {
                "q": "Quale autorità nazionale è competente per la vigilanza sul Regolamento UE 1177/2010?",
                "a": "L'Autorità di Regolazione dei Trasporti (ART)",
                "source": "Quesito Ufficiale Simulazione Esame"
            }
        ]
    },
    {
        "file": "05_Tariffe_Biglietti_IVA_Registri_Corrispettivi.html",
        "num": "DISPENSA 05",
        "title": "Tariffe, Biglietto Fiscale, IVA 10% e Registri dei Corrispettivi",
        "subtitle": "D.M. Finanze 30/06/1992, D.M. MIT 255/2016, formula di scorporo IVA, art. 22 e 24 DPR 633/1972, chiusure POS e quadratura cassa",
        "color": "var(--violet)",
        "icon": "💶",
        "key_facts": [
            ("Aliquota IVA trasporto", "10% (aliquota ridotta Tabella A, parte III, DPR 633/1972)"),
            ("Formula di scorporo", "Imponibile = Prezzo Lordo / 1,10 · Imposta IVA = Prezzo Lordo - Imponibile"),
            ("Valenza fiscale biglietto", "Sostituisce lo scontrino fiscale ai sensi del D.M. Finanze 30/06/1992"),
            ("Esonero fattura (art. 22)", "Non obbligatoria per trasporto persone salvo richiesta del cliente all'atto dell'acquisto"),
            ("Termine registro corrispettivi", "Entro il primo giorno non festivo successivo a quello di incasso (art. 24)"),
            ("Scontrino POS", "Certifica solo il pagamento bancario, non sostituisce il biglietto né vale fiscalmente")
        ],
        "sections": [
            {
                "title": "1. L'I.V.A. nel Trasporto Passeggeri su Vie d'Acqua Interne",
                "content": """
                Ai sensi del <strong>D.P.R. 26 ottobre 1972, n. 633</strong> (Legge IVA):
                <ul>
                  <li>Le prestazioni di trasporto pubblico di persone e dei relativi bagagli al seguito effettuate su laghi e fiumi sono assoggettate ad <strong>aliquota IVA ridotta del 10%</strong> (Tabella A, Parte III, punto 127-novies);</li>
                  <li>Il prezzo del biglietto esposto al pubblico o emesso dai terminali di cassa è <strong>sempre comprensivo di IVA</strong>;</li>
                  <li><strong>Calcolo Matematico dello Scorporo IVA:</strong><br>
                  Poiché $P_{lordo} = \text{Imponibile} \times 1,10$, si ottiene:<br>
                  $$\text{Imponibile} = \frac{P_{lordo}}{1,10} \qquad \text{IVA} = P_{lordo} - \text{Imponibile} = P_{lordo} \times \frac{10}{110}$$
                  <em>Esempio numerico:</em> Biglietto da 33,00 €:<br>
                  $\text{Imponibile} = 33,00 / 1,10 = 30,00\ \text{€}$ · $\text{IVA 10\\%} = 3,00\ \text{€}$.
                  </li>
                </ul>
                """
            },
            {
                "title": "2. Natura Fiscale del Biglietto di Trasporto (D.M. 30/06/1992)",
                "content": """
                Il Decreto del Ministero delle Finanze del 30 giugno 1992 disciplina i titoli di viaggio nel trasporto pubblico locale:
                <ul>
                  <li>Il biglietto di trasporto (sia cartaceo emesso da cassa/emettitrice, sia dematerializzato via app/QR-code) <strong>assolve a tutti gli effetti la funzione di scontrino fiscale / documento commerciale</strong>;</li>
                  <li><strong>Elementi obbligatori stampati sul titolo:</strong>
                    <ol>
                      <li>Denominazione dell'esercente (Gestione Governativa Navigazione Laghi);</li>
                      <li>Numero di Partita IVA dell'Ente (00802050153);</li>
                      <li>Numero progressivo univoco del biglietto o transazione;</li>
                      <li>Data e orario di emissione o di convalida;</li>
                      <li>Prezzo totale con indicazione dell'IVA compresa (o aliquota 10%);</li>
                      <li>Tratta di percorso, zona tariffaria o tipologia di servizio (corsa semplice, A/R, supplemento rapido, veicolo).</li>
                    </ol>
                  </li>
                  <li><strong>Esonero dall'obbligo di fattura (Art. 22 comma 1 n. 3 DPR 633/72):</strong> per il trasporto passeggeri la fattura non è obbligatoria, tranne nel caso in cui il cliente la richieda espressamente non oltre il momento dell'emissione del titolo di viaggio.</li>
                </ul>
                """
            },
            {
                "title": "3. Tenuta e Compilazione del Registro dei Corrispettivi (Art. 24 DPR 633/72)",
                "content": """
                I soggetti che emettono biglietti/scontrini in luogo delle fatture sono obbligati a tenere il <strong>Registro dei Corrispettivi</strong>:
                <ul>
                  <li>Sul registro vanno annotate giornalmente, distintamente per aliquota IVA applicata, le somme complessivamente incassate per ciascuna giornata;</li>
                  <li><strong>Termine di annotazione:</strong> entro il <strong>primo giorno non festivo successivo</strong> a quello di effettuazione delle operazioni;</li>
                  <li>Nel settore Ufficio Controllo GGNL, l'operatore verifica quotidianamente la perfetta quadratura tra:
                    <ul>
                      <li>Il riepilogo telematico delle vendite inviato dai software di bigliettazione delle biglietterie e degli assuntori;</li>
                      <li>Le distinte di cassa e versamenti bancari effettuati dagli agenti;</li>
                      <li>Il registro dei corrispettivi aziendale.</li>
                    </ul>
                  </li>
                </ul>
                """
            },
            {
                "title": "4. Metodi di Pagamento, Chiusure POS e Riconciliazione",
                "content": """
                <ul>
                  <li><strong>Contanti:</strong> moneta legale entro i limiti antiriciclaggio vigenti (5.000 €). A inizio turno viene erogato il fondo cassa fisso, a fine turno si effettua il versamento dell'incasso netto eccedente;</li>
                  <li><strong>POS (Point of Sale):</strong> per pagamenti contactless e carte. A fine turno o a fine giornata l'agente esegue la <em>chiusura contabile (batch close)</em> che invia il riepilogo al circuito bancario interbancario. <strong>Attenzione:</strong> la ricevuta POS certifica solo l'addebito sul conto del viaggiatore, ma non è un biglietto né un documento fiscale;</li>
                  <li><strong>PagoPA:</strong> utilizzato principalmente per pagamenti differiti, canoni di concessione pontili, abbonamenti annuali o sanzioni amministrative;</li>
                  <li><strong>Bigliettazione Elettronica (D.M. MIT 255/2016):</strong> definisce le norme di interoperabilità tra smart card contactless (standard Calypso/Mifare) e barcode/QR-code su smartphone.</li>
                </ul>
                """
            }
        ],
        "traps": [
            "Per scorporare l'IVA al 10% non si calcola il 10% del totale lordo! Si divide per 1,10.",
            "La fattura non è mai obbligatoria per il passeggero, a meno che non la richieda prima o al momento dell'acquisto.",
            "La ricevuta POS non è il biglietto: viaggiare con il solo scontrino del POS senza il biglietto GGNL costituisce evasione tariffaria."
        ],
        "quiz_samples": [
            {
                "q": "Qual è l'aliquota IVA ordinariamente applicata al trasporto passeggeri sui laghi?",
                "a": "10% (aliquota ridotta)",
                "source": "Quesito Ufficiale Simulazione Esame"
            },
            {
                "q": "Entro quale termine devono essere annotati i corrispettivi giornalieri sul registro ex art. 24 DPR 633/72?",
                "a": "Entro il primo giorno non festivo successivo",
                "source": "Quesito Ufficiale Simulazione Esame"
            }
        ]
    },
    {
        "file": "06_Assuntorie_Legge_14_1965.html",
        "num": "DISPENSA 06",
        "title": "Regolamentazione delle Assuntorie (Legge 14/1965)",
        "subtitle": "Gestione in convenzione di scali, fermate e biglietterie, compiti contabili dell'assuntore e vigilanza GGNL",
        "color": "var(--orange)",
        "icon": "🏢",
        "key_facts": [
            ("Legge fondamentale", "Legge 3 febbraio 1965, n. 14"),
            ("Ambito di applicazione", "Ferrovie e tramvie in concessione, servizi di navigazione interna"),
            ("Definizione di Assuntore", "Soggetto terzo (privato o ente) convenzionato per la gestione dello scalo/fermata"),
            ("Compiti principali", "Emissione biglietti, custodia impianti d'approdo, ormeggio, rendicontazione"),
            ("Regime contabile", "Versamento periodico degli incassi dedotto l'aggio contrattuale pattuito"),
            ("Rapporto con l'Ufficio Controllo", "Verifica mensile delle matricole biglietti, giacenze e quadratura contabile")
        ],
        "sections": [
            {
                "title": "1. Cosa sono le Assuntorie (Legge 14/1965)",
                "content": """
                La <strong>Legge 3 febbraio 1965, n. 14</strong> disciplina il regime delle <em>assuntorie</em> nelle linee di trasporto in concessione e nella navigazione interna.<br><br>
                Nelle località minori o a traffico stagionale dove non è economicamente giustificata la presenza di personale dipendente stabile GGNL (agente di scalo fisso), l'amministrazione stipula un contratto di <strong>assuntoria</strong> con un soggetto terzo (detto <em>Assuntore</em>), che può essere un privato cittadino, un esercente o una cooperativa locale.
                """
            },
            {
                "title": "2. Obblighi e Mansioni dell'Assuntore di Scalo",
                "content": """
                L'assuntore si impegna contrattualmente a svolgere le seguenti prestazioni:
                <ul>
                  <li><strong>Vendita Titoli di Viaggio:</strong> apertura dello sportello di biglietteria in coincidenza con gli orari dei battelli di linea, rilascio dei biglietti ordinari, supplementi e abbonamenti secondo il tariffario ufficiale GGNL;</li>
                  <li><strong>Custodia e Manutenzione Ordinaria:</strong> apertura e chiusura dei cancelli del pontile, pulizia della sala d'attesa e banchina, esposizione e aggiornamento dei quadri orari;</li>
                  <li><strong>Assistenza all'Ormeggio:</strong> presa delle cime d'ormeggio lanciate dal personale di bordo delle navi durante l'accosto (se previsto dal capitolato);</li>
                  <li><strong>Informazioni al Pubblico:</strong> fornire indicazioni sulle corse, ritardi o coincidenze.</li>
                </ul>
                """
            },
            {
                "title": "3. Rendicontazione e Competenze dell'Ufficio Controllo",
                "content": """
                L'Ufficio Controllo della Gestione Governativa vigila costantemente sull'attività degli assuntori:
                <ul>
                  <li><strong>Consegna delle Matricole:</strong> i blocchetti di biglietti manuali o i rotoli di carta termica numerata vengono caricati a debito dell'assuntore con apposito verbale di consegna matricole;</li>
                  <li><strong>Rendiconto Periodico:</strong> a scadenze prefissate (di norma mensili o quindicinali), l'assuntore compila la <em>distinta riepilogativa delle vendite</em>, indicando la numerazione iniziale e finale dei biglietti venduti;</li>
                  <li><strong>Compenso dell'Assuntore (Aggio):</strong> l'assuntore riceve un compenso forfettario o una percentuale d'aggio sugli incassi realizzati;</li>
                  <li><strong>Versamento:</strong> l'importo netto incassato deve essere versato sul conto corrente postale o bancario della Gestione Governativa, trasmettendo la ricevuta di versamento all'Ufficio Controllo per la riconciliazione contabile.</li>
                </ul>
                """
            }
        ],
        "traps": [
            "L'assuntore NON è un dipendente pubblico a tempo indeterminato della GGNL: è un contraente convenzionato ex L. 14/1965.",
            "L'assuntore non può applicare prezzi arbitrari: deve applicare rigorosamente le tariffe ministeriali ufficiali."
        ],
        "quiz_samples": [
            {
                "q": "La Legge 14 del 3 febbraio 1965 regola specificamente:",
                "a": "Le assuntorie nelle ferrovie in concessione, tranvie e navigazione interna",
                "source": "Quesito Ufficiale Simulazione Esame"
            }
        ]
    },
    {
        "file": "07_Stato_Giuridico_Autoferrotranviari_RD_148.html",
        "num": "DISPENSA 07",
        "title": "Stato Giuridico del Personale (R.D. 148/1931 e CCNL)",
        "subtitle": "Periodo di prova, gerarchia tra agenti, tipologia delle sanzioni disciplinari, Consiglio di Disciplina e dimissioni",
        "color": "var(--rose)",
        "icon": "⚖️",
        "key_facts": [
            ("Legge fondamentale", "Regio Decreto 8 gennaio 1931, n. 148 (Allegato A)"),
            ("Periodo di prova", "Non superiore a 1 anno di effettivo servizio nella navigazione"),
            ("Censura", "Rimprovero scritto con funzione di richiamo preliminare per mancanze lievi"),
            ("Pena accessoria", "Il trasloco punitivo"),
            ("Criteri di gerarchia", "1° Grado · 2° Anzianità grado · 3° Anzianità grado prec. · 4° Anzianità servizio · 5° Età"),
            ("Dimissioni volontarie", "Scritte; hanno valore solo dopo accettazione formale dell'azienda"),
            ("Concorso di mancanze", "Si applica la sanzione prevista per la mancanza più grave (art. 48)")
        ],
        "sections": [
            {
                "title": "1. Il R.D. 148/1931 come Statuto Speciale di Categoria",
                "content": """
                Il <strong>Regio Decreto 8 gennaio 1931, n. 148</strong> (in particolare l'<em>Allegato A</em>) costituisce lo statuto giuridico fondamentale del personale delle ferrovie, tramvie e linee di navigazione interna in concessione.<br><br>
                Nonostante l'anzianità della norma, è tuttora vigente per le parti non derogate dai contratti collettivi nazionali (CCNL Autoferrotranviari), in particolare per quanto attiene a:
                <ul>
                  <li>Inquadramento e periodo di prova;</li>
                  <li>Doveri verso l'azienda e verso il pubblico;</li>
                  <li>Procedimento disciplinare e garanzie difensive del lavoratore.</li>
                </ul>
                """
            },
            {
                "title": "2. Periodo di Prova e Dimissioni",
                "content": """
                <ul>
                  <li><strong>Periodo di Prova (Art. 13):</strong> per i servizi di navigazione e tramvie il periodo complessivo di prova non può superare <strong>un anno di effettivo servizio</strong> (nel bando attuale di Operatore di Ufficio è fissato contrattualmente in 6 mesi);</li>
                  <li><strong>Dimissioni Volontarie (Art. 30):</strong> le dimissioni del lavoratore devono essere presentate per iscritto. Esse <strong>non hanno valore né efficacia finché non siano state formalmente accettate dall'azienda</strong>. Fino a tale accettazione, l'agente è tenuto a proseguire regolarmente il servizio.</li>
                </ul>
                """
            },
            {
                "title": "3. Le Punizioni Disciplinari (Artt. 37 - 52)",
                "content": """
                Il R.D. 148/1931 prevede una scala graduata e tassativa di sanzioni:
                <ol>
                  <li><strong>Censura:</strong> è una dichiarazione formale di biasimo scritta, con funzione di <em>richiamo preliminare</em> per mancanze lievi;</li>
                  <li><strong>Multa:</strong> trattenuta sullo stipendio da 1 a 4 ore di retribuzione;</li>
                  <li><strong>Sospensione dal servizio e dalla paga:</strong> privazione temporanea del lavoro e della retribuzione da 1 a 30 giorni (applicabile per es. per stato di ebbrezza non interessante la sicurezza o insubordinazione);</li>
                  <li><strong>Retrocessione:</strong> passaggio a qualifica inferiore per demerito o gravi mancanze;</li>
                  <li><strong>Destituzione:</strong> sanzione espulsiva massima che risolve il rapporto di lavoro; può essere <em>con preavviso</em> o <em>senza preavviso</em> per fatti di estrema gravità (reati penali, furto, sabotaggio, abbandono del posto di manovra).</li>
                </ol>
                <strong>Pena Accessoria:</strong> il <strong>trasloco punitivo</strong> è la specifica misura accessoria che può essere aggiunta dal Consiglio di Disciplina in caso di incompatibilità locale.
                """
            },
            {
                "title": "4. Procedimento Disciplinare e Consiglio di Disciplina",
                "content": """
                Nessuna sanzione superiore alla censura può essere irrogata senza la preventiva contestazione scritta d'addebito e la concessione di un termine a difesa (almeno 5 giorni per presentare memorie o farsi assistere da un rappresentante sindacale). Le sanzioni gravi sono deliberate dal <em>Consiglio di Disciplina</em>, organo paritetico composto da rappresentanti dell'azienda e dei lavoratori presieduto da un magistrato o funzionario designato.
                """
            }
        ],
        "traps": [
            "La censura ha funzione di richiamo preliminare (non la multa né la sospensione).",
            "Il trasloco punitivo è una pena accessoria, non una punizione autonoma principale.",
            "Nel concorso di più infrazioni contemporanee si applica la sanzione della mancanza più grave, non si sommano le sanzioni."
        ],
        "quiz_samples": [
            {
                "q": "Quale sanzione del R.D. 148/1931 ha funzione di richiamo?",
                "a": "La censura",
                "source": "Quesito Ufficiale CE Movimento"
            },
            {
                "q": "Quale sanzione ha funzione di pena accessoria nel R.D. 148/1931?",
                "a": "Il trasloco punitivo",
                "source": "Quesito Ufficiale CE Movimento"
            },
            {
                "q": "In caso di più mancanze contemporanee quale sanzione si applica?",
                "a": "Quella prevista per la mancanza più grave",
                "source": "Quesito Ufficiale CE Movimento"
            }
        ]
    },
    {
        "file": "08_Codice_Comportamento_DPR_81_e_Codice_Etico.html",
        "num": "DISPENSA 08",
        "title": "Codice di Comportamento dei Dipendenti Pubblici e Codice Etico GGNL",
        "subtitle": "D.P.R. 81/2023, D.P.R. 62/2013, Codice Etico (Allegato A al bando), regali, social media, conflitto di interessi e whistleblowing",
        "color": "var(--amber)",
        "icon": "📜",
        "key_facts": [
            ("Riforma recente", "D.P.R. 13 giugno 2023, n. 81 (modifiche al D.P.R. 62/2013)"),
            ("Regola sui regali", "Divieto assoluto di accettare regali o utilità collegate alle mansioni"),
            ("Modico valore", "Ammessi solo omaggi d'uso di modico valore non superiore indicativamente a 100 euro"),
            ("Social Media (art. 11-ter)", "Divieto di commenti/post che ledano immagine, reputazione o credibilità dell'ente"),
            ("Conflitto di interessi", "Obbligo di astensione immediata in caso di interesse personale o di parenti entro il 4° grado"),
            ("Whistleblowing", "Tutela assoluta dell'identità del dipendente che segnala illeciti aziendali (D.Lgs. 24/2023)")
        ],
        "sections": [
            {
                "title": "1. Il Nuovo Codice di Comportamento (D.P.R. 81/2023)",
                "content": """
                Il <strong>D.P.R. 13 giugno 2023, n. 81</strong> ha aggiornato il Codice di comportamento dei dipendenti pubblici in attuazione dell'art. 54 del D.Lgs. 165/2001 (Testo Unico sul Pubblico Impiego).<br><br>
                I principi guida sono: <em>integrità, imparzialità, buona fede, proporzionalità, trasparenza ed esclusività</em> nel servizio alla Nazione.
                """
            },
            {
                "title": "2. Regali, Compensi e Altre Utilità (Art. 4)",
                "content": """
                <ul>
                  <li>Il dipendente <strong>non chiede né accetta</strong>, per sé o per altri, regali o altre utilità come corrispettivo o ringraziamento per compiere o aver compiuto un atto del proprio ufficio;</li>
                  <li><strong>Deroga del Modico Valore:</strong> sono consentiti esclusivamente regali d'uso di modico valore effettuati occasionalmente nell'ambito delle normali relazioni di cortesia (es. calendario, penna o agenda a Natale), con valore orientativamente non superiore a <strong>100 euro</strong> (o inferiore se previsto dal Codice Etico aziendale GGNL);</li>
                  <li>I regali ricevuti al di fuori dei casi consentiti devono essere immediatamente messi a disposizione dell'amministrazione per essere restituiti o devoluti a fini istituzionali/benefici.</li>
                </ul>
                """
            },
            {
                "title": "3. Utilizzo delle Tecnologie Informatiche e Social Media (Art. 11-ter)",
                "content": """
                È una delle novità più rilevanti introdotte dal D.P.R. 81/2023:
                <ul>
                  <li>Il dipendente nell'utilizzo dei propri profili social personali deve <strong>astenersi da qualsiasi intervento o dichiarazione che possa nuocere al prestigio, al decoro o all'immagine dell'amministrazione</strong>;</li>
                  <li>È vietato divulgare informazioni di servizio non ufficiali o anticipare atti interni dell'ente;</li>
                  <li>Le comunicazioni istituzionali sui canali social sono riservate unicamente agli uffici stampa e comunicazione espressamente autorizzati.</li>
                </ul>
                """
            },
            {
                "title": "4. Codice Etico GGNL e Whistleblowing",
                "content": """
                L'<strong>Allegato A al bando</strong> contiene il Codice Etico approvato dal Gestore Governativo:
                <ul>
                  <li>Impegna tutti i dipendenti al rifiuto di favoritismi, al contrasto alla corruzione e alla massima cortesia nei confronti dei viaggiatori;</li>
                  <li><strong>Tutela del Segnalante (Whistleblowing ex D.Lgs. 24/2023):</strong> chi segnala violazioni, frodi o condotte illecite apprese nell'ambito lavorativo non può essere sanzionato, demansionato, trasferito o discriminato, e la sua identità rimane rigorosamente protetta e segreta.</li>
                </ul>
                """
            }
        ],
        "traps": [
            "Il limite di valore per i regali non è 1.000 € o 500 €, ma orientativamente 100 €.",
            "I post sui propri social privati possono comportare sanzioni disciplinari se offendono o screditano l'azienda."
        ],
        "quiz_samples": [
            {
                "q": "Quale regolamento recente ha aggiornato il Codice di comportamento dei dipendenti pubblici?",
                "a": "D.P.R. 13 giugno 2023, n. 81",
                "source": "Quesito Ufficiale Simulazione Esame"
            },
            {
                "q": "Cosa prevede l'art. 11-ter del DPR 81/2023 in merito ai social media personali?",
                "a": "Il dovere di astenersi da interventi che possano nuocere all'immagine o credibilità dell'amministrazione",
                "source": "Quesito Ufficiale Simulazione Esame"
            }
        ]
    },
    {
        "file": "09_Protocollo_Informatico_DPCM_2013_e_Privacy_GDPR.html",
        "num": "DISPENSA 09",
        "title": "Protocollo Informatico (DPCM 3/12/2013) e Privacy (GDPR 2016/679)",
        "subtitle": "Segnatura di protocollo, immodificabilità del registro, conservazione a norma, ruoli privacy, Titolare GGNL, DPO e diritti",
        "color": "var(--teal)",
        "icon": "📂",
        "key_facts": [
            ("Protocollo informatico", "D.P.C.M. 3 dicembre 2013 (Regole tecniche CAD)"),
            ("Elementi segnatura", "Numero progressivo, data/ora registrazione, mittente, destinatario, oggetto, hash"),
            ("Immodificabilità", "Il registro giornaliero di protocollo non è modificabile a posteriori"),
            ("Regolamento Privacy", "Regolamento (UE) 2016/679 (GDPR)"),
            ("Titolare del trattamento", "Gestione Governativa Navigazione Laghi (Milano)"),
            ("DPO / RPD", "Responsabile della Protezione dei Dati, punto di contatto con l'Autorità Garante"),
            ("Diritto all'oblio", "Art. 17 GDPR (diritto alla cancellazione dei dati personali)")
        ],
        "sections": [
            {
                "title": "1. Il Protocollo Informatico nelle Pubbliche Amministrazioni (DPCM 3/12/2013)",
                "content": """
                Il <strong>Decreto del Presidente del Consiglio dei Ministri 3 dicembre 2013</strong> detta le regole tecniche per la formazione, protocollazione e conservazione dei documenti informatici.<br><br>
                <strong>Finalità del Protocollo:</strong> attribuire certezza giuridica e data certa all'ingresso o all'uscita di qualsiasi documento dall'amministrazione, attestandone l'immodificabilità e la provenienza.
                """
            },
            {
                "title": "2. La Segnatura di Protocollo e le sue Regole",
                "content": """
                Ogni documento protocollato riceve in modo automatico e non modificabile la <strong>Segnatura di Protocollo</strong>, costituita da:
                <ol>
                  <li>Numero progressivo annuale (inizia da 1 il primo gennaio e prosegue senza salti);</li>
                  <li>Data e ora esatta di registrazione;</li>
                  <li>Denominazione dell'amministrazione emittente o ricevente;</li>
                  <li>Generalità del mittente e del destinatario;</li>
                  <li>Oggetto del documento (chiaro e sintetico);</li>
                  <li>Impronta crittografica (hash SHA-256) per garantire l'integrità del file allegato.</li>
                </ol>
                <strong>Chiusura Giornaliera:</strong> a fine giornata il sistema genera il <em>registro giornaliero di protocollo</em> che viene firmato digitalmente e inviato in conservazione a norma, impedendo qualsiasi inserimento retrodatato.
                """
            },
            {
                "title": "3. Privacy e GDPR (Regolamento UE 2016/679)",
                "content": """
                Il GDPR tutela i dati personali delle persone fisiche (passeggeri, fornitori, dipendenti, candidati a concorsi):
                <ul>
                  <li><strong>Dato Personale (Art. 4):</strong> qualsiasi informazione riguardante una persona fisica identificata o identificabile (nome, codice fiscale, email, targa dell'auto imbarcata, coordinate bancarie);</li>
                  <li><strong>Principi del Trattamento (Art. 5):</strong> liceità, correttezza, trasparenza, limitazione della finalità, <em>minimizzazione dei dati</em> (raccogliere solo i dati strettamente necessari) ed esattezza;</li>
                  <li><strong>Titolare del Trattamento:</strong> la <strong>Gestione Governativa Navigazione Laghi</strong>, legalmente rappresentata dal Gestore Governativo (Milano, Via Ariosto 21);</li>
                  <li><strong>DPO (Data Protection Officer) / RPD:</strong> nominato obbligatoriamente dalla GGNL per vigilare sul rispetto della privacy e cooperare col Garante Privacy;</li>
                  <li><strong>Diritti dell'Interessato (Artt. 15-22):</strong> diritto di accesso (sapere quali dati sono conservati), rettifica di dati errati, cancellazione (<em>diritto all'oblio</em>), limitazione del trattamento e portabilità dei dati.</li>
                </ul>
                """
            }
        ],
        "traps": [
            "La segnatura di protocollo non può mai essere riutilizzata o annullata eliminando il numero.",
            "Il Titolare del trattamento non è il singolo impiegato, ma l'ente GGNL.",
            "L'acronimo GDPR significa General Data Protection Regulation."
        ],
        "quiz_samples": [
            {
                "q": "Quale DPCM disciplina le regole tecniche per la gestione del protocollo informatico?",
                "a": "D.P.C.M. 3 dicembre 2013",
                "source": "Quesito Ufficiale Simulazione Esame"
            },
            {
                "q": "Nel GDPR, come si definisce il diritto dell'interessato di ottenere la cancellazione dei propri dati?",
                "a": "Diritto all'oblio (Art. 17)",
                "source": "Quesito Ufficiale Simulazione Esame"
            }
        ]
    },
    {
        "file": "10_Geografia_dei_Tre_Laghi.html",
        "num": "DISPENSA 10",
        "title": "Geografia dei Tre Laghi (Garda, Como, Maggiore)",
        "subtitle": "Bacini, morfologia, province, immissari ed emissari, linee traghetto autoveicoli e venti termici caratteristici",
        "color": "var(--cyan)",
        "icon": "🗺️",
        "key_facts": [
            ("Lago più esteso", "Lago di Garda (Benaco, circa 370 km²)"),
            ("Lago più profondo", "Lago di Como (Lario, circa 418 metri, record italiano)"),
            ("Secondo lago d'Italia", "Lago Maggiore (Verbano, circa 212 km²)"),
            ("Emissario del Garda", "Fiume Mincio (esce a Peschiera del Garda) · Immissario: Sarca"),
            ("Traghetto auto Garda", "Maderno (BS) - Torri del Benaco (VR) operativo tutto l'anno"),
            ("Venti tipici Garda", "Pelèr / Sover (da Nord al mattino) · Ora (da Sud al pomeriggio) · Ander (SO)"),
            ("Venti tipici Como", "Tivano (da Nord-Est al mattino) · Breva (da Sud al pomeriggio)"),
            ("Traghetto auto Maggiore", "Intra (VB) - Laveno (VA) operativo tutto l'anno")
        ],
        "sections": [
            {
                "title": "1. Lago di Garda (Benaco) - Direzione Desenzano del Garda",
                "content": """
                <ul>
                  <li><strong>Primato e Morfologia:</strong> il più grande lago d'Italia per superficie (<strong>370 km²</strong>). A nord è stretto e incassato tra alte montagne (Monte Baldo a est, prealpi bresciane a ovest); a sud è ampio e morenico con la suggestiva penisola di Sirmione;</li>
                  <li><strong>Confini Territoriali:</strong> diviso tra 3 Regioni: <em>Lombardia</em> (provincia di Brescia a ovest: Desenzano, Sirmione, Salò, Maderno, Limone), <em>Veneto</em> (provincia di Verona a est: Peschiera, Lazise, Bardolino, Garda, Torri, Malcesine) e <em>Trentino-Alto Adige</em> (provincia di Trento a nord: Riva del Garda, Torbole);</li>
                  <li><strong>Idrografia:</strong> immissario principale è il <strong>fiume Sarca</strong> (entra a nord presso Torbole); unico emissario è il <strong>fiume Mincio</strong> (esce a sud a <strong>Peschiera del Garda</strong>);</li>
                  <li><strong>Traghetto Autoveicoli:</strong> la linea <strong>Maderno (BS) - Torri del Benaco (VR)</strong> unisce la sponda lombarda a quella veneta tutto l'anno; la linea Limone - Malcesine è attiva nella stagione estiva;</li>
                  <li><strong>Venti:</strong> il <strong>Pelèr (o Sover)</strong> spira da Nord dalla notte fino a mezzogiorno; l'<strong>Ora</strong> subentra da Sud nel primo pomeriggio fino al tramonto; l'<em>Ander</em> proviene da Sud-Ovest.</li>
                </ul>
                """
            },
            {
                "title": "2. Lago di Como (Lario) - Direzione Como",
                "content": """
                <ul>
                  <li><strong>Primato di Profondità:</strong> è il lago più profondo d'Italia (<strong>418 metri</strong> registrati tra Argegno e Nesso). Superficie circa 145 km²;</li>
                  <li><strong>Forma e Bacini:</strong> caratteristica forma a <strong>'Y' rovesciata</strong> con i tre rami: ramo di Como (sud-ovest), ramo di Lecco (sud-est) e ramo di Colico (nord). Il punto di convergenza centrale è lo spettacolare promontorio di <strong>Bellagio</strong>;</li>
                  <li><strong>Idrografia:</strong> immissario ed emissario principale è il <strong>fiume Adda</strong>, che esce dal ramo di <strong>Lecco</strong>. Il ramo di Como è a fondo cieco;</li>
                  <li><strong>Isole:</strong> l'unica isola è l'<strong>Isola Comacina</strong> (nel comune di Tremezzina / Ossuccio);</li>
                  <li><strong>Traghetto Automezzi Centro Lago:</strong> servizio continuativo tra <strong>Bellagio, Varenna, Menaggio e Cadenabbia</strong>;</li>
                  <li><strong>Venti:</strong> il <strong>Tivano</strong> spira da Nord-Est al mattino; la <strong>Breva</strong> spira da Sud al pomeriggio.</li>
                </ul>
                """
            },
            {
                "title": "3. Lago Maggiore (Verbano) - Direzione Arona",
                "content": """
                <ul>
                  <li><strong>Dimensioni:</strong> secondo lago italiano per estensione (<strong>212 km²</strong>), lungo ben 65 km;</li>
                  <li><strong>Confini:</strong> sponda occidentale in <em>Piemonte</em> (province di Novara e VCO: Arona, Stresa, Verbania Intra/Pallanza, Cannobio), sponda orientale in <em>Lombardia</em> (provincia di Varese: Angera, Santa Caterina del Sasso, Laveno, Luino), parte settentrionale in <em>Svizzera</em> (Canton Ticino: Brissago, Ascona, Locarno);</li>
                  <li><strong>Idrografia:</strong> immissario principale ed emissario è il <strong>fiume Ticino</strong> (esce a sud a Sesto Calende);</li>
                  <li><strong>Isole:</strong> nel Golfo Borromeo sorgono le famose <strong>Isole Borromee</strong> (Isola Bella con il Palazzo Borromeo, Isola Madre, Isola dei Pescatori);</li>
                  <li><strong>Traghetto Veicoli:</strong> linea annuale continuativa <strong>Intra (VB) - Laveno (VA)</strong> che collega Piemonte e Lombardia;</li>
                  <li><strong>Venti:</strong> la <em>Tramontana</em> (da nord al mattino) e l'<em>Inverna</em> (da sud al pomeriggio).</li>
                </ul>
                """
            }
        ],
        "traps": [
            "Il lago più profondo d'Italia è Como (418 m), non Garda né Maggiore.",
            "L'emissario del Garda è il Mincio che esce a Peschiera (non il Sarca, che è l'immissario!).",
            "Il traghetto auto annuale del Garda è Maderno-Torri (non Desenzano-Riva).",
            "L'Adda esce dal ramo di Lecco, non dal ramo di Como."
        ],
        "quiz_samples": [
            {
                "q": "Quale tra i grandi laghi ha la profondità maggiore?",
                "a": "Lago di Como (circa 418 metri)",
                "source": "Quesito Ufficiale Prove GGNL"
            },
            {
                "q": "Su quale lago si trovano l'Isola Bella e l'Isola Madre?",
                "a": "Lago Maggiore",
                "source": "Quesito Ufficiale Prova 33/2025"
            },
            {
                "q": "Quale vento caratteristico soffia da Sud-Ovest sul Lago di Garda?",
                "a": "L'Ander",
                "source": "Quesito Ufficiale Prova CE 130"
            }
        ]
    },
    {
        "file": "11_Informatica_Excel_PEC_e_Inglese.html",
        "num": "DISPENSA 11",
        "title": "Informatica d'Ufficio (Excel, Word, PEC) e Lingua Inglese",
        "subtitle": "Formule assolute, CERCA.VERT, tabelle pivot, ricevute di accettazione e consegna PEC, glossario biglietteria e trasporti in inglese",
        "color": "var(--violet)",
        "icon": "💻",
        "key_facts": [
            ("Riferimento assoluto Excel", "Blocco riga/colonna col dollaro (es. $A$1) per evitare scostamenti nel trascinamento"),
            ("Funzione CERCA.VERT", "Cerca un valore nella 1ª colonna ed estrae il dato sulla stessa riga"),
            ("Tabella Pivot", "Strumento di aggregazione e quadratura rapida di grandi elenchi contabili"),
            ("PEC: Ricevuta Accettazione", "Emessa dal gestore mittente: prova solo la spedizione del messaggio"),
            ("PEC: Ricevuta Consegna", "Emessa dal gestore destinatario: è l'UNICA che prova la consegna con valore legale"),
            ("Email: Campo CCN", "Copia Conoscenza Nascosta per privacy (non rivela gli indirizzi agli altri destinatari)"),
            ("Inglese trasporti", "One-way ticket (corsa semplice) · Return ticket (A/R) · Timetable (orario) · Refund (rimborso)")
        ],
        "sections": [
            {
                "title": "1. Microsoft Excel per l'Ufficio Controllo",
                "content": """
                Excel è lo strumento software più utilizzato nell'Ufficio Controllo per verificare le distinte cassa, riconciliare i POS ed elaborare statistiche:
                <ul>
                  <li><strong>Riferimenti di cella:</strong>
                    <ul>
                      <li><em>Relativi (A1):</em> si aggiornano automaticamente se la formula viene copiata o trascinata in un'altra cella;</li>
                      <li><em>Assoluti ($A$1):</em> bloccati con il simbolo del dollaro davanti alla lettera di colonna e al numero di riga. Indispensabili quando si moltiplica un elenco di biglietti per una tariffa fissa o per l'aliquota IVA;</li>
                      <li><em>Misti ($A1 o A$1):</em> bloccano solo la colonna o solo la riga.</li>
                    </ul>
                  </li>
                  <li><strong>Funzioni Fondamentali:</strong>
                    <ul>
                      <li><code>=CERCA.VERT(valore_cercato; matrice_tabella; indice_colonna; FALSO)</code>: ricerca un codice (es. matricola biglietto o scalo) nella prima colonna a sinistra e restituisce il corrispondente valore (es. importo o nome scalo);</li>
                      <li><code>=SOMMA.SE(intervallo; criterio; [int_somma])</code>: calcola il totale degli incassi filtrando per singola cassa o per specifico operatore;</li>
                      <li><code>=SE(test_logico; se_vero; se_falso)</code>: inserisce valori condizionali (es. <code>=SE(C2=D2; "QUADRATO"; "DIFFERENZA")</code>).</li>
                    </ul>
                  </li>
                  <li><strong>Tabelle Pivot:</strong> consentono di raggruppare all'istante migliaia di transazioni per giorno, scalo e metodo di pagamento senza scrivere formule complesse.</li>
                </ul>
                """
            },
            {
                "title": "2. Posta Elettronica Ordinaria e P.E.C. (Posta Elettronica Certificata)",
                "content": """
                <ul>
                  <li><strong>Campi Indirizzo Email:</strong>
                    <ul>
                      <li><em>A (To):</em> destinatario principale tenuto all'azione;</li>
                      <li><em>CC (Copia Conoscenza):</em> destinatari informati per conoscenza; visibili a tutti;</li>
                      <li><em>CCN (Copia Conoscenza Nascosta / BCC):</em> indirizzi invisibili a tutti gli altri. Obbligatorio ai sensi del GDPR quando si invia una circolare a più candidati o utenti esterni per non rivelare i loro dati personali.</li>
                    </ul>
                  </li>
                  <li><strong>P.E.C. e Ricevute Legali (D.P.R. 68/2005 e CAD):</strong> la PEC ha valore legale equivalente a una raccomandata postale con ricevuta di ritorno (A/R). Il sistema rilascia due distinte ricevute:
                    <ol>
                      <li><strong>Ricevuta di Accettazione:</strong> rilasciata dal gestore PEC del <em>mittente</em>. Attesta che il messaggio è stato preso in carico per la trasmissione (data e ora di invio);</li>
                      <li><strong>Ricevuta di Avvenuta Consegna:</strong> rilasciata dal gestore PEC del <em>destinatario</em>. <strong>È l'unica ricevuta che certifica che il messaggio è entrato nella disponibilità della casella del destinatario</strong> con pieno valore legale opponibile a terzi.</li>
                    </ol>
                  </li>
                </ul>
                """
            },
            {
                "title": "3. Glossario di Lingua Inglese per i Servizi Lacustri",
                "content": """
                Termini essenziali richiesti nei colloqui e nelle prove d'esame per biglietteria e controllo passeggeri:
                <table style="width:100%; border-collapse:collapse; margin-top:10px;">
                  <tr style="background:#091d29; color:var(--teal); font-weight:800; font-size:0.85rem;">
                    <td style="padding:8px 12px; border:1px solid var(--line);">Termine Italiano</td>
                    <td style="padding:8px 12px; border:1px solid var(--line);">Termine Inglese</td>
                    <td style="padding:8px 12px; border:1px solid var(--line);">Esempio d'uso</td>
                  </tr>
                  <tr><td style="padding:8px 12px; border:1px solid var(--line);">Corsa semplice / Solo andata</td><td style="padding:8px 12px; border:1px solid var(--line); font-weight:700;">One-way ticket / Single ticket</td><td style="padding:8px 12px; border:1px solid var(--line); color:var(--muted);">A single ticket to Sirmione</td></tr>
                  <tr><td style="padding:8px 12px; border:1px solid var(--line);">Andata e ritorno</td><td style="padding:8px 12px; border:1px solid var(--line); font-weight:700;">Round-trip ticket / Return ticket</td><td style="padding:8px 12px; border:1px solid var(--line); color:var(--muted);">Do you need a return ticket?</td></tr>
                  <tr><td style="padding:8px 12px; border:1px solid var(--line);">Libera circolazione / Giornaliero</td><td style="padding:8px 12px; border:1px solid var(--line); font-weight:700;">Daily pass / Day rover ticket</td><td style="padding:8px 12px; border:1px solid var(--line); color:var(--muted);">Unlimited trips for one day</td></tr>
                  <tr><td style="padding:8px 12px; border:1px solid var(--line);">Traghetto autoveicoli</td><td style="padding:8px 12px; border:1px solid var(--line); font-weight:700;">Car ferry / Vehicle ferry</td><td style="padding:8px 12px; border:1px solid var(--line); color:var(--muted);">Pier 2 for the car ferry</td></tr>
                  <tr><td style="padding:8px 12px; border:1px solid var(--line);">Supplemento rapido</td><td style="padding:8px 12px; border:1px solid var(--line); font-weight:700;">Fast boat supplement / Surcharge</td><td style="padding:8px 12px; border:1px solid var(--line); color:var(--muted);">Catamaran fast service</td></tr>
                  <tr><td style="padding:8px 12px; border:1px solid var(--line);">Persone a Mobilità Ridotta</td><td style="padding:8px 12px; border:1px solid var(--line); font-weight:700;">Passengers with Reduced Mobility (PRM)</td><td style="padding:8px 12px; border:1px solid var(--line); color:var(--muted);">Wheelchair accessible boarding</td></tr>
                  <tr><td style="padding:8px 12px; border:1px solid var(--line);">Ritardo / Cancellazione</td><td style="padding:8px 12px; border:1px solid var(--line); font-weight:700;">Delay / Cancellation</td><td style="padding:8px 12px; border:1px solid var(--line); color:var(--muted);">Service delayed due to bad weather</td></tr>
                  <tr><td style="padding:8px 12px; border:1px solid var(--line);">Rimborso</td><td style="padding:8px 12px; border:1px solid var(--line); font-weight:700;">Refund</td><td style="padding:8px 12px; border:1px solid var(--line); color:var(--muted);">Full refund of the ticket price</td></tr>
                </table>
                """
            }
        ],
        "traps": [
            "La sola ricevuta di accettazione della PEC non basta a dimostrare che il destinatario ha ricevuto il messaggio: serve la ricevuta di avvenuta consegna.",
            "Nel campo CCN gli indirizzi rimangono segreti (mentre in CC sono visibili a tutti)."
        ],
        "quiz_samples": [
            {
                "q": "In Microsoft Excel, quale simbolo fissa una cella come riferimento assoluto?",
                "a": "Il carattere dollaro ($)",
                "source": "Quesito Ufficiale Prove GGNL"
            },
            {
                "q": "Nella PEC, quale ricevuta attesta che il messaggio è giunto nella casella del destinatario?",
                "a": "La Ricevuta di Avvenuta Consegna",
                "source": "Quesito Ufficiale Prove GGNL"
            }
        ]
    }
]

# Modello HTML unificato per ciascuna dispensa in pieno stile NaviSuite
def build_html_dispensa(d):
    key_facts_html = "".join([f"""
      <div style="background:var(--card2); border:1px solid var(--line); padding:10px 14px; border-radius:12px;">
        <span style="font-size:0.75rem; text-transform:uppercase; color:var(--c); font-weight:800; display:block; letter-spacing:0.06em;">{k}</span>
        <strong style="font-size:0.95rem; color:#fff;">{v}</strong>
      </div>
    """ for k, v in d["key_facts"]])

    sections_html = "".join([f"""
      <div class="sez" style="--c:{d['color']}; margin-bottom:20px;">
        <h3 style="font-size:1.15rem; color:#fff; display:flex; align-items:center; gap:8px;">
          <span>{sec['title']}</span>
        </h3>
        <div style="color:#d4e3f2; font-size:0.96rem; line-height:1.65; margin-top:8px;">
          {sec['content']}
        </div>
      </div>
    """ for sec in d["sections"]])

    traps_html = "".join([f"<li>{t}</li>" for t in d["traps"]])

    quizzes_html = "".join([f"""
      <div style="background:#081723; border:1px solid var(--line); border-left:4px solid var(--teal); border-radius:0 12px 12px 0; padding:12px 16px; margin-bottom:10px;">
        <span style="font-size:0.75rem; font-weight:800; color:var(--muted); text-transform:uppercase;">{q['source']}</span>
        <p style="font-weight:700; color:#fff; font-size:0.95rem; margin:4px 0 6px;">{q['q']}</p>
        <p style="color:var(--green); font-weight:800; font-size:0.92rem; margin:0;">✔ Risposta esatta: {q['a']}</p>
      </div>
    """ for q in d["quiz_samples"]])

    return f"""<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{d['title']} · Dispensa NaviSuite</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=DM+Mono:wght@400;500&display=swap">
  <link rel="shortcut icon" href="../../../assets/images/favicon.svg" type="image/svg+xml">
  <style>
    :root {{
      --bg: #071923;
      --surface: #0b1c26;
      --card: #102733;
      --card2: #143140;
      --line: #1f4250;
      --ink: #eaf2f4;
      --muted: #9fb8c2;
      --on: #06231f;

      --teal: #2dd4bf;
      --cyan: #67d7e6;
      --violet: #a78bfa;
      --amber: #fbbf24;
      --orange: #fb923c;
      --rose: #fb7185;
      --green: #52c879;
      --blue: #54a7ff;
      --c: {d['color']};
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: linear-gradient(160deg, color-mix(in srgb, var(--teal) 9%, var(--surface)), var(--surface) 40%, color-mix(in srgb, var(--violet) 9%, var(--surface)));
      color: var(--ink);
      font-family: 'Manrope', system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }}
    a {{ color: var(--teal); text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
    .wrap {{ width: min(920px, calc(100% - 32px)); margin: auto; }}

    .top-bar {{
      background: rgba(7, 25, 35, 0.94);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--line);
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 12px 0;
    }}
    .top-bar-inner {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }}
    .back-btn {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-weight: 700;
      font-size: 0.88rem;
      padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--card);
      transition: all 0.15s ease;
    }}
    .back-btn:hover {{
      color: var(--ink);
      border-color: var(--teal);
      background: var(--card2);
      text-decoration: none;
    }}

    header.doc-header {{
      padding: 34px 0 20px;
    }}
    .badge-tag {{
      display: inline-block;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--c);
      margin-bottom: 8px;
    }}
    h1.doc-title {{
      font-size: clamp(1.6rem, 4vw, 2.3rem);
      font-weight: 800;
      color: #fff;
      line-height: 1.2;
      margin-bottom: 8px;
    }}
    p.doc-subtitle {{
      color: var(--muted);
      font-size: 1rem;
      line-height: 1.5;
      margin-bottom: 24px;
    }}

    .key-facts-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
      margin-bottom: 30px;
    }}

    .sez {{
      background: color-mix(in srgb, var(--c) 8%, var(--card));
      border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
      border-radius: 18px;
      padding: 22px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    }}

    .traps-box {{
      background: rgba(251, 113, 133, 0.08);
      border: 1px solid rgba(251, 113, 133, 0.35);
      border-left: 4px solid var(--rose);
      border-radius: 0 14px 14px 0;
      padding: 16px 20px;
      margin: 28px 0;
    }}
    .traps-box h3 {{
      color: var(--rose);
      font-size: 0.92rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .traps-box ul {{
      list-style: square;
      padding-left: 20px;
      color: #ffd9df;
      font-size: 0.92rem;
      line-height: 1.6;
    }}

    .quiz-box {{
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 22px;
      margin-bottom: 40px;
    }}

    footer {{
      margin-top: auto;
      text-align: center;
      padding: 30px 0;
      color: var(--muted);
      font-size: 0.84rem;
      border-top: 1px solid var(--line);
    }}

    @media print {{
      body {{ background: #fff !important; color: #000 !important; }}
      .top-bar, footer {{ display: none; }}
      .sez, .traps-box, .quiz-box {{ break-inside: avoid; border-color: #ccc; background: #fafafa; color: #000 !important; }}
      h1, h2, h3, strong {{ color: #000 !important; }}
    }}
  </style>
</head>
<body>

  <nav class="top-bar">
    <div class="wrap top-bar-inner">
      <a href="../../../concorso-controllo.html" class="back-btn">
        <span>←</span>
        <span>Torna al Concorso Controllo</span>
      </a>
      <button onclick="window.print()" class="back-btn" style="cursor:pointer;">
        <span>🖨️</span>
        <span>Stampa / Salva in PDF</span>
      </button>
    </div>
  </nav>

  <header class="wrap doc-header">
    <span class="badge-tag">{d['num']} · MATERIALE DIDATTICO UFFICIALE</span>
    <h1 class="doc-title">{d['icon']} {d['title']}</h1>
    <p class="doc-subtitle">{d['subtitle']}</p>

    <!-- PUNTI FONDAMENTALI A COLPO D'OCCHIO -->
    <div class="key-facts-grid">
      {key_facts_html}
    </div>
  </header>

  <main class="wrap">
    <!-- SEZIONI PRINCIPALI -->
    {sections_html}

    <!-- TRAPPOLE E DISTRATTORI DA ESAME -->
    <div class="traps-box">
      <h3><span>⚠️</span><span>Attenzione alle Trappole nei Quiz su Questa Materia</span></h3>
      <ul>
        {traps_html}
      </ul>
    </div>

    <!-- QUESITI D'ESAME REALI TRATTI DALLE PROVE -->
    <div class="quiz-box">
      <h3 style="font-size:1.1rem; color:var(--teal); margin-bottom:14px; display:flex; align-items:center; gap:8px;">
        <span>🎯</span><span>Quesiti Reali Estratti dalle Prove d'Esame Precedenti</span>
      </h3>
      {quizzes_html}
    </div>
  </main>

  <footer>
    NaviSuite · Concorso Operatore di Ufficio GGNL (par. 130) · Direzione Esercizio Navigarda
  </footer>

</body>
</html>
"""

# Generazione file
for d in dispense_data:
    filepath = os.path.join(dispense_dir, d["file"])
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(build_html_dispensa(d))
    print(f"Generato: {d['file']}")

print("Tutte le 11 dispense HTML in stile NaviSuite sono state generate!")
