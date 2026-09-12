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

/* ═══ ۰) نام تایپ گراف‌کیوال هر گروه ACF ════════════════════════════════
   ⚠️ این بررسی بعد از یک شکست کامل و بی‌صدا اضافه شد.

   `group_cyh_content_blocks.json` می‌گفت این گروه روی تایپ **`Brand`**
   ظاهر شود. چنین تایپی در اسکیما وجود ندارد؛ نامش `CraneBrand` است، چون
   `class-post-types.php` می‌گوید `graphql_single_name => 'craneBrand'`.

   نتیجه: WPGraphQL خطای «Cannot query field contentBlocks on type
   CraneBrand» می‌داد، `getBlocks()` آن را می‌بلعید، و هر صفحه‌ی برند و
   دسته **بدون محتوای اصلی‌اش** build می‌شد — در حالی که همین بررسی
   معماری «✅ سالم» چاپ می‌کرد، چون فقط نوع بلوک‌ها را می‌سنجید و نه
   اینکه گروه اصلاً به موجودیتی وصل هست یا نه.

   یک حرف اضافه در یک فایل JSON، کل مدل محتوا را قطع کرد و هیچ‌چیز
   نگفت. پس نام تایپ‌ها دیگر دستی تأیید نمی‌شود: از خود ثبت CPT
   استخراج و مقایسه می‌شود.
   ═══════════════════════════════════════════════════════════════════ */

// نگاشت «نام post type / taxonomy» → «تایپ گراف‌کیوال» از روی ثبت واقعی.
const gqlNames = new Map();
for (const f of PHP) {
  const src = read(f);
  // register_post_type( 'brand', [ ... 'graphql_single_name' => 'craneBrand' ... ] )
  const re = /register_(?:post_type|taxonomy)\(\s*'([a-z0-9_-]+)'([\s\S]{0,2500}?)\n\s*\);/g;
  for (const m of src.matchAll(re)) {
    const single = /'graphql_single_name'\s*=>\s*'([^']+)'/.exec(m[2]);
    if (single) gqlNames.set(m[1], single[1][0].toUpperCase() + single[1].slice(1));
  }
}

for (const f of globSync(`${ACF_DIR}/*.json`)) {
  let g;
  try { g = JSON.parse(read(f)); } catch { continue; }
  const name = path.basename(f);
  const declared = g.graphql_types ?? [];

  // تایپ‌هایی که *باید* باشند، از روی قواعد مکان گروه.
  const expected = new Set();
  let unknown = false;
  for (const group of g.location ?? []) {
    for (const rule of group) {
      if (!['post_type', 'taxonomy'].includes(rule.param)) { unknown = true; continue; }
      const t = gqlNames.get(rule.value);
      if (t) expected.add(t);
      else unknown = true; // مثل user_form یا options_page — قابل استخراج نیست
    }
  }
  if (!expected.size) continue;

  for (const t of expected) {
    if (!declared.includes(t)) {
      problems.push(
        `${name}: قواعد مکان به «${t}» اشاره می‌کنند ولی graphql_types آن را ندارد ` +
          `(${JSON.stringify(declared)}). این گروه روی آن موجودیت در گراف‌کیوال دیده نمی‌شود.`,
      );
    }
  }
  if (!unknown) {
    for (const t of declared) {
      if (!expected.has(t)) {
        problems.push(
          `${name}: graphql_types تایپ «${t}» را اعلام کرده که هیچ قاعده‌ی مکانی به آن نمی‌رسد. ` +
            `تایپ‌های معتبر: ${[...expected].join('، ')}.`,
        );
      }
    }
  }
  if (g.show_in_graphql !== 1 && g.show_in_graphql !== true) {
    problems.push(`${name}: show_in_graphql خاموش است — فرانت‌اند هرگز این فیلدها را نمی‌بیند.`);
  }
}

/* ═══ ۰ب) هر گروه ACF باید مُهر زمانی داشته باشد ════════════════════════
   ⚠️ باگی که پیدا کردنش یک روز طول کشید و علتش *نبودِ* یک کلید بود.

   ACF با کلید `modified` تصمیم می‌گیرد فایل JSON از نسخه‌ی پایگاه داده
   تازه‌تر است یا نه. `group_cyh_content_blocks.json` این کلید را **اصلاً
   نداشت**، پس ACF آن را قدیمی‌تر از هر چیزی فرض می‌کرد و هرگز
   «Sync available» نشان نمی‌داد.

   نتیجه: می‌شد فایل را در مخزن اصلاح کرد، افزونه را نسخه بزنیم، کارفرما
   نصبش کند — و **هیچ اتفاقی نیفتد**. اصلاح واقعی بود، انتشارش ممکن نبود،
   و هیچ‌جا خطایی نمی‌داد. یک به‌روزرسانی که بی‌صدا هیچ‌کاری نمی‌کند از یک
   به‌روزرسانی شکست‌خورده بدتر است.
   ═══════════════════════════════════════════════════════════════════ */
