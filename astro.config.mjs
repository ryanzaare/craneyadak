// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// ریدایرکت‌های قدیمی از src/data/legacy-redirects.mjs می‌آیند (تنها منبع).
// ⚠️ خروجی استاتیک Astro برای آن‌ها فقط صفحه‌ی meta-refresh (کد 200) می‌سازد؛
// 301 واقعی را `scripts/generate-htaccess.mjs` در postbuild به dist/.htaccess
// اضافه می‌کند. نگهبان: scripts/check-architecture.mjs (بررسی ۶).
// صفحه‌های ریدایرکت عمداً از ایندکس جستجوی داخلی بیرون‌اند؛ هشدار
// Pagefind درباره‌ی «صفحه بدون <html>» مربوط به همین‌هاست و
// `scripts/check-pagefind.mjs` تعدادشان را با همین فهرست تطبیق می‌دهد.
import { LEGACY_REDIRECTS, SITE_ORIGIN } from './src/data/legacy-redirects.mjs';

// https://astro.build/config
export default defineConfig({
  // ⚠️ حیاتی برای سئو: بدون این، canonical و sitemap آدرس درست تولید نمی‌کنند
  site: SITE_ORIGIN,

  redirects: LEGACY_REDIRECTS,

  build: {
    // ⚠️ 'always' (آزمایشی، ۱۵ مهر ۱۴۰۵): با 'auto' فایل CSS ۱۲٫۸KB (فشرده) جدا می‌ماند و رندر را
    // مسدود می‌کرد؛ روی سرور زنده (تأخیر شبکه‌ی بالا) هر درخواست اضافه ≈ ۰٫۳ تا ۰٫۸ ثانیه به FCP/Speed Index
    // اضافه می‌کند و Lighthouse دسکتاپ ۹۲ بود (نه ۹۹ محلی). هزینه: همین CSS در هر صفحه‌ی HTML تکرار می‌شود
    // (کش بین‌صفحه‌ای ندارد). اگر Lighthouse زنده بهتر نشد، به 'auto' برگردانید.
    inlineStylesheets: 'always',
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
        !page.includes('/track') &&
        // ⚠️ حساب کاربری و پرداخت noindex هستند. نبودشان در این فهرست ۷
        // صفحه‌ی /account را هفته‌ها در sitemap نگه داشت (ایست ۶). حالا
        // scripts/check-sitemap-noindex.mjs در postbuild هر نشانی sitemap را
        // با متای robots همان صفحه می‌سنجد — این فهرست دستی دیگر تنها
        // نگهبان نیست.
        !page.includes('/account/') &&
        !page.includes('/checkout/')
    }),
  ],

  vite: {
    plugins: [tailwindcss()]
  }
});
