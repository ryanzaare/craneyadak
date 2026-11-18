#!/usr/bin/env node
// scripts/check-backlog-register.mjs
// ---------------------------------------------------------------------------
// کارهای باز فقط در «فهرست یگانه‌ی کارهای باز» بالای docs/backlog.md.
//
// ⚠️ چرا (۲۸ آبان ۱۴۰۵): کارفرما پرسید «چرا همیشه کارها را فراموش می‌کنی؟» — جستجوی کد فنی را مثال زد. کار فراموش
// نشده بود؛ در خط ۳۳۸ یک فایل ۱۴۶۸ خطی، زیر برچسب «بلاک»، بی تاریخ بازبینی مانده بود. کارهای باز در ده‌ها بخش
// تاریخ‌دار پخش بودند و چند ⏳ از کارهای انجام‌شده هنوز «باز» نشان می‌داد. وقتی جای کار باز «هر جا» باشد، جایش
// «هیچ جا» است.
//
// قواعد (هر کدام = خطای build):
//   ۱) ⏳ یا ⏸ بیرون از جدول فهرست یگانه.
//   ۲) ردیف ⏸ (بلاک) بی «بازبینی:» با تاریخ — بلاکِ بی‌تاریخ همان فراموشی است. استثنا: ردیفی که «کارفرما» صریحاً
//      منتظر تصمیم اوست و تاریخ ندارد هم خطاست؛ تاریخ بگذارید.
//      ⚠️ فعلاً فقط هشدار برای ⏸های قدیمی بی‌تاریخ؛ ردیف تازه با «بازبینی:» نوشته شود.
//   ۳) شماره‌ی تکراری (O#).
// آزمون روی ورودی خراب: `--self-test`.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';

const HEAD = '## 📋 فهرست یگانه‌ی کارهای باز';

export function checkRegister(md) {
  const errs = [];
  const warns = [];
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.startsWith(HEAD));
  if (start < 0) return { errs: ['بخش «فهرست یگانه‌ی کارهای باز» نیست'], warns };
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  const ids = new Map();
  lines.forEach((l, i) => {
    const inReg = i > start && i < end;
    if (/[⏳⏸]/.test(l) && !inReg) errs.push(`خط ${i + 1}: ⏳/⏸ بیرون از فهرست یگانه — ردیف بسازید و اینجا «(→ O#)» بنویسید`);
    if (inReg && /^\| O\d+ /.test(l)) {
      const id = l.match(/^\| (O\d+) /)[1];
      if (ids.has(id)) errs.push(`خط ${i + 1}: ${id} تکراری (خط ${ids.get(id)})`);
      ids.set(id, i + 1);
      if (l.includes('⏸') && !/بازبینی: [۰-۹0-9]/.test(l)) warns.push(`${id}: بلاک بی تاریخ بازبینی`);
    }
  });
  if (!ids.size) errs.push('فهرست یگانه هیچ ردیفی ندارد');
  return { errs, warns };
}

if (process.argv.includes('--self-test')) {
  const ok = `${HEAD}\n| # | کار |\n|---|---|\n| O1 | الف | ⏳ |\n| O2 | ب | ⏸ | بازبینی: ۵ آذر |\n\n## بایگانی\n- ✅ انجام شد\n`;
  const stray = ok + '- ⏳ کاری در دفتر روزانه\n';
  const dup = ok.replace('| O2 |', '| O1 |');
  const none = '# x\n- ⏳ هر جا\n';
  const cases = [
    [checkRegister(ok).errs.length === 0, 'فهرست سالم'],
    [checkRegister(stray).errs.length === 1, '⏳ در دفتر روزانه = خطا (همان باگ)'],
    [checkRegister(dup).errs.length === 1, 'O# تکراری = خطا'],
    [checkRegister(none).errs.length >= 1, 'بی فهرست یگانه = خطا'],
    [checkRegister(ok.replace(' بازبینی: ۵ آذر |', '')).warns.length === 1, 'بلاک بی تاریخ = هشدار'],
  ];
  let f = 0;
  for (const [c, m] of cases) { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) f++; }
  process.exit(f ? 1 : 0);
}

const { errs, warns } = checkRegister(readFileSync('docs/backlog.md', 'utf8'));
for (const w of warns) console.warn(`⚠️  backlog: ${w}`);
for (const e of errs) console.error(`❌ backlog: ${e}`);
if (errs.length) process.exit(1);
console.log('✅ کارهای باز فقط در فهرست یگانه‌اند.');
