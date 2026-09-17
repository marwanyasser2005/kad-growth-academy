const DB_NAME = "kad_growth_v2";
const DB_VERSION = 2;
const STORES = ["profile","preferences","lessonProgress","videoProgress","quizAttempts","reflections","notes","bookmarks","practices","assessments","capstone","achievements","contentOverrides","metadata"];
function backend() {
  try { return globalThis.indexedDB || null; } catch { return null; }
}
function openDb() {
  return new Promise((resolve,reject)=>{
    const idb = backend();
    if(!idb){ reject(new Error("IndexedDB is unavailable")); return; }
    let request;
    try { request = idb.open(DB_NAME, DB_VERSION); } catch(error){ reject(error); return; }
    request.onupgradeneeded = ()=>{
      const db = request.result;
      for(const name of STORES){ if(!db.objectStoreNames.contains(name)) db.createObjectStore(name); }
    };
    request.onsuccess = ()=>resolve(request.result);
    request.onerror = ()=>reject(request.error || new Error("IndexedDB open failed"));
  });
}
function tx(db, mode) {
  return STORES.map(name=>db.transaction(name, mode).objectStore(name));
}
export async function idbAvailable() {
  try { await openDb(); return true; } catch { return false; }
}
export async function idbWriteState(state) {
  const db = await openDb();
  const snapshot = JSON.parse(JSON.stringify(state));
  const parts = {
    profile: snapshot.profile, preferences: {language:snapshot.language,reducedMotion:snapshot.reducedMotion,highContrast:snapshot.highContrast,theme:snapshot.theme},
    lessonProgress: snapshot.progress, videoProgress: snapshot.progress, quizAttempts: snapshot.quizDrafts,
    reflections: snapshot.progress, notes: snapshot.notes, bookmarks: snapshot.saved, practices: snapshot.practices,
    assessments: snapshot.assessments, capstone: snapshot.capstone, achievements: {awards:snapshot.achievements||[]},
    contentOverrides: {content:snapshot.contentOverrides,questions:snapshot.questionOverrides,flags:snapshot.lessonFlags},
    metadata: {updatedAt:snapshot.updatedAt,schemaVersion:snapshot.schemaVersion,deviceProfileId:snapshot.deviceProfileId||null,migratedFrom:snapshot.migratedFrom||null,lastLesson:snapshot.lastLesson||null,issues:snapshot.issues||[]}
  };
  await Promise.all(Object.entries(parts).map(([store,value])=>new Promise((resolve,reject)=>{
    try {
      const put = db.transaction(store,"readwrite").objectStore(store).put(value,"state");
      put.onsuccess = ()=>resolve(); put.onerror = ()=>reject(put.error||new Error("write failed"));
    } catch(error){ reject(error); }
  })));
  try { db.close(); } catch {}
  return true;
}
export async function idbReadMetadata() {
  const db = await openDb();
  const value = await new Promise((resolve,reject)=>{
    try {
      const get = db.transaction("metadata","readonly").objectStore("metadata").get("state");
      get.onsuccess = ()=>resolve(get.result||null); get.onerror = ()=>reject(get.error||new Error("read failed"));
    } catch(error){ reject(error); }
  });
  try { db.close(); } catch {}
  return value;
}
export async function requestPersistence() {
  try {
    const storage = globalThis.navigator?.storage;
    if(!storage) return {supported:false,persisted:null};
    let persisted = null;
    try { persisted = await storage.persisted(); } catch {}
    if(!persisted){
      try { persisted = await storage.persist(); } catch { persisted = false; }
    }
    return {supported:true,persisted:persisted??null};
  } catch { return {supported:false,persisted:null}; }
}
export async function storageHealth() {
  const health = {indexedDB:false,version:DB_VERSION,persisted:null,persistSupported:false,estimate:null,lastSave:null};
  try {
    const meta = await idbReadMetadata();
    health.indexedDB = true;
    health.lastSave = meta?.updatedAt || null;
  } catch { health.indexedDB = false; }
  const persist = await requestPersistence();
  health.persistSupported = persist.supported;
  health.persisted = persist.persisted;
  try {
    const estimate = await globalThis.navigator?.storage?.estimate?.();
    if(estimate) health.estimate = {quota:estimate.quota??null,usage:estimate.usage??null};
  } catch {}
  return health;
}
export const IDB_INFO = {dbName:DB_NAME,version:DB_VERSION,stores:STORES};
