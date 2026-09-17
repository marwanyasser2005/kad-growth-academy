import {mkdirSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {DatabaseSync} from "node:sqlite";

const dataDir=resolve(process.env.KAD_DATA_DIR||"backend/data");
mkdirSync(dataDir,{recursive:true});
export const databasePath=resolve(dataDir,"kad-elevate.sqlite");
export const db=new DatabaseSync(databasePath);
db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL;");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('learner','manager','admin')),manager_id TEXT REFERENCES users(id),
 password_hash TEXT NOT NULL,must_change_password INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
 id_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf_hash TEXT NOT NULL,created_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,expires_at TEXT NOT NULL,
 user_agent TEXT NOT NULL DEFAULT '',ip TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS preferences(
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,language TEXT CHECK(language IN ('ar','en')) DEFAULT 'ar',
 reduced_motion INTEGER NOT NULL DEFAULT 0,high_contrast INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS unit_progress(
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,unit_id TEXT NOT NULL,
 read_confirmed INTEGER NOT NULL DEFAULT 0,application TEXT NOT NULL DEFAULT '',best_score INTEGER NOT NULL DEFAULT 0,
 completed_at TEXT,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,unit_id)
);
CREATE TABLE IF NOT EXISTS quiz_attempts(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,unit_id TEXT NOT NULL,
 score INTEGER NOT NULL,answer_count INTEGER NOT NULL,created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assignments(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,unit_id TEXT NOT NULL,
 due_at TEXT,assigned_by TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL DEFAULT 'assigned',created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS evidence(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,unit_id TEXT NOT NULL,
 summary TEXT NOT NULL,result TEXT NOT NULL,next_step TEXT NOT NULL,shared_with_manager INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews(
 id TEXT PRIMARY KEY,evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,reviewer_id TEXT NOT NULL REFERENCES users(id),
 decision TEXT NOT NULL CHECK(decision IN ('acknowledged','revise')),comment TEXT NOT NULL,created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id TEXT,event_type TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT,
 metadata TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_progress_user ON unit_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager_id);
CREATE INDEX IF NOT EXISTS idx_evidence_user_shared ON evidence(user_id,shared_with_manager);
`);

export const now=()=>new Date().toISOString();
export const id=prefix=>`${prefix}_${crypto.randomUUID()}`;
export function audit(actorId,eventType,targetType,targetId=null,metadata={}){
 db.prepare("INSERT INTO audit_events(actor_id,event_type,target_type,target_id,metadata,created_at) VALUES(?,?,?,?,?,?)")
  .run(actorId||null,eventType,targetType,targetId,JSON.stringify(metadata),now());
}
export function transaction(fn){db.exec("BEGIN IMMEDIATE");try{const result=fn();db.exec("COMMIT");return result;}catch(error){db.exec("ROLLBACK");throw error;}}

