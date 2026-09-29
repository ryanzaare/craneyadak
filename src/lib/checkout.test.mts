// src/lib/checkout.test.mts
// ---------------------------------------------------------------------------
// آزمون checkout.ts — همان موارد مرزی بررسی‌های ۶۰ تا ۷۷ هارنس PHP
// (wordpress-plugin/wp-stub-harness.php، بخش «پرداخت آنلاین»).
//
// ⚠️ سه چیز عمداً با *متن PHP* و *متن صفحه* مقایسه می‌شود، نه با ثابت‌های
// همین فایل: فهرست روش‌های ارسال (کد + برچسب)، و مقدار radioهای
// checkout/index.astro. اگر یکی از این سه تغییر کند و دیگری نه، مشتری
// گزینه‌ای می‌بیند که سرور رد می‌کند — یا برچسب حقوقی روش هوایی از سفارش
// می‌افتد.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import {
  SHIPPING_METHODS,
  checkoutTotals,
  customerMax,
  digitsOnly,
  invoiceMax,
  toLatinDigits,
  validLandline,
  validLegalId,
  validMobile,
  validNationalCode,
  validPostal,
  validateCustomerField,
  validateInvoiceField,
  validateShipping,
} from './checkout.ts';

let failed = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failed++;
    console.error(`  ✗ ${label}${detail ? `  → ${detail}` : ''}`);
  }
};

console.log('\n── نرمال‌سازی ارقام ──');
ok(toLatinDigits('۰۹۱۲۳۴۵۶۷۸۹') === '09123456789', 'فارسی → لاتین');
ok(toLatinDigits('٠١٢٣٤٥٦٧٨٩') === '0123456789', 'عربی → لاتین');
ok(toLatinDigits('ab۱٢c3') === 'ab12c3', 'مخلوط، حروف دست‌نخورده');
ok(digitsOnly('۰۴۹۹-۳۷۰ ۸۹۹') === '0499370899', 'digitsOnly جداکننده را حذف می‌کند');

console.log('\n── رقم کنترل (همان موارد هارنس ۶۰–۶۱) ──');
ok(validNationalCode('0499370899') && validNationalCode('۰۴۹۹۳۷۰۸۹۹'), 'کد ملی معتبر، لاتین و فارسی');
ok(!validNationalCode('0499370898'), 'یک رقم تغییر = نامعتبر');
ok(!validNationalCode('1111111111'), 'ده رقم یکسان');
ok(!validNationalCode('049937089'), 'طول کوتاه');
ok(validLegalId('10380284790'), 'شناسه ملی معتبر');
ok(!validLegalId('10380284791'), 'شناسه ملی با رقم کنترل غلط');
ok(!validLegalId('0499370899'), 'کد ملی ۱۰ رقمی شناسه ملی نیست');
ok(!validLegalId('11111111111'), 'شناسه ملی یکسان');

console.log('\n── موبایل / کد پستی / تلفن ثابت ──');
ok(validMobile('۰۹۱۲۱۲۳۴۵۶۷') && validMobile('9121234567'), 'موبایل با/بدون صفر و با ارقام فارسی');
ok(!validMobile('0812123456') && !validMobile('091212345'), 'موبایل نامعتبر');
ok(validPostal('1234567891') && !validPostal('123456789') && !validPostal('1111111111'), 'کد پستی');
ok(validLandline('02146876980') && !validLandline('09121234567') && !validLandline('4687698'), 'تلفن ثابت با پیش‌شماره');

console.log('\n── maxlength پویا (کد ملی ۱۰ / شناسه ملی ۱۱) ──');
ok(invoiceMax('national_id', 'real') === 10, 'حقیقی: ۱۰');
ok(invoiceMax('national_id', 'legal') === 11, 'حقوقی: ۱۱');
ok(invoiceMax('economic_code', 'real') === 14 && invoiceMax('reg_no', 'legal') === 10, 'کد اقتصادی ۱۴، ثبت ۱۰');
ok(invoiceMax('postal', 'real') === 10 && invoiceMax('landline', 'real') === 11, 'پستی ۱۰، ثابت ۱۱');
ok(invoiceMax('name', 'real') === null && invoiceMax('address', 'legal') === null, 'متن آزاد سقف ندارد');
ok(customerMax('phone') === 11 && customerMax('postal') === 10 && customerMax('name') === null, 'فیلدهای مشتری');

