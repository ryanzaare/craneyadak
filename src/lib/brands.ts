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
          brandClass
          country
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
    brandClass?: string | null;
    country?: string | null;
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

  /* ═══════════════════════════════════════════════════════════════════════
     اجتماع دو منبع — رفع باگی که برند نوزدهم را نامرئی کرده بود
     ═══════════════════════════════════════════════════════════════════════
     ⚠️ نسخه‌ی قبل `BRANDS.map(...)` بود: یعنی فهرست *هجده‌تایی محلی* را
     می‌پیمود و هرکدام را با داده‌ی وردپرس غنی می‌کرد. نتیجه‌ی منطقی‌اش
     این بود که برندی که فقط در وردپرس وجود دارد — مثل «بریما» که تازه
     اضافه شد — هرگز در حلقه نمی‌افتاد و روی هیچ صفحه‌ای دیده نمی‌شد.
     هیچ خطایی هم چاپ نمی‌شد، چون از دید کد اصلاً وجود نداشت.

     این دقیقاً همان اشتباهی است که در دسته‌ها هم رخ داد: فهرست محلی
     مرجعِ *وجود* گرفته شده بود، در حالی که وردپرس باید مرجع باشد.

     حالا خروجی، اجتماع دو مجموعه است:
       • هر برندی که در وردپرس هست  → نمایش داده می‌شود (حتی اگر در
         تاکسونومی نباشد).
       • هر برندی که در تاکسونومی هست ولی هنوز در وردپرس نه → با داده‌ی
         محلی نمایش داده می‌شود و در خروجی build نام‌به‌نام گزارش می‌شود.

     تاکسونومی از این پس فقط «تور ایمنی» است، نه دروازه‌بان.
     ═══════════════════════════════════════════════════════════════════════ */

  /** گروه معتبر یا پیش‌فرض امن. */
  function toBrandClass(value: unknown): BrandClass {
    const v = clean(value)?.toLowerCase();
    return v === 'control' || v === 'electrical' || v === 'oem' ? v : 'oem';
  }

  /** اسلاگ لاتین از نام انگلیسی — برای برندی که اسلاگ وردپرسش فارسی است. */
  function latinSlug(node: RawBrand): string | null {
    const candidate = clean(node?.slug);
    if (candidate && /^[a-z0-9-]+$/i.test(candidate)) return candidate.toLowerCase();
    const en = clean(node?.brandFields?.nameEn) ?? clean(node?.brandFields?.logoText);
    if (!en) return null;
    return en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || null;
  }

  const enriched: EnrichedBrand[] = [];
  const usedWpIds = new Set<number>();

  // ── ۱) برندهای تاکسونومی، غنی‌شده با وردپرس ──
  for (const base of BRANDS) {
    const wp =
      byslug.get(base.slug) ??
      byslug.get(base.nameEn.toLowerCase()) ??
      byslug.get(base.nameFa.toLowerCase()) ??
      byslug.get(base.logoText.toLowerCase());
    const f = wp?.brandFields;
    if (wp?.databaseId) usedWpIds.add(wp.databaseId);

    enriched.push({
      ...base,
      nameFa: clean(wp?.title) ?? base.nameFa,
      nameEn: clean(f?.nameEn) ?? base.nameEn,
      logoText: clean(f?.logoText) ?? base.logoText,
      seoDesc: clean(f?.seoDesc) ?? base.seoDesc,
      country: clean(f?.country) ?? base.country,
      /* ⚠️ گروه: وردپرس فقط وقتی برنده است که *صریحاً* مقداری ثبت شده باشد.
         باگی که اینجا رخ داد: فیلد ACF با `default_value: 'oem'` ساخته شده
         بود. ACF برای هر رکوردی که آن فیلد را هرگز ذخیره نکرده، همان مقدار
         پیش‌فرض را برمی‌گرداند — یعنی هر ۱۹ برند «oem» گزارش می‌شدند و چون
         وردپرس اولویت داشت، گروه‌های کنترل و برقی خالی می‌شدند.
         پیش‌فرض از فیلد حذف شد؛ این `clean()` هم تضمین می‌کند رشته‌ی خالی
         به‌عنوان انتخاب واقعی تفسیر نشود. */
      brandClass: clean(f?.brandClass) ? toBrandClass(f?.brandClass) : base.brandClass,
      color: cleanHex(f?.brandColor),
      seoAnchor: clean(f?.seoAnchor),
      fromWordPress: Boolean(wp),
    });
  }

  // ── ۲) برندهایی که فقط در وردپرس هستند ──
  const known = new Set(enriched.map((b) => b.slug));
  const wpOnly: string[] = [];

  for (const node of raw) {
    if (node?.databaseId && usedWpIds.has(node.databaseId)) continue;

    const slug = latinSlug(node);
    const f = node?.brandFields;
    const nameFa = clean(node?.title);
    // بدون اسلاگ لاتین نمی‌توان آدرس صفحه ساخت، و بدون نام چیزی برای
    // نمایش نیست. چنین رکوردی رد می‌شود اما گزارش هم می‌شود.
    if (!slug || known.has(slug) || !nameFa) continue;

    known.add(slug);
    wpOnly.push(`${nameFa} (${slug})`);

    enriched.push({
      slug,
      nameFa,
      nameEn: clean(f?.nameEn) ?? nameFa,
      logoText: clean(f?.logoText) ?? (clean(f?.nameEn) ?? nameFa).toUpperCase(),
      brandClass: toBrandClass(f?.brandClass),
      country: clean(f?.country) ?? '',
      seoDesc: clean(f?.seoDesc) ?? '',
      color: cleanHex(f?.brandColor),
      seoAnchor: clean(f?.seoAnchor),
      fromWordPress: true,
    });
  }

  if (wpOnly.length > 0) {
    console.log(
      `[wp] ✓ ${wpOnly.length} برند فقط از وردپرس اضافه شد: ${wpOnly.join('، ')}`
    );
  }

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

