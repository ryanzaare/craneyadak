#!/usr/bin/env node
// scripts/check-sticky-offsets.mjs
// ---------------------------------------------------------------------------
// هر عنصر چسبان (sticky) فاصله‌ی بالایش را از متغیرهای ارتفاع هدر می‌گیرد (--hdr-h، --sticky-off، --anchor-off در
// src/styles/global.css)، نه از عدد ثابت.
//
// ⚠️ باگ واقعی (۲۸ آبان ۱۴۰۵، کارفرما): نوار «در این صفحه» top-[68px] داشت در حالی که هدر ۱۲۵/۱۴۱/۸۹px است — موبایل:
// نوار کامل پشت هدر پنهان («نمی‌چسبد»)، دسکتاپ: ۲۱px زیر هدر («نصف منو ناپدید می‌شود»). شش عنصر چسبان دیگر هم هر کدام
// عدد خودشان را داشتند (top-24، top-28، top-32، top-40، top-[9.5rem]). عدد ثابت یعنی هر تغییر هدر دوباره همین باگ.
// استثنا: top-0 (خود هدر و عنصرهای درون ظرف خودشان).
// آزمون روی ورودی خراب: `--self-test`.
// ---------------------------------------------------------------------------
import { readFileSync, globSync } from 'node:fs';

const BAD = /(?:^|[\s'"`])(?:[a-z]+:)*top-(?:\[[^\]]+\]|(?!0\b)\d+(?:\.\d+)?)(?=[\s'"`]|$)/;

/** خطاهای یک فایل: شماره‌ی خط هر class که sticky و top عددی (غیر صفر) با هم دارد. */
export function checkSticky(src) {
  const out = [];
  src.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/(?:class(?::list)?=\{?["'`[]|['"`])([^"'`]*sticky[^"'`]*)/g)) {
      if (BAD.test(` ${m[1]} `)) out.push(i + 1);
    }
  });
  return out;
}

if (process.argv.includes('--self-test')) {
  const cases = [
    [checkSticky('<nav class="section-nav sticky top-[68px] z-30">').length === 1, 'top-[68px] = خطا (همان باگ)'],
    [checkSticky("<aside class:list={['lg:sticky lg:top-24']}>").length === 1, 'lg:top-24 در class:list = خطا'],
    [checkSticky('<div class="md:sticky md:top-40 xl:top-28">').length === 1, 'md:top-40 = خطا'],
    [checkSticky('<header class="sticky top-0 z-50">').length === 0, 'top-0 مجاز'],
    [checkSticky('<nav class="sticky top-(--hdr-h) z-30">').length === 0, 'top-(--hdr-h) مجاز'],
  ];
  let f = 0;
  for (const [ok, msg] of cases) { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) f++; }
  process.exit(f ? 1 : 0);
}

let failed = 0;
for (const file of globSync('src/**/*.astro')) {
  for (const line of checkSticky(readFileSync(file, 'utf8'))) {
    console.error(`❌ ${file}:${line} — sticky با top عددی؛ از top-(--hdr-h) یا top-(--sticky-off) استفاده کنید (global.css)`);
    failed++;
  }
}
if (failed) process.exit(1);
console.log('✅ همه‌ی عنصرهای چسبان فاصله را از ارتفاع هدر می‌گیرند.');
