(() => {
  const shared = window.NaviOrarioShared || {};
  const STORAGE_KEY = shared.OVERRIDES_STORAGE_KEY || "navi.orari.tabella.overrides.v1";
  const MOCK_NETWORK_DELAY_MS = 350;

  function safeRead() {
    try {
      if (typeof window === "undefined" || !window.localStorage) return {};
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw || raw === "null") return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      console.error("[storageService] Errore lettura local cache:", error);
      return {};
    }
  }

  function safeWrite(payload) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("[storageService] Errore scrittura local cache:", error);
    }
  }

  async function fetchTableEdits() {
    console.log("[storageService] fetchTableEdits -> mock network request");
    return new Promise((resolve) => {
      setTimeout(() => {
        const data = safeRead();
        console.log("[storageService] fetchTableEdits <- mock response", data);
        resolve(data);
      }, MOCK_NETWORK_DELAY_MS);
    });
  }

  async function saveTableEdits(data) {
    const payload = data && typeof data === "object" ? data : {};
    console.log("[storageService] saveTableEdits -> mock network payload", payload);
    return new Promise((resolve) => {
      setTimeout(() => {
        safeWrite(payload);
        console.log("[storageService] saveTableEdits <- mock response ok");
        resolve({ok: true, savedKeys: Object.keys(payload).length});
      }, MOCK_NETWORK_DELAY_MS);
    });
  }

  window.NaviStorageService = Object.freeze({
    fetchTableEdits,
    saveTableEdits
  });
})();
