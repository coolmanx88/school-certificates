'use strict';
const $=id=>document.getElementById(id),base=(window.SCHOOL_CONFIG?.apiUrl||'').replace(/\/$/,'');
let token='',user=null,records=[];
const labels={pending:'بانتظار المراجعة',approved:'معتمد',correction:'يحتاج تصحيحًا'};
function notice(text){$('notice').textContent=text;}
async function api(path,options={}){
  let body=options.body&&!(options.body instanceof FormData)?JSON.parse(options.body):{};
  if(options.body instanceof FormData){
    body={};for(const [key,value]of options.body){if(value instanceof File){body.fileBase64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(Error('تعذر قراءة الملف.'));r.readAsDataURL(value);});}else body[key]=value;}
  }
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
function logout(){forgetSession();token='';user=null;records=[];$('rows').replaceChildren();$('workspace').hidden=true;$('login').hidden=false;$('loginForm').reset();}
async function busy(form,fn){const b=form.querySelector('button');b.disabled=true;try{await fn();}catch(e){notice(e.message);}finally{b.disabled=false;}}
function show(){ $('login').hidden=true;$('workspace').hidden=false;$('welcome').textContent='مرحبًا، '+user.name;$('passwordBox').hidden=!user.mustChange;$('teacher').hidden=user.mustChange||user.role!=='teacher';$('admin').hidden=user.mustChange||user.role!=='admin';}
$('loginForm').onsubmit=e=>{e.preventDefault();busy(e.target,async()=>{const input=Object.fromEntries(new FormData(e.target));const challenge=await json('/challenge',{identity:input.identity});const verifier=await derive(input.password,challenge.salt,challenge.rounds);const result=await json('/login',{identity:input.identity,verifier});token=result.token;user=result.user;if(document.body.dataset.page==='admin'&&user.role!=='admin'){await api('/logout',{method:'POST'});logout();throw Error('هذه الصفحة مخصصة للمسؤول فقط.');}rememberSession();e.target.reset();show();notice('تم تسجيل الدخول.');if(user.role==='admin'&&!user.mustChange)await load();});};
$('logout').onclick=async()=>{try{await api('/logout',{method:'POST'});}catch{}logout();notice('تم تسجيل الخروج.');};
$('passwordForm').onsubmit=e=>{e.preventDefault();busy(e.target,async()=>{const input=Object.fromEntries(new FormData(e.target));if(input.current===input.password)throw Error('اختر كلمة مرور جديدة مختلفة.');const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');await json('/password',{current:await derive(input.current,user.salt),verifier:await derive(input.password,salt),salt});user.salt=salt;user.mustChange=false;e.target.reset();show();notice('تم تغيير كلمة المرور.');if(user.role==='admin')await load();});};
$('uploadForm').onsubmit=e=>{e.preventDefault();busy(e.target,async()=>{const data=new FormData(e.target),file=data.get('file');if(file.size>25*1024*1024)throw Error('حجم الملف يتجاوز 25 ميجابايت.');await (await api('/certificates',{method:'POST',body:data})).json();e.target.reset();notice('تم حفظ الشهادة بنجاح وإرسالها للمراجعة.');});};
async function load(){records=await (await api('/certificates')).json();render();}
function filtered(){const q=$('search').value.trim().toLowerCase(),s=$('status').value;return records.filter(r=>(!s||r.status===s)&&[r.name,r.title,r.provider,r.category,r.year].join(' ').toLowerCase().includes(q));}
function cell(tr,text,sub){const td=document.createElement('td');td.textContent=text;if(sub){const small=document.createElement('small');small.textContent=sub;td.append(small);}tr.append(td);return td;}
function render(){const list=filtered();$('count').textContent=list.length;$('hours').textContent=list.reduce((a,r)=>a+r.hours,0);$('pending').textContent=list.filter(r=>r.status==='pending').length;$('rows').replaceChildren();$('empty').hidden=!!list.length;for(const r of list){const tr=document.createElement('tr');cell(tr,r.name);cell(tr,r.title,r.provider);cell(tr,r.date);cell(tr,r.hours);cell(tr,r.category,r.year);const td=cell(tr,'');const select=document.createElement('select');select.setAttribute('aria-label','حالة '+r.title);for(const [key,label]of Object.entries(labels)){const o=new Option(label,key);select.add(o);}select.value=r.status;select.onchange=async()=>{select.disabled=true;try{await json('/certificates/'+r.id,{status:select.value},'PATCH');r.status=select.value;render();}catch(e){select.value=r.status;notice(e.message);}finally{select.disabled=false;}};td.append(select);const btn=document.createElement('button');btn.textContent='فتح PDF';btn.onclick=async()=>{btn.disabled=true;try{const response=await api('/certificates/'+r.id+'/file');const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){notice(e.message);}finally{btn.disabled=false;}};cell(tr,'').append(btn);$('rows').append(tr);}}
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
