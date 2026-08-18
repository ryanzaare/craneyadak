// src/lib/brands.ts
// ---------------------------------------------------------------------------
// برندها از وردپرس — با تاکسونومی به‌عنوان ساختار پایه.
//
// ═══════════════════════════════════════════════════════════════════════════
// باگی که این فایل رفع می‌کند
// ═══════════════════════════════════════════════════════════════════════════
// فیلدهای ACF برند (رنگ، متن لوگو، انکرتکست سئو، توضیح سئو) از ابتدا در
// افزونه تعریف شده بودند و مدیر سایت هر ۱۸ برند را با داده‌ی دقیق پر کرده
// بود — اما فرانت‌اند *هیچ‌کدام* را نمی‌خواند. صفحات برند کاملاً از روی
// `src/data/taxonomy.ts` رندر می‌شدند.
//
// نتیجه‌ی عملی: رنگ اختصاصی هر برند نادیده گرفته می‌شد و همه‌ی کارت‌ها
// نارنجی می‌شدند، و توضیح سئویی که مدیر سایت نوشته بود هرگز روی سایت
// نمی‌آمد. این بدترین نوع خرابی است: کاربر داده را وارد می‌کند، هیچ خطایی
// نمی‌بیند، و داده جایی نمایش داده نمی‌شود.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا تاکسونومی حذف نشد
// ═══════════════════════════════════════════════════════════════════════════
// درخواست این بود که «فالبک‌های hardcode حذف شوند». فیلدهای *محتوایی*
// حذف شدند — از این پس رنگ و متن سئو فقط از وردپرس می‌آیند. اما دو چیز
// عمداً در تاکسونومی می‌مانند:
//
//   • `slug` و `brandClass` — این‌ها *ساختار* هستند نه محتوا. مسیر
//     `/brands/[slug]` و گروه‌بندی سه‌گانه‌ی برندها در زمان build تولید
//     می‌شوند. اگر این‌ها از شبکه بیایند، یک قطعی وردپرس یعنی سایتی بدون
//     هیچ صفحه‌ی برند.
//   • همان دو مورد به‌عنوان تور ایمنی: اگر برندی هنوز در وردپرس ساخته
//     نشده باشد، صفحه‌اش خالی نمی‌ماند.
//
// و مهم‌تر: هر برندی که از وردپرس داده نگیرد، در زمان build **با نام
// گزارش می‌شود**. فالبک بی‌صدا دقیقاً همان چیزی بود که این باگ را ساخت.
// ---------------------------------------------------------------------------

import { wpQueryPublic } from './wp';
import { BRANDS, type Brand, type BrandClass } from '../data/taxonomy';

/** برند غنی‌شده — ساختار از تاکسونومی، محتوا از وردپرس. */
export interface EnrichedBrand extends Brand {
  /** رنگ اختصاصی برند (HEX) از ACF. `null` یعنی در وردپرس ثبت نشده. */
  color: string | null;
  /** انکرتکست سئو برای لینک‌های داخلی. */
  seoAnchor: string | null;
  /** آیا داده‌ی وردپرس واقعاً پیدا شد؟ برای گزارش زمان build. */
  fromWordPress: boolean;
}

// ⚠️ آرگومان `where` عمداً حذف شد.
//
// نسخه‌ی قبل `where: { status: PUBLISH }` داشت. اگر آن آرگومان روی این
// CPT پشتیبانی نشود، *کل کوئری* خطای اسکیما می‌دهد، catch پایین آن را
// می‌بلعد، و همه‌ی برندها بی‌صدا به داده‌ی محلی برمی‌گردند — دقیقاً همان
// چیزی که روی سایت دیده شد. کوئری بدون آرگومان به‌طور پیش‌فرض فقط
// محتوای منتشرشده‌ی عمومی را برمی‌گرداند، پس آن آرگومان لازم هم نبود.
const BRANDS_QUERY = `
  query CraneBrands($first: Int!) {
    craneBrands(first: $first) {
      nodes {
        databaseId
        title
        slug
        brandFields {
          nameEn
          logoText
          brandColor
          seoAnchor
          seoDesc
        }
      }
    }
  }
`;

