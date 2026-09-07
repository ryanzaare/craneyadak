#!/usr/bin/env node
// scripts/check-astro-tags.mjs
// ---------------------------------------------------------------------------
// شمارش تگ‌های باز/بسته در تمپلیت Astro.
//
// ⚠️ نسخه‌ی اول این بررسی فقط `<div ` و `<div>` را می‌شمرد، پس تگ‌های
// چندخطی مثل:
//     <section
//       id="x"
//     >
// را نمی‌دید و روی کد سالم خطای دروغ می‌داد. دقیقاً همان الگویی که در این
// پروژه چند بار تکرار شده: ابزار تشخیصی که نتیجه‌ی دروغ می‌دهد، از نبودش
// بدتر است — چون خطای واقعی را در نویز گم می‌کند.
//
// این نسخه: کامنت‌ها را حذف می‌کند، تگ چندخطی را می‌بیند، و تگ
// خودبسته (`<img … />`) را باز حساب نمی‌کند.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';

const TAGS = ['section','div','ul','ol','li','table','thead','tbody','tr','figure',
              'details','nav','dl','article','a','p','h1','h2','h3','span','form'];

function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')  // JSX comments
    .replace(/\/\*[\s\S]*?\*\//g, '')      // block comments
    .replace(/^\s*\/\/[^\n]*$/gm, '');     // line comments
}

let failed = 0;
for (const file of process.argv.slice(2)) {
  const raw = readFileSync(file, 'utf8');

  /*
   * ⚠️ جداکنندهٔ frontmatter در Astro، یک `---` است که **تنها چیز روی
   * خط** باشد. تقسیم ساده با split('---') اشتباه است، چون کامنت‌های
   * هدر این پروژه پر از خط `// -------------` هستند و اولین برش دقیقاً
   * وسط همان کامنت می‌افتد.
   *
   * نتیجه‌ی آن اشتباه: بدنه شامل کد frontmatter می‌شد و یک regex که
   * رشته‌ی `<div ...>` داخلش بود، به‌عنوان تگ باز شمرده می‌شد →
   * خطای دروغ روی فایل سالم.
   */
  const lines = raw.split('\n');
  const delims = [];
  for (let i = 0; i < lines.length && delims.length < 2; i++) {
    if (lines[i].trim() === '---') delims.push(i);
  }
  const body = stripComments(
    delims.length === 2 ? lines.slice(delims[1] + 1).join('\n') : raw,
  );

  const bad = [];
  for (const tag of TAGS) {
    // باز: <tag سپس فاصله، خط جدید یا > — ولی نه </tag
    const opens = [...body.matchAll(new RegExp(`<${tag}(?=[\\s>/])`, 'g'))];
    // از میان آن‌ها، خودبسته‌ها را کم می‌کنیم
    let selfClosing = 0;
    for (const m of opens) {
      const rest = body.slice(m.index);
      const end = rest.indexOf('>');
      if (end > 0 && rest[end - 1] === '/') selfClosing++;
    }
    const closes = (body.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    const realOpens = opens.length - selfClosing;
    if (realOpens !== closes) bad.push(`<${tag}> ${realOpens} باز / ${closes} بسته`);
  }

  if (bad.length) {
    failed++;
    console.error(`❌ ${file}`);
    for (const b of bad) console.error(`     ${b}`);
  } else {
    console.info(`✅ ${file}`);
  }
}
process.exit(failed ? 1 : 0);
