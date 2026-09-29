// src/scripts/baskets.ts
// ---------------------------------------------------------------------------
// دو سبد جدا: «سبد خرید» (پرداخت آنلاین) و «سبد استعلام» (پیش‌فاکتور).
// منطق خالص، بدون DOM — تا در Node آزموده شود (baskets.test.mts).
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا دو سبد، هرگز مخلوط (تصمیم مدیرعامل، ایست ۲)
// ═══════════════════════════════════════════════════════════════════════════
// سبد مخلوط یعنی مبلغی که نیمی قطعی و نیمی نامعلوم است — نه می‌شود
// پرداختش کرد، نه پیش‌فاکتورش «قیمت قطعی» دارد. پس قاعده این است:
//
//   • قلم استعلامی (mode = 'rfq') هرگز وارد سبد خرید نمی‌شود.
//   • قلمی که اعتبار قیمتش گذشته، در سبد خرید نمی‌ماند؛ به سبد استعلام
//     منتقل می‌شود (نه حذف — انتخاب کاربر از دست نمی‌رود).
//   • قلم قیمت‌دار *می‌تواند* در سبد استعلام باشد: دکمه‌ی «دریافت
//     پیش‌فاکتور» برای خریداری است که پیش از پرداخت، تأیید داخلی می‌خواهد.
//
// ⚠️ این‌ها راحتی کاربرند، نه امنیت. سبد در localStorage است و کاربر
// می‌تواند آزادانه ویرایشش کند. مرجع نهایی «پرداخت‌پذیر بودن» فقط سرور
// است (cyh_product_pricing) — و قیمت هرگز از این‌جا به سرور نمی‌رود.
// ---------------------------------------------------------------------------

export type BasketKind = 'cart' | 'quote';

export interface BasketItem {
  slug: string;
  name: string;
  sku: string;
  qty: number;
  /** مسیر خرید در لحظه‌ی افزودن، از صفحه‌ی استاتیک. سرور دوباره می‌سنجد. */
  mode: 'cart' | 'rfq';
  /** پایان اعتبار قیمت (ISO). فقط برای قلم قیمت‌دار؛ محافظ مرورگر از آن می‌خواند. */
  validUntil: string | null;
}

/* ⚠️ کلید سبد استعلام همان کلید قدیمی است — سبد کاربران فعلی نمی‌پرد. */
export const BASKET_KEYS: Record<BasketKind, string> = {
  cart: 'cy-cart-v1',
  quote: 'cy-quote-v1',
};

/** رویداد window پس از هر نوشتن — هدر، کشوها و دکمه‌ها با آن هم‌گام می‌شوند. */
export const BASKET_EVENT = 'cy-baskets-change';

export const MAX_QTY = 9999;
/** همان سقف سرور (class-quote-requests.php) — بیشترش آنجا بریده می‌شود. */
export const MAX_ITEMS = 50;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * قیمت منقضی است؟ نبودِ تاریخ یا تاریخ نامعتبر = منقضی.
 * ⚠️ پیش‌فرض امن: «نمی‌دانم» یعنی پرداخت‌پذیر نیست — همان قاعده‌ی سرور
 * (بدون price_updated_at = منقضی).
 */
export function isExpired(validUntil: string | null | undefined, now: Date = new Date()): boolean {
  if (!validUntil) return true;
  const t = Date.parse(validUntil);
  return Number.isNaN(t) || t <= now.getTime();
}

function clampQty(raw: unknown): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.max(1, Math.min(MAX_QTY, n)) : 1;
}

function normalize(raw: unknown): BasketItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const slug = typeof r.slug === 'string' ? r.slug.trim() : '';
  if (!slug) return null;
  return {
    slug,
    name: typeof r.name === 'string' ? r.name : slug,
    sku: typeof r.sku === 'string' ? r.sku : '',
    qty: clampQty(r.qty ?? 1),
    mode: r.mode === 'cart' ? 'cart' : 'rfq',
    validUntil: typeof r.validUntil === 'string' ? r.validUntil : null,
  };
}

/**
 * خواندن سبد. داده‌ی خراب = سبد خالی، نه استثنا.
 * ⚠️ سبد خرید فقط قلم 'cart' برمی‌گرداند — حتی اگر کسی دستی قلم استعلامی
 * در localStorage گذاشته باشد. قاعده‌ی «هرگز مخلوط» در خواندن هم برقرار است.
 */
