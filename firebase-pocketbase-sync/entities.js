'use strict';

// Ogni entita' e' `async (ctx) => stats`, dove stats ha (facoltativi):
//   seen, created, updated, unchanged, deleted  + campi liberi per il riepilogo.
// ctx: { fbGet, pb, pbListAll, pbFindBy, pbFindByLegacy, pbCreate, pbUpdate,
//        pbDelete, upsert, markState, hash, filt, log }
//
// Convenzione: la sorgente autoritativa e' Firebase; qui si scrive solo verso
// PocketBase, in modo idempotente per una chiave stabile.

const isEmpty = v => v == null || (typeof v === 'object' && !Object.keys(v).length) || (Array.isArray(v) && !v.length);

const isoDay = value => {
  const s = String(value || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
};
const pbDate = value => {
  const day = isoDay(value);
  if (day) return `${day} 00:00:00.000Z`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().replace('T', ' ');
};

// Normalizzazione codici turno, allineata a shared-data.js normalizedImportedShift().
const normShift = v => {
  const raw = String(v ?? '').trim().toUpperCase().replace(/[‐‑–—]/g, '-');
  if (!raw || /^(?:RIP(?:\.|-*)?|RIPOSO|-{2,}|={2,})$/.test(raw)) return 'RIP';
  if (/^(?:CONG?\.?|CON;|CONC\.?|C\.)$/.test(raw)) return 'CON';
  if (/^(?:LAV\.?|TERRA)$/.test(raw)) return 'TERRA';
  if (/^F\.?P\.?-*$/.test(raw)) return 'F.P.';
  return raw.replace(/\.{2,}$/g, '.').replace(/-+$/g, '');
};

// ---------------------------------------------------------------------------
// configurazione: blob di configurazione Firebase copiati 1:1 in valore(json).
//   private/adminUpdates/serviceConfigurations -> chiave "serviceConfigurations"
//   private/adminUpdates/announcements         -> chiave "announcementsDrafts"
// ---------------------------------------------------------------------------
async function configurazione(ctx) {
  const map = [
    ['serviceConfigurations', 'private/adminUpdates/serviceConfigurations', 'Configurazione servizi Firebase'],
    ['announcementsDrafts', 'private/adminUpdates/announcements', 'Bozze e impostazioni annunci Firebase'],
  ];
  const stats = { seen: 0, created: 0, updated: 0, unchanged: 0, skipped_empty: 0 };
  for (const [chiave, path, descrizione] of map) {
    const valore = await ctx.fbGet(path);
    stats.seen++;
    // valore e' un campo required: mai sovrascrivere con un blob vuoto/null.
    if (isEmpty(valore)) { stats.skipped_empty++; continue; }
    const changed = await ctx.markState('configurazione', chiave, ctx.hash(valore), path);
    if (!changed) { stats.unchanged++; continue; }
    const result = await ctx.upsert('configurazione', {
      match: () => ctx.pbFindBy('configurazione', `chiave = "${ctx.filt(chiave)}"`),
      desired: { chiave, valore, descrizione, aggiornata_il: new Date().toISOString() },
      compareKeys: ['valore'],
    });
    stats[result] = (stats[result] || 0) + 1;
  }
  return stats;
}

// ---------------------------------------------------------------------------
// periodi_bozza: singolo record (private/adminUpdates/draftPeriod -> {start,end}).
// ---------------------------------------------------------------------------
async function periodi_bozza(ctx) {
  const LEGACY = 'firebase-draft-period';
  const src = await ctx.fbGet('private/adminUpdates/draftPeriod');
  const existing = await ctx.pbFindByLegacy('periodi_bozza', LEGACY);
  const start = isoDay(src?.start);
  const end = isoDay(src?.end);
  const active = Boolean(start && end);

  const desired = {
    legacy_id: LEGACY,
    data_inizio: active ? pbDate(start) : (existing?.data_inizio || '1970-01-01 00:00:00.000Z'),
    data_fine: active ? pbDate(end) : (existing?.data_fine || '1970-01-01 00:00:00.000Z'),
    attivo: active,
    aggiornato_il: new Date().toISOString(),
  };
  const changed = await ctx.markState('periodi_bozza', LEGACY, ctx.hash({ start, end, active }), 'private/adminUpdates/draftPeriod');
  if (!changed) return { seen: 1, unchanged: 1 };
  const result = await ctx.upsert('periodi_bozza', {
    match: existing,
    desired,
    compareKeys: ['data_inizio', 'data_fine', 'attivo'],
  });
  return { seen: 1, [result]: 1 };
}

// ---------------------------------------------------------------------------
// stati_settimana: private/adminUpdates/weekStatuses -> [{start,state}].
// PB select stato = [bozza|ufficiale]: le settimane "nascosta" vengono contate
// ma non scritte (aggiungere il valore all'enum per gestirle).
// ---------------------------------------------------------------------------
async function stati_settimana(ctx) {
  const raw = await ctx.fbGet('private/adminUpdates/weekStatuses');
  const rows = Array.isArray(raw) ? raw : Object.values(raw || {});
  const wanted = new Map(); // isoDay -> stato
  let nascosta = 0;
  for (const row of rows) {
    const day = isoDay(row?.start || row?.data_inizio);
    const stato = String(row?.state || row?.stato || '').toLowerCase();
    if (!day) continue;
    if (stato === 'nascosta') { nascosta++; continue; }
    if (stato === 'bozza' || stato === 'ufficiale') wanted.set(day, stato);
  }

  const existing = await ctx.pbListAll('stati_settimana', { fields: 'id,data_inizio,stato' });
  const byDay = new Map(existing.map(r => [isoDay(r.data_inizio), r]));
  const stats = { seen: wanted.size, created: 0, updated: 0, unchanged: 0, deleted: 0, nascosta };

  for (const [day, stato] of wanted) {
    const row = byDay.get(day);
    if (!row) { await ctx.pbCreate('stati_settimana', { data_inizio: pbDate(day), stato, aggiornato_il: new Date().toISOString() }); stats.created++; }
    else if (row.stato !== stato) { await ctx.pbUpdate('stati_settimana', row.id, { stato, aggiornato_il: new Date().toISOString() }); stats.updated++; }
    else stats.unchanged++;
  }
  for (const [day, row] of byDay) {
    if (!wanted.has(day)) { await ctx.pbDelete('stati_settimana', row.id); stats.deleted++; }
  }
  await ctx.markState('stati_settimana', 'ALL', ctx.hash([...wanted.entries()].sort()), 'private/adminUpdates/weekStatuses');
  return stats;
}

// ---------------------------------------------------------------------------
// annunci: private/adminUpdates/announcements/personal/<agentId>/published.
// Le sezioni (turni/diaria/home/...) restano dentro configurazione/announcementsDrafts.
// ---------------------------------------------------------------------------
async function annunci(ctx) {
  const src = await ctx.fbGet('private/adminUpdates/announcements');
  const personal = src?.personal || {};
  const wanted = new Map(); // legacy_id -> desired
  for (const [agentId, entry] of Object.entries(personal)) {
    const pub = entry?.published;
    if (!pub || entry?.disabled === true || !pub.id) continue;
    wanted.set(String(pub.id), {
      legacy_id: String(pub.id),
      titolo: String(pub.title || 'Messaggio da NaviSuite'),
      testo: String(pub.message || ''),
      pubblicato: true,
      pubblicato_il: pub.publishedAt ? new Date(pub.publishedAt).toISOString() : new Date().toISOString(),
      priorita: 'normale',
      visibilita: { agentId: String(pub.targetAgentId || agentId), scope: String(pub.scope || 'personal') },
    });
  }

  const existing = await ctx.pbListAll('annunci', { filter: 'legacy_id ~ "personal-"', fields: 'id,legacy_id,titolo,testo,pubblicato' });
  const byLegacy = new Map(existing.map(r => [r.legacy_id, r]));
  const stats = { seen: wanted.size, created: 0, updated: 0, unchanged: 0, deleted: 0 };

  for (const [legacyId, desired] of wanted) {
    const row = byLegacy.get(legacyId);
    if (!row) { await ctx.pbCreate('annunci', desired); stats.created++; }
    else {
      const diff = ['titolo', 'testo', 'pubblicato'].some(k => String(row[k] ?? '') !== String(desired[k] ?? ''));
      if (diff) { await ctx.pbUpdate('annunci', row.id, desired); stats.updated++; }
      else stats.unchanged++;
    }
  }
  for (const [legacyId, row] of byLegacy) {
    if (!wanted.has(legacyId) && row.pubblicato) { await ctx.pbUpdate('annunci', row.id, { pubblicato: false }); stats.deleted++; }
  }
  await ctx.markState('annunci', 'personal', ctx.hash([...wanted.keys()].sort()), 'private/adminUpdates/announcements/personal');
  return stats;
}

// ---------------------------------------------------------------------------
// turni_effective: private/adminUpdates/effectiveSchedule -> una riga per
// (agente, data). Il blob e' gia' il turno effettivo mergiato (base + ODS +
// cambi); effective_meta[`${id}|${iso}`] contiene base/origine per le celle
// modificate. Le bariste hanno il turno nell'array bariste[].
// ---------------------------------------------------------------------------
const ORIGIN_MAP = { ods: 'ods', ods_ufficio: 'ods', ods_volontari: 'ods', manuale: 'manuale', cambio: 'cambio_turno', cambio_turno: 'cambio_turno' };

async function turni_effective(ctx) {
  const es = await ctx.fbGet('private/adminUpdates/effectiveSchedule');
  const data = es?.data;
  if (isEmpty(data?.residenze)) return { seen: 0, note: 'effectiveSchedule vuoto' };

  const meta = data.effective_meta || {};
  const dateStato = new Map((data.date || []).map(d => [isoDay(d.iso), String(d.stato || 'ufficiale').toLowerCase()]));
  const statoRow = iso => (dateStato.get(iso) === 'bozza' ? 'bozza' : 'ufficiale');

  // legacy_id agente -> id record PocketBase
  const agenti = await ctx.pbListAll('agenti', { fields: 'id,legacy_id' });
  const agenteId = new Map(agenti.map(a => [String(a.legacy_id), a.id]));

  // stato voluto: "<agenteRecId>\t<iso>" -> { servizio, servizio_base, origine, residenza, stato }
  const wanted = new Map();
  const addWanted = (legacyId, iso, servizio, servizioBase, origine, residenza) => {
    const recId = agenteId.get(String(legacyId));
    if (!recId || !iso || !servizio) return false;
    wanted.set(`${recId}\t${iso}`, {
      agente: recId, data: pbDate(iso), servizio, servizio_base: servizioBase || servizio,
      origine_effective: origine || 'turno_importato', stato: statoRow(iso), residenza: residenza || '',
    });
    return true;
  };

  let noAgent = 0;
  for (const [residenza, list] of Object.entries(data.residenze)) {
    for (const ag of list || []) {
      const id = String(ag.id || '');
      for (const [rawIso, rawSrv] of Object.entries(ag.turni || {})) {
        const iso = isoDay(rawIso);
        const cell = meta[`${id}|${iso}`];
        const servizio = normShift(rawSrv);
        const base = cell ? normShift(cell.baseService) : servizio;
        const origine = cell ? (ORIGIN_MAP[String(cell.origin || '').toLowerCase()] || 'ods') : 'turno_importato';
        if (!addWanted(id, iso, servizio, base, origine, residenza)) noAgent++;
      }
    }
  }
  // Molte righe bariste[] non hanno il campo id: si risale dal nome, come
  // getBaristaProfileId() in turni-shared.js.
  const baristaLegacy = name => {
    const key = String(name || '').toLocaleUpperCase('it').normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    return key ? `BARISTA_${key}` : '';
  };
  for (const b of data.bariste || []) {
    if (!b || b.attiva === false) continue;
    const legacy = b.id || (b.barista ? baristaLegacy(b.barista) : '');
    const srv = normShift(b.corsa);
    if (!addWanted(legacy, isoDay(b.data), srv, srv, 'turno_importato', 'BARISTE')) noAgent++;
  }

  // righe esistenti: "<agente>\t<iso>" -> record
  const existing = await ctx.pbListAll('turni_effective', { fields: 'id,agente,data,servizio,servizio_base,origine_effective,stato,residenza' });
  const byKey = new Map(existing.map(r => [`${r.agente}\t${isoDay(r.data)}`, r]));

  const stats = { seen: wanted.size, created: 0, updated: 0, unchanged: 0, deleted: 0, no_agent: noAgent };
  const cmp = ['servizio', 'servizio_base', 'origine_effective', 'stato', 'residenza'];

  for (const [key, want] of wanted) {
    const row = byKey.get(key);
    if (!row) {
      await ctx.pbCreate('turni_effective', { ...want, versione: 1, override_manuale: false });
      stats.created++;
    } else if (cmp.some(k => String(row[k] ?? '') !== String(want[k] ?? ''))) {
      await ctx.pbUpdate('turni_effective', row.id, want);
      stats.updated++;
    } else stats.unchanged++;
  }
  for (const [key, row] of byKey) {
    if (!wanted.has(key)) { await ctx.pbDelete('turni_effective', row.id); stats.deleted++; }
  }

  await ctx.markState('turni_effective', 'effectiveSchedule',
    ctx.hash([...wanted.entries()].map(([k, v]) => `${k}=${v.servizio}`).sort()),
    'private/adminUpdates/effectiveSchedule');
  return stats;
}

module.exports = {
  ENTITIES: { configurazione, periodi_bozza, stati_settimana, annunci, turni_effective },
};
