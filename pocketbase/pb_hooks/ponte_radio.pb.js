/// <reference path="../pb_data/types.d.ts" />

// PocketBase 0.40 executes each custom route callback in an isolated JS
// context. Route callbacks must therefore be self-contained: helpers declared
// elsewhere in this file are not visible when a request is handled.

routerAdd("GET", "/api/navisuite-v2/ponteradio/recipients", (e) => {
  if (!e.auth) throw new ForbiddenError("Accesso richiesto.");
  const loginId = String(e.auth.getString("login_id") || "").trim();
  if (!loginId) throw new ForbiddenError("Profilo agente non associato.");
  let me = null;
  try {
    me = e.app.findFirstRecordByFilter("agenti", "legacy_id = {:login}", { login: loginId });
  } catch (_) {
    throw new ForbiddenError("Profilo agente non trovato.");
  }

  const agents = e.app.findRecordsByFilter("agenti", "attivo = true", "", 500, 0);
  const recipients = [];
  for (const agent of agents) {
    if (!agent) continue;
    const name = String(
      agent.getString("nome_completo") ||
      [agent.getString("cognome"), agent.getString("nome")].filter(Boolean).join(" ") ||
      agent.getString("legacy_id")
    ).trim();
    recipients.push({ id: agent.id, legacy_id: agent.getString("legacy_id"), name: name });
  }
  recipients.sort((a, b) => String(a.name).localeCompare(String(b.name), "it"));
  const role = String(e.auth.getString("role") || "").toLowerCase();
  return e.json(200, {
    recipients: recipients,
    canBroadcast: role === "admin" || role === "super_user" || e.hasSuperuserAuth(),
  });
}, $apis.requireAuth());

routerAdd("POST", "/api/navisuite-v2/ponteradio/subscription", (e) => {
  if (!e.auth) throw new ForbiddenError("Accesso richiesto.");
  const loginId = String(e.auth.getString("login_id") || "").trim();
  if (!loginId) throw new ForbiddenError("Profilo agente non associato.");
  let agent = null;
  try {
    agent = e.app.findFirstRecordByFilter("agenti", "legacy_id = {:login}", { login: loginId });
  } catch (_) {
    throw new ForbiddenError("Profilo agente non trovato.");
  }

  const body = new DynamicModel({
    device_id: "",
    device_label: "",
    endpoint: "",
    p256dh: "",
    auth_key: "",
    enabled: true,
    vapid_version: 2,
    preferences: {},
  });
  e.bindBody(body);

  const deviceId = String(body.device_id || "").trim();
  const endpoint = String(body.endpoint || "").trim();
  const p256dh = String(body.p256dh || "").trim();
  const authKey = String(body.auth_key || "").trim();
  if (!deviceId || !endpoint || !p256dh || !authKey) {
    throw new BadRequestError("Subscription incompleta.");
  }

  let record = null;
  try {
    record = e.app.findFirstRecordByFilter(
      "push_subscriptions",
      "agente = {:agent} && device_id = {:device}",
      { agent: agent.id, device: deviceId }
    );
  } catch (_) {
    record = new Record(e.app.findCollectionByNameOrId("push_subscriptions"));
  }

  record.set("user", e.auth.id);
  record.set("agente", agent.id);
  record.set("device_id", deviceId.slice(0, 160));
  record.set("device_label", String(body.device_label || "").slice(0, 80));
  record.set("endpoint", endpoint);
  record.set("p256dh", p256dh);
  record.set("auth_key", authKey);
  record.set("enabled", body.enabled !== false);
  record.set("vapid_version", Number(body.vapid_version || 2));
  record.set("preferences", body.preferences || {});
  e.app.save(record);

  return e.json(200, { id: record.id, enabled: record.getBool("enabled") });
}, $apis.requireAuth());

