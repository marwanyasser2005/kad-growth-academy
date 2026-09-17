import {writeFile,mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";
import {curriculum} from "../src/data/curriculum.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const report={
 checkedAt:new Date().toISOString(),method:"public_youtube_oembed",
 meaning:"Metadata resolution only. This is NOT a playback, caption, transcript, licensing, or quiz-alignment audit.",
 resources:[]
};
for(const lesson of curriculum.lessons){
 const watchUrl=`https://www.youtube.com/watch?v=${lesson.youtubeId}`;
 const endpoint=new URL("https://www.youtube.com/oembed");
 endpoint.searchParams.set("url",watchUrl);endpoint.searchParams.set("format","json");
 const result={lessonId:lesson.id,youtubeId:lesson.youtubeId,url:watchUrl};
 try{
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(10000),redirect:"follow"});
  result.httpStatus=response.status;
  if(!response.ok)result.status="needs_review";
  else{
   const body=await response.json();
   if(typeof body.title!=="string"||typeof body.author_name!=="string")throw new Error("Unexpected metadata");
   result.status="metadata_resolved";result.title=body.title;result.author=body.author_name;
  }
 }catch(error){
  result.status="not_verified";
  result.error=error instanceof Error?error.message:"Request failed";
 }
 report.resources.push(result);
 console.log(`${result.lessonId}: ${result.status}`);
 await new Promise(resolve=>setTimeout(resolve,250));
}
await mkdir(resolve(root,"evidence"),{recursive:true});
await writeFile(resolve(root,"evidence/source-check.json"),JSON.stringify(report,null,2)+"\n");
const unresolved=report.resources.filter(r=>r.status!=="metadata_resolved").length;
console.log(`Saved evidence/source-check.json; ${unresolved} of ${report.resources.length} unresolved.`);
if(unresolved)process.exitCode=1;
