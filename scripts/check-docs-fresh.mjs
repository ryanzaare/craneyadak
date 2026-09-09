#!/usr/bin/env node
// scripts/check-docs-fresh.mjs
// ---------------------------------------------------------------------------
// مستندات نباید از فیچرهای حذف‌شده حرف بزنند.
//
// ═══════════════════════════════════════════════════════════════════════════
// شکستی که این اسکریپت از تکرارش جلوگیری می‌کند
// ═══════════════════════════════════════════════════════════════════════════
// یک skill به نام `craneyadak-project-state` ساخته شد تا وضعیت پروژه را نگه
// دارد. چند هفته به‌روز شد و بعد رها شد. یک ماه بعد هنوز از ووکامرس،
// datasheets و `taxonomy.ts` می‌گفت — هر سه حذف شده بودند.
//
// یعنی سندی که برای جلوگیری از سردرگمی نوشته شده بود، خودش تبدیل به منبع
// اطلاعات غلط شد. و هیچ‌چیز این را نگرفت، چون هیچ‌چیز *دنبالش نمی‌گشت*.
//
// یادداشت در حافظه، تضمین نیست. قولِ «این بار یادم می‌ماند» هم نیست.
// چیزی که تضمین است، تستی است که build را می‌شکند.
//
// ═══════════════════════════════════════════════════════════════════════════
// چطور کار می‌کند
// ═══════════════════════════════════════════════════════════════════════════
// فهرست `RETIRED` نام چیزهایی است که عمداً حذف شده‌اند. اسکریپت دو کار
// می‌کند و هر دو لازم است:
//
//   ۱) اگر سندی هنوز نام یک فیچر بازنشسته را ببرد → خطا.
//   ۲) **خودآزمایی**: اگر نامی در فهرست «بازنشسته» باشد ولی هنوز واقعاً در
//      کد زنده باشد → خطا. بدون این، فهرست به‌مرور دروغ می‌شود و ابزار
//      دقیقاً همان سرنوشتِ سندی را پیدا می‌کند که قرار بود نجاتش دهد.
// ---------------------------------------------------------------------------

import { readFileSync, globSync, statSync } from 'node:fs';

/**
 * چیزهایی که از پروژه حذف شده‌اند.
 *
 * ⚠️ با هر حذف فیچر، یک سطر اینجا اضافه شود. این تنها کار دستی این ابزار
 * است و همان‌جایی است که تصمیمِ حذف گرفته می‌شود — نه ماه‌ها بعد.
 */
const RETIRED = [
  { term: 'craneCommerce', why: 'فیلد گراف‌کیوال پل ووکامرس — حذف شد' },
  { term: 'class-woocommerce-bridge', why: 'پل ووکامرس — حذف شد' },
  { term: 'PriceHistory', why: 'نمودار تاریخچه‌ی قیمت — حذف شد' },
  { term: 'price_history', why: 'گروه ACF تاریخچه‌ی قیمت — حذف شد' },
  // ⚠️ مسیر کامل، نه فقط نام فایل. نسخه‌ی اول این فهرست
  // «category-content.ts» را نوشته بود و `src/lib/category-content.ts` را
  // که کاملاً زنده است به‌اشتباه بازنشسته اعلام می‌کرد. آنچه حذف شد فقط
  // نسخه‌ی `src/data/` بود.
  { term: 'src/data/category-content.ts', why: 'داده‌ی هاردکد دسته‌ها — حذف شد' },
  { term: 'lib/datasheets', why: 'فیچر دیتاشیت — حذف شد (اعداد ساختگی بود)' },
  { term: 'diagnose-brands.mjs', why: 'با diagnose-brand.mjs جایگزین شد' },
];

const DOCS = [...globSync('docs/**/*.md'), 'CLAUDE.md', 'README.md'].filter((f) => {
  try { return statSync(f).isFile(); } catch { return false; }
});

const CODE = [
  ...globSync('src/**/*.{ts,mts,astro,mjs,js,css}'),
  ...globSync('scripts/**/*.mjs'),
  ...globSync('wordpress-plugin/**/*.php'),
  'astro.config.mjs',
  'package.json',
].filter((f) => {
  try { return statSync(f).isFile(); } catch { return false; }
});

const read = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };

