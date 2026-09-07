'use strict';
const webpush = require('web-push');

const required = ['POCKETBASE_URL', 'PONTERADIO_WORKER_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];
for (const key of required) if (!process.env[key]) { console.error(`[ponteradio] Variabile mancante: ${key}`); process.exit(1); }

const PB = process.env.POCKETBASE_URL.replace(/\/$/, '');
const SECRET = process.env.PONTERADIO_WORKER_SECRET;
const POLL_MS = Math.max(2000, Number(process.env.POLL_MS || 5000));
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:navisuite@example.invalid', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(path, options = {}) {
  const res = await fetch(PB + path, { ...options, headers: { 'Content-Type':'application/json', 'X-PonteRadio-Worker':SECRET, ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `PocketBase HTTP ${res.status}`);
  return data;
}

async function finish(id, status, error = '', expired = []) {
  return api('/api/navisuite-v2/ponteradio/worker/result', { method:'POST', body:JSON.stringify({ id, status, error, expired }) });
}

async function processJob(job) {
  const subs = Array.isArray(job.subscriptions) ? job.subscriptions : [];
  if (!subs.length) return finish(job.id, 'failed', 'Nessuna subscription push attiva per il destinatario.');
  let sent = 0, failed = 0;
  const errors = [], expired = [];
  const payload = JSON.stringify({
    title: job.title || 'Ponte Radio',
    body: job.body || '',
    url: job.url || 'ponteradio.html',
    tag: `navisuite-ponteradio-${job.id}`,
    renotify: true,
    data: { kind: job.kind || 'ponteradio', messageId:job.id, ...(job.meta || {}) }
  });
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint:sub.endpoint, keys:{ p256dh:sub.p256dh, auth:sub.auth } }, payload, { TTL:600 });
      sent++;
    } catch (err) {
      failed++;
      const code = Number(err.statusCode || 0);
      errors.push(`${sub.device || sub.id}:${code || err.message}`);
      if (code === 404 || code === 410) expired.push(sub.id);
    }
  }
  const status = sent && failed ? 'partial' : sent ? 'sent' : 'failed';
  await finish(job.id, status, errors.slice(0,5).join(' | '), expired);
  console.log(`[ponteradio] ${job.id}: ${status}, inviati=${sent}, falliti=${failed}`);
}

let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });

(async () => {
  console.log(`[ponteradio] worker avviato; PocketBase=${PB}; poll=${POLL_MS}ms`);
  while (!stopping) {
    try {
      const data = await api('/api/navisuite-v2/ponteradio/worker/jobs');
      for (const job of (data.jobs || [])) await processJob(job);
    } catch (err) {
      console.error('[ponteradio] ciclo fallito:', err.message);
    }
    await sleep(POLL_MS);
  }
  console.log('[ponteradio] arresto');
})().catch(err => { console.error(err); process.exit(1); });
