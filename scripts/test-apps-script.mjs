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
const folders=new Map();
function iterator(items){let i=0;return {hasNext:()=>i<items.length,next:()=>items[i++]};}
function folder(id,name,parent){let description='';const f={getId:()=>id,getName:()=>name,setName:n=>{name=n;},getDescription:()=>description,setDescription:d=>{description=d;},isTrashed:()=>false,getParents:()=>iterator(parent?[folders.get(parent)]:[]),getFilesByName:n=>iterator([...files.values()].filter(x=>x.getParents().next()?.getId()===id&&x.getName()===n)),getFolders:()=>iterator([...folders.values()].filter(x=>x.parent===id)),getFoldersByName:n=>iterator([...folders.values()].filter(x=>x.parent===id&&x.getName()===n)),createFolder(n){return folder(crypto.randomUUID(),n,id);},parent,createFile(blob){const fileId=crypto.randomUUID();let fileName=blob.name,fileParent=id;const file={getId:()=>fileId,getName:()=>fileName,setName:n=>{fileName=n;},getParents:()=>iterator([folders.get(fileParent)]),moveTo:d=>{fileParent=d.getId();},getBlob:()=>blob,setTrashed:()=>files.delete(fileId)};files.set(fileId,file);return file;}};folders.set(id,f);return f;}
folder('school-root','مدرسة معاذ بن جبل');folder('1Gt9CVz3ZPDkEeekgi0tb0NdxSTRqLx9Z','الشهادات','school-root');
const context=vm.createContext({console,Date,JSON,Math,Number,String,Array,Error,RegExp,Uint8Array,
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k)})},
 CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
 LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})},
 SpreadsheetApp:{openById:()=>spreadsheet,getUi:()=>({alert(){},showModalDialog(){}})},
 Utilities:{getUuid:()=>crypto.randomUUID(),formatDate:(v,tz)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(v),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,x)=>signed(crypto.createHash('sha256').update(buffer(x)).digest()),computeHmacSha256Signature:(x,k)=>signed(crypto.createHmac('sha256',k).update(x).digest()),base64Decode:x=>signed(Buffer.from(x,'base64')),base64Encode:x=>buffer(x).toString('base64'),newBlob:(bytes,mime,name)=>({name,getBytes:()=>bytes})},
 DriveApp:{getFolderById:id=>folders.get(id),getFileById:id=>files.get(id)}
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
const t=login('2000000000'),a=login('1000000000'),oldTeacher=login('2000000000');
assert.equal(rpc({path:'/me',token:t.token}).data.user.mustChange,true);
assert.equal(rpc({path:'/certificates',token:t.token}).status,400);
for(const account of [t,a]){const salt=crypto.randomBytes(16).toString('hex');assert.equal(rpc({path:'/password',method:'POST',token:account.token,body:{current:derive('Ab12@x',account.user.salt),verifier:derive('Zy98@q',salt),salt}}).status,200);}
assert.equal(rpc({path:'/me',token:t.token}).data.user.role,'teacher');assert.equal(rpc({path:'/me',token:t.token}).data.user.mustChange,false);assert.equal(rpc({path:'/me',token:oldTeacher.token}).status,401);
assert.equal(rpc({path:'/certificates',token:t.token}).status,403);
const body={title:'Course',provider:'School',date:'2026-10-13',hours:3,category:'Training',year:'1448',fileBase64:Buffer.from('%PDF-1.4 mock').toString('base64')};
assert.equal(rpc({path:'/certificates',method:'POST',token:t.token,body}).status,200);
assert.equal(rpc({path:'/certificates',method:'POST',token:t.token,body}).status,400);assert.equal(files.size,1);assert.equal([...files.values()][0].getName(),'Course.pdf');assert.equal([...files.values()][0].getParents().next().getName(),'Teacher');
tabs.get('Certificates').getRange(2,6).setValue(new Date('2026-10-12T21:00:00Z'));
const list=rpc({path:'/certificates',token:a.token});assert.equal(list.data[0].date,'2026-10-13');assert.equal(typeof list.data[0].date,'string');assert.equal(list.data.length,1);const originalFile=[...files.values()][0];originalFile.moveTo(folders.get('1Gt9CVz3ZPDkEeekgi0tb0NdxSTRqLx9Z'));originalFile.setName('old-uuid.pdf');context.organizeExistingCertificates_();assert.equal(originalFile.getName(),'Course.pdf');assert.equal(originalFile.getParents().next().getName(),'Teacher');context.organizeExistingCertificates_();assert.equal(files.size,1);assert.equal(context.certificateName_('A/B\\C.pdf'),'A B C.pdf');const id=list.data[0].id;
tabs.get('Certificates').getRange(2,12).setValue('correction');assert.equal(rpc({path:'/certificates',token:a.token}).data[0].status,'pending');assert.equal(rpc({path:'/certificates/'+id,method:'PATCH',token:a.token,body:{status:'correction'}}).status,400);assert.equal(rpc({path:'/certificates/'+id,method:'PATCH',token:a.token,body:{status:'pending'}}).status,200);

