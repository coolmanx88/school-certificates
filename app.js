'use strict';
const $=id=>document.getElementById(id),base=(window.SCHOOL_CONFIG?.apiUrl||'').replace(/\/$/,'');
let token='',user=null,records=[],accountRecords=[];
let viewMode='admin';
function canTeach(){return user?.role==='teacher'||user?.canTeach===true;}
function adminView(){return user?.role==='admin'&&viewMode==='admin';}
function teacherView(){return canTeach()&&viewMode==='teacher';}
let selectedSection='certificates',selectedKind='weekly',resourceRecords=[];
const labels={approved:'معتمد',pending:'بانتظار المراجعة'};
function notice(text){$('notice').textContent=text;}
function uploadFeedback(text,state='success',reveal=true){const status=$('uploadStatus');status.textContent=text;status.dataset.state=state;status.hidden=false;if(reveal){status.scrollIntoView({behavior:'smooth',block:'nearest'});status.focus({preventScroll:true});}}
async function api(path,options={}){
  let body=options.body&&!(options.body instanceof FormData)?JSON.parse(options.body):{};
  if(options.body instanceof FormData){
    body={};for(const [key,value]of options.body){if(value instanceof File){body.filename=value.name;body.fileBase64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(Error('تعذر قراءة الملف.'));r.readAsDataURL(value);});}else body[key]=value;}
  }
  body.viewMode=viewMode;
  const result=await new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(()=>reject(Error('تعذر الاتصال. حاول لاحقًا.'))).rpc({path,method:options.method||'GET',token,body}));
  if(!result||typeof result.status!=='number')throw Error('تعذر قراءة استجابة الخدمة. حدّث الصفحة، وتأكد من نشر آخر إصدار للتطبيق.');
  if(result.status!==200){if(result.status===401)logout();throw Error(result.data?.error||'تعذر إتمام العملية.');}
  return {json:async()=>result.data,blob:async()=>{const bytes=Uint8Array.from(atob(result.fileBase64),c=>c.charCodeAt(0));return new Blob([bytes],{type:result.mime});}};
}
async function derive(password,salt,rounds=600000){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:rounds,hash:'SHA-256'},key,256);
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}

