// src/components/toc.test.mts — npm run test:toc
// فهرست مطالب مقاله (Frontend v2، فاز ۵) از <h2>های HTML وردپرس. ورودی خراب عمداً هست (قاعده‌ی ۶)؛ پیش از
// پیاده‌سازی روی stub قرمز دیده شد.
import { buildToc } from './toc.ts';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};

const a = buildToc('<p>x</p><h2>علائم سایش</h2><p>y</p><h2 class="c">بازرسی <strong>روزانه</strong></h2>');
eq('دو h2 → دو قلم با متن بی‌تگ', a.items, [{ id: 'h-1', text: 'علائم سایش' }, { id: 'h-2', text: 'بازرسی روزانه' }]);
eq('id روی h2 نوشته می‌شود و صفت‌های دیگر می‌مانند', a.html, '<p>x</p><h2 id="h-1">علائم سایش</h2><p>y</p><h2 id="h-2" class="c">بازرسی <strong>روزانه</strong></h2>');
const b = buildToc('<h2 id="wear">سایش</h2><h2>بعدی</h2>');
eq('id موجود حفظ می‌شود', b.items, [{ id: 'wear', text: 'سایش' }, { id: 'h-2', text: 'بعدی' }]);
eq('HTML با id موجود دست نمی‌خورد', b.html, '<h2 id="wear">سایش</h2><h2 id="h-2">بعدی</h2>');
eq('h3 و H2 خالی نادیده', buildToc('<h3>فرعی</h3><h2> </h2>').items, []);
eq('بدون سرفصل', buildToc('<p>فقط متن</p>').items, []);
eq('موجودیت HTML رمزگشایی می‌شود', buildToc('<h2>ترمز &amp; کلاچ</h2>').items[0]?.text, 'ترمز & کلاچ');

if (failed) {
  console.error(`\n❌ ${failed} آزمون فهرست مطالب شکست خورد.`);
  process.exit(1);
}
console.log('\n✅ همه‌ی آزمون‌های فهرست مطالب گذشت.');