assert.equal(rpc({path:'/certificates/'+id+'/file',token:t.token}).status,403);
assert.equal(rpc({path:'/certificates/'+id+'/file',token:a.token}).status,200);
assert.equal(rpc({path:'/certificates/'+id,method:'PATCH',token:a.token,body:{status:'approved'}}).status,200);
const accounts=rpc({path:'/users',token:a.token});assert.equal(accounts.status,200);assert.equal(accounts.data.length,2);assert.ok(!('identityKey' in accounts.data[0]));assert.ok(!('passwordDigest' in accounts.data[0]));
const teacherId=accounts.data.find(x=>x.role==='teacher').id,adminId=accounts.data.find(x=>x.role==='admin').id;
assert.equal(rpc({path:'/users',token:t.token}).status,403);
const lastAdmin=rpc({path:'/users/'+adminId,method:'PATCH',token:a.token,body:{active:false}});assert.equal(lastAdmin.status,400);assert.match(lastAdmin.data.error,/آخر مسؤول/);
assert.equal(rpc({path:'/users/'+teacherId,method:'PATCH',token:a.token,body:{active:false}}).status,200);
assert.equal(rpc({path:'/me',token:t.token}).status,401);
const saltNow=context.userBy_('id',teacherId).values[3];
assert.equal(rpc({path:'/login',method:'POST',body:{identity:'2000000000',verifier:derive('Zy98@q',saltNow)}}).status,400);
assert.equal(rpc({path:'/certificates',token:a.token}).data.length,1);assert.equal(files.size,1);
assert.equal(rpc({path:'/users/'+teacherId,method:'PATCH',token:a.token,body:{active:true}}).status,200);
assert.equal(rpc({path:'/me',token:t.token}).status,401);
const resumed=rpc({path:'/login',method:'POST',body:{identity:'2000000000',verifier:derive('Zy98@q',saltNow)}});assert.equal(resumed.status,200);t.token=resumed.data.token;
// Older accounts with a blank active field remain enabled.
const stored=context.userBy_('id',teacherId);tabs.get('Users').getRange(stored.row,9).setValue('');assert.equal(rpc({path:'/me',token:t.token}).status,200);
const newSalt=crypto.randomBytes(16).toString('hex'),newAccount={name:'New teacher',identity:'4000000000',role:'teacher',salt:newSalt,verifier:derive('Ab12@x',newSalt),passwordLength:6};
assert.equal(rpc({path:'/users',method:'POST',token:t.token,body:newAccount}).status,403);
assert.equal(rpc({path:'/users',method:'POST',token:a.token,body:{...newAccount,passwordLength:5}}).status,400);
assert.equal(rpc({path:'/users',method:'POST',token:a.token,body:{...newAccount,identity:'123'}}).status,400);
assert.equal(rpc({path:'/users',method:'POST',token:a.token,body:{...newAccount,role:'superadmin'}}).status,400);
const created=rpc({path:'/users',method:'POST',token:a.token,body:newAccount});assert.equal(created.status,200);
assert.equal(rpc({path:'/users',method:'POST',token:a.token,body:newAccount}).status,400);
assert.equal(rpc({path:'/users',token:a.token}).data.length,3);
const createdUser=login('4000000000');assert.equal(createdUser.user.mustChange,true);assert.equal(createdUser.user.role,'teacher');
assert.equal(rpc({path:'/certificates',token:createdUser.token}).status,400);
assert.equal(rpc({path:'/users/'+created.data.id,method:'PATCH',token:a.token,body:{active:false}}).status,200);
assert.equal(rpc({path:'/users',method:'POST',token:a.token,body:newAccount}).status,400);
assert.equal(rpc({path:'/me',token:createdUser.token}).status,401);
assert.equal(rpc({path:'/certificates',token:a.token}).data.length,1);assert.equal(files.size,1);

