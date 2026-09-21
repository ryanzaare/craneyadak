#!/usr/bin/env node
// scripts/upload-media.mjs
// ---------------------------------------------------------------------------
// آپلود گروهی تصویر به کتابخانه‌ی رسانه‌ی وردپرس — تکرارناپذیر.
//
// ═══════════════════════════════════════════════════════════════════════════
// این اسکریپت عمداً کارِ کمی می‌کند
// ═══════════════════════════════════════════════════════════════════════════
// وسوسه این بود که اسکریپت «هوشمند» باشد و خودش تشخیص بدهد کدام تصویر
// کجا بنشیند. نمی‌تواند، و نباید تظاهر کند که می‌تواند: یک نقشه‌ی برش
// عرضی که قرار است وسط بخش «ساختار طناب» بیاید، از روی نام فایلش قابل
// تشخیص نیست. این را فقط کسی می‌داند که متن را می‌نویسد.
//
// پس مسئولیت‌ها جدا شدند:
//
//   این اسکریپت  → **حمل**. فایل را بالا می‌برد و یک «کلید» پایدار
//                   رویش می‌گذارد. تمام.
//   فایل JSON    → **جا**. نویسنده می‌نویسد `"key": "wire-rope-cutaway"`
//                   داخل همان بلوکی که باید آنجا دیده شود.
//
// تنها استثنا گالری محصول است، و استثنا نیست — فقط جایش از نام پیداست:
// فایلی که با `{کد فنی}-{شماره}` بخواند (`SAGA1-L12-1.jpg`) خودکار به
// گالری همان محصول می‌چسبد.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا اجرای دوباره خطرناک نیست
// ═══════════════════════════════════════════════════════════════════════════
// پیش از هر آپلود، SHA-256 فایل از سرور پرسیده می‌شود. اگر همان محتوا
// قبلاً آنجاست، آپلود نمی‌شود. این با نامِ فایل کار نمی‌کرد: تغییر نام،
// کپی با نام دیگر، و اجرای دوباره هر سه از دید نام یکسان نیستند ولی از
// دید محتوا یکی‌اند.
//
// و گالریِ پرشده هرگز بدون `--overwrite` دست نمی‌خورد. پیش‌فرض این
// اسکریپت، **گزارش بدون نوشتن** است (`--go` لازم است) — همان انضباطی که
// ابزار ورود محتوا دارد، و به همان دلیل: یک بار «حالت پیش‌فرض نوشتن بود»
// در این پروژه اتفاق افتاد و نباید دوباره بیفتد.
//
// ─── اجرا ───────────────────────────────────────────────────────────────
//   export WP_URL='https://admin.craneyadak.com'
//   export WP_USER='your-login'
//   export WP_APP_PASSWORD='xxxx xxxx xxxx xxxx xxxx xxxx'   # رمز برنامه
//
//   node scripts/upload-media.mjs ./images            # گزارش (بدون نوشتن)
//   node scripts/upload-media.mjs ./images --go       # اجرای واقعی
//   node scripts/upload-media.mjs ./images --go --overwrite   # گالری را هم بازنویسی کن
//
// ⚠️ «رمز برنامه» (Application Password) است، نه رمز ورود. در وردپرس:
//    کاربران ← پروفایل ← Application Passwords. این رمز فقط به REST
//    دسترسی می‌دهد و هر لحظه قابل ابطال است.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

/* ⚠️ اسلاگ‌ساز از `block-shape.ts` قرض گرفته می‌شود و اینجا دوباره نوشته
   **نمی‌شود**.

   نسخه‌ی اول این فایل کپی خودش را داشت و بلافاصله همان باگی را داشت که
   در لنگرها گرفته شده بود: نیم‌فاصله حذف می‌شد به‌جای اینکه خط تیره
   شود، پس `برش-سیم‌بکسل.png` کلیدِ `برش-سیمبکسل` می‌ساخت — دو کلمه‌ی
   چسبیده. همان تابع، همان اشتباه، دو بار.

   `block-shape.ts` عمداً هیچ وابستگی ندارد و importهایش پسوند می‌گیرند،
   دقیقاً برای همین حالت: قابل اجرا با node، بدون بارگذاری کل پروژه.
   به همین دلیل این اسکریپت با `--experimental-strip-types` اجرا می‌شود. */
