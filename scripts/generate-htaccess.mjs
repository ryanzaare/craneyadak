#!/usr/bin/env node
// scripts/generate-htaccess.mjs  [dist-dir]
// ---------------------------------------------------------------------------
// dist/.htaccess برای cPanel/Apache: 301 واقعی + HTTPS + www→بدون‌www + 404.
//
// ⚠️ خروجی استاتیک Astro برای ریدایرکت فقط meta-refresh (کد 200) می‌سازد و
// public/_redirects قالب Netlify است که Apache نمی‌خواند. این فایل تنها راه
// 301 واقعی روی هاست فعلی است. از src/data/legacy-redirects.mjs ساخته می‌شود
// (تنها منبع)، نه از فهرست دستی دوم که واگرا شود.
//
// ⚠️ هر ریدایرکت مستقیم به نشانی نهایی کامل (https + بدون www + با «/») می‌رود:
// یک مرحله، نه زنجیره‌ی «http→https→www→بدون /→با /».
//
// ⚠️ شرط HTTPS به X-Forwarded-Proto هم نگاه می‌کند: پشت Cloudflare/پروکسی،
// %{HTTPS} همیشه off است و بدون این شرط حلقه‌ی ریدایرکت بی‌پایان می‌شود.
// ---------------------------------------------------------------------------
import { writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { LEGACY_REDIRECTS, LEGACY_WILDCARDS, SITE_ORIGIN } from '../src/data/legacy-redirects.mjs';

const escapeRe = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * فایل‌های کوچک .htaccess داخل پوشه‌ها: هدر کش بلندمدت. چرا فایل جدا داخل پوشه، نه
 * FilesMatch در فایل ریشه: پوشه‌ی /_astro/ نام‌هایش هش‌دار است (تغییر محتوا = نام تازه) پس
 * یک‌ساله و immutable امن است؛ ولی /fonts/ نام ثابت دارد و فایل ریشه نمی‌تواند این دو را
 * بدون <If> (که همه‌ی سرورها پشتیبانی نمی‌کنند) از هم جدا کند.
 */
export const CACHE_DIRS = {
  '_astro': 'public, max-age=31536000, immutable',
  fonts: 'public, max-age=31536000, immutable',
};

/**
 * هدرهای امنیتی همه‌ی پاسخ‌ها. تا ۱۹ آبان ۱۴۰۵ سایت زنده *هیچ‌کدام* را نمی‌فرستاد (سنجیده با fetch روی
 * craneyadak.com). هیچ‌کدام رفتار صفحه را عوض نمی‌کند:
 *  • HSTS شش‌ماهه، بدون includeSubDomains (admin.craneyadak.com جدا می‌ماند) و بدون preload (برگشت‌ناپذیر است).
 *  • nosniff: مرورگر نوع فایل را حدس نزند.
 *  • X-Frame-Options: سایت داخل iframe دامنه‌ی دیگر باز نشود (کلیک‌دزدی روی پرداخت/حساب). فاکتور خود سایت srcdoc
 *    است و نقشه‌ی تماس iframe *خروجی* — این هدر به هیچ‌کدام کاری ندارد.
 *  • Permissions-Policy: سایت دوربین/میکروفون/موقعیت نمی‌خواهد؛ iframe نقشه هم نگیرد.
 * ⚠️ `Header set` نه `Header always set`: همین شکل در .htaccess پوشه‌ی /fonts/ روی LiteSpeed هاست کار می‌کند
 * (verify-deploy آن را می‌سنجد)؛ شکل always روی این سرور آزموده نشده است.
 * ⚠️ CSP عمداً نیست: CSS و اسکریپت‌های inline (inlineStylesheets: 'always'، JSON-LD، نماد اینماد) بدون nonce
 * زیر CSP سخت‌گیر می‌شکنند و سایت استاتیک nonce ندارد.
 */
export const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=15552000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * عمر کش HTML به ثانیه. ⚠️ چرا لازم است: سرور برای HTML هیچ Cache-Control نمی‌فرستاد، پس مرورگر «کش اکتشافی»
 * می‌کرد: ۱۰٪ از سنّ Last-Modified. صفحه‌ای که دو هفته دست نخورده بود ~۳۳ ساعت بدون پرسیدن از سرور از کش می‌آمد —
 * یعنی پس از انتشار، بازدیدکننده‌ی برگشتی (و خود کارفرما) تا یک روز و نیم نسخه‌ی قدیمی را می‌دید، با اسکریپت‌های
 * هش‌داری که دیگر روی سرور نیستند. ۱۰ دقیقه: prefetch «tap» هنوز ناوبری آنی می‌دهد و کهنگی سقف دارد.
 */
export const HTML_MAX_AGE = 600;

/** پوشه‌های دارایی که index ندارند: LiteSpeed فهرست فایل‌هایشان را نشان می‌داد («Index of /fonts/» روی سایت زنده). */
export const NO_LISTING_DIRS = ['_astro', 'fonts', 'pagefind'];

export function buildCacheHtaccess(value) {
  return `# تولیدشده توسط scripts/generate-htaccess.mjs — دستی ویرایش نکنید.
<IfModule mod_headers.c>
Header set Cache-Control "${value}"
</IfModule>
`;
}

export function buildHtaccess(redirects = LEGACY_REDIRECTS, wildcards = LEGACY_WILDCARDS, origin = SITE_ORIGIN) {
  const host = new URL(origin).host;
  const lines = [
    '# تولیدشده توسط scripts/generate-htaccess.mjs — دستی ویرایش نکنید.',
    '# منبع ریدایرکت‌ها: src/data/legacy-redirects.mjs',
    '',
    '<IfModule mod_rewrite.c>',
    'RewriteEngine On',
    '# HTTP → HTTPS (پشت پروکسی X-Forwarded-Proto را هم می‌خواند). /.well-known/ مستثناست:',
    '# تمدید خودکار SSL (AutoSSL/ACME) آن مسیر را روی HTTP می‌خواند و ریدایرکت ممکن است آن را بشکند.',
    'RewriteCond %{REQUEST_URI} !^/\\.well-known/ [NC]',
    'RewriteCond %{HTTPS} !=on',
    'RewriteCond %{HTTP:X-Forwarded-Proto} !https [NC]',
    `RewriteRule ^ ${origin}%{REQUEST_URI} [L,R=301]`,
    '# www → بدون www',
    `RewriteCond %{HTTP_HOST} ^www\\.${escapeRe(host)}$ [NC]`,
    `RewriteRule ^ ${origin}%{REQUEST_URI} [L,R=301]`,
    '</IfModule>',
    '',
    '<IfModule mod_alias.c>',
  ];
  for (const [from, to] of Object.entries(redirects)) {
    const fromClean = from.replace(/\/$/, '');
    const pattern = wildcards.includes(fromClean) ? `^${escapeRe(fromClean)}(/.*)?$` : `^${escapeRe(fromClean)}/?$`;
    lines.push(`RedirectMatch 301 ${pattern} ${origin}${to}`);
  }
  // فایل وضعیت انتشار FTP (فهرست همه‌ی فایل‌های سایت) از بیرون قابل‌خواندن نباشد.
  lines.push('# فایل وضعیت GitHub Actions (SamKirkland/FTP-Deploy-Action) از بیرون 410 شود', 'RedirectMatch gone ^/\\.ftp-deploy-sync-state\\.json$');
  // ⚠️ `gone` (۴۱۰) نه `Options -Indexes`: Options در .htaccess به AllowOverride وابسته است و خطایش ۵۰۰ روی *کل*
  // سایت است؛ `RedirectMatch gone` همان دستوری است که خط بالا را روی همین سرور اجرا می‌کند. ۴۱۰ ضمناً صفحه‌های
  // «Index of …» را که شاید ایندکس شده باشند زودتر از ۴۰۴ از گوگل بیرون می‌برد.
  lines.push('# فهرست پوشه‌های دارایی (Index of /fonts/ …) بسته شود', `RedirectMatch gone ^/(${NO_LISTING_DIRS.map(escapeRe).join('|')})(/.*)?/$`);
  lines.push('</IfModule>', '');
  lines.push('<IfModule mod_headers.c>', ...Object.entries(SECURITY_HEADERS).map(([k, v]) => `Header set ${k} "${v}"`), '</IfModule>', '');
  lines.push(
    '# HTML: کش کوتاه و صریح (بدون این، مرورگر تا ده‌ها ساعت نسخه‌ی قدیمی را نشان می‌دهد)',
    '<IfModule mod_expires.c>',
    'ExpiresActive On',
    `ExpiresByType text/html "access plus ${HTML_MAX_AGE} seconds"`,
    '</IfModule>',
    '',
  );
  lines.push('ErrorDocument 404 /404.html', '');
  return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dist = process.argv[2] || 'dist';
  if (!existsSync(dist)) {
    console.error(`❌ پوشه‌ی ${dist} نیست — پس از build اجرا شود.`);
    process.exit(1);
  }
  writeFileSync(`${dist}/.htaccess`, buildHtaccess());
  for (const [dir, value] of Object.entries(CACHE_DIRS)) {
    if (existsSync(`${dist}/${dir}`)) writeFileSync(`${dist}/${dir}/.htaccess`, buildCacheHtaccess(value));
  }
  console.log(`✅ ${dist}/.htaccess ساخته شد — ${Object.keys(LEGACY_REDIRECTS).length} ریدایرکت ۳۰۱ + HTTPS + www + 404 + ${Object.keys(SECURITY_HEADERS).length} هدر امنیتی + کش HTML ${HTML_MAX_AGE} ثانیه.`);
}
