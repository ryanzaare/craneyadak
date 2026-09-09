// src/lib/section-order.ts
// ---------------------------------------------------------------------------
// ترتیب بخش‌های صفحه‌ی برند — از وردپرس، نه از کد.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا این ماژول کاملاً جدا و «اختیاری» است
// ═══════════════════════════════════════════════════════════════════════════
// این یک فیلد **تازه** در گروه تنظیمات سایت است. اگر داخل کوئری موجودِ
// site-options می‌رفت، تا لحظه‌ای که افزونه‌ی جدید نصب شود آن کوئری شکست
// می‌خورد و **اطلاعات تماس، پرسش‌های متداول و سنجه‌های اعتماد از کل سایت
// محو می‌شد** — به‌خاطر یک تنظیم ظاهری.
//
// همان دامی که یک بار با `media` و یک بار با `supplyStatus` افتادیم.
//
// پس: کوئری خودش، خطای خودش، و شکستِ خودش. اگر این کوئری بیفتد، تنها
// چیزی که از دست می‌رود ترتیب دلخواه است و ترتیب پیش‌فرض کد سر جایش
// می‌ماند. هیچ محتوایی ناپدید نمی‌شود.
// ---------------------------------------------------------------------------

import { isWpConfigured, wpQueryPublic } from './wp';

/** شناسه‌های معتبر — با `id` بخش‌ها در BrandGuide.astro یکی است. */
export const BRAND_SECTION_IDS = [
  'brand-intro',
  'brand-series',
  'brand-media',
  'brand-nameplate',
  'brand-iran',
  'brand-parts',
  'brand-tech',
  'brand-faq',
] as const;

export type BrandSectionId = (typeof BRAND_SECTION_IDS)[number];

const isKnown = (v: unknown): v is BrandSectionId =>
  typeof v === 'string' && (BRAND_SECTION_IDS as readonly string[]).includes(v);

/**
 * ترتیب دلخواه را روی ترتیب پیش‌فرض اعمال می‌کند.
 *
 * ⚠️ دو قاعده‌ی ایمنی که هر دو لازم‌اند:
 *
 *   ۱) **هر بخشی که در فهرست وردپرس نیامده، حذف نمی‌شود** — به انتها
 *      اضافه می‌شود. اگر فردا بخش تازه‌ای به کد اضافه شود و مدیر هنوز
 *      آن را در پنل مرتب نکرده باشد، نباید بی‌صدا از صفحه غیب شود.
 *
 *   ۲) **نام ناشناخته نادیده گرفته می‌شود** — یک غلط تایپی در پنل نباید
 *      رندر را بشکند.
 *
 * @param available شناسه‌ی بخش‌هایی که واقعاً محتوا دارند.
 * @param wanted    ترتیب دلخواه از وردپرس (ممکن است null باشد).
 */
export function applySectionOrder(available: string[], wanted: readonly string[] | null): string[] {
  if (!wanted || wanted.length === 0) return available;

  const pool = new Set(available);
  const out: string[] = [];

  for (const id of wanted) {
    if (isKnown(id) && pool.has(id) && !out.includes(id)) out.push(id);
  }
  // قاعده‌ی ۱ — هرچه جا مانده، به ترتیب پیش‌فرض ته فهرست می‌رود.
  for (const id of available) if (!out.includes(id)) out.push(id);

  return out;
}

type Payload = {
  craneSiteOptions: { siteOptionsFields: { brandSectionOrder: { section: string | null }[] | null } | null } | null;
};

const QUERY = `query BrandSectionOrder {
  craneSiteOptions { siteOptionsFields { brandSectionOrder { section } } }
}`;

let cache: Promise<BrandSectionId[] | null> | null = null;

async function fetchOrder(): Promise<BrandSectionId[] | null> {
  if (!isWpConfigured()) return null;
  try {
    const data = await wpQueryPublic<Payload>(QUERY, {});
    const rows = data?.craneSiteOptions?.siteOptionsFields?.brandSectionOrder ?? null;
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const ids = rows.map((r) => r?.section).filter(isKnown);
    if (ids.length === 0) return null;

    console.info(`[layout] ترتیب بخش‌های برند از وردپرس خوانده شد: ${ids.join(' ← ')}`);
    return ids;
  } catch {
    // ساکت و بی‌خطر: ترتیب پیش‌فرض کد استفاده می‌شود. این یک تنظیم ظاهری
    // است و نباید هیچ‌وقت باعث شکست build شود.
    return null;
  }
}

export function getBrandSectionOrder(): Promise<BrandSectionId[] | null> {
  cache ??= fetchOrder();
  return cache;
}
