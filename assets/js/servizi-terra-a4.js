// A4 "Servizi a terra" da stampare su laser bianco/nero (orario invernale, O.d.S. n. 39/2026).
// Desenzano (pontile e AgB): navi in ordine di orario e ormeggi serali della settimana lun-dom
// con i rifornimenti, presi dai turni nave letti dagli O.d.S. (come tools/stampe/a4_desenzano.py).
// Maderno (AgM e AgT1): navi di linea e passaggi del traghetto Torri (come tools/stampe/a4_maderno.py).
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
  // Bolgette (per corsa): Maderno e Riva con la R1 (7 e 8), Cantiere di Peschiera con le corse 30-31 / 38-39
  const BOLGETTE = { 7: 'BOLGETTA · ARRIVA', 8: 'BOLGETTA · PARTE', 31: 'BOLGETTA · ARRIVA', 38: 'BOLGETTA · PARTE' };
  // Maderno, navi di linea (pag. 15-16): (ora, P/A/S, turno, corsa, percorso); * = SR solo fino all'11/10
  const MADERNO_LINEA = [
    ['9.15', 'P', 'M1', '91', 'per Desenzano'],
    ['10.09', 'S', 'SR2', '111', 'Riva › Peschiera *'],
    ['10.41', 'S', 'SR1', '102', 'Peschiera › Riva *'],
    ['11.03', 'S', 'R1', '7', 'Riva › Desenzano'],
    ['11.31', 'S', 'P1', '2', 'Peschiera › Riva'],
    ['13.00', 'A', 'D1', '16', 'da Desenzano'],
    ['14.00', 'P', 'D1', '17', 'per Desenzano'],
    ['16.30', 'S', 'SR1', '107', 'Riva › Peschiera *'],
    ['16.58', 'S', 'R1', '8', 'Desenzano › Riva'],
    ['17.08', 'S', 'P1', '3', 'Riva › Peschiera'],
    ['17.24', 'S', 'SR2', '114', 'Peschiera › Riva *'],
    ['19.25', 'A', 'M1', '94', 'da Garda']
  ];
  // Traghetto Maderno - Torri (pag. 17): (ora a Maderno, P/A, turno, corsa)
  const TRAGHETTO = [
    ['8.10', 'P', 'T1', '201'], ['8.45', 'P', 'T2', '231'], ['9.15', 'A', 'T1', '202'],
    ['9.25', 'P', 'T1', '203'], ['9.55', 'A', 'T2', '232'], ['10.10', 'P', 'T2', '233'],
    ['10.40', 'A', 'T1', '204'], ['10.50', 'P', 'T1', '205'], ['11.20', 'A', 'T2', '234'],
    ['11.30', 'P', 'T2', '235'], ['12.00', 'A', 'T1', '206'], ['12.10', 'P', 'T1', '207'],
    ['12.40', 'A', 'T2', '236'], ['12.50', 'P', 'T2', '237'], ['13.20', 'A', 'T1', '208'],
    ['14.20', 'P', 'T1', '209'], ['14.50', 'A', 'T2', '238'], ['15.05', 'P', 'T2', '239'],
    ['15.35', 'A', 'T1', '210'], ['15.50', 'P', 'T1', '211'], ['16.20', 'A', 'T2', '240'],
    ['16.40', 'P', 'T2', '241'], ['17.10', 'A', 'T1', '212'], ['17.20', 'P', 'T1', '213'],
    ['17.50', 'A', 'T2', '242'], ['18.00', 'P', 'T2', '243'], ['18.30', 'A', 'T1', '214'],
    ['19.10', 'A', 'T2', '244']
  ];
  // Bolgetta Maderno - Direzione: R1 all'andata e al ritorno
  const MADERNO_BOLGETTE = { 7: 'BOLGETTA · PARTE', 8: 'BOLGETTA · RIENTRA' };
  const KIND = { P: 'PARTENZA', A: 'ARRIVO', S: 'SCALO' };
  const VALIDITA = "Dal 5 ottobre all'1 novembre 2026 e dal 13 al 25 marzo 2027 · O.d.S. n. 39/2026";
  // Servizi a terra: (sigla, mattina, pomeriggio, nota)
  const SERVIZI = {
    DESENZANO: [['AgB', '8.00 – 11.50', '12.50 – 17.30', 'dalle 7.45 con rifornimento D2 · assistenza alla c. 8'],
      ['PonD', '9.30 – 13.35', '15.00 – 19.50', "8 ore 55'"]],
    MADERNO: [['AgM', '9.00 – 11.50', '12.50 – 19.30', 'compresa assistenza alle c. 16-17 · coadiuva AgT'],
      ['AgT1', '7.50 – 13.00', '14.00 – 18.20', "9 ore 30'"]]
  };
  const RIFORNIMENTI = {
    titolo: 'R = rifornimento a Desenzano prima delle corse, per quanto possibile a cura di AgB o PonD:',
    righe: ['D1 martedì e venerdì · D2 lunedì e giovedì (eventuale rabbocco il mercoledì avvisando la Direzione)',
      "D1 e D2: motorista mezz'ora prima del normale orario · BIS tutti i giorni, liberato il pontile 5 o 3"]
  };
  // Note: [in grassetto?, testo]
  const NOTE = {
    DESENZANO: [[true, 'Bolgette Maderno e Riva: arrivano con la R1 c. 7 alle 13.30, ripartono con la R1 c. 8 alle 14.30.'],
      [true, 'Bolgetta Cantiere Peschiera: arriva con le c. 30 e 31 alle 10.30, riparte con le c. 38 e 39 alle 16.20.'],
      [false, "BIS: pronti a muovere alle 8.30 verso Garda, a disposizione dell'Ufficio Movimento, rientro alle 18.40."],
      [false, 'Dal 2 novembre 2026 al 12 marzo 2027 nessuna corsa di linea a Desenzano.']],
    MADERNO: [[true, 'Bolgette: partono con la R1 corsa 7 delle 11.03 e rientrano con la R1 corsa 8 delle 16.58.'],
      [false, "T1 non effettuato il 25 dicembre 2026. T2 e navi di linea: fino all'1 novembre 2026 e dal 13 marzo 2027."],
      [false, "Dal 2 novembre 2026 al 12 marzo 2027 solo traghetto T1 - AgT 7.55 – 12.15 / 13.15 – 18.50 (9 ore 55')."]]
  };
  const RESIDENZE = ['DESENZANO', 'MADERNO'];
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

  const minutes = t => { const [h, m] = t.split('.').map(Number); return h * 60 + m; };
  const hhmm = n => `${Math.floor(n / 60)}.${String(n % 60).padStart(2, '0')}`;

  // Passaggi a Maderno di un turno traghetto: [{arr, dep, kind}] con arr/dep = [ora, corsa] o null;
  // kind: prima, ultima, pausa-torri (riga di sola nota, arr/dep = orari a Torri) o ''.
  function ferryRows(code) {
    const ev = TRAGHETTO.filter(row => row[2] === code).map(([t, k, , run]) => [minutes(t), k, run]).sort((a, b) => a[0] - b[0]);
    const rows = [];
    let i = 0;
    while (i < ev.length) {
      const [t, k, run] = ev[i];
      if (k === 'P') { rows.push({ arr: null, dep: [hhmm(t), run], kind: 'prima' }); i += 1; }
      else if (i + 1 < ev.length && ev[i + 1][1] === 'P') { rows.push({ arr: [hhmm(t), run], dep: [hhmm(ev[i + 1][0]), ev[i + 1][2]], kind: '' }); i += 2; }
      else { rows.push({ arr: [hhmm(t), run], dep: null, kind: i === ev.length - 1 ? 'ultima' : '' }); i += 1; }
      // partenza seguita da un arrivo molto dopo: la nave ha fatto pausa a Torri (traversata di 30')
      const last = rows[rows.length - 1];
      if (last.dep && i < ev.length && ev[i][1] === 'A') {
        const dep = minutes(last.dep[0]);
        if ((ev[i][0] - 30) - (dep + 30) >= 45) rows.push({ arr: hhmm(dep + 30), dep: hhmm(ev[i][0] - 30), kind: 'pausa-torri' });
      }
    }
    return rows;
  }

  const CSS = `
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:#d8dde2;color:#000;font-family:"DejaVu Sans",Verdana,Arial,sans-serif}
.sheet{width:210mm;height:297mm;margin:8mm auto;background:#fff;padding:11mm 18mm 9mm;overflow:hidden}
.sheet+.sheet{page-break-before:always;break-before:page}
h1{font-size:26pt;margin:0;line-height:1}
.sub{font-size:12pt;margin:2mm 0 0}.src{font-size:9pt;color:#333;margin:1.5mm 0 0}
.boxes{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:4mm}
.box{border:1px solid #000;border-radius:3mm;padding:2.5mm 5mm;display:grid;grid-template-columns:auto 1fr;row-gap:.5mm}
.box b{font-size:16pt}.box .h{text-align:right;font-size:13pt;line-height:1.25}.box small{grid-column:1/-1;font-size:7.5pt;color:#333}
table{border-collapse:collapse;width:100%}
.navi{margin-top:6mm}.navi th{background:#000;color:#fff;font-size:9pt;text-align:left;padding:1.4mm 2mm}
.navi td{height:5.9mm;line-height:1;padding:0 2mm;font-size:12pt;white-space:nowrap}
.navi .time{font-weight:700;font-size:15pt;text-align:right;width:20mm}.navi .kind{font-weight:700;font-size:10.5pt;width:30mm}
.navi .code{font-weight:700;font-size:15pt;width:22mm}.navi .run{width:22mm}
.navi .where div{display:flex;align-items:center;justify-content:space-between;gap:2mm}
.bolg{background:#000;color:#fff;font-weight:700;font-size:8.5pt;line-height:1.2;border-radius:1.5mm;padding:.5mm 2.5mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.stripe td,.stripe th{background:#ededed}.navi tr.split{border-top:1.4px solid #000}
.orm-title{margin:5mm 0 2mm;font-size:12pt;font-weight:700;white-space:nowrap}.orm-title span{font-weight:400;font-size:8.5pt;color:#333;margin-left:3mm}
.orm{table-layout:fixed}.orm thead th{background:#000;color:#fff;font-size:9pt;padding:1.3mm 0}
.orm thead th:first-child{width:12mm}
.orm tbody th{text-align:left;font-size:12pt;padding-left:1.5mm}
.orm td{height:8.6mm;text-align:center;border-left:.4px solid #000;line-height:1.05}
.orm .pont{font-weight:700;font-size:14pt}.orm .rif{font-weight:700;font-size:9pt;margin-left:1.2mm;vertical-align:2pt}
.orm .ship{display:block;font-size:7pt;white-space:nowrap;overflow:hidden}
.orm .next{font-size:6.5pt;color:#333;background:#fff}.orm .none{font-size:10pt}
.rules{margin-top:4mm;font-size:8.4pt;line-height:1.45}.rules b{font-size:8.6pt}
.notes{margin-top:1.5mm;font-size:8.2pt;color:#333;line-height:1.45}.notes b{color:#000;font-size:8.6pt}
.maderno .navi{margin-top:0}.maderno .navi td{height:6.6mm}.maderno .navi .kind{width:25mm}.maderno .navi .run{width:17mm}
.ferries{display:grid;grid-template-columns:1fr 1fr;gap:8mm}
.ferry{border:.6pt solid #000}.ferry th{background:#000;color:#fff;font-size:8.4pt;padding:1.6mm 0;text-align:center}
.ferry th:first-child{font-size:13pt;text-align:left;padding-left:2.5mm;width:9mm}
.ferry td{height:7.4mm;line-height:1;text-align:center;white-space:nowrap;padding:0}
.ferry .t{font-weight:700;font-size:14pt}.ferry .t small{font-weight:400;font-size:7pt;color:#333;margin-left:1mm}
.ferry .note{font-size:8.6pt;color:#333}.ferry .sosta{font-size:11pt}.ferry .sosta.lunch{font-weight:700}
.ferry .sosta.lunch:before{content:"pausa";display:block;font-weight:400;font-size:7pt}
.ferry tr.torri td{font-size:8.2pt;font-weight:700;color:#333;border-top:.4pt dashed #000;border-bottom:.4pt dashed #000;background:#fff}
.print-actions{position:fixed;top:8px;right:8px;display:flex;gap:6px;z-index:5}
.print-actions button{font:700 13px sans-serif;padding:8px 12px;border-radius:8px;border:1px solid #000;background:#fff;cursor:pointer}
@media screen and (max-width:830px){.sheet{margin:8px auto}}
@media print{html,body{background:#fff}.sheet{margin:0;zoom:1!important}.print-actions{display:none}}
`;

  // Sullo schermo il foglio A4 si adatta alla larghezza della finestra (telefono o riquadro).
  const FIT = `<script>(function(){function fit(){var w=document.documentElement.clientWidth,s=Math.min(1,(w-16)/793.7);` +
    `document.querySelectorAll('.sheet').forEach(function(el){el.style.zoom=s<1?s:''})}fit();addEventListener('resize',fit)})()<\/script>`;

  // Ormeggi serali della settimana: giorni (Date), gruppi da mostrare, dati per giorno, O.d.S. usati.
  function ormeggiSettimana(turniNavi, monday) {
    const data = indexTurniNavi(turniNavi);
    const days = Array.from({ length: 7 }, (_, i) => addDays(parseIso(monday), i));
    const known = days.map(iso).filter(day => data[day]);
    let groups = GRUPPI.filter(g => known.some(day => data[day][g] && data[day][g].pontile));
    if (!groups.length) groups = ['D1', 'D2', 'BIS'];
    const ods = [...new Set(known.flatMap(day => Object.values(data[day]).map(v => v.ods)).filter(Boolean))].sort();
    return { data, days, known, groups, ods };
  }

  const boxes = res => SERVIZI[res].map(([code, a, b, note]) =>
    `<div class="box"><b>${code}</b><span class="h">${a}<br>${b}</span><small>${esc(note)}</small></div>`).join('\n');
  const notes = res => NOTE[res].map(([bold, text]) => bold ? `<b>${esc(text)}</b>` : esc(text)).join('<br>\n');

  function sheetDesenzano(turniNavi, monday) {
    const { data, days, known, groups, ods } = ormeggiSettimana(turniNavi, monday);
    const fmt = d => `${d.getDate()}/${d.getMonth() + 1}`;

    const naviRows = NAVI.map(([time, kind, code, run, where], i) =>
      `<tr class="${i % 2 ? '' : 'stripe'}${time === '14.30' ? ' split' : ''}"><td class="time">${time}</td>` +
      `<td class="kind">${KIND[kind]}</td><td class="code">${code}</td>` +
      `<td class="run">${run || '–'}</td><td class="where"><div>${esc(where)}` +
      `${BOLGETTE[run] ? `<span class="bolg">${BOLGETTE[run]}</span>` : ''}</div></td></tr>`).join('');

    const head = days.map((d, i) => `<th>${GIORNI[i]} ${fmt(d)}</th>`).join('');
    const body = groups.map((g, gi) => `<tr class="${gi % 2 ? '' : 'stripe'}"><th>${g}</th>` + days.map(d => {
      const day = data[iso(d)];
      if (!day) return gi === 0 ? `<td class="next" rowspan="${groups.length}">nel prossimo<br>O.d.S.</td>` : '';
      const v = day[g];
      if (!v) return '<td class="none">–</td>';
      return `<td><span class="pont">${esc(v.pontile || '–')}</span>${v.rif ? '<span class="rif">R</span>' : ''}` +
        `<span class="ship">${esc(v.nave)}</span></td>`;
    }).join('') + '</tr>').join('');

    return {
      title: `Servizi a terra Desenzano ${fmt(days[0])}-${fmt(days[6])}`,
      days: known.length,
      html: `<div class="sheet desenzano">
<h1>DESENZANO</h1>
<p class="sub">Pontile e AgB - navi in ordine di orario e ormeggi serali</p>
<p class="src">${esc(VALIDITA)}</p>
<div class="boxes">
${boxes('DESENZANO')}
</div>
<table class="navi"><thead><tr><th>ORA</th><th></th><th>TURNO</th><th>CORSA</th><th>DA / PER</th></tr></thead><tbody>${naviRows}</tbody></table>
<div class="orm-title">ORMEGGI SERALI ${fmt(days[0])} – ${fmt(days[6])}<span>nave e pontile della sera · R = rifornimento · turno navi O.d.S. ${esc(ods.join(', ') || '–')}</span></div>
<table class="orm"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table>
<div class="rules"><b>${esc(RIFORNIMENTI.titolo)}</b><br>
${RIFORNIMENTI.righe.map(esc).join('<br>\n')}</div>
<div class="notes">${notes('DESENZANO')}</div>
</div>`
    };
  }

  function sheetMaderno() {
    const lineRows = MADERNO_LINEA.map(([time, kind, code, run, where], i) =>
      `<tr class="${i % 2 ? '' : 'stripe'}${time === '14.00' ? ' split' : ''}"><td class="time">${time}</td>` +
      `<td class="kind">${KIND[kind]}</td><td class="code">${code}</td><td class="run">${run}</td>` +
      `<td class="where"><div>${esc(where)}${MADERNO_BOLGETTE[run] ? `<span class="bolg">${MADERNO_BOLGETTE[run]}</span>` : ''}</div></td></tr>`).join('');
    const time = value => value ? `<span class="t">${value[0]}<small>${value[1]}</small></span>` : '';
    const ferry = code => {
      let stripe = 0;
      const rows = ferryRows(code).map(row => {
        if (row.kind === 'pausa-torri') return `<tr class="torri"><td colspan="4">pausa a Torri ${row.arr} – ${row.dep}</td></tr>`;
        const cls = stripe++ % 2 ? '' : ' class="stripe"';
        let sosta = '';
        if (row.arr && row.dep) {
          const min = minutes(row.dep[0]) - minutes(row.arr[0]);
          sosta = `<span class="sosta${min >= 45 ? ' lunch' : ''}">${min}'</span>`;
        }
        return `<tr${cls}><td></td><td>${row.kind === 'prima' ? '<span class="note">1ª partenza</span>' : time(row.arr)}</td>` +
          `<td>${sosta}</td><td>${row.kind === 'ultima' ? '<span class="note">fine servizio</span>' : time(row.dep)}</td></tr>`;
      }).join('');
      return `<table class="ferry"><thead><tr><th>${code}</th><th>ARRIVO</th><th>SOSTA</th><th>PARTENZA</th></tr></thead><tbody>${rows}</tbody></table>`;
    };
    return {
      title: 'Servizi a terra Maderno',
      days: 0,
      html: `<div class="sheet maderno">
<h1>MADERNO</h1>
<p class="sub">Servizio di terra - navi di linea e traghetto Torri</p>
<p class="src">${esc(VALIDITA)}</p>
<div class="boxes">
${boxes('MADERNO')}
</div>
<div class="orm-title">NAVI DI LINEA<span>SCALO = nave in transito a Maderno · * corsa SR solo fino all'11 ottobre 2026</span></div>
<table class="navi"><thead><tr><th>ORA</th><th></th><th>TURNO</th><th>CORSA</th><th>DA / PER</th></tr></thead><tbody>${lineRows}</tbody></table>
<div class="orm-title">TRAGHETTO MADERNO – TORRI<span>arrivo da Torri, sosta a Maderno, partenza per Torri</span></div>
<div class="ferries">${ferry('T1')}${ferry('T2')}</div>
<div class="notes">${notes('MADERNO')}</div>
</div>`
    };
  }

  // Uno o piu' fogli in una pagina HTML completa, con il tasto "Stampa / PDF".
  function page(sheets, title, printButton = true) {
    return `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style></head><body>
${printButton ? '<div class="print-actions"><button type="button" onclick="window.print()">Stampa / PDF</button></div>' : ''}
${sheets.map(sheet => sheet.html).join('\n')}
${FIT}</body></html>`;
  }

  // A4 di una residenza ('DESENZANO' o 'MADERNO').
  function sheetFor(residenza, turniNavi, monday) {
    return String(residenza).toUpperCase() === 'MADERNO' ? sheetMaderno() : sheetDesenzano(turniNavi, monday);
  }
  function buildResidenceHtml(residenza, turniNavi, monday, options = {}) {
    const sheet = sheetFor(residenza, turniNavi, monday);
    return page([sheet], sheet.title, options.printButton !== false);
  }
  function buildHtml(turniNavi, monday) { return buildResidenceHtml('DESENZANO', turniNavi, monday); }
  function buildMadernoHtml() { return buildResidenceHtml('MADERNO'); }
  function buildAllHtml(turniNavi, monday) {
    const sheets = RESIDENZE.map(res => sheetFor(res, turniNavi, monday));
    return page(sheets, `Servizi a terra - ${sheets[0].title.replace('Servizi a terra Desenzano ', 'settimana ')}`);
  }

  // Documenti da salvare in Documenti (un documento per residenza, sostituito a ogni generazione).
  function documents(turniNavi, monday) {
    const fmt = value => value.split('-').reverse().slice(0, 2).map(Number).join('/');
    const sunday = iso(addDays(parseIso(monday), 6));
    return RESIDENZE.map(res => {
      const name = res === 'MADERNO' ? 'Maderno' : 'Desenzano';
      const html = buildResidenceHtml(res, turniNavi, monday);
      return {
        metadata: {
          id: `SERVIZI_TERRA_${res}`,
          tipo: 'servizi_terra',
          residenza: res,
          titolo: `Servizi a terra ${name}`,
          inizio: res === 'MADERNO' ? '' : monday,
          fine: res === 'MADERNO' ? '' : sunday,
          settimana: res === 'MADERNO' ? '' : `${fmt(monday)} – ${fmt(sunday)}`,
          data: iso(new Date()),
          filename: `Servizi_a_terra_${name}.html`,
          mimeType: 'text/html',
          size: html.length
        },
        dataUrl: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
      };
    });
  }

  // Apre gli A4 (Desenzano e Maderno) in una nuova finestra; restituisce il numero di giorni
  // della settimana di Desenzano coperti dagli O.d.S.
  function open(turniNavi, monday) {
    const popup = window.open('', '_blank');
    if (!popup) throw new Error('Il browser ha bloccato la nuova finestra: consenti i popup per NaviSuite.');
    popup.document.open();
    popup.document.write(buildAllHtml(turniNavi, monday));
    popup.document.close();
    popup.focus();
    return sheetDesenzano(turniNavi, monday).days;
  }

  // Dati per la pagina web Servizi a terra (stessi del foglio A4).
  const DATA = {
    VALIDITA, KIND, SERVIZI, RIFORNIMENTI, NOTE,
    NAVI: { DESENZANO: NAVI, MADERNO: MADERNO_LINEA },
    BOLGETTE: { DESENZANO: BOLGETTE, MADERNO: MADERNO_BOLGETTE }
  };

  // Apre l'A4 di una residenza in una nuova finestra, pronto da stampare.
  function openResidence(residenza, turniNavi, monday) {
    const popup = window.open('', '_blank');
    if (!popup) throw new Error('Il browser ha bloccato la nuova finestra: consenti i popup per NaviSuite.');
    popup.document.open();
    popup.document.write(buildResidenceHtml(residenza, turniNavi, monday));
    popup.document.close();
    popup.focus();
  }

  window.NaviServiziTerra = {
    RESIDENZE, DATA, defaultMonday, indexTurniNavi, ormeggiSettimana, ferryRows, minutes, openResidence,
    buildHtml, buildMadernoHtml, buildResidenceHtml, buildAllHtml, documents, open
  };
})();
