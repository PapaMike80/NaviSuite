/// <reference path="../pb_data/types.d.ts" />

// GET /api/navisuite-v2/schedule
// Ricompone il calendario turni nella STESSA forma che il frontend NaviSuite
// si aspetta da Firebase (public/schedule + effectiveSchedule.data), cosi'
// shared-data.js puo' cambiare sorgente senza altre modifiche.
// Lettura pubblica: gli stessi dati sono gia' pubblici su Firebase.
//
// PocketBase 0.40: la callback gira in un contesto JS isolato, tutto inline.

routerAdd("GET", "/api/navisuite-v2/schedule", (e) => {
  const app = e.app;
  const dayOf = (v) => String(v || "").slice(0, 10);

  // --- agenti: id record -> { legacy_id, nome, residenza, qualifica, ruolo } ---
  const agenti = {};
  for (const a of app.findRecordsByFilter("agenti", "1=1", "", 5000, 0)) {
    agenti[a.id] = {
      legacy_id: a.getString("legacy_id"),
      nome: (a.getString("nome_completo") || [a.getString("cognome"), a.getString("nome")].filter(Boolean).join(" ")).trim(),
      residenza: a.getString("residenza"),
      qualifica: a.getString("grado") || a.getString("ruolo"),
      ruolo: a.getString("ruolo"),
      agent_uid: "AG_" + String(a.getString("legacy_id")).toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
    };
  }

  // --- turni effettivi: per residenza -> per agente -> { iso: servizio } ---
  const perAgent = {}; // legacy_id -> { info, turni: {} }
  const ensure = (recId) => {
    const info = agenti[recId];
    if (!info) return null;
    const key = info.legacy_id;
    if (!perAgent[key]) perAgent[key] = { id: key, agente: info.nome, agent_uid: info.agent_uid, qualifica: info.qualifica, residenza: info.residenza, turni: {} };
    return perAgent[key];
  };

  for (const t of app.findRecordsByFilter("turni_effective", "1=1", "data", 20000, 0)) {
    const row = ensure(t.getString("agente"));
    if (!row) continue;
    const iso = dayOf(t.getDateTime("data").string());
    row.turni[iso] = t.getString("servizio");
    const res = t.getString("residenza");
    if (res && !row.residenza) row.residenza = res;
  }

  const residenze = {};
  for (const row of Object.values(perAgent)) {
    const res = row.residenza || "ALTRE";
    (residenze[res] = residenze[res] || []).push({ id: row.id, agente: row.agente, agent_uid: row.agent_uid, qualifica: row.qualifica, turni: row.turni });
  }

  // --- date ---
  const nomiGiorni = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  const nomiMesi = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const dateSet = {};
  for (const row of Object.values(perAgent)) for (const iso of Object.keys(row.turni)) dateSet[iso] = true;
  const settimane = {};
  for (const w of app.findRecordsByFilter("stati_settimana", "1=1", "", 2000, 0)) {
    settimane[dayOf(w.getDateTime("data_inizio").string())] = w.getString("stato");
  }
  let bozzaDal = "";
  try {
    const bp = app.findFirstRecordByFilter("periodi_bozza", "attivo = true");
    if (bp) bozzaDal = dayOf(bp.getDateTime("data_inizio").string());
  } catch (_) {}
  const mondayOf = (iso) => {
    const d = new Date(iso + "T12:00:00Z");
    const shift = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - shift);
    return d.toISOString().slice(0, 10);
  };
  const date = Object.keys(dateSet).sort().map((iso) => {
    const d = new Date(iso + "T12:00:00Z");
    const wk = settimane[mondayOf(iso)];
    const stato = wk === "bozza" || (bozzaDal && iso >= bozzaDal) ? "bozza" : (wk === "nascosta" ? "nascosta" : "ufficiale");
    return {
      iso, giorno: nomiGiorni[d.getUTCDay()], numero: d.getUTCDate(), mese: d.getUTCMonth() + 1, anno: d.getUTCFullYear(),
      label: `${nomiGiorni[d.getUTCDay()]} ${d.getUTCDate()} ${nomiMesi[d.getUTCMonth()]}`, stato,
    };
  });

  // --- variazioni ODS (per gli indicatori) ---
  const variazioni_ods = [];
  for (const v of app.findRecordsByFilter("variazioni", "1=1", "data", 5000, 0)) {
    const pay = v.get("legacy_payload") || {};
    const ag = agenti[v.getString("agente")];
    variazioni_ods.push({
      data: dayOf(v.getDateTime("data").string()),
      id_agente: pay.id_agente || (ag ? ag.legacy_id : ""),
      agente: pay.agente || (ag ? ag.nome : ""),
      turno_originale: v.getString("da_servizio") || pay.turno_originale || "",
      turno_nuovo: v.getString("a_servizio") || pay.turno_nuovo || "",
      ods: pay.ods || "",
      tipo: pay.tipo || v.getString("origine") || "",
      attiva: v.getString("stato") !== "annullata",
    });
  }

  // --- bariste + turni nave ---
  const bariste = [];
  for (const row of residenze["BARISTE"] || []) {
    for (const iso of Object.keys(row.turni)) {
      const srv = row.turni[iso];
      if (srv && srv !== "RIP") bariste.push({ data: iso, corsa: srv, barista: row.agente, id: row.id, attiva: true });
    }
  }
  const turni_navi = [];
  for (const tn of app.findRecordsByFilter("turni_navi", "1=1", "data", 5000, 0)) {
    const pay = tn.get("legacy_payload") || {};
    turni_navi.push({
      data: dayOf(tn.getDateTime("data").string()),
      corsa: tn.getString("servizio"),
      nave: pay.nave || "",
      ormeggio_serale: tn.getString("ormeggio_serale") || "",
      rifornimento_mattina: tn.getBool("rifornimento_mattina"),
      attiva: true,
    });
  }

  // --- override profili + config ---
  const agentProfileOverrides = {};
  let serviceConfigurations = {};
  try {
    const cfg = app.findFirstRecordByFilter("configurazione", 'chiave = "serviceConfigurations"');
    if (cfg) serviceConfigurations = cfg.get("valore") || {};
  } catch (_) {}

  const isoDates = date.map((d) => d.iso);
  return e.json(200, {
    residenze,
    date,
    variazioni_ods,
    bariste,
    turni_navi,
    agentProfileOverrides,
    serviceConfigurations,
    periodo: isoDates.length ? `DAL ${isoDates[0]} AL ${isoDates[isoDates.length - 1]}` : "",
    data_inizio: isoDates[0] || "",
    data_fine: isoDates[isoDates.length - 1] || "",
    bozza_dal: bozzaDal,
    aggiornato_il: new Date().toISOString(),
    _source: "pocketbase",
  });
});
