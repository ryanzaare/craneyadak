// scripts/build-audit.mjs
// ---------------------------------------------------------------------------
// توابع خالص ممیزی خروجی build (بدون خواندن دیسک) تا با ورودی خراب آزمون شوند
// (scripts/build-audit.test.mjs — قاعده‌ی ۶ پروژه). اجرا: check-build-audit.mjs.
//
// چهار بررسی، هر کدام برای یک شکست واقعی یا محتمل:
//   ۱) ماتریس مسیرها: مسیر ابزاری (account/checkout/track/search/thank-you/demo) نباید
//      ایندکس‌پذیر شود؛ صفحه‌ی ایندکس‌پذیر باید در sitemap باشد.
//   ۲) یکتایی متا: عنوان یا توضیح تکراریِ صفحه‌های ایندکس‌پذیر (پس از برش ۶۰/۱۵۸
//      کاراکتری، دو محصول با نام‌های بلند مشابه می‌توانند یکسان شوند).
//   ۳) اسکیمای محصول: name = H1 دیده‌شده، SKU/برند/کد OEM در متن دیده‌شده. اسکیمای
//      بی‌پشتوانه در متن خلاف قاعده‌ی داده‌ی ساختاریافته و قاعده‌ی «هرگز نساز» است.
//   ۴) کوچک‌شدن بی‌صدا: وردپرس پاسخ ناقص بدهد، build سبز می‌شود و سایت کوچک‌تر.
// ---------------------------------------------------------------------------

export const SITE_ORIGIN = 'https://craneyadak.com';

const decode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const squash = (s) => decode(s).replace(/\s+/g, ' ').trim();

/** مسیر URL از مسیر فایل داخل dist: 'about/index.html' → '/about/'. */
export function routeOf(relFile) {
  const f = relFile.split('\\').join('/');
  if (f === 'index.html') return '/';
  if (f.endsWith('/index.html')) return `/${f.slice(0, -'index.html'.length)}`;
  return `/${f}`;
}

