#!/usr/bin/env node
/**
 * تشخیص برندها — «وردپرس واقعاً چه چیزی برمی‌گرداند؟»
 *
 * ---------------------------------------------------------------------------
 * چرا این اسکریپت وجود دارد
 *
 * فیلدهای برند روی سایت نمایش داده نمی‌شدند و من نمی‌توانستم علتش را
 * قطعی بگویم، چون محیط من به admin.craneyadak.com دسترسی ندارد. دو بار
 * حدس زدم و هر دو بار اشتباه بود — بار دوم چون کوئری را در برابر یک
 * ماک تست کردم که خودم نوشته بودم، یعنی فرض را با خودش تایید کردم.
 *
 * این اسکریپت به‌جای حدس، از خودِ وردپرس می‌پرسد و دقیقاً می‌گوید کدام
 * حلقه شکسته است:
 *   • آیا اندپوینت پاسخ می‌دهد؟
 *   • آیا نوع پست `craneBrands` وجود دارد؟
 *   • چند برند منتشر شده؟
 *   • اسلاگ واقعی هرکدام چیست؟ (فارسی یا لاتین)
 *   • آیا گروه فیلد `brandFields` روی اسکیما هست؟
 *   • کدام برند رنگ و متن سئو دارد و کدام ندارد؟
 *
 * اجرا (در ریشه‌ی پروژه):
 *   node scripts/diagnose-brands.mjs
 * ---------------------------------------------------------------------------
 */

import { readFileSync } from 'node:fs';

/* ---------- خواندن آدرس از .env ---------- */
let base = process.env.WP_GRAPHQL_URL ?? '';
if (!base) {
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    base = env.match(/^WP_GRAPHQL_URL=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
  } catch {
    /* بی‌خیال؛ پایین گزارش می‌شود */
  }
}

if (!base) {
  console.error('✗ WP_GRAPHQL_URL نه در محیط و نه در .env پیدا نشد.');
  process.exit(1);
}

const endpoint = `${base.replace(/\/+$/, '')}/graphql`;
console.log(`\nاندپوینت: ${endpoint}\n${'─'.repeat(64)}`);

async function gql(query) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { httpError: `HTTP ${res.status} — پاسخ JSON نبود:\n${text.slice(0, 300)}` };
  }
  return { status: res.status, ...json };
}

/* ---------- ۱) آیا نوع پست وجود دارد؟ ---------- */
const probe = await gql('{ craneBrands(first: 1) { nodes { slug } } }');

if (probe.httpError) {
  console.error(`✗ ${probe.httpError}`);
  process.exit(1);
}
if (probe.errors) {
  console.error('✗ کوئری پایه خطا داد:');
  for (const e of probe.errors) console.error(`    ${e.message}`);
  console.error(
    '\n  یعنی نوع پست «craneBrands» روی این نصب وجود ندارد یا افزونه فعال نیست.\n'
  );
  process.exit(1);
}
console.log('✓ نوع پست craneBrands روی اسکیما موجود است.');

/* ---------- ۲) آیا گروه فیلد brandFields هست؟ ---------- */
const withFields = await gql(`{
  craneBrands(first: 100) {
    nodes {
      databaseId
      title
      slug
      status
      brandFields { nameEn logoText brandColor seoAnchor seoDesc }
    }
  }
}`);

if (withFields.errors) {
  console.error('\n✗ کوئری فیلدهای ACF خطا داد:');
  for (const e of withFields.errors) console.error(`    ${e.message}`);
  console.error(
    `\n  محتمل‌ترین علت: گروه فیلد «Brand Fields» روی نوع CraneBrand در\n` +
      `  گراف‌کیوال منتشر نشده است. در ACF → گروه فیلد → Settings مطمئن شوید\n` +
      `  «Show in GraphQL» روشن و «GraphQL Field Name» برابر brandFields است.\n`
  );
  process.exit(1);
}
console.log('✓ گروه فیلد brandFields روی اسکیما موجود است.\n');

/* ---------- ۳) گزارش رکورد به رکورد ---------- */
const nodes = withFields.data?.craneBrands?.nodes ?? [];
console.log(`برندهای برگشتی: ${nodes.length}\n${'─'.repeat(64)}`);

const isLatin = (s) => /^[a-z0-9-]+$/i.test(s ?? '');
let persianSlugs = 0;
let noColor = 0;
let noDesc = 0;

for (const n of nodes) {
  const slug = n.slug ?? '?';
  const f = n.brandFields ?? {};
  const latin = isLatin(slug);
  if (!latin) persianSlugs++;
  if (!f.brandColor) noColor++;
  if (!f.seoDesc) noDesc++;

  console.log(
    `${latin ? '✓' : '✗'} ${String(slug).padEnd(28)} «${n.title ?? '?'}»\n` +
      `    nameEn=${f.nameEn ?? '—'}  color=${f.brandColor ?? '—'}\n` +
      `    seoDesc=${f.seoDesc ? `${String(f.seoDesc).slice(0, 50)}…` : '— (خالی)'}`
  );
}

/* ---------- ۴) جمع‌بندی ---------- */
console.log(`${'─'.repeat(64)}\nجمع‌بندی:`);
console.log(`  ${nodes.length} برند منتشرشده`);
console.log(`  ${persianSlugs} اسلاگ غیرلاتین`);
console.log(`  ${noColor} برند بدون رنگ`);
console.log(`  ${noDesc} برند بدون توضیح سئو`);

if (persianSlugs > 0) {
  console.log(
    `\n⚠️  ${persianSlugs} برند اسلاگ فارسی دارد.\n` +
      `   عنوان فارسی در وردپرس اسلاگ فارسی می‌سازد و با اسلاگ لاتین\n` +
      `   تاکسونومی تطبیق نمی‌خورد. فرانت‌اند حالا با نام انگلیسی و عنوان\n` +
      `   هم تطبیق می‌دهد، اما اسلاگ لاتین برای آدرس صفحه هم لازم است:\n` +
      `   محصولات ← «اصلاح آدرس‌ها»، یا اسلاگ هر برند را دستی لاتین کنید.`
  );
}
if (nodes.length === 0) {
  console.log(
    `\n⚠️  هیچ برندی برنگشت. یا برندها هنوز منتشر نشده‌اند (پیش‌نویس‌اند)،\n` +
      `   یا در نوع پست دیگری ثبت شده‌اند.`
  );
}
if (persianSlugs === 0 && noColor === 0 && nodes.length > 0) {
  console.log('\n✓ همه‌چیز سالم است. اگر سایت هنوز داده را نشان نمی‌دهد، بیلد را دوباره اجرا کنید.');
}
console.log('');
