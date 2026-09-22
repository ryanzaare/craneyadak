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

  /* ⚠️ این بررسی اول فقط `content-blocks.ts` را می‌دید و همان‌جا بود که
     محدود بودنش آسیب زد: `site-options.ts` فیلدی به نام `dayOfWeek`
     می‌خواست که در ACF `days` نام دارد. کوئری با خطا می‌افتاد، واکشی در
     سکوت تنزل می‌کرد، و **ساعت کاری هرگز وارد JSON-LD نشد**.

     حالا هر گروه ACF و هر کوئری در `src/lib` بررسی می‌شود. */
  const groups = new Map();
  for (const gf of globSync(`${ACF_DIR}/*.json`)) {
    let g = null;
    try { g = JSON.parse(read(gf)); } catch { continue; }
    if (g?.fields && g.graphql_field_name) {
      groups.set(g.graphql_field_name, acfTree(g.fields));
    }
  }

  const walk = (q, e, file, where) => {
    for (const [k, v] of Object.entries(q)) {
      if (!(k in e)) {
        problems.push(`${file}: کوئری «${where}${k}» را می‌خواهد ولی چنین فیلدی در ACF نیست.`);
        continue;
      }
      if (v && e[k]) walk(v, e[k], file, `${where}${k}.`);
    }
  };

  /* ⚠️ نسخه‌ی اول این بررسی `${FRAGMENT}` را **حذف** می‌کرد، و همان باعث شد
     دو باگ واقعی را نگیرد: قطعه‌های کوئری در این پروژه در ثابت‌های جدا
     نوشته می‌شوند (`CORE_BRAND_FIELDS`، `OPTION_FIELDS`) و اسم فیلدها آنجا
     زندگی می‌کنند، نه داخل بلوک گروه. حذف‌کردنشان یعنی نخواندنِ همان جایی
     که باگ در آن بود.

     پس به‌جای حذف، **باز** می‌شوند. */
  const expand = (text, consts, depth = 0) =>
    depth > 6
      ? text
      : text.replace(/\$\{\s*(\w+)\s*\}/g, (whole, name) =>
          consts.has(name) ? expand(consts.get(name), consts, depth + 1) : ' ',
        );

  for (const file of globSync('src/lib/*.ts')) {
    const src = read(file);

    // ثابت‌های قطعه‌ی کوئری در همین فایل
    const consts = new Map();
    for (const c of src.matchAll(/const\s+(\w+)\s*=\s*`([\s\S]*?)`/g)) {
      consts.set(c[1], c[2]);
    }
    const short = path.basename(file);
    const done = []; // بازه‌های پردازش‌شده — برای رد کردن تودرتوها

    for (const [groupName, tree] of groups) {
      const re = new RegExp(`\\b${groupName}\\s*\\{`, 'g');
      for (const m of src.matchAll(re)) {
        // ⚠️ `contentBlocks` هم نام گروه است هم نام ریپیتر داخلش. بدون این،
        //    نسخه‌ی درونی هم «ریشه» حساب می‌شد و همه‌ی فیلدهایش غایب اعلام
        //    می‌شدند — ۳۶ خطای کاذب روی کدی که کاملاً درست است.
        if (done.some(([a, b]) => m.index > a && m.index < b)) continue;

        let depth = 0;
        let i = m.index + m[0].length - 1;
        const start = i;
        for (; i < src.length; i++) {
          if (src[i] === '{') depth++;
          else if (src[i] === '}') { depth--; if (depth === 0) break; }
        }
        if (depth !== 0) continue;
        done.push([start, i]);

        // ⚠️ درون‌یابی قالب (`${CORE_BRAND_FIELDS}`) در زمان بررسی مقدارش
        //    معلوم نیست. حذفش می‌شود تا بقیه‌ی انتخاب — که *ادبی* است و
        //    دقیقاً همان‌جایی که باگ `dayOfWeek` بود — بررسی شود.
        const body = expand(src.slice(start + 1, i), consts);
        if (/[=;()]/.test(body.replace(/\.\.\.\s*on\s+\w+/g, ''))) continue;

        walk(parseSelection(body), tree, short, `${groupName}.`);
      }
    }
  }

}

