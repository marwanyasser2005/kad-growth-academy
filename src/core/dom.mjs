export function esc(value="") {
  return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
export function downloadFile(name,text,mime="text/plain;charset=utf-8") {
  const url=URL.createObjectURL(new Blob([text],{type:mime}));
  const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export function debounce(fn,ms=400){let timer;return(...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),ms);};}
export function dateLabel(value,lang="en") {
  if(!value)return "—";const d=new Date(value);
  return Number.isNaN(d.getTime())?"—":d.toLocaleDateString(lang==="ar"?"ar-EG-u-nu-latn":"en-GB",{day:"numeric",month:"short",year:"numeric"});
}
export function formatTime(s) {
  if(!Number.isFinite(s)||s<0)return "—";
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
}
