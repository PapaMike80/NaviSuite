// A4 "Servizi a terra" di Desenzano (pontile e AgB) da stampare su laser bianco/nero:
// navi in ordine di orario (orario invernale, O.d.S. n. 39/2026) e ormeggi serali della
// settimana lun-dom con i rifornimenti, presi dai turni nave letti dagli O.d.S.
// Stessa impaginazione di tools/stampe/a4_desenzano.py.
(function () {
  'use strict';

  // (ora, P/A, turno, corsa, da/per) - O.d.S. 39/2026 pag. 15-16 e BIS pag. 18
  const NAVI = [
    ['8.30', 'P', 'BIS', '', 'per Garda (a disposizione)'],
    ['8.50', 'P', 'D2', '20', 'per Lazise (via Garda)'],
    ['9.15', 'P', 'D1', '14', 'per Sirmione'],
    ['9.55', 'A', 'D1', '15', 'da Sirmione'],
    ['10.05', 'P', 'D1', '16', 'per Maderno'],
    ['10.30', 'A', 'P2', '31', 'da Lazise'],
    ['10.40', 'P', 'P2', '32', 'per Sirmione'],
    ['11.20', 'A', 'P2', '33', 'da Sirmione'],
    ['11.25', 'P', 'P2', '34', 'per Garda'],
    ['12.15', 'A', 'M1', '91', 'da Maderno'],
    ['13.15', 'P', 'M1', '92', 'per Gardone'],
    ['13.30', 'A', 'R1', '7', 'da Riva'],
    ['14.30', 'P', 'R1', '8', 'per Riva'],
    ['15.25', 'A', 'P2', '35', 'da Garda'],
    ['15.35', 'P', 'P2', '36', 'per Sirmione'],
    ['16.15', 'A', 'P2', '37', 'da Sirmione'],
    ['16.20', 'P', 'P2', '38', 'per Garda'],
    ['16.55', 'A', 'D1', '17', 'da Maderno'],
    ['17.05', 'P', 'D1', '18', 'per Garda'],
    ['18.40', 'A', 'BIS', '', 'da Garda'],
    ['19.00', 'A', 'D2', '27', 'da Lazise'],
    ['19.40', 'A', 'D1', '19', 'da Garda']
  ];
  const GRUPPI = ['D1', 'D2', 'D3', 'D4', 'BIS'];
  const GIORNI = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const parseIso = value => { const [y, m, d] = String(value).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

  // Lunedi' della settimana da stampare: quella in corso, oppure la prossima da venerdi' in poi
  // (l'O.d.S. esce il venerdi' e copre fino al venerdi' successivo).
  function defaultMonday(today = new Date()) {
    const day = (today.getDay() + 6) % 7; // 0 = lunedi'
    const monday = addDays(today, -day);
    return iso(day >= 4 ? addDays(monday, 7) : monday);
  }

  // {data: {gruppo: {nave, pontile, rif, ods}}} dai turni nave (attivi) dell'app.
  // Se piu' righe descrivono lo stesso giorno e gruppo vince l'O.d.S. con il numero piu' alto
  // (a parita', la riga inserita per ultima); le righe ancora da salvare vincono sempre.
  const rank = row => [row._pending ? 1 : 0, Number(String(row.ods || '').match(/\d+/)?.[0] || 0), String(row.inserita_il || '')];
  const newer = (a, b) => { const x = rank(a), y = rank(b); return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2]); };
  function indexTurniNavi(rows) {
    const out = {};
    [...(rows || [])].sort(newer).forEach(row => {
      if (!row || row.attiva === false) return;
      const group = String(row.corsa || '').toUpperCase().replace(/^BIS2$/, 'BIS');
      if (!GRUPPI.includes(group) || !row.data) return;
      const mooring = String(row.ormeggio_serale || '').trim();
      const number = mooring.match(/pont(?:ile)?\.?\s*(\d+)/i)?.[1];
      (out[row.data] = out[row.data] || {})[group] = {
        nave: String(row.nave || '').replace(/\s*(\([A-Z]\)|©)/g, '').trim(),
        pontile: number || (/pont/i.test(mooring) ? mooring : ''),
        rif: /^s[iì]$/i.test(String(row.rifornimento_mattina || '').trim()) || /riforn/i.test(String(row.rifornimento_mattina || '')),
        ods: String(row.ods || '').replace(/^ODS\s*/i, '').replace(/\/\d{4}$/, '')
      };
    });
    return out;
  }

  function buildHtml(turniNavi, monday) {
    const data = indexTurniNavi(turniNavi);
    const days = Array.from({ length: 7 }, (_, i) => addDays(parseIso(monday), i));
    const known = days.map(iso).filter(day => data[day]);
    let groups = GRUPPI.filter(g => known.some(day => data[day][g] && data[day][g].pontile));
    if (!groups.length) groups = ['D1', 'D2', 'BIS'];
    const ods = [...new Set(known.flatMap(day => Object.values(data[day]).map(v => v.ods)).filter(Boolean))].sort();
    const fmt = d => `${d.getDate()}/${d.getMonth() + 1}`;

    const naviRows = NAVI.map(([time, kind, code, run, where], i) =>
      `<tr class="${i % 2 ? '' : 'stripe'}${time === '14.30' ? ' split' : ''}"><td class="time">${time}</td>` +
      `<td class="kind">${kind === 'P' ? 'PARTENZA' : 'ARRIVO'}</td><td class="code">${code}</td>` +
      `<td class="run">${run || '–'}</td><td class="where">${esc(where)}</td></tr>`).join('');

    const head = days.map((d, i) => `<th>${GIORNI[i]} ${fmt(d)}</th>`).join('');
    const body = groups.map((g, gi) => `<tr class="${gi % 2 ? '' : 'stripe'}"><th>${g}</th>` + days.map(d => {
      const day = data[iso(d)];
      if (!day) return gi === 0 ? `<td class="next" rowspan="${groups.length}">nel prossimo<br>O.d.S.</td>` : '';
      const v = day[g];
      if (!v) return '<td class="none">–</td>';
      return `<td><span class="pont">${esc(v.pontile || '–')}</span>${v.rif ? '<span class="rif">R</span>' : ''}` +
        `<span class="ship">${esc(v.nave)}</span></td>`;
    }).join('') + '</tr>').join('');

    return `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Servizi a terra Desenzano ${fmt(days[0])}-${fmt(days[6])}</title>
<style>
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:#d8dde2;color:#000;font-family:"DejaVu Sans",Verdana,Arial,sans-serif}
.sheet{width:210mm;height:297mm;margin:8mm auto;background:#fff;padding:13mm 18mm 10mm;overflow:hidden}
h1{font-size:26pt;margin:0;line-height:1}
.sub{font-size:12pt;margin:2mm 0 0}.src{font-size:9pt;color:#333;margin:1.5mm 0 0}
.boxes{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:4mm}
.box{border:1px solid #000;border-radius:3mm;padding:2.5mm 5mm;display:grid;grid-template-columns:auto 1fr;row-gap:.5mm}
.box b{font-size:16pt}.box .h{text-align:right;font-size:13pt;line-height:1.25}.box small{grid-column:1/-1;font-size:7.5pt;color:#333}
table{border-collapse:collapse;width:100%}
.navi{margin-top:6mm}.navi th{background:#000;color:#fff;font-size:9pt;text-align:left;padding:1.4mm 2mm}
.navi td{height:6.1mm;padding:0 2mm;font-size:12pt;white-space:nowrap}
.navi .time{font-weight:700;font-size:15pt;text-align:right;width:20mm}.navi .kind{font-weight:700;font-size:10.5pt;width:30mm}
.navi .code{font-weight:700;font-size:15pt;width:22mm}.navi .run{width:22mm}
.stripe td,.stripe th{background:#ededed}.navi tr.split td{border-top:1.4px solid #000}
.orm-title{margin:5mm 0 2mm;font-size:12pt;font-weight:700;white-space:nowrap}.orm-title span{font-weight:400;font-size:8.5pt;color:#333;margin-left:3mm}
.orm{table-layout:fixed}.orm thead th{background:#000;color:#fff;font-size:9pt;padding:1.3mm 0}
.orm thead th:first-child{width:12mm}
.orm tbody th{text-align:left;font-size:12pt;padding-left:1.5mm}
.orm td{height:9.2mm;text-align:center;border-left:.4px solid #000;line-height:1.05}
.orm .pont{font-weight:700;font-size:14pt}.orm .rif{font-weight:700;font-size:9pt;margin-left:1.2mm;vertical-align:2pt}
.orm .ship{display:block;font-size:7pt;white-space:nowrap;overflow:hidden}
.orm .next{font-size:6.5pt;color:#333;background:#fff}.orm .none{font-size:10pt}
.rules{margin-top:4mm;font-size:8.4pt;line-height:1.45}.rules b{font-size:8.6pt}
.notes{margin-top:1.5mm;font-size:8.2pt;color:#333;line-height:1.45}
.print-actions{position:fixed;top:8px;right:8px;display:flex;gap:6px}
.print-actions button{font:700 13px sans-serif;padding:8px 12px;border-radius:8px;border:1px solid #000;background:#fff;cursor:pointer}
@media print{html,body{background:#fff}.sheet{margin:0}.print-actions{display:none}}
</style></head><body>
<div class="print-actions"><button type="button" onclick="window.print()">Stampa / PDF</button></div>
<div class="sheet">
<h1>DESENZANO</h1>
<p class="sub">Pontile e AgB - navi in ordine di orario e ormeggi serali</p>
<p class="src">Dal 5 ottobre all'1 novembre 2026 e dal 13 al 25 marzo 2027 · O.d.S. n. 39/2026</p>
<div class="boxes">
<div class="box"><b>AgB</b><span class="h">8.00 – 11.50<br>12.50 – 17.30</span><small>dalle 7.45 con rifornimento D2 · assistenza alla c. 8</small></div>
<div class="box"><b>PonD</b><span class="h">9.30 – 13.35<br>15.00 – 19.50</span><small>8 ore 55'</small></div>
</div>
<table class="navi"><thead><tr><th>ORA</th><th></th><th>TURNO</th><th>CORSA</th><th>DA / PER</th></tr></thead><tbody>${naviRows}</tbody></table>
<div class="orm-title">ORMEGGI SERALI ${fmt(days[0])} – ${fmt(days[6])}<span>nave e pontile della sera · R = rifornimento · turno navi O.d.S. ${esc(ods.join(', ') || '–')}</span></div>
<table class="orm"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table>
<div class="rules"><b>R = rifornimento a Desenzano prima delle corse, per quanto possibile a cura di AgB o PonD:</b><br>
D1 martedì e venerdì · D2 lunedì e giovedì (eventuale rabbocco il mercoledì avvisando la Direzione)<br>
D1 e D2: motorista mezz'ora prima del normale orario · BIS tutti i giorni, liberato il pontile 5 o 3</div>
<div class="notes">BIS: pronti a muovere alle 8.30 verso Garda, a disposizione dell'Ufficio Movimento, rientro alle 18.40.<br>
Dal 2 novembre 2026 al 12 marzo 2027 nessuna corsa di linea a Desenzano.</div>
</div></body></html>`;
  }

  // Apre l'A4 in una nuova finestra; restituisce il numero di giorni della settimana coperti dagli O.d.S.
  function open(turniNavi, monday) {
    const popup = window.open('', '_blank');
    if (!popup) throw new Error('Il browser ha bloccato la nuova finestra: consenti i popup per NaviSuite.');
    popup.document.open();
    popup.document.write(buildHtml(turniNavi, monday));
    popup.document.close();
    popup.focus();
    const data = indexTurniNavi(turniNavi);
    return Array.from({ length: 7 }, (_, i) => iso(addDays(parseIso(monday), i))).filter(day => data[day]).length;
  }

  window.NaviServiziTerra = { defaultMonday, indexTurniNavi, buildHtml, open };
})();
