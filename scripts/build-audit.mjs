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
    authenticity: /data-authenticity=["'](original|non_original)["']/.exec(html)?.[1] ?? '',
  };
}

const UTILITY = ['/account/', '/checkout/', '/track/', '/search/', '/thank-you/', '/products/demo-'];
const isUtility = (route) => UTILITY.some((p) => route.startsWith(p));
/** صفحه‌ای که باید در ایندکس بیاید: نه ریدایرکت، نه 404، نه noindex. */
export const isIndexable = (p) => !p.isRedirect && !p.noindex && p.route !== '/404.html' && p.route !== '/404/';

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