for (const f of globSync(`${ACF_DIR}/*.json`)) {
  let g;
  try { g = JSON.parse(read(f)); } catch { continue; }
  if (!Number.isInteger(g.modified) || g.modified <= 0) {
    problems.push(
      `${path.basename(f)}: کلید «modified» ندارد. بدون آن ACF هرگز Sync پیشنهاد نمی‌دهد ` +
        `و هر اصلاحی در این فایل بی‌صدا نادیده گرفته می‌شود.`,
    );
  }
}

/* ═══ ۰ج) کوئری گراف‌کیوال در برابر ساختار واقعی ACF ════════════════════
   ⚠️ سومین شکست پشت سر هم از یک خانواده، و هر سه بار بررسی‌ها سبز بودند.

     ۱. `graphql_types` می‌گفت «Brand»، تایپ واقعی «CraneBrand» بود.
     ۲. فایل JSON کلید `modified` نداشت، پس اصلاح هرگز منتشر نمی‌شد.
     ۳. کوئری تک‌سطحی نوشته شده بود، ولی گروه `contentBlocks` فیلدهایش
        یک سطح پایین‌تر، داخل ریپیتر `content_blocks` است.

   هر سه‌تا **آفلاین و بدون وردپرس** قابل تشخیص بودند، چون ساختار واقعی
   همین‌جا در `acf-json/` است. تنها دلیلی که تا build پنهان ماندند این بود
   که هیچ‌کس این دو را با هم مقایسه نمی‌کرد.

   این بخش درخت انتخاب کوئری را از `content-blocks.ts` می‌خواند، درخت
   واقعی فیلدها را از JSON می‌سازد، و هر نامی را که در کوئری هست و در ACF
   نیست گزارش می‌دهد — با مسیر کامل.

   ⚠️ فقط داخل *ریپیتر*ها پایین می‌رود. `asset` و `category` فیلدهای برگ
   ACF‌اند و انتخاب داخلشان مال WPGraphQL است نه ACF؛ پایین رفتن در آن‌ها
   مثبت کاذب می‌داد.
   ═══════════════════════════════════════════════════════════════════ */
{
  const camel = (n) => n.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

  const acfTree = (fields) => {
    const out = {};
    for (const f of fields ?? []) {
      const name = f.graphql_field_name || camel(f.name ?? '');
      if (!name) continue;
      out[name] = Array.isArray(f.sub_fields) && f.sub_fields.length ? acfTree(f.sub_fields) : null;
    }
    return out;
  };

  const parseSelection = (src) => {
    const tokens = src.match(/\{|\}|\.\.\.|[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
    let i = 0;
    const body = () => {
      const node = {};
      while (i < tokens.length) {
        const t = tokens[i];
        if (t === '}') { i++; return node; }
        if (t === '...') {
          i++;
          if (tokens[i] === 'on') i++;
          if (tokens[i]) i++;
          if (tokens[i] === '{') { i++; Object.assign(node, body()); }
          continue;
        }
        i++;
        if (tokens[i] === '{') { i++; node[t] = body(); } else { node[t] = null; }
      }
      return node;
    };
    return body();
  };

  const blocksFile = read('src/lib/content-blocks.ts');
  const groupFile = globSync(`${ACF_DIR}/group_cyh_content_blocks.json`)[0];

  if (blocksFile && groupFile) {
    let group = null;
    try { group = JSON.parse(read(groupFile)); } catch { /* گزارش‌شده در بخش دیگر */ }

    if (group?.fields) {
      const expected = { [group.graphql_field_name || 'contentBlocks']: acfTree(group.fields) };

      const walk = (q, e, where) => {
        for (const [k, v] of Object.entries(q)) {
          if (!(k in e)) {
            problems.push(`content-blocks.ts: کوئری «${where}${k}» را می‌خواهد ولی چنین فیلدی در ACF نیست.`);
            continue;
          }
          if (v && e[k]) walk(v, e[k], `${where}${k}.`);
        }
      };

      for (const name of ['BLOCK_FIELDS', 'BLOCK_FIELDS_SAFE']) {
        const m = new RegExp(`${name}\\s*=\\s*\`([\\s\\S]*?)\``).exec(blocksFile);
        if (!m) { problems.push(`content-blocks.ts: ${name} پیدا نشد.`); continue; }
        walk(parseSelection(m[1]), expected, `${name} → `);
      }
    }
  }
}

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
