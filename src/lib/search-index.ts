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

export interface SuggestEntry {
  /** متنی که به کاربر نشان داده می‌شود. */
  label: string;
  /** دسته‌بندی پیشنهاد — برای گروه‌بندی بصری در فهرست. */
  kind: 'category' | 'brand' | 'silo' | 'product';
  href: string;
  /** زمینه‌ی کوتاه زیر عنوان (نام سیلو، کشور برند و…). */
  context: string;
  /**
   * همه‌ی رشته‌هایی که باید با ورودی کاربر تطبیق داده شوند — شامل نام،
   * مترادف‌های عامیانه (aka)، نام انگلیسی و اسلاگ.
   * از قبل نرمال‌سازی شده تا در هر ضربه‌ی کیبورد دوباره محاسبه نشود.
   */
  haystack: string[];
}

/**
 * نرمال‌سازی فارسی — بدون این، جستجو در عمل شکسته است.
 *
 * کاربر ایرانی روی کیبوردهای مختلف «ی» را گاهی «ي» عربی و «ک» را «ك»
 * عربی تایپ می‌کند؛ این‌ها کاراکترهای یونیکد متفاوتی هستند و مقایسه‌ی
 * ساده‌ی رشته‌ای شکست می‌خورد. نیم‌فاصله (ZWNJ) هم همین‌طور: «برق‌رسان»
 * و «برق رسان» و «برقرسان» باید یکی حساب شوند.
 */
export function normalizeFa(input: string): string {
  return input
    .toLowerCase()
    .replace(/[يى]/g, 'ی') // ي/ى → ی
    .replace(/ك/g, 'ک') // ك → ک
    .replace(/[ً-ْٰ]/g, '') // اعراب
    .replace(/ـ/g, '') // کشیده
    .replace(/[‌‏‎]/g, ' ') // نیم‌فاصله → فاصله
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\p{L}\p{N}]+/gu, ' ') // نقطه‌گذاری → فاصله
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * حذف کامل فاصله — برای تطبیق مستقل از فاصله‌گذاری.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * مشکلی که این تابع حل می‌کند
 * ═══════════════════════════════════════════════════════════════════════
 * در بازار ایران یک قطعه با چند املای متفاوت نوشته می‌شود و تفاوت اغلب
 * فقط در فاصله است:
 *
 *     رکتیفایر   ↔  رکتی فایر
 *     سیم‌بکسل   ↔  سیم بکسل   ↔  سیمبکسل
 *     روپ‌گاید   ↔  روپ گاید
 *
 * `normalizeFa` نیم‌فاصله را به فاصله تبدیل می‌کند، پس دو حالت اول و دوم
 * به هم می‌رسند. اما «رکتیفایر» (بدون هیچ فاصله‌ای) با «رکتی فایر» تطبیق
 * نمی‌خورد، چون یکی یک کلمه است و دیگری دو کلمه.
 *
 * راه‌حل: علاوه بر شکل عادی، شکل «بی‌فاصله» هم ایندکس و مقایسه می‌شود.
 * این کار تمام حالت‌های فاصله‌گذاری را به یک نقطه می‌رساند.
 *
 * ⚠️ چرا این روش به‌جای متن مخفی انتخاب شد:
 * راه‌حل رایج برای مترادف‌ها، ریختن کلمات کلیدی در یک عنصر `sr-only`
 * پنهان است. آن کار «متن مخفی» محسوب می‌شود و صراحتاً در دستورالعمل‌های
 * اسپم گوگل آمده است — یعنی دقیقاً ریسکی که با فشار رتبه‌ی #۱ نباید
 * پذیرفت. مترادف‌ها همین حالا به‌صورت *قابل مشاهده* روی صفحه‌ی دسته
 * («نام‌های دیگر: …») نمایش داده می‌شوند و هم گوگل و هم Pagefind همان
 * متن مرئی را ایندکس می‌کنند. تطبیق بی‌فاصله بقیه‌ی کار را بدون یک
 * کاراکتر متن پنهان انجام می‌دهد.
 */
