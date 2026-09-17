import test from "node:test";
import assert from "node:assert/strict";
import {curriculum} from "../src/data/curriculum.mjs";
import {questionBank} from "../src/data/questions.mjs";
import {cases,tools,futureTracks} from "../src/data/practice.mjs";
import {shuffle,calculateScore,coverage,lessonComplete,viewingComplete,canAttemptQuiz,completionStats,canIssueRecord,validYoutubeId,validateTextFields,nextLesson,canonicalLessonId,canonicalMap,questionCountForDuration,checksumString,mergeProgress,REQUIRED_WATCH_PERCENT} from "../src/core/engine.mjs";
import {freshState,validateImport,loadState,saveState,recoverStorage,migrateV1toV2,SCHEMA_VERSION,STORAGE_KEY} from "../src/core/state.mjs";
import {STRICT_KAD_VIDEO_MODE,videoCandidates} from "../src/data/curriculum.mjs";
import {academyTracks,academyUnits,academyQuestions,academyStats} from "../src/data/academy.mjs";
import {unitComplete,academyCompletionStats,UNIT_APPLICATION_MIN} from "../src/core/engine.mjs";
import {esc,formatTime} from "../src/core/dom.mjs";
const qs=questionBank[curriculum.lessons[0].id];
const complete={duration:100,watched:Array.from({length:90},(_,i)=>i),bestScore:80,reflection:"A specific application reflection with more than forty characters.",attempts:[]};
test("curriculum has 9 modules, 20 unique videos, 119 bilingual questions",()=>{
 assert.equal(curriculum.modules.length,9);assert.equal(curriculum.lessons.length,20);
 assert.equal(new Set(curriculum.lessons.map(l=>l.youtubeId)).size,20);
 assert.equal(Object.values(questionBank).flat().length,119);
 assert.equal(cases.length,9);assert.equal(tools.length,9);
 for(const l of curriculum.lessons){assert.equal(questionBank[l.id].length,l.questionCount);assert(l.title.en&&l.title.ar);assert(l.brief.every(b=>b.en&&b.ar));}
});
test("ELEVATE 2.0 publishes five tracks, 30 units and 150 bilingual questions",()=>{
 assert.equal(academyTracks.length,5);assert.equal(academyUnits.length,30);assert.equal(Object.values(academyQuestions).flat().length,150);
 assert.deepEqual(academyStats,{tracks:5,units:30,questions:150,minutes:450});
 assert.equal(new Set(academyUnits.map(unit=>unit.id)).size,30);
 for(const unit of academyUnits){assert(unit.title.ar&&unit.title.en);assert.equal(unit.questions.length,5);}
});
test("academy unit completion keeps reading, knowledge and application separate",()=>{
 const application="A specific workplace action with observed evidence and a clear adjustment for the next attempt.";
 assert(application.length>=UNIT_APPLICATION_MIN);
 assert(unitComplete({readConfirmed:true,bestScore:80,application}));
 assert(!unitComplete({readConfirmed:false,bestScore:100,application}));
 assert(!unitComplete({readConfirmed:true,bestScore:79,application}));
 assert(!unitComplete({readConfirmed:true,bestScore:100,application:"short"}));
 const progress={[academyUnits[0].id]:{readConfirmed:true,bestScore:80,application}};
 assert.equal(academyCompletionStats(academyUnits,progress).completed,1);
});
test("every question has 4 distinct option IDs and a valid bilingual answer",()=>{
 for(const q of Object.values(questionBank).flat()){
  assert.equal(q.options.length,4);assert.equal(new Set(q.options.map(o=>o.id)).size,4);
  assert(q.options.some(o=>o.id===q.correctId));assert(q.prompt.en&&q.prompt.ar);
  assert(q.options.every(o=>o.text.en&&o.text.ar));assert(q.explanation.en&&q.explanation.ar);
 }
});
test("future tracks are drafts, hidden from learners",()=>{
 assert.equal(futureTracks.length,11);
 assert(futureTracks.every(t=>t.status==="draft"&&t.visible===false));
 assert.equal(curriculum.track.id,"leadership");
});
test("source caveats stay explicit; no invented duration or captions",()=>{
 for(const l of curriculum.lessons){
  assert.equal(l.durationSeconds,null);assert.equal(l.captions,"unknown");
  assert.equal(l.verification.playback,"not_verified_in_build_environment");
  assert.equal(l.verification.reuse,"review_required");
 }
});
test("score respects the 80 percent threshold and partial answers",()=>{
 assert.deepEqual(calculateScore(qs,{}),{correct:0,total:5,percent:0,passed:false});
 const four=Object.fromEntries(qs.slice(0,4).map(q=>[q.id,q.correctId]));
 assert.equal(calculateScore(qs,four).percent,80);assert(calculateScore(qs,four).passed);
 assert.equal(calculateScore(qs,Object.fromEntries(qs.slice(0,3).map(q=>[q.id,q.correctId]))).passed,false);
});
test("all five/seven/ten-question quizzes score correctly",()=>{
 for(const questions of Object.values(questionBank)){
  const answers=Object.fromEntries(questions.map(q=>[q.id,q.correctId]));
  assert.equal(calculateScore(questions,answers).percent,100);
  assert.equal(calculateScore(questions,{}).percent,0);
 }
});
test("empty assessment never counts as passed",()=>assert.equal(calculateScore([],{}).passed,false));
test("shuffle preserves identities and does not mutate the input",()=>{
 const a=["a","b","c","d"],out=shuffle(a,()=>0);
 assert.deepEqual(a,["a","b","c","d"]);assert.deepEqual([...out].sort(),a);assert.notDeepEqual(out,a);
});
test("playback coverage counts unique seconds only",()=>{
 assert.equal(coverage({duration:10,watched:[0,1,1,1,2]}),30);
 assert.equal(coverage({duration:10,watched:[-1,0,1,100]}),20);
 assert.equal(coverage({duration:0,watched:[1]}),0);
});
test("seeking to the end is not coverage",()=>assert.equal(viewingComplete({duration:100,watched:[99]}),false));
test("only measured 90 percent coverage completes the viewing step",()=>{
 assert(viewingComplete({duration:10,watched:[0,1,2,3,4,5,6,7,8]}));
 assert(!viewingComplete({selfConfirmed:true}));
 assert(!viewingComplete({}));
 assert.equal(REQUIRED_WATCH_PERCENT,90);
});
test("quiz stays locked below 90 percent and unlocks at 90 percent",()=>{
 assert.equal(canAttemptQuiz({duration:100,watched:[0]}),false);
 assert.equal(canAttemptQuiz({duration:100,watched:Array.from({length:90},(_,i)=>i)}),true);
});
test("lesson requires viewing, a passed quiz, and reflection",()=>{
 assert(lessonComplete(complete));assert(!lessonComplete({...complete,watched:[0,1]}));
 assert(!lessonComplete({...complete,bestScore:79}));assert(!lessonComplete({...complete,reflection:"short"}));
});
test("blank-space reflection does not meet length",()=>assert(!lessonComplete({...complete,reflection:" ".repeat(90)})));
test("new learner progress is zero, not fabricated",()=>{
 const s=freshState(),stats=completionStats(curriculum.lessons,s.progress);
 assert.equal(stats.percent,0);assert.equal(stats.completed,0);assert.equal(stats.knowledgeAverage,null);
});
test("module metrics use actually completed lessons",()=>{
 const s=freshState();s.progress[curriculum.lessons[0].id]={...complete};
 assert.equal(completionStats(curriculum.lessons,s.progress).percent,5);
});
test("completion record remains locked without practices and capstone",()=>{
 const s=freshState();for(const l of curriculum.lessons)s.progress[l.id]={...complete};
 assert(!canIssueRecord(curriculum.lessons,cases,s));
 for(const c of cases)s.practices[c.id]={status:"submitted",fields:{}};
 assert(!canIssueRecord(curriculum.lessons,cases,s));s.capstone.status="submitted";
 assert(canIssueRecord(curriculum.lessons,cases,s));
});
test("next lesson chooses the first unfinished lesson",()=>{
 const s=freshState();assert.equal(nextLesson(curriculum.lessons,s).id,curriculum.lessons[0].id);
 s.progress[curriculum.lessons[0].id]={...complete};assert.equal(nextLesson(curriculum.lessons,s).id,curriculum.lessons[1].id);
});
test("YouTube IDs are strictly validated, not arbitrary URLs",()=>{
 assert(validYoutubeId("ieYl_Uht-_k"));assert(!validYoutubeId("https://youtube.com/watch?v=ieYl_Uht-_k"));
 assert(!validYoutubeId('"><script>'));assert(!validYoutubeId("short"));
});
test("form fields validate meaningful minimum length",()=>{
 assert.deepEqual(validateTextFields({a:"short",b:"z".repeat(35)},[{id:"a"},{id:"b"}],30),["a"]);
});
test("HTML escaping neutralizes user-entered markup",()=>{
 assert.equal(esc('<img src=x onerror="x()">'),"&lt;img src=x onerror=&quot;x()&quot;&gt;");
 assert.equal(esc("' &"),"&#39; &amp;");
});
test("duration formatting is safe for missing data",()=>{
 assert.equal(formatTime(125),"2:05");assert.equal(formatTime(undefined),"—");
});
test("valid local state survives export/import round trip",()=>{
 const s=freshState();s.profile.name="Test Learner";s.progress.example={...complete};
 const imported=validateImport(JSON.parse(JSON.stringify(s)));assert.equal(imported.profile.name,"Test Learner");
});
test("incompatible, prototype-polluted, and malformed backups fail",()=>{
 assert.throws(()=>validateImport({schemaVersion:99}));
 assert.throws(()=>validateImport(JSON.parse('{"schemaVersion":1,"__proto__":{"admin":true}}')));
 assert.throws(()=>validateImport({...freshState(),progress:[]}));
 assert.throws(()=>validateImport({...freshState(),profile:{name:42}}));
 assert.throws(()=>validateImport({...freshState(),progress:{x:{bestScore:200}}}));
 assert.throws(()=>validateImport({...freshState(),quizDrafts:{x:{order:"not an array"}}}));
});
test("storage abstraction persists data and handles corruption without deleting",()=>{
 const entries=new Map(),storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
 recoverStorage(storage);const s=freshState();s.profile.name="Local";
 assert(saveState(s,storage));assert.equal(loadState(storage).profile.name,"Local");
 entries.set(STORAGE_KEY,"{broken");assert.equal(loadState(storage).profile.name,"");assert.equal(entries.get(STORAGE_KEY),"{broken");
 recoverStorage(storage);
});
test("storage failures do not crash the application",()=>{
 const storage={getItem:()=>{throw new Error("denied");},setItem:()=>{throw new Error("quota");},removeItem:()=>{}};
 assert.doesNotThrow(()=>loadState(storage));assert.equal(saveState(freshState(),storage),false);recoverStorage(storage);
});