routerAdd("POST", "/api/navisuite-v2/ponteradio/send", (e) => {
  if (!e.auth) throw new ForbiddenError("Accesso richiesto.");
  const loginId = String(e.auth.getString("login_id") || "").trim();
  if (!loginId) throw new ForbiddenError("Profilo agente non associato.");
  let sender = null;
  try {
    sender = e.app.findFirstRecordByFilter("agenti", "legacy_id = {:login}", { login: loginId });
  } catch (_) {
    throw new ForbiddenError("Profilo agente non trovato.");
  }

  const body = new DynamicModel({ target_agent: "", broadcast: false, body: "" });
  e.bindBody(body);
  const message = String(body.body || "").trim();
  if (!message) throw new BadRequestError("Scrivi un messaggio.");
  if (message.length > 500) throw new BadRequestError("Messaggio troppo lungo.");

  const broadcast = body.broadcast === true;
  const role = String(e.auth.getString("role") || "").toLowerCase();
  const isAdmin = role === "admin" || role === "super_user" || e.hasSuperuserAuth();
  if (broadcast && !isAdmin) {
    throw new ForbiddenError("Invio a tutti riservato agli amministratori.");
  }

  let targetId = String(body.target_agent || "").trim();
  if (!broadcast) {
    if (!targetId) throw new BadRequestError("Destinatario mancante.");
    const target = e.app.findRecordById("agenti", targetId);
    if (!target.getBool("attivo")) throw new BadRequestError("Destinatario non attivo.");
  } else {
    targetId = "";
  }

  const senderName = String(
    sender.getString("nome_completo") ||
    [sender.getString("cognome"), sender.getString("nome")].filter(Boolean).join(" ") ||
    sender.getString("legacy_id")
  ).trim();
  const queue = new Record(e.app.findCollectionByNameOrId("push_queue"));
  queue.set("requested_by", e.auth.id);
  queue.set("sender_agent", sender.id);
  if (targetId) queue.set("target_agent", targetId);
  queue.set("broadcast", broadcast);
  queue.set("kind", "ponteradio");
  queue.set("status", "pending");
  queue.set("title", ("Ponte Radio · " + senderName).slice(0, 120));
  queue.set("body", message);
  queue.set("url", "ponteradio.html");
  queue.set("meta", {
    senderAgentId: sender.id,
    senderName: senderName,
    sentAt: new Date().toISOString(),
  });
  e.app.save(queue);

  return e.json(202, { id: queue.id, status: "pending" });
}, $apis.requireAuth());

routerAdd("GET", "/api/navisuite-v2/ponteradio/worker/jobs", (e) => {
  const expected = String($os.getenv("PONTERADIO_WORKER_SECRET") || "").trim();
  const supplied = String(e.request.header.get("X-PonteRadio-Worker") || "").trim();
  if (!expected || supplied !== expected) throw new ForbiddenError("Worker non autorizzato.");

  const jobs = e.app.findRecordsByFilter("push_queue", "status = 'pending'", "", 25, 0);
  const result = [];
  for (const job of jobs) {
    if (!job) continue;
    job.set("status", "processing");
    e.app.save(job);

    const targetId = job.getString("target_agent");
    const broadcast = job.getBool("broadcast");
    const subscriptions = broadcast
      ? e.app.findRecordsByFilter("push_subscriptions", "enabled = true", "", 500, 0)
      : e.app.findRecordsByFilter(
          "push_subscriptions",
          "enabled = true && agente = {:agent}",
          "",
          500,
          0,
          { agent: targetId }
        );

    result.push({
      id: job.id,
      title: job.getString("title"),
      body: job.getString("body"),
      url: job.getString("url"),
      kind: job.getString("kind"),
      meta: job.get("meta") || {},
      subscriptions: subscriptions.filter(Boolean).map((subscription) => ({
        id: subscription.id,
        endpoint: subscription.getString("endpoint"),
        p256dh: subscription.getString("p256dh"),
        auth: subscription.getString("auth_key"),
        device: subscription.getString("device_label") || subscription.getString("device_id"),
      })),
    });
  }
  return e.json(200, { jobs: result });
});

routerAdd("POST", "/api/navisuite-v2/ponteradio/worker/result", (e) => {
  const expected = String($os.getenv("PONTERADIO_WORKER_SECRET") || "").trim();
  const supplied = String(e.request.header.get("X-PonteRadio-Worker") || "").trim();
  if (!expected || supplied !== expected) throw new ForbiddenError("Worker non autorizzato.");

  const body = new DynamicModel({ id: "", status: "", error: "", expired: [] });
  e.bindBody(body);
  const id = String(body.id || "").trim();
  if (!id) throw new BadRequestError("Job mancante.");

  const job = e.app.findRecordById("push_queue", id);
  const suppliedStatus = String(body.status || "");
  const status = ["sent", "partial", "failed"].includes(suppliedStatus) ? suppliedStatus : "failed";
  job.set("status", status);
  job.set("error", String(body.error || "").slice(0, 1000));
  job.set("processed_at", new Date().toISOString());
  // La coda e' solo trasporto: dopo il tentativo conserviamo lo stato
  // operativo, non il contenuto della conversazione.
  job.set("title", "Ponte Radio");
  job.set("body", "[contenuto eliminato dopo l'invio]");
  job.set("url", "ponteradio.html");
  job.set("meta", {});
  e.app.save(job);

  for (const subscriptionId of (body.expired || [])) {
    try {
      const subscription = e.app.findRecordById("push_subscriptions", String(subscriptionId));
      subscription.set("enabled", false);
      e.app.save(subscription);
    } catch (_) {}
  }
  return e.json(200, { ok: true });
});
