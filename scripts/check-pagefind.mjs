#!/usr/bin/env node
// scripts/check-pagefind.mjs
// ---------------------------------------------------------------------------
// «۹ صفحه بدون عنصر <html> پیدا شد» — این هشدار را چه کنیم؟
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا این فایل وجود دارد
// ═══════════════════════════════════════════════════════════════════════════
// Pagefind بعد از هر build هشدار می‌دهد که چند صفحه عنصر <html> ندارند و
// ایندکس نمی‌شوند. آن صفحات، صفحه‌های ریدایرکتِ خروجی استاتیک Astro
// هستند: چند بایت meta-refresh با noindex. **ایندکس‌نشدنشان درست است** —
// اگر ایندکس می‌شدند، «Redirecting to…» داخل جستجوی خود سایت می‌آمد.
//
// پس هشدار بی‌ضرر است. ولی هشدارِ بی‌ضررِ تکراری بدترین نوع هشدار است:
// آدم یاد می‌گیرد نادیده‌اش بگیرد، و روزی که عدد از ۹ به ۱۰ برسد — یعنی
// یک صفحه‌ی واقعی شکسته — کسی متوجه نمی‌شود.
//
// ⚠️ چرا با `--glob` خاموش نشد: گلابِ Pagefind نفی (`!`) ندارد، پس تنها
// راهش فهرستِ *مثبت* پوشه‌هاست. آن‌وقت هر بخش تازه‌ی سایت تا وقتی کسی
// یادش بیفتد نامش را اضافه کند، بی‌صدا از جستجو غایب می‌ماند. یعنی برای
// خلاص‌شدن از یک هشدارِ بی‌ضرر، یک شکستِ بی‌صدای واقعی می‌خریدیم.
//
// پس هشدار می‌ماند و اینجا به *نگهبان* تبدیل می‌شود: هر صفحه‌ی بدون
// <html> باید یک ریدایرکتِ شناخته‌شده باشد. هر چیز دیگری، build را
// می‌شکند.
//
// اجرا:  npm run check:pagefind   (و خودکار در postbuild)
// ---------------------------------------------------------------------------

import { readFileSync, globSync, existsSync } from 'node:fs';

const DIST = 'dist';

if (!existsSync(DIST)) {
  console.error(`❌ پوشه‌ی ${DIST} نیست. این بررسی باید بعد از build اجرا شود.`);
  process.exit(1);
}

const read = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };

/* ── ریدایرکت‌های اعلام‌شده ───────────────────────────────────────────────
   منبع، خودِ astro.config.mjs است و نه فهرستی دستی اینجا: فهرست دستی
   همان چیزی است که این پروژه بارها از آن ضربه خورده. واگراییِ این فایل
   با `public/_redirects` را هم `check-architecture.mjs` می‌گیرد. */
const config = read('astro.config.mjs');
const objMatch = /const\s+\w*[Rr]edirects\w*\s*=\s*\{([\s\S]*?)\n\};/.exec(config);

if (!objMatch) {
  console.error('❌ شیء ریدایرکت در astro.config.mjs پیدا نشد — این بررسی بی‌اعتبار است.');
  process.exit(1);
}

const expected = new Set();
for (const m of objMatch[1].replace(/\/\/[^\n]*/g, '').matchAll(/'([^']+)'\s*:\s*'[^']+'/g)) {
  expected.add(`${DIST}${m[1].replace(/\/$/, '')}/index.html`);
}

/* ── صفحات بدون <html> ───────────────────────────────────────────────── */
const pages = globSync(`${DIST}/**/*.html`);
const noHtml = pages.filter((f) => !/<html[\s>]/i.test(read(f)));

const orphans = noHtml.filter((f) => !expected.has(f));
const missing = [...expected].filter((f) => existsSync(f) && !noHtml.includes(f));

if (orphans.length) {
  console.error(
    `❌ ${orphans.length} صفحه عنصر <html> ندارد و ریدایرکتِ اعلام‌شده هم نیست.\n` +
      '   یعنی صفحه‌ای واقعی شکسته و از جستجوی سایت غایب است:',
  );
  for (const f of orphans) console.error(`   • ${f}`);
  process.exit(1);
}

if (missing.length) {
  console.error(
    `❌ ${missing.length} ریدایرکت حالا صفحه‌ی کامل تولید می‌کند — یعنی آدرس قدیمی ` +
      'به‌جای هدایت، محتوا نشان می‌دهد و با مقصدش هم‌نسخه (duplicate) می‌شود:',
  );
  for (const f of missing) console.error(`   • ${f}`);
  process.exit(1);
}

console.log(
  `✅ جستجو سالم — ${pages.length - noHtml.length} صفحه ایندکس‌پذیر، ` +
    `${noHtml.length} صفحه‌ی ریدایرکت عمداً بیرون از ایندکس.`,
);
