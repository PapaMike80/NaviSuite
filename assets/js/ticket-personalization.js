(() => {
  if (window.NaviTicketPersonalizationLoaded) return;
  window.NaviTicketPersonalizationLoaded = true;

  const readProfile = () => {
    for (const key of ['navidiaria.activeAgent','naviturni_logged_agent']) {
      try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        if (value?.id) return value;
      } catch (_) {}
    }
    return null;
  };

  const profile = readProfile();
  if (!profile?.id) return;
  const key = `navisuite.ticketDefaultUsed.${profile.id}`;
  const getDefault = () => {
    const stored = localStorage.getItem(key);
    return stored === null ? true : stored === 'true';
  };
  const setDefault = value => {
    localStorage.setItem(key, value ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('navisuite-ticket-default-changed', {detail:{used:!!value,agentId:String(profile.id)}}));
  };
  window.NaviTicketPreference = {get:getDefault,set:setDefault,key,agentId:String(profile.id)};

  function installSettings() {
    if (!document.body?.classList.contains('impostazioni-page')) return;
    if (document.getElementById('ticket-preference')) return;
    const parent = document.querySelector('main');
    if (!parent) return;
    const section = document.createElement('section');
    section.className = 'section';
    section.id = 'ticket-preference';
    section.innerHTML = `
      <div class="section-head">
        <div><h2>Ticket</h2><p>Scegli come deve essere impostato il Ticket quando NaviDiaria crea o importa automaticamente una giornata. Potrai sempre cambiarlo sul singolo giorno.</p></div>
        <span class="badge">Personale</span>
      </div>
      <div class="field" style="max-width:360px;margin-top:16px">
        <label for="navisuite-ticket-default">Ticket usato di default</label>
        <select id="navisuite-ticket-default">
          <option value="true">Usato</option>
          <option value="false">Non usato</option>
        </select>
      </div>
      <div class="status" id="navisuite-ticket-status" aria-live="polite"></div>
    `;
    const target = document.getElementById('pagina-iniziale') || document.getElementById('gestione-utenti');
    if (target) parent.insertBefore(section, target); else parent.appendChild(section);
    const select = section.querySelector('#navisuite-ticket-default');
    const status = section.querySelector('#navisuite-ticket-status');
    select.value = String(getDefault());
    select.addEventListener('change', () => {
      setDefault(select.value === 'true');
      status.textContent = select.value === 'true'
        ? 'Preferenza salvata: il Ticket sarà usato di default.'
        : 'Preferenza salvata: il Ticket sarà non usato di default.';
    });
  }

  function installDiaria() {
    if (!document.body?.classList.contains('diaria-page')) return;

    const style = document.createElement('style');
    style.id = 'navisuite-ticket-personalization-style';
    style.textContent = `
      .navidiaria-meal-ticket-icon{background:linear-gradient(135deg,#fff7ed,#ffedd5)!important;border:1px solid #fb923c!important;border-radius:999px!important;box-shadow:0 1px 4px rgba(249,115,22,.28)!important;padding:2px!important}
      .navidiaria-meal-ticket-icon svg path:first-child{fill:#fef3c7!important;stroke:#d97706!important}
      .navidiaria-meal-ticket-icon svg path:nth-child(n+2){fill:none!important;stroke:#f97316!important}
      #monthlySheetGrid .row-ticket .monthly-label-full,#monthlySheetGrid .row-ticket .monthly-label-mobile{font-size:0!important}
      #monthlySheetGrid .row-ticket .monthly-label-full::after,#monthlySheetGrid .row-ticket .monthly-label-mobile::after{content:'Ticket';font-size:inherit}
      #monthlySheetGrid .row-ticket .monthly-label-full::after{font-size:.78rem}
      #monthlySheetGrid .row-ticket .monthly-label-mobile::after{font-size:.66rem}
    `;
    if (!document.getElementById(style.id)) document.head.appendChild(style);

    const renameTicketLabels = () => {
      const hero = document.getElementById('heroBp')?.parentElement?.querySelector('small');
      if (hero && hero.textContent.trim() !== 'Ticket') hero.textContent = 'Ticket';
      document.querySelectorAll('#consultivo thead th,#registro thead th,.today-edit-table thead th').forEach(node => {
        if (node.textContent.trim().toUpperCase() === 'BP') node.textContent = 'Ticket';
      });
      document.querySelectorAll('.today-edit-table tbody td[data-label="BP"]').forEach(node => node.dataset.label = 'Ticket');
      const formLabel = document.getElementById('entryMeal')?.closest('label')?.querySelector('span');
      if (formLabel && formLabel.textContent.trim() !== 'Ticket usato') formLabel.textContent = 'Ticket usato';
      document.querySelectorAll('[data-bubble-field="ticket"] span').forEach(node => {
        if (node.textContent.trim() !== 'Ticket') node.textContent = 'Ticket';
      });
      document.querySelectorAll('.inline-cell-editor option').forEach(option => {
        if (/DA ACCR|DA ACCREDITARE|NON USATO/i.test(option.textContent)) option.textContent = 'Non usato';
        if (/^USATO$/i.test(option.textContent)) option.textContent = 'Usato';
      });
    };

    const colorTicketIcons = () => {
      document.querySelectorAll('.navidiaria-meal-ticket-icon').forEach(icon => {
        icon.style.color = '#f97316';
      });
    };

    const dueForShift = code => {
      try { return !!shiftFor(code)?.meal && !['RIP','RIPOSO','MALATTIA'].includes(String(code || '').trim().toUpperCase()); }
      catch (_) { return false; }
    };

    const applyAutoDefault = () => {
      if (typeof entries === 'undefined' || !Array.isArray(entries)) return false;
      const wanted = getDefault();
      let changed = false;
      entries.forEach(entry => {
        if (!entry || entry.imported !== true) return;
        const next = dueForShift(entry.shift) ? wanted : false;
        if (!!entry.mealUsed !== next) { entry.mealUsed = next; changed = true; }
        if (entry.ticketPresence !== undefined && !!entry.ticketPresence !== next) { entry.ticketPresence = next; changed = true; }
      });
      if (changed) {
        try { if (typeof writeEntriesLocal === 'function') writeEntriesLocal('preferenza Ticket'); } catch (_) {}
        try { if (typeof markCloudDirty === 'function') markCloudDirty(); } catch (_) {}
      }
      return changed;
    };

    try {
      if (typeof render === 'function' && !render.__naviTicketWrapped) {
        const originalRender = render;
        const wrapped = function(...args) {
          applyAutoDefault();
          const result = originalRender.apply(this, args);
          queueMicrotask(() => { renameTicketLabels(); colorTicketIcons(); });
          return result;
        };
        wrapped.__naviTicketWrapped = true;
        render = wrapped;
        if (applyAutoDefault()) originalRender();
      }
    } catch (error) { console.warn('Preferenza Ticket: render non agganciato', error); }

    const applyFormDefault = () => {
      const select = document.getElementById('entryShift');
      const meal = document.getElementById('entryMeal');
      if (!select || !meal) return;
      try { if (typeof editingId !== 'undefined' && editingId) return; } catch (_) {}
      const due = dueForShift(select.value);
      meal.disabled = !due;
      meal.checked = due && getDefault();
      meal.closest('label').title = due
        ? (getDefault() ? 'Usato di default; deseleziona se non lo utilizzi' : 'Non usato di default; seleziona se lo utilizzi')
        : 'Ticket non previsto per questa giornata';
    };

    document.getElementById('entryShift')?.addEventListener('change', () => queueMicrotask(applyFormDefault));
    document.getElementById('entryForm')?.addEventListener('submit', () => setTimeout(applyFormDefault, 0));
    document.addEventListener('click', event => {
      if (event.target.closest('#openToday,#editSelectedDay,#monthlyToday,#cancelEdit,#toggleForm')) setTimeout(applyFormDefault, 0);
    });

    document.addEventListener('change', event => {
      const editor = event.target.closest?.('.inline-cell-editor');
      const cell = editor?.closest?.('[data-inline="shift"]');
      if (!editor || !cell || editor.value === '__restore__') return;
      const id = String(cell.dataset.entryId || '');
      setTimeout(() => {
        try {
          const entry = entries.find(item => String(item.id) === id);
          if (!entry) return;
          const next = dueForShift(entry.shift) ? getDefault() : false;
          entry.mealUsed = next;
          if (entry.ticketPresence !== undefined) entry.ticketPresence = next;
          if (typeof writeEntriesLocal === 'function') writeEntriesLocal('default Ticket dopo cambio servizio');
          if (typeof markCloudDirty === 'function') markCloudDirty();
          if (typeof render === 'function') render();
        } catch (_) {}
      }, 0);
    });

    if (window.NaviDayModal?.open && !window.NaviDayModal.__naviTicketWrapped) {
      const originalOpen = window.NaviDayModal.open.bind(window.NaviDayModal);
      window.NaviDayModal.open = options => {
        if (!options?.loadEntry) return originalOpen(options);
        const originalLoad = options.loadEntry;
        return originalOpen({...options, loadEntry: async (...args) => {
          const entry = await originalLoad(...args);
          if (entry && !entry.id) {
            const next = dueForShift(entry.shift) ? getDefault() : false;
            entry.mealUsed = next;
            entry.ticketPresence = next;
          }
          return entry;
        }});
      };
      window.NaviDayModal.__naviTicketWrapped = true;
    }

    if (!window.__naviTicketWindowOpenWrapped) {
      window.__naviTicketWindowOpenWrapped = true;
      const nativeOpen = window.open;
      window.open = function(...args) {
        const popup = nativeOpen.apply(this, args);
        if (!popup) return popup;
        try {
          const doc = popup.document;
          const nativeWrite = doc.write.bind(doc);
          doc.write = (...parts) => {
            let text = parts.join('');
            if (text.includes('class="distinta"') && text.includes('class="meal-mark"')) {
              text = text.replace(/<span class="meal-mark"[^>]*>[\s\S]*?<\/span>/g, '<span class="meal-mark" aria-label="Ticket usato">✓</span>');
              text = text.replace('</style></head>', '.meal-mark{display:inline-block!important;width:auto!important;height:auto!important;font-size:8pt!important;line-height:1!important;font-weight:700!important;color:#000!important}.meal-mark svg{display:none!important}</style></head>');
            }
            return nativeWrite(text);
          };
        } catch (_) {}
        return popup;
      };
    }

    const decorate = () => { renameTicketLabels(); colorTicketIcons(); };
    let pending = false;
    const schedule = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; decorate(); });
    };
    new MutationObserver(schedule).observe(document.body, {childList:true,subtree:true,characterData:true});
    window.addEventListener('navisuite-ticket-default-changed', () => {
      applyAutoDefault();
      applyFormDefault();
      try { if (typeof render === 'function') render(); } catch (_) {}
    });
    applyFormDefault();
    decorate();
  }

  const boot = () => {
    installSettings();
    installDiaria();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
