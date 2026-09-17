import { curriculum } from "./data/curriculum.mjs";
import { questionBank } from "./data/questions.mjs";
import { cases, tools, futureTracks } from "./data/practice.mjs";
import { PASS_SCORE, REFLECTION_MIN, REQUIRED_WATCH_PERCENT, shuffle, calculateScore, coverage, viewingComplete, canAttemptQuiz, lessonComplete, completionStats, canIssueRecord, validYoutubeId, safeFilename, validateTextFields, nextLesson, canonicalLessonId, mergeProgress, checksumString } from "./core/engine.mjs";
import { idbWriteState, idbReadMetadata, requestPersistence, storageHealth } from "./core/idb.mjs";
import { freshState, loadState, saveState, validateImport, recoverStorage, storageStatus } from "./core/state.mjs";
import { esc, downloadFile, debounce, dateLabel, formatTime } from "./core/dom.mjs";
import { icon } from "./ui/icons.mjs";

const app=document.getElementById("app");
let state=loadState();
let route={path:"/",params:new URLSearchParams()};
let player=null, playbackTimer=null, lastPlayback=null, playerReadyTimer=null;
let pendingNavigate=null;
let pendingImport=null;
const lessonList=curriculum.lessons, moduleList=curriculum.modules;
const T=(en,ar)=>state.language==="ar"?ar:en;
const tr=obj=>typeof obj==="string"?obj:(obj?.[state.language]??obj?.en??"");
const i18nLang=()=>state.language==="ar"?"ar-EG-u-nu-latn":"en-GB";
const getLesson=id=>lessonList.find(l=>l.id===id);
const getModule=id=>moduleList.find(m=>m.id===id);
const effectiveVideo=l=>state.contentOverrides[l.id]?.youtubeId||l.youtubeId;
const progressFor=id=>state.progress[id]||{};
const upsertProgress=id=>(state.progress[id]??={watched:[],attempts:[],bestScore:0,reflection:"",selfConfirmed:false});
const stats=()=>completionStats(lessonList,state.progress);
const countQuestions=()=>Object.values(questionBank).reduce((s,q)=>s+q.length,0);
const localLabel=()=>T("Saved on this device","محفوظ على هذا الجهاز");
const number=n=>Number(n).toLocaleString(i18nLang());
const emptyDash=()=>T("Not measured","لم يُقَس بعد");
const langLabel=l=>l==="ar"?T("Arabic","العربية"):T("English","الإنجليزية");
const difficultyLabel=l=>T({foundation:"Foundation",intermediate:"Intermediate",advanced:"Deep dive"}[l],{foundation:"تأسيسي",intermediate:"متوسط",advanced:"متعمّق"}[l]);
function persist(){
  const ok=saveState(state);
  if(!ok)document.querySelector("#storage-alert")?.classList.remove("hidden");
  try {
    const snapshot=JSON.parse(JSON.stringify(state));
    idbWriteState(snapshot).then(()=>refreshStorageHealth(true)).catch(()=>{});
  } catch {}
  return ok;
}
const systemDarkQuery=globalThis.matchMedia?.("(prefers-color-scheme: dark)");
function applyTheme(theme){
  const root=document.documentElement;
  const dark=theme==="dark"||(theme!=="light"&&Boolean(systemDarkQuery?.matches));
  root.classList.toggle("theme-dark",dark);
  root.classList.toggle("theme-light",!dark);
}
systemDarkQuery?.addEventListener?.("change",()=>{if(state.theme!=="light"&&state.theme!=="dark")applyTheme("system");});
function toast(message,type="success"){
  const el=document.getElementById("toast");el.textContent=message;el.className=`toast visible ${type}`;
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.className="toast",3600);
}
function routeLink(path,label,cls="btn",ico="arrow") {
  return `<a class="${cls}" href="#${esc(path)}">${esc(label)}${ico?icon(ico,"directional"):""}</a>`;
}
function extLink(url,label,cls="text-link"){
  return `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}${icon("external")}</a>`;
}
function pill(label,cls=""){return `<span class="pill ${cls}">${esc(label)}</span>`;}
function notice(text,type="info"){return `<div class="notice ${type}">${icon(type==="warning"?"shield":"info")}<div>${text}</div></div>`;}
function pageHead(kicker,title,desc,action=""){
  return `<div class="page-heading"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1>${desc?`<p>${esc(desc)}</p>`:""}</div>${action?`<div class="heading-actions">${action}</div>`:""}</div>`;
}
function sectionHead(title,action=""){return `<div class="section-heading"><h2>${esc(title)}</h2>${action}</div>`;}
function emptyState(ico,title,desc,action=""){
  return `<div class="empty-state">${icon(ico)}<h3>${esc(title)}</h3><p>${esc(desc)}</p>${action}</div>`;
}
function statusPill(l){
  const p=progressFor(l.id);
  return lessonComplete(p)?pill(T("Completed","مكتمل"),"complete"):p.attempts?.length||p.watched?.length?pill(T("In progress","قيد التعلّم"),"accent"):pill(T("Ready to start","جاهز للبدء"),"muted");
}
function progressBar(percent,label=""){
  return `<div class="progress-track" role="progressbar" aria-label="${esc(label||T("Progress","التقدم"))}" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.min(100,Math.max(0,percent))}%"></span></div>`;
}
function artSvg(){
  return `<svg class="hero-art" viewBox="0 0 540 360" fill="none" aria-hidden="true">
  <defs><linearGradient id="stepShade" x1="0" x2="1"><stop stop-color="#e9e9e7"/><stop offset="1" stop-color="#a3a3a2"/></linearGradient><linearGradient id="redShade" x1="0" x2="1"><stop stop-color="#d41f40"/><stop offset="1" stop-color="#971126"/></linearGradient></defs>
  <g stroke="#393939" stroke-width=".6"><path d="M10 270 245 135 535 299M10 306 245 171 535 335M10 342 245 207 480 343M65 238 358 406M128 200 422 368M192 163 485 331"/><path d="M245 32v103M245 32l246 141v126M245 32 45 148v143" stroke-dasharray="3 5"/></g>
  <g><path d="m93 247 57-32 71 40-57 33z" fill="#e8e8e6"/><path d="M93 247v35l71 41v-35z" fill="#acacab"/><path d="m164 288 57-33v35l-57 33z" fill="#737371"/>
  <path d="m154 183 57-33 71 41-57 33z" fill="#eeeeeb"/><path d="M154 183v67l71 41v-67z" fill="url(#stepShade)"/><path d="m225 224 57-33v67l-57 33z" fill="#8e8e8b"/>
  <path d="m215 118 57-33 71 41-57 33z" fill="#f7f7f4"/><path d="M215 118v101l71 41V159z" fill="url(#stepShade)"/><path d="m286 159 57-33v101l-57 33z" fill="#9c9c99"/>
  <path d="m276 54 57-33 71 41-57 33z" fill="#ef3151"/><path d="M276 54v134l71 41V95z" fill="url(#redShade)"/><path d="m347 95 57-33v134l-57 33z" fill="#7b1026"/></g>
  <path d="m76 215 55-33v-61l61-35V53l62-36" stroke="#b8b8b4" stroke-width="1.2" stroke-dasharray="5 6"/>
  <circle cx="254" cy="17" r="4" fill="#d71d41"/><path d="m430 117 29 17v74l-29-16z" stroke="#777"/><circle cx="464" cy="258" r="3" fill="#bf1837"/>
  <text x="40" y="329" fill="#777" font-family="Arial,sans-serif" font-size="9" letter-spacing="3">THE PRACTICE OF LEADERSHIP</text></svg>`;
}
function moduleCard(m){
  const ls=lessonList.filter(l=>l.moduleId===m.id);
  const done=ls.filter(l=>lessonComplete(progressFor(l.id))).length;
  const target=ls.find(l=>!lessonComplete(progressFor(l.id)))||ls[0];
  return `<a class="module-card" href="#/learn/${target.id}"><div class="module-top"><span class="module-number">${String(m.number).padStart(2,"0")}</span><span class="module-icon">${icon(m.icon)}</span></div><h3>${esc(tr(m.title))}</h3><p>${esc(tr(m.description))}</p><div class="module-meta"><span>${number(ls.length)} ${T("lessons","دروس")}</span><span>${number(done)}/${number(ls.length)}</span></div>${progressBar(Math.round(done/ls.length*100),tr(m.title))}<div class="module-bottom"><span>${T("Explore module","استكشف الوحدة")}</span>${icon("arrow","directional")}</div></a>`;
}
function lessonTile(l,compact=false){
  const m=getModule(l.moduleId), saved=state.saved.includes(l.id);
  if(compact)return `<a class="lesson-row" href="#/learn/${l.id}"><span class="row-icon">${icon(lessonComplete(progressFor(l.id))?"checkCircle":"play")}</span><div><h3>${esc(tr(l.title))}</h3><span class="muted small">${esc(l.source)} · ${langLabel(l.language)} · ${number(l.questionCount)} ${T("questions","أسئلة")}</span></div>${icon("chevron","directional")}</a>`;
  return `<article class="lesson-card"><a class="lesson-visual visual-${m.number%4}" href="#/learn/${l.id}" tabindex="-1" aria-hidden="true"><div class="visual-grid"></div><span class="visual-number">${String(m.number).padStart(2,"0")}</span><span class="visual-icon">${icon(m.icon)}</span><span class="visual-play">${icon("play")}</span><span class="visual-lang">${l.language==="ar"?"AR":"EN"}</span></a><div class="lesson-card-body"><div class="card-kicker">${esc(tr(m.title))}<button class="icon-btn bookmark-btn ${saved?"is-saved":""}" data-action="save-lesson" data-id="${l.id}" aria-label="${T("Save lesson","حفظ الدرس")}" aria-pressed="${saved}">${icon("bookmark")}</button></div><h3><a href="#/learn/${l.id}">${esc(tr(l.title))}</a></h3><div class="lesson-meta"><span>${langLabel(l.language)}</span><span>${number(l.questionCount)} ${T("questions","أسئلة")}</span><span>${difficultyLabel(l.difficulty)}</span></div><div class="lesson-card-footer">${statusPill(l)}<a href="#/learn/${l.id}" aria-label="${esc(T("Open lesson: ","فتح الدرس: ")+tr(l.title))}">${icon("arrow","directional")}</a></div></div></article>`;
}
function getNav(){
 return [
  {title:T("WORKSPACE","مساحة التعلّم"),items:[
   ["/","home",T("Overview","الرئيسية")],
   ["/leadership","compass",T("Leadership path","مسار القيادة")],
   ["/library","book",T("Learning library","مكتبة التعلّم")],
   ["/practice","layers",T("Practice lab","مختبر التطبيق")],
   ["/toolkit","briefcase",T("Leadership toolkit","أدوات القيادة")]
  ]},
  {title:T("MY DEVELOPMENT","تطوري الشخصي"),items:[
   ["/assessment","target",T("Self-assessment","التقييم الذاتي")],
   ["/progress","chart",T("My progress","تقدمي")],
   ["/notes","pen",T("My notes","ملاحظاتي")],
   ["/saved","bookmark",T("Saved lessons","الدروس المحفوظة")],
   ["/capstone","flag",T("Impact challenge","تحدي الأثر")],
   ["/achievements","trophy",T("Achievements","الإنجازات")]
  ]}
 ];
}
function activeNav(path){
 if(path==="/")return route.path==="/";
 if(path==="/leadership"&&route.path.startsWith("/learn/"))return true;
 return route.path===path||route.path.startsWith(path+"/");
}
function shell(content){
 if(!state.language)return `<a href="#main" class="skip-link">Skip to content · انتقل إلى المحتوى</a><main id="main" tabindex="-1" class="gate-main">${content}</main><div id="toast" class="toast" role="status" aria-live="polite"></div><div id="modal-root"></div>`;
 const stat=stats(), name=state.profile.name.trim()||T("Your workspace","مساحتك الشخصية");
 return `<a href="#main" class="skip-link">${T("Skip to content","انتقل إلى المحتوى")}</a>
 <div class="mobile-overlay" data-action="close-menu"></div>
 <aside class="sidebar" id="sidebar" aria-label="${T("Main navigation","القائمة الرئيسية")}">
 <a class="brand" href="#/" aria-label="KAD Growth"><span class="brand-logo"><img src="./assets/kad-logo.png" data-kad-logo alt="Kader & Associates Designs"></span><span class="brand-caption">GROWTH <span>ACADEMY</span></span></a>
 <div class="nav-scroll">${getNav().map(group=>`<div class="nav-group"><div class="nav-label">${group.title}</div>${group.items.map(([href,ic,label])=>`<a class="nav-link ${activeNav(href)?"active":""}" href="#${href}" ${activeNav(href)?'aria-current="page"':""}>${icon(ic)}<span>${label}</span>${href==="/leadership"?'<span class="nav-dot"></span>':""}</a>`).join("")}</div>`).join("")}
 <div class="sidebar-progress"><div class="eyebrow">${T("YOUR LEADERSHIP JOURNEY","رحلتك في القيادة")}</div><div class="sidebar-progress-numbers"><strong>${number(stat.percent)}<small>%</small></strong><span>${number(stat.completed)} / ${number(stat.total)} ${T("lessons","درسًا")}</span></div>${progressBar(stat.percent)}</div></div>
 <div class="sidebar-bottom"><a href="#/help">${icon("help")}${T("Help & support","المساعدة والدعم")}</a><a href="#/settings">${icon("settings")}${T("Settings","الإعدادات")}</a><div class="open-indicator"><span></span>${T("OPEN EDITION · NO SIGN-IN","نسخة مفتوحة · دون تسجيل")}</div></div></aside>
 <div class="app-main"><header class="topbar"><div class="topbar-left"><button class="icon-btn mobile-menu" data-action="toggle-menu" aria-label="${T("Open navigation","فتح القائمة")}" aria-controls="sidebar" aria-expanded="false">${icon("menu")}</button><div class="breadcrumb">KAD Growth <span>/</span> <strong>${T("Soft Skills Academy","أكاديمية المهارات الشخصية")}</strong></div></div><div class="topbar-right"><form class="top-search" id="global-search">${icon("search")}<label class="sr-only" for="search-all">${T("Search lessons","ابحث في الدروس")}</label><input id="search-all" name="q" placeholder="${T("Find a skill or lesson...","ابحث عن مهارة أو درس...")}" maxlength="100"><kbd>/</kbd></form><button class="language-btn" data-action="language" aria-label="${T("Switch to Arabic","التبديل إلى الإنجليزية")}">${icon("globe")}<span>${T("العربية","EN")}</span></button><a class="profile-avatar" href="#/profile" aria-label="${T("My local profile","ملفي المحلي")}">${state.profile.name.trim()?esc(state.profile.name.trim()[0].toUpperCase()):icon("user")}</a></div></header>
 <main id="main" tabindex="-1"><div id="storage-alert" class="notice warning ${storageStatus.available?"hidden":""}">${icon("info")}<div>${T("Local storage is unavailable. Your changes are in memory only; export a backup in Settings before leaving.","التخزين المحلي غير متاح. تغييراتك في الذاكرة فقط؛ صدّر نسخة من الإعدادات قبل المغادرة.")}</div></div>${content}</main>
 <footer class="footer"><div><strong>KAD Growth</strong><span>${T("Built for people who design what comes next.","لمن يصممون ما يأتي بعد ذلك.")}</span></div><nav aria-label="${T("Footer","روابط إضافية")}"><a href="#/about">${T("About","عن المنصة")}</a><a href="#/sources">${T("Sources","المصادر")}</a><a href="#/privacy">${T("Privacy","الخصوصية")}</a><a href="#/admin">${T("Admin preview","معاينة الإدارة")}</a></nav><small>${T("Open edition · Learning records stay on this device.","نسخة مفتوحة · سجلات التعلّم تبقى على هذا الجهاز.")}</small></footer></div>
 <div id="toast" class="toast" role="status" aria-live="polite"></div><div id="modal-root"></div>
 <nav class="bottom-nav" aria-label="${T("Primary","التنقل الرئيسي")}"><a href="#/" data-nav="/">${icon("home")}<span>${T("Home","الرئيسية")}</span></a><a href="#/leadership" data-nav="/leadership">${icon("compass")}<span>${T("Learn","تعلّم")}</span></a><a href="#/practice" data-nav="/practice">${icon("layers")}<span>${T("Practice","طبّق")}</span></a><a href="#/progress" data-nav="/progress">${icon("chart")}<span>${T("Progress","التقدم")}</span></a><a href="#/profile" data-nav="/profile">${icon("user")}<span>${T("Profile","حسابي")}</span></a></nav>`;
}
function homePage(){
 const st=stats(),next=nextLesson(lessonList,state,state.language);
 const recent=lessonList.filter(l=>progressFor(l.id).attempts?.length).slice(-3).reverse();
 return `<div class="welcome-line"><div><div class="eyebrow">${T("YOUR NEXT CHAPTER STARTS HERE","فصلك التالي يبدأ هنا")}</div><h1>${state.profile.name?T("Welcome back, ","أهلًا، ")+esc(state.profile.name.split(" ")[0]):T("Great work begins with you.","العمل العظيم يبدأ بك.")}</h1><p>${T("A little learning. A real conversation. A better way to lead.","تعلّم صغير. محادثة حقيقية. وطريقة أفضل للقيادة.")}</p></div><a class="local-badge" href="#/settings">${icon("shield")}<span>${T("Open access","تعلّم مفتوح")}<small>${T("Your progress, on this device","تقدمك محفوظ على هذا الجهاز")}</small></span></a></div>
 <section class="hero"><div class="hero-copy"><div class="hero-eyebrow"><span class="red-line"></span>TRACK 01 <span> / </span> LEADERSHIP FOUNDATION</div><h2>${T("Lead with<br>purpose.","قُد بهدف.<br><span>واترك أثرًا.</span>")}</h2><p>${T("Build the everyday skills to lead yourself, earn trust, and move multidisciplinary teams forward.","ابنِ مهاراتك اليومية لقيادة نفسك، وكسب الثقة، ومساعدة الفرق متعددة التخصصات على التقدم.")}</p><div class="hero-actions">${routeLink(`/learn/${next.id}`,st.completed?T("Continue learning","استكمل التعلّم"):T("Start your journey","ابدأ رحلتك"),"btn btn-red","arrow")}${routeLink("/leadership",T("Explore the program","استكشف البرنامج"),"btn btn-ghost","")}</div><div class="hero-foot"><span>${icon("book")}${number(lessonList.length)} ${T("curated lessons","درسًا مختارًا")}</span><span>${icon("globe")}AR + EN</span><span>${icon("checkCircle")}${T("Learn by doing","تعلّم بالممارسة")}</span><span>${icon("play")}${T("Continue: ","تابع: ")+esc(tr(next.title))}</span></div></div><div class="hero-visual">${artSvg()}<div class="hero-visual-caption"><span>01 — 09</span><span>SELF · PEOPLE · TEAM</span></div></div></section>
 <section class="stat-grid" aria-label="${T("Your learning in numbers","تعلّمك بالأرقام")}">
 <div class="stat-card"><span class="stat-icon">${icon("compass")}</span><div><span class="stat-title">${T("Learning progress","تقدم التعلّم")}</span><strong>${number(st.percent)}<small>%</small></strong><span class="stat-note">${number(st.completed)} ${T("of","من")} ${number(lessonList.length)} ${T("lessons completed","درسًا مكتملًا")}</span></div></div>
 <div class="stat-card"><span class="stat-icon">${icon("layers")}</span><div><span class="stat-title">${T("Practice in action","التطبيق العملي")}</span><strong>${number(cases.filter(c=>state.practices[c.id]?.status==="submitted").length)}<small> / ${number(cases.length)}</small></strong><span class="stat-note">${T("Workplace challenges","تحديات من بيئة العمل")}</span></div></div>
 <div class="stat-card"><span class="stat-icon">${icon("target")}</span><div><span class="stat-title">${T("Knowledge checks","اختبارات المعرفة")}</span><strong>${st.knowledgeAverage===null?"—":number(st.knowledgeAverage)}${st.knowledgeAverage===null?"":"<small>%</small>"}</strong><span class="stat-note">${T("Average best quiz score","متوسط أفضل درجات الاختبارات")}</span></div></div>
 <div class="stat-card"><span class="stat-icon">${icon("clock")}</span><div><span class="stat-title">${T("Your weekly intention","هدفك الأسبوعي")}</span><strong>${number(state.profile.weeklyGoal)}<small>${T("min","د")}</small></strong><a class="stat-note" href="#/profile">${T("A goal, not tracked time","هدف، وليس وقتًا مُقاسًا")}${icon("arrow","directional")}</a></div></div></section>
 <div class="home-lower"><section>${sectionHead(T("Your learning path","مسارك التعليمي"),routeLink("/leadership",T("View all 9 modules","عرض الوحدات التسع"),"text-link"))}<div class="module-grid home-modules">${moduleList.slice(0,3).map(moduleCard).join("")}</div></section><aside class="start-card"><div class="eyebrow">${T("START WITH SELF-AWARENESS","ابدأ بالوعي الذاتي")}</div><div class="start-card-icon">${icon("fingerprint")}</div><h2>${T("Know your<br>starting point.","اعرف نقطة<br>بدايتك.")}</h2><p>${T("Reflect on nine everyday behaviors. Choose one to improve, then revisit it after the program.","تأمل تسعة سلوكيات يومية. اختر واحدًا لتحسينه، ثم ارجع إليه بعد البرنامج.")}</p>${routeLink("/assessment",T("Take the self-assessment","ابدأ التقييم الذاتي"),"btn btn-dark","arrow")}<small>${T("Developmental reflection, not a personality test.","تأمل للتطوير، وليس اختبارًا للشخصية.")}</small></aside></div>
 <section class="process-section">${sectionHead(T("More than watching. A process for growth.","أكثر من مشاهدة. عملية متكاملة للتطور."))}<div class="process-grid">${[
 ["01","target",T("Assess","قيّم"),T("Choose your focus","حدد نقطة تركيزك")],
 ["02","play",T("Learn","تعلّم"),T("Watch and read","شاهد واقرأ")],
 ["03","checkCircle",T("Check","اختبر"),T("Test your understanding","اختبر فهمك")],
 ["04","layers",T("Apply","طبّق"),T("Use a KAD scenario","تدرّب على موقف عملي")],
 ["05","pen",T("Reflect","تأمل"),T("Build a better habit","ابنِ عادة أفضل")]
 ].map(([n,ic,t,d])=>`<div><span class="process-number">${n}</span>${icon(ic)}<h3>${t}</h3><p>${d}</p></div>`).join("")}</div></section>
 <section>${sectionHead(T("Arabic. English. One shared goal.","العربية والإنجليزية. وهدف واحد."),routeLink("/library",T("Browse the library","تصفح المكتبة"),"text-link"))}<div class="lesson-grid">${[lessonList[0],lessonList[10],lessonList[14]].map(l=>lessonTile(l)).join("")}</div></section>
 <div class="source-strip"><span>${T("LEARN FROM PUBLICLY AVAILABLE MATERIALS BY","تعلّم من مواد متاحة للمشاهدة لدى")}</span><strong>إدراك</strong><strong>Harvard Business Review</strong><strong>Stanford GSB</strong><strong>Simon Sinek</strong><small>${T("Independent curation. No endorsement or accreditation implied.","اختيار مستقل للمصادر، دون ادعاء اعتماد أو تأييد منها.")}</small></div>`;
}
function leadershipPage(){
 const st=stats();
 return `${pageHead("TRACK 01 · LEADERSHIP FOUNDATION",T("Leadership, by design.","القيادة، بتصميم واعٍ."),T("Nine modules. One connected journey from self-awareness to team leadership.","تسع وحدات في رحلة متصلة من الوعي الذاتي إلى قيادة الفريق."),routeLink(`/learn/${nextLesson(lessonList,state,state.language).id}`,T("Continue learning","تابع التعلّم"),"btn btn-red"))}
 <section class="track-banner"><div><span class="eyebrow">${T("THE FOUNDATION PROGRAM","البرنامج التأسيسي")}</span><h2>${T("Learn. Apply. Lead.","تعلّم. طبّق. قُد.")}</h2><p>${T("An eight-week suggested rhythm. Learn at your own pace, then turn each module into a practical workplace habit.","إيقاع مقترح لثمانية أسابيع. تعلّم بالسرعة المناسبة لك، ثم حوّل كل وحدة إلى عادة عملية في العمل.")}</p><div class="inline-meta">${pill(T("8-week suggested plan","خطة مقترحة لثمانية أسابيع"))}${pill(`${number(lessonList.length)} ${T("videos","فيديو")} · ${number(countQuestions())} ${T("questions","سؤالًا")}`)}${pill(T("9 applied challenges","٩ تحديات تطبيقية"))}</div></div><div class="track-progress"><strong>${number(st.percent)}<small>%</small></strong>${progressBar(st.percent)}<span>${number(st.completed)} / ${number(lessonList.length)} ${T("complete","مكتمل")}</span></div></section>
 <div class="track-grid"><section class="module-accordion">${moduleList.map(m=>{
 const ls=lessonList.filter(l=>l.moduleId===m.id),done=ls.filter(l=>lessonComplete(progressFor(l.id))).length;
 return `<details class="module-details" ${m.number===1?"open":""}><summary><span class="module-number">${String(m.number).padStart(2,"0")}</span><div><h2>${esc(tr(m.title))}</h2><span>${T("Suggested week","الأسبوع المقترح")} ${number(m.week)} · ${number(ls.length)} ${T("lessons","دروس")} · ${number(done)}/${number(ls.length)}</span></div>${icon("plus")}</summary><div class="module-detail-content"><p>${esc(tr(m.description))}</p>${ls.map(l=>lessonTile(l,true)).join("")}<a class="module-practice-link" href="#/practice/${m.practiceId}">${icon("layers")}${T("Apply this module in the practice lab","طبّق هذه الوحدة في المختبر")}${icon("arrow","directional")}</a></div></details>`;
 }).join("")}</section><aside class="sticky-stack"><div class="panel"><h3>${T("What completion means","ماذا يعني إتمام الدرس؟")}</h3><div class="check-list"><div>${icon("play")}<span>${T("90% unique measured playback coverage reported by the official player. Seeking past unwatched material does not count.","تغطية ٩٠٪ من الثواني المقاسة عبر المشغل الرسمي. تخطي المقاطع غير المشاهَدة لا يُحتسب.")}</span></div><div>${icon("target")}<span>${T("80% or higher on the knowledge check.","٨٠٪ أو أكثر في اختبار المعرفة.")}</span></div><div>${icon("pen")}<span>${T("A personal application reflection of at least 40 characters.","تأمل شخصي حول التطبيق لا يقل عن ٤٠ حرفًا.")}</span></div></div></div><div class="panel soft-panel"><div class="eyebrow">${T("THEN PUT IT TO WORK","ثم حوّله إلى عمل")}</div><h3>${T("Your leadership impact challenge","تحدي الأثر القيادي")}</h3><p>${T("Choose one small coordination, handoff, or communication problem. Record what you tried, what happened, and what remains uncertain.","اختر مشكلة صغيرة في التنسيق أو التسليم أو التواصل. سجل ما جربته، وما حدث، وما لا يزال غير مؤكد.")}</p>${routeLink("/capstone",T("Explore the challenge","استكشف التحدي"),"text-link")}</div>${notice(T("This is a developmental learning path, not a professional accreditation or employee ranking.","هذا مسار تعلم للتطوير، وليس اعتمادًا مهنيًا أو ترتيبًا للموظفين."))}</aside></div>`;
}
function libraryPage(savedOnly=false){
 const query=(route.params.get("q")||"").slice(0,100), mod=route.params.get("module")||"all", lang=route.params.get("lang")||"all";
 const filtered=lessonList.filter(l=>(!savedOnly||state.saved.includes(l.id))&&(lang==="all"||l.language===lang)&&(mod==="all"||l.moduleId===mod)&&(!query||`${l.title.en} ${l.title.ar} ${tr(getModule(l.moduleId).title)}`.toLowerCase().includes(query.toLowerCase())));
 return `${pageHead(T("CURATED LEARNING","تعلّم مختار بعناية"),savedOnly?T("Your saved lessons.","دروسك المحفوظة."):T("The leadership library.","مكتبة القيادة."),T("Explore Arabic and English materials, paired with original practice notes and knowledge checks.","استكشف مواد عربية وإنجليزية، مع ملاحظات تطبيقية واختبارات معرفة أُعدّت للمنصة."))}
 <form id="library-filter" class="filter-bar"><div class="search-field">${icon("search")}<label for="library-q" class="sr-only">${T("Search","ابحث")}</label><input id="library-q" name="q" maxlength="100" value="${esc(query)}" placeholder="${T("Search title, skill, or source...","ابحث بالعنوان أو المهارة أو المصدر...")}"></div><label class="select-wrap"><span class="sr-only">${T("Language","اللغة")}</span><select name="lang"><option value="all">${T("All languages","كل اللغات")}</option><option value="ar" ${lang==="ar"?"selected":""}>${T("Arabic","العربية")}</option><option value="en" ${lang==="en"?"selected":""}>${T("English","الإنجليزية")}</option></select></label><label class="select-wrap"><span class="sr-only">${T("Module","الوحدة")}</span><select name="module"><option value="all">${T("All modules","كل الوحدات")}</option>${moduleList.map(m=>`<option value="${m.id}" ${mod===m.id?"selected":""}>${esc(tr(m.title))}</option>`).join("")}</select></label><button class="btn btn-dark" type="submit">${icon("search")}${T("Search","بحث")}</button></form>
 <div class="results-line"><span>${number(filtered.length)} ${T("lessons","درسًا")}</span><span>${T("Leadership Foundation · Public source links","أساسيات القيادة · روابط المصادر العامة")}</span></div>
 ${filtered.length?`<div class="lesson-grid library-grid">${filtered.map(l=>lessonTile(l)).join("")}</div>`:emptyState(savedOnly?"bookmark":"search",savedOnly?T("Keep good learning close.","احتفظ بالتعلّم المفيد."):T("No lessons match these filters.","لا توجد دروس تطابق هذه الخيارات."),savedOnly?T("Use the bookmark on any lesson to keep it here.","استخدم علامة الحفظ على أي درس ليظهر هنا."):T("Try a shorter search or choose another module.","جرّب بحثًا أقصر أو اختر وحدة أخرى."),routeLink("/library",T("Explore all lessons","استكشف كل الدروس"),"btn btn-dark"))}`;
}
function lessonRequirements(l){
 const p=progressFor(l.id), ready=lessonComplete(p);
 return `<div class="lesson-checks ${ready?"all-done":""}" id="lesson-checks"><div class="${viewingComplete(p)?"done":""}">${icon(viewingComplete(p)?"checkCircle":"play")}<span>${T("Viewing","المشاهدة")}</span><strong>${number(coverage(p))+"%"}</strong></div><div class="${(p.bestScore||0)>=PASS_SCORE?"done":""}">${icon((p.bestScore||0)>=PASS_SCORE?"checkCircle":"target")}<span>${T("Quiz","الاختبار")}</span><strong>${p.attempts?.length?number(p.bestScore)+"%":T("Not started","لم يبدأ")}</strong></div><div class="${(p.reflection||"").trim().length>=REFLECTION_MIN?"done":""}">${icon((p.reflection||"").trim().length>=REFLECTION_MIN?"checkCircle":"pen")}<span>${T("Reflection","التأمل")}</span><strong>${(p.reflection||"").trim().length>=REFLECTION_MIN?T("Saved","محفوظ"):T("Write a next action","اكتب خطوتك التالية")}</strong></div></div>${ready?`<div class="completion-message">${icon("checkCircle")}${T("Lesson complete. Take one idea into your next conversation.","اكتمل الدرس. طبّق فكرة واحدة في محادثتك التالية.")}</div>`:""}`;
}
function quizMarkup(l){
 const qs=questionBank[l.id],draft=state.quizDrafts[l.id];
 const watched=coverage(progressFor(l.id));
 if(!draft&&!canAttemptQuiz(progressFor(l.id)))return `<div class="quiz-intro"><div class="quiz-intro-icon">${icon("lock")}</div><div><div class="eyebrow">${T("CHECK YOUR UNDERSTANDING","اختبر فهمك")}</div><h2>${T("Watch first, then check.","شاهد أولًا، ثم اختبر.")}</h2><p>${T("The knowledge check unlocks after 90% measured playback. Hidden-tab playback is not counted.","يُفتح اختبار المعرفة بعد ٩٠٪ من التشغيل المقاس. لا يُحتسب التشغيل والتبويب مخفي.")}</p><div class="inline-meta">${pill(T("Locked","مغلق"),"muted")}${pill(number(watched)+"% "+T("watched","مشاهَدة"))}${pill(T("90% to unlock","٩٠٪ للفتح"),"accent")}</div></div></div>`;
 if(!draft)return `<div class="quiz-intro"><div class="quiz-intro-icon">${icon("target")}</div><div><div class="eyebrow">${T("CHECK YOUR UNDERSTANDING","اختبر فهمك")}</div><h2>${T("Make the ideas stick.","ثبّت ما تعلمته.")}</h2><p>${T("A mix of concepts, application, and hypothetical KAD workplace scenarios.","مزيج من المفاهيم والتطبيق ومواقف افتراضية مرتبطة ببيئة عمل KAD.")}</p><div class="inline-meta">${pill(number(qs.length)+" "+T("questions","أسئلة"))}${pill(T("80% to pass","٨٠٪ للنجاح"))}${pill(T("Unlimited formative retries","إعادة تكوينية دون حد"))}</div><button class="btn btn-red" data-action="start-quiz" data-id="${l.id}">${T("Start the knowledge check","ابدأ اختبار المعرفة")}${icon("arrow","directional")}</button></div></div>`;
 const order=Array.isArray(draft.order)?draft.order:qs.map(q=>q.id);
 const ordered=order.map(id=>qs.find(q=>q.id===id)).filter(Boolean);
 const result=draft.submitted?calculateScore(qs,draft.answers||{}):null;
 return `${result?`<div class="quiz-result ${result.passed?"passed":"retry"}"><div class="result-number">${number(result.percent)}<small>%</small></div><div><h2>${result.passed?T("A strong step forward.","خطوة موفقة للأمام."):T("A chance to strengthen your understanding.","فرصة لتقوية فهمك.")}</h2><p>${number(result.correct)} ${T("correct out of","إجابة صحيحة من")} ${number(result.total)}. ${T("Read every explanation, then apply the lesson.","اقرأ تفسير كل إجابة، ثم طبّق الدرس.")}</p><span>${T("Best recorded score: ","أفضل درجة مسجلة: ")}${number(progressFor(l.id).bestScore||0)}%</span></div></div>`:`<div class="quiz-header"><div><div class="eyebrow">${T("KNOWLEDGE CHECK","اختبار المعرفة")}</div><h2>${number(qs.length)} ${T("questions. One clear next step.","أسئلة. وخطوة تالية واضحة.")}</h2></div><span id="answered-count">${number(Object.keys(draft.answers||{}).length)} / ${number(qs.length)}</span></div>`}
 <form id="quiz-form" data-id="${l.id}" novalidate>
 ${ordered.map((q,idx)=>{
 const options=(draft.optionOrder?.[q.id]||q.options.map(o=>o.id)).map(id=>q.options.find(o=>o.id===id)).filter(Boolean);
 return `<fieldset class="quiz-question ${result?(draft.answers[q.id]===q.correctId?"question-correct":"question-wrong"):""}"><legend><span class="question-num">${String(idx+1).padStart(2,"0")}</span>${esc(tr(q.prompt))}</legend><div class="quiz-options">${options.map((o,oi)=>{
 const selected=draft.answers?.[q.id]===o.id,correct=q.correctId===o.id;
 return `<label class="quiz-option ${selected?"selected":""} ${result&&correct?"correct-option":""} ${result&&selected&&!correct?"wrong-option":""}"><input type="radio" name="${q.id}" value="${o.id}" ${selected?"checked":""} ${result?"disabled":""}><span class="option-letter">${String.fromCharCode(65+oi)}</span><span>${esc(tr(o.text))}</span>${result&&correct?icon("checkCircle"):""}</label>`;
 }).join("")}</div>${result?`<div class="answer-explanation">${icon(draft.answers[q.id]===q.correctId?"checkCircle":"info")}<span>${esc(tr(q.explanation))}</span></div>`:""}</fieldset>`;
 }).join("")}
 <div class="form-error" id="quiz-error" role="alert"></div><div class="quiz-submit">${result?`<button class="btn btn-outline" type="button" data-action="retry-quiz" data-id="${l.id}">${T("Try again with a new order","أعد المحاولة بترتيب جديد")}</button><a class="btn btn-red" href="#reflection" data-action="focus-reflection">${T("Write your next action","اكتب خطوتك التالية")}${icon("arrow","directional")}</a>`:`<span class="small muted">${T("Answers are saved as you go, on this device.","تُحفظ اختياراتك أثناء الحل على هذا الجهاز.")}</span><button class="btn btn-red" type="submit">${T("Submit answers","تسليم الإجابات")}${icon("arrow","directional")}</button>`}</div></form>`;
}
function welcomePage(){
 const card=(lang,title,sub)=>`<button class="lang-card" data-action="choose-language" data-lang="${lang}"><span class="lang-card-title">${title}</span><span class="lang-card-sub">${sub}</span></button>`;
 return `<div class="lang-gate"><div class="lang-gate-brand"><span class="brand-logo"><img src="./assets/kad-logo.png" data-kad-logo alt="Kader & Associates Designs"></span><span class="brand-caption">GROWTH <span>ACADEMY</span></span></div><h1>Choose your learning language</h1><p class="lang-gate-sub">اختر لغة التعلّم · Your journey, your language. Changing language later never deletes progress.</p><div class="lang-gate-grid">${card("ar","العربية","واجهة عربية كاملة مع أولوية للدروس العربية")}${card("en","English","A complete English interface with English lessons prioritized")}</div><p class="lang-gate-note">${T("Progress is stored on this device and browser. Lessons in both languages are always available in the library.","يُحفظ التقدم على هذا الجهاز والمتصفح. دروس اللغتين متاحة دائمًا في المكتبة.")}</p></div>`;
}
function lessonPage(id){
 const l=getLesson(id);if(!l)return notFoundPage();
 const m=getModule(l.moduleId),p=progressFor(id), index=lessonList.indexOf(l),ls=lessonList.filter(x=>x.moduleId===m.id);
 const vid=effectiveVideo(l),ytUrl=`https://www.youtube.com/watch?v=${vid}`;
 state.lastLesson=id;persist();
 return `<div class="lesson-breadcrumb"><a href="#/leadership">${T("Leadership Foundation","أساسيات القيادة")}</a>${icon("chevron","directional")}<span>${esc(tr(m.title))}</span></div>
 <div class="lesson-heading"><div><div class="eyebrow">${T("MODULE","الوحدة")} ${String(m.number).padStart(2,"0")} <span> / </span> ${T("LESSON","الدرس")} ${String(index+1).padStart(2,"0")}</div><h1>${esc(tr(l.title))}</h1><div class="inline-meta"><span>${langLabel(l.language)}</span><span>${difficultyLabel(l.difficulty)}</span><span>${number(l.questionCount)} ${T("questions","أسئلة")}</span></div></div><button class="btn btn-outline ${state.saved.includes(id)?"is-saved":""}" data-action="save-lesson" data-id="${id}" aria-pressed="${state.saved.includes(id)}">${icon("bookmark")}${T("Save lesson","حفظ الدرس")}</button></div>
 <div class="lesson-layout"><div class="lesson-main">
 <div class="video-container"><div id="video-mount" class="video-consent"><div class="video-decoration">${icon(m.icon)}</div><span class="video-source-label">KAD GROWTH <span> / </span> ${l.language==="ar"?"AR":"EN"}</span><div class="consent-content"><button class="play-button" data-action="load-video" data-id="${id}" aria-label="${T("Load YouTube player","تحميل مشغل يوتيوب")}">${icon("play")}</button><h2>${T("A new perspective starts here.","من هنا تبدأ رؤية جديدة.")}</h2><p>${T("Load the official YouTube player to watch. YouTube will receive technical data only after you choose to load it.","حمّل مشغل يوتيوب الرسمي للمشاهدة. لن يُطلب المشغل إلا بعد اختيارك، وعندها يستقبل يوتيوب بيانات تقنية.")}</p><button class="btn btn-white" data-action="load-video" data-id="${id}">${T("Load video","تحميل الفيديو")}${icon("play")}</button></div></div></div>
 <div class="video-toolbar"><div>${icon("clock")}<span id="video-duration">${p.duration?formatTime(p.duration):T("Duration available in the player","المدة تظهر عند تحميل المشغل")}</span></div>${extLink(ytUrl,T("Open video","افتح الفيديو"))}</div>
 <div id="player-message"></div>
  <div id="lesson-completion">${lessonRequirements(l)}</div>
 <div class="lesson-tab-nav"><a href="#lesson-notes" data-section="lesson-notes">${T("Practice notes","ملاحظات التطبيق")}</a><a href="#knowledge-check" data-section="knowledge-check">${T("Knowledge check","اختبار المعرفة")}</a><a href="#reflection" data-section="reflection">${T("Your next action","خطوتك التالية")}</a></div>
 <section class="panel lesson-brief" id="lesson-notes"><div class="eyebrow">${T("ORIGINAL KAD LEARNING NOTES","ملاحظات تعليمية أُعدّت للمنصة")}</div><h2>${T("From idea to everyday practice.","من الفكرة إلى الممارسة اليومية.")}</h2><div class="objectives">${l.objectives.map(o=>`<div>${icon("checkCircle")}<span>${esc(tr(o))}</span></div>`).join("")}</div>${l.brief.map((s,i)=>`<div class="brief-point"><span>${String(i+1).padStart(2,"0")}</span><p>${esc(tr(s))}</p></div>`).join("")}<div class="application-callout">${icon("briefcase")}<div><strong>${T("Try this at work","جرّب هذا في العمل")}</strong><p>${esc(tr(l.application))}</p></div></div><p class="editorial-note">${T("These notes and quizzes are independently authored topic-aligned practice, not a video transcript or an official assessment by the source. Full transcript and corporate reuse review remain required before an institutionally approved rollout.","هذه الملاحظات والاختبارات تطبيقات مستقلة مرتبطة بموضوع الدرس، وليست تفريغًا للفيديو أو اختبارًا رسميًا من الجهة المصدر. تظل مراجعة التفريغ وحقوق الاستخدام المؤسسي مطلوبة قبل إطلاق معتمد من المؤسسة.")}</p></section>
 <section class="panel quiz-panel" id="knowledge-check">${quizMarkup(l)}</section>
 <section class="panel reflection-panel" id="reflection"><div class="eyebrow">${T("TURN LEARNING INTO ACTION","حوّل التعلّم إلى إجراء")}</div><h2>${T("What will you do differently?","ما الذي ستفعله بشكل مختلف؟")}</h2><p>${T("Name one real behavior to try, the context, and how you will know it helped. Avoid client names, confidential drawings, or sensitive project information.","سمِّ سلوكًا ستجربه وسياقه وكيف ستعرف أنه أفاد. تجنب أسماء العملاء والرسومات السرية وبيانات المشاريع الحساسة.")}</p><label for="lesson-reflection" class="sr-only">${T("Your application reflection","تأملك حول التطبيق")}</label><textarea id="lesson-reflection" data-id="${id}" rows="5" maxlength="4000" placeholder="${T("In my next coordination meeting, I will...","في اجتماع التنسيق التالي، سأقوم بـ...")}">${esc(p.reflection||"")}</textarea><div class="field-footer"><span id="reflection-length">${number((p.reflection||"").trim().length)} / ${number(REFLECTION_MIN)} ${T("minimum characters","حرفًا كحد أدنى")}</span><span id="reflection-saved">${localLabel()}</span></div><button class="btn btn-dark" data-action="save-reflection" data-id="${id}">${icon("check")}${T("Save reflection","حفظ التأمل")}</button></section>
 <div class="lesson-bottom-nav">${index>0?routeLink(`/learn/${lessonList[index-1].id}`,T("Previous lesson","الدرس السابق"),"btn btn-outline","back"):"<span></span>"}${index<lessonList.length-1?routeLink(`/learn/${lessonList[index+1].id}`,T("Next lesson","الدرس التالي"),"btn btn-red","arrow"):routeLink("/capstone",T("Go to impact challenge","انتقل لتحدي الأثر"),"btn btn-red")}</div>
 </div><aside class="lesson-sidebar"><div class="panel in-module"><div class="eyebrow">${T("IN THIS MODULE","في هذه الوحدة")}</div><h3>${esc(tr(m.title))}</h3>${ls.map((x,i)=>`<a class="module-lesson ${x.id===id?"current":""}" href="#/learn/${x.id}"><span>${lessonComplete(progressFor(x.id))?icon("check"):String(i+1).padStart(2,"0")}</span><div>${esc(tr(x.title))}<small>${langLabel(x.language)} · ${number(x.questionCount)} ${T("questions","أسئلة")}</small></div></a>`).join("")}<a class="module-lesson practice-entry" href="#/practice/${m.practiceId}">${icon("layers")}<div>${T("Apply the module","طبّق الوحدة")}<small>${T("A hypothetical KAD scenario","موقف افتراضي لبيئة KAD")}</small></div></a></div>
 <div class="panel"><span class="tool-icon">${icon("briefcase")}</span><h3>${T("A tool for your next meeting.","أداة لاجتماعك التالي.")}</h3><p>${T("Put the idea into a simple, editable canvas.","حوّل الفكرة إلى نموذج بسيط قابل للتعديل.")}</p>${routeLink(`/toolkit/${tools.find(t=>t.moduleId===m.id)?.id}`,T("Open the toolkit","افتح الأداة"),"text-link")}</div>
 <div class="panel note-quick"><h3>${T("Capture an idea","سجل فكرة")}</h3><label class="sr-only" for="quick-note">${T("Personal note","ملاحظة شخصية")}</label><textarea id="quick-note" rows="4" maxlength="4000" placeholder="${T("An idea worth keeping...","فكرة تستحق الاحتفاظ...")}"></textarea><button class="btn btn-outline btn-full" data-action="quick-note" data-id="${id}">${icon("plus")}${T("Add to my notes","أضف إلى ملاحظاتي")}</button></div>
 <p class="small muted">${T("Video language and interface language are independent. Caption availability is not pre-verified; check the player's CC control.","لغة الفيديو مستقلة عن لغة الواجهة. توافر الترجمة غير متحقق منه مسبقًا؛ راجع زر CC في المشغل.")}</p></aside></div>`;
}

