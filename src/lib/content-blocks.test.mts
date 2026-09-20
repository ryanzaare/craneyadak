// src/lib/content-blocks.test.mts
// ---------------------------------------------------------------------------
// آزمون نرمال‌سازی بلوک‌ها، روی **شکل واقعی پاسخ WPGraphQL**.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا این فایل وجود دارد
// ═══════════════════════════════════════════════════════════════════════════
// صفحه‌ی دماگ ۷ بلوک داشت و فقط ۳ تا رندر شد. build سبز بود، هیچ خطایی
// نبود، و داده در وردپرس کامل و درست بود.
//
// علت: فیلد `select` در ACF حتی با `multiple = 0` از WPGraphQL به شکل
// **آرایه** برمی‌گردد — `"blockType": ["table"]` و نه `"table"`. تابع
// `str()` برای آرایه رشته‌ی خالی می‌داد، پس نوع هر بلوک به `text` تنزل
// می‌کرد، و بعد فیلتر «بلوک خالی» جدول و قطعات و پرسش‌ها را دور می‌ریخت
// چون بدنه‌ی متنی نداشتند.
//
// یک جفت براکت، چهار بخش از مهم‌ترین صفحه‌ی سایت را نامرئی کرد.
//
// فیکسچر پایین **کپی دقیق** پاسخ واقعی گراف‌کیوال است، نه چیزی که فکر
// می‌کنم پاسخ باید باشد. تفاوت همین دو، تمام این ماجرا بود.
//
// اجرا:  npm run test:blocks
// ---------------------------------------------------------------------------

import { normalizeBlocks, hasContent, deriveNavLabel, NAV_LABEL_MAX } from './block-shape.ts';

let failed = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed++;
};

// ── شکل واقعی پاسخ برای demag (کوتاه‌شده، ساختار دست‌نخورده) ──────────────
const REAL = [
  { blockType: ['text'], heading: 'معرفی', body: '<p>دماگ…</p>', col1: null, col2: null, rows: null, faqs: null, parts: null },
  {
    blockType: ['table'],
    heading: 'سری‌های محصول',
    body: '',
    col1: 'سری', col2: 'نوع تجهیز', col3: null, col4: null, col5: null,
    rows: [ { c1: 'DH', c2: 'بالابر سیم بکسلی' }, { c1: 'PK', c2: 'بالابر زنجیری' } ],
    faqs: null, parts: null,
  },
  {
    blockType: ['parts'],
    heading: 'قطعات پرتقاضا',
    body: '',
    col1: null, rows: null, faqs: null,
    parts: [ { partName: 'کمربند بالابر', failureReason: 'سایش', category: null } ],
  },
  {
    blockType: ['faq'],
    heading: 'پرسش‌های متداول',
    body: '',
    col1: null, rows: null, parts: null,
    faqs: [ { question: 'قطعه موجود است؟', answer: 'بله.' } ],
  },
];

console.log('\n── شکل واقعی WPGraphQL (blockType آرایه است) ──');

const blocks = normalizeBlocks(REAL);

ok(blocks.length === 4, `هر ۴ بلوک حفظ شد (شد: ${blocks.length})`);
ok(
  blocks.map((b) => b.type).join(',') === 'text,table,parts,faq',
  `نوع‌ها درست خوانده شدند (شد: ${blocks.map((b) => b.type).join(',')})`,
);
ok(blocks[1]?.columns.length === 2, 'ستون‌های خالی حذف و دو ستون واقعی نگه داشته شد');
ok(blocks[1]?.rows.length === 2, 'دو ردیف جدول خوانده شد');
ok(blocks[2]?.parts.length === 1, 'قطعه خوانده شد');
ok(blocks[3]?.faqs.length === 1, 'پرسش خوانده شد');

// ── رگرسیون دقیقِ همان باگ ────────────────────────────────────────────────
console.log('\n── رگرسیون: اگر دوباره آرایه را نفهمیم ──');
const onlyText = normalizeBlocks(REAL).filter((b) => b.type === 'text');
ok(onlyText.length === 1, `فقط یک بلوک متنی باید باشد، نه همه‌شان (شد: ${onlyText.length})`);

// ── شکل رشته‌ای هم باید کار کند (اگر افزونه روزی عوض شود) ─────────────────
console.log('\n── شکل رشته‌ای (سازگاری با نسخه‌های دیگر افزونه) ──');
const asString = normalizeBlocks([
  { blockType: 'table', heading: 'x', col1: 'a', rows: [{ c1: '1' }] },
]);
ok(asString.length === 1 && asString[0].type === 'table', 'رشته‌ی ساده هم درست خوانده می‌شود');

// ── بلوک واقعاً خالی باید حذف شود ────────────────────────────────────────
console.log('\n── بلوک خالی همچنان باید حذف شود ──');
const empty = normalizeBlocks([{ blockType: ['table'], heading: 'بی‌داده', rows: null, col1: null }]);
ok(empty.length === 0, 'جدول بدون ردیف و ستون رندر نمی‌شود');
ok(hasContent({ ...blocks[1] }) === true, 'hasContent برای جدول پر، درست است');

