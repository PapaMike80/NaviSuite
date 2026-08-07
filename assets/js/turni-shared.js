window.TurniShared = (() => {
  const storageKey = "naviturni_logged_agent";
  const mobileDoubleTapMs = 340;
  const mobileTapMoveTolerance = 12;
  const mobilePointerGestures = new WeakMap();
  let lastMobilePointerUpAt = 0;
  let mobileTapTimer = null;
  let mobileTapTarget = null;
  let mobileTapAt = 0;

  function beginMobileTapGesture(target, event) {
    if (event.pointerType !== "touch") return;
    mobilePointerGestures.set(target, {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    });
  }

  function updateMobileTapGesture(target, event) {
    const gesture = mobilePointerGestures.get(target);
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const movedX = Math.abs(event.clientX - gesture.startX);
    const movedY = Math.abs(event.clientY - gesture.startY);
    if (movedX > mobileTapMoveTolerance || movedY > mobileTapMoveTolerance) gesture.moved = true;
  }

  function finishMobileTapGesture(target, event) {
    const gesture = mobilePointerGestures.get(target);
    mobilePointerGestures.delete(target);
    return Boolean(gesture && gesture.pointerId === event.pointerId && !gesture.moved);
  }

  function cancelMobileTapGesture(target) {
    mobilePointerGestures.delete(target);
  }

  function handleMobileTap(target, singleTapAction, doubleTapAction) {
    const now = Date.now();
    lastMobilePointerUpAt = now;
    const isDoubleTap = mobileTapTarget === target && (now - mobileTapAt) <= mobileDoubleTapMs;

    if (isDoubleTap) {
      if (mobileTapTimer) clearTimeout(mobileTapTimer);
      mobileTapTimer = null;
      mobileTapTarget = null;
      mobileTapAt = 0;
      doubleTapAction?.();
      return;
    }

    if (mobileTapTimer) {
      clearTimeout(mobileTapTimer);
      mobileTapTimer = null;
    }
    mobileTapTarget = target;
    mobileTapAt = now;
    mobileTapTimer = setTimeout(() => {
      mobileTapTimer = null;
      mobileTapTarget = null;
      mobileTapAt = 0;
      singleTapAction?.();
    }, mobileDoubleTapMs);
  }

  function isSyntheticClickAfterTouch() {
    return Date.now() - lastMobilePointerUpAt < 650;
  }

  function readLoggedAgentProfile() {
    try {
      return JSON.parse(
        localStorage.getItem(storageKey) ||
        localStorage.getItem("navidiaria.activeAgent") ||
        "null"
      );
    } catch (error) {
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  function isBaristaProfile(profile) {
    return String(profile?.role || "").toLowerCase() === "barista" ||
      String(profile?.qualifica || "").toLowerCase() === "barista";
  }

  function isOfficeProfile(profile) {
    if (String(profile?.residence || "").toLowerCase() === "uffici") return true;
    return ["movimento","amministrazione","personale","controllo","direzione"]
      .includes(String(profile?.qualifica || "").toLowerCase());
  }

  function getBaristaProfileId(record, name) {
    if (record?.id) return String(record.id);
    return `BARISTA_${String(name || "")
      .toLocaleUpperCase("it")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")}`;
  }

  return Object.freeze({
    beginMobileTapGesture,
    updateMobileTapGesture,
    finishMobileTapGesture,
    cancelMobileTapGesture,
    handleMobileTap,
    isSyntheticClickAfterTouch,
    readLoggedAgentProfile,
    isBaristaProfile,
    isOfficeProfile,
    getBaristaProfileId
  });
})();
