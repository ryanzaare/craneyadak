// src/scripts/baskets.test.mts
// ---------------------------------------------------------------------------
// آزمون قاعده‌ی «دو سبد، هرگز مخلوط» (src/scripts/baskets.ts).
// هر بررسی برای یک شکستِ مشخص است؛ با جهش سنجیده شده که واقعاً می‌شکند.
// ---------------------------------------------------------------------------
import {
  addToCart,
  addToQuote,
  BASKET_KEYS,
  isExpired,
  moveToQuote,
  readBasket,
  setQty,
  sweepExpiredCart,
  type KeyValueStore,
} from './baskets.ts';

let failed = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failed++;
    console.error(`  ✗ ${label}${detail ? `  → ${detail}` : ''}`);
  }
};

const mem = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

const DAY = 86_400_000;
const now = new Date(1_790_000_000_000);
const future = new Date(now.getTime() + 3 * DAY).toISOString();
const past = new Date(now.getTime() - 1000).toISOString();
const item = (slug: string, mode: 'cart' | 'rfq', validUntil: string | null = future) => ({
  slug,
  name: `قطعه ${slug}`,
  sku: '',
  mode,
  validUntil,
});
const slugs = (s: KeyValueStore, k: 'cart' | 'quote') => readBasket(s, k).map((x) => x.slug).join(',');

console.log('\n── isExpired: پیش‌فرض امن ──');
ok(isExpired(null, now), 'بدون تاریخ = منقضی');
ok(isExpired('نامعتبر', now), 'تاریخ نامعتبر = منقضی');
ok(isExpired(past, now), 'گذشته = منقضی');
ok(!isExpired(future, now), 'آینده = معتبر');
ok(isExpired(now.toISOString(), now), 'همان لحظه = منقضی (مرز بسته، مثل سرور)');

console.log('\n── قلم استعلامی هرگز وارد سبد خرید نمی‌شود ──');
let s = mem();
ok(addToCart(s, item('a', 'rfq'), now) === 'quote', 'addToCart با rfq → سبد استعلام');
ok(slugs(s, 'cart') === '' && slugs(s, 'quote') === 'a', 'سبد خرید خالی ماند', `cart=${slugs(s, 'cart')}`);

s = mem();
ok(addToCart(s, item('b', 'cart', past), now) === 'quote', 'قیمت منقضی → سبد استعلام');
ok(slugs(s, 'cart') === '', 'منقضی وارد سبد خرید نشد');
ok(readBasket(s, 'quote')[0]?.mode === 'rfq', 'در سبد استعلام با mode=rfq');

s = mem();
ok(addToCart(s, item('c', 'cart'), now) === 'cart' && slugs(s, 'cart') === 'c', 'قلم پرداخت‌پذیر → سبد خرید');
addToCart(s, item('c', 'cart'), now);
ok(slugs(s, 'cart') === 'c', 'افزودن دوباره تکرار نمی‌سازد');

console.log('\n── داده‌ی دست‌کاری‌شده در localStorage ──');
s = mem();
s.setItem(BASKET_KEYS.cart, JSON.stringify([item('x', 'rfq'), item('y', 'cart'), { slug: '' }, 'زباله', item('y', 'cart')]));
ok(slugs(s, 'cart') === 'y', 'خواندن سبد خرید: rfq، بی‌اسلاگ، زباله و تکراری حذف', slugs(s, 'cart'));
s.setItem(BASKET_KEYS.quote, '{خراب');
ok(readBasket(s, 'quote').length === 0, 'JSON خراب = سبد خالی، نه استثنا');
s.setItem(BASKET_KEYS.quote, JSON.stringify([{ ...item('q', 'rfq'), qty: -5 }, { ...item('r', 'rfq'), qty: 1e9 }]));
const q = readBasket(s, 'quote');
ok(q[0]?.qty === 1 && q[1]?.qty === 9999, 'تعداد به ۱..۹۹۹۹ بریده می‌شود', q.map((x) => x.qty).join(','));

console.log('\n── انتقال به سبد استعلام ──');
s = mem();
addToCart(s, item('m1', 'cart'), now);
addToCart(s, item('m2', 'cart'), now);
setQty(s, 'cart', 'm1', 7);
const moved = moveToQuote(s, ['m1']);
ok(moved.length === 1 && slugs(s, 'cart') === 'm2' && slugs(s, 'quote') === 'm1', 'm1 منتقل شد، m2 ماند');
ok(readBasket(s, 'quote')[0]?.qty === 7, 'تعداد با انتقال حفظ شد — انتخاب کاربر از دست نمی‌رود');

s = mem();
addToQuote(s, { ...item('dup', 'rfq'), qty: 2 });
addToCart(s, item('dup', 'cart'), now);
moveToQuote(s, ['dup']);
ok(slugs(s, 'quote') === 'dup' && readBasket(s, 'quote')[0]?.qty === 2, 'قلمی که در سبد استعلام هست تکرار نمی‌شود');

s = mem();
addToCart(s, item('soon', 'cart', new Date(now.getTime() + 60_000).toISOString()), now);
addToCart(s, item('later', 'cart'), now);
ok(sweepExpiredCart(s, now).length === 0, 'پیش از انقضا: جارو چیزی نمی‌برد');
const later = new Date(now.getTime() + 120_000);
const swept = sweepExpiredCart(s, later);
ok(swept.map((x) => x.slug).join() === 'soon' && slugs(s, 'cart') === 'later' && slugs(s, 'quote') === 'soon', 'پس از انقضا: فقط قلم منقضی به استعلام رفت');

if (failed) {
  console.error(`\n❌ ${failed} آزمون سبد شکست خورد.`);
  process.exit(1);
}
console.log('\n✅ همه‌ی آزمون‌های سبد گذشت.\n');
