import {db,now,id,audit,databasePath} from "./db.mjs";
import {hashPassword,token} from "./security.mjs";

function value(flag){const i=process.argv.indexOf(flag);return i>=0?process.argv[i+1]:null;}
const email=String(value("--email")||"").trim().toLowerCase(),name=String(value("--name")||"KAD Administrator").trim();
if(!email||!email.includes("@")){console.error("Usage: node backend/bootstrap.mjs --email admin@company.example --name \"KAD Administrator\"");process.exit(1);}
const existing=db.prepare("SELECT id FROM users WHERE email=?").get(email);if(existing){console.error("An account with this email already exists.");process.exit(1);}
const password=`KAD-${token(12)}!7`,userId=id("user"),created=now();
db.prepare("INSERT INTO users(id,email,name,role,password_hash,must_change_password,active,created_at,updated_at) VALUES(?,?,?,?,?,1,1,?,?)").run(userId,email,name,"admin",hashPassword(password),created,created);
audit(userId,"admin_bootstrapped","user",userId,{});
console.log(`KAD ELEVATE administrator created\nEmail: ${email}\nTemporary password: ${password}\nDatabase: ${databasePath}\nChange this password immediately after first sign-in.`);

