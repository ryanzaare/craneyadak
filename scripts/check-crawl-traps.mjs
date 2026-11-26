#!/usr/bin/env node
// scripts/check-crawl-traps.mjs  [dist-dir]   — postbuild؛ خودآزمون: --self-test
// ---------------------------------------------------------------------------
// ⚠️ چرا (مدیرعامل، ۶ آذر ۱۴۰۵): سایت دیگری که تیم دیگری ساخته بود صفحه‌های مقایسه‌ی محصول افزود، هزاران پیوند
// تازه ساخت، sitemap به هم ریخت و Search Console هزاران صفحه‌ی «ایندکس‌نشده» گزارش کرد. کرین یدک حالا مقایسه، فیلتر
// و جستجوی فوری دارد — هر سه وضعیتشان را در نشانی (?p=، ?f_…، ?q=) نگه می‌دارند. تا امروز هیچ‌کدام پیوند <a> قابل
// خزش نمی‌سازند (فقط history.replaceState و دکمه‌ی کپی)؛ این بررسی همین را تضمین می‌کند، نه حافظه.
//
// قاعده‌ها روی HTML ساخته‌شده:
//   ۱) هیچ پیوند داخلی <a href> با رشته‌ی پرس‌وجو (?) — هر ترکیب فیلتر/مقایسه/جستجو یک نشانی تازه برای گوگل است.
//      استثنا فقط فهرست صریح ALLOW (امروز خالی).
//   ۲) /compare/ و /search/ فقط همان یک صفحه‌اند و noindex دارند؛ /compare/embed/ noindex, nofollow.
//   ۳) شمار نشانی‌های sitemap نباید از شمار صفحه‌های HTML ایندکس‌پذیر بیشتر شود (sitemap فقط از صفحه‌ی واقعی).
// ---------------------------------------------------------------------------
import { readFileSync, globSync, existsSync } from 'node:fs';

const ALLOW = []; // نشانی داخلی با پرس‌وجو که عمداً پیوند می‌شود — هر افزودن دلیل مکتوب می‌خواهد.

export function trapsIn(html, file = '') {
  const out = [];
  for (const [, href] of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
    const h = href.replace(/&amp;/g, '&');
    const internal = h.startsWith('/') && !h.startsWith('//') || /^https?:\/\/(www\.)?craneyadak\.com\//i.test(h);
    if (internal && h.includes('?') && !ALLOW.some((a) => h.startsWith(a))) out.push(`${file}: پیوند داخلی با پرس‌وجو «${h}»`);
  }
  return out;
}

if (process.argv.includes('--self-test')) {
  const cases = [
    ['<a href="/compare/?p=a,b">x</a>', 1], ['<a href="/categories/x/?f_ab=1&amp;brand=s">x</a>', 1],
    ['<a href="https://craneyadak.com/search/?q=saga">x</a>', 1], ['<a href="/search/">x</a>', 0],
    ['<a href="https://wa.me/98?text=x">x</a>', 0], ['<a href="/products/saga-saga1-l10/">x</a>', 0],
  ];
  let bad = 0;
  for (const [html, want] of cases) { const got = trapsIn(html).length; if (got !== want) { bad++; console.error(`✗ ${html} → ${got}, want ${want}`); } }
  if (bad) process.exit(1);
  console.log('✅ خودآزمون تله‌ی خزش گذشت (۶ ورودی، ۳ خراب).');
  process.exit(0);
}

const dist = process.argv[2] || 'dist';
const pages = globSync(`${dist}/**/*.html`);
const problems = pages.flatMap((f) => trapsIn(readFileSync(f, 'utf8'), f.slice(dist.length)));
const robots = (f) => (existsSync(f) ? /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)/i.exec(readFileSync(f, 'utf8'))?.[1] ?? '' : 'نیست');
for (const [f, want] of [[`${dist}/compare/index.html`, /noindex/], [`${dist}/search/index.html`, /noindex/], [`${dist}/compare/embed/index.html`, /noindex.*nofollow/]]) {
  if (existsSync(f) && !want.test(robots(f))) problems.push(`${f}: باید ${want} داشته باشد (دارد: «${robots(f)}»)`);
}
const indexable = pages.filter((f) => !/noindex/i.test(robots(f))).length;
const sitemapUrls = globSync(`${dist}/sitemap-*.xml`).filter((f) => !f.endsWith('index.xml'))
  .reduce((n, f) => n + [...readFileSync(f, 'utf8').matchAll(/<loc>/g)].length, 0);
if (sitemapUrls > indexable) problems.push(`sitemap ${sitemapUrls} نشانی دارد ولی فقط ${indexable} صفحه‌ی ایندکس‌پذیر ساخته شده`);

if (problems.length) { console.error('❌ تله‌ی خزش:\n  ' + problems.slice(0, 20).join('\n  ')); process.exit(1); }
console.log(`✅ تله‌ی خزش: ${pages.length} صفحه، هیچ پیوند داخلی پرس‌وجودار؛ sitemap ${sitemapUrls} نشانی ≤ ${indexable} صفحه‌ی ایندکس‌پذیر.`);
