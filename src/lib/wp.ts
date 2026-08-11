// src/lib/wp.ts
// ---------------------------------------------------------------------------
// لایه‌ی داده‌ی Headless WordPress (WPGraphQL + ACF Pro) — فقط زمان BUILD.
//
// قانون حاکم بر کل این فایل: یا داده‌ی واقعی، یا هیچ. هیچ مقداری حدس زده،
// جایگزین یا «تقریب» نمی‌شود. نبود داده همیشه بهتر از داده‌ی ساختگی است.
//
// معماری: تمام fetchها فقط در `getStaticPaths()` (زمان build) اجرا می‌شوند.
// خروجی سایت `output: 'static'` می‌ماند و بازدیدکننده هیچ وابستگی زمان‌اجرا
// به وردپرس ندارد.
//
// وابستگی وردپرسی: فقط WPGraphQL + WPGraphQL for ACF. عمداً از
// `taxQuery`/`metaQuery` استفاده نشده (هرکدام یک افزونه‌ی جانبی می‌خواهند)؛
// کل کاتالوگ یک‌بار در هر build واکشی و در حافظه فیلتر می‌شود.
//
// متغیر محیطی: `WP_GRAPHQL_URL` (بدون پیشوند PUBLIC_ — فقط سرورِ بیلد).
// ---------------------------------------------------------------------------

/**
 * دسترسی امن به `process.env` بدون وابستگی به تایپ‌های Node.
 * `import.meta.env` مقادیر فایل `.env` را می‌دهد، اما در CI/سرویس دیپلوی
 * متغیرها معمولاً فقط در `process.env` تزریق می‌شوند.
 */
const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  ?.env;

const WP_BASE_URL: string | null =
  nodeEnv?.WP_GRAPHQL_URL || (import.meta.env.WP_GRAPHQL_URL as string | undefined) || null;

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

/** واحد پول — تمام قیمت‌ها به ریال ذخیره و نمایش داده می‌شوند. */
export const CURRENCY = 'IRR' as const;

export interface CraneImage {
  url: string;
  altText: string;
  width: number | null;
  height: number | null;
}

export interface SpecRow {
  label: string;
  value: string;
}

export interface OemReference {
  oemBrand: string;
  oemPartNumber: string;
}

export interface CompatibleModel {
  craneBrand: string;
  modelName: string;
}

/**
 * مسیر خرید. عمداً پیش‌فرض `rfq` است.
 *
 * چرا: در خرید صنعتی B2B، مدیر خرید برای قطعه‌ی گران و نیازمند تطابق فنی،
 * پیش‌فاکتور رسمی می‌خواهد تا چرخه‌ی تایید داخلی را طی کند — نه درگاه
 * پرداخت. «افزودن به سبد» فقط برای اقلام موجودِ کم‌ریسک منطقی است. اگر
 * وردپرس چیزی نگوید، امن‌ترین حالت استعلام است، نه ادعای فروش فوری.
 */
export type BuyMode = 'cart' | 'rfq';

/** وضعیت موجودی — «نامشخص» یک حالت معتبر و صادقانه است. */
export type StockStatus = 'in_stock' | 'on_order' | 'unknown';

export interface CraneProduct {
  name: string;
  slug: string;
  sku: string | null;
  /** توضیح کوتاه (excerpt وردپرس) — بدون HTML. */
  summary: string | null;
  /** متن کامل توضیحات (HTML مورد اعتماد از ویرایشگر وردپرس). */
  bodyHtml: string | null;

  brandSlug: string | null;
  brandNameFa: string | null;
  brandNameEn: string | null;
  categorySlugs: string[];

  /** قیمت عادی به ریال. `null` یعنی قیمت واقعی نداریم. */
  price: number | null;
  /** قیمت تخفیف‌خورده به ریال، فقط اگر واقعاً ثبت شده باشد. */
  salePrice: number | null;
  /** بازه‌ی اعتبار تخفیف (ISO date) — ممکن است خالی باشد یعنی بدون محدودیت. */
  saleStart: string | null;
  saleEnd: string | null;

