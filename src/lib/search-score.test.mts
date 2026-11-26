// src/lib/search-score.test.mts — npm run test:search
// ---------------------------------------------------------------------------
// جستجوی تحمل‌گر کد فنی (Frontend v2، فاز ۲ — docs/frontend-v2.md §2 اصل ۱، §8 فاز ۲).
// معیار پذیرش §8: «جستجو saga1l12، SAGA1 L12 و ساگا را پیدا کند».
// ورودی خراب شناخته‌شده عمداً هست (قاعده‌ی ۶): این آزمون پیش از جابه‌جایی منطق به search-score.ts نوشته و
// روی stub قرمز دیده شد.
// ---------------------------------------------------------------------------
import { normalizeFa, partCodeKey, productEntry, suggest, suggestAlways, swapLayout, type SuggestEntry } from './search-score.ts';

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

console.log('── هرگز خالی (کارفرما، ۲۸ آبان ۱۴۰۵)');
const always = (q: string) => suggestAlways(index, q, 5);
eq('چیدمان انگلیسی برای «ساگا» (sh\'h) → layout + SAGA1-L12', [always("sh'h").mode, always("sh'h").items[0]?.href, always("sh'h").corrected], ['layout', '/products/saga-saga1-l12/', 'ساگا']);
eq('چیدمان فارسی برای «demag» (یثپشل) → مگنت دماگ', [always('یثپشل').mode, always('یثپشل').items[0]?.href], ['layout', '/products/magnet-mt318/']);
eq('غلط سنگین «رموتکنترول» → ریموت (تقریبی، نه دقیق)', [always('رموتکنترول').mode, always('رموتکنترول').items.some((e) => e.href === '/categories/x/')], ['approximate', true]);
eq('بی‌ربط کامل «xyz999» → هرگز خالی، برچسب popular، محصول اول', [always('xyz999').mode, always('xyz999').items.length > 0, always('xyz999').items[0]?.kind], ['popular', true, 'product']);
eq('عبارت دقیق همان نتیجه‌ی suggest را می‌دهد', always('SAGA1-L12').items.map((e) => e.href), suggest(index, 'SAGA1-L12', 5).map((e) => e.href));
eq('عبارت خالی = فهرست بسته', always('  ').items, []);
// دو باگ که روی فهرست واقعی سایت دیده شد (preview، ۲۸ آبان):
const inverter: SuggestEntry = { label: 'اینورتر', kind: 'category', href: '/categories/inv/', context: '', haystack: ['اینورتر', 'کنترل دور موتور', 'کنترلدورموتور'] };
const shock: SuggestEntry = { label: 'ضربه گیر', kind: 'category', href: '/categories/shock/', context: '', haystack: ['ضربه گیر', 'shock absorber', 'shockabsorber'] };
const real = [inverter, shock, ...index];
eq('«رموت کنترول» ریموت را بالاتر از اینورتر می‌آورد («رموت» درون «دورموتور»)', suggest(real, 'رموت کنترول', 3)[0]?.href !== '/categories/inv/', true);
eq("«sh'h» = ساگا (چیدمان)، نه ضربه‌گیر از پیشوند «sh»", [suggestAlways(real, "sh'h", 3).mode, suggestAlways(real, "sh'h", 3).items[0]?.href], ['layout', '/products/saga-saga1-l12/']);
eq('ترکیب دو خط = بی تعویض چیدمان', swapLayout('saga ساگا'), null);
for (const q of ['saga1l12', 'ساگا', 'sag', 'dmeag', 'رکتیفایر', '؟؟؟', 'zzzz', '12', 'ب']) {
  eq(`«${q}» هرگز خالی نیست`, always(q).items.length > 0, true);
}

console.log('── گونه‌های نوشتاری مدل (مدیرعامل ۶ آذر ۱۴۰۵: «ال» به‌جای L، «ساگآ»، «ساگا۱۰»)');
eq('normalizeFa: «ال ۱۲»/«ال۱۲»/«اِل 12» ⇒ l12', [normalizeFa('ساگا ال ۱۲'), normalizeFa('ساگا ال۱۲'), normalizeFa('ساگا اِل 12')], ['ساگا l12', 'ساگا l12', 'ساگا l12']);
eq('normalizeFa: واژه‌ی «الکتروموتور ۳» دست نمی‌خورد', normalizeFa('الکتروموتور ۳'), 'الکتروموتور 3');
eq('normalizeFa: «ساگآ» ⇒ «ساگا»، «ساگا۱۰» ⇒ «ساگا 10»', [normalizeFa('ساگآ'), normalizeFa('ساگا۱۰')], ['ساگا', 'ساگا 10']);
eq('«ریموت ساگا ال۱۲» ⇒ L12 اول', top('ریموت ساگا ال۱۲'), '/products/saga-saga1-l12/');
const l10 = productEntry({ slug: 'saga-saga1-l10', name: 'ریموت کنترل ساگا L10', sku: 'SAGA1-L10', brandNameFa: 'ساگا', brandNameEn: 'Saga', oemPartNumbers: [] });
eq('«ساگا ال ۱۰» ⇒ L10 اول، نه L12', suggest([saga, l10, magnet, category], 'ساگا ال ۱۰', 3)[0]?.href, '/products/saga-saga1-l10/');
eq('«ساگا ال ۱۲» ⇒ L12 اول، نه L10', suggest([l10, saga, magnet, category], 'ساگا ال ۱۲', 3)[0]?.href, '/products/saga-saga1-l12/');

if (failed) {
  console.error(`\n❌ ${failed} آزمون جستجو شکست خورد.`);
  process.exit(1);
}
console.log('\n✅ همه‌ی آزمون‌های جستجو گذشت.');