export function readBasket(store: KeyValueStore, kind: BasketKind): BasketItem[] {
  let list: unknown;
  try {
    const raw = store.getItem(BASKET_KEYS[kind]);
    list = raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: BasketItem[] = [];
  for (const raw of list) {
    const item = normalize(raw);
    if (!item || seen.has(item.slug)) continue;
    if (kind === 'cart' && item.mode !== 'cart') continue;
    seen.add(item.slug);
    out.push(item);
  }
  return out.slice(0, MAX_ITEMS);
}

export function writeBasket(store: KeyValueStore, kind: BasketKind, list: BasketItem[]): void {
  try {
    store.setItem(BASKET_KEYS[kind], JSON.stringify(list.slice(0, MAX_ITEMS)));
  } catch {
    /* حالت ناشناس/حافظه‌ی پر: سبد در همین صفحه کار می‌کند حتی اگر نماند. */
  }
}

function upsert(list: BasketItem[], item: BasketItem): BasketItem[] {
  return list.some((x) => x.slug === item.slug) ? list : [...list, item];
}

export function addToQuote(store: KeyValueStore, item: Omit<BasketItem, 'qty'> & { qty?: number }): void {
  const clean = normalize(item);
  if (!clean) return;
  writeBasket(store, 'quote', upsert(readBasket(store, 'quote'), clean));
}

/**
 * افزودن به سبد خرید — یا، اگر قلم دیگر پرداخت‌پذیر نیست، به سبد استعلام.
 * مقدار بازگشتی می‌گوید قلم واقعاً کجا رفت تا رابط کاربری همان کشو را باز کند.
 */
export function addToCart(
  store: KeyValueStore,
  item: Omit<BasketItem, 'qty'> & { qty?: number },
  now: Date = new Date(),
): BasketKind {
  const clean = normalize(item);
  if (!clean) return 'cart';
  if (clean.mode !== 'cart' || isExpired(clean.validUntil, now)) {
    addToQuote(store, { ...clean, mode: 'rfq' });
    return 'quote';
  }
  writeBasket(store, 'cart', upsert(readBasket(store, 'cart'), clean));
  return 'cart';
}

export function removeItem(store: KeyValueStore, kind: BasketKind, slug: string): void {
  writeBasket(store, kind, readBasket(store, kind).filter((x) => x.slug !== slug));
}

export function setQty(store: KeyValueStore, kind: BasketKind, slug: string, qty: unknown): void {
  writeBasket(
    store,
    kind,
    readBasket(store, kind).map((x) => (x.slug === slug ? { ...x, qty: clampQty(qty) } : x)),
  );
}

/**
 * انتقال اقلام نام‌برده از سبد خرید به سبد استعلام، با همان تعداد.
 * برای دو حالت: (۱) قیمت در مرورگر منقضی شد؛ (۲) سرور هنگام پرداخت گفت
 * این قلم دیگر پرداخت‌پذیر نیست (تصمیم کارفرما: جابه‌جایی خودکار با پیام).
 * اگر قلم از قبل در سبد استعلام هست، تکرار نمی‌شود.
 */
export function moveToQuote(store: KeyValueStore, slugs: string[]): BasketItem[] {
  const wanted = new Set(slugs);
  const cart = readBasket(store, 'cart');
  const moving = cart.filter((x) => wanted.has(x.slug));
  if (moving.length === 0) return [];
  let quote = readBasket(store, 'quote');
  for (const item of moving) quote = upsert(quote, { ...item, mode: 'rfq' });
  writeBasket(store, 'quote', quote);
  writeBasket(store, 'cart', cart.filter((x) => !wanted.has(x.slug)));
  return moving;
}

/** اقلام منقضی سبد خرید را به سبد استعلام می‌برد و فهرستشان را برمی‌گرداند. */
export function sweepExpiredCart(store: KeyValueStore, now: Date = new Date()): BasketItem[] {
  const expired = readBasket(store, 'cart').filter((x) => isExpired(x.validUntil, now));
  return moveToQuote(store, expired.map((x) => x.slug));
}

/**
 * localStorage با محافظ. ⚠️ خودِ *دسترسی* به window.localStorage در بعضی
 * مرورگرها (کوکی بسته) استثنا پرتاب می‌کند، نه فقط getItem. بدون این،
 * یک تنظیم حریم خصوصی کل جاوااسکریپت صفحه را می‌خواباند.
 */
export function browserStore(): KeyValueStore {
  return {
    getItem(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* بالاتر: writeBasket */
      }
      window.dispatchEvent(new CustomEvent(BASKET_EVENT));
    },
  };
}
