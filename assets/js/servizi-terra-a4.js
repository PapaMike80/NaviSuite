// A4 "Servizi a terra" da stampare su laser bianco/nero (orario invernale, O.d.S. n. 39/2026).
// Desenzano (pontile e AgB): navi in ordine di orario e ormeggi serali della settimana lun-dom
// con i rifornimenti, presi dai turni nave letti dagli O.d.S. (come tools/stampe/a4_desenzano.py).
// Maderno (AgM e AgT): navi di linea e passaggi del traghetto Torri (come tools/stampe/a4_maderno.py).
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
    DESENZANO: [['AgB', '8.00 – 11.50', '12.50 – 17.30', '8 ore 30\''],
      ['PonD', '9.30 – 13.35', '15.00 – 19.50', "8 ore 55'"]],
    MADERNO: [['AgM', '9.00 – 11.50', '12.50 – 19.30', 'compresa assistenza alle c. 16-17 · coadiuva AgT'],
      ['AgT', '7.50 – 13.00', '14.00 – 18.20', "9 ore 30'"]]
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
  // (a parita', la riga inserita per ultima); le righe ancora da salvare e poi quelle dell'Ufficio
  // Movimento (modifiche del giorno) vincono sempre.
  const rank = row => [(row._pending ? 2 : 0) + (row.fonte === 'movimento' ? 1 : 0), Number(String(row.ods || '').match(/\d+/)?.[0] || 0), String(row.inserita_il || '')];
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

  // Nei colori di NaviSuite (come le stampe di tools/stampe/a4_desenzano_colori.py), anche in stampa.
  const CSS = `
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{-webkit-text-size-adjust:100%;text-size-adjust:100%;margin:0;background:#d8dde2;color:#102a33;font-family:"DejaVu Sans",Verdana,Arial,sans-serif}
.sheet{width:210mm;height:297mm;margin:8mm auto;background:#fff;padding:0 16mm 8mm;overflow:hidden}
.sheet+.sheet{page-break-before:always;break-before:page}
.band{margin:0 -16mm;padding:4mm 16mm 3mm;background:#0b2530;color:#fff;border-bottom:1.6mm solid #2dd4bf}
h1{font-size:24pt;margin:0;line-height:1;letter-spacing:.04em}
.src{font-size:7.6pt;color:#5a7680;margin:1mm 0 0}
.boxes{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:5mm}
.box{border:.8pt solid #c9e3e6;border-left:2.2mm solid #0f8f80;border-radius:3mm;background:#eef7f7;padding:2.5mm 5mm;display:grid;grid-template-columns:auto 1fr;row-gap:.5mm}
.box .anticipo{font-style:normal;font-size:9pt;color:#0f8f80;margin-right:2mm}.box b{font-size:17pt;color:#0b2530}.box .h{text-align:right;font-size:12.5pt;line-height:1.25;font-weight:700;color:#0b2530}.box small{grid-column:1/-1;font-size:7.4pt;color:#5a7680}
table{border-collapse:collapse;width:100%}
.navi{margin-top:6mm}.navi th{background:#123a47;color:#fff;font-size:8.8pt;text-align:left;padding:1.4mm 2mm}
.navi thead th:first-child{border-radius:2mm 0 0 2mm}.navi thead th:last-child{border-radius:0 2mm 2mm 0}
.navi td{height:5.9mm;line-height:1;padding:0 2mm;font-size:11.5pt;white-space:nowrap}
.navi .time{font-weight:700;font-size:15pt;text-align:right;width:20mm}.navi .kind{font-weight:700;font-size:9.6pt;width:30mm}
.navi .kind.P{color:#0f8f80}.navi .kind.A{color:#1f7fbf}.navi .kind.S{color:#b7791f}
.navi .code{width:22mm}.navi .run{width:22mm}
.chip{display:inline-block;min-width:13mm;padding:.6mm 2mm;border-radius:3mm;background:#64748b;color:#fff;font-weight:700;font-size:10.5pt;text-align:center;line-height:1.15}
.chip[data-code="D1"],.chip[data-code="R1"],.chip[data-code="P1"],.chip[data-code="T1"]{background:#3b6fe0}
.chip[data-code="D2"],.chip[data-code="R2"],.chip[data-code="P2"],.chip[data-code="T2"]{background:#1f9d63}
.chip[data-code="M1"],.chip[data-code="R3"],.chip[data-code="D3"]{background:#e07b2a}.chip[data-code="D4"]{background:#c25bbd}
.chip[data-code="BIS"]{background:#0e9fb3}.chip[data-code="SR1"],.chip[data-code="SR2"]{background:#7c5ce0}
.navi .where div{display:flex;align-items:center;justify-content:space-between;gap:2mm}
.bolg{background:#f59e0b;color:#0b2530;font-weight:700;font-size:8.4pt;line-height:1.2;border-radius:1.5mm;padding:.5mm 2.5mm}
.stripe td,.stripe th{background:#eef7f7}.navi tr.split{border-top:1.2pt solid #0f8f80}
.orm-title{margin:5mm 0 2mm;font-size:12pt;font-weight:700;white-space:nowrap;color:#0b2530}.orm-title span{font-weight:400;font-size:8.2pt;color:#5a7680;margin-left:3mm}
.orm{table-layout:fixed}.orm thead th{background:#123a47;color:#fff;font-size:8.8pt;padding:1.3mm 0}
.orm thead th:first-child{width:15mm;border-radius:2mm 0 0 2mm}.orm thead th:last-child{border-radius:0 2mm 2mm 0}
.orm tbody th{text-align:left;padding-left:1mm}.orm tbody th .chip{min-width:11mm;font-size:9.5pt}
.orm td{height:8.6mm;text-align:center;border-left:.5pt solid #c9e3e6;line-height:1.05}
.orm .pont{font-weight:700;font-size:14pt}
.orm .rif,.mark{display:inline-block;background:#facc15;color:#0b2530;font-weight:700;font-size:8.5pt;border-radius:1.2mm;padding:.2mm 1.2mm;margin-left:1.2mm;vertical-align:2pt}
.mark{margin:0 1.5mm 0 0;vertical-align:0}.mark.b{background:#f59e0b}
.orm .ship{display:block;font-size:7pt;white-space:nowrap;overflow:hidden;color:#5a7680}
.orm .next{font-size:6.4pt;color:#5a7680;background:#fff}.orm .none{font-size:10pt}
.rules{margin-top:4mm;font-size:8.2pt;line-height:1.5}.rules b{font-size:8.4pt;color:#0b2530}
.notes{margin-top:1.5mm;font-size:8pt;color:#5a7680;line-height:1.5}.notes b{color:#102a33;font-size:8.2pt}
.maderno .navi{margin-top:0}.maderno .navi td{height:6.6mm}.maderno .navi .kind{width:25mm}.maderno .navi .run{width:17mm}
.ferries{display:grid;grid-template-columns:1fr 1fr;gap:8mm}
.ferry{border:.6pt solid #c9e3e6}.ferry th{background:#123a47;color:#fff;font-size:8.4pt;padding:1.6mm 0;text-align:center}
.ferry th:first-child{text-align:left;padding-left:2mm;width:15mm}
.ferry td{height:7.4mm;line-height:1;text-align:center;white-space:nowrap;padding:0}
.ferry .t{font-weight:700;font-size:14pt}.ferry .t small{font-weight:400;font-size:7pt;color:#5a7680;margin-left:1mm}
.ferry .note{font-size:8.4pt;color:#5a7680}.ferry .sosta{font-size:11pt;color:#0f8f80}.ferry .sosta.lunch{font-weight:700}
.ferry .sosta.lunch:before{content:"pausa";display:block;font-weight:400;font-size:7pt}
.ferry tr.torri td{font-size:8pt;font-weight:700;color:#1f7fbf;border-top:.4pt dashed #1f7fbf;border-bottom:.4pt dashed #1f7fbf;background:#fff}
.print-actions{position:fixed;top:8px;right:8px;display:flex;gap:6px;z-index:5}
.print-actions button{font:700 13px sans-serif;padding:8px 12px;border-radius:8px;border:1px solid #0f8f80;background:#fff;color:#0b2530;cursor:pointer}
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
    `<div class="box"><b>${code}</b><span class="h">${code === 'AgB' ? '<em class="anticipo">7.45 Lun/Giov</em> ' : ''}${a}<br>${b}</span><small>${esc(note)}</small></div>`).join('\n');
  const notes = res => NOTE[res].map(([bold, text]) => bold ? `<b>${esc(text)}</b>` : esc(text)).join('<br>\n');

  function sheetDesenzano(turniNavi, monday) {
    const { data, days, known, groups, ods } = ormeggiSettimana(turniNavi, monday);
    const fmt = d => `${d.getDate()}/${d.getMonth() + 1}`;

    const naviRows = NAVI.map(([time, kind, code, run, where], i) =>
      `<tr class="${i % 2 ? '' : 'stripe'}${time === '14.30' ? ' split' : ''}"><td class="time">${time}</td>` +
      `<td class="kind ${kind}">${KIND[kind]}</td><td class="code"><span class="chip" data-code="${code}">${code}</span></td>` +
      `<td class="run">${run || '–'}</td><td class="where"><div>${esc(where)}` +
      `${BOLGETTE[run] ? `<span class="bolg">${BOLGETTE[run]}</span>` : ''}</div></td></tr>`).join('');

    const head = days.map((d, i) => `<th>${GIORNI[i]} ${fmt(d)}</th>`).join('');
    const body = groups.map((g, gi) => `<tr class="${gi % 2 ? '' : 'stripe'}"><th><span class="chip" data-code="${g}">${g}</span></th>` + days.map(d => {
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
<div class="band"><h1>DESENZANO</h1></div>
<div class="boxes">
${boxes('DESENZANO')}
</div>
<table class="navi"><thead><tr><th>ORA</th><th></th><th>TURNO</th><th>CORSA</th><th>DA / PER</th></tr></thead><tbody>${naviRows}</tbody></table>
<div class="orm-title">ORMEGGI SERALI ${fmt(days[0])} – ${fmt(days[6])}<span>nave e pontile della sera · R = rifornimento · turno navi O.d.S. ${esc(ods.join(', ') || '–')}</span></div>
<table class="orm"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table>
<div class="rules"><b>${esc(RIFORNIMENTI.titolo)}</b><br>
${RIFORNIMENTI.righe.map(esc).join('<br>\n')}</div>
<div class="notes">${notes('DESENZANO')}</div>
<p class="src">${esc(VALIDITA)}</p>
</div>`
    };
  }

  function sheetMaderno() {
    const lineRows = MADERNO_LINEA.map(([time, kind, code, run, where], i) =>
      `<tr class="${i % 2 ? '' : 'stripe'}${time === '14.00' ? ' split' : ''}"><td class="time">${time}</td>` +
      `<td class="kind ${kind}">${KIND[kind]}</td><td class="code"><span class="chip" data-code="${code}">${code}</span></td><td class="run">${run}</td>` +
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
      return `<table class="ferry"><thead><tr><th><span class="chip" data-code="${code}">${code}</span></th><th>ARRIVO</th><th>SOSTA</th><th>PARTENZA</th></tr></thead><tbody>${rows}</tbody></table>`;
    };
    return {
      title: 'Servizi a terra Maderno',
      days: 0,
      html: `<div class="sheet maderno">
<div class="band"><h1>MADERNO</h1></div>
<div class="boxes">
${boxes('MADERNO')}
</div>
<div class="orm-title">NAVI DI LINEA<span>SCALO = nave in transito a Maderno · * corsa SR solo fino all'11 ottobre 2026</span></div>
<table class="navi"><thead><tr><th>ORA</th><th></th><th>TURNO</th><th>CORSA</th><th>DA / PER</th></tr></thead><tbody>${lineRows}</tbody></table>
<div class="orm-title">TRAGHETTO MADERNO – TORRI<span>arrivo da Torri, sosta a Maderno, partenza per Torri</span></div>
<div class="ferries">${ferry('T1')}${ferry('T2')}</div>
<div class="notes">${notes('MADERNO')}</div>
<p class="src">${esc(VALIDITA)}</p>
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
  // Turni nave di un giorno per ogni turno (D1, P2, M1, R1, T1, SR1, BIS...):
  // {turno: {nave, ormeggio, rif, ormeggioMattino, sospesa, motivo, movimento}} con ormeggio =
  // "pontile 5", "porto esterno"... o '' (della sera), rif = rifornimento la mattina; dall'Ufficio
  // Movimento anche l'ormeggio del mattino (altrimenti e' quello della sera prima), le corse sospese e,
  // per il BIS, gli incarichi del giorno (vedi NaviOrarioGiorno.corseIncarico); i ritardi per corsa.
  // Stessa precedenza di indexTurniNavi (O.d.S. piu' recente, poi righe ancora da salvare).
  function turniDelGiorno(rows, day) {
    const out = {};
    [...(rows || [])].sort(newer).forEach(row => {
      if (!row || row.attiva === false || row.data !== day || row.stagione) return;
      const nave = String(row.nave || '').replace(/\s*(\([A-Z]\)|©)/g, '').trim();
      const mooring = String(row.ormeggio_serale || '').trim();
      const number = mooring.match(/pont(?:ile)?\.?\s*(\d+)/i)?.[1];
      const ormeggio = number ? `pontile ${number}` : mooring.toLowerCase();
      const refuel = String(row.rifornimento_mattina || '').trim();
      const rif = /^s[iì]$/i.test(refuel) || /riforn/i.test(refuel);
      const movimento = row.fonte === 'movimento';
      if (!nave && !ormeggio && !rif && !movimento) return;
      const pontile = value => { const n = String(value || '').match(/pont(?:ile)?\.?\s*(\d+)/i)?.[1]; return n ? `pontile ${n}` : String(value || '').trim().toLowerCase(); };
      const incarichi = Array.isArray(row.incarichi) ? row.incarichi : Object.values(row.incarichi || {});
      // ritardi per corsa: [{corsa, minuti, oltre}] -> {corsa: {minuti, oltre}}
      // con "scalo": ritardo da quello scalo in poi nella corsa (puo' crescere o calare) -> {corsa: {..., scali: {scalo: r}}}
      const ritardi = {};
      (Array.isArray(row.ritardi) ? row.ritardi : Object.values(row.ritardi || {}))
        .filter(r => r?.corsa && (Number(r.minuti) > 0 || r.oltre || r.inOrario)).forEach(r => {
          const v = r.inOrario ? { minuti: 0, oltre: false, inOrario: true } : { minuti: r.oltre ? 120 : Number(r.minuti), oltre: r.oltre === true };
          const k = String(r.corsa);
          if (r.scalo) { ritardi[k] = ritardi[k] || { minuti: 0, oltre: false, soloScali: true }; (ritardi[k].scali = ritardi[k].scali || {})[String(r.scalo)] = v; }
          else ritardi[k] = { ...v, ...(ritardi[k]?.scali ? { scali: ritardi[k].scali } : {}) };
        });
      // corse sospese una per una: {corsa, da, scalo}; "da" e' l'ora dello scalo da cui vale la sospensione (vuoto = tutta la corsa)
      const sospRaw = (Array.isArray(row.corse_sospese) ? row.corse_sospese : Object.values(row.corse_sospese || {}))
        .map(x => (x && typeof x === 'object' ? { corsa: String(x.corsa || ''), da: String(x.da || ''), scalo: String(x.scalo || '') } : { corsa: String(x), da: '', scalo: '' })).filter(x => x.corsa);
      const corseSospese = sospRaw.map(x => x.corsa);
      const extra = movimento ? { ormeggioMattino: pontile(row.ormeggio_mattino), sospesa: row.sospesa === true, motivo: String(row.sospesa_motivo || ''), movimento: true,
        ...(incarichi.length ? { incarichi } : {}), ...(Object.keys(ritardi).length ? { ritardi } : {}), ...(corseSospese.length ? { corseSospese, corseSospeseRaw: sospRaw } : {}) } : {};
      String(row.corsa || '').toUpperCase().replace(/\s+/g, '').split('/').forEach(code => {
        out[code.replace(/^BIS2$/, 'BIS')] = { nave, ormeggio, rif, ...extra };
      });
    });
    return out;
  }
  // Solo la nave: {turno: nave}.
  function naviDelGiorno(rows, day) {
    const out = {};
    Object.entries(turniDelGiorno(rows, day)).forEach(([code, v]) => { if (v.nave) out[code] = v.nave; });
    return out;
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

  // Visore dentro la pagina, al posto di una nuova finestra: su iPhone (app sul telefono) la
  // finestra nuova non stampa e non si chiude. I fogli stanno in uno shadow DOM con il loro CSS,
  // con la barra "✕" e "Stampa / PDF"; in stampa si nasconde il resto della pagina.
  // html: pagina completa (anche un documento salvato in Documenti), ne usa lo stile e i .sheet.
  const VIEWER_CSS = `
:host{all:initial;position:fixed;inset:0;z-index:2147483000;overflow:auto;-webkit-overflow-scrolling:touch;background:#d8dde2;display:block}
.a4-bar{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:calc(8px + env(safe-area-inset-top)) 12px 8px;background:#0b2530;color:#fff;font:700 15px -apple-system,system-ui,sans-serif}
.a4-bar strong{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.a4-bar button{font:700 15px -apple-system,system-ui,sans-serif;border-radius:10px;cursor:pointer}
.a4-x{width:40px;height:40px;border:1px solid #2dd4bf;background:transparent;color:#fff;font-size:20px!important;line-height:1}
.a4-print{padding:10px 14px;border:0;background:#2dd4bf;color:#0b2530}
.a4-sheets{padding:8px 0 calc(24px + env(safe-area-inset-bottom))}
.print-actions{display:none!important}
@media print{:host{position:static;overflow:visible;background:#fff}.a4-bar{display:none}.a4-sheets{padding:0}}
`;
  const PRINT_CSS = '@page{size:A4 portrait;margin:0}@media print{html,body{background:#fff!important;height:auto!important;overflow:visible!important;margin:0!important;padding:0!important}body>*:not(#navi-a4-viewer){display:none!important}}';
  let chiudiVisore = null;
  function mostra(html, title) {
    if (chiudiVisore) chiudiVisore();
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    const style = [...doc.querySelectorAll('style')].map(el => el.textContent).join('\n')
      .replace(/(^|[},\s])html\s*,\s*body\s*\{/g, '$1:host{').replace(/(^|[},\s])body\s*\{/g, '$1:host{');
    const sheets = [...doc.querySelectorAll('.sheet')].map(el => el.outerHTML).join('\n');
    const host = document.createElement('div');
    host.id = 'navi-a4-viewer';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${VIEWER_CSS}${style}</style>` +
      `<div class="a4-bar"><button type="button" class="a4-x" aria-label="Chiudi">✕</button>` +
      `<strong>${esc(title || doc.title || 'Servizi a terra')}</strong><button type="button" class="a4-print">Stampa / PDF</button></div>` +
      `<div class="a4-sheets">${sheets}</div>`;
    const print = document.createElement('style');
    print.id = 'navi-a4-print';
    print.textContent = PRINT_CSS;
    const overflow = document.body.style.overflow;
    const fit = () => {
      const s = Math.min(1, (host.clientWidth - 16) / 793.7);
      root.querySelectorAll('.sheet').forEach(el => { el.style.zoom = s < 1 ? s : ''; });
    };
    const key = event => { if (event.key === 'Escape') chiudiVisore(); };
    // in stampa il foglio a grandezza vera
    const before = () => root.querySelectorAll('.sheet').forEach(el => { el.style.zoom = ''; });
    chiudiVisore = () => {
      host.remove(); print.remove();
      document.body.style.overflow = overflow;
      removeEventListener('resize', fit); removeEventListener('keydown', key);
      removeEventListener('beforeprint', before); removeEventListener('afterprint', fit);
      chiudiVisore = null;
    };
    root.querySelector('.a4-x').addEventListener('click', () => chiudiVisore());
    root.querySelector('.a4-print').addEventListener('click', () => { before(); window.print(); setTimeout(fit, 500); });
    document.head.appendChild(print);
    document.body.appendChild(host);
    document.body.style.overflow = 'hidden';
    addEventListener('resize', fit); addEventListener('keydown', key);
    addEventListener('beforeprint', before); addEventListener('afterprint', fit);
    fit();
    return host;
  }

  // Apre gli A4 (Desenzano e Maderno) nel visore; restituisce il numero di giorni
  // della settimana di Desenzano coperti dagli O.d.S.
  function open(turniNavi, monday) {
    mostra(buildAllHtml(turniNavi, monday), 'Servizi a terra');
    return sheetDesenzano(turniNavi, monday).days;
  }

  // Dati per la pagina web Servizi a terra (stessi del foglio A4).
  const DATA = {
    VALIDITA, KIND, SERVIZI, RIFORNIMENTI, NOTE,
    NAVI: { DESENZANO: NAVI, MADERNO: MADERNO_LINEA },
    TRAGHETTO,
    // Maderno con il traghetto Torri nella stessa tabella, in ordine di orario (a parita' di ora
    // prima la nave di linea). Del traghetto solo le partenze per Torri, con l'arrivo da Torri
    // che le precede come sesto campo; resta come arrivo solo quello di fine servizio.
    NAVI_CON_TRAGHETTO: {
      DESENZANO: NAVI,
      MADERNO: [...MADERNO_LINEA.map(row => [...row, '', 0]),
        ...['T1', 'T2'].flatMap(code => ferryRows(code).filter(row => row.kind !== 'pausa-torri').map(row => row.dep
          ? [row.dep[0], 'P', code, row.dep[1], 'per Torri', row.arr ? row.arr[0] : '', 1]
          : [row.arr[0], 'A', code, row.arr[1], 'da Torri', '', 1]))]
        .sort((a, b) => minutes(a[0]) - minutes(b[0]) || a[6] - b[6]).map(row => row.slice(0, 6))
    },
    BOLGETTE: { DESENZANO: BOLGETTE, MADERNO: MADERNO_BOLGETTE }
  };

  // Pontile di ogni corsa a Desenzano (scelto nella pagina Servizi a terra, condiviso su Firebase):
  // chiave della corsa e valore del giorno = scelta di oggi, poi l'O.d.S. (ormeggio del mattino o
  // della sera), poi l'ultima scelta dei giorni prima. history = {data: '1'..'6' | '-'}.
  const courseKey = (time, code, run) => `${String(time).replace('.', '-')}_${code}_${run || 'x'}`;
  const pontLabel = value => String(value || '').replace(/^pontile\s+/i, '');
  function pontileFor(history, day, odsMooring) {
    const h = history || {};
    if (h[day] != null) return { value: h[day] === '-' ? '' : h[day], source: 'oggi' };
    if (odsMooring) return { value: pontLabel(odsMooring), source: 'ods' };
    const previous = Object.keys(h).filter(date => date < day).sort().pop();
    return previous && h[previous] !== '-' ? { value: h[previous], source: 'ieri' } : { value: '', source: '' };
  }

  // Apre l'A4 di una residenza nel visore, pronto da stampare.
  function openResidence(residenza, turniNavi, monday) {
    const sheet = sheetFor(residenza, turniNavi, monday);
    mostra(page([sheet], sheet.title, false), sheet.title);
  }

  window.NaviServiziTerra = {
    RESIDENZE, DATA, defaultMonday, indexTurniNavi, turniDelGiorno, naviDelGiorno, ormeggiSettimana, ferryRows, minutes, openResidence,
    courseKey, pontLabel, pontileFor,
    buildHtml, buildMadernoHtml, buildResidenceHtml, buildAllHtml, documents, open, mostra
  };
})();