  buyMode: BuyMode;
  stockStatus: StockStatus;

  images: CraneImage[];
  oemCrossReference: OemReference[];
  compatibleModels: CompatibleModel[];
  technicalSpecs: SpecRow[];

  /** تاریخ آخرین به‌روزرسانی محتوا در وردپرس (ISO). */
  modified: string | null;
}

/** نتیجه‌ی محاسبه‌ی قیمت — تنها منبع مجاز برای نمایش قیمت و ساخت اسکیما. */
export interface PriceState {
  /** آیا اصلاً قیمت واقعی داریم؟ */
  hasPrice: boolean;
  /** قیمتی که کاربر می‌پردازد (تخفیف‌خورده در صورت فعال بودن). */
  effective: number | null;
  /** قیمت قبل، فقط وقتی تخفیف واقعاً فعال است (برای خط‌خورده). */
  previous: number | null;
  /** درصد تخفیف صحیح‌شده، فقط وقتی تخفیف فعال است. */
  discountPercent: number | null;
  onSale: boolean;
  saleEnd: string | null;
}

export function isWpConfigured(): boolean {
  return typeof WP_BASE_URL === 'string' && WP_BASE_URL.trim() !== '';
}

/**
 * خطای سطح GraphQL (نه شبکه) — یعنی سرور پاسخ داد اما خودِ کوئری را رد کرد.
 * این نوع خطا با تلاش مجدد درست نمی‌شود.
 */
class WpGraphQLError extends Error {
  // عمداً از «parameter property» تایپ‌اسکریپت استفاده نشده: آن سینتکس نیاز
  // به ترنسپایل کامل دارد و در حالت strip-only (مثلاً اجرای مستقیم با Node
  // برای تست) پشتیبانی نمی‌شود. این شکل ساده همه‌جا کار می‌کند.
  readonly messages: string[];

  constructor(messages: string[]) {
    super(`خطای WPGraphQL: ${messages.join(' | ')}`);
    this.name = 'WpGraphQLError';
    this.messages = messages;
  }
}

