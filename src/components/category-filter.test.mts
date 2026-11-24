// src/components/category-filter.test.mts — npm run test:catfilter
// فیلتر صفحه‌ی دسته (Frontend v2، فاز ۲ — تصمیم ۲ کارفرما، docs/frontend-v2.md §10): چیپ‌های «همه / موجود /
// استعلامی» + برند + مشخصه، ترکیب‌پذیر و در URL. ورودی خراب عمداً هست (قاعده‌ی ۶)؛ پیش از پیاده‌سازی، روی
// stub قرمز دیده شد.
import { matches, parseState, toQuery, compareItems, money, EMPTY, type FilterState, type ItemData } from './category-filter.ts';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};

const item = (o: Partial<ItemData>): ItemData => ({ stock: 'in_stock', priced: false, brand: 'saga', specs: {}, categories: [], price: null, modified: '', original: false, text: '', discount: false, catalog: false, ...o });
const S = (o: Partial<FilterState>): FilterState => ({ ...EMPTY, ...o, specs: { ...(o.specs ?? {}) }, ranges: { ...(o.ranges ?? {}) } });

console.log('── چیپ موجودی');
eq('«همه» همه را نشان می‌دهد', matches(item({ stock: 'on_order' }), S({})), true);
eq('«موجود» → فقط in_stock', [matches(item({ stock: 'in_stock' }), S({ stock: 'in' })), matches(item({ stock: 'on_order' }), S({ stock: 'in' }))], [true, false]);
// ⚠️ «استعلامی» = قیمت پرداخت‌پذیر ندارد — نه «ناموجود». SAGA1-L12 هم موجود است هم استعلامی.
eq('«استعلامی» → هر قلم بدون قیمت پرداخت‌پذیر، حتی موجود', [matches(item({ priced: false }), S({ stock: 'rfq' })), matches(item({ priced: true }), S({ stock: 'rfq' }))], [true, false]);

console.log('── برند و مشخصه (داخل گروه OR، بین گروه‌ها AND)');
eq('دو برند = هرکدام', [matches(item({ brand: 'saga' }), S({ brands: ['saga', 'demag'] })), matches(item({ brand: 'abb' }), S({ brands: ['saga', 'demag'] }))], [true, false]);
eq('برند AND موجودی', matches(item({ brand: 'saga', stock: 'on_order' }), S({ brands: ['saga'], stock: 'in' })), false);
eq('مشخصه: مقدار در فهرست', matches(item({ specs: { volt: '24 V' } }), S({ specs: { volt: ['24 V', '48 V'] } })), true);
eq('مشخصه: قلم بدون آن مشخصه حذف', matches(item({ specs: {} }), S({ specs: { volt: ['24 V'] } })), false);
eq('بازه: بیشتر از سقف حذف', matches(item({ specs: { len: '۱۶ mm' } }), S({ ranges: { len: 10 } })), false);
// نبودِ داده دلیل ناسازگاری نیست — همان رفتار نوار کناری قبلی.
eq('بازه: قلم بدون مقدار حذف نمی‌شود', matches(item({ specs: {} }), S({ ranges: { len: 10 } })), true);

console.log('── فقط کالای اصل (۳ آذر ۱۴۰۵)');
eq('«فقط اصل» → اصلی می‌ماند، ثبت‌نشده حذف', [matches(item({ original: true }), S({ original: true })), matches(item({ original: false }), S({ original: true }))], [true, false]);
eq('خاموش → همه', matches(item({ original: false }), S({})), true);
eq('URL رفت‌وبرگشت orig=1', parseState(new URLSearchParams(toQuery(S({ original: true })))).original, true);
eq('orig=0 یا خراب ⇒ خاموش', [parseState(new URLSearchParams('orig=0')).original, parseState(new URLSearchParams('orig=yes')).original], [false, false]);

console.log('── بازه‌ی قیمت، جستجو در نتایج، تخفیف، کاتالوگ (۴ آذر ۱۴۰۵)');
eq('بازه: داخل/بیرون', [matches(item({ price: 500 }), S({ pmin: 100, pmax: 600 })), matches(item({ price: 700 }), S({ pmax: 600 })), matches(item({ price: 50 }), S({ pmin: 100 }))], [true, false, false]);
eq('بازه: کالای استعلامی بیرون', matches(item({ price: null }), S({ pmin: 0 })), false);
eq('بی بازه: استعلامی می‌ماند', matches(item({ price: null }), S({})), true);
eq('money: ارقام فارسی و جداکننده', [money('۱۲٬۵۰۰٬۰۰۰'), money('12,500'), money(' 300 ')], [12500000, 12500, 300]);
eq('money: خراب/منفی/خالی ⇒ null', [money('-5'), money('abc'), money(''), money(null), money('1e9')], [null, null, null, null, null]);
eq('جستجو: کد بی خط تیره و ارقام فارسی', [matches(item({ text: 'ریموت SAGA1-L10' }), S({ q: 'saga1l10' })), matches(item({ text: 'ريموت ساگا' }), S({ q: 'ریموت' })), matches(item({ text: 'L12' }), S({ q: 'L10' }))], [true, true, false]);
eq('تخفیف و کاتالوگ', [matches(item({ discount: false }), S({ discount: true })), matches(item({ catalog: true }), S({ catalog: true }))], [false, true]);
const rt = parseState(new URLSearchParams(toQuery(S({ q: 'ساگا', pmin: 100, pmax: 900, discount: true, catalog: true }))));
eq('URL رفت‌وبرگشت', [rt.q, rt.pmin, rt.pmax, rt.discount, rt.catalog], ['ساگا', 100, 900, true, true]);
eq('URL خراب: pmin=abc ⇒ null', parseState(new URLSearchParams('pmin=abc&pmax=-1')).pmin, null);

