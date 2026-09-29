#!/usr/bin/env node
// scripts/check-sitemap-noindex.mjs  [dist-dir]
// ---------------------------------------------------------------------------
// هیچ نشانی sitemap نباید به صفحه‌ی noindex اشاره کند. اجرا در postbuild.
//
// چرا: فیلتر sitemap در astro.config.mjs یک فهرست دستی است. صفحات /account
// (ایست ۶) noindex ساخته شدند ولی به آن فهرست اضافه نشدند و ۷ نشانی
// noindex وارد sitemap شد — همان هشدار «Submitted URL marked noindex» در
// Search Console. فهرست دستی فراموش می‌شود؛ این بررسی نمی‌شود.
// ---------------------------------------------------------------------------
import { readFileSync, existsSync, globSync } from 'node:fs';
import path from 'node:path';

const dist = process.argv[2] || 'dist';
const maps = globSync(`${dist}/sitemap-*.xml`).filter((f) => !f.endsWith('sitemap-index.xml'));
if (!maps.length) {
  console.error(`❌ هیچ sitemap در ${dist} نیست — پیش از این بررسی build لازم است.`);
  process.exit(1);
}

const problems = [];
let urls = 0;
for (const map of maps) {
  for (const [, loc] of readFileSync(map, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
    urls++;
    const rel = decodeURIComponent(new URL(loc).pathname).replace(/^\/+/, '');
    const file = rel === '' || rel.endsWith('/') ? path.join(dist, rel, 'index.html') : path.join(dist, rel);
    const target = existsSync(file) ? file : path.join(dist, rel, 'index.html');
    if (!existsSync(target)) {
      problems.push(`${loc}: فایل HTML در build نیست`);
      continue;
    }
    const html = readFileSync(target, 'utf8');
    if (/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) {
      problems.push(`${loc}: noindex است ولی در sitemap آمده`);
    }
  }
}

if (problems.length) {
  console.error(`❌ ${problems.length} نشانی sitemap مشکل دارد:`);
  for (const p of problems) console.error(`   • ${p}`);
  process.exit(1);
}
console.log(`✅ sitemap سالم — ${urls} نشانی، هیچ‌کدام noindex نیست.`);
