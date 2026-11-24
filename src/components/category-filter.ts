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
  /** اصالت ثبت‌شده‌ی «اصلی» در وردپرس. ثبت‌نشده = false (ادعای اصالت باید صریح باشد). */
  original: boolean;
  /** نام + کد فنی، برای «جستجو در نتایج». */
  text: string;
  /** تخفیف فعال و پرداخت‌پذیر. */
  discount: boolean;
  /** کاتالوگ/دفترچه‌ی PDF پیوندشده در وردپرس دارد. */
  catalog: boolean;
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
  /** «فقط کالای اصل» (کارفرما ۳ آذر ۱۴۰۵، الگوی دیجی‌کالا). */
  original: boolean;
  /** «جستجو در نتایج» (۴ آذر ۱۴۰۵). */
  q: string;
  /** بازه‌ی قیمت (تومان، قیمت موثر). null = بی‌حد. */
  pmin: number | null;
  pmax: number | null;
  discount: boolean;
  catalog: boolean;
}

// ⚠️ نمای پیش‌فرض «کارت» (کارفرما، ۳ آبان ۱۴۰۵): ردیف جدولی برای ویترین فروشگاه کوچک بود. پس فقط جدول در URL می‌آید.
export const EMPTY: FilterState = {
  stock: 'all', brands: [], specs: {}, ranges: {}, view: 'grid', cats: [], sort: 'relevant', original: false,
  q: '', pmin: null, pmax: null, discount: false, catalog: false,
};

/** یکسان‌سازی جستجو: ی/ک عربی، ارقام فارسی، نیم‌فاصله/فاصله/خط تیره — «SAGA1L10» همان «SAGA1-L10». */
export function normText(s: string): string {
  return s.toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u200c\s_\-\u2011]+/g, '');
}

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
  if (s.original && !item.original) return false;
  if (s.discount && !item.discount) return false;
  if (s.catalog && !item.catalog) return false;
  if (s.q && !normText(item.text).includes(normText(s.q))) return false;
  // ⚠️ بازه‌ی قیمت: کالای استعلامی (بی‌قیمت) بیرون می‌ماند — قیمتی ندارد که در بازه باشد؛ همان رفتار دیجی‌کالا.
  if ((s.pmin !== null || s.pmax !== null) && item.price === null) return false;
  if (s.pmin !== null && item.price !== null && item.price < s.pmin) return false;
  if (s.pmax !== null && item.price !== null && item.price > s.pmax) return false;
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

/** مبلغ از URL یا ورودی کاربر: ارقام فارسی و جداکننده‌ی هزارگان پذیرفته؛ منفی/خراب/خالی = null. */
export function money(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const t = String(raw).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٬,\s]/g, '');
  if (!/^\d{1,13}$/.test(t)) return null;
  return Number(t);
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
    original: p.get('orig') === '1',
    q: (p.get('q') ?? '').trim().slice(0, 80),
    pmin: money(p.get('pmin')),
    pmax: money(p.get('pmax')),
    discount: p.get('disc') === '1',
    catalog: p.get('doc') === '1',
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
  if (s.original) p.set('orig', '1');
  if (s.discount) p.set('disc', '1');
  if (s.catalog) p.set('doc', '1');
  if (s.q) p.set('q', s.q);
  if (s.pmin !== null) p.set('pmin', String(s.pmin));
  if (s.pmax !== null) p.set('pmax', String(s.pmax));
  for (const b of s.brands) p.append('brand', b);
  for (const c of s.cats) p.append('cat', c);
  for (const [id, values] of Object.entries(s.specs)) for (const v of values) p.append(`f_${id}`, v);
  for (const [id, n] of Object.entries(s.ranges)) p.set(`max_${id}`, String(n));
  if (s.view === 'list') p.set('view', 'list');
  if (s.sort !== 'relevant') p.set('sort', s.sort);
  return p.toString();
}
