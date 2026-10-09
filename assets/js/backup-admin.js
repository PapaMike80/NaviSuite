// Pagina Agenti · Backup di tutti: JSON completo (per ripristinare) + CSV di tutte le distinte (Excel).
(() => {
  const btn = document.getElementById('backup-all');
  const B = window.NaviDiariaBackup;
  if (!btn || !B) return;
  const status = document.getElementById('backup-status');
  btn.addEventListener('click', async () => {
    btn.disabled = true; status.textContent = 'Scarico i dati…';
    try {
      await window.NaviAdminFirebase.ready;
      const dati = await window.NaviAdminFirebase.getBackupCentrale();
      const diaria = dati.adminUpdates.diaria || {}, conv = dati.adminUpdates.diariaConversioni || {};
      const nomi = new Map((window.NaviSharedData?.directory?.() || []).map(a => [String(a.id), a.name]));
      Object.values(dati.adminUpdates.userRegistry || {}).forEach(u => { if (u?.id && u.name && !nomi.has(String(u.id))) nomi.set(String(u.id), u.name); });
      Object.values(dati.schedule?.residenze || {}).forEach(l => (l || []).forEach(a => { if (a?.agent_uid && !nomi.has(String(a.agent_uid))) nomi.set(String(a.agent_uid), a.agente || ''); }));
      Object.values(dati.adminUpdates.agentProfiles || {}).forEach(p => { if (p?.id && p.name && !nomi.has(String(p.id))) nomi.set(String(p.id), p.name); });
      const agenti = Object.entries(diaria).map(([id, r]) => ({ id: String(r?.agentId || id), nome: nomi.get(String(r?.agentId || id)) || String(r?.agentId || id).replace(/^AG_/, '').replace(/_([A-Z])$/, ' $1.').replace(/_/g, ' '),
        entries: Array.isArray(r?.entries) ? r.entries.filter(Boolean) : [], conversioni: conv[id]?.map || {} }))
        .filter(a => a.entries.length).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
      const base = `NaviSuite-backup-${B.oggi()}`;
      const json = JSON.stringify({ tipo: 'navisuite-backup-centrale', versione: 1, creato: new Date().toISOString(), ...dati });
      B.scarica(`${base}.zip`, B.zip([{ name: `${base}.json`, data: json }, { name: `${base}-distinte.csv`, data: B.csv(agenti) }]), 'application/zip');
      status.textContent = `Scaricato: ${agenti.length} distinte, ${(json.length / 1048576).toFixed(1)} MB.`;
    } catch (error) { status.textContent = `Backup non riuscito: ${error.message}`; }
    btn.disabled = false;
  });
})();