const baseFiles=files.size;
for(const kind of ['weekly','term','portfolio']){
 const upload={kind,filename:'خطة.pdf',fileBase64:body.fileBase64};
 const saved=rpc({path:'/resources',method:'POST',token:t.token,body:upload});assert.equal(saved.status,200,JSON.stringify(saved));
 const file=[...files.values()].at(-1),parent=file.getParents().next();
 assert.equal(parent.getName(),{weekly:'الخطط الأسبوعية',term:'الخطة الفصلية',portfolio:'Teacher'}[kind]);
 assert.equal(rpc({path:'/resources',method:'POST',token:t.token,body:upload}).data.filename,'خطة (2).pdf');
}
assert.equal(rpc({path:'/resources',method:'POST',token:t.token,body:{kind:'bogus',filename:'x.pdf',fileBase64:body.fileBase64}}).status,400);
assert.equal(rpc({path:'/resources',method:'POST',token:t.token,body:{kind:'weekly',filename:'x.exe',fileBase64:body.fileBase64}}).status,400);
assert.equal(rpc({path:'/resources',method:'POST',token:t.token,body:{kind:'weekly',filename:'x.docx',fileBase64:body.fileBase64}}).status,400);
const resourceList=rpc({path:'/resources',token:t.token});assert.equal(resourceList.data.length,6);
assert.equal(rpc({path:'/resources',token:a.token}).data.length,6);
assert.equal(rpc({path:'/reports/missing-uploads',token:t.token}).status,403);
assert.equal(rpc({path:'/reports/missing-uploads',token:a.token}).data.length,0);
const userSheet= tabs.get('Users');
userSheet.appendRow(['report-none','No uploads','','','','teacher',false,1,true]);
userSheet.appendRow(['report-plan','Same name','','','','teacher',false,1,true]);
userSheet.appendRow(['report-cert','Same name','','','','teacher',false,1,true]);
userSheet.appendRow(['report-disabled','Disabled','','','','teacher',false,1,false]);
tabs.get('Resources').appendRow(['mock','report-plan','Same name','term','plan.pdf','','','']);
tabs.get('Certificates').appendRow(['mock','report-cert','Same name','Title','','',1,'','','','','pending','']);
const missingReport=rpc({path:'/reports/missing-uploads',token:a.token});assert.equal(missingReport.status,200);assert.equal(missingReport.data.length,3);
assert.equal(missingReport.data.find(r=>r.name==='No uploads').missing.join(','),'الشهادات,الخطط للمواد الدراسية,ملف الإنجاز');
const sameNames=missingReport.data.filter(r=>r.name==='Same name');assert.equal(sameNames.length,2);assert.ok(sameNames.some(r=>r.missing.join(',')==='الشهادات,ملف الإنجاز'));assert.ok(sameNames.some(r=>r.missing.join(',')==='الخطط للمواد الدراسية,ملف الإنجاز'));
// Exclude fixture accounts and rows from the remaining regression tests.
const actualRows=context.rows_;context.rows_=name=>actualRows(name).filter(r=>!String(r[0]).startsWith('report-')&&r[0]!=='mock');
console.log('PASS: admin-only missing report, complete teachers excluded, disabled accounts excluded, distinct IDs with identical names and term plans counted.');