/* ═══════════════════════════════════════════════════════════════════════
   برچسب ناوبری
   ═══════════════════════════════════════════════════════════════════════
   چرا آزمون دارد: تا پیش از این، `SectionNav` مستقیم `heading` را
   می‌گرفت و یک عنوان پانزده‌کلمه‌ای تمام نوار را اشغال می‌کرد. برش
   خودکار باید روی عنوان‌های **واقعیِ** این پروژه درست کار کند، نه روی
   نمونه‌های ساختگیِ دوستانه — پس ورودی‌های زیر عیناً از
   `content/category-wire-rope.json` برداشته شده‌اند. */
console.log('\n── برچسب ناوبری ──');

ok(deriveNavLabel('هرچه', 'دستی') === 'دستی', 'برچسب دستی همیشه برنده است');
ok(deriveNavLabel('عیب‌یابی') === 'عیب‌یابی', 'عنوان کوتاه دست‌نخورده می‌ماند');
ok(deriveNavLabel('') === '', 'عنوان خالی، برچسب خالی');

const REAL_HEADINGS: [string, string][] = [
  ['سیم‌بکسل جرثقیل: چرا انتخاب آن با «قطر» تمام نمی‌شود', 'سیم‌بکسل جرثقیل'],
  ['رمزگشایی کد سیم‌بکسل — بخش به بخش', 'رمزگشایی کد سیم‌بکسل'],
  ['عیب‌یابی: نشانه‌ای که می‌بینید، علتی که احتمالاً دارد', 'عیب‌یابی'],
  ['پیش از استعلام، این‌ها را آماده کنید', 'پیش از استعلام'],
];
for (const [heading, want] of REAL_HEADINGS) {
  const got = deriveNavLabel(heading);
  ok(got === want, `«${heading.slice(0, 22)}…» → «${got}»`);
}

// هیچ عنوانی نباید برچسبی بلندتر از سقف بسازد — این همان چیزی است که
// نوار را می‌شکست.
const LONG = [
  'چهار پارامتری که واقعاً انتخاب را تعیین می‌کنند',
  'پرسش‌های متداول درباره‌ی سیم‌بکسل جرثقیل',
  'قطعاتی که با سیم‌بکسل بررسی می‌شوند',
  'کد روی سیم‌بکسل را چطور بخوانیم',
  'ساختارهای رایج و رفتار هرکدام',
];
// ⚠️ `LONG.map(deriveNavLabel)` ننویسید: map آرگومان دوم را هم می‌فرستد و
// اندیسِ عددی در جای `explicit` می‌نشیند. همین اشتباه همین‌جا رخ داد و
// آزمون با TypeError گرفتش — که دقیقاً رفتار درست است.
const over = LONG.map((h) => deriveNavLabel(h)).filter((l) => l.length > NAV_LABEL_MAX);
ok(over.length === 0, `هیچ برچسبی از ${NAV_LABEL_MAX} کاراکتر بلندتر نیست`);
// و هیچ‌کدام نباید وسط کلمه بریده شده باشند.
const midWord = LONG.filter((h) => {
  const l = deriveNavLabel(h);
  return l.length < h.length && !/[\s:—–؛،]/.test(h.charAt(l.length));
});
ok(midWord.length === 0, 'هیچ برچسبی وسط کلمه بریده نشده است');

// ── nav_label و aside از مسیر نرمال‌سازی عبور می‌کنند ────────────────────
console.log('\n── عبور nav_label و aside از normalizeBlocks ──');
const withExtras = normalizeBlocks([
  {
    blockType: ['text'],
    heading: 'سیم‌بکسل جرثقیل: چرا انتخاب آن با «قطر» تمام نمی‌شود',
    navLabel: null,
    aside: '<p>قطر اسمی را با کولیس روی تاج‌ها بسنجید.</p>',
    body: '<p>متن</p>',
  },
  { blockType: ['text'], heading: 'یک', navLabel: ['دستی'], aside: null, body: '<p>م</p>' },
]);
ok(withExtras[0].navLabel === 'سیم‌بکسل جرثقیل', 'برچسب از عنوان ساخته شد');
ok(withExtras[0].asideHtml.includes('کولیس'), 'یادداشت کناری منتقل شد');
ok(withExtras[1].asideHtml === '', 'aside خالی به رشته‌ی خالی تبدیل می‌شود');
// ⚠️ ACF فیلد text را هم گاهی داخل آرایه می‌دهد — همان باگی که blockType را
// شکست. برچسب ناوبری نباید دوباره روی همان تله برود.
ok(withExtras[1].navLabel === 'دستی', 'navLabel داخل آرایه هم خوانده می‌شود');

console.log(
  failed ? `\n❌ ${failed} آزمون شکست خورد.\n` : '\n✅ همه‌ی آزمون‌های بلوک گذشت.\n',
);
process.exit(failed ? 1 : 0);
