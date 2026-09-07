#!/usr/bin/env node
// scripts/diagnose-brand.mjs
// ---------------------------------------------------------------------------
// چرا صفحه‌ی برند خالی است؟
//
// این اسکریپت دقیقاً همان کوئری‌هایی را می‌زند که فرانت‌اند در زمان build
// می‌زند، و خام‌ترین پاسخ وردپرس را چاپ می‌کند. هدف: تشخیص اینکه مشکل از
// اسکیما است، از داده، یا از فرانت‌اند.
//
// اجرا:  node scripts/diagnose-brand.mjs [slug]
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WANT = process.argv[2] ?? 'demag';

function loadEnv() {
  const file = resolve(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
}
loadEnv();

const BASE = (process.env.WP_GRAPHQL_URL || '').replace(/\/+$/, '');
if (!BASE) {
  console.error('❌ WP_GRAPHQL_URL تنظیم نشده است.');
  process.exit(1);
}

async function gql(query) {
  const res = await fetch(`${BASE}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { first: 100 } }),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

const line = (s = '') => console.log(s);
const H = (s) => { line(); line(`═══ ${s} ${'═'.repeat(Math.max(0, 60 - s.length))}`); };

// ── ۱. آیا اصلاً برندی هست؟ ─────────────────────────────────────────────────
H('۱. برندها در وردپرس');
{
  const r = await gql(`query { craneBrands(first: 100) { nodes { slug title } } }`);
  if (r.json?.errors) {
    console.error('❌ خطا:', r.json.errors.map((e) => e.message).join(' | '));
    process.exit(1);
  }
  const nodes = r.json?.data?.craneBrands?.nodes ?? [];
  console.log(`   ${nodes.length} برند پیدا شد.`);
  const hit = nodes.find((n) => n.slug === WANT);
  console.log(hit ? `   ✅ «${WANT}» موجود است: ${hit.title}` : `   ❌ «${WANT}» پیدا نشد!`);
  if (!hit) {
    console.log('   اسلاگ‌های موجود:', nodes.map((n) => n.slug).join(', '));
    process.exit(1);
  }
}

// ── ۲. آیا فیلد brandProfile در اسکیما هست؟ ────────────────────────────────
H('۲. فیلد brandProfile در اسکیمای گراف‌کیوال');
{
  const r = await gql(`query { craneBrands(first: 1) { nodes { brandProfile { heroClaim } } } }`);
  if (r.json?.errors) {
    const msg = r.json.errors.map((e) => e.message).join(' | ');
    console.error(`   ❌ ${msg}`);
    line();
    if (/brandProfile/i.test(msg)) {
      console.error('   → گروه ACF «پروفایل تخصصی برند» در گراف‌کیوال دیده نمی‌شود.');
      console.error('     ۱) افزونه‌ی کرین یدک نسخه‌ی ۱.۵.۰ نصب و فعال است؟');
      console.error('     ۲) افزونه‌ی «WPGraphQL for Advanced Custom Fields» فعال است؟');
      console.error('     ۳) تنظیمات ← پیوندهای یکتا ← ذخیره (پاک‌سازی کش اسکیما)');
    }
    process.exit(1);
  }
  console.log('   ✅ فیلد brandProfile در اسکیما وجود دارد.');
}

// ── ۳. داده‌ی واقعی همان برند ───────────────────────────────────────────────
H(`۳. داده‌ی واقعی «${WANT}»`);
{
  const r = await gql(`query {
    craneBrands(first: 100) { nodes { slug brandProfile {
      heroClaim intro foundedYear headquarters identificationGuide iranPresence
      series { seriesName commonInIran }
      commonParts { partName }
      technologies { name }
      faqs { question }
      sources { title url }
    } } }
  }`);

  if (r.json?.errors) {
    console.error('   ❌', r.json.errors.map((e) => e.message).join(' | '));
    process.exit(1);
  }

  const node = (r.json?.data?.craneBrands?.nodes ?? []).find((n) => n.slug === WANT);
  const p = node?.brandProfile;

  if (!p) {
    console.log('   ❌ brandProfile برای این برند null است — یعنی هیچ فیلدی ذخیره نشده.');
    console.log('      در پنل، فیلدها را پر کنید و دکمه‌ی «به‌روزرسانی» را بزنید.');
    process.exit(1);
  }

  const rows = [
    ['heroClaim', p.heroClaim],
    ['intro', p.intro],
    ['foundedYear', p.foundedYear],
    ['headquarters', p.headquarters],
    ['identificationGuide', p.identificationGuide],
    ['iranPresence', p.iranPresence],
  ];

  let filled = 0;
  for (const [k, v] of rows) {
    const has = typeof v === 'string' && v.trim().length > 0;
    if (has) filled++;
    console.log(`   ${has ? '✅' : '⬜'} ${k.padEnd(22)} ${has ? `${v.trim().length} کاراکتر` : 'خالی'}`);
  }

  const reps = [
    ['series', p.series], ['commonParts', p.commonParts],
    ['technologies', p.technologies], ['faqs', p.faqs], ['sources', p.sources],
  ];
  for (const [k, v] of reps) {
    const n = Array.isArray(v) ? v.length : 0;
    if (n) filled++;
    console.log(`   ${n ? '✅' : '⬜'} ${k.padEnd(22)} ${n} ردیف`);
  }

  // ── تشخیص HTML دوبار-escape شده ─────────────────────────────────────────
  H('۴. سلامت HTML');
  let mangled = 0;
  for (const [k, v] of rows) {
    if (typeof v !== 'string' || !v) continue;
    if (/&lt;(p|h3|ul|li|strong|div)&gt;/i.test(v)) {
      mangled++;
      console.log(`   🔴 ${k}: HTML دوبار escape شده — «&lt;p&gt;» به‌جای «<p>»`);
      console.log(`      علت: متن در تب «بصری» چسبانده شده، نه «متن».`);
    } else if (/^<div>/.test(v.trim()) && v.includes('&lt;')) {
      mangled++;
      console.log(`   🔴 ${k}: در <div> پیچیده و escape شده.`);
    }
  }
  if (!mangled) console.log('   ✅ هیچ فیلدی دوبار escape نشده.');

  H('نتیجه');
  if (filled === 0) {
    console.log('   ❌ هیچ فیلدی مقدار ندارد → صفحه خالی می‌ماند (این درست است).');
  } else if (mangled) {
    console.log(`   ⚠️  ${filled} فیلد پر است ولی ${mangled} فیلد HTML خراب دارد.`);
    console.log('      راه‌حل: با ابزار «ورود محتوا از فایل» دوباره وارد کنید.');
  } else {
    console.log(`   ✅ ${filled} بخش داده دارد. صفحه باید محتوا نشان دهد.`);
    console.log('      اگر باز هم خالی است، `npm run build` را دوباره اجرا کنید');
    console.log('      و دنبال خط «[brand] … برند پروفایل تخصصی دارند» بگردید.');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ۵. کوئری *دقیقاً همان چیزی که فرانت‌اند می‌زند*
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ این بخش یک بار **دروغ گفت** و باید بدانیم چرا، وگرنه دوباره می‌گوید.
//
// نسخه‌ی قبل نمی‌توانست `brand-profile.ts` را import کند، پس آن را با regex
// می‌خواند تا کوئری‌ها را بازسازی کند. regex شکست خورد و `?? ''` شکست را
// به رشته‌ی خالی تبدیل کرد. نتیجه: کوئریِ «کامل» **بدون هیچ فیلدی** اجرا
// شد، طبیعتاً موفق شد، و اینجا نوشت «✅ کامل کار کرد» — در حالی که در همان
// لحظه build واقعی داشت به «بدون رسانه» سقوط می‌کرد و ۵ لینک داخلی را از
// صفحه‌ی برند حذف می‌کرد.
//
// دو تغییر که این را ساختاراً غیرممکن می‌کند:
//   ۱) شکل‌ها از `brand-queries.mjs` **import** می‌شوند — بدون بازتفسیر.
//   ۲) پیش از هر درخواست شبکه، خودِ شکل‌ها ممیزی می‌شوند؛ اگر کوئری آن
//      چیزی نباشد که ادعا می‌کند، اسکریپت همین‌جا می‌ایستد.
H('۵. کوئری واقعی فرانت‌اند');

const { SHAPES, auditShapes } = await import('../src/lib/brand-queries.mjs');

const problems = auditShapes();
if (problems.length) {
  console.log('   🔴 ممیزی نردبان کوئری شکست خورد — هیچ درخواستی فرستاده نشد:');
  for (const p of problems) console.log(`        • ${p}`);
  console.log('      تا این رفع نشود، نتیجه‌ی این بخش بی‌اعتبار است.');
  process.exit(1);
}
console.log(`   ✅ ممیزی نردبان: ${SHAPES.length} شکل، ترتیب تنزل درست.`);
console.log();

let landed = null;
for (const shape of SHAPES) {
  const r = await gql(shape.query);
  if (r.json?.errors) {
    console.log(`   ❌ «${shape.name}»`);
    for (const e of r.json.errors) console.log(`        ${e.message}`);
    continue;
  }
  const hit = (r.json?.data?.craneBrands?.nodes ?? []).find((x) => x.slug === WANT);
  console.log(`   ✅ «${shape.name}» — brandProfile: ${hit?.brandProfile ? 'دارد' : 'null'}`);
  landed = shape;
  break;
}

line();
if (!landed) {
  console.log('   🔴 هیچ شکلی کار نکرد → فرانت‌اند هیچ داده‌ای نمی‌گیرد و صفحه خالی می‌ماند.');
  console.log('      پیام خطای بالا نام فیلد مقصر را دارد.');
} else if (landed === SHAPES[0]) {
  console.log('   ✅ غنی‌ترین شکل کار می‌کند — رسانه و لینک دسته هر دو واکشی می‌شوند.');
} else {
  console.log(`   ⚠️  build روی «${landed.name}» فرود می‌آید. از دست می‌رود:`);
  if (!landed.hasMedia) console.log('        • بخش تصاویر و ویدیو');
  if (!landed.hasCategoryLink) console.log('        • 🔴 لینک داخلی «قطعات پرتقاضا ← صفحه‌ی دسته» (ضرر سئویی)');
  if (!landed.hasParts) console.log('        • 🔴 کل بخش «قطعات پرتقاضا»');
}
