import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=await fs.readFile(new URL('../app.js',import.meta.url),'utf8');
const storage=new Map(),sessionToken='1'.repeat(64);let valid=true;
function page(){
  const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,dataset:{},textContent:'',replaceChildren(){},reset(){}});return nodes.get(id);};
  const runner={success:null,withSuccessHandler(fn){this.success=fn;return this;},withFailureHandler(){return this;},rpc(req){
    if(req.path==='/me')this.success(valid&&req.token===sessionToken?{status:200,data:{user:{name:'Test teacher',role:'teacher',mustChange:false,salt:'test'}}}:{status:401,data:{error:'انتهت الجلسة.'}});
    else if(req.path==='/logout'){valid=false;this.success({status:200,data:{ok:true}});}
    else throw Error('Unexpected request');
  }};
  const c=vm.createContext({console,window:{SCHOOL_CONFIG:{}},document:{body:{dataset:{page:'teacher'}},getElementById:node},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},google:{script:{run:runner}},FormData,Blob,URL,TextEncoder,Uint8Array,setTimeout});
  vm.runInContext(source,c);return {c,node};
}
const initial=page();vm.runInContext(`token='${sessionToken}';rememberSession();`,initial.c);
assert.equal(storage.get('muadh-school-session-v1'),sessionToken);
const refreshed=page();await new Promise(setImmediate);
assert.equal(refreshed.node('login').hidden,true);assert.equal(refreshed.node('workspace').hidden,false);assert.equal(refreshed.node('welcome').textContent,'مرحبًا، Test teacher');
await refreshed.node('logout').onclick();assert.equal(storage.size,0);assert.equal(refreshed.node('login').hidden,false);
storage.set('muadh-school-session-v1',sessionToken);const expired=page();await new Promise(setImmediate);assert.equal(storage.size,0);assert.equal(expired.node('login').hidden,false);
assert.ok(![...storage.keys()].some(k=>k.includes('password')));
console.log('PASS: session restoration across page reload, server validation, logout cleanup and rejection of expired sessions.');