const REMOVAL_WORDS = /(حذف|بازنشسته|پاک ?شد|removed|deleted|retired|no longer|دیگر وجود ندارد)/i;

/**
 * ⚠️ نسخه‌ی اول این تابع سطر‌به‌سطر کار می‌کرد و غلط بود.
 *
 * توضیحِ یک حذف معمولاً یک بلوک چندخطی است: کلمه‌ی «حذف شد» فقط در خط
 * اول می‌آید و خطوط بعدی جزئیات را می‌گویند. بررسی سطری، آن خطوط بعدی
 * را «ارجاع کهنه» می‌شمرد — یعنی ابزار برای مستنداتِ *درست* خطا می‌داد.
 *
 * حالا یک پنجره‌ی سه‌خطیِ قبل هم دیده می‌شود.
 */
const inRemovalBlock = (lines, i) =>
  lines.slice(Math.max(0, i - 3), i + 1).some((l) => REMOVAL_WORDS.test(l));

/**
 * کامنت‌ها را خنثی می‌کند.
 *
 * ⚠️ تمایزی که نسخه‌ی اول نداشت: «نام بردن» با «استفاده کردن» فرق دارد.
 * کامنتی که توضیح می‌دهد چرا چیزی حذف شد، *مطلوب* است و باید بماند. آنچه
 * نباید بماند، کدِ زنده‌ای است که هنوز آن را صدا می‌زند.
 */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')
    .replace(/(^|\s)#[^\n]*/g, '$1');

const problems = [];
const selfCheck = [];

// ── ۱) خودآزمایی: آیا واقعاً بازنشسته‌اند؟ ───────────────────────────────
const liveCode = CODE.filter((f) => !f.includes('check-docs-fresh'))
  .map((f) => stripComments(read(f)))
  .join('\n');

for (const { term } of RETIRED) {
  const hits = liveCode.split('\n').filter((l) => l.includes(term)).length;
  if (hits > 0) {
    selfCheck.push(`«${term}» در فهرست بازنشسته‌هاست ولی هنوز ${hits} بار در کدِ زنده (نه کامنت) است.`);
  }
}

// ── ۲) آیا مستندات هنوز از آن‌ها حرف می‌زنند؟ ────────────────────────────
for (const file of DOCS) {
  const lines = read(file).split('\n');
  lines.forEach((line, i) => {
    if (inRemovalBlock(lines, i)) return;
    for (const { term, why } of RETIRED) {
      if (line.includes(term)) problems.push(`${file}:${i + 1} — «${term}» (${why})`);
    }
  });
}

// ── ۳) آیا backlog از کد عقب افتاده؟ ─────────────────────────────────────
const DAYS = 45;
const mtime = (f) => { try { return statSync(f).mtimeMs; } catch { return 0; } };
const backlog = mtime('docs/backlog.md');
const newestCode = Math.max(...CODE.map(mtime));
const staleDays = Math.floor((newestCode - backlog) / 86_400_000);

// ── گزارش ──────────────────────────────────────────────────────────────────
if (selfCheck.length) {
  console.error('❌ فهرست بازنشسته‌ها خودش کهنه است:');
  for (const s of selfCheck) console.error(`   • ${s}`);
  console.error('   یا آن نام دوباره زنده شده، یا باید از RETIRED برداشته شود.');
  process.exit(1);
}

if (problems.length) {
  console.error(`❌ ${problems.length} ارجاع کهنه در مستندات — سندی که دروغ بگوید از نبودِ سند بدتر است:`);
  for (const p of problems) console.error(`   • ${p}`);
  process.exit(1);
}

if (backlog === 0) {
  console.error('❌ docs/backlog.md وجود ندارد — حافظه‌ی پروژه گم شده است.');
  process.exit(1);
}

if (staleDays > DAYS) {
  console.warn(
    `⚠️  docs/backlog.md ${staleDays} روز از جدیدترین تغییر کد عقب‌تر است.\n` +
      `    یعنی احتمالاً کارهایی انجام شده که آنجا ثبت نشده. یک بار مرورش کنید.`,
  );
}

console.log(
  `✅ مستندات تازه‌اند — ${DOCS.length} سند، هیچ ارجاعی به ${RETIRED.length} فیچر بازنشسته، ` +
    `backlog ${staleDays <= 0 ? 'به‌روز' : `${staleDays} روز عقب`}.`,
);
