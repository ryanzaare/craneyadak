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
  lines.push('</IfModule>', '', 'ErrorDocument 404 /404.html', '');
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
  console.log(`✅ ${dist}/.htaccess ساخته شد — ${Object.keys(LEGACY_REDIRECTS).length} ریدایرکت ۳۰۱ + HTTPS + www + 404.`);
}
