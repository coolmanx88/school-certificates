// Pipe one JSON record through stdin. Do not put identities or passwords in shell arguments.
import {db,identityKey,hash} from './db.mjs';
let input='';for await(const chunk of process.stdin)input+=chunk;
const u=JSON.parse(input);
if(!u.name||!/^\d{10}$/.test(u.identity)||!['teacher','admin'].includes(u.role)||typeof u.password!=='string'||u.password.length<12)throw Error('Invalid account: name, 10-digit identity, role and password (12+ characters) are required');
const old=db.prepare('SELECT id FROM users WHERE identity=?').get(identityKey(u.identity));
if(old){db.prepare('UPDATE users SET name=?,password=?,role=?,must_change=1 WHERE id=?').run(u.name,hash(u.password),u.role,old.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(old.id);}else db.prepare('INSERT INTO users(name,identity,password,role) VALUES(?,?,?,?)').run(u.name,identityKey(u.identity),hash(u.password),u.role);
console.log('Account saved. Password change is required on next login.');
