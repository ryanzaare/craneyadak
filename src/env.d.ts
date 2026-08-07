/// <reference types="astro/client" />

interface ImportMetaEnv {
  /**
   * آدرس پایه‌ی وردپرس برای واکشی کاتالوگ در زمان BUILD (بدون اسلش انتهایی)،
   * مثال: https://cms.craneyadak.com
   *
   * مصرف‌کننده: `src/lib/wp.ts` (فقط سمت سرور/بیلد — عمداً بدون پیشوند
   * PUBLIC_ تا داخل باندل کلاینت منتشر نشود).
   *
   * وقتی تعریف نشده باشد، صفحات دسته‌بندی/برند بدون هیچ محصولی («حالت
   * خالیِ صادقانه») بیلد می‌شوند و هیچ داده‌ی ساختگی تولید نمی‌شود.
   */
  readonly WP_GRAPHQL_URL?: string;

  /**
   * آدرس پایه‌ی وردپرس برای ارسال فرم استعلام از مرورگر کاربر (بدون اسلش
   * انتهایی)، مثال: https://cms.craneyadak.com
   *
   * مصرف‌کننده: `src/pages/contact.astro` →
   * `${PUBLIC_WP_API_URL}/wp-json/crane/v1/inquiry`.
   *
   * وقتی تعریف نشده باشد، فرم رندر نمی‌شود و کانال‌های تماس مستقیم
   * (تلفن/واتساپ/تلگرام) جایگزین آن می‌شوند — نگاه کنید به
   * docs/backend-integration.md بخش ۶.
   */
  readonly PUBLIC_WP_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
