/**
 * NaviSuite - Briefing Quotidiano (Turno della Giornata Successiva - TEMA FULL DARK)
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
    email: 'ose291@gmail.com',
    prefQuotidiana: true
  }
];

const GIORNI_ESTESI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const GIORNI_BREVI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MESI_ESTESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

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

function formatFullDate(d) {
  return `${GIORNI_ESTESI[d.getDay()]} ${d.getDate()} ${MESI_ESTESI[d.getMonth()]} ${d.getFullYear()}`;
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

function findCrew(scheduleData, iso, shift) {
  if (!scheduleData?.residenze || !shift || /^(RIP|#|F\.?P\.?)$/i.test(shift)) return [];
  const cleanShift = String(shift).trim().toUpperCase();
  const crew = [];

  for (const list of Object.values(scheduleData.residenze)) {
    for (const a of list) {
      if (a.turni && String(a.turni[iso] || '').trim().toUpperCase() === cleanShift) {
        crew.push({
          name: a.agente || a.name,
          role: a.qualifica || a.grado || a.ruolo || 'Personale'
        });
      }
    }
  }
  return crew;
}

function buildDailyEmailHtml({ displayName, residence, recipientEmail, tomorrowFullDate, tomorrowCompact, shift, info, crew }) {
  const isRip = shift === 'RIP' || shift.toLowerCase() === 'rip';
  const isFp = shift === 'F.P.' || shift === '#';
  const isWork = info.isWorking;

  let statusBadgeText = isWork ? 'IN SERVIZIO' : (isRip ? 'RIPOSO' : 'FESTIVITÀ PAGATA');
  let statusBadgeBg = isWork ? '#0284c7' : (isRip ? '#162b35' : '#581c87');
  let statusBadgeColor = isWork ? '#ffffff' : (isRip ? '#94a3b8' : '#d8b4fe');
  let statusBadgeBorder = isWork ? '#38bdf8' : (isRip ? '#234250' : '#7e22ce');

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Briefing Quotidiano NaviSuite</title>
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
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #0b1c26; border: 1px solid #1f4250; border-radius: 14px; overflow: hidden; box-shadow: 0 16px 30px rgba(0, 0, 0, 0.6);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #071923 0%, #102733 100%); padding: 22px 18px; border-bottom: 2px solid #2dd4bf;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; background-color: rgba(45, 212, 191, 0.15); border: 1px solid #2dd4bf; border-radius: 6px; padding: 3px 8px; font-size: 10px; font-weight: 900; color: #2dd4bf; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">
                      ⚓ NaviSuite · Briefing Domani
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 21px; font-weight: 900;">
                      ${displayName}
                    </h1>
                    <p style="margin: 3px 0 0; color: #9fb8c2; font-size: 13px;">
                      Scalo di <strong style="color: #2dd4bf;">${residence}</strong>
                    </p>
                  </td>
                  <td align="right" valign="top">
                    <span style="display: inline-block; background-color: ${statusBadgeBg}; color: ${statusBadgeColor}; border: 1px solid ${statusBadgeBorder}; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase;">
                      ${statusBadgeText}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Intro Data -->
          <tr>
            <td style="padding: 16px 18px 12px; background-color: #0d222e; border-bottom: 1px solid #1f4250;">
              <p style="margin: 0; font-size: 13px; color: #9fb8c2; line-height: 1.5;">
                Promemoria del tuo servizio programmato per domani:
              </p>
              <h2 style="margin: 6px 0 0; font-size: 18px; font-weight: 900; color: #ffffff;">
                📅 ${tomorrowFullDate} (${tomorrowCompact})
              </h2>
            </td>
          </tr>

          <!-- Scheda Principale Servizio -->
          <tr>
            <td style="padding: 18px; background-color: #0b1c26;">
              
              ${isWork ? `
                <!-- Box Lavoro Attivo (Dark) -->
                <div style="background-color: #102733; border: 1px solid #1f4250; border-left: 5px solid #2dd4bf; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span style="display: inline-block; background-color: #0284c7; color: #ffffff; font-weight: 900; font-size: 18px; font-family: monospace; padding: 4px 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(2,132,199,0.4);">
                        ${shift}
                      </span>
                      <span style="font-size: 18px; font-weight: 900; color: #67d7e6;">
                        ${info.isTerra ? '🏢 ' + info.nave : '⛴ ' + info.nave}
                      </span>
                    </div>
                  </div>

                  <!-- Alert Rifornimento se presente -->
                  ${info.refuel ? `
                    <div style="background-color: rgba(251, 191, 36, 0.12); border: 1px solid #fbbf24; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 18px;">⛽</span>
                        <div>
                          <strong style="color: #fbbf24; font-size: 13px; text-transform: uppercase;">Rifornimento Carburante Mattino</strong>
                          <div style="font-size: 12px; color: #e2e8f0;">
                            Presentazione anticipata di 30 minuti compresa nel calcolo.
                          </div>
                        </div>
                      </div>
                    </div>
                  ` : ''}

                  <!-- Dettaglio Orari -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8px;">
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #9fb8c2;">Orario di Presentazione:</td>
                      <td style="padding: 6px 0; font-size: 16px; font-weight: 900; color: #ffffff; text-align: right;">
                        ⏱ ${info.presentation}
                      </td>
                    </tr>
                    ${info.trips && !info.isTerra ? `
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #9fb8c2;">Corse in Programma:</td>
                        <td style="padding: 6px 0; font-size: 14px; font-weight: 800; color: #ffffff; text-align: right;">
                          ${info.trips}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #9fb8c2;">Arco Orario Servizio:</td>
                        <td style="padding: 6px 0; font-size: 14px; font-weight: 700; color: #eaf2f4; text-align: right;">
                          ${info.hours}
                        </td>
                      </tr>
                    ` : ''}
                    ${info.ormeggio ? `
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #9fb8c2;">Ormeggio Serale:</td>
                        <td style="padding: 6px 0; font-size: 13px; font-weight: 800; color: #2dd4bf; text-align: right;">
                          ⚓ ${info.ormeggio}
                        </td>
                      </tr>
                    ` : ''}
                  </table>

                </div>

                <!-- Equipaggio di bordo se trovato -->
                ${crew.length > 0 ? `
                  <div style="background-color: #102733; border: 1px solid #1f4250; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;">
                    <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #2dd4bf; margin-bottom: 6px; letter-spacing: 0.05em;">
                      👥 Equipaggio assegnato sul turno
                    </div>
                    <div style="font-size: 13px; color: #eaf2f4; line-height: 1.5;">
                      ${crew.map(c => `• <strong style="color: #ffffff;">${c.name}</strong> <span style="color: #9fb8c2; font-size: 11px;">(${c.role})</span>`).join('<br>')}
                    </div>
                  </div>
                ` : ''}

              ` : `
                <!-- Box Festività Pagata / Riposo (Dark) -->
                <div style="background-color: ${isFp ? '#181329' : '#0e232e'}; border: 1px solid ${isFp ? '#7e22ce' : '#1f4250'}; border-radius: 10px; padding: 24px 18px; text-align: center; margin-bottom: 16px;">
                  <span style="display: inline-block; font-size: 36px; margin-bottom: 8px;">
                    ${isRip ? '☕' : '🎉'}
                  </span>
                  <h3 style="margin: 0 0 6px; font-size: 18px; font-weight: 900; color: ${isFp ? '#d8b4fe' : '#ffffff'};">
                    ${isRip ? 'Giornata di Riposo Settimanale' : 'Festività Pagata (F.P.)'}
                  </h3>
                  <p style="margin: 0; font-size: 13px; color: #9fb8c2;">
                    ${isRip ? 'Nessun servizio di bordo o di terra programmato per domani. Buon riposo!' : '1 Novembre — Festività contrattuale (Tutti i Santi). Nessun servizio da svolgere, buona festa!'}
                  </p>
                </div>
              `}

              <!-- CTA Button -->
              <div style="text-align: center; margin-top: 10px;">
                <a href="https://navisuite.vercel.app/mio-turno.html" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 13px; padding: 11px 22px; border-radius: 8px; box-shadow: 0 3px 6px rgba(2, 132, 199, 0.4);">
                  📱 Apri Il Mio Turno in App →
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #05121a; padding: 18px 20px; text-align: center; color: #9fb8c2; font-size: 11px; line-height: 1.5; border-top: 1px solid #1f4250;">
              <p style="margin: 0 0 6px;">
                Briefing quotidiano automatico inviato ogni sera da <strong>NaviSuite</strong>.
              </p>
              <p style="margin: 0; color: #64748b;">
                Destinatario: <strong style="color: #cbd5e1;">${displayName}</strong> · <a href="https://navisuite.vercel.app/impostazioni.html" style="color: #2dd4bf; text-decoration: none;">Modifica preferenze email in Impostazioni</a>
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

async function run(targetDateIso = null) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('❌ Manca RESEND_API_KEY!');
    process.exit(1);
  }

  const scheduleData = await fetchSchedule();

  let tomorrow = new Date();
  if (targetDateIso) {
    tomorrow = new Date(targetDateIso);
  } else {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }

  const iso = formatDateIso(tomorrow);
  const compact = formatCompactDate(tomorrow);
  const fullDate = formatFullDate(tomorrow);

  for (const sub of SUBSCRIBERS) {
    if (sub.prefQuotidiana === false) {
      console.log(`Salto ${sub.name}: preferenza quotidiana disattivata.`);
      continue;
    }

    console.log(`Elaborazione briefing quotidiano FULL DARK per ${sub.displayName} (${iso})...`);

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

    const shift = agentTurni[iso] || '-';
    const info = resolveShipInfo(scheduleData, iso, shift);
    const crew = findCrew(scheduleData, iso, shift);

    const html = buildDailyEmailHtml({
      name: sub.name,
      displayName: sub.displayName,
      residence: sub.residence,
      recipientEmail: sub.email,
      tomorrowFullDate: fullDate,
      tomorrowCompact: compact,
      shift,
      info,
      crew
    });

    const previewPath = path.join(__dirname, 'anteprima-quotidiana.html');
    fs.writeFileSync(previewPath, html, 'utf8');

    let subject = `⚓ NaviSuite — Domani (${compact}): ${shift === 'F.P.' ? 'Festività Pagata (F.P.)' : shift}`;
    if (info.isWorking && info.nave && info.nave !== '—') {
      subject += ` · ${info.isTerra ? info.nave : '⛴ ' + info.nave}`;
    }

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
          subject: subject,
          html: html
        })
      });

      const resData = await res.json();
      if (res.ok) {
        console.log(`✅ Briefing quotidiano FULL DARK inviato a ${sub.email}! ID: ${resData.id}`);
      } else {
        console.error(`❌ Errore invio briefing:`, resData);
      }
    } catch (err) {
      console.error(`❌ Errore rete:`, err.message);
    }
  }
}

const argDate = process.argv[2] || null;
run(argDate);

module.exports = { run };
