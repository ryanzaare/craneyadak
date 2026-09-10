#!/usr/bin/env node
// scripts/check-architecture.mjs
// ---------------------------------------------------------------------------
// قاعده‌ی ۳ از `docs/architecture.md`: build روی آشغال می‌شکند.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا این فایل وجود دارد
// ═══════════════════════════════════════════════════════════════════════════
// قاعده‌ی ۱ (پالت بسته) و قاعده‌ی ۲ (هر افزوده، حذفش را با خودش می‌آورد)
// هر دو به حافظه و انضباط تکیه دارند. در این پروژه هر دو بارها شکست
// خوردند: سه سیستم محتوا هم‌زمان زنده شدند، شش دکمه‌ی تعمیر انباشته شد، و
// یک skill که قرار بود وضعیت پروژه را نگه دارد یک ماه دروغ گفت.
//
// تنها چیزی که واقعاً جلوی این را گرفته، تستی بوده که **شکسته**. پس
// قاعده‌ها اینجا به کد تبدیل می‌شوند، نه به قول.
// ---------------------------------------------------------------------------

import { readFileSync, globSync, existsSync } from 'node:fs';
import path from 'node:path';

const ACF_DIR = 'wordpress-plugin/crane-yadak-headless/acf-json';
const PHP = globSync('wordpress-plugin/crane-yadak-headless/**/*.php');
const SRC = globSync('src/**/*.{ts,mts,astro,mjs}');

const read = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
const srcBlob = SRC.map(read).join('\n');
const phpBlob = PHP.map(read).join('\n');

const problems = [];

/* ═══ ۱) فهرست مجاز گروه‌های ACF ═══════════════════════════════════════
   هر گروه تازه باید *عمداً* اینجا اضافه شود. اگر کسی گروهی بسازد و این
   فهرست را به‌روز نکند، build می‌شکند — که دقیقاً هدف است. */
const ALLOWED_GROUPS = {
  contentBlocks: 'تمام محتوا — پالت هفت‌بلوکی',
  productFields: 'هویت و داده‌ی قابل کوئری محصول',
  brandFields: 'هویت برند',
  siteOptionsFields: 'تنظیمات سایت',
  authorProfile: 'E-E-A-T نویسنده',
};

const groups = {};
for (const f of globSync(`${ACF_DIR}/*.json`)) {
  let g;
  try { g = JSON.parse(read(f)); } catch { problems.push(`${f}: JSON نامعتبر`); continue; }
  const name = g.graphql_field_name;
  groups[name] = { file: path.basename(f), group: g };

  // نام فایل باید با کلید گروه یکی باشد، وگرنه ACF با هر ذخیره یک فایل
  // تکراری می‌سازد — این یک بار واقعاً اتفاق افتاد.
  if (path.basename(f) !== `${g.key}.json`) {
    problems.push(`${path.basename(f)}: نام فایل با کلید گروه (${g.key}) یکی نیست — ACF فایل تکراری می‌سازد.`);
  }
  if (!ALLOWED_GROUPS[name]) {
    problems.push(`گروه ACF «${name}» در فهرست مجاز نیست. یا حذفش کنید یا آگاهانه به ALLOWED_GROUPS اضافه‌اش کنید.`);
  }
}

for (const name of Object.keys(ALLOWED_GROUPS)) {
  if (!groups[name]) problems.push(`گروه «${name}» در فهرست مجاز هست ولی فایلش وجود ندارد.`);
}

/* ═══ ۲) گروهی که هیچ‌کس مصرفش نمی‌کند ═════════════════════════════════
   گروه ACF بدون مصرف‌کننده در فرانت‌اند یعنی مدیر محتوا فیلدی را پر
   می‌کند که هیچ‌جا دیده نمی‌شود — بدترین نوع آشغال، چون وقت انسان را هم
   می‌گیرد. */
for (const [name, { file }] of Object.entries(groups)) {
  if (!new RegExp(`\\b${name}\\b`).test(srcBlob)) {
    problems.push(`گروه «${name}» (${file}) هیچ مصرف‌کننده‌ای در src/ ندارد — یا وصلش کنید یا حذفش.`);
  }
}

