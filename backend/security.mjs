import {createHash,randomBytes,scryptSync,timingSafeEqual} from "node:crypto";

export const token=bytes=>randomBytes(bytes).toString("base64url");
export const sha256=value=>createHash("sha256").update(String(value)).digest("hex");
export function hashPassword(password){
 const salt=randomBytes(16);const derived=scryptSync(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
 return `scrypt$32768$8$1$${salt.toString("base64")}$${derived.toString("base64")}`;
}
export function verifyPassword(password,stored){
 try{const [kind,n,r,p,salt,hash]=String(stored).split("$");if(kind!=="scrypt")return false;const expected=Buffer.from(hash,"base64");const actual=scryptSync(password,Buffer.from(salt,"base64"),expected.length,{N:Number(n),r:Number(r),p:Number(p),maxmem:64*1024*1024});return timingSafeEqual(actual,expected);}catch{return false;}
}
export function validPassword(value){return typeof value==="string"&&value.length>=12&&value.length<=128&&/[a-z]/i.test(value)&&/\d/.test(value)&&/[^a-z\d]/i.test(value);}
export function parseCookies(header=""){return Object.fromEntries(header.split(";").map(part=>part.trim()).filter(Boolean).map(part=>{const i=part.indexOf("=");return [decodeURIComponent(i<0?part:part.slice(0,i)),decodeURIComponent(i<0?"":part.slice(i+1))];}));}
export function safeText(value,max=4000){return typeof value==="string"?value.trim().slice(0,max):"";}

const buckets=new Map();
export function rateLimit(key,{limit=10,windowMs=60000}={}){const now=Date.now(),bucket=buckets.get(key);if(!bucket||bucket.reset<=now){buckets.set(key,{count:1,reset:now+windowMs});return true;}bucket.count++;return bucket.count<=limit;}

