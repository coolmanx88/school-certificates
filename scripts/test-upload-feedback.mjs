import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=await fs.readFile(new URL('../app.js',import.meta.url),'utf8');
function fixture(){
  let resets=0,reply;
  const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',hidden:true,textContent:'',dataset:{},disabled:false,replaceChildren(){},reset(){},scrollIntoView(){this.scrolled=true;},focus(){this.focused=true;}});return nodes.get(id);};
  const button={disabled:false},form=node('uploadForm');form.querySelector=()=>button;form.reset=()=>resets++;
  class MockFile{size=100;}
  class MockFormData{constructor(){this.file=new MockFile();}get(key){return key==='file'?this.file:'';}*[Symbol.iterator](){yield ['title','Test'];yield ['file',this.file];}}
  class Reader{readAsDataURL(){this.result='data:application/pdf;base64,JVBERi0xLjQ=';this.onload();}}
  const runner={withSuccessHandler(fn){this.success=fn;return this;},withFailureHandler(){return this;},rpc(request){assert.equal(request.path,'/certificates');reply=this.success;}};
  const c=vm.createContext({console,window:{SCHOOL_CONFIG:{}},document:{body:{dataset:{page:'teacher'}},getElementById:node},FormData:MockFormData,File:MockFile,FileReader:Reader,google:{script:{run:runner}},sessionStorage:{getItem:()=>null},URL,Blob,TextEncoder,Uint8Array,setTimeout});
  vm.runInContext(code,c);return {node,button,form,get resets(){return resets;},reply:r=>reply(r)};
}
const success=fixture();success.form.onsubmit({preventDefault(){},target:success.form});await new Promise(setImmediate);
assert.equal(success.node('uploadStatus').dataset.state,'loading');assert.equal(success.button.disabled,true);assert.equal(success.resets,0);
success.reply({status:200,data:{ok:true}});await new Promise(setImmediate);
assert.equal(success.resets,1);assert.equal(success.node('uploadStatus').hidden,false);assert.equal(success.node('uploadStatus').dataset.state,'success');assert.match(success.node('uploadStatus').textContent,/تم حفظ الشهادة بنجاح/);assert.equal(success.node('uploadStatus').scrolled,true);assert.equal(success.node('uploadStatus').focused,true);assert.equal(success.button.disabled,false);
const failure=fixture();failure.form.onsubmit({preventDefault(){},target:failure.form});await new Promise(setImmediate);failure.reply({status:400,data:{error:'تعذر الحفظ'}});await new Promise(setImmediate);
assert.equal(failure.resets,0);assert.equal(failure.node('uploadStatus').dataset.state,'error');assert.equal(failure.node('uploadStatus').textContent,'تعذر الحفظ');assert.equal(failure.button.disabled,false);
console.log('PASS: visible pending/success/error messages, no reset before confirmation, preserved fields on failure and scrolling/focus after success.');
