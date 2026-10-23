# Stile NaviSuite «a riquadri colorati»

Guida dello stile usato nelle pagine nuove: Controllo cassa, Verifica busta, Impostazioni › Utente e Agenti.
Esempi completi:
- `tools/mockup-utente-completo.html` (Utente + Amministrazione, telefono);
- `tools/mockup-pc-agenti.html` (Impostazioni da PC, Agenti da PC e da telefono);
- `tools/mockup-controllo-cassa.html` (proposta C3).

## Principi

1. **Scuro e colorato.** Fondo blu notte; ogni argomento ha il **suo colore** (bordo, titolo, fondo tenue). Il colore dice di cosa si parla, non è decorazione.
2. **Riquadri per argomento.** Una pagina è una pila di riquadri (`.sez`), uno per argomento, con titolo e icona. Niente sezioni numerate «01, 02».
3. **Prima i totali, poi i dettagli.** I numeri che contano stanno in alto e in grande; liste e tabelle sotto.
4. **Solo ciò che serve aperto.** Le parti rare o da amministratore sono richiudibili (`<details>`), chiuse all'apertura, con un riassunto a destra («2 in bozza», «54»).
5. **Telefono prima.** Sul telefono una colonna; da PC (≥ 1000 px) le stesse sezioni affiancate in colonne.
6. **Testi in italiano semplice.** Etichette brevi, verbi d'azione sui pulsanti («Salva», «Cambia PIN», «Togli FF»). Agli agenti non si nominano Firebase, PocketBase o dettagli tecnici: solo agli admin.

## Colori (token)

```css
:root{
  --bg:#071923;       /* fondo pagina */
  --surface:#0b1c26;  /* fondo schermata/telefono */
  --card:#102733;     /* fondo riquadro neutro */
  --card2:#143140;    /* fondo secondario (binari, interruttori spenti) */
  --line:#1f4250;     /* bordi e separatori */
  --ink:#eaf2f4;      /* testo */
  --muted:#9fb8c2;    /* testo secondario */
  --on:#06231f;       /* testo su colore pieno */

  --teal:#2dd4bf;     /* colore principale, azioni, "totale" */
  --cyan:#67d7e6;     /* incasso, banconote, dati */
  --violet:#a78bfa;   /* POS, FF, notifiche, salvataggi */
  --amber:#fbbf24;    /* ticket, resto, attenzione */
  --orange:#fb923c;   /* fondo per domani, invio */
  --rose:#fb7185;     /* errori, ammanco, cassetta rossa, azioni pericolose */
  --green:#52c879;    /* ok, quadrato */
  --pink:#f472b6;     /* utenti */
  --wa:#25d366;       /* WhatsApp */
}
```

Fondo pagina con una leggera sfumatura:
`background:linear-gradient(160deg,color-mix(in srgb,var(--teal) 9%,var(--surface)),var(--surface) 40%,color-mix(in srgb,var(--violet) 9%,var(--surface)))`

**Regola d'uso del colore di un riquadro** (variabile `--c` sull'elemento):
- fondo: `color-mix(in srgb,var(--c) 10–20%,var(--card))`
- bordo: `1px solid color-mix(in srgb,var(--c) 38–45%,transparent)`
- titolo/etichetta: `var(--c)`
- selezionato/attivo: fondo `var(--c)`, testo `var(--on)`

**Semantica fissa:** verde = ok · giallo = da verificare · rosa = differenza/errore · turchese = totale/azione principale · viola = FF.

### Colori dei gradi (distintivo, come in Movimento)

| Grado | Sigla | Colore |
|---|---|---|
| Capitano | Cap | `#facc15` |
| Capo timoniere | CT | `#fb923c` |
| Aiuto motorista | AM | `#3b82f6` |
| Motorista | Mot | `#a855f7` |
| Timoniere | Tim | `#22c55e` |
| Marinaio | Mar | `#e8f3f6` |
| Applicato | App | `#a3e635` |
| Barista | Bar | `#f472b6` |

### Colori dei tagli (contanti)

100 € `#4ade80` · 50 € `#fb923c` · 20 € `#60a5fa` · 10 € `#f87171` · 5 € `#a3b5a6` · 2 € `#fbbf24` · 1 € `#fcd34d` · 0,50 `#eab308` · 0,20 `#f59e0b` · 0,10 `#d97706`

## Caratteri

- **Manrope** 500–800 per tutto il testo (titoli 800).
- **DM Mono** per numeri, importi, date e ID, sempre con `font-variant-numeric:tabular-nums`.
- Etichette piccole: 9–11 px, MAIUSCOLO, `letter-spacing:.1–.2em`, peso 800, nel colore del riquadro.

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=DM+Mono:wght@400;500&display=swap">
```

## Componenti

### Intestazione pagina
```html
<span class="eb">IMPOSTAZIONI</span>
<h1 class="tt">Utente</h1>
```
`.eb` = etichetta turchese 11 px spaziata; `.tt` 21–25 px 800. Il titolo può avere la sfumatura turchese→ciano→viola (`background-clip:text`).

### Riquadro di sezione `.sez`
```html
<div class="sez" style="--c:var(--violet)">
  <h3>🔔 Notifiche</h3>
  <p>Testo di aiuto breve.</p>
  …contenuto…