/* ═══ ۳) فهرست مجاز دکمه‌های پنل ═══════════════════════════════════════
   از شش دکمه به دو رسیدیم. مهاجرت هم تاریخ انقضا دارد. */
const ALLOWED_HANDLERS = {
  cyh_hub_import: 'ورود انبوه محتوا از فایل',
  cyh_blocks_migrate: '⏳ یک‌بارمصرف — پس از مهاجرت همه‌ی برندها و دسته‌ها حذف شود',
};

const handlers = [...new Set([...phpBlob.matchAll(/admin_post_([a-z_]+)/g)].map((m) => m[1]))];
for (const h of handlers) {
  if (!ALLOWED_HANDLERS[h]) {
    problems.push(`دکمه‌ی پنل «${h}» در فهرست مجاز نیست. هر دکمه‌ی تازه یا موقتی است و باید برود، یا آگاهانه ثبت شود.`);
  }
}

/* ═══ ۴) پالت و رندرکننده نباید واگرا شوند ═════════════════════════════
   مهم‌ترین بررسی این فایل.

   سه جا نوع بلوک را تعریف می‌کنند و هر سه باید یکی باشند:
     • choices در ACF        → مدیر چه چیزی می‌تواند بسازد
     • TYPES در content-blocks.ts → چه چیزی خوانده می‌شود
     • شاخه‌های ContentBlocks.astro → چه چیزی رندر می‌شود

   واگرایی یعنی مدیر بلوکی می‌سازد که روی صفحه هیچ‌وقت ظاهر نمی‌شود — و
   هیچ خطایی هم نمی‌بیند. دقیقاً همان شکست خاموشی که این پروژه را
   یک ماه عقب انداخت. */
const cb = groups.contentBlocks?.group;
let acfTypes = [];
if (cb) {
  const rep = cb.fields?.[0]?.sub_fields ?? [];
  const typeField = rep.find((f) => f.name === 'block_type');
  acfTypes = Object.keys(typeField?.choices ?? {});
  if (acfTypes.length === 0) problems.push('فیلد block_type در ACF هیچ گزینه‌ای ندارد.');
}

const libSrc = read('src/lib/content-blocks.ts');
const libTypes = (/const TYPES: BlockType\[\] = \[([^\]]*)\]/.exec(libSrc)?.[1] ?? '')
  .split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);

const astroSrc = read('src/components/ContentBlocks.astro');
const renderedTypes = [...new Set([...astroSrc.matchAll(/b\.type === '([a-z]+)'/g)].map((m) => m[1]))];

const cmp = (a, b, an, bn) => {
  for (const x of a) if (!b.includes(x)) problems.push(`نوع بلوک «${x}» در ${an} هست ولی در ${bn} نیست.`);
};
if (acfTypes.length && libTypes.length && renderedTypes.length) {
  cmp(acfTypes, libTypes, 'ACF', 'content-blocks.ts');
  cmp(libTypes, acfTypes, 'content-blocks.ts', 'ACF');
  cmp(acfTypes, renderedTypes, 'ACF', 'ContentBlocks.astro');
  cmp(renderedTypes, acfTypes, 'ContentBlocks.astro', 'ACF');
} else {
  problems.push('استخراج انواع بلوک شکست خورد — این بررسی بی‌اعتبار است تا رفع شود.');
}

/* ═══ ۵) سند معماری باید وجود داشته باشد ══════════════════════════════ */
if (!existsSync('docs/architecture.md')) {
  problems.push('docs/architecture.md وجود ندارد — قرارداد معماری گم شده است.');
}

// ═══ گزارش ══════════════════════════════════════════════════════════════
if (problems.length) {
  console.error(`❌ ${problems.length} نقض معماری (docs/architecture.md):`);
  for (const p of problems) console.error(`   • ${p}`);
  process.exit(1);
}

console.log(
  `✅ معماری سالم — ${Object.keys(groups).length} گروه ACF، ${handlers.length} دکمه‌ی پنل، ` +
    `${acfTypes.length} نوع بلوک در هر سه لایه یکسان.`,
);