export function parsePage(route, html) {
  const meta = (name) => {
    const m = new RegExp(`<meta[^>]+name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html);
    return m ? decode(m[1]).trim() : '';
  };
  const noHtmlTag = !/<html[\s>]/i.test(html);
  const jsonld = [];
  for (const [, body] of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(body);
      jsonld.push(...(Array.isArray(j) ? j : j['@graph'] ? j['@graph'] : [j]));
    } catch {
      jsonld.push({ '@type': '__invalid__' });
    }
  }
  return {
    route,
    isRedirect: /http-equiv=["']refresh["']/i.test(html) || noHtmlTag,
    noindex: /noindex/i.test(meta('robots')),
    canonical: /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1] ?? '',
    title: squash(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ''),
    description: squash(meta('description')),
    h1: squash((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? '').replace(/<[^>]+>/g, ' ')),
    text: squash(html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')),
    jsonld,
    productLinks: [...new Set([...html.matchAll(/href=["']\/products\/([^"'\/?#]+)\/["']/g)].map((m) => `/products/${m[1]}/`))],
    // لینک‌های داخلی به صفحه‌های فهرست (دسته/برند) — برای هاب‌ها که «یک گام» تا محصول فاصله دارند.
    listingLinks: [...new Set([...html.matchAll(/href=["'](\/(?:categories|brands)\/[^"'?#]*)["']/g)].map((m) => (m[1].endsWith('/') ? m[1] : `${m[1]}/`)))],
    authenticity: /data-authenticity=["'](original|non_original)["']/.exec(html)?.[1] ?? '',
  };
}

const UTILITY = ['/account/', '/checkout/', '/track/', '/search/', '/thank-you/', '/products/demo-'];
const isUtility = (route) => UTILITY.some((p) => route.startsWith(p));
/** صفحه‌ای که باید در ایندکس بیاید: نه ریدایرکت، نه 404، نه noindex. */
export const isIndexable = (p) => !p.isRedirect && !p.noindex && p.route !== '/404.html' && p.route !== '/404/';

const LISTING = [/^\/brands\/$/, /^\/brands\/[^/]+\/$/, /^\/categories\/$/, /^\/categories\/[^/]+\/$/, /^\/categories\/[^/]+\/[^/]+\/$/, /^\/products\/$/];

/**
 * ⚠️ سیاست کارفرما (۱۹ مهر ۱۴۰۵): برند/دسته/سیلو/فهرست فقط با «محصولِ کامل» ایندکس‌پذیرند. این نگهبان از *خروجی واقعی* می‌سنجد
 * (نه از منطق خود src/lib/indexability.ts که ممکن است خودش باگ داشته باشد): صفحه‌ی فهرستِ ایندکس‌پذیر باید به دست‌کم یک
 * صفحه‌ی محصولِ ایندکس‌پذیر لینک بدهد. `allowEmpty` = INDEX_EMPTY_CATEGORIES=1 (بازنویسی عمدی).
 */
/**
 * ⚠️ هاب‌ها (۲۴ آبان ۱۴۰۵): /categories/، /brands/ و سیلوی /categories/<x>/ به دسته/برند لینک می‌دهند، نه مستقیم به محصول.
 * با اولین محصول کامل (SAGA1-L12) ایندکس‌پذیر شدند — درست، چون محصول یک کلیک دورتر است — ولی این نگهبان فقط لینک مستقیم
 * محصول را می‌شمرد و انتشار را چهار شب پشت سر هم (۲۱ تا ۲۴ آبان) شکست. برای هاب، لینک به یک صفحه‌ی فهرستِ ایندکس‌پذیر که
 * *خودش* لینک مستقیم محصول ایندکس‌پذیر دارد کافی است — دقیقاً یک گام، نه زنجیره، تا «هاب → هاب خالی» از قلم نیفتد.
 * دسته‌ی برگ، صفحه‌ی برند و /products/ همچنان لینک مستقیم می‌خواهند.
 */
const HUB = [/^\/categories\/$/, /^\/brands\/$/, /^\/categories\/[^/]+\/$/];

export function emptyListingProblems(pages, { allowEmpty = false } = {}) {
  if (allowEmpty) return [];
  const indexableProducts = new Set(pages.filter((p) => /^\/products\/[^/]+\/$/.test(p.route) && isIndexable(p) && !isUtility(p.route)).map((p) => p.route));
  const direct = (p) => (p.productLinks ?? []).some((l) => indexableProducts.has(l));
  // صفحه‌های فهرستِ ایندکس‌پذیر که مستقیم به محصول ایندکس‌پذیر لینک می‌دهند (فقط این‌ها «گام» هاب حساب می‌شوند)
  const stocked = new Set(pages.filter((p) => isIndexable(p) && LISTING.some((re) => re.test(p.route)) && direct(p)).map((p) => p.route));
  const out = [];
  for (const p of pages) {
    if (!isIndexable(p) || !LISTING.some((re) => re.test(p.route))) continue;
    if (direct(p)) continue;
    if (HUB.some((re) => re.test(p.route)) && (p.listingLinks ?? []).some((l) => l !== p.route && stocked.has(l))) continue;
    out.push(`${p.route}: ایندکس‌پذیر است ولی به هیچ صفحه‌ی محصولِ ایندکس‌پذیر لینک نمی‌دهد — صفحه‌ی خالی باید noindex باشد`);
  }
  return out;
}

export function routeMatrixProblems(pages, sitemapLocs) {
  const out = [];
  const inMap = new Set(sitemapLocs);
  for (const p of pages) {
    if (p.isRedirect) continue;
    if (isUtility(p.route) && !p.noindex) out.push(`${p.route}: مسیر ابزاری/نمایشی است ولی ایندکس‌پذیر (noindex ندارد)`);
    if (isIndexable(p) && !isUtility(p.route) && !inMap.has(`${SITE_ORIGIN}${p.route}`)) {
      out.push(`${p.route}: ایندکس‌پذیر است ولی در sitemap نیست`);
    }
  }
  return out;
}

export function metadataProblems(pages) {
  const out = [];
  const seen = { title: new Map(), description: new Map() };
  for (const p of pages.filter((x) => isIndexable(x) && !isUtility(x.route))) {
    if (!p.title) out.push(`${p.route}: عنوان (title) ندارد`);
    if (!p.description) out.push(`${p.route}: meta description ندارد`);
    if (!p.h1) out.push(`${p.route}: H1 ندارد`);
    for (const k of ['title', 'description']) {
      if (!p[k]) continue;
      const prev = seen[k].get(p[k]);
      if (prev) out.push(`${p.route}: ${k === 'title' ? 'عنوان' : 'توضیح'} با ${prev} یکسان است («${p[k].slice(0, 50)}…»)`);
      else seen[k].set(p[k], p.route);
    }
  }
  return out;
}

export function productSchemaProblems(pages) {
  const out = [];
  for (const p of pages) {
    if (!/^\/products\/[^/]+\/$/.test(p.route) || !isIndexable(p) || isUtility(p.route)) continue;
    const products = p.jsonld.filter((n) => n['@type'] === 'Product');
    if (products.length !== 1) {
      out.push(`${p.route}: باید دقیقاً یک Product در JSON-LD باشد، ${products.length} یافت شد`);
      continue;
    }
    const n = products[0];
    if (p.jsonld.some((x) => x['@type'] === '__invalid__')) out.push(`${p.route}: JSON-LD نامعتبر (parse نشد)`);
    if (n.name && squash(String(n.name)) !== p.h1) out.push(`${p.route}: name در JSON-LD («${n.name}») با H1 دیده‌شده یکی نیست`);
    if (n.sku && !p.text.includes(String(n.sku))) out.push(`${p.route}: sku «${n.sku}» در متن صفحه دیده نمی‌شود`);
    const brandName = n.brand?.name;
    if (brandName && !p.text.includes(String(brandName)) && !(n.brand?.alternateName && p.text.includes(String(n.brand.alternateName)))) {
      out.push(`${p.route}: برند «${brandName}» در متن صفحه دیده نمی‌شود`);
    }
    for (const prop of Array.isArray(n.additionalProperty) ? n.additionalProperty : []) {
      if (prop?.value !== undefined && String(prop.value).length && !p.text.includes(String(prop.value))) {
        out.push(`${p.route}: مقدار «${prop.value}» (${prop.name}) در JSON-LD هست ولی روی صفحه دیده نمی‌شود`);
      }
    }
    // ⚠️ صفحه‌ی محصولِ ایندکس‌پذیر بدون تصویر واقعی یعنی قاعده‌ی «آمادگی ایندکس» (src/lib/indexability.ts)
    // و قالب صفحه از هم جدا شده‌اند؛ محصول بی‌عکس نباید ایندکس شود (کارفرما: «صفحه‌ی خالی noindex بماند»).
    if (!(Array.isArray(n.image) ? n.image.length : n.image)) {
      out.push(`${p.route}: ایندکس‌پذیر است ولی Product در JSON-LD هیچ تصویری ندارد — محصول ناقص باید noindex باشد`);
    }
    // ⚠️ قاعده‌ی ۹ (۱۸ آبان ۱۴۰۵): گالری از تصویر دوم به بعد اینفوگرافیک دارد (متن، جدول، تلفن).
    // فقط images[0] — نمای استودیویی تمیز — حق ورود به Product.image را دارد؛ آرایه‌ی چندتایی
    // یعنی productJsonLd به رفتار قدیم برگشته و اینفوگرافیک به Rich Result رسیده است.
    if (Array.isArray(n.image) && n.image.length > 1) {
      out.push(`${p.route}: Product.image ${n.image.length} تصویر دارد — فقط یک تصویر (images[0]، نمای استودیویی تمیز) مجاز است`);
    }
    if (n.aggregateRating || n.review) {
      out.push(`${p.route}: aggregateRating/review در JSON-LD است — فقط با نظر واقعیِ دیده‌شده روی صفحه مجاز است (بازبینی دستی)`);
    }
  }
  return out;
}

/**
 * @param {string[]} prev  مسیرهای ایندکس‌پذیر build قبلی
 * @param {string[]} curr  مسیرهای ایندکس‌پذیر build فعلی
 * فقط وقتی شکست می‌خورد که هم ≥۵ مسیر و هم ≥۱۵٪ از دست رفته باشد: حذف یک دو محصول
 * آزمایشی عادی است، ریزش یک‌جای صفحه‌ها نه.
 */
export function shrinkageProblems(prev, curr, { minLost = 5, minRatio = 0.15 } = {}) {
  if (!prev.length) return [];
  const now = new Set(curr);
  const lost = prev.filter((r) => !now.has(r));
  if (lost.length >= minLost && lost.length / prev.length >= minRatio) {
    return [
      `${lost.length} از ${prev.length} مسیر ایندکس‌پذیر build قبلی در این build نیست (نمونه: ${lost.slice(0, 4).join('، ')}). ` +
        'وردپرس پاسخ ناقص داده یا داده حذف شده؟ اگر عمدی است: ALLOW_SHRINK=1 npm run build',
    ];
  }
  return [];
}

/**
 * تاریخ آخرین تغییر *واقعی* صفحه برای `<lastmod>` در sitemap، یا null.
 *
 * ⚠️ گوگل lastmod را فقط وقتی به کار می‌برد که «همواره و قابل‌راستی‌آزمایی درست» باشد؛ زمان build
 * برای همه‌ی صفحه‌ها (هر شب یک تاریخ تازه) دقیقاً همان چیزی است که باعث می‌شود کل ستون نادیده گرفته
 * شود. پس فقط دو منبع که از وردپرس می‌آیند: `dateModified` در JSON-LD (مقاله، صفحه‌ی حقوقی) و
 * `<time data-lastmod datetime>` (صفحه‌ی محصول). صفحه‌ای که هیچ‌کدام را ندارد lastmod نمی‌گیرد.
 *
 * @param {string} html
 * @param {number} [now] برای آزمون
 * @returns {string|null} YYYY-MM-DD
 */
export function sitemapLastmod(html, now = Date.now()) {
  const m =
    /"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})/.exec(html) ??
    /<time\b(?=[^>]*\bdata-lastmod\b)[^>]*\bdatetime=["'](\d{4}-\d{2}-\d{2})/.exec(html);
  if (!m) return null;
  const ts = Date.parse(`${m[1]}T00:00:00Z`);
  // Date.parse تاریخ ناممکن را NaN می‌دهد، ولی «۲۰۲۶-۰۲-۳۰» را به مارس می‌غلتاند — رفت‌وبرگشت همین را می‌گیرد.
  if (Number.isNaN(ts) || new Date(ts).toISOString().slice(0, 10) !== m[1]) return null;
  if (ts > now + 86_400_000) return null; // ساعت سرور وردپرس جلو باشد یا نوشته‌ی زمان‌بندی‌شده
  return m[1];
}

/** `<lastmod>` را پس از `<loc>` یک بلوک `<url>` می‌گذارد؛ اگر تاریخ نیست یا lastmod هست، دست نمی‌زند. */
export function addSitemapLastmod(block, date) {
  if (!date || /<lastmod>/.test(block)) return block;
  return block.replace('</loc>', `</loc><lastmod>${date}</lastmod>`);
}