export function despace(input: string): string {
  return input.replace(/\s+/g, '');
}

/** شکل عادی + شکل بی‌فاصله، بدون تکرار. */
function variants(values: string[]): string[] {
  const out = new Set<string>();
  for (const value of values) {
    const n = normalizeFa(value);
    if (!n) continue;
    out.add(n);
    const d = despace(n);
    if (d !== n) out.add(d);
  }
  return [...out];
}

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
  const entries: SuggestEntry[] = [];

  for (const product of products) {
    if (product.isDemo) continue;

    const haystack = [product.name, product.sku ?? '', product.brandNameFa ?? '', product.brandNameEn ?? ''];
    for (const ref of product.oemCrossReference) haystack.push(ref.oemPartNumber);

    entries.push({
      label: product.name,
      kind: 'product',
      href: `/products/${product.slug}`,
      context: product.sku ? `کد فنی: ${product.sku}` : (product.brandNameFa ?? 'محصول'),
      haystack: variants(haystack.filter(Boolean)),
    });
  }

  return entries;
}

/**
 * فهرست کامل — فقط برای تست و ابزارهای خط فرمان.
 * ⚠️ این را در کامپوننت استفاده نکنید؛ باعث inline شدن کل کاتالوگ می‌شود.
 */
/* -------------------------------------------------------------------------
   امتیازدهی — همان منطق روی سرور (تست) و مرورگر (اجرا).
------------------------------------------------------------------------- */

/**
 * فاصله‌ی ویرایشی محدودشده. اگر فاصله از `max` بیشتر شد زودتر خارج می‌شود
 * تا برای رشته‌های نامرتبط هزینه ندهیم.
 *
 * چرا لازم است: خواسته‌ی صریح این بود که «خرید دوچ» هم نتیجه بدهد. تطبیق
 * دقیق رشته‌ای این را هرگز پیدا نمی‌کند — کاربر ناقص و با غلط تایپ می‌کند.
 */
export function boundedLevenshtein(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
      curr.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length]!;
}

/**
 * امتیاز یک پیشنهاد در برابر عبارت کاربر. عدد بزرگ‌تر = مرتبط‌تر.
 * صفر یعنی بی‌ربط.
 *
 * ترتیب اهمیت عمدی است: شروع‌شدن با عبارت > شامل‌بودن > تطبیق فازی.
 * کسی که «کمرب» تایپ می‌کند «کمربند» را می‌خواهد، نه چیزی که وسطش «کمرب»
 * دارد.
 */
