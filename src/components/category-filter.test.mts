// src/components/category-filter.test.mts — npm run test:catfilter
// فیلتر صفحه‌ی دسته (Frontend v2، فاز ۲ — تصمیم ۲ کارفرما، docs/frontend-v2.md §10): چیپ‌های «همه / موجود /
// استعلامی» + برند + مشخصه، ترکیب‌پذیر و در URL. ورودی خراب عمداً هست (قاعده‌ی ۶)؛ پیش از پیاده‌سازی، روی
// stub قرمز دیده شد.
import { matches, parseState, toQuery, EMPTY, type FilterState, type ItemData } from './category-filter.ts';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};

const item = (o: Partial<ItemData>): ItemData => ({ stock: 'in_stock', priced: false, brand: 'saga', specs: {}, ...o });
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

console.log('── URL (دوطرفه)');
const st = S({ stock: 'rfq', brands: ['saga', 'demag'], specs: { volt: ['24 V', 'AC/DC, 48'] }, ranges: { len: 12.5 }, view: 'grid' });
const q = toQuery(st);
eq('رفت و برگشت بدون از دست رفتن', parseState(new URLSearchParams(q)), st);
eq('حالت پیش‌فرض = پرس‌وجوی خالی (URL تمیز)', toQuery(EMPTY), '');
eq('مقدار ناشناخته‌ی stock نادیده', parseState(new URLSearchParams('stock=xyz')).stock, 'all');
eq('view ناشناخته = list', parseState(new URLSearchParams('view=table')).view, 'list');
eq('max_ غیرعددی نادیده', parseState(new URLSearchParams('max_len=abc')).ranges, {});

if (failed) {
  console.error(`\n❌ ${failed} آزمون فیلتر دسته شکست خورد.`);
  process.exit(1);
}
console.log('\n✅ همه‌ی آزمون‌های فیلتر دسته گذشت.');
