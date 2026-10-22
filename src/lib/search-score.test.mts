// src/lib/search-score.test.mts — npm run test:search
// ---------------------------------------------------------------------------
// جستجوی تحمل‌گر کد فنی (Frontend v2، فاز ۲ — docs/frontend-v2.md §2 اصل ۱، §8 فاز ۲).
// معیار پذیرش §8: «جستجو saga1l12، SAGA1 L12 و ساگا را پیدا کند».
// ورودی خراب شناخته‌شده عمداً هست (قاعده‌ی ۶): این آزمون پیش از جابه‌جایی منطق به search-score.ts نوشته و
// روی stub قرمز دیده شد.
// ---------------------------------------------------------------------------
import { normalizeFa, partCodeKey, productEntry, suggest, type SuggestEntry } from './search-score.ts';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};

const saga = productEntry({
  slug: 'saga-saga1-l12',
  name: 'ریموت کنترل ساگا SAGA1-L12 L۱۲ کاناله دو سرعته',
  sku: 'SAGA1-L12',
  brandNameFa: 'ساگا',
  brandNameEn: 'Saga',
  oemPartNumbers: [],
});
const magnet = productEntry({
  slug: 'magnet-mt318',
  name: 'مگنت ترمز MT318-K2/L',
  sku: 'MT318-K2/L',
  brandNameFa: 'دماگ',
  brandNameEn: 'Demag',
  oemPartNumbers: ['DMG 0123 456'],
});
const category: SuggestEntry = { label: 'ریموت کنترل جرثقیل سقفی', kind: 'category', href: '/categories/x/', context: '', haystack: ['ریموت کنترل', 'ریموتکنترل'] };
const index = [saga, magnet, category];
const top = (q: string) => suggest(index, q, 3)[0]?.href ?? null;
const hits = (q: string) => suggest(index, q, 10).map((e) => e.href);

console.log('── کلید کد فنی');
eq('خط‌تیره، فاصله، اسلش، حروف کوچک یک کلید', ['SAGA1-L12', 'saga1 l12', 'saga1/l12', 'Saga1_L12', 'saga1.l12'].map(partCodeKey), Array(5).fill('saga1l12'));
eq('ارقام فارسی و عربی', [partCodeKey('saga۱-l۱۲'), partCodeKey('saga١-l١٢')], ['saga1l12', 'saga1l12']);
eq('ک/ی عربی در نام', normalizeFa('ريموت كنترل'), 'ریموت کنترل');

console.log('── معیار پذیرش §8: SAGA1-L12');
for (const q of ['saga1l12', 'SAGA1 L12', 'saga1-l12', 'SAGA1-L12', 'saga1/l12', 'saga۱l۱۲', 'ساگا', 'Saga']) {
  eq(`«${q}» → SAGA1-L12 اول`, top(q), '/products/saga-saga1-l12/');
}

console.log('── کد با اسلش و کد معادل OEM');
eq('mt318k2l → مگنت', top('mt318k2l'), '/products/magnet-mt318/');
eq('MT318 K2 L → مگنت', top('MT318 K2 L'), '/products/magnet-mt318/');
eq('کد OEM با فاصله‌ی متفاوت: dmg0123456', top('dmg0123456'), '/products/magnet-mt318/');

console.log('── نباید بگیرد (ورودی بی‌ربط)');
eq('کد بی‌ربط هیچ محصولی نمی‌آورد', hits('xyz999').filter((h) => h.startsWith('/products/')), []);
eq('بخشی از کد دیگر (saga2) SAGA1 را اول نمی‌آورد', top('saga2l99') === '/products/saga-saga1-l12/', false);

console.log('── نمایش');
eq('مدخل محصول کد فنی جدا دارد (برای font-mono)', saga.code, 'SAGA1-L12');
eq('نشانی محصول با «/» پایانی', saga.href, '/products/saga-saga1-l12/');

if (failed) {
  console.error(`\n❌ ${failed} آزمون جستجو شکست خورد.`);
  process.exit(1);
}
console.log('\n✅ همه‌ی آزمون‌های جستجو گذشت.');
