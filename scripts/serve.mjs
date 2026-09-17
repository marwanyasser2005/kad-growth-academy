import http from "node:http";
import {readFile,stat} from "node:fs/promises";
import {resolve,dirname,extname,sep} from "node:path";
import {fileURLToPath} from "node:url";

const project=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const useDist=process.argv.includes("--dist");
const root=useDist?resolve(project,"dist"):project;
const portArg=process.argv.indexOf("--port");
const port=Number(portArg>=0?process.argv[portArg+1]:process.env.PORT||4173);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error("Choose a valid port.");
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".webmanifest":"application/manifest+json; charset=utf-8",".png":"image/png",".svg":"image/svg+xml",".txt":"text/plain; charset=utf-8",".md":"text/plain; charset=utf-8"};
const server=http.createServer(async(req,res)=>{
 if(!["GET","HEAD"].includes(req.method)){res.writeHead(405,{"Allow":"GET, HEAD"});res.end();return;}
 try{
  let pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  if(pathname.includes("\0"))throw new Error("Invalid path");
  if(pathname==="/")pathname="/index.html";
  const base=!useDist&&pathname.startsWith("/assets/")?resolve(project,"public"):root;
  const file=resolve(base,"."+pathname);
  if(file!==base&&!file.startsWith(base+sep)){res.writeHead(403);res.end("Forbidden");return;}
  // Do not serve project internals outside the intended dev folders.
  if(!useDist&&!/^\/(index\.html|src\/|assets\/|robots\.txt|manifest\.webmanifest|sw\.js)/.test(pathname)){res.writeHead(404);res.end("Not found");return;}
  const info=await stat(file);if(!info.isFile()){res.writeHead(404);res.end("Not found");return;}
  res.writeHead(200,{
   "Content-Type":mime[extname(file)]||"application/octet-stream",
   "Cache-Control":"no-store",
   "X-Content-Type-Options":"nosniff",
   "Referrer-Policy":"strict-origin-when-cross-origin",
   "X-Robots-Tag":"noindex, nofollow"
  });
  if(req.method==="HEAD"){res.end();return;}
  res.end(await readFile(file));
 }catch{res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});res.end("Not found");}
});
server.listen(port,"127.0.0.1",()=>console.log(`KAD Growth ${useDist?"production build":"development"}: http://localhost:${port}`));
