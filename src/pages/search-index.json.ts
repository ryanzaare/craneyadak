// src/pages/search-index.json.ts
// ---------------------------------------------------------------------------
// فهرست جستجوی محصولات — به‌صورت یک فایل استاتیک منتشر می‌شود.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا این فایل وجود دارد
// ═══════════════════════════════════════════════════════════════════════════
// کادر جستجو در هدر است، یعنی روی *هر* صفحه رندر می‌شود. تا پیش از این،
// کل فهرست پیشنهاد — شامل همه‌ی محصولات با نام، کد فنی و همه‌ی کدهای
// معادل OEM — به‌صورت JSON داخل HTML هر صفحه قرار می‌گرفت.
//
// با دو محصول، چند کیلوبایت بود و در هیچ تستی دیده نمی‌شد. با ۵۰۰ محصول
// و چند کد معادل برای هرکدام، همان الگو به صدها کیلوبایت روی *هر*
// بازدید تبدیل می‌شد — از جمله صفحاتی که کاربر اصلاً جستجو نمی‌کند.
// این دقیقاً همان نوع خرابی است که هرگز خودش را نشان نمی‌دهد و فقط
// نمودار Core Web Vitals را به‌مرور خراب می‌کند.
//
// حالا این لایه یک فایل مستقل است:
//   • فقط یک‌بار دانلود می‌شود، آن هم وقتی کاربر واقعاً با کادر جستجو
//     تعامل کند (focus یا اولین تایپ).
//   • مرورگر آن را کش می‌کند، پس در صفحات بعدی دوباره دانلود نمی‌شود.
//   • حجم صفحات دیگر با رشد کاتالوگ ثابت می‌ماند.
//
// لایه‌ی ساختاری (سیلو/دسته/برند) عمداً همچنان inline است: اندازه‌اش
// ثابت و کوچک است و باید از همان اولین کاراکتر بدون تاخیر شبکه پاسخ
// بدهد.
//
// ⚠️ خروجی سایت استاتیک است (`output: 'static'`)، پس این مسیر در زمان
// build یک‌بار اجرا و به یک فایل واقعی `dist/search-index.json` تبدیل
// می‌شود — نه یک اندپوینت زمان‌اجرا. هیچ وابستگی زمان‌اجرایی به وردپرس
// اضافه نمی‌کند.
// ---------------------------------------------------------------------------

// ⚠️ (۴ آذر ۱۴۰۵، O32) حالا *همه‌ی* لایه‌ها: ساختار (سیلو/دسته/برند) + محصولات با تصویر ۱۶۰px، موجودی و اصالت.
// تنها مصرف‌کننده‌ها پنل جستجوی فوری (src/scripts/search-overlay.ts) و صفحه‌ی /search/ هستند و هر دو فقط با تعامل
// کاربر واکشی می‌کنند. لایه‌ی ساختاری دیگر در HTML هیچ صفحه‌ای inline نیست (SearchBox.astro حذف شد) — پس این فایل
// تنها منبع است. نشانی‌های ساختاری «/» پایانی می‌گیرند (هر کلیک بی‌آن یک ۳۰۱ اضافه بود).
import { getImage } from 'astro:assets';
import { buildProductIndex, buildStructuralIndex } from '../lib/search-index';
import { getAllProducts } from '../lib/wp';
import { withTrailingSlash } from '../lib/urls.mjs';

export async function GET() {
  const products = (await getAllProducts()).filter((p) => !p.isDemo);
  const extras = new Map(
    await Promise.all(products.map(async (p) => [p.slug, {
      image: p.images[0] ? (await getImage({ src: p.images[0].url, width: 160, height: 160, format: 'avif', inferSize: false })).src : undefined,
      stock: p.stockStatus,
      original: p.authenticity === 'original' || undefined,
    }] as const)),
  );
  // شمار کالای هر دسته — حالت خالی پنل فقط دسته‌های دارای کالا را پیشنهاد می‌دهد (۲۷ دسته‌ی خالی وعده‌ی توخالی‌اند).
  const catCount = new Map<string, number>();
  for (const p of products) for (const c of p.categorySlugs) catCount.set(c, (catCount.get(c) ?? 0) + 1);
  const index = [
    ...buildProductIndex(products).map((e) => ({ ...e, ...extras.get(e.href.split('/')[2] ?? '') })),
    ...buildStructuralIndex().map((e) => ({ ...e, href: withTrailingSlash(e.href), ...(e.kind === 'category' ? { count: catCount.get(e.href.split('/')[3] ?? '') ?? 0 } : {}) })),
  ];

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // فایل با هر build دوباره تولید می‌شود و نامش ثابت است، پس کش
      // طولانی خطرناک است: کاربر ممکن است فهرست قدیمی ببیند. یک ساعت
      // کش با revalidate، تعادل بین سرعت و تازگی است.
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
}
