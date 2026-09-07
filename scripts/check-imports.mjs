#!/usr/bin/env node
/**
 * بررسی یکپارچگی import/export در کل مخزن.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ چرا این فایل وجود دارد
 *
 * دو خرابی پشت سر هم که هیچ‌کدام تا لحظه‌ی build دیده نشدند:
 *
 *   ۱) یک ویرایش «برش تا انتهای فایل» در site-options.ts، تابع
 *      `getContact` و همه‌ی کمک‌کننده‌های زیرش را حذف کرد. ده فایل که
 *      آن را import می‌کردند شکستند.
 *   ۲) نسخه‌ی اول همین بررسی، الگوی `^export` را با لنگر ابتدای خط
 *      می‌گرفت. اما `BLOG_POSTS` در content.ts با دو فاصله تورفتگی
 *      نوشته شده بود (`  export const BLOG_POSTS`). ابزار آن را ندید،
 *      «حذف‌شده» گزارش کرد، و باعث شد یک کپی دوم اضافه شود — که خطای
 *      «Duplicated export» ساخت.
 *
 * درس دوم مهم‌تر است: یک ابزار بررسی که نتیجه‌ی مثبت کاذب بدهد، از
 * نبودِ ابزار بدتر است، چون بر اساس آن اقدام می‌شود. به همین دلیل این
 * نسخه علاوه بر import ها، *export تکراری* را هم می‌گیرد.
 *
 * اجرا:  node scripts/check-imports.mjs
 * ---------------------------------------------------------------------------
 */

import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';

// ⚠️ `.mjs` هم لازم است. یک بار `brand-queries.mjs` ساخته شد تا اسکریپت
// تشخیص و build *دقیقاً* یک منبع داشته باشند؛ چون این glob آن را نمی‌دید،
// بررسی، importِ کاملاً درست را «ماژول گمشده» گزارش کرد — یعنی خودِ ابزار
// مثبت کاذب ساخت. فهرست پسوندها باید با فهرست `resolve()` یکی بماند.
const files = globSync('src/**/*.{ts,mts,astro,js,mjs}');

/** ⚠️ بدون لنگر ^ — تورفتگی مجاز است و باید دیده شود. */
const DECL = /(?:^|\n)\s*export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+(\w+)/g;
const LIST = /(?:^|\n)\s*export\s*\{([^}]+)\}/g;

const exportsOf = new Map();
const duplicates = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const names = new Set();
  const seen = new Set();

  for (const m of src.matchAll(DECL)) {
    if (seen.has(m[1])) duplicates.push(`${file}: '${m[1]}' declared more than once`);
    seen.add(m[1]);
    names.add(m[1]);
  }
  for (const m of src.matchAll(LIST)) {
    for (const raw of m[1].split(',')) {
      const n = raw.trim().split(/\s+as\s+/).pop()?.replace(/^type\s+/, '').trim();
      if (n) names.add(n);
    }
  }
  exportsOf.set(path.normalize(file), names);
}

function resolve(importer, spec) {
  if (!spec.startsWith('.')) return null; // پکیج خارجی
  const base = path.normalize(path.join(path.dirname(importer), spec));
  const candidates = [
    base, // مسیر با پسوند صریح (مثل './brand-queries.mjs')
    `${base}.ts`, `${base}.mts`, `${base}.astro`, `${base}.js`, `${base}.mjs`,
    path.join(base, 'index.ts'), path.join(base, 'index.mjs'),
  ];
  for (const c of candidates) {
    const n = path.normalize(c);
    if (exportsOf.has(n)) return n;
  }
  return false;
}

const problems = [...duplicates];

for (const file of files) {
  const src = readFileSync(file, 'utf8');

  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)) {
    const target = resolve(file, m[2]);
    if (target === null) continue;
    if (target === false) { problems.push(`${file} → missing module '${m[2]}'`); continue; }
    for (const raw of m[1].split(',')) {
      const n = raw.trim().split(/\s+as\s+/)[0]?.replace(/^type\s+/, '').trim();
      if (n && !exportsOf.get(target).has(n)) {
        problems.push(`${file} → '${n}' is not exported by ${target}`);
      }
    }
  }

  for (const m of src.matchAll(/import\s+\w+\s+from\s+['"](\.[^'"]+)['"]/g)) {
    if (resolve(file, m[1]) === false) problems.push(`${file} → missing module '${m[1]}'`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   بررسی ناحیه‌ی مرده‌ی زمانی (TDZ) در فرontmatter فایل‌های .astro
   ═══════════════════════════════════════════════════════════════════════
   ⚠️ خرابی‌ای که این بخش می‌گیرد:

   یک اسکریپت، اعلانِ `const contact = await getContact()` را به انتهای
   فرontmatter اضافه کرد، در حالی که کدِ بالاتر از آن استفاده می‌کرد.
   `const` هویست می‌شود اما تا نقطه‌ی اعلان در TDZ است، پس رندر با
   «Cannot access 'contact' before initialization» شکست — و این خطا فقط
   در زمان *رندر صفحه* دیده می‌شد، نه در زمان کامپایل.

   کامنت‌ها و رشته‌ها پیش از بررسی خنثی می‌شوند؛ وگرنه مسیری مثل
   `// src/pages/contact.astro` به‌اشتباه «استفاده از contact» شمرده
   می‌شود — همان مثبت کاذبی که یک بار دیگر هم به اشتباه انجامید. */
function blankOutCommentsAndStrings(src) {
  const out = [...src];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      for (let k = i; k <= Math.min(j, src.length - 1); k++) out[k] = ' ';
      i = j + 1;
    } else if (src.startsWith('/*', i)) {
      let j = src.indexOf('*/', i + 2);
      j = j === -1 ? src.length : j + 2;
      for (let k = i; k < j; k++) out[k] = ' ';
      i = j;
    } else if (src.startsWith('//', i)) {
      let j = src.indexOf('\n', i);
      j = j === -1 ? src.length : j;
      for (let k = i; k < j; k++) out[k] = ' ';
      i = j;
    } else i++;
  }
  return out.join('');
}

for (const file of files.filter((f) => f.endsWith('.astro'))) {
  const src = readFileSync(file, 'utf8');
  if (!src.startsWith('---')) continue;
  const end = src.indexOf('\n---', 3);
  if (end === -1) continue;
  const fm = blankOutCommentsAndStrings(src.slice(3, end));

  for (const m of fm.matchAll(/\bconst\s+(\w+)\s*=/g)) {
    const name = m[1];
    const use = new RegExp(`\\b${name}\\s*[.\\[]`).exec(fm);
    if (use && use.index < m.index) {
      problems.push(`${file} → '${name}' used at ${use.index} but declared at ${m.index} (TDZ)`);
    }
  }
}

console.log(`scanned ${files.length} modules`);
if (problems.length) {
  console.error('\n❌ مشکلات:');
  for (const p of [...new Set(problems)].sort()) console.error('   ' + p);
  process.exit(1);
}
console.log('✅ هر import به یک export واقعی می‌رسد و هیچ export تکراری نیست');