async function json(path,data,method='POST'){return (await api(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})).json();}
const SESSION_KEY='muadh-school-session-v1';
function rememberSession(){try{sessionStorage.setItem(SESSION_KEY,token);}catch{}}
function savedSession(){try{return sessionStorage.getItem(SESSION_KEY)||'';}catch{return '';}}
function forgetSession(){try{sessionStorage.removeItem(SESSION_KEY);}catch{}}
function logout(){viewMode='admin';$('modeSwitchBox').hidden=true;$('missingUploadsExport').hidden=true;$('resourceExport').hidden=true;selectedSection='certificates';resourceRecords=[];$('resourceRows').replaceChildren();$('resourceForm').reset();$('resourceStatus').hidden=true;$('resources').hidden=true;$('sectionNav').hidden=true;if($('resetAccountDialog').open)$('resetAccountDialog').close();$('resetAccountForm').reset();$('uploadStatus').textContent='';$('uploadStatus').hidden=true;forgetSession();token='';user=null;records=[];accountRecords=[];$('accountRows').replaceChildren();$('rows').replaceChildren();$('workspace').hidden=true;$('login').hidden=false;$('loginForm').reset();}
async function busy(form,fn){const b=form.querySelector('button');b.disabled=true;try{await fn();}catch(e){notice(e.message);if(form.id==='uploadForm')uploadFeedback(e.message,'error');}finally{b.disabled=false;}}
function show(){if(user.role==='teacher')viewMode='teacher';if(user.role==='admin'&&!canTeach())viewMode='admin';$('modeSwitchBox').hidden=user.mustChange||user.role!=='admin'||!canTeach();$('modeSwitch').value=viewMode;$('missingUploadsExport').hidden=user.mustChange||!adminView();selectedSection='certificates';document.querySelectorAll('[data-section]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.section==='certificates')));$('sectionNav').hidden=user.mustChange;$('resources').hidden=true; $('login').hidden=true;$('workspace').hidden=false;$('welcome').textContent='مرحبًا، '+user.name;$('passwordBox').hidden=!user.mustChange;$('teacher').hidden=user.mustChange||!teacherView();$('admin').hidden=user.mustChange||!adminView();}
$('loginForm').onsubmit=e=>{e.preventDefault();busy(e.target,async()=>{const input=Object.fromEntries(new FormData(e.target));const challenge=await json('/challenge',{identity:input.identity});const verifier=await derive(input.password,challenge.salt,challenge.rounds);const result=await json('/login',{identity:input.identity,verifier});token=result.token;user=result.user;if(document.body.dataset.page==='admin'&&user.role!=='admin'){await api('/logout',{method:'POST'});logout();throw Error('هذه الصفحة مخصصة للمسؤول فقط.');}rememberSession();e.target.reset();show();notice('تم تسجيل الدخول.');if(user.role==='admin'&&!user.mustChange)await load();});};
$('logout').onclick=async()=>{try{await api('/logout',{method:'POST'});}catch{}logout();notice('تم تسجيل الخروج.');};
$('passwordForm').onsubmit=e=>{e.preventDefault();busy(e.target,async()=>{const input=Object.fromEntries(new FormData(e.target));if(input.current===input.password)throw Error('اختر كلمة مرور جديدة مختلفة.');const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');await json('/password',{current:await derive(input.current,user.salt),verifier:await derive(input.password,salt),salt});user.salt=salt;user.mustChange=false;e.target.reset();show();notice('تم تغيير كلمة المرور.');if(user.role==='admin')await load();});};
$('uploadForm').onsubmit=e=>{e.preventDefault();busy(e.target,async()=>{uploadFeedback('جارٍ حفظ الشهادة…','loading',false);const data=new FormData(e.target),file=data.get('file');if(file.size>25*1024*1024)throw Error('حجم الملف يتجاوز 25 ميجابايت.');await (await api('/certificates',{method:'POST',body:data})).json();e.target.reset();uploadFeedback('تم حفظ الشهادة بنجاح وإرسالها للمراجعة.');notice('تم حفظ الشهادة بنجاح وإرسالها للمراجعة.');});};
async function load(){records=(await (await api('/certificates')).json()).map(r=>({...r,status:r.status==='approved'?'approved':'pending'}));render();await loadAccounts();}
function filtered(){const q=$('search').value.trim().toLowerCase(),s=$('status').value;return records.filter(r=>(!s||r.status===s)&&[r.name,r.title,r.provider,r.category,r.year].join(' ').toLowerCase().includes(q));}
function cell(tr,text,sub){const td=document.createElement('td');td.textContent=text;if(sub){const small=document.createElement('small');small.textContent=sub;td.append(small);}tr.append(td);return td;}
function render(){const list=filtered();$('count').textContent=list.length;$('hours').textContent=list.reduce((a,r)=>a+r.hours,0);$('pending').textContent=list.filter(r=>r.status==='pending').length;$('rows').replaceChildren();$('empty').hidden=!!list.length;for(const r of list){const tr=document.createElement('tr');cell(tr,r.name);cell(tr,r.title,r.provider);cell(tr,r.date);cell(tr,r.hours);cell(tr,r.category,r.year);const td=cell(tr,'');const select=document.createElement('select');select.setAttribute('aria-label','حالة '+r.title);for(const [key,label]of Object.entries(labels)){const o=new Option(label,key);select.add(o);}select.value=r.status;select.dataset.status=r.status;select.onchange=async()=>{select.disabled=true;try{await json('/certificates/'+r.id,{status:select.value},'PATCH');r.status=select.value;render();}catch(e){select.value=r.status;notice(e.message);}finally{select.disabled=false;}};td.append(select);const btn=document.createElement('button');btn.textContent='فتح PDF';btn.onclick=async()=>{btn.disabled=true;try{const response=await api('/certificates/'+r.id+'/file');const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){notice(e.message);}finally{btn.disabled=false;}};cell(tr,'').append(btn);$('rows').append(tr);}}
$('search').oninput=render;$('status').onchange=render;
$('export').onclick=async()=>{
  const button=$('export'),list=filtered().map(r=>({...r})),filters={query:$('search').value.trim(),status:$('status').value};
  if(!list.length){notice('لا توجد نتائج لتصديرها.');return;}
  button.disabled=true;
  try{
    const ExcelJS=await SchoolExcel.loadLibrary(),workbook=SchoolExcel.createWorkbook(ExcelJS,list,filters),bytes=await workbook.xlsx.writeBuffer();
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const link=document.createElement('a');link.href=url;link.download='نتائج-بحث-الشهادات-'+new Date().toISOString().slice(0,10)+'.xlsx';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    notice('تم تصدير '+list.length+' سجلًا إلى Excel.');
  }catch(e){notice(e.message);}finally{button.disabled=false;}
};

async function restoreSession(){
  const saved=savedSession();if(!saved)return;
  if(!/^[a-f0-9]{64}$/.test(saved)){forgetSession();return;}
  token=saved;$('login').hidden=true;notice('جارٍ استعادة الجلسة…');
  try{
    user=(await (await api('/me')).json()).user;
    if(document.body.dataset.page==='admin'&&user.role!=='admin'){await api('/logout',{method:'POST'});logout();throw Error('هذه الصفحة مخصصة للمسؤول فقط.');}
    show();notice('تمت استعادة الجلسة.');if(user.role==='admin'&&!user.mustChange)await load();
  }catch(e){if(!user)$('login').hidden=false;notice(e.message);}
}
restoreSession();

async function loadAccounts(){accountRecords=await (await api('/users')).json();renderAccounts();}
function renderAccounts(){
  const query=$('accountSearch').value.trim().toLowerCase();$('accountRows').replaceChildren();
  for(const account of accountRecords.filter(a=>a.name.toLowerCase().includes(query))){
    const row=document.createElement('tr');cell(row,account.name);cell(row,account.role==='admin'?(account.canTeach?'مسؤول ومعلم':'مسؤول'):'معلم');cell(row,account.mergedInto?'تم توحيد الحساب':account.active?'فعّال':'معطّل');
    const button=document.createElement('button');button.textContent=account.active?'تعطيل':'إعادة تفعيل';button.className='secondary';button.disabled=account.self||!!account.mergedInto;
    if(account.self)button.title='لا يمكن تعطيل حسابك الحالي.';
    button.onclick=async()=>{
      if(account.active&&!confirm('تعطيل حساب '+account.name+'؟ سيتوقف دخوله، وستبقى شهاداته محفوظة.'))return;
      button.disabled=true;
      try{await json('/users/'+account.id,{active:!account.active},'PATCH');await loadAccounts();notice(account.active?'تم تعطيل الحساب.':'تمت إعادة تفعيل الحساب.');}catch(e){notice(e.message);button.disabled=false;}
    };const reset=document.createElement('button');reset.textContent='إعادة تعيين كلمة المرور';reset.className='secondary';reset.onclick=()=>openPasswordReset(account);const actions=document.createElement('div');actions.className='account-actions';actions.append(button,reset);
    if(account.role==='admin'){
      const teaching=document.createElement('button');teaching.className='secondary';teaching.textContent=account.canTeach?'إلغاء وضع المعلم':'تمكين وضع المعلم';
      teaching.onclick=async()=>{teaching.disabled=true;try{const enabled=!account.canTeach;await json('/users/'+account.id+'/teaching',{canTeach:enabled},'PATCH');if(account.self){user.canTeach=enabled;show();}await loadAccounts();notice(enabled?'تم تمكين وضع المعلم للمسؤول.':'تم إلغاء وضع المعلم.');}catch(e){notice(e.message);}finally{teaching.disabled=false;}};actions.append(teaching);
    }
    cell(row,'').append(actions);$('accountRows').append(row);
  }
}
$('accountSearch').oninput=renderAccounts;
$('refreshAccounts').onclick=async()=>{try{await loadAccounts();}catch(e){notice(e.message);}};

$('addAccountForm').onsubmit=e=>{e.preventDefault();busy(e.target,async()=>{
  const input=Object.fromEntries(new FormData(e.target));
  if(!/^[0-9]{10}$/.test(input.identity)||!input.name.trim()||input.password.length<6||input.password.length>256)throw Error('أدخل اسمًا وهوية من عشرة أرقام وكلمة مرور من 6 أحرف على الأقل.');
  const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
  const verifier=await derive(input.password,salt);
  await json('/users',{name:input.name.trim(),identity:input.identity,role:input.role,salt,verifier,passwordLength:input.password.length});
  input.password='';e.target.reset();$('accountSearch').value='';
  notice('تم إنشاء الحساب وتفعيله. يُطلب تغيير كلمة المرور المؤقتة عند أول دخول.');
  try{await loadAccounts();}catch{notice('تم إنشاء الحساب، لكن تعذر تحديث القائمة. اضغط تحديث القائمة.');}
});};

let resetTarget=null;
function openPasswordReset(account){resetTarget=account;$('resetAccountForm').reset();$('resetAccountError').textContent='';$('resetAccountName').textContent=account.name+(account.self?' — سيُسجّل خروجك بعد الحفظ.':account.active?'':' — الحساب معطّل، ولن تعيد هذه العملية تفعيله.');$('resetAccountDialog').showModal();}
$('cancelResetAccount').onclick=()=>{$('resetAccountDialog').close();$('resetAccountForm').reset();resetTarget=null;};
$('resetAccountDialog').onclose=()=>{$('resetAccountForm').reset();resetTarget=null;};
$('resetAccountForm').onsubmit=async e=>{
  e.preventDefault();const target=resetTarget;if(!target)return;
  const form=e.target,submit=form.querySelector('button[type="submit"]'),cancel=$('cancelResetAccount');submit.disabled=true;cancel.disabled=true;$('resetAccountError').textContent='';
  try{
    const input=Object.fromEntries(new FormData(form));if(input.password.length<6||input.password.length>256)throw Error('أدخل كلمة مرور مؤقتة من 6 أحرف على الأقل.');
    const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),verifier=await derive(input.password,salt);
    const result=await json('/users/'+target.id+'/password',{salt,verifier,passwordLength:input.password.length});input.password='';form.reset();$('resetAccountDialog').close();
    if(result.self){logout();notice('تم تعيين كلمة مرور مؤقتة لحسابك. سجل الدخول بها لتغييرها.');}
    else{notice('تم تعيين كلمة المرور المؤقتة وإلغاء الجلسات السابقة.'+(result.active?'':' الحساب ما زال معطّلًا.'));}
  }catch(e){if($('resetAccountDialog').open)$('resetAccountError').textContent=e.message;else notice(e.message);}finally{submit.disabled=false;cancel.disabled=false;}
};

$('resetAccountDialog').oncancel=e=>{if($('cancelResetAccount').disabled)e.preventDefault();};

const resourceLabels={weekly:'الخطط الأسبوعية',term:'الخطة الفصلية',portfolio:'ملف الإنجاز'};
function resourceFeedback(text,state){const el=$('resourceStatus');el.textContent=text;el.dataset.state=state;el.hidden=false;el.scrollIntoView({block:'nearest',behavior:'smooth'});}
async function selectSection(section){
  selectedSection=section;$('teacher').hidden=user.mustChange||!teacherView()||section!=='certificates';$('admin').hidden=user.mustChange||!adminView()||section!=='certificates';
  $('resources').hidden=user.mustChange||section==='certificates';
  document.querySelectorAll('[data-section]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.section===section)));
  if(section==='certificates')return;
  selectedKind=section==='portfolio'?'portfolio':'weekly';$('resourceForm').reset();$('resourceStatus').hidden=true;
  $('resourceTitle').textContent=section==='portfolio'?'ملف الإنجاز':'الخطط للمواد الدراسية';$('planChoices').hidden=section==='portfolio';
  $('resourceExport').hidden=!adminView();$('resourceForm').hidden=!teacherView();$('resourceAdminSearch').hidden=!adminView();$('resourceSearch').value='';
  resourceRecords=[];renderResources();try{await loadResources();}catch(e){notice(e.message);}
}
async function loadResources(){resourceRecords=await (await api('/resources')).json();renderResources();}
function renderResources(){
  $('resourceSubtitle').textContent=resourceLabels[selectedKind];$('resourceSubtitle').hidden=selectedKind==='portfolio';document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===selectedKind)));
  const list=filteredResources();
  $('resourceRows').replaceChildren();$('resourceEmpty').hidden=!!list.length;
  for(const r of list){const tr=document.createElement('tr');cell(tr,r.name);const td=cell(tr,'');const name=document.createElement('bdi');name.textContent=r.filename;td.append(name);
    const button=document.createElement('button');button.textContent='تنزيل الملف';button.onclick=async()=>{button.disabled=true;try{const response=await api('/resources/'+r.id+'/file'),url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download=r.filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){notice(e.message);}finally{button.disabled=false;}};cell(tr,'').append(button);$('resourceRows').append(tr);}
}
document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>selectSection(b.dataset.section));
document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{selectedKind=b.dataset.kind;$('resourceForm').reset();$('resourceStatus').hidden=true;renderResources();});
$('resourceSearch').oninput=renderResources;
$('refreshResources').onclick=async()=>{try{await loadResources();}catch(e){notice(e.message);}};
$('resourceForm').onsubmit=async e=>{
  e.preventDefault();const form=e.target,button=form.querySelector('button');button.disabled=true;
  try{const data=new FormData(form),file=data.get('file');if(!file.size||file.size>25*1024*1024)throw Error('اختر ملفًا غير فارغ لا يتجاوز 25 ميجابايت.');data.set('kind',selectedKind);resourceFeedback('جارٍ رفع الملف…','loading');
    const result=await (await api('/resources',{method:'POST',body:data})).json();form.reset();resourceFeedback('تم رفع الملف بنجاح: '+result.filename,'success');
    try{await loadResources();}catch{notice('تم الحفظ. تعذر تحديث القائمة؛ اضغط تحديث الملفات.');}
  }catch(e){resourceFeedback(e.message,'error');}finally{button.disabled=false;}
};