/* ═══ ۰د) دکمه‌ی مرده: لینکی به admin-post بدون هندلر ═══════════════════
   ⚠️ دو صفحه‌ی پنل («اصلاح آدرس‌ها» و «ساختار دسته‌بندی») ماه‌ها دکمه‌ای
   نشان می‌دادند که به `admin-post.php?action=…` اشاره می‌کرد، در حالی که
   هیچ `add_action( 'admin_post_…' )` برایشان وجود نداشت. کلیک روی آن‌ها
   هیچ کاری نمی‌کرد و هیچ خطایی هم نمی‌داد.

   بررسی قبلی «دکمه‌های پنل» فقط هندلرهای *ثبت‌شده* را می‌شمرد، پس دکمه‌ای
   که هندلر نداشت اصلاً دیده نمی‌شد — یعنی دقیقاً همان چیزی که باید پیدا
   می‌کرد، از چشمش پنهان بود. حالا از سمت **UI** نگاه می‌کند.
   ═══════════════════════════════════════════════════════════════════ */
{
  const handlers = new Set();
  const linked = new Map();

  // ⚠️ کامنت‌ها خنثی می‌شوند. کامنتی که توضیح می‌دهد چرا یک دکمه **حذف شد**
  //    مطلوب است و نباید خودش به‌عنوان «دکمه‌ی مرده» گزارش شود — اولین
  //    اجرای این بررسی دقیقاً همین را گزارش کرد.
  const bare = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

  for (const f of PHP) {
    const src = bare(read(f));
    for (const m of src.matchAll(/add_action\(\s*'admin_post_(\w+)'/g)) handlers.add(m[1]);
    for (const m of src.matchAll(/admin-post\.php\?action=(\w+)/g)) {
      if (!linked.has(m[1])) linked.set(m[1], path.basename(f));
    }
  }

  for (const [action, file] of linked) {
    if (!handlers.has(action)) {
      problems.push(
        `${file}: دکمه‌ای به «admin-post.php?action=${action}» لینک می‌دهد ولی ` +
          `هیچ add_action('admin_post_${action}') ثبت نشده — کلیک روی آن بی‌صدا هیچ کاری نمی‌کند.`,
      );
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
   از شش دکمه به یکی رسیدیم. هر ابزار مهاجرت تاریخ انقضا دارد و در همان
   کامیتی که اجرایش تأیید می‌شود حذف می‌شود. */
const ALLOWED_HANDLERS = {
  cyh_hub_import: 'ورود انبوه محتوا از فایل',
};

/* ⚠️ کامنت‌ها خنثی می‌شوند. کامنتی که توضیح می‌دهد چرا دکمه‌ای **حذف شد**
   نام آن دکمه را می‌برد؛ بدون این، همان توضیح به‌عنوان «دکمه‌ی غیرمجاز»
   گزارش می‌شد و نویسنده را وادار می‌کرد توضیح را پاک کند — یعنی ابزار،
   حافظه‌ی پروژه را از بین می‌برد. */
const phpBare = phpBlob
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1');

const handlers = [...new Set([...phpBare.matchAll(/admin_post_([a-z_]+)/g)].map((m) => m[1]))];
for (const h of handlers) {
  if (!ALLOWED_HANDLERS[h]) {
    problems.push(`دکمه‌ی پنل «${h}» در فهرست مجاز نیست. هر دکمه‌ی تازه یا موقتی است و باید برود، یا آگاهانه ثبت شود.`);
  }
}

/* ═══ ۴) پالت و رندرکننده نباید واگرا شوند ═════════════════════════════
   مهم‌ترین بررسی این فایل.

   سه جا نوع بلوک را تعریف می‌کنند و هر سه باید یکی باشند:
     • choices در ACF        → مدیر چه چیزی می‌تواند بسازد
     • TYPES در block-shape.ts  → چه چیزی خوانده می‌شود
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

// ⚠️ TYPES به block-shape.ts منتقل شد (تبدیل خالص، بدون وابستگی، قابل آزمون).
const libSrc = read('src/lib/block-shape.ts');
const libTypes = (/const TYPES: BlockType\[\] = \[([^\]]*)\]/.exec(libSrc)?.[1] ?? '')
  .split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);

const astroSrc = read('src/components/ContentBlocks.astro');
const renderedTypes = [...new Set([...astroSrc.matchAll(/b\.type === '([a-z]+)'/g)].map((m) => m[1]))];

const cmp = (a, b, an, bn) => {
  for (const x of a) if (!b.includes(x)) problems.push(`نوع بلوک «${x}» در ${an} هست ولی در ${bn} نیست.`);
};
if (acfTypes.length && libTypes.length && renderedTypes.length) {
  cmp(acfTypes, libTypes, 'ACF', 'block-shape.ts');
  cmp(libTypes, acfTypes, 'block-shape.ts', 'ACF');
  cmp(acfTypes, renderedTypes, 'ACF', 'ContentBlocks.astro');
  cmp(renderedTypes, acfTypes, 'ContentBlocks.astro', 'ACF');
} else {
  problems.push('استخراج انواع بلوک شکست خورد — این بررسی بی‌اعتبار است تا رفع شود.');
}

/* ═══ ۷) اتصال CPT ↔ تاکسونومی ═════════════════════════════════════════
   ⚠️ این بررسی بعد از یک شکست کامل و بی‌صدا اضافه شد — و نبودش تنها
   دلیلی بود که آن باگ به دست کارفرما رسید.

   کوئری فرانت‌اند `craneCategories` را روی `CraneQuestion` می‌خواست.
   CPT ثبت شده بود، تاکسونومی هم، ولی CPT در فهرست `object_type` آن
   تاکسونومی نبود — چون `register_taxonomy_for_object_type()` روی
   اولویت ۵ صدا زده می‌شد و خود تاکسونومی روی اولویت ۱۰ ساخته می‌شد.
   آن تابع در این حالت فقط `false` برمی‌گرداند. نه خطا، نه هشدار.

   نتیجه: `Cannot query field "craneCategories" on type "CraneQuestion"`
   و کل بخش پرسش‌وپاسخ خاموش. هیچ‌کدام از شش بررسی قبلی این را نگرفتند:
   بررسی ۰ نام تایپ‌ها را می‌سنجید و بررسی ۳ فیلدهای ACF را — ولی اتصال
   تاکسونومی هیچ‌کدام نبود.

   ⚠️ نکته‌ی مهم: «نردبان کوئری» هم اینجا بی‌فایده بود، چون هر دو پله
   همان فیلد شکسته را می‌خواستند. نردبان فقط از افتِ *فیلدهای تازه*
   محافظت می‌کند، نه از اتصالِ نداشته.
   ═══════════════════════════════════════════════════════════════════ */

/* ⚠️ ثابت‌های PHP اول جمع می‌شوند.

   نسخه‌ی اول این بررسی فقط `register_post_type( 'literal', … )` را
   می‌شناخت. ولی CPT پرسش با یک **ثابت** ثبت می‌شود:

       register_post_type( CYH_QUESTION_CPT, [ … ] )

   نتیجه: بررسی نسبت به دقیقاً همان CPTای که برای محافظت از آن نوشته
   شده بود کور بود و «سالم» چاپ می‌کرد. سومین بار در این پروژه که یک
   ابزارِ سبز، چیزی را نمی‌دید. قاعده‌ی ۶ برای همین است — ابزار باید روی
   ورودیِ خرابِ شناخته‌شده آزموده شود، نه فقط روی سالم. */
const phpConst = new Map();
for (const f of PHP) {
  for (const m of read(f).matchAll(/^\s*const\s+([A-Z_][A-Z0-9_]*)\s*=\s*'([^']+)'\s*;/gm)) {
    phpConst.set(m[1], m[2]);
  }
}

/** آرگومان اول: یا رشته‌ی نقل‌قولی، یا ثابتی که بالا جمع شد. */
const resolveName = (token) => {
  const t = token.trim();
  const lit = /^'([^']+)'$/.exec(t);
  if (lit) return lit[1];
  return phpConst.get(t) ?? null;
};

/* ⚠️ الگوی آرگومان عمداً تنگ است: `'literal'` یا `CONSTANT`، نه «هر چیزی
   تا نخستین کاما». نسخه‌ی قبلی از `[^,]+?` استفاده می‌کرد و یک بلوک
   کامنت چهل‌خطی را بلعید. و `(?<!un)` لازم است چون
   `unregister_post_type()` هم در این مخزن وجود دارد. */
const ARG = "\\s*('[^']+'|[A-Z_][A-Z0-9_]*)\\s*";

// تاکسونومی → { objectTypes, gqlPlural }
const taxonomies = new Map();
// post type → gqlPlural  (برای یافتن ریشه‌ی کوئری)
const cptPlural = new Map();
const unresolved = [];

for (const f of PHP) {
  const src = read(f);

  // register_taxonomy( 'crane_category', [ 'product', CYH_QUESTION_CPT ], [ … ] )
  const taxRe = new RegExp(`(?<!un)register_taxonomy\\(${ARG},\\s*\\[([^\\]]*)\\]([\\s\\S]{0,2500}?)\\n\\s*\\);`, 'g');
  for (const m of src.matchAll(taxRe)) {
    const name = resolveName(m[1]);
    if (!name) { unresolved.push(`register_taxonomy(${m[1].trim()}) در ${path.basename(f)}`); continue; }
    const plural = /'graphql_plural_name'\s*=>\s*'([^']+)'/.exec(m[3]);
    taxonomies.set(name, {
      objectTypes: [...m[2].matchAll(/'([a-z0-9_-]+)'|([A-Z_][A-Z0-9_]*)/g)]
        .map((x) => (x[1] ? x[1] : phpConst.get(x[2])))
        .filter(Boolean),
      gqlPlural: plural ? plural[1] : null,
    });
  }

  const cptRe = new RegExp(`(?<!un)register_post_type\\(${ARG},([\\s\\S]{0,2500}?)\\n\\s*\\);`, 'g');
  for (const m of src.matchAll(cptRe)) {
    const name = resolveName(m[1]);
    if (!name) { unresolved.push(`register_post_type(${m[1].trim()}) در ${path.basename(f)}`); continue; }
    const plural = /'graphql_plural_name'\s*=>\s*'([^']+)'/.exec(m[2]);
    if (plural) cptPlural.set(plural[1], name);
  }
}

