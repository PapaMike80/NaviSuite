/**
 * NaviSuite - Generatore & Sender Newsletter Settimanale + Concorsi
 */
const fs = require('fs');
const path = require('path');

async function buildEmailHtml({ agentName, residence, schedule, concorsi }) {
  const scheduleRows = schedule.map(day => {
    const isRip = day.shift === 'RIP' || day.shift.toLowerCase() === 'rip';
    const isFp = day.shift === 'F.P.' || day.shift === '#';
    const badgeColor = isRip ? '#64748b' : (isFp ? '#a855f7' : '#0284c7');
    const badgeBg = isRip ? '#f1f5f9' : (isFp ? '#faf5ff' : '#e0f2fe');
    const badgeBorder = isRip ? '#cbd5e1' : (isFp ? '#e9d5ff' : '#bae6fd');

    return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 14px; font-weight: 700; color: #1e293b; font-size: 14px;">${day.dayLabel}</td>
        <td style="padding: 12px 14px; font-family: monospace; font-size: 13px; color: #475569;">${day.date}</td>
        <td style="padding: 12px 14px; text-align: center;">
          <span style="display: inline-block; padding: 4px 12px; border-radius: 999px; font-weight: 800; font-size: 13px; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
            ${day.shift}
          </span>
        </td>
        <td style="padding: 12px 14px; font-size: 13px; color: #64748b;">${day.note || 'Servizio ordinario'}</td>
      </tr>
    `;
  }).join('');

  const concorsiCards = concorsi.map(c => `
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 5px solid ${c.urgent ? '#ef4444' : '#0284c7'}; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${c.urgent ? '#dc2626' : '#0369a1'}; background-color: ${c.urgent ? '#fef2f2' : '#f0f9ff'}; padding: 2px 8px; border-radius: 4px;">
          ${c.badge}
        </span>
        <span style="font-size: 12px; font-weight: 700; color: #dc2626;">⏰ Scadenza: ${c.scadenza}</span>
      </div>
      <h4 style="margin: 6px 0 4px; font-size: 16px; color: #0f172a; font-weight: 800;">${c.titolo}</h4>
      <p style="margin: 0 0 10px; font-size: 13px; color: #475569; line-height: 1.5;">${c.descrizione}</p>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        ${c.linkBando ? `<a href="${c.linkBando}" style="display: inline-block; padding: 6px 12px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 700;">📄 Scarica Bando PDF</a>` : ''}
        ${c.linkInPa ? `<a href="${c.linkInPa}" style="display: inline-block; padding: 6px 12px; background-color: #0284c7; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 700;">🌐 Candidati su inPA</a>` : ''}
        ${c.linkQuiz ? `<a href="${c.linkQuiz}" style="display: inline-block; padding: 6px 12px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 700;">🎯 Simulatore Quiz NaviSuite</a>` : ''}
      </div>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NaviSuite News - I tuoi turni e Concorsi</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1c26; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1c26; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" style="max-width: 640px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #071923 0%, #102733 100%); padding: 28px 24px; text-align: left; border-bottom: 3px solid #2dd4bf;">
              <div style="display: inline-block; background-color: rgba(45, 212, 191, 0.15); border: 1px solid #2dd4bf; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 800; color: #2dd4bf; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                ⚓ NaviSuite Newsletter Settimanale
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">
                Buongiorno, ${agentName}!
              </h1>
              <p style="margin: 6px 0 0; color: #94a3b8; font-size: 14px;">
                Residenza di <strong style="color: #2dd4bf;">${residence}</strong> · Programma turni & avvisi di servizio
              </p>
            </td>
          </tr>

          <!-- Intro Message -->
          <tr>
            <td style="padding: 20px 24px 12px; background-color: #f8fafc;">
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #334155;">
                Ecco il riepilogo automatico della tua settimana di servizio aggiornato in tempo reale con l'Ufficio Movimento e gli Ordini di Servizio.
              </p>
            </td>
          </tr>

          <!-- Schedule Table Section -->
          <tr>
            <td style="padding: 12px 24px 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #0f172a;">
                  📅 I tuoi turni della settimana
                </h3>
                <span style="font-size: 12px; color: #64748b; font-weight: 600;">Lun 26 Ott – Dom 1 Nov</span>
              </div>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f1f5f9; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">
                    <th style="padding: 10px 14px;">Giorno</th>
                    <th style="padding: 10px 14px;">Data</th>
                    <th style="padding: 10px 14px; text-align: center;">Turno</th>
                    <th style="padding: 10px 14px;">Dettaglio</th>
                  </tr>
                </thead>
                <tbody>
                  ${scheduleRows}
                </tbody>
              </table>

              <!-- Button CTA -->
              <div style="text-align: center; margin-top: 18px;">
                <a href="https://navisuite.vercel.app/mio-turno.html" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; padding: 12px 24px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.4);">
                  📱 Apri il Mio Turno su NaviSuite →
                </a>
              </div>
            </td>
          </tr>

          <!-- CONCORSI ATTIVI -->
          <tr>
            <td style="padding: 20px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
                <span style="font-size: 20px;">🚨</span>
                <div>
                  <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #991b1b;">
                    Bandi di Concorso & Selezioni Aperte
                  </h3>
                  <p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">
                    Avvisi ufficiali Gestione Governativa Navigazione Laghi
                  </p>
                </div>
              </div>

              ${concorsiCards}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #071923; padding: 22px 24px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.6;">
              <p style="margin: 0 0 6px;">
                Questa email è inviata automaticamente ogni <strong>lunedì mattina</strong> da <strong>NaviSuite</strong> per il personale della <em>Navigazione Lago di Garda</em>.
              </p>
              <p style="margin: 0; color: #64748b;">
                Destinatario: <strong style="color: #cbd5e1;">${agentName} (${residence})</strong> · <a href="mailto:ose291@gmail.com" style="color: #2dd4bf; text-decoration: none;">Ose291@gmail.com</a>
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
  const scheduleData = [
    { dayLabel: 'Lunedì', date: '26/10/2026', shift: '#', note: 'Non in turno' },
    { dayLabel: 'Martedì', date: '27/10/2026', shift: 'RIP', note: 'Riposo settimanale' },
    { dayLabel: 'Mercoledì', date: '28/10/2026', shift: 'RIP', note: 'Riposo settimanale' },
    { dayLabel: 'Giovedì', date: '29/10/2026', shift: 'P2', note: 'Servizio Peschiera 2' },
    { dayLabel: 'Venerdì', date: '30/10/2026', shift: 'RIP', note: 'Riposo settimanale' },
    { dayLabel: 'Sabato', date: '31/10/2026', shift: 'P1', note: 'Servizio Peschiera 1 (Oggi)' },
    { dayLabel: 'Domenica', date: '01/11/2026', shift: 'F.P.', note: 'Festivo / Fuori Presenza' },
  ];

  const concorsiData = [
    {
      titolo: 'Concorso 11 Posti Settore Naviganti (par. 116) - Operatore Generico',
      badge: 'BANDO APERTO · TEMPO INDETERMINATO',
      scadenza: '05 Novembre 2026 (ore 23:59)',
      urgent: true,
      descrizione: 'Selezione pubblica per 11 posti a tempo pieno e indeterminato (CCNL Autoferrotranviari) ripartiti tra Lago Maggiore (5), Lago di Como (6) e Direzione Garda.',
      linkBando: 'https://navisuite.vercel.app/docs/naviganti/00_Bando_e_Atti_Ufficiali/Bando_172026_DE_Operatore_Generico_Naviganti.pdf',
      linkInPa: 'https://www.inpa.gov.it/bandi-e-avvisi/dettaglio-bando-avviso/?concorso_id=88c979c391b94e958a6f8eb39e275aac',
      linkQuiz: 'https://navisuite.vercel.app/concorso-naviganti.html'
    },
    {
      titolo: 'Concorso Operatore di Ufficio - Settore Amministrativo / Ufficio Controllo (par. 130)',
      badge: 'AGGIORNAMENTO ATTI · PROVA SCRITTA',
      scadenza: 'Elenco 69 Ammessi pubblicato',
      urgent: false,
      descrizione: 'Pubblicata la Determina ufficiale del 14/10/2026 con i 69 ammessi alla prova d\'esame scritta. In attesa di pubblicazione data e sede convocazione.',
      linkBando: 'https://navisuite.vercel.app/docs/controllo/00_Bando_e_Atti_Ufficiali/Elenco_candidati_ammessi_16_2026_DE.pdf',
      linkInPa: null,
      linkQuiz: 'https://navisuite.vercel.app/concorso-controllo.html'
    }
  ];

  const html = await buildEmailHtml({
    agentName: 'MOSELE M.',
    residence: 'PESCHIERA',
    schedule: scheduleData,
    concorsi: concorsiData
  });

  const outPath = path.join(__dirname, 'anteprima-newsletter.html');
  fs.writeFileSync(outPath, html, 'utf8');
  console.log('Template generato con successo in:', outPath);
}

run();
