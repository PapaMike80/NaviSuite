/**
 * NaviSuite - Newsletter Settimanale (Tema Scuro Totale / Full Dark)
 * Colori ufficiali NaviSuite: #071923, #0b1c26, #102733, #2dd4bf, #67d7e6.
 * Zero inversioni di colore su iOS Dark Mode.
 */
const fs = require('fs');
const path = require('path');

const FIREBASE_SCHEDULE_URL = 'https://navisuite-f116f-default-rtdb.europe-west1.firebasedatabase.app/public/schedule.json';

const COURSE_INFO = {
  P1: { trips: '2–3', start: '09:10', end: '19:30', defaultShip: 'BRESCIA', berth: 'Peschiera' },
  P2: { trips: '30–39', start: '08:25', end: '18:35', defaultShip: 'ANDROMEDA', berth: 'Peschiera' },
  D1: { trips: '14–19', start: '09:15', end: '19:40', defaultShip: 'S. MARCO', berth: 'pont. 2 Desenzano' },
  D2: { trips: '20–27', start: '08:50', end: '19:00', defaultShip: 'BALDO', berth: 'pont. 3 Desenzano' },
  T1: { trips: '201–214', start: '08:10', end: '18:30', defaultShip: 'ADAMELLO', berth: 'porto interno Maderno' },
  T2: { trips: '231–244', start: '08:45', end: '19:10', defaultShip: 'MINCIO', berth: 'porto esterno Maderno' },
  M1: { trips: '91–94', start: '09:15', end: '19:25', defaultShip: 'MANTOVA', berth: 'pontile interno Maderno' },
  R1: { trips: '7–8', start: '08:45', end: '19:25', defaultShip: 'TRENTO', berth: 'Riva' },
  R2: { trips: '51–60', start: '08:10', end: '18:50', defaultShip: 'BRENNERO', berth: 'Riva' },
  AGM: { trips: 'Terra', start: '08:30', end: '17:00', defaultShip: 'Servizio a terra', berth: 'Maderno Scalo' },
  AGB: { trips: 'Terra', start: '08:30', end: '17:00', defaultShip: 'Servizio a terra', berth: 'Desenzano Biglietteria' },
  POND: { trips: 'Terra', start: '08:00', end: '19:30', defaultShip: 'Servizio a terra', berth: 'Desenzano Pontile' }
};

function getApiKey() {
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY;
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const m = content.match(/RESEND_API_KEY=(.+)/);
      if (m) return m[1].trim();
    }
  } catch (_) {}
  return '';
}

const SUBSCRIBERS = [
  {
    name: 'PEDRONI M.',
    displayName: 'Marco Pedroni',
    residence: 'MADERNO',
    email: 'ose291@gmail.com'
  }
];

