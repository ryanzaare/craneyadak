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

export interface SuggestEntry {
  /** متنی که به کاربر نشان داده می‌شود. */
  label: string;
  /** دسته‌بندی پیشنهاد — برای گروه‌بندی بصری در فهرست. */
  kind: 'category' | 'brand' | 'silo';
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

/** ساخت فهرست پیشنهادها. در زمان build یک‌بار اجرا می‌شود. */
export function buildSuggestIndex(): SuggestEntry[] {
  const entries: SuggestEntry[] = [];

  for (const silo of SILOS) {
    entries.push({
      label: silo.name,
      kind: 'silo',
      href: siloPath(silo),
      context: `${silo.categories.length} دسته قطعه`,
      haystack: [silo.name, silo.keyword, silo.slug].map(normalizeFa),
    });
  }

  for (const category of ALL_CATEGORIES) {
    entries.push({
      label: category.name,
      kind: 'category',
      href: categoryPath(category),
      context: category.silo.name,
      haystack: [category.name, category.keyword, category.slug, ...(category.aka ?? [])].map(
        normalizeFa
      ),
    });
  }

  for (const brand of BRANDS) {
    entries.push({
      label: brand.nameFa,
      kind: 'brand',
      href: `/brands/${brand.slug}`,
      context: `برند ${brand.nameEn} — ${brand.country}`,
      haystack: [brand.nameFa, brand.nameEn, brand.slug, brand.logoText].map(normalizeFa),
    });
  }

  return entries;
}

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

  let phrase = 0;
  for (const hay of entry.haystack) {
    if (!hay) continue;
    if (hay === queryNorm) phrase = Math.max(phrase, 100);
    else if (hay.startsWith(queryNorm)) phrase = Math.max(phrase, 85);
    else if (hay.includes(queryNorm)) phrase = Math.max(phrase, 65);
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
    .sort((a, b) => b.score - a.score || a.entry.label.length - b.entry.label.length)
    .slice(0, limit)
    .map((x) => x.entry);
}
