// src/lib/brand-queries.mjs
// ---------------------------------------------------------------------------
// نردبان کوئری پروفایل برند — تنها مرجع.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا این فایل .mjs است و نه .ts
// ═══════════════════════════════════════════════════════════════════════════
// `scripts/diagnose-brand.mjs` باید *دقیقاً همان* کوئری‌هایی را بزند که
// build می‌زند. نود نمی‌تواند `.ts` را مستقیم import کند، پس نسخه‌ی قبلی
// اسکریپت، فایل TS را با **regex** می‌خواند.
//
// آن regex شکست خورد و **بی‌صدا** شکست خورد:
//
//     const fields = src.match(/export const FIELDS = `(...)`/)?.[1] ?? '';
//
// ولی در فایل TS نوشته بود `export const FIELDS = CORE_FIELDS + MEDIA_FIELD;`
// — یعنی بک‌تیکی در کار نبود، regex هیچ‌چیز پیدا نکرد، و `?? ''` آن را به
// رشته‌ی خالی تبدیل کرد. نتیجه: تشخیص، کوئریِ «کامل» را **بدون هیچ فیلدی**
// اجرا کرد، طبیعتاً موفق شد، و گزارش داد:
//
//     ✅ «کامل (category.nodes)» کار کرد
//
// در حالی که همان لحظه build واقعی داشت به «بدون رسانه» سقوط می‌کرد.
// یعنی ابزار تشخیص، دقیقاً خطایی را پنهان کرد که برای پیدا کردنش ساخته
// شده بود.
//
// درس: **ابزار تشخیص نباید منبع را دوباره تفسیر کند.** حالا هر دو طرف
// همین فایل را import می‌کنند؛ اختلاف بین‌شان از نظر ساختاری ناممکن است.
//
// ═══════════════════════════════════════════════════════════════════════════
// ترتیب نردبان — قاعده‌ای که نسخه‌ی قبل نقض می‌کرد
// ═══════════════════════════════════════════════════════════════════════════
// نردبان باید **کم‌ارزش‌ترین محور را اول** حذف کند.
//
// نسخه‌ی قبل، `media` (پرخطر، فعلاً برای همه‌ی برندها خالی) را در همان
// شکلی گذاشته بود که `category` (لینک داخلی، باارزش‌ترین چیز این صفحه)
// را داشت. پس وقتی media در اسکیما خراب بود، هر سه شکلِ دارای لینک دسته
// با هم افتادند و build روی «بدون رسانه» فرود آمد — یعنی
// **۵ لینک داخلی برند ← دسته بی‌صدا از صفحه حذف شد.**
//
// حالا دو محور مستقل‌اند و حلقه‌ی داخلی (media) زودتر تنزل می‌کند:
//
//     برای هر شکلِ «قطعات» (بیرونی، دیرتر تنزل می‌کند)
//         برای هر شکلِ «رسانه» (داخلی، زودتر تنزل می‌کند)
//
// یعنی خرابیِ media حداکثر media را می‌گیرد، نه لینک دسته را.
// ---------------------------------------------------------------------------

/** فیلدهایی که شکل خروجی‌شان بین نسخه‌های WPGraphQL-for-ACF ثابت است. */
export const CORE_FIELDS = `
  heroClaim
  intro
  foundedYear
  headquarters
  identificationGuide
  iranPresence
  series { seriesName equipmentType capacityNote commonInIran notes needsReview }
  technologies { name summary whyItMatters needsReview }
  faqs { question answer needsReview }
  sources { title url }
`;

/**
 * فیلد Image در ACF.
 *
 * در WPGraphQL-for-ACF نسخه‌ی ۲، فیلد تصویر یک **connection edge** است و
 * باید از `node` عبور کرد. در نسخه‌ی ۱، خودِ MediaItem برمی‌گشت. کدام‌یک
 * درست است به نسخه‌ی نصب‌شده بستگی دارد، پس هر دو را امتحان می‌کنیم.
 */
export const MEDIA_VARIANTS = [
  {
    id: 'media-node',
    label: 'رسانه (asset.node)',
    hasMedia: true,
    frag: `media { kind videoUrl caption altText asset { node { sourceUrl altText mediaDetails { width height } } } }`,
  },
  {
    id: 'media-flat',
    label: 'رسانه (asset مستقیم)',
    hasMedia: true,
    frag: `media { kind videoUrl caption altText asset { sourceUrl altText mediaDetails { width height } } }`,
  },
  { id: 'media-none', label: 'بدون رسانه', hasMedia: false, frag: '' },
];

/**
 * فیلد Taxonomy در ACF — گاهی connection، گاهی شیء مستقیم.
 *
 * ⚠️ `hasCategoryLink` صرفاً برچسب نیست: `brand-profile.ts` وقتی روی شکلی
 * فرود بیاید که این پرچم را ندارد، هشدار می‌دهد — چون آن حالت یعنی لینک
 * داخلی از دست رفته، و از دست رفتنِ بی‌صدای لینک داخلی همان چیزی است که
 * یک بار اتفاق افتاد و کسی متوجه نشد.
 */