import { slugifyAnchor } from '../src/lib/block-shape.ts';

const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg']);

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/* ⚠️ الگوی گالری: `{کد فنی}-{شماره}`. شماره **اجباری** است.
   بدون آن، هر فایلی که اتفاقاً نامش با یک کد فنی شروع شود به گالری
   می‌رفت — از جمله نقشه‌های فنی که نباید آنجا باشند. */
const GALLERY_RE = /^(?<sku>.+?)-(?<n>\d{1,2})$/;

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
const GO = args.includes('--go');
const OVERWRITE = args.includes('--overwrite');

const { WP_URL, WP_USER, WP_APP_PASSWORD } = process.env;

if (!dir) {
  console.error('استفاده: node scripts/upload-media.mjs <پوشه> [--go] [--overwrite]');
  process.exit(1);
}
if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
  console.error('❌ متغیرهای WP_URL، WP_USER و WP_APP_PASSWORD باید تنظیم شوند.');
  console.error('   رمز برنامه: وردپرس ← کاربران ← پروفایل ← Application Passwords');
  process.exit(1);
}

const base = WP_URL.replace(/\/+$/, '');
const auth = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

const api = async (route, init = {}) => {
  const res = await fetch(`${base}/wp-json${route}`, {
    ...init,
    headers: { Authorization: auth, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) {
    const msg = body?.message ?? String(body).slice(0, 200);
    throw new Error(`${res.status} ${route} → ${msg}`);
  }
  return body;
};

/** ریشه‌ی نام فایل → کلید پایدار. همان چیزی که در JSON نوشته می‌شود. */
const keyOf = (file) => slugifyAnchor(path.basename(file, path.extname(file)));

async function listImages(root) {
  const out = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...(await listImages(full)));
    else if (EXT.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

/** محصول را با کد فنی پیدا کن. یک بار همه را می‌گیرد، نه یکی‌یکی. */
async function loadProductsBySku() {
  const bySku = new Map();
  let page = 1;
  for (;;) {
    const batch = await api(`/wp/v2/product?per_page=100&page=${page}&status=any&_fields=id,title,meta`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const p of batch) {
      const sku = (p.meta?.sku ?? '').toString().trim().toLowerCase();
      if (sku) bySku.set(sku, p.id);
    }
    if (batch.length < 100) break;
    page++;
  }
  return bySku;
}

async function main() {
  const root = path.resolve(dir);
  if (!(await stat(root)).isDirectory()) throw new Error(`${root} پوشه نیست.`);

  const files = await listImages(root);
  if (files.length === 0) {
    console.log('هیچ تصویری در این پوشه نیست.');
    return;
  }

  console.log(`\n${files.length} تصویر پیدا شد در ${root}`);
  console.log(GO ? '⚙️  حالت نوشتن\n' : '👁  حالت گزارش — هیچ چیزی نوشته نمی‌شود (برای اجرا: --go)\n');

  let productsBySku = new Map();
  try {
    productsBySku = await loadProductsBySku();
    console.log(`${productsBySku.size} محصول با کد فنی خوانده شد.\n`);
  } catch (err) {
    console.warn(`⚠ فهرست محصولات خوانده نشد (${err.message}).`);
    console.warn('  تصاویر آپلود می‌شوند ولی هیچ‌کدام به گالری نمی‌چسبند.\n');
  }

  const stats = { uploaded: 0, existed: 0, gallery: 0, skipped: 0, failed: 0 };
  const galleryByProduct = new Map();
  const problems = [];

  for (const file of files) {
    const rel = path.relative(root, file);
    const key = keyOf(file);
    const buf = await readFile(file);
    const hash = createHash('sha256').update(buf).digest('hex');

    let id = 0;
    try {
      const hit = await api(`/crane-yadak/v1/media-lookup?hash=${hash}&key=${encodeURIComponent(key)}`);
      if (hit?.found) {
        id = hit.id;
        stats.existed++;
        console.log(`  ↺ ${rel}  →  از قبل هست (#${id})`);
      }
    } catch (err) {
      problems.push(`${rel}: جستجو شکست خورد — ${err.message}`);
      stats.failed++;
      continue;
    }

    if (!id) {
      if (!GO) {
        console.log(`  + ${rel}  →  آپلود می‌شود، کلید «${key}»`);
        stats.uploaded++;
      } else {
        try {
          const ext = path.extname(file).toLowerCase();
          const created = await api('/wp/v2/media', {
            method: 'POST',
            headers: {
              'Content-Type': MIME[ext] ?? 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${path.basename(file)}"`,
            },
            body: buf,
          });
          id = created.id;
          // کلید و اثرانگشت — همین دو، اجرای بعدی را بی‌خطر می‌کنند.
          await api(`/wp/v2/media/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meta: { _cyh_key: key, _cyh_hash: hash } }),
          });
          stats.uploaded++;
          console.log(`  ✓ ${rel}  →  #${id}، کلید «${key}»`);
        } catch (err) {
          problems.push(`${rel}: آپلود شکست خورد — ${err.message}`);
          stats.failed++;
          continue;
        }
      }
    }

    // ── آیا این فایل، تصویر گالری است؟ ──
    const m = GALLERY_RE.exec(key);
    if (!m) continue; // نقشه یا نمودار — فقط کلید می‌گیرد، جایش در JSON است

    const sku = m.groups.sku.toLowerCase();
    const pid = productsBySku.get(sku);
    if (!pid) {
      problems.push(`${rel}: نامش الگوی گالری دارد ولی محصولی با کد فنی «${sku}» نیست.`);
      continue;
    }

    const list = galleryByProduct.get(pid) ?? [];
    list.push({ order: Number(m.groups.n), id, rel });
    galleryByProduct.set(pid, list);
  }

  // ── گالری‌ها ──
  if (galleryByProduct.size > 0) {
    console.log(`\n${galleryByProduct.size} محصول تصویر گالری دارد:`);
    for (const [pid, list] of galleryByProduct) {
      list.sort((a, b) => a.order - b.order);
      const ids = list.map((x) => x.id).filter(Boolean);

      if (!GO) {
        console.log(`  محصول #${pid}  ←  ${ids.length} تصویر`);
        stats.gallery++;
        continue;
      }

      try {
        const current = await api(`/wp/v2/product/${pid}?_fields=acf`);
        const existing = current?.acf?.gallery;
        const hasGallery = Array.isArray(existing) && existing.length > 0;

        /* ⚠️ گالریِ پرشده بدون اجازه‌ی صریح دست نمی‌خورد. کارفرما ممکن
           است ترتیب را در پنل مرتب کرده باشد؛ بازنویسیِ خودکار آن کار
           را بی‌صدا دور می‌ریزد. */
        if (hasGallery && !OVERWRITE) {
          console.log(`  ⏭ محصول #${pid}  —  از قبل ${existing.length} تصویر دارد (برای بازنویسی: --overwrite)`);
          stats.skipped++;
          continue;
        }

        await api(`/wp/v2/product/${pid}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acf: { gallery: ids } }),
        });
        console.log(`  ✓ محصول #${pid}  ←  ${ids.length} تصویر`);
        stats.gallery++;
      } catch (err) {
        problems.push(`محصول #${pid}: نوشتن گالری شکست خورد — ${err.message}`);
        stats.failed++;
      }
    }
  }

  // ── گزارش ──
  console.log('\n' + '─'.repeat(58));
  console.log(`  آپلود شد        ${stats.uploaded}`);
  console.log(`  از قبل بود      ${stats.existed}`);
  console.log(`  گالری نوشته شد  ${stats.gallery}`);
  console.log(`  گالری رد شد     ${stats.skipped}`);
  console.log(`  ناموفق          ${stats.failed}`);

  if (problems.length) {
    console.log(`\n⚠ ${problems.length} مورد نیاز به توجه دارد:`);
    for (const p of problems) console.log(`   • ${p}`);
  }

  if (!GO) {
    console.log('\nهیچ چیزی نوشته نشد. برای اجرای واقعی `--go` اضافه کنید.');
  }

  // ناموفق‌ها باید خروجی غیرصفر بدهند تا در CI دیده شوند.
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
