// src/data/legacy-redirects.mjs
// ---------------------------------------------------------------------------
// **تنها منبع** ریدایرکت‌های قدیمی. دو خروجی از همین فهرست ساخته می‌شود:
//   • astro.config.mjs → صفحه‌ی meta-refresh (پشتیبان، وقتی سرور 301 ندارد)
//   • scripts/generate-htaccess.mjs → 301 واقعیِ Apache در dist/.htaccess
// قبلاً دو فهرست دستی (astro.config + public/_redirects) بود و
// `_redirects` قالب Netlify است که روی cPanel/Apache هیچ اثری نداشت.
//
// مقصد همیشه با «/» پایانی است (شکل canonical؛ نگاه کنید به src/lib/urls.mjs)
// تا ریدایرکت یک‌مرحله‌ای بماند، نه زنجیره‌ی «→ بدون / → با /».
// ---------------------------------------------------------------------------

export const SITE_ORIGIN = 'https://craneyadak.com';

export const LEGACY_REDIRECTS = {
  '/categories/remote-control': '/categories/control-safety/remote-control/',
  '/categories/conductor-bar': '/categories/power-supply/busbar-power-line/',
  '/categories/crane-wheels': '/categories/drive-units/crane-wheel/',
  '/categories/rope-guide': '/categories/hoist-accessories/rope-guide/',
  '/categories/crane-hook': '/categories/lifting-rigging/crane-hook/',
  '/categories/brake-disk': '/categories/brake/brake-wheel-disc/',
  // آدرس قدیمی «wire-rope-hoist» در واقع «موتور گیربکس و وینچ» بود (نه
  // جرثقیل بکسلی) — طبق blurb همان صفحه. بنابراین به موتور گیربکس می‌رود.
  '/categories/wire-rope-hoist': '/categories/drive-units/gearbox-motor/',
  // «جاروبک» در فهرست نهایی جا افتاده بود؛ کارفرما تایید کرد که فروخته
  // می‌شود و صفحه‌ی اختصاصی خودش را نگه می‌دارد (زیر سیلوی برق‌رسانی).
  // اسلاگ یکسان مانده و فقط یک سطح تودرتو شده است.
  '/categories/current-collector': '/categories/power-supply/current-collector/',
  // بخش صنایع حذف شد — آدرس‌های قدیمی نباید ۴۰۴ بدهند.
  '/industries': '/categories/',
};

/** زیرمسیرهای این پیشوندها هم به همان مقصد می‌روند (فقط در .htaccess معنا دارد). */
export const LEGACY_WILDCARDS = ['/industries'];