export const PARTS_VARIANTS = [
  {
    id: 'parts-nodes',
    label: 'لینک دسته (connection)',
    hasCategoryLink: true,
    frag: `commonParts { partName failureReason needsReview category { nodes { ... on CraneCategory { slug name } } } }`,
  },
  {
    id: 'parts-flat',
    label: 'لینک دسته (مستقیم)',
    hasCategoryLink: true,
    frag: `commonParts { partName failureReason needsReview category { ... on CraneCategory { slug name } } }`,
  },
  {
    id: 'parts-plain',
    label: 'بدون لینک دسته',
    hasCategoryLink: false,
    frag: `commonParts { partName failureReason needsReview }`,
  },
];

const wrap = (body) => `query BrandProfiles($first: Int!) {
  craneBrands(first: $first) { nodes { slug brandProfile {
${body}
  } } }
}`;

/** نردبان کامل: قطعات بیرونی (دیرتر تنزل)، رسانه داخلی (زودتر تنزل). */
export const SHAPES = [];

for (const parts of PARTS_VARIANTS) {
  for (const media of MEDIA_VARIANTS) {
    SHAPES.push({
      name: `${parts.label} + ${media.label}`,
      hasCategoryLink: parts.hasCategoryLink,
      hasMedia: media.hasMedia,
      hasParts: true,
      query: wrap([CORE_FIELDS, media.frag, parts.frag].filter(Boolean).join('\n')),
    });
  }
}

// آخرین سنگر: اگر خودِ ریپیتر `commonParts` هم مشکل داشته باشد، دست‌کم
// متن‌ها و پرسش‌های متداول روی صفحه می‌آیند.
SHAPES.push({
  name: 'فقط هسته',
  hasCategoryLink: false,
  hasMedia: false,
  hasParts: false,
  query: wrap(CORE_FIELDS),
});

/**
 * خودآزمایی نردبان.
 *
 * این تابع را هم `npm run check` صدا می‌زند و هم اسکریپت تشخیص. دلیلش
 * ساده است: هر سه باگ این ماژول از جنس «چیزی که فکر می‌کردیم ساختیم با
 * چیزی که واقعاً ساختیم فرق داشت» بود. پس ساخته‌شده را می‌سنجیم، نه نیت را.
 *
 * @returns {string[]} فهرست ایرادها؛ آرایه‌ی خالی یعنی سالم.
 */
export function auditShapes(shapes = SHAPES) {
  const problems = [];

  if (!shapes.length) return ['هیچ شکلی ساخته نشد.'];

  shapes.forEach((s, i) => {
    // ۱) هیچ placeholder حل‌نشده‌ای نماند — همان چیزی که regex قبلی جا گذاشت.
    if (s.query.includes('${')) problems.push(`شکل ${i} («${s.name}») placeholder حل‌نشده دارد.`);

    // ۲) فیلدهای هسته باید در *هر* شکلی باشند؛ اگر نباشند، شکل چیزی را
    //    آزمایش نمی‌کند و موفقیتش بی‌معناست.
    for (const token of ['heroClaim', 'intro', 'faqs']) {
      if (!s.query.includes(token)) problems.push(`شکل ${i} («${s.name}») فاقد «${token}» است.`);
    }

    // ۳) پرچم‌ها باید با متن کوئری بخوانند، نه با ادعای ما.
    if (s.hasMedia !== /\bmedia\s*\{/.test(s.query)) problems.push(`شکل ${i}: پرچم hasMedia با کوئری نمی‌خواند.`);
    if (s.hasParts !== /\bcommonParts\s*\{/.test(s.query)) problems.push(`شکل ${i}: پرچم hasParts با کوئری نمی‌خواند.`);
    if (s.hasCategoryLink !== /\bcategory\s*\{/.test(s.query)) problems.push(`شکل ${i}: پرچم hasCategoryLink با کوئری نمی‌خواند.`);
  });

  // ۴) قاعده‌ی اصلی نردبان: رسانه باید **قبل از** لینک دسته قربانی شود.
  const firstNoMedia = shapes.findIndex((s) => !s.hasMedia);
  const firstNoLink = shapes.findIndex((s) => !s.hasCategoryLink);
  if (firstNoMedia === -1) problems.push('هیچ شکلی بدون رسانه وجود ندارد — خرابی media کل صفحه را می‌برد.');
  else if (firstNoLink !== -1 && firstNoLink < firstNoMedia) {
    problems.push(
      `ترتیب نردبان وارونه است: لینک دسته در شکل ${firstNoLink} حذف می‌شود ولی رسانه تا شکل ${firstNoMedia} می‌ماند. ` +
        'یعنی یک فیلد رسانه‌ی خراب، لینک‌های داخلی را با خودش می‌برد.',
    );
  }

  // ۵) شکل اول باید غنی‌ترین باشد.
  if (shapes[0] && (!shapes[0].hasMedia || !shapes[0].hasCategoryLink)) {
    problems.push('شکل اول غنی‌ترین نیست — نردبان از پله‌ی وسط شروع می‌شود.');
  }

  return problems;
}
