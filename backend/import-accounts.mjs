import ExcelJS from 'exceljs';
import { db, identityKey, hash } from './db.mjs';

export function importRows(rows) {
  const accounts = [], seen = new Set();
  for (const row of rows) {
    const [, rawName, rawIdentity, rawPassword, rawRole] = row;
    const name = String(rawName || '').trim(), identity = String(rawIdentity || '').trim();
    if (!name && !identity) continue;
    const password = String(rawPassword || ''), role = {'معلم':'teacher','مسؤول':'admin'}[String(rawRole || '').trim()];
    if (!name || !/^\d{10}$/.test(identity) || password.length < 12 || password.length > 256 || !role)
      throw Error('بيانات غير مكتملة أو غير صالحة. راجع الاسم والهوية وكلمة المرور والصلاحية.');
    const key = identityKey(identity);
    if (seen.has(key) || db.prepare('SELECT id FROM users WHERE identity=?').get(key))
      throw Error('يوجد رقم هوية مكرر أو حساب موجود مسبقًا. لم تُستورد أي حسابات.');
    seen.add(key); accounts.push({ name, key, password: hash(password), role });
  }
  if (!accounts.length) throw Error('لا توجد أسماء وهويات مكتملة للاستيراد.');
  if (!db.prepare("SELECT id FROM users WHERE role='admin'").get() && !accounts.some(a=>a.role==='admin'))
    throw Error('يلزم حساب مسؤول واحد على الأقل في أول استيراد.');
  db.exec('BEGIN IMMEDIATE');
  try {
    const insert=db.prepare('INSERT INTO users(name,identity,password,role) VALUES(?,?,?,?)');
    for (const a of accounts) insert.run(a.name,a.key,a.password,a.role);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return accounts.length;
}

if (process.argv[2]) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(process.argv[2]);
  const sheet = workbook.getWorksheet('الحسابات');
  if (!sheet) throw Error('ورقة الحسابات غير موجودة. استخدم قالب المدرسة.');
  const expected=['التسلسل','الاسم الكامل','رقم الهوية','كلمة المرور المؤقتة','الصلاحية'];
  if (expected.some((name,i)=>sheet.getRow(5).getCell(i+1).text!==name)) throw Error('عناوين القالب تغيرت.');
  const rows=[];
  for(let r=6;r<=sheet.rowCount;r++) rows.push(Array.from({length:5},(_,i)=>sheet.getRow(r).getCell(i+1).text));
  console.log('تم استيراد '+importRows(rows)+' حسابًا. يلزم تغيير كلمة المرور عند أول دخول.');
}
