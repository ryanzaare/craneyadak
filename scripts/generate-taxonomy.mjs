#!/usr/bin/env node
// scripts/generate-taxonomy.mjs
// ---------------------------------------------------------------------------
// ساختار دسته‌بندی را از وردپرس می‌خواند و `src/data/taxonomy.generated.ts`
// را می‌نویسد.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا این اسکریپت وجود دارد
// ═══════════════════════════════════════════════════════════════════════════
// تا پیش از این، ساختار ۷ سیلو و ۳۱ دسته دستی در `src/data/taxonomy.ts`
// نوشته شده بود. یعنی مدیر سایت برای افزودن یک دسته‌ی جدید به برنامه‌نویس
// نیاز داشت. این برای یک CMS، شکست معماری است.
//
// حالا وردپرس مرجع است. این اسکریپت در هر build اجرا می‌شود و ساختار را
// از وردپرس می‌گیرد.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا فایل تولید می‌کنیم و مستقیم در Astro fetch نمی‌کنیم
// ═══════════════════════════════════════════════════════════════════════════
// ۱۸ فایل (کامپوننت، صفحه و کتابخانه) این ساختار را به‌صورت *همگام* import
// می‌کنند. تبدیل هر ۱۸ تا به async یعنی ۱۸ فرصت برای همان کلاس باگی که در
// این پروژه سه بار تکرار شده (TDZ، export گم‌شده، فایل نصفه). خروجی معماری
// یکی است — وردپرس مرجع است — ولی ریسک regression عملاً صفر می‌شود.
//
// این فایلِ تولیدشده «داده‌ی هاردکد» نیست؛ کش build است. هیچ‌کس آن را دستی
// ویرایش نمی‌کند و در هر build از نو ساخته می‌شود.
//
// ═══════════════════════════════════════════════════════════════════════════
// رفتار در نبود وردپرس
// ═══════════════════════════════════════════════════════════════════════════
//   build  → شکست با پیام روشن. سایتی که همه‌ی صفحات دسته‌اش غایب است
//            نباید منتشر شود؛ سکوت اینجا خطرناک‌تر از شکست است.
//   dev    → هشدار + ادامه با آخرین نسخه‌ی موجود (پرچم --allow-stale).
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/data/taxonomy.generated.ts');
const ALLOW_STALE = process.argv.includes('--allow-stale');

