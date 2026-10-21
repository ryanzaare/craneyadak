// scripts/check-design-tokens.test.mjs — node scripts/check-design-tokens.test.mjs
// ورودی خراب شناخته‌شده عمداً هست (قاعده‌ی ۶): نگهبانی که روی ورودی خراب سبز بماند، کور است.
// این آزمون پیش از پیاده‌سازی نوشته و قرمز دیده شد (Frontend v2، فاز ۰، گام ۵).
import { findLegacyTokens } from './check-design-tokens.mjs';

let failed = 0;
const hits = (name, src, want) => {
  const got = findLegacyTokens(src).map((h) => h.token);
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};

console.log('── باید بگیرد (ورودی خراب)');
hits('gray در کلاس', '<div class="bg-gray-100 text-gray-700">', ['bg-gray-100', 'text-gray-700']);
hits('gray با واریانت و شفافیت', '<a class="hover:bg-gray-50/70 md:border-gray-200">', ['hover:bg-gray-50/70', 'md:border-gray-200']);
hits('crane-* در کلاس', '<b class="text-crane-orange bg-crane-navy">', ['text-crane-orange', 'bg-crane-navy']);
hits('crane-light / crane-white', 'class="bg-crane-light ring-crane-white"', ['bg-crane-light', 'ring-crane-white']);
hits('متغیر CSS قدیمی', 'color: var(--color-crane-orange);', ['--color-crane-orange']);
hits('تعریف alias قدیمی در @theme', '  --color-crane-navy: var(--color-steel-900);', ['--color-crane-navy']);
hits('متغیر gray پیش‌فرض Tailwind', 'border-color: var(--color-gray-200);', ['--color-gray-200']);
// orange-* پیش‌فرض Tailwind نسخه‌ی دوم همان accent است (orange-800 دقیقاً #9A3412 = accent-ink): نارنجی فقط از
// راه توکن (§5: «نارنجی فقط برای عمل، فوکوس و حالت فعال»).
hits('orange-* پیش‌فرض', '<a class="hover:bg-orange-800 border-orange-100 shadow-orange-500/20">', ['hover:bg-orange-800', 'border-orange-100', 'shadow-orange-500/20']);
hits('rounded-2xl و rounded-3xl', '<div class="rounded-2xl md:rounded-3xl">', ['rounded-2xl', 'md:rounded-3xl']);
hits('گوشه‌ی جهت‌دار', '<div class="rounded-t-3xl rounded-se-2xl">', ['rounded-t-3xl', 'rounded-se-2xl']);
hits('rounded-xl (۱۲px — بیرون از قاعده‌ی ۴ و ۶–۸px)', '<div class="rounded-xl">', ['rounded-xl']);
hits('class:list / رشته‌ی TS', "const c = ok ? 'text-gray-500' : 'text-steel-600';", ['text-gray-500']);
// مقیاس تایپ ۱۲/۱۴/۱۶/۲۰/۲۴/۳۲/۴۰ و وزن‌های ۴۰۰/۷۰۰/۹۰۰ (docs/frontend-v2.md §5).
// ⚠️ text-lg و text-5xl در @theme حذف شده‌اند؛ اگر کلاسی بماند، Tailwind هیچ CSS نمی‌سازد و متن *بی‌صدا*
// به اندازه‌ی ارث‌برده برمی‌گردد. پس باید این‌جا گرفته شود، نه در اسکرین‌شات.
hits('اندازه‌ی بیرون از مقیاس', '<h1 class="text-lg md:text-5xl lg:text-6xl">', ['text-lg', 'md:text-5xl', 'lg:text-6xl']);
hits('اندازه‌ی دلخواه', '<span class="text-[13px] text-[0.8rem]">', ['text-[13px]', 'text-[0.8rem]']);
hits('وزن بیرون از ۴۰۰/۷۰۰/۹۰۰', '<b class="font-medium md:font-semibold font-extrabold font-light">', ['font-medium', 'md:font-semibold', 'font-extrabold', 'font-light']);
hits('وزن در CSS', '.x { font-weight: 800; } .y { font-weight: 600 }', ['font-weight: 800', 'font-weight: 600']);
hits('اندازه در CSS بیرون از مقیاس', '.x { font-size: 0.9375rem; } .y{font-size:13px}', ['font-size: 0.9375rem', 'font-size:13px']);

console.log('── نباید بگیرد (ورودی سالم)');
hits('توکن‌های جدید', '<div class="bg-steel-50 text-accent-ink border-steel-300 rounded-lg rounded-md rounded-full">', []);
// ⚠️ اسلاگ‌ها و کلیدهای ذخیره با «crane-» شروع می‌شوند (crane-hook، crane-wheel، crane-yadak-quote…).
// اگر نگهبان این‌ها را بگیرد، مهاجرت را به تغییر اسلاگ/کلید ذخیره هل می‌دهد = شکستن URL و سبد کاربر.
hits('اسلاگ و کلید ذخیره‌ی crane-*', "href='/categories/crane-hook/' key='crane-yadak-quote' id='crane-wheel'", []);
hits('rounded-xl-ish نام غیرکلاسی', 'const roundedXlCount = 1;', []);
// رنگ‌های وضعیت (قرمز خطا، سبز موجود، کهربایی هشدار) عمداً هنوز آزادند — backlog: توکن معنایی وضعیت.
hits('رنگ وضعیت', 'text-red-700 bg-emerald-50 border-amber-200', []);
hits('steel-200 / accent-soft', 'bg-steel-200 bg-accent-soft', []);
hits('مقیاس و وزن مجاز', 'text-xs text-sm text-base text-xl text-2xl text-3xl text-4xl font-normal font-bold font-black text-left text-steel-600', []);
hits('CSS مجاز', '.a{font-weight:700} .b{font-weight: 900} .c{font-size: 0.875rem} .d{font-size:1.25rem} .e{font-size: 11pt} .f{font-size: 0.9em}', []);
// SVG: ویژگی font-size="46" (مختصات viewBox) یک اندازه‌ی تایپ نیست.
// @font-face فونت متغیر: «font-weight: 100 900» بازه‌ی محور است، نه وزن مصرفی.
hits('بازه‌ی وزن در @font-face', '@font-face { font-weight: 100 900; }', []);
hits('گوشه‌ی CSS بزرگ‌تر از ۸px', '.a{border-radius: 0.75rem} .b{border-radius:1rem} .c{border-radius: 0 0 0.75rem 0.75rem}', ['border-radius: 0.75rem', 'border-radius:1rem', 'border-radius: 0 0 0.75rem 0.75rem']);
hits('گوشه‌ی CSS مجاز', '.a{border-radius: 0.5rem} .b{border-radius: 4px} .c{border-radius: 999px} .d{border-radius: 50%} .e{border-radius: 0}', []);
hits('ویژگی SVG', '<text font-size="46" font-weight="900">', []);

console.log('── شماره‌ی خط');
const multi = findLegacyTokens('ok\n<div class="bg-gray-100">\nok');
const lineOk = multi.length === 1 && multi[0].line === 2;
console.log(`  ${lineOk ? '✓' : '✗'} خط درست گزارش می‌شود${lineOk ? '' : `  → ${JSON.stringify(multi)}`}`);
if (!lineOk) failed++;

if (failed) {
  console.error(`\n❌ ${failed} آزمون نگهبان توکن‌ها شکست خورد.`);
  process.exit(1);
}
console.log('\n✅ همه‌ی آزمون‌های نگهبان توکن‌ها گذشت.');
