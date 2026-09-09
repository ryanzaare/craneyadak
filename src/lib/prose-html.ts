// src/lib/prose-html.ts
// ---------------------------------------------------------------------------
// آماده‌سازی HTMLای که مدیر محتوا در وردپرس نوشته، پیش از رندر.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا این ماژول ساخته شد
// ═══════════════════════════════════════════════════════════════════════════
// تابع `wrapProseTables` در دو کامپوننت کپی شده بود: `BrandGuide.astro` و
// `CategoryGuide.astro`. بررسی نشان داد **دو نسخه دیگر یکسان نیستند** —
// یعنی یکی از آن دو در جایی اصلاح شده و دیگری عقب مانده است. این همان
// واگراییِ آرام است که کپی‌کردن کد همیشه به آن می‌رسد: باگ در یکی درست
// می‌شود و در آن یکی زنده می‌ماند.
//
// حالا یک نسخه هست. اصلاح در یک جا، همه‌جا اعمال می‌شود.
// ---------------------------------------------------------------------------

/**
 * جدول‌های داخل متن را در ظرف اسکرول‌پذیر می‌پیچد.
 *
 * ستون متنِ راهنما به ~۷۰ کاراکتر محدود است تا خوانا بماند، ولی همان
 * محدودیت روی یک جدول چهارستونی فارسی در موبایل فاجعه می‌شود: هر ستون
 * حدود ۸۰ پیکسل می‌شود و هر کلمه در یک خط جدا می‌شکند.
 *
 * ⚠️ الگو، جدولِ *از قبل پیچیده‌شده* را هم می‌گیرد؛ وگرنه هر بار که این
 * تابع دو بار روی یک رشته اجرا شود، یک `div` دیگر دورش می‌پیچد.
 */
export function wrapProseTables(html: string): string {
  if (!html || !html.includes('<table')) return html;
  return html.replace(
    /<div class="table-scroll">\s*(<table[\s\S]*?<\/table>)\s*<\/div>|(<table[\s\S]*?<\/table>)/g,
    (_m, wrapped, bare) => `<div class="table-scroll">${wrapped ?? bare}</div>`,
  );
}

export interface ImageAudit {
  /** تعداد کل تصاویر داخل متن. */
  total: number;
  /** تصاویری که ابعاد ندارند — هرکدام یک پرش چیدمان (CLS) بالقوه است. */
  missingSize: number;
  /** تصاویری که متن جایگزین ندارند — هم دسترسی‌پذیری، هم سئوی تصویر. */
  missingAlt: number;
}

const hasAttr = (attrs: string, name: string) =>
  new RegExp(`(^|\\s)${name}\\s*=`, 'i').test(attrs);

/**
 * تصاویر داخل متن را نرمال می‌کند.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * چرا نمی‌شود تصویر را همان‌طور که ویرایشگر می‌سازد رها کرد
 * ═══════════════════════════════════════════════════════════════════════════
 * ۱) **CLS.** بدون `width` و `height`، مرورگر تا لحظه‌ی دانلود تصویر
 *    نمی‌داند چقدر جا باز کند. متن زیر آن رندر می‌شود و بعد ناگهان
 *    می‌پرد پایین. این مستقیماً یکی از سه سنجه‌ی Core Web Vitals است.
 *
 * ۲) **بارگذاری.** تصویری در میانه‌ی یک راهنمای بلند، نباید هم‌زمان با
 *    بقیه‌ی صفحه دانلود شود. `loading="lazy"` تا نزدیک شدن کاربر صبر
 *    می‌کند.
 *
 * ۳) **رمزگشایی.** `decoding="async"` رمزگشایی تصویر را از رشته‌ی اصلی
 *    خارج می‌کند تا اسکرول کند نشود.
 *
 * هیچ‌کدام از این‌ها را مدیر محتوا نباید به‌خاطر بسپارد. اینجا در زمان
 * build و یک‌بار برای همیشه اعمال می‌شود.
 *
 * ⚠️ تصاویرِ *بدون ابعاد* حذف یا اصلاح نمی‌شوند — چون حدس زدن ابعاد یعنی
 * ساختن عدد. به‌جایش شمرده می‌شوند و لاگ build آن‌ها را گزارش می‌دهد.
 */
export function normalizeProseImages(html: string): { html: string; audit: ImageAudit } {
  const audit: ImageAudit = { total: 0, missingSize: 0, missingAlt: 0 };
  if (!html || !html.includes('<img')) return { html, audit };

  const out = html.replace(/<img\b([^>]*?)(\s*\/?)>/gi, (_m, rawAttrs: string, tail: string) => {
    audit.total++;
    let attrs = rawAttrs;

    if (!hasAttr(attrs, 'loading')) attrs += ' loading="lazy"';
    if (!hasAttr(attrs, 'decoding')) attrs += ' decoding="async"';

    if (!hasAttr(attrs, 'width') || !hasAttr(attrs, 'height')) audit.missingSize++;
    if (!hasAttr(attrs, 'alt')) {
      audit.missingAlt++;
      // alt خالی بهتر از نبودِ alt است: صفحه‌خوان به‌جای خواندن نام فایل،
      // تصویر را تزئینی در نظر می‌گیرد و رد می‌شود.
      attrs += ' alt=""';
    }

    return `<img${attrs}${tail}>`;
  });

  return { html: out, audit };
}

/** جمع دو گزارش تصویر — برای شمارش در سطح یک صفحه. */
export function mergeAudit(a: ImageAudit, b: ImageAudit): ImageAudit {
  return {
    total: a.total + b.total,
    missingSize: a.missingSize + b.missingSize,
    missingAlt: a.missingAlt + b.missingAlt,
  };
}

export const EMPTY_AUDIT: ImageAudit = { total: 0, missingSize: 0, missingAlt: 0 };

/**
 * یک بار هشدار می‌دهد، نه به‌ازای هر صفحه.
 *
 * لاگ build باید *خوانده* شود؛ ۷۲ خط تکراری یعنی هیچ‌کدام خوانده نمی‌شود.
 */
let warned = false;
export function reportImageAudit(audit: ImageAudit, where: string): void {
  if (warned || (audit.missingSize === 0 && audit.missingAlt === 0)) return;
  warned = true;

  if (audit.missingSize > 0) {
    console.warn(
      `[prose] ⚠ ${audit.missingSize} تصویر داخل متن، width/height ندارد (${where}).\n` +
        `        بدون ابعاد، متن زیر تصویر هنگام بارگذاری می‌پرد — این امتیاز CLS را\n` +
        `        پایین می‌آورد. در ویرایشگر وردپرس، تصویر را از «کتابخانه‌ی رسانه»\n` +
        `        درج کنید (نه با چسباندن آدرس)، تا ابعاد خودکار اضافه شود.`,
    );
  }
  if (audit.missingAlt > 0) {
    console.warn(`[prose] ⚠ ${audit.missingAlt} تصویر داخل متن، alt ندارد — سئوی تصویر و صفحه‌خوان هر دو از دست می‌رود.`);
  }
}