async function wpQuery<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  if (!isWpConfigured()) return null;

  const endpoint = `${WP_BASE_URL!.replace(/\/+$/, '')}/graphql`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) throw new Error(`WPGraphQL پاسخ HTTP ${res.status} ${res.statusText} داد`);

      const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
      if (json.errors?.length) {
        // بدون تلاش مجدد: خطای اسکیما/مجوز قطعی است و سه بار تکرارش فقط
        // زمان بیلد را هدر می‌دهد. فقط خطاهای شبکه‌ای ارزش retry دارند.
        throw new WpGraphQLError(json.errors.map((e) => e.message));
      }
      return json.data ?? null;
    } catch (error) {
      if (error instanceof WpGraphQLError) throw error;
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      }
    }
  }

  throw new Error(
    `[wp] دریافت داده از ${endpoint} پس از ${MAX_ATTEMPTS} تلاش شکست خورد. ` +
      `بیلد عمداً متوقف شد تا سایت با کاتالوگ خالی منتشر نشود. ` +
      `علت آخرین خطا: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

/* ---------------------- نرمال‌سازی و کمک‌تابع‌ها ---------------------- */

function toArray<T>(value: { nodes?: T[] } | T[] | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.nodes ?? [];
}

/** ارقام فارسی/عربی → لاتین، حذف جداکننده‌ها. */
function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[،,\s‌]/g, '')
    .trim();
}

/**
 * تبدیل ورودی قیمت به عدد — فقط وقتی واقعاً عدد باشد.
 * «تماس بگیرید» / «استعلام» / خالی → `null`.
 */
export function parsePrice(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) && input > 0 ? input : null;

  const text = asString(input);
  if (!text) return null;

  const normalized = normalizeDigits(text);
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * تبدیل هر مقدار ACF به رشته‌ی ساده.
 *
 * ⚠️ چرا این تابع لازم است (باگ واقعی، نه احتیاط تئوریک):
 * WPGraphQL for ACF بسته به نوع فیلد و نسخه‌ی افزونه، مقدار را در چند شکل
 * متفاوت برمی‌گرداند. مشخصاً فیلد `select` ممکن است رشته، آرایه‌ای با یک
 * عضو (`['rfq']`)، یا شیئی مثل `{ value, label }` باشد. کد قبلی فرض کرده
 * بود همیشه رشته است و روی اولین محصول واقعی با
 * «raw?.trim is not a function» شکست.
 *
 * درس: شکل پاسخ یک لایه‌ی خارجی باید تایید شود، نه فرض. این تابع همه‌ی
 * شکل‌های ممکن را به یک قرارداد واحد تبدیل می‌کند تا این دسته از خطا فقط
 * یک بار — همین‌جا — حل شود.
 */
function asString(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'string') return input.trim() || null;
  if (typeof input === 'number' || typeof input === 'boolean') return String(input);

  // آرایه (select تک‌مقداری گاهی آرایه‌ی یک‌عضوی برمی‌گرداند)
  if (Array.isArray(input)) return input.length > 0 ? asString(input[0]) : null;

  // شیء {value, label} یا {name}
  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    for (const key of ['value', 'name', 'label', 'slug']) {
      if (key in obj) return asString(obj[key]);
    }
  }

  return null;
}

function cleanText(input: unknown): string | null {
  return asString(input);
}

/** حذف تگ‌های HTML برای متن خلاصه (که در متا دیسکریپشن هم می‌رود). */
function stripHtml(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

/**
 * محاسبه‌ی وضعیت قیمت و تخفیف.
 *
 * ⚠️ قانون سختگیرانه‌ی «قیمت خط‌خورده»:
 * قیمت خط‌خورده فقط زمانی نمایش داده می‌شود که یک قیمت عادیِ واقعی ثبت شده
 * باشد و قیمت تخفیف‌خورده از آن کمتر باشد. نمایش یک «قیمت قبلی» که هرگز
 * واقعی نبوده، هم نقض قانون داده‌ی جعلی این پروژه است، هم خلاف سیاست‌های
 * Google Merchant و هم در بسیاری از کشورها تخلف قانونی.
 *
 * ⚠️ نکته‌ی معماری استاتیک: این محاسبه در زمان BUILD انجام می‌شود. یعنی یک
 * تخفیف منقضی‌شده تا اولین بیلد بعدی روی سایت باقی می‌ماند. به همین دلیل
 * وب‌هوک بازسازی (WP publish → rebuild) برای این پروژه اختیاری نیست.
 */
export function computePrice(product: CraneProduct, now: Date = new Date()): PriceState {
  // ⚠️ قانون یکپارچگی: در حالت «استعلام و پیش‌فاکتور» هیچ قیمتی منتشر
  // نمی‌شود — نه روی صفحه، نه در کارت، نه در Schema.org.
  //
  // چرا: نمایش هم‌زمان یک عدد و دکمه‌ی «استعلام قیمت» به کاربر پیام متناقض
  // می‌دهد؛ اگر قیمت مشخص است چرا باید استعلام بگیرد؟ و اگر عدد نمایش‌داده‌شده
  // قیمت نهایی نیست، یعنی سایت عددی را نشان داده که به آن پایبند نیست.
  // این دقیقاً همان «داده‌ای که واقعیت ندارد» است، فقط در قالب قیمت.
  //
  // این بررسی عمداً اینجاست و نه در قالب‌ها: هر جای سایت که قیمت رندر
  // می‌شود از همین تابع عبور می‌کند، پس قانون یک‌بار و برای همیشه اعمال
  // می‌شود و امکان فراموش‌شدنش در یک کامپوننت وجود ندارد.
  if (product.buyMode === 'rfq') {
    return { hasPrice: false, effective: null, previous: null, discountPercent: null, onSale: false, saleEnd: null };
  }

  const base = product.price;
  const sale = product.salePrice;

  if (base === null && sale === null) {
    return { hasPrice: false, effective: null, previous: null, discountPercent: null, onSale: false, saleEnd: null };
  }

  // بدون قیمت عادیِ واقعی، هیچ «قیمت قبلی» برای خط‌زدن وجود ندارد.
  if (base === null) {
    return { hasPrice: true, effective: sale, previous: null, discountPercent: null, onSale: false, saleEnd: null };
  }

  const startOk = !product.saleStart || new Date(product.saleStart) <= now;
  const endOk = !product.saleEnd || new Date(product.saleEnd) >= now;
  const saleValid = sale !== null && sale > 0 && sale < base && startOk && endOk;

  if (!saleValid) {
    return { hasPrice: true, effective: base, previous: null, discountPercent: null, onSale: false, saleEnd: null };
  }

  return {
    hasPrice: true,
    effective: sale,
    previous: base,
    discountPercent: Math.round(((base - sale!) / base) * 100),
    onSale: true,
    saleEnd: product.saleEnd,
  };
}

/** قالب‌بندی قیمت با جداکننده‌ی هزارگان فارسی. */
export function formatPrice(value: number): string {
  return `${value.toLocaleString('fa-IR')} ریال`;
}

/* ----------------------- شکل خام پاسخ WPGraphQL ----------------------- */

interface RawBrandNode {
  title: string | null;
  slug: string | null;
  brandFields?: { nameEn: string | null } | null;
}

interface RawImageNode {
  sourceUrl: string | null;
  altText: string | null;
  mediaDetails?: { width: number | null; height: number | null } | null;
}

interface RawProductNode {
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  modified: string | null;
  craneCategories?: { nodes?: { slug: string | null }[] } | null;
  productFields?: {
    sku: unknown;
    price: unknown;
    salePrice: unknown;
    saleStart: unknown;
    saleEnd: unknown;
    buyMode: unknown;
    stockStatus: unknown;
    brand: { nodes?: RawBrandNode[] } | RawBrandNode[] | null;
    gallery: { nodes?: RawImageNode[] } | RawImageNode[] | null;
    oemCrossReference: ({ oemBrand: string | null; oemPartNumber: string | null } | null)[] | null;
    compatibleModels: ({ craneBrand: string | null; modelName: string | null } | null)[] | null;
    technicalSpecs: ({ specLabel: string | null; specValue: string | null } | null)[] | null;
  } | null;
}

function parseBuyMode(raw: unknown): BuyMode {
  return asString(raw)?.toLowerCase() === 'cart' ? 'cart' : 'rfq';
}

function parseStockStatus(raw: unknown): StockStatus {
  const value = asString(raw)?.toLowerCase();
  if (value === 'in_stock') return 'in_stock';
  if (value === 'on_order') return 'on_order';
  return 'unknown';
}

function normalizeProduct(node: RawProductNode): CraneProduct | null {
  const name = cleanText(node.title);
  const slug = cleanText(node.slug);
  // بدون عنوان یا اسلاگ نه کارت معتبری قابل رندر است نه گره‌ی Product معتبر.
  if (!name || !slug) return null;

  const f = node.productFields ?? null;
  const brand = toArray<RawBrandNode>(f?.brand)[0] ?? null;

  return {
    name,
    slug,
    sku: cleanText(f?.sku),
    summary: stripHtml(node.excerpt),
    bodyHtml: cleanText(node.content),

    brandSlug: cleanText(brand?.slug),
    brandNameFa: cleanText(brand?.title),
    brandNameEn: cleanText(brand?.brandFields?.nameEn),
    categorySlugs: (node.craneCategories?.nodes ?? [])
      .map((c) => cleanText(c?.slug))
      .filter((s): s is string => s !== null),

    price: parsePrice(f?.price),
    salePrice: parsePrice(f?.salePrice),
    saleStart: cleanText(f?.saleStart),
    saleEnd: cleanText(f?.saleEnd),

    buyMode: parseBuyMode(f?.buyMode),
    stockStatus: parseStockStatus(f?.stockStatus),

    images: toArray<RawImageNode>(f?.gallery)
      .filter((img) => Boolean(img?.sourceUrl))
      .map((img) => ({
        url: img.sourceUrl!,
        // alt جعلی ممنوع؛ اما نام واقعی محصول یک alt توصیفی و درست است.
        altText: cleanText(img.altText) ?? name,
        width: img.mediaDetails?.width ?? null,
        height: img.mediaDetails?.height ?? null,
      })),

    oemCrossReference: (f?.oemCrossReference ?? [])
      .filter((r): r is { oemBrand: string; oemPartNumber: string } =>
        Boolean(cleanText(r?.oemBrand) && cleanText(r?.oemPartNumber))
      )
      .map((r) => ({ oemBrand: r.oemBrand.trim(), oemPartNumber: r.oemPartNumber.trim() })),

    compatibleModels: (f?.compatibleModels ?? [])
      .filter((r): r is { craneBrand: string; modelName: string } =>
        Boolean(cleanText(r?.craneBrand) && cleanText(r?.modelName))
      )
      .map((r) => ({ craneBrand: r.craneBrand.trim(), modelName: r.modelName.trim() })),

    technicalSpecs: (f?.technicalSpecs ?? [])
      .filter((r): r is { specLabel: string; specValue: string } =>
        Boolean(cleanText(r?.specLabel) && cleanText(r?.specValue))
      )
      .map((r) => ({ label: r.specLabel.trim(), value: r.specValue.trim() })),

    modified: cleanText(node.modified),
  };
}

const ALL_PRODUCTS_QUERY = `
  query AllCraneProducts($first: Int!, $after: String) {
    craneProducts(first: $first, after: $after, where: { status: PUBLISH }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        title
        slug
        excerpt
        content
        modified
        craneCategories { nodes { slug } }
        productFields {
          sku
          price
          salePrice
          saleStart
          saleEnd
          buyMode
          stockStatus
          brand { nodes { ... on CraneBrand { title slug brandFields { nameEn } } } }
          gallery { nodes { sourceUrl altText mediaDetails { width height } } }
          oemCrossReference { oemBrand oemPartNumber }
          compatibleModels { craneBrand modelName }
          technicalSpecs { specLabel specValue }
        }
      }
    }
  }
