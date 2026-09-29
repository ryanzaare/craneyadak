#!/usr/bin/env node
// scripts/prune-noindex-sitemap.mjs  [dist-dir]
// ---------------------------------------------------------------------------
// نشانی صفحه‌هایی که متای robots آن‌ها noindex است از sitemap برداشته می‌شود.
//
// چرا: فیلتر sitemap در astro.config فقط نشانی را می‌بیند، نه اینکه صفحه
// «امروز» noindex شده (مثلاً دسته‌ی بدون محصول). با هر build همین‌جا از روی
// HTML واقعی تصمیم گرفته می‌شود؛ وقتی محصول اضافه شد و noindex برداشته شد،
// نشانی خودکار برمی‌گردد — هیچ فهرست دستی برای فراموش‌شدن نیست.
//
// ⚠️ فهرست برداشته‌شده‌ها *هر بار* چاپ می‌شود. عمداً: «دسته‌های خالی noindex‌اند»
// قراردادی موقت است (تصمیم کارفرما، ۷ مهر ۱۴۰۵) و پیش از انتشار عمومی باید
// دوباره سنجیده شود. `INDEX_EMPTY_CATEGORIES=1 npm run build` همه را ایندکس‌پذیر می‌کند.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync, existsSync, globSync } from 'node:fs';
import path from 'node:path';

const dist = process.argv[2] || 'dist';
const maps = globSync(`${dist}/sitemap-*.xml`).filter((f) => !f.endsWith('sitemap-index.xml'));
if (!maps.length) {
  console.error(`❌ هیچ sitemap در ${dist} نیست — پس از build اجرا شود.`);
  process.exit(1);
}

const pruned = [];
let kept = 0;
for (const map of maps) {
  const xml = readFileSync(map, 'utf8');
  const out = xml.replace(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/g, (block, loc) => {
    const rel = decodeURIComponent(new URL(loc).pathname).replace(/^\/+/, '');
    const file = rel === '' || rel.endsWith('/') ? path.join(dist, rel, 'index.html') : path.join(dist, rel);
    const target = existsSync(file) ? file : path.join(dist, rel, 'index.html');
    const html = existsSync(target) ? readFileSync(target, 'utf8') : '';
    if (/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) {
      pruned.push(loc);
      return '';
    }
    kept++;
    return block;
  });
  if (out !== xml) writeFileSync(map, out);
}

console.log(`✅ sitemap: ${kept} نشانی ایندکس‌پذیر؛ ${pruned.length} نشانی noindex برداشته شد.`);
const cats = pruned.filter((u) => u.includes('/categories/'));
if (cats.length) {
  console.log(`⚠️ ${cats.length} دسته‌ی بدون محصول noindex است (موقت). پیش از انتشار عمومی بازبینی کنید:`);
  for (const u of cats) console.log(`   • ${u}`);
}
