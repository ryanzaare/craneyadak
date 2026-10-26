// src/components/related-products.ts
// ---------------------------------------------------------------------------
// «محصولات مرتبط به این مقاله» (کارفرما، ۴ آبان ۱۴۰۵) — بدون فیلد دستی وردپرس، از روی *خود متن مقاله*.
//
// ⚠️ فقط ارتباط واقعی، نه «چند محصول برای پرکردن جا»: پیشنهاد بی‌ربط زیر مقاله‌ی فنی همان ادعای ساختگی است
// (قاعده‌ی ۲). نشانه‌ها، به ترتیب قدرت:
//   ۱) کد فنی محصول در متن مقاله آمده (قوی‌ترین — مقاله دقیقاً همان قطعه را نام برده)؛
//   ۲) مقاله به صفحه‌ی دسته‌ی محصول پیوند داده؛
//   ۳) برند محصول **و** نام دسته‌ی محصول هر دو در متن آمده‌اند (برند تنها کافی نیست: «دماگ» در مقاله‌ی ترمز ربطی به
//      ریموت دماگ ندارد).
// هیچ نشانه‌ای = هیچ بخش. فیلد ACF «محصولات مرتبط» (backlog) بعداً می‌تواند بر این‌ها مقدم شود.
// آزمون: related-products.test.mts (npm run test:related).
// ---------------------------------------------------------------------------

export interface RelProduct {
  slug: string;
  sku: string | null;
  brandNameFa: string | null;
  brandNameEn: string | null;
  categorySlugs: readonly string[];
  isDemo?: boolean;
}
export interface RelCategory {
  slug: string;
  name: string;
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ');
const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.\/]+/g, '');

/** امتیاز هر محصول برای این مقاله (۰ = بی‌ربط) و فهرست مرتب‌شده‌ی مرتبط‌ها. */
export function relatedProductsForPost<T extends RelProduct>(
  post: { title: string; bodyHtml: string },
  products: readonly T[],
  categories: readonly RelCategory[],
  limit = 4,
): T[] {
  const html = post.bodyHtml ?? '';
  const text = `${post.title} ${stripTags(html)}`;
  const textNorm = norm(text);
  const linkedCats = new Set(
    [...html.matchAll(/href=["'][^"']*\/categories\/(?:[^/"']+\/)?([^/"'#?]+)\/?["'#?]/g)].map((m) => m[1]),
  );
  const catName = new Map(categories.map((c) => [c.slug, c.name]));
  const scored = products
    .filter((p) => !p.isDemo)
    .map((p) => {
      let score = 0;
      const sku = (p.sku ?? '').trim();
      if (sku.length >= 3 && textNorm.includes(norm(sku))) score += 10;
      if (p.categorySlugs.some((c) => linkedCats.has(c))) score += 5;
      const brandHit = [p.brandNameFa, p.brandNameEn].some((b) => b && b.trim().length >= 2 && text.toLowerCase().includes(b.trim().toLowerCase()));
      const catHit = p.categorySlugs.some((c) => {
        const n = catName.get(c);
        return n ? text.includes(n.replace(/\s*جرثقیل سقفی$/, '')) : false;
      });
      if (brandHit && catHit) score += 3;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.p);
}