/* نامی که resolve نشد یعنی این بررسی نسبت به آن موجودیت کور است.
   سکوت در این حالت، همان «سبزِ کور» است. */
for (const u of unresolved) {
  problems.push(`نام موجودیت در ${u} قابل استخراج نبود — بررسی ۷ نسبت به آن کور می‌ماند.`);
}

if (taxonomies.size === 0 || cptPlural.size === 0) {
  problems.push('استخراج CPT/تاکسونومی شکست خورد — بررسی ۷ بی‌اعتبار است.');
} else {
  // تاکسونومی‌هایی که نام جمع گراف‌کیوال دارند، بر اساس همان نام.
  const taxByGql = new Map();
  for (const [name, t] of taxonomies) if (t.gqlPlural) taxByGql.set(t.gqlPlural, name);

  for (const file of globSync('src/lib/*.ts')) {
    const raw = read(file);

    /* ⚠️ قطعه‌های `${CONST}` باید *باز* شوند وگرنه این بررسی کور است.
       نسخه‌ی اول همین‌جا شکست: `craneCategories` داخل ثابت `CORE`
       زندگی می‌کند و کوئری فقط `nodes { ${CORE} … }` دارد. بررسی
       باگِ واقعی را ندید و سبز گزارش داد — یعنی خودش همان «ابزاری که
       سبز است ولی کور است» شد که قاعده‌ی ۶ درباره‌اش هشدار می‌دهد.
       (بررسی ۳ از قبل همین کار را می‌کرد؛ اینجا تکرارش لازم بود.) */
    const consts = new Map();
    for (const m of raw.matchAll(/const\s+(\w+)\s*=\s*`([\s\S]*?)`/g)) {
      consts.set(m[1], m[2]);
    }
    let src = raw;
    for (let pass = 0; pass < 3; pass++) {
      const next = src.replace(/\$\{(\w+)\}/g, (whole, name) =>
        consts.has(name) ? consts.get(name) : whole,
      );
      if (next === src) break;
      src = next;
    }

    for (const [rootPlural, postType] of cptPlural) {
      const start = src.indexOf(`${rootPlural}(`);
      if (start < 0) continue;

      /* ⚠️ اول باید از *آرگومان‌ها* رد شد، بعد دنبال بلوک انتخاب گشت.
         نسخه‌ی قبلی مستقیم نخستین `{` بعد از نام ریشه را می‌گرفت — و آن
         `{` مالِ آرگومان است، نه بدنه:

             craneQuestions(first: $first, where: { status: PUBLISH }) {
                                                 ↑ این گرفته می‌شد

         پس «بدنه» فقط خودِ آرگومان می‌شد، `craneCategories` هرگز داخلش
         نبود، و بررسی روی باگِ واقعی سبز می‌ماند. چهارمین تکرارِ همین
         درس در این پروژه: ابزاری که فقط روی ورودی سالم آزموده شود،
         کور بودنش را نشان نمی‌دهد. */
      let p = src.indexOf('(', start);
      let depth = 0, i = p;
      for (; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') { depth--; if (depth === 0) break; }
      }
      const afterArgs = i;

      const braceStart = src.indexOf('{', afterArgs);
      if (braceStart < 0) continue;

      depth = 0;
      let end = -1;
      for (i = braceStart; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end < 0) continue;
      const body = src.slice(braceStart, end);

      for (const [taxGql, taxName] of taxByGql) {
        // فیلد اتصال، نه رشته‌ی تصادفی: باید با `{` دنبال شود.
        if (!new RegExp(`\\b${taxGql}\\s*(\\(|\\{)`).test(body)) continue;

        const tax = taxonomies.get(taxName);
        if (!tax.objectTypes.includes(postType)) {
          problems.push(
            `${path.basename(file)}: کوئری «${taxGql}» را روی «${rootPlural}» می‌خواهد، ` +
              `ولی post type «${postType}» در آرایه‌ی object_type تاکسونومی «${taxName}» نیست. ` +
              'این دقیقاً همان خطای «Cannot query field … on type …» را در build می‌دهد.',
          );
        }
      }
    }
  }
}

