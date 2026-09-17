import {checksumString} from "./engine.mjs";
export const STORAGE_KEY = "kad-growth.open.v1";
export const SCHEMA_VERSION = 2;
function deviceId() {
  try {
    const crypto = globalThis.crypto;
    if(crypto?.randomUUID) return crypto.randomUUID();
  } catch {}
  return `device-${Date.now().toString(36)}-${Math.random().toString(16).slice(2,10)}`;
}
export function freshState() {
  return {
    schemaVersion:SCHEMA_VERSION, updatedAt:null,
    deviceProfileId:deviceId(), migratedFrom:null, migrationAudit:[],
    profile:{name:"",department:"",role:"",weeklyGoal:90},
    language:null, reducedMotion:false, highContrast:false, theme:"system",
    progress:{}, quizDrafts:{}, notes:[], saved:[], assessments:{}, unitProgress:{},
    practices:{}, toolValues:{}, capstone:{fields:{},status:"draft"},
    issues:[], contentOverrides:{}, questionOverrides:{}, lastLesson:null,
    lessonFlags:{}
  };
}
export function migrateV1toV2(data) {
  const base = freshState();
  const migrated = {...base,...data,schemaVersion:SCHEMA_VERSION,profile:{...base.profile,...(data.profile||{})},capstone:{...base.capstone,...(data.capstone||{})}};
  migrated.migratedFrom = migrated.migratedFrom || "kad-growth.open.v1";
  // Manual viewing credit ends at v2: verified playback coverage is the only
  // viewing evidence. Quiz attempts, reflections, notes, and practices are
  // preserved untouched; affected lessons simply return to "viewing remaining".
  let grandfathered = 0;
  for(const p of Object.values(migrated.progress||{})) {
    if(p && typeof p==="object" && p.selfConfirmed){ p.selfConfirmed = false; grandfathered++; }
  }
  migrated.migrationAudit = [...(Array.isArray(data.migrationAudit)?data.migrationAudit:[]),{at:new Date().toISOString(),from:"kad-growth.open.v1",to:"schema-2",grandfatheredSelfConfirmations:grandfathered,note:"Manual viewing credit removed. All attempts, reflections, notes, and practices preserved."}];
  return migrated;
}
export let storageStatus = {available:true,message:""};
export function loadState(storage = null) {
  try {
    storage = storage ?? globalThis.localStorage;
    const raw = storage?.getItem(STORAGE_KEY);
    if (!storage) throw new Error("Storage is unavailable");
    if (!raw) return freshState();
    return validateImport(JSON.parse(raw));
  } catch (error) {
    storageStatus = {available:false,message:"Stored data could not be read. The original entry has not been deleted."};
    return freshState();
  }
}
export function saveState(value,storage = null) {
  value.updatedAt = new Date().toISOString();
  try {
    storage = storage ?? globalThis.localStorage;
    if(!storage) throw new Error("Storage is unavailable");
    if(!storageStatus.available) return false;
    storage.setItem(STORAGE_KEY,JSON.stringify(value));
    return true;
  } catch {
    storageStatus = {available:false,message:"Changes are in memory only. Export a backup before leaving."};
    return false;
  }
}
export function validateImport(data) {
  const isObject = v=>v!==null && typeof v==="object" && !Array.isArray(v);
  const fail=()=>{throw new Error("Invalid or unsupported KAD backup");};
  if (!isObject(data) || (data.schemaVersion!==1 && data.schemaVersion!==SCHEMA_VERSION)) fail();
  if(data.schemaVersion===1) data = migrateV1toV2(data);
  if(data.checksum!==undefined||data.exportedAt!==undefined){
    const {checksum,exportedAt,...rest}=data;
    if(checksum!==undefined){
      const recomputed=checksumString({schemaVersion:rest.schemaVersion,progress:rest.progress,notes:rest.notes,saved:rest.saved,practices:rest.practices,capstone:rest.capstone,deviceProfileId:rest.deviceProfileId});
      if(recomputed!==checksum) fail();
    }
    data=rest;
  }
  const encoded=JSON.stringify(data);
  if(encoded.length>6000000 || /"(__proto__|prototype|constructor)"\s*:/.test(encoded)) fail();
  const base=freshState();
  const allowed = [...Object.keys(base),"achievements"];
  if(Object.keys(data).some(k=>!allowed.includes(k))) fail();
  for(const key of ["profile","progress","quizDrafts","assessments","unitProgress","practices","toolValues","capstone","contentOverrides","questionOverrides","lessonFlags"]) {
    if(data[key]!==undefined && !isObject(data[key])) fail();
  }
  for(const key of ["notes","saved","issues","migrationAudit"]) if(data[key]!==undefined && !Array.isArray(data[key])) fail();
  if(data.language!==undefined && data.language!==null && !["ar","en"].includes(data.language)) fail();
  for(const key of ["theme"]) if(data[key]!==undefined && !["system","light","dark"].includes(data[key])) fail();
  if(data.profile) {
    if(Object.keys(data.profile).some(k=>!["name","department","role","weeklyGoal"].includes(k))) fail();
    for(const k of ["name","department","role"]) if(data.profile[k]!==undefined && (typeof data.profile[k]!=="string" || data.profile[k].length>200)) fail();
    if(data.profile.weeklyGoal!==undefined && (!Number.isFinite(data.profile.weeklyGoal)||data.profile.weeklyGoal<15||data.profile.weeklyGoal>600)) fail();
  }
  for(const id of data.saved||[]) if(typeof id!=="string"||id.length>100) fail();
  for(const p of Object.values(data.progress||{})) {
    if(!isObject(p)) fail();
    if(p.duration!==undefined&&(!Number.isFinite(p.duration)||p.duration<0||p.duration>200000)) fail();
    if(p.watched!==undefined&&(!Array.isArray(p.watched)||p.watched.length>200000||p.watched.some(n=>!Number.isInteger(n)||n<0||n>200000))) fail();
    if(p.bestScore!==undefined&&(!Number.isFinite(p.bestScore)||p.bestScore<0||p.bestScore>100)) fail();
    if(p.reflection!==undefined&&(typeof p.reflection!=="string"||p.reflection.length>20000)) fail();
    if(p.selfConfirmed!==undefined&&typeof p.selfConfirmed!=="boolean") fail();
    if(p.attempts!==undefined&&(!Array.isArray(p.attempts)||p.attempts.some(a=>!isObject(a)||!Number.isFinite(a.percent)||a.percent<0||a.percent>100||typeof a.at!=="string"))) fail();
  }
  for(const p of Object.values(data.unitProgress||{})) {
    if(!isObject(p)) fail();
    if(p.bestScore!==undefined&&(!Number.isFinite(p.bestScore)||p.bestScore<0||p.bestScore>100)) fail();
    if(p.readConfirmed!==undefined&&typeof p.readConfirmed!=="boolean") fail();
    if(p.application!==undefined&&(typeof p.application!=="string"||p.application.length>20000)) fail();
    if(p.attempts!==undefined&&(!Array.isArray(p.attempts)||p.attempts.some(a=>!isObject(a)||!Number.isFinite(a.percent)||a.percent<0||a.percent>100))) fail();
  }
  for(const n of data.notes||[]) if(!isObject(n)||typeof n.id!=="string"||typeof n.text!=="string"||n.text.length>20000) fail();
  for(const i of data.issues||[]) if(!isObject(i)||typeof i.text!=="string"||i.text.length>5000||typeof i.id!=="string") fail();
  for(const p of Object.values(data.practices||{})) {
    if(!isObject(p)||!isObject(p.fields)||!["draft","submitted"].includes(p.status)) fail();
    if(Object.values(p.fields).some(v=>typeof v!=="string"||v.length>20000)) fail();
  }
  if(data.capstone&&(!isObject(data.capstone.fields)||!["draft","submitted"].includes(data.capstone.status))) fail();
  for(const values of Object.values(data.toolValues||{})) if(!isObject(values)||Object.values(values).some(v=>typeof v!=="string"||v.length>20000)) fail();
  for(const o of Object.values(data.contentOverrides||{})) {
    if(!isObject(o) || Object.keys(o).some(k=>!["youtubeId","note","reviewedAt","title"].includes(k))) fail();
    if(o.youtubeId!==undefined&&!(typeof o.youtubeId==="string"&&/^[A-Za-z0-9_-]{11}$/.test(o.youtubeId))) fail();
    if(o.note!==undefined&&(typeof o.note!=="string"||o.note.length>2000)) fail();
  }

  for(const flag of ["reducedMotion","highContrast"]) if(data[flag]!==undefined&&typeof data[flag]!=="boolean") fail();
  for(const draft of Object.values(data.quizDrafts||{})){
    if(!isObject(draft)||!Array.isArray(draft.order)||!isObject(draft.answers)||!isObject(draft.optionOrder)||typeof draft.submitted!=="boolean") fail();
    if(draft.order.length>30||draft.order.some(id=>typeof id!=="string"||id.length>120)) fail();
    if(Object.values(draft.answers).some(id=>typeof id!=="string"||id.length>20)) fail();
    if(Object.values(draft.optionOrder).some(order=>!Array.isArray(order)||order.length!==4||order.some(id=>typeof id!=="string"||id.length>20))) fail();
  }
  for(const a of Object.values(data.assessments||{})){
    if(!isObject(a)||!isObject(a.values))fail();
    if(Object.values(a.values).some(n=>!Number.isInteger(n)||n<0||n>5))fail();
    if(a.focus!==undefined&&(typeof a.focus!=="string"||a.focus.length>4000))fail();
  }
  for(const p of Object.values(data.practices||{})){
    if(p.rubric!==undefined&&(!Array.isArray(p.rubric)||p.rubric.some(n=>!Number.isInteger(n)||n<0||n>20)))fail();
  }
  if(data.capstone&&Object.values(data.capstone.fields).some(v=>typeof v!=="string"||v.length>20000))fail();

  // Backups are user-controlled, formative records; importing is not a verification mechanism.
  const output={...base,...data,profile:{...base.profile,...data.profile},capstone:{...base.capstone,...data.capstone}};
  return output;
}
export function recoverStorage(storage=null) {
  storageStatus={available:true,message:""};
  try {storage=storage??globalThis.localStorage;storage?.removeItem(STORAGE_KEY);return true;} catch {storageStatus.available=false;return false;}
}
