// src/lib/seo-meta.ts
// ---------------------------------------------------------------------------
// طول title و meta description — یک جا، برای همیشه.
//
// ═══════════════════════════════════════════════════════════════════════════
// باگی که ممیزی پیدا کرد
// ═══════════════════════════════════════════════════════════════════════════
// ۲۵ صفحه از ۷۲ صفحه، meta description بلندتر از ۱۷۰ کاراکتر داشتند —
// صفحات برند حدود ۲۲۰ و صفحه‌ی محصول ۲۴۲ کاراکتر. گوگل توضیحات را حدود
// ۱۵۵ تا ۱۶۰ کاراکتر می‌برد، پس روی نتیجه‌ی جستجو نیمی از جمله ناتمام
// می‌ماند و جمله‌ی دعوت‌کننده‌ای که برای همان جا نوشته شده بود هرگز دیده
// نمی‌شود.
//
// علتش هم یک قانون نبود، بلکه **نبودِ قانون** بود: `Layout.astro` هر رشته‌ای
// را که می‌گرفت خام چاپ می‌کرد و هیچ‌جای پروژه محدودکننده‌ی طولی نداشت.
// پس وصله‌کردن ۲۵ صفحه جواب نبود؛ ۲۶اُمی همان اشتباه را تکرار می‌کرد.
//
// حالا محدودیت در همان گلوگاهی است که *همه* از آن رد می‌شوند.
// ---------------------------------------------------------------------------

/** بیشینه‌ی امن توضیحات — گوگل حدود ۱۵۵ تا ۱۶۰ کاراکتر نشان می‌دهد. */
export const DESC_MAX = 158;
/** بیشینه‌ی امن عنوان — بیش از این در نتیجه‌ی جستجو با «…» بریده می‌شود. */
export const TITLE_MAX = 60;

/**
 * برش در مرز کلمه، نه وسط کلمه.
 *
 * ⚠️ `slice(0, n)` ساده، فارسی را وسط کلمه می‌برد («تأمین تخصصی قطع…»)
 * که بدتر از بریدن خودِ گوگل است. اینجا تا آخرین فاصله عقب می‌رویم.
 *
 * اگر متن هیچ فاصله‌ای نداشت (رشته‌ی چسبیده)، ناچار از برش سخت استفاده
 * می‌شود — ولی این حالت در متن واقعی رخ نمی‌دهد.
 */
function clampWords(text: string, max: number): { value: string; clipped: boolean } {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return { value: clean, clipped: false };

  // یک کاراکتر برای «…» کنار گذاشته می‌شود.
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const body = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;

  // نقطه یا ویرگولِ آویزان پیش از «…» زشت است.
  return { value: body.replace(/[\s،,.؛;:-]+$/, '') + '…', clipped: true };
}

/*
 * گزارش یک‌باره در پایان build.
 *
 * ⚠️ هشدار به‌ازای هر صفحه، ۷۲ خط تکراری می‌سازد و آن‌وقت هیچ‌کدام خوانده
 * نمی‌شود. اینجا جمع می‌شود و یک بار چاپ می‌گردد — با نام صفحه، تا معلوم
 * باشد کدام متن باید کوتاه‌تر نوشته شود.
 */
const clippedDesc: string[] = [];
const clippedTitle: string[] = [];
let scheduled = false;

function scheduleReport(): void {
  if (scheduled) return;
  scheduled = true;
  process.on('exit', () => {
    if (clippedDesc.length) {
      console.warn(
        `\n[seo] ⚠ ${clippedDesc.length} توضیح متا بلندتر از ${DESC_MAX} کاراکتر بود و بریده شد.\n` +
          `      بریده‌شدن بهتر از ناتمام‌ماندن است، ولی بهترین کار این است که\n` +
          `      متن از ابتدا در همین اندازه نوشته شود:\n` +
          clippedDesc.slice(0, 10).map((s) => `        • ${s}`).join('\n') +
          (clippedDesc.length > 10 ? `\n        … و ${clippedDesc.length - 10} مورد دیگر` : ''),
      );
    }
    if (clippedTitle.length) {
      console.warn(
        `\n[seo] ⚠ ${clippedTitle.length} عنوان بلندتر از ${TITLE_MAX} کاراکتر بود:\n` +
          clippedTitle.slice(0, 10).map((s) => `        • ${s}`).join('\n'),
      );
    }
  });
}

