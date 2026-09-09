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

/**
 * تصاویر داخل متن را از خط لوله‌ی بهینه‌سازی Astro رد می‌کند.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ باگی که این تابع رفع می‌کند — و کارفرما درست حدس زد
 * ═══════════════════════════════════════════════════════════════════════════
 * `RemoteImage.astro` از `astro:assets` استفاده می‌کند و تصاویر را در زمان
 * build به AVIF (با fallback به WebP) تبدیل می‌کند. ولی آن مسیر فقط برای
 * تصویرهایی کار می‌کند که به‌صورت **کامپوننت** نوشته شده باشند.
 *
 * متنِ راهنما با `set:html` رندر می‌شود، یعنی یک **رشته‌ی خام**. کامپایلر
 * Astro داخل رشته را نمی‌بیند، پس هر `<img>` که مدیر محتوا در ویرایشگر
 * وردپرس درج کند **کاملاً از خط لوله رد می‌شود**: همان JPEG چندمگابایتی
 * مستقیم از `admin.craneyadak.com` به موبایل کاربر می‌رود.
 *
 * راه‌حل، `getImage()` است — همان API برنامه‌نویسیِ زیرِ `<Image>`. اینجا
 * روی رشته اجرا می‌شود و `src` را با فایل بهینه‌شده جایگزین می‌کند.
 *
 * سه سود جانبی:
 *   • `inferSize` ابعاد واقعی را در زمان build می‌خواند، پس `width`/`height`
 *     خودکار درج می‌شود و مسئله‌ی CLS از ریشه حل می‌شود.
 *   • بازدیدکننده هرگز به وردپرس وصل نمی‌شود؛ فایل از دامنه‌ی خودمان می‌آید.
 *   • دامنه‌های مجاز در `astro.config.mjs` محدودند، پس آدرس دلخواه نمی‌تواند
 *     build ما را به سرویس رایگان پردازش تصویر تبدیل کند.
 *
 * ⚠️ اگر بهینه‌سازی یک تصویر شکست بخورد (آدرس خراب، دامنه‌ی غیرمجاز، فایل
 * حذف‌شده)، **build متوقف نمی‌شود**. تصویر با آدرس اصلی می‌ماند و یک هشدار
 * چاپ می‌شود. یک عکس بهینه‌نشده بد است؛ کل سایت که ساخته نشود بدتر است.
 */
export async function optimizeProseImages(
  html: string,
  getImage: (opts: Record<string, unknown>) => Promise<{ src: string; attributes?: Record<string, unknown> }>,
): Promise<{ html: string; optimized: number; skipped: string[] }> {
  const skipped: string[] = [];
  let optimized = 0;
  if (!html || !html.includes('<img')) return { html, optimized, skipped };

  const tags = [...html.matchAll(/<img\b([^>]*?)(\s*\/?)>/gi)];
  if (tags.length === 0) return { html, optimized, skipped };

  const replacements = await Promise.all(
    tags.map(async ([full, attrs]) => {
      const src = /(?:^|\s)src\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      // data: و SVG درون‌خطی چیزی برای بهینه‌سازی ندارند.
      if (!src || src.startsWith('data:') || src.endsWith('.svg')) return [full, full] as const;

      try {
        const out = await getImage({ src, format: 'avif', inferSize: true });
        const w = out.attributes?.width;
        const h = out.attributes?.height;

        let next = attrs
          .replace(/(?:^|\s)src\s*=\s*["'][^"']*["']/i, ` src="${out.src}"`)
          // srcset قدیمیِ وردپرس به فایل‌های بهینه‌نشده اشاره می‌کند و باید برود.
          .replace(/(?:^|\s)(?:srcset|sizes)\s*=\s*["'][^"']*["']/gi, '');

        if (w && !hasAttr(next, 'width')) next += ` width="${w}"`;
        if (h && !hasAttr(next, 'height')) next += ` height="${h}"`;

        optimized++;
        return [full, `<img${next}>`] as const;
      } catch (error) {
        skipped.push(`${src.slice(0, 70)} — ${error instanceof Error ? error.message.slice(0, 80) : 'خطای ناشناخته'}`);
        return [full, full] as const;
      }
    }),
  );

  let out = html;
  for (const [from, to] of replacements) if (from !== to) out = out.replace(from, to);

  if (skipped.length) {
    console.warn(
      `[prose] ⚠ ${skipped.length} تصویر بهینه نشد و با آدرس اصلی وردپرس رندر می‌شود:\n` +
        skipped.map((s) => `     • ${s}`).join('\n'),
    );
  }

  return { html: out, optimized, skipped };
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
