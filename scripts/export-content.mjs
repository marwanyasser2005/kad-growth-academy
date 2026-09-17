import {writeFile, mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve, dirname} from "node:path";
import {curriculum} from "../src/data/curriculum.mjs";
import {questionBank} from "../src/data/questions.mjs";
import {cases, tools, futureTracks} from "../src/data/practice.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const folder=resolve(root,"content");
await mkdir(folder,{recursive:true});
const snapshots={
  "curriculum.json":curriculum,
  "question-bank.json":{version:curriculum.version,assessmentType:"original_topic_aligned_formative",questionBank},
  "practice.json":{version:curriculum.version,cases,tools,futureTracks},
  "source-register.json":{
    version:curriculum.version,
    qualification:"Title/URL lookup only; live playback, duration, captions, transcript alignment and institutional reuse need review.",
    resources:curriculum.lessons.map(l=>({
      lessonId:l.id,moduleId:l.moduleId,title:l.title,source:l.source,language:l.language,
      youtubeId:l.youtubeId,url:`https://www.youtube.com/watch?v=${l.youtubeId}`,
      questionCount:l.questionCount,quizSizing:"editorial_complexity",
      durationSeconds:l.durationSeconds,captions:l.captions,verification:l.verification
    }))
  }
};
for(const [name,data] of Object.entries(snapshots)){
 await writeFile(resolve(folder,name),JSON.stringify(data,null,2)+"\n");
 console.log(`Exported content/${name}`);
}
