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