console.log('\n── اعتبارسنجی فیلد به فیلد (پیام‌ها = پیام سرور) ──');
ok(validateInvoiceField('national_id', '0499370899', 'real') === '', 'کد ملی درست در حالت حقیقی');
ok(validateInvoiceField('national_id', '0499370899', 'legal') !== '', 'همان مقدار در حالت حقوقی رد می‌شود (نوع مهم است)');
ok(validateInvoiceField('national_id', '10380284790', 'legal') === '', 'شناسه ملی درست در حالت حقوقی');
ok(validateInvoiceField('reg_no', '', 'real') === '' && validateInvoiceField('reg_no', '', 'legal') !== '', 'شماره ثبت فقط برای حقوقی اجباری');
ok(validateInvoiceField('economic_code', '123456789', 'real') !== '' && validateInvoiceField('economic_code', '411111111111', 'real') === '', 'کد اقتصادی ۱۰–۱۴ رقم');
ok(validateCustomerField('email', '') === '' && validateCustomerField('email', 'x@') !== '', 'ایمیل اختیاری ولی اگر پر شد معتبر');
ok(validateCustomerField('name', 'ab') !== '' && validateCustomerField('address', 'کوتاه') !== '', 'نام/نشانی کوتاه');

console.log('\n── مالیات دقیق (همان ۷ مورد هارنس ۷۵) ──');
const cases: [number, number, number][] = [
  [19999998, 10, 21999998],
  [1000000, 10, 1100000],
  [5, 10, 6],
  [15, 10, 17],
  [1, 10, 1],
  [333333, 9, 363333],
  [0, 10, 0],
];
for (const [sub, rate, expected] of cases) {
  const t = checkoutTotals(sub, true, rate);
  ok(t.total === expected && t.vat === t.total - sub && t.sub === sub, `sub=${sub} rate=${rate} → ${expected}`, JSON.stringify(t));
}
const off = checkoutTotals(1000000, false, 10);
ok(off.vat === 0 && off.total === 1000000, 'بدون فاکتور: مالیات ۰');
ok(checkoutTotals(9900000, true, 10).total === 10890000, '۹٬۹۰۰٬۰۰۰ → ۱۰٬۸۹۰٬۰۰۰ (هارنس ۷۱)');

console.log('\n── روش ارسال ──');
ok(SHIPPING_METHODS.length === 4, 'چهار روش');
ok(validateShipping('tipax') === '' && validateShipping('air') === '', 'کد معتبر');
ok(validateShipping(null) !== '' && validateShipping('') !== '' && validateShipping('TIPAX') !== '', 'خالی/null/حرف بزرگ رد');

const php = readFileSync(new URL('../../wordpress-plugin/crane-yadak-headless/includes/class-checkout.php', import.meta.url), 'utf8');
const fn = php.match(/function cyh_shipping_methods\(\)\s*\{[\s\S]*?return \[([\s\S]*?)\];/);
const phpPairs = [...(fn?.[1] ?? '').matchAll(/'([a-z]+)'\s*=>\s*'([^']+)'/g)].map((m) => [m[1], m[2]]);
ok(
  phpPairs.length === 4 && JSON.stringify(phpPairs) === JSON.stringify(SHIPPING_METHODS.map((m) => [m.code, m.label])),
  'کد و برچسب روش‌های ارسال TS عیناً برابر PHP است (شامل شرط حقوقی هوایی)',
  JSON.stringify(phpPairs),
);
ok(
  SHIPPING_METHODS.find((m) => m.code === 'air')!.label.includes('مشروط به وضعیت نرمال مرزها و پروازها'),
  'برچسب هوایی شرط مرز و پرواز را دارد',
);

const page = readFileSync(new URL('../pages/checkout/index.astro', import.meta.url), 'utf8');
const radios = [...page.matchAll(/name="shipping"[^>]*value="([^"]+)"|value="([^"]+)"[^>]*name="shipping"/g)].map((m) => m[1] ?? m[2]);
ok(
  JSON.stringify(radios) === JSON.stringify(SHIPPING_METHODS.map((m) => m.code)),
  'radioهای ارسال در صفحه = فهرست TS، به همین ترتیب',
  JSON.stringify(radios),
);
ok(SHIPPING_METHODS.every((m) => page.includes(`<span>${m.label}</span>`)), 'برچسب هر روش در صفحه عیناً برابر TS/PHP است');
ok(SHIPPING_METHODS.every((m) => page.includes(`<span>${m.label}</span>`)), 'برچسب هر روش در صفحه عیناً برابر TS/PHP است');
ok(!/<input[^>]*name="shipping"[^>]*\schecked\b/.test(page), 'هیچ روش ارسالی از پیش انتخاب نیست');

if (failed) {
  console.error(`\n${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\nهمه‌ی آزمون‌های checkout گذشت.');
