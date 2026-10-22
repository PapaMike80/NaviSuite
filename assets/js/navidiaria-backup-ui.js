// NaviDiaria · pulsante "Backup": porta alla pagina Backup e fonti (scarica, carica e confronta i backup).
(() => {
  const barra = document.getElementById('monthlyVerifyPayslip')?.parentElement;
  if (!barra) return;
  const backupBtn = document.createElement('button');
  backupBtn.type = 'button'; backupBtn.className = 'monthly-today-button'; backupBtn.textContent = '⤓ Backup';
  backupBtn.addEventListener('click', () => { location.href = 'backup-dati.html'; });
  barra.append(backupBtn);
  // Verifica busta: solo a chi puo' aprire la pagina (di norma gli admin, sezione Accesso alle pagine)
  const verifica = document.getElementById('monthlyVerifyPayslip');
  const aggiornaVerifica = () => { if (verifica && window.NaviRoles?.puoAprire) verifica.hidden = !window.NaviRoles.puoAprire('verifica-busta.html'); };
  aggiornaVerifica();
  window.addEventListener('navi-page-access', aggiornaVerifica); // dopo la rilettura da Firebase
})();