function filteredResources(){const q=$('resourceSearch').value.trim().toLowerCase();return resourceRecords.filter(r=>r.kind===selectedKind&&[r.name,r.filename].join(' ').toLowerCase().includes(q));}
async function downloadReport(workbook,filename){
  const bytes=await workbook.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const link=document.createElement('a');link.href=url;link.download=filename+'.xlsx';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
$('resourceExport').onclick=async()=>{
  const button=$('resourceExport'),list=filteredResources().map(r=>({...r})),title=resourceLabels[selectedKind],query=$('resourceSearch').value.trim();
  if(!list.length){notice('لا توجد نتائج لتصديرها.');return;}
  button.disabled=true;
  try{const ExcelJS=await SchoolExcel.loadLibrary(),workbook=SchoolExcel.createReportWorkbook(ExcelJS,{title:'ملفات '+title,headers:['المعلم','القسم','اسم الملف'],rows:list.map(r=>[r.name,resourceLabels[r.kind],r.filename]),widths:[32,30,65],note:'عدد الملفات: '+list.length+' | البحث: '+(query||'جميع الملفات')});await downloadReport(workbook,title+'-'+new Date().toISOString().slice(0,10));notice('تم تصدير '+list.length+' ملفًا إلى Excel.');}catch(e){notice(e.message);}finally{button.disabled=false;}
};
$('missingUploadsExport').onclick=async()=>{
  const button=$('missingUploadsExport');button.disabled=true;
  try{const list=await (await api('/reports/missing-uploads')).json(),ExcelJS=await SchoolExcel.loadLibrary();
    const workbook=SchoolExcel.createReportWorkbook(ExcelJS,{title:'المعلمون الذين لم يستكملوا الرفع',headers:['اسم المعلم','الأقسام التي لم يرفع فيها'],rows:list.map(r=>[r.name,r.missing.join('، ')]),widths:[36,90],note:'المعلمون الفعّالون فقط. يُحتسب رفع خطة أسبوعية أو فصلية ضمن قسم الخطط. عدد المعلمين: '+list.length});
    await downloadReport(workbook,'تقرير-عدم-الرفع-'+new Date().toISOString().slice(0,10));notice(list.length?'تم تصدير تقرير عدم الرفع لعدد '+list.length+' معلمًا.':'جميع المعلمين الفعّالين رفعوا في الأقسام الثلاثة. تم تصدير تقرير خالٍ من المتأخرين.');
  }catch(e){notice(e.message);}finally{button.disabled=false;}
};

$('modeSwitch').onchange=async()=>{
  if(user?.role!=='admin'||!canTeach())return;
  viewMode=$('modeSwitch').value==='teacher'?'teacher':'admin';resourceRecords=[];$('resourceRows').replaceChildren();$('resourceForm').reset();$('resourceStatus').hidden=true;$('uploadStatus').hidden=true;
  show();notice(viewMode==='teacher'?'وضع المعلم: تُحفظ الملفات باسمك.':'وضع المسؤول: مراجعة الملفات وإدارة الحسابات.');
  if(adminView()){try{await load();}catch(e){notice(e.message);}}
};