const resourceId=resourceList.data[0].id;
assert.equal(rpc({path:'/resources/'+resourceId+'/file',token:a.token}).status,200);
const stranger={values:['other','Other',null,null,null,'teacher']};
assert.equal(context.resourceRequest_('/resources','GET',{},stranger).data.length,0);
assert.throws(()=>context.resourceRequest_('/resources/'+resourceId+'/file','GET',{},stranger),/FORBIDDEN/);
// Remove only test uploads to preserve the original account regression assertions.
for(const [key,file] of [...files])if(file!==originalFile)files.delete(key);
assert.equal(files.size,baseFiles);
console.log('PASS: three resource destinations, two plan subfolders, duplicate filenames, file validation, listing and admin download.');
assert.equal(rpc({path:'/logout',method:'POST',token:t.token}).status,200);assert.equal(rpc({path:'/certificates',token:t.token}).status,401);assert.equal(rpc({path:'/me',token:t.token}).status,401);
// Repeated incorrect passwords and stale lock records must not block valid logins.
for(const [identity,password,salt] of [['1000000000','Zy98@q',context.userBy_('id',adminId).values[3]],['2000000000','Zy98@q',context.userBy_('id',teacherId).values[3]]]){
 props.set('attempt:'+context.key_(identity),JSON.stringify({count:99,until:Date.now()+900000}));
 for(let i=0;i<15;i++){
  assert.equal(rpc({path:'/challenge',method:'POST',body:{identity}}).status,200);
  const failed=rpc({path:'/login',method:'POST',body:{identity,verifier:'0'.repeat(64)}});
  assert.equal(failed.status,400);assert.match(failed.data.error,/كلمة المرور/);assert.ok(!failed.data.error.includes('15'));
 }
 assert.equal(rpc({path:'/login',method:'POST',body:{identity,verifier:derive(password,salt)}}).status,200);
}
for(let i=0;i<15;i++)assert.match(rpc({path:'/login',method:'POST',body:{identity:'3000000000',verifier:'0'.repeat(64)}}).data.error,/كلمة المرور/);
const currentTeacher=context.userBy_('id',teacherId),beforeIdentity=currentTeacher.values[2];
const freshTeacher=rpc({path:'/login',method:'POST',body:{identity:'2000000000',verifier:derive('Zy98@q',currentTeacher.values[3])}});assert.equal(freshTeacher.status,200);
const resetSalt=crypto.randomBytes(16).toString('hex'),resetPayload={salt:resetSalt,verifier:derive('Temp6!',resetSalt),passwordLength:6};
assert.equal(rpc({path:'/users/'+teacherId+'/password',method:'POST',token:freshTeacher.data.token,body:resetPayload}).status,403);
assert.equal(rpc({path:'/users/'+teacherId+'/password',method:'POST',token:a.token,body:{...resetPayload,passwordLength:5}}).status,400);
assert.equal(rpc({path:'/users/'+teacherId+'/password',method:'POST',token:a.token,body:resetPayload}).status,200);
assert.equal(rpc({path:'/me',token:freshTeacher.data.token}).status,401);
assert.equal(context.userBy_('id',teacherId).values[2],beforeIdentity);assert.equal(files.size,1);assert.equal(rpc({path:'/certificates',token:a.token}).data.length,1);
assert.equal(rpc({path:'/login',method:'POST',body:{identity:'2000000000',verifier:derive('Zy98@q',resetSalt)}}).status,400);
const afterReset=rpc({path:'/login',method:'POST',body:{identity:'2000000000',verifier:resetPayload.verifier}});assert.equal(afterReset.status,200);assert.equal(afterReset.data.user.mustChange,true);
assert.equal(rpc({path:'/certificates',method:'POST',token:afterReset.data.token,body}).status,400);
assert.equal(rpc({path:'/users/'+created.data.id+'/password',method:'POST',token:a.token,body:resetPayload}).status,200);assert.equal(context.active_(context.userBy_('id',created.data.id)),false);

