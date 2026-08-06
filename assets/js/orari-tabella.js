(() => {
  const shared = window.NaviOrarioShared || {};
  const STORAGE_KEY = shared.OVERRIDES_STORAGE_KEY || "navi.orari.tabella.overrides.v1";
  const shiftColorMap = shared.SHIFT_COLOR_MAP || {
    D1: "#3b82f6", D2: "#10b981", D3: "#f97316", D4: "#d946ef",
    P1: "#06b6d4", P2: "#84cc16", P3: "#ef4444", CAP1: "#a78bfa",
    SR1: "#eab308", T1: "#2563eb", T2: "#14b8a6", M1: "#f59e0b",
    R1: "#8b5cf6", R2: "#22c55e", R3: "#f43f5e", R4: "#ec4899",
    CAR1: "#64748b"
  };
  const defaultShiftColor = shared.DEFAULT_SHIFT_COLOR || "#38d6bf";
  const tablesRoot = document.getElementById("tablesRoot");
  const editStatus = document.getElementById("editStatus");
  const saveButton = document.getElementById("saveChanges");
  const exportButton = document.getElementById("exportChanges");
  const importButton = document.getElementById("importChanges");
  const importFile = document.getElementById("importFile");
  const resetButton = document.getElementById("resetChanges");
  const storageService = window.NaviStorageService || {
    fetchTableEdits: async () => {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      } catch {
        return {};
      }
    },
    saveTableEdits: async (data) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {}));
      return {ok: true};
    }
  };
  let baseData = null;
  let overrides = {};

  function loadOverrides() {
    return shared.loadOverrides ? shared.loadOverrides() : (() => {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      } catch {
        return {};
      }
    })();
  }

  async function saveOverrides() {
    await storageService.saveTableEdits(overrides);
    updateStatus("Modifiche salvate (mock cloud). Il grafico Orario le leggerà dal cache locale.");
  }

  function updateStatus(message, isError = false) {
    editStatus.textContent = message;
    editStatus.style.color = isError ? "#fecaca" : "#a7f3e8";
    editStatus.style.borderColor = isError ? "rgba(239,68,68,.32)" : "rgba(56,214,191,.22)";
    editStatus.style.background = isError ? "rgba(239,68,68,.08)" : "rgba(56,214,191,.08)";
  }

  const formatTime = shared.formatTime
    ? (minutes) => shared.formatTime(minutes, "")
    : function(minutes) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
    };

  const numericRace = shared.numericRace
    ? (value) => shared.numericRace(value, 9999)
    : function(value) {
      const parsed = parseInt(String(value), 10);
      return Number.isNaN(parsed) ? 9999 : parsed;
    };

  async function loadOrarioData() {
    try {
      const dataset = window.NaviOrarioDataset?.data;
      console.log("Dati ricevuti dalla tabella:", dataset);
      if (!dataset) throw new Error("Dati orario non caricati.");
      return JSON.parse(JSON.stringify(dataset));
    } catch (error) {
      console.error("[orari-tabella] Errore nel loadOrarioData:", error);
      throw error;
    }
  }

  function getServices(direction) {
    return baseData.services
      .filter((service) => service.d === direction)
      .slice()
      .sort((a, b) => {
        const diff = (a.p[0]?.[1] || 0) - (b.p[0]?.[1] || 0);
        return diff || numericRace(a.r) - numericRace(b.r);
      });
  }

  function keyFor(direction, race, stopIndex) {
    return direction + "|" + race + "|" + stopIndex;
  }

  function getCellValue(direction, service, stopIndex) {
    const key = keyFor(direction, service.r, stopIndex);
    if (Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key];
    const point = service.p.find(([stop]) => stop === stopIndex);
    return point ? formatTime(point[1]) : "";
  }

  function sanitizeCellValue(value) {
    const cleaned = String(value || "").trim().replace(/\s+/g, "");
    if (!cleaned) return "";
    if (cleaned === "|" || cleaned === "====" || cleaned === "-----" || cleaned === "—") return cleaned;
    const normalized = cleaned.replace(".", ":");
    const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return cleaned.toUpperCase();
    return match[1].padStart(2, "0") + ":" + match[2];
  }

  function renderTable(direction, title, subtitle) {
    const services = getServices(direction);
    const stopIndexes = baseData.stops.map((_, index) => index);
    const orderedStops = direction === "N" ? stopIndexes : stopIndexes.slice().reverse();
    const section = document.createElement("section");
    section.className = "table-card";
    section.innerHTML =
      '<div class="table-head">' +
        '<div><h2>' + title + '</h2><p>' + subtitle + "</p></div>" +
        '<div class="status">' + services.length + ' corse</div>' +
      "</div>" +
      '<div class="scroll-wrap"><table></table></div>';
    const table = section.querySelector("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const stopHead = document.createElement("th");
    stopHead.className = "stop-col";
    stopHead.textContent = "Fermata";
    headRow.appendChild(stopHead);
    services.forEach((service) => {
      const th = document.createElement("th");
      const color = shiftColorMap[service.s] || defaultShiftColor;
      th.className = "race-col";
      th.style.setProperty("--col-color", color);
      th.style.borderBottomColor = color;
      th.innerHTML =
        '<div class="race-head">' +
          '<span class="race-code">' + service.r + "</span>" +
          '<span class="race-shift" style="background:' + color + '22;color:' + color +
            ';border:1px solid ' + color + '55">' + service.s + "</span>" +
        "</div>";
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    orderedStops.forEach((stopIndex) => {
      const tr = document.createElement("tr");
      const stopCell = document.createElement("td");
      stopCell.className = "stop-col";
      stopCell.innerHTML =
        '<div class="stop-name"><span class="stop-index">' +
        String(stopIndex + 1).padStart(2, "0") +
        "</span><span>" +
        baseData.stops[stopIndex] +
        "</span></div>";
      tr.appendChild(stopCell);

      services.forEach((service) => {
        const td = document.createElement("td");
        const color = shiftColorMap[service.s] || defaultShiftColor;
        const key = keyFor(direction, service.r, stopIndex);
        const value = getCellValue(direction, service, stopIndex);
        td.className = "time-cell" + (value ? "" : " empty") +
          (Object.prototype.hasOwnProperty.call(overrides, key) ? " edited" : "");
        td.style.setProperty("--col-color", color);
        td.dataset.key = key;
        td.dataset.original = service.p.find(([stop]) => stop === stopIndex)?.[1] != null
          ? formatTime(service.p.find(([stop]) => stop === stopIndex)[1])
          : "";
        td.textContent = value;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return section;
  }

  function render() {
    try {
      if (!tablesRoot) throw new Error("Container tabella non trovato (#tablesRoot).");
      if (!baseData || !Array.isArray(baseData.services) || !Array.isArray(baseData.stops)) {
        throw new Error("Dataset tabella incompleto o non valido.");
      }
      console.log("[orari-tabella] Render start", {
        stops: baseData.stops.length,
        services: baseData.services.length,
        overrides: Object.keys(overrides || {}).length
      });
      tablesRoot.innerHTML = "";
      tablesRoot.appendChild(renderTable("N", "Verso nord", "Desenzano → Peschiera → Riva del Garda"));
      tablesRoot.appendChild(renderTable("S", "Verso sud", "Riva del Garda → Peschiera → Desenzano"));
      console.log("[orari-tabella] Render completato");
    } catch (error) {
      console.error("[orari-tabella] Errore durante render():", error);
      updateStatus(error.message || "Errore durante il rendering della tabella.", true);
    }
  }

  function startEditing(cell) {
    if (!cell || !cell.dataset.key) return;
    cell.contentEditable = "true";
    cell.classList.add("is-editing");
    cell.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(cell);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function finishEditing(cell) {
    if (!cell || !cell.dataset.key) return;
    cell.contentEditable = "false";
    cell.classList.remove("is-editing");
    const value = sanitizeCellValue(cell.textContent);
    const original = cell.dataset.original || "";
    cell.textContent = value;
    cell.classList.toggle("empty", !value);
    if (value === original) {
      delete overrides[cell.dataset.key];
      cell.classList.remove("edited");
    } else {
      overrides[cell.dataset.key] = value;
      cell.classList.add("edited");
    }
    updateStatus("Modifica pronta. Premi “Salva locale” per riusarla anche nel grafico su questo browser.");
  }

  if (tablesRoot) {
    tablesRoot.addEventListener("dblclick", (event) => {
      const cell = event.target.closest(".time-cell");
      if (!cell) return;
      startEditing(cell);
    });

    tablesRoot.addEventListener("blur", (event) => {
      const cell = event.target.closest(".time-cell");
      if (!cell) return;
      finishEditing(cell);
    }, true);

    tablesRoot.addEventListener("keydown", (event) => {
      const cell = event.target.closest(".time-cell");
      if (!cell || !cell.isContentEditable) return;
      if (event.key === "Enter") {
        event.preventDefault();
        cell.blur();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cell.textContent = Object.prototype.hasOwnProperty.call(overrides, cell.dataset.key)
          ? overrides[cell.dataset.key]
          : (cell.dataset.original || "");
        cell.blur();
      }
    });
  }

  if (saveButton) {
    saveButton.addEventListener("click", async () => {
      try {
        await saveOverrides();
      } catch (error) {
        console.error("[orari-tabella] Errore salvataggio modifiche:", error);
        updateStatus(error.message || "Impossibile salvare le modifiche.", true);
      }
    });
  }

  if (exportButton) {
    exportButton.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(overrides, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orari-tabella-modifiche.json";
    a.click();
    URL.revokeObjectURL(url);
    updateStatus("File JSON delle modifiche esportato.");
    });
  }

  if (importButton && importFile) {
    importButton.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", async () => {
      const file = importFile.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        overrides = imported && typeof imported === "object" ? imported : {};
        await saveOverrides();
        render();
        updateStatus("Modifiche importate. Anche il grafico le userà su questo browser.");
      } catch (error) {
        console.error("[orari-tabella] Errore import JSON:", error);
        updateStatus("File JSON non valido.", true);
      }
      importFile.value = "";
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", async () => {
      try {
        overrides = {};
        await storageService.saveTableEdits(overrides);
        render();
        updateStatus("Modifiche ripristinate.");
      } catch (error) {
        console.error("[orari-tabella] Errore reset modifiche:", error);
        updateStatus("Impossibile ripristinare le modifiche.", true);
      }
    });
  }

  async function initializeTablePage() {
    try {
      baseData = await loadOrarioData();
      overrides = await storageService.fetchTableEdits();
      console.log("[orari-tabella] Overrides caricati:", overrides);
      render();
      updateStatus("Orari caricati. Doppio clic su una cella per modificarla. I colori seguono i turni del grafico.");
    } catch (error) {
      console.error("[orari-tabella] Errore inizializzazione tabella:", error);
      updateStatus(error.message || "Errore nel caricamento orari.", true);
    }
  }

  initializeTablePage();
})();
