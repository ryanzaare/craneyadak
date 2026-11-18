#!/usr/bin/env node
// scripts/content/cli.mjs — `npm run content -- <lint|build> [مسیر…]`
// ---------------------------------------------------------------------------
//   lint   همه‌ی فایل‌های content/**/index.md (یا مسیرهای داده‌شده) را می‌سنجد. خطا = کد خروج ۱.
//   build  پس از lint سبز، برای هر فایل یک payload به قالب ورود افزونه (cyh_hub_import) در .astro/content-out/ می‌سازد.
//
// مرحله‌ی بعد (هنوز ساخته نشده — docs/content-system.md): `publish` تصاویر را به وردپرس می‌فرستد، نشانگرهای
// {{asset:…}} را با نشانی واقعی عوض می‌کند و payload را به اندپوینت احرازشده‌ی افزونه می‌دهد.
// ---------------------------------------------------------------------------
import { globSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { compileFile } from './compile.mjs';
import { lintDoc } from './lint.mjs';

const ROOT = 'content';
const ROOT_KEY = { product: 'products', category: 'categories', brand: 'brands', article: 'articles' };
const ROUTE = {
  product: (m) => `/products/${m.slug}/`,
  brand: (m) => `/brands/${m.slug}/`,
  article: (m) => `/blog/${m.slug}/`,
  category: (m) => (m.silo ? `/categories/${m.silo}/${m.slug}/` : `/categories/${m.slug}/`),
};

const [cmd = 'lint', ...args] = process.argv.slice(2);
if (!['lint', 'build'].includes(cmd)) {
  console.error('استفاده: npm run content -- <lint|build> [مسیر فایل یا پوشه…]');
  process.exit(2);
}

const all = globSync(`${ROOT}/**/index.md`).sort();
const targets = args.length
  ? args.flatMap((a) => (a.endsWith('.md') ? [a] : globSync(`${a.replace(/\/$/, '')}/**/index.md`)))
  : all;
if (!targets.length) {
  console.log(`هیچ فایل محتوایی (${ROOT}/**/index.md) پیدا نشد.`);
  process.exit(0);
}

const docs = all.map((f) => compileFile(f));
const registry = docs.map((d) => ({ file: d.file, kind: d.meta.kind, slug: d.meta.slug, primaryKeyword: d.meta.primaryKeyword }));

// نشانی‌های معتبر برای لینک داخلی: هر صفحه‌ی ساخته‌شده در dist/ + هر صفحه‌ای که در مخزن محتوا تعریف شده.
const routes = new Set(docs.filter((d) => ROUTE[d.meta.kind] && d.meta.slug).map((d) => ROUTE[d.meta.kind](d.meta)));
if (existsSync('dist')) for (const f of globSync('dist/**/index.html')) routes.add(`/${path.relative('dist', path.dirname(f))}/`.replace(/^\/\.\/$/, '/').replace('//', '/'));

let errors = 0;
for (const file of targets) {
  const doc = docs.find((d) => d.file === file) ?? compileFile(file);
  const issues = lintDoc(doc, { registry, routes });
  const e = issues.filter((i) => i.level === 'error');
  const w = issues.filter((i) => i.level === 'warn');
  errors += e.length;
  const words = doc.blocks.reduce((n, b) => n + JSON.stringify(b).replace(/<[^>]+>/g, ' ').split(/\s+/).length, 0);
  console.log(`\n${e.length ? '❌' : '✅'} ${file} — ${doc.meta.kind ?? '?'}:${doc.meta.slug ?? '?'} · ${doc.blocks.length} بلوک · ${doc.assets.length} تصویر · ~${words} واژه`);
  for (const i of e) console.log(`   ✗ [${i.rule}] ${i.msg}`);
  for (const i of w) console.log(`   ⚠ [${i.rule}] ${i.msg}`);

  if (cmd === 'build' && !e.length) {
    const m = doc.meta;
    const payload = {
      _source: file,
      [ROOT_KEY[m.kind]]: {
        [m.slug]: {
          _post: { title: m.title, excerpt: m.excerpt, status: m.status ?? 'publish' },
          ...(m.kind === 'product'
            ? { _product: { sku: m.sku ?? '', brand: m.brand, categories: m.categories, specs: m.specs ?? [], gallery: (m.gallery ?? []).map((g) => ({ file: g.file, alt: g.alt })) } }
            : {}),
          blocks: doc.blocks,
        },
      },
      _assets: doc.assets.map((a) => ({ file: a.file, alt: a.alt, role: a.role })),
    };
    mkdirSync('.astro/content-out', { recursive: true });
    const out = `.astro/content-out/${m.kind}-${m.slug}.json`;
    writeFileSync(out, JSON.stringify(payload, null, 2));
    console.log(`   → ${out}`);
  }
}

if (errors) {
  console.error(`\n❌ ${errors} خطا — منتشر نمی‌شود.`);
  process.exit(1);
}
console.log(`\n✅ ${targets.length} فایل محتوا سالم.`);
