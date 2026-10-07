# Notifiche degli arrivi nel push-worker (TrueNAS)

Chi lavora a terra (AgB, PonD, AgM, AgT…) riceve una notifica **10 minuti prima di ogni nave in arrivo**
nelle ore del suo servizio. La notifica riporta nave, pontile (scelto in Servizi a terra o dall'O.d.S.)
e comandante. Esempio:

> **M1 MANTOVA arriva alle 12.15**
> ⚓ Pontile 3 · da Maderno · corsa 91
> Comandante VIOLA

Chi decide quali notifiche mandare è il modulo `assets/js/push-arrivi.js`. È un modulo puro, come
`push-summary.js`.

- **Con l'app aperta** (Servizi a terra, Il mio turno, Orario) le mostra già `assets/js/arrivi-avvisi.js`.
- **Con l'app chiusa o l'iPhone bloccato** deve mandarle il push-worker. Le istruzioni sono qui sotto.

Le notifiche dell'app e quelle del worker hanno lo stesso `tag`, quindi non arrivano doppie.

## Cosa aggiungere al worker

Il worker scarica già `course-info.js` e `push-summary.js` da GitHub Pages. Per gli arrivi servono anche
questi file, nell'ordine:

```
assets/js/course-info.js
assets/js/orario-corse.js
assets/js/servizi-terra-a4.js
assets/js/turni-giorno.js
assets/js/orario-giorno.js
assets/js/push-arrivi.js
```

I file vanno eseguiti con `globalThis.window = globalThis` e dopo aver impostato
`globalThis.NaviCourseInfo = <course-info>`. Alla fine `globalThis.NaviPushArrivi` è pronto.

Poi, **una volta al minuto**:

```js
const oggi = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });           // 2026-10-06
const [h, m] = new Date().toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour12: false }).split(':').map(Number);
const ora = h * 60 + m;

// Turni effettivi: gli stessi dati del riepilogo (NaviPushSummary.effectiveData(base, updates, shared)).
const data = NaviPushSummary.effectiveData(base, updates, shared);
// Pontili scelti nella pagina Servizi a terra (Firebase): private/adminUpdates/pontiliCorse/DESENZANO
const pontili = await firebaseGet('private/adminUpdates/pontiliCorse/DESENZANO') || {};

for (const sub of subscriptionsAttive) {                  // private/adminUpdates/pushSubscriptions/{agente}/{device}
  if (sub.preferences?.arrivals === false) continue;      // interruttore "Arrivi delle navi" in Impostazioni
  const lista = NaviPushArrivi.notifiche(data, sub.agentId, oggi, { pontili });
  for (const n of NaviPushArrivi.dovute(lista, ora)) {    // ora di avviso passata da meno di 5 minuti
    const chiave = `${sub.agentId}/${sub.deviceId}/${n.tag}`;
    if (giaInviate.has(chiave)) continue;                 // una sola volta (es. un Set svuotato a mezzanotte)
    giaInviate.add(chiave);
    await webpush.sendNotification(sub, JSON.stringify({
      title: n.title, body: n.body, url: n.url, tag: n.tag, renotify: true,
      data: { kind: 'arrivo', date: oggi, code: n.code, run: n.run }
    }), { TTL: 600 });
  }
}
```

Il service worker di NaviSuite (`sw.js`) mostra già queste notifiche: le gestisce come le altre push, e
toccandole si apre Servizi a terra.

## Regole usate

| Servizio a terra | Notifiche |
|---|---|
| **Desenzano** (AgB, PonD, DT) | arrivi delle navi di linea a Desenzano (BIS compresa) |
| **Maderno, AgM e PonM** | arrivi e scali delle navi di linea a Maderno |
| **Maderno, AgT** | arrivi del traghetto da Torri |

Valgono inoltre queste regole:

- Le notifiche arrivano solo per gli arrivi nelle ore del servizio. Per esempio AgB lavora 8.00–11.50 e
  12.50–17.30. I servizi senza orario indicato ricevono tutti gli arrivi della giornata.
- Si tiene conto dei periodi dell'O.d.S.: le SR fanno servizio fino all'11/10, la linea fino all'1/11, il
  T1 tutto l'inverno.
- **Pontile a Desenzano**: vale la scelta di oggi in Servizi a terra. Se manca, l'ormeggio serale
  dell'O.d.S., e poi l'ultima scelta dei giorni prima.
- **Pontile a Maderno**: solo l'ormeggio serale dell'O.d.S.
- **Comandante**: il capitano o, se manca, il capo timoniere.
