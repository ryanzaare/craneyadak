// @ts-check
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// ---------------------------------------------------------------------------
// آیا حداقل یک سند فنی واقعی برای دانلود منتشر شده است؟
//
// صفحه‌ی /datasheets تا وقتی هیچ PDF واقعی در public/pdfs/ نباشد `noindex`
// است (نگاه کنید به src/pages/datasheets/index.astro). این بررسی، همان
// تصمیم را در sitemap هم اعمال می‌کند تا Search Console هشدار
// «Submitted URL marked noindex» ندهد. به‌محض افزودن اولین فایل، صفحه
// خودکار هم قابل‌ایندکس می‌شود و هم به sitemap برمی‌گردد.
// ---------------------------------------------------------------------------
const pdfDir = fileURLToPath(new URL('./public/pdfs/', import.meta.url));
const hasPublishedDatasheets =
  existsSync(pdfDir) && readdirSync(pdfDir).some((file) => file.toLowerCase().endsWith('.pdf'));

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
};

// https://astro.build/config
export default defineConfig({
  // ⚠️ حیاتی برای سئو: بدون این، canonical و sitemap آدرس درست تولید نمی‌کنند
  site: 'https://craneyadak.com',

  redirects: legacyCategoryRedirects,

  build: {
    inlineStylesheets: 'auto',
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
      filter: (page) =>
        !page.includes('/search') &&
        !page.includes('/thank-you') &&
        (hasPublishedDatasheets || !page.replace(/\/$/, '').endsWith('/datasheets')),
    }),
  ],

  vite: {
    plugins: [tailwindcss()]
  }
});