const GIORNI_BREVI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function getMonday(d) {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDateIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatCompactDate(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayName = GIORNI_BREVI[d.getDay()];
  return `${day}/${m} ${dayName}`;
}

function toMinutes(t) {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function toClock(mins) {
  const v = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

async function fetchSchedule() {
  try {
    const res = await fetch(FIREBASE_SCHEDULE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Errore recupero schedule:', err.message);
    return null;
  }
}

async function getActiveConcorsi() {
  return [
    {
      titolo: '11 Posti Settore Naviganti (par. 116) — Tempo Indeterminato',
      badge: 'BANDO APERTO · SCADENZA RAVVICINATA',
      scadenza: '05 Novembre 2026 (ore 23:59)',
      urgent: true,
      descrizione: 'Selezione pubblica per Operatore Generico (CCNL Autoferrotranviari): 5 posti Garda/Maggiore, 6 Como. Bando integrale archiviato.',
      linkBando: 'https://navisuite.vercel.app/docs/naviganti/00_Bando_e_Atti_Ufficiali/Bando_172026_DE_Operatore_Generico_Naviganti.pdf',
      linkInPa: 'https://www.inpa.gov.it/bandi-e-avvisi/dettaglio-bando-avviso/?concorso_id=88c979c391b94e958a6f8eb39e275aac',
      linkQuiz: 'https://navisuite.vercel.app/concorso-naviganti.html'
    },
    {
      titolo: 'Operatore di Ufficio — Settore Amministrativo / Controllo (par. 130)',
      badge: 'ATTI AGGIORNATI · PROVA SCRITTA',
      scadenza: 'Elenco 69 Ammessi pubblicato',
      urgent: false,
      descrizione: 'Pubblicata la Determina con i 69 ammessi alla prova scritta. In attesa di data e sede di convocazione.',
      linkBando: 'https://navisuite.vercel.app/docs/controllo/00_Bando_e_Atti_Ufficiali/Elenco_candidati_ammessi_16_2026_DE.pdf',
      linkInPa: null,
      linkQuiz: 'https://navisuite.vercel.app/concorso-controllo.html'
    }
  ];
}

function resolveShipInfo(scheduleData, iso, shift) {
  const cleanShift = String(shift || '').trim().toUpperCase();
  const nonWorking = /^(RIP|#|F\.?P\.?|CON|FERIE|MAL)$/i.test(cleanShift);
  if (nonWorking) {
    return { isWorking: false, isTerra: false, nave: '—', refuel: false, ormeggio: '', presentation: '', trips: '', hours: '' };
  }

  const isTerra = /^(AGM|AGB|POND|DT|AGT|PONM|IE)$/i.test(cleanShift);

  let nave = '';
  let refuel = false;
  let ormeggio = '';

  const list = scheduleData?.turni_navi || [];
  const found = list.find(item => item?.attiva !== false && String(item?.data || '').slice(0, 10) === iso && String(item?.corsa || '').trim().toUpperCase() === cleanShift);
  if (found) {
    nave = found.nave || '';
    refuel = /s[iì]|true|1/i.test(String(found.rifornimento_mattina || found.rif || ''));
    ormeggio = found.ormeggio_serale || found.ormeggio || '';
  }

  const course = COURSE_INFO[cleanShift];
  if (!nave && course?.defaultShip) {
    nave = course.defaultShip;
    if (cleanShift === 'T2') refuel = (iso.endsWith('-30') || iso.endsWith('-23'));
  }
  if (!ormeggio && course?.berth) {
    ormeggio = course.berth;
  }

  let presentation = '';
  let hours = '';
  let trips = '';

  if (course && !isTerra) {
    trips = course.trips;
    hours = `${course.start} – ${course.end}`;
    const startMins = toMinutes(course.start);
    if (startMins !== null) {
      const presMins = startMins - (refuel ? 90 : 60);
      presentation = toClock(presMins);
    }
  } else if (isTerra) {
    hours = '08:30 – 17:00';
    presentation = '08:15';
    trips = 'Servizio a terra';
  }

  return {
    isWorking: true,
    isTerra,
    nave: nave || (isTerra ? 'Servizio a terra' : 'In assegnazione'),
    refuel,
    ormeggio,
    presentation,
    hours,
    trips
  };
}

function buildHtml({ displayName, residence, recipientEmail, weekRangeLabel, schedule, concorsi }) {
  const dayCardsHtml = schedule.map(day => {
    const isRip = day.shift === 'RIP' || day.shift.toLowerCase() === 'rip';
    const isFp = day.shift === 'F.P.' || day.shift === '#';
    const isWork = day.info.isWorking;
    const isToday = day.isToday;

    // Dark Card styling (Palette NaviSuite: #102733, #143140, #1f4250)
    let cardBg = '#102733';
    let cardBorder = '#1f4250';
    let shiftBadgeBg = '#0284c7';
    let shiftBadgeColor = '#ffffff';
    let shiftBorder = '1px solid #38bdf8';

    if (isToday) {
      cardBg = '#143140';
      cardBorder = '#2dd4bf';
    } else if (isRip) {
      cardBg = '#0b1e28';
      cardBorder = '#163340';
      shiftBadgeBg = '#162b35';
      shiftBadgeColor = '#94a3b8';
      shiftBorder = '1px solid #234250';
    } else if (isFp) {
      cardBg = '#1b1a33';
      cardBorder = '#581c87';
      shiftBadgeBg = '#3b0764';
      shiftBadgeColor = '#d8b4fe';
      shiftBorder = '1px solid #7e22ce';
    }

    return `
      <!-- Giorno Card (Dark Theme) -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8px; background-color: ${cardBg}; border: 1px solid ${cardBorder}; ${isToday ? 'border-left: 4px solid #2dd4bf;' : ''} border-radius: 10px; overflow: hidden;">
        <tr>
          <td style="padding: 12px 14px;">
            
            <!-- Riga 1: Data + Turno & Nave -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td valign="middle">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 15px; font-weight: 800; color: ${isToday ? '#2dd4bf' : '#eaf2f4'}; font-family: monospace, sans-serif;">
                      ${day.compactDate}
                    </span>
                    ${isToday ? '<span style="display: inline-block; background-color: #2dd4bf; color: #06231f; font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.05em;">OGGI</span>' : ''}
                  </div>
                </td>
                <td align="right" valign="middle">
                  <div style="display: inline-flex; align-items: center; gap: 8px;">
                    <span style="display: inline-block; background-color: ${shiftBadgeBg}; color: ${shiftBadgeColor}; border: ${shiftBorder}; font-weight: 900; font-size: 13px; font-family: monospace; padding: 3px 8px; border-radius: 6px; min-width: 32px; text-align: center;">
                      ${day.shift}
                    </span>
                    ${isWork ? `
                      <span style="font-size: 14px; font-weight: 800; color: #67d7e6; white-space: nowrap;">
                        ${day.info.isTerra ? '🏢 ' + day.info.nave : '⛴ ' + day.info.nave}
                      </span>
                    ` : ''}
                  </div>
                </td>
              </tr>
            </table>

            <!-- Riga 2: Dettagli operativi per i giorni di lavoro -->
            ${isWork ? `
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #1f4250; font-size: 12px; color: #eaf2f4; line-height: 1.5;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <!-- Presentazione & Rifornimento -->
                      <div style="margin-bottom: 3px;">
                        <strong style="color: #ffffff;">⏱ Presentazione: ${day.info.presentation}</strong>
                        ${day.info.refuel ? `
                          <span style="display: inline-block; margin-left: 6px; background-color: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid #fbbf24; font-weight: 900; font-size: 10px; padding: 2px 6px; border-radius: 4px;">
                            ⛽ RIFORNIMENTO MATTINO (+30m)
                          </span>
                        ` : ''}
                      </div>

                      <!-- Orario corse & Ormeggio -->
                      <div style="color: #9fb8c2; font-size: 12px;">
                        ${day.info.trips && !day.info.isTerra ? `<span>Corse <strong style="color: #ffffff;">${day.info.trips}</strong> · ${day.info.hours}</span>` : ''}
                        ${day.info.isTerra ? `<span>${day.info.trips} · ${day.info.hours}</span>` : ''}
                        ${day.info.ormeggio ? ` · <span style="color: #2dd4bf;">⚓ Ormeggio: <em>${day.info.ormeggio}</em></span>` : ''}
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
            ` : `
              <!-- Riga per Riposo / Festività Pagata -->
              <div style="margin-top: 4px; font-size: 12px; color: ${day.shift === 'F.P.' ? '#c084fc' : '#94a3b8'}; font-style: italic;">
                ${isRip ? 'Riposo settimanale' : (day.shift === 'F.P.' ? 'Festività Pagata (F.P.) — 1 Novembre' : 'Non in turno')}
              </div>
            `}

          </td>
        </tr>
      </table>
    `;
  }).join('');

  const concorsiCards = concorsi.map(c => `
    <div style="background-color: #102733; border: 1px solid #1f4250; border-left: 4px solid ${c.urgent ? '#fb7185' : '#2dd4bf'}; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 4px; margin-bottom: 4px;">
        <span style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; color: ${c.urgent ? '#fb7185' : '#2dd4bf'}; background-color: rgba(251,113,133,0.12); padding: 2px 6px; border-radius: 4px;">
          ${c.badge}
        </span>
        <span style="font-size: 11px; font-weight: 800; color: #fb7185;">⏰ Scadenza: ${c.scadenza}</span>
      </div>
      <h4 style="margin: 4px 0 3px; font-size: 14px; color: #ffffff; font-weight: 800; line-height: 1.3;">${c.titolo}</h4>
      <p style="margin: 0 0 8px; font-size: 12px; color: #9fb8c2; line-height: 1.45;">${c.descrizione}</p>
      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        ${c.linkInPa ? `<a href="${c.linkInPa}" style="display: inline-block; padding: 6px 12px; background-color: #0284c7; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 11px; font-weight: 800;">🌐 Candidati su inPA →</a>` : ''}
        ${c.linkBando ? `<a href="${c.linkBando}" style="display: inline-block; padding: 6px 12px; background-color: #143140; border: 1px solid #1f4250; color: #eaf2f4; text-decoration: none; border-radius: 6px; font-size: 11px; font-weight: 700;">📄 Bando PDF</a>` : ''}
        ${c.linkQuiz ? `<a href="${c.linkQuiz}" style="display: inline-block; padding: 6px 12px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 11px; font-weight: 700;">🎯 Simulatore Quiz</a>` : ''}
      </div>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>NaviSuite News</title>
  <style>
    :root {
      color-scheme: dark;
      supported-color-schemes: dark;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #071923; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #eaf2f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #071923; padding: 18px 8px;">
    <tr>
      <td align="center">
        <!-- Container principale DARK -->
        <table role="presentation" width="100%" style="max-width: 620px; background-color: #0b1c26; border: 1px solid #1f4250; border-radius: 14px; overflow: hidden; box-shadow: 0 16px 30px rgba(0, 0, 0, 0.6);">
          
          <!-- Header Nautico Scuro -->
          <tr>
            <td style="background: linear-gradient(135deg, #071923 0%, #102733 100%); padding: 22px 18px; border-bottom: 2px solid #2dd4bf;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; background-color: rgba(45, 212, 191, 0.15); border: 1px solid #2dd4bf; border-radius: 6px; padding: 3px 8px; font-size: 10px; font-weight: 900; color: #2dd4bf; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">
                      ⚓ NaviSuite · Turni & Operatività
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: -0.01em;">
                      ${displayName}
                    </h1>
                    <p style="margin: 3px 0 0; color: #9fb8c2; font-size: 13px;">
                      Scalo di <strong style="color: #2dd4bf;">${residence}</strong> · Programma settimanale
                    </p>
                  </td>
                  <td align="right" valign="top">
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 5px 9px; color: #eaf2f4; font-size: 11px; font-weight: 800; text-align: right; white-space: nowrap;">
                      📅 ${weekRangeLabel}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Lista Giornate / Cards -->
          <tr>
            <td style="padding: 16px 14px 10px; background-color: #0b1c26;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 15px; font-weight: 900; color: #ffffff; display: flex; align-items: center; gap: 6px;">
                  <span>📋</span> Il tuo programma della settimana
                </h3>
                <span style="font-size: 11px; color: #9fb8c2; font-weight: 600;">Orario Invernale</span>
              </div>

              <!-- Elenco delle schede giorno -->
              ${dayCardsHtml}

              <!-- Pulsante apertura rapida NaviSuite -->
              <div style="text-align: center; margin: 16px 0 6px;">
                <a href="https://navisuite.vercel.app/mio-turno.html" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 13px; padding: 11px 22px; border-radius: 8px; box-shadow: 0 3px 6px rgba(2, 132, 199, 0.35);">
                  📱 Apri il tuo turno su NaviSuite →
                </a>
              </div>
            </td>
          </tr>

          <!-- Sezione Concorsi -->
          <tr>
            <td style="padding: 16px 14px; background-color: #081720; border-top: 1px solid #1f4250;">
              <div style="margin-bottom: 10px;">
                <h3 style="margin: 0; font-size: 15px; font-weight: 900; color: #fb7185; display: flex; align-items: center; gap: 6px;">
                  <span>🚨</span> Bandi di Concorso & Selezioni Aperte
                </h3>
                <p style="margin: 2px 0 0; font-size: 11px; color: #9fb8c2;">
                  Avvisi ufficiali Gestione Governativa Navigazione Laghi
                </p>
              </div>

              ${concorsiCards}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #05121a; padding: 18px 20px; text-align: center; color: #9fb8c2; font-size: 11px; line-height: 1.5; border-top: 1px solid #1f4250;">
              <p style="margin: 0 0 4px;">
                Newsletter automatica settimanale inviata ogni <strong>lunedì mattina</strong> da <strong>NaviSuite</strong>.
              </p>
              <p style="margin: 0; color: #64748b;">
                Destinatario: <strong style="color: #cbd5e1;">${displayName} (${residence})</strong> · <span style="color: #2dd4bf;">${recipientEmail}</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function run() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('❌ Manca RESEND_API_KEY!');
    process.exit(1);
  }

  const scheduleData = await fetchSchedule();
  const concorsi = await getActiveConcorsi();

  const now = new Date();
  const todayIso = formatDateIso(now);
  const monday = getMonday(now);

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDays.push({
      dateIso: formatDateIso(d),
      compactDate: formatCompactDate(d),
      isToday: formatDateIso(d) === todayIso
    });
  }

  const weekRangeLabel = `${weekDays[0].compactDate} – ${weekDays[6].compactDate}`;

  for (const sub of SUBSCRIBERS) {
    console.log(`Elaborazione per ${sub.displayName || sub.name} (${sub.email})...`);

    let agentTurni = {};
    if (scheduleData && scheduleData.residenze) {
      for (const resList of Object.values(scheduleData.residenze)) {
        const found = resList.find(a => String(a.agente || '').toUpperCase() === sub.name.toUpperCase());
        if (found && found.turni) {
          agentTurni = found.turni;
          break;
        }
      }
    }

    const scheduleList = weekDays.map(day => {
      const shift = agentTurni[day.dateIso] || '-';
      const info = resolveShipInfo(scheduleData, day.dateIso, shift);

      return {
        compactDate: day.compactDate,
        shift: shift,
        isToday: day.isToday,
        info: info
      };
    });

    const html = buildHtml({
      name: sub.name,
      displayName: sub.displayName || sub.name,
      residence: sub.residence,
      recipientEmail: sub.email,
      weekRangeLabel: weekRangeLabel,
      schedule: scheduleList,
      concorsi: concorsi
    });

    const previewPath = path.join(__dirname, 'anteprima-newsletter.html');
    fs.writeFileSync(previewPath, html, 'utf8');

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'NaviSuite <onboarding@resend.dev>',
          to: [sub.email.toLowerCase()],
          subject: `⚓ NaviSuite — I tuoi turni (${weekRangeLabel}), Nave, Rifornimenti & Concorsi`,
          html: html
        })
      });

      const resData = await res.json();
      if (res.ok) {
        console.log(`✅ Nuova versione FULL DARK inviata a ${sub.email}! ID: ${resData.id}`);
      } else {
        console.error(`❌ Errore invio:`, resData);
      }
    } catch (err) {
      console.error(`❌ Errore rete:`, err.message);
    }
  }
}

run();
