(() => {
  let scheduled = 0;
  document.addEventListener('click', event => {
    const cell = event.target.closest('td[data-row="hours"][data-date]');
    if (!cell) return;
    const entry = entries.find(item => item.date === cell.dataset.date);
    scheduled = entry ? (Number(entry.serviceMinutes) || Math.round((Number(shiftFor(entry.shift).hours) || 0) * 60)) : 0;
  }, true);
  new MutationObserver(() => {
    const dialog = document.getElementById('monthlyValueDialog');
    const actions = dialog?.querySelector('.monthly-dialog-actions');
    if (!dialog || !actions || actions.querySelector('.monthly-dialog-reset')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'monthly-dialog-reset'; button.textContent = 'Ripristina ore corsa';
    actions.prepend(button);
    button.addEventListener('click', () => {
      const input = dialog.querySelector('input');
      if (!input || !scheduled) return;
      input.value = String(Math.floor(scheduled / 60)).padStart(2, '0') + ':' + String(scheduled % 60).padStart(2, '0');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
  }).observe(document.body, { childList: true, subtree: true });
})();

(() => {
  const printButton = document.getElementById('monthlyPrint');
  if (!printButton) return;

  const FIXED_HOLIDAYS = new Set(['01-01','01-06','04-25','05-01','06-02','08-15','11-01','12-08','12-25','12-26']);
  const overtimeApi = window.NaviOvertimeComponents;

  const html = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const clock = minutes => {
    const value = Math.max(0, Math.round(Number(minutes) || 0));
    return value ? `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}` : '';
  };

  const dateIso = (year, month, day) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const serviceMinutes = entry => {
    if (!entry) return 0;
    const explicit = Number(entry.serviceMinutes);
    if (Number.isFinite(explicit) && explicit >= 0) return explicit;
    try {
      return Math.max(0, Math.round((Number(shiftFor(entry.shift).hours) || 0) * 60));
    } catch (_) {
      return 0;
    }
  };

  const overtimeMinutes = entry => {
    if (!entry) return 0;
    if (overtimeApi?.total) return Math.max(0, Math.round(Number(overtimeApi.total(entry)) || 0));
    return Math.max(0, Math.round(Number(entry.delay) || 0));
  };

  const workedMinutes = entry => {
    if (!entry) return 0;
    const manual = Number(entry.workedMinutes);
    if (Number.isFinite(manual) && manual >= 0) return manual;
    return serviceMinutes(entry) + overtimeMinutes(entry);
  };

  const missedRestMinutes = entry => Math.max(
    0,
    Math.round(Number(entry?.missedRest ?? entry?.missedRestMinutes ?? entry?.mancatoRiposo ?? 0) || 0)
  );

  const isWorking = entry => {
    if (!entry) return false;
    const shift = String(entry.shift || '').trim().toUpperCase();
    return !['RIP', 'RIPOSO', 'MALATTIA'].includes(shift);
  };

  const serviceCode = entry => {
    if (!entry) return '';
    const shift = String(entry.shift || '').trim().toUpperCase();
    if (shift === 'RIPOSO' || shift === 'RIP') return 'RIP';
    if (shift === 'MALATTIA') return 'MAL';
    if (shift === 'FERIE') return 'FER';
    return shift;
  };

  const holidayValue = (entry, date) => {
    if (!entry || !isWorking(entry)) return false;
    if (entry.holidayWorked !== undefined) return !!entry.holidayWorked;
    const key = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return date.getDay() === 0 || FIXED_HOLIDAYS.has(key);
  };

  const ticketDue = entry => {
    if (!isWorking(entry)) return false;
    try { return !!shiftFor(entry.shift).meal; } catch (_) { return false; }
  };

  const ticketUsed = entry =>
    !!entry && (entry.ticketPresence === undefined ? !!entry.mealUsed : !!entry.ticketPresence);

  const n = value => Math.max(0, Math.round(Number(value) || 0));
  const yes = value => value ? 1 : 0;

  const rows = [
    { label:'SERVIZIO', unit:'', type:'text', highlight:true, value: entry => serviceCode(entry) },
    { label:'ORE LAVORATE', unit:'H', type:'hours', highlight:true, value: entry => isWorking(entry) ? workedMinutes(entry) : 0 },
    { label:'LAVORO STRAORD.', unit:'H', type:'hours', highlight:true, value: entry => isWorking(entry) ? overtimeMinutes(entry) : 0 },
    { label:'(Straord. Autorizzato)', unit:'H', type:'hours', value: entry => n(entry?.authorizedOvertimeMinutes ?? entry?.straordinarioAutorizzato ?? 0) },
    { label:'IND. ALISCAFO', unit:'N', type:'count', highlight:true, value: entry => isWorking(entry) ? yes(String(entry.shift || '').toUpperCase() === 'SR1' || n(entry?.hydrofoil) > 0) : 0 },
    { label:'LAVORO NOTTURNO', unit:'H', type:'hours', value: entry => n(entry?.nightMinutes ?? entry?.nightWorkMinutes ?? 0) },
    { label:'TRASFERTE 15%', unit:'N', type:'count', value: entry => yes(isWorking(entry) && Number(entry?.allowanceRate) === 15) },
    { label:'TRASFERTE 50%', unit:'N', type:'count', value: entry => yes(isWorking(entry) && (Number(entry?.allowanceRate) === 50 || entry?.travel === true)) },
    { label:'DIARIE 9%', unit:'N', type:'count', highlight:true, value: entry => yes(isWorking(entry) && Number(entry?.allowanceRate) === 9) },
    { label:'DIARIE 13%', unit:'N', type:'count', value: entry => yes(isWorking(entry) && Number(entry?.allowanceRate) === 13) },
    { label:'DIARIE 24%', unit:'N', type:'count', highlight:true, value: entry => yes(isWorking(entry) && Number(entry?.allowanceRate) === 24) },
    { label:'PERNOTT. 40% NAV.', unit:'N', type:'count', highlight:true, value: entry => yes(isWorking(entry) && entry?.overnight40) },
    { label:'PERNOTT. 40% T.', unit:'N', type:'count', value: entry => yes(isWorking(entry) && (entry?.overnight40Terra || entry?.overnightLand40)) },
    { label:'MAGG. NASTRO', unit:'H', type:'hours', value: entry => n(entry?.maggNastroMinutes ?? entry?.ribbonMinutes ?? 0) },
    { label:'SPOSTATO RIPOSO', unit:'H', type:'hours', value: entry => n(entry?.shiftedRestMinutes ?? entry?.spostatoRiposo ?? 0) },
    { label:"FESTIVITA'", unit:'H', type:'hours', highlight:true, value: (entry, date) => holidayValue(entry, date) ? workedMinutes(entry) : 0 },
    { label:'MANCATO RIPOSO', unit:'H', type:'hours', highlight:true, value: entry => missedRestMinutes(entry) },
    { label:'IND COMANDO T.O', unit:'N', type:'count', highlight:true, value: entry => yes(entry?.commandAllowance || entry?.indComando) },
    { label:'ORE MANSIONI DIV.', unit:'H', type:'hours', value: entry => n(entry?.differentDutyMinutes ?? entry?.mansioniDiverseMinutes ?? 0) },
    { label:'IND GIORN D.M.', unit:'N', type:'count', value: entry => yes(isWorking(entry) && entry?.cashHandling) },
    { label:'TRASF.COMM.ESAMI 15%', unit:'N', type:'count', value: entry => yes(entry?.examTravelRate === 15) },
    { label:'TRASF.COMM.ESAMI 50%', unit:'N', type:'count', value: entry => yes(entry?.examTravelRate === 50) },
    { label:'TICKET PRESENZA', unit:'N', type:'count', highlight:true, value: entry => yes(ticketDue(entry)) },
    { label:'MENSA', unit:'N', type:'count', highlight:true, value: entry => yes(ticketDue(entry) && ticketUsed(entry)) },
    { label:'2° TICKET PRESENZA', unit:'N', type:'count', highlight:true, value: entry => isWorking(entry) ? n(entry?.secondMeal) : 0 },
    { label:"RIMB.P. PIE' LISTA DA FISC.", unit:'', type:'count', value: entry => n(entry?.rimborsoPiedilista ?? 0) },
    { label:'CONC.P.TR IN RETE', unit:'N', type:'count', value: entry => n(entry?.concessioneTrasportoRete ?? 0) },
    { label:'CONC.P.TR F.RETE', unit:'N', type:'count', value: entry => n(entry?.concessioneTrasportoFuoriRete ?? 0) },
    { label:'IND IMBARCO', unit:'N', type:'count', highlight:true, value: entry => yes(isWorking(entry) && entry?.embark) },
    { label:'IND.SUPPL.IMBARCO', unit:'N', type:'count', value: entry => n(entry?.supplementoImbarco ?? 0) },
    { label:'IND TURNO', unit:'N', type:'count', value: entry => n(entry?.turnAllowance ?? 0) },
    { label:'IND TURNO DOM', unit:'N', type:'count', value: entry => n(entry?.sundayTurnAllowance ?? 0) },
    { label:'IND DOM NON TURN', unit:'N', type:'count', value: entry => n(entry?.sundayNonTurnAllowance ?? 0) },
    { label:'TR ESTERO', unit:'N', type:'count', value: entry => n(entry?.foreignTravel ?? 0) },
    { label:'ORE HANDICAP L.104', unit:'H', type:'hours', value: entry => n(entry?.law104Minutes ?? entry?.handicap104Minutes ?? 0) },
    { label:'SCIOPERO', unit:'H', type:'hours', value: entry => n(entry?.strikeMinutes ?? 0) }
  ];

  const formatValue = (row, raw) => {
    if (row.type === 'hours') return clock(raw);
    if (row.type === 'count') return n(raw) ? String(n(raw)) : '';
    return String(raw || '');
  };

  const totalValue = (row, values) => {
    if (row.type === 'hours') return clock(values.reduce((sum, value) => sum + n(value), 0));
    if (row.type === 'count') {
      const total = values.reduce((sum, value) => sum + n(value), 0);
      return total ? String(total) : '';
    }
    return '';
  };

  const readAgent = () => {
    let profile = null;
    for (const key of ['navidiaria.activeAgent', 'naviturni_logged_agent']) {
      try {
        const value = localStorage.getItem(key);
        if (value) { profile = JSON.parse(value); break; }
      } catch (_) {}
    }
    const fallbackName = document.getElementById('sidebarAgentName')?.textContent?.trim() || '';
    return {
      name: String(profile?.name || profile?.agente || profile?.cognome || fallbackName || '').trim(),
      qualifica: String(profile?.qualifica || profile?.grado || profile?.role || '').trim()
    };
  };

  function buildOfficialSheet() {
    const monthValue = document.getElementById('monthFilter')?.value;
    if (!/^\d{4}-\d{2}$/.test(monthValue || '')) return null;

    const [year, month] = monthValue.split('-').map(Number);
    const monthDate = new Date(year, month - 1, 1, 12);
    const monthLabel = new Intl.DateTimeFormat('it-IT', { month:'long', year:'numeric' })
      .format(monthDate).toUpperCase();
    const maxDay = new Date(year, month, 0, 12).getDate();
    const agent = readAgent();
    const entryByDay = new Map();

    for (let day = 1; day <= maxDay; day += 1) {
      const key = dateIso(year, month, day);
      entryByDay.set(day, entries.find(entry => entry.date === key) || null);
    }

    const dayHeaders = Array.from({ length:31 }, (_, index) =>
      `<th class="day-head">${String(index + 1).padStart(2, '0')}</th>`
    ).join('');

    const body = rows.map(row => {
      const values = Array.from({ length:31 }, (_, index) => {
        const day = index + 1;
        if (day > maxDay) return null;
        const entry = entryByDay.get(day);
        const date = new Date(year, month - 1, day, 12);
        return row.value(entry, date);
      });
      const cells = values.map((value, index) =>
        `<td class="${index + 1 > maxDay ? 'outside-month' : ''}">${index + 1 > maxDay ? '' : html(formatValue(row, value))}</td>`
      ).join('');
      const label = row.highlight
        ? `<span class="marker">${html(row.label)}</span>`
        : html(row.label);
      return `<tr>
        <th class="voice">${label}</th>
        <th class="unit">${html(row.unit)}</th>
        <td class="carry"></td>
        ${cells}
        <td class="result">${html(totalValue(row, values.filter(value => value !== null)))}</td>
      </tr>`;
    }).join('');

    return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Distinta ${html(monthLabel)}</title>
<style>
  @page { size: A4 landscape; margin: 6mm 7mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { font-family: Arial, Helvetica, sans-serif; }
  .sheet { width: 100%; }
  .top {
    display: grid;
    grid-template-columns: 45mm 68mm 1fr 58mm;
    gap: 4mm;
    align-items: end;
    min-height: 12mm;
    margin-bottom: 1.2mm;
    font-size: 6.4pt;
    font-weight: 700;
  }
  .company { line-height: 1.35; white-space: nowrap; }
  .field { display: flex; align-items: flex-end; gap: 1.5mm; white-space: nowrap; }
  .field b { font-size: 6.2pt; }
  .field span {
    flex: 1;
    min-width: 20mm;
    min-height: 3.2mm;
    border-bottom: .35mm solid #000;
    text-align: center;
    font-size: 6.6pt;
    font-weight: 700;
    padding: 0 .8mm .3mm;
  }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  .distinta { border: .45mm solid #000; }
  .distinta col.voice-col { width: 42mm; }
  .distinta col.unit-col { width: 5mm; }
  .distinta col.carry-col,
  .distinta col.result-col { width: 7mm; }
  .distinta th, .distinta td {
    border: .28mm solid #000;
    height: 4mm;
    padding: 0 .35mm;
    text-align: center;
    vertical-align: middle;
    line-height: 1;
    font-size: 5.55pt;
    overflow: hidden;
    white-space: nowrap;
  }
  .distinta thead th {
    height: 5mm;
    font-size: 6pt;
    font-weight: 700;
  }
  .distinta .voices-head { text-align: center; letter-spacing: 1.8mm; font-size: 7.2pt; }
  .distinta .voice {
    text-align: left;
    padding-left: .7mm;
    font-size: 6.2pt;
    font-weight: 700;
  }
  .distinta .unit {
    text-align: center;
    font-size: 5.8pt;
    font-weight: 700;
  }
  .distinta .carry,
  .distinta .result { font-weight: 700; }
  .distinta .outside-month { background: #f7f7f7; }
  .marker {
    display: inline;
    padding: 0 .25mm;
    background: linear-gradient(
      to bottom,
      transparent 18%,
      rgba(255, 62, 139, .64) 18%,
      rgba(255, 62, 139, .64) 88%,
      transparent 88%
    );
  }
  .footer {
    display: grid;
    grid-template-columns: 42mm 1fr 1fr 1fr 1.08fr;
    min-height: 15mm;
    border: .45mm solid #000;
    border-top: 0;
  }
  .footer > div {
    position: relative;
    border-right: .28mm solid #000;
    padding: 1.2mm 1.5mm;
    font-size: 5.8pt;
    font-weight: 700;
  }
  .footer > div:last-child { border-right: 0; }
  .date-box { text-align: left; }
  .signature { text-align: center; }
  .signature span { display: block; margin-top: .2mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div class="company">NAVIGAZIONE LAGO DI GARDA<br>GESTIONE GOVERNATIVA</div>
      <div class="field"><b>DISTINTA MESE DI</b><span>${html(monthLabel)}</span></div>
      <div class="field"><b>AGENTE</b><span>${html(agent.name.toUpperCase())}</span></div>
      <div class="field"><b>QUALIFICA</b><span>${html(agent.qualifica.toUpperCase())}</span></div>
    </div>

    <table class="distinta">
      <colgroup>
        <col class="voice-col">
        <col class="unit-col">
        <col class="carry-col">
        ${Array.from({ length:31 }, () => '<col>').join('')}
        <col class="result-col">
      </colgroup>
      <thead>
        <tr>
          <th class="voices-head">V O C I</th>
          <th></th>
          <th>RIP</th>
          ${dayHeaders}
          <th>R</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>

    <div class="footer">
      <div class="date-box">DATA</div>
      <div class="signature"><span>FIRMA DELL'AGENTE</span></div>
      <div class="signature"><span>IL CAPO CANTIERE</span></div>
      <div class="signature"><span>IL LIQUIDATORE</span></div>
      <div class="signature"><span>IL DIRETTORE DI ESERCIZIO</span></div>
    </div>
  </div>
</body>
</html>`;
  }

  function printOfficialMonthlySheet(event) {
    event?.preventDefault();
    event?.stopImmediatePropagation();
    const documentHtml = buildOfficialSheet();
    if (!documentHtml) return;
    const popup = window.open('', '_blank');
    if (!popup) return;
    popup.opener = null;
    popup.document.open();
    popup.document.write(documentHtml);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 300);
  }

  printButton.addEventListener('click', printOfficialMonthlySheet, true);
})();