/* ═══ ۵) سند معماری باید وجود داشته باشد ══════════════════════════════ */
if (!existsSync('docs/architecture.md')) {
  problems.push('docs/architecture.md وجود ندارد — قرارداد معماری گم شده است.');
}

/* ═══ ۶) واگرایی ریدایرکت‌ها ═══════════════════════════════════════════
   دو فهرست از یک واقعیت وجود دارد و هر دو دستی نوشته می‌شوند:

     • `astro.config.mjs` → صفحه‌ی meta-refresh در خروجی استاتیک
     • `public/_redirects` → ۳۰۱ واقعیِ سمت سرور

   هیچ‌کدام دیگری را تولید نمی‌کند (کامنت داخل astro.config یک زمان ادعا
   می‌کرد «تولید شده» — نمی‌شد، و همان ادعا اصلاح شد). پس افزودن یک قاعده
   به یکی و فراموش‌کردن دیگری، دقیقاً همان «شکست بی‌صدا»یی است که این
   پروژه بارها خورده — با این تفاوت که قربانی‌اش ارزش لینک آدرس‌های
   منتشرشده است و هیچ‌جا خطایی چاپ نمی‌شود.

   ⚠️ قواعد وایلدکارت (`/industries/*`) فقط در `_redirects` معنا دارند؛
   خروجی استاتیک نمی‌تواند برای الگو صفحه بسازد. پس «اضافه‌بودن» آن‌ها
   نقض نیست، ولی مقصدشان باید با قاعده‌ی پایه بخواند.
   ═══════════════════════════════════════════════════════════════════ */
