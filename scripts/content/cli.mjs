#!/usr/bin/env node
// scripts/content/cli.mjs — `npm run content -- <lint|build> [مسیر…]`
// ---------------------------------------------------------------------------
//   publish [--apply] [--create] [--force]  پس از lint سبز، تصاویر و محتوا را به وردپرس می‌فرستد (scripts/content/publish.mjs).
//          پیش‌فرض dry-run. متغیرهای محیطی: WP_SITE_URL (یا WP_GRAPHQL_URL)، WP_APP_USER، WP_APP_PASSWORD.
//   lint   همه‌ی فایل‌های content/**/index.md (یا مسیرهای داده‌شده) را می‌سنجد. خطا = کد خروج ۱.
//   build  پس از lint سبز، برای هر فایل یک payload به قالب ورود افزونه (cyh_hub_import) در .astro/content-out/ می‌سازد.
//
// مرحله‌ی بعد (هنوز ساخته نشده — docs/content-system.md): `publish` تصاویر را به وردپرس می‌فرستد، نشانگرهای
// {{asset:…}} را با نشانی واقعی عوض می‌کند و payload را به اندپوینت احرازشده‌ی افزونه می‌دهد.
// ---------------------------------------------------------------------------
import { globSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { compileFile } from './compile.mjs';
import { lintDoc, shingles, assetKey } from './lint.mjs';
import { plainText } from './compile.mjs';
import { publishDoc, authHeader, restBase } from './publish.mjs';

const ROOT = 'content';
const ROOT_KEY = { product: 'products', category: 'categories', brand: 'brands', article: 'articles' };
const ROUTE = {
  product: (m) => `/products/${m.slug}/`,
  brand: (m) => `/brands/${m.slug}/`,
  article: (m) => `/blog/${m.slug}/`,
  category: (m) => (m.silo ? `/categories/${m.silo}/${m.slug}/` : `/categories/${m.slug}/`),
};

const [cmd = 'lint', ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--')));
const args = rest.filter((a) => !a.startsWith('--'));
if (!['lint', 'build', 'publish'].includes(cmd)) {
  console.error('استفاده: npm run content -- <lint|build|publish> [مسیر فایل یا پوشه…] [--apply] [--create] [--force]');
  process.exit(2);
}
let wp = null;
if (cmd === 'publish') {
  const site = process.env.WP_SITE_URL || process.env.WP_GRAPHQL_URL;
  const user = process.env.WP_APP_USER;
  const pass = process.env.WP_APP_PASSWORD;
  if (!site || !user || !pass) {
    console.error('❌ انتشار به WP_SITE_URL، WP_APP_USER و WP_APP_PASSWORD نیاز دارد (GitHub Secrets — docs/content-system.md).');
    process.exit(2);
  }
  wp = { base: restBase(site), auth: authHeader(user, pass) };
}

const all = globSync(`${ROOT}/**/index.md`).sort();
const targets = args.length
  ? args.flatMap((a) => (a.endsWith('.md') ? [a] : globSync(`${a.replace(/\/$/, '')}/**/index.md`)))
  : all;
// ⚠️ مسیرِ داده‌شده که هیچ فایلی پیدا نکند = خطا، نه سبز (۲۸ آبان ۱۴۰۵): اجرای دستی «Content» با مسیر
// «content/products/saga-saga1-l12.» (نقطه‌ی اضافه) هیچ فایلی نیافت و سبز تمام شد — کارفرما آن را موفق دید.
const unmatched = args.filter((a) => !(a.endsWith('.md') ? existsSync(a) : globSync(`${a.replace(/\/$/, '')}/**/index.md`).length));
if (unmatched.length) {
  console.error(`❌ این مسیرها هیچ فایل محتوایی ندارند: ${unmatched.map((a) => `«${a}»`).join('، ')}\n   موجود: ${all.map((f) => path.dirname(f)).join('، ') || '—'}`);
  process.exit(1);
}
if (!targets.length) {
  console.log(`هیچ فایل محتوایی (${ROOT}/**/index.md) پیدا نشد.`);
  process.exit(0);
}

const docs = all.map((f) => compileFile(f));
// shingles و cover برای نگهبان «هرگز تکرار» (lint.mjs): متن و تصویر اول هر صفحه با همه‌ی صفحه‌های دیگر مقایسه می‌شود.
const registry = docs.map((d) => {
  const g0 = d.meta.kind === 'product' ? d.assets.find((a) => a.role === 'gallery') : null;
  return { file: d.file, kind: d.meta.kind, slug: d.meta.slug, primaryKeyword: d.meta.primaryKeyword, shingles: shingles(plainText(d)), cover: g0 ? assetKey(g0) : null };
});

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

  if ((cmd === 'build' || cmd === 'publish') && !e.length) {
    const m = doc.meta;
    const payload = {
      _source: file,
      [ROOT_KEY[m.kind]]: {
        [m.slug]: {
          // content: '' — همه‌ی متن در بلوک‌هاست؛ متن قدیمی ویرایشگر پاک می‌شود (پشتیبانش در متای _cyh_content_backup).
          _post: { title: m.title, excerpt: m.excerpt, status: m.status ?? 'publish', content: '' },
          // ⚠️ sku فقط اگر در فایل هست (۳۰ آبان ۱۴۰۵): پیش‌تر sku: '' فرستاده می‌شد و کد فنی‌ای را که کارفرما از روی پلاک
          // در پنل وارد کرده بود (فرستنده‌ی L12) در انتشار بعدی پاک می‌کرد. نبودِ کد در فایل = «نمی‌دانیم»، نه «خالی کن».
          ...(m.kind === 'product'
            ? { _product: { ...(m.sku ? { sku: m.sku } : {}), ...(m.authenticity ? { authenticity: m.authenticity } : {}), ...(Array.isArray(m.aka) && m.aka.length ? { aka: m.aka } : {}), brand: m.brand, categories: m.categories, specs: m.specs ?? [], gallery: (m.gallery ?? []).map((g) => ({ file: g.file, alt: g.alt })) } }
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
    if (cmd === 'publish') {
      const opt = { fetch, ...wp, apply: flags.has('--apply'), create: flags.has('--create'), force: flags.has('--force'), log: (s) => console.log(s) };
      try {
        const res = await publishDoc(doc, payload, opt);
        for (const [kind, slug, field, msg] of res.rows ?? []) console.log(`   ${String(msg).startsWith('✗') ? '' : '•'} ${kind}:${slug}${field !== '—' ? ` (${field})` : ''} — ${msg}`);
        if (!res.ok) errors += res.errors || 1;
        console.log(`   ${opt.apply ? '✍️  نوشته شد' : '👁  dry-run (بدون نوشتن؛ برای نوشتن --apply)'} — ${res.written} مورد`);
      } catch (ex) {
        errors++;
        console.error(`   ✗ انتشار: ${ex.message}`);
      }
    }
  }
}

if (errors) {
  console.error(`\n❌ ${errors} خطا — منتشر نمی‌شود.`);
  process.exit(1);
}
console.log(`\n✅ ${targets.length} فایل محتوا سالم.`);
