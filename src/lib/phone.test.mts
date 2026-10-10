import { whatsappDigits } from './phone.ts';
let failed = 0;
const t = (name: string, got: unknown, want: unknown) => {
  const ok = got === want;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${got}, want ${want}`}`);
  if (!ok) failed++;
};
t('موبایل با صفر', whatsappDigits('09129430495'), '989129430495');
t('بدون صفر', whatsappDigits('9129430495'), '989129430495');
t('با 98', whatsappDigits('989129430495'), '989129430495');
t('با +98 و فاصله', whatsappDigits('+98 912 943 0495'), '989129430495');
t('با 0098', whatsappDigits('00989129430495'), '989129430495');
t('ارقام فارسی', whatsappDigits('۰۹۱۲۲۸۹۲۲۵۳'), '989122892253');
t('خط‌تیره و پرانتز', whatsappDigits('(0912) 289-2253'), '989122892253');
t('ثابت = null', whatsappDigits('02146876980'), null);
t('خالی', whatsappDigits(''), null);
t('null', whatsappDigits(null), null);
t('کوتاه', whatsappDigits('0912'), null);
t('غیرایرانی', whatsappDigits('+14155550123'), null);
if (failed) { console.error(`\n❌ ${failed}`); process.exit(1); }
console.log('\nهمه‌ی آزمون‌های phone گذشت.');
