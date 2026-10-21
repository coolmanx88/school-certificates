(function(root){
  'use strict';
  const statusLabels={approved:'معتمد',pending:'بانتظار المراجعة'};
  function certificateName(title){return (String(title||'').replace(/[\x00-\x1f\x7f/\\]/g,' ').trim().replace(/\.pdf$/i,'').trim().slice(0,180)||'شهادة')+'.pdf';}
  function createWorkbook(ExcelJS,records,filters={}){
    const workbook=new ExcelJS.Workbook();
    workbook.creator='مدرسة معاذ بن جبل';workbook.created=new Date();
    const sheet=workbook.addWorksheet('نتائج البحث',{views:[{rightToLeft:true,state:'frozen',ySplit:3,showGridLines:false}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:3'}});
    sheet.columns=[{width:27},{width:43},{width:16},{width:12},{width:32},{width:24},{width:40}];
    sheet.mergeCells('A1:G1');sheet.getCell('A1').value='مدرسة معاذ بن جبل — نتائج البحث في الشهادات';sheet.getRow(1).height=32;
    sheet.getCell('A1').font={name:'Arial',size:16,bold:true,color:{argb:'FF15362F'}};
    sheet.getCell('A1').alignment={horizontal:'right',vertical:'middle',readingOrder:'rtl'};
    sheet.mergeCells('A2:G2');
    sheet.getCell('A2').value='عدد النتائج: '+records.length+' | البحث: '+(filters.query||'جميع السجلات')+' | الحالة: '+(statusLabels[filters.status]||'جميع الحالات');
    sheet.getCell('A2').font={name:'Arial',size:11};sheet.getCell('A2').alignment={horizontal:'right',vertical:'middle',wrapText:true,readingOrder:'rtl'};sheet.getRow(2).height=32;
    sheet.getRow(3).values=['المعلم','الدورة / الجهة','التاريخ','الساعات','المجال / السنة','الحالة','اسم الشهادة'];
    sheet.getRow(3).height=28;
    sheet.getRow(3).eachCell(cell=>{cell.font={name:'Arial',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF15362F'}};cell.alignment={horizontal:'center',vertical:'middle',readingOrder:'rtl'};});
    for(const record of records){
      let date=String(record.date||'');
      if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date)))date=new Date(date+'T00:00:00Z');
      const row=sheet.addRow([String(record.name||''),String(record.title||'')+'\n'+String(record.provider||''),date,Number(record.hours)||0,String(record.category||'')+'\n'+String(record.year||''),statusLabels[record.status]||statusLabels.pending,certificateName(record.title)]);
      row.height=44;
      row.eachCell(cell=>{cell.font={name:'Arial',size:11};cell.alignment={horizontal:'right',vertical:'middle',wrapText:true,readingOrder:'rtl'};cell.border={bottom:{style:'thin',color:{argb:'FFE1EAE5'}}};if(row.number%2===0)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF2F7F4'}};});
      row.getCell(3).numFmt='yyyy-mm-dd';row.getCell(3).alignment={horizontal:'center',vertical:'middle'};
      row.getCell(4).numFmt='0.##';row.getCell(4).alignment={horizontal:'center',vertical:'middle'};
    }
    sheet.autoFilter={from:'A3',to:'G'+Math.max(3,sheet.rowCount)};
    return workbook;
  }
  function createReportWorkbook(ExcelJS,{title,headers,rows,widths,note=''}){
    const workbook=new ExcelJS.Workbook();workbook.creator='مدرسة معاذ بن جبل';workbook.created=new Date();
    const sheet=workbook.addWorksheet('التقرير',{views:[{rightToLeft:true,state:'frozen',ySplit:3,showGridLines:false}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:3'}});
    sheet.columns=headers.map((_,i)=>({width:widths[i]}));
    sheet.mergeCells(1,1,1,headers.length);sheet.getCell(1,1).value='مدرسة معاذ بن جبل — '+title;
    sheet.getCell(1,1).font={name:'Arial',size:16,bold:true,color:{argb:'FF15362F'}};sheet.getCell(1,1).alignment={horizontal:'right',vertical:'middle',readingOrder:'rtl'};sheet.getRow(1).height=34;
    sheet.mergeCells(2,1,2,headers.length);sheet.getCell(2,1).value=note;sheet.getCell(2,1).font={name:'Arial',size:11};sheet.getCell(2,1).alignment={horizontal:'right',vertical:'middle',wrapText:true,readingOrder:'rtl'};sheet.getRow(2).height=38;
    sheet.getRow(3).values=headers;sheet.getRow(3).height=28;
    sheet.getRow(3).eachCell(cell=>{cell.font={name:'Arial',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF15362F'}};cell.alignment={horizontal:'right',vertical:'middle',readingOrder:'rtl'};});
    for(const values of rows){const row=sheet.addRow(values.map(v=>String(v??'')));row.height=46;row.eachCell(cell=>{cell.font={name:'Arial',size:11};cell.alignment={horizontal:'right',vertical:'middle',wrapText:true,readingOrder:'rtl'};cell.border={bottom:{style:'thin',color:{argb:'FFE1EAE5'}}};if(row.number%2===0)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF2F7F4'}};});}
    sheet.autoFilter={from:{row:3,column:1},to:{row:Math.max(3,sheet.rowCount),column:headers.length}};return workbook;
  }
  let loading;
  function loadLibrary(){
    if(root.ExcelJS)return Promise.resolve(root.ExcelJS);
    if(!loading)loading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';script.crossOrigin='anonymous';
      script.integrity='sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz';
      const timeout=setTimeout(()=>{loading=null;script.remove();reject(Error('تعذر تحميل أداة Excel. تحقق من الاتصال وأعد المحاولة.'));},20000);
      script.onload=()=>{clearTimeout(timeout);if(root.ExcelJS)resolve(root.ExcelJS);else{loading=null;reject(Error('تعذر تشغيل أداة Excel.'));}};
      script.onerror=()=>{clearTimeout(timeout);loading=null;script.remove();reject(Error('تعذر تحميل أداة Excel. تحقق من الاتصال وأعد المحاولة.'));};
      document.head.append(script);
    });return loading;
  }
  root.SchoolExcel={createWorkbook,createReportWorkbook,certificateName,loadLibrary};
})(globalThis);