export function scoreEntry(entry: SuggestEntry, queryNorm: string): number {
  if (!queryNorm) return 0;

  const words = meaningfulWords(queryNorm);
  // اگر کاربر فقط «خرید» یا «قیمت» تایپ کرده باشد، کلمه‌ی معناداری نمانده.
  if (words.length === 0) return 0;

  // پرس‌وجو هم در شکل بی‌فاصله مقایسه می‌شود تا «رکتی فایر» و «رکتیفایر»
  // به یک نتیجه برسند. (توضیح کامل در despace)
  const queryTight = despace(queryNorm);

  let phrase = 0;
  for (const hay of entry.haystack) {
    if (!hay) continue;
    if (hay === queryNorm || hay === queryTight) phrase = Math.max(phrase, 100);
    else if (hay.startsWith(queryNorm) || hay.startsWith(queryTight)) phrase = Math.max(phrase, 85);
    else if (hay.includes(queryNorm) || hay.includes(queryTight)) phrase = Math.max(phrase, 65);
  }

  // ---------------------------------------------------------------------
  // امتیاز کلمه‌به‌کلمه — *میانگین*، نه بیشینه.
  //
  // این تفاوت یک باگ واقعی را رفع کرد. با بیشینه‌گیری، عبارت «رموت کنترل»
  // مدخل «اینورتر» را بالاتر از «ریموت کنترل» می‌آورد: کلمه‌ی «کنترل»
  // دقیقاً در انبارِ اینورتر بود و امتیاز کامل می‌گرفت، در حالی که
  // «رموت» (با غلط تایپی) فقط امتیاز فازی پایین داشت — و بیشینه، آن
  // تطبیق ضعیف را نادیده می‌گرفت.
  //
  // با میانگین، مدخلی که به *همه‌ی* کلمات کاربر ربط دارد از مدخلی که فقط
  // یک کلمه را عالی پوشش می‌دهد جلو می‌افتد. این همان رفتاری است که
  // کاربر از یک جستجوی چندکلمه‌ای انتظار دارد.
  // ---------------------------------------------------------------------
  let sum = 0;
  for (const qw of words) {
    let bestForWord = 0;
    for (const hay of entry.haystack) {
      if (!hay) continue;
      for (const hw of hay.split(' ')) {
        if (!hw) continue;
        if (hw === qw) bestForWord = Math.max(bestForWord, 60);
        else if (hw.startsWith(qw)) bestForWord = Math.max(bestForWord, 50);
        else if (qw.length >= 3 && hw.includes(qw)) bestForWord = Math.max(bestForWord, 32);
        // تطبیق فازی فقط برای کلمات به‌قدر کافی بلند و با اختلاف طول کم.
        // بدون این دو شرط، کلمات کوتاه به هر چیزی وصل می‌شوند و فهرست
        // پیشنهاد پر از نتیجه‌ی بی‌ربط می‌شود.
        else if (
          qw.length >= 4 &&
          hw.length >= 4 &&
          Math.abs(qw.length - hw.length) <= 2 &&
          boundedLevenshtein(qw, hw, 1) <= 1
        ) {
          bestForWord = Math.max(bestForWord, 28);
        }
      }
    }
    sum += bestForWord;
  }

  const wordScore = sum / words.length;

  // اگر هیچ کلمه‌ای واقعاً تطبیق نیافت، این مدخل بی‌ربط است — حتی اگر
  // تطبیق عبارتیِ ضعیفی وجود داشته باشد.
  if (wordScore === 0) return phrase >= 65 ? phrase : 0;

  return Math.max(phrase, wordScore);
}

/**
 * کلمات پرتکرارِ «نیت خرید» که خودشان چیزی را مشخص نمی‌کنند.
 *
 * کاربر ایرانی معمولاً «خرید کمربند» یا «قیمت ریموت کنترل» تایپ می‌کند.
 * اگر این کلمات وزن بگیرند، هر مدخلی که تصادفاً «قیمت» در توضیحش دارد
 * بالا می‌آید. حذفشان دقیقاً همان کاری است که موتورهای جستجو می‌کنند.
 */
const STOPWORDS = new Set([
  'خرید',
  'قیمت',
  'فروش',
  'فروشگاه',
  'انواع',
  'لیست',
  'بهترین',
  'ارزان',
  'جرثقیل',
  'سقفی',
  'buy',
  'price',
]);

function meaningfulWords(queryNorm: string): string[] {
  const all = queryNorm.split(' ').filter((w) => w.length >= 2);
  const kept = all.filter((w) => !STOPWORDS.has(w));
  // اگر همه‌ی کلمات stopword بودند، همان‌ها را نگه می‌داریم — بهتر از
  // برنگرداندن هیچ پیشنهادی برای «جرثقیل سقفی».
  return kept.length > 0 ? kept : all;
}

/** بهترین پیشنهادها برای یک عبارت. */
export function suggest(index: SuggestEntry[], query: string, limit = 7): SuggestEntry[] {
  const q = normalizeFa(query);
  if (q.length < 1) return [];

  return index
    .map((entry) => ({ entry, score: scoreEntry(entry, q) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        // در امتیاز مساوی، محصول واقعی مقدم بر صفحه‌ی دسته است.
        Number(b.entry.kind === 'product') - Number(a.entry.kind === 'product') ||
        a.entry.label.length - b.entry.label.length
    )
    .slice(0, limit)
    .map((x) => x.entry);
}
