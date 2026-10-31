/**
 * NaviSuite - Alert Immediato Nuovo Concorso
 * Invia una notifica istantanea via email a tutti gli agenti quando viene pubblicato un nuovo concorso.
 */
const fs = require('fs');
const path = require('path');

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
  { name: 'MOSELE M.', email: 'ose291@gmail.com' }
];

async function sendConcorsoAlert(concorso) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('❌ Manca RESEND_API_KEY!');
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Allerta Concorso NaviSuite</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1c26; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1c26; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);">
          <!-- Header Red Alert -->
          <tr>
            <td style="background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%); padding: 26px 24px; text-align: left; border-bottom: 3px solid #ef4444;">
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                🚨 Allerta Concorso Navigazione Laghi
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; line-height: 1.25;">
                È stato pubblicato un nuovo bando di selezione!
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 24px;">
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 5px solid #dc2626; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <span style="display: inline-block; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #991b1b; margin-bottom: 4px;">
                  ${concorso.badge || 'BANDO UFFICIALE'}
                </span>
                <h2 style="margin: 4px 0 8px; font-size: 18px; color: #0f172a; font-weight: 800;">
                  ${concorso.titolo}
                </h2>
                <p style="margin: 0 0 10px; font-size: 14px; color: #475569; line-height: 1.5;">
                  ${concorso.descrizione}
                </p>
                <div style="font-size: 13px; font-weight: 800; color: #dc2626; margin-top: 8px;">
                  ⏰ Scadenza invio domanda: ${concorso.scadenza}
                </div>
              </div>

              <div style="display: flex; gap: 10px; flex-direction: column;">
                ${concorso.linkInPa ? `
                  <a href="${concorso.linkInPa}" style="display: block; text-align: center; background-color: #0284c7; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; padding: 12px; border-radius: 8px;">
                    🌐 Candidati sul Portale inPA →
                  </a>` : ''}
                ${concorso.linkBando ? `
                  <a href="${concorso.linkBando}" style="display: block; text-align: center; background-color: #0f172a; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 10px; border-radius: 8px;">
                    📄 Scarica il Bando Ufficiale PDF
                  </a>` : ''}
                ${concorso.linkQuiz ? `
                  <a href="${concorso.linkQuiz}" style="display: block; text-align: center; background-color: #10b981; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 10px; border-radius: 8px;">
                    🎯 Esercitati con il Simulatore Quiz NaviSuite
                  </a>` : ''}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #071923; padding: 18px 24px; text-align: center; color: #94a3b8; font-size: 12px;">
              Notifica automatica istantanea emessa da <strong>NaviSuite</strong>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  for (const sub of SUBSCRIBERS) {
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
          subject: `🚨 [NaviSuite] Nuovo Concorso: ${concorso.titolo}`,
          html: html
        })
      });
      const data = await res.json();
      if (res.ok) console.log(`✅ Allerta concorso inviata a ${sub.email}! ID: ${data.id}`);
      else console.error(`❌ Errore:`, data);
    } catch (e) {
      console.error(e);
    }
  }
}

// Se invocato direttamente da riga di comando
if (require.main === module) {
  sendConcorsoAlert({
    titolo: '11 Posti Settore Naviganti (par. 116) - Operatore Generico a Tempo Indeterminato',
    badge: 'BANDO APERTO · SCADENZA RAVVICINATA',
    scadenza: '05 Novembre 2026 (ore 23:59)',
    descrizione: 'Selezione pubblica ufficiale Gestione Governativa Navigazione Laghi per assunzioni a tempo pieno e indeterminato su Garda, Como e Maggiore.',
    linkInPa: 'https://www.inpa.gov.it/bandi-e-avvisi/dettaglio-bando-avviso/?concorso_id=88c979c391b94e958a6f8eb39e275aac',
    linkBando: 'https://navisuite.vercel.app/docs/naviganti/00_Bando_e_Atti_Ufficiali/Bando_172026_DE_Operatore_Generico_Naviganti.pdf',
    linkQuiz: 'https://navisuite.vercel.app/concorso-naviganti.html'
  });
}

module.exports = { sendConcorsoAlert };
