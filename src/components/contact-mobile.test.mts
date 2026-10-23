// src/components/contact-mobile.test.mts — npm run test:mobile
// خط همراه «تماس فوری» (Frontend v2، فاز ۳ — بخش ۲.۱ دستور کارفرما). ورودی خراب عمداً هست (قاعده‌ی ۶)؛ پیش از
// پیاده‌سازی روی stub قرمز دیده شد.
import { mobileLine, toIranMobile } from './contact-mobile.ts';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};

console.log('── تبدیل به ۰۹…');
for (const raw of ['989122892253', '+98 912 289 2253', '00989122892253', '09122892253', '9122892253', '۰۹۱۲-۲۸۹-۲۲۵۳', '+98-912-289-22-53']) {
  eq(`«${raw}» → 09122892253`, toIranMobile(raw), '09122892253');
}
console.log('── نباید همراه حساب شود (ورودی خراب)');
eq('تلفن ثابت ۰۲۱', toIranMobile('02146876980'), null);
eq('کد کشور دیگر', toIranMobile('+44 7911 123456'), null);
eq('همراه کوتاه', toIranMobile('0912289225'), null);
eq('خالی/null', [toIranMobile(''), toIranMobile(null)], [null, null]);

console.log('── منبع: اول phoneSecondary اگر همراه است، بعد واتساپ');
eq('phoneSecondary همراه مقدم است', mobileLine({ phoneSecondary: '09351112233', whatsapp: '989122892253' })?.digits, '09351112233');
eq('phoneSecondary ثابت → از واتساپ', mobileLine({ phoneSecondary: '02122223333', whatsapp: '989122892253' })?.digits, '09122892253');
eq('هیچ‌کدام → null (دکمه رندر نشود)', mobileLine({ phoneSecondary: null, whatsapp: null }), null);
eq('خروجی کامل', mobileLine({ phoneSecondary: null, whatsapp: '989122892253' }), { digits: '09122892253', href: 'tel:09122892253', display: '۰۹۱۲۲۸۹۲۲۵۳' });

if (failed) {
  console.error(`\n❌ ${failed} آزمون خط همراه شکست خورد.`);
  process.exit(1);
}
console.log('\n✅ همه‌ی آزمون‌های خط همراه گذشت.');
