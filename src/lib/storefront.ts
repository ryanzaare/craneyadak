// src/lib/storefront.ts
// ---------------------------------------------------------------------------
// انتخاب محصولات برای ویترین صفحه‌ی اصلی.
//
// مسئله‌ای که حل می‌کند: صفحه‌ی اصلی قبلی هیچ محصولی نشان نمی‌داد — فقط یک
// نوار جستجو. کاربر صنعتی که وارد می‌شد هیچ نشانه‌ای نمی‌دید که این‌جا
// واقعاً کالایی هست؛ حسِ «انبار خالی». اما راه‌حل، پرکردن صفحه با کارت‌های
// ساختگی نیست: اگر محصول واقعی وجود نداشته باشد، بخش اصلاً رندر نمی‌شود.
// ---------------------------------------------------------------------------
import { getAllProducts, computePrice, type CraneProduct } from './wp';

export interface StorefrontSections {
  /** اقلام دارای تخفیف واقعی و فعال. */
  onSale: CraneProduct[];
  /** اقلام موجود در انبار با قیمت واقعی — قابل خرید فوری. */
  inStock: CraneProduct[];
  /** جدیدترین اقلام بر اساس تاریخ به‌روزرسانی وردپرس. */
  latest: CraneProduct[];
  /** آیا اصلاً محصولی برای نمایش وجود دارد؟ */
  hasAny: boolean;
}

const LIMIT = 8;

function byModifiedDesc(a: CraneProduct, b: CraneProduct): number {
  const at = a.modified ? Date.parse(a.modified) : 0;
  const bt = b.modified ? Date.parse(b.modified) : 0;
  return bt - at;
}

/**
 * بخش‌های ویترین. هر بخش فقط محصولات واقعی دارد و اگر خالی باشد،
 * مصرف‌کننده آن را رندر نمی‌کند.
 */
export async function getStorefront(): Promise<StorefrontSections> {
  const all = await getAllProducts();

  const onSale = all.filter((p) => computePrice(p).onSale).sort(byModifiedDesc).slice(0, LIMIT);

  const inStock = all
    .filter((p) => p.stockStatus === 'in_stock' && computePrice(p).hasPrice)
    .filter((p) => !onSale.some((s) => s.slug === p.slug))
    .sort(byModifiedDesc)
    .slice(0, LIMIT);

  const shown = new Set([...onSale, ...inStock].map((p) => p.slug));
  const latest = all.filter((p) => !shown.has(p.slug)).sort(byModifiedDesc).slice(0, LIMIT);

  return {
    onSale,
    inStock,
    latest,
    hasAny: all.length > 0,
  };
}
