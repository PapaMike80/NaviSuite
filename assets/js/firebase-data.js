import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-assets/js/app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getDatabase, get, push, ref, remove, set, update } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBfJZWHjr3AIANDBj2p8uQ0_hbcHdmnSiE",
  authDomain: "navisuite-f116f.firebaseapp.com",
  projectId: "navisuite-f116f",
  storageBucket: "navisuite-f116f.firebasestorage.app",
  messagingSenderId: "176918789311",
  appId: "1:176918789311:web:ecd2236ccbe978218f1a0a",
  measurementId: "G-XNW4SVGDTY",
  databaseURL: "https://navisuite-f116f-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const ready = new Promise((resolve, reject) => {
  let settled = false;
  const finish = user => {
    if (settled || !user) return;
    settled = true;
    resolve(user);
  };
  onAuthStateChanged(auth, user => {
    if (user) finish(user);
    else signInAnonymously(auth).then(result => finish(result.user)).catch(reject);
  }, reject);
});

function normalizeRequest(id, value) {
  return { ...(value || {}), id:String(value?.id || id) };
}

async function listChangeRequests(agentId) {
  await ready;
  const [snapshot, deletedSnapshot] = await Promise.all([
    get(ref(database, "private/changeRequests")),
    get(ref(database, "private/adminUpdates/deletedChangeRequests"))
  ]);
  const data = snapshot.val() || {};
  const deletedData = deletedSnapshot.val() || {};
  const deleted = new Set(Object.entries(deletedData).flatMap(([id, value]) => [String(id), String(value?.requestId || "")]).filter(Boolean));
  const target = String(agentId || "");
  return Object.entries(data)
    .map(([id, value]) => normalizeRequest(id, value))
    .filter(item => !deleted.has(String(item.id)))
    .filter(item => !target || String(item.agentId || "") === target || String(item.colleagueId || "") === target)
    .sort((a, b) => String(b.sentAt || "").localeCompare(String(a.sentAt || "")));
}

async function saveChangeRequest(payload) {
  const user = await ready;
  const target = push(ref(database, "private/changeRequests"));
  const item = {
    ...payload,
    action:undefined,
    id:target.key,
    ownerUid:user.uid,
    sentAt:payload?.sentAt || new Date().toISOString()
  };
  Object.keys(item).forEach(key => item[key] === undefined && delete item[key]);
  await set(target, item);
  return normalizeRequest(target.key, item);
}

async function deleteChangeRequest(requestId) {
  await ready;
  const id = String(requestId);
  try {
    await remove(ref(database, `private/changeRequests/${id}`));
  } catch (error) {
    if (!/permission/i.test(String(error?.message || ""))) throw error;
    const safeId = id.replace(/[.#$\[\]/]/g, "_");
    await set(ref(database, `private/adminUpdates/deletedChangeRequests/${safeId}`), {
      requestId:id,
      deletedAt:new Date().toISOString()
    });
  }
  return true;
}

async function getAdminUpdates() {
  const user = await ready;
  const snapshot = await get(ref(database, "private/adminUpdates"));
  const value = snapshot.val() || {};
  return {
    ownerUid:String(value.ownerUid || ""),
    currentUid:user.uid,
    updatedAt:String(value.updatedAt || ""),
    odsVariations:Array.isArray(value.odsVariations) ? value.odsVariations : Object.values(value.odsVariations || {}),
    manualVariations:Array.isArray(value.manualVariations) ? value.manualVariations : Object.values(value.manualVariations || {}),
    baristas:Array.isArray(value.baristas) ? value.baristas : Object.values(value.baristas || {}),
    approvedChangeRequests:Array.isArray(value.approvedChangeRequests) ? value.approvedChangeRequests : Object.values(value.approvedChangeRequests || {}),
    dismissedOdsApprovals:Array.isArray(value.dismissedOdsApprovals) ? value.dismissedOdsApprovals : Object.values(value.dismissedOdsApprovals || {}),
    scheduleImports:Array.isArray(value.scheduleImports) ? value.scheduleImports : Object.values(value.scheduleImports || {})
    ,agentProfiles:value.agentProfiles || {}
  };
}

async function saveAdminUpdates(payload = {}) {
  const user = await ready;
  const target = ref(database, "private/adminUpdates");
  const item = {
    ownerUid:String(user.uid),
    updatedAt:new Date().toISOString(),
    odsVariations:Array.isArray(payload.odsVariations) ? payload.odsVariations : [],
    manualVariations:Array.isArray(payload.manualVariations) ? payload.manualVariations : [],
    baristas:Array.isArray(payload.baristas) ? payload.baristas : [],
    approvedChangeRequests:Array.isArray(payload.approvedChangeRequests) ? payload.approvedChangeRequests : [],
    dismissedOdsApprovals:Array.isArray(payload.dismissedOdsApprovals) ? payload.dismissedOdsApprovals : [],
    scheduleImports:Array.isArray(payload.scheduleImports) ? payload.scheduleImports : []
  };
  await update(target, item);
  return { ...item, currentUid:user.uid };
}

window.NaviFirebase = {
  ready,
  listChangeRequests,
  saveChangeRequest,
  deleteChangeRequest,
  getAdminUpdates,
  saveAdminUpdates,
  provider:"Firebase"
};
