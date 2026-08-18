#!/usr/bin/env node
/**
 * اعتبارسنجی فایل‌های ورودی محصول — پیش از تحویل.
 *
 * ---------------------------------------------------------------------------
 * چرا این اسکریپت وجود دارد
 *
 * افزونه‌ی وردپرس هم اعتبارسنجی دارد، اما آن *بعد از* ورود اجرا می‌شود.
 * این اسکریپت همان بررسی‌ها را *پیش از* تحویل فایل انجام می‌دهد، تا خطای
 * ساده‌ای مثل اسلاگ فارسی یا دسته‌ی نامعتبر هرگز به وردپرس نرسد.
 *
 * مهم‌تر: اسلاگ دسته و برند را با `src/data/taxonomy.ts` تطبیق می‌دهد —
 * یعنی همان منبع حقیقتی که فرانت‌اند از آن می‌سازد. یک اسلاگ اشتباه در
 * فایل ورودی باعث می‌شود محصول در هیچ صفحه‌ی دسته‌ای دیده نشود، و آن نوع
 * خرابی بی‌صدا است.
 *
 * اجرا:
 *   node content-imports/validate.mjs content-imports/batch-01.json
 * ---------------------------------------------------------------------------
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const taxonomyPath = resolve(here, '../src/data/taxonomy.ts');

/* ---------- اسلاگ‌های مجاز از تاکسونومی ---------- */
const tax = readFileSync(taxonomyPath, 'utf8');

const brandBlock = tax.slice(tax.indexOf('export const BRANDS'));
const brandSlugs = new Set([...brandBlock.matchAll(/\{\s*slug:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]));

// دسته‌ها همه‌ی slugهای پیش از بلوک برندها هستند.
const categoryBlock = tax.slice(0, tax.indexOf('export const BRANDS'));
const categorySlugs = new Set([...categoryBlock.matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]));

/* ---------- بررسی‌ها ---------- */
// ⚠️ پایان الگو عمداً `(?![\p{L}\p{N}])` است و نه `\b`.
//
// این یک باگ واقعی و خطرناک بود: در جاوااسکریپت `\b` فقط با کاراکترهای
// ASCII تعریف می‌شود. بعد از یک حرف فارسی مثل «متر» هیچ مرز کلمه‌ی
// ASCII وجود ندارد، پس `متر\b` هرگز تطبیق نمی‌یافت — یعنی مهم‌ترین
// بررسی ایمنی این پروژه (کشف عدد مهندسیِ تاییدنشده) کاملاً بی‌اثر بود
// و هر بار «هیچ ایرادی پیدا نشد» گزارش می‌کرد.
//
// بدتر: نسخه‌ی پایتونی همین منطق کار می‌کرد، چون `\b` در پایتون
// یونیکد-آگاه است. یعنی تست در زبانی انجام شده بود که مشکل را نشان
// نمی‌داد. هشداری که همیشه ساکت باشد، از نبودِ هشدار بدتر است.
const WORD_END = String.raw`(?![\p{L}\p{N}])`;
const UNIT = new RegExp(
  String.raw`([۰-۹0-9]+(?:[.,][۰-۹0-9]+)?)\s*(?:میلی[\s‌]?متر|سانتی[\s‌]?متر|متر|میلی|mm|cm|kg|کیلوگرم|گرم|تن|ton|ولت|volt|آمپر|amp|وات|kw|نیوتن|nm|دور|rpm|بار|bar|درجه)` + WORD_END,
  'giu'
);
const CODE = /\b[A-Z]{2,}[-\s]?\d{2,}[A-Z0-9-]*\b/g;

// استانداردهای صنعتی — این‌ها کد قطعه نیستند و نباید علامت بخورند.
// IP65 یک درجه‌ی حفاظت است، AC-4 یک کلاس کاری، FEM/ISO استاندارد طبقه‌بندی.
// بدون این فهرست، هر متن فنی درستی هم «کد ساختگی» تشخیص داده می‌شد.
const STANDARDS = /^(IP\d{2}|IK\d{2}|AC-?\d|DC-?\d|FEM\d?|ISO\d+|DIN\d+|EN\d+|M\d{1,3}|AA|AAA|NI-MH|LED|USB|PC|VAC|VDC)$/i;
const BANNED = ['در دنیای امروز', 'شایان ذکر است', 'لازم به ذکر است', 'بی‌نظیر', 'فوق‌العاده', 'بدون شک', 'قطعاً'];
const REQUIRED_SECTIONS = ['نمای کلی', 'بررسی تخصصی', 'نشانه', 'انتخاب', 'نصب', 'پرسش'];

