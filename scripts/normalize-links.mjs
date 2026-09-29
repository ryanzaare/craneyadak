#!/usr/bin/env node
// scripts/normalize-links.mjs  [dist-dir]
// ---------------------------------------------------------------------------
// لینک‌های داخلیِ `<a href="/about">` در خروجی → `/about/` (شکل canonical).
//
// چرا در postbuild و نه در سورس: ده‌ها لینک دستی و پویا در کامپوننت‌ها هست
// (`/products/${slug}` …). بدون این، هر کلیک روی Apache یک ۳۰۱ اضافه
// (`/about` → `/about/`) می‌خورد. منطق در src/lib/urls.mjs است و آزمون
// دارد (urls.test.mts، با ورودی خراب). نشانی‌های پرس‌وجودار و فایل‌ها
// دست‌نخورده‌اند.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync, globSync, existsSync } from 'node:fs';
import { normalizeInternalLinks } from '../src/lib/urls.mjs';

const dist = process.argv[2] || 'dist';
if (!existsSync(dist)) {
  console.error(`❌ پوشه‌ی ${dist} نیست — پس از build اجرا شود.`);
  process.exit(1);
}
let files = 0;
let links = 0;
for (const f of globSync(`${dist}/**/*.html`)) {
  const before = readFileSync(f, 'utf8');
  const { html, changed } = normalizeInternalLinks(before);
  if (changed) {
    writeFileSync(f, html);
    files++;
    links += changed;
  }
}
console.log(`✅ ${links} لینک داخلی در ${files} صفحه با «/» پایانی یکدست شد.`);
