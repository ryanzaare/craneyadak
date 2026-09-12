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

import { normalizeBlocks, hasContent } from './block-shape.ts';

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

console.log(
  failed ? `\n❌ ${failed} آزمون شکست خورد.\n` : '\n✅ همه‌ی آزمون‌های بلوک گذشت.\n',
);
process.exit(failed ? 1 : 0);
