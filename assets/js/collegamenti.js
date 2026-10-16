// Collegamenti pubblici tra le residenze (solo admin).
// Orari per stagione (invernale/estiva) salvati sul telefono e su PocketBase (collegamenti_pubblici, chiave "orari"),
// piu' la ricerca "da residenza a residenza, arrivo entro le ..." con eventuali cambi.
(function () {
  const STORAGE = 'navisuite.collegamenti';
  const RESIDENZE = { Desenzano: 'Desenzano FS', Peschiera: 'Peschiera FS', Maderno: 'Maderno', Riva: 'Riva' };
  const CAMBIO_MIN = 3; // minuti minimi per cambiare mezzo alla stessa fermata
  const GIORNI = { FER: 'Lun–sab', LV: 'Lun–ven', SAB: 'Sabato', FEST: 'Festivi', SCO: 'Scuola', TUTTI: 'Tutti i giorni' };
  const TIPI = { bus: '🚌', treno: '🚆', battello: '⛴' };
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const copia = v => JSON.parse(JSON.stringify(v));
  const minuti = t => { const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(t || '').trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const ora = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  const isoLocale = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Orari di base piu' nuovi (versione maggiore): le linee di base vengono aggiornate, quelle aggiunte a mano restano.
  function aggiorna(salvati) {
    const base = window.NaviCollegamentiDefault;
    if (!salvati?.stagioni) return copia(base);
    if ((salvati.versione || 1) >= base.versione) return salvati;
    const out = copia(salvati);
    Object.entries(base.stagioni).forEach(([k, st]) => {
      const qui = out.stagioni[k] || (out.stagioni[k] = { ...copia(st), linee: [] });
      st.linee.forEach(l => { const i = qui.linee.findIndex(x => x.id === l.id); if (i < 0) qui.linee.push(copia(l)); else qui.linee[i] = copia(l); });
    });
    out.versione = base.versione;
    return out;
  }
  let dati = (() => { try { return aggiorna(JSON.parse(localStorage.getItem(STORAGE) || 'null')); } catch (_) { return copia(window.NaviCollegamentiDefault); } })();
  let stagioneVista = null;
  let modifica = null; // id della linea in modifica

  // ---------- tabelle orari ----------
  // testo: "giorni;FER;FEST" poi "Fermata;06:50;07:00" (cella vuota = non ferma)
  function leggiTabella(testo) {
    const righe = String(testo || '').split(/\r?\n/).map(r => r.split(';').map(c => c.trim())).filter(r => r.some(Boolean));
    if (!righe.length) return { giorni: [], fermate: [] };
    const conGiorni = /^giorni$/i.test(righe[0][0]);
    const giorni = conGiorni ? righe[0].slice(1).map(g => g.toUpperCase() || 'FER') : [];
    const fermate = (conGiorni ? righe.slice(1) : righe).map(r => ({ nome: r[0], orari: r.slice(1).map(minuti) }));
    const n = Math.max(giorni.length, ...fermate.map(f => f.orari.length), 0);
    while (giorni.length < n) giorni.push('FER');
    return { giorni, fermate };
  }
  const errori = testo => String(testo || '').split(/\r?\n/).slice(1).flatMap((r, i) => r.split(';').slice(1).map(c => c.trim()).filter(c => c && minuti(c) == null).map(c => `riga ${i + 2}: "${c}"`));

  // ---------- giorni ----------
  function pasqua(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mese = Math.floor((h + l - 7 * m + 114) / 31), giorno = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mese - 1, giorno);
  }
  function festivo(d) {
    if (d.getDay() === 0) return true;
    const md = isoLocale(d).slice(5);
    if (['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'].includes(md)) return true;
    const p = pasqua(d.getFullYear()); p.setDate(p.getDate() + 1);
    return isoLocale(p) === isoLocale(d);
  }
  function valeIl(codice, d) {
    if (codice === 'TUTTI') return true;
    if (festivo(d)) return codice === 'FEST';
    if (d.getDay() === 6) return ['FER', 'SAB', 'SCO'].includes(codice);
    return ['FER', 'LV', 'SCO'].includes(codice);
  }
  // stagione in vigore: quella con la data "dal" piu' recente non successiva al giorno
  function stagioneDel(iso) {
    const voci = Object.entries(dati.stagioni).filter(([, s]) => s.dal).sort((a, b) => a[1].dal.localeCompare(b[1].dal));
    let scelta = voci.length ? voci[voci.length - 1][0] : Object.keys(dati.stagioni)[0];
    for (const [k, s] of voci) if (s.dal <= iso) scelta = k;
    // prima della prima data: vale l'ultima stagione dell'anno precedente
    return scelta;
  }

  // ---------- ricerca itinerari ----------
  function connessioni(stagione, d) {
    const out = [];
    (dati.stagioni[stagione]?.linee || []).forEach(linea => {
      const t = leggiTabella(linea.testo);
      t.giorni.forEach((g, col) => {
        if (!valeIl(g, d)) return;
        const fermate = t.fermate.map(f => ({ nome: f.nome, t: f.orari[col] })).filter(f => f.t != null);
        for (let i = 0; i + 1 < fermate.length; i++) {
          if (fermate[i + 1].t < fermate[i].t) continue;
          out.push({ corsa: `${linea.id}#${col}`, linea, scuola: g === 'SCO', da: fermate[i].nome, a: fermate[i + 1].nome, parte: fermate[i].t, arriva: fermate[i + 1].t });
        }
      });
    });
    return out.sort((x, y) => x.parte - y.parte || x.arriva - y.arriva);
  }
  function viaggio(conn, da, a, inizio) {
    const pronto = { [da]: inizio }, preso = {}, ultimo = {};
    for (const c of conn) {
      if (c.parte < inizio) continue;
      if (!preso[c.corsa] && !(pronto[c.da] != null && pronto[c.da] <= c.parte)) continue;
      if (!preso[c.corsa]) preso[c.corsa] = c;
      const arrivoUtile = c.arriva + (c.a === a ? 0 : CAMBIO_MIN);
      if (pronto[c.a] == null || arrivoUtile < pronto[c.a]) { pronto[c.a] = arrivoUtile; ultimo[c.a] = { sale: preso[c.corsa], scende: c }; }
    }
    if (!ultimo[a]) return null;
    const tratte = [];
    let qui = a;
    while (qui !== da && ultimo[qui] && tratte.length < 8) { const t = ultimo[qui]; tratte.unshift(t); qui = t.sale.da; }
    if (qui !== da) return null;
    return { parte: tratte[0].sale.parte, arriva: tratte[tratte.length - 1].scende.arriva, tratte };
  }
  function cerca(daRes, aRes, iso, entro) {
    const d = new Date(`${iso}T12:00:00`), stagione = stagioneDel(iso);
    const conn = connessioni(stagione, d), da = RESIDENZE[daRes], a = RESIDENZE[aRes];
    const partenze = [...new Set(conn.filter(c => c.da === da).map(c => c.parte))].sort((x, y) => y - x);
    const visti = new Set(), validi = [], dopo = [];
    for (const p of partenze) {
      const v = viaggio(conn, da, a, p);
      if (!v) continue;
      const chiave = `${v.parte}-${v.arriva}`;
      if (visti.has(chiave)) continue;
      visti.add(chiave);
      (entro == null || v.arriva <= entro ? validi : dopo).push(v);
    }
    // a parita' di arrivo vale la partenza piu' tardi
    const migliori = validi.filter(v => !validi.some(w => w !== v && w.arriva <= v.arriva && w.parte > v.parte));
    migliori.sort((x, y) => y.arriva - x.arriva || y.parte - x.parte);
    dopo.sort((x, y) => x.arriva - y.arriva);
    return { stagione, festivo: festivo(d), validi: migliori.slice(0, 4), primoDopo: dopo[0] || null };
  }

  // ---------- disegno ----------
  function disegnaViaggio(v, entro) {
    const scuola = v.tratte.some(t => t.sale.scuola);
    const cambi = v.tratte.length - 1;
    const margine = entro != null ? entro - v.arriva : null;
    return `<article class="col-viaggio${margine != null && margine < 0 ? ' tardi' : ''}">
      <header><b>${ora(v.parte)} → ${ora(v.arriva)}</b><span>${cambi ? `${cambi} cambio${cambi > 1 ? 'i' : ''}` : 'diretto'} · ${ora(v.arriva - v.parte)} h${margine != null ? ` · ${margine >= 0 ? `${margine} min di margine` : `${-margine} min in ritardo`}` : ''}</span></header>
      <ol>${v.tratte.map(t => `<li><span class="col-tipo">${TIPI[t.sale.linea.tipo] || '•'}</span><div><b>${esc(t.sale.linea.nome)}</b><small>${esc(t.sale.da)} ${ora(t.sale.parte)} → ${esc(t.scende.a)} ${ora(t.scende.arriva)}${t.sale.scuola ? ' · solo giorni di scuola' : ''}</small></div></li>`).join('')}</ol>
      ${scuola ? '<p class="col-nota">⚠ Una corsa vale solo nei giorni di scuola.</p>' : ''}
    </article>`;
  }
  function eseguiRicerca() {
    const da = $('col-da').value, a = $('col-a').value, iso = $('col-giorno').value, entro = minuti($('col-entro').value);
    const out = $('col-risultati');
    if (!iso || da === a) { out.innerHTML = '<p class="empty">Scegli due residenze diverse e il giorno.</p>'; return; }
    const r = cerca(da, a, iso, entro);
    const testa = `<p class="col-info">Orario ${esc(dati.stagioni[r.stagione]?.nome || r.stagione)}${r.festivo ? ' · giorno festivo' : ''}</p>`;
    if (r.validi.length) { out.innerHTML = testa + r.validi.map(v => disegnaViaggio(v, entro)).join(''); return; }
    out.innerHTML = testa + `<p class="col-no">✕ Nessun mezzo pubblico arriva a ${esc(a)}${entro != null ? ` entro le ${ora(entro)}` : ''}: serve un'auto o il pernotto.</p>` +
      (r.primoDopo ? `<p class="col-info">Primo arrivo possibile:</p>${disegnaViaggio(r.primoDopo, entro)}` : '<p class="col-info">Con gli orari inseriti non c\'è nessun collegamento in quel giorno.</p>');
  }

  function disegnaStagioni() {
    $('col-stagioni').innerHTML = Object.entries(dati.stagioni).map(([k, s]) => `<button type="button" role="tab" class="${k === stagioneVista ? 'active' : ''}" data-stagione="${k}">${esc(s.nome)}<small>dal ${esc(s.dal ? s.dal.split('-').reverse().join('/') : '—')}</small></button>`).join('');
    const s = dati.stagioni[stagioneVista];
    $('col-dal').value = s?.dal || '';
  }
  function disegnaTabella(linea) {
    const t = leggiTabella(linea.testo);
    if (!t.giorni.length) return '<p class="empty">Nessuna corsa inserita: tocca «Modifica» per aggiungere gli orari.</p>';
    return `<div class="table-wrap"><table class="col-tab"><thead><tr><th></th>${t.giorni.map(g => `<th class="g-${g.toLowerCase()}">${esc(GIORNI[g] || g)}</th>`).join('')}</tr></thead><tbody>${t.fermate.map(f => `<tr><th>${esc(f.nome)}</th>${t.giorni.map((_, i) => `<td>${f.orari[i] != null ? ora(f.orari[i]) : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function disegnaLinee() {
    const linee = dati.stagioni[stagioneVista]?.linee || [];
    $('col-count').textContent = linee.length;
    $('col-linee').innerHTML = linee.map(l => {
      const inModifica = modifica === l.id;
      return `<article class="col-linea" data-id="${esc(l.id)}">
        <header><span class="col-tipo">${TIPI[l.tipo] || '•'}</span><div><h3>${esc(l.nome)}</h3>${l.note ? `<p>${esc(l.note)}</p>` : ''}${l.fonte ? `<a href="${esc(l.fonte)}" target="_blank" rel="noopener">Orario ufficiale ↗</a>` : ''}</div>
        ${inModifica ? '' : '<button type="button" class="btn" data-azione="modifica">Modifica</button>'}</header>
        ${inModifica ? `<div class="col-form">
          <label>Nome<input data-campo="nome" value="${esc(l.nome)}"></label>
          <label>Mezzo<select data-campo="tipo">${Object.keys(TIPI).map(k => `<option value="${k}"${k === l.tipo ? ' selected' : ''}>${TIPI[k]} ${k}</option>`).join('')}</select></label>
          <label>Note<input data-campo="note" value="${esc(l.note || '')}"></label>
          <label>Link orario ufficiale<input data-campo="fonte" value="${esc(l.fonte || '')}"></label>
          <label class="col-wide">Orari: prima riga i giorni (FER, LV, SAB, FEST, SCO, TUTTI), poi una riga per fermata. Separa con «;», lascia vuoto se il mezzo non ferma.<textarea data-campo="testo" rows="${Math.max(4, leggiTabella(l.testo).fermate.length + 2)}" spellcheck="false">${esc(l.testo)}</textarea></label>
          <p class="col-errori" hidden></p>
          <div class="col-azioni"><button type="button" class="btn primary" data-azione="salva">Salva</button><button type="button" class="btn" data-azione="annulla">Annulla</button><button type="button" class="btn danger" data-azione="elimina">Elimina linea</button></div>
        </div>` : disegnaTabella(l)}
      </article>`;
    }).join('') || '<p class="empty">Nessuna linea per questa stagione.</p>';
  }
  const disegna = () => { disegnaStagioni(); disegnaLinee(); eseguiRicerca(); };

  // ---------- salvataggio ----------
  const PB_DEFAULT = 'https://truenas-scale.tail805e51.ts.net:8443';
  const pbBase = () => { try { return (localStorage.getItem('navisuite.pbBase') || PB_DEFAULT).replace(/\/$/, ''); } catch (_) { return PB_DEFAULT; } };
  const PB_URL = () => `${pbBase()}/api/collections/collegamenti_pubblici/records`;
  const FILTRO = encodeURIComponent('chiave = "orari"');
  let pbId = null;
  async function pbFetch(url, opts = {}) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const token = (() => { try { return localStorage.getItem('navisuite.pb.token') || ''; } catch (_) { return ''; } })();
      const res = await fetch(url, { ...opts, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) }, cache: 'no-store', signal: ctrl.signal });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.message || `PocketBase ${res.status}`);
      return out;
    } finally { clearTimeout(t); }
  }
  const stato = (testo, tipo = '') => { const el = $('col-status'); el.textContent = testo; el.className = `col-status ${tipo}`; };
  async function scarica() {
    try {
      const rec = (await pbFetch(`${PB_URL()}?perPage=1&filter=${FILTRO}`)).items?.[0];
      if (!rec) { stato('Orari di base: salva una modifica per condividerli'); return; }
      pbId = rec.id;
      const remoti = rec.dati?.stagioni ? aggiorna(rec.dati) : null;
      if (remoti && remoti.versione !== rec.dati.versione) { dati = remoti; salva(); }
      else if (remoti && JSON.stringify(remoti) !== JSON.stringify(dati)) {
        dati = remoti;
        localStorage.setItem(STORAGE, JSON.stringify(dati));
        if (!dati.stagioni[stagioneVista]) stagioneVista = stagioneDel(isoLocale(new Date()));
        if (!modifica) disegna();
      }
      stato(`Aggiornati ${rec.aggiornato_da ? `da ${rec.aggiornato_da}` : ''}`.trim(), 'ok');
    } catch (error) { console.warn('Collegamenti non letti da PocketBase', error); stato('Copia sul telefono (PocketBase non raggiungibile)', 'bad'); }
  }
  async function salva() {
    localStorage.setItem(STORAGE, JSON.stringify(dati));
    stato('Salvataggio…');
    const agente = (() => { try { const a = JSON.parse(localStorage.getItem('navidiaria.activeAgent') || 'null'); return a ? `${a.id} ${a.name || ''}`.trim() : ''; } catch (_) { return ''; } })();
    const corpo = JSON.stringify({ chiave: 'orari', dati, aggiornato_da: agente });
    try {
      if (!pbId) pbId = (await pbFetch(`${PB_URL()}?perPage=1&filter=${FILTRO}`)).items?.[0]?.id || null;
      const out = pbId ? await pbFetch(`${PB_URL()}/${encodeURIComponent(pbId)}`, { method: 'PATCH', body: corpo }) : await pbFetch(PB_URL(), { method: 'POST', body: corpo });
      pbId = out.id;
      stato('Salvato per tutti', 'ok');
    } catch (error) { console.warn('Collegamenti non salvati su PocketBase', error); stato(`Salvato solo sul telefono: ${error.message}`, 'bad'); }
  }

  // ---------- eventi ----------
  function avvia() {
    const domani = new Date(); domani.setDate(domani.getDate() + 1);
    $('col-giorno').value = isoLocale(domani);
    ['col-da', 'col-a'].forEach((id, i) => { $(id).innerHTML = Object.keys(RESIDENZE).map(r => `<option>${r}</option>`).join(''); $(id).value = i ? 'Maderno' : 'Desenzano'; });
    stagioneVista = stagioneDel(isoLocale(new Date()));
    ['col-da', 'col-a', 'col-giorno', 'col-entro'].forEach(id => $(id).addEventListener('input', eseguiRicerca));
    $('col-inverti').addEventListener('click', () => { const x = $('col-da').value; $('col-da').value = $('col-a').value; $('col-a').value = x; eseguiRicerca(); });
    $('col-stagioni').addEventListener('click', e => { const b = e.target.closest('[data-stagione]'); if (!b) return; stagioneVista = b.dataset.stagione; modifica = null; disegnaStagioni(); disegnaLinee(); });
    $('col-dal').addEventListener('change', () => { dati.stagioni[stagioneVista].dal = $('col-dal').value; disegna(); salva(); });
    $('col-aggiungi').addEventListener('click', () => {
      const id = `linea-${Date.now().toString(36)}`;
      dati.stagioni[stagioneVista].linee.push({ id, nome: 'Nuova linea', tipo: 'bus', testo: 'giorni;FER\nPartenza;\nArrivo;', fonte: '', note: '' });
      modifica = id; disegnaLinee();
      document.querySelector(`.col-linea[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $('col-copia').addEventListener('click', () => {
      const altre = Object.keys(dati.stagioni).filter(k => k !== stagioneVista);
      const da = altre[0]; if (!da) return;
      if (!confirm(`Copiare nella stagione ${dati.stagioni[stagioneVista].nome} le linee che mancano dalla stagione ${dati.stagioni[da].nome}?`)) return;
      const qui = dati.stagioni[stagioneVista].linee;
      dati.stagioni[da].linee.forEach(l => { if (!qui.some(x => x.id === l.id)) qui.push(copia(l)); });
      disegna(); salva();
    });
    $('col-linee').addEventListener('click', e => {
      const b = e.target.closest('[data-azione]'); if (!b) return;
      const card = b.closest('.col-linea'), linee = dati.stagioni[stagioneVista].linee, linea = linee.find(l => l.id === card.dataset.id);
      if (!linea) return;
      const azione = b.dataset.azione;
      if (azione === 'modifica') { modifica = linea.id; disegnaLinee(); return; }
      if (azione === 'annulla') { modifica = null; disegnaLinee(); return; }
      if (azione === 'elimina') {
        if (!confirm(`Eliminare «${linea.nome}» dalla stagione ${dati.stagioni[stagioneVista].nome}?`)) return;
        linee.splice(linee.indexOf(linea), 1); modifica = null; disegna(); salva(); return;
      }
      if (azione === 'salva') {
        const campi = Object.fromEntries([...card.querySelectorAll('[data-campo]')].map(el => [el.dataset.campo, el.value.trim()]));
        const sbagliati = errori(campi.testo);
        if (sbagliati.length) { const p = card.querySelector('.col-errori'); p.hidden = false; p.textContent = `Orari non validi (usa hh:mm): ${sbagliati.slice(0, 5).join(', ')}`; return; }
        Object.assign(linea, campi, { nome: campi.nome || 'Linea' });
        modifica = null; disegna(); salva();
      }
    });
    disegna();
    scarica();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scarica(); });
  }

  window.NaviCollegamenti = { aggiorna, leggiTabella, cerca, valeIl, festivo, stagioneDel, get dati() { return dati; }, set dati(v) { dati = v; } };
  if (typeof document !== 'undefined' && document.getElementById('col-linee')) avvia();
})();
