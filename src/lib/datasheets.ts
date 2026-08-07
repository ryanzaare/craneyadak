// src/lib/datasheets.ts
// ---------------------------------------------------------------------------
// اعتبارسنجی اسناد فنی در زمان BUILD.
//
// مشکلی که این ماژول حل می‌کند:
// آرایه‌ی `DATASHEETS` در `src/data/content.ts` شش سند را با حجم دستی‌نوشته
// (مثل «4.2 MB») و مسیر `/pdfs/*.pdf` معرفی می‌کرد، در حالی که پوشه‌ی
// `public/pdfs/` اصلاً وجود نداشت. نتیجه: هر دکمه‌ی «دانلود PDF» یک ۴۰۴
// واقعی بود، حجم فایل‌ها عدد ساختگی بود، و آمار صفحه‌ی اصلی («+۶ سند فنی
// قابل دانلود») یک ادعای نادرست را تبلیغ می‌کرد — دقیقاً همان الگوی
// داده‌ی جعلی که قانون پروژه ممنوع کرده است.
//
// راهکار: منبع حقیقت، «فایل واقعی روی دیسک» است. فقط اسنادی رندر می‌شوند
// که فایل‌شان در `public/` موجود باشد، و حجم دقیقاً از خود فایل خوانده
// می‌شود. به‌محض این‌که PDF واقعی در `public/pdfs/` قرار بگیرد، بدون هیچ
// تغییر کدی در سایت ظاهر می‌شود؛ و هیچ‌وقت لینک مرده منتشر نمی‌شود.
// ---------------------------------------------------------------------------
import { existsSync, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATASHEETS } from '../data/content';

/**
 * ریشه‌ی پوشه‌ی public.
 *
 * مسیر اصلی از `import.meta.url` گرفته می‌شود (مستقل از cwd فرایند بیلد).
 * اگر به هر دلیلی (مثلاً باندل‌شدن ماژول در مسیری متفاوت) آن مسیر معتبر
 * نبود، به `<cwd>/public` برمی‌گردیم. بدون این fallback، یک شکست خاموش
 * ممکن بود همه‌ی اسناد را «موجود نیست» تشخیص دهد و بی‌سروصدا حذف کند.
 */
function resolvePublicDir(): string {
  const fromModule = fileURLToPath(new URL('../../public/', import.meta.url));
  if (existsSync(fromModule)) return fromModule;

  const cwd = (globalThis as { process?: { cwd?: () => string } }).process?.cwd?.();
  return cwd ? join(cwd, 'public') + sep : fromModule;
}

const PUBLIC_DIR = resolvePublicDir();

export interface AvailableDatasheet {
  title: string;
  brand: string;
  brandEn: string;
  type: string;
  /** مسیر عمومی فایل، مثلاً `/pdfs/demag-k-series.pdf` */
  file: string;
  /** پسوند بزرگ‌نویسی‌شده، از روی خود مسیر فایل (نه فیلد دستی). */
  ext: string;
  /** حجم واقعی فایل روی دیسک، قالب‌بندی‌شده — هرگز مقدار دستی. */
  size: string;
  /** حجم خام بر حسب بایت (برای Schema.org contentSize در آینده). */
  sizeBytes: number;
}

/** قالب‌بندی بایت به مگابایت/کیلوبایت با ارقام لاتین (خوانا و dir-safe). */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * فقط اسناد فنی‌ای که فایل واقعی‌شان در `public/` موجود است.
 *
 * هر ورودی‌ای که فایلش پیدا نشود بی‌سروصدا حذف می‌شود (به‌جای انتشار یک
 * لینک ۴۰۴). یک هشدار در لاگ بیلد ثبت می‌شود تا این حذف پنهان نماند.
 */
export function getAvailableDatasheets(): AvailableDatasheet[] {
  const available: AvailableDatasheet[] = [];
  const missing: string[] = [];

  for (const doc of DATASHEETS) {
    // مسیرهای خارجی (http/https) قابل بررسی روی دیسک نیستند و در حال حاضر
    // پشتیبانی نمی‌شوند — همه‌ی اسناد باید در public/ سلف‌هاست شوند تا
    // سرعت و پایداری دانلود از داخل ایران تضمین شود.
    if (!doc.file.startsWith('/')) {
      missing.push(doc.file);
      continue;
    }

    const absolutePath = normalize(join(PUBLIC_DIR, doc.file));

    // محافظت در برابر Path Traversal — حتی با این‌که منبع فعلی یک فایل
    // ثابت داخل ریپو است، وقتی این آرایه در آینده از وردپرس پر شود مقدار
    // دیگر قابل‌اعتماد نیست. بررسی یک‌بار اینجا، ارزان و همیشگی است.
    if (!absolutePath.startsWith(PUBLIC_DIR.endsWith(sep) ? PUBLIC_DIR : PUBLIC_DIR + sep)) {
      missing.push(doc.file);
      continue;
    }

    try {
      const stats = statSync(absolutePath);
      if (!stats.isFile() || stats.size === 0) {
        missing.push(doc.file);
        continue;
      }

      const extFromPath = doc.file.split('.').pop()?.toUpperCase() ?? 'PDF';

      available.push({
        title: doc.title,
        brand: doc.brand,
        brandEn: doc.brandEn,
        type: doc.type,
        file: doc.file,
        ext: extFromPath,
        size: formatBytes(stats.size),
        sizeBytes: stats.size,
      });
    } catch {
      missing.push(doc.file);
    }
  }

  if (missing.length > 0) {
    console.warn(
      `[datasheets] ${missing.length} سند به‌دلیل نبودِ فایل واقعی منتشر نشد ` +
        `(جلوگیری از لینک ۴۰۴): ${missing.join(', ')}. ` +
        `فایل‌های PDF را در public/pdfs/ قرار دهید تا خودکار نمایش داده شوند.`
    );
  }

  return available;
}
