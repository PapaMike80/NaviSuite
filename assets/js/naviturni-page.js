    let globalData = null;
    let currentResidence = "";
    let currentAgentsList = [];
    let selectedCol = null;
    let selectedShiftValue = "";
    let selectedCrewAgent = null;
    let crewNavigationMode = "fixed";
    let trElements = [];
    let pinnedAgentIdx = null;
    let activeShiftFilter = null;
    let dayPanelPlacement = "main";
    let syncingHorizontalScroll = false;
    let crewCompletenessCache = new Map();
    let coverageRenderHandle = null;
    let lastLoadedDataSignature = "";
    // true finché non è avvenuto il primo disegno completo della tabella.
    // Dopo, gli aggiornamenti in background sono "soft": non resettano
    // residenza/filtro/scroll scelti dall'utente.
    let turniFirstRender = true;
    let showPastColumns = false;
    let automaticPastFromTime = null;
    let isEditMode = false;
    let loggedAgentProfile = null;
    let baristaAccessApplied = false;
    let diariaShiftOverrides = new Map();
    const AGENT_LOGIN_STORAGE_KEY = "naviturni_logged_agent";
    const BARISTA_PRIVATE_SHIFT = "__PRIVATE__";
    // Cella "non qui": mascherata per la privacy delle bariste (sentinella) o
    // etichettata "A <residenza>" per un agente che, in quel giorno, e' altrove
    // per un cambio di residenza pianificato.
    const isElsewhereShift = v => v === BARISTA_PRIVATE_SHIFT || /^A [A-ZÀ-Ý' ]+$/.test(String(v || ""));
    const {
      beginMobileTapGesture,
      updateMobileTapGesture,
      finishMobileTapGesture,
      cancelMobileTapGesture,
      handleMobileTap,
      isSyntheticClickAfterTouch,
      readLoggedAgentProfile,
      getBaristaProfileId
    } = window.TurniShared;
    const isBaristaProfile = (profile = loggedAgentProfile) =>
      window.TurniShared.isBaristaProfile(profile);
    const isHibaProfile = (profile = loggedAgentProfile) =>
      window.TurniShared.isHibaProfile(profile);
    const isOfficeProfile = (profile = loggedAgentProfile) =>
      window.TurniShared.isOfficeProfile(profile);

    function getBaristaRecords() {
      const explicit = Array.isArray(globalData?.bariste)
        ? globalData.bariste
        : (Array.isArray(globalData?.barista) ? globalData.barista : []);
      const records = explicit.filter(record => record?.attiva !== false);
      const seen = new Set(explicit.map(record => [
        normalizeOdsAgentName(record.barista || record.agente || record.nome),
        String(record.data || "").slice(0, 10),
        String(record.corsa || "").trim().toUpperCase()
      ].join("|")));

      (globalData?.residenze?.BARISTE || []).forEach(agent => {
        settimaneInfo.forEach(week => {
          const shifts = agent.turni_settimanali?.[week.key] || [];
          (week.dateIso || []).forEach((iso, index) => {
            const shift = ottieniTurnoPulito(shifts[index] || "");
            if (!shift) return;
            const key = [normalizeOdsAgentName(agent.agente), iso, shift].join("|");
            if (seen.has(key)) return;
            seen.add(key);
            records.push({
              attiva: true,
              data: iso,
              corsa: shift,
              id: agent.id || "",
              barista: agent.agente,
              note: ""
            });
          });
        });
      });
      return records;
    }

    function getAgentShiftOnDate(agent, iso) {
      const week = settimaneInfo.find(item => Array.isArray(item.dateIso) && item.dateIso.includes(iso));
      if (!week) return "rip";
      const dayIndex = week.dateIso.indexOf(iso);
      const scheduled = (agent?.turni_settimanali?.[week.key] || [])[dayIndex] || "rip";
      // Giorno "A <residenza>" (cambio di residenza pianificato, non ancora
      // effettivo): un'eventuale variazione/correzione manuale su quel giorno
      // riguarda l'altra residenza e non deve far sparire l'etichetta qui.
      if (scheduled !== BARISTA_PRIVATE_SHIFT && isElsewhereShift(scheduled)) return scheduled;
      const ods = agent?.variazioni_ods?.[iso]?.turno_nuovo;
      const manual = diariaShiftOverrides.get(`${String(agent?.id || "")}|${iso}`);
      const isLoggedHibaRow = isHibaProfile() &&
        normalizeOdsAgentName(agent?.agente) === normalizeOdsAgentName(loggedAgentProfile?.name);
      const hibaRecord = isLoggedHibaRow ? getBaristaRecords().find(record => {
        const name = normalizeOdsAgentName(record.barista || record.agente || record.nome);
        const active = record.attiva !== false && !/^(no|false|0)$/i.test(String(record.attiva || ""));
        return active && name === normalizeOdsAgentName(loggedAgentProfile?.name) &&
          String(record.data || "").slice(0, 10) === iso && String(record.corsa || "").trim();
      }) : null;
      return manual?.shift || hibaRecord?.corsa || ods || scheduled;
    }

    async function loadDiariaShiftOverrides({ refresh = true } = {}) {
      if (!window.NaviAdminFirebase?.loadAllDiaria) return false;
      try {
        await NaviAdminFirebase.ready;
        const records = await NaviAdminFirebase.loadAllDiaria();
        const next = new Map();
        records.forEach(record => (record.entries || []).forEach(entry => {
          if (!entry?.date || !entry?.shift || entry.manualOverride !== true || entry.manualModified !== true) return;
          next.set(`${String(record.agentId)}|${String(entry.date).slice(0, 10)}`, {
            shift:String(entry.shift),
            from:String(entry.manualFrom || ""),
            updatedAt:String(record.updatedAt || "")
          });
        }));
        diariaShiftOverrides = next;
        if (globalData && refresh) {
          renderTable();
          if (selectedCol !== null) {
            const cal = dateCalendario.find(item => item.col === selectedCol);
            if (cal) selectDay(cal.col, cal.labelEstesa, selectedShiftValue, selectedCrewAgent);
          }
          renderCoverageTable();
        }
        return true;
      } catch (error) {
        console.warn("Modifiche NaviDiaria non disponibili in Turni", error);
        return false;
      }
    }

    function canEditCrewDay(agent) {
      return String(agent?.id || "") === String(loggedAgentProfile?.id || "");
    }

    // La giornata si modifica solo in NaviDiaria: un solo editor e un solo
    // salvataggio (prima NaviTurni aveva un popup con logica e archivio propri).
    function openCrewDayEditor(agentId, date) {
      if (String(agentId || "") !== String(loggedAgentProfile?.id || "")) return;
      const dateIso = String(date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return;
      location.href = `navidiaria.html?editDate=${encodeURIComponent(dateIso)}`;
    }

    function getLoggedBaristaSchedule() {
      const baristas = globalData?.residenze?.BARISTE || [];
      return baristas.find(agent =>
        String(agent.id || "") === String(loggedAgentProfile?.id || "") ||
        normalizeOdsAgentName(agent.agente) === normalizeOdsAgentName(loggedAgentProfile?.name)
      ) || null;
    }

    function restrictBaristaInterface() {
      if (!isBaristaProfile()) return;
      document.body.classList.add("barista-restricted");

      const sidebar = document.getElementById("turni-sidebar");
      sidebar?.querySelectorAll("nav a").forEach(link => {
        link.hidden = !String(link.getAttribute("href") || "").startsWith("#turni-operativi");
      });
      sidebar?.querySelectorAll("nav .sidebar-menu-label").forEach(label => { label.hidden = true; });
      const filterBlock = document.getElementById("shift-filter-container");
      if (filterBlock) filterBlock.hidden = true;
      const pastButton = document.getElementById("togglePastBtn");
      if (pastButton) {
        pastButton.hidden = false;
        pastButton.style.display = "flex";
      }
      showPastColumns = false;
      automaticPastFromTime = null;
      const brand = sidebar?.querySelector(".shared-sidebar-brand, .turni-sidebar-brand");
      if (brand) brand.setAttribute("href", "#turni-operativi");
      const odsStatus = document.getElementById("odsVariationStatus");
      if (odsStatus) odsStatus.hidden = true;

      const residenceStat = document.getElementById("stat-residence")?.closest(".stat-card");
      if (residenceStat) residenceStat.hidden = true;
      const coverage = document.getElementById("coverage-section");
      if (coverage) coverage.hidden = true;
      const upload = document.getElementById("upload-container");
      if (upload) upload.hidden = true;
    }

    function applyBaristaAccessScope() {
      if (!isBaristaProfile() || baristaAccessApplied || !globalData) return false;

      const originalResidences = globalData.residenze || {};
      const personalRow = getLoggedBaristaSchedule();
      if (!personalRow) return false;

      const assignments = [];
      dateCalendario.forEach(cal => {
        const shift = ottieniTurnoPulito(getAgentShiftOnDate(personalRow, cal.iso));
        if (shift) assignments.push({ iso:cal.iso, shift });
      });

      // Compatibilità con il calendario BARISTA quando il relativo parser sarà popolato.
      const profileName = normalizeOdsAgentName(loggedAgentProfile.name);
      getBaristaRecords().forEach(record => {
        const name = normalizeOdsAgentName(record.barista || record.agente || record.nome);
        const iso = String(record.data || "").slice(0, 10);
        const shift = ottieniTurnoPulito(record.corsa);
        const active = record.attiva !== false && !/^(no|false|0)$/i.test(String(record.attiva || ""));
        if (!active || name !== profileName || !/^\d{4}-\d{2}-\d{2}$/.test(iso) || !shift) return;
        if (!assignments.some(item => item.iso === iso && isSameCrewShift(item.shift, shift))) assignments.push({ iso, shift });
      });
      assignments.sort((a, b) => a.iso.localeCompare(b.iso));

      const assignmentByDate = new Map(assignments.map(item => [item.iso, item.shift]));

      // Applica le assegnazioni reali alla riga personale della barista,
      // in modo che ogni giorno riporti la corsa effettiva e non solo RIP.
      settimaneInfo.forEach(week => {
        personalRow.turni_settimanali[week.key] = (week.dateIso || []).map(iso =>
          assignmentByDate.get(iso) || personalRow.turni_settimanali?.[week.key]?.[week.dateIso.indexOf(iso)] || "rip"
        );
      });

      const colleagues = new Map();
      Object.entries(originalResidences).forEach(([residence, agents]) => {
        if (residence === "BARISTE") return;
        (agents || []).forEach(agent => {
          const workedTogether = assignments.some(item =>
            isSameCrewShift(getAgentShiftOnDate(agent, item.iso), item.shift)
          );
          if (!workedTogether) return;
          const key = String(agent.id || "") || `${residence}|${normalizeOdsAgentName(agent.agente)}`;
          if (!colleagues.has(key)) {
            const maskedWeeks = {};
            settimaneInfo.forEach(week => {
              const originalShifts = agent.turni_settimanali?.[week.key] || [];
              maskedWeeks[week.key] = (week.dateIso || []).map((iso, index) => {
                const baristaShift = assignmentByDate.get(iso);
                const agentShift = originalShifts[index] || "rip";
                return baristaShift && isSameCrewShift(agentShift, baristaShift)
                  ? agentShift
                  : BARISTA_PRIVATE_SHIFT;
              });
            });
            colleagues.set(key, {
              ...agent,
              turni_settimanali:maskedWeeks,
              variazioni_ods:{},
              residenzaOrigine:residence
            });
          }
        });
      });

      globalData = {
        ...globalData,
        residenze: { BARISTE:[personalRow, ...colleagues.values()] }
      };
      baristaAccessApplied = true;
      pinnedAgentIdx = null;
      activeShiftFilter = null;
      buildTableHeader();
      renderResidenceButtons();
      restrictBaristaInterface();

      return true;
    }

    function updateLoginUserPanel() {
      const panel = document.getElementById("login-user-panel");
      const label = document.getElementById("login-user-name");
      const changeButton = document.getElementById("login-change-button");
      const diariaNavLink = document.getElementById("diariaNavLink");
      const archiveNavLink = document.getElementById("archiveNavLink");
      const welcome = document.getElementById("turniWelcome");
      if (!panel || !label) return;
      panel.classList.add("visible");
      label.textContent = loggedAgentProfile ? loggedAgentProfile.name.toLocaleUpperCase("it") : "SENZA ACCESSO";
      label.disabled = !loggedAgentProfile;
      label.title = loggedAgentProfile ? "Rimetti l'agente in cima" : "Accesso non effettuato";
      if (changeButton) changeButton.style.display = loggedAgentProfile ? "inline-flex" : "none";
      if (diariaNavLink) {
        const canUseDiaria = Boolean(String(loggedAgentProfile?.id || "").trim());
        diariaNavLink.hidden = !canUseDiaria;
      }
      if (archiveNavLink) archiveNavLink.hidden = isBaristaProfile();
      const mobileChangeLink = document.getElementById("mobile-change-link");
      if (mobileChangeLink) mobileChangeLink.hidden = isOfficeProfile();
      restrictBaristaInterface();
      if (welcome) {
        const agentData = Object.values(globalData?.residenze || {}).flat().find(agent => String(agent.id || "") === String(loggedAgentProfile?.id || ""));
        const grade = String(agentData?.qualifica || loggedAgentProfile?.qualifica || "Agente").trim().toLocaleLowerCase("it").replace(/(^|\s)\S/g, letter => letter.toLocaleUpperCase("it"));
        welcome.textContent = "NaviSuite Turni";
      }
    }

    function showLoginModal() {
      const overlay = document.getElementById("login-overlay");
      const surname = document.getElementById("login-surname");
      const choice = document.getElementById("login-agent-choice");
      const choiceLabel = document.getElementById("login-choice-label");
      document.getElementById("login-message").textContent = "";
      surname.value = "";
      choice.innerHTML = "";
      choice.classList.remove("visible");
      choiceLabel.style.display = "none";
      overlay.classList.add("open");
      setTimeout(() => surname.focus(), 30);
    }

    function populateLoginSurnameOptions() {
      const datalist = document.getElementById("login-surname-options");
      if (!datalist || !globalData?.residenze) return;
      const surnames = new Map();
      const baristaSurnameKeys = new Set();
      Object.values(globalData.residenze).flat().forEach(agent => {
        const surname = String(agent.agente || "").trim().split(/\s+/)[0].replace(/[.,]+$/g, "");
        const key = normalizeOdsAgentName(surname);
        if (key && !surnames.has(key)) surnames.set(key, surname.toUpperCase());
      });
      getBaristaRecords().forEach(record => {
        const name = String(record.barista || record.agente || record.nome || "").trim();
        const surname = name.split(/\s+/)[0].replace(/[.,]+$/g, "");
        const key = normalizeOdsAgentName(surname);
        if (key && !surnames.has(key)) {
          surnames.set(key, surname.toUpperCase());
          baristaSurnameKeys.add(key);
        }
      });
      datalist.innerHTML = [...surnames.entries()]
        .sort(([keyA, nameA], [keyB, nameB]) =>
          Number(baristaSurnameKeys.has(keyA)) - Number(baristaSurnameKeys.has(keyB)) || nameA.localeCompare(nameB, "it")
        )
        .map(([, surname]) => `<option value="${escapeAttribute(surname)}"></option>`)
        .join("");
    }

    function continueWithoutLogin() {
      location.replace("index.html");
    }

    function getLoginMatches(surname) {
      const query = normalizeOdsAgentName(surname);
      if (!query || !globalData?.residenze) return [];
      const matches = [];
      Object.entries(globalData.residenze).forEach(([residence, agents]) => {
        (agents || []).forEach(agent => {
          const normalizedName = normalizeOdsAgentName(agent.agente);
          const firstNamePart = normalizedName.split(" ")[0];
          if (normalizedName === query || normalizedName.startsWith(query + " ") || firstNamePart === query) {
            matches.push({
              id: String(agent.id || ""),
              name: agent.agente,
              residence,
              qualifica: agent.qualifica || "",
              role: String(agent.qualifica || "").toLowerCase() === "barista" ? "barista" : ""
            });
          }
        });
      });
      const seenBaristas = new Set();
      getBaristaRecords().forEach(record => {
        const name = String(record.barista || record.agente || record.nome || "").trim();
        const normalizedName = normalizeOdsAgentName(name);
        const firstNamePart = normalizedName.split(" ")[0];
        const id = getBaristaProfileId(record, name);
        if (!name || seenBaristas.has(id)) return;
        if (normalizedName === query || normalizedName.startsWith(query + " ") || firstNamePart === query) {
          seenBaristas.add(id);
          matches.push({ id, name, residence:"BARISTE", qualifica:"barista", role:"barista" });
        }
      });
      return matches;
    }

    function handleAgentLogin(event) {
      event.preventDefault();
      const message = document.getElementById("login-message");
      const choice = document.getElementById("login-agent-choice");
      const choiceLabel = document.getElementById("login-choice-label");

      const matches = getLoginMatches(document.getElementById("login-surname").value);
      if (!matches.length) {
        message.textContent = "Agente non trovato. Controlla il cognome.";
        return;
      }

      if (matches.length > 1 && !choice.classList.contains("visible")) {
        choice.innerHTML = matches.map((item, index) =>
          `<option value="${index}">${escapeAttribute(item.name)} — ${escapeAttribute(item.residence)}</option>`
        ).join("");
        choice.dataset.matches = JSON.stringify(matches);
        choice.classList.add("visible");
        choiceLabel.style.display = "block";
        message.textContent = "Sono presenti più corrispondenze: scegli il nominativo corretto.";
        return;
      }

      let selected = matches[0];
      if (choice.classList.contains("visible")) {
        try {
          const storedMatches = JSON.parse(choice.dataset.matches || "[]");
          selected = storedMatches[Number(choice.value)] || selected;
        } catch (e) {
          selected = matches[0];
        }
      }

      loggedAgentProfile = selected;
      localStorage.setItem(AGENT_LOGIN_STORAGE_KEY, JSON.stringify(selected));
      document.getElementById("login-overlay").classList.remove("open");
      updateLoginUserPanel();
      applyLoggedAgentProfile();
    }

    // Riga mia/fissata in alto: turni completi anche per i giorni svolti in
    // un'altra residenza (cambio di residenza con decorrenza).
    function completeAgent(agent) {
      if (!agent?.turni_settimanali_completi) return agent;
      return {
        ...agent,
        turni_settimanali: agent.turni_settimanali_completi,
        variazioni_ods: { ...(agent.variazioni_ods || {}), ...(agent.variazioni_ods_completi || {}) }
      };
    }

    function getLoggedAgentLocation() {
      if (!loggedAgentProfile) return null;
      // Gli agenti d'ufficio non hanno un turno: nessuna riga personale.
      if (isOfficeProfile()) return null;
      const residence = loggedAgentProfile.residence;
      const agents = globalData?.residenze?.[residence] || [];
      const index = agents.findIndex(agent => {
        const sameId = loggedAgentProfile.id && String(agent.id || "") === loggedAgentProfile.id;
        return sameId || normalizeOdsAgentName(agent.agente) === normalizeOdsAgentName(loggedAgentProfile.name);
      });
      return index >= 0 ? { residence, index, agent: completeAgent(agents[index]) } : null;
    }

    function findLoggedAgentIndex(residence = currentResidence) {
      const location = getLoggedAgentLocation();
      return location && location.residence === residence ? location.index : -1;
    }

    function showDefaultResidence() {
      selectResidence(getDefaultResidence());
      pinnedAgentIdx = null;
      updateLoginUserPanel();
      return true;
    }

    // Agente con cambio di residenza a data futura/passata: la sessione salvata
    // al login puo' avere la residenza vecchia, si allinea a quella in vigore oggi.
    function reconcileLoggedResidence() {
      if (!loggedAgentProfile?.id || !globalData?.residenze) return;
      const today = new Date().toLocaleDateString('sv-SE');
      for (const list of Object.values(globalData.residenze)) {
        const agent = (list || []).find(item => String(item.id || '') === String(loggedAgentProfile.id));
        if (agent?.residenzaDal && agent.residenzaNuova && agent.residenzaPrecedente) {
          loggedAgentProfile.residence = today >= agent.residenzaDal ? agent.residenzaNuova : agent.residenzaPrecedente;
          return;
        }
      }
    }

    function applyLoggedAgentProfile() {
      reconcileLoggedResidence();
      if (isBaristaProfile()) {
        if (applyBaristaAccessScope()) {
          selectResidence("BARISTE");
          pinnedAgentIdx = null;
          updateLoginUserPanel();
          return true;
        }
        return showDefaultResidence();
      }
      if (isOfficeProfile()) return showDefaultResidence();
      if (!loggedAgentProfile || !globalData?.residenze?.[loggedAgentProfile.residence]) return showDefaultResidence();
      selectResidence(loggedAgentProfile.residence);
      const index = findLoggedAgentIndex();
      if (index < 0) return showDefaultResidence();
      pinnedAgentIdx = null;
      renderTable();
      return true;
    }

    function repinLoggedAgent() {
      if (!loggedAgentProfile || !globalData) return;
      if (isBaristaProfile()) return;
      if (isOfficeProfile()) { showDefaultResidence(); return; }
      if (currentResidence !== loggedAgentProfile.residence) {
        selectResidence(loggedAgentProfile.residence);
      }
      const index = findLoggedAgentIndex();
      if (index < 0) { showDefaultResidence(); return; }
      pinnedAgentIdx = index;
      renderTable();
    }

    function clearPinnedAgentSelection() {
      pinnedAgentIdx = null;
      selectedCrewAgent = null;
      document.querySelectorAll("#tbody tr.pinned-row").forEach(row => row.classList.remove("pinned-row"));
    }

    function logoutAgent() {
      localStorage.removeItem(AGENT_LOGIN_STORAGE_KEY);
      localStorage.removeItem("navidiaria.activeAgent");
      loggedAgentProfile = null;
      pinnedAgentIdx = null;
      location.href = "index.html";
    }

    const turniMappaResidenze = {
      "desenzano": ["D1", "D2", "D3", "D4", "BIS", "TERRA"],
      "maderno": ["T1", "T2", "M1", "TERRA"],
      "riva": ["R1", "R2", "R3", "R4", "CAR", "TERRA"],
      "peschiera": ["P1", "P2", "P3", "CAP", "SR1", "SR2", "TERRA"]
    };

    const serviziTerraPerResidenza = {
      DESENZANO: ["AGB", "DT", "POND"],
      MADERNO: ["AGM", "AGT", "AGT1", "AGT2", "PONM"]
    };
    const ordineServiziTerra = { DT: 1, AGB: 2, POND: 3, AGM: 1, AGT: 2, AGT1: 3, AGT2: 4, PONM: 5 };
    const etichetteServiziTerra = { AGB: "AgB", DT: "DT", POND: "PonD", AGM: "AgM", AGT: "AgT", AGT1: "AgT1", AGT2: "AgT2", PONM: "PonM" };

    function getCrewShiftKey(shiftValue) {
      const cleanShift = ottieniTurnoPulito(shiftValue).toUpperCase();
      if (cleanShift === "TERRA" || /^LAV\.?$/.test(cleanShift)) {
        const residenceKey = String(currentResidence || "").trim().toUpperCase();
        return serviziTerraPerResidenza[residenceKey] ? `TERRA_${residenceKey}` : "TERRA";
      }
      const groundResidence = Object.entries(serviziTerraPerResidenza)
        .find(([, shifts]) => shifts.includes(cleanShift))?.[0];
      return groundResidence ? `TERRA_${groundResidence}` : cleanShift;
    }

    function isGroundCrewShiftKey(shiftValue) {
      return getCrewShiftKey(shiftValue).startsWith("TERRA_");
    }

    function getCrewRequirementKey(shiftValue) {
      return isGroundCrewShiftKey(shiftValue) ? "TERRA" : getCrewShiftKey(shiftValue);
    }

    function isSameCrewShift(firstShift, secondShift) {
      const firstKey = getCrewShiftKey(firstShift);
      return Boolean(firstKey) && firstKey === getCrewShiftKey(secondShift);
    }

    function getShiftResidence(shiftValue) {
      const rawShift = ottieniTurnoPulito(shiftValue).toUpperCase();
      const groundResidence = Object.entries(serviziTerraPerResidenza)
        .find(([, shifts]) => shifts.includes(rawShift))?.[0];
      if (groundResidence) {
        return Object.keys(globalData?.residenze || {}).find(residence =>
          residence.toUpperCase().trim() === groundResidence
        ) || groundResidence;
      }
      if (rawShift === "TERRA" || /^LAV\.?$/.test(rawShift)) return currentResidence;
      const cleanShift = getCrewShiftKey(rawShift);
      const match = Object.entries(turniMappaResidenze).find(([, shifts]) =>
        shifts.some(shift => getCrewShiftKey(shift) === cleanShift)
      );
      if (!match) return "";
      return Object.keys(globalData?.residenze || {}).find(residence =>
        residence.toLowerCase().trim() === match[0]
      ) || match[0].toUpperCase();
    }

    const defaultCrewRequirements = {
      DESENZANO: { D1: 4, D2: 5, D3: 5, D4: 3, BIS: 3, TERRA: 3 },
      MADERNO: { T1: 5, T2: 5, M1: 3, TERRA: 3 },
      RIVA: { R1: 4, R2: 5, R3: 5, R4: 4, CAR: 3 },
      PESCHIERA: { P1: 5, P2: 5, P3: 4, CAP: 3, SR1: 4 }
    };

    const dateCalendario = [];
    const settimaneInfo = [];
    let weekStatusMap = new Map();

    const nomiGiorni = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
    const nomiGiorniCompleti = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
    const mesiNomi = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre",
      "novembre", "dicembre"
    ];

    function normalizzaDataISO(value) {
      return String(value || "").trim().slice(0, 10);
    }

    function getMondayISO(dateValue) {
      const date = new Date(`${normalizzaDataISO(dateValue)}T12:00:00`);
      const day = date.getDay();
      const distance = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + distance);
      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
      ].join("-");
    }

    const gradeInfo = {
      "grado-capitano": { label: "Capitano", color: "#facc15" },
      "grado-capo": { label: "Capo Timoniere", color: "#fb923c" },
      "grado-timoniere": { label: "Timoniere", color: "#22c55e" },
      "grado-aiuto": { label: "Aiuto Motorista", color: "#3b82f6" },
      "grado-motorista": { label: "Motorista", color: "#a855f7" },
      "grado-marinaio": { label: "Marinaio", color: "#9ca3af" },
      "grado-operaio": { label: "Operaio", color: "#14b8a6" }
      ,"grado-barista": { label: "Barista", color: "#f472b6" }
      ,"grado-ufficio-movimento": { label: "Movimento", color: "#facc15" }
      ,"grado-ufficio-amministrazione": { label: "Amministrazione", color: "#38bdf8" }
      ,"grado-ufficio-personale": { label: "Personale", color: "#fb923c" }
      ,"grado-ufficio-controllo": { label: "Controllo", color: "#34d399" }
      ,"grado-ufficio-direzione": { label: "Direzione", color: "#f472b6" }
    };

    const shiftBorderColor = {
      "c-d1": "#3b6bcc",
      "c-d2": "#2d9e6b",
      "c-d3": "#e07b3a",
      "c-d4": "#c45cba",
      "c-dt": "#e6d44a",
      "c-bis": "#5ec4d4",
      "c-pond": "#f08080",
      "c-rip": "#6b7280",
      "c-cong": "#a78bfa",
      "c-agb": "#60a5fa",
      "c-fp": "#94a3b8",
      "c-rf": "#84cc16",
      "c-other": "#94a3b8"
    };

    const shiftDurations = {
      D1: "13 ore", D2: "11 ore 25 min", D3: "13 ore 20 min", D4: "13 ore 15 min",
      T1: "13 ore 35 min", T2: "12 ore 29 min", M1: "13 ore 30 min",
      R1: "13 ore 15 min", R2: "13 ore 15 min", R3: "12 ore 20 min", R4: "12 ore 40 min",
      CAR: "12 ore 10 min", CAR1: "12 ore 10 min",
      P1: "12 ore 45 min", P2: "13 ore 5 min", P3: "12 ore 55 min",
      CAP: "12 ore 55 min", CAP1: "12 ore 55 min", SR1: "12 ore 15 min",
      BIS: "12 ore 15 min", AGB: "10 ore 25 min", POND: "9 ore 25 min",
      DT: "9 ore 25 min", PT: "9 ore 30 min", AGM: "9 ore 45 min",
      AGT: "11 ore 10 min", PONM: "10 ore 25 min"
    };

    function formatShiftDurationText(hours) {
      const totalMinutes = Math.round((Number(hours) || 0) * 60);
      const h = Math.floor(totalMinutes / 60), m = totalMinutes % 60;
      return m ? `${h} ore ${m} min` : `${h} ore`;
    }
    function getShiftDuration(shiftCode, calInfo) {
      const code = (shiftCode || "").toUpperCase().trim();
      if (code === "DT" && calInfo && calInfo.giornoSett === "Sab") return "9 ore 55 min";
      // Ore con decorrenza (es. turno 05/10/2026): stessa tabella di NaviDiaria,
      // cosi' non resta una copia ferma ai valori vecchi.
      const wanted = code === "CAR" ? "CAR1" : code;
      const shared = window.NaviShiftCompetence?.shiftsFor(calInfo?.iso)?.find(s => String(s.code).toUpperCase() === wanted);
      if (shared) return formatShiftDurationText(shared.hours);
      return shiftDurations[code] || "";
    }

    function getLatestOdsCoverage() {
      const variations = (Array.isArray(globalData?.variazioni_ods) ? globalData.variazioni_ods : [])
        .filter(item => item && item.attiva !== false && /^\d{4}-\d{2}-\d{2}$/.test(String(item.data || "")));
      if (!variations.length) return null;
      const odsNumber = item => Number.parseInt(String(item.ods || "").match(/\d+/)?.[0] || "0", 10);
      const latestNumber = Math.max(...variations.map(odsNumber));
      if (!latestNumber) return null;
      const latestDates = variations
        .filter(item => odsNumber(item) === latestNumber)
        .map(item => String(item.data))
        .sort();
      if (!latestDates.length) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
        number: latestNumber,
        from: formatDateISOClient(today),
        until: latestDates[latestDates.length - 1]
      };
    }

    function inizializzaCalendario() {
      dateCalendario.length = 0;
      const odsCoverage = getLatestOdsCoverage();
      let colCounter = 3;
      settimaneInfo.forEach((sett, sIdx) => {
        const initialWeekDate = Array.isArray(sett.dateIso) && sett.dateIso.length
          ? normalizzaDataISO(sett.dateIso[0])
          : "";
        const initialWeekStartIso = initialWeekDate ? getMondayISO(initialWeekDate) : "";
        const initialWeekState = weekStatusMap.get(initialWeekStartIso) || "ufficiale";
        if (initialWeekState === "nascosta") return;

        const baseDate = new Date(sett.year || 2026, sett.month, sett.startDay);
        const count = sett.count || 7;
        for (let g = 0; g < count; g++) {
          const d = new Date(baseDate);
          d.setDate(baseDate.getDate() + g);
          const iso = formatDateISOClient(d);
          const weekStartIso = getMondayISO(iso);
          const storedWeekState = weekStatusMap.get(weekStartIso) || "ufficiale";
          const importedState = String(sett.dateStates?.[g] || "ufficiale").toLowerCase();
          const weekState = storedWeekState === "nascosta"
            ? "nascosta"
            : (window.NaviDraftPeriod?.contains(iso) || importedState === "bozza" ? "bozza" : "ufficiale");
          dateCalendario.push({
            col: colCounter,
            weekKey: sett.key,
            weekIdx: sIdx,
            dayNum: d.getDate(),
            giornoSett: nomiGiorni[(d.getDay() + 6) % 7],
            isDomenica: d.getDay() === 0,
            labelEstesa: `${nomiGiorniCompleti[(d.getDay() + 6) % 7]} ${d.getDate()} ${mesiNomi[d.getMonth()]}`,
            realObj: d,
            iso,
            weekStatus: weekState,
            isBozza: weekState === "bozza",
            odsCoverageNumber: odsCoverage && iso >= odsCoverage.from && iso <= odsCoverage.until
              ? odsCoverage.number
              : null,
            odsCoverageUntil: odsCoverage?.until || ""
          });
          colCounter++;
        }
      });
    }

    function getGradeClass(badge, agentName = "", qualifica = "") {
      const q = String(qualifica || "").trim().toLowerCase();
      const map = {
        "capitano": "grado-capitano",
        "comandante": "grado-capitano",
        "capo timoniere": "grado-capo",
        "capotimoniere": "grado-capo",
        "timoniere": "grado-timoniere",
        "motorista": "grado-motorista",
        "aiuto motorista": "grado-aiuto",
        "aiutomotorista": "grado-aiuto",
        "marinaio": "grado-marinaio",
        "operaio": "grado-operaio"
        ,"barista": "grado-barista"
        ,"movimento": "grado-ufficio-movimento"
        ,"amministrazione": "grado-ufficio-amministrazione"
        ,"personale": "grado-ufficio-personale"
        ,"controllo": "grado-ufficio-controllo"
        ,"direzione": "grado-ufficio-direzione"
      };
      return map[q] || "grado-marinaio";
    }

    // Ordine delle sezioni di grado: capitano e capo timoniere sono
    // considerati pari grado (un capitano può coprire il turno di un
    // capotimoniere e viceversa).
    const gradeRankMap = {
      "grado-capitano": 1,
      "grado-capo": 1,
      "grado-motorista": 2,
      "grado-timoniere": 3,
      "grado-aiuto": 4,
      "grado-marinaio": 5,
      "grado-operaio": 6,
      "grado-barista": 7,
      "grado-ufficio-movimento": 8,
      "grado-ufficio-amministrazione": 9,
      "grado-ufficio-personale": 10,
      "grado-ufficio-controllo": 11,
      "grado-ufficio-direzione": 12
    };
    const crewGradeRank = agent => gradeRankMap[getGradeClass(agent.id, agent.agente, agent.qualifica)] || 99;

    function isRiposoShift(v) { const txt=String(v||"").toUpperCase().trim().replace(/\*/g,"").replace(/--/g,""); return ["","RIP","RIP.","RIPOSO","----"].includes(txt); }
    function ottieniTurnoPulito(v) {
      if (isRiposoShift(v)) return "";
      let txt = String(v).toUpperCase().trim().replace(/\*/g, "").replace(/--/g, "");

      let match = txt.match(/(?:^C)?([DRMP]\d|BIS|PO(?:ND?|D)|PONM|AGB|AGM|AGT[12]?|T1|M1|DT|T2|CAR|CAP|SR[12])(?:C|$)/i);
      if (match && match[1]) {
        // "CPODC" e "CPONC" sono forme abbreviate di "CPONDC" (pontile Desenzano).
        return match[1].toUpperCase().replace(/^PO[ND]$/, "POND");
      }
      return txt;
    }

    function classify(v) {
      if (!v || v === "") return null;
      let uPulito = ottieniTurnoPulito(v);
      if (uPulito === "") return "c-rip";

      if (/^D1/.test(uPulito) || /^R1/.test(uPulito) || /^P1/.test(uPulito)) return "c-d1";
      if (/^D2/.test(uPulito) || /^R2/.test(uPulito) || /^P2/.test(uPulito)) return "c-d2";
      if (/^D3/.test(uPulito) || /^R3/.test(uPulito) || /^P3/.test(uPulito)) return "c-d3";
      if (/^D4/.test(uPulito) || /^R4/.test(uPulito) || /^P4/.test(uPulito)) return "c-d4";
      if (/^T1/.test(uPulito)) return "c-d1";
      if (/^T2/.test(uPulito)) return "c-d2";
      if (/^M1/.test(uPulito)) return "c-d3";
      if (/^DT/.test(uPulito)) return "c-dt";
      if (/^BIS/.test(uPulito)) return "c-bis";
      if (/^POND/.test(uPulito)) return "c-pond";
      if (/^AGB/.test(uPulito)) return "c-agb";
      if (uPulito.startsWith("CONG") || uPulito === "CON;") return "c-cong";
      if (uPulito === "FP" || uPulito === "F.P." || uPulito === "CORSO") return "c-fp";
      if (uPulito === "RF") return "c-rf";
      return "c-other";
    }

    function normalizeShiftDisplay(v) {
      const stripped = String(v || "").trim().replace(/[;,.]+$/, "");
      return /^(?:LAV|TERRA)$/i.test(stripped) ? "LAV" : v;
    }

    function pill(v) {
      if (String(v || "") === BARISTA_PRIVATE_SHIFT) {
        return '<span class="cell-pill c-rip private-shift" aria-label="Turno non condiviso"></span>';
      }
      // Anche "Riposo"/"RIPOSO" (es. giornata modificata a mano dalla diaria)
      // e' un riposo: pillola "rip", non il testo intero che non ci sta.
      if (!v || isRiposoShift(v)) {
        return '<span class="cell-pill c-rip">rip</span>';
      }
      const cls = classify(v);
      if (!cls) return `<span style="color:#3a3f50">${normalizeShiftDisplay(v)}</span>`;
      return `<span class="cell-pill ${cls}">${normalizeShiftDisplay(v)}</span>`;
    }

    function isTodayDate(dateObj) {
      const a = new Date(dateObj);
      const b = new Date();
      a.setHours(0, 0, 0, 0);
      b.setHours(0, 0, 0, 0);
      return a.getTime() === b.getTime();
    }

    function formatTodayMenuLabel() {
      return new Intl.DateTimeFormat("it-IT", {
        weekday:"short",
        day:"2-digit",
        month:"short"
      }).format(new Date()).replace(/\./g, "").toLocaleUpperCase("it");
    }

    function buildMonthHeader() {
      const visibleDates = dateCalendario.filter(cal => {
        const th = document.querySelector(`.date-header th[data-col="${cal.col}"]`);
        return !th || th.style.display !== "none";
      });
      const groups = [];
      visibleDates.forEach(cal => {
        const key = `${cal.realObj.getFullYear()}-${cal.realObj.getMonth()}`;
        const last = groups[groups.length - 1];
        if (last && last.key === key) last.count++;
        else groups.push({ key, count:1, label:`${mesiNomi[cal.realObj.getMonth()]} ${cal.realObj.getFullYear()}` });
      });
      return `<tr class="month-header"><th class="turni-header-actions"><a href="oggi.html" aria-label="Apri Oggi">☀ Oggi</a><button type="button" id="turni-header-menu" aria-label="Apri menu">☰</button></th>${groups.map(group => `<th colspan="${group.count}" data-month="${group.key}"><span class="month-visible-label">${group.label}</span></th>`).join("")}</tr>`;
    }

    function buildTableHeader() {
      const container = document.getElementById("thead-container");
      let html = buildMonthHeader() + `<tr class="date-header"><th>${renderQuickResidenceSelector()}</th>`;
      dateCalendario.forEach(d => {
        const clsArr = [];
        clsArr.push(d.weekIdx % 2 === 0 ? "week-even" : "week-odd");
        if (d.giornoSett === "Lun") clsArr.push("week-start");
        if (d.giornoSett === "Dom") clsArr.push("week-end");
        if (d.isBozza) clsArr.push("bozza-col");
        const currentIndex = dateCalendario.indexOf(d);
        if (d.isBozza && dateCalendario[currentIndex - 1]?.isBozza !== true) {
          clsArr.push("bozza-start");
        }
        const cls = `class="${clsArr.join(" ")}"`;
        const weekDraftLabel = d.weekStatus === "bozza"
          ? '<span class="week-draft-label">BOZZA</span>'
          : '<span class="week-draft-label is-empty" aria-hidden="true">BOZZA</span>';
        const markers = `${d.odsCoverageNumber ? `<span class="date-head-ods" aria-label="Coperto dall’ODS ${d.odsCoverageNumber}" title="Coperto dall’ODS ${d.odsCoverageNumber} fino al ${d.odsCoverageUntil.split('-').reverse().join('/')}"></span>` : ''}`;
        html += `<th ${cls} data-col="${d.col}" onclick="eseguiRicercaHeader(${d.col})"><span class="date-head-day">${d.giornoSett}</span><span class="date-head-num">${d.dayNum}</span>${weekDraftLabel}${markers ? `<span class="date-head-markers">${markers}</span>` : ''}</th>`;
      });
      html += `</tr>`;
      container.innerHTML = html;
      requestAnimationFrame(updateLoggedStickyOffset);
    }
    function renderQuickResidenceSelector() { const residences=[{code:"D",name:"DESENZANO"},{code:"M",name:"MADERNO"},{code:"R",name:"RIVA"},{code:"P",name:"PESCHIERA"}].filter(item=>!!globalData?.residenze?.[item.name]); return `<div class="quick-residence-selector" aria-label="Cambia residenza">${residences.map(item=>`<button type="button" class="quick-residence-btn${currentResidence===item.name?' active':''}" data-res="${item.name}" aria-label="Visualizza ${item.name}" aria-pressed="${currentResidence===item.name}" onclick="selectResidence('${item.name}')">${item.code}</button>`).join('')}</div>`; }
    function syncQuickResidenceSelector() { document.querySelectorAll(".quick-residence-btn").forEach(button=>{const active=button.dataset.res===currentResidence;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));}); }

    function eseguiRicercaHeader(colonnaCliccata) {
      if (isEditMode) return;
      clearPinnedAgentSelection();
      placeDayPanel("main");

      const cal = dateCalendario.find(c => c.col === colonnaCliccata);
      const loggedLocation = getLoggedAgentLocation();
      const loggedAgent = loggedLocation?.agent;
      if (!cal || !loggedAgent) return;

      const dayIndex = (cal.col - 3) % 7;
      const myEffectiveShift = getAgentShiftOnDate(loggedAgent, cal.iso);

      // La data deve aprire sempre la MIA corsa effettiva di quel giorno,
      // esattamente come il clic sulla cella della mia riga.
      crewNavigationMode = "personal";
      activeShiftFilter = getCrewShiftKey(ottieniTurnoPulito(myEffectiveShift)) || null;
      generaFiltriTurnoRiferimento();
      selectDay(cal.col, cal.labelEstesa, myEffectiveShift, loggedAgent);
    }

    function selectDayForPinnedAgent(cal) {
      const agent = pinnedAgentIdx !== null ? completeAgent(currentAgentsList[pinnedAgentIdx]) : null;
      if (!agent || !cal) return;
      const rawShift = getAgentShiftOnDate(agent, cal.iso);
      const cleanShift = ottieniTurnoPulito(rawShift);

      activeShiftFilter = getCrewShiftKey(cleanShift) || null;
      generaFiltriTurnoRiferimento();
      selectDay(cal.col, cal.labelEstesa, rawShift, agent);
    }

    function selectDayForLoggedBarista(cal) {
      if (!isBaristaProfile() || !cal) return false;
      const barista = getLoggedBaristaSchedule();
      if (!barista) return false;
      const rawShift = getAgentShiftOnDate(barista, cal.iso);
      const cleanShift = ottieniTurnoPulito(rawShift);

      // La scheda della barista segue sempre la sua corsa personale del giorno.
      crewNavigationMode = "personal";
      activeShiftFilter = getCrewShiftKey(cleanShift) || null;
      generaFiltriTurnoRiferimento();
      selectDay(cal.col, cal.labelEstesa, rawShift, barista);
      return true;
    }

    function selectDayForLoggedAgent(cal) {
      if (!cal) return false;
      if (isBaristaProfile()) return selectDayForLoggedBarista(cal);
      const location = getLoggedAgentLocation();
      const agent = location?.agent;
      if (!agent) return false;
      const dayIndex = (cal.col - 3) % 7;
      const effectiveShift = getAgentShiftOnDate(agent, cal.iso);
      activeShiftFilter = getCrewShiftKey(ottieniTurnoPulito(effectiveShift)) || null;
      generaFiltriTurnoRiferimento();
      selectDay(cal.col, cal.labelEstesa, effectiveShift, agent);
      return true;
    }

    function generaFiltriTurnoRiferimento() {
      if (isEditMode) {
        document.getElementById("shift-filter-container").style.display = "none";
        const modalWrapper = document.getElementById("modal-shift-buttons");
        if (modalWrapper) modalWrapper.innerHTML = "";
        return;
      }
      const wrapper = document.getElementById("shift-buttons-wrapper");
      const modalWrapper = document.getElementById("modal-shift-buttons");
      if (wrapper) wrapper.innerHTML = "";
      if (modalWrapper) modalWrapper.innerHTML = "";

      const chiaveResidenza = currentResidence.toLowerCase().trim();
      const turniFiltrati = turniMappaResidenze[chiaveResidenza] || [];

      if (turniFiltrati.length === 0 || !currentResidence) {
        document.getElementById("shift-filter-container").style.display = "none";
        return;
      }

      document.getElementById("shift-filter-container").style.display = "flex";

      turniFiltrati.forEach(t => {
        const color = shiftBorderColor[classify(t)] || "#94a3b8";
        const isActive = getCrewShiftKey(activeShiftFilter) === getCrewShiftKey(t);
        const handleShiftClick = (fromModal = false) => {
          clearPinnedAgentSelection();
          if (getCrewShiftKey(activeShiftFilter) === getCrewShiftKey(t)) {
            activeShiftFilter = null;
          } else {
            activeShiftFilter = t;
          }
          generaFiltriTurnoRiferimento();
          renderTable();
          if (activeShiftFilter) {
            placeDayPanel("main");
            goToToday();
            setTimeout(scrollCrewPanelIntoView, 80);
          } else {
            clearSelection();
          }
          if (fromModal) {
            document.getElementById("mobile-filter-modal")?.classList.remove("open");
          }
        };

        const targets = [
          { container: wrapper, fromModal: false },
          { container: modalWrapper, fromModal: true }
        ];

        targets.forEach(({ container, fromModal }) => {
          if (!container) return;
          const btn = document.createElement("button");
          btn.className = "shift-filter-btn";
          btn.textContent = t;
          btn.style.setProperty("--btn-color", color);
          if (isActive) btn.classList.add("active");
          btn.addEventListener("click", () => handleShiftClick(fromModal));
          container.appendChild(btn);
        });
      });
    }

    function scheduleCoverageRender() {
      if (coverageRenderHandle !== null) {
        if ("cancelIdleCallback" in window) cancelIdleCallback(coverageRenderHandle);
        else clearTimeout(coverageRenderHandle);
      }
      const run = () => {
        coverageRenderHandle = null;
        renderCoverageTable();
      };
      coverageRenderHandle = "requestIdleCallback" in window
        ? requestIdleCallback(run, { timeout: 900 })
        : setTimeout(run, 120);
    }

    function renderTable() {
      const tbody = document.getElementById("tbody");
      tbody.innerHTML = "";
      trElements = [];
      crewCompletenessCache.clear();
      const fragment = document.createDocumentFragment();

      const loggedIndex = findLoggedAgentIndex();
      const loggedLocation = getLoggedAgentLocation();
      // L'agente collegato resta sempre in alto, seguito dal collega fissato
      // con doppio tap. Tutti gli altri sono ordinati per sezioni di grado
      // (vedi sotto), non più per ordine del prospetto.
      const orderedIndexes = [];
      if (loggedIndex >= 0) orderedIndexes.push(loggedIndex);
      if (pinnedAgentIdx !== null && pinnedAgentIdx !== loggedIndex && currentAgentsList[pinnedAgentIdx]) {
        orderedIndexes.push(pinnedAgentIdx);
      }
      const restIndexes = [];
      currentAgentsList.forEach((agent, index) => {
        if (index === loggedIndex || index === pinnedAgentIdx) return;
        // Chi da oggi in poi ha solo CON/RIP ha terminato il servizio: la sua
        // riga resta nei dati (ricerca, ODS, coverage) ma non compare qui.
        if (hasFinishedService(agent)) return;
        restIndexes.push(index);
      });
      // La tabella è organizzata per sezioni di grado (capitano e capo
      // timoniere pari grado). All'interno dello stesso grado l'ordine segue
      // l'anzianità del prospetto; chi ha cambiato grado finisce in fondo
      // alla propria sezione (minore anzianità), sotto i suoi pari e non
      // sotto i gradi successivi.
      const gradeClassOrder = { "grado-capitano": 0, "grado-capo": 1 };
      restIndexes.sort((indexA, indexB) => {
        const agentA = currentAgentsList[indexA];
        const agentB = currentAgentsList[indexB];
        const rankA = crewGradeRank(agentA);
        const rankB = crewGradeRank(agentB);
        if (rankA !== rankB) return rankA - rankB;
        const classA = gradeClassOrder[getGradeClass(agentA.id, agentA.agente, agentA.qualifica)] || 0;
        const classB = gradeClassOrder[getGradeClass(agentB.id, agentB.agente, agentB.qualifica)] || 0;
        if (classA !== classB) return classA - classB;
        const regradedA = agentA?.regraded ? 1 : 0;
        const regradedB = agentB?.regraded ? 1 : 0;
        if (regradedA !== regradedB) return regradedA - regradedB;
        return indexA - indexB;
      });
      orderedIndexes.push(...restIndexes);

      if (loggedLocation && loggedLocation.residence !== currentResidence) {
        const loggedRow = createRowDOM(
          loggedLocation.agent,
          loggedLocation.index,
          false,
          loggedLocation.residence,
          true
        );
        loggedRow.classList.remove("temporary-transfer-row");
        loggedRow.classList.add("cross-residence-logged-row");
        const referenceLabel = loggedRow.querySelector(".transfer-table-label");
        if (referenceLabel) referenceLabel.textContent = `La mia riga · ${loggedLocation.residence}`;
        fragment.appendChild(loggedRow);
        trElements.push(loggedRow);
      }

      orderedIndexes.forEach(ri => {
        const agenteObj = ri === pinnedAgentIdx || ri === loggedIndex ? completeAgent(currentAgentsList[ri]) : currentAgentsList[ri];
        const tr = createRowDOM(agenteObj, ri, ri === pinnedAgentIdx);
        fragment.appendChild(tr);
        trElements.push(tr);
      });
      tbody.appendChild(fragment);

      hidePastColumns();
      highlightSharedCrewDays();
      requestAnimationFrame(updateLoggedStickyOffset);
      scheduleCoverageRender();
    }

    function highlightSharedCrewDays() {
      document.querySelectorAll("#tbody tr.has-shared-crew").forEach(row => row.classList.remove("has-shared-crew"));
      document.querySelectorAll(".date-header th.pinned-agent-common-date").forEach(th => th.classList.remove("pinned-agent-common-date"));
      document.querySelectorAll("#tbody td.shared-crew-day, #tbody td.pinned-shared-crew-day, #tbody td.departed-crew-day").forEach(cell => {
        cell.classList.remove("shared-crew-day", "pinned-shared-crew-day", "departed-crew-day");
        cell.querySelector(".shared-crew-change-label")?.remove();
        if (cell.dataset.sharedCrewPreviousTitle) cell.title = cell.dataset.sharedCrewPreviousTitle;
        else cell.removeAttribute("title");
        delete cell.dataset.sharedCrewTitle;
        delete cell.dataset.sharedCrewPreviousTitle;
      });
      const loggedLocation = getLoggedAgentLocation();
      if (!loggedLocation) return;
      const loggedIndex = findLoggedAgentIndex();
      const loggedAgent = loggedLocation.agent;
      const loggedRow = document.querySelector("#tbody tr.logged-agent-row");
      const pinnedAgent = pinnedAgentIdx !== null ? completeAgent(currentAgentsList[pinnedAgentIdx]) : null;
      if (!loggedAgent || !loggedRow) return;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const markSharedCell = (row, cal, title) => {
        const cell = row?.querySelector(`td[data-col="${cal.col}"]`);
        if (!cell) return;
        row.classList.add("has-shared-crew");
        cell.classList.add("shared-crew-day");
        cell.dataset.sharedCrewPreviousTitle = cell.title || "";
        cell.dataset.sharedCrewTitle = title;
        cell.removeAttribute("title");
      };

      const markDepartedCell = (row, cal, originalShift, updatedShift, variation) => {
        const cell = row?.querySelector(`td[data-col="${cal.col}"]`);
        if (!cell) return;
        const original = getCrewShiftKey(originalShift).replace(/^TERRA_/, "TERRA ");
        const updated = getCrewShiftKey(updatedShift).replace(/^TERRA_/, "TERRA ") || "RIPOSO";
        const ods = variation?.ods ? ` · ODS ${variation.ods}` : "";
        const title = `Ha lasciato ${original} per ${updated}${ods}`;
        cell.classList.add("departed-crew-day");
        cell.dataset.sharedCrewPreviousTitle = cell.title || "";
        cell.dataset.sharedCrewTitle = title;
        const label = document.createElement("span");
        label.className = "shared-crew-change-label";
        label.textContent = `da ${original}`;
        cell.appendChild(label);
      };

      dateCalendario.forEach(cal => {
        const calendarDay = new Date(cal.realObj);
        calendarDay.setHours(0, 0, 0, 0);
        if (!Number.isFinite(calendarDay.getTime())) return;
        const dayIndex = (cal.col - 3) % 7;
        const loggedRaw = getAgentShiftOnDate(loggedAgent, cal.iso);
        const loggedShift = ottieniTurnoPulito(loggedRaw);
        if (!getShiftResidence(loggedShift)) return;

        if (pinnedAgent && pinnedAgent !== loggedAgent) {
          const pinnedRaw = getAgentShiftOnDate(pinnedAgent, cal.iso);
          const pinnedShift = ottieniTurnoPulito(pinnedRaw);
          if (getShiftResidence(pinnedShift) && isSameCrewShift(loggedShift, pinnedShift)) {
            loggedRow.querySelector(`td[data-col="${cal.col}"]`)?.classList.add("pinned-shared-crew-day");
            document.querySelector(`.date-header th[data-col="${cal.col}"]`)?.classList.add("pinned-agent-common-date");
          }
        }

        const matchingIndexes = [];
        const departedIndexes = [];
        currentAgentsList.forEach((agent, index) => {
          if (index === loggedIndex) return;
          const colleagueRaw = getAgentShiftOnDate(agent, cal.iso);
          const colleagueShift = ottieniTurnoPulito(colleagueRaw);
          if (getShiftResidence(colleagueShift) && isSameCrewShift(loggedShift, colleagueShift)) matchingIndexes.push(index);
          const variation = agent.variazioni_ods?.[cal.iso];
          if (!variation) return;
          const originalShift = ottieniTurnoPulito(variation.turno_originale);
          const updatedShift = ottieniTurnoPulito(variation.turno_nuovo);
          if (isSameCrewShift(loggedShift, originalShift) && !isSameCrewShift(loggedShift, updatedShift)) {
            departedIndexes.push({ index, originalShift, updatedShift, variation });
          }
        });
        const departedSet = new Set(departedIndexes.map(item => item.index));
        for (let index = matchingIndexes.length - 1; index >= 0; index--) {
          if (departedSet.has(matchingIndexes[index])) matchingIndexes.splice(index, 1);
        }
        if (!matchingIndexes.length && !departedIndexes.length) return;

        const label = getCrewShiftKey(loggedShift).replace(/^TERRA_/, "TERRA ");
        matchingIndexes.forEach(index => {
          const colleagueRow = trElements.find(row =>
            row.dataset.residence === currentResidence && parseInt(row.dataset.rowIndex) === index
          );
          markSharedCell(colleagueRow, cal, `Turno ${label} in comune con ${loggedAgent.agente}`);
        });
        departedIndexes.forEach(({ index, originalShift, updatedShift, variation }) => {
          const colleagueRow = trElements.find(row =>
            row.dataset.residence === currentResidence && parseInt(row.dataset.rowIndex) === index
          );
          markDepartedCell(colleagueRow, cal, originalShift, updatedShift, variation);
        });
      });
    }

    function hasCurrentOrFutureSharedCrewWithLogged(agent) {
      const loggedLocation = getLoggedAgentLocation();
      const loggedAgent = loggedLocation?.agent;
      if (!agent || !loggedAgent || agent === loggedAgent) return false;

      // Il pallino riguarda esclusivamente collaborazioni da oggi in avanti.
      // La data ISO locale evita che il fuso orario trasformi "oggi" in ieri.
      const now = new Date();
      const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const effectiveShift = (person, cal) => ottieniTurnoPulito(getAgentShiftOnDate(person, cal.iso));

      return dateCalendario.some(cal => {
        if (!cal.iso || cal.iso < todayIso) return false;
        const dayIndex = (cal.col - 3) % 7;
        const loggedShift = effectiveShift(loggedAgent, cal);
        const colleagueShift = effectiveShift(agent, cal);
        const shiftKey = getCrewShiftKey(loggedShift);

        // Riposi e servizi di terra non generano il pallino equipaggio.
        if (!getShiftResidence(loggedShift) || shiftKey.startsWith("TERRA_")) return false;
        return isSameCrewShift(loggedShift, colleagueShift);
      });
    }

    function updateLoggedStickyOffset() {
      const monthHeader = document.querySelector(".month-header");
      const dateHeader = document.querySelector(".date-header");
      // offsetHeight e' gia' un intero e corrisponde all'altezza reale della riga:
      // sommando i due valori la riga dell'agente loggato si incolla esattamente
      // sotto l'header. Con Math.ceil su ciascun getBoundingClientRect si perdeva
      // fino a ~2px (il "piccolo spazio" visibile soprattutto con lo zoom di
      // sistema di Windows a 125%).
      const monthHeight = monthHeader ? monthHeader.offsetHeight : 27;
      const dateHeight = dateHeader ? dateHeader.offsetHeight : 38;
      document.documentElement.style.setProperty("--month-header-height", monthHeight + "px");
      document.documentElement.style.setProperty("--date-header-height", dateHeight + "px");
      document.documentElement.style.setProperty("--logged-row-sticky-top", (monthHeight + dateHeight) + "px");
    }
    window.addEventListener("resize", updateLoggedStickyOffset);

    function getCrewRequirements(residence) {
      const key = String(residence || "").trim().toUpperCase();
      let requirements = { ...(defaultCrewRequirements[key] || {}) };
      try {
        const saved = JSON.parse(localStorage.getItem(`ggnl_turni_requisiti_${residence}`) || "{}");
        requirements = { ...requirements, ...saved };
      } catch (e) {
        // Mantiene i requisiti predefiniti se le preferenze locali non sono valide.
      }
      return requirements;
    }

    function getCrewDeficiencies(crew, shift, residence = currentResidence) {
      if (!shift || shift === "RIPOSO") return { required:null, incomplete:false };
      const requirements = getCrewRequirements(residence);
      const shiftKey = getCrewRequirementKey(shift);
      const requiredValue = requirements[shiftKey] ?? requirements[String(shiftKey).toUpperCase()];
      const required = requiredValue == null || requiredValue === "" ? null : parseInt(requiredValue, 10);
      if (required == null || Number.isNaN(required)) return { required:null, incomplete:false };
      const operatingCrew = crew.filter(person => !person.isBarista);
      return { required, incomplete:operatingCrew.length < required };
    }

    function getCrewBaristas(calInfo, shift) {
      const cleanShift = ottieniTurnoPulito(shift).toUpperCase();
      if (!calInfo?.iso || !["D2", "D3", "P1", "P2"].includes(cleanShift)) return [];
      const records = Array.isArray(globalData?.bariste)
        ? globalData.bariste
        : (Array.isArray(globalData?.barista) ? globalData.barista : []);
      return records.filter(item => {
        const active = item.attiva !== false && !/^(no|false|0)$/i.test(String(item.attiva || ""));
        return active && String(item.data || "").slice(0, 10) === calInfo.iso &&
          String(item.corsa || "").trim().toUpperCase() === cleanShift &&
          String(item.barista || item.agente || item.nome || "").trim();
      });
    }

    function getCrewStatusForDate(cal, shiftValue) {
      const emptyStatus = { incomplete:false, overstaffed:false, hasTransfer:false };
      if (!cal || !currentResidence) return emptyStatus;
      const cleanShift = getCrewShiftKey(shiftValue);
      const residenceKey = currentResidence.trim().toLowerCase();
      const validShifts = turniMappaResidenze[residenceKey] || [];
      if (!validShifts.some(shift => getCrewShiftKey(shift) === cleanShift)) return emptyStatus;

      const requirements = getCrewRequirements(currentResidence);
      const requirementKey = getCrewRequirementKey(cleanShift);
      const requiredValue = requirements[requirementKey];
      const required = requiredValue == null || requiredValue === "" ? null : parseInt(requiredValue, 10);
      if (required == null || Number.isNaN(required)) return emptyStatus;

      const cacheKey = `${currentResidence}|${cal.col}|${cleanShift}|${required}`;
      if (crewCompletenessCache.has(cacheKey)) return crewCompletenessCache.get(cacheKey);

      const dayIndex = (cal.col - 3) % 7;
      let count = 0;
      let hasTransfer = false;
      Object.entries(globalData.residenze || {}).forEach(([residence, agents]) => {
        (agents || []).forEach(agent => {
          // Le bariste vengono gestite separatamente e non fanno parte del
          // conteggio minimo dell'equipaggio operativo.
          if (isBaristaProfile(agent)) return;
          const rawShift = getAgentShiftOnDate(agent, cal.iso);
          if (isSameCrewShift(rawShift, cleanShift)) {
            count++;
            const rawUpper = String(rawShift).trim().toUpperCase();
            if (residence !== currentResidence || rawUpper.startsWith("C") || rawUpper.endsWith("C")) {
              hasTransfer = true;
            }
          }
        });
      });
      const status = {
        incomplete:count < required,
        overstaffed:count > required,
        hasTransfer
      };
      crewCompletenessCache.set(cacheKey, status);
      return status;
    }

    function toggleCrewMinimumPanel() {
      const panel = document.getElementById("crew-minimum-panel");
      const button = document.getElementById("crew-minimum-toggle");
      if (!panel) return;
      const isOpen = panel.classList.toggle("open");
      button?.classList.toggle("active", isOpen);
      if (isOpen) renderCrewMinimumControls();
    }

    function renderCrewMinimumControls() {
      const grid = document.getElementById("crew-minimum-grid");
      if (!grid || !currentResidence) return;
      const residenceKey = currentResidence.trim().toLowerCase();
      const shifts = getResidenceCrewShifts();
      const requirements = getCrewRequirements(currentResidence);
      grid.innerHTML = shifts.map(shift => {
        const value = requirements[shift] ?? requirements[String(shift).toUpperCase()] ?? "";
        return `<label class="crew-minimum-item"><span>${shift}</span><input class="crew-minimum-input" type="number" min="1" max="20" inputmode="numeric" value="${escapeAttribute(value)}" aria-label="Minimo equipaggio ${shift}" onchange="updateCrewMinimum('${shift}', this.value)"></label>`;
      }).join("");
    }

    function updateCrewMinimum(shift, rawValue) {
      if (!currentResidence) return;
      const storageKey = `ggnl_turni_requisiti_${currentResidence}`;
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch (e) { saved = {}; }
      const value = String(rawValue).trim();
      if (value === "") {
        delete saved[shift];
      } else {
        saved[shift] = Math.max(1, Math.min(20, parseInt(value, 10) || 1));
      }
      localStorage.setItem(storageKey, JSON.stringify(saved));
      renderTable();
      const selectedCal = dateCalendario.find(cal => cal.col === selectedCol);
      if (selectedCal) selectDay(selectedCal.col, selectedCal.labelEstesa, selectedShiftValue);
    }

    function escapeAttribute(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    const odsPdfFiles = {
      "16/2026": "O.d.S. n. 16-2026 ESTATE.pdf",
      "18/2026": "O.d.S. n. 18-2026.pdf",
      "19/2026": "O.d.S. n. 19-2026.pdf",
      "20/2026": "O.d.S. n. 20-2026.pdf",
      "21/2026": "O.d.S. n. 21-2026.pdf",
      "22/2026": "O.d.S. n. 22-2026.pdf",
      "23/2026": "O.d.S. n. 23-2026.pdf",
      "24/2026": "O.d.S. n. 24-2026.pdf",
      "25/2026": "O.d.S. n. 25-2026 firmato.pdf",
      "26/2026": "O.d.S. n. 26-2026.pdf"
    };

    function getOdsPdfHref(ods) {
      const fileName = odsPdfFiles[String(ods || "").trim()];
      if (fileName) return `ods/${encodeURIComponent(fileName)}`;
      return String(ods || "").trim() ? "documenti.html#ods-docs" : "";
    }

    function renderAgentOdsBadge(variation) {
      if (!variation) return "";
      const ods = escapeAttribute(variation.ods || "ODS");
      const original = escapeAttribute(normalizeOdsShift(variation.turno_originale).toUpperCase());
      const updated = escapeAttribute(normalizeOdsShift(variation.turno_nuovo).toUpperCase());
      const href = getOdsPdfHref(variation.ods);
      const label = `ODS ${ods} · ${original} → ${updated}`;
      const change = `${original} → ${updated}`;
      return href
        ? `<a class="agent-ods-badge" href="${href}" target="_blank" rel="noopener" title="${label}">${change}</a>`
        : `<span class="agent-ods-badge" title="${label}">${change}</span>`;
    }

    function getShipDayInfo(calInfo, shift) {
      const cleanShift = ottieniTurnoPulito(shift).toUpperCase();
      if (!calInfo?.iso || !cleanShift || !Array.isArray(globalData?.turni_navi)) return null;
      const isUsableShip = item => {
        const ship = String(item?.nave || '').trim();
        // Una riga di personale importata per errore non è un dato nave.
        return ship && !/\b(?:RIP|D[1-4]|BIS2?|P[1-3]|M1|R[1-4]|T[12]|CAR1|CAP1|SR1)\b/i.test(ship);
      };
      const candidates = globalData.turni_navi.filter(item => {
        const active = item.attiva !== false && !/^(no|false|0)$/i.test(String(item.attiva || ""));
        return active && String(item.data || "").slice(0, 10) === calInfo.iso &&
          String(item.corsa || "").trim().toUpperCase() === cleanShift && isUsableShip(item);
      });
      return candidates.sort((a, b) => String(b.inserita_il || b.updatedAt || '').localeCompare(String(a.inserita_il || a.updatedAt || '')))[0] || null;
    }

    function renderShipDayInfo(calInfo, shift) {
      const info = getShipDayInfo(calInfo, shift);
      if (!info) return "";
      const ship = escapeAttribute(info.nave || "Non indicata");
      const refuel = /^(sì|si|true|1)$/i.test(String(info.rifornimento_mattina || "").trim());
      const mooring = String(info.ormeggio_serale || "").trim();
      return `<div class="ship-day-info" aria-label="Dati nave della giornata">
        <span class="ship-day-badge"><strong>Nave</strong>${ship}</span>
        ${mooring ? `<span class="ship-day-badge mooring"><strong>Ormeggio serale</strong>${escapeAttribute(mooring)}</span>` : ''}
        ${refuel ? '<span class="ship-day-badge refuel">⛽ Rifornimento</span>' : ''}
      </div>`;
    }

    function appendCrewOdsVariations(container, calInfo, selectedShift) {
      if (!container || !calInfo) return;
      const targetShift = getCrewShiftKey(selectedShift);
      if (!targetShift) return;
      const matches = [];

      Object.values(globalData.residenze || {}).forEach(agents => {
        (agents || []).forEach(agent => {
          const variation = agent.variazioni_ods?.[calInfo.iso];
          if (!variation) return;
          const originalShift = ottieniTurnoPulito(variation.turno_originale).toUpperCase();
          const newShift = ottieniTurnoPulito(variation.turno_nuovo).toUpperCase();
          if (!isSameCrewShift(originalShift, targetShift) || isSameCrewShift(newShift, targetShift)) return;
          matches.push({ agent, variation });
        });
      });

      if (!matches.length) return;
      const box = document.createElement("div");
      box.className = "departed-crew-group";
      box.innerHTML = `<div class="departed-crew-list">${matches.map(({ agent, variation }) => {
        const ods = escapeAttribute(variation.ods || "ODS");
        const original = escapeAttribute(normalizeOdsShift(variation.turno_originale).toUpperCase());
        const updated = escapeAttribute(normalizeOdsShift(variation.turno_nuovo).toUpperCase());
        const href = getOdsPdfHref(variation.ods);
        const variationLabel = `${original} → ${updated}`;
        const variationBadge = href
          ? `<a class="agent-ods-badge departed-ods-badge" href="${href}" target="_blank" rel="noopener" title="Apri ODS ${ods}">${variationLabel}</a>`
          : `<span class="agent-ods-badge departed-ods-badge" title="ODS ${ods}">${variationLabel}</span>`;
        const gradeClass = getGradeClass(agent.id, agent.agente, agent.qualifica);
        const grade = gradeInfo[gradeClass] || { label:"Marinaio", color:"#9ca3af" };
        return `<div class="colleague-card departed-card" style="border-left-color:${grade.color};"><span class="c-num">${escapeAttribute(agent.id || "—")}</span><span class="c-name">${escapeAttribute(agent.agente)}${variationBadge}</span><span class="c-grade" style="color:${grade.color};background:${grade.color}22;border:1px solid ${grade.color}44;">${grade.label}</span></div>`;
      }).join("")}</div>`;
      container.appendChild(box);
    }

    function getCalendarVisualClasses(cal, index) {
      const classes = [cal.weekIdx % 2 === 0 ? "week-even" : "week-odd"];
      if (cal.giornoSett === "Lun") classes.push("week-start");
      if (cal.giornoSett === "Dom") classes.push("week-end");
      if (cal.isBozza) classes.push("bozza-col");
      if (cal.isBozza && dateCalendario[index - 1]?.isBozza !== true) classes.push("bozza-start");
      return classes.join(" ");
    }

    function renderCoverageTable() {
      const section = document.getElementById("coverage-section");
      const thead = document.getElementById("coverage-thead");
      const tbody = document.getElementById("coverage-tbody");
      if (!section || !thead || !tbody || !globalData || !currentResidence) return;

      const residenceKey = currentResidence.trim().toLowerCase();
      const shifts = turniMappaResidenze[residenceKey] || [];
      const requirements = getCrewRequirements(currentResidence);
      document.getElementById("coverage-title").textContent = `Completezza equipaggi — ${currentResidence}`;
      const shiftButtons = document.getElementById("coverage-shift-buttons");
      if (shiftButtons) {
        shiftButtons.innerHTML = shifts.map(shift =>
          `<button class="coverage-shift-btn" type="button" data-shift="${shift}" onclick="switchCoverageShift('${shift}')">${shift}</button>`
        ).join("");
        updateCoverageShiftButtons(ottieniTurnoPulito(selectedShiftValue));
      }
      const residenceButtons = document.getElementById("coverage-residence-buttons");
      if (residenceButtons) {
        residenceButtons.innerHTML = getVisibleResidences().map(residence =>
          `<button class="coverage-residence-btn ${residence === currentResidence ? "active" : ""}" data-res="${escapeAttribute(residence)}" type="button" onclick="selectCoverageResidence(decodeURIComponent('${encodeURIComponent(residence)}'))">${residence}</button>`
        ).join("");
      }
      if (document.getElementById("crew-minimum-panel")?.classList.contains("open")) {
        renderCrewMinimumControls();
      }

      thead.innerHTML = `<tr><th>Corsa</th>${dateCalendario.map((cal, index) => {
        const weekDraftLabel = cal.weekStatus === "bozza"
          ? '<span class="week-draft-label">BOZZA</span>'
          : '<span class="week-draft-label is-empty" aria-hidden="true">BOZZA</span>';
        const markers = cal.odsCoverageNumber ? `<span class="date-head-ods" aria-label="Coperto dall’ODS ${cal.odsCoverageNumber}" title="Coperto dall’ODS ${cal.odsCoverageNumber} fino al ${cal.odsCoverageUntil.split('-').reverse().join('/')}" ></span>` : '';
        return `<th data-col="${cal.col}" class="${getCalendarVisualClasses(cal, index)}"><span class="date-head-day">${cal.giornoSett}</span><span class="date-head-num">${cal.dayNum}</span>${weekDraftLabel}${markers ? `<span class="date-head-markers">${markers}</span>` : ''}</th>`;
      }).join("")} </tr>`;

            tbody.innerHTML = shifts.map(shift => {
        const shiftColor = shiftBorderColor[classify(shift)] || "#94a3b8";
        const requiredValue = requirements[shift] ?? requirements[shift.toUpperCase()];
        const required = requiredValue === "" || requiredValue == null ? null : parseInt(requiredValue, 10);

        const cells = dateCalendario.map((cal, calIndex) => {
          const dayIndex = (cal.col - 3) % 7;
          const crew = [];
          let hasTransfer = false;
          Object.entries(globalData.residenze || {}).forEach(([residence, agents]) => {
            (agents || []).forEach(agent => {
              if (isBaristaProfile(agent)) return;
              const rawShift = getAgentShiftOnDate(agent, cal.iso);
              if (isSameCrewShift(rawShift, shift)) {
                const rawUpper = String(rawShift).trim().toUpperCase();
                const isTransfer = residence !== currentResidence || rawUpper.startsWith("C") || rawUpper.endsWith("C");
                hasTransfer ||= isTransfer;
                crew.push(agent.agente);
              }
            });
          });

          const count = crew.length;
          const hasOdsVariation = Object.values(globalData.residenze || {}).some(agents =>
            (agents || []).some(agent => {
              const variation = agent.variazioni_ods?.[cal.iso];
              if (!variation) return false;
              return [variation.turno_originale, variation.turno_nuovo].some(value =>
                isSameCrewShift(value, shift)
              );
            })
          );
          const status = required == null || Number.isNaN(required) ? "unconfigured" :
            count < required ? "incomplete" : count > required ? "overstaffed" : "complete";
          const label = required == null || Number.isNaN(required) ? String(count) : `${count}/${required}`;
          const hasRequirement = required != null && !Number.isNaN(required);
          const title = escapeAttribute(crew.length ? crew.join(", ") : "Nessun agente assegnato");
          const indicators =
            (hasRequirement ? `<span class="coverage-indicator ${count < required ? "incomplete" : "complete"}"></span>` : "") +
            (hasRequirement && count > required ? `<span class="coverage-indicator overstaffed"></span>` : "") +
            (hasTransfer ? `<span class="coverage-indicator transfer"></span>` : "") +
            (hasOdsVariation ? `<span class="coverage-indicator ods"></span>` : "");
          return `<td data-col="${cal.col}" class="coverage-cell ${status} ${hasTransfer ? "has-transfer" : ""} ${getCalendarVisualClasses(cal, calIndex)}" title="${title}" onclick="openCoverageCrew(${cal.col}, '${shift}')"><span class="coverage-indicators">${indicators}</span><span class="coverage-count">${label}</span></td>`;
        }).join("");

        return `<tr data-shift="${shift}" style="--coverage-shift-color:${shiftColor};--coverage-shift-bg:${shiftColor}24"><td>${shift}</td>${cells}</tr>`;
      }).join("");

      section.style.display = shifts.length ? "block" : "none";
    }

    function getTableGradeRank(tr) {
      const gradeOrder = gradeRankMap;
      const gradeClass = Object.keys(gradeOrder).find(cls => tr.classList.contains(cls));
      return gradeOrder[gradeClass] || 99;
    }

    function getAgentForTableRow(tr) {
      const rowIndex = parseInt(tr.dataset.rowIndex);
      const residence = tr.dataset.residence || currentResidence;
      return globalData?.residenze?.[residence]?.[rowIndex] || null;
    }

    function getTableRowShift(tr, cal = dateCalendario.find(item => item.col === selectedCol)) {
      const agent = getAgentForTableRow(tr);
      if (!agent || !cal) return "";
      const dayIndex = (cal.col - 3) % 7;
      return ottieniTurnoPulito(getAgentShiftOnDate(agent, cal.iso)).toUpperCase();
    }

    function removeTemporaryTransferRows() {
      const temporaryRows = trElements.filter(tr => tr.classList.contains("temporary-transfer-row"));
      temporaryRows.forEach(tr => tr.remove());
      trElements = trElements.filter(tr => !tr.classList.contains("temporary-transfer-row"));
    }

    function importTemporaryTransferRows(calInfo, dayIndex, selectedShift) {
      removeTemporaryTransferRows();
      if (!globalData?.residenze || !calInfo || !selectedShift) return;

      const tbody = document.getElementById("tbody");
      const loggedLocation = getLoggedAgentLocation();
      Object.keys(globalData.residenze).forEach(residence => {
        if (residence === currentResidence) return;

        globalData.residenze[residence].forEach((agent, rowIndex) => {
          if (isBaristaProfile(agent)) return;
          if (loggedLocation && residence === loggedLocation.residence && rowIndex === loggedLocation.index) return;
          const rawShift = getAgentShiftOnDate(agent, calInfo.iso);
          if (!isSameCrewShift(rawShift, selectedShift)) return;

          const tr = createRowDOM(agent, rowIndex, false, residence, true);
          tbody.appendChild(tr);
          trElements.push(tr);
        });
      });
    }

    function moveSelectedCrewToTop() {
      // I risultati vengono evidenziati sul posto: l'ordine PDF/anzianità
      // deve restare invariato anche durante la ricerca di un cambio.
      return;
    }

    function restoreDefaultTableOrder() {
      const tbody = document.getElementById("tbody");
      if (!tbody) return;

      removeTemporaryTransferRows();

      trElements.sort((a, b) => {
        const loggedA = a.classList.contains("logged-agent-row") ? 0 : 1;
        const loggedB = b.classList.contains("logged-agent-row") ? 0 : 1;
        if (loggedA !== loggedB) return loggedA - loggedB;
        const pinnedA = a.classList.contains("pinned-row") ? 0 : 1;
        const pinnedB = b.classList.contains("pinned-row") ? 0 : 1;
        return pinnedA - pinnedB || parseInt(a.dataset.rowIndex) - parseInt(b.dataset.rowIndex);
      });

      trElements.forEach(tr => tbody.appendChild(tr));
    }

    // Quanti giorni da calIdx (incluso) hanno la stessa etichetta "altrove"
    // (cambio di residenza pianificato): 1 se il giorno non e' "altrove" o se
    // il giorno dopo ha un valore diverso, altrimenti la lunghezza della serie.
    function elsewhereSpanLength(agenteObj, turnoVal, calIdx) {
      if (!isElsewhereShift(turnoVal) || turnoVal === BARISTA_PRIVATE_SHIFT) return 1;
      // Non attraversare il confine "oggi": hidePastColumns() nasconde/mostra
      // una colonna passata guardando solo il data-col del PRIMO giorno della
      // cella unita. Se quella cella comprendesse sia giorni passati che
      // giorni odierni/futuri, verrebbe nascosta per intero appena c'e' anche
      // un solo giorno passato (es. l'inizio del turno mesi fa) - anche nella
      // parte che dovrebbe restare visibile di default.
      const todayIso = localIsoToday();
      const startIsPast = dateCalendario[calIdx].iso < todayIso;
      let span = 1;
      while (calIdx + span < dateCalendario.length) {
        const nextIso = dateCalendario[calIdx + span].iso;
        if ((nextIso < todayIso) !== startIsPast) break;
        if (getAgentShiftOnDate(agenteObj, nextIso) !== turnoVal) break;
        span++;
      }
      return span;
    }

    function createRowDOM(agenteObj, ri, isPinned = false, residence = currentResidence, isTemporaryTransfer = false) {
      const tr = document.createElement("tr");
      tr.dataset.rowIndex = ri;
      tr.dataset.residence = residence;
      tr.dataset.agentId = String(agenteObj.id || '');
      tr.dataset.agentName = String(agenteObj.agente || '');
      tr.classList.add(getGradeClass(agenteObj.id, agenteObj.agente, agenteObj.qualifica));
      if (isPinned) tr.classList.add("pinned-row");
      if (ri === findLoggedAgentIndex(residence)) tr.classList.add("logged-agent-row");
      if (isTemporaryTransfer) tr.classList.add("temporary-transfer-row");

      const transferLabel = isTemporaryTransfer ? `<span class="transfer-table-label">Trasferta da ${residence}</span>` : "";
      let html = `<td class="td-name" title="${agenteObj.id || ''} ${agenteObj.agente} — ${agenteObj.qualifica || ''}"><span class="agent-name-text">${agenteObj.agente}</span>${transferLabel}</td>`;
      tr.innerHTML = html;

      const agentNameCell = tr.querySelector(".td-name");
      const pinThisAgent = (targetCal = null) => {
        if (isEditMode || isTemporaryTransfer) return;
        if (pinnedAgentIdx === ri) {
          resetCleanTable();
          return;
        }

        placeDayPanel("main");
        pinnedAgentIdx = ri;
        // Quando il pin nasce dal doppio tap su una cella, conserva la data toccata.
        // Il doppio tap sul nome dell'agente continua invece ad aprire la giornata odierna.
        const calToOpen = targetCal || dateCalendario.find(cal => isTodayDate(cal.realObj));
        renderTable();
        if (calToOpen) selectDayForPinnedAgent(calToOpen);
        setTimeout(() => {
          scrollCrewPanelIntoView();
        }, 80);
      };

      agentNameCell.addEventListener("click", event => {
        if (isSyntheticClickAfterTouch()) return;
        event.preventDefault();
        event.stopPropagation();
        pinThisAgent();
      });
      agentNameCell.addEventListener("pointerdown", event => beginMobileTapGesture(agentNameCell, event));
      agentNameCell.addEventListener("pointermove", event => updateMobileTapGesture(agentNameCell, event));
      agentNameCell.addEventListener("pointercancel", () => cancelMobileTapGesture(agentNameCell));
      agentNameCell.addEventListener("pointerup", event => {
        if (event.pointerType !== "touch") return;
        if (!finishMobileTapGesture(agentNameCell, event)) return;
        event.preventDefault();
        event.stopPropagation();
        // Su mobile il nome si pinna esclusivamente con un doppio tap reale.
        handleMobileTap(agentNameCell, null, pinThisAgent);
      });

      for (let calIdx = 0; calIdx < dateCalendario.length; calIdx++) {
        const cal = dateCalendario[calIdx];
        let giornoInternoIdx = (cal.col - 3) % 7;
        let turnoVal = getAgentShiftOnDate(agenteObj, cal.iso);

        // Giorni consecutivi "altrove" (cambio di residenza pianificato) con la
        // stessa etichetta: una sola cella con la scritta, non un pallino/testo
        // per ogni giorno.
        const span = isEditMode ? 1 : elsewhereSpanLength(agenteObj, turnoVal, calIdx);

        const td = document.createElement("td");
        const tdClasses = [];
        tdClasses.push(cal.weekIdx % 2 === 0 ? "week-even" : "week-odd");
        if (cal.giornoSett === "Lun") tdClasses.push("week-start");
        if (cal.giornoSett === "Dom") tdClasses.push("week-end");
        if (cal.isBozza) tdClasses.push("bozza-col");
        const prevCal = dateCalendario[dateCalendario.indexOf(cal) - 1];
        if (cal.isBozza && (!prevCal || !prevCal.isBozza)) tdClasses.push("bozza-start");
        if (span > 1) {
          td.colSpan = span;
          tdClasses.push("elsewhere-span");
        }
          const crewStatus = getCrewStatusForDate(cal, turnoVal);
        const odsVariation = agenteObj.variazioni_ods?.[cal.iso] || null;
        const shipInfo = getShipDayInfo(cal, turnoVal);
        const hasRefuel = /^(sì|si|true|1)$/i.test(String(shipInfo?.rifornimento_mattina || "").trim());
        const hasCrewIndicators = crewStatus.incomplete || crewStatus.overstaffed || crewStatus.hasTransfer || odsVariation;
        if (hasCrewIndicators) tdClasses.push("has-crew-indicators");
        if (hasRefuel) tdClasses.push("has-refuel-indicator");
        td.className = tdClasses.join(" ");
        td.dataset.col = cal.col;

        if (isEditMode) {
          const input = document.createElement("input");
          input.type = "text";
          input.className = "edit-input";
          input.value = turnoVal;
          input.dataset.weekKey = cal.weekKey;
          input.dataset.dayIdx = giornoInternoIdx;
          input.dataset.agentIdx = ri;
          td.appendChild(input);
        } else {
          const crewIndicators = hasCrewIndicators
            ? `<span class="upper-cell-indicators">${crewStatus.incomplete ? '<span class="upper-cell-indicator incomplete"></span>' : ''}${crewStatus.overstaffed ? '<span class="upper-cell-indicator overstaffed"></span>' : ''}${crewStatus.hasTransfer ? '<span class="upper-cell-indicator transfer"></span>' : ''}${odsVariation ? '<span class="upper-cell-indicator ods"></span>' : ''}</span>`
            : "";
          const refuelIndicator = hasRefuel ? '<span class="upper-cell-refuel" aria-label="Rifornimento"></span>' : '';
          td.innerHTML = `${crewIndicators}${refuelIndicator}${pill(turnoVal)}`;
          const groupThisShift = () => {
            if (isElsewhereShift(turnoVal)) return;
            clearPinnedAgentSelection();
            placeDayPanel("main");
            // La prima riga rappresenta l'utente collegato: come il clic sulla
            // data, deve seguire i suoi turni personali scorrendo i giorni.
            crewNavigationMode = tr.classList.contains("logged-agent-row") ? "personal" : "fixed";
            selectDay(cal.col, cal.labelEstesa, turnoVal, agenteObj);
          };
          const pinCellAgent = () => {
            if (tr.classList.contains("logged-agent-row")) {
              groupThisShift();
              return;
            }
            pinThisAgent(cal);
          };
          const singleTapCellAction = () => {
            // Un solo tap, quando esiste un pin, elimina qualsiasi agente fissato.
            if (pinnedAgentIdx !== null) {
              pinnedAgentIdx = null;
              selectedCrewAgent = null;
              clearSelection();
              renderTable();
              return;
            }
            groupThisShift();
          };
          td.addEventListener("click", () => {
            if (isSyntheticClickAfterTouch()) return;
            groupThisShift();
          });
          td.addEventListener("pointerdown", event => beginMobileTapGesture(td, event));
          td.addEventListener("pointermove", event => updateMobileTapGesture(td, event));
          td.addEventListener("pointercancel", () => cancelMobileTapGesture(td));
          td.addEventListener("pointerup", event => {
            if (event.pointerType !== "touch") return;
            if (!finishMobileTapGesture(td, event)) return;
            event.preventDefault();
            handleMobileTap(td, singleTapCellAction, pinCellAgent);
          });
        }
        tr.appendChild(td);
        calIdx += span - 1;
      }

      return tr;
    }

    function selectDay(col, label, cellShiftValue, focusAgent = null) {
      if (isEditMode) return;
      const clickedShiftKey = getCrewShiftKey(ottieniTurnoPulito(cellShiftValue));
      const selectedShiftKey = getCrewShiftKey(ottieniTurnoPulito(selectedShiftValue));
      if (selectedCol === col && clickedShiftKey === selectedShiftKey) {
        clearSelection();
        return;
      }
      // Mantiene la scelta dell'utente: se il passato è visibile, l'apertura
      // di una scheda equipaggio non deve nasconderlo nuovamente.
      selectedCol = col;
      selectedShiftValue = cellShiftValue || selectedShiftValue;
      selectedCrewAgent = focusAgent;
      let calInfo = dateCalendario.find(c => c.col === col);
      let giornoInternoIdx = (col - 3) % 7;
      const cleanShift = ottieniTurnoPulito(cellShiftValue);
      const crewShift = getCrewShiftKey(cleanShift);
      const crewPanelColor = shiftBorderColor[classify(cleanShift)] || "#2dd4bf";
      document.getElementById("day-panel")?.style.setProperty("--crew-shift-color", crewPanelColor);
      const isRest = cleanShift === "";
      const crewResidence = getShiftResidence(cleanShift);
      const isCrewShift = Boolean(crewResidence);
      const myShiftPuro = isRest ? "RIPOSO" : (isGroundCrewShiftKey(crewShift) ? "TERRA" : crewShift);
      const panelShiftLabel = myShiftPuro === "TERRA"
        ? (etichetteServiziTerra[cleanShift.toUpperCase()] || normalizeShiftDisplay(cleanShift.toUpperCase()) || "LAV")
        : myShiftPuro;
      updateCoverageShiftButtons(crewShift);
      updateCoverageCellSelection(col, crewShift);

      if (!calInfo) {
        document.getElementById("tbody").classList.remove("has-selection");
        trElements.forEach(tr => tr.classList.remove("row-match"));
        restoreDefaultTableOrder();
        document.getElementById("day-panel").classList.remove("open");
        document.getElementById("day-panel").setAttribute("aria-hidden", "true");
        return;
      }

      updateAutomaticPastWindow(calInfo);

      document.getElementById("tbody").classList.add("has-selection");

      if (isCrewShift) importTemporaryTransferRows(calInfo, giornoInternoIdx, cleanShift);
          hidePastColumns();

      trElements.forEach(tr => {
        let ag = getAgentForTableRow(tr);
        if (!ag) return;
        let hisShiftRaw = getAgentShiftOnDate(ag, calInfo.iso);
        let hisShiftPuro = ottieniTurnoPulito(hisShiftRaw);

        let match = isSameCrewShift(hisShiftPuro, cleanShift);
        tr.classList.toggle("row-match", match);
      });

      moveSelectedCrewToTop();
      setTimeout(scrollGroupedCrewTableToTop, 60);

      const panelGroups = document.getElementById("panel-groups");
      panelGroups.innerHTML = "";

      const shipDayInfo = isCrewShift ? renderShipDayInfo(calInfo, cleanShift) : "";
      const personalCourseAction = focusAgent && canEditCrewDay(focusAgent)
        ? ` type="button" class="panel-course-name crew-day-trigger" onclick="openCrewDayEditor('${escapeAttribute(String(focusAgent.id || ""))}', '${calInfo.iso}')"`
        : ` class="panel-course-name"`;
      const infoDiv = document.createElement("div");
      infoDiv.className = "shift-group crew-info-group";
      infoDiv.innerHTML = `<div class="colleague-cards"><div class="colleague-card crew-info-card">
        <div class="panel-controls-box" aria-label="Selezione corsa e data">
          <div class="panel-controls-top"><div class="panel-shift-selector" id="panel-shift-selector" aria-label="Corse della residenza"></div><button class="panel-close" type="button" onclick="resetCleanTable()" aria-label="Chiudi scheda equipaggio">✕</button></div>
          <div class="panel-header-main">
            <div class="panel-title-row">
              <div class="panel-date" id="panel-date-label"></div>
              <button type="button"${personalCourseAction} aria-label="${isRest ? "Riposo" : (myShiftPuro === "TERRA" ? "Servizi a terra" : "Corsa selezionata")}">${isRest ? "" : (focusAgent && canEditCrewDay(focusAgent) ? '<span class="panel-course-edit-indicator" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></span>' : "")}<strong>${escapeAttribute(panelShiftLabel)}</strong></button>
            </div>
            <div class="panel-date-navigation" aria-label="Navigazione primaria della data">
              <button class="panel-arrow" id="previous-day-btn" type="button" onclick="changeSelectedDay(-1)" aria-label="Giorno precedente"><svg class="panel-arrow-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 18l-6-6 6-6"/></svg></button>
              <button class="panel-arrow" id="next-day-btn" type="button" onclick="changeSelectedDay(1)" aria-label="Giorno successivo"><svg class="panel-arrow-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6"/></svg></button>
              <button class="panel-arrow panel-today" id="today-day-btn" type="button" onclick="goToToday()" aria-label="Vai a oggi">OGGI</button>
            </div>
          </div>
        </div>
        ${shipDayInfo}
      </div></div>`;
      panelGroups.appendChild(infoDiv);
      document.getElementById("panel-shift-selector").innerHTML = renderResidenceShiftBubbles(cleanShift);

      if (isCrewShift) {
        let allColleagues = [];
        Object.keys(globalData.residenze).forEach(resKey => {
        globalData.residenze[resKey].forEach(ag => {
          // Evita la prima copia "trasferta da BARISTE": la presenza corretta
          // viene aggiunta una sola volta da getCrewBaristas qui sotto.
          if (isBaristaProfile(ag)) return;
          let hisShiftRaw = getAgentShiftOnDate(ag, calInfo.iso);
          let hisShiftPuro = ottieniTurnoPulito(hisShiftRaw);
          const odsVariation = ag.variazioni_ods?.[calInfo.iso] || null;
          const hasManualDay = diariaShiftOverrides.has(`${String(ag.id || "")}|${calInfo.iso}`);
          const movedAwayByOds = !hasManualDay && odsVariation &&
            isSameCrewShift(odsVariation.turno_originale, cleanShift) &&
            !isSameCrewShift(odsVariation.turno_nuovo, cleanShift);

          const originResidence = ag.residenzaOrigine || resKey;
          // Un servizio a terra esplicito (es. "CPONC" di un agente di
          // Peschiera) e' una trasferta: va mostrato come per i turni nave.
          // Solo LAV/TERRA generici restano legati alla residenza d'origine.
          const isExplicitGroundService = Object.values(serviziTerraPerResidenza)
            .some(shifts => shifts.includes(String(hisShiftPuro).toUpperCase()));
          // Chi e' di LAV/TERRA generico non compare nel turno terra, in
          // nessuna residenza: restano solo i servizi a terra espliciti.
          const isGenericGroundShift = /^(?:LAV|TERRA)[;,.]*$/i.test(String(hisShiftPuro).trim());
          if (!isGenericGroundShift && isSameCrewShift(hisShiftPuro, cleanShift) && !movedAwayByOds &&
            (!isGroundCrewShiftKey(cleanShift) || originResidence === crewResidence || isExplicitGroundService)) {
            let rawUpper = hisShiftRaw.toUpperCase();
            let isTrasfertaFlag = rawUpper.startsWith("C") || rawUpper.endsWith("C") || originResidence !==
              crewResidence;

            allColleagues.push({
              agentRecord: ag,
              id: ag.id,
              agente: ag.agente,
              qualifica: ag.qualifica,
              residenzaOrigine: originResidence,
              isTrasferta: isTrasfertaFlag,
              rawShift: hisShiftRaw,
              isInstructor: /\*/.test(String(hisShiftRaw)),
              odsVariation
            });
          }
        });
        });

        getCrewBaristas(calInfo, cleanShift).forEach((record, index) => {
          allColleagues.push({
            id: record.id || `BAR${index + 1}`,
            agente: record.barista || record.agente || record.nome,
            qualifica: "barista",
            residenzaOrigine: crewResidence,
            isTrasferta: false,
            rawShift: cleanShift,
            isInstructor: false,
            isBarista: true,
            odsVariation: null
          });
        });

        const div = document.createElement("div");
        div.className = "shift-group";
        const crewStatus = getCrewDeficiencies(allColleagues, myShiftPuro, crewResidence);
        const shortageText = crewStatus.incomplete
          ? `<div class="crew-alert"><strong>Incompleto</strong></div>`
          : "";
        div.innerHTML = `${shortageText}<div class="colleague-cards" id="colleague-list"></div>`;
        panelGroups.appendChild(div);

      const list = div.querySelector("#colleague-list");
      const gradeOrder = gradeRankMap;
      allColleagues.sort((a, b) => {
        if (myShiftPuro === "TERRA") {
          const serviceA = ottieniTurnoPulito(a.rawShift).toUpperCase();
          const serviceB = ottieniTurnoPulito(b.rawShift).toUpperCase();
          const serviceDifference = (ordineServiziTerra[serviceA] || 99) - (ordineServiziTerra[serviceB] || 99);
          if (serviceDifference !== 0) return serviceDifference;
        }
        const gradeA = gradeOrder[getGradeClass(a.id, a.agente, a.qualifica)] || 99;
        const gradeB = gradeOrder[getGradeClass(b.id, b.agente, b.qualifica)] || 99;
        return gradeA - gradeB || String(a.agente).localeCompare(String(b.agente), "it");
      });

        allColleagues.forEach(r => {
        const gradeClass = getGradeClass(r.id, r.agente, r.qualifica);
        const grade = gradeInfo[gradeClass] || { label: "Marinaio", color: "#9ca3af" };
        const card = document.createElement("div");
        card.className = `colleague-card${r.isInstructor ? " instructor-card" : ""}${r.isTrasferta ? " transfer-card" : ""}${r.isBarista ? " barista-card" : ""}`;
        card.style.cssText = `border-left-color:${grade.color};`;
        if (r.isTrasferta) card.title = `In trasferta da ${r.residenzaOrigine}`;

        let infoResidenza = "";
        if (r.isTrasferta) {
          infoResidenza = `<span class="c-res" style="color:#93c5fd;border-color:rgba(96,165,250,.45);">TRASFERTA DA ${String(r.residenzaOrigine).toUpperCase()}</span>`;
        }

        const instructorMark = r.isInstructor ? `<span class="c-res instructor-mark">SOVRANNUMERO</span>` : "";
        const groundServiceCode = ottieniTurnoPulito(r.rawShift).toUpperCase();
        const groundService = myShiftPuro === "TERRA"
          ? `<span class="c-res">${escapeAttribute(etichetteServiziTerra[groundServiceCode] || normalizeShiftDisplay(groundServiceCode))}</span>`
          : "";
        const odsBadge = renderAgentOdsBadge(r.odsVariation);
        const futureSharedDot = hasCurrentOrFutureSharedCrewWithLogged(r.agentRecord)
          ? '<span class="future-shared-dot" title="Avete turni in comune da oggi in avanti" aria-label="Turni in comune da oggi in avanti"></span>'
          : "";
        const manualDay = diariaShiftOverrides.get(`${String(r.id || "")}|${calInfo.iso}`);
        const manualBadge = manualDay ? `<span class="c-res" title="Turno previsto: ${escapeAttribute(manualDay.from || "—")}">MODIFICATO</span>` : "";
        card.innerHTML = `<span class="c-num">${r.id || "—"}</span>
          <span class="c-name">${r.agente}${odsBadge}${manualBadge}${groundService}${instructorMark} ${infoResidenza}</span>
          ${futureSharedDot}<span class="c-grade" style="color:${grade.color}; background:${grade.color}22; border:1px solid ${grade.color}44;">${grade.label}</span>`;
          if (!r.isBarista) {
            card.classList.add("pinnable-colleague");
            card.title = [card.title, "Clicca per pinnare l’agente"].filter(Boolean).join(" · ");
            const pinCrewCardAgent = () => pinCrewColleague(r.residenzaOrigine, r.id, r.agente, calInfo);
            card.addEventListener("click", event => {
              if (event.target.closest("a, button") || isSyntheticClickAfterTouch()) return;
              pinCrewCardAgent();
            });
            card.addEventListener("pointerup", event => {
              if (event.pointerType !== "touch" || event.target.closest("a, button")) return;
              event.preventDefault();
              handleMobileTap(card, null, pinCrewCardAgent);
            });
          }
          list.appendChild(card);
        });
        appendCrewOdsVariations(div, calInfo, cellShiftValue);
      }

      document.getElementById("panel-date-label").innerHTML = `<span>⬡</span>${label}`;
      const currentIndex = dateCalendario.findIndex(c => c.col === col);
      document.getElementById("previous-day-btn").disabled = currentIndex <= 0;
      document.getElementById("next-day-btn").disabled = currentIndex < 0 || currentIndex >= dateCalendario.length - 1;
      const drawer = document.getElementById("day-panel");
      if (isCrewShift || crewNavigationMode === "personal") {
        // Una corsa apre il suo equipaggio; in modalità personale la scheda
        // resta aperta anche nei giorni di riposo.
        drawer.classList.add("open");
        document.body.classList.add("crew-drawer-open");
        document.body.classList.toggle("crew-drawer-main", dayPanelPlacement !== "coverage");
        document.body.classList.toggle("crew-drawer-coverage", dayPanelPlacement === "coverage");
      }
      drawer.setAttribute("aria-hidden", String(!drawer.classList.contains("open")));
      if (drawer.classList.contains("open")) {
        requestAnimationFrame(() => {
          updateCrewDrawerOffset();
          scrollCrewPanelIntoView();
        });
      }
      syncCoverageCrewCopy();
    }

    function renderPanelResidenceBubbles() {
      const residences = getVisibleResidences();
      return residences.slice(0, 4).map(residence => {
        const active = residence === currentResidence;
        const safe = encodeURIComponent(residence);
        return `<button class="coverage-residence-btn${active ? " active" : ""}" type="button" onclick="selectPanelResidence(decodeURIComponent('${safe}'))">${escapeAttribute(residence)}</button>`;
      }).join("");
    }

    function selectPanelResidence(residence) {
      const cal = dateCalendario.find(item => item.col === selectedCol) || dateCalendario[0];
      selectResidence(residence);
      if (!cal) return;
      const shifts = getResidenceCrewShifts();
      const desired = shifts.some(s => s.toUpperCase() === String(selectedShiftValue || "").toUpperCase())
        ? selectedShiftValue
        : (shifts[0] || selectedShiftValue);
      selectDay(cal.col, cal.labelEstesa, desired);
    }

    function syncCoverageCrewCopy() {
      const source = document.getElementById("panel-groups");
      const target = document.getElementById("coverage-crew-copy");
      const panel = document.getElementById("day-panel");
      if (!source || !target || !source.children.length) return;
      target.style.setProperty("--crew-shift-color", panel?.style.getPropertyValue("--crew-shift-color") || "#2dd4bf");
      const clone = source.cloneNode(true);
      clone.id = "coverage-copy-panel-groups";
      clone.querySelectorAll("[id]").forEach(el => {
        const oldId = el.id;
        el.id = `coverage-copy-${oldId}`;
      });
      target.replaceChildren(clone);
    }


    function scrollGroupedCrewTableToTop() {
      const target = dayPanelPlacement === "coverage"
        ? document.getElementById("coverage-matrix-wrap")
        : document.getElementById("matrix-scroll-wrap");
      if (!target) return;
      const panel = document.getElementById("day-panel");
      const panelHeight = panel?.classList.contains("open") ? panel.getBoundingClientRect().height : 0;
      const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - panelHeight - 10);
      window.scrollTo({ top, behavior:"smooth" });
    }

    function updateCrewDrawerOffset() {
      const panel = document.getElementById("day-panel");
      const matrix = document.getElementById("matrix-scroll-wrap");
      const coverageWrap = document.querySelector("#coverage-section .coverage-wrap");
      const open = Boolean(panel?.classList.contains("open"));
      const height = open ? Math.ceil(panel.getBoundingClientRect().height) + 14 : 0;
      document.documentElement.style.setProperty("--crew-drawer-offset", `${height}px`);
      if (matrix) matrix.style.marginTop = open && dayPanelPlacement !== "coverage" ? `${height}px` : "";
      if (coverageWrap) coverageWrap.style.marginTop = open && dayPanelPlacement === "coverage" ? `${height}px` : "";
    }
    window.addEventListener("resize", updateCrewDrawerOffset);

    function pinCrewColleague(residence, id, name, calInfo) {
      const agents = globalData?.residenze?.[residence] || [];
      const targetIndex = agents.findIndex(agent =>
        (id && String(agent.id || "") === String(id)) ||
        String(agent.agente || "").trim().toLocaleLowerCase("it") === String(name || "").trim().toLocaleLowerCase("it")
      );
      if (targetIndex < 0) return;
      if (currentResidence !== residence) selectResidence(residence);
      else clearSelection();
      pinnedAgentIdx = targetIndex;
      renderTable();
      if (calInfo) selectDayForPinnedAgent(calInfo);
      setTimeout(scrollCrewPanelIntoView, 60);
    }

    function scrollCrewPanelIntoView() {
      const panel = document.getElementById("day-panel");
      if (!panel) return;
      panel.scrollTo({ top:0, behavior:"smooth" });
    }

    function placeDayPanel(placement) {
      const panel = document.getElementById("day-panel");
      const matrix = document.getElementById("matrix-scroll-wrap");
      const coverage = document.getElementById("coverage-section");
      if (!panel || !matrix || !coverage) return;
      dayPanelPlacement = placement;
      if (document.body.classList.contains("crew-drawer-open")) {
        document.body.classList.toggle("crew-drawer-main", placement !== "coverage");
        document.body.classList.toggle("crew-drawer-coverage", placement === "coverage");
      }
      const target = placement === "coverage"
        ? coverage.querySelector(".coverage-wrap")
        : matrix;
      if (!target) return;
      if (panel.nextElementSibling !== target) target.parentNode.insertBefore(panel, target);
      if (placement !== "coverage") updateCoverageCellSelection(null, "");
    }

    function setupSynchronizedTableScrolls() {
      const mainWrap = document.getElementById("matrix-scroll-wrap");
      const coverageWrap = document.getElementById("coverage-matrix-wrap");
      if (!mainWrap || !coverageWrap || mainWrap.dataset.scrollSyncReady) return;
      mainWrap.dataset.scrollSyncReady = "true";
      const synchronize = (source, target) => {
        if (syncingHorizontalScroll) return;
        syncingHorizontalScroll = true;
        target.scrollLeft = source.scrollLeft;
        requestAnimationFrame(() => { syncingHorizontalScroll = false; });
      };
      mainWrap.addEventListener("scroll", () => synchronize(mainWrap, coverageWrap), { passive:true });
      coverageWrap.addEventListener("scroll", () => synchronize(coverageWrap, mainWrap), { passive:true });
    }

    function openCoverageCrew(col, shift) {
      const cal = dateCalendario.find(item => item.col === col);
      if (!cal) return;
      clearPinnedAgentSelection();
      placeDayPanel("coverage");
      crewNavigationMode = "fixed";
      selectDay(cal.col, cal.labelEstesa, shift);
    }

    function updateCoverageShiftButtons(shift) {
      const selectedShift = String(shift || "").toUpperCase();
      document.querySelectorAll(".coverage-shift-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.shift.toUpperCase() === selectedShift);
      });
    }

    function updateCoverageCellSelection(col, shift) {
      document.querySelectorAll(".coverage-cell.coverage-selected").forEach(cell => {
        cell.classList.remove("coverage-selected");
      });
      if (dayPanelPlacement !== "coverage" || col == null || !shift) return;
      const selectedRow = Array.from(document.querySelectorAll("#coverage-tbody tr"))
        .find(row => row.dataset.shift.toUpperCase() === String(shift).toUpperCase());
      const selectedCell = selectedRow?.querySelector(`.coverage-cell[data-col="${col}"]`);
      selectedCell?.classList.add("coverage-selected");
    }

    function switchCoverageShift(shift) {
      let cal = dateCalendario.find(item => item.col === selectedCol);
      if (!cal) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        cal = dateCalendario.find(item => {
          const date = new Date(item.realObj);
          date.setHours(0, 0, 0, 0);
          return date.getTime() === today.getTime();
        }) || dateCalendario.find(item => item.realObj >= today) || dateCalendario[0];
      }
      if (cal) openCoverageCrew(cal.col, shift);
    }

    function selectCoverageResidence(residence) {
      selectResidence(residence);
      placeDayPanel("coverage");
    }

    function changeSelectedDay(direction) {
      const currentIndex = dateCalendario.findIndex(c => c.col === selectedCol);
      const target = dateCalendario[currentIndex + direction];
      if (!target) return;
      if ((isBaristaProfile() || crewNavigationMode === "personal") && selectDayForLoggedAgent(target)) {
        // Modalità personale: usa il turno effettivo dell'utente nel nuovo giorno.
      } else if (pinnedAgentIdx !== null && currentAgentsList[pinnedAgentIdx]) {
        selectDayForPinnedAgent(target);
      } else {
        const shift = activeShiftFilter || selectedShiftValue;
        clearPinnedAgentSelection();
        selectDay(target.col, target.labelEstesa, shift);
      }
      setTimeout(() => revealSelectedDate(target), 90);
    }

    function revealSelectedDate(cal) {
      scrollDateColumnIntoView(cal);
    }

    function scrollDateColumnIntoView(cal, behavior = "smooth") {
      const coverageMode = dayPanelPlacement === "coverage";
      const wrap = document.getElementById(coverageMode ? "coverage-matrix-wrap" : "matrix-scroll-wrap");
      const header = document.querySelector(coverageMode ? "#coverage-thead" : ".date-header");
      const th = header?.querySelector(`th[data-col="${cal.col}"]`);
      const fixedHeader = header?.querySelector("th:first-child");
      if (!wrap || !th) return;
      const offset = Math.max(0, th.getBoundingClientRect().left + window.scrollX - (fixedHeader?.offsetWidth || 0) - 8);
      window.scrollTo({ left:offset, top:window.scrollY, behavior });
    }

    function getResidenceCrewShifts() {
      const residenceKey = String(currentResidence || "").trim().toLowerCase();
      return (turniMappaResidenze[residenceKey] || []).filter(shift =>
        !isGroundCrewShiftKey(getCrewShiftKey(shift)) &&
        !serviziTerraPerResidenza[String(currentResidence || "").trim().toUpperCase()]?.includes(String(shift).toUpperCase())
      );
    }

    function renderResidenceShiftBubbles(selectedShift) {
      const selected = ottieniTurnoPulito(selectedShift).toUpperCase();
      const shifts = getResidenceCrewShifts();
      if (!shifts.length) return "";
      return shifts.map(shift => {
        const clean = String(shift).toUpperCase();
        const active = clean === selected;
        const color = shiftBorderColor[classify(shift)] || "#94a3b8";
        const safeShift = escapeAttribute(shift);
        return `<button class="crew-shift-bubble${active ? " active" : ""}" type="button" style="--shift-color:${color}" ${active ? `disabled aria-current="true"` : `onclick="selectResidenceCrewShift('${safeShift}')"`} aria-label="${active ? "Corsa selezionata" : "Mostra equipaggio"} ${safeShift}">${safeShift}</button>`;
      }).join("");
    }

    function selectResidenceCrewShift(shift) {
      const cal = dateCalendario.find(item => item.col === selectedCol);
      if (!cal || !getResidenceCrewShifts().some(item => item.toUpperCase() === String(shift).toUpperCase())) return;
      clearPinnedAgentSelection();
      crewNavigationMode = "fixed";
      activeShiftFilter = shift;
      generaFiltriTurnoRiferimento();
      selectDay(cal.col, cal.labelEstesa, shift);
    }

    function changeSelectedShift(direction) {
      const residenceKey = String(currentResidence || "").trim().toLowerCase();
      const shifts = turniMappaResidenze[residenceKey] || [];
      const cal = dateCalendario.find(item => item.col === selectedCol);
      if (!shifts.length || !cal) return;
      const currentShift = ottieniTurnoPulito(selectedShiftValue);
      const currentIndex = shifts.findIndex(shift => shift.toUpperCase() === currentShift.toUpperCase());
      const targetIndex = currentIndex < 0
        ? (direction < 0 ? shifts.length - 1 : 0)
        : (currentIndex + direction + shifts.length) % shifts.length;
      const targetShift = shifts[targetIndex];
      clearPinnedAgentSelection();
      crewNavigationMode = "fixed";
      activeShiftFilter = targetShift;
      generaFiltriTurnoRiferimento();
      selectDay(cal.col, cal.labelEstesa, targetShift);
    }

    function goToToday() {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const target = dateCalendario.find(cal => {
        const date = new Date(cal.realObj);
        date.setHours(0, 0, 0, 0);
        return date.getTime() === now.getTime();
      });
      if (!target) return;
      if ((isBaristaProfile() || crewNavigationMode === "personal") && selectDayForLoggedAgent(target)) {
        // Modalità personale: usa il turno effettivo dell'utente nel nuovo giorno.
      } else if (pinnedAgentIdx !== null && currentAgentsList[pinnedAgentIdx]) {
        selectDayForPinnedAgent(target);
      } else {
        const shift = activeShiftFilter || selectedShiftValue;
        clearPinnedAgentSelection();
        selectDay(target.col, target.labelEstesa, shift);
      }
      setTimeout(() => revealSelectedDate(target), 90);
    }

    function clearSelection() {
      selectedCol = null;
      selectedShiftValue = "";
      selectedCrewAgent = null;
      document.getElementById("day-panel").classList.remove("open");
      document.getElementById("day-panel").setAttribute("aria-hidden", "true");
      document.body.classList.remove("crew-drawer-open", "crew-drawer-main", "crew-drawer-coverage");
      document.documentElement.style.setProperty("--crew-drawer-offset", "0px");
      document.getElementById("tbody").classList.remove("has-selection");
      trElements.forEach(tr => {
        tr.classList.remove("row-match");
      });
      restoreDefaultTableOrder();
      showPastColumns = false;
      automaticPastFromTime = null;
      hidePastColumns();

      // Quando la scheda equipaggio viene chiusa, riporta dolcemente
      // l'inizio della tabella nella parte alta dello schermo.
      requestAnimationFrame(() => {
        const tableWrap = document.getElementById("matrix-scroll-wrap");
        if (!tableWrap) return;
        const top = tableWrap.getBoundingClientRect().top + window.scrollY - 8;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      });
      window.scrollTo({ left:0, top:window.scrollY, behavior:"auto" });
    }

    // Un clic sullo sfondo, fuori dalla tabella e dai relativi comandi,
    // equivale a ricliccare sulla corsa selezionata: chiude il pannello,
    // cancella data/corsa ed elimina qualsiasi agente pinnato.
    document.addEventListener("click", event => {
      if (isEditMode) return;

      const target = event.target;
      // Il contenitore può essere largo quanto tutta la pagina: conta come "tabella"
      // soltanto l'elemento <table> effettivamente visibile.
      const insideTurnTable = target.closest("#matrix-scroll-wrap table");
      const insideCoverageTable = target.closest("#coverage-matrix-wrap table");
      const insideCrewPanel = target.closest("#day-panel, #coverage-crew-copy");
      const insideOperationalControl = target.closest("button, a, input, select, textarea, label, .toolbar-container, .turni-sidebar, .login-overlay");

      if (insideTurnTable || insideCoverageTable || insideCrewPanel || insideOperationalControl) return;
      if (pinnedAgentIdx === null && selectedCol === null && !selectedShiftValue && !selectedCrewAgent) return;

      pinnedAgentIdx = null;
      activeShiftFilter = null;
      clearSelection();
      generaFiltriTurnoRiferimento();
      renderTable();
    });

    function resetCleanTable() {
      pinnedAgentIdx = null;
      activeShiftFilter = null;
      const search = document.getElementById("agent-search");
      if (search) search.value = "";
      clearSelection();
      generaFiltriTurnoRiferimento();
      renderTable();
      window.scrollTo({ left:0, top:0, behavior:"smooth" });
    }

    function localIsoToday() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }

    // Da quale data in poi si controlla se un agente ha smesso di lavorare:
    // normalmente da oggi, ma se il passato è visibile (pulsante "Mostra
    // passato" o navigazione su una data vecchia) si guarda tutto lo storico,
    // cosi' chi aveva turni veri prima di finire il servizio ricompare.
    function finishedServiceFloorIso() {
      if (showPastColumns) return "";
      if (automaticPastFromTime !== null) {
        const d = new Date(automaticPastFromTime);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
      return localIsoToday();
    }

    // Agente sempre CON o RIP nel periodo attualmente visibile: ha terminato
    // il servizio, va nascosto dalla tabella (ma resta nei dati). Caricare il
    // passato lo fa ricomparire se in quel periodo aveva turni veri.
    function hasFinishedService(agent, floorIso = finishedServiceFloorIso()) {
      let checked = false, real = false;
      settimaneInfo.forEach(week => {
        const shifts = agent?.turni_settimanali?.[week.key] || [];
        (week.dateIso || []).forEach((iso, index) => {
          if (iso < floorIso) return;
          checked = true;
          const shift = ottieniTurnoPulito(shifts[index] || "rip");
          if (shift !== "" && shift !== "CON") real = true;
        });
      });
      return checked && !real;
    }

    function countVisibleAgents(list) {
      return (list || []).filter(agent => !hasFinishedService(agent)).length;
    }

    function filterAgents(query) {
      const q = (query || "").trim().toLocaleLowerCase("it");
      let visible = 0;
      document.querySelectorAll("#tbody tr").forEach(tr => {
        const match = !q || tr.textContent.toLocaleLowerCase("it").includes(q);
        tr.classList.toggle("agent-hidden", !match);
        if (match) visible++;
      });
      document.getElementById("stat-agents").textContent = visible;
    }

    // Ricostruisce currentAgentsList dalla globalData aggiornata mantenendo la
    // residenza già selezionata (usato dagli aggiornamenti in background).
    function refreshCurrentResidenceData() {
      if (!currentResidence || !globalData?.residenze) return;
      currentAgentsList = currentResidence === "TUTTE"
        ? getVisibleResidences().flatMap(res => globalData.residenze[res] || [])
        : (globalData.residenze[currentResidence] || []);
      const agentsStat = document.getElementById("stat-agents");
      if (agentsStat) agentsStat.textContent = countVisibleAgents(currentAgentsList);
    }

    function selectResidence(resName) {
      if (String(resName || "").toUpperCase() === "BARISTE" && !isBaristaProfile()) return;
      if (isEditMode) {
        if (!confirm("Uscire dalla modalità modifica senza salvare i cambi correnti?")) return;
        toggleEditMode();
      }
      clearPinnedAgentSelection();
      clearSelection();
      currentResidence = resName;
      syncQuickResidenceSelector();
      activeShiftFilter = null;

      if (resName === "TUTTE") {
        // Aggrega tutti gli agenti di tutte le residenze visibili.
        currentAgentsList = getVisibleResidences().flatMap(res => globalData.residenze[res] || []);
      } else {
        currentAgentsList = globalData.residenze[resName] || [];
      }
      document.getElementById("stat-residence").textContent = resName;
      document.getElementById("stat-agents").textContent = countVisibleAgents(currentAgentsList);
      const search = document.getElementById("agent-search");
      if (search) search.value = "";
      document.querySelectorAll(".res-btn, .coverage-residence-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.res === resName));

      generaFiltriTurnoRiferimento();

      if (currentAgentsList.length > 0) {
        document.getElementById("matrix-scroll-wrap").style.display = "block";
        renderTable();
      } else {
        clearSelection();
      }
    }

    function hidePastColumns() {
      // Il limite resta sempre oggi: la selezione di una data futura non deve
      // nascondere le giornate comprese tra oggi e la data selezionata.
      const referenceDate = new Date();
      referenceDate.setHours(0, 0, 0, 0);
      dateCalendario.forEach(cal => {
        const isPast = cal.realObj < referenceDate;
        const isBeforeAutomaticWindow = automaticPastFromTime === null || cal.realObj.getTime() < automaticPastFromTime;
        const displayValue = (!showPastColumns && isPast && isBeforeAutomaticWindow) ? "none" : "table-cell";
        document.querySelectorAll(`th[data-col="${cal.col}"]`).forEach(el => {
          el.style.display = displayValue;
          el.style.opacity = "1";
        });
        document.querySelectorAll(`td[data-col="${cal.col}"]`).forEach(td => {
          td.style.display = displayValue;
          td.style.opacity = "1";
        });
      });

      const thead = document.getElementById("thead-container");
      const oldMonth = thead?.querySelector(".month-header");
      if (oldMonth) oldMonth.outerHTML = buildMonthHeader();
      requestAnimationFrame(updateLoggedStickyOffset);

      const btn = document.getElementById("togglePastBtn");
      if (btn) btn.textContent = showPastColumns ? "🙈 Nascondi passato" : "👁 Mostra passato";
    }

    function updateAutomaticPastWindow(cal) {
      if (showPastColumns || !cal?.realObj) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(cal.realObj);
      selectedDate.setHours(0, 0, 0, 0);
      const previous = automaticPastFromTime;
      automaticPastFromTime = selectedDate < today ? selectedDate.getTime() : null;
      if (automaticPastFromTime !== previous) {
        refreshCurrentResidenceData();
        renderTable();
      }
    }

    function togglePastColumns() {
      showPastColumns = !showPastColumns;
      if (!showPastColumns) {
        automaticPastFromTime = null;
        updateAutomaticPastWindow(dateCalendario.find(cal => cal.col === selectedCol));
      }
      hidePastColumns();
      refreshCurrentResidenceData();
      renderTable();
      const selectedCal = dateCalendario.find(cal => cal.col === selectedCol);
      setTimeout(() => selectedCal ? scrollDateColumnIntoView(selectedCal, "auto") : scrollToToday(), 30);
    }

    function toggleEditMode() {
      isEditMode = !isEditMode;
      const btn = document.getElementById("toggle-edit-btn");
      const btnSave = document.getElementById("save-edit-btn");
      const btnDl = document.getElementById("download-json-btn");

      if (isEditMode) {
        clearSelection();
        btn.textContent = "✕ Annulla";
        btn.classList.add("editing");
        btnSave.style.display = "inline-flex";
        btnDl.style.display = "inline-flex";
      } else {
        btn.textContent = "✍ Abilita Modifiche";
        btn.classList.remove("editing");
        btnSave.style.display = "none";
        btnDl.style.display = "none";
      }

      generaFiltriTurnoRiferimento();
      renderTable();
    }

    function saveChanges() {
      const inputs = document.querySelectorAll(".edit-input");
      inputs.forEach(input => {
        const aIdx = parseInt(input.dataset.agentIdx);
        const wKey = input.dataset.weekKey;
        const dIdx = parseInt(input.dataset.dayIdx);
        const nuovoValore = input.value.trim() === "" ? "rip" : input.value.trim();

        if (currentAgentsList[aIdx]) {
          if (!currentAgentsList[aIdx].turni_settimanali[wKey]) {
            currentAgentsList[aIdx].turni_settimanali[wKey] = ["rip", "rip", "rip", "rip", "rip", "rip", "rip"];
          }
          currentAgentsList[aIdx].turni_settimanali[wKey][dIdx] = nuovoValore;
        }
      });

      globalData.residenze[currentResidence] = currentAgentsList;
      saveTurniCache(JSON.stringify(globalData));

      alert("Cambio turni salvato correttamente in memoria locale!");
      toggleEditMode();
    }

    function downloadUpdatedJSON() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(globalData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "turni_finali.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }

    function renderResidenceButtons() {
      const topContainer = document.getElementById("top-residence-buttons");
      const modalContainer = document.getElementById("modal-residence-buttons");

      if (topContainer) topContainer.innerHTML = "";
      if (modalContainer) modalContainer.innerHTML = "";

      // Inserisce "TUTTE" all'inizio seguito dalle residenze disponibili.
      const residences = ["TUTTE", ...getVisibleResidences()];

      residences.forEach(res => {
        const active = res === currentResidence;

        if (topContainer) {
          const btnTop = document.createElement("button");
          btnTop.className = `coverage-residence-btn ${active ? "active" : ""}`.trim();
          btnTop.dataset.res = res;
          btnTop.textContent = res;
          btnTop.addEventListener("click", () => selectResidence(res));
          topContainer.appendChild(btnTop);
        }

        if (modalContainer) {
          const btnModal = document.createElement("button");
          btnModal.className = active ? "active" : "";
          btnModal.dataset.res = res;
          btnModal.textContent = res;
          btnModal.addEventListener("click", () => {
            selectResidence(res);
            document.getElementById("mobile-filter-modal")?.classList.remove("open");
          });
          modalContainer.appendChild(btnModal);
        }
      });
    }

    function getVisibleResidences() {
      return Object.keys(globalData?.residenze || {}).filter(residence => {
        const key = String(residence || "").toUpperCase();
        return (key !== "BARISTE" || isBaristaProfile()) && key !== "UFFICI";
      });
    }

    function getDefaultResidence() {
      const list = getVisibleResidences();
      return list.find(res => String(res || "").toLowerCase().trim() === "desenzano") ||
        list.find(res => String(res || "").toLowerCase().trim().includes("desenzano")) ||
        list[0] || "";
    }


    function formatDateISOClient(d) {
      return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
    }

    function normalizeOdsAgentName(value) {
      return String(value || "")
        .trim()
        .toLocaleLowerCase("it")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.'’`]/g, "")
        .replace(/\s+/g, " ");
    }

    function normalizeOdsShift(value) {
      const shift = String(value || "").trim();
      if (!shift || /^={3,}$/.test(shift) || /^(rip|rip\.|riposo)$/i.test(shift)) return "rip";
      if (/^lav\.?$/i.test(shift)) return "TERRA";
      return shift.toUpperCase();
    }

    function applyOdsVariations(data) {
      const variations = Array.isArray(data?.variazioni_ods)
        ? [...data.variazioni_ods].sort((a, b) => {
            const odsNumber = value => Number.parseInt(String(value?.ods || "").match(/\d+/)?.[0] || "0", 10);
            const priority = value => String(value?.tipo || "").toUpperCase() === "MANUALE"
              ? (value?.requestId ? -1 : 1000000)
              : odsNumber(value);
            return priority(a) - priority(b);
          })
        : [];
      if (!variations.length) return data;

      const agents = Object.values(data.residenze || {}).flat();

      variations.forEach(variation => {
        if (!variation || variation.attiva === false || !variation.data ||
            (!variation.agente && !variation.id_agente)) return;

        const variationId = String(variation.id_agente || "").trim();
        const variationName = normalizeOdsAgentName(variation.agente);
        const agent = agents.find(item => {
          const agentName = normalizeOdsAgentName(item.agente);
          return (variationId && String(item.id || "").trim() === variationId) ||
            agentName === variationName ||
            agentName.startsWith(variationName + " ");
        });
        if (!agent) return;

        const week = settimaneInfo.find(item => item.dateIso.includes(variation.data));
        if (!week) return;
        const dayIndex = week.dateIso.indexOf(variation.data);
        if (dayIndex < 0) return;

        // Un agente con cambio di residenza compare in due residenze: la
        // variazione va applicata a tutte le sue copie (e ai turni completi).
        const copies = agents.filter(item => item === agent ||
          (String(item.id || "") === String(agent.id || "") && item.agente === agent.agente));
        copies.forEach(copy => {
          const weeklyShifts = copy.turni_settimanali?.[week.key];
          const fullShifts = copy.turni_settimanali_completi?.[week.key];
          if (!weeklyShifts || dayIndex >= weeklyShifts.length) return;

          const hidden = isElsewhereShift(weeklyShifts[dayIndex]);
          const currentShift = (hidden ? fullShifts?.[dayIndex] : weeklyShifts[dayIndex]) || "rip";
          const newShift = normalizeOdsShift(variation.turno_nuovo);
          if (!hidden) weeklyShifts[dayIndex] = newShift;
          if (fullShifts) fullShifts[dayIndex] = newShift;

          // Sui giorni nascosti la variazione resta solo nei dati completi,
          // altrimenti rivelerebbe il turno nella residenza sbagliata.
          const storeKey = hidden ? "variazioni_ods_completi" : "variazioni_ods";
          if (!copy[storeKey]) copy[storeKey] = {};
          copy[storeKey][variation.data] = {
            ...variation,
            // Il turno di partenza deve riflettere sempre il valore corrente
            // di Foglio1; quello riportato nell'ODS potrebbe essere precedente
            // a una successiva correzione del turno base.
            turno_originale: normalizeOdsShift(currentShift),
            turno_nuovo: newShift
          };
        });
      });

      return data;
    }

    function adattaFormatoNaviturni(data) {
      if (!data || !Array.isArray(data.date)) return data;

      settimaneInfo.length = 0;
      const date = [...data.date].sort((a, b) => a.iso.localeCompare(b.iso));

      for (let i = 0; i < date.length; i += 7) {
        const blocco = date.slice(i, i + 7);
        if (!blocco.length) continue;

        const inizio = new Date(blocco[0].iso + "T00:00:00");
        const fine = new Date(blocco[blocco.length - 1].iso + "T00:00:00");

        const key =
          "settimana_" +
          String(inizio.getDate()).padStart(2, "0") + "-" +
          String(inizio.getMonth() + 1).padStart(2, "0") +
          "_al_" +
          String(fine.getDate()).padStart(2, "0") + "-" +
          String(fine.getMonth() + 1).padStart(2, "0");

        settimaneInfo.push({
          label: "Settimana " +
            String(inizio.getDate()).padStart(2, "0") + "-" +
            String(inizio.getMonth() + 1).padStart(2, "0") +
            " al " +
            String(fine.getDate()).padStart(2, "0") + "-" +
            String(fine.getMonth() + 1).padStart(2, "0"),
          key,
          startDay: inizio.getDate(),
          month: inizio.getMonth(),
          year: inizio.getFullYear(),
          count: blocco.length,
          dateIso: blocco.map(x => x.iso),
          dateStates: blocco.map(x => String(x.stato || "ufficiale").toLowerCase())
        });
      }

      const residenze = {};
      const buildRow = (ag, isHidden, labelFor) => {
        const turni_settimanali = {};
        const turni_settimanali_completi = {};
        let masked = false;

        settimaneInfo.forEach(sett => {
          const full = sett.dateIso.map(iso => (ag.turni && ag.turni[iso]) ? normalizeOdsShift(ag.turni[iso]) : "rip");
          turni_settimanali_completi[sett.key] = full;
          turni_settimanali[sett.key] = sett.dateIso.map((iso, index) => {
            if (!isHidden(iso)) return full[index];
            masked = true;
            return labelFor ? labelFor(iso) : BARISTA_PRIVATE_SHIFT;
          });
        });

        const row = {
          id: ag.id || "",
          agente: ag.agente || "",
          qualifica: ag.qualifica || "marinaio",
          turni_settimanali
        };
        // Nella tabella di una residenza i giorni svolti nell'altra restano
        // etichettati "A <residenza>"; la riga fissata in alto (mia / collega)
        // mostra invece sempre i turni veri.
        if (masked) row.turni_settimanali_completi = turni_settimanali_completi;
        if (ag.residenzaDal && ag.residenzaPrecedente && ag.residenzaNuova) {
          row.residenzaDal = ag.residenzaDal;
          row.residenzaPrecedente = ag.residenzaPrecedente;
          row.residenzaNuova = ag.residenzaNuova;
        }
        return row;
      };
      const moved = [];
      const today = localIsoToday();

      Object.keys(data.residenze || {}).forEach(residenza => {
        residenze[residenza] = (data.residenze[residenza] || []).map(ag => {
          // Agente con cambio di residenza a decorrere da una data (import turni):
          // prima della decorrenza compare ancora qui con i turni veri, etichettato
          // "A <nuova residenza>" da quel giorno in poi (li' lo trovi per davvero).
          // Dalla decorrenza in poi sparisce del tutto da qui: il suo record e'
          // ormai nella nuova residenza (spostato da moveAgentToResidence). La
          // "residenza attuale" e' quella in cui lo troviamo qui (non ci si fida
          // del solo campo residenzaPrecedente salvato, che su import piu' vecchi
          // puo' mancare): resta cosi' corretto anche per import fatti prima di
          // una correzione di questa logica.
          if (ag.residenzaDal && ag.residenzaNuova && today < ag.residenzaDal &&
            residenza.toUpperCase() !== String(ag.residenzaNuova).toUpperCase()) {
            const dal = ag.residenzaDal;
            const label = `A ${String(ag.residenzaNuova).toUpperCase()}`;
            moved.push({ ag, dal, home: residenza });
            return buildRow(ag, iso => iso >= dal, () => label);
          }
          return buildRow(ag, () => false);
        });
      });

      // Copia "in anteprima" nella residenza futura: prima della decorrenza mostra
      // dov'e' davvero l'agente ("A <residenza attuale>"), poi i turni veri.
      moved.forEach(({ ag, dal, home }) => {
        const otherKey = Object.keys(residenze).find(key => key.toUpperCase() === String(ag.residenzaNuova).toUpperCase());
        if (!otherKey) return;
        const label = `A ${String(home).toUpperCase()}`;
        const copy = buildRow(ag, iso => iso < dal, () => label);
        const rank = name => (window.NaviSharedData?.seniorityRank ? window.NaviSharedData.seniorityRank(name) : Number.POSITIVE_INFINITY);
        const list = residenze[otherKey];
        const position = list.findIndex(item => rank(item.agente) > rank(copy.agente));
        if (position === -1) list.push(copy); else list.splice(position, 0, copy);
      });

      return {
        ...data,
        residenze
      };
    }

    function processJSONData(data, { soft = false } = {}) {
      data = adattaFormatoNaviturni(data);
      data = applyOdsVariations(data);
      // Ogni risposta (cache locale o rete) contiene nuovamente il dataset
      // completo. Il perimetro delle bariste deve quindi essere ricostruito
      // ad ogni caricamento, mai riutilizzato tramite un vecchio flag.
      baristaAccessApplied = false;
      if (isBaristaProfile()) {
        showPastColumns = false;
        automaticPastFromTime = null;
        pinnedAgentIdx = null;
        activeShiftFilter = null;
        selectedCol = null;
        selectedShiftValue = "";
        selectedCrewAgent = null;
      }
      globalData = data;
      inizializzaCalendario();
      buildTableHeader();
      document.getElementById("stat-status").textContent = "Aggiornati";
      document.getElementById("welcome-notice").style.display = "none";
      
      // Aggiorna il periodo nel titolo
      if (data.periodo) {
        document.getElementById("periodLabel").textContent = String(data.periodo).replace(/^.*?\bDAL\b\s*/i, "");
      }
      
      renderResidenceButtons();
      populateLoginSurnameOptions();
      const previousLoggedResidence = String(loggedAgentProfile?.residence || "").toUpperCase();
      loggedAgentProfile = readLoggedAgentProfile();
      reconcileLoggedResidence();
      updateLoginUserPanel();
      // La copia locale era di prima di un cambio di residenza dell'agente:
      // i dati nuovi lo mettono altrove, quindi si riapre la sua residenza.
      const loggedResidenceChanged = !!previousLoggedResidence &&
        String(loggedAgentProfile?.residence || "").toUpperCase() !== previousLoggedResidence;

      // Aggiornamento in background: rinfresca i dati della vista corrente
      // senza toccare la residenza, il filtro turno e lo scroll dell'utente.
      if (soft && !loggedResidenceChanged && loggedAgentProfile && currentResidence && globalData?.residenze) {
        const scrollLeft = window.scrollX, scrollTop = window.scrollY;
        refreshCurrentResidenceData();
        renderTable();
        window.scrollTo(scrollLeft, scrollTop);
        return;
      }

      if (loggedAgentProfile && applyLoggedAgentProfile()) return;
      if (loggedAgentProfile) {
        // La copia locale può essere precedente all'aggiunta dell'agente (in
        // particolare per le bariste). Conserva la sessione: il caricamento
        // dalla rete applicherà il profilo appena arrivano i dati aggiornati.
        restrictBaristaInterface();
        return;
      }
      location.replace("index.html");
    }

    function loadPastedJSON() {
      const txt = document.getElementById("json-paste-input").value.trim();
      try {
        const parsed = JSON.parse(txt);
        saveTurniCache(txt);
        processJSONData(parsed);
        setTimeout(scrollToToday, 80);
        toggleUpload();
        document.getElementById("upload-status").textContent = "✅ Dati caricati con successo!";
      } catch (e) {
        alert("Errore nel file JSON: " + e.message);
        document.getElementById("upload-status").textContent = "❌ Errore: " + e.message;
      }
    }

    function clearSavedMemory() {
      if (confirm("Cancellare i turni memorizzati?")) {
        localStorage.removeItem(TURNI_CACHE_KEY);
        try { indexedDB.deleteDatabase(TURNI_CACHE_DB); } catch {}
        location.reload();
      }
    }

    function toggleUpload() {
      const body = document.getElementById("upload-body");
      const icon = document.getElementById("upload-toggle-icon");
      if (body.style.display === "none" || body.style.display === "") {
        body.style.display = "flex";
        icon.textContent = "▲ comprimi";
      } else {
        body.style.display = "none";
        icon.textContent = "▼ espandi";
      }
    }

    function scrollToToday() {
      const wrap = document.getElementById("matrix-scroll-wrap");
      if (!wrap || wrap.style.display === "none") return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let target = dateCalendario.find(cal => {
        const d = new Date(cal.realObj);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      });

      if (!target) {
        target = dateCalendario.find(cal => cal.realObj > today) || dateCalendario[dateCalendario.length - 1];
      }

      const th = document.querySelector(`.date-header th[data-col="${target.col}"]`);
      const fixedCols = document.querySelectorAll(".date-header th:nth-child(1)");
      if (!th) return;
      const fixedWidth = Array.from(fixedCols).reduce((sum, el) => sum + el.offsetWidth, 0);

      const offset = Math.max(0, th.getBoundingClientRect().left + window.scrollX - fixedWidth - 8);
      window.scrollTo({ left:offset, top:window.scrollY, behavior:"auto" });
    }

    // I turni arrivano da Firebase (via NaviSharedData); la copia locale qui
    // sotto resta disponibile offline e per il primo paint immediato.
    const TURNI_CACHE_KEY = "turno_finali_data";
    const TURNI_CACHE_DB = "naviturni-offline";
    const TURNI_CACHE_STORE = "dati";

    function openTurniCacheDb() {
      return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) return reject(new Error("IndexedDB non disponibile"));
        const request = indexedDB.open(TURNI_CACHE_DB, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(TURNI_CACHE_STORE)) db.createObjectStore(TURNI_CACHE_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Archivio locale non disponibile"));
      });
    }

    async function readTurniCache() {
      try {
        const localCopy = localStorage.getItem(TURNI_CACHE_KEY);
        if (localCopy) return localCopy;
      } catch {}
      try {
        const db = await openTurniCacheDb();
        return await new Promise((resolve, reject) => {
          const request = db.transaction(TURNI_CACHE_STORE, "readonly").objectStore(TURNI_CACHE_STORE).get(TURNI_CACHE_KEY);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
      } catch {
        return null;
      }
    }

    async function saveTurniCache(serializedData) {
      try {
        localStorage.setItem(TURNI_CACHE_KEY, serializedData);
      } catch (error) {
        console.warn("Salvataggio rapido dei turni non disponibile.", error);
      }
      try {
        const db = await openTurniCacheDb();
        await new Promise((resolve, reject) => {
          const request = db.transaction(TURNI_CACHE_STORE, "readwrite").objectStore(TURNI_CACHE_STORE).put(serializedData, TURNI_CACHE_KEY);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.warn("Salvataggio persistente dei turni non disponibile.", error);
      }
    }

    function applicaStatoSettimane(weeks) {
      weekStatusMap = new Map(
        (Array.isArray(weeks) ? weeks : [])
          .filter(week => week?.start)
          .map(week => [
            getMondayISO(normalizzaDataISO(week.start)),
            String(week.state || "ufficiale").toLowerCase()
          ])
      );
    }

    async function caricaStatoSettimane() {
      const CACHE_KEY = "naviturni_week_status_cache_v2";
      let cachedWeeks = [];
      try {
        cachedWeeks = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
        applicaStatoSettimane(cachedWeeks);
      } catch (_) {
        cachedWeeks = [];
      }
      try {
        await NaviAdminFirebase.ready;
        const weeks = await NaviAdminFirebase.getWeekStatuses();
        applicaStatoSettimane(weeks);
        localStorage.setItem(CACHE_KEY, JSON.stringify(weeks));
        return true;
      } catch (error) {
        console.warn("Stati settimana Firebase non disponibili; uso la cache locale.", error);
        if (!cachedWeeks.length) weekStatusMap = new Map();
        return cachedWeeks.length > 0;
      }
    }

    async function caricaDatiFirebase(force = false) {
      let localDataShown = false;
      try {
        applicaStatoSettimane(JSON.parse(localStorage.getItem("naviturni_week_status_cache_v2") || "[]"));
      } catch (_) {
        weekStatusMap = new Map();
      }
      const weekStatusBefore = JSON.stringify([...weekStatusMap]);
      // Anche con "Aggiorna" mostra prima la copia salvata: la rete non deve
      // mai far sparire turni già disponibili sul dispositivo.
      const saved = await readTurniCache();

      // Mostra subito l'ultima copia disponibile: l'utente non deve attendere la rete.
      if (saved) {
        try {
          lastLoadedDataSignature = saved;
          processJSONData(JSON.parse(saved));
          localDataShown = true;
          turniFirstRender = false;
          const menuStatus = document.getElementById("turniMenuStatus");
          if (menuStatus) menuStatus.textContent = "Locale";
          document.getElementById("upload-status").textContent = "⚡ Turni aperti dalla memoria locale; controllo aggiornamenti…";
          setTimeout(scrollToToday, 30);
        } catch (e) {
          localStorage.removeItem("turno_finali_data");
          lastLoadedDataSignature = "";
        }
      }

      // Aggiornamento in rete condiviso (base + variazioni admin) tramite
      // NaviSharedData.loadCacheFirst. La copia robusta (turno_finali_data) è
      // già a schermo qui sopra; il callback "stale" serve solo come rete di
      // sicurezza se quella copia mancava o era illeggibile.
      return NaviSharedData.loadCacheFirst((datiJson, { stale }) => {
        const menuStatus = document.getElementById("turniMenuStatus");
        const signature = JSON.stringify(datiJson);
        if (stale) {
          if (localDataShown) return;
          lastLoadedDataSignature = signature;
          processJSONData(datiJson);
          localDataShown = true;
          turniFirstRender = false;
          setTimeout(scrollToToday, 30);
          if (menuStatus) menuStatus.textContent = "Locale";
          document.getElementById("upload-status").textContent = "⚡ Turni aperti dalla memoria locale; controllo aggiornamenti…";
          return;
        }
        if (signature !== lastLoadedDataSignature) {
          lastLoadedDataSignature = signature;
          saveTurniCache(signature).catch(error =>
            console.warn("Salvataggio aggiornato dei turni non disponibile.", error)
          );
          // force = "Aggiorna" manuale: torna alla vista predefinita.
          // Apertura normale dopo il primo paint: aggiornamento "soft" che
          // non tocca residenza/filtro/scroll dell'utente.
          processJSONData(datiJson, { soft: force ? false : !turniFirstRender });
          if (turniFirstRender) {
            setTimeout(scrollToToday, 30);
            turniFirstRender = false;
          }
        }
        // source() === "local": la rete è fallita e loadBase ha restituito la
        // copia salvata come fallback. In quel caso non annunciare "aggiornato".
        const online = NaviSharedData.source() !== "local";
        if (menuStatus) menuStatus.textContent = online ? "Aggiornato" : "Locale";
        document.getElementById("upload-status").textContent = online
          ? "✅ Dati aggiornati — " + new Date().toLocaleTimeString("it-IT")
          : "⚠️ Firebase non raggiungibile — uso i dati salvati";
      }).then(result => {
        // result === null: rete non disponibile ma esisteva una copia locale.
        if (result === null && localDataShown) {
          document.getElementById("upload-status").textContent = "⚠️ Firebase non raggiungibile — uso i dati salvati";
        }
        loadDiariaShiftOverrides();
        // Aggiorna in coda le sole intestazioni se lo stato delle settimane
        // è realmente cambiato (fire-and-forget, come prima).
        caricaStatoSettimane().then(() => {
          if (weekStatusBefore === JSON.stringify([...weekStatusMap]) || !globalData) return;
          inizializzaCalendario();
          buildTableHeader();
          if (currentResidence) renderTable();
        }).catch(() => {});
      }).catch(errore => {
        console.warn("Caricamento da Firebase fallito.", errore);
        if (localDataShown) {
          document.getElementById("upload-status").textContent = "⚠️ Firebase non raggiungibile — uso i dati salvati";
          return;
        }
        const welcomeNotice = document.getElementById("welcome-notice");
        welcomeNotice.classList.add("is-error");
        welcomeNotice.innerHTML = `<h3>⚠️ Dati non disponibili</h3><p>Non è stato possibile caricare i turni. Riprova con il pulsante Aggiorna.</p>`;
        welcomeNotice.style.display = "block";
        document.getElementById("upload-status").textContent = "❌ Impossibile caricare i dati: " + (errore?.message || errore);
      });
    }

    function ricaricaDati() {
      const btn = document.getElementById("refreshBtn");
      const testoOriginale = btn.textContent;
      btn.textContent = "🔄 Aggiorno...";
      btn.disabled = true;
      NaviSharedData.clear();
      caricaDatiFirebase(true).finally(() => {
        btn.textContent = testoOriginale;
        btn.disabled = false;
      });
    }

    window.addEventListener("navisuite-draft-period-updated", () => {
      if (!globalData) return;
      inizializzaCalendario();
      buildTableHeader();
      renderTable();
      setTimeout(scrollToToday, 30);
    });

    window.addEventListener("DOMContentLoaded", () => {
      loggedAgentProfile = readLoggedAgentProfile();
      if (!loggedAgentProfile) {
        location.replace("index.html");
        return;
      }
      // Chiede al browser di non eliminare automaticamente i dati offline
      // quando deve liberare spazio. Se non supportato, la cache resta attiva.
      navigator.storage?.persist?.().catch(() => {});
      document.getElementById("login-overlay").classList.remove("open");
      restrictBaristaInterface();
      const dayPanel = document.getElementById("day-panel");
      dayPanel.classList.remove("open");
      dayPanel.setAttribute("aria-hidden", "true");
      document.body.classList.remove("crew-drawer-open", "crew-drawer-main", "crew-drawer-coverage");
      document.documentElement.style.setProperty("--crew-drawer-offset", "0px");
      const menuButton = document.getElementById("turni-menu-button");
      if (menuButton) {
        menuButton.addEventListener("click", () => {
          const open = document.body.classList.toggle("turni-menu-open");
          menuButton.setAttribute("aria-expanded", String(open));
        });
      }
      document.getElementById("turni-sidebar").addEventListener("click", event => {
        if (event.target.closest("a") && window.innerWidth <= 800) {
          document.body.classList.remove("turni-menu-open");
          if (menuButton) menuButton.setAttribute("aria-expanded", "false");
        }
      });
      function showCrewHoverTooltip(td, e) {
        document.querySelector(".crew-hover-tooltip")?.remove();
        const col = parseInt(td.dataset.col, 10);
        const cal = dateCalendario.find(item => item.col === col);
        if (!cal) return;
        const dayIndex = (cal.col - 3) % 7;
        const weekKey = cal.weekKey;
        const rowAgent = getAgentForTableRow(td.closest("tr"));
        if (!rowAgent) return;
        const hoveredShift = ottieniTurnoPulito(getAgentShiftOnDate(rowAgent, cal.iso));
        if (!getShiftResidence(hoveredShift)) return;
        const loggedAgent = getLoggedAgentLocation()?.agent;
        const crew = [];
        trElements.forEach(tr => {
          const agent = getAgentForTableRow(tr);
          if (!agent) return;
          const rawShift = getAgentShiftOnDate(agent, cal.iso);
          if (!isSameCrewShift(rawShift, hoveredShift)) return;
          crew.push(agent);
        });
        if (!crew.length) return;
        const gradeRank = gradeRankMap;
        crew.sort((a, b) => {
          const rankA = gradeRank[getGradeClass(a.id, a.agente, a.qualifica)] || 99;
          const rankB = gradeRank[getGradeClass(b.id, b.agente, b.qualifica)] || 99;
          return rankA - rankB || String(a.agente).localeCompare(String(b.agente), "it");
        });
        const box = document.createElement("div");
        box.className = "crew-hover-tooltip";
        crew.forEach(agent => {
          const name = document.createElement("div");
          name.className = "crew-hover-name" + (loggedAgent && agent.agente === loggedAgent.agente ? " is-logged" : "");
          name.textContent = agent.agente;
          const gradeClass = getGradeClass(agent.id, agent.agente, agent.qualifica);
          name.style.color = gradeClass === "grado-marinaio" ? "#ffffff" : (gradeInfo[gradeClass]?.color || "#e8f3f6");
          box.appendChild(name);
        });
        document.body.appendChild(box);
        const gap = 12;
        const rect = box.getBoundingClientRect();
        let left = e.clientX + gap;
        let top = e.clientY + gap;
        if (left + rect.width > innerWidth - 8) left = e.clientX - rect.width - gap;
        if (top + rect.height > innerHeight - 8) top = e.clientY - rect.height - gap;
        box.style.left = Math.max(8, left) + "px";
        box.style.top = Math.max(8, top) + "px";
      }
      document.addEventListener("mouseover", e => {
        const td = e.target.closest?.("#tbody td[data-col]");
        if (!td || td.contains(e.relatedTarget)) return;
        showCrewHoverTooltip(td, e);
      }, true);
      document.addEventListener("mouseout", e => {
        const td = e.target.closest?.("#tbody td[data-col]");
        if (!td || td.contains(e.relatedTarget)) return;
        document.querySelector(".crew-hover-tooltip")?.remove();
      }, true);
      setupSynchronizedTableScrolls();
      // Prima leggiamo NAVI_SETTIMANE, poi disegniamo i turni: evita che
      // l'indicazione BOZZA scompaia per una condizione di gara.
      caricaDatiFirebase().catch(() => {
        // Gli errori sono gestiti dentro la funzione.
      });
    });
