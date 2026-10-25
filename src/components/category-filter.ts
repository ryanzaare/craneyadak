// src/components/category-filter.ts
// ---------------------------------------------------------------------------
// منطق خالص فیلتر صفحه‌ی دسته (Frontend v2، فاز ۲ — تصمیم ۲ کارفرما): تطبیق یک قلم با وضعیت فیلتر و رفت‌وبرگشت
// وضعیت با URL. خالص و بی‌import تا هم آزمون Node (category-filter.test.mts) و هم اسکریپت CategoryFilterBar
// همین را اجرا کنند.
//
// قاعده‌ی ترکیب: داخل هر گروه OR (دو برند = هرکدام)، بین گروه‌ها AND (برند و موجودی و مشخصه).
// ⚠️ «استعلامی» یعنی «قیمت پرداخت‌پذیر ندارد»، نه «ناموجود»: قلمی می‌تواند موجود در انبار و هم‌زمان استعلامی
// باشد (SAGA1-L12، قیمت منقضی). چیپ‌ها پالایه‌اند، نه افراز.
// URL: پرس‌وجوی تکراری (brand=a&brand=b) به‌جای «a,b» — مقدار مشخصه خودش ویرگول دارد («AC/DC, 48»).
// ---------------------------------------------------------------------------

export interface ItemData {
  stock: string;
  priced: boolean;
  brand: string;
  specs: Record<string, string>;
  /** اسلاگ دسته‌ها — فقط آرشیو /products/ فیلتر دسته دارد (فاز ۳). */
  categories: string[];
  /** قیمت پرداخت‌پذیر برای مرتب‌سازی؛ null = استعلامی. */
  price: number | null;
  /** تاریخ ISO آخرین ویرایش برای «جدیدترین». */
  modified: string;
}

export type SortMode = 'relevant' | 'newest' | 'cheapest' | 'expensive';
const SORTS: SortMode[] = ['relevant', 'newest', 'cheapest', 'expensive'];

export interface FilterState {
  stock: 'all' | 'in' | 'rfq';
  brands: string[];
  specs: Record<string, string[]>;
  ranges: Record<string, number>;
  view: 'list' | 'grid';
  cats: string[];
  sort: SortMode;
}

// ⚠️ نمای پیش‌فرض «کارت» (کارفرما، ۳ آبان ۱۴۰۵): ردیف جدولی برای ویترین فروشگاه کوچک بود. پس فقط جدول در URL می‌آید.
export const EMPTY: FilterState = { stock: 'all', brands: [], specs: {}, ranges: {}, view: 'grid', cats: [], sort: 'relevant' };

/** اولین عدد یک مقدار مشخصه، با ارقام فارسی/عربی — «۱۶ mm» → 16. */
export function firstNumber(raw: string): number | null {
  const m = raw
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/,/g, '')
    .match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function matches(item: ItemData, s: FilterState): boolean {
  if (s.stock === 'in' && item.stock !== 'in_stock') return false;
  if (s.stock === 'rfq' && item.priced) return false;
  if (s.brands.length && !s.brands.includes(item.brand)) return false;
  if (s.cats.length && !s.cats.some((c) => item.categories.includes(c))) return false;
  for (const [id, values] of Object.entries(s.specs)) {
    if (values.length && !values.includes(item.specs[id] ?? '')) return false;
  }
  for (const [id, max] of Object.entries(s.ranges)) {
    const raw = item.specs[id];
    // نبودِ داده دلیل ناسازگاری نیست — قلم بدون این مشخصه با اسلایدر حذف نمی‌شود.
    if (!raw) continue;
    const v = firstNumber(raw);
    if (v !== null && v > max) return false;
  }
  return true;
}

/** «a,b» و تکرار پارامتر هر دو — پیوندهای قدیمی آرشیو ویرگولی بودند. */
const many = (p: URLSearchParams, k: string) => p.getAll(k).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);

/**
 * ⚠️ مرتب‌سازی پایدار با «استعلامی همیشه آخر»: قلم بی‌قیمت اگر صفر حساب شود، «ارزان‌ترین» را پر از استعلامی
 * می‌کند و مرتب‌سازی بی‌معنا می‌شود. «مرتبط‌ترین» = ترتیب build (۰).
 */
export function compareItems(a: ItemData, b: ItemData, mode: SortMode): number {
  if (mode === 'newest') return b.modified.localeCompare(a.modified);
  if (mode === 'cheapest' || mode === 'expensive') {
    if (a.price === null && b.price === null) return 0;
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return mode === 'cheapest' ? a.price - b.price : b.price - a.price;
  }
  return 0;
}

export function parseState(p: URLSearchParams): FilterState {
  const stock = p.get('stock');
  const sort = p.get('sort') as SortMode | null;
  const s: FilterState = {
    // stock=1 = پیوند قدیمی آرشیو («فقط موجود»).
    stock: stock === 'in' || stock === '1' ? 'in' : stock === 'rfq' ? 'rfq' : 'all',
    brands: many(p, 'brand'),
    specs: {},
    ranges: {},
    view: p.get('view') === 'list' ? 'list' : 'grid',
    cats: many(p, 'cat'),
    sort: sort && SORTS.includes(sort) ? sort : 'relevant',
  };
  for (const [k, v] of p) {
    if (k.startsWith('f_') && v) (s.specs[k.slice(2)] ??= []).push(v);
    if (k.startsWith('max_')) {
      const n = Number(v);
      if (v !== '' && Number.isFinite(n)) s.ranges[k.slice(4)] = n;
    }
  }
  return s;
}

/** پرس‌وجو بدون «?». وضعیت پیش‌فرض = رشته‌ی خالی تا URL قابل اشتراک تمیز بماند. */
export function toQuery(s: FilterState): string {
  const p = new URLSearchParams();
  if (s.stock !== 'all') p.set('stock', s.stock);
  for (const b of s.brands) p.append('brand', b);
  for (const c of s.cats) p.append('cat', c);
  for (const [id, values] of Object.entries(s.specs)) for (const v of values) p.append(`f_${id}`, v);
  for (const [id, n] of Object.entries(s.ranges)) p.set(`max_${id}`, String(n));
  if (s.view === 'list') p.set('view', 'list');
  if (s.sort !== 'relevant') p.set('sort', s.sort);
  return p.toString();
}
