const SCHOOL = {
  spreadsheet: '1MwFf-aMyI8SLN6S8EqNx76G6_Prr4QuRjhpR0Q0GcjU',
  folder: '1Gt9CVz3ZPDkEeekgi0tb0NdxSTRqLx9Z',
  origin: 'https://coolmanx88.github.io',
  rounds: 600000,
  maxBytes: 25 * 1024 * 1024
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('بوابة الشهادات')
    .addItem('تهيئة المنظومة', 'initialize_')
    .addItem('تفعيل الحسابات المكتملة', 'activateAccountsFromEditor_')
    .addItem('إعادة تعيين كلمات المرور المحددة', 'resetAccountsFromEditor_').addToUi();
}
function initialize_() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('SECRET')) p.setProperty('SECRET', random_());
  const ss = SpreadsheetApp.openById(SCHOOL.spreadsheet);
  const headers = {
    Users: ['id','name','identityKey','salt','passwordDigest','role','mustChange','version'],
    Certificates: ['id','userId','name','title','provider','date','hours','category','year','driveId','digest','status','created'],
    Audit: ['time','userId','action','recordId']
  };
  Object.keys(headers).forEach(name => {
    let s = ss.getSheetByName(name);
    if (!s) { s = ss.insertSheet(name); s.appendRow(headers[name]); s.setFrozenRows(1); }
    s.setRightToLeft(true);
  });
  SpreadsheetApp.getUi().alert('تمت التهيئة. املأ الأسماء والهويات ثم اختر تفعيل الحسابات المكتملة.');
}
function doGet(e) {
  const t = HtmlService.createTemplateFromFile('Portal');
  t.page = e && e.parameter && e.parameter.page === 'admin' ? 'admin' : 'teacher';
  return t.evaluate().setTitle('مدرسة الرويشدي — سجل التدريب')
    .addMetaTag('viewport','width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function random_() { return Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,''); }
function hex_(bytes) { return bytes.map(b => ('0'+((b+256)%256).toString(16)).slice(-2)).join(''); }
function hash_(text) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text)); }
function key_(text) {
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret) throw Error('المنظومة غير مهيأة.');
  return hex_(Utilities.computeHmacSha256Signature(String(text),secret));
}
function equal_(a,b) { if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0; }
function sheet_(name) { const s=SpreadsheetApp.openById(SCHOOL.spreadsheet).getSheetByName(name);if(!s)throw Error('المنظومة غير مهيأة.');return s; }
function rows_(name) { const s=sheet_(name);return s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,s.getLastColumn()).getValues():[]; }
function userBy_(field,value) { const rows=rows_('Users'),index={id:0,identity:2}[field];const n=rows.findIndex(r=>r[index]===value);return n<0?null:{row:n+2,values:rows[n]}; }
function text_(value,max) { if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('بيانات غير صالحة.');return value.trim(); }
function safe_(value) { return typeof value==='string' && /^\s*[=+@-]/.test(value)?"'"+value:value; }
function audit_(uid,action,id) { try{sheet_('Audit').appendRow([new Date().toISOString(),uid,action,id||'']);}catch(e){console.error('Audit write failed');} }
function session_(token) {
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw Error('SESSION');
  const value=CacheService.getScriptCache().get('session:'+hash_(token));if(!value)throw Error('SESSION');
  const session=JSON.parse(value),u=userBy_('id',session.uid);
  if(!u||u.values[7]!==session.version)throw Error('SESSION');return u;
}
function loginRate_(identity,increment) {
  const p=PropertiesService.getScriptProperties(),k='attempt:'+(userBy_('identity',key_(identity))?key_(identity):'unknown'),now=Date.now();
  let data=JSON.parse(p.getProperty(k)||'null');if(!data||data.until<now)data={count:0,until:now+15*60000};
  if(data.count>=10)throw Error('محاولات كثيرة. حاول بعد 15 دقيقة.');
  if(increment){data.count++;p.setProperty(k,JSON.stringify(data));}
}
function requireAdmin_(u) { if(u.values[5]!=='admin')throw Error('FORBIDDEN'); }
function rpc(request) {
  const lock=LockService.getScriptLock();
  try {
    if(!request||typeof request.path!=='string')throw Error('طلب غير صالح.');
    lock.waitLock(10000);
    const path=request.path,method=request.method||'GET',body=request.body||{};
    if(path==='/challenge'&&method==='POST') {
      const identity=text_(body.identity,30);if(!/^\d{10}$/.test(identity))throw Error('رقم الهوية يتكون من عشرة أرقام.');
      loginRate_(identity,true);const u=userBy_('identity',key_(identity));
      return ok_({salt:u?u.values[3]:key_('fake:'+identity).slice(0,32),rounds:SCHOOL.rounds});
    }
    if(path==='/login'&&method==='POST') {
      const identity=text_(body.identity,30);loginRate_(identity,true);
      const u=userBy_('identity',key_(identity));
      if(!u||!/^[a-f0-9]{64}$/.test(body.verifier||'')||!equal_(u.values[4],key_(body.verifier)))throw Error('رقم الهوية أو كلمة المرور غير صحيحة.');
      const token=random_();CacheService.getScriptCache().put('session:'+hash_(token),JSON.stringify({uid:u.values[0],version:u.values[7]}),7200);
      PropertiesService.getScriptProperties().deleteProperty('attempt:'+key_(identity));
      return ok_({token,user:{name:u.values[1],role:u.values[5],mustChange:!!u.values[6],salt:u.values[3]}});
    }
    if(path.startsWith('/setup/'))return setupRequest_(request);
    const u=session_(request.token),uid=u.values[0];
    if(path==='/logout'&&method==='POST'){CacheService.getScriptCache().remove('session:'+hash_(request.token));return ok_({ok:true});}
    if(path==='/password'&&method==='POST') {
      if(!equal_(u.values[4],key_(body.current||''))||!/^[a-f0-9]{64}$/.test(body.verifier||'')||!/^[a-f0-9]{32}$/.test(body.salt||'')||body.verifier===body.current)throw Error('تعذر تغيير كلمة المرور.');
      u.values[3]=body.salt;u.values[4]=key_(body.verifier);u.values[6]=false;u.values[7]++;
      sheet_('Users').getRange(u.row,1,1,8).setValues([u.values]);
      CacheService.getScriptCache().put('session:'+hash_(request.token),JSON.stringify({uid,version:u.values[7]}),7200);
      audit_(uid,'password-change');return ok_({ok:true});
    }
    if(u.values[6])throw Error('غيّر كلمة المرور المؤقتة أولًا.');
    if(path==='/certificates'&&method==='POST') {
      if(u.values[5]!=='teacher')throw Error('FORBIDDEN');
      const title=text_(body.title,200),provider=text_(body.provider,200),category=text_(body.category,200),year=text_(body.year,30),date=text_(body.date,10),hours=Number(body.hours);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||hours<0.5||hours>2000||!Number.isFinite(hours))throw Error('تحقق من التاريخ والساعات.');
      if(typeof body.fileBase64!=='string'||body.fileBase64.length>Math.ceil(SCHOOL.maxBytes/3)*4)throw Error('الملف يتجاوز الحد المسموح.');
      const bytes=Utilities.base64Decode(body.fileBase64);
      if(bytes.length>SCHOOL.maxBytes||bytes.length<5||String.fromCharCode.apply(null,bytes.slice(0,5))!=='%PDF-')throw Error('أرفق ملف PDF صالحًا لا يتجاوز 25 ميجابايت.');
      const digest=hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes));
      if(rows_('Certificates').some(r=>r[1]===uid&&r[10]===digest))throw Error('سبق رفع هذه الشهادة.');
      const id=random_(),file=DriveApp.getFolderById(SCHOOL.folder).createFile(Utilities.newBlob(bytes,'application/pdf',id+'.pdf'));
      try{sheet_('Certificates').appendRow([id,uid,safe_(u.values[1]),safe_(title),safe_(provider),date,hours,safe_(category),safe_(year),file.getId(),digest,'pending',new Date().toISOString()]);}
      catch(e){file.setTrashed(true);throw e;}
      audit_(uid,'upload',id);return ok_({ok:true});
    }
    requireAdmin_(u);
    if(path==='/certificates'&&method==='GET')return ok_(rows_('Certificates').reverse().map(r=>({id:r[0],name:r[2],title:r[3],provider:r[4],date:r[5],hours:r[6],category:r[7],year:r[8],status:r[11]})));
    const match=path.match(/^\/certificates\/([a-f0-9]{64})(\/file)?$/);
    if(match){const records=rows_('Certificates'),i=records.findIndex(r=>r[0]===match[1]);if(i<0)throw Error('السجل غير موجود.');
      if(match[2]&&method==='GET'){const file=DriveApp.getFileById(records[i][9]);return {status:200,fileBase64:Utilities.base64Encode(file.getBlob().getBytes()),mime:'application/pdf'};}
      if(!match[2]&&method==='PATCH'&&['pending','approved','correction'].includes(body.status)){sheet_('Certificates').getRange(i+2,12).setValue(body.status);audit_(uid,'status:'+body.status,match[1]);return ok_({ok:true});}
    }
    throw Error('طلب غير مدعوم.');
  }catch(e){const message=String(e.message);return {status:message==='SESSION'?401:message==='FORBIDDEN'?403:400,data:{error:message==='SESSION'?'انتهت الجلسة. سجل الدخول مجددًا.':message==='FORBIDDEN'?'هذه الصلاحية للمسؤول فقط.':message}};}
  finally{if(lock.hasLock())lock.releaseLock();}
}
function ok_(data){return {status:200,data};}
function activateAccountsFromEditor_(){openSetup_(false);}
function resetAccountsFromEditor_(){openSetup_(true);}
function openSetup_(reset){
  if(!PropertiesService.getScriptProperties().getProperty('SECRET'))throw Error('شغّل initialize_ أولًا.');
  const token=random_();CacheService.getScriptCache().put('setup:'+hash_(token),JSON.stringify({reset}),600);
  const t=HtmlService.createTemplateFromFile('Setup');t.token=token;
  SpreadsheetApp.getUi().showModalDialog(t.evaluate().setWidth(550).setHeight(380),reset?'إعادة تعيين الحسابات المحددة':'تفعيل الحسابات');
}
function setupRequest_(request){
  const token=request.setupToken;if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw Error('طلب التفعيل غير صالح.');
  const cached=CacheService.getScriptCache().get('setup:'+hash_(token));if(!cached)throw Error('انتهت صلاحية التفعيل. افتح نافذة جديدة من القائمة.');
  const mode=JSON.parse(cached),input=sheet_('الحسابات');
  if(request.path==='/setup/pending'){
    const entries=[],source=input.getRange(6,1,Math.max(1,input.getLastRow()-5),5).getDisplayValues(),seen={};
    source.forEach((r,i)=>{const name=r[1].trim(),identity=r[2].trim(),password=r[3],role={'معلم':'teacher','مسؤول':'admin'}[r[4].trim()];
      if(!name&&!identity)return;const exists=userBy_('identity',key_(identity));
      if(exists&&!mode.reset)return;if(mode.reset&&!password)return;
      if(!name||!/^\d{10}$/.test(identity)||password.length<12||password.length>256||!role)throw Error('راجع بيانات الصف '+(i+6));
      if(seen[identity])throw Error('هوية مكررة في الملف.');seen[identity]=true;
      if(mode.reset&&(!exists||exists.values[5]!==role))throw Error('إعادة التعيين تخص الحسابات الموجودة بنفس الصلاحية.');
      entries.push({row:i+6,name,identity,password,role,salt:random_().slice(0,32),snapshot:hash_(JSON.stringify(r))});
    });
    if(!entries.length)throw Error('لا توجد حسابات مكتملة جديدة.');
    if(!rows_('Users').some(r=>r[5]==='admin')&&!entries.some(r=>r.role==='admin'))throw Error('أضف حساب المسؤول أولًا.');
    CacheService.getScriptCache().put('pending:'+hash_(token),JSON.stringify(entries.map(e=>({row:e.row,salt:e.salt,snapshot:e.snapshot}))),600);
    return ok_({entries,rounds:SCHOOL.rounds});
  }
  if(request.path==='/setup/commit'){
    const pending=JSON.parse(CacheService.getScriptCache().get('pending:'+hash_(token))||'null'),entries=request.body.entries;
    if(!pending||!Array.isArray(entries)||pending.length!==entries.length)throw Error('طلب التفعيل غير صالح.');
    const candidates=entries.map((e,i)=>{
      const p=pending[i],r=input.getRange(p.row,1,1,5).getDisplayValues()[0];
      if(e.row!==p.row||e.salt!==p.salt||hash_(JSON.stringify(r))!==p.snapshot||!/^[a-f0-9]{64}$/.test(e.verifier||''))throw Error('تغيرت البيانات أثناء التفعيل. افتح النافذة مجددًا.');
      const existing=userBy_('identity',key_(r[2].trim()));
      if((!mode.reset&&existing)||(mode.reset&&!existing))throw Error('تغيرت حالة الحساب.');
      return {row:p.row,existing,values:[existing?existing.values[0]:random_(),safe_(r[1].trim()),key_(r[2].trim()),p.salt,key_(e.verifier),{'معلم':'teacher','مسؤول':'admin'}[r[4].trim()],true,existing?existing.values[7]+1:1]};
    });
    candidates.forEach(c=>{const s=sheet_('Users');if(c.existing)s.getRange(c.existing.row,1,1,8).setValues([c.values]);else s.appendRow(c.values);input.getRange(c.row,4).clearContent();});
    CacheService.getScriptCache().remove('setup:'+hash_(token));CacheService.getScriptCache().remove('pending:'+hash_(token));
    audit_('editor',mode.reset?'account-reset':'account-import',String(candidates.length));return ok_({count:candidates.length});
  }
  throw Error('طلب غير مدعوم.');
}