interface RawBrand {
  databaseId?: number | null;
  title?: string | null;
  slug?: string | null;
  brandFields?: {
    nameEn?: string | null;
    logoText?: string | null;
    brandColor?: string | null;
    seoAnchor?: string | null;
    seoDesc?: string | null;
  } | null;
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * اعتبارسنجی رنگ. فقط HEX معتبر پذیرفته می‌شود.
 *
 * چرا: این مقدار مستقیم داخل صفت `style` می‌نشیند. یک مقدار دلخواه از
 * پنل مدیریت که بدون بررسی به CSS تزریق شود، یک بردار تزریق است. علاوه
 * بر آن، یک رنگ نامعتبر باعث می‌شود کارت *بدون* رنگ رندر شود و کسی
 * نفهمد چرا.
 */
function cleanHex(value: unknown): string | null {
  const raw = clean(value);
  if (!raw) return null;
  const hex = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex : null;
}

let brandsPromise: Promise<EnrichedBrand[]> | null = null;

/**
 * کلیدهای تطبیق یک رکورد وردپرس.
 *
 * ⚠️ چرا فقط اسلاگ کافی نیست — این علت اصلی خرابی بود:
 * وقتی مدیر سایت یک برند را با عنوان فارسی («دماگ») در وردپرس می‌سازد،
 * وردپرس اسلاگ را از همان عنوان فارسی می‌سازد. یعنی اسلاگ واقعی
 * `%D8%AF%D9%85%D8%A7%DA%AF` می‌شود، نه `demag`. تطبیق بر اساس اسلاگ
 * هیچ‌وقت جواب نمی‌داد و همه‌ی ۱۸ برند بی‌صدا به داده‌ی محلی برمی‌گشتند.
 *
 * حالا با سه کلید تطبیق داده می‌شود: اسلاگ، نام انگلیسی ACF، و عنوان
 * پست. هر کدام که بخورد کافی است.
 */
function matchKeys(node: RawBrand): string[] {
  const keys = [
    clean(node?.slug),
    clean(node?.brandFields?.nameEn),
    clean(node?.title),
    clean(node?.brandFields?.logoText),
  ];
  return keys.filter((k): k is string => Boolean(k)).map((k) => k.toLowerCase().trim());
}

async function fetchBrands(): Promise<EnrichedBrand[]> {
  let byslug = new Map<string, RawBrand>();
  let raw: RawBrand[] = [];

  try {
    const data = await wpQueryPublic<{ craneBrands?: { nodes?: RawBrand[] } }>(BRANDS_QUERY, {
      first: 100,
    });
    raw = data?.craneBrands?.nodes ?? [];

    for (const node of raw) {
      for (const key of matchKeys(node)) {
        // اولین تطبیق برنده است تا یک برند، برند دیگری را بازنویسی نکند.
        if (!byslug.has(key)) byslug.set(key, node);
      }
    }
  } catch (error) {
    // همان الگوی «غنی‌سازی اختیاری» بقیه‌ی پروژه: نبود فیلدهای برند
    // نباید کل بیلد را بخواباند. اما ساکت هم نمی‌ماند.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `\n📋 فیلدهای برند از وردپرس خوانده نشدند — از ساختار محلی استفاده می‌شود.\n` +
        `   رنگ اختصاصی و متن سئوی برندها نمایش داده نخواهد شد.\n` +
        `   جزئیات: ${message.slice(0, 200)}\n`
    );
    byslug = new Map();
  }

  const enriched: EnrichedBrand[] = BRANDS.map((base) => {
    // به ترتیب: اسلاگ، نام انگلیسی، نام فارسی، متن لوگو.
    const wp =
      byslug.get(base.slug) ??
      byslug.get(base.nameEn.toLowerCase()) ??
      byslug.get(base.nameFa.toLowerCase()) ??
      byslug.get(base.logoText.toLowerCase());
    const f = wp?.brandFields;

    return {
      ...base,
      // نام فارسی: عنوان پست وردپرس بر تاکسونومی اولویت دارد.
      nameFa: clean(wp?.title) ?? base.nameFa,
      nameEn: clean(f?.nameEn) ?? base.nameEn,
      logoText: clean(f?.logoText) ?? base.logoText,
      seoDesc: clean(f?.seoDesc) ?? base.seoDesc,
      color: cleanHex(f?.brandColor),
      seoAnchor: clean(f?.seoAnchor),
      fromWordPress: Boolean(wp),
    };
  });

  // ── گزارش زمان build ─────────────────────────────────────────────
  // فالبک بی‌صدا همان چیزی بود که باعث شد این باگ هفته‌ها دیده نشود.
  const missing = enriched.filter((b) => !b.fromWordPress);
  const noColor = enriched.filter((b) => b.fromWordPress && !b.color);

  if (missing.length > 0) {
    // تشخیص دقیق: چه چیزی *واقعاً* از وردپرس آمد. بدون این، تنها چیزی
    // که می‌دیدیم «داده نیامد» بود و علتش قابل حدس نبود.
    const wpKeys = raw.map((n) => `${clean(n?.slug) ?? '?'}  ←  «${clean(n?.title) ?? '?'}»`);
    console.warn(
      `\n⚠️  ${missing.length} از ${BRANDS.length} برند با رکورد وردپرس تطبیق نخورد:\n` +
        missing.map((b) => `    • ${b.nameFa} (انتظار: ${b.slug})`).join('\n') +
        `\n\n  وردپرس این ${raw.length} رکورد را برگرداند:\n` +
        (raw.length === 0
          ? `    (هیچ‌کدام — یا برندها منتشر نشده‌اند، یا کوئری خطا داده است)\n`
          : wpKeys.map((k) => `    ${k}`).join('\n') + '\n') +
        `\n  رایج‌ترین علت: اسلاگ برند در وردپرس فارسی است. عنوان فارسی\n` +
        `  اسلاگ فارسی می‌سازد و با اسلاگ لاتین تاکسونومی تطبیق نمی‌خورد.\n` +
        `  راه‌حل: در فهرست برندها دکمه‌ی «اصلاح آدرس‌ها» را بزنید، یا اسلاگ\n` +
        `  هر برند را دستی به معادل لاتین تغییر دهید.\n`
    );
  }
  if (noColor.length > 0) {
    console.warn(
      `\n⚠️  ${noColor.length} برند رنگ اختصاصی ندارد و با رنگ پیش‌فرض سایت رندر می‌شود:\n` +
        noColor.map((b) => `    • ${b.nameFa} (${b.slug})`).join('\n') + '\n'
    );
  }
  if (missing.length === 0 && noColor.length === 0) {
    console.log(`[wp] ✓ هر ${enriched.length} برند با داده‌ی کامل وردپرس بارگذاری شد.`);
  }

  return enriched;
}

export function getBrands(): Promise<EnrichedBrand[]> {
  brandsPromise ??= fetchBrands();
  return brandsPromise;
}

export async function getBrand(slug: string): Promise<EnrichedBrand | undefined> {
  return (await getBrands()).find((b) => b.slug === slug);
}

export async function getBrandsByClass(brandClass: BrandClass): Promise<EnrichedBrand[]> {
  return (await getBrands()).filter((b) => b.brandClass === brandClass);
}
