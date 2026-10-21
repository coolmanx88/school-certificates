import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const packagePath=process.env.EXCELJS_TEST_PATH||'exceljs';
const ExcelJS=require(packagePath);
const elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false});return elements.get(id);};
element('search').value='التدريس';element('status').value='pending';
const c=vm.createContext({console,Date,Number,String,RegExp,Error,globalThis:null,document:{querySelectorAll:()=>[],getElementById:element,createElement:()=>({}),documentElement:{appendChild(){},removeChild(){}}},window:{SCHOOL_CONFIG:{}},URL,Blob,FormData,TextEncoder,Uint8Array});
c.globalThis=c;c.SCHOOL_CONFIG={};c.window=c;c.setTimeout=setTimeout;c.clearTimeout=clearTimeout;c.ArrayBuffer=ArrayBuffer;c.Promise=Promise;c.self=c;
vm.runInContext(await fs.readFile(require.resolve(packagePath+'/dist/exceljs.min.js'),'utf8'),c);
vm.runInContext(await fs.readFile(new URL('../export-xlsx.js',import.meta.url),'utf8'),c);
vm.runInContext(await fs.readFile(new URL('../app.js',import.meta.url),'utf8'),c);
vm.runInContext(`records=[
 {id:'a',name:'معلم أول',title:'التدريس الاحترافي',provider:'جهة التدريب',date:'2026-01-01',hours:20,category:'التدريس والتقويم',year:'1448-1449',status:'pending'},
 {id:'b',name:'معلم ثان',title:'التدريس الحديث',provider:'جهة أخرى',date:'2026-02-02',hours:5,category:'التدريس',year:'1448-1449',status:'approved'},
 {id:'c',name:'معلم ثالث',title:'التقنية',provider:'جهة ثالثة',date:'2026-03-03',hours:3,category:'التقنية',year:'1448-1449',status:'pending'}
];`,c);
const list=vm.runInContext('filtered()',c);assert.equal(list.length,1);
const w=c.SchoolExcel.createWorkbook(c.ExcelJS,list,{query:'التدريس',status:'pending'});
const bytes=await w.xlsx.writeBuffer();assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(Buffer.from(bytes));
const sheet=reopened.getWorksheet('نتائج البحث');
assert.equal(sheet.views[0].rightToLeft,true);assert.equal(sheet.columnCount,7);assert.equal(sheet.rowCount,4);
assert.equal(sheet.getCell('A4').value,'معلم أول');assert.equal(sheet.getCell('B4').value,'التدريس الاحترافي\nجهة التدريب');
assert.ok(sheet.getCell('C4').value instanceof Date);assert.equal(sheet.getCell('D4').value,20);
assert.equal(sheet.getCell('E4').value,'التدريس والتقويم\n1448-1449');assert.equal(sheet.getCell('F4').value,'بانتظار المراجعة');assert.equal(sheet.getCell('G4').value,'التدريس الاحترافي.pdf');
assert.equal(c.SchoolExcel.certificateName('A/B.pdf'),'A B.pdf');
assert.equal(c.SchoolExcel.createWorkbook(c.ExcelJS,vm.runInContext('[]',c)).getWorksheet('نتائج البحث').rowCount,3);
console.log('PASS: search and status filters, genuine XLSX round-trip, RTL, seven columns, typed date/hours, combined display fields and certificate title.');

for(const rowData of [[],[['أحمد','=اسم.pdf'],['خالد','الخطط، ملف الإنجاز']]]){
 const w=c.SchoolExcel.createReportWorkbook(ExcelJS,{title:'تقرير',headers:['الاسم','الأقسام'],rows:rowData,widths:[36,90],note:'ملاحظة'});
 const bytes=await w.xlsx.writeBuffer(),saved=new ExcelJS.Workbook();await saved.xlsx.load(bytes);const sheet=saved.worksheets[0];assert.equal(sheet.views[0].rightToLeft,true);assert.equal(sheet.getCell('A3').value,'الاسم');assert.equal(sheet.getCell('B3').value,'الأقسام');assert.equal(sheet.rowCount,3+rowData.length);
 if(rowData.length){assert.equal(sheet.getCell('B4').value,'=اسم.pdf');assert.equal(sheet.getCell('B4').type,ExcelJS.ValueType.String);}
}
console.log('PASS: missing and resource XLSX reports, empty report, RTL, requested column order and formula-like filenames kept as text.');
