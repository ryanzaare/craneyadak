// src/lib/indexability.test.mts — node --experimental-strip-types --no-warnings src/lib/indexability.test.mts
import { productReadiness, categoryReadiness, brandReadiness, blocksWordCount, THRESHOLDS } from './indexability.ts';

let failed = 0;
const t = (name: string, ok: boolean, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → ${extra}`}`);
  if (!ok) failed++;
};
const long = 'این یک توضیح واقعی و کامل درباره‌ی قطعه است که به اندازه‌ی کافی بلند نوشته شده و برای خریدار صنعتی معنا دارد، نه جای‌گذار.';
const full = { name: 'ریموت', sku: 'X-1', brandSlug: 'saga', categorySlugs: ['remote-control'], images: [{ url: 'u' }], summary: long, bodyHtml: '', isDemo: false };

console.log('── محصول');
t('کامل = آماده', productReadiness(full).ready);
t('متن در bodyHtml هم شمرده می‌شود', productReadiness({ ...full, summary: '', bodyHtml: `<p>${long}</p>` }).ready);
t('HTML بی‌متن شمرده نمی‌شود', !productReadiness({ ...full, summary: '', bodyHtml: '<p><br></p><script>alert(1)</script>' }).ready);
for (const [k, v, label] of [
  ['sku', '', 'کد فنی'],
  ['sku', '   ', 'کد فنی (فاصله)'],
  ['brandSlug', null, 'برند'],
  ['categorySlugs', [], 'دسته'],
  ['images', [], 'تصویر'],
  ['summary', 'کوتاه', 'متن'],
  ['name', '', 'نام'],
  ['isDemo', true, 'نمایشی'],
] as const) {
  const r = productReadiness({ ...full, [k]: v });
  t(`ناقص (${label}) → noindex`, !r.ready && r.missing.length === 1, JSON.stringify(r));
}
t('همه‌چیز خالی (محصول آزمایشی فعلی بدون تصویر)', productReadiness({ name: 'x', sku: 'SAGA1-L12', brandSlug: 'saga', categorySlugs: ['a'], images: [], summary: '', bodyHtml: '' }).missing.length === 2);
t('ورودی تهی', !productReadiness({}).ready);

console.log('── دسته و برند');
t('خالی → noindex', !categoryReadiness({ readyProducts: 0, contentWords: 0 }).ready);
t('یک محصول آماده → ایندکس', categoryReadiness({ readyProducts: 1, contentWords: 0 }).ready);
t('محصول ناقص دسته را ایندکس نمی‌کند (readyProducts=0)', !categoryReadiness({ readyProducts: 0, contentWords: 10 }).ready);
t('محتوای نهایی ≥۳۰۰ کلمه → ایندکس', categoryReadiness({ readyProducts: 0, contentWords: THRESHOLDS.categoryWords }).ready);
t('۲۹۹ کلمه → noindex', !categoryReadiness({ readyProducts: 0, contentWords: THRESHOLDS.categoryWords - 1 }).ready);
t('بازنویسی عمدی', categoryReadiness({ readyProducts: 0, contentWords: 0, override: true }).ready);
t('برند: ۱۵۰ کلمه → ایندکس', brandReadiness({ readyProducts: 0, contentWords: THRESHOLDS.brandWords }).ready);
t('برند: ۱۴۹ کلمه → noindex', !brandReadiness({ readyProducts: 0, contentWords: THRESHOLDS.brandWords - 1 }).ready);
t('برند خالی → noindex', !brandReadiness({ readyProducts: 0, contentWords: 0 }).ready);

console.log('── blocksWordCount');
const w = (n: number) => Array.from({ length: n }, (_, i) => `کلمه${i}`).join(' ');
t('متن بلوک', blocksWordCount([{ heading: 'عنوان', bodyHtml: `<p>${w(9)}</p>` }]) === 10);
t('بلوک نیاز به بازبینی شمرده نمی‌شود', blocksWordCount([{ needsReview: true, bodyHtml: w(500) }]) === 0);
t('جدول، پرسش، قطعه و مشخصات', blocksWordCount([{ rows: [{ cells: ['الف ب', 'ج'] }], faqs: [{ question: 'چرا؟', answer: 'چون این' }], parts: [{ partName: 'ترمز', failureReason: 'سایش لنت' }], specs: [{ label: 'ولتاژ', value: '۲۲۰' }] }]) === 11);
t('تهی/undefined', blocksWordCount(undefined) === 0 && blocksWordCount([]) === 0);
const mixed = blocksWordCount([{ bodyHtml: w(200) }, { needsReview: true, bodyHtml: w(200) }, { bodyHtml: w(150) }]);
t('جمع بلوک‌های نهایی بدون پیش‌نویس‌ها', mixed === 350, String(mixed));
t('آستانه‌ی دسته با بلوک‌ها', categoryReadiness({ readyProducts: 0, contentWords: mixed }).ready);

if (failed) { console.error(`\n❌ ${failed} مورد ناموفق`); process.exit(1); }
console.log('\nهمه‌ی آزمون‌های آمادگی ایندکس گذشت.');
