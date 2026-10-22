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
}

export interface FilterState {
  stock: 'all' | 'in' | 'rfq';
  brands: string[];
  specs: Record<string, string[]>;
  ranges: Record<string, number>;
  view: 'list' | 'grid';
}

export const EMPTY: FilterState = { stock: 'all', brands: [], specs: {}, ranges: {}, view: 'list' };

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

export function parseState(p: URLSearchParams): FilterState {
  const stock = p.get('stock');
  const s: FilterState = {
    stock: stock === 'in' || stock === 'rfq' ? stock : 'all',
    brands: p.getAll('brand').filter(Boolean),
    specs: {},
    ranges: {},
    view: p.get('view') === 'grid' ? 'grid' : 'list',
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
  for (const [id, values] of Object.entries(s.specs)) for (const v of values) p.append(`f_${id}`, v);
  for (const [id, n] of Object.entries(s.ranges)) p.set(`max_${id}`, String(n));
  if (s.view === 'grid') p.set('view', 'grid');
  return p.toString();
}
