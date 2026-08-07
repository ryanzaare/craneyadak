// src/lib/wp.ts
// ---------------------------------------------------------------------------
// لایه‌ی داده‌ی Headless WordPress (WPGraphQL + ACF Pro) — فقط زمان BUILD.
//
// چرا این فایل وجود دارد:
// پیش از این، صفحات `categories/[slug].astro` و `brands/[slug].astro` یک
// آرایه‌ی `mockProducts` ساختگی (نام و کد فنی جعلی) را هم در محتوای قابل
// مشاهده و هم در JSON-LD (ItemList/Product) تزریق می‌کردند. این نقض مستقیم
// قانون غیرقابل‌مذاکره‌ی پروژه است و گوگل آن را «Structured Data Spam»
// می‌داند. این ماژول تنها منبع مجاز محصولات است: یا داده‌ی واقعی از وردپرس
// برمی‌گرداند، یا آرایه‌ی خالی — هرگز داده‌ی ساختگی.
//
// معماری: تمام fetchها فقط در `getStaticPaths()` (زمان build) اجرا می‌شوند.
// خروجی سایت `output: 'static'` باقی می‌ماند و بازدیدکننده هیچ وابستگی
// زمان‌اجرا به وردپرس ندارد — نگاه کنید به docs/backend-integration.md.
//
// وابستگی‌های وردپرسی: فقط WPGraphQL + WPGraphQL for ACF.
// عمداً از `taxQuery`/`metaQuery` استفاده نشده چون هرکدام به یک افزونه‌ی
// جانبی جداگانه (WPGraphQL Tax Query / Meta Query) نیاز دارند که ممکن است
// روی سرور نصب نباشد. در عوض کل کاتالوگ یک‌بار در هر build واکشی و در
// حافظه فیلتر می‌شود — سریع‌تر (یک رفت‌وبرگشت به‌جای N) و بدون وابستگی.
//
// متغیر محیطی: `WP_GRAPHQL_URL` (عمداً بدون پیشوند PUBLIC_ تا هرگز داخل
// باندل سمت کلاینت لو نرود؛ این آدرس فقط در سرورِ بیلد لازم است).
// ---------------------------------------------------------------------------

/**
 * دسترسی امن به `process.env` بدون وابستگی به تایپ‌های Node.
 * چرا هر دو منبع خوانده می‌شوند: `import.meta.env` مقادیر فایل `.env` را
 * می‌دهد، اما در CI/سرویس دیپلوی (ArvanCloud, Vercel, Netlify, …) متغیرها
 * معمولاً فقط در `process.env` تزریق می‌شوند و هیچ فایل `.env`ی وجود ندارد.
 */
const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  ?.env;

/** آدرس پایه‌ی وردپرس، یا `null` وقتی بک‌اند هنوز وصل نشده است. */
const WP_BASE_URL: string | null =
  nodeEnv?.WP_GRAPHQL_URL || (import.meta.env.WP_GRAPHQL_URL as string | undefined) || null;

/** مهلت هر درخواست بیلد (میلی‌ثانیه) — جلوگیری از هنگ‌کردن نامحدود CI. */
const REQUEST_TIMEOUT_MS = 20_000;

/** تعداد تلاش مجدد در صورت خطای گذرای شبکه. */
const MAX_ATTEMPTS = 3;

/** اندازه‌ی هر صفحه‌ی pagination در واکشی کاتالوگ. */
const PAGE_SIZE = 100;

/** سقف ایمنی: حداکثر تعداد صفحه‌ی pagination (جلوگیری از حلقه‌ی بی‌نهایت). */
const MAX_PAGES = 100;

export interface CraneProductImage {
  url: string;
  altText: string;
  width: number | null;
  height: number | null;
}

