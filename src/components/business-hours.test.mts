// src/components/business-hours.test.mts — npm run test:hours
// نقطه‌ی سبز «خط ویژه تامین» (فاز ۳): فقط داخل ساعت کاری وردپرس، به وقت تهران. ورودی خراب عمداً هست (قاعده‌ی ۶)؛
// پیش از پیاده‌سازی روی stub قرمز دیده شد.
import { isOpenAt, type HoursRow } from './business-hours.ts';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};

// همان شکل داده‌ی زنده‌ی وردپرس (JSON-LD صفحه‌ی اصلی، ۲ آبان ۱۴۰۵) — با پنجشنبه‌ی ۰۹:۰۰ تا ۱۳:۳۰.
const H: HoursRow[] = [
  { dayOfWeek: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'], opens: '09:00', closes: '17:00' },
  { dayOfWeek: ['Thursday'], opens: '09:00', closes: '13:30' },
];
// تهران = UTC+03:30 (بدون ساعت تابستانی از ۱۴۰۱). ۲۰۲۶-۱۰-۲۴ شنبه است.
console.log('── به وقت تهران، نه UTC و نه ساعت مرورگر');
eq('شنبه ۱۰:۰۰ تهران → باز', isOpenAt(H, new Date('2026-10-24T06:30:00Z')), true);
eq('شنبه ۰۸:۵۹ تهران → بسته', isOpenAt(H, new Date('2026-10-24T05:29:00Z')), false);
// ⚠️ اگر UTC خوانده شود، ۰۸:۵۹ تهران = ۰۵:۲۹ UTC هم بسته است؛ این یکی فرق را می‌گیرد: ۱۶:۰۰ تهران = ۱۲:۳۰ UTC.
eq('شنبه ۱۶:۰۰ تهران → باز (UTC ۱۲:۳۰)', isOpenAt(H, new Date('2026-10-24T12:30:00Z')), true);
eq('شنبه ۱۸:۰۰ تهران (UTC ۱۴:۳۰) → بسته', isOpenAt(H, new Date('2026-10-24T14:30:00Z')), false);
eq('درست سر ساعت بستن → بسته', isOpenAt(H, new Date('2026-10-24T13:30:00Z')), false);
eq('جمعه ۱۱:۰۰ → بسته', isOpenAt(H, new Date('2026-10-23T07:30:00Z')), false);
eq('پنجشنبه ۱۲:۰۰ → باز', isOpenAt(H, new Date('2026-10-22T08:30:00Z')), true);
eq('پنجشنبه ۱۴:۰۰ → بسته', isOpenAt(H, new Date('2026-10-22T10:30:00Z')), false);
// روز تهران با روز UTC فرق دارد: شنبه ۰۲:۰۰ تهران = جمعه ۲۲:۳۰ UTC.
eq('مرز روز: جمعه ۲۲:۳۰ UTC = شنبه ۰۲:۰۰ تهران → بسته', isOpenAt(H, new Date('2026-10-23T22:30:00Z')), false);
eq('مرز روز: همان لحظه با ردیف «فقط شنبه» ۰۰:۰۰–۲۳:۵۹ → باز', isOpenAt([{ dayOfWeek: ['Saturday'], opens: '00:00', closes: '23:59' }], new Date('2026-10-23T22:30:00Z')), true);

console.log('── شکل‌های دیگر و ورودی خراب');
eq('روز به‌صورت نشانی schema.org', isOpenAt([{ dayOfWeek: ['https://schema.org/Saturday'], opens: '09:00', closes: '17:00' }], new Date('2026-10-24T06:30:00Z')), true);
eq('بدون ساعت کاری → بسته (نقطه خنثی می‌ماند)', isOpenAt([], new Date('2026-10-24T06:30:00Z')), false);
eq('ساعت خراب → بسته', isOpenAt([{ dayOfWeek: ['Saturday'], opens: '9', closes: 'x' }], new Date('2026-10-24T06:30:00Z')), false);

if (failed) {
  console.error(`\n❌ ${failed} آزمون ساعت کاری شکست خورد.`);
  process.exit(1);
}
console.log('\n✅ همه‌ی آزمون‌های ساعت کاری گذشت.');