const REDIRECTS_FILE = 'public/_redirects';
const astroConfig = read('astro.config.mjs');
const redirectsTxt = read(REDIRECTS_FILE);

if (!astroConfig || !redirectsTxt) {
  problems.push(`${!astroConfig ? 'astro.config.mjs' : REDIRECTS_FILE} خوانده نشد — بررسی ریدایرکت بی‌اعتبار است.`);
} else {
  // ── astro.config.mjs ──
  // ⚠️ نام ثابت `legacyCategoryRedirects` است — الگوی حساس‌به‌حروفِ
  // `redirects =` آن را نمی‌گرفت. `const` هم لازم است تا سطرِ ارجاعِ
  // داخل defineConfig (`redirects: legacy…`) به‌اشتباه گرفته نشود.
  const objMatch = /const\s+\w*[Rr]edirects\w*\s*=\s*\{([\s\S]*?)\n\};/.exec(astroConfig);
  const fromConfig = new Map();
  if (!objMatch) {
    problems.push('شیء ریدایرکت در astro.config.mjs پیدا نشد — الگوی استخراج شکسته است.');
  } else {
    // کامنت‌ها اول حذف می‌شوند تا نقل‌قول داخلشان به‌اشتباه قاعده خوانده نشود.
    const body = objMatch[1].replace(/\/\/[^\n]*/g, '');
    for (const m of body.matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) {
      fromConfig.set(m[1].replace(/\/$/, ''), m[2].replace(/\/$/, ''));
    }
  }

  // ── public/_redirects ──
  const fromFile = new Map();
  const wildcards = new Map();
  for (const line of redirectsTxt.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [from, to] = t.split(/\s+/);
    if (!from || !to) continue;
    const key = from.replace(/\/$/, '');
    (key.includes('*') ? wildcards : fromFile).set(key, to.replace(/\/$/, ''));
  }

  if (fromConfig.size === 0 || fromFile.size === 0) {
    problems.push('یکی از دو فهرست ریدایرکت خالی خوانده شد — بررسی بی‌اعتبار است.');
  } else {
    for (const [from, to] of fromConfig) {
      if (!fromFile.has(from)) {
        problems.push(`ریدایرکت «${from}» در astro.config.mjs هست ولی در ${REDIRECTS_FILE} نیست (۳۰۱ واقعی ندارد).`);
      } else if (fromFile.get(from) !== to) {
        problems.push(`ریدایرکت «${from}» در دو فایل به دو مقصد می‌رود: «${to}» در astro.config، «${fromFile.get(from)}» در ${REDIRECTS_FILE}.`);
      }
    }
    for (const from of fromFile.keys()) {
      if (!fromConfig.has(from)) {
        problems.push(`ریدایرکت «${from}» در ${REDIRECTS_FILE} هست ولی در astro.config.mjs نیست (روی هاست بدون پشتیبانی ۳۰۱، ۴۰۴ می‌دهد).`);
      }
    }
    // قاعده‌ی وایلدکارت باید مقصدش با قاعده‌ی پایه‌ی خودش یکی باشد.
    for (const [pattern, to] of wildcards) {
      const base = pattern.replace(/\/?\*+$/, '');
      if (fromFile.has(base) && fromFile.get(base) !== to) {
        problems.push(`وایلدکارت «${pattern}» به «${to}» می‌رود ولی قاعده‌ی پایه‌اش «${base}» به «${fromFile.get(base)}».`);
      }
    }
  }
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
