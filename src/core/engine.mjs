export const PASS_SCORE = 80;
export const REFLECTION_MIN = 40;
export const REQUIRED_WATCH_PERCENT = 90;
export function shuffle(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function calculateScore(questions, answers) {
  if (!Array.isArray(questions) || questions.length === 0) return {correct:0,total:0,percent:0,passed:false};
  const correct = questions.filter(q => answers[q.id] === q.correctId).length;
  const percent = Math.round(correct / questions.length * 100);
  return {correct,total:questions.length,percent,passed:percent >= PASS_SCORE};
}
export function coverage(progress) {
  if (!progress || !progress.duration || progress.duration < 1) return 0;
  const watched = [...new Set(progress.watched || [])].filter(s => Number.isInteger(s) && s >= 0 && s < progress.duration).length;
  return Math.min(100, Math.floor(watched / progress.duration * 100));
}
export function viewingComplete(progress) {
  return coverage(progress) >= REQUIRED_WATCH_PERCENT;
}
export function canAttemptQuiz(progress) {
  return viewingComplete(progress);
}
export function lessonComplete(progress) {
  return viewingComplete(progress) && (progress?.bestScore ?? 0) >= PASS_SCORE &&
    typeof progress?.reflection === "string" && progress.reflection.trim().length >= REFLECTION_MIN;
}
export function completionStats(lessons, progress) {
  const completed = lessons.filter(l => lessonComplete(progress[l.id])).length;
  const attempted = lessons.filter(l => (progress[l.id]?.attempts?.length ?? 0) > 0);
  const knowledgeAverage = attempted.length ? Math.round(attempted.reduce((s,l)=>s+(progress[l.id].bestScore||0),0)/attempted.length) : null;
  return {completed,total:lessons.length,percent:lessons.length?Math.round(completed/lessons.length*100):0,knowledgeAverage};
}
export function canIssueRecord(lessons, cases, state) {
  return lessons.every(l=>lessonComplete(state.progress[l.id])) &&
    cases.every(c=>state.practices[c.id]?.status==="submitted") &&
    state.capstone?.status==="submitted";
}
export function validYoutubeId(id) { return typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id); }
export function safeFilename(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,60) || "export"; }
export function validateTextFields(values, fields, minimum = 30) {
  return fields.filter(f=>typeof values[f.id]!=="string" || values[f.id].trim().length<minimum).map(f=>f.id);
}
export function nextLesson(lessons,state,language=null) {
  const pool = language ? lessons.filter(l=>l.language===language) : lessons;
  const last = pool.find(l=>l.id===state.lastLesson && !lessonComplete(state.progress[l.id]));
  return last || pool.find(l=>!lessonComplete(state.progress[l.id])) || pool[0] || lessons[0];
}
export function canonicalLessonId(lesson) {
  return `leadership.${lesson.moduleId}.${lesson.id}`;
}
export function canonicalMap(lessons) {
  return Object.fromEntries(lessons.map(l=>[l.id,canonicalLessonId(l)]));
}
export function questionCountForDuration(durationSeconds) {
  if(!Number.isFinite(durationSeconds) || durationSeconds<=0) return 5;
  if(durationSeconds<=360) return 5;
  if(durationSeconds<=720) return 7;
  return 10;
}
export function checksumString(input) {
  const text = typeof input==="string" ? input : JSON.stringify(input);
  let hash = 0x811c9dc5;
  for(let i=0;i<text.length;i++){ hash ^= text.charCodeAt(i); hash = Math.imul(hash,0x01000193); }
  return ("0000000"+(hash>>>0).toString(16)).slice(-8);
}
export function mergeProgress(current={},incoming={}) {
  const merged = {...current};
  for(const [id,inc] of Object.entries(incoming||{})) {
    if(!inc || typeof inc!=="object"){ continue; }
    const cur = merged[id];
    if(!cur || typeof cur!=="object"){ merged[id]=inc; continue; }
    const watched = [...new Set([...(cur.watched||[]),...(inc.watched||[])])].filter(n=>Number.isInteger(n)&&n>=0&&n<=200000).slice(-200000);
    const attempts = [...(cur.attempts||[]),...(inc.attempts||[])].slice(-100);
    const bestScore = Math.max(cur.bestScore||0,inc.bestScore||0);
    const curRef = typeof cur.reflection==="string"?cur.reflection:"";
    const incRef = typeof inc.reflection==="string"?inc.reflection:"";
    const reflection = (incRef.trim().length>=curRef.trim().length?incRef:curRef).slice(0,4000);
    const duration = Number.isFinite(inc.duration)&&inc.duration>0 ? inc.duration : cur.duration;
    merged[id] = {...cur,...inc,watched,attempts,bestScore,reflection,duration,completedAt:cur.completedAt||inc.completedAt||null};
  }
  return merged;
}
