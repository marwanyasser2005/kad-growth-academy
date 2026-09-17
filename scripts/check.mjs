import {curriculum,STRICT_KAD_VIDEO_MODE,videoCandidates} from "../src/data/curriculum.mjs";
import {questionBank} from "../src/data/questions.mjs";
import {cases,tools,futureTracks} from "../src/data/practice.mjs";
import {academyTracks,academyUnits,academyQuestions,academyStats} from "../src/data/academy.mjs";
import {validYoutubeId,canonicalLessonId} from "../src/core/engine.mjs";
import assert from "node:assert/strict";

const unique=(xs,label)=>assert.equal(new Set(xs).size,xs.length,`${label} must be unique`);
unique(curriculum.lessons.map(l=>l.id),"Lesson IDs");
unique(curriculum.lessons.map(l=>l.youtubeId),"Video IDs");
unique(curriculum.modules.map(m=>m.id),"Module IDs");
let total=0;
for(const l of curriculum.lessons){
 assert(validYoutubeId(l.youtubeId),l.id);
 assert(curriculum.modules.some(m=>m.id===l.moduleId),l.id);
 assert([5,7,10].includes(l.questionCount),l.id);
 assert.equal(questionBank[l.id]?.length,l.questionCount,l.id);
 for(const q of questionBank[l.id]){
  assert(q.prompt.en&&q.prompt.ar&&q.explanation.en&&q.explanation.ar,q.id);
  assert.equal(q.options.length,4,q.id);
  unique(q.options.map(o=>o.id),q.id);
  assert(q.options.some(o=>o.id===q.correctId),q.id);
  assert(q.options.every(o=>o.text.en&&o.text.ar),q.id);
  total++;
 }
 assert.equal(l.verification.playback,"not_verified_in_build_environment");
 assert.equal(l.verification.reuse,"review_required");
 assert.equal(l.captions,"unknown");
}
assert.equal(curriculum.modules.length,9);
assert.equal(curriculum.lessons.length,20);
assert.equal(total,119);
assert.equal(cases.length,9);
assert.equal(tools.length,9);
assert(futureTracks.every(t=>t.visible===false&&t.status==="draft"));
assert.equal(STRICT_KAD_VIDEO_MODE,false);
assert.equal(academyTracks.length,5);
assert.equal(academyUnits.length,30);
assert.equal(Object.values(academyQuestions).flat().length,150);
assert.deepEqual(academyStats,{tracks:5,units:30,questions:150,minutes:450});
unique(academyUnits.map(u=>u.id),"Academy unit IDs");
for(const unit of academyUnits){
 assert(unit.title.en&&unit.title.ar&&unit.principle.en&&unit.principle.ar,unit.id);
 assert.equal(unit.questions.length,5,unit.id);
 for(const q of unit.questions){assert(q.prompt.en&&q.prompt.ar&&q.explanation.en&&q.explanation.ar,q.id);assert.equal(q.options.length,4,q.id);}
}
const canonicalIds=curriculum.lessons.map(canonicalLessonId);
unique(canonicalIds,"Canonical lesson IDs");
for(const l of curriculum.lessons){
 assert(["ar","en"].includes(l.language),l.id);
 assert(l.application?.en?.trim()&&l.application?.ar?.trim(),l.id);
 assert(l.objectives?.length&&l.objectives.every(o=>o.en?.trim()&&o.ar?.trim()),l.id);
}
const publishedIds=new Set(curriculum.lessons.map(l=>l.youtubeId));
for(const lang of ["ar","en"]){
 for(const c of videoCandidates[lang]){
  assert(validYoutubeId(c.youtubeId),c.youtubeId);
  assert(!publishedIds.has(c.youtubeId),c.youtubeId);
  assert.equal(c.status,"draft");
  assert(c.topic?.en&&c.topic?.ar,c.youtubeId);
 }
}
assert.equal(videoCandidates.ar.length,9);
assert.equal(videoCandidates.en.length,11);
console.log(JSON.stringify({release:"2.0",tracks:5,units:30,academyQuestions:150,legacyModules:9,legacyLessons:20,legacyQuestions:total,scenarios:9,tools:9,strictKadVideoMode:STRICT_KAD_VIDEO_MODE,status:"PASS"},null,2));
