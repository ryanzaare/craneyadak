// src/lib/search-score.ts
// ---------------------------------------------------------------------------
// منطق خالص جستجو: نرمال‌سازی، کلید کد فنی، امتیازدهی، پیشنهاد. **بدون هیچ import** — تا هم آزمون Node
// (search-score.test.mts) و هم اسکریپت مرورگر (پنل جستجوی فوری search-overlay.ts، صفحه‌ی /search/) *همین* فایل را اجرا کنند.
//
// ⚠️ چرا جدا شد (Frontend v2، فاز ۲): همین منطق دو نسخه داشت — این‌جا و کپی inline در SearchBox.astro — و
// از هم رانده بودند: محدوده‌ی اعراب سرور تا U+0652 بود و مرورگر تا U+0650. آزمون سرور چیزی را تأیید می‌کرد
// که کاربر اجرا نمی‌کرد. حالا یک نسخه است.
// ---------------------------------------------------------------------------

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
  /** کد فنی خام برای نمایش با قلم مونو (فقط محصول). */
  code?: string;
  /** فقط محصول، فقط در /search-index.json (پنل جستجوی فوری): تصویر ۱۶۰px خود سایت، موجودی، اصالت ثبت‌شده. */
  image?: string;
  stock?: string;
  original?: boolean;
  /** فقط دسته، فقط در /search-index.json: شمار کالای منتشرشده. */
  count?: number;
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
    .replace(/[آأإ]/g, 'ا') // ⚠️ ۶ آذر ۱۴۰۵: «ساگآ» ⇒ «ساگا»
    // ⚠️ حرف مدل به فارسی (مدیرعامل ۶ آذر ۱۴۰۵: «مردم ال به‌جای L می‌نویسند»): «ال ۱۰»، «ال۱۲»، «اِل 10» ⇒ «l10» — همان
    // توکن کد مدل. فقط «ال» جدا (اول عبارت یا پس از فاصله) و پیش از رقم، تا واژه‌ای مثل «الکتروموتور ۳» دست نخورد.
    .replace(/(^|\s)ال ?(\d)/g, '$1l$2')
    // حرف فارسی چسبیده به رقم جدا شود: «ساگا۱۰» ⇒ «ساگا 10» (وگرنه یک توکن بی‌معنا می‌شد و «ضربه‌گیر» می‌آمد).
    .replace(/([\u0600-\u06FF])(\d)/g, '$1 $2')
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
export function variants(values: string[]): string[] {
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


/**
 * کلید کد فنی: هر نویسه‌ی غیرحرف/غیررقم حذف، حروف کوچک، ارقام فارسی/عربی → لاتین.
 * «SAGA1-L12»، «saga1 l12»، «saga1/l12»، «saga۱-l۱۲» → «saga1l12». خریدار کد را از پلاک یا فاکتور قدیمی
 * با هر جداکننده‌ای تایپ می‌کند؛ اختلاف جداکننده نباید «پیدا نشد» بدهد (§2 اصل ۱).
 */
export function partCodeKey(input: string): string {
  return despace(normalizeFa(input));
}

/** فقط فیلدهایی که مدخل جستجوی محصول لازم دارد — CraneProduct ساختاراً آن را دارد. */
export interface ProductSearchInput {
  slug: string;
  name: string;
  sku: string | null;
  brandNameFa: string | null;
  brandNameEn: string | null;
  oemPartNumbers: string[];
}

/** مدخل جستجوی یک محصول. نشانی با «/» پایانی (همان canonical — CLAUDE.md). */
export function productEntry(p: ProductSearchInput): SuggestEntry {
  return {
    label: p.name,
    kind: 'product',
    href: `/products/${p.slug}/`,
    context: p.brandNameFa ?? 'محصول',
    code: p.sku ?? undefined,
    haystack: variants([p.name, p.sku ?? '', p.brandNameFa ?? '', p.brandNameEn ?? '', ...p.oemPartNumbers].filter(Boolean)),
  };
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
        // ⚠️ «شامل» فقط در واژه‌ای که خیلی بلندتر نیست (۲۸ آبان ۱۴۰۵): شکل بی‌فاصله‌ی «کنترل دور موتور»
        // («کنترلدورموتور») «رموت» را در دل «دورموتور» دارد — «رموت کنترول» اینورتر را بالاتر از ریموت می‌آورد.
        // شکل بافاصله‌ی همان انبار تطبیق واقعی را با واژه‌ی خودش می‌گیرد، پس این محدودیت چیزی را گم نمی‌کند.
        else if (qw.length >= 3 && hw.length <= qw.length + 6 && hw.includes(qw)) bestForWord = Math.max(bestForWord, 32);
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

/* -------------------------------------------------------------------------
   جستجوی «هرگز خالی» (کارفرما، ۲۸ آبان ۱۴۰۵: «کاربر هرگز نباید نتیجه‌ی خالی ببیند؛ همیشه مرتبط‌ترین نتیجه،
   حتی اگر اشتباه تایپ کند»). `suggest` بالا دقیق می‌ماند — آزمون‌ها و ترتیب نتیجه‌ی دقیق به آن تکیه دارند. این
   لایه فقط وقتی وارد می‌شود که آن هیچ نیاورد، و به رابط کاربری می‌گوید نتیجه از کدام پله آمده تا برچسب درست
   بزند («منظورتان … بود؟» / «نزدیک‌ترین نتایج»). ⚠️ نتیجه‌ی تقریبی هرگز «دقیق» نشان داده نمی‌شود: در سایت قطعات
   جرثقیل، القای «این همان کد شماست» وقتی نیست، مسئله‌ی ایمنی است (قاعده‌ی ۲).
------------------------------------------------------------------------- */

/**
 * صفحه‌کلید اشتباه: کاربر ایرانی بسیار پیش می‌آید که با چیدمان انگلیسی فارسی تایپ کند («sh'h» به‌جای «ساگا») یا
 * برعکس («یثپشل» به‌جای «demag»). نگاشت چیدمان استاندارد فارسی (ISIRI 9147).
 */
const EN_FA: Record<string, string> = {
  q: 'ض', w: 'ص', e: 'ث', r: 'ق', t: 'ف', y: 'غ', u: 'ع', i: 'ه', o: 'خ', p: 'ح', '[': 'ج', ']': 'چ',
  a: 'ش', s: 'س', d: 'ی', f: 'ب', g: 'ل', h: 'ا', j: 'ت', k: 'ن', l: 'م', ';': 'ک', "'": 'گ', '\\': 'پ',
  z: 'ظ', x: 'ط', c: 'ز', v: 'ر', b: 'ذ', n: 'د', m: 'پ', ',': 'و',
};
const FA_EN: Record<string, string> = Object.fromEntries(Object.entries(EN_FA).filter(([k]) => k !== '\\').map(([k, v]) => [v, k]));

/** همان کلیدها روی چیدمان دیگر؛ null اگر عبارت ترکیبی از هر دو خط باشد یا تغییری نکند. */
export function swapLayout(query: string): string | null {
  const q = query.toLowerCase();
  const latin = /[a-z;'\[\]\\,]/.test(q);
  const persian = /[؀-ۿ]/.test(q);
  if (latin === persian) return null;
  const map = latin ? EN_FA : FA_EN;
  const out = [...q].map((c) => map[c] ?? c).join('');
  return out !== q ? out : null;
}

/** جفت‌نویسه‌های یک رشته‌ی بی‌فاصله — پایه‌ی شباهت Dice. */
function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** شباهت Dice (۰ تا ۱) بین عبارت و بهترین رشته‌ی انبار؛ برای غلط تایپی سنگین که Levenshtein ≤۱ نمی‌گیرد. */
export function fuzzySimilarity(entry: SuggestEntry, queryNorm: string): number {
  const q = despace(queryNorm);
  if (q.length < 2) return 0;
  const qg = bigrams(q);
  const qn = q.length - 1;
  let best = 0;
  for (const hay of entry.haystack) {
    // هر واژه‌ی انبار و کل انبار بی‌فاصله — تا «ریموت» در «ریموت کنترل ساگا» هم کامل شمرده شود.
    for (const h of new Set([despace(hay), ...hay.split(' ')])) {
      if (h.length < 2) continue;
      const hg = bigrams(h);
      let inter = 0;
      for (const [g, n] of qg) inter += Math.min(n, hg.get(g) ?? 0);
      const dice = (2 * inter) / (qn + h.length - 1);
      if (dice > best) best = dice;
    }
  }
  return best;
}

export type SearchMode = 'exact' | 'layout' | 'approximate' | 'popular';

/**
 * هرگز خالی. پله‌ها به ترتیب: (۱) دقیق/فازی معمول؛ (۲) همان کلیدها روی چیدمان دیگر؛ (۳) شباهت جفت‌نویسه
 * (آستانه‌ی ۰٫۲۵)؛ (۴) پرکاربردها — محصول واقعی اول، بعد دسته. عبارت خالی = [] (فهرست بسته).
 * `corrected`: عبارتی که پله‌ی ۲ با آن نتیجه گرفت، برای «منظورتان … بود؟».
 */
export function suggestAlways(index: SuggestEntry[], query: string, limit = 7): { items: SuggestEntry[]; mode: SearchMode; corrected?: string } {
  const RANK = { product: 0, category: 1, brand: 2, silo: 3 } as const;
  const popular = () => ({ items: [...index].sort((a, b) => RANK[a.kind] - RANK[b.kind]).slice(0, limit), mode: 'popular' as const });
  const q = normalizeFa(query);
  // فقط نقطه‌گذاری («؟؟؟») = پرکاربردها؛ فقط فاصله = فهرست بسته.
  if (!q) return query.trim() ? popular() : { items: [], mode: 'exact' };
  const exact = suggest(index, query, limit);
  const swapped = swapLayout(query);
  // ⚠️ چیدمان دیگر رقابت می‌کند، نه فقط وقتی دقیق خالی است: «sh'h» (ساگا با چیدمان انگلیسی) واژه‌ی «sh» را
  // پیشوند «shock absorber» می‌بیند و «ضربه‌گیر» را «دقیق» می‌آورد. برنده بهترین امتیاز است.
  const best = (q2: string) => Math.max(0, ...index.map((e) => scoreEntry(e, normalizeFa(q2))));
  if (swapped && best(swapped) > (exact.length ? best(query) : 0)) {
    const viaLayout = suggest(index, swapped, limit);
    if (viaLayout.length) return { items: viaLayout, mode: 'layout', corrected: swapped };
  }
  if (exact.length) return { items: exact, mode: 'exact' };

  const near = index
    .map((entry) => ({ entry, s: Math.max(fuzzySimilarity(entry, q), swapped ? fuzzySimilarity(entry, normalizeFa(swapped)) : 0) }))
    .filter((x) => x.s >= 0.25)
    .sort((a, b) => b.s - a.s || Number(b.entry.kind === 'product') - Number(a.entry.kind === 'product'))
    .slice(0, limit)
    .map((x) => x.entry);
  if (near.length) return { items: near, mode: 'approximate' };

  return popular();
}
