// src/components/catalog-presence.ts
// ---------------------------------------------------------------------------
// «کاتالوگ صادق» (Frontend v2، تصمیم D — docs/frontend-v2.md §2 اصل ۶): کدام گروه، دسته و برند واقعاً محصول دارد.
// یک منبع برای ناوبری هدر، فوتر، صفحه‌ی اصلی و فهرست /search/ — چهار نسخه از این شمارش یعنی روزی که منو دسته‌ای
// را نشان دهد که صفحه‌ی اصلی پنهان کرده.
//
// ⚠️ محصول نمایشی (DEMO-) شمرده نمی‌شود: دسته‌ای که فقط محصول نمایشی دارد، برای خریدار خالی است.
// ⚠️ معیار «محصول دارد» است، نه «ایندکس‌پذیر است» (categoryReadiness): تصمیم D درباره‌ی چیزی است که خریدار
// می‌بیند. 📌 وقتی INDEX_EMPTY_CATEGORIES=1 روشن شد، دسته‌های بی‌محصولِ ایندکس‌پذیر از ناوبری بی‌لینک می‌مانند —
// پیش از انتشار با کارفرما مرور شود (backlog).
// یک‌بار در هر build محاسبه می‌شود (Promise ماژول) — Header روی هر صفحه صدایش می‌زند.
// ---------------------------------------------------------------------------
import { getAllProducts } from '../lib/wp';
import { SILOS, BRANDS, type Silo, type Category } from '../data/taxonomy';

export interface PresentSilo {
  silo: Silo;
  categories: { category: Category; count: number }[];
  count: number;
}

export interface CatalogPresence {
  silos: PresentSilo[];
  categoryCount: number;
  brands: { brand: (typeof BRANDS)[number]; count: number }[];
  /** همه‌ی دسته‌ها/برندهای تاکسونومی — برای جمله‌ی صادقانه‌ی «X از Y». */
  totalCategories: number;
}

let presence: Promise<CatalogPresence> | null = null;

export function getCatalogPresence(): Promise<CatalogPresence> {
  return (presence ??= (async () => {
    const products = (await getAllProducts()).filter((p) => !p.isDemo);
    const byCategory = new Map<string, number>();
    const byBrand = new Map<string, number>();
    for (const p of products) {
      for (const slug of new Set(p.categorySlugs)) byCategory.set(slug, (byCategory.get(slug) ?? 0) + 1);
      if (p.brandSlug) byBrand.set(p.brandSlug, (byBrand.get(p.brandSlug) ?? 0) + 1);
    }
    const silos = SILOS.map((silo) => {
      const categories = silo.categories
        .map((category) => ({ category, count: byCategory.get(category.slug) ?? 0 }))
        .filter((c) => c.count > 0);
      return { silo, categories, count: categories.reduce((n, c) => n + c.count, 0) };
    }).filter((s) => s.categories.length > 0);
    return {
      silos,
      categoryCount: silos.reduce((n, s) => n + s.categories.length, 0),
      brands: BRANDS.filter((b) => byBrand.has(b.slug)).map((brand) => ({ brand, count: byBrand.get(brand.slug)! })),
      totalCategories: SILOS.reduce((n, s) => n + s.categories.length, 0),
    };
  })());
}

/** ارقام فارسی برای شمار — «۳۱». */
export const fa = (n: number) => n.toLocaleString('fa-IR');
