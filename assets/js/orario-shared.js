(() => {
  const OVERRIDES_STORAGE_KEY = "navi.orari.tabella.overrides.v1";
  const DEFAULT_SHIFT_COLOR = "#38d6bf";
  const SHIFT_COLOR_MAP = Object.freeze({
    D1: "#3b82f6", D2: "#10b981", D3: "#f97316", D4: "#d946ef",
    P1: "#06b6d4", P2: "#84cc16", P3: "#ef4444", CAP1: "#a78bfa",
    SR1: "#eab308", T1: "#2563eb", T2: "#14b8a6", M1: "#f59e0b",
    R1: "#8b5cf6", R2: "#22c55e", R3: "#f43f5e", R4: "#ec4899",
    CAR1: "#64748b"
  });

  function parseOverrideTime(value) {
    const normalized = String(value || "").trim().replace(".", ":");
    const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }

  function loadOverrides() {
    try {
      if (typeof window === "undefined" || !window.localStorage) return {};
      const raw = window.localStorage.getItem(OVERRIDES_STORAGE_KEY);
      if (!raw || raw === "null") return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function formatTime(minutes, fallback = "--:--") {
    if (minutes == null || Number.isNaN(minutes)) return fallback;
    const wholeMinutes = Number(minutes);
    return String(Math.floor(wholeMinutes / 60)).padStart(2, "0") + ":" +
      String(wholeMinutes % 60).padStart(2, "0");
  }

  function numericRace(value, fallback = 9999) {
    const parsed = parseInt(String(value), 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  window.NaviOrarioShared = Object.freeze({
    OVERRIDES_STORAGE_KEY,
    DEFAULT_SHIFT_COLOR,
    SHIFT_COLOR_MAP,
    parseOverrideTime,
    loadOverrides,
    formatTime,
    numericRace
  });
})();
