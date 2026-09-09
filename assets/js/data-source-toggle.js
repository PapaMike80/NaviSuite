(function () {
  'use strict';
  // Interruttore admin: sorgente dati Firebase <-> PocketBase (test).
  // Solo su impostazioni.html, solo per gli amministratori. Per-dispositivo:
  // ogni admin cambia la propria copia, gli altri non sono toccati.
  if (!/(?:^|\/)impostazioni\.html$/i.test(location.pathname)) return;

  const profile = (() => {
    try { return JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null'); }
    catch (_) { return null; }
  })();
  const isAdmin = window.NaviRoles
    ? window.NaviRoles.isAdminAgent(profile)
    : ['91', '92'].includes(String(profile && profile.id || '')) || String(profile && profile.role || '').toLowerCase() === 'admin';
  if (!isAdmin) return;

  const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch (_) { return d; } };
  const set = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (_) {} };
  const DEFAULT_PB = 'https://truenas-scale.tail805e51.ts.net';

  function mount() {
    const main = document.querySelector('main');
    if (!main || document.getElementById('data-source-setting')) return;

    const onPB = get('navisuite.dataSource', 'firebase') === 'pocketbase';
    const pbBase = get('navisuite.pbBase', DEFAULT_PB);

    const section = document.createElement('section');
    section.className = 'section';
    section.id = 'data-source-setting';
    section.innerHTML = [
      '<div class="section-head"><div><h2>Sorgente dati <small style="color:#2dd4bf">· prova</small></h2>',
      '<p>Commuta la lettura di turni ed equipaggi tra Firebase e PocketBase. Vale solo su questo dispositivo.</p></div>',
      '<span class="badge">Admin</span></div>',
      '<div class="switch-row"><div class="switch-copy"><strong>Leggi da PocketBase</strong>',
      '<span id="ds-state">' + (onPB ? 'Attivo — i dati arrivano da PocketBase.' : 'Spento — i dati arrivano da Firebase.') + '</span></div>',
      '<label class="switch"><input id="ds-toggle" type="checkbox"' + (onPB ? ' checked' : '') + '><i></i></label></div>',
      '<div class="field" style="max-width:520px;margin-top:6px"><label for="ds-base">URL PocketBase</label>',
      '<input id="ds-base" type="url" spellcheck="false" value="' + pbBase.replace(/"/g, '&quot;') + '" placeholder="' + DEFAULT_PB + '"></label>',
      '<p style="margin:6px 0 0;color:var(--muted);font-size:11px">In LAN puoi usare http://192.168.178.158:8095. Il dispositivo deve raggiungere questo indirizzo.</p></div>',
      '<div class="status" id="ds-status" aria-live="polite"></div>',
    ].join('');

    const intro = main.querySelector(':scope > .intro');
    if (intro) intro.insertAdjacentElement('afterend', section);
    else main.prepend(section);

    const toggle = section.querySelector('#ds-toggle');
    const base = section.querySelector('#ds-base');
    const status = section.querySelector('#ds-status');

    const apply = () => {
      const b = String(base.value || '').trim().replace(/\/$/, '');
      set('navisuite.pbBase', b && b !== DEFAULT_PB ? b : '');
      set('navisuite.dataSource', toggle.checked ? 'pocketbase' : '');
      try { window.NaviSharedData && window.NaviSharedData.clear(); } catch (_) {}
      try { localStorage.removeItem('turno_finali_data'); } catch (_) {}
      try { localStorage.removeItem('navisuite.oggi.snapshot.v1'); } catch (_) {}
      status.textContent = 'Salvato. Ricarico con la sorgente ' + (toggle.checked ? 'PocketBase' : 'Firebase') + '…';
      setTimeout(() => location.reload(), 600);
    };

    toggle.addEventListener('change', apply);
    base.addEventListener('change', () => { if (toggle.checked) apply(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
