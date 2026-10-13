'use strict';
const frame=document.getElementById('portal'),message=document.getElementById('message');
if(window.self!==window.top){document.body.replaceChildren();throw Error('Embedding the launcher is not permitted');}
const url=window.SCHOOL_CONFIG?.appsScriptUrl||'';
if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)){
  message.textContent='البوابة قيد التفعيل. سيُتاح الدخول بعد نشر خدمة Google وربطها بالموقع.';
}else{
  frame.src=url+'?page='+document.body.dataset.page;
  window.addEventListener('message',e=>{
    if(!/^https:\/\/[a-z0-9.-]+\.googleusercontent\.com$/.test(e.origin)||e.data?.type!=='school-embed-ready'||typeof e.data.nonce!=='string'||!e.source)return;
    e.source.postMessage({type:'school-embed-ok',nonce:e.data.nonce},e.origin);
    message.hidden=true;frame.hidden=false;
  });
  frame.hidden=false;
  setTimeout(()=>{if(!message.hidden)message.textContent='لم يكتمل تحميل البوابة. تأكد من رابط النشر وصلاحية الوصول إلى تطبيق Google.';},20000);
}