function practicePage(){
 const done=cases.filter(c=>state.practices[c.id]?.status==="submitted").length;
 return `${pageHead(T("THE KAD PRACTICE LAB","مختبر KAD للتطبيق"),T("Lead the situation.","قُد الموقف."),T("Nine hypothetical design-workplace situations. Practice your response before the real conversation.","تسعة مواقف افتراضية في بيئة التصميم. تدرّب على استجابتك قبل المحادثة الحقيقية."),pill(`${number(done)} / ${number(cases.length)} `+T("submitted","تطبيقات مُسلّمة"),"accent"))}
 ${notice(T("These scenarios are invented for learning, not reports of actual KAD incidents. Technical, safety, contractual, and employment decisions remain with the authorized people and company processes.","هذه سيناريوهات مؤلفة للتعلم، وليست وقائع حدثت في KAD. تظل القرارات التقنية والسلامة والعقود والتوظيف لدى المخولين ووفق عمليات الشركة."))}
 <div class="case-grid">${cases.map((c,i)=>{const p=state.practices[c.id],m=getModule(c.moduleId);return `<a class="case-card" href="#/practice/${c.id}"><div class="case-card-top"><span class="case-number">${String(i+1).padStart(2,"0")}</span>${icon(m.icon)}</div><div class="eyebrow">${esc(tr(m.title))}</div><h2>${esc(tr(c.title))}</h2><p>${esc(tr(c.summary))}</p><div class="case-card-bottom">${p?.status==="submitted"?pill(T("Self-reviewed & submitted","مُراجع ذاتيًا ومُسلّم"),"complete"):p?pill(T("Draft saved","مسودة محفوظة"),"accent"):pill(T("15-minute practice","تطبيق مقترح: ١٥ دقيقة"),"muted")}${icon("arrow","directional")}</div></a>`;}).join("")}</div>`;
}
function renderFields(fields,values={},minimum=0){
 return fields.map(f=>`<div class="form-field"><label for="field-${f.id}">${esc(tr(f.label))}${minimum?'<span class="required-mark">*</span>':""}</label>${f.hint?`<p class="field-hint" id="hint-${f.id}">${esc(tr(f.hint))}</p>`:""}<textarea id="field-${f.id}" name="${f.id}" rows="3" maxlength="4000" ${f.hint?`aria-describedby="hint-${f.id}"`:""}>${esc(values[f.id]||"")}</textarea><span class="field-error" id="error-${f.id}"></span></div>`).join("");
}
function casePage(id){
 const c=cases.find(c=>c.id===id);if(!c)return notFoundPage();
 const p=state.practices[id]||{fields:{},rubric:[],status:"draft"};
 return `${pageHead(T("PRACTICE LAB · HYPOTHETICAL SCENARIO","مختبر التطبيق · موقف افتراضي"),tr(c.title),tr(c.summary),routeLink("/practice",T("All scenarios","كل المواقف"),"btn btn-outline","back"))}
 <div class="two-col form-layout"><section><div class="scenario-context"><div class="eyebrow">${T("THE SITUATION","الموقف")}</div><p>${esc(tr(c.context))}</p><div class="inline-meta">${pill(tr(getModule(c.moduleId).title))}${pill(T("No confidential project data","دون بيانات مشاريع سرية"))}</div></div>
 <form id="practice-form" data-id="${id}" class="panel" novalidate><div class="section-heading"><h2>${T("Design your response","صمّم استجابتك")}</h2><span class="save-status">${p.status==="submitted"?T("Submitted locally","مُسلّم محليًا"):localLabel()}</span></div><p class="muted small">${T("At least 30 characters in each field. Drafts do not need to meet the minimum.","٣٠ حرفًا على الأقل في كل حقل. يمكن حفظ المسودة دون استيفاء الحد الأدنى.")}</p>${renderFields(c.fields,p.fields,30)}
 <div class="self-review"><h3>${T("Review your own response","راجع استجابتك ذاتيًا")}</h3>${c.rubric.map((r,i)=>`<label class="checkbox-label"><input type="checkbox" name="rubric-${i}" ${p.rubric?.includes(i)?"checked":""}><span>${esc(tr(r))}</span></label>`).join("")}</div><div class="form-error" id="practice-error" role="alert"></div><div class="form-actions"><button class="btn btn-outline" type="submit" name="intent" value="draft">${T("Save draft","حفظ المسودة")}</button><button class="btn btn-red" type="submit" name="intent" value="submit">${T("Submit self-reviewed practice","تسليم التطبيق المُراجع ذاتيًا")}${icon("check")}</button></div></form></section>
 <aside class="sticky-stack"><div class="panel"><h3>${T("Before you submit","قبل التسليم")}</h3><p>${T("Make the next action, decision owner, and boundary clear. A good response does not need to sound like a textbook.","وضح الخطوة التالية وصاحب القرار وحدود الصلاحية. لا تحتاج الاستجابة الجيدة إلى لغة كتاب دراسي.")}</p></div>
 <details class="panel model-answer" ${p.status==="submitted"?"open":""}><summary>${icon("book")}${T("Compare with an example approach","قارن بمثال لطريقة المعالجة")}</summary><p>${esc(tr(c.modelAnswer))}</p><small>${T("An example, not the only valid response or a technical approval.","مثال، وليس الاستجابة الصحيحة الوحيدة أو اعتمادًا تقنيًا.")}</small></details>
 <div class="panel"><h3>${T("Take it into a real conversation","طبّقه في محادثة حقيقية")}</h3><p>${T("Invite a colleague to review your proposed action. No manager approval is claimed by the open edition.","اطلب من زميل مراجعة إجراءك المقترح. النسخة المفتوحة لا تدّعي وجود اعتماد من المدير.")}</p>${routeLink("/toolkit/"+tools.find(t=>t.moduleId===c.moduleId)?.id,T("Use the matching tool","استخدم الأداة المرتبطة"),"text-link")}</div></aside></div>`;
}
function toolkitPage(id){
 if(id){
  const tool=tools.find(t=>t.id===id);if(!tool)return notFoundPage();
  return `${pageHead(T("LEADERSHIP TOOLKIT","أدوات القيادة"),tr(tool.title),T("A simple working canvas. Adapt it to the role, project, and authority you actually have.","نموذج عمل بسيط. عدّله حسب دورك ومشروعك وصلاحيتك الفعلية."),routeLink("/toolkit",T("All tools","كل الأدوات"),"btn btn-outline","back"))}
  <div class="two-col form-layout"><form class="panel" id="tool-form" data-id="${id}">${renderFields(tool.fields,state.toolValues[id]||{})}<div class="form-actions"><button class="btn btn-dark" type="submit">${icon("check")}${T("Save canvas","حفظ النموذج")}</button><button class="btn btn-outline" type="button" data-action="download-tool" data-id="${id}">${icon("download")}${T("Download text","تنزيل كنص")}</button></div></form><aside class="sticky-stack"><div class="panel"><h3>${T("Small enough to use.","بسيط بما يكفي للاستخدام.")}</h3><p>${T("Use short, concrete statements. Name an owner or checkpoint where helpful. Blank fields are allowed while drafting.","استخدم عبارات قصيرة ومحددة. سمِّ مسؤولًا أو نقطة متابعة عند الحاجة. يمكن ترك حقول فارغة أثناء الصياغة.")}</p></div>${notice(T("This canvas is stored in your browser. Do not paste client names, confidential specifications, drawings, or personal employee information.","يُحفظ هذا النموذج في متصفحك. لا تلصق أسماء العملاء أو المواصفات والرسومات السرية أو المعلومات الشخصية للموظفين."))}</aside></div>`;
 }
 return `${pageHead(T("THE LEADERSHIP TOOLKIT","حقيبة أدوات القيادة"),T("Tools that turn ideas into action.","أدوات تحوّل الأفكار إلى عمل."),T("Nine original, editable canvases for clearer conversations and better handoffs.","تسعة نماذج أصلية قابلة للتعديل لمحادثات أوضح وتسليمات أفضل."))}
 <div class="tool-grid">${tools.map((t,i)=>`<a class="tool-card" href="#/toolkit/${t.id}"><div class="tool-icon">${icon(getModule(t.moduleId).icon)}</div><span class="tool-number">${String(i+1).padStart(2,"0")}</span><h2>${esc(tr(t.title))}</h2><p>${esc(tr(getModule(t.moduleId).title))}</p><div class="tool-fields-preview">${t.fields.slice(0,3).map(f=>`<span>${esc(tr(f.label))}</span>`).join("")}</div><div class="tool-card-bottom"><span>${state.toolValues[t.id]?T("Saved canvas","نموذج محفوظ"):T("Editable · Text export","قابل للتعديل · تصدير نصي")}</span>${icon("arrow","directional")}</div></a>`).join("")}</div>`;
}
const assessmentItems=[
 ["essentials", "I clarify a shared outcome before organizing work.","أوضح نتيجة مشتركة قبل تنظيم العمل."],
 ["self-awareness","I can describe one behavior I need to improve and its impact.","أستطيع وصف سلوك أحتاج لتحسينه وأثره."],
 ["emotional-intelligence","I pause and choose a constructive response under pressure.","أتوقف وأختار استجابة بنّاءة تحت الضغط."],
 ["communication","I confirm decisions, owners, and deadlines rather than assume agreement.","أؤكد القرارات والمسؤولين والمواعيد بدل افتراض الاتفاق."],
 ["trust","I respond constructively when someone raises a concern or mistake.","أستجيب بشكل بنّاء عندما يطرح شخص قلقًا أو خطأ."],
 ["delegation","I make outcomes, support, and authority boundaries clear in a handoff.","أوضح النتائج والدعم وحدود الصلاحية عند تسليم مهمة."],
 ["feedback","I give specific feedback and invite the other person's perspective.","أقدم ملاحظات محددة وأطلب وجهة نظر الطرف الآخر."],
 ["conflict","I separate facts and constraints from personal assumptions in disagreements.","أفصل الحقائق والقيود عن الافتراضات الشخصية في الخلافات."],
 ["teams","I help my team agree how to coordinate, review, and escalate.","أساعد فريقي على الاتفاق على التنسيق والمراجعة والتصعيد."]
];
function assessmentPage(){
 const phase=route.params.get("phase")==="post"?"post":"pre",record=state.assessments[phase],values=record?.values||{};
 return `${pageHead(T("SELF-AWARENESS FIRST","الوعي الذاتي أولًا"),T("Know where you are starting.","اعرف من أين تبدأ."),T("Reflect on observable behaviors. This is a personal development check-in, not a validated psychological or employment assessment.","تأمل سلوكيات قابلة للملاحظة. هذه مراجعة شخصية للتطوير، وليست تقييمًا نفسيًا أو وظيفيًا معتمدًا."))}
 <div class="segmented"><a class="${phase==="pre"?"active":""}" href="#/assessment?phase=pre">${T("Before the program","قبل البرنامج")}</a><a class="${phase==="post"?"active":""}" href="#/assessment?phase=post">${T("After the program","بعد البرنامج")}</a></div>
 <div class="assessment-layout"><form id="assessment-form" data-phase="${phase}" class="panel" novalidate><div class="rating-key"><span>1 · ${T("Rarely","نادرًا")}</span><span>3 · ${T("Sometimes","أحيانًا")}</span><span>5 · ${T("Consistently","باستمرار")}</span></div>${assessmentItems.map(([id,en,ar],idx)=>`<fieldset class="assessment-item"><legend><span>${String(idx+1).padStart(2,"0")}</span>${T(en,ar)}</legend><div class="rating-options">${[1,2,3,4,5].map(n=>`<label><input type="radio" name="${id}" value="${n}" ${Number(values[id])===n?"checked":""}><span>${number(n)}</span></label>`).join("")}<label class="not-applicable"><input type="radio" name="${id}" value="0" ${values[id]===0?"checked":""}><span>${T("Not observed","لم ألاحظه")}</span></label></div></fieldset>`).join("")}<div class="form-field"><label for="assessment-focus">${T("One behavior I want to practice","سلوك واحد أريد ممارسته")}</label><textarea id="assessment-focus" name="focus" rows="3" maxlength="1000">${esc(record?.focus||"")}</textarea></div><div class="form-error" id="assessment-error" role="alert"></div><button class="btn btn-red" type="submit">${T("Save my reflection","احفظ مراجعتي")}${icon("check")}</button></form>
 <aside class="sticky-stack"><div class="panel"><div class="tool-icon">${icon("target")}</div><h2>${T("Be specific.<br>Be honest.","كن محددًا.<br>وكن صادقًا.")}</h2><p>${T("Think about your last few working weeks. Use “Not observed” when your role has not given you a chance to practice a behavior.","فكّر في أسابيع العمل الأخيرة. اختر «لم ألاحظه» عندما لا يتيح لك دورك فرصة لممارسة السلوك.")}</p><p>${T("Your self-ratings stay separate from quiz scores. Neither is a measure of your worth or a promotion recommendation.","تبقى تقديراتك الذاتية منفصلة عن درجات الاختبارات. ولا يقيس أي منهما قيمتك أو يمثل توصية بالترقية.")}</p>${record?`<span class="small muted">${T("Last saved: ","آخر حفظ: ")}${dateLabel(record.at,state.language)}</span>`:""}</div>${routeLink("/progress",T("See my progress","عرض تقدمي"),"btn btn-outline")}</aside></div>`;
}
function progressPage(){
 const st=stats(),p=state.assessments.pre?.values||{},post=state.assessments.post?.values||{};
 return `${pageHead(T("YOUR DEVELOPMENT, NOT A LEADERBOARD","تطورك، وليس ترتيبًا للموظفين"),T("See the progress you are making.","شاهد التقدم الذي تحرزه."),T("Learning completion, knowledge checks, and self-reflection are shown separately. No composite competence score is invented.","نعرض إتمام التعلم واختبارات المعرفة والتأمل الذاتي بشكل منفصل، دون اختلاق درجة مركبة للكفاءة."),routeLink("/settings",T("Export my record","تصدير سجلي"),"btn btn-outline","download"))}
 <div class="progress-overview"><div class="progress-ring" style="--progress:${st.percent*3.6}deg"><div><strong>${number(st.percent)}<small>%</small></strong><span>${T("Learning complete","اكتمال التعلم")}</span></div></div><div><h2>${number(st.completed)} ${T("lessons completed. Every step counts.","درسًا مكتملًا. كل خطوة لها قيمة.")}</h2><p>${T("A completed lesson includes measured viewing, a passed quiz, and an application reflection.","الدرس المكتمل يتضمن مشاهدة مقاسة، واختبارًا ناجحًا، وتأملًا حول التطبيق.")}</p>${routeLink(`/learn/${nextLesson(lessonList,state,state.language).id}`,T("Take the next step","ابدأ الخطوة التالية"),"btn btn-red")}</div><div class="progress-summary"><span>${T("Average best quiz score","متوسط أفضل درجات الاختبارات")}</span><strong>${st.knowledgeAverage===null?"—":number(st.knowledgeAverage)+"%"}</strong><small>${T("Knowledge check, not leadership ability.","اختبار معرفة، وليس قدرة قيادية.")}</small></div></div>
 ${sectionHead(T("Module by module","وحدة بوحدة"))}<div class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>${T("Module","الوحدة")}</th><th>${T("Lessons","الدروس")}</th><th>${T("Practice","التطبيق")}</th><th>${T("Progress","التقدم")}</th></tr></thead><tbody>${moduleList.map(m=>{const s=completionStats(lessonList.filter(l=>l.moduleId===m.id),state.progress);return `<tr><td><a href="#/learn/${lessonList.find(l=>l.moduleId===m.id).id}"><span class="table-number">${String(m.number).padStart(2,"0")}</span>${esc(tr(m.title))}</a></td><td>${number(s.completed)}/${number(s.total)}</td><td>${state.practices[m.practiceId]?.status==="submitted"?pill(T("Self-reviewed","مُراجع ذاتيًا"),"complete"):pill(T("Not submitted","لم يُسلّم"),"muted")}</td><td><div class="table-progress">${progressBar(s.percent)}<span>${number(s.percent)}%</span></div></td></tr>`;}).join("")}</tbody></table></div></div>
 ${sectionHead(T("Your self-reflection, before and after","تأملك الذاتي، قبل وبعد"),routeLink("/assessment",T("Update reflection","تحديث المراجعة"),"text-link"))}<div class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>${T("Behavior area","مجال السلوك")}</th><th>${T("Before / 5","قبل / ٥")}</th><th>${T("After / 5","بعد / ٥")}</th></tr></thead><tbody>${moduleList.map(m=>`<tr><td>${esc(tr(m.title))}</td><td>${p[m.id]?number(p[m.id]):emptyDash()}</td><td>${post[m.id]?number(post[m.id]):emptyDash()}</td></tr>`).join("")}</tbody></table></div></div>
 ${notice(T("Self-reported changes are not evidence that the program caused an improvement. Keep context, workplace opportunities, and other influences in mind.","التغيرات المبلغ عنها ذاتيًا لا تثبت أن البرنامج سبّب التحسن. ضع السياق وفرص الممارسة والمؤثرات الأخرى في الاعتبار."))}`;
}
function notesPage(){
 return `${pageHead(T("YOUR THINKING SPACE","مساحة أفكارك"),T("Good ideas deserve a place.","الأفكار الجيدة تستحق مساحة."),T("Keep a note, a useful question, or a next action. Everything here stays on this browser.","احتفظ بملاحظة أو سؤال مفيد أو خطوة تالية. كل ما هنا يبقى على هذا المتصفح."),state.notes.length?`<button class="btn btn-outline" data-action="export-notes">${icon("download")}${T("Export notes","تصدير الملاحظات")}</button>`:"")}
 <div class="two-col notes-layout"><section><form class="panel" id="note-form"><h2>${T("Capture a thought","سجل فكرة")}</h2><div class="form-field"><label for="note-text">${T("Your note","ملاحظتك")}</label><textarea id="note-text" name="text" maxlength="4000" rows="5" placeholder="${T("What is worth remembering?","ما الذي يستحق التذكر؟")}" required></textarea></div><div class="form-field"><label for="note-lesson">${T("Link to a lesson (optional)","ربط بدرس (اختياري)")}</label><select id="note-lesson" name="lessonId"><option value="">${T("General note","ملاحظة عامة")}</option>${lessonList.map(l=>`<option value="${l.id}">${esc(tr(l.title))}</option>`).join("")}</select></div><button class="btn btn-red" type="submit">${icon("plus")}${T("Add note","أضف الملاحظة")}</button></form></section><section class="notes-list">${state.notes.length?[...state.notes].reverse().map(n=>`<article class="note-card"><div class="note-top"><span>${dateLabel(n.at,state.language)}</span><div><button class="icon-btn" data-action="edit-note" data-id="${esc(n.id)}" aria-label="${T("Edit note","تعديل الملاحظة")}">${icon("pen")}</button><button class="icon-btn" data-action="delete-note" data-id="${esc(n.id)}" aria-label="${T("Delete note","حذف الملاحظة")}">${icon("trash")}</button></div></div><p class="preserve-lines">${esc(n.text)}</p>${getLesson(n.lessonId)?`<a class="text-link small" href="#/learn/${n.lessonId}">${icon("book")}${esc(tr(getLesson(n.lessonId).title))}</a>`:""}</article>`).join(""):emptyState("pen",T("Your next insight goes here.","فكرتك التالية مكانها هنا."),T("Add a note here or from any lesson.","أضف ملاحظة هنا أو من داخل أي درس."))}</section></div>`;
}
const capstoneFields=[
 {id:"problem",label:{en:"The bounded problem",ar:"المشكلة المحددة"},hint:{en:"Describe one coordination, communication, or handoff issue without confidential identifiers.",ar:"صف مشكلة واحدة في التنسيق أو التواصل أو التسليم دون معرفات سرية."}},
 {id:"baseline",label:{en:"Starting point and context",ar:"نقطة البداية والسياق"},hint:{en:"What did you observe before acting? Note what you cannot measure.",ar:"ماذا لاحظت قبل الإجراء؟ وضح ما لا تستطيع قياسه."}},
 {id:"action",label:{en:"The leadership action",ar:"الإجراء القيادي"},hint:{en:"What did you actually try, with whom, and within which authority?",ar:"ما الذي جربته فعليًا؟ ومع من؟ وضمن أي صلاحية؟"}},
 {id:"evidence",label:{en:"Evidence and outcome",ar:"الدليل والنتيجة"},hint:{en:"Record observations or anonymized feedback. Do not invent numerical impact.",ar:"سجل ملاحظات أو آراء دون أسماء. لا تختلق أثرًا رقميًا."}},
 {id:"limits",label:{en:"Limits and other explanations",ar:"الحدود والتفسيرات الأخرى"},hint:{en:"What else may have influenced the result? What remains uncertain?",ar:"ما المؤثرات الأخرى المحتملة؟ وما الذي لا يزال غير مؤكد؟"}},
 {id:"next",label:{en:"What you will do next",ar:"ما الذي ستفعله لاحقًا"},hint:{en:"Choose a next step and a review date.",ar:"اختر خطوة تالية وموعد مراجعة."}}
];
function capstonePage(){
 const ready=lessonList.every(l=>lessonComplete(progressFor(l.id))),status=state.capstone.status;
 return `${pageHead(T("YOUR LEADERSHIP IMPACT CHALLENGE","تحدي الأثر القيادي"),T("One small change.<br>Real practice.".replace("<br>"," "), "تغيير صغير. وممارسة حقيقية."),T("Bring the nine modules together. Improve one working interaction, then document the action honestly.","اجمع الوحدات التسع في تطبيق واحد. حسّن تفاعلًا عمليًا واحدًا ثم وثّق الإجراء بصدق."),pill(status==="submitted"?T("Submitted locally","مُسلّم محليًا"):T("Draft","مسودة"),status==="submitted"?"complete":"muted"))}
 <div class="two-col form-layout"><section><div class="capstone-intro"><span class="tool-icon">${icon("flag")}</span><div><h2>${T("Small is a strength.","البداية الصغيرة قوة.")}</h2><p>${T("A clearer handoff, a better meeting, a respectful feedback conversation. Choose something you can actually influence.","تسليم أوضح، أو اجتماع أفضل، أو محادثة ملاحظات محترمة. اختر ما تستطيع التأثير فيه فعلًا.")}</p></div></div>
 <form class="panel" id="capstone-form" novalidate>${renderFields(capstoneFields,state.capstone.fields,40)}<label class="checkbox-label"><input type="checkbox" name="honest" ${state.capstone.honest?"checked":""}><span>${T("This describes my own activity. I have not included confidential information or claimed independent validation.","هذا وصف لنشاطي الشخصي، دون معلومات سرية أو ادعاء تحقق مستقل.")}</span></label><div class="form-error" id="capstone-error" role="alert"></div><div class="form-actions"><button class="btn btn-outline" type="submit" name="intent" value="draft">${T("Save draft","حفظ المسودة")}</button><button class="btn btn-red" type="submit" name="intent" value="submit">${T("Submit my challenge","تسليم التحدي")}${icon("check")}</button></div></form></section><aside class="sticky-stack"><div class="panel"><h3>${T("Your completion checklist","قائمة الإتمام")}</h3><div class="check-list"><div>${icon(ready?"checkCircle":"book")}<span>${T("Complete","أتمّ")} ${number(lessonList.length)} ${T("lessons.","درسًا.")}</span></div><div>${icon(cases.every(c=>state.practices[c.id]?.status==="submitted")?"checkCircle":"layers")}<span>${T("Submit","سلّم")} ${number(cases.length)} ${T("self-reviewed practices.","تطبيقات مراجعة ذاتيًا.")}</span></div><div>${icon(status==="submitted"?"checkCircle":"flag")}<span>${T("Submit this impact challenge.","سلّم تحدي الأثر هذا.")}</span></div></div></div><div class="panel soft-panel"><h3>${T("Draft now. Develop as you learn.","ابدأ المسودة. وطوّرها أثناء التعلم.")}</h3><p>${T("You can work on the challenge at any point. The personal completion record unlocks only after all learning and practice requirements are met.","يمكنك العمل على التحدي في أي وقت. يُفتح سجل الإتمام الشخصي بعد استيفاء متطلبات التعلم والتطبيق كاملة.")}</p>${routeLink("/achievements",T("View achievements","عرض الإنجازات"),"text-link")}</div>${notice(T("No manager has approved this submission in the open edition. It is a self-directed learning record.","لم يعتمد مدير هذا التسليم في النسخة المفتوحة؛ إنه سجل تعلّم ذاتي."))}</aside></div>`;
}
function achievementsPage(){
 const eligible=canIssueRecord(lessonList,cases,state);
 return `${pageHead(T("MILESTONES THAT MEAN SOMETHING","محطات لها معنى"),T("Earned through practice.","إنجازات تتحقق بالممارسة."),T("Module milestones reflect completed learning and submitted practice, not professional certification.","تعكس محطات الوحدات إتمام التعلم وتسليم التطبيق، وليست شهادات مهنية."))}
 <div class="achievement-feature ${eligible?"earned":""}"><div class="achievement-seal">${icon(eligible?"trophy":"lock")}</div><div><div class="eyebrow">KAD LEADERSHIP FOUNDATION</div><h2>${eligible?T("Your personal learning record is ready.","سجل تعلّمك الشخصي جاهز."):T("A journey worth completing.","رحلة تستحق الإتمام.")}</h2><p>${T("Complete","أكمل")} ${number(lessonList.length)} ${T("lessons, submit","درسًا، وسلّم")} ${number(cases.length)} ${T("practices, and finish the impact challenge to unlock a printable personal record.","تطبيقات، وأنهِ تحدي الأثر لفتح سجل شخصي قابل للطباعة.")}</p>${routeLink(eligible?"/certificate":"/progress",eligible?T("View my learning record","اعرض سجل تعلّمي"):T("Review my progress","راجع تقدمي"),"btn btn-red",eligible?"document":"arrow")}</div></div>
 <div class="badge-grid">${moduleList.map(m=>{const earned=lessonList.filter(l=>l.moduleId===m.id).every(l=>lessonComplete(progressFor(l.id)))&&state.practices[m.practiceId]?.status==="submitted";return `<div class="badge-card ${earned?"earned":"locked"}"><span class="badge-symbol">${icon(m.icon)}</span><span class="eyebrow">${T("MODULE","الوحدة")} ${String(m.number).padStart(2,"0")}</span><h3>${esc(tr(m.title))}</h3>${pill(earned?T("Learning milestone earned","تحققت محطة التعلم"):T("Keep learning","تابع التعلم"),earned?"complete":"muted")}<p>${T("Lessons + self-reviewed practice","الدروس + التطبيق المراجع ذاتيًا")}</p></div>`;}).join("")}</div>`;
}
function certificatePage(){
 const eligible=canIssueRecord(lessonList,cases,state);
 if(!eligible)return `${pageHead(T("PERSONAL LEARNING RECORD","سجل تعلم شخصي"),T("Your next milestone is ahead.","محطتك التالية أمامك."),"")}${emptyState("lock",T("Completion requirements are not yet met.","متطلبات الإتمام لم تُستوفَ بعد."),T("Complete every lesson, the nine self-reviewed practices, and the impact challenge.","أكمل جميع الدروس والتطبيقات التسعة المراجعة ذاتيًا وتحدي الأثر."),routeLink("/progress",T("See what remains","اعرض ما تبقى"),"btn btn-red"))}`;
 const generated=new Date().toISOString();
 return `${pageHead(T("PERSONAL LEARNING RECORD · NOT ACCREDITED","سجل تعلم شخصي · غير معتمد"),T("Your learning, recorded.","سجل يوثّق تعلّمك."),T("A printable record from this browser. It is not an independently verified credential.","سجل قابل للطباعة من هذا المتصفح، وليس مؤهلًا متحققًا منه بشكل مستقل."),`<button class="btn btn-red" data-action="print">${icon("document")}${T("Print record","طباعة السجل")}</button>`)}
 <article class="certificate" id="print-record"><div class="certificate-top"><div class="certificate-wordmark">KAD<span>GROWTH ACADEMY</span></div><span>LEARN. APPLY. LEAD.</span></div><div class="eyebrow">${T("PERSONAL RECORD OF LEARNING","سجل شخصي للتعلّم")}</div><h2>Leadership<br>Foundation</h2><div class="certificate-line"></div><p>${T("This browser records completion by","يسجل هذا المتصفح الإتمام باسم")}</p><h3>${esc(state.profile.name||T("Independent learner","متعلم ذاتي"))}</h3><p>${number(lessonList.length)} ${T("topic-aligned video lessons and knowledge checks,","درس فيديو واختبار معرفة مرتبطًا بموضوعه،")} ${number(cases.length)} ${T("self-reviewed workplace practices, and one leadership impact challenge.","تطبيق عمل مراجعة ذاتيًا، وتحدي أثر قيادي واحد.")}</p><div class="certificate-footer"><div><strong>${dateLabel(generated,state.language)}</strong><small>${T("Record generated","تاريخ إنشاء السجل")}</small></div><div><strong>OPEN EDITION · v1.0</strong><small>${T("Local, self-directed learning","تعلّم ذاتي مسجل محليًا")}</small></div></div><div class="certificate-disclaimer">${T("Not accredited, employer-verified, identity-verified, or issued by any external content provider. Viewing is measured playback coverage. This record can be edited through local storage and is not evidence for employment or professional licensing decisions.","غير معتمد، وغير متحقق منه من جهة العمل أو الهوية، وغير صادر عن أي مزود محتوى خارجي. المشاهدة تغطية مقاسة. يمكن تعديل السجل عبر التخزين المحلي؛ ولا يُستخدم كدليل لقرارات التوظيف أو الترخيص المهني.")}</div></article>`;
}
function profilePage(){
 const p=state.profile;
 return `${pageHead(T("YOUR LOCAL PROFILE","ملفك المحلي"),T("Make this space yours.","اجعل هذه المساحة لك."),T("No account is created. These preferences stay on this browser and can be exported or removed.","لا يتم إنشاء حساب. تبقى هذه التفضيلات على هذا المتصفح ويمكن تصديرها أو حذفها."))}
 <div class="two-col form-layout"><form id="profile-form" class="panel"><div class="profile-form-header"><div class="large-avatar">${p.name?esc(p.name[0]):icon("user")}</div><div><h2>${T("Personal learning profile","ملف التعلم الشخصي")}</h2><p>${localLabel()}</p></div></div>
 <div class="form-field"><label for="profile-name">${T("Display name (optional)","الاسم الظاهر (اختياري)")}</label><input id="profile-name" name="name" maxlength="100" value="${esc(p.name)}" autocomplete="nickname"></div>
 <div class="form-row"><div class="form-field"><label for="profile-department">${T("Working area","مجال العمل")}</label><select id="profile-department" name="department"><option value="">${T("Choose an area","اختر المجال")}</option>${["Architecture","Interior Design","Landscape","Urban Planning","MEP","Infrastructure","Project Management","Site Supervision","Business Support","Other"].map(x=>`<option ${p.department===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="form-field"><label for="profile-role">${T("Development stage","مرحلة التطور")}</label><select id="profile-role" name="role"><option value="">${T("Choose a stage","اختر المرحلة")}</option>${[["emerging",T("Emerging professional","مهني في بداية الرحلة")],["experienced",T("Experienced professional","مهني ذو خبرة")],["leader",T("Team leader","قائد فريق")],["manager",T("Manager","مدير")]].map(([v,t])=>`<option value="${v}" ${p.role===v?"selected":""}>${t}</option>`).join("")}</select></div></div>
 <div class="form-field"><label for="weekly-goal">${T("Weekly learning intention (minutes)","هدف التعلم الأسبوعي (بالدقائق)")}</label><input id="weekly-goal" name="weeklyGoal" type="number" min="15" max="600" step="15" value="${p.weeklyGoal}" required><p class="field-hint">${T("This is a goal you choose, not measured attendance.","هذا هدف تختاره، وليس حضورًا مُقاسًا.")}</p></div><button class="btn btn-red" type="submit">${T("Save my preferences","احفظ تفضيلاتي")}${icon("check")}</button></form>
 <aside class="sticky-stack"><div class="panel"><h3>${T("No password. No pressure.","دون كلمة مرور. ودون ضغط.")}</h3><p>${T("Start anywhere. Your profile is optional, and every Leadership lesson remains open.","ابدأ من أي مكان. الملف الشخصي اختياري، وكل دروس القيادة تظل مفتوحة.")}</p>${routeLink("/privacy",T("Understand your data","افهم بياناتك"),"text-link")}</div>${notice(T("Choosing a development stage does not grant permissions. Manager and admin screens currently operate only on your local browser data.","اختيار مرحلة التطور لا يمنح صلاحيات. تعمل شاشات المدير والإدارة حاليًا على بيانات متصفحك المحلية فقط."))}</aside></div>`;
}
function settingsPage(){
 return `${pageHead(T("YOUR WORKSPACE SETTINGS","إعدادات مساحتك"),T("Stay in control.","احتفظ بالتحكم."),T("Manage language, accessibility, and your local learning data.","أدر اللغة وإمكانية الوصول وبيانات تعلّمك المحلية."))}
 <div class="settings-grid"><section class="panel"><h2>${T("Experience","التجربة")}</h2><div class="setting-row"><div><strong>${T("Interface language","لغة الواجهة")}</strong><p>${T("Video audio stays in its source language.","يظل صوت الفيديو بلغته الأصلية.")}</p></div><button class="btn btn-outline" data-action="language">${state.language==="ar"?"English":"العربية"}</button></div><label class="setting-row"><div><strong>${T("Reduce motion","تقليل الحركة")}</strong><p>${T("Disable nonessential transitions.","إيقاف الانتقالات غير الضرورية.")}</p></div><input class="switch-input" type="checkbox" data-setting="reducedMotion" ${state.reducedMotion?"checked":""}></label><label class="setting-row"><div><strong>${T("Higher contrast","تباين أعلى")}</strong><p>${T("Strengthen secondary text and boundaries.","زيادة وضوح النصوص الثانوية والحدود.")}</p></div><input class="switch-input" type="checkbox" data-setting="highContrast" ${state.highContrast?"checked":""}></label>
<div class="setting-row"><div><strong>${T("Theme","المظهر")}</strong><p>${T("Choose how the interface appears.","اختر كيف يظهر واجهة المستخدم.")}</p></div>
<select class="theme-select" data-setting="theme"><option value="system" ${state.theme==="system"?"selected":""}>${T("System default","حسب النظام")}</option><option value="light" ${state.theme==="light"?"selected":""}>${T("Light","فاتح")}</option><option value="dark" ${state.theme==="dark"?"selected":""}>${T("Dark","داكن")}</option></select></div></section>
 <section class="panel"><h2>${T("Your data, your copy","بياناتك ونسختك")}</h2><p>${T("Browser data is not cloud-synced. Export a backup before switching devices or clearing browsing data. Import replaces this device's record after confirmation.","بيانات المتصفح غير متزامنة سحابيًا. صدّر نسخة قبل تغيير الأجهزة أو مسح بيانات المتصفح. يستبدل الاستيراد سجل هذا الجهاز بعد التأكيد.")}</p><div class="data-actions"><button class="btn btn-dark" data-action="export-data">${icon("download")}${T("Export backup (.json)","تصدير نسخة (.json)")}</button><label class="btn btn-outline file-button">${icon("upload")}${T("Import backup","استيراد نسخة")}<input type="file" id="import-data" accept=".json,application/json" class="sr-only"></label></div><div class="backup-meta"><span>${T("Last local save","آخر حفظ محلي")}</span><strong>${dateLabel(state.updatedAt,state.language)}</strong></div></section>
 <section class="panel"><h2>${T("Storage health","صحة التخزين")}</h2><p>${T("Progress is stored on this device and browser. It survives tab closing, browser closing, and normal device restart — not browser-data deletion, private browsing, device replacement, or domain change.","يُحفظ التقدم على هذا الجهاز والمتصفح. يبقى بعد إغلاق التبويب والمتصفح وإعادة تشغيل الجهاز — وليس بعد مسح بيانات المتصفح أو التصفح الخاص أو تغيير الجهاز أو الدومين.")}</p><div class="backup-meta"><span>${T("IndexedDB store","مخزن IndexedDB")}</span><strong id="storage-health-idb">…</strong></div><div class="backup-meta"><span>${T("Device storage","تخزين الجهاز")}</span><strong id="storage-health-persist">…</strong></div><div class="backup-meta"><span>${T("Stored data","البيانات المخزنة")}</span><strong id="storage-health-estimate">…</strong></div><div class="backup-meta"><span>${T("Last saved copy","آخر نسخة محفوظة")}</span><strong id="storage-health-save">…</strong></div></section>
 <section class="panel"><h2>${T("Open edition","النسخة المفتوحة")}</h2><p>${T("Learning is active without sign-in. Account forms, manager workspace, and content administration have dedicated pages, but no central identity or database service is connected.","التعلم متاح دون تسجيل. توجد صفحات مخصصة للحسابات ومساحة المدير وإدارة المحتوى، لكن لا توجد خدمة هوية مركزية أو قاعدة بيانات متصلة.")}</p><div class="settings-links">${routeLink("/login",T("Account preview","معاينة الحساب"),"text-link","user")}${routeLink("/manager",T("Manager preview","معاينة المدير"),"text-link","users")}${routeLink("/admin",T("Content administration","إدارة المحتوى"),"text-link","settings")}</div></section>
 <section class="panel danger-panel"><h2>${T("Reset this device","إعادة ضبط هذا الجهاز")}</h2><p>${T("Delete this browser's learning record, notes, saved tools, and preferences. Export a backup first. This cannot delete copies you previously exported.","احذف سجل تعلم هذا المتصفح وملاحظاته وأدواته وتفضيلاته. صدّر نسخة أولًا. هذا لا يحذف النسخ التي صدّرتها سابقًا.")}</p><button class="btn btn-danger" data-action="reset-data">${icon("trash")}${T("Reset local data","إعادة ضبط البيانات المحلية")}</button></section></div>`;
}

function helpPage(){
 const faqs=[
  [T("Do I need an account?","هل أحتاج إلى حساب؟"),T("No. All Leadership lessons, quizzes, tools, and practices are open. Account screens are future-facing previews and do not send credentials anywhere.","لا. كل دروس القيادة واختباراتها وأدواتها وتطبيقاتها مفتوحة. شاشات الحسابات معاينات للمستقبل ولا ترسل بيانات دخول لأي جهة.")],
  [T("Where is my progress stored?","أين يُحفظ تقدمي؟"),T("In this browser's local storage. It is not synced between devices, browser profiles, or different site addresses. Export and import a JSON backup in Settings to transfer it.","في التخزين المحلي لهذا المتصفح. لا يتزامن بين الأجهزة أو ملفات المتصفح أو عناوين المواقع المختلفة. صدّر نسخة JSON واستوردها من الإعدادات لنقلها.")],
  [T("Why is the video not playing?","لماذا لا يعمل الفيديو؟"),T("Video playback needs an internet connection and may depend on the creator's embed settings, your network, and YouTube availability. Use Open on YouTube. For the downloaded HTML, run the included local server; file:// playback can fail with error 153 because there is no HTTP referrer.","تشغيل الفيديو يحتاج إنترنت وقد يعتمد على إعدادات التضمين لدى الناشر وشبكتك وتوافر يوتيوب. استخدم «افتح على يوتيوب». عند استخدام HTML المحمل، شغّل الخادم المحلي المرفق؛ فقد تفشل المشاهدة عبر file:// بالخطأ 153 بسبب غياب مرجع HTTP.")],
  [T("How is watching recorded?","كيف تُسجّل المشاهدة؟"),T("The official player reports position and duration while the tab stays visible. The app records distinct whole seconds, ignores seek jumps, and unlocks the quiz at 90% coverage. This is a lightweight learning signal, not proof of attention.","يرسل المشغل الرسمي الموضع والمدة بينما يظل التبويب ظاهرًا. يسجل التطبيق الثواني المميزة، ويتجاهل القفز، ويفتح الاختبار عند ٩٠٪ تغطية. هذا مؤشر تعلم خفيف، وليس إثباتًا للانتباه.")],
  [T("Why does a passed quiz not complete the lesson?","لماذا لا يكتمل الدرس بعد نجاح الاختبار؟"),T("A lesson also needs at least 90% measured playback coverage and a personal reflection of at least 40 characters. The checklist on the lesson page shows what remains.","يحتاج الدرس أيضًا إلى تغطية مشاهدة مقاسة بنسبة ٩٠٪ على الأقل وتأمل شخصي لا يقل عن ٤٠ حرفًا. تعرض قائمة الدرس ما تبقى.")],
  [T("Are quizzes official tests from the video providers?","هل الاختبارات رسمية من الجهات الناشرة؟"),T("No. They are independently authored formative questions aligned with the topic and the platform's written practice notes. They are not certified transcripts or official assessments by Edraak, HBR, Stanford, or Simon Sinek.","لا. هي أسئلة تكوينية أُعدّت بشكل مستقل ومتوافقة مع الموضوع وملاحظات التطبيق المكتوبة. ليست تفريغًا معتمدًا أو اختبارات رسمية من إدراك أو HBR أو ستانفورد أو Simon Sinek.")],
  [T("Are Arabic captions available for every English video?","هل لكل فيديو إنجليزي ترجمة عربية؟"),T("Caption availability is not pre-verified. Check the CC and settings controls in the official player. Interface language, original practice notes, and quiz language can be switched independently of the video's audio.","توافر الترجمة غير متحقق منه مسبقًا. راجع CC وإعدادات المشغل الرسمي. يمكن تغيير لغة الواجهة والملاحظات الأصلية والاختبارات بصرف النظر عن صوت الفيديو.")],
  [T("Is the completion record accredited?","هل سجل الإتمام معتمد؟"),T("No. It is a personal, local learning record based on measured playback, quiz attempts, and self-review. It is not identity-verified, employer-approved, or an external professional qualification.","لا. إنه سجل تعلم شخصي ومحلي يعتمد على المشاهدة المقاسة ومحاولات الاختبار والمراجعة الذاتية. ليس متحققًا من الهوية أو معتمدًا من جهة العمل أو مؤهلًا مهنيًا خارجيًا.")],
  [T("Where are the other soft-skill tracks?","أين بقية مسارات المهارات الشخصية؟"),T("They have hidden content blueprints in the administration workspace. They are excluded from learner navigation, search, and direct learning routes until their content and assessments are ready.","لها مخططات محتوى مخفية في مساحة الإدارة. لا تظهر في قوائم المتعلم أو البحث أو روابط التعلم المباشرة حتى تجهز موادها وتقييماتها.")],
  [T("Can the manager see every employee's progress?","هل يرى المدير تقدم جميع الموظفين؟"),T("Not in this open edition. The manager page shows only this browser's local learning evidence. Central users, team membership, permissions, and verified reviews require a future backend activation.","ليس في هذه النسخة المفتوحة. تعرض صفحة المدير أدلة التعلم المحلية في هذا المتصفح فقط. يحتاج المستخدمون المركزيون وعضوية الفرق والصلاحيات والمراجعات المتحققة إلى تفعيل خلفي لاحق.")]
 ];
 return `${pageHead(T("HELP & SUPPORT","المساعدة والدعم"),T("A clear way forward.","طريق واضح للأمام."),T("Understand the open edition, troubleshoot playback, and keep your learning safe.","افهم النسخة المفتوحة، وعالج مشاكل التشغيل، واحتفظ بتعلّمك بأمان."))}
 <div class="two-col"><section class="faq-list">${faqs.map(([q,a],i)=>`<details class="faq-item" ${i===0?"open":""}><summary>${q}${icon("plus")}</summary><p>${a}</p></details>`).join("")}</section><aside class="sticky-stack"><form id="issue-form" class="panel"><h2>${T("Record an issue","سجل مشكلة")}</h2><p>${T("Save a local report to export and share with your platform owner. This does not send an email or create a support ticket.","احفظ تقريرًا محليًا لتصديره ومشاركته مع مسؤول المنصة. لا يرسل هذا بريدًا ولا ينشئ تذكرة دعم.")}</p><div class="form-field"><label for="issue-type">${T("Issue type","نوع المشكلة")}</label><select id="issue-type" name="type">${[["video",T("Video or link","فيديو أو رابط")],["quiz",T("Quiz content","محتوى اختبار")],["technical",T("Technical issue","مشكلة تقنية")],["suggestion",T("Suggestion","اقتراح")]].map(([v,t])=>`<option value="${v}">${t}</option>`).join("")}</select></div><div class="form-field"><label for="issue-text">${T("What happened?","ماذا حدث؟")}</label><textarea id="issue-text" name="text" maxlength="4000" minlength="10" required rows="5"></textarea></div><button class="btn btn-dark btn-full" type="submit">${T("Save report locally","حفظ التقرير محليًا")}${icon("check")}</button></form><div class="panel"><h3>${T("Your source matters","مصدر المعلومة مهم")}</h3><p>${T("Every active lesson includes a direct source link, a verification note, and a clear reuse-review status.","كل درس فعال يتضمن رابط المصدر وملاحظة التحقق وحالة مراجعة الاستخدام.")}</p>${routeLink("/sources",T("Open the source register","افتح سجل المصادر"),"text-link")}</div></aside></div>`;
}
function aboutPage(){
 return `${pageHead(T("KAD SOFT SKILLS PROGRAM","برنامج KAD للمهارات الشخصية"),T("Designed around how people work.","مصمم حول طريقة عمل الناس."),T("A connected foundation for everyday leadership in multidisciplinary design teams.","أساس متصل للقيادة اليومية في فرق التصميم متعددة التخصصات."))}
 <section class="about-hero"><div><div class="eyebrow">KADER & ASSOCIATES DESIGNS</div><h2>${T("Better teams.<br>Better work.","فرق أفضل.<br>وعمل أفضل.")}</h2><p>${T("KAD's public service profile spans design and engineering disciplines, project management, and site supervision. This learning program translates that context into coordination, communication, ownership, and thoughtful decisions.","يشمل نطاق الخدمات المعلن لـKAD تخصصات التصميم والهندسة وإدارة المشاريع والإشراف على المواقع. يترجم البرنامج هذا السياق إلى تنسيق وتواصل ومسؤولية وقرارات واعية.")}</p>${extLink("https://kadesigns-eg.com/about",T("Read KAD's official company profile","اقرأ الملف الرسمي للشركة"),"btn btn-white")}</div><div class="about-graphic">${artSvg()}</div></section>
 <div class="three-col"><div class="panel"><span class="tool-icon">${icon("target")}</span><h2>${T("A clear process","عملية واضحة")}</h2><p>${T("Assess, learn, check, apply, and reflect. Each step serves a specific purpose rather than rewarding passive video completion.","قيّم وتعلّم واختبر وطبّق وتأمل. لكل خطوة غرض محدد بدل مكافأة المشاهدة السلبية.")}</p></div><div class="panel"><span class="tool-icon">${icon("globe")}</span><h2>${T("Two languages","لغتان")}</h2><p>${T("An Arabic and English interface, original practice notes, and bilingual question banks. Audio remains with the original video creator.","واجهة عربية وإنجليزية وملاحظات تطبيقية أصلية وبنوك أسئلة ثنائية اللغة. يظل الصوت من الفيديو الأصلي.")}</p></div><div class="panel"><span class="tool-icon">${icon("layers")}</span><h2>${T("A foundation to grow","أساس قابل للتوسع")}</h2><p>${T("Leadership is live. Eleven future track blueprints remain hidden until their content, rights, and assessment reviews are complete.","مسار القيادة فعال. تظل مخططات أحد عشر مسارًا لاحقًا مخفية حتى مراجعة المحتوى والحقوق والتقييمات.")}</p></div></div>
 ${sectionHead(T("Our learning commitments","التزاماتنا في التعلم"))}<div class="panel prose"><h3>${T("Practice over performance theater","التطبيق أهم من استعراض الإنجاز")}</h3><p>${T("We do not invent staff statistics, leaderboards, skill percentages, or manager approvals. Knowledge scores, activity completion, and self-ratings remain distinct.","لا نختلق إحصاءات للموظفين أو لوحات ترتيب أو نسب مهارة أو اعتمادات من المدير. تبقى درجات المعرفة وإتمام النشاط والتقييمات الذاتية منفصلة.")}</p><h3>${T("Sources are credited, not claimed","ننسب المصادر ولا ندّعي ملكيتها")}</h3><p>${T("The platform embeds official YouTube players after your choice. Videos remain with their creators. Public availability is not a blanket institutional license. Rights review and a full transcript-to-question audit remain rollout gates.","تضمّن المنصة مشغلات يوتيوب الرسمية بعد اختيارك. تبقى الفيديوهات لدى ناشريها. التوافر العام ليس ترخيصًا مؤسسيًا شاملًا. وتظل مراجعة الحقوق وتدقيق مطابقة الأسئلة للتفريغ بوابات للإطلاق المؤسسي.")}</p><h3>${T("Open now, governed later","مفتوحة الآن، وبحوكمة لاحقًا")}</h3><p>${T("This release is a local-first open learning application. Future central accounts and role-based permissions must be implemented and tested before real employee records are introduced.","هذا الإصدار تطبيق تعلم مفتوح يعتمد على التخزين المحلي. يجب تنفيذ الحسابات المركزية والصلاحيات واختبارها قبل إدخال سجلات موظفين حقيقية.")}</p></div>`;
}
function sourcesPage(){
 return `${pageHead(T("TRANSPARENT CONTENT REGISTER","سجل محتوى واضح"),T("Know what you are learning from.","اعرف مصادر تعلّمك."),T(`Official-source URLs for the ${lessonList.length} active lessons. Title-and-link checks do not imply playback, caption, or licensing verification.`,`روابط المصادر للدروس الـ${lessonList.length} الفعالة. التحقق من العنوان والرابط لا يعني التحقق من التشغيل أو الترجمة أو الترخيص.`),`<button class="btn btn-outline" data-action="export-sources">${icon("download")}${T("Export source register","تصدير سجل المصادر")}</button>`)}
 ${notice(T("Videos are free to access where the source makes them available, not public-domain assets. No video files are redistributed. Institutional reuse is marked review required for every source; no external endorsement is claimed.","الفيديوهات متاحة للمشاهدة حيث يتيحها المصدر، وليست أصولًا في الملكية العامة. لا نعيد توزيع ملفات الفيديو. الاستخدام المؤسسي يحتاج مراجعة لكل مصدر، ولا ندعي تأييدًا خارجيًا."),"warning")}
 <div class="source-legend"><span>${icon("checkCircle")}${T("Public title / URL matched: 16 Sep 2026","مطابقة العنوان والرابط العام: ١٦ سبتمبر ٢٠٢٦")}</span><span>${icon("info")}${T("Playback and captions: not pre-verified","التشغيل والترجمة: غير متحقق منهما مسبقًا")}</span></div>
 <div class="source-register">${lessonList.map(l=>`<article class="source-record"><div class="source-record-icon">${icon(getModule(l.moduleId).icon)}</div><div><div class="eyebrow">${esc(l.source)} · ${langLabel(l.language)}</div><h2>${esc(tr(l.title))}</h2><div class="source-statuses">${pill(T("Title / URL matched","العنوان والرابط متطابقان"),"muted")}${pill(T("Reuse review required","مراجعة الاستخدام مطلوبة"),"outline")}${state.contentOverrides[l.id]?pill(T("Locally edited; recheck required","تعديل محلي؛ يلزم إعادة التحقق"),"accent"):""}</div><small class="mono">youtube.com/watch?v=${esc(effectiveVideo(l))}</small></div><div class="source-record-actions">${extLink(`https://www.youtube.com/watch?v=${effectiveVideo(l)}`,T("Source video","الفيديو المصدر"),"btn btn-outline")}${routeLink(`/learn/${l.id}`,T("Lesson","الدرس"),"text-link")}</div></article>`).join("")}</div>
 <div class="panel prose"><h2>${T("References and editorial boundaries","المراجع وحدود التحرير")}</h2><p>${T("The original platform notes explain the concepts tested in our quizzes. They are not transcriptions. Question counts (5, 7, or 10) were assigned editorially by topic complexity; live video duration is read from the player rather than fabricated.","تشرح ملاحظات المنصة الأصلية المفاهيم المقاسة في اختباراتنا، وليست تفريغًا. حُدد عدد الأسئلة (٥ أو ٧ أو ١٠) تحريريًا حسب تعقيد الموضوع؛ وتُقرأ مدة الفيديو من المشغل بدل اختلاقها.")}</p><div class="settings-links">${extLink("https://kadesigns-eg.com/about",T("KAD official profile","ملف KAD الرسمي"))}${extLink("https://developers.google.com/youtube/iframe_api_reference",T("YouTube IFrame API documentation","توثيق YouTube IFrame API"))}${extLink("https://support.google.com/youtube/answer/171780",T("YouTube embedding guidance","إرشادات تضمين يوتيوب"))}${extLink("https://www.gsb.stanford.edu/insights/give-it-me-straight-power-honest-constructive-feedback",T("Stanford feedback episode","حلقة ستانفورد عن الملاحظات"))}</div></div>`;
}
function legalPage(kind){
 const privacy=kind==="privacy";
 return `${pageHead(T("OPEN-EDITION OPERATING NOTICE","إشعار تشغيل النسخة المفتوحة"),privacy?T("Privacy and your data.","الخصوصية وبياناتك."):T("Use of this learning platform.","استخدام منصة التعلم."),T("Release 1.0 · 16 September 2026 · Organization-specific policy review required before a workforce rollout.","الإصدار ١.٠ · ١٦ سبتمبر ٢٠٢٦ · تلزم مراجعة سياسة المؤسسة قبل التعميم على الموظفين."))}
 <article class="panel prose legal-prose">${privacy?`
 <h2>${T("What this application stores","ما الذي يخزنه التطبيق؟")}</h2><p>${T("Your optional display name and working preferences, lesson playback seconds and confirmations, quiz attempts, reflections, notes, saved items, practice responses, self-ratings, and local content edits are stored in localStorage under kad-growth.open.v1.","يُخزَّن اسمك الاختياري وتفضيلات العمل وثواني التشغيل وتأكيدات المشاهدة ومحاولات الاختبارات والتأملات والملاحظات والعناصر المحفوظة وإجابات التطبيق والتقييمات الذاتية وتعديلات المحتوى المحلية في localStorage تحت المفتاح kad-growth.open.v1.")}</p>
 <h2>${T("Where data goes","أين تذهب البيانات؟")}</h2><p>${T("This build does not contain a central account service, analytics tracker, or employee database. Learning data is not sent by this application to KAD or to a manager. A hosting provider may receive ordinary request logs when the site is served; a deployed operator must review its own hosting policy.","لا يحتوي هذا البناء على خدمة حسابات مركزية أو متتبع تحليلات أو قاعدة بيانات موظفين. لا يرسل التطبيق بيانات التعلم إلى KAD أو إلى مدير. قد يستقبل مزود الاستضافة سجلات طلبات معتادة عند عرض الموقع؛ وعلى المشغّل مراجعة سياسة استضافته.")}</p>
 <h2>${T("YouTube and external sources","يوتيوب والمصادر الخارجية")}</h2><p>${T("The YouTube player is requested only after you choose Load video. It then connects to YouTube/Google, which may process technical and playback data under their own terms. Privacy-enhanced embedding does not mean no data processing. External links open their own services.","لا يُطلب مشغل يوتيوب إلا بعد اختيار «تحميل الفيديو». عندها يتصل بيوتيوب/Google، وقد تُعالج بيانات تقنية وبيانات تشغيل وفق شروطهما. التضمين المحسّن للخصوصية لا يعني انعدام معالجة البيانات. الروابط الخارجية تفتح خدماتها الخاصة.")}</p>
 <h2>${T("Your controls","أدوات التحكم المتاحة لك")}</h2><p>${T("Export your record, import a backup, or reset local data in Settings. Clearing browser data or changing device may remove access to your record. An export is an unencrypted file; protect it and do not include confidential information. Resetting the site does not erase previously exported copies.","صدّر سجلك أو استورد نسخة أو أعد ضبط البيانات من الإعدادات. قد يؤدي مسح بيانات المتصفح أو تغيير الجهاز لفقد الوصول للسجل. التصدير ملف غير مشفر؛ احمه ولا تُدرج معلومات سرية. إعادة ضبط الموقع لا تمحو النسخ المصدرة سابقًا.")}</p>
 <h2>${T("Do not enter sensitive work data","لا تُدخل بيانات عمل حساسة")}</h2><p>${T("Use anonymized examples. Do not enter passwords, private employee evaluations, health details, client identities, confidential drawings, contract information, or safety-critical records. This browser-local edition is not an approved HR record system.","استخدم أمثلة دون هوية. لا تُدخل كلمات المرور أو تقييمات الموظفين الخاصة أو التفاصيل الصحية أو هويات العملاء أو الرسومات السرية أو معلومات العقود أو سجلات السلامة الحرجة. هذه النسخة المحلية ليست نظام سجلات موارد بشرية معتمدًا.")}</p>`:`
 <h2>${T("Purpose and scope","الغرض والنطاق")}</h2><p>${T("This is an open-access, formative learning application for leadership development. It is not professional engineering instruction, a compliance system, a validated personnel assessment, or a replacement for company decision authority.","هذا تطبيق تعلم تكويني مفتوح لتطوير القيادة. ليس تعليمًا هندسيًا مهنيًا أو نظام امتثال أو تقييمًا معتمدًا للموظفين أو بديلًا لصلاحية القرار في الشركة.")}</p>
 <h2>${T("Content ownership and access","ملكية المحتوى وإتاحته")}</h2><p>${T("The supplied KAD logo is used as provided for this requested prototype. External videos remain with their respective creators. Official player embedding and public links do not establish a blanket license for corporate reuse. No third-party video files, transcripts, logos, or certificates are claimed as platform-owned.","يُستخدم شعار KAD المقدم كما هو لهذا النموذج المطلوب. تبقى الفيديوهات الخارجية لدى ناشريها. التضمين الرسمي والروابط العامة لا يثبتان ترخيصًا شاملًا للاستخدام المؤسسي. لا تدعي المنصة ملكية ملفات فيديو أو تفريغات أو شعارات أو شهادات الجهات الخارجية.")}</p>
 <h2>${T("Quizzes and completion records","الاختبارات وسجلات الإتمام")}</h2><p>${T("Questions and practice notes are original, topic-aligned learning scaffolds. They are not source-provider examinations. Scores and completion are stored client-side and can be modified by the device user. They must not be treated as secure examinations, verified credentials, or evidence for employment decisions.","الأسئلة وملاحظات التطبيق أدوات تعلم أصلية مرتبطة بالموضوع، وليست اختبارات الجهات الناشرة. تُحفظ الدرجات والإتمام في جانب المستخدم ويمكن لصاحب الجهاز تعديلها. لا تُعامل كاختبارات مؤمنة أو مؤهلات متحققة أو أدلة لقرارات التوظيف.")}</p>
 <h2>${T("Availability and change","التوافر والتغيير")}</h2><p>${T("External creators may remove videos, restrict embedding, or change captions. The application includes a source link and viewing-confirmation fallback. There is no guarantee of uninterrupted third-party access.","قد يحذف الناشرون الفيديوهات أو يقيدون التضمين أو يغيرون الترجمة. يوفر التطبيق رابط المصدر وبديل تأكيد المشاهدة. لا يوجد ضمان لاستمرار وصول خدمات الجهات الخارجية.")}</p>
 <h2>${T("Before a company-wide release","قبل التعميم على الشركة")}</h2><p>${T("The organization should designate a content owner, review rights and transcripts, approve privacy and retention policies, connect secure authentication and a database, verify role permissions, and test record accuracy and recovery.","على المؤسسة تعيين مسؤول محتوى ومراجعة الحقوق والتفريغات واعتماد سياسات الخصوصية والاحتفاظ وربط مصادقة وقاعدة بيانات مؤمنتين والتحقق من صلاحيات الأدوار واختبار دقة السجلات واستعادتها.")}</p>`}
 <div class="inline-meta">${routeLink("/settings",T("Data controls","التحكم في البيانات"),"btn btn-outline","settings")}${routeLink(privacy?"/terms":"/privacy",privacy?T("Usage notice","إشعار الاستخدام"):T("Privacy notice","إشعار الخصوصية"),"text-link")}</div></article>`;
}
function authPage(mode){
 const titles={
  login:[T("Welcome to your next chapter.","مرحبًا بفصلك التالي."),T("Sign in","تسجيل الدخول")],
  register:[T("Grow, together.","نتطور معًا."),T("Create an account","إنشاء حساب")],
  "forgot-password":[T("Find your way back.","استعد الوصول."),T("Reset access","استعادة الوصول")],
  "reset-password":[T("A fresh start.","بداية جديدة."),T("Choose a new password","اختر كلمة مرور جديدة")]
 };
 const [headline,title]=titles[mode]||titles.login;
 return `<section class="auth-layout"><div class="auth-brand-panel"><div class="eyebrow">KAD GROWTH ACADEMY</div><h1>${headline}</h1><p>${T("Learn with intention. Practice with your team. Lead in the moments that matter.","تعلّم بوعي. تدرّب مع فريقك. وقُد في المواقف المهمة.")}</p>${artSvg()}<span class="auth-brand-caption">LEARN. APPLY. LEAD.</span></div><div class="auth-form-panel">${pill(T("ACCOUNT PREVIEW","معاينة الحساب"),"accent")}<h2>${title}</h2><p>${T("Account services are not activated. Do not enter real credentials. The learning platform is fully open now.","خدمات الحسابات غير مفعلة. لا تُدخل بيانات دخول حقيقية. منصة التعلم مفتوحة بالكامل الآن.")}</p><form class="auth-preview-form" aria-label="${T("Inactive account preview","معاينة حساب غير مفعلة")}"><fieldset disabled>${mode==="register"?`<div class="form-field"><label for="auth-name">${T("Full name","الاسم الكامل")}</label><input id="auth-name" type="text" placeholder="${T("Account service not connected","خدمة الحساب غير متصلة")}"></div>`:""}${mode!=="reset-password"?`<div class="form-field"><label for="auth-email">${T("Work email","بريد العمل")}</label><input id="auth-email" type="email" placeholder="name@company.com" autocomplete="off"></div>`:""}${mode!=="forgot-password"?`<div class="form-field"><label for="auth-pass">${T("Password","كلمة المرور")}</label><input id="auth-pass" type="password" placeholder="••••••••••" autocomplete="off"></div>`:""}${mode==="reset-password"||mode==="register"?`<div class="form-field"><label for="auth-confirm">${T("Confirm password","تأكيد كلمة المرور")}</label><input id="auth-confirm" type="password" autocomplete="off"></div>`:""}<button class="btn btn-dark btn-full" type="button" disabled>${icon("lock")}${T("Available after backend activation","متاح بعد تفعيل الخدمة الخلفية")}</button></fieldset></form><div class="auth-links"><a href="#/login">${T("Sign in","دخول")}</a><a href="#/register">${T("Create account","حساب جديد")}</a><a href="#/forgot-password">${T("Forgot password","نسيت كلمة المرور")}</a><a href="#/reset-password">${T("Reset preview","معاينة التعيين")}</a></div><div class="auth-divider"><span>${T("OPEN LEARNING","تعلّم مفتوح")}</span></div>${routeLink("/leadership",T("Continue without an account","استكمل دون حساب"),"btn btn-red btn-full","arrow")}</div></section>`;
}
function adminTabs(active="overview"){
 return `<nav class="admin-tabs" aria-label="${T("Administration pages","صفحات الإدارة")}">${[
 ["overview","/admin",T("Overview","نظرة عامة")],
 ["content","/admin/content",T("Content register","سجل المحتوى")],
 ["questions","/admin/questions",T("Question bank","بنك الأسئلة")],
 ["roadmap","/admin/roadmap",T("Hidden tracks","المسارات المخفية")],
 ["reports","/admin/reports",T("Local reports","التقارير المحلية")],
 ["manager","/manager",T("Manager workspace","مساحة المدير")]
 ].map(([id,href,label])=>`<a href="#${href}" class="${active===id?"active":""}">${label}</a>`).join("")}</nav>`;
}
function adminNotice(){return notice(T("Open-edition administration: visible without login and limited to this browser. It is not a protected staff system. Content edits are local overrides; they do not publish to other users.","إدارة النسخة المفتوحة: متاحة دون تسجيل ومحدودة بهذا المتصفح. ليست نظام موظفين محميًا. تعديلات المحتوى محلية ولا تُنشر للمستخدمين الآخرين."),"warning");}
function adminPage(sub="overview",id=""){
 let out=pageHead(T("CONTENT & LEARNING OPERATIONS","إدارة المحتوى والتعلّم"),T("Build a learning system that lasts.","ابنِ نظام تعلم يستمر."),T("Curate carefully, publish deliberately, and keep the evidence honest.","اختر المحتوى بعناية، وانشره بتروٍ، وحافظ على صدق الأدلة."));
 out+=adminNotice()+adminTabs(sub);
 if(sub==="overview"){
  return out+`<div class="admin-stats"><div class="panel"><span>${T("Published lessons","دروس منشورة")}</span><strong>${number(lessonList.length)}</strong></div><div class="panel"><span>${T("Original bilingual questions","أسئلة أصلية ثنائية اللغة")}</span><strong>${countQuestions()}</strong></div><div class="panel"><span>${T("Applied scenarios","مواقف تطبيقية")}</span><strong>${number(cases.length)}</strong></div><div class="panel"><span>${T("Hidden future tracks","مسارات مستقبلية مخفية")}</span><strong>${number(futureTracks.length)}</strong></div></div>
  <div class="two-col"><section class="panel"><h2>${T("The publishing workflow","عملية النشر")}</h2><div class="timeline-list">${[
 [T("Source review","مراجعة المصدر"),T("Official origin, free access, embed behavior, and reuse status.","الأصل الرسمي والإتاحة والتضمين وحالة الاستخدام.")],
 [T("Editorial alignment","المطابقة التحريرية"),T("Audit the full video or transcript against objectives and questions.","دقق الفيديو أو التفريغ كاملًا مقابل الأهداف والأسئلة.")],
 [T("Bilingual assessment QA","جودة التقييم ثنائي اللغة"),T("Review distractors, correct answers, explanations, and reading clarity.","راجع البدائل والإجابات الصحيحة والتفسيرات والوضوح.")],
 [T("Practice and accessibility","التطبيق وإمكانية الوصول"),T("Add a relevant scenario, test keyboard access, and verify mobile layouts.","أضف موقفًا مناسبًا واختبر لوحة المفاتيح وعرض الهاتف.")],
 [T("Publish and recheck","النشر وإعادة المراجعة"),T("Publish only approved content; recheck links and rights at a chosen interval.","انشر المحتوى المعتمد فقط وأعد فحص الروابط والحقوق دوريًا.")]
 ].map(([t,d],i)=>`<div><span>${i+1}</span><div><h3>${t}</h3><p>${d}</p></div></div>`).join("")}</div></section><aside class="sticky-stack"><div class="panel"><h2>${T("Production gates still open","متطلبات الإطلاق المؤسسي المتبقية")}</h2><div class="check-list"><div>${icon("lock")}<span>${T("Central authentication and verified roles","مصادقة مركزية وأدوار متحقق منها")}</span></div><div>${icon("shield")}<span>${T("Institutional content-rights review","مراجعة حقوق المحتوى المؤسسية")}</span></div><div>${icon("book")}<span>${T("Full video-to-question editorial audit","تدقيق تحريري كامل للفيديو والأسئلة")}</span></div><div>${icon("users")}<span>${T("Real team data and manager validation","بيانات فرق حقيقية واعتماد المدير")}</span></div><div>${icon("document")}<span>${T("Approved privacy, retention, and recovery policy","سياسة معتمدة للخصوصية والاحتفاظ والاستعادة")}</span></div></div></div>${routeLink("/admin/content",T("Review the content register","راجع سجل المحتوى"),"btn btn-red")}</aside></div>`;
 }
 if(sub==="content"){
  return out+`<div class="panel"><div class="section-heading"><h2>${T("Leadership content register","سجل محتوى القيادة")}</h2><button class="btn btn-outline" data-action="export-sources">${icon("download")}${T("Export","تصدير")}</button></div><p>${T("Edit a replacement YouTube ID or reviewer note locally. Saving invalidates the earlier title/URL match for that override until it is manually checked. Quizzes do not automatically change to match a replacement video.","عدّل معرّف فيديو بديل أو ملاحظة مراجع محليًا. يُلغي الحفظ صلاحية المطابقة السابقة للتعديل حتى مراجعته يدويًا. لا تتغير الاختبارات تلقائيًا لتطابق فيديو بديل.")}</p><div class="table-scroll"><table><thead><tr><th>${T("Lesson / source","الدرس / المصدر")}</th><th>${T("Language","اللغة")}</th><th>${T("Questions","الأسئلة")}</th><th>${T("Provider","المزود")}</th><th>${T("Reuse","الاستخدام")}</th><th>${T("Edit","تعديل")}</th></tr></thead><tbody>${lessonList.map(l=>`<tr><td><strong>${esc(tr(l.title))}</strong><small class="table-sub mono">${canonicalLessonId(l)}</small>${state.contentOverrides[l.id]?pill(T("Local override","تعديل محلي"),"accent"):""}</td><td>${langLabel(l.language)}</td><td>${l.questionCount}</td><td>${T("YouTube embed (preview)","تضمين يوتيوب (معاينة)")}</td><td>${T("Review required","تحتاج مراجعة")}</td><td><button class="icon-btn" data-action="edit-content" data-id="${l.id}" aria-label="${T("Edit lesson","تعديل الدرس")}">${icon("pen")}</button></td></tr>`).join("")}</tbody></table></div></div>`;
 }
 if(sub==="questions"){
  const selected=lessonList.find(l=>l.id===route.params.get("lesson"))||lessonList[0];
  return out+`<div class="panel"><div class="section-heading"><h2>${T("Original formative question bank","بنك الأسئلة التكوينية الأصلي")}</h2><button class="btn btn-outline" data-action="export-questions">${icon("download")}${T("Export all questions","تصدير كل الأسئلة")}</button></div><form id="question-selector" class="filter-bar"><label for="question-lesson">${T("Lesson","الدرس")}</label><select id="question-lesson" name="lesson">${lessonList.map(l=>`<option value="${l.id}" ${l.id===selected.id?"selected":""}>${esc(tr(l.title))} (${l.questionCount})</option>`).join("")}</select><button class="btn btn-dark" type="submit">${T("Show","عرض")}</button></form><p class="small muted">${T("There are","يوجد")} ${number(countQuestions())} ${T("authored questions, not a larger generated bank. Retakes shuffle questions and options. Answer keys are client-side and are not secure exam material.","سؤالًا مؤلفًا، وليس بنكًا أكبر مولّدًا. تعيد المحاولات ترتيب الأسئلة والاختيارات. مفاتيح الإجابة في جانب المستخدم وليست مادة اختبار مؤمن")}</p>
  ${questionBank[selected.id].map((q,i)=>`<details class="bank-question" ${i===0?"open":""}><summary><span>${String(i+1).padStart(2,"0")}</span>${esc(tr(q.prompt))}${icon("plus")}</summary><div class="bank-question-body">${q.options.map(o=>`<div class="${o.id===q.correctId?"bank-correct":""}">${icon(o.id===q.correctId?"checkCircle":"minus")}<span>${esc(tr(o.text))}</span></div>`).join("")}<p>${esc(tr(q.explanation))}</p><small class="mono">${q.id}</small></div></details>`).join("")}</div>`;
 }
 if(sub==="roadmap"){
  const draft=futureTracks.find(t=>t.id===id);
  if(id&&!draft)return notFoundPage();
  if(draft)return out+`<div class="panel"><div class="eyebrow">${T("HIDDEN TRACK BLUEPRINT","مخطط مسار مخفي")}</div><h2>${esc(tr(draft.title))}</h2><p>${T("This track has a route and content structure in the authoring workspace only. It is excluded from public learning until the full publish gate is satisfied.","لهذا المسار صفحة وهيكل محتوى في مساحة التأليف فقط. يظل مستبعدًا من تعلم المستخدمين حتى استيفاء متطلبات النشر كاملة.")}</p><div class="blueprint-grid">${[
 T("01 · Foundations and self-assessment","٠١ · الأساسيات والتقييم الذاتي"),
 T("02 · Concepts and source materials","٠٢ · المفاهيم والمصادر"),
 T("03 · Bilingual knowledge checks","٠٣ · اختبارات معرفة ثنائية اللغة"),
 T("04 · KAD workplace scenarios","٠٤ · مواقف لبيئة عمل KAD"),
 T("05 · Practical toolkit","٠٥ · أدوات تطبيقية"),
 T("06 · Application and reflection","٠٦ · التطبيق والتأمل"),
 T("07 · Impact challenge","٠٧ · تحدي الأثر"),
 T("08 · Review and completion","٠٨ · المراجعة والإتمام")
 ].map(x=>`<div>${icon("lock")}<strong>${x}</strong><span>${T("Draft structure · no published lessons","هيكل مسودة · لا توجد دروس منشورة")}</span></div>`).join("")}</div>${routeLink("/admin/roadmap",T("Back to hidden tracks","العودة للمسارات المخفية"),"btn btn-outline","back")}</div>`;
  return out+`<div class="panel"><div class="section-heading"><h2>${T("Hidden until ready","مخفية حتى تجهز")}</h2>${pill(T("No public publish toggle","دون زر نشر عام"),"muted")}</div><p>${T("All future tracks are excluded from learner navigation, the resource library, search results, and direct learner routes. Open a blueprint to inspect its future structure.","كل المسارات التالية مستبعدة من قوائم المتعلم والمكتبة والبحث وروابط التعلم المباشرة. افتح مخططًا لفحص الهيكل المستقبلي.")}</p><div class="roadmap-list">${futureTracks.map((t,i)=>`<a href="#/admin/roadmap/${t.id}"><span class="table-number">${String(i+2).padStart(2,"0")}</span><div><h3>${esc(tr(t.title))}</h3><small>${T("Draft blueprint · Hidden from learners","مخطط مسودة · مخفي عن المتعلمين")}</small></div>${icon("lock")}${icon("arrow","directional")}</a>`).join("")}</div></div>`;
 }
 if(sub==="reports"){
  return out+`<div class="panel"><div class="section-heading"><h2>${T("Locally recorded issues","المشكلات المسجلة محليًا")}</h2><button class="btn btn-outline" data-action="export-issues">${icon("download")}${T("Export reports","تصدير التقارير")}</button></div>${state.issues.length?state.issues.map(i=>`<div class="issue-record"><div>${pill(i.type||"issue","muted")}<span class="small muted">${dateLabel(i.at,state.language)}</span></div><p class="preserve-lines">${esc(i.text)}</p><small>${T("Local only · not sent","محلي فقط · لم يُرسل")}</small></div>`).join(""):emptyState("document",T("No local reports.","لا توجد تقارير محلية."),T("Issue reports saved in Help will appear here. No external ticket system is connected.","تظهر هنا التقارير المحفوظة من المساعدة. لا يوجد نظام تذاكر خارجي متصل."),routeLink("/help",T("Open help","افتح المساعدة"),"btn btn-outline"))}</div>`;
 }
 return notFoundPage();
}
function managerPage(){
 const st=stats(),done=cases.filter(c=>state.practices[c.id]?.status==="submitted");
 return `${pageHead(T("MANAGER WORKSPACE · LOCAL PREVIEW","مساحة المدير · معاينة محلية"),T("Support growth, not surveillance.","ادعم التطور، لا المراقبة."),T("A review workspace prepared for future team accounts. Today it shows only this browser's learning activity.","مساحة مراجعة مهيأة لحسابات الفرق لاحقًا. تعرض اليوم نشاط تعلم هذا المتصفح فقط."))}
 ${adminNotice()}${adminTabs("manager")}<div class="admin-stats"><div class="panel"><span>${T("Connected team members","أعضاء فريق متصلون")}</span><strong>0</strong></div><div class="panel"><span>${T("Local completed lessons","دروس محلية مكتملة")}</span><strong>${st.completed}</strong></div><div class="panel"><span>${T("Local submitted practices","تطبيقات محلية مُسلّمة")}</span><strong>${done.length}</strong></div><div class="panel"><span>${T("Verified manager reviews","مراجعات مدير متحققة")}</span><strong>0</strong></div></div>
 <div class="two-col"><section class="panel"><h2>${T("Current local learner","المتعلم المحلي الحالي")}</h2><div class="manager-learner"><span class="large-avatar">${icon("user")}</span><div><h3>${esc(state.profile.name||T("Unnamed local learner","متعلم محلي دون اسم"))}</h3><p>${esc(state.profile.department||T("Working area not set","مجال العمل غير محدد"))}</p></div><strong>${st.percent}%</strong></div><p>${T("No employee directory has been imported. A name entered in Profile is not identity verification.","لم يُستورد دليل موظفين. إدخال الاسم في الملف الشخصي لا يُعد تحققًا من الهوية.")}</p><h3>${T("Submitted practice","التطبيقات المُسلّمة")}</h3>${done.length?done.map(c=>`<a class="lesson-row" href="#/practice/${c.id}">${icon("document")}<div><h3>${esc(tr(c.title))}</h3><small>${T("Self-reviewed; no manager approval","مراجعة ذاتية؛ دون اعتماد مدير")}</small></div>${icon("arrow","directional")}</a>`).join(""):emptyState("layers",T("No practice to review yet.","لا يوجد تطبيق للمراجعة بعد."),T("Submitted local practice will appear here.","ستظهر التطبيقات المحلية المُسلّمة هنا."))}</section>
 <aside class="sticky-stack"><div class="panel"><h2>${T("A useful review conversation","محادثة مراجعة مفيدة")}</h2><div class="review-prompts"><p>${T("What did you try in a real interaction?","ما الذي جربته في تفاعل حقيقي؟")}</p><p>${T("What did you observe, and what remains uncertain?","ماذا لاحظت؟ وما الذي لا يزال غير مؤكد؟")}</p><p>${T("What support would make the next attempt easier?","ما الدعم الذي يسهل المحاولة التالية؟")}</p><p>${T("When should we check in again?","متى نراجع التقدم مجددًا؟")}</p></div></div><div class="panel soft-panel"><h3>${T("Before using real team records","قبل استخدام سجلات فريق حقيقية")}</h3><p>${T("Connect authentication, explicit manager/team assignments, server-side authorization, consent and retention policies, and audited reviews. Open client-side data must not drive HR decisions.","اربط المصادقة وتعيينات المدير والفرق والصلاحيات الخلفية وسياسات الموافقة والاحتفاظ والمراجعات الموثقة. لا تُبنى قرارات الموارد البشرية على بيانات مفتوحة في جانب المستخدم.")}</p></div></aside></div>`;
}
function notFoundPage(){
 return `<div class="not-found"><div class="eyebrow">404 · KAD GROWTH</div><strong>404</strong><h1>${T("This chapter is not open.","هذا الفصل غير متاح.")}</h1><p>${T("The page does not exist or belongs to a track that is not published. Leadership Foundation is ready for you.","الصفحة غير موجودة أو تنتمي لمسار لم يُنشر. مسار أساسيات القيادة جاهز لك.")}</p>${routeLink("/leadership",T("Explore Leadership","استكشف القيادة"),"btn btn-red")}</div>`;
}

function parseRoute(){
 const raw=location.hash.slice(1)||"/";
 const [path,qs=""]=raw.split("?");
 return {path:path.startsWith("/")?path.replace(/\/+$/,"")||"/":"/404",params:new URLSearchParams(qs)};
}
function pageForRoute(){
 const parts=route.path.split("/").filter(Boolean);
 switch(parts[0]||"home"){
  case "home":return homePage();
  case "welcome":return welcomePage();
  case "leadership":return parts.length===1?leadershipPage():notFoundPage();
  case "learn":return parts.length===2?lessonPage(parts[1]):notFoundPage();
  case "library":return libraryPage();
  case "saved":return libraryPage(true);
  case "practice":return parts[1]?casePage(parts[1]):practicePage();
  case "toolkit":return toolkitPage(parts[1]);
  case "assessment":return assessmentPage();
  case "progress":return progressPage();
  case "notes":return notesPage();
  case "capstone":return capstonePage();
  case "achievements":return achievementsPage();
  case "certificate":return certificatePage();
  case "profile":return profilePage();
  case "settings":return settingsPage();
  case "help":return helpPage();
  case "about":return aboutPage();
  case "sources":return sourcesPage();
  case "privacy":case "terms":return legalPage(parts[0]);
  case "login":case "register":case "forgot-password":case "reset-password":return authPage(parts[0]);
  case "admin":return adminPage(parts[1]||"overview",parts[2]);
  case "manager":return managerPage();
  default:return notFoundPage();
 }
}
function cleanupPlayer(){
 if(playbackTimer)clearInterval(playbackTimer);
 if(playerReadyTimer)clearTimeout(playerReadyTimer);
 playbackTimer=null;playerReadyTimer=null;lastPlayback=null;
 if(player){try{player.destroy();}catch{}player=null;}
}
function render({keepScroll=false}={}){
 cleanupPlayer();
 const scroll=window.scrollY;
 route=parseRoute();
 if(!state.language&&route.path!=="/welcome")route={path:"/welcome",params:new URLSearchParams()};
 document.documentElement.lang=state.language||"ar";
 document.documentElement.dir=(state.language||"ar")==="ar"?"rtl":"ltr";
 document.documentElement.classList.toggle("reduced-motion",state.reducedMotion);
 document.documentElement.classList.toggle("high-contrast",state.highContrast);
 applyTheme(state.theme);
 document.body.classList.remove("nav-open","modal-open");
 if (modalResolve) { modalResolve(false); modalResolve=null; }
 app.innerHTML=shell(pageForRoute());
 document.querySelectorAll(".bottom-nav a").forEach(a=>{const active=a.dataset.nav==="/"?(route.path==="/"):route.path===a.dataset.nav||route.path.startsWith(a.dataset.nav+"/");a.classList.toggle("active",active);if(active)a.setAttribute("aria-current","page");});
 const heading=document.querySelector("main h1")?.textContent||"KAD Growth";
 document.title=`${heading} | KAD Growth Academy`;
 if(keepScroll)window.scrollTo(0,scroll);else window.scrollTo(0,0);
 if(route.path==="/settings")refreshStorageHealth();
}
function navigate(path){if(location.hash===`#${path}`)render();else location.hash=path;}
async function refreshStorageHealth(silent=false){
 try{
  const set=(id,text)=>{const el=document.getElementById(id);if(el)el.textContent=text;};
  const health=await storageHealth();
  set("storage-health-idb",health.indexedDB?T("Active (v2)","نشط (v2)"):T("Unavailable, local backup active","غير متاح، النسخة المحلية فعالة"));
  set("storage-health-persist",!health.persistSupported?T("Standard browser storage","تخزين متصفح عادي"):health.persisted?T("Protected where supported","محمي حيثما أمكن"):T("Standard browser storage","تخزين متصفح عادي"));
  set("storage-health-estimate",health.estimate&&health.estimate.usage!=null?`${Math.round(health.estimate.usage/1024)} KB`:T("Not reported","غير معلن"));
  const meta=await idbReadMetadata().catch(()=>null);
  set("storage-health-save",(meta&&meta.updatedAt)||state.updatedAt?dateLabel((meta&&meta.updatedAt)||state.updatedAt,state.language||"ar"):T("Not saved yet","لم يُحفظ بعد"));
 }catch{ if(!silent)toast(T("Storage health is unavailable.","صحة التخزين غير متاحة."),"info"); }
}
function refreshCompletion(id){
 const l=getLesson(id);if(!l)return;
 const p=upsertProgress(id);
 if(lessonComplete(p)&&!p.completedAt){p.completedAt=new Date().toISOString();persist();}
 const node=document.getElementById("lesson-completion");
 if(node)node.innerHTML=lessonRequirements(l);
 const st=stats(),side=document.querySelector(".sidebar-progress");
 if(side)side.innerHTML=`<div class="eyebrow">${T("YOUR LEADERSHIP JOURNEY","رحلتك في القيادة")}</div><div class="sidebar-progress-numbers"><strong>${number(st.percent)}<small>%</small></strong><span>${number(st.completed)} / ${number(st.total)} ${T("lessons","درسًا")}</span></div>${progressBar(st.percent)}`;
}
function startQuiz(id){
  const qs=questionBank[id];if(!qs)return;
  if(!canAttemptQuiz(progressFor(id)))return;
 state.quizDrafts[id]={order:shuffle(qs.map(q=>q.id)),optionOrder:Object.fromEntries(qs.map(q=>[q.id,shuffle(q.options.map(o=>o.id))])),answers:{},submitted:false,startedAt:new Date().toISOString()};
 persist();
 document.getElementById("knowledge-check").innerHTML=quizMarkup(getLesson(id));
 document.getElementById("knowledge-check").scrollIntoView({behavior:state.reducedMotion?"auto":"smooth",block:"start"});
}
function submitQuiz(form){
  const id=form.dataset.id,qs=questionBank[id],draft=state.quizDrafts[id];
  if(!qs||!draft||draft.submitted)return;
  if(!canAttemptQuiz(progressFor(id)))return;
 const missing=qs.filter(q=>!q.options.some(o=>o.id===draft.answers[q.id]));
 if(missing.length){
  document.getElementById("quiz-error").textContent=T(`Please answer all questions. ${missing.length} remain.`,`يرجى الإجابة عن كل الأسئلة. المتبقي: ${number(missing.length)}.`);
  form.querySelector(`input[name="${missing[0].id}"]`)?.focus();
  return;
 }
 const result=calculateScore(qs,draft.answers),p=upsertProgress(id);
 draft.submitted=true;draft.submittedAt=new Date().toISOString();
 p.bestScore=Math.max(p.bestScore||0,result.percent);
 p.attempts=[...(p.attempts||[]),{...result,at:draft.submittedAt}].slice(-100);
 persist();document.getElementById("knowledge-check").innerHTML=quizMarkup(getLesson(id));
 refreshCompletion(id);
 document.getElementById("knowledge-check").scrollIntoView({behavior:state.reducedMotion?"auto":"smooth",block:"start"});
 toast(result.passed?T("Knowledge check passed. Add your application reflection.","اجتزت اختبار المعرفة. أضف تأملك حول التطبيق."):T("Review the explanations and try again when ready.","راجع التفسيرات وأعد المحاولة عندما تستعد."),result.passed?"success":"info");
}
function sourceExport(){
 return {
  release:curriculum.version,
  verification:"Public title and URL matched; playback, exact duration, captions, and institutional reuse are not pre-verified.",
  originalQuestions:"119 topic-aligned formative questions, based on platform-authored practice notes; not official source assessments.",
  sources:lessonList.map(l=>({id:l.id,canonicalId:canonicalLessonId(l),title:l.title,source:l.source,provider:"youtube_embed",strictKadVideoMode:false,youtubeUrl:`https://www.youtube.com/watch?v=${effectiveVideo(l)}`,language:l.language,questionCount:l.questionCount,verification:l.verification,localOverride:state.contentOverrides[l.id]||null}))
 };
}
function exportBackup(){
 const payload={...state,exportedAt:new Date().toISOString()};
 payload.checksum=checksumString({schemaVersion:payload.schemaVersion,progress:payload.progress,notes:payload.notes,saved:payload.saved,practices:payload.practices,capstone:payload.capstone,deviceProfileId:payload.deviceProfileId});
 downloadFile("KAD-Growth-backup-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(payload,null,2),"application/json");
 toast(T("Backup exported. Store it privately.","تم تصدير النسخة. احتفظ بها في مكان خاص."));
}
function countCompleted(progress){
 return lessonList.filter(l=>lessonComplete((progress||{})[l.id])).length;
}
let restoreFocusElement=null,modalResolve=null;
function openModal(title,content){
 restoreFocusElement=document.activeElement;
 const root=document.getElementById("modal-root");
 root.innerHTML=`<div class="modal-backdrop" data-action="close-modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="${T("Close dialog","إغلاق النافذة")}">${icon("close")}</button></div>${content}</section></div>`;
 document.body.classList.add("modal-open");
 setTimeout(()=>root.querySelector("input:not([disabled]),textarea,button")?.focus(),0);
}
function closeModal(){
 document.getElementById("modal-root").innerHTML="";
 document.body.classList.remove("modal-open");
 if(modalResolve){modalResolve(false);modalResolve=null;}
 restoreFocusElement?.focus?.();
}
function confirmDialog(title,message,buttonLabel){
 return new Promise(resolve=>{
  openModal(title,`<p>${esc(message)}</p><div class="form-actions"><button class="btn btn-outline" data-action="close-modal">${T("Cancel","إلغاء")}</button><button class="btn btn-red" id="confirm-dialog">${esc(buttonLabel)}</button></div>`);
  modalResolve=resolve;
  document.getElementById("confirm-dialog").addEventListener("click",()=>{modalResolve=null;closeModal();resolve(true);},{once:true});
 });
}
function editContent(id){
 const l=getLesson(id),o=state.contentOverrides[id]||{};
 openModal(T("Local content override","تعديل محلي للمحتوى"),`<p>${esc(tr(l.title))}</p><form id="content-edit-form" data-id="${id}" novalidate><div class="form-field"><label for="edit-video-id">YouTube ID</label><input id="edit-video-id" name="youtubeId" dir="ltr" maxlength="11" value="${esc(o.youtubeId||l.youtubeId)}" required pattern="[A-Za-z0-9_-]{11}"><p class="field-hint">${T("11 characters only. A replacement invalidates the old source check and does not rewrite the quiz.","١١ حرفًا فقط. الفيديو البديل يلغي التحقق السابق ولا يعيد كتابة الاختبار.")}</p></div><div class="form-field"><label for="edit-review-note">${T("Reviewer note","ملاحظة المراجع")}</label><textarea id="edit-review-note" name="note" maxlength="2000" rows="4">${esc(o.note||"")}</textarea></div><div id="content-error" class="form-error" role="alert"></div><div class="form-actions"><button class="btn btn-outline" type="button" data-action="reset-content" data-id="${id}">${T("Restore original","استعادة الأصل")}</button><button class="btn btn-red" type="submit">${T("Save locally","حفظ محلي")}</button></div></form>`);
}
function editNote(id){
 const n=state.notes.find(n=>n.id===id);if(!n)return;
 openModal(T("Edit note","تعديل الملاحظة"),`<form id="edit-note-form" data-id="${esc(id)}"><label class="sr-only" for="edit-note-text">${T("Note","الملاحظة")}</label><textarea id="edit-note-text" name="text" rows="8" maxlength="4000" required>${esc(n.text)}</textarea><div class="form-actions"><button class="btn btn-red" type="submit">${T("Save changes","حفظ التغييرات")}</button></div></form>`);
}
function addNote(text,lessonId=""){
 if(!text.trim())return false;
 state.notes.push({id:globalThis.crypto?.randomUUID?.()||`note-${Date.now()}-${Math.random().toString(16).slice(2)}`,text:text.trim().slice(0,4000),lessonId:getLesson(lessonId)?lessonId:"",at:new Date().toISOString()});
 persist();return true;
}
function getFieldValues(form,fields){
 return Object.fromEntries(fields.map(f=>[f.id,String(new FormData(form).get(f.id)||"").trim().slice(0,4000)]));
}
function showFieldErrors(fields,ids,minimum){
 fields.forEach(f=>{const el=document.getElementById("error-"+f.id);if(el)el.textContent=ids.includes(f.id)?T(`Write at least ${minimum} characters.`,`اكتب ${number(minimum)} حرفًا على الأقل.`):"";document.getElementById("field-"+f.id)?.setAttribute("aria-invalid",ids.includes(f.id)?"true":"false");});
 if(ids.length)document.getElementById("field-"+ids[0])?.focus();
}
function playerFailure(id,message){
 const el=document.getElementById("player-message");
 if(el)el.innerHTML=notice(`${esc(message)} ${extLink(`https://www.youtube.com/watch?v=${effectiveVideo(getLesson(id))}`,T("Open on YouTube","افتح على يوتيوب"))}`,"warning");
}
let youtubeApiPromise=null;
function loadYoutubeApi(){
 if(globalThis.YT?.Player)return Promise.resolve();
 if(youtubeApiPromise)return youtubeApiPromise;
 youtubeApiPromise=new Promise((resolve,reject)=>{
  const existing=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{if(typeof existing==="function")existing();resolve();};
  const script=document.createElement("script");script.src="https://www.youtube.com/iframe_api";script.async=true;script.referrerPolicy="strict-origin-when-cross-origin";
  script.onerror=()=>{youtubeApiPromise=null;script.remove();reject(new Error("YouTube API unavailable"));};
  document.head.appendChild(script);
 });
 return youtubeApiPromise;
}
async function loadVideo(id){
 const l=getLesson(id),mount=document.getElementById("video-mount");if(!l||!mount||mount.dataset.loading)return;
 if(location.protocol==="file:"){
  playerFailure(id,T("For embedded playback, open this site through the included local server (npm run dev) or a hosted URL. The standalone file can still use the original YouTube link.","للتشغيل المضمّن، افتح الموقع عبر الخادم المحلي المرفق (npm run dev) أو عنوان مستضاف. يمكنك استخدام رابط يوتيوب الأصلي من الملف المستقل."));
  return;
 }
 mount.dataset.loading="true";
 mount.innerHTML=`<div class="player-loading"><span class="loading-spinner"></span><p>${T("Loading the official player...","جارٍ تحميل المشغل الرسمي...")}</p></div>`;
 playerReadyTimer=setTimeout(()=>playerFailure(id,T("The player is taking longer than expected. Network policies or source restrictions may prevent playback.","المشغل يستغرق وقتًا أطول من المتوقع. قد تمنع سياسات الشبكة أو قيود المصدر التشغيل.")),14000);
 try{
  await loadYoutubeApi();
  if(route.path!==`/learn/${id}`||!document.getElementById("video-mount"))return;
  mount.innerHTML='<div id="youtube-player"></div>';
  player=new YT.Player("youtube-player",{
   host:"https://www.youtube-nocookie.com",videoId:effectiveVideo(l),width:"100%",height:"100%",
   playerVars:{playsinline:1,rel:0,origin:location.origin,hl:state.language,enablejsapi:1},
   events:{
    onReady:e=>{
     clearTimeout(playerReadyTimer);
     const frame=e.target.getIframe();frame.title=tr(l.title);frame.setAttribute("referrerpolicy","strict-origin-when-cross-origin");frame.setAttribute("allow","accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");frame.setAttribute("allowfullscreen","");
     const duration=e.target.getDuration();if(duration>0){upsertProgress(id).duration=duration;persist();document.getElementById("video-duration").textContent=formatTime(duration);}
     document.getElementById("player-message").innerHTML="";
    },
    onStateChange:e=>{
     if(playbackTimer)clearInterval(playbackTimer);
     lastPlayback=null;
     if(e.data===YT.PlayerState.PLAYING){
      const duration=player.getDuration();if(duration>0){upsertProgress(id).duration=duration;document.getElementById("video-duration").textContent=formatTime(duration);}
      lastPlayback=player.getCurrentTime();
      playbackTimer=setInterval(()=>{
       if(!player||route.path!==`/learn/${id}`)return;
       const time=player.getCurrentTime(),prev=lastPlayback;lastPlayback=time;
       const rate=player.getPlaybackRate?.()||1;
       if(prev!==null&&time>prev&&time-prev<=Math.max(4.5,rate*2.2)){
        const p=upsertProgress(id),seen=new Set(p.watched||[]);
        for(let second=Math.floor(prev);second<Math.floor(time);second++)if(second>=0&&second<p.duration)seen.add(second);
        p.watched=[...seen];persist();refreshCompletion(id);
       }
      },1000);
     }
    },
    onError:e=>{
     clearTimeout(playerReadyTimer);
     playerFailure(id,T(`YouTube could not play this video (code ${e.data}). Use the source link; embedding may be restricted.`,`تعذر تشغيل الفيديو من يوتيوب (الرمز ${e.data}). استخدم رابط المصدر؛ قد توجد قيود على التضمين.`));
    }
   }
  });
 }catch{
  if(route.path===`/learn/${id}`){clearTimeout(playerReadyTimer);playerFailure(id,T("YouTube could not be reached. The lesson notes and quiz remain available.","تعذر الاتصال بيوتيوب. تظل ملاحظات الدرس والاختبار متاحين."));mount.dataset.loading="";mount.innerHTML=`<div class="player-loading">${icon("info")}<p>${T("Player unavailable","المشغل غير متاح")}</p><button class="btn btn-white" data-action="load-video" data-id="${id}">${T("Try again","حاول مجددًا")}</button></div>`;}
 }
}
document.addEventListener("click",async event=>{
 const section=event.target.closest("[data-section]");
 if(section){event.preventDefault();document.getElementById(section.dataset.section)?.scrollIntoView({behavior:state.reducedMotion?"auto":"smooth",block:"start"});return;}
 const skip=event.target.closest(".skip-link");if(skip){event.preventDefault();document.getElementById("main").focus();return;}
 const el=event.target.closest("[data-action]");if(!el)return;
 const action=el.dataset.action,id=el.dataset.id;
 if(action==="close-modal-backdrop"&&event.target!==el)return;
 if(el.tagName==="A"||el.tagName==="BUTTON")event.preventDefault();
 switch(action){
  case "toggle-menu":{
   const open=document.body.classList.toggle("nav-open");el.setAttribute("aria-expanded",String(open));
   if(open)document.querySelector(".sidebar .nav-link")?.focus();break;
  }
  case "close-menu":document.body.classList.remove("nav-open");document.querySelector(".mobile-menu")?.setAttribute("aria-expanded","false");break;
  case "choose-language":{
   const lang=el.dataset.lang;
   if(lang!=="ar"&&lang!=="en")break;
   state.language=lang;persist();
   toast(T("Language saved on this device. Progress is preserved.","حُفظت اللغة على هذا الجهاز. التقدم محفوظ."));
   navigate(state.lastLesson&&getLesson(state.lastLesson)?`/learn/${state.lastLesson}`:"/");
   break;
  }
  case "language":state.language=state.language==="ar"?"en":"ar";persist();render({keepScroll:true});break;
  case "save-lesson":{
   if(!getLesson(id))break;
   state.saved=state.saved.includes(id)?state.saved.filter(x=>x!==id):[...state.saved,id];persist();
   document.querySelectorAll(`[data-action="save-lesson"][data-id="${id}"]`).forEach(btn=>{btn.classList.toggle("is-saved",state.saved.includes(id));btn.setAttribute("aria-pressed",String(state.saved.includes(id)));});
   if(route.path==="/saved")render({keepScroll:true});
   toast(state.saved.includes(id)?T("Lesson saved.","تم حفظ الدرس."):T("Lesson removed from saved items.","أُزيل الدرس من المحفوظات."));
   break;
  }
  case "start-quiz":case "retry-quiz":startQuiz(id);break;
  case "focus-reflection":document.getElementById("lesson-reflection")?.focus();document.getElementById("reflection")?.scrollIntoView({behavior:state.reducedMotion?"auto":"smooth",block:"start"});break;
  case "save-reflection":{
   const p=upsertProgress(id);p.reflection=document.getElementById("lesson-reflection").value.slice(0,4000);persist();refreshCompletion(id);
   toast(T("Reflection saved on this device.","تم حفظ التأمل على هذا الجهاز."));break;
  }
  case "quick-note":if(addNote(document.getElementById("quick-note").value,id)){document.getElementById("quick-note").value="";toast(T("Idea added to your notes.","أُضيفت الفكرة إلى ملاحظاتك."));}else toast(T("Write a note first.","اكتب ملاحظة أولًا."),"info");break;
  case "edit-note":editNote(id);break;
  case "delete-note":if(await confirmDialog(T("Delete this note?","حذف هذه الملاحظة؟"),T("This removes the local note. Exported copies will not change.","سيحذف هذا الملاحظة المحلية دون تغيير النسخ المصدرة."),T("Delete note","احذف الملاحظة"))){state.notes=state.notes.filter(n=>n.id!==id);persist();render({keepScroll:true});toast(T("Note deleted.","تم حذف الملاحظة."));}break;
  case "export-notes":downloadFile("KAD-notes.txt",state.notes.map(n=>`${dateLabel(n.at,state.language)}\n${getLesson(n.lessonId)?tr(getLesson(n.lessonId).title):""}\n${n.text}`).join("\n\n--------------------\n\n"));break;
  case "download-tool":{
   const t=tools.find(t=>t.id===id),form=document.getElementById("tool-form");if(!t||!form)break;
   const values=getFieldValues(form,t.fields);state.toolValues[id]=values;persist();
   downloadFile("KAD-"+safeFilename(id)+".txt",`${tr(t.title)}\nKAD Growth | Personal working canvas\n\n`+t.fields.map(f=>`${tr(f.label)}\n${values[f.id]||"—"}`).join("\n\n"));break;
  }
  case "export-data":exportBackup();break;
  case "export-sources":downloadFile("KAD-content-register.json",JSON.stringify(sourceExport(),null,2),"application/json");break;
  case "export-questions":downloadFile("KAD-bilingual-question-bank.json",JSON.stringify({version:1,notice:"Original formative topic-aligned questions; not official provider exams.",questions:questionBank},null,2),"application/json");break;
  case "export-issues":downloadFile("KAD-local-issue-reports.json",JSON.stringify({notice:"Locally saved; never sent by the application.",issues:state.issues},null,2),"application/json");break;
  case "reset-data":
   if(await confirmDialog(T("Reset all local learning data?","إعادة ضبط كل بيانات التعلم المحلية؟"),T("This deletes the current browser record, including notes and progress. Export a backup before proceeding.","سيحذف سجل المتصفح الحالي، بما فيه الملاحظات والتقدم. صدّر نسخة قبل المتابعة."),T("Reset this device","إعادة ضبط هذا الجهاز"))){
    const lang=state.language;recoverStorage();state=freshState();state.language=lang;persist();render();toast(T("Local data reset.","تمت إعادة ضبط البيانات المحلية."));
   }break;
   case "close-modal":case "close-modal-backdrop":closeModal();pendingImport=null;break;
   case "import-replace":
    if(pendingImport){state=pendingImport;pendingImport=null;persist();closeModal();render();toast(T("Backup imported.","تم استيراد النسخة."));}
    break;
   case "import-merge":{
    if(!pendingImport)break;
    const incoming=pendingImport;pendingImport=null;
    state.progress=mergeProgress(state.progress,incoming.progress);
    const seen=new Set(state.notes.map(n=>n.id));
    for(const n of incoming.notes||[])if(!seen.has(n.id)){state.notes.push(n);seen.add(n.id);}
    state.saved=[...new Set([...(state.saved||[]),...(incoming.saved||[])])];
    for(const [k,v] of Object.entries(incoming.quizDrafts||{}))if(!state.quizDrafts[k])state.quizDrafts[k]=v;
    for(const [k,v] of Object.entries(incoming.practices||{}))if(!state.practices[k])state.practices[k]=v;
    for(const [k,v] of Object.entries(incoming.toolValues||{}))if(!state.toolValues[k])state.toolValues[k]=v;
    if(!state.capstone?.fields||Object.keys(state.capstone.fields).length===0)state.capstone=incoming.capstone||state.capstone;
    persist();closeModal();render({keepScroll:true});toast(T("Records merged. Best evidence kept.","دُمجت السجلات مع الاحتفاظ بأفضل الأدلة."));
    break;
   }
  case "edit-content":editContent(id);break;
  case "reset-content":delete state.contentOverrides[id];persist();closeModal();render({keepScroll:true});toast(T("Original source restored.","تمت استعادة المصدر الأصلي."));break;
  case "print":window.print();break;
  case "load-video":loadVideo(id);break;
 }
});
document.addEventListener("submit",event=>{
 const form=event.target;
 if(!(form instanceof HTMLFormElement))return;
 event.preventDefault();
 const data=new FormData(form);
 switch(form.id){
  case "global-search":navigate("/library?q="+encodeURIComponent(String(data.get("q")||"")));break;
  case "library-filter":{
   const params=new URLSearchParams();for(const k of ["q","lang","module"]){const v=String(data.get(k)||"");if(v&&v!=="all")params.set(k,v);}
   navigate(`${route.path}?${params}`);break;
  }
  case "quiz-form":submitQuiz(form);break;
  case "practice-form":{
   const c=cases.find(c=>c.id===form.dataset.id),intent=event.submitter?.value||"draft",values=getFieldValues(form,c.fields),rubric=c.rubric.map((r,i)=>data.has("rubric-"+i)?i:null).filter(i=>i!==null);
   const missing=validateTextFields(values,c.fields,30);showFieldErrors(c.fields,intent==="submit"?missing:[],30);
   if(intent==="submit"&&(missing.length||rubric.length!==c.rubric.length)){document.getElementById("practice-error").textContent=T("Complete every response and confirm all self-review statements before submitting.","أكمل كل الإجابات وأكد جميع بنود المراجعة الذاتية قبل التسليم.");return;}
   state.practices[c.id]={fields:values,rubric,status:intent==="submit"?"submitted":"draft",updatedAt:new Date().toISOString()};
   persist();render({keepScroll:true});toast(intent==="submit"?T("Practice submitted locally; no manager approval is implied.","تم تسليم التطبيق محليًا؛ دون ادعاء اعتماد المدير."):T("Practice draft saved.","حُفظت مسودة التطبيق."));break;
  }
  case "tool-form":{
   const tool=tools.find(t=>t.id===form.dataset.id);state.toolValues[tool.id]=getFieldValues(form,tool.fields);persist();toast(T("Canvas saved.","تم حفظ النموذج."));break;
  }
  case "assessment-form":{
   const values={},missing=[];
   assessmentItems.forEach(([id])=>{const v=data.get(id);if(v===null)missing.push(id);else values[id]=Number(v);});
   if(missing.length){document.getElementById("assessment-error").textContent=T("Choose a rating or Not observed for each behavior.","اختر درجة أو «لم ألاحظه» لكل سلوك.");form.querySelector(`input[name="${missing[0]}"]`)?.focus();return;}
   state.assessments[form.dataset.phase]={values,focus:String(data.get("focus")||"").trim().slice(0,1000),at:new Date().toISOString()};
   persist();toast(T("Self-reflection saved. It is separate from quiz scores.","تم حفظ المراجعة الذاتية بشكل منفصل عن درجات الاختبارات."));break;
  }
  case "note-form":if(addNote(String(data.get("text")||""),String(data.get("lessonId")||""))){render({keepScroll:true});toast(T("Note added.","أُضيفت الملاحظة."));}break;
  case "edit-note-form":{
   const n=state.notes.find(n=>n.id===form.dataset.id),text=String(data.get("text")||"").trim();
   if(n&&text){n.text=text.slice(0,4000);n.updatedAt=new Date().toISOString();persist();closeModal();render({keepScroll:true});toast(T("Note updated.","تم تحديث الملاحظة."));}break;
  }
  case "capstone-form":{
   const intent=event.submitter?.value||"draft",values=getFieldValues(form,capstoneFields),missing=validateTextFields(values,capstoneFields,40),honest=data.has("honest");
   showFieldErrors(capstoneFields,intent==="submit"?missing:[],40);
   if(intent==="submit"&&(missing.length||!honest)){document.getElementById("capstone-error").textContent=T("Complete all six fields (40 characters each) and confirm the declaration.","أكمل الحقول الستة (٤٠ حرفًا لكل منها) وأكد الإقرار.");return;}
   state.capstone={fields:values,honest,status:intent==="submit"?"submitted":"draft",updatedAt:new Date().toISOString()};
   persist();render({keepScroll:true});toast(intent==="submit"?T("Impact challenge submitted locally.","تم تسليم تحدي الأثر محليًا."):T("Impact challenge draft saved.","حُفظت مسودة تحدي الأثر."));break;
  }
  case "profile-form":{
   state.profile={name:String(data.get("name")||"").trim().slice(0,100),department:String(data.get("department")||"").slice(0,100),role:String(data.get("role")||"").slice(0,100),weeklyGoal:Math.min(600,Math.max(15,Number(data.get("weeklyGoal"))||90))};
   persist();render({keepScroll:true});toast(T("Your preferences are saved locally.","تفضيلاتك محفوظة محليًا."));break;
  }
  case "issue-form":{
   const text=String(data.get("text")||"").trim();if(text.length<10)return;
   state.issues.push({id:globalThis.crypto?.randomUUID?.()||`issue-${Date.now()}`,type:String(data.get("type")),text:text.slice(0,4000),at:new Date().toISOString()});
   persist();form.reset();toast(T("Report saved locally. It has not been sent.","حُفظ التقرير محليًا ولم يُرسل."));break;
  }
  case "question-selector":navigate("/admin/questions?lesson="+encodeURIComponent(String(data.get("lesson")||"")));break;
  case "content-edit-form":{
   const id=form.dataset.id,videoId=String(data.get("youtubeId")||"").trim();
   if(!validYoutubeId(videoId)){document.getElementById("content-error").textContent=T("Enter a valid 11-character YouTube ID, not a full URL.","أدخل معرّف يوتيوب صحيحًا من ١١ حرفًا، وليس رابطًا كاملًا.");return;}
   state.contentOverrides[id]={youtubeId:videoId,note:String(data.get("note")||"").slice(0,2000),reviewedAt:null};
   persist();closeModal();render({keepScroll:true});toast(T("Local override saved. Source and quiz alignment need review.","حُفظ التعديل محليًا. تلزم مراجعة المصدر وتوافق الاختبار."));break;
  }
 }
});
document.addEventListener("change",async event=>{
 const el=event.target;
 if(el.matches('input[type="radio"]')&&el.closest("#quiz-form")){
  const id=el.closest("#quiz-form").dataset.id,draft=state.quizDrafts[id];if(!draft||draft.submitted)return;
  draft.answers[el.name]=el.value;persist();
  document.querySelectorAll(`input[name="${el.name}"]`).forEach(r=>r.closest(".quiz-option").classList.toggle("selected",r.checked));
  document.getElementById("answered-count").textContent=`${number(Object.keys(draft.answers).length)} / ${number(questionBank[id].length)}`;
 }
  if(el.dataset.setting){
  const key=el.dataset.setting;
  if(["reducedMotion","highContrast"].includes(key)){state[key]=Boolean(el.checked);persist();document.documentElement.classList.toggle(key==="reducedMotion"?"reduced-motion":"high-contrast",el.checked);toast(T("Preference saved.","تم حفظ التفضيل."));}
  if(key==="theme"){state.theme=el.value;persist();applyTheme(state.theme);toast(T("Preference saved.","تم حفظ التفضيل."));}
 }
 if(el.id==="import-data"&&el.files?.[0]){
  const file=el.files[0];
  try{
   if(file.size>6000000)throw new Error("Too large");
   const imported=validateImport(JSON.parse(await file.text()));
   // Restrict data keyed by known curriculum identifiers before it reaches the UI.
   const lessonIds=new Set(lessonList.map(l=>l.id)),caseIds=new Set(cases.map(c=>c.id)),toolIds=new Set(tools.map(t=>t.id));
   for(const field of ["progress","quizDrafts","contentOverrides","questionOverrides","lessonFlags"])if(Object.keys(imported[field]).some(id=>!lessonIds.has(id)))throw new Error("Unknown lesson");
   if(Object.keys(imported.practices).some(id=>!caseIds.has(id))||Object.keys(imported.toolValues).some(id=>!toolIds.has(id))||imported.saved.some(id=>!lessonIds.has(id)))throw new Error("Unknown record");
   for(const [id,d] of Object.entries(imported.quizDrafts)){
    const qs=questionBank[id],ids=new Set(qs.map(q=>q.id));
    if(!Array.isArray(d.order)||d.order.length!==qs.length||new Set(d.order).size!==qs.length||d.order.some(qid=>!ids.has(qid))||!d.answers||!d.optionOrder)throw new Error("Invalid quiz draft");
    for(const q of qs){if(!Array.isArray(d.optionOrder[q.id])||d.optionOrder[q.id].length!==4||new Set(d.optionOrder[q.id]).size!==4||d.optionOrder[q.id].some(oid=>!q.options.some(o=>o.id===oid)))throw new Error("Invalid options");}
   }
   if(imported.checksum){
    const recomputed=checksumString({schemaVersion:imported.schemaVersion,progress:imported.progress,notes:imported.notes,saved:imported.saved,practices:imported.practices,capstone:imported.capstone,deviceProfileId:imported.deviceProfileId});
    if(recomputed!==imported.checksum)throw new Error("Checksum mismatch");
   }
   const currentDone=countCompleted(state.progress),incomingDone=countCompleted(imported.progress);
   pendingImport=imported;
   openModal(T("Import learning record","استيراد سجل التعلم"),`<p>${T("Compare before choosing. Imported data is user-controlled and not independently verified.","قارن قبل الاختيار. البيانات المستوردة يتحكم بها المستخدم وليست متحققًا منها مستقلًا.")}</p><div class="backup-meta"><span>${T("This device","هذا الجهاز")}</span><strong>${number(currentDone)} / ${number(lessonList.length)}</strong></div><div class="backup-meta"><span>${T("Backup file","ملف النسخة")}</span><strong>${number(incomingDone)} / ${number(lessonList.length)}</strong></div><p class="small muted">${T("Merge keeps the best of both: watched seconds are united, best scores take the maximum, notes are combined. Replace discards this device's record.","الدمج يحتفظ بأفضل ما في النسختين: تُوحّد ثواني المشاهدة، وتُؤخذ أعلى الدرجات، وتُدمج الملاحظات. الاستبدال يحذف سجل هذا الجهاز.")}</p><div class="form-actions"><button class="btn btn-outline" data-action="close-modal">${T("Cancel","إلغاء")}</button><button class="btn btn-dark" data-action="import-merge">${T("Merge","دمج")}</button><button class="btn btn-red" data-action="import-replace">${T("Replace","استبدال")}</button></div>`);
  }catch{toast(T("This file is not a valid compatible KAD backup. No data was changed.","هذا الملف ليس نسخة KAD متوافقة وصحيحة. لم تتغير البيانات."),"error");}
  el.value="";
 }
});
document.addEventListener("input",event=>{
 if(event.target.id!=="lesson-reflection")return;
 const id=event.target.dataset.id, value=event.target.value.slice(0,4000);
 // Save synchronously so immediate navigation, export, or page close cannot lose the last keystroke.
 upsertProgress(id).reflection=value;persist();
 const counter=document.getElementById("reflection-length");
 if(counter)counter.textContent=`${number(value.trim().length)} / ${number(REFLECTION_MIN)} ${T("minimum characters","حرفًا كحد أدنى")}`;
 refreshCompletion(id);
});
document.addEventListener("keydown",event=>{
 if(event.key==="Escape"){
  if(document.querySelector(".modal"))closeModal();
  document.body.classList.remove("nav-open");
 }
 if(event.key==="/"&&!["INPUT","TEXTAREA","SELECT"].includes(event.target.tagName)){
  event.preventDefault();document.getElementById("search-all")?.focus();
 }
 if(event.key==="Tab"&&document.querySelector(".modal")){
  const f=[...document.querySelectorAll(".modal button:not([disabled]),.modal input:not([disabled]),.modal textarea,.modal select,.modal a[href]")];
  const first=f[0],last=f.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }
});
window.addEventListener("hashchange",()=>render());
window.addEventListener("beforeunload",()=>persist());
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")persist();});
window.addEventListener("pagehide",()=>{persist();cleanupPlayer();});
try{ if(typeof location!=="undefined"&&/^https?:$/.test(location.protocol))requestPersistence().catch(()=>{}); }catch{}
render();