console.log('── دسته (آرشیو /products/ — فاز ۳)');
eq('دسته: هرکدام از انتخاب‌ها', [matches(item({ categories: ['remote-control', 'x'] }), S({ cats: ['remote-control'] })), matches(item({ categories: ['brake'] }), S({ cats: ['remote-control'] }))], [true, false]);

console.log('── مرتب‌سازی');
const p = (price: number | null, modified = '') => item({ price, modified });
const order = (mode: FilterState['sort'], list: ItemData[]) => [...list].sort((a, b) => compareItems(a, b, mode)).map((i) => i.price ?? 'rfq');
// ⚠️ قلم استعلامی (بی‌قیمت) همیشه آخر — چه صعودی چه نزولی؛ صفر حساب‌کردنش «ارزان‌ترین» را پر از استعلامی می‌کرد.
eq('ارزان‌ترین، استعلامی آخر', order('cheapest', [p(null), p(300), p(100)]), [100, 300, 'rfq']);
eq('گران‌ترین، استعلامی آخر', order('expensive', [p(null), p(100), p(300)]), [300, 100, 'rfq']);
eq('جدیدترین', [...[p(1, '2026-01'), p(2, '2026-09')]].sort((a, b) => compareItems(a, b, 'newest')).map((i) => i.price), [2, 1]);
eq('مرتبط‌ترین = ترتیب اصلی', order('relevant', [p(300), p(100)]), [300, 100]);

console.log('── URL (دوطرفه)');
const st = S({ stock: 'rfq', brands: ['saga', 'demag'], cats: ['remote-control'], specs: { volt: ['24 V', 'AC/DC, 48'] }, ranges: { len: 12.5 }, view: 'list', sort: 'cheapest' });
const q = toQuery(st);
eq('رفت و برگشت بدون از دست رفتن', parseState(new URLSearchParams(q)), st);
eq('حالت پیش‌فرض = پرس‌وجوی خالی (URL تمیز)', toQuery(EMPTY), '');
eq('مقدار ناشناخته‌ی stock نادیده', parseState(new URLSearchParams('stock=xyz')).stock, 'all');
// ⚠️ پیش‌فرض «کارت» است (کارفرما، ۳ آبان ۱۴۰۵): نمای کارت در URL نمی‌آید، جدول می‌آید (view=list).
eq('پیش‌فرض نما = grid', EMPTY.view, 'grid');
eq('view ناشناخته = grid', parseState(new URLSearchParams('view=table')).view, 'grid');
eq('view=list → جدول', parseState(new URLSearchParams('view=list')).view, 'list');
// پیوند قدیمی ?view=grid (وقتی جدول پیش‌فرض بود) همچنان کارت باز می‌کند.
eq('سازگاری: view=grid → کارت', parseState(new URLSearchParams('view=grid')).view, 'grid');
eq('کارت در URL نمی‌آید', toQuery(S({ view: 'grid' })), '');
eq('جدول در URL می‌آید', toQuery(S({ view: 'list' })), 'view=list');
eq('max_ غیرعددی نادیده', parseState(new URLSearchParams('max_len=abc')).ranges, {});
// پیوندهای قدیمی آرشیو (پیش از فاز ۳) که کسی برای همکارش فرستاده نباید بشکنند.
eq('سازگاری: brand=a,b و cat=x,y و stock=1', (({ brands, cats, stock }) => ({ brands, cats, stock }))(parseState(new URLSearchParams('brand=saga,demag&cat=a,b&stock=1'))), { brands: ['saga', 'demag'], cats: ['a', 'b'], stock: 'in' });
eq('sort ناشناخته = relevant', parseState(new URLSearchParams('sort=zzz')).sort, 'relevant');

if (failed) {
  console.error(`\n❌ ${failed} آزمون فیلتر دسته شکست خورد.`);
  process.exit(1);
}
console.log('\n✅ همه‌ی آزمون‌های فیلتر دسته گذشت.');
