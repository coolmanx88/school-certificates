import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const tabs=new Map(),props=new Map(),cache=new Map(),files=new Map();
function sheet(name,initial=[]){const data=initial;return {getLastRow:()=>data.length,getLastColumn:()=>data[0]?.length||0,appendRow:r=>data.push([...r]),setFrozenRows(){},setRightToLeft(){},getRange(row,col,height=1,width=1){return {getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>data[row-1+i]?.[col-1+j]??'')),getDisplayValues(){return this.getValues().map(r=>r.map(String));},setValues(rows){rows.forEach((r,i)=>{data[row-1+i]??=[];r.forEach((v,j)=>data[row-1+i][col-1+j]=v);});},setValue(value){this.setValues([[value]]);},clearContent(){this.setValue('');}};}};}
const source=[[''],[''],[''],[''],['التسلسل','الاسم الكامل','رقم الهوية','كلمة المرور المؤقتة','الصلاحية'],[1,'Admin','1000000000','Ab12@x','مسؤول'],[2,'Teacher','2000000000','Ab12@x','معلم']];
tabs.set('الحسابات',sheet('الحسابات',source));
const spreadsheet={getSheetByName:n=>tabs.get(n),insertSheet(n){const s=sheet(n);tabs.set(n,s);return s;}};
const signed=b=>Array.from(b,x=>x>127?x-256:x),buffer=x=>typeof x==='string'?Buffer.from(x):Buffer.from(x.map(b=>(b+256)%256));
const context=vm.createContext({console,Date,JSON,Math,Number,String,Array,Error,RegExp,Uint8Array,
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k)})},
 CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
 LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})},
 SpreadsheetApp:{openById:()=>spreadsheet,getUi:()=>({alert(){},showModalDialog(){}})},
 Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,x)=>signed(crypto.createHash('sha256').update(buffer(x)).digest()),computeHmacSha256Signature:(x,k)=>signed(crypto.createHmac('sha256',k).update(x).digest()),base64Decode:x=>signed(Buffer.from(x,'base64')),base64Encode:x=>buffer(x).toString('base64'),newBlob:(bytes,mime,name)=>({getBytes:()=>bytes})},
 DriveApp:{getFolderById:()=>({createFile(blob){const id=crypto.randomUUID();const f={getId:()=>id,getBlob:()=>blob,setTrashed:()=>files.delete(id)};files.set(id,f);return f;}}),getFileById:id=>files.get(id)}
});
vm.runInContext(await fs.readFile(new URL('../apps-script/Code.gs',import.meta.url),'utf8'),context);
context.initialize_();
const {rpc}=context;
assert.equal(rpc({path:'/certificates'}).status,401);
const setup=context.random_();cache.set('setup:'+context.hash_(setup),JSON.stringify({reset:false}));
source[5][3]='abcde';assert.equal(rpc({path:'/setup/pending',setupToken:setup}).status,400);source[5][3]='Ab12@x';
const pending=rpc({path:'/setup/pending',setupToken:setup});assert.equal(pending.status,200);
const derive=(password,salt)=>crypto.pbkdf2Sync(password,salt,600000,32,'sha256').toString('hex');
const entries=pending.data.entries.map(e=>({row:e.row,salt:e.salt,verifier:derive(e.password,e.salt)}));
assert.equal(rpc({path:'/setup/commit',setupToken:setup,body:{entries}}).data.count,2);
assert.equal(source[5][3],'');assert.equal(source[6][3],'');assert.equal(rpc({path:'/setup/pending',setupToken:setup}).status,400);
function login(identity){const challenge=rpc({path:'/challenge',method:'POST',body:{identity}});assert.equal(challenge.status,200);const r=rpc({path:'/login',method:'POST',body:{identity,verifier:derive('Ab12@x',challenge.data.salt)}});assert.equal(r.status,200);return r.data;}
const t=login('2000000000'),a=login('1000000000');
assert.equal(rpc({path:'/certificates',token:t.token}).status,400);
for(const account of [t,a]){const salt=crypto.randomBytes(16).toString('hex');assert.equal(rpc({path:'/password',method:'POST',token:account.token,body:{current:derive('Ab12@x',account.user.salt),verifier:derive('Zy98@q',salt),salt}}).status,200);}
assert.equal(rpc({path:'/certificates',token:t.token}).status,403);
const body={title:'Course',provider:'School',date:'2026-10-13',hours:3,category:'Training',year:'1448',fileBase64:Buffer.from('%PDF-1.4 mock').toString('base64')};
assert.equal(rpc({path:'/certificates',method:'POST',token:t.token,body}).status,200);
assert.equal(rpc({path:'/certificates',method:'POST',token:t.token,body}).status,400);assert.equal(files.size,1);
const list=rpc({path:'/certificates',token:a.token});assert.equal(list.data.length,1);const id=list.data[0].id;
assert.equal(rpc({path:'/certificates/'+id+'/file',token:t.token}).status,403);
assert.equal(rpc({path:'/certificates/'+id+'/file',token:a.token}).status,200);
assert.equal(rpc({path:'/certificates/'+id,method:'PATCH',token:a.token,body:{status:'approved'}}).status,200);
assert.equal(rpc({path:'/logout',method:'POST',token:t.token}).status,200);assert.equal(rpc({path:'/certificates',token:t.token}).status,401);
// Login attempts cannot bypass the rate limit by calling /login directly.
for(let i=0;i<11;i++)rpc({path:'/login',method:'POST',body:{identity:'3000000000',verifier:'0'.repeat(64)}});
assert.match(rpc({path:'/login',method:'POST',body:{identity:'3000000000',verifier:'0'.repeat(64)}}).data.error,/محاولات/);
console.log('PASS: account activation, PBKDF2 login, one-time setup, password change, role restrictions, mock PDF upload, duplicate prevention, admin download/review, logout and login throttling.');