// ── خواندن .env بدون وابستگی بیرونی ─────────────────────────────────────────
function loadEnv() {
  const file = resolve(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
}
loadEnv();

const BASE = (process.env.WP_GRAPHQL_URL || '').replace(/\/+$/, '');

// ── کوئری ───────────────────────────────────────────────────────────────────
// `hideEmpty: false` حیاتی است: بدون آن، وردپرس دسته‌های بدون محصول را
// برنمی‌گرداند و صفحه‌ی راهنمای آن‌ها ساخته نمی‌شود — دقیقاً همان دسته‌هایی
// که تازه ساخته شده‌اند و هنوز محصول ندارند.
const QUERY = `
query CraneTaxonomy($first: Int!) {
  craneCategories(first: $first, where: { hideEmpty: false }) {
    nodes {
      slug
      name
      description
      count
      databaseId
      parent { node { slug } }
      categoryMeta { keyword aka iconPath }
    }
  }
}`;

// اگر گروه ACF هنوز ثبت نشده باشد (افزونه‌ی قدیمی)، کوئری بالا خطا می‌دهد.
// این نسخه‌ی حداقلی بدون categoryMeta کار می‌کند تا build به‌خاطر یک فیلد
// اختیاری نخوابد.
const QUERY_FALLBACK = `
query CraneTaxonomyMinimal($first: Int!) {
  craneCategories(first: $first, where: { hideEmpty: false }) {
    nodes {
      slug
      name
      description
      count
      databaseId
      parent { node { slug } }
    }
  }
}`;

async function gql(query) {
  const res = await fetch(`${BASE}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { first: 500 } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(' | '));
  return json.data;
}

async function fetchTerms() {
  try {
    const d = await gql(QUERY);
    return { nodes: d?.craneCategories?.nodes ?? [], meta: true };
  } catch (error) {
    const msg = String(error.message || error);
    // فقط اگر علت نبودِ فیلد بود، عقب‌نشینی می‌کنیم. خطای شبکه باید بالا برود.
    if (!/categoryMeta|Cannot query field|hideEmpty/i.test(msg)) throw error;
    console.warn(
      `⚠️  [taxonomy] فیلدهای «هویت دسته» در گراف‌کیوال نیستند — با نسخه‌ی حداقلی ادامه می‌دهم.\n` +
        `    علت: ${msg.slice(0, 160)}\n` +
        `    راه‌حل: افزونه‌ی Crane Yadak را به نسخه‌ی ۱.۳.۰ یا بالاتر به‌روزرسانی کنید.`
    );
    const d = await gql(QUERY_FALLBACK);
    return { nodes: d?.craneCategories?.nodes ?? [], meta: false };
  }
}

// ── ساخت درخت ───────────────────────────────────────────────────────────────
// قاعده‌ی ساختاری، ساده و بدون هیچ فهرست هاردکد است:
//
//   ترمِ بدون والد            → سیلو   → /categories/[slug]
//   ترمِ با والدِ سطح‌یک        → دسته   → /categories/[silo]/[slug]
//   ترمِ سطح سه یا عمیق‌تر     → خطا
//
// یعنی «سیلو بودن» یک ویژگی داده‌ای است، نه یک نام در کد. اگر مدیر سایت
// فردا سیلوی هشتم بسازد، همین‌جا شناخته می‌شود.
const SLUG_OK = /^[a-z0-9-]+$/;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** توضیح وردپرس ممکن است در <p> پیچیده باشد. برای blurb متن ساده می‌خواهیم. */
function plain(html) {
  return clean(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8217;|&#039;|&rsquo;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTree(nodes) {
  const errors = [];
  const warnings = [];

  const bySlug = new Map();
  for (const n of nodes) {
    const slug = clean(n?.slug);
    if (!slug) continue;
    bySlug.set(slug, n);
  }

  const roots = [];
  const childrenOf = new Map();

  for (const n of nodes) {
    const slug = clean(n?.slug);
    if (!slug) {
      warnings.push(`ترمی بدون نامک نادیده گرفته شد: «${clean(n?.name) || '؟'}»`);
      continue;
    }

    if (!SLUG_OK.test(slug)) {
      errors.push(
        `نامک «${decodeURIComponent(slug)}» (دسته‌ی «${clean(n?.name)}») لاتین نیست.\n` +
          `      آدرس این صفحه در گوگل و واتس‌اپ شکسته می‌شود.\n` +
          `      اصلاح: وردپرس ← دسته‌بندی قطعات ← «${clean(n?.name)}» ← نامک را به یک عبارت لاتین تغییر دهید.`
      );
      continue;
    }

    const parentSlug = clean(n?.parent?.node?.slug);
    if (!parentSlug) {
      roots.push(n);
      continue;
    }

    const parent = bySlug.get(parentSlug);
    if (!parent) {
      errors.push(`والدِ «${clean(n?.name)}» (نامک ${parentSlug}) پیدا نشد.`);
      continue;
    }

    // والدِ والد وجود دارد؟ یعنی این ترم در عمق سه است.
    if (clean(parent?.parent?.node?.slug)) {
      errors.push(
        `دسته‌ی «${clean(n?.name)}» در سطح سوم است.\n` +
          `      ساختار آدرس سایت دقیقاً دو سطح است: /categories/[سیلو]/[دسته]\n` +
          `      اصلاح: در وردپرس، «دستهٔ مادر» این دسته را به یکی از سیلوهای سطح اول تغییر دهید.`
      );
      continue;
    }

    if (!childrenOf.has(parentSlug)) childrenOf.set(parentSlug, []);
    childrenOf.get(parentSlug).push(n);
  }

  const order = (a, b) => (a?.databaseId ?? 0) - (b?.databaseId ?? 0);
  roots.sort(order);

  const silos = roots.map((r) => {
    const slug = clean(r.slug);
    const kids = (childrenOf.get(slug) ?? []).sort(order);

    if (kids.length === 0) {
      warnings.push(
        `سیلوی «${clean(r.name)}» هیچ دسته‌ای ندارد — صفحه‌اش خالی ساخته می‌شود (محتوای نازک).`
      );
    }

    return {
      slug,
      name: clean(r.name) || slug,
      keyword: clean(r.categoryMeta?.keyword) || clean(r.name) || slug,
      intro: plain(r.description),
      icon: clean(r.categoryMeta?.iconPath),
      categories: kids.map((c) => ({
        slug: clean(c.slug),
        name: clean(c.name) || clean(c.slug),
        keyword: clean(c.categoryMeta?.keyword) || clean(c.name) || clean(c.slug),
        blurb: plain(c.description),
        icon: clean(c.categoryMeta?.iconPath),
        aka: clean(c.categoryMeta?.aka)
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
      })),
    };
  });

  return { silos, errors, warnings };
}

// ── تولید فایل ──────────────────────────────────────────────────────────────
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function emit(silos) {
  const urls = [];
  for (const s of silos) {
    urls.push(`/categories/${s.slug}`);
    for (const c of s.categories) urls.push(`/categories/${s.slug}/${c.slug}`);
  }

  const body = silos
    .map((s) => {
      const cats = s.categories
        .map((c) => {
          const lines = [
            `        slug: ${q(c.slug)},`,
            `        name: ${q(c.name)},`,
            `        keyword: ${q(c.keyword)},`,
            `        blurb: ${q(c.blurb)},`,
            `        icon: ${q(c.icon)},`,
          ];
          if (c.aka.length) {
            lines.push(`        aka: [${c.aka.map(q).join(', ')}],`);
          }
          return `      {\n${lines.join('\n')}\n      },`;
        })
        .join('\n');

      return [
        '  {',
        `    slug: ${q(s.slug)},`,
        `    name: ${q(s.name)},`,
        `    keyword: ${q(s.keyword)},`,
        `    intro: ${q(s.intro)},`,
        `    icon: ${q(s.icon)},`,
        '    categories: [',
        cats,
        '    ],',
        '  },',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return `// src/data/taxonomy.generated.ts
// ═══════════════════════════════════════════════════════════════════════════
//  ⛔ این فایل تولیدشده است. دستی ویرایش نکنید. ⛔
// ═══════════════════════════════════════════════════════════════════════════
//
// منبع حقیقت این داده، *وردپرس* است — نه این فایل.
//
// برای به‌روزرسانی:   npm run taxonomy      (یا فقط: npm run build)
//
// افزودن دسته‌ی جدید، بدون یک خط کد:
//   وردپرس ← محصولات کرین یدک ← دسته‌بندی قطعات
//   ← نام + نامک لاتین + انتخاب «دستهٔ مادر» ← افزودن
//   ← npm run build
//
// ترتیب سیلوها و دسته‌ها = ترتیب ساخته‌شدنشان در وردپرس (بر اساس شناسه‌ی ترم).
// یعنی دسته‌ی جدید همیشه به انتهای گروه خودش اضافه می‌شود.
//
// ───────────────────────────────────────────────────────────────────────────
// آدرس‌هایی که این ساختار می‌سازد (${urls.length} آدرس)
//
// این فهرست عمداً اینجاست: هر تغییری در ساختار وردپرس، در diff گیت به‌صورت
// تغییر آدرس دیده می‌شود. برای سایتی که کل ارزشش رتبه‌ی گوگل است، تغییر
// بی‌سروصدای URL خطرناک‌ترین اتفاق ممکن است.
// ───────────────────────────────────────────────────────────────────────────
${urls.map((u) => `//   ${u}`).join('\n')}
// ---------------------------------------------------------------------------

export const SILOS_DATA = [
${body}
];
`;
}

/** آدرس‌های نسخه‌ی قبلی را از بلوک کامنت بالای فایل می‌خواند. */
function previousUrls() {
  if (!existsSync(OUT)) return null;
  const text = readFileSync(OUT, 'utf8');
  const found = [...text.matchAll(/^\/\/\s{3}(\/categories\/\S+)$/gm)].map((m) => m[1]);
  return found.length ? found : null;
}

function reportUrlChanges(before, after) {
  if (!before) return;
  const b = new Set(before);
  const a = new Set(after);
  const removed = before.filter((u) => !a.has(u));
  const added = after.filter((u) => !b.has(u));

  if (added.length) {
    console.info(`\n➕ [taxonomy] ${added.length} آدرس جدید:`);
    for (const u of added.slice(0, 15)) console.info(`     ${u}`);
    if (added.length > 15) console.info(`     … و ${added.length - 15} مورد دیگر`);
  }

  if (removed.length) {
    console.warn(
      `\n🔴 [taxonomy] ${removed.length} آدرس حذف یا جابه‌جا شد:\n` +
        removed.map((u) => `     ${u}`).join('\n') +
        `\n\n     اگر این آدرس‌ها قبلاً منتشر و ایندکس شده‌اند، بدون ریدایرکت ۳۰۱\n` +
        `     رتبه‌شان از دست می‌رود. تغییر «دستهٔ مادر» یک دسته در وردپرس،\n` +
        `     آدرس آن را عوض می‌کند — این هزینه‌ی واقعیِ ویرایش‌پذیر بودن ساختار است.\n`
    );
  }
}

// ── اجرا ────────────────────────────────────────────────────────────────────
function fail(message) {
  const stale = existsSync(OUT);

  if (ALLOW_STALE && stale) {
    console.warn(
      `\n⚠️  [taxonomy] ${message}\n` +
        `    با آخرین ساختار ذخیره‌شده ادامه می‌دهم (حالت dev).\n` +
        `    ممکن است دسته‌های جدید وردپرس را نبینید.\n`
    );
    process.exit(0);
  }

  console.error(
    `\n❌ [taxonomy] ${message}\n\n` +
      `   ساختار دسته‌بندی از وردپرس خوانده نشد، پس هیچ صفحه‌ی دسته‌ای ساخته نمی‌شود.\n` +
      `   انتشار سایتی بدون صفحات دسته، بدتر از شکست build است — پس build متوقف شد.\n\n` +
      `   بررسی کنید:\n` +
      `     • وردپرس بالا است؟   ${BASE || '(WP_GRAPHQL_URL تنظیم نشده)'}\n` +
      `     • افزونه‌ی Crane Yadak نسخه‌ی ۱.۳.۰ فعال است؟\n` +
      `     • یک‌بار «ساختار دسته‌بندی» را در پنل اجرا کرده‌اید؟\n\n` +
      `   برای ادامه با آخرین نسخه‌ی ذخیره‌شده:  node scripts/generate-taxonomy.mjs --allow-stale\n`
  );
  process.exit(1);
}

async function main() {
  if (!BASE) fail('WP_GRAPHQL_URL تنظیم نشده است.');

  let result;
  try {
    result = await fetchTerms();
  } catch (error) {
    fail(String(error.message || error));
    return;
  }

  if (!result.nodes.length) {
    fail('وردپرس هیچ دسته‌ای برنگرداند.');
    return;
  }

  const { silos, errors, warnings } = buildTree(result.nodes);

  if (errors.length) {
    console.error(`\n❌ [taxonomy] ${errors.length} مشکل ساختاری در وردپرس:\n`);
    for (const e of errors) console.error(`   • ${e}`);
    console.error('');
    process.exit(1);
  }

  const totalCats = silos.reduce((n, s) => n + s.categories.length, 0);
  if (!totalCats) {
    fail(
      'هیچ دسته‌ای زیر سیلو نیست — همه‌ی ترم‌ها بدون والدند.\n' +
        '   یک‌بار وردپرس ← محصولات کرین یدک ← «ساختار دسته‌بندی» را اجرا کنید.'
    );
    return;
  }

  const before = previousUrls();
  const output = emit(silos);
  const after = [...output.matchAll(/^\/\/\s{3}(\/categories\/\S+)$/gm)].map((m) => m[1]);

  writeFileSync(OUT, output, 'utf8');

  console.info(
    `✅ [taxonomy] ${silos.length} سیلو و ${totalCats} دسته از وردپرس خوانده شد` +
      `${result.meta ? '' : ' (بدون فیلدهای هویت دسته)'}.`
  );
  for (const w of warnings) console.warn(`   ⚠ ${w}`);
  reportUrlChanges(before, after);
}

// فقط وقتی مستقیم اجرا شود. بدون این نگهبان، فایل تست نمی‌تواند توابع را
// import کند بدون آن‌که کل اسکریپت اجرا شود.
if (process.argv[1] && process.argv[1].endsWith('generate-taxonomy.mjs')) {
  main();
}

export { buildTree, emit, plain };

