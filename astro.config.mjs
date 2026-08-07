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

// https://astro.build/config
export default defineConfig({
  // ⚠️ حیاتی برای سئو: بدون این، canonical و sitemap آدرس درست تولید نمی‌کنند
  site: 'https://craneyadak.com',

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
