#!/usr/bin/env node
// scripts/check-wp-hooks.mjs
// ---------------------------------------------------------------------------
// بررسی تطابق امضای کال‌بک‌های هوک وردپرس.
//
// ═══════════════════════════════════════════════════════════════════════════
// باگی که این ابزار جلویش را می‌گیرد
// ═══════════════════════════════════════════════════════════════════════════
// در نسخه‌ی ۱.۳.۰ افزونه این کد نوشته شد:
//
//     add_filter( 'pre_term_slug', 'cyh_force_latin_category_slug', 10, 3 );
//     function cyh_force_latin_category_slug( $slug, $term_id, $taxonomy ) {…}
//
// اما هسته‌ی وردپرس این فیلتر را با **دو** آرگومان صدا می‌زند:
//
//     $value = apply_filters( "pre_term_{$field}", $value, $taxonomy );
//
// در PHP 8، صدا زدن تابعی با سه پارامتر اجباری با دو آرگومان یعنی
// ArgumentCountError — که مهار نمی‌شود و کل سایت را سفید می‌کند.
// چون این فیلتر در مسیر بارگذاری پنل بود، سایت کاملاً از دسترس خارج شد.
//
// این نوع باگ در بازبینی چشمی دیده نمی‌شود و تنها در زمان اجرا خودش را
// نشان می‌دهد — یعنی روی سایت زنده.
//
// ═══════════════════════════════════════════════════════════════════════════
// دو قاعده‌ای که بررسی می‌شود
// ═══════════════════════════════════════════════════════════════════════════
// وردپرس به کال‌بک دقیقاً `min(accepted_args, تعداد آرگومان واقعی هوک)`
// آرگومان می‌دهد. پس:
//
//   قاعده‌ی ۱ (بدون نیاز به جدول):
//       پارامترهای اجباری  >  accepted_args   →  خطای قطعی
//
//   قاعده‌ی ۲ (با جدول هوک‌های هسته):
//       پارامترهای اجباری  >  آرگومان واقعی هوک  →  خطای قطعی
//
// راه‌حل پیشگیرانه‌ای که در خود افزونه اعمال شده: هر پارامتر کال‌بک هوک
// مقدار پیش‌فرض دارد. آن‌وقت حتی امضای اشتباه هم به‌جای سفید شدن سایت،
// فقط رفتار ناقص می‌دهد.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = resolve(ROOT, 'wordpress-plugin/crane-yadak-headless');

// ── تعداد آرگومان واقعی هوک‌های هسته‌ی وردپرس ────────────────────────────────
// فقط هوک‌هایی که این افزونه استفاده می‌کند. هوکِ ناشناخته صرفاً از قاعده‌ی ۱
// عبور می‌کند و هشدار «ناشناخته» می‌گیرد — سکوت نمی‌شود.
const HOOK_ARITY = {
  // ── ترم / تاکسونومی ──
  pre_term_slug: 2, // ← همان هوکی که سایت را خواباند
  pre_term_name: 2,
  pre_term_description: 2,
  wp_insert_term_data: 3,
  wp_update_term_data: 4,
  created_term: 4,
  edited_term: 4,
  saved_term: 4,
  delete_term: 5,
  term_name: 2,

  // ── پست ──
  save_post: 3,
  wp_insert_post_data: 4,
  wp_unique_post_slug: 6,
  register_post_type_args: 2,
  register_taxonomy_args: 3,
  add_meta_boxes: 2,

  // ── دیدگاه ──
  pre_comment_approved: 2,
  manage_comments_custom_column: 2,
  'manage_edit-comments_columns': 1,

  // ── پنل / عمومی ──
  init: 0,
  admin_init: 0,
  admin_menu: 0,
  parent_file: 1,
  submenu_file: 2,
  admin_notices: 0,
  admin_enqueue_scripts: 1,
  rest_api_init: 1,

  // ── ACF ──
  'acf/init': 0,
  'acf/save_post': 1,
  'acf/settings/load_json': 1,
  'acf/settings/save_json': 1,

  // ── WPGraphQL ──
  graphql_register_types: 1, // WPGraphQL آرگومان TypeRegistry را پاس می‌دهد
};

// هوک‌های پویا که با پیشوند شناخته می‌شوند.
const DYNAMIC = [
  [/^saved_/, 4],
  [/^delete_/, 5],
  [/^created_/, 4],
  [/^edited_/, 4],
  [/^admin_post_/, 0],
  [/^admin_post_nopriv_/, 0],
  [/^wp_ajax_/, 0],
  [/^manage_edit-.*_columns$/, 1],
];

function hookArity(name) {
  if (name in HOOK_ARITY) return HOOK_ARITY[name];
  for (const [re, n] of DYNAMIC) if (re.test(name)) return n;
  return null; // ناشناخته
}

// ── حذف کامنت و رشته تا تحلیل روی کد واقعی انجام شود ────────────────────────
// ⚠️ بدون این، بلوک توضیحی که خودِ باگ را شرح می‌دهد، به‌عنوان یک ثبت
// واقعی خوانده می‌شود و ابزار نتیجه‌ی دروغ می‌دهد. ابزار تشخیصی که
// نتیجه‌ی دروغ بدهد، از نبودِ ابزار بدتر است.
function stripNoise(src) {
  let out = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    const two = src.slice(i, i + 2);

    if (two === '/*') {
      const end = src.indexOf('*/', i + 2);
      const chunk = src.slice(i, end === -1 ? n : end + 2);
      out += chunk.replace(/[^\n]/g, ' ');
      i = end === -1 ? n : end + 2;
      continue;
    }

    if (two === '//' || src[i] === '#') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      out += ' '.repeat(stop - i);
      i = stop;
      continue;
    }

    if (src[i] === "'" || src[i] === '"') {
      const quote = src[i];
      let j = i + 1;
      while (j < n && src[j] !== quote) {
        if (src[j] === '\\') j++;
        j++;
      }
      // خودِ رشته را نگه می‌داریم چون نام هوک داخل آن است.
      out += src.slice(i, Math.min(j + 1, n));
      i = j + 1;
      continue;
    }

    out += src[i];
    i++;
  }

  return out;
}