const strip = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function validate(item, index) {
  const errors = [];
  const warns = [];
  const label = item.title ?? `#${index + 1}`;

  for (const key of ['title', 'slug', 'excerpt', 'content']) {
    if (!item[key]) errors.push(`فیلد «${key}» خالی است`);
  }
  if (errors.length) return { label, errors, warns };

  // اسلاگ باید لاتین باشد — وگرنه آدرس صفحه فارسی و درصددار می‌شود.
  if (!/^[a-z0-9-]+$/.test(item.slug)) errors.push(`اسلاگ لاتین نیست: «${item.slug}»`);

  // تاکسونومی
  if (item.category && !categorySlugs.has(item.category)) {
    errors.push(`دسته‌ی «${item.category}» در تاکسونومی وجود ندارد`);
  }
  if (item.brand && !brandSlugs.has(item.brand)) {
    errors.push(`برند «${item.brand}» در تاکسونومی وجود ندارد`);
  }

  const text = strip(item.content);
  const words = text.split(/\s+/).filter(Boolean).length;

  // منبع رسمی ثبت شده؟ قاعده هرگز «عدد ننویس» نبود، بلکه «عددِ
  // تاییدنشده ننویس» بود. وقتی کاتالوگ سازنده در `sources` آمده، عدد
  // دقیق دقیقاً همان چیزی است که خریدار صنعتی لازم دارد — پس هشدار
  // می‌شود، نه خطا.
  const hasSources = Array.isArray(item.sources) && item.sources.length > 0;

  const nums = [...text.matchAll(UNIT)].map((m) => m[0].trim());
  if (nums.length) {
    const msg = `${nums.length} عدد با واحد مهندسی: ${[...new Set(nums)].slice(0, 5).join('، ')}`;
    if (hasSources) warns.push(`${msg} — منبع رسمی ثبت شده، اما باید با کاتالوگ تطبیق داده شود`);
    else errors.push(`${msg} — بدون منبع رسمی`);
  }

  // کد قطعه‌ای که در عنوان نیست
  const known = new Set((item.title.match(CODE) ?? []).map((c) => c.toUpperCase()));
  const unknown = [...new Set((text.match(CODE) ?? []).map((c) => c.toUpperCase()))]
    .filter((c) => !known.has(c) && !STANDARDS.test(c));
  if (unknown.length) {
    const msg = `کد ناشناخته در متن: ${unknown.slice(0, 5).join('، ')}`;
    if (hasSources) warns.push(msg);
    else errors.push(msg);
  }

  for (const s of REQUIRED_SECTIONS) {
    if (!item.content.includes(s)) errors.push(`بخش «${s}» نوشته نشده`);
  }

  if (words < 700) errors.push(`فقط ${words} کلمه (حداقل ۱۲۰۰ هدف است)`);
  else if (words < 1200) warns.push(`${words} کلمه — کمتر از هدف ۱۲۰۰`);

  if (!/cy-(callout|proscons|compare|bar)/.test(item.content)) {
    warns.push('هیچ بلوک غنی استفاده نشده');
  }

  const found = BANNED.filter((p) => text.includes(p));
  if (found.length) warns.push(`لحن ماشینی: ${found.join('، ')}`);

  const L = item.excerpt.length;
  if (L < 80 || L > 200) warns.push(`طول توضیح کوتاه ${L} (بازه‌ی مناسب ۱۲۰–۱۶۰)`);

  if (/<h1\b/i.test(item.content)) errors.push('تگ <h1> در متن');
  if (/<a\s/i.test(item.content)) warns.push('تگ <a> دستی — لینک‌دهی خودکار است');

  return { label, errors, warns, words };
}

/* ---------- اجرا ---------- */
const file = process.argv[2];
if (!file) {
  console.error('usage: node content-imports/validate.mjs <file.json>');
  process.exit(1);
}

const data = JSON.parse(readFileSync(file, 'utf8'));
const items = Array.isArray(data) ? data : (data.products ?? []);

console.log(`\nفایل: ${file}`);
console.log(`محصولات: ${items.length}`);
console.log(`اسلاگ‌های مجاز: ${categorySlugs.size} دسته، ${brandSlugs.size} برند\n`);

let totalErrors = 0;
const seen = new Set();

for (const [i, item] of items.entries()) {
  // اسلاگ تکراری داخل خود فایل
  if (item.slug) {
    if (seen.has(item.slug)) {
      console.log(`✗ ${item.title}\n    اسلاگ تکراری در همین فایل: ${item.slug}`);
      totalErrors++;
      continue;
    }
    seen.add(item.slug);
  }

  const { label, errors, warns, words } = validate(item, i);
  totalErrors += errors.length;

  const mark = errors.length ? '✗' : warns.length ? '⚠' : '✓';
  const src = Array.isArray(item.sources) && item.sources.length ? `  [${item.sources.length} منبع]` : '  [بدون منبع]';
  console.log(`${mark} ${label}${words ? `  (${words} کلمه)` : ''}${src}`);
  for (const e of errors) console.log(`    ✗ ${e}`);
  for (const w of warns) console.log(`    ⚠ ${w}`);
}

console.log(
  totalErrors === 0
    ? `\n✓ آماده‌ی ورود — هیچ ایراد بحرانی نیست.\n`
    : `\n✗ ${totalErrors} ایراد بحرانی. فایل نباید تحویل شود.\n`
);
process.exit(totalErrors === 0 ? 0 : 1);