export interface CraneProduct {
  /** عنوان محصول (title بومی وردپرس). */
  name: string;
  /** اسلاگ یکتای وردپرس — کلید پایدار برای key/anchor. */
  slug: string;
  /** کد فنی/Part Number. ممکن است در وردپرس خالی باشد. */
  sku: string | null;
  /** نام فارسی برند مرتبط (title از CPT `brand`). */
  brandNameFa: string | null;
  /** نام لاتین برند (ACF: brandFields.nameEn) — برای پارامتر فرم استعلام. */
  brandNameEn: string | null;
  /** اسلاگ برند مرتبط — کلید اتصال محصول به صفحه‌ی برند. */
  brandSlug: string | null;
  /** اسلاگ‌های دسته‌بندی (`crane_category`) که محصول به آن‌ها تعلق دارد. */
  categorySlugs: string[];
  /**
   * متن نمایشی قیمت («تماس بگیرید»، «استعلام»، یا یک عدد واقعی).
   * فقط برای نمایش است و هرگز مستقیماً وارد Schema.org نمی‌شود.
   */
  priceDisplay: string | null;
  /**
   * قیمت عددی واقعی به ریال، فقط وقتی `priceDisplay` یک عدد معتبر باشد.
   * `null` یعنی قیمت واقعی نداریم → کلید `offers` در Schema.org تولید
   * نمی‌شود (Offer بدون `price` در Rich Results Test خطا می‌دهد).
   */
  price: number | null;
  /** اولین تصویر گالری، یا `null`. */
  image: CraneProductImage | null;
  /** کدهای معادل OEM — ارزش سئویی بالا برای جستجوی Part Number. */
  oemCrossReference: { oemBrand: string; oemPartNumber: string }[];
}

/** آیا بک‌اند وردپرس پیکربندی شده است؟ */
export function isWpConfigured(): boolean {
  return typeof WP_BASE_URL === 'string' && WP_BASE_URL.trim() !== '';
}