// ── جمع‌آوری فایل‌ها ─────────────────────────────────────────────────────────
function phpFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) phpFiles(p, acc);
    else if (entry.endsWith('.php')) acc.push(p);
  }
  return acc;
}

const files = phpFiles(PLUGIN);

// ── امضای همه‌ی توابع ───────────────────────────────────────────────────────
const signatures = new Map(); // name -> {required, total, file, line}

for (const file of files) {
  const src = stripNoise(readFileSync(file, 'utf8'));
  const re = /\bfunction\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(src))) {
    const [, name, rawParams] = m;
    const params = rawParams
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const required = params.filter((p) => !p.includes('=') && !p.startsWith('...')).length;
    signatures.set(name, {
      required,
      total: params.length,
      file,
      line: src.slice(0, m.index).split('\n').length,
    });
  }
}

// ── همه‌ی ثبت‌های هوک ────────────────────────────────────────────────────────
const problems = [];
const unknown = [];
let checked = 0;

for (const file of files) {
  const src = stripNoise(readFileSync(file, 'utf8'));
  const re =
    /\badd_(action|filter)\s*\(\s*'([^']+)'\s*,\s*'([A-Za-z_]\w*)'\s*(?:,\s*(\d+)\s*(?:,\s*(\d+))?)?\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const [, , hook, callback, , acceptedRaw] = m;
    const explicit = acceptedRaw !== undefined;
    const accepted = explicit ? Number(acceptedRaw) : 1;
    const line = src.slice(0, m.index).split('\n').length;
    const rel = relative(ROOT, file);
    const sig = signatures.get(callback);

    if (!sig) continue; // تابع خارج از این افزونه تعریف شده
    checked++;

    // قاعده‌ی ۱ — بدون نیاز به جدول.
    if (sig.required > accepted) {
      problems.push(
        `${rel}:${line}\n` +
          `      هوک «${hook}» با accepted_args=${accepted} ثبت شده،\n` +
          `      اما ${callback}() تعداد ${sig.required} پارامتر *اجباری* دارد.\n` +
          `      → PHP 8: ArgumentCountError و سفید شدن سایت.\n` +
          `      اصلاح: accepted_args را ${sig.required} کنید یا به پارامترها مقدار پیش‌فرض بدهید.`
      );
      continue;
    }

    // قاعده‌ی ۲ — با جدول هسته.
    const arity = hookArity(hook);
    if (arity === null) {
      unknown.push(`${hook} (در ${rel}:${line})`);
      continue;
    }

    // ⚠️ کف ۱: `do_action('init')` بدون آرگومان اضافه، در عمل یک رشته‌ی
    // خالی پاس می‌دهد. پس کال‌بکی با یک پارامتر اجباری روی هوک صفرآرگومانی
    // کاملاً سالم است، و `accepted_args` پیش‌فرض وردپرس هم ۱ است.
    //
    // نسخه‌ی اول این ابزار این کف را نداشت و ۲۵ هشدار دروغ تولید کرد —
    // یعنی همان یک خطای واقعی بین ۲۵ نویز گم می‌شد. ابزار تشخیصی که
    // نتیجه‌ی دروغ بدهد، از نبودش بدتر است.
    const effective = Math.max(arity, 1);

    if (sig.required > effective) {
      problems.push(
        `${rel}:${line}\n` +
          `      هوک «${hook}» فقط ${arity} آرگومان می‌دهد،\n` +
          `      اما ${callback}() تعداد ${sig.required} پارامتر *اجباری* دارد.\n` +
          `      → PHP 8: ArgumentCountError و سفید شدن سایت.\n` +
          `      اصلاح: به پارامترهای اضافی مقدار پیش‌فرض بدهید، یا هوک درست را انتخاب کنید.`
      );
      continue;
    }

    // فقط وقتی accepted_args را *صریحاً* نوشته باشیم و از ظرفیت هوک بیشتر
    // باشد. مقدار پیش‌فرض ۱ هرگز اشتباه نیست.
    if (explicit && accepted > effective) {
      problems.push(
        `${rel}:${line}\n` +
          `      هوک «${hook}» فقط ${arity} آرگومان می‌دهد، ولی accepted_args=${accepted} ثبت شده.\n` +
          `      کشنده نیست، اما نشانه‌ی این است که امضا با هسته نمی‌خواند.\n` +
          `      اصلاح: accepted_args را حداکثر ${effective} بگذارید.`
      );
    }
  }
}

if (unknown.length) {
  console.warn(`⚠️  ${unknown.length} هوک ناشناخته (فقط قاعده‌ی ۱ بررسی شد):`);
  for (const u of [...new Set(unknown)]) console.warn(`     ${u}`);
  console.warn(`     برای بررسی کامل، تعداد آرگومان آن‌ها را به HOOK_ARITY اضافه کنید.\n`);
}

if (problems.length) {
  console.error(`\n❌ ${problems.length} امضای هوک اشتباه:\n`);
  for (const p of problems) console.error(`   • ${p}\n`);
  process.exit(1);
}

console.info(`✅ هر ${checked} کال‌بک هوک با امضای وردپرس می‌خواند.`);
