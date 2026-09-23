#!/usr/bin/env node
// scripts/check-cors-headers.mjs
// ---------------------------------------------------------------------------
// هر هدری که جاوااسکریپت سمت مرورگر به وردپرس می‌فرستد، باید در
// Access-Control-Allow-Headers افزونه باشد.
//
// ═══════════════════════════════════════════════════════════════════════════
// شکستی که این اسکریپت از تکرارش جلوگیری می‌کند
// ═══════════════════════════════════════════════════════════════════════════
// صفحه‌ی «حساب من» هدر `Authorization` می‌فرستاد، ولی class-cors.php فقط
// `Content-Type, X-WP-Nonce` را مجاز کرده بود. مرورگر preflight را رد
// می‌کرد، fetch خطای شبکه می‌داد، و صفحه بی‌صدا حالت «وارد نشده‌اید» را
// نشان می‌داد — در حالی که ورود واقعاً موفق بود. کاربر در یک حلقه‌ی
// «ورود → حساب من → ورود» گیر می‌کرد.
//
// هیچ بررسی‌ای آن را نگرفت: هارنس PHP توابع را مستقیم صدا می‌زند و
// مرورگری در کار نیست؛ build هم در Node اجرا می‌شود و CORS ندارد. این
// شکاف بین دو لایه است، پس فقط بررسیِ هر دو لایه با هم آن را می‌بیند.
// ---------------------------------------------------------------------------

import { readFileSync, globSync } from 'node:fs';

const CORS_FILE = 'wordpress-plugin/crane-yadak-headless/includes/class-cors.php';

// هدرهای «CORS-safelisted» به preflight نیاز ندارند.
const SAFELISTED = new Set(['accept', 'accept-language', 'content-language']);

const php = readFileSync(CORS_FILE, 'utf8');
const m = /Access-Control-Allow-Headers:\s*([^'"]+)/.exec(php);
if (!m) {
  console.error(`❌ در ${CORS_FILE} سطر Access-Control-Allow-Headers پیدا نشد.`);
  process.exit(1);
}
const allowed = new Set(m[1].split(',').map((h) => h.trim().toLowerCase()).filter(Boolean));

const problems = [];
let scanned = 0;

const check = (file, src, name, index) => {
  scanned++;
  if (SAFELISTED.has(name) || allowed.has(name)) return;
  problems.push(`${file}:${src.slice(0, index).split('\n').length} — «${name}»`);
};

/* هر کدِ مرورگر: بلوک‌های <script> در .astro، و کل ماژول‌های src/scripts
   (که فقط در مرورگر اجرا می‌شوند). frontmatter و src/lib در Node اجرا
   می‌شوند و CORS ندارند.

   ⚠️ دو شکل تعریف هدر: شیء ادبی (`headers: { 'X': … }`) و انتساب
   (`headers['X'] = …`). نسخه‌ی اول فقط اولی را می‌دید؛ src/scripts/account.ts
   توکن را با دومی می‌فرستد و اگر پوشش داده نمی‌شد، همان حلقه‌ی ورود
   دوباره ممکن بود بی‌صدا برگردد. */
const units = [];
for (const file of globSync('src/**/*.astro')) {
  const src = readFileSync(file, 'utf8');
  for (const block of src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    units.push({ file, src, code: block[1], offset: block.index + block[0].indexOf(block[1]) });
  }
}
for (const file of globSync('src/scripts/**/*.{ts,js,mjs}')) {
  const src = readFileSync(file, 'utf8');
  units.push({ file, src, code: src, offset: 0 });
}

for (const { file, src, code, offset } of units) {
  for (const h of code.matchAll(/headers:\s*\{([^}]*)\}/g)) {
    for (const k of h[1].matchAll(/(?:'([^']+)'|"([^"]+)"|([A-Za-z][\w-]*))\s*:/g)) {
      check(file, src, (k[1] ?? k[2] ?? k[3]).toLowerCase(), offset + h.index);
    }
  }
  for (const a of code.matchAll(/headers\[\s*['"]([^'"]+)['"]\s*\]\s*=/g)) {
    check(file, src, a[1].toLowerCase(), offset + a.index);
  }
}

if (problems.length) {
  console.error(
    `❌ ${problems.length} هدر درخواست مرورگر در CORS افزونه مجاز نیست — مرورگر درخواست را رد می‌کند:`,
  );
  for (const p of problems) console.error(`   • ${p}`);
  console.error(`   مجاز فعلی: ${[...allowed].join(', ')}  (${CORS_FILE})`);
  process.exit(1);
}

console.log(`✅ هر ${scanned} هدر درخواست مرورگر در CORS افزونه مجاز است.`);
