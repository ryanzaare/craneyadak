// src/lib/filter-attrs.ts — صفت‌های داده‌ی هر کارت/ردیف برای فیلتر سمت کلاینت (CategoryFilterBar)
// ---------------------------------------------------------------------------
// ⚠️ یک تابع برای صفحه‌ی دسته و آرشیو /products/ (۳ آذر ۱۴۰۵). پیش از این هر صفحه نسخه‌ی خودش را داشت و از هم
// جدا شده بودند: صفحه‌ی دسته data-price و data-modified نداشت (مرتب‌سازی آنجا بی‌اثر می‌ماند) و آرشیو data-spec
// نداشت. ⚠️ هر محصول دو بار در DOM است (نمای جدول و کارت)؛ شمار نتیجه با data-slug یکتا می‌شود.
// ---------------------------------------------------------------------------
import { specValue, type ResolvedFacet } from '../data/filters';
import { computePrice, type CraneProduct } from './wp';

export function filterAttrs(p: CraneProduct, facets: ResolvedFacet[]): Record<string, string> {
  const price = computePrice(p);
  const attrs: Record<string, string> = {
    'data-cat-item': '',
    'data-slug': p.slug,
    'data-brand': p.brandSlug ?? '',
    'data-categories': p.categorySlugs.join(' '),
    'data-stock': p.stockStatus,
    // «دارای قیمت» از قیمت *موثر* (با تخفیف فعال)، نه از buyMode — computePrice تنها مرجع قیمت است.
    'data-priced': price.payable ? '1' : '0',
    'data-price': price.payable && price.effective !== null ? String(price.effective) : '',
    'data-modified': p.modified ?? '',
    // فقط «اصلی» ثبت‌شده؛ ثبت‌نشده هرگز اصل حساب نمی‌شود (ادعای اصالت باید صریح باشد).
    'data-original': p.authenticity === 'original' ? '1' : '0',
  };
  for (const f of facets) {
    const raw = specValue(p, f.specLabel);
    if (raw) attrs[`data-spec-${f.id}`] = raw;
  }
  return attrs;
}