export function clampDescription(text: string, where = ''): string {
  const { value, clipped } = clampWords(text ?? '', DESC_MAX);
  if (clipped) {
    scheduleReport();
    clippedDesc.push(`${where || '؟'} (${(text ?? '').trim().length} کاراکتر)`);
  }
  return value;
}

export function clampTitle(text: string, where = ''): string {
  const { value, clipped } = clampWords(text ?? '', TITLE_MAX);
  if (clipped) {
    scheduleReport();
    clippedTitle.push(`${where || '؟'} (${(text ?? '').trim().length} کاراکتر)`);
  }
  return value;
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * ساختن عنوان و توضیح از «قطعه»، نه بریدن از «کاراکتر»
 * ═══════════════════════════════════════════════════════════════════════════
 * بریدنِ کاراکتری روی متنی که از قطعه‌های معنادار ساخته شده، همیشه ارزشمندترین
 * بخش را قربانی می‌کند — چون آن بخش آخر است.
 *
 * دو نمونه‌ی واقعی از همین سایت:
 *
 *   • عنوان محصول SAGA1-L12 در ۹۱ کاراکتر ساخته می‌شد و به ۵۷ بریده می‌شد.
 *     چیزی که حذف شد: «| کرین یدک». یعنی نام برند از عنوان نتیجه‌ی جستجو
 *     افتاد و به‌جایش «…» نشست.
 *
 *   • توضیح ۱۸ دسته از ۳۱ دسته، دمِ ثابتِ «تضمین اصالت کالا، بررسی سازگاری
 *     فنی و صدور فاکتور رسمی» را از دست می‌داد — یعنی دقیقاً سیگنال‌های
 *     اعتمادی که آن جمله برای همان‌ها نوشته شده بود.
 *
 * راه‌حل: قطعه‌ها اولویت دارند. قطعه‌ای که جا نمی‌شود، **کامل** حذف می‌شود
 * نه نصفه. نتیجه یک عنوان کوتاه‌ترِ تمیز است، نه یک عنوان بلندِ بریده.
 *
 * `clampTitle`/`clampDescription` به‌عنوان تور ایمنی سر جایشان می‌مانند.
 */

/**
 * عنوان از قطعه‌های اولویت‌دار. قطعه‌ی اول همیشه می‌ماند؛ بقیه فقط اگر جا شوند.
 *
 * @param parts قطعه‌ها به ترتیب اهمیت — مهم‌ترین اول.
 */
export function buildTitle(parts: readonly (string | null | undefined)[], where = ''): string {
  const clean = parts.map((p) => (p ?? '').trim()).filter((p) => p !== '');
  if (!clean.length) return '';

  let out = clean[0];
  for (const part of clean.slice(1)) {
    const next = `${out} | ${part}`;
    if (next.length > TITLE_MAX) break; // این قطعه و هرچه بعدش است حذف
    out = next;
  }

  // اگر حتی قطعه‌ی اول بلند بود، تور ایمنی وارد می‌شود.
  return out.length > TITLE_MAX ? clampTitle(out, where) : out;
}

/**
 * توضیح = متن اختصاصی + بلندترین دمِ ثابتی که جا می‌شود.
 *
 * @param lead  متن اختصاصی صفحه. هرگز به نفع دم حذف نمی‌شود.
 * @param tails دم‌ها از بلند به کوتاه. اگر هیچ‌کدام جا نشد، هیچ‌کدام نمی‌آید.
 */
export function buildDescription(
  lead: string,
  tails: readonly string[] = [],
  where = '',
): string {
  const head = (lead ?? '').trim();
  if (head.length > DESC_MAX) return clampDescription(head, where);

  for (const tail of tails) {
    const t = (tail ?? '').trim();
    if (!t) continue;
    const joined = `${head} ${t}`;
    if (joined.length <= DESC_MAX) return joined;
  }
  return head;
}