// A combined account keeps its administrator role and credentials, with explicit teaching permission.
const dualBody={...body,title:'Admin teaching',fileBase64:Buffer.from('%PDF-1.4 dual upload').toString('base64')};
assert.equal(rpc({path:'/certificates',method:'POST',token:a.token,body:dualBody}).status,403);
const teacherToken=afterReset.data.token;
assert.equal(rpc({path:'/users/'+adminId+'/teaching',method:'PATCH',token:teacherToken,body:{canTeach:true}}).status,400); // forced password change still enforced
const beforeAdmin=context.userBy_('id',adminId).values.slice(2,5).join(':');
assert.equal(rpc({path:'/users/'+adminId+'/teaching',method:'PATCH',token:a.token,body:{canTeach:true}}).status,200);
assert.equal(rpc({path:'/me',token:a.token}).data.user.canTeach,true);assert.equal(rpc({path:'/me',token:a.token}).data.user.role,'admin');
assert.equal(context.userBy_('id',adminId).values.slice(2,5).join(':'),beforeAdmin);
assert.equal(rpc({path:'/reports/missing-uploads',token:a.token}).data.filter(r=>r.name==='Admin').length,1);
assert.equal(rpc({path:'/certificates',method:'POST',token:a.token,body:dualBody}).status,200);
assert.equal(context.rows_('Certificates').at(-1)[1],adminId);
assert.equal(rpc({path:'/resources',method:'POST',token:a.token,body:{kind:'portfolio',filename:'Admin.pdf',fileBase64:dualBody.fileBase64}}).status,200);
const adminOnlyResources=rpc({path:'/resources',token:a.token,body:{viewMode:'teacher'}});assert.equal(adminOnlyResources.data.length,1);assert.equal(adminOnlyResources.data[0].name,'Admin');
assert.ok(rpc({path:'/resources',token:a.token}).data.length>1);
assert.equal(rpc({path:'/users/'+adminId+'/teaching',method:'PATCH',token:a.token,body:{canTeach:false}}).status,200);
assert.equal(rpc({path:'/certificates',method:'POST',token:a.token,body:dualBody}).status,403);
assert.equal(rpc({path:'/me',token:a.token}).data.user.role,'admin');
const mergedUser=context.userBy_('id',created.data.id);tabs.get('Users').getRange(mergedUser.row,11).setValue(adminId);
assert.equal(rpc({path:'/users/'+created.data.id,method:'PATCH',token:a.token,body:{active:true}}).status,400);
const dualSalt=crypto.randomBytes(16).toString('hex');assert.equal(rpc({path:'/users',method:'POST',token:a.token,body:{name:'Combined',identity:'5000000000',role:'admin_teacher',salt:dualSalt,verifier:derive('Ab12@x',dualSalt),passwordLength:6}}).status,200);
const combined=rpc({path:'/login',method:'POST',body:{identity:'5000000000',verifier:derive('Ab12@x',dualSalt)}});assert.equal(combined.data.user.role,'admin');assert.equal(combined.data.user.canTeach,true);
console.log('PASS: combined administrator/teacher permissions, unchanged credentials, own uploads, one report entry, permission revocation and merged-account reactivation protection.');
const selfReset=rpc({path:'/users/'+adminId+'/password',method:'POST',token:a.token,body:resetPayload});assert.equal(selfReset.status,200);assert.equal(selfReset.data.self,true);assert.equal(rpc({path:'/me',token:a.token}).status,401);
console.log('PASS: account activation, PBKDF2 login, one-time setup, password change, role restrictions, mock PDF upload, duplicate prevention, admin download/review, logout and immediate login retry without lockout.');
