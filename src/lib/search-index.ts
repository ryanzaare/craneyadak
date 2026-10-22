// src/lib/search-index.ts
// ---------------------------------------------------------------------------
// فهرست پیشنهاد آنی — در زمان BUILD ساخته می‌شود.
//
// چرا این فایل وجود دارد (و چرا Pagefind به‌تنهایی کافی نبود):
//
// Pagefind یک موتور جستجوی تمام‌متن روی صفحات ساخته‌شده است. عالی است، اما
// دو محدودیت دارد که دقیقاً با خواسته‌ی «مثل اتوکامپلیت گوگل» در تضادند:
//
//   ۱) تا وقتی فایل ایندکس (چند صد کیلوبایت) دانلود نشده، هیچ پیشنهادی
//      نمی‌دهد. یعنی اولین کاراکترهایی که کاربر تایپ می‌کند — همان لحظه‌ای
//      که اتوکامپلیت بیشترین ارزش را دارد — خالی می‌ماند.
//   ۲) فقط چیزی را پیدا می‌کند که صفحه‌اش ساخته شده باشد. اگر هنوز محصولی
//      وارد نشده باشد، جستجو عملاً همیشه «نتیجه‌ای یافت نشد» می‌دهد.
//
// اما ۳۱ دسته و ۱۸ برند از همین حالا معلوم‌اند. آن‌ها داده‌ی ثابت‌اند، نه
// نتیجه‌ی جستجو. پس پیشنهاد دسته/برند اصلاً نیازی به Pagefind ندارد: یک
// آرایه‌ی کوچک که همراه صفحه می‌آید، از اولین کاراکتر جواب می‌دهد و حتی
// اگر Pagefind کاملاً از کار بیفتد سالم می‌ماند.
//
// معماری نهایی:
//   • این فهرست  → پیشنهاد آنی دسته/برند (بدون تاخیر، بدون شبکه)
//   • Pagefind   → جستجوی تمام‌متن محصولات (بهبود تدریجی/progressive)
//   • هیچ‌کدام نبود → «پیدا نشد» + نزدیک‌ترین گزینه‌ها، نه پیام خطا
// ---------------------------------------------------------------------------

import { SILOS, BRANDS, ALL_CATEGORIES, categoryPath, siloPath } from '../data/taxonomy';
import type { CraneProduct } from './wp';
import { variants, productEntry, type SuggestEntry } from './search-score';

// منطق خالص (نرمال‌سازی، امتیاز، پیشنهاد) در search-score.ts است — یک نسخه برای سرور، آزمون و مرورگر.
export { normalizeFa, despace, partCodeKey, boundedLevenshtein, scoreEntry, suggest, type SuggestEntry } from './search-score';

/* ═══════════════════════════════════════════════════════════════════════
   دو لایه‌ی فهرست — رفع پیشگیرانه‌ی یک گلوگاه سرعت
   ═══════════════════════════════════════════════════════════════════════
   ⚠️ مشکلی که این تفکیک جلویش را می‌گیرد:

   نسخه‌ی قبل کل فهرست پیشنهاد را به‌صورت JSON داخل *هر صفحه* می‌گذاشت،
   چون کادر جستجو در هدر است و روی همه‌ی صفحات رندر می‌شود. با دو محصول
   ناچیز بود. اما هر محصول، نام و کد فنی و *همه‌ی کدهای معادل OEM* خود را
   وارد این فهرست می‌کند. با ۵۰۰ محصول، این یعنی صدها کیلوبایت JSON روی
   هر بازدید از هر صفحه — حتی صفحاتی که کاربر اصلاً جستجو نمی‌کند.

   این خرابی امروز در هیچ تستی دیده نمی‌شود و بی‌سروصدا LCP موبایل را
   خراب می‌کند. الان که کاتالوگ کوچک است، ارزان‌ترین زمان رفع آن است.

   تفکیک:
     • لایه‌ی ساختاری (این تابع) → ۷ سیلو + ۳۱ دسته + ~۱۹ برند.
       اندازه‌اش ثابت است و با رشد کاتالوگ بزرگ نمی‌شود. همچنان inline
       می‌ماند تا از همان اولین کاراکتر بدون تاخیر شبکه پاسخ بدهد.
     • لایه‌ی محصولات (buildProductIndex) → به‌صورت یک فایل استاتیک
       `/search-index.json` منتشر و فقط هنگام اولین تعامل با کادر جستجو
       واکشی می‌شود. یک‌بار دانلود، سپس کش مرورگر.
   ═══════════════════════════════════════════════════════════════════════ */

/** لایه‌ی ثابت: سیلو، دسته و برند. با رشد کاتالوگ بزرگ نمی‌شود. */
export function buildStructuralIndex(): SuggestEntry[] {
  const entries: SuggestEntry[] = [];

  for (const silo of SILOS) {
    entries.push({
      label: silo.name,
      kind: 'silo',
      href: siloPath(silo),
      context: `${silo.categories.length} دسته قطعه`,
      haystack: variants([silo.name, silo.keyword, silo.slug]),
    });
  }

  for (const category of ALL_CATEGORIES) {
    entries.push({
      label: category.name,
      kind: 'category',
      href: categoryPath(category),
      context: category.silo.name,
      haystack: variants([category.name, category.keyword, category.slug, ...(category.aka ?? [])]),
    });
  }

  for (const brand of BRANDS) {
    entries.push({
      label: brand.nameFa,
      kind: 'brand',
      href: `/brands/${brand.slug}`,
      context: `برند ${brand.nameEn} — ${brand.country}`,
      haystack: variants([brand.nameFa, brand.nameEn, brand.slug, brand.logoText]),
    });
  }

  return entries;
}

/** لایه‌ی رشدپذیر: محصولات. جداگانه منتشر و با تاخیر واکشی می‌شود. */
export function buildProductIndex(products: CraneProduct[] = []): SuggestEntry[] {
  return products
    .filter((p) => !p.isDemo)
    .map((p) =>
      productEntry({
        slug: p.slug,
        name: p.name,
        sku: p.sku,
        brandNameFa: p.brandNameFa,
        brandNameEn: p.brandNameEn,
        oemPartNumbers: p.oemCrossReference.map((r) => r.oemPartNumber),
      }),
    );
}

