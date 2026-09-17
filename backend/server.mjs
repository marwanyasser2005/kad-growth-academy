import {createServer} from "node:http";
import {readFile,stat} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {db,now,id,audit,transaction,databasePath} from "./db.mjs";
import {academyTracks,academyUnits,academyQuestions} from "../src/data/academy.mjs";
import {calculateScore,unitComplete} from "../src/core/engine.mjs";
import {token,sha256,verifyPassword,hashPassword,validPassword,parseCookies,safeText,rateLimit} from "./security.mjs";

const host=process.env.KAD_TEAM_HOST||"127.0.0.1",port=Number(process.env.PORT||process.env.KAD_TEAM_PORT||3000);
const distRoot=resolve("dist"),secureCookie=process.env.KAD_COOKIE_SECURE==="true",sessionHours=8,idleMinutes=30;
const unitIds=new Set(academyUnits.map(unit=>unit.id));
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".svg":"image/svg+xml",".webmanifest":"application/manifest+json"};
const csp="default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://i.ytimg.com; frame-src https://www.youtube-nocookie.com https://www.youtube.com; connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
function headers(extra={}){return {"Cache-Control":"no-store","Content-Security-Policy":csp,"Cross-Origin-Opener-Policy":"same-origin","Cross-Origin-Resource-Policy":"same-origin","Permissions-Policy":"camera=(), microphone=(), geolocation=()","Referrer-Policy":"strict-origin-when-cross-origin","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY",...extra};}
function json(res,status,data,extra={}){res.writeHead(status,headers({"Content-Type":"application/json; charset=utf-8",...extra}));res.end(JSON.stringify(data));}
function fail(res,status,code,message){json(res,status,{error:{code,message}});}
async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>262144)throw Object.assign(new Error("Payload too large"),{status:413});chunks.push(chunk);}if(!chunks.length)return {};try{return JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw Object.assign(new Error("Invalid JSON"),{status:400});}}
function requestOriginOk(req){const origin=req.headers.origin;if(!origin)return true;const expected=`${secureCookie?"https":"http"}://${req.headers.host}`;return origin===expected;}
function setSessionCookie(raw){return `kad_session=${encodeURIComponent(raw)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionHours*3600}${secureCookie?"; Secure":""}`;}
function clearCookie(){return `kad_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookie?"; Secure":""}`;}
function currentSession(req){
 const raw=parseCookies(req.headers.cookie).kad_session;if(!raw)return null;const current=now();
 const row=db.prepare(`SELECT s.*,u.email,u.name,u.role,u.manager_id,u.must_change_password,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=? AND s.expires_at>?`).get(sha256(raw),current);
 if(!row||!row.active)return null;const idle=Date.now()-Date.parse(row.last_seen_at);if(idle>idleMinutes*60000){db.prepare("DELETE FROM sessions WHERE id_hash=?").run(sha256(raw));return null;}
 db.prepare("UPDATE sessions SET last_seen_at=? WHERE id_hash=?").run(current,sha256(raw));return {...row,raw};
}
function requireSession(req,res,roles=[]){const session=currentSession(req);if(!session){fail(res,401,"AUTH_REQUIRED","Sign in required");return null;}if(roles.length&&!roles.includes(session.role)){fail(res,403,"FORBIDDEN","Insufficient role");return null;}return session;}
function requireCsrf(req,res,session){if(req.headers["x-csrf-token"]&&sha256(req.headers["x-csrf-token"])===session.csrf_hash)return true;fail(res,403,"CSRF","Request token is missing or invalid");return false;}
function publicCatalog(){return academyTracks.map(track=>({...track,units:track.units.map(({questions,...unit})=>({...unit,questions:questions.map(({correctId,explanation,...q})=>q)}))}));}
function userView(row){return {id:row.user_id||row.id,email:row.email,name:row.name,role:row.role,managerId:row.manager_id||null,mustChangePassword:Boolean(row.must_change_password)};}
function refreshServerCompletion(userId,unitId){const row=db.prepare("SELECT read_confirmed,application,best_score,completed_at FROM unit_progress WHERE user_id=? AND unit_id=?").get(userId,unitId);if(row&&unitComplete({readConfirmed:Boolean(row.read_confirmed),application:row.application,bestScore:row.best_score})&&!row.completed_at)db.prepare("UPDATE unit_progress SET completed_at=?,updated_at=? WHERE user_id=? AND unit_id=?").run(now(),now(),userId,unitId);}
async function api(req,res,url){
 const method=req.method||"GET",path=url.pathname,ip=req.socket.remoteAddress||"unknown";
 if(method!=="GET"&&!requestOriginOk(req))return fail(res,403,"ORIGIN","Origin check failed");
 if(method==="GET"&&path==="/api/health")return json(res,200,{status:"ok",release:"2.0",database:"sqlite",time:now()});
 if(method==="GET"&&path==="/api/catalog")return json(res,200,{release:"2.0",tracks:publicCatalog()});
 if(method==="POST"&&path==="/api/auth/login"){
  if(!rateLimit(`login:${ip}`,{limit:8,windowMs:15*60000}))return fail(res,429,"RATE_LIMIT","Try again later");
  const data=await body(req),email=safeText(data.email,254).toLowerCase(),password=String(data.password||"");const user=db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if(!user||!user.active||!verifyPassword(password,user.password_hash)){audit(user?.id||null,"login_failed","session",null,{ip});return fail(res,401,"INVALID_CREDENTIALS","Email or password is incorrect");}
  const raw=token(32),csrf=token(24),created=now(),expires=new Date(Date.now()+sessionHours*3600000).toISOString();
  db.prepare("INSERT INTO sessions(id_hash,user_id,csrf_hash,created_at,last_seen_at,expires_at,user_agent,ip) VALUES(?,?,?,?,?,?,?,?)").run(sha256(raw),user.id,sha256(csrf),created,created,expires,safeText(req.headers["user-agent"],300),ip);
  audit(user.id,"login_success","session",sha256(raw).slice(0,12),{});return json(res,200,{user:userView(user),csrfToken:csrf},{"Set-Cookie":setSessionCookie(raw)});
 }
 const session=requireSession(req,res);if(!session)return;
 if(method!=="GET"&&!requireCsrf(req,res,session))return;
 if(method==="POST"&&path==="/api/auth/logout"){db.prepare("DELETE FROM sessions WHERE id_hash=?").run(sha256(session.raw));audit(session.user_id,"logout","session",null,{});return json(res,200,{ok:true},{"Set-Cookie":clearCookie()});}
 if(method==="POST"&&path==="/api/auth/password"){
  const data=await body(req);if(!verifyPassword(String(data.currentPassword||""),db.prepare("SELECT password_hash FROM users WHERE id=?").get(session.user_id).password_hash))return fail(res,400,"CURRENT_PASSWORD","Current password is incorrect");
  if(!validPassword(data.newPassword))return fail(res,400,"WEAK_PASSWORD","Use 12–128 characters with a letter, number and symbol");
  transaction(()=>{db.prepare("UPDATE users SET password_hash=?,must_change_password=0,updated_at=? WHERE id=?").run(hashPassword(data.newPassword),now(),session.user_id);db.prepare("DELETE FROM sessions WHERE user_id=? AND id_hash<>?").run(session.user_id,sha256(session.raw));audit(session.user_id,"password_changed","user",session.user_id,{});});return json(res,200,{ok:true});
 }
 if(method==="GET"&&path==="/api/me"){
  const preferences=db.prepare("SELECT language,reduced_motion,high_contrast FROM preferences WHERE user_id=?").get(session.user_id)||null;
  const progress=db.prepare("SELECT unit_id,read_confirmed,application,best_score,completed_at,updated_at FROM unit_progress WHERE user_id=?").all(session.user_id);
  const assignments=db.prepare("SELECT id,unit_id,due_at,status,created_at FROM assignments WHERE user_id=? ORDER BY due_at IS NULL,due_at").all(session.user_id);
  return json(res,200,{user:userView(session),preferences,progress,assignments});
 }
 if(method==="PUT"&&path==="/api/me/preferences"){
  const data=await body(req),language=["ar","en"].includes(data.language)?data.language:"ar";
  db.prepare("INSERT INTO preferences(user_id,language,reduced_motion,high_contrast,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET language=excluded.language,reduced_motion=excluded.reduced_motion,high_contrast=excluded.high_contrast,updated_at=excluded.updated_at").run(session.user_id,language,data.reducedMotion?1:0,data.highContrast?1:0,now());return json(res,200,{ok:true});
 }
 const progressMatch=path.match(/^\/api\/progress\/([^/]+)$/);
 if(method==="PUT"&&progressMatch){const unitId=decodeURIComponent(progressMatch[1]);if(!unitIds.has(unitId))return fail(res,404,"UNIT_NOT_FOUND","Unknown unit");const data=await body(req),application=safeText(data.application,4000);db.prepare(`INSERT INTO unit_progress(user_id,unit_id,read_confirmed,application,best_score,updated_at) VALUES(?,?,?,?,0,?) ON CONFLICT(user_id,unit_id) DO UPDATE SET read_confirmed=MAX(read_confirmed,excluded.read_confirmed),application=excluded.application,updated_at=excluded.updated_at`).run(session.user_id,unitId,data.readConfirmed?1:0,application,now());refreshServerCompletion(session.user_id,unitId);audit(session.user_id,"progress_updated","unit",unitId,{});return json(res,200,{ok:true});}
 const quizMatch=path.match(/^\/api\/quizzes\/([^/]+)\/attempts$/);
 if(method==="POST"&&quizMatch){const unitId=decodeURIComponent(quizMatch[1]),questions=academyQuestions[unitId];if(!questions)return fail(res,404,"UNIT_NOT_FOUND","Unknown unit");const data=await body(req),answers=data.answers&&typeof data.answers==="object"?data.answers:{},result=calculateScore(questions,answers),attemptId=id("attempt"),created=now();transaction(()=>{db.prepare("INSERT INTO quiz_attempts(id,user_id,unit_id,score,answer_count,created_at) VALUES(?,?,?,?,?,?)").run(attemptId,session.user_id,unitId,result.percent,Object.keys(answers).length,created);db.prepare(`INSERT INTO unit_progress(user_id,unit_id,best_score,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,unit_id) DO UPDATE SET best_score=MAX(best_score,excluded.best_score),updated_at=excluded.updated_at`).run(session.user_id,unitId,result.percent,created);refreshServerCompletion(session.user_id,unitId);audit(session.user_id,"quiz_graded","unit",unitId,{score:result.percent});});return json(res,200,{attemptId,score:result.percent,passed:result.passed,correct:result.correct,total:result.total,explanations:questions.map(q=>({id:q.id,correctId:q.correctId,explanation:q.explanation}))});}
 if(method==="POST"&&path==="/api/evidence"){const data=await body(req),unitId=safeText(data.unitId,100),summary=safeText(data.summary,4000),result=safeText(data.result,4000),nextStep=safeText(data.nextStep,4000);if(!unitIds.has(unitId)||[summary,result,nextStep].some(v=>v.length<30))return fail(res,400,"INVALID_EVIDENCE","Unit and three meaningful evidence fields are required");const evidenceId=id("evidence"),created=now();db.prepare("INSERT INTO evidence(id,user_id,unit_id,summary,result,next_step,shared_with_manager,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(evidenceId,session.user_id,unitId,summary,result,nextStep,data.sharedWithManager?1:0,created,created);audit(session.user_id,"evidence_created","evidence",evidenceId,{shared:Boolean(data.sharedWithManager)});return json(res,201,{id:evidenceId});}
 if(method==="GET"&&path==="/api/manager/team"){
  if(!["manager","admin"].includes(session.role))return fail(res,403,"FORBIDDEN","Manager role required");const rows=session.role==="admin"?db.prepare(`SELECT u.id,u.name,u.email,u.role,COUNT(p.unit_id) units_started,SUM(CASE WHEN p.completed_at IS NOT NULL THEN 1 ELSE 0 END) units_completed FROM users u LEFT JOIN unit_progress p ON p.user_id=u.id WHERE u.active=1 GROUP BY u.id ORDER BY u.name`).all():db.prepare(`SELECT u.id,u.name,u.email,u.role,COUNT(p.unit_id) units_started,SUM(CASE WHEN p.completed_at IS NOT NULL THEN 1 ELSE 0 END) units_completed FROM users u LEFT JOIN unit_progress p ON p.user_id=u.id WHERE u.active=1 AND u.manager_id=? GROUP BY u.id ORDER BY u.name`).all(session.user_id);return json(res,200,{members:rows});
 }
 if(method==="GET"&&path==="/api/manager/evidence"){
  if(!["manager","admin"].includes(session.role))return fail(res,403,"FORBIDDEN","Manager role required");const rows=session.role==="admin"?db.prepare(`SELECT e.*,u.name,u.email FROM evidence e JOIN users u ON u.id=e.user_id WHERE e.shared_with_manager=1 ORDER BY e.updated_at DESC`).all():db.prepare(`SELECT e.*,u.name,u.email FROM evidence e JOIN users u ON u.id=e.user_id WHERE e.shared_with_manager=1 AND u.manager_id=? ORDER BY e.updated_at DESC`).all(session.user_id);return json(res,200,{evidence:rows});
 }
 const reviewMatch=path.match(/^\/api\/reviews\/([^/]+)$/);
 if(method==="POST"&&reviewMatch){if(!["manager","admin"].includes(session.role))return fail(res,403,"FORBIDDEN","Manager role required");const evidenceId=decodeURIComponent(reviewMatch[1]),evidence=db.prepare("SELECT e.*,u.manager_id FROM evidence e JOIN users u ON u.id=e.user_id WHERE e.id=? AND e.shared_with_manager=1").get(evidenceId);if(!evidence||(session.role!=="admin"&&evidence.manager_id!==session.user_id))return fail(res,404,"EVIDENCE_NOT_FOUND","Evidence is unavailable");const data=await body(req),decision=["acknowledged","revise"].includes(data.decision)?data.decision:null,comment=safeText(data.comment,2000);if(!decision||comment.length<10)return fail(res,400,"INVALID_REVIEW","Decision and comment are required");const reviewId=id("review");db.prepare("INSERT INTO reviews(id,evidence_id,reviewer_id,decision,comment,created_at) VALUES(?,?,?,?,?,?)").run(reviewId,evidenceId,session.user_id,decision,comment,now());audit(session.user_id,"evidence_reviewed","evidence",evidenceId,{decision});return json(res,201,{id:reviewId});}
 return fail(res,404,"NOT_FOUND","API route not found");
}
async function serveStatic(req,res,url){let relative=url.pathname==="/"?"index.html":decodeURIComponent(url.pathname.slice(1));if(relative.includes("..")||relative.includes("\\"))return fail(res,400,"PATH","Invalid path");let file=resolve(distRoot,relative);if(!file.startsWith(distRoot+sep)&&file!==distRoot)return fail(res,403,"PATH","Invalid path");try{const info=await stat(file);if(!info.isFile())throw new Error();const data=await readFile(file);res.writeHead(200,headers({"Content-Type":mime[extname(file)]||"application/octet-stream","Cache-Control":relative==="index.html"?"no-cache":"public, max-age=3600"}));res.end(data);}catch{const data=await readFile(resolve(distRoot,"index.html"));res.writeHead(200,headers({"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}));res.end(data);}}
const server=createServer(async(req,res)=>{try{const url=new URL(req.url||"/",`http://${req.headers.host||host}`);if(url.pathname.startsWith("/api/"))await api(req,res,url);else await serveStatic(req,res,url);}catch(error){console.error(error);fail(res,error.status||500,error.status?"BAD_REQUEST":"INTERNAL",error.status?error.message:"Unexpected server error");}});
server.listen(port,host,()=>console.log(`KAD ELEVATE Team 2.0 listening on http://${host}:${port}\nDatabase: ${databasePath}`));
