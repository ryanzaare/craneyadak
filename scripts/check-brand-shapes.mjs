#!/usr/bin/env node
// scripts/check-brand-shapes.mjs
// ---------------------------------------------------------------------------
// ممیزی نردبان کوئری پروفایل برند — بدون نیاز به شبکه یا وردپرس.
//
// چرا این در `npm run check` است و نه فقط در اسکریپت تشخیص:
//
// باگی که این را لازم کرد، در زمان build **بی‌صدا** بود. نردبان `media`
// (پرخطر، فعلاً برای همه‌ی برندها خالی) را در همان شکلی گذاشته بود که
// `category` (لینک داخلی) را داشت. یک فیلد رسانه‌ی ناسازگار با نسخه‌ی
// افزونه، هر سه شکلِ دارای لینک دسته را با هم انداخت و build روی شکل
// ضعیف فرود آمد. صفحه ساخته شد، خطایی چاپ نشد، و ۵ لینک داخلی ناپدید شد.
//
// چنین چیزی را تست شبکه‌ای نمی‌گیرد — چون شبکه سالم بود. فقط بررسی
// *ساختار نردبان* می‌گیردش، و آن هم بدون هیچ وابستگی خارجی.
// ---------------------------------------------------------------------------

import { SHAPES, auditShapes } from '../src/lib/brand-queries.mjs';

const problems = auditShapes();

if (problems.length) {
  console.error('❌ نردبان کوئری برند ایراد دارد:');
  for (const p of problems) console.error(`   • ${p}`);
  process.exit(1);
}

const firstNoMedia = SHAPES.findIndex((s) => !s.hasMedia);
const firstNoLink = SHAPES.findIndex((s) => !s.hasCategoryLink);

console.log(
  `✅ نردبان کوئری برند سالم است — ${SHAPES.length} شکل؛ ` +
    `رسانه در پله‌ی ${firstNoMedia} حذف می‌شود، لینک دسته تا پله‌ی ${firstNoLink} می‌ماند.`,
);