</div>
```
```css
.sez{display:grid;gap:8px;padding:12px;border-radius:16px;background:color-mix(in srgb,var(--c) 10%,var(--card));border:1px solid color-mix(in srgb,var(--c) 38%,transparent)}
.sez h3{margin:0;font-size:14px;font-weight:800;color:var(--c)}
.sez p{margin:0;font-size:12px;color:var(--muted)}
```

### Sezione richiudibile (admin, parti rare) `.adm`
```html
<details class="adm" style="--c:var(--teal)">
  <summary><span>📅 Pubblicazione settimane</span><b class="cnt">2 in bozza</b></summary>
  …
</details>
```
Chiusa all'apertura; `.cnt` è la pastiglia col riassunto (fondo `--c`, testo `--on`). Freccia ▾/▴ con `summary::after`.

### Tessera (dati in sola lettura)
Riquadro con sfumatura `linear-gradient(135deg,#0f3a40,#1a2d4a)`, bordo turchese tenue e un alone radiale in alto a destra. Dentro: distintivo grande + nome (20 px 800) + ID in mono; sotto una griglia 2×2 `<dl>` con etichette ciano maiuscole.

### Distintivo del grado `.gr`
```html
<span class="gr" style="--g:#22c55e">Tim</span>
```
```css
.gr{--g:#e8f3f6;display:inline-grid;place-items:center;width:44px;height:44px;border:3px solid var(--g);border-radius:50%;background:color-mix(in srgb,var(--g) 18%,transparent);color:var(--g);font-size:12px;font-weight:900}
```
Varianti: piccolo 26 px (bordo 2 px) dentro pastiglie e liste; grande 76 px per i profili.

### Pastiglia FF
Viola: fondo `#2a2148`, bordo `--violet`, testo `#ddd6fe`, con il distintivo piccolo del grado FF:
`FF capo timoniere · fino al 30/11/2026`.

### Pastiglie di scelta `.chip`
Scelta singola tra poche opzioni (Prima pagina, Ticket, filtri). Spenta: fondo `--card`, bordo colore tenue; accesa: fondo `--c`, testo `--on`. Usare `aria-pressed`.

### Segmenti `.seg`
3–4 opzioni in una barra (Riepilogo giornata, Ufficiale/Bozza/Nascosta): contenitore `--card` con padding 3–4 px, opzioni con raggio 8–9 px, attiva piena di colore.

### Interruttore `.tg`
Stile iPhone 42–46 × 26–28 px; acceso = colore della sezione, pallino `--on`; spento = `--card2` e pallino `--muted`.

### Riquadri totale / numeri `.tc`, `.kpi`, `.tile`
Etichetta 9 px maiuscola nel colore, valore in DM Mono 15–22 px. Il valore calcolato in automatico ha bordo tratteggiato e « · auto» nell'etichetta. Il totale principale può essere pieno turchese (testo `--on`).

### Elenchi `.it`
Riga con distintivo a sinistra, nome in grassetto, sotto ID e residenza in piccolo, etichette a destra (FF, ADMIN). Bordo sinistro 4 px nel colore del grado. Riga scelta: fondo turchese tenue + contorno turchese.

### Pulsanti
- Principale: pieno, sfumatura `linear-gradient(90deg,var(--teal),var(--cyan))`, testo `--on`, raggio 12 px, larghezza piena in fondo alla sezione.
- Nel colore della sezione: `background:var(--c);color:var(--on)`.
- Secondari e **pericolosi** (elimina, togli): a contorno (`background:transparent;border:1px solid …`), messi in fondo.
- WhatsApp: verde `--wa`.

### Titoli di sezione dentro una pagina lunga `.cc-sez`
Etichetta turchese 11 px maiuscola con una **linea sopra** (`border-top:1px solid color-mix(in srgb,var(--teal) 30%,var(--line))`) per separare le parti (Totali · Conteggio · Risultato…).

## Disposizione

- Contenitore: `max-width` ~460 px sul telefono, fino a 1380 px su PC. Margini laterali `max(16px, env(safe-area-inset-left/right))`.
- Spaziatura con `display:grid; gap:8–12px` (niente margini singoli).
- **PC (≥ 1000 px):** raggruppare le sezioni in colonne `.cc-col` con `grid-template-columns:repeat(auto-fit,minmax(320–340px,1fr))`. Sul telefono le colonne diventano `display:contents` e tutto torna in una colonna, nello stesso ordine.
- Elenco + dettaglio (Agenti): da PC elenco 360 px a sinistra e scheda a destra; da telefono elenco, poi scheda a schermo intero.
- Tessere/griglie di pezzi: 5 per riga, dal taglio più grande al più piccolo.

## Comportamenti

- Riquadri «rari» chiusi all'apertura; si aprono da soli se contengono un valore (es. «Da stornare» diventa rosa e si apre se ≠ 0).
- Scelta della data: pulsante «📅 Oggi · sab 17 ott ▾» che apre il **rullo dei giorni** stile iPhone (scroll-snap, fascia turchese al centro, «Oggi» e «Fatto»).
- Tocco su un valore da ricopiare (Foglio 31 righe) = copia negli appunti con breve evidenziazione.
- Dati personali in sola lettura con nota 🔒 «li modifica solo l'amministratore».

## Prima di pubblicare una pagina nuova

1. Fare un mockup (in `tools/`) e farlo approvare.
2. Mantenere gli stessi `id` dei campi della pagina esistente, così calcoli e salvataggi non cambiano.
3. Controllare telefono (400 px) e PC (1440 px) nel browser di prova.
4. Aumentare la versione della cache in `sw.js` e il `?v=` dei file cambiati.
