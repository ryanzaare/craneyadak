#!/usr/bin/env node
// scripts/check-build-audit.mjs  [dist-dir]
// ---------------------------------------------------------------------------
// ماتریس مسیرها + یکتایی متا + اسکیمای محصول + کوچک‌شدن بی‌صدا. اجرا در postbuild.
// منطق: scripts/build-audit.mjs (خالص و آزمون‌شده). این‌جا فقط دیسک.
//
// آخرین فهرست مسیرهای ایندکس‌پذیر در `.astro/build-manifest.json` (خارج از git)
// می‌ماند و build بعدی با آن مقایسه می‌شود. اولین build فقط پایه می‌سازد.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync, existsSync, mkdirSync, globSync } from 'node:fs';
import path from 'node:path';
import { parsePage, routeOf, isIndexable, routeMatrixProblems, metadataProblems, productSchemaProblems, shrinkageProblems } from './build-audit.mjs';

const dist = process.argv[2] || 'dist';
if (!existsSync(dist)) {
  console.error(`❌ پوشه‌ی ${dist} نیست — پس از build اجرا شود.`);
  process.exit(1);
}

const pages = globSync(`${dist}/**/*.html`)
  .map((f) => path.relative(dist, f))
  .filter((rel) => !rel.startsWith('pagefind'))
  .map((rel) => parsePage(routeOf(rel), readFileSync(path.join(dist, rel), 'utf8')));

const sitemapLocs = globSync(`${dist}/sitemap-*.xml`)
  .filter((f) => !f.endsWith('sitemap-index.xml'))
  .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

const problems = [...routeMatrixProblems(pages, sitemapLocs), ...metadataProblems(pages), ...productSchemaProblems(pages, { requireAuthenticity: process.env.ALLOW_UNLABELED_AUTHENTICITY !== '1' })];

const indexable = pages.filter((p) => isIndexable(p)).map((p) => p.route).sort();
const MANIFEST = '.astro/build-manifest.json';
let prev = [];
try {
  prev = JSON.parse(readFileSync(MANIFEST, 'utf8')).indexable ?? [];
} catch {
  /* اولین build */
}
if (process.env.ALLOW_SHRINK !== '1') problems.push(...shrinkageProblems(prev, indexable));

if (problems.length) {
  console.error(`❌ ${problems.length} مشکل در ممیزی خروجی build:`);
  for (const p of problems) console.error(`   • ${p}`);
  process.exit(1);
}

mkdirSync(path.dirname(MANIFEST), { recursive: true });
writeFileSync(MANIFEST, JSON.stringify({ at: new Date().toISOString(), indexable }, null, 1));

const bySection = {};
for (const r of indexable) {
  const s = r === '/' ? '/' : `/${r.split('/')[1]}/`;
  bySection[s] = (bySection[s] ?? 0) + 1;
}
console.log(
  `✅ ممیزی build سالم — ${indexable.length} صفحه‌ی ایندکس‌پذیر ` +
    `(${Object.entries(bySection).map(([k, v]) => `${k} ${v}`).join('، ')})؛ ` +
    `${prev.length ? `مقایسه با build قبلی (${prev.length} مسیر) بدون ریزش` : 'اولین build: پایه ساخته شد'}.`,
);
