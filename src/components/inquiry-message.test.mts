// src/components/inquiry-message.test.mts — npm run test:inquiry
// ورودی خراب عمداً هست (قاعده‌ی ۶). این آزمون پیش از پیاده‌سازی نوشته و قرمز دیده شد.
import { inquiryText, whatsappInquiryHref } from './inquiry-message.ts';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};

console.log('── متن پیام (تصمیم ۴ کارفرما، docs/frontend-v2.md §10)');
eq('نام + کد فنی', inquiryText({ name: 'ریموت کنترل SAGA1-L12', sku: 'SAGA1-L12', url: 'https://craneyadak.com/products/x/' }),
  'استعلام قیمت: ریموت کنترل SAGA1-L12 — کد فنی SAGA1-L12');
eq('بدون کد فنی → نام + نشانی صفحه', inquiryText({ name: 'فلکه ترمز', sku: null, url: 'https://craneyadak.com/products/f/' }),
  'استعلام قیمت: فلکه ترمز — https://craneyadak.com/products/f/');
// ⚠️ کد فنی فقط فاصله = بدون کد. «کد فنی   » در پیام یعنی خریدار فکر می‌کند کد را فرستاده.
eq('کد فنی خالی/فاصله = بدون کد', inquiryText({ name: 'فلکه', sku: '   ', url: 'https://x.test/p/' }), 'استعلام قیمت: فلکه — https://x.test/p/');
eq('فاصله‌ی اضافه در نام و کد بریده می‌شود', inquiryText({ name: '  ریموت  ', sku: ' A-1 ', url: 'u' }), 'استعلام قیمت: ریموت — کد فنی A-1');

console.log('── لینک واتساپ');
eq('بدون شماره = null (دکمه رندر نشود)', whatsappInquiryHref(null, { name: 'x', sku: 'A', url: 'u' }), null);
eq('رشته‌ی خالی = null', whatsappInquiryHref('', { name: 'x', sku: 'A', url: 'u' }), null);
eq('text رمزگذاری‌شده', whatsappInquiryHref('https://wa.me/989120000000', { name: 'ریموت', sku: 'A-1/B', url: 'u' }),
  'https://wa.me/989120000000?text=' + encodeURIComponent('استعلام قیمت: ریموت — کد فنی A-1/B'));
// ⚠️ اگر روزی whatsappHref از وردپرس با پرس‌وجو بیاید، «?text» دوم لینک را می‌شکند.
eq('لینک پرس‌وجودار با & ادامه می‌یابد', whatsappInquiryHref('https://api.whatsapp.com/send?phone=98912', { name: 'x', sku: 'A', url: 'u' }),
  'https://api.whatsapp.com/send?phone=98912&text=' + encodeURIComponent('استعلام قیمت: x — کد فنی A'));
// & و # در نام نباید پیام را ببُرد.
eq('& و # در نام', whatsappInquiryHref('https://wa.me/1', { name: 'A&B #2', sku: null, url: 'https://s/p/' })?.includes('A%26B%20%232'), true);

if (failed) {
  console.error(`\n❌ ${failed} آزمون پیام استعلام شکست خورد.`);
  process.exit(1);
}
console.log('\n✅ همه‌ی آزمون‌های پیام استعلام گذشت.');
