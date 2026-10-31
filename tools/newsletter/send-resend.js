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

async function sendEmail() {
  const apiKey = getApiKey();
  const htmlPath = path.join(__dirname, 'anteprima-newsletter.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const payload = {
    from: 'NaviSuite <onboarding@resend.dev>',
    to: ['ose291@gmail.com'],
    subject: '⚓ NaviSuite — I tuoi turni della settimana e Bandi Concorso Aperti',
    html: html
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
      console.log('✅ Email inviata con successo! ID:', data.id);
    } else {
      console.error('❌ Errore Resend:', data);
    }
  } catch (err) {
    console.error('❌ Fetch error:', err);
  }
}

sendEmail();
