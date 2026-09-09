'use strict';

// Ogni entita' e' `async (ctx) => stats`, dove stats ha (facoltativi):
//   seen, created, updated, unchanged, deleted  + campi liberi per il riepilogo.
// ctx: { fbGet, pb, pbListAll, pbFindBy, pbFindByLegacy, pbCreate, pbUpdate,
//        pbDelete, upsert, markState, hash, filt, log }
//
// Convenzione: la sorgente autoritativa e' Firebase; qui si scrive solo verso
// PocketBase, in modo idempotente per una chiave stabile.

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

// ---------------------------------------------------------------------------
// configurazione: blob di configurazione Firebase copiati 1:1 in valore(json).
//   private/adminUpdates/shipConfigurations -> chiave "serviceConfigurations"
//   private/adminUpdates/announcements      -> chiave "announcementsDrafts"
// ---------------------------------------------------------------------------
async function configurazione(ctx) {
  const map = [
    ['serviceConfigurations', 'private/adminUpdates/shipConfigurations', 'Configurazione servizi Firebase'],
    ['announcementsDrafts', 'private/adminUpdates/announcements', 'Bozze e impostazioni annunci Firebase'],
  ];
  const stats = { seen: 0, created: 0, updated: 0, unchanged: 0 };
  for (const [chiave, path, descrizione] of map) {
    const valore = (await ctx.fbGet(path)) ?? {};
    stats.seen++;
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

module.exports = {
  ENTITIES: { configurazione, periodi_bozza, stati_settimana, annunci },
};
