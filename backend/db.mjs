import {DatabaseSync} from 'node:sqlite';
import {scryptSync,randomBytes,timingSafeEqual,createHmac,createHash} from 'node:crypto';
if(!process.env.IDENTITY_KEY||process.env.IDENTITY_KEY.length<32)throw Error('IDENTITY_KEY must contain at least 32 characters');
export const db=new DatabaseSync(process.env.DB_PATH||'school.sqlite');
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,identity TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('teacher','admin')),must_change INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS certificates(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),title TEXT,provider TEXT,date TEXT,hours REAL,category TEXT,year TEXT,drive_id TEXT UNIQUE,digest TEXT,status TEXT DEFAULT 'pending',created TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,digest));
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,user_id INTEGER,action TEXT,record_id INTEGER,created TEXT DEFAULT CURRENT_TIMESTAMP);`);
export const identityKey=x=>createHmac('sha256',process.env.IDENTITY_KEY).update(String(x).trim()).digest('hex');
export const digest=x=>createHash('sha256').update(x).digest('hex');
export function hash(password){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function verify(password,stored){try{const [salt,key]=stored.split(':');return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(key,'hex'));}catch{return false;}}