`;

interface AllProductsResponse {
  craneProducts: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: RawProductNode[];
  } | null;
}

/* ------------------------- بررسی اولیه‌ی اسکیما ------------------------- */

/**
 * کوئری کاوش سبک — عمداً از introspection (`__schema` / `__type`) استفاده
 * نمی‌کند.
 *
 * ⚠️ درس گرفته‌شده: نسخه‌ی اول این بررسی با introspection نوشته شده بود و
 * روی سرور واقعی شکست خورد، چون WPGraphQL به‌صورت پیش‌فرض introspection را
 * برای درخواست‌های عمومی می‌بندد. نتیجه این شد که خودِ ابزارِ تشخیص، جلوی
 * دیدن مشکل اصلی را گرفت. یک کوئری واقعی و کوچک، همان اطلاعات را بدون هیچ
 * وابستگی به تنظیمات سرور می‌دهد.
 */
const SCHEMA_PROBE_QUERY = `
  query CraneSchemaProbe {
    craneProducts(first: 1) { nodes { slug } }
  }
`;

let preflightDone = false;

/**
 * پیش از واکشی کاتالوگ، با یک کوئری واقعی و کوچک بررسی می‌کند که بک‌اند
 * اسکیمای مورد انتظار را دارد؛ و اگر نداشت، خطای قابل‌اقدام تولید می‌کند.
 *
 * چرا لازم است: پیام خام WPGraphQL («Cannot query field craneProducts…
 * Did you mean craneParts?») طوری به‌نظر می‌رسد که انگار کوئری فرانت‌اند
 * غلط است. نیست — علت سمت وردپرس است: پلاگین فعال نیست، نسخه‌اش قدیمی
 * است، یا افزونه‌ی دیگری نوع پستی با نام مشابه ثبت کرده.
 */
async function assertSchemaReady(): Promise<void> {
  if (preflightDone || !isWpConfigured()) return;

  try {
    await wpQuery<{ craneProducts: unknown }>(SCHEMA_PROBE_QUERY, {});
    preflightDone = true;
    return;
  } catch (error) {
    if (!(error instanceof WpGraphQLError)) throw error;

    const raw = error.messages.join(' | ');
    const missingType = /Cannot query field|Unknown type/i.test(raw);
    if (!missingType) throw error;

    // WPGraphQL خودش نام‌های مشابه را پیشنهاد می‌دهد؛ همان بهترین سرنخ برای
    // فهمیدن این است که کدام افزونه نوع پست را با نام دیگری ثبت کرده.
    const suggestions = [...raw.matchAll(/"([A-Za-z]*[Cc]rane[A-Za-z]*)"/g)]
      .map((m) => m[1])
      .filter((name) => name !== 'craneProducts');
    const unique = [...new Set(suggestions)];

    throw new Error(
      `[wp] اسکیمای وردپرس با پلاگین crane-yadak-headless هم‌خوانی ندارد.\n` +
        `  • پاسخ سرور: ${raw}\n` +
        (unique.length
          ? `  • نام‌های مشابهی که روی سرور وجود دارند: ${unique.join(', ')}\n`
          : '') +
        `\n` +
        `  این خطای کد فرانت‌اند نیست؛ سمت وردپرس باید بررسی شود:\n` +
        `  ۱) آیا افزونه‌ی «Crane Yadak — Headless Backend» در wp-admin ← افزونه‌ها «فعال» است؟\n` +
        `  ۲) آیا نسخه‌ی نصب‌شده همان zip فعلی است؟ پوشه‌ی قدیمی را کامل حذف کنید،\n` +
        `     بعد zip جدید را نصب کنید (نصب روی نسخه‌ی قبلی گاهی ناقص انجام می‌شود).\n` +
        `  ۳) آیا افزونه‌ی دیگری نوع پست مشابهی ثبت کرده که تداخل ایجاد می‌کند؟\n` +
        `     (نام‌های بالا سرنخ‌اند — مثلاً cranePart در برابر craneProduct)\n` +
        `  ۴) پس از هر تغییر، Settings ← Permalinks را یک‌بار ذخیره کنید.`
    );
  }
}

/** کش سطح ماژول: کل کاتالوگ فقط یک‌بار در هر build از شبکه گرفته می‌شود. */
let catalogPromise: Promise<CraneProduct[]> | null = null;

async function fetchAllProducts(): Promise<CraneProduct[]> {
  if (!isWpConfigured()) {
    console.warn(
      '[wp] WP_GRAPHQL_URL تنظیم نشده — صفحات محصول ساخته نمی‌شوند و صفحات ' +
        'دسته‌بندی/برند با «حالت خالیِ صادقانه» بیلد می‌شوند. نگاه کنید به .env.example'
    );
    return [];
  }

  // تشخیص زودهنگام و دقیق ناهماهنگی اسکیما، پیش از اولین کوئری کاتالوگ.
  await assertSchemaReady();

  const products: CraneProduct[] = [];
  let after: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data: AllProductsResponse | null = await wpQuery<AllProductsResponse>(
      ALL_PRODUCTS_QUERY,
      { first: PAGE_SIZE, after }
    );
    const connection = data?.craneProducts;
    if (!connection) break;

    for (const node of connection.nodes ?? []) {
      const product = normalizeProduct(node);
      if (product) products.push(product);
    }

    if (!connection.pageInfo?.hasNextPage || !connection.pageInfo.endCursor) break;
    after = connection.pageInfo.endCursor;
  }

  reportCatalogHealth(products);
  return products;
}

/**
 * گزارش سلامت کاتالوگ در لاگ بیلد.
 *
 * هدف: مشکلات داده‌ای که باعث «صفحه‌ی ضعیف» می‌شوند در سکوت رد نشوند.
 * این‌ها بیلد را نمی‌شکنند (داده‌ی ناقص یک واقعیت عملیاتی است، نه باگ کد)
 * اما باید دیده شوند.
 */
function reportCatalogHealth(products: CraneProduct[]): void {
  const noSku = products.filter((p) => !p.sku).length;
  const noImage = products.filter((p) => p.images.length === 0).length;
  const noCategory = products.filter((p) => p.categorySlugs.length === 0).length;
  const noBrand = products.filter((p) => !p.brandSlug).length;
  const cartWithoutPrice = products.filter((p) => p.buyMode === 'cart' && p.price === null);

  console.info(`[wp] ${products.length} محصول منتشرشده واکشی شد.`);
  if (noCategory) console.warn(`[wp] ⚠ ${noCategory} محصول بدون دسته‌بندی — در هیچ صفحه‌ی دسته دیده نمی‌شوند.`);
  if (noSku) console.warn(`[wp] ⚠ ${noSku} محصول بدون کد فنی — جستجوی Part Number آن‌ها را پیدا نمی‌کند.`);
  if (noImage) console.warn(`[wp] ⚠ ${noImage} محصول بدون تصویر.`);
  if (noBrand) console.warn(`[wp] ⚠ ${noBrand} محصول بدون برند.`);

  // این یکی جدی است: حالت «افزودن به سبد» بدون قیمت واقعی یعنی دکمه‌ی خرید
  // بدون مبلغ — هم بی‌معنا برای کاربر، هم داده‌ی متناقض برای اسکیما.
  if (cartWithoutPrice.length) {
    console.warn(
      `[wp] ⚠ ${cartWithoutPrice.length} محصول در حالت «خرید آنلاین» ولی بدون قیمت: ` +
        `${cartWithoutPrice.slice(0, 5).map((p) => p.slug).join(', ')}` +
        `${cartWithoutPrice.length > 5 ? ' …' : ''} — این‌ها به‌صورت «استعلام» رندر می‌شوند.`
    );
  }

  // هشدار انقضای تخفیف: سایت استاتیک است و تخفیف منقضی تا بیلد بعدی می‌ماند.
  const soon = new Date(Date.now() + 48 * 3600 * 1000);
  const expiring = products.filter(
    (p) => p.saleEnd && new Date(p.saleEnd) <= soon && new Date(p.saleEnd) >= new Date()
  );
  if (expiring.length) {
    console.warn(
      `[wp] ⚠ تخفیف ${expiring.length} محصول ظرف ۴۸ ساعت آینده منقضی می‌شود. ` +
        `چون خروجی استاتیک است، تا بیلد بعدی روی سایت باقی می‌ماند — وب‌هوک بازسازی را فعال کنید.`
    );
  }
}

export function getAllProducts(): Promise<CraneProduct[]> {
  catalogPromise ??= fetchAllProducts();
  return catalogPromise;
}

export async function getProductsByCategory(categorySlug: string): Promise<CraneProduct[]> {
  return (await getAllProducts()).filter((p) => p.categorySlugs.includes(categorySlug));
}

export async function getProductsByBrand(brandSlug: string): Promise<CraneProduct[]> {
  return (await getAllProducts()).filter((p) => p.brandSlug === brandSlug);
}

/** محصولات یک سیلو = اجتماع محصولات همه‌ی دسته‌های فرزند آن. */
export async function getProductsBySilo(categorySlugs: string[]): Promise<CraneProduct[]> {
  const set = new Set(categorySlugs);
  return (await getAllProducts()).filter((p) => p.categorySlugs.some((s) => set.has(s)));
}

/**
 * محصولات مرتبط: هم‌دسته‌ای‌ها، با اولویت هم‌برند بودن.
 * فقط محصولات واقعی — اگر چیزی نبود، آرایه‌ی خالی و بخش رندر نمی‌شود.
 */
export async function getRelatedProducts(product: CraneProduct, limit = 4): Promise<CraneProduct[]> {
  const all = await getAllProducts();
  const sameCategory = all.filter(
    (p) => p.slug !== product.slug && p.categorySlugs.some((s) => product.categorySlugs.includes(s))
  );
  return sameCategory
    .sort((a, b) => Number(b.brandSlug === product.brandSlug) - Number(a.brandSlug === product.brandSlug))
    .slice(0, limit);
}

/** مسیر متعارف صفحه‌ی محصول. */
export function productPath(product: Pick<CraneProduct, 'slug'>): string {
  return `/products/${product.slug}`;
}

/** لینک فرم استعلام با پارامترهای از پیش پرشده. */
export function inquiryHref(product: CraneProduct): string {
  const params = new URLSearchParams();
  if (product.sku) params.set('sku', product.sku);
  if (product.brandNameEn) params.set('brand', product.brandNameEn);
  const qs = params.toString();
  return qs ? `/contact?${qs}` : '/contact';
}

/**
 * ساخت گره‌ی Schema.org `Product`.
 *
 * قانون: هیچ فیلدی که مقدار واقعی ندارد ساخته نمی‌شود.
 * - `offers` فقط با قیمت عددی واقعی.
 * - `availability` فقط وقتی وردپرس صراحتاً وضعیت را اعلام کرده باشد؛
 *   `unknown` یعنی کلید اصلاً نوشته نمی‌شود (حدس‌زدن InStock ریسک جریمه دارد).
 * - `aggregateRating` و `review` هرگز — تا وقتی نظر واقعی مشتری وجود ندارد.
 */
export function productJsonLd(
  product: CraneProduct,
  siteUrl: string,
  price: PriceState
): Record<string, unknown> {
  const url = `${siteUrl}${productPath(product)}`;

  const node: Record<string, unknown> = {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    url,
  };

  if (product.summary) node.description = product.summary;
  if (product.sku) node.sku = product.sku;
  if (product.images.length > 0) node.image = product.images.map((i) => i.url);

  if (product.brandNameEn || product.brandNameFa) {
    node.brand = {
      '@type': 'Brand',
      name: product.brandNameEn ?? product.brandNameFa,
      ...(product.brandNameEn && product.brandNameFa ? { alternateName: product.brandNameFa } : {}),
    };
  }

  // کدهای معادل OEM + مدل‌های سازگار + مشخصات فنی → additionalProperty.
  // این‌ها واقعی و قابل راستی‌آزمایی‌اند و ارزش سئویی بالایی دارند.
  const properties = [
    ...product.oemCrossReference.map((r) => ({
      '@type': 'PropertyValue',
      name: `کد معادل ${r.oemBrand}`,
      value: r.oemPartNumber,
    })),
    ...product.compatibleModels.map((m) => ({
      '@type': 'PropertyValue',
      name: `سازگار با ${m.craneBrand}`,
      value: m.modelName,
    })),
    ...product.technicalSpecs.map((s) => ({
      '@type': 'PropertyValue',
      name: s.label,
      value: s.value,
    })),
  ];
  if (properties.length > 0) node.additionalProperty = properties;

  if (price.hasPrice && price.effective !== null) {
    const offer: Record<string, unknown> = {
      '@type': 'Offer',
      price: price.effective,
      priceCurrency: CURRENCY,
      url,
    };
    if (product.stockStatus === 'in_stock') offer.availability = 'https://schema.org/InStock';
    else if (product.stockStatus === 'on_order') offer.availability = 'https://schema.org/BackOrder';
    // stockStatus === 'unknown' → کلید availability اصلاً نوشته نمی‌شود.

    if (price.onSale && price.saleEnd) offer.priceValidUntil = price.saleEnd;
    node.offers = offer;
  }

  return node;
}
