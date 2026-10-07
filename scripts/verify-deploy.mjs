#!/usr/bin/env node
// scripts/verify-deploy.mjs  [site-origin]
// ---------------------------------------------------------------------------
// پس از هر انتشار، رفتار *واقعی* سرور را می‌سنجد (نه فایل‌های dist): ۳۰۱ واقعی،
// HTTPS، اسلش پایانی، ۴۰۴، و اینکه فایل‌های داخلی از بیرون خوانده نمی‌شوند.
// چرا: build فقط فایل می‌سازد؛ اینکه Apache واقعاً آن را اجرا کرده یا نه (فایل مخفی
// آپلود شد؟ AllowOverride روشن است؟) فقط از بیرون معلوم می‌شود. منطق خالص است و با
// پاسخ‌های ساختگی آزمون می‌شود (verify-deploy.test.mjs).
// ---------------------------------------------------------------------------
import { pathToFileURL } from 'node:url';
import { LEGACY_REDIRECTS, SITE_ORIGIN } from '../src/data/legacy-redirects.mjs';

/** @returns {{ name: string, url: string, redirect: 'manual'|'follow', check: (r: {status:number, location:string, body:string}) => string|null }[]} */
export function buildChecks(origin = SITE_ORIGIN) {
  const checks = [];
  const host = new URL(origin).host;

  checks.push({
    name: 'صفحه‌ی اصلی ۲۰۰ و canonical درست',
    url: `${origin}/`,
    redirect: 'follow',
    check: (r) =>
      r.status !== 200
        ? `کد ${r.status} (انتظار ۲۰۰)`
        : r.body.includes(`rel="canonical" href="${origin}/"`)
          ? null
          : 'canonical صفحه‌ی اصلی پیدا نشد',
  });
  // ⚠️ نماد اینماد باید در HTML صفحه‌ی اصلی باشد: خزنده‌ی اینماد با کد نماد روی دامنه تأیید می‌کند.
  checks.push({
    name: 'نماد اینماد (قطعه‌کد رسمی) در صفحه‌ی اصلی',
    url: `${origin}/`,
    redirect: 'follow',
    check: (r) =>
      /trustseal\.enamad\.ir\/\?id=\d+&(?:amp;)?Code=[A-Za-z0-9]+/.test(r.body) && /referrerpolicy="origin"/.test(r.body) && /code="[A-Za-z0-9]+"/.test(r.body)
        ? null
        : 'قطعه‌کد اینماد (لینک trustseal، referrerpolicy، code) پیدا نشد',
  });
  for (const path of ['/robots.txt', '/sitemap-index.xml', '/sitemap-0.xml']) {
    checks.push({ name: `${path} ۲۰۰`, url: `${origin}${path}`, redirect: 'follow', check: (r) => (r.status === 200 ? null : `کد ${r.status}`) });
  }
  for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
    const want = `${origin}${to}`;
    checks.push({
      name: `ریدایرکت ۳۰۱ ${from}`,
      url: `${origin}${from}`,
      redirect: 'manual',
      check: (r) => (r.status !== 301 ? `کد ${r.status} (انتظار ۳۰۱ واقعی)` : r.location === want ? null : `مقصد «${r.location}» (انتظار «${want}»)`),
    });
  }
  checks.push({
    name: 'بدون اسلش پایانی → ۳۰۱ به نسخه‌ی با اسلش',
    url: `${origin}/about`,
    redirect: 'manual',
    check: (r) => (r.status !== 301 ? `کد ${r.status}` : r.location === `${origin}/about/` ? null : `مقصد «${r.location}»`),
  });
  checks.push({
    name: 'HTTP → HTTPS با یک ۳۰۱',
    url: `http://${host}/about/`,
    redirect: 'manual',
    check: (r) => (r.status !== 301 ? `کد ${r.status}` : r.location === `${origin}/about/` ? null : `مقصد «${r.location}»`),
  });
  checks.push({
    name: `www → ${host} با یک ۳۰۱`,
    url: `https://www.${host}/about/`,
    redirect: 'manual',
    check: (r) => (r.status !== 301 ? `کد ${r.status}` : r.location === `${origin}/about/` ? null : `مقصد «${r.location}»`),
  });
  checks.push({
    name: 'مسیر ناموجود ۴۰۴ (نه ۲۰۰ و نه ریدایرکت) با صفحه‌ی ۴۰۴ سایت',
    url: `${origin}/this-page-does-not-exist-verify/`,
    redirect: 'manual',
    check: (r) => (r.status !== 404 ? `کد ${r.status} (انتظار ۴۰۴)` : /<html/i.test(r.body) ? null : 'بدنه‌ی ۴۰۴ صفحه‌ی HTML سایت نیست'),
  });
  // ⚠️ دارایی‌های هش‌دار و فونت باید کش یک‌ساله بگیرند (Lighthouse «cache lifetime»؛ بازدید دوم بدون شبکه).
  checks.push({
    name: 'فونت: Cache-Control یک‌ساله',
    url: `${origin}/fonts/Vazirmatn-Variable.woff2`,
    redirect: 'follow',
    check: (r) => (r.status !== 200 ? `کد ${r.status}` : /max-age=31536000/.test(r.cacheControl ?? '') ? null : `Cache-Control = «${r.cacheControl ?? ''}»`),
  });
  for (const path of ['/.htaccess', '/.ftp-deploy-sync-state.json']) {
    checks.push({
      name: `${path} از بیرون خوانده نشود`,
      url: `${origin}${path}`,
      redirect: 'manual',
      check: (r) => (r.status === 200 ? 'قابل‌خواندن است!' : null),
    });
  }
  return checks;
}

async function main() {
  const origin = (process.argv[2] || SITE_ORIGIN).replace(/\/$/, '');
  let failed = 0;
  for (const c of buildChecks(origin)) {
    let error;
    try {
      const res = await fetch(c.url, { redirect: c.redirect, headers: { 'user-agent': 'craneyadak-verify-deploy' } });
      const body = (res.status === 200 || res.status === 404) && !/font|image/.test(res.headers.get('content-type') ?? '') ? await res.text() : '';
      error = c.check({ status: res.status, location: res.headers.get('location') ?? '', body, cacheControl: res.headers.get('cache-control') ?? '' });
    } catch (e) {
      error = `اتصال ناموفق: ${e instanceof Error ? e.message : e}`;
    }
    console.log(`${error ? '❌' : '✅'} ${c.name}${error ? ` — ${error}` : ''}`);
    if (error) failed++;
  }
  if (failed) {
    console.error(`\n❌ ${failed} بررسی پس از انتشار ناموفق بود.`);
    process.exit(1);
  }
  console.log('\n✅ رفتار واقعی سرور با انتظار یکی است.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
