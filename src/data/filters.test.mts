// src/data/filters.test.mts — فیلتر خودکار از برچسب‌های مشترک مشخصات (npm run test:catfilter)
// ورودی خراب عمداً هست (قاعده‌ی ۶): مقدارهای یکتا، جمله‌ی بلند، برچسب تک‌مقداری — هیچ‌کدام نباید فیلتر شوند.
import { autoFacets, labelId } from './filters.ts';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};
const P = (...specs: [string, string][]) => ({ technicalSpecs: specs.map(([label, value]) => ({ label, value })) });

console.log('── فیلتر خودکار');
const ps = [
  P(['نوع', 'فرستنده'], ['وزن', '۲۱۰ گرم'], ['IP', 'IP65'], ['رنگ', 'نارنجی']),
  P(['نوع', 'فرستنده'], ['وزن', '۴۰۰ گرم'], ['IP', 'IP65'], ['رنگ', 'نارنجی']),
  P(['نوع', 'گیرنده'], ['وزن', '۱۴۰۰ گرم'], ['IP', 'IP66'], ['توضیح', 'x'.repeat(61)]),
  P(['نوع', 'گیرنده'], ['وزن', '۳۰۰۰ گرم'], ['توضیح', 'y'.repeat(61)], ['توضیح2', 'کوتاه']),
];
const labels = autoFacets(ps).map((f) => f.label);
eq('«نوع» (مقدار مشترک) فیلتر می‌شود', labels.includes('نوع'), true);
eq('«IP» با یک مقدار مشترک فیلتر می‌شود', labels.includes('IP'), true);
eq('«وزن» (همه یکتا) فیلتر نمی‌شود', labels.includes('وزن'), false);
eq('«رنگ» (فقط یک مقدار) فیلتر نمی‌شود', labels.includes('رنگ'), false);
eq('مقدار جمله‌ای (>۶۰ نویسه) فیلتر نمی‌شود', labels.includes('توضیح'), false);
eq('برچسب وردپرس کنار گذاشته می‌شود', autoFacets(ps, ['نوع']).map((f) => f.label).includes('نوع'), false);
eq('ترتیب: پوشش بیشتر اول', labels[0], 'نوع');
eq('شناسه پایدار و امن برای URL', [labelId('نوع') === labelId(' نوع '), /^a[0-9a-z]+$/.test(labelId('درجه حفاظت'))], [true, true]);
eq('بی محصول ⇒ هیچ', autoFacets([]), []);

if (failed) { console.error(`\n❌ ${failed} آزمون فیلتر خودکار شکست خورد.`); process.exit(1); }
console.log('\n✅ همه‌ی آزمون‌های فیلتر خودکار گذشت.');
