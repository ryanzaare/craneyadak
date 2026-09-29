// src/lib/pricing.test.mts
// ---------------------------------------------------------------------------
// آزمون computePrice — **همان موارد مرزیِ** بررسی‌های ۳۹ تا ۵۱ هارنس PHP
// (wordpress-plugin/wp-stub-harness.php، cyh_product_pricing).
//
// چرا دو آزمون با موارد یکسان: صفحه‌ی استاتیک قیمت را با این تابع نشان
// می‌دهد و سرور با PHP کسر می‌کند. اگر یکی تغییر کند و دیگری نه، مشتری
// یک عدد می‌بیند و عدد دیگری پرداخت می‌کند. هر مورد تازه‌ای که به یکی
// اضافه شود، باید به دیگری هم اضافه شود.
// ---------------------------------------------------------------------------
import { computePrice, saleBoundary, schemaPriceValidUntil, type PricingInput } from './pricing.ts';

let failed = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failed++;
    console.error(`  ✗ ${label}${detail ? `  → ${detail}` : ''}`);
  }
};

const DAY = 86_400_000;
const now = new Date(1_790_000_000_000);
const tehranYmd = (ms: number) => new Date(ms + 3.5 * 3600_000).toISOString().slice(0, 10);
const iso = (ms: number) => new Date(ms).toISOString();

/** قیمتی که «daysAgo» روز پیش تأیید شده، با اعتبار ۱۰ روزه. */
const mk = (over: Partial<PricingInput>, daysAgo: number | null = 1): PricingInput => ({
  buyMode: 'cart',
  stockStatus: 'in_stock',
  price: null,
  salePrice: null,
  saleStart: null,
  saleEnd: null,
  priceUpdatedAt: daysAgo === null ? null : iso(now.getTime() - daysAgo * DAY),
  priceValidUntil: daysAgo === null ? null : iso(now.getTime() - daysAgo * DAY + 10 * DAY),
  ...over,
});

console.log('\n── computePrice: همان موارد هارنس PHP ──');
const cases: [string, PricingInput, boolean, number | null, boolean][] = [
  // [برچسب, ورودی, payable, effective, onSale]
  ['استعلامی قیمت ندارد', mk({ buyMode: 'rfq', price: 1000 }), false, null, false],
  ['قیمت عادی، موجود، تازه', mk({ price: 5_000_000 }), true, 5_000_000, false],
  ['تخفیف در بازه', mk({ price: 5000, salePrice: 4000, saleStart: tehranYmd(now.getTime() - 3 * DAY), saleEnd: tehranYmd(now.getTime() + 3 * DAY) }), true, 4000, true],
  ['تخفیف ≥ قیمت عادی نادیده', mk({ price: 5000, salePrice: 6000 }), true, 5000, false],
  ['تخفیف منقضی (دیروز)', mk({ price: 5000, salePrice: 4000, saleEnd: tehranYmd(now.getTime() - DAY) }), true, 5000, false],
  ['روز آخر تخفیف هنوز معتبر', mk({ price: 5000, salePrice: 4000, saleEnd: tehranYmd(now.getTime()) }), true, 4000, true],
  ['تخفیف هنوز شروع نشده', mk({ price: 5000, salePrice: 4000, saleStart: tehranYmd(now.getTime() + 2 * DAY) }), true, 5000, false],
  ['فقط قیمت تخفیف', mk({ salePrice: 3000 }), true, 3000, false],
  ['بدون قیمت', mk({}), false, null, false],
  ['ناموجود — قیمت مرجع می‌ماند', mk({ price: 5000, stockStatus: 'on_order' }), false, 5000, false],
  ['بدون تاریخ قیمت = منقضی', mk({ price: 5000 }, null), false, 5000, false],
  ['۱۱ روز پیش = منقضی', mk({ price: 5000 }, 11), false, 5000, false],
  ['۹ روز پیش = معتبر', mk({ price: 5000 }, 9), true, 5000, false],
];
for (const [label, input, pay, eff, sale] of cases) {
  const r = computePrice(input, now);
  ok(r.payable === pay && r.effective === eff && r.onSale === sale, label, JSON.stringify({ payable: r.payable, effective: r.effective, onSale: r.onSale }));
}

console.log('\n── قلم مرجع: عدد هست، پیشنهاد فروش نیست ──');
const ref = computePrice(mk({ price: 5000, salePrice: 4000, stockStatus: 'on_order' }), now);
ok(ref.reference && ref.hasPrice, 'قلم ناموجود «مرجع» علامت می‌خورد');
ok(!ref.onSale && ref.previous === null && ref.discountPercent === null, 'تخفیف روی قلم غیرقابل‌خرید نمایش داده نمی‌شود');
ok(schemaPriceValidUntil(ref) === null, 'قلم مرجع priceValidUntil اسکیما ندارد');

console.log('\n── قالب تاریخ: همان سه قالب PHP ──');
const a = saleBoundary('2026-10-02', true)?.getTime();
ok(a !== undefined && a === saleBoundary('20261002', true)?.getTime(), 'Ymd و Y-m-d یک لحظه‌اند');
ok(a === saleBoundary('2026-10-02T00:00:00+00:00', true)?.getTime(), 'پیشوند ISO هم پذیرفته می‌شود');
ok(saleBoundary('نامعتبر', true) === null, 'ورودی نامعتبر = بدون محدودیت');

console.log('\n── priceValidUntil اسکیما: زودترینِ اعتبار و پایان تخفیف ──');
const saleSoon = computePrice(mk({ price: 5000, salePrice: 4000, saleEnd: tehranYmd(now.getTime() + 2 * DAY) }, 1), now);
ok(schemaPriceValidUntil(saleSoon) === tehranYmd(now.getTime() + 2 * DAY), 'پایان تخفیف زودتر است → همان روز', String(schemaPriceValidUntil(saleSoon)));
const plain = computePrice(mk({ price: 5000 }, 1), now);
ok(schemaPriceValidUntil(plain) === tehranYmd(now.getTime() + 9 * DAY), 'بدون تخفیف → پایان اعتبار قیمت', String(schemaPriceValidUntil(plain)));

if (failed) {
  console.error(`\n❌ ${failed} آزمون قیمت شکست خورد.`);
  process.exit(1);
}
console.log('\n✅ همه‌ی آزمون‌های قیمت گذشت.\n');