/**
 * اجرای یک کوئری GraphQL روی بک‌اند وردپرس.
 *
 * سیاست خطا (تصمیم مهندسی آگاهانه):
 * - اگر `WP_GRAPHQL_URL` تنظیم نشده باشد → `null` برمی‌گرداند؛ بیلد بدون
 *   بک‌اند سالم اجرا می‌شود و صفحات با «حالت خالیِ صادقانه» رندر می‌شوند.
 * - اگر تنظیم شده ولی درخواست شکست بخورد → عمداً `throw` می‌کند و بیلد را
 *   می‌شکند. شکست خاموش (fallback بی‌صدا به آرایه‌ی خالی) بدترین حالت است:
 *   یک کاتالوگ خالی بی‌سروصدا روی پروداکشن منتشر می‌شود و صفحات واقعی از
 *   ایندکس گوگل حذف می‌شوند بدون این‌که کسی متوجه شود.
 */
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

      if (!res.ok) {
        throw new Error(`WPGraphQL پاسخ HTTP ${res.status} ${res.statusText} داد`);
      }

      const json = (await res.json()) as { data?: T; errors?: { message: string }[] };

      if (json.errors?.length) {
        throw new Error(`خطای WPGraphQL: ${json.errors.map((e) => e.message).join(' | ')}`);
      }

      return json.data ?? null;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        // Backoff نمایی ساده — خطاهای گذرای شبکه (خصوصاً از/به ایران) رایج‌اند.
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
      }
    }
  }

  throw new Error(
    `[wp] دریافت داده از ${endpoint} پس از ${MAX_ATTEMPTS} تلاش شکست خورد. ` +
      `بیلد عمداً متوقف شد تا سایت با کاتالوگ خالی منتشر نشود. ` +
      `علت آخرین خطا: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

/* -------------------------------------------------------------------------
 * شکل خام پاسخ WPGraphQL (مطابق با wordpress-plugin/crane-yadak-headless)
 * ---------------------------------------------------------------------- */
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
  craneCategories?: { nodes?: { slug: string | null }[] } | null;
  productFields?: {
    sku: string | null;
    priceDisplay: string | null;
    brand: { nodes?: RawBrandNode[] } | RawBrandNode[] | null;
    gallery: { nodes?: RawImageNode[] } | RawImageNode[] | null;
    oemCrossReference: ({ oemBrand: string | null; oemPartNumber: string | null } | null)[] | null;
  } | null;
}

/** WPGraphQL for ACF گاهی connection (`{nodes:[]}`) و گاهی آرایه برمی‌گرداند. */
function toArray<T>(value: { nodes?: T[] } | T[] | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.nodes ?? [];
}

/**
 * تبدیل `priceDisplay` به عدد — فقط وقتی مقدار واقعاً یک عدد باشد.
 * «تماس بگیرید»/«استعلام» → `null` (هیچ Offer در اسکیما ساخته نمی‌شود).
 * ارقام فارسی/عربی و جداکننده‌ی هزارگان نرمال‌سازی می‌شوند.
 */
export function parsePrice(priceDisplay: string | null): number | null {
  if (!priceDisplay) return null;

  const normalized = priceDisplay
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // ارقام فارسی
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // ارقام عربی
    .replace(/[،,\s‌]/g, '') // جداکننده‌ی هزارگان، فاصله، نیم‌فاصله
    .trim();

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeProduct(node: RawProductNode): CraneProduct | null {
  const name = node.title?.trim();
  const slug = node.slug?.trim();

  // بدون عنوان یا اسلاگ، نه کارت معتبری قابل رندر است نه گره‌ی Product
  // معتبری در اسکیما — چنین رکوردی کنار گذاشته می‌شود (نه ساخته/ترمیم).
  if (!name || !slug) return null;

  const fields = node.productFields ?? null;
  const brand = toArray<RawBrandNode>(fields?.brand)[0] ?? null;
  const image = toArray<RawImageNode>(fields?.gallery)[0] ?? null;
  const priceDisplay = fields?.priceDisplay?.trim() || null;

  return {
    name,
    slug,
    sku: fields?.sku?.trim() || null,
    brandNameFa: brand?.title?.trim() || null,
    brandNameEn: brand?.brandFields?.nameEn?.trim() || null,
    brandSlug: brand?.slug?.trim() || null,
    categorySlugs: (node.craneCategories?.nodes ?? [])
      .map((c) => c?.slug?.trim())
      .filter((s): s is string => Boolean(s)),
    priceDisplay,
    price: parsePrice(priceDisplay),
    image: image?.sourceUrl
      ? {
          url: image.sourceUrl,
          // alt جعلی ممنوع است، اما نام واقعی محصول یک alt توصیفی و درست
          // است و برای Google Image Search ارزش دارد.
          altText: image.altText?.trim() || name,
          width: image.mediaDetails?.width ?? null,
          height: image.mediaDetails?.height ?? null,
        }
      : null,
    oemCrossReference: (fields?.oemCrossReference ?? [])
      .filter((r): r is { oemBrand: string; oemPartNumber: string } =>
        Boolean(r?.oemBrand?.trim() && r?.oemPartNumber?.trim())
      )
      .map((r) => ({ oemBrand: r.oemBrand.trim(), oemPartNumber: r.oemPartNumber.trim() })),
  };
}

const ALL_PRODUCTS_QUERY = `
  query AllCraneProducts($first: Int!, $after: String) {
    craneProducts(first: $first, after: $after, where: { status: PUBLISH }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        title
        slug
        craneCategories { nodes { slug } }
        productFields {
          sku
          priceDisplay
          brand { nodes { ... on CraneBrand { title slug brandFields { nameEn } } } }
          gallery { nodes { sourceUrl altText mediaDetails { width height } } }
          oemCrossReference { oemBrand oemPartNumber }
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

/**
 * کش در سطح ماژول: `getStaticPaths()` هر صفحه‌ی داینامیک یک‌بار اجرا می‌شود،
 * ولی همگی همین یک Promise را share می‌کنند — کل کاتالوگ در هر build فقط
 * یک‌بار (نه یک‌بار به‌ازای هر دسته/برند) از شبکه گرفته می‌شود.
 */
let catalogPromise: Promise<CraneProduct[]> | null = null;

async function fetchAllProducts(): Promise<CraneProduct[]> {
  if (!isWpConfigured()) {
    console.warn(
      '[wp] WP_GRAPHQL_URL تنظیم نشده است — صفحات دسته‌بندی و برند بدون لیست ' +
        'محصول (حالت خالیِ صادقانه) بیلد می‌شوند. برای اتصال بک‌اند، ' +
        '.env.example را ببینید.'
    );
    return [];
  }

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

  console.info(`[wp] ${products.length} محصول منتشرشده از وردپرس واکشی شد.`);
  return products;
}

/** کل کاتالوگ محصولات منتشرشده (یک‌بار در هر build واکشی و کش می‌شود). */
export function getAllProducts(): Promise<CraneProduct[]> {
  catalogPromise ??= fetchAllProducts();
  return catalogPromise;
}

/**
 * محصولات یک دسته‌بندی. `categorySlug` باید دقیقاً با اسلاگ ترم
 * `crane_category` در وردپرس یکی باشد (توصیه‌ی docs/backend-integration.md
 * بخش ۷ — با یکسان نگه‌داشتن اسلاگ‌ها، جدول 301 Redirect لازم نمی‌شود).
 *
 * وقتی بک‌اند وصل نیست → `[]`. هرگز داده‌ی ساختگی.
 */
export async function getProductsByCategory(categorySlug: string): Promise<CraneProduct[]> {
  const all = await getAllProducts();
  return all.filter((p) => p.categorySlugs.includes(categorySlug));
}

/**
 * محصولات یک برند. `brandSlug` اسلاگ CPT `brand` در وردپرس است.
 *
 * وقتی بک‌اند وصل نیست → `[]`. هرگز داده‌ی ساختگی.
 */
export async function getProductsByBrand(brandSlug: string): Promise<CraneProduct[]> {
  const all = await getAllProducts();
  return all.filter((p) => p.brandSlug === brandSlug);
}

/**
 * ساخت گره‌ی Schema.org `Product` از یک محصول واقعی.
 *
 * قانون: هیچ فیلدی که مقدار واقعی ندارد ساخته نمی‌شود. مشخصاً `offers`
 * فقط وقتی اضافه می‌شود که قیمت عددی واقعی موجود باشد، و `availability`
 * هرگز حدس زده نمی‌شود — موجودی واقعی در یک خروجی استاتیک قابل تضمین
 * نیست و ادعای `InStock` هم گمراه‌کننده است هم ریسک جریمه‌ی ریچ‌ریزالت.
 */
export function productJsonLd(product: CraneProduct, siteUrl: string): Record<string, unknown> {
  const inquiryUrl = new URL('/contact', siteUrl);
  if (product.sku) inquiryUrl.searchParams.set('sku', product.sku);
  if (product.brandNameEn) inquiryUrl.searchParams.set('brand', product.brandNameEn);

  const node: Record<string, unknown> = {
    '@type': 'Product',
    name: product.name,
    url: inquiryUrl.toString(),
  };

  if (product.sku) node.sku = product.sku;
  if (product.brandNameEn || product.brandNameFa) {
    node.brand = {
      '@type': 'Brand',
      name: product.brandNameEn ?? product.brandNameFa,
      ...(product.brandNameEn && product.brandNameFa ? { alternateName: product.brandNameFa } : {}),
    };
  }
  if (product.image) node.image = product.image.url;
  if (product.oemCrossReference.length > 0) {
    node.additionalProperty = product.oemCrossReference.map((ref) => ({
      '@type': 'PropertyValue',
      name: `کد OEM ${ref.oemBrand}`,
      value: ref.oemPartNumber,
    }));
  }
  if (product.price !== null) {
    node.offers = {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'IRR',
      url: inquiryUrl.toString(),
    };
  }

  return node;
}

/** لینک فرم استعلام برای یک محصول (همان URL که در Schema.org هم می‌رود). */
export function inquiryHref(product: CraneProduct): string {
  const params = new URLSearchParams();
  if (product.sku) params.set('sku', product.sku);
  if (product.brandNameEn) params.set('brand', product.brandNameEn);
  const qs = params.toString();
  return qs ? `/contact?${qs}` : '/contact';
}
