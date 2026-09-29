#!/usr/bin/env node
// scripts/check-product-offers.mjs  [dist-dir]
// ---------------------------------------------------------------------------
// هر Offer در JSON-LD خروجی build باید قابل‌دفاع باشد. اجرا در postbuild.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا
// ═══════════════════════════════════════════════════════════════════════════
// ایست ۲ (۷ مهر ۱۴۰۵): قیمت پس از N روز منقضی می‌شود و سایت استاتیک است.
// اگر rebuild از کار بیفتد، تنها چیزی که گوگل را از «قیمت کهنه‌ی فعال» نجات
// می‌دهد priceValidUntil است. پس نبودنش یک باگ است، نه یک جزئیات — و این
// بررسی آن را در build می‌گیرد، نه در Search Console چند هفته بعد.
//
// قاعده‌ها، هر کدام برای یک شکست:
//   ۱) هر Offer باید priceValidUntil داشته باشد.
//   ۲) priceValidUntil در گذشته نباشد — یعنی داده‌ی کهنه وارد build شده.
//   ۳) availability = InStock — فقط قلم پرداخت‌پذیر Offer می‌گیرد و
//      پرداخت‌پذیر یعنی موجود. هر چیز دیگر یعنی «آخرین قیمت» وارد اسکیما شده.
//   ۴) صفحه‌ی محصول: همان عدد Offer روی صفحه دیده شود. اسکیمای بی‌پشتوانه
//      در متن، خلاف قاعده‌ی داده‌ی ساختاریافته‌ی گوگل است.
// ---------------------------------------------------------------------------

import { readFileSync, globSync, existsSync } from 'node:fs';
import path from 'node:path';

const dist = process.argv[2] || 'dist';
if (!existsSync(dist)) {
  console.error(`❌ پوشه‌ی ${dist} نیست — پیش از این بررسی build لازم است.`);
  process.exit(1);
}

// «امروز» به وقت تهران — priceValidUntil روز است، نه لحظه.
const today = new Date(Date.now() + 3.5 * 3600_000).toISOString().slice(0, 10);

const offersIn = (node, out = []) => {
  if (Array.isArray(node)) node.forEach((n) => offersIn(n, out));
  else if (node && typeof node === 'object') {
    const t = node['@type'];
    if (t === 'Offer' || (Array.isArray(t) && t.includes('Offer'))) out.push(node);
    for (const v of Object.values(node)) offersIn(v, out);
  }
  return out;
};

const visibleText = (html) =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/g, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ');

const problems = [];
let offers = 0;

for (const file of globSync(`${dist}/**/*.html`)) {
  const html = readFileSync(file, 'utf8');
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  const rel = path.relative(dist, file);
  const isProductPage = /^products\/[^/]+\/index\.html$/.test(rel.split(path.sep).join('/'));

  for (const [, json] of blocks) {
    let data;
    try {
      data = JSON.parse(json);
    } catch {
      problems.push(`${rel}: JSON-LD نامعتبر`);
      continue;
    }
    for (const offer of offersIn(data)) {
      offers++;
      const until = offer.priceValidUntil;
      if (!until) problems.push(`${rel}: Offer بدون priceValidUntil (قیمت ${offer.price})`);
      else if (String(until).slice(0, 10) < today) problems.push(`${rel}: priceValidUntil در گذشته (${until})`);
      if (offer.availability !== 'https://schema.org/InStock') {
        problems.push(`${rel}: Offer روی قلم غیرموجود (${offer.availability ?? 'بدون availability'}) — «آخرین قیمت» وارد اسکیما شده`);
      }
      if (isProductPage && typeof offer.price === 'number') {
        const shown = offer.price.toLocaleString('fa-IR');
        if (!visibleText(html).includes(shown)) {
          problems.push(`${rel}: قیمت Offer (${shown}) در متن صفحه نیست`);
        }
      }
    }
  }
}

if (problems.length) {
  console.error(`❌ ${problems.length} مشکل در Offerهای JSON-LD:`);
  for (const p of problems) console.error(`   • ${p}`);
  process.exit(1);
}
console.log(`✅ هر ${offers} Offer در JSON-LD قابل‌دفاع است (priceValidUntil آینده، موجود، هم‌خوان با صفحه).`);
