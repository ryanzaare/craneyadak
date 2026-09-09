// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// ---------------------------------------------------------------------------
// نقشه‌ی ریدایرکت: مسیرهای تخت قدیمی → مسیرهای تودرتوی سیلو.
//
// چرا لازم است: ساختار قبلی `/categories/[slug]` بود و ۸ دسته با آن آدرس‌ها
// منتشر شده بودند. ساختار جدید `/categories/[silo]/[category]` است تا
// سلسله‌مراتب سیلو در URL و بردکرامب منعکس شود. بدون 301، هر لینک خارجی و
// هر ارزش خزش انباشته‌ی آن آدرس‌ها از بین می‌رود.
//
// ⚠️ محدودیت خروجی استاتیک: Astro در حالت static برای این‌ها صفحه‌ی
// meta-refresh می‌سازد، نه پاسخ 301 واقعی. گوگل آن را دنبال می‌کند اما
// 301 سمت سرور به‌مراتب تمیزتر است — به همین دلیل `public/_redirects` هم
// تولید شده و قوانین معادل nginx/apache در docs/deployment-guide.md آمده.
// ---------------------------------------------------------------------------
const legacyCategoryRedirects = {
  '/categories/remote-control': '/categories/control-safety/remote-control',
  '/categories/conductor-bar': '/categories/power-supply/busbar-power-line',
  '/categories/crane-wheels': '/categories/drive-units/crane-wheel',
  '/categories/rope-guide': '/categories/hoist-accessories/rope-guide',
  '/categories/crane-hook': '/categories/lifting-rigging/crane-hook',
  '/categories/brake-disk': '/categories/brake/brake-wheel-disc',
  // آدرس قدیمی «wire-rope-hoist» در واقع «موتور گیربکس و وینچ» بود (نه
  // جرثقیل بکسلی) — طبق blurb همان صفحه. بنابراین به موتور گیربکس می‌رود.
  '/categories/wire-rope-hoist': '/categories/drive-units/gearbox-motor',
  // «جاروبک» در فهرست نهایی جا افتاده بود؛ کارفرما تایید کرد که فروخته
  // می‌شود و صفحه‌ی اختصاصی خودش را نگه می‌دارد (زیر سیلوی برق‌رسانی).
  // اسلاگ یکسان مانده و فقط یک سطح تودرتو شده است.
  '/categories/current-collector': '/categories/power-supply/current-collector',
  // بخش صنایع حذف شد — آدرس‌های قدیمی نباید ۴۰۴ بدهند.
  '/industries': '/categories',
};

// https://astro.build/config
export default defineConfig({
  // ⚠️ حیاتی برای سئو: بدون این، canonical و sitemap آدرس درست تولید نمی‌کنند
  site: 'https://craneyadak.com',

  redirects: legacyCategoryRedirects,

  build: {
    inlineStylesheets: 'auto',
  },

  // ---------------------------------------------------------------------------
  // بهینه‌سازی تصویر در زمان BUILD.
  //
  // چرا این تنظیم حیاتی است: تصاویر محصول از کتابخانه‌ی رسانه‌ی وردپرس
  // می‌آیند. بدون این، یا باید همان JPEG اصلی چندمگابایتی مدیر محتوا مستقیم
  // به موبایل کاربر برود (فاجعه‌ی سرعت)، یا سایت بدون تصویر بماند (فاجعه‌ی
  // سئو و نرخ تبدیل — خریدار صنعتی باید قطعه را ببیند تا مطمئن شود).
  //
  // با این تنظیم، Astro تصاویر را در بیلد دانلود، ریسایز و به AVIF/WebP
  // تبدیل می‌کند و خروجی فایل ثابت است؛ بازدیدکننده هرگز به وردپرس وصل
  // نمی‌شود.
  //
  // `domains` عمداً محدود است: بدون آن هر URL دلخواهی می‌توانست بیلد ما را
  // به سرویس رایگان پردازش تصویر تبدیل کند.
  // ---------------------------------------------------------------------------
  image: {
    domains: ['admin.craneyadak.com'],
    // زیردامنه‌های احتمالی CDN همان وردپرس در آینده.
    remotePatterns: [{ protocol: 'https', hostname: '**.craneyadak.com' }],
  },

  // پیش‌بارگذاری هوشمند لینک‌های داخلی برای ناوبری آنی سمت کلاینت.
  // استراتژی «tap» عمداً به‌جای «viewport» انتخاب شده: در شبکه‌ی موبایل
  // ایران (اغلب محدود/حجمی)، پیش‌بارگذاری هر لینکی که وارد ویوپورت شود
  // حجم داده‌ی کاربر را در صفحاتی مثل /categories که ده‌ها لینک دارند
  // هدر می‌دهد. «tap» فقط چند میلی‌ثانیه پیش از کلیک/لمس واقعی fetch
  // می‌کند: تجربه‌ی ناوبری تقریباً آنی بدون اتلاف پهنای باند.
  prefetch: {
    defaultStrategy: 'tap',
  },

  // تولید خودکار sitemap-index.xml + sitemap-0.xml روی هر build
  // (robots.txt از قبل به همین مسیر پیش‌فرض اشاره می‌کند)
  integrations: [
    sitemap({
      // صفحه‌ی جستجو و صفحه‌ی تشکر (thank-you) عمداً noindex هستند؛ حذف
      // آن‌ها از sitemap جلوی هشدار Search Console («Submitted URL marked
      // noindex») را می‌گیرد. صفحه‌ی /datasheets هم تا انتشار اولین PDF
      // واقعی noindex است و به همین دلیل موقتاً از sitemap حذف می‌شود.
      // صفحات محصولِ نمایشی هرگز نباید در نقشه‌ی سایت بیایند. نام فایل
      // آن‌ها از اسلاگ ساخته می‌شود و اسلاگ فیکسچرها با `demo-` شروع
      // می‌شود (کد فنی DEMO- → اسلاگ demo-...).
      filter: (page) =>
        !page.includes('/products/demo-') &&
        !page.includes('/search') &&
        !page.includes('/thank-you') &&
        // The tracking page is noindex and has no public content.
        !page.includes('/track')
    }),
  ],

  vite: {
    plugins: [tailwindcss()]
  }
});