test("coverage cannot round less than 90 percent up to completion",()=>{
 const p={duration:200,watched:Array.from({length:179},(_,i)=>i)};
 assert.equal(coverage(p),89);
 assert.equal(viewingComplete(p),false);
});
test("canonical lesson IDs are unique and stable",()=>{
 const ids=curriculum.lessons.map(canonicalLessonId);
 assert.equal(new Set(ids).size,ids.length);
 for(const l of curriculum.lessons)assert.equal(canonicalLessonId(l),`leadership.${l.moduleId}.${l.id}`);
 assert.equal(Object.keys(canonicalMap(curriculum.lessons)).length,curriculum.lessons.length);
});
test("next lesson stays inside the chosen language journey",()=>{
 const s=freshState();
 const ar=nextLesson(curriculum.lessons,s,"ar");
 assert.equal(ar.language,"ar");
 const en=nextLesson(curriculum.lessons,s,"en");
 assert.equal(en.language,"en");
});
test("visible quiz size follows video duration bands",()=>{
 assert.equal(questionCountForDuration(300),5);
 assert.equal(questionCountForDuration(360),5);
 assert.equal(questionCountForDuration(361),7);
 assert.equal(questionCountForDuration(720),7);
 assert.equal(questionCountForDuration(721),10);
 assert.equal(questionCountForDuration(null),5);
});
test("merge keeps united watch ranges and maximum scores",()=>{
 const merged=mergeProgress(
  {l1:{duration:100,watched:[0,1],bestScore:60,reflection:"short",attempts:[{percent:60,at:"2026-01-01"}]}},
  {l1:{duration:100,watched:[1,2],bestScore:100,reflection:"A much longer reflection text that should win.",attempts:[{percent:100,at:"2026-01-02"}]},l2:{bestScore:80}}
 );
 assert.deepEqual(merged.l1.watched,[0,1,2]);
 assert.equal(merged.l1.bestScore,100);
 assert(merged.l1.reflection.includes("much longer"));
 assert.equal(merged.l1.attempts.length,2);
 assert.equal(merged.l2.bestScore,80);
});
test("backup checksums are deterministic",()=>{
 const a=checksumString({x:1}),b=checksumString({x:1}),c=checksumString({x:2});
 assert.equal(a,b);assert.notEqual(a,c);assert.equal(a.length,8);
});
test("fresh state requires a language choice and carries a device identity",()=>{
 const s=freshState();
 assert.equal(s.schemaVersion,SCHEMA_VERSION);
 assert.equal(s.language,null);
 assert(typeof s.deviceProfileId==="string"&&s.deviceProfileId.length>0);
});
test("v1 backups migrate without losing evidence",()=>{
 const v1={...freshState(),schemaVersion:1,language:"ar",progress:{l1:{duration:100,watched:[5],selfConfirmed:true,bestScore:100,reflection:"Kept reflection text.",attempts:[{percent:100,at:"2026-01-01"}]}}};
 const migrated=validateImport(JSON.parse(JSON.stringify(v1)));
 assert.equal(migrated.schemaVersion,SCHEMA_VERSION);
 assert.equal(migrated.migratedFrom,"kad-growth.open.v1");
 assert.equal(migrated.progress.l1.selfConfirmed,false);
 assert.deepEqual(migrated.progress.l1.watched,[5]);
 assert.equal(migrated.progress.l1.bestScore,100);
 assert.equal(migrated.progress.l1.reflection,"Kept reflection text.");
 assert.equal(migrated.migrationAudit.length,1);
 assert.equal(migrated.migrationAudit[0].grandfatheredSelfConfirmations,1);
});
test("strict KAD video mode stays off and candidates stay drafts",()=>{
 assert.equal(STRICT_KAD_VIDEO_MODE,false);
 assert.equal(videoCandidates.ar.length,9);
 assert.equal(videoCandidates.en.length,11);
 assert(videoCandidates.ar.every(c=>c.status==="draft"));
 assert(videoCandidates.en.every(c=>c.status==="draft"));
});
